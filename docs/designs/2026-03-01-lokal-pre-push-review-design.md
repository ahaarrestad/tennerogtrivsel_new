# Design: Lokal pre-push code review

**Dato:** 2026-03-01
**Status:** Godkjent

## Bakgrunn

Prosjektet mangler automatisk code review før kode pushes til review-branch. I dag kjøres `/quality-gate` for tester og coverage, men det er ingen sjekk av selve koden mot prosjektregler og generell kvalitet.

## Beslutninger

- **Plassering:** Nytt steg (Step 4.5) i `/commit`-skillen, mellom commit og push
- **Mekanisme:** Claude Code subagent (`superpowers:code-reviewer` type)
- **Strenghet:** Differensiert — blokkerende for sikkerhet/regelbrudd, rådgivende for kodekvalitet
- **Trigger:** Kun når brukeren ber om push (ikke ved lokal-only commit)

## Design

### Nytt steg i commit-skillen

**Step 4.5: Code Review** kjøres etter commit (step 4) og før push (step 5).

Subagenten:
1. Henter `git diff HEAD~1` (den nettopp committede endringen)
2. Leser prosjektregler fra CLAUDE.md
3. Analyserer diffen mot regler og generell kvalitet
4. Returnerer funn kategorisert som BLOKKERENDE eller RÅDGIVENDE

### Review-kategorier

**Blokkerende (stopper push):**
- Sikkerhetsproblemer (XSS, injection, eksponerte hemmeligheter)
- Hardkodede farger/hex i stedet for CSS-tokens
- Manglende `valueRenderOption: 'UNFORMATTED_VALUE'` i Sheets API-kall
- Endringer i subsystemer uten at relevant arkitekturdokument er fulgt

**Rådgivende (vises men stopper ikke):**
- Generell kodekvalitet (over-engineering, kode-lukt, feilhåndtering)
- Forbedringsforslag

### Brukerflyt

```
/commit + push
  → Step 1-4 (som i dag)
  → Step 4.5: Subagent reviewer diffen
    → Ingen funn → fortsetter til push
    → Kun rådgivende → viser funn, spør "Fortsett med push?"
    → Blokkerende → viser funn, stopper
  → Step 5-6 (push + rapport, som i dag)
```

### Fil-endringer

Kun én fil: `.claude/skills/commit/SKILL.md` — nytt steg legges til.
