# Admin-tilgangskontroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sikre at dashboardet aldri rendres uten bekreftet gyldig Google-token — ved å innføre en loading-spinner, en «Ingen tilgang»-skjerm, og riktig tilstandsstyring i `handleAuth`.

**Architecture:** Fire eksklusive UI-tilstander (login / loading / dashboard / no-access) styres av én ny funksjon `showState()`. `handleAuth` viser spinner → verifiserer med `enforceAccessControl` → viser dashboard eller «ingen tilgang». `updateUIWithUser` snevres inn til kun nav-pill.

**Tech Stack:** Vanilla JS (ESM), Vitest + jsdom, Astro 5 (statisk), Google GIS/GAPI

---

## Filer som endres

| Fil | Rolle |
|-----|-------|
| `src/pages/admin/index.astro` | Legg til `#loading-container` og `#no-access-container` HTML |
| `src/scripts/admin-dashboard.js` | Ny `showState()`, innsnevret `updateUIWithUser`, endret `enforceAccessControl` |
| `src/scripts/admin-init.js` | Ny `handleAuth`-flyt, startup-tilstandsstyring, no-access-knapp |
| `src/scripts/__tests__/admin-dashboard.test.js` | Nye `showState`-tester, oppdaterte `updateUIWithUser`- og `enforceAccessControl`-tester |
| `src/scripts/__tests__/admin-init.test.js` | Oppdatert `setupDOM()`, nye `handleAuth`-integrasjonstester, `showState` i mock |

---

## Task 1: HTML-containere i `admin/index.astro`

Legg til de to nye containerne i HTML. Ingen logikk — dette er ren markup.

**Filer:**
- Modify: `src/pages/admin/index.astro` (etter `#login-container`, ca. linje 123)

- [ ] **Steg 1: Legg til `#loading-container` etter `#login-container`**

  I `src/pages/admin/index.astro`, legg til dette direkte etter den avsluttende `</div>` til `#login-container` (ca. linje 123):

  ```html
  <!-- LOADING CONTAINER -->
  <div id="loading-container" class="hidden admin-login-box my-auto">
      <div class="flex flex-col items-center gap-4">
          <svg class="animate-spin h-10 w-10 text-brand" aria-hidden="true" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-admin-muted text-sm">Verifiserer tilgang...</p>
      </div>
  </div>
  ```

- [ ] **Steg 2: Legg til `#no-access-container` etter `#loading-container`**

  Teksten dekker både ekte ingen-tilgang og nettverksfeil (YAGNI — én generisk melding er tilstrekkelig):

  ```html
  <!-- NO ACCESS CONTAINER -->
  <div id="no-access-container" class="hidden admin-login-box my-auto">
      <div class="space-y-4 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-admin-muted-light"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <h1 class="admin-title">Ingen tilgang</h1>
          <p class="text-admin-muted">Denne kontoen har ikke tilgang til admin-panelet, eller noe gikk galt. Prøv å logge inn med en annen konto.</p>
      </div>
      <button id="no-access-switch-btn" class="btn-primary w-full py-4">
          Logg inn med annen konto
      </button>
  </div>
  ```

- [ ] **Steg 3: Verifiser at siden bygger uten feil**

  ```bash
  npx astro check
  ```
  Forventet: ingen feil.

- [ ] **Steg 4: Commit via `/commit`-skillen**

  Stage `src/pages/admin/index.astro` og bruk `/commit`-skillen.

---

## Task 2: TDD `showState()` i `admin-dashboard.js`

`showState` er en ny eksportert funksjon. TDD-prosessen: test → implementasjon.

**Filer:**
- Test: `src/scripts/__tests__/admin-dashboard.test.js`
- Modify: `src/scripts/admin-dashboard.js`

- [ ] **Steg 1: Legg til `#loading-container`, `#no-access-container` og `#user-pill` i `beforeEach` DOM**

  I `admin-dashboard.test.js`, finn `beforeEach` (ca. linje 80) og legg til disse elementene i `document.body.innerHTML`:

  ```html
  <div id="loading-container" class="hidden"></div>
  <div id="no-access-container" class="hidden"></div>
  <div id="user-pill" style="display:none"></div>
  ```

  Og legg til `showState` i destruktureringen øverst (ca. linje 70):
  ```js
  const { enforceAccessControl, updateUIWithUser, showState, /* ... resten */ } = adminDashboard;
  ```

