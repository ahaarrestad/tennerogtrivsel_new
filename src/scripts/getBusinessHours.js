/**
 * Extracts sorted, non-empty business hours entries from site settings.
 * Shared by Footer.astro and Kontakt.astro.
 *
 * @param {Record<string, string>} settings - Site settings object
 * @param {string[]} [fallback] - Fallback if no hours found
 * @returns {string[]}
 */
export function getBusinessHours(settings, fallback = []) {
    if (!settings) return fallback;
    return Object.keys(settings)
        .filter(key => key.startsWith('businessHours'))
        .sort()
        .map(key => settings[key])
        .filter(val => val && val.trim().length > 0);
}
