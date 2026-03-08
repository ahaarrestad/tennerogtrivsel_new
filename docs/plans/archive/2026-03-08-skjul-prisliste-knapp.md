# Skjul «Juster prisene»-knapp uten Sheet-tilgang — Implementeringsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Skjule prisliste-kortet i admin-dashboardet når brukeren ikke har tilgang til Google Sheet.

**Architecture:** Utvide det eksisterende `enforceAccessControl()`-mønsteret i `admin-dashboard.js` med én ny modul-entry for prisliste. Ingen nye API-kall eller avhengigheter.

**Tech Stack:** JavaScript, Vitest (jsdom)

---

### Task 1: Skriv tester for prisliste-kort i enforceAccessControl

**Files:**
- Modify: `src/scripts/__tests__/admin-dashboard.test.js`

**Step 1: Legg til test — prisliste-kort vises med Sheet-tilgang**

Legg til i `describe('enforceAccessControl')` (etter linje ~1895):

```javascript
it('should show prisliste card when user has sheet access', async () => {
    adminClient.checkMultipleAccess.mockResolvedValue({ 's': true });

    await enforceAccessControl({ SHEET_ID: 's' });

    expect(document.getElementById('card-prisliste').style.display).toBe('flex');
});

it('should hide prisliste card when user lacks sheet access', async () => {
    adminClient.checkMultipleAccess.mockResolvedValue({ 's': false });

    await enforceAccessControl({ SHEET_ID: 's' });

    expect(document.getElementById('card-prisliste').style.display).toBe('none');
});

it('should hide prisliste card when no SHEET_ID configured', async () => {
    adminClient.checkMultipleAccess.mockResolvedValue({ 'tj': true });

    await enforceAccessControl({ TJENESTER_FOLDER: 'tj' });

    expect(document.getElementById('card-prisliste').style.display).toBe('none');
});
```

**Step 2: Kjør testene og verifiser at de feiler**

Run: `npx vitest run src/scripts/__tests__/admin-dashboard.test.js --reporter=verbose 2>&1 | grep -E "prisliste card|FAIL|PASS"`

Expected: Alle 3 nye tester feiler (prisliste-kortet er alltid synlig uavhengig av tilgang).

**Step 3: Oppdater eksisterende tester som sjekker alle kort**

Flere eksisterende tester sjekker at kort er hidden/shown men nevner ikke `card-prisliste`. Legg til prisliste-assertions i disse testene:

- **Linje ~1791-1794** (test: "only meldinger"): legg til `expect(document.getElementById('card-prisliste').style.display).toBe('none');`
- **Linje ~1806-1809** (test: "only tjenester"): legg til `expect(document.getElementById('card-prisliste').style.display).toBe('none');`
- **Linje ~1820-1824** (test: "sheet + tannleger folder"): legg til `expect(document.getElementById('card-prisliste').style.display).toBe('flex');` (har sheet-tilgang)
- **Linje ~1836-1841** (test: "sheet but no folders"): legg til `expect(document.getElementById('card-prisliste').style.display).toBe('flex');` (har sheet-tilgang)
- **Linje ~1850-1856** (test: "folders but not sheet"): legg til `expect(document.getElementById('card-prisliste').style.display).toBe('none');`
- **Linje ~1885** (test: "card elements missing from DOM"): legg til `'card-prisliste'` i listen over kort som fjernes

---

### Task 2: Implementer endringen

**Files:**
- Modify: `src/scripts/admin-dashboard.js:119-125`

**Step 1: Legg til prisliste-modul i modules-arrayet**

I `enforceAccessControl()`, legg til etter bilder-linjen (linje 124):

```javascript
const modules = [
    { id: 'settings', resource: config.SHEET_ID, card: 'card-settings' },
    { id: 'tjenester', resource: config.TJENESTER_FOLDER, card: 'card-tjenester' },
    { id: 'meldinger', resource: config.MELDINGER_FOLDER, card: 'card-meldinger' },
    { id: 'tannleger', resources: [config.TANNLEGER_FOLDER, config.SHEET_ID], card: 'card-tannleger' },
    { id: 'bilder', resources: [config.SHEET_ID, config.BILDER_FOLDER].filter(Boolean), card: 'card-bilder' },
    { id: 'prisliste', resource: config.SHEET_ID, card: 'card-prisliste' },
];
```

**Step 2: Kjør alle tester og verifiser at de passerer**

Run: `npx vitest run src/scripts/__tests__/admin-dashboard.test.js --reporter=verbose`

Expected: Alle tester passerer, inkludert de 3 nye og de oppdaterte eksisterende.

**Step 3: Kjør coverage-sjekk**

Run: `npx vitest run src/scripts/__tests__/admin-dashboard.test.js --coverage`

Expected: `admin-dashboard.js` har ≥80% branch coverage.

**Step 4: Commit**

```
feat(admin): skjul prisliste-kort uten Sheet-tilgang
```
