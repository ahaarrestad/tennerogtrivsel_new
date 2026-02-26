/**
 * Converts a Norwegian title to a URL-friendly slug.
 * Example: "Krone / Bro / Fasetter" → "krone-bro-fasetter"
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/å/g, 'a')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
