/**
 * Tropolni renderer.
 *
 * Nad ISTIM grafom kao jednopolna. Razlika je samo u prikazu: gde jednopolna
 * crta jednu liniju sa oznakom `3P+N+PE`, tropolna crta po jednu liniju za
 * svaku žilu iz `edge.conductors`.
 *
 * Višepolni uređaji se ne crtaju novim simbolima, nego standardnom notacijom:
 * isti jednopolni simbol se ponovi po svakom polu koji prekida, a polovi se
 * povežu isprekidanom mehaničkom spregom.
 */

import { getSymbol, portPosition, nodeSize, nodeBBox, poliTip, prekinuteZile } from './symbols.js';
import { route, ortogonalizuj } from './router.js';
import { nodeTransform, escapeXml } from './render.js';

/**
 * Razmak između žila u snopu. Mora da primi simbol jednog pola — najviši
 * prekidački simbol (FID) je ~32 jedinice — inače se polovi preklapaju.
 */
export const RAZMAK_ZILA = 34;

/** Duži izlaz iz porta nego na jednopolnoj — u njemu se smešta fan-out žila. */
const IZLAZ_3L = 52;

/** Prva i sledeće vertikale fan-outa; razmaknute da se ne poklope. */
const FAN_POCETAK = 12;
const FAN_KORAK = 8;

/** Redosled crtanja žila odozgo nadole. */
const REDOSLED = ['L1', 'L2', 'L3', 'L', 'L+', 'N', 'L-', 'PE'];

function sortiraneZile(zile) {
    return [...zile].sort((a, b) => REDOSLED.indexOf(a) - REDOSLED.indexOf(b));
}

/** Pomak žile od ose voda; snop je centriran oko putanje jednopolne šeme. */
function pomakZile(zile, zila) {
    const n = zile.length;
    const i = zile.indexOf(zila);
    return (i - (n - 1) / 2) * RAZMAK_ZILA;
}

// ── paralelno pomeranje ortogonalne polilinije ───────────────────────────────

/** Ukloni tačke koje se ponavljaju ili leže na istoj pravoj. */
function sazmi(tacke) {
    const out = [];
    tacke.forEach(t => {
        const p = out[out.length - 1];
        if (p && Math.abs(p.x - t.x) < 0.01 && Math.abs(p.y - t.y) < 0.01) return;
        out.push(t);
    });

    const cist = [out[0]];
    for (let i = 1; i < out.length - 1; i++) {
        const a = cist[cist.length - 1], b = out[i], c = out[i + 1];
        const kolinearno = (Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01)
            || (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01);
        if (!kolinearno) cist.push(b);
    }
    if (out.length > 1) cist.push(out[out.length - 1]);
    return cist;
}

function smer(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
}

/**
 * Pomeri ortogonalnu poliliniju za `d` ulevo od smera kretanja.
 * Za ortogonalne segmente presek pomerenih pravih je trivijalan: uzima se
 * x od vertikalnog i y od horizontalnog segmenta.
 */
export function pomeriPoliliniju(tacke, d) {
    if (tacke.length < 2) return tacke;

    const segmenti = [];
    for (let i = 0; i < tacke.length - 1; i++) {
        const s = smer(tacke[i], tacke[i + 1]);
        const n = { x: s.y, y: -s.x };   // leva normala
        segmenti.push({
            a: { x: tacke[i].x + n.x * d, y: tacke[i].y + n.y * d },
            b: { x: tacke[i + 1].x + n.x * d, y: tacke[i + 1].y + n.y * d },
            vertikalan: Math.abs(s.x) < 1e-9
        });
    }

    const out = [segmenti[0].a];
    for (let i = 0; i < segmenti.length - 1; i++) {
        const p = segmenti[i], q = segmenti[i + 1];
        out.push(p.vertikalan
            ? { x: p.b.x, y: q.a.y }
            : { x: q.a.x, y: p.b.y });
    }
    out.push(segmenti[segmenti.length - 1].b);

    return out;
}

function putanjaD(tacke) {
    return tacke.map((t, i) => `${i ? 'L' : 'M'} ${t.x} ${t.y}`).join(' ');
}

