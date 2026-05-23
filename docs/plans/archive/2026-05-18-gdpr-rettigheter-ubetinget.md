# GDPR – rettigheter og klagerett ubetinget synlig

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flytt rettighetsavsnittet i personvernerklæringen ut av den betingede kontaktskjema-blokken, slik at det alltid vises.

**Architecture:** Ren template-endring i én Astro-fil. `{visKontaktPersonvern && (...)}` beholder kontaktskjema-seksjonen, men rettighetsavsnittet løftes ut og plasseres like før `<h2>Kontakt</h2>`. Ingen ny logikk, ingen nye filer, ingen nye avhengigheter.

**Tech Stack:** Astro 5, statisk HTML

---

### Task 1: Flytt rettighetsavsnittet i personvern.astro

**Files:**
- Modify: `src/pages/personvern.astro:49-72`

- [ ] **Steg 1: Gjør endringen i personvern.astro**

  Bytt ut denne blokken (linje 49–72):

  ```astro
  {visKontaktPersonvern && (
      <h2>Kontaktskjema</h2>
      <p>
          Nettstedet har et kontaktskjema der du kan sende oss en direkte henvendelse.
      </p>
      <table>
          <tbody>
              <tr><th scope="row">Hva samles inn</th><td>Navn, e-post, telefon, melding og tema</td></tr>
              <tr><th scope="row">Formål</th><td>Besvare henvendelser fra besøkende</td></tr>
              <tr><th scope="row">Rettslig grunnlag</th><td>Ditt samtykke (avkrysning i skjemaet)</td></tr>
              <tr><th scope="row">Lagringstid</th><td>Overføres på e-post og lagres i klinikkens e-postarkiv</td></tr>
              <tr><th scope="row">Databehandler</th><td>Amazon Web Services (SES) for e-postutsending</td></tr>
          </tbody>
      </table>
      <p>
          Du har rett til innsyn, retting og sletting av opplysningene, og du kan klage til
          <a
              href="https://www.datatilsynet.no/om-datatilsynet/kontakt-oss/"
              target="_blank"
              rel="noopener noreferrer"
              >Datatilsynet</a>.
          Ta kontakt med klinikken for å utøve dine rettigheter.
      </p>
  )}
  ```

  Med dette (kontaktskjema-avsnittet uten rettighetssetning, etterfulgt av frittstående rettighetsavsnitt):

  ```astro
  {visKontaktPersonvern && (
      <h2>Kontaktskjema</h2>
      <p>
          Nettstedet har et kontaktskjema der du kan sende oss en direkte henvendelse.
      </p>
      <table>
          <tbody>
              <tr><th scope="row">Hva samles inn</th><td>Navn, e-post, telefon, melding og tema</td></tr>
              <tr><th scope="row">Formål</th><td>Besvare henvendelser fra besøkende</td></tr>
              <tr><th scope="row">Rettslig grunnlag</th><td>Ditt samtykke (avkrysning i skjemaet)</td></tr>
              <tr><th scope="row">Lagringstid</th><td>Overføres på e-post og lagres i klinikkens e-postarkiv</td></tr>
              <tr><th scope="row">Databehandler</th><td>Amazon Web Services (SES) for e-postutsending</td></tr>
          </tbody>
      </table>
  )}

  <p>
      Du har rett til innsyn, retting og sletting av opplysninger vi behandler om deg, og du kan klage til
      <a
          href="https://www.datatilsynet.no/om-datatilsynet/kontakt-oss/"
          target="_blank"
          rel="noopener noreferrer"
          >Datatilsynet</a>.
      Ta kontakt med klinikken for å utøve dine rettigheter.
  </p>
  ```

  Plasseringen er like før `<h2>Kontakt</h2>` (som allerede er der).

- [ ] **Steg 2: Bygg og verifiser visuelt**

  ```bash
  npm run build 2>&1 | tail -5
  ```

  Forventet: bygget uten feil. Åpne deretter `dist/personvern/index.html` og sjekk at rettighetsavsnittet finnes i HTML-en:

  ```bash
  grep -c "Du har rett til innsyn" dist/personvern/index.html
  ```

  Forventet output: `1`

- [ ] **Steg 3: Commit**

  ```bash
  git add src/pages/personvern.astro
  ```

  Commit-melding (via `/commit`-skill):
  `fix: vis rettigheter og klagerett i personvern uavhengig av kontaktskjema`
