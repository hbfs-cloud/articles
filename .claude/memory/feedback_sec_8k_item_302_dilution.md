---
name: sec-8k-item-302-dilution
description: Une grande capitalisation émet des actions par 8-K Item 3.02, invisible à tout filtre par type de formulaire SEC.
type: feedback
---

Un filtre de dilution qui teste les formes `S-1|S-3|S-3ASR|S-8|424B*|F-*` rate la voie d'émission la
plus directe. L'**8-K Item 3.02 « Unregistered Sales of Equity Securities »** ne porte aucune de ces
formes : c'est là qu'une grande capitalisation loge ses placements privés, ses warrants et ses actions
de contrepartie d'acquisition. L'**Item 3.03** (modification des droits des porteurs) relève du même
traitement.

Cas fondateur, scan du 2026-09-16. QCOM passait une grille par type de formulaire avec `dilution_clear=true`
alors qu'EDGAR portait, **avant la clôture de référence** :

- 8-K du 2026-09-08, accession `0001104659-26-105718`, Item 3.02 : warrant émis à Amazon.com NV Investment
  Holdings pour jusqu'à **25 000 000 actions à 161,26 $** (2,38 % du capital), exercice cashless, échéance
  2036, dont **3 750 000 déjà acquises à l'émission**. Strike **dans la monnaie de 16,5 %** face à la
  clôture de référence de 187,80 $. Le même dépôt annonce une revente enregistrée à venir, non encore
  déposée — donc un dépôt pendant, pas un dossier clos.
- 8-K du 2026-06-24, accession `0001104659-26-077071`, Item 3.02 : jusqu'à **19,2 millions d'actions** aux
  détenteurs de Modular Inc, placement privé 4(a)(2)/Reg D.

**Why:** les deux dépôts étaient **présents dans la charge MCP collectée**. Rien ne manquait à la donnée ;
seul le filtre était aveugle. Deux contradicteurs indépendants du panel adversarial l'ont trouvé, aucun
gate déterministe ne l'aurait vu. C'est la leçon INDO qui revient par une porte que personne ne surveillait,
et elle se serait appliquée à tous les scans, pas à celui-ci seulement.

**How to apply:** toute vérification de dilution lit les **codes d'item des 8-K** en plus des types de
formulaire, et traite 3.02 et 3.03 comme des événements actions à classer depuis le dépôt primaire. Deux
limites à garder en tête sur la source : `sec_filings` du MCP est **tronqué** par rapport à EDGAR (5 dépôts
de forme actions pour T, dont 2 absents de la réponse MCP) et **refuse les bornes de dates**
(`current-only`) — la borne point-in-time `filingDate <= refdate` s'applique donc à la lecture. La réponse
MCP est une découverte, jamais le registre complet : la classification s'établit sur EDGAR.

Voir [[dilution-check]], [[no-hallucination]], [[mcp-hard-stop]].
