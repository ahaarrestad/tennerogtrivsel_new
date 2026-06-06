// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initGalleryLightbox } from '../gallery-lightbox.js';

const IMAGES = [
    { src: '/img/a.webp', srcset: '/img/a-1024.webp 1024w, /img/a-1600.webp 1600w', title: 'Bilde A', alt: 'Alt A' },
    { src: '/img/b.webp', srcset: '', title: 'Bilde B', alt: 'Alt B' },
    { src: '/img/c.webp', srcset: '', title: '', alt: 'Alt C' },
];

function setupDOM(images = IMAGES) {
    const tiles = images.map((_, i) => `<button data-lightbox-index="${i}" id="tile-${i}">tile ${i}</button>`).join('');
    document.body.innerHTML = `
        <div class="grid">${tiles}</div>
        <div id="galleri-lightbox" class="lightbox" role="dialog" aria-modal="true" aria-hidden="true" hidden>
            <button data-lightbox-close aria-label="Lukk">&times;</button>
            <button data-lightbox-prev aria-label="Forrige">&lsaquo;</button>
            <button data-lightbox-next aria-label="Neste">&rsaquo;</button>
            <div class="lightbox-stage" data-lightbox-stage><img data-lightbox-img alt="" /></div>
            <div class="lightbox-info"><p data-lightbox-title></p><p data-lightbox-count></p></div>
        </div>
        <script type="application/json" id="galleri-lightbox-data">${JSON.stringify(images)}</script>`;
}

const root = () => document.getElementById('galleri-lightbox');
const img = () => document.querySelector('[data-lightbox-img]');
const title = () => document.querySelector('[data-lightbox-title]');
const count = () => document.querySelector('[data-lightbox-count]');

beforeEach(() => setupDOM());
afterEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; });

describe('gallery-lightbox – kjerne', () => {
    it('åpner på bildet som ble klikket', () => {
        initGalleryLightbox();
        document.getElementById('tile-1').click();
        expect(root().hidden).toBe(false);
        expect(img().getAttribute('src')).toBe('/img/b.webp');
        expect(title().textContent).toBe('Bilde B');
        expect(count().textContent).toBe('2 / 3');
    });

    it('setter srcset og alt fra dataene', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        expect(img().getAttribute('srcset')).toContain('1600w');
        expect(img().getAttribute('alt')).toBe('Alt A');
    });

    it('skjuler tittel når bildet mangler tittel', () => {
        initGalleryLightbox();
        document.getElementById('tile-2').click();
        expect(title().hidden).toBe(true);
        expect(title().textContent).toBe('');
    });

    it('blar til neste og wrapper fra siste til første', () => {
        initGalleryLightbox();
        document.getElementById('tile-2').click();
        document.querySelector('[data-lightbox-next]').click();
        expect(count().textContent).toBe('1 / 3');
        expect(img().getAttribute('src')).toBe('/img/a.webp');
    });

    it('blar til forrige og wrapper fra første til siste', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        document.querySelector('[data-lightbox-prev]').click();
        expect(count().textContent).toBe('3 / 3');
    });

    it('×-knappen lukker', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        document.querySelector('[data-lightbox-close]').click();
        expect(root().hidden).toBe(true);
    });

    it('låser body-scroll ved åpning og frigjør ved lukking', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        expect(document.body.style.overflow).toBe('hidden');
        document.querySelector('[data-lightbox-close]').click();
        expect(document.body.style.overflow).toBe('');
    });

    it('returnerer fokus til utløsende tile ved lukking', () => {
        initGalleryLightbox();
        const tile = document.getElementById('tile-0');
        tile.click();
        document.querySelector('[data-lightbox-close]').click();
        expect(document.activeElement).toBe(tile);
    });

    it('dobbel init binder ikke handlere to ganger', () => {
        initGalleryLightbox();
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        document.querySelector('[data-lightbox-next]').click();
        expect(count().textContent).toBe('2 / 3');
    });

    it('gjør ingenting når lightbox-elementet mangler', () => {
        document.body.innerHTML = '';
        expect(() => initGalleryLightbox()).not.toThrow();
    });

    it('gjør ingenting når data-elementet mangler (men root finnes)', () => {
        document.getElementById('galleri-lightbox-data').remove();
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        expect(root().hidden).toBe(true);
    });

    it('gjør ingenting når dataene er tomme', () => {
        setupDOM([]);
        expect(() => initGalleryLightbox()).not.toThrow();
        expect(root().hidden).toBe(true);
    });

    it('takler ugyldig JSON i data-elementet uten å kaste', () => {
        setupDOM();
        document.getElementById('galleri-lightbox-data').textContent = '{ ikke gyldig json';
        expect(() => initGalleryLightbox()).not.toThrow();
        expect(root().hidden).toBe(true);
    });

    it('ignorerer tile med ugyldig data-lightbox-index', () => {
        initGalleryLightbox();
        const tile = document.getElementById('tile-0');
        tile.setAttribute('data-lightbox-index', 'xyz');
        tile.click();
        expect(root().hidden).toBe(true);
    });

    it('ignorerer out-of-bounds indeks i open()', () => {
        initGalleryLightbox();
        const tile = document.getElementById('tile-0');
        tile.setAttribute('data-lightbox-index', '99');
        tile.click();
        expect(root().hidden).toBe(true);
    });
});

