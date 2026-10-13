# Pourquoi /scanner/status ne bougeait plus — diagnostic du 13 octobre 2026

## Constat

Les courbes des quatre modes du scanner (turbo, dynamic, balanced, fortress) s'arrêtaient au
4 septembre 2026, celle de best au 18 septembre. La page était pourtant régénérée à chaque scan.
`data/backtest-trades.json` : dernière entrée scellée le 1er septembre pour turbo, balanced et
fortress, le 20 août pour dynamic ; aucune position ouverte depuis le 4 septembre.

## Trois causes distinctes

1. **Score plat contre seuil de score (turbo, dynamic, balanced).** Depuis le scan du 8 septembre,
   `tools/build-scan.js` publie `score: 80, scoreSource: 'flat_no_ranking_asserted'` sur chaque
   ligne : les scores de criblage ne sont pas comparables d'une famille à l'autre et la revue
   d'août 2026 mesure une corrélation nulle entre score et rendement. Les modes exigent
   `minScore` 90 (turbo), 88 (dynamic) et 85 (balanced) : plus aucun signal ne passe. Le défaut
   était identifié le 13 septembre (`.claude/memory/feedback_preview_must_not_bypass_gates.md`),
   seul l'affichage avait été corrigé.
2. **Fortress privé de ses deux sources.** Ses `regimeFilters` (mom_bo en risk_on, breakout_only
   sinon) le nourrissent des lignes publiées marquées conformes et notées au moins 85 : depuis le
   8 septembre, `build-scan.js` les note toutes 80 et les marque `sharia: false`. Son autre source,
   le pool A+, restait vide parce que le crible propre du skill `fortress-pm` (mid-cap 2 à 20 Md$,
   rotation, Sharia, quatre éliminatoires) n'était plus exécuté : les revues relisaient seulement le
   panier publié (« Le crible A+ indépendant … n'a pas été relancé »,
   `scanner/20261012/_final/fortress-review.json`).
3. **best en évaluation seule.** DTX tourne en `compare_only` depuis le 24 septembre, décision du
   propriétaire, tant qu'`etf_us` n'est pas `eligible_for_live`. Aucun ordre, donc aucune entrée.

S'y ajoutait un défaut d'affichage : une courbe s'arrêtait à la dernière sortie au lieu d'aller
jusqu'à la clôture certifiée, ce qui faisait passer un portefeuille en liquidités pour une page figée.

## Faut-il simplement admettre le score plat ? Non, sur preuve

Validateur canonique (`tools/validate-config-change.js`, copie avec `minScore: 80`, scans du
8 septembre au 12 octobre 2026, clôture certifiée du 12 octobre, 62 titres) :

| Mode | Actuel | minScore 80, 30 jours | Trades | Taux de gain |
|---|---|---|---|---|
| turbo | 0 trade | −3,31 % | 6 | 17 % |
| dynamic | 0 trade | −0,64 % | 2 | 100 % |
| balanced | 0 trade | −3,67 % | 10 | 40 % |

Sur la seule période où le seuil a bloqué, admettre les signaux aurait perdu de l'argent sur turbo
et balanced. La règle « Config Change Backtest » impose de battre la config actuelle sur 30 jours :
le changement est refusé. Les seuils ne bougent pas.

## Ce qui est corrigé

- `tools/gen-status-page.js` : sans position ouverte, la courbe est prolongée à plat jusqu'à la
  clôture certifiée par le sweep (`frozenUpdate.reference_close`), tracée à part (« Liquidités »),
  avec la cause sous le graphique. Affichage seulement : registre scellé, statistiques et API
  inchangés.
- Scan du 13 octobre : le crible A+ du PM Fortress est exécuté pour de bon
  (`scanner/20261013/_final/fortress-step0.json`).

## Décision laissée au propriétaire

turbo, dynamic et balanced dépendent d'un classement que le scanner ne produit plus. Tant qu'une
règle d'admission sans score n'a pas été conçue et validée par backtest, ces trois modes restent
en liquidités. Les options : les mettre officiellement en pause (`set-mode-status.js`), ou leur
donner une règle d'admission propre, à valider avant tout passage en live.
