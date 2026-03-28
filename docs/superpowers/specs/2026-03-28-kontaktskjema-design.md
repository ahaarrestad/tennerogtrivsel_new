# Design: Kontaktskjema

**Dato:** 2026-03-28
**Status:** Godkjent

## Oversikt

Et kontaktskjema som åpnes i en modal fra kontaktsiden. Brukeren fyller ut tema, navn, telefon, e-post og melding. Innsendingen sendes som e-post til klinikken via AWS Lambda + SES. Innhold og tema-liste administreres av klinikken via Google Sheet og admin-panelet.

---

## Seksjon 1 — Frontend

### Komponenter

- **`ContactModal.astro`** — modal-wrapper med overlay, bruker native `<dialog>`-element (god a11y, ESC-støtte, lukkes ved klikk utenfor)
- **`ContactForm.astro`** — selve skjemaet, rendres inne i modalen
- **`ContactButton.astro`** — knapp på kontaktsiden som åpner modalen. Rendres kun når `aktiv === true` i `kontaktskjema.json` — ingen knapp, ingen modal i DOM når deaktivert.

### Skjemafelt

| Felt | Type | Attributter |
|------|------|-------------|
| Tema | `<select>` | Verdier fra `kontaktskjema.json` |
| Navn | `<input type="text">` | `autocomplete="name"`, required |
| Telefon | `<input type="tel">` | `autocomplete="tel"`, `inputmode="tel"` |
| E-post | `<input type="email">` | `autocomplete="email"`, required |
| Melding | `<textarea>` | `field-sizing: content`, `resize: vertical`, min 3 linjer |
| GDPR | `<input type="checkbox">` | Lenke til `/personvern`, required |
| Honeypot | `<input type="text">` | Skjult via CSS, ikke `display:none` (bots ser det) |

### Tilstandsmaskin

```
idle → submitting → success
                 → error (retry mulig)
```

- `submitting`: spinner på send-knapp, alle felt deaktivert
- `success`: bekreftelsesmelding vises i modalen
- `error`: feilmelding med mulighet til å prøve igjen

### Responsiv oppførsel

- **Desktop (≥768px):** Sentrert modal, maks 480px bred, navn og telefon side om side, scrollbar internt om innholdet er høyt
- **Mobil (<768px):** Bunnark (bottom sheet) som glir opp fra bunnen, `border-radius` øverst, drag-indikator øverst, alle felt i én kolonne

### Plassering

Knapp på eksisterende `/kontakt`-side. Ingen knapp på andre sider.

### Data

- `kontaktskjema.json` synkroniseres fra Sheets ved bygg
- Tittel, tekst og tema-liste leses fra denne filen
- Mottaker-e-post finnes **ikke** i denne filen — kun i Lambda-miljøvariabel

---

## Seksjon 2 — Backend (Lambda + SES)

### Anropsarkitektur

```
Nettleser → POST /api/kontakt (CloudFront)
              ↓ CloudFront legger til X-Origin-Verify: <secret>
            Lambda Function URL
              ↓ Lambda verifiserer header
            SES → klinikkens e-post
```

Lambda Function URL er ikke eksponert i frontend-koden. Nettleseren kaller kun `/api/kontakt` på samme domene (CloudFront-path). CloudFront videresender til Lambda og injiserer origin-secret-header automatisk.

### CloudFront-konfigurasjon

- Ny origin i CloudFront-distribusjonen: Lambda Function URL
- Ny cache behaviour: `POST /api/kontakt` → Lambda-origin (cache deaktivert, all-viewer origin request policy)
- Origin custom header: `X-Origin-Verify: <ORIGIN_VERIFY_SECRET>` — legges til alle requests til Lambda-origin

### Lambda-funksjon: `kontakt-form-handler`

- **Trigger:** Lambda Function URL (auth mode: `NONE` — sikres via origin secret i stedet)
- **Runtime:** Node.js 22
- **Reserved concurrency:** 5

### Request-flyt

1. Verifiser `X-Origin-Verify`-header → avvis med `403` om feil eller mangler
2. Sjekk honeypot-felt → avvis stille (`200 OK`) om fylt ut
3. Valider alle felt (required, e-postformat, maks lengde på tekst)
4. Rate limiting via DynamoDB: maks 3 innsendinger per IP per 10 min
5. Sanitér input
6. Send e-post via SES

### E-postformat

```
Fra:      noreply@tennerogtrivsel.no  (SES-verifisert domene)
Til:      [KONTAKT_MOTTAKER_EPOST fra miljøvariabel]
Svar-til: [brukerens e-post]
Emne:     Kontaktskjema: [tema]
Kropp:
  Tema:    [tema]
  Navn:    [navn]
  Telefon: [telefon]
  E-post:  [epost]

  [melding]
```

### Rate limiting — DynamoDB

- Tabell: `kontakt-rate-limit`
- Key: IP-adresse
- Attributter: `count`, `ttl` (Unix timestamp + 600s)
- Innenfor gratisnivå (25 GB, 25 RCU/WCU)

### Kostnadskontroll

- AWS Budget-varsel ved $1/mnd (gratis)
- SES daily sending quota: 200 e-poster/dag
- Lambda reserved concurrency: 5

---

## Seksjon 3 — Google Sheets, Admin og CI/CD

### Ny Sheets-fane: `KontaktSkjema`

| Nøkkel | Eksempelverdi |
|--------|---------------|
| `aktiv` | ja |
| `tittel` | Ta kontakt med oss |
| `tekst` | Vi svarer vanligvis innen én arbeidsdag. |
| `kontaktEpost` | resepsjon@tennerogtrivsel.no |
| `tema` | Timebooking |
| `tema` | Spørsmål om behandling |
| `tema` | Priser |
| `tema` | Annet |

