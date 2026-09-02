/**
 * Zajednički okvir crtaćeg lista: format, okvir, legenda i sastavnica.
 *
 * Koriste ga i jednopolna šema i string plan, pa dokumentacija jednog
 * projekta izgleda kao jedna celina bez obzira koji list gledaš.
 */

import { escapeXml } from './util.js';

// Formati u jedinicama crteža (odnos stranica odgovara ISO A formatima)
export const FORMATI = {
    A4: { landscape: [1050, 742], portrait: [742, 1050] },
    A3: { landscape: [1486, 1050], portrait: [1050, 1486] }
};

const MARGINA = 20;
const SASTAVNICA_W = 460;
const SASTAVNICA_H = 120;
const LEGENDA_RED = 16;
const LEGENDA_SIRINA = 240;

const HALO = 'paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round;';

export const OSNOVNI_STIL = `
    .okvir { stroke: #111; stroke-width: 1.5; fill: none; }
    .sastavnica text { font: 10px 'Segoe UI', sans-serif; fill: #111; }
    .sastavnica .naslov { font: bold 13px 'Segoe UI', sans-serif; }
    .sastavnica .oznaka-polja { font: 8px 'Segoe UI', sans-serif; fill: #666; }
    .legenda text { font: 9px 'Segoe UI', sans-serif; fill: #111; }
    .legenda .naslov { font: bold 10px 'Segoe UI', sans-serif; }
    .oznaka { font: bold 11px 'Segoe UI', sans-serif; fill: #111; ${HALO} }
    .label { font: 9px 'Segoe UI', sans-serif; fill: #555; ${HALO} }
`;

function sastavnica(meta, dodatno, x, y, w, h) {
    const m = meta || {};
    const danas = new Date().toLocaleDateString('sr-RS');
    const red = (i) => y + (h / 4) * i;

    const polje = (px, py, naslov, vrednost) => `
        <text class="oznaka-polja" x="${px}" y="${py}">${escapeXml(naslov)}</text>
        <text x="${px}" y="${py + 13}">${escapeXml(vrednost || '—')}</text>`;

    const levo = x + 10;
    const desno = x + w * 0.62 + 10;

    return `<g class="sastavnica">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" class="okvir"/>
        <line x1="${x}" y1="${red(1)}" x2="${x + w}" y2="${red(1)}" class="okvir" stroke-width="1"/>
        <line x1="${x}" y1="${red(2)}" x2="${x + w}" y2="${red(2)}" class="okvir" stroke-width="1"/>
        <line x1="${x}" y1="${red(3)}" x2="${x + w}" y2="${red(3)}" class="okvir" stroke-width="1"/>
        <line x1="${x + w * 0.62}" y1="${red(1)}" x2="${x + w * 0.62}" y2="${y + h}" class="okvir" stroke-width="1"/>

        <text class="naslov" x="${levo}" y="${y + 22}">${escapeXml(m.naziv || 'Crtež')}</text>

        ${polje(levo, red(1) + 13, 'INVESTITOR', m.investitor)}
        ${polje(levo, red(2) + 13, 'OBJEKAT / LOKACIJA', m.lokacija)}
        ${polje(levo, red(3) + 13, 'PROJEKTANT', m.projektant)}

        ${polje(desno, red(1) + 13, 'BROJ PROJEKTA', m.brojProjekta)}
        ${polje(desno, red(2) + 13, 'DATUM', danas)}
        ${polje(desno, red(3) + 13, (dodatno && dodatno.naslov) || 'NAPOMENA', dodatno && dodatno.vrednost)}
    </g>`;
}

function visinaLegende(stavke) {
    return stavke && stavke.length ? 26 + stavke.length * LEGENDA_RED : 0;
}

function legenda(stavke, naslov, x, y) {
    if (!stavke || !stavke.length) return '';

    return `<g class="legenda">
        <rect x="${x}" y="${y}" width="${LEGENDA_SIRINA}" height="${visinaLegende(stavke)}" class="okvir" stroke-width="1"/>
        <text class="naslov" x="${x + 10}" y="${y + 17}">${escapeXml(naslov || 'LEGENDA')}</text>
        ${stavke.map((s, i) => {
            const ty = y + 34 + i * LEGENDA_RED;
            const uvlaka = s.boja ? 24 : 10;
            const kvadratic = s.boja
                ? `<rect x="${x + 10}" y="${ty - 8}" width="10" height="10" fill="${escapeXml(s.boja)}" stroke="#111" stroke-width="0.6"/>`
                : '';
            return `${kvadratic}<text x="${x + uvlaka}" y="${ty}">${escapeXml(s.tekst)}</text>`;
        }).join('')}
    </g>`;
}

