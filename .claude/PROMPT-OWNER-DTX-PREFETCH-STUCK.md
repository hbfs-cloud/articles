# Demande à l'owner de systematic-tss — le prefetch est bloqué, et le garde-fou ne le voit pas

*(prompt autoportant : à copier tel quel, il ne suppose aucun contexte de la conversation d'origine)*

---

## Le problème en une phrase

`prefetch.running` est resté armé après le SOFTRESET du 2026-08-12, ce qui rend **`DtxRefreshBars`
définitivement inopérant** — et `GetHealth` se déclare frais alors que le moteur a une séance de
retard, parce qu'il mesure sa fraîcheur contre lui-même.

## Ce qui est observé

`GetHealth`, interrogé deux fois à 20 minutes d'écart le 2026-08-12 (20:31 et 21:20 UTC) — réponses
**identiques** :

```json
"last_data_date": "2026-08-11",
"freshness_sessions_behind": 0,
"freshness_threshold_sessions": 2,
"freshness_ok": true,
"prefetch": {
  "running": true,
  "last_trigger": "manual",
  "last_attempt_utc": "2026-08-11T21:58:10Z",   ← figé depuis ~25 h
  "last_success_utc": "2026-08-11T21:57:23Z",
  "ok": 8, "failed": 0, "total": 8
}
```

Pendant ce temps, le service de données de marché avait bien ingéré la séance du **2026-08-12**
(`max_last_bar_date: 2026-08-12`, lag 0, témoins SPY/QQQ/^VIX à jour). Le moteur est donc en retard
d'une séance sur le marché.

Deux appels à **`DtxRefreshBars`**, à 20 minutes d'intervalle :

```json
{"status":"already_running","trigger":"manual"}
{"status":"already_running","trigger":"manual"}
```

Un prefetch « en cours » depuis 25 heures ne tourne pas. Le drapeau bloqué fait refuser tout nouveau
départ, donc **le remède documenté contre les données périmées est lui-même neutralisé, sans que
rien ne le signale**.

## Pourquoi `freshness_ok: true` ne peut pas le voir

`freshness_sessions_behind` se calcule par rapport à `last_data_date` — c'est-à-dire par rapport à
la donnée du serveur lui-même. Un service en retard d'une séance se déclare donc à jour **par
construction**. Le champ répond à « ma donnée est-elle cohérente avec ce que je crois être
aujourd'hui ? », jamais à « ma donnée atteint-elle la clôture que je veux trader ? ».

Ce n'est pas un bug de calcul, c'est un référentiel : le serveur ne peut pas s'auto-attester frais.

## Trois demandes

### 1. Un drapeau `running` qui expire tout seul

Un warm plein-univers dure ~4 min et se décante ~10 min. Au-delà d'un seuil raisonnable (45 min ?),
`running: true` ne décrit plus un travail en cours mais un drapeau resté armé — typiquement après un
redémarrage brutal. Il doit expirer seul, ou être invalidé au démarrage du process.

**Critère d'acceptation** : après un SOFTRESET, `prefetch.running` retombe à `false` sans
intervention, et un `DtxRefreshBars` démarre réellement.

### 2. `DtxRefreshBars` ne doit jamais être un no-op permanent

Aujourd'hui, `already_running` est indiscernable de « bloqué pour toujours ». Deux comportements
acceptables, au choix :

- si le run en cours est plus vieux que le seuil, **le considérer mort et reprendre la main** ;
- ou renvoyer un statut distinct — `{"status":"stuck","running_since":"…","hint":"…"}` — pour que
  l'appelant sache qu'insister ne sert à rien et puisse alerter.

Ce qu'il ne faut pas, c'est la réponse actuelle : rassurante, répétable à l'infini, et fausse.

### 3. Une fraîcheur mesurable contre une référence EXTERNE

`DtxDecide` et `DtxRegime` acceptent déjà `expected_data_date`, et c'est exactement la bonne idée :
l'appelant dit la clôture qu'il vise, le serveur refuse au lieu de servir la veille en silence.

**Ce que je demande** : la même chose sur `GetHealth` — un paramètre optionnel `expected_close`, et
dans la réponse un `behind_expected: true|false` explicite. À défaut, exposer au minimum l'âge de
`last_attempt_utc` (ou un `prefetch.stale: true` calculé côté serveur) pour qu'un client puisse
détecter le blocage sans avoir à le déduire d'un horodatage brut.

**Critère d'acceptation** : `GetHealth(expected_close="2026-08-12")` avec `last_data_date` au
2026-08-11 rend un statut négatif explicite, pas `freshness_ok: true`.

## Ce que nous avons corrigé de notre côté (pour information)

`tools/dtx-health-assert.js` juge désormais sur la clôture **exigée par l'appelant**, pas sur
`freshness_ok`, et détecte le drapeau bloqué. Sur le cas réel de ce soir :

```
❌ [behind_expected_close] le moteur est au 2026-08-11, la clôture exigée est le 2026-08-12 —
   freshness_ok:true ne le voit pas, sessions_behind se calcule contre last_data_date,
   donc contre lui-même
❌ [prefetch_stuck] prefetch.running=true mais last_attempt_utc remonte à 1405 min (> 45 min) —
   le drapeau est resté armé, donc DtxRefreshBars répondra « already_running » et ne démarrera jamais
```

Un moteur injoignable y est traité comme inutilisable, jamais présumé frais. Les modes qui en
dépendent sont écartés bruyamment plutôt que servis sur la séance précédente.

## Conséquence concrète, en attendant

Le mode `best` ne peut recevoir aucun ordre tant que le moteur est au 11/08 : son staging serait
périmé, et le pont le saute (bruyamment, par conception). La production du soir tourne donc sans lui.

## Action immédiate demandée

Débloquer le drapeau sur la VM (redémarrage du service, ou remise à zéro de l'état du prefetch),
puis vérifier que `last_data_date` avance jusqu'au 2026-08-12.

---

### Références

- version servie : commit `9e6d5e8c640a262b442b342d677a1510c85bba73`, dtx-linux-arm64
  sha256 `28a142e6…`, go1.25.0
- contexte : SOFTRESET OCI de la VM le 2026-08-12 (incident du walk plein-univers), cause probable
  du drapeau resté armé
