# Vizuelni editor šema

Faza 1: jednopolna šema — graf model, biblioteka simbola, interaktivni
canvas, izvoz u SVG/PNG/PDF.
Faza 2: generator šeme iz parametara elektrane, auto-raspored,
tabela kablova i specifikacija opreme.
Faza 3: string plan — raspored modula na krovu preko učitanog snimka,
dodela stringova i prenos u generator jednopolne.
Faza 4: trase i dužine iz geometrije krova, proračun preseka (bakar),
specifikacija kablova.

## Pokretanje

Editor je deo portala:

- `/editor` — jednopolna šema, radna skica (čuva se u `localStorage`)
- `/editor/sema/:id` — šema vezana za projekat (čuva se u bazi)
- `/plan` — string plan, radna skica
- `/plan/:id` — plan vezan za projekat

Oba crteža se čuvaju u istoj tabeli `seme`, razlikuju se po koloni `tip`
(`1L` / `3L` / `PLAN`).

## Arhitektura

Editor **ne crta linije, nego modeluje električni graf**. Iz istog modela
se kasnije renderuje i tropolna šema, tabela kablova i specifikacija — bez
promene formata podataka.

```
string plan ──> raspodela stringova ──> generator ──> jednopolna šema
   (krov)          (S1: 16, S2: 8)                      (graf model)

model (JSON graf) ──┬── render.js  → SVG (canvas i izvoz)
                    ├── export.js  → list sa okvirom, legendom i sastavnicom
                    └── (kasnije)  → tropolni renderer nad istim podacima
```

Krug je zatvoren: broj modula po stringu se ne kuca dvaput — čita se sa
krova i prenosi u generator, koji tada zaključava polja „broj panela" i
„broj invertera".

| Fajl | Uloga |
|---|---|
| `js/symbols.js` | registar simbola: geometrija, portovi, šema parametara |
| `js/model.js` | graf model, validacija, undo/redo |
| `js/router.js` | ortogonalno rutiranje provodnika (L-ruta + A* kad ima prepreka) |
| `js/render.js` | model → SVG (koriste ga i canvas i izvoz) |
| `js/canvas.js` | pan/zoom, izbor, pomeranje, povezivanje portova |
| `js/panel.js` | paleta simbola i panel svojstava (forma se generiše iz `props`) |
| `js/export.js` | list A3/A4 sa okvirom, legendom i sastavnicom; SVG/PNG/štampa |
| `js/generator.js` | parametri elektrane → gotov model (+ provere Voc i odnosa DC/AC) |
| `js/layout.js` | logičke koordinate (kolona, red) → pozicije, sa poravnanjem kolona |
| `js/specifikacija.js` | tabela kablova, zbir po tipu kabla, specifikacija opreme, CSV |
| `js/dijalozi.js` | dijalog generatora i dijalog tabela |
| `js/api.js` | `/api/seme`, localStorage skice i prenos plan → šema |
| `js/list.js` | zajednički okvir lista: format, okvir, legenda, sastavnica |
| `js/dokument.js` | osnova dokumenta: meta, format, undo/redo, događaji |
| `js/plan-trase.js` | leapfrog ožičenje, dužine trasa, predlog preseka po stringu |
| `js/proracun.js` | formule i tabele: pad napona, opteretljivost, izbor preseka |
| `js/sema-proracun.js` | proračun nad šemom — izvor napajanja se traži u grafu |
| `js/util.js` | sitne deljene funkcije |
| `js/app.js` | sklapanje, autosave, demo šema |

## Generator (Faza 2)

Dugme **⚡ Generiši** otvara formu: broj panela, Pmax/Voc/Isc, broj i tip
invertera, zaštita, merenje i priključak. Uz formu ide živa rekapitulacija
(snaga DC/AC, odnos, raspodela stringova, Voc na −10 °C) i upozorenja kada
Voc najdužeg niza pređe 1000 V ili odnos DC/AC izađe iz opsega 0,9–1,35.

Generator ne računa piksele — svaki element dobije logičku poziciju
`(kolona, red)`, a `layout.js` poravnava kolone po najširem simbolu.
Grane koje vise ispod glavnog voda (SPD, uzemljenje) dobijaju sopstvene
razlomljene kolone, pa ne mogu upasti u redove stringova bez obzira na
broj invertera.

