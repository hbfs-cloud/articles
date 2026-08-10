---
name: feedback-sec-filings-registry-incomplete
description: Le registre sec_filings du service de données est INCOMPLET — l'anti-dilution ne peut jamais reposer dessus seul, le contrôle EDGAR direct de validate-scan fait foi
metadata:
  type: feedback
---

`QueryData(types='sec_filings')` renvoie **VIDE** sur des dépôts qui existent réellement. Constaté le
2026-08-09 en préparant le scan 20260810 :

| Ticker | Requête service | EDGAR direct (validate-scan) |
|--------|-----------------|------------------------------|
| BNY    | 424B2, 40 jours → **0 résultat** | 3 × 424B2 datés du 2026-08-06 (2 jours avant le scan) + 424B2 à 23j et 24j |
| NKLR   | vide            | 3 × 424B3 il y a 34 jours |
| IOVA   | vide            | S-3ASR il y a 52 jours |

Les trois avaient passé l'anti-dilution de Phase 2 sur la seule foi du service. C'est `validate-scan.js`,
qui interroge EDGAR **en direct**, qui les a rattrapés au moment de la publication — après coup.

**Why:** l'anti-dilution est un gate de sécurité (leçon INDO). Un gate qui s'appuie sur une source
silencieusement incomplète ne protège de rien : il rend un « RAS » qui ressemble en tout point à un vrai
RAS. Le mode d'échec est invisible — pas d'erreur, pas de champ `partial`, juste un tableau vide. Trois
lignes sur un scan de sept sont passées à travers.

**How to apply:**
- Ne JAMAIS conclure « aucune dilution » depuis `QueryData(types='sec_filings')` seul. Un retour vide de
  ce service est **non concluant**, pas négatif.
- Le contrôle EDGAR direct de `validate-scan.js` fait foi. Le faire tourner **avant** de figer la
  sélection, pas seulement au gate de publication — sinon on découvre le problème quand tout est écrit.
- Pour toute ligne éditoriale ou de vivier TKL : croiser systématiquement service **et** EDGAR. En cas
  de désaccord, EDGAR gagne.
- Quand la nature d'un dépôt n'a pas pu être vérifiée (un 424B2 sur une banque dépositaire est
  probablement obligataire, mais « probablement » ne suffit pas), porter `dilution_clear: false` et
  écrire la réserve dans les invalidations. Voir [[feedback-gates-certify-green-on-nothing]] : un gate
  qui certifie sur du vide est pire qu'un gate absent.
- Même famille de défaut que [[feedback-bar-cross-contamination-bkng-crwd]] : le service renvoie une
  réponse bien formée et fausse. Toute donnée du service qui alimente un gate a besoin d'une source
  indépendante de recoupement.
