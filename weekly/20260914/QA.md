# Weekly 14–18 septembre 2026 — livraison (révision du 13/09)

**Édition corrigée après audit approfondi.** Clôture de référence : 11 septembre. Aucun trade validé
(`no_setup`). La première publication du 12/09 portait deux erreurs de fond, corrigées ici et
documentées ci-dessous plutôt que réécrites en silence.

## Ce qui a changé depuis la publication du 12/09

- **Thèse de une refaite.** La version initiale titrait sur un « calme » déduit d'une volatilité à
  9 jours inférieure à celle à 30 jours. C'est du contango, l'état ordinaire de la courbe :
  `_data/options_sentiment.json` porte lui-même `shape:"contango"` et une interprétation de régime
  calme. Le point court est le moins cher toutes les semaines. La lecture corrigée s'appuie sur le
  déplacement du rapport 9j/30j — 0,82 la semaine précédente, 0,91 ici — qui dit un
  renchérissement du court terme, et sur les marchés de prédiction collectés.
- **Marchés de prédiction intégrés.** `_data/regime.json` portait, non utilisé, le partage de la
  décision du 16 : 78,5 % pour une hausse de 25 pb, 20,5 % pour un statu quo. La page écrivait
  « sans inférer le sens de la décision » alors que le sens était price dans son propre socle.
- **Contexte de guerre ajouté.** La version initiale décrivait le choc pétrolier par une variation
  de transits. Ormuz est fermé au trafic commercial depuis le 2 mars ; l'oléoduc saoudien Est-Ouest,
  seule route de contournement (~5 Mb/j vers Yanbu), a été frappé le 10 septembre puis **fermé** par
  l'Arabie saoudite. Vérifié par sources multiples (Bloomberg, CNN, CNBC, Al Jazeera). L'attribution
  des dommages aux stations de pompage est explicitement présentée comme rapportée par la presse,
  l'élément de première main étant de la fumée à proximité.
- **Superlatif faux corrigé (Lennar).** « 7,4 jours de volume moyen — le relevé le plus haut » était
  faux : les jours de couverture étaient à 9,01 au relevé du 14 août. Le texte dit maintenant que le
  pourcentage de flottant est le plus élevé de la série *mais* dans une bande étroite, et que les
  jours de couverture ont baissé.
- **Volume hors carnet requalifié.** La charge porte `directional_flow_available:false` : le sens du
  flux n'est pas inférable. Le graphique reste, avec cette limite écrite, et la ligne correspondante
  a été retirée des signaux de contrôle de la matrice des risques.
- **Contrôle dilution exécuté** sur les deux noms du dossier, ce qui n'avait pas été fait : le filtre
  de formes du socle exclut les S-3, d'où l'invisibilité du prospectus universel de Lennar
  (10/04/2026) et de l'emprunt convertible de 1,5 Md$ de Trip.com (juin 2029, règlement du principal
  en numéraire). Structure Caïmans/ADS/VIE de Trip.com également déclarée.
- **Données du dossier publiées.** Niveaux, moyennes mobiles, RSI, valorisation, actions d'analystes,
  point d'aimantation des options, intérêt court : collectés depuis le départ, ils étaient absents de
  la page. Une conclusion « aucun trade » sans niveaux demande au lecteur de croire sur parole.
- **Contournement de contrôle fermé.** Tous les horaires du calendrier étaient écrits en toutes
  lettres (« vingt heures trente »), ce qui les faisait échapper au détecteur de chiffres non liés.
  `tools/validate-content-claims.js` détecte désormais les cardinaux français et accepte un format
  de rendu `fr_time` ; deux tests couvrent le cas. Les horaires du FOMC, des ventes au détail, des
  inscriptions au chômage et de Bowman sont liés au flux collecté.
- **Source Census remplacée.** L'URL citée pour les ventes au détail était un index de programmes
  sans aucune date. Remplacée par le calendrier en liste, qui fixe la publication au 16/09 à 8h30 ET.
  Correction consignée dans `_data/primary-calendar.json`.
- **Couche de publication.** Tag `commodities` → `commodity` (seul fichier du site à porter la forme
  fautive, absente des deux registres de tags, donc chip en anglais dans une page française et
  filtre `?tags=commodity` inopérant) ; `og:image` et `og:description` rétablis ; marqueurs internes
  `data-status`/`data-quality` retirés du rendu public ; classes `hero-title`/`hero-subtitle`
  rétablies ; conteneurs de graphiques rendus responsives ; grille de synthèse portée à six cartes.

