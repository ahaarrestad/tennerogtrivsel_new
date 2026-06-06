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

    // Task 3 setter inn keyboard/klikk-utenfor/swipe/focus-trap her, rett før }.
}
