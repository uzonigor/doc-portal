/**
 * Dijalozi: generator šeme iz parametara i tabele (kablovi + specifikacija).
 */

import { PODRAZUMEVANI, generisi, rekapitulacija } from './generator.js';
import { escapeXml } from './render.js';
import {
    tabelaKablova, specifikacijaOpreme, zbirKablova, ukupnoModula,
    redoviProracuna, KOLONE_KABLOVA, KOLONE_OPREME, KOLONE_PRORACUNA, csv
} from './specifikacija.js';
import { proracunKablova, primeniPredloge } from './sema-proracun.js';
import { PODRAZUMEVANI_PARAMETRI } from './proracun.js';

// ── osnovni okvir dijaloga ───────────────────────────────────────────────────

function otvori(naslov, sadrzaj, sirina = 720) {
    const zavesa = document.createElement('div');
    zavesa.className = 'zavesa';
    zavesa.innerHTML = `
        <div class="dijalog" style="max-width:${sirina}px">
            <header><h3>${escapeXml(naslov)}</h3><button class="zatvori" aria-label="Zatvori">×</button></header>
            <div class="telo"></div>
            <footer></footer>
        </div>`;

    document.body.appendChild(zavesa);
    zavesa.querySelector('.telo').appendChild(sadrzaj);

    const zatvori = () => zavesa.remove();
    zavesa.querySelector('.zatvori').addEventListener('click', zatvori);
    zavesa.addEventListener('mousedown', e => { if (e.target === zavesa) zatvori(); });
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { zatvori(); document.removeEventListener('keydown', esc); }
    });

    return { zavesa, podnozje: zavesa.querySelector('footer'), zatvori };
}

function dugme(tekst, klasa, akcija) {
    const b = document.createElement('button');
    b.textContent = tekst;
    if (klasa) b.className = klasa;
    b.addEventListener('click', akcija);
    return b;
}

