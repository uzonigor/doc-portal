/**
 * Ortogonalno rutiranje provodnika.
 *
 * Auto-rutiranje je PREDLOG, ne zakon: ako grana ima waypoints, oni su
 * obavezne prelomne tačke i putanja se računa po segmentima između njih.
 * Tako korisnik uvek može da nadjača automatiku.
 */

const KORAK = 10;          // rezolucija grid-a za A*
const MARGINA = 8;         // razmak koji provodnik drži od simbola
const IZLAZ = 14;          // dužina "pipka" na izlasku iz porta
const MAX_KORAKA = 20000;  // zaštita od patoloških slučajeva

const POMAK = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

function kljuc(x, y) { return `${x},${y}`; }

function uPrepreci(x, y, prepreke) {
    for (const p of prepreke) {
        if (x >= p.x - MARGINA && x <= p.x + p.w + MARGINA &&
            y >= p.y - MARGINA && y <= p.y + p.h + MARGINA) return true;
    }
    return false;
}

/** Da li duž (a→b, ortogonalna) preseca neku prepreku. */
function segmentSlobodan(a, b, prepreke) {
    const koraka = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / KORAK;
    const dx = (b.x - a.x) / (koraka || 1);
    const dy = (b.y - a.y) / (koraka || 1);
    for (let i = 0; i <= koraka; i++) {
        if (uPrepreci(a.x + dx * i, a.y + dy * i, prepreke)) return false;
    }
    return true;
}

/**
 * Razbij svaki kosi segment na dva prava.
 *
 * A* radi na gridu, pa spoj sa stvarnim krajem porta ume da ispadne kos.
 * Šema sme da ima samo vodoravne i uspravne poteze, pa je ovo završna
 * provera kroz koju prolazi svaka putanja.
 */
export function ortogonalizuj(tacke) {
    if (tacke.length < 2) return tacke;

    const out = [tacke[0]];
    let prethodnoHorizontalno = null;

    for (let i = 1; i < tacke.length; i++) {
        const a = out[out.length - 1], b = tacke[i];
        const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);

        if (dx < 0.01 || dy < 0.01) {
            out.push(b);
            if (dx > 0.01 || dy > 0.01) prethodnoHorizontalno = dx > dy;
            continue;
        }

        // smer prvog dela nastavlja prethodni potez, da se ne prave suvišni lomovi
        const prvoHorizontalno = prethodnoHorizontalno === null ? true : prethodnoHorizontalno;
        out.push(prvoHorizontalno ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
        out.push(b);
        prethodnoHorizontalno = !prvoHorizontalno;
    }

    return out;
}

/** Ukloni suvišne kolinearne tačke. */
function sazmi(tacke) {
    const out = [tacke[0]];
    for (let i = 1; i < tacke.length - 1; i++) {
        const a = out[out.length - 1], b = tacke[i], c = tacke[i + 1];
        const kolinearno = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
        if (!kolinearno) out.push(b);
    }
    out.push(tacke[tacke.length - 1]);
    return out;
}

function naGrid(v) { return Math.round(v / KORAK) * KORAK; }

/** Prosta L / Z putanja bez izbegavanja prepreka. */
function lRuta(a, b, aDir, bDir) {
    const horizontalanIzlaz = aDir === 'E' || aDir === 'W';
    const horizontalanUlaz = bDir === 'E' || bDir === 'W';

    if (horizontalanIzlaz && horizontalanUlaz) {
        const sredina = naGrid((a.x + b.x) / 2);
        return [a, { x: sredina, y: a.y }, { x: sredina, y: b.y }, b];
    }
    if (!horizontalanIzlaz && !horizontalanUlaz) {
        const sredina = naGrid((a.y + b.y) / 2);
        return [a, { x: a.x, y: sredina }, { x: b.x, y: sredina }, b];
    }
    if (horizontalanIzlaz) {
        return [a, { x: b.x, y: a.y }, b];
    }
    return [a, { x: a.x, y: b.y }, b];
}