const SMER = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/**
 * Ortogonalni spoj priključka na snop.
 *
 * Bez ovoga bi žila išla kosom linijom od priključka do svoje trake. Umesto
 * toga: kratak potez u smeru porta, pa upravno do trake, pa dalje pravo —
 * sve pod pravim uglom. Svaka žila skreće na svojoj udaljenosti, da se
 * vertikale ne poklope.
 */
function spojNaSnop(terminal, cilj, redni) {
    const [sx, sy] = SMER[terminal.dir] || [1, 0];
    const odmak = FAN_POCETAK + redni * FAN_KORAK;
    const horizontalan = sx !== 0;

    const skretanje = horizontalan
        ? { x: terminal.x + sx * odmak, y: terminal.y }
        : { x: terminal.x, y: terminal.y + sy * odmak };

    const naTraci = horizontalan
        ? { x: skretanje.x, y: cilj.y }
        : { x: cilj.x, y: skretanje.y };

    return [skretanje, naTraci];
}

// ── priključci uređaja ───────────────────────────────────────────────────────

/**
 * Tačke na kojima žile ulaze u element.
 *
 * Ako simbol ima port nazvan po žili (inverter ima L1, L2, L3, N, PE), koristi
 * se taj port. Inače se žile raspoređuju oko porta, upravno na njegov smer.
 */
export function prikljucci(node, portId, zile) {
    const def = getSymbol(node.type);
    const osnovna = portPosition(node, portId);
    const mapa = new Map();

    zile.forEach(z => {
        if (def.ports[z]) {
            mapa.set(z, portPosition(node, z));
            return;
        }
        const p = pomakZile(zile, z);
        const upravno = (osnovna.dir === 'E' || osnovna.dir === 'W')
            ? { x: 0, y: 1 }
            : { x: 1, y: 0 };
        mapa.set(z, {
            x: osnovna.x + upravno.x * p,
            y: osnovna.y + upravno.y * p,
            dir: osnovna.dir
        });
    });

    return mapa;
}

/** Da li simbol ima portove nazvane po žilama (pa mu telo ne treba širiti). */
function imaZilnePortove(node, zile) {
    const def = getSymbol(node.type);
    return zile.some(z => def.ports[z]);
}

// ── elementi ─────────────────────────────────────────────────────────────────

/** Žile koje dolaze do datog elementa, iz grana koje ga dodiruju. */
function zileElementa(model, node) {
    const grane = model.edges.filter(e =>
        e.from.split(':')[0] === node.id || e.to.split(':')[0] === node.id);

    const skup = new Set();
    grane.forEach(e => (e.conductors || []).forEach(z => skup.add(z)));
    return sortiraneZile([...skup]);
}

/** Prekidački element: simbol ponovljen po polu + mehanička sprega. */
function polniElement(model, node) {
    const def = getSymbol(node.type);
    const bbox = nodeBBox(node);
    const [, h] = nodeSize(node);

    const sve = zileElementa(model, node);
    const prekida = prekinuteZile(node, sve);
    const prolazi = sve.filter(z => !prekida.includes(z));

    // Simbol može sam definisati tropolni prikaz kada ponavljanje po polu
    // ne bi bilo tačno — npr. FID, gde je sumacioni transformator zajednički.
    if (def.draw3l) {
        const pomak = pomakZile(sve, prekida[0]);
        const telo = `<g transform="translate(0 ${pomak})">
            <g transform="${nodeTransform(node)}">${def.draw3l(node.props || {}, {
                polova: prekida, razmak: RAZMAK_ZILA
            })}</g></g>`;

        const prolazne3l = prolazi.map(z => {
            const dy = pomakZile(sve, z);
            return `<line class="prolazna" x1="${bbox.x}" y1="${bbox.y + h / 2 + dy}"
                          x2="${bbox.x + bbox.w}" y2="${bbox.y + h / 2 + dy}"/>`;
        }).join('');

        return `${telo}${prolazne3l}`;
    }

    // Polovi se crtaju jedan ispod drugog, poravnati sa žilama.
    const kopije = prekida.map(z => {
        const dy = pomakZile(sve, z);
        return `<g class="pol" transform="translate(0 ${dy})" data-zila="${z}">
            <g transform="${nodeTransform(node)}">${def.draw(node.props || {})}</g>
        </g>`;
    }).join('');

    // Žile koje element ne prekida (po pravilu PE) prolaze pravo kroz njega.
    const prolazne = prolazi.map(z => {
        const dy = pomakZile(sve, z);
        return `<line class="prolazna" x1="${bbox.x}" y1="${bbox.y + h / 2 + dy}"
                      x2="${bbox.x + bbox.w}" y2="${bbox.y + h / 2 + dy}"/>`;
    }).join('');

    // Mehanička sprega — isprekidana linija kroz pokretne kontakte.
    const sprega = prekida.length > 1
        ? `<line class="sprega"
                 x1="${bbox.x + bbox.w * 0.5}" y1="${bbox.y + h / 2 + pomakZile(sve, prekida[0])}"
                 x2="${bbox.x + bbox.w * 0.5}" y2="${bbox.y + h / 2 + pomakZile(sve, prekida[prekida.length - 1])}"/>`
        : '';

    return `${kopije}${prolazne}${sprega}`;
}

