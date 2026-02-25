/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initMobileMenu } from '../mobile-menu.js';

function isMenuVisible(menu) {
    return menu.classList.contains('opacity-100') && menu.classList.contains('pointer-events-auto');
}

function isMenuHidden(menu) {
    return menu.classList.contains('opacity-0') && menu.classList.contains('pointer-events-none');
}

describe('mobile-menu.js', () => {
    beforeEach(() => {
        // Sett opp en enkel DOM-struktur for hver test
        document.body.innerHTML = `
            <button id="menu-btn">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div id="mobile-menu" data-open="false" class="opacity-0 pointer-events-none">
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

        expect(isMenuVisible(mobileMenu)).toBe(true);
        expect(mobileMenu.getAttribute('data-open')).toBe('true');
        expect(menuBtn.getAttribute('data-state')).toBe('open');
    });

    it('skal skjule menyen igjen når man trykker to ganger', () => {
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        menuBtn.click(); // Åpne
        expect(mobileMenu.getAttribute('data-open')).toBe('true');

        menuBtn.click(); // Lukke

        expect(isMenuHidden(mobileMenu)).toBe(true);
        expect(mobileMenu.getAttribute('data-open')).toBe('false');
        expect(menuBtn.getAttribute('data-state')).toBe('closed');
    });

    it('skal lukke menyen når man trykker på en mobil-lenke', () => {
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileLink = document.querySelector('.mobile-link');

        menuBtn.click(); // Åpne først
        expect(isMenuVisible(mobileMenu)).toBe(true);

        mobileLink.click(); // Trykk på lenke

        expect(isMenuHidden(mobileMenu)).toBe(true);
        expect(mobileMenu.getAttribute('data-open')).toBe('false');
        expect(menuBtn.getAttribute('data-state')).toBe('closed');
    });

    it('skal håndtere at elementer mangler i DOM', () => {
        document.body.innerHTML = '';
        expect(() => initMobileMenu()).not.toThrow();
    });

    it('skal fungere selv om spans mangler inni knappen', () => {
        document.body.innerHTML = `
            <button id="menu-btn"></button>
            <div id="mobile-menu" data-open="false" class="opacity-0 pointer-events-none"></div>
        `;
        initMobileMenu();
        const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');

        menuBtn.click();
        expect(isMenuVisible(mobileMenu)).toBe(true);
        expect(mobileMenu.getAttribute('data-open')).toBe('true');

        menuBtn.click();
        expect(isMenuHidden(mobileMenu)).toBe(true);
        expect(mobileMenu.getAttribute('data-open')).toBe('false');
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
            <div id="mobile-menu" data-open="false" class="opacity-0 pointer-events-none">
                <a href="#test" class="mobile-link">Lenke</a>
            </div>
        `;
        initMobileMenu();
        const mobileLink = document.querySelector('.mobile-link');
        const mobileMenu = document.getElementById('mobile-menu');

        // Simuler åpen meny
        mobileMenu.classList.remove('opacity-0', 'pointer-events-none');
        mobileMenu.classList.add('opacity-100', 'pointer-events-auto');
        mobileLink.click();

        expect(isMenuHidden(mobileMenu)).toBe(true);
    });
});
