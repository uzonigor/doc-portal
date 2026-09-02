/**
 * Graf model šeme.
 *
 * Editor NE crta linije — editor modeluje električni graf. Iz istog modela
 * se renderuje jednopolna šema, tropolna šema, tabela kablova i specifikacija.
 * Zbog toga svaka grana nosi listu žila (conductors), a ne samo geometriju.
 */

import { getSymbol, defaultProps, portPosition, nodeBBox } from './symbols.js';

let brojac = 0;
function noviId(prefix) {
    brojac += 1;
    return `${prefix}${Date.now().toString(36).slice(-4)}${brojac}`;
}

export const ZILE = {
    DC: ['L+', 'L-'],
    AC1: ['L', 'N', 'PE'],
    AC3: ['L1', 'L2', 'L3', 'N', 'PE'],
    PE: ['PE']
};

/**
 * Da li je element trofazni — po postojanju L3 porta ili po parametrima
 * (broj polova / broj faza). Iz toga se izvodi broj žila na grani.
 */
function jeTrofazni(node) {
    if (!node) return false;
    if (Object.keys(getSymbol(node.type).ports).includes('L3')) return true;
    const polova = String(node.props?.polova ?? '');
    if (/^(3P|4P)/.test(polova) || polova === '3' || polova === '4') return true;
    if (String(node.props?.faza ?? '') === '3') return true;
    return false;
}

export class Model {
    constructor(data) {
        const d = data || {};
        this.version = 1;
        this.meta = Object.assign({ naziv: 'Nova šema', standard: 'IEC-60617', projektant: '', brojProjekta: '' }, d.meta);
        this.sheet = Object.assign({ format: 'A3', orijentacija: 'landscape' }, d.sheet);
        this.nodes = (d.nodes || []).map(n => ({ ...n, props: { ...n.props } }));
        this.edges = (d.edges || []).map(e => ({ ...e }));

        this.undoStack = [];
        this.redoStack = [];
        this.slusaoci = [];
    }

    // ── događaji ─────────────────────────────────────────────────────────────

    on(fn) { this.slusaoci.push(fn); return () => this.off(fn); }
    off(fn) { this.slusaoci = this.slusaoci.filter(f => f !== fn); }
    emit(razlog) { this.slusaoci.forEach(fn => fn(this, razlog)); }

    // ── undo / redo ──────────────────────────────────────────────────────────

    /** Izvrši izmenu uz snimanje snapshot-a za undo. */
    commit(razlog, fn) {
        const pre = this.snapshot();
        const rezultat = fn();
        this.undoStack.push({ razlog, data: pre });
        if (this.undoStack.length > 100) this.undoStack.shift();
        this.redoStack = [];
        this.emit(razlog);
        return rezultat;
    }

    snapshot() {
        return JSON.stringify({ nodes: this.nodes, edges: this.edges, meta: this.meta, sheet: this.sheet });
    }

    restore(json) {
        const d = JSON.parse(json);
        this.nodes = d.nodes;
        this.edges = d.edges;
        this.meta = d.meta;
        this.sheet = d.sheet;
    }

    undo() {
        const stavka = this.undoStack.pop();
        if (!stavka) return false;
        this.redoStack.push({ razlog: stavka.razlog, data: this.snapshot() });
        this.restore(stavka.data);
        this.emit('undo');
        return true;
    }

    redo() {
        const stavka = this.redoStack.pop();
        if (!stavka) return false;
        this.undoStack.push({ razlog: stavka.razlog, data: this.snapshot() });
        this.restore(stavka.data);
        this.emit('redo');
        return true;
    }

    // ── čvorovi ──────────────────────────────────────────────────────────────

    getNode(id) { return this.nodes.find(n => n.id === id) || null; }

    /** Sledeća slobodna poziciona oznaka za tip simbola (-Q1, -Q2 ...). */
    sledecaOznaka(type) {
        const prefix = getSymbol(type).oznaka || 'X';
        const uzete = this.nodes
            .map(n => n.oznaka)
            .filter(o => o && o.startsWith('-' + prefix))
            .map(o => parseInt(o.slice(1 + prefix.length), 10))
            .filter(n => !Number.isNaN(n));
        const sledeci = uzete.length ? Math.max(...uzete) + 1 : 1;
        return `-${prefix}${sledeci}`;
    }

