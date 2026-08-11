#!/usr/bin/env node
'use strict';
/**
 * desk-plan — le décideur de /desk. Répond à une seule question : QUE FAUT-IL
 * PRODUIRE AUJOURD'HUI, et rien d'autre.
 *
 *   node tools/desk-plan.js [--json] [--out data/desk/<date>/plan.json]
 *                           [--now 2026-08-11T23:10:00Z] [--socle <dir>]
 *                           [--only a,b] [--skip c,d]
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────────
 * Parce que « produire parce que c'est dans la liste » est un défaut, pas une
 * cadence. Un digest earnings hors saison, un weekly daté du lundi passé, un
 * scanner qui vise une séance fériée : trois façons de publier du vide.
 *
 * Ce script ne collecte RIEN et n'appelle AUCUN MCP. Il ne lit que trois choses,
 * toutes déterministes :
 *   1. le registre de publication, via `publication-gate.js --check --json`
 *      (jamais réimplémenté ici — le gate reste la source unique des cadences) ;
 *   2. le calendrier de marché (`lib/market-calendar.js`) ;
 *   3. l'état du disque : quel artefact existe déjà, quel horizon est écoulé.
 * Même entrée → même sortie. C'est donc entièrement du ressort du script, et
 * rien de tout cela ne doit remonter au modèle.
 *
 * ── Ce que ce script NE FAIT PAS, volontairement ────────────────────────────
 * Il n'autorise JAMAIS un email. `send_email` sort toujours à false. L'email
 * exige un appel séparé au gate avec une matérialité chiffrée, APRÈS le panel,
 * et sous verrou (voir tools/desk-run.sh --authorize-email). Un plan qui
 * transporterait une autorisation d'email serait un contournement : le plan est
 * calculé avant la rédaction, donc avant qu'on sache si le contenu la mérite.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { isUSTradingDay, nextUSTradingDay } = require('./lib/market-calendar');

const argv = process.argv;
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const list = (n) => (arg(n, '') || '').split(',').map(s => s.trim()).filter(Boolean);

// « Même entrée, même sortie » ne tient que si le répertoire courant ne fait pas
// partie de l'entrée. Or tout l'état lu ici est relatif au dépôt : data/daily.json,
// scanner/, weekly/, plans/. Appelé depuis ailleurs, desk-plan voyait un dépôt
// vide et déclarait dû ce qui était déjà publié. On résout --out AVANT de se
// caler, pour qu'un chemin relatif fourni par l'appelant garde son sens.
const OUT_FILE = arg('--out') ? path.resolve(arg('--out')) : null;
process.chdir(path.join(__dirname, '..'));

const NOW = arg('--now') ? new Date(arg('--now')) : new Date();
if (Number.isNaN(NOW.getTime())) { console.error('[desk-plan] --now illisible'); process.exit(2); }
const SOCLE_DIR = arg('--socle');
const ONLY = new Set(list('--only'));
const SKIP = new Set(list('--skip'));

// ── Temps et calendrier ─────────────────────────────────────────────────────
// L'heure de référence est PARIS (c'est l'heure de l'opérateur et celle des
// commandes existantes), la séance est NEW YORK. Confondre les deux, c'est
// dater un scan du lundi avec la clôture du vendredi.
function paris(d) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
  const date = `${f.year}-${f.month}-${f.day}`;
  return { date, minutes: Number(f.hour) * 60 + Number(f.minute), hhmm: `${f.hour}:${f.minute}`,
           dow: new Date(date + 'T12:00:00Z').getUTCDay() };
}
const shift = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// market-calendar n'expose que « la prochaine séance ». La précédente se déduit
// du même prédicat — inutile d'élargir la lib pour ça.
function prevUSTradingDay(iso) {
  for (let i = 1; i <= 10; i++) { const c = shift(iso, -i); if (isUSTradingDay(c)) return c; }
  throw new Error(`aucune séance dans les 10 jours avant ${iso}`);
}
const compact = iso => iso.replace(/-/g, '');

const P = paris(NOW);
// 22h30 Paris = après la clôture de New York (22h00 en heure d'été, 23h00 en
// heure d'hiver ⇒ marge). C'est la convention de date du repo, pas une
// invention : le dossier scanner du soir J porte la séance J+1.
const AFTER_CLOSE = P.minutes >= 22 * 60 + 30;
// La clôture la plus récente réellement disponible.
const REFDATE = (AFTER_CLOSE && isUSTradingDay(P.date)) ? P.date : prevUSTradingDay(P.date);
// La séance visée : celle qui suit la dernière clôture connue.
const SESSION = nextUSTradingDay(REFDATE);

const R = (o) => o; // lisibilité des retours

// ── Le gate reste la source unique des cadences ─────────────────────────────
// On l'appelle en sous-processus plutôt que d'importer sa table : deux copies
// d'une cadence finissent toujours par diverger, et c'est la copie oubliée qui
// publie deux fois.
// Le gate est désigné par un chemin ABSOLU dérivé de ce fichier : desk-plan doit
// donner la même réponse quel que soit le répertoire d'où on l'appelle.
const GATE = path.join(__dirname, 'publication-gate.js');
const gateCache = new Map();
// `trigger` : identité de l'événement qui rend le produit dû (voir --trigger du
// gate). Sur les produits événementiels, c'est LUI qui fait l'anti-doublon, pas
// l'horloge — deux jours déclencheurs consécutifs sont deux notes distinctes.
function gate(type, trigger) {
  const key = trigger ? `${type}\u0000${trigger}` : type;
  if (gateCache.has(key)) return gateCache.get(key);
  const args = [GATE, '--check', type, '--json'];
  if (trigger) args.push('--trigger', trigger);
  let out;
  try {
    out = execFileSync(process.execPath, args,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // exit 1 = « ne pas publier » : c'est une réponse, pas une panne. Le JSON est
    // sur stdout dans les deux cas.
    out = (e.stdout || '').toString();
    if (!out.trim()) { console.error(`[desk-plan] gate injoignable pour « ${type} » : ${e.message}`); process.exit(2); }
  }
  const r = JSON.parse(out);
  gateCache.set(key, r);
  // L'assemblage relit gateCache PAR TYPE pour publier cadence_h et détecter les
  // cadences à 0. Sans cette seconde clé, un produit interrogé uniquement avec un
  // déclencheur sortait avec cadence_h = null et échappait au contrôle.
  if (!gateCache.has(type)) gateCache.set(type, r);
  return r;
}
// SEULS les motifs web ont leur place ici. Joindre `reasons` en bloc faisait
// afficher « matérialité non fournie » comme raison pour laquelle un daily
// n'était pas dû — un motif d'email, sans rapport avec la décision de produire,
// et qui laisse croire que /desk a envisagé d'en envoyer un.
const webReason = g => (g.web_reasons && g.web_reasons.length ? g.web_reasons : g.reasons).join(' · ');

// ── Lectures de disque ──────────────────────────────────────────────────────
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };
const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
function nonEmptyJSON(p) {
  const d = readJSON(p);
  if (!d) return false;
  if (Array.isArray(d)) return d.length > 0;
  return Object.keys(d).length > 0;
}
function dailyAlreadyIndexed(yyyymmdd) {
  // data/daily.json est un tableau de cartes HTML ; l'URL y est le seul identifiant
  // stable. C'est le même test anti-doublon que celui imposé par CLAUDE.md avant
  // tout add_card.js.
  const raw = (() => { try { return fs.readFileSync('data/daily.json', 'utf8'); } catch { return ''; } })();
  return raw.includes(`/daily/${yyyymmdd}/`);
}

// Socle éventuel : seules les décisions CONDITIONNÉES À LA DONNÉE en dépendent
// (densité de saison des résultats, événement macro de tier 1). Tant qu'il
// n'est pas là, ces produits sortent en « pending », jamais en « due » par
// défaut — décider sans la donnée serait exactement le travers qu'on corrige.
const socle = SOCLE_DIR ? {
  earnings: readJSON(path.join(SOCLE_DIR, 'earnings_all_7d.json')),
  events: readJSON(path.join(SOCLE_DIR, 'economic_events.json')),
} : null;

// Le socle ne rend pas UNE forme mais trois, et itemsOf n'en lisait que deux :
//   a) { items|events|earnings|calendar: [...] }        — outils « métier »
//   b) [ … ]                                            — liste nue
//   c) { results:[ { data:["date,time,event,…", "2026-08-12,…", …] } ] }
// (c) est la forme de QueryData, donc celle de `economic_events` — le seul
// fournisseur du déclencheur macro. itemsOf renvoyait [] pour elle : evalMacro
// n'a jamais pu se déclencher UNE SEULE FOIS et annonçait « aucun événement de
// tier 1 » avec le CPI du 12/08 écrit en toutes lettres dans le fichier qu'il
// venait de lire. Un motif faux est pire qu'une erreur : il rassure.
function csvToObjects(rows) {
  const lines = rows.filter(r => typeof r === 'string' && r.trim());
  if (lines.length < 2) return [];   // en-tête seul = zéro ligne, pas une erreur
  const head = lines[0].split(',').map(s => s.trim());
  return lines.slice(1).map(l => {
    const cells = l.split(',');
    const o = {};
    head.forEach((h, i) => { o[h] = (cells[i] || '').trim(); });
    // La colonne CSV s'appelle « event » ; les formes objet utilisent « name ».
    // L'alias est posé ICI, une fois, plutôt qu'éparpillé en `|| e.event` chez
    // chaque lecteur — c'est ce genre de dispersion qui laisse un lecteur derrière.
    if (o.event && !o.name) o.name = o.event;
    return o;
  });
}
function itemsOf(d) {
  if (!d) return [];
  const box = d.data || d;
  if (Array.isArray(box.results)) {
    const out = [];
    for (const r of box.results) {
      const rows = r && r.data;
      if (!Array.isArray(rows)) continue;
      // QueryData rend soit du CSV brut (lignes = chaînes), soit des objets.
      out.push(...(rows.every(x => typeof x === 'string') ? csvToObjects(rows) : rows));
    }
    return out;
  }
  return box.items || box.events || box.earnings || box.calendar || (Array.isArray(box) ? box : []);
}
function flat(items) {
  // Les réponses marketdata emboîtent tantôt une liste plate, tantôt
  // { items: [ { candidates|events: [...] } ] }. On aplatit sans supposer.
  const out = [];
  for (const it of items) {
    if (it && typeof it === 'object' && Array.isArray(it.events)) out.push(...it.events);
    else if (it && typeof it === 'object' && Array.isArray(it.candidates)) out.push(...it.candidates);
    else out.push(it);
  }
  return out;
}

// ── Détecteur de dérive de schéma ───────────────────────────────────────────
// Un filtre qui rejette 100 % d'une entrée NON VIDE parce que le champ qu'il lit
// n'existe sur AUCUN élément ne rend pas un résultat : il rend un motif faux.
// C'est ce qui a tenu « earnings » à zéro sans que personne ne le voie — le socle
// écrit `market_cap_b` (en MILLIARDS), le filtre lisait `market_cap`, la densité
// valait donc toujours 0 et le plan affichait « densité insuffisante » comme si
// c'était la saison qui était creuse. Le contrôle des cadences orphelines ne
// pouvait rien y voir : il compare des NOMS, pas la capacité d'un évaluateur à
// renvoyer `due`. Celui-ci compare le champ LU au champ PRÉSENT.
const schemaGaps = [];
function requireFields(label, items, groups) {
  if (!items.length) return;   // entrée vide = absence de données, pas une dérive
  const seen = new Set();
  for (const it of items) {
    if (it && typeof it === 'object') for (const k of Object.keys(it)) seen.add(k);
  }
  for (const g of groups) {
    if (g.some(f => seen.has(f))) continue;
    schemaGaps.push(`« ${label} » : ${items.length} élément(s) collecté(s), mais aucun ne porte de champ `
      + `${g.map(f => `« ${f} »`).join(' ou ')}. Le filtre lit un champ que la donnée n'a pas — c'est une `
      + `dérive de schéma, pas une absence de données, et le motif affiché plus haut est donc faux.`);
  }
}

// ── Les produits ────────────────────────────────────────────────────────────
// Chaque entrée renvoie { due, reason } et, si due, de quoi l'exécuter.
// L'ordre du tableau EST l'ordre de publication : il fixe qui touche le registre
// en premier, donc qui a la première chance sur le quota email.

const EARNINGS_DENSITY_MIN = 8;      // sous ce seuil, un digest earnings n'a rien à dire
const EARNINGS_MIN_MCAP = 10e9;
const TIER1 = /\b(CPI|FOMC|FED|NFP|NON.?FARM|PCE|OPEC|OPEP|UNEMPLOYMENT|PAYROLL)\b/i;
const RETRO_LOOKBACK_DAYS = 60;      // au-delà, c'est de l'archéologie, pas une rétro

function evalScanner() {
  const dir = `scanner/${compact(SESSION)}`;
  if (!AFTER_CLOSE) return R({ due: false, reason: `il est ${P.hhmm} à Paris — la clôture de la séance visée n'existe pas encore (seuil 22h30)` });
  if (nonEmptyJSON(`${dir}/data.json`)) return R({ due: false, reason: `${dir}/data.json existe déjà et n'est pas vide` });
  const g = gate('scanner');
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  return R({
    due: true, reason: `séance ${SESSION} non scannée, cadence OK`,
    chain: 'V+D+T', artifacts: [`${dir}/index.html`],
    exec: ['bash tools/scan-parallel.sh ' + compact(SESSION) + ' ' + REFDATE + ' ' + SESSION,
           'bash tools/downstream-parallel.sh ' + compact(SESSION) + ' ' + SESSION],
    plans: ['scanner-wave1', 'scanner-wave2', 'scanner-dtx'],
  });
}

function evalSignals() {
  const g = gate('signals');
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  if (!isUSTradingDay(SESSION)) return R({ due: false, reason: `la séance suivante (${SESSION}) n'est pas ouvrée` });
  return R({
    due: true, reason: 'cadence OK et séance ouvrée',
    chain: 'S', plans: ['signals-desk'],
    // SEUL point d'arbitrage non déterministe de tout le plan, et il est petit :
    // quelles 2-3 familles de signaux ont un sens dans le régime du jour. Le
    // script ne peut pas le trancher, le barème n'existe pas.
    llm: 'sélection de 2 à 3 familles (swing / squeeze / earnings / rotation / macro) au vu du régime live, avec la raison écrite',
  });
}

function evalDaily() {
  const day = compact(P.date);
  if (dailyAlreadyIndexed(day)) return R({ due: false, reason: `daily ${day} déjà indexé dans data/daily.json` });
  const g = gate('daily');
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  // Le jour de la semaine n'est pas une décision, c'est une lecture de calendrier.
  const variant = P.dow === 6 ? 'bilan hebdomadaire' : P.dow === 0 ? 'crypto + géopolitique' : 'briefing de séance';
  return R({
    due: true, reason: `aucun daily pour ${day}, cadence OK`,
    chain: 'S+O', plans: ['daily'], variant,
    artifacts: [`daily/${day}/index.html`],
  });
}

function evalWeekly() {
  // La cadence 144 h est une barrière anti-doublon, PAS un déclencheur. Le vrai
  // déclencheur est calendaire : le weekly couvre la semaine À VENIR, donc il se
  // produit du vendredi au dimanche pour le lundi suivant. Un weekly daté du
  // lundi écoulé est un bug que la cadence seule ne rattrape pas.
  if (![5, 6, 0].includes(P.dow)) return R({ due: false, reason: 'le weekly se produit du vendredi au dimanche, pour la semaine à venir' });
  let monday = shift(P.date, 1);
  for (let i = 0; i < 8 && new Date(monday + 'T12:00:00Z').getUTCDay() !== 1; i++) monday = shift(monday, 1);
  const dir = `weekly/${compact(monday)}`;
  if (exists(`${dir}/index.html`)) return R({ due: false, reason: `${dir}/index.html existe déjà` });
  const g = gate('weekly');
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  return R({ due: true, reason: `semaine du ${monday} non couverte`, chain: 'S', plans: ['weekly'],
             artifacts: [`${dir}/index.html`], vars: { monday } });
}

function evalRetro() {
  // Déclencheur ÉVÉNEMENTIEL, pas calendaire : une rétro est due quand l'horizon
  // d'un scan est ÉCOULÉ, pas quand six jours ont passé. La cadence ne fait que
  // borner la fréquence.
  const g = gate('retro');
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  let dirs = [];
  try { dirs = fs.readdirSync('scanner').filter(d => /^\d{8}$/.test(d)).sort(); } catch { /* pas de scanner/ */ }
  const floor = compact(shift(P.date, -RETRO_LOOKBACK_DAYS));
  for (const d of dirs) {
    if (d < floor || d >= compact(P.date)) continue;
    if (exists(`scanner/${d}/retro/index.html`)) continue;
    const sig = readJSON(`scanner/${d}/signals.json`);
    const sigs = (sig && sig.signals) || [];
    if (!sigs.length) continue;
    const horizon = Math.max(...sigs.map(s => Number(s.horizon) || 10));
    // horizon en SÉANCES, pas en jours calendaires — sinon on clôt une rétro un
    // week-end trop tôt et les sorties sont fausses.
    let end = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
    for (let i = 0; i < horizon; i++) end = nextUSTradingDay(end);
    if (end >= P.date) continue;
    return R({
      due: true, reason: `scan ${d} : horizon de ${horizon} séances échu le ${end}, aucune rétro`,
      chain: 'S', plans: ['retro'], artifacts: [`scanner/${d}/retro/index.html`],
      vars: { scan: d, horizon_end: end },
      // La charnière qui produit $symbols depuis les signaux du scan clos n'existe
      // pas encore (équivalent d'extract-universe.js pour la rétro).
      blocker: exists('tools/extract-retro-symbols.js') ? null
        : 'tools/extract-retro-symbols.js manquant — sans lui, $symbols devrait être recopié à la main par le modèle, ce que la doctrine interdit',
    });
  }
  return R({ due: false, reason: 'aucun scan dont l\'horizon soit échu sans rétro' });
}

