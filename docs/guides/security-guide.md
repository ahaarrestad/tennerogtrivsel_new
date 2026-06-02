# Security Guide

Retningslinjer for å unngå XSS og andre injeksjonssårbarheter i admin-koden.

## innerHTML og outerHTML med template-interpolasjon

ESLint-regelen `local/no-unsafe-inner-html` blokkerer assignments som:

```js
element.innerHTML = `...${variable}...`;
```

**Tre lovlige mønstre:**

### 1. Sanitering med DOMPurify (for innhold fra CMS/eksternt)
```js
element.innerHTML = DOMPurify.sanitize(cmsContent);
```

### 2. Escaping med escapeHtml (for enkle tekstverdier)
```js
element.innerHTML = `<div>${escapeHtml(userText)}</div>`;
```

### 3. Safe-kommentar (for hardkodede eller typebegrenset innhold)

Kommentaren må stå på **linjen før** assignment — trailing comment på samme linje sees ikke av regelen.

```js
// safe: ICON_ADD er en hardkodet SVG-konstantstreng
element.innerHTML = `<button>${ICON_ADD}</button>`;
```

```js
// safe: formatTimestamp returnerer formatert dato uten HTML-spesialtegn
element.innerHTML = `<span>✅ ${ts}</span>`;
```

**Hva som er trygt å merke med `// safe:`:**
- Hardkodede SVG/HTML-konstantstrenger (`ICON_*`)
- Returverdier fra funksjoner som er bevist å ikke inneholde HTML-spesialtegn (datoformateringsfunksjoner, enum-verdier)
- Innhold satt via `.textContent` etterpå (selve HTML-strukturen er hardkodet)

**Hva som ALDRI er trygt uten DOMPurify/escapeHtml:**
- Direkte innhold fra Google Sheets/Drive
- Brukerinput av enhver art
- Errormeldinger fra `Error.message` (kan inneholde vilkårlig tekst)

## Kjent begrensning i ESLint-regelen

Regelen sjekker om `DOMPurify.sanitize(` eller `escapeHtml(` finnes **et sted** i template literal-teksten. Det betyr at en template med to interpolasjoner der bare én er wrappet, vil passere uten warning:

```js
// FEIL — regelen ser escapeHtml( og stopper, rawVar er ikke sjekket
el.innerHTML = `<img src="${escapeHtml(url)}" alt="${rawVar}">`;
```

Regelen er en heuristikk, ikke en fullstendig analyse. Konsekvens: **alle** interpolasjoner i en template som bruker escaping skal escapes — ikke bare én.

## .astro-filer

`.astro`-filer er **ikke** dekket av `local/no-unsafe-inner-html`-regelen (krever `eslint-plugin-astro`, ikke satt opp). Bruk `DOMPurify.sanitize()` manuelt ved `innerHTML`-bruk i `.astro` script-blokker.

## Testfiler

I testfiler (`src/scripts/__tests__/**`) er `local/no-unsafe-inner-html`-regelen deaktivert. `document.body.innerHTML = ...` brukes til å sette opp testfixtures og er strukturelt trygt.
