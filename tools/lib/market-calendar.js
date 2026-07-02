'use strict';
// market-calendar.js — jours fériés NYSE/Nasdaq + prochaine séance de trading.
// Créé le 2026-07-02 après l'incident scan 20260703 : le 4 juillet 2026 tombe un
// samedi → Independence Day OBSERVÉ le vendredi 3 juillet (fermeture COMPLÈTE),
// que la résolution de date naïve (weekday-only) ne connaissait pas. Le scan
// visait une séance inexistante.
//
// Source 2026 : calendrier officiel NYSE (vérifié 2026-07-02).
// ⚠️ 2027 : à re-vérifier contre le calendrier NYSE officiel avant le 2027-01-01.

const US_MARKET_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', // New Year's Day (jeu)
  '2026-01-19', // MLK Day (lun)
  '2026-02-16', // Washington's Birthday (lun)
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day (lun)
  '2026-06-19', // Juneteenth (ven)
  '2026-07-03', // Independence Day OBSERVÉ (4 juil = samedi)
  '2026-09-07', // Labor Day (lun)
  '2026-11-26', // Thanksgiving (jeu)
  '2026-12-25', // Christmas (ven)
  // 2027 (provisoire — TODO vérifier contre le calendrier NYSE officiel)
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

// Demi-séances (clôture 13h ET) — informatif, PAS des jours fermés.
const US_HALF_DAYS = new Set([
  '2026-11-27', // lendemain de Thanksgiving
  '2026-12-24', // veille de Noël (jeu)
]);

function toISO(d) { return d.toISOString().slice(0, 10); }

function isUSTradingDay(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !US_MARKET_HOLIDAYS.has(isoDate);
}

// Prochaine séance STRICTEMENT après isoDate (la convention scanner : le scan du
// soir J vise la prochaine séance > J).
function nextUSTradingDay(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  for (let i = 0; i < 10; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = toISO(d);
    if (isUSTradingDay(iso)) return iso;
  }
  throw new Error(`no trading day within 10 days after ${isoDate}`);
}

function isUSHalfDay(isoDate) { return US_HALF_DAYS.has(isoDate); }

module.exports = { US_MARKET_HOLIDAYS, US_HALF_DAYS, isUSTradingDay, nextUSTradingDay, isUSHalfDay };

// CLI : node tools/lib/market-calendar.js [YYYY-MM-DD] → prochaine séance (YYYYMMDD)
if (require.main === module) {
  const base = process.argv[2] || toISO(new Date());
  process.stdout.write(nextUSTradingDay(base).replace(/-/g, ''));
}
