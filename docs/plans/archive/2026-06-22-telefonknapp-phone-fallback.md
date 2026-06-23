# TelefonKnapp.astro — fallback for `settings.phone1`

> Trivial oppgave — spec og plan slått sammen (§0-snarvei).

## Problem / mål

`src/components/TelefonKnapp.astro` gjør `const phone = settings.phone1; const cleanPhone = phone.replace(...)`.
Hvis `settings.phone1` er `undefined` kaster `phone.replace(...)` `TypeError` på byggetid. I praksis
gjør `HARD_DEFAULTS.phone1` + loader-coercion (`|| ''`) at den realistiske feilmodusen er tom streng
snarere enn `undefined`, så krasjen er mest teoretisk — men `Footer.astro` bruker allerede
`settings.phone1?.replace(...)` som guard, og komponentene skal være konsistente og robuste.

## Krav / akseptansekriterier

- `const phone = settings.phone1 ?? '';` — fallback til tom streng
- `cleanPhone` og template-verdier er alltid strenger, aldri `undefined`
- Ingen funksjonell endring når `phone1` finnes

## Avgrensning / non-goals

- Ingen endring i `Footer.astro` eller andre komponenter — de er allerede korrekte
- Ingen endring i `getSiteSettings()`-typer

## Steg

1. `src/components/TelefonKnapp.astro` linje 6: `const phone = settings.phone1 ?? '';`

## Test / definition of done

- `npm run build` fullfører uten feil
- Visuell verifisering i dev (uendret oppførsel når telefon finnes)

## Risiko

Ingen — fallback til tom streng er trygt og konsistent med søsterkomponenten.
