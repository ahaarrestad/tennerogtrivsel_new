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

        // Trykk på knappen
        menuBtn.click();

        expect(mobileMenu.classList.contains('hidden')).toBe(false);
        expect(menuBtn.getAttribute('data-state')).toBe('open');
    });

    it('skal skjule menyen igjen når man trykker to ganger', () => {
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        menuBtn.click(); // Åpne
        expect(menuBtn.getAttribute('data-state')).toBe('open');
        
        menuBtn.click(); // Lukke

        expect(mobileMenu.classList.contains('hidden')).toBe(true);
        expect(menuBtn.getAttribute('data-state')).toBe('closed');
    });

    it('skal lukke menyen når man trykker på en mobil-lenke', () => {
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileLink = document.querySelector('.mobile-link');

        menuBtn.click(); // Åpne først
        expect(mobileMenu.classList.contains('hidden')).toBe(false);

        mobileLink.click(); // Trykk på lenke

        expect(mobileMenu.classList.contains('hidden')).toBe(true);
        expect(menuBtn.getAttribute('data-state')).toBe('closed');
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
        expect(menuBtn.getAttribute('data-state')).toBe('open');
        
        menuBtn.click();
        expect(mobileMenu.classList.contains('hidden')).toBe(true);
        expect(menuBtn.getAttribute('data-state')).toBe('closed');
    });

    it('skal fungere selv om mobile-menu mangler', () => {
        document.body.innerHTML = `
            <button id="menu-btn"><span></span><span></span><span></span></button>
        `;
        initMobileMenu();
        const menuBtn = document.getElementById('menu-btn');

        menuBtn.click();
        expect(menuBtn.getAttribute('data-state')).toBe('open');
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
