# Scanner — Gates bloquants & intégrité de notation

Origine : audit scanner du 13–19 juillet 2026 (rétro 20260717 notée D*). Source de vérité
des règles : workspace memory `dailystocks`, tag `lecon-20260717` (`entry-strategy-coherence`,
`etf-lookthrough-correlation-cap`, `retro-grades-published-levels`) + `data/scanner-lessons.json`
(`regime-score-label-lag`). Ce document décrit ce qui est ENCODÉ — pas des recommandations.

## Les 4 gates (bloquants à la publication)

Config : `data/scanner-filters.json` → section `audit_gates` (`active_from: 2026-07-21`,
les scans publiés avant sont grandfatherés). Enforcement : `tools/validate-scan.js`
(G1–G3, câblé avant `add_card.js` dans le pipeline) et `tools/gen-status-page.js` (G4).
Portée G1–G3 : le top publié (`signals[]` du `signals.json`), hors Candlestick/spécialistes.

### G1 — `entry_strategy_coherence`
Une ligne **Momentum/Breakout** s'achète en stop-buy AU-DESSUS du niveau de cassure :
`min(zone d'entrée) >= close de la veille` (champs `entry_low`/`price`, tolérance technique
0,1%). Échec → retirer la ligne ou requalifier **Pullback**. Champs manquants = fail-closed.
Évidence : semaine du 13/07, 5 momentums entrés « en repli » sous étiquette RISK-ON, 5 stops.

### G2 — `etf_lookthrough_correlation_cap`
Chaque ETF du top publié est **décomposé sur ses top holdings AVANT le cap de 2 par
cluster**. Contrat d'enrichissement (au scan, via MCP) : chaque signal ETF porte
`lookthrough: { factor: "momentum"|"growth"|null, clusters: ["semis", ...] }` — absent =
fail-closed. Les clusters des ETF comptent avec les secteurs des titres vifs
(`sector_map`) dans le cap de 2. Un **ETF factoriel dont le facteur est déclaré en sortie
dans la thèse du jour** (`exited_factors: []` à la racine de `signals.json`, déclaré par
l'agent au scan) est retiré. Cas d'école : MTUM le 14/07 (3 semis + un ETF momentum chargé
en semis dans le même top 10), SPMO le 16/07.

### G3 — `regime_score_drop` (extension de `regime-score-label-lag`)
Décrochage de confiance **> 15 pts sur 5 séances** (pic de la fenêtre → scan courant,
échelles 0–1 et 0–100 normalisées) → **Momentum plafonné à 20% du top publié quelle que
soit l'étiquette** + ETF factoriels momentum retirés (G2 s'applique d'office au facteur
momentum). Évidence : 13–17/07, confiance 84 → 57 sous étiquette RISK-ON, momentums 1W/5L.
Complète la règle `regime-score-label-lag` déjà active (divergence label/score ≥ 2 niveaux).

### G4 — heartbeat rétro (anti-gel du bloc index)
`gen-status-page.js` (qui tourne à chaque pipeline ET à chaque rétro) compare la date
`Updated:` du bloc « Scanner Performance » de l'index avec la dernière rétro publiée, et
écrit `data/scanner-heartbeat.json`. **Bloc plus vieux que la dernière rétro** → alerte
Telegram (token `.env`) ou marqueur `HEARTBEAT-RETRO-STALE` relayé par la routine cloud
(MCP notification, alias `alerts`). Généralisation du correctif « staging stale bruyant »
du 17/07. Évidence : bloc figé du 2 au 19 juillet (regex no-op silencieuses).

### G5 — `tp1_reachability` (remplace le plancher de R/R comme critère de sélection)

`active_from: 2026-08-10`. Config : `data/scanner-filters.json#editorial_targets`.
Enforcement : `tools/validate-scan.js` (règle `tp1_reachability`).

**La cible doit être à une distance que le titre PARCOURT RÉELLEMENT sur l'horizon** :
`1,0 ≤ (tp1 − entry) / ATR14 ≤ 2,0`, optimum mesuré **1,5×ATR**. `extension.atr` absent =
**fail-closed** : sans ATR la cible n'est pas vérifiable, donc pas publiable.

