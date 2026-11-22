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
const ZONA = 14;          // traka sa podelom na zone (A-… / 1-…)
const SASTAVNICA_W = 460;
const SASTAVNICA_H = 120;
const LEGENDA_RED = 16;
const LEGENDA_SIRINA = 240;

const HALO = 'paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round;';

/** Ciljana veličina jedne zone; broj zona se iz nje izvodi po formatu. */
const ZONA_CILJ = 170;
const brojZona = (duzina) => Math.max(3, Math.round(duzina / ZONA_CILJ));

/** Dimenzije lista u jedinicama crteža. */
export function dimenzijeLista(sheet) {
    const f = (sheet && sheet.format) || 'A3';
    const o = (sheet && sheet.orijentacija) || 'landscape';
    return (FORMATI[f] || FORMATI.A3)[o];
}

/** Unutrašnji okvir — sve unutar trake sa zonama. */
export function unutrasnjiOkvir(sheet) {
    const [W, H] = dimenzijeLista(sheet);
    const i = MARGINA + ZONA;
    return { x: i, y: i, w: W - 2 * i, h: H - 2 * i };
}

/**
 * Polje u koje sme da uđe crtež: unutrašnji okvir bez donje trake koju
 * zauzimaju legenda i sastavnica. Canvas i izvoz računaju isto, pa je ono
 * što se vidi na ekranu tačno ono što izlazi na list.
 */
export function crtacePolje(sheet, stavkeLegende) {
    const u = unutrasnjiOkvir(sheet);
    const donja = Math.max(SASTAVNICA_H, visinaLegende(stavkeLegende)) + 12;
    return { x: u.x, y: u.y, w: u.w, h: u.h - donja };
}

/** Okvir lista sa podelom na zone — isti i na ekranu i na izvozu. */
export function okvirSvg(sheet) {
    const [W, H] = dimenzijeLista(sheet);
    const u = unutrasnjiOkvir(sheet);
    const nx = brojZona(u.w), ny = brojZona(u.h);
    const d = [
        `<rect x="${MARGINA}" y="${MARGINA}" width="${W - 2 * MARGINA}" height="${H - 2 * MARGINA}" class="okvir"/>`,
        `<rect x="${u.x}" y="${u.y}" width="${u.w}" height="${u.h}" class="okvir" stroke-width="1"/>`
    ];

    for (let i = 0; i < nx; i++) {
        const x1 = u.x + u.w * i / nx;
        if (i) d.push(
            `<line x1="${x1}" y1="${MARGINA}" x2="${x1}" y2="${u.y}" class="okvir" stroke-width="0.8"/>`,
            `<line x1="${x1}" y1="${u.y + u.h}" x2="${x1}" y2="${H - MARGINA}" class="okvir" stroke-width="0.8"/>`);
        const cx = x1 + u.w / nx / 2;
        d.push(`<text class="zona" x="${cx}" y="${MARGINA + ZONA - 4}">${i + 1}</text>`,
               `<text class="zona" x="${cx}" y="${H - MARGINA - 4}">${i + 1}</text>`);
    }
    for (let i = 0; i < ny; i++) {
        const y1 = u.y + u.h * i / ny;
        if (i) d.push(
            `<line x1="${MARGINA}" y1="${y1}" x2="${u.x}" y2="${y1}" class="okvir" stroke-width="0.8"/>`,
            `<line x1="${u.x + u.w}" y1="${y1}" x2="${W - MARGINA}" y2="${y1}" class="okvir" stroke-width="0.8"/>`);
        const cy = y1 + u.h / ny / 2 + 3;
        const slovo = String.fromCharCode(65 + i);
        d.push(`<text class="zona" x="${MARGINA + ZONA / 2}" y="${cy}">${slovo}</text>`,
               `<text class="zona" x="${W - MARGINA - ZONA / 2}" y="${cy}">${slovo}</text>`);
    }
    return `<g class="ram">${d.join('')}</g>`;
}

export const OSNOVNI_STIL = `
    .okvir { stroke: #111; stroke-width: 1.5; fill: none; }
    .ram .zona { font: 8px 'Segoe UI', sans-serif; fill: #555; text-anchor: middle; }
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

export function visinaLegende(stavke) {
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
    const sheet = o.sheet || { format: 'A3', orijentacija: 'landscape' };
    const [W, H] = dimenzijeLista(sheet);
    const u = unutrasnjiOkvir(sheet);
    const legendaH = visinaLegende(o.legenda);

    // uklopi === false: crtež ide u sopstvenim koordinatama lista (ekran = izvoz).
    // Inače se gabarit sam uklopi i centrira u crtaće polje.
    let transform = '';
    if (o.uklopi !== false) {
        const polje = crtacePolje(sheet, o.legenda);
        const b = o.bbox && o.bbox.w > 0 ? o.bbox : { x: 0, y: 0, w: 800, h: 600 };
        const k = Math.min(o.maxSkala ?? 1.6, polje.w / b.w, polje.h / b.h);
        const ox = polje.x + (polje.w - b.w * k) / 2 - b.x * k;
        const oy = polje.y + (polje.h - b.h * k) / 2 - b.y * k;
        transform = ` transform="translate(${ox} ${oy}) scale(${k})"`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <style>${OSNOVNI_STIL}${o.stil || ''}</style>
        <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
        ${okvirSvg(sheet)}
        <g${transform}>${o.sadrzaj}</g>
        ${legenda(o.legenda, o.naslovLegende, u.x + 12, u.y + u.h - legendaH)}
        ${sastavnica(o.meta, o.dodatno, u.x + u.w - SASTAVNICA_W, u.y + u.h - SASTAVNICA_H, SASTAVNICA_W, SASTAVNICA_H)}
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
