// src/lib/getSettings.ts
import {getCollection} from 'astro:content';

export const HARD_DEFAULTS: Record<string, string> = {
    phone1: "51 52 96 18",
    adresse1: "Gartnerveien 15",
    adresse2: "4016 Stavanger",
    velkomstTittel1: "Tannhelse i",
    velkomstTittel2: "trygge rammer",
    sentralbordTekst: "Sentralbordet er åpent 07:45 - 15:15 (Stengt 11:15 - 12:15)",
    latitude: "58.94826272363705",
    longitude: "5.738691380986355",
    siteTitle: "Tenner og Trivsel | Din Tannlege i Stavanger",
    siteDescription: "Tenner og Trivsel tilbyr moderne tannbehandling i trygge rammer i Kilden Helsedel. Vi har fokus på din komfort og tannhelse.",
    velkomstTekst: "Velkommen til Tenner og Trivsel. Vi tilbyr tannbehandling av høy kvalitet med fokus på din trygghet og komfort.",
    kontaktTekst: "Vi holder til i 5. etasje på Kilden Helse. Det er mest praktisk å benytte parkering P4, hvor det er 1 time gratis kundeparkering. Derfra tar du heisen én etasje opp, og du finner oss innover i gangen til venstre.",
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
    galleriBeskrivelse: "Se bilder fra Tenner og Trivsel tannklinikk i Stavanger. Moderne lokaler i Kilden Helse.",
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