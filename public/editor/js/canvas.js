/**
 * Interaktivni canvas: pan/zoom, izbor, pomeranje, povezivanje portova.
 *
 * Prikaz se pri svakoj izmeni ponovo iscrtava iz modela. Za veličine crteža
 * koje se sreću u PV projektima (do par stotina elemenata) to je dovoljno
 * brzo i drži jedan izvor istine — model.
 */

import { crtezSvg } from './render.js';
import { nodeBBox, portPosition } from './symbols.js';

const GRID = 10;

export class Canvas {
    constructor(host, model, opcije = {}) {
        this.host = host;
        this.model = model;
        this.onIzbor = opcije.onIzbor || (() => {});
        this.onPoruka = opcije.onPoruka || (() => {});

        this.izabrani = new Set();
        this.pan = { x: 80, y: 60 };
        this.zoom = 1;

        this.stanje = null;   // { vrsta: 'pan'|'drag'|'veza'|'marquee', ... }

        this.host.innerHTML = `
            <svg class="platno" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" width="${GRID}" height="${GRID}" patternUnits="userSpaceOnUse">
                        <circle cx="0.5" cy="0.5" r="0.5" class="grid-tacka"/>
                    </pattern>
                </defs>
                <rect class="pozadina" x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid)"/>
                <g class="viewport"></g>
                <g class="overlay"></g>
            </svg>`;

        this.svg = host.querySelector('svg');
        this.viewport = host.querySelector('.viewport');
        this.overlay = host.querySelector('.overlay');
        this.pozadinaEl = host.querySelector('.pozadina');

        this.model.on(() => this.render());
        this.vezi();
        this.render();
    }

    // ── koordinate ───────────────────────────────────────────────────────────

    /** Ekran -> koordinate crteža. */
    uCrtez(ev) {
        const r = this.svg.getBoundingClientRect();
        return {
            x: (ev.clientX - r.left - this.pan.x) / this.zoom,
            y: (ev.clientY - r.top - this.pan.y) / this.zoom
        };
    }

    naGrid(v) { return Math.round(v / GRID) * GRID; }

    // ── render ───────────────────────────────────────────────────────────────

    render() {
        this.viewport.setAttribute('transform', `translate(${this.pan.x} ${this.pan.y}) scale(${this.zoom})`);
        this.pozadinaEl.setAttribute('transform', `translate(${this.pan.x} ${this.pan.y}) scale(${this.zoom})`);
        this.viewport.innerHTML = crtezSvg(this.model, {
            izabrani: [...this.izabrani],
            interaktivan: true
        });
    }

    postaviIzbor(ids) {
        this.izabrani = new Set(ids);
        this.render();
        this.onIzbor([...this.izabrani]);
    }

    izborniObjekti() {
        return [...this.izabrani].map(id => this.model.getNode(id) || this.model.getEdge(id)).filter(Boolean);
    }

    // ── događaji ─────────────────────────────────────────────────────────────

    vezi() {
        this.svg.addEventListener('pointerdown', e => this.pointerDown(e));
        window.addEventListener('pointermove', e => this.pointerMove(e));
        window.addEventListener('pointerup', e => this.pointerUp(e));
        this.svg.addEventListener('wheel', e => this.wheel(e), { passive: false });
        this.svg.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('keydown', e => this.keyDown(e));

        // Ispuštanje simbola iz palete
        this.svg.addEventListener('dragover', e => { e.preventDefault(); });
        this.svg.addEventListener('drop', e => {
            e.preventDefault();
            const type = e.dataTransfer.getData('text/simbol');
            if (!type) return;
            const p = this.uCrtez(e);
            const node = this.model.addNode(type, { x: this.naGrid(p.x), y: this.naGrid(p.y) });
            this.postaviIzbor([node.id]);
        });
    }

