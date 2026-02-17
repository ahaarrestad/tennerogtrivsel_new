import { test, expect } from '@playwright/test';

// Midlertidig test – kjøres manuelt med: npx playwright test csp-check --project=chromium
// Fanger alle CSP-feil på tvers av nøkkelsider.

const PAGES = ['/', '/admin', '/kontakt'];

for (const path of PAGES) {
    test(`CSP-sjekk: ${path}`, async ({ page }) => {
        const violations: string[] = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                if (
                    text.includes('Content Security Policy') ||
                    text.includes('violates') ||
                    text.includes('Refused to')
                ) {
                    violations.push(text);
                }
            }
        });

        page.on('pageerror', err => {
            violations.push('JS ERROR: ' + err.message);
        });

        await page.goto(path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // Gi tid til async Google-scripts

        if (violations.length > 0) {
            console.log(`\n⚠️  CSP-feil på ${path}:`);
            violations.forEach(v => console.log('  •', v));
        }

        // Test feiler og printer alle funn
        expect(violations, `CSP-feil på ${path}`).toEqual([]);
    });
}
