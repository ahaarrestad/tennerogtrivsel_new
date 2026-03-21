# «Bygg nå»-knapp i admin — Implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til en «Bygg nå»-knapp i admin-dashboardet som manuelt trigger et GitHub Actions bygg+deploy via en AWS Lambda-proxy, og viser tidspunkt for siste vellykkede bygg.

**Architecture:** Admin-panelet kaller en Lambda Function URL — POST for å trigge bygg (med Google OAuth-token for auth), GET for å hente siste vellykkede bygg. Lambda verifiserer Google-tokenet mot Googles tokeninfo-API og kaller GitHub API med en PAT lagret som Lambda-miljøvariabel.

**Tech Stack:** Node.js 22 (Lambda, native fetch), Vitest (tester), AWS CLI (deploy), GitHub fine-grained PAT, Google OAuth v3 tokeninfo.

**Spec:** `docs/superpowers/specs/2026-03-21-bygg-na-knapp-design.md`

---

## Filstruktur

**Opprett:**
- `lambda/admin-build-trigger/index.js` — Lambda-handler (GET + POST)
- `lambda/admin-build-trigger/package.json` — Package-konfig (type: module, ingen deps)
- `lambda/admin-build-trigger/__tests__/index.test.js` — Lambda-tester (Vitest Node)
- `src/scripts/admin-module-bygg.js` — Admin UI-modul
- `src/scripts/__tests__/admin-module-bygg.test.js` — Admin-modultester (Vitest jsdom)

**Endre:**
- `vitest.config.ts` — legg til lambda-tester i `include`
- `src/pages/admin/index.astro` — legg til bygg-seksjon HTML i dashboard-header
- `src/scripts/admin-init.js` — kall `initByggeModule()` etter vellykket auth
- `.github/workflows/deploy.yml` — legg til `PUBLIC_LAMBDA_BUILD_TRIGGER_URL` i env
- `.env` (lokal, ikke committet) — legg til `PUBLIC_LAMBDA_BUILD_TRIGGER_URL`

---

## Task 1: Installer AWS CLI og lag lambda-mappe

**Files:**
- Create: `lambda/admin-build-trigger/package.json`

- [ ] **Steg 1: Installer AWS CLI**

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

Forventet output: `aws-cli/2.x.x ...`

- [ ] **Steg 2: Verifiser at du er autentisert mot AWS**

```bash
aws sts get-caller-identity
```

Forventet: JSON med `Account`, `Arn`. Feil → kjør `aws configure` med nøklene fra IAM.

- [ ] **Steg 3: Opprett lambda-mappestruktur**

```bash
mkdir -p lambda/admin-build-trigger/__tests__
```

- [ ] **Steg 4: Lag package.json for Lambda**

Opprett `lambda/admin-build-trigger/package.json`:
```json
{
  "name": "admin-build-trigger",
  "version": "1.0.0",
  "type": "module",
  "description": "Lambda proxy for GitHub Actions build trigger"
}
```

- [ ] **Steg 5: Commit**

```bash
git add lambda/
git commit -m "chore: opprett lambda/admin-build-trigger-mappe"
```

---

## Task 2: Oppdater vitest.config.ts for Lambda-tester

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Steg 1: Oppdater include-pattern**

I `vitest.config.ts`, endre `include`:

```typescript
include: ['src/**/__tests__/**/*.{ts,js}', 'lambda/**/__tests__/**/*.{ts,js}'],
```

- [ ] **Steg 2: Verifiser at Vitest kjører uten feil**

```bash
npm test -- --reporter=verbose 2>&1 | tail -5
```

Forventet: alle eksisterende tester passerer fortsatt.

- [ ] **Steg 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: legg til lambda-tester i vitest include-pattern"
```

---

## Task 3: Skriv Lambda-tester (TDD)

**Files:**
- Create: `lambda/admin-build-trigger/__tests__/index.test.js`

Alle fetch-kall mockes. Tester kjøres med `npm test -- lambda`.

- [ ] **Steg 1: Opprett testfil med alle test-cases**

Opprett `lambda/admin-build-trigger/__tests__/index.test.js`:

```javascript
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Sett opp env-variabler FØR import av handler
vi.stubEnv('GITHUB_PAT', 'test-pat');
vi.stubEnv('GITHUB_OWNER', 'test-owner');
vi.stubEnv('GITHUB_REPO', 'test-repo');
vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Dynamisk import ETTER at env er satt
const { handler } = await import('../index.js');