function evalRotation() {
  // Ancré sur un jour fixe (vendredi après clôture, ou le week-end) : un simple
  // compteur de 144 h dérive d'un jour par semaine et finit par tomber un mardi.
  if (!([5, 6, 0].includes(P.dow))) return R({ due: false, reason: 'la rotation se calcule sur la semaine close (vendredi après clôture au dimanche)' });
  if (P.dow === 5 && !AFTER_CLOSE) return R({ due: false, reason: 'vendredi avant clôture — la semaine n\'est pas close' });
  const g = gate('rotation');
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  return R({ due: true, reason: 'semaine close, cadence OK', chain: 'S', plans: ['rotation'] });
}

function evalEarnings() {
  const g = gate('earnings');
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  // Décision CONDITIONNÉE À LA DONNÉE : hors saison, produire un digest earnings
  // vide est exactement le « parce que c'est dans la liste » qu'on proscrit.
  if (!socle) return R({ due: false, pending: true, reason: 'densité de saison inconnue — à réévaluer une fois le socle collecté' });
  const lo = shift(P.date, -3), hi = shift(P.date, 3);
  const raw = flat(itemsOf(socle.earnings));
  requireFields('earnings', raw, [
    ['date', 'report_date', 'earnings_date'],
    ['market_cap', 'marketCap', 'market_cap_b', 'marketCapB'],
  ]);
  const rows = raw.filter(e => {
    const d = String(e.date || e.report_date || e.earnings_date || '').slice(0, 10);
    // L'UNITÉ fait partie du nom : le socle écrit `market_cap_b`, en MILLIARDS.
    // Lire `market_cap` seul renvoyait 0 pour TOUS les événements, donc une
    // densité éternellement nulle et un digest earnings qui ne pouvait jamais
    // être dû — 11 des 13 publications du 11/08 franchissaient le seuil.
    const mc = Number(e.market_cap || e.marketCap || 0)
            || Number(e.market_cap_b || e.marketCapB || 0) * 1e9;
    return d >= lo && d <= hi && mc >= EARNINGS_MIN_MCAP;
  });
  if (rows.length < EARNINGS_DENSITY_MIN) {
    return R({ due: false, reason: `densité insuffisante : ${rows.length} publication(s) > 10 Md$ à J±3, seuil ${EARNINGS_DENSITY_MIN}` });
  }
  return R({ due: true, reason: `${rows.length} publications > 10 Md$ à J±3`, chain: 'S', plans: [] });
}

