/**
 * Interaktivni canvas string plana.
 *
 * Alati:
 *   izbor       - biranje i pomeranje krovnih ravni
 *   boji        - dodela modula aktivnom stringu prevlačenjem
 *   iskljuci    - isključivanje modula (dimnjak, prozor, senka)
 *   podloga     - pomeranje učitanog snimka krova
 *   kalibracija - povlačenje duži poznate dužine radi razmere podloge
 */

import { planSvg, planBBox } from './plan-render.js';
import { PPM, merePolja } from './plan-model.js';

const SNAP = 0.05;    // metara

export class PlanCanvas {
    constructor(host, model, opcije = {}) {
        this.host = host;
        this.model = model;
        this.onIzbor = opcije.onIzbor || (() => {});
        this.onPoruka = opcije.onPoruka || (() => {});
        this.onKalibracija = opcije.onKalibracija || (() => {});

        this.izabrani = new Set();
        this.alat = 'izbor';
        this.aktivniString = null;

        this.pan = { x: 100, y: 80 };
        this.zoom = 0.5;
        this.stanje = null;

        this.host.innerHTML = `
            <svg class="platno" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="plan-grid" width="${PPM}" height="${PPM}" patternUnits="userSpaceOnUse">
                        <path d="M ${PPM} 0 L 0 0 0 ${PPM}" fill="none" stroke="#e2e8f0" stroke-width="1"/>
                    </pattern>
                </defs>
                <rect class="pozadina" x="-100000" y="-100000" width="200000" height="200000" fill="url(#plan-grid)"/>
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

    /** Ekran -> koordinate crteža (px). */
    uCrtez(ev) {
        const r = this.svg.getBoundingClientRect();
        return {
            x: (ev.clientX - r.left - this.pan.x) / this.zoom,
            y: (ev.clientY - r.top - this.pan.y) / this.zoom
        };
    }

    /** Ekran -> metri. */
    uMetre(ev) {
        const t = this.uCrtez(ev);
        return { x: t.x / PPM, y: t.y / PPM };
    }

    naSnap(v) { return Math.round(v / SNAP) * SNAP; }

    // ── render ───────────────────────────────────────────────────────────────

    render() {
        const t = `translate(${this.pan.x} ${this.pan.y}) scale(${this.zoom})`;
        this.viewport.setAttribute('transform', t);
        this.pozadinaEl.setAttribute('transform', t);
        this.viewport.innerHTML = planSvg(this.model, {
            izabrani: [...this.izabrani],
            interaktivan: true
        });
        this.svg.setAttribute('data-alat', this.alat);
    }

    postaviIzbor(ids) {
        this.izabrani = new Set(ids);
        this.render();
        this.onIzbor([...this.izabrani]);
    }

    postaviAlat(alat) {
        this.alat = alat;
        this.render();
    }

    // ── događaji ─────────────────────────────────────────────────────────────

    vezi() {
        this.svg.addEventListener('pointerdown', e => this.pointerDown(e));
        window.addEventListener('pointermove', e => this.pointerMove(e));
        window.addEventListener('pointerup', e => this.pointerUp(e));
        this.svg.addEventListener('wheel', e => this.wheel(e), { passive: false });
        this.svg.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('keydown', e => this.keyDown(e));
    }

    modulIzDogadjaja(ev) {
        const modulEl = ev.target.closest && ev.target.closest('.modul');
        const poljeEl = ev.target.closest && ev.target.closest('.polje');
        if (!modulEl || !poljeEl) return null;
        return {
            poljeId: poljeEl.getAttribute('data-id'),
            r: parseInt(modulEl.getAttribute('data-r'), 10),
            c: parseInt(modulEl.getAttribute('data-c'), 10)
        };
    }

    pointerDown(ev) {
        const tacka = this.uMetre(ev);

        // pomeranje pogleda: srednji/desni taster ili Shift na podlozi
        const poljeEl = ev.target.closest('.polje');
        if (ev.button === 1 || ev.button === 2 || (ev.shiftKey && !poljeEl)) {
            this.stanje = { vrsta: 'pan', start: { x: ev.clientX, y: ev.clientY }, pan: { ...this.pan } };
            return;
        }

        if (this.alat === 'kalibracija') {
            this.stanje = { vrsta: 'kalibracija', od: tacka, do: tacka };
            return;
        }

        if (this.alat === 'podloga') {
            if (!this.model.podloga.slika) { this.onPoruka('Prvo učitaj snimak krova.', 'greska'); return; }
            this.stanje = {
                vrsta: 'podloga',
                poslednja: tacka,
                pocetak: { x: this.model.podloga.x, y: this.model.podloga.y },
                pomereno: false
            };
            return;
        }

        if (this.alat === 'boji' || this.alat === 'iskljuci') {
            const m = this.modulIzDogadjaja(ev);
            if (!m) return;

            const polje = this.model.getPolje(m.poljeId);
            const trenutno = this.model.stanjeModula(polje, m.r, m.c);

            // Prvi klik određuje smer poteza: ako je modul već takav, potez briše.
            let izmena;
            if (this.alat === 'iskljuci') {
                izmena = { iskljucen: !trenutno.iskljucen };
            } else {
                if (!this.aktivniString) { this.onPoruka('Izaberi aktivan string u panelu.', 'greska'); return; }
                izmena = trenutno.string === this.aktivniString
                    ? { string: null }
                    : { string: this.aktivniString, iskljucen: false };
            }

            this.stanje = { vrsta: 'boji', izmena, snapshot: this.model.snapshot(), promenjeno: false };
            this.primeniNaModul(m);
            return;
        }

        // alat "izbor"
        if (poljeEl) {
            const id = poljeEl.getAttribute('data-id');
            if (ev.ctrlKey || ev.metaKey) {
                this.izabrani.has(id) ? this.izabrani.delete(id) : this.izabrani.add(id);
                this.postaviIzbor([...this.izabrani]);
            } else if (!this.izabrani.has(id)) {
                this.postaviIzbor([id]);
            }
            this.stanje = {
                vrsta: 'drag',
                ids: [...this.izabrani],
                poslednja: { x: this.naSnap(tacka.x), y: this.naSnap(tacka.y) },
                pomereno: false
            };
            return;
        }

        this.stanje = { vrsta: 'marquee', start: tacka, kraj: tacka };
        if (!ev.ctrlKey && !ev.metaKey) this.postaviIzbor([]);
    }

    primeniNaModul(m) {
        const s = this.stanje;
        if (!s || s.vrsta !== 'boji') return;
        if (this.model.postaviModulLive(m.poljeId, m.r, m.c, s.izmena)) {
            s.promenjeno = true;
            this.render();
        }
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

        const tacka = this.uMetre(ev);

        if (s.vrsta === 'drag') {
            const nx = this.naSnap(tacka.x), ny = this.naSnap(tacka.y);
            const dx = nx - s.poslednja.x, dy = ny - s.poslednja.y;
            if (dx || dy) {
                if (!s.pomereno) { s.snapshot = this.model.snapshot(); s.pomereno = true; }
                this.model.movePoljaLive(s.ids, dx, dy);
                s.poslednja = { x: nx, y: ny };
            }
            return;
        }

        if (s.vrsta === 'podloga') {
            const dx = tacka.x - s.poslednja.x, dy = tacka.y - s.poslednja.y;
            if (dx || dy) {
                if (!s.pomereno) { s.snapshot = this.model.snapshot(); s.pomereno = true; }
                this.model.podloga.x += dx;
                this.model.podloga.y += dy;
                s.poslednja = tacka;
                this.render();
            }
            return;
        }

        if (s.vrsta === 'boji') {
            const m = this.modulIzDogadjaja(ev);
            if (m) this.primeniNaModul(m);
            return;
        }

        if (s.vrsta === 'kalibracija') {
            s.do = tacka;
            this.crtajKalibraciju();
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
        if (!s) return;

        if ((s.vrsta === 'drag' || s.vrsta === 'podloga' || s.vrsta === 'boji') && (s.pomereno || s.promenjeno)) {
            // ceo potez ulazi u undo kao jedan korak
            this.model.undoStack.push({ razlog: s.vrsta, data: s.snapshot });
            this.model.redoStack = [];
            this.model.emit(s.vrsta);
        }

        if (s.vrsta === 'kalibracija') {
            this.overlay.innerHTML = '';
            const duzina = Math.hypot(s.do.x - s.od.x, s.do.y - s.od.y);
            if (duzina > 0.01) this.onKalibracija(duzina, s.od, s.do);
            return;
        }

        if (s.vrsta === 'marquee') {
            this.overlay.innerHTML = '';
            const x1 = Math.min(s.start.x, s.kraj.x), x2 = Math.max(s.start.x, s.kraj.x);
            const y1 = Math.min(s.start.y, s.kraj.y), y2 = Math.max(s.start.y, s.kraj.y);
            if (x2 - x1 > 0.1 || y2 - y1 > 0.1) {
                const pogodjeni = this.model.polja.filter(p => {
                    const [pw, ph] = merePolja(this.model, p);
                    return p.pos.x >= x1 && p.pos.y >= y1 && p.pos.x + pw <= x2 && p.pos.y + ph <= y2;
                }).map(p => p.id);
                this.postaviIzbor([...(ev.ctrlKey || ev.metaKey ? this.izabrani : []), ...pogodjeni]);
            }
        }

        this.overlay.innerHTML = '';
    }

    wheel(ev) {
        ev.preventDefault();
        const r = this.svg.getBoundingClientRect();
        const mx = ev.clientX - r.left, my = ev.clientY - r.top;
        const faktor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        const novi = Math.min(6, Math.max(0.05, this.zoom * faktor));

        this.pan.x = mx - (mx - this.pan.x) * (novi / this.zoom);
        this.pan.y = my - (my - this.pan.y) * (novi / this.zoom);
        this.zoom = novi;
        this.render();
    }

    keyDown(ev) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
        const mod = ev.ctrlKey || ev.metaKey;

        if (mod && ev.key.toLowerCase() === 'z') {
            ev.preventDefault();
            ev.shiftKey ? this.model.redo() : this.model.undo();
            this.postaviIzbor([]);
            return;
        }
        if (ev.key === 'Delete' || ev.key === 'Backspace') {
            ev.preventDefault();
            if (this.izabrani.size) {
                this.model.removePolja([...this.izabrani]);
                this.postaviIzbor([]);
            }
            return;
        }
        if (ev.key.toLowerCase() === 'r' && this.izabrani.size) {
            // krovne ravni retko stoje pod pravim uglom — rotacija ide po 15°
            const korak = ev.shiftKey ? -15 : 15;
            this.model.commit('rotiraj polje', () => {
                this.izabrani.forEach(id => {
                    const p = this.model.getPolje(id);
                    if (p) p.rot = ((p.rot || 0) + korak + 360) % 360;
                });
            });
            return;
        }
        if (ev.key === 'Escape') {
            this.stanje = null;
            this.overlay.innerHTML = '';
            this.postaviIzbor([]);
        }
    }

    // ── privremena grafika ───────────────────────────────────────────────────

    crtajKalibraciju() {
        const s = this.stanje;
        const t = `translate(${this.pan.x} ${this.pan.y}) scale(${this.zoom})`;
        const duzina = Math.hypot(s.do.x - s.od.x, s.do.y - s.od.y);
        this.overlay.innerHTML = `<g transform="${t}">
            <line class="kalibracija" x1="${s.od.x * PPM}" y1="${s.od.y * PPM}"
                  x2="${s.do.x * PPM}" y2="${s.do.y * PPM}"/>
            <text class="kalibracija-tekst" x="${(s.od.x + s.do.x) / 2 * PPM}" y="${(s.od.y + s.do.y) / 2 * PPM - 8}"
                  text-anchor="middle">${duzina.toFixed(2)} m</text>
        </g>`;
    }

    crtajMarquee() {
        const s = this.stanje;
        const x = Math.min(s.start.x, s.kraj.x) * PPM, y = Math.min(s.start.y, s.kraj.y) * PPM;
        const w = Math.abs(s.kraj.x - s.start.x) * PPM, h = Math.abs(s.kraj.y - s.start.y) * PPM;
        const t = `translate(${this.pan.x} ${this.pan.y}) scale(${this.zoom})`;
        this.overlay.innerHTML = `<g transform="${t}">
            <rect class="marquee" x="${x}" y="${y}" width="${w}" height="${h}"/>
        </g>`;
    }

    // ── pogled ───────────────────────────────────────────────────────────────

    uklopiUProzor() {
        const b = planBBox(this.model, 1);
        const r = this.svg.getBoundingClientRect();
        const m = 60;
        this.zoom = Math.min(3, Math.max(0.05,
            Math.min((r.width - m * 2) / (b.w || 1), (r.height - m * 2) / (b.h || 1))));
        this.pan.x = r.width / 2 - (b.x + b.w / 2) * this.zoom;
        this.pan.y = r.height / 2 - (b.y + b.h / 2) * this.zoom;
        this.render();
    }

    postaviZoom(z) {
        const r = this.svg.getBoundingClientRect();
        const cx = r.width / 2, cy = r.height / 2;
        const novi = Math.min(6, Math.max(0.05, z));
        this.pan.x = cx - (cx - this.pan.x) * (novi / this.zoom);
        this.pan.y = cy - (cy - this.pan.y) * (novi / this.zoom);
        this.zoom = novi;
        this.render();
    }
}
