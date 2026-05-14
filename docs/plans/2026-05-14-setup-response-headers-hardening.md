# Plan: Hardening av setup-response-headers-policy.mjs

**Dato:** 2026-05-14
**Fil:** `scripts/setup-response-headers-policy.mjs`
**Bakgrunn:** Tre funn fra PR #298 review som alle gjelder samme script.

---

## Problem 1 — `unsafe-inline`-fallback (linje 20–22)

**Nåværende kode:**
```js
const scriptSrc = hashData.scriptHashes.length > 0
    ? `'self' ${hashData.scriptHashes.map(h => `'${h}'`).join(' ')} ...`
    : `'self' 'unsafe-inline' ...`;  // ← farlig fallback
```

**Risiko:** Hvis `scriptHashes` er tom (f.eks. tom array i generert fil), ruller scriptet ut en svakere CSP med `unsafe-inline` til prod uten advarsel.

**Fix:** Kast `FatalError` i stedet for fallback:
```js
if (hashData.scriptHashes.length === 0) {
    throw new FatalError(
        'csp-hashes.json inneholder ingen script-hashes. ' +
        'Kjør "npm run build" for å generere dem før du kjører dette scriptet.'
    );
}
const scriptSrc = `'self' ${hashData.scriptHashes.map(h => `'${h}'`).join(' ')} ...`;
```

---

## Problem 2 — Uforståelig feil ved manglende csp-hashes.json (linje 16–18)

**Nåværende kode:**
```js
const hashData = JSON.parse(
    readFileSync(join(__dirname, '../src/generated/csp-hashes.json'), 'utf-8')
);
```

**Risiko:** Krasjer med generisk `ENOENT`-feil ved nyoppsett (filen genereres av bygget). Ingenting i feilmeldingen forteller at løsningen er å kjøre `npm run build`.

**Fix:** Wrap i try/catch med forklarende melding:
```js
let hashData;
try {
    hashData = JSON.parse(
        readFileSync(join(__dirname, '../src/generated/csp-hashes.json'), 'utf-8')
    );
} catch (err) {
    if (err.code === 'ENOENT') {
        console.error(
            'Feil: src/generated/csp-hashes.json finnes ikke.\n' +
            'Kjør "npm run build" for å generere filen før du kjører dette scriptet.'
        );
    } else {
        console.error(`Klarte ikke lese csp-hashes.json: ${err.message}`);
    }
    process.exit(1);
}
```

---

## Problem 3 — ensurePolicy() er ikke genuint idempotent (linje 136–147)

**Nåværende kode:**
```js
function ensurePolicy() {
    const existingId = findExistingPolicy();
    if (existingId) {
        console.log(`Policy finnes: ${existingId}`);
        return existingId;   // ← returnerer uten å sjekke innhold
    }
    ...
}
```

**Risiko:** Scriptet sier «Policy finnes» og returnerer ID-en, men verifiserer ikke at den eksisterende CSP-en matcher ønsket tilstand. CSP-endringer (f.eks. nye script-hashes) krever manuell oppdatering.

**Fix:** Hent eksisterende konfigurasjon, sammenlign CSP-strengen, og oppdater ved avvik:

```js
function getExistingPolicyConfig(id) {
    const output = execFileSync('aws', [
        '--no-cli-pager', 'cloudfront', 'get-response-headers-policy',
        '--id', id, '--output', 'json',
    ], { encoding: 'utf-8', stdio: 'pipe' });
    const result = JSON.parse(output);
    return {
        etag: result.ETag,
        csp: result.ResponseHeadersPolicy.ResponseHeadersPolicyConfig
                 .SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy,
    };
}

function updatePolicy(id, etag) {
    // Samme config-objekt som i createPolicy(), pakket inn i { ResponseHeadersPolicyConfig: ... }
    // Kaller cloudfront update-response-headers-policy --if-match <etag>
}

function ensurePolicy() {
    const existingId = findExistingPolicy();
    if (existingId) {
        const { etag, csp } = getExistingPolicyConfig(existingId);
        if (csp === CSP_STRING) {
            console.log(`Policy er oppdatert, ingen endring nødvendig: ${existingId}`);
        } else {
            console.log('CSP-streng er endret — oppdaterer policy...');
            updatePolicy(existingId, etag);
            console.log(`  Policy oppdatert: ${existingId}`);
        }
        return existingId;
    }
    ...
}
```

---

## Rekkefølge

Problem 2 og 1 er enkle endringer (~10 linjer hver). Problem 3 krever to nye funksjoner og AWS-kall som er vanskeligere å teste lokalt.

**Forslag:** En samlet PR med alle tre fikser, i rekkefølge 2 → 1 → 3.

## Testing

- Problem 1: Test med tom `scriptHashes: []` i mock av `csp-hashes.json` — forvent `FatalError`
- Problem 2: Test med manglende fil (ENOENT) og ugyldig JSON — forvent korrekt feilmelding og exit 1
- Problem 3: Mock `execFileSync` for å simulere at eksisterende CSP avviker — verifiser at update kalles

Eksisterende tester for scriptet finnes i `scripts/__tests__/setup-response-headers-policy.test.mjs`.
