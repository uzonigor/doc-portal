/**
 * Izvoz jednopolne šeme: crtež se ubacuje u zajednički okvir lista.
 */

import { crtezSvg, crtezBBox } from './render.js';
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
`;

/** Legenda šeme: pozicione oznake grupisane po tipu simbola. */
function legendaStavke(model) {
    const korisceni = [...new Set(model.nodes.map(n => n.type))];
    return korisceni.map(t => ({
        tekst: `${model.nodes.filter(n => n.type === t).map(n => n.oznaka).join(', ')} — ${SYMBOLS[t].naziv}`
    }));
}

/** Kompletan list spreman za štampu / izvoz. */
export function listSvg(model) {
    return okvirLista({
        meta: model.meta,
        sheet: model.sheet,
        stil: STIL,
        sadrzaj: crtezSvg(model, { interaktivan: false }),
        bbox: crtezBBox(model, 20),
        legenda: legendaStavke(model),
        dodatno: {
            naslov: 'SNAGA DC / AC',
            vrednost: `${model.ukupnaSnagaDC().toFixed(2)} kWp / ${model.ukupnaSnagaAC().toFixed(2)} kW`
        }
    });
}

export function izveziSvg(model) {
    preuzmi(listSvg(model), `${bezbednoIme(model.meta.naziv)}.svg`, 'image/svg+xml');
}

export function izveziPng(model, skala = 2) {
    svgUPng(listSvg(model), `${bezbednoIme(model.meta.naziv)}.png`, skala);
}

export function stampaj(model) {
    stampajSvg(listSvg(model), model.meta.naziv, model.sheet);
}
