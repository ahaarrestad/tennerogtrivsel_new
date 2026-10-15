# Plan: deteksjon av stille degradering (kart-tiles og innhold)

Spec: [docs/designs/archive/2026-10-15-stille-degradering.md](../../designs/archive/2026-10-15-stille-degradering.md)

## Mål og avgrensninger

Timevis sjekk av at prod leverer ekte kart-tiles fra CARTO med vår nøkkel og ikke-tomt innhold,
med funn i `uptime`-issuen. Ikke med: endringer i `sync-data.js`, cache-policy, kontaktskjema,
issue-oppførsel, pikselanalyse (se spec, «Avgrensninger»).

## Steg

### 1. `scripts/check-prod-content.mjs` (ny)

Ren ESM, ingen avhengigheter. Rene, eksporterte funksjoner; `main` kjøres bare når fila startes
direkte (samme mønster som `check-branch-coverage.mjs:37`).

- `fetchWithRetry(url, { fetchImpl, sleep, tries = 3, pauseMs = 2000, timeoutMs = 15000, init })`
  → `{ ok: true, status, headers, body: Buffer }` eller `{ ok: false, error }`. Kaster aldri.
  Prøver på nytt ved kast/timeout (`AbortSignal.timeout`), `5xx` og `429`.
- `pngInfo(buf)` → `{ isPng, width, height }` fra signatur + IHDR (byte 16–23).
- `checkTile(navn, res)` → funn (T1).
- `pickFreshTile(rng)` → `{ z: 17, x, y }` innenfor x 67567–67647, y 38787–38893.
- `checkKeyWorks(proxyRes, directRes)` → `{ funn?, ikkeAvgjort? }` (T3): ikke avgjort når proxyen
  svarte `x-cache` med `Hit` eller direkte-hentingen feilet; funn når byte-like. Kommentert som
  CARTO-spesifikk.
- `extractTjenesteLinks(html)`, `extractContentImages(html)` (`src="/_astro/…"`, uten `tt-logo`;
  tåler `<img>` uten `src`).
- `clean(verdi)` → kortet til 80 tegn, uten `@` og backticks.
- `runChecks({ site, cartoBase, fetchImpl, sleep, rng, log })` → `{ funn: string[], notater: string[] }`.
  Henter: forside, `/tannleger/`, `/galleri/`, `/prisliste/`, første tjenesteside, første
  tannlegebilde, fast tile, fersk tile via proxy, fersk tile direkte fra CARTO. Avhengige sjekker
  hoppes over når grunnlaget mangler. `site` tåler avsluttende `/`.
- `main()`: funn → stdout, én per linje; notater → stderr og (hvis satt) `$GITHUB_STEP_SUMMARY`.
  Exit 0 også med funn. Uventet unntak → stderr + exit 1. `SITE` og `CARTO_BASE` fra miljøet
  (standard prod og `https://basemaps.cartocdn.com/rastertiles/voyager`).

### 2. `scripts/__tests__/check-prod-content.test.mjs` (ny)

Følger `docs/guides/test-guide.md` (`it.each`); ingen ekte nettverk — `fetchImpl`, `sleep` og
`rng` er stubber. HTML-fixtures er korte utdrag av prod-markup.

- `pngInfo`: gyldig 256×256, annen størrelse, ikke-PNG, for kort buffer.
- `fetchWithRetry`: OK første gang; `503` så OK; `429` så OK; kast tre ganger → `ok: false`;
  `404` prøves ikke på nytt; timeout-signal sendes med.
- `checkTile`: OK; status ≠ 200; feil content-type; ikke PNG; feil størrelse.
- `pickFreshTile`: rng 0 og ~1 gir hjørnene, alltid innenfor utvalget.
- `checkKeyWorks`: like → funn med runbook-lenke; ulike → ingenting; `Hit` → ikke avgjort;
  direkte feilet → ikke avgjort.
- Uttrekk: prod-utdrag, tom side, bare logo, `<img>` uten `src`, `srcset` alene, nav-lenken
  `/tjenester/` uten slug.
- `clean`: lang streng, `@`, backticks.
- `runChecks`: alt OK → ingen funn; erstatningsbilde fra proxy = direkte → T3; `Hit` → notat, ikke
  funn; CARTO direkte nede → notat; forsiden kaster → funn og ingen krasj; tom tannlegeside → C2,
  C5 hoppet over; «Bilde mangler» → C4; bilde `404` → C5; tjenesteside `404` → C6; «Prislisten er
  tom» → C7.