- [ ] **Steg 2: Skriv failing tester for `showState`**

  Legg til en ny `describe`-blokk i `admin-dashboard.test.js` — plasser den etter `describe('updateBreadcrumbCount', ...)`:

  ```js
  describe('showState', () => {
      // Sett alle fire containere synlige (ingen hidden) for å verifisere at ukjent navn ikke endrer noe
      function setAllVisible() {
          for (const id of ['login-container', 'loading-container', 'dashboard', 'no-access-container']) {
              document.getElementById(id)?.classList.remove('hidden');
          }
      }

      it('should show login-container and hide others, and reset user-pill', () => {
          showState('login');
          expect(document.getElementById('login-container').classList.contains('hidden')).toBe(false);
          expect(document.getElementById('loading-container').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('no-access-container').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('user-pill').style.display).toBe('none');
      });

      it('should show loading-container and hide others', () => {
          showState('loading');
          expect(document.getElementById('loading-container').classList.contains('hidden')).toBe(false);
          expect(document.getElementById('login-container').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('no-access-container').classList.contains('hidden')).toBe(true);
      });

      it('should show dashboard and hide others', () => {
          showState('dashboard');
          expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(false);
          expect(document.getElementById('login-container').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('loading-container').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('no-access-container').classList.contains('hidden')).toBe(true);
      });

      it('should show no-access-container and hide others', () => {
          showState('no-access');
          expect(document.getElementById('no-access-container').classList.contains('hidden')).toBe(false);
          expect(document.getElementById('login-container').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('loading-container').classList.contains('hidden')).toBe(true);
          expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(true);
      });

      it('should do nothing for unknown state name', () => {
          setAllVisible();
          showState('ukjent');
          // Ingen containere skal ha fått hidden-klassen
          expect(document.getElementById('login-container').classList.contains('hidden')).toBe(false);
          expect(document.getElementById('loading-container').classList.contains('hidden')).toBe(false);
          expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(false);
          expect(document.getElementById('no-access-container').classList.contains('hidden')).toBe(false);
      });
  });
  ```

- [ ] **Steg 3: Kjør testene og bekreft at de feiler**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-dashboard.test.js 2>&1 | grep -E "FAIL|showState|TypeError"
  ```
  Forventet: `TypeError: showState is not a function` eller lignende.

- [ ] **Steg 4: Implementer `showState` i `admin-dashboard.js`**

  Legg til rett etter linjene med `export const ICON_EDIT` og `ICON_DELETE` (ca. etter linje 20):

  ```js
  /**
   * Viser én av fire eksklusive UI-tilstander og skjuler de andre.
   * Tilbakestiller user-pill ved overgang til login.
   */
  export function showState(name) {
      const idMap = {
          login: 'login-container',
          loading: 'loading-container',
          dashboard: 'dashboard',
          'no-access': 'no-access-container',
      };
      const target = idMap[name];
      if (!target) return;
      for (const id of Object.values(idMap)) {
          document.getElementById(id)?.classList.toggle('hidden', id !== target);
      }
      if (name === 'login') {
          const pill = document.getElementById('user-pill');
          if (pill) pill.style.display = 'none';
      }
  }
  ```

- [ ] **Steg 5: Kjør testene og bekreft at de passerer**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-dashboard.test.js 2>&1 | grep -E "PASS|FAIL|showState"
  ```
  Forventet: alle `showState`-tester PASS.

- [ ] **Steg 6: Commit**

  Stage `src/scripts/admin-dashboard.js` og `src/scripts/__tests__/admin-dashboard.test.js`, bruk `/commit`-skillen.

---

## Task 3: TDD `enforceAccessControl` — returverdi og fjerning av redirect

`enforceAccessControl` skal returnere `false` (ikke redirecte) ved ingen tilgang.

**Filer:**
- Test: `src/scripts/__tests__/admin-dashboard.test.js` (linje 1735)
- Modify: `src/scripts/admin-dashboard.js` (linje 155–159)

