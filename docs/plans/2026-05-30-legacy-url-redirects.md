# Plan: Legacy-URL-redirects fra gammel nettside

**Dato:** 2026-05-30
**Filer:** `scripts/cloudfront-trailing-slash.js`, `scripts/cloudfront-trailing-slash.mjs`, `scripts/__tests__/cloudfront-trailing-slash.test.mjs`

## Bakgrunn

Den gamle nettsiden brukte jQuery SPA med query-parameter-routing (`?page=X`). Disse URL-ene finnes i Google-indeksen og i bokmerker. Redirect-logikken ble opprinnelig implementert i CloudFront Function `url-rewrite-index` / `add-index-html` som en del av go-live-planen (`2026-02-28-cloudfront-prod-komplett.md`, Fase 5), men gikk tapt da funksjonene ble konsolidert i `cloudfront-trailing-slash.js`.

Resultatet er at f.eks. `https://www.tennerogtrivsel.no/www/index.html?page=trygdeordninger` nå gir 404.

## URL-mapping

| Gammel query | Ny URL |
|---|---|
| `?page=kontakt` | `/kontakt/` |
| `?page=behandlingstilbud` | `/tjenester/` |
| `?page=trygdeordninger` | `/tjenester/` |
| `?page=omoss` | `/tannleger/` |
| `/index.html` (uten `?page=`) | `/` |
| `/www/index.html` (uten `?page=`) | `/` |

Trailing slash er inkludert for å unngå dobbel-redirect (den eksisterende trailing-slash-logikken ville ellers lagt til skråstrek i et ekstra round-trip).

## Løsning

### Plassering i `handler()`

Ny blokk legges inn **etter** www-redirect-blokken (linje 31–42) og **før** `hasExtension`-sjekken (linje 56). Rekkefølgen er avgjørende:

- Etter www-redirect: garanterer at ikke-www-forespørsler med `?page=` alltid sendes til `www.` i ett steg, og at `?page=`-logikken ikke produserer en relativ redirect fra feil domene.
- Før `hasExtension`: `/www/index.html` har utvidelse `.html`, og ville ellers bli sendt gjennom til S3 (404) uten denne sjekken.

`var qs` deklareres øverst i `handler()` sammen med `uri` og `host` (ikke inline i blokken) for å følge eksisterende stil og unngå implisitt hoisting.

```js
// Legacy ?page=-redirects fra gammel jQuery SPA
if (qs && qs.page) {
    var pageMap = {
        'kontakt': '/kontakt/',
        'behandlingstilbud': '/tjenester/',
        'trygdeordninger': '/tjenester/',
        'omoss': '/tannleger/'
    };
    var newPath = pageMap[qs.page.value];
    if (newPath) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: newPath } }
        };
    }
}

// Legacy /index.html og /www/index.html → /
if (uri === '/index.html' || uri === '/www/index.html') {
    return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: { 'location': { value: '/' } }
    };
}
```

### Topkommentar i `.js`

`.js` har en nummerert liste over all atferd. Legg til to nye punkter:

```
// 5. ?page=X → ny sti (legacy jQuery SPA redirects) (301)
// 6. /index.html, /www/index.html → / (301)
```

`.mjs` har ikke denne listen (kun en kort linje om at det er ESM-kopi) — ingen endring der.

### ES5.1-krav

`.js`-filen er CloudFront-runtime (ES5.1). Begge filer skal holdes i sync. Bruk kun `var`, `for`-løkker — ingen `const`/`let`, ingen arrow functions, ingen template literals, ingen `Object.entries`.

## TDD-rekkefølge

1. **RED:** Skriv tester som feiler — se liste under
2. Verifiser at de feiler av riktig grunn (ikke tilfeldig feil)
3. **GREEN:** Implementer blokken i `.mjs`
4. Verifiser at alle tester passerer, eksisterende inkludert
5. **SYNC:** Kopier logikk til `.js` manuelt (hold ES5.1)
6. Kjør tester på nytt — begge filer deler testfil via `.mjs`-importen

## Tester som skal legges til

### `?page=`-redirects (www-host, alle kjente verdier)

```js
describe('legacy ?page=-redirects (gammel jQuery SPA)', () => {
    it('?page=kontakt → /kontakt/', () => { ... });
    it('?page=behandlingstilbud → /tjenester/', () => { ... });
    it('?page=trygdeordninger → /tjenester/', () => { ... });
    it('?page=omoss → /tannleger/', () => { ... });
    it('path er irrelevant — /www/index.html?page=kontakt → /kontakt/', () => { ... });
    it('ukjent ?page=-verdi sendes gjennom (ingen redirect)', () => { ... });
    it('statusCode er 301 og statusDescription er Moved Permanently', () => { ... });
});
```

### Prioritetstest: ikke-www-host med `?page=` → www-redirect vinner

