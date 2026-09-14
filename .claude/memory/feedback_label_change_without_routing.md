---
name: label-change-without-routing
description: Changer la stratégie d'un mode dans la config d'affichage ne change pas ce qu'il trade — router le staging par un champ de liaison déclaré, jamais par l'id du mode en dur
type: feedback
---

Quand un mode scanner change de stratégie moteur, l'id du mode et le portefeuille dtx
cessent d'être le même mot. Toute résolution en dur `data/dtx/<modeId>.json` lit alors
l'ANCIEN livre. C'est arrivé le 2026-09-14 : le mode `best` est passé au seul `etf_us`,
la page a été repointée par une table en dur (`DTX_STAGING_MAP`), mais
`tools/dtx-pool-bridge.js` continuait de lire `data/dtx/best.json` — 14 ordres, quatre
poches, datés du 08/09.

**Why:** les gardes de fraîcheur ne voient pas ce défaut. `asof`, `validFrom`,
`engineMode` valident qu'un staging est FRAIS, pas qu'il est LE BON. Un staging `best`
régénéré par une passe `/scanner` aurait passé tous les gates et réarmé les quatre poches
sous un libellé qui n'en annonce qu'une. Deux tables en dur — une pour l'affiché, une
pour le tradé — divergent toujours, et ici la divergence était déjà là.

**How to apply:** déclarer la liaison UNE fois dans `data/modes-config.json`
(`enginePortfolio`), la faire lire par tous les consommateurs (pont ET page), et poser
une ligne de parité qui échoue si l'un revient à une table en dur. Corollaire : quand un
gate de parité rend « tout vert » après un changement d'identité, vérifier d'abord CONTRE
QUOI il compare — `tools/parity-check.js` rendait 21 OK / 0 DRIFT en certifiant
`portfolio_best.yaml`, le livre abandonné. Un vert qui ne mesure rien est pire qu'un
rouge. Voir [[scanner-execution-not-certified]] et [[dtx-job-blocks-single-slot]].