    addNode(type, pos) {
        return this.commit('dodaj element', () => {
            const node = {
                id: noviId('n'),
                type,
                oznaka: this.sledecaOznaka(type),
                label: getSymbol(type).naziv,
                pos: { x: pos.x, y: pos.y },
                rot: 0,
                props: defaultProps(type)
            };
            this.nodes.push(node);
            return node;
        });
    }

    removeNodes(ids) {
        const set = new Set(ids);
        return this.commit('obriši element', () => {
            this.nodes = this.nodes.filter(n => !set.has(n.id));
            this.edges = this.edges.filter(e => !set.has(e.from.split(':')[0]) && !set.has(e.to.split(':')[0]));
        });
    }

    /** Pomeranje bez commit-a (poziva se tokom drag-a); commit ide na kraju. */
    moveNodesLive(ids, dx, dy) {
        const set = new Set(ids);
        this.nodes.forEach(n => {
            if (set.has(n.id)) { n.pos.x += dx; n.pos.y += dy; }
        });
        this.emit('pomeri-live');
    }

    rotateNodes(ids) {
        const set = new Set(ids);
        return this.commit('rotiraj', () => {
            this.nodes.forEach(n => {
                if (set.has(n.id)) n.rot = ((n.rot || 0) + 90) % 360;
            });
        });
    }

    setNodeProp(id, key, value) {
        return this.commit('izmeni parametar', () => {
            const n = this.getNode(id);
            if (!n) return;
            if (key === 'label' || key === 'oznaka') n[key] = value;
            else n.props[key] = value;
        });
    }

    duplicateNodes(ids) {
        const set = new Set(ids);
        return this.commit('dupliraj', () => {
            const novi = [];
            this.nodes.filter(n => set.has(n.id)).forEach(n => {
                const kopija = {
                    ...n,
                    id: noviId('n'),
                    oznaka: this.sledecaOznaka(n.type),
                    pos: { x: n.pos.x + 20, y: n.pos.y + 20 },
                    props: { ...n.props }
                };
                this.nodes.push(kopija);
                novi.push(kopija.id);
            });
            return novi;
        });
    }

    // ── grane (provodnici) ───────────────────────────────────────────────────

    getEdge(id) { return this.edges.find(e => e.id === id) || null; }

    /**
     * Da li se dva porta smeju spojiti.
     * Vraća { ok: true } ili { ok: false, razlog: '...' }.
     */
    proveriVezu(fromRef, toRef) {
        const [fn, fp] = fromRef.split(':');
        const [tn, tp] = toRef.split(':');

        if (fn === tn) return { ok: false, razlog: 'Ne može veza na isti element' };

        const a = this.getNode(fn), b = this.getNode(tn);
        if (!a || !b) return { ok: false, razlog: 'Element ne postoji' };

        const pa = getSymbol(a.type).ports[fp];
        const pb = getSymbol(b.type).ports[tp];
        if (!pa || !pb) return { ok: false, razlog: 'Port ne postoji' };

        if (pa.system !== pb.system) {
            return { ok: false, razlog: `Ne može spajati ${pa.system} i ${pb.system} port` };
        }

        const postoji = this.edges.some(e =>
            (e.from === fromRef && e.to === toRef) || (e.from === toRef && e.to === fromRef));
        if (postoji) return { ok: false, razlog: 'Veza već postoji' };

        return { ok: true, system: pa.system };
    }

