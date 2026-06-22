# Tannleger-siden: visuelt løft — Implementasjonsplan

> **For agentiske arbeidere:** Implementeres via prosjektets `/todo`-flyt (start-oppgave:
> worktree → implementasjon → `review-loop` → arkiver → `/commit`). Steg bruker
> checkbox (`- [ ]`) for sporing.

**Mål:** Erstatte den flate `/tannleger`-siden med «galleri-overlay»-kort (variant A):
portrett fyller kortet, navn/tittel på en gradient-scrim, spesialitet som glir inn på
hover — accordion fjernes.

**Arkitektur:** Presentasjonsendring på to overflater som MÅ holdes i synk: den offentlige
siden (`src/pages/tannleger.astro`) og admin-forhåndsvisningen
(`src/scripts/admin-module-tannleger.js`). Begge bruker de samme støtte-klassene i
`src/styles/global.css` (erstatter de utgåtte accordion-stilene), slik at tekst-overlegg og
hover-/fokus-/touch-oppførsel er identisk. Hover/touch løses med CSS media-queries — ingen
ny kjøretidslogikk, men admin-modulens `updatePreview()` oppdateres til ny DOM-struktur.

**Tech Stack:** Astro 5, Tailwind CSS v4 (`@theme`-tokens), Astro `<Image>`, DOMPurify
(admin-markup), Vitest (admin-enhetstester), Playwright (a11y-verifisering).

## Global Constraints

- **Farger:** Kun CSS-tokens fra `@theme` i `global.css`. Scrim bygges på
  `--color-brand-dark` via `color-mix(...)` — ingen hardkodede hex/Tailwind-fargeklasser.
  `text-white` / `text-white/80` er tillatt (ikke en merkefarge).
- **Bildeformat:** `aspect-[3/4]` beholdes (eier-preferanse).
- **Rutenett:** 2 kol mobil / 3 kol md / 4 kol lg, kapslet til `max-w-[1000px]` og
  sentrert. 8 tannleger → to rene rader på desktop.
- **a11y:** Spesialitetsteksten ligger ALLTID i DOM-en. Hover-skjuling kun under
  `@media (hover: hover) and (pointer: fine)`. WCAG AA-kontrast for tekst på scrim.
- **Per-tannlege `imageConfig`** bevares via `buildImageStyle` (`object-position` + `scale`).
  I admin via crop-sliderne (`#preview-img` inline-style) — uendret.
- **Admin-paritet:** Admin-forhåndsvisningen gjenbruker NØYAKTIG de samme kort-klassene
  (`.tannlege-kort`/`.tannlege-scrim`/`.tannlege-spec`) som den offentlige siden — samme
  tekst-overlegg og hover-/fokus-/touch-oppførsel.
- **Coverage-policy:** `admin-module-tannleger.js` endres → ≥ 80 % branch coverage per fil
  må opprettholdes. Admin-testene oppdateres til ny DOM-struktur (Task 4). Den offentlige
  `.astro`-siden har ingen JS og verifiseres via build + Playwright a11y + visuell sjekk.

---

### Task 1: Kort-CSS — erstatt accordion-stiler med scrim-kort-stiler

**Files:**
- Modify: `src/styles/global.css:813-821` (fjern accordion-blokk, legg inn kort-stiler)

**Interfaces:**
- Produserer CSS-klassene `.tannlege-kort`, `.tannlege-scrim`, `.tannlege-spec` som
  markup i Task 2 forbruker.

- [ ] **Steg 1: Fjern den utgåtte accordion-blokken**

Slett disse linjene (`src/styles/global.css:813-821`) — accordion utgår med variant A:

```css
    /* Accordion — tannlege-kort */
    .tannlege-summary::-webkit-details-marker,
    .tannlege-summary::marker {
        display: none;
    }

    details[open] .tannlege-summary {
        @apply border-brand;
    }
```

- [ ] **Steg 2: Legg inn kort-stilene på samme sted**

Lim inn følgende der den slettede blokken sto (fortsatt inne i samme `@layer`/`@utility`-
kontekst som omkringliggende klasser bruker — behold innrykk):

