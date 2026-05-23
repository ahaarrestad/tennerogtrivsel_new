# GDPR: Rydd opp i CSP frame-src for Google

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjern eller dokumenter unødvendige `frame-src`-tillatelser for Google-domener i CSP. Gjeldende direktiv tillater fire oppføringer; minst én (`https://www.google.com`) ser ut til å ikke ha en tilsvarende bruk i koden.

**Context:**
Gjeldende `frame-src` (etter opprydding i denne PR-en):
```
frame-src https://drive.google.com https://accounts.google.com https://*.googleapis.com
```

- `accounts.google.com` — GSI-biblioteket oppretter skjulte iframes for sign-in-knappen og One Tap-UI. **Nødvendig.**
- `drive.google.com` — GAPI bruker skjulte Drive-iframes ved Drive-operasjoner. **Bekreftet nødvendig.**
- `https://*.googleapis.com` — GAPI relay bruker `content-sheets.googleapis.com` (wildcard nødvendig; `content.googleapis.com` alene er for snevert, bekreftet med browser-test).
- `https://www.google.com` — **fjernet**. Ingen identifisert bruk; eldre GSI-bibliotek brukte dette, nåværende gjør det ikke.

**Alvorlighetsnivå:** Svært lav — unødvendige `frame-src`-tillatelser øker angrepsflatens bredde marginalt.

**Architecture:** Endring i `security-headers.ts` og `scripts/setup-response-headers-policy.mjs`. CI (`update-cloudfront-csp.mjs`) erstatter hele CSP-strengen automatisk ved deploy — ingen manuell CloudFront-sync nødvendig. Full prosedyre i [`docs/architecture/sikkerhet.md`](../architecture/sikkerhet.md).

---

### Task 1: Verifiser hvilke frame-src-oppføringer som faktisk er i bruk ✅

**Fullført i GDPR/CSP-opprydding PR (2026-05-23).**
- Ingen egne iframes i koden; Google-bibliotekene setter dem opp internt.
- `www.google.com` har ingen identifisert bruk med GSI-biblioteket.
- `content-sheets.googleapis.com` bekreftet nødvendig via browser-test (wildcard beholdt).

---

### Task 2: Fjern `www.google.com` fra frame-src og stram inn wildcard ✅

**Fullført i GDPR/CSP-opprydding PR (2026-05-23).**
- `www.google.com` fjernet fra `frame-src` i `security-headers.ts` og `setup-response-headers-policy.mjs`.
- `*.googleapis.com` wildcard beholdt (browser-test viste at `content.googleapis.com` alene blokkerte `content-sheets.googleapis.com`).
- CI erstatter nå hele CSP-strengen automatisk ved deploy — ingen manuell sync nødvendig.

---

### Task 3: Manuell verifisering av admin-login

**Merk:** Dette steget krever manuell handling av bruker.

- [ ] **Steg 3.1: Test admin-login med ny CSP**

  Start dev-server og åpne admin-siden. Sjekk nettleserens konsoll for CSP-brudd:

  ```bash
  npm run dev
  ```

  Gå til `http://localhost:4321/admin/` og logg inn med Google-kontoen. Se etter CSP-feil i konsollen.

  - Feil relatert til `drive.google.com`: behold oppføringen — GAPI bruker Drive-iframes
  - Feil relatert til `content.googleapis.com`: legg tilbake `*.googleapis.com` og noter det
  - Ingen feil: endringen (`www.google.com` fjernet, wildcard snevret) fungerer. `drive.google.com` er fortsatt i CSP, men det er ikke bevist nødvendig — for å teste: fjern den midlertidig og last admin på nytt. Ingen ny feil → fjern den i Task 3.2.

- [ ] **Steg 3.2: Juster frame-src basert på testresultat og dokumenter årsak**

  Basert på funnene i Steg 3.1: fjern oppføringer som ikke utløste feil, behold de som er nødvendige.

  Legg til én kommentar over `frame-src`-linjen som forklarer nøyaktig de oppføringene som faktisk er med etter testingen — ingen placeholder-tekst:

  Eksempel hvis `drive.google.com` viste seg unødvendig:
  ```ts
  // accounts.google.com: GSI sign-in button/One Tap UI — skjulte iframes
  // content.googleapis.com: GAPI cross-origin relay (apis.google.com/js/api.js)
  "frame-src https://accounts.google.com https://content.googleapis.com",
  ```

  Eksempel hvis `drive.google.com` var nødvendig (CSP-feil uten den):
  ```ts
  // accounts.google.com: GSI sign-in button/One Tap UI — skjulte iframes
  // content.googleapis.com: GAPI cross-origin relay (apis.google.com/js/api.js)
  // drive.google.com: GAPI intern iframe ved Drive-operasjoner
  "frame-src https://drive.google.com https://accounts.google.com https://content.googleapis.com",
  ```

---

### Task 4: Commit og CloudFront-sync

- [ ] **Steg 4.1: Commit endringen**

  Bruk `/commit`-skillen. Foreslått melding:
  `fix(csp): fjern www.google.com og stram inn googleapis wildcard i frame-src`

- [ ] **Steg 4.2: Verifiser at CloudFront-deploy er vellykket**

  **Merk:** CI (`update-cloudfront-csp.mjs`) erstatter nå hele CSP-strengen automatisk ved deploy — ingen manuell CloudFront-sync nødvendig. Begge distribusjoner (`test2.aarrestad.com` og `tennerogtrivsel.no`) bruker samme policy (`tot-security-headers`) og oppdateres simultant.

  Etter deploy: verifiser TEST:
  ```bash
  curl -I https://test2.aarrestad.com/ | grep -i "content-security-policy"
  ```
  Test admin-login på `https://test2.aarrestad.com/admin/` — ingen CSP-violations i konsoll.

  Verifiser PROD:
  ```bash
  curl -I https://tennerogtrivsel.no/ | grep -i "content-security-policy"
  ```

  Rollback (ved CSP-violations): kjør `node scripts/setup-response-headers-policy.mjs` med forrige versjon av CSP-strengen.
