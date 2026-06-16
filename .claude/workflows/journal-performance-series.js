export const meta = {
  name: 'journal-performance-series',
  description: 'Série FR experte "Journal & Performance" (6 parties) : write → expert panel → fix → senior QA gate',
  phases: [
    { title: 'Write', detail: '6 writers — un article HTML complet par partie' },
    { title: 'Expert', detail: 'panel PM/Quant/Trader/Risk/Editor par partie' },
    { title: 'Fix', detail: 'application des correctifs must-fix par partie' },
    { title: 'SeniorQA', detail: 'gate PASS/FIX/BLOCK par partie + verif conventions' },
  ],
}

// ============================================================================
// SERIE : Mesurer pour Progresser — le Journal & la Revue de Performance
// Theme: AMBRE (#d97706). Gold standard = series/acceleration-ia/part1-supercycle/
// ============================================================================

const BASE = '/series/journal-et-performance/'
const SERIES_TITLE = 'Journal & Performance'

const PARTS = [
  {
    n: 1, slug: 'part1-tenir-le-journal', label: 'Tenir le journal',
    title: 'Pourquoi tenir un journal — et comment vraiment le faire',
    desc: "La pièce manquante de la plupart des investisseurs : le journal de trading. Pourquoi presque tout le monde l'abandonne, quoi consigner exactement (setup, contexte, émotion, capture), le journal minimal viable et les outils pour le tenir sans y passer ses soirées.",
    badges: [
      ['amber', 'fa-book', 'Journal de trading'],
      ['green', 'fa-pen-to-square', 'Quoi consigner'],
      ['purple', 'fa-camera', 'Captures & contexte'],
      ['blue', 'fa-table', 'Modèle minimal'],
    ],
    sections: [
      ['pourquoi', 'Pourquoi un journal change tout'],
      ['abandon', 'Pourquoi on abandonne'],
      ['quoi-consigner', 'Quoi consigner exactement'],
      ['minimal', 'Le journal minimal viable'],
      ['outils', 'Les outils pour tenir le journal'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 1 — POURQUOI TENIR UN JOURNAL, ET COMMENT VRAIMENT LE FAIRE.
Thèse : on ne peut pas améliorer ce qu'on ne mesure pas. Le journal est l'outil n°1 de progression, et pourtant la grande majorité l'abandonne. Le but : un journal qu'on tient VRAIMENT.
Sections :
1) pourquoi : Pourquoi un journal change tout — il transforme l'expérience anecdotique ("je crois que je perds sur les cassures") en données ("je perds 0,4R en moyenne sur les cassures du lundi"). Sans journal, on répète ses erreurs sans les voir. Le journal sépare la décision (bonne/mauvaise) du résultat (gain/perte) — un bon process peut perdre, un mauvais peut gagner par chance.
2) abandon : Pourquoi on abandonne — trop lourd, trop tard (rempli de mémoire le week-end = biaisé), pas exploité (on note mais on ne relit jamais). Antidotes : le remplir À CHAUD juste après le trade, le garder léger, prévoir un rendez-vous de revue.
3) quoi-consigner : Quoi consigner exactement — distinguer les champs objectifs (date, ticker, sens, entrée, stop, sortie, taille, R prévu, R réalisé, setup, régime de marché) des champs subjectifs (état émotionnel, niveau de conviction, respect du plan oui/non, capture d'écran annotée). Insister sur "respect du plan" : c'est LA colonne qui révèle l'indiscipline.
4) minimal : Le journal minimal viable — un tableau de ~10 colonnes qu'on peut remplir en 2 minutes. Donner le modèle exact (compare-table listant chaque colonne + exemple de ligne). Mieux vaut un journal simple tenu qu'un journal parfait abandonné.
5) outils : Les outils — tableur (Google Sheets/Excel) pour démarrer, Notion/Obsidian pour le qualitatif + captures, outils dédiés (Edgewonk, TraderSync, Tradervue) pour l'automatisation. Avantages/limites honnêtes. Recommander de DÉMARRER au tableur. Mentionner que les plans de trading générés par DailyTickers donnent déjà entrée/stop/objectif à recopier.
Charts ECharts (2) : (a) maquette visuelle d'une ligne de journal (ou bar du "taux de respect du plan" par semaine, illustratif), (b) "décision vs résultat" : matrice 2x2 (bonne/mauvaise décision × gain/perte) montrant qu'on doit juger le process. Illustratif.`,
  },
  {
    n: 2, slug: 'part2-metriques', label: 'Métriques clés',
    title: 'R-multiples, expectancy et win rate',
    desc: "Les métriques qui comptent vraiment : le système des R-multiples, l'espérance mathématique (expectancy), le ratio gain/perte, et pourquoi le taux de réussite seul est trompeur. Comment les calculer à partir de son journal.",
    badges: [
      ['amber', 'fa-calculator', 'Expectancy'],
      ['green', 'fa-divide', 'R-multiples'],
      ['purple', 'fa-scale-unbalanced', 'Payoff ratio'],
      ['red', 'fa-triangle-exclamation', 'Win rate trompeur'],
    ],
    sections: [
      ['r-multiple', 'Le système des R-multiples'],
      ['expectancy', 'L\'espérance mathématique'],
      ['payoff', 'Le ratio gain/perte'],
      ['winrate-piege', 'Le piège du taux de réussite'],
      ['calcul', 'Calculer depuis son journal'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 2 — R-MULTIPLES, EXPECTANCY ET WIN RATE.
Thèse : un trader sérieux pense en R, pas en euros, et juge son système par l'espérance, pas par le win rate.
EXACTITUDE QUANT IMPÉRATIVE — toutes les formules doivent être justes.
Sections :
1) r-multiple : Le système des R-multiples. R = le risque initial du trade (distance entrée→stop × taille). Un trade qui rapporte 2× le risque = +2R ; qui touche le stop = −1R. Exprimer tous les trades en R rend les trades comparables quelle que soit la taille. Donner des exemples chiffrés.
2) expectancy : L'espérance mathématique (expectancy) par trade, en R. Formule : Expectancy = (Win% × gain moyen en R) − (Loss% × perte moyenne en R). Exemple : 40% de réussite, gain moyen +2R, perte moyenne −1R → (0,40 × 2) − (0,60 × 1) = 0,80 − 0,60 = +0,20R par trade. Un système est viable si l'expectancy est positive APRÈS coûts. Lier au nombre de trades (l'espérance se réalise sur la durée, loi des grands nombres).
3) payoff : Le ratio gain/perte (payoff ratio) = gain moyen / perte moyenne. Montrer le trade-off win rate ↔ payoff : un win rate de 40% est très rentable avec un payoff de 2,5 ; un win rate de 70% peut être perdant si le payoff est 0,3. Donner un tableau (compare-table) win rate × payoff → expectancy (seuil de rentabilité : Win% = 1/(1+payoff)).
4) winrate-piege : Le piège du taux de réussite — pourquoi viser un win rate élevé pousse à couper les gains tôt et laisser courir les pertes (mortel). Le win rate seul ne dit RIEN sans le payoff. Beaucoup de systèmes gagnants ont un win rate < 50%.
5) calcul : Calculer ces métriques depuis son journal — pas à pas, à partir des colonnes de la partie 1 (R réalisé). Donner la procédure (moyenne des R gagnants, moyenne des R perdants, % de chaque, expectancy). Ultra actionnable.
Charts ECharts (2-3) : (a) distribution des R-multiples d'un échantillon de trades (histogramme illustratif), (b) heatmap/surface win rate × payoff → expectancy avec la frontière de rentabilité, (c) courbe d'equity en R cumulés. Tous illustratifs. Vérifier l'arithmétique.`,
  },
  {
    n: 3, slug: 'part3-mae-mfe', label: 'Qualité d\'exécution',
    title: 'MAE, MFE et la qualité d\'exécution',
    desc: "Au-delà du résultat : la qualité d'exécution. Le MAE et le MFE pour savoir si vos stops sont trop serrés ou trop larges, si vous laissez du profit sur la table, et comment mesurer le slippage et le timing de vos entrées et sorties.",
    badges: [
      ['amber', 'fa-ruler-horizontal', 'MAE / MFE'],
      ['green', 'fa-crosshairs', 'Placement du stop'],
      ['purple', 'fa-hand-holding-dollar', 'Profit laissé'],
      ['red', 'fa-arrow-down-short-wide', 'Slippage'],
    ],
    sections: [
      ['excursions', 'MAE et MFE, définis'],
      ['stops', 'Vos stops sont-ils bien placés ?'],
      ['sorties', 'Laissez-vous du profit sur la table ?'],
      ['slippage', 'Slippage et qualité du fill'],
      ['exploiter', 'Exploiter MAE/MFE dans le journal'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 3 — MAE, MFE ET LA QUALITÉ D'EXÉCUTION.
Thèse : deux trades avec le même résultat peuvent avoir une qualité d'exécution opposée. Mesurer les excursions révèle si vos stops et vos sorties sont bien calibrés.
Sections :
1) excursions : Définitions. MAE (Maximum Adverse Excursion) = la perte latente maximale pendant la vie du trade (jusqu'où ça a été contre vous avant la sortie). MFE (Maximum Favorable Excursion) = le gain latent maximal atteint. Mesurés en R ou en %. Exemples chiffrés.
2) stops : Vos stops sont-ils bien placés ? Analyser le MAE des trades GAGNANTS : si vos gagnants ne vont presque jamais à −0,8R avant de repartir, votre stop à −1R a peut-être de la marge (ou au contraire vos stops trop serrés vous sortent juste avant le rebond). Le MAE des gagnants aide à calibrer le stop. Honnête sur le compromis.
3) sorties : Laissez-vous du profit sur la table ? Comparer le MFE (le meilleur point atteint) au R réalisé : si le MFE moyen est +3R mais que vous sortez à +1R, vous laissez systématiquement du profit — piste pour des sorties partielles ou un trailing. Inversement, viser le MFE parfait est impossible.
4) slippage : Slippage et qualité du fill — l'écart entre le prix prévu (du plan) et le prix d'exécution réel, à l'entrée comme au stop. Le mesurer dans le journal. Sources : spread, ordres au marché sur titres peu liquides, gaps. Lien avec le choix d'ordres limités (renvoi à la série Salarié & Investisseur, partie Set-and-forget).
5) exploiter : Comment ajouter MAE/MFE au journal et s'en servir (deux colonnes de plus). Procédure concrète. Avertir que ça demande de noter les extrêmes — utile surtout pour le swing/position.
Charts ECharts (2-3) : (a) nuage de points MAE vs résultat (gagnants/perdants) montrant une zone de stop optimale, (b) MFE moyen vs R réalisé moyen (profit capté vs disponible), (c) optionnel : distribution du slippage. Illustratifs.`,
  },
  {
    n: 4, slug: 'part4-la-revue', label: 'La revue',
    title: 'La revue : quotidienne, hebdomadaire, mensuelle',
    desc: "Le rituel de revue à trois échelles : le débrief quotidien à chaud, la revue hebdomadaire des process, le bilan mensuel de performance. Lire sa courbe d'equity, analyser ses drawdowns et distinguer la variance d'un vrai problème de système.",
    badges: [
      ['amber', 'fa-calendar-week', 'Revue à 3 échelles'],
      ['green', 'fa-chart-line', 'Courbe d\'equity'],
      ['purple', 'fa-magnifying-glass', 'Variance vs système'],
      ['blue', 'fa-list-check', 'Rituel'],
    ],
    sections: [
      ['cadence', 'Trois échelles de revue'],
      ['quotidienne', 'Le débrief quotidien'],
      ['hebdo', 'La revue hebdomadaire'],
      ['mensuelle', 'Le bilan mensuel'],
      ['variance', 'Variance ou vrai problème ?'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 4 — LA REVUE : QUOTIDIENNE, HEBDOMADAIRE, MENSUELLE.
Thèse : un journal non relu ne sert à rien. La revue est le moment où la donnée devient progression. Trois échelles, trois objectifs différents.
Sections :
1) cadence : Les trois échelles et ce qu'on y regarde — quotidien = exécution & émotion (à chaud), hebdo = process & discipline, mensuel = performance & système. Ne pas tout regarder tout le temps : regarder l'equity mensuellement, pas toutes les heures (anti-anxiété, renvoi à la série Salarié & Investisseur).
2) quotidienne : Le débrief quotidien (5-10 min, le soir) — ai-je respecté mon plan ? Y a-t-il eu un trade impulsif ? Noter l'émotion. PAS de conclusion de performance sur un jour (bruit).
3) hebdo : La revue hebdomadaire (30-45 min, le week-end) — relire tous les trades de la semaine, taux de respect du plan, erreurs récurrentes, qualité d'exécution (MAE/MFE), préparer la semaine. C'est l'échelle la plus utile pour corriger le comportement.
4) mensuelle : Le bilan mensuel — calculer les métriques (expectancy, payoff, win rate, R cumulés, max drawdown), comparer à un indice de référence honnêtement, lire la courbe d'equity (pente, régularité, paliers de DD). Décider des ajustements (jamais sur un seul mois isolé sauf alerte de risque).
5) variance : Distinguer la variance d'un vrai problème de système — une série de pertes peut être du bruit statistique même avec une espérance positive. Comment faire la différence : taille d'échantillon, l'expectancy se dégrade-t-elle structurellement, le respect du plan est-il en cause ? Notion de drawdown attendu vs anormal (renvoi à la série Piloter son Portefeuille). Ne pas saboter un bon système à cause de la variance, ni s'accrocher à un mauvais par déni.
Charts ECharts (2-3) : (a) courbe d'equity avec zones de drawdown annotées, (b) "respect du plan %" par semaine (bar), (c) série de pertes : variance simulée d'un système à espérance positive (plusieurs trajectoires) pour illustrer le bruit. Illustratifs.`,
  },
  {
    n: 5, slug: 'part5-corriger-biais', label: 'Corriger ses biais',
    title: 'Détecter et corriger ses biais par la data',
    desc: "Le journal comme miroir sans complaisance : segmenter ses trades (par setup, par heure, par régime, par émotion) pour débusquer les fuites — revenge trading, overtrading, setups perdants, créneaux défavorables — et couper chirurgicalement ce qui ne marche pas.",
    badges: [
      ['amber', 'fa-microscope', 'Segmentation'],
      ['red', 'fa-fire', 'Revenge & overtrading'],
      ['green', 'fa-scissors', 'Couper les fuites'],
      ['purple', 'fa-clock', 'Créneaux & régimes'],
    ],
    sections: [
      ['miroir', 'Le journal comme miroir'],
      ['segmenter', 'Segmenter pour trouver les fuites'],
      ['comportements', 'Revenge trading & overtrading'],
      ['setups', 'Les setups qui perdent'],
      ['couper', 'Couper ce qui ne marche pas'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 5 — DÉTECTER ET CORRIGER SES BIAIS PAR LA DATA.
Thèse : le journal ne ment pas. Bien segmenté, il révèle exactement où vous perdez de l'argent et de la discipline — et donc quoi couper.
Sections :
1) miroir : Le journal comme miroir sans complaisance. Les biais (sur-confiance, ancrage, aversion à la perte) sont invisibles de l'intérieur ; la data les rend visibles. Distinguer cette série (corriger par la MESURE) de la série psychologie : ici, on prouve le biais par les chiffres.
2) segmenter : Segmenter pour trouver les fuites — découper la performance par dimension : par setup, par jour de semaine / heure, par régime de marché (risk-on/off), par état émotionnel noté, par "plan respecté oui/non". L'expectancy globale cache des poches très rentables et des poches qui saignent. Donner la méthode (tableau croisé).
3) comportements : Revenge trading (retrader immédiatement après une perte pour se refaire) et overtrading (trop de trades, souvent hors plan) — comment les détecter dans la data : trades rapprochés après une perte, trades hors setup, corrélation perte→trade impulsif. Leur coût chiffré (exemple illustratif).
4) setups : Les setups qui perdent — souvent un trader a 1 ou 2 setups rentables et plusieurs qui détruisent la performance. Le montrer par l'expectancy par setup. La discipline consiste à ne garder que ce qui a une espérance positive prouvée.
5) couper : Couper ce qui ne marche pas — la décision actionnable : supprimer les setups à espérance négative, interdire les créneaux/états où l'on est mauvais, plafonner le nombre de trades. "Ne rien faire" est souvent l'amélioration la plus rentable. Reboucler avec la revue (partie 4) et le plan (lien vers la série Plan de Trading).
Charts ECharts (2-3) : (a) expectancy par setup (bar avec positifs/négatifs), (b) performance par jour de semaine ou par heure (bar), (c) "trades impulsifs après une perte" vs trades planifiés (résultat comparé). Illustratifs.`,
  },
  {
    n: 6, slug: 'part6-dashboard', label: 'Tableau de bord',
    title: 'Le tableau de bord du gérant et la boucle d\'amélioration',
    desc: "Tout assembler : bâtir son tableau de bord de performance, les KPIs à suivre, et refermer la boucle plan → trade → journal → revue → ajustement. La checklist maître de la mesure et de l'amélioration continue.",
    badges: [
      ['amber', 'fa-gauge-high', 'Tableau de bord'],
      ['green', 'fa-arrows-spin', 'Boucle d\'amélioration'],
      ['purple', 'fa-key', 'KPIs'],
      ['blue', 'fa-list-check', 'Checklist maître'],
    ],
    sections: [
      ['kpis', 'Les KPIs à suivre'],
      ['dashboard', 'Bâtir son tableau de bord'],
      ['boucle', 'La boucle d\'amélioration continue'],
      ['frequence', 'À quelle fréquence ajuster'],
      ['checklist', 'La checklist maître'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 6 — LE TABLEAU DE BORD DU GÉRANT ET LA BOUCLE D'AMÉLIORATION (clôture de série).
Thèse : la mesure n'a de valeur que dans une boucle. Tout converge vers un tableau de bord vivant et un cycle d'amélioration.
Sections :
1) kpis : Les KPIs à suivre (et ceux à ignorer) — expectancy en R, payoff, win rate, R cumulés, max drawdown, taux de respect du plan, nombre de trades, expectancy par setup. Hiérarchiser : le respect du plan et l'expectancy avant le P&L absolu. Quelques KPIs suivis valent mieux que vingt ignorés.
2) dashboard : Bâtir son tableau de bord — un onglet de synthèse (tableur) alimenté par le journal : métriques clés + courbe d'equity + expectancy par setup, mis à jour automatiquement. Donner la structure (quelles cellules/graphes). Actionnable.
3) boucle : La boucle d'amélioration continue — Plan → Trade → Journal → Revue → Ajustement du plan → … Montrer le cycle (schéma). Chaque série de la collection occupe une case : Plan de Trading (le plan), Salarié & Investisseur (l'exécution dans une vie réelle), Piloter son Portefeuille (le pilotage du risque), Journal & Performance (la mesure). Liens croisés explicites.
4) frequence : À quelle fréquence ajuster — ne pas changer son système après chaque trade (sur-réaction au bruit) ni jamais (déni). Cadence raisonnable : micro-ajustements de comportement chaque semaine, ajustements de système sur un échantillon suffisant (renvoi à la variance, partie 4, et au forward test de Piloter son Portefeuille).
5) checklist : LA checklist maître de la mesure et de l'amélioration (tenir le journal, calculer les métriques, MAE/MFE, revue 3 échelles, segmentation, dashboard, boucle). Livrable phare. Format checklist visuelle.
Inclure un CTA de fin de série + encart "série complète en 6 parties" + liens vers les séries Piloter son Portefeuille, Salarié & Investisseur et Plan de Trading.
Charts ECharts (2) : (a) maquette de tableau de bord (plusieurs mini-indicateurs / gauge + courbe), (b) schéma de la boucle Plan→Trade→Journal→Revue→Ajustement (graph). Illustratifs.`,
  },
]

