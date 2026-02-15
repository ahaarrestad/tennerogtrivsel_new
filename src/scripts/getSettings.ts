// src/lib/getSettings.ts
import {getCollection} from 'astro:content';

export const HARD_DEFAULTS: Record<string, string> = {
    phone1: "51 52 96 18",
    phone2: "51 53 64 21",
    email: "resepsjon@tennerogtrivsel.no",
    showEmail: "nei",
    adresse1: "Armauer Hansens vei 11",
    adresse2: "4011 Stavanger",
    velkomstTittel1: "Tannhelse i",
    velkomstTittel2: "trygge rammer",
    sentralbordTekst: "Sentralbordet er åpent 07:45 - 15:15 (Stengt 11:15 - 12:15)",
    latitude: "58.95426193582862",
    longitude: "5.734568467856621",
    siteTitle: "Tenner og Trivsel | Din Tannlege i Stavanger",
    siteDescription: "Tenner og Trivsel tilbyr moderne tannbehandling i trygge rammer like ved Stavanger Universitetssykehus. Vi har fokus på din komfort og tannhelse.",
    velkomstTekst: "Velkommen til Tenner og Trivsel. Vi tilbyr moderne behandling med fokus på din komfort.",
    kontaktTekst: "Vi holder til like ved Stavanger Universitetssykehus på Våland og har gratis parkering rett ufenfor kontoret. I tillegg er det 2 timer gratis parkering i Folke Bernadottes vei og Overlege Cappelens gate.",
    tannlegerTekst: "Et varmt og erfarent team som setter pasienten i sentrum og tilbyr skreddersydd behandling.",
    tjenesteTekst: "Vi tilbyr et bredt spekter av tannhelsetjenester for å sikre din munnhelse og velvære.",
    businessHours1: "Mandag, Tordag, Fredag: 08:00 - 15:30",
    businessHours2: "Tirsdag, Onsdag: 08:00 - 20:00"
};

export async function getSiteSettings() {
    try {
        const entries = await getCollection('innstillinger');
        const collectionEntries = Object.fromEntries(entries.map(entry => [entry.id, entry.data.value]));

        const defaultKeys = Object.keys(HARD_DEFAULTS);
        const sheetKeys = Object.keys(collectionEntries);

        // 1. Sjekk for nøkler i Sheets som ikke finnes i defaults (ukjente innstillinger)
        sheetKeys.forEach(key => {
            if (!HARD_DEFAULTS.hasOwnProperty(key)) {
                const msg = `[Settings] ⚠️ Ukjent nøkkel funnet i Google Sheets: "${key}". Denne blir ignorert av systemet.`;
                if (process.env.GITHUB_ACTIONS) {
                    console.log(`::warning title=Google Sheets Error::${msg}`);
                } else {
                    console.warn(msg);
                }
            }
        });

        // 2. Sjekk for defaults som IKKE overstyres (bruker fallback)
        defaultKeys.forEach(key => {
            if (!collectionEntries.hasOwnProperty(key)) {
                const msg = `[Settings] ℹ️ Bruker hardkodet standardverdi for "${key}" (mangler i Google Sheets).`;
                // Vi logger dette som info lokalt, men hopper over det som advarsel på GitHub for å unngå støy
                if (!process.env.GITHUB_ACTIONS) {
                    console.info(msg);
                }
            }
        });

        // Slå sammen hardkodede defaults med de fra innstillinger-collection
        return {
            ...HARD_DEFAULTS,
            ...collectionEntries
        };

    } catch (error) {
        console.error("Henting av innstillinger feilet: ", error);
        return HARD_DEFAULTS;
    }
}