`tema`-rader kan ha så mange rader som ønskelig. Rekkefølgen i arket er visningsrekkefølgen.

### Synkronisering (`sync-data.js`)

Ny sync-funksjon leser `KontaktSkjema`-fanen og skriver `src/content/kontaktskjema.json`:

```json
{
  "aktiv": true,
  "tittel": "Ta kontakt med oss",
  "tekst": "Vi svarer vanligvis innen én arbeidsdag.",
  "tema": ["Timebooking", "Spørsmål om behandling", "Priser", "Annet"]
}
```

`kontaktEpost` skrives **ikke** til JSON-filen. `aktiv` skrives som boolsk (`"ja"` → `true`).

### CI/CD — oppdatering av Lambda-miljøvariabel

Nytt steg i GitHub Actions workflow (etter sync, før bygg):

1. Les `kontaktEpost` fra `KontaktSkjema`-fanen via Sheets API
2. Kall `aws lambda update-function-configuration` med oppdaterte env vars: `KONTAKT_MOTTAKER_EPOST` og `ORIGIN_VERIFY_SECRET`
3. Kall `aws cloudfront update-distribution` for å synkronisere `X-Origin-Verify`-origin-headeren med samme secret
4. Vent på at Lambda-oppdateringen er ferdig (`aws lambda wait function-updated`) før bygget fortsetter

**GitHub Secrets som kreves:**
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` — eksisterer allerede
- `LAMBDA_KONTAKT_ARN` — ARN til `kontakt-form-handler`
- `CLOUDFRONT_DISTRIBUTION_ID_PROD` — eksisterer allerede
- `ORIGIN_VERIFY_SECRET` — ny, settes én gang manuelt, roteres ved behov

### Admin-blokk: "Kontaktskjema"

Ny blokk i admin-dashboardet med to seksjoner:

**Seksjon: Modal-innhold**
- Toggle/avkrysning øverst: *"Vis kontaktskjema på siden"* — samme toggle-mønster (`renderToggleHtml`) som brukes i Tjenester og Bilder. Skjuler knapp og modal på nettsiden når deaktivert.
- Felt for tittel (autosave ved blur)
- Felt for tekst (textarea, autosave ved blur)
- Felt for mottaker-e-post (autosave ved blur) med note: *"Sendes ikke til nettsiden — synkroniseres til Lambda ved neste bygg"*

**Seksjon: Tema-liste**
- Én rad per tema med redigerbart tekstfelt
- ▲/▼-piler alltid synlige til høyre (samme `animateSwap`-mønster som Tjenester og Bilder)
- Øverste rad: opp-pil skjult. Nederste rad: ned-pil skjult
- Legg til-knapp med + ikon (samme mønster som resten av admin)
- Ved klikk: tom inputrad vises med "Opprett" + "Avbryt" (`admin-btn-cancel`) — samme mønster som Prisliste og Meldinger
- Slett-knapp: rødlig søppelspann med bekreftelsesdialog (samme mønster som resten av admin)

---

## Seksjon 4 — Personvernerklæring

`personvern.astro` får et nytt avsnitt:

- **Hva samles inn:** navn, e-post, telefon, melding og tema
- **Formål:** besvare henvendelser fra besøkende
- **Grunnlag:** samtykke (avkrysning i skjemaet)
- **Lagringstid:** overføres på e-post og lagres i klinikkens e-postarkiv
- **Databehandler:** AWS SES brukes for e-postutsending
- **Rettigheter:** innsyn, retting, sletting og klage til Datatilsynet

---

## Sikkerhet

**Lag 1 — CloudFront origin secret**
CloudFront injiserer `X-Origin-Verify: <secret>` på alle requests til Lambda. Lambda avviser med `403` uten korrekt header. Lambda Function URL er ikke kjent for omverdenen — kun CloudFront-pathen `/api/kontakt` er eksponert.

**Lag 2 — Honeypot**
Skjult felt i skjemaet. Lambda avviser stille (`200 OK`) om feltet er fylt ut — avslører ikke at det ble oppdaget.

**Lag 3 — Rate limiting**
DynamoDB-tabell med IP + TTL. Maks 3 innsendinger per IP per 10 min.

**Lag 4 — Ressursbegrensning**
Lambda reserved concurrency (5) og SES daily quota (200/dag) setter harde tak på volum selv ved angrep.

**Øvrig:**
- Mottaker-e-post aldri eksponert i frontend-kode eller JSON
- Input validering og sanitering i Lambda
- AWS Budget-varsel ved $1/mnd
- `ORIGIN_VERIFY_SECRET` roteres ved å oppdatere én GitHub Secret — CI/CD synkroniserer til CloudFront og Lambda

### Kjent begrensning

`/api/kontakt` er et offentlig CloudFront-endepunkt — hvem som helst kan sende POST-requests til det direkte (CORS gjelder kun nettlesere, ikke bots eller `curl`). Det finnes ingen praktisk måte å begrense dette til kun nettstedets egne brukere på for en statisk side uten tredjepartstjeneste.

Konsekvensen er akseptabel for dette bruksområdet: selv ved misbruk er maksimal skade 200 e-poster/dag og 3 per IP per 10 min. AWS Budget varsler ved $1. Hvis spam blir et reelt problem i fremtiden, kan Cloudflare Turnstile legges til.

## Ikke i scope

- Lagring av innsendinger i Google Sheet (kun e-post)
- Kontaktknapp på andre sider enn `/kontakt`
- Cloudflare Turnstile eller annen ekstern CAPTCHA (kan legges til senere ved behov)
- HMAC-token for kaller-verifisering — krever enten rebuild hver time eller et ekstra token-endepunkt, begge deler upraktisk for en statisk side
- Varsel om at e-post er oppdatert i Lambda (skjer automatisk ved bygg)
