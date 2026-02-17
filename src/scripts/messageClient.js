// src/scripts/messageClient.js
import snarkdown from 'snarkdown';
import DOMPurify from 'dompurify';

export async function getActiveMessage() {
    try {
        const response = await fetch('/api/active-messages.json');
        if (!response.ok) return null;

        const meldinger = await response.json();
        
        // Siden API-et allerede filtrerer og sorterer, tar vi den første aktive meldingen
        const aktiv = meldinger[0];

        if (aktiv) {
            // Vi vasker og formaterer her, så slipper vi å gjøre det i hver komponent
            return {
                ...aktiv,
                htmlContent: DOMPurify.sanitize(snarkdown(aktiv.content))
            };
        }
        return null;
    } catch (err) {
        console.error("Feil ved henting av meldinger:", err);
        return null;
    }
}