/**
 * Deterministički raspored: logičke koordinate (kolona, red) -> pozicije u crtežu.
 *
 * Generator ne računa piksele — on samo kaže "ovaj element je u koloni 2,
 * u redu 1". Raspored zatim poravnava kolone po najširem simbolu i redove
 * po najvišem, pa crtež ostaje čitljiv i kad se promeni broj stringova.
 *
 * Red sme biti razlomljen (npr. 0.5) kada element stoji između dva reda —
 * tipično inverter koji prima dva MPPT-a.
 */

import { getSymbol } from './symbols.js';

const RAZMAK_KOLONA = 110;
const RAZMAK_REDOVA = 60;

/**
 * @param {Array} stavke - objekti sa { type, kol, red } (i bilo čime drugim)
 * @returns iste stavke, dopunjene sa pos: { x, y }
 */
export function rasporedi(stavke, opcije = {}) {
    if (!stavke.length) return stavke;

    const razmakKolona = opcije.razmakKolona ?? RAZMAK_KOLONA;
    const razmakRedova = opcije.razmakRedova ?? RAZMAK_REDOVA;

    const dim = (s) => getSymbol(s.type).size;

    // ── kolone: širina = najširi simbol u koloni ─────────────────────────────
    const kolone = [...new Set(stavke.map(s => s.kol))].sort((a, b) => a - b);
    const sirinaKolone = new Map();
    kolone.forEach(k => {
        const u = stavke.filter(s => s.kol === k);
        sirinaKolone.set(k, Math.max(...u.map(s => dim(s)[0])));
    });

    const xKolone = new Map();
    let x = 0;
    kolone.forEach(k => {
        xKolone.set(k, x);
        x += sirinaKolone.get(k) + razmakKolona;
    });

    // ── redovi: visina = najviši simbol u redu ───────────────────────────────
    const celiRedovi = [...new Set(stavke.map(s => Math.floor(s.red)))].sort((a, b) => a - b);
    const visinaReda = new Map();
    celiRedovi.forEach(r => {
        const u = stavke.filter(s => Math.floor(s.red) === r);
        visinaReda.set(r, Math.max(...u.map(s => dim(s)[1])));
    });

    const yReda = new Map();
    let y = 0;
    celiRedovi.forEach(r => {
        yReda.set(r, y);
        y += visinaReda.get(r) + razmakRedova;
    });

    /** Gornja ivica trake za (moguće razlomljen) red. */
    function yZaRed(red) {
        const donji = Math.floor(red);
        const frakcija = red - donji;
        if (!frakcija) return yReda.get(donji) ?? donji * (razmakRedova + 60);

        const gornji = donji + 1;
        const a = yReda.get(donji) ?? 0;
        const b = yReda.has(gornji)
            ? yReda.get(gornji)
            : a + (visinaReda.get(donji) || 0) + razmakRedova;
        return a + (b - a) * frakcija;
    }

    stavke.forEach(s => {
        const [w, h] = dim(s);
        const trakaX = xKolone.get(s.kol);
        const trakaW = sirinaKolone.get(s.kol);
        const trakaY = yZaRed(s.red);
        const trakaH = visinaReda.get(Math.floor(s.red)) || h;

        // element se centrira unutar svoje trake
        s.pos = {
            x: Math.round((trakaX + (trakaW - w) / 2) / 10) * 10,
            y: Math.round((trakaY + (trakaH - h) / 2) / 10) * 10
        };
    });

    return stavke;
}
