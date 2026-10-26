'use strict';

// Rendu français des dates de calendrier, partagé par le contrôle de provenance
// (`validate-content-claims.js`) et par l'échéancier (`event-timeline.cjs`). Une seule
// implémentation : deux rendus du même jour finissent toujours par diverger sur un cas limite
// (le 1er du mois, un changement d'année), et la divergence se lit comme une erreur de date.

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_COURTS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

// Date civile stricte : « 2026-02-30 » est refusé au lieu d'être reporté au 2 mars.
function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) return null;
  const [, y, mo, da] = match;
  const date = new Date(`${y}-${mo}-${da}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() + 1 !== Number(mo) || date.getUTCDate() !== Number(da)) return null;
  return date;
}

function renderFrenchDate(value, parts) {
  const date = parseIsoDate(value);
  if (!date) return null;
  const jour = JOURS_FR[date.getUTCDay()];
  const mois = MOIS_FR[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  // Le premier du mois prend l'ordinal en français. « annonce du mardi 1 septembre » se lit comme
  // une faute de frappe, ce qui jette le doute sur les chiffres voisins.
  const n = date.getUTCDate() === 1 ? '1er' : String(date.getUTCDate());
  if (parts === 'day_month') return `${n} ${mois}`;
  if (parts === 'day_month_year') return `${n} ${mois} ${y}`;
  if (parts === 'weekday_day_month') return `${jour} ${n} ${mois}`;
  if (parts === undefined || parts === 'full') return `${jour} ${n} ${mois} ${y}`;
  return null;
}

// Étiquette d'un jour de calendrier. Le format `axis` est celui des pastilles de l'échéancier
// (« 28 mer. ») : chiffre nu, sans ordinal, parce qu'il se lit sur une frise et non dans une phrase.
const CALENDAR_FORMATS = new Set(['axis', 'day_month', 'day_month_year', 'weekday_day_month', 'full']);
function renderCalendarLabel(value, format) {
  if (!CALENDAR_FORMATS.has(format)) return null;
  if (format !== 'axis') return renderFrenchDate(value, format);
  const date = parseIsoDate(value);
  if (!date || value.length !== 10) return null;
  return `${date.getUTCDate()} ${JOURS_COURTS_FR[date.getUTCDay()]}`;
}

// Jour civil, à Paris, d'une valeur source. Une date seule reste ce jour ; un instant ISO 8601 avec
// décalage est ramené à Paris : une annonce de 20h00 à New York tombe le lendemain à Paris, et
// c'est ce lendemain que l'échéancier doit montrer puisqu'il est en heures de Paris.
const PARIS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
function parisDateOf(value) {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseIsoDate(value) ? value : null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(PARIS_DAY.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

module.exports = { MOIS_FR, JOURS_FR, JOURS_COURTS_FR, CALENDAR_FORMATS, parseIsoDate, renderFrenchDate, renderCalendarLabel, parisDateOf };
