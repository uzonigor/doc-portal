/**
 * Izvoz jednopolne šeme: crtež se ubacuje u zajednički okvir lista.
 */

import { crtezSvg, crtezBBox } from './render.js';
import { crtez3lSvg, crtez3lBBox } from './render-3l.js';
import { SYMBOLS } from './symbols.js';
import { listSvg as okvirLista, preuzmi, svgUPng, stampajSvg, bezbednoIme, FORMATI } from './list.js';

export { FORMATI };

const HALO = 'paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round;';

const STIL = `
    .simbol { color: #111; }
    .edge .linija { stroke: #111; stroke-width: 1.6; fill: none; }
    .edge .pogodak, .pogodak-node { display: none; }
    .edge.sys-DC .linija { stroke: #b45309; }
    .edge.sys-PE .linija { stroke: #2f855a; }
    .zile { stroke: #111; stroke-width: 1.2; }
    /* beli obrub oko teksta da oznake ostanu čitljive kad se preklope sa vodovima */
    .zile-tekst, .kabl-tekst { font: 9px 'Segoe UI', sans-serif; fill: #333; ${HALO} }

    /* tropolna */
    .edge-3l .zila { stroke: #111; stroke-width: 1.2; fill: none; }
    .edge-3l.sys-DC .zila { stroke: #b45309; }
    .edge-3l.sys-PE .zila, .zila-PE { stroke: #2f855a; }
    .node-3l .prolazna { stroke: #2f855a; stroke-width: 1.2; }
    .node-3l .sprega { stroke: #111; stroke-width: 1; stroke-dasharray: 3 3; }
    .node-3l .telo { fill: none; stroke: #111; stroke-width: 1.2; }
`;

/** Naslov tropolnog lista — zamenjuje "jednopolna" umesto da nadoveže. */
function naslovTropolne(naziv) {
    const osnovni = naziv || 'Šema';
    return /jednopoln/i.test(osnovni)
        ? osnovni.replace(/jednopoln\w*/i, 'tropolna')
        : `${osnovni} — tropolna šema`;
}

/** Legenda šeme: pozicione oznake grupisane po tipu simbola. */
function legendaStavke(model) {
    const korisceni = [...new Set(model.nodes.map(n => n.type))];
    return korisceni.map(t => ({
        tekst: `${model.nodes.filter(n => n.type === t).map(n => n.oznaka).join(', ')} — ${SYMBOLS[t].naziv}`
    }));
}

/**
 * Kompletan list spreman za štampu / izvoz.
 * @param {object} opcije - { prikaz: '1L' | '3L' }
 */
export function listSvg(model, opcije = {}) {
    const tropolna = opcije.prikaz === '3L';

    return okvirLista({
        meta: tropolna ? { ...model.meta, naziv: naslovTropolne(model.meta.naziv) } : model.meta,
        sheet: model.sheet,
        stil: STIL,
        sadrzaj: tropolna ? crtez3lSvg(model) : crtezSvg(model, { interaktivan: false }),
        bbox: tropolna ? crtez3lBBox(model, 20) : crtezBBox(model, 20),
        legenda: legendaStavke(model),
        dodatno: {
            naslov: 'SNAGA DC / AC',
            vrednost: `${model.ukupnaSnagaDC().toFixed(2)} kWp / ${model.ukupnaSnagaAC().toFixed(2)} kW`
        }
    });
}

const sufiks = (opcije) => (opcije.prikaz === '3L' ? '-tropolna' : '');

export function izveziSvg(model, opcije = {}) {
    preuzmi(listSvg(model, opcije), `${bezbednoIme(model.meta.naziv)}${sufiks(opcije)}.svg`, 'image/svg+xml');
}

export function izveziPng(model, opcije = {}, skala = 2) {
    svgUPng(listSvg(model, opcije), `${bezbednoIme(model.meta.naziv)}${sufiks(opcije)}.png`, skala);
}

export function stampaj(model, opcije = {}) {
    stampajSvg(listSvg(model, opcije), model.meta.naziv, model.sheet);
}
