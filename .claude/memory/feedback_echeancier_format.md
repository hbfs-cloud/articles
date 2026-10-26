---
name: echeancier-format-everywhere
description: Échéances et calendrier = échéancier « Ce qui peut bouger la Bourse » dans daily, weekly, analyse, scanner et tout contenu qui parle de dates à venir (décision du propriétaire, 26 octobre 2026)
metadata:
  type: feedback
---

Le 26 octobre 2026, le propriétaire a jugé « excellent » le visuel « Ce qui peut bouger la Bourse » (frise
par semaine, pastilles colorées par famille, plein = impact fort, contour = moyen, fenêtre clé surlignée
avec ses heures, chaînes « si/alors ») et demandé de l'utiliser **partout** : daily, weekly, analyse,
scanner, etc.

**Why:** c'est le format le plus lisible pour décider QUAND agir ; une grille de calendrier ou une liste ne
montre ni la concentration des rendez-vous, ni ce qu'ils transmettent.

**How to apply:**
- Spécification `tools/templates/event-timeline.md` ; rendu `tools/lib/event-timeline.cjs`
  (`renderEventTimeline`) ; styles `evt-tl` de `assets/report.css` ; image pour X
  `tools/render-timeline-png.js` (pas pour Substack, qui est en anglais ; Telegram reste texte).
- Daily et weekly : `requireProof: true`, chaque pastille porte un claim de date ou d'heure ;
  `validate-content-claims.js` vérifie chaque étiquette de jour contre sa date ISO et refuse une pastille
  posée sur un autre jour de Paris que celui de son claim.
- Scanner : automatique dans `tools/render-scanner.js` (fenêtre de détention, entrée → sortie forcée) depuis
  `macro_calendar` ; enrichir chaque ligne de `date_iso`, `short`, `category`, `icon`.
- Analyse : bloc JSON `timeline` (schéma), `source` par événement, exigé dès les fiches du 27 octobre 2026.
- `qa-content.js` bloque un daily, weekly ou scanner daté du 27 octobre 2026 ou après sans échéancier.
- Un rendez-vous sans date sourcée ne va pas sur la frise (lien [[macro-date-verify-before-publish]],
  [[earnings-date-ground-truth-is-8k-item-202]]).
