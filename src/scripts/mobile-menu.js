// src/scripts/nav-controller.js

/**
 * Håndterer åpning og lukking av mobilmeny
 */
export function initMobileMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    const spans = menuBtn?.querySelectorAll('span');

    function toggleMenu() {
        mobileMenu?.classList.toggle('hidden');

        // Animerer hamburger-ikonet til et "X"
        if (spans && !mobileMenu?.classList.contains('hidden')) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 6px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(5px, -6px)';
        } else if (spans) {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    }

    menuBtn?.addEventListener('click', toggleMenu);

    // Lukk menyen når man trykker på en lenke
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu?.classList.add('hidden');
            if (spans) {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    });
}