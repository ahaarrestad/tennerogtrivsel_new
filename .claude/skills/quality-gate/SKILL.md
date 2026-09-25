---
name: quality-gate
description: "Use when completing a task, before committing, or when asked to verify quality. Trigger on: 'quality gate', 'kjør kvalitetssjekk', 'run checks', 'er alt klart', 'verify tests', 'coverage', 'dekningsgrad', 'show coverage', 'sjekk coverage', 'branch coverage'."
disable-model-invocation: false
allowed-tools: ["Bash(npm test*)", "Bash(npm run *)", "Bash(npx playwright*)", "Bash(npm audit*)", "Bash(bash scripts/setup-worktree.sh)", "Bash(bash .claude/skills/_shared/run-e2e.sh*)", "Bash(git *)"]
---

# Quality Gate

Eneste kilde for kvalitetsporten. `/commit` kaller denne — ikke kopier stegene inn andre steder.

## Når porten gjelder

Se på hvilke filer som faktisk endres (`git diff --name-only` mot basen, pluss staged/unstaged):

- **Berører `src/`, `scripts/`, `api/`, `lambda/`, `tests/`, config (`*.config.*`, `tsconfig`, `.github/`) eller `package*.json`** → kjør hele porten.
- **Kun dokumentasjon / `.claude/`-prosa / `TODO*.md`** → hopp over porten og si eksplisitt hvorfor. Endringen kan ikke påvirke tester, build eller audit.
- **Blandet** → kjør hele porten.

Er du i tvil, kjør den. Stopp ved første feil og rapporter — ikke fortsett til neste steg.

## Steg 0: Worktree-forberedelse

I en worktree mangler gitignorerte filer (innhold, bilder, `.env`). Scriptet er idempotent og
ufarlig i hovedrepoet, så kjør det alltid fra rot-katalogen:

```bash
bash scripts/setup-worktree.sh
```

## Steg 1–3: Lint, unit-tester, branch coverage

```bash
npm run lint 2>&1            # errors stopper, warnings er ok
npm test 2>&1                # vitest + coverage
npm run coverage:check 2>&1  # ≥ 80 % branch coverage per fil, exit 1 ved brudd
```

Faller en fil under 80 %: skriv tester før du går videre (se `docs/guides/test-guide.md`).

## Steg 4: E2E

E2E krever `dev:secure` med korrekte CSP-hashes. `astro dev` backgrounder seg selv under en
AI-agent, så Playwrights `webServer` kan ikke starte den — bruk det delte scriptet (starter eller
gjenbruker serveren, kjører testene, rydder opp):

```bash
bash .claude/skills/_shared/run-e2e.sh 2>&1 | tail -15   # i worktree: PORT=4322 e.l.
```

## Steg 5: Build

```bash
npm run build:ci 2>&1
```

(`build:ci` — ikke `build` — så porten ikke er avhengig av live Drive-sync.)

## Steg 6: Security audit

```bash
npm audit --audit-level=critical 2>&1
```

Samme nivå som CI i `.github/workflows/deploy.yml`. Ved funn: pakke, alvorlighet og foreslått fiks.

## Steg 7: CI/CD-variabler

Har økten lagt til miljøvariabler (`.env`, `src/env.d.ts`, `sync-data.js`)? Sjekk at de finnes
i `.github/workflows/` for både test- og build-steg.

## Steg 8: Rapport

Noter `git rev-parse HEAD` og om arbeidstreet var rent — `/commit` bruker det til å avgjøre om
porten må kjøres på nytt før push.

```
## Quality Gate Report  (HEAD <sha>)
ESLint:        PASS/FAIL — X errors, Y warnings
Unit:          PASS/FAIL — X passed, Y failed
Coverage:      PASS/FAIL — laveste filer (FAIL < 80 %, OK 80–90 %, GOOD > 90 %)
E2E:           PASS/FAIL — X passed, Y failed, Z skipped
Build:         PASS/FAIL
Audit:         PASS/FAIL
CI-variabler:  OK / mangler: …
**Overall: PASS / FAIL**
```

Vis bare coverage-rader som er FAIL eller OK, pluss antallet GOOD — ikke hele lista.
