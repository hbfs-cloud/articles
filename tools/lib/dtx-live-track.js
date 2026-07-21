'use strict';
/**
 * dtx-live-track.js — série LIVE append-only + drift backtest↔live des modes scriptés (dtx).
 *
 * POURQUOI (audit 21/07/2026) : depuis le go-live des 6 modes dtx (2026-07-13), la page
 * scanner/status n'accumulait AUCUN historique live — le segment « live (solid) — building »
 * dépendait de la courbe equity du sweep, qui stagne dès qu'un mode n'a ni trade clos ni point
 * de scan (elle s'était arrêtée au 15/07). Et la promesse « backtest≈live » n'était vérifiée
 * nulle part : zéro calcul de drift.
 *
 * CONTRAT :
 *  - data/dtx-live-track.json est APPEND-ONLY par (mode, date). Un point écrit n'est JAMAIS
 *    modifié (immutabilité, même esprit que trade-chain). Re-run le même jour = no-op.
 *  - Un point n'est ajouté que depuis une source RÉELLE (hero stats calculées par
 *    gen-status-page, ou snapshot history/*.json pour le backfill). Aucun point interpolé,
 *    aucun jour comblé : un trou dans la série = un soir où le pipeline n'a pas tourné,
 *    et il doit rester visible.
 *  - Le drift n'est calculé QUE si un replay frais couvrant [go-live → asof] est fourni
 *    (fichier produit par l'AGENT via DtxReplay — un subprocess node ne peut pas appeler le
 *    MCP). Pas de replay → drift null, jamais estimé. Le return absolu d'un replay segment
 *    est réputé peu fiable seul (règle « Segment Replay Absolute DD ») : le drift est donc
 *    étiqueté indicatif, seuils larges.
 *
 * Seuils drift (écart en points de pourcentage entre return live et return replay même
 * fenêtre) : |d| < 2 OK · 2–5 WATCH · > 5 ALERT.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TRACK_PATH = path.join(ROOT, 'data', 'dtx-live-track.json');

const DRIFT_OK_PP = 2;
const DRIFT_WATCH_PP = 5;

function loadTrack() {
  try {
    return JSON.parse(fs.readFileSync(TRACK_PATH, 'utf8'));
  } catch {
    return {
      _comment: 'Série LIVE append-only par mode scripté (dtx) + drift backtest↔live. ' +
        'Points immuables par (mode,date) — écrits par gen-status-page (soir) et dtx-live-track.js --backfill. ' +
        'drift.status: OK <2pp, WATCH 2-5pp, ALERT >5pp (indicatif — replay segment).',
      _version: 'v1-20260721',
      modes: {},
    };
  }
}

function saveTrack(track) {
  track._updated = new Date().toISOString();
  fs.writeFileSync(TRACK_PATH, JSON.stringify(track, null, 2) + '\n', 'utf8');
}

/**
 * Ajoute un point live pour un mode. Append-only : si (mode,date) existe déjà, no-op
 * (retourne false). Champs numériques uniquement, tous issus d'une source réelle.
 */
function appendPoint(track, modeId, point) {
  if (!point || !point.date || typeof point.ret !== 'number') return false;
  const m = (track.modes[modeId] = track.modes[modeId] || { goLive: point.goLive || null, points: [], drift: null });
  if (point.goLive && !m.goLive) m.goLive = point.goLive;
  // Append-only ENTRE jours ; au SEIN d'une même journée, dernier-écrit-gagne mais UNIQUEMENT
  // sur le dernier point de la série (un run de mi-journée ne doit pas verrouiller le point du
  // soir, et un point d'un jour passé reste immuable).
  const existingIdx = m.points.findIndex(p => p.date === point.date);
  if (existingIdx >= 0) {
    if (existingIdx !== m.points.length - 1) return false; // point historique : immuable
    m.points[m.points.length - 1] = {
      date: point.date,
      ret: +(+point.ret).toFixed(2),
      unrealized: point.unrealized != null ? +(+point.unrealized).toFixed(2) : null,
      trades: point.trades != null ? point.trades : null,
      ordersPublished: point.ordersPublished != null ? point.ordersPublished : null,
    };
    return true;
  }
  m.points.push({
    date: point.date,
    ret: +(+point.ret).toFixed(2),
    unrealized: point.unrealized != null ? +(+point.unrealized).toFixed(2) : null,
    trades: point.trades != null ? point.trades : null,
    ordersPublished: point.ordersPublished != null ? point.ordersPublished : null,
  });
  m.points.sort((a, b) => a.date < b.date ? -1 : 1);
  return true;
}

