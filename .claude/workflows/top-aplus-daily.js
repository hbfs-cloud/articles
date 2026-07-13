export const meta = {
  name: 'top-aplus-daily',
  description: 'Daily "Top 10 A+ à date" : re-validation MCP au spot des A+ <1 mois → ranking → sélection top 10 → write → gate senior-review',
  phases: [
    { title: 'Revalidate', detail: 're-valider 26 A+ au spot via MCP (5 axes à date)' },
    { title: 'Select', detail: 'classer + sélectionner top 10 (diversité/corrélation)' },
    { title: 'Write', detail: 'rédiger le daily Top A+' },
    { title: 'SeniorQA', detail: 'gate adversarial QA/Quant/Trader/Risk/Editor' },
  ],
}

// ============================================================================
// DAILY : Top 10 Setups A+ — À Date (16 juin 2026)
// Pool = analyses grade A+ publiées <1 mois (10 & 14 juin 2026). MCP-driven, zéro hallucination.
// ============================================================================

const PATH = 'daily/20260616/top-aplus/index.html'
const DATE_FR = '16 juin 2026'

// Régime live (GetRegimeProbability ensemble, 2026-06-16 — alias legacy, canonique: GetMarketContext(facets='regime', model='ensemble')) — passé aux agents, ne pas réinventer
const REGIME = {
  state: 'neutral', confidence: 0.412,
  probs: { risk_on: 0.254, neutral: 0.412, early_risk_off: 0.268, crisis: 0.066 },
  expected_return_spy_5d_pct: 0.10, expected_drawdown_5d_pct: 3.41,
}

// Les 26 A+ <1 mois (data-grade A+). Chaque agent lit analyses/<T>/index.html + MCP live.
const TICKERS = ['ACA','ALV','ALLY','ASML','BK','BTSG','CECO','COLB','CPAY','CSCO','DECK','DGX','ENVA','EVR','FLEX','FOXA','IBKR','KLAC','KO','MATX','NVT','RPRX','RVTY','SNEX','TER','TEX']

// ----------------------------------------------------------------------------
// BLOCS FIXES — theme EMERALD, conventions DAILY
// ----------------------------------------------------------------------------

const THEME_CSS = `<style>
 /* EMERALD THEME — Top A+ Daily */
 .hero-section { padding:4rem 2rem 7rem 2rem; background:linear-gradient(180deg, #ecfdf5 0%, #f8fafc 100%); text-align:center; }
 .hero-date { font-size:0.9rem; font-weight:600; color:#047857; margin-bottom:1rem; }
 .hero-badges { display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; margin-top:2rem; }
 .hero-badge { display:inline-flex; align-items:center; gap:0.4rem; padding:0.5rem 1rem; border-radius:99px; font-size:0.8rem; font-weight:700; }
 .hero-badge-emerald { background:rgba(5,150,105,0.1); color:#047857; border:1px solid rgba(5,150,105,0.25); }
 .hero-badge-blue { background:rgba(37,99,235,0.1); color:#2563eb; border:1px solid rgba(37,99,235,0.2); }
 .hero-badge-amber { background:rgba(245,158,11,0.12); color:#d97706; border:1px solid rgba(245,158,11,0.25); }
 .hero-badge-red { background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }
 .hero-badge-purple { background:rgba(147,51,234,0.1); color:#9333ea; border:1px solid rgba(147,51,234,0.2); }

 .section-divider { display:flex; align-items:center; gap:1rem; margin:3rem 0 2rem; color:#64748b; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; }
 .section-divider::before, .section-divider::after { content:''; flex:1; height:1px; background:#e2e8f0; }

 .compare-table { width:100%; border-collapse:separate; border-spacing:0; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; margin:2rem 0; font-variant-numeric:tabular-nums; }
 .compare-table th { background:#047857; color:white; padding:0.85rem 0.75rem; font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }
 .compare-table td { padding:0.8rem 0.75rem; border-bottom:1px solid #f1f5f9; font-size:0.88rem; color:#334155; }
 .compare-table tr:nth-child(even) td { background:#f8fafc; }
 .compare-table tr:last-child td { border-bottom:none; }

 .checklist { list-style:none; padding:0; margin:1.5rem 0; }
 .checklist li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.6rem 0; font-size:0.95rem; color:#334155; line-height:1.5; }
 .checklist li i { margin-top:0.15rem; flex-shrink:0; }

 .pick-card { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem 1.5rem; margin:1rem 0; }
 .pick-card h3 { margin:0 0 0.25rem; font-size:1.15rem; color:#0f172a; }
 .pick-rank { display:inline-flex; align-items:center; justify-content:center; min-width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,#047857,#10b981); color:white; font-weight:900; font-size:0.85rem; margin-right:0.5rem; }
 .pick-levels { display:flex; flex-wrap:wrap; gap:1rem; margin:0.75rem 0; font-size:0.85rem; }
 .pick-levels b { color:#047857; }

 .takeaway-box { background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border:1px solid #047857; border-radius:12px; padding:2rem; margin:2rem 0; }
 .takeaway-box h3 { color:#047857; margin-top:0; }
 .takeaway-list { list-style:none; padding:0; margin:0; }
 .takeaway-list li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.75rem 0; font-size:1rem; color:#334155; line-height:1.6; border-bottom:1px solid rgba(5,150,105,0.15); }
 .takeaway-list li:last-child { border-bottom:none; }
 .takeaway-list li i { color:#047857; margin-top:0.2rem; flex-shrink:0; }

 .alert-box { background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:1.25rem 1.5rem; margin:1.5rem 0; }
 .alert-box h4 { color:#b45309; margin:0 0 0.5rem; }
 .alert-box p { margin:0; font-size:0.9rem; color:#334155; line-height:1.6; }

 @media (max-width:768px) {
   .hero-section { padding:2.5rem 1rem 4.5rem; }
   .hero-section h1 { font-size:1.8rem !important; } .hero-badge { font-size:0.7rem; padding:0.35rem 0.75rem; }
   .compare-table { font-size:0.8rem; } .compare-table th, .compare-table td { padding:0.6rem 0.5rem; }
 }
 </style>`

