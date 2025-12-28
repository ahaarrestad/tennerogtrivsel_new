// 1. Definer meldingene dine
import messages from '../data/meldinger.json';

// 2. Finn den aktive meldingen

export function getActiveMessage() {
    const now = new Date();

    return messages.find(m => {
        const start = new Date(m.startDate);
        const end = new Date(m.endDate);
        end.setHours(23, 59, 59);
        return now >= start && now <= end;
    });
}

// Her håndterer vi både streng og liste
export function getTextAsArray(text) {
    return text
        ? (Array.isArray(text) ? text : [text])
        : [];
}