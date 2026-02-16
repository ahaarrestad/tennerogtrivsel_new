# Gemini CLI Agent Instructions

This document outlines the operational guidelines and expectations for the Gemini CLI agent when interacting with this project. Adhering to these instructions ensures efficient, safe, and context-aware assistance.

## Core Principles

1.  **Adherence to Project Conventions:** Always prioritize and strictly adhere to existing project conventions (formatting, naming, architectural patterns, etc.). Analyze surrounding code, tests, and configuration files (`package.json`, `tsconfig.json`, `astro.config.mjs`, etc.) to understand established patterns before making any changes.
2.  **Tool and Library Verification:** Never assume the availability or appropriateness of a new library, framework, or tool. Verify its established usage within the project by checking imports, configuration files, or observing neighboring files.
3.  **Idiomatic Changes:** Ensure all modifications integrate naturally and idiomatically with the local context (imports, functions/classes, data structures).
4.  **Comments:** Add code comments sparingly, focusing on *why* complex logic exists, rather than *what* it does. Avoid conversational comments or describing changes within the code itself.
5.  **Proactive Fulfillment:** Fulfill requests thoroughly, including adding tests for new features or bug fixes where applicable. Consider all generated artifacts (especially tests) as permanent unless explicitly instructed otherwise.
6.  **Confirmation for Ambiguity/Expansion:** Do not take significant actions beyond the clear scope of a request without explicit confirmation. If a change is implied (e.g., a bug report), always ask for confirmation before implementing a fix.
7.  **Security and Safety:** Prioritize security best practices. Never introduce code that exposes sensitive information. Be mindful of critical commands and explain their impact before execution.

## Interaction Guidelines

*   **Conciseness:** Be concise and direct in communication.
*   **Minimal Output:** Aim for minimal text output, focusing on actions and answers.
*   **Clarity:** Prioritize clarity, especially for explanations or clarifications.
*   **No Chitchat:** Avoid conversational filler.
*   **Tool Usage:** Utilize available tools (e.g., `read_file`, `grep_search`, `replace`, `run_shell_command`) effectively and efficiently. Prefer parallel execution for independent tasks.
*   **Git Workflow:** If instructed to commit changes, follow standard git practices: use `git status`, `git diff`, `git log` to prepare a draft commit message, and always await user confirmation for pushing.

## Project-Specific Technical Overview

This section details the technical stack, content management, and deployment processes specific to this project.

### 1. Frameworks and Core Technologies

*   **Primary Framework:** Astro (v5.17.2) - A modern static site builder.
*   **Styling:** Tailwind CSS (v4.1.18) is used for utility-first CSS styling, integrated via `@tailwindcss/vite`.
*   **Scripting:** Node.js (v20 for GitHub Actions) is used for build scripts and data synchronization.
*   **Other Key Dependencies:**
    *   `googleapis`: Used for interacting with Google APIs, specifically Google Sheets for content fetching.
    *   `dotenv`: For managing environment variables.
    *   `snarkdown`: A lightweight Markdown parser, likely used for rendering Markdown content dynamically.
    *   `@astrojs/sitemap`: Astro integration for sitemap generation.

### 2. Content Management and Property Fetching

This project uses a hybrid approach for content and configuration management:

*   **Astro Content Collections (Markdown):**
    *   **`tjenester` (Services):** Content for services is stored as Markdown files in `src/content/tjenester/`. These files define `id`, `title`, and `ingress` in their frontmatter.
    *   **`meldinger` (Messages):** Dynamic messages are stored as Markdown files in `src/content/meldinger/`. Their frontmatter includes `title`, `startDate`, and `endDate`.
    *   These content collections are defined and managed through `src/content.config.ts`.

*   **Google Sheets (for Site Settings/Properties):**
    *   Site-wide settings and properties (`innstillinger`) are primarily managed in a Google Sheet.
    *   `src/content.config.ts` includes a `loader` for the `innstillinger` collection that fetches data from a specified Google Sheet using the Google Sheets API (requiring `PUBLIC_GOOGLE_API_KEY` and `SHEET_ID`).
    *   `src/scripts/getSettings.ts` defines `HARD_DEFAULTS` for various site settings. These defaults are merged with the settings fetched from the Google Sheet, allowing the sheet to act as a remote configuration override.

