// src/scripts/nav-controller.js

/**
 * Håndterer åpning og lukking av mobilmeny
 */
export function initMobileMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    function openMenu() {
        menuBtn?.setAttribute('data-state', 'open');
        menuBtn?.setAttribute('aria-expanded', 'true');
        mobileMenu?.classList.remove('opacity-0', 'pointer-events-none');
        mobileMenu?.classList.add('opacity-100', 'pointer-events-auto');
    }

    function closeMenu() {
        menuBtn?.setAttribute('data-state', 'closed');
        menuBtn?.setAttribute('aria-expanded', 'false');
        mobileMenu?.classList.add('opacity-0', 'pointer-events-none');
        mobileMenu?.classList.remove('opacity-100', 'pointer-events-auto');
    }

    function toggleMenu() {
        const isOpen = menuBtn?.getAttribute('data-state') === 'open';
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    menuBtn?.addEventListener('click', toggleMenu);

    // Lukk menyen når man trykker på en lenke
    mobileLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });
}