function makeEvent(method, headers = {}) {
    return {
        requestContext: { http: { method } },
        headers,
    };
}

function mockTokeninfo(aud = 'test-client-id', expires_in = 3600) {
    return { ok: true, json: async () => ({ aud, expires_in }) };
}

function mockGithubRuns(runs = []) {
    return { ok: true, json: async () => ({ workflow_runs: runs }) };
}

function mockGithubDispatch(ok = true) {
    return { ok, status: ok ? 204 : 500, json: async () => ({}) };
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ── GET ──────────────────────────────────────────────────────────

describe('GET /', () => {
    it('returnerer siste vellykkede bygg-tidspunkt', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                workflow_runs: [{ id: 123, created_at: '2026-03-21T14:23:00Z' }],
            }),
        });

        const res = await handler(makeEvent('GET'));
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.timestamp).toBe('2026-03-21T14:23:00Z');
        expect(body.runId).toBe(123);
    });

    it('returnerer { timestamp: null, runId: null } når ingen vellykkede kjøringer finnes', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ workflow_runs: [] }),
        });

        const res = await handler(makeEvent('GET'));
        const body = JSON.parse(res.body);

        expect(body.timestamp).toBeNull();
        expect(body.runId).toBeNull();
    });

    it('svarer med cachet svar andre gang innen 60 sek — ingen nytt GitHub-kall', async () => {
        // Første kall — fyller cache
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                workflow_runs: [{ id: 456, created_at: '2026-03-21T10:00:00Z' }],
            }),
        });

        await handler(makeEvent('GET'));
        const callsAfterFirst = mockFetch.mock.calls.length;

        // Andre kall — skal bruke cache
        await handler(makeEvent('GET'));

        expect(mockFetch.mock.calls.length).toBe(callsAfterFirst); // Ingen nytt kall
    });
});

// ── POST ─────────────────────────────────────────────────────────

describe('POST / — autentisering', () => {
    it('returnerer 401 hvis Authorization-header mangler', async () => {
        const res = await handler(makeEvent('POST', {}));
        expect(res.statusCode).toBe(401);
    });

    it('returnerer 401 hvis Google-token er ugyldig (tokeninfo feiler)', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });

        const res = await handler(makeEvent('POST', { authorization: 'Bearer bad-token' }));
        expect(res.statusCode).toBe(401);
    });

    it('returnerer 403 hvis aud ikke matcher GOOGLE_CLIENT_ID', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ aud: 'annen-klient-id' }),
        });

        const res = await handler(makeEvent('POST', { authorization: 'Bearer valid-token' }));
        expect(res.statusCode).toBe(403);
    });

    it('returnerer 403 hvis aud er fraværende i tokeninfo-svaret', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ expires_in: 3600 }), // ingen aud
        });

        const res = await handler(makeEvent('POST', { authorization: 'Bearer valid-token' }));
        expect(res.statusCode).toBe(403);
    });
});

describe('POST / — bygg-kontroll', () => {
    it('returnerer { started: true } på happy path', async () => {
        mockFetch
            .mockResolvedValueOnce(mockTokeninfo())           // tokeninfo
            .mockResolvedValueOnce(mockGithubRuns([]))        // ingen aktive kjøringer
            .mockResolvedValueOnce(mockGithubDispatch(true)); // dispatch OK

        const res = await handler(makeEvent('POST', { authorization: 'Bearer valid-token' }));
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.started).toBe(true);
    });

    it('returnerer { already_running: true } hvis en kjøring har status in_progress', async () => {
        mockFetch
            .mockResolvedValueOnce(mockTokeninfo())
            .mockResolvedValueOnce(mockGithubRuns([{ status: 'in_progress' }]));

        const res = await handler(makeEvent('POST', { authorization: 'Bearer valid-token' }));
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.already_running).toBe(true);
    });

    it('returnerer { already_running: true } hvis en kjøring har status queued', async () => {
        mockFetch
            .mockResolvedValueOnce(mockTokeninfo())
            .mockResolvedValueOnce(mockGithubRuns([{ status: 'queued' }]));

        const res = await handler(makeEvent('POST', { authorization: 'Bearer valid-token' }));
        const body = JSON.parse(res.body);

        expect(body.already_running).toBe(true);
    });

    it('returnerer 502 hvis GitHub dispatch-API feiler', async () => {
        mockFetch
            .mockResolvedValueOnce(mockTokeninfo())
            .mockResolvedValueOnce(mockGithubRuns([]))
            .mockResolvedValueOnce(mockGithubDispatch(false));

        const res = await handler(makeEvent('POST', { authorization: 'Bearer valid-token' }));
        expect(res.statusCode).toBe(502);
    });
});

