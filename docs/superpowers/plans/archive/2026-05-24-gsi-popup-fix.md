# GSI Popup-feil Fix — Implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fjerne automatisk `silentLogin()`-kall på sidelasting slik at GSI-popup-feilen `[GSI_LOGGER]: Failed to open popup window` ikke lenger oppstår.

**Architecture:** `admin-init.js` sin `hadRememberMe`-sti endres fra: spinner + `silentLogin()` → umiddelbar visning av innloggingsskjerm med «Husk meg»-avkryssingsboksen forhåndskrysset. `silentLogin` fjernes fra importen i `admin-init.js` (funksjon beholdes i `admin-auth.js` for API-retry-flyten).

**Tech Stack:** Vanilla JS (ES modules), Vitest + jsdom

---

## Berørte filer

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-init.js` | Fjern `silentLogin` fra import; erstatt `hadRememberMe`-blokk |
| `src/scripts/__tests__/admin-init.test.js` | Oppdater 2 tester, fjern 1 test |

---

### Task 1: Oppdater tester til ny forventet adferd (TDD — skriv rød test først)

**Files:**
- Modify: `src/scripts/__tests__/admin-init.test.js:224-231` og `:711-751`

- [ ] **Steg 1.1: Erstatt test på linje 224–231**

Finn denne testen:
```js
it('should try silentLogin when localStorage has remember-me flag but no user', async () => {
    localStorage.setItem('admin_remember_me', '1');
    getStoredUser.mockReturnValue(null);
    await import('../admin-init.js');
    await vi.waitFor(() => {
        expect(silentLogin).toHaveBeenCalled();
    });
});
```

Erstatt med:
```js
it('should show login and pre-check remember-me checkbox when hadRememberMe but no user', async () => {
    localStorage.setItem('admin_remember_me', '1');
    getStoredUser.mockReturnValue(null);
    await import('../admin-init.js');
    await vi.waitFor(() => {
        expect(showState).toHaveBeenCalledWith('login');
    });
    expect(silentLogin).not.toHaveBeenCalled();
    expect(document.getElementById('remember-me').checked).toBe(true);
});
```

- [ ] **Steg 1.2: Erstatt test på linje 711–721**

Finn denne testen:
```js
it('should show spinner and call silentLogin when hadRememberMe', async () => {
    localStorage.setItem('admin_remember_me', '1');
    getStoredUser.mockReturnValue(null);

    await import('../admin-init.js');

    await vi.waitFor(() => {
        expect(showState).toHaveBeenCalledWith('loading');
        expect(silentLogin).toHaveBeenCalled();
    });
});
```

Erstatt med:
```js
it('should show login with pre-checked remember-me when hadRememberMe', async () => {
    localStorage.setItem('admin_remember_me', '1');
    getStoredUser.mockReturnValue(null);

    await import('../admin-init.js');

    await vi.waitFor(() => {
        expect(showState).toHaveBeenCalledWith('login');
    });
    expect(showState).not.toHaveBeenCalledWith('loading');
    expect(silentLogin).not.toHaveBeenCalled();
    expect(document.getElementById('remember-me').checked).toBe(true);
});
```

- [ ] **Steg 1.3: Fjern test på linje 736–751**

Finn og slett hele denne testen (inkludert avsluttende `});`):
```js
it('should show login when admin-auth-failed fires during silent login', async () => {
    localStorage.setItem('admin_remember_me', '1');
    getStoredUser.mockReturnValue(null);

    await import('../admin-init.js');

    await vi.waitFor(() => expect(silentLogin).toHaveBeenCalled());

    // Simuler mislykket stille fornyelse
    window.dispatchEvent(new Event('admin-auth-failed'));

    await vi.waitFor(() => {
        const calls = showState.mock.calls.map(c => c[0]);
        expect(calls).toContain('login');
    });
});
```

- [ ] **Steg 1.4: Kjør tester og verifiser at de feiler**

```bash
npx vitest run src/scripts/__tests__/admin-init.test.js 2>&1 | grep -E "FAIL|PASS|✓|×|Error" | head -30
```

Forventet: de to nye testene feiler med noe som `Expected: "login" / Received: "loading"` og `Expected: not called / Received: called`.

---

### Task 2: Implementer fix i admin-init.js

**Files:**
- Modify: `src/scripts/admin-init.js:1-4` (import) og `:131-136` (hadRememberMe-blokk)

- [ ] **Steg 2.1: Fjern `silentLogin` fra import**

Finn:
```js
import {
    initGapi, initGis, login, logout, tryRestoreSession,
    silentLogin, getStoredUser, setRememberMe
} from './admin-client.js';
```

Erstatt med:
```js
import {
    initGapi, initGis, login, logout, tryRestoreSession,
    getStoredUser, setRememberMe
} from './admin-client.js';
```

- [ ] **Steg 2.2: Erstatt hadRememberMe-blokken**

Finn (ca. linje 131–136 i `setup()`-funksjonen):
```js
        } else if (hadRememberMe) {
            // Token fantes i localStorage men er utløpt → prøv stille fornyelse
            setRememberMe(true);
            showState('loading');
            window.addEventListener('admin-auth-failed', () => showState('login'), { once: true });
            silentLogin();
        } else {
```

Erstatt med:
```js
        } else if (hadRememberMe) {
            setRememberMe(true);
            showState('login');
            const rememberMeCheckbox = document.getElementById('remember-me');
            if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
        } else {
```

- [ ] **Steg 2.3: Kjør tester og verifiser at alle passerer**

```bash
npx vitest run src/scripts/__tests__/admin-init.test.js 2>&1 | tail -20
```

Forventet: alle tester passerer, ingen feil.

- [ ] **Steg 2.4: Kjør full testsuite for å avdekke regresjoner**

```bash
npx vitest run 2>&1 | tail -20
```

Forventet: alle tester passerer.

---

### Task 3: Commit

- [ ] **Steg 3.1: Kommitter endringene**

```bash
git add src/scripts/admin-init.js src/scripts/__tests__/admin-init.test.js
```

Commit-melding (norsk konvensjonell commit):
```
fix(admin-auth): fjern silentLogin() fra hadRememberMe-sti på sidelasting

Nettlesere blokkerer GSI sin interne window.open() når den kalles uten
brukergest. I stedet vises innloggingsskjermen umiddelbart med
«Husk meg»-avkryssingsboksen forhåndskrysset.

silentLogin() beholdes i admin-api-retry.js for midt-sesjon token-fornyelse.
```
