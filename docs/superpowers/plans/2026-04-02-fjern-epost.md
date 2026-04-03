# Fjern offentlig e-postadresse-funksjon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjerne `email`/`showEmail`-innstillingen og `EpostKnapp`-komponenten fra kodebasen, og flytte `aktiv`-sjekken inn i `ContactButton`.

**Architecture:** Ren slettejobb — ingen ny logikk. `ContactButton` internaliserer `aktiv`-sjekken via `getEntry`. Alle kallesteder forenkles. Tester oppdateres til å ikke referere til fjernede felter.

**Tech Stack:** Astro 5, Vitest, TypeScript

---

### Task 1: ContactButton internaliserer aktiv-sjekk

**Files:**
- Modify: `src/components/ContactButton.astro`

- [ ] **Steg 1: Oppdater ContactButton til å hente aktiv internt**

  Erstatt innholdet i `src/components/ContactButton.astro`:

  ```astro
  ---
  import Button from "./Button.astro";
  import { getEntry } from 'astro:content';
  const { class: className, variant = 'primary' } = Astro.props;
  const ksEntry = await getEntry('kontaktskjema', 'kontaktskjema');
  const aktiv = ksEntry?.data?.aktiv ?? false;
  ---
  {aktiv && (
  <Button id="open-contact-modal" variant={variant} class={`open-contact-modal ${className ?? ''}`}>
      Send melding
  </Button>
  )}
  ```

- [ ] **Steg 2: Verifiser at bygget ikke feiler**

  ```bash
  npm run build:ci 2>&1 | tail -5
  ```
  Forventet: ingen feil

- [ ] **Steg 3: Commit**

  ```bash
  git add src/components/ContactButton.astro
  ```
  Commit-melding: `refactor: ContactButton internaliserer aktiv-sjekk fra kontaktskjema`

---

### Task 2: Forside.astro — fjern aktiv-wrapper og EpostKnapp

**Files:**
- Modify: `src/components/Forside.astro`

- [ ] **Steg 1: Fjern EpostKnapp-import (linje 3) og kontaktskjema-fetch (linjene 21–22)**

  Fjern linje 3:
  ```diff
  - import EpostKnapp from "./EpostKnapp.astro";
  ```

  Fjern linjene 21–22:
  ```diff
  - const ksEntry = await getEntry('kontaktskjema', 'kontaktskjema');
  - const kontaktskjema = ksEntry?.data ?? { aktiv: false };
  ```

  Sjekk om `getEntry` brukes andre steder i filen. Hvis ikke, fjern også `getEntry` fra `getCollection`-importen på linje 13:
  ```diff
  - import { getEntry } from 'astro:content';
  ```

- [ ] **Steg 2: Fjern aktiv-wrapperne rundt ContactButton (to steder)**

  Desktop-versjon (ca. linje 40–42):
  ```diff
  - {kontaktskjema.aktiv && (
      <ContactButton />
  - )}
  ```

  Mobil-versjon (ca. linje 62–64):
  ```diff
  - {kontaktskjema.aktiv && (
      <ContactButton />
  - )}
  ```

- [ ] **Steg 3: Verifiser bygget**

  ```bash
  npm run build:ci 2>&1 | tail -5
  ```
  Forventet: ingen feil

- [ ] **Steg 4: Commit**

  ```bash
  git add src/components/Forside.astro
  ```
  Commit-melding: `refactor: Forside bruker ContactButton uten ekstern aktiv-sjekk`

---

### Task 3: tjenester/[id].astro — bytt EpostKnapp med ContactButton

**Files:**
- Modify: `src/pages/tjenester/[id].astro`

- [ ] **Steg 1: Bytt imports**

  ```diff
  - import EpostKnapp from "../../components/EpostKnapp.astro";
  - import KontaktKnapp from "../../components/KontaktKnapp.astro";
  + import ContactButton from "../../components/ContactButton.astro";
  ```

