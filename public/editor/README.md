# Vizuelni editor šema

Faza 1: jednopolna šema — graf model, biblioteka simbola, interaktivni
canvas, izvoz u SVG/PNG/PDF.
Faza 2: generator šeme iz parametara elektrane, auto-raspored,
tabela kablova i specifikacija opreme.
Faza 3: string plan — raspored modula na krovu preko učitanog snimka,
dodela stringova i prenos u generator jednopolne.
Faza 4: trase i dužine iz geometrije krova, proračun preseka (bakar),
specifikacija kablova.
Faza 5: tropolna šema — prikaz istog grafa po žilama.

## Pokretanje

Editor je **samostalan** — ne zavisi od doc-portala, ni od servera, ni od baze.
Server ga samo servira kao statičke fajlove.

- `/editor` — jednopolna i tropolna šema
- `/plan` — string plan
- `?crtez=<id>` — otvara određen crtež iz lokalne biblioteke

## Gde se crteži čuvaju

U browseru, kroz **IndexedDB** (`js/skladiste.js`). Ne localStorage: string
plan sa učitanim snimkom krova ume da bude par megabajta, a localStorage
puca već na ~5 MB za ceo sajt. Ako IndexedDB nije dostupan (privatni
prozor, stroga podešavanja), pada se na localStorage uz jasno upozorenje.

Dugme **☰ Crteži** otvara biblioteku: lista, otvaranje, preimenovanje,
brisanje, uvoz i izvoz.

**Fajl je jedini način da crtež pređe na drugi računar.** Dugme `JSON`
preuzima crtež kao `.go4.json`; isti fajl se uvozi kroz biblioteku. Fajl
nosi potpis, pa se tuđi JSON odbija sa jasnom porukom umesto da napravi
prazan crtež.

Iz toga sledi jedno ograničenje koje treba znati: **crteži žive u jednom
browseru na jednom računaru.** Brisanje podataka sajta ih briše. Ono što
treba da preživi — izvezi u `.json`.

## Arhitektura

Editor **ne crta linije, nego modeluje električni graf**. Iz istog modela
se kasnije renderuje i tropolna šema, tabela kablova i specifikacija — bez
promene formata podataka.

```
string plan ──> raspodela stringova ──> generator ──> jednopolna šema
   (krov)          (S1: 16, S2: 8)                      (graf model)

model (JSON graf) ──┬── render.js  → SVG (canvas i izvoz)
                    ├── export.js  → list sa okvirom, legendom i sastavnicom
                    └── render-3l.js → tropolna nad ISTIM podacima
```

Krug je zatvoren: broj modula po stringu se ne kuca dvaput — čita se sa
krova i prenosi u generator, koji tada zaključava polja „broj panela" i
„broj invertera".

| Fajl | Uloga |
|---|---|
| `js/symbols.js` | registar simbola: geometrija, portovi, šema parametara |
| `js/model.js` | graf model, validacija, undo/redo |
| `js/router.js` | ortogonalno rutiranje provodnika (L-ruta + A* kad ima prepreka) |
| `js/render.js` | model → SVG, jednopolna (koriste ga i canvas i izvoz) |
| `js/render-3l.js` | model → SVG, tropolna: žile kao paralelne linije, polovi |
| `js/canvas.js` | pan/zoom, izbor, pomeranje, povezivanje portova |
| `js/panel.js` | paleta simbola i panel svojstava (forma se generiše iz `props`) |
| `js/export.js` | list A3/A4 sa okvirom, legendom i sastavnicom; SVG/PNG/štampa |
| `js/generator.js` | parametri elektrane → gotov model (+ provere Voc i odnosa DC/AC) |
| `js/layout.js` | logičke koordinate (kolona, red) → pozicije, sa poravnanjem kolona |
| `js/specifikacija.js` | tabela kablova, zbir po tipu kabla, specifikacija opreme, CSV |
| `js/dijalozi.js` | dijalog generatora i dijalog tabela |
| `js/skladiste.js` | lokalna biblioteka (IndexedDB), `.json` razmena, prenos plan → šema |
| `js/biblioteka.js` | dijalog biblioteke: lista, uvoz, izvoz, preimenovanje |
| `js/dijalog.js` | okvir modalnog dijaloga, upit, tabela |
| `js/list.js` | zajednički okvir lista: format, okvir, legenda, sastavnica |
| `js/dokument.js` | osnova dokumenta: meta, format, undo/redo, događaji |
| `js/plan-trase.js` | leapfrog ožičenje, dužine trasa, predlog preseka po stringu |
| `js/proracun.js` | formule i tabele: pad napona, opteretljivost, izbor preseka |
| `js/sema-proracun.js` | proračun nad šemom — izvor napajanja se traži u grafu |
| `js/katalog.js` | katalog modula i invertera koji se ponavljaju |
| `js/provere.js` | granice DC ulaza invertera: napon na oba temperaturna ekstrema, struje |
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

