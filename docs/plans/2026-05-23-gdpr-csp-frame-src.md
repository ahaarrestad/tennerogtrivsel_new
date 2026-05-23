# GDPR: Rydd opp i CSP frame-src for Google

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjern eller dokumenter unødvendige `frame-src`-tillatelser for Google-domener i CSP. Gjeldende direktiv tillater fire oppføringer; minst én (`https://www.google.com`) ser ut til å ikke ha en tilsvarende bruk i koden.

**Context:**
Gjeldende `frame-src` i `src/utils/security-headers.ts` linje 13:
```
frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com
```

- `accounts.google.com` — brukes av GSI-biblioteket (`accounts.google.com/gsi/client`) som oppretter skjulte iframes for sign-in-knappen og One Tap-UI. **Nødvendig.**
- `drive.google.com` — admin bruker `gapi.client.drive` via `apis.google.com/js/api.js`. GAPI-biblioteket kan opprette skjulte iframes mot Drive. Krever verifisering.
- `https://www.google.com` — ingen bruk av `www.google.com`-frames er identifisert i koden. Eldre Google Sign-In brukte dette; GSI gjør det ikke. **Sannsynligvis unødvendig.**
- `https://*.googleapis.com` — GAPI-biblioteket bruker `content.googleapis.com` internt for cross-origin kommunikasjon. Krever verifisering om hele wildcard-domenet er nødvendig.

**Alvorlighetsnivå:** Svært lav — unødvendige `frame-src`-tillatelser øker angrepsflatens bredde marginalt.

**Architecture:** Endring i én fil (`security-headers.ts`). `frame-src` må manuelt synkroniseres til CloudFront Response Headers Policy etter commit — `script-src` oppdateres automatisk av CI, men alle andre direktiver er manuelle. Full prosedyre i [`docs/architecture/sikkerhet.md`](../architecture/sikkerhet.md).

---

### Task 1: Verifiser hvilke frame-src-oppføringer som faktisk er i bruk

**Files:**
- Read: `src/utils/security-headers.ts`
- Read: `src/pages/admin/index.astro`
- Read: `src/scripts/admin-auth.js`
- Read: `src/scripts/admin-drive.js`

- [ ] **Steg 1.1: Søk etter faktiske iframe-bruk**

  ```bash
  grep -rn "<iframe\|srcdoc\|createElementNS.*iframe\|createElement.*iframe" src/ --include="*.astro" --include="*.js" --include="*.ts"
  ```

  Forventet: ingen treff (koden bruker ikke egne iframes; Google-bibliotekene setter dem opp internt).

- [ ] **Steg 1.2: Bekreft at `www.google.com` ikke brukes**

  ```bash
  grep -rn "www\.google\.com" src/ --include="*.astro" --include="*.js" --include="*.ts" | grep -v "googleapis\|lh3\|img-src\|connect-src\|security-headers"
  ```

  Forventet: ingen treff som krever `frame-src`-tilgang.

- [ ] **Steg 1.3: Kartlegg googleapis.com-subdomener i bruk**

  ```bash
  grep -rn "googleapis\.com" src/ --include="*.astro" --include="*.js" --include="*.ts" | grep -v "test\|__tests__"
  ```

  Dokumenter hvilke subdomener som brukes (forventer `www.googleapis.com`, `content.googleapis.com`, `oauth2.googleapis.com`).

---

### Task 2: Fjern `www.google.com` fra frame-src og stram inn wildcard

**Files:**
- Modify: `src/utils/security-headers.ts`

- [ ] **Steg 2.1: Fjern `https://www.google.com` fra frame-src**

  Endre linje 13 fra:
  ```ts
  "frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com",
  ```
  Til:
  ```ts
  "frame-src https://drive.google.com https://accounts.google.com https://content.googleapis.com",
  ```

  **Begrunnelse:**
  - `www.google.com` fjernes — ingen identifisert bruk med GSI-biblioteket
  - `*.googleapis.com` snevres inn til `content.googleapis.com` — det eneste subdomenet GAPI-biblioteket bruker for iframe-basert cross-origin kommunikasjon
  - `drive.google.com` og `accounts.google.com` beholdes inntil manuell verifisering er gjort

- [ ] **Steg 2.2: Bygg og sjekk at CSP er korrekt generert**

  ```bash
  npm run build 2>&1 | tail -5
  grep "frame-src" dist/admin/index.html || echo "CSP er i HTTP-header, ikke inline"
  ```

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

- [ ] **Steg 4.2: Synkroniser `frame-src` til CloudFront manuelt**

  **Merk:** CI oppdaterer kun `script-src` automatisk. `frame-src` og alle andre direktiver er manuelle.

  Begge distribusjoner (`test2.aarrestad.com` og `tennerogtrivsel.no`) bruker samme policy (`tot-security-headers`). En policy-oppdatering treffer begge simultant — det finnes ikke en "knytt til test først"-mulighet uten å opprette en separat policy.

  1. AWS Console → CloudFront → Policies → Response headers policies → `tot-security-headers` → Edit
  2. Finn `Content-Security-Policy`-raden under Custom headers
  3. Oppdater `frame-src`-delen av CSP-strengen til å matche den nye verdien i `security-headers.ts` (alt på én linje, semikolon-separert med resten av CSP)
  4. Save — endringen deployes til begge distribusjoner (5–15 min)
  5. Verifiser TEST:
     ```bash
     curl -I https://test2.aarrestad.com/ | grep -i "content-security-policy"
     ```
     Test admin-login på `https://test2.aarrestad.com/admin/` — ingen CSP-violations i konsoll
  6. Verifiser PROD:
     ```bash
     curl -I https://tennerogtrivsel.no/ | grep -i "content-security-policy"
     ```
  7. Hvis noe bryter (CSP-violations på test eller prod): rollback er umiddelbar — sett `frame-src` tilbake til den gamle verdien i policyen og save.
