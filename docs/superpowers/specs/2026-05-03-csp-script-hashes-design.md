# Design: Erstatt `'unsafe-inline'` med SHA256-hashes i script-src (CSP Task 8.3)

**Dato:** 2026-05-03
**Relatert plan:** `docs/plans/2026-04-28-sikkerhetshardening.md` — Task 8, Steg 8.3

---

## Mål

Fjerne `'unsafe-inline'` fra `script-src` i CSP ved å erstatte det med SHA256-hashes av de faktiske inline-skriptene i prod-bygget. Både dev-middleware og CloudFront prod-policy skal bruke hash-basert CSP.

---

## Kontekst

Sittet er en statisk Astro-site servert fra S3+CloudFront. Middleware kjører kun i `astro dev`. CSP settes av:
- `middleware.ts` → dev
- CloudFront Response Headers Policy → prod

To typer inline-skript finnes i prod-HTML:
1. **Layout-hjelper** (`initLayoutHelper`) — Astro inliner dette automatisk fra `Layout.astro <script>` ved bygg. Kun i prod (i dev serveres det som Vite-modul). Identisk innhold på alle sider → én hash.
2. **Print-trigger** (`prisliste.astro <script is:inline>`) — inline i både dev og prod, identisk innhold → én hash.

`<script type="application/ld+json">` og `<script src="...">` er ikke kjørbare inline-scripts og ignoreres.

---

## Arkitektur

```
astro build:ci
    └─► scripts/generate-csp-hashes.mjs
            ├─ scanner dist/**/*.html
            ├─ ekstraherer inline <script>-innhold
            │   (ekskluderer: src=, type=application/ld+json)
            ├─ sha256 + base64-enkoding (Node crypto)
            ├─ deduplicering
            └─► src/generated/csp-hashes.json   ← sjekkes inn

security-headers.ts
    ├─ importerer csp-hashes.json
    ├─ bygger script-src med hashes
    │   (fallback: 'unsafe-inline' hvis tom liste)
    └─► middleware.ts (dev) + dokumentasjon for CloudFront (prod)

deploy.yml — etter S3-sync:
    └─► node scripts/update-cloudfront-csp.mjs
            ├─ leser csp-hashes.json
            ├─ aws cloudfront get-response-headers-policy
            ├─ patcher script-src
            └─► aws cloudfront update-response-headers-policy
```

---

## Komponenter

### `scripts/generate-csp-hashes.mjs`

Frittstående Node-script. Leser `dist/**/*.html`, ekstraherer innhold av inline `<script>`-blokker, beregner `sha256` med `node:crypto`, skriver `src/generated/csp-hashes.json`.

Filtrering:
- Ekskluder `<script src="...">`
- Ekskluder `<script type="application/ld+json">`
- Inkluder alt annet (herunder `type="module"` uten `src` og skript uten type-attributt)

Output-format:
```json
{ "scriptHashes": ["sha256-abc123==", "sha256-def456=="] }
```

### `src/generated/csp-hashes.json`

Generert fil, sjekkes inn i repo. Endrer seg kun ved Astro-oppgradering eller endring av inline-skript-innhold. Diff i PR gir synlighet over hash-endringer.

Initiell verdi (før første bygg):
```json
{ "scriptHashes": [] }
```

### `security-headers.ts` (oppdatert)

Importerer `csp-hashes.json`. Bygger `script-src` dynamisk:
- Hvis `scriptHashes` er ikke-tom → bruk hashes, ikke `'unsafe-inline'`
- Hvis tom → bruk `'unsafe-inline'` som fallback

```typescript
import hashData from '../generated/csp-hashes.json';

const scriptSrcValues = hashData.scriptHashes.length > 0
    ? ["'self'", ...hashData.scriptHashes.map(h => `'${h}'`),
       "https://apis.google.com", "https://accounts.google.com"]
    : ["'self'", "'unsafe-inline'",
       "https://apis.google.com", "https://accounts.google.com"];
```

### `scripts/update-cloudfront-csp.mjs`

