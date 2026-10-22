---
name: feedback_no_stops_during_runs
description: "Pendant /scanner ou /analyse, ne plus s'arrêter pour poser des questions ou faire des points d'étape — appliquer les précédents du propriétaire et avancer jusqu'à la publication"
metadata:
  node_type: memory
  type: feedback
  originSessionId: f5ddd846-facb-4a8d-8bf2-dd77d94e8bd7
  modified: 2026-10-20T09:33:53.210Z
---

Le 20 octobre 2026, pendant le /scanner de la séance du 20 (deux questions déjà posées : reconduction des 8 exclusions, dérogation 4 actions + 2 ETF), l'utilisateur : « il faut avancer et stopper de d'arreter a chaque fois ».

**Why:** chaque question bloque le run alors que les réponses suivent toujours le même précédent (exclusions reconduites, dérogation au plancher en saison de résultats, ligne encore ouverte non republiée) ; la séance ouvre à 15 h 30 Paris.

**How to apply:**
- Quand un blocage a un précédent récent du propriétaire (exclusions de symboles reconduites, dérogation 4 + 2, doublon de ligne ouverte écarté, S-3ASR dans la fenêtre bloquant), appliquer le précédent, le citer dans le fichier dédié et dans le message de commit, sans demander.
- Ne poser une question que pour une décision vraiment nouvelle, sans précédent, et irréversible.
- Pas de points d'étape intermédiaires inutiles ; un seul compte rendu final.
- Voir [[feedback-scanner-publish-by-default]] et [[scanner-unblock-playbook]].

Scan du 20 octobre 2026 (saison des résultats) : 45 des 58 actions vérifiées publiaient avant la fin de la fenêtre d'exclusion ; seconde passe de vérification sur les noms écartés pour leur rang, puis dérogation 4 actions + 2 ETF (HOMB, DIS, PAGP, ACI, IYE, IHF). Pièges : `audit-scanner-universe` ne garde qu'un `_verify` (renommer la première passe en `_verify-pass1`) ; `nextExDividendDate` vide → vérifier les détachements par `QueryData(types='dividends')` quand l'invalidation est à quelques centimes ; une S-3ASR « de plan d'achat direct » (Disney, mars 2025) se lit avant de conclure.

Scan du 21 octobre 2026 : précédent « on publie ce qui passe honnêtement » (24/09) appliqué sans question, dérogation 1 action + 1 ETF (SGRY, BNO) — le plafond de 50 % par famille, avec une seule cassure éligible, n'autorise qu'un suivi de tendance (les ETF comptent comme Momentum). Piège levé par la revue Contrarian : il n'existe AUCUNE règle écrite excluant un fonds de contrats à terme sur un seul actif (« pas un panier ») ; BITO, CPER, PDBC ont déjà été publiés. Seuls levier et inverse sont exclus. Ne pas inventer de motif de rejet produit : suivre le rang de famille. Fenêtre d'exclusion des résultats = dernière séance + 3 jours : elle avance d'un jour par séance (PAGP OK le 20/10, exclue le 21/10).

Scan du 22 octobre 2026 : dérogation 4 actions + 2 ETF (UNH, WMT, TTEK, TJX, XLE, XLV) par précédent, sans question. Deux précédents validés par la revue Contrarian :
- **Détachement de dividende ≥ écart entrée-invalidation = rejet légitime** (ACI : 0,17 $ détaché le 23/10, date d'enregistrement du communiqué 8-K 99.1 = date de détachement en règlement J+1, contre 8 centimes jusqu'à l'invalidation). Ce n'est pas un motif « produit » inventé : la sortie du plan se déclencherait sur un ajustement mécanique. Toujours lire le communiqué de résultats pour la date d'enregistrement ; le calendrier fournisseur (nextExDividendDate) est souvent vide.
- **Fonds quasi jumeau d'une ligne ouverte (XLE/IYE, corrélation 0,998) : garder par rang de famille et l'écrire en clair** (« si vous détenez IYE, ne prenez pas XLE »). anti_duplicate est par symbole ; une règle ρ ≥ 0,95 avec une ligne ouverte reste une décision du propriétaire.
Outillage : chaîne A de scan-parallel tombée sur un 429 RunScreener ponctuel → rejouer la seule chaîne A (mêmes commandes), B/C/D déjà au vert. Plan scanner-final-evidence : 8 actions au plus, 2 par lot SEC.
