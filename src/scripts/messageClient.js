// src/scripts/messageClient.js
import snarkdown from 'snarkdown';

export async function getActiveMessage() {
    try {
        const response = await fetch('/api/active-messages.json');
        if (!response.ok) return null;

        const meldinger = await response.json();
        const iDag = new Date();

        const aktiv = meldinger.find((m) => {
            if (!m.startDate || !m.endDate) return false;
            const start = new Date(m.startDate);
            const slutt = new Date(m.endDate);

            // FIKS: Sett sluttdato til slutten av døgnet (23:59:59)
            // Dette sikrer at den vises ut hele dagen som er valgt.
            slutt.setHours(23, 59, 59, 999);

            return iDag >= start && iDag <= slutt;
        });

        if (aktiv) {
            // Vi vasker og formaterer her, så slipper vi å gjøre det i hver komponent
            return {
                ...aktiv,
                htmlContent: snarkdown(aktiv.content.replace(/\n/g, '<br />'))
            };
        }
        return null;
    } catch (err) {
        console.error("Feil ved henting av meldinger:", err);
        return null;
    }
}