describe('Per-request timeout', () => {
    it('returnerer 502 hvis tokeninfo-kallet overskrider 3 sek (AbortController)', async () => {
        // Simuler at fetch avviser med AbortError
        const abortError = new DOMException('The operation was aborted.', 'AbortError');
        mockFetch.mockRejectedValueOnce(abortError);

        const res = await handler(makeEvent('POST', { authorization: 'Bearer valid-token' }));
        expect(res.statusCode).toBe(502);
    });
});

describe('Konfigurasjonsfeil', () => {
    it('returnerer 500 med JSON-body hvis GOOGLE_CLIENT_ID mangler', async () => {
        vi.stubEnv('GOOGLE_CLIENT_ID', '');

        // Dynamisk re-import av handler med manglende env
        const { handler: handlerWithoutConfig } = await import('../index.js?missing=1');
        const res = await handlerWithoutConfig(makeEvent('POST', { authorization: 'Bearer token' }));

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toBe('configuration_error');

        vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id'); // Gjenopprett
    });
});
```

- [ ] **Steg 2: Kjør testene og bekreft at de feiler (TDD)**

```bash
npm test -- lambda --reporter=verbose 2>&1 | tail -20
```

Forventet: `Cannot find module '../index.js'` eller lignende. Alle tester feiler.

---

## Task 4: Implementer Lambda-handler

**Files:**
- Create: `lambda/admin-build-trigger/index.js`

- [ ] **Steg 1: Opprett Lambda-handler**

Opprett `lambda/admin-build-trigger/index.js`:

```javascript
// lambda/admin-build-trigger/index.js

const ACTIVE_STATUSES = ['in_progress', 'queued', 'waiting'];
let getCache = null; // { data, expiresAt }

function getConfig() {
    const required = ['GITHUB_PAT', 'GITHUB_OWNER', 'GITHUB_REPO', 'GOOGLE_CLIENT_ID'];
    for (const key of required) {
        if (!process.env[key]) throw new Error(`Mangler env-var: ${key}`);
    }
    return {
        GITHUB_PAT: process.env.GITHUB_PAT,
        GITHUB_OWNER: process.env.GITHUB_OWNER,
        GITHUB_REPO: process.env.GITHUB_REPO,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    };
}

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

