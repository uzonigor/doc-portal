/**
 * Sklapanje editora: model + canvas + paneli + izvoz.
 */

import { Model } from './model.js';
import { Canvas } from './canvas.js';
import { renderPaleta, renderSvojstva } from './panel.js';
import { izveziSvg, izveziPng, stampaj } from './export.js';
import { api, skica } from './api.js';

const el = (s) => document.querySelector(s);

let model, canvas, semaId = null, projektaId = null;
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

function demoModel() {
    const m = new Model({ meta: { naziv: 'PV elektrana 10 kW — jednopolna šema', projektant: '', brojProjekta: '' } });

    const dodaj = (type, x, y, props) => {
        const n = m.addNode(type, { x, y });
        if (props) Object.assign(n.props, props);
        return n;
    };

    const s1 = dodaj('pv_string', 0, 30, { modula: 12, pmax: 550 });
    const s2 = dodaj('pv_string', 0, 200, { modula: 12, pmax: 550 });
    const q1 = dodaj('dc_prekidac', 220, 30);
    const q2 = dodaj('dc_prekidac', 220, 200);
    const inv = dodaj('inverter_3f', 400, 70, { snaga: 10, mppt: 2 });
    const q3 = dodaj('ac_prekidac', 620, 70, { struja: 20, polova: '3P+N' });
    const spdAc = dodaj('ac_spd', 650, 260);
    const fid = dodaj('fid', 790, 70);
    const br = dodaj('brojilo', 950, 60);
    const kpk = dodaj('kpk', 1110, 60);
    const mreza = dodaj('mreza', 1280, 70);
    const pe = dodaj('uzemljenje', 430, 300);

    m.addEdge(`${s1.id}:dc+`, `${q1.id}:in`);
    m.addEdge(`${q1.id}:out`, `${inv.id}:dc1+`);
    m.addEdge(`${s2.id}:dc+`, `${q2.id}:in`);
    m.addEdge(`${q2.id}:out`, `${inv.id}:dc2+`);
    m.addEdge(`${inv.id}:L1`, `${q3.id}:in`);
    m.addEdge(`${q3.id}:out`, `${fid.id}:in`);
    m.addEdge(`${fid.id}:out`, `${br.id}:in`);
    m.addEdge(`${br.id}:out`, `${kpk.id}:in`);
    m.addEdge(`${kpk.id}:out`, `${mreza.id}:in`);
    m.addEdge(`${inv.id}:PE`, `${pe.id}:in`);
    m.addEdge(`${q3.id}:out`, `${spdAc.id}:in`);

    m.undoStack = [];
    return m;
}

// ── snimanje ─────────────────────────────────────────────────────────────────

async function snimi(tiho = false) {
    if (semaId) {
        try {
            await api.snimi(semaId, { naziv: model.meta.naziv, model: model.toJSON() });
            neispisaneIzmene = false;
            status('Snimljeno u bazu');
            if (!tiho) poruka('Šema je snimljena.', 'uspeh');
        } catch (e) {
            status('Greška pri snimanju');
            poruka(`Snimanje nije uspelo: ${e.message}`, 'greska');
        }
    } else {
        skica.snimi(model.toJSON());
        neispisaneIzmene = false;
        status('Snimljeno lokalno (radna skica)');
        if (!tiho) poruka('Snimljeno u lokalnu skicu. Otvori šemu iz projekta da bi se čuvala u bazi.', 'info');
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
    const putanja = location.pathname.match(/\/editor\/sema\/(\d+)/);
    const parametri = new URLSearchParams(location.search);
    semaId = putanja ? parseInt(putanja[1], 10) : null;
    projektaId = parametri.get('projekat') ? parseInt(parametri.get('projekat'), 10) : null;

    let podaci = null;

    if (semaId) {
        try {
            const sema = await api.ucitaj(semaId);
            podaci = sema.model;
            projektaId = sema.projektaId;
            if (sema.projekat) {
                podaci.meta = Object.assign({}, podaci.meta, {
                    investitor: sema.projekat.kupac?.naziv || '',
                    lokacija: sema.projekat.lokacija || ''
                });
            }
            status(`Šema #${semaId}`);
        } catch (e) {
            poruka(`Ne mogu da učitam šemu: ${e.message}`, 'greska');
        }
    } else {
        podaci = skica.ucitaj();
        status('Radna skica (localStorage)');
    }

    model = podaci ? new Model(podaci) : demoModel();

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
    el('#btn-svg').addEventListener('click', () => izveziSvg(model));
    el('#btn-png').addEventListener('click', () => izveziPng(model));
    el('#btn-pdf').addEventListener('click', () => stampaj(model));

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

    el('#btn-prazno').addEventListener('click', () => {
        if (!confirm('Obrisati ceo crtež?')) return;
        model.commit('novi crtež', () => { model.nodes = []; model.edges = []; });
        canvas.postaviIzbor([]);
    });
}

start();
