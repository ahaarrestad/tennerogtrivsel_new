/**
 * Replaces innerHTML with smooth height animation.
 * Measures current height, sets new content, measures new height, animates between.
 */
export function smoothReplaceContent(container, newHTML) {
    const oldHeight = container.offsetHeight;

    container.style.height = oldHeight + 'px';
    container.style.overflow = 'hidden';
    container.innerHTML = newHTML;

    requestAnimationFrame(() => {
        // Measure new content height
        container.style.height = 'auto';
        const newHeight = container.offsetHeight;
        container.style.height = oldHeight + 'px';

        // Force reflow, then set target height with transition
        void container.offsetHeight;
        container.style.transition = 'height 200ms ease-out';
        container.style.height = newHeight + 'px';

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            container.style.height = '';
            container.style.overflow = '';
            container.style.transition = '';
        };

        container.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, 300);
    });
}
