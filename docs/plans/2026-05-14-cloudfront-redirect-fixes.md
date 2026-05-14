# Plan: CloudFront redirect-fiks — query-string og doble redirects

**Dato:** 2026-05-14
**Filer:** `scripts/cloudfront-trailing-slash.js`, `scripts/cloudfront-trailing-slash.mjs`, `scripts/__tests__/cloudfront-trailing-slash.test.mjs`

## Bakgrunn

To relaterte bugs i CloudFront viewer-request-funksjonen:

1. **Query-string-tap**: UTM-parametere og andre query-strings mistes ved www-redirect (`tennerogtrivsel.no?utm_source=google` → `www.tennerogtrivsel.no` uten params)
2. **Doble redirects**: `tennerogtrivsel.no/tjenester` gir to round-trips (host-fix, så trailing-slash) i stedet for én

## Løsning

### Hjelpefunksjon: `buildQuerySuffix(qs)`

Serialiserer CloudFront-querystring-objektet til en URL-suffiks (`?foo=bar&baz=qux`), eller tom streng hvis ingen params. Håndterer både enkelt- og multi-verdier.

```js
function buildQuerySuffix(qs) {
    var keys = Object.keys(qs || {});
    if (keys.length === 0) return '';
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = qs[k];
        if (v.multiValue) {
            for (var j = 0; j < v.multiValue.length; j++) {
                parts.push(k + '=' + v.multiValue[j].value);
            }
        } else {
            parts.push(k + '=' + v.value);
        }
    }
    return '?' + parts.join('&');
}
```

### www-redirect: kombiner host-fix + trailing-slash + query-string

Når host er ikke-kanonisk, beregn endelig mål-URI med trailing-slash-logikken allerede innbakt:

```js
if (host && host !== 'www.tennerogtrivsel.no') {
    var targetUri = uri;
    var lastSeg = targetUri.split('/').pop();
    if (targetUri !== '/' && lastSeg.indexOf('.') === -1 && targetUri.charAt(targetUri.length - 1) !== '/') {
        targetUri = targetUri + '/';
    }
    return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: { 'location': { value: 'https://www.tennerogtrivsel.no' + targetUri + buildQuerySuffix(event.request.querystring) } }
    };
}
```

### Øvrige redirects: query-string legges **ikke** til

- Trailing-slash-redirect: intern CloudFront-logikk, query-string videresendes automatisk av CloudFront
- Sitemap-redirect: intern CloudFront-logikk, query-string ikke relevant
- index.html-reskriving: ingen redirect, CloudFront videresender query-string

## Viktig: ES5.1-kompatibilitet

`.js`-filen er CloudFront-runtime (ES5.1). Begge filer skal holdes i sync og kun bruke `var`, `for`-løkker, ingen arrow functions, ingen template literals.

## TDD-rekkefølge

1. **RED**: Skriv testene (query-string og single-redirect)
2. Verifiser at de feiler av riktig grunn
3. **GREEN**: Implement `buildQuerySuffix` og ny www-redirect-blokk
4. Verifiser at alle tester passerer
5. Sync `.js`-fil fra `.mjs`

## Berørte tester (nye)

- Query-string bevares ved www-redirect (enkelt param, flere params, ingen params)
- Multi-verdi query-string bevares
- `tennerogtrivsel.no/tjenester` → én redirect til `www.../tjenester/` (ikke to)
- `tennerogtrivsel.no/logo.png` → én redirect til `www.../logo.png` (fil, ingen slash)
- `tennerogtrivsel.no/tjenester/` → én redirect til `www.../tjenester/` (allerede slash)
- Kombinert: host-redirect med query-string + trailing-slash