/** Blok element: telo se razvuče preko snopa ako nema žilne portove. */
function blokElement(model, node) {
    const def = getSymbol(node.type);
    const bbox = nodeBBox(node);
    const sve = zileElementa(model, node);

    const simbol = `<g transform="${nodeTransform(node)}">${def.draw(node.props || {})}</g>`;

    if (imaZilnePortove(node, sve) || sve.length < 2) return simbol;

    const raspon = (sve.length - 1) * RAZMAK_ZILA;
    const visina = Math.max(bbox.h, raspon + 24);
    const y = bbox.y + bbox.h / 2 - visina / 2;

    return `<rect class="telo" x="${bbox.x - 6}" y="${y}" width="${bbox.w + 12}" height="${visina}" rx="3"/>
        ${simbol}`;
}

/** Odvod (SPD, uzemljenje): po jedan simbol na svaku žilu koju štiti. */
function odvodElement(model, node) {
    const def = getSymbol(node.type);
    const sve = zileElementa(model, node);

    if (node.type === 'uzemljenje' || sve.length < 2) {
        return `<g transform="${nodeTransform(node)}">${def.draw(node.props || {})}</g>`;
    }

    // Prenaponska zaštita se postavlja između svake faze i PE.
    const stitici = sve.filter(z => z !== 'PE');
    const [w] = nodeSize(node);

    return stitici.map((z, i) => {
        const dx = (i - (stitici.length - 1) / 2) * (w + 10);
        return `<g class="odvod-pol" transform="translate(${dx} 0)" data-zila="${z}">
            <g transform="${nodeTransform(node)}">${def.draw(node.props || {})}</g>
        </g>`;
    }).join('');
}

/**
 * Koliko se element stvarno razvuče po visini na tropolnoj.
 * Natpisi se pomeraju samo za toliko — inače bi kod invertera, koji ima
 * sopstvene portove po žilama, naziv odlutao daleko ispod simbola.
 */
function vertikalniRaspon(model, node) {
    const sve = zileElementa(model, node);
    const tip = poliTip(node.type);

    if (tip === 'polni') {
        const prekida = prekinuteZile(node, sve);
        return Math.max(0, (prekida.length - 1) * RAZMAK_ZILA);
    }
    if (tip === 'blok' && !imaZilnePortove(node, sve) && sve.length > 1) {
        return (sve.length - 1) * RAZMAK_ZILA;
    }
    return 0;
}

export function nodeSvg3l(model, node) {
    const bbox = nodeBBox(node);
    const [, h] = nodeSize(node);
    const def = getSymbol(node.type);

    const telo = {
        polni: polniElement,
        blok: blokElement,
        odvod: odvodElement
    }[poliTip(node.type)](model, node);

    const pola = vertikalniRaspon(model, node) / 2;

    return `<g class="node node-3l" data-id="${node.id}">
        ${telo}
        <text class="oznaka" x="${bbox.x}" y="${bbox.y - 8 - pola}">${escapeXml(node.oznaka || '')}</text>
        <text class="label" x="${bbox.x}" y="${bbox.y + h + 16 + pola}">${escapeXml(node.label || def.naziv)}</text>
    </g>`;
}

// ── grane ────────────────────────────────────────────────────────────────────

