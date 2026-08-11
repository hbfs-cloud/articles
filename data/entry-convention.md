# Convention du champ `entry` dans `signals.json`

## Deux ères, une frontière au 2026-07-09

| Ère | Scans | Champs | `entry` vaut |
|---|---|---|---|
| **A** | 20260416 → 20260708 (55 scans) | `entry` seul | **indéterminé** |
| **B** | 20260709 → aujourd'hui (24 scans) | `entry_low` + `entry` | la **borne haute** |

## Pourquoi l'ère A n'est pas attestable, et le restera

Sur LRCX au 2026-06-12, trois sources donnent trois nombres :

- `signals.json` → `entry: 350`
- page publiée → `data-entry="345"`
- prose de la fiche → « Entry on pullback to $350 zone »

Aucune ne fait autorité. Impossible de savoir si `entry` désignait le milieu ou une borne.
Or le chase se mesure **au-dessus de la zone** : sans borne haute fiable, `qa-retro` ne peut
pas trancher entre « rempli » et « chassé ».

**Ces 55 scans ne seront pas corrigés.** Réécrire un enregistrement publié pour se donner
raison a posteriori est précisément ce que la règle d'immuabilité interdit — et un chiffre
rétro-ajusté vaut moins qu'un chiffre absent, parce qu'il a l'air fiable.

`qa-retro` refuse d'attester une rétro portant sur ces scans, sauf convention explicite :

```bash
node tools/qa-retro.js <dossier> --assume-entry=mid|high
```

Le choix est alors **imprimé dans la sortie**. Une convention supposée doit rester visible.

## Ce qui empêche la répétition

Le gate **G0 `entry_zone_unambiguous`** (`validate-scan.js`) refuse tout nouveau scan dont
la zone n'est pas lisible par une machine : il faut `entry_high`, ou `entry_low` avec
`entry > entry_low`. Un scan publié aujourd'hui doit rester notable dans trois mois.
