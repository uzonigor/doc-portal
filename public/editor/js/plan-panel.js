/**
 * Desni panel string plana: stringovi, izabrana krovna ravan, modul, podloga.
 */

import { escapeXml } from './util.js';

function polje(label, tip, vrednost, cilj, kljuc, dodatno = '') {
    const korak = tip === 'int' ? '1' : (tip === 'float' ? 'any' : null);
    const tipInput = tip === 'text' ? 'text' : 'number';
    return `<label>${escapeXml(label)}
        <input type="${tipInput}"${korak ? ` step="${korak}"` : ''} value="${escapeXml(vrednost ?? '')}"
               data-cilj="${cilj}" data-kljuc="${kljuc}" ${dodatno}></label>`;
}

function odeljakStringova(model, aktivniString) {
    const po = model.modulaPoStringu();

    return `
        <h4>Stringovi</h4>
        <div class="stringovi">
            ${model.stringovi.map(s => {
                const n = po.get(s.id) || 0;
                // Voc raste na niskim temperaturama; -10 °C, tipičan koef. -0,29 %/K
                const voc = n * (model.modul.voc || 0) * 1.101;
                return `
                <div class="string-red${s.id === aktivniString ? ' aktivan' : ''}" data-string="${s.id}">
                    <button class="string-izbor" data-akcija="aktiviraj" data-id="${s.id}"
                            title="Postavi kao aktivan string za bojenje">
                        <span class="boja" style="background:${escapeXml(s.boja)}"></span>
                        <b>${escapeXml(s.oznaka)}</b>
                    </button>
                    <span class="string-broj${voc > 1000 ? ' opasno' : ''}" title="Voc na −10 °C: ${voc.toFixed(0)} V">
                        ${n} kom · ${voc.toFixed(0)} V
                    </span>
                    <input type="number" step="1" min="1" value="${s.inverter}" title="Inverter"
                           data-cilj="string" data-id="${s.id}" data-kljuc="inverter">
                    <input type="number" step="1" min="1" value="${s.mppt}" title="MPPT ulaz"
                           data-cilj="string" data-id="${s.id}" data-kljuc="mppt">
                    <button class="mala-opasna" data-akcija="obrisi-string" data-id="${s.id}" title="Obriši string">×</button>
                </div>`;
            }).join('')}
        </div>
        <div class="akcije">
            <button data-akcija="dodaj-string">+ Novi string</button>
        </div>`;
}

function odeljakPolja(model, polje_) {
    if (!polje_) {
        return `<h4>Krovna ravan</h4>
            <p class="mala">Izaberi krovnu ravan na crtežu da bi joj menjao dimenzije,
            nagib i orijentaciju. Novu dodaješ dugmetom u traci.</p>`;
    }

    return `
        <h4>Krovna ravan</h4>
        <div class="forma">
            ${polje('Naziv', 'text', polje_.naziv, 'polje', 'naziv')}
            <div class="par">
                ${polje('Redova', 'int', polje_.redova, 'polje', 'redova')}
                ${polje('Kolona', 'int', polje_.kolona, 'polje', 'kolona')}
            </div>
            <label>Orijentacija modula
                <select data-cilj="polje" data-kljuc="orijentacija">
                    <option value="portret"${polje_.orijentacija === 'portret' ? ' selected' : ''}>portret</option>
                    <option value="pejzaz"${polje_.orijentacija === 'pejzaz' ? ' selected' : ''}>pejzaž</option>
                </select></label>
            <div class="par">
                ${polje('Nagib (°)', 'float', polje_.nagib, 'polje', 'nagib')}
                ${polje('Azimut (°)', 'float', polje_.azimut, 'polje', 'azimut')}
            </div>
            <div class="par">
                ${polje('Rotacija (°)', 'float', polje_.rot, 'polje', 'rot')}
                ${polje('Razmak (m)', 'float', polje_.razmakX, 'polje', 'razmakX')}
            </div>
        </div>
        <div class="akcije">
            <button data-akcija="dupliraj-polje">Dupliraj</button>
            <button data-akcija="obrisi-polje" class="opasno">Obriši</button>
        </div>`;
}

function odeljakModula(model) {
    const m = model.modul;
    return `
        <h4>Modul</h4>
        <div class="forma">
            ${polje('Proizvođač', 'text', m.proizvodjac, 'modul', 'proizvodjac')}
            <div class="par">
                ${polje('Širina (m)', 'float', m.sirina, 'modul', 'sirina')}
                ${polje('Visina (m)', 'float', m.visina, 'modul', 'visina')}
            </div>
            <div class="par">
                ${polje('Pmax (W)', 'float', m.pmax, 'modul', 'pmax')}
                ${polje('Voc (V)', 'float', m.voc, 'modul', 'voc')}
            </div>
            ${polje('Isc (A)', 'float', m.isc, 'modul', 'isc')}
        </div>`;
}

