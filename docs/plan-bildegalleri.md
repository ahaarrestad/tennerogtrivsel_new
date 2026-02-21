# Plan: Bildegalleri og layout-forbedringer for Tenner og Trivsel

> Status: UTKAST v2 — Godkjent av: (venter)
> Dato: 2026-02-21
> Revidert etter to teamgjennomganger med UX-designer, arkitekt, løsningsarkitekt og kritisk utvikler.

## Bakgrunn

Nettsiden mangler bilder fra klinikken (venterom, behandlingsrom, fasade, etc.). Eneste bilder i dag er ett forsidebilde og ansattportretter. Målet er å vise klinikken på en innbydende og trygg måte som bygger tillit hos pasienter — spesielt de som har tannlegefrykt.

I tillegg vurderes helhetlige layout-forbedringer for å gjøre siden mer innbydende.

---

## Del 1: Designvalg

### Valgt tilnærming: "Trygg Klinikk" med admin-støtte

**Konsept:** Bilder fungerer som et "virtuelt besøk" — de viser at klinikken er ren, moderne og vennlig. Bildene er støttende, ikke dominerende. Ingen parallax, karusell eller masonry.

**Begrunnelse:**
- Målgruppen er pasienter i alle aldre (3-90 år), inkludert eldre og folk med tannlegefrykt
- Enkle, statiske bildevisninger fungerer for alle brukergrupper
- Lavest mulig vedlikeholdsbyrde for et lite team
- Bildene administreres via eksisterende admin-panel (Google Drive + Sheets)

### Bevisst valgt bort:
- Parallax-effekter (tilgjengelighetsproblemer, motion sickness)
- Masonry-grid (unødvendig kompleksitet for 4-8 bilder)
- Horisontal swipe/karusell (1-2% interaksjonsrate, forvirrende for eldre)
- Kategorifiltrering (unødvendig for < 20 bilder)
- Scroll-animasjoner med stagger (null verdi for pasientmålgruppen)
- Lightbox (bildene er atmosfæriske, ikke inspiserbare)

---

## Del 2: Bildeplasseringer

### Forsiden — "Klinikk-stripe" (ny seksjon)

Plasseres **ETTER kontakt-seksjonen** — kontaktinfo (telefon, adresse, åpningstider) forblir rett under hero for best mulig konvertering. Klinikk-stripen fungerer som visuelt "pusterom" mellom kontaktinfo og tjenester.

```
DESKTOP:
┌─────────────────────────────────────────────────────┐
│  Navbar (uendret)                                   │
├─────────────────────────────────────────────────────┤
│  Hero: Tekst+CTA | Bilde (uendret)                 │
├─────────────────────────────────────────────────────┤
│  Kontakt: 4 kort + Google Maps (uendret)            │
├─────────────────────────────────────────────────────┤
│  KLINIKK-STRIPE (NY)                               │
│  "Velkommen til klinikken"                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ img1 │ │ img2 │ │ img3 │ │ img4 │ │ img5 │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
├─────────────────────────────────────────────────────┤
│  Tjenester (skjult mobil, uendret)                  │
├─────────────────────────────────────────────────────┤
│  Tannleger (skjult mobil, uendret)                  │
├─────────────────────────────────────────────────────┤
│  Footer                                             │
└─────────────────────────────────────────────────────┘

MOBIL (maks 2 bilder — info og kontakt prioriteres):
┌───────────────────┐
│  Navbar            │
├───────────────────┤
│  Hero (uendret)    │
├───────────────────┤
│  Kontakt (uendret) │
├───────────────────┤
│  Klinikken vår     │
│  ┌────┐  ┌────┐    │
│  │img1│  │img2│    │
│  └────┘  └────┘    │
├───────────────────┤
│  Footer            │
└───────────────────┘
```

- Desktop: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Mobil: vis kun de 2 første bildene (`hidden md:block` på bilde 3+)
- `aspect-[4/3]` med `object-cover`
- `rounded-2xl overflow-hidden shadow-md`
- Zoom/pan per bilde via `object-position` + `transform: scale()` (admin-styrt)
- Subtil `hover:scale-[1.02]` med `transition-transform duration-300`
- Bildetekst som gradient-overlay i bunnen av hvert bilde
- Alle bilder `loading="lazy"`
- Plasseres **utenfor** den eksisterende `hidden md:block`-wrapperen i index.astro (ellers skjules alt på mobil)

---

## Del 3: Teknisk arkitektur

### Nøkkelbeslutninger (fra eier)

