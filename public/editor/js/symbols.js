/**
 * Registar simbola (IEC 60617 / SRPS).
 *
 * Svaki simbol definiše:
 *   size    - [širina, visina] u jedinicama crteža (1 jedinica = 1 px pri zoom 1)
 *   ports   - priključne tačke: { id: { x, y, dir, system, label } }
 *             dir = 'N' | 'E' | 'S' | 'W' (smer izlaska provodnika)
 *             system = 'DC' | 'AC'
 *   draw    - funkcija (props) -> SVG markup u lokalnim koordinatama (0,0 - w,h)
 *   props   - šema parametara iz koje se generiše properties panel
 *   oznaka  - prefiks pozicione oznake po IEC 81346 (-G1, -Q2, -F3 ...)
 *   compute - opcioni izračunati podaci (npr. snaga niza)
 */

const S = 'stroke="currentColor" fill="none" stroke-width="1.6"';
const SF = 'stroke="currentColor" fill="currentColor"';
const THIN = 'stroke="currentColor" fill="none" stroke-width="1"';

// Kvadratić za simbole u ormanu / kućištu
const box = (w, h) => `<rect x="0" y="0" width="${w}" height="${h}" rx="2" ${S}/>`;

export const KATEGORIJE = [
    { id: 'dc', naziv: 'DC strana' },
    { id: 'konverzija', naziv: 'Konverzija' },
    { id: 'ac', naziv: 'AC strana' },
    { id: 'merenje', naziv: 'Merenje i mreža' },
    { id: 'ostalo', naziv: 'Ostalo' }
];

