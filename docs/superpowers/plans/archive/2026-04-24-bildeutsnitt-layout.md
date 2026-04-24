# Bildeutsnitt Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flytt crop-slidere (zoom + fokuspunkt) fra venstre skjemakolonne til høyre kolonne under forhåndsvisningen i galleri-editoren, slik at man kan se effekten av justeringen i sanntid.

**Architecture:** Ren HTML-layout-endring i `editGalleriBilde`-funksjonen i `admin-module-bilder.js`. Ingen logikk, datamodell eller API berøres. Mønsteret følger `admin-module-tannleger.js` (linje 132) der sliderne allerede er plassert under preview i høyre kolonne.

**Tech Stack:** Vanilla JS, Tailwind CSS v4, DOMPurify (template-string sanitering)

---

### Task 1: Flytt crop-sliders til høyre kolonne

**Files:**
- Modify: `src/scripts/admin-module-bilder.js:106-123`

- [ ] **Steg 1: Fjern `renderImageCropSliders` fra venstre kolonne**

  I `admin-module-bilder.js`, fjern linje 106:
  ```js
  // SLETT denne linjen fra venstre kolonne:
  ${renderImageCropSliders({ prefix: 'galleri-edit', valPrefix: 'galleri-val' })}
  ```

- [ ] **Steg 2: Legg til `renderImageCropSliders` i høyre kolonne under preview**

  Etter `</div>` som lukker `galleri-preview-container` (linje 122), og før den ytre `</div>` for høyre kolonne (linje 123), legg til:
  ```js
  ${renderImageCropSliders({ prefix: 'galleri-edit', valPrefix: 'galleri-val' })}
  ```

  Resultatet for høyre kolonne skal se slik ut:
  ```html
  <div class="space-y-4">
      <h3 id="galleri-preview-label" class="text-brand font-black uppercase tracking-tighter text-center lg:text-left"></h3>
      <div id="galleri-preview-container" class="rounded-2xl border-4 border-white shadow-md overflow-hidden bg-admin-hover relative">
          <div id="galleri-no-image" class="absolute inset-0 flex flex-col items-center justify-center text-admin-muted-light">
              <svg ...></svg>
              <span class="text-xs font-black uppercase tracking-widest mt-2">Velg bilde</span>
          </div>
          <img id="galleri-preview-img" src="" class="absolute inset-0 w-full h-full object-cover transition-all duration-75 hidden" style="">
      </div>
      ${renderImageCropSliders({ prefix: 'galleri-edit', valPrefix: 'galleri-val' })}
  </div>
  ```

- [ ] **Steg 3: Kjør eksisterende tester**

  ```bash
  npx vitest run src/scripts/__tests__/admin-module-bilder.test.js
  ```
  Forventet: alle tester passerer (layout-endringen berører ingen logikk).

- [ ] **Steg 4: Commit**

  ```bash
  git add src/scripts/admin-module-bilder.js
  git commit -m "fix: flytt bildeutsnitt-sliders til høyre kolonne under forhåndsvisningen"
  ```
