# CSP script-src Hash-erstatning (Task 8.3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjerne `'unsafe-inline'` fra `script-src` i CSP ved å generere SHA256-hashes av inline-skript etter bygg, lagre dem i repo, og automatisk oppdatere CloudFront Response Headers Policy ved deploy.

**Architecture:** Post-build Node-script scanner `dist/**/*.html` for inline `<script>`-blokker, beregner SHA256-hashes og skriver til `src/generated/csp-hashes.json`. `security-headers.ts` importerer filen og bruker hashes (eller `'unsafe-inline'` som fallback). CI oppdaterer CloudFront-policyen via AWS CLI etter S3-deploy.

**Tech Stack:** Node 24 (`node:crypto`, `node:fs`), Vitest, TypeScript, AWS CLI (`cloudfront`), GitHub Actions.

---

## Filer

| Fil | Handling |
|-----|----------|
| `scripts/generate-csp-hashes.mjs` | Ny — scanner dist/, beregner hashes, skriver JSON |
| `scripts/__tests__/generate-csp-hashes.test.mjs` | Ny — unit-tester for parsing og hashing |
| `scripts/update-cloudfront-csp.mjs` | Ny — oppdaterer CloudFront policy via AWS CLI |
| `src/generated/csp-hashes.json` | Ny — initial tom liste, sjekkes inn |
| `src/utils/security-headers.ts` | Oppdatert — importerer hash-fil, bygger script-src dynamisk |
| `src/__tests__/middleware.test.ts` | Oppdatert — to nye tester for hash/fallback-atferd |
| `vitest.config.ts` | Oppdatert — inkluder `scripts/__tests__/` |
| `package.json` | Oppdatert — `generate-csp-hashes` og `dev:secure` scripts |
| `.github/workflows/deploy.yml` | Oppdatert — CloudFront CSP-oppdatering etter deploy |
| `README.md` | Oppdatert — `dev:secure`-dokumentasjon |
| `docs/architecture/sikkerhet.md` | Oppdatert — automatisert CloudFront-oppdatering, IAM-krav |

---

## Task 1: Hash-generator script (TDD)

**Files:**
- Create: `scripts/generate-csp-hashes.mjs`
- Create: `scripts/__tests__/generate-csp-hashes.test.mjs`
- Modify: `vitest.config.ts`

- [ ] **Steg 1.1: Utvid vitest.config.ts til å inkludere scripts-tester**

  I `vitest.config.ts`, legg til `scripts/**/__tests__/**/*.mjs` i `include`-arrayet:

  ```typescript
  include: [
      'src/**/__tests__/**/*.{ts,js}',
      'lambda/**/__tests__/**/*.mjs',
      'scripts/**/__tests__/**/*.mjs',
  ],
  ```

- [ ] **Steg 1.2: Opprett testfil med failing tester**

  Opprett `scripts/__tests__/generate-csp-hashes.test.mjs`:

  ```javascript
  import { describe, it, expect } from 'vitest';
  import { createHash } from 'node:crypto';
  import { extractInlineScripts, computeHash } from '../generate-csp-hashes.mjs';

  describe('extractInlineScripts', () => {
      it('ekstraherer inline type=module script', () => {
          const html = '<html><script type="module">console.log(1)</script></html>';
          expect(extractInlineScripts(html)).toEqual(['console.log(1)']);
      });

      it('ignorerer scripts med src-attributt', () => {
          const html = '<script src="/foo.js"></script>';
          expect(extractInlineScripts(html)).toEqual([]);
      });

      it('ignorerer application/ld+json scripts', () => {
          const html = '<script type="application/ld+json">{"@context":"https://schema.org"}</script>';
          expect(extractInlineScripts(html)).toEqual([]);
      });

      it('ekstraherer is:inline script uten type-attributt', () => {
          const html = '<script is:inline>var x = 1;</script>';
          expect(extractInlineScripts(html)).toEqual(['var x = 1;']);
      });

      it('ekstraherer flerlinje script-innhold', () => {
          const content = '\nif (a) {\n  b();\n}\n';
          const html = `<script is:inline>${content}</script>`;
          expect(extractInlineScripts(html)).toEqual([content]);
      });

      it('returnerer tom liste ved ingen inline-skript', () => {
          const html = '<html><head></head><body></body></html>';
          expect(extractInlineScripts(html)).toEqual([]);
      });

      it('ekstraherer flere inline-skript fra samme HTML', () => {
          const html = '<script type="module">a()</script><script is:inline>b()</script>';
          expect(extractInlineScripts(html)).toEqual(['a()', 'b()']);
      });
  });

  describe('computeHash', () => {
      it('returnerer sha256- prefiks + base64', () => {
          const content = 'console.log(1)';
          const expected = 'sha256-' + createHash('sha256').update(content).digest('base64');
          expect(computeHash(content)).toBe(expected);
      });

      it('gir ulik hash for ulikt innhold', () => {
          expect(computeHash('a')).not.toBe(computeHash('b'));
      });
  });
  ```

