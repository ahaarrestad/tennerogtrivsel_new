# Design: «Bygg nå»-knapp i admin

**Dato:** 2026-03-21
**Status:** Godkjent

## Formål

Gi admin mulighet til å manuelt trigge et GitHub Actions-bygg og -deploy direkte fra admin-panelet. Nyttig når innhold i Google Drive er oppdatert og man ønsker umiddelbar publisering uten å vente på automatisk trigger.

## Arkitektur

```
Admin-nettleser
  → POST /  (Lambda Function URL)  — trigger bygg
  → GET /   (Lambda Function URL)  — hent siste vellykkede bygg
      → Google tokeninfo API        — verifiser innlogget bruker (kun POST)
      → GitHub API                  — repository_dispatch / runs
```

Lambda Function URL brukes i stedet for API Gateway — ingen ekstra kostnad utover Lambda selv (permanent gratis nivå: 1M kall/mnd).

## Komponenter

### Lambda-funksjon (`admin-build-trigger`)

- **Runtime:** Node.js 22
- **Region:** eu-west-1 (som resten av prosjektet)
- **Minne:** 128 MB
- **Timeout:** 10 sekunder
- **Env-variabler** (kun runtime-verdier — CORS-origin er et deploy-tidspunkt-parameter, ikke en env-var):
  - `GITHUB_PAT` — GitHub fine-grained PAT med `actions:write`-scope
  - `GITHUB_OWNER` — GitHub-organisasjon/bruker
  - `GITHUB_REPO` — repositorynavn
  - `GOOGLE_CLIENT_ID` — OAuth-klientid (for `aud`-sjekk)
- **Oppstartsvalidering:** Hvis noen av env-variablene mangler, kastes en feil ved cold start og logges til CloudWatch. POST-forespørsler returnerer `{ error: "configuration_error" }` med HTTP 500 — aldri fail open.
- **Alle feilresponser er strukturert JSON** (`{ error: "..." }`) — Lambda-koden catcher alle exceptions og returnerer aldri ubehandlede feil til klienten.

### IAM-rolle

Minimal IAM-rolle for Lambda: kun `AWSLambdaBasicExecutionRole` (CloudWatch-logging). Ingen tilgang til S3/CloudFront — Lambda kaller kun eksterne HTTP-APIer.

### Lambda Function URL

- **Auth type:** NONE (egen auth via Google-tokenvalidering)
- **CORS-konfigurasjon:** Settes via AWS CLI på selve Function URL-en (ikke i Lambda-koden). Lambda-koden returnerer kun response body — aldri CORS-headere. AWS injiserer `Access-Control-Allow-Origin` på alle responser (inkludert 4xx/5xx) basert på Function URL-konfigurasjonen. Verifiseres under testing.
- **Deploy-tidspunkt-parameter** (ikke Lambda env-var): `ALLOWED_ORIGIN` — admin-domenets URL, oppgis kun i `aws lambda create-function-url-config`-kommandoen.
  - `AllowOrigins: [ALLOWED_ORIGIN]`
  - `AllowMethods: [GET, POST]`
  - `AllowHeaders: [Authorization, Content-Type]`

### Admin-UI

Plassering: under eksisterende infotekst i dashboard-headeren — ikke et navigasjonskort, men en direktehandling.

```
[▶ Bygg nå]   Siste vellykkede bygg: i dag 14:23
```

Knappen har tre tilstander:
1. **Normal** — klikkbar
2. **Spinner** — mens POST pågår
3. **Tilbakemelding** — suksess ("Bygg startet") eller feilmelding i 5 sekunder, deretter tilbake til normal

Suksess betyr at bygget er **startet** — ikke fullført. Bygg tar flere minutter. "Siste vellykkede bygg"-tidspunktet oppdateres ved neste dashboard-innlasting, ikke umiddelbart.

Knappen er deaktivert (grået ut) til admin-panelet bekrefter gyldig Google-token.

### Ny fil

`src/scripts/admin-module-bygg.js` — håndterer knappeinteraksjon, henter status ved dashboard-innlasting, kaller Lambda. Leser `access_token` fra eksisterende `admin_google_token` i localStorage/sessionStorage (samme struktur som resten av admin-auth-systemet: `{ access_token, expiry, user }`).

Token regnes som gyldig klient-side hvis `Date.now() < expiry - 60_000` (60-sekunders buffer — konsistent med `admin-auth.js`).

## GitHub Actions-trigger: `repository_dispatch`

Lambda bruker `repository_dispatch` (ikke `workflow_dispatch`) for å starte bygg. Begrunnelse: formålet er innholdspublisering — samme som Google Drive-triggeren som allerede bruker `repository_dispatch`. Dette hopper over enhetstester og E2E-tester og går rett til bygg+deploy (~2 min i stedet for ~10 min).

