/**
 * Endringsdatoer for tjenestesidene, fra `_endret.json` som sync-data skriver
 * (Drive `modifiedTime` per .md-fil).
 *
 * Brukes både av tjenestesidene (`dateModified`) og av sitemapen i `astro.config.mjs`
 * (`lastmod`). Ingen funksjon her kaster: manglende data gir bare ingen dato.
 * En exception i sitemapens `serialize` ville fjernet hele sitemapen uten at bygget feiler.
 */
import fs from 'fs';
import path from 'path';
import { slugify } from './slugify';

const ENDRET_FIL = '_endret.json';

/** Filnavn → ISO-dato. Ugyldige oppføringer filtreres bort. */
export function lesEndret(dir: string): Record<string, string> {
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(path.join(dir, ENDRET_FIL), 'utf-8'));
    } catch {
        return {};
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

    return Object.fromEntries(
        Object.entries(data).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string' && !Number.isNaN(Date.parse(entry[1]))
        )
    );
}

/**
 * Leser `key: value`-linjene i frontmatter, i samme enkle format som admin skriver
 * (`stringifyMarkdown`). En uvanlig tittel som Astros YAML-parser tolker annerledes
 * gir bare manglende lastmod for den siden.
 */
function lesFrontmatter(innhold: string): Record<string, string> {
    const match = innhold.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    const data: Record<string, string> = {};
    for (const linje of match[1].split(/\r?\n/)) {
        const kolon = linje.indexOf(':');
        if (kolon === -1) continue;
        const verdi = linje.slice(kolon + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
        data[linje.slice(0, kolon).trim()] = verdi;
    }
    return data;
}

/** URL-sti (`/tjenester/<slug>/`) → ISO-dato for aktive tjenester, pluss `/tjenester/` = nyeste. */
export function tjenesteLastmod(dir: string): Map<string, string> {
    const lastmod = new Map<string, string>();
    try {
        const endret = lesEndret(dir);
        if (Object.keys(endret).length === 0) return lastmod;

        let nyeste = '';
        for (const [filnavn, dato] of Object.entries(endret)) {
            if (!filnavn.endsWith('.md')) continue;
            let innhold: string;
            try {
                innhold = fs.readFileSync(path.join(dir, filnavn), 'utf-8');
            } catch {
                continue;
            }
            const { title, active } = lesFrontmatter(innhold);
            if (!title || active === 'false') continue;

            lastmod.set(`/tjenester/${slugify(title)}/`, dato);
            if (!nyeste || Date.parse(dato) > Date.parse(nyeste)) nyeste = dato;
        }
        if (nyeste) lastmod.set('/tjenester/', nyeste);
    } catch {
        return new Map();
    }
    return lastmod;
}
