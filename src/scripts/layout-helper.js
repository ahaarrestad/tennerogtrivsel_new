/**
 * layout-helper.js
 * Sentralisert logikk for å håndtere høyde på navbar, banner og sticky elementer.
 */

export function initLayoutHelper() {
    const banner = document.getElementById('banner-root');
    const navWrapper = document.getElementById('navbar-sticky-wrapper');
    const main = document.querySelector('main');

    function updateLayout() {
        let bannerHeight = 0;
        if (banner && !banner.classList.contains('hidden')) {
            bannerHeight = banner.offsetHeight;
        }

        if (navWrapper) {
            navWrapper.style.top = `${bannerHeight}px`;
        }

        if (main) {
            const totalHeaderHeight = main.offsetTop;
            document.documentElement.style.setProperty('--nav-total-height', `${totalHeaderHeight}px`);
        }
    }

    // Debounce resize via rAF to avoid layout thrashing
    let rafPending = false;
    function scheduleUpdate() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            updateLayout();
        });
    }

    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('load', updateLayout);

    const observer = new MutationObserver(scheduleUpdate);

    if (banner) {
        observer.observe(banner, {
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }
    if (main) {
        observer.observe(main, {
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    updateLayout();

    // Re-scroll til hash-anker etter første layout-beregning
    // (nettleseren kan ha scrollet til ankeret med feil scroll-margin-top)
    const hash = window.location.hash;
    if (hash) {
        const target = document.querySelector(hash);
        target?.scrollIntoView({ behavior: 'instant' });
    }
}
