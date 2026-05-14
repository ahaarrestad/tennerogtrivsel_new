# Fiks Lambda IP-deteksjon i rate-limiter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rett en bug der Lambda rate-limiter bruker CloudFront-nodens IP i stedet for brukerens IP, og oppdater sikkerhetsplanen til å reflektere dette som et funn.

**Architecture:** Lambda-funksjonen eksponeres via Function URL bak CloudFront. CloudFront setter `X-Forwarded-For`-headeren til sluttbrukerens IP, mens `requestContext.http.sourceIp` er CloudFront-nodens IP (alltid satt og alltid truthy). Nåværende kode sjekker `sourceIp` først, slik at `x-forwarded-for`-fallbacken aldri nås. Siden `x-origin-verify` allerede er verifisert før IP-lesingen, er det trygt å stole på `x-forwarded-for` satt av CloudFront. Etter fiksen: alle brukere bak samme CloudFront-node får separate rate-limit-buckets.

**Tech Stack:** Node.js ESM (Lambda), AWS SDK v3 (DynamoDB), Vitest.

---

## Berørte filer

- Modify: `lambda/kontakt-form-handler/index.mjs` — bytt rekkefølge på IP-henting
- Modify: `lambda/kontakt-form-handler/__tests__/handler.test.mjs` — oppdater `makeEvent`, legg til test for `x-forwarded-for`-prioritet
- Modify: `docs/plans/2026-05-14-helhetlig-sikkerhetsgjennomgang.md` — merk steg 3.4 som FUNN

---

## Task 1: Fiks IP-kilde i `index.mjs`

**Files:**
- Modify: `lambda/kontakt-form-handler/index.mjs:106-108`
- Modify: `lambda/kontakt-form-handler/__tests__/handler.test.mjs`

- [ ] **Steg 1.1: Skriv failing test for `x-forwarded-for`-prioritet**

  Legg til denne testen i `describe('handler', ...)` i `handler.test.mjs`, etter den eksisterende 429-testen:

  ```javascript
  it('bruker x-forwarded-for som IP for rate limiting nar begge er satt', async () => {
      // DynamoDB er rate-begrenset på viewer-IP (203.0.113.1), ikke CloudFront-noden (10.0.0.1)
      dynamoSend.mockImplementation((cmd) => {
          const key = cmd.input?.Key?.ip?.S;
          if (key === '203.0.113.1') {
              return Promise.resolve({
                  Item: {
                      ip:    { S: '203.0.113.1' },
                      count: { N: '3' },
                      ttl:   { N: String(Math.floor(Date.now() / 1000) + 600) },
                  },
              });
          }
          return Promise.resolve({ Item: null });
      });

      const event = {
          headers: {
              'x-origin-verify': 'test-secret',
              'x-forwarded-for': '203.0.113.1',
          },
          body: JSON.stringify(validPayload),
          requestContext: { http: { sourceIp: '10.0.0.1' } },  // CloudFront-node
      };
      const result = await handler(event);
      expect(result.statusCode).toBe(429);
  });
  ```

- [ ] **Steg 1.2: Kjør testen og bekreft at den feiler**

  ```bash
  cd lambda/kontakt-form-handler && npx vitest run __tests__/handler.test.mjs --reporter=verbose 2>&1 | tail -20
  ```

  Forventet: testen feiler med `expected 429, got 200` (fordi nåværende kode bruker `sourceIp: '10.0.0.1'` som ikke er rate-begrenset).

- [ ] **Steg 1.3: Implementer fiksen i `index.mjs`**

  Finn linjeblokken (linje 106–108):
  ```javascript
  const ip  = event.requestContext?.http?.sourceIp
           || event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
           || 'unknown';
  ```

  Erstatt med:
  ```javascript
  const ip  = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
           || event.requestContext?.http?.sourceIp
           || 'unknown';
  ```

- [ ] **Steg 1.4: Kjør alle handler-tester og bekreft grønt**

  ```bash
  cd lambda/kontakt-form-handler && npx vitest run __tests__/handler.test.mjs --reporter=verbose 2>&1 | tail -30
  ```

  Forventet: alle tester passerer, inkludert den nye.

- [ ] **Steg 1.5: Kjør coverage og bekreft ≥ 80% branch coverage**

  ```bash
  cd lambda/kontakt-form-handler && npx vitest run --coverage __tests__/handler.test.mjs 2>&1 | grep -E "index\.mjs|Branches|All files"
  ```

  Forventet: branch coverage ≥ 80% for `index.mjs`.

- [ ] **Steg 1.6: Commit**

  Fra repo-roten:
  ```bash
  git add lambda/kontakt-form-handler/index.mjs \
          lambda/kontakt-form-handler/__tests__/handler.test.mjs
  git commit -m "fix(lambda): bruk x-forwarded-for fremfor sourceIp for rate-limiting

  sourceIp i Lambda Function URL-konteksten er CloudFront-nodens IP,
  ikke sluttbrukerens. x-forwarded-for settes av CloudFront til viewer-IP.
  x-origin-verify-verifiseringen skjer før IP-lesing, så x-forwarded-for
  kan stoles på — bare CloudFront-kall passerer verifiseringen."
  ```

---

## Task 2: Rett opp steg 3.4 i sikkerhetsplanen

**Files:**
- Modify: `docs/plans/2026-05-14-helhetlig-sikkerhetsgjennomgang.md:313`

- [ ] **Steg 2.1: Finn nåværende steg 3.4-tekst om IP-henting**

  I `docs/plans/2026-05-14-helhetlig-sikkerhetsgjennomgang.md`, finn avsnittet som starter med:
  ```
  - IP-henting: `event.requestContext?.http?.sourceIp || event.headers?.['x-forwarded-for']`
  ```

- [ ] **Steg 2.2: Erstatt med korrekt analyse**

  Erstatt det avsnittet med:
  ```markdown
  - IP-henting: **FUNN (HIGH)** — `event.requestContext?.http?.sourceIp` er CloudFront-nodens IP, ikke sluttbrukerens. Siden `sourceIp` alltid er satt (og alltid truthy) nås aldri `x-forwarded-for`-fallbacken. Rate-limiting bruker dermed én delt bucket for alle brukere bak samme CloudFront-node, og er i praksis ubrukelig. **Fikset i egen commit:** bytt rekkefølge — bruk `x-forwarded-for` som primær kilde (CloudFront setter dette til viewer-IP), med `sourceIp` som fallback. `x-origin-verify`-valideringen skjer allerede før IP-lesingen, så `x-forwarded-for` kan stoles på.
  ```

- [ ] **Steg 2.3: Commit**

  ```bash
  git add docs/plans/2026-05-14-helhetlig-sikkerhetsgjennomgang.md
  git commit -m "docs(plan): merk Lambda IP-deteksjon som FUNN i steg 3.4

  sourceIp i Lambda-konteksten er CloudFront-nodens IP — rate-limiting
  var ubrukelig. Oppdaterer analysen til FUNN (HIGH) og dokumenterer
  at feilen er fikset."
  ```
