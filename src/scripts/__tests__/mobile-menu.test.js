/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initMobileMenu } from '../mobile-menu.js';

describe('mobile-menu.js', () => {
    beforeEach(() => {
        // Sett opp en enkel DOM-struktur for hver test
        document.body.innerHTML = `
            <button id="menu-btn">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div id="mobile-menu" class="hidden">
                <a href="#test" class="mobile-link">Lenke</a>
            </div>
        `;
        initMobileMenu();
    });

    it('skal vise menyen når man trykker på menyknappen', () => {
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const spans = menuBtn.querySelectorAll('span');

        // Trykk på knappen
        menuBtn.click();

        expect(mobileMenu.classList.contains('hidden')).toBe(false);
        expect(spans[0].style.transform).toContain('rotate(45deg)');
        expect(spans[1].style.opacity).toBe('0');
    });

    it('skal skjule menyen igjen når man trykker to ganger', () => {
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        menuBtn.click(); // Åpne
        menuBtn.click(); // Lukke

        expect(mobileMenu.classList.contains('hidden')).toBe(true);
    });

    it('skal lukke menyen når man trykker på en mobil-lenke', () => {
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileLink = document.querySelector('.mobile-link');

        menuBtn.click(); // Åpne først
        expect(mobileMenu.classList.contains('hidden')).toBe(false);

        mobileLink.click(); // Trykk på lenke

        expect(mobileMenu.classList.contains('hidden')).toBe(true);
    });

    it('skal håndtere at elementer mangler i DOM', () => {
        document.body.innerHTML = '';
        expect(() => initMobileMenu()).not.toThrow();
    });
});
