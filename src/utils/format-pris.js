/**
 * Formaterer et tall med nb-NO locale (tusen-mellomrom).
 */
function formatNumber(n) {
    return n.toLocaleString('nb-NO').replace(/\u00A0/g, ' ');
}

/**
 * Formaterer en pris til visning.
 * Støtter: heltall, prisområder, suffiks (+tekn., pr time, m/tannteknikk).
 */
export function formatPris(pris) {
    if (pris == null) return '';
    if (typeof pris === 'number') return `kr ${formatNumber(pris)}`;
    return String(pris);
}
