# Spec: Innholdsdeploy skal ikke blokkeres av avvik som ikke kan handles på

- **Dato:** 2026-09-15
- **Status:** Godkjent og implementert
- **Oppgave:** «Innholdsdeploy skal ikke blokkeres av nye sikkerhetsavvik» (TODO.md)
- **Plan:** [docs/plans/2026-09-15-innholdsdeploy-blokkering.md](../plans/2026-09-15-innholdsdeploy-blokkering.md)
- **Bakgrunn:** [sikkerhetshardening, Steg 4.3](../plans/2026-04-28-sikkerhetshardening.md) innførte audit-gaten

## Problem/mål

Redaktøren publiserer innhold ved å endre et dokument i Google Drive. Det trigger
`repository_dispatch: google_drive_update`, som kjører `build` → `deploy` i `deploy.yml`.

Den stien kan i dag stoppes av funn som redaktøren verken har forårsaket eller kan gjøre noe
med i den kjøringen. **Målet er at en ren innholdspublisering ikke skal kunne blokkeres av
et funn som ikke er handlingsbart der og da — uten at funnet går tapt.**

## Bakgrunn: to hendelser samme dag

Begge inntraff 2026-09-15 og har samme form, men rammer ulike gates:

1. **Audit-gaten stoppet en Drive-oppdatering.** `npm audit --audit-level=critical` i
   `build`-jobben fant GHSA-26w7-cxv4-gfx2 (Astro RCE, `astro <7.2.8`). Ingen kode var
   endret — advisory-en ble publisert etter forrige grønne kjøring. Innholdet nådde aldri
   prod før avhengigheten ble bumpet manuelt.
2. **En ustabil E2E-test stoppet en main-deploy.** Kjøring `35022298679`
   (push til main, «Bump the lambda-version-updates group»): `e2e-tests` feilet på
   `accessibility.spec.ts:30 › Admin (/admin)` med `page.waitForLoadState`-timeout — også
   ved retry. Følgen var at `build`, `deploy` **og** `update-lambda` ble `skipped`. Main og
   prod stod fra hverandre til neste push tilfeldigvis gikk grønt.

Hendelse 2 er grunnen til at spec-en er formulert bredere enn oppgavetittelen: prinsippet er
det samme, selv om tiltaket her kun dekker hendelse 1 (se avgrensninger).

## Prinsippet, skarpere formulert

Brukerens formulering er *«virket deployen i går, skal den virke i dag»*. Den underliggende
regelen er mer presis:

> **En gate skal blokkere der funnet er handlingsbart i den kjøringen.**

På `push` og `pull_request` er audit-funnet handlingsbart: avhengighetstreet er i endring, og
det riktige svaret er å avvise endringen. På `repository_dispatch` er det ikke det —
lockfilen er byte-identisk med den som **allerede kjører i prod**. Å blokkere fjerner ikke
sårbarheten fra prod; den sårbare koden ligger der fra før. Det eneste blokkeringen oppnår,
er å hindre publisering av innhold.

Det er ikke en avveining mellom bekvemmelighet og sikkerhet. Blokkering på den stien har
netto **negativ** verdi: prod forblir sårbar uansett, og i tillegg er CMS-en ute av drift.

## Forholdet til den opprinnelige begrunnelsen

Audit-gaten ble innført i sikkerhetshardingen (Steg 4.3) med formålet *«fail-fast på nye
kritiske sårbarheter»*. Endringen her svekker ikke det formålet, men flytter det:

- **Fail-fast beholdes** der avhengigheter faktisk endres (`push`, `pull_request`).
- For en nypublisert advisory om *uendrede* avhengigheter erstattes «rødt bygg som ingen
  åpner» med et varsel som overlever kjøringen (GitHub-issue). Det er strengt tatt et bedre
  varsel enn dagens, som forsvinner i kjøringslisten.

## Krav og akseptansekriterier