function evalMacro() {
  // Événementiel pur : dû à J-1 d'un événement de tier 1. Le gate est interrogé
  // une première fois SANS déclencheur, uniquement pour que sa cadence entre dans
  // gateCache (config_gaps la lit) — son verdict n'est pas utilisé ici : sans nom
  // d'événement il ne saurait que comparer des horloges, et c'est précisément ce
  // qu'on ne veut pas comme barrière sur ce produit.
  gate('macro');
  if (!socle) return R({ due: false, pending: true, reason: 'calendrier économique non collecté — à réévaluer après le socle' });
  const target = shift(P.date, 1);
  const raw = flat(itemsOf(socle.events));
  requireFields('macro', raw, [
    ['date', 'event_date', 'datetime'],
    ['name', 'event', 'title'],
  ]);
  const hits = raw.filter(e => {
    const d = String(e.date || e.event_date || e.datetime || '').slice(0, 10);
    return d === target && TIER1.test(String(e.name || e.event || e.title || ''));
  });
  if (!hits.length) return R({ due: false, reason: `aucun événement de tier 1 le ${target}` });
  // Identité du déclencheur = date visée + jetons TIER1 retenus, triés. On prend
  // le JETON (CPI, FOMC…) et non le libellé complet : un intitulé qui change de
  // formulation d'un mois à l'autre produirait un déclencheur « neuf » pour le
  // même événement, donc un doublon. Le tri rend la chaîne stable entre deux runs.
  const tokens = [...new Set(hits.map(h => TIER1.exec(String(h.name || h.event || h.title))[1].toUpperCase()))].sort();
  const trigger = `${target}:${tokens.join('+')}`;
  const g = gate('macro', trigger);
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  return R({
    due: true, reason: `tier 1 le ${target} : ${hits.map(h => h.name || h.event || h.title).join(', ')}`,
    chain: 'S', plans: [], trigger, vars: { target },
    // Leçon macro-date-verify : le calendrier donne le jour, il ne donne ni
    // l'heure exacte ni le consensus. Les deux se vérifient avant d'écrire.
    llm: 'vérifier date ET consensus à la source avant toute production',
  });
}

