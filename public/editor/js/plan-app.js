/**
 * Sklapanje editora string plana.
 */

import { PlanModel } from './plan-model.js';
import { PlanCanvas } from './plan-canvas.js';
import { renderPlanSvojstva } from './plan-panel.js';
import { izveziSvg, izveziPng, stampaj } from './plan-export.js';
import { api, planSkica, prenos } from './api.js';
import { TIPOVI_OPREME } from './plan-model.js';
import { izvestajDuzina } from './plan-trase.js';
import { escapeXml } from './util.js';

const el = (s) => document.querySelector(s);

// Podloga se pamti u modelu kao data: URL, pa je ograničavamo da JSON
// ostane razumne veličine i za localStorage i za bazu.
const MAX_STRANICA_PODLOGE = 2000;
const KVALITET_PODLOGE = 0.82;

let model, canvas, planId = null, projektaId = null;
let tajmerAutosave = null;
let neispisaneIzmene = false;

function poruka(tekst, vrsta = 'info') {
    const box = el('#poruka');
    box.textContent = tekst;
    box.className = `poruka vidljiv ${vrsta}`;
    clearTimeout(poruka._t);
    poruka._t = setTimeout(() => box.classList.remove('vidljiv'), 3600);
}

function status(tekst) { el('#status').textContent = tekst; }

// ── mali upitni dijalog ──────────────────────────────────────────────────────

function pitaj(naslov, opis, podrazumevano) {
    return new Promise(resolve => {
        const zavesa = document.createElement('div');
        zavesa.className = 'zavesa';
        zavesa.innerHTML = `
            <div class="dijalog" style="max-width:420px">
                <header><h3>${escapeXml(naslov)}</h3></header>
                <div class="telo">
                    <p class="mala">${escapeXml(opis)}</p>
                    <input type="number" step="any" class="upit-polje" value="${escapeXml(podrazumevano)}">
                </div>
                <footer>
                    <button data-a="ne">Odustani</button>
                    <button data-a="da" class="primarno">Potvrdi</button>
                </footer>
            </div>`;
        document.body.appendChild(zavesa);

        const input = zavesa.querySelector('.upit-polje');
        input.focus();
        input.select();

        const zatvori = (v) => { zavesa.remove(); resolve(v); };
        zavesa.querySelector('[data-a="ne"]').addEventListener('click', () => zatvori(null));
        zavesa.querySelector('[data-a="da"]').addEventListener('click', () => zatvori(parseFloat(input.value)));
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') zatvori(parseFloat(input.value));
            if (e.key === 'Escape') zatvori(null);
        });
    });
}

// ── podloga ──────────────────────────────────────────────────────────────────

/** Smanji sliku pre upisa u model — sirov snimak ume da bude i 10 MB. */
function pripremiPodlogu(file) {
    return new Promise((resolve, reject) => {
        const citac = new FileReader();
        citac.onload = () => {
            const img = new Image();
            img.onload = () => {
                const faktor = Math.min(1, MAX_STRANICA_PODLOGE / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * faktor);
                c.height = Math.round(img.height * faktor);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                resolve({ dataUrl: c.toDataURL('image/jpeg', KVALITET_PODLOGE), odnos: img.width / img.height });
            };
            img.onerror = () => reject(new Error('Slika se ne može učitati'));
            img.src = citac.result;
        };
        citac.onerror = () => reject(new Error('Fajl se ne može pročitati'));
        citac.readAsDataURL(file);
    });
}

async function ucitajPodlogu(file) {
    try {
        status('Obrada snimka…');
        const { dataUrl, odnos } = await pripremiPodlogu(file);
        model.commit('učitaj podlogu', () => {
            const sirina = model.podloga.sirina || 20;
            model.podloga.slika = dataUrl;
            model.podloga.visina = sirina / odnos;
        });
        canvas.uklopiUProzor();
        poruka('Snimak je učitan. Sada ga kalibriši alatom "Kalibracija".', 'uspeh');
    } catch (e) {
        poruka(e.message, 'greska');
    }
}

async function kalibrisi(duzinaNaCrtezu, od) {
    const stvarna = await pitaj(
        'Kalibracija podloge',
        `Povučena duž je trenutno ${duzinaNaCrtezu.toFixed(2)} m. Koliko iznosi u stvarnosti?`,
        duzinaNaCrtezu.toFixed(2));

    if (!stvarna || stvarna <= 0) return;

    const f = stvarna / duzinaNaCrtezu;
    model.commit('kalibriši podlogu', () => {
        const p = model.podloga;
        // skaliramo oko početne tačke duži da se podloga ne odseli
        p.x = od.x + (p.x - od.x) * f;
        p.y = od.y + (p.y - od.y) * f;
        p.sirina *= f;
        p.visina *= f;
    });
    canvas.postaviAlat('izbor');
    osveziAlate();
    poruka(`Razmera podešena — podloga je sada ${model.podloga.sirina.toFixed(1)} × ${model.podloga.visina.toFixed(1)} m.`, 'uspeh');
}