```css
    /* Tannlege-kort (variant A: galleri-overlay) */
    .tannlege-scrim {
        background: linear-gradient(to top,
            color-mix(in srgb, var(--color-brand-dark) 92%, transparent) 0%,
            color-mix(in srgb, var(--color-brand-dark) 55%, transparent) 28%,
            color-mix(in srgb, var(--color-brand-dark) 8%, transparent) 54%,
            transparent 72%);
        transition: background .3s ease;
    }
    .tannlege-kort:hover .tannlege-scrim {
        background: linear-gradient(to top,
            color-mix(in srgb, var(--color-brand-dark) 95%, transparent) 0%,
            color-mix(in srgb, var(--color-brand-dark) 78%, transparent) 40%,
            color-mix(in srgb, var(--color-brand-dark) 35%, transparent) 70%,
            color-mix(in srgb, var(--color-brand-dark) 8%, transparent) 100%);
    }

    /* Spesialitet: alltid synlig (standard/touch). Tones inn på hover KUN på
       pekerenheter med hover, slik at innholdet aldri låses bak hover. */
    @media (hover: hover) and (pointer: fine) {
        .tannlege-spec {
            max-height: 0;
            opacity: 0;
            margin-top: 0;
            overflow: hidden;
            transition: max-height .4s ease, opacity .3s ease, margin-top .3s ease;
        }
        .tannlege-kort:hover .tannlege-spec {
            max-height: 8rem;
            opacity: 1;
            margin-top: .375rem;
        }
    }
```

- [ ] **Steg 3: Verifiser at CSS kompilerer**

Run: `npm run build:ci`
Expected: Bygg fullføres uten feil (Tailwind-/CSS-kompilering ok). Markup-endringen i
Task 2 er ikke gjort ennå, men siden bygger fortsatt.

- [ ] **Steg 4: Commit**

```bash
git add src/styles/global.css
git commit -m "style: kort-stiler for tannleger (scrim + hover-bio), fjern accordion-CSS"
```

---

### Task 2: Skriv om kort-markupen i tannleger.astro

**Files:**
- Modify: `src/pages/tannleger.astro:23-67` (grid + kort-løkke)

**Interfaces:**
- Forbruker `.tannlege-kort`, `.tannlege-scrim`, `.tannlege-spec` fra Task 1.
- Beholder eksisterende frontmatter (`images`, `sorterteTannleger`, `buildImageStyle`,
  `imgStyle`) uendret.

- [ ] **Steg 1: Erstatt grid- og kort-blokken**

Bytt ut hele `<div class="grid ...">…</div>` (linje 23–67) med:

```astro
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-7 max-w-[1000px] mx-auto">
                {sorterteTannleger.map((t) => {
                    const d = t.data;
                    const imagePath = `/src/assets/tannleger/${d.image}`;
                    const hasImage = d.image && images[imagePath];
                    const imgStyle = buildImageStyle(d.imageConfig);

                    return (
                        <div class="tannlege-kort group relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
                            {hasImage ? (
                                <Image
                                    src={images[imagePath]()}
                                    alt={d.name}
                                    class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                    style={imgStyle}
                                />
                            ) : (
                                <div class="absolute inset-0 flex items-center justify-center bg-brand-light text-brand-hover text-sm italic">
                                    Bilde mangler
                                </div>
                            )}
                            <div class="absolute inset-0 tannlege-scrim"></div>
                            <div class="absolute inset-x-0 bottom-0 p-4">
                                <p class="font-heading font-extrabold text-white text-sm leading-tight">{d.name}</p>
                                <p class="text-white/80 text-xs mt-0.5">{d.title}</p>
                                {d.description && (
                                    <p class="tannlege-spec text-white/90 text-xs leading-relaxed">{d.description}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
```

- [ ] **Steg 2: Bekreft at scrim ligger over bildet, men under teksten**

Visuell sjekk av DOM-rekkefølge i koden: `<Image>` (eller fallback) → `.tannlege-scrim`
→ tekstblokk. Scrim har `absolute inset-0`; tekstblokk har `absolute … bottom-0` og kommer
etter scrim, så den tegnes over. Ingen `z-index` nødvendig.

- [ ] **Steg 3: Bygg og kjør a11y-test for /tannleger**

Run:
```bash
npm run build:ci
PORT=4321 npx playwright test tests/accessibility.spec.ts -g "Tannleger"
```
Expected: Bygg ok. A11y-testen for `/tannleger/` passerer (ingen WCAG-brudd — fanger bl.a.
kontrast-feil på navn/tittel over scrim).