const BRAND_BAR = `<nav class="brand-bar">
    <div class="brand-bar-inner">
      <a href="/" class="brand-logo">
        <img src="/logo.svg" alt="" width="36" height="36">
        <span class="brand-title">DailyTickers</span>
      </a>
      <div class="brand-nav">
        <a href="/?tab=weekly">Hebdo</a>
        <a href="/?tab=daily">Daily</a>
        <a href="/?tab=analyses">Analyses</a>
        <a href="/?tab=scanner">Scanner</a>
        <a href="/?tab=radar">Radar</a>
        <a href="/?tab=series">Séries</a>
      </div>
      <div class="brand-actions">
        <a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a>
      </div>
    </div>
  </nav>`

const FOOTER = `  <footer class="article-footer">
    &copy; 2026 DailyTickers. Donn&eacute;es via DailyTickers Gateway.
    Ceci n'est pas un conseil financier. Faites vos propres recherches.
    <br><a href="/" title="Accueil"><i class="fas fa-house" style="margin-right:4px;"></i></a>
  </footer>`

// daily : core.js + echarts-responsive.js + tag-renderer.js + live-tracker.js (badges prix sur setup/pick cards)
const SCRIPT_TAIL = `    <script src="/assets/core.js"></script><script src="/assets/echarts-responsive.js"></script>
<script src="/assets/tag-renderer.js"></script>
<script src="/assets/live-tracker.js"></script>
</body>
</html>`

const FNAV_SCRIPT = `<button class="fnav-btn" id="fnavBtn" type="button" aria-label="Navigation"><i class="fas fa-bars" id="fnavIcon"></i><span class="fnav-btn-label" id="fnavLabel">Menu</span></button></div>
<script>
(function() {
  var fab = document.getElementById('fnavBtn');
  var menu = document.getElementById('fnavMenu');
  var icon = document.getElementById('fnavIcon');
  var label = document.getElementById('fnavLabel');
  if (!fab || !menu) return;
  var items = menu.querySelectorAll('.fnav-item');
  var sections = [];
  var isOpen = false;
  items.forEach(function(item) {
    var id = item.getAttribute('data-section');
    var el = document.getElementById(id);
    if (el) sections.push({ id: id, el: el, item: item });
  });
  function toggle() {
    isOpen = !isOpen;
    menu.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    icon.className = isOpen ? 'fas fa-times' : 'fas fa-bars';
  }
  fab.addEventListener('click', function(e) { e.stopPropagation(); toggle(); });
  document.addEventListener('click', function(e) {
    if (isOpen && !menu.contains(e.target) && !fab.contains(e.target)) toggle();
  });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && isOpen) toggle(); });
  items.forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      var id = this.getAttribute('data-section');
      var target = document.getElementById(id);
      if (target) {
        var brandBar = document.querySelector('.brand-bar');
        var offset = (brandBar ? brandBar.offsetHeight : 56) + 20;
        window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
      }
      if (isOpen) toggle();
    });
  });
  var currentActive = null;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var match = sections.find(function(s) { return s.el === entry.target; });
        if (match) {
          if (currentActive) currentActive.item.classList.remove('active');
          match.item.classList.add('active');
          currentActive = match;
          label.textContent = match.item.querySelector('span').textContent;
        }
      }
    });
  }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
  sections.forEach(function(s) { observer.observe(s.el); });
  if (sections.length > 0) {
    sections[0].item.classList.add('active');
    currentActive = sections[0];
    label.textContent = sections[0].item.querySelector('span').textContent;
  }
})();
</script>`

