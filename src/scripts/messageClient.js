// src/scripts/messageClient.js
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export async function getActiveMessage() {
    try {
        const response = await fetch('/api/active-messages.json');
        if (!response.ok) return null;

        const meldinger = await response.json();

        // Filtrering skjer på klienten — API-et returnerer alle meldinger
        // fordi statisk bygg fryser JSON ved byggetid.
        const now = new Date();
        const aktiv = meldinger.filter((m) => {
            const start = new Date(m.startDate);
            const end = new Date(m.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return now >= start && now <= end;
        })[0];

        if (aktiv) {
            // Vi vasker og formaterer her, så slipper vi å gjøre det i hver komponent
            return {
                ...aktiv,
                htmlContent: DOMPurify.sanitize(marked.parse(aktiv.content))
            };
        }
        return null;
    } catch (err) {
        console.error("Feil ved henting av meldinger:", err);
        return null;
    }
}