```js
it('ikke-www-host med ?page= gir www-redirect, ikke page-redirect', () => {
    const event = makeEvent('/www/index.html', 'tennerogtrivsel.no', { page: { value: 'kontakt' } });
    const response = handler(event);
    // www-redirect skal vinne — ikke page-redirect
    expect(response.statusCode).toBe(301);
    // Mål-URL skal peke til www med original path og query-string bevart
    expect(response.headers.location.value).toBe(
        'https://www.tennerogtrivsel.no/www/index.html?page=kontakt'
    );
});
```

### Legacy path-redirects (uten `?page=`)

```js
describe('legacy path-redirects', () => {
    it('/index.html → /', () => { ... });
    it('/www/index.html → /', () => { ... });
});
```

## Deploy (infrastructure as code)

CloudFront Functions deployes **automatisk via CI/CD** — ingen manuell AWS Console-jobb er nødvendig. `deploy.yml` har allerede et dedikert steg i `deploy`-jobben:

```yaml
- name: Deploy CloudFront Functions
  run: node scripts/setup-cloudfront-functions.mjs
```

Scriptet kjøres etter at koden er pushet til `main` og alle tester har passert. Det oppdaterer og publiserer funksjonen `sitemap_redirect` idempotent. Endringer i `cloudfront-trailing-slash.js` er altså live etter neste godkjente push.

## Manuelle verifiseringssteg etter deploy

Kjør `curl` mot prod for å bekrefte at redirects faktisk virker i CloudFront (ikke bare i tester):

```bash
# ?page=-redirects fra www
for page in kontakt behandlingstilbud trygdeordninger omoss; do
  echo "=== www + ?page=$page ==="
  curl -sI "https://www.tennerogtrivsel.no/www/index.html?page=$page" | grep -iE '(HTTP|location)'
done

# ?page=-redirect fra ikke-www (verifiserer to-stegs kjede: ikke-www → www → page-redirect)
echo "=== ikke-www steg 1: skal redirecte til www ==="
curl -sI "https://tennerogtrivsel.no/www/index.html?page=kontakt" | grep -iE '(HTTP|location)'
# Forventet: 301 location: https://www.tennerogtrivsel.no/www/index.html?page=kontakt

echo "=== ikke-www steg 2: www med ?page= skal redirecte til ny side ==="
curl -sI "https://www.tennerogtrivsel.no/www/index.html?page=kontakt" | grep -iE '(HTTP|location)'
# Forventet: 301 location: /kontakt/

# Legacy path-redirects
echo "=== /index.html ==="
curl -sI "https://www.tennerogtrivsel.no/index.html" | grep -iE '(HTTP|location)'
echo "=== /www/index.html ==="
curl -sI "https://www.tennerogtrivsel.no/www/index.html" | grep -iE '(HTTP|location)'

# Regresjonssjekk — vanlige sider må fortsatt virke
echo "=== Vanlige sider (ingen redirect) ==="
curl -sI "https://www.tennerogtrivsel.no/tjenester/" | grep -iE '^HTTP'
curl -sI "https://www.tennerogtrivsel.no/kontakt/" | grep -iE '^HTTP'
curl -sI "https://www.tennerogtrivsel.no/" | grep -iE '^HTTP'

# Regresjonssjekk — trailing-slash-redirect fortsatt aktiv
echo "=== Trailing-slash (skal fortsatt redirecte) ==="
curl -sI "https://www.tennerogtrivsel.no/tjenester" | grep -iE '(HTTP|location)'
```

**Forventet:**
- Alle `?page=`-URLer fra www: `301` + `location:` til riktig ny URL
- Ikke-www steg 1: `301` → `https://www.tennerogtrivsel.no/www/index.html?page=kontakt`
- Ikke-www steg 2: `301` → `/kontakt/`
- `/index.html` og `/www/index.html`: `301` → `/`
- Vanlige sider: `200 OK`
- Sider uten trailing-slash: `301` til samme URL med skråstrek

## Definition of done

- Alle nye og eksisterende tester grønne
- Branch coverage ≥ 80 % for `cloudfront-trailing-slash`-filen (helst ≥ 90 % etter utvidelse)
- Koden er pushet til `main` og CI/CD-pipeline kjørt uten feil (deploy-jobben inkl. «Deploy CloudFront Functions»-steget)
- Alle manuelle curl-steg gir forventet resultat

## Risiko og avgrensninger

- **Ukjente `?page=`-verdier:** Håndteres — `pageMap[qs.page.value]` gir `undefined` → ingen redirect, forespørselen sendes gjennom. Brukeren får 404. Dekker også multi-value `?page=` (der `qs.page.value` er `undefined`).
- **Tap av ekstra query-parametere ved page-redirect:** `?page=kontakt&utm_source=google` → redirect til `/kontakt/` — UTM og andre params forsvinner. Tilsiktet: vi sender til kanonisk URL. UTM-tap fra 5 år gamle bokmerker er akseptabelt.
- **Dobbel-redirect fra ikke-www:** `tennerogtrivsel.no/www/index.html?page=kontakt` → www-redirect (query-string bevart) → `page`-redirect → `/kontakt/`. To round-trips, korrekt resultat.
- **Scope:** Kun `?page=`-mønsteret og de to kjente path-variantene. Andre legacy-URL-mønstre er ikke i scope.