// ----------------------------------------------------------------------------
// BLOCS FIXES (à coller VERBATIM par les writers) — theme AMBRE
// ----------------------------------------------------------------------------

const THEME_CSS = `<style>
 /* AMBER THEME — Journal & Performance */
 .hero-section { padding:4rem 2rem 8rem 2rem; background:linear-gradient(180deg, #fffbeb 0%, #f8fafc 100%); text-align:center; }
 .hero-date { font-size:0.85rem; font-weight:700; color:#d97706; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem; }
 .hero-badges { display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; margin-top:2rem; }
 .hero-badge { display:inline-flex; align-items:center; gap:0.4rem; padding:0.5rem 1rem; border-radius:99px; font-size:0.8rem; font-weight:700; }
 .hero-badge-amber { background:rgba(217,119,6,0.1); color:#d97706; border:1px solid rgba(217,119,6,0.2); }
 .hero-badge-green { background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); }
 .hero-badge-purple { background:rgba(147,51,234,0.1); color:#9333ea; border:1px solid rgba(147,51,234,0.2); }
 .hero-badge-blue { background:rgba(37,99,235,0.1); color:#2563eb; border:1px solid rgba(37,99,235,0.2); }
 .hero-badge-red { background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }

 .section-divider { display:flex; align-items:center; gap:1rem; margin:3rem 0 2rem; color:#94a3b8; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; }
 .section-divider::before, .section-divider::after { content:''; flex:1; height:1px; background:#e2e8f0; }

 .compare-table { width:100%; border-collapse:separate; border-spacing:0; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; margin:2rem 0; }
 .compare-table th { background:#b45309; color:white; padding:1rem; font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; }
 .compare-table td { padding:0.85rem 1rem; border-bottom:1px solid #f1f5f9; font-size:0.9rem; color:#334155; }
 .compare-table tr:nth-child(even) td { background:#f8fafc; }
 .compare-table tr:last-child td { border-bottom:none; }

 .checklist { list-style:none; padding:0; margin:1.5rem 0; }
 .checklist li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.6rem 0; font-size:0.95rem; color:#334155; line-height:1.5; }
 .checklist li i { margin-top:0.15rem; flex-shrink:0; }

 details { margin:0.75rem 0; }
 details summary { cursor:pointer; padding:1rem 1.25rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; font-weight:700; color:#0f172a; font-size:0.95rem; transition:all 0.2s; list-style:none; }
 details summary::-webkit-details-marker { display:none; }
 details summary::before { content:'\\f059'; font-family:'Font Awesome 6 Free'; font-weight:900; color:#d97706; margin-right:0.75rem; }
 details[open] summary { border-color:#d97706; background:#fffbeb; border-radius:12px 12px 0 0; }
 details .quiz-answer { padding:1rem 1.25rem; background:#f0fdf4; border:1px solid #86efac; border-radius:0 0 12px 12px; font-size:0.9rem; color:#334155; line-height:1.7; }

 .formula-box { background:linear-gradient(135deg, #0f172a 0%, #451a03 100%); color:white; padding:1.5rem 2rem; border-radius:12px; margin:1.5rem 0; text-align:center; font-size:1.3rem; font-weight:700; letter-spacing:0.02em; }
 .formula-box .formula-label { font-size:0.7rem; color:#fcd34d; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.5rem; font-weight:600; }
 .formula-box .formula-highlight { color:#fbbf24; }

 .takeaway-box { background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border:1px solid #d97706; border-radius:16px; padding:2rem; margin:2rem 0; }
 .takeaway-box h3 { color:#b45309; margin-top:0; }
 .takeaway-list { list-style:none; padding:0; margin:0; }
 .takeaway-list li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.75rem 0; font-size:1rem; color:#334155; line-height:1.6; border-bottom:1px solid rgba(217,119,6,0.15); }
 .takeaway-list li:last-child { border-bottom:none; }
 .takeaway-list li i { color:#d97706; margin-top:0.2rem; flex-shrink:0; }

 .next-cta { display:flex; align-items:center; justify-content:center; gap:1rem; padding:2rem; background:linear-gradient(135deg, #b45309 0%, #f59e0b 100%); color:white; border-radius:16px; margin:2rem 0; text-decoration:none; transition:transform 0.2s, box-shadow 0.2s; }
 .next-cta:hover { transform:translateY(-2px); box-shadow:0 12px 30px rgba(217,119,6,0.3); }
 .next-cta .next-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; opacity:0.85; }
 .next-cta .next-title { font-size:1.25rem; font-weight:800; }
 .next-cta i { font-size:1.5rem; }

 .step-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin:2rem 0; }
 .step-card { background:white; border:1px solid #e2e8f0; border-radius:16px; padding:1.5rem; text-align:center; transition:all 0.3s; border-top:4px solid #d97706; }
 .step-card:hover { transform:translateY(-3px); box-shadow:0 12px 30px -8px rgba(0,0,0,0.12); }
 .step-number { width:42px; height:38px; border-radius:12px; background:linear-gradient(135deg, #b45309 0%, #f59e0b 100%); display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:900; color:white; margin:0 auto 0.75rem; }
 .step-card h4 { font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.5rem; }
 .step-card p { font-size:0.85rem; color:#64748b; line-height:1.5; margin:0; }

 .capability-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin:2rem 0; }
 .capability-card { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; transition:all 0.3s; }
 .capability-card:hover { border-color:#d97706; transform:translateY(-2px); box-shadow:0 8px 25px -5px rgba(0,0,0,0.08); }
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
<html lang="fr" data-tags="formation,technique,macro" data-tab="analyses">
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
- Métriques : <div class="metric-card"><div class="metric-value">…</div><div class="metric-label">…</div></div> dans une <div class="metric-grid">.
- Boîtes : pedagogy-box (explication), didactic-box (encadré), alert-box (avertissement). Toutes dans report.css.
- Voix : FT / The Economist + précision d'un terminal. Expert mais accessible, on explique sans condescendre. Pas de hype, pas d'emojis-fusée, pas d'urgence artificielle.
- EXACTITUDE QUANT : toute formule (R-multiple, expectancy, payoff, seuil de rentabilité, MAE/MFE) doit être mathématiquement correcte et cohérente dans les exemples chiffrés. Vérifie l'arithmétique.
- HONNÊTETÉ : ne JAMAIS inventer une statistique présentée comme sourcée ; nombres ILLUSTRATIFS présentés comme tels ("par exemple", "à titre d'illustration"). Aucun événement géopolitique/macro inventé.
- Longueur cible : article riche et dense (≈ 550–750 lignes), 5–6 sections de fond + quiz, 2–4 graphiques ECharts pertinents, une takeaway-box finale et un next-cta.
- ECharts : palette ambre (#d97706, #b45309, #f59e0b, #fcd34d) + rouge #dc2626 (perte/risque), vert #10b981 (gain), violet #9333ea, bleu #2563eb. Ajouter en fin de script un window.addEventListener('resize', ...) qui resize tous les charts.`

