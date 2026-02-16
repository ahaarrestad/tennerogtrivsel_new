// Formaterer tekst fra JSON for sikker visning i HTML.
// Håndterer norske spesialtegn, e-post og telefonnummer.
export function formatInfoText(rawText) {
    if (!rawText) return "";

    const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi;

    // Combined regex for all Norwegian phone number formats
    // Prioritize specific prefixed numbers first to avoid partial matches and nested links.
    const combinedPhoneRegex = new RegExp(
        `(` + // Start main capturing group (will be p1)

        // Pattern for +47 prefixed number (e.g., +47 23 45 67 89)
        // No leading \b here, match '+' directly as it's a non-word character
        `\\+47(?:\\s*\\d{2}){4}\\b` +
        `|` + // OR

        // Pattern for 0047 prefixed number (e.g., 0047 23 45 67 89)
        // No leading \b here, match '0047' directly
        `0047(?:\\s*\\d{2}){4}\\b` +
        `|` + // OR

        // Pattern for 8-digit number (2-9 followed by 7 digits, with optional spaces)
        // Requires word boundaries as it has no specific prefix characters
        `\\b[2-9]\\d{1}(?:\\s*\\d{2}){3}\\b` +
        `)` + // End main capturing group (p1)
        `` // No final \b, it's already inside each pattern
        , 'g');

    let formattedText = rawText
        .replace(emailRegex, '<a href="mailto:$1" class="text-brand hover:text-brand-hover hover:no-underline whitespace-nowrap">$1</a>');

    formattedText = formattedText.replace(combinedPhoneRegex, (match, p1) => { // p1 will be the matched phone number string
        const cleanNumber = p1.replace(/\s+/g, '');
        return `<a href="tel:${cleanNumber}" class="text-brand hover:text-brand-hover hover:no-underline lg:pointer-events-none lg:cursor-default lg:text-inherit lg:no-underline whitespace-nowrap">${p1}</a>`;
    });

    return formattedText;
}

/**
 * Formaterer en dato til "15. feb. 2026" formatet (norsk).
 * @param {Date|string} dateInput - Dato som skal formateres.
 * @returns {string} - Formatert dato-streng.
 */
export function formatDate(dateInput) {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);
    
    return new Intl.DateTimeFormat('no-NO', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    }).format(date);
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

    const getStatus = (msg) => {
        const start = parseToUTC(msg.startDate);
        const end = parseToUTC(msg.endDate || '2099-12-31');
        
        if (start === null || end === null) return 3; // Ukjent/Feil -> nederst
        
        if (nowUTC >= start && nowUTC <= end) return 0; // Aktiv
        if (nowUTC < start) return 1; // Planlagt
        return 2; // Utløpt
    };

    return [...messages].sort((a, b) => {
        const statusA = getStatus(a);
        const statusB = getStatus(b);

        if (statusA !== statusB) {
            return statusA - statusB;
        }

        // Samme status, sorter på dato
        const startA = parseToUTC(a.startDate) || 0;
        const startB = parseToUTC(b.startDate) || 0;
        const endA = parseToUTC(a.endDate || '2099-12-31') || 0;
        const endB = parseToUTC(b.endDate || '2099-12-31') || 0;

        if (statusA === 0) { // Aktiv: Sorter etter sluttdato (den som går ut først øverst)
            return endA - endB;
        }
        if (statusA === 1) { // Planlagt: Sorter etter startdato (den som starter først øverst)
            return startA - startB;
        }
        if (statusA === 2) { // Utløpt: Sorter etter sluttdato (den som utløp sist øverst)
            return endB - endA;
        }
        return 0;
    });
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
        .replace(/[^\w\-]+/g, '')       // Fjern alt som ikke er ord eller -
        .replace(/\-\-+/g, '-')         // Bytt ut flere - med en enkel -
        .replace(/^-+/, '')             // Fjern - fra start
        .replace(/-+$/, '');            // Fjern - fra slutt
}
