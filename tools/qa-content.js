#!/usr/bin/env node
/**
 * qa-content.js — QA pré-publication pour le CONTENU éditorial
 *
 * Complète tools/qa-check.js (qui couvre le SCANNER). Ce validateur cible les
 * articles rédigés : analyses ticker, briefings quotidiens, revues hebdomadaires.
 * Structurel / déterministe uniquement — AUCUN appel réseau/MCP (voir §FACT-CHECK).
 *
 * Défauts récurrents ciblés (leçons memory/feedback + conventions CLAUDE.md) :
 *   - HTML cassé : brand-nav manquant, mauvais footer, GTM absent, scripts manquants
 *   - ticker-header : classes metric-value au lieu de tm-value/tm-label (règle 14 CRITIQUE)
 *   - Trade Idea absent sur une analyse
 *   - placeholders d'hallucination : XX, TODO, N/A, undefined, $0.00, [52W], NaN
 *   - accents FR corrompus (mojibake Ã©) ou absents
 *   - daily : section portfolio interdite, CSS inline hors ECharts, sections manquantes
 *   - weekly : 18 sections, FAB, footer
 *   - mixage ApexCharts + ECharts, marqueurs de template résiduels
 *
 * FACT-CHECK (SÉPARÉ) : la véracité des chiffres (52W, cash, market cap) est un
 * contrôle RUNTIME via MCP DailyTickers — voir le hook `factCheckHook()` en bas.
 * Ce fichier ne fait QUE du structurel. Ne jamais appeler MCP ici.
 *
 * Usage :
 *   node tools/qa-content.js <path>            # 1 article (fichier ou dossier)
 *   node tools/qa-content.js analyses/TARA     # dossier → index.html
 *   node tools/qa-content.js                   # newest daily + weekly + analyse
 *   node tools/qa-content.js --all             # sweep TOUS les articles
 *   node tools/qa-content.js --type analyse    # newest du type donné
 *   node tools/qa-content.js <path> --strict   # exit 1 si erreurs (gate CI/cron)
 *   node tools/qa-content.js <path> --json      # sortie JSON machine-lisible
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARGV = process.argv.slice(2);
const STRICT = ARGV.includes('--strict');
const ALL = ARGV.includes('--all');
const JSON_OUT = ARGV.includes('--json');
const typeFlag = (() => { const i = ARGV.indexOf('--type'); return i >= 0 ? ARGV[i + 1] : null; })();
const positional = ARGV.filter((a, i) => !a.startsWith('--') && ARGV[i - 1] !== '--type');

// Seuils de taille par type (bytes) — sous ce seuil = tronqué / sections manquantes
const SIZE_MIN = { analyse: 10 * 1024, daily: 30 * 1024, weekly: 100 * 1024 };

// ─── Résultats par fichier ───────────────────────────────────────────────────
function newResult(file, type) {
  return { file, type, errors: [], warnings: [], ok: [] };
}
function mkCheck(res, kind) {
  return (label, fn) => {
    try {
      const r = fn();
      if (r === true || r === undefined) res.ok.push(label);
      else if (typeof r === 'string') res[kind].push(`${label}: ${r}`);
    } catch (e) {
      res[kind].push(`${label}: ${e.message}`);
    }
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function resolveTarget(p) {
  let full = path.isAbsolute(p) ? p : path.join(ROOT, p);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) full = path.join(full, 'index.html');
  return full;
}
function detectType(html, file) {
  const m = html.match(/<html[^>]*\bdata-tab="([^"]+)"/);
  const tab = m ? m[1] : '';
  if (tab === 'analyses' || /\/analyses\//.test(file)) return 'analyse';
  if (tab === 'daily' || /\/daily\//.test(file)) return 'daily';
  if (tab === 'weekly' || /\/weekly\//.test(file)) return 'weekly';
  return 'analyse';
}
function newestDir(base, filter) {
  const dir = path.join(ROOT, base);
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir)
    .filter(d => (filter ? filter(d) : true))
    .map(d => path.join(dir, d, 'index.html'))
    .filter(f => fs.existsSync(f))
    .map(f => ({ f, m: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return entries.length ? entries[0].f : null;
}
// Extrait le bloc ticker-header (jusqu'à la fin des metrics) pour un scan scopé
function tickerHeaderBlock(html) {
  const i = html.indexOf('ticker-header');
  if (i < 0) return '';
  return html.slice(i, i + 3000);
}
// Extrait les valeurs tm-value (texte, tags strippés) pour la détection de placeholders.
// `scope` limite au bloc ticker-header (hero) — là où une métrique vide = vraie hallucination.
// Dans les tables secondaires (anti-dilution), "N/A" peut être légitime → hors scope.
function tmValues(scope) {
  const out = [];
  const re = /class="tm-value"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(scope))) {
    const text = m[1].replace(/<[^>]+>/g, '').trim(); // strip nested badges/spans
    out.push(text);
  }
  return out;
}
// Détecte le mot "Placeholder" résiduel (aligné sur validate-article.js CQG-007
// `\bPLACEHOLDER\b`). On SCRUBE d'abord les usages LÉGITIMES pour éviter les faux
// positifs : classes CSS (`variant-switcher-placeholder`), attributs de formulaire
// (`placeholder="Rechercher"`) et pseudo-élément (`::placeholder`). Ce qui reste =
// texte/commentaire de template laissé en place (ex: `// Placeholder for ECharts…`).
function residualPlaceholders(html) {
  const scrubbed = html
    .replace(/class="[^"]*"/gi, '')            // classes CSS (ex: *-placeholder)
    .replace(/placeholder\s*=\s*"[^"]*"/gi, '') // attribut input placeholder="…"
    .replace(/placeholder\s*=\s*'[^']*'/gi, '')
    .replace(/::placeholder/gi, '');            // pseudo-élément CSS
  return scrubbed.match(/\bplaceholder\b/gi) || [];
}
// Compte les appels echarts.init() RÉELS (hors commentaires HTML/JS). Un bloc d'init
// entièrement commenté (ex: MSFT `// Placeholder for ECharts…` + `// var c = echarts.init(…)`)
// donne realInit=0 alors que la lib est chargée → charts vides.
function realEchartsInit(html) {
  const s = html
    .replace(/<!--[\s\S]*?-->/g, '')            // commentaires HTML
    .replace(/\/\*[\s\S]*?\*\//g, '')           // commentaires JS bloc
    .replace(/([^:]|^)\/\/[^\n]*/g, '$1');       // commentaires JS ligne (préserve les URLs ://)
  return (s.match(/echarts\.init\s*\(/g) || []).length;
}
// Conteneurs-cibles ECharts ORPHELINS = divs `<div id="…chart…">` déclarés dans le
// markup mais dont l'id n'est JAMAIS référencé ailleurs (aucun getElementById('x'),
// aucun `initEC('x', …)`, aucune règle CSS) → le graphe n'est jamais rendu = boîte vide.
//
// On NE compte PAS bêtement (cibles vs echarts.init) : le pattern helper sain
//   `function initEC(id){ echarts.init(getElementById(id)); }` puis 8× `initEC('xChart', …)`
// n'a qu'UN seul `echarts.init` textuel pour 8 graphes valides (weekly = faux positif).
// La référence de l'id est le signal fiable : id présent 1 seule fois = orphelin.
// On exclut les ids non-tracés (modal/title/body/links/header/footer/legend/label).
function orphanChartIds(html) {
  const declared = [];
  const re = /\bid="([a-z0-9_-]*chart[a-z0-9_-]*)"/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!/modal|title|body|links|header|footer|legend|label/i.test(m[1])) declared.push(m[1]);
  }
  const orphans = [];
  for (const id of new Set(declared)) {
    const refs = (html.match(new RegExp('\\b' + id.replace(/[-]/g, '\\-') + '\\b', 'g')) || []).length;
    if (refs <= 1) orphans.push(id); // seule la déclaration du div, aucune référence JS/CSS
  }
  return orphans;
}

