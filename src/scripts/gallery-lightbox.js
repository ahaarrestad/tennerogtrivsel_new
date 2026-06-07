// Modul-scoped referanse til den aktive keydown-lytteren på document. init() kjøres
// på hver astro:page-load, og document persisterer på tvers av view transitions — så
// vi fjerner forrige lytter før vi legger til en ny for å unngå akkumulert lekkasje.
let docKeydownHandler = null;

export function initGalleryLightbox() {
    const root = document.getElementById('galleri-lightbox');
    // Rydd opp forrige keydown-lytter FØR de tidlige return-ene: ved navigasjon til en
    // side uten lightbox (root mangler) eller til en ny, uinitialisert root (view
    // transition erstattet elementet). Ellers ville lytteren blitt liggende på document
    // med en closure-referanse til den gamle root-en — minnelekkasje, og tastetrykk på
    // andre sider ville trigget den gamle handleren.
    if (!root || root.dataset.bound !== 'true') {
        if (docKeydownHandler) {
            document.removeEventListener('keydown', docKeydownHandler);
            docKeydownHandler = null;
        }
    }

    const dataEl = document.getElementById('galleri-lightbox-data');
    if (!root || !dataEl) return;
    if (root.dataset.bound === 'true') return;
    root.dataset.bound = 'true';

    let images = [];
    try {
        images = JSON.parse(dataEl.textContent || '[]');
    } catch {
        images = [];
    }
    if (images.length === 0) return;

    const imgEl = root.querySelector('[data-lightbox-img]');
    const titleEl = root.querySelector('[data-lightbox-title]');
    const countEl = root.querySelector('[data-lightbox-count]');
    const stage = root.querySelector('[data-lightbox-stage]');
    // Guard mot TypeError hvis DOM-strukturen i Lightbox.astro endres.
    if (!imgEl || !titleEl || !countEl || !stage) return;

    let current = 0;
    let lastTrigger = null;

    function render() {
        const im = images[current];
        // Defense-in-depth mot CodeQL js/xss-through-dom (alert #4). src kommer fra
        // byggetids-JSON som eier kontrollerer, og <img src> eksekverer aldri skript
        // — dette er belt-and-suspenders, ikke eneste forsvar.
        if (/^javascript:/i.test(im.src)) return;
        imgEl.setAttribute('src', im.src);
        if (im.srcset) imgEl.setAttribute('srcset', im.srcset);
        else imgEl.removeAttribute('srcset');
        imgEl.setAttribute('alt', im.alt || im.title || '');
        titleEl.textContent = im.title || '';
        titleEl.hidden = !im.title;
        countEl.textContent = `${current + 1} / ${images.length}`;
    }

    function open(index, trigger) {
        if (index < 0 || index >= images.length) return;
        current = index;
        lastTrigger = trigger || null;
        render();
        root.hidden = false;
        root.removeAttribute('aria-hidden');
        document.body.style.overflow = 'hidden';
        root.querySelector('[data-lightbox-close]')?.focus();
    }

    function close() {
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        lastTrigger?.focus();
    }

    function next() { current = (current + 1) % images.length; render(); }
    function prev() { current = (current - 1 + images.length) % images.length; render(); }

    document.querySelectorAll('[data-lightbox-index]').forEach((tile) => {
        tile.addEventListener('click', () => {
            const idx = Number(tile.getAttribute('data-lightbox-index'));
            if (!Number.isNaN(idx)) open(idx, tile);
        });
    });

    root.querySelector('[data-lightbox-next]')?.addEventListener('click', (e) => { e.stopPropagation(); next(); });
    root.querySelector('[data-lightbox-prev]')?.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
    root.querySelector('[data-lightbox-close]')?.addEventListener('click', (e) => { e.stopPropagation(); close(); });

    root.addEventListener('click', (e) => {
        if (e.target === root || e.target === stage) close();
    });

    // keydown bindes til document, ikke root: et klikk på det ikke-fokuserbare bildet
    // kan flytte fokus til document.body, og da bobler ikke tastetrykk inn i root —
    // Esc/piltaster ville sluttet å virke. document fanger uansett hvor fokus havner.
    // Forrige lytter er allerede ryddet opp på toppen av init(), så her tildeler vi bare.
    docKeydownHandler = (e) => {
        if (root.hidden) return;
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowRight') { next(); return; }
        if (e.key === 'ArrowLeft') { prev(); return; }
        if (e.key === 'Tab') {
            // DOM-kontrakten garanterer tre knapper (close/prev/next) i dialogen.
            const focusable = root.querySelectorAll('button');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };
    document.addEventListener('keydown', docKeydownHandler);

    let startX = null;
    let deltaX = 0;
    stage.addEventListener('touchstart', (e) => {
        if (!e.touches?.length) return;
        startX = e.touches[0].clientX;
        deltaX = 0;
    }, { passive: true });
    stage.addEventListener('touchmove', (e) => {
        if (startX === null || !e.touches?.length) return;
        deltaX = e.touches[0].clientX - startX;
    }, { passive: true });
    stage.addEventListener('touchend', () => {
        if (startX !== null && Math.abs(deltaX) > 50) {
            if (deltaX < 0) next(); else prev();
        }
        startX = null;
        deltaX = 0;
    });
}
