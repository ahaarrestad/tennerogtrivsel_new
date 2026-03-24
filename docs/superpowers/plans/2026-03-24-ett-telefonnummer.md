# Fjern phone2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjerne `phone2`-feltet fra hele kodebasen slik at klinikken kun har ett telefonnummer.

**Architecture:** Ren sletting av `phone2` fra data, defaults, komponenter og admin-hints. Ingen ny logikk. Eksisterende test `HARD_DEFAULT_KEYS synkronisering` vil automatisk verifisere at `sync-data.js` og `getSettings.ts` er i sync etter endringene.

**Tech Stack:** Astro, TypeScript, Vitest

---

### Task 1: Fjern phone2 fra data og scripts

**Files:**
- Modify: `src/content/innstillinger.json:6-9`
- Modify: `src/scripts/getSettings.ts:6`
- Modify: `src/scripts/sync-data.js:14`
- Modify: `src/scripts/admin-module-settings.js:19`

- [ ] **Step 1: Fjern phone2-oppføringen fra innstillinger.json**

  Fjern disse linjene (linje 6–9):
  ```json
  {
    "id": "phone2",
    "value": "51 53 64 21"
  },
  ```
  Resultatet skal gå direkte fra `phone1`-objektet til `adresse1`-objektet.

- [ ] **Step 2: Fjern phone2 fra HARD_DEFAULTS i getSettings.ts**

  Fjern linje 6:
  ```ts
  phone2: "51 53 64 21",
  ```

- [ ] **Step 3: Fjern phone2 fra HARD_DEFAULT_KEYS i sync-data.js**

  Linje 14 — fjern `'phone2',`:
  ```js
  const HARD_DEFAULT_KEYS = [
      'phone1', 'email', 'showEmail', 'adresse1', 'adresse2',
  ```

- [ ] **Step 4: Fjern phone2-hint fra admin-module-settings.js**

  Fjern linje 19:
  ```js
  phone2: 'Kontakt, footer',
  ```

- [ ] **Step 5: Kjør tester og verifiser at alt er grønt**

  ```bash
  npx vitest run src/scripts/__tests__/getSettings.test.ts
  ```
  Forventet: Alle tester grønne — særlig `HARD_DEFAULT_KEYS synkronisering` som bekrefter at `sync-data.js` og `getSettings.ts` er i sync.

---

### Task 2: Fjern phone2 fra komponenter

**Files:**
- Modify: `src/components/Kontakt.astro:99-102`
- Modify: `src/components/Footer.astro:43-49`

- [ ] **Step 1: Oppdater Kontakt.astro — Telefon-kortet**

  Linje 99–102, erstatt:
  ```astro
  <p>
      <span set:html={formatInfoText(settings.phone1)}></span> /
      <span set:html={formatInfoText(settings.phone2)}></span>
  </p>
  ```
  med:
  ```astro
  <p><span set:html={formatInfoText(settings.phone1)}></span></p>
  ```

- [ ] **Step 2: Oppdater Footer.astro — fjern betinget phone2-blokk**

  Linje 43–49, fjern hele blokken:
  ```astro
  {settings.phone2 && (
      <p>
          <a href={`tel:${settings.phone2?.replace(/\s+/g, '')}`} class="hover:text-white transition-colors">
              {settings.phone2}
          </a>
      </p>
  )}
  ```

- [ ] **Step 3: Kjør alle tester**

  ```bash
  npx vitest run
  ```
  Forventet: Alle tester grønne.

---

### Task 3: Commit

- [ ] **Step 1: Bruk `/commit`-skillen for å committe og pushe**

  Kjør `/commit`-skillen. Foreslått melding:
  ```
  refactor: fjern phone2 — klinikken har kun ett telefonnummer
  ```
  Skill håndterer staging, code review og push via `git review`.

- [ ] **Step 2: Oppdater TODO.md**

  Marker oppgaven «Støtte for ett telefonnummer til klinikken» som fullført og arkiver den i `TODO-archive.md` og planfilen til `docs/superpowers/plans/archive/`.
