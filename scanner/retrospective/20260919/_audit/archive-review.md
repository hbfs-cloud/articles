# Revue d'archive — scanner 14–17 septembre 2026

**Référence d'observation :** clôture du 18 septembre 2026. Revue locale, en lecture seule, des quatre paires JSON/HTML, du moteur et des contrats indiqués. Cette note ne produit ni cours, ni performance.

## Cohorte point-in-time

Le contrat scanner désigne signals.json comme source structurée et le HTML comme son rendu (scanner/CLAUDE.md:14-15). Les quatre archives donnent cette cohorte exhaustive :

| Scan | Clôture de référence | Régime | Propositions | Horizon |
|---|---|---|---:|---:|
| 20260914 | 2026-09-11 | RECOVERY | 8 | 10 séances |
| 20260915 | 2026-09-14 | RECOVERY | 9 | 10 séances |
| 20260916 | 2026-09-15 | RISK-ON | 10 | 10 séances |
| 20260917 | 2026-09-16 | RECOVERY | 8 | 10 séances |
| **Total** |  |  | **35** | **10 séances, chacune** |

Les titres, niveaux entry/stop/tp1/tp2, stratégies et horizons viennent uniquement de signals[]. Les titres HTML annoncent également 8, 9, 10 et 8 setups conditionnels. Le dénominateur est donc réconcilié à 35 comme le prescrit .claude/commands/retro.md:11-17. Il faut conserver les 35 lignes, y compris les répétitions et les éventuels no-fill.

Le moteur définit l'échéance comme scan_date + N séances de bourse (tools/build-period-retro.js:129-150). Avec son sens explicite de « + 10 », les fins d'horizon sont le 28, 29 et 30 septembre, puis le 1er octobre. Au 18 septembre, les **35 propositions sont non mûres**. Même une sortie déjà observée doit rester hors hit rate, moyenne R et profit factor (.claude/commands/retro.md:94-115).

## Ce que l'archive établit

Les pages publient des plans conditionnels, LIMIT à prix unique, valables pour la séance cible, sans poursuite et sans report. Elles ne prouvent ni ordre transmis, ni activation intraday, ni taille de position. Le contrat interdit de convertir un LIMIT en MARKET (scanner/CLAUDE.md:58-62).

La collecte du run principal a passé les gates freshness/run; la couverture intraday est complète à 26 barres RTH de 15 minutes par séance requise. Cela ne transforme pas des niveaux en exécutions. Le moteur donne, à titre de diagnostic seulement, 24 fills hypothétiques dont 15 chase, et 11 no_fill. Aucun de ces nombres ne constitue une transaction ou une statistique de performance.

Le moteur exige --levels-only (tools/build-period-retro.js:12-26). Le contrat rétro prescrit que cette sortie porte execution_certified: false, avec une base de performance explicite, et précise qu'elle ne certifie pas les activations ni les fills (.claude/commands/retro.md:97-104); l'output porte cohort_performance_certified: false (tools/build-period-retro.js:413-420).

## Divergences publiées / moteur

1. **Chase.** fill-policy.js classe un prix au-dessus de l'entrée comme chase jusqu'à la tolérance, puis no_fill (tools/lib/fill-policy.js:25-46). Cette branche explique les 15 chase hypothétiques, mais elle diverge de la consigne publiée de ne pas poursuivre un prix ouvert au-dessus de l'entrée. Les chase doivent rester séparés et ne jamais être appelés fills publiés.

2. **Activation et portefeuille.** Le moteur ne rejoue pas VWAP, EMA, capacité ni fills effectifs; le runbook précise qu'une couverture OHLCV parfaite ne les certifie pas (.claude/commands/retro.md:97-104).

3. **Invalidation.** Les plans du 16 ajoutent une sortie sur invalidation en plus du stop. La dernière révision déplace même DRH de 12,26 à 12,255. Le moteur ne transporte que entry, stop, tp1, tp2 et horizon (tools/build-period-retro.js:135-151), donc il ne peut reproduire cette hiérarchie.

4. **Sens du délai.** Les pages disent « 10 séances » sans dire si la séance cible compte; le moteur compte dix séances après scan_date. La convention doit être inscrite dans le manifeste avant toute statistique.

Ces écarts bloquent une performance certifiée. Ils ne justifient ni modification d'archive ni reconstruction de preuve a posteriori.

## Point-in-time et corrections

