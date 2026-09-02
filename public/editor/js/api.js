/**
 * Komunikacija sa /api/seme.
 *
 * Editor radi i bez baze: ako nije otvoren nad konkretnom šemom
 * (/editor bez ID-a), model se čuva u localStorage-u kao radna skica.
 */

const KLJUC_SKICE = 'go4-sema-skica';
const KLJUC_PLAN_SKICE = 'go4-plan-skica';

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

/** Radna skica u localStorage-u — isti interfejs za šemu i za plan. */
export function skicaZa(kljuc) {
    return {
        ucitaj() {
            try {
                const raw = localStorage.getItem(kljuc);
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        },
        snimi(model) {
            try {
                localStorage.setItem(kljuc, JSON.stringify(model));
                return true;
            } catch {
                // najčešći uzrok: podloga u planu je prevelika za localStorage
                return false;
            }
        },
        obrisi() {
            try { localStorage.removeItem(kljuc); } catch { /* ignoriši */ }
        }
    };
}

export const skica = skicaZa(KLJUC_SKICE);
export const planSkica = skicaZa(KLJUC_PLAN_SKICE);

/** Prenos parametara iz string plana u generator jednopolne šeme. */
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
