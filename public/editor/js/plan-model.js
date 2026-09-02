/**
 * Model string plana — raspored modula na krovu.
 *
 * Geometrija se čuva u METRIMA; render množi sa PPM da bi dobio koordinate
 * crteža. Tako se dimenzije modula, razmaci i kalibracija podloge unose u
 * stvarnim jedinicama, a razmera lista ostaje stvar prikaza.
 *
 * String plan je izvor podataka za jednopolnu šemu: broj modula po stringu
 * se čita iz crteža, umesto da se ukucava dvaput.
 */

import { Dokument, noviId } from './dokument.js';

/** Piksela crteža po metru. */
export const PPM = 100;

/** Podrazumevani modul ~550 W (2278 × 1134 mm). */
export const PODRAZUMEVANI_MODUL = {
    sirina: 1.134,
    visina: 2.278,
    pmax: 550,
    voc: 49.8,
    isc: 13.9,
    // Radna tačka pri STC — po njoj se računa pad napona; Voc/Isc služe
    // za granične provere (napon na hladnoći, struja kroz zaštitu).
    vmpp: 41.9,
    impp: 13.13,
    proizvodjac: '',
    model: ''
};

/** Oprema koja se postavlja na plan da bi trase kablova imale odakle do kuda. */
export const TIPOVI_OPREME = {
    inverter:  { naziv: 'Inverter',        oznaka: 'T', boja: '#2d3748' },
    dc_orman:  { naziv: 'DC orman',        oznaka: 'A', boja: '#b45309' },
    ac_orman:  { naziv: 'AC orman (PV-RO)', oznaka: 'A', boja: '#2b6cb0' },
    kpk:       { naziv: 'Priključni ormar', oznaka: 'A', boja: '#2f855a' }
};

/** Boje stringova — birane da se razlikuju i u štampi u sivim tonovima. */
export const BOJE_STRINGOVA = [
    '#2b6cb0', '#c05621', '#2f855a', '#805ad5', '#b7791f',
    '#c53030', '#00838f', '#6b7280', '#9d174d', '#4c51bf'
];

export class PlanModel extends Dokument {
    constructor(data = {}) {
        super(data, { naziv: 'String plan' });

        this.podloga = Object.assign({
            slika: null,        // data: URL
            x: 0, y: 0,         // gornji levi ugao, u metrima
            sirina: 20,         // u metrima (postavlja se kalibracijom)
            visina: 15,
            prozirnost: 0.7,
            zakljucana: true
        }, data.podloga);

        this.modul = Object.assign({}, PODRAZUMEVANI_MODUL, data.modul);
        this.polja = (data.polja || []).map(p => ({ ...p, moduli: { ...p.moduli } }));
        this.stringovi = (data.stringovi || []).map(s => ({ ...s }));
        this.oprema = (data.oprema || []).map(o => ({ ...o }));

        // Parametri proračuna preseka; menjaju se u panelu i prenose u šemu.
        this.proracun = Object.assign({
            kapa: 56,
            padDC: 3,        // granični pad — diže presek
            padAC: 3,
            ciljniPadDC: 1,  // ciljni pad — samo napomena
            ciljniPadAC: 1,
            cosFi: 1,
            faktorTemp: 1,
            faktorGrupisanja: 1,
            minPresekDC: 6,
            minPresekAC: 2.5
        }, data.proracun);

        this.trasa = Object.assign({
            // Kabl ne ide vazdušnom linijom: prati ivice krova i spušta se
            // do invertera, pa se dužina računa manhattan rastojanjem.
            putanja: 'manhattan',
            visinaSpusta: 3,     // m — vertikalni spust od krova do invertera
            rezerva: 10          // % — savijanja, ulazak u orman, rezerva
        }, data.trasa);
    }

    stanje() {
        return {
            meta: this.meta, sheet: this.sheet, podloga: this.podloga,
            modul: this.modul, polja: this.polja, stringovi: this.stringovi,
            oprema: this.oprema, trasa: this.trasa, proracun: this.proracun
        };
    }

