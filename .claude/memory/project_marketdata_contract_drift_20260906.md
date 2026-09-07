---
name: marketdata-contract-drift-20260906
description: "Build marketdata 06e115d7 (2026-09-06) durcit les facettes current-only : end_date refusé (échec fermé), facette quote défaillante, absence non convertie en succès vide. Plus un vrai bug de pagination des jobs corrigé dans mcp-client.js. Casse plans/daily-focus.json et tout plan qui bornait ces facettes."
metadata:
  type: project
---

Constaté pendant `/daily 20260907`. Le run du 2026-09-01 passait ; celui du 07/09 échouait sur 4 des
7 appels de la vague focus. Cause : **le serveur a changé entre les deux** (build `06e115d7`,
`build_timestamp 2026-09-06T17:11:39Z`).

## 1. Les facettes *current-only* refusent désormais `end_date` — et échouent fermé

```
financials is current-only; historical start_date/end_date are not supported
because the provider cannot reconstruct a point-in-time snapshot
sec_filings is current-only; historical start_date/end_date are not supported
```

Concerne `financials`, `sec_filings` (et les facettes voisines de `focus_fundamentals` /
`focus_events`). Le serveur **préfère échouer que servir du live en le datant** — comportement correct,
mais il casse tout plan qui appliquait le contrat de date du CLAUDE.md à ces facettes.

**Tension à connaître** : le CLAUDE.md exige de borner `sec_filings`/`financials` par `end_date=D`
(leçons IOVA/INDO, anti-look-ahead). Ce build dit qu'il ne *peut pas* le faire. Conséquence : le
point-in-time sur ces facettes est **indisponible** ; la lecture est *courante*. Acceptable quand la date
éditoriale est aujourd'hui (le daily), **pas** pour une rétrospective ou un backtest — là, il faut refuser
la facette, pas la consommer en croyant qu'elle est datée. Chaque facette porte `temporal_mode` : le lire.

## 2. La facette `quote` est défaillante

Renvoie `completed_without_data: no symbol-identified result row` pour des symboles identifiés — y compris
quand la ligne de données **est présente** dans `data[]` (défaut d'attribution de cellule côté serveur).
Retirée de `plans/daily-focus.json` : de toute façon un cours en direct ne doit jamais gouverner une
variation publiée (les barres certifiées le font).

## 3. Une absence légitime n'est pas convertie en succès vide

`unusual_options` sur un titre sans flux inhabituel renvoie une cellule **en échec**, pas un succès vide
(« handler returned no symbol-identified row; absence was not converted to an empty success »). Un nom
tranquille faisait donc échouer un appel gouvernant. Déplacé en **vague détachée**, ce que le commentaire
de `collect.js` prescrivait déjà : les appels de flux « colorent une sélection sans la gouverner ».

## 4. Vrai bug côté client, corrigé : pagination des jobs

`tools/lib/mcp-client.js` `awaitJob()` sondait `Jobs` **sans `maxsize`**, donc avec le défaut serveur de
70 000 octets. Toute page dépassant ce seuil renvoyait
`Failed to marshal result: paginated response too large: 75404 bytes exceeds maxsize 70000` — une **erreur
au lieu d'une page** — et la boucle signalait `page 2 dans un état inattendu (absent)`. Corrigé : demande
le plafond serveur (262 144) sur **tous** les sondages, la même valeur partout (sinon le découpage
`_chunk_index` diffère d'une page à l'autre). Affectait tout workflow avec un job volumineux, pas seulement
le daily.

## 5. ETF ≠ action : les facettes par nom n'existent pas pour un ETF

Une sélection qui retient des ETF sectoriels casse la vague focus : pas de CIK
(`ticker XLE not found in SEC database`), pas d'initiés, pas de short interest. Réserver la profondeur
focus aux actions ; les ETF se gouvernent depuis les barres du socle, avec calcul local.

## Gate SEC dégradé du jour

`operation_readiness.run_screener_sec_enriched` = `degraded` à cause de **6 Form 4 aux dates
malformées** (`"2026-09-01-05:00"`, agent déclarant 0001477932) → preuve insider incomplète, `retry_at`
au lendemain. Défaut de données amont, non rejouable. Dérogation datée, motivée et enregistrée dans
`plans/daily-20260907-secdegraded.json` (autorisée explicitement par l'utilisateur) ; le gate canonique de
`plans/daily.json` reste inchangé.

Voir [[certification-is-not-truth]], [[prediction-market-read-the-drift-not-the-level]].