| Scan | Révision(s) ciblée(s) | Constat |
|---|---|---|
| 14 | publication 484245061 (13/09 01:11 CEST); JSON enrichi par 836bfb6ae, 03f8530d, 6be6f946 | le diff ajoute le pool Fortress et le rejet TECH; signals[] n'est pas modifié. HTML uniquement dans 484245061. |
| 15 | 1732c095e (15/09 09:04 CEST) | une révision ciblée pour JSON et HTML. |
| 16 | b4d53f263 (08:10), eaeb264af (11:15), 0f397fb90 (11:24 CEST) | dix titres et niveaux inchangés; régime, thèses, niveau d'invalidation et HTML corrigés. Retenir la dernière version en la nommant. |
| 17 | 3703fc7ab (17/09 00:59 CEST) | une révision ciblée pour JSON et HTML. |

Les dates Git prouvent des révisions locales, pas l'heure de mise en ligne ni le contenu reçu par un lecteur. Aucun commit ultérieur ne modifie les huit fichiers ciblés dans l'état local inspecté. Sans journal de déploiement, hash de contenu servi ou snapshot public horodaté, **le point-in-time externe ne peut pas être certifié depuis Git seul**. Une rétro gouvernante doit donc fixer les commits et hashes blob de chaque JSON/HTML, sans réécrire la première publication; le runbook prévoit de conserver l'original (.claude/commands/retro.md:91-95).

Une seconde limite de réconciliation subsiste au 18 septembre entre daily et enveloppe intraday : EMR low 147,20/147,12; JNJ high 272,09/272,11; REXR low 38,1299/38,10; XOP high 193,15/193,16 et low 190,57/190,55. Une couverture 15 minutes complète ne résout pas ce conflit. Il faut définir la série gouvernante par événement et lier les sources à leurs hashes avant tout résultat certifié.

## Répétitions et QCOM

Il y a 28 tickers uniques et sept occurrences additionnelles. Les répétitions, qui restent toutes dans les 35 propositions, sont :

| Ticker | Occurrences | Stratégies |
|---|---|---|
| AAPL | 14, 15, 16 septembre | Breakout, Breakout, Momentum |
| META | 14, 15 septembre | Breakout, Breakout |
| EMR | 14, 16 septembre | Pullback, Pullback |
| JNJ | 14, 16 septembre | Pullback, Pullback |
| UNM | 16, 17 septembre | Breakout, Breakout |
| BUG | 16, 17 septembre | Momentum, Momentum |

Les tableaux futurs doivent ventiler « nouvelle idée » et « réémission »; ces observations ne sont pas indépendantes. Le scan du 17 explique explicitement l'exclusion d'AAPL à entrée dégradée, et la reprise d'UNM/BUG à entrée meilleure (scanner/20260917/signals.json, rejected AAPL).

QCOM n'est pas une répétition de proposition : exclusion du 14 (« capacité equity et warrants »), proposition Breakout le 15 (entrée 180,15; stop 168,86; horizon 10), puis exclusion les 16 et 17. Les deux dernières archives invoquent le warrant Amazon de 25 millions d'actions sous 8-K Item 3.02, plus 19,2 millions liés à Modular (scanner/20260916/signals.json:1507-1515; scanner/20260917/signals.json:1367-1382). Le contrat scanner reconnaît que le filtre de type de formulaire avait laissé passer QCOM et décrit le défaut (scanner/CLAUDE.md:43-52). La ligne du 15 reste dans le dénominateur historique; l'exclusion ultérieure ne l'annule pas.

## Bilan provisoire recommandé

Ne publier qu'une note de couverture : « 4 scans, 35 propositions publiées, 0 horizon arrivé à échéance au 18 septembre; exécution et performance non certifiées. » Elle peut joindre sous l'étiquette *diagnostic levels-only* les 24/15/11 résultats hypothétiques, les 35 non-matures, les répétitions et les références Git. Elle ne doit afficher ni hit rate, ni moyenne R, ni profit factor, ni rendement de panier, ni classement gagnant/perdant.

Avant un bilan final : attendre les horizons; résoudre chase contre LIMIT; obtenir les activations/fills ou conserver levels-only; reproduire ou exclure explicitement les sorties d'invalidation; réconcilier daily/intraday et hashes; geler chaque publication; ventiler les répétitions. Cette séquence suit la séparation exigée entre propositions, no-fill, ambigus et non-matures (.claude/commands/retro.md:119-129).