    pointerDown(ev) {
        const port = ev.target.closest('.port');
        const nodeEl = ev.target.closest('.node');
        const edgeEl = ev.target.closest('.edge');
        const tacka = this.uCrtez(ev);

        // srednji/desni taster ili prazna podloga sa Space -> pan
        if (ev.button === 1 || ev.button === 2 || ev.shiftKey && !nodeEl && !edgeEl) {
            this.stanje = { vrsta: 'pan', start: { x: ev.clientX, y: ev.clientY }, pan: { ...this.pan } };
            return;
        }

        if (port) {
            const nodeId = port.getAttribute('data-node');
            const portId = port.getAttribute('data-port');
            const p = portPosition(this.model.getNode(nodeId), portId);
            this.stanje = { vrsta: 'veza', od: `${nodeId}:${portId}`, odTacka: p, doTacka: tacka };
            this.crtajPrivremenuVezu();
            return;
        }

        if (nodeEl) {
            const id = nodeEl.getAttribute('data-id');
            if (ev.ctrlKey || ev.metaKey) {
                this.izabrani.has(id) ? this.izabrani.delete(id) : this.izabrani.add(id);
                this.postaviIzbor([...this.izabrani]);
            } else if (!this.izabrani.has(id)) {
                this.postaviIzbor([id]);
            }
            const nodeIds = [...this.izabrani].filter(i => this.model.getNode(i));
            this.stanje = { vrsta: 'drag', ids: nodeIds, poslednja: { x: this.naGrid(tacka.x), y: this.naGrid(tacka.y) }, pomereno: false };
            return;
        }

        if (edgeEl) {
            this.postaviIzbor([edgeEl.getAttribute('data-id')]);
            return;
        }

        // prazna podloga -> pravougaoni izbor
        this.stanje = { vrsta: 'marquee', start: tacka, kraj: tacka };
        if (!ev.ctrlKey && !ev.metaKey) this.postaviIzbor([]);
    }

    pointerMove(ev) {
        const s = this.stanje;
        if (!s) return;

        if (s.vrsta === 'pan') {
            this.pan.x = s.pan.x + (ev.clientX - s.start.x);
            this.pan.y = s.pan.y + (ev.clientY - s.start.y);
            this.render();
            return;
        }

        const tacka = this.uCrtez(ev);

        if (s.vrsta === 'drag') {
            const nx = this.naGrid(tacka.x), ny = this.naGrid(tacka.y);
            const dx = nx - s.poslednja.x, dy = ny - s.poslednja.y;
            if (dx || dy) {
                if (!s.pomereno) { s.snapshot = this.model.snapshot(); s.pomereno = true; }
                this.model.moveNodesLive(s.ids, dx, dy);
                s.poslednja = { x: nx, y: ny };
            }
            return;
        }

        if (s.vrsta === 'veza') {
            s.doTacka = tacka;
            const port = ev.target.closest && ev.target.closest('.port');
            s.kandidat = port ? `${port.getAttribute('data-node')}:${port.getAttribute('data-port')}` : null;
            this.crtajPrivremenuVezu();
            return;
        }

        if (s.vrsta === 'marquee') {
            s.kraj = tacka;
            this.crtajMarquee();
        }
    }

    pointerUp(ev) {
        const s = this.stanje;
        this.stanje = null;
        this.overlay.innerHTML = '';
        if (!s) return;

        if (s.vrsta === 'drag' && s.pomereno) {
            // upiši jedan undo unos za ceo drag umesto po pomeraju
            this.model.undoStack.push({ razlog: 'pomeri', data: s.snapshot });
            this.model.redoStack = [];
            this.model.emit('pomeri');
        }

        if (s.vrsta === 'veza') {
            const port = ev.target.closest && ev.target.closest('.port');
            if (port) {
                const cilj = `${port.getAttribute('data-node')}:${port.getAttribute('data-port')}`;
                const rez = this.model.addEdge(s.od, cilj);
                if (rez && rez.greska) this.onPoruka(rez.greska, 'greska');
                else if (rez) this.postaviIzbor([rez.id]);
            }
            this.render();
        }

        if (s.vrsta === 'marquee') {
            const x1 = Math.min(s.start.x, s.kraj.x), x2 = Math.max(s.start.x, s.kraj.x);
            const y1 = Math.min(s.start.y, s.kraj.y), y2 = Math.max(s.start.y, s.kraj.y);
            if (x2 - x1 > 4 || y2 - y1 > 4) {
                const pogodjeni = this.model.nodes.filter(n => {
                    const b = nodeBBox(n);
                    return b.x >= x1 && b.y >= y1 && b.x + b.w <= x2 && b.y + b.h <= y2;
                }).map(n => n.id);
                this.postaviIzbor([...(ev.ctrlKey || ev.metaKey ? this.izabrani : []), ...pogodjeni]);
            }
        }
    }

    wheel(ev) {
        ev.preventDefault();
        const r = this.svg.getBoundingClientRect();
        const mx = ev.clientX - r.left, my = ev.clientY - r.top;
        const faktor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        const novi = Math.min(4, Math.max(0.2, this.zoom * faktor));

        // zumiraj ka kursoru
        this.pan.x = mx - (mx - this.pan.x) * (novi / this.zoom);
        this.pan.y = my - (my - this.pan.y) * (novi / this.zoom);
        this.zoom = novi;
        this.render();
    }

