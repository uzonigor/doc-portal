/**
 * Izvoz crteža: kompletan list sa okvirom, sastavnicom i legendom.
 * Iz istog SVG-a idu i preuzimanje .svg, .png i štampa u PDF.
 */

import { crtezSvg, crtezBBox, escapeXml } from './render.js';
import { SYMBOLS } from './symbols.js';

// Formati u jedinicama crteža (odnos stranica odgovara ISO A formatima)
export const FORMATI = {
    A4: { landscape: [1050, 742], portrait: [742, 1050] },
    A3: { landscape: [1486, 1050], portrait: [1050, 1486] }
};

const STIL = `
    .simbol { color: #111; }
    .edge .linija { stroke: #111; stroke-width: 1.6; fill: none; }
    .edge .pogodak { display: none; }
    .edge.sys-DC .linija { stroke: #b45309; }
    .edge.sys-PE .linija { stroke: #2f855a; }
    .zile { stroke: #111; stroke-width: 1.2; }
    .zile-tekst, .kabl-tekst { font: 9px 'Segoe UI', sans-serif; fill: #333; }
    .oznaka { font: bold 11px 'Segoe UI', sans-serif; fill: #111; }
    .label { font: 9px 'Segoe UI', sans-serif; fill: #555; }
    .okvir { stroke: #111; stroke-width: 1.5; fill: none; }
    .sastavnica text { font: 10px 'Segoe UI', sans-serif; fill: #111; }
    .sastavnica .naslov { font: bold 13px 'Segoe UI', sans-serif; }
    .sastavnica .oznaka-polja { font: 8px 'Segoe UI', sans-serif; fill: #666; }
    .legenda text { font: 9px 'Segoe UI', sans-serif; fill: #111; }
    .legenda .naslov { font: bold 10px 'Segoe UI', sans-serif; }
`;

function sastavnica(model, x, y, w, h) {
    const m = model.meta || {};
    const danas = new Date().toLocaleDateString('sr-RS');
    const red = (i) => y + (h / 4) * i;

    return `<g class="sastavnica">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" class="okvir"/>
        <line x1="${x}" y1="${red(1)}" x2="${x + w}" y2="${red(1)}" class="okvir" stroke-width="1"/>
        <line x1="${x}" y1="${red(2)}" x2="${x + w}" y2="${red(2)}" class="okvir" stroke-width="1"/>
        <line x1="${x}" y1="${red(3)}" x2="${x + w}" y2="${red(3)}" class="okvir" stroke-width="1"/>
        <line x1="${x + w * 0.62}" y1="${red(1)}" x2="${x + w * 0.62}" y2="${y + h}" class="okvir" stroke-width="1"/>

        <text class="naslov" x="${x + 10}" y="${y + 22}">${escapeXml(m.naziv || 'Jednopolna šema')}</text>

        <text class="oznaka-polja" x="${x + 10}" y="${red(1) + 13}">INVESTITOR</text>
        <text x="${x + 10}" y="${red(1) + 26}">${escapeXml(m.investitor || '—')}</text>

        <text class="oznaka-polja" x="${x + 10}" y="${red(2) + 13}">OBJEKAT / LOKACIJA</text>
        <text x="${x + 10}" y="${red(2) + 26}">${escapeXml(m.lokacija || '—')}</text>

        <text class="oznaka-polja" x="${x + 10}" y="${red(3) + 13}">PROJEKTANT</text>
        <text x="${x + 10}" y="${red(3) + 26}">${escapeXml(m.projektant || '—')}</text>

        <text class="oznaka-polja" x="${x + w * 0.62 + 10}" y="${red(1) + 13}">BROJ PROJEKTA</text>
        <text x="${x + w * 0.62 + 10}" y="${red(1) + 26}">${escapeXml(m.brojProjekta || '—')}</text>

        <text class="oznaka-polja" x="${x + w * 0.62 + 10}" y="${red(2) + 13}">DATUM</text>
        <text x="${x + w * 0.62 + 10}" y="${red(2) + 26}">${escapeXml(danas)}</text>

        <text class="oznaka-polja" x="${x + w * 0.62 + 10}" y="${red(3) + 13}">SNAGA DC / AC</text>
        <text x="${x + w * 0.62 + 10}" y="${red(3) + 26}">${model.ukupnaSnagaDC().toFixed(2)} kWp / ${model.ukupnaSnagaAC().toFixed(2)} kW</text>
    </g>`;
}

