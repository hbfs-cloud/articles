---
name: analysis-event-triggers-and-live-session
description: Plans d'analyse conditionnés à un événement → tradeIdea.triggerNotBefore ; séance en cours → bloc liveSession, jamais de niveaux sur barres partielles ; NODE_OPTIONS cmux casse node et le pre-commit
metadata:
  type: feedback
---

Leçons du 2 novembre 2026 (fiches LITE, NBIS, MRVL ; commits 0790075f8, a16250ca3, 6c8fe3d48).

1. **Déclenchement conditionnel.** `tools/analyses-lifecycle.js` déclenchait un plan sur n'importe quelle clôture au-dessus du seuil, en ignorant « après les résultats » écrit en prose : LITE et NBIS sont passés « active » le 29 octobre sur des clôtures antérieures à leurs résultats (un lecteur a acheté sur ce faux signal). Tout plan conditionné à un événement daté porte `tradeIdea.triggerNotBefore` (première séance dont la clôture compte) ; sans ce champ, une condition « après les résultats/la publication » en prose bloque le déclenchement automatique. Test : `tools/test-analyses-lifecycle.js`.
2. **Événement en séance** (rachat, résultats avant la clôture certifiée) : publier sur la dernière clôture certifiée, ajouter le bloc `liveSession` (cotations horodatées, « non certifiées ») et ne calculer aucun niveau sur une barre partielle ; annoncer le recalcul sur la clôture certifiée.
3. **Environnement** : le `NODE_OPTIONS` hérité de cmux pointe vers un preload absent ; `node` et le hook pre-commit échouent (« Cannot find module …restore-node-options.cjs »). Lancer `env -u NODE_OPTIONS node …` et `env -u NODE_OPTIONS git commit …` (le hook passe alors normalement ; ne pas utiliser --no-verify).
4. **Rachat payé en actions** : pour un lecteur qui ne fait qu'acheter, la cible devient une copie de l'acheteur ; ne jamais présenter l'écart d'arbitrage comme un gain sans couverture.

**Why:** un faux signal « active » a fait entrer un lecteur avant les résultats ; une fiche calculée sur une barre partielle serait fausse à la clôture.
**How to apply:** chaque fiche /analyse avec plan conditionnel renseigne `triggerNotBefore` ; en cas d'événement intraday, `liveSession` + refdate certifiée. Voir [[analyse-publish-gotchas]].
