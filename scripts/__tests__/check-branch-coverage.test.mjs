import { describe, it, expect, vi } from 'vitest';
import { summarizeBranchCoverage, status, formatRow, run } from '../check-branch-coverage.mjs';

describe('summarizeBranchCoverage', () => {
    it('regner prosent per fil og sorterer lavest først', () => {
        const data = {
            '/repo/src/a.ts': { b: { 0: [1, 0], 1: [2, 3] } },
            '/repo/src/b.ts': { b: { 0: [0, 0] } },
        };
        expect(summarizeBranchCoverage(data, '/repo')).toEqual([
            { file: 'src/b.ts', pct: 0, covered: 0, total: 2 },
            { file: 'src/a.ts', pct: 75, covered: 3, total: 4 },
        ]);
    });

    it('fil uten branches teller som 100 %', () => {
        const data = { '/repo/src/c.ts': {} };
        expect(summarizeBranchCoverage(data, '/repo/')[0]).toEqual({
            file: 'src/c.ts', pct: 100, covered: 0, total: 0,
        });
    });
});

describe('status', () => {
    it.each([
        [79.9, 'FAIL'],
        [80, 'OK  '],
        [89.9, 'OK  '],
        [90, 'GOOD'],
    ])('%s %% → %s', (pct, expected) => {
        expect(status(pct)).toBe(expected);
    });
});

describe('run', () => {
    it('returnerer 1 og logger rader når en fil er under 80 %', () => {
        const log = vi.fn();
        const data = { '/repo/a.ts': { b: { 0: [1, 0] } } };
        expect(run(data, '/repo', log)).toBe(1);
        expect(log).toHaveBeenCalledWith('FAIL |  50.0% |     1/2 | a.ts');
    });

    it('returnerer 0 når alle filer er på eller over 80 %', () => {
        const data = { '/repo/a.ts': { b: { 0: [1, 1] } } };
        expect(run(data, '/repo', vi.fn())).toBe(0);
    });
});

describe('formatRow', () => {
    it('formaterer én rad', () => {
        expect(formatRow({ file: 'src/a.ts', pct: 75, covered: 3, total: 4 }))
            .toBe('FAIL |  75.0% |     3/4 | src/a.ts');
    });
});