const WRITE_SCHEMA = { type: 'object', additionalProperties: false, required: ['path', 'sectionIds', 'charts', 'lineCount'], properties: { path: { type: 'string' }, sectionIds: { type: 'array', items: { type: 'string' } }, charts: { type: 'integer' }, lineCount: { type: 'integer' } } }
const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['mustFix', 'shouldFix', 'severity', 'summary'], properties: { mustFix: { type: 'array', items: { type: 'string' } }, shouldFix: { type: 'array', items: { type: 'string' } }, severity: { type: 'string', enum: ['clean', 'minor', 'major', 'blocker'] }, summary: { type: 'string' } } }
const FIX_SCHEMA = { type: 'object', additionalProperties: false, required: ['applied', 'skipped', 'path'], properties: { applied: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } }, path: { type: 'string' } } }
const QA_SCHEMA = { type: 'object', additionalProperties: false, required: ['verdict', 'conventionsOk', 'remaining', 'note'], properties: { verdict: { type: 'string', enum: ['PASS', 'FIX', 'BLOCK'] }, conventionsOk: { type: 'boolean' }, remaining: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } } }

log(`Série "${SERIES_TITLE}" — 6 parties, pipeline write→expert→fix→seniorQA`)

const results = await pipeline(
  PARTS,
  (p) => agent(
    `Tu es un rédacteur financier expert (voix FT/The Economist) qui écrit en FRANÇAIS. Tu produis la PARTIE ${p.n}/6 de la série pédagogique "${SERIES_TITLE}" — mesurer sa performance et progresser grâce au journal de trading et à la revue.

OBJECTIF : un article HTML statique autonome, profond, rigoureux et ACTIONNABLE. Public : investisseurs retail sérieux qui tradent eux-mêmes.

GOLD STANDARD de structure : /Users/marketwatchxyz/GolandProjects/articles/series/acceleration-ia/part1-supercycle/index.html (lis-le si besoin).

=== BRIEF DE CONTENU ===
${p.brief}

=== SECTIONS (ordre + id d'ancre EXACTS) ===
${p.sections.map(s => `  #${s[0]} → ${s[1]}`).join('\n')}

${CONVENTIONS}

=== ASSEMBLAGE DU FICHIER (ordre strict) ===
Tu écris le fichier complet à : ${p.path}
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
   <div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"> … un <a class="fnav-item" data-section="ID"><i class="fas fa-bookmark"></i><span>Label court</span></a> par section (id EXACTS) … </div>
${FNAV_SCRIPT}

6. <div class="container"> … TOUTES LES SECTIONS … </div>
   Chaque section : <div class="section-divider" id="ID"><i class="fa-solid …" style="color:#d97706;"></i> Titre</div> puis <div class="content-card"> … </div>. Place les conteneurs ECharts <div id="chart-xxx" style="width:100%;height:360px;margin:2rem 0;"></div>. Termine par une <div class="takeaway-box"> ("À retenir — Partie ${p.n}") et un <a class="next-cta">${p.n < 6 ? 'vers la partie suivante' : 'CTA fin de série / retour accueil'}</a>.

7. [SERIES BAR (bas) — COLLER VERBATIM la même qu'au point 4]
${seriesBar(p.n)}

8. [FOOTER — COLLER VERBATIM]
${FOOTER}

9. [SCRIPTS ECHARTS] : <script> … init de tous tes charts + window resize … </script>

10. [SCRIPT TAIL — COLLER VERBATIM]
${SCRIPT_TAIL}

Écris le fichier complet avec Write au chemin exact ${p.path}. Soigne la profondeur, l'exactitude des formules et l'aspect actionnable. Retourne path, sectionIds, charts, lineCount.`,
    { label: `write:p${p.n}`, phase: 'Write', schema: WRITE_SCHEMA }
  ),
  (writeRes, p) => agent(
    `Tu es un PANEL d'experts (Gérant de portefeuille / Quant / Trader discrétionnaire / Risk manager / Éditeur financier FR) qui review la PARTIE ${p.n}/6 "${p.title}" de la série "${SERIES_TITLE}".

Fichier : ${p.path} (lis-le entièrement).

BRIEF attendu :
${p.brief}

Évalue avec exigence :
1. EXACTITUDE QUANT (PRIORITAIRE) : toutes les formules et exemples chiffrés (R-multiples, expectancy = (Win%×gain R) − (Loss%×perte R), payoff = gain moyen/perte moyenne, seuil de rentabilité Win% = 1/(1+payoff), MAE/MFE) sont-ils corrects et cohérents ? Recalcule les exemples. Toute erreur arithmétique = mustFix.
2. PROFONDEUR : va-t-on au fond comme demandé ? Manque-t-il une notion clé du brief ?
3. ACTIONNABILITÉ : modèles de journal, procédures de calcul, tableaux, checklists concrètes ?
4. HONNÊTETÉ : chiffres illustratifs présentés comme tels ; pas d'événement inventé.
5. CONVENTIONS & VOIX : footer article-footer ; scripts (core.js+echarts-responsive.js+tag-renderer.js) ; GTM ; /assets/report.css only ; accents UTF-8 directs ; series-bar ×2 ; fnav cohérent ; voix FT/Economist ; ECharts valides.

Classe : mustFix (faux/cassé/erreur quant/convention violée/non-actionnable) vs shouldFix. severity = clean|minor|major|blocker. Sois précis et concret.`,
    { label: `expert:p${p.n}`, phase: 'Expert', schema: REVIEW_SCHEMA }
  ),
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

Contraintes : ne casse RIEN (HTML/ECharts valides, conventions préservées : footer article-footer, scripts de fin inchangés, /assets/report.css, accents UTF-8 directs, series-bar ×2, GTM). Corrige en priorité toute erreur de formule/arithmétique. Garde profondeur et actionnabilité. Retourne applied, skipped, path.`,
      { label: `fix:p${p.n}`, phase: 'Fix', schema: FIX_SCHEMA }
    )
  },
  (fixRes, p) => agent(
    `Tu es le QA SENIOR final (gate de publication) pour la PARTIE ${p.n}/6 "${p.title}" (${p.path}). Lis le fichier final entièrement.

A. CONVENTIONS (bloquantes) : <!DOCTYPE html> + <html lang="fr" data-tab="analyses"> ; GTM-T5Z595CW ; /assets/report.css (et AUCUN assets/ local) ; bloc <style> theme présent ; brand-bar avec brand-nav ; hero + #article-clickable-tags ; series-bar présent EXACTEMENT 2 fois, partie ${p.n} en current, compteur ${p.n}/6 ; fnav cohérent (data-section = id réels) ; <footer class="article-footer"> uniquement ; scripts de fin = core.js + echarts-responsive.js + tag-renderer.js, rien après </html> ; accents français UTF-8 directs ; pas de JS ECharts cassé.
B. QUALITÉ & QUANT : profondeur réelle, actionnable, voix FT/Economist, chiffres illustratifs honnêtes, ET exactitude des formules/exemples (expectancy, payoff, R, MAE/MFE). Une formule fausse ou un exemple mal calculé = BLOCK.

Verdict : PASS / FIX (mineurs, lister remaining) / BLOCK (convention bloquante ou erreur quant). conventionsOk = true seulement si A entièrement respecté.`,
    { label: `qa:p${p.n}`, phase: 'SeniorQA', schema: QA_SCHEMA }
  )
)

const report = PARTS.map((p, i) => ({ part: p.n, slug: p.slug, path: p.path, qa: results[i] ? results[i].verdict : 'NULL', conventionsOk: results[i] ? results[i].conventionsOk : false, remaining: results[i] ? results[i].remaining : ['pipeline returned null'], note: results[i] ? results[i].note : '' }))
const blockers = report.filter(r => r.qa === 'BLOCK' || r.qa === 'NULL')
log(`Terminé. PASS=${report.filter(r => r.qa === 'PASS').length} FIX=${report.filter(r => r.qa === 'FIX').length} BLOCK=${blockers.length}`)
return { series: SERIES_TITLE, base: BASE, report, blockers: blockers.map(b => b.part) }
