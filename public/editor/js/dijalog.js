/** Osnovni okvir modalnog dijaloga — dele ga sve stranice editora. */

import { escapeXml } from './util.js';

export function otvori(naslov, sadrzaj, sirina = 720) {
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

    return { zavesa, telo: zavesa.querySelector('.telo'), podnozje: zavesa.querySelector('footer'), zatvori };
}

export function dugme(tekst, klasa, akcija) {
    const b = document.createElement('button');
    b.textContent = tekst;
    if (klasa) b.className = klasa;
    b.addEventListener('click', akcija);
    return b;
}

/** Upit za jednu vrednost. Vraća uneseni tekst ili null. */
export function pitaj(naslov, opis, podrazumevano = '', tip = 'text') {
    return new Promise(resolve => {
        const telo = document.createElement('div');
        telo.innerHTML = `
            <p class="mala">${escapeXml(opis)}</p>
            <input type="${tip}" ${tip === 'number' ? 'step="any"' : ''} class="upit-polje"
                   value="${escapeXml(podrazumevano)}">`;

        const d = otvori(naslov, telo, 420);
        const input = telo.querySelector('.upit-polje');
        input.focus();
        input.select();

        const zavrsi = (v) => { d.zatvori(); resolve(v); };
        d.podnozje.appendChild(dugme('Odustani', '', () => zavrsi(null)));
        d.podnozje.appendChild(dugme('Potvrdi', 'primarno', () => zavrsi(input.value)));
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') zavrsi(input.value);
            if (e.key === 'Escape') zavrsi(null);
        });
    });
}

/** Jednostavna tabela iz redova i definicije kolona. */
export function tabelaHtml(redovi, kolone) {
    if (!redovi.length) return `<p class="prazno">Nema podataka.</p>`;
    return `<table class="tabela">
        <thead><tr>${kolone.map(k => `<th>${escapeXml(k.naslov)}</th>`).join('')}</tr></thead>
        <tbody>${redovi.map(r => `<tr>${kolone.map(k => `<td>${escapeXml(r[k.kljuc])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}
