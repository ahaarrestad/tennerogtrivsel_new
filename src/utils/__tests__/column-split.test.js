import { describe, test, expect } from 'vitest';
import { findColumnSplitIndex } from '../column-split.js';

describe('findColumnSplitIndex', () => {
    test('returns 0 for empty array', () => {
        expect(findColumnSplitIndex([])).toBe(0);
    });

    test('returns 1 for single category', () => {
        expect(findColumnSplitIndex([{ rows: 5 }])).toBe(1);
    });

    test('splits two equal categories in the middle', () => {
        const categories = [{ rows: 5 }, { rows: 5 }];
        expect(findColumnSplitIndex(categories)).toBe(1);
    });

    test('splits to minimize difference between columns', () => {
        // rows: 3, 2, 2, 3 = total 10
        // split at 2: col1=5, col2=5 → diff=0 (optimal)
        const categories = [
            { rows: 3 }, { rows: 2 }, { rows: 2 }, { rows: 3 },
        ];
        expect(findColumnSplitIndex(categories)).toBe(2);
    });

    test('handles uneven categories', () => {
        // rows: 15, 4, 4, 4, 4, 1, 9 = total 41
        // Best split: [15,4]=19 vs [4,4,4,1,9]=22 → diff=3
        //   or [15,4,4]=23 vs [4,4,1,9]=18 → diff=5
        //   or [15]=15 vs [4,4,4,4,1,9]=26 → diff=11
        // Split at 2 gives diff=3, which is best
        const categories = [
            { rows: 15 }, { rows: 4 }, { rows: 4 },
            { rows: 4 }, { rows: 4 }, { rows: 1 }, { rows: 9 },
        ];
        expect(findColumnSplitIndex(categories)).toBe(2);
    });

    test('counts rows as items + 1 for header when using category objects', () => {
        // Convenience: accepts categories with itemCount and adds 1 for header
        const categories = [
            { items: 14 }, // 15 rows
            { items: 3 },  // 4 rows
            { items: 3 },  // 4 rows
        ];
        // total = 15+4+4 = 23
        // split at 1: col1=15, col2=8 → diff=7
        // split at 2: col1=19, col2=4 → diff=15
        // Best: split at 1
        expect(findColumnSplitIndex(categories)).toBe(1);
    });

    test('uses real prisliste data distribution', () => {
        // Actual category sizes from the project:
        // Faste priser: 14 items (15 rows)
        // Konserverende: 3 (4)
        // Pulpa rotbeh: 3 (4)
        // Rotbeh spesialist: 4 (5)
        // Fast protetikk: 6 (7)
        // Avtagbare proteser: 6 (7)
        // Kirurgisk: 3 (4)
        // Tannkjøttsykdommer: 1 (2)
        // Øvrige: 9 (10)
        // Total: 58 rows
        const categories = [
            { rows: 15 }, { rows: 4 }, { rows: 4 }, { rows: 5 },
            { rows: 7 }, { rows: 7 }, { rows: 4 }, { rows: 2 },
            { rows: 10 },
        ];
        const splitIndex = findColumnSplitIndex(categories);
        const col1 = categories.slice(0, splitIndex).reduce((s, c) => s + c.rows, 0);
        const col2 = categories.slice(splitIndex).reduce((s, c) => s + c.rows, 0);
        // Verify the split is reasonably balanced (diff ≤ 6)
        expect(Math.abs(col1 - col2)).toBeLessThanOrEqual(6);
        // And preserves order (splitIndex is between 1 and length-1)
        expect(splitIndex).toBeGreaterThanOrEqual(1);
        expect(splitIndex).toBeLessThan(categories.length);
    });
});