## String plan (Faza 3)

Geometrija plana se čuva u **metrima**; render množi sa `PPM`. Tako se
dimenzije modula, razmaci i kalibracija unose u stvarnim jedinicama, a
razmera lista ostaje stvar prikaza.

| Fajl | Uloga |
|---|---|
| `js/plan-model.js` | krovne ravni, stringovi, moduli, provere Voc i jednakosti stringova |
| `js/plan-render.js` | podloga, mreža modula, razmernik, strelica severa |
| `js/plan-canvas.js` | alati: izbor, bojenje stringova, isključivanje modula, podloga, kalibracija |
| `js/plan-panel.js` | stringovi, krovna ravan, modul, podloga, rekapitulacija |
| `js/plan-export.js` | list plana sa legendom stringova |
| `js/plan-app.js` | sklapanje, učitavanje snimka, kalibracija, prenos u šemu |

**Podloga**: snimak se pre upisa u model smanjuje na najviše 2000 px i
pretvara u JPEG, da JSON ostane razumne veličine za bazu i localStorage.
Kalibracija se radi povlačenjem duži poznate dužine — podloga se skalira
oko početne tačke te duži, pa ostaje na mestu.

**Bojenje stringova**: prvi klik u potezu određuje smer — ako je modul već
u aktivnom stringu, potez ga skida. Ceo potez ulazi u undo kao jedan korak.

## Proračun kablova (Faza 4)

**Presek je predlog, ne konačna vrednost.** Alat bira najmanji standardni
presek koji istovremeno zadovoljava pad napona i strujnu opteretljivost, uz
praktični minimum (6 mm² DC, 2,5 mm² AC). Projektant ga potvrđuje.

Formule (bakar, otporni deo; reaktansa se zanemaruje):

```
DC (dvožilno):   ΔU = 2 · L · I / (κ · S)
AC jednofazno:   ΔU = 2 · L · I · cosφ / (κ · S)
AC trofazno:     ΔU = √3 · L · I · cosφ / (κ · S)
```

κ = 56 m/(Ω·mm²) na 20 °C (48 na 70 °C, 44 na 90 °C — podesivo).
Pad napona se računa na Vmpp/Impp, a opteretljivost na 1,25 × Isc odnosno
na struju prekidača koji vod štiti.

Tabele opteretljivosti: PV1-F po EN 50618 (slobodno u vazduhu, 60 °C),
NYY-J po IEC 60364-5-52 način C (30 °C), sa faktorima za temperaturu i
grupisanje.

### Odakle dolaze dužine

Iz geometrije krova, ne iz crteža šeme. Za svaki string:

- **ožičenje** — leapfrog putanja između modula (po redu: preko svakog
  drugog do kraja, pa nazad preko preskočenih, tako da oba kraja izlaze na
  istoj strani i površina strujne petlje ostane mala)
- **vod** — od kraja stringa do invertera: manhattan rastojanje po krovu
  + visina spusta + procenat rezerve, po provodniku

Zato inverter i ormani moraju biti postavljeni na plan (alat **Oprema**) —
bez njih nema odakle do kuda da se meri.

## Dodavanje novog simbola

Dovoljno je dopuniti `SYMBOLS` u `js/symbols.js` — paleta, properties panel,
legenda i validacija se izvode iz te definicije, bez izmena drugde.

## Model podataka

```jsonc
{
  "nodes": [{ "id", "type", "oznaka", "label", "pos", "rot", "props" }],
  "edges": [{
    "id", "from": "cvor:port", "to": "cvor:port",
    "system": "DC | AC1 | AC3 | PE",
    "conductors": ["L1","L2","L3","N","PE"],
    "cable": { "tip", "presek", "duzina" },
    "waypoints": []
  }]
}
```

`conductors` je razlog zbog kog tropolna šema neće biti novi editor nego
novi renderer: jednopolni prikaz crta jednu liniju sa oznakom `3P+N+PE`,
tropolni crta po jednu liniju po žili.
