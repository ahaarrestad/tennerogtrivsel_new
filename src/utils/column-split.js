/**
 * Finds the optimal split index for dividing categories into two columns.
 * Categories before the index go in column 1, from the index onward in column 2.
 * Maintains order and minimizes the row difference between columns.
 *
 * Each category must have either a `rows` property (total rows including header)
 * or an `items` property (item count, header row added automatically).
 */
export function findColumnSplitIndex(categories) {
    if (categories.length <= 1) return categories.length;

    const rows = categories.map(c => c.rows ?? (c.items + 1));
    const total = rows.reduce((s, r) => s + r, 0);

    let bestSplit = 1;
    let bestDiff = Infinity;
    let col1Sum = 0;

    for (let i = 0; i < rows.length; i++) {
        col1Sum += rows[i];
        const diff = Math.abs(col1Sum - (total - col1Sum));
        if (diff < bestDiff) {
            bestDiff = diff;
            bestSplit = i + 1;
        }
    }

    return bestSplit;
}
