---
name: Scanner date convention
description: Scanner folder date = next trading session, not generation date. After 22h30 use D+1, Friday evening use D+3 (Monday).
type: feedback
---

Scanner dossier YYYYMMDD = prochaine séance de trading, PAS la date de génération.

**Why:** Le scanner tourne le soir (~23h) pour préparer la séance du lendemain. Utiliser la date de génération crée de la confusion (le scan du "18 mars" contient des setups pour le 19 mars).

**How to apply:** Si heure locale ≥ 22h30 : dossier = D+1 (prochain jour ouvrable). Vendredi soir → lundi (D+3, marchés fermés le weekend). Règle ajoutée dans `scanner/CLAUDE.md` et `CLAUDE.md` racine.
