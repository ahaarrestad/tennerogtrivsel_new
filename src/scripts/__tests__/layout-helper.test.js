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

    it('skal kjøre recalc ved window resize (via rAF)', () => {
        const main = document.createElement('main');
        document.body.appendChild(main);

        // Make rAF synchronous so the scheduled updateLayout callback actually runs
        vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 0; });

        initLayoutHelper();

        // Simulate a resize – scheduleUpdate queues an rAF which now runs immediately
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

describe('re-scroll ved hash i URL', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.style.removeProperty('--nav-total-height');

        // Reset location stub
        vi.unstubAllGlobals();

        // Mock MutationObserver
        vi.stubGlobal('MutationObserver', class {
            constructor() {}
            observe() {}
            disconnect() {}
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('skal scrolle til anker-element når hash matcher et element', () => {
        vi.stubGlobal('location', { hash: '#tjenester' });

        const section = document.createElement('section');
        section.id = 'tjenester';
        document.body.appendChild(section);

        // jsdom does not implement scrollIntoView – define it so we can spy on it
        Element.prototype.scrollIntoView = vi.fn();
        const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

        initLayoutHelper();

        expect(scrollIntoViewSpy).toHaveBeenCalledOnce();
        expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'instant' });

        delete Element.prototype.scrollIntoView;
    });

    it('skal IKKE re-scrolle ved resize – kun én gang ved oppstart', async () => {
        vi.stubGlobal('location', { hash: '#tjenester' });

        const section = document.createElement('section');
        section.id = 'tjenester';
        document.body.appendChild(section);

        Element.prototype.scrollIntoView = vi.fn();
        const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

        initLayoutHelper();

        scrollIntoViewSpy.mockClear();

        window.dispatchEvent(new Event('resize'));
        await new Promise(r => setTimeout(r, 0));

        expect(scrollIntoViewSpy).not.toHaveBeenCalled();

        delete Element.prototype.scrollIntoView;
    });

    it('skal ikke krasje når hash ikke matcher noe element', () => {
        vi.stubGlobal('location', { hash: '#finnesikke' });

        expect(() => initLayoutHelper()).not.toThrow();
    });

    it('skal ikke scrolle når URL ikke har hash', () => {
        vi.stubGlobal('location', { hash: '' });

        Element.prototype.scrollIntoView = vi.fn();
        const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

        initLayoutHelper();

        expect(scrollIntoViewSpy).not.toHaveBeenCalled();

        delete Element.prototype.scrollIntoView;
    });
});
