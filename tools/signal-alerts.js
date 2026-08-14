#!/usr/bin/env node
/**
 * signal-alerts.js — détecteur d'événements de suivi sur les signaux PUBLIÉS.
 *
 * Lit le registre des signaux (`data/signals-ledger.json` — c'est LUI la « signals db » du repo,
 * maintenue par `tools/signals-ledger.js` append/sweep) + les prix du jour déjà trackés, et détecte
 * les événements NOUVEAUX depuis le dernier run :
 *     entry   → entrée touchée (l'ordre est servi)
 *     stop    → stop touché
 *     tp1     → première cible atteinte
 *     tp2     → seconde cible atteinte
 *     expired → horizon écoulé (optionnel, --with-expiry)
 *
 * Sortie : `data/signal-alerts-pending.json` — file d'attente APPEND, dédupliquée par
 * `signalId + event`. Ce script **NE NOTIFIE PAS** : la stack Telegram passe par le MCP
 * Notification en OAuth2 (zéro token en .env, cf CLAUDE.md), donc seul l'AGENT d'une routine peut
 * envoyer. Le contrat est :
 *     1. cron/routine → `node tools/signal-alerts.js`         (détection, écrit le pending)
 *     2. AGENT        → lit `data/signal-alerts-pending.json`, filtre `notified:false`,
 *                       envoie via `send_message(to='alerts', format='html', ...)`
 *     3. AGENT        → `node tools/signal-alerts.js --mark <key,key,...>`  (ou `--mark-all`)
 *
 * Sources de prix (par ordre de priorité, fusionnées) :
 *   --prices <f.json>   {TICKER:{price,high,low,open}} ou {TICKER:price}  (salve MCP de l'agent)
 *   data/scanner-positions.json                       (current_price déjà tracké par update-tracking.js)
 *   le registre lui-même                              (statuts scellés par le sweep — source la plus fiable)
 *
 * Usage :
 *   node tools/signal-alerts.js                        # détection + écriture
 *   node tools/signal-alerts.js --dry                  # détection seule, rien d'écrit
 *   node tools/signal-alerts.js --prices /tmp/q.json --asof 2026-08-14
 *   node tools/signal-alerts.js --pending              # liste les événements non notifiés (JSON)
 *   node tools/signal-alerts.js --mark <key,key>       # marque notified:true
 *   node tools/signal-alerts.js --mark-all             # marque tout le pending notified:true
 *
 * Flags : --days N (fenêtre de signaux considérés, def. 45) · --with-expiry · --no-seed
 *         --retention-days N (purge des notifiés, def. 180) · --ledger/--out (chemins) · --json
 *
 * Premier run (aucun fichier pending) : SEED — les événements déjà vrais sont enregistrés
 * `notified:true, seeded:true` pour ne pas déverser tout l'historique sur Telegram. `--no-seed`
 * force l'inverse.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LEDGER = path.join(ROOT, 'data', 'signals-ledger.json');
const DEFAULT_OUT = path.join(ROOT, 'data', 'signal-alerts-pending.json');
const POSITIONS = path.join(ROOT, 'data', 'scanner-positions.json');

const TERMINAL = new Set(['tp2', 'stopped', 'expired', 'skipped']);
const EVENT_LABELS = {
  entry: 'Entrée touchée',
  stop: 'Stop touché',
  tp1: 'TP1 atteint',
  tp2: 'TP2 atteint',
  expired: 'Horizon écoulé',
};
// Ordre de gravité pour le tri d'affichage (le lecteur veut les sorties d'abord).
const EVENT_RANK = { stop: 0, tp2: 1, tp1: 2, expired: 3, entry: 4 };

// ── args ──────────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
function flag(name) { return ARGV.includes(name); }
function opt(name, def) { const i = ARGV.indexOf(name); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : def; }

const DRY = flag('--dry') || flag('--dry-run');
const WITH_EXPIRY = flag('--with-expiry');
const NO_SEED = flag('--no-seed');
const AS_JSON = flag('--json');
const DAYS = Number(opt('--days', '45'));
const RETENTION_DAYS = Number(opt('--retention-days', '180'));
const LEDGER_PATH = path.resolve(opt('--ledger', DEFAULT_LEDGER));
const OUT_PATH = path.resolve(opt('--out', DEFAULT_OUT));
const PRICES_PATH = opt('--prices', null);
const NOW_ISO = opt('--now', new Date().toISOString());
const ASOF = opt('--asof', NOW_ISO.slice(0, 10));

// ── io ────────────────────────────────────────────────────────────────────────
function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}
function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function lvl(x) { const n = num(x); return n != null && n > 0 ? n : null; } // ≤0 ou NaN = niveau ABSENT

// FR : virgule décimale, pas de séparateur de milliers exotique.
function fr(n, d = 2) { return n == null ? '—' : Number(n).toFixed(d).replace('.', ','); }
function pct(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + Number(n).toFixed(1).replace('.', ',') + ' %'; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── prix ──────────────────────────────────────────────────────────────────────
// Normalise en {TICKER:{price,high,low,open}}. `high`/`low` absents ⇒ on retombe sur `price`
// (une barre de largeur nulle) : c'est conservateur — cf signals-ledger.js, où un `open` fabriqué
// à 0 scellait des −30R. On ne fabrique JAMAIS un niveau manquant.
function normalizeQuotes(raw, source) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [ticker, q] of Object.entries(raw)) {
    if (q == null) continue;
    const isObj = typeof q === 'object';
    const price = num(isObj ? (q.price ?? q.close ?? q.last ?? q.current_price) : q);
    if (price == null) continue;
    out[ticker] = {
      price,
      high: isObj && q.high != null ? num(q.high) : price,
      low: isObj && q.low != null ? num(q.low) : price,
      open: isObj && q.open != null ? num(q.open) : null,
      hasRange: !!(isObj && q.high != null && q.low != null),
      source,
    };
  }
  return out;
}

function loadQuotes() {
  const merged = {};
  // Le plus faible d'abord, le plus frais écrase.
  const positions = readJSON(POSITIONS, null);
  if (positions && Array.isArray(positions.open_positions)) {
    const asMap = {};
    for (const p of positions.open_positions) {
      if (p && p.ticker && p.current_price != null) asMap[p.ticker] = { price: p.current_price };
    }
    Object.assign(merged, normalizeQuotes(asMap, 'scanner-positions'));
  }
  if (PRICES_PATH) {
    const raw = readJSON(path.resolve(PRICES_PATH), null);
    if (!raw) { console.error(`signal-alerts: --prices illisible (${PRICES_PATH})`); process.exit(2); }
    Object.assign(merged, normalizeQuotes(raw, 'prices-file'));
  }
  return merged;
}

// ── détection ─────────────────────────────────────────────────────────────────
function rOf(s, exit) {
  const stop = lvl(s.stop), entry = num(s.entry);
  if (stop == null || entry == null || exit == null) return null;
  const denom = entry - stop;
  if (!denom) return null;
  return +(((exit - entry) / denom) * (s.direction === 'short' ? -1 : 1)).toFixed(2);
}

function ageDays(fromDate, to) {
  if (!fromDate) return 0;
  return Math.round((Date.parse(to) - Date.parse(fromDate)) / 86400000);
}

/**
 * Événements VRAIS pour un signal, à partir (a) du registre — scellé par le sweep, autoritaire —
 * et (b) des prix du jour, pour attraper l'intraday avant que le sweep ne passe.
 * Retourne [{event, level, price, eventDate, source, outcomeR}].
 */