Leser `src/generated/csp-hashes.json`, henter eksisterende CloudFront Response Headers Policy via `aws cloudfront get-response-headers-policy`, patcher `ContentSecurityPolicy`-feltet, oppdaterer med `update-response-headers-policy`. Idempotent.

Miljøvariabler som trengs: `CLOUDFRONT_POLICY_ID` (policy-ID, ikke distribusjons-ID).

### `package.json` — nye scripts

```json
"generate-csp-hashes": "node scripts/generate-csp-hashes.mjs",
"dev:secure": "npm run build:ci && npm run generate-csp-hashes && astro dev"
```

### `deploy.yml` — nytt steg i `deploy`-jobben

Etter S3-sync og CloudFront-cache-invalidering:
```yaml
- name: Update CloudFront CSP hashes
  run: node scripts/update-cloudfront-csp.mjs
  env:
    CLOUDFRONT_POLICY_ID: ${{ secrets.CLOUDFRONT_CSP_POLICY_ID }}
```

IAM-rollen til deploy-jobben må ha:
- `cloudfront:GetResponseHeadersPolicy`
- `cloudfront:UpdateResponseHeadersPolicy`

### `README.md` — utvidet "Lokalt oppsett"

```markdown
### Lokalt oppsett

For standard utvikling (rask oppstart, unsafe-inline i CSP):
    npm run dev

For å teste med produksjons-lik hash-basert CSP (anbefalt etter
Astro-oppgraderinger eller endringer i inline-skript):
    npm run dev:secure

`dev:secure` bygger siden, beregner CSP-hashes og starter dev-serveren
med disse hashene aktive i middleware. Verifiser at det ikke er
CSP-violations i browser-konsollen.
```

---

## Testing

### Unit-tester: `scripts/__tests__/generate-csp-hashes.test.mjs`

- Inline `<script type="module">` → korrekt sha256-hash i output
- `<script src="external.js">` → ignoreres
- `<script type="application/ld+json">` → ignoreres
- To sider med identisk inline-skript → kun én hash (deduplicering)
- `<script is:inline>` → inkluderes og hashes korrekt
- Ingen inline-skript i HTML → tom liste returneres

### Oppdaterte `middleware.test.ts`

- `csp-hashes.json` med hashes → `script-src` inneholder `'sha256-...'`, mangler `'unsafe-inline'`
- `csp-hashes.json` med tom liste → `script-src` inneholder `'unsafe-inline'`

### Manuell verifisering

```bash
npm run dev:secure
# Åpne http://localhost:4321/ og sjekk browser-konsoll for CSP-violations
curl -I http://localhost:4321/ | grep Content-Security-Policy
# Skal ikke inneholde 'unsafe-inline' i script-src
```

---

## Filer som endres

| Fil | Handling |
|-----|----------|
| `scripts/generate-csp-hashes.mjs` | Ny |
| `scripts/__tests__/generate-csp-hashes.test.mjs` | Ny |
| `scripts/update-cloudfront-csp.mjs` | Ny |
| `src/generated/csp-hashes.json` | Ny (initiell tom liste) |
| `src/utils/security-headers.ts` | Oppdatert |
| `src/__tests__/middleware.test.ts` | Oppdatert |
| `package.json` | Oppdatert (2 nye scripts) |
| `.github/workflows/deploy.yml` | Oppdatert (nytt steg) |
| `README.md` | Oppdatert (lokalt oppsett) |
| `docs/architecture/sikkerhet.md` | Oppdatert (CloudFront policy ID-secret, IAM-krav) |

---

## Avhengigheter og forutsetninger

- `CLOUDFRONT_CSP_POLICY_ID` må legges til som GitHub-secret (ID-en til Response Headers Policy, ikke distribusjons-ID)
- Deploy-jobbens IAM-rolle må ha `cloudfront:GetResponseHeadersPolicy` + `cloudfront:UpdateResponseHeadersPolicy`
- `src/generated/csp-hashes.json` opprettes med tom liste som del av denne PR-en
- `resolveJsonModule: true` er allerede aktivert via Astros base-tsconfig — ingen endring nødvendig
