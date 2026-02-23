# Plan: Legg til toggling for tjenester

## Kontekst

Tjenester (behandlinger) lagres som markdown-filer i Google Drive og synkes til `src/content/tjenester/*.md` ved bygg. I dag er alle tjenester alltid synlige. Oppgaven er å legge til aktiv/inaktiv-toggle i admin-panelet — samme visuelle mønster som galleriet — men med frontmatter i markdown som datakilde (ikke Google Sheets).

## Tilnærming: Frontmatter-basert toggle

Legger til `active`-felt i YAML-frontmatter. Toggling i admin leser filen fra Drive, endrer feltet, og lagrer tilbake. Eksisterende filer uten feltet behandles som aktive (bakoverkompatibelt via Zod `.default(true)`).

## Steg

### 1. Content-schema (`src/content.config.ts`)
- Legg til `active: z.boolean().default(true)` i tjenester-skjemaet
- Eksisterende filer uten feltet blir automatisk `active: true`

### 2. Frontend-filtrering
**`src/components/Tjenester.astro`** — filtrer inaktive fra kortlisten:
```js
const sortedServices = allServices
    .filter(s => s.data.active !== false)
    .sort(...)
```

**`src/pages/tjenester/[id].astro`** — filtrer fra `getStaticPaths()` (ingen detaljside for inaktive) og fra sidebar-listen.

### 3. Admin dashboard (`src/scripts/admin-dashboard.js`)
Utvid `loadTjenesterModule(folderId, onEdit, onDelete, onToggleActive)`:
- Legg til toggle-switch HTML per tjeneste (identisk utseende som galleri)
- `opacity-60` på inaktive kort
- Bind toggle-klikk til `onToggleActive(driveId, fileName, service)` via programmatiske event-lyttere
- Parse `active` fra frontmatter (default `true` hvis mangler)
- Oppdater retry-kall til å inkludere `onToggleActive`

### 4. Admin toggle-handler (`src/pages/admin/index.astro`)
Ny `toggleTjenesteActive(driveId, fileName, service)`:
1. Optimistisk UI-oppdatering (toggle visuelt umiddelbart)
2. `getFileContent(driveId)` → `parseMarkdown()` → toggle `active` → `stringifyMarkdown()` → `saveFile()`
3. Ved feil: reverser UI og reload listen

Oppdater `loadTjenesterModule`-kallet til å sende `toggleTjenesteActive` som callback.

Oppdater `editTjeneste` sin lagre-logikk til å bevare `active`-feltet.

### 5. Tester (`src/scripts/__tests__/admin-dashboard.test.js`)
~7 nye tester:
- Toggle-switch rendres med riktig tilstand (aktiv/inaktiv)
- `onToggleActive` callback trigges ved klikk
- Toggle-klikk trigrer IKKE edit
- Tjenester uten `active`-felt vises som aktive
- Inaktive kort har `opacity-60`
- Retry-knapp sender `onToggleActive` videre

### Viktig: parseMarkdown og booleans
`parseMarkdown()` returnerer alle verdier som strenger (`"true"`/`"false"`). Admin-logikken bruker `s.active !== 'false' && s.active !== false` for å håndtere begge typer. Zod-skjemaet i Astro konverterer korrekt til boolean ved bygg.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/content.config.ts` | `active: z.boolean().default(true)` |
| `src/components/Tjenester.astro` | Filter inaktive |
| `src/pages/tjenester/[id].astro` | Filter i getStaticPaths + sidebar |
| `src/scripts/admin-dashboard.js` | Toggle-UI i loadTjenesterModule |
| `src/pages/admin/index.astro` | toggleTjenesteActive + bevar active ved save |
| `src/scripts/__tests__/admin-dashboard.test.js` | ~7 nye tester |

## Verifisering
1. Kjør `npm test` — alle eksisterende + nye tester skal bestå
2. Sjekk branch coverage ≥ 80% for berørte filer
3. `npm run build` — bygget skal fungere
4. Manuell test i admin: toggle en tjeneste, verifiser at filen på Drive oppdateres