// ─── Suite de checks ─────────────────────────────────────────────────────────
function validate(file) {
  if (!fs.existsSync(file)) {
    const res = newResult(file, '?');
    res.errors.push(`fichier introuvable`);
    return res;
  }
  const html = fs.readFileSync(file, 'utf8');
  const type = detectType(html, file);
  const res = newResult(file, type);
  const check = mkCheck(res, 'errors');
  const warn = mkCheck(res, 'warnings');
  const size = fs.statSync(file).size;
  const rel = path.relative(ROOT, file);
  const htmlTag = (html.match(/<html[^>]*>/) || [''])[0];
  const lang = (htmlTag.match(/\blang="([^"]+)"/) || [, ''])[1];

  // ── COMMUN : taille ──
  check('taille suffisante (non tronqué)', () => {
    const min = SIZE_MIN[type] || 10 * 1024;
    if (size < min) return `${Math.round(size / 1024)}KB < ${Math.round(min / 1024)}KB (${type}) — article tronqué ou sections manquantes`;
  });

  // ── COMMUN : balise <html> ──
  check('<html> a lang + data-tags + data-tab', () => {
    if (!htmlTag) return 'balise <html> absente';
    const miss = [];
    if (!/\blang="/.test(htmlTag)) miss.push('lang');
    if (!/\bdata-tags="/.test(htmlTag)) miss.push('data-tags');
    if (!/\bdata-tab="/.test(htmlTag)) miss.push('data-tab');
    if (miss.length) return `attribut(s) manquant(s): ${miss.join(', ')}`;
  });
  check('data-tab cohérent avec le type de dossier', () => {
    const expected = { analyse: 'analyses', daily: 'daily', weekly: 'weekly' }[type];
    const m = htmlTag.match(/\bdata-tab="([^"]+)"/);
    if (m && m[1] !== expected) return `data-tab="${m[1]}" mais dossier = ${type} (attendu "${expected}")`;
  });

  // ── COMMUN : brand-bar + nav ──
  check('brand-bar + brand-nav présents', () => {
    if (!/class="brand-bar"/.test(html)) return 'nav.brand-bar absent';
    if (!/class="brand-nav"/.test(html)) return 'div.brand-nav absent (menu principal)';
  });
  check('pas de class="active" en dur sur brand-nav', () => {
    // le lien actif est auto-highlight via CSS data-tab
    const nav = (html.match(/class="brand-nav"[\s\S]{0,400}?<\/div>/) || [''])[0];
    if (/<a[^>]*class="[^"]*\bactive\b/.test(nav)) return 'lien brand-nav avec class="active" en dur (doit être auto via CSS)';
  });

  // ── COMMUN : footer ──
  check('footer = article-footer (pas report-footer/site-footer)', () => {
    if (/class="(report-footer|site-footer|page-footer)"/.test(html)) return 'classe footer interdite détectée';
    if (!/class="article-footer"/.test(html)) return 'footer.article-footer absent';
  });

  // ── COMMUN : GTM + scripts ──
  check('GTM-T5Z595CW présent', () => {
    if (!html.includes('GTM-T5Z595CW')) return 'tag GTM absent — page non trackée';
  });
  check('scripts core.js + tag-renderer.js présents', () => {
    const miss = [];
    if (!/assets\/core\.js/.test(html)) miss.push('core.js');
    if (!/assets\/tag-renderer\.js/.test(html)) miss.push('tag-renderer.js');
    if (miss.length) return `script(s) manquant(s): ${miss.join(', ')}`;
  });
  check('tags cliquables (#article-clickable-tags) présents', () => {
    if (!/id="article-clickable-tags"/.test(html)) return 'conteneur #article-clickable-tags absent (tags non rendus)';
  });

  // ── COMMUN : intégrité HTML (heuristique) ──
  check('structure HTML fermée (html/body)', () => {
    const miss = [];
    if (!/<html/i.test(html)) miss.push('<html>');
    if (!/<\/html>/i.test(html)) miss.push('</html>');
    if (!/<body/i.test(html)) miss.push('<body>');
    if (!/<\/body>/i.test(html)) miss.push('</body>');
    if (miss.length) return `balise(s) non fermée(s)/absente(s): ${miss.join(', ')} — HTML tronqué`;
  });
  // NB: pas de check <h1> — la convention varie par type (analyses utilisent
  // .ticker-symbol comme titre, le gold standard TARA a 0 <h1>). Non fiable.

  // ── COMMUN : marqueurs de template résiduels ──
  check('pas de marqueur de template non substitué', () => {
    const hits = [];
    if (/\{\{[^}]{1,40}\}\}/.test(html)) hits.push('{{...}}');
    if (/\{(Titre|Date|Ticker|TICKER|Jour|Édition|Edition|Nom)[^}]{0,30}\}/.test(html)) hits.push('{Placeholder}');
    if (/\b(TODO|FIXME|LOREM IPSUM|lorem ipsum|XXXXX)\b/.test(html)) hits.push('TODO/lorem/XXXXX');
    if (/__[A-Z_]{3,}__/.test(html)) hits.push('__PLACEHOLDER__');
    if (hits.length) return hits.join(', ');
  });

  // ── COMMUN : texte "Placeholder" résiduel (parité validate-article CQG-007) ──
  // Le validateur historique bloque `\bPLACEHOLDER\b` — qa-content le manquait
  // (ex: MSFT `// Placeholder for ECharts initialization scripts`). Scopé pour ignorer
  // les classes CSS / attributs de formulaire → zéro faux positif sur le contenu sain.
  check('pas de texte "Placeholder" résiduel (commentaire/template)', () => {
    const hits = residualPlaceholders(html);
    if (hits.length) return `${hits.length} occurrence(s) du mot "Placeholder" hors classe/attribut — bloc de template laissé en place`;
  });

  // ── COMMUN : valeurs cassées visibles ──
  check('pas de valeur cassée visible (undefined/NaN/null/[object Object])', () => {
    const bad = html.match(/>\s*(undefined|NaN|\[object Object\])\s*</g) || [];
    // ">null<" est fréquent en légende légitime ? Non — flag aussi.
    const nulls = html.match(/>\s*null\s*</g) || [];
    const n = bad.length + nulls.length;
    if (n) return `${n} occurrence(s) de valeur brute JS dans le contenu visible`;
  });

  // ── COMMUN : encodage accents ──
  check('pas de mojibake (accents corrompus)', () => {
    const m = html.match(/Ã©|Ã¨|Ã |Ã´|Ã®|Ã¢|Ã§|â€™|â€œ|â€|Â«|Â»/g) || [];
    if (m.length) return `${m.length} séquence(s) mojibake (fichier mal ré-encodé — sauver en UTF-8)`;
  });
  warn('contenu accentué présent (doc FR)', () => {
    if (lang !== 'fr') return;
    if (!/[éèàêôûçîœ]/.test(html) && !/&(eacute|egrave|agrave|ecirc|ccedil|ocirc);/.test(html)) {
      return 'aucun accent détecté dans un doc lang="fr" (accents strippés ?)';
    }
  });

  // ── COMMUN : pas de mixage de libs de charts ──
  check('pas de mixage ApexCharts + ECharts', () => {
    const apex = /apexcharts/i.test(html);
    const ech = /echarts/i.test(html);
    if (apex && ech) return 'ApexCharts ET ECharts présents dans le même article (règle 11)';
  });

  // ── COMMUN : conteneurs ECharts orphelins (charts vides) ──
  // Deux modes de défaillance, tous deux = boîtes de graphes vides à l'écran :
  //   1. Plus de conteneurs-cibles (#xChart) que d'appels echarts.init() réels.
  //   2. La lib ECharts est chargée mais le bloc d'init est un placeholder commenté
  //      (realInit=0 alors que echarts.init apparaît, uniquement en commentaire — MSFT).
  // Calibré à zéro faux positif : AAPL (lib chargée, 0 chart), TARA/WST/daily/weekly
  // (cibles ≤ inits) restent verts.
  check('pas de conteneurs ECharts orphelins (charts vides)', () => {
    const echartsLoaded = /echarts@\d|echarts(\.min)?\.js|echarts\.init/i.test(html);
    if (!echartsLoaded) return; // pas d'ECharts → rien à valider
    const orphans = orphanChartIds(html);
    if (orphans.length) {
      return `conteneurs ECharts orphelins (${orphans.length} boxes, id non référencé) — ${JSON.stringify(orphans)} jamais initialisé(s)`;
    }
    // Bloc d'init entièrement commenté : lib chargée mais aucun echarts.init actif
    // alors que echarts.init apparaît (uniquement en commentaire) — cas MSFT.
    const real = realEchartsInit(html);
    const total = (html.match(/echarts\.init\s*\(/g) || []).length;
    if (real === 0 && total > 0) {
      return `bloc d'init ECharts en placeholder commenté (${total} echarts.init hors code actif) — lib chargée mais aucun graphe rendu`;
    }
  });

  // ─────────────────────────── ANALYSE ───────────────────────────
  if (type === 'analyse') {
    check('ticker-header présent', () => {
      if (!/class="ticker-header"/.test(html)) return 'div.ticker-header absent';
    });
    // Règle 14 CRITIQUE : métriques du ticker-header = tm-value/tm-label
    check('ticker-header metrics = tm-value/tm-label (règle 14 CRITIQUE)', () => {
      const block = tickerHeaderBlock(html);
      if (!block) return; // pas de ticker-header → check précédent le signale
      const bad = [];
      if (/class="(metric-value|ticker-metric-value)"/.test(block)) bad.push('metric-value/ticker-metric-value (font trop grande)');
      if (/class="(metric-label|ticker-metric-label)"/.test(block)) bad.push('metric-label/ticker-metric-label');
      if (bad.length) return `classes interdites dans ticker-header: ${bad.join(', ')} — utiliser tm-value/tm-label`;
      if (/class="ticker-metric"/.test(block) && !/class="tm-value"/.test(block)) {
        return 'ticker-metric sans tm-value — structure de métrique cassée';
      }
    });
    check('ticker-header plat (pas de nesting interdit)', () => {
      const bad = ['ticker-header-inner', 'ticker-brand', 'ticker-hero'].filter(c => new RegExp(`class="${c}"`).test(html));
      if (bad.length) return `nesting interdit: ${bad.join(', ')} — structure ticker-header doit être plate`;
    });
    // Placeholders dans les métriques du HERO (ticker-header). Scopé au hero ;
    // les tables secondaires (anti-dilution) peuvent légitimement porter "N/A".
    // ERROR = fuite JS / template non rempli (jamais légitime).
    check('pas de fuite JS/template dans les métriques du ticker-header', () => {
      const vals = tmValues(tickerHeaderBlock(html));
      const bad = vals.filter(v =>
        v === '' || /^(TODO|XX|XXX|\?\?|\[52W\]|undefined|NaN|null|TBD|\{[^}]*\})$/i.test(v)
      );
      if (bad.length) return `valeur(s) template/JS non substituée(s): ${JSON.stringify(bad)} — bug de génération`;
    });
    // WARN = trou de données ambigu. N/A peut être légitime (P/E d'une société non
    // rentable, div yield d'un non-payeur), $0 = dividende nul → à vérifier, pas bloquant.
    warn('valeurs suspectes dans le ticker-header (N/A, $0, —)', () => {
      const vals = tmValues(tickerHeaderBlock(html));
      const sus = vals.filter(v => /^(N\/A|—|-)$/i.test(v) || /^\$0(\.00)?$/.test(v));
      if (sus.length) return `${JSON.stringify(sus)} — vérifier via MCP (légitime si non-rentable/non-payeur, sinon oubli d'enrichissement)`;
    });
    // Trade Idea (requis pour tickers tradables) → warn car tradabilité non détectable structurellement
    warn('section Trade Idea présente', () => {
      const has = /id="trade"/.test(html) || /class="trade-idea"/.test(html) || /Trade Idea|Idée de Trade|Idée de Trading/i.test(html);
      if (!has) return 'aucune section Trade Idea (requise pour tickers tradables — ignorer si indice/thématique)';
    });
  }

  // ─────────────────────────── DAILY ───────────────────────────
  if (type === 'daily') {
    check('sections principales présentes (id ou titre)', () => {
      // accepte id="x" OU un titre/heading équivalent (drift de template toléré)
      const need = [
        ['dashboard', /id="dashboard"|Dashboard/i],
        ['trade', /id="trade"|Trade Idea|Idées de Trading|Idées de Trade/i],
        ['sources', /id="sources"|>Sources|Disclaimer/i],
      ];
      const miss = need.filter(([, re]) => !re.test(html)).map(([n]) => n);
      if (miss.length) return `section(s) manquante(s): ${miss.join(', ')}`;
    });
    warn('nombre de sections suffisant (~17 attendues)', () => {
      const n = (html.match(/<section[\s>]/g) || []).length;
      if (n < 12) return `${n} <section> (< 12 — briefing incomplet, template = 17 sections)`;
    });
    // Interdiction section portfolio/positions
    check('pas de section Portfolio/positions (interdite en daily)', () => {
      if (/positions ouvertes|mon portefeuille|notre portefeuille|nos positions actuelles|id="portfolio"|class="portfolio-/i.test(html)) {
        return 'section Portfolio/positions détectée — interdite dans le template daily';
      }
    });
    // CSS inline hors ECharts / GTM
    warn('pas de CSS inline hors ECharts', () => {
      const styles = html.match(/style="[^"]*"/g) || [];
      const extras = styles.filter(s => {
        // autorisé : conteneur ECharts (width/height), GTM noscript (display:none), visibility hidden
        if (/width:\s*100%|height:\s*\d|display:\s*none|visibility:\s*hidden/.test(s)) return false;
        return true;
      });
      if (extras.length) return `${extras.length} attribut(s) style= inline hors conteneur ECharts (règle 8) — ex: ${extras[0].slice(0, 60)}`;
    });
    warn('FAB (fnav) présent', () => {
      if (!/class="fnav"|id="floatingNav"|fnav-item/.test(html)) return 'navigation flottante fnav absente';
    });
  }

  // ─────────────────────────── WEEKLY ───────────────────────────
  if (type === 'weekly') {
    warn('nombre de sections/titres suffisant (~18 attendues)', () => {
      const n = (html.match(/<h2[\s>]/g) || []).length;
      if (n < 12) return `${n} <h2> (< 12 — revue incomplète, template = 18 sections)`;
    });
    check('sections clés présentes (Sources + Trades + Outlook)', () => {
      const miss = [];
      if (!/id="sources"|Sources<|>Sources/i.test(html)) miss.push('Sources');
      if (!/id="trades"|Trades de la Semaine|Trades of the Week|Weekly Trades/i.test(html)) miss.push('Trades');
      if (!/id="outlook"|Outlook|Perspectives/i.test(html)) miss.push('Outlook');
      if (miss.length) return `section(s) clé(s) absente(s): ${miss.join(', ')}`;
    });
    warn('FAB (fnav) présent', () => {
      if (!/class="fnav"|id="floatingNav"|fnav-item/.test(html)) return 'navigation flottante fnav absente';
    });
  }

  res.rel = rel;
  return res;
}

