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

        const clearLinks = () => {
            navLinks.forEach(link => link.classList.remove('text-blue-600', 'font-bold'));
        };

        // 1. Sjekk undersider (Slug)
        if (path.includes('/tjenester/')) {
            clearLinks();
            navLinks.forEach(link => {
                if (link.getAttribute('href').includes('tjenester')) {
                    link.classList.add('text-blue-600', 'font-bold');
                }
            });
            return;
        }

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Finn alle nav-lenker
                const navLinks = document.querySelectorAll('[data-nav-link]');

                navLinks.forEach(link => {
                    // Hent id fra href (f.eks "#tjenester" blir "tjenester")
                    const id = link.getAttribute('href').replace('/#', '');
                    console.log("Ser nå seksjonen:", id);
                    if (id === entry.target.id) {
                        link.classList.add('text-blue-600', 'font-bold');
                        link.classList.remove('text-slate-600');
                    } else {
                        link.classList.remove('text-blue-600', 'font-bold');
                        link.classList.add('text-slate-600');
                    }
                });
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Start overvåking av alle seksjoner som har en ID
    document.querySelectorAll('section[id]').forEach(section => {
        observer.observe(section);
    });
}