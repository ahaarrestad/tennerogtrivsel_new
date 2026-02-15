/**
 * Logikk for å avgjøre om en menylenke skal utheves
 */
function shouldHighlight(href, currentPath, visibleSectionId) {
    if (!href) return false;

    // Spesialhåndtering for undersider (f.eks. /tjenester/bleking)
    if (currentPath.includes('/tjenester') && href.includes('tjenester')) {
        return true;
    }

    // Normal seksjons-matching på forsiden
    if (visibleSectionId) {
        const isHome = href === '/' && (visibleSectionId === 'hero' || visibleSectionId === 'forside');
        const isSection = href.replace('/#', '') === visibleSectionId || href.replace('#', '') === visibleSectionId;
        
        return isHome || isSection;
    }

    return false;
}

export function initMenuHighlight() {
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    const observerCallback = (entries) => {
        const navLinks = document.querySelectorAll('[data-nav-link]');
        const path = window.location.pathname;

        const setLinkState = (link, active) => {
            if (active) {
                link.classList.add('text-brand-hover', 'font-bold');
                link.classList.remove('text-brand');
            } else {
                link.classList.remove('text-brand-hover', 'font-bold');
                link.classList.add('text-brand');
            }
        }

        // Håndter undersider umiddelbart hvis vi er der
        if (path.includes('/tjenester')) {
            navLinks.forEach(link => setLinkState(link, shouldHighlight(link.getAttribute('href'), path)));
            return;
        }

        // Håndter seksjoner på forsiden via observer
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const visibleId = entry.target.id;
                navLinks.forEach(link => setLinkState(link, shouldHighlight(link.getAttribute('href'), path, visibleId)));
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const sections = document.querySelectorAll('section[id]');
    if (sections.length > 0) {
        sections.forEach(section => observer.observe(section));
    } else {
        console.warn("Fant ingen sections med ID for meny-highlighting");
    }
}