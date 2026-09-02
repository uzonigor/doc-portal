/**
 * Desni panel string plana: stringovi, izabrana krovna ravan, modul, podloga.
 */

import { escapeXml } from './util.js';
import { TIPOVI_OPREME } from './plan-model.js';
import { izvestajDuzina } from './plan-trase.js';

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

function odeljakOpreme(model, o) {
    if (!o) return '';
    return `
        <h4>${escapeXml(TIPOVI_OPREME[o.tip]?.naziv || o.tip)}</h4>
        <div class="forma">
            ${polje('Oznaka', 'text', o.oznaka, 'oprema', 'oznaka')}
            ${polje('Naziv', 'text', o.naziv, 'oprema', 'naziv')}
            ${o.tip === 'inverter' ? polje('Redni broj invertera', 'int', o.inverter, 'oprema', 'inverter') : ''}
            <div class="par">
                ${polje('X (m)', 'float', o.pos.x.toFixed(2), 'oprema-pos', 'x')}
                ${polje('Y (m)', 'float', o.pos.y.toFixed(2), 'oprema-pos', 'y')}
            </div>
        </div>
        <div class="akcije">
            <button data-akcija="obrisi-opremu" class="opasno">Obriši</button>
        </div>`;
}

function odeljakTrasa(model) {
    const izv = izvestajDuzina(model);
    const t = model.trasa;

    const redovi = izv.stringovi.filter(s => s.modula > 0);

    return `
        <h4>Trase i dužine</h4>
        <div class="forma">
            <label>Način računanja
                <select data-cilj="trasa" data-kljuc="putanja">
                    <option value="manhattan"${t.putanja === 'manhattan' ? ' selected' : ''}>uz ivice (manhattan)</option>
                    <option value="vazdusna"${t.putanja === 'vazdusna' ? ' selected' : ''}>vazdušna linija</option>
                </select></label>
            <div class="par">
                ${polje('Visina spusta (m)', 'float', t.visinaSpusta, 'trasa', 'visinaSpusta')}
                ${polje('Rezerva (%)', 'float', t.rezerva, 'trasa', 'rezerva')}
            </div>
        </div>

        ${izv.nedostajeInverter ? `<ul class="upozorenja"><li>Nema invertera na planu —
            vodovi do invertera se ne mogu izmeriti. Dodaj ga alatom <b>Oprema</b>.</li></ul>` : ''}

        ${redovi.length ? `<table class="tabela sitna">
            <thead><tr><th>String</th><th>Ožičenje</th><th>Vod</th><th>Presek</th><th>Pad</th></tr></thead>
            <tbody>${redovi.map(s => {
                const pr = s.predlog;
                const prelazi = pr && pr.padProcenat > (model.proracun.padDC ?? 1);
                return `<tr>
                <td><span class="boja-tacka" style="background:${escapeXml(s.boja)}"></span> ${escapeXml(s.oznaka)}</td>
                <td>${s.ozicenje.toFixed(1)} m</td>
                <td>${s.vod ? '2×' + s.vod.toFixed(1) + ' m' : '—'}</td>
                <td>${pr && pr.presek ? `<b>${pr.presek}</b> mm²` : '—'}</td>
                <td class="${prelazi ? 'opasno' : ''}">${pr && pr.presek ? pr.padProcenat.toFixed(2) + ' %' : '—'}</td>
            </tr>`; }).join('')}</tbody>
        </table>
        ${redovi.filter(s => s.predlog && s.predlog.poruke.length).length ? `
            <ul class="upozorenja">${redovi.filter(s => s.predlog && s.predlog.poruke.length).map(s =>
                `<li>${escapeXml(s.oznaka)}: ${escapeXml(s.predlog.poruke[0])}</li>`).join('')}</ul>` : ''}
        ${redovi.filter(s => s.predlog && !s.predlog.presek).length ? `
            <ul class="upozorenja">${redovi.filter(s => s.predlog && !s.predlog.presek).map(s =>
                `<li class="greska">${escapeXml(s.oznaka)}: ${escapeXml(s.predlog.poruke[0] || 'presek se ne može odrediti')}</li>`).join('')}</ul>` : ''}
        <p class="mala">Presek je <b>predlog</b>: najmanji standardni koji zadovoljava i pad napona
           i strujnu opteretljivost. Projektant ga potvrđuje.</p>`
        : '<p class="mala">Dodeli module stringovima da bi se dužine izračunale.</p>'}

        ${izv.ac.length ? `<table class="tabela sitna">
            <thead><tr><th>AC deonica</th><th>Dužina</th></tr></thead>
            <tbody>${izv.ac.map(d => `<tr>
                <td>${escapeXml(d.od)} → ${escapeXml(d.do)}</td>
                <td>${d.duzina.toFixed(1)} m</td>
            </tr>`).join('')}</tbody>
        </table>` : ''}

        <dl class="rekap">
            <dt>DC ukupno</dt><dd>${izv.ukupnoDC.toFixed(1)} m</dd>
            <dt>AC ukupno</dt><dd>${izv.ukupnoAC.toFixed(1)} m</dd>
        </dl>`;
}

