/**
 * Tabela kablova i specifikacija opreme — izvedene iz istog grafa.
 * Ništa se ne unosi dvaput: sve što stoji u tabelama već postoji u modelu.
 */

import { getSymbol } from './symbols.js';

const KOLONE_KABLOVA = [
    { kljuc: 'oznaka', naslov: 'Oznaka' },
    { kljuc: 'od', naslov: 'Od' },
    { kljuc: 'do', naslov: 'Do' },
    { kljuc: 'sistem', naslov: 'Sistem' },
    { kljuc: 'kabl', naslov: 'Tip i presek' },
    { kljuc: 'duzina', naslov: 'Dužina (m)' }
];

const KOLONE_OPREME = [
    { kljuc: 'redni', naslov: '#' },
    { kljuc: 'oznake', naslov: 'Oznake' },
    { kljuc: 'naziv', naslov: 'Naziv' },
    { kljuc: 'opis', naslov: 'Tehnički podaci' },
    { kljuc: 'kolicina', naslov: 'Kol.' },
    { kljuc: 'jm', naslov: 'JM' }
];

export { KOLONE_KABLOVA, KOLONE_OPREME };

const NAZIV_SISTEMA = { DC: 'DC', AC1: 'AC 1-f', AC3: 'AC 3-f', PE: 'PE' };

function opisCvora(model, ref) {
    const [id, port] = ref.split(':');
    const n = model.getNode(id);
    if (!n) return '—';
    const p = getSymbol(n.type).ports[port];
    const oznakaPorta = (p && p.label) || port;
    return `${n.oznaka || ''} (${oznakaPorta})`.trim();
}

export function tabelaKablova(model) {
    return model.edges.map(e => ({
        oznaka: e.oznaka || '',
        od: opisCvora(model, e.from),
        do: opisCvora(model, e.to),
        sistem: NAZIV_SISTEMA[e.system] || e.system,
        kabl: e.cable && e.cable.presek
            ? `${e.cable.tip || ''} ${e.conductors.length}×${e.cable.presek} mm²`.trim()
            : '—',
        duzina: e.cable && e.cable.duzina ? String(e.cable.duzina) : ''
    }));
}

/** Ukupna dužina po tipu i preseku kabla — za nabavku. */
export function zbirKablova(model) {
    const mapa = new Map();
    model.edges.forEach(e => {
        if (!e.cable || !e.cable.presek) return;
        const kljuc = `${e.cable.tip || '—'} ${e.conductors.length}×${e.cable.presek} mm²`;
        mapa.set(kljuc, (mapa.get(kljuc) || 0) + (parseFloat(e.cable.duzina) || 0));
    });
    return [...mapa.entries()].map(([kabl, duzina]) => ({ kabl, duzina }));
}

/** Tehnički opis elementa iz njegovih parametara. */
function opisOpreme(node) {
    const def = getSymbol(node.type);
    const delovi = [];

    for (const [kljuc, spec] of Object.entries(def.props || {})) {
        const v = node.props[kljuc];
        if (v === '' || v === null || v === undefined) continue;
        const naziv = spec.label.replace(/\s*\(.*?\)\s*$/, '');
        const jedinica = (spec.label.match(/\((.*?)\)\s*$/) || [])[1] || '';
        delovi.push(`${naziv}: ${v}${jedinica ? ' ' + jedinica : ''}`);
    }

    return delovi.join(', ');
}

export function specifikacijaOpreme(model) {
    const grupe = new Map();

    model.nodes.forEach(n => {
        const opis = opisOpreme(n);
        const kljuc = `${n.type}|${opis}`;
        if (!grupe.has(kljuc)) {
            grupe.set(kljuc, {
                naziv: getSymbol(n.type).naziv,
                opis,
                kolicina: 0,
                oznake: [],
                jm: n.type === 'pv_string' ? 'kompl.' : 'kom'
            });
        }
        const g = grupe.get(kljuc);
        g.kolicina += 1;
        g.oznake.push(n.oznaka || '');
    });

    // Grupe se sortiraju po kategoriji simbola pa po nazivu, da iste stavke
    // stoje jedna uz drugu i kad su nastale iz različitih delova crteža.
    const redosledKategorija = ['dc', 'konverzija', 'ac', 'merenje', 'ostalo'];
    const kategorijaPo = new Map(model.nodes.map(n => [getSymbol(n.type).naziv, getSymbol(n.type).kategorija]));

    return [...grupe.values()]
        .sort((a, b) => {
            const ka = redosledKategorija.indexOf(kategorijaPo.get(a.naziv));
            const kb = redosledKategorija.indexOf(kategorijaPo.get(b.naziv));
            return ka - kb || a.naziv.localeCompare(b.naziv, 'sr') || a.opis.localeCompare(b.opis, 'sr');
        })
        .map((g, i) => ({
        redni: String(i + 1),
        naziv: g.naziv,
        opis: g.opis,
        kolicina: String(g.kolicina),
        oznake: g.oznake.join(', '),
        jm: g.jm
    }));
}

/** Broj PV modula ukupno — najčešće traženi podatak u specifikaciji. */
export function ukupnoModula(model) {
    return model.nodes.reduce((z, n) =>
        n.type === 'pv_string' ? z + (parseInt(n.props.modula, 10) || 0)
            : (n.type === 'pv_modul' ? z + 1 : z), 0);
}

export function csv(redovi, kolone) {
    const escape = (v) => {
        const s = String(v ?? '');
        return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const zaglavlje = kolone.map(k => escape(k.naslov)).join(';');
    const telo = redovi.map(r => kolone.map(k => escape(r[k.kljuc])).join(';'));
    // BOM da bi Excel na srpskom ispravno pročitao ćirilične/latinične znakove
    return '﻿' + [zaglavlje, ...telo].join('\r\n');
}
