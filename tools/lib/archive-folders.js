'use strict';
// Résolution des dossiers d'archive d'analyses à partir de leur CONTENU, pas de leur nom.
//
// Historique du problème : publish-analysis nommait le dossier d'archive avec la date du jour quand l'ancienne
// page n'avait pas d'attribut data-date (cas de presque toutes les fiches antérieures à la v3), alors que
// add_card construit le lien de la carte d'archive avec la date de la fiche archivée. Résultat : cartes vers
// des dossiers inexistants (404) ou vers une autre version que celle annoncée. Ce module lit la date réelle
// de chaque page archivée et sert de référence commune aux deux outils et au script de réparation.
const fs = require('fs');
const path = require('path');

const MONTHS = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9,
  october: 10, november: 11, december: 12,
};
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Date d'analyse d'une page : attribut data-date, sinon date du <title> (formats « 14 Février 2026 » ou
// « March 8, 2026 »). null si aucune date lisible.
function pageAnalysisDate(html) {
  const dd = String(html).match(/data-date="(\d{4}-\d{2}-\d{2})"/);
  if (dd) return dd[1];
  const title = (String(html).match(/<title>([^<]*)/i) || [])[1] || '';
  let m = title.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(20\d{2})/);
  if (m && MONTHS[m[2].toLowerCase()]) return iso(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  m = title.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(20\d{2})/);
  if (m && MONTHS[m[1].toLowerCase()]) return iso(m[3], MONTHS[m[1].toLowerCase()], m[2]);
  return null;
}

// Dossiers d'archive d'un ticker : [{ folder: 'YYYYMMDD', date: 'YYYY-MM-DD' | null }], triés par nom.
function archiveFolders(root, ticker) {
  const dir = path.join(root, 'analyses', ticker, 'archive');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^\d{8}$/.test(f) && fs.existsSync(path.join(dir, f, 'index.html'))).sort()
    .map(folder => ({ folder, date: pageAnalysisDate(fs.readFileSync(path.join(dir, folder, 'index.html'), 'utf8')) }));
}

// Dossier qui contient la version datée `date` : d'abord un dossier dont le contenu porte cette date
// (le plus récent si plusieurs), sinon un dossier nommé par cette date mais SANS date lisible dans son
// contenu (un dossier dont le contenu porte une autre date contient une autre version), sinon null.
function findArchiveFolder(root, ticker, date) {
  const folders = archiveFolders(root, ticker);
  const byContent = folders.filter(f => f.date === date);
  if (byContent.length) return byContent[byContent.length - 1].folder;
  const named = folders.find(f => f.folder === String(date).replace(/-/g, '') && f.date == null);
  return named ? named.folder : null;
}

module.exports = { pageAnalysisDate, archiveFolders, findArchiveFolder };
