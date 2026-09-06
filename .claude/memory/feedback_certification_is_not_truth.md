---
name: certification-is-not-truth
description: La certification d'un artefact prouve sa provenance, jamais son exactitude — et l'absence d'un événement dans un flux n'est pas une preuve de son absence dans le monde. Registre versionné + gate horizon-risk.
metadata:
  type: feedback
---

# Un artefact certifié peut être faux

Incident du 2026-09-06, scan `20260908` et hebdo `20260907`, tous deux publiés puis rectifiés.

## Ce qui s'est passé

**Le FOMC des 15-16 septembre était dans l'horizon de toutes les lignes publiées, et aucune des
deux pages ne le mentionnait.** Dix séances depuis le mardi 8 s'achèvent le lundi 21, l'entrée
comptée comme première séance. Le flux de calendrier économique ne retournait pas l'événement, et
rien dans le processus ne vérifiait qu'il aurait dû.

**Le même flux datait le PPI d'août au 14 septembre. La BLS le publie le 10.** L'hebdo a bâti
dessus un raisonnement inversé — « le PPI confirmera le CPI de vendredi » — alors qu'il le
*précède* d'une séance.

L'artefact `economic_events.json` était **parfaitement certifié** : empreinte SHA-256, journal de
collecte, provenance complète, gate `validate-content-claims` au vert. Tous les chiffres publiés
étaient liés à un pointeur JSON vérifiable.

## La leçon, en deux phrases

**La certification prouve d'où vient un chiffre. Elle ne dit rien de son exactitude.** Un système
de preuves qui garantit « ce nombre vient bien de ce fichier » est aveugle à un fichier qui se
trompe — et ce genre de système donne une confiance qu'il ne mérite pas si on l'oublie.

**L'absence d'un événement dans un flux n'est pas une preuve de son absence dans le monde.** Pour
tout ce qu'une autorité publie à l'avance, l'interrogation d'un flux ne peut jamais établir qu'il
n'y a rien.

## Le harnais

`data/scheduled-events.json` — registre versionné des événements dont une autorité publie la date
un an d'avance (FOMC, CPI, PPI). Chaque entrée porte sa source, son autorité et sa date de relevé.
Il **fournit** ce que le flux ignore et **corrige** ce qu'il date mal. `coverage_until` fait échouer
le build quand l'horizon le dépasse : mieux vaut un gate qui bloque qu'un registre qu'on croit
complet.

`tools/validate-horizon-risk.js` — gate bloquant, câblé dans `/scanner` et `/weekly` :
l'horizon réel est recalculé au calendrier de marché ; la couverture de collecte doit l'atteindre
ou le trou doit être **déclaré sur la page** ; tout événement programmé de la fenêtre doit être
publié à la date de l'autorité ; une géométrie de niveaux répétée doit être dite ; un stop plus
large que l'objectif doit être expliqué ; un mécanisme retiré ne peut pas redevenir une règle.

`validate-content-claims.js` — seconde classe de provenance, la **référence autoritaire**. Une date
que la Fed publie un an d'avance n'a pas besoin d'une provenance de collecte : elle a besoin d'une
citation. La liste des fichiers admis est close.

## Corollaire trouvé au passage

Le rapport gain/risque proche de 1 des huit lignes n'était pas une lecture du marché : sept
objectifs sur huit étaient posés à 1,50 ATR **par construction**, et le plancher de stop en
pourcentage l'élargissait au-delà de l'objectif sur les titres peu volatils (1,82 ATR sur KO, 2,14
sur PDBC) — produisant un ratio inférieur à 1 précisément sur les instruments les plus calmes.

**Une propriété de la formule ne se présente jamais comme une découverte du marché.** Le gate le
vérifie désormais, et la page le dit. On ne resserre pas les stops pour afficher un meilleur
chiffre : ce serait travestir la mesure au lieu de la corriger.

Voir [[no-hallucination]], [[gap-is-not-earnings-verify-date]], [[mcp-hard-stop]].
