#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path');
const { validateReview } = require('./lib/scanner-publication-review');
const ROOT = path.resolve(__dirname, '..');
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(root, reviewPath, { write = true } = {}) {
  const { review: r, dir: relativeDir } = validateReview(root, reviewPath);
  if (r.review_date === '2026-09-12' && r.reference_close === '2026-09-11') {
    return require('./lib/scanner-review-20260912').render(root, r, relativeDir, { write });
  }
  if (r.review_date !== '2026-09-08' || r.reference_close !== '2026-09-04') throw Error('A new session requires a new editorial review; this template is dated 2026-09-08');
  const dir = path.join(root, relativeDir);
  if (r.watchlist.map(x => x.ticker).join(',') !== 'CEG,COP,XOM') throw Error('Watchlist changed: a new editorial review is required');
  const c = r.counts, evidence = JSON.parse(fs.readFileSync(path.join(dir, 'review-evidence.json')));
  const names = { CEG: 'Constellation Energy', COP: 'ConocoPhillips', XOM: 'ExxonMobil' };
  const notes = {
    CEG: ['Le dossier électrique', 'La série de cours est exploitable et les filtres techniques de cette revue sont franchis. La présence dans le fonds islamique de référence est documentée.', 'Vérifier les événements de capital, les derniers résultats et le calendrier des dividendes avant de construire un plan. Le premier tri technique ne suffit pas à fixer une entrée.'],
    COP: ['Une exposition à l’énergie', 'Le titre passe le premier tri technique et figure dans la composition islamique consultée. Cette présence datée reste un élément documentaire.', 'Évaluer ce dossier avec XOM : deux sociétés différentes peuvent ajouter une même exposition énergétique. Ne pas confondre nombre de lignes et diversification.'],
    XOM: ['Une continuité juridique à vérifier', 'Le premier tri technique est favorable. La composition islamique consultée identifie déjà ExxonMobil Holdings Corp : le changement de nom ne constitue pas à lui seul un conflit d’identité.', 'La revue des dépôts doit couvrir le prédécesseur et le successeur. Une liste récente de documents ne prouve pas que toute la période de contrôle est couverte.']
  };
  if (r.watchlist.some(x => !notes[x.ticker])) throw Error('Editorial review required for a new watchlist member');
  const cards = r.watchlist.map(({ticker}) => `<section class="content-card" id="${ticker.toLowerCase()}">
    <p class="section-label">Dossier à vérifier · ${escape(notes[ticker][0])}</p>
    <h2>${escape(ticker)} — ${escape(names[ticker])}</h2>
    <p>${escape(notes[ticker][1])}</p>
    <div class="takeaway-box"><h3>Le contrôle décisif</h3><p>${escape(notes[ticker][2])}</p></div>
    <figure><a href="https://finviz.com/quote.ashx?t=${ticker}" target="_blank" rel="noopener noreferrer"><img src="https://charts2.finviz.com/chart.ashx?t=${ticker}&amp;ty=c&amp;ta=1&amp;p=d&amp;s=l" alt="Graphique journalier indicatif de ${escape(names[ticker])}, sans ordre associé" loading="lazy" width="700" height="365"></a>
      <p class="chart-unavailable" hidden>Le graphique externe est indisponible. <a href="https://finviz.com/quote.ashx?t=${ticker}" target="_blank" rel="noopener noreferrer">Consulter ${ticker} sur Finviz</a>.</p>
      <figcaption>Graphique indicatif fourni par Finviz, susceptible d’évoluer. La revue porte sur la clôture du ${escape(r.reference_close)} ; le graphique ne valide aucun niveau d’entrée.</figcaption></figure>
  </section>`).join('\n');
  const html = `<!DOCTYPE html>
<html lang="fr" data-tab="scanner" data-tags="us,energy,utilities,etf,technique" data-scanner-publication="review_only">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(r.headline)} | Scanner DailyTickers</title>
<meta name="description" content="Revue du 8 septembre : ${c.screened} titres examinés, trois dossiers de surveillance. Aucun nouvel ordre validé ; les contrôles de dividendes, d’opérations sur capital et du filtre islamique restent décisifs.">
<link rel="canonical" href="https://articles.dailytickers.com${r.article_url}">
<meta property="og:type" content="article"><meta property="og:title" content="${escape(r.headline)}">
<meta property="og:description" content="${c.screened} titres examinés. Surveillance uniquement : aucun panier d’achat certifié.">
<meta property="og:url" content="https://articles.dailytickers.com${r.article_url}">
<link rel="stylesheet" href="/assets/report.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T5Z595CW');</script>
</head>
<body>
<nav class="brand-bar" aria-label="Navigation principale"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="DailyTickers" width="34" height="34"> DailyTickers</a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div></div></nav>
<header class="hero-section"><p>Scanner · Séance du 8 septembre 2026 · Revue de surveillance</p><h1 class="hero-title">CEG, COP, XOM :<br>surveillance, pas de nouvel ordre</h1><p class="hero-subtitle">Trois valeurs croisent le premier filtre technique et une présence islamique documentée. Les vérifications restantes empêchent encore de les transformer en plans d’achat.</p><div id="article-clickable-tags" class="card-tags"></div></header>
<main class="container">
<section class="content-card" id="decision" aria-labelledby="decision-title"><h2 id="decision-title">La décision pour cette séance</h2>
<div class="alert-box"><p><strong>Aucun nouvel ordre validé.</strong> Cette revue remplace la présentation courante de la sélection initiale. Elle ne réactive ni AMZN, ni les sept autres anciens plans conditionnels.</p></div>
<p>CEG, COP et XOM cumulent un historique exploitable, le passage des filtres techniques examinés et une présence documentaire dans le fonds islamique de référence. Les opérations sur capital et les calendriers de dividendes ne sont pas encore suffisamment établis pour publier des entrées, stops ou objectifs.</p>
<p><strong>Action pratique :</strong> placer ces dossiers en surveillance. Une hausse à l’ouverture ne remplace pas les vérifications manquantes. Ces trois lignes sont cotées en dollars : pour un compte en euros, le change reste une exposition distincte. Aucun pourcentage de réussite ni classement « probabilité × rendement » n’est attribué à cette liste.</p>
<p>Référence de marché : clôture américaine du <time datetime="${r.reference_close}">4 septembre 2026</time>. Date de la revue : <time datetime="${r.review_date}">8 septembre 2026</time>. La date de publication ne transforme pas cette clôture en cotation du jour.</p>
</section>
<section class="content-card" id="tri"><h2>Ce que le tri a réellement établi</h2>
<div class="data-table-wrap"><table class="data-table"><caption>Périmètre collecté — les nombres décrivent des contrôles, pas des recommandations</caption><thead><tr><th scope="col">Étape</th><th scope="col">Titres uniques</th><th scope="col">Lecture utile</th></tr></thead><tbody>
<tr><th scope="row">Vivier examiné</th><td data-review-count="screened">${c.screened}</td><td>Actions cotées aux États-Unis et ETF cotés aux États-Unis</td></tr>
<tr><th scope="row">Historique complet</th><td data-review-count="histories_complete">${c.histories_complete}</td><td>Série continue sur la fenêtre de contrôle</td></tr>
<tr><th scope="row">Historique écarté</th><td data-review-count="histories_rejected">${c.histories_rejected}</td><td>Séances absentes ou historique trop court</td></tr>
<tr><th scope="row">Premier tri numérique franchi</th><td data-review-count="numeric_pass">${c.numeric_pass}</td><td>Les filtres religieux, documentaires et de portefeuille restent à appliquer</td></tr>
</tbody></table></div>
<p>Les stratégies momentum, cassure et repli ont été examinées. Leurs scores n’emploient pas la même formule : les comparer directement donnerait une précision trompeuse. Les trois dossiers ci-dessous sont présentés par ordre alphabétique, sans hiérarchie de rendement attendu.</p>
<p>Une série incomplète ne signifie pas qu’une entreprise est mauvaise. Elle signifie que les calculs ne sont pas suffisamment vérifiables pour cette édition. Les séries utilisables ont été conservées ; les autres n’ont été ni complétées artificiellement ni assimilées à une absence d’occasion sur le marché.</p>
</section>
${cards}
<section class="content-card" id="filtre"><h2>Le filtre islamique reste un contrôle distinct</h2>
<p>La présence de CEG, COP et XOM dans la composition du <a href="${escape(evidence.provider.url)}" target="_blank" rel="noopener noreferrer">${escape(evidence.provider.name)}</a>, datée du ${escape(evidence.provider.composition_as_of)}, est attribuée au fournisseur. Elle ne constitue pas une certification individuelle recalculée pour cette séance.</p>
<p>Parmi les ETF dont l’historique est complet, BITO, ETHT, MSTX, BNO, BTCI et BSEP sont écartés du périmètre retenu en raison de leur recours à des contrats à terme, swaps, options ou levier. Leurs structures ne sont pas assimilées à une détention simple d’actions filtrées.</p>
<p>IBIT et GBTC donnent une exposition au bitcoin au comptant, mais leur conformité islamique individuelle n’a pas été établie dans les documents examinés. Ils ne complètent donc pas le panier. Un statut inconnu n’est pas une déclaration générale d’interdiction.</p>
<div class="takeaway-box"><h3>Pas de ligne ajoutée pour remplir un quota</h3><p>Le panier minimal entièrement contrôlé n’est pas réuni. La revue reste une liste de surveillance ; elle ne présente aucun ETF comme substitut automatiquement conforme.</p></div>
</section>
<section class="content-card" id="contrepoint"><h2>Les objections qui empêchent encore l’achat</h2>
<p><strong>Le bon graphique peut être le mauvais point d’entrée.</strong> Le franchissement du premier filtre mesure une configuration passée. Un écart à l’ouverture, une liquidité dégradée ou un événement nouveau peut la rendre inexploitable. Les graphiques ci-dessus servent au repérage, pas à créer un ordre manquant.</p>
<p><strong>Dividende et rendement ne s’additionnent pas automatiquement.</strong> Les dates de détachement et de paiement ne sont pas établies pour ces dossiers dans les éléments retenus. Un dividende annoncé ne prouve pas qu’un nouvel acheteur y aura droit ; aucune hypothèse de rendement net ou de fiscalité n’est ajoutée.</p>
<p><strong>Financement ne signifie pas toujours dilution.</strong> Il faut identifier le titre émis, son ampleur, son usage et ses conditions. Une émission de dette et une création d’actions ne se traitent pas de la même manière. Une classification incomplète reste un contrôle à terminer.</p>
<p><strong>Trois noms ne forment pas encore un portefeuille.</strong> COP et XOM ajoutent deux expositions au même grand secteur. Leur coexistence demande un examen de concentration ; aucune corrélation chiffrée non vérifiée n’est utilisée pour justifier ce duo.</p>
</section>
<section class="content-card" id="suivi"><h2>Statut du scanner et suivi</h2>
<p>Le <a href="/scanner/status/">tableau de suivi</a> distingue cette revue des signaux et positions historiques. La mise à jour concerne l’information de publication et l’absence de nouveaux ordres éditoriaux validés. Elle ne représente pas un recalcul des performances ou une nouvelle valorisation des positions existantes.</p>
<p>Le contrôle global des rotations demeure incomplet pour la référence EUR/USD, faute d’observations communes suffisantes. Aucun résultat complet de rotation n’est annoncé. Les informations du moteur DTX restent hors du périmètre de cette revue.</p>
<p>La prochaine décision exige une reprise des vérifications documentaires, des événements et du filtre islamique, puis la construction d’un plan cohérent avec le prix réellement disponible. Cette page ne donne ni instruction de sortie sur une position existante, ni autorisation d’utiliser un ancien plan suspendu.</p>
</section>
<section class="content-card" id="sources"><h2>Sources et portée de la revue</h2>
<ul><li>Vivier, séries de cours et contrôles techniques : relevés conservés avec référence de clôture du ${escape(r.reference_close)}.</li><li>Composition islamique : <a href="${escape(evidence.provider.url)}" target="_blank" rel="noopener noreferrer">iShares, composition datée du ${escape(evidence.provider.composition_as_of)}</a>.</li><li>Événements d’entreprise : dépôts réglementaires et calendriers examinés, avec les limites de couverture indiquées dans le texte.</li><li>Graphiques indicatifs : Finviz. Leur actualisation ne modifie pas la date de référence de la revue.</li></ul>
<p><a href="review.json">Statut structuré de la revue</a> · <a href="review-evidence.json">Périmètre et empreintes de contrôle</a> · <a href="/scanner/status/publication.json">Statut de publication du scanner</a></p>
<p>Les nombres publiés décrivent le vivier effectivement contrôlé. Ils ne prouvent ni l’absence de bonnes occasions ailleurs, ni la rentabilité future des dossiers mentionnés.</p>
</section>
</main>
<footer class="article-footer"><p>DailyTickers · Revue du 8 septembre 2026 · Surveillance uniquement</p><p><a href="/?tab=scanner">Toutes les éditions</a> · <a href="/scanner/status/">Suivi des portefeuilles</a></p></footer>
<div class="fnav"><button id="review-nav-button" class="fnav-btn" aria-controls="review-nav-menu" aria-label="Sommaire de l’article" aria-expanded="false"><i class="fas fa-bars" aria-hidden="true"></i><span class="fnav-btn-label">Sommaire</span></button><div id="review-nav-menu" class="fnav-menu"><a class="fnav-item" href="#decision">Décision</a><a class="fnav-item" href="#tri">Le tri</a><a class="fnav-item" href="#ceg">Dossiers</a><a class="fnav-item" href="#filtre">Filtre islamique</a><a class="fnav-item" href="#contrepoint">Objections</a><a class="fnav-item" href="#suivi">Suivi</a></div></div>
<script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script>
<script>
document.querySelectorAll('figure img').forEach(img => { const fallback = () => { img.hidden = true; img.closest('figure').querySelector('.chart-unavailable').hidden = false; }; img.addEventListener('error', fallback); if (img.complete && !img.naturalWidth) fallback(); });
const reviewNavButton = document.getElementById('review-nav-button');
const reviewNavMenu = document.getElementById('review-nav-menu');
function setReviewNav(open) { reviewNavMenu.classList.toggle('open', open); reviewNavButton.classList.toggle('open', open); reviewNavButton.setAttribute('aria-expanded', String(open)); }
reviewNavButton.addEventListener('click', () => setReviewNav(reviewNavButton.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('click', event => { if (!reviewNavButton.contains(event.target) && !reviewNavMenu.contains(event.target)) setReviewNav(false); });
reviewNavMenu.addEventListener('click', event => { if (event.target.closest('a')) setReviewNav(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && reviewNavButton.getAttribute('aria-expanded') === 'true') { setReviewNav(false); reviewNavButton.focus(); } });
</script>
</body></html>\n`;
  if (write) fs.writeFileSync(path.join(dir, 'index.html'), html);
  return { html, bytes: Buffer.byteLength(html), output: path.join(dir, 'index.html') };
}
module.exports = { render };
if (require.main === module) try { console.log(JSON.stringify((({html, ...result}) => result)(render(ROOT, process.argv[2])))); } catch (e) { console.error(e.message); process.exitCode = 1; }
