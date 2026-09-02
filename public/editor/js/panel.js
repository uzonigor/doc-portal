/**
 * Leva paleta simbola i desni panel svojstava.
 * Forma svojstava se generiše iz `props` šeme simbola — nema ručnog HTML-a
 * po simbolu, pa dodavanje novog simbola ne traži izmenu panela.
 */

import { SYMBOLS, KATEGORIJE, getSymbol } from './symbols.js';
import { escapeXml } from './render.js';

/** Mali pregled simbola za paletu. */
function pregled(type) {
    const def = SYMBOLS[type];
    const [w, h] = def.size;
    const m = 6;
    return `<svg viewBox="${-m} ${-m} ${w + m * 2} ${h + m * 2}" class="pregled" preserveAspectRatio="xMidYMid meet">
        ${def.draw(Object.fromEntries(Object.entries(def.props || {}).map(([k, v]) => [k, v.default])))}
    </svg>`;
}

export function renderPaleta(el) {
    el.innerHTML = KATEGORIJE.map(kat => {
        const stavke = Object.entries(SYMBOLS).filter(([, d]) => d.kategorija === kat.id);
        if (!stavke.length) return '';
        return `
            <div class="kat">
                <h4>${escapeXml(kat.naziv)}</h4>
                <div class="kat-lista">
                    ${stavke.map(([key, d]) => `
                        <div class="simbol-kartica" draggable="true" data-type="${key}" title="${escapeXml(d.naziv)}">
                            ${pregled(key)}
                            <span>${escapeXml(d.naziv)}</span>
                        </div>`).join('')}
                </div>
            </div>`;
    }).join('');

    el.querySelectorAll('.simbol-kartica').forEach(k => {
        k.addEventListener('dragstart', ev => {
            ev.dataTransfer.setData('text/simbol', k.getAttribute('data-type'));
            ev.dataTransfer.effectAllowed = 'copy';
        });
    });
}

function polje(id, spec, vrednost, prefiks) {
    const naziv = escapeXml(spec.label);
    const val = vrednost === undefined || vrednost === null ? '' : vrednost;

    if (spec.tip === 'select') {
        return `<label>${naziv}
            <select data-cilj="${prefiks}" data-id="${id}">
                ${spec.opcije.map(o => `<option value="${escapeXml(o)}"${String(o) === String(val) ? ' selected' : ''}>${escapeXml(o)}</option>`).join('')}
            </select></label>`;
    }

    const tipInput = (spec.tip === 'int' || spec.tip === 'float') ? 'number' : 'text';
    const korak = spec.tip === 'int' ? '1' : 'any';
    return `<label>${naziv}
        <input type="${tipInput}" step="${korak}" value="${escapeXml(val)}" data-cilj="${prefiks}" data-id="${id}"></label>`;
}