export function edgeSvg3l(model, edge, opcije = {}) {
    const kraj = model.edgeEndpoints(edge);
    if (!kraj) return '';

    const zile = sortiraneZile(edge.conductors || []);
    if (!zile.length) return '';

    const [odId, odPort] = edge.from.split(':');
    const [doId, doPort] = edge.to.split(':');
    const od = model.getNode(odId), ka = model.getNode(doId);

    const izlaz = prikljucci(od, odPort, zile);
    const ulaz = prikljucci(ka, doPort, zile);

    const osnovna = route(kraj.from, kraj.to, edge.waypoints || [],
        model.prepreke([odId, doId]), { izlaz: IZLAZ_3L });

    const linije = zile.map((z, i) => {
        const d = pomakZile(zile, z);
        // pomeriPoliliniju pomera ULEVO od smera kretanja, a pomakZile raste
        // nadole; zato ide sa suprotnim znakom, inače se snop preslika i žile
        // se ukrste na svakom elementu.
        const pomerena = pomeriPoliliniju(osnovna, -d);

        const a = izlaz.get(z), b = ulaz.get(z);
        const traka = pomerena.slice(1, -1);

        // Krajevi se na traku spajaju pod pravim uglom, ne kosom linijom.
        const tacke = [
            a,
            ...spojNaSnop(a, traka[0] || pomerena[0], i),
            ...traka,
            ...spojNaSnop(b, traka[traka.length - 1] || pomerena[pomerena.length - 1], i).reverse(),
            b
        ];

        return `<path class="zila zila-${z.replace('+', 'p').replace('-', 'm')}" d="${putanjaD(sazmi(ortogonalizuj(tacke)))}"/>`;
    }).join('');

    // Oznake žila jednom po vodu, na sredini najdužeg segmenta.
    const natpis = opcije.prikaziOznake === false ? '' : oznakaSnopa(osnovna, zile, edge);

    return `<g class="edge edge-3l sys-${edge.system}" data-id="${edge.id}">${linije}${natpis}</g>`;
}

function oznakaSnopa(tacke, zile, edge) {
    let najbolji = null, najduzi = 0;
    for (let i = 0; i < tacke.length - 1; i++) {
        const l = Math.hypot(tacke[i + 1].x - tacke[i].x, tacke[i + 1].y - tacke[i].y);
        if (l > najduzi) { najduzi = l; najbolji = [tacke[i], tacke[i + 1]]; }
    }
    if (!najbolji || najduzi < 50) return '';

    const [a, b] = najbolji;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const gornja = cy + pomakZile(zile, zile[0]) - 8;

    const kabl = edge.cable && edge.cable.presek
        ? `${edge.cable.tip || ''} ${zile.length}×${edge.cable.presek} mm²`.trim()
        : '';

    return `
        <text class="zile-tekst" x="${cx}" y="${gornja}" text-anchor="middle">${escapeXml(zile.join('  '))}</text>
        ${kabl ? `<text class="kabl-tekst" x="${cx}" y="${cy + pomakZile(zile, zile[zile.length - 1]) + 16}"
                       text-anchor="middle">${escapeXml(kabl)}</text>` : ''}`;
}

// ── ceo crtež ────────────────────────────────────────────────────────────────

export function crtez3lSvg(model, opcije = {}) {
    const edges = model.edges.map(e => edgeSvg3l(model, e, opcije)).join('');
    const nodes = model.nodes.map(n => nodeSvg3l(model, n)).join('');
    return `<g class="provodnici">${edges}</g><g class="elementi">${nodes}</g>`;
}

/** Gabarit tropolnog crteža — snopovi su širi od jednopolne linije. */
export function crtez3lBBox(model, margina = 60) {
    if (!model.nodes.length) return { x: 0, y: 0, w: 800, h: 600 };

    const najsiriSnop = model.edges.reduce((m, e) =>
        Math.max(m, (e.conductors || []).length), 1);
    const snop = (najsiriSnop - 1) * RAZMAK_ZILA / 2;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    model.nodes.forEach(n => {
        const b = nodeBBox(n);
        // vodovi se šire oko elementa, pa gabarit uzima i snop koji ga dodiruje
        const d = Math.max(snop, vertikalniRaspon(model, n) / 2) + 24;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y - d);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h + d);
    });

    return {
        x: minX - margina, y: minY - margina,
        w: (maxX - minX) + margina * 2, h: (maxY - minY) + margina * 2
    };
}