- [ ] **Steg 2: Bytt ut knappene i malen (ca. linje 64–68)**

  ```diff
  - <div class="flex flex-col gap-3 relative z-10">
  -     <TelefonKnapp variant="accent"/>
  -     <EpostKnapp variant="accent"/>
  - </div>
  - <KontaktKnapp class="w-full"/>
  + <div class="flex flex-col gap-3 relative z-10">
  +     <TelefonKnapp variant="accent"/>
  +     <ContactButton variant="accent"/>
  + </div>
  ```

- [ ] **Steg 3: Verifiser bygget**

  ```bash
  npm run build:ci 2>&1 | tail -5
  ```
  Forventet: ingen feil

- [ ] **Steg 4: Commit**

  ```bash
  git add src/pages/tjenester/[id].astro
  ```
  Commit-melding: `refactor: tjenester-side bruker ContactButton istedenfor EpostKnapp`

---

### Task 4: personvern.astro — fjern showEmail-betingelse

**Files:**
- Modify: `src/pages/personvern.astro`

- [ ] **Steg 1: Erstatt betinget e-postvisning med ren tekst (ca. linje 113–117)**

  ```diff
  - Har du spørsmål om personvern? Ta kontakt med oss på telefon {settings.phone1}
  - {settings.showEmail === "ja" && settings.email && (
  -     <span> eller e-post <a href={`mailto:${settings.email}`}>{settings.email}</a></span>
  - )}.
  + Har du spørsmål om personvern? Ta kontakt med oss på telefon {settings.phone1}.
  ```

- [ ] **Steg 2: Verifiser bygget**

  ```bash
  npm run build:ci 2>&1 | tail -5
  ```
  Forventet: ingen feil

- [ ] **Steg 3: Commit**

  ```bash
  git add src/pages/personvern.astro
  ```
  Commit-melding: `refactor: personvern viser ikke lenger e-postadresse direkte`

---

### Task 5: getSettings.ts og buildSchema.ts — fjern email/showEmail

**Files:**
- Modify: `src/scripts/getSettings.ts`
- Modify: `src/scripts/buildSchema.ts`
- Modify: `src/scripts/__tests__/buildSchema.test.ts`

- [ ] **Steg 1: Fjern email-testene fra buildSchema.test.ts**

  Fjern `email` og `showEmail` fra `baseSettings` (linjene 8–9):
  ```diff
  - email: 'post@tennerogtrivsel.no',
  - showEmail: 'ja',
  ```

  Fjern hele `describe('buildSchema – email', ...)` blokken (linjene 54–64):
  ```diff
  - describe('buildSchema – email', () => {
  -     it('inkluderer email når showEmail === "ja"', () => {
  -         const schema = buildSchema(baseSettings, [], '');
  -         expect(schema['email']).toBe('post@tennerogtrivsel.no');
  -     });
  -
  -     it('utelater email når showEmail !== "ja"', () => {
  -         const schema = buildSchema({ ...baseSettings, showEmail: 'nei' }, [], '');
  -         expect(schema).not.toHaveProperty('email');
  -     });
  - });
  ```

- [ ] **Steg 2: Kjør buildSchema-testene**

  ```bash
  npx vitest run src/scripts/__tests__/buildSchema.test.ts
  ```
  Forventet: alle tester passerer (email-testene er nå fjernet)

- [ ] **Steg 3: Fjern showEmail-blokken fra buildSchema.ts (linjene 55–57)**

  ```diff
  - if (settings.showEmail === 'ja') {
  -     schema.email = settings.email;
  - }
  ```

- [ ] **Steg 4: Fjern email og showEmail fra getSettings.ts HARD_DEFAULTS (linjene 6–7)**

  ```diff
  - email: "resepsjon@tennerogtrivsel.no",
  - showEmail: "nei",
  ```

- [ ] **Steg 5: Kjør buildSchema-testene på nytt**

  ```bash
  npx vitest run src/scripts/__tests__/buildSchema.test.ts
  ```
  Forventet: alle tester passerer

