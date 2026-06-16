export const meta = {
  name: 'plan-de-trading-series',
  description: 'Série FR experte "Plan & Watchlist" (6 parties) : write → expert panel → fix → senior QA gate',
  phases: [
    { title: 'Write', detail: '6 writers — un article HTML complet par partie' },
    { title: 'Expert', detail: 'panel PM/Trader/Risk/Quant/Editor par partie' },
    { title: 'Fix', detail: 'application des correctifs must-fix par partie' },
    { title: 'SeniorQA', detail: 'gate PASS/FIX/BLOCK par partie + verif conventions' },
  ],
}

// ============================================================================
// SERIE : Le Document Maître — Plan de Trading & Watchlist
// Theme: VIOLET (#7c3aed). Gold standard = series/acceleration-ia/part1-supercycle/
// ============================================================================

const BASE = '/series/plan-de-trading/'
const SERIES_TITLE = 'Plan & Watchlist'

const PARTS = [
  {
    n: 1, slug: 'part1-pourquoi-un-plan', label: 'Pourquoi un plan',
    title: 'Pourquoi un plan de trading écrit change tout',
    desc: "Trader sans plan, c'est improviser avec son argent. Le plan de trading comme contrat avec soi-même : ses composantes, comment il réduit les décisions émotionnelles, et le modèle du document maître à remplir.",
    badges: [
      ['violet', 'fa-file-signature', 'Le document maître'],
      ['green', 'fa-handshake', 'Contrat avec soi'],
      ['blue', 'fa-sitemap', 'Composantes'],
      ['red', 'fa-dice', 'Anti-improvisation'],
    ],
    sections: [
      ['improvisation', 'Trader sans plan = improviser'],
      ['contrat', 'Le plan comme contrat avec soi-même'],
      ['composantes', 'Les composantes d\'un plan'],
      ['emotion', 'Comment le plan désamorce l\'émotion'],
      ['modele', 'Le modèle du document maître'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 1 — POURQUOI UN PLAN DE TRADING ÉCRIT CHANGE TOUT.
Thèse : la différence entre un trader et un parieur tient en un document. Le plan transforme des décisions émotionnelles prises en pleine séance en règles décidées à froid.
Sections :
1) improvisation : Trader sans plan = improviser avec son argent. Sans règles écrites, chaque trade est une décision isolée, vulnérable à l'humeur, au FOMO, au marché. Conséquence : incohérence → impossible d'avoir un edge mesurable (renvoi à la série Journal & Performance : sans cohérence, rien à mesurer).
2) contrat : Le plan comme contrat avec soi-même — écrit, daté, relu. Ce qui n'est pas écrit n'existe pas sous le stress. Le plan engage le "moi à froid" contre le "moi sous pression". L'écrit crée la redevabilité.
3) composantes : Les composantes d'un plan complet (vue d'ensemble, détaillées dans les parties suivantes) : objectifs & contraintes, marchés/univers, edge & setups, règles d'entrée, de sortie et d'invalidation, sizing & risque, watchlist, routine d'exécution, règles de revue. Donner la table des matières du plan.
4) emotion : Comment le plan désamorce l'émotion — en pré-décidant, on n'a plus à "décider" sous stress, juste à exécuter. Les ordres pré-positionnés (renvoi à la série Salarié & Investisseur) sont le plan matérialisé. Le plan ne supprime pas les émotions, il les rend inopérantes sur les décisions.
5) modele : Le modèle du document maître — présenter un squelette de plan (compare-table ou step-grid des sections à remplir), avec pour chaque section une question-clé à laquelle répondre. Le lecteur repart avec le canevas exact à compléter.
Charts ECharts (2) : (a) "décision à froid vs décision en séance" (qualité/cohérence comparée, illustratif), (b) schéma des composantes du plan (graph/arbre). Illustratifs.`,
  },
  {
    n: 2, slug: 'part2-edge-setups', label: 'Edge & setups',
    title: 'Définir son edge et ses setups',
    desc: "Le cœur du plan : qu'est-ce qu'un edge réel, comment décrire un setup de façon non ambiguë (conditions objectives, checklist), et pourquoi un à trois setups maîtrisés battent dix configurations floues.",
    badges: [
      ['violet', 'fa-chess-knight', 'Edge'],
      ['green', 'fa-clipboard-check', 'Setups objectifs'],
      ['blue', 'fa-bullseye', 'Spécialisation'],
      ['amber', 'fa-filter', 'Checklist de setup'],
    ],
    sections: [
      ['edge', 'Qu\'est-ce qu\'un edge ?'],
      ['decrire-setup', 'Décrire un setup sans ambiguïté'],
      ['checklist-setup', 'La checklist de setup'],
      ['specialiser', 'Un à trois setups, pas dix'],
      ['exemples', 'Anatomie d\'un setup'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 2 — DÉFINIR SON EDGE ET SES SETUPS.
Thèse : on ne peut pas exécuter ce qu'on n'a pas défini précisément. Un setup flou produit des trades flous.
Sections :
1) edge : Qu'est-ce qu'un edge ? Un avantage statistique : une situation récurrente où l'espérance est positive (renvoi à l'expectancy de la série Journal & Performance). L'edge peut être technique, fondamental, structurel, comportemental. Honnêteté : beaucoup de traders n'ont pas d'edge identifié — première chose à clarifier. Un edge doit être descriptible et, idéalement, vérifiable (backtest/forward, renvoi à Piloter son Portefeuille).
2) decrire-setup : Décrire un setup sans ambiguïté — transformer "j'achète quand ça a l'air haussier" en conditions objectives qu'une autre personne pourrait appliquer à l'identique (ex. tendance définie par une moyenne mobile, déclencheur de cassure d'un niveau précis, filtre de volume, contexte de régime). Le test : deux personnes lisant le setup prendraient-elles le même trade ?
3) checklist-setup : La checklist de setup — la liste de conditions à valider AVANT d'entrer (toutes cochées = trade valide ; une manque = pas de trade). Donner un exemple de checklist (5-7 critères). C'est l'antidote n°1 à l'impulsivité.
4) specialiser : Un à trois setups maîtrisés battent dix configurations floues — la spécialisation crée la compétence et un échantillon statistique exploitable. Multiplier les setups dilue l'attention et empêche de mesurer quoi que ce soit. Recommander de commencer avec UN setup.
5) exemples : Anatomie d'un setup complet (exemple illustratif détaillé, sans recommandation d'achat réel) : nom, contexte/régime, conditions d'entrée objectives, signal de déclenchement, ce qui l'invalide. Présenter comme exemple pédagogique.
Charts ECharts (2-3) : (a) schéma annoté d'un setup (niveaux/déclencheur, illustratif — peut être un line chart stylisé avec markLine/markPoint), (b) "compétence vs nombre de setups" (illustratif), (c) optionnel : checklist visuelle. Illustratifs, pas de recommandation réelle.`,
  },
  {
    n: 3, slug: 'part3-entrees-sorties', label: 'Entrées & sorties',
    title: 'Règles d\'entrée, de sortie et d\'invalidation',
    desc: "Le squelette opérationnel du trade : déclencheurs d'entrée précis, placement du stop sur l'invalidation de la thèse (pas un montant arbitraire), objectifs et sorties partielles, et ce qui invalide un trade avant même d'entrer.",
    badges: [
      ['violet', 'fa-right-to-bracket', 'Entrée'],
      ['red', 'fa-circle-xmark', 'Invalidation'],
      ['green', 'fa-flag-checkered', 'Sorties'],
      ['blue', 'fa-arrows-split-up-and-left', 'Sorties partielles'],
    ],
    sections: [
      ['entree', 'Le déclencheur d\'entrée'],
      ['invalidation', 'Le stop : invalidation, pas montant'],
      ['objectifs', 'Objectifs et sorties partielles'],
      ['avant-entree', 'Ce qui invalide avant d\'entrer'],
      ['gestion', 'Gérer le trade une fois entré'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 3 — RÈGLES D'ENTRÉE, DE SORTIE ET D'INVALIDATION.
Thèse : un trade est défini par ses sorties autant que par son entrée. Le stop n'est pas un montant qu'on "accepte de perdre" : c'est le prix qui prouve qu'on avait tort.
Sections :
1) entree : Le déclencheur d'entrée — précis et objectif (ex. franchissement d'un niveau à la clôture, repli sur un support avec signal). Distinguer le signal (condition réunie) du déclencheur (l'événement qui fait passer l'ordre). Entrer sur déclencheur, pas sur anticipation.
2) invalidation : Le stop placé sur l'INVALIDATION de la thèse, pas sur un montant arbitraire. Le stop doit être là où, si le prix l'atteint, le setup n'est plus valide (ex. sous le support qui définissait l'idée). La taille s'ajuste ensuite pour que ce stop ne coûte qu'un % défini du capital (renvoi à Piloter son Portefeuille, partie sizing). Erreur classique : placer le stop selon ce qu'on accepte de perdre, pas selon le marché.
3) objectifs : Objectifs et sorties partielles — définir où l'on prend des profits (niveau technique, multiple de R), l'usage des sorties partielles (sécuriser une partie, laisser courir le reste avec un trailing), le ratio risque/récompense minimal exigé pour prendre le trade (ex. ≥ 1,5–2 R). Lier au MFE (série Journal) pour calibrer.
4) avant-entree : Ce qui invalide un trade AVANT d'entrer — filtres d'exclusion : R/R insuffisant au prix actuel (ne pas courir après), earnings imminents, news, liquidité faible, corrélation avec une position existante, régime défavorable. Pré-écrire ces vetos.
5) gestion : Gérer le trade une fois entré — règles de déplacement du stop (au point mort, trailing), quand NE PAS toucher (ne pas déplacer le stop à la perte = règle d'or), quoi faire sur un gap. La discipline = suivre les règles écrites, pas l'émotion du moment.
Charts ECharts (2-3) : (a) schéma d'un trade complet (entrée/stop-invalidation/objectifs/sorties partielles sur un line stylisé avec markLine/markArea), (b) R/R et seuil minimal (illustratif), (c) optionnel : effet des sorties partielles sur la distribution des résultats. Illustratifs.`,
  },
  {
    n: 4, slug: 'part4-sizing-risque', label: 'Sizing & risque',
    title: 'Le sizing et le risque dans le plan',
    desc: "Intégrer le risque au plan : le risque par trade, l'exposition maximale, les règles de corrélation et de réduction. Le plan dicte la taille de chaque position — pas l'envie du moment.",
    badges: [
      ['violet', 'fa-ruler-combined', 'Sizing'],
      ['red', 'fa-gauge-high', 'Exposition max'],
      ['blue', 'fa-diagram-project', 'Corrélation'],
      ['green', 'fa-shield-halved', 'Règles de réduction'],
    ],
    sections: [
      ['risque-trade', 'Le risque par trade dans le plan'],
      ['exposition', 'L\'exposition maximale'],
      ['correlation', 'Les règles de corrélation'],
      ['reduction', 'Les règles de réduction'],
      ['integration', 'Intégrer le sizing au plan'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 4 — LE SIZING ET LE RISQUE DANS LE PLAN.
Thèse : le plan ne se contente pas de dire quoi acheter, il dit COMBIEN. Le sizing est la variable qui décide de la survie. (Cette partie articule les principes de la série Piloter son Portefeuille DANS le document de plan.)
Sections :
1) risque-trade : Le risque par trade comme règle écrite — un % fixe du capital (ex. 0,5–1%). La taille = (capital × risque%) / distance au stop. Rappeler que le stop (partie 3) définit la taille, et l'écrire noir sur blanc dans le plan. EXACTITUDE : exemple chiffré correct.
2) exposition : L'exposition maximale — plafonds écrits : risque total simultané (somme des risques ouverts), nombre maximal de positions, exposition par secteur/thème. Empêche le portefeuille de devenir un pari géant sans s'en rendre compte.
3) correlation : Les règles de corrélation — plafonner les positions corrélées (ex. pas plus de N noms d'un même cluster IA/semis). 10 positions corrélées = 1 seul risque. Renvoi à Piloter son Portefeuille (gate de corrélation).
4) reduction : Les règles de réduction écrites — paliers de DD qui réduisent la taille ou stoppent les entrées (DD breaker), réduction avant événements, en régime défavorable. Pré-câbler la défense (renvoi à Piloter son Portefeuille).
5) integration : Intégrer le sizing au plan — une section "Risque" du document maître : risque/trade, exposition max, corrélation max, paliers de réduction, levier (zéro pour débuter). Donner le gabarit. Lier au calcul automatique (tableur).
Charts ECharts (2-3) : (a) taille de position en fonction de la distance au stop à risque constant (line/bar illustratif), (b) exposition cumulée vs plafonds (bar avec markLine), (c) optionnel : paliers du DD breaker. Illustratifs, arithmétique vérifiée.`,
  },
  {
    n: 5, slug: 'part5-watchlist', label: 'Watchlist',
    title: 'Bâtir et entretenir sa watchlist',
    desc: "La watchlist, antichambre du plan : définir son univers, screener selon ses critères, annoter les niveaux clés, poser des alertes et la faire tourner. Comment passer du screening au candidat réellement actionnable.",
    badges: [
      ['violet', 'fa-binoculars', 'Watchlist'],
      ['green', 'fa-magnifying-glass-chart', 'Screening'],
      ['blue', 'fa-bell', 'Alertes & niveaux'],
      ['amber', 'fa-rotate', 'Rotation'],
    ],
    sections: [
      ['pourquoi-watchlist', 'Pourquoi une watchlist'],
      ['univers', 'Définir son univers'],
      ['screening', 'Screener selon ses critères'],
      ['annoter', 'Annoter les niveaux et poser des alertes'],
      ['entretenir', 'Entretenir et faire tourner'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 5 — BÂTIR ET ENTRETENIR SA WATCHLIST.
Thèse : on ne traque pas tout le marché. La watchlist est le filtre qui transforme le bruit en quelques candidats préparés à l'avance — condition d'une exécution sereine (lien avec la série Salarié & Investisseur : préparer le soir).
Sections :
1) pourquoi-watchlist : Pourquoi une watchlist — concentrer l'attention, connaître ses titres (comportement, niveaux, volatilité), être prêt quand le setup se présente plutôt que de découvrir un titre en urgence. La préparation bat la réaction.
2) univers : Définir son univers — choisir un périmètre cohérent avec son edge (ex. grandes capitalisations US liquides, ou un secteur maîtrisé). Critères de liquidité (volume/ADV) pour garantir une exécution propre. Ni trop large (ingérable) ni trop étroit.
3) screening : Screener selon ses critères — traduire son edge en filtres (tendance, volatilité, volume, catalyseur, fondamentaux). Du screen large à la shortlist. Mentionner les outils DailyTickers : le scanner, RunScreener, le radar et les plans de trading générés comme sources de candidats pré-filtrés. La watchlist = la sortie du screen, revue régulièrement.
4) annoter : Annoter les niveaux clés et poser des alertes — pour chaque titre : niveaux de support/résistance, le déclencheur attendu, le contexte. Poser des alertes de prix pour ne pas surveiller en continu (lien Salarié & Investisseur). Une watchlist annotée = un plan d'action prêt.
5) entretenir : Entretenir et faire tourner — la watchlist est vivante : retirer ce qui n'est plus pertinent, ajouter les nouveaux candidats, mettre à jour les niveaux après chaque séance/semaine. Routine de mise à jour (renvoi à la revue de la série Journal & Performance). Éviter l'inflation (une watchlist de 100 titres ne se suit pas).
Charts ECharts (2) : (a) entonnoir univers → screen → shortlist → watchlist (funnel illustratif), (b) maquette de watchlist annotée (titre × niveau × déclencheur × alerte) ou bar du nombre de candidats par étape. Illustratifs.`,
  },
  {
    n: 6, slug: 'part6-execution', label: 'Exécution',
    title: 'Du plan à l\'exécution : routine et checklist',
    desc: "Faire vivre le plan : la routine quotidienne d'exécution, la préparation pré-marché, le passage d'ordres, la revue post-trade, et la checklist maître qui relie le plan, la watchlist, l'exécution et le journal.",
    badges: [
      ['violet', 'fa-person-running', 'Exécution'],
      ['green', 'fa-clipboard-list', 'Routine'],
      ['blue', 'fa-circle-check', 'Pré-marché'],
      ['amber', 'fa-list-check', 'Checklist maître'],
    ],
    sections: [
      ['routine', 'La routine d\'exécution'],
      ['pre-marche', 'La préparation pré-marché'],
      ['passage-ordres', 'Le passage d\'ordres'],
      ['post-trade', 'La revue post-trade'],
      ['checklist', 'La checklist maître'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 6 — DU PLAN À L'EXÉCUTION : ROUTINE ET CHECKLIST (clôture de série).
Thèse : un plan non exécuté avec discipline ne vaut rien. L'exécution est une routine, pas un acte d'inspiration. Cette partie relie toutes les séries de la collection.
Sections :
1) routine : La routine d'exécution — un déroulé reproductible : préparer (watchlist), guetter le déclencheur, exécuter via ordres pré-positionnés, consigner au journal. La routine remplace la motivation.
2) pre-marche : La préparation pré-marché (ou du soir pour un salarié) — revoir la watchlist, vérifier le calendrier (earnings/macro), définir les ordres du jour, vérifier qu'aucun veto (partie 3) ne s'applique. Donner une mini-checklist pré-séance.
3) passage-ordres : Le passage d'ordres — traduire le plan en ordres concrets : entrée (limite/stop), stop d'invalidation, objectifs, via bracket/OCO pour ne pas surveiller (renvoi explicite à la série Salarié & Investisseur, Set-and-forget). Vérifier la taille (partie 4) avant de valider.
4) post-trade : La revue post-trade — consigner immédiatement le trade au journal (renvoi explicite à la série Journal & Performance) : respect du plan, émotion, MAE/MFE, leçon. La boucle plan → trade → journal → revue → ajustement du plan.
5) checklist : LA checklist maître qui relie tout — le plan (cette série), le sizing/risque (Piloter son Portefeuille), l'exécution dans une vie de salarié (Salarié & Investisseur), la mesure (Journal & Performance). Format checklist visuelle, livrable phare.
Inclure un CTA de fin de série + encart "série complète en 6 parties" + liens vers les trois autres séries de la collection (piloter-son-portefeuille, salarie-investisseur, journal-et-performance).
Charts ECharts (2) : (a) la routine quotidienne (timeline/step), (b) la boucle plan→trade→journal→revue→ajustement (graph) reliant les 4 séries. Illustratifs.`,
  },
]

// ----------------------------------------------------------------------------
// BLOCS FIXES (à coller VERBATIM par les writers) — theme VIOLET
// ----------------------------------------------------------------------------

const THEME_CSS = `<style>
 /* VIOLET THEME — Plan & Watchlist */
 .hero-section { padding:4rem 2rem 8rem 2rem; background:linear-gradient(180deg, #f5f3ff 0%, #f8fafc 100%); text-align:center; }
 .hero-date { font-size:0.85rem; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem; }
 .hero-badges { display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; margin-top:2rem; }
 .hero-badge { display:inline-flex; align-items:center; gap:0.4rem; padding:0.5rem 1rem; border-radius:99px; font-size:0.8rem; font-weight:700; }
 .hero-badge-violet { background:rgba(124,58,237,0.1); color:#7c3aed; border:1px solid rgba(124,58,237,0.2); }
 .hero-badge-green { background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); }
 .hero-badge-blue { background:rgba(37,99,235,0.1); color:#2563eb; border:1px solid rgba(37,99,235,0.2); }
 .hero-badge-amber { background:rgba(245,158,11,0.12); color:#d97706; border:1px solid rgba(245,158,11,0.25); }
 .hero-badge-red { background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }

 .section-divider { display:flex; align-items:center; gap:1rem; margin:3rem 0 2rem; color:#94a3b8; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; }
 .section-divider::before, .section-divider::after { content:''; flex:1; height:1px; background:#e2e8f0; }

 .compare-table { width:100%; border-collapse:separate; border-spacing:0; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; margin:2rem 0; }
 .compare-table th { background:#6d28d9; color:white; padding:1rem; font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; }
 .compare-table td { padding:0.85rem 1rem; border-bottom:1px solid #f1f5f9; font-size:0.9rem; color:#334155; }
 .compare-table tr:nth-child(even) td { background:#f8fafc; }
 .compare-table tr:last-child td { border-bottom:none; }

 .checklist { list-style:none; padding:0; margin:1.5rem 0; }
 .checklist li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.6rem 0; font-size:0.95rem; color:#334155; line-height:1.5; }
 .checklist li i { margin-top:0.15rem; flex-shrink:0; }

 details { margin:0.75rem 0; }
 details summary { cursor:pointer; padding:1rem 1.25rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; font-weight:700; color:#0f172a; font-size:0.95rem; transition:all 0.2s; list-style:none; }
 details summary::-webkit-details-marker { display:none; }
 details summary::before { content:'\\f059'; font-family:'Font Awesome 6 Free'; font-weight:900; color:#7c3aed; margin-right:0.75rem; }
 details[open] summary { border-color:#7c3aed; background:#f5f3ff; border-radius:12px 12px 0 0; }
 details .quiz-answer { padding:1rem 1.25rem; background:#f0fdf4; border:1px solid #86efac; border-radius:0 0 12px 12px; font-size:0.9rem; color:#334155; line-height:1.7; }

 .formula-box { background:linear-gradient(135deg, #0f172a 0%, #3b0764 100%); color:white; padding:1.5rem 2rem; border-radius:12px; margin:1.5rem 0; text-align:center; font-size:1.3rem; font-weight:700; letter-spacing:0.02em; }
 .formula-box .formula-label { font-size:0.7rem; color:#c4b5fd; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.5rem; font-weight:600; }
 .formula-box .formula-highlight { color:#a78bfa; }

 .takeaway-box { background:linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border:1px solid #7c3aed; border-radius:16px; padding:2rem; margin:2rem 0; }
 .takeaway-box h3 { color:#6d28d9; margin-top:0; }
 .takeaway-list { list-style:none; padding:0; margin:0; }
 .takeaway-list li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.75rem 0; font-size:1rem; color:#334155; line-height:1.6; border-bottom:1px solid rgba(124,58,237,0.15); }
 .takeaway-list li:last-child { border-bottom:none; }
 .takeaway-list li i { color:#7c3aed; margin-top:0.2rem; flex-shrink:0; }

 .next-cta { display:flex; align-items:center; justify-content:center; gap:1rem; padding:2rem; background:linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%); color:white; border-radius:16px; margin:2rem 0; text-decoration:none; transition:transform 0.2s, box-shadow 0.2s; }
 .next-cta:hover { transform:translateY(-2px); box-shadow:0 12px 30px rgba(124,58,237,0.3); }
 .next-cta .next-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; opacity:0.85; }
 .next-cta .next-title { font-size:1.25rem; font-weight:800; }
 .next-cta i { font-size:1.5rem; }

 .step-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin:2rem 0; }
 .step-card { background:white; border:1px solid #e2e8f0; border-radius:16px; padding:1.5rem; text-align:center; transition:all 0.3s; border-top:4px solid #7c3aed; }
 .step-card:hover { transform:translateY(-3px); box-shadow:0 12px 30px -8px rgba(0,0,0,0.12); }
 .step-number { width:42px; height:38px; border-radius:12px; background:linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%); display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:900; color:white; margin:0 auto 0.75rem; }
 .step-card h4 { font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.5rem; }
 .step-card p { font-size:0.85rem; color:#64748b; line-height:1.5; margin:0; }

 .capability-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin:2rem 0; }
 .capability-card { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; transition:all 0.3s; }
 .capability-card:hover { border-color:#7c3aed; transform:translateY(-2px); box-shadow:0 8px 25px -5px rgba(0,0,0,0.08); }
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
- Voix : FT / The Economist + précision d'un terminal. Expert mais accessible. Pas de hype, pas d'emojis-fusée, pas d'urgence artificielle.
- PAS DE RECOMMANDATION RÉELLE : les setups/titres cités sont des EXEMPLES PÉDAGOGIQUES, jamais des conseils d'achat. Le présenter clairement.
- EXACTITUDE : toute formule de sizing/risque (taille = capital×risque%/distance, R/R) doit être correcte et cohérente dans les exemples.
- HONNÊTETÉ : nombres ILLUSTRATIFS présentés comme tels ; pas d'événement géopolitique/macro inventé ; pas de fausse source.
- Longueur cible : article riche et dense (≈ 550–750 lignes), 5–6 sections de fond + quiz, 2–4 graphiques ECharts pertinents, une takeaway-box finale et un next-cta.
- ECharts : palette violet (#7c3aed, #6d28d9, #8b5cf6, #c4b5fd) + rouge #dc2626 (invalidation/risque), vert #10b981 (objectif/positif), bleu #2563eb, ambre #f59e0b. Ajouter en fin de script un window.addEventListener('resize', ...) qui resize tous les charts.`

const WRITE_SCHEMA = { type: 'object', additionalProperties: false, required: ['path', 'sectionIds', 'charts', 'lineCount'], properties: { path: { type: 'string' }, sectionIds: { type: 'array', items: { type: 'string' } }, charts: { type: 'integer' }, lineCount: { type: 'integer' } } }
const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['mustFix', 'shouldFix', 'severity', 'summary'], properties: { mustFix: { type: 'array', items: { type: 'string' } }, shouldFix: { type: 'array', items: { type: 'string' } }, severity: { type: 'string', enum: ['clean', 'minor', 'major', 'blocker'] }, summary: { type: 'string' } } }
const FIX_SCHEMA = { type: 'object', additionalProperties: false, required: ['applied', 'skipped', 'path'], properties: { applied: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } }, path: { type: 'string' } } }
const QA_SCHEMA = { type: 'object', additionalProperties: false, required: ['verdict', 'conventionsOk', 'remaining', 'note'], properties: { verdict: { type: 'string', enum: ['PASS', 'FIX', 'BLOCK'] }, conventionsOk: { type: 'boolean' }, remaining: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } } }

log(`Série "${SERIES_TITLE}" — 6 parties, pipeline write→expert→fix→seniorQA`)

const results = await pipeline(
  PARTS,
  (p) => agent(
    `Tu es un rédacteur financier expert (voix FT/The Economist) qui écrit en FRANÇAIS. Tu produis la PARTIE ${p.n}/6 de la série pédagogique "${SERIES_TITLE}" — construire et exécuter un plan de trading écrit, et bâtir sa watchlist.

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
   Chaque section : <div class="section-divider" id="ID"><i class="fa-solid …" style="color:#7c3aed;"></i> Titre</div> puis <div class="content-card"> … </div>. Place les conteneurs ECharts <div id="chart-xxx" style="width:100%;height:360px;margin:2rem 0;"></div>. Termine par une <div class="takeaway-box"> ("À retenir — Partie ${p.n}") et un <a class="next-cta">${p.n < 6 ? 'vers la partie suivante' : 'CTA fin de série / retour accueil'}</a>.

7. [SERIES BAR (bas) — COLLER VERBATIM la même qu'au point 4]
${seriesBar(p.n)}

8. [FOOTER — COLLER VERBATIM]
${FOOTER}

9. [SCRIPTS ECHARTS] : <script> … init de tous tes charts + window resize … </script>

10. [SCRIPT TAIL — COLLER VERBATIM]
${SCRIPT_TAIL}

Écris le fichier complet avec Write au chemin exact ${p.path}. Soigne la profondeur et l'aspect actionnable (gabarits de plan, checklists, exemples pédagogiques). Retourne path, sectionIds, charts, lineCount.`,
    { label: `write:p${p.n}`, phase: 'Write', schema: WRITE_SCHEMA }
  ),
  (writeRes, p) => agent(
    `Tu es un PANEL d'experts (Gérant de portefeuille / Trader discrétionnaire / Risk manager / Quant / Éditeur financier FR) qui review la PARTIE ${p.n}/6 "${p.title}" de la série "${SERIES_TITLE}".

Fichier : ${p.path} (lis-le entièrement).

BRIEF attendu :
${p.brief}

Évalue avec exigence :
1. EXACTITUDE MÉTIER : concepts (edge, setup objectif, stop sur invalidation, R/R, sizing, watchlist/screening) corrects et précis ; exemples de sizing/R-R arithmétiquement justes.
2. PROFONDEUR : va-t-on au fond comme demandé ? Manque-t-il une notion clé du brief ?
3. ACTIONNABILITÉ : gabarits de plan, checklists de setup, règles écrites, procédure de watchlist concrètes ?
4. HONNÊTETÉ & PRUDENCE : exemples de titres/setups présentés comme PÉDAGOGIQUES (pas de conseil d'achat) ; chiffres illustratifs ; pas d'événement inventé.
5. CONVENTIONS & VOIX : footer article-footer ; scripts (core.js+echarts-responsive.js+tag-renderer.js) ; GTM ; /assets/report.css only ; accents UTF-8 directs ; series-bar ×2 ; fnav cohérent ; voix FT/Economist ; ECharts valides.

Classe : mustFix (faux/cassé/erreur de calcul/convention violée/recommandation réelle déguisée/non-actionnable) vs shouldFix. severity = clean|minor|major|blocker. Sois précis et concret.`,
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

Contraintes : ne casse RIEN (HTML/ECharts valides, conventions préservées : footer article-footer, scripts de fin inchangés, /assets/report.css, accents UTF-8 directs, series-bar ×2, GTM). Garde profondeur, exemples pédagogiques (pas de conseil réel) et actionnabilité. Retourne applied, skipped, path.`,
      { label: `fix:p${p.n}`, phase: 'Fix', schema: FIX_SCHEMA }
    )
  },
  (fixRes, p) => agent(
    `Tu es le QA SENIOR final (gate de publication) pour la PARTIE ${p.n}/6 "${p.title}" (${p.path}). Lis le fichier final entièrement.

A. CONVENTIONS (bloquantes) : <!DOCTYPE html> + <html lang="fr" data-tab="analyses"> ; GTM-T5Z595CW ; /assets/report.css (et AUCUN assets/ local) ; bloc <style> theme présent ; brand-bar avec brand-nav ; hero + #article-clickable-tags ; series-bar présent EXACTEMENT 2 fois, partie ${p.n} en current, compteur ${p.n}/6 ; fnav cohérent (data-section = id réels) ; <footer class="article-footer"> uniquement ; scripts de fin = core.js + echarts-responsive.js + tag-renderer.js, rien après </html> ; accents français UTF-8 directs ; pas de JS ECharts cassé.
B. QUALITÉ : profondeur réelle, actionnable, voix FT/Economist, exemples présentés comme pédagogiques (pas de conseil d'achat réel), exactitude des exemples de sizing/R-R, chiffres illustratifs honnêtes, pas d'événement inventé. Une recommandation réelle déguisée ou une erreur de calcul = BLOCK.

Verdict : PASS / FIX (mineurs, lister remaining) / BLOCK. conventionsOk = true seulement si A entièrement respecté.`,
    { label: `qa:p${p.n}`, phase: 'SeniorQA', schema: QA_SCHEMA }
  )
)

const report = PARTS.map((p, i) => ({ part: p.n, slug: p.slug, path: p.path, qa: results[i] ? results[i].verdict : 'NULL', conventionsOk: results[i] ? results[i].conventionsOk : false, remaining: results[i] ? results[i].remaining : ['pipeline returned null'], note: results[i] ? results[i].note : '' }))
const blockers = report.filter(r => r.qa === 'BLOCK' || r.qa === 'NULL')
log(`Terminé. PASS=${report.filter(r => r.qa === 'PASS').length} FIX=${report.filter(r => r.qa === 'FIX').length} BLOCK=${blockers.length}`)
return { series: SERIES_TITLE, base: BASE, report, blockers: blockers.map(b => b.part) }