| # | Akseptansekriterium |
|---|---------------------|
| AK1 | En `repository_dispatch: google_drive_update`-kjøring fullfører `build` → `deploy` selv når `npm audit --audit-level=critical` rapporterer funn |
| AK2 | Audit-steget **kjører fortsatt** på dispatch-stien, og utfallet er synlig i kjøringen (steg-status + jobbsammendrag) |
| AK3 | Et funn på dispatch-stien oppretter en GitHub-issue med audit-utdataen, slik at det overlever kjøringen |
| AK4 | AK3 er deduplisert: gjentatte dispatcher mens issuen er åpen oppretter ikke nye issues |
| AK5 | På `push` og `pull_request` blokkerer audit-gaten som før — uendret oppførsel |
| AK6 | `Scheduled Security Audit` kjører daglig, ikke ukentlig |
| AK7 | `docs/architecture/sikkerhet.md` beskriver den nye oppførselen (gaten er betinget, og scheduled audit er daglig) |

## Avgrensninger / non-goals

- **E2E-gaten endres ikke.** Hendelse 2 over har samme form, men riktig svar der er å
  stabilisere testene, ikke å svekke gaten — en ustabil test er et reelt problem som skal
  fikses, ikke omgås. Det dekkes av backlog-oppgaven «Stabiliser ustabile tester», som
  allerede har begge de observerte flakene dokumentert. Observasjonen fra kjøring
  `35022298679` legges til der.
- **`--audit-level` heves ikke** fra `critical` til `high` i `deploy.yml`. Begrunnelsen fra
  Steg 4.3 (hyppige `high`-CVE-er i dev-only transitive deps gjør CI ustabil) står ved lag.
  `high`-båndet dekkes i stedet av daglig scheduled audit (AK6).
- **`package.json`-gulv røres ikke.** At `"astro": "^7.2.4"` formelt tillater de sårbare
  7.2.4–7.2.7 er en separat sak; Dependabot-PR #463 hever gulvet.
- **Ingen endring i `npm audit signatures`.** Det steget fanger pakkeforfalskning, ikke
  advisories, og er handlingsbart på alle stier.
- **`workflow_dispatch` beholder den blokkerende gaten.** Manuell kjøring har samme
  egenskap som dispatch-stien — lockfilen er uendret, så funnet er like lite handlingsbart —
  og prinsippet over skulle isolert sett tilsagt samme unntak. Det gjøres likevel ikke:
  `workflow_dispatch` er den naturlige nødutgangen hvis dette blir feil, og da skal den ha
  den strengeste oppførselen, ikke den mildeste. Er innholdspublisering blokkert, er riktig
  vei ut å fikse avviket eller trigge en ny Drive-dispatch.

## Designvalg med begrunnelse

**V1 — `continue-on-error` framfor `if`-hopp.** Oppgavenotatet foreslo
`if: github.event_name != 'repository_dispatch'`. Det forkastes: da kjører ikke steget, og
signalet forsvinner helt. `continue-on-error: ${{ github.event_name == 'repository_dispatch' }}`
kjører steget, registrerer utfallet og lar jobben gå videre. Nøkkelen er at
`continue-on-error` er blant de få steg-feltene som tar imot uttrykk.

**V2 — GitHub-issue framfor rødt bygg etter deploy.** Et vurdert alternativ var å legge en
rapporterings-jobb *etter* `deploy`, som feiler ved funn: da deployes innholdet, men
kjøringen blir rød, uten behov for nye rettigheter. Forkastet fordi det bevisst produserer
røde kjøringer på main der alt faktisk gikk bra. Det undergraver «rødt bygg = noe er galt»
som signal — nettopp den forvirringen som utløste denne oppgaven. En issue er dessuten
handlingsbar og blir liggende i Issues-fanen.