async function fetchWithTimeout(url, options = {}, ms = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

async function handleGet(config) {
    const now = Date.now();
    if (getCache && getCache.expiresAt > now) {
        return json(200, getCache.data);
    }

    const url = `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}/actions/runs` +
        `?workflow_id=deploy.yml&status=success&per_page=1`;

    const res = await fetchWithTimeout(url, {
        headers: {
            Authorization: `Bearer ${config.GITHUB_PAT}`,
            Accept: 'application/vnd.github+json',
        },
    });

    if (!res.ok) return json(502, { error: 'upstream_error' });

    const data = await res.json();
    const run = data.workflow_runs?.[0] ?? null;
    const result = { timestamp: run?.created_at ?? null, runId: run?.id ?? null };

    getCache = { data: result, expiresAt: now + 60_000 };
    return json(200, result);
}

async function handlePost(event, config) {
    const authHeader = event.headers?.authorization ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(401, { error: 'unauthorized' });

    // 1. Verifiser Google-token
    const tokenRes = await fetchWithTimeout(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`
    );
    if (!tokenRes.ok) return json(401, { error: 'unauthorized' });

    const tokenInfo = await tokenRes.json();
    if (!tokenInfo.aud || tokenInfo.aud !== config.GOOGLE_CLIENT_ID) {
        return json(403, { error: 'forbidden' });
    }

    // 2. Sjekk om bygg allerede kjører
    const baseUrl = `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}`;
    const githubHeaders = {
        Authorization: `Bearer ${config.GITHUB_PAT}`,
        Accept: 'application/vnd.github+json',
    };

    const runsRes = await fetchWithTimeout(
        `${baseUrl}/actions/runs?workflow_id=deploy.yml&per_page=20`,
        { headers: githubHeaders }
    );
    if (!runsRes.ok) return json(502, { error: 'upstream_error' });

    const runsData = await runsRes.json();
    const hasActive = runsData.workflow_runs?.some(r => ACTIVE_STATUSES.includes(r.status));
    if (hasActive) return json(200, { already_running: true });

    // 3. Trigger bygg
    const dispatchRes = await fetchWithTimeout(
        `${baseUrl}/dispatches`,
        {
            method: 'POST',
            headers: { ...githubHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_type: 'google_drive_update' }),
        }
    );
    if (!dispatchRes.ok) return json(502, { error: 'upstream_error' });

    return json(200, { started: true });
}

export const handler = async (event) => {
    let config;
    try {
        config = getConfig();
    } catch (err) {
        console.error('[admin-build-trigger] Konfigurasjonsfeil:', err.message);
        return json(500, { error: 'configuration_error' });
    }

    try {
        const method = event.requestContext?.http?.method;
        if (method === 'GET') return await handleGet(config);
        if (method === 'POST') return await handlePost(event, config);
        return json(405, { error: 'method_not_allowed' });
    } catch (err) {
        console.error('[admin-build-trigger] Uventet feil:', err);
        return json(500, { error: 'internal_error' });
    }
};
```

- [ ] **Steg 2: Kjør Lambda-tester og bekreft at de passerer**

```bash
npm test -- lambda --reporter=verbose
```

Forventet: alle Lambda-tester ✓. Sjekk coverage:

```bash
npm test -- lambda --coverage 2>&1 | grep -A5 "index.js"
```

Branches skal være ≥ 80%.

- [ ] **Steg 3: Commit**

```bash
git add lambda/
git commit -m "feat: implementer Lambda-handler for bygg-trigger med tester"
```

---

## Task 5: Deploy Lambda til AWS

**Manuelt steg (ikke automatisert): Opprett GitHub PAT.**

Gjør dette i nettleseren **før** du kjører AWS CLI-kommandoene:
1. Gå til GitHub → Settings → Developer settings → Fine-grained personal access tokens → Generate new token
2. Repository access: kun dette repositoryet
3. Permissions → Actions: **Read and write**
4. Gi tokenet et navn, f.eks. `admin-build-trigger`
5. Kopier tokenet — det vises bare én gang

**Files:** Ingen kodeendringer — kun infrastruktur.

- [ ] **Steg 1: Finn AWS Account ID og region**

```bash
export AWS_REGION=eu-west-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account: $AWS_ACCOUNT_ID, Region: $AWS_REGION"
```

- [ ] **Steg 2: Opprett IAM-rolle for Lambda**

```bash
aws iam create-role \
  --role-name admin-build-trigger-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name admin-build-trigger-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

Vent 10 sekunder før neste steg (IAM-rollen må propageres).

- [ ] **Steg 3: Pakk og opprett Lambda-funksjon**

```bash
cd lambda/admin-build-trigger
zip -j function.zip index.js

aws lambda create-function \
  --function-name admin-build-trigger \
  --runtime nodejs22.x \
  --role arn:aws:iam::${AWS_ACCOUNT_ID}:role/admin-build-trigger-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --memory-size 128 \
  --region $AWS_REGION

cd ../..
```

Forventet: JSON med `FunctionArn`.

- [ ] **Steg 4: Sett miljøvariabler (erstatt verdiene)**

```bash
# Hent GOOGLE_CLIENT_ID fra .env eller Google Cloud Console → Clients
aws lambda update-function-configuration \
  --function-name admin-build-trigger \
  --region $AWS_REGION \
  --environment "Variables={
    GITHUB_PAT=<din-github-pat>,
    GITHUB_OWNER=<github-brukernavn-eller-org>,
    GITHUB_REPO=<repo-navn>,
    GOOGLE_CLIENT_ID=<google-oauth-klient-id>
  }"
```

- [ ] **Steg 5: Opprett Function URL med CORS**

```bash
aws lambda create-function-url-config \
  --function-name admin-build-trigger \
  --region $AWS_REGION \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["https://test2.aarrestad.com-se"],
    "AllowMethods": ["GET", "POST"],
    "AllowHeaders": ["Authorization", "Content-Type"]
  }'
