export const meta = {
  name: 'salarie-investisseur-series',
  description: 'Série FR experte "Investir Quand On Est Salarié" (6 parties, France 9h-18h) : write → expert panel (+ conformité fiscale FR) → fix → senior QA gate',
  phases: [
    { title: 'Write', detail: '6 writers — un article HTML complet par partie' },
    { title: 'Expert', detail: 'panel PM/Quant/Risk/Fiscaliste-FR/Editor par partie' },
    { title: 'Fix', detail: 'application des correctifs must-fix par partie' },
    { title: 'SeniorQA', detail: 'gate PASS/FIX/BLOCK par partie + verif conventions' },
  ],
}

// ============================================================================
// SERIE : Investir Quand On Est Salarié (France, emploi 9h-18h)
// Theme: INDIGO (#4f46e5). Gold standard = series/acceleration-ia/part1-supercycle/
// ============================================================================

const BASE = '/series/salarie-investisseur/'
const SERIES_TITLE = 'Salarié & Investisseur'

const PARTS = [
  {
    n: 1, slug: 'part1-contrainte-horaire', label: 'Contrainte horaire',
    title: 'Trader quand on bosse de 9h à 18h',
    desc: "La contrainte de temps du salarié français : quelles stratégies sont réellement compatibles avec un emploi à plein temps (swing, position, investissement, DCA) et lesquelles sont à proscrire (day trading, scalping). Choisir un style aligné sur le temps réellement disponible.",
    badges: [
      ['indigo', 'fa-business-time', 'Emploi 9h-18h'],
      ['green', 'fa-chart-line', 'Swing & position'],
      ['red', 'fa-ban', 'Pas de day trading'],
      ['amber', 'fa-clock', 'Marchés EU vs US'],
    ],
    sections: [
      ['probleme', 'Le conflit horaire fondamental'],
      ['horaires-marches', 'Heures de marché vs heures de bureau'],
      ['styles-compatibles', 'Les styles compatibles avec un emploi'],
      ['styles-incompatibles', 'Ce qu\'il faut proscrire'],
      ['choisir', 'Choisir selon son temps réel'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 1 — TRADER QUAND ON BOSSE DE 9H À 18H.
Thèse : la première cause d'échec du salarié qui investit n'est pas le manque de talent, c'est le MISMATCH entre le style choisi et le temps réellement disponible. On ne peut pas faire du day trading en réunion. Le bon style est celui qui tient dans le temps libre du salarié : le soir et le week-end.
Sections :
1) probleme : Le conflit horaire fondamental. Un salarié français travaille typiquement ~9h-18h en semaine. Les heures où il faudrait "surveiller" pour de l'intraday tombent en plein travail → impossible et risqué pour l'emploi. Poser franchement : surveiller des graphiques au bureau = mauvaise performance pro ET trading médiocre (décisions impulsives, stress).
2) horaires-marches : Heures de marché vs heures de bureau (heure de Paris). Euronext Paris / actions européennes : ~9h00-17h30 → en plein temps de travail. Marchés US (NYSE/Nasdaq) : ouverture vers 15h30 heure de Paris, clôture vers 22h00 → la session US de l'après-midi/soir est ACCESSIBLE après le travail. Conséquence : le salarié français a une fenêtre naturelle le SOIR (overlap fin de journée US) + le WEEK-END pour préparer. Présenter ça comme un atout, pas un handicap. (Préciser que les horaires bougent avec les changements d'heure été/hiver.)
3) styles-compatibles : Les styles qui tiennent avec un emploi — investissement long terme (buy & hold), DCA (investissement programmé), position trading (semaines à mois), swing trading sur clôtures journalières/hebdomadaires (décisions prises HORS séance, le soir). Tous reposent sur des décisions espacées + ordres passés à l'avance.
4) styles-incompatibles : À proscrire pour un salarié — day trading, scalping, intraday qui exige une surveillance continue en séance. Non seulement incompatible avec le travail, mais statistiquement le plus difficile. Honnêteté : ce n'est pas "moins viril", c'est juste inadapté à la contrainte.
5) choisir : Choisir son style selon son temps RÉEL disponible (tableau de décision : <2h/semaine → DCA/buy&hold ; 2-5h/semaine → swing sur clôtures + revue WE ; >5h → position trading actif le soir). Aligner ambition et budget-temps.
Charts ECharts (2-3) : (a) timeline d'une journée (heures de bureau vs fenêtres marché EU/US heure de Paris, fenêtre "soir" surlignée), (b) matrice style de trading × temps requis × compatibilité salarié, (c) optionnel : bar du temps hebdo requis par style.`,
  },
  {
    n: 2, slug: 'part2-cadre-fiscal-legal', label: 'Cadre fiscal & légal',
    title: 'Le cadre fiscal et légal du salarié-investisseur',
    desc: "Le cadre français : a-t-on le droit d'investir en étant salarié, les enveloppes (PEA, compte-titres, assurance-vie, PER), la fiscalité générale (flat tax/PFU, PEA après 5 ans), le risque du délit d'initié et les obligations déontologiques. Information générale, pas un conseil fiscal personnalisé.",
    badges: [
      ['indigo', 'fa-scale-balanced', 'Cadre légal FR'],
      ['green', 'fa-piggy-bank', 'PEA / CTO / AV'],
      ['amber', 'fa-percent', 'Fiscalité'],
      ['red', 'fa-user-secret', 'Délit d\'initié'],
    ],
    sections: [
      ['droit', 'A-t-on le droit en étant salarié ?'],
      ['enveloppes', 'Les enveloppes : PEA, CTO, AV, PER'],
      ['fiscalite', 'La fiscalité, en clair'],
      ['professionnel', 'Éviter le statut de pro'],
      ['deontologie', 'Délit d\'initié & déontologie'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 2 — CADRE FISCAL ET LÉGAL DU SALARIÉ-INVESTISSEUR (FRANCE).
AVERTISSEMENT OBLIGATOIRE : ouvrir cette partie par un encart didactic-box "Information générale, pas un conseil fiscal ou juridique personnalisé — les seuils et taux évoluent, vérifiez les règles en vigueur et consultez un professionnel." Et ne JAMAIS présenter de chiffre fiscal comme une garantie ; toujours "à titre indicatif / au moment de la rédaction / sous réserve d'évolution".
Thèse : oui, un salarié peut investir/trader en France ; encore faut-il choisir la bonne enveloppe et comprendre la fiscalité et la déontologie.
Sections :
1) droit : A-t-on le droit ? Oui dans le cas général : gérer son épargne personnelle est un droit. Nuances : secteurs réglementés (employés de banques/sociétés de gestion/cotées) peuvent avoir des restrictions internes, fenêtres de négociation (blackout), obligations de déclaration de comptes ou d'opérations. Vérifier son contrat de travail / règlement intérieur / charte de déontologie. Pas de trading sur le temps de travail avec les moyens de l'employeur.
2) enveloppes : Les enveloppes (présenter chacune, avantages/limites, à titre indicatif) — PEA : actions de l'UE/EEE, plafond de versements de l'ordre de 150 000 €, fiscalité allégée après 5 ans de détention (les prélèvements sociaux restant dus) ; NB : les actions US ne sont PAS éligibles au PEA. PEA-PME complémentaire. Compte-titres ordinaire (CTO) : accès mondial (US inclus), pas de plafond, mais imposé au fil de l'eau. Assurance-vie : enveloppe de capitalisation, fiscalité avantageuse après 8 ans, unités de compte. PER : épargne retraite, déductible mais bloquée. Faire un compare-table enveloppe × univers d'actifs × plafond × fiscalité × liquidité.
3) fiscalite : La fiscalité en clair (à titre indicatif) — le PFU / "flat tax" sur les gains et dividendes d'un CTO (de l'ordre de 30%, soit ~12,8% d'impôt sur le revenu + ~17,2% de prélèvements sociaux), option possible pour le barème progressif. PEA : exonération d'impôt sur le revenu sur les gains après 5 ans, prélèvements sociaux dus. Insister : un retrait d'un PEA avant 5 ans peut entraîner sa clôture. Toujours rappeler que ce sont des règles générales susceptibles d'évoluer.
4) professionnel : Éviter de basculer en "trader professionnel" (requalification en BIC) — pour l'écrasante majorité des salariés, l'activité reste de la gestion de patrimoine privé. Mentionner sobrement que des opérations très intensives/professionnelles pourraient être requalifiées, sans alarmisme ni détail juridique inventé.
5) deontologie : Délit d'initié & déontologie — interdiction absolue de trader sur des informations privilégiées non publiques (ex. sur l'action de son propre employeur coté, ou d'un client/fournisseur dont on connaît une info confidentielle). Sanctions lourdes (AMF). Respecter les fenêtres de blackout si on est concerné. C'est non négociable.
Charts ECharts (1-2) : (a) compare visuel des enveloppes (ex. table illustrée ou bar des plafonds/horizons), (b) optionnel : schéma "flat tax vs PEA après 5 ans" sur un gain illustratif. Garder les chiffres explicitement indicatifs.`,
  },
  {
    n: 3, slug: 'part3-routine-soir', label: 'Routine du soir',
    title: 'Construire une routine soutenable autour du job',
    desc: "La routine concrète du salarié-investisseur : préparer ses décisions le soir et le week-end, passer ses ordres à l'avance pour qu'ils s'exécutent pendant les heures de bureau sans surveillance, time-blocking de 30 minutes, et un calendrier hebdomadaire type.",
    badges: [
      ['indigo', 'fa-calendar-check', 'Routine hebdo'],
      ['green', 'fa-moon', 'Trading du soir'],
      ['purple', 'fa-stopwatch', '30 min/jour'],
      ['amber', 'fa-mug-hot', 'Revue week-end'],
    ],
    sections: [
      ['principe', 'Le principe : décider hors séance'],
      ['soir', 'La fenêtre du soir'],
      ['weekend', 'La revue du week-end'],
      ['timeblock', 'Time-blocking : 30 minutes'],
      ['calendrier', 'Un calendrier hebdomadaire type'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 3 — CONSTRUIRE UNE ROUTINE SOUTENABLE AUTOUR DU JOB.
Thèse : la régularité bat l'intensité. Une routine légère mais constante (le soir + le week-end) surperforme l'agitation impulsive du smartphone au bureau.
Sections :
1) principe : Décider HORS séance. Le salarié prend ses décisions quand le marché est calme/fermé (le soir, le week-end) sur des données de clôture, puis confie l'exécution à des ordres pré-positionnés. Il ne "regarde" jamais le marché en direct pendant le travail. Cela supprime l'impulsivité et protège la performance pro.
2) soir : La fenêtre du soir (heure de Paris). Après le travail (à partir de ~18h-19h), la session US est encore ouverte (jusqu'à ~22h) : moment idéal pour analyser les clôtures EU du jour, suivre l'ouverture/après-midi US, et préparer/passer les ordres. 20-40 minutes suffisent. Décrire un rituel du soir reproductible (revue des positions, check des stops, repérage des setups, passage d'ordres pour le lendemain).
3) weekend : La revue du week-end — marchés fermés = tête froide. C'est le moment de l'analyse de fond : revue de la semaine, journal de trading, sélection des setups de la semaine à venir, vérification du calendrier économique et des résultats (earnings) à venir, ajustement du plan. 60-90 minutes.
4) timeblock : Time-blocking — plafonner le temps (ex. 30 min/jour en semaine, 1h le week-end). Le trading ne doit pas grignoter le travail, le sommeil ni la vie perso. Règle d'or : pas d'écran de cours pendant les heures de bureau. Utiliser des alertes plutôt qu'une surveillance.
5) calendrier : Un calendrier hebdomadaire type (compare-table ou step-grid Lun→Dim) : ce qu'on fait chaque soir et le week-end, en 30 min. Très concret et actionnable. Mentionner les outils DailyTickers (scanner du soir, plans de trading générés, radar) comme signaux pré-mâchés à exécuter le soir.
Charts ECharts (2) : (a) calendrier hebdomadaire visuel (heatmap jour × créneau, charge de temps), (b) "intensité émotionnelle/impulsivité" : surveillance en séance vs décisions hors séance (la seconde bien plus basse). Garder illustratif.`,
  },
  {
    n: 4, slug: 'part4-set-and-forget', label: 'Set & forget',
    title: 'Ordres, automatisation et DCA : le « set and forget »',
    desc: "L'arsenal technique du salarié : ordres à cours limité, stop, OCO et brackets pour s'exécuter sans surveillance pendant le travail, swing sur clôtures, DCA programmé, et l'usage des signaux du scanner DailyTickers exécutés le soir.",
    badges: [
      ['indigo', 'fa-robot', 'Automatisation'],
      ['green', 'fa-repeat', 'DCA programmé'],
      ['purple', 'fa-bullseye', 'Bracket / OCO'],
      ['amber', 'fa-calendar-day', 'Swing sur clôtures'],
    ],
    sections: [
      ['ordres', 'Les types d\'ordres qui travaillent pour vous'],
      ['bracket', 'Bracket & OCO : entrée, stop, objectif'],
      ['swing-cloture', 'Le swing sur clôtures'],
      ['dca', 'Le DCA programmé'],
      ['signaux', 'Exécuter des signaux le soir'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 4 — ORDRES, AUTOMATISATION ET DCA : LE « SET AND FORGET ».
Thèse : ce que le salarié ne peut pas surveiller, il doit l'automatiser. Les ordres conditionnels exécutent le plan à votre place pendant que vous êtes en réunion.
Sections :
1) ordres : Les types d'ordres — ordre au marché vs à cours limité (limit), ordre stop (stop-loss / stop suiveur / trailing), take-profit. Expliquer comment chacun permet de NE PAS surveiller : on définit le prix d'entrée, le stop et l'objectif le soir, le courtier exécute en séance. Mentionner les ordres à validité étendue (GTC / jusqu'à annulation).
2) bracket : Bracket order & OCO (One-Cancels-the-Other) — la brique reine du salarié : une entrée encadrée d'un stop ET d'un objectif ; si l'un se déclenche, l'autre s'annule. Le trade est entièrement géré sans intervention. Donner un exemple chiffré illustratif (entrée, stop, objectif, R/R).
3) swing-cloture : Le swing sur clôtures — prendre les décisions sur les bougies journalières/hebdomadaires (à la clôture), pas sur le bruit intraday. On regarde le marché une fois par jour (le soir). Parfait pour un emploi. Relier aux horizons H10/H20 des modes swing DailyTickers (positions tenues sur plusieurs jours/semaines).
4) dca : Le DCA (Dollar/Euro Cost Averaging) programmé — investissement automatique d'un montant fixe à intervalle régulier (versement programmé sur PEA/AV, achats programmés). Lisse le point d'entrée, supprime le market timing, zéro surveillance. Idéal pour le socle long terme du salarié. Avantages/limites honnêtes.
5) signaux : Exécuter des signaux pré-mâchés le soir — le scanner DailyTickers, les plans de trading générés (entrée/stop/objectif/sizing prêts) et le radar produisent des setups qu'un salarié peut transformer en bracket orders en quelques minutes le soir. Workflow concret : signal → vérif rapide → bracket order → on oublie.
Charts ECharts (2-3) : (a) schéma d'un bracket order (prix d'entrée, stop, objectif, zones), (b) DCA : prix d'entrée moyen lissé vs achat unique mal timé (line), (c) optionnel : R/R d'un trade encadré. Illustratif.`,
  },
  {
    n: 5, slug: 'part5-psychologie-risque', label: 'Psycho & risque',
    title: 'Psychologie et risque : l\'avantage caché du salarié',
    desc: "Le salaire stable est un avantage psychologique majeur : pas besoin de vivre du trading, donc patience, petit sizing et zéro pression de performance. Comment séparer capital pro et perso, ne risquer que l'épargne dédiée, et résister au FOMO pendant les heures de bureau.",
    badges: [
      ['indigo', 'fa-brain', 'Psychologie'],
      ['green', 'fa-shield-halved', 'Salaire = coussin'],
      ['red', 'fa-fire', 'Anti-FOMO'],
      ['purple', 'fa-wallet', 'Capital dédié'],
    ],
    sections: [
      ['avantage', 'L\'avantage du revenu stable'],
      ['capital-dedie', 'Ne risquer que l\'épargne dédiée'],
      ['fomo', 'Le FOMO des heures de bureau'],
      ['discipline', 'La discipline par les règles'],
      ['pieges', 'Les pièges du salarié'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 5 — PSYCHOLOGIE ET RISQUE : L'AVANTAGE CACHÉ DU SALARIÉ.
Thèse : contre-intuitivement, le salarié a un avantage que le trader à plein temps n'a pas — un revenu qui tombe chaque mois. Cela enlève la pression de performance, première destructrice de comptes.
Sections :
1) avantage : L'avantage du revenu stable. Le salaire couvre les besoins → on n'a PAS à "sortir un revenu" du marché → on peut être patient, attendre les bons setups, encaisser les drawdowns sans paniquer, sizer petit. Le trader qui doit payer son loyer avec ses gains sur-trade et prend des risques fous. Le salarié patient a un edge psychologique structurel. Le développer.
2) capital-dedie : Ne risquer QUE l'épargne dédiée — jamais l'épargne de précaution (3-6 mois de dépenses), jamais l'argent d'un projet à court terme. Définir un capital de risque cloisonné, dont la perte totale ne changerait pas le mode de vie. Séparer comptes pro/perso/investissement. Le risque par trade reste un petit % de ce capital dédié (rappel du sizing de la série Piloter son Portefeuille).
3) fomo : Le FOMO des heures de bureau — la tentation de checker son téléphone, de "rattraper" un mouvement vu en pause déjeuner, de trader en cachette. C'est doublement dangereux : décisions impulsives + risque pour l'emploi. Stratégies anti-FOMO : alertes au lieu de surveillance, plan écrit, accepter de rater des mouvements ("il y aura d'autres trains").
4) discipline : La discipline par les règles, pas par la volonté. Pré-écrire son plan (critères d'entrée, stop, objectif, sizing) le soir à tête reposée ; l'exécuter mécaniquement. Les ordres pré-positionnés (partie 4) sont de la discipline matérialisée. Journal de trading pour s'auto-corriger.
5) pieges : Les pièges spécifiques du salarié — trader stressé pendant une journée de boulot chargée, mélanger humeur pro et décisions de marché, vouloir "se prouver" quelque chose, augmenter le risque après une prime, négliger le sommeil. Lister et donner l'antidote pour chacun.
Charts ECharts (1-2) : (a) "pression de performance vs liberté de décision" salarié vs trader-temps-plein (illustratif), (b) pyramide/segmentation du capital (précaution / projets / investissement / risque) — schéma. Illustratif.`,
  },
  {
    n: 6, slug: 'part6-plan-action', label: 'Plan d\'action',
    title: 'Le plan d\'action complet du salarié-investisseur',
    desc: "Tout assembler : choisir son enveloppe et son capital de risque, son style selon son temps, bâtir la routine du soir et du week-end, automatiser les ordres, suivre mensuellement, savoir quand augmenter — avec la checklist maître du salarié-investisseur.",
    badges: [
      ['indigo', 'fa-list-check', 'Checklist maître'],
      ['green', 'fa-route', 'Plan complet'],
      ['purple', 'fa-arrows-up-to-line', 'Quand scaler'],
      ['amber', 'fa-flag-checkered', 'Mise en route'],
    ],
    sections: [
      ['synthese', 'La synthèse des 5 parties'],
      ['mise-en-route', 'La mise en route, étape par étape'],
      ['suivi', 'Le suivi mensuel léger'],
      ['scaler', 'Quand augmenter la cadence'],
      ['checklist', 'La checklist maître'],
      ['quiz', 'Quiz'],
    ],
    brief: `PARTIE 6 — LE PLAN D'ACTION COMPLET DU SALARIÉ-INVESTISSEUR (clôture de série).
Thèse : transformer toute la série en un plan exécutable dès ce week-end.
Sections :
1) synthese : Synthèse des 5 parties (contrainte horaire → cadre fiscal/légal → routine → automatisation → psychologie) en un schéma/flux clair.
2) mise-en-route : La mise en route étape par étape (step-grid) — (1) définir capital de risque cloisonné, (2) choisir l'enveloppe (PEA pour actions EU / CTO pour le monde / AV pour le socle), (3) choisir le style selon le temps dispo (DCA / swing sur clôtures / position), (4) écrire son plan (critères, sizing, stop), (5) installer la routine du soir + revue WE, (6) automatiser via brackets/ordres programmés, (7) démarrer petit (renvoi au ramp-up de la série Piloter son Portefeuille).
3) suivi : Le suivi mensuel léger — revue de performance mensuelle (pas quotidienne !), tenue du journal, vérification que le style reste compatible avec la charge de travail du moment (ex. période chargée au bureau → réduire / passer en DCA, lien vers "pausing"). Honnêteté sur la performance.
4) scaler : Quand augmenter la cadence/le capital — seulement après un edge confirmé sur plusieurs mois ET si le temps disponible le permet sans nuire au travail. Renvoi à la partie scale-up de la série Piloter son Portefeuille. Ne pas confondre disponibilité de capital et disponibilité de temps.
5) checklist : LA checklist maître actionnable du salarié-investisseur, couvrant tout (légal/fiscal, capital, style, routine, ordres, psycho, suivi). Livrable phare. Format checklist visuelle.
Inclure des liens croisés vers la série "Piloter son Portefeuille" (/series/piloter-son-portefeuille/) là où c'est pertinent (ramp-up, sizing, pausing, scale-up). Terminer par un CTA fin de série + encart "série complète en 6 parties".
Rappeler une dernière fois, brièvement, que rien de tout cela n'est un conseil en investissement ni fiscal personnalisé.
Charts ECharts (2) : (a) flux/roadmap de mise en route (graph ou step), (b) "charge de travail au bureau" vs "cadence de trading recommandée" dans le temps (montrer qu'on réduit quand le job est chargé). Illustratif.`,
  },
]