*   **Astro API Endpoints:**
    *   Astro provides API routes (e.g., `src/pages/meldinger.json.ts`, `src/pages/api/active-messages.json.ts`) to expose content collections as JSON endpoints. These are used to fetch and serve dynamic data, such as messages, to the frontend.

*   **Data Synchronization (`src/scripts/sync-data.js`):**
    *   This script is crucial for synchronizing external content, including `tannleger` data from Google Sheets and Markdown content/image assets from Google Drive, writing them to `src/content/`.
    *   **Optimization:** It uses MD5 checksum validation to only download files that have actually changed on Google Drive, significantly reducing build times.
    *   It executes before `astro dev` and `astro build`. For enhanced testability, its core logic is encapsulated within a `runSync()` function and utilizes dependency injection/mocks for external services.

### 3. Deployment and CI/CD

Deployment is automated via GitHub Actions, configured in `.github/workflows/deploy.yml`.

*   **Workflow Trigger:** The deployment process is initiated by pushes to `main`, pull requests, or `repository_dispatch` from Google Drive updates.
*   **Optimization:** The CI/CD pipeline uses caching for Playwright browsers and the `.astro` build cache to minimize execution time. It utilizes `npm ci` for reliable dependency installation.
*   **Security Scanning (CodeQL):** Automated security analysis is performed via `.github/workflows/codeql.yml`.
    *   **Maintenance:** This workflow MUST be updated if the project structure changes (e.g., adding new directories that should be ignored) or if new programming languages are introduced to the codebase.
