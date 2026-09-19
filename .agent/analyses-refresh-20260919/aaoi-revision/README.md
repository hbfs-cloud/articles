# AAOI — révision locale, 19 septembre 2026

## Portée

Cette livraison est strictement locale. Elle ne modifie ni `data/analyses-data/AAOI.json`, ni `analyses/AAOI/index.html`, ni les outils partagés. Le statut est `no-trade`; aucune attestation AQ-1/AQ-1.1 n’est produite.

## Artéfacts

- `analyses/AAOI/_runs/20260919-update/revision/AAOI.json` : fiche française complète.
- `calculations.json` : calculs déterministes AAOI et 18 comparables.
- `numeric-evidence.json` et `evidence.json` : 239 valeurs ou chaînes chiffrées. Chaque claim cite son input, son pointeur exact et sa méthode; le hash contrôle l’intégrité du fichier, il ne constitue pas une validation factuelle autonome.
- `primary-manifest.json` : cinq primaires SEC, avec fichiers archivés sous `../primary/`.
- `index.html` : rendu local intégral obtenu par `tools/render-analysis.js` importé en mode local; aucune sortie canonique n’est écrite.
- `AAOI-archive-snapshot-20260828.json` : snapshot daté et haché du contrat historique, conservé pour les seuls repères repliés.
- `build-aaoi.cjs` : générateur reproductible, limité aux répertoires du run et de ce dossier de contrôle.

## Sources et méthodes

- Close AAOI : 18 septembre 2026, 300 séances quotidiennes réparées sous `../data/bars.json`.
- Comparables : LITE, COHR, CIEN, VIAV, GLW, AXTI, CRDO, MRVL, CSCO, ANET, MSFT, AMZN, META, NVDA, SMH, SOXX, QQQ et SPY. Chaque statistique emploie 124 rendements journaliers communs, du 23 mars au 18 septembre 2026.
- Les corrélations et R² sont des calculs locaux sur rendements logarithmiques. Le bêta est explicitement **β AAOI vs pair = cov(r_AAOI,r_pair) / var(r_pair)**. Les performances 5/21 séances sont des rendements de prix simples. Ils restent descriptifs jusqu’au retour de RankBeta.
- Les primaires AAOI archivés sont le 10-Q Q2, le 424B5 ATM et trois 8-K de capacité. Le manifest conserve accession, URL EDGAR, hash, ancre de ligne et extraits chiffrés utilisés : ATM, RSU/PSU, warrant Amazon et illustration de prospectus.
- Les KPI fournisseur sans période comptable identifiable sont explicitement qualifiés; le revenu Q2 affiché provient du 10-Q avec sa période. Les indicateurs techniques restent un snapshot fournisseur : les 300 séances certifient close et rendements locaux, sans recalcul local EMA/RSI/ATR ni signal d’exécution.
- Le scénario de valorisation est explicitement `non_applicable`, avec `reason_code: NON_POSITIVE_EBITDA` et une base vérifiable (input fundamentals déclaré, SHA-256, pointeur EBITDA négatif). Aucun EV, prix conditionnel ou downside n’est calculé.

## Gates

| Gate | État | Conséquence |
|---|---|---|
| Séries AAOI / comparables | PASS local | Calculs déterministes autorisés |
| RankBeta point-in-time | BLOCK — HTTP 403 | Pas de certification de transmission ni de publication |
| Calendrier CIEN | BLOCK — UNAVAILABLE | Pas de calendrier comparable exhaustif |
| Capital entièrement dilué | BLOCK | ATM/instruments à réconcilier avant thèse par action |
| Contrat de trading | BLOCK | Prédicat historique documenté, expiré et non rejoué sur la nouvelle fenêtre |
| Attestation AQ finale | NON EXÉCUTÉE | Fiche locale uniquement |

## Contrôles exécutés

```text
node .agent/analyses-refresh-20260919/aaoi-revision/build-aaoi.cjs
node tools/validate-analysis-evidence.js analyses/AAOI/_runs/20260919-update/revision/evidence.json
node tools/render-analysis.js analyses/AAOI/_runs/20260919-update/revision/AAOI.json --dry
node tools/check-ai-tells.js analyses/AAOI/_runs/20260919-update/revision/index.html
```

Le validateur d’evidence passe les 239 claims et vérifie la résolution des pointeurs/hashes, y compris la base EBITDA du statut `non_applicable`. Cela ne remplace pas une revue sémantique : la revue indépendante est conservée dans `independent-review.md` et ses corrections sont intégrées ici. `validate-workflows --run-plan` ne peut pas émettre un PASS de run parce que ce run local n’a pas de `harness.json`; les deux gates externes restent de toute façon bloquants (RankBeta HTTP 403, calendrier CIEN indisponible). Aucune publication, attestation AQ ou validation finale n’est annoncée.