/**
 * Drift backtest↔live pour un mode : return live cumulé (dernier point) vs return du replay
 * frais sur la même fenêtre. replayLive = résultat DtxReplay(from=goLive, to>=asof) brut
 * ({results:[{return_pct, equity_dates, equity_values, ...}]}) écrit par l'agent.
 * Retourne null si le replay ne couvre pas la fenêtre (fail-closed, rien d'estimé).
 */
function computeDrift(track, modeId, replayLive, asofISO) {
  const m = track.modes[modeId];
  if (!m || !m.points.length || !replayLive) return null;
  const res = Array.isArray(replayLive.results) && replayLive.results.length
    ? (replayLive.results.find(r => (r.allocation || '') === modeId) || replayLive.results[0])
    : null;
  if (!res || typeof res.return_pct !== 'number') return null;
  // Garde DATA FAILURE : le serveur peut renvoyer un replay techniquement « réussi » mais vide
  // (0 trade, courbe plate, ≤1 point) quand le fetch OHLCV de la fenêtre n'a rien donné.
  // On n'en tire JAMAIS un drift — mieux vaut « non calculé » qu'un faux 0%.
  if (replayLive.warning && /DATA FAILURE/i.test(String(replayLive.warning))) return null;
  const dates = (res.equity_dates || []).map(d => String(d).slice(0, 10));
  const vals = res.equity_values || [];
  if (dates.length < 2 || vals.length !== dates.length) return null;
  const first = dates[0], last = dates[dates.length - 1];
  // Méthodologie : le moteur ne sait PAS rejouer une fenêtre courte isolée (DATA FAILURE —
  // il lui faut l'historique d'avant `from` pour armer ses indicateurs). Le drift se mesure
  // donc sur un replay COMPLET (2021→aujourd'hui) en extrayant le return du SEGMENT
  // [go-live → dernier point] dans la même courbe : un delta relatif interne, conforme à la
  // règle « Segment Replay » (les deltas relatifs sont fiables, pas les absolus isolés).
  if (m.goLive && first > m.goLive) return null;      // la courbe doit commencer avant le go-live
  const liveLast = m.points[m.points.length - 1];
  // Couverture PROUVÉE = dernier point ÉCHANTILLONNÉ de la courbe. end_date/final_equity ne
  // suffisent pas : un cache OHLCV serveur qui s'arrête avant la fenêtre produit exactement le
  // même « plat » qu'un vrai zéro-fill (constat 21/07/2026 : replays fenêtrés en DATA FAILURE
  // pendant que le replay complet affichait end_date=21/07 avec un dernier point au 09/07).
  // Fail-closed : pas de point échantillonné strictement après le go-live → pas de drift.
  const covEnd = last;
  if (covEnd <= m.goLive) return null;                 // aucun point prouvé après le go-live
  let anchorIdx = 0;
  for (let i = 0; i < dates.length; i++) { if (dates[i] <= m.goLive) anchorIdx = i; else break; }
  const vAnchor = vals[anchorIdx];
  const vLast = vals[vals.length - 1];
  if (!(vAnchor > 0) || !(vLast > 0)) return null;
  const replaySegRet = +((vLast / vAnchor - 1) * 100).toFixed(2);
  const drift_pp = +(liveLast.ret - replaySegRet).toFixed(2);
  const abs = Math.abs(drift_pp);
  const status = abs < DRIFT_OK_PP ? 'OK' : abs <= DRIFT_WATCH_PP ? 'WATCH' : 'ALERT';
  const filled = liveLast.trades;
  const published = m.points.reduce((s, p) => s + (p.ordersPublished || 0), 0);
  m.drift = {
    asof: asofISO || liveLast.date,
    window: { from: m.goLive, to: liveLast.date },
    live_ret_pct: liveLast.ret,
    replay_ret_pct: replaySegRet,
    replay_total_ret_pct: +(+res.return_pct).toFixed(2),
    replay_anchor: { date: dates[anchorIdx], sampled: 'courbe bi-hebdomadaire du replay complet' },
    replay_span: { from: first, to: covEnd },
    drift_pp,
    status,
    exec: { orders_published_cum: published || null, trades_filled: filled != null ? filled : null },
    _note: 'indicatif — segment extrait du replay complet (ancre = dernier point <= go-live, échantillonnage bi-hebdomadaire)',
  };
  return m.drift;
}

module.exports = { TRACK_PATH, loadTrack, saveTrack, appendPoint, computeDrift, DRIFT_OK_PP, DRIFT_WATCH_PP };
