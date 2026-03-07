# Redesign tannleger-seksjonen — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign tannleger-seksjonen med fellesbilde-boks pa forsiden og grid+accordion pa /tannleger-siden.

**Architecture:** Forside-komponenten (`Tannleger.astro`) erstattes med en klikkbar boks som viser et fellesbilde fra galleri-collectionen (`type='fellesbilde'`). /tannleger-siden far ny layout direkte i `pages/tannleger.astro` med portrett-grid og native `<details>`/`<summary>` accordion. Admin-panelet utvides med fellesbilde-checkbox (etter forsidebilde-monsteret).

**Tech Stack:** Astro 5, Tailwind CSS v4, Google Sheets/Drive via admin-panel

---

## Task 1: Flytt Tannleger ut av hidden-wrapper i index.astro

**Files:**
- Modify: `src/pages/index.astro`

**Step 1: Endre index.astro**

Flytt `<Tannleger>` ut av `hidden md:block`-wrapperen. Tjenester forblir skjult pa mobil.

Fra:
```astro
<div class="hidden md:block">
    <Tjenester variant={tjenesterVariant} />
    <Tannleger variant={tannlegerVariant} />
</div>
```

Til:
```astro
<div class="hidden md:block">
    <Tjenester variant={tjenesterVariant} />
</div>
<Tannleger variant={tannlegerVariant} />
```

**Step 2: Verifiser at build fungerer**

Run: `npm run build 2>&1 | tail -5`
Expected: Build OK

**Step 3: Commit**

```
feat: gjor tannleger-seksjonen synlig pa mobil
```

---

## Task 2: Redesign Tannleger.astro (forside-komponent) med fellesbilde

**Files:**
- Modify: `src/components/Tannleger.astro`

**Step 1: Skriv ny Tannleger.astro**

Erstatt hele innholdet. Den nye komponenten:
- Henter fellesbilde fra galleri-collectionen (`type === 'fellesbilde'`)
- Viser en klikkbar boks med bilde + overlay-tekst
- Viser placeholder hvis ingen fellesbilde er satt
- Bruker `imageConfig` for crop-posisjonering

```astro
---
import { Image } from 'astro:assets';
import { getCollection } from 'astro:content';
import { getSiteSettings } from '../scripts/getSettings';
import { getSectionClasses, type SectionVariant } from '../scripts/sectionVariant';
import SectionHeader from './SectionHeader.astro';

const settings = await getSiteSettings();
const galleri = await getCollection('galleri');
const fellesbildeEntry = galleri.find(item => item.data.type === 'fellesbilde');

const images = import.meta.glob('/src/assets/galleri/*.{jpeg,jpg,png,webp}');
const fellesbildePath = fellesbildeEntry?.data.image
    ? `/src/assets/galleri/${fellesbildeEntry.data.image}`
    : null;
const hasFellesbilde = fellesbildePath && images[fellesbildePath];

const fellesbildeConfig = fellesbildeEntry?.data.imageConfig;
const posX = fellesbildeConfig?.positionX ?? 50;
const posY = fellesbildeConfig?.positionY ?? 50;
const scale = fellesbildeConfig?.scale ?? 1;

interface Props { variant?: SectionVariant }
const { variant = 'brand' } = Astro.props;
const { sectionBg, headerBg } = getSectionClasses(variant);
---
<section id="tannleger" class={`section-container ${sectionBg}`}>
    <div class="section-content">
        <SectionHeader title={settings.tannlegerTittel} intro={settings.tannlegerTekst} headerBg={headerBg} sticky />

        <a href="/tannleger" class="tannleger-hero-link block rounded-2xl overflow-hidden border border-brand-border/60 shadow-sm transition-all duration-300 hover:shadow-md hover:border-brand-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <div class="relative aspect-[16/9]">
                {hasFellesbilde ? (
                    <Image
                        src={images[fellesbildePath]()}
                        alt={settings.tannlegerTittel || 'Vare tannleger'}
                        class="absolute inset-0 w-full h-full object-cover"
                        style={{
                            objectPosition: `${posX}% ${posY}%`,
                            transform: `scale(${scale})`,
                            transformOrigin: `${posX}% ${posY}%`
                        }}
                    />
                ) : (
                    <div class="absolute inset-0 w-full h-full bg-brand-surface flex items-center justify-center">
                        <span class="text-brand-hover text-sm italic">Fellesbilde kommer</span>
                    </div>
                )}
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div class="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <h3 class="font-heading font-[800] text-2xl md:text-3xl text-white">
                        {settings.tannlegerTittel || 'Vare tannleger'}
                    </h3>
                </div>
            </div>
        </a>
    </div>
</section>
```

