# Plan: Gemini AI-drevet PR-review

> **Status: PÅGÅENDE** — oppdatert med Gemini CLI forbedringer

## Mål

Bruke AI som automatisk kodereviewer på alle pull requests, slik at hver PR får gjennomgang av kodeendringer før merge — **uten kostnad**.

## Bakgrunn: Valg av verktøy

Vi bruker Gemini-baserte alternativer som er gratis og integrert med Google-økosystemet.

| Verktøy | Kostnad | Oppsett | Modellvalg | Konfigurerbarhet |
|---------|---------|---------|------------|------------------|
| **Gemini Code Assist** | Gratis (GitHub App) | Installer fra Marketplace | Google velger | Begrenset |
| **PR-Agent + Gemini API** | Gratis (API free tier) | GitHub Action + API-nøkkel | gemini-1.5-pro/flash | Svært høy |
| CodeRabbit | Gratis for public repos | Installer GitHub App | CodeRabbit velger | Middels |

## Anbefaling: To-faset tilnærming

**Fase 1 — Gemini Code Assist** (enklest mulig start):
- Null konfigurasjon, installer GitHub App og ferdig.
- Automatisk review på alle PR-er innen ~5 min.

**Fase 2 — PR-Agent + Gemini API** (for prosjektspesifikk kontroll):
- Bruker `gemini-1.5-pro` for best resonnering og `gemini-1.5-flash` som fallback.
- Inkluderer instrukser fra `CLAUDE.md` og `GEMINI.md`.

---

## Fase 0: Lokal Pre-flight Sjekk (Gemini CLI)

Før `git review` kjøres, bør Gemini CLI brukes for en lokal sjekk:
- *"Gemini, kjør en review av mine endringer mot CLAUDE.md før jeg pusher."*
- Dette fanger opp feil tidlig og sparer API-kvote i skyen.

---

## Fase 1: Gemini Code Assist (GitHub App)

### Steg 1.1: Installer Gemini Code Assist
*(Manuelt steg i GitHub Marketplace)*

### Steg 1.2: Oppdater `auto-pr.yml` — fjern auto-approve
Fjern auto-approve-steget i `.github/workflows/auto-pr.yml` slik at Gemini faktisk får tid til å reviewe før PR merges.

### Steg 1.3: Konfigurer branch protection (anbefalt)
Sett opp regler i GitHub for å kreve minst én manuell approval før merge, basert på AI-feedbacken.

---

## Fase 2: PR-Agent + Gemini API (Prosjektspesifikk)

### Steg 2.1: Opprett Gemini API-nøkkel & GitHub Secret
Opprett `GEMINI_API_KEY` i GitHub Secrets.

### Steg 2.2: Opprett PR-Agent workflow
Opprett `.github/workflows/pr-agent.yml` med støtte for Gemini 1.5 modeller.

### Steg 2.3: Konfigurer `.pr_agent.toml` med prosjektregler
Legg til spesifikke instrukser for å sikre at AI følger våre mandater:

```toml
[pr_reviewer]
extra_instructions = """
- Du SKAL følge mandatene i `CLAUDE.md` og `GEMINI.md` i roten av repoet.
- Kvalitetskrav: sjekk at branch coverage er ivaretatt for ny logikk (>80%).
- Arkitektur: sjekk endringer mot relevante dokumenter i `docs/architecture/`.
- Sheets API: numeriske felter SKAL bruke valueRenderOption: 'UNFORMATTED_VALUE'.
- Design: sjekk at CSS bruker tokens fra `src/styles/global.css`.
"""
```

---

## Forventet flyt

1. **Lokal endring** → Gemini CLI sjekk.
2. **`git review`** → PR opprettes.
3. **AI Review** → Gemini Code Assist + PR-Agent gir feedback.
4. **Manuell sjekk** → Bruker leser feedback og godkjenner.
5. **Auto-merge** → PR merges når alle sjekker er grønne.
