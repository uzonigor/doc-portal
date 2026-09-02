/**
 * Katalog opreme: moduli i inverteri koji se ponavljaju iz projekta u projekat.
 *
 * Ugrađene stavke su GENERIČKE — tipične vrednosti po klasi snage, ne podaci
 * konkretnog proizvođača. Služe da se brzo krene; svoje stvarne modele
 * projektant dodaje sam iz editora i oni se čuvaju lokalno.
 */

const KLJUC = 'go4-katalog';

/** Tipične vrednosti za monokristalne half-cut module po klasi snage. */
const UGRADJENI_MODULI = [
    {
        id: 'g450', naziv: 'Generički 450 W', ugradjen: true,
        proizvodjac: '', sirina: 1.038, visina: 2.094,
        pmax: 450, voc: 49.5, isc: 11.6, vmpp: 41.2, impp: 10.93
    },
    {
        id: 'g500', naziv: 'Generički 500 W', ugradjen: true,
        proizvodjac: '', sirina: 1.096, visina: 2.176,
        pmax: 500, voc: 49.6, isc: 12.8, vmpp: 41.5, impp: 12.05
    },
    {
        id: 'g550', naziv: 'Generički 550 W', ugradjen: true,
        proizvodjac: '', sirina: 1.134, visina: 2.278,
        pmax: 550, voc: 49.8, isc: 13.9, vmpp: 41.9, impp: 13.13
    },
    {
        id: 'g600', naziv: 'Generički 600 W', ugradjen: true,
        proizvodjac: '', sirina: 1.134, visina: 2.382,
        pmax: 600, voc: 53.7, isc: 14.1, vmpp: 45.1, impp: 13.31
    }
];

const UGRADJENI_INVERTERI = [
    { id: 'i5', naziv: 'Generički 5 kW, 1-fazni', ugradjen: true, proizvodjac: '', model: '', snaga: 5, faza: 1, mppt: 2 },
    { id: 'i6', naziv: 'Generički 6 kW, 3-fazni', ugradjen: true, proizvodjac: '', model: '', snaga: 6, faza: 3, mppt: 2 },
    { id: 'i10', naziv: 'Generički 10 kW, 3-fazni', ugradjen: true, proizvodjac: '', model: '', snaga: 10, faza: 3, mppt: 2 },
    { id: 'i20', naziv: 'Generički 20 kW, 3-fazni', ugradjen: true, proizvodjac: '', model: '', snaga: 20, faza: 3, mppt: 2 },
    { id: 'i50', naziv: 'Generički 50 kW, 3-fazni', ugradjen: true, proizvodjac: '', model: '', snaga: 50, faza: 3, mppt: 4 }
];

function ucitajSvoje() {
    try {
        const d = JSON.parse(localStorage.getItem(KLJUC) || '{}');
        return { moduli: d.moduli || [], inverteri: d.inverteri || [] };
    } catch {
        return { moduli: [], inverteri: [] };
    }
}

function upisiSvoje(d) {
    try { localStorage.setItem(KLJUC, JSON.stringify(d)); return true; }
    catch { return false; }
}

export function moduli() {
    return [...ucitajSvoje().moduli, ...UGRADJENI_MODULI];
}

export function inverteri() {
    return [...ucitajSvoje().inverteri, ...UGRADJENI_INVERTERI];
}

export function nadji(vrsta, id) {
    const spisak = vrsta === 'modul' ? moduli() : inverteri();
    return spisak.find(x => x.id === id) || null;
}

/** Dodaj stavku iz tekućeg crteža u katalog. Vraća { ok } ili { greska }. */
export function dodaj(vrsta, stavka) {
    const naziv = (stavka.naziv || '').trim();
    if (!naziv) return { greska: 'Stavci treba naziv.' };

    const svoje = ucitajSvoje();
    const kljuc = vrsta === 'modul' ? 'moduli' : 'inverteri';

    // isti naziv se prepisuje, da katalog ne bi rastao duplikatima
    const bez = svoje[kljuc].filter(x => x.naziv !== naziv);
    bez.unshift({ ...stavka, naziv, id: `k${Date.now().toString(36)}` });
    svoje[kljuc] = bez;

    return upisiSvoje(svoje) ? { ok: true } : { greska: 'Katalog se ne može upisati.' };
}

export function obrisi(vrsta, id) {
    const svoje = ucitajSvoje();
    const kljuc = vrsta === 'modul' ? 'moduli' : 'inverteri';
    svoje[kljuc] = svoje[kljuc].filter(x => x.id !== id);
    upisiSvoje(svoje);
}

/** Polja koja se prenose iz kataloga u model — bez id-a i naziva stavke. */
export function podaci(stavka) {
    if (!stavka) return {};
    const { id, naziv, ugradjen, ...ostalo } = stavka;
    return ostalo;
}
