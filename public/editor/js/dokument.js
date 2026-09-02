/**
 * Zajednička osnova za dokumente editora (jednopolna šema, string plan):
 * meta podaci, format lista, undo/redo i obaveštavanje o izmenama.
 *
 * Nasleđene klase definišu samo `stanje()` i `primeniStanje()` — spisak
 * polja koja se čuvaju i vraćaju kroz undo.
 */

let brojac = 0;

export function noviId(prefix) {
    brojac += 1;
    return `${prefix}${Date.now().toString(36).slice(-4)}${brojac}`;
}

const MAX_UNDO = 100;

export class Dokument {
    constructor(data = {}, podrazumevanaMeta = {}) {
        this.version = 1;
        this.meta = Object.assign(
            { naziv: 'Nov crtež', investitor: '', lokacija: '', projektant: '', brojProjekta: '' },
            podrazumevanaMeta, data.meta);
        this.sheet = Object.assign({ format: 'A3', orijentacija: 'landscape' }, data.sheet);

        this.undoStack = [];
        this.redoStack = [];
        this.slusaoci = [];
    }

    // ── događaji ─────────────────────────────────────────────────────────────

    on(fn) { this.slusaoci.push(fn); return () => this.off(fn); }
    off(fn) { this.slusaoci = this.slusaoci.filter(f => f !== fn); }
    emit(razlog) { this.slusaoci.forEach(fn => fn(this, razlog)); }

    // ── undo / redo ──────────────────────────────────────────────────────────

    /** Nasleđene klase vraćaju objekat sa poljima koja ulaze u undo. */
    stanje() { return { meta: this.meta, sheet: this.sheet }; }

    primeniStanje(d) {
        this.meta = d.meta;
        this.sheet = d.sheet;
    }

    snapshot() { return JSON.stringify(this.stanje()); }

    restore(json) { this.primeniStanje(JSON.parse(json)); }

    /** Izvrši izmenu uz snimanje snapshot-a za undo. */
    commit(razlog, fn) {
        const pre = this.snapshot();
        const rezultat = fn();
        this.undoStack.push({ razlog, data: pre });
        if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
        this.redoStack = [];
        this.emit(razlog);
        return rezultat;
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
}
