/**
 * Sklapanje editora: model + canvas + paneli + izvoz.
 */

import { Model } from './model.js';
import { Canvas } from './canvas.js';
import { renderPaleta, renderSvojstva } from './panel.js';
import { izveziSvg, izveziPng, stampaj } from './export.js';
import { ucitaj, snimi as snimiUSkladiste, noviId, prenos, zapamtiPoslednji, poslednji } from './skladiste.js';
import { otvoriBiblioteku, izveziCrtez } from './biblioteka.js';
import { otvoriGenerator, otvoriTabele, otvoriProracun } from './dijalozi.js';
import { generisi } from './generator.js';

const el = (s) => document.querySelector(s);

let model, canvas, crtezId = null, nazivCrteza = 'Nova šema';
let tajmerAutosave = null;
let neispisaneIzmene = false;

// ── poruke ───────────────────────────────────────────────────────────────────

function poruka(tekst, vrsta = 'info') {
    const box = el('#poruka');
    box.textContent = tekst;
    box.className = `poruka vidljiv ${vrsta}`;
    clearTimeout(poruka._t);
    poruka._t = setTimeout(() => box.classList.remove('vidljiv'), 3200);
}

function status(tekst) { el('#status').textContent = tekst; }

// ── demo šema ────────────────────────────────────────────────────────────────

/** Demo je obična primena generatora — nema odvojenog, ručno složenog crteža. */
function demoModel() {
    return generisi({
        naziv: 'PV elektrana 10 kW — jednopolna šema',
        brojPanela: 24,
        panel: { pmax: 550, voc: 49.8, isc: 13.9 },
        invertera: 1,
        inverter: { snaga: 10, faza: 3, mppt: 2 }
    });
}

// ── snimanje ─────────────────────────────────────────────────────────────────

async function snimi(tiho = false) {
    try {
        const zapis = await snimiUSkladiste({
            id: crtezId, naziv: model.meta.naziv || nazivCrteza, tip: '1L', model: model.toJSON()
        });
        crtezId = zapis.id;
        zapamtiPoslednji('1L', crtezId);
        neispisaneIzmene = false;
        status(`Snimljeno lokalno · ${new Date().toTimeString().slice(0, 5)}`);
        if (!tiho) poruka('Crtež je snimljen u lokalnu biblioteku.', 'uspeh');
    } catch (e) {
        status('Greška pri snimanju');
        poruka(`Snimanje nije uspelo: ${e.message}. Preuzmi crtež kao .json da ga ne izgubiš.`, 'greska');
    }
}

function zakaziAutosave() {
    neispisaneIzmene = true;
    status('Nesnimljene izmene…');
    clearTimeout(tajmerAutosave);
    tajmerAutosave = setTimeout(() => snimi(true), 2000);
}

// ── inicijalizacija ──────────────────────────────────────────────────────────

async function start() {
    const parametri = new URLSearchParams(location.search);
    crtezId = parametri.get('crtez') || poslednji('1L');

    let podaci = null;

    if (crtezId) {
        const zapis = await ucitaj(crtezId);
        if (zapis && zapis.tip === '1L') {
            podaci = zapis.model;
            nazivCrteza = zapis.naziv;
            status(`Otvoren: ${zapis.naziv}`);
        } else {
            crtezId = null;   // zapis je obrisan ili je drugog tipa
        }
    }

    if (!crtezId) crtezId = noviId();

    model = podaci ? new Model(podaci) : demoModel();
    if (!podaci) status('Nov crtež — snima se lokalno');

    canvas = new Canvas(el('#crtez'), model, {
        onIzbor: (ids) => renderSvojstva(el('#svojstva'), model, ids, canvas),
        onPoruka: (t, v) => poruka(t, v)
    });

    model.on(() => {
        renderSvojstva(el('#svojstva'), model, [...canvas.izabrani], canvas);
        zakaziAutosave();
    });

    renderPaleta(el('#paleta'));
    renderSvojstva(el('#svojstva'), model, [], canvas);
    postaviAlatke();
    canvas.uklopiUProzor();

    // Dolazak iz string plana: otvori generator sa već poznatim rasporedom.
    if (parametri.get('izPlana')) {
        const preneto = prenos.preuzmi();
        if (preneto) otvoriGenerator(model, canvas, preneto, preneto);
        else poruka('Nema prenetih podataka iz string plana.', 'greska');
    }

    // Pristup iz konzole pri razvoju i debagovanju
    window.__editor = { model, canvas };

    window.addEventListener('beforeunload', (e) => {
        if (neispisaneIzmene) { e.preventDefault(); e.returnValue = ''; }
    });
}

function postaviAlatke() {
    el('#naziv').value = model.meta.naziv || '';
    el('#naziv').addEventListener('change', (e) => {
        model.meta.naziv = e.target.value;
        zakaziAutosave();
    });

    el('#format').value = `${model.sheet.format}-${model.sheet.orijentacija}`;
    el('#format').addEventListener('change', (e) => {
        const [f, o] = e.target.value.split('-');
        model.sheet.format = f;
        model.sheet.orijentacija = o;
        zakaziAutosave();
    });

    el('#btn-snimi').addEventListener('click', () => snimi(false));
    el('#btn-undo').addEventListener('click', () => { model.undo(); canvas.postaviIzbor([]); });
    el('#btn-redo').addEventListener('click', () => model.redo());
    el('#btn-uklopi').addEventListener('click', () => canvas.uklopiUProzor());
    el('#btn-zoom-plus').addEventListener('click', () => canvas.postaviZoom(canvas.zoom * 1.2));
    el('#btn-zoom-minus').addEventListener('click', () => canvas.postaviZoom(canvas.zoom / 1.2));
    el('#prikaz').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        canvas.postaviPrikaz(b.getAttribute('data-prikaz'));
        el('#prikaz').querySelectorAll('button').forEach(x =>
            x.classList.toggle('aktivan', x === b));
        el('#pomoc-1l').hidden = canvas.prikaz !== '1L';
        el('#pomoc-3l').hidden = canvas.prikaz !== '3L';
    });

    const opcijePrikaza = () => ({ prikaz: canvas.prikaz });
    el('#btn-svg').addEventListener('click', () => izveziSvg(model, opcijePrikaza()));
    el('#btn-png').addEventListener('click', () => izveziPng(model, opcijePrikaza()));
    el('#btn-pdf').addEventListener('click', () => stampaj(model, opcijePrikaza()));

    el('#btn-biblioteka').addEventListener('click', () => otvoriBiblioteku({
        tekuciId: crtezId,
        onPoruka: (t, v) => poruka(t, v)
    }));

    el('#btn-json').addEventListener('click', () =>
        izveziCrtez({ naziv: model.meta.naziv, tip: '1L', model: model.toJSON() }));

    el('#btn-generator').addEventListener('click', () => otvoriGenerator(model, canvas, model.meta));
    el('#btn-tabele').addEventListener('click', () => otvoriTabele(model));
    el('#btn-proracun').addEventListener('click', () => otvoriProracun(model, canvas));

    el('#btn-demo').addEventListener('click', () => {
        if (!confirm('Zameniti trenutni crtež demo šemom?')) return;
        const novi = demoModel();
        model.commit('učitaj demo', () => {
            model.nodes = novi.nodes;
            model.edges = novi.edges;
        });
        canvas.postaviIzbor([]);
        canvas.uklopiUProzor();
    });

    el('#btn-prazno').addEventListener('click', async () => {
        if (!confirm('Napraviti nov crtež? Tekući ostaje u biblioteci.')) return;
        await snimi(true);
        location.href = '/editor?crtez=' + noviId();
    });
}

start();
