export function initMenuHighlight() {

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px', // Trigger når seksjonen er i øvre del av skjermen
        threshold: 0
    };

    const observerCallback = (entries) => {
        const navLinks = document.querySelectorAll('[data-nav-link]');
        const path = window.location.pathname;

        console.log("Scriptet kjører nå på:", path);

        const clearLink = (link) => {
            link.classList.remove('text-brand-hover', 'font-bold');
            link.classList.add('text-brand');
        }

        const addLink = (link) => {
            link.classList.add('text-brand-hover', 'font-bold');
            link.classList.remove('text-brand');
        }

        const clearLinks = () => {
            navLinks.forEach(link => clearLink(link));
        };

        // 1. Sjekk undersider (Slug)
        if (path.includes('/tjenester')) {
            clearLinks();
            navLinks.forEach(link => {
                if (link.getAttribute('href').includes('tjenester')) {
                    addLink(link);
                }
            });
            return;
        }

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const visibleId = entry.target.id;

                navLinks.forEach(link => {
                    const href = link.getAttribute('href'); // Definert INNE i loopen

                    // Logikk for å finne ut om denne lenken matcher seksjonen vi ser på
                    const isHome = href === '/' && (visibleId === 'hero' || visibleId === 'forside');
                    const isSection =
                        href.replace('/#', '') === visibleId
                        || href.replace('#', '') === visibleId;

                    if (isHome || isSection) {
                        addLink(link);
                    } else {
                        // Vi fjerner bare hvis vi er i gang med å sjekke en match
                        // Men for å unngå at alle blinker, gjør vi det kun på de som ikke matcher
                        clearLink(link);
                    }
                });
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Start overvåking av alle seksjoner
    const sections = document.querySelectorAll('section[id]');
    if (sections.length > 0) {
        sections.forEach(section => observer.observe(section));
    } else {
        console.warn("Fant ingen sections med ID for meny-highlighting");
    }
}