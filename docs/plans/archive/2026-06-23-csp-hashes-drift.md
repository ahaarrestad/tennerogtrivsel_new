# Plan: Vurder og forhindre drift i csp-hashes.json

**Dato:** 2026-06-23
**Oppgave:** Vurder drift i `csp-hashes.json` (TODO backlog)
**Opprinnelse:** Galleri-bildeprosessering-oppgave (2026-06-07)

## Bakgrunn og diagnose

Oppgaven ble opprettet fordi den committede `src/generated/csp-hashes.json` ikke matchet det `npm run generate-csp-hashes` produserte.

Vår undersøkelse viser følgende:
1. **Ingen aktiv drift på `main`:** Etter en ren `npm run build:ci && npm run generate-csp-hashes` på gjeldende `main`, produseres nøyaktig de samme tre hashene som er committet i `src/generated/csp-hashes.json`:
   - `sha256-jntNPbWSrbvdk11nghAVxQyHQjX3RbQhnUOCmULUBeU=`
   - `sha256-MFxa1zBj/Y2poaVAP1f7PQtUP4hphn/VjdoZc3e1W/w=`
   - `sha256-usCgPDv0aHrS2Dmac1c6uhlvhdRbVFiWObaQpHqB6wo=`
2. **Rot-årsak:** Generatoren leser inline-skript fra `dist/` — et bygg-artefakt. Den committede fila er derfor alltid bare så fersk som det `dist/` den sist ble generert fra. «Drift» er ikke ikke-determinisme, men et symptom på at fila ble generert fra et utdatert eller fremmed bygg. Den opprinnelige observasjonen (2026-06-07) skjedde midt i galleri-bildeprosesseringen, da `dist/` var bygget fra annen kildekode enn det `main` nå reflekterer — derav én avvikende inline-hash. En ren `build:ci && generate-csp-hashes` på gjeldende `main` gir nøyaktig de committede hashene (verifisert).
3. **Drift oppstår typisk hvis:**
   - Utviklere kjører `npm run generate-csp-hashes` på en utdatert eller uren `dist/`-mappe (f.eks. etter å ha bygget en annen branch med andre inline-skript).
   - Utviklere gjør endringer som endrer minifikasjonen av inline-skript (f.eks. Vite-oppgradering eller endringer i `gallery-lightbox.js`), men glemmer å kjøre generatoren og committe den oppdaterte fila.
   - Merk: `<script type="application/json">` (galleri-lightbox-data, datadrevet) ekskluderes allerede fra hashing, så datadrevne skript forårsaker ikke drift.
4. **Konsekvens:** I produksjon genereres hashene på nytt fra det faktiske bygget før CloudFront-oppdateringen, så produksjon har korrekte hasher. Men en utdatert fil i git kan føre til at lokal testing i `dev:secure` feiler pga. CSP-blokkering.

## Mål

Etablere en automatisk kvalitetsport (quality gate) i CI som verifiserer at den committede `src/generated/csp-hashes.json` er i sync med gjeldende kildekode.

## Konkrete steg

### 1. Oppdater GitHub Actions-workflow (`.github/workflows/deploy.yml`)

Vi legger til et verifiseringssteg i `e2e-tests`-jobben, rett etter `Build Astro site (fixtures)` (deploy.yml:78). Forutsetningen er at de *hashede* inline-skriptene er statiske og uavhengige av dynamiske data, slik at fixtures-bygget gir samme hasher som prod-bygget. **Verifisert empirisk (2026-06-23):** `seed:fixtures && build:ci && generate-csp-hashes` produserer nøyaktig de committede hashene.

**Determinisme:** Porten sammenligner byte-eksakt med `git diff`, så hash-fila må ha stabil rekkefølge på tvers av filsystemer (dev-maskin vs. CI-container). `readdirSync` garanterer ikke traverseringsrekkefølge, så `generate-csp-hashes.mjs` sorterer nå hash-lista før den skrives (rekkefølgen er semantisk irrelevant for CSP — `security-headers.ts` space-joiner dem). Dette eliminerer falske CI-feil fra rein rekkefølge-drift, og dekkes av en regresjonstest i `scripts/__tests__/generate-csp-hashes.test.mjs`.

Legg til følgende steg etter `Build Astro site (fixtures)`:

```yaml
      - name: Verify CSP hashes are in sync
        run: |
          npm run generate-csp-hashes
          git diff --exit-code src/generated/csp-hashes.json
```

Dette vil feile PR-bygg dersom en utvikler har endret inline-skript uten å committe den oppdaterte `csp-hashes.json`-filen.

### 2. Oppdater `TODO.md`

Oppdater oppgaven i `TODO.md` med lenke til denne planen:

```markdown
- [ ] **Vurder drift i `csp-hashes.json`** ([plan](docs/plans/2026-06-23-csp-hashes-drift.md))
```

## Definition of Done (DoD)

- [ ] Planen er godkjent av bruker.
- [ ] `.github/workflows/deploy.yml` er oppdatert med verifiseringstrinnet.
- [ ] Lokalt testløp (`git diff --exit-code`) bekrefter at filen er i sync på `main`.
- [ ] `TODO.md` er oppdatert med plan-lenken.
