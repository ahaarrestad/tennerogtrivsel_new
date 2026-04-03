// src/lib/getSettings.ts
import {getCollection} from 'astro:content';

export const HARD_DEFAULTS: Record<string, string> = {
    phone1: "51 52 96 18",
    adresse1: "Armauer Hansens vei 11",
    adresse2: "4011 Stavanger",
    velkomstTittel1: "Tannhelse i",
    velkomstTittel2: "trygge rammer",
    sentralbordTekst: "Sentralbordet er åpent 07:45 - 15:15 (Stengt 11:15 - 12:15)",
    latitude: "58.9542066049075",
    longitude: "5.734643569446439",
    siteTitle: "Tenner og Trivsel | Din Tannlege i Stavanger",
    siteDescription: "Tenner og Trivsel tilbyr moderne tannbehandling i trygge rammer like ved Stavanger Universitetssykehus. Vi har fokus på din komfort og tannhelse.",
    velkomstTekst: "Velkommen til Tenner og Trivsel. Vi tilbyr moderne behandling med fokus på din komfort.",
    kontaktTekst: "Vi holder til like ved Stavanger Universitetssykehus på Våland og har gratis parkering rett ufenfor kontoret. I tillegg er det 2 timer gratis parkering i Folke Bernadottes vei og Overlege Cappelens gate.",
    tannlegerTekst: "Et varmt og erfarent team som setter pasienten i sentrum og tilbyr skreddersydd behandling.",
    tjenesteTekst: "Vi tilbyr et bredt spekter av tannhelsetjenester for å sikre din munnhelse og velvære.",
    businessHours1: "Mandag: 08:00 - 15:30",
    businessHours2: "Tirsdag: 07:30 - 20:00",
    businessHours3: "Onsdag: 08:00 - 20:00",
    businessHours4: "Torsdag: 07:30 - 15:30",
    businessHours5: "Fredag: 07:30 - 15:30",
    galleriTekst: "Ta en titt på klinikken vår — vi ønsker deg velkommen til lyse og moderne lokaler.",
    kontaktTittel: "Kontakt oss",
    galleriTittel: "Klinikken",
    tjenesterTittel: "Våre Tjenester",
    tannlegerTittel: "Tannlegene",
    kontaktBeskrivelse: "Kontakt Tenner og Trivsel tannklinikk i Stavanger. Telefon, åpningstider og veibeskrivelse.",
    galleriBeskrivelse: "Se bilder fra Tenner og Trivsel tannklinikk i Stavanger. Moderne lokaler ved SUS.",
    tjenesterBeskrivelse: "Oversikt over tannhelsetjenester hos Tenner og Trivsel i Stavanger.",
    tannlegerBeskrivelse: "Møt tannlegene hos Tenner og Trivsel i Stavanger. Erfarne tannleger med bred kompetanse.",
};

export async function getSiteSettings() {
    try {
        const entries = await getCollection('innstillinger');
        const collectionEntries = Object.fromEntries(entries.map(entry => [entry.id, entry.data.value]));

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