export const SYMBOLS = {

    // ─────────────────────────────── DC strana ───────────────────────────────

    pv_modul: {
        naziv: 'PV modul',
        kategorija: 'dc',
        oznaka: 'G',
        size: [70, 46],
        ports: {
            'dc+': { x: 70, y: 14, dir: 'E', system: 'DC', label: '+' },
            'dc-': { x: 70, y: 32, dir: 'E', system: 'DC', label: '−' }
        },
        props: {
            pmax: { tip: 'float', label: 'Pmax (W)', default: 550 },
            voc: { tip: 'float', label: 'Voc (V)', default: 49.8 },
            isc: { tip: 'float', label: 'Isc (A)', default: 13.9 },
            proizvodjac: { tip: 'text', label: 'Proizvođač', default: '' }
        },
        draw: () => `
            ${box(70, 46)}
            <line x1="0" y1="23" x2="70" y2="23" ${THIN}/>
            <line x1="23" y1="0" x2="23" y2="46" ${THIN}/>
            <line x1="47" y1="0" x2="47" y2="46" ${THIN}/>
            <path d="M8 38 L14 30 L20 38" ${S}/>`
    },

    pv_string: {
        naziv: 'PV niz (string)',
        kategorija: 'dc',
        oznaka: 'G',
        size: [86, 56],
        ports: {
            'dc+': { x: 86, y: 18, dir: 'E', system: 'DC', label: '+' },
            'dc-': { x: 86, y: 38, dir: 'E', system: 'DC', label: '−' }
        },
        props: {
            modula: { tip: 'int', label: 'Broj modula', default: 20 },
            pmax: { tip: 'float', label: 'Pmax modula (W)', default: 550 },
            voc: { tip: 'float', label: 'Voc modula (V)', default: 49.8 },
            isc: { tip: 'float', label: 'Isc modula (A)', default: 13.9 },
            vmpp: { tip: 'float', label: 'Vmpp modula (V)', default: 41.9 },
            impp: { tip: 'float', label: 'Impp modula (A)', default: 13.13 },
            proizvodjac: { tip: 'text', label: 'Proizvođač', default: '' }
        },
        compute: (p) => ({
            'Snaga niza': ((p.modula || 0) * (p.pmax || 0) / 1000).toFixed(2) + ' kWp',
            'Voc niza (STC)': ((p.modula || 0) * (p.voc || 0)).toFixed(1) + ' V',
            // Voc raste na niskim temperaturama; -10°C, tipičan koef. -0,29 %/K
            'Voc pri −10 °C': ((p.modula || 0) * (p.voc || 0) * 1.101).toFixed(1) + ' V',
            'Umpp niza': ((p.modula || 0) * (p.vmpp || 0)).toFixed(1) + ' V',
            'Isc × 1,25': ((p.isc || 0) * 1.25).toFixed(1) + ' A'
        }),
        draw: () => `
            ${box(86, 56)}
            <line x1="0" y1="28" x2="86" y2="28" ${THIN}/>
            <line x1="29" y1="0" x2="29" y2="56" ${THIN}/>
            <line x1="57" y1="0" x2="57" y2="56" ${THIN}/>
            <path d="M8 46 L14 38 L20 46" ${S}/>
            <path d="M36 46 L42 38 L48 46" ${S}/>
            <path d="M64 46 L70 38 L76 46" ${S}/>`
    },

    string_kutija: {
        naziv: 'String kutija (DC orman)',
        kategorija: 'dc',
        oznaka: 'A',
        size: [70, 70],
        ports: {
            'in+': { x: 0, y: 20, dir: 'W', system: 'DC', label: '+' },
            'in-': { x: 0, y: 50, dir: 'W', system: 'DC', label: '−' },
            'out+': { x: 70, y: 20, dir: 'E', system: 'DC', label: '+' },
            'out-': { x: 70, y: 50, dir: 'E', system: 'DC', label: '−' }
        },
        props: {
            ulaza: { tip: 'int', label: 'Broj ulaza', default: 2 },
            zastita: { tip: 'text', label: 'Zaštita', default: 'osigurači + SPD T2' }
        },
        draw: () => `
            <rect x="0" y="0" width="70" height="70" rx="2" ${S} stroke-dasharray="6 3"/>
            <text x="35" y="38" text-anchor="middle" font-size="11" ${SF} stroke="none">DC</text>`
    },

    dc_osigurac: {
        naziv: 'DC osigurač',
        kategorija: 'dc',
        oznaka: 'F',
        size: [44, 24],
        ports: {
            in: { x: 0, y: 12, dir: 'W', system: 'DC' },
            out: { x: 44, y: 12, dir: 'E', system: 'DC' }
        },
        props: {
            struja: { tip: 'float', label: 'In (A)', default: 15 },
            napon: { tip: 'float', label: 'Un (V DC)', default: 1000 },
            tip: { tip: 'text', label: 'Tip', default: 'gPV' }
        },
        draw: () => `
            <line x1="0" y1="12" x2="10" y2="12" ${S}/>
            <rect x="10" y="4" width="24" height="16" ${S}/>
            <line x1="10" y1="12" x2="34" y2="12" ${S}/>
            <line x1="34" y1="12" x2="44" y2="12" ${S}/>`
    },

    dc_prekidac: {
        naziv: 'DC prekidač / rastavljač',
        kategorija: 'dc',
        oznaka: 'Q',
        size: [48, 32],
        ports: {
            in: { x: 0, y: 24, dir: 'W', system: 'DC' },
            out: { x: 48, y: 24, dir: 'E', system: 'DC' }
        },
        props: {
            struja: { tip: 'float', label: 'In (A)', default: 32 },
            napon: { tip: 'float', label: 'Un (V DC)', default: 1000 },
            polova: { tip: 'int', label: 'Broj polova', default: 2 }
        },
        draw: () => `
            <line x1="0" y1="24" x2="12" y2="24" ${S}/>
            <line x1="12" y1="24" x2="34" y2="6" ${S}/>
            <circle cx="12" cy="24" r="2.5" ${SF}/>
            <circle cx="36" cy="24" r="2.5" ${SF}/>
            <line x1="36" y1="24" x2="48" y2="24" ${S}/>`
    },

    dc_spd: {
        naziv: 'DC prenaponska zaštita (SPD)',
        kategorija: 'dc',
        oznaka: 'F',
        size: [36, 52],
        ports: {
            in: { x: 18, y: 0, dir: 'N', system: 'DC' },
            pe: { x: 18, y: 52, dir: 'S', system: 'DC', label: 'PE' }
        },
        props: {
            tip: { tip: 'select', label: 'Tip', opcije: ['T1', 'T2', 'T1+T2'], default: 'T2' },
            napon: { tip: 'float', label: 'Ucpv (V DC)', default: 1000 }
        },
        draw: () => `
            <line x1="18" y1="0" x2="18" y2="10" ${S}/>
            <rect x="4" y="10" width="28" height="30" ${S}/>
            <path d="M10 16 L26 16 L14 26 L26 26" ${S}/>
            <line x1="18" y1="40" x2="18" y2="52" ${S}/>`
    },

    // ────────────────────────────── Konverzija ───────────────────────────────

    inverter_1f: {
        naziv: 'Inverter 1-fazni',
        kategorija: 'konverzija',
        oznaka: 'T',
        size: [80, 80],
        ports: {
            'dc1+': { x: 0, y: 20, dir: 'W', system: 'DC', label: 'MPPT1 +' },
            'dc1-': { x: 0, y: 36, dir: 'W', system: 'DC', label: 'MPPT1 −' },
            L: { x: 80, y: 28, dir: 'E', system: 'AC', label: 'L' },
            N: { x: 80, y: 44, dir: 'E', system: 'AC', label: 'N' },
            PE: { x: 40, y: 80, dir: 'S', system: 'AC', label: 'PE' }
        },
        props: {
            snaga: { tip: 'float', label: 'Pac (kW)', default: 5 },
            mppt: { tip: 'int', label: 'Broj MPPT', default: 1 },
            proizvodjac: { tip: 'text', label: 'Proizvođač', default: '' },
            model: { tip: 'text', label: 'Model', default: '' }
        },
        draw: () => `
            ${box(80, 80)}
            <line x1="18" y1="62" x2="62" y2="18" ${S}/>
            <path d="M14 34 h8 M26 34 h8" ${S}/>
            <path d="M46 54 q6 -12 12 0" ${S}/>`
    },

    inverter_3f: {
        naziv: 'Inverter 3-fazni',
        kategorija: 'konverzija',
        oznaka: 'T',
        size: [90, 110],
        ports: {
            'dc1+': { x: 0, y: 18, dir: 'W', system: 'DC', label: 'MPPT1 +' },
            'dc1-': { x: 0, y: 34, dir: 'W', system: 'DC', label: 'MPPT1 −' },
            'dc2+': { x: 0, y: 60, dir: 'W', system: 'DC', label: 'MPPT2 +' },
            'dc2-': { x: 0, y: 76, dir: 'W', system: 'DC', label: 'MPPT2 −' },
            L1: { x: 90, y: 26, dir: 'E', system: 'AC', label: 'L1' },
            L2: { x: 90, y: 42, dir: 'E', system: 'AC', label: 'L2' },
            L3: { x: 90, y: 58, dir: 'E', system: 'AC', label: 'L3' },
            N: { x: 90, y: 74, dir: 'E', system: 'AC', label: 'N' },
            PE: { x: 45, y: 110, dir: 'S', system: 'AC', label: 'PE' }
        },
        props: {
            snaga: { tip: 'float', label: 'Pac (kW)', default: 10 },
            mppt: { tip: 'int', label: 'Broj MPPT', default: 2 },
            proizvodjac: { tip: 'text', label: 'Proizvođač', default: '' },
            model: { tip: 'text', label: 'Model', default: '' }
        },
        draw: () => `
            ${box(90, 110)}
            <line x1="20" y1="90" x2="70" y2="20" ${S}/>
            <path d="M16 44 h9 M31 44 h9" ${S}/>
            <path d="M50 72 q7 -14 14 0" ${S}/>`
    },

    baterija: {
        naziv: 'Baterija (skladište)',
        kategorija: 'konverzija',
        oznaka: 'G',
        size: [64, 44],
        ports: {
            'dc+': { x: 64, y: 14, dir: 'E', system: 'DC', label: '+' },
            'dc-': { x: 64, y: 30, dir: 'E', system: 'DC', label: '−' }
        },
        props: {
            kapacitet: { tip: 'float', label: 'Kapacitet (kWh)', default: 10 },
            napon: { tip: 'float', label: 'Un (V DC)', default: 400 }
        },
        draw: () => `
            ${box(64, 44)}
            <line x1="20" y1="10" x2="20" y2="34" ${S}/>
            <line x1="30" y1="16" x2="30" y2="28" ${S}/>
            <line x1="40" y1="10" x2="40" y2="34" ${S}/>
            <line x1="50" y1="16" x2="50" y2="28" ${S}/>`
    },

    // ─────────────────────────────── AC strana ───────────────────────────────

    ac_prekidac: {
        naziv: 'AC prekidač / osigurač',
        kategorija: 'ac',
        oznaka: 'Q',
        size: [48, 40],
        ports: {
            in: { x: 0, y: 30, dir: 'W', system: 'AC' },
            out: { x: 48, y: 30, dir: 'E', system: 'AC' }
        },
        props: {
            struja: { tip: 'float', label: 'In (A)', default: 25 },
            karakteristika: { tip: 'select', label: 'Karakteristika', opcije: ['B', 'C', 'D'], default: 'C' },
            polova: { tip: 'select', label: 'Broj polova', opcije: ['1P', '1P+N', '3P', '3P+N'], default: '3P+N' }
        },
        draw: () => `
            <line x1="0" y1="30" x2="12" y2="30" ${S}/>
            <line x1="12" y1="30" x2="34" y2="10" ${S}/>
            <circle cx="12" cy="30" r="2.5" ${SF}/>
            <circle cx="36" cy="30" r="2.5" ${SF}/>
            <line x1="36" y1="30" x2="48" y2="30" ${S}/>
            <path d="M28 14 l6 -4" ${S}/>`
    },

    fid: {
        naziv: 'FID sklopka (RCD)',
        kategorija: 'ac',
        oznaka: 'Q',
        size: [56, 48],
        ports: {
            in: { x: 0, y: 24, dir: 'W', system: 'AC' },
            out: { x: 56, y: 24, dir: 'E', system: 'AC' }
        },
        props: {
            struja: { tip: 'float', label: 'In (A)', default: 40 },
            diferencijalna: { tip: 'select', label: 'IΔn (mA)', opcije: ['10', '30', '100', '300'], default: '300' },
            tip: { tip: 'select', label: 'Tip', opcije: ['AC', 'A', 'B'], default: 'B' },
            polova: { tip: 'select', label: 'Broj polova', opcije: ['2P', '4P'], default: '4P' }
        },
        draw: () => `
            <line x1="0" y1="24" x2="10" y2="24" ${S}/>
            <rect x="10" y="8" width="36" height="32" ${S}/>
            <line x1="10" y1="24" x2="46" y2="24" ${THIN}/>
            <ellipse cx="28" cy="24" rx="12" ry="8" ${S}/>
            <line x1="46" y1="24" x2="56" y2="24" ${S}/>`
    },

    ac_spd: {
        naziv: 'AC prenaponska zaštita (SPD)',
        kategorija: 'ac',
        oznaka: 'F',
        size: [36, 52],
        ports: {
            in: { x: 18, y: 0, dir: 'N', system: 'AC' },
            pe: { x: 18, y: 52, dir: 'S', system: 'AC', label: 'PE' }
        },
        props: {
            tip: { tip: 'select', label: 'Tip', opcije: ['T1', 'T2', 'T1+T2', 'T3'], default: 'T2' },
            polova: { tip: 'select', label: 'Broj polova', opcije: ['1+1', '3+1', '4P'], default: '3+1' }
        },
        draw: () => `
            <line x1="18" y1="0" x2="18" y2="10" ${S}/>
            <rect x="4" y="10" width="28" height="30" ${S}/>
            <path d="M10 16 L26 16 L14 26 L26 26" ${S}/>
            <line x1="18" y1="40" x2="18" y2="52" ${S}/>`
    },

    sabirnica: {
        naziv: 'Sabirnica',
        kategorija: 'ac',
        oznaka: 'W',
        size: [160, 16],
        ports: {
            p1: { x: 20, y: 0, dir: 'N', system: 'AC' },
            p2: { x: 60, y: 0, dir: 'N', system: 'AC' },
            p3: { x: 100, y: 0, dir: 'N', system: 'AC' },
            p4: { x: 140, y: 0, dir: 'N', system: 'AC' },
            d1: { x: 40, y: 16, dir: 'S', system: 'AC' },
            d2: { x: 80, y: 16, dir: 'S', system: 'AC' },
            d3: { x: 120, y: 16, dir: 'S', system: 'AC' }
        },
        props: {
            oznakaZila: { tip: 'text', label: 'Žile', default: 'L1,L2,L3,N,PE' }
        },
        draw: () => `<line x1="0" y1="8" x2="160" y2="8" stroke="currentColor" stroke-width="4"/>`
    },

    ac_orman: {
        naziv: 'AC razvodni orman (PV-RO)',
        kategorija: 'ac',
        oznaka: 'A',
        size: [90, 70],
        ports: {
            in: { x: 0, y: 35, dir: 'W', system: 'AC' },
            out: { x: 90, y: 35, dir: 'E', system: 'AC' }
        },
        props: {
            naziv: { tip: 'text', label: 'Oznaka ormana', default: 'PV-RO' },
            ip: { tip: 'text', label: 'IP zaštita', default: 'IP65' }
        },
        draw: () => `
            <rect x="0" y="0" width="90" height="70" rx="2" ${S} stroke-dasharray="6 3"/>
            <text x="45" y="40" text-anchor="middle" font-size="11" ${SF} stroke="none">AC</text>`
    },

    // ───────────────────────────── Merenje i mreža ───────────────────────────

    brojilo: {
        naziv: 'Dvosmerno brojilo',
        kategorija: 'merenje',
        oznaka: 'P',
        size: [56, 56],
        ports: {
            in: { x: 0, y: 28, dir: 'W', system: 'AC' },
            out: { x: 56, y: 28, dir: 'E', system: 'AC' }
        },
        props: {
            tip: { tip: 'select', label: 'Merenje', opcije: ['direktno', 'poluindirektno', 'indirektno'], default: 'direktno' },
            faza: { tip: 'select', label: 'Broj faza', opcije: ['1', '3'], default: '3' }
        },
        draw: () => `
            <circle cx="28" cy="28" r="24" ${S}/>
            <text x="28" y="33" text-anchor="middle" font-size="13" ${SF} stroke="none">kWh</text>
            <path d="M14 44 l6 -6 M36 12 l6 -6" ${THIN}/>`
    },

    strujni_transformator: {
        naziv: 'Strujni merni transformator',
        kategorija: 'merenje',
        oznaka: 'T',
        size: [40, 40],
        ports: {
            in: { x: 0, y: 20, dir: 'W', system: 'AC' },
            out: { x: 40, y: 20, dir: 'E', system: 'AC' }
        },
        props: {
            odnos: { tip: 'text', label: 'Prenosni odnos', default: '100/5 A' },
            klasa: { tip: 'text', label: 'Klasa tačnosti', default: '0,5S' }
        },
        draw: () => `
            <line x1="0" y1="20" x2="40" y2="20" ${S}/>
            <circle cx="20" cy="20" r="11" ${S}/>`
    },

    kpk: {
        naziv: 'Priključni ormar (KPK/MRO)',
        kategorija: 'merenje',
        oznaka: 'A',
        size: [80, 64],
        ports: {
            in: { x: 0, y: 32, dir: 'W', system: 'AC' },
            out: { x: 80, y: 32, dir: 'E', system: 'AC' }
        },
        props: {
            oznaka: { tip: 'text', label: 'Oznaka', default: 'KPK' },
            osigurac: { tip: 'text', label: 'Osigurač', default: '3×63 A' }
        },
        draw: () => `
            <rect x="0" y="0" width="80" height="64" rx="2" ${S}/>
            <line x1="0" y1="16" x2="80" y2="16" ${THIN}/>
            <text x="40" y="42" text-anchor="middle" font-size="11" ${SF} stroke="none">KPK</text>`
    },

    mreza: {
        naziv: 'Distributivna mreža',
        kategorija: 'merenje',
        oznaka: 'W',
        size: [64, 48],
        ports: {
            in: { x: 0, y: 24, dir: 'W', system: 'AC' }
        },
        props: {
            napon: { tip: 'text', label: 'Napon', default: '3×230/400 V, 50 Hz' },
            sistem: { tip: 'select', label: 'Sistem uzemljenja', opcije: ['TN-C', 'TN-S', 'TN-C-S', 'TT'], default: 'TN-C-S' }
        },
        draw: () => `
            <line x1="0" y1="24" x2="16" y2="24" ${S}/>
            <path d="M16 24 L34 8 L52 24 L34 40 Z" ${S}/>
            <text x="34" y="28" text-anchor="middle" font-size="10" ${SF} stroke="none">~</text>`
    },

    transformator: {
        naziv: 'Transformator SN/NN',
        kategorija: 'merenje',
        oznaka: 'T',
        size: [48, 76],
        ports: {
            sn: { x: 24, y: 0, dir: 'N', system: 'AC', label: 'SN' },
            nn: { x: 24, y: 76, dir: 'S', system: 'AC', label: 'NN' }
        },
        props: {
            snaga: { tip: 'float', label: 'Sn (kVA)', default: 630 },
            odnos: { tip: 'text', label: 'Prenosni odnos', default: '10/0,4 kV' },
            sprega: { tip: 'text', label: 'Sprega', default: 'Dyn5' }
        },
        draw: () => `
            <line x1="24" y1="0" x2="24" y2="12" ${S}/>
            <circle cx="24" cy="28" r="16" ${S}/>
            <circle cx="24" cy="48" r="16" ${S}/>
            <line x1="24" y1="64" x2="24" y2="76" ${S}/>`
    },

    // ──────────────────────────────── Ostalo ─────────────────────────────────

    uzemljenje: {
        naziv: 'Uzemljenje (PE)',
        kategorija: 'ostalo',
        oznaka: 'X',
        size: [36, 34],
        ports: {
            in: { x: 18, y: 0, dir: 'N', system: 'AC' }
        },
        props: {
            otpor: { tip: 'float', label: 'Otpor rasprostiranja (Ω)', default: 10 }
        },
        draw: () => `
            <line x1="18" y1="0" x2="18" y2="14" ${S}/>
            <line x1="4" y1="14" x2="32" y2="14" ${S}/>
            <line x1="9" y1="21" x2="27" y2="21" ${S}/>
            <line x1="14" y1="28" x2="22" y2="28" ${S}/>`
    },

    potrosac: {
        naziv: 'Potrošač / objekat',
        kategorija: 'ostalo',
        oznaka: 'E',
        size: [64, 48],
        ports: {
            in: { x: 0, y: 24, dir: 'W', system: 'AC' }
        },
        props: {
            snaga: { tip: 'float', label: 'Instalisana snaga (kW)', default: 11 }
        },
        draw: () => `
            <line x1="0" y1="24" x2="12" y2="24" ${S}/>
            <path d="M12 40 L12 14 L38 4 L64 14 L64 40 Z" ${S}/>`
    },

    komunikacija: {
        naziv: 'Komunikacija / monitoring',
        kategorija: 'ostalo',
        oznaka: 'A',
        size: [56, 36],
        ports: {
            in: { x: 0, y: 18, dir: 'W', system: 'AC' }
        },
        props: {
            veza: { tip: 'select', label: 'Veza', opcije: ['RS485', 'WiFi', 'LAN', '4G'], default: 'WiFi' }
        },
        draw: () => `
            ${box(56, 36)}
            <path d="M20 26 q8 -14 16 0" ${S}/>
            <path d="M25 26 q3 -7 6 0" ${S}/>
            <circle cx="28" cy="26" r="2" ${SF}/>`
    }
};

