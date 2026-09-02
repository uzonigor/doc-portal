/**
 * Komunikacija sa /api/seme.
 *
 * Editor radi i bez baze: ako nije otvoren nad konkretnom šemom
 * (/editor bez ID-a), model se čuva u localStorage-u kao radna skica.
 */

const KLJUC_SKICE = 'go4-sema-skica';

async function zahtev(url, opcije = {}) {
    const r = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opcije
    });
    if (!r.ok) {
        const telo = await r.json().catch(() => ({}));
        throw new Error(telo.error || `HTTP ${r.status}`);
    }
    return r.json();
}

export const api = {
    listaSema: (projektaId) => zahtev(`/api/seme/projekat/${projektaId}`),

    ucitaj: (id) => zahtev(`/api/seme/${id}`),

    kreiraj: (podaci) => zahtev('/api/seme', {
        method: 'POST',
        body: JSON.stringify(podaci)
    }),

    snimi: (id, podaci) => zahtev(`/api/seme/${id}`, {
        method: 'PUT',
        body: JSON.stringify(podaci)
    }),

    obrisi: (id) => zahtev(`/api/seme/${id}`, { method: 'DELETE' })
};

export const skica = {
    ucitaj() {
        try {
            const raw = localStorage.getItem(KLJUC_SKICE);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },
    snimi(model) {
        try {
            localStorage.setItem(KLJUC_SKICE, JSON.stringify(model));
            return true;
        } catch {
            return false;
        }
    },
    obrisi() {
        try { localStorage.removeItem(KLJUC_SKICE); } catch { /* ignoriši */ }
    }
};
