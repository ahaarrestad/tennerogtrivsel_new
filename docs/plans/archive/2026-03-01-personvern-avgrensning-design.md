# Design: Personvernerklæring — avgrensning til nettsiden

## Motivasjon

Besøkende skal forstå at personvernerklæringen kun gjelder nettsiden, ikke klinikkens behandling av pasientdata (journal, booking osv.).

## Endring

Legg til et innledende avsnitt rett under `<h1>` (før «Sist oppdatert»-linjen) i `src/pages/personvern.astro`:

> Denne personvernerklæringen gjelder for nettsiden til Tenner og Trivsel (tennerogtrivsel.no, tennerogtrivsel.com og tennerogtrivsel.net) og beskriver hvordan vi behandler opplysninger i forbindelse med ditt besøk. Behandling av helseopplysninger knyttet til pasientbehandling reguleres av helse- og personvernlovgivningen — ta kontakt med klinikken hvis du har spørsmål om dette.

I tillegg oppdateres `<Layout>`-attributten `description` fra domene-spesifikk til domene-nøytral.

## Berørte filer

- `src/pages/personvern.astro` — eneste fil som endres