// ----------------------------------------------------------------------------
// BLOCS FIXES (à coller VERBATIM par les writers) — theme INDIGO
// ----------------------------------------------------------------------------

const THEME_CSS = `<style>
 /* INDIGO THEME — Salarié & Investisseur */
 .hero-section { padding:4rem 2rem 8rem 2rem; background:linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%); text-align:center; }
 .hero-date { font-size:0.85rem; font-weight:700; color:#4f46e5; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem; }
 .hero-badges { display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; margin-top:2rem; }
 .hero-badge { display:inline-flex; align-items:center; gap:0.4rem; padding:0.5rem 1rem; border-radius:99px; font-size:0.8rem; font-weight:700; }
 .hero-badge-indigo { background:rgba(79,70,229,0.1); color:#4f46e5; border:1px solid rgba(79,70,229,0.2); }
 .hero-badge-green { background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); }
 .hero-badge-purple { background:rgba(147,51,234,0.1); color:#9333ea; border:1px solid rgba(147,51,234,0.2); }
 .hero-badge-amber { background:rgba(245,158,11,0.12); color:#d97706; border:1px solid rgba(245,158,11,0.25); }
 .hero-badge-red { background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); }

 .section-divider { display:flex; align-items:center; gap:1rem; margin:3rem 0 2rem; color:#94a3b8; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; }
 .section-divider::before, .section-divider::after { content:''; flex:1; height:1px; background:#e2e8f0; }

 .compare-table { width:100%; border-collapse:separate; border-spacing:0; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; margin:2rem 0; }
 .compare-table th { background:#4338ca; color:white; padding:1rem; font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; }
 .compare-table td { padding:0.85rem 1rem; border-bottom:1px solid #f1f5f9; font-size:0.9rem; color:#334155; }
 .compare-table tr:nth-child(even) td { background:#f8fafc; }
 .compare-table tr:last-child td { border-bottom:none; }

 .checklist { list-style:none; padding:0; margin:1.5rem 0; }
 .checklist li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.6rem 0; font-size:0.95rem; color:#334155; line-height:1.5; }
 .checklist li i { margin-top:0.15rem; flex-shrink:0; }

 details { margin:0.75rem 0; }
 details summary { cursor:pointer; padding:1rem 1.25rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; font-weight:700; color:#0f172a; font-size:0.95rem; transition:all 0.2s; list-style:none; }
 details summary::-webkit-details-marker { display:none; }
 details summary::before { content:'\\f059'; font-family:'Font Awesome 6 Free'; font-weight:900; color:#4f46e5; margin-right:0.75rem; }
 details[open] summary { border-color:#4f46e5; background:#eef2ff; border-radius:12px 12px 0 0; }
 details .quiz-answer { padding:1rem 1.25rem; background:#f0fdf4; border:1px solid #86efac; border-radius:0 0 12px 12px; font-size:0.9rem; color:#334155; line-height:1.7; }

 .formula-box { background:linear-gradient(135deg, #0f172a 0%, #312e81 100%); color:white; padding:1.5rem 2rem; border-radius:12px; margin:1.5rem 0; text-align:center; font-size:1.3rem; font-weight:700; letter-spacing:0.02em; }
 .formula-box .formula-label { font-size:0.7rem; color:#a5b4fc; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.5rem; font-weight:600; }
 .formula-box .formula-highlight { color:#818cf8; }

 .takeaway-box { background:linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border:1px solid #4f46e5; border-radius:16px; padding:2rem; margin:2rem 0; }
 .takeaway-box h3 { color:#4338ca; margin-top:0; }
 .takeaway-list { list-style:none; padding:0; margin:0; }
 .takeaway-list li { display:flex; align-items:flex-start; gap:0.75rem; padding:0.75rem 0; font-size:1rem; color:#334155; line-height:1.6; border-bottom:1px solid rgba(79,70,229,0.15); }
 .takeaway-list li:last-child { border-bottom:none; }
 .takeaway-list li i { color:#4f46e5; margin-top:0.2rem; flex-shrink:0; }

 .next-cta { display:flex; align-items:center; justify-content:center; gap:1rem; padding:2rem; background:linear-gradient(135deg, #4338ca 0%, #6366f1 100%); color:white; border-radius:16px; margin:2rem 0; text-decoration:none; transition:transform 0.2s, box-shadow 0.2s; }
 .next-cta:hover { transform:translateY(-2px); box-shadow:0 12px 30px rgba(79,70,229,0.3); }
 .next-cta .next-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; opacity:0.85; }
 .next-cta .next-title { font-size:1.25rem; font-weight:800; }
 .next-cta i { font-size:1.5rem; }

 .step-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin:2rem 0; }
 .step-card { background:white; border:1px solid #e2e8f0; border-radius:16px; padding:1.5rem; text-align:center; transition:all 0.3s; border-top:4px solid #4f46e5; }
 .step-card:hover { transform:translateY(-3px); box-shadow:0 12px 30px -8px rgba(0,0,0,0.12); }
 .step-number { width:42px; height:38px; border-radius:12px; background:linear-gradient(135deg, #4338ca 0%, #6366f1 100%); display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:900; color:white; margin:0 auto 0.75rem; }
 .step-card h4 { font-size:1rem; font-weight:800; color:#0f172a; margin:0 0 0.5rem; }
 .step-card p { font-size:0.85rem; color:#64748b; line-height:1.5; margin:0; }

 .capability-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin:2rem 0; }
 .capability-card { background:white; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; transition:all 0.3s; }
 .capability-card:hover { border-color:#4f46e5; transform:translateY(-2px); box-shadow:0 8px 25px -5px rgba(0,0,0,0.08); }
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
- Accents français en UTF-8 DIRECT (résultat, bénéfice, marché, première, salarié) — JAMAIS d'entités HTML pour les accents.
- CSS : EXCLUSIVEMENT /assets/report.css + le bloc <style> theme fourni. JAMAIS de dossier assets/ local.
- Footer : EXACTEMENT <footer class="article-footer">. JAMAIS report-footer/site-footer.
- Scripts de fin : le SCRIPT_TAIL fourni (core.js + echarts-responsive.js + tag-renderer.js). RIEN après.
- GTM-T5Z595CW présent (fourni dans le head).
- Tags cliquables : <div id="article-clickable-tags" class="card-tags"> dans le hero.
- Chaque section de contenu dans <div id="ID" class="content-card"> précédée d'un <div class="section-divider" id="ID">. L'id du divider = la cible d'ancre du fnav.
- Métriques : <div class="metric-card"><div class="metric-value">…</div><div class="metric-label">…</div></div> dans une <div class="metric-grid">.
- Boîtes : pedagogy-box (explication), didactic-box (encadré), alert-box (avertissement). Toutes dans report.css.
- Voix : FT / The Economist + précision d'un terminal. Expert mais accessible, on explique sans condescendre. Pas de hype, pas d'emojis-fusée, pas d'urgence artificielle.
- CONTEXTE FRANCE : tout est écrit pour un salarié FRANÇAIS (emploi ~9h-18h, heure de Paris, enveloppes FR : PEA/CTO/AV/PER). Heures de marché à donner en heure de Paris.
- HONNÊTETÉ : ne JAMAIS inventer une statistique présentée comme sourcée ; nombres ILLUSTRATIFS présentés comme tels ("par exemple", "à titre indicatif"). Aucun événement géopolitique/macro inventé.
- FISCAL/LÉGAL : information GÉNÉRALE seulement, jamais un conseil personnalisé. Tout chiffre fiscal est "à titre indicatif, susceptible d'évoluer, à vérifier". Inclure un avertissement clair (didactic-box ou alert-box) dans toute partie touchant au fiscal/juridique. Ne pas inventer d'article de loi précis.
- Longueur cible : article riche et dense (≈ 550–750 lignes), 5–6 sections de fond + quiz, 2–4 graphiques ECharts pertinents, une takeaway-box finale et un next-cta.
- ECharts : palette indigo (#4f46e5, #4338ca, #6366f1, #a5b4fc) + rouge #dc2626 (risque/incompatible), vert #10b981 (positif/compatible), ambre #f59e0b. Ajouter en fin de script un window.addEventListener('resize', ...) qui resize tous les charts.`