function detectForSignal(s, quote) {
  const found = [];
  const entry = num(s.entry), stop = lvl(s.stop), tp1 = lvl(s.tp1), tp2 = lvl(s.tp2);
  const short = s.direction === 'short';
  const push = (event, level, price, eventDate, source) => {
    if (found.some(e => e.event === event)) return;
    found.push({ event, level, price: price ?? null, eventDate: eventDate || ASOF, source, outcomeR: null });
  };

  // (a) registre — statuts scellés
  if (s.triggered) push('entry', entry, null, s.triggeredDate || s.date, 'ledger');
  if (s.status === 'stopped') push('stop', stop, null, s.closedDate, 'ledger');
  if (s.status === 'tp2') push('tp2', tp2, null, s.closedDate, 'ledger');
  if (s.status === 'tp1') push('tp1', tp1, null, s.closedDate || s.triggeredDate, 'ledger');
  if (WITH_EXPIRY && s.status === 'expired') push('expired', null, null, s.closedDate, 'ledger');

  // (b) prix du jour — seulement tant que le signal n'est pas scellé
  if (quote && !TERMINAL.has(s.status)) {
    const { price, high, low, open, hasRange } = quote;
    const hi = high ?? price, lo = low ?? price;

    // Entrée : la barre doit CONTENIR le niveau (même règle que le sweep du registre). Sans
    // high/low réels la barre est un point — on n'infère pas une entrée d'un simple last price,
    // sinon toute ligne au-dessus de son entrée serait déclarée servie à tort.
    if (!s.triggered && entry != null && hasRange && lo <= entry && entry <= hi) {
      push('entry', entry, price, ASOF, 'prices');
    }
    const inPosition = s.triggered || found.some(e => e.event === 'entry');
    if (inPosition) {
      // Stop d'abord (conservateur), puis les cibles — ordre identique au sweep.
      const hitStop = stop != null && (short ? hi >= stop : lo <= stop);
      if (hitStop) {
        const fill = (open != null && (short ? open > stop : open < stop)) ? open : stop;
        push('stop', stop, fill, ASOF, 'prices');
      } else {
        if (tp2 != null && (short ? lo <= tp2 : hi >= tp2)) push('tp2', tp2, price, ASOF, 'prices');
        else if (tp1 != null && s.status !== 'tp1' && (short ? lo <= tp1 : hi >= tp1)) push('tp1', tp1, price, ASOF, 'prices');
      }
    }
    if (WITH_EXPIRY && !found.some(e => ['stop', 'tp2'].includes(e.event))) {
      const hold = num(s.maxHoldDays) || 10;
      if (ageDays(s.date, ASOF) >= hold * 1.4) push('expired', null, price, ASOF, 'prices');
    }
  }

  for (const e of found) {
    const ref = e.price != null ? e.price : e.level;
    e.outcomeR = s.outcomeR != null && ['stop', 'tp1', 'tp2', 'expired'].includes(e.event)
      ? s.outcomeR
      : rOf(s, ref);
    if (e.event === 'entry') e.outcomeR = null;
  }
  return found;
}

