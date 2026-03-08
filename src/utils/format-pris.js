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

    const str = String(pris);

    // Prisområde: "1050 - 1350" → "kr 1 050 – 1 350"
    const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
        return `kr ${formatNumber(Number(rangeMatch[1]))} – ${formatNumber(Number(rangeMatch[2]))}`;
    }

    // Suffiks: "2700 pr time", "5950 + tekn.", "2980 m/tannteknikk"
    const suffixMatch = str.match(/^(\d+)\s+(.+)$/);
    if (suffixMatch) {
        return `kr ${formatNumber(Number(suffixMatch[1]))} ${suffixMatch[2]}`;
    }

    return str;
}
