---
name: deps
description: "Analyze project dependencies for size, security, unused packages, and misplaced devDependencies. Use when the user says 'deps', 'dependencies', 'avhengigheter', 'dependency check', 'sjekk avhengigheter', 'npm audit', 'package size', 'bundle size', or asks about reducing node_modules size or cleaning up packages."
disable-model-invocation: false
allowed-tools: ["Read", "Glob", "Grep", "Bash(npm *)", "Bash(du *)", "Bash(node *)"]
---

# Dependency Audit Skill

Analyze dependencies in this Astro project for bloat, security issues, misplacement, and optimization opportunities.

## Context

This project has known dependency issues documented in TODO.md:
- `googleapis` is ~196 MB but only `sheets` and `drive` are used
- `dotenv` may be replaceable with built-in `.env` support
- `@types/dompurify` is in `dependencies` instead of `devDependencies`
- `sharp` is used in `sync-data.js` but not in `package.json`

## Audit Process

### 1. Size Analysis

Measure the overall footprint:

```bash
du -sh node_modules 2>/dev/null
```

Find the largest packages:

```bash
du -sh node_modules/*/ 2>/dev/null | sort -rh | head -20
```

Read `package.json` to understand declared dependencies vs devDependencies.

### 2. Usage Analysis

For each dependency in `package.json`, check if it's actually imported:

```
Grep for: import/require of each package name across src/, tests/, scripts/
```

Flag packages that:
- Are declared but never imported (dead dependencies)
- Are in `dependencies` but only used in tests or build scripts (should be `devDependencies`)
- Are in `devDependencies` but imported in production code (should be `dependencies`)

For this static Astro site, remember:
- **Build-time only**: `sync-data.js`, `astro.config.mjs` — packages used here can be `devDependencies`
- **Client-side runtime**: `src/scripts/` — packages bundled into the browser need to be in `dependencies`
- **Types packages** (`@types/*`) should always be `devDependencies`

### 3. Security Audit

```bash
npm audit 2>&1
```

Categorize findings by severity (critical, high, moderate, low). For each vulnerability, note whether it affects production code or only dev/build tooling.

### 4. Replacement Opportunities

For oversized packages, suggest lighter alternatives:

| Current | Issue | Alternative |
|---------|-------|-------------|
| `googleapis` (full SDK) | ~196 MB, only sheets+drive used | `@googleapis/sheets` + `@googleapis/drive` |
| `dotenv` | Node 20+ has built-in `.env` support | Remove, use `--env-file` flag or Astro's built-in `.env` loading |

For each suggestion, assess:
- **Migration effort**: How many files would change?
- **API compatibility**: Are the APIs similar enough for a smooth transition?
- **Risk**: Could the switch break anything?

### 5. Missing Dependencies

Check for packages that are `require`d or `import`ed but not in `package.json`:

```bash
node -e "
const pkg = require('./package.json');
const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
console.log('Declared:', declared.size, 'packages');
"
```

Cross-reference with actual imports in source files. Flag any missing packages (like `sharp` in `sync-data.js`).

### 6. Outdated Packages

```bash
npm outdated 2>&1
```

Flag packages with major version bumps available, especially those with security implications.

### 7. Present Report

```
## Dependency Audit Report

### Størrelse (Size)
Total node_modules: X MB
Top 5 largest packages and their usage status.

### Sikkerhet (Security)
npm audit findings, categorized by severity.

### Feilplasserte (Misplaced)
Packages in wrong section (deps vs devDeps).

### Ubrukte (Unused)
Packages declared but not imported anywhere.

### Manglende (Missing)
Packages imported but not declared in package.json.

### Optimaliseringsforslag (Optimization)
| Handling | Forventet besparelse | Innsats | Risiko |
|----------|---------------------|---------|--------|
| ...      | X MB                | Lav/Medium/Høy | Lav/Medium/Høy |

### Anbefalte steg
Prioritized list of actions, ordered by impact-to-effort ratio.
```