*   **Build Process:**
    *   The Astro site is built using `npm run build` (which includes the `sync-data.js` script).
    *   Google API related secrets (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`, `GOOGLE_DRIVE_TJENESTER_FOLDER_ID`, `GOOGLE_DRIVE_MELDINGER_FOLDER_ID`, `PUBLIC_GOOGLE_API_KEY`) are securely passed as environment variables during the build.
    *   **Note on Dependabot:** For Dependabot PRs to build successfully, these same secrets must also be added to **Dependabot secrets** (`Settings > Secrets and variables > Dependabot`) in the GitHub repository.

## Project-Specific Information (Original)

*   **Current Working Directory:** `/home/asbjorn/IdeaProjects/tennerogtrivsel2/`
*   **Operating System:** `linux`

### 4. Coding and Development Practices

To ensure high-quality, maintainable, and idiomatic code within this project, please adhere to the following guidelines:

*   **Atomic Commits:** Changes should be granular and focused. Each commit should address a single logical change, feature, or bug fix.
*   **Centralized Configuration:** All site-wide settings (titles, descriptions, contact info) MUST be managed via `src/scripts/getSettings.ts` and are overrideable via the `innstillinger` collection. Avoid hardcoding strings directly in layout or components. This data-driven approach is the preferred method for updates.
*   **Environment Variables:** All environment variables used in the project (both `PUBLIC_` and private) should be defined in `src/env.d.ts` to provide type safety and IntelliSense support in the IDE. Use `import.meta.env` for accessing these in Astro components and scripts within `src/`.
*   **CI Visibility:** Warnings about missing settings or sync errors are reported via GitHub Actions Annotations (`::warning::`). Developers should check the "Summary" tab of a build if any warnings are indicated.*   **Framework Best Practices (Tailwind 4):** Since this project uses Tailwind CSS v4, avoid using `@apply` on custom classes defined within the same CSS file, as this can cause build failures in CI. Prefer standard Tailwind utility classes or global design tokens defined in `@theme`.
*   **Component Architecture:**
    *   **Base Components:** Use shared base components (e.g., `src/components/Button.astro`) for consistent styling and behavior. Avoid creating specialized components that replicate base logic.
    *   **UI Animations:** Prefer a declarative approach for UI states. Use `data-state` attributes (e.g., `data-state="open"`) and CSS transitions in `global.css` instead of manipulating `element.style` directly in JavaScript.
*   **Code Structure and Readability:**
    *   Maintain consistent code formatting.
    *   Use **English** keys for all content schemas (e.g., `title`, `description`) to ensure framework compatibility, even if content is Norwegian.
    *   Break down complex logic into smaller, testable units. Move complex Browser/DOM logic to testable helper scripts where possible.
    *   **Unit/Integration (Vitest):** Tests logic, API endpoints, and content loaders. Located in `__tests__` subdirectories. Run with `npm test`.
    *   **Krav til testdekning:** Prosjektet skal til enhver tid ha minst **80% branch coverage** på all kjerne-logikk (scripts og API-endepunkter). Dekning SKAL sjekkes med `npm test` før hver commit.
    *   **End-to-End (Playwright):** Verifies the full user experience in real browsers. Located in `tests/`. Run with `npm run test:e2e`.
    *   **Obligatorisk integrasjonstest:** Alle nye moduler eller kritiske UI-endringer **SKAL** ha en dedikert E2E-test som verifiserer "happy path" (lasting og grunnleggende bruk) før oppgaven kan markeres som OK. Dette er for å fange opp feil som manglende importer eller rekursjonsløkker i det ferdig pakkede Astro-miljøet.
    *   **Specific E2E Categories:**
        *   **Accessibility (UU):** Automated WCAG compliance scans using `axe-core`.
        *   **SEO:** Verification of sidetitles, meta descriptions, and OpenGraph tags.
        *   **Link Crawler:** Automatic detection of broken internal and external links.
    *   Tests are integrated into the CI/CD pipeline and MUST pass before deployment. Environment variables must be provisioned for all test steps.

## Veikart: Tannleger Admin-modul

Dette veikartet beskriver implementeringen av tannlege-administrasjon. Planen er persistert her for å sikre kontinuitet på tvers av sesjoner.

### Fase 1: Datagrunnlag og Defaults (Sync)
- [ ] Utvide `sync-data.js` til å lese kolonner A-H i Sheets (Navn, Tittel, Beskrivelse, Bilde, Aktiv, Skala, X, Y).
- [ ] Implementere kodesikre defaults: Skala = 1.0 (0.5-2.0), X/Y = 50.
- [ ] Oppdatere `Tannleger.astro` til å bruke `object-position` og `transform: scale` basert på disse verdiene.

### Fase 2: Admin API (Sheets CRUD)
- [ ] Lage `getTannlegerRaw()` i `admin-client.js` for å hente alle rader.
- [ ] Lage `updateTannlegeRow(index, data)` for debounced auto-save.
- [ ] Lage funksjoner for å legge til/slette rader.

### Fase 3: UI med Live Preview
- [x] Implementere `loadTannlegerModule` med alfabetisk sortering.
- [x] Bygge editor-grensesnitt med Live Preview (gjenbruk av `Card.astro` logikk).
- [x] Implementere slidere for Zoom (0.5-2.0) og Posisjon (0-100%).
- [x] Legge til auto-save funksjonalitet på alle felter.
- [x] Sikre 80% branch coverage for den nye logikken.

### Fase 4: Bildehåndtering (NESTE STEG)
- [ ] Implementere bildevelger som lister filer fra Drive.
- [ ] Implementere bildeopplasting til Drive-mappen for tannleger.

### 5. Admin Panel (Phase 1)

The project includes a browser-based admin panel at `/admin` for content management. It uses Google OAuth 2.0 for authentication and relies on Google Drive permissions for access control.

*   **Setup Requirements:**
    1.  Create an **OAuth 2.0 Client ID** in [Google Cloud Console](https://console.cloud.google.com/).
    2.  Add `http://localhost:4321` (dev) and your production URL to **Authorized JavaScript origins**.
    3.  Set the generated Client ID as `PUBLIC_GOOGLE_CLIENT_ID` in your `.env` and GitHub Secrets.
    4.  Ensure `PUBLIC_GOOGLE_DRIVE_TJENESTER_FOLDER_ID` and other folder IDs are set correctly.
*   **Access Control:** Access is automatically granted to any user who has at least "Reader" access to the Google Drive folder specified in the configuration. If a user logs in but lacks access, an "Ingen tilgang" message is shown.
*   **Session Persistence:** To improve user experience, the admin panel stores the Google OAuth access token in the browser's `localStorage` (`admin_google_token`). This allows the user to remain logged in across page refreshes until the token expires (typically 1 hour) or they manually log out.
*   **Security:** The admin panel runs entirely in the user's browser using their own credentials. No sensitive server-side keys are exposed to the frontend.