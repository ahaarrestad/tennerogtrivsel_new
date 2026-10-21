# HTTP/3 (QUIC) på CloudFront

Spec og plan er slått sammen i én fil. Arbeidsflyten i `TODO.md` tillater det for «veldig små, trivielle oppgaver», og denne er liten nok:
- Den endrer ett felt per distribusjon.
- Den rører ingen kode.
- Den kan reverseres med det samme feltet.
- Den kan verifiseres med kommandoutskrift.

## Spec

### Problem og mål

Begge distribusjonene står på `HttpVersion: http2`, og ingen av dem sender `alt-svc` (hentet 2026-10-21 med `get-distribution-config` og `curl -sI`). HTTP/3 gir raskere oppkobling og ingen head-of-line blocking ved pakketap, og CloudFront støtter connection migration ved bytte mellom wifi og mobilnett. Det kommer brukere på ujevnt mobilnett til gode.

Det koster ingenting ifølge AWS' lanseringsinnlegg fra 2022. Prissiden sjekkes på nytt før prod, se steg 2. Klienter uten HTTP/3, og nett som blokkerer UDP 443, bruker HTTP/2 som før.

### Akseptansekriterier

1. `HttpVersion` er `http2and3` på test (`E2WXX7ZUR5NNP3`) og prod (`E9Z51DQB2K1G4`). Det leses tilbake med `get-distribution-config`.
2. Ingen andre felt i `DistributionConfig` er endret. En normalisert diff av konfigurasjonen før og etter viser bare `HttpVersion`.
3. Begge distribusjonene står i `Deployed`.
4. **Faktisk HTTP/3-tilkobling.** QUIC-sjekken (se under) gir `nextHopProtocol h3` mot `test2.aarrestad.com` og `www.tennerogtrivsel.no`. Før endringen gir begge `net::ERR_QUIC_PROTOCOL_ERROR`. Det ble målt 2026-10-21 og fungerer som negativkontroll.
5. **Annonsering.** `curl -sI https://www.tennerogtrivsel.no/` viser `alt-svc` med `h3=":443"`, og `ma`-verdien loggføres. På test er det bare informasjon om `alt-svc` er med, fordi test bare gir 403-feilsvar, og det er udokumentert om CloudFront legger headeren på dem. For test er det AK 4 som avgjør.
6. Prod svarer fortsatt `HTTP/2 200` på `/` og `/kontakt/`.
7. Dokumentasjonen er oppdatert:
   - `docs/architecture/aws-infrastruktur.md` beskriver HTTP-versjonen for begge distribusjonene, og oppsettsguiden har med valget.
   - IPv6-oppgaven i `TODO.md` sier at et fremtidig distribusjonsscript også skal forvalte `HttpVersion: http2and3`.
   - TLS-funnet ligger som egen backlog-oppgave.

**QUIC-sjekken** er et engangsskript i øktens scratchpad (`h3.cjs`), ikke i repoet. Det starter Playwright-Chromium fra repoets `node_modules` med `--enable-quic --origin-to-force-quic-on=<host>:443`, navigerer til URL-en og skriver ut `performance.getEntriesByType('navigation')[0].nextHopProtocol`.

Tvangsflagget trengs fordi Chromium ikke bytter til HTTP/3 på alt-svc i samme økt. Det ble vist mot `cloudflare-quic.com`: `h3` med tvang, `h2` uten. Sjekken viser at QUIC-handshaken lykkes mot de egne domenene og sertifikatene, men ikke at nettlesere oppdager HTTP/3 på egen hånd. Det siste dekkes av AK 5.

### Non-goals