function preuzmi(tekst, ime, mime) {
    const url = URL.createObjectURL(new Blob([tekst], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = ime;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── generator ────────────────────────────────────────────────────────────────

const POLJA = [
    { grupa: 'Osnovni podaci', polja: [
        { put: 'naziv', label: 'Naziv šeme', tip: 'text' },
        { put: 'investitor', label: 'Investitor', tip: 'text' },
        { put: 'lokacija', label: 'Objekat / lokacija', tip: 'text' },
        { put: 'projektant', label: 'Projektant', tip: 'text' },
        { put: 'brojProjekta', label: 'Broj projekta', tip: 'text' }
    ]},
    { grupa: 'Paneli', polja: [
        { put: 'brojPanela', label: 'Broj panela', tip: 'int' },
        { put: 'panel.pmax', label: 'Pmax (W)', tip: 'float' },
        { put: 'panel.voc', label: 'Voc (V)', tip: 'float' },
        { put: 'panel.isc', label: 'Isc (A)', tip: 'float' },
        { put: 'panel.proizvodjac', label: 'Proizvođač', tip: 'text' }
    ]},
    { grupa: 'Inverteri', polja: [
        { put: 'invertera', label: 'Broj invertera', tip: 'int' },
        { put: 'inverter.snaga', label: 'Snaga po inverteru (kW)', tip: 'float' },
        { put: 'inverter.faza', label: 'Broj faza', tip: 'select', opcije: [['1', '1-fazni'], ['3', '3-fazni']] },
        { put: 'inverter.mppt', label: 'Broj MPPT ulaza', tip: 'int' },
        { put: 'inverter.proizvodjac', label: 'Proizvođač', tip: 'text' },
        { put: 'inverter.model', label: 'Model', tip: 'text' }
    ]},
    { grupa: 'Zaštita', polja: [
        { put: 'dcPrekidac', label: 'DC prekidač po stringu', tip: 'check' },
        { put: 'dcSpd', label: 'DC prenaponska zaštita', tip: 'select', opcije: [['', 'bez'], ['T1', 'T1'], ['T2', 'T2'], ['T1+T2', 'T1+T2']] },
        { put: 'acPrekidac', label: 'AC prekidač In (A)', tip: 'float' },
        { put: 'acSpd', label: 'AC prenaponska zaštita', tip: 'select', opcije: [['', 'bez'], ['T1', 'T1'], ['T2', 'T2'], ['T1+T2', 'T1+T2']] },
        { put: 'fid', label: 'FID sklopka', tip: 'check' },
        { put: 'fidStruja', label: 'FID In (A)', tip: 'float' },
        { put: 'fidDiff', label: 'FID IΔn (mA)', tip: 'select', opcije: [['10', '10'], ['30', '30'], ['100', '100'], ['300', '300']] },
        { put: 'fidTip', label: 'FID tip', tip: 'select', opcije: [['AC', 'AC'], ['A', 'A'], ['B', 'B']] }
    ]},
    { grupa: 'Merenje i priključak', polja: [
        { put: 'merenje', label: 'Merenje', tip: 'select', opcije: [['direktno', 'direktno'], ['poluindirektno', 'poluindirektno'], ['indirektno', 'indirektno']] },
        { put: 'mreza', label: 'Napon mreže', tip: 'text' },
        { put: 'sistemUzemljenja', label: 'Sistem uzemljenja', tip: 'select', opcije: [['TN-C', 'TN-C'], ['TN-S', 'TN-S'], ['TN-C-S', 'TN-C-S'], ['TT', 'TT']] },
        { put: 'uzemljenje', label: 'Nacrtaj uzemljenje', tip: 'check' }
    ]}
];

function uzmi(obj, put) {
    return put.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function postavi(obj, put, vrednost) {
    const delovi = put.split('.');
    const poslednji = delovi.pop();
    const cilj = delovi.reduce((o, k) => (o[k] = o[k] || {}), obj);
    cilj[poslednji] = vrednost;
}

/**
 * @param {object} preset - unapred zadati parametri, npr. preneti iz string
 *                          plana. Kada nose `raspodelaStringova`, raspored po
 *                          stringovima je već odlučen na krovu, pa se polja
 *                          "broj panela" i "broj invertera" zaključavaju.
 */
export function otvoriGenerator(model, canvas, meta = {}, preset = null) {
    const par = JSON.parse(JSON.stringify(PODRAZUMEVANI));
    // preuzmi podatke koje već znamo iz projekta
    ['naziv', 'investitor', 'lokacija', 'projektant', 'brojProjekta'].forEach(k => {
        if (meta[k]) par[k] = meta[k];
    });

    if (preset) {
        Object.assign(par, preset, {
            panel: { ...par.panel, ...(preset.panel || {}) },
            inverter: { ...par.inverter, ...(preset.inverter || {}) }
        });
    }

    const izPlana = !!(par.raspodelaStringova && par.raspodelaStringova.length);

    const koren = document.createElement('div');
    koren.className = 'generator';
    koren.innerHTML = `<div class="gen-polja"></div><aside class="gen-rekap"></aside>`;

    const poljaEl = koren.querySelector('.gen-polja');
    const rekapEl = koren.querySelector('.gen-rekap');

    // Polja koja string plan već određuje ne smeju da se ručno menjaju.
    const zakljucana = izPlana ? new Set(['brojPanela', 'invertera']) : new Set();

    poljaEl.innerHTML = POLJA.map(g => `
        <fieldset>
            <legend>${escapeXml(g.grupa)}</legend>
            ${g.polja.map(f => {
                const v = uzmi(par, f.put);
                const onemoguceno = zakljucana.has(f.put) ? ' disabled title="Dolazi iz string plana"' : '';
                if (f.tip === 'check') {
                    return `<label class="check"><input type="checkbox" data-put="${f.put}"${v ? ' checked' : ''}> ${escapeXml(f.label)}</label>`;
                }
                if (f.tip === 'select') {
                    return `<label>${escapeXml(f.label)}
                        <select data-put="${f.put}">${f.opcije.map(([val, tekst]) =>
                            `<option value="${escapeXml(val)}"${String(val) === String(v) ? ' selected' : ''}>${escapeXml(tekst)}</option>`).join('')}</select></label>`;
                }
                const tipInput = f.tip === 'text' ? 'text' : 'number';
                const korak = f.tip === 'int' ? '1' : 'any';
                return `<label>${escapeXml(f.label)}
                    <input type="${tipInput}" step="${korak}" value="${escapeXml(v ?? '')}" data-put="${f.put}"${onemoguceno}></label>`;
            }).join('')}
        </fieldset>`).join('');

    function osveziRekap() {
        const r = rekapitulacija(par);
        rekapEl.innerHTML = `<h4>Rezultat</h4><dl class="rekap">
            ${Object.entries(r.vrednosti).map(([k, v]) => `<dt>${escapeXml(k)}</dt><dd>${escapeXml(v)}</dd>`).join('')}
        </dl>
        ${r.upozorenja.length ? `<ul class="upozorenja">${r.upozorenja.map(u =>
            `<li>${escapeXml(u)}</li>`).join('')}</ul>` : ''}
        ${izPlana ? `<p class="mala"><b>Raspored stringova dolazi iz string plana</b> —
            broj panela i invertera se odatle čitaju i ovde se ne menjaju.</p>` : ''}
        <p class="mala">Šema se generiše sa auto-rasporedom; sve se posle može doterati u editoru.</p>`;
    }

    poljaEl.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', () => {
            const put = el.getAttribute('data-put');
            let v;
            if (el.type === 'checkbox') v = el.checked;
            else if (el.type === 'number') v = parseFloat(el.value) || 0;
            else v = el.value;
            postavi(par, put, v);
            osveziRekap();
        });
    });

    osveziRekap();

    const d = otvori(izPlana ? 'Generiši šemu iz string plana' : 'Generiši šemu iz parametara', koren, 900);
    d.podnozje.appendChild(dugme('Odustani', '', d.zatvori));
    d.podnozje.appendChild(dugme('Generiši', 'primarno', () => {
        const novi = generisi(par);
        model.commit('generiši šemu', () => {
            model.nodes = novi.nodes;
            model.edges = novi.edges;
            model.meta = novi.meta;
        });
        canvas.postaviIzbor([]);
        canvas.uklopiUProzor();
        d.zatvori();
    }));
}

