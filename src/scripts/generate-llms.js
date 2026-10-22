// src/scripts/generate-llms.js

/**
 * @typedef {Record<string, string>} Settings
 * @typedef {{ name: string, title: string, description?: string }} Tannlege
 * @typedef {{ title: string, ingress: string, body?: string }} Tjeneste
 * @typedef {{ kategori: string, behandling: string, pris: string | number, order?: number }} PrisRad
 * @typedef {{ sistOppdatert?: string, kategoriOrder?: Array<{ kategori: string, order: number }>, items?: PrisRad[] }} Prisliste
 */

/** Lenke som er absolutt når siteUrl er kjent, ellers rot-relativ. */
function lenke(sti, siteUrl) {
    return siteUrl ? new URL(sti, siteUrl).href : sti;
}

/** «januar 2026», eller '' for manglende/ugyldig dato. */
function formatMaaned(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric', timeZone: 'Europe/Oslo' });
}

function buildHeader(settings) {
    const hours = ['businessHours1', 'businessHours2', 'businessHours3', 'businessHours4', 'businessHours5']
        .map(k => settings[k])
        .filter(Boolean)
        .map(h => `- ${h}`)
        .join('\n');

    return `# Tenner og Trivsel

> ${settings.siteDescription || ''}

Adresse: ${settings.adresse1 || ''}, ${settings.adresse2 || ''}
Telefon: ${settings.phone1 || ''}${timebestilling(settings.phone1)}
Åpningstider:
${hours}`;
}

// Klinikken vil at pasienter ringer — ingen nettbestilling.
function timebestilling(phone) {
    if (!phone) return '';
    return `\nTimebestilling: ring oss på ${phone}. Vi har ikke nettbestilling, fordi vi vil snakke med deg for å finne riktig time og behandling.`;
}

function buildTjenesterShort(tjenester) {
    if (!tjenester.length) return '';
    const lines = tjenester.map(t => `- ${t.title}: ${t.ingress}`).join('\n');
    return `\n\n## Tjenester\n${lines}`;
}

function buildTjenesterFull(tjenester) {
    if (!tjenester.length) return '';
    const sections = tjenester.map(t => {
        let entry = `### ${t.title}\n${t.ingress}`;
        if (t.body && t.body.trim()) entry += `\n\n${t.body.trim()}`;
        return entry;
    }).join('\n\n');
    return `\n\n## Tjenester\n\n${sections}`;
}

function buildTannleger(tannleger) {
    if (!tannleger.length) return '';
    const lines = tannleger.map(t => {
        const base = `- ${t.name} (${t.title})`;
        return t.description ? `${base}: ${t.description}` : base;
    }).join('\n');
    return `\n\n## Tannleger\n${lines}`;
}

function buildPrislisteFull(prisliste, siteUrl) {
    if (!prisliste?.items?.length) return '';

    const { kategoriOrder = [], items } = prisliste;

    const grouped = {};
    for (const item of items) {
        if (item.pris == null || item.pris === '') continue;
        if (!grouped[item.kategori]) grouped[item.kategori] = [];
        grouped[item.kategori].push(item);
    }

    const kategorier = Object.keys(grouped).sort((a, b) => {
        const orderA = kategoriOrder.find(k => k.kategori === a)?.order ?? 99;
        const orderB = kategoriOrder.find(k => k.kategori === b)?.order ?? 99;
        return orderA - orderB;
    });

    if (!kategorier.length) return '';

    const sections = kategorier.map(kategori => {
        const lines = grouped[kategori]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map(item => `- ${item.behandling}: ${item.pris} kr`)
            .join('\n');
        return `### ${kategori}\n${lines}`;
    }).join('\n\n');

    const dato = formatMaaned(prisliste.sistOppdatert);
    const intro = [
        dato && `Sist oppdatert: ${dato}`,
        'Prisene er veiledende og kan variere etter behandlingens omfang.',
        `Gjeldende priser: ${lenke('/prisliste/', siteUrl)}`,
    ].filter(Boolean).join('\n');

    return `\n\n## Prisliste\n\n${intro}\n\n${sections}`;
}

function buildFooter(includeFull, siteUrl, prislisteDato = '') {
    const prisDato = formatMaaned(prislisteDato);
    const links = [
        `- [Tjenester](${lenke('/tjenester/', siteUrl)})`,
        `- [Prisliste](${lenke('/prisliste/', siteUrl)})${prisDato ? `: sist oppdatert ${prisDato}` : ''}`,
        `- [Kontakt](${lenke('/kontakt/', siteUrl)})`,
    ];
    if (includeFull) links.push(`- [Fullstendig innhold](${lenke('/llms-full.txt', siteUrl)})`);
    return `\n\n## Mer informasjon\n${links.join('\n')}`;
}

/**
 * @param {{ settings?: Settings, tannleger?: Tannlege[], tjenester?: Tjeneste[], siteUrl?: string, prislisteDato?: string }} [opts]
 */
export function generateLlmsTxt({ settings = {}, tannleger = [], tjenester = [], siteUrl = '', prislisteDato = '' } = {}) {
    return [
        buildHeader(settings),
        buildTjenesterShort(tjenester),
        buildTannleger(tannleger),
        buildFooter(true, siteUrl, prislisteDato),
    ].join('').trim();
}

/**
 * @param {{ settings?: Settings, tannleger?: Tannlege[], tjenester?: Tjeneste[], prisliste?: Prisliste, siteUrl?: string }} [opts]
 */
export function generateLlmsFullTxt({ settings = {}, tannleger = [], tjenester = [], prisliste = {}, siteUrl = '' } = {}) {
    return [
        buildHeader(settings),
        buildTjenesterFull(tjenester),
        buildTannleger(tannleger),
        buildPrislisteFull(prisliste, siteUrl),
        buildFooter(false, siteUrl),
    ].join('').trim();
}