1. **Ingen ny env-var.** Bruk `sheetMeta.data.parents[0]` (spreadsheetets foreldre-mappe i Google Drive) — identisk med `syncForsideBilde()`.
2. **Sammenslått admin-modul.** "Forsidebilde" og "Bildegalleri" slås sammen til ÉN modul: "Bilder".
3. **Zoom/pan på alle galleribilder.** Scale, positionX, positionY — identisk mønster som forsidebilde og tannleger.
4. **Færre bilder på mobil.** Desktop viser alle, mobil viser kun 2.

### Dataflyt

```
Admin-panel (OAuth, client-side)
    ↓ Laster opp bilder til Google Drive
    ↓ Lagrer metadata til Google Sheets ("galleri"-fane)

Google Sheets ("galleri"-fane)         Google Drive (foreldre-mappe til Sheet)
  A:Tittel  B:Bildefil  C:AltTekst      galleribilder: *.jpg, *.png, *.webp
  D:Aktiv   E:Rekkefølge F:Skala
  G:PosX    H:PosY
    ↓                                    ↓
    └──────────── sync-data.js ──────────┘
                  syncGalleri()
                  (parents[0], INGEN ny env-var)
                  MD5-sjekk, last ned endrede
                      ↓
    src/content/galleri.json  +  src/assets/galleri/*.{jpg,png,webp}
                      ↓
              content.config.ts (galleri collection, JSON-loader)
                      ↓
              Galleri.astro
              • getCollection('galleri')
              • import.meta.glob('/src/assets/galleri/*')
              • Sortert etter rekkefølge
              • Zoom/pan via object-position + transform
              • Mobil: 2 bilder, Desktop: alle
                      ↓
              Astro Image → optimerte WebP/AVIF i dist/
```

### Nye filer (4)

| Fil | Beskrivelse |
|-----|-------------|
| `src/components/Galleri.astro` | Responsivt bildegrid med zoom/pan, mobil-variasjon |
| `src/content/galleri.json` | Metadata per bilde (generert av sync-data.js) |
| `src/assets/galleri/.gitkeep` | Placeholder for synkede bildefiler |
| `tests/sync-galleri.test.js` | Unit-tester for syncGalleri-logikk |

### Endrede filer (7)

| Fil | Endring |
|-----|---------|
| `src/scripts/sync-data.js` | Ny `syncGalleri()` — bruker `parents[0]`, leser `galleri!A2:H`, laster ned bilder til `src/assets/galleri/`, skriver `galleri.json`, rydder ubrukte. Kalles i `runSync()` mellom `syncForsideBilde()` og markdown-collections. Håndterer manglende Sheets-fane gracefully (logWarning, ikke throw). Eksporteres. |
| `src/content.config.ts` | Ny `galleri` content collection med JSON-loader og schema inkl. `imageConfig` (scale, positionX, positionY). Identisk mønster som `tannleger`. |
| `src/pages/index.astro` | Importer og plasser `<Galleri/>` etter Kontakt, UTENFOR `hidden md:block`-wrapperen. |
| `src/pages/admin/index.astro` | Dashboard-kort `card-forsidebilde` → `card-bilder` med ny tekst "Bildegalleriet". `loadForsideModule()` → `loadBilderModule()` som viser forsidebilde-seksjon (eksisterende UI) + galleri-seksjon (liste + redigering). `openModule`-switch, `cardModules`-array og `moduleTitles` oppdateres. |
| `src/scripts/admin-client.js` | Nye funksjoner: `getGalleriRaw(spreadsheetId)`, `updateGalleriRow(spreadsheetId, rowIndex, data)`, `addGalleriRow(spreadsheetId, data)`, `deleteGalleriRowPermanently(spreadsheetId, rowIndex)`. Følger tannleger-mønsteret. |
| `src/scripts/admin-dashboard.js` | Ny `loadGalleriListeModule(sheetId, onEdit, onDelete)` — listevisning av galleribilder, følger `loadTannlegerModule`-mønsteret. `enforceAccessControl()`: oppdater `forsidebilde` → `bilder` og `btn-open-forsidebilde` → `btn-open-bilder`. |
| `src/scripts/getSettings.ts` | Legg til `galleriTekst` i `HARD_DEFAULTS`. |

### Ingen endrede filer

| Fil | Hvorfor ikke |
|-----|-------------|
| `.env` | Ingen ny env-var (bruker parents[0]) |
| `src/env.d.ts` | Ingen ny env-var |
| `.github/workflows/*.yml` | Ingen CI/CD-endringer nødvendig |

### Nye avhengigheter

**Ingen.** Alt bygges med eksisterende teknologi.

### Google Sheets — ny fane "galleri"

