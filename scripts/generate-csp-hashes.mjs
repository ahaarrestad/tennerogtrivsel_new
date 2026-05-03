import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function extractInlineScripts(html) {
    const results = [];
    const regex = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        const content = match[1];
        if (content.trim()) results.push(content);
    }
    return results;
}

export function computeHash(content) {
    return 'sha256-' + createHash('sha256').update(content).digest('base64');
}

function walkHtmlFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            files.push(...walkHtmlFiles(full));
        } else if (entry.endsWith('.html')) {
            files.push(full);
        }
    }
    return files;
}

// Bare kjør hvis dette er entry-point (ikke ved import i tester)
if (import.meta.url === `file://${process.argv[1]}`) {
    const distDir = join(__dirname, '../dist');
    const outputFile = join(__dirname, '../src/generated/csp-hashes.json');

    const htmlFiles = walkHtmlFiles(distDir);
    const allContents = htmlFiles.flatMap(f =>
        extractInlineScripts(readFileSync(f, 'utf-8'))
    );
    const uniqueHashes = [...new Set(allContents.map(computeHash))];

    writeFileSync(outputFile, JSON.stringify({ scriptHashes: uniqueHashes }, null, 2) + '\n');
    console.log(`Wrote ${uniqueHashes.length} hash(es) to src/generated/csp-hashes.json`);
    uniqueHashes.forEach(h => console.log(`  ${h}`));
}