```

- [ ] **Steg 6: Tillat offentlig tilgang til Function URL**

```bash
aws lambda add-permission \
  --function-name admin-build-trigger \
  --region $AWS_REGION \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE
```

- [ ] **Steg 7: Hent og noter Lambda Function URL**

```bash
aws lambda get-function-url-config \
  --function-name admin-build-trigger \
  --region $AWS_REGION \
  --query FunctionUrl \
  --output text
```

Kopier URL-en — den trengs i neste task (`PUBLIC_LAMBDA_BUILD_TRIGGER_URL`).

- [ ] **Steg 8: Verifiser at Lambda fungerer**

```bash
LAMBDA_URL=$(aws lambda get-function-url-config \
  --function-name admin-build-trigger \
  --region $AWS_REGION \
  --query FunctionUrl --output text)

# Test GET
curl -s "$LAMBDA_URL" | jq .
```

Forventet: `{ "timestamp": "...", "runId": ... }` eller `{ "timestamp": null, "runId": null }`.

---

## Task 6: Legg til bygg-seksjon HTML i admin-panelet

**Files:**
- Modify: `src/pages/admin/index.astro`

- [ ] **Steg 1: Legg til HTML etter eksisterende infotekst i dashboard-headeren**

I `src/pages/admin/index.astro`, finn:
```html
<p class="admin-info-text !not-italic text-xs text-admin-muted-light mt-1">Endringer lagres på Google Disk og publiseres automatisk innen noen minutter.</p>
```

Legg til rett etter:
```html
<div class="flex items-center gap-3 mt-4 flex-wrap">
    <button id="bygg-na-btn"
            class="btn-primary flex items-center gap-2 py-2 px-4 text-sm opacity-50 cursor-not-allowed"
            disabled
            aria-label="Bygg og publiser nettstedet nå">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Bygg nå
    </button>
    <span id="bygg-status-text" class="text-xs text-admin-muted-light italic" aria-live="polite"></span>