// ── snimanje ─────────────────────────────────────────────────────────────────

async function snimi(tiho = false) {
    if (planId) {
        try {
            await api.snimi(planId, { naziv: model.meta.naziv, model: model.toJSON() });
            neispisaneIzmene = false;
            status('Snimljeno u bazu');
            if (!tiho) poruka('Plan je snimljen.', 'uspeh');
        } catch (e) {
            status('Greška pri snimanju');
            poruka(`Snimanje nije uspelo: ${e.message}`, 'greska');
        }
    } else {
        const uspelo = planSkica.snimi(model.toJSON());
        neispisaneIzmene = false;
        status(uspelo ? 'Snimljeno lokalno (radna skica)' : 'Lokalna skica je prepunjena');
        if (!tiho && !uspelo) {
            poruka('Skica ne staje u lokalnu memoriju — verovatno zbog podloge. Otvori plan iz projekta da bi se čuvao u bazi.', 'greska');
        } else if (!tiho) {
            poruka('Snimljeno u lokalnu skicu.', 'info');
        }
    }
}

function zakaziAutosave() {
    neispisaneIzmene = true;
    status('Nesnimljene izmene…');
    clearTimeout(tajmerAutosave);
    tajmerAutosave = setTimeout(() => snimi(true), 2500);
}

// ── prelaz na jednopolnu ─────────────────────────────────────────────────────

function uJednopolnu() {
    const raspodela = model.raspodelaStringova();
    if (!raspodela.length) {
        poruka('Nijedan modul nije dodeljen stringu — nema šta da se prenese.', 'greska');
        return;
    }

    const maxMppt = Math.max(...raspodela.flat().map(s => s.mppt));
    const duzine = izvestajDuzina(model);

    prenos.postavi({
        duzine: {
            stringovi: duzine.stringovi.map(s => ({
                oznaka: s.oznaka, inverter: s.inverter, mppt: s.mppt,
                modula: s.modula, ozicenje: s.ozicenje, vod: s.vod, ukupno: s.ukupno,
                presek: s.predlog ? s.predlog.presek : null
            })),
            ac: duzine.ac
        },
        proracun: model.proracun,
        naziv: `${model.meta.naziv} — jednopolna šema`,
        investitor: model.meta.investitor,
        lokacija: model.meta.lokacija,
        projektant: model.meta.projektant,
        brojProjekta: model.meta.brojProjekta,
        panel: {
            pmax: model.modul.pmax,
            voc: model.modul.voc,
            isc: model.modul.isc,
            proizvodjac: model.modul.proizvodjac
        },
        inverter: { mppt: Math.max(1, maxMppt), faza: 3, snaga: 10 },
        raspodelaStringova: raspodela
    });

    snimi(true);
    location.href = projektaId ? `/editor?izPlana=1&projekat=${projektaId}` : '/editor?izPlana=1';
}

// ── alati ────────────────────────────────────────────────────────────────────

const ALATI = [
    { id: 'izbor', naziv: 'Izbor', opis: 'Biranje i pomeranje krovnih ravni' },
    { id: 'boji', naziv: 'Boji', opis: 'Prevlačenjem dodeljuješ module aktivnom stringu' },
    { id: 'iskljuci', naziv: 'Isključi', opis: 'Dimnjak, prozor, senka — modul se ne računa' },
    { id: 'oprema', naziv: 'Oprema', opis: 'Klikom postavljaš inverter ili orman — odatle se mere trase' },
    { id: 'podloga', naziv: 'Podloga', opis: 'Prevlačenje učitanog snimka' },
    { id: 'kalibracija', naziv: 'Kalibracija', opis: 'Povuci duž poznate dužine da podesiš razmeru' }
];

function osveziAlate() {
    document.querySelectorAll('#alati button').forEach(b => {
        b.classList.toggle('aktivan', b.getAttribute('data-alat') === canvas.alat);
    });
    el('#alat-opis').textContent = (ALATI.find(a => a.id === canvas.alat) || {}).opis || '';
}

// ── inicijalizacija ──────────────────────────────────────────────────────────

