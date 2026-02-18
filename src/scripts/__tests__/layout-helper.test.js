/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initLayoutHelper } from '../layout-helper';

describe('initLayoutHelper', () => {
    let observerCallback;

    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.style.removeProperty('--nav-total-height');

        // Mock MutationObserver so we can trigger the callback manually
        vi.stubGlobal('MutationObserver', class {
            constructor(callback) {
                observerCallback = callback;
            }
            observe() {}
            disconnect() {}
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('skal sette --nav-total-height basert på main.offsetTop', () => {
        const banner = document.createElement('div');
        banner.id = 'banner-root';
        document.body.appendChild(banner);

        const main = document.createElement('main');
        document.body.appendChild(main);

        initLayoutHelper();

        const value = document.documentElement.style.getPropertyValue('--nav-total-height');
        expect(value).toBe('0px'); // jsdom returns 0 for offsetTop
    });

    it('skal ikke telle bannerhøyde når banner har .hidden klasse', () => {
        const banner = document.createElement('div');
        banner.id = 'banner-root';
        banner.classList.add('hidden');
        document.body.appendChild(banner);

        const navWrapper = document.createElement('div');
        navWrapper.id = 'navbar-sticky-wrapper';
        document.body.appendChild(navWrapper);

        const main = document.createElement('main');
        document.body.appendChild(main);

        initLayoutHelper();

        // Banner is hidden, so bannerHeight = 0 → navWrapper.style.top = '0px'
        expect(navWrapper.style.top).toBe('0px');
    });

    it('skal ikke krasje når det ikke finnes banner-element i DOM', () => {
        const main = document.createElement('main');
        document.body.appendChild(main);

        expect(() => initLayoutHelper()).not.toThrow();

        const value = document.documentElement.style.getPropertyValue('--nav-total-height');
        expect(value).toBe('0px');
    });

    it('skal kjøre recalc ved window resize', () => {
        const main = document.createElement('main');
        document.body.appendChild(main);

        initLayoutHelper();

        // Simulate a resize – updateLayout should run without throwing
        window.dispatchEvent(new Event('resize'));

        const value = document.documentElement.style.getPropertyValue('--nav-total-height');
        expect(value).toBe('0px');
    });

    it('skal kjøre recalc når MutationObserver oppdager en endring', () => {
        const main = document.createElement('main');
        document.body.appendChild(main);

        initLayoutHelper();

        // Trigger the observer callback manually
        observerCallback([{ type: 'attributes', attributeName: 'class' }]);

        const value = document.documentElement.style.getPropertyValue('--nav-total-height');
        expect(value).toBe('0px');
    });

    it('skal ikke sette --nav-total-height når main-element mangler', () => {
        // No <main> in DOM – the CSS variable should not be set
        const banner = document.createElement('div');
        banner.id = 'banner-root';
        document.body.appendChild(banner);

        expect(() => initLayoutHelper()).not.toThrow();

        const value = document.documentElement.style.getPropertyValue('--nav-total-height');
        expect(value).toBe('');
    });
});
