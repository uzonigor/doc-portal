/**
 * Raspoređivanje natpisa na crtežu.
 *
 * Natpisi se generišu po grani i po elementu, nezavisno jedan od drugog, pa
 * se sudaraju kad dve grane prođu blizu. Svaki natpis zato prijavi svoj
 * pravougaonik; ako je mesto zauzeto, pomera se dok ne nađe slobodno.
 */

const VISINA_TEKSTA = 12;
const SIRINA_ZNAKA = 5.2;
const MAX_POKUSAJA = 8;

function pravougaonik(x, y, tekst, poravnanje) {
    const w = String(tekst).length * SIRINA_ZNAKA;
    const levo = poravnanje === 'middle' ? x - w / 2 : (poravnanje === 'end' ? x - w : x);
    return { x: levo, y: y - VISINA_TEKSTA + 3, w, h: VISINA_TEKSTA };
}

function seku(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Vrati slobodno y za natpis i zabeleži zauzeto mesto.
 * @param {Array} zauzeti - zajednička evidencija; bez nje se ništa ne pomera
 * @param {number} smer - 1 pomera naniže, -1 naviše
 */
export function mesto(zauzeti, x, y, tekst, poravnanje = 'middle', smer = 1) {
    if (!zauzeti) return y;

    for (let i = 0; i < MAX_POKUSAJA; i++) {
        const pomeren = y + i * smer * (VISINA_TEKSTA + 2);
        const r = pravougaonik(x, pomeren, tekst, poravnanje);
        if (!zauzeti.some(z => seku(z, r))) {
            zauzeti.push(r);
            return pomeren;
        }
    }

    zauzeti.push(pravougaonik(x, y, tekst, poravnanje));
    return y;
}

/** Zauzmi mesto koje nije natpis (telo elementa), da natpisi idu oko njega. */
export function zauzmi(zauzeti, x, y, w, h) {
    if (zauzeti) zauzeti.push({ x, y, w, h });
}

/**
 * Da li granu treba obeležiti.
 *
 * Obeležava se samo tamo gde se nešto MENJA: drugi sistem, druge žile ili
 * drugi kabl nego na grani koja u taj čvor ulazi. Inače bi se isti podatak
 * ponovio na svakoj deonici i natpisi bi se sudarali.
 */
function potpisGrane(e) {
    const k = e.cable || {};
    return `${e.system}|${(e.conductors || []).join(',')}|${k.tip || ''}|${k.presek || ''}`;
}

export function trebaOznaka(model, edge) {
    const izvor = edge.from.split(':')[0];
    const ulazne = model.edges.filter(e => e.to.split(':')[0] === izvor);
    if (!ulazne.length) return true;
    return !ulazne.some(e => potpisGrane(e) === potpisGrane(edge));
}