// Calendrier FINRA : règlement le 15 du mois et le dernier jour ouvré, publication
// ~8 jours ouvrés plus tard. C'est une règle publique et déterministe — la calculer
// vaut mieux qu'une table en dur qui pourrit au changement d'année.
function finraWindow(iso) {
  const [y, m] = iso.split('-').map(Number);
  const back = d => { while (!isUSTradingDay(d)) d = shift(d, -1); return d; };
  const eom = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const settlements = [back(`${iso.slice(0, 7)}-15`), back(eom),
                       back(new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10))];
  for (const s of settlements) {
    let pub = s;
    for (let i = 0; i < 8; i++) pub = nextUSTradingDay(pub);
    let close = pub;
    for (let i = 0; i < 3; i++) close = nextUSTradingDay(close);
    if (iso >= pub && iso <= close) return { settlement: s, published: pub, window_end: close };
  }
  return null;
}

function evalSqueeze() {
  gate('squeeze');   // pour cadence_h / config_gaps — verdict non utilisé, cf. evalMacro
  const w = finraWindow(P.date);
  if (!w) return R({ due: false, reason: 'hors fenêtre de publication FINRA (règlement bimensuel + ~8 séances)' });
  // La DATE DE RÈGLEMENT est l'identité naturelle de la donnée : les ~7 jours
  // d'une même fenêtre la partagent, et deux fenêtres consécutives ne la
  // partagent jamais. Une horloge, elle, ne peut pas couvrir les 7 jours sans
  // risquer de mordre sur la publication FINRA suivante, qui est une donnée neuve.
  const trigger = `finra:${w.settlement}`;
  const g = gate('squeeze', trigger);
  if (!g.publish_web) return R({ due: false, reason: webReason(g) });
  return R({
    due: true, reason: `données FINRA du ${w.settlement} publiées le ${w.published}`,
    chain: 'S', plans: ['squeeze'], vars: w, trigger,
    blocker: 'plans/squeeze.json exige $symbols et aucune charnière ne le produit — vivier à fournir avant lancement',
  });
}

