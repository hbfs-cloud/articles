---
name: feedback_size_threshold_is_not_completeness
description: Un seuil de taille (100 KB weekly) utilisé comme preuve de complétude produit du remplissage, puis une coupe qui supprime des sections obligatoires — compter les sections, pas les octets
metadata:
  type: feedback
---

Le weekly du 20260810 a été bloqué **deux fois de suite par le panel senior pour des raisons opposées**, et
les deux fois la cause racine était le même contrôle : `qa-content.js` mesurait des **octets** comme preuve
de complétude (plancher weekly à 100 KB, « si < 100KB → sections manquantes »).

1. **Premier BLOCK (composite 52)** — pour atteindre les 100 KB avec ~20 faits, l'article a été gonflé à
   **13 391 mots / 40 sections**, dont 5 sections dupliquées. Verdict : slop, violation L4 d'EDITORIAL_STYLE.
2. **Deuxième BLOCK (composite 74)** — la correction a coupé à 4 861 mots… **en supprimant six sections
   obligatoires du template** (crypto, géopolitique, matrice des risques, allocation tactique, leaders
   thématiques, résultats de la semaine). Zéro mention de BTC/ETH sur un rapport dont le mandat couvre la crypto.
3. **FIXED (composite 79)** — les six sections comblées par une **collecte réelle** : 26 sections, 105 KB.
   Le seuil est franchi par la donnée, pas par la prose.

**Pourquoi :** un plancher d'octets est un proxy de troncature, jamais un objectif rédactionnel. Utilisé comme
objectif, il pousse à écrire du vide ; utilisé comme contrainte à respecter en coupant, il pousse à supprimer
du contenu obligatoire. Les deux échecs sont symétriques et viennent du même contrôle mal spécifié.

**Comment l'appliquer :**
- `qa-content.js` compte désormais les `<h2>` (`SECTIONS_MIN` : weekly 12, daily 8, analyse 5) et le plancher
  d'octets a été ramené à un vrai seuil de troncature (weekly 35 KB, daily 25 KB, analyse 10 KB).
- Face à un article trop long, la correction est **« mêmes sections, plus denses »** — jamais « moins de sections ».
  Vérifier la liste obligatoire du template AVANT toute coupe.
- Une section obligatoire sans donnée disponible se **déclare** (la saisonnalité est revenue vide, le bitcoin a
  été rejeté du calcul de corrélation faute d'historique — les deux sont écrits dans l'article). La fabriquer
  serait pire que l'absence.

Voir [[feedback_publier_avant_la_synthese_du_gate]] et [[project_editorial_style_layers]].
