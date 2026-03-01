# Leaflet Mobile Scroll Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent one-finger touch from panning the Leaflet map on mobile; require two fingers (like Google Maps embeds).

**Architecture:** Detect touch devices at runtime. Disable `dragging` and Leaflet's `tap` handler on touch. Keep `touchZoom` enabled for two-finger pinch. Show a translucent overlay message ("Bruk to fingre for å flytte kartet") on single-touch, auto-fade after 1.5s.

**Tech Stack:** Leaflet (existing), vanilla JS, CSS transitions. No new dependencies.

---

### Task 1: Extract map init into a separate script module

The map logic currently lives in a `<script>` tag inside `Kontakt.astro`. Extract it into a testable module so we can unit-test the touch/config logic.

**Files:**
- Create: `src/scripts/mapInit.ts`
- Modify: `src/components/Kontakt.astro:157-189` (replace inline script)

**Step 1: Create the module with existing logic**

Create `src/scripts/mapInit.ts`:

```ts
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon.src ?? markerIcon,
    iconRetinaUrl: markerIcon2x.src ?? markerIcon2x,
    shadowUrl: markerShadow.src ?? markerShadow,
});

/** Detect touch-capable device */
export function isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Build Leaflet map options based on device type */
export function getMapOptions(isTouch: boolean): L.MapOptions {
    return {
        scrollWheelZoom: false,
        dragging: !isTouch,
        tap: false,
        touchZoom: true,
    };
}

/** Initialize the map on #map element */
export function initMap(): void {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const lat = parseFloat(mapEl.dataset.lat || '0');
    const lng = parseFloat(mapEl.dataset.lng || '0');
    const name = mapEl.dataset.name || '';

    const isTouch = isTouchDevice();
    const map = L.map(mapEl, getMapOptions(isTouch)).setView([lat, lng], 17);

    L.tileLayer('/tiles/{z}/{x}/{y}.png', {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -10] });

    if (isTouch) {
        setupTouchOverlay(mapEl);
    }
}

/** Show "use two fingers" overlay on single-touch */
export function setupTouchOverlay(mapEl: HTMLElement): void {
    const overlay = document.createElement('div');
    overlay.className = 'map-touch-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="map-touch-overlay-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/>
                <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/>
                <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/>
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
            </svg>
            <span>Bruk to fingre for å flytte kartet</span>
        </div>
    `;

    // Position relative to map container
    mapEl.style.position = 'relative';
    mapEl.appendChild(overlay);

    let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

    mapEl.addEventListener('touchstart', (e: TouchEvent) => {
        if (e.touches.length === 1) {
            overlay.classList.add('visible');
            if (fadeTimeout) clearTimeout(fadeTimeout);
            fadeTimeout = setTimeout(() => {
                overlay.classList.remove('visible');
            }, 1500);
        }
    }, { passive: true });
}
```

**Step 2: Update Kontakt.astro to use the module**

Replace the `<script>` block (lines 157-189) in `src/components/Kontakt.astro` with:

```html
<script>
    import { initMap } from '../scripts/mapInit';
    initMap();
</script>
```

**Step 3: Run build to verify no errors**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```
feat: extract map init into testable module with touch detection
```

---

### Task 2: Add CSS for the touch overlay

**Files:**
- Modify: `src/styles/global.css` (append overlay styles)

**Step 1: Add overlay CSS**

Append to `src/styles/global.css`:

```css
/* Map touch overlay — "use two fingers" message */
.map-touch-overlay {
    position: absolute;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    border-radius: inherit;
}

.map-touch-overlay.visible {
    opacity: 1;
}

.map-touch-overlay-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: white;
    color: var(--color-brand);
    border-radius: 2rem;
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```
style: add touch overlay CSS for mobile map interaction
```

---

### Task 3: Write unit tests for getMapOptions and isTouchDevice

**Files:**
- Create: `tests/mapInit.test.ts`

**Step 1: Write the tests**

