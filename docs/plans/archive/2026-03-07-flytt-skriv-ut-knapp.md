# Plan: Flytt "Skriv ut"-knapp fra prisliste-siden til admin-panelet

## Bakgrunn

"Skriv ut"-knappen er i dag plassert på den offentlige prisliste-siden (`/prisliste`), synlig kun for innloggede admin-brukere. Den hører bedre hjemme i admin-panelet.

## Designbeslutninger

- Knappen plasseres i prisliste-modulens action-bar i admin (ved siden av "Legg til prisrad")
- Knappen åpner `/prisliste?print=1` i nytt vindu/fane
- Prisliste-siden sjekker `?print=1` + admin-innlogging: kun da trigges `window.print()` automatisk
- Eksisterende print-CSS beholdes uendret

## Sikkerhet

- `?print=1` uten gyldig admin-token gjør ingenting (siden vises som vanlig)
- Ingen server-side endringer — prislisten er allerede offentlig data

## Implementeringssteg

### Steg 1: Legg til "Skriv ut"-knapp i admin-panelet

**Fil:** `src/scripts/admin-module-prisliste.js`

- I `loadPrislisteList()`, legg til en "Skriv ut"-knapp i `module-actions` ved siden av "Legg til prisrad"
- Knappen åpner `/prisliste?print=1` i nytt vindu: `window.open('/prisliste?print=1', '_blank')`

### Steg 2: Oppdater prisliste-siden

**Fil:** `src/pages/prisliste.astro`

- Fjern `#print-wrapper` div med knappen
- Fjern `isAdminLoggedIn()`-funksjonen og koden som viser/skjuler knappen
- Legg til nytt script som:
  1. Sjekker om `?print=1` finnes i URL
  2. Sjekker om bruker er innlogget admin (samme `admin_google_token`-logikk)
  3. Kun hvis begge er sant: kall `window.print()`

### Steg 3: Tester

- Oppdater eksisterende tester i `admin-module-prisliste.test.js` for ny knapp
- Verifiser at print-knapp rendres i listevisningen
- Verifiser at knappen kaller `window.open` med riktig URL

## Filer som endres

1. `src/scripts/admin-module-prisliste.js`
2. `src/pages/prisliste.astro`
3. `src/scripts/__tests__/admin-module-prisliste.test.js`
