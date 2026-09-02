/**
 * Provere DC ulaza invertera.
 *
 * Ovo su granice koje obaraju projekat: napon preko Udc,max uništava
 * inverter, napon ispod MPPT opsega znači da elektrana ujutru ne kreće, a
 * struja preko dozvoljene znači da ulaz ne prihvata string.
 *
 * Napon se proverava na dva ekstrema:
 *   Voc na NAJHLADNIJEM danu  -> gornja granica (Udc,max, MPPT max)
 *   Vmpp na NAJTOPLIJEM danu  -> donja granica (MPPT min)
 *
 * Faktor je 1 + (T − 25) · β / 100, gde je β temperaturni koeficijent napona
 * (negativan, tipično −0,29 %/K). Na −10 °C to daje ~1,10, na 70 °C ~0,87.
 */

export const PODRAZUMEVANE_TEMPERATURE = {
    tempMin: -10,        // °C — najhladniji radni dan
    tempMax: 70,         // °C — temperatura ćelije na najtoplijem danu
    koefNapona: -0.29    // %/K — temperaturni koeficijent napona
};

export function faktorNapona(temperatura, koef) {
    return 1 + ((temperatura - 25) * (koef ?? PODRAZUMEVANE_TEMPERATURE.koefNapona)) / 100;
}

/** Voc niza na najhladnijem danu — merodavan za Udc,max. */
export function vocHladno(modula, voc, p = {}) {
    return modula * voc * faktorNapona(p.tempMin ?? PODRAZUMEVANE_TEMPERATURE.tempMin, p.koefNapona);
}

/** Umpp niza na najtoplijem danu — merodavan za donju granicu MPPT-a. */
export function vmppVruce(modula, vmpp, p = {}) {
    return modula * vmpp * faktorNapona(p.tempMax ?? PODRAZUMEVANE_TEMPERATURE.tempMax, p.koefNapona);
}

/** Umpp niza na najhladnijem danu — merodavan za gornju granicu MPPT-a. */
export function vmppHladno(modula, vmpp, p = {}) {
    return modula * vmpp * faktorNapona(p.tempMin ?? PODRAZUMEVANE_TEMPERATURE.tempMin, p.koefNapona);
}

function greska(tekst) { return { nivo: 'greska', tekst }; }
function upozorenje(tekst) { return { nivo: 'upozorenje', tekst }; }

/**
 * Provera jednog MPPT ulaza.
 *
 * @param {object} o - { oznaka, modula (najduži string na ulazu),
 *                       stringova, modul, granice, parametri }
 */
export function proveriUlaz(o) {
    const g = o.granice || {};
    const m = o.modul || {};
    const p = o.parametri || {};
    const poruke = [];

    const voc = vocHladno(o.modula, m.voc || 0, p);
    const vmppV = vmppVruce(o.modula, m.vmpp || 0, p);
    const vmppH = vmppHladno(o.modula, m.vmpp || 0, p);

    const impp = (m.impp || 0) * o.stringova;
    const isc = (m.isc || 0) * 1.25 * o.stringova;

    if (g.udcMax && voc > g.udcMax) {
        poruke.push(greska(`${o.oznaka}: Voc na ${p.tempMin ?? -10} °C je ${voc.toFixed(0)} V — ` +
            `preko Udc,max ${g.udcMax} V. Skrati string.`));
    }
    if (g.umpptMax && vmppH > g.umpptMax) {
        poruke.push(upozorenje(`${o.oznaka}: Umpp na ${p.tempMin ?? -10} °C je ${vmppH.toFixed(0)} V — ` +
            `iznad MPPT opsega (${g.umpptMax} V). Inverter na hladnoći radi van optimuma.`));
    }
    if (g.umpptMin && vmppV < g.umpptMin) {
        poruke.push(greska(`${o.oznaka}: Umpp na ${p.tempMax ?? 70} °C je ${vmppV.toFixed(0)} V — ` +
            `ispod MPPT minimuma ${g.umpptMin} V. Produži string.`));
    }
    if (g.idcMax && impp > g.idcMax) {
        poruke.push(greska(`${o.oznaka}: radna struja ${impp.toFixed(1)} A — ` +
            `preko Idc,max ${g.idcMax} A po ulazu.`));
    }
    if (g.iscMax && isc > g.iscMax) {
        poruke.push(greska(`${o.oznaka}: 1,25 × Isc je ${isc.toFixed(1)} A — ` +
            `preko Isc,max ${g.iscMax} A po ulazu.`));
    }
    if (g.stringovaPoMppt && o.stringova > g.stringovaPoMppt) {
        poruke.push(greska(`${o.oznaka}: ${o.stringova} stringa na ulazu — ` +
            `dozvoljeno ${g.stringovaPoMppt}.`));
    }

    return { voc, vmppVruce: vmppV, vmppHladno: vmppH, impp, isc, poruke };
}

/**
 * Provera svih MPPT ulaza na planu.
 * Stringovi se grupišu po (inverter, MPPT); merodavan je najduži string na ulazu.
 */
export function proveriUlaze(model) {
    const poStringu = model.modulaPoStringu();
    const grupe = new Map();

    model.stringovi.forEach(s => {
        const n = poStringu.get(s.id) || 0;
        if (!n) return;
        const kljuc = `${s.inverter || 1}/${s.mppt || 1}`;
        if (!grupe.has(kljuc)) grupe.set(kljuc, { inverter: s.inverter || 1, mppt: s.mppt || 1, stringovi: [] });
        grupe.get(kljuc).stringovi.push({ oznaka: s.oznaka, modula: n });
    });

    return [...grupe.entries()].sort().map(([kljuc, g]) => {
        const inv = model.oprema.find(o => o.tip === 'inverter' && (o.inverter || 1) === g.inverter);
        const modula = Math.max(...g.stringovi.map(s => s.modula));

        const rezultat = proveriUlaz({
            oznaka: `Inverter ${g.inverter}, MPPT ${g.mppt}`,
            modula,
            stringova: g.stringovi.length,
            modul: model.modul,
            granice: inv ? inv.granice : null,
            parametri: model.proracun
        });

        return {
            kljuc, ...g, modula, inverterOznaka: inv ? inv.oznaka : null,
            imaGranice: !!(inv && inv.granice && inv.granice.udcMax),
            ...rezultat
        };
    });
}