</div>
```

- [ ] **Steg 2: Verifiser at HTML er korrekt (ingen byggfeil)**

```bash
npm run build:ci 2>&1 | tail -5
```

Forventet: ingen feil. (Knappen er synlig men deaktivert uten JS.)

---

## Task 7: Skriv admin-modul-tester (TDD)

**Files:**
- Create: `src/scripts/__tests__/admin-module-bygg.test.js`

- [ ] **Steg 1: Opprett testfil**

Opprett `src/scripts/__tests__/admin-module-bygg.test.js`:

```javascript
/**
 * @vitest-environment jsdom
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const LAMBDA_URL = 'https://test-lambda.lambda-url.eu-west-1.on.aws/';
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { initByggeModule } from '../admin-module-bygg.js';

function setupDOM() {
    document.body.innerHTML = `
        <button id="bygg-na-btn" disabled class="opacity-50 cursor-not-allowed" aria-label="Bygg nå"></button>
        <span id="bygg-status-text"></span>
    `;
}

function setToken(expiry = Date.now() + 300_000) {
    sessionStorage.setItem('admin_google_token', JSON.stringify({
        access_token: 'test-access-token',
        expiry,
        user: { email: 'test@example.com' },
    }));
}

function clearToken() {
    localStorage.removeItem('admin_google_token');
    sessionStorage.removeItem('admin_google_token');
}

beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearToken();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('initByggeModule — auth-guard', () => {
    it('knappen er deaktivert når ingen token finnes i storage', () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) });
        initByggeModule(LAMBDA_URL);
        const btn = document.getElementById('bygg-na-btn');
        expect(btn.disabled).toBe(true);
    });

    it('knappen er deaktivert når token utløper innen 60 sek', () => {
        setToken(Date.now() + 30_000); // utløper om 30 sek
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) });
        initByggeModule(LAMBDA_URL);
        const btn = document.getElementById('bygg-na-btn');
        expect(btn.disabled).toBe(true);
    });

    it('knappen er aktivert når gyldig token finnes', async () => {
        setToken();
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) });
        initByggeModule(LAMBDA_URL);
        const btn = document.getElementById('bygg-na-btn');
        expect(btn.disabled).toBe(false);
    });
});

describe('initByggeModule — dashboard-innlasting', () => {
    it('GET kalles ved innlasting og tidspunkt vises', async () => {
        setToken();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ timestamp: '2026-03-21T14:23:00Z', runId: 1 }),
        });

        initByggeModule(LAMBDA_URL);
        await vi.runAllTimersAsync();

        expect(mockFetch).toHaveBeenCalledWith(LAMBDA_URL);
        const statusEl = document.getElementById('bygg-status-text');
        expect(statusEl.textContent).toContain('14:23');
    });

    it('viser "Ingen bygg ennå" når timestamp er null', async () => {
        setToken();
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ timestamp: null, runId: null }),
        });

        initByggeModule(LAMBDA_URL);
        await vi.runAllTimersAsync();

        const statusEl = document.getElementById('bygg-status-text');
        expect(statusEl.textContent).toBe('Ingen bygg ennå');
    });
});

describe('initByggeModule — knappeinteraksjon', () => {
    it('sender access_token fra storage i Authorization-header', async () => {
        setToken();
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) }) // GET ved init
            .mockResolvedValueOnce({ ok: true, json: async () => ({ started: true }) }); // POST

        initByggeModule(LAMBDA_URL);
        document.getElementById('bygg-na-btn').click();
        await vi.runAllTimersAsync();

        const postCall = mockFetch.mock.calls[1];
        expect(postCall[1].headers.Authorization).toBe('Bearer test-access-token');
    });

    it('viser "Bygg startet" ved vellykket { started: true }', async () => {
        setToken();
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ started: true }) });

        initByggeModule(LAMBDA_URL);
        document.getElementById('bygg-na-btn').click();
        await vi.runAllTimersAsync();

        const statusEl = document.getElementById('bygg-status-text');
        expect(statusEl.textContent).toBe('Bygg startet');
    });

    it('viser "Et bygg pågår allerede" ved { already_running: true }', async () => {
        setToken();
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ already_running: true }) });

        initByggeModule(LAMBDA_URL);
        document.getElementById('bygg-na-btn').click();
        await vi.runAllTimersAsync();

        expect(document.getElementById('bygg-status-text').textContent).toBe('Et bygg pågår allerede');
    });

    it('viser "Sesjon utløpt, logg inn igjen" ved 401', async () => {
        setToken();
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) })
            .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) });

        initByggeModule(LAMBDA_URL);
        document.getElementById('bygg-na-btn').click();
        await vi.runAllTimersAsync();

        expect(document.getElementById('bygg-status-text').textContent).toBe('Sesjon utløpt, logg inn igjen');
    });

    it('viser feilmelding ved 502', async () => {
        setToken();
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) })
            .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) });

        initByggeModule(LAMBDA_URL);
        document.getElementById('bygg-na-btn').click();
        await vi.runAllTimersAsync();

        expect(document.getElementById('bygg-status-text').textContent).toBe('Bygg kunne ikke startes, prøv igjen');
    });

    it('viser spinner mens POST pågår', async () => {
        setToken();
        let resolvePost;
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) })
            .mockReturnValueOnce(new Promise(r => { resolvePost = r; })); // henger

        initByggeModule(LAMBDA_URL);
        await vi.runAllTimersAsync();

        document.getElementById('bygg-na-btn').click();

        const btn = document.getElementById('bygg-na-btn');
        expect(btn.disabled).toBe(true);
        expect(btn.innerHTML).toContain('animate-spin');

        // Rydde opp
        resolvePost({ ok: true, json: async () => ({ started: true }) });
        await vi.runAllTimersAsync();
    });

    it('viser feilmelding når fetch() kaster (nettverksfeil)', async () => {
        setToken();
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ timestamp: null, runId: null }) })
            .mockRejectedValueOnce(new TypeError('Network error'));

        initByggeModule(LAMBDA_URL);
        document.getElementById('bygg-na-btn').click();
        await vi.runAllTimersAsync();

        expect(document.getElementById('bygg-status-text').textContent).toBe('Bygg kunne ikke startes, prøv igjen');
    });
});
```

- [ ] **Steg 2: Kjør tester og bekreft at de feiler (TDD)**

```bash
npm test -- admin-module-bygg --reporter=verbose 2>&1 | tail -10
```

Forventet: `Cannot find module '../admin-module-bygg.js'`.

---

## Task 8: Implementer admin-module-bygg.js

**Files:**
- Create: `src/scripts/admin-module-bygg.js`

- [ ] **Steg 1: Opprett admin-modulen**

Opprett `src/scripts/admin-module-bygg.js`:

```javascript
// src/scripts/admin-module-bygg.js

const SPINNER_SVG = `<svg class="animate-spin h-3.5 w-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

const PLAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

function getStoredToken() {
    for (const storage of [localStorage, sessionStorage]) {
        const stored = storage.getItem('admin_google_token');
        if (!stored) continue;
        try {
            const { access_token, expiry } = JSON.parse(stored);
            if (Date.now() < expiry - 60_000) return access_token;
        } catch { /* fall through */ }
    }
    return null;
}