**Pourquoi le plancher de R/R ne suffisait pas — et nuisait.** Backtest des 21 scans publiés
du 10/07 au 07/08 (196 lignes éditoriales, 169 tickers, barres réelles, règles de remplissage
et de sortie du dépôt), sur les 96 trades dont l'horizon était écoulé :

| | |
|---|---|
| espérance | **+0,025 R** |
| cible atteinte | **12 / 96 = 12,5%** |
| distance moyenne à la cible | **8,48%** |
| meilleur gain latent moyen | **4,38%** |

La cible était deux fois plus loin que là où le prix va. Il aurait fallu 37,0% de réussite
pour qu'un R/R annoncé de 1,704 ait un sens. L'espérance ne tenait que par les sorties à
l'horizon (39,6% des trades, +0,71 R), jamais par les cibles.

**Mesure de la correction** — mêmes lignes, mêmes entrées, mêmes stops, SEULE la cible change
(n=88, les lignes sans `extension.atr` exclues) :

| cible | TP1 atteint | espérance |
|---|---|---|
| publiée | 12 | +0,025 R |
| 1,0×ATR | 41 | +0,071 R |
| 1,25×ATR | 36 | +0,089 R |
| **1,5×ATR** | **31** | **+0,108 R** |
| 1,75×ATR | 27 | +0,061 R |
| 2,0×ATR | 21 | +0,055 R |
| 2,5×ATR | 14 | +0,035 R |

Courbe à optimum net, monotone de part et d'autre. La bande `[1,0 ; 2,0]` retenue est celle où
l'espérance vaut au moins le double de la méthode publiée.

**L'incompatibilité qui a motivé le changement.** Un stop doit être ≥ 1,5×ATR
(`stops-min-atr-multiple`). Une cible à 1,5×ATR donne donc un R/R ≤ 1,0. Exiger R/R ≥ 1,5
revenait à exiger une cible à **≥ 2,25×ATR**, atteinte 12 à 21% du temps. **Le plancher de R/R
ne protégeait pas des mauvais trades : il causait les cibles inatteignables.**

**Ce qu'est devenu le plancher de R/R.** Abaissé à 0,7 (0,9 en EARLY RISK-OFF / RISK-OFF) et
rétrogradé au rôle de garde-fou de dernier recours — écarter un rapport structurellement
absurde. Il ne sélectionne plus. Les scans antérieurs au 2026-08-10 restent jugés à l'ancien
seuil (1,5 / 2,0) : `_previous` dans la config, grand-pérage appliqué par `validate-scan.js`
ET par `qa-check.js`.

**Portée.** Scanner ÉDITORIAL uniquement (`signals[]`, stratégies Momentum / Breakout /
Pullback / Pre-Squeeze). Le scanner ÉVÉNEMENTIEL (`gap-scanner.js`,
`scanner-filters.json#event_driven`) conserve ses planchers de 1,5 / 2,0 : le backtest ne
porte pas sur lui, et ses setups ont une dynamique propre.

**Réserve ouverte.** La bande a été mesurée sur 30 jours dominés par RISK-ON et RECOVERY.
Question ouverte `tp1-reachability-regime-dependence` dans `scanner-lessons.json`, à revoir
le 2026-09-15 une fois 40 trades accumulés en régime défensif.

## Politique de fill unique (scan + rétro)

Module : **`tools/lib/fill-policy.js`** — la SEULE définition de rempli / chase / NON REMPLI.
- `CHASE_TOLERANCE_PCT = 2` (constante unique, ne jamais redéclarer ailleurs).
- Chase mesuré à la **borne haute de la zone publiée** (`entry` de `signals.json`) :
  un fill dans la zone n'est jamais un chase ; au-dessus de la zone et ≤ 2% = chase
  (tag obligatoire) ; au-delà = NON REMPLI (jamais noté).
- ⚠️ La page du scan doit afficher la **zone complète** (`entry_low`–`entry`). Constat du
  19/07 : les pages des 14–16/07 n'affichaient que la borne basse (UAA « 6.6 » pour une
  zone 6,60–6,80) — c'est cette divergence page/record qui a rendu la notation ambiguë.