| Kolonne | Header | Type | Default | Beskrivelse |
|---------|--------|------|---------|-------------|
| A | Tittel | Tekst | — | Bildetekst / caption |
| B | Bildefil | Tekst | — | Filnavn i Drive-mappen |
| C | AltTekst | Tekst | — | Tilgjengelighetsbeskrivelse |
| D | Aktiv | Ja/Nei | ja | Om bildet vises på nettsiden |
| E | Rekkefølge | Tall | 99 | Sorteringsverdi (lavest først) |
| F | Skala | Desimal | 1.0 | Zoom-nivå (0.5–3.0) |
| G | PosX | Heltall | 50 | Horisontalt fokuspunkt (0–100%) |
| H | PosY | Heltall | 50 | Vertikalt fokuspunkt (0–100%) |

### Content Collection — galleri

```typescript
const galleri = defineCollection({
    loader: async () => {
        const filePath = path.join(process.cwd(), 'src/content/galleri.json');
        if (!fs.existsSync(filePath)) return [];
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return data.map((g: any, i: number) => ({
            id: g.id || `galleri-${i}`,
            ...g
        }));
    },
    schema: z.object({
        id: z.string(),
        title: z.string(),
        image: z.string().optional(),
        altText: z.string().optional(),
        order: z.number().default(99),
        imageConfig: z.object({
            scale: z.number().default(1.0),
            positionX: z.number().default(50),
            positionY: z.number().default(50)
        }).optional()
    })
});
```

### Admin UI — sammenslått "Bilder"-modul

Dashboard-kort:
```
┌─────────────────────────────────────┐
│  Bildegalleriet                     │
│  Administrer forsidebilde og        │
│  galleribilder med zoom og utsnitt. │
│  [Start behandlingen]              │
└─────────────────────────────────────┘
```

Modulvisning (to seksjoner, vertikalt):
```
╔═══════════════════════════════════════════╗
║  Bilder                                   ║
╠═══════════════════════════════════════════╣
║                                           ║
║  ┌─── FORSIDEBILDE ─────────────────────┐ ║
║  │ (eksisterende UI — uendret)          │ ║
║  │ Bildevalg + Zoom/Pan sliders         │ ║
║  │ + Live Preview (16:10)               │ ║
║  └──────────────────────────────────────┘ ║
║                                           ║
║  ┌─── GALLERIBILDER ──── [+ Legg til] ──┐ ║
║  │ ● Aktiv  │ Klinikkbilde    │ #1      │ ║
║  │ ● Aktiv  │ Venteområde     │ #2      │ ║
║  │ ○ Inaktiv│ Gammel fasade   │ #5      │ ║
║  └──────────────────────────────────────┘ ║
╚═══════════════════════════════════════════╝
```

Galleri-redigeringsvisning (klikk på rad):
```
╔══════════════════════════════════════════════╗
║  ← Tilbake til liste                         ║
╠══════════════════════════════════════════════╣
║  SKJEMA              │  LIVE PREVIEW (4:3)   ║
║  ──────              │  ──────────────       ║
║  Bilde: [X.jpg][Velg]│  ┌──────────────┐    ║
║  Tittel: [________]  │  │              │    ║
║  Alt:    [________]  │  │    BILDE     │    ║
║  Rekkefølge: [3]     │  │  med zoom/   │    ║
║  ☑ Aktiv             │  │  pan preview │    ║
║                      │  └──────────────┘    ║
║  Zoom: ═══●════      │                      ║
║  X:    ════●═══      │                      ║
║  Y:    ══●═════      │                      ║
║                      │                      ║
║  ✅ Lagret!           │                      ║
║  [Slett] [Tilbake]   │                      ║
╚══════════════════════════════════════════════╝
```

**Viktig implementeringsdetalj:** `parentFolderId` hentes ÉN gang i `loadBilderModule()` og deles mellom forsidebilde- og galleriseksjonen. Unngå dobbel API-kall.

**Kodestruktur:** Galleri-listelogikken legges i `loadGalleriListeModule()` i `admin-dashboard.js` (testbar med Vitest), IKKE inline i admin/index.astro. `loadBilderModule()` i admin/index.astro kaller forsidebilde-UI + `loadGalleriListeModule()` sekvensielt.

---

## Del 4: Layout-forbedringer (utover galleri)

Følgende er selvstendige forbedringer som kan implementeres uavhengig av galleriet.

### Prioritert etter effekt/innsats:

| # | Tiltak | Effekt | Innsats | Kommentar |
|---|--------|--------|---------|-----------|
| 1 | **Footer:** Legg til logo (liten, h-10) + copyright-år. Øk `py-4` → `py-8`. | Liten — avrunder helheten | Trivielt | Dagens footer er bare én linje |
| 2 | **Aksentfarge (teal):** `--color-accent: #0d9488` på heading-accent, card-progress-bar, card-accent-corner hover | Stor — bryter slate-monotonien, varme | Lav — 3 CSS-verdier | Implementer som separat PR etter galleri |

