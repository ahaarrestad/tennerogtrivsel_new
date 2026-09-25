# Lås Node-versjonen på tvers av lokalt og CI

## Problem / mål

Ingenting pinner Node-versjonen i dag: verken `.nvmrc` eller `engines` i
`package.json` finnes, og alle åtte `actions/setup-node`-steg i
`.github/workflows/` bruker `node-version: '24'`, som alltid henter siste
24.x fra GitHub sitt runner-cache. Lokalt kan utviklere ha en annen
patch-versjon (typisk hva som var nyeste 24.x da de sist installerte Node).

Dette har allerede gitt reell drift: `jsdom@30.0.1` (Dependabot-PR #466)
krever `^22.22.2 || ^24.15.0 || >=26.0.0`. Lokal `npm install` ga
`EBADENGINE` fordi lokal Node var 24.12.0, mens CI var upåvirket fordi
runneren fikk en nyere 24.x. Testene passerte likevel denne gangen — men
det var flaks, ikke en garanti. Neste gang kan et avvik være en ekte
inkompatibilitet, og den vil da bare treffe én av sidene (lokalt eller CI),
noe som gjør feilsøking unødvendig vanskelig.

Målet er at **én fil** styrer Node-versjonen for både lokal utvikling og
alle CI-steg, at avvik feiler tydelig og tidlig (ikke stille), og at
prosjektet har en mekanisme som sier fra når versjonen bør oppgraderes —
siden Dependabot ikke rører `.nvmrc` eller `engines.node`.

## Krav og akseptansekriterier

1. `.nvmrc` finnes med en eksakt Node-versjon, og `nvm use` / `fnm use`
   lokalt plukker denne opp uten videre konfigurasjon.
2. `package.json` har et `engines.node`-felt som uttrykker et gulv (minimum
   det avhengighetene krever, og aldri høyere enn `.nvmrc`) og et tak (ekskluderer neste major), slik at
   patch-oppdateringer innenfor major ikke krever en `engines`-endring, men
   en for gammel eller for ny Node feiler.
3. `.npmrc` har `engine-strict=true`, slik at `npm install` og `npm ci`
   **feiler hardt** (ikke bare advarer) når Node-versjonen er utenfor
   `engines.node`-range.
4. Alle åtte `actions/setup-node`-steg i `.github/workflows/` bruker
   `node-version-file: '.nvmrc'` i stedet for en hardkodet streng — CI leser
   dermed samme kilde som lokal utvikling.
5. En ny scheduled workflow sjekker ukentlig om det finnes en
   sikkerhetsutgivelse i samme major som er nyere enn den pinnede, eller en
   nyere Node LTS-linje, og åpner i så fall en label-dedupet GitHub-issue som
   påminnelse — samme mønster som `blocked-upgrades-watch.yml` (dedup mot
   åpne issues på label, ikke tittel). Sikkerhet og LTS har hver sin etikett,
   så en langvarig LTS-issue ikke skjuler sikkerhetsutgivelser.
6. `scripts/setup-worktree.sh` og øvrig dokumentasjon berøres ikke med mindre
   de faktisk refererer til en Node-versjon (verifisert: ingen treff i
   `README.md` eller `docs/` under research).

## Avgrensninger / non-goals

- **Ikke** en ny major. Oppgaven låser til nyeste 24 LTS (24.21.0). 24.12.0
  var uaktuelt, siden `jsdom@30` krever `^24.15.0` og `engine-strict` også
  håndhever avhengighetenes krav. Senere oppgraderinger initieres av
  watchdogen og gjøres som egne endringer.
- **Ikke** en generell "hold alt oppdatert"-mekanisme. Watchdogen dekker kun
  Node-major/LTS-linjen, ikke npm-versjon, andre runtimes eller verktøy.
- **Ikke** endring av `engine-strict`-oppførsel for `lambda/kontakt-form-handler`
  (egen `package.json`, egen Dependabot-blokk) — denne oppgaven dekker kun
  rot-prosjektet, med mindre research under planfasen viser at Lambda-mappen
  bygges med samme Node-versjonsforventning og bør inkluderes.
- **Ikke** varsling om EOL for *gjeldende* LTS-linje isolert — watchdogen
  varsler når en *nyere* LTS-linje enn den pinnede finnes, noe som gir god
  margin før gjeldende linje når EOL (LTS-linjer overlapper med rundt et år).

## Designvalg med begrunnelse

**Eksakt `.nvmrc` + floor-range i `engines.node` + `engine-strict=true`.**
Valgt over "eksakt versjon overalt" fordi det ville krevd at to filer
oppdateres i lås ved hver patch-bump, uten reell sikkerhetsgevinst — en
`>=24.15.0 <25.0.0`-range (gulvet er det avhengighetene krever) fanger allerede utilsiktede major-hopp og for
gamle installasjoner, mens patch-variasjon innenfor 24.x er trygt (det er
nettopp den typen avvik som forårsaket #466-hendelsen, og som en range
løser). Valgt over "kun engines, ingen `.nvmrc`, `engine-strict=false`" fordi
det ikke løser oppgavens kjernebehov: CI-steg trenger en fil å peke
`node-version-file` mot for at lokalt og CI skal dele én kilde, og en
advarsel som ikke feiler bygget blir i praksis ignorert (det er nøyaktig det
som skjedde med `EBADENGINE` lokalt).

**Scheduled watchdog-workflow, gjenbruker `blocked-upgrades-watch.yml`-mønsteret.**
Prosjektet har allerede etablert mønsteret: en cron-jobb som probe'r en
tilstand, og ved treff oppretter en label-dedupet issue (dedup mot *åpne*
issues, ikke tittel — slik at en lukket-men-ikke-løst påminnelse kommer
tilbake). Å gjenbruke dette framfor en ren tekstlig rutine i dokumentasjon
er valgt fordi manuelle rutiner uten påminnelse historisk har vist seg å bli
glemt i dette prosjektet (jf. «Scheduled Security Audit bør opprette issue,
ikke bare feile» i backlog — samme grunnprinsipp: et varsel uten oppfølging
blir ikke en oppgave). Datakilde og eksakt sjekk-logikk (Node sin offisielle
release-metadata) samt kadence avklares i planfasen.

## Åpne spørsmål

Ingen blokkerende. To operasjonelle valg er tatt gjennom bruker-dialog
forut for denne spec-en:

- Låsestrenghet: eksakt `.nvmrc` + floor-range i `engines` (ikke eksakt
  overalt, ikke kun advarsel).
- Oppdateringsrutine: scheduled watchdog-workflow (ikke kun dokumentert
  manuell rutine).
