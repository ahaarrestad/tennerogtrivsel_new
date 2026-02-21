# Kildekode for Tenner og Trivsel webside

**Bygget på Astro med Talewind**

www.tennerogtrivsel.no

### Notater om implementasjon

* Kode repo på https://github.com/ahaarrestad/tennerogtrivsel_new som bygger til S3 bucket på AWS. 
* **"CMS løsning"** er markdown filer på google drive https://drive.google.com/drive/folders/1AemDdd7cZhX5_pe-sVqJ-fyGtIczYmDd som synces inn ved bygg. Bruk gjerne https://stackedit.io/ for å redigere disse filene. 
* **Innstillinger** for siden er i et google regneark på https://docs.google.com/spreadsheets/d/1XTRkjyJpAk7hMNe4tfhhA3nI0BwmOfrR0dzj5iC_Hoo og gjør at innholdet på siden kan endres ganske enkelt.
* **Tannleger** ligger i samme fil som innstillinger, men i annen tab. Bildene lastes opp på google drive i egen mappe og kun filnavnet refereres til i regnearket.
* Når filene på google drive endres brukes et script på google disk (SyncOnEdit) for å trigge en webhook på github for å bygge nytt innhold og deploye til S3

### Oppsett notater
* 404.html er feil-siden. Denne må legges inn i s3 som standard feil-side manuelt.
* Auto generering av sitemap og robots.txt er satt opp via astro sitemap.
* dependabot kjører på github for å holde avhengigheter oppdatert.
* gihub secrets brukes for å holde AWS nøkler og google api nøkler hemmelige - bruker .env lokalt

### Lokalt oppsett
For å teste lokalt, brukt "npm run dev" og se siden på http://localhost:4321/

### Kontakt utvikler
For spørsmål om løsningen, kontakt Asbjørn Aarrestad

### ai-context
CLAUDE.md inneholder detaljerte instruksjoner for hvordan en AI-agent (Claude Code) skal operere når den interagerer med dette prosjektet. Det dekker alt fra koding og testing til sikkerhetspraksis og kvalitetskontroll, og er essensielt for å sikre at alle endringer i koden er i tråd med prosjektets standarder og krav.
