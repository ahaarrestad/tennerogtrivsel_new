# Gjenoppta pågående oppgave

> Denne fila lastes av `todo`-skillen når brukeren vil **fortsette på en oppgave som
> allerede er i Pågående** (fra en tidligere sesjon).

**Første steg — verifiser, ikke anta:**

1. Kjør worktree-sjekk for å bekrefte at arbeidet skjer på riktig sted:
   ```bash
   git rev-parse --path-format=absolute --git-dir --git-common-dir
   git worktree list
   git branch --show-current
   ```
   - **Ulike stier** (vi står allerede i et worktree, f.eks. `claude -w`): fortsett til steg 3.
   - **Like stier** (hovedrepoet): gå til steg 2.
2. Entre oppgavens eksisterende worktree med `EnterWorktree (path: <sti fra git worktree list>)`
   — da virker `ExitWorktree (keep)` i `/commit` 5c senere. Finnes det ikke: opprett nytt via
   `superpowers:using-git-worktrees`.
3. Bekreft hvilken branch/worktree som er aktiv, og at den tilhører oppgaven, før arbeidet begynner

**Aldri anta at worktree-oppsettet fra forrige sesjon er på plass — verifiser alltid.**
