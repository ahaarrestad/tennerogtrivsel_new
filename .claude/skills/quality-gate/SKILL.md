---
name: quality-gate
description: "Use when completing a task, before committing, or when asked to verify quality. Trigger on: 'quality gate', 'kjør kvalitetssjekk', 'run checks', 'er alt klart', 'verify tests', 'coverage', 'dekningsgrad', 'show coverage', 'sjekk coverage', 'branch coverage'."
disable-model-invocation: false
allowed-tools: ["Bash(npm test*)", "Bash(npm run *)", "Bash(npx playwright*)", "Bash(npm audit*)", "Bash(bash scripts/setup-worktree.sh)", "Bash(bash .claude/skills/_shared/run-e2e.sh*)", "Bash(git *)"]
---

# Quality Gate

Eneste kilde for kvalitetsporten. `/commit` kaller denne — ikke kopier stegene inn andre steder.

## Når porten gjelder

Se på hvilke filer som er endret siden sist porten var grønn:

Enkle, separate kommandoer (worktree-isolerte økter nekter git inni `$(...)`):

```bash
git rev-parse -q --verify refs/worktree/gated          # settes av /commit etter grønn port
git merge-base --is-ancestor refs/worktree/gated HEAD; echo $?
git merge-base HEAD origin/main
git diff --name-only <BASE>    # committet + uncommittet siden BASE
git status --porcelain         # også usporede filer (nye tester o.l.)
```

`<BASE>` = `refs/worktree/gated` hvis den finnes og er stamfar til HEAD (`0`), ellers
merge-basen. Da fanges også fix-commits fra `review-loop`, ikke bare uncommittede endringer.

- **Minst én sti som ikke er dokumentasjon** (se under) → kjør hele porten.
- **Kun dokumentasjon** → hopp over porten og si eksplisitt hvorfor. Endringen kan ikke påvirke
  tester, build eller audit.

### Hva regnes som dokumentasjon

Eneste definisjon — `/commit` (4.5 og 5a) viser hit. En sti er dokumentasjon bare hvis den er
`*.md` under `docs/`, `TODO*.md`, eller `*.md` under `.claude/`. Alt annet — inkludert
`.claude/**/*.sh`, `.claude/settings*.json`, `CLAUDE.md`-endringer sammen med kode — utløser porten.

Unntak for review i `/commit` 4.5: `.claude/skills/**` regnes **ikke** som dokumentasjon der.
Skills er kjørbare agent-instruksjoner (`allowed-tools`, push-godkjenning), så endringer i dem
skal sees av en fersk reviewer, ikke bare av agenten som skrev dem.

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
bash .claude/skills/_shared/run-e2e.sh > "$SCRATCH/e2e.txt" 2>&1; echo "exit=$?"
```

`$SCRATCH` = øktens scratchpad-katalog (skriv stien literalt). Les sammendraget og ev. feilede
tester fra fila. Scriptet velger selv port: 4321 i hovedrepoet, en fast port utledet fra stien i
en worktree — slik at E2E aldri kjører mot en annen checkouts server.

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

Ved grønn port på et rent arbeidstre (`git status --porcelain` tom, også uten usporede filer):
`git update-ref refs/worktree/gated HEAD`. (Kjøres porten
før commit, setter `/commit` refen etter commit i stedet.) Refen avgjør om porten må kjøres på
nytt før push.

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