// ─── FACT-CHECK HOOK (RUNTIME, SÉPARÉ — ne PAS appeler ici) ───────────────────
// La vérification de véracité (52W range, cash, market cap, événements) est un
// contrôle runtime distinct : il exige MCP DailyTickers (QueryData/GetInstruments)
// et n'est PAS déterministe file-based. À câbler dans le pipeline de publication
// APRÈS ce QA structurel, jamais dedans (règle MCP HARD STOP : si MCP down → STOP).
//
//   Emplacement du hook : tools/factcheck-content.js (à créer si besoin) :
//   pour chaque tm-value "Market Cap"/"Cash"/"52W" d'une analyse → QueryData(ticker)
//   et comparer ±5%. Diverge → BLOCK. Voir feedback_analyses_factcheck.md.
function factCheckHook() {
  return { note: 'fact-check MCP = runtime séparé — voir en-tête §FACT-CHECK' };
}
void factCheckHook;

// ─── Cible(s) ────────────────────────────────────────────────────────────────
function collectTargets() {
  if (ALL) {
    const t = [];
    for (const base of ['analyses', 'daily', 'weekly']) {
      const dir = path.join(ROOT, base);
      if (!fs.existsSync(dir)) continue;
      for (const d of fs.readdirSync(dir)) {
        const f = path.join(dir, d, 'index.html');
        if (fs.existsSync(f)) t.push(f);
      }
    }
    return t;
  }
  if (positional.length) return positional.map(resolveTarget);
  if (typeFlag) {
    const map = {
      analyse: () => newestDir('analyses'),
      analyses: () => newestDir('analyses'),
      daily: () => newestDir('daily', d => /^\d{8}$/.test(d)),
      weekly: () => newestDir('weekly', d => /^\d{8}$/.test(d)),
    };
    const f = (map[typeFlag] || (() => null))();
    return f ? [f] : [];
  }
  // défaut : newest de chaque type
  return [
    newestDir('daily', d => /^\d{8}$/.test(d)),
    newestDir('weekly', d => /^\d{8}$/.test(d)),
    newestDir('analyses'),
  ].filter(Boolean);
}

