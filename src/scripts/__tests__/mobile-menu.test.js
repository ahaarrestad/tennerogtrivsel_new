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

    it('skal fungere selv om spans mangler inni knappen', () => {
        document.body.innerHTML = `
            <button id="menu-btn"></button>
            <div id="mobile-menu" class="hidden"></div>
        `;
        initMobileMenu();
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        menuBtn.click();
        expect(mobileMenu.classList.contains('hidden')).toBe(false);
        
        menuBtn.click();
        expect(mobileMenu.classList.contains('hidden')).toBe(true);
    });

    it('skal fungere selv om mobile-menu mangler', () => {
        document.body.innerHTML = `
            <button id="menu-btn"><span></span><span></span><span></span></button>
        `;
        initMobileMenu();
        const menuBtn = document.getElementById('menu-btn');
        const spans = menuBtn.querySelectorAll('span');

        menuBtn.click();
        // Sjekker bare at det ikke krasjer og at ikon-animasjon skjer (siden spans finnes)
        expect(spans[0].style.transform).not.toBe('');
    });

    it('skal håndtere klikk på lenke når spans mangler', () => {
        document.body.innerHTML = `
            <div id="mobile-menu" class="hidden">
                <a href="#test" class="mobile-link">Lenke</a>
            </div>
        `;
        initMobileMenu();
        const mobileLink = document.querySelector('.mobile-link');
        const mobileMenu = document.getElementById('mobile-menu');
        
        mobileMenu.classList.remove('hidden');
        mobileLink.click();
        
        expect(mobileMenu.classList.contains('hidden')).toBe(true);
    });
});
