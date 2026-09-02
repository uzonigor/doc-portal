/**
 * Generisanje jednopolne šeme iz parametara elektrane.
 *
 * Topologija PV elektrane je vrlo šablonska (niz → zaštita → inverter →
 * AC zaštita → merenje → priključak), pa se ogromna većina projekata dobija
 * iz nekoliko brojeva. Editor posle služi samo za dorade.
 */

import { Model } from './model.js';
import { rasporedi } from './layout.js';
import { defaultProps } from './symbols.js';

// Uobičajen maksimalni DC ulazni napon string invertera
const GRANICA_VOC = 1000;

export const PODRAZUMEVANI = {
    naziv: 'PV elektrana',
    investitor: '',
    lokacija: '',
    projektant: '',
    brojProjekta: '',

    brojPanela: 24,
    panel: { pmax: 550, voc: 49.8, isc: 13.9, proizvodjac: '' },

    invertera: 1,
    inverter: { snaga: 10, faza: 3, mppt: 2, proizvodjac: '', model: '' },

    // Kada dolazi iz string plana: niz po inverterima, u njemu
    // [{ mppt, modula, oznaka }] po stringu. Ako je zadat, ima prednost
    // nad brojPanela/invertera — raspored stringova je već odlučen na krovu.
    raspodelaStringova: null,

    dcPrekidac: true,
    dcSpd: 'T2',
    acPrekidac: 25,
    acSpd: 'T2',
    fid: true,
    fidStruja: 40,
    fidDiff: '300',
    fidTip: 'B',

    merenje: 'direktno',
    mreza: '3×230/400 V, 50 Hz',
    sistemUzemljenja: 'TN-C-S',
    uzemljenje: true
};

/** Prihvata i [[12, 12]] i [[{ mppt, modula }]] oblik; vraća normalizovan ili null. */
function normalizujRaspodelu(r) {
    if (!Array.isArray(r) || !r.length) return null;

    const out = r
        .map(inv => (Array.isArray(inv) ? inv : [])
            .map((s, j) => (typeof s === 'number'
                ? { modula: s, mppt: j + 1 }
                : { modula: s.modula, mppt: s.mppt || j + 1, oznaka: s.oznaka }))
            .filter(s => s.modula > 0))
        .filter(inv => inv.length);

    return out.length ? out : null;
}

/** Ravnomerna raspodela N komada u K grupa (ostatak ide na prve grupe). */
export function raspodeli(ukupno, grupa) {
    if (grupa <= 0) return [];
    const osnovni = Math.floor(ukupno / grupa);
    const ostatak = ukupno % grupa;
    return Array.from({ length: grupa }, (_, i) => osnovni + (i < ostatak ? 1 : 0));
}

/** Kolone su fiksne da bi crtež uvek imao isti raspored čitanja s leva na desno. */
const KOL = {
    string: 0,
    dcZastita: 1,
    dcSpd: 1.5,        // odvojena kolona da SPD ne upada u redove stringova
    inverter: 2,
    uzemljenje: 2.4,
    acZastita: 3,
    sabirnica: 4,
    acSpd: 4.4,
    fid: 5,
    brojilo: 6,
    kpk: 7,
    mreza: 8
};

/**
 * @param {object} p - parametri (spajaju se sa PODRAZUMEVANI)
 * @returns {Model}
 */