**Step 2: Verifiser build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build OK (med placeholder — ingen fellesbilde i galleri enna)

**Step 3: Commit**

```
feat: redesign tannleger forside-komponent med fellesbilde-boks
```

---

## Task 3: Ny layout for /tannleger-siden med grid og accordion

**Files:**
- Modify: `src/pages/tannleger.astro`

**Step 1: Skriv ny tannleger.astro**

Erstatt hele innholdet. Den nye siden:
- Henter tannleger direkte fra collectionen
- Grid: 2 kolonner mobil, 3 kolonner desktop
- Portrett-bilder med `aspect-[3/4]` og `rounded-xl`
- Native `<details>`/`<summary>` accordion for beskrivelse
- imageConfig for crop-posisjonering

```astro
---
import Layout from '../layouts/Layout.astro';
import { Image } from 'astro:assets';
import { getCollection } from 'astro:content';
import { getSiteSettings } from '../scripts/getSettings';

const settings = await getSiteSettings();
const tannleger = await getCollection('tannleger');
const images = import.meta.glob('/src/assets/tannleger/*.{jpeg,jpg,png,webp}');
const sorterteTannleger = tannleger.sort((a, b) => a.data.name.localeCompare(b.data.name, 'nb'));
---
<Layout
    title={`${settings.tannlegerTittel} | Tenner og Trivsel`}
    description={settings.tannlegerBeskrivelse}
>
    <main class="section-container bg-white">
        <div class="section-content">
            <div class="section-header section-header-centered">
                <h1 class="section-heading">{settings.tannlegerTittel}</h1>
                {settings.tannlegerTekst && <p class="section-intro">{settings.tannlegerTekst}</p>}
                <div class="heading-accent"></div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                {sorterteTannleger.map((t) => {
                    const d = t.data;
                    const imagePath = `/src/assets/tannleger/${d.image}`;
                    const hasImage = d.image && images[imagePath];
                    const posX = d.imageConfig?.positionX ?? 50;
                    const posY = d.imageConfig?.positionY ?? 50;
                    const scale = d.imageConfig?.scale ?? 1;

                    return (
                        <div class="tannlege-card">
                            <div class="relative aspect-[3/4] rounded-xl overflow-hidden bg-brand-surface">
                                {hasImage ? (
                                    <Image
                                        src={images[imagePath]()}
                                        alt={d.name}
                                        class="absolute inset-0 w-full h-full object-cover"
                                        style={{
                                            objectPosition: `${posX}% ${posY}%`,
                                            transform: `scale(${scale})`,
                                            transformOrigin: `${posX}% ${posY}%`
                                        }}
                                    />
                                ) : (
                                    <div class="absolute inset-0 flex items-center justify-center text-brand-hover text-sm italic">
                                        Bilde mangler
                                    </div>
                                )}
                            </div>
                            {d.description ? (
                                <details class="mt-3">
                                    <summary class="tannlege-summary btn-secondary w-full text-center cursor-pointer list-none">
                                        <span class="font-heading font-bold block">{d.name}</span>
                                        <span class="text-brand-hover text-sm block">{d.title}</span>
                                    </summary>
                                    <div class="mt-3 text-sm leading-relaxed text-brand-hover">
                                        {d.description}
                                    </div>
                                </details>
                            ) : (
                                <div class="mt-3 text-center">
                                    <span class="font-heading font-bold block">{d.name}</span>
                                    <span class="text-brand-hover text-sm block">{d.title}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    </main>
</Layout>
```

**Step 2: Legg til accordion-styling i global.css**

Legg til i `@layer components`-blokken i `src/styles/global.css`:

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

**Step 3: Verifiser build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build OK

**Step 4: Commit**

```
feat: ny /tannleger-side med grid-layout og accordion
```

---

## Task 4: Admin — fellesbilde-stotte i bilder-modulen

**Files:**
- Modify: `src/scripts/admin-sheets.js` — ny `setFellesBildeInGalleri()`
- Modify: `src/scripts/admin-module-bilder.js` — fellesbilde-checkbox
- Modify: `src/scripts/admin-dashboard.js` — fellesbilde-badge og sortering
- Modify: `src/layouts/Layout.astro` — ekskluder fellesbilde fra galleri-telling

### Step 1: Legg til `setFellesBildeInGalleri` i admin-sheets.js

Rett under `setForsideBildeInGalleri`-funksjonen (ca. linje 492), legg til:

```javascript
/**
 * Setter en galleri-rad som fellesbilde (tannleger) og nedgraderer evt. eksisterende fellesbilde.
 * Kun en rad kan ha type='fellesbilde' om gangen.
 */
export async function setFellesBildeInGalleri(spreadsheetId, rowIndex) {
    try {
        const allRows = await getGalleriRaw(spreadsheetId);
        const existing = allRows.find(r => r.type === 'fellesbilde' && r.rowIndex !== rowIndex);
        if (existing) {
            await updateGalleriRow(spreadsheetId, existing.rowIndex, { ...existing, type: 'galleri' });
        }
        const target = allRows.find(r => r.rowIndex === rowIndex);
        if (target) {
            await updateGalleriRow(spreadsheetId, rowIndex, { ...target, type: 'fellesbilde' });
        }
        console.log(`[Admin] Rad ${rowIndex} satt som fellesbilde.`);
        return true;
    } catch (err) {
        console.error("[Admin] Kunne ikke sette fellesbilde:", err);
        throw err;
    }
}
```

### Step 2: Oppdater admin-module-bilder.js

**2a.** Legg til `setFellesBildeInGalleri` i importene (linje 1-2):

Endre:
```javascript
import { ..., setForsideBildeInGalleri, ... } from './admin-client.js';
```
Til:
```javascript
import { ..., setForsideBildeInGalleri, setFellesBildeInGalleri, ... } from './admin-client.js';
```

(Sjekk admin-client.js — funksjonen ma ogsa eksporteres derfra / re-eksporteres fra admin-sheets.js.)

**2b.** I `editGalleriBilde`-funksjonen, etter forsidebilde-checkboxen (ca. linje 91), legg til fellesbilde-checkbox:

```html
<div class="admin-field-container flex items-center justify-between gap-3 p-4 rounded-xl border border-sky-200 bg-sky-50/50">
    <div>
        <label class="admin-label !mb-0">Bruk som fellesbilde (tannleger)</label>
        <p class="text-[10px] text-admin-muted-light mt-0.5">Vises pa forsiden i tannleger-seksjonen</p>
    </div>
    <input type="checkbox" id="galleri-edit-fellesbilde" class="w-5 h-5 accent-sky-500 cursor-pointer">
</div>
```

**2c.** Sett checkbox-verdien programmatisk etter `forsideCheckbox` init (ca. linje 126):

```javascript
const fellesbildeCheckbox = document.getElementById('galleri-edit-fellesbilde');
const isFellesbilde = item.type === 'fellesbilde';
if (fellesbildeCheckbox) fellesbildeCheckbox.checked = isFellesbilde;
```

**2d.** Legg til change-handler for fellesbilde-checkbox (etter forsidebilde toggle-logikken, ca. linje 222):

```javascript
if (fellesbildeCheckbox) {
    fellesbildeCheckbox.addEventListener('change', async () => {
        if (fellesbildeCheckbox.checked) {
            // Deaktiver forsidebilde-checkbox
            if (forsideCheckbox) forsideCheckbox.checked = false;
            try {
                await setFellesBildeInGalleri(SHEET_ID, rowIndex);
                if (previewContainer) {
                    previewContainer.classList.remove('aspect-[4/3]', 'aspect-[16/10]');
                    previewContainer.classList.add('aspect-[16/9]');
                }
                if (previewLabelEl) previewLabelEl.textContent = 'Forhandsvisning (16:9)';
            } catch (e) {
                showToast('Kunne ikke sette fellesbilde: ' + e.message, 'error');
                fellesbildeCheckbox.checked = false;
            }
        } else {
            try {
                await updateGalleriRow(SHEET_ID, rowIndex, {
                    ...item,
                    title: titleInput?.value || item.title,
                    image: imageInput?.value || item.image,
                    altText: altInput?.value || item.altText,
                    active: activeToggle?.dataset.active === 'true',
                    scale: parseFloat(scaleInput?.value || '1'),
                    positionX: parseInt(xInput?.value || '50'),
                    positionY: parseInt(yInput?.value || '50'),
                    type: 'galleri'
                });
                if (previewContainer) {
                    previewContainer.classList.remove('aspect-[16/9]');
                    previewContainer.classList.add('aspect-[4/3]');
                }
                if (previewLabelEl) previewLabelEl.textContent = 'Forhandsvisning (4:3)';
            } catch (e) {
                showToast('Kunne ikke endre type: ' + e.message, 'error');
                fellesbildeCheckbox.checked = true;
            }
        }
    });
}
```

**2e.** Oppdater `saveGalleri`-funksjonen (linje 256) — type-logikken ma handtere tre tilstander:

Fra:
```javascript
type: forsideCheckbox?.checked ? 'forsidebilde' : 'galleri'
```
Til:
```javascript
type: forsideCheckbox?.checked ? 'forsidebilde' : fellesbildeCheckbox?.checked ? 'fellesbilde' : 'galleri'
```