```
POST /repos/{owner}/{repo}/dispatches
body: { "event_type": "google_drive_update" }
```

`deploy.yml` støtter allerede denne trigger-typen.

## Dataflyt

### GET / — siste vellykkede bygg

Kalles ved dashboard-innlasting (ikke-blokkerende). Krever ikke autentisering.

**Accepted risk:** GET-endepunktet er uautentisert og avslører bygg-tidspunkt og kjørings-id til hvem som finner Lambda-URL-en. Dette er akseptabelt — dataen er ikke sensitiv (CI-metadata om en offentlig nettside). Ingen tiltak utover 60-sekunders cache.

**Cache:** Lambda holder et in-memory-cache med TTL 60 sekunder. Cold starts nullstiller cachen — akseptabelt for dette bruksområdet.

```
→ GitHub API: GET /repos/{owner}/{repo}/actions/runs
             ?workflow_id=deploy.yml&status=success&per_page=1
← { "timestamp": "2026-03-21T14:23:00Z", "runId": 12345 }
```

`workflow_id=deploy.yml` refererer til filnavnet i `.github/workflows/` — ikke workflowets `name`-felt (`CI/CD`). Hvis ingen vellykkede kjøringer finnes (f.eks. ved første gangs oppsett) returneres `{ "timestamp": null, "runId": null }`.

### POST / — trigger bygg

GitHub API aksepterer kun én `status`-verdi per kall. For å sjekke om et bygg allerede er aktivt, hentes de siste 20 kjøringene uten statusfilter og filtreres i Lambda (`per_page=20` for å unngå å misse køede kjøringer):

**Per-request timeouts:** Alle tre HTTP-kall i flyten bruker `AbortController` med 3-sekunders timeout. Dette gir buffer til Lambda-timeoutet på 10 sekunder selv under degraderte nettverksforhold.

**`aud`-validering:** Admin-panelet bruker GIS `initTokenClient` + `requestAccessToken` (OAuth2 implicit flow). Google v3 tokeninfo-endepunktet returnerer `aud == client_id` for access tokens utstedt via dette flowet — dette er empirisk verifisert atferd, ikke eksplisitt dokumentert garanti. Fail-closed-håndtering (fraværende eller feil `aud` → 403) håndterer all usikkerhet rundt dette.

```
1. Les Authorization: Bearer {access_token} fra header
2. → Google tokeninfo (3 sek timeout):
   GET https://www.googleapis.com/oauth2/v3/tokeninfo?access_token={access_token}
   Sjekk: token ikke utløpt + aud == GOOGLE_CLIENT_ID
3. → GitHub API (3 sek timeout):
   GET /repos/{owner}/{repo}/actions/runs
       ?workflow_id=deploy.yml&per_page=20
   Filtrer i Lambda: er noen kjøringer med status in_progress, queued eller waiting?
   (workflow_id=deploy.yml filtrerer til kun denne workflowen — samme konvensjon som GET /)
   Hvis ja → returner 200 + { already_running: true }
4. → GitHub API (3 sek timeout):
   POST /repos/{owner}/{repo}/dispatches
   body: { "event_type": "google_drive_update" }
5. ← 204 No Content = suksess → returner 200 + { started: true }
```

Response-body på 200 skiller mellom tilstandene:
- `{ started: true }` → "Bygg startet"
- `{ already_running: true }` → "Et bygg pågår allerede"

UI-koden sjekker alltid body på 200, ikke bare statuskode.

## Feilhåndtering

| Feil | Lambda-respons | UI-melding |
|---|---|---|
| Ugyldig/utløpt Google-token | 401 `{ error: "unauthorized" }` | "Sesjon utløpt, logg inn igjen" |
| Feil `aud` eller fraværende | 403 `{ error: "forbidden" }` | "Ikke autorisert" |
| GitHub dispatch-API feiler | 502 `{ error: "upstream_error" }` | "Bygg kunne ikke startes, prøv igjen" |
| Bygg allerede kjører | 200 `{ already_running: true }` | "Et bygg pågår allerede" |
| Token utløpt klient-side (før POST) | — | Sjekk `Date.now() < expiry - 60_000`; vis "Logg inn igjen" |
| Lambda-timeout / fetch-timeout | 502/504 fra AWS | "Bygg kunne ikke startes, prøv igjen" |
| Manglende env-var / konfigfeil | 500 `{ error: "configuration_error" }` | "Bygg kunne ikke startes, prøv igjen" |

