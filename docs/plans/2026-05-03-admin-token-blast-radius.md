# Admin Token Blast Radius — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flytte OAuth-token fra `localStorage` til `sessionStorage` for å redusere XSS-blast-radius, korte ned expiry-margin, og hindre indeksering av admin-siden i prod via CloudFront Function.

**Architecture:** Token lagres alltid i `sessionStorage` (lever kun i aktiv fane). Et boolsk flagg `admin_remember_me` i `localStorage` styrer om `silentLogin()` kjøres ved neste cold start. Middleware og en CloudFront Function legger til `X-Robots-Tag: noindex` på `/admin`-paths.

**Tech Stack:** Vanilla JS (admin-auth.js), TypeScript (middleware.ts), Vitest (tester), AWS CLI (CloudFront Function).

**Spec:** `docs/superpowers/specs/2026-05-03-admin-token-blast-radius-design.md`

---

## Filer som endres

| Fil | Hva |
|-----|-----|
| `src/scripts/admin-auth.js` | Ny storage-logikk: token → sessionStorage, rememberMe → flagg |
| `src/scripts/admin-init.js:122` | `hadRememberMe`-sjekk: bytt nøkkel |
| `src/scripts/__tests__/admin-client.test.js` | Oppdater/legg til tester for ny storage-logikk |
| `src/scripts/__tests__/admin-init.test.js` | Oppdater 3 tester for ny nøkkel |
| `src/middleware.ts` | Legg til X-Robots-Tag på /admin-paths |
| `src/__tests__/middleware.test.ts` | Ny describe-blokk for X-Robots-Tag |
| `scripts/setup-admin-cloudfront-function.mjs` | Ny fil: one-shot CloudFront Function setup |
| `docs/architecture/sikkerhet.md` | Oppdater akseptert risiko-tabell |

---

## Task 1: Oppdater tester for admin-auth.js (TDD — skriv testene først)

**Filer:**
- Modify: `src/scripts/__tests__/admin-client.test.js`

Testene under endrer eksisterende cases som reflekterer gammel oppførsel og legger til nye cases. Alle endringer er i denne filen.

- [ ] **Steg 1.1: Erstatt `login()-flyt med setRememberMe`-describe-blokken (linje ~1040–1055)**

  Finn og erstatt hele `describe('login()-flyt med setRememberMe', ...)` (linje ca. 1040–1055):

  ```js
  describe('login()-flyt med setRememberMe', () => {
      it('login() lagrer alltid token i sessionStorage, aldri i localStorage', async () => {
          setRememberMe(false);
          initGis(() => {});
          login();
          await vi.waitFor(() => expect(sessionStorage.getItem('admin_google_token')).not.toBeNull());
          expect(localStorage.getItem('admin_google_token')).toBeNull();
      });

      it('login() med rememberMe=true lagrer token i sessionStorage og setter admin_remember_me-flagg', async () => {
          setRememberMe(true);
          initGis(() => {});
          login();
          await vi.waitFor(() => expect(sessionStorage.getItem('admin_google_token')).not.toBeNull());
          expect(localStorage.getItem('admin_google_token')).toBeNull();
          expect(localStorage.getItem('admin_remember_me')).toBe('1');
      });
  });
  ```