function formatBuildTimestamp(iso) {
    if (!iso) return 'Ingen bygg ennå';
    const d = new Date(iso);
    const today = new Date();
    const time = d.toLocaleTimeString('no', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === today.toDateString()) return `i dag ${time}`;
    return `${d.toLocaleDateString('no', { day: 'numeric', month: 'short' })} ${time}`;
}

function setButtonEnabled(btn, enabled) {
    btn.disabled = !enabled;
    btn.classList.toggle('opacity-50', !enabled);
    btn.classList.toggle('cursor-not-allowed', !enabled);
}

let feedbackTimeout;

function showFeedback(statusEl, message) {
    clearTimeout(feedbackTimeout);
    statusEl.textContent = message;
}

async function fetchBuildStatus(lambdaUrl, statusEl) {
    if (!lambdaUrl) return;
    try {
        const res = await fetch(lambdaUrl);
        if (!res.ok) return;
        const { timestamp } = await res.json();
        statusEl.textContent = formatBuildTimestamp(timestamp);
    } catch { /* ikke kritisk */ }
}

async function triggerBuild(lambdaUrl, btn, statusEl) {
    const token = getStoredToken();
    if (!token) {
        showFeedback(statusEl, 'Logg inn igjen');
        return;
    }

    const originalHTML = btn.innerHTML;
    btn.innerHTML = `${SPINNER_SVG} Starter...`;
    btn.disabled = true;

    try {
        const res = await fetch(lambdaUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });

        const body = await res.json();

        if (res.status === 401) {
            showFeedback(statusEl, 'Sesjon utløpt, logg inn igjen');
        } else if (res.status === 403) {
            showFeedback(statusEl, 'Ikke autorisert');
        } else if (!res.ok) {
            showFeedback(statusEl, 'Bygg kunne ikke startes, prøv igjen');
        } else if (body.already_running) {
            showFeedback(statusEl, 'Et bygg pågår allerede');
        } else {
            showFeedback(statusEl, 'Bygg startet');
        }
    } catch {
        showFeedback(statusEl, 'Bygg kunne ikke startes, prøv igjen');
    } finally {
        btn.innerHTML = originalHTML;
        setButtonEnabled(btn, !!getStoredToken());
        feedbackTimeout = setTimeout(() => fetchBuildStatus(lambdaUrl, statusEl), 5000);
    }
}

