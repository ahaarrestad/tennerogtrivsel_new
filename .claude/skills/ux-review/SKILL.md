---
name: ux-review
description: "Review a page or component for UX quality, accessibility, responsive design, and visual hierarchy. Use when the user says 'ux review', 'ux-gjennomgang', 'review design', 'sjekk UX', 'tilgjengelighet', 'a11y review', 'responsiv sjekk', or asks about the quality of a page's user experience. Also use when making visual or layout changes and you want to verify the result."
disable-model-invocation: false
allowed-tools: ["Read", "Glob", "Grep", "Bash(npx playwright:*)", "Bash(npx axe:*)", "Bash(npm run build:*)"]
---

# UX Review Skill

Perform a structured UX review of one or more pages/components in this Astro + Tailwind CSS v4 project. The site is a dental clinic website (Tenner og Trivsel) targeting patients of all ages — clarity, trust, and accessibility are paramount.

## Context

- **Stack**: Astro 5 (static), Tailwind CSS v4, deployed to AWS S3 + CloudFront
- **Audience**: Dental patients (broad age range, varying tech literacy)
- **Design system**: Uses `variant` prop for section backgrounds (brand/white alternating pattern on frontpage)
- **Components**: SectionHeader, Card, Button, Navbar, Footer, Kontakt, Galleri, Tjenester, Tannleger, Forside

## Review Process

### 1. Identify Scope

Ask the user which page(s) or component(s) to review. If not specified, review the page they're currently working on. For a full-site review, go through each page systematically.

### 2. Read the Code

Read the relevant `.astro` files, layout, and any CSS/Tailwind classes. Understand the current structure before suggesting changes.

### 3. Evaluate Against Checklist

For each page/component, assess these areas:

#### Visual Hierarchy & Layout
- Is there a clear reading order? (headings, subheadings, body text)
- Does spacing create logical groupings? (Tailwind spacing: `gap-*`, `space-y-*`, `p-*`)
- Are CTAs (calls to action) prominent and easy to find?
- Is the visual weight balanced across the page?

#### Typography & Readability
- Are font sizes appropriate? (minimum 16px body text for accessibility)
- Is line length comfortable? (45-75 characters per line is ideal)
- Is there sufficient contrast between text and background? (WCAG AA: 4.5:1 for normal text)
- Are headings hierarchical? (`h1` → `h2` → `h3`, no skipped levels)

#### Responsive Design (Mobile-First)
- Does the layout work on small screens (320px)?
- Are touch targets large enough? (minimum 44x44px)
- Is horizontal scrolling avoided?
- Do images scale properly? (check `object-fit`, `aspect-ratio`)
- Is the navigation usable on mobile? (hamburger menu, full-width links)

#### Accessibility (a11y)
- Are all images accessible? (`alt` text on informative images, `aria-hidden` on decorative)
- Is keyboard navigation logical? (tab order, focus indicators, skip links)
- Are form inputs labeled? (`<label>` with `for`/`id`)
- Are ARIA attributes used correctly? (`aria-expanded`, `aria-live`, `role`)
- Is color alone used to convey information? (never — always pair with text/icons)

#### Interaction & Feedback
- Do interactive elements have hover/focus states?
- Is loading state communicated? (spinners, skeleton screens)
- Are error states clear and helpful?
- Do buttons and links look distinct from each other?

#### Consistency
- Are similar elements styled consistently across pages?
- Does the page follow the variant pattern? (brand/white on frontpage, always white on standalone pages)
- Are spacing, colors, and typography consistent with the rest of the site?

### 4. Run Automated Checks (Optional)

If the dev server is running, use Playwright to run basic accessibility checks:

```bash
npx playwright test accessibility --project=chromium 2>&1
```

### 5. Present Findings

Organize findings by severity:

```
## UX Review: [Page/Component Name]

### Kritisk (må fikses)
Issues that significantly impact usability or accessibility.

### Forbedring (bør fikses)
Issues that hurt the experience but aren't blocking.

### Forslag (vurder)
Nice-to-have improvements and polish.

### Bra allerede
Things that are working well — reinforce good patterns.
```

For each issue, include:
- **What**: Clear description of the problem
- **Where**: File path and line number
- **Why**: Impact on users
- **How**: Concrete suggestion with Tailwind classes or code snippets

### 6. Prioritize

End with a prioritized action list (max 5-7 items) the user can tackle, ordered by impact-to-effort ratio.