## Validation

- 109 claims : valeur, pointeur, empreinte et rendu déterministe validés, dont quatre corrélations recalculées
  par le gate lui-même (nouvelle opération `pearson_window`). 37 littéraux déclarés.
- `validate-content-claims`, `qa-content --strict` (21 contrôles, 0 avertissement), `check-ai-tells
  --strict`, `validate-content-hierarchy`, `validate-horizon-risk` : PASS.
- La dérogation de taille `min-size` est **supprimée** : la page fait 51 858 octets, 19 sections,
  ~4 300 mots, 8 graphiques exportés sans canvas vide, 11 références en ligne.
- Empreintes : article `775a98fd2fb52527…`, claims `d62e6de6ff58b3b7…`, Substack anglais `75727c9fbfa3b7c6…`.
- Panel senior rejoué sur le build révisé (`wf_948c4a41-7e0`) : QA 93, trader 74, risk 78, strategist 72,
  editor 56→68, anti-slop 63-68. Le reviewer quantitatif n'a pas pu tourner (MCP marketdata non authentifié
  + limite de dépense) : les chiffres reposent donc sur le gate déterministe et sur des recalculs manuels,
  pas sur une re-collecte indépendante. Détail et arbitrages dans `_review/reviews.json`.

## Limites assumées

- **Bilan Oracle non tenu.** L'édition du 07/09 posait une condition falsifiable chiffrée et
  promettait le verdict ici. La fenêtre de mesure est complète (publication le 10/09 après clôture,
  clôture de référence le 11/09) : c'est une omission de collecte, pas une donnée indisponible. Elle
  est déclarée comme telle dans la page et reportée à la prochaine édition.
- Le panorama de prix couvre les ETF américains collectés ; Europe et Asie ne sont pas couvertes
  quantitativement.
- Les rendements hebdomadaires comparent le 4 au 11 septembre, soit quatre séances après Labor Day,
  et excluent distributions et frais.
- La revue anti-slop maintient que la prose de liaison gagnerait à être reprise par un humain, malgré
  l'ajout de la première personne et la suppression des amorces de signalisation, des aphorismes de
  clôture et des gloses répétées. Elle vise aussi ~2 200 mots contre ~4 300 ici ; l'écart est assumé,
  le supplément étant de la matière vérifiée et non du remplissage.
- Le taux réel n'est plus invoqué : l'inférence « obligations en baisse + or en baisse donc taux réels
  en hausse » saute l'étape des points morts d'inflation, qu'un choc d'offre pousse dans l'autre sens,
  et aucune série de points morts n'est disponible ici.

## Reproduction

Depuis la racine : `node weekly/20260914/_build.cjs`, puis les gates du runbook Weekly. Graphiques :
`node tools/render-charts-png.js --article weekly/20260914/index.html --out weekly/20260914/_img`,
et la variante anglaise avec `--out weekly/20260914/_img/en --labels weekly/20260914/_img/labels-en.json`.

## Substack anglais

Brouillon créé, **non publié** : `draft_id` 215564667, « Wednesday's rate rise is priced. The sentence
after it isn't. » `validate_draft` renvoie zéro erreur. Quatre graphiques anglais et quatre tableaux
rendus en images. `upload_image` les a ré-hébergées sur le CDN Substack : le corps du brouillon ne
contient que des URL `substack-post-media…`, aucune vers `raw.githubusercontent`. La branche n'est donc
PAS une dépendance du brouillon — elle ne servirait qu'à un ré-upload.

Verdict du panel sur ce livrable : **FIXED, composite 78, aucun bloquant**. Le reviewer quantitatif y a
corrigé deux points, tous deux vérifiés et retenus : la semaine compte quatre séances et non cinq
(Labor Day), et « Labour Day » s'écrit « Labor Day ». Deux réserves non bloquantes subsistent : la
longueur (1 900 mots contre ~1 200 conseillés) et l'absence de manifeste de claims propre au Substack —
`claims.json` ne couvre que `index.html`, donc les chiffres du Substack ont été recoupés à la main
contre le socle certifié (62 des 67 valeurs numériques correspondent à une claim ou à un littéral
déclaré ; les cinq autres sont des faits attribués : convertible Trip.com, gazole GasBuddy, deux points
de la courbe de volatilité, borne basse de la bande d'intérêt court).

**La publication reste à décider.** Elle n'a pas été faite : le contrat de publication traite le canal
Substack comme une autorisation distincte, et le verdict de porte du weekly français a été rendu avant
les deux derniers correctifs.