export function renderSvojstva(el, model, izabrani, canvas) {
    if (!izabrani.length) {
        const upozorenja = model.validate();
        el.innerHTML = `
            <div class="prazno">
                <p>Nije izabran nijedan element.</p>
                <p class="mala">Prevuci simbol iz palete na crtež, pa povuci od porta do porta da napraviš vezu.</p>
            </div>
            <h4>Rekapitulacija</h4>
            <dl class="rekap">
                <dt>Elemenata</dt><dd>${model.nodes.length}</dd>
                <dt>Provodnika</dt><dd>${model.edges.length}</dd>
                <dt>Snaga DC</dt><dd>${model.ukupnaSnagaDC().toFixed(2)} kWp</dd>
                <dt>Snaga AC</dt><dd>${model.ukupnaSnagaAC().toFixed(2)} kW</dd>
            </dl>
            ${upozorenja.length ? `<h4>Provera (${upozorenja.length})</h4>
                <ul class="upozorenja">${upozorenja.slice(0, 12).map(u =>
                    `<li class="${u.nivo}">${escapeXml(u.tekst)}</li>`).join('')}</ul>` : ''}`;
        return;
    }

    if (izabrani.length > 1) {
        el.innerHTML = `<div class="prazno"><p>Izabrano elemenata: ${izabrani.length}</p>
            <p class="mala">R = rotiraj · Ctrl+D = dupliraj · Delete = obriši</p></div>`;
        return;
    }

    const id = izabrani[0];
    const node = model.getNode(id);
    const edge = model.getEdge(id);

    if (node) {
        const def = getSymbol(node.type);
        const izracunato = def.compute ? def.compute(node.props) : null;

        el.innerHTML = `
            <h4>${escapeXml(def.naziv)}</h4>
            <div class="forma">
                <label>Poziciona oznaka <input type="text" value="${escapeXml(node.oznaka || '')}" data-cilj="node-meta" data-id="oznaka"></label>
                <label>Naziv <input type="text" value="${escapeXml(node.label || '')}" data-cilj="node-meta" data-id="label"></label>
                ${Object.entries(def.props || {}).map(([k, spec]) =>
                    polje(k, spec, node.props[k], 'node-prop')).join('')}
            </div>
            ${izracunato ? `<h4>Izračunato</h4><dl class="rekap">
                ${Object.entries(izracunato).map(([k, v]) => `<dt>${escapeXml(k)}</dt><dd>${escapeXml(v)}</dd>`).join('')}
            </dl>` : ''}
            <div class="akcije">
                <button data-akcija="rotiraj">Rotiraj (R)</button>
                <button data-akcija="dupliraj">Dupliraj</button>
                <button data-akcija="obrisi" class="opasno">Obriši</button>
            </div>`;
    } else if (edge) {
        const a = model.getNode(edge.from.split(':')[0]);
        const b = model.getNode(edge.to.split(':')[0]);

        el.innerHTML = `
            <h4>Provodnik</h4>
            <p class="mala">${escapeXml(a?.oznaka || '?')} → ${escapeXml(b?.oznaka || '?')}</p>
            <div class="forma">
                <label>Sistem
                    <select data-cilj="edge" data-id="system">
                        ${[['DC', 'DC'], ['AC1', 'AC 1-fazni'], ['AC3', 'AC 3-fazni'], ['PE', 'Zaštitni (PE)']].map(([v, n]) =>
                            `<option value="${v}"${edge.system === v ? ' selected' : ''}>${n}</option>`).join('')}
                    </select></label>
                <label>Tip kabla <input type="text" value="${escapeXml(edge.cable?.tip || '')}" data-cilj="edge" data-id="cable.tip"></label>
                <label>Presek (mm²) <input type="number" step="any" value="${escapeXml(edge.cable?.presek ?? '')}" data-cilj="edge" data-id="cable.presek"></label>
                <label>Dužina (m) <input type="number" step="any" value="${escapeXml(edge.cable?.duzina ?? '')}" data-cilj="edge" data-id="cable.duzina"></label>
            </div>
            <dl class="rekap">
                <dt>Žile</dt><dd>${escapeXml(edge.conductors.join(', '))}</dd>
            </dl>
            <div class="akcije">
                <button data-akcija="ispravi">Poništi ručne prelome</button>
                <button data-akcija="obrisi" class="opasno">Obriši</button>
            </div>`;
    }

    vezi(el, model, id, canvas);
}

function vezi(el, model, id, canvas) {
    el.querySelectorAll('input, select').forEach(polje => {
        const dogadjaj = polje.tagName === 'SELECT' ? 'change' : 'change';
        polje.addEventListener(dogadjaj, () => {
            const cilj = polje.getAttribute('data-cilj');
            const kljuc = polje.getAttribute('data-id');
            const vrednost = polje.type === 'number' ? parseFloat(polje.value) || 0 : polje.value;

            if (cilj === 'node-meta') model.setNodeProp(id, kljuc, vrednost);
            else if (cilj === 'node-prop') model.setNodeProp(id, kljuc, vrednost);
            else if (cilj === 'edge') model.setEdgeProp(id, kljuc, vrednost);

            renderSvojstva(el, model, [id], canvas);
        });
    });

    el.querySelectorAll('button[data-akcija]').forEach(btn => {
        btn.addEventListener('click', () => {
            const a = btn.getAttribute('data-akcija');
            if (a === 'rotiraj') model.rotateNodes([id]);
            if (a === 'dupliraj') {
                const novi = model.duplicateNodes([id]);
                if (novi?.length) canvas.postaviIzbor(novi);
            }
            if (a === 'ispravi') model.setEdgeProp(id, 'waypoints', []);
            if (a === 'obrisi') {
                model.getNode(id) ? model.removeNodes([id]) : model.removeEdges([id]);
                canvas.postaviIzbor([]);
            }
        });
    });
}
