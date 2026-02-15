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
