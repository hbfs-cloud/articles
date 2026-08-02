---
name: dilution-check-window
description: Le check anti-dilution ne doit JAMAIS être borné par une fenêtre glissante de 180j — un warrant vit des années et sort de la fenêtre
metadata:
  type: feedback
---

Incident 2026-08-02, analyse AMD, rattrapé par le panel senior **avant** publication.

J'ai interrogé `QueryData(types='sec_filings,flags', days=180)` sur AMD, obtenu zéro S-3 / ATM / PIPE
et zéro flag, et j'ai écrit une carte de risque intitulée **« What is NOT a risk here »** affirmant
« no warrant overhang, no shelf, no dilution risk » — dans le verdict, dans le résumé de risque ET
dans un bullet « Why Buy ». Trois endroits.

**C'était faux sur le fait le plus structurant du dossier.** Le 06/10/2025, AMD a émis à OpenAI un
warrant portant sur **jusqu'à 160 000 000 actions à 0,01 $** (~10% du capital), acquis par tranches
indexées sur des jalons d'achat de GPU **et** sur des objectifs de cours allant jusqu'à 600 $,
exerçable jusqu'au 05/10/2030 (8-K Ex-4.1, accession 0001193125-25-230895).

Ma fenêtre de 180 jours démarrait en février 2026. Elle s'arrêtait **juste après** la plus grosse
émission de titres récente de la société.

Pire : le 8-K du 06/10/2025 **était présent dans mon propre pull** de `sec_filings` (qui remonte
bien au-delà de 180j sur la liste), avec `items: "1.01,3.02,7.01,9.01"` — et **3.02 = Unregistered
Sales of Equity Securities**. Je ne l'ai pas ouvert.

**Why:** un instrument dilutif vit des années. Le borner par une fenêtre temporelle glissante garantit
de le rater dès qu'il vieillit. Et l'erreur ne se voit pas : l'absence de résultat ressemble exactement
à une absence de risque. Ici elle a produit une affirmation confiante et inverse de la vérité, sur le
point le plus important de la structure de capital — publiée en « ce qui n'est PAS un risque ».

**How to apply:**
1. Le check anti-dilution N'EST PAS borné en temps. Ratisser `days=1825` (5 ans) minimum, ou filtrer
   par `form_types` sans borne courte.
2. Ouvrir systématiquement tout 8-K portant **item 3.02** (Unregistered Sales of Equity Securities),
   **1.01** (Material Definitive Agreement) et toute pièce **Ex-4.x** — c'est là que vivent warrants,
   convertibles et accords d'émission.
3. Ajouter une WebSearch dédiée `"<TICKER> warrant convertible dilution shares issued"` SANS borne de
   date, en complément du flux SEC.
4. `flags: all false` et « aucun S-3 dans la fenêtre » ne valent PAS « pas de dilution ». Ne jamais
   écrire une carte « ce qui n'est PAS un risque » sur la base d'une absence de résultat : formuler
   ce qui a été **positivement vérifié**, et sur quelle fenêtre.
5. Corollaire de lecture : un warrant dont l'acquisition dépend du COURS (ici jusqu'à 600 $) dilue
   précisément si la thèse haussière fonctionne. C'est une information d'analyse, pas seulement de
   conformité — elle appartient à la valorisation (capital pleinement dilué), pas aux notes de bas de page.

Voir [[critical-dilution-rule]], [[checklist-de-collecte-mcp]], [[analysis-senior-review-first]].
