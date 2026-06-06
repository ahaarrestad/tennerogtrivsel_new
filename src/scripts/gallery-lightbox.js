export function initGalleryLightbox() {
    const root = document.getElementById('galleri-lightbox');
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

    let current = 0;
    let lastTrigger = null;

    function render() {
        const im = images[current];
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
        root.setAttribute('aria-hidden', 'false');
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

    // keydown bindes til root (ikke document): fokus er fanget inni dialogen når
    // den er åpen, så Esc/piltaster/Tab bobler hit. Da unngår vi en listener-lekkasje
    // ved Astro view transitions, der #galleri-lightbox re-initialiseres per navigasjon.
    root.addEventListener('keydown', (e) => {
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
    });

    let startX = null;
    let deltaX = 0;
    stage.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; deltaX = 0; }, { passive: true });
    stage.addEventListener('touchmove', (e) => { if (startX !== null) deltaX = e.touches[0].clientX - startX; }, { passive: true });
    stage.addEventListener('touchend', () => {
        if (startX !== null && Math.abs(deltaX) > 50) {
            if (deltaX < 0) next(); else prev();
        }
        startX = null;
        deltaX = 0;
    });
}
