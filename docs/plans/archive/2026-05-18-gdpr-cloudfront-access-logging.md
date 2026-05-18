# GDPR: Avklar og dokumenter CloudFront access logging — Implementasjonsplan

**Goal:** Bekreft og dokumenter at CloudFront access logging ikke er aktivert, slik at personvernerklæringens påstand om at nettsiden ikke samler inn personopplysninger er korrekt.

**Alvorlighetsnivå:** Middels → **reell risiko er lav** (logging er av, se funn under)

---

## Funn (verifisert 2026-05-18 via AWS CLI)

Begge CloudFront-distribusjoner har logging **deaktivert**:

| Distribusjon | ID | Logging |
|---|---|---|
| Tenner og Trivsel (prod) | `E9Z51DQB2K1G4` | ❌ Disabled |
| Test-side | `E2WXX7ZUR5NNP3` | ❌ Disabled |

Personvernerklæringens påstand på linje 35 i `src/pages/personvern.astro` — «Nettsiden vår samler **ikke** inn personopplysninger fra besøkende» — er korrekt med tanke på server-side logging.

---

## Gjenstående valg

### Alternativ A — Lukk uten kodeendring (minimalisme)
Funnet er dokumentert i denne planen. Ingen endringer i kildekode. Arkiver oppgaven.

### Alternativ B — Legg til defensiv setning i personvernerklæringen (anbefalt)
Gjør det eksplisitt at server-side logging ikke brukes, slik at påstanden er robust også ved fremtidig revisjon eller spørsmål fra brukere/tilsynsmyndighet.

Implementert tekst i `src/pages/personvern.astro` (linje 37–38):

```html
Server-side access logging er heller ikke aktivert — trafikklogger (inkludert IP-adresser)
lagres ikke i vår skyinfrastruktur.
```

---

## Gjennomføring

- [x] Diskuter alternativ A vs. B med bruker → valgt B
- [x] Gjennomfør valgt alternativ — setning lagt til i `src/pages/personvern.astro`
- [x] Quality gate + commit