const HEAD = `<!DOCTYPE html>
<html lang="fr" data-tags="us,trade-idea,technique" data-tab="daily">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Top 10 Setups A+ — À Date (${DATE_FR}) | DailyTickers</title>
 <meta name="description" content="Le classement à date de nos meilleurs setups A+ publiés ce mois-ci, re-validés au prix du moment : R/R au spot, structure, catalyseur, flags et valorisation. Régime de marché neutre.">
 <meta property="og:title" content="Top 10 Setups A+ — À Date | DailyTickers">
 <meta property="og:description" content="Nos A+ du mois re-classés et re-validés au spot. R/R réel au prix actuel, transparence sur les noms écartés.">
 <meta property="og:image" content="https://articles.dailytickers.com/favicon.ico">
 <meta property="og:url" content="https://articles.dailytickers.com/daily/20260616/top-aplus/">
 <meta property="og:type" content="article">
 <link rel="icon" href="/favicon.ico">

 <!-- Google Tag Manager -->
 <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
 new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
 j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
 })(window,document,'script','dataLayer','GTM-T5Z595CW');</script>

 <link rel="preconnect" href="https://fonts.googleapis.com">
 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
 <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
 <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
 <link rel="stylesheet" href="/assets/report.css">
 ${THEME_CSS}
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`

// ----------------------------------------------------------------------------
// SCHEMAS
// ----------------------------------------------------------------------------
const REVAL_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['ticker', 'sector', 'data_ok', 'spot', 'entry', 'stop', 'tp1', 'rr_at_spot', 'extension_pct', 'structure_ok', 'catalyst_ok', 'clean_flags', 'valuation_ok', 'event_risk', 'score', 'verdict', 'reason', 'red_flags'],
  properties: {
    ticker: { type: 'string' }, sector: { type: 'string' },
    data_ok: { type: 'boolean' },
    spot: { type: 'number' }, entry: { type: 'number' }, stop: { type: 'number' }, tp1: { type: 'number' },
    rr_at_spot: { type: 'number' }, extension_pct: { type: 'number' },
    structure_ok: { type: 'boolean' }, catalyst_ok: { type: 'boolean' }, clean_flags: { type: 'boolean' }, valuation_ok: { type: 'boolean' },
    event_risk: { type: 'string' },
    score: { type: 'integer' },
    verdict: { type: 'string', enum: ['A+', 'A', 'demote'] },
    reason: { type: 'string' },
    red_flags: { type: 'array', items: { type: 'string' } },
  },
}
const SELECT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['top10', 'basket_note', 'excluded_note'],
  properties: {
    top10: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['rank', 'ticker', 'sector', 'spot', 'entry', 'stop', 'tp1', 'rr_at_spot', 'score', 'thesis'], properties: {
      rank: { type: 'integer' }, ticker: { type: 'string' }, sector: { type: 'string' },
      spot: { type: 'number' }, entry: { type: 'number' }, stop: { type: 'number' }, tp1: { type: 'number' },
      rr_at_spot: { type: 'number' }, score: { type: 'integer' }, thesis: { type: 'string' } } } },
    basket_note: { type: 'string' },
    excluded_note: { type: 'string' },
  },
}
const WRITE_SCHEMA = { type: 'object', additionalProperties: false, required: ['path', 'sectionIds', 'picksRendered', 'lineCount'], properties: { path: { type: 'string' }, sectionIds: { type: 'array', items: { type: 'string' } }, picksRendered: { type: 'integer' }, lineCount: { type: 'integer' } } }
const QA_SCHEMA = { type: 'object', additionalProperties: false, required: ['verdict', 'conventionsOk', 'dataOk', 'remaining', 'note'], properties: { verdict: { type: 'string', enum: ['PASS', 'FIX', 'BLOCK'] }, conventionsOk: { type: 'boolean' }, dataOk: { type: 'boolean' }, remaining: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } } }

const MCP_HINT = `Pour les données marché, utilise les outils MCP market-data (charge leur schéma via ToolSearch : query "select:mcp__claude_ai_marketdata__QueryData"). QueryData accepte des symboles séparés par virgule et types= : quote (prix live), technicals (EMA20/50/200, RSI14, ATR), stats (pegRatio, enterpriseToEbitda, fwd P/E, shares, shortPercentOfFloat, beta), earnings_quarterly (8 derniers, vérifier 4/4 beats), flags (compliance/halted), news. ZÉRO HALLUCINATION : si une donnée n'est pas obtenue, ne l'invente pas — marque data_ok=false. Tous les prix doivent être à la MÊME ÉCHELLE que le quote live (leçon KLAC : un split rend les niveaux publiés faux).`

// ----------------------------------------------------------------------------
// PIPELINE
// ----------------------------------------------------------------------------
log(`Daily Top A+ — re-validation de ${TICKERS.length} A+ <1 mois au spot (régime ${REGIME.state})`)

// STAGE 1 — REVALIDATE (parallèle ; barrière nécessaire avant ranking)
const revals = (await parallel(TICKERS.map(t => () => agent(
  `Tu es un analyste quant/risk. Re-VALIDE le setup A+ "${t}" À DATE (aujourd'hui ${DATE_FR}), au prix du moment.

1) Lis le fichier analyses/${t}/index.html → récupère la thèse, le secteur, et les niveaux PUBLIÉS (entrée, stop, TP1).
2) Récupère les données LIVE via MCP pour ${t}. ${MCP_HINT}
3) Recompute les 5 axes A+ AU SPOT :
   - Structure : EMA20>EMA50>EMA200 en hausse, RSI 50–68, et extension% = (spot/EMA20 − 1)×100 (étendu si > ~5–8% → mauvais point d'entrée à date).
   - Catalyseur : 4/4 beats récents + catalyseur forward toujours valide (non macro-inversé).
   - R/R AU SPOT : à un point d'entrée actionnable MAINTENANT (proche EMA20/support), stop ~1,6×ATR sous l'invalidation, TP1 structurel. rr_at_spot = (tp1 − entrée)/(entrée − stop). Doit être ≥ 1,5 SINON ce n'est plus A+ à date (c'est devenu une watchlist).
   - Flags propres : ZÉRO dilution active (ATM/S-3/deal en actions/convertibles)/compliance. Vérifie flags + (si doute) news. Buybacks/dividendes = propre.
   - Valorisation : raisonnable ou justifiée par la croissance.
4) Écran ÉVÉNEMENT (obligatoire) : earnings dans ±3 jours, M&A (y compris ${t} ACQUÉREUR — leçon FOXA/Roku), secondaire, split, ruling. Si une action binaire peut gapper à travers le stop → event_risk décrit + demote.
5) Cohérence d'échelle (leçon KLAC) : entrée/stop/TP DOIVENT être à la même échelle que le quote live. Si écart ≥2× → red_flag "échelle/ split".

Renvoie le verdict À DATE : "A+" (5 axes forts, R/R≥1,5 au spot), "A" (solide mais 1 axe limite), "demote" (R/R<1,5 au spot, étendu, dilution, événement binaire, ou échelle cassée). score 0–100 (la qualité globale à date). reason = une phrase. red_flags = liste. Mets entry/stop/tp1 = les niveaux ACTIONNABLES au spot (recalibrés si besoin), spot = prix live. Si MCP indisponible pour ${t} → data_ok=false, verdict "demote".`,
  { label: `reval:${t}`, phase: 'Revalidate', schema: REVAL_SCHEMA }
))) ).filter(Boolean)

// Ranking déterministe
const eligible = revals.filter(r => r.data_ok && r.verdict !== 'demote' && r.rr_at_spot >= 1.5).sort((a, b) => b.score - a.score)
const demoted = revals.filter(r => !(r.data_ok && r.verdict !== 'demote' && r.rr_at_spot >= 1.5))
const shortlist = eligible.slice(0, 14)
log(`Re-validés : ${revals.length}/${TICKERS.length} | éligibles A+/A au spot : ${eligible.length} | écartés : ${demoted.length}`)