/**
 * Sastavi kompletan list.
 *
 * @param {object} o
 * @param {object} o.meta      - podaci za sastavnicu
 * @param {object} o.sheet     - { format, orijentacija }
 * @param {string} o.stil      - dodatni CSS specifičan za tip crteža
 * @param {string} o.sadrzaj   - SVG crteža u sopstvenim koordinatama
 * @param {object} o.bbox      - { x, y, w, h } gabarit sadržaja
 * @param {Array}  o.legenda   - [{ tekst, boja? }]
 * @param {string} o.naslovLegende
 * @param {object} o.dodatno   - treće polje desne kolone sastavnice
 * @param {number} o.maxSkala  - gornja granica uvećanja (podrazumevano 1.6)
 */
export function listSvg(o) {
    const format = (o.sheet && o.sheet.format) || 'A3';
    const orijentacija = (o.sheet && o.sheet.orijentacija) || 'landscape';
    const [W, H] = (FORMATI[format] || FORMATI.A3)[orijentacija];

    // Donja traka je rezervisana za legendu i sastavnicu — crtež se u nju
    // nikada ne spušta, pa legenda ne može prekriti sadržaj.
    const legendaH = visinaLegende(o.legenda);
    const donjaTrakaY = H - MARGINA - Math.max(SASTAVNICA_H, legendaH);

    const b = o.bbox && o.bbox.w > 0 ? o.bbox : { x: 0, y: 0, w: 800, h: 600 };
    const poljeW = W - MARGINA * 2 - 20;
    const poljeH = donjaTrakaY - MARGINA - 30;
    const k = Math.min(o.maxSkala ?? 1.6, poljeW / b.w, poljeH / b.h);
    const ox = MARGINA + 10 + (poljeW - b.w * k) / 2 - b.x * k;
    const oy = MARGINA + 10 + (poljeH - b.h * k) / 2 - b.y * k;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <style>${OSNOVNI_STIL}${o.stil || ''}</style>
        <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
        <rect x="${MARGINA}" y="${MARGINA}" width="${W - MARGINA * 2}" height="${H - MARGINA * 2}" class="okvir"/>
        <g transform="translate(${ox} ${oy}) scale(${k})">${o.sadrzaj}</g>
        ${legenda(o.legenda, o.naslovLegende, MARGINA + 12, H - MARGINA - legendaH)}
        ${sastavnica(o.meta, o.dodatno, W - MARGINA - SASTAVNICA_W, H - MARGINA - SASTAVNICA_H, SASTAVNICA_W, SASTAVNICA_H)}
    </svg>`;
}

/** Preuzimanje fajla u browseru — deljeno između izvoza šeme i plana. */
export function preuzmi(sadrzaj, imeFajla, mime) {
    const blob = sadrzaj instanceof Blob ? sadrzaj : new Blob([sadrzaj], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = imeFajla;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** SVG -> PNG preko canvas-a. */
export function svgUPng(svg, imeFajla, skala = 2) {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width * skala;
        c.height = img.height * skala;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => preuzmi(b, imeFajla, 'image/png'), 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
}

/** Otvori list u novom prozoru i pokreni štampu (odatle ide "Sačuvaj kao PDF"). */
export function stampajSvg(svg, naslov, sheet) {
    const w = window.open('', '_blank');
    if (!w) return;
    const orijentacija = (sheet && sheet.orijentacija) || 'landscape';
    const format = (sheet && sheet.format) || 'A3';

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${escapeXml(naslov || 'Crtež')}</title>
        <style>
            @page { size: ${format} ${orijentacija}; margin: 0; }
            html, body { margin: 0; padding: 0; }
            svg { width: 100%; height: auto; display: block; }
        </style></head><body>${svg}</body></html>`);
    w.document.close();
    w.addEventListener('load', () => { w.focus(); w.print(); });
}

export function bezbednoIme(naziv) {
    return String(naziv || 'crtez').replace(/[^\w\-. ]+/g, '_');
}
