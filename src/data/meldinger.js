// Meldinger som vises på forsiden av nettsiden
// Første gyldige dato-intervall vises. Eventuelt andre overlappende intervaller ignoreres.
//
// Datoformat: ÅÅÅÅ-MM-DD
export const messages = [
    {
        id: 1,
        header: "🎄 Vi holder julestengt fra 23. desember til 2. januar. God jul!",
        text: "Vi har åpent mandag 22 desember fra 08:00 - 15:30 og tirsdag 23 desember fra 08:00 til 14:30, samt i romjulen mandag 29 og tirsdag 30 desember klokken 8 - 15."
            + "<br>Vanlige åpningstider etter nyttår fra og med fredag 2 januar."
            + "<br>Du kan få akkutthjelp hos Stavanger Tannlegevakt i helger og på helligdager, Tastagt 30-32, tlf 51659270."
            + "<br><br>"
            + "🎄 Vi ønsker alle god jul! 🎄",
        startDate: "2025-12-01",
        endDate: "2026-01-02",
    },
    {
        id: 2,
        header: "⚠️ Vi har for tiden problemer med sentralbordet. Bruk epost.",
        text: "Kontakt oss på epost <a href=mailto:resepsjon@tennerogtrivsel.no class='text-blue-600 underline'>resepsjon@tennerogtrivsel.no</a> så svarer vi så raskt vi kan."
            + "<br><br>"
            + "Beklager ulempen dette medfører.",
        startDate: "2025-12-27",
        endDate: "2025-12-27",
    }
];
