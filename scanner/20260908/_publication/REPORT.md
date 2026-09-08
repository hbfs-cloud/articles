# Publication documentaire — scanner du 8 septembre 2026

Produit : revue de surveillance, aucun nouvel ordre certifié. Référence : clôture US du
4 septembre 2026. CEG/COP/XOM sont des dossiers à vérifier, sans prix d'entrée, stop, cible
ou probabilité. La sélection initiale n'est pas réactivée.

Le validateur de panier ordinaire reste en échec sur AMZN (`dilution_evidence`). La publication
utilise le contrat documentaire distinct, sans lever ce blocage. Les validations manquantes
sont conservées dans review.json.

## Vérifications

- Deux vagues de collecte : 11/11 contrôles chacune, pagination reconstituée et provenance conservée.
- Audit indépendant : 105 titres uniques, 24 historiques complets, 81 rejetés, 15 passages numériques.
- Sources documentaires datées et cinq reçus SHA vérifiés indépendamment.
- Article : validation structurelle, 22 contrôles de contenu sans anomalie, contrôle de style strict.
- Navigateur : 1440, 768 et 390 pixels ; pas de débordement, ancres correctes, sommaire accessible.
- Panel : revues contrarian, retail et technique validées.
- Régression : 32 tests réussis, dont 5 tests Chrome à 15:00 UTC avec réseau intercepté ;
  absence de mutations non-DTX et témoins DTX actifs, y compris renouvellement du cache.
- Le validateur documentaire vérifie le rendu exact et les deux manifestes de publication.
- Les manifestes conservent les empreintes avant/après, archives publiques et fichiers protégés.

## Portée opérationnelle

Mise à jour de l'article, de la carte/index, de la bannière du statut et des autorisations
courantes non-DTX des API. Pas de nouvelle collecte, aucun tracking ou recalcul de performance
dans cette publication, aucune notification et aucun ordre de courtage.

Les fichiers signals.json/data.json originaux, positions, historiques et endpoints DTX gardent
leurs contenus. Les dates des API historiques sont conservées ; reviewed_at date uniquement
la revue. Les scripts live non-DTX et les générations normales sont gardés contre une
réactivation des signaux suspendus.
