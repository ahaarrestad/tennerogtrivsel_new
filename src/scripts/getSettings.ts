// src/lib/getSettings.ts
import {getCollection} from 'astro:content';

const HARD_DEFAULTS: Record<string, string> = {
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
    velkomstTekst: "Velkommen til Tenner og Trivsel. Vi tilbyr moderne behandling med fokus på din komfort.",
    kontaktTekst: "Vi holder til like ved Stavanger Universitetssykehus på Våland og har gratis parkering rett ufenfor kontoret. I tillegg er det 2 timer gratis parkering i Folke Bernadottes vei og Overlege Cappelens gate.",
    tannlegerTekst: "Et varmt og erfarent team som setter pasienten i sentrum og tilbyr skreddersydd behandling.",
    businessHours1: "Mandag, Tordag, Fredag: 08:00 - 15:30",
    businessHours2: "Tirsdag, Onsdag: 08:00 - 20:00"
};

export async function getSiteSettings() {
    try {
        const entries = await getCollection('innstillinger');
        // Gjør om [ {id: "tel", verdi: "123"}, ... ] til { tel: "123", ... }
        let collectionEntries = Object.fromEntries(entries.map(entry => [entry.id, entry.data.value]));

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