/** Vrati definiciju simbola ili baci grešku sa jasnom porukom. */
export function getSymbol(type) {
    const def = SYMBOLS[type];
    if (!def) throw new Error(`Nepoznat simbol: ${type}`);
    return def;
}

/** Podrazumevani props za novi čvor datog tipa. */
export function defaultProps(type) {
    const def = getSymbol(type);
    const out = {};
    for (const [key, spec] of Object.entries(def.props || {})) {
        out[key] = spec.default !== undefined ? spec.default : '';
    }
    return out;
}

/** Apsolutna pozicija porta u koordinatama crteža (uzima u obzir rotaciju). */
export function portPosition(node, portId) {
    const def = getSymbol(node.type);
    const port = def.ports[portId];
    if (!port) throw new Error(`Simbol ${node.type} nema port ${portId}`);

    const [w, h] = def.size;
    const rot = ((node.rot || 0) % 360 + 360) % 360;

    let x = port.x, y = port.y, dir = port.dir;
    const DIRS = ['N', 'E', 'S', 'W'];

    for (let i = 0; i < rot / 90; i++) {
        // rotacija za 90° u smeru kazaljke unutar okvira simbola
        const nx = (i % 2 === 0 ? h : w) - y;
        y = x;
        x = nx;
        dir = DIRS[(DIRS.indexOf(dir) + 1) % 4];
    }

    return { x: node.pos.x + x, y: node.pos.y + y, dir };
}

/** Gabaritne mere simbola nakon rotacije. */
export function nodeSize(node) {
    const [w, h] = getSymbol(node.type).size;
    const rot = ((node.rot || 0) % 360 + 360) % 360;
    return (rot === 90 || rot === 270) ? [h, w] : [w, h];
}

/** Bounding box čvora u koordinatama crteža. */
export function nodeBBox(node) {
    const [w, h] = nodeSize(node);
    return { x: node.pos.x, y: node.pos.y, w, h };
}
