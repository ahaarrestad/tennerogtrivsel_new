---
name: review-loop
description: "Use after implementing a feature or task (TODO-flyten Fase 4). Reviews the branch diff, fixes Critical and Important issues, commits the fixes and re-reviews until clean (max 3 rounds)."
disable-model-invocation: false
allowed-tools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash(git *)", "Agent"]
---

# Review Loop

Review diffen på denne branchen, fiks blokkerende funn og review på nytt — i samme tur — til
reviewen er ren eller 3 runder er brukt.

## Steg 1: Finn git-range

Fetch først: `BASE_SHA` regnes mot `origin/main`, og en utdatert ref gir stille feil range.

```bash
git fetch origin
BASE_SHA=$(git merge-base HEAD origin/main)
HEAD_SHA=$(git rev-parse HEAD)
git log --oneline $BASE_SHA..$HEAD_SHA
```

Viser rangen andre commits enn forventet — finn ut hvorfor før du går videre. For vid range
gir review av allerede merget kode; for smal går glipp av endringer.

## Steg 2: Review

Dispatch en `general-purpose` Agent med den delte prompten i
[`../_shared/reviewer-prompt.md`](../_shared/reviewer-prompt.md). Fyll inn
`{WHAT_WAS_IMPLEMENTED}` (fra TODO-oppgaven, eller en kort oppsummering av
`git diff --stat $BASE_SHA..$HEAD_SHA`), `{BASE_SHA}` og `{HEAD_SHA}`.

En fersk agent er poenget: den har ikke implementasjonens antakelser. Vurder funnene kritisk
før du fikser — er edge caset realistisk her, strider forslaget mot en tidligere beslutning?

## Steg 3: Evaluer og loop

**Critical eller Important funnet:** fiks dem, stage kun berørte filer (`git add <fil>` — aldri
`-A`/`.`, aldri `.env*`, credentials, `node_modules/`, `coverage/`) og commit:

```bash
git commit -m "$(cat <<'EOF'
fix: reviewfiks — <kort beskrivelse>

<attribusjonslinjene harnessen oppgir for denne økten>
EOF
)"
```

Sett `HEAD_SHA=$(git rev-parse HEAD)`, behold `BASE_SHA`, og gå til Steg 2 igjen. Etter 3 runder
uten ren review: stopp og presenter gjenstående funn for brukeren.

**Ren (ingen Critical/Important):** marker rangen som reviewet, så `/commit` ikke reviewer den
samme koden på nytt:

```bash
git update-ref refs/worktree/reviewed $HEAD_SHA
```

Avslutt med:
```
REVIEW_LOOP: CLEAN  (<antall> runder, HEAD <kort-sha>)
<ev. Minor-funn>
Klar for arkivering (Fase 5) og /commit.
```
