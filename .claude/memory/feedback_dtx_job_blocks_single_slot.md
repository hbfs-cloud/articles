---
name: dtx-job-blocks-single-slot
description: Un DtxReplay peut rester RUNNING indéfiniment sans que le job_timeout_seconds du serveur l'expire — et comme max_concurrent=1, il bloque tout le moteur pour tous les clients. Annuler avec DtxCancel.
type: feedback
---

Constaté le 2026-09-14. `DtxReplay(portfolio='best', from='2021-01-01', to='2026-09-11')` annonce
`eta_seconds: 20`, puis reste `status:"running"` pendant plus d'une heure. `GetHealth` confirme côté
serveur : `jobs.running: 1`, `capacity_in_use: 1`, **`expired: 0`** — alors que `job_retention`
déclare `job_timeout_seconds: 1800`. Le délai d'expiration ne s'applique donc pas.

**Why:** `max_concurrent: 1`. Un seul travail bloqué occupe l'unique créneau d'exécution du
déploiement : tout `DtxDecide`/`DtxReplay`, de n'importe quel client, y compris la chaîne scanner
du soir, se met en file derrière lui. Un job qu'on abandonne sans l'annuler n'est pas neutre, il
gèle le moteur.

**How to apply:** (1) après ~2× l'ETA annoncée sans progression, considérer le travail comme bloqué ;
(2) `DtxCancel(job_id)` — bon marché, non limité en débit, propriété vérifiée, tue l'enfant moteur
et libère le créneau ; (3) relancer sur une fenêtre plus courte. Après une première exécution,
l'estimation devient `median of the last completed runs` et cesse d'annoncer 20 s. Ne JAMAIS
abandonner un job sans l'annuler. Et vérifier `jobs.running`/`capacity_in_use` dans `GetHealth`
avant de conclure qu'une lenteur vient de sa propre requête. Voir [[scanner-execution-not-certified]].
