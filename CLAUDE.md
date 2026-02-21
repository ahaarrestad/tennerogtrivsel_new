# Claude Code Instructions

This document outlines the operational guidelines and expectations for the Claude Code agent when interacting with this project. Adhering to these instructions ensures efficient, safe, and context-aware assistance.

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
6.  **CI/CD Konsistens:** Hvis du har lagt til en ny miljøvariabel (i `.env`, `src/env.d.ts` eller `sync-data.js`), SKAL du verifisere at denne også er lagt til i relevante workflow-filer i `.github/workflows/` (både for `test` og `build` steg).

**AGENT-REGEL:** Du har ikke lov til å si deg ferdig eller foreslå en commit før du har presentert en fersk testrapport som viser at kravene er møtt for alle berørte filer. Enhver "ferdig"-melding uten tallgrunnlag er et brudd på instruksene. Hvis dekningsgraden faller på grunn av nye funksjoner, SKAL du skrive tester for disse før du går videre. Ved innføring av nye avhengigheter eller miljøvariabler SKAL du eksplisitt sjekke og oppdatere CI-konfigurasjonen.

## Sikkerhet

### DOMPurify og innerHTML
All HTML som settes via `innerHTML` og som inneholder bruker- eller CMS-generert innhold, SKAL saniteres med DOMPurify. **DOMPurify fjerner alle inline event-handlere** (f.eks. `onclick="..."`). Event-lyttere MÅ derfor alltid knyttes programmatisk etter at `innerHTML` er satt — aldri som attributter i template-strenger.

```js
// Feil – onclick strippes av DOMPurify og har ingen effekt:
inner.innerHTML = DOMPurify.sanitize(`<div onclick="doSomething()">...</div>`);

// Riktig – knytt lyttere programmatisk etterpå:
inner.innerHTML = DOMPurify.sanitize(html);
inner.querySelectorAll('.my-btn').forEach(btn => {
    btn.addEventListener('click', () => doSomething());
});
```

I node-miljø (Vitest) finnes ingen DOM, så DOMPurify må mockes i testfiler:
```js
vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }));
```

### Middleware og produksjonsmiljø
`src/middleware.ts` setter HTTP-sikkerhetsheadere (CSP, X-Frame-Options, m.fl.) og kjører i Astro dev-server og for SSR-endepunkter. **Prosjektet deployes som statiske filer til AWS S3 og har ingen kjørende server i produksjon.** Middleware påvirker derfor ikke produksjon. Dersom disse headerne skal gjelde i prod, må de konfigureres i CloudFront (Response Headers Policy) eller S3.

### CSP-verifisering
`tests/csp-check.spec.ts` er et manuelt verktøy for å avdekke CSP-brudd på tvers av nøkkelsider. Kjør det når `src/middleware.ts` endres, mens dev-server kjører:
```
npx playwright test csp-check --project=chromium
```

### Web Storage og modul-tilstand i tester
- Når kode under test bruker Web Storage, SKAL **begge** `localStorage.clear()` og
  `sessionStorage.clear()` kalles i `beforeEach` – ikke bare én av dem.
- `admin-client.js` har modul-nivå-variabler (`tokenClient`, `_rememberMe`, `gapiInited`,
  `gisInited`) som **ikke** nullstilles av `vi.clearAllMocks()`. Tester som er sensitive
  for denne tilstanden MÅ eksplisitt kalle de eksporterte setter-funksjonene
  (f.eks. `setRememberMe(false)`) i `beforeEach`.