    addEdge(fromRef, toRef) {
        const provera = this.proveriVezu(fromRef, toRef);
        if (!provera.ok) return { greska: provera.razlog };

        return this.commit('poveži', () => {
            const izvor = this.getNode(fromRef.split(':')[0]);
            const cilj = this.getNode(toRef.split(':')[0]);
            const trofazno = jeTrofazni(izvor) || jeTrofazni(cilj);

            // Veza ka uzemljenju / SPD odvodu nosi samo zaštitni provodnik.
            const zastitna = [fromRef, toRef].some(r => /:pe$/i.test(r));

            const system = zastitna ? 'PE' : (provera.system === 'DC' ? 'DC' : (trofazno ? 'AC3' : 'AC1'));
            const edge = {
                id: noviId('w'),
                from: fromRef,
                to: toRef,
                system,
                conductors: [...ZILE[system]],
                cable: system === 'DC'
                    ? { tip: 'PV1-F', presek: 6, duzina: 0 }
                    : (system === 'PE' ? { tip: 'H07V-K ž/z', presek: 6, duzina: 0 } : { tip: 'NYY-J', presek: 10, duzina: 0 }),
                waypoints: []
            };
            this.edges.push(edge);
            return edge;
        });
    }

    removeEdges(ids) {
        const set = new Set(ids);
        return this.commit('obriši provodnik', () => {
            this.edges = this.edges.filter(e => !set.has(e.id));
        });
    }

    setEdgeProp(id, putanja, value) {
        return this.commit('izmeni provodnik', () => {
            const e = this.getEdge(id);
            if (!e) return;
            if (putanja === 'system') {
                e.system = value;
                e.conductors = [...ZILE[value]];
            } else if (putanja.startsWith('cable.')) {
                e.cable[putanja.slice(6)] = value;
            } else {
                e[putanja] = value;
            }
        });
    }

    // ── upiti nad grafom ─────────────────────────────────────────────────────

    /** Krajnje tačke grane u koordinatama crteža. */
    edgeEndpoints(edge) {
        const [fn, fp] = edge.from.split(':');
        const [tn, tp] = edge.to.split(':');
        const a = this.getNode(fn), b = this.getNode(tn);
        if (!a || !b) return null;
        return { from: portPosition(a, fp), to: portPosition(b, tp) };
    }

    /** Prepreke za rutiranje: svi čvorovi osim ona dva koja grana spaja. */
    prepreke(izuzmi = []) {
        const set = new Set(izuzmi);
        return this.nodes.filter(n => !set.has(n.id)).map(nodeBBox);
    }

    /** Zauzetost porta — koristi se za vizuelni prikaz slobodnih priključaka. */
    portZauzet(nodeId, portId) {
        const ref = `${nodeId}:${portId}`;
        return this.edges.some(e => e.from === ref || e.to === ref);
    }

    /** Validacija modela — lista upozorenja za korisnika. */
    validate() {
        const poruke = [];

        this.nodes.forEach(n => {
            const def = getSymbol(n.type);
            const slobodni = Object.keys(def.ports).filter(p => !this.portZauzet(n.id, p));
            if (slobodni.length === Object.keys(def.ports).length && this.nodes.length > 1) {
                poruke.push({ nivo: 'upozorenje', nodeId: n.id, tekst: `${n.oznaka} ${n.label} nije povezan` });
            }
        });

        this.edges.forEach(e => {
            if (!this.getNode(e.from.split(':')[0]) || !this.getNode(e.to.split(':')[0])) {
                poruke.push({ nivo: 'greska', edgeId: e.id, tekst: 'Provodnik pokazuje na nepostojeći element' });
            }
            if (!e.cable || !e.cable.presek) {
                poruke.push({ nivo: 'upozorenje', edgeId: e.id, tekst: 'Provodniku nije zadat presek' });
            }
        });

        return poruke;
    }

    /** Ukupna DC snaga iz svih PV nizova i modula. */
    ukupnaSnagaDC() {
        return this.nodes.reduce((zbir, n) => {
            if (n.type === 'pv_string') return zbir + (n.props.modula || 0) * (n.props.pmax || 0) / 1000;
            if (n.type === 'pv_modul') return zbir + (n.props.pmax || 0) / 1000;
            return zbir;
        }, 0);
    }

    ukupnaSnagaAC() {
        return this.nodes.reduce((zbir, n) =>
            (n.type === 'inverter_1f' || n.type === 'inverter_3f') ? zbir + (n.props.snaga || 0) : zbir, 0);
    }

    toJSON() {
        return {
            version: this.version,
            meta: this.meta,
            sheet: this.sheet,
            nodes: this.nodes,
            edges: this.edges
        };
    }
}
