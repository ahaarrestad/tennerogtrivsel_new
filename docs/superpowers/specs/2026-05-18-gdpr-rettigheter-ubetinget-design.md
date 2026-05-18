# Design: GDPR – gjør rettigheter og klagerett ubetinget synlig

**Dato:** 2026-05-18
**Alvorlighetsnivå:** Lav–Middels

## Bakgrunn

I `src/pages/personvern.astro` er avsnittet om registrertes rettigheter (innsyn, retting, sletting og klagerett til Datatilsynet) i dag pakket inn i en betinget blokk som bare vises når kontaktskjemaet er aktivt (`visKontaktPersonvern === true`).

Ansatte som har navn og bilde på siden behandles som registrerte under GDPR (art. 6 nr. 1 bokstav a – samtykke), og har disse rettighetene uavhengig av kontaktskjemaet. At rettighetsavsnittet er skjult når skjemaet er deaktivert er derfor ikke korrekt.

## Endring

### Hva

Flytt rettighetsavsnittet ut av `{visKontaktPersonvern && (...)}` og plasser det som et frittstående avsnitt rett før `<h2>Kontakt</h2>`.

Teksten justeres minimalt for å gi mening uten kontaktskjema-kontekst:

- Før: «av opplysningene»
- Etter: «av opplysninger vi behandler om deg»

Ingen ny overskrift legges til.

### Hva forblir betinget

Resten av kontaktskjema-blokken (overskriften `<h2>Kontaktskjema</h2>`, beskrivelsesteksten og tabellen) beholdes inne i den betingede blokken.

## Resultat

```astro
{visKontaktPersonvern && (
    <h2>Kontaktskjema</h2>
    <p>Nettstedet har et kontaktskjema ...</p>
    <table>...</table>
)}

<p>
    Du har rett til innsyn, retting og sletting av opplysninger vi behandler om deg,
    og du kan klage til
    <a href="https://www.datatilsynet.no/om-datatilsynet/kontakt-oss/"
       target="_blank" rel="noopener noreferrer">Datatilsynet</a>.
    Ta kontakt med klinikken for å utøve dine rettigheter.
</p>

<h2>Kontakt</h2>
```

## Testing

- Verifiser at avsnittet vises i nettleseren uavhengig av `visKontaktPersonvern`-verdien.
- Ingen ny logikk, ingen nye avhengigheter — ingen unit-tester nødvendig.