- [ ] **Steg 1.2: Erstatt `setRememberMe og lagringsstrategi`-describe-blokken (linje ~1058–1104)**

  Finn og erstatt hele `describe('setRememberMe og lagringsstrategi', ...)`:

  ```js
  describe('setRememberMe og lagringsstrategi', () => {
      it('setRememberMe(true) → token i sessionStorage, admin_remember_me=1 i localStorage', async () => {
          setRememberMe(true);
          initGis(() => {});
          const callback = google.accounts.oauth2.initTokenClient.mock.calls[0][0].callback;
          await callback({ access_token: 'tok', expires_in: 3600 });
          expect(sessionStorage.getItem('admin_google_token')).not.toBeNull();
          expect(localStorage.getItem('admin_google_token')).toBeNull();
          expect(localStorage.getItem('admin_remember_me')).toBe('1');
      });

      it('setRememberMe(false) → token i sessionStorage, admin_remember_me fjernet fra localStorage', async () => {
          setRememberMe(false);
          localStorage.setItem('admin_remember_me', '1');
          initGis(() => {});
          const callback = google.accounts.oauth2.initTokenClient.mock.calls[0][0].callback;
          await callback({ access_token: 'tok', expires_in: 3600 });
          expect(sessionStorage.getItem('admin_google_token')).not.toBeNull();
          expect(localStorage.getItem('admin_google_token')).toBeNull();
          expect(localStorage.getItem('admin_remember_me')).toBeNull();
      });

      it('getStoredUser finner gyldig token i sessionStorage', () => {
          const future = Date.now() + 3600000;
          const mockUser = { name: 'Kari' };
          sessionStorage.setItem('admin_google_token', JSON.stringify({ expiry: future, user: mockUser }));
          expect(getStoredUser()).toEqual(mockUser);
      });

      it('getStoredUser returnerer null når token kun ligger i localStorage', () => {
          const future = Date.now() + 3600000;
          localStorage.setItem('admin_google_token', JSON.stringify({ expiry: future, user: { name: 'X' } }));
          expect(getStoredUser()).toBeNull();
      });

      it('tryRestoreSession gjenoppretter sesjon fra sessionStorage', async () => {
          await initGapi();
          const future = Date.now() + 3600000;
          sessionStorage.setItem('admin_google_token', JSON.stringify({
              access_token: 'ses-token',
              expiry: future
          }));
          expect(tryRestoreSession()).toBe(true);
          expect(gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'ses-token' });
      });

      it('tryRestoreSession returnerer false når token kun er i localStorage', async () => {
          await initGapi();
          const future = Date.now() + 3600000;
          localStorage.setItem('admin_google_token', JSON.stringify({
              access_token: 'local-token',
              expiry: future
          }));
          expect(tryRestoreSession()).toBe(false);
      });

      it('logout fjerner token fra begge storages og admin_remember_me-flagget', () => {
          localStorage.setItem('admin_google_token', 'lokal');
          sessionStorage.setItem('admin_google_token', 'sesjon');
          localStorage.setItem('admin_remember_me', '1');
          logout();
          expect(localStorage.getItem('admin_google_token')).toBeNull();
          expect(sessionStorage.getItem('admin_google_token')).toBeNull();
          expect(localStorage.getItem('admin_remember_me')).toBeNull();
      });
  });
  ```

- [ ] **Steg 1.3: Oppdater `getStoredUser`-describe-blokken (linje ~271–285)**

  Finn og erstatt `describe('getStoredUser', ...)`:

  ```js
  describe('getStoredUser', () => {
      it('skal returnere null hvis ingenting er lagret', () => {
          expect(getStoredUser()).toBeNull();
      });

      it('skal returnere brukerinfo hvis gyldig sesjon finnes i sessionStorage', () => {
          const future = Date.now() + 3600000;
          const mockUser = { name: 'Ola' };
          sessionStorage.setItem('admin_google_token', JSON.stringify({
              expiry: future,
              user: mockUser
          }));
          expect(getStoredUser()).toEqual(mockUser);
      });

      it('returnerer null for token som utløper om 4 min (< 5 min margin)', () => {
          sessionStorage.setItem('admin_google_token', JSON.stringify({
              expiry: Date.now() + 240000,
              user: { name: 'X' }
          }));
          expect(getStoredUser()).toBeNull();
      });

      it('returnerer bruker for token som utløper om 6 min (> 5 min margin)', () => {
          const mockUser = { name: 'X' };
          sessionStorage.setItem('admin_google_token', JSON.stringify({
              expiry: Date.now() + 360000,
              user: mockUser
          }));
          expect(getStoredUser()).toEqual(mockUser);
      });
  });
  ```