const PRODUCTS = [
  // L'ordre est l'ordre de publication. Le scanner d'abord parce qu'il porte la
  // séance imminente ; le reste par décroissance d'urgence.
  ['scanner', evalScanner], ['daily', evalDaily], ['signals', evalSignals],
  ['weekly', evalWeekly], ['rotation', evalRotation], ['retro', evalRetro],
  ['earnings', evalEarnings], ['macro', evalMacro], ['squeeze', evalSqueeze],
];

// Produits volontairement HORS exécution automatique. Les exclure ici, en dur,
// plutôt que de compter sur une cadence : `analyse` a une cadence de 0, donc rien
// ne l'empêcherait mécaniquement de sortir cinq fois dans la journée.
const EXCLUDED = [
  ['analyse', 'à la demande uniquement — /desk ne déclenche jamais une analyse de son propre chef'],
  ['series', 'workflow dédié par série, hors périmètre'],
  ['run-session', 'touche l\'exécution broker : aucune exécution broker dans un pipeline autonome'],
  ['make-video', 'règle No Auto Video — jamais sans demande explicite dans la session courante'],
];
const PROPOSED = [
  ['aplus', 'cohorte mensuelle : ~10 analyses profondes, chacune avec sa war room. /desk le PROPOSE, il ne le lance pas.'],
];

