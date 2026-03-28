/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initContactForm } from '../contact-form.js';

function setupDOM({ tema = ['Timebooking', 'Priser'] } = {}) {
    document.body.innerHTML = `
        <button id="open-contact-modal">Ta kontakt</button>
        <dialog id="contact-modal">
            <button id="close-contact-modal">✕</button>
            <form id="contact-form">
                <select name="tema">
                    ${tema.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
                <input name="navn" value="Ola Nordmann">
                <input name="telefon" value="12345678">
                <input name="epost" value="ola@example.com">
                <textarea name="melding">Hei!</textarea>
                <input name="website" value="">
                <button id="contact-submit-btn" type="submit">Send</button>
            </form>
            <div id="contact-success" hidden></div>
            <div id="contact-error" hidden></div>
        </dialog>
    `;
    initContactForm();
}

beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
});

describe('initContactForm', () => {
    it('åpner modalen ved klikk på open-knappen', () => {
        setupDOM();
        document.getElementById('open-contact-modal').click();
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    });

    it('lukker modalen ved klikk på close-knappen', () => {
        setupDOM();
        document.getElementById('close-contact-modal').click();
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
    });

    it('sender POST til /api/kontakt med skjemadata', async () => {
        setupDOM();
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

        const form = document.getElementById('contact-form');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

        const [url, opts] = fetch.mock.calls[0];
        expect(url).toBe('/api/kontakt');
        expect(opts.method).toBe('POST');
        const body = JSON.parse(opts.body);
        expect(body.navn).toBe('Ola Nordmann');
        expect(body.epost).toBe('ola@example.com');
        expect(body.website).toBe('');
    });

    it('viser suksessmelding og skjuler skjema ved 200-svar', async () => {
        setupDOM();
        global.fetch.mockResolvedValue({ ok: true });

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() =>
            expect(document.getElementById('contact-success').hidden).toBe(false)
        );
        expect(document.getElementById('contact-form').hidden).toBe(true);
    });

    it('viser feilmelding fra server ved ikke-ok svar', async () => {
        setupDOM();
        global.fetch.mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'For mange forsøk' }),
        });

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() =>
            expect(document.getElementById('contact-error').hidden).toBe(false)
        );
        expect(document.getElementById('contact-error').textContent).toBe('For mange forsøk');
    });

    it('viser nettverksfeil og aktiverer submit-knapp igjen ved fetch-feil', async () => {
        setupDOM();
        global.fetch.mockRejectedValue(new Error('Nettverksfeil'));

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() =>
            expect(document.getElementById('contact-error').hidden).toBe(false)
        );
        expect(document.getElementById('contact-submit-btn').disabled).toBe(false);
        expect(document.getElementById('contact-submit-btn').textContent).toBe('Send melding');
    });

    it('lukker ikke modalen ved klikk inne i dialogen (ikke backdrop)', () => {
        setupDOM();
        const form = document.getElementById('contact-form');
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: form });
        document.getElementById('contact-modal').dispatchEvent(event);
        expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();
    });

    it('lukker modalen ved klikk på bakdrop (target === modal)', () => {
        setupDOM();
        const modal = document.getElementById('contact-modal');
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: modal });
        modal.dispatchEvent(event);
        expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
    });

    it('viser fallback-feilmelding når server returnerer feil uten error-felt', async () => {
        setupDOM();
        global.fetch.mockResolvedValue({
            ok: false,
            json: async () => ({}),
        });

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() =>
            expect(document.getElementById('contact-error').hidden).toBe(false)
        );
        expect(document.getElementById('contact-error').textContent).toBe('Noe gikk galt. Prøv igjen.');
    });

    it('viser fallback-feilmelding når json() kaster feil', async () => {
        setupDOM();
        global.fetch.mockResolvedValue({
            ok: false,
            json: async () => { throw new Error('invalid json'); },
        });

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() =>
            expect(document.getElementById('contact-error').hidden).toBe(false)
        );
        expect(document.getElementById('contact-error').textContent).toBe('Noe gikk galt. Prøv igjen.');
    });

    it('sender POST med tomme felter når skjema mangler input-elementer', async () => {
        // Setter opp skjema uten felt — tvinger ?? '' -grenene i data-innsamlingen
        document.body.innerHTML = `
            <button id="open-contact-modal">Ta kontakt</button>
            <dialog id="contact-modal">
                <button id="close-contact-modal">✕</button>
                <form id="contact-form">
                    <button id="contact-submit-btn" type="submit">Send</button>
                </form>
                <div id="contact-success" hidden></div>
                <div id="contact-error" hidden></div>
            </dialog>
        `;
        initContactForm();
        global.fetch.mockResolvedValue({ ok: true });

        document.getElementById('contact-form')
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body.navn).toBe('');
        expect(body.epost).toBe('');
        expect(body.tema).toBe('');
        expect(body.telefon).toBe('');
        expect(body.melding).toBe('');
        expect(body.website).toBe('');
    });

    it('gjør ingenting uten nødvendige DOM-elementer', () => {
        document.body.innerHTML = '';
        expect(() => initContactForm()).not.toThrow();
    });
});
