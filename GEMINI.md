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
    *   It executes before `astro dev` and `astro build`. For enhanced testability, its core logic is now encapsulated within an `export async function runSync({ ... })` and utilizes dependency injection for external services like `googleapis`, `fs`, and `path`.

### 3. Deployment

Deployment is automated via GitHub Actions, configured in `.github/workflows/deploy.yml`.

*   **Workflow Trigger:** The deployment process is initiated by:
    *   Pushes to the `main` branch.
    *   Pull requests to `main` (for build checks only, not deployment).
    *   `repository_dispatch` event with type `google_drive_update` (suggesting integration with external Google Drive changes).
    *   Manual `workflow_dispatch`.

*   **Build Process (GitHub Actions `build` job):**
    *   The Astro site is built using `npm run build` (which includes the `sync-data.js` script).
    *   Google API related secrets (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`, `GOOGLE_DRIVE_TJENESTER_FOLDER_ID`, `GOOGLE_DRIVE_MELDINGER_FOLDER_ID`, `PUBLIC_GOOGLE_API_KEY`) are securely passed as environment variables during the build.
    *   The generated static assets are output to the `dist/` directory and uploaded as a build artifact.

*   **Deployment Process (GitHub Actions `deploy` job):**
    *   This job runs only for actual deployments (pushes to `main`, `google_drive_update`, manual trigger).
    *   It downloads the `dist/` build artifact.
    *   **AWS S3 Deployment:** The built site is deployed to an AWS S3 bucket (`s3://test2.aarrestad.com`) using `aws s3 sync`. AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `aws-region: eu-west-1`) are configured via GitHub secrets.
    *   CloudFront cache invalidation is present but currently commented out in the workflow.

## Project-Specific Information (Original)

*   **Current Working Directory:** `/home/asbjorn/IdeaProjects/tennerogtrivsel2/`
*   **Operating System:** `linux`
*   **Temporary Directory:** `/home/asbjorn/.gemini/tmp/eb92de5597d0ec9fbb0ef2b47f951157c048944e30ce79644e00a2cb6304cb5b`
*   **Project Structure:** (Refer to the initial folder structure provided at the start of the chat for current context.)

### 4. Coding and Development Practices

To ensure high-quality, maintainable, and idiomatic code within this project, please adhere to the following guidelines:

*   **Atomic Commits:** Changes should be granular and focused. Each commit should address a single logical change, feature, or bug fix. This promotes clear history, easier reverts, and better code review.
*   **Centralized Configuration:** Where possible, configuration values should be centralized. Components and modules should consume configuration from a single, well-defined source (e.g., a shared settings object, a configuration file, or environment variables). This allows for easier updates and consistent behavior across the application.
*   **Framework Best Practices:** Always strive to follow the "best practices" and idiomatic patterns prescribed by Astro, Tailwind CSS, and other utilized frameworks and libraries. This ensures maintainability, takes advantage of framework optimizations, and keeps the codebase modern and aligned with community standards. Consult official documentation when in doubt.
*   **Code Structure and Readability:**
    *   Maintain consistent code formatting and style.
    *   Use clear and descriptive naming for variables, functions, and components.
    *   Break down complex logic into smaller, testable units.
*   **Testing (where applicable):** This project utilizes **Vitest** for unit and integration testing.
    *   Test files are organized into `__tests__` subdirectories alongside their respective source modules (e.g., `src/scripts/__tests__/my-script.test.ts`).
    *   Tests are integrated into the CI/CD pipeline (via `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`) and run automatically during build processes.
    *   When executed locally via `npm test`, Vitest runs all tests once and exits, providing a `--run` flag to prevent watch mode. Environment variables (e.g., `PUBLIC_GOOGLE_API_KEY`) are correctly provisioned for test steps in CI.

By following these instructions, the Gemini CLI agent will provide optimal assistance for this project.