// ── Mutualisation : ce que le socle économise réellement ────────────────────
function mutualisation(dueTypes) {
  const socles = ['plans/socle.json', 'plans/socle-overview.json']
    .map(p => readJSON(p)).filter(Boolean);
  const covers = new Map();
  for (const s of socles) for (const w of s.waves || []) for (const c of w.calls || []) {
    for (const name of (c.covers || [c.as])) covers.set(name, { as: c.as, server: c.server, tool: c.tool });
  }
  const detail = [], missed = [];
  let saved = 0;
  for (const t of dueTypes) {
    for (const planName of (t.plans || [])) {
      const p = readJSON(`plans/${planName}.json`);
      if (!p) continue;
      for (const w of p.waves || []) for (const c of w.calls || []) {
        const hit = covers.get(c.as);
        if (hit && hit.server === c.server && hit.tool === c.tool) { saved++; detail.push(`${planName}.${c.as} ← socle.${hit.as}`); }
        else if (hit) missed.push(`${planName}.${c.as} : même nom, outil différent (${c.server}.${c.tool} ≠ ${hit.server}.${hit.tool}) — rappelé`);
      }
    }
  }
  return { covered_names: covers.size, calls_saved: saved, detail, mismatches: missed };
}

// ── Assemblage ──────────────────────────────────────────────────────────────
const due = [], skipped = [], pending = [];
for (const [type, fn] of PRODUCTS) {
  if (ONLY.size && !ONLY.has(type)) { skipped.push({ type, reason: '--only : hors sélection' }); continue; }
  if (SKIP.has(type)) { skipped.push({ type, reason: '--skip explicite' }); continue; }
  let r;
  try { r = fn(); } catch (e) { r = { due: false, reason: `évaluation impossible : ${e.message}` }; }
  const g = gateCache.get(type);
  const entry = {
    type, reason: r.reason, chain: r.chain || null, plans: r.plans || [],
    artifacts: r.artifacts || [], vars: r.vars || {}, variant: r.variant || null,
    llm: r.llm || null, blocker: r.blocker || null,
    // Le déclencheur DOIT ressortir dans le plan : il est l'identité que le
    // `--record` de fin de course devra recopier. Enregistré sans lui, le produit
    // repasse dû demain pour le même événement.
    trigger: r.trigger || null,
    cadence_h: g ? g.cadence_h : null,
    // Distribution : ce que /desk a le droit de faire de ce produit. send_email
    // est FAUX ici par construction — voir l'en-tête.
    distribution: r.due ? { web: true, substack: { lang: 'en', send_email: false }, telegram: { lang: 'fr', format: 'html' } } : null,
  };
  if (r.pending) pending.push(entry);
  else if (r.due) due.push(entry);
  else skipped.push(entry);
}