    primeniStanje(d) {
        this.meta = d.meta;
        this.sheet = d.sheet;
        this.podloga = d.podloga;
        this.modul = d.modul;
        this.polja = d.polja;
        this.stringovi = d.stringovi;
        this.oprema = d.oprema || [];
        this.trasa = d.trasa || this.trasa;
        this.proracun = d.proracun || this.proracun;
    }

    // ── polja (krovne ravni sa mrežom modula) ────────────────────────────────

    getPolje(id) { return this.polja.find(p => p.id === id) || null; }

    addPolje(pos, opcije = {}) {
        return this.commit('dodaj polje', () => {
            const polje = {
                id: noviId('p'),
                naziv: `Krovna ravan ${this.polja.length + 1}`,
                pos: { x: pos.x, y: pos.y },
                rot: 0,                       // ugao krovne ravni, stepeni
                orijentacija: 'portret',      // portret = duža stranica uspravno
                redova: opcije.redova ?? 3,
                kolona: opcije.kolona ?? 6,
                razmakX: 0.02,
                razmakY: 0.02,
                nagib: 30,                    // stepeni
                azimut: 180,                  // 180 = jug
                moduli: {}                    // "r,c" -> { string, iskljucen }
            };
            this.polja.push(polje);
            return polje;
        });
    }

    removePolja(ids) {
        const set = new Set(ids);
        return this.commit('obriši polje', () => {
            this.polja = this.polja.filter(p => !set.has(p.id));
        });
    }

    /** Pomeranje tokom prevlačenja — bez upisa u undo (commit ide na kraju). */
    movePoljaLive(ids, dx, dy) {
        const set = new Set(ids);
        this.polja.forEach(p => {
            if (set.has(p.id)) { p.pos.x += dx; p.pos.y += dy; }
        });
        this.emit('pomeri-live');
    }

    setPoljeProp(id, kljuc, vrednost) {
        return this.commit('izmeni polje', () => {
            const p = this.getPolje(id);
            if (!p) return;
            p[kljuc] = vrednost;
            // moduli izvan nove mreže se odbacuju da model ne nosi mrtve podatke
            if (kljuc === 'redova' || kljuc === 'kolona') this.ocistiModule(p);
        });
    }

    ocistiModule(polje) {
        Object.keys(polje.moduli).forEach(k => {
            const [r, c] = k.split(',').map(Number);
            if (r >= polje.redova || c >= polje.kolona) delete polje.moduli[k];
        });
    }

    // ── stringovi ────────────────────────────────────────────────────────────

    getString(id) { return this.stringovi.find(s => s.id === id) || null; }

    addString(opcije = {}) {
        return this.commit('dodaj string', () => {
            const broj = this.stringovi.length + 1;
            const s = {
                id: noviId('s'),
                oznaka: opcije.oznaka || `S${broj}`,
                boja: opcije.boja || BOJE_STRINGOVA[(broj - 1) % BOJE_STRINGOVA.length],
                inverter: opcije.inverter ?? 1,
                mppt: opcije.mppt ?? 1
            };
            this.stringovi.push(s);
            return s;
        });
    }

    removeString(id) {
        return this.commit('obriši string', () => {
            this.stringovi = this.stringovi.filter(s => s.id !== id);
            // moduli oslobođeni brisanjem stringa ostaju nedodeljeni
            this.polja.forEach(p => {
                Object.entries(p.moduli).forEach(([k, m]) => {
                    if (m.string === id) m.string = null;
                });
            });
        });
    }

    setStringProp(id, kljuc, vrednost) {
        return this.commit('izmeni string', () => {
            const s = this.getString(id);
            if (s) s[kljuc] = vrednost;
        });
    }

    // ── oprema na planu ──────────────────────────────────────────────────────

    getOprema(id) { return this.oprema.find(o => o.id === id) || null; }

    /** Sledeća slobodna oznaka po prefiksu (-A1, -A2 ...) preko cele opreme. */
    sledecaOznakaOpreme(prefiks) {
        const uzete = this.oprema
            .map(o => o.oznaka)
            .filter(o => o && o.startsWith('-' + prefiks))
            .map(o => parseInt(o.slice(1 + prefiks.length), 10))
            .filter(n => !Number.isNaN(n));
        return `-${prefiks}${uzete.length ? Math.max(...uzete) + 1 : 1}`;
    }

