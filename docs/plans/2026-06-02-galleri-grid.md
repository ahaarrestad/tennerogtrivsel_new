# Galleri-grid fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjern 3-kolonners-steget fra galleri-gridet slik at layouten alltid er 2×2 (< 1024px) eller 4×1 (≥ 1024px), aldri 3+1.

**Architecture:** Ren markup-endring i én Astro-komponent. `md:grid-cols-3` fjernes fra grid-klassen, og `sizes`-attributtet på `<Image>` oppdateres til å matche den nye breakpoint-strukturen.

**Tech Stack:** Astro, Tailwind CSS v4

---

> **Merk:** `src/pages/tannleger.astro:23` bruker samme grid-mønster, men er bevisst utelatt. Tannleger-siden har variabelt antall kort (ikke alltid 4), og 3 kolonner på nettbrett er riktig atferd der. Fiksen er kun for galleriet som alltid viser nøyaktig 4 bilder i preview.

### Task 1: Fiks grid-klasse og sizes-attributt

**Files:**
- Modify: `src/components/Galleri.astro:30,43`

- [ ] **Steg 1: Endre grid-klassen (linje 30)**

  Fra:
  ```
  grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4
  ```
  Til:
  ```
  grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4
  ```

- [ ] **Steg 2: Oppdater sizes-attributtet (linje 43)**

  Fra:
  ```
  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
  ```
  Til:
  ```
  sizes="(min-width: 1024px) 25vw, 50vw"
  ```

- [ ] **Steg 3: Visuell verifikasjon**

  Kjør dev-server:
  ```bash
  npm run dev
  ```
  Åpne `http://localhost:4321` i nettleser. Sjekk galleri-seksjonen ved:
  - **768px–1023px** (DevTools → responsiv modus): skal vise 2 kolonner (2×2)
  - **≥ 1024px**: skal vise 4 kolonner (4×1)
  - **< 768px**: skal vise 2 kolonner (2×2)

  Sjekk også `/galleri/`-siden ved samme breakpoints.

- [ ] **Steg 4: Commit**

  ```bash
  git add src/components/Galleri.astro
  git commit -m "fix: galleri-grid hopper fra 2 til 4 kolonner — fjerner 3-kolonners-steg som ga 3+1 med 4 bilder"
  ```
