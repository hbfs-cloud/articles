---
name: dilution-check-fail-closed-eu-issuers
description: dilution_clear=false veut dire « contrôle NON FAIT » — deux lignes européennes ont été publiées dessus alors que la voie AMF existait pour l'une et qu'aucune n'existait pour l'autre
metadata:
  type: feedback
---

Scan `scanner/20260810` : TTE.PA et SHELL.AS publiées avec `dilution_clear: false`, sur une règle
déclarée BLOQUANTE. Le motif écrit dans `_wf/anti-dilution-reprise.json` était :
« Émetteur européen — hors périmètre du registre américain. Non vérifiable par cette voie,
dilution_clear = false par défaut de contrôle. »

Un « non vérifiable » avait donc été transformé en ligne publiée, avec une phrase d'invalidation
en guise de couverture.

## Ce que la vérification a donné, une fois faite

**TTE.PA — le contrôle ÉTAIT possible et il était PRESCRIT.** `_wf/anti-dilution.json` disait déjà
« vérifier à la source (AMF via QueryData types=eu_filings pour les .PA) ».
`QueryData(types=eu_filings, symbols=TTE.PA, days=180)` répond en 700 ms : ISIN FR0000120271,
91 dépôts du 13/02 au 10/08 — 25 déclarations d'acquisition/cession d'actions propres (rachats,
relutifs), 12 relevés du nombre total de droits de vote et d'actions, 3 franchissements de seuil,
les rapports périodiques. **Zéro augmentation de capital, zéro prospectus d'émission d'actions.**
C'était un PASS vérifié, pas un trou.

**SHELL.AS — aucune voie.** Le registre AMF ne sert que les `.PA`. Le registre SEC ne couvre
Shell plc que pour ses programmes de dette : sur 180 jours, un seul dépôt, un avis d'effet
(`EFFECT`) du 2026-06-08 sur un dossier co-enregistré, contenu non instruit ; les 424B5 antérieurs
remontent à 2025-11-03. Rien ne permet d'affirmer qu'aucune action n'a été créée → **ligne retirée
du panier publié** (7 → 6 lignes).

**Why:** `dilution_clear: false` ne signifie pas « risque faible » ni « à surveiller » : il
signifie *le contrôle n'a pas été fait*. Publier dessus, c'est publier un contrôle manquant en le
présentant comme un contrôle passé avec réserve. C'est la leçon INDO, à un étage au-dessus : là
on avait raté un signal, ici on a su qu'on ne savait pas et on a publié quand même.

**How to apply:**
1. **Fail-closed, sans exception** : une ligne éditoriale dont `dilution_clear` vaut `false` ne se
   publie pas. Un panier plus court est un résultat acceptable ; une ligne non contrôlée ne l'est
   pas. Dire « 6 lignes ce soir » plutôt que masquer le trou.
2. **Router le contrôle par place de cotation, pas par défaut sur EDGAR** :
   - `.PA` → `QueryData(types=eu_filings)` (registre AMF Info-Financière) — câblé, gratuit, ~700 ms
   - `.AS` / `.MC` / `.L` / `.BR` → pas de source câblée à ce jour. Tant qu'il n'y en a pas, ces
     places sont **non publiables en éditorial**. Ne pas inventer un contrôle par proxy (le
     dossier SEC d'un émetteur étranger ne couvre en général que sa dette).
   - US → EDGAR EN DIRECT, pas le registre du service seul (il renvoie vide sur des documents qui
     existent : constaté sur BNY, NKLR, IOVA).
3. Avant d'écrire « non vérifiable », **exécuter la voie que le workflow prescrit lui-même**. Ici
   la fiche amont donnait la commande exacte.
4. Le contrôle produit un artefact horodaté avec sa fenêtre et son décompte de dépôts. Une phrase
   de prose n'est pas une preuve.

Voir [[declared-fields-must-be-computed]] — l'autre défaut du même scan, même racine : une
affirmation écrite à la main qui tient lieu de mesure.