- [ ] **Steg 1: Oppdater den eksisterende "logout and redirect"-testen**

  Erstatt testen på linje 1735 (`should logout and redirect if no access at all`) med to nye tester:

  ```js
  it('should return false and not call logout when no access at all', async () => {
      adminClient.checkMultipleAccess.mockResolvedValue({ 'id': false });
      const result = await enforceAccessControl({ SHEET_ID: 'id' });
      expect(result).toBe(false);
      expect(adminClient.logout).not.toHaveBeenCalled();
  });

  it('should return accessMap (truthy) when at least one resource is accessible', async () => {
      const mockMap = { 's': true };
      adminClient.checkMultipleAccess.mockResolvedValue(mockMap);
      const result = await enforceAccessControl({ SHEET_ID: 's' });
      expect(result).toEqual(mockMap);
  });
  ```

- [ ] **Steg 2: Kjør testen og bekreft at den feiler**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-dashboard.test.js -t "return false and not call logout" 2>&1 | tail -20
  ```
  Forventet: FAIL — `logout` kalles og `result` er ikke `false`.

- [ ] **Steg 3: Implementer endringen i `enforceAccessControl`**

  I `src/scripts/admin-dashboard.js`, erstatt KUN `if`-blokken på linjene 155–159 (ikke `return accessMap` på linje 161 — den beholdes uendret):

  ```js
  // FØR (linjene 155–159, erstatt kun disse):
  if (!hasAnyAccess && ids.length > 0) {
      console.warn("[Admin] Ingen tilgang funnet for noen moduler. Logger ut.");
      logout();
      window.location.href = '/?access_denied=true';
  }
  // (linje 161 — behold som den er:)
  // return accessMap;

  // ETTER (erstatt if-blokken med dette, linje 161 forblir uendret):
  if (!hasAnyAccess && ids.length > 0) {
      console.warn("[Admin] Ingen tilgang funnet for noen moduler.");
      return false;
  }
  ```

  Sjekk om `logout` brukes andre steder i `admin-dashboard.js` — brukes den ikke, fjern den fra `import`-linjen øverst. Kjør `grep "logout" src/scripts/admin-dashboard.js` for å avgjøre dette.

- [ ] **Steg 4: Kjør alle `enforceAccessControl`-tester**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-dashboard.test.js 2>&1 | grep -E "enforceAccessControl|PASS|FAIL"
  ```
  Forventet: alle PASS.

- [ ] **Steg 5: Commit**

  Stage `src/scripts/admin-dashboard.js` og `src/scripts/__tests__/admin-dashboard.test.js`, bruk `/commit`-skillen.

---

## Task 4: TDD `updateUIWithUser` — innsnevret ansvar

`updateUIWithUser` skal slutte å vise/skjule `#login-container` og `#dashboard`.

**Filer:**
- Test: `src/scripts/__tests__/admin-dashboard.test.js` (linje 166–180)
- Modify: `src/scripts/admin-dashboard.js` (linje 167–175)

- [ ] **Steg 1: Oppdater eksisterende `updateUIWithUser`-test**

  Erstatt `describe('updateUIWithUser', ...)` (linje 166–180) med:

  ```js
  describe('updateUIWithUser', () => {
      it('should update nav-pill with user name and title, and not touch containers', () => {
          // Gjør dashboard synlig og login-container skjult FØRST — bevis at updateUIWithUser ikke endrer dette
          document.getElementById('dashboard').classList.remove('hidden');
          document.getElementById('login-container').classList.add('hidden');

          updateUIWithUser({ name: 'Ola Nordmann', email: 'ola@test.no' });

          expect(document.getElementById('nav-user-info').textContent).toBe('Ola');
          expect(document.getElementById('user-pill').title).toBe('Logg ut Ola Nordmann');
          // Containere skal være uendret — showState er eneste som styrer disse
          expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(false);
          expect(document.getElementById('login-container').classList.contains('hidden')).toBe(true);
      });

      it('should use email as fallback and show full email as name', () => {
          updateUIWithUser({ name: '', email: 'ola@test.no' });
          expect(document.getElementById('nav-user-info').textContent).toBe('ola@test.no');
          expect(document.getElementById('user-pill').title).toBe('Logg ut ola@test.no');
      });

      it('should do nothing if user is null', () => {
          expect(() => updateUIWithUser(null)).not.toThrow();
      });
  });
  ```

  Merk: `#login-container` er uten `hidden` og `#dashboard` har `hidden` i `beforeEach` — testen verifiserer at `updateUIWithUser` ikke endrer dette.

