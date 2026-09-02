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
 *   ozicenje  - dužina ožičenja između modula (jednožilno, PV1-F 1×)
 *   vod       - dužina od kraja stringa do invertera, PO PROVODNIKU
 *   ukupno    - 2 × vod + ožičenje (i + i − vod idu do invertera)
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

        const prikljucak = putanja.length ? { x: putanja[0].x, y: putanja[0].y } : null;
        const vod = inv && prikljucak ? duzinaVoda(model, prikljucak, inv.pos) : 0;

        return {
            stringId: s.id,
            oznaka: s.oznaka,
            boja: s.boja,
            inverter: s.inverter,
            mppt: s.mppt,
            modula: moduli.length,
            putanja,
            prikljucak,
            inverterPos: inv ? inv.pos : null,
            inverterOznaka: inv ? inv.oznaka : null,
            ozicenje,
            vod,
            ukupno: ozicenje + 2 * vod,
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
        dozvoljenPad: p.padDC ?? 1,
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
        ukupnoAC: ac.reduce((z, d) => z + d.duzina, 0),
        nedostajeInverter: stringovi.some(s => s.modula > 0 && !s.inverterPos)
    };
}