- **IPv6:** egen backlog-oppgave. `IsIPV6Enabled` røres ikke. Det står i dag på `true` på test og `false` på prod.
- **Minste TLS-versjon på prod:** `TLSv1.1_2016`, mens test har `TLSv1.2_2021`. Det legges inn som egen backlog-oppgave. HTTP/3 krever alltid TLS 1.3, så valget påvirker ikke denne oppgaven.
- **Et script for distribusjonskonfigurasjonen:** se designvalg.
- **Ny overvåking:** en `alt-svc`-sjekk i `/helsesjekk` ble vurdert. Ingen kode skriver `DistributionConfig`, og avvik synes i hver respons, så risikoen for drift er lav. Ikke tatt med.

### Designvalg

**Engangsendring med CLI, ikke et script.** Ingen kode i `scripts/`, `.github/workflows/`, `lambda/`, `api/` eller `src/` kaller `update-distribution`. Dette er verifisert av reviewere. `deploy.yml` invaliderer bare, og de andre CloudFront-scriptene rører funksjoner og response headers policies. Ingen deploy kan derfor overskrive innstillingen. Et idempotent script med tester for ett felt koster mer enn det gir.

Scriptet IPv6-studien foreslår (`setup-cloudfront-distribution.mjs`), hører hjemme i IPv6-oppgaven. Der får det to felt å forvalte, og AK 7 sørger for at det ikke tilbakestiller `HttpVersion` når det kommer.

**Ingen andre deler påvirkes.** Disse delene er gjennomgått:
- CloudFront Functions påvirkes ikke av viewer-protokollen.
- Protokollen mot origin (S3, Lambda-URL, CARTO) er uendret, så `X-Origin-Verify` er uendret.
- Cache-nøkkelen er uavhengig av HTTP-versjon.
- Response headers policy fjerner ikke `alt-svc`.
- Det finnes ingen WAF.
- Uptime-sjekken og `/helsesjekk` bruker curl over TCP og merker ingenting.

**Test først, så prod**, som den vanlige prosedyren for AWS-endringer. Test-siten er ikke deployet: synk-steget mot test er kommentert ut i `deploy.yml`, så bøtta er tom og distribusjonen svarer 403. Test-steget er derfor en prøvekjøring av kommandoene og QUIC-handshaken, ikke av selve siten.

## Plan

### Steg 0: Oppsett

1. Synk lokal `main`.
2. Opprett en worktree med `EnterWorktree`, kjør `git rebase main` og `bash scripts/setup-worktree.sh`.
3. Flytt planfilen (som ligger utracket på `main`) inn i worktreet, og fjern den fra `main`.
4. I `TODO.md` flyttes oppgaven fra Backlog til Pågående. Lenken til planen erstatter «*ingen plan ennå*».

AWS-endringen i steg 1–2 rører ikke repoet, men den kjøres etter steg 0, så rekkefølgen i flyten holdes.

Felles variabler (`$SCRATCH` er øktens scratchpad):
```bash
SCRATCH=/tmp/claude-1000/-home-asbjorn-IdeaProjects-tennerogtrivsel2/<økt>/scratchpad/http3
```

### Steg 1: Test (`E2WXX7ZUR5NNP3`)

1. Hent konfigurasjonen:
   ```bash
   aws cloudfront get-distribution-config --id E2WXX7ZUR5NNP3 > $SCRATCH/test-before.json
   ```
2. Lag patchen:
   ```bash
   jq '.DistributionConfig | .HttpVersion = "http2and3"' $SCRATCH/test-before.json > $SCRATCH/test-after.json
   ```
3. Kontrollér patchen. Diffen skal vise bare `HttpVersion`. `diff` avslutter med kode 1 når filene er ulike, og det er forventet her.
   ```bash
   diff <(jq -S .DistributionConfig $SCRATCH/test-before.json) <(jq -S . $SCRATCH/test-after.json)
   ```
4. Oppdater distribusjonen:
   ```bash
   aws cloudfront update-distribution --id E2WXX7ZUR5NNP3 \
     --if-match "$(jq -r .ETag $SCRATCH/test-before.json)" \
     --distribution-config file://$SCRATCH/test-after.json
   ```