- [ ] **Steg 2: Kjør testen og bekreft at den feiler (eller passerer — avhengig av nåværende atferd)**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-dashboard.test.js -t "updateUIWithUser" 2>&1 | tail -20
  ```
  Forventet: testen `should update nav-pill...` feiler fordi nåværende `updateUIWithUser` skjuler `login-container` og viser `dashboard`.

- [ ] **Steg 3: Implementer endringen i `updateUIWithUser`**

  I `src/scripts/admin-dashboard.js` (linje 167–184), fjern disse linjene:

  ```js
  // FJERN DISSE:
  const loginContainer = document.getElementById('login-container');
  const dashboard = document.getElementById('dashboard');
  // ...
  if (loginContainer) loginContainer.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
  ```

  Behold alt relatert til `pill`, `info`, `fullName` og `title`-attributtet.

- [ ] **Steg 4: Kjør testene**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-dashboard.test.js -t "updateUIWithUser" 2>&1 | tail -10
  ```
  Forventet: alle PASS.

- [ ] **Steg 5: Kjør alle dashboard-tester**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-dashboard.test.js 2>&1 | tail -5
  ```
  Forventet: ingen FAIL.

- [ ] **Steg 6: Commit**

  Stage `src/scripts/admin-dashboard.js` og `src/scripts/__tests__/admin-dashboard.test.js`, bruk `/commit`-skillen.

---

## Task 5: TDD `handleAuth` og oppstartflyt i `admin-init.js`

Den viktigste tasken. `handleAuth` skal: vise spinner → verifisere → vise dashboard eller no-access.

**Filer:**
- Test: `src/scripts/__tests__/admin-init.test.js`
- Modify: `src/scripts/admin-init.js`

- [ ] **Steg 1: Oppdater `setupDOM()` i `admin-init.test.js`**

  Legg til de to nye containerne og `#nav-user-info` i `setupDOM()` (etter `<div id="login-container"></div>`, ca. linje 134):

  ```html
  <div id="loading-container" class="hidden"></div>
  <div id="no-access-container" class="hidden"></div>
  <button id="no-access-switch-btn"></button>
  <span id="nav-user-info"></span>
  ```

- [ ] **Steg 2: Legg til `showState` i `admin-dashboard.js`-mocken**

  I `admin-init.test.js`, finn `vi.mock('../admin-dashboard.js', () => ({` (linje 41) og legg til:

  ```js
  showState: vi.fn(),
  ```

  Og legg til i importlisten (linje 121):

  ```js
  import { updateUIWithUser, enforceAccessControl, showState } from '../admin-dashboard.js';
  ```

  **Merk om mock-referanser:** Dette følger nøyaktig samme mønster som eksisterende `enforceAccessControl` og `updateUIWithUser` i denne testfilen — Vitest cacher mock-fabrikkens returverdier og `vi.resetModules()` resetter ikke mock-registeret. `showState.mock.calls` vil peke på det samme `vi.fn()`-objektet som `admin-init.js` bruker. Mønsteret er allerede testet og fungerer i denne kodebasen.

