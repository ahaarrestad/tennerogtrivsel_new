/**
 * layout-helper.js
 * Sentralisert logikk for å håndtere høyde på navbar, banner og sticky elementer.
 */

export function initLayoutHelper() {
    function updateLayout() {
        const banner = document.getElementById('banner-root');
        const navWrapper = document.getElementById('navbar-sticky-wrapper');
        const main = document.querySelector('main');

        let bannerHeight = 0;
        if (banner && !banner.classList.contains('hidden')) {
            bannerHeight = banner.offsetHeight;
        }

        // 1. Juster navbar-posisjon (denne ligger under banneret på mobil/desktop hvis banner er synlig)
        if (navWrapper) {
            navWrapper.style.top = `${bannerHeight}px`;
        }

        // 2. Oppdater CSS-variabelen --nav-total-height som brukes av .section-header-sticky
        if (main) {
            // main.offsetTop gir oss den totale høyden på alt over main (Banner + Navbar)
            const totalHeaderHeight = main.offsetTop;
            document.documentElement.style.setProperty('--nav-total-height', `${totalHeaderHeight}px`);
        }
    }

    // Lytt på vindusendringer
    window.addEventListener('resize', updateLayout);
    window.addEventListener('load', updateLayout);

    // Observer endringer på banner og main (f.eks. når banneret bytter 'hidden' klasse)
    const observer = new MutationObserver(() => {
        updateLayout();
    });

    const bannerRoot = document.getElementById('banner-root');
    const mainEl = document.querySelector('main');
    if (bannerRoot) {
        observer.observe(bannerRoot, {
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }
    if (mainEl) {
        observer.observe(mainEl, {
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    // Første kjøring
    updateLayout();
}
