# Spec: Støtte for ett telefonnummer

**Dato:** 2026-03-24
**Status:** Godkjent

## Bakgrunn

Klinikken skal fremover kun ha ett telefonnummer. `phone2`-feltet fjernes fra hele systemet.

## Endringer

| Fil | Endring |
|-----|---------|
| `src/content/innstillinger.json` | Fjern `phone2`-oppføringen |
| `src/scripts/getSettings.ts` | Fjern `phone2` fra defaults og type |
| `src/components/Kontakt.astro` | Fjern rendering av `phone2` |
| `src/components/Footer.astro` | Fjern betinget `phone2`-blokk |
| `src/scripts/admin-module-settings.js` | Fjern `phone2`-hint |
| `src/scripts/sync-data.js` | Fjern `phone2` fra `HARD_DEFAULT_KEYS` |
| Tester | Oppdater/fjern `phone2`-referanser |

## Avgrensning

- `phone1` forblir uendret overalt
- Ingen ny logikk — kun sletting av `phone2`
- `sentralbordTekst` beholdes uendret
