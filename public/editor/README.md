# Vizuelni editor šema

Faza 1: jednopolna šema — graf model, biblioteka simbola, interaktivni
canvas, izvoz u SVG/PNG/PDF.
Faza 2: generator šeme iz parametara elektrane, auto-raspored,
tabela kablova i specifikacija opreme.

## Pokretanje

Editor je deo portala:

- `/editor` — radna skica (čuva se u `localStorage`)
- `/editor/sema/:id` — šema vezana za projekat (čuva se u bazi)

## Arhitektura

Editor **ne crta linije, nego modeluje električni graf**. Iz istog modela
se kasnije renderuje i tropolna šema, tabela kablova i specifikacija — bez
promene formata podataka.

```
model (JSON graf) ──┬── render.js  → SVG (canvas i izvoz)
                    ├── export.js  → list sa okvirom, legendom i sastavnicom
                    └── (Faza 3)   → tropolni renderer nad istim podacima
```

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
| `js/api.js` | `/api/seme` + localStorage skica |
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
