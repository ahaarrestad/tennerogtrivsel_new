# Leaflet + OpenStreetMap Kart — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Google Maps iframe with Leaflet + OpenStreetMap for GDPR cookie compliance.

**Architecture:** Client-side Leaflet map initialized in a `<script>` tag in Kontakt.astro. CartoDB Voyager tiles loaded from basemaps.cartocdn.com. Marker with permanent tooltip shows clinic name. "Få veibeskrivelse" button overlaid on the map opens Google Maps in new tab.

**Tech Stack:** Leaflet.js (npm), CartoDB Voyager tiles, Astro client-side script

**Design doc:** [plan-leaflet-osm-kart-design.md](plan-leaflet-osm-kart-design.md)

---

### Task 1: Install Leaflet

**Files:**
- Modify: `package.json`

**Step 1: Install leaflet**

Run: `npm install leaflet`

**Step 2: Verify installation**

Run: `ls node_modules/leaflet/dist/leaflet.css && echo "OK"`
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: legg til leaflet-avhengighet for OSM-kart"
```

---

### Task 2: Update CSP — add CartoDB tile domain, remove Google Maps references

The middleware CSP must allow loading tiles from CartoDB and Leaflet marker icons from unpkg. Google Maps-specific entries in `img-src` can be cleaned up.

**Files:**
- Modify: `src/middleware.ts:3-17`
- Modify: `src/__tests__/middleware.test.ts:38-53`

**Step 1: Write the failing test — update CSP assertions**

In `src/__tests__/middleware.test.ts`, update the test at line 38:

```typescript
it('CSP inneholder nødvendige domener for kart og auth', async () => {
    const handler = await importMiddleware();
    const response = await handler({}, makeNext());
    const csp = response.headers.get('Content-Security-Policy')!;

    // Leaflet/OSM kart-tiles (CartoDB Voyager)
    expect(csp).toContain('https://basemaps.cartocdn.com');
    // Google OAuth og GIS
    expect(csp).toContain('https://accounts.google.com');
    // GAPI scripts
    expect(csp).toContain('https://apis.google.com');
    // Google Drive (admin)
    expect(csp).toContain('https://drive.google.com');
    // GAPI iframe-kanaler (content-*.googleapis.com – wildcard dekker alle subdomener)
    expect(csp).toContain('https://*.googleapis.com');
});
```

Key changes from old test:
- Removed `expect(csp).toContain('https://www.google.com')` assertion (no longer needed for Maps embed — still present in CSP for OAuth/connect-src, but this test should not assert Maps-specific presence)
- Added `expect(csp).toContain('https://basemaps.cartocdn.com')` for CartoDB tiles

**Step 2: Run test to verify it fails**

Run: `npx vitest --run src/__tests__/middleware.test.ts`
Expected: FAIL — `basemaps.cartocdn.com` not in CSP yet

**Step 3: Update CSP in middleware.ts**

In `src/middleware.ts`, update the CSP array:

```typescript
const CSP = [
    "default-src 'self'",
    // Scripts: eget domene + Google APIs + CDN-er brukt i admin-panel
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://unpkg.com",
    // Stiler: eget domene + Google Fonts + CDN-er brukt i admin-panel
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
    // Fonter: eget domene + Google Fonts + Font Awesome (cdnjs)
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    // Bilder: eget domene + Google Drive-preview + CartoDB kart-tiles + data: URI + blob: (preview-bilder i admin)
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com https://basemaps.cartocdn.com",
    // Iframes: Google Drive + Google OAuth + GAPI iframe-kanaler (content-*.googleapis.com)
    "frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com",
    // API-kall: Google APIs + OAuth + telemetri fra Google-skript (gen_204)
    "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com",
].join('; ');
```

Changes:
- `img-src`: Replaced `https://maps.gstatic.com` with `https://basemaps.cartocdn.com`
- `img-src` comment: Updated to mention CartoDB tiles instead of Google Maps
- `frame-src` comment: Removed "Google Maps embed" from comment (kept `www.google.com` — may be needed for Google auth flows)

**Step 4: Run test to verify it passes**

Run: `npx vitest --run src/__tests__/middleware.test.ts`
Expected: PASS — all 7 tests green

**Step 5: Commit**

```bash
git add src/middleware.ts src/__tests__/middleware.test.ts
git commit -m "feat: oppdater CSP — legg til CartoDB tiles, fjern Google Maps-referanser"
```

---

### Task 3: Replace Google Maps iframe with Leaflet map in Kontakt.astro

**Files:**
- Modify: `src/components/Kontakt.astro:1-148`

**Step 1: Update frontmatter — remove Google Maps variables**

Remove lines 9, 19-21 (googleApiKey, mapUrl comment, mapUrl). Keep `googleMapsDirectionUrl` (used for address card + directions button).

New frontmatter (lines 1-35):