async function start() {
    const putanja = location.pathname.match(/\/plan\/(\d+)/);
    const parametri = new URLSearchParams(location.search);
    planId = putanja ? parseInt(putanja[1], 10) : null;
    projektaId = parametri.get('projekat') ? parseInt(parametri.get('projekat'), 10) : null;

    let podaci = null;

    if (planId) {
        try {
            const zapis = await api.ucitaj(planId);
            podaci = zapis.model;
            projektaId = zapis.projektaId;
            if (zapis.projekat) {
                podaci.meta = Object.assign({}, podaci.meta, {
                    investitor: zapis.projekat.kupac?.naziv || '',
                    lokacija: zapis.projekat.lokacija || ''
                });
            }
            status(`Plan #${planId}`);
        } catch (e) {
            poruka(`Ne mogu da učitam plan: ${e.message}`, 'greska');
        }
    } else {
        podaci = planSkica.ucitaj();
        status('Radna skica (localStorage)');
    }

    model = podaci ? new PlanModel(podaci) : demoPlan();

    canvas = new PlanCanvas(el('#crtez'), model, {
        onIzbor: (ids) => renderPlanSvojstva(el('#svojstva'), model, ids, canvas),
        onPoruka: (t, v) => poruka(t, v),
        onKalibracija: (duzina, od) => kalibrisi(duzina, od)
    });
    canvas.onUcitajPodlogu = ucitajPodlogu;

    model.on(() => {
        renderPlanSvojstva(el('#svojstva'), model, [...canvas.izabrani], canvas);
        zakaziAutosave();
    });

    renderPlanSvojstva(el('#svojstva'), model, [], canvas);
    postaviAlatke();
    canvas.uklopiUProzor();

    window.__plan = { model, canvas };

    window.addEventListener('beforeunload', (e) => {
        if (neispisaneIzmene) { e.preventDefault(); e.returnValue = ''; }
    });
}

/** Početni plan: jedna krovna ravan i dva stringa, da se odmah vidi kako radi. */
function demoPlan() {
    const m = new PlanModel({ meta: { naziv: 'String plan' } });
    const polje = m.addPolje({ x: 2, y: 2 }, { redova: 3, kolona: 8 });
    const s1 = m.addString({ oznaka: 'S1', inverter: 1, mppt: 1 });
    const s2 = m.addString({ oznaka: 'S2', inverter: 1, mppt: 2 });

    m.commit('početna dodela', () => {
        for (let r = 0; r < polje.redova; r++) {
            for (let c = 0; c < polje.kolona; c++) {
                m.postaviModulLive(polje.id, r, c, { string: r < 2 ? s1.id : s2.id });
            }
        }
    });

    m.undoStack = [];
    m.redoStack = [];
    return m;
}

function postaviAlatke() {
    el('#naziv').value = model.meta.naziv || '';
    el('#naziv').addEventListener('change', e => {
        model.meta.naziv = e.target.value;
        zakaziAutosave();
    });

    el('#format').value = `${model.sheet.format}-${model.sheet.orijentacija}`;
    el('#format').addEventListener('change', e => {
        const [f, o] = e.target.value.split('-');
        model.sheet.format = f;
        model.sheet.orijentacija = o;
        zakaziAutosave();
    });

    el('#alati').innerHTML = ALATI.map(a =>
        `<button data-alat="${a.id}" title="${escapeXml(a.opis)}">${escapeXml(a.naziv)}</button>`).join('');
    el('#alati').addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        canvas.postaviAlat(b.getAttribute('data-alat'));
        osveziAlate();
    });
    canvas.onPromenaAlata = osveziAlate;

    el('#tip-opreme').innerHTML = Object.entries(TIPOVI_OPREME)
        .map(([k, d]) => `<option value="${k}">${escapeXml(d.naziv)}</option>`).join('');
    el('#tip-opreme').addEventListener('change', e => { canvas.tipOpreme = e.target.value; });

    el('#prikazi-trase').addEventListener('change', e => {
        canvas.prikaziTrase = e.target.checked;
        canvas.render();
    });

    osveziAlate();

    el('#btn-polje').addEventListener('click', () => {
        const r = canvas.svg.getBoundingClientRect();
        const centar = {
            x: (r.width / 2 - canvas.pan.x) / canvas.zoom / 100,
            y: (r.height / 2 - canvas.pan.y) / canvas.zoom / 100
        };
        const p = model.addPolje({ x: canvas.naSnap(centar.x), y: canvas.naSnap(centar.y) });
        canvas.postaviAlat('izbor');
        osveziAlate();
        canvas.postaviIzbor([p.id]);
    });

    el('#btn-undo').addEventListener('click', () => { model.undo(); canvas.postaviIzbor([]); });
    el('#btn-redo').addEventListener('click', () => model.redo());
    el('#btn-uklopi').addEventListener('click', () => canvas.uklopiUProzor());
    el('#btn-zoom-plus').addEventListener('click', () => canvas.postaviZoom(canvas.zoom * 1.2));
    el('#btn-zoom-minus').addEventListener('click', () => canvas.postaviZoom(canvas.zoom / 1.2));
    el('#btn-svg').addEventListener('click', () => izveziSvg(model));
    el('#btn-png').addEventListener('click', () => izveziPng(model));
    el('#btn-pdf').addEventListener('click', () => stampaj(model));
    el('#btn-snimi').addEventListener('click', () => snimi(false));
    el('#btn-jednopolna').addEventListener('click', uJednopolnu);
}

start();
