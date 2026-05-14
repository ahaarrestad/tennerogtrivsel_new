# Helhetlig sikkerhetsgjennomgang — Implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjennomfør en streng, systematisk gjennomgang av hele prosjektets angrepsflate — kode, GitHub, AWS og Google — og dokumenter funn med alvorlighetsgrad. Diskuter funn med bruker etter hvert domene. Ingen tiltak iverksettes uten godkjenning.

**Architecture:** Fire domenegjennomganger (GitHub, AWS, Google, admin-panel) + ett tverrgående sammendrag. Hvert domene avsluttes med en funn-liste som presenteres og diskuteres med bruker. Planen produserer til slutt en prioritert tiltaksliste.

**Tech Stack:** GitHub Actions, AWS (IAM, S3, Lambda, CloudFront, DynamoDB, SES), Google (OAuth 2.0, Sheets API, Drive API, Cloud Console), Node.js/Astro.

---

## Nåsituasjon — hva er allerede gjort (2026-04-28-auditen)

| # | Funn | Status |
|---|------|--------|
| F1 | Dependabot cooldown 3/7/30 dager, security-advisory manuell review | ✅ Ferdig |
| F2 | CSP → CloudFront Response Headers Policy | ✅ Ferdig |
| F3 | XSS i `formatInfoText` | ✅ Ferdig |
| F4 | SHA-pin GitHub Actions | ❌ **Ikke gjort** |
| F5 | Begrens `MY_GITHUB_PAT` blast-radius | ❌ Utsatt |
| F6 | Admin-token → sessionStorage + rememberMe | ✅ Ferdig |
| F7 | `unsafe-inline` → SHA256-hashes i CSP | ✅ Ferdig |
| F8 | Permissions-Policy, HSTS, COOP/COEP | ✅ Ferdig |
| F9 | `npm audit signatures` + critical-gate i CI | ✅ Ferdig |
| F10 | `PUBLIC_GOOGLE_API_KEY` HTTP referrer-restricted? | ❌ Ikke verifisert |
| F11 | `repository_dispatch` hopper over unit/E2E-tester | ❌ Ikke fikset |
| F12 | `innerHTML`-template-strings i admin uten sanitering | ❌ Ikke gjort |

Denne planen dekker **NYE** funn pluss F4, F5, F10, F11, F12 som gjenstår.

---

## Viktige avklaringer for utfører

**Hva Claude kan gjøre:** Lese kode, kjøre CLI-kommandoer (`aws`, `gh`, `grep`), analysere konfigurasjonsfiler.

**Hva krever brukerens tilgang:**
- AWS Console / AWS CLI med riktig profil (IAM-policy detaljer, CloudTrail-status, Lambda execution role, SES-status)
- Google Cloud Console (API-nøkkel restriksjoner, OAuth client URIs, service account scopes)
- GitHub.com innstillinger (branch protection, PAT scopes)

Der brukerens tilgang kreves: planen gir eksakte kommandoer og hva som er forventet output. Brukeren kjører og rapporterer.

---

## Task 1: GitHub Actions og supply chain-gjennomgang

**Mål:** Kartlegg eksponering i CI/CD-pipelinen — hva kan en angriper oppnå ved å kompromittere en action, en PR, eller et npm-pakke?

**Filer:** `.github/workflows/deploy.yml`, `auto-pr.yml`, `dependabot-auto-merge.yml`, `codeql.yml`, `.github/dependabot.yml`

- [ ] **Steg 1.1: SHA-pinning — status og gap**

  Kjør:
  ```bash
  grep -rn "uses:" .github/workflows/ | grep -v "^Binary" | grep -v node_modules
  ```

  For hvert funn, dokumenter:
  - Er det pinnet til SHA? (format: `actions/checkout@b4ffde65...  # v4`)
  - Er det pinnet til en mutable tag? (format: `actions/checkout@v6`) → **FUNN**
  - Er det inkonsistens på tvers av workflows (f.eks. `checkout@v4` i noen, `@v6` i andre)?

  Forventet status basert på gjennomlesning: alle `@vN`-tagger, ingen SHA-pinning. Det er F4 fra forrige audit — bekreft og dokumenter eksakt hvilke actions og versjoner.

