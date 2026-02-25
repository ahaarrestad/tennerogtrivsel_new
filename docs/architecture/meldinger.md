# Arkitektur: Meldinger (InfoBanner)

## Datofiltrering: Klient, IKKE byggetid

`active-messages.json.ts` returnerer **alle** meldinger uten datofiltrering. Filtrering skjer i `messageClient.js` ved runtime (`new Date()` mot `startDate`/`endDate`).

**Hvorfor:** Prosjektet bygges statisk (`output: 'static'`). Hvis API-ruten filtrerer ved byggetid, fryses resultatet i JSON-filen. Meldinger som utløper mellom bygg forblir synlige, og nye meldinger dukker ikke opp før neste bygg. Klient-side filtrering sikrer at meldinger alltid er oppdatert.

**VIKTIG:** Ikke flytt datofiltrering tilbake til API-ruten — dette er en bevisst arkitekturbeslutning, ikke en forglemmelse.
