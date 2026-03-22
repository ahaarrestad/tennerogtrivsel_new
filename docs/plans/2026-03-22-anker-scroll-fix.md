# Plan: Anker-scroll stopper for langt oppe ved navigasjon fra underside

Dato: 2026-03-22

## Problemformulering

Når brukeren navigerer fra en underside (f.eks. `/tannleger`) til et anker på forsiden (f.eks. `/#tjenester`), havner tittelen midt på skjermen i stedet for øverst i den synlige delen (rett under navbar).

## Rotårsak

Seksjonene bruker `scroll-margin-top: var(--nav-total-height, 1.5rem)` for å gi rom til den sticky navbaren. Variabelen `--nav-total-height` settes dynamisk av `layout-helper.js` etter at layouten er beregnet.

**Problemet:** Ved kryssside-navigasjon kan nettleseren utføre hash-scrollet *før* `layout-helper.js` har satt `--nav-total-height` til korrekt verdi. I så fall brukes fallback-verdien `1.5rem` (24px) i stedet for faktisk navbar-høyde (64–80px). Seksjonen scroller da 40–56px for langt opp under navbaren, og med seksjonens `padding-top` på 64–80px havner tittelen visuelt midt på skjermen.

## Løsning

To-delt:

### Del 1 — CSS-fallback (lav risiko, ingen JS-endring)

Endre fallback i `global.css` fra `1.5rem` til `4rem` (64px = mobil navbar-høyde). Dette gir en mye bedre startverdi selv om JS ikke har kjørt ennå, og eliminerer problemet i de aller fleste tilfeller.

### Del 2 — Re-scroll etter at layout er stabil

I `layout-helper.js`, etter den *første* synkrone `updateLayout()`-kjøringen, sjekk om `window.location.hash` er satt. Hvis ja, scroll til elementet med `scrollIntoView({ behavior: 'instant' })`. Dette retter opp posisjonen etter at `--nav-total-height` er korrekt satt, uten synlig hopp for brukeren.

Bruk et flagg (`initialScrollHandled`) for å sikre at re-scrollet kun skjer én gang ved sideoppstart — ikke ved resize eller MutationObserver-callbacks.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `src/styles/global.css` | Fallback `1.5rem` → `4rem` i `.section-container` |
| `src/scripts/layout-helper.js` | Re-scroll etter første `updateLayout()` |
| `src/scripts/__tests__/layout-helper.test.js` | Tester for re-scroll-atferd |

## Steg-for-steg

### Steg 1 — CSS-fix

I `src/styles/global.css`, endre `.section-container`:

```css
scroll-margin-top: var(--nav-total-height, 4rem);
```

(var fra `1.5rem`)

### Steg 2 — Re-scroll-logikk (TDD: test først)

I `initLayoutHelper()` i `layout-helper.js`:

```js
let initialScrollHandled = false;

// Etter den synkrone updateLayout()-kallet på slutten av initLayoutHelper():
if (!initialScrollHandled && window.location.hash) {
    initialScrollHandled = true;
    const target = document.querySelector(window.location.hash);
    target?.scrollIntoView({ behavior: 'instant' });
}
```

Flagget sikrer at logikken kun kjører ved oppstart, ikke ved resize eller MutationObserver-callbacks.

### Steg 3 — Tester

Nye tester i `layout-helper.test.js`:

- Med hash i URL: `initLayoutHelper()` kaller `scrollIntoView` på target-elementet
- Re-scroll skjer kun én gang — et kall til `scheduleUpdate()` (f.eks. resize) trigger ikke ny scroll
- Uten hash i URL: ingen `scrollIntoView`-kall
- Hash som ikke matcher noe element: ingen feil (null-guard)

### Steg 4 — Manuell verifisering

1. Naviger til `/tannleger`
2. Klikk «Våre tjenester» i menyen → `/#tjenester` lastes
3. Sjekk: seksjonstittelen er synlig øverst, rett under navbaren — ikke midt på skjermen
4. Gjenta for «Kontakt oss» / `/#kontakt`
5. Sjekk at det ikke er synlig hopp i scroll-posisjon
6. `npm test` — alle tester grønne, coverage ≥ 80 % for berørte filer

## Avhengigheter og risiko

- Ingen avhengigheter til andre pågående oppgaver
- Lav risiko — `scrollIntoView({ behavior: 'instant' })` er veldefinert og støttes i alle moderne nettlesere
- CSS-endringen (steg 1) kan deployes alene som hurtigfix
