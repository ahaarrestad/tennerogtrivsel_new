# Spec: Admin-tilgangskontroll — vis «Ingen tilgang» uten gyldig Google-token

**Dato:** 2026-03-21
**Status:** Godkjent

## Bakgrunn

Admin-siden viser i dag dashboardet umiddelbart når et lagret token finnes i localStorage/sessionStorage — før Google API har bekreftet at tokenet faktisk er gyldig. `enforceAccessControl` kjøres asynkront *etter* at dashboardet er gjort synlig, noe som betyr at dashboardet kan rendres uten bekreftet gyldig token.

## Mål

- Dashboardet rendres **aldri** før `enforceAccessControl` har returnert suksess
- Brukere uten tilgang ser en tydelig «Ingen tilgang»-melding i stedet for redirect
- Overgangen fra «token funnet» til «verifisert» viser en spinner (ikke blank skjerm)

## UI-tilstander

Fire eksklusive tilstander. Kun én vises om gangen:

| Tilstand | Element | Trigger |
|---|---|---|
| Login | `#login-container` | Ingen lagret token ved oppstart |
| Laster | `#loading-container` | Token funnet, verifisering pågår |
| Dashboard | `#dashboard` | Token verifisert, tilgang bekreftet |
| Ingen tilgang | `#no-access-container` | Innlogget, men ingen tilgang — eller API-feil |

## HTML-endringer (`admin/index.astro`)

`#login-container` beholder sin nåværende default-synlighet (ingen `hidden` i HTML) som fallback for miljøer med treg JS-lasting. `admin-init.js` kaller `showState` eksplisitt under oppstart og overskriver denne default-tilstanden. Admin-siden krever JavaScript og ingen no-JS-garanti er tiltenkt.

Nytt `#loading-container` (spinner, sentrert, `class="hidden"`) og `#no-access-container` (`class="hidden"`) legges til i `<main>` ved siden av eksisterende containere.

`#no-access-container` inneholder:
- Ikon + overskrift «Ingen tilgang»
- Forklaringstekst: «Denne kontoen har ikke tilgang til admin-panelet»
- Knapp `#no-access-switch-btn` — «Logg inn med annen konto»
- Alternativ tekst ved nettverksfeil: «Kunne ikke verifisere tilgang. Prøv igjen.»

Knappens handler kobles til i `admin-init.js` i `setup()`, ved siden av de andre knapp-handlers (`loginBtn`, `userPill`):
```js
document.getElementById('no-access-switch-btn')?.addEventListener('click', () => {
    logout();
    login();
});
```
`logout` og `login` er allerede importert i `admin-init.js` via `admin-client.js`.

## JS-endringer

### `showState(name)` — ny eksportert funksjon i `admin-dashboard.js`

Bruker eksplisitt id-map for klarhet og robusthet. Skjuler alle fire containere, viser kun den navngitte. Tilbakestiller også `user-pill` til `display: none` ved overgang til login-tilstand:

```js
export function showState(name) {
    const idMap = {
        login: 'login-container',
        loading: 'loading-container',
        dashboard: 'dashboard',
        'no-access': 'no-access-container',
    };
    const target = idMap[name];
    if (!target) return;
    for (const id of Object.values(idMap)) {
        document.getElementById(id)?.classList.toggle('hidden', id !== target);
    }
    if (name === 'login') {
        const pill = document.getElementById('user-pill');
        if (pill) pill.style.display = 'none';
    }
}
```

### `updateUIWithUser` — innsnevret ansvar

Fjerner all logikk for å vise/skjule containere (`#login-container` og `#dashboard`). Oppdaterer kun bruker-pillen i nav (stil og tekstinnhold). Dashboardet vises ikke lenger herfra.

Konkret: fjern disse linjene fra nåværende implementasjon:
```js
// FJERN:
if (loginContainer) loginContainer.classList.add('hidden');
if (dashboard) dashboard.classList.remove('hidden');
```
Variabeldeklarasjonene for `loginContainer` og `dashboard` fjernes også.

### `enforceAccessControl` — endret returverdi

I stedet for å kalle `window.location.href = '/?access_denied=true'` og kalle `logout()` ved ingen tilgang, returnerer funksjonen `false`. `logout()` fjernes fra denne funksjonen — det er callerens ansvar å håndtere state. Ved tilgang returnerer funksjonen `accessMap` (truthy objekt, bevarer eksisterende retur-kontrakt for tester som sjekker enkelt-modulers tilgang).

```js
// Endret:
if (!hasAnyAccess && ids.length > 0) {
    console.warn("[Admin] Ingen tilgang funnet for noen moduler.");
    return false;
}
return accessMap;
```

Eksisterende tester som sjekker `window.location.href` ved ingen tilgang oppdateres til å verifisere `showState('no-access')`.

### `handleAuth` — ny flyt

