/**
 * Animerer bytte av to DOM-elementer med slide-effekt, deretter swapper dem i DOM.
 * Returnerer et Promise som resolves når animasjonen er ferdig.
 *
 * I jsdom (ingen layout engine) hoppes animasjon over — elementene swappes direkte.
 */
export async function animateSwap(elA, elB) {
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();

    const deltaY = rectB.top - rectA.top;

    // jsdom: all rects are 0 — skip animation, just swap
    if (deltaY === 0 && rectA.top === 0) {
        swapElements(elA, elB);
        return;
    }

    // Animate: A moves down, B moves up
    elA.style.transition = 'transform 180ms ease-out';
    elB.style.transition = 'transform 180ms ease-out';
    elA.style.transform = `translateY(${deltaY}px)`;
    elB.style.transform = `translateY(${-deltaY}px)`;

    await new Promise(resolve => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            elA.style.transition = '';
            elA.style.transform = '';
            elB.style.transition = '';
            elB.style.transform = '';
            swapElements(elA, elB);
            resolve();
        };
        elA.addEventListener('transitionend', finish, { once: true });
        // Fallback if transitionend doesn't fire
        setTimeout(finish, 250);
    });
}

function swapElements(elA, elB) {
    const parentA = elA.parentNode;
    const nextA = elA.nextSibling;

    if (nextA === elB) {
        // A is directly before B
        parentA.insertBefore(elB, elA);
    } else if (elB.nextSibling === elA) {
        // B is directly before A
        parentA.insertBefore(elA, elB);
    } else {
        // Not adjacent — use placeholder
        const placeholder = document.createComment('swap');
        parentA.replaceChild(placeholder, elA);
        elB.parentNode.insertBefore(elA, elB);
        placeholder.parentNode.replaceChild(elB, placeholder);
    }
}

/** Disabler alle reorder-knapper innenfor en container */
export function disableReorderButtons(container, selector) {
    container.querySelectorAll(selector).forEach(btn => { btn.disabled = true; });
}

/** Enabler alle reorder-knapper innenfor en container */
export function enableReorderButtons(container, selector) {
    container.querySelectorAll(selector).forEach(btn => { btn.disabled = false; });
}

/**
 * Oppdaterer synligheten av opp/ned-knapper basert på posisjon i listen.
 * Første element: skjul opp. Siste element: skjul ned. Resten: vis begge.
 */
export function updateReorderButtonVisibility(items, buttonSelector) {
    const arr = [...items];
    arr.forEach((item, idx) => {
        const upBtn = item.querySelector(`${buttonSelector}[data-dir="-1"]`);
        const downBtn = item.querySelector(`${buttonSelector}[data-dir="1"]`);
        if (upBtn) upBtn.classList.toggle('invisible', idx === 0);
        if (downBtn) downBtn.classList.toggle('invisible', idx === arr.length - 1);
    });
}
