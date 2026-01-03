# Kildekode for Tenner og Trivsel webside

**Bygget på Astro med Talewind**

www.tennerogtrivsel.no

### Notater om implementasjon

* Kode repo på https://github.com/ahaarrestad/tennerogtrivsel_new som bygger til S3 bucket på AWS. 
* **"CMS løsning"** er markdown filer på google drive https://drive.google.com/drive/folders/1AemDdd7cZhX5_pe-sVqJ-fyGtIczYmDd som synces inn ved bygg. Bruk gjerne https://stackedit.io/ for å redigere disse filene. 
* **Innstillinger** for siten er i et google regneark på https://docs.google.com/spreadsheets/d/1XTRkjyJpAk7hMNe4tfhhA3nI0BwmOfrR0dzj5iC_Hoo og gjør at innholdet på siden kan endres ganske enkelt.
* Når filene på google drive endres brukes et script på google disk (SyncOnEdit) for å trigge en webhook på github for å bygge nytt innhold og deploye til S3

### Lokalt oppsett
For å teste lokalt, brukt "npm run dev" og se siden på http://localhost:4321/

### Kontakt utvikler
For spørsmål om løsningen, kontakt Asbjørn Aarrestad