// ── tabele ───────────────────────────────────────────────────────────────────

function tabelaHtml(redovi, kolone) {
    if (!redovi.length) return `<p class="prazno">Nema podataka.</p>`;
    return `<table class="tabela">
        <thead><tr>${kolone.map(k => `<th>${escapeXml(k.naslov)}</th>`).join('')}</tr></thead>
        <tbody>${redovi.map(r => `<tr>${kolone.map(k => `<td>${escapeXml(r[k.kljuc])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

export function otvoriTabele(model) {
    const kablovi = tabelaKablova(model);
    const oprema = specifikacijaOpreme(model);
    const zbir = zbirKablova(model);

    const koren = document.createElement('div');
    koren.className = 'tabele';
    koren.innerHTML = `
        <div class="jezicci">
            <button class="aktivan" data-tab="oprema">Specifikacija opreme</button>
            <button data-tab="kablovi">Tabela kablova</button>
        </div>
        <div class="tab" data-tab="oprema">
            <p class="mala">Ukupno PV modula: <b>${ukupnoModula(model)}</b> ·
               DC ${model.ukupnaSnagaDC().toFixed(2)} kWp · AC ${model.ukupnaSnagaAC().toFixed(2)} kW</p>
            ${tabelaHtml(oprema, KOLONE_OPREME)}
        </div>
        <div class="tab" data-tab="kablovi" hidden>
            ${tabelaHtml(kablovi, KOLONE_KABLOVA)}
            ${zbir.length ? `<h4>Zbirno po tipu kabla</h4>
                ${tabelaHtml(zbir.map(z => ({
                    kabl: z.kabl,
                    duzina: z.duzina ? z.duzina.toFixed(1) : '—',
                    zaNabavku: z.duzina ? String(z.zaNabavku) : '—'
                })), [
                    { kljuc: 'kabl', naslov: 'Tip i presek' },
                    { kljuc: 'duzina', naslov: 'Izmereno (m)' },
                    { kljuc: 'zaNabavku', naslov: 'Za nabavku (m)' }
                ])}
                <p class="mala">Dužine već nose rezervu zadatu na string planu;
                   kolona za nabavku je zaokružena naviše na 5 m.</p>` : ''}
        </div>`;

    koren.querySelectorAll('.jezicci button').forEach(b => {
        b.addEventListener('click', () => {
            const tab = b.getAttribute('data-tab');
            koren.querySelectorAll('.jezicci button').forEach(x => x.classList.toggle('aktivan', x === b));
            koren.querySelectorAll('.tab').forEach(t => { t.hidden = t.getAttribute('data-tab') !== tab; });
        });
    });

    const ime = (model.meta.naziv || 'sema').replace(/[^\w\-. ]+/g, '_');
    const d = otvori('Tabele', koren, 900);
    d.podnozje.appendChild(dugme('Oprema → CSV', '', () =>
        preuzmi(csv(oprema, KOLONE_OPREME), `${ime}-specifikacija.csv`, 'text/csv;charset=utf-8')));
    d.podnozje.appendChild(dugme('Kablovi → CSV', '', () =>
        preuzmi(csv(kablovi, KOLONE_KABLOVA), `${ime}-kablovi.csv`, 'text/csv;charset=utf-8')));
    d.podnozje.appendChild(dugme('Zatvori', 'primarno', d.zatvori));
}


// ── proračun kablova ─────────────────────────────────────────────────────────

const POLJA_PRORACUNA = [
    { kljuc: 'padDC', label: 'Dozvoljen pad DC (%)' },
    { kljuc: 'padAC', label: 'Dozvoljen pad AC (%)' },
    { kljuc: 'kapa', label: 'κ bakra (m/Ω·mm²)' },
    { kljuc: 'cosFi', label: 'cos φ' },
    { kljuc: 'faktorTemp', label: 'Faktor temperature' },
    { kljuc: 'faktorGrupisanja', label: 'Faktor grupisanja' },
    { kljuc: 'minPresekDC', label: 'Min. presek DC (mm²)' },
    { kljuc: 'minPresekAC', label: 'Min. presek AC (mm²)' }
];

export function otvoriProracun(model, canvas) {
    const par = { ...PODRAZUMEVANI_PARAMETRI, ...(model.meta.proracun || {}) };

    const koren = document.createElement('div');
    koren.className = 'proracun';
    koren.innerHTML = `<div class="proracun-parametri"></div><div class="proracun-tabela"></div>`;

    const parametriEl = koren.querySelector('.proracun-parametri');
    const tabelaEl = koren.querySelector('.proracun-tabela');

    parametriEl.innerHTML = `<div class="forma-red">${POLJA_PRORACUNA.map(f => `
        <label>${escapeXml(f.label)}
            <input type="number" step="any" value="${escapeXml(par[f.kljuc])}" data-kljuc="${f.kljuc}"></label>`).join('')}
    </div>`;

    let rezultat = [];

    function osvezi() {
        rezultat = proracunKablova(model, par);
        const redovi = redoviProracuna(rezultat);

        const problemi = rezultat.filter(r => r.provera && !r.provera.uredu);
        const bezDuzine = rezultat.filter(r => r.napomena && r.napomena.startsWith('Nema dužine'));

        tabelaEl.innerHTML = `
            ${tabelaHtml(redovi, KOLONE_PRORACUNA)}
            ${problemi.length ? `<h4>Zadati preseci koji ne prolaze (${problemi.length})</h4>
                <ul class="upozorenja">${problemi.map(r =>
                    `<li class="greska">${escapeXml(r.oznaka)}: ${escapeXml(r.provera.greske.join(' '))}</li>`).join('')}</ul>` : ''}
            ${bezDuzine.length ? `<ul class="upozorenja"><li>${bezDuzine.length}
                ${bezDuzine.length === 1 ? 'deonica nema' : 'deonica nema'} zadatu dužinu — unesi je u panelu
                provodnika ili je prenesi sa string plana.</li></ul>` : ''}
            <p class="mala">Presek je <b>predlog</b>: najmanji standardni koji zadovoljava i pad napona
               i strujnu opteretljivost, uz praktični minimum. Projektant ga potvrđuje.
               Formule i tabele opteretljivosti stoje u <code>js/proracun.js</code>.</p>`;
    }

    parametriEl.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            par[input.getAttribute('data-kljuc')] = parseFloat(input.value) || 0;
            osvezi();
        });
    });

    osvezi();

    const d = otvori('Proračun kablova (bakar)', koren, 1000);

    d.podnozje.appendChild(dugme('Proračun → CSV', '', () =>
        preuzmi(csv(redoviProracuna(rezultat), KOLONE_PRORACUNA),
            `${(model.meta.naziv || 'sema').replace(/[^\w\-. ]+/g, '_')}-proracun.csv`, 'text/csv;charset=utf-8')));

    d.podnozje.appendChild(dugme('Primeni predložene preseke', 'primarno', () => {
        model.meta.proracun = { ...par };
        const n = primeniPredloge(model, rezultat);
        if (canvas) canvas.render();
        d.zatvori();
        if (!n) alert('Svi preseci već odgovaraju predlogu.');
    }));

    d.podnozje.appendChild(dugme('Zatvori', '', d.zatvori));
}