export function initByggeModule(lambdaUrl = import.meta.env.PUBLIC_LAMBDA_BUILD_TRIGGER_URL) {
    const btn = document.getElementById('bygg-na-btn');
    const statusEl = document.getElementById('bygg-status-text');
    if (!btn || !statusEl) return;

    setButtonEnabled(btn, !!getStoredToken());
    fetchBuildStatus(lambdaUrl, statusEl);

    btn.addEventListener('click', () => triggerBuild(lambdaUrl, btn, statusEl));
    window.addEventListener('admin-auth-refreshed', () => setButtonEnabled(btn, !!getStoredToken()));
}
```

- [ ] **Steg 2: Kjør admin-modul-tester**

```bash
npm test -- admin-module-bygg --reporter=verbose
```

Forventet: alle tester ✓.

- [ ] **Steg 3: Sjekk branch coverage**

```bash
npm test -- admin-module-bygg --coverage 2>&1 | grep -A3 "admin-module-bygg"
```

Branches skal være ≥ 80%.

- [ ] **Steg 4: Commit**

```bash
git add src/scripts/admin-module-bygg.js src/scripts/__tests__/admin-module-bygg.test.js src/pages/admin/index.astro
git commit -m "feat: legg til admin-module-bygg og bygg-seksjon i dashboard"
```

---

## Task 9: Koble admin-module-bygg.js til admin-init.js

**Files:**
- Modify: `src/scripts/admin-init.js`

- [ ] **Steg 1: Importer initByggeModule**

Øverst i `src/scripts/admin-init.js`, legg til:
```javascript
import { initByggeModule } from './admin-module-bygg.js';
```

- [ ] **Steg 2: Kall initByggeModule i handleAuth**

I `handleAuth`-funksjonen, rett etter `loadDashboardCounts(...)`:
```javascript
loadDashboardCounts({ SHEET_ID, TJENESTER_FOLDER, MELDINGER_FOLDER });
initByggeModule(); // Legg til denne linjen
showInstallPromptIfEligible();
```

- [ ] **Steg 3: Kjør admin-init-tester**

```bash
npm test -- admin-init --reporter=verbose
```

Forventet: alle eksisterende tester passerer fortsatt.

- [ ] **Steg 4: Commit**

```bash
git add src/scripts/admin-init.js
git commit -m "feat: koble initByggeModule til admin-init handleAuth"
```

---

## Task 10: Oppdater deploy.yml og .env for ny miljøvariabel

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `.env` (lokal, ikke committet)

Per CLAUDE.md: ved nye `PUBLIC_*`-variabler skal workflow-filen oppdateres.

- [ ] **Steg 1: Legg til PUBLIC_LAMBDA_BUILD_TRIGGER_URL i deploy.yml**

I `deploy.yml`, legg til `PUBLIC_LAMBDA_BUILD_TRIGGER_URL` i `env`-blokken under **både** `e2e-tests`- og `build`-jobben:

```yaml
PUBLIC_LAMBDA_BUILD_TRIGGER_URL: ${{ secrets.LAMBDA_BUILD_TRIGGER_URL }}
```

(Samme mønster som de andre `PUBLIC_*`-variablene.)

- [ ] **Steg 2: Legg til env-variabel lokalt**

I `.env` (lokal fil, ikke committet):
```
PUBLIC_LAMBDA_BUILD_TRIGGER_URL=https://<din-lambda-url>.lambda-url.eu-west-1.on.aws/
```

Erstatt `<din-lambda-url>` med URL-en fra Task 5 steg 7.

- [ ] **Steg 3: Legg til GitHub Secret**

Gå til GitHub → repository → Settings → Secrets and variables → Actions → New repository secret:
- Name: `LAMBDA_BUILD_TRIGGER_URL`
- Value: Lambda Function URL fra Task 5 steg 7

- [ ] **Steg 4: Commit deploy.yml**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: legg til PUBLIC_LAMBDA_BUILD_TRIGGER_URL i deploy.yml env"
```

---

## Task 11: Kjør quality gate og commit spec + plan

**Files:** Ingen nye endringer.

- [ ] **Steg 1: Kjør alle tester**

```bash
npm test -- --reporter=verbose
```

Forventet: alle tester ✓, ingen regresjoner.

- [ ] **Steg 2: Sjekk branch coverage for berørte filer**

```bash
npm test -- --coverage 2>&1 | grep -E "admin-module-bygg|admin-init|index"
```

Alle berørte filer ≥ 80% branch coverage.

- [ ] **Steg 3: Commit spec og plan**

```bash
git add docs/superpowers/specs/2026-03-21-bygg-na-knapp-design.md
git add docs/superpowers/plans/2026-03-21-bygg-na-knapp.md
git commit -m "docs: legg til spec og implementasjonsplan for bygg-nå-knapp"
```

- [ ] **Steg 4: Oppdater TODO.md**

Flytt «Bygg nå»-knapp-oppgaven til Pågående i `TODO.md` og legg til plan-lenke:

```markdown
- [ ] **«Bygg nå»-knapp i admin** ([plan](docs/superpowers/plans/2026-03-21-bygg-na-knapp.md))
```

```bash
git add TODO.md
git commit -m "chore: flytt bygg-nå-oppgave til pågående med plan-lenke"
```

- [ ] **Steg 5: Manuell smoke-test i nettleseren**

1. Start lokal dev-server: `npm run dev`
2. Gå til `http://localhost:4321/admin`
3. Logg inn med Google
4. Bekreft at «Bygg nå»-knappen er synlig og aktivert
5. Trykk knappen — bekreft spinner og "Bygg startet"-melding
6. Verifiser i GitHub Actions at et nytt bygg startet
