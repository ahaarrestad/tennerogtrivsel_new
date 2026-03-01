// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock leaflet and its assets before importing the module
vi.mock('leaflet', () => {
    const bindTooltipMock = vi.fn();
    const markerAddToMock = vi.fn(() => ({ bindTooltip: bindTooltipMock }));
    const tileAddToMock = vi.fn();
    const setViewMock = vi.fn().mockReturnThis();
    const mapMock = { setView: setViewMock };
    return {
        default: {
            map: vi.fn(() => mapMock),
            tileLayer: vi.fn(() => ({ addTo: tileAddToMock })),
            marker: vi.fn(() => ({ addTo: markerAddToMock })),
            Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
        },
    };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'marker.png' }));
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({ default: 'marker2x.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'shadow.png' }));

import L from 'leaflet';
import { isTouchDevice, getMapOptions, initMap, setupTouchOverlay } from '../mapInit';

/**
 * Helper: create a TouchEvent with a given number of touches.
 * jsdom lacks the Touch constructor, so we create a plain Event
 * and define the `touches` property manually.
 */
function createTouchEvent(type: string, touchCount: number): Event {
    const event = new Event(type, { bubbles: true });
    const fakeTouches = Array.from({ length: touchCount }, (_, i) => ({ identifier: i }));
    Object.defineProperty(event, 'touches', { value: fakeTouches });
    return event;
}

describe('isTouchDevice', () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(window, 'navigator');

    afterEach(() => {
        // Clean up ontouchstart if added
        if ('ontouchstart' in window) {
            delete (window as any).ontouchstart;
        }
        // Restore navigator
        if (originalNavigator) {
            Object.defineProperty(window, 'navigator', originalNavigator);
        }
    });

    it('returns true when ontouchstart is in window', () => {
        (window as any).ontouchstart = null;
        expect(isTouchDevice()).toBe(true);
    });

    it('returns true when navigator.maxTouchPoints > 0', () => {
        // Ensure ontouchstart is NOT present
        if ('ontouchstart' in window) {
            delete (window as any).ontouchstart;
        }
        Object.defineProperty(window, 'navigator', {
            value: { ...navigator, maxTouchPoints: 2 },
            configurable: true,
            writable: true,
        });
        expect(isTouchDevice()).toBe(true);
    });

    it('returns false when neither ontouchstart nor maxTouchPoints', () => {
        if ('ontouchstart' in window) {
            delete (window as any).ontouchstart;
        }
        Object.defineProperty(window, 'navigator', {
            value: { ...navigator, maxTouchPoints: 0 },
            configurable: true,
            writable: true,
        });
        expect(isTouchDevice()).toBe(false);
    });
});

describe('getMapOptions', () => {
    it('returns dragging false for touch devices', () => {
        const opts = getMapOptions(true);
        expect(opts.dragging).toBe(false);
    });

    it('returns dragging true for non-touch devices', () => {
        const opts = getMapOptions(false);
        expect(opts.dragging).toBe(true);
    });

    it('always returns scrollWheelZoom false', () => {
        expect(getMapOptions(true).scrollWheelZoom).toBe(false);
        expect(getMapOptions(false).scrollWheelZoom).toBe(false);
    });

    it('always returns tap false', () => {
        expect(getMapOptions(true).tap).toBe(false);
        expect(getMapOptions(false).tap).toBe(false);
    });

    it('always returns touchZoom true', () => {
        expect(getMapOptions(true).touchZoom).toBe(true);
        expect(getMapOptions(false).touchZoom).toBe(true);
    });
});

describe('setupTouchOverlay', () => {
    let mapEl: HTMLElement;

    beforeEach(() => {
        vi.useFakeTimers();
        mapEl = document.createElement('div');
        document.body.appendChild(mapEl);
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('creates overlay element with correct class and aria-hidden', () => {
        setupTouchOverlay(mapEl);
        const overlay = mapEl.querySelector('.map-touch-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay!.getAttribute('aria-hidden')).toBe('true');
    });

    it('sets mapEl position to relative', () => {
        setupTouchOverlay(mapEl);
        expect(mapEl.style.position).toBe('relative');
    });

    it('contains the overlay message with instruction text', () => {
        setupTouchOverlay(mapEl);
        const message = mapEl.querySelector('.map-touch-overlay-message');
        expect(message).not.toBeNull();
        expect(message!.textContent).toContain('Bruk to fingre for å flytte kartet');
    });

    it('adds visible class on single-finger touchstart', () => {
        setupTouchOverlay(mapEl);
        const overlay = mapEl.querySelector('.map-touch-overlay')!;

        mapEl.dispatchEvent(createTouchEvent('touchstart', 1));
        expect(overlay.classList.contains('visible')).toBe(true);
    });

    it('does NOT add visible class on two-finger touchstart', () => {
        setupTouchOverlay(mapEl);
        const overlay = mapEl.querySelector('.map-touch-overlay')!;

        mapEl.dispatchEvent(createTouchEvent('touchstart', 2));
        expect(overlay.classList.contains('visible')).toBe(false);
    });

    it('removes visible class after 1.5s timeout', () => {
        setupTouchOverlay(mapEl);
        const overlay = mapEl.querySelector('.map-touch-overlay')!;

        mapEl.dispatchEvent(createTouchEvent('touchstart', 1));
        expect(overlay.classList.contains('visible')).toBe(true);

        vi.advanceTimersByTime(1500);
        expect(overlay.classList.contains('visible')).toBe(false);
    });

    it('resets the timeout on repeated single-touch', () => {
        setupTouchOverlay(mapEl);
        const overlay = mapEl.querySelector('.map-touch-overlay')!;

        // First touch
        mapEl.dispatchEvent(createTouchEvent('touchstart', 1));
        expect(overlay.classList.contains('visible')).toBe(true);

        // Advance 1000ms (not yet 1500)
        vi.advanceTimersByTime(1000);
        expect(overlay.classList.contains('visible')).toBe(true);

        // Second touch resets the timer
        mapEl.dispatchEvent(createTouchEvent('touchstart', 1));

        // Advance another 1000ms (total 2000ms from first, but only 1000ms from second)
        vi.advanceTimersByTime(1000);
        expect(overlay.classList.contains('visible')).toBe(true);

        // Advance remaining 500ms to reach 1500ms from second touch
        vi.advanceTimersByTime(500);
        expect(overlay.classList.contains('visible')).toBe(false);
    });
});

describe('initMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        // Ensure non-touch device by default
        if ('ontouchstart' in window) {
            delete (window as any).ontouchstart;
        }
        Object.defineProperty(window, 'navigator', {
            value: { ...navigator, maxTouchPoints: 0 },
            configurable: true,
            writable: true,
        });
    });

    it('returns early when #map element does not exist', () => {
        initMap();
        expect(L.map).not.toHaveBeenCalled();
    });

    it('creates map with correct options when #map element exists', () => {
        const mapEl = document.createElement('div');
        mapEl.id = 'map';
        mapEl.dataset.lat = '59.9';
        mapEl.dataset.lng = '10.7';
        mapEl.dataset.name = 'Test Location';
        document.body.appendChild(mapEl);

        initMap();

        expect(L.map).toHaveBeenCalledWith(mapEl, {
            scrollWheelZoom: false,
            dragging: true,
            tap: false,
            touchZoom: true,
        });
    });

    it('uses default lat/lng of 0 when data attributes are missing', () => {
        const mapEl = document.createElement('div');
        mapEl.id = 'map';
        document.body.appendChild(mapEl);

        initMap();

        // setView is called on the map mock returned by L.map
        const mapMock = (L.map as ReturnType<typeof vi.fn>).mock.results[0].value;
        expect(mapMock.setView).toHaveBeenCalledWith([0, 0], 17);
    });

    it('creates tile layer and adds to map', () => {
        const mapEl = document.createElement('div');
        mapEl.id = 'map';
        mapEl.dataset.lat = '59.9';
        mapEl.dataset.lng = '10.7';
        document.body.appendChild(mapEl);

        initMap();

        expect(L.tileLayer).toHaveBeenCalledWith(
            '/tiles/{z}/{x}/{y}.png',
            expect.objectContaining({
                maxZoom: 19,
            }),
        );
    });

    it('creates marker at correct coordinates and binds tooltip', () => {
        const mapEl = document.createElement('div');
        mapEl.id = 'map';
        mapEl.dataset.lat = '59.9';
        mapEl.dataset.lng = '10.7';
        mapEl.dataset.name = 'Klinikken';
        document.body.appendChild(mapEl);

        initMap();

        expect(L.marker).toHaveBeenCalledWith([59.9, 10.7]);
    });

    it('does NOT call setupTouchOverlay on non-touch device', () => {
        const mapEl = document.createElement('div');
        mapEl.id = 'map';
        mapEl.dataset.lat = '59.9';
        mapEl.dataset.lng = '10.7';
        document.body.appendChild(mapEl);

        initMap();

        // No overlay should be created
        const overlay = mapEl.querySelector('.map-touch-overlay');
        expect(overlay).toBeNull();
    });

    it('calls setupTouchOverlay on touch device', () => {
        (window as any).ontouchstart = null;

        const mapEl = document.createElement('div');
        mapEl.id = 'map';
        mapEl.dataset.lat = '59.9';
        mapEl.dataset.lng = '10.7';
        document.body.appendChild(mapEl);

        initMap();

        // Overlay should be created
        const overlay = mapEl.querySelector('.map-touch-overlay');
        expect(overlay).not.toBeNull();

        // Clean up
        delete (window as any).ontouchstart;
    });

    it('uses empty string for name when data-name is not set', () => {
        const mapEl = document.createElement('div');
        mapEl.id = 'map';
        document.body.appendChild(mapEl);

        initMap();

        // Marker should be created and tooltip bound with empty string
        const markerMock = (L.marker as ReturnType<typeof vi.fn>).mock.results[0].value;
        const addToResult = markerMock.addTo.mock.results[0].value;
        expect(addToResult.bindTooltip).toHaveBeenCalledWith('', expect.any(Object));
    });
});
