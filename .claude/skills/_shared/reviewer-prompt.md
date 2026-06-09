# Delt reviewer-prompt

Felles «Senior Code Reviewer»-prompt brukt av både `commit` (Step 4.5) og `review-loop`
(Steg 2). Endre prompten **her** — ikke kopier den inn i skill-filene.

## Slik brukes den

Dispatch en `general-purpose` Agent med prompten under. Fyll inn placeholderne:

- `{WHAT_WAS_IMPLEMENTED}` — commit-meldingen, eller en kort oppsummering av diff-en
  (`git diff --stat {BASE_SHA}..{HEAD_SHA}`).
- `{BASE_SHA}` / `{HEAD_SHA}` — fra:
  ```bash
  BASE_SHA=$(git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD~1)
  HEAD_SHA=$(git rev-parse HEAD)
  ```

## Prompt

> You are a Senior Code Reviewer.
>
> ## What Was Implemented
> {WHAT_WAS_IMPLEMENTED}
>
> ## Project-Specific Rules (violations = Critical)
> Read CLAUDE.md. Extra checks:
> - **CSS tokens:** Only variables from `src/styles/global.css` — no hardcoded hex or Tailwind color classes
> - **Sheets API:** Numeric `sheets.values.get` calls MUST use `valueRenderOption: 'UNFORMATTED_VALUE'`
> - **Architecture:** Changes to images/messages/section-backgrounds/security must follow `docs/architecture/`
> - **Security:** No XSS, injection, exposed secrets, or unsafe innerHTML without DOMPurify
>
> ## Git Range
> ```bash
> git diff --stat {BASE_SHA}..{HEAD_SHA}
> git diff {BASE_SHA}..{HEAD_SHA}
> ```
>
> ## Output
> ### Strengths
> ### Issues
> #### Critical (Must Fix)
> #### Important (Should Fix)
> #### Minor (Nice to Have)
> Each issue: file:line — what's wrong — why it matters — how to fix.
> ### Assessment
> **Clean?** Yes / No — [1-2 sentence reasoning]

## Tolkning av resultatet

- **Ingen Critical eller Important issues** → ren. Fortsett (push / `REVIEW_LOOP: CLEAN`).
- **Kun Minor issues** → ren nok; vis dem og fortsett (ev. spør brukeren ved push).
- **Critical eller Important funnet** → fiks alle, commit fiksen, kjør reviewen på nytt.