- [ ] **Steg 1.3: Kjør testene og verifiser at de feiler**

  ```bash
  npm test -- --reporter=verbose 2>&1 | grep -E "generate-csp|FAIL|Cannot find"
  ```

  Forventet: `Cannot find module '../generate-csp-hashes.mjs'`

- [ ] **Steg 1.4: Implementer `scripts/generate-csp-hashes.mjs`**

  Opprett filen:

  ```javascript
  import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
  import { createHash } from 'node:crypto';
  import { join, dirname } from 'node:path';
  import { fileURLToPath } from 'node:url';

  const __dirname = dirname(fileURLToPath(import.meta.url));

  export function extractInlineScripts(html) {
      const results = [];
      const regex = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
          const content = match[1];
          if (content.trim()) results.push(content);
      }
      return results;
  }

  export function computeHash(content) {
      return 'sha256-' + createHash('sha256').update(content).digest('base64');
  }

  function walkHtmlFiles(dir) {
      const files = [];
      for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) {
              files.push(...walkHtmlFiles(full));
          } else if (entry.endsWith('.html')) {
              files.push(full);
          }
      }
      return files;
  }

  // Bare kjør hvis dette er entry-point (ikke ved import i tester)
  if (import.meta.url === `file://${process.argv[1]}`) {
      const distDir = join(__dirname, '../dist');
      const outputFile = join(__dirname, '../src/generated/csp-hashes.json');

      const htmlFiles = walkHtmlFiles(distDir);
      const allContents = htmlFiles.flatMap(f =>
          extractInlineScripts(readFileSync(f, 'utf-8'))
      );
      const uniqueHashes = [...new Set(allContents.map(computeHash))];

      writeFileSync(outputFile, JSON.stringify({ scriptHashes: uniqueHashes }, null, 2) + '\n');
      console.log(`Wrote ${uniqueHashes.length} hash(es) to src/generated/csp-hashes.json`);
      uniqueHashes.forEach(h => console.log(`  ${h}`));
  }
  ```

- [ ] **Steg 1.5: Kjør testene og verifiser at de passerer**

  ```bash
  npm test -- --reporter=verbose 2>&1 | grep -E "generate-csp|✓|×|PASS|FAIL"
  ```

  Forventet: alle 8 tester grønne.

- [ ] **Steg 1.6: Commit**

  ```bash
  git add scripts/generate-csp-hashes.mjs scripts/__tests__/generate-csp-hashes.test.mjs vitest.config.ts
  git commit -m "feat(security): legg til generate-csp-hashes script og tester (Task 8.3)"
  ```

---

## Task 2: Oppdater `security-headers.ts` med hash-støtte (TDD)

**Files:**
- Create: `src/generated/csp-hashes.json`
- Modify: `src/utils/security-headers.ts`
- Modify: `src/__tests__/middleware.test.ts`

- [ ] **Steg 2.1: Opprett initial `src/generated/csp-hashes.json`**

  ```bash
  mkdir -p src/generated
  ```

  Opprett `src/generated/csp-hashes.json`:

  ```json
  { "scriptHashes": [] }
  ```

- [ ] **Steg 2.2: Legg til failing tester i `middleware.test.ts`**

  Legg til to nye `describe`-blokker på slutten av `src/__tests__/middleware.test.ts`, etter eksisterende tester:

  ```typescript
  describe('src/middleware.ts – script-src hashes', () => {
      it('script-src bruker hashes når csp-hashes.json inneholder hashes', async () => {
          vi.resetModules();
          vi.doMock('../generated/csp-hashes.json', () => ({
              default: { scriptHashes: ['sha256-testHash1==', 'sha256-testHash2=='] }
          }));
          vi.doMock('astro:middleware', () => ({
              defineMiddleware: (fn: unknown) => fn,
          }));
          const mod = await import('../middleware');
          const handler = mod.onRequest as (ctx: unknown, next: () => Promise<Response>) => Promise<Response>;
          const response = await handler({}, makeNext());
          const csp = response.headers.get('Content-Security-Policy')!;

          expect(csp).toContain("'sha256-testHash1=='");
          expect(csp).toContain("'sha256-testHash2=='");
          expect(csp).not.toContain("'unsafe-inline'");
      });

      it('script-src faller tilbake til unsafe-inline når scriptHashes er tom', async () => {
          vi.resetModules();
          vi.doMock('../../src/generated/csp-hashes.json', () => ({
              default: { scriptHashes: [] }
          }));
          vi.doMock('astro:middleware', () => ({
              defineMiddleware: (fn: unknown) => fn,
          }));
          const mod = await import('../middleware');
          const handler = mod.onRequest as (ctx: unknown, next: () => Promise<Response>) => Promise<Response>;
          const response = await handler({}, makeNext());
          const csp = response.headers.get('Content-Security-Policy')!;

          expect(csp).toContain("'unsafe-inline'");
      });
  });
  ```

  **Merk:** Mocken bruker relativ sti fra `src/__tests__/` til JSON-filen. `vi.doMock` løser stier relativt til test-filen.

- [ ] **Steg 2.3: Kjør testene og verifiser at de to nye feiler**

  ```bash
  npm test -- --reporter=verbose 2>&1 | grep -E "script-src hashes|FAIL|✓|×"
  ```

  Forventet: de to nye testene feiler (eller `unsafe-inline`-testen passerer siden hash-filen er tom).

- [ ] **Steg 2.4: Oppdater `src/utils/security-headers.ts`**

  Erstatt hele filen med:

  ```typescript
  import hashData from '../generated/csp-hashes.json';

  const scriptSrcDirective = hashData.scriptHashes.length > 0
      ? `script-src 'self' ${hashData.scriptHashes.map(h => `'${h}'`).join(' ')} https://apis.google.com https://accounts.google.com`
      : `script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com`;

  export const CSP = [
      "default-src 'self'",
      scriptSrcDirective,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      // Bilder: eget domene + Google Drive-preview + data: URI + blob: (preview-bilder i admin)
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com",
      // Iframes: Google Drive + Google OAuth + GAPI iframe-kanaler (content-*.googleapis.com)
      "frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com",
      // API-kall: Google APIs + OAuth + telemetri fra Google-skript (gen_204)
      "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com",
  ].join('; ');

  export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
      'Content-Security-Policy': CSP,
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // COOP: same-origin-allow-popups kreves fordi admin åpner Google OAuth-popup
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  });
  ```

- [ ] **Steg 2.5: Kjør alle tester og verifiser at de passerer**

  ```bash
  npm test -- --reporter=verbose 2>&1 | grep -E "✓|×|PASS|FAIL|coverage"
  ```

  Forventet: alle tester grønne, coverage ≥ 80 % for `security-headers.ts`.

- [ ] **Steg 2.6: Commit**

  ```bash
  git add src/generated/csp-hashes.json src/utils/security-headers.ts src/__tests__/middleware.test.ts
  git commit -m "feat(security): oppdater security-headers.ts til hash-basert script-src (Task 8.3)"
  ```

---

## Task 3: CloudFront-oppdateringsscript

**Files:**
- Create: `scripts/update-cloudfront-csp.mjs`

- [ ] **Steg 3.1: Opprett `scripts/update-cloudfront-csp.mjs`**

  ```javascript
  import { readFileSync, writeFileSync } from 'node:fs';
  import { execSync } from 'node:child_process';
  import { join, dirname } from 'node:path';
  import { fileURLToPath } from 'node:url';

  const __dirname = dirname(fileURLToPath(import.meta.url));

  const hashData = JSON.parse(
      readFileSync(join(__dirname, '../src/generated/csp-hashes.json'), 'utf-8')
  );

  const policyId = process.env.CLOUDFRONT_POLICY_ID;
  if (!policyId) {
      console.error('Error: CLOUDFRONT_POLICY_ID environment variable is required');
      process.exit(1);
  }

  const policyResponse = JSON.parse(
      execSync(`aws cloudfront get-response-headers-policy --id ${policyId}`, { encoding: 'utf-8' })
  );
  const etag = policyResponse.ETag;
  const config = policyResponse.ResponseHeadersPolicy.ResponseHeadersPolicyConfig;

  const scriptSrc = hashData.scriptHashes.length > 0
      ? `'self' ${hashData.scriptHashes.map(h => `'${h}'`).join(' ')} https://apis.google.com https://accounts.google.com`
      : `'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com`;

  const items = config.CustomHeadersConfig.Items;
  const cspItem = items.find(item => item.Header === 'Content-Security-Policy');
  if (!cspItem) {
      console.error('Error: Content-Security-Policy header not found in CloudFront policy');
      process.exit(1);
  }

  cspItem.Value = cspItem.Value.replace(/script-src [^;]+/, `script-src ${scriptSrc}`);

  const tmpPath = '/tmp/cfn-policy-update.json';
  writeFileSync(tmpPath, JSON.stringify(config));

  execSync(
      `aws cloudfront update-response-headers-policy --id ${policyId} --if-match ${etag} --response-headers-policy-config file://${tmpPath}`,
      { stdio: 'inherit' }
  );

  const hashCount = hashData.scriptHashes.length;
  console.log(`CloudFront CSP oppdatert: ${hashCount > 0 ? `${hashCount} hash(er)` : "'unsafe-inline' (fallback — kjør build + generate-csp-hashes for å aktivere hashes"}`);
  ```

- [ ] **Steg 3.2: Commit**

  ```bash
  git add scripts/update-cloudfront-csp.mjs
  git commit -m "feat(security): legg til update-cloudfront-csp script (Task 8.3)"
  ```

---

## Task 4: package.json, deploy.yml og lokalt bygg

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Steg 4.1: Legg til nye scripts i `package.json`**

  Legg til to nye scripts i `"scripts"`-blokken i `package.json`:

  ```json
  "generate-csp-hashes": "node scripts/generate-csp-hashes.mjs",
  "dev:secure": "npm run build:ci && npm run generate-csp-hashes && astro dev"
  ```

  Etter endringen ser scripts-blokken slik ut:

  ```json
  "scripts": {
    "dev": "node src/scripts/sync-data.js && astro dev",
    "dev:nosync": "astro dev",
    "dev:lambda": "node scripts/dev-lambda.mjs",
    "dev:secure": "npm run build:ci && npm run generate-csp-hashes && astro dev",
    "sync": "node src/scripts/sync-data.js",
    "build": "node src/scripts/sync-data.js && astro build",
    "build:ci": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest --run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:repeat": "npx playwright test --repeat-each=10",
    "generate-csp-hashes": "node scripts/generate-csp-hashes.mjs",
    "audit:sigs": "npm audit signatures",
    "audit": "npm audit --audit-level=critical"
  }
  ```

- [ ] **Steg 4.2: Kjør `generate-csp-hashes` lokalt og verifiser output**

  ```bash
  npm run build:ci && npm run generate-csp-hashes
  ```

  Forventet output (ca.):
  ```
  Wrote 2 hash(es) to src/generated/csp-hashes.json
    sha256-<base64-hash-1>
    sha256-<base64-hash-2>
  ```

  Verifiser innholdet:
  ```bash
  cat src/generated/csp-hashes.json
  ```

  Forventet: JSON-fil med 2 hashes (layout-helper og print-trigger).

- [ ] **Steg 4.3: Kjør alle tester og verifiser at hash-testene nå passerer med reelle hashes**

  ```bash
  npm test -- --reporter=verbose 2>&1 | grep -E "script-src|✓|×"
  ```

  Alle tester skal være grønne. De to nye testene i Task 2 bruker `vi.doMock` og er isolerte fra innholdet i den faktiske hash-filen.

- [ ] **Steg 4.4: Legg til CloudFront-oppdateringssteg i `deploy.yml`**

  I `.github/workflows/deploy.yml`, finn `deploy`-jobben. Legg til et nytt steg etter `Invalidate CloudFront cache PROD` (linje ~184), men **før** `update-lambda`-jobben:

  ```yaml
        - name: Update CloudFront CSP hashes
          run: node scripts/update-cloudfront-csp.mjs
          env:
            CLOUDFRONT_POLICY_ID: ${{ secrets.CLOUDFRONT_CSP_POLICY_ID }}
  ```

  Steget trenger ingen `checkout` eller `npm ci` siden det allerede er gjort i deploy-jobben — men `deploy`-jobben gjør kun `download-artifact`. Vi trenger `scripts/`-mappen. Legg derfor til en `checkout`-steg FØR `download-artifact` i `deploy`-jobben:

  ```yaml
      - name: Checkout repository
        uses: actions/checkout@v6
  ```

  Full rekkefølge i deploy-jobben etter endringen:
  1. `actions/checkout@v6` ← NY
  2. `actions/download-artifact@v8` (build-output til dist/)
  3. `actions/configure-aws-credentials@v6`
  4. Deploy to S3 PROD-SE
  5. Invalidate CloudFront cache PROD
  6. Update CloudFront CSP hashes ← NY

- [ ] **Steg 4.5: Commit**

  ```bash
  git add package.json .github/workflows/deploy.yml src/generated/csp-hashes.json
  git commit -m "feat(security): koble hash-generering og CloudFront-oppdatering inn i bygg/deploy (Task 8.3)"
  ```

---

## Task 5: Dokumentasjon

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/sikkerhet.md`