**Ukjent misbruk:** POST-endepunktet er uautentisert på nettverksnivå — hvem som helst kan sende forespørsler. Disse vil få 401 etter Google tokeninfo-kallet. For et lavtrafikk admin-verktøy er dette en akseptert risiko uten ytterligere tiltak.

**TOCTOU-vindu i `already_running`-sjekk:** Det er et lite tidsvindu mellom steg 3 (sjekk aktive kjøringer) og steg 4 (dispatch) der en annen prosess kan starte et bygg. Resultatet er at to `repository_dispatch`-hendelser kan sendes nesten samtidig. For et admin-verktøy brukt av én-tre personer er dette en akseptert risiko.

## Sikkerhet

- **Google OAuth-laget:** Admin-appen er i Testing-modus med 3 eksplisitte test users. Ingen andre Google-kontoer kan autentisere seg via dette OAuth-klientet.
- **Lambda POST-validering:** Verifiserer `aud` i Google tokeninfo v3 mot `GOOGLE_CLIENT_ID`. Sikrer at tokenet er utstedt av vår app via GIS implicit flow.
- **Fail closed:** Lambda returnerer strukturert JSON 500 hvis env-variabler mangler — aldri fail open.
- **PAT-scope:** GitHub fine-grained PAT med kun `actions:write` på dette repositoryet.
- **CORS:** Konfigurert på Lambda Function URL via AWS CLI. Lambda-koden returnerer aldri CORS-headere selv.
- **Per-request timeouts:** 3 sekunder per HTTP-kall forhindrer at én treg tjeneste tømmer Lambda-timeoutet.

## Testing

Testverktøy: **Vitest** for både Lambda og admin-modul (konsistent med resten av prosjektet). Lambda-tester kjøres i Node-miljø (`@vitest-environment node`). Alle fetch-kall mockes.

### Lambda (Vitest/Node)

| Test | Hva verifiseres |
|---|---|
| Gyldig access token + korrekt `aud` → `{ started: true }` | Happy path POST |
| Utløpt token → 401 | Token-validering |
| Feil `aud` → 403 | Feil OAuth-klient avvises |
| Fraværende `aud` i tokeninfo → 403 | Robust aud-sjekk |
| Kjøring med status `in_progress` i siste 20 → `{ already_running: true }` | Duplikat-guard in_progress |
| Kjøring med status `queued` i siste 20 → `{ already_running: true }` | Duplikat-guard queued |
| GitHub dispatch-API feiler → 502 | Feilpropagering |
| `GET /` returnerer siste vellykkede bygg-tidspunkt | Status-endepunkt |
| `GET /` andre gang innen 60 sek → ikke nytt GitHub-kall | Cache-verifisering |
| `GET /` når ingen vellykkede kjøringer finnes → `{ timestamp: null, runId: null }` | Tom kjøringsliste |
| Manglende `GOOGLE_CLIENT_ID`-env-var → 500 med JSON-body | Fail-closed |
| Google tokeninfo-kall overskrider 3 sek → 502 | Per-request timeout |

### Admin-modul (Vitest, jsdom)

| Test | Hva verifiseres |
|---|---|
| Ingen token i storage → knapp deaktivert | Auth-guard |
| Token med `expiry` innen 60 sek → knapp deaktivert | Utløpt token (60 sek buffer) |
| Klikk → `access_token` fra storage sendes i Authorization-header | Riktig token-kilde |
| Klikk → spinner vises mens POST pågår | UI-tilstand |
| Respons `{ started: true }` → "Bygg startet"-melding i 5 sek | Suksess-feedback |
| Respons `{ already_running: true }` → "Et bygg pågår allerede" | Duplikat-feedback |
| 401-respons → "Sesjon utløpt, logg inn igjen" | Auth-feil |
| 502/504-respons → "Bygg kunne ikke startes, prøv igjen" | Nettverksfeil |
| `fetch()` kaster (nettverksfeil, URL utilgjengelig) → feilmelding vises | Fetch-avvisning |
| GET returnerer `{ timestamp: null }` → vis "Ingen bygg ennå" | Tom status |
| Dashboard-innlasting → GET kalles og tidspunkt vises | Status-henting |

## Infrastrukturkrav

AWS CLI installeres lokalt som del av implementasjonsplanen for å opprette Lambda og IAM-rolle via kommandolinje. GitHub PAT opprettes manuelt av bruker og legges inn som Lambda-miljøvariabel.

## Utestående TODO

- **Sjekk admin-token på hele admin-siden** — ikke bare for "Bygg nå"-knappen. Gjennomgang av eksisterende auth-flyt: verifiser at tokenet faktisk er gyldig (ikke bare at det finnes i localStorage), og vurder periodisk revalidering. Legges til som egen backlog-oppgave.
