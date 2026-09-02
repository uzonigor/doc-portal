/**
 * Trase kablova iz geometrije krova.
 *
 * Ovde prestaje pretpostavka i počinje merenje: pozicije modula i opreme su
 * stvarne, u metrima, pa se dužine računaju iz njih.
 *
 * Ožičenje stringa se vodi LEAPFROG redosledom (preskoči pa se vrati), jer
 * tako oba kraja stringa izlaze na istom mestu i površina strujne petlje
 * ostaje mala — to je uslov za dimenzionisanje prenaponske zaštite, a ne
 * samo estetika. Najkraća trasa bez povratka daje veliku petlju.
 */

import { korakMreze, dimenzijeModula } from './plan-model.js';
import { predlogPreseka } from './proracun.js';

/** Centar modula (r, c) u apsolutnim koordinatama crteža, u metrima. */
export function centarModula(model, polje, r, c) {
    const [kx, ky] = korakMreze(model, polje);
    const [mw, mh] = dimenzijeModula(model, polje);

    const lx = c * kx + mw / 2;
    const ly = r * ky + mh / 2;

    const ugao = ((polje.rot || 0) * Math.PI) / 180;
    const cos = Math.cos(ugao), sin = Math.sin(ugao);

    return {
        x: polje.pos.x + lx * cos - ly * sin,
        y: polje.pos.y + lx * sin + ly * cos
    };
}

/** Svi moduli dodeljeni stringu, u redosledu čitanja po poljima. */
export function moduliStringa(model, stringId) {
    const out = [];

    model.polja.forEach(polje => {
        for (let r = 0; r < polje.redova; r++) {
            for (let c = 0; c < polje.kolona; c++) {
                const st = model.stanjeModula(polje, r, c);
                if (st.string === stringId && !st.iskljucen) {
                    out.push({ polje, r, c, centar: centarModula(model, polje, r, c) });
                }
            }
        }
    });

    return out;
}

/** Moduli grupisani po redovima (polje + red), sortirani po koloni. */
function poRedovima(moduli) {
    const mapa = new Map();
    moduli.forEach(m => {
        const kljuc = `${m.polje.id}|${String(m.r).padStart(4, '0')}`;
        if (!mapa.has(kljuc)) mapa.set(kljuc, []);
        mapa.get(kljuc).push(m);
    });

    return [...mapa.keys()].sort().map(k => mapa.get(k).sort((a, b) => a.c - b.c));
}

/**
 * Leapfrog putanja, po redu.
 *
 * U jednom redu se ide preko svakog drugog modula do kraja, pa nazad preko
 * preskočenih — tako oba kraja izlaze na isti kraj reda. Redovi se nastavljaju
 * jedan na drugi. Leapfrog preko cele zmijaste putanje bi pravio ukrštanja
 * koja se u stvarnosti ne postavljaju.
 *
 * Vraća tačke sa oznakom da li pripadaju povratnoj grani (za crtanje).
 */
export function putanjaStringa(moduli) {
    const redovi = poRedovima(moduli);
    const tacke = [];

    redovi.forEach(red => {
        if (red.length === 1) {
            tacke.push({ ...red[0].centar, povratak: false });
            return;
        }
        const napred = red.filter((_, i) => i % 2 === 0);
        const nazad = red.filter((_, i) => i % 2 === 1).reverse();

        napred.forEach(m => tacke.push({ ...m.centar, povratak: false }));
        nazad.forEach(m => tacke.push({ ...m.centar, povratak: true }));
    });

    return tacke;
}

function rastojanje(a, b, nacin) {
    return nacin === 'manhattan'
        ? Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
        : Math.hypot(b.x - a.x, b.y - a.y);
}

function duzinaPutanje(tacke, nacin) {
    let d = 0;
    for (let i = 0; i < tacke.length - 1; i++) d += rastojanje(tacke[i], tacke[i + 1], nacin);
    return d;
}

/**
 * Veze između panela se NE računaju u nabavku — taj kabl je već ugrađen u
 * modul. Broje se samo SKOKOVI: mesta gde razmak pređe ono što fabrički
 * priključci pokrivaju (preskok preko slemena, dimnjaka, prekid niza,
 * nepristupačan deo krova).
 *
 * Jednu vezu pokrivaju dva priključka — + jednog modula i − drugog.
 */
function skokoviStringa(tacke, prikljucak) {
    const pokriveno = 2 * (prikljucak || 0);
    const out = [];

    for (let i = 0; i < tacke.length - 1; i++) {
        const d = rastojanje(tacke[i], tacke[i + 1], 'vazdusna');
        if (d > pokriveno) {
            out.push({ od: tacke[i], do: tacke[i + 1], duzina: d, dodatno: d - pokriveno });
        }
    }

    return out;
}

/**
 * Dužina jednog voda od tačke do tačke: manhattan po krovu + vertikalni
 * spust + procenat rezerve na savijanja i ulazak u orman.
 */
export function duzinaVoda(model, od, ka, opcije = {}) {
    if (!od || !ka) return 0;
    const t = model.trasa || {};
    const osnovna = rastojanje(od, ka, t.putanja || 'manhattan');
    const spust = opcije.bezSpusta ? 0 : (t.visinaSpusta || 0);
    return (osnovna + spust) * (1 + (t.rezerva || 0) / 100);
}

