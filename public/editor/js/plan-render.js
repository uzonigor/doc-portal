/**
 * Renderovanje string plana u SVG.
 * Koordinate modela su u metrima; ovde se množe sa PPM.
 */

import { PPM, dimenzijeModula, korakMreze, merePolja, TIPOVI_OPREME } from './plan-model.js';
import { duzineStringova } from './plan-trase.js';
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

/** Marker opreme (inverter, ormani, priključak) na planu. */
export function opremaSvg(model, o, opcije = {}) {
    const def = TIPOVI_OPREME[o.tip] || { naziv: o.tip, boja: '#2d3748' };
    const s = 0.9 * PPM;   // marker je kvadrat stranice 0,9 m
    const x = o.pos.x * PPM - s / 2;
    const y = o.pos.y * PPM - s / 2;

    return `<g class="oprema${opcije.selektovan ? ' selektovan' : ''}" data-id="${o.id}" data-tip="${o.tip}">
        ${opcije.selektovan ? `<rect class="izbor" x="${x - 6}" y="${y - 6}" width="${s + 12}" height="${s + 12}" rx="4"/>` : ''}
        <rect class="marker" x="${x}" y="${y}" width="${s}" height="${s}" rx="4" fill="${escapeXml(def.boja)}"/>
        <text class="marker-oznaka" x="${x + s / 2}" y="${y + s / 2 + 5}">${escapeXml(o.oznaka)}</text>
        <text class="marker-naziv" x="${x + s / 2}" y="${y + s + 16}">${escapeXml(o.naziv)}</text>
    </g>`;
}

/**
 * Trase kablova: leapfrog ožičenje stringa punom linijom u boji stringa,
 * a vod do invertera isprekidano (jer ne prati krov nego spust).
 */
export function traseSvg(model) {
    const izvestaj = duzineStringova(model);

    return `<g class="trase">${izvestaj.map(s => {
        if (s.putanja.length < 2 && !s.inverterPos) return '';

        // Povratna grana leapfroga ide istom linijom kao polazna, pa je za
        // čitljivost crtamo malo pomerenu — dužina se računa na pravim centrima.
        const POMAK = 0.18;
        const tacke = s.putanja.map(t =>
            `${t.x * PPM},${(t.y + (t.povratak ? POMAK : -POMAK)) * PPM}`).join(' ');
        const ozicenje = s.putanja.length > 1
            ? `<polyline class="trasa-ozicenje" points="${tacke}" stroke="${escapeXml(s.boja)}"/>`
            : '';

        const imaVod = s.prikljucak && s.inverterPos;

        // Vod se računa manhattan rastojanjem (uz ivice), pa se tako i crta —
        // kosa linija bi pokazivala kraću trasu nego što je proračunata.
        const vod = imaVod
            ? `<polyline class="trasa-vod" stroke="${escapeXml(s.boja)}" fill="none"
                     points="${s.prikljucak.x * PPM},${s.prikljucak.y * PPM}
                             ${s.inverterPos.x * PPM},${s.prikljucak.y * PPM}
                             ${s.inverterPos.x * PPM},${s.inverterPos.y * PPM}"/>`
            : '';

        // Natpis ide poslednji da ga linije trase ne bi precrtale.
        const natpis = imaVod
            ? `<text class="trasa-tekst" x="${(s.prikljucak.x + s.inverterPos.x) / 2 * PPM}"
                     y="${s.prikljucak.y * PPM - 8}" text-anchor="middle"
                     fill="${escapeXml(s.boja)}">${escapeXml(s.oznaka)} · 2×${s.vod.toFixed(1)} m</text>`
            : '';

        return `<g class="trasa" data-string="${s.stringId}">${vod}${ozicenje}${natpis}</g>`;
    }).join('')}</g>`;
}

export function planSvg(model, opcije = {}) {
    const izabrani = new Set(opcije.izabrani || []);
    const trase = opcije.prikaziTrase === false ? '' : traseSvg(model);

    return `${podlogaSvg(model)}
        <g class="polja">${model.polja.map(p =>
            poljeSvg(model, p, { selektovan: izabrani.has(p.id), interaktivan: opcije.interaktivan })).join('')}</g>
        ${trase}
        <g class="oprema-sloj">${(model.oprema || []).map(o =>
            opremaSvg(model, o, { selektovan: izabrani.has(o.id) })).join('')}</g>`;
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

    (model.oprema || []).forEach(o => {
        kutije.push({ x: o.pos.x - 0.6, y: o.pos.y - 0.6, w: 1.2, h: 1.6 });
    });

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
