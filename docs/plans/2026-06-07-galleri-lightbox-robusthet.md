# Plan: Galleri-lightbox — robusthet, tilgjengelighet og sikkerhet

**Dato:** 2026-06-07
**Fil:** `src/scripts/gallery-lightbox.js`

## Mål og avgrensninger

Lukke fire konkrete svakheter i `gallery-lightbox.js` identifisert i PR-review (#369/#370):
sikkerhetshardening av `im.src`, keydown-fokus etter bilde-klikk, null-guards for DOM-barn
og touch-robusthet. Ingen omstrukturering, ingen nye avhengigheter, ingen endringer i
Astro-komponenter, CSS eller e2e-tester.

**Ikke med:**
- Redesign av lightbox-struktur
- Endringer i `Galleri.astro`, `Lightbox.astro` eller annen Astro-kode
- E2E-tester (den eksisterende stacking-testen er uberørt)

---

## Konkrete steg og berørte filer

### Steg 1 — Sikkerhet: guard mot `javascript:`-URLer + dismiss CodeQL (`gallery-lightbox.js:24`)

CodeQL-alert #4 (`js/xss-through-dom`) flagler `imgEl.setAttribute('src', im.src)`.
Data kommer fra byggetidsgenerert JSON (ikke brukerinput), og `setAttribute('src', ...)`
på `<img>` utfører aldri skript — dette er en **ekte falsk positiv**.

**To-delt løsning (valgt: guard + manuell dismiss):**

1. **Kode (defense-in-depth):** legg inn en `javascript:`-guard i `render()`:
   ```js
   function render() {
       const im = images[current];
       // Defense-in-depth mot CodeQL js/xss-through-dom (alert #4). src kommer fra
       // byggetids-JSON som eier kontrollerer, og <img src> eksekverer aldri skript
       // — dette er belt-and-suspenders, ikke eneste forsvar.
       if (/^javascript:/i.test(im.src)) return;
       imgEl.setAttribute('src', im.src);
       ...
   }
   ```
2. **Manuelt steg (utføres av bruker):** dismiss alert #4 i GitHub Security-fanen som
   «False positive» med begrunnelse: *src genereres på byggetid fra eier-kontrollert
   Sheets/Drive-data; `<img src>` eksekverer ikke skript.* CodeQL gjenkjenner sjelden en
   custom regex som barriere, så guarden alene fjerner trolig ikke alerten.

**Begrensning (dokumentert, ikke fikset):** `/^javascript:/i` kan i teorien omgås av
ledende kontrolltegn (`\x00javascript:`). Siden `<img src>` aldri eksekverer skript er
dette uten praktisk betydning — vi overingeniører ikke guarden.

### Steg 2 — Keydown til `document` med modul-scoped handler-swap (`gallery-lightbox.js:74`)

**Problem:** keydown er bundet til `root` (`#galleri-lightbox`). Hvis brukeren klikker
direkte på `<img data-lightbox-img>` (ikke-fokuserbar), kan fokus flyttes til
`document.body` — da bobler keydown mot `document`, IKKE inn i `root`. Esc/piltaster
slutter å virke.

**Komplikasjon:** `init` kjøres på hver `astro:page-load` (`Lightbox.astro:19`). `document`
persisterer på tvers av view transitions, så naiv `document.addEventListener('keydown', …)`
i `init` ville lekke én lytter per navigasjon — nøyaktig lekkasjen den eksisterende
root-kommentaren advarer mot.

**Fix — modul-scoped handler-referanse som byttes ut ved hver init:**
```js
// modul-nivå, utenfor initGalleryLightbox:
let docKeydownHandler = null;

// inne i init, etter at root/close/next/prev er definert:
if (docKeydownHandler) document.removeEventListener('keydown', docKeydownHandler);
docKeydownHandler = (e) => {
    if (root.hidden) return;
    // ... eksisterende Esc/Arrow/Tab-logikk, uendret (lukker over root/next/prev/close) ...
};
document.addEventListener('keydown', docKeydownHandler);
```
Leakage-trygt uavhengig av om Astro erstatter eller persisterer `#galleri-lightbox`, og
fanger keydown selv når fokus havner på `body`. Oppdater den gamle kommentaren (linje
71-73) til å forklare det nye designet.

**Merk:** Dette betyr at `dataset.bound`-guarden ikke lenger beskytter keydown-bindingen
(den gjør det via handler-swap i stedet). De øvrige lytterne (tile-klikk, nav-knapper,
touch) bindes fortsatt på elementer som erstattes per navigasjon, og `dataset.bound`
hindrer dobbeltbinding innen samme element-instans — uendret.

Eksisterende tester dispatcher `keydown` på `root()` med `bubbles: true`, som bobler opp
til `document` — de fungerer uten endringer.

### Steg 3 — Null-guard for DOM-barn (`gallery-lightbox.js:16–19`)

Legg til etter querySelector-kallene:
```js
if (!imgEl || !titleEl || !countEl || !stage) return;
```
Forhindrer `TypeError` i `render()` hvis DOM-strukturen endres.

### Steg 4 — Touch-guards (`gallery-lightbox.js:96–97`)

`e.touches[0]` kan være `undefined` hvis `touches`-arrayen er tom (touch-avbrudd,
testmiljø). Guard:

```js
stage.addEventListener('touchstart', (e) => {
    if (!e.touches.length) return;
    startX = e.touches[0].clientX; deltaX = 0;
}, { passive: true });
stage.addEventListener('touchmove', (e) => {
    if (startX === null || !e.touches.length) return;
    deltaX = e.touches[0].clientX - startX;
}, { passive: true });
```

### Steg 5 — Tester (`gallery-lightbox.test.js`)

Fem nye tester:

| Test | Dekker |
|------|--------|
| `render()` hopper over bilde med `javascript:`-src | Steg 1 |
| Keydown (Esc/piltast) virker selv når fokus er på `document.body` | Steg 2 |
| To `init`-kall gir bare **én** aktiv keydown (dispatch på `document`, piltast blar nøyaktig ett steg) | Steg 2 (leak-trygghet) |
| `initGalleryLightbox()` kaster ikke når DOM-barn mangler | Steg 3 |
| `touchstart`/`touchmove` med tom `touches`-array kaster ikke | Steg 4 |

---

## Testbehov og definition of done

- Alle eksisterende 26 tester består
- Fem nye tester er grønne
- Branch coverage ≥ 89% (nåværende baseline) — vi øker ikke under baseline
- `npm run lint` passerer (ESLint `local/no-unsafe-inner-html` berøres ikke; vi bruker `setAttribute`)
- Ingen nye TypeScript/lint-feil

---

## Kjente risiki og usikkerheter

- **Keydown-lekkasje ved view transitions (håndtert):** Den opprinnelige root-bindingen var leak-trygg fordi `#galleri-lightbox` erstattes per navigasjon. Modul-scoped handler-swap (Steg 2) bevarer denne tryggheten på `document`-nivå. Egen test verifiserer at to `init`-kall ikke gir doble lyttere.
- **CodeQL fjernes ikke automatisk:** Guarden i Steg 1 tømmer trolig ikke alert #4 — manuell dismiss kreves (eget steg). Dokumentert, ikke en bug.
- **Falsk negativ på URL-guard:** `/^javascript:/i` kan omgås av ledende kontrolltegn, men `<img src>` eksekverer aldri skript, så uten praktisk betydning. Guarden er ekstra lag, ikke eneste forsvar.
- **Modul-scoped state og test-isolasjon:** `docKeydownHandler` er modul-nivå og persisterer mellom tester i samme fil. `afterEach` tømmer `document.body`, men handleren henger på `document`. Neste `init` fjerner den før ny legges til, så ingen test-lekkasje — men dette må verifiseres når testene skrives (evt. eksplisitt cleanup i `afterEach`).