// ----------------------------------------------------------------------------
// SCHEMAS
// ----------------------------------------------------------------------------

const WRITE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['path', 'sectionIds', 'charts', 'lineCount'],
  properties: {
    path: { type: 'string' },
    sectionIds: { type: 'array', items: { type: 'string' } },
    charts: { type: 'integer' },
    lineCount: { type: 'integer' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['mustFix', 'shouldFix', 'severity', 'summary'],
  properties: {
    mustFix: { type: 'array', items: { type: 'string' } },
    shouldFix: { type: 'array', items: { type: 'string' } },
    severity: { type: 'string', enum: ['clean', 'minor', 'major', 'blocker'] },
    summary: { type: 'string' },
  },
}

const FIX_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['applied', 'skipped', 'path'],
  properties: {
    applied: { type: 'array', items: { type: 'string' } },
    skipped: { type: 'array', items: { type: 'string' } },
    path: { type: 'string' },
  },
}

const QA_SCHEMA = {
  type: 'object', additionalProperties: false,
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

log(`Série "${SERIES_TITLE}" — 6 parties (France 9h-18h), pipeline write→expert→fix→seniorQA`)

const results = await pipeline(
  PARTS,

  // STAGE 1 — WRITE
  (p) => agent(
    `Tu es un rédacteur financier expert (voix FT/The Economist) qui écrit en FRANÇAIS pour un public de SALARIÉS FRANÇAIS (emploi ~9h-18h). Tu produis la PARTIE ${p.n}/6 de la série "${SERIES_TITLE}" — comment trader/investir tout en étant salarié à plein temps en France.

OBJECTIF : un article HTML statique autonome, profond, rigoureux et ACTIONNABLE. Public : salariés français qui veulent investir/trader sans nuire à leur emploi.

GOLD STANDARD de structure : /Users/marketwatchxyz/GolandProjects/articles/series/acceleration-ia/part1-supercycle/index.html (lis-le si besoin pour le style des content-card, pedagogy-box, compare-table, metric-grid, step-grid, ECharts).

=== BRIEF DE CONTENU ===
${p.brief}

=== SECTIONS (ordre + id d'ancre EXACTS) ===
${p.sections.map(s => `  #${s[0]} → ${s[1]}`).join('\n')}

${CONVENTIONS}

=== ASSEMBLAGE DU FICHIER (ordre strict) ===
Tu écris le fichier complet à : ${p.path}
Structure exacte :
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
   <div class="fnav" id="floatingNav"><div class="fnav-menu" id="fnavMenu"> … un <a class="fnav-item" data-section="ID"><i class="fas fa-bookmark"></i><span>Label court</span></a> par section (id EXACTS ci-dessus) … </div>
${FNAV_SCRIPT}

6. <div class="container"> … TOUTES LES SECTIONS … </div>
   Chaque section : <div class="section-divider" id="ID"><i class="fa-solid …" style="color:#4f46e5;"></i> Titre</div> puis <div class="content-card"> … </div>. Place les conteneurs ECharts <div id="chart-xxx" style="width:100%;height:360px;margin:2rem 0;"></div> dans les bonnes sections. Termine le container par une <div class="takeaway-box"> ("À retenir — Partie ${p.n}") et un <a class="next-cta">${p.n < 6 ? 'vers la partie suivante' : 'CTA fin de série / retour accueil'}</a>.

7. [SERIES BAR (bas) — COLLER VERBATIM la même qu'au point 4]
${seriesBar(p.n)}

8. [FOOTER — COLLER VERBATIM]
${FOOTER}

9. [SCRIPTS ECHARTS] : <script> … init de tous tes charts + window resize … </script>

10. [SCRIPT TAIL — COLLER VERBATIM]
${SCRIPT_TAIL}

Écris le fichier complet avec Write au chemin exact ${p.path}. Soigne la profondeur et l'aspect actionnable (frameworks chiffrés, tableaux de décision, calendriers, checklists). Retourne path, sectionIds, charts, lineCount.`,
    { label: `write:p${p.n}`, phase: 'Write', schema: WRITE_SCHEMA }
  ),

  // STAGE 2 — EXPERT PANEL (avec angle conformité fiscale/légale FR)
  (writeRes, p) => agent(
    `Tu es un PANEL d'experts (Gérant de portefeuille / Trader discrétionnaire / Risk manager / FISCALISTE-JURISTE FRANÇAIS / Éditeur financier FR) qui review la PARTIE ${p.n}/6 "${p.title}" de la série "${SERIES_TITLE}" (destinée à des salariés français).

Fichier : ${p.path} (lis-le entièrement).

BRIEF attendu :
${p.brief}

Évalue avec exigence :
1. EXACTITUDE MÉTIER : concepts de marché/ordres/stratégies corrects et précis, adaptés à la contrainte d'un salarié (pas de conseils incompatibles avec un emploi). Heures de marché en heure de Paris cohérentes (EU ~9h-17h30, US ouverture ~15h30 Paris).
2. EXACTITUDE & PRUDENCE FISCALE/LÉGALE FR : les éléments sur PEA/CTO/AV/PER, flat tax/PFU, PEA après 5 ans, délit d'initié, etc. sont-ils corrects dans les grandes lignes ET correctement présentés comme INDICATIFS et non comme un conseil personnalisé ? Présence d'un avertissement clair. Aucun chiffre fiscal présenté comme garanti, aucun article de loi inventé. Signale toute affirmation fiscale risquée ou trop catégorique → mustFix.
3. PROFONDEUR & ACTIONNABILITÉ : frameworks chiffrés, tableaux de décision, calendrier hebdo, checklists concrètes ? Va-t-on au fond ?
4. HONNÊTETÉ : chiffres illustratifs présentés comme tels ; pas d'événement macro/géopo inventé.
5. CONVENTIONS & VOIX : footer article-footer ; scripts (core.js+echarts-responsive.js+tag-renderer.js) ; GTM ; /assets/report.css only ; accents UTF-8 directs ; series-bar ×2 ; fnav cohérent ; voix FT/Economist ; ECharts valides.

Classe : mustFix (faux/cassé/convention violée/affirmation fiscale risquée/non-actionnable au point de trahir le brief) vs shouldFix. severity = clean|minor|major|blocker. Sois précis et concret.`,
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

Contraintes : ne casse RIEN (HTML/ECharts valides, conventions préservées : footer article-footer, scripts de fin inchangés, /assets/report.css, accents UTF-8 directs, series-bar ×2, GTM). Préserve la prudence fiscale (avertissements, chiffres indicatifs). Garde profondeur et actionnabilité. Retourne applied, skipped, path.`,
      { label: `fix:p${p.n}`, phase: 'Fix', schema: FIX_SCHEMA }
    )
  },

  // STAGE 4 — SENIOR QA GATE
  (fixRes, p) => agent(
    `Tu es le QA SENIOR final (gate de publication) pour la PARTIE ${p.n}/6 "${p.title}" (${p.path}). Lis le fichier final entièrement.

A. CONVENTIONS (bloquantes si violées) : <!DOCTYPE html> + <html lang="fr" data-tab="analyses"> ; GTM-T5Z595CW ; /assets/report.css (et AUCUN assets/ local) ; bloc <style> theme présent ; brand-bar avec brand-nav ; hero + #article-clickable-tags ; series-bar présent EXACTEMENT 2 fois, partie ${p.n} en current, compteur ${p.n}/6 ; fnav cohérent (data-section = id réels) ; <footer class="article-footer"> uniquement ; scripts de fin = core.js + echarts-responsive.js + tag-renderer.js, rien après </html> ; accents français UTF-8 directs ; pas de JS ECharts cassé.
B. QUALITÉ & PRUDENCE : profondeur réelle, actionnable, voix FT/Economist, chiffres illustratifs honnêtes, pas d'événement inventé, ET — pour les parties à contenu fiscal/légal — présence d'un avertissement clair (info générale, pas un conseil personnalisé) et chiffres fiscaux présentés comme indicatifs. Une affirmation fiscale fausse ou présentée comme une garantie/conseil personnalisé = BLOCK.

Verdict : PASS (publiable) / FIX (mineurs non bloquants, lister remaining) / BLOCK (convention bloquante, erreur grave, ou imprudence fiscale). conventionsOk = true seulement si A entièrement respecté.`,
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