- [ ] **Steg 5.1: Oppdater "Lokalt oppsett"-seksjonen i `README.md`**

  Erstatt eksisterende `### Lokalt oppsett`-seksjon med:

  ```markdown
  ### Lokalt oppsett

  For standard utvikling (rask oppstart, `unsafe-inline` i CSP):

      npm run dev

  For å teste med produksjons-lik hash-basert CSP (anbefalt etter Astro-oppgraderinger
  eller endringer i inline-skript):

      npm run dev:secure

  `dev:secure` bygger siden, beregner CSP-hashes fra dist-outputen og starter
  dev-serveren med disse hashene aktive i middleware. Sjekk at det ikke er
  CSP-violations i browser-konsollen på http://localhost:4321/

  Hash-filen (`src/generated/csp-hashes.json`) sjekkes inn og oppdateres
  automatisk av CI ved deploy. Kjør `dev:secure` på nytt etter pull hvis
  hash-filen har endret seg.
  ```

- [ ] **Steg 5.2: Oppdater `docs/architecture/sikkerhet.md`**

  Finn tabellen som beskriver "Hvor headerne settes" og oppdater prod-raden, og legg til en ny seksjon om automatisering etter tabellen:

  I tabellen, endre prod-raden fra `Manuelt kopiert fra SECURITY_HEADERS` til `Automatisk oppdatert via CI (update-cloudfront-csp.mjs)`:

  ```markdown
  | Prod (`tennerogtrivsel.no`) | CloudFront Response Headers Policy | Automatisk oppdatert via CI |
  ```

  Legg til en ny seksjon etter den eksisterende CloudFront-prosedyren:

  ```markdown
  ### Automatisk CSP-oppdatering i CI

  `script-src`-direktivet i CloudFront-policyen oppdateres automatisk ved hver deploy:

  1. `scripts/generate-csp-hashes.mjs` scanner `dist/**/*.html` for inline `<script>`-blokker
  2. Beregner SHA256-hashes og skriver til `src/generated/csp-hashes.json`
  3. `scripts/update-cloudfront-csp.mjs` henter gjeldende policy, patcher `script-src` og oppdaterer

  **Forutsetninger:**
  - GitHub secret `CLOUDFRONT_CSP_POLICY_ID` — ID-en til Response Headers Policy (ikke distribusjons-ID).
    Finn den i AWS Console → CloudFront → Policies → Response headers policies → klikk policy → kopier ID fra URL.
  - Deploy-jobbens IAM-rolle må ha:
    - `cloudfront:GetResponseHeadersPolicy`
    - `cloudfront:UpdateResponseHeadersPolicy`

  **Lokal oppdatering (etter Astro-oppgradering el. endring av inline-skript):**
  ```bash
  npm run build:ci && npm run generate-csp-hashes
  # Commit src/generated/csp-hashes.json
  ```
  ```