export function generisi(p = {}) {
    const par = { ...PODRAZUMEVANI, ...p,
        panel: { ...PODRAZUMEVANI.panel, ...(p.panel || {}) },
        inverter: { ...PODRAZUMEVANI.inverter, ...(p.inverter || {}) } };

    const raspodela = normalizujRaspodelu(par.raspodelaStringova);
    const invertera = raspodela ? raspodela.length : Math.max(1, parseInt(par.invertera, 10) || 1);
    const mppt = Math.max(1, parseInt(par.inverter.mppt, 10) || 1);
    const trofazni = String(par.inverter.faza) === '3';

    // Paneli se dele na invertere, pa svaki inverter na svoje MPPT ulaze —
    // osim kada raspored stringova već dolazi iz string plana.
    const poInverteru = raspodela ? [] : raspodeli(Math.max(1, parseInt(par.brojPanela, 10) || 1), invertera);

    const plan = [];   // { kljuc, type, kol, red, props }
    const veze = [];   // [odKljuc, odPort, doKljuc, doPort]

    const dodaj = (kljuc, type, kol, red, props) => {
        plan.push({ kljuc, type, kol, red, props: { ...defaultProps(type), ...props } });
        return kljuc;
    };

    let red = 0;
    const redoviInvertera = [];

    for (let i = 0; i < invertera; i++) {
        const stringovi = raspodela
            ? raspodela[i]
            : raspodeli(poInverteru[i], mppt).filter(n => n > 0).map((n, j) => ({ modula: n, mppt: j + 1 }));
        const prviRed = red;

        const invKljuc = `inv${i}`;
        const invType = trofazni ? 'inverter_3f' : 'inverter_1f';

        stringovi.forEach((str, j) => {
            const sKljuc = dodaj(`str${i}_${j}`, 'pv_string', KOL.string, red, {
                modula: str.modula,
                pmax: par.panel.pmax,
                voc: par.panel.voc,
                isc: par.panel.isc,
                proizvodjac: par.panel.proizvodjac
            });
            if (str.oznaka) plan[plan.length - 1].oznakaStringa = str.oznaka;

            const mpptPort = `dc${Math.min(str.mppt || j + 1, mppt)}+`;

            if (par.dcPrekidac) {
                const qKljuc = dodaj(`dcq${i}_${j}`, 'dc_prekidac', KOL.dcZastita, red, {
                    struja: Math.ceil((par.panel.isc || 0) * 1.25 / 5) * 5 || 16
                });
                veze.push([sKljuc, 'dc+', qKljuc, 'in']);
                veze.push([qKljuc, 'out', invKljuc, mpptPort]);
            } else {
                veze.push([sKljuc, 'dc+', invKljuc, mpptPort]);
            }

            red += 1;
        });

        const poslednjiRed = red - 1;
        const sredina = (prviRed + poslednjiRed) / 2;
        redoviInvertera.push(sredina);

        dodaj(invKljuc, invType, KOL.inverter, sredina, {
            snaga: par.inverter.snaga,
            mppt,
            proizvodjac: par.inverter.proizvodjac,
            model: par.inverter.model
        });

        if (par.dcSpd) {
            // SPD stoji uz DC vod svog invertera, u sopstvenoj koloni
            const spd = dodaj(`dcspd${i}`, 'dc_spd', KOL.dcSpd, sredina, { tip: par.dcSpd });
            const izvor = par.dcPrekidac ? `dcq${i}_0` : `str${i}_0`;
            veze.push([izvor, par.dcPrekidac ? 'out' : 'dc+', spd, 'in']);
        }

        // AC prekidač po inverteru
        const acq = dodaj(`acq${i}`, 'ac_prekidac', KOL.acZastita, sredina, {
            struja: par.acPrekidac,
            polova: trofazni ? '3P+N' : '1P+N'
        });
        veze.push([invKljuc, trofazni ? 'L1' : 'L', acq, 'in']);
    }

    const sredinaSveg = redoviInvertera.reduce((a, b) => a + b, 0) / redoviInvertera.length;
    // Grane koje "vise" ispod glavnog voda (uzemljenje, AC SPD) idu malo niže
    // od njega, ali u sopstvenim kolonama — tako ne mogu udariti ni u šta.
    const ispodVoda = sredinaSveg + 0.55;

    // Uzemljenje se vezuje na PE prvog invertera.
    if (par.uzemljenje) {
        const pe = dodaj('pe', 'uzemljenje', KOL.uzemljenje, ispodVoda, {});
        veze.push(['inv0', 'PE', pe, 'in']);
    }

    // Više invertera se sabira na zajedničku sabirnicu.
    let zajednickiIzlaz, zajednickiPort;

    if (invertera > 1) {
        const sab = dodaj('sabirnica', 'sabirnica', KOL.sabirnica, sredinaSveg, {
            oznakaZila: trofazni ? 'L1,L2,L3,N,PE' : 'L,N,PE'
        });
        for (let i = 0; i < invertera; i++) {
            veze.push([`acq${i}`, 'out', 'sabirnica', `p${Math.min(i + 1, 4)}`]);
        }
        zajednickiIzlaz = 'sabirnica';
        zajednickiPort = 'd1';
    } else {
        zajednickiIzlaz = 'acq0';
        zajednickiPort = 'out';
    }

    if (par.acSpd) {
        const spd = dodaj('acspd', 'ac_spd', KOL.acSpd, ispodVoda, {
            tip: par.acSpd,
            polova: trofazni ? '3+1' : '1+1'
        });
        veze.push([zajednickiIzlaz, zajednickiPort, spd, 'in']);
    }

    if (par.fid) {
        const fid = dodaj('fid', 'fid', KOL.fid, sredinaSveg, {
            struja: par.fidStruja,
            diferencijalna: String(par.fidDiff),
            tip: par.fidTip,
            polova: trofazni ? '4P' : '2P'
        });
        veze.push([zajednickiIzlaz, zajednickiPort, fid, 'in']);
        zajednickiIzlaz = 'fid';
        zajednickiPort = 'out';
    }

    const br = dodaj('brojilo', 'brojilo', KOL.brojilo, sredinaSveg, {
        tip: par.merenje,
        faza: trofazni ? '3' : '1'
    });
    veze.push([zajednickiIzlaz, zajednickiPort, br, 'in']);

    const kpk = dodaj('kpk', 'kpk', KOL.kpk, sredinaSveg, {});
    veze.push([br, 'out', kpk, 'in']);

    const mreza = dodaj('mreza', 'mreza', KOL.mreza, sredinaSveg, {
        napon: par.mreza,
        sistem: par.sistemUzemljenja
    });
    veze.push([kpk, 'out', mreza, 'in']);

    // ── raspored i sklapanje modela ──────────────────────────────────────────

    rasporedi(plan);

    const model = new Model({
        meta: {
            naziv: par.naziv,
            investitor: par.investitor,
            lokacija: par.lokacija,
            projektant: par.projektant,
            brojProjekta: par.brojProjekta,
            standard: 'IEC-60617'
        }
    });

    const idPo = new Map();
    plan.forEach(s => {
        const n = model.addNode(s.type, s.pos);
        Object.assign(n.props, s.props);
        // string sa krova zadržava svoju oznaku (S1, S2 ...) i na šemi
        if (s.oznakaStringa) n.label = `${n.label} ${s.oznakaStringa}`;
        idPo.set(s.kljuc, n.id);
    });

    veze.forEach(([od, odPort, doK, doPort]) => {
        const a = idPo.get(od), b = idPo.get(doK);
        if (a && b) model.addEdge(`${a}:${odPort}`, `${b}:${doPort}`);
    });

    model.undoStack = [];
    model.redoStack = [];
    return model;
}

