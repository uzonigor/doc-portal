/**
 * Proračun preseka provodnika — BAKAR.
 *
 * Presek je PREDLOG koji projektant potvrđuje, ne konačna vrednost.
 * Alat bira najmanji standardni presek koji istovremeno zadovoljava:
 *   1. dozvoljeni pad napona
 *   2. strujnu opteretljivost (Iz ≥ Ib, sa faktorima korekcije)
 *
 * Formule (bakar, otporni deo; reaktansa se zanemaruje, što je na presecima
 * do ~120 mm² i dužinama u PV instalacijama na strani sigurnosti):
 *
 *   DC (dvožilno):      ΔU = 2 · L · I / (κ · S)
 *   AC jednofazno:      ΔU = 2 · L · I · cosφ / (κ · S)
 *   AC trofazno:        ΔU = √3 · L · I · cosφ / (κ · S)
 *
 *   L [m], I [A], S [mm²], κ [m/(Ω·mm²)], ΔU [V]
 *
 * Otuda minimalni presek za zadati pad:
 *   S = k · L · I · cosφ / (κ · ΔU_dozv),  k = 2 (DC, 1-f) ili √3 (3-f)
 */

/** Specifična provodnost bakra na 20 °C. */
export const KAPA_CU_20 = 56;

/**
 * Na radnoj temperaturi provodnika otpornost raste. Za PVC izolaciju (70 °C)
 * κ padne na ~48, za 90 °C izolaciju na ~44. Konzervativniji izbor daje veći
 * presek, pa je podrazumevano 56 (20 °C) uz mogućnost pooštravanja.
 */
export const KAPA_CU_70 = 48;
export const KAPA_CU_90 = 44;

/** Standardni preseci bakarnih provodnika. */
export const PRESECI = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

/**
 * Strujna opteretljivost Iz [A], bakar.
 *
 * PV1-F / H1Z2Z2-K (EN 50618): slobodno u vazduhu, ambijent 60 °C —
 * referentni uslovi za kablove na krovu.
 */
export const IZ_PV1F = { 1.5: 30, 2.5: 41, 4: 55, 6: 70, 10: 98, 16: 132, 25: 176, 35: 218, 50: 276 };

/**
 * NYY-J (PVC, 70 °C), način polaganja C (na zidu / u kanalici),
 * po IEC 60364-5-52, ambijent 30 °C.
 */
export const IZ_NYY_2 = { 1.5: 19.5, 2.5: 26, 4: 35, 6: 46, 10: 63, 16: 85, 25: 112, 35: 138, 50: 168, 70: 213, 95: 258, 120: 299, 150: 344, 185: 392, 240: 461 };
export const IZ_NYY_3 = { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 96, 35: 119, 50: 144, 70: 184, 95: 223, 120: 259, 150: 299, 185: 341, 240: 403 };

export const PODRAZUMEVANI_PARAMETRI = {
    kapa: KAPA_CU_20,

    /**
     * GRANIČNI pad — jedini koji diže presek. Ispod njega instalacija je
     * ispravna, pa nema razloga da alat sam predlaže deblji kabl.
     */
    padDC: 3,
    padAC: 3,

    /**
     * CILJNI pad — projektantski cilj efikasnosti. Ne diže presek, samo se
     * prijavljuje kao napomena, da se vidi gde se gubi energija.
     */
    ciljniPadDC: 1,
    ciljniPadAC: 1,
    cosFi: 1,          // PV inverteri po pravilu rade sa cosφ = 1
    faktorTemp: 1,     // korekcija za temperaturu ambijenta
    faktorGrupisanja: 1, // korekcija za broj kablova u snopu

    /**
     * Najmanji presek koji se u praksi ugrađuje, bez obzira na račun.
     * Na kratkim stringovima proračun bi dao 1,5 mm², što se ne postavlja —
     * i zbog mehaničke otpornosti i zbog konektora. Na DC strani je usvojen
     * 6 mm² kao kućni standard.
     */
    minPresekDC: 6,
    minPresekAC: 2.5
};

/** Faktor u formuli pada napona po tipu sistema. */
function faktorSistema(sistem) {
    if (sistem === 'AC3') return Math.sqrt(3);
    return 2;   // DC i jednofazno AC — struja ide i vraća se
}