// Trou de configuration : une cadence à 0 sur un type que /desk peut produire
// signifie que le gate dira toujours oui. Ce n'est pas une autorisation, c'est
// une barrière absente — il faut le DIRE, pas s'en accommoder.
const configGaps = [];
for (const [type] of PRODUCTS) {
  const g = gateCache.get(type);
  if (g && g.cadence_h === 0) configGaps.push(`« ${type} » absent de CADENCE_H dans publication-gate.js — aucune barrière de cadence, seul le déclencheur événementiel de desk-plan le retient`);
}
// Le trou SYMÉTRIQUE : une cadence déclarée dans publication-gate.js que
// personne ne produit. C'est le cas qu'a occupé « insiders » — 20 h de cadence,
// zéro producteur — et il était détecté par un test en dur sur un seul nom, qui
// n'aurait rien vu du suivant. On énumère donc la table réelle du gate (via
// --cadences, jamais une copie) et on la confronte à ce que /desk connaît :
// produits, exclusions assumées, propositions. Ce qui n'est dans aucun des trois
// est une cadence orpheline, et une cadence qui garde une porte inexistante
// n'est pas une sécurité, c'est une affirmation fausse dans la config.
const KNOWN_TYPES = new Set([
  ...PRODUCTS.map(([t]) => t), ...EXCLUDED.map(([t]) => t), ...PROPOSED.map(([t]) => t),
]);
try {
  const declared = JSON.parse(execFileSync(process.execPath, [GATE, '--cadences', '--json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  for (const { type, cadence_h } of declared) {
    if (KNOWN_TYPES.has(type)) continue;
    configGaps.push(`« ${type} » a une cadence de ${cadence_h} h dans publication-gate.js mais /desk ne connaît aucun produit de ce nom (ni PRODUCTS, ni EXCLUDED, ni PROPOSED). Une cadence qui pointe vers rien est un mensonge dans la config : écrire le producteur, ou retirer la clé.`);
  }
} catch (e) {
  // Un gate trop ancien pour connaître --cadences ne doit pas faire tomber le
  // plan : on perd ce contrôle-là, on le dit, le reste continue.
  configGaps.push(`contrôle des cadences orphelines impossible : publication-gate.js --cadences a échoué (${e.message.split('\n')[0]})`);
}
// Les dérives de schéma relevées pendant l'évaluation sont des trous de config au
// même titre : une cadence orpheline garde une porte qui n'existe pas, un filtre
// inopérant ferme une porte qui existe. Les deux sont des affirmations fausses.
configGaps.push(...schemaGaps);

const plan = {
  generated_at: NOW.toISOString(),
  now_paris: `${P.date} ${P.hhmm}`,
  after_close: AFTER_CLOSE,
  reference_close: REFDATE,     // $refdate — dernière clôture réellement disponible
  session: SESSION,             // $asof — la séance visée
  session_compact: compact(SESSION),
  socle: {
    plan: 'plans/socle.json',
    overview_plan: 'plans/socle-overview.json',
    out: `data/desk/${compact(P.date)}/_socle`,
    resolved: !!socle,
    ...mutualisation(due),
  },
  due, pending, skipped,
  proposed: PROPOSED.map(([type, reason]) => ({ type, reason })),
  excluded: EXCLUDED.map(([type, reason]) => ({ type, reason })),
  config_gaps: configGaps,
  email_policy: {
    default: 'send_email=false',
    rule: 'aucun email n\'est autorisé par ce plan. Autorisation séparée, après le panel, sous verrou : bash tools/desk-run.sh --authorize-email <type> --materiality N',
    quota: '1 email / 24 h, TOUS types confondus (publication-gate.js)',
  },
};

if (OUT_FILE) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(plan, null, 2));
}

