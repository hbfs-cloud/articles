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
