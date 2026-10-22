# Prod: hev minste TLS-versjon til TLSv1.2_2021

Spec og plan i én fil — liten oppgave (én innstilling på én distribusjon + to doc-linjer).

## Spec

**Problem/mål.** Prod-distribusjonen `E9Z51DQB2K1G4` har security policy `TLSv1.1_2016`, som
godtar TLS 1.0 og 1.1. Begge er utdatert (RFC 8996, 2021) og fjernet fra alle store nettlesere
siden 2020. Test (`E2WXX7ZUR5NNP3`) har kjørt `TLSv1.2_2021` uten problemer. Målet er at prod
følger samme policy, slik at siden bare kan nås med TLS 1.2 eller 1.3 med moderne chiffer.

**Akseptansekriterier.**
1. `MinimumProtocolVersion` på prod er `TLSv1.2_2021`, distribusjonen er `Deployed`, og ingen
   andre felter i distribusjonskonfigurasjonen er endret (rekkefølge-normalisert diff).
2. Mot `www.tennerogtrivsel.no`: TLS 1.0 og 1.1 avvises, TLS 1.2 og 1.3 fungerer.
3. Alle seks aliasene svarer fortsatt (200 på www.no, redirect til `https://www.tennerogtrivsel.no/` på de andre).
4. HTTP/3 virker fortsatt (QUIC-sjekk med Playwright).
5. Uptime Check kjørt manuelt er grønn.
6. `docs/architecture/aws-infrastruktur.md` viser `TLSv1.2_2021` for prod og i oppsettsteg 9.

**Avgrensninger.**
- Test endres ikke (har allerede `TLSv1.2_2021`).
- Ikke `TLSv1.2_2025` eller TLS 1.3-only. Det vil stenge ute klienter uten nok gevinst.
- Origin-siden (CloudFront → S3/CARTO) berøres ikke; den er allerede TLS 1.2.
- Ingen påslått CloudFront-logging for å måle klienter (se designvalg).

**Designvalg.**
- **`TLSv1.2_2021`** er AWS' anbefalte policy og samme som test. Den tillater TLS 1.2 med kun
  ECDHE + AES-GCM/ChaCha20 og TLS 1.3.
- **Ingen måling først.** CloudFront-logging er av, så vi kan ikke se TLS-versjonen til
  ekte klienter uten å skru på logging (S3-bøtte, kostnad, personvern). Klienter som
  ikke kan TLS 1.2 med GCM er i praksis Windows XP, IE ≤ 10 og Android ≤ 4.3 — ikke
  realistiske besøkende i 2026. Googlebot og andre søkemotorer støtter TLS 1.3. Endringen
  kan rulles tilbake på minutter.
- **Kostnad:** ingen. Security policy er gratis.

## Plan

1. **Baseline (lesing).** Hent prod-konfig + ETag til scratchpad. Bekreft med
   `openssl s_client` at prod i dag godtar TLS 1.1 (`-tls1_1 -cipher 'DEFAULT@SECLEVEL=0'`),
   og at test avviser den. Test er referansen for målkonfigurasjonen («test → verifiser»).
2. **Prod-endring.** `jq` setter kun `.ViewerCertificate.MinimumProtocolVersion =
   "TLSv1.2_2021"`. Rekkefølge-normalisert diff mot original skal vise kun den linjen.
   `aws cloudfront update-distribution --id E9Z51DQB2K1G4 --if-match <ETag>`, så
   `aws cloudfront wait distribution-deployed`.
3. **Verifisering** (kriterie 1–5): les konfig på nytt; `openssl s_client` med
   `-tls1`, `-tls1_1`, `-tls1_2`, `-tls1_3`; `curl` mot alle seks aliasene; Playwright
   QUIC-sjekk; `gh workflow run "Uptime Check"` og vent på grønn.
4. **Docs.** `docs/architecture/aws-infrastruktur.md` linje 30 (prod SSL) og linje 387
   (oppsettsteg 9) → `TLSv1.2_2021`.
5. **Arkiver** oppgaven og planen, `/commit` (kun docs → kvalitetsporten hoppes over),
   push etter godkjenning.

**Tilbakerulling.** Samme `update-distribution` med `TLSv1.1_2016`. Tar noen minutter å
deploye.

**Testbehov / definition of done.** Ingen kodeendring, så ingen enhetstester. Det som teller som
ferdig, er at akseptansekriteriene 1–6 er verifisert og at docs er merget.

**Risiki.**
- Et ukjent eldre system (f.eks. en gammel integrasjon eller skanner) som bare kan TLS 1.0/1.1,
  slutter å nå siden. Sannsynligheten er lav, og vi ruller tilbake hvis noen melder fra.
- En `update-distribution` med feil konfig. Dette sikres med ETag og normalisert diff før
  endringen, og ved å lese konfigurasjonen på nytt etterpå.