- [ ] **Steg 1.4: Oppdater `Session Management`-describe-blokken (linje ~306–355)**

  Finn og erstatt `describe('Session Management', ...)`:

  ```js
  describe('Session Management', () => {
      it('tryRestoreSession skal returnere false hvis ingenting er lagret', () => {
          expect(tryRestoreSession()).toBe(false);
      });

      it('tryRestoreSession skal sette token i GAPI fra sessionStorage', async () => {
          await initGapi();
          const future = Date.now() + 3600000;
          sessionStorage.setItem('admin_google_token', JSON.stringify({
              access_token: 'ses-token',
              expiry: future
          }));
          expect(tryRestoreSession()).toBe(true);
          expect(gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'ses-token' });
      });

      it('tryRestoreSession skal fjerne utløpt token i sessionStorage og returnere false', async () => {
          await initGapi();
          const past = Date.now() - 1000;
          sessionStorage.setItem('admin_google_token', JSON.stringify({
              access_token: 'old-token',
              expiry: past
          }));
          expect(tryRestoreSession()).toBe(false);
          expect(sessionStorage.getItem('admin_google_token')).toBeNull();
      });

      it('tryRestoreSession skal returnere false og BEVARE token hvis gapi.client ikke er klar', async () => {
          const future = Date.now() + 3600000;
          sessionStorage.setItem('admin_google_token', JSON.stringify({
              access_token: 'ses-token',
              expiry: future
          }));
          vi.stubGlobal('gapi', { client: null });
          expect(tryRestoreSession()).toBe(false);
          expect(sessionStorage.getItem('admin_google_token')).not.toBeNull();
      });

      it('logout skal fjerne token og admin_remember_me-flagget', () => {
          localStorage.setItem('admin_google_token', 'lokal');
          sessionStorage.setItem('admin_google_token', 'sesjon');
          localStorage.setItem('admin_remember_me', '1');
          logout();
          expect(google.accounts.oauth2.revoke).toHaveBeenCalled();
          expect(localStorage.getItem('admin_google_token')).toBeNull();
          expect(sessionStorage.getItem('admin_google_token')).toBeNull();
          expect(localStorage.getItem('admin_remember_me')).toBeNull();
      });
  });
  ```

- [ ] **Steg 1.5: Oppdater `getStoredUser skal håndtere korrupt JSON`-testen (linje ~507–510)**

  Finn testen:
  ```js
  it('getStoredUser skal håndtere korrupt JSON', () => {
      localStorage.setItem('admin_google_token', 'ikke-json');
  ```
  Endre `localStorage` til `sessionStorage`:
  ```js
  it('getStoredUser skal håndtere korrupt JSON', () => {
      sessionStorage.setItem('admin_google_token', 'ikke-json');
      expect(getStoredUser()).toBeNull();
      expect(sessionStorage.getItem('admin_google_token')).toBeNull();
  });
  ```

- [ ] **Steg 1.6: Oppdater `tryRestoreSession skal håndtere korrupt JSON`-testen (linje ~538–541)**

  Finn testen:
  ```js
  it('tryRestoreSession skal håndtere korrupt JSON', async () => {
  ```
  Oppdater til:
  ```js
  it('tryRestoreSession skal håndtere korrupt JSON', async () => {
      await initGapi();
      sessionStorage.setItem('admin_google_token', 'ikke-json');
      expect(tryRestoreSession()).toBe(false);
  });
  ```

- [ ] **Steg 1.7: Kjør testene — forvent FAIL**

  ```bash
  npx vitest run src/scripts/__tests__/admin-client.test.js
  ```

  Forventet: Mange feil om at token ikke finnes i forventet storage. Det er korrekt — implementasjonen er ikke endret ennå.

---

## Task 2: Implementer ny storage-logikk i admin-auth.js

**Filer:**
- Modify: `src/scripts/admin-auth.js`

- [ ] **Steg 2.1: Erstatt `initGis`-callback sin storage-logikk (linje ~94–103)**

  Finn:
  ```js
  const expiry = Date.now() + (resp.expires_in * 1000);
  const storage    = _rememberMe ? localStorage  : sessionStorage;
  const otherStore = _rememberMe ? sessionStorage : localStorage;
  storage.setItem('admin_google_token', JSON.stringify({
      access_token: resp.access_token,
      expiry: expiry,
      user: userInfo
  }));
  otherStore.removeItem('admin_google_token');
  ```
  Erstatt med:
  ```js
  const expiry = Date.now() + (resp.expires_in * 1000);
  sessionStorage.setItem('admin_google_token', JSON.stringify({
      access_token: resp.access_token,
      expiry: expiry,
      user: userInfo
  }));
  localStorage.removeItem('admin_google_token');
  if (_rememberMe) {
      localStorage.setItem('admin_remember_me', '1');
  } else {
      localStorage.removeItem('admin_remember_me');
  }
  ```

