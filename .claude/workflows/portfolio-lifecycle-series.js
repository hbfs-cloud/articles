export const meta = {
  name: 'portfolio-lifecycle-series',
  description: 'Série FR experte "Piloter son Portefeuille" (6 parties) : write → expert panel → fix → senior QA gate',
  phases: [
    { title: 'Write', detail: '6 writers — un article HTML complet par partie' },
    { title: 'Expert', detail: 'panel PM/Quant/Risk/Trader/Editor par partie' },
    { title: 'Fix', detail: 'application des correctifs must-fix par partie' },
    { title: 'SeniorQA', detail: 'gate PASS/FIX/BLOCK par partie + verif conventions' },
  ],
}

// ============================================================================
// SERIE : Piloter son Portefeuille — Démarrer, Scaler, Arrêter
// Theme: TEAL (#0d9488). Gold standard = series/acceleration-ia/part1-supercycle/
// ============================================================================

const BASE = '/series/piloter-son-portefeuille/'
const SERIES_TITLE = 'Piloter son Portefeuille'

const PARTS = [
  {
    n: 1, slug: 'part1-demarrer', label: 'Démarrer',
    title: 'Démarrer sans se faire détruire le jour 1',
    desc: "Comment lancer un portefeuille ou une stratégie sans encaisser un gros drawdown dès le départ : déploiement progressif (ramp-up), dimensionnement initial sous-calibré, échelonnement des entrées et garde-fous jour 1.",
    badges: [
      ['teal', 'fa-rocket', 'Ramp-up progressif'],
      ['amber', 'fa-shield-halved', 'Garde-fous jour 1'],
      ['green', 'fa-layer-group', 'Déploiement par paliers'],
      ['red', 'fa-skull', 'Anti-ruine'],
    ],
    sections: [
      ['cold-start', 'Le problème du démarrage à froid'],
      ['ramp-up', 'Le déploiement progressif'],
      ['sizing-initial', 'Dimensionnement initial sous-calibré'],
      ['echelonner', 'Échelonner les entrées'],
      ['garde-fous', 'Les garde-fous du jour 1'],
      ['plan', 'Plan de démarrage en 8 semaines'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 1 — DÉMARRER SANS SE FAIRE DÉTRUIRE LE JOUR 1.
Thèse : le jour 1 est le moment le plus dangereux du cycle de vie d'un portefeuille — l'edge n'est pas encore confirmé en conditions réelles, il n'existe aucun coussin de gains, et une séquence de pertes initiale (risk of ruin) détruit à la fois le capital et la discipline. La solution n'est jamais "tout déployer d'un coup".
Sections à couvrir (profond + actionnable) :
1) cold-start : Pourquoi le démarrage à froid est dangereux. Notions : risque de ruine (risk of ruin), absence de coussin de gains, biais d'optimisme post-backtest, séquence de pertes en début de vie. Expliquer mathématiquement pourquoi commencer par une perte fait beaucoup plus mal qu'une perte en milieu de parcours (pas de capital "de la maison").
2) ramp-up : Le déploiement progressif. Ne JAMAIS passer de 0 à 100% du capital cible. Paliers illustratifs : 10% → 25% → 50% → 100%, chaque palier débloqué seulement si les N séances/trades précédents se comportent comme attendu (slippage, fills, comportement des stops conformes). Relier explicitement à l'état "deploying" / mode "paper-ramp" de la machine d'états des modes DailyTickers (draft→test→deploying→live).
3) sizing-initial : Démarrer volontairement sous-calibré — taille de position à 1/2 ou 1/3 de la cible, risque par trade 0,25–0,5% du capital au départ contre ~1% en régime de croisière. Justifier : on paie le droit d'apprendre en réel.
4) echelonner : Étaler le déploiement dans le temps (time-diversification) sur 4–8 semaines plutôt qu'un déploiement bloc, pour ne pas entrer tout son capital au sommet d'un régime. Comparer "déploiement bloc" vs "échelonné" en termes de DD potentiel d'entrée.
5) garde-fous : Kill-switch DD (ex. -3% sur capital déployé → pause automatique des nouvelles entrées), plafond de positions ouvertes simultanées, ZÉRO levier au démarrage, journal de trades obligatoire.
6) plan : Un plan de démarrage concret semaine par semaine (S1–S8) sous forme de tableau (compare-table ou step-grid) : capital déployé, taille, risque/trade, condition de passage au palier suivant.
Charts ECharts (2–3) : (a) paliers de ramp-up (bar 10/25/50/100%), (b) courbe equity "déploiement bloc vs échelonné" montrant un DD d'entrée plus profond pour le bloc, (c) risque par trade démarrage vs régime.`,
  },
  {
    n: 2, slug: 'part2-backtest-forward', label: 'Forward test',
    title: 'Du backtest au forward test : franchir le pont',
    desc: "Quand le backtest est bon, comment valider en réel avant d'engager du capital : walk-forward et out-of-sample, paper trading puis paper-ramp, critères de promotion GO/NO-GO chiffrés, évaluation régime-consciente et dégradation attendue de l'edge.",
    badges: [
      ['teal', 'fa-flask-vial', 'Forward test'],
      ['purple', 'fa-shuffle', 'Walk-forward / OOS'],
      ['green', 'fa-circle-check', 'Critères GO/NO-GO'],
      ['red', 'fa-bug', 'Anti-overfit'],
    ],
    sections: [
      ['pourquoi-fwd', 'Pourquoi un backtest ne suffit jamais'],
      ['walk-forward', 'Walk-forward & out-of-sample'],
      ['paper-ramp', 'Paper trading puis paper-ramp'],
      ['criteres-go', 'Critères de promotion GO/NO-GO'],
      ['regime-aware', 'Évaluation régime-consciente'],
      ['degradation', "Budgéter la dégradation de l'edge"],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 2 — DU BACKTEST AU FORWARD TEST.
Thèse : un backtest "OK" est une hypothèse, jamais une preuve. Le passage en réel se fait par étapes mesurées, avec des critères de promotion définis À L'AVANCE.
Sections :
1) pourquoi-fwd : Les pièges qui rendent un backtest trompeur — overfitting (sur-optimisation), look-ahead bias (fuite d'information future), survivorship bias, coûts/slippage/spread sous-estimés, et le fait qu'un backtest couvre souvent un seul régime de marché. Le backtest mesure le passé optimisé ; le forward test mesure le futur inconnu.
2) walk-forward : Walk-forward analysis & out-of-sample. Découper l'historique en in-sample (optimisation) et out-of-sample (validation, jamais vu pendant l'optimisation). Anchored vs rolling window. Le test OOS comme première barrière contre l'overfit.
3) paper-ramp : Paper trading (exécution simulée en temps réel) pour valider fills/spreads/latence/comportement des ordres AVANT capital réel, puis "paper-ramp" — premières entrées en conditions réelles à taille minime pour valider les conditions d'exécution réelles. Relier aux états "test" → "deploying/paper-ramp" de la machine d'états des modes DailyTickers.
4) criteres-go : Tableau de décision GO/NO-GO chiffré (compare-table). Exemples de seuils illustratifs : n trades live ≥ 20–30 (significativité), Profit Factor live ≥ ~0,7× le PF backtest (on tolère une dégradation, mais bornée), drawdown live ≤ DD backtest + marge, hit rate dans l'intervalle de confiance du backtest. Si un critère casse → NO-GO, on reste en paper ou on revient en arrière.
5) regime-aware : RÈGLE CRITIQUE — ne JAMAIS juger une stratégie par un replay uniforme sur toute la période. Les configs sérieuses sont régime-conscientes (filtres de régime) et adaptatives. Évaluer par régime (risk-on / neutre / risk-off via VIX) ET en walk-forward, pas en moyenne plate. Une moyenne full-period masque une stratégie qui marche en risk-on et meurt en risk-off.
6) degradation : La dégradation attendue backtest→live (souvent -20 à -40% de l'edge à cause des coûts réels et du léger overfit résiduel). Comment la budgéter : si la stratégie n'est viable QUE sans dégradation, elle n'est pas viable.
Charts ECharts (2–3) : (a) equity in-sample vs OOS vs live (line, l'OOS et le live un peu sous l'in-sample), (b) distribution/comparaison du PF backtest vs live (bar), (c) optionnel : perf par régime (bar groupé risk-on/neutre/risk-off).`,
  },
  {
    n: 3, slug: 'part3-drawdown', label: 'Drawdown',
    title: 'Dimensionner et défendre contre le drawdown',
    desc: "Le cœur de la survie : risque par trade, vol targeting et ATR sizing, Kelly fractionné, gate de corrélation, DD breaker (coupe-circuit de drawdown) et trailing stops pour ne jamais subir un gros drawdown.",
    badges: [
      ['teal', 'fa-ruler-combined', 'Position sizing'],
      ['red', 'fa-arrow-trend-down', 'DD breaker'],
      ['purple', 'fa-diagram-project', 'Gate de corrélation'],
      ['green', 'fa-lock', 'Lock-in des gains'],
    ],
    sections: [
      ['risque-par-trade', 'Le risque par trade, brique de base'],
      ['vol-targeting', 'Vol targeting & ATR sizing'],
      ['kelly', 'Kelly fractionné'],
      ['correlation', 'Le gate de corrélation'],
      ['dd-breaker', 'Le DD breaker'],
      ['trailing', 'Trailing stops & lock-in'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 3 — DIMENSIONNER & DÉFENDRE CONTRE LE DRAWDOWN.
Thèse : on ne contrôle pas les gains, on contrôle l'exposition. Un gros drawdown n'est presque jamais un problème de "mauvais trade" mais de dimensionnement et de corrélation. Mandat implicite : viser un DD max maîtrisé (ex. ≤ 8%).
Sections :
1) risque-par-trade : Le fixed fractional — risquer un % fixe du capital par trade (ex. 0,5–1%). La taille découle du stop : taille = (capital × risque%) / distance au stop. C'est le stop qui définit la taille, pas l'inverse.
2) vol-targeting : Vol targeting & ATR sizing — dimensionner inversement à la volatilité (via l'ATR) pour cibler une volatilité de portefeuille constante. Position plus petite sur un actif volatil, plus grande sur un actif calme, à risque égal.
3) kelly : Kelly fractionné — donner la formule de Kelly (f* = edge/odds, ou p - q/b), expliquer pourquoi le Kelly PLEIN ruine (variance énorme, sensibilité aux erreurs d'estimation) et pourquoi les pros utilisent 1/4 à 1/2 Kelly. Le sur-dimensionnement est la première cause de ruine des bons systèmes.
4) correlation : Le gate de corrélation & la décorrélation. Plafonner l'exposition à un cluster corrélé (ex. pas plus de N positions semis/IA simultanées) : 10 positions "différentes" toutes corrélées = 1 seul pari géant. Décorréler le book. Montrer une matrice de corrélation illustrative.
5) dd-breaker : Le DD breaker (coupe-circuit). Paliers illustratifs : -8% de DD → on réduit la taille de moitié ; -12% → on passe en pause (plus de nouvelles entrées). Pré-câbler la défense plutôt que d'improviser sous stress. Relier à l'idée de gating du risque dans les modes.
6) trailing : Trailing stops & lock-in des gains — remonter le stop pour protéger le capital accumulé, transformer un gagnant en "trade sans risque" (stop au point mort), équilibrer protection vs bruit (ne pas se faire sortir par le bruit).
Charts ECharts (2–4) : (a) deux courbes equity avec/sans DD breaker (sans = DD profond, avec = DD borné), (b) illustration vol targeting (deux actifs, tailles inverses à la vol), (c) heatmap/matrice de corrélation d'un cluster, (d) Kelly : croissance vs fraction de Kelly (0,25× / 0,5× / 1× / 2×) montrant l'effondrement au-delà du plein Kelly.`,
  },
  {
    n: 4, slug: 'part4-scale-up', label: 'Scale up',
    title: 'Scaler une stratégie gagnante',
    desc: "Comment faire grossir une stratégie qui marche sans casser ce qui marche : quand scaler (edge confirmé, pas une bonne série), paliers conditionnels anti-martingale, pyramidage, contrainte de capacité et liquidité, risque constant en %.",
    badges: [
      ['teal', 'fa-chart-line', 'Scale up'],
      ['green', 'fa-stairs', 'Paliers conditionnels'],
      ['amber', 'fa-water', 'Capacité & liquidité'],
      ['purple', 'fa-arrows-up-to-line', 'Anti-martingale'],
    ],
    sections: [
      ['quand-scaler', 'Quand scaler (et quand surtout pas)'],
      ['comment-scaler', 'Comment scaler par paliers'],
      ['pyramiding', 'Pyramidage vs scaling du book'],
      ['capacite', 'La contrainte de capacité & liquidité'],
      ['discipline', 'Garder le risque constant'],
      ['decorrelate', 'Scaler en diversifiant'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 4 — SCALER UNE STRATÉGIE GAGNANTE.
Thèse : scaler trop tôt ou trop vite tue plus de stratégies que les pertes. On ne scale qu'un edge confirmé, par paliers conditionnels, en gardant le risque relatif constant.
Sections :
1) quand-scaler : On ne scale qu'après un edge CONFIRMÉ en live — assez de trades (n significatif), plusieurs régimes traversés, un drawdown réel vécu et encaissé conformément aux attentes. Pas après une simple bonne série (anti-recency bias). Une bonne série n'est pas une preuve d'edge.
2) comment-scaler : Scaler par paliers CONDITIONNELS et anti-martingale — augmenter la taille seulement après des gains réalisés (jamais "doubler après une perte pour se refaire" = martingale = ruine). Ex. +25% de taille tous les +X% d'equity atteint, ou tous les N trades conformes. Définir les paliers à l'avance.
3) pyramiding : Distinguer le pyramidage (ajouter à une position gagnante individuelle, en remontant le stop pour garder le risque total borné) du scaling du book entier (augmenter la taille de toutes les positions). Ce sont deux décisions différentes.
4) capacite : La contrainte de capacité & liquidité — une stratégie qui marche à 10 k$ peut mourir à 1 M$ (slippage, impact de marché, % de l'ADV/volume quotidien). Avant de scaler, estimer la capacité : à quelle taille l'impact de marché mange l'edge ? Tester l'exécution à taille croissante.
5) discipline : Garder le risque CONSTANT EN % en scalant. On scale la taille absolue, pas le risque relatif par trade. Le piège : le succès gonfle l'ego et le risque par trade dérive de 1% à 3% sans qu'on s'en rende compte.
6) decorrelate : Préférer scaler en AJOUTANT des stratégies/marchés décorrélés plutôt qu'en concentrant davantage la même stratégie. La diversification est une façon de scaler le rendement sans scaler le risque proportionnellement.
Charts ECharts (2–3) : (a) paliers de scaling conditionnels (escalier equity → taille), (b) capacité : edge net vs taille du book (l'edge s'érode quand le slippage monte), (c) équité "scaling discipliné (risque constant)" vs "scaling agressif (risque qui dérive)" — le second a un DD final bien pire.`,
  },
  {
    n: 5, slug: 'part5-pause-vacances', label: 'Pause & vacances',
    title: "Pause, réduction et vacances : piloter l'activité",
    desc: "Réduire ou suspendre proprement sans casser les positions en cours : l'état pausing (sortie organique), le dé-risquage par paliers, comment gérer un portefeuille en vacances loin de l'écran, l'automatisation des garde-fous et la reprise propre.",
    badges: [
      ['teal', 'fa-pause', 'Pausing organique'],
      ['amber', 'fa-umbrella-beach', 'Mode vacances'],
      ['purple', 'fa-robot', 'Garde-fous automatisés'],
      ['green', 'fa-play', 'Reprise propre'],
    ],
    sections: [
      ['pausing', "L'état pausing : la sortie organique"],
      ['reduire', "Réduire l'exposition par paliers"],
      ['vacances', "Piloter loin de l'écran"],
      ['automatisation', 'Automatiser les garde-fous'],
      ['resume', 'Reprendre proprement'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 5 — PAUSE, RÉDUCTION & VACANCES.
Thèse : réduire son activité est une décision de pilotage, pas un aveu d'échec. Bien fait, ça protège le capital sans détruire les trades en cours.
Sections :
1) pausing : L'état "pausing" (sortie organique) de la machine d'états des modes DailyTickers — on coupe les NOUVELLES entrées et la rotation, MAIS les stops (SL), prises de profit (TP), horizon et trailing continuent de gérer les positions ouvertes jusqu'à leur fermeture naturelle ; puis transition vers "paused". C'est la bonne façon de réduire SANS casser des trades sains au pire moment. Opposer à une liquidation brutale.
2) reduire : Réduire l'exposition graduellement — c'est l'inverse du ramp-up. Dé-risquer par paliers : réduire la taille, fermer EN PRIORITÉ les positions les plus risquées / les plus corrélées / les moins convaincues, garder les convictions avec stop serré.
3) vacances : Piloter en vacances / loin de l'écran. Avant de partir : réduire l'exposition, plafonner le nombre de positions, s'assurer que CHAQUE position a un bracket (stop + TP) en place. Débat honnête : resserrer les stops avant de partir (protège mais risque de se faire sortir par le bruit) vs garder les stops normaux (laisse respirer mais expose au gap). Recommandation : réduire la TAILLE plutôt que sur-resserrer les stops ; si on ne peut vraiment pas surveiller, passer en "pausing". Mentionner le risque de gap weekend/overnight.
4) automatisation : Déléguer la discipline à la machine — bracket/OCO orders, trailing stops, alertes de prix, kill-switch DD automatique. Ce qui est automatisé ne dépend pas de votre connexion wifi à la plage.
5) resume : Reprendre proprement ("paused → live", ou re-passer par "deploying" si la pause fut longue ou si le régime a changé). Ne JAMAIS reprendre directement à pleine taille après une longue pause — re-ramper. Vérifier que la thèse et le régime tiennent toujours avant de réactiver.
Charts ECharts (2–3) : (a) timeline "pausing" — les positions ouvertes se ferment une à une via leurs stops/TP, exposition qui décroît en escalier jusqu'à zéro, (b) dé-risquage par paliers (exposition % dans le temps), (c) profil d'exposition avant / pendant / après vacances.`,
  },
  {
    n: 6, slug: 'part6-arreter', label: 'Arrêter',
    title: 'Arrêter proprement et la checklist du gérant',
    desc: "Clore le cycle : stopped (arrêt ordonné) vs liquidated (urgence, force-close), quand tirer la prise selon des critères pré-définis, le wind-down vs la panique, le post-mortem honnête, et la checklist maître du cycle de vie complet.",
    badges: [
      ['teal', 'fa-flag-checkered', 'Arrêt propre'],
      ['red', 'fa-triangle-exclamation', "Liquidation d'urgence"],
      ['purple', 'fa-magnifying-glass-chart', 'Post-mortem'],
      ['green', 'fa-list-check', 'Checklist maître'],
    ],
    sections: [
      ['stopped-vs-liquidated', 'Stopped vs liquidated'],
      ['quand-arreter', 'Quand tirer la prise'],
      ['wind-down', 'Arrêt ordonné vs panique'],
      ['post-mortem', 'Le post-mortem honnête'],
      ['cycle-complet', 'Le cycle de vie complet'],
      ['checklist', 'La checklist maître'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 6 — ARRÊTER PROPREMENT & LA CHECKLIST DU GÉRANT (clôture de série).
Thèse : savoir arrêter est aussi important que savoir démarrer. Un arrêt se décide sur des critères pré-définis, pas sous le coup de l'émotion.
Sections :
1) stopped-vs-liquidated : Deux façons d'arrêter dans la machine d'états des modes DailyTickers. "stopped" = arrêt définitif ordonné, plus de gestion active, on a laissé les positions se clôturer proprement avant. "liquidated" = URGENCE : toutes les positions fermées au marché à la prochaine séance, sans regarder SL/TP/horizon — réservé aux vraies urgences (compliance, panique justifiée, black swan, thèse cassée nette). Tableau comparatif quand utiliser lequel + coût (slippage de liquidation forcée).
2) quand-arreter : Définir les critères d'arrêt AVANT de démarrer. Critères objectifs : edge disparu (PF live sous un seuil sur n trades suffisant), DD max de mandat dépassé, thèse structurellement invalidée, régime durablement défavorable à la stratégie. Distinguer "couper une stratégie morte" de "abandonner sous l'émotion une stratégie en drawdown normal".
3) wind-down : Préférer l'arrêt ordonné (pausing → paused → stopped) à la panique. Réserver "liquidated" aux urgences réelles. La précipitation coûte en slippage et cristallise souvent au pire moment.
4) post-mortem : Le post-mortem honnête — distinguer malchance (variance dans un edge réel) d'un vrai échec d'edge. Archiver l'historique en append-only / frozen (track record honnête, pertes incluses) pour apprendre. Éviter le biais rétrospectif. Questions du post-mortem.
5) cycle-complet : Récapituler TOUT le cycle de vie sous forme de diagramme d'états : draft → test → deploying → live → pausing → paused → stopped (+ liquidated en urgence depuis live/pausing ; + resume paused → live). Faire un graphe ECharts (type 'graph') des états et transitions.
6) checklist : LA checklist maître actionnable du gérant, couvrant tout le cycle (démarrage, validation forward, sizing, défense DD, scaling, pause/vacances, arrêt). Format checklist visuelle. C'est le livrable phare de fin de série.
Inclure un CTA de fin de série (retour accueil) + un encart "série complète en 6 parties".
Charts ECharts (2–3) : (a) graphe de la machine d'états (type graph, nœuds = états, arêtes = transitions), (b) arbre/critères de décision d'arrêt, (c) coût de slippage : liquidation forcée vs sortie organique.`,
  },
]

// ----------------------------------------------------------------------------
// BLOCS FIXES (à coller VERBATIM par les writers) — theme TEAL
// ----------------------------------------------------------------------------

const THEME_CSS = `<style>
 /* TEAL THEME — Piloter son Portefeuille */
 .hero-section { padding:4rem 2rem 8rem 2rem; background:linear-gradient(180deg, #f0fdfa 0%, #f8fafc 100%); text-align:center; }
 .hero-date { font-size:0.85rem; font-weight:700; color:#0d9488; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem; }
 .hero-badges { display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; margin-top:2rem; }
 .hero-badge { display:inline-flex; align-items:center; gap:0.4rem; padding:0.5rem 1rem; border-radius:99px; font-size:0.8rem; font-weight:700; }
 .hero-badge-teal { background:rgba(13,148,136,0.1); color:#0d9488; border:1px solid rgba(13,148,136,0.2); }
 .hero-badge-green { background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); }
 .hero-badge-purple { background:rgba(147,51,234,0.1); color:#9333ea; border:1px solid rgba(147,51,234,0.2); }
 .hero-badge-amber { background:rgba(245,158,11,0.12); color:#d97706; border:1px solid rgba(245,158,11,0.25); }
 .hero-badge-red { background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }

 .section-divider { display:flex; align-items:center; gap:1rem; margin:3rem 0 2rem; color:#94a3b8; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; }
 .section-divider::before, .section-divider::after { content:''; flex:1; height:1px; background:#e2e8f0; }

 .compare-table { width:100%; border-collapse:separate; border-spacing:0; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; margin:2rem 0; }
 .compare-table th { background:#0f766e; color:white; padding:1rem; font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; }
 .compare-table td { padding:0.85rem 1rem; border-bottom:1px solid #f1f5f9; font-size:0.9rem; color:#334155; }
 .compare-table tr:nth-child(even) td { background:#f8fafc; }
 .compare-table tr:last-child td { border-bottom:none; }

 .checklist { list-style:none; padding:0; margin:1.5rem 0; }
 .checklist li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.6rem 0; font-size:0.95rem; color:#334155; line-height:1.5; }
 .checklist li i { margin-top:0.15rem; flex-shrink:0; }

 details { margin:0.75rem 0; }
 details summary { cursor:pointer; padding:1rem 1.25rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; font-weight:700; color:#0f172a; font-size:0.95rem; transition:all 0.2s; list-style:none; }
 details summary::-webkit-details-marker { display:none; }
 details summary::before { content:'\\f059'; font-family:'Font Awesome 6 Free'; font-weight:900; color:#0d9488; margin-right:0.75rem; }
 details[open] summary { border-color:#0d9488; background:#f0fdfa; border-radius:12px 12px 0 0; }
 details .quiz-answer { padding:1rem 1.25rem; background:#f0fdf4; border:1px solid #86efac; border-radius:0 0 12px 12px; font-size:0.9rem; color:#334155; line-height:1.7; }

 .formula-box { background:linear-gradient(135deg, #0f172a 0%, #134e4a 100%); color:white; padding:1.5rem 2rem; border-radius:12px; margin:1.5rem 0; text-align:center; font-size:1.3rem; font-weight:700; letter-spacing:0.02em; }
 .formula-box .formula-label { font-size:0.7rem; color:#5eead4; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.5rem; font-weight:600; }
 .formula-box .formula-highlight { color:#2dd4bf; }

 .takeaway-box { background:linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border:1px solid #0d9488; border-radius:16px; padding:2rem; margin:2rem 0; }
 .takeaway-box h3 { color:#0f766e; margin-top:0; }
 .takeaway-list { list-style:none; padding:0; margin:0; }
 .takeaway-list li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.75rem 0; font-size:1rem; color:#334155; line-height:1.6; border-bottom:1px solid rgba(13,148,136,0.15); }
 .takeaway-list li:last-child { border-bottom:none; }
 .takeaway-list li i { color:#0d9488; margin-top:0.2rem; flex-shrink:0; }

 .next-cta { display:flex; align-items:center; justify-content:center; gap:1rem; padding:2rem; background:linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color:white; border-radius:16px; margin:2rem 0; text-decoration:none; transition:transform 0.2s, box-shadow 0.2s; }
 .next-cta:hover { transform:translateY(-2px); box-shadow:0 12px 30px rgba(13,148,136,0.3); }
 .next-cta .next-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; opacity:0.85; }
 .next-cta .next-title { font-size:1.25rem; font-weight:800; }
 .next-cta i { font-size:1.5rem; }

 .step-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin:2rem 0; }
 .step-card { background:white; border:1px solid #e2e8f0; border-radius:16px; padding:1.5rem; text-align:center; transition:all 0.3s; border-top:4px solid #0d9488; }
 .step-card:hover { transform:translateY(-3px); box-shadow:0 12px 30px -8px rgba(0,0,0,0.12); }
 .step-number { width:42px; height:38px; border-radius:12px; background:linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:900; color:white; margin:0 auto 0.75rem; }
 .step-card h4 { font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.5rem; }
 .step-card p { font-size:0.85rem; color:#64748b; line-height:1.5; margin:0; }

 .capability-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin:2rem 0; }
 .capability-card { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; transition:all 0.3s; }
 .capability-card:hover { border-color:#0d9488; transform:translateY(-2px); box-shadow:0 8px 25px -5px rgba(0,0,0,0.08); }
 .capability-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1rem; margin-bottom:0.75rem; }
 .capability-card h4 { font-size:0.9rem; font-weight:700; color:#0f172a; margin:0 0 0.3rem; }
 .capability-card p { font-size:0.8rem; color:#64748b; margin:0; line-height:1.4; }

 @media (max-width:768px) {
   .hero-section { padding:2.5rem 1rem 5rem; }
   .hero-section h1 { font-size:1.8rem !important; } .hero-badge { font-size:0.7rem; padding:0.35rem 0.75rem; }
   .formula-box { font-size:1rem; padding:1rem 1.25rem; }
   .next-cta { flex-direction:column; text-align:center; }
   .step-grid { grid-template-columns:1fr 1fr; }
   .capability-grid { grid-template-columns:1fr 1fr; }
 }
 @media (max-width:480px) {
   .hero-section h1 { font-size:1.4rem !important; }
   .hero-section { padding:2rem 1rem 4rem; } .hero-badge { font-size:0.65rem; padding:0.3rem 0.6rem; gap:0.25rem; }
   .hero-badges { gap:0.4rem; margin-top:1rem; }
   .formula-box { font-size:0.9rem; padding:0.75rem 1rem; }
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
    Ceci n'est pas un conseil financier.
    <br><a href="/" title="Accueil"><i class="fas fa-house" style="margin-right:4px;"></i></a>
  </footer>`

const SCRIPT_TAIL = `    <script src="/assets/core.js"></script><script src="/assets/echarts-responsive.js"></script>
<script src="/assets/tag-renderer.js"></script>
</body>
</html>`

// FNAV : la balise <button> + le script IIFE (verbatim). Le writer fournit la
// <div class="fnav-menu"> avec les items correspondant à SES sections.
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

function seriesBar(currentN) {
  const steps = PARTS.map(p => {
    const cur = p.n === currentN ? ' current' : ''
    return `<a href="${BASE}${p.slug}/" class="series-step${cur}" title="${p.title}"><span class="series-num">${p.n}</span><span class="series-label">${p.label}</span></a>`
  }).join('')
  const prev = PARTS.find(p => p.n === currentN - 1)
  const next = PARTS.find(p => p.n === currentN + 1)
  const leftArrow = prev
    ? `<a href="${BASE}${prev.slug}/" class="series-arrow" title="${prev.title}"><i class="fas fa-chevron-left"></i></a>`
    : `<span class="series-arrow disabled"><i class="fas fa-chevron-left"></i></span>`
  const rightArrow = next
    ? `<a href="${BASE}${next.slug}/" class="series-arrow" title="${next.title}"><i class="fas fa-chevron-right"></i></a>`
    : `<span class="series-arrow disabled"><i class="fas fa-chevron-right"></i></span>`
  return `<div class="series-bar"><div class="series-bar-inner">${leftArrow}<span class="series-title">${SERIES_TITLE}</span><div class="series-steps">${steps}</div><span class="series-counter">${currentN}/6</span>${rightArrow}</div></div>`
}

function headBlock(p) {
  const fullTitle = `${p.title} | ${SERIES_TITLE} — Partie ${p.n}/6 | DailyTickers`
  const url = `https://articles.dailytickers.com${BASE}${p.slug}/`
  return `<!DOCTYPE html>
<html lang="fr" data-tags="formation,macro,technique" data-tab="analyses">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>${fullTitle}</title>
 <meta name="description" content="${p.desc.replace(/"/g, '&quot;')}">
 <meta property="og:title" content="${p.title} | ${SERIES_TITLE} ${p.n}/6">
 <meta property="og:description" content="${p.desc.replace(/"/g, '&quot;')}">
 <meta property="og:image" content="https://articles.dailytickers.com/favicon.ico">
 <meta property="og:url" content="${url}">
 <meta property="og:type" content="article">
 <link rel="icon" href="/favicon.ico">

 <!-- Google Tag Manager -->
 <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
 new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
 j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
 })(window,document,'script','dataLayer','GTM-T5Z595CW');</script>

 <!-- Fonts & Icons -->
 <link rel="preconnect" href="https://fonts.googleapis.com">
 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
 <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

 <!-- Charts -->
 <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>

 <!-- Base CSS -->
 <link rel="stylesheet" href="/assets/report.css">

 ${THEME_CSS}
</head>
<body>
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T5Z595CW" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
}

const CONVENTIONS = `CONVENTIONS HTML OBLIGATOIRES (le QA rejette sinon) :
- Accents français en UTF-8 DIRECT (résultat, bénéfice, marché, première) — JAMAIS d'entités HTML pour les accents.
- CSS : EXCLUSIVEMENT /assets/report.css + le bloc <style> theme fourni. JAMAIS de dossier assets/ local.
- Footer : EXACTEMENT <footer class="article-footer">. JAMAIS report-footer/site-footer.
- Scripts de fin : le SCRIPT_TAIL fourni (core.js + echarts-responsive.js + tag-renderer.js). RIEN après.
- GTM-T5Z595CW présent (fourni dans le head).
- Tags cliquables : <div id="article-clickable-tags" class="card-tags"> dans le hero.
- Chaque section de contenu dans <div id="ID" class="content-card"> précédée d'un <div class="section-divider" id="ID">. L'id du divider = la cible d'ancre du fnav.
- Métriques : <div class="metric-card"><div class="metric-value">…</div><div class="metric-label">…</div></div> dans une <div class="metric-grid">. (Ces classes existent dans report.css.)
- Boîtes pédagogiques : class="pedagogy-box" (titre h4) ; encadrés didactiques : class="didactic-box" ; alertes : class="alert-box". (Toutes dans report.css.)
- Voix : FT / The Economist + précision d'un terminal. Expert mais accessible, on explique sans condescendre. Pas de hype, pas d'emojis-fusée, pas d'urgence artificielle.
- HONNÊTETÉ DES CHIFFRES : ne JAMAIS inventer une statistique présentée comme sourcée. Les nombres de cet article sont PÉDAGOGIQUES/ILLUSTRATIFS — les présenter explicitement comme des exemples ("par exemple", "à titre d'illustration", "disons"). Pas de fausse source. Pas d'événement géopolitique/macro inventé.
- Longueur cible : article riche et dense (≈ 550–750 lignes), 5–6 sections de fond + quiz, 2–4 graphiques ECharts pertinents, une takeaway-box finale et un next-cta.
- ECharts : palette teal (#0d9488, #0f766e, #14b8a6, #5eead4) + rouge #dc2626 (risque), vert #10b981 (positif), ambre #f59e0b. Ajouter en fin de script un window.addEventListener('resize', ...) qui resize tous les charts.`

// ----------------------------------------------------------------------------
// SCHEMAS
// ----------------------------------------------------------------------------

const WRITE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'sectionIds', 'charts', 'lineCount'],
  properties: {
    path: { type: 'string' },
    sectionIds: { type: 'array', items: { type: 'string' } },
    charts: { type: 'integer' },
    lineCount: { type: 'integer' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mustFix', 'shouldFix', 'severity', 'summary'],
  properties: {
    mustFix: { type: 'array', items: { type: 'string' } },
    shouldFix: { type: 'array', items: { type: 'string' } },
    severity: { type: 'string', enum: ['clean', 'minor', 'major', 'blocker'] },
    summary: { type: 'string' },
  },
}

const FIX_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['applied', 'skipped', 'path'],
  properties: {
    applied: { type: 'array', items: { type: 'string' } },
    skipped: { type: 'array', items: { type: 'string' } },
    path: { type: 'string' },
  },
}

const QA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'conventionsOk', 'remaining', 'note'],
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FIX', 'BLOCK'] },
    conventionsOk: { type: 'boolean' },
    remaining: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
}

// ----------------------------------------------------------------------------
// PIPELINE
// ----------------------------------------------------------------------------

log(`Série "${SERIES_TITLE}" — 6 parties, pipeline write→expert→fix→seniorQA`)

const results = await pipeline(
  PARTS,

  // STAGE 1 — WRITE
  (p) => agent(
    `Tu es un rédacteur financier expert (voix FT/The Economist) qui écrit en FRANÇAIS. Tu produis la PARTIE ${p.n}/6 de la série pédagogique "${SERIES_TITLE} — Démarrer, Scaler, Arrêter".

OBJECTIF : un article HTML statique autonome, profond, rigoureux et ACTIONNABLE, qui va au fond du sujet. Public : investisseurs retail sérieux et avertis qui tradent eux-mêmes.

GOLD STANDARD de structure : /Users/marketwatchxyz/GolandProjects/articles/series/acceleration-ia/part1-supercycle/index.html (lis-le si besoin pour le style des content-card, pedagogy-box, compare-table, metric-grid, step-grid, ECharts).

=== BRIEF DE CONTENU ===
${p.brief}

=== SECTIONS (ordre + id d'ancre EXACTS) ===
${p.sections.map(s => `  #${s[0]} → ${s[1]}`).join('\n')}

${CONVENTIONS}

=== ASSEMBLAGE DU FICHIER (ordre strict) ===
Tu écris le fichier complet à : ${p.path}
Structure exacte, dans cet ordre :
1. [HEAD — COLLER VERBATIM]
${headBlock(p)}

2. [BRAND BAR — COLLER VERBATIM]
${BRAND_BAR}

3. [HERO — à composer] : <section class="hero-section"> avec :
   - <div class="hero-date"><i class="fa-solid fa-arrow-trend-up" style="margin-right:0.4rem;"></i> ${SERIES_TITLE} — Partie ${p.n} sur 6</div>
   - <h1 class="hero-title" style="font-size:2.8rem; max-width:850px; margin:0 auto 1.5rem;">${p.title}</h1>
   - <p class="hero-subtitle">…2–3 phrases d'accroche, voix FT…</p>
   - <div class="hero-badges"> avec ces badges : ${p.badges.map(b => `<span class="hero-badge hero-badge-${b[0]}"><i class="fa-solid ${b[1]}"></i> ${b[2]}</span>`).join(' ')}
   - <div id="article-clickable-tags" class="card-tags" style="margin-top:1.5rem; display:flex; justify-content:center;"></div>
   </section>

4. [SERIES BAR (haut) — COLLER VERBATIM]
${seriesBar(p.n)}

5. [FNAV — composer le menu puis COLLER le bouton+script VERBATIM]
   <div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"> … un <a class="fnav-item" data-section="ID"><i class="fas fa-bookmark"></i><span>Label court</span></a> par section (utilise les id EXACTS ci-dessus) … </div>
${FNAV_SCRIPT}

6. <div class="container"> … TOUTES LES SECTIONS DE CONTENU … </div>
   Chaque section : <div class="section-divider" id="ID"><i class="fa-solid …" style="color:#0d9488;"></i> Titre</div> puis <div class="content-card"> … </div>. Place les conteneurs ECharts <div id="chart-xxx" style="width:100%;height:360px;margin:2rem 0;"></div> dans les bonnes sections. Termine le container par une <div class="takeaway-box"> ("À retenir — Partie ${p.n}") et un <a class="next-cta">${p.n < 6 ? 'vers la partie suivante' : 'CTA fin de série / retour accueil'}</a>.

7. [SERIES BAR (bas) — COLLER VERBATIM la même qu'au point 4]
${seriesBar(p.n)}

8. [FOOTER — COLLER VERBATIM]
${FOOTER}

9. [SCRIPTS ECHARTS] : <script> … init de tous tes charts + window resize … </script>

10. [SCRIPT TAIL — COLLER VERBATIM]
${SCRIPT_TAIL}

Écris le fichier complet avec l'outil Write au chemin exact ${p.path}. Soigne la profondeur et l'aspect actionnable (frameworks chiffrés, tableaux de décision, checklists). Retourne le path, la liste des sectionIds, le nombre de charts et le nombre de lignes du fichier.`,
    { label: `write:p${p.n}`, phase: 'Write', schema: WRITE_SCHEMA }
  ),

  // STAGE 2 — EXPERT PANEL REVIEW
  (writeRes, p) => agent(
    `Tu es un PANEL d'experts (Gérant de portefeuille / Quant / Risk manager / Trader discrétionnaire / Éditeur financier FR) qui review la PARTIE ${p.n}/6 "${p.title}" de la série "${SERIES_TITLE}".

Fichier à reviewer : ${p.path} (lis-le entièrement).

BRIEF attendu pour cette partie :
${p.brief}

Évalue avec exigence, sous 5 angles :
1. EXACTITUDE QUANT/RISK : les concepts (Kelly, vol targeting, walk-forward/OOS, DD breaker, corrélation, ramp-up, machine d'états pausing/liquidated, etc.) sont-ils corrects, précis, sans erreur conceptuelle ? Aucune formule fausse, aucun contresens.
2. PROFONDEUR : va-t-on vraiment "au fond" comme demandé, ou est-ce superficiel ? Manque-t-il une notion clé du brief ?
3. ACTIONNABILITÉ : y a-t-il des frameworks chiffrés, tableaux de décision, paliers, checklists concrètes que le lecteur peut appliquer ? Ou que du discours ?
4. HONNÊTETÉ : des chiffres sont-ils présentés comme des faits sourcés alors qu'ils sont inventés ? (doivent être explicitement illustratifs). Des événements macro/géopo inventés ?
5. CONVENTIONS & VOIX : footer article-footer, scripts (core.js+echarts-responsive.js+tag-renderer.js), GTM, /assets/report.css only, accents UTF-8 directs, pas de CSS local, series-bar présent ×2, fnav cohérent avec les sections, voix FT/Economist (pas de hype). ECharts valides (pas de JS cassé).

Classe chaque problème : mustFix (faux/cassé/convention violée/non-actionnable au point de trahir le brief) vs shouldFix (amélioration). Sois précis et concret (cite la section/l'élément). severity = clean|minor|major|blocker.`,
    { label: `expert:p${p.n}`, phase: 'Expert', schema: REVIEW_SCHEMA }
  ),

  // STAGE 3 — FIX
  (review, p) => {
    if (!review || (review.mustFix.length === 0 && review.severity === 'clean')) {
      return { applied: [], skipped: (review ? review.shouldFix : []), path: p.path }
    }
    return agent(
      `Tu corriges la PARTIE ${p.n}/6 "${p.title}" (${p.path}) selon le panel d'experts. Lis le fichier, applique les correctifs avec Edit/Write.

À CORRIGER IMPÉRATIVEMENT (mustFix) :
${review.mustFix.map((m, i) => `  ${i + 1}. ${m}`).join('\n') || '  (aucun)'}

À AMÉLIORER si rapide et sûr (shouldFix) :
${review.shouldFix.map((m, i) => `  ${i + 1}. ${m}`).join('\n') || '  (aucun)'}

Contraintes : ne casse RIEN (HTML valide, ECharts valides, conventions préservées : footer article-footer, scripts de fin inchangés, /assets/report.css, accents UTF-8 directs, series-bar ×2, GTM). Garde la profondeur et l'aspect actionnable. Préserve la structure d'assemblage. Retourne la liste applied, skipped, et le path.`,
      { label: `fix:p${p.n}`, phase: 'Fix', schema: FIX_SCHEMA }
    )
  },

  // STAGE 4 — SENIOR QA GATE
  (fixRes, p) => agent(
    `Tu es le QA SENIOR final (gate de publication) pour la PARTIE ${p.n}/6 "${p.title}" (${p.path}). Lis le fichier final entièrement.

Vérifie et tranche :
A. CONVENTIONS (bloquantes si violées) : <!DOCTYPE html> + <html lang="fr" data-tab="analyses"> ; GTM-T5Z595CW ; /assets/report.css (et AUCUN assets/ local) ; bloc <style> theme présent ; brand-bar avec brand-nav ; hero + #article-clickable-tags ; series-bar présent EXACTEMENT 2 fois avec la partie ${p.n} en current et le compteur ${p.n}/6 ; fnav cohérent (data-section = id réels) ; <footer class="article-footer"> (et pas d'autre variante) ; scripts de fin = core.js + echarts-responsive.js + tag-renderer.js et rien après </html> ; accents français en UTF-8 direct (pas d'entités pour les accents) ; pas de JS ECharts manifestement cassé.
B. QUALITÉ : profondeur réelle, actionnable, voix FT/Economist, honnêteté des chiffres (illustratifs, pas de fausse source), pas d'événement inventé.

Verdict :
- PASS = publiable tel quel.
- FIX = problèmes mineurs subsistants (liste-les dans remaining) mais non bloquants.
- BLOCK = convention bloquante violée ou erreur factuelle/quant grave (liste dans remaining).
conventionsOk = true seulement si A est entièrement respecté. Sois strict mais factuel.`,
    { label: `qa:p${p.n}`, phase: 'SeniorQA', schema: QA_SCHEMA }
  )
)

// ----------------------------------------------------------------------------
// SYNTHÈSE
// ----------------------------------------------------------------------------
const report = PARTS.map((p, i) => ({
  part: p.n,
  slug: p.slug,
  path: p.path,
  qa: results[i] ? results[i].verdict : 'NULL',
  conventionsOk: results[i] ? results[i].conventionsOk : false,
  remaining: results[i] ? results[i].remaining : ['pipeline returned null'],
  note: results[i] ? results[i].note : '',
}))

const blockers = report.filter(r => r.qa === 'BLOCK' || r.qa === 'NULL')
log(`Terminé. PASS=${report.filter(r => r.qa === 'PASS').length} FIX=${report.filter(r => r.qa === 'FIX').length} BLOCK=${blockers.length}`)

return { series: SERIES_TITLE, base: BASE, report, blockers: blockers.map(b => b.part) }