> Krever kjørende secure-server med CSP-hashes. Følg samme boot som `/quality-gate`/`/commit`
> (`source .claude/skills/_shared/start-secure-server.sh; ensure_secure_server`) hvis testen
> trenger server.

- [ ] **Steg 4: Visuell verifisering**

Sjekk i nettleser (eller companion-mockup som referanse) at: navn/tittel er lesbare på alle
åtte kortene, spesialiteten glir inn på hover (desktop), to rene rader à fire på bred skjerm,
og 2-kolonners oppsett på mobil med spesialiteten alltid synlig. Bruk `Ingjerd` som
verste-tilfelle for lang tekst.

- [ ] **Steg 5: Commit**

```bash
git add src/pages/tannleger.astro
git commit -m "feat: galleri-overlay-kort på tannleger-siden, fjern accordion"
```

---

### Task 3: Speil det nye kortet i admin-forhåndsvisningen

**Files:**
- Modify: `src/scripts/admin-module-tannleger.js:99-131` (preview-markup, høyre kolonne)
- Modify: `src/scripts/admin-module-tannleger.js:223-273` (`updatePreview`-logikk)

**Interfaces:**
- Forbruker `.tannlege-kort`/`.tannlege-scrim`/`.tannlege-spec` fra Task 1 (identisk med
  Task 2).
- Beholder element-ID-ene `#preview-img`, `#no-image-placeholder`, `#preview-name`,
  `#preview-title`; innfører `#preview-spec`; fjerner `#preview-details`,
  `#preview-no-desc`, `#preview-name-nodesc`, `#preview-title-nodesc`, `#preview-desc`.

- [ ] **Steg 1: Bytt ut preview-markupen (høyre kolonne)**

Erstatt blokken fra `<!-- HØYRE: Preview + bildeutsnitt -->` til og med den avsluttende
`</div>` før `${renderImageCropSliders(...)}` (linje 99–131) med:

```javascript
            <!-- HØYRE: Preview + bildeutsnitt -->
            <div class="space-y-6">
                <h3 class="text-brand font-black uppercase tracking-tighter text-center lg:text-left">Forhåndsvisning</h3>
                <p class="text-xs text-admin-muted-light text-center lg:text-left -mt-3">Speiler kortet på /tannleger. Hold musa over for spesialiteten (på mobil vises den alltid).</p>
                <div class="flex justify-center lg:justify-start">
                    <div class="w-full max-w-[250px]">
                        <div class="tannlege-kort relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md bg-admin-surface">
                            <div id="no-image-placeholder" class="absolute inset-0 flex flex-col items-center justify-center text-admin-muted-light ${previewSrc ? 'hidden' : ''}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                <span class="text-[10px] font-black uppercase tracking-widest">Velg bilde</span>
                            </div>
                            <img id="preview-img"
                                 src=""
                                 class="absolute inset-0 w-full h-full object-cover transition-all duration-75 ${previewSrc ? '' : 'hidden'}"
                                 style="object-position: ${t.positionX}% ${t.positionY}%; transform: scale(${t.scale}); transform-origin: ${t.positionX}% ${t.positionY}%;"
                            >
                            <div class="absolute inset-0 tannlege-scrim"></div>
                            <div class="absolute inset-x-0 bottom-0 p-4">
                                <p id="preview-name" class="font-heading font-extrabold text-white text-sm leading-tight">${escapeHtml(t.name) || 'Navn'}</p>
                                <p id="preview-title" class="text-white/80 text-xs mt-0.5">${escapeHtml(t.title) || 'Tittel'}</p>
                                <p id="preview-spec" class="tannlege-spec text-white/90 text-xs leading-relaxed" ${t.description ? '' : 'hidden'}>${escapeHtml(t.description) || ''}</p>
                            </div>
                        </div>
                    </div>
                </div>
```

Merk: `.tannlege-kort` (ikke `group`) — admin-previewet bruker ikke bilde-zoom på hover,
fordi `#preview-img` har inline `transform: scale()` for bildeutsnitt. Scrim- og
spesialitet-hover styres av `.tannlege-kort:hover` fra Task 1.

- [ ] **Steg 2: Oppdater `updatePreview()` til ny DOM-struktur**