- [ ] **Steg 2.2: Erstatt `getStoredUser`-funksjonen (linje ~113–132)**

  Finn og erstatt hele `getStoredUser`:
  ```js
  export function getStoredUser() {
      const stored = sessionStorage.getItem('admin_google_token');
      if (!stored) return null;
      try {
          const { expiry, user } = JSON.parse(stored);
          if (Date.now() < expiry - 300000) {
              _rememberMe = !!localStorage.getItem('admin_remember_me');
              return user;
          }
      } catch { /* fall through */ }
      sessionStorage.removeItem('admin_google_token');
      return null;
  }
  ```

- [ ] **Steg 2.3: Erstatt `tryRestoreSession`-funksjonen (linje ~134–160)**

  Finn og erstatt hele `tryRestoreSession`:
  ```js
  export function tryRestoreSession() {
      const stored = sessionStorage.getItem('admin_google_token');
      if (!stored) return false;
      try {
          const { access_token, expiry } = JSON.parse(stored);
          if (Date.now() < expiry - 300000) {
              if (!gapi.client) {
                  console.warn("[Admin] gapi.client ikke klar for setToken");
                  return false;
              }
              _rememberMe = !!localStorage.getItem('admin_remember_me');
              console.log("[Admin] Gjenoppretter sesjon i GAPI (rememberMe=%s)", _rememberMe);
              gapi.client.setToken({ access_token });
              return true;
          }
      } catch (e) {
          console.error("[Admin] Feil ved lesing av lagret sesjon:", e);
      }
      sessionStorage.removeItem('admin_google_token');
      return false;
  }
  ```

- [ ] **Steg 2.4: Oppdater `logout`-funksjonen (linje ~209–219)**

  Finn:
  ```js
  localStorage.removeItem('admin_google_token');
  sessionStorage.removeItem('admin_google_token');
  ```
  Erstatt med:
  ```js
  localStorage.removeItem('admin_google_token');
  localStorage.removeItem('admin_remember_me');
  sessionStorage.removeItem('admin_google_token');
  ```

- [ ] **Steg 2.5: Kjør tester — forvent PASS**

  ```bash
  npx vitest run src/scripts/__tests__/admin-client.test.js
  ```

  Forventet: Alle tester grønne.

---

## Task 3: Oppdater admin-init.js og dens tester

**Filer:**
- Modify: `src/scripts/admin-init.js:122`
- Modify: `src/scripts/__tests__/admin-init.test.js`

- [ ] **Steg 3.1: Skriv failing test i admin-init.test.js**

  Finn alle steder i `admin-init.test.js` som bruker `localStorage.setItem('admin_google_token', ...)` som proxy for `hadRememberMe` (ca. linje 224, 712, 737). For hvert treff: endre til `localStorage.setItem('admin_remember_me', '1')`.

  Eksempel — finn:
  ```js
  localStorage.setItem('admin_google_token', 'old-token');
  ```
  Erstatt med:
  ```js
  localStorage.setItem('admin_remember_me', '1');
  ```

  Det er tre slike steder. Endre alle tre.

- [ ] **Steg 3.2: Kjør admin-init-testene — forvent FAIL**

  ```bash
  npx vitest run src/scripts/__tests__/admin-init.test.js
  ```

  Forventet: Feil fordi `admin-init.js` fortsatt sjekker `admin_google_token`.

- [ ] **Steg 3.3: Oppdater admin-init.js linje 122**

  Finn:
  ```js
  const hadRememberMe = !!localStorage.getItem('admin_google_token');
  ```
  Erstatt med:
  ```js
  const hadRememberMe = !!localStorage.getItem('admin_remember_me');
  ```

- [ ] **Steg 3.4: Kjør begge testfiler — forvent PASS**

  ```bash
  npx vitest run src/scripts/__tests__/admin-client.test.js src/scripts/__tests__/admin-init.test.js
  ```

  Forventet: Alle grønne.

- [ ] **Steg 3.5: Commit**

  ```bash
  git add src/scripts/admin-auth.js src/scripts/admin-init.js \
          src/scripts/__tests__/admin-client.test.js \
          src/scripts/__tests__/admin-init.test.js
  git commit -m "fix(security): flytt OAuth-token til sessionStorage, rememberMe til flagg (Task 7.1+7.2)"
  ```