- [ ] **Steg 3: Skriv failing tester for `handleAuth`-flyt**

  Legg til en ny `describe`-blokk i `admin-init.test.js` etter de eksisterende testene:

  ```js
  describe('handleAuth', () => {
      it('should show spinner and not show dashboard while enforceAccessControl is pending', async () => {
          const mockUser = { email: 'test@test.com', name: 'Test' };
          getStoredUser.mockReturnValue(mockUser);
          // enforceAccessControl henger — aldri-resolvende promise
          enforceAccessControl.mockReturnValue(new Promise(() => {}));

          // Ikke await — vi vil sjekke tilstand mens det pågår
          import('../admin-init.js');

          await vi.waitFor(() => {
              expect(showState).toHaveBeenCalledWith('loading');
          });
          expect(document.getElementById('dashboard').classList.contains('hidden')).toBe(true);
      });

      it('should show dashboard when enforceAccessControl returns accessMap', async () => {
          const mockUser = { email: 'test@test.com', name: 'Test' };
          getStoredUser.mockReturnValue(mockUser);
          enforceAccessControl.mockResolvedValue({ 's': true });

          await import('../admin-init.js');

          await vi.waitFor(() => {
              expect(showState).toHaveBeenCalledWith('dashboard');
          });
      });

      it('should show no-access when enforceAccessControl returns false', async () => {
          const mockUser = { email: 'test@test.com', name: 'Test' };
          getStoredUser.mockReturnValue(mockUser);
          enforceAccessControl.mockResolvedValue(false);

          await import('../admin-init.js');

          await vi.waitFor(() => {
              expect(showState).toHaveBeenCalledWith('no-access');
          });
          expect(showState).not.toHaveBeenCalledWith('dashboard');
      });

      it('should show no-access when enforceAccessControl throws', async () => {
          const mockUser = { email: 'test@test.com', name: 'Test' };
          getStoredUser.mockReturnValue(mockUser);
          enforceAccessControl.mockRejectedValue(new Error('network error'));

          await import('../admin-init.js');

          await vi.waitFor(() => {
              expect(showState).toHaveBeenCalledWith('no-access');
          });
      });

      it('should not call logout when enforceAccessControl returns false', async () => {
          const mockUser = { email: 'test@test.com', name: 'Test' };
          getStoredUser.mockReturnValue(mockUser);
          enforceAccessControl.mockResolvedValue(false);

          await import('../admin-init.js');

          await vi.waitFor(() => {
              expect(showState).toHaveBeenCalledWith('no-access');
          });
          expect(logout).not.toHaveBeenCalled();
      });

      it('should skip spinner if dashboard is already visible (mid-session refresh)', async () => {
          const mockUser = { email: 'test@test.com', name: 'Test' };
          getStoredUser.mockReturnValue(mockUser);
          enforceAccessControl.mockResolvedValue({ 's': true });
          // Gjør dashboard synlig
          document.getElementById('dashboard').classList.remove('hidden');

          await import('../admin-init.js');

          await vi.waitFor(() => {
              expect(showState).toHaveBeenCalledWith('dashboard');
          });
          // showState('loading') skal IKKE ha vært kalt
          expect(showState).not.toHaveBeenCalledWith('loading');
      });
  });

  describe('startup flow — ingen token', () => {
      it('should show login state when no stored user and no hadRememberMe', async () => {
          getStoredUser.mockReturnValue(null);
          // Ingen token i localStorage

          await import('../admin-init.js');

          await vi.waitFor(() => {
              expect(showState).toHaveBeenCalledWith('login');
          });
      });

      it('should show spinner and call silentLogin when hadRememberMe', async () => {
          localStorage.setItem('admin_google_token', 'old-token');
          getStoredUser.mockReturnValue(null);

          await import('../admin-init.js');

          await vi.waitFor(() => {
              expect(showState).toHaveBeenCalledWith('loading');
              expect(silentLogin).toHaveBeenCalled();
          });
      });

      it('should call logout and login when no-access-switch-btn is clicked', async () => {
          const mockUser = { email: 'test@test.com', name: 'Test' };
          getStoredUser.mockReturnValue(mockUser);
          enforceAccessControl.mockResolvedValue(false);

          await import('../admin-init.js');
          await vi.waitFor(() => expect(showState).toHaveBeenCalledWith('no-access'));

          document.getElementById('no-access-switch-btn').click();
          expect(logout).toHaveBeenCalled();
          expect(login).toHaveBeenCalled();
      });

      it('should show login when admin-auth-failed fires during silent login', async () => {
          localStorage.setItem('admin_google_token', 'old-token');
          getStoredUser.mockReturnValue(null);

          await import('../admin-init.js');

          await vi.waitFor(() => expect(silentLogin).toHaveBeenCalled());

          // Simuler mislykket stille fornyelse
          window.dispatchEvent(new Event('admin-auth-failed'));

          await vi.waitFor(() => {
              const calls = showState.mock.calls.map(c => c[0]);
              expect(calls).toContain('login');
          });
      });
  });
  ```

