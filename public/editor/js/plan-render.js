/**
 * Renderovanje string plana u SVG.
 * Koordinate modela su u metrima; ovde se množe sa PPM.
 */

import { PPM, dimenzijeModula, korakMreze, merePolja } from './plan-model.js';
import { escapeXml } from './util.js';

/** Podloga (snimak krova) ispod crteža. */
export function podlogaSvg(model) {
    const p = model.podloga;
    if (!p || !p.slika) return '';

    return `<image class="podloga" href="${p.slika}"
        x="${p.x * PPM}" y="${p.y * PPM}"
        width="${p.sirina * PPM}" height="${p.visina * PPM}"
        opacity="${p.prozirnost}" preserveAspectRatio="none"/>`;
}

function bojaModula(model, stanje) {
    if (stanje.iskljucen) return '#e2e8f0';
    if (!stanje.string) return '#f7fafc';
    const s = model.getString(stanje.string);
    return s ? s.boja : '#f7fafc';
}

/** Jedno polje (krovna ravan) sa mrežom modula. */
export function poljeSvg(model, polje, opcije = {}) {
    const [mw, mh] = dimenzijeModula(model, polje);
    const [kx, ky] = korakMreze(model, polje);
    const [pw, ph] = merePolja(model, polje);

    const w = mw * PPM, h = mh * PPM;
    const veliki = w > 40 && h > 26;   // ima li mesta za oznaku stringa

    let moduli = '';
    for (let r = 0; r < polje.redova; r++) {
        for (let c = 0; c < polje.kolona; c++) {
            const st = model.stanjeModula(polje, r, c);
            const x = c * kx * PPM, y = r * ky * PPM;
            const s = st.string ? model.getString(st.string) : null;

            moduli += `<g class="modul${st.iskljucen ? ' iskljucen' : ''}" data-r="${r}" data-c="${c}">
                <rect x="${x}" y="${y}" width="${w}" height="${h}"
                      fill="${bojaModula(model, st)}" fill-opacity="${st.string ? 0.75 : 1}"/>
                ${st.iskljucen
                    ? `<path d="M${x} ${y} L${x + w} ${y + h} M${x + w} ${y} L${x} ${y + h}" class="precrtan"/>`
                    : ''}
                ${s && veliki && !st.iskljucen
                    ? `<text class="modul-oznaka" x="${x + w / 2}" y="${y + h / 2 + 4}">${escapeXml(s.oznaka)}</text>`
                    : ''}
            </g>`;
        }
    }

    const izbor = opcije.selektovan
        ? `<rect class="izbor" x="-6" y="-6" width="${pw * PPM + 12}" height="${ph * PPM + 12}" rx="4"/>`
        : '';

    const aktivnih = model.brojModulaUPolju(polje);
    const natpis = `${polje.naziv} · ${aktivnih} kom · nagib ${polje.nagib}° · azimut ${polje.azimut}°`;

    return `<g class="polje${opcije.selektovan ? ' selektovan' : ''}" data-id="${polje.id}"
               transform="translate(${polje.pos.x * PPM} ${polje.pos.y * PPM}) rotate(${polje.rot || 0})">
        ${izbor}
        <rect class="ram" x="0" y="0" width="${pw * PPM}" height="${ph * PPM}"/>
        <g class="moduli">${moduli}</g>
        <text class="polje-natpis" x="0" y="-10">${escapeXml(natpis)}</text>
    </g>`;
}

export function planSvg(model, opcije = {}) {
    const izabrani = new Set(opcije.izabrani || []);
    return `${podlogaSvg(model)}
        <g class="polja">${model.polja.map(p =>
            poljeSvg(model, p, { selektovan: izabrani.has(p.id), interaktivan: opcije.interaktivan })).join('')}</g>`;
}

/** Gabarit crteža u koordinatama crteža (uključuje podlogu ako je vidljiva). */
export function planBBox(model, marginaM = 1) {
    const kutije = [];

    if (model.podloga && model.podloga.slika) {
        kutije.push({
            x: model.podloga.x, y: model.podloga.y,
            w: model.podloga.sirina, h: model.podloga.visina
        });
    }

    model.polja.forEach(p => {
        const [pw, ph] = merePolja(model, p);
        // gruba, ali sigurna procena za zarotirano polje: opisani kvadrat
        const d = Math.max(pw, ph);
        const rotirano = (p.rot || 0) % 180 !== 0;
        kutije.push({
            x: p.pos.x - (rotirano ? d : 0),
            y: p.pos.y,
            w: rotirano ? d * 2 : pw,
            h: rotirano ? d : ph
        });
    });

    if (!kutije.length) return { x: 0, y: 0, w: 2000, h: 1400 };

    const minX = Math.min(...kutije.map(k => k.x)) - marginaM;
    const minY = Math.min(...kutije.map(k => k.y)) - marginaM;
    const maxX = Math.max(...kutije.map(k => k.x + k.w)) + marginaM;
    const maxY = Math.max(...kutije.map(k => k.y + k.h)) + marginaM;

    return { x: minX * PPM, y: minY * PPM, w: (maxX - minX) * PPM, h: (maxY - minY) * PPM };
}

/** Merna letva — bez nje se plan ne može čitati na papiru. */
export function razmernikSvg(x, y, metara = 5) {
    const duzina = metara * PPM;
    const podeoka = metara;
    let delovi = '';
    for (let i = 0; i < podeoka; i++) {
        delovi += `<rect x="${x + i * PPM}" y="${y}" width="${PPM}" height="8"
            fill="${i % 2 ? '#fff' : '#111'}" stroke="#111" stroke-width="0.8"/>`;
    }
    return `<g class="razmernik">${delovi}
        <text x="${x}" y="${y + 22}" class="razmernik-tekst">0</text>
        <text x="${x + duzina}" y="${y + 22}" class="razmernik-tekst" text-anchor="end">${metara} m</text>
    </g>`;
}

/** Strelica severa — orijentacija plana na papiru. */
export function severSvg(x, y) {
    return `<g class="sever" transform="translate(${x} ${y})">
        <path d="M0 -26 L9 12 L0 4 L-9 12 Z" fill="#111"/>
        <text x="0" y="30" text-anchor="middle" class="sever-tekst">S</text>
    </g>`;
}
