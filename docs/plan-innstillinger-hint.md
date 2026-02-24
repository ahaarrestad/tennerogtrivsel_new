# Plan: Gjøre det enklere å forstå hvor innstillinger brukes

## Problem
Brukeren av admin-panelet vet ikke nødvendigvis hvor de ulike tekstene i Innstillinger-modulen dukker opp på den offentlige nettsiden.

## Løsning: Plasseringshint per innstilling

Legge til en kort hjelpetekst under hver innstilling som viser hvor den brukes på nettsiden.

### Implementering

**Steg 1: Definér plasseringskart**

Legg til et `SETTING_HINTS`-objekt i `admin-dashboard.js` som mapper setting-nøkler til korte plasseringsbeskrivelser:

```js
const SETTING_HINTS = {
    phone1: "Kontakt-seksjon, footer, mobilknapp",
    velkomstTittel1: "Forsiden — hero-tittel (linje 1)",
    kontaktTittel: "Navbar + kontakt-seksjon (overskrift)",
    siteTitle: "Nettleserens tittellinje (alle sider)",
    // ...
};
```

**Steg 2: Vis hint i UI**

I `loadSettingsModule()` (index.astro), vis hintet under etiketten som en liten, dempet tekst.

**Steg 3: Tester**

Oppdater tester for å dekke hint-rendering.

## Filer
- `src/pages/admin/index.astro` — loadSettingsModule(), vise hint
- `src/scripts/__tests__/admin-dashboard.test.js` — tester (om relevant)