function suggestedLine(s, e) {
  const t = esc(s.ticker);
  const move = (e.price != null && s.entry) ? ((e.price - s.entry) / s.entry) * 100 * (s.direction === 'short' ? -1 : 1) : null;
  switch (e.event) {
    case 'entry':
      return `🟢 <b>${t}</b> — entrée ${fr(s.entry)} servie. Stop ${fr(s.stop)}, cibles ${fr(s.tp1)} / ${fr(s.tp2)}.`;
    case 'tp1':
      return `✅ <b>${t}</b> — TP1 ${fr(s.tp1)} atteint (${e.outcomeR != null ? fr(e.outcomeR, 2) + 'R' : pct(move)}). Reste ${fr(s.tp2)}.`;
    case 'tp2':
      return `✅ <b>${t}</b> — TP2 ${fr(s.tp2)} atteint, position soldée (${e.outcomeR != null ? fr(e.outcomeR, 2) + 'R' : pct(move)}).`;
    case 'stop':
      return `❌ <b>${t}</b> — stop ${fr(s.stop)} touché${e.price != null && e.price !== s.stop ? ` (rempli ${fr(e.price)}, trou de cotation)` : ''}, ${e.outcomeR != null ? fr(e.outcomeR, 2) + 'R' : 'sortie'}.`;
    case 'expired':
      return `⏸️ <b>${t}</b> — horizon écoulé, on sort à ${fr(e.price ?? s.entry)} (${e.outcomeR != null ? fr(e.outcomeR, 2) + 'R' : pct(move)}).`;
    default:
      return `<b>${t}</b> — ${EVENT_LABELS[e.event] || e.event}.`;
  }
}

// ── commandes de marquage ─────────────────────────────────────────────────────
function cmdMark() {
  const store = readJSON(OUT_PATH, null);
  if (!store || !Array.isArray(store.events)) { console.error(`signal-alerts: aucun pending à marquer (${OUT_PATH})`); process.exit(2); }
  const all = flag('--mark-all');
  const keys = new Set(String(opt('--mark', '')).split(',').map(k => k.trim()).filter(Boolean));
  let marked = 0;
  for (const e of store.events) {
    if (e.notified) continue;
    if (!all && !keys.has(e.key)) continue;
    e.notified = true; e.notifiedAt = NOW_ISO; marked++;
  }
  store.generatedAt = NOW_ISO;
  if (!DRY) writeJSON(OUT_PATH, store);
  console.log(JSON.stringify({ ok: true, marked, dry: DRY, pending: store.events.filter(e => !e.notified).length }));
}

function cmdPending() {
  const store = readJSON(OUT_PATH, { events: [] });
  const pending = (store.events || []).filter(e => !e.notified);
  console.log(JSON.stringify({ generatedAt: store.generatedAt || null, count: pending.length, events: pending }, null, 2));
}