- [ ] **Steg 4: Kjør testene og bekreft at de feiler**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-init.test.js -t "handleAuth|startup flow" 2>&1 | grep -E "FAIL|PASS|Error" | head -20
  ```
  Forventet: FAIL — `showState` kalles ikke fra `handleAuth` ennå.

- [ ] **Steg 5: Implementer ny `handleAuth` i `admin-init.js`**

  Erstatt den eksisterende `handleAuth`-funksjonen (linje 78–94) med:

  ```js
  async function handleAuth(userInfo = null) {
      const { SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER, TANNLEGER_FOLDER, BILDER_FOLDER } = getAdminConfig();
      const user = userInfo || getStoredUser();
      if (!user) return;

      const dashboardVisible = !document.getElementById('dashboard')?.classList.contains('hidden');
      if (!dashboardVisible) showState('loading');

      updateUIWithUser(user);

      try {
          const result = await enforceAccessControl({
              SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER, TANNLEGER_FOLDER, BILDER_FOLDER
          });
          if (result === false) {
              showState('no-access');
          } else {
              showState('dashboard');
              loadDashboardCounts({ SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER });
              showInstallPromptIfEligible();
          }
      } catch (err) {
          console.error("[Admin] Feil under tilgangskontroll:", err);
          showState('no-access');
      }
  }
  ```

  Legg til `showState` i importlisten øverst i `admin-init.js`:

  ```js
  import { updateUIWithUser, enforceAccessControl, loadDashboardCounts, showState } from './admin-dashboard.js';
  ```

- [ ] **Steg 6: Implementer ny startup-flyt i `setup()`**

  I `setup()`-funksjonen (linje 96–), erstatt den eksisterende blokken som kjører etter `initGis(handleAuth)`:

  ```js
  // FØR:
  const user = getStoredUser();
  if (user) {
      await handleAuth(user);
  } else if (hadRememberMe) {
      setRememberMe(true);
      silentLogin();
  }

  // ETTER:
  const user = getStoredUser();
  if (user) {
      await handleAuth(user);
  } else if (hadRememberMe) {
      setRememberMe(true);
      showState('loading');
      window.addEventListener('admin-auth-failed', () => showState('login'), { once: true });
      silentLogin();
  } else {
      showState('login');
  }
  ```

- [ ] **Steg 7: Koble `no-access-switch-btn`-handler i `setup()`**

  Legg til ved siden av de andre knapp-handlers (etter `userPill.onclick`, ca. linje 131):

  ```js
  document.getElementById('no-access-switch-btn')?.addEventListener('click', () => {
      logout();
      login();
  });
  ```

- [ ] **Steg 8: Kjør `admin-init`-testene**

  ```bash
  npx vitest --run src/scripts/__tests__/admin-init.test.js 2>&1 | tail -10
  ```
  Forventet: ingen FAIL.

- [ ] **Steg 9: Commit**

  Stage `src/scripts/admin-init.js` og `src/scripts/__tests__/admin-init.test.js`, bruk `/commit`-skillen.

---

## Task 6: Full kvalitetssjekk

- [ ] **Steg 1: Kjør alle tester**

  ```bash
  npm test 2>&1 | tail -30
  ```
  Forventet: alle tester PASS, ingen FAIL.

- [ ] **Steg 2: Sjekk branch coverage for berørte filer**

  Kjør og sjekk at `admin-dashboard.js` og `admin-init.js` opprettholder ≥80% branch coverage:

  ```bash
  npm test 2>&1 | grep -E "admin-dashboard|admin-init"
  ```

- [ ] **Steg 3: Manuell smoke test i nettleser**

  Start dev-serveren og besøk `http://localhost:4321/admin/`:
  ```bash
  npm run dev
  ```
  Verifiser:
  - [ ] Uten token: login-skjema vises
  - [ ] Med ugyldig/utløpt token: login-skjema vises (etter spinner)
  - [ ] «Logg inn med Google» → spinner vises → dashboard (hvis tilgang)
  - [ ] Konto uten Drive-tilgang → «Ingen tilgang»-skjerm med «Logg inn med annen konto»-knapp

- [ ] **Steg 4: Oppdater TODO og commit via `/commit`**

  Bruk `/commit`-skillen for å stage alle ucommittede filer og push.
