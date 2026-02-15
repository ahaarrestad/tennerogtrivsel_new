// src/scripts/nav-controller.js

/**
 * Håndterer åpning og lukking av mobilmeny
 */
export function initMobileMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    function toggleMenu() {
        const isOpen = menuBtn?.getAttribute('data-state') === 'open';
        
        if (isOpen) {
            menuBtn?.setAttribute('data-state', 'closed');
            mobileMenu?.classList.add('hidden');
        } else {
            menuBtn?.setAttribute('data-state', 'open');
            mobileMenu?.classList.remove('hidden');
        }
    }

    menuBtn?.addEventListener('click', toggleMenu);

    // Lukk menyen når man trykker på en lenke
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            menuBtn?.setAttribute('data-state', 'closed');
            mobileMenu?.classList.add('hidden');
        });
    });
}