// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { animateSwap, disableReorderButtons, enableReorderButtons } from '../admin-reorder.js';

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
