/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initMenuHighlight } from '../menu-highlight.js';

describe('menu-highlight.js', () => {
    let observerCallback;
    let observeMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock IntersectionObserver som en klasse
        global.IntersectionObserver = vi.fn().mockImplementation(function(cb) {
            observerCallback = cb;
            this.observe = observeMock;
            this.disconnect = vi.fn();
            this.unobserve = vi.fn();
        });

        // Sett opp DOM
        document.body.innerHTML = `
            <nav>
                <a href="/" data-nav-link>Hjem</a>
                <a href="/#tjenester" data-nav-link>Tjenester</a>
                <a href="/#kontakt" data-nav-link>Kontakt</a>
            </nav>
            <section id="forside"></section>
            <section id="tjenester"></section>
            <section id="kontakt"></section>
        `;

        // Mock location
        delete window.location;
        window.location = new URL('https://tennerogtrivsel.no/');
        
        // Mock console
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('skal highlighte riktig lenke når en seksjon er synlig', () => {
        initMenuHighlight();

        // Simuler at "tjenester" seksjonen blir synlig
        observerCallback([
            {
                isIntersecting: true,
                target: { id: 'tjenester' }
            }
        ]);

        const tjenesterLink = document.querySelector('a[href="/#tjenester"]');
        const hjemLink = document.querySelector('a[href="/"]');

        expect(tjenesterLink.classList.contains('font-bold')).toBe(true);
        expect(hjemLink.classList.contains('font-bold')).toBe(false);
    });

    it('skal highlighte tjenester-lenken når man er på en tjeneste-underside', () => {
        // Vi må overstyre pathname før vi kaller initMenuHighlight
        window.location = new URL('https://tennerogtrivsel.no/tjenester/min-tjeneste');
        
        initMenuHighlight();
        
        // Simuler et tilfeldig kall (skal overstyres av path-sjekken i starten av callback)
        // Men i koden din skjer sjekken INNI observerCallback
        observerCallback([]);

        const tjenesterLink = document.querySelector('a[href="/#tjenester"]');
        expect(tjenesterLink.classList.contains('font-bold')).toBe(true);
    });

    it('skal highlighte hjem-lenken når forside er synlig', () => {
        initMenuHighlight();

        observerCallback([
            {
                isIntersecting: true,
                target: { id: 'forside' }
            }
        ]);

        const hjemLink = document.querySelector('a[href="/"]');
        expect(hjemLink.classList.contains('font-bold')).toBe(true);
    });

    it('skal logge advarsel hvis ingen seksjoner finnes', () => {
        document.body.innerHTML = '<nav></nav>';
        initMenuHighlight();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Fant ingen sections'));
    });
});