if (eligible.length < 5) {
  log(`ALERTE : seulement ${eligible.length} A+ tiennent au spot — le daily le dira honnêtement.`)
}

// STAGE 2 — SELECT (diversité secteur + corrélation)
const selection = await agent(
  `Tu es le PM. Voici les setups A+ re-validés AU SPOT (shortlist classée par score), au régime ${REGIME.state} (probas ${JSON.stringify(REGIME.probs)}, SPY 5j attendu ${REGIME.expected_return_spy_5d_pct}% / DD ${REGIME.expected_drawdown_5d_pct}%).

SHORTLIST (JSON) :
${JSON.stringify(shortlist, null, 1)}

ÉCARTÉS (pour transparence) :
${JSON.stringify(demoted.map(d => ({ ticker: d.ticker, verdict: d.verdict, rr: d.rr_at_spot, reason: d.reason, red_flags: d.red_flags })), null, 1)}

Sélectionne les 10 MEILLEURS À DATE avec diversité sectorielle et sanité de corrélation (évite un panier mono-secteur ou mono-facteur ; en régime neutre, ne charge pas un bloc cyclique high-beta). Si moins de 10 tiennent vraiment, en mettre moins (honnêteté > quota). Classe-les (rank 1 = meilleur). Pour chacun : reprends spot/entry/stop/tp1/rr_at_spot/score depuis la shortlist (NE PAS réinventer) + une thèse d'une à deux phrases. basket_note = vue corrélation/diversité du panier. excluded_note = résumé des noms écartés et pourquoi (1-3 phrases, cite les plus notables).`,
  { label: 'select', phase: 'Select', schema: SELECT_SCHEMA }
)

// STAGE 3 — WRITE
const writeRes = await agent(
  `Tu es rédacteur financier (voix FT/Economist, FR). Rédige le DAILY "Top 10 Setups A+ — À Date" (${DATE_FR}) à ${PATH}.

DONNÉES (à utiliser telles quelles, NE RIEN réinventer) :
- Régime : ${JSON.stringify(REGIME)}
- Sélection top 10 + notes : ${JSON.stringify(selection, null, 1)}

Pour enrichir la thèse d'un pick, tu peux lire analyses/<TICKER>/index.html et LIER vers /analyses/<TICKER>/. Les niveaux (entry/stop/tp1/rr/spot) doivent rester EXACTEMENT ceux de la sélection.

${MCP_HINT}
(Tu n'as pas besoin de re-fetcher : les niveaux sont déjà validés. N'utilise MCP que si tu veux vérifier un détail.)

=== CONVENTIONS DAILY (le QA rejette sinon) ===
- Accents UTF-8 directs. CSS = /assets/report.css UNIQUEMENT + le bloc <style> fourni. Pas de assets/ local.
- <footer class="article-footer"> exactement. GTM-T5Z595CW (fourni). Scripts de fin fournis (core.js + echarts-responsive.js + tag-renderer.js + live-tracker.js).
- <div id="article-clickable-tags" class="card-tags"> dans le hero. Date au format "${DATE_FR}".
- Chaque section dans <div class="section-divider" id="ID"> + <div class="content-card">. fnav avec un item par section (data-section = id réels).
- Chiffres = ceux de la sélection (réels, validés au spot). Disclaimer clair : pas un conseil, R/R indicatifs au moment de la rédaction, faire ses propres recherches. Régime et risques mentionnés.
- HONNÊTETÉ : si la sélection a < 10 noms, le dire franchement. Mentionner les noms écartés (excluded_note) — la transparence est la marque.

=== ASSEMBLAGE (ordre strict) ===
1. [HEAD — VERBATIM]
${HEAD}

2. [BRAND BAR — VERBATIM]
${BRAND_BAR}

3. [HERO] <section class="hero-section"> : hero-date = fil d'ariane "Daily · ${DATE_FR}" (sentence case, PAS un eyebrow uppercase tracké) ; <h1>Top 10 Setups A+ — À Date</h1> ; sous-titre (re-validation au spot de nos A+ du mois) ; hero-badges (régime neutre, "R/R re-validé au spot", "${selection.top10 ? selection.top10.length : 10} A+ retenus", "transparence sur les écartés") ; <div id="article-clickable-tags" class="card-tags" ...></div>.

4. [FNAV] <div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"> … un item par section … </div>
${FNAV_SCRIPT}

5. <div class="container"> Sections :
   - #regime "Le décor : régime neutre" (contexte + ce que ça implique pour des A+ : qualité, décorrélation, prudence).
   - #methodo "Comment on a re-noté" (les 5 axes re-calculés au spot, R/R à date, dilution/événement, échelle — transparence sur la méthode).
   - #classement "Le classement à date" : un <table class="compare-table"> (Rang, Ticker, Secteur, Spot, Entrée, Stop, TP1, R/R, Score) pour les 10. Puis, pour chaque pick, une <div class="pick-card"> (avec <span class="pick-rank">) : titre = rang + ticker + nom/secteur, <div class="pick-levels"> entrée/stop/TP1/R-R, la thèse, et un lien <a href="/analyses/TICKER/">Analyse complète</a>. (live-tracker.js ajoutera les badges de prix.)
   - #ecartes "Les A+ écartés (et pourquoi)" : reprendre excluded_note + lister les plus notables avec la raison (R/R tombé, étendu, événement, dilution, échelle). Transparence.
   - #risques "Risques & avertissements" : régime neutre, R/R indicatifs au spot, exécuter avec stops, pas un conseil, DYOR.
   Termine par une <div class="takeaway-box"> ("À retenir") et un encart disclaimer.
   </div>

6. [FOOTER — VERBATIM]
${FOOTER}

7. [SCRIPTS ECHARTS éventuels] : optionnel — un graphe ECharts (ex. score par pick, ou R/R par pick). Si tu en mets, init + window resize. Sinon, rien.

8. [SCRIPT TAIL — VERBATIM]
${SCRIPT_TAIL}

Écris le fichier complet avec Write à ${PATH}. Retourne path, sectionIds, picksRendered (nb de pick-cards), lineCount.`,
  { label: 'write', phase: 'Write', schema: WRITE_SCHEMA }
)