/** Kratak pregled onoga što će biti generisano — za prikaz u formi. */
export function rekapitulacija(p = {}) {
    const par = { ...PODRAZUMEVANI, ...p, panel: { ...PODRAZUMEVANI.panel, ...(p.panel || {}) },
        inverter: { ...PODRAZUMEVANI.inverter, ...(p.inverter || {}) } };

    const raspodela = normalizujRaspodelu(par.raspodelaStringova);
    const invertera = raspodela ? raspodela.length : Math.max(1, parseInt(par.invertera, 10) || 1);
    const mppt = Math.max(1, parseInt(par.inverter.mppt, 10) || 1);

    const stringovi = raspodela
        ? raspodela.flatMap(inv => inv.map(s => s.modula))
        : raspodeli(Math.max(1, parseInt(par.brojPanela, 10) || 1), invertera)
            .flatMap(n => raspodeli(n, mppt).filter(x => x > 0));

    const panela = stringovi.reduce((a, b) => a + b, 0);

    const snagaDC = panela * (par.panel.pmax || 0) / 1000;
    const snagaAC = invertera * (par.inverter.snaga || 0);
    const najduziString = Math.max(...stringovi);

    // Voc raste na niskim temperaturama; -10 °C, tipičan koef. -0,29 %/K
    const vocHladno = najduziString * (par.panel.voc || 0) * 1.101;
    const odnos = snagaAC ? snagaDC / snagaAC : 0;

    const upozorenja = [];
    if (vocHladno > GRANICA_VOC) {
        upozorenja.push(`Voc najdužeg niza na −10 °C je ${vocHladno.toFixed(0)} V — prelazi uobičajenih ` +
            `${GRANICA_VOC} V ulaznog napona invertera. Skrati string ili proveri dozvoljeni Udc,max.`);
    }
    if (odnos && odnos > 1.35) {
        upozorenja.push(`Odnos DC/AC je ${odnos.toFixed(2)} — inverter je izrazito predimenzionisan sa DC strane.`);
    }
    if (odnos && odnos < 0.9) {
        upozorenja.push(`Odnos DC/AC je ${odnos.toFixed(2)} — inverter je slabo iskorišćen.`);
    }
    if (stringovi.length && Math.min(...stringovi) < najduziString / 2) {
        upozorenja.push('Stringovi su izrazito nejednaki; razmotri drugačiju raspodelu po MPPT ulazima.');
    }

    return {
        vrednosti: {
            'Snaga DC': `${snagaDC.toFixed(2)} kWp`,
            'Snaga AC': `${snagaAC.toFixed(2)} kW`,
            'Odnos DC/AC': odnos ? odnos.toFixed(2) : '—',
            'Stringova': `${stringovi.length} (${stringovi.join(' + ')})`,
            'Voc najdužeg niza (−10 °C)': `${vocHladno.toFixed(0)} V`,
            'Isc × 1,25': `${((par.panel.isc || 0) * 1.25).toFixed(1)} A`
        },
        upozorenja
    };
}