```astro
---
import {formatInfoText} from "../scripts/textFormatter";
import {getSiteSettings} from '../scripts/getSettings';
import { getSectionClasses, type SectionVariant } from '../scripts/sectionVariant';
import SectionHeader from './SectionHeader.astro';
import Card from "./Card.astro";

const settings = await getSiteSettings();

// Nøyaktige koordinater fra din lenke
const lat = settings.latitude;
const lng = settings.longitude;

const headerOffset = "230px";
const minHeight = "250px";

// Denne brukes til klikkbar lenke på adressen (Universal Link) og veibeskrivelse-knapp
const googleMapsDirectionUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

const businessHours = settings
    ? Object.keys(settings)
        .filter(key => key.startsWith('businessHours'))
        .sort()
        .map(key => settings[key])
        .filter(val => val && val.trim().length > 0)
    : ["Ta kontakt for åpningstider"]

interface Props { variant?: SectionVariant }
const { variant = 'brand' } = Astro.props;
const { sectionBg, headerBg } = getSectionClasses(variant);
---
```

**Step 2: Replace iframe with map container and directions button**

Replace lines 134-145 (the `<div>` wrapping the iframe) with:

```astro
<div class="relative w-full mb-20 z-0">
    <div id="map" class="w-full h-[450px] md:h-[550px] rounded-3xl overflow-hidden shadow-xl border border-brand-border"></div>
    <div class="flex justify-center mt-4">
        <a href={googleMapsDirectionUrl}
           target="_blank"
           rel="noopener noreferrer"
           class="btn-secondary inline-flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
            Få veibeskrivelse
        </a>
    </div>
</div>
```

**Step 3: Add client-side Leaflet script**

Add this `<script>` block at the very end of the file, after the closing `</section>`:

```astro
<script>
    import L from 'leaflet';
    import 'leaflet/dist/leaflet.css';

    const mapEl = document.getElementById('map');
    if (mapEl) {
        const lat = parseFloat(mapEl.dataset.lat || '0');
        const lng = parseFloat(mapEl.dataset.lng || '0');
        const name = mapEl.dataset.name || '';

        const map = L.map(mapEl, { scrollWheelZoom: false }).setView([lat, lng], 17);

        L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([lat, lng]).addTo(map);
        marker.bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -10] });
    }
</script>
```

And add `data-*` attributes to the `#map` div to pass server-side data to the client script:

```astro
<div id="map"
     data-lat={lat}
     data-lng={lng}
     data-name="Tenner og Trivsel"
     class="w-full h-[450px] md:h-[550px] rounded-3xl overflow-hidden shadow-xl border border-brand-border"></div>
```

Note: `scrollWheelZoom: false` prevents accidental zoom while scrolling the page. Users can still zoom with +/- buttons or pinch.

**Step 4: Fix Leaflet default marker icon path**

Leaflet's default marker icon relies on image paths that break with bundlers. Add this fix inside the `if (mapEl)` block, before creating the marker:

```javascript
// Fix Leaflet default marker icon paths (broken by bundlers)
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon.src ?? markerIcon,
    iconRetinaUrl: markerIcon2x.src ?? markerIcon2x,
    shadowUrl: markerShadow.src ?? markerShadow,
});
```

Move these imports to the top of the `<script>` block (after the leaflet imports).

**Step 5: Build and visually verify**

Run: `npm run dev:nosync`

Open `http://localhost:4321/kontakt` and verify:
- CartoDB Voyager map renders in the same location
- "Tenner og Trivsel" label visible on marker
- "Få veibeskrivelse" button visible below map
- Button opens Google Maps in new tab
- Scroll wheel does not zoom the map
- Map is zoomable with +/- controls
- Attribution shows "© OpenStreetMap, © CARTO"

**Step 6: Commit**

```bash
git add src/components/Kontakt.astro
git commit -m "feat: erstatt Google Maps iframe med Leaflet + OpenStreetMap"
```

---

### Task 4: Run full test suite and fix any issues

**Step 1: Run unit tests**

Run: `npx vitest --run`
Expected: All tests pass, including updated middleware test

**Step 2: Run E2E tests**

Run: `npx playwright test`
Expected: All tests pass (accessibility, CSP check on /kontakt, SEO, sitemap)

**Step 3: Fix any failures**

If CSP check on `/kontakt` fails — check browser console for blocked resources, update CSP accordingly.
If accessibility fails — check that map div has proper aria attributes, add `role="application"` and `aria-label="Kart som viser klinikkens plassering"` to the map div.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: rett testfeil etter Leaflet-migrering"
```

---

### Task 5: Update TODO.md and archive

**Files:**
- Modify: `TODO.md`
- Modify: `TODO-archive.md`

**Step 1: Update TODO.md**

Change the Google Maps task from backlog entry:
```markdown
- [ ] **Google Maps lazy-load bak klikk (cookiefri)**
```
to completed:
```markdown
- [x] **Erstatt Google Maps med Leaflet + OpenStreetMap (cookiefri)**
```

Add plan link and completion summary.

**Step 2: Move to archive**

Move the completed task to `TODO-archive.md` and move the plan files to `docs/archive/`.

**Step 3: Commit**

```bash
git add TODO.md TODO-archive.md
git mv docs/plans/2026-03-01-leaflet-osm-kart-design.md docs/archive/
git mv docs/plans/2026-03-01-leaflet-osm-kart.md docs/archive/
git commit -m "chore: arkiver Leaflet-kart-oppgave — ferdig"
```