// STAGE 4 — SENIOR QA (gate adversarial multi-personas)
const qa = await agent(
  `Tu es le GATE SENIOR-REVIEW (panel QA / Quant / Trader / Risk-Compliance / Editor) pour le daily Top A+ : ${PATH}. Lis le fichier ENTIÈREMENT.

A. CONVENTIONS (bloquantes) : <!DOCTYPE html> + <html lang="fr" data-tab="daily"> ; GTM-T5Z595CW ; /assets/report.css (aucun assets/ local) ; bloc <style> theme présent ; brand-bar + brand-nav ; hero + #article-clickable-tags ; fnav cohérent (data-section = id réels) ; <footer class="article-footer"> uniquement ; scripts de fin = core.js + echarts-responsive.js + tag-renderer.js + live-tracker.js, rien après </html> ; accents UTF-8 directs ; ECharts (s'il y en a) non cassé ; date "${DATE_FR}".
B. DONNÉES & RISK (bloquantes si fausses) : pour CHAQUE pick rendu, recalcule R/R = (TP1 − entrée)/(entrée − stop) à partir des niveaux affichés → doit être ≥ 1,5 ET correspondre au R/R imprimé (tolérance d'arrondi). Vérifie la cohérence d'échelle des niveaux (pas de split/×10). Vérifie qu'aucun pick écarté pour événement/dilution n'a été re-listé en top. Tu peux ré-échantillonner 2-3 tickers via MCP (ToolSearch "select:mcp__claude_ai_marketdata__QueryData") pour confirmer prix/échelle. Toute R/R imprimée fausse, niveau incohérent, ou chiffre inventé = BLOCK.
C. ÉDITORIAL : voix FT/Economist, disclaimer présent, transparence sur les écartés, pas de hype ni de promesse.

Verdict : PASS (publiable) / FIX (mineurs non bloquants, lister remaining) / BLOCK (convention, donnée fausse, ou R/R incohérent). conventionsOk = A respecté ; dataOk = B respecté.`,
  { label: 'senior-qa', phase: 'SeniorQA', schema: QA_SCHEMA }
)

return {
  path: PATH,
  regime: REGIME.state,
  revalidated: revals.length,
  eligible: eligible.length,
  selected: selection.top10 ? selection.top10.length : 0,
  excluded: demoted.map(d => d.ticker),
  qa: qa ? qa.verdict : 'NULL',
  conventionsOk: qa ? qa.conventionsOk : false,
  dataOk: qa ? qa.dataOk : false,
  remaining: qa ? qa.remaining : ['qa null'],
}
