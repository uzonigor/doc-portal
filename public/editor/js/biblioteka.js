/**
 * Biblioteka crteža: lista onoga što stoji lokalno, plus razmena `.json`
 * fajlova. Editor nema server iza sebe, pa je fajl jedini način da crtež
 * pređe na drugi računar ili ode kolegi.
 */

import { listaj, ucitaj, snimi, obrisi, preimenuj, uFajl, izFajla, rezervniPut } from './skladiste.js';
import { otvori, dugme, pitaj } from './dijalog.js';
import { preuzmi } from './list.js';
import { escapeXml } from './util.js';

const NAZIV_TIPA = { '1L': 'Jednopolna šema', PLAN: 'String plan' };
const STRANICA = { '1L': '/editor', PLAN: '/plan' };

function datum(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    return `${d.toLocaleDateString('sr-RS')} ${d.toTimeString().slice(0, 5)}`;
}

function velicina(bajtova) {
    if (bajtova > 1024 * 1024) return `${(bajtova / 1024 / 1024).toFixed(1)} MB`;
    if (bajtova > 1024) return `${Math.round(bajtova / 1024)} kB`;
    return `${bajtova} B`;
}

export function imeFajla(naziv, tip) {
    const osnovni = String(naziv || 'crtez').replace(/[^\w\-. ]+/g, '_');
    return `${osnovni}${tip === 'PLAN' ? '-plan' : ''}.go4.json`;
}

/** Preuzmi trenutni crtež kao .json */
export function izveziCrtez(zapis) {
    preuzmi(uFajl(zapis), imeFajla(zapis.naziv, zapis.tip), 'application/json');
}

/**
 * Otvori biblioteku.
 * @param {object} o - { tekuciId, onOtvori(id), onPoruka(tekst, vrsta) }
 */
export async function otvoriBiblioteku(o = {}) {
    const koren = document.createElement('div');
    koren.className = 'biblioteka';

    const d = otvori('Crteži', koren, 820);

    async function osvezi() {
        const stavke = await listaj();

        koren.innerHTML = `
            ${rezervniPut() ? `<ul class="upozorenja"><li>IndexedDB nije dostupan, pa se koristi
                rezervno skladište sa manjim kapacitetom — string plan sa snimkom krova možda neće
                stati. Izvezi ga u <b>.json</b> da ga ne izgubiš.</li></ul>` : ''}

            ${stavke.length ? `<table class="tabela biblioteka-tabela">
                <thead><tr><th>Naziv</th><th>Tip</th><th>Izmenjen</th><th>Veličina</th><th></th></tr></thead>
                <tbody>${stavke.map(z => `
                    <tr class="${z.id === o.tekuciId ? 'tekuci' : ''}" data-id="${z.id}">
                        <td><button class="veza" data-a="otvori" data-id="${z.id}">${escapeXml(z.naziv || '(bez naziva)')}</button>
                            ${z.id === o.tekuciId ? '<span class="znak">otvoren</span>' : ''}</td>
                        <td>${escapeXml(NAZIV_TIPA[z.tip] || z.tip)}</td>
                        <td>${escapeXml(datum(z.izmenjeno))}</td>
                        <td>${escapeXml(velicina(z.velicina))}</td>
                        <td class="akcije-red">
                            <button data-a="izvezi" data-id="${z.id}" title="Preuzmi kao .json">↓</button>
                            <button data-a="preimenuj" data-id="${z.id}" title="Preimenuj">✎</button>
                            <button data-a="obrisi" data-id="${z.id}" class="mala-opasna" title="Obriši">×</button>
                        </td>
                    </tr>`).join('')}</tbody>
            </table>` : `<p class="prazno">Nema sačuvanih crteža. Napravi nov ili uvezi <b>.json</b>.</p>`}`;

        koren.querySelectorAll('button[data-a]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const a = btn.getAttribute('data-a');
                const id = btn.getAttribute('data-id');

                if (a === 'otvori') {
                    const zapis = await ucitaj(id);
                    if (!zapis) return;
                    d.zatvori();
                    if (o.onOtvori) o.onOtvori(zapis);
                    else location.href = `${STRANICA[zapis.tip] || '/editor'}?crtez=${id}`;
                }

                if (a === 'izvezi') {
                    const zapis = await ucitaj(id);
                    if (zapis) izveziCrtez(zapis);
                }

                if (a === 'preimenuj') {
                    const zapis = await ucitaj(id);
                    const novi = await pitaj('Preimenuj crtež', 'Nov naziv:', zapis?.naziv || '');
                    if (novi !== null && novi.trim()) { await preimenuj(id, novi.trim()); osvezi(); }
                }

                if (a === 'obrisi') {
                    const zapis = await ucitaj(id);
                    if (!confirm(`Obrisati "${zapis?.naziv || id}"? Izvezi ga u .json ako ti treba kasnije.`)) return;
                    await obrisi(id);
                    osvezi();
                }
            });
        });
    }

    await osvezi();

    // ── uvoz iz fajla ────────────────────────────────────────────────────────
    const unos = document.createElement('input');
    unos.type = 'file';
    unos.accept = '.json,application/json';
    unos.hidden = true;
    unos.addEventListener('change', async () => {
        const f = unos.files && unos.files[0];
        if (!f) return;
        try {
            const zapis = izFajla(await f.text());
            await snimi(zapis);
            await osvezi();
            if (o.onPoruka) o.onPoruka(`Uvezen crtež „${zapis.naziv}".`, 'uspeh');
        } catch (e) {
            if (o.onPoruka) o.onPoruka(e.message, 'greska');
            else alert(e.message);
        }
        unos.value = '';
    });
    koren.appendChild(unos);

    d.podnozje.appendChild(dugme('Uvezi .json', '', () => unos.click()));
    d.podnozje.appendChild(dugme('Zatvori', 'primarno', d.zatvori));

    return d;
}