    addOprema(tip, pos, opcije = {}) {
        return this.commit('dodaj opremu', () => {
            const def = TIPOVI_OPREME[tip];
            const isti = this.oprema.filter(o => o.tip === tip).length + 1;
            const o = {
                id: noviId('o'),
                tip,
                oznaka: opcije.oznaka || this.sledecaOznakaOpreme(def.oznaka),
                naziv: opcije.naziv || def.naziv,
                pos: { x: pos.x, y: pos.y },
                inverter: opcije.inverter ?? isti   // kom inverteru pripada (za AC trase)
            };
            this.oprema.push(o);
            return o;
        });
    }

    removeOprema(ids) {
        const set = new Set(ids);
        return this.commit('obriši opremu', () => {
            this.oprema = this.oprema.filter(o => !set.has(o.id));
        });
    }

    moveOpremaLive(ids, dx, dy) {
        const set = new Set(ids);
        this.oprema.forEach(o => {
            if (set.has(o.id)) { o.pos.x += dx; o.pos.y += dy; }
        });
        this.emit('pomeri-live');
    }

    setOpremaProp(id, kljuc, vrednost) {
        return this.commit('izmeni opremu', () => {
            const o = this.getOprema(id);
            if (o) o[kljuc] = vrednost;
        });
    }

    /** Inverter kome string pripada — po broju invertera zadatom na stringu. */
    inverterZaString(s) {
        const inverteri = this.oprema.filter(o => o.tip === 'inverter')
            .sort((a, b) => (a.inverter || 0) - (b.inverter || 0));
        if (!inverteri.length) return null;
        return inverteri.find(o => (o.inverter || 1) === (s.inverter || 1)) || inverteri[0];
    }

    // ── moduli ───────────────────────────────────────────────────────────────

    stanjeModula(polje, r, c) {
        return polje.moduli[`${r},${c}`] || { string: null, iskljucen: false };
    }

    /** Dodela/uklanjanje bez commit-a — koristi se tokom "bojenja" prevlačenjem. */
    postaviModulLive(poljeId, r, c, izmena) {
        const p = this.getPolje(poljeId);
        if (!p || r < 0 || c < 0 || r >= p.redova || c >= p.kolona) return false;

        const kljuc = `${r},${c}`;
        const trenutno = { ...this.stanjeModula(p, r, c), ...izmena };

        if (!trenutno.string && !trenutno.iskljucen) delete p.moduli[kljuc];
        else p.moduli[kljuc] = trenutno;

        return true;
    }

    // ── izvedeni podaci ──────────────────────────────────────────────────────

    /** Broj aktivnih (neisključenih) modula u polju. */
    brojModulaUPolju(polje) {
        let n = 0;
        for (let r = 0; r < polje.redova; r++) {
            for (let c = 0; c < polje.kolona; c++) {
                if (!this.stanjeModula(polje, r, c).iskljucen) n += 1;
            }
        }
        return n;
    }

    ukupnoModula() {
        return this.polja.reduce((z, p) => z + this.brojModulaUPolju(p), 0);
    }

    /** Broj modula dodeljenih svakom stringu. */
    modulaPoStringu() {
        const brojac = new Map(this.stringovi.map(s => [s.id, 0]));
        this.polja.forEach(p => {
            Object.values(p.moduli).forEach(m => {
                if (m.string && !m.iskljucen && brojac.has(m.string)) {
                    brojac.set(m.string, brojac.get(m.string) + 1);
                }
            });
        });
        return brojac;
    }

    nedodeljenihModula() {
        let dodeljeni = 0;
        this.polja.forEach(p => {
            Object.values(p.moduli).forEach(m => {
                if (m.string && !m.iskljucen) dodeljeni += 1;
            });
        });
        return this.ukupnoModula() - dodeljeni;
    }

    snagaDC() {
        return this.ukupnoModula() * (this.modul.pmax || 0) / 1000;
    }