// ─── Exécution ───────────────────────────────────────────────────────────────
const targets = collectTargets();
if (!targets.length) {
  console.error('Aucune cible. Usage: node tools/qa-content.js <path> | --all | --type analyse|daily|weekly');
  process.exit(2);
}

const results = targets.map(validate);

if (JSON_OUT) {
  const totalErr = results.reduce((a, r) => a + r.errors.length, 0);
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    files: results.map(r => ({ file: r.rel || r.file, type: r.type, errors: r.errors, warnings: r.warnings, okCount: r.ok.length })),
    totalErrors: totalErr,
  }, null, 2));
  process.exit(STRICT && totalErr > 0 ? 1 : 0);
}

let totalErr = 0, totalWarn = 0, totalOk = 0, filesWithErr = 0;
console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║      QA Content — articles.dailytickers.com      ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`  Date: ${new Date().toISOString()}  |  Fichiers: ${results.length}`);
console.log('');

for (const r of results) {
  totalErr += r.errors.length; totalWarn += r.warnings.length; totalOk += r.ok.length;
  if (r.errors.length) filesWithErr++;
  const badge = r.errors.length ? '❌' : (r.warnings.length ? '⚠️ ' : '✅');
  const label = r.rel || path.relative(ROOT, r.file);
  console.log(`${badge} ${label}  [${r.type}]  ✅${r.ok.length} ⚠️${r.warnings.length} ❌${r.errors.length}`);
  r.errors.forEach(e => console.log(`      ❌ ${e}`));
  r.warnings.forEach(w => console.log(`      ⚠️  ${w}`));
  if (r.errors.length || r.warnings.length) console.log('');
}

console.log('  ─────────────────────────────────────────────────');
console.log(`  TOTAL: ✅ ${totalOk}  |  ⚠️  ${totalWarn}  |  ❌ ${totalErr}  |  fichiers en erreur: ${filesWithErr}/${results.length}`);
if (!totalErr && !totalWarn) console.log('  🎉 Aucune anomalie détectée');
console.log('');

if (STRICT && totalErr > 0) {
  console.log('  ⛔ Mode strict — exit 1 (erreurs bloquantes détectées)');
  process.exit(1);
}
process.exit(0);