**V2b — dedupen er bevisst «dum».** Underveis ble den bygget ut til et
`<!-- avtrykk: … -->`-felt som holdt settet av advisory-URL-er, slik at avvik nummer to
kunne varsles separat mens issuen om det første sto åpen. Den varianten ble forkastet etter
tre reviewrunder: den kostet ~60 linjer bash og produserte to reelle feil av seg selv (den
leste markører fra kommentarer hvem som helst kan skrive på et offentlig repo, og en
registry-feil ga tomt avtrykk og dermed varsel ved hver eneste publisering). Gevinsten var
liten: issuen står åpen til noen fikser auditen, og den som gjør det kjører `npm audit` og
ser hele bildet uansett. Nå gjelder: finnes en åpen issue med etiketten, gjør ingenting.

**V3 — bare `build` rapporterer.** Både `build` og `update-lambda` har audit-steget og
kjører på dispatch. Begge gjøres ikke-blokkerende, men kun `build` oppretter issue. De
auditerer samme lockfile i samme kjøring, så to issues ville vært ren duplikatstøy.

**V4 — daglig scheduled audit.** Alle gatene i `deploy.yml` står på `critical`. Et
`high`-avvik fanges derfor kun av `Scheduled Security Audit` (`--audit-level=high`) og av
Dependabot-alerten, som kommer innen timer, men ikke blokkerer noe. Ukentlig kadens gir opptil
sju døgns deteksjonsforsinkelse i verste fall; daglig kutter det til ett. Kjøringen er billig —
observerte kjøringer ligger under et halvt minutt (`npm audit`-jobben 15 s, OSV-scanner 20 s).

**Viktig presisering:** daglig kadens ville *ikke* forhindret hendelsen 2026-09-15. Den
ukentlige kjøringen `34843733661` (2026-09-14 12:29 UTC, `event=schedule`) fanget
GHSA-26w7-cxv4-gfx2 og feilet med «4 vulnerabilities (3 high, 1 critical)» — omtrent 32 timer
*før* deployen ble blokkert. Signalet fantes altså allerede; det nådde bare ingen som handlet
på det. Det er et argument for issue-opprettelsen i V2, ikke for kadensen: en rød
scheduled-kjøring produserer en e-post, ikke en oppgave. Daglig kadens beholdes fordi den
kutter verstefallsforsinkelsen, men den er ikke tiltaket som løser denne hendelsen.

## Restrisiko

Et kritisk avvik kan nå nå prod via dispatch-stien uten at noe stopper det. I praksis er
koden som deployes uansett `main`, som allerede passerte gaten ved merge — så avviket ligger
allerede i prod før dispatchen. Reell endring i eksponering: null. Endringen er at vi nå
*vet* om det, via issuen, i stedet for at en rød kjøring blir tolket som «deployen feilet».

**Repoet er offentlig, og det har to følger som er bevisst akseptert.** For det første blir
issuen en varig, selvoppdaterende og godt synlig oversikt over upatchede kritiske
advisories i den kjørende siden. Ingen *ny* informasjon lekker — `package-lock.json` og
Actions-loggene er allerede offentlige, og advisory-en er per definisjon publisert — så
dette er en endring i oppdagbarhet, ikke i avsløring. Den prisen tas mot at alternativet er
at funnet ikke når noen i det hele tatt. For det andre kan hvem som helst kommentere på
issuen. Det er uten betydning her, fordi dedupen kun spør om det finnes en åpen issue med
etiketten — ingenting utenforstående skriver, påvirker hva mekanismen gjør.

## Åpne spørsmål

Ingen som blokkerer planlegging. Ett valg tas i planen, ikke her: hvorvidt feilgrenen
(`continue-on-error` faktisk slår inn) skal verifiseres empirisk med en midlertidig commit
på main, eller kun ved gjennomlesing. Se «Risiki» i planen.

Ett spørsmål er identifisert *under* implementasjonen og skyves bevisst ut av denne oppgaven:
`Scheduled Security Audit` varsler i dag kun via e-post ved rød kjøring, og hendelsen
2026-09-15 viser at det ikke er nok (se V4). Den burde trolig opprette en issue på samme måte
som `build` nå gjør. Det er en egen oppgave — den ligger utenfor godkjent scope her.
