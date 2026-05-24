# Design: Fiks GSI silent-refresh popup-feil i admin

**Dato:** 2026-05-24
**Status:** Godkjent

## Bakgrunn

Admin-konsollet logger `[GSI_LOGGER]: Failed to open popup window` i produksjon. Feilen oppstår fordi `silentLogin()` kalles automatisk på sidelasting (uten brukergest) når brukeren har huket av «Husk meg» men sesjonen er utløpt (f.eks. etter at fanen ble lukket). Google Identity Services (GIS) bruker `window.open()` internt for å hente nytt token, og moderne nettlesere blokkerer dette kallet fordi det ikke er initiert av en direkte brukerinteraksjon.

COOP-headeren (`Cross-Origin-Opener-Policy: same-origin-allow-popups`) er allerede korrekt konfigurert og er ikke årsaken til feilen.

## Rotårsak

`admin-init.js` kaller `silentLogin()` på sidelasting i `hadRememberMe`-stien:

```js
} else if (hadRememberMe) {
    setRememberMe(true);
    showState('loading');
    window.addEventListener('admin-auth-failed', () => showState('login'), { once: true });
    silentLogin(); // ← window.open() uten brukergest → blokkert
}
```

## Løsning

Fjern den automatiske `silentLogin()`-kallet fra sidelastingsflyten. Når `hadRememberMe` er satt men ingen gyldig sesjon finnes, vises innloggingsskjermen umiddelbart med «Husk meg»-avkryssingsboksen forhåndskrysset.

### Ny `hadRememberMe`-sti i `admin-init.js`

```js
} else if (hadRememberMe) {
    setRememberMe(true);
    showState('login');
    const rememberMeCheckbox = document.getElementById('remember-me');
    if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
}
```

`silentLogin` fjernes fra importen i `admin-init.js`.

## Avgrensning

`silentLogin()` beholdes i `admin-auth.js` og brukes fortsatt av `createAuthRefresher` i `admin-api-retry.js` for token-fornyelse midt i en sesjon (401/403-respons fra Google API). Denne flyten er uendret.

## Berørte filer

| Fil | Endring |
|-----|---------|
| `src/scripts/admin-init.js` | Fjern `silentLogin`-import; erstatt `hadRememberMe`-blokk |
| `src/scripts/__tests__/admin-init.test.js` | Oppdater tester som forventer `silentLogin`-kall ved `hadRememberMe` |

## Ikke berørt

- `src/scripts/admin-auth.js` — `silentLogin`-funksjonen beholdes
- `src/scripts/admin-api-retry.js` — uendret
- `src/utils/security-headers.ts` — COOP-header er korrekt og uendret
