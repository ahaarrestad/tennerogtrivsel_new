// SyncOnEdit — Google Apps Script som starter et nytt bygg når innhold i Drive endres.
//
// Kjører IKKE fra repoet. Dette er en versjonert kopi av scriptet i Apps Script-prosjektet
// «SyncOnEdit» (Google Drive → Extensions → Apps Script). Endrer du det ene, oppdater det andre.
//
// Oppsett i Apps Script-prosjektet:
// - Tidsstyrt trigger som kaller checkFolderForChanges (f.eks. hvert 5. minutt).
// - Script Property GITHUB_PAT: token med rett til repository_dispatch på repoet.
// - Script Property LAST_CHECK: settes av scriptet selv.
//
// Starter `repository_dispatch` (google_drive_update), som kjører CI/CD i deploy.yml.
//
// Kjente begrensninger:
// - Bare filer rett i mappene sjekkes, ikke undermapper. Slettede filer starter ikke bygg.
// - Er LAST_CHECK aldri satt (ny installasjon), eskaleres midlertidige feil aldri til e-post.
//   Kjør funksjonen manuelt én gang etter installasjon, så LAST_CHECK finnes.
// - Varer midlertidige feil lenger enn ALARM_MS, kaster hver kjøring. Da kommer én e-post per
//   kjøring (eller én samlet per døgn, avhengig av varslingsinnstillingen for triggeren).
// - isTransient matcher på feilteksten. En GitHub-feil som inneholder et av ordene (f.eks. 503
//   «Service Unavailable») regnes også som midlertidig; andre GitHub-feil gir e-post med en gang.

var FOLDER_IDS = [
  "1iU57zpLtE27OUHTQcvTTIAp5iYXfL9zd",
  "1h_iXI-fFrIpfDfT1yZvkGpbOZKgbd1n6",
  "1zv20tkhQpZfHL3wx-ePNlPbqHNC54DwM",
  "1k9mfvdC8j7YioKtXj1NuabC5c1xAVQZU"
];
var SLACK_MS = 60 * 1000;               // overlapp, så filer lagret midt i en sjekk ikke glipper
var FIRST_RUN_MS = 6 * 60 * 1000;       // første kjøring: se 6 min tilbake, som før
var ALARM_MS = 2 * 60 * 60 * 1000;      // midlertidige feil i over 2 timer → e-post likevel

function checkFolderForChanges() {
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  Logger.log("Start: " + fmt(now));
  try {
    var stored = Number(props.getProperty('LAST_CHECK'));
    var lastCheck = stored || (now - FIRST_RUN_MS);
    Logger.log(stored
      ? "Forrige vellykkede sjekk: " + fmt(stored) + " (" + minutesAgo(stored, now) + " min siden)"
      : "Ingen LAST_CHECK lagret — første kjøring, ser " + (FIRST_RUN_MS / 60000) + " min tilbake");
    var sinceMs = lastCheck - SLACK_MS;
    Logger.log("Ser etter filer endret etter " + fmt(sinceMs));

    var change = findChange(sinceMs);
    if (change) {
      Logger.log("Endring funnet: «" + change.file + "» i mappe «" + change.folder +
                 "», endret " + fmt(change.updated));
      triggerGitHubBuild();
    } else {
      Logger.log("Ingen endringer funnet i noen mapper — ingen bygging.");
    }

    // Lagres først når alt over har lyktes — feiler noe, tar neste kjøring det igjen.
    props.setProperty('LAST_CHECK', String(now));
    Logger.log("LAST_CHECK satt til " + fmt(now) + ". Ferdig på " + (Date.now() - now) + " ms.");
  } catch (e) {
    if (!isTransient(e)) {
      Logger.log("FEIL (sender e-post): " + e);
      throw e;
    }
    var lastOk = null;
    try { lastOk = Number(props.getProperty('LAST_CHECK')); } catch (ignored) {}
    if (lastOk && now - lastOk > ALARM_MS) {
      Logger.log("Midlertidige feil i " + minutesAgo(lastOk, now) + " min — over grensen, sender e-post: " + e);
      throw e;
    }
    Logger.log("Midlertidig Google-feil, prøver igjen neste kjøring" +
               (lastOk ? " (siste vellykkede: " + fmt(lastOk) + ")" : "") + ": " + e);
  }
}

function findChange(sinceMs) {
  for (var i = 0; i < FOLDER_IDS.length; i++) {
    var folder = DriveApp.getFolderById(FOLDER_IDS[i]);
    var files = folder.getFiles();
    var count = 0;
    while (files.hasNext()) {
      var file = files.next();
      count++;
      var updated = file.getLastUpdated().getTime();
      if (updated > sinceMs) {
        return { folder: folder.getName(), file: file.getName(), updated: updated };
      }
    }
    Logger.log("Mappe «" + folder.getName() + "»: " + count + " filer sjekket, ingen endret.");
  }
  return null;
}

function isTransient(e) {
  return /server error|INTERNAL|Service error|unavailable|timed out|try again/i.test(String(e));
}

function triggerGitHubBuild() {
  var githubToken = PropertiesService.getScriptProperties().getProperty('GITHUB_PAT');
  if (!githubToken) throw new Error("GITHUB_PAT mangler i Script Properties");
  var url = "https://api.github.com/repos/ahaarrestad/tennerogtrivsel_new/dispatches";
  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Bearer " + githubToken,
      "Accept": "application/vnd.github.v3+json"
    },
    "payload": JSON.stringify({ "event_type": "google_drive_update" })
  };
  Logger.log("Sender repository_dispatch til " + url);
  var res = UrlFetchApp.fetch(url, options);  // kaster ved 4xx/5xx → e-post
  Logger.log("GitHub svarte " + res.getResponseCode() + " — bygging trigget!");
}

function fmt(ms) {
  return Utilities.formatDate(new Date(ms), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function minutesAgo(ms, now) {
  return Math.round((now - ms) / 60000);
}
