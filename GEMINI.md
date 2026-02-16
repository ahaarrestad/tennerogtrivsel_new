# Gemini CLI Agent Instructions

This document outlines the operational guidelines and expectations for the Gemini CLI agent when interacting with this project. Adhering to these instructions ensures efficient, safe, and context-aware assistance.

## Core Principles

1.  **Adherence to Project Conventions:** Always prioritize and strictly adhere to existing project conventions (formatting, naming, architectural patterns, etc.). Analyze surrounding code, tests, and configuration first.
2.  **Tool and Library Verification:** Never assume the availability or appropriateness of a new library, framework, or tool. Verify its established usage within the project.
3.  **Idiomatic Changes:** Ensure all modifications integrate naturally and idiomatically with the local context.
4.  **Comments:** Add code comments sparingly, focusing on *why* complex logic exists.
5.  **Proactive Fulfillment:** Fulfill requests thoroughly, including adding tests for new features or bug fixes.
6.  **Confirmation for Ambiguity/Expansion:** Do not take significant actions beyond the clear scope of a request without explicit confirmation.
7.  **Security and Safety:** Prioritize security best practices. Never introduce code that exposes sensitive information.

## Kvalitetssikring (Quality Gates)

For å sikre stabilitet og unngå regresjoner, SKAL følgende sjekkliste følges før en oppgave eller endring kan markeres som ferdig:

1.  **Unit-tester:** Kjør `npm test`. Alle tester SKAL passere 100%.
2.  **Dekningsgrad (Per fil):** Sjekk coverage-rapporten fra `npm test`. **Hver enkelt fil** som inneholder kjerne-logikk (scripts og API) SKAL ha minst **80% branch coverage**. Det er ikke tilstrekkelig at totalen er over 80% hvis enkeltfiler ligger under.
3.  **E2E-tester:** Kjør `npm run test:e2e`. "Happy path" for berørt funksjonalitet SKAL verifiseres i Chromium.
4.  **Rapporteringskrav:** Før en oppgave markeres som ferdig, SKAL du liste opp de faktiske dekningsgradene (% Branch) for alle filer du har endret.
5.  **Build-sjekk:** Kjør `npm run build` lokalt for å bekrefte at prosjektet lar seg kompilere uten feil.

**AGENT-REGEL:** Du har ikke lov til å si deg ferdig eller foreslå en commit før du har presentert en fersk testrapport som viser at kravene er møtt for alle berørte filer. Enhver "ferdig"-melding uten tallgrunnlag er et brudd på instruksene. Hvis dekningsgraden faller på grunn av nye funksjoner, SKAL du skrive tester for disse før du går videre.

## Veikart: Tannleger Admin-modul

Dette veikartet beskriver implementeringen av tannlege-administrasjon.

### Fase 4: Bildehåndtering
- [x] Implementere bildevelger som lister filer fra Drive.
- [x] Implementere bildeopplasting til Drive-mappen for tannleger.
