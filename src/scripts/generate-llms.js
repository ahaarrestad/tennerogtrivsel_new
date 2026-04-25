// src/scripts/generate-llms.js

function buildHeader(settings) {
    const hours = ['businessHours1', 'businessHours2', 'businessHours3', 'businessHours4', 'businessHours5']
        .map(k => settings[k])
        .filter(Boolean)
        .map(h => `- ${h}`)
        .join('\n');

    return `# Tenner og Trivsel

> ${settings.siteDescription || ''}

Adresse: ${settings.adresse1 || ''}, ${settings.adresse2 || ''}
Telefon: ${settings.phone1 || ''}
Åpningstider:
${hours}`;
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

function buildPrislisteFull(prisliste) {
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

    return `\n\n## Prisliste\n\n${sections}`;
}

function buildFooter(includeFull) {
    const links = [
        '- [Tjenester](/tjenester)',
        '- [Prisliste](/prisliste)',
        '- [Kontakt](/kontakt)',
    ];
    if (includeFull) links.push('- [Fullstendig innhold](/llms-full.txt)');
    return `\n\n## Mer informasjon\n${links.join('\n')}`;
}

export function generateLlmsTxt({ settings = {}, tannleger = [], tjenester = [] } = {}) {
    return [
        buildHeader(settings),
        buildTjenesterShort(tjenester),
        buildTannleger(tannleger),
        buildFooter(true),
    ].join('').trim();
}

export function generateLlmsFullTxt({ settings = {}, tannleger = [], tjenester = [], prisliste = {} } = {}) {
    return [
        buildHeader(settings),
        buildTjenesterFull(tjenester),
        buildTannleger(tannleger),
        buildPrislisteFull(prisliste),
        buildFooter(false),
    ].join('').trim();
}