**Granični i ciljni pad su razdvojeni.** Presek diže samo *granični* pad
(podrazumevano 3 %) — ispod njega je instalacija ispravna i nema razloga
da alat sam predlaže deblji kabl. *Ciljni* pad (1 %) se samo prijavljuje
kao napomena, da se vidi gde se gube kilovat-časovi.

Praktična posledica: na realnom stringu (16 modula, 670 V) 6 mm² drži do
oko 150 m; presek raste tek na izrazito dugim trasama ili na stringovima
sa malo modula.
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
- **vod** — od kraja stringa do invertera. Kod leapfroga + i − izlaze sa
  **različitih krajeva** stringa, pa se mere odvojeno (`vodPlus`,
  `vodMinus`) umesto da se jedna dužina množi sa dva: manhattan rastojanje
  po krovu + visina spusta + procenat rezerve, za svaki pol posebno.

### Šta ide u nabavku

**Veze između panela se ne kupuju** — taj kabl je ugrađen u modul. Broje se
samo **skokovi**: mesta gde razmak pređe ono što fabrički priključci
pokrivaju — preskok preko slemena, oko dimnjaka, prekid niza, nepristupačan
deo krova. Jednu vezu pokrivaju dva priključka (+ jednog modula i − drugog),
pa se dokupljuje samo ostatak, po vezi. Parametar je *Priključak modula*
(podrazumevano 1,2 m po polu).

Skokovi se **podebljano obeležavaju na crtežu**, sa dodatnom dužinom, da
instalater vidi gde kabl stvarno treba.

Na pad napona ovo nema uticaja — i fabrički kabl je provodnik. Menja se samo
količina za nabavku:

| Slučaj | Ožičenje | Skokovi | Za nabavku |
|---|---|---|---|
| pun niz od 16 modula | 32,6 m | nema | vodovi |
| isti niz, rupa za dimnjak | 32,6 m | 2 × 2,2 m | vodovi + 4,4 m |

Odatle tri broja koja ne treba mešati:

| Polje | Šta je | Gde se koristi |
|---|---|---|
| `vodPlus`, `vodMinus` | dužina svakog pola | crtež, legenda |
| `vodUkupno` | zbir oba | nabavka kabla |
| `vod` | prosek, tj. ekvivalentna **jednosmerna** dužina | proračun pada napona |

Pad se računa na `vod`, a ne na `vodUkupno`, jer formula
`ΔU = 2·L·I/(κ·S)` već sadrži faktor 2 za povratni provodnik. Sabirati oba
pola i onda ih još jednom udvostručiti značilo bi dvostruko brojanje.

Oba pola se i **crtaju odvojeno**: svaki dobija svoju traku uz inverter i
svoj natpis sa dužinom. Trase prvo izlaze iz polja upravno pa idu vodoravno
— ista manhattan dužina kao obrnutim redom, ali vod ne seče preko panela.

Zato inverter i ormani moraju biti postavljeni na plan (alat **Oprema**) —
bez njih nema odakle do kuda da se meri.

## Provera DC ulaza invertera

Granice koje obaraju projekat proveravaju se po **MPPT ulazu**, ne po stringu
— jer se na jedan ulaz može vezati više stringova paralelno.

Napon se gleda na oba ekstrema, sa faktorom `1 + (T − 25) · β / 100`
(β = temperaturni koeficijent napona, tipično −0,29 %/K):