function legenda(model, x, y) {
    const korisceni = [...new Set(model.nodes.map(n => n.type))];
    if (!korisceni.length) return '';

    const visina = 26 + korisceni.length * 16;
    const sirina = 230;

    return `<g class="legenda">
        <rect x="${x}" y="${y}" width="${sirina}" height="${visina}" class="okvir" stroke-width="1"/>
        <text class="naslov" x="${x + 10}" y="${y + 17}">LEGENDA</text>
        ${korisceni.map((t, i) => {
            const oznake = model.nodes.filter(n => n.type === t).map(n => n.oznaka).join(', ');
            return `<text x="${x + 10}" y="${y + 34 + i * 16}">${escapeXml(oznake)} — ${escapeXml(SYMBOLS[t].naziv)}</text>`;
        }).join('')}
    </g>`;
}

/** Kompletan list spreman za štampu / izvoz. */
export function listSvg(model) {
    const format = (model.sheet && model.sheet.format) || 'A3';
    const orijentacija = (model.sheet && model.sheet.orijentacija) || 'landscape';
    const [W, H] = (FORMATI[format] || FORMATI.A3)[orijentacija];

    const M = 20;                       // spoljna margina
    const sastavnicaW = 460, sastavnicaH = 120;

    // Crtež se skalira da stane u slobodan prostor iznad sastavnice.
    const b = crtezBBox(model, 20);
    const poljeW = W - M * 2 - 20;
    const poljeH = H - M * 2 - sastavnicaH - 30;
    const k = Math.min(1.6, poljeW / b.w, poljeH / b.h);
    const ox = M + 10 + (poljeW - b.w * k) / 2 - b.x * k;
    const oy = M + 10 + (poljeH - b.h * k) / 2 - b.y * k;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <style>${STIL}</style>
        <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
        <rect x="${M}" y="${M}" width="${W - M * 2}" height="${H - M * 2}" class="okvir"/>
        <g transform="translate(${ox} ${oy}) scale(${k})">${crtezSvg(model, { interaktivan: false })}</g>
        ${legenda(model, M + 12, H - M - sastavnicaH - 12 - (26 + [...new Set(model.nodes.map(n => n.type))].length * 16))}
        ${sastavnica(model, W - M - sastavnicaW, H - M - sastavnicaH, sastavnicaW, sastavnicaH)}
    </svg>`;
}

function preuzmi(sadrzaj, imeFajla, mime) {
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

export function izveziSvg(model) {
    const ime = (model.meta.naziv || 'sema').replace(/[^\w\-. ]+/g, '_');
    preuzmi(listSvg(model), `${ime}.svg`, 'image/svg+xml');
}

export function izveziPng(model, skala = 2) {
    const svg = listSvg(model);
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width * skala;
        c.height = img.height * skala;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => {
            const ime = (model.meta.naziv || 'sema').replace(/[^\w\-. ]+/g, '_');
            preuzmi(b, `${ime}.png`, 'image/png');
        }, 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
}

/** Štampa lista (u dijalogu se bira "Sačuvaj kao PDF"). */
export function stampaj(model) {
    const w = window.open('', '_blank');
    if (!w) return;
    const orijentacija = (model.sheet && model.sheet.orijentacija) || 'landscape';
    const format = (model.sheet && model.sheet.format) || 'A3';

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${escapeXml(model.meta.naziv || 'Šema')}</title>
        <style>
            @page { size: ${format} ${orijentacija}; margin: 0; }
            html, body { margin: 0; padding: 0; }
            svg { width: 100%; height: auto; display: block; }
        </style></head><body>${listSvg(model)}</body></html>`);
    w.document.close();
    w.addEventListener('load', () => { w.focus(); w.print(); });
}