/**
 * Kompletan izveštaj o dužinama.
 *
 * Za svaki string daje:
 *   ozicenje   - međusobno povezivanje modula. Broji se JEDNOM: između dva
 *                susedna modula ide jedan provodnik (+ jednog na − drugog).
 *   vodPlus    - od kraja stringa sa + polom do invertera
 *   vodMinus   - od kraja stringa sa − polom do invertera
 *   vod        - ekvivalentna jednosmerna dužina, (plus + minus) / 2. Ovo ide
 *                u proračun pada napona, jer formula ΔU = 2·L·I/(κ·S) već
 *                sadrži faktor 2 za povratni provodnik.
 *   vodUkupno  - plus + minus, stvarna dužina kabla za nabavku
 *   ukupno     - ožičenje + vodUkupno
 *
 * Kod leapfroga + i − izlaze sa RAZLIČITIH krajeva stringa (susednih, ali ne
 * istih), pa se mere odvojeno umesto da se jedna dužina množi sa dva.
 */
export function duzineStringova(model) {
    const t = model.trasa || {};
    const nacin = t.putanja || 'manhattan';

    return model.stringovi.map(s => {
        const moduli = moduliStringa(model, s.id);
        const putanja = putanjaStringa(moduli);
        const inv = model.inverterZaString(s);

        // Ožičenje ide stvarnim rasporedom modula, pa je tu vazdušna linija
        // realnija od manhattan-a — kabl ide dijagonalno preko okvira modula.
        const ozicenje = duzinaPutanje(putanja, 'vazdusna');
        const prikljucak = t.duzinaPrikljucka || 0;
        const skokovi = skokoviStringa(putanja, prikljucak);
        const ozicenjeDodatno = skokovi.reduce((z, k) => z + k.dodatno, 0);

        // Leapfrog se zatvara blizu početka: prvi modul nosi jedan pol,
        // poslednji drugi. Oba kraja se mere do invertera zasebno.
        const krajMinus = putanja.length ? { x: putanja[0].x, y: putanja[0].y } : null;
        const poslednja = putanja[putanja.length - 1];
        const krajPlus = putanja.length ? { x: poslednja.x, y: poslednja.y } : null;

        const vodMinus = inv && krajMinus ? duzinaVoda(model, krajMinus, inv.pos) : 0;
        const vodPlus = inv && krajPlus ? duzinaVoda(model, krajPlus, inv.pos) : 0;

        const vodUkupno = vodPlus + vodMinus;
        const vod = vodUkupno / 2;   // ekvivalentna jednosmerna dužina za proračun

        return {
            stringId: s.id,
            oznaka: s.oznaka,
            boja: s.boja,
            inverter: s.inverter,
            mppt: s.mppt,
            modula: moduli.length,
            putanja,
            krajPlus,
            krajMinus,
            inverterPos: inv ? inv.pos : null,
            inverterOznaka: inv ? inv.oznaka : null,
            ozicenje,
            skokovi,
            ozicenjeDodatno,
            vodPlus,
            vodMinus,
            vod,
            vodUkupno,
            ukupno: ozicenje + vodUkupno,

            // za nabavku: veze između panela ne ulaze (kabl je u modulu),
            // samo skokovi i vodovi umanjeni za priključak na kraju stringa
            dodatno: ozicenjeDodatno
                + Math.max(0, vodPlus - prikljucak)
                + Math.max(0, vodMinus - prikljucak),
            nacin
        };
    });
}

/** AC trase između postavljene opreme: inverter → AC orman → priključni ormar. */
export function duzineAC(model) {
    const inverteri = model.oprema.filter(o => o.tip === 'inverter')
        .sort((a, b) => (a.inverter || 0) - (b.inverter || 0));
    const acOrman = model.oprema.find(o => o.tip === 'ac_orman');
    const kpk = model.oprema.find(o => o.tip === 'kpk');

    const deonice = [];

    inverteri.forEach(inv => {
        const ka = acOrman || kpk;
        if (ka) {
            deonice.push({
                od: inv.oznaka, do: ka.oznaka,
                uloga: acOrman ? 'inverter-ac_orman' : 'inverter-kpk',
                inverter: inv.inverter || 1,
                duzina: duzinaVoda(model, inv.pos, ka.pos, { bezSpusta: true })
            });
        }
    });

    if (acOrman && kpk) {
        deonice.push({
            od: acOrman.oznaka, do: kpk.oznaka,
            uloga: 'ac_orman-kpk',
            duzina: duzinaVoda(model, acOrman.pos, kpk.pos, { bezSpusta: true })
        });
    }

    return deonice;
}

/**
 * Predlog preseka DC voda stringa.
 *
 * Pad napona se računa na Umpp niza i radnoj struji Impp, a opteretljivost
 * na 1,25 · Isc — kako se PV strujni krug i štiti.
 */
export function predlogZaString(model, duzina) {
    const m = model.modul;
    const p = model.proracun || {};

    return predlogPreseka({
        sistem: 'DC',
        duzina: duzina.vod || 0,
        struja: m.impp || 0,
        strujaZastite: (m.isc || 0) * 1.25,
        napon: (duzina.modula || 0) * (m.vmpp || 0),
        dozvoljenPad: p.padDC ?? 3,
        ciljniPad: p.ciljniPadDC ?? 1,
        tipKabla: 'PV1-F'
    }, p);
}

/** Sve dužine na jednom mestu — ulaz za proračun preseka i za specifikaciju. */
export function izvestajDuzina(model) {
    const stringovi = duzineStringova(model).map(s => ({
        ...s,
        predlog: s.vod ? predlogZaString(model, s) : null
    }));
    const ac = duzineAC(model);

    return {
        stringovi,
        ac,
        ukupnoDC: stringovi.reduce((z, s) => z + s.ukupno, 0),
        dodatnoDC: stringovi.reduce((z, s) => z + s.dodatno, 0),
        brojSkokova: stringovi.reduce((z, s) => z + s.skokovi.length, 0),
        ukupnoAC: ac.reduce((z, d) => z + d.duzina, 0),
        nedostajeInverter: stringovi.some(s => s.modula > 0 && !s.inverterPos)
    };
}
