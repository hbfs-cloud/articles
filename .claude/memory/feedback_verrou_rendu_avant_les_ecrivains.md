---
name: Un verrou rendu avant ses écrivains ne protège rien
description: Le verrou de downstream-split.sh se libérait pendant que gen-status-page et gen-api écrivaient encore — la fenêtre de corruption survivait au verrou censé l'empêcher. Mesuré, corrigé, test de non-régression livré.
type: feedback
---

# Un verrou rendu avant ses écrivains ne protège rien

`tools/downstream-split.sh` verrouille `data/`, `scanner/status/` et `portfolio/v1/`
parce que `/desk` et `/scanner` y écrivent les mêmes fichiers et que deux
`gen-status-page` simultanés corrompent **sans lever d'erreur**. Le verrou existait
depuis le 11/08 mais n'avait jamais été testé : macOS n'a ni `timeout` ni `gtimeout`.

## Ce que le test a trouvé (11/08, mesuré)

L'exclusion mutuelle et l'abandon sur verrou fantôme marchaient. La **libération**
non :

- `trap 'rmdir "$LOCK"' EXIT` ne couvre que la mort du **shell**. Les trois tâches
  lancées en `&` (`gen-api`, `gen-mode-cards`, `daily-synthesis`) ne meurent PAS avec
  lui : un SIGTERM ne vise que le shell. Verrou rendu à **+1,5 s**, `gen-api` écrivait
  encore `data/` et `portfolio/v1` à **+12 s**. Dix secondes pendant lesquelles un
  autre run détient légitimement le verrou et écrit les mêmes fichiers.
- Même défaut sur l'écrivain au **premier plan** : SIGTERM tuait le shell pendant que
  `gen-status-page` tournait encore — verrou rendu à +2 s, le snapshot écrit à +12 s.

La fenêtre de corruption avait donc simplement été déplacée, pas fermée.

## Correctif

- `release()` tue les tâches de fond **et le `node` qu'elles ont lancé** (tuer le seul
  sous-shell laisse `node` orphelin et toujours écrivant) **avant** le `rmdir`.
- `trap 'release; exit 130' INT` / `'release; exit 143' TERM` en plus d'`EXIT`. Un trap
  de signal ne sort pas tout seul : sans le `exit`, le script libérerait le verrou puis
  continuerait d'écrire sans verrou. Effet de bord vertueux — bash diffère un trap
  jusqu'à la fin de la commande au premier plan, donc le `node` en cours finit d'écrire
  avant qu'on rende le verrou.
- Garde d'idempotence : les gestionnaires INT/TERM sortent, ce qui déclenche AUSSI le
  trap EXIT.

## Règles

1. **Un verrou se rend après ses écrivains, jamais avant.** Vérifier la libération ne
   suffit pas : il faut vérifier qu'aucun processus n'écrit encore APRÈS elle.
2. **`trap … EXIT` seul ne couvre pas les enfants.** Tout ce qui est lancé en `&`
   survit au shell.
3. **SIGKILL laisse forcément un verrou fantôme** — aucun processus ne l'intercepte.
   C'est le rôle du délai d'abandon (mesuré : rc=1 après **903 s**, verrou d'autrui
   jamais volé), pas celui du trap.
4. **Tester un verrou ne doit pas écrire ce que le verrou protège.** Le test substitue
   un `node` factice en tête de PATH ; aucun fichier du dépôt n'est touché.
5. **Un test de verrou qui ne sait pas échouer ne prouve rien.** `tools/test-downstream-lock.sh`
   accepte `DS_SCRIPT=` pour être rejoué contre la version d'avant — il échoue bien
   dessus (écrivain survivant sur SIGTERM).

## Piège d'outillage

Un script lancé en `&` depuis un shell **non interactif** a SIGINT/SIGQUIT à `SIG_IGN` :
un test de Ctrl-C sans `set -m` mesure le harnais, pas le script. Deux verdicts
« le verrou fuit sur SIGINT » étaient de purs artefacts de harnais.