    /**
     * Raspodela modula po inverterima i MPPT ulazima — ulaz za generator
     * jednopolne šeme. Vraća niz po inverterima, u njemu broj modula po stringu.
     */
    raspodelaStringova() {
        const po = this.modulaPoStringu();
        const inverteri = new Map();

        this.stringovi.forEach(s => {
            const n = po.get(s.id) || 0;
            if (!n) return;
            const kljuc = s.inverter || 1;
            if (!inverteri.has(kljuc)) inverteri.set(kljuc, []);
            inverteri.get(kljuc).push({ mppt: s.mppt || 1, modula: n, oznaka: s.oznaka });
        });

        return [...inverteri.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, stringovi]) => stringovi.sort((a, b) => a.mppt - b.mppt));
    }

    /** Upozorenja koja se prikazuju projektantu. */
    validate() {
        const poruke = [];
        const po = this.modulaPoStringu();

        if (!this.polja.length) {
            poruke.push({ nivo: 'upozorenje', tekst: 'Nema nijedne krovne ravni.' });
        }

        const nedodeljeni = this.nedodeljenihModula();
        if (nedodeljeni > 0) {
            poruke.push({ nivo: 'upozorenje', tekst: `${nedodeljeni} modula nije dodeljeno nijednom stringu.` });
        }

        this.stringovi.forEach(s => {
            const n = po.get(s.id) || 0;
            if (!n) {
                poruke.push({ nivo: 'upozorenje', tekst: `String ${s.oznaka} nema nijedan modul.` });
                return;
            }
            // Voc raste na niskim temperaturama; -10 °C, tipičan koef. -0,29 %/K
            const voc = n * (this.modul.voc || 0) * 1.101;
            if (voc > 1000) {
                poruke.push({
                    nivo: 'greska',
                    tekst: `String ${s.oznaka}: Voc na −10 °C je ${voc.toFixed(0)} V — preko 1000 V.`
                });
            }
        });

        // Stringovi na istom MPPT ulazu treba da budu jednake dužine.
        const poMppt = new Map();
        this.stringovi.forEach(s => {
            const kljuc = `${s.inverter || 1}/${s.mppt || 1}`;
            if (!poMppt.has(kljuc)) poMppt.set(kljuc, []);
            poMppt.get(kljuc).push(po.get(s.id) || 0);
        });
        poMppt.forEach((duzine, kljuc) => {
            const aktivne = duzine.filter(d => d > 0);
            if (aktivne.length > 1 && new Set(aktivne).size > 1) {
                poruke.push({
                    nivo: 'upozorenje',
                    tekst: `Inverter ${kljuc}: stringovi na istom MPPT ulazu nisu jednake dužine (${aktivne.join(', ')}).`
                });
            }
        });

        return poruke;
    }

    toJSON() {
        return {
            version: this.version,
            tip: 'PLAN',
            meta: this.meta,
            sheet: this.sheet,
            podloga: this.podloga,
            modul: this.modul,
            polja: this.polja,
            stringovi: this.stringovi,
            oprema: this.oprema,
            trasa: this.trasa,
            proracun: this.proracun
        };
    }
}

// ── geometrija ───────────────────────────────────────────────────────────────

/** Dimenzije jednog modula u polju (u metrima), po orijentaciji. */
export function dimenzijeModula(model, polje) {
    const { sirina, visina } = model.modul;
    return polje.orijentacija === 'pejzaz' ? [visina, sirina] : [sirina, visina];
}

/** Korak mreže (modul + razmak) u metrima. */
export function korakMreze(model, polje) {
    const [w, h] = dimenzijeModula(model, polje);
    return [w + (polje.razmakX || 0), h + (polje.razmakY || 0)];
}

/** Ukupne mere polja u metrima. */
export function merePolja(model, polje) {
    const [kx, ky] = korakMreze(model, polje);
    const [w, h] = dimenzijeModula(model, polje);
    return [
        polje.kolona * kx - (polje.razmakX || 0),
        polje.redova * ky - (polje.razmakY || 0)
    ].map((v, i) => Math.max(v, i === 0 ? w : h));
}

/** Lokalna pozicija modula (r, c) unutar polja, u metrima. */
export function pozicijaModula(model, polje, r, c) {
    const [kx, ky] = korakMreze(model, polje);
    return { x: c * kx, y: r * ky };
}