Erstatt tekst-/beskrivelses-delen av `updatePreview` (linje 231–254, fra `const nameEl =`
til og med blokken som setter `detailsEl`/`noDescEl`) med:

```javascript
        const nameEl = document.getElementById('preview-name');
        const titleEl = document.getElementById('preview-title');
        const specEl = document.getElementById('preview-spec');
        const nameVal = nameInp.value || 'Navn';
        const titleVal = titleInp.value || 'Tittel';
        const descVal = descInp.value || '';
        if (nameEl) nameEl.textContent = nameVal;
        if (titleEl) titleEl.textContent = titleVal;
        if (specEl) {
            specEl.textContent = descVal;
            specEl.hidden = !descVal;
        }
```

(Resten av `updatePreview` — bilde-`object-position`/`transform`, slider-labels,
`autoSaver.trigger()` — beholdes uendret.)

- [ ] **Steg 3: Bygg admin og verifiser markup manuelt**

Run: `npm run build:ci`
Expected: Bygg ok. Åpne admin → Tannleger → rediger en profil og bekreft at previewet ser
ut som /tannleger-kortet (scrim + navn/tittel), at spesialiteten glir inn på hover, og at
bildeutsnitt-sliderne fortsatt flytter bildet.

- [ ] **Steg 4: Commit**

```bash
git add src/scripts/admin-module-tannleger.js
git commit -m "feat(admin): speil nytt tannlege-kort i forhåndsvisning, fjern accordion-preview"
```

---

### Task 4: Oppdater admin-enhetstestene til ny DOM-struktur

**Files:**
- Modify: `src/scripts/__tests__/admin-module-tannleger.test.js:629-640` (desc → spec)
- Modify: samme fil — legg til test for `#preview-spec` skjul/vis-grenen

**Interfaces:** Forbruker den nye markupen fra Task 3 (`#preview-spec`).

- [ ] **Steg 1: Oppdater beskrivelse-testen til `#preview-spec`**

Erstatt testen `should update preview description on change` (linje 629–640) med:

```javascript
    it('should update preview specialty (#preview-spec) on change', async () => {
        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'Old desc',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const descInp = document.getElementById('edit-t-desc');
        descInp.value = 'New desc';
        descInp.dispatchEvent(new Event('change'));

        const spec = document.getElementById('preview-spec');
        expect(spec.textContent).toBe('New desc');
        expect(spec.hidden).toBe(false);
    });
```

- [ ] **Steg 2: Legg til test for at tom beskrivelse skjuler `#preview-spec`**

Lim inn rett etter testen fra Steg 1:

```javascript
    it('should hide #preview-spec when description is cleared', async () => {
        await window.editTannlege(2, {
            name: 'N', title: 'T', description: 'Har tekst',
            image: '', active: true, scale: 1, positionX: 50, positionY: 50
        });

        const descInp = document.getElementById('edit-t-desc');
        descInp.value = '';
        descInp.dispatchEvent(new Event('change'));

        expect(document.getElementById('preview-spec').hidden).toBe(true);
    });
```

- [ ] **Steg 3: Kjør admin-testene + coverage**

Run: `npm test -- admin-module-tannleger`
Expected: Alle tester grønne, ingen referanser til fjernede ID-er (`#preview-desc`,
`#preview-details`, `#preview-no-desc`) gjenstår.

- [ ] **Steg 4: Bekreft ≥ 80 % branch coverage for filen**

Run: `npm test` (full kjøring genererer `coverage/coverage-final.json`), deretter
per-fil-sjekken fra `/quality-gate`.
Expected: `admin-module-tannleger.js` ligger på ≥ 80 % branch. (Den nye `specEl.hidden =
!descVal`-grenen er dekket av begge testene over.)

- [ ] **Steg 5: Commit**

```bash
git add src/scripts/__tests__/admin-module-tannleger.test.js
git commit -m "test(admin): oppdater tannlege-preview-tester til scrim-kort-struktur"
```

---

### Task 5: Oppdater design-guiden §5.3 så den samsvarer med variant A

**Files:**
- Modify: `docs/designs/design-guide.md:374` (Tannleger-raden i §5.3 «Bilder»)

**Interfaces:** Ingen kode — dokumentasjon. Lukker spec-flagget om §5.3.

- [ ] **Steg 1: Erstatt Tannleger-raden**