```
1. showState('loading')
2. updateUIWithUser(user)   ← oppdaterer kun nav-pill
3. try:
     const result = await enforceAccessControl(config)
     if (result === false):
         showState('no-access')
     else:
         showState('dashboard')
         loadDashboardCounts(...)
         showInstallPromptIfEligible()
4. catch (err):
     console.error(err)
     showState('no-access')   ← nettverksfeil e.l.
```

**Mid-session token refresh:** `handleAuth` er allerede registrert som GIS-callback via `initGis(handleAuth)`. Når GIS mottar et nytt token (f.eks. etter stille fornyelse), kalles `handleAuth(userInfo)` direkte fra GIS-callbacken i `admin-auth.js` — det er ikke behov for en separat `admin-auth-refreshed`-lytter i `admin-init.js`. `showState('loading')` hoppes over hvis `#dashboard` allerede er synlig, for å unngå synlig flimmer:

```js
const dashboardVisible = !document.getElementById('dashboard')?.classList.contains('hidden');
if (!dashboardVisible) showState('loading');
```

### `admin-init.js` — oppstartflyt

```
Token funnet      → handleAuth(user)         ← showState('loading') skjer inni handleAuth
Ingen token       → showState('login')
hadRememberMe:
    showState('loading')
    window.addEventListener('admin-auth-failed', () => showState('login'), { once: true })
    silentLogin()
```

`admin-auth-failed`-lytteren i `hadRememberMe`-grenen sikrer at spinneren ikke henger i det uendelige ved mislykket stille fornyelse.

## Feilhåndtering

| Scenario | Oppførsel |
|---|---|
| Utløpt token i storage | `getStoredUser()` returnerer null → `showState('login')` |
| Gyldig token, ingen Drive-tilgang | `enforceAccessControl` returnerer `false` → `showState('no-access')` |
| Nettverksfeil under verifisering | `handleAuth` catch → `showState('no-access')` |
| Silent login feiler (`admin-auth-failed`) | Lytter i `hadRememberMe`-grenen → `showState('login')` |
| Token fornyelse mid-session | `handleAuth` hopper over spinner hvis dashboard er synlig |

## Testing

### `showState` — direkte enhetstester

- Kall `showState('login')` → `#login-container` synlig, de tre andre hidden, `#user-pill` display:none
- Kall `showState('loading')` → `#loading-container` synlig, de tre andre hidden
- Kall `showState('dashboard')` → `#dashboard` synlig, de tre andre hidden
- Kall `showState('no-access')` → `#no-access-container` synlig, de tre andre hidden
- Kall `showState('ukjent')` → ingen endring (funksjon returnerer tidlig). DOM-setupen i testen skal ha alle fire containere synlige slik at «ingen endring» faktisk er verifiserbar.

### `handleAuth` — nye testcaser

- **Spinner under verifisering:** Mock `enforceAccessControl` til et aldri-resolvende promise (`new Promise(() => {})`). Kall `handleAuth`. Verifiser at `#loading-container` er synlig og `#dashboard` er hidden uten å awaite handleAuth.
- **Dashboard etter suksess:** `enforceAccessControl` returnerer `accessMap` (truthy). Kall `handleAuth`. Verifiser at `#dashboard` er synlig og `#loading-container` hidden.
- **Ingen tilgang:** `enforceAccessControl` returnerer `false`. Kall `handleAuth`. Verifiser at `#no-access-container` er synlig og `#dashboard` hidden.
- **Nettverksfeil:** `enforceAccessControl` kaster. Verifiser at `#no-access-container` vises.
- **Mid-session refresh hopper over spinner:** Dashboard er synlig. Kall `handleAuth`. Verifiser at `showState('loading')` ikke kalles (dvs. `#loading-container` forblir hidden under kallet).

### DOM-oppsett i tester

`setupDOM()` i `admin-init.test.js` må oppdateres med de to nye containerne:
```html
<div id="loading-container" class="hidden"></div>
<div id="no-access-container" class="hidden"></div>
```
`handleAuth`-integrasjonstester som verifiserer synlighet av `#loading-container` og `#no-access-container` plasseres i `admin-init.test.js` (der `handleAuth` bor), ikke i `admin-dashboard.test.js`.

### Oppdaterte eksisterende tester

Den eksisterende testen `should logout and redirect if no access at all` i `admin-dashboard.test.js` splittes i to:

1. **`enforceAccessControl` enhetest:** Verifiser at funksjonen returnerer `false` og **ikke** kaller `logout()` når ingen ressurser er tilgjengelige.
2. **`handleAuth` integrasjonstest:** Verifiser at `showState('no-access')` kalles når `enforceAccessControl` returnerer `false`. Legg til egen test for at `handleAuth` ikke kaller `logout()` ved ingen tilgang (logout er nå brukerens valg via knappen).

Videre: fjern alle eksisterende assertions på `window.location.href === '/?access_denied=true'`.

I `admin-dashboard.test.js`: fjern assertions på `#login-container` hidden og `#dashboard` visible fra den eksisterende `updateUIWithUser`-testen — `updateUIWithUser` vil ikke lenger berøre disse elementene etter innsnevringen.
