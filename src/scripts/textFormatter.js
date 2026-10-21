// Tekst- og datohjelpere: datoformat, StackEdit-opprydding, meldingssortering og slugs.

const dateFormatter = new Intl.DateTimeFormat('no-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
});

const FALLBACK_END_DATE = '2099-12-31';

/**
 * Formaterer en dato til "15. feb. 2026" formatet (norsk).
 * @param {Date|string} dateInput - Dato som skal formateres.
 * @returns {string} - Formatert dato-streng.
 */
export function formatDate(dateInput) {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);
    
    return dateFormatter.format(date);
}

/**
 * fjerner <!--stackedit_data: ... --> fra markdown innhold.
 * @param {string} content 
 * @returns {string}
 */
export function stripStackEditData(content) {
    if (!content) return "";
    return content.replace(/<!--stackedit_data:[\s\S]*?-->/g, "").trim();
}

/**
 * Sorterer meldinger basert på status og dato.
 * Logikk: 
 * 1. Aktive meldinger (nåværende dato mellom start og slutt) sortert etter sluttdato (nærst først).
 * 2. Planlagte meldinger (startdato i fremtiden) sortert etter startdato (nærst først).
 * 3. Utløpte meldinger (sluttdato i fortiden) sortert etter sluttdato (nyeste utløpt først).
 * 
 * @param {Array} messages - Liste med meldinger fra parseMarkdown
 * @returns {Array} - Sortert liste
 */
export function sortMessages(messages) {
    if (!messages || !Array.isArray(messages)) return [];
    
    // Vi bruker UTC-datoer for å unngå tidssone-problemer på S3/Produksjon.
    // Vi normaliserer "nå" til midnatt UTC.
    const today = new Date();
    const nowUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

    const parseToUTC = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    };

    // Pre-compute parsed dates and status for each message to avoid redundant parsing during sort
    const decorated = messages.map(msg => {
        const start = parseToUTC(msg.startDate);
        const end = parseToUTC(msg.endDate || FALLBACK_END_DATE);
        let status;
        if (start === null || end === null) status = 3;
        else if (nowUTC >= start && nowUTC <= end) status = 0;
        else if (nowUTC < start) status = 1;
        else status = 2;
        return { msg, start: start || 0, end: end || 0, status };
    });

    decorated.sort((a, b) => {
        if (a.status !== b.status) return a.status - b.status;
        if (a.status === 0) return a.end - b.end;
        if (a.status === 1) return a.start - b.start;
        if (a.status === 2) return b.end - a.end;
        return 0;
    });

    return decorated.map(d => d.msg);
}

/**
 * Lager en URL-vennlig og filnavn-vennlig tekst.
 * @param {string} text 
 * @returns {string}
 */
export function slugify(text) {
    if (!text) return "";
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')           // Bytt ut mellomrom med -
        .replace(/[æ]/g, 'ae')          // Håndter norske tegn
        .replace(/[ø]/g, 'oe')
        .replace(/[å]/g, 'aa')
        .replace(/[^\w-]+/g, '')        // Fjern alt som ikke er ord eller -
        .replace(/--+/g, '-')           // Bytt ut flere - med en enkel -
        .replace(/^-+/, '')             // Fjern - fra start
        .replace(/-+$/, '');            // Fjern - fra slutt
}
