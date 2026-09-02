/**
 * Renderovanje modela u SVG.
 *
 * Isti moduli koristi i canvas (interaktivni prikaz) i izvoz (čist crtež),
 * pa se geometrija definiše na jednom mestu.
 */

import { getSymbol, portPosition, nodeSize, nodeBBox } from './symbols.js';
import { route, pathD } from './router.js';
import { escapeXml } from './util.js';

export { escapeXml };

/** SVG transform koji odgovara rotacionoj matematici iz symbols.js */
export function nodeTransform(node) {
    const [w, h] = getSymbol(node.type).size;
    const rot = ((node.rot || 0) % 360 + 360) % 360;
    const t = `translate(${node.pos.x} ${node.pos.y})`;

    if (rot === 90) return `${t} rotate(90) translate(0 ${-h})`;
    if (rot === 180) return `${t} rotate(180) translate(${-w} ${-h})`;
    if (rot === 270) return `${t} rotate(270) translate(${-w} 0)`;
    return t;
}

/**
 * Jedan čvor.
 * @param {object} opcije - { selektovan, interaktivan, model }
 */
export function nodeSvg(node, opcije = {}) {
    const def = getSymbol(node.type);
    const bbox = nodeBBox(node);
    const [w, h] = nodeSize(node);

    const portovi = opcije.interaktivan ? Object.keys(def.ports).map(pid => {
        const p = portPosition(node, pid);
        const zauzet = opcije.model ? opcije.model.portZauzet(node.id, pid) : false;
        return `<circle class="port${zauzet ? ' zauzet' : ''}" cx="${p.x - bbox.x}" cy="${p.y - bbox.y}"
                    r="4.5" data-node="${node.id}" data-port="${pid}"><title>${escapeXml(p.label || pid)}</title></circle>`;
    }).join('') : '';

    // Simbol se crta u lokalnom (nerotiranom) koordinatnom sistemu.
    const simbol = `<g transform="${nodeTransform(node)}" class="simbol">${def.draw(node.props || {})}</g>`;

    // Oznaka i naziv se crtaju uspravno, nezavisno od rotacije simbola.
    const tekst = `
        <text class="oznaka" x="${bbox.x}" y="${bbox.y - 6}">${escapeXml(node.oznaka || '')}</text>
        <text class="label" x="${bbox.x}" y="${bbox.y + h + 14}">${escapeXml(node.label || def.naziv)}</text>`;

    const okvir = opcije.selektovan
        ? `<rect class="izbor" x="${bbox.x - 6}" y="${bbox.y - 6}" width="${w + 12}" height="${h + 12}" rx="3"/>`
        : '';

    // Simboli se crtaju bez ispune, pa bez ovog pravougaonika klik unutar
    // simbola ne bi pogađao ništa — hvatamo ceo gabarit.
    const pogodak = opcije.interaktivan
        ? `<rect class="pogodak-node" x="${bbox.x}" y="${bbox.y}" width="${w}" height="${h}"/>`
        : '';

    const portGrupa = portovi
        ? `<g class="portovi" transform="translate(${bbox.x} ${bbox.y})">${portovi}</g>`
        : '';

    return `<g class="node${opcije.selektovan ? ' selektovan' : ''}" data-id="${node.id}">
        ${okvir}${pogodak}${simbol}${tekst}${portGrupa}
    </g>`;
}

/**
 * Oznaka broja žila na jednopolnoj šemi: kosa crta + broj žila i podatak
 * o kablu. Postavlja se na NAJDUŽI segment putanje da tekst ne bi upadao
 * u simbole; na kratkim vezama se izostavlja jer nema mesta.
 */
function oznakaZila(tacke, edge) {
    // najduži segment putanje
    let najbolji = null, najduzi = 0;
    for (let i = 0; i < tacke.length - 1; i++) {
        const a = tacke[i], b = tacke[i + 1];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        if (l > najduzi) { najduzi = l; najbolji = [a, b]; }
    }
    if (!najbolji || najduzi < 34) return '';

    const [a, b] = najbolji;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const horizontalan = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);

    const opis = { DC: '2×DC', AC3: '3P+N+PE', AC1: 'L+N+PE', PE: 'PE' }[edge.system] || edge.system;
    const kabl = edge.cable && edge.cable.presek
        ? `${edge.cable.tip || ''} ${edge.conductors.length}×${edge.cable.presek} mm²`.trim()
        : '';

    // Tekst ide iznad horizontalne, odnosno desno od vertikalne veze.
    const tx = horizontalan ? cx : cx + 8;
    const ty = horizontalan ? cy - 16 : cy - 4;
    const poravnanje = horizontalan ? 'middle' : 'start';

    // Kosu crtu crtamo upravno na provodnik.
    const crta = horizontalan
        ? `x1="${cx - 6}" y1="${cy + 6}" x2="${cx + 6}" y2="${cy - 6}"`
        : `x1="${cx - 6}" y1="${cy + 6}" x2="${cx + 6}" y2="${cy - 6}"`;

    const mestaZaKabl = najduzi >= 70;

    return `
        <line class="zile" ${crta}/>
        <text class="zile-tekst" x="${tx}" y="${ty}" text-anchor="${poravnanje}">${escapeXml(opis)}</text>
        ${kabl && mestaZaKabl ? `<text class="kabl-tekst" x="${tx}" y="${ty + 10}" text-anchor="${poravnanje}">${escapeXml(kabl)}</text>` : ''}`;
}

/** Jedna grana (provodnik). */
export function edgeSvg(model, edge, opcije = {}) {
    const kraj = model.edgeEndpoints(edge);
    if (!kraj) return '';

    const izuzmi = [edge.from.split(':')[0], edge.to.split(':')[0]];
    const tacke = route(kraj.from, kraj.to, edge.waypoints || [], model.prepreke(izuzmi));
    const d = pathD(tacke);

    const klasa = `edge sys-${edge.system}${opcije.selektovan ? ' selektovan' : ''}`;

    return `<g class="${klasa}" data-id="${edge.id}">
        <path class="pogodak" d="${d}"/>
        <path class="linija" d="${d}"/>
        ${opcije.prikaziOznake === false ? '' : oznakaZila(tacke, edge)}
    </g>`;
}

/** Ceo crtež (bez okvira lista) — koristi ga i canvas i izvoz. */
export function crtezSvg(model, opcije = {}) {
    const izabrani = new Set(opcije.izabrani || []);
    const edges = model.edges.map(e => edgeSvg(model, e, {
        selektovan: izabrani.has(e.id),
        prikaziOznake: opcije.prikaziOznake
    })).join('');
    const nodes = model.nodes.map(n => nodeSvg(n, {
        selektovan: izabrani.has(n.id),
        interaktivan: opcije.interaktivan,
        model
    })).join('');
    return `<g class="provodnici">${edges}</g><g class="elementi">${nodes}</g>`;
}

/** Gabarit celog crteža, sa marginom. */
export function crtezBBox(model, margina = 60) {
    if (!model.nodes.length) return { x: 0, y: 0, w: 800, h: 600 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    model.nodes.forEach(n => {
        const b = nodeBBox(n);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
    });

    return {
        x: minX - margina,
        y: minY - margina,
        w: (maxX - minX) + margina * 2,
        h: (maxY - minY) + margina * 2
    };
}
