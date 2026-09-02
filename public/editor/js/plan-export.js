/**
 * Izvoz string plana u isti okvir lista koji koristi i jednopolna šema.
 */

import { planSvg, planBBox, razmernikSvg, severSvg } from './plan-render.js';
import { izvestajDuzina } from './plan-trase.js';
import { listSvg as okvirLista, preuzmi, svgUPng, stampajSvg, bezbednoIme } from './list.js';

const STIL = `
    .polje .ram { fill: none; stroke: #111; stroke-width: 1.5; }
    .polje .izbor { display: none; }
    .modul rect { stroke: #111; stroke-width: 0.8; }
    .modul .precrtan { stroke: #718096; stroke-width: 1.2; }
    .modul-oznaka { font: bold 11px 'Segoe UI', sans-serif; fill: #fff; text-anchor: middle;
                    paint-order: stroke; stroke: rgba(0,0,0,.35); stroke-width: 2px; }
    .polje-natpis { font: 10px 'Segoe UI', sans-serif; fill: #111; }
    .trasa-ozicenje { fill: none; stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; }
    .trasa-vod { stroke-width: 2; stroke-dasharray: 9 5; fill: none; }
    .trasa-tekst { font: bold 10px 'Segoe UI', sans-serif;
                   paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
    .trasa-pol { font: bold 12px 'Segoe UI', sans-serif;
                 paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
    .razmernik-tekst, .sever-tekst { font: 10px 'Segoe UI', sans-serif; fill: #111; }
`;

function legendaStavke(model) {
    const po = model.modulaPoStringu();
    const duzine = new Map(izvestajDuzina(model).stringovi.map(d => [d.stringId, d]));

    const stavke = model.stringovi.map(s => {
        const d = duzine.get(s.id);
        const vod = d && d.vodPlus
            ? ` · vod + ${d.vodPlus.toFixed(1)} m / − ${d.vodMinus.toFixed(1)} m`
            : '';
        return {
            boja: s.boja,
            tekst: `${s.oznaka} — ${po.get(s.id) || 0} modula · inverter ${s.inverter}, MPPT ${s.mppt}${vod}`
        };
    });

    const nedodeljeni = model.nedodeljenihModula();
    if (nedodeljeni > 0) {
        stavke.push({ boja: '#f7fafc', tekst: `Nedodeljeno — ${nedodeljeni} modula` });
    }

    const m = model.modul;
    stavke.push({
        tekst: `Modul: ${m.proizvodjac ? m.proizvodjac + ' ' : ''}${m.pmax} W, ` +
               `${(m.sirina * 1000).toFixed(0)}×${(m.visina * 1000).toFixed(0)} mm`
    });

    const izv = izvestajDuzina(model);
    if (izv.ukupnoDC > 0) {
        stavke.push({
            tekst: `DC provodnika ${izv.ukupnoDC.toFixed(0)} m · za nabavku ${izv.dodatnoDC.toFixed(0)} m ` +
                   `(bez fabričkih priključaka)`
        });
    }

    return stavke;
}

export function listSvg(model) {
    const b = planBBox(model, 1);

    // Razmernik i strelica severa idu ispod crteža, unutar njegovog gabarita.
    const dodaci = `
        ${razmernikSvg(b.x + 20, b.y + b.h - 30, 5)}
        ${severSvg(b.x + b.w - 40, b.y + b.h - 40)}`;

    return okvirLista({
        meta: model.meta,
        sheet: model.sheet,
        stil: STIL,
        sadrzaj: planSvg(model, { interaktivan: false }) + dodaci,
        bbox: b,
        legenda: legendaStavke(model),
        naslovLegende: 'STRINGOVI',
        dodatno: {
            naslov: 'MODULA / SNAGA DC',
            vrednost: `${model.ukupnoModula()} kom · ${model.snagaDC().toFixed(2)} kWp`
        },
        maxSkala: 3
    });
}

export function izveziSvg(model) {
    preuzmi(listSvg(model), `${bezbednoIme(model.meta.naziv)}-plan.svg`, 'image/svg+xml');
}

export function izveziPng(model, skala = 2) {
    svgUPng(listSvg(model), `${bezbednoIme(model.meta.naziv)}-plan.png`, skala);
}

export function stampaj(model) {
    stampajSvg(listSvg(model), model.meta.naziv, model.sheet);
}