### Utsatt til egen runde (scope creep for galleri-PR):

| Tiltak | Hvorfor utsatt |
|--------|---------------|
| font-black → font-extrabold | Estetisk preferanse, minimal impact |
| section-intro text-lg → text-xl | Bør testes visuelt på alle seksjoner |
| Tannleger mobil horisontal layout | Helt uavhengig av galleri, egen side |

---

## Del 5: Interaksjon og UX

| Element | Oppførsel |
|---------|-----------|
| Hover (desktop) | `scale-[1.02]` + subtil shadow-lift, 300ms transition |
| Klikk | Ingen lightbox. Bildene er atmosfæriske. |
| Scroll | Ingen animasjoner. Bilder er statisk synlige. |
| Touch (mobil) | Passive bilder, ingen swipe/pinch. |
| Reduced motion | `@media (prefers-reduced-motion)`: deaktiver hover-scale |
| Tastatur | Bilder er dekorative, ingen fokus-trap |

### Tilgjengelighet

- Alle bilder har meningsfull `alt`-tekst (fra Sheets "AltTekst"-kolonne)
- Klinikk-stripen wrappes i `<section>` med `aria-label="Bilder fra klinikken"`
- Bildetekst som gradient-overlay — tekst er hvit på mørk gradient (god kontrast)

---

## Del 6: Ytelse

- Alle galleribilder: `loading="lazy"` (under fold)
- Astro Image gir automatisk WebP/AVIF, responsive srcset
- Total payload for 4-8 bilder: ~100-200KB (lazy loaded)
- LCP påvirkes ikke (hero-bildet er uendret med `eager` loading)
- Build-tid: +5-15 sekunder for 4-8 bilder

---

## Del 7: Testplan

### Unit-tester (Vitest)

| Fil | Hva testes | Dekningskrav |
|-----|------------|-------------|
| `tests/sync-galleri.test.js` | syncGalleri: leser Sheets, laster ned bilder, skriver JSON, rydder ubrukte, bruker parents[0], håndterer manglende fane gracefully | ≥80% branch |
| `admin-client.js` (eksist. testfil) | getGalleriRaw, updateGalleriRow, addGalleriRow, deleteGalleriRowPermanently | ≥80% branch |
| `admin-dashboard.js` (eksist. testfil) | loadGalleriListeModule, enforceAccessControl med nytt modul-ID | ≥80% branch |

### E2E-tester (Playwright)

| Scenario | Hva verifiseres |
|----------|----------------|
| Galleri-komponent | Bilder vises, mobil viser 2, desktop viser alle |
| Admin: Bilder-modul | Kort vises, modul laster, forsidebilde + galleriliste |

### CI/CD

**Ingen endringer nødvendig.** Ingen nye env-variabler.

---

## Del 8: Implementeringsrekkefølge

| Steg | Oppgave | Avhenger av |
|------|---------|-------------|
| 1 | Opprette Sheets-fane "galleri" (manuelt) | — |
| 2 | `syncGalleri()` i sync-data.js + tester | Steg 1 |
| 3 | `galleri` collection i content.config.ts | Steg 2 |
| 4 | `Galleri.astro` komponent | Steg 3 |
| 5 | Plassering i index.astro | Steg 4 |
| 6 | `getGalleriRaw` etc. i admin-client.js + tester | — |
| 7 | `loadGalleriListeModule()` i admin-dashboard.js + tester | Steg 6 |
| 8 | Sammenslått `loadBilderModule()` i admin/index.astro | Steg 6, 7 |
| 9 | Build-sjekk, coverage-rapport, E2E | Steg 1-8 |

Steg 2-5 (sync + frontend) og steg 6-8 (admin) kan jobbes med parallelt.

---

## Del 9: Forutsetninger og advarsler

1. **Profesjonelle bilder er et absolutt krav.** Dårlige mobilbilder ser verre ut enn ingen galleri. Bilder bør tas med god belysning i landskapsformat (4:3).
2. **4-8 bilder er sweet spot.** Kvalitet > kvantitet.
3. **Motiver (prioritert):**
   - Fasade / inngangsparti
   - Venterom / resepsjonsområde
   - Behandlingsrom (tomt, rent, lyst)
   - Team-bilde (alle ansatte, smilende)
   - Moderne utstyr
4. **Sheets-fanen "galleri" må opprettes manuelt** av eier før sync kan kjøres.
