# Weekly 20261026 — Senior QA

Revue indépendante, quatre tours sur instantanés hachés, sans recollecte. Instantané validé : `b075b1ce359f5195…` ; rendu publié `b9ba82f65e641054ad43b0645c249edfb3691fefa1bd66eb656c2d52d4c0dc63` (seuls changements ensuite : « ce qui se juge à la clôture » et la ligne « Options inhabituelles : INDISPONIBLE » des sources, diff texte vérifié).

- Tour 1 (7 bloquants) : VIX à 30 jours lié à une valeur hors séance de lundi (corrigé : `prev_close` = 19,45, aligné sur le moteur de régime) ; « Microsoft a tenu la technologie » faux ; énergie absente des secteurs ; pétroliers non confirmés présentés comme faits ; réaction propre de Lam Research omise ; sources sans liens ; prévision « vont annoncer » présentée comme un fait.
- Tour 2 (3 bloquants) : date et nature de l’annonce de Meta (mercredi 21, fourchette resserrée par le bas) ; fenêtre des médianes (veille → lendemain) ; liquidité Polymarket présentée comme mises.
- Tour 3 (1 bloquant) : chiffre Tesla attribué aux notes d’analystes citées par CNBC.
- Tour 4 (1 bloquant) : heure de sortie fausse après le passage des États-Unis à l’heure d’hiver ; règle désormais jugée « à la clôture de New York ».
- Contrôles : quarantaine de claims rouverts aux pointeurs, toutes les heures (5 h d’écart cette semaine), 18 sections, FAB, aucun terme interne.

## Verdict : PASS — zéro blocker.