5. Vent til distribusjonen er ferdig med `aws cloudfront wait distribution-deployed --id E2WXX7ZUR5NNP3`. Gir den opp etter omtrent 35 min (kode 255), sjekk `get-distribution --query Distribution.Status` og vent på nytt.
6. Verifiser:
   - AK 1–2: normalisert diff av `.DistributionConfig` fra en fersk `get-distribution-config` mot `test-before.json`. Den skal vise bare `HttpVersion`.
   - AK 4: QUIC-sjekken mot `https://test2.aarrestad.com/` skal gi `h3`.
   - AK 5: `curl -sI` noteres som informasjon.

### Steg 2: Prod (`E9Z51DQB2K1G4`)

Sjekk først CloudFronts prisside og bekreft at HTTP/3 ikke har egen pris. Kjør deretter samme fremgangsmåte som i steg 1, med prod-ID-en og `prod-*.json`. Konfigurasjonen hentes på nytt rett før patchen.

Verifiser AK 1–6. AK 4 gjelder `https://www.tennerogtrivsel.no/`. AK 5 og 6 sjekkes med `curl -sI` mot `/` og `/kontakt/`.

### Steg 3: Dokumentasjon, review og ship

1. `docs/architecture/aws-infrastruktur.md`:
   - Prod- og test-seksjonen får `- **HTTP-versjon:** HTTP/2 og HTTP/3 (`http2and3`)`.
   - Steg 9 i oppsettsguiden får `- Supported HTTP versions: HTTP/2, HTTP/3`.
2. `TODO.md`:
   - IPv6-oppgaven får et underpunkt om at et fremtidig distribusjonsscript også skal sette `HttpVersion: http2and3`.
   - En ny backlog-oppgave heter «Prod: hev minste TLS-versjon fra TLSv1.1_2016». Den sier at test har `TLSv1.2_2021` og at TLS 1.0 og 1.1 er utdatert.
3. Commit uten push via `/commit`. Kvalitetsporten hoppes over fordi endringen er ren dokumentasjon. Deretter kjøres `review-loop`.
4. Arkivering: oppgaven flyttes til `TODO-archive.md`, og planen til `docs/plans/archive/`.
5. Kjør `/commit` med ship. Push krever eksplisitt godkjenning.

### Rollback

Sett `HttpVersion` tilbake til `http2` med samme `jq`- og `update-distribution`-fremgangsmåte. `*-before.json` beholdes i scratchpad til økten er over.

Nettlesere husker `alt-svc` i `ma` sekunder (CloudFront bruker 86400, altså 24 t). Etter en rollback vil de derfor prøve QUIC i opptil et døgn. Når det feiler, faller de tilbake til TCP med litt tregere oppkobling. Rollback slår altså fullt inn hos klientene først etter et døgn.

### Definition of done

AK 1–7 er oppfylt og verifisert med kommandoutskrift. Docs-PR-en er merget.

### Risiko og usikkerhet

- **Auto-mode kan blokkere `update-distribution`** første gang. Det løses med brukerens eksplisitte ja, gitt ved godkjenningen av denne planen.
- **Utrullingen tar noen minutter.** Mens endringen sprer seg til edge-nodene, svarer noen med og andre uten `alt-svc`. Det er ufarlig, fordi alle fortsatt har HTTP/2.
- **ETag-konflikt:** ingen kode endrer distribusjonen, så konflikt oppstår bare ved en samtidig manuell endring. Da feiler `--if-match` med `PreconditionFailed`, og konfigurasjonen hentes på nytt. Ingenting overskrives stille.
- **QUIC-sjekken avhenger av lokal UDP 443.** Det er verifisert at det fungerer i dag, mot `cloudflare-quic.com`. Feiler sjekken etter endringen samtidig som `alt-svc` er med, kjøres kontrollen mot `cloudflare-quic.com` på nytt for å skille mellom feil i nettverket og feil hos oss.
