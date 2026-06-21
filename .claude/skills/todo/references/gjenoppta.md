# Gjenoppta pågående oppgave

> Denne fila lastes av `todo`-skillen når brukeren vil **fortsette på en oppgave som
> allerede er i Pågående** (fra en tidligere sesjon).

**ALLTID første steg — ingen unntak:**

1. Kjør worktree-sjekk for å bekrefte at arbeidet skjer på riktig sted:
   ```bash
   GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
   GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
   git worktree list
   git branch --show-current
   ```
   - Hvis `GIT_DIR == GIT_COMMON`: vi er i hovedrepoet, IKKE i en worktree — stopp og korriger
   - Hvis `GIT_DIR != GIT_COMMON`: vi er allerede i en worktree — fortsett
2. Invoke `superpowers:using-git-worktrees` for å entre riktig worktree (eller opprette ny ved behov)
3. Bekreft hvilken branch/worktree som er aktiv før arbeidet begynner

**Aldri anta at worktree-oppsettet fra forrige sesjon er på plass — verifiser alltid.**
