---
name: security-audit
description: "Scan the codebase for security vulnerabilities: XSS, injection, CSP issues, authentication flaws, exposed secrets, and unsafe data handling. Use when the user says 'security audit', 'sikkerhetssjekk', 'security check', 'sjekk sikkerhet', 'scan for vulnerabilities', 'XSS check', or asks about the security posture of the project. Also trigger when reviewing admin panel code or authentication flows."
disable-model-invocation: false
allowed-tools: ["Read", "Glob", "Grep", "Bash(npm audit:*)", "Bash(git log:*)", "Bash(git diff:*)"]
---

# Security Audit Skill

Perform a structured security review of this Astro + Google OAuth project. The site is a dental clinic with a public frontend and a protected admin panel that integrates with Google Sheets and Google Drive.

## Architecture Context

- **Frontend**: Static Astro site on AWS S3 + CloudFront (no server runtime in production)
- **Admin panel**: Client-side SPA at `/admin/` using Google OAuth (gapi + GIS)
- **Data**: Google Sheets as CMS, Google Drive for images
- **Middleware**: `src/middleware.ts` sets security headers (CSP, etc.) — only active in dev/SSR, NOT in S3 production
- **Sanitization**: DOMPurify for all innerHTML with user/CMS content
- **Build pipeline**: `sync-data.js` fetches data from Google Sheets/Drive at build time

## Audit Process

### 1. Determine Scope

Ask the user what to audit. Options:
- **Full audit**: Everything below
- **Admin panel**: Authentication, data handling, API interactions
- **Public site**: CSP, content injection, client-side security
- **Build pipeline**: sync-data.js, environment variables, secrets
- **Specific file/component**: Targeted review

### 2. Check for Exposed Secrets

Search for accidentally committed secrets:

```
Grep for patterns:
- API keys, tokens, passwords in source files
- .env files that shouldn't be committed
- Hardcoded credentials
- Google API keys in client-side code (check if restricted properly)
```

Files to check:
- `.env`, `.env.*` — should be in `.gitignore`
- `src/env.d.ts` — should only have type declarations, not values
- `sync-data.js` — uses env vars for Google API access
- `src/pages/admin/index.astro` — contains Google OAuth client ID (this is expected and OK for client-side OAuth)

### 3. XSS and Injection

Review all places where dynamic content is rendered:

#### innerHTML Usage
Every `innerHTML` assignment with user/CMS content must use DOMPurify:
```
Grep for: innerHTML
Check: Is DOMPurify.sanitize() wrapping the content?
```

The project convention (from CLAUDE.md): DOMPurify strips inline event handlers, so all event listeners must be attached programmatically after setting innerHTML.

#### Template Injection
In `.astro` files, check for unescaped expressions:
- `set:html` directive — must use sanitized content
- Dynamic `class` or `style` attributes from user input

#### URL Injection
Check for `javascript:` URLs in href attributes, especially from CMS content.

### 4. Content Security Policy (CSP)

Read `src/middleware.ts` and verify the CSP directives:

- `script-src`: Should not include `unsafe-inline` or `unsafe-eval` (except where strictly necessary with nonces)
- `style-src`: Tailwind may need `unsafe-inline` for utility classes
- `connect-src`: Should include `blob:` (for admin thumbnails) and necessary Google API domains
- `img-src`: Should allow Google Drive image domains
- `frame-ancestors`: Should be `'none'` or `'self'`

**Important**: CSP in middleware only applies in dev and SSR. For production (S3), these headers must be configured in CloudFront Response Headers Policy. Flag if they differ.

Run CSP verification if dev server is available:
```bash
npx playwright test csp-check --project=chromium 2>&1
```

### 5. Authentication & Authorization

Review the admin panel authentication flow:

- **Google OAuth**: Check token handling, storage, expiry
- **Token storage**: Is `tokenClient` properly scoped? Are tokens stored in sessionStorage (preferred) vs localStorage?
- **Session management**: What happens on token expiry? Is there silent re-auth?
- **Access control**: Who can access the admin panel? Is the Google API client restricted to authorized emails?
- **CORS**: Are Google API calls properly scoped to necessary APIs only?

### 6. Dependency Security

```bash
npm audit 2>&1
```

Check for:
- Known vulnerabilities in dependencies
- Outdated packages with security patches
- Unnecessary dependencies that increase attack surface

### 7. Build Pipeline Security

Review `sync-data.js`:
- Are Google API credentials properly handled?
- Could a malicious Sheets response inject content that survives the build?
- Are downloaded images validated/sanitized?
- Is the build process deterministic and reproducible?

### 8. HTTP Security Headers

Check for these headers (in middleware and/or CloudFront config):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` or `SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone, geolocation should be denied)
- `Strict-Transport-Security` (HSTS)

### 9. Present Findings

Organize by severity using a standard classification:

```
## Security Audit Report

### Kritisk (Critical)
Issues that could lead to data breach, unauthorized access, or code execution.
Require immediate fix.

### Høy (High)
Issues with significant security impact but requiring specific conditions to exploit.

### Medium
Defense-in-depth gaps. Not directly exploitable but weaken security posture.

### Lav (Low)
Minor issues, best-practice deviations, informational findings.

### Bestått (Passed)
Areas that were checked and found to be secure — reinforce good practices.
```

For each finding:
- **What**: Clear description of the vulnerability
- **Where**: File path and line number
- **Risk**: What could an attacker achieve?
- **Fix**: Specific remediation with code example
- **Priority**: How urgently this should be addressed
