---
name: si-pct-recompute-from-float
description: "Ne jamais publier le shortPercentOfFloat Yahoo tel quel — recomputer sharesShort/floatShares et croiser FINRA (incident PSIX 07/08/2026, 14.2% vs 23.9% réel)"
type: feedback
---

# SI% : recomputer depuis le float, ne pas citer le champ Yahoo

**Incident (07/08/2026, analyse PSIX, rattrapé par le panel senior avant publication)** : le champ
`shortPercentOfFloat` du bundle stats disait 14,17%. Le même payload donnait `sharesShort: 1 755 134`
et `floatShares: 7 335 114` → 1,755M / 7,335M = **23,9%**. L'article a été écrit avec 14,2% dans
7 endroits (meta, badge hero, métrique, verdict, Why Buy, section SI, thèse). Le quant du panel a
recoupé avec le fichier FINRA du 15/07 : 23,9% confirmé. DTC aussi faux (4,0 vs 3,9 FINRA, ADV ~447K).

**Why** : le % pré-calculé du fournisseur utilise un float ou une date différents de ceux du même
payload. Deux champs du même appel peuvent être mutuellement incohérents ; le ratio se recompute,
il ne se cite pas.

**How to apply** :
1. SI% publié = `sharesShort / floatShares` recalculé depuis les champs bruts de LA session.
2. Croiser avec le settlement FINRA daté (bi-mensuel) et DATER le chiffre dans le texte.
3. Si les deux divergent de >2 points, le dire dans l'article plutôt que choisir en silence.
4. DTC : recomputer short interest / ADV médian, jamais le champ pré-calculé seul.