Bytt ut linjen:

```markdown
| Tannleger | rounded-full | 1/1 (sirkel) | border-4 border-white | shadow-md |
```

med:

```markdown
| Tannleger | rounded-2xl | 3/4 | ingen (scrim-overlegg) | shadow-sm → shadow-md hover |
```

- [ ] **Steg 2: Legg til en kort merknad under tabellen i §5.3**

Rett under bilde-tabellen, legg til:

```markdown
> **Tannleger-kort:** Portrett fyller kortet med en gradient-scrim nederst
> (`--color-brand-dark` via `color-mix`). Navn/tittel ligger alltid på bildet;
> spesialiteten tones inn på hover (pekerenheter) og er alltid synlig på touch.
> Erstatter det tidligere sirkulære portrettet.
```

- [ ] **Steg 3: Commit**

```bash
git add docs/designs/design-guide.md
git commit -m "docs: oppdater design-guide §5.3 — tannleger-kort (3/4 scrim, ikke sirkel)"
```

---

### Task 6: Full verifisering (definition of done)

**Files:** Ingen endringer — kun kjøring.

- [ ] **Steg 1: Kjør full a11y-suite for berørte sider**

Run:
```bash
PORT=4321 npx playwright test tests/accessibility.spec.ts
```
Expected: Alle a11y-tester passerer (inkl. forsiden, som fortsatt viser uendret
Tannleger-teaser, og `/admin` som nå har det nye previewet).

- [ ] **Steg 2: Kjør unit-testene + per-fil-coverage**

Run: `npm test`
Expected: Grønt. Per `/quality-gate`-sjekken ligger `admin-module-tannleger.js` på
≥ 80 % branch; øvrige berørte filer uendret. `buildImageStyle`-testene dekker fortsatt
bilde-styling.

- [ ] **Steg 3: Produksjonsbygg**

Run: `npm run build:ci`
Expected: Bygg fullføres uten feil/advarsler.

- [ ] **Steg 4: Bekreft paritet offentlig side ↔ admin**

Åpne `/tannleger` og admin-redigering side om side. Bekreft at kortet ser identisk ut, at
spesialiteten har samme hover-/touch-oppførsel begge steder, og at admin-mobilvisning viser
spesialiteten alltid (emuler smal viewport).

- [ ] **Steg 5: Bekreft akseptansekriteriene mot spec**

Gå gjennom de 13 akseptansekriteriene i `docs/designs/2026-06-21-tannleger-visuelt-loft.md`
og kryss av at hvert er møtt (variant A-kort, rutenett/kapsling, bio-oppførsel, accordion
fjernet, hover-zoom, tom-spesialitet, `imageConfig` bevart, kun tokens, WCAG AA, forsiden
uendret, admin-paritet inkl. hover/fokus/mobil, gammelt accordion-preview fjernet).

## Definition of Done

- Alle seks tasks committet.
- `/tannleger` viser variant A-kort i to rader à fire (desktop), kapslet og sentrert.
- Spesialitet: hover-inn på desktop, alltid synlig på touch, alltid i DOM.
- Accordion (`<details>`) og `.tannlege-summary`-CSS fjernet fra både offentlig side og admin.
- **Admin-forhåndsvisning viser nøyaktig samme kort** med identisk hover-/fokus-/mobil-
  oppførsel.
- Playwright a11y grønt for `/tannleger/` og `/admin`; `npm test` (inkl. ≥ 80 % branch for
  `admin-module-tannleger.js`) og `npm run build:ci` grønt.
- Design-guide §5.3 oppdatert.

## Kjente risiki / merknader

- **`color-mix`-støtte:** Bredt støttet i moderne nettlesere (2023+). Nettstedet er
  allerede Tailwind v4 (krever moderne nettlesere), så dette er innenfor støttematrisen.
- **Bildevekt (utenfor scope):** Portrettene lastes uten eksplisitte `widths`/`sizes`
  (som i dag). Et responsivt nedlasting-løft (à la `Galleri.astro`) er en mulig senere
  optimalisering, ikke en del av dette løftet.
- **Lang spesialitet (Ingjerd):** Verste-tilfelle for hover-tekst; `max-height: 8rem` gir
  rom for ~4 linjer. Verifiseres visuelt i Task 2 Steg 4.
```
