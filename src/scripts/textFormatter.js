// Formaterer tekst fra JSON for sikker visning i HTML.
// Håndterer norske spesialtegn, e-post og telefonnummer.
export function formatInfoText(rawText) {
    if (!rawText) return "";

    // 1. Definer mønstre
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const phoneRegex = /((\+47|0047)?\s*[2-9]\d{1}\s*\d{2}\s*\d{2}\s*\d{2})/g;

    // 2. Sikre korrekt håndtering av norske tegn
    // Vi mapper de vanligste særnorske tegnene til deres HTML-entiteter
    // Dette er valgfritt i moderne UTF-8, men gjør koden ekstremt robust.
    const charMap = {
        'æ': '&aelig;', 'ø': '&oslash;', 'å': '&aring;',
        'Æ': '&AElig;', 'Ø': '&Oslash;', 'Å': '&Aring;'
    };

    return rawText
        .replace(/[æøåÆØÅ]/g, (match) => charMap[match]) // html encode norske tegn
        .replace(emailRegex, '<a href="mailto:$1" class="text-blue-600">$1</a>') // linkify e-post
        .replace(phoneRegex, (match) => {
            // match er det fulle nummeret med mellomrom, f.eks. "51 42 33 33"
            const cleanNumber = match.replace(/\s+/g, '');
            return `<a href="tel:${cleanNumber}" class="text-blue-600">${match}</a>`;
        }); // linkify telefon
}