/** A* na gridu — koristi se samo kada prosta putanja udara u simbol. */
function aStar(a, b, prepreke) {
    const minX = naGrid(Math.min(a.x, b.x) - 160);
    const maxX = naGrid(Math.max(a.x, b.x) + 160);
    const minY = naGrid(Math.min(a.y, b.y) - 160);
    const maxY = naGrid(Math.max(a.y, b.y) + 160);

    const start = { x: naGrid(a.x), y: naGrid(a.y) };
    const cilj = { x: naGrid(b.x), y: naGrid(b.y) };

    const h = (x, y) => Math.abs(x - cilj.x) + Math.abs(y - cilj.y);

    const otvoreni = [{ x: start.x, y: start.y, g: 0, f: h(start.x, start.y), dir: null }];
    const doslo = new Map();
    const najbolji = new Map([[kljuc(start.x, start.y), 0]]);
    let koraka = 0;

    while (otvoreni.length && koraka++ < MAX_KORAKA) {
        otvoreni.sort((p, q) => p.f - q.f);
        const cur = otvoreni.shift();

        if (cur.x === cilj.x && cur.y === cilj.y) {
            const putanja = [];
            let k = kljuc(cur.x, cur.y);
            let t = { x: cur.x, y: cur.y };
            while (t) {
                putanja.unshift(t);
                const prethodni = doslo.get(k);
                if (!prethodni) break;
                t = prethodni;
                k = kljuc(t.x, t.y);
            }
            return putanja;
        }

        for (const [dir, [dx, dy]] of Object.entries(POMAK)) {
            const nx = cur.x + dx * KORAK;
            const ny = cur.y + dy * KORAK;
            if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;

            const jeCilj = nx === cilj.x && ny === cilj.y;
            if (!jeCilj && uPrepreci(nx, ny, prepreke)) continue;

            // kazna za skretanje — traži putanje sa što manje lomova
            const g = cur.g + KORAK + (cur.dir && cur.dir !== dir ? KORAK * 3 : 0);
            const k = kljuc(nx, ny);
            if (najbolji.has(k) && najbolji.get(k) <= g) continue;

            najbolji.set(k, g);
            doslo.set(k, { x: cur.x, y: cur.y });
            otvoreni.push({ x: nx, y: ny, g, f: g + h(nx, ny), dir });
        }
    }

    return null;
}

/** Ruta između dve tačke sa poznatim smerovima izlaska. */
function rutaSegmenta(a, b, aDir, bDir, prepreke) {
    const prosta = lRuta(a, b, aDir, bDir);

    let cista = true;
    for (let i = 0; i < prosta.length - 1; i++) {
        if (!segmentSlobodan(prosta[i], prosta[i + 1], prepreke)) { cista = false; break; }
    }
    if (cista) return prosta;

    const nadjena = aStar(a, b, prepreke);
    return nadjena ? [a, ...nadjena.slice(1, -1), b] : prosta;
}

/**
 * Glavna funkcija.
 * @param {{x,y,dir}} from  - izlazni port
 * @param {{x,y,dir}} to    - ulazni port
 * @param {Array<{x,y}>} waypoints - ručne prelomne tačke (mogu biti prazne)
 * @param {Array<{x,y,w,h}>} prepreke
 * @param {object} opcije - { izlaz } dužina "pipka" na izlasku iz porta;
 *                          tropolna traži duži, da fan-out žila stane
 * @returns {Array<{x,y}>} tačke polilinije
 */
export function route(from, to, waypoints = [], prepreke = [], opcije = {}) {
    const duzinaIzlaza = opcije.izlaz ?? IZLAZ;
    const [ax, ay] = POMAK[from.dir] || [1, 0];
    const [bx, by] = POMAK[to.dir] || [-1, 0];

    const izlaz = { x: from.x + ax * duzinaIzlaza, y: from.y + ay * duzinaIzlaza };
    const ulaz = { x: to.x + bx * duzinaIzlaza, y: to.y + by * duzinaIzlaza };

    const tacke = [{ x: from.x, y: from.y }, izlaz];
    const sidra = [izlaz, ...waypoints, ulaz];

    for (let i = 0; i < sidra.length - 1; i++) {
        const aDir = i === 0 ? from.dir : null;
        const bDir = i === sidra.length - 2 ? suprotno(to.dir) : null;
        const seg = rutaSegmenta(sidra[i], sidra[i + 1], aDir || smerKa(sidra[i], sidra[i + 1]),
            bDir || smerKa(sidra[i + 1], sidra[i]), prepreke);
        tacke.push(...seg.slice(1));
    }

    tacke.push({ x: to.x, y: to.y });
    return sazmi(ortogonalizuj(tacke));
}

function suprotno(dir) {
    return { N: 'S', S: 'N', E: 'W', W: 'E' }[dir] || 'W';
}

function smerKa(a, b) {
    return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
        ? (b.x >= a.x ? 'E' : 'W')
        : (b.y >= a.y ? 'S' : 'N');
}

/**
 * Polilinija -> SVG path.
 * Podrazumevano su uglovi oštri, kako se i crtaju električne šeme;
 * `radijus > 0` ih zaobljava.
 */
export function pathD(tacke, radijus = 0) {
    if (tacke.length < 2) return '';
    let d = `M ${tacke[0].x} ${tacke[0].y}`;

    if (radijus <= 0) {
        return d + tacke.slice(1).map(t => ` L ${t.x} ${t.y}`).join('');
    }

    for (let i = 1; i < tacke.length - 1; i++) {
        const p = tacke[i - 1], c = tacke[i], n = tacke[i + 1];
        const r = Math.min(radijus,
            Math.hypot(c.x - p.x, c.y - p.y) / 2,
            Math.hypot(n.x - c.x, n.y - c.y) / 2);

        const u = normalizuj(p, c), v = normalizuj(n, c);
        d += ` L ${c.x + u.x * r} ${c.y + u.y * r}`;
        d += ` Q ${c.x} ${c.y} ${c.x - v.x * r} ${c.y - v.y * r}`;
    }

    const z = tacke[tacke.length - 1];
    d += ` L ${z.x} ${z.y}`;
    return d;
}

function normalizuj(od, ka) {
    const dx = od.x - ka.x, dy = od.y - ka.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
}
