/**
 * Proračun kablova nad jednopolnom šemom.
 *
 * Za svaku granu se iz grafa nađe izvor napajanja — PV niz na DC strani,
 * odnosno inverter(i) na AC strani — pa se odatle uzimaju napon i struja.
 * Dužina dolazi iz modela (izmerena na string planu ili uneta ručno).
 */

import { getSymbol } from './symbols.js';
import { predlogPreseka, proveriPresek, strujaAC, PODRAZUMEVANI_PARAMETRI } from './proracun.js';

const NAPON_AC = { AC3: 400, AC1: 230 };

/** Čvorovi od kojih grana dobija napajanje (obilazak unazad po granama). */
function izvoriZaGranu(model, edge) {
    const posetjeni = new Set();
    const izvori = [];
    const red = [edge.from.split(':')[0]];

    while (red.length) {
        const id = red.shift();
        if (posetjeni.has(id)) continue;
        posetjeni.add(id);

        const n = model.getNode(id);
        if (!n) continue;
        izvori.push(n);

        model.edges.forEach(e => {
            if (e.to.split(':')[0] === id) red.push(e.from.split(':')[0]);
        });
    }

    return izvori;
}

/** Radni podaci grane: napon, struja i struja za opteretljivost. */
export function podaciGrane(model, edge, par) {
    const izvori = izvoriZaGranu(model, edge);

    if (edge.system === 'DC') {
        const niz = izvori.find(n => n.type === 'pv_string' || n.type === 'pv_modul');
        if (!niz) return null;

        const modula = niz.type === 'pv_string' ? (niz.props.modula || 0) : 1;
        const napon = modula * (niz.props.vmpp || 0);
        return {
            napon,
            struja: niz.props.impp || 0,
            strujaZastite: (niz.props.isc || 0) * 1.25,
            izvor: niz.oznaka,
            dozvoljenPad: par.padDC,
            tipKabla: edge.cable?.tip || 'PV1-F'
        };
    }

    if (edge.system === 'AC1' || edge.system === 'AC3') {
        const inverteri = izvori.filter(n => n.type === 'inverter_1f' || n.type === 'inverter_3f');
        if (!inverteri.length) return null;

        const snaga = inverteri.reduce((z, n) => z + (n.props.snaga || 0), 0);
        const napon = NAPON_AC[edge.system];
        const struja = strujaAC(snaga, edge.system, napon, par.cosFi);

        // Kabl mora izdržati struju prekidača koji ga štiti. Kod PV instalacije
        // taj prekidač je nizvodno od invertera (inverter je izvor), pa se gleda
        // i na krajevima same grane, ne samo uzvodno.
        const susedi = [edge.from, edge.to]
            .map(r => model.getNode(r.split(':')[0]))
            .filter(Boolean);

        const prekidaci = [...susedi, ...izvori]
            .filter(n => n.type === 'ac_prekidac' && n.props.struja > 0);

        const strujaZastite = prekidaci.length
            ? Math.max(...prekidaci.map(n => n.props.struja))
            : struja * 1.25;

        return {
            napon,
            struja,
            strujaZastite,
            snaga,
            izvor: inverteri.map(n => n.oznaka).join(', '),
            dozvoljenPad: par.padAC,
            tipKabla: edge.cable?.tip || 'NYY-J'
        };
    }

    return null;   // PE vod se ne dimenzioniše padom napona
}

/**
 * Proračun za sve grane.
 * @returns {Array} red po grani: podaci, predlog i provera zadatog preseka
 */
export function proracunKablova(model, parametri = {}) {
    const par = { ...PODRAZUMEVANI_PARAMETRI, ...parametri };

    return model.edges.map(edge => {
        const a = model.getNode(edge.from.split(':')[0]);
        const b = model.getNode(edge.to.split(':')[0]);
        const duzina = parseFloat(edge.cable?.duzina) || 0;
        const zadati = parseFloat(edge.cable?.presek) || null;

        const osnova = {
            edgeId: edge.id,
            oznaka: edge.oznaka || '',
            od: a ? a.oznaka : '?',
            do: b ? b.oznaka : '?',
            sistem: edge.system,
            duzina,
            zadatiPresek: zadati
        };

        if (edge.system === 'PE') {
            return { ...osnova, napomena: 'Zaštitni provodnik — presek se bira prema faznom.' };
        }

        const p = podaciGrane(model, edge, par);
        if (!p) return { ...osnova, napomena: 'Izvor napajanja se ne može odrediti iz šeme.' };

        if (!duzina) {
            return { ...osnova, ...p, napomena: 'Nema dužine — unesi je ili prenesi sa string plana.' };
        }

        const predlog = predlogPreseka({
            sistem: edge.system, duzina, struja: p.struja, strujaZastite: p.strujaZastite,
            napon: p.napon, dozvoljenPad: p.dozvoljenPad, tipKabla: p.tipKabla
        }, par);

        const provera = zadati
            ? proveriPresek({
                sistem: edge.system, duzina, struja: p.struja, strujaZastite: p.strujaZastite,
                napon: p.napon, dozvoljenPad: p.dozvoljenPad, tipKabla: p.tipKabla
            }, zadati, par)
            : null;

        return { ...osnova, ...p, predlog, provera };
    });
}

/** Upiši predložene preseke u model (jedan undo korak). */
export function primeniPredloge(model, redovi) {
    const izmene = redovi.filter(r => r.predlog && r.predlog.presek && r.predlog.presek !== r.zadatiPresek);
    if (!izmene.length) return 0;

    model.commit('primeni predložene preseke', () => {
        izmene.forEach(r => {
            const e = model.getEdge(r.edgeId);
            if (e) e.cable.presek = r.predlog.presek;
        });
    });

    return izmene.length;
}

export { getSymbol };