---

## Task 4: Legg til X-Robots-Tag i middleware (TDD)

**Filer:**
- Modify: `src/__tests__/middleware.test.ts`
- Modify: `src/middleware.ts`

- [ ] **Steg 4.1: Legg til failing test i middleware.test.ts**

  Legg til ny `describe`-blokk helt på slutten av filen (etter linje 176, men før den siste `}`):

  ```ts
  describe('src/middleware.ts – X-Robots-Tag', () => {
      it('setter X-Robots-Tag: noindex på /admin-paths', async () => {
          const handler = await importMiddleware();
          const response = await handler(
              { url: new URL('https://example.com/admin') },
              makeNext()
          );
          expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
      });

      it('setter X-Robots-Tag: noindex på /admin/subpath', async () => {
          const handler = await importMiddleware();
          const response = await handler(
              { url: new URL('https://example.com/admin/settings') },
              makeNext()
          );
          expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
      });

      it('setter IKKE X-Robots-Tag på andre paths', async () => {
          const handler = await importMiddleware();
          const response = await handler(
              { url: new URL('https://example.com/') },
              makeNext()
          );
          expect(response.headers.get('X-Robots-Tag')).toBeNull();
      });

      it('setter IKKE X-Robots-Tag når context.url mangler (bakoverkompatibelt)', async () => {
          const handler = await importMiddleware();
          const response = await handler({}, makeNext());
          expect(response.headers.get('X-Robots-Tag')).toBeNull();
      });
  });
  ```

- [ ] **Steg 4.2: Kjør testen — forvent FAIL**

  ```bash
  npx vitest run src/__tests__/middleware.test.ts
  ```

  Forventet: `X-Robots-Tag`-testene feiler fordi middleware ikke setter den ennå.

- [ ] **Steg 4.3: Oppdater middleware.ts**

  Finn og erstatt hele filen:

  ```ts
  import { defineMiddleware } from 'astro:middleware';
  import { SECURITY_HEADERS } from './utils/security-headers';

  export const onRequest = defineMiddleware((context, next) => {
      return next().then((response) => {
          for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
              response.headers.set(name, value);
          }
          if (context.url?.pathname?.startsWith('/admin')) {
              response.headers.set('X-Robots-Tag', 'noindex');
          }
          return response;
      });
  });
  ```

- [ ] **Steg 4.4: Kjør middleware-tester — forvent PASS**

  ```bash
  npx vitest run src/__tests__/middleware.test.ts
  ```

  Forventet: Alle grønne, inkl. de nye X-Robots-Tag-testene.

- [ ] **Steg 4.5: Commit**

  ```bash
  git add src/middleware.ts src/__tests__/middleware.test.ts
  git commit -m "fix(security): legg til X-Robots-Tag: noindex på /admin-paths i middleware (Task 7.3)"
  ```

---

## Task 5: Oppdater sikkerhet.md

**Filer:**
- Modify: `docs/architecture/sikkerhet.md`

- [ ] **Steg 5.1: Oppdater akseptert risiko-tabellen**

  Finn raden:
  ```
  | Token i localStorage (M5) | Ingen HTTPOnly-alternativ for klient-side OAuth. Mitigert av token-expiry og CSP. |
  ```
  Erstatt med:
  ```
  | Token i sessionStorage (M5) | Ingen HTTPOnly-alternativ for klient-side OAuth. Token er nå i sessionStorage (dør med fanen) — `localStorage` beholder kun et boolsk `admin_remember_me`-flagg som er verdiløst for angriper. Mitigert av token-expiry (5 min margin) og CSP. |
  ```