- [ ] **Steg 1.2: `GITHUB_TOKEN`-permissions per workflow**

  Gå gjennom hvert workflow og dokumenter:

  ```
  deploy.yml:         permissions: contents:read, pages:write, id-token:write
  auto-pr.yml:        permissions: contents:write, pull-requests:write
  dependabot-auto-merge.yml: permissions: contents:write, pull-requests:write
  codeql.yml:         permissions: actions:read, contents:read, security-events:write
  ```

  Vurder: er `pages: write` i deploy.yml nødvendig? (Prosjektet deployer til S3, ikke GitHub Pages.) Er `id-token: write` nødvendig? Det er nødvendig for OIDC-autentisering mot AWS — men vi bruker ikke OIDC, vi bruker lange `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. → **Mulig FUNN: unødvendig id-token:write i deploy.yml**

- [ ] **Steg 1.3: `MY_GITHUB_PAT` — scope og eksponering**

  Fra kodelesning: PAT brukes i `auto-pr.yml` (PR-opprettelse, auto-merge) og `dependabot-auto-merge.yml` (godkjenning, merge, kommentarer).

  Brukeren må sjekke PAT-scope på `github.com/settings/tokens`:
  - Er det en classic PAT eller fine-grained?
  - Hvilke scopes er aktivert?
  - Hvem er token-eier?
  - Har den expiry-dato?

  **Hva vi leter etter:**
  - Ingen expiry → **FUNN**
  - Classic PAT med `repo` (full repo-tilgang) → **FUNN** (burde være fine-grained med kun `contents:write` + `pull-requests:write`)
  - Tilgang til andre repos enn dette ene → **FUNN**

- [ ] **Steg 1.4: Forked PR-isolasjon**

  Verifiser at hemmeligheter ikke eksponeres i PRer fra forks:

  ```bash
  grep -n "fork" .github/workflows/deploy.yml
  ```

  Forventet: `pull_request.head.repo.fork != true` i `unit-tests` og `e2e-tests`. Bekreft at dette faktisk hindrer secret-eksponering. (Merk: `e2e-tests` bruker mange secrets — hvis fork-sjekken mangler er det kritisk.)

  Sjekk også `auto-pr.yml`: trigger er `push: branches: review/**` — kan en ekstern aktør pushe til en `review/`-branch? Svar: nei, bare de med write-tilgang til repoet. OK.

- [ ] **Steg 1.5: `repository_dispatch` — hvem kan trigge den?**

  `deploy.yml` lytter på `repository_dispatch: types: [google_drive_update]`. Dette triggeret kan kun sendes via GitHub API med et token som har `contents:write`. Fra koden finnes ingen `repository_dispatch`-sender i dette repoet ennå (det er en del av «Bygg nå»-backlog-oppgaven, ikke implementert).

  Verifiser: finnes det noe i Lambda-koden eller andre steder som sender `repository_dispatch`?

  ```bash
  grep -rn "repository_dispatch" . --exclude-dir={node_modules,.worktrees,.claude}
  ```

  Hvis ingenting sender det: trigger er harmløs men unødvendig overhead. Vurder om den burde fjernes til «Bygg nå»-oppgaven er implementert.

- [ ] **Steg 1.6: `dependabot.yml` — github-actions ecosystem mangler**

  Fra kodelesning: `dependabot.yml` dekker kun `npm` (root + lambda). Task 2.3 fra forrige plan (github-actions ecosystem) er ikke implementert.

  ```bash
  cat .github/dependabot.yml
  ```

  Bekreft: mangler `package-ecosystem: github-actions`. → **FUNN** (SHA-pinning uten Dependabot-oppdatering er statisk og vil bli utdatert)

- [ ] **Steg 1.7: CodeQL-konfigurasjon — er den god nok?**

  Fra kodelesning: CodeQL er aktivert, ekskluderer `node_modules`, `dist`, `tests`, `__tests__`, `coverage`. Kjøres på push til main, PRer mot main, og ukentlig schedule.

  Vurder:
  - Ekskluderer `tests` og `__tests__` — er dette riktig? Testfiler kan avsløre svakheter (hardkodet credentials i test-fixtures, prototype pollution i test-helpers).
  - Dekker CodeQL lambda-koden? (`lambda/kontakt-form-handler/index.mjs`)
  - Kjøres CodeQL på `scripts/`-mappen?

  ```bash
  grep -A5 "paths-ignore" .github/workflows/codeql.yml
  ```

- [ ] **Steg 1.8: auto-pr.yml — auto-merge uten test-krav?**

  Fra kodelesning: `auto-pr.yml` enabler auto-merge for `github.actor == 'ahaarrestad'`. Dette setter opp auto-merge som vil fyres når required checks er grønne.

  Spørsmål: er det satt opp **required checks** på main-branchen? Uten required checks vil auto-merge merge umiddelbart etter PR-opprettelse.

  Brukeren sjekker: GitHub → Settings → Branches → main → Protection rules → Required status checks.

  **Hva vi leter etter:** Ingen required checks → auto-merge kan kjøre uten at tester er grønne → **FUNN**

- [ ] **Steg 1.9: Presenter funn fra Task 1 og diskuter**

  Lag en strukturert funn-liste:
  ```
  ## Task 1: GitHub Actions — funn
  | # | Alvorlighet | Funn | Anbefaling |
  ```
  Presenter for bruker. Vent på tilbakemelding før Task 2 starter.

---

## Task 2: AWS IAM og least-privilege

**Mål:** Kartlegg hvilke AWS-tillatelser som er i bruk, om de er for brede, og om de kan misbrukes.

**Avhengighet:** Krever AWS CLI med riktig profil.

- [ ] **Steg 2.1: Identifiser CI-brukeren**

  Brukeren kjører:
  ```bash
  aws sts get-caller-identity
  ```
  Forventet: AccountId `382286755083`, en IAM-user (ikke en role). Noter UserId og ARN.

  Deretter:
  ```bash
  aws iam get-user --user-name <username-fra-ARN>
  aws iam list-attached-user-policies --user-name <username>
  aws iam list-user-policies --user-name <username>
  aws iam list-groups-for-user --user-name <username>
  ```

  **Hva vi leter etter:**
  - `AdministratorAccess` eller `PowerUserAccess` → **KRITISK**
  - `AmazonS3FullAccess` (alle buckets) i stedet for bare de to prosjekt-bucketene → **FUNN**
  - Ingen MFA på IAM-user → **FUNN** (MFA er ikke i bruk i programmatisk tilgang, men sjekk om konsolltilgang er aktivert)
  - IAM-user i stedet for OIDC-basert GitHub Actions identity → **FUNN** (langt-levende credentials vs. kortlevende OIDC-tokens)

- [ ] **Steg 2.2: Access key-alder**

  Brukeren kjører:
  ```bash
  aws iam list-access-keys --user-name <username>
  ```

  **Hva vi leter etter:**
  - `CreateDate` eldre enn 90 dager → **FUNN** (CIS benchmark anbefaler rotasjon hvert 90. dag)
  - Mer enn én aktiv access key → **FUNN**

- [ ] **Steg 2.3: Lambda execution role**

  Brukeren kjører:
  ```bash
  aws lambda get-function-configuration \
    --function-name <LAMBDA_KONTAKT_ARN> \
    --region eu-north-1 \
    --query 'Role'
  ```

  Deretter sjekk policies på execution role:
  ```bash
  aws iam get-role --role-name <rolle-navn>
  aws iam list-attached-role-policies --role-name <rolle-navn>
  aws iam list-role-policies --role-name <rolle-navn>
  ```

  **Hva vi leter etter (ideell Lambda-rolle):**
  - `dynamodb:GetItem` og `dynamodb:PutItem` på kun `kontakt-rate-limit`-tabellen — ikke bredere DynamoDB-tilgang
  - `ses:SendEmail` med `Condition: StringEquals: ses:FromAddress: noreply@aarrestad.com` — ikke bredere SES-tilgang
  - Ingen S3, CloudFront, IAM, eller andre tillatelser
  - Minimal `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` (standard Lambda)
  - Bredere tilganger enn dette → **FUNN**

- [ ] **Steg 2.4: CloudTrail — er det aktivert?**

  Brukeren kjører:
  ```bash
  aws cloudtrail describe-trails --region eu-north-1
  aws cloudtrail get-trail-status --name <trail-name> --region eu-north-1
  ```

  **Hva vi leter etter:**
  - Ingen CloudTrail → **FUNN** (ingen audit log av hvem som gjør hva i AWS)
  - CloudTrail deaktivert → **FUNN**
  - CloudTrail aktivert men kun management events (ikke data events for S3/Lambda) → notat

- [ ] **Steg 2.5: OIDC vs. langt-levende credentials**

  GitHub Actions støtter OIDC-basert autentisering mot AWS (ingen langt-levende credentials lagres som Secrets). Vurder:

  **Nåsituasjon:** `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` lagret som GitHub Secrets. Disse er langt-levende — kompromittering av GitHub-repoet = kompromittering av AWS.

  **OIDC-alternativet:** GitHub Actions genererer et kortlevende JWT per workflow-run. AWS verifiserer dette mot GitHub sin OIDC-provider. Ingen secrets i GitHub. Credentials lever kun i workflow-runnen (~15 min).

  Dette er et arkitektur-funn som krever diskusjon: **FUNN — anbefaler migrering til OIDC**

- [ ] **Steg 2.6: Presenter funn fra Task 2 og diskuter**

  Funn-liste som i Task 1. Presenter og vent på tilbakemelding.

---

## Task 3: AWS services — S3, Lambda, DynamoDB, SES, CloudFront

**Mål:** Verifiser at AWS-tjenestene er riktig herdet: ingen utilsiktet offentlig tilgang, kryptering, logging, og at Lambda-koden ikke har security-svakheter.

- [ ] **Steg 3.1: S3 — public access block verifisering**

  Brukeren kjører for begge buckets:
  ```bash
  aws s3api get-public-access-block --bucket tennerogtrivsel-se --region eu-north-1
  aws s3api get-public-access-block --bucket test2.aarrestad.com-se --region eu-north-1
  ```

  Forventet (fra `setup-s3.mjs`):
  ```json
  {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }
  ```

  **Hva vi leter etter:** Noen av disse er `false` → **KRITISK**

- [ ] **Steg 3.2: S3 — versjonering og logging**

  Brukeren kjører:
  ```bash
  aws s3api get-bucket-versioning --bucket tennerogtrivsel-se --region eu-north-1
  aws s3api get-bucket-logging --bucket tennerogtrivsel-se --region eu-north-1
  ```

  **Hva vi leter etter:**
  - Ingen versjonering: ikke et kritisk funn for statisk site, men uten versjonering kan en misfired `aws s3 sync --delete` slette alt uten mulighet til gjenoppretting → **notat**
  - Ingen access logging → **notat** (hvem laster ned hva er ikke loggbart)

- [ ] **Steg 3.3: Lambda — Function URL autentisering**

  Lambda-funksjonen eksponeres via en Function URL. Brukeren kjører:
  ```bash
  aws lambda get-function-url-config \
    --function-name <LAMBDA_KONTAKT_ARN> \
    --region eu-north-1
  ```

  **Hva vi leter etter:**
  - `AuthType: NONE` → Lambda er offentlig tilgjengelig. Dette er OK gitt at vi bruker `x-origin-verify`-header, men betyr at:
    - Rate-limiter i Lambda er eneste DoS-beskyttelse
    - Direkte anrop til Lambda-URL fra hvem som helst er mulig
  - Er CORS konfigurert? (`Cors`-felt i output) — `AllowOrigins` burde ikke være `*`
  - **FUNN: ingen WAF foran Lambda** (kun `x-origin-verify` beskytter)

- [ ] **Steg 3.4: Lambda — kodegjennomgang**

  Les `lambda/kontakt-form-handler/index.mjs` (allerede lest, analyser):

  Sjekkliste:
  - `ORIGIN_VERIFY_SECRET`: hentes fra env-var, brukes med `timingSafeEqual` via SHA256-hash → ✅ korrekt konstant-tid sammenligning
  - IP-henting: `event.requestContext?.http?.sourceIp || event.headers?.['x-forwarded-for']` — Lambda Function URL setter alltid `requestContext.http.sourceIp`, så `x-forwarded-for`-fallback er for Lambda bak ALB. **Er det mulig å spofe IP via `x-forwarded-for` i praksis?** Kun hvis `requestContext.http.sourceIp` er `undefined`. Med direkte Function URL er den alltid satt → OK.
  - `sanitize()` og `sanitizeBody()`: fjerner kontrollkarakterer → ✅
  - `validatePayload()`: sjekker felt-lengder, enkel e-post-regex → Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` er liberal men OK for enkel validering (vi sender til SES, ikke tolker e-post-semantikk)
  - Honeypot: `website`-felt → ✅
  - Rate limiting: 3 forsøk per 600 sekunder per IP → rimelig
  - DynamoDB-feil ignoreres med `console.error` — rate-limit omgås ved DynamoDB-utilgjengelighet → **notat** (akseptabelt trade-off for kontaktskjema)
  - `ReplyToAddresses: [sanitize(epost, 254)]` — brukerens e-post settes som Reply-To. Kan dette misbrukes til phishing/spam? Vurder.
  - Ingen `Content-Security-Policy`-header i Lambda-respons (ikke nødvendig — JSON API)
  - **FUNN: Lambda-koden avslører ingen interne feil til klienten** (500-melding er generisk) → ✅ OK

- [ ] **Steg 3.5: DynamoDB — kryptering og TTL**

  Brukeren kjører:
  ```bash
  aws dynamodb describe-table --table-name kontakt-rate-limit --region eu-north-1
  ```

  **Hva vi leter etter:**
  - `SSEDescription.Status`: `ENABLED` (kryptering at rest) → forventet ja (AWS default)
  - `TimeToLiveDescription.TimeToLiveStatus`: `ENABLED` → ellers vil rate-limit-poster hope opp evig (**FUNN**)
  - `BillingModeSummary.BillingMode`: `PAY_PER_REQUEST` eller `PROVISIONED` — sjekk at det ikke er unødvendig dyrt

- [ ] **Steg 3.6: SES — sandbox-status og sending-konfigurasjoner**

  Brukeren kjører:
  ```bash
  aws sesv2 get-account --region eu-north-1
  aws sesv2 list-email-identities --region eu-north-1
  ```

  **Hva vi leter etter:**
  - `SendingEnabled: false` → SES i sandbox, kan kun sende til verifiserte adresser → **FUNN** (hvis site er i produksjon men SES er i sandbox, fungerer ikke kontaktskjema for ikke-verifiserte mottakere)
  - Verifiserte domener: `aarrestad.com` — er det verifisert med DKIM/SPF/DMARC?
  - `EnforcementStatus`: noe annet enn `HEALTHY` → **FUNN**
  - Sending limits (DailyMax, MaxSendRate) — rimelige for kontaktskjema

- [ ] **Steg 3.7: CloudFront — WAF og logging**

  Brukeren sjekker i AWS Console for prod-distribusjonen (`E9Z51DQB2K1G4`):
  - Er WAF (Web Application Firewall) aktivert? → Uten WAF: DDoS, bot-trafikk og SQL/XSS-forsøk når rett gjennom til S3/Lambda.
  - Er Access logging aktivert?
  - Er Standard logging aktivert?
  - `MinimumProtocolVersion` for viewer connections: bør være `TLSv1.2_2021` eller nyere.

  Brukeren kjører:
  ```bash
  aws cloudfront get-distribution --id E9Z51DQB2K1G4 \
    --query 'Distribution.DistributionConfig.[WebACLId,Logging,ViewerCertificate.MinimumProtocolVersion]'
  ```

  **Hva vi leter etter:**
  - `WebACLId`: tom streng → ingen WAF → **FUNN**
  - `Logging.Enabled: false` → ingen access-log → **notat**

- [ ] **Steg 3.8: `ORIGIN_VERIFY_SECRET` — styrke og alder**

  Hemmeligheten er i GitHub Secrets og Lambda env-var. Vi kan ikke lese den, men:
  - Brukeren bekrefter: ble den generert med `openssl rand -base64 32` (eller tilsvarende) eller er den et svakt passord?
  - Når ble den sist rotert?

  **Hva vi leter etter:**
  - Svak hemmelighet (ord, dato, kort streng) → **KRITISK**
  - Aldri rotert → **FUNN** (bør roteres hvert år)

- [ ] **Steg 3.9: Presenter funn fra Task 3 og diskuter**

---

## Task 4: Google Cloud-gjennomgang

**Mål:** Verifiser at Google-integrasjonene er riktig konfigurert med minste nødvendige tillatelse.

**Avhengighet:** Krever tilgang til Google Cloud Console (`console.cloud.google.com`).

- [ ] **Steg 4.1: `PUBLIC_GOOGLE_API_KEY` — restriksjoner**

  Brukeren åpner Google Cloud Console → APIs & Services → Credentials → velg API-nøkkelen.

  **Hva vi leter etter:**
  - Application restrictions: `HTTP referrers` → verifiser at kun `https://tennerogtrivsel.no/*` (og evt. `https://test2.aarrestad.com/*`) er whitelistet. Ingen restriks → **KRITISK** (nøkkelen kan brukes fra hvem som helst til å gjøre Drive-kall på vår kvote)
  - API restrictions: kun de API-ene som faktisk brukes (Drive thumbnails?) → bredere enn nødvendig → **FUNN**
  - Kvota-begrensning per dag → ikke satt → **notat**

- [ ] **Steg 4.2: OAuth 2.0 Client — redirect URIs og autoriserte domener**

  Brukeren åpner Google Cloud Console → APIs & Services → Credentials → velg OAuth 2.0 Client.

  **Hva vi leter etter:**
  - Authorized JavaScript origins: inneholder det domener som ikke lenger er i bruk? → **FUNN**
  - Authorized redirect URIs: inneholder det noen rare URIer? → **FUNN**
  - Er test2.aarrestad.com registrert her? Bør det være det?
  - Publishing status: er appen i `Testing` (kun godkjente testbrukere) eller `In production`? For et admin-panel med én bruker er `Testing` tryggere (begrenser hvem som kan autentisere mot appen)

- [ ] **Steg 4.3: Service account — scopes og key-alder**

  Service account-nøkkelen (`GOOGLE_PRIVATE_KEY` i GitHub Secrets) brukes av CI til å lese data fra Sheets/Drive for å bygge siten.

  Brukeren åpner Google Cloud Console → IAM & Admin → Service Accounts → finn service accounten.

  **Hva vi leter etter:**
  - Hvilke roller har service accounten i Google Cloud IAM? (bør ikke ha noen utover det som gis via Sheets/Drive sharing)
  - Har Sheets/Drive-dokumentene delt tilgang med service account? Hvilken rolle? (Viewer er minimum, Editor er for mye for en read-only sync)
  - Key-alder: Google Cloud Console → Service Accounts → velg account → Keys-tab. Ser du `Created`-dato? Eldre enn ett år → **FUNN**
  - Er det mer enn én aktiv key? → **FUNN**

- [ ] **Steg 4.4: Google Sheets/Drive — hvem ellers har tilgang?**

  Spørsmål til bruker: Er Google Sheets-dokumentet og Drive-mappene kun delt med service accounten, eller med andre Google-kontoer?

  **Hva vi leter etter:**
  - Dokumentet er åpent for «alle med lenken» → **KRITISK** (CMS-data er offentlig)
  - Andre brukere med Editor-tilgang → **notat** (hvem kan endre CMS-innhold?)

- [ ] **Steg 4.5: Google Cloud — aktive API-er**

  Brukeren kjører:
  ```bash
  gcloud services list --enabled --project=<prosjekt-id>
  ```

  **Hva vi leter etter:** Er det API-er aktivert som ikke brukes? Unødvendige API-er øker angrepsflaten.

- [ ] **Steg 4.6: Presenter funn fra Task 4 og diskuter**

---

## Task 5: Admin-panel og autentiseringsflyt

**Mål:** Verifiser at admin-autentiseringen er korrekt implementert, at tilgangskontrollen er tilstrekkelig, og kartlegg gjenstående XSS-risiko.

**Filer:** `src/scripts/admin-auth.js`, `src/scripts/admin-client.js`, `src/pages/admin/index.astro`, alle `admin-module-*.js`

- [ ] **Steg 5.1: Autentisering vs. autorisasjon — hvem kan logge inn?**

  Les `src/scripts/admin-auth.js`:
  ```bash
  grep -n "hd\|allowed\|email\|domain\|authorize" src/scripts/admin-auth.js | head -30
  ```

  **Kritisk spørsmål:** Sjekker autentiseringsflyten at det er EN SPESIFIKK bruker (e-postadresse) som logger inn, eller aksepterer den ALLE Google-kontoer?

  **Hva vi leter etter:**
  - Ingen e-post/domain-sjekk på den autentiserte brukeren → **KRITISK** (alle med en Google-konto kan logge inn som admin)
  - `hd`-parameter satt til en Google Workspace-domene → sjekk at dette faktisk begrenser tilgang

- [ ] **Steg 5.2: sessionStorage — korrekt implementasjon**

  Verifiser at token-flyten etter Task 7 er korrekt:
  ```bash
  grep -n "sessionStorage\|localStorage" src/scripts/admin-auth.js
  ```

  **Hva vi leter etter:**
  - OAuth-token lagres i `localStorage` → **KRITISK** (Task 7 skal ha fikset dette — verifiser)
  - `rememberMe`-flagg i `localStorage` er et boolsk flagg (ikke token) → OK
  - Token-expiry håndtert korrekt (refresh før expiry)?

- [ ] **Steg 5.3: admin-client.js — bruker den riktig auth-header?**

  ```bash
  grep -n "Authorization\|Bearer\|token" src/scripts/admin-client.js | head -20
  ```

  Verifiser at API-kall til Google Sheets/Drive bruker token fra sessionStorage, ikke hardkodet eller fra localStorage.

- [ ] **Steg 5.4: `innerHTML`-audit (F12 fra forrige plan)**

  ```bash
  grep -rn "innerHTML\s*=" src/scripts/ | grep -v __tests__ | grep -v "\.test\." | wc -l
  ```

  Deretter, tell risikable treff (med template-literal interpolasjon):
  ```bash
  grep -rn "innerHTML\s*=\s*\`" src/scripts/ | grep -v __tests__ | grep '\${'
  ```

  For hvert treff: er verdien som interpoleres fra bruker-kontrollert input (CMS-data, URL-parameter, bruker-input) eller er den konstant/intern?

  Klassifiser hvert treff:
  - **Statisk** (ingen `${...}`) → OK
  - **Intern verdi** (fra eget API-kall, enum, konstant) → OK
  - **CMS-data** (fra Sheets/Drive) → risiko avhengig av DOMPurify-bruk
  - **Bruker-input** → **KRITISK** hvis ikke sanitert

- [ ] **Steg 5.5: `/admin`-tilgang — er siden indeksert?**

  Sjekk at X-Robots-Tag: noindex er satt for admin-sider:
  ```bash
  grep -rn "noindex\|robots" src/pages/admin/ src/utils/security-headers.ts
  ```

  Sjekk at admin-panelet ikke vises i `sitemap.xml` (Astro genererer sitemap automatisk):
  ```bash
  grep -rn "sitemap\|robots" astro.config.mjs src/pages/robots.txt
  ```

- [ ] **Steg 5.6: CORS på Lambda — er det riktig konfigurert?**

  Fra frontend (Astro) sendes kontaktskjema-data til Lambda Function URL. Sjekk at CORS-headers i Lambda-responsen begrenser `Access-Control-Allow-Origin` til kun `https://tennerogtrivsel.no`:

  ```bash
  grep -n "cors\|origin\|CORS\|Origin" lambda/kontakt-form-handler/index.mjs
  ```

  **Hva vi leter etter:** `Access-Control-Allow-Origin: *` → **FUNN**. Men merk at CORS er browser-enforcement — serveren bør sette riktig origin, men `x-origin-verify` er den faktiske sikkerhetsmekanismen.

- [ ] **Steg 5.7: Presenter funn fra Task 5 og diskuter**

---

## Task 6: Tverrgående gjennomgang og sammendrag

**Mål:** Se hele bildet — finnes det svakheter i koblingene mellom systemene?

- [ ] **Steg 6.1: Secret inventory — hvilke hemmeligheter eksisterer?**

  Lag en komplett liste over alle hemmeligheter i GitHub Secrets (brukeren sjekker i GitHub → Settings → Secrets → Actions):

  ```
  AWS_ACCESS_KEY_ID         — AWS CLI-tilgang for CI
  AWS_SECRET_ACCESS_KEY     — AWS CLI-tilgang for CI
  CLOUDFRONT_DISTRIBUTION_ID_PROD — CloudFront-ID for invalidering
  CLOUDFRONT_DISTRIBUTION_ID_TEST — CloudFront-ID for test
  CLOUDFRONT_CSP_POLICY_ID  — CloudFront CSP-policy ID
  GOOGLE_SERVICE_ACCOUNT_EMAIL — Service account for Sheets/Drive
  GOOGLE_PRIVATE_KEY        — Service account nøkkel
  PUBLIC_GOOGLE_CLIENT_ID   — OAuth client ID
  PUBLIC_GOOGLE_API_KEY     — Drive thumbnail API-nøkkel
  GOOGLE_SHEET_ID           — Sheets dokument-ID
  GOOGLE_DRIVE_*_FOLDER_ID  — Drive-mappe IDer (x4)
  LAMBDA_KONTAKT_ARN        — Lambda funksjon ARN
  ORIGIN_VERIFY_SECRET      — Delt hemmelighet frontend↔Lambda
  MY_GITHUB_PAT             — GitHub Personal Access Token
  ```

  For hvert secret: er det fortsatt i bruk? Er det noen som ikke er i bruk lenger? → **FUNN** (ubrukte secrets øker blast-radius unødvendig)

- [ ] **Steg 6.2: Incident response — hva gjør vi hvis noe er kompromittert?**

  Vurder: finnes det en runbook for disse scenariene?
  - AWS access key kompromittert
  - npm-pakke i produksjon er kompromittert (supply chain)
  - Google service account kompromittert
  - `ORIGIN_VERIFY_SECRET` lekket

  Fra forrige plan var `docs/runbooks/supply-chain-incident.md` (Task 12.2) planlagt men ikke gjort. → **FUNN**

- [ ] **Steg 6.3: `docs/plans/2026-05-03-admin-token-blast-radius.md` — hva er status?**

  Fra git-status ser vi denne planfilen som untracked. Les den:
  ```bash
  cat docs/plans/2026-05-03-admin-token-blast-radius.md
  ```
  Og tilsvarende spec:
  ```bash
  cat docs/superpowers/specs/2026-05-03-admin-token-blast-radius-design.md
  ```

  Er dette arbeid som påvirker sikkerhetsgjennomgangen? Hva er status?

- [ ] **Steg 6.4: Kompiler samlet funn-liste**

  Lag `docs/plans/2026-05-14-sikkerhetsgjennomgang-funn.md` med:

  ```markdown
  # Sikkerhetsgjennomgang 2026-05-14 — funn

  | # | Alvorlighet | Domene | Funn | Anbefaling | Estimat |
  |---|-------------|--------|------|------------|---------|
  ```

  Alvorlighetsgrader: **Kritisk**, **Høy**, **Medium**, **Lav**, **Notat**

- [ ] **Steg 6.5: Presenter samlet funn-liste og diskuter prioritering**

  Etter presentasjon: diskuter med bruker hvilke funn som skal adresseres og i hvilken rekkefølge. Oppdater eksisterende `2026-04-28-sikkerhetshardening.md` med nye tasks, eller lag en ny plan for hver større fix-oppgave.

---

## Rekkefølge og avhengigheter

```
Task 1 (GitHub) → diskusjon → Task 2 (AWS IAM) → diskusjon
→ Task 3 (AWS services) → diskusjon → Task 4 (Google) → diskusjon
→ Task 5 (Admin) → diskusjon → Task 6 (Sammendrag) → prioritering
```

Hvert domene er selvstendig — Task 2 kan starte uten at Task 1 er fullt diskutert, men alle diskusjonene bør gjennomføres før Task 6.

**Estimat:** 1–2 timer for kodegjennomgang (Task 1, 5). AWS- og Google-sjekker (Task 2, 3, 4) avhenger av tilgang og tar 30–60 min per domene med brukerens hjelp.
