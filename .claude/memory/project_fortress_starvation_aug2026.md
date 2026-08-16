---
name: fortress-starvation-aug2026
description: Incident 2026-08-07→16 — fortress 0 entrée pendant ~7 séances ; causes empilées (fortress_pool absent des scans 13-17/08 car commande /scanner sans l'étape fortress-pm ; regimeFilters écrase fortress_pm par mom_bo/breakout_only tous les jours ; sélection sweep 07-12/08 à élucider) ; fix : étape 5.5 réinjectée dans commands/scanner.md
type: project
---

# Fortress à sec (07→16/08/2026) — diagnostic

**Symptôme** (user, 16/08) : fortress ne prend plus de position. Dernières entrées 06/08 (PHM, LUV),
dernières sorties 10/08 (3 SL + 4 breakeven sur la série 03-06/08). `portfolio/v1/fortress` : 0 ordre,
0 position.

## Causes vérifiées (empilées, pas une seule)

1. **`fortress_pool` ABSENT des scans 20260813/14/17** — l'étape obligatoire Phase 5.5
   (`Skill(skill="fortress-pm")` → écrire `fortress_pool` dans signals.json) ne figurait PAS dans
   `.claude/commands/scanner.md` (elle ne vivait que dans le skill `scanner-pipeline` §784 et
   scanner/CLAUDE.md). Les runs harnachés suivant la commande l'ont sautée. Clé absente →
   `scanner-parser.js` fallback = top-10 sharia score≥92 → quasi toujours vide (max sharia récents :
   86-88 hors 12/08). **Fix appliqué 16/08 : étape 5.5 réinjectée dans la commande + liste modes 6→5.**
2. **`regimeFilters` neutralise le filtre dédié** : fortress a
   `regimeFilters:{risk_on:"mom_bo", *:"breakout_only"}` — le filterName `fortress_pm`
   (source dédiée FortressA+) n'est JAMAIS actif en pratique. Le tracker sweep nourrit donc fortress
   du top-10 sharia Momentum/Breakout ≥85 — c'est ainsi que ILMN/PHM/LUV… sont entrés début août.
3. **Pool vide souvent LÉGITIME** : la grille A+ du 14/08 fait passer 7 dossiers mais le meilleur
   score est 82 < A+ 92 → `fortress_pool:[]` n'est pas forcément un bug (`[]` = 0 A+ Halal légitime).
4. **Gate R/R du tracker incompatible avec le plancher éditorial (CAUSE PRINCIPALE, tous modes)** :
   `simulateTrade` rejette en dur `rr < 1.5` sur momentum/breakout/pullback/pre_squeeze, or le
   plancher PUBLIÉ est passé à 0,7 en RISK-ON le 10/08 → 100 % des signaux éditoriaux du
   10→17/08 (43 lignes) invisibles au tracker, zéro entrée sur TOUS les modes. Fix 16/08 :
   alerte bruyante `[rr-gate]` dans sweep (observabilité). **DÉCISION USER 16/08 : « aligne oui,
   il ne faut rien bloquer »** → gate aligné PAR ÈRE sur le plancher publié (1,5 avant le
   2026-08-10, 0,7 depuis) — historique identique à l'octet, chaînes intègres, returns/DD
   inchangés ; le tracker récupère les signaux post-10/08 (fortress +4 positions du 13/08 :
   OXY/COMP/CLF/HL ; balanced OXY ; turbo FRSH scellé breakeven). L'alerte reste comme détecteur
   de récidive (divergence future des deux planchers).
5. **Look-ahead dans le seed du circuit breaker (fortress seul, 07/08)** : `initialCBHistory`
   prenait les SL `exitDate >= windowStart` SANS borne `< firstNewScan` → les SL du 10/08
   pré-armaient la pause d'une sim démarrant le 07/08 (pauseUntil=13/08 dès J1, 7 candidats
   refusés à slots libres). Fix 16/08 : borne ajoutée ; fortress 109→116 trades (7 entrées du
   07/08 récupérées : JCI/ROST/ITX.MC scellés breakeven + KBC.BR/CPER/EWS/NSC ouverts),
   chaîne intègre, return 19,87 %→20,02 %.
6. **Sweep orphelin depuis le 13/08 09:15** : le refactor /scanner a remplacé `scan-parallel.sh`
   (chaîne C = update-tracking + sweep --quick) par la seule collecte wave1, et
   `downstream-split.sh` appelle `publish-daily-card.sh --no-sweep` → PLUS RIEN ne lançait le
   sweep. Livre gelé 3 jours. Fix : chaîne C réinjectée dans la commande.
7. **OOM silencieux du sweep complet** : la grille (24,7M combos, 120 scans) dépasse le heap node
   par défaut (~4 Go) ; le crash était masqué par un pipe `| tail` (exit du pipe = exit de tail).
   Fix : `NODE_OPTIONS=--max-old-space-size=8192` dans scan-parallel.sh + publish-daily-card.sh,
   et rc réel capturé via PIPESTATUS avec échec bruyant.

Note connexe : le circuit breaker de fortress (3 stops/5 j → pause 3 j) EST actif dans la config,
contrairement à ce qu'affirme le message du commit 4cc85a7a9 (07/08, « fortress ne récupère ni
ddBreaker ni circuit breaker »). Il a légitimement mordu du 11 au 13/08 après les 3 SL réels
(ILMN 06/08, PHM+LUV 10/08).

## Leçons
- Une étape AI-driven non scriptable (fortress-pm) DOIT être dans la **commande** suivie par
  l'agent, pas seulement dans un skill compagnon — le dédup commande/skill du 14/08 a perdu le lien.
- Vérifier l'assèchement d'un mode = regarder (a) la clé pool dans signals.json (absente vs vide),
  (b) le filtre effectif par régime (`regimeFilters` écrase `filterName`), (c) les slots occupés,
  (d) les gates globaux (vixKill/ddBreaker/circuitBreaker), dans cet ordre.