- [ ] **Steg 5.2: Legg til ny seksjon om token-lifecycle**

  Legg til ny seksjon etter `## Silent login debounce`:

  ```markdown
  ## X-Robots-Tag: noindex på /admin

  Admin-siden hindres fra indeksering på tre nivåer:
  1. `<meta name="robots" content="noindex, nofollow">` i HTML (dekker alle crawlere)
  2. `robots.txt Disallow: /admin` (advisory)
  3. `X-Robots-Tag: noindex` HTTP-header satt av:
     - **Dev:** Astro middleware (`src/middleware.ts`) på paths som starter med `/admin`
     - **Prod:** CloudFront Function `tot-admin-noindex` (viewer-response trigger) koblet til default behavior

  CloudFront Function settes opp én gang med `scripts/setup-admin-cloudfront-function.mjs`.

  ## OAuth-token storage og rememberMe-logikk

  OAuth-access-token lagres alltid i `sessionStorage` — aldri i `localStorage`. Token lever kun så lenge fanen er åpen.

  `localStorage` bruker kun ett nøkkel: `admin_remember_me = '1'` (boolsk flagg). Flagget settes ved innlogging med "Husk meg" avkrysset, og fjernes ved utlogging eller når "Husk meg" er unchecked.

  **Cold start-logikk i `admin-init.js`:**
  - Finnes `admin_remember_me`-flagget og `sessionStorage`-token mangler → kjør `silentLogin()` (usynlig GIS-flyt med `prompt: 'none'`)
  - Lykkes silent login → innlogget uten popup
  - Feiler silent login (Google-sesjon utløpt) → vis login-skjerm

  **Expiry-margin:** `getStoredUser()` og `tryRestoreSession()` regner token som utløpt 5 min *før* Google-expiry (`Date.now() < expiry - 300000`). Dette reduserer vinduet for et stjålet token.
  ```

- [ ] **Steg 5.3: Commit**

  ```bash
  git add docs/architecture/sikkerhet.md
  git commit -m "docs(security): oppdater sikkerhet.md med ny token-storage-logikk (Task 7)"
  ```

---

## Task 6: CloudFront Function setup-script

**Filer:**
- Create: `scripts/setup-admin-cloudfront-function.mjs`