- `main` (via injisert stdout/stderr eller ved å kalle med stubbet `runChecks`): funn på stdout,
  notater på stderr — aldri omvendt.

### 3. `.github/workflows/uptime-check.yml`

- Nye steg før `probe`: `actions/checkout` (SHA som i `deploy.yml`, `persist-credentials: false`,
  `sparse-checkout` med `scripts/check-prod-content.mjs` og `.nvmrc`) og `actions/setup-node`
  (SHA som i `deploy.yml`, `node-version-file: .nvmrc`).
- `timeout-minutes: 5` → `10` (verste fall: curl-retries + 9 hentinger × 3 × 15 s).
- I `probe`, etter TLS-sjekken, kun når forsiden svarte `200`:
  ```bash
  if INNHOLD=$(node scripts/check-prod-content.mjs); then
    while IFS= read -r L; do [ -n "$L" ] && FEIL+=("$L"); done <<< "$INNHOLD"
  else
    FEIL+=("Innholdssjekken (check-prod-content.mjs) krasjet — se loggen")
    echo "krasj=true" >> "$GITHUB_OUTPUT"
  fi
  ```
- Nytt siste steg `Feil jobben hvis innholdssjekken krasjet` (`if: steps.probe.outputs.krasj == 'true'`,
  `exit 1`) — etter issue-stegene, så issuen likevel opprettes.
- Oppdater toppkommentaren: hva som sjekkes, og at tile-sjekken bruker en fersk tilfeldig tile.

### 4. Dokumentasjon

- `docs/architecture/sikkerhet.md`, ved `/tiles/*`-runbooken: kort avsnitt om T3 (hva funnet
  betyr, hvorfor tilfeldig tile, hva «ikke avgjort» betyr). T3-funnet lenker hit.
- `.claude/skills/helsesjekk/SKILL.md`: `uptime`-issuen dekker nå også kart og innhold.
- `TODO.md`: lenk spec/plan; ved fullføring arkiver etter flyten.

## Test og definition of done

- `/quality-gate` grønn (lint, unit, ≥ 80 % branch coverage for `check-prod-content.mjs`, E2E,
  build, audit).
- Lokalt mot prod: ingen funn, exit 0, notat om T3 avgjort eller ikke.
- Lokal negativ test med en liten `node:http`-server i scratchpad som serverer prod-HTML og:
  (a) CARTOs nøkkelløse erstatningsbilde på `/tiles/*` med `x-cache: Miss`, og `CARTO_BASE` mot
  ekte CARTO → T3-funn; (b) `503` på `/tannleger/` → funn, exit 0.
- Workflow-snutten kjørt lokalt i bash med stubbet script (tomt, to funn, exit 1) → riktig `FEIL`
  og `krasj`.
- Etter merge: `gh workflow run uptime-check.yml`, verifiser grønn kjøring, ingen `uptime`-issue,
  og T3-notatet i jobbsammendraget.

## Risiko og usikkerhet

- **Fersk tile kan være cachet** (en annen besøkende eller tidligere kjøring) → T3 ikke avgjort den
  timen. Sannsynligheten er lav med ~8 700 tiles; notatet i sammendraget viser det.
- **CARTO slutter å kreve nøkkel** → proxy og direkte blir like → falsk T3. Funnet forklarer hva
  det betyr; svaret er da å fjerne T3 (og nøkkelen).
- **CARTO blokkerer runner-IP-er** → T3 alltid ikke avgjort, synlig i sammendraget men uten issue.
  Akseptert.
- **CARTO-kvote:** én ekstra nøkkel-forespørsel per time (~720/mnd). Antatt ubetydelig; kunne ikke
  verifiseres mot avtalen.
- **HTML-markørene** er koblet til dagens markup (`/tjenester/<slug>/`, `/_astro/`, `tt-logo`,
  tomt-tekstene). Endres markupen, kan sjekken gi falsk alarm — synlig ved neste kjøring og billig å
  rette. Fixtures fra prod gjør koblingen synlig i testene.
- **Bevisst tømt galleri** gir C3. Lite sannsynlig; da justeres sjekken.