describe('gallery-lightbox – input', () => {
    function fireTouch(el, type, x) {
        const ev = new Event(type, { bubbles: true });
        ev.touches = x === null ? [] : [{ clientX: x }];
        el.dispatchEvent(ev);
    }

    // keydown-handleren ligger på root (se impl), så testene dispatcher på root().
    it('piltaster blar og Esc lukker', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        root().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(count().textContent).toBe('2 / 3');
        root().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        expect(count().textContent).toBe('1 / 3');
        root().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(root().hidden).toBe(true);
    });

    it('ignorerer piltaster når lightbox er lukket', () => {
        initGalleryLightbox();
        root().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(root().hidden).toBe(true);
    });

    it('klikk på overlay utenfor bildet lukker', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        root().click();
        expect(root().hidden).toBe(true);
    });

    it('klikk på bildet lukker ikke', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        img().click();
        expect(root().hidden).toBe(false);
    });

    it('klikk på scenen (utenfor bildet) lukker', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        document.querySelector('[data-lightbox-stage]').click();
        expect(root().hidden).toBe(true);
    });

    it('swipe forbi terskel blar til neste', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const stage = document.querySelector('[data-lightbox-stage]');
        fireTouch(stage, 'touchstart', 200);
        fireTouch(stage, 'touchmove', 120);
        fireTouch(stage, 'touchend', null);
        expect(count().textContent).toBe('2 / 3');
    });

    it('swipe under terskel blar ikke', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const stage = document.querySelector('[data-lightbox-stage]');
        fireTouch(stage, 'touchstart', 200);
        fireTouch(stage, 'touchmove', 180);
        fireTouch(stage, 'touchend', null);
        expect(count().textContent).toBe('1 / 3');
    });

    it('swipe mot høyre blar til forrige (wrap)', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const stage = document.querySelector('[data-lightbox-stage]');
        fireTouch(stage, 'touchstart', 120);
        fireTouch(stage, 'touchmove', 220);
        fireTouch(stage, 'touchend', null);
        expect(count().textContent).toBe('3 / 3');
    });

    it('Tab med fokus i midten beholder standard tab-oppførsel', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const buttons = root().querySelectorAll('button');
        buttons[1].focus(); // verken første eller siste
        const ev = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
        root().dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
    });

    it('Tab fra siste knapp går til første (focus-trap)', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const buttons = root().querySelectorAll('button');
        buttons[buttons.length - 1].focus();
        const ev = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
        root().dispatchEvent(ev);
        expect(document.activeElement).toBe(buttons[0]);
        expect(ev.defaultPrevented).toBe(true);
    });

    it('Shift+Tab fra første knapp går til siste (focus-trap)', () => {
        initGalleryLightbox();
        document.getElementById('tile-0').click();
        const buttons = root().querySelectorAll('button');
        buttons[0].focus();
        const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true, bubbles: true });
        root().dispatchEvent(ev);
        expect(document.activeElement).toBe(buttons[buttons.length - 1]);
        expect(ev.defaultPrevented).toBe(true);
    });
});
