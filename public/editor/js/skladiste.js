/**
 * Lokalna biblioteka crteža.
 *
 * Editor ne zavisi od servera ni od baze: crteži se čuvaju u browseru, a
 * razmenjuju kao `.json` fajlovi.
 *
 * Koristi IndexedDB, ne localStorage — string plan sa učitanim snimkom krova
 * ume da bude par megabajta, a localStorage puca već na ~5 MB za ceo sajt.
 * Ako IndexedDB nije dostupan (privatni prozor, stara podešavanja), pada se
 * na localStorage uz jasnu poruku da veliki planovi možda neće stati.
 */

const BAZA = 'go4-crtezi';
const SKLADISTE = 'crtezi';
const VERZIJA = 1;

const KLJUC_LS = 'go4-crtezi-fallback';

let veza = null;
let indexedDbRadi = true;

function otvoriBazu() {
    if (veza) return Promise.resolve(veza);

    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            indexedDbRadi = false;
            reject(new Error('IndexedDB nije dostupan'));
            return;
        }

        const zahtev = indexedDB.open(BAZA, VERZIJA);

        zahtev.onupgradeneeded = () => {
            const db = zahtev.result;
            if (!db.objectStoreNames.contains(SKLADISTE)) {
                const store = db.createObjectStore(SKLADISTE, { keyPath: 'id' });
                store.createIndex('izmenjeno', 'izmenjeno');
            }
        };

        zahtev.onsuccess = () => { veza = zahtev.result; resolve(veza); };
        zahtev.onerror = () => { indexedDbRadi = false; reject(zahtev.error); };
    });
}

function transakcija(nacin, fn) {
    return otvoriBazu().then(db => new Promise((resolve, reject) => {
        const t = db.transaction(SKLADISTE, nacin);
        const store = t.objectStore(SKLADISTE);
        let rezultat;
        try { rezultat = fn(store); } catch (e) { reject(e); return; }
        t.oncomplete = () => resolve(rezultat && rezultat.result !== undefined ? rezultat.result : rezultat);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
    }));
}

// ── rezervni put kroz localStorage ───────────────────────────────────────────

function lsSve() {
    try {
        return JSON.parse(localStorage.getItem(KLJUC_LS) || '{}');
    } catch {
        return {};
    }
}

function lsUpisi(sve) {
    localStorage.setItem(KLJUC_LS, JSON.stringify(sve));
}

// ── javni interfejs ──────────────────────────────────────────────────────────

export function noviId() {
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Zapis: { id, naziv, tip: '1L' | 'PLAN', model, izmenjeno, kreiran } */
export async function snimi(zapis) {
    const potpun = {
        ...zapis,
        id: zapis.id || noviId(),
        izmenjeno: Date.now(),
        kreiran: zapis.kreiran || Date.now()
    };

    try {
        await transakcija('readwrite', store => store.put(potpun));
    } catch {
        const sve = lsSve();
        sve[potpun.id] = potpun;
        lsUpisi(sve);   // baca QuotaExceededError kad ne stane — pušta se dalje
    }

    return potpun;
}

export async function ucitaj(id) {
    try {
        return await transakcija('readonly', store => store.get(id)) || null;
    } catch {
        return lsSve()[id] || null;
    }
}

/** Lista bez modela — za prikaz biblioteke. */
export async function listaj() {
    let zapisi;
    try {
        zapisi = await transakcija('readonly', store => store.getAll());
    } catch {
        zapisi = Object.values(lsSve());
    }

    return (zapisi || [])
        .map(z => ({
            id: z.id,
            naziv: z.naziv,
            tip: z.tip,
            izmenjeno: z.izmenjeno,
            kreiran: z.kreiran,
            velicina: JSON.stringify(z.model || {}).length
        }))
        .sort((a, b) => (b.izmenjeno || 0) - (a.izmenjeno || 0));
}

export async function obrisi(id) {
    try {
        await transakcija('readwrite', store => store.delete(id));
    } catch {
        const sve = lsSve();
        delete sve[id];
        lsUpisi(sve);
    }
}

export async function preimenuj(id, naziv) {
    const z = await ucitaj(id);
    if (!z) return null;
    return snimi({ ...z, naziv });
}

/** Da li se koristi rezervni put (pa važe ograničenja localStorage-a). */
export function rezervniPut() {
    return !indexedDbRadi;
}

// ── razmena .json fajlova ────────────────────────────────────────────────────

const POTPIS = 'go4-crtez';

export function uFajl(zapis) {
    return JSON.stringify({
        potpis: POTPIS,
        verzija: 1,
        naziv: zapis.naziv,
        tip: zapis.tip,
        izvezeno: new Date().toISOString(),
        model: zapis.model
    }, null, 2);
}

/**
 * Pročitaj `.json` i vrati zapis spreman za biblioteku.
 * Baca grešku sa jasnom porukom ako fajl nije crtež.
 */
export function izFajla(tekst) {
    let d;
    try {
        d = JSON.parse(tekst);
    } catch {
        throw new Error('Fajl nije ispravan JSON.');
    }

    if (d.potpis !== POTPIS || !d.model) {
        throw new Error('Ovo nije crtež iz GO4 editora.');
    }

    const tip = d.tip === 'PLAN' ? 'PLAN' : '1L';
    const model = d.model;

    const ispravan = tip === 'PLAN'
        ? Array.isArray(model.polja) && Array.isArray(model.stringovi)
        : Array.isArray(model.nodes) && Array.isArray(model.edges);

    if (!ispravan) {
        throw new Error(`Sadržaj ne odgovara tipu crteža (${tip}).`);
    }

    return {
        id: noviId(),
        naziv: d.naziv || (tip === 'PLAN' ? 'Uvezen plan' : 'Uvezena šema'),
        tip,
        model
    };
}

// ── prenos iz string plana u generator jednopolne ────────────────────────────

const KLJUC_PRENOSA = 'go4-iz-plana';

export const prenos = {
    postavi(parametri) {
        try { localStorage.setItem(KLJUC_PRENOSA, JSON.stringify(parametri)); return true; }
        catch { return false; }
    },
    preuzmi() {
        try {
            const raw = localStorage.getItem(KLJUC_PRENOSA);
            localStorage.removeItem(KLJUC_PRENOSA);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }
};

// ── poslednji otvoren crtež po tipu ──────────────────────────────────────────

export function zapamtiPoslednji(tip, id) {
    try { localStorage.setItem(`go4-poslednji-${tip}`, id); } catch { /* ignoriši */ }
}

export function poslednji(tip) {
    try { return localStorage.getItem(`go4-poslednji-${tip}`); } catch { return null; }
}
