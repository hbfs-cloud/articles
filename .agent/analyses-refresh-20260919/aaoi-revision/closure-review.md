# AAOI — revue de clôture locale, 19 septembre 2026

Cette note clôt les défauts matériels relevés dans `independent-review.md`. Elle ne l'annule pas : les gates RankBeta et calendrier CIEN restent bloqués, donc la fiche demeure `no-trade`, sans AQ ni autorisation de publication.

## Corrections vérifiées

- **Provenance P0.** `numeric-evidence.json` porte 239 mappings. Chaque nombre ou chaîne chiffrée porte input déclaré, SHA-256, JSON Pointer qui se résout et méthode. Les rendements/comouvements pointent vers la série du ticker concerné, avec la série AAOI déclarée comme dépendance; la formule beta est explicitement `β AAOI vs pair = cov(r_AAOI,r_pair) / var(r_pair)`. Les nombres des primaires (ATM, actions, RSU, PSU, warrant et illustration) pointent vers leur `claim_extracts` daté, avec accession et ligne. Les seuls pointeurs `/documents/N` restants sont des métadonnées bibliographiques de ce document précis (date, URL, form, accession, intitulé), jamais la preuve d'un chiffre calculé.
- **Archive P0.** Les niveaux viennent exclusivement de `AAOI-archive-snapshot-20260828.json`, artefact local daté et haché. Le texte indique que le prédicat historique est documenté, expiré et non rejoué; le renderer officiel enferme les niveaux sous « Voir les anciens niveaux — non exécutables ».
- **Capital P1.** La fiche comprend la matrice lisible du warrant Amazon (7 945 399, strike 23,6956 $, parties exerçable/conditionnelle et condition 4 Md$ sur dix ans), des RSU et PSU exclus au 20 août, de la base prospectus et de l'illustration ATM. Elle ne les ajoute pas à un total fully diluted courant et conserve ce gate `BLOCK`.
- **Valorisation P1.** Aucun multiple zéro, EV, valeur des fonds propres, prix conditionnel ou downside ne subsiste. `valuation_scenario` vaut `non_applicable`, avec `reason_code: NON_POSITIVE_EBITDA` et une base qui déclare `fundamentals.json`, son SHA-256 et le pointeur EBITDA; celui-ci vaut -32 106 000.
- **Indicateurs P2.** EMA/RSI/ATR sont explicitement un snapshot fournisseur. Les 300 séances ne certifient ici que la continuité du close et les calculs de rendements locaux; aucun indicateur n'est présenté comme un calcul local ni comme signal d'exécution.

## Contrôles rejoués

```text
node .agent/analyses-refresh-20260919/aaoi-revision/build-aaoi.cjs
  AAOI revision generated: 18 comparable symbols / 124 common returns; 239 semantic mappings; NO TRADE.

node tools/validate-analysis-evidence.js analyses/AAOI/_runs/20260919-update/revision/evidence.json
  PASS (239 claims)

node tools/render-analysis.js analyses/AAOI/_runs/20260919-update/revision/AAOI.json --dry
  valid (AAOI, grade C+)

node tools/check-ai-tells.js analyses/AAOI/_runs/20260919-update/revision/index.html
  2493 words; no obvious AI tells
```

Le contrôle spécifique du scénario N/A vérifie que la base est déclarée et hashée, que le pointeur se résout vers une valeur finie inférieure ou égale à zéro, et qu'aucun des champs économiques interdits n'est présent. Il passe.

## Gates restant ouverts

| Gate | État |
|---|---|
| RankBeta upstream | BLOCK — HTTP 403 |
| Calendrier CIEN | BLOCK — indisponible |
| Pont fully diluted au 18 septembre | BLOCK — non réconcilié |
| Prédicat de trading historique | BLOCK — expiré, non rejoué |
| AQ / publication | Non exécutées |