- [ ] **Steg 6: Commit**

  ```bash
  git add src/scripts/getSettings.ts src/scripts/buildSchema.ts src/scripts/__tests__/buildSchema.test.ts
  ```
  Commit-melding: `refactor: fjern email/showEmail fra getSettings og buildSchema`

---

### Task 6: sync-data.js — fjern email/showEmail fra HARD_DEFAULT_KEYS

**Files:**
- Modify: `src/scripts/sync-data.js`

- [ ] **Steg 1: Fjern email og showEmail fra HARD_DEFAULT_KEYS (linje 14)**

  ```diff
  - 'phone1', 'email', 'showEmail', 'adresse1', 'adresse2',
  + 'phone1', 'adresse1', 'adresse2',
  ```

- [ ] **Steg 2: Kjør sync-data-testene**

  ```bash
  npx vitest run src/scripts/__tests__/sync-data.test.js
  ```
  Forventet: alle tester passerer

- [ ] **Steg 3: Commit**

  ```bash
  git add src/scripts/sync-data.js
  ```
  Commit-melding: `refactor: fjern email/showEmail fra sync-data HARD_DEFAULT_KEYS`

---

### Task 7: Oppdater test-mocks som refererer til email

**Files:**
- Modify: `src/__tests__/content.config.test.ts`
- Modify: `src/scripts/__tests__/admin-module-settings.test.js`
- Modify: `src/scripts/__tests__/admin-dashboard.test.js`

- [ ] **Steg 1: Fjern email fra content.config.test.ts (linje 54)**

  ```diff
  - { id: 'email', value: 'test@example.com' },
  ```

- [ ] **Steg 2: Kjør content.config-testene**

  ```bash
  npx vitest run src/__tests__/content.config.test.ts
  ```
  Forventet: alle tester passerer

- [ ] **Steg 3: Fjern email fra admin-module-settings.test.js (linje 73)**

  ```diff
  - { id: 'email', value: 'x@y.no', description: 'E-post', order: 2, row: 3 },
  ```

  Merk: `updateBreadcrumbCount` kalles med `mockSettings.length`. Etter fjerning er lengden 1 istedenfor 2 — sjekk at testen fremdeles er korrekt.

- [ ] **Steg 4: Kjør admin-module-settings-testene**

  ```bash
  npx vitest run src/scripts/__tests__/admin-module-settings.test.js
  ```
  Forventet: alle tester passerer

- [ ] **Steg 5: Bytt email-oppføringer i admin-dashboard.test.js (linjene 1461 og 1476)**

  Begge `reorderSettingItem`-tester bruker `id: 'email'` som generisk andre element. Bytt til `id: 'adresse1'`:

  ```diff
  - { row: 3, id: 'email', order: 2 }
  + { row: 3, id: 'adresse1', order: 2 }
  ```
  (to steder, ca. linje 1461 og 1476)

- [ ] **Steg 6: Kjør admin-dashboard-testene**

  ```bash
  npx vitest run src/scripts/__tests__/admin-dashboard.test.js
  ```
  Forventet: alle tester passerer

- [ ] **Steg 7: Commit**

  ```bash
  git add src/__tests__/content.config.test.ts src/scripts/__tests__/admin-module-settings.test.js src/scripts/__tests__/admin-dashboard.test.js
  ```
  Commit-melding: `test: fjern email-referanser fra test-mocks`

---

### Task 8: Slett EpostKnapp og kjør full testsuite

**Files:**
- Delete: `src/components/EpostKnapp.astro`

- [ ] **Steg 1: Slett EpostKnapp.astro**

  ```bash
  rm src/components/EpostKnapp.astro
  ```

- [ ] **Steg 2: Kjør full testsuite**

  ```bash
  npx vitest run
  ```
  Forventet: alle tester passerer, ingen referanser til EpostKnapp

- [ ] **Steg 3: Verifiser bygget**

  ```bash
  npm run build:ci 2>&1 | tail -10
  ```
  Forventet: ingen feil

- [ ] **Steg 4: Commit**

  ```bash
  git add -A
  ```
  Commit-melding: `refactor: slett EpostKnapp — erstattet av ContactButton`
