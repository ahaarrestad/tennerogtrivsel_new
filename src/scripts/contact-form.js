export function initContactForm() {
    const modal     = document.getElementById('contact-modal');
    const form      = document.getElementById('contact-form');
    const openBtns  = document.querySelectorAll('.open-contact-modal');
    const closeBtn  = document.getElementById('close-contact-modal');
    const submitBtn = document.getElementById('contact-submit-btn');
    const successEl = document.getElementById('contact-success');
    const errorEl   = document.getElementById('contact-error');

    if (!modal || !form) return;

    openBtns.forEach(btn => {
        btn.addEventListener('click', () => modal.showModal());
    });
    closeBtn?.addEventListener('click', () => modal.close());

    modal.addEventListener('close', () => {
        form.reset();
        form.hidden = false;
        successEl.hidden = true;
        errorEl.hidden = true;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send melding';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.close();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sender...';
        errorEl.hidden = true;

        const data = {
            tema:    form.elements['tema']?.value    ?? '',
            navn:    form.elements['navn']?.value    ?? '',
            telefon: form.elements['telefon']?.value ?? '',
            epost:   form.elements['epost']?.value   ?? '',
            melding: form.elements['melding']?.value ?? '',
            website: form.elements['website']?.value ?? '',
        };

        try {
            const res = await fetch('/api/kontakt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                form.hidden = true;
                successEl.hidden = false;
            } else {
                const body = await res.json().catch(() => ({}));
                showError(body.error || 'Noe gikk galt. Prøv igjen.', submitBtn, errorEl);
            }
        } catch {
            showError(
                'Ingen nettverksforbindelse. Sjekk internett og prøv igjen.',
                submitBtn, errorEl
            );
        }
    });
}

function showError(msg, submitBtn, errorEl) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send melding';
}