| Provera | Uslov | Posledica prekoračenja |
|---|---|---|
| Voc na najhladnijem danu | ≤ **Udc,max** | uništen inverter |
| Umpp na najtoplijem danu | ≥ **MPPT min** | elektrana ujutru ne kreće |
| Umpp na najhladnijem danu | ≤ **MPPT max** | rad van optimuma |
| Impp × broj stringova | ≤ **Idc,max** | ulaz ne prihvata struju |
| 1,25 × Isc × broj stringova | ≤ **Isc,max** | isto |
| broj stringova | ≤ dozvoljeni po ulazu | — |

Merodavan je **najduži string** na ulazu. Granice se unose uz inverter na
planu ili se povuku iz kataloga; temperaturni ekstremi (−10 °C / +70 °C) i
koeficijent su parametri.

Ista granica važi svuda: lista stringova crveni kad Voc pređe Udc,max
**tog** invertera, a ne neku fiksnu vrednost. Kad inverter nije postavljen,
koristi se uobičajenih 1000 V.

## Katalog opreme

Moduli i inverteri se biraju iz padajuće liste umesto da se specifikacije
prekucavaju na svakom projektu — u panelu string plana i u formi generatora.

Ugrađene stavke su **generičke**: tipične vrednosti po klasi snage, ne
podaci konkretnog proizvođača. Svoje stvarne modele projektant dodaje iz
editora (*Sačuvaj modul u katalog*) i oni se čuvaju lokalno, uz ugrađene.

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

`conductors` je razlog zbog kog tropolna šema nije nov editor nego nov
renderer: jednopolni prikaz crta jednu liniju sa oznakom `3P+N+PE`,
tropolni crta po jednu liniju po žili.

## Tropolna šema (Faza 5)

Prekidač u traci menja prikaz; model je isti. Menja se na jednopolnoj, a
tropolna se iz njega izvodi.

**Višepolni uređaji se ne crtaju novim simbolima.** Svaki simbol nosi
`poli`, koji kaže kako se ponaša na tropolnoj:

| `poli` | Ponašanje | Primeri |
|---|---|---|
| `polni` | isti simbol ponovljen po svakom polu koji prekida, polovi povezani isprekidanom mehaničkom spregom | prekidači, osigurači, rastavljači |
| `blok` | uređaj kroz koji žile ulaze u telo; ako ima portove nazvane po žilama (L1, L2, L3, N, PE) koriste se oni, inače se telo razvuče preko snopa | inverter, brojilo, ormani, mreža |
| `odvod` | po jedan element između svake faze i PE | prenaponska zaštita, uzemljenje |

Koje žile element prekida izvodi se iz parametra `polova` (`3P` prekida
faze, `3P+N` i neutralni, PE se nikad ne prekida). Na DC strani je `polova`
prost broj provodnika.

Gde generičko pravilo ne bi bilo tačno, simbol može definisati `draw3l` i
sam nacrtati višepolni prikaz — tako je urađen FID, kod kog je sumacioni
transformator zajednički za sve polove, pa se elipsa crta jednom preko
celog snopa umesto po polu.

Žile se crtaju paralelnim pomeranjem iste putanje koju koristi i
jednopolna (`pomeriPoliliniju`), pa raspored elemenata ostaje isti na oba
lista.

Razmak žila (`RAZMAK_ZILA`, 24 jedinice) ima donju granicu: visinu simbola
jednog pola. Najviši prekidački glif je ~20 jedinica, strujni merni
transformator ~22 — ispod toga bi se polovi dodirivali.

## Samo pravi uglovi

Na šemi nema kosih linija — ni na jednopolnoj ni na tropolnoj. Tri mesta
su to inače kvarila:

- **A\* rutiranje** radi na gridu od 10 jedinica, pa spoj sa stvarnim
  krajem porta ispadne kos
- **fan-out žila** od priključka do svoje trake u snopu
- **zaobljeni uglovi** u `pathD`

Zato svaka putanja prolazi kroz `ortogonalizuj()` u `router.js`, koji svaki
kosi segment razbija na dva prava, nastavljajući smer prethodnog poteza da
se ne prave suvišni lomovi. Uglovi su oštri (`pathD` radijus 0).

Na string planu je isto urađeno sa vodom do invertera — on se računa
manhattan rastojanjem, pa se tako i crta; kosa linija bi pokazivala kraću
trasu nego što je proračunata. Ožičenje između modula i dalje prati redove
modula, jer to i jeste putanja kabla po krovu.
