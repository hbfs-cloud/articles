---
name: open-outside-hl-range
description: Défaut fournisseur — l'open servi peut sortir de [low, high] sur une séance ; le refresh ne le corrige pas, et la collecte scanner ne le détecte pas.
type: feedback
---

Sur la séance du 2026-09-15, 7 symboles sur 112 du vivier scanner (6,25 %) ont été servis avec un
`open` hors de l'intervalle `[low, high]` : PR, CRBG, ADM, OXY, CTA, RFIX, QSR — plus STT et MTDR
côté suivi. Signature systématique : c'est toujours l'`open` qui est l'aberrant (au-dessus du high
pour STT/QSR, en dessous du low pour les sept autres), ce qui pointe un open capté sur une impression
pré-marché au lieu de la séance régulière. Écarts de 0,02 % à 0,25 % du close — pas du bruit de
flottant.

Deux enseignements opératoires :

1. **`RefreshBars` ne répare pas ce défaut.** Un refresh ciblé des 9 symboles a bien réingéré (closes
   et volumes ont changé) et resservi le même open incohérent. Le défaut est en amont, chez yahoo.
   Ne pas boucler sur le refresh en espérant que ça passe.
2. **Le serveur ne signale rien** : `quality:"high"`, `complete:true`, `sessions_complete:true`,
   `coverage.missing_ranges:[]`. La cohérence intra-barre n'est pas un critère de qualité côté source.

**Why:** seul `tools/lib/mcp-daily-bars.js` (`normalizeBars`) porte le contrôle de bornes OHLC, et il
n'est appelé que par la chaîne C (tracking/sweep/lifecycle). La chaîne A — `tools/collect.js`, le
chemin de collecte publication-critique — a persisté 49 barres invalides dans `_data2` et s'est
déclarée « A OK » ; `check-freshness.js` et `validate-workflows.js --run-plan` sont passés tous les
deux. Un scan dont les niveaux dérivent de l'ATR et des supports/résistances aurait donc été construit
sur des barres contradictoires sans qu'aucun gate ne s'y oppose. C'est la chaîne C qui a bronché, sur
OXY, et seulement parce qu'elle suivait ce trade ouvert.

**How to apply:** porter le contrôle de bornes de `normalizeBars` dans le chemin `collect.js`, en
échec franc par symbole plutôt qu'en échec global, pour que le symbole atteint soit rejeté du vivier
au lieu de contaminer la sélection. Tant que ce n'est pas fait, vérifier explicitement les barres de
la séance de référence avant sélection. Un défaut au-dessus de ~1 % du vivier justifie le hard stop
de `MCP HARD STOP` ; sous ce seuil, exclure les symboles atteints et le déclarer dans le scan.

Voir [[mcp-hard-stop]], [[witness-vs-maxbar-partial-ingest]], [[no-full-refresh-before-scan]].