**2f.** Skjul forsidebilde-checkbox nar fellesbilde er valgt, og omvendt:

```javascript
// I init-koden etter checkbox-verdiene er satt:
if (isFellesbilde && forsideCheckbox) forsideCheckbox.closest('.admin-field-container')?.classList.add('hidden');
if (isForsidebilde && fellesbildeCheckbox) fellesbildeCheckbox.closest('.admin-field-container')?.classList.add('hidden');
```

### Step 3: Oppdater admin-dashboard.js

**3a.** Legg til fellesbilde-badge i galleri-listen (ca. linje 662-665):

Endre badge-logikk fra:
```javascript
const isForsidebilde = img.type === 'forsidebilde';
const badgeHtml = isForsidebilde
    ? `<span class="admin-status-pill bg-amber-100 text-amber-700 border-amber-300 text-[8px] shrink-0 font-black">Forsidebilde</span>`
    : '';
```
Til:
```javascript
const isForsidebilde = img.type === 'forsidebilde';
const isFellesbilde = img.type === 'fellesbilde';
const isSpecial = isForsidebilde || isFellesbilde;
const badgeHtml = isForsidebilde
    ? `<span class="admin-status-pill bg-amber-100 text-amber-700 border-amber-300 text-[8px] shrink-0 font-black">Forsidebilde</span>`
    : isFellesbilde
    ? `<span class="admin-status-pill bg-sky-100 text-sky-700 border-sky-300 text-[8px] shrink-0 font-black">Fellesbilde</span>`
    : '';
```

**3b.** Oppdater toggle/sorting/aspect-logikk til a bruke `isSpecial` i stedet for `isForsidebilde` der relevant:

- `toggleHtml`: `const toggleHtml = isSpecial ? '' : renderToggleSwitch(...)`
- Sortering: Spesialbilder forst (forsidebilde, sa fellesbilde, sa resten)
- Card-styling: `${isSpecial ? 'border-...' : ''}`
- Thumbnail-aspect: legg til fellesbilde: `const thumbAspect = isForsidebilde ? 'aspect-[16/10]' : isFellesbilde ? 'aspect-[16/9]' : 'aspect-[4/3]'`

**3c.** Oppdater bilder-telling (linje 802) til ogsa ekskludere fellesbilde:

Fra:
```javascript
const images = galleriResult.value.filter(img => img.type !== 'forsidebilde');
```
Til:
```javascript
const images = galleriResult.value.filter(img => img.type !== 'forsidebilde' && img.type !== 'fellesbilde');
```

### Step 4: Oppdater Layout.astro

Endre linje 18 fra:
```javascript
const showGalleri = galleri.some(item => (item.data.type ?? 'galleri') !== 'forsidebilde');
```
Til:
```javascript
const showGalleri = galleri.some(item => {
    const type = item.data.type ?? 'galleri';
    return type === 'galleri';
});
```

### Step 5: Sjekk admin-client.js exports

Sjekk at `setFellesBildeInGalleri` eksporteres fra `admin-client.js` (eller re-eksporteres fra admin-sheets.js). Folg monsteret for `setForsideBildeInGalleri`.

### Step 6: Verifiser build

Run: `npm run build 2>&1 | tail -5`
Expected: Build OK

### Step 7: Commit

```
feat: admin-stotte for fellesbilde i bilder-modulen
```

---

## Task 5: Tester

**Files:**
- Modify/Create: Tester for nye/endrede filer

### Step 1: Identifiser testbehov

Sjekk hvilke eksisterende tester som brytes og fiks dem:
- `src/scripts/__tests__/admin-module-bilder.test.js` — kan trenge oppdatering for fellesbilde
- `src/scripts/__tests__/admin-dashboard.test.js` — badge/sorting-logikk
- `src/scripts/__tests__/admin-client.test.js` — ny eksport

### Step 2: Kjor eksisterende tester

Run: `npx vitest run 2>&1 | tail -20`
Expected: Alle tester bestar (eller identifiser feil)

### Step 3: Legg til test for setFellesBildeInGalleri

Folg monsteret fra testen for `setForsideBildeInGalleri`. Test:
- Setter type='fellesbilde' pa valgt rad
- Nedgraderer eksisterende fellesbilde til 'galleri'

### Step 4: Kjor quality gate

Run: `npx vitest run --coverage 2>&1 | tail -30`
Sjekk at branch coverage >= 80% pa berort kode.

### Step 5: Commit

```
test: tester for fellesbilde-stotte
```

---

## Oppgaveavslutning

Etter alle tasks er fullfort:
1. Marker oppgaven som fullfort i TODO.md
2. Arkiver til TODO-archive.md
3. Commit via `/commit`
