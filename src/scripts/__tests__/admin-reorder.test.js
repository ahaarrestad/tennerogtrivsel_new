// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { animateSwap, disableReorderButtons, enableReorderButtons, updateReorderButtonVisibility } from '../admin-reorder.js';

describe('animateSwap', () => {
    let container, elA, elB;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.innerHTML = '';
        document.body.appendChild(container);

        elA = document.createElement('div');
        elA.textContent = 'A';
        elA.style.height = '50px';
        container.appendChild(elA);

        elB = document.createElement('div');
        elB.textContent = 'B';
        elB.style.height = '50px';
        container.appendChild(elB);
    });

    it('should swap two adjacent elements in DOM (A before B → B before A)', async () => {
        await animateSwap(elA, elB);
        const children = [...container.children];
        expect(children[0].textContent).toBe('B');
        expect(children[1].textContent).toBe('A');
    });

    it('should swap when B is before A (B before A → A before B)', async () => {
        container.innerHTML = '';
        container.appendChild(elB);
        container.appendChild(elA);

        await animateSwap(elB, elA);
        const children = [...container.children];
        expect(children[0].textContent).toBe('A');
        expect(children[1].textContent).toBe('B');
    });

    it('should return a promise that resolves after swap', async () => {
        const result = animateSwap(elA, elB);
        expect(result).toBeInstanceOf(Promise);
        await result;
    });

    it('should handle elements that are not direct siblings', async () => {
        const middle = document.createElement('div');
        middle.textContent = 'M';
        container.insertBefore(middle, elB);
        // Order: A, M, B

        await animateSwap(elA, elB);
        const children = [...container.children];
        expect(children[0].textContent).toBe('B');
        expect(children[1].textContent).toBe('M');
        expect(children[2].textContent).toBe('A');
    });
});

describe('animateSwap - with layout (non-jsdom)', () => {
    let container, elA, elB;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.innerHTML = '';
        document.body.appendChild(container);

        elA = document.createElement('div');
        elA.textContent = 'A';
        container.appendChild(elA);

        elB = document.createElement('div');
        elB.textContent = 'B';
        container.appendChild(elB);

        // Mock getBoundingClientRect to simulate real layout
        elA.getBoundingClientRect = () => ({ top: 0, left: 0, width: 100, height: 50, right: 100, bottom: 50 });
        elB.getBoundingClientRect = () => ({ top: 50, left: 0, width: 100, height: 50, right: 100, bottom: 100 });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should set transition and transform styles for animation', async () => {
        const promise = animateSwap(elA, elB);

        // Styles should be applied before timeout fires
        expect(elA.style.transition).toContain('transform');
        expect(elA.style.transform).toContain('translateY(50px)');
        expect(elB.style.transform).toContain('translateY(-50px)');

        // Fire the timeout fallback
        vi.advanceTimersByTime(250);
        await promise;

        // After animation, styles should be cleared and elements swapped
        expect(elA.style.transition).toBe('');
        expect(elA.style.transform).toBe('');
        const children = [...container.children];
        expect(children[0].textContent).toBe('B');
        expect(children[1].textContent).toBe('A');
    });

    it('should resolve via transitionend event', async () => {
        const promise = animateSwap(elA, elB);

        // Fire transitionend instead of waiting for timeout
        elA.dispatchEvent(new Event('transitionend'));
        await promise;

        const children = [...container.children];
        expect(children[0].textContent).toBe('B');
        expect(children[1].textContent).toBe('A');
    });

    it('should swap when B is before A with layout (B→A DOM order, called as A,B)', async () => {
        // DOM order: B, A — but we call animateSwap(elA, elB)
        container.innerHTML = '';
        container.appendChild(elB);
        container.appendChild(elA);
        elA.getBoundingClientRect = () => ({ top: 50, left: 0, width: 100, height: 50, right: 100, bottom: 100 });
        elB.getBoundingClientRect = () => ({ top: 0, left: 0, width: 100, height: 50, right: 100, bottom: 50 });

        const promise = animateSwap(elA, elB);
        vi.advanceTimersByTime(250);
        await promise;

        // A and B should have swapped — A now first
        const children = [...container.children];
        expect(children[0].textContent).toBe('A');
        expect(children[1].textContent).toBe('B');
    });

    it('should only finish once even if both transitionend and timeout fire', async () => {
        const promise = animateSwap(elA, elB);

        // Fire transitionend first
        elA.dispatchEvent(new Event('transitionend'));
        // Then fire timeout
        vi.advanceTimersByTime(250);
        await promise;

        // Should still be correctly swapped (not double-swapped)
        const children = [...container.children];
        expect(children[0].textContent).toBe('B');
        expect(children[1].textContent).toBe('A');
    });
});

describe('disableReorderButtons', () => {
    it('should set disabled on all matching buttons within container', () => {
        document.body.innerHTML = `
            <div id="container">
                <button class="reorder-btn">Up</button>
                <button class="reorder-btn">Down</button>
                <button class="other-btn">Edit</button>
            </div>`;
        const container = document.getElementById('container');
        disableReorderButtons(container, '.reorder-btn');
        expect(container.querySelectorAll('.reorder-btn')[0].disabled).toBe(true);
        expect(container.querySelectorAll('.reorder-btn')[1].disabled).toBe(true);
        expect(container.querySelector('.other-btn').disabled).toBe(false);
    });
});

describe('enableReorderButtons', () => {
    it('should remove disabled from all matching buttons within container', () => {
        document.body.innerHTML = `
            <div id="container">
                <button class="reorder-btn" disabled>Up</button>
                <button class="reorder-btn" disabled>Down</button>
            </div>`;
        const container = document.getElementById('container');
        enableReorderButtons(container, '.reorder-btn');
        expect(container.querySelectorAll('.reorder-btn')[0].disabled).toBe(false);
        expect(container.querySelectorAll('.reorder-btn')[1].disabled).toBe(false);
    });
});

describe('updateReorderButtonVisibility', () => {
    it('should hide up-button on first item and down-button on last item', () => {
        document.body.innerHTML = `
            <div id="list">
                <div class="item">
                    <button data-dir="-1" class="reorder-btn">Up</button>
                    <button data-dir="1" class="reorder-btn">Down</button>
                </div>
                <div class="item">
                    <button data-dir="-1" class="reorder-btn">Up</button>
                    <button data-dir="1" class="reorder-btn">Down</button>
                </div>
                <div class="item">
                    <button data-dir="-1" class="reorder-btn">Up</button>
                    <button data-dir="1" class="reorder-btn">Down</button>
                </div>
            </div>`;
        const items = document.querySelectorAll('.item');
        updateReorderButtonVisibility(items, '.reorder-btn');

        // First: up hidden, down visible
        expect(items[0].querySelector('[data-dir="-1"]').hidden).toBe(true);
        expect(items[0].querySelector('[data-dir="1"]').hidden).toBe(false);
        // Middle: both visible
        expect(items[1].querySelector('[data-dir="-1"]').hidden).toBe(false);
        expect(items[1].querySelector('[data-dir="1"]').hidden).toBe(false);
        // Last: up visible, down hidden
        expect(items[2].querySelector('[data-dir="-1"]').hidden).toBe(false);
        expect(items[2].querySelector('[data-dir="1"]').hidden).toBe(true);
    });
});
