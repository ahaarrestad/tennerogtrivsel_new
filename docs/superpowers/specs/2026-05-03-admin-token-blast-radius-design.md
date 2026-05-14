# Design: Task 7 — Reduser admin-token blast-radius (F6)

**Dato:** 2026-05-03
**Funn:** F6 — Admin OAuth-token i `localStorage` gir XSS = full Drive/Sheets takeover
**Mål:** Flytte token fra `localStorage` til `sessionStorage`, korte ned effektiv token-levetid, og hindre indeksering av admin-siden i prod via CloudFront Function.

---

## Kontekst

`admin-auth.js` lagrer i dag Google OAuth-access-token i enten `localStorage` eller `sessionStorage` basert på `_rememberMe`-flagget. Problemet: `localStorage`-token lever til token-expiry (~1 time) selv om brukeren lukker nettleseren — XSS kan stjele det i hele vinduet. `sessionStorage` begrenser vinduet til aktiv fane.

Eksisterende "Husk meg"-checkbox i login-UI beholdes, men med ny semantikk.

---

## Steg 7.1 — Token alltid i sessionStorage

### Ny semantikk for "Husk meg"

| Tilstand | Token-lagring | localStorage-flagg | Oppførsel ved cold start |
|----------|--------------|-------------------|--------------------------|
| Unchecked (default) | `sessionStorage` | Ingen | Vis login-skjerm |
| Checked | `sessionStorage` | `admin_remember_me = '1'` | Kjør `silentLogin()` usynlig; hvis Google-sesjon aktiv → innlogget uten popup; hvis ikke → vis login-skjerm |

Flagget `admin_remember_me` i `localStorage` er kun en intensjon — ikke et token. Verdien er verdiløs for en angriper.

### Endringer i `admin-auth.js`

**`initGis` callback:**
- Skriv alltid token til `sessionStorage`
- Fjern `localStorage`-token alltid
- Hvis `_rememberMe === true`: `localStorage.setItem('admin_remember_me', '1')`
- Hvis `_rememberMe === false`: `localStorage.removeItem('admin_remember_me')`

**`getStoredUser()`:**
- Sjekk kun `sessionStorage` (fjern `localStorage`-iterasjon)
- Erstatt `_rememberMe = (storage === localStorage)` med `_rememberMe = !!localStorage.getItem('admin_remember_me')` — viktig for at GIS-callback skal sette flagget riktig ved silent-refresh etter cold start

**`tryRestoreSession()`:**
- Sjekk kun `sessionStorage`
- Samme `_rememberMe`-endring som i `getStoredUser()`

**`logout()`:**
- Fjern `admin_google_token` fra `localStorage` og `sessionStorage`
- Fjern `admin_remember_me` fra `localStorage`

### Endringer i `admin-init.js`

Linje 122 — `hadRememberMe`-sjekk:
```js
// Før:
const hadRememberMe = !!localStorage.getItem('admin_google_token');
// Etter:
const hadRememberMe = !!localStorage.getItem('admin_remember_me');
```

---

## Steg 7.2 — Kortere expiry-margin

`admin-auth.js` bruker `Date.now() < expiry - 60000` på to steder (linje 124 i `getStoredUser`, linje 144 i `tryRestoreSession`) for å sjekke om token er gyldig. 60 sekunder er for lite — et stjålet token er gyldig i nesten hele Google-expiry-vinduet (~1 time).

**Endring:** Bytt `60000` til `300000` (5 minutter) begge steder.

Effekt: Silent-refresh trigges 5 min tidligere → stjålet token har kortere gjenværende levetid i verste fall.

---

## Steg 7.3 — X-Robots-Tag: noindex på /admin*

Admin-siden har allerede `<meta name="robots" content="noindex, nofollow">` og `robots.txt Disallow: /admin`. HTTP-headeren er defensiv redundans som gjelder for crawlere som ikke følger meta-tagger.

### CloudFront Function (one-shot script, kjøres lokalt)

**`scripts/setup-admin-cloudfront-function.mjs`:**

```
1. aws cloudfront list-functions → sjekk om "tot-admin-noindex" allerede finnes
2. Hvis ikke: aws cloudfront create-function med viewer-response handler
3. aws cloudfront publish-function
4. aws cloudfront get-distribution-config → hent config + ETag
5. Patch default behavior: legg til FunctionAssociation (EventType: viewer-response)
6. aws cloudfront update-distribution --if-match <ETag>
```

CloudFront Function-kode:
```js
function handler(event) {
    var response = event.response;
    var request = event.request;
    if (request.uri.startsWith('/admin')) {
        response.headers['x-robots-tag'] = { value: 'noindex' };
    }
    return response;
}
```

Script er idempotent — kjøring flere ganger er trygt. Krever env-var `CLOUDFRONT_DISTRIBUTION_ID`.

**Permissions som kreves lokalt:**
- `cloudfront:ListFunctions`
- `cloudfront:CreateFunction`
- `cloudfront:PublishFunction`
- `cloudfront:GetDistributionConfig`
- `cloudfront:UpdateDistribution`

### Middleware (dev)

Legg til i `middleware.ts`: Sett `X-Robots-Tag: noindex` på requests der `url.pathname.startsWith('/admin')`.

---

## Testing

### `admin-auth.test.js`

Oppdater eksisterende tester for ny storage-logikk:
- Token skrives alltid til `sessionStorage`, aldri `localStorage`
- `admin_remember_me`-flagg settes i `localStorage` når `rememberMe=true`
- `admin_remember_me`-flagg fjernes fra `localStorage` når `rememberMe=false`
- `logout()` fjerner `admin_google_token` fra begge storages og `admin_remember_me` fra `localStorage`
- `getStoredUser()` finner token i `sessionStorage`
- `getStoredUser()` finner ikke token som kun ligger i `localStorage`
- `tryRestoreSession()` bruker kun `sessionStorage`
- Expiry-margin er 300 000 ms (5 min), ikke 60 000 ms

### `middleware.test.ts`

Ny assertion: `X-Robots-Tag: noindex` settes på `/admin`-requests, ikke på andre paths.

---

## Avgrensning

- Ingen endring i UX-flyt for brukere med aktiv Google-sesjon (silent login er transparent)
- Ingen endring i `login()`-funksjonens popup-oppførsel
- CloudFront Function dekker kun `/admin`-prefix — andre paths berøres ikke
- `admin_remember_me`-flagget ryddes ved `logout()`, men ikke ved token-expiry (akseptert: flagget er harmløst uten aktiv Google-sesjon)