/** Tabela opteretljivosti za dati sistem i tip kabla. */
function tabelaIz(sistem, tipKabla) {
    if (sistem === 'DC' || /PV1|H1Z2Z2/i.test(tipKabla || '')) return IZ_PV1F;
    return sistem === 'AC3' ? IZ_NYY_3 : IZ_NYY_2;
}

/** Pad napona [V] za zadati presek. */
export function padNapona({ sistem, duzina, struja, presek, cosFi = 1, kapa = KAPA_CU_20 }) {
    if (!presek || !kapa) return 0;
    const k = faktorSistema(sistem);
    const fi = sistem === 'DC' ? 1 : cosFi;
    return (k * duzina * struja * fi) / (kapa * presek);
}

/** Minimalni presek [mm²] iz uslova pada napona (pre zaokruživanja). */
export function presekIzPada({ sistem, duzina, struja, napon, dozvoljenPad, cosFi = 1, kapa = KAPA_CU_20 }) {
    const dU = (napon * dozvoljenPad) / 100;
    if (dU <= 0) return Infinity;
    const k = faktorSistema(sistem);
    const fi = sistem === 'DC' ? 1 : cosFi;
    return (k * duzina * struja * fi) / (kapa * dU);
}

/** Efektivna opteretljivost sa faktorima korekcije. */
export function opteretljivost(presek, sistem, tipKabla, p = PODRAZUMEVANI_PARAMETRI) {
    const tabela = tabelaIz(sistem, tipKabla);
    const osnovna = tabela[presek];
    if (osnovna === undefined) return null;
    return osnovna * (p.faktorTemp ?? 1) * (p.faktorGrupisanja ?? 1);
}

function sledeciPresek(minimalni, sistem, tipKabla) {
    const dostupni = PRESECI.filter(s => tabelaIz(sistem, tipKabla)[s] !== undefined);
    return dostupni.find(s => s >= minimalni) ?? null;
}

/**
 * Predlog preseka.
 *
 * @param {object} o
 * @param {'DC'|'AC1'|'AC3'} o.sistem
 * @param {number} o.duzina       - dužina trase [m], po provodniku
 * @param {number} o.struja       - radna struja za pad napona (Impp, odn. Ib) [A]
 * @param {number} o.strujaZastite- struja za opteretljivost (1,25·Isc, odn. In) [A]
 * @param {number} o.napon        - referentni napon [V] (Umpp niza, odn. mrežni)
 * @param {number} o.dozvoljenPad - dozvoljeni pad [%]
 * @param {string} o.tipKabla
 * @param {object} p              - parametri proračuna
 */