### Assertion CI (build de la rétro)
`tools/qa-retro.js` (branché dans `publish.js --type retro`, Step 4b) vérifie CHAQUE ligne
notée : `|entrée_effective − entrée_publiée| <= tolérance` **OU** statut NON REMPLI — sinon
le build échoue. Le niveau publié est relu depuis `signals.json` du scan (fallback
`data-entry` de la page), **jamais** depuis la rétro (rebasing silencieux impossible).
Tout écart constaté passe en **« Transparence process »** de la rétro, jamais en
re-basage silencieux des entrées.

## Les 5 assertions du bloc index (« Scanner Performance »)

Générateur : `tools/update-scanner-perf.js` (v2, piloté par `data/retro-summary.json`,
remplacement par ancres — ancre introuvable = exit 1, jamais de no-op silencieux).
Assertions post-écriture (exit 1 si échec) :
1. `updated_at` = date de la dernière rétro publiée ;
2. compteur de rétros **unique partagé partout** (header, narratif, KPI, bannière) ;
3. note « latest » = note de la dernière rétro ;
4. lien « View full retrospective » → `/scanner/retrospective/<dernière>/` ;
5. régime affiché = régime de clôture de la dernière rétro (`regime_label` du dataset).
Gate de fraîcheur amont : dataset en retard sur le dernier dossier rétro = exit 1.

## Boucle de promotion des règles mémoire

Une règle mémoire (workspace `dailystocks` / `data/scanner-lessons.json`) devient un
**gate bloquant encodé** dès que : **confiance ≥ 0,70 ET n ≥ 5** (sample_size de
l'évidence). Process, au moment de la rétro hebdomadaire :
1. `lessons-engine.js --validate/--decay/--promote` met à jour confiance et statut
   (jamais d'édition manuelle) ;
2. toute règle franchissant le seuil est encodée au scan suivant : section dans
   `data/scanner-filters.json` + check dans `tools/validate-scan.js` + entrée dans ce
   document (avec évidence chiffrée et `active_from`) ;
3. une règle encodée qui repasse sous 0,40 de confiance est rétrogradée en advisory
   (le check reste mais ne bloque plus) — décision documentée ici.
G1–G3 sont les trois premières promotions de cette boucle (audit 13–19/07).

## Blocs HARNESS

**Scanner (à chaque scan)** : `validate-scan.js` doit passer ; le scan publie le
**pass/fail nominatif des gates** (G1, G2, G3 + heartbeat G4) dans sa section Méthode /
QA de pipeline — un gate absent du rapport = run non conforme. L'enrichissement ETF
(`lookthrough`) et `exited_factors` font partie de la génération de `signals.json`.

**Rétro (chaque vendredi)** : la rétro **atteste** : (a) notation aux niveaux publiés —
`qa-retro.js` PASS (via `publish.js --type retro`) ; (b) bloc index rafraîchi —
`update-scanner-perf.js` exécuté après mise à jour de `data/retro-summary.json`, puis
heartbeat G4 `fresh: true`. Les écarts vont en « Transparence process ».

## G4 — pipeline_order (incident 20260730)

`active_from: 2026-07-31`. La doctrine perf (`.claude/skills/perf-parallel-mcp.md`, R2) place le
filtre resultats en **Vague 1**, avant tout enrichissement par ticker. Rien ne le forcait : le 30/07
il a tourne en Vague 3 et F + PFE sont morts APRES avoir consomme leur salve d enrichissement
complete (~15 min de reprise sur un run de 78 min).

`signals.json` doit porter, sous peine de refus de publication :

```json
"_pipelineOrder": {
  "earnings_screened_at": "2026-07-30T20:05:00Z",
  "enrichment_started_at": "2026-07-30T20:18:00Z",
  "candidates_screened": 39,
  "method": "8-K item 2.02 sur le vivier complet, avant toute salve enrichissement"
}
```

plus `earnings_source: "8k_item_202"` sur **chaque** ligne publiee.

Controles : (a) `earnings_screened_at` strictement anterieur a `enrichment_started_at` ;
(b) `candidates_screened` >= `min_screened_ratio` (2) x le nombre de lignes publiees, pour que le
filtre couvre le vivier COMPLET et pas la selection finale ; (c) source 8-K par ligne — le champ
calendrier previsionnel a laisse passer 10 titres deja publies le 20260730 (F, AWK, EXR, REG, FE,
CNC, IVZ + LYV/KKR/OWL/RAL le jour meme).
