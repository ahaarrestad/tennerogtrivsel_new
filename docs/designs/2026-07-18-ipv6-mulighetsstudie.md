# IPv6 for tennerogtrivsel.no — mulighetsstudie

**Dato:** 2026-07-18
**Status:** Utredning. Ingen endringer er gjort i noe miljø.
**Spørsmålet:** Er det mulig å få en IPv6-versjon av siden?

---

## Kortsvar

Ja. Og dere kjører det allerede — på test-miljøet.

`test2.aarrestad.com` har svart over IPv6 hele tiden, på samme CloudFront-stack som prod.
Spørsmålet «får vi det til» er dermed ikke teoretisk: det er besvart i deres eget oppsett.

For prod er www-delen én bryter i CloudFront. Apex-domenet
(`tennerogtrivsel.no` uten `www`) krever en DNS-beslutning og er den eneste reelle
oppgaven i saken.

Dette er en «kjekt å få til»-sak, ikke en «må ha»-sak. Se
[Hva er egentlig nytten?](#hva-er-egentlig-nytten) — den delen er bevisst ærlig.

---

## Hva som ble målt

Alle tall under er hentet 2026-07-18. Kommandoene er tatt med så de kan etterprøves.

### CloudFront-distribusjonene

```bash
aws cloudfront get-distribution-config --id E9Z51DQB2K1G4 \
  --query 'DistributionConfig.{IPV6:IsIPV6Enabled,HTTP:HttpVersion}'
```

| Distribusjon | ID | `IsIPV6Enabled` | `HttpVersion` |
|---|---|---|---|
| Prod | `E9Z51DQB2K1G4` | **`false`** | `http2` |
| Test | `E2WXX7ZUR5NNP3` | **`true`** | `http2` |

Prod og test er altså ute av sync på denne innstillingen. Test har IPv6 på, prod har det ikke.
Ingenting tyder på at dette var en bevisst beslutning — mer sannsynlig er det en forskjell som
oppsto fordi distribusjonene ble opprettet manuelt til ulik tid. Se
[Config as code](#config-as-code).

### DNS

```bash
dig +short AAAA <domene>
```

| Navn | Type | IPv6 i dag |
|---|---|---|
| `www.tennerogtrivsel.no` | CNAME → CloudFront | Nei — fordi distribusjonen har IPv6 av |
| `tennerogtrivsel.no` (apex) | **4 × A-record**, TTL 3600 | Nei |
| `test2.aarrestad.com` | CNAME → CloudFront | **Ja — 8 AAAA-adresser** |
| `test3.aarrestad.com` | CNAME → CloudFront | **Ja — 8 AAAA-adresser** |

DNS-leverandør er hyp.net (ikke Route 53).

Det viktige skillet: `www` og test-domenene er **CNAME-er**. De arver alt distribusjonen
tilbyr, inkludert AAAA-poster, uten at noen trenger å røre DNS. Apex er **hardkodede
A-poster** som peker rett på fire CloudFront-IP-er, og arver derfor ingenting.

### Virker IPv6 faktisk?

```bash
curl -4 -s -o /dev/null -w "HTTP %{http_code} via %{remote_ip}\n" https://test2.aarrestad.com/
curl -6 -s -o /dev/null -w "HTTP %{http_code} via %{remote_ip}\n" https://test2.aarrestad.com/
```

```
IPv4: HTTP 403 via 52.84.50.56
IPv6: HTTP 403 via 2600:9000:2016:7c00:e:b5bd:bfc0:93a1
```

Identisk respons på begge protokoller. Det er akkurat det man vil se: IPv6-transporten
oppfører seg som IPv4, ingen forskjell i oppførsel.

> **Sidefunn, urelatert til IPv6:** test-siten svarer `403` på begge protokoller. Siden svaret
> er likt over IPv4 og IPv6, er dette ikke en IPv6-sak — sannsynligvis en tom bucket eller et
> miljø som ikke er deployet. Notert her fordi det ble oppdaget underveis, ikke fordi det
> hører hjemme i denne oppgaven.

---

## Slik ser du det virke

Dette er læringsdelen, og poenget er å kunne skille «virker» fra «ser ut som det virker».

**1. Har maskinen din IPv6 i det hele tatt?**

```bash
ip -6 addr show scope global
```

Utviklingsmaskinen har en global adresse i `2a01:799:...`-området via ISP-en. Uten dette kan
du ikke teste noe som helst — da tester du bare at fallback til IPv4 fungerer.

**2. Finnes AAAA-poster?**

```bash
dig +short AAAA www.tennerogtrivsel.no
```

Tomt svar betyr ingen IPv6. Dette sier bare noe om DNS, ikke om at tilkobling faktisk går.

**3. Går trafikken faktisk over IPv6?**

```bash
curl -6 -o /dev/null -w "%{remote_ip}\n" https://www.tennerogtrivsel.no/
```

`curl -6` nekter å falle tilbake til IPv4. Får du svar, og `remote_ip` er en IPv6-adresse,
er det ekte. Dette er den eneste av de tre testene som beviser noe.

**Fellen å unngå:** en nettleser som laster siden fint beviser ingenting — den faller tilbake
til IPv4 uten å si fra. Bruk `curl -6`, eller <https://test-ipv6.com> for en visuell sjekk.

---

## Veiene videre

Kravet er at det skal være gratis. Det avgjør mer enn man skulle tro.

### A. Kun www — flipp bryteren

Sett `IsIPV6Enabled: true` på prod-distribusjonen. `www.tennerogtrivsel.no` får AAAA-poster
automatisk, fordi den er en CNAME. Apex forblir IPv4-only.

- **Kostnad:** null. CloudFront tar ikke betalt for IPv6.
- **Risiko:** svært lav. Reversibel ved å sette verdien tilbake. Klienter uten IPv6 påvirkes
  ikke — de bruker A-postene som før.
- **Arbeid:** minutter.
- **Dokumentert virkning:** dette er nøyaktig oppsettet test-miljøet allerede kjører.

### B. ALIAS/ANAME på apex hos hyp.net

Erstatt de fire A-postene med én ALIAS-post mot `d19b7g2frcrx6i.cloudfront.net`. Da følger
apex distribusjonen på samme måte som `www` gjør, inkludert AAAA.

- **Kostnad:** null, forutsatt at hyp.net støtter ALIAS/ANAME.
- **Bonus:** fjerner den hardkodede-IP-svakheten beskrevet under.
- **Åpent punkt:** støtter hyp.net dette? Må sjekkes i kontrollpanelet. Kunne ikke verifiseres
  utenfra i denne utredningen. Dette avgjør om vei B i det hele tatt er farbar.

### C. Flytt DNS til Route 53 — avvist

Route 53 har ALIAS-poster som løser apex-problemet elegant og AWS-nativt.

**Men en hosted zone koster ~0,50 USD/mnd.** Lite, men ikke gratis, og gratis var kravet.
Avvist på det grunnlaget alene — ikke fordi løsningen er dårlig.

---

## Det uløste: apex

`tennerogtrivsel.no` peker i dag på fire hardkodede CloudFront-IP-er:

```
3.167.2.24   3.167.2.82   3.167.2.101   3.167.2.104
```

CloudFront garanterer ikke at disse adressene forblir stabile, og AWS fraråder eksplisitt å
peke A-poster rett på dem. Hvis AWS bytter dem ut, slutter apex å svare til noen oppdager det
og retter DNS manuelt.

**Dette er en svakhet som finnes i dag, uavhengig av IPv6.** Den er tatt med her fordi enhver
IPv6-jobb på apex uansett tvinger fram en beslutning om hvordan apex skal peke — og vei B
løser begge deler samtidig.

Det skal sies at oppsettet har fungert så langt, og at et bytte av CloudFronts IP-er er
sjeldent. Dette er noe å vite om, ikke en brannalarm.

---

## Config as code

Prosjektet har allerede etablert mønsteret — fire idempotente scripts:

| Script | Dekker |
|---|---|
| `scripts/setup-s3.mjs` | Buckets og bucket policy |
| `scripts/setup-dynamodb.mjs` | Rate-limit-tabell |
| `scripts/setup-cloudfront-functions.mjs` | CF Functions |
| `scripts/setup-response-headers-policy.mjs` | Security headers |

Det som mangler er **distribusjonen selv** — ingen script rører `DistributionConfig` i dag,
og arkitekturdokumentet slår fast at distribusjonene opprettes manuelt.

Det er nettopp der IPv6-bryteren bor. Og det gjør IPv6 til en uvanlig god førstekandidat for
å utvide mønsteret ett nivå: én boolsk verdi, reversibel, trivielt verifiserbar med `dig` og
`curl -6`. Et `setup-cloudfront-distribution.mjs` som håndterer `IsIPV6Enabled` — og senere
`HttpVersion` — ville følge eksisterende konvensjon tett.

Verdien er ikke IPv6 i seg selv. Den er at drift-forskjellen mellom prod og test
(`false` vs. `true`) er en type avvik som oppstår og består nettopp fordi konfigurasjonen er
manuell. Config as code fjerner klassen av feil, ikke bare denne ene instansen.

Dette er større enn IPv6-oppgaven og hører hjemme som egen sak.

---

## Hva er egentlig nytten?

Ærlig svar: **for brukerne, nær null målbar gevinst.**

Alle norske ISP-er har velfungerende IPv4. Ingen som besøker en tannlegeside i Norge blir
stengt ute i dag fordi siden mangler IPv6, og ingen vil oppleve den som raskere. Det finnes
ingen SEO-effekt. Det finnes ikke noe kjent tilfelle der dette har kostet noen en pasient.

Den reelle verdien er:

1. **Læring** — IPv6, DNS-recordtyper og CDN-oppførsel er nyttig å forstå, og dette er et
   trygt sted å lære det.
2. **Ryddighet** — prod og test bør ha lik konfigurasjon.
3. **Foranledning** — det tvinger fram en gjennomgang av apex-oppsettet, som har en reell
   om enn liten svakhet.
4. **Fremtidssikring** — billig å gjøre nå, mens det ikke haster.

Til sammenligning har [HTTP/3](#se-også) større praktisk brukergevinst enn IPv6 for denne
siden, og er enklere fordi den ikke rører DNS i det hele tatt.

Denne utredningen anbefaler derfor ikke IPv6 som et *behov*. Den slår fast at det er lett,
gratis og lærerikt — og at det er en fullgod grunn i seg selv, så lenge det ikke selges inn
som noe annet.

---

## Foreslått fasing

Ingenting av dette haster, og ingenting bør gjøres før noen har lyst.

1. **Lek på test.** Test-miljøet har allerede IPv6 og er null-risiko. Kjør `dig` og `curl -6`
   mot `test2.aarrestad.com`, se hvordan AAAA-poster oppfører seg, prøv å slå innstillingen
   av og på og se hvor lang tid det tar før DNS endrer seg.
2. **Sjekk hyp.net.** Støtter de ALIAS/ANAME på apex? Ett oppslag i kontrollpanelet avgjør om
   vei B finnes.
3. **Flipp prod for www.** Gratis, reversibelt, gir halve gevinsten.
4. **Apex — kun hvis vei B finnes.** Ellers la det ligge.
5. **Config as code — når læringen sitter.** Egen oppgave.

---

## Åpne punkter

- **Støtter hyp.net ALIAS/ANAME på apex?** Avgjør om vei B er mulig. Krever innlogging i
  kontrollpanelet — kunne ikke verifiseres utenfra.
- **Hvorfor svarer test-siten 403?** Urelatert til IPv6, men verdt å se på.
- **Var prod/test-forskjellen bevisst?** Antatt nei, men ikke bekreftet.

---

## Se også

- [`docs/architecture/aws-infrastruktur.md`](../architecture/aws-infrastruktur.md) — fullt
  CloudFront-, DNS- og AWS-oppsett
- **HTTP/3 (QUIC) på CloudFront** — egen backlog-oppgave. Samme distribusjon, beslektet
  innstilling (`HttpVersion`), men teknisk urelatert. Større brukergevinst enn IPv6.