Create `tests/mapInit.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMapOptions, isTouchDevice, setupTouchOverlay } from '../src/scripts/mapInit';

vi.mock('leaflet', () => {
    const markerMock = { bindTooltip: vi.fn() };
    const mapMock = { setView: vi.fn().mockReturnThis() };
    return {
        default: {
            map: vi.fn(() => mapMock),
            tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
            marker: vi.fn(() => ({ addTo: vi.fn(() => markerMock) })),
            Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
        },
    };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'marker.png' }));
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'marker2x.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'shadow.png' }));

describe('getMapOptions', () => {
    it('disables dragging on touch devices', () => {
        const opts = getMapOptions(true);
        expect(opts.dragging).toBe(false);
        expect(opts.scrollWheelZoom).toBe(false);
        expect(opts.tap).toBe(false);
        expect(opts.touchZoom).toBe(true);
    });

    it('enables dragging on non-touch devices', () => {
        const opts = getMapOptions(false);
        expect(opts.dragging).toBe(true);
        expect(opts.scrollWheelZoom).toBe(false);
        expect(opts.tap).toBe(false);
        expect(opts.touchZoom).toBe(true);
    });
});

describe('isTouchDevice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when ontouchstart exists', () => {
        Object.defineProperty(window, 'ontouchstart', { value: null, configurable: true });
        expect(isTouchDevice()).toBe(true);
        delete (window as any).ontouchstart;
    });

    it('returns true when maxTouchPoints > 0', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 1, configurable: true });
        expect(isTouchDevice()).toBe(true);
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
    });

    it('returns false on non-touch devices', () => {
        // Ensure ontouchstart not present and maxTouchPoints is 0
        delete (window as any).ontouchstart;
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
        expect(isTouchDevice()).toBe(false);
    });
});

describe('setupTouchOverlay', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('appends overlay element to container', () => {
        setupTouchOverlay(container);
        const overlay = container.querySelector('.map-touch-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay?.getAttribute('aria-hidden')).toBe('true');
    });

    it('shows overlay on single-finger touchstart', () => {
        setupTouchOverlay(container);
        const overlay = container.querySelector('.map-touch-overlay')!;
        expect(overlay.classList.contains('visible')).toBe(false);

        container.dispatchEvent(new TouchEvent('touchstart', {
            touches: [new Touch({ identifier: 0, target: container })],
        }));

        expect(overlay.classList.contains('visible')).toBe(true);
    });

    it('does not show overlay on two-finger touchstart', () => {
        setupTouchOverlay(container);
        const overlay = container.querySelector('.map-touch-overlay')!;

        container.dispatchEvent(new TouchEvent('touchstart', {
            touches: [
                new Touch({ identifier: 0, target: container }),
                new Touch({ identifier: 1, target: container }),
            ],
        }));

        expect(overlay.classList.contains('visible')).toBe(false);
    });

    it('hides overlay after timeout', async () => {
        vi.useFakeTimers();
        setupTouchOverlay(container);
        const overlay = container.querySelector('.map-touch-overlay')!;

        container.dispatchEvent(new TouchEvent('touchstart', {
            touches: [new Touch({ identifier: 0, target: container })],
        }));

        expect(overlay.classList.contains('visible')).toBe(true);

        vi.advanceTimersByTime(1500);
        expect(overlay.classList.contains('visible')).toBe(false);

        vi.useRealTimers();
    });
});
```

**Step 2: Run the tests**

Run: `npx vitest run tests/mapInit.test.ts`
Expected: All tests pass.

**Step 3: Run coverage check**

Run: `npx vitest run tests/mapInit.test.ts --coverage`
Expected: `src/scripts/mapInit.ts` has ≥80% branch coverage.

**Step 4: Commit**

```
test: add unit tests for map init touch detection and overlay
```

---

### Task 4: Manual E2E verification

**Step 1: Start dev server and test on mobile viewport**

Run: `npm run dev`

Verify on mobile (or Chrome DevTools device emulation):
1. Navigate to `/kontakt/`
2. One-finger drag on map → overlay appears, page scrolls normally
3. Two-finger pinch → zoom works
4. Overlay fades after ~1.5s
5. Desktop: mouse drag works normally, no overlay

**Step 2: Run full build**

Run: `npm run build`
Expected: Clean build.

---