// ── run principal ─────────────────────────────────────────────────────────────
function main() {
  const ledger = readJSON(LEDGER_PATH, null);
  if (!ledger || !Array.isArray(ledger.signals)) {
    console.error(`signal-alerts: registre illisible ou vide (${LEDGER_PATH})`);
    process.exit(2);
  }
  const store = readJSON(OUT_PATH, null);
  const firstRun = store == null;
  const seedMode = firstRun && !NO_SEED;
  const events = (store && Array.isArray(store.events)) ? store.events : [];
  const seen = new Set(events.map(e => e.key));

  const quotes = loadQuotes();
  const cutoff = Date.parse(ASOF) - DAYS * 86400000;

  const fresh = [];
  let considered = 0, quoted = 0;
  for (const s of ledger.signals) {
    // Fenêtre : un signal hors fenêtre ne peut plus produire d'alerte (et évite qu'une purge du
    // pending ne fasse re-sonner un stop de l'an dernier).
    const ref = s.closedDate || s.triggeredDate || s.date;
    if (ref && Date.parse(ref) < cutoff) continue;
    if (s.status === 'skipped') continue; // ordre jamais servi : rien à suivre
    considered++;
    const q = quotes[s.ticker] || null;
    if (q) quoted++;
    for (const e of detectForSignal(s, q)) {
      const key = `${s.id}::${e.event}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push({
        key,
        signalId: s.id,
        ticker: s.ticker,
        family: s.family || null,
        signalDate: s.date || null,
        direction: s.direction || 'long',
        event: e.event,
        label: EVENT_LABELS[e.event] || e.event,
        level: e.level ?? null,
        price: e.price ?? null,
        outcomeR: e.outcomeR ?? null,
        entry: num(s.entry), stop: num(s.stop), tp1: num(s.tp1), tp2: num(s.tp2),
        eventDate: e.eventDate || ASOF,
        detectedAt: NOW_ISO,
        source: e.source,
        suggestedLine: suggestedLine(s, e),
        notified: seedMode,
        notifiedAt: seedMode ? NOW_ISO : null,
        ...(seedMode ? { seeded: true } : {}),
      });
    }
  }

  fresh.sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || '')
    || (EVENT_RANK[a.event] ?? 9) - (EVENT_RANK[b.event] ?? 9)
    || a.ticker.localeCompare(b.ticker));

  // Purge : uniquement des événements DÉJÀ notifiés et hors rétention (la dédup reste garantie
  // par la fenêtre --days, plus courte que la rétention).
  const purgeBefore = Date.parse(ASOF) - RETENTION_DAYS * 86400000;
  const kept = events.filter(e => !(e.notified && e.eventDate && Date.parse(e.eventDate) < purgeBefore));
  const purged = events.length - kept.length;

  const out = {
    generatedAt: NOW_ISO,
    asof: ASOF,
    ledger: path.relative(ROOT, LEDGER_PATH),
    note: 'File d\'attente d\'alertes. Ce fichier n\'envoie rien : l\'agent lit les events notified:false, poste sur Telegram (MCP Notification, OAuth2), puis appelle `node tools/signal-alerts.js --mark <key,...>`.',
    events: kept.concat(fresh),
  };
  const pending = out.events.filter(e => !e.notified);

  if (!DRY) writeJSON(OUT_PATH, out);

  if (AS_JSON) {
    console.log(JSON.stringify({
      ok: true, dry: DRY, seeded: seedMode, considered, quoted,
      newEvents: fresh.length, pending: pending.length, purged, out: path.relative(ROOT, OUT_PATH),
      events: fresh,
    }, null, 2));
    return;
  }

  console.log(`signal-alerts — asof=${ASOF}${DRY ? ' [DRY]' : ''}${seedMode ? ' [SEED: rien à notifier]' : ''}`);
  console.log(`  signaux dans la fenêtre ${DAYS}j : ${considered} (dont ${quoted} avec un prix)`);
  console.log(`  événements nouveaux : ${fresh.length}${purged ? ` · purgés (notifiés > ${RETENTION_DAYS}j) : ${purged}` : ''}`);
  for (const e of fresh) {
    console.log(`    ${e.eventDate}  ${e.event.toUpperCase().padEnd(7)} ${e.ticker.padEnd(8)} ${e.source.padEnd(17)} ${e.suggestedLine.replace(/<[^>]+>/g, '')}`);
  }
  console.log(`  en attente de notification : ${pending.length}`);
  console.log(DRY ? `  (dry : ${path.relative(ROOT, OUT_PATH)} non écrit)` : `  → ${path.relative(ROOT, OUT_PATH)}`);
}

if (flag('--mark') || flag('--mark-all')) cmdMark();
else if (flag('--pending')) cmdPending();
else main();
