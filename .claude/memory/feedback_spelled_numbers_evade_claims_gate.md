---
name: spelled-numbers-evade-claims-gate
description: Écrire un nombre en toutes lettres (« vingt heures trente », « vingt et une séances ») contournait validate-content-claims ; le gate détecte désormais les cardinaux français et accepte un rendu fr_time.
type: feedback
---

`tools/validate-content-claims.js` ne regardait que les chiffres. Le weekly 20260914 faisait passer
TOUS ses horaires de calendrier et sa fenêtre de « vingt et une séances » par ce trou, tout en
affichant « 42 claims vérifiées ». Le commentaire du code désignait la limite comme connue
(docs/BACKLOG.md §9).

**Why:** un contrôle de provenance qui s'évite en changeant l'orthographe d'un nombre ne prouve rien,
et la page la plus consultable (le calendrier) était justement celle qui n'était reliée à aucune
source.

**How to apply:** le gate refuse maintenant les cardinaux français (`un`/`une` et les ordinaux
exclus, sinon le français devient impubliable) — un nombre en lettres doit être lié ou déclaré en
`data-literal`. Un horaire se lie via `render:{format:'fr_time', zone:'Europe/Paris'}` sur un instant
ISO du flux collecté (`_data/economic_events.json` porte `event_time` par événement) : la conversion
de fuseau est exactement là où une saisie manuelle se trompe d'une heure sans que ça se voie.
Tests A12/A13 dans `tools/test-content-claims.js`.