export function predlogPreseka(o, p = PODRAZUMEVANI_PARAMETRI) {
    const par = { ...PODRAZUMEVANI_PARAMETRI, ...p };
    const struja = o.struja || 0;
    const strujaZastite = o.strujaZastite || struja;

    if (!o.duzina || !struja || !o.napon) {
        return { presek: null, razlog: 'nedostaju podaci', poruke: ['Nedostaje dužina, struja ili napon.'] };
    }

    const minPad = presekIzPada({
        sistem: o.sistem, duzina: o.duzina, struja,
        napon: o.napon, dozvoljenPad: o.dozvoljenPad,
        cosFi: par.cosFi, kapa: par.kapa
    });

    const izPada = sledeciPresek(minPad, o.sistem, o.tipKabla);

    // najmanji presek koji izdrži struju
    const izStruje = PRESECI.find(s => {
        const iz = opteretljivost(s, o.sistem, o.tipKabla, par);
        return iz !== null && iz >= strujaZastite;
    }) ?? null;

    // Nijedan tabelarni presek ne nosi traženu struju — to se ne sme prećutati
    // izborom preseka koji zadovoljava samo pad napona.
    if (!izStruje) {
        const najveci = Math.max(...Object.keys(tabelaIz(o.sistem, o.tipKabla)).map(Number));
        const iz = opteretljivost(najveci, o.sistem, o.tipKabla, par);
        return {
            presek: null,
            razlog: 'van tabele',
            minPad,
            poruke: [`Struja ${strujaZastite.toFixed(1)} A prelazi opteretljivost najvećeg preseka iz tabele ` +
                     `(${najveci} mm², Iz ${iz.toFixed(0)} A). Potrebni su paralelni provodnici ili drugi tip kabla.`]
        };
    }

    if (!izPada) {
        return {
            presek: null,
            razlog: 'van tabele',
            minPad,
            poruke: [`Pad napona traži ${minPad.toFixed(1)} mm², što je van tabele. Skrati trasu ili povećaj dozvoljeni pad.`]
        };
    }

    const minPraktican = o.sistem === 'DC' ? par.minPresekDC : par.minPresekAC;
    const izPrakse = sledeciPresek(minPraktican, o.sistem, o.tipKabla);

    const presek = Math.max(izPada, izStruje, izPrakse || 0);

    const padV = padNapona({
        sistem: o.sistem, duzina: o.duzina, struja, presek,
        cosFi: par.cosFi, kapa: par.kapa
    });
    const padProcenat = (padV / o.napon) * 100;
    const iz = opteretljivost(presek, o.sistem, o.tipKabla, par);

    const poruke = [];

    let razlog = 'pad napona';
    if (izStruje > izPada && izStruje >= presek) razlog = 'opteretljivost';
    if (izPrakse === presek && izPrakse > izPada && izPrakse > izStruje) razlog = 'minimalni presek';

    if (razlog === 'opteretljivost') {
        poruke.push(`Presek je određen strujnom opteretljivošću (Iz ${iz.toFixed(0)} A ≥ ${strujaZastite.toFixed(1)} A), ne padom napona.`);
    }
    if (razlog === 'minimalni presek') {
        poruke.push(`Račun bi dao manji presek; usvojen je praktični minimum ${minPraktican} mm².`);
    }
    if (par.faktorTemp !== 1 || par.faktorGrupisanja !== 1) {
        poruke.push(`Opteretljivost je korigovana faktorima ${par.faktorTemp} × ${par.faktorGrupisanja}.`);
    }

    // Ciljni pad ne diže presek — samo se prijavljuje, da se vidi gde se gubi
    // energija iako je instalacija u granicama ispravnosti.
    const iznadCilja = o.ciljniPad && padProcenat > o.ciljniPad;
    if (iznadCilja) {
        poruke.push(`Pad ${padProcenat.toFixed(2)} % je iznad ciljnih ${o.ciljniPad} % ` +
                    `(granica je ${o.dozvoljenPad} %). Deblji kabl bi smanjio gubitke.`);
    }

    return { presek, padV, padProcenat, iz, minPad, razlog, poruke, iznadCilja: !!iznadCilja };
}

/** Provera preseka koji je projektant sam upisao. */
export function proveriPresek(o, presek, p = PODRAZUMEVANI_PARAMETRI) {
    const par = { ...PODRAZUMEVANI_PARAMETRI, ...p };
    const padV = padNapona({ sistem: o.sistem, duzina: o.duzina, struja: o.struja, presek, cosFi: par.cosFi, kapa: par.kapa });
    const padProcenat = o.napon ? (padV / o.napon) * 100 : 0;
    const iz = opteretljivost(presek, o.sistem, o.tipKabla, par);
    const strujaZastite = o.strujaZastite || o.struja || 0;

    const greske = [];
    if (o.dozvoljenPad && padProcenat > o.dozvoljenPad) {
        greske.push(`Pad napona ${padProcenat.toFixed(2)} % prelazi dozvoljenih ${o.dozvoljenPad} %.`);
    }
    if (iz !== null && iz < strujaZastite) {
        greske.push(`Opteretljivost ${iz.toFixed(0)} A je manja od struje ${strujaZastite.toFixed(1)} A.`);
    }
    if (iz === null) {
        greske.push(`Za presek ${presek} mm² nema podatka o opteretljivosti u tabeli.`);
    }

    return { presek, padV, padProcenat, iz, greske, uredu: greske.length === 0 };
}

/** Radna struja AC voda invertera. */
export function strujaAC(snagaKw, sistem, napon, cosFi = 1) {
    const P = snagaKw * 1000;
    if (sistem === 'AC3') return P / (Math.sqrt(3) * napon * cosFi);
    return P / (napon * cosFi);
}
