// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { smoothReplaceContent } from '../admin-transition.js';

describe('smoothReplaceContent', () => {
    let container;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        container.innerHTML = '<p>Old content</p>';
        // Mock offsetHeight since jsdom doesn't do layout
        Object.defineProperty(container, 'offsetHeight', { value: 100, configurable: true });
        // Mock requestAnimationFrame to run synchronously
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(); return 0; });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        container.remove();
    });

    it('should replace innerHTML with new content', () => {
        smoothReplaceContent(container, '<p>New content</p>');
        expect(container.innerHTML).toContain('New content');
    });

    it('should set explicit height and overflow during transition', () => {
        smoothReplaceContent(container, '<p>New</p>');
        expect(container.style.overflow).toBe('hidden');
        // Height should be set (either old or new height)
        expect(container.style.height).not.toBe('');
    });

    it('should clean up inline styles after transition ends', () => {
        smoothReplaceContent(container, '<p>New</p>');
        container.dispatchEvent(new Event('transitionend'));
        expect(container.style.height).toBe('');
        expect(container.style.overflow).toBe('');
        expect(container.style.transition).toBe('');
    });

    it('should clean up via timeout fallback if transitionend does not fire', () => {
        smoothReplaceContent(container, '<p>New</p>');
        vi.advanceTimersByTime(300);
        expect(container.style.height).toBe('');
        expect(container.style.overflow).toBe('');
        expect(container.style.transition).toBe('');
    });

    it('should not double-cleanup when transitionend fires before timeout', () => {
        smoothReplaceContent(container, '<p>New</p>');
        container.dispatchEvent(new Event('transitionend'));
        // Timeout fires after transitionend already cleaned up — guard prevents double-run
        vi.advanceTimersByTime(300);
        expect(container.style.height).toBe('');
    });
});
