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