function odeljakProracuna(model) {
    const p = model.proracun;
    return `
        <h4>Parametri proračuna</h4>
        <div class="forma">
            <div class="par">
                ${polje('Dozvoljen pad DC (%)', 'float', p.padDC, 'proracun', 'padDC')}
                ${polje('Dozvoljen pad AC (%)', 'float', p.padAC, 'proracun', 'padAC')}
            </div>
            <div class="par">
                ${polje('κ bakra (m/Ω·mm²)', 'float', p.kapa, 'proracun', 'kapa')}
                ${polje('cos φ', 'float', p.cosFi, 'proracun', 'cosFi')}
            </div>
            <div class="par">
                ${polje('Faktor temperature', 'float', p.faktorTemp, 'proracun', 'faktorTemp')}
                ${polje('Faktor grupisanja', 'float', p.faktorGrupisanja, 'proracun', 'faktorGrupisanja')}
            </div>
            <div class="par">
                ${polje('Min. presek DC (mm²)', 'float', p.minPresekDC, 'proracun', 'minPresekDC')}
                ${polje('Min. presek AC (mm²)', 'float', p.minPresekAC, 'proracun', 'minPresekAC')}
            </div>
        </div>
        <p class="mala">κ = 56 važi na 20 °C. Za proračun na radnoj temperaturi
           provodnika uzmi 48 (PVC, 70 °C) ili 44 (90 °C).</p>`;
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
            <div class="par">
                ${polje('Isc (A)', 'float', m.isc, 'modul', 'isc')}
                ${polje('Vmpp (V)', 'float', m.vmpp, 'modul', 'vmpp')}
            </div>
            ${polje('Impp (A)', 'float', m.impp, 'modul', 'impp')}
        </div>
        <p class="mala">Pad napona se računa na Vmpp/Impp, a zaštita i
           opteretljivost na Voc (−10 °C) i 1,25 × Isc.</p>`;
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
    const oprema_ = izabrani.length === 1 ? model.getOprema(izabrani[0]) : null;

    el.innerHTML = [
        odeljakStringova(model, canvas.aktivniString),
        oprema_ ? odeljakOpreme(model, oprema_) : odeljakPolja(model, polje_),
        odeljakTrasa(model),
        odeljakProracuna(model),
        odeljakModula(model),
        odeljakPodloge(model),
        odeljakRekapitulacije(model)
    ].join('');

    vezi(el, model, polje_, oprema_, canvas);
}

function vezi(el, model, polje_, oprema_, canvas) {
    el.querySelectorAll('input[data-cilj], select[data-cilj]').forEach(input => {
        const dogadjaj = input.type === 'range' ? 'input' : 'change';
        input.addEventListener(dogadjaj, () => {
            const cilj = input.getAttribute('data-cilj');
            const kljuc = input.getAttribute('data-kljuc');
            const vrednost = input.type === 'number' || input.type === 'range'
                ? (parseFloat(input.value) || 0)
                : input.value;

            if (cilj === 'polje' && polje_) model.setPoljeProp(polje_.id, kljuc, vrednost);
            else if (cilj === 'oprema' && oprema_) model.setOpremaProp(oprema_.id, kljuc, vrednost);
            else if (cilj === 'oprema-pos' && oprema_) {
                model.commit('pomeri opremu', () => { oprema_.pos[kljuc] = vrednost; });
            }
            else if (cilj === 'trasa') model.commit('izmeni trasu', () => { model.trasa[kljuc] = vrednost; });
            else if (cilj === 'proracun') model.commit('izmeni proračun', () => { model.proracun[kljuc] = vrednost; });
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
            if (a === 'obrisi-opremu' && oprema_) {
                model.removeOprema([oprema_.id]);
                canvas.postaviIzbor([]);
            }
            if (a === 'obrisi-podlogu') {
                model.commit('ukloni podlogu', () => { model.podloga.slika = null; });
            }
        });
    });
}