- [ ] **Steg 6.1: Opprett scriptet**

  Opprett `scripts/setup-admin-cloudfront-function.mjs`:

  ```js
  #!/usr/bin/env node
  // One-shot script: oppretter CloudFront Function som setter X-Robots-Tag: noindex på /admin-paths
  // og kobler den til distribusjonen sin default behavior (viewer-response).
  // Idempotent: trygt å kjøre flere ganger.
  //
  // Bruk: CLOUDFRONT_DISTRIBUTION_ID=<id> node scripts/setup-admin-cloudfront-function.mjs

  import { execSync } from 'node:child_process';
  import { writeFileSync, unlinkSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';

  const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  if (!DISTRIBUTION_ID) {
      console.error('Feil: CLOUDFRONT_DISTRIBUTION_ID miljøvariabel mangler.');
      console.error('Bruk: CLOUDFRONT_DISTRIBUTION_ID=<id> node scripts/setup-admin-cloudfront-function.mjs');
      process.exit(1);
  }

  const FUNCTION_NAME = 'tot-admin-noindex';
  const FUNCTION_CODE = `function handler(event) {
      var response = event.response;
      var request = event.request;
      if (request.uri.startsWith('/admin')) {
          response.headers['x-robots-tag'] = { value: 'noindex' };
      }
      return response;
  }`;

  function run(cmd) {
      return JSON.parse(execSync(cmd, { encoding: 'utf-8' }));
  }

  // Steg 1: Sjekk om funksjonen allerede finnes (DEVELOPMENT-stage)
  console.log(`Sjekker om ${FUNCTION_NAME} allerede finnes...`);
  let functionArn;
  const listResult = run('aws cloudfront list-functions');
  const existing = listResult.FunctionList?.Items?.find(f => f.Name === FUNCTION_NAME);

  if (existing) {
      functionArn = existing.FunctionMetadata.FunctionARN;
      console.log(`Funksjon finnes allerede: ${functionArn}`);
  } else {
      // Steg 2: Opprett funksjonen
      console.log('Oppretter ny CloudFront Function...');
      const codeFile = join(tmpdir(), 'tot-admin-fn.js');
      writeFileSync(codeFile, FUNCTION_CODE, 'utf-8');

      const configFile = join(tmpdir(), 'tot-admin-fn-config.json');
      writeFileSync(configFile, JSON.stringify({
          Comment: 'X-Robots-Tag noindex for /admin paths',
          Runtime: 'cloudfront-js-2.0'
      }), 'utf-8');

      const createResult = run(
          `aws cloudfront create-function` +
          ` --name ${FUNCTION_NAME}` +
          ` --function-config file://${configFile}` +
          ` --function-code fileb://${codeFile}`
      );
      const devEtag = createResult.ETag;
      unlinkSync(codeFile);
      unlinkSync(configFile);

      // Steg 3: Publiser funksjonen (DEVELOPMENT → LIVE)
      console.log('Publiserer funksjonen...');
      const publishResult = run(
          `aws cloudfront publish-function --name ${FUNCTION_NAME} --if-match ${devEtag}`
      );
      functionArn = publishResult.FunctionSummary.FunctionMetadata.FunctionARN;
      console.log(`Funksjon publisert: ${functionArn}`);
  }

  // Steg 4: Hent gjeldende distribusjonskonfig
  console.log(`Henter distribusjonskonfig for ${DISTRIBUTION_ID}...`);
  const distResult = run(`aws cloudfront get-distribution-config --id ${DISTRIBUTION_ID}`);
  const etag = distResult.ETag;
  const config = distResult.DistributionConfig;

  // Steg 5: Sjekk om funksjon allerede er koblet til
  const fa = config.DefaultCacheBehavior.FunctionAssociations;
  const alreadyAssociated = fa?.Items?.some(
      f => f.FunctionARN === functionArn && f.EventType === 'viewer-response'
  );

  if (alreadyAssociated) {
      console.log('Funksjon er allerede koblet til distribusjonen. Ingen endring nødvendig.');
      process.exit(0);
  }

  // Steg 6: Legg til FunctionAssociation
  if (!config.DefaultCacheBehavior.FunctionAssociations) {
      config.DefaultCacheBehavior.FunctionAssociations = { Quantity: 0, Items: [] };
  }
  config.DefaultCacheBehavior.FunctionAssociations.Items.push({
      FunctionARN: functionArn,
      EventType: 'viewer-response'
  });
  config.DefaultCacheBehavior.FunctionAssociations.Quantity =
      config.DefaultCacheBehavior.FunctionAssociations.Items.length;

  // Steg 7: Oppdater distribusjonen
  const configFile = join(tmpdir(), 'cf-dist-config.json');
  writeFileSync(configFile, JSON.stringify(config), 'utf-8');
  console.log('Oppdaterer CloudFront-distribusjon...');
  execSync(
      `aws cloudfront update-distribution` +
      ` --id ${DISTRIBUTION_ID}` +
      ` --if-match ${etag}` +
      ` --distribution-config file://${configFile}`,
      { stdio: 'inherit' }
  );
  unlinkSync(configFile);
  console.log('Ferdig! CloudFront deployer endringen (typisk 5–15 min).');
  console.log(`Verifiser med: curl -sI https://tennerogtrivsel.no/admin | grep x-robots-tag`);
  ```

- [ ] **Steg 6.2: Kjør quality gate**

  ```bash
  npx vitest run
  ```

  Forventet: Alle tester grønne.

- [ ] **Steg 6.3: Commit**

  ```bash
  git add scripts/setup-admin-cloudfront-function.mjs
  git commit -m "feat(security): legg til CloudFront Function setup-script for X-Robots-Tag på /admin (Task 7.3)"
  ```

- [ ] **Steg 6.4: Kjør scriptet mot prod**

  ```bash
  CLOUDFRONT_DISTRIBUTION_ID=<CLOUDFRONT_DISTRIBUTION_ID_PROD-verdien> \
    node scripts/setup-admin-cloudfront-function.mjs
  ```

  Vent 5–15 min, verifiser:
  ```bash
  curl -sI https://tennerogtrivsel.no/admin | grep -i x-robots-tag
  # Forventet: x-robots-tag: noindex
  curl -sI https://tennerogtrivsel.no/ | grep -i x-robots-tag
  # Forventet: ingen output (headeren skal ikke settes på /)
  ```

---

## Task 7: Full kvalitetsgate

- [ ] **Steg 7.1: Kjør alle tester**

  ```bash
  npx vitest run
  ```

  Forventet: Alle grønne.

- [ ] **Steg 7.2: Sjekk coverage på endrede filer**

  ```bash
  npx vitest run --coverage --coverage.include='src/scripts/admin-auth.js' --coverage.include='src/middleware.ts'
  ```

  Forventet: ≥ 80 % branch coverage per fil.
