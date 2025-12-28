// src/scripts/messageClient.js
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

export async function getActiveMessage() {
    try {
        const response = await fetch('/meldinger.json');
        const messages = await response.json();
        const now = new Date();

        return messages.find(m => {
            const start = new Date(m.startDate);
            const end = new Date(m.endDate);
            end.setHours(23, 59, 59);
            return now >= start && now <= end;
        });
    } catch (e) {
        console.error("Feil ved henting av melding:", e);
        return null;
    }
}

export function renderMessageToElement(message, containerId, titleId, contentId) {
    if (!message) return;

    const container = document.getElementById(containerId);
    const titleEl = document.getElementById(titleId);
    const contentEl = document.getElementById(contentId);

    if (container && titleEl && contentEl) {
        console.log("title", message.title);
        titleEl.textContent = message.title;
        // Konverter markdown til HTML
        contentEl.innerHTML = marked.parse(message.body);
        // FJERN 'hidden' klassen
        container.classList.remove('hidden');
        console.log("working on container:", containerId);
    }
}