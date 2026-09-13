---
name: contango-is-not-a-signal
description: VIX9D sous VIX30D est l'état normal de la courbe (contango) — jamais un signal de complaisance ; lire le déplacement du ratio semaine sur semaine et le champ shape/interpretation du fournisseur.
type: feedback
---

Le weekly 20260914 a titré sur « le marché price le calme là où le calendrier est le plus chargé »,
déduit de VIX9D 14,47 < VIX30D 15,84. C'est faux : la courbe monte presque toujours avec l'échéance.
`_data/options_sentiment.json` porte lui-même `shape:"contango"` et
`interpretation:"...calm / risk-on regime"` — la page inversait donc la lecture de sa propre source,
et transformait une constante structurelle en signal hebdomadaire. En contango le point court est le
moins cher TOUTES les semaines ; il ne prouve rien seul.

**Why:** un bon analyste démonte ce raisonnement en trente secondes, et toute la thèse de une
reposait dessus. Deux reviewers indépendants (strategist, trader) l'ont attrapé.

**How to apply:** avant d'écrire quoi que ce soit sur la structure de volatilité, (1) lire
`shape`/`interpretation` de `options_sentiment.json` ; (2) publier le RATIO et sa variation d'une
édition à l'autre, pas le niveau — ici 0,82 (07/09) → 0,91 (14/09), soit un court terme qui se
RENCHÉRIT, l'inverse de la complaisance ; (3) le vrai signal de tension est une inversion (court
au-dessus du long), pas un contango. Voir aussi [[prediction-markets-in-regime-facets]].
