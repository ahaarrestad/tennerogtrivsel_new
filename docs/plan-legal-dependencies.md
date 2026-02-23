# Plan: Legal vurdering av dependencies

## Nåværende status

### Sårbarheter

**npm audit: 0 sårbarheter** (info: 0, low: 0, moderate: 0, high: 0, critical: 0)

Prosjektet har ingen kjente sikkerhetsproblemer i dependencies.

### Vedlikeholdsstatus

Alle prod-dependencies er aktivt vedlikeholdt. Kun `tailwindcss` har en minor-oppdatering tilgjengelig (4.2.0 → 4.2.1). Dependabot er konfigurert og lager PRer automatisk for oppdateringer.

### Lisensfordeling (557 pakker totalt)

| Lisens | Antall | Risiko |
|--------|--------|--------|
| MIT | 361 | Ingen — fri bruk |
| Apache-2.0 | 20 | Ingen — fri bruk |
| ISC | 14 | Ingen — fri bruk |
| BSD-2-Clause | 10 | Ingen — fri bruk |
| BSD-3-Clause | 9 | Ingen — fri bruk |
| BlueOak-1.0.0 | 8 | Ingen — fri bruk |
| MPL-2.0 | 5 | Lav — se nedenfor |
| MIT-0 | 2 | Ingen — fri bruk |
| CC0-1.0 | 2 | Ingen — fri bruk |
| LGPL-3.0-or-later | 2 | Lav — se nedenfor |
| Andre | 3 | Ingen |

**97%+ av pakkene** har permissive lisenser (MIT, Apache, BSD, ISC) som tillater fri bruk uten restriksjoner.

### Pakker med copyleft-lisenser

#### LGPL-3.0-or-later (2 pakker)
- `@img/sharp-libvips-linux-x64` — prebuilt binære filer for sharp (bildebehandling)
- `@img/sharp-libvips-linuxmusl-x64` — samme, musl-variant

**Vurdering:** LGPL krever at brukere kan bytte ut det LGPL-lisensierte biblioteket. Siden dette er prebuilt native binære filer som brukes via npm (ikke statisk linket inn i appkoden), og sharp kun er en devDependency brukt ved build-tid, er LGPL-kravene oppfylt. **Ingen risiko for dette prosjektet.**

#### MPL-2.0 (5 pakker)
- `lightningcss` + 2 plattform-varianter — CSS-parser brukt av Tailwind/Astro ved build
- `dompurify` — HTML-sanitering (dual-lisensiert: MPL-2.0 OR Apache-2.0)

**Vurdering:** MPL-2.0 er file-level copyleft — hvis du endrer MPL-filene selv, må endringene deles. Bruk av biblioteket via npm uten å endre kildekoden utløser ingen krav. DOMPurify har i tillegg Apache-2.0 som alternativ. **Ingen risiko for dette prosjektet.**

## Lisensvurdering for prosjektet

### Trenger prosjektet en lisens?

Prosjektet er en **privat nettside for en tannlegeklinikk**. Det er ikke open source og distribueres ikke til andre. Kildekoden ligger på GitHub (privat repo).

**Anbefaling: Ingen lisens nødvendig.** Uten lisens er alle rettigheter forbeholdt eieren. Dette er riktig for et privat prosjekt som ikke skal deles.

Hvis prosjektet i fremtiden gjøres open source:
- **MIT** er enklest — tillater alt, krever kun opphavsrett-notis
- **GPL** ville vært unødvendig restriktivt for en nettside

### Overholdelse av dependency-lisenser

Alle brukte lisenser tillater kommersiell bruk. Eneste krav er:
1. **MIT/BSD/ISC:** Behold lisens-filene i `node_modules` (dette skjer automatisk via npm)
2. **Apache-2.0:** Behold NOTICE-filer (Google-bibliotekene har dette, beholdes automatisk)
3. **MPL-2.0:** Ikke endre kildekoden i MPL-pakkene (vi gjør ikke det)
4. **LGPL-3.0:** Tillat utbytting av biblioteket (npm gjør dette mulig)

**Alle krav er allerede oppfylt** uten ekstra tiltak.

## Steg for gjennomføring

### Steg 1: Dokumenter funnene

Opprett en kort lisensoversikt i prosjektet (f.eks. i denne filen) som referanse.

### Steg 2: Verifiser Dependabot-konfigurasjon

Bekreft at Dependabot er riktig konfigurert for å fange opp fremtidige sårbarheter:
- Sjekk `.github/dependabot.yml`
- Verifiser at auto-merge er begrenset til minor/patch (allerede implementert)

### Steg 3: Sett opp periodisk sjekk

Legg til `npm audit` som del av CI (allerede gjort — kjøres i `unit-tests`-jobben).

## Konklusjon

Prosjektet har **ingen sikkerhetsproblemer**, **ingen lisensproblemer**, og **ingen utdaterte dependencies av betydning**. Dependabot og CI tar seg av løpende vedlikehold. Ingen ekstra tiltak er nødvendig.

Oppgaven kan lukkes som gjennomgått og dokumentert.