    keyDown(ev) {
        const uPolju = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (uPolju) return;

        const mod = ev.ctrlKey || ev.metaKey;

        if (mod && ev.key.toLowerCase() === 'z') {
            ev.preventDefault();
            ev.shiftKey ? this.model.redo() : this.model.undo();
            this.postaviIzbor([]);
            return;
        }
        if (mod && ev.key.toLowerCase() === 'y') {
            ev.preventDefault();
            this.model.redo();
            return;
        }
        if (mod && ev.key.toLowerCase() === 'd') {
            ev.preventDefault();
            const novi = this.model.duplicateNodes([...this.izabrani]);
            if (novi && novi.length) this.postaviIzbor(novi);
            return;
        }
        if (ev.key === 'Delete' || ev.key === 'Backspace') {
            ev.preventDefault();
            this.obrisiIzabrano();
            return;
        }
        if (ev.key.toLowerCase() === 'r') {
            this.model.rotateNodes([...this.izabrani]);
            return;
        }
        if (ev.key === 'Escape') {
            this.stanje = null;
            this.overlay.innerHTML = '';
            this.postaviIzbor([]);
        }
    }

    obrisiIzabrano() {
        const ids = [...this.izabrani];
        const nodeIds = ids.filter(i => this.model.getNode(i));
        const edgeIds = ids.filter(i => this.model.getEdge(i));
        if (nodeIds.length) this.model.removeNodes(nodeIds);
        if (edgeIds.length) this.model.removeEdges(edgeIds);
        this.postaviIzbor([]);
    }

    // ── privremena grafika ───────────────────────────────────────────────────

    crtajPrivremenuVezu() {
        const s = this.stanje;
        if (!s) return;
        const t = `translate(${this.pan.x} ${this.pan.y}) scale(${this.zoom})`;
        const validan = s.kandidat ? this.model.proveriVezu(s.od, s.kandidat).ok : true;
        this.overlay.innerHTML = `<g transform="${t}">
            <path class="veza-privremena${validan ? '' : ' nevazeca'}"
                  d="M ${s.odTacka.x} ${s.odTacka.y} L ${s.doTacka.x} ${s.doTacka.y}"/>
        </g>`;
    }

    crtajMarquee() {
        const s = this.stanje;
        const x = Math.min(s.start.x, s.kraj.x), y = Math.min(s.start.y, s.kraj.y);
        const w = Math.abs(s.kraj.x - s.start.x), h = Math.abs(s.kraj.y - s.start.y);
        const t = `translate(${this.pan.x} ${this.pan.y}) scale(${this.zoom})`;
        this.overlay.innerHTML = `<g transform="${t}">
            <rect class="marquee" x="${x}" y="${y}" width="${w}" height="${h}"/>
        </g>`;
    }

    // ── pomoćne akcije ───────────────────────────────────────────────────────

    uklopiUProzor() {
        if (!this.model.nodes.length) return;
        const b = this.model.nodes.reduce((acc, n) => {
            const nb = nodeBBox(n);
            return {
                x1: Math.min(acc.x1, nb.x), y1: Math.min(acc.y1, nb.y),
                x2: Math.max(acc.x2, nb.x + nb.w), y2: Math.max(acc.y2, nb.y + nb.h)
            };
        }, { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });

        const r = this.svg.getBoundingClientRect();
        const m = 80;
        this.zoom = Math.min(2, Math.max(0.2,
            Math.min((r.width - m * 2) / (b.x2 - b.x1 || 1), (r.height - m * 2) / (b.y2 - b.y1 || 1))));
        this.pan.x = r.width / 2 - ((b.x1 + b.x2) / 2) * this.zoom;
        this.pan.y = r.height / 2 - ((b.y1 + b.y2) / 2) * this.zoom;
        this.render();
    }

    postaviZoom(z) {
        const r = this.svg.getBoundingClientRect();
        const cx = r.width / 2, cy = r.height / 2;
        const novi = Math.min(4, Math.max(0.2, z));
        this.pan.x = cx - (cx - this.pan.x) * (novi / this.zoom);
        this.pan.y = cy - (cy - this.pan.y) * (novi / this.zoom);
        this.zoom = novi;
        this.render();
    }
}
