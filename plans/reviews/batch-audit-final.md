# Audit hostile final - 57 analyses

**Verdict: CLEAN**

Controle final du 2026-08-28 sur les 57 JSON, 57 HTML, 57 harnesses canoniques et les cinq panels actifs. L'absence volontaire du manifeste de hashes, prevu apres cet audit, n'est pas un blocker.

## Blockers precedents

- **NBIS leve:** le 6-K du 2026-08-12, accession `0001104659-26-094568`, indique maintenant exactement T2 2026 groupe **$582.3M** et AI cloud **$574.9M**, contre T2 2025 **$105.1M** et **$93.7M**. Le finding corrige est identique dans JSON et HTML. Le panel infrastructure-power reatteste NBIS `PASS 86` et les 12 dossiers du groupe sont PASS.
- **Lifecycle leve:** zero occurrence rendue de `Current trade state: pending` et zero mismatch entre `tradeIdea.status`, badge, status note et Mindset Tip sur 57 dossiers.
- **Panels reattestes:** crypto-metals **10/10 PASS**, hardware **15/15 PASS**, infrastructure-power **12/12 PASS**, leaders-software **14/14 PASS**, observed **6/6 PASS**. Chaque revue a un score >=80 et `failedCheckIds: []`; les univers correspondent exactement aux cinq overrides actifs.

## Points hostiles revalides

- **SMCI:** common et mandatory preferred executees, options incluses, **653,650,558** actions legales, claim preferred **$4.3125B**, EV **$30.64B**, guidance shares **745M GAAP/761M non-GAAP**; l'ATM $1.25B reste une capacite non vendue.
- **WULF:** le 424B5 fixe 47.4M actions et l'option de 7.11M; le 10-Q prouve ensuite **54.51M** actions et **$1.0357B** brut. Aucun double comptage preliminary/final/completion.
- **COIN:** 263.837M actions A+B, equity **$49.35B**, EV **$47.03B**, denominator trailing adjusted EBITDA **~$1.878B**, soit **~25.0x**.
- **LUNR:** base courante du 6 aout **228,924,068**; sensibilite diluee du 30 juin **264,590,764**. Les deux dates et perimetres restent separes.
- **NBIS:** EV **$59.19B**; **43.5x** revenu trailing, **229.4x** EBITDA trailing et **19.7x** run-rate non-GAAP. La correction SEC ne casse aucun ratio.
- **MARA:** NAV point-in-time au 27 aout sur le perimetre du 30 juin; les facilites posterieures ne sont pas soustraites seules.
- **AG:** les **$159.4M** de restricted cash ne sont pas nettes comme liquidite ordinaire; le bridge **9.7x** est reproductible.
- **EQX:** le **7.5x** reste correctement etiquete `EV/gross mine-margin scenario`, jamais EV/EBITDA.
- **SEC et segments:** aucun shelf pris pour une issuance, dette prise pour equity, resale prise pour primary, double comptage preliminary/final, ou pseudo-segment non etiquete n'a ete detecte.
- **Trade:** 33 `wait`, 14 `watch`, 10 `rejected`. Les RR se recalculent depuis les niveaux publies; tous les `wait/rejected` bloquent ordre ou sizing. CAN reste explicitement un map dormant non executable, pas un short. Les cutoffs quotidiens sont au **2026-08-27** dans les 57 harnesses et setups.
- **Cross-field:** aucun header market cap/shares ne diverge de plus de 8% de son bridge publie. Les huit dossiers historiques cibles contiennent les memes chiffres dans JSON et HTML.
- **Editorial:** aucune phrase editoriale exacte repetee sur trois tickers; aucun filler headline, lifecycle stale ou ancien texte d'invalidation. Les champs dark-pool non sources sont affiches `N/A`, sans claim directionnel.
- **Finviz:** les 57 HTML conservent les URLs chart et quote du bon ticker. Un test isole de la page normale SMCI a retourne **HTTP 200**, `text/html`, avec le bon titre; aucune rafale n'a ete lancee.

## Gates finaux

- Dry render/schema: **57/57**, exit 0.
- AQ strict `--pre-review`: **57 dossiers, 0 erreur, 0 warning**, exit 0.
- AI-tells strict: **57/57 sans tell**, exit 0.
- Harness/panel/geometry/cross-field custom: **0 erreur**.
- Recherche lifecycle rendue: **0 pending, 0 mismatch**.

Aucun blocker de publication reel ne subsiste dans l'etat audite. Verdict batch final: **CLEAN**.