function odeljakPodloge(model) {
    const p = model.podloga;
    return `
        <h4>Podloga</h4>
        <div class="forma">
            <label class="dugme-fajl">
                ${p.slika ? 'Zameni snimak krova' : 'Učitaj snimak krova'}
                <input type="file" accept="image/*" data-cilj="podloga-fajl" hidden>
            </label>
            ${p.slika ? `
                <label>Prozirnost
                    <input type="range" min="0.1" max="1" step="0.05" value="${p.prozirnost}"
                           data-cilj="podloga" data-kljuc="prozirnost"></label>
                <div class="par">
                    ${polje('Širina (m)', 'float', p.sirina.toFixed(2), 'podloga', 'sirina')}
                    ${polje('Visina (m)', 'float', p.visina.toFixed(2), 'podloga', 'visina')}
                </div>
                <p class="mala">Alat <b>Kalibracija</b> u traci: povuci duž preko poznate dužine
                   (npr. dužina krova) i unesi koliko iznosi u metrima.</p>
                <div class="akcije">
                    <button data-akcija="obrisi-podlogu" class="opasno">Ukloni podlogu</button>
                </div>` : `<p class="mala">Ubaci snimak iz Google Earth-a ili katastra, pa ga
                   kalibriši po poznatoj dužini da bi moduli stali u pravu razmeru.</p>`}
        </div>`;
}

function odeljakRekapitulacije(model) {
    const upozorenja = model.validate();
    return `
        <h4>Rekapitulacija</h4>
        <dl class="rekap">
            <dt>Krovnih ravni</dt><dd>${model.polja.length}</dd>
            <dt>Modula ukupno</dt><dd>${model.ukupnoModula()}</dd>
            <dt>Nedodeljeno</dt><dd>${model.nedodeljenihModula()}</dd>
            <dt>Snaga DC</dt><dd>${model.snagaDC().toFixed(2)} kWp</dd>
        </dl>
        ${upozorenja.length ? `<h4>Provera (${upozorenja.length})</h4>
            <ul class="upozorenja">${upozorenja.slice(0, 10).map(u =>
                `<li class="${u.nivo === 'greska' ? 'greska' : ''}">${escapeXml(u.tekst)}</li>`).join('')}</ul>` : ''}`;
}

export function renderPlanSvojstva(el, model, izabrani, canvas) {
    const polje_ = izabrani.length === 1 ? model.getPolje(izabrani[0]) : null;

    el.innerHTML = [
        odeljakStringova(model, canvas.aktivniString),
        odeljakPolja(model, polje_),
        odeljakModula(model),
        odeljakPodloge(model),
        odeljakRekapitulacije(model)
    ].join('');

    vezi(el, model, polje_, canvas);
}

function vezi(el, model, polje_, canvas) {
    el.querySelectorAll('input[data-cilj], select[data-cilj]').forEach(input => {
        const dogadjaj = input.type === 'range' ? 'input' : 'change';
        input.addEventListener(dogadjaj, () => {
            const cilj = input.getAttribute('data-cilj');
            const kljuc = input.getAttribute('data-kljuc');
            const vrednost = input.type === 'number' || input.type === 'range'
                ? (parseFloat(input.value) || 0)
                : input.value;

            if (cilj === 'polje' && polje_) model.setPoljeProp(polje_.id, kljuc, vrednost);
            else if (cilj === 'string') model.setStringProp(input.getAttribute('data-id'), kljuc, vrednost);
            else if (cilj === 'modul') model.commit('izmeni modul', () => { model.modul[kljuc] = vrednost; });
            else if (cilj === 'podloga') model.commit('izmeni podlogu', () => { model.podloga[kljuc] = vrednost; });
        });
    });

    const fajl = el.querySelector('input[data-cilj="podloga-fajl"]');
    if (fajl) fajl.addEventListener('change', () => {
        const f = fajl.files && fajl.files[0];
        if (f) canvas.onUcitajPodlogu(f);
    });

    el.querySelectorAll('button[data-akcija]').forEach(btn => {
        btn.addEventListener('click', () => {
            const a = btn.getAttribute('data-akcija');
            const id = btn.getAttribute('data-id');

            if (a === 'dodaj-string') {
                const s = model.addString();
                canvas.aktivniString = s.id;
                canvas.postaviAlat('boji');
            }
            if (a === 'aktiviraj') {
                canvas.aktivniString = id;
                canvas.postaviAlat('boji');
                model.emit('aktivan-string');
            }
            if (a === 'obrisi-string') {
                if (canvas.aktivniString === id) canvas.aktivniString = null;
                model.removeString(id);
            }
            if (a === 'obrisi-polje' && polje_) {
                model.removePolja([polje_.id]);
                canvas.postaviIzbor([]);
            }
            if (a === 'dupliraj-polje' && polje_) {
                model.commit('dupliraj polje', () => {
                    model.polja.push({
                        ...polje_,
                        id: `p${Date.now().toString(36)}`,
                        naziv: `${polje_.naziv} (kopija)`,
                        pos: { x: polje_.pos.x + 1, y: polje_.pos.y + 1 },
                        moduli: { ...polje_.moduli }
                    });
                });
            }
            if (a === 'obrisi-podlogu') {
                model.commit('ukloni podlogu', () => { model.podloga.slika = null; });
            }
        });
    });
}