- [ ] **Steg 5.3: Kjør tester en siste gang**

  ```bash
  npm test
  ```

  Forventet: alle tester passerer, coverage ≥ 80 %.

- [ ] **Steg 5.4: Commit og push**

  ```bash
  git add README.md docs/architecture/sikkerhet.md
  git commit -m "docs(security): dokumenter hash-basert CSP og dev:secure workflow (Task 8.3)"
  ```

  Push via `/commit`-skillen.

---

## Forutsetninger som må løses manuelt FØR merge

1. **GitHub secret `CLOUDFRONT_CSP_POLICY_ID`** — legg til i GitHub repo secrets.
   Verdi: policy-ID fra AWS Console → CloudFront → Policies → Response headers policies → velg policy → kopier ID.

2. **IAM-tillatelser** — legg til i deploy-jobbens IAM policy:
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "cloudfront:GetResponseHeadersPolicy",
       "cloudfront:UpdateResponseHeadersPolicy"
     ],
     "Resource": "arn:aws:cloudfront::<account-id>:response-headers-policy/<policy-id>"
   }
   ```

3. **Verifiser etter første deploy** — sjekk at `curl -I https://tennerogtrivsel.no/ | grep Content-Security-Policy` ikke inneholder `'unsafe-inline'` i `script-src`.