if (has('--json')) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  const pad = s => String(s).padEnd(10);
  console.log(`\n  desk-plan — ${plan.now_paris} Paris${AFTER_CLOSE ? ' (après clôture)' : ''}`);
  console.log(`  clôture de référence ${REFDATE} · séance visée ${SESSION}\n`);
  console.log(`  À PRODUIRE (${due.length})`);
  if (!due.length) console.log('    — rien. C\'est un résultat valide, pas une panne.');
  for (const d of due) {
    console.log(`    ${pad(d.type)} ${d.reason}${d.variant ? ` [${d.variant}]` : ''}`);
    // Affiché avec la commande exacte : un déclencheur qu'on doit reconstituer de
    // tête finit par être recopié de travers, et un déclencheur de travers ne
    // bloque pas le doublon de demain.
    if (d.trigger) console.log(`               ↳ à l'enregistrement : --record ${d.type} --channels web --trigger ${d.trigger}`);
    if (d.llm) console.log(`               ↳ modèle : ${d.llm}`);
    if (d.blocker) console.log(`               ⚠ BLOQUANT : ${d.blocker}`);
  }
  if (pending.length) {
    console.log(`\n  EN ATTENTE DU SOCLE (${pending.length})`);
    for (const d of pending) console.log(`    ${pad(d.type)} ${d.reason}`);
  }
  console.log(`\n  ÉCARTÉ (${skipped.length})`);
  for (const d of skipped) console.log(`    ${pad(d.type)} ${d.reason}`);
  console.log(`\n  PROPOSÉ, NON LANCÉ`);
  for (const d of plan.proposed) console.log(`    ${pad(d.type)} ${d.reason}`);
  console.log(`\n  SOCLE  ${plan.socle.calls_saved} appel(s) mutualisé(s) sur ${plan.socle.covered_names} nom(s) couverts`);
  for (const x of plan.socle.detail) console.log(`    · ${x}`);
  for (const x of plan.socle.mismatches) console.log(`    ⚠ ${x}`);
  if (configGaps.length) {
    console.log(`\n  TROUS DE CONFIG`);
    for (const x of configGaps) console.log(`    ⚠ ${x}`);
  }
  console.log(`\n  EMAIL  ${plan.email_policy.default} — ${plan.email_policy.quota}`);
  console.log(`         ${plan.email_policy.rule}\n`);
}

// Code de sortie = « y a-t-il quelque chose à faire ». 0 = oui, 10 = non.
// Volontairement PAS 1 : « rien à produire » est un succès, pas une erreur, et
// desk-run.sh doit pouvoir distinguer les deux sous `set -e`.
//
// `pending` compte AUTANT que `due`. Un produit en attente du socle n'est pas un
// produit écarté : c'est un produit dont l'éligibilité se décide sur une donnée
// qu'on n'a pas encore collectée. Ne compter que `due` rendait ces produits
// INATTEIGNABLES dès que rien d'autre n'était dû — le run sortait en 10, le socle
// n'était jamais collecté, et la réévaluation d'après-socle n'avait jamais lieu.
// Mesuré le 11/08 à 23h49 : `macro` était dû par son déclencheur (CPI le 12 à
// 08h30) et le pipeline s'est arrêté avant d'aller le vérifier. Un déclencheur
// événementiel qui ne se déclenche jamais est pire qu'un déclencheur absent : il
// donne l'illusion d'une couverture.
process.exit(due.length || pending.length ? 0 : 10);
