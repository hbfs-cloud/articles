---
name: systematic-north-star
description: Cap produit/desk — retail EU peu capitalisé, multi-broker API, DevOps ; max alpha risque maîtrisé → systematic. STOP à la simulation/signaux (scanner/status), PAS de paper/live broker.
metadata:
  type: project
---

# Cap systématique (défini 2026-07-11)

**Profil** : retail peu capitalisé, basé en Europe (accès IBKR/Saxo/T212/Alpaca), super agile,
background IT/DevOps/Dev. Objectif : **max d'alpha avec risque maîtrisé, le plus vite possible**,
en tendant vers le **systematic trading**.

**4 edges structurels à exploiter dans TOUT** :
1. Petit = capacity alpha (small/micro-caps que les fonds ne peuvent pas jouer).
2. Europe = alpha fiscal (PEA/PEA-PME ~0% impôt après 5 ans).
3. Multi-broker API (Alpaca/IBKR/Saxo/T212) = automatisation.
4. DevOps = event-driven 24/7 (earnings/filings/prints macro par webhook).

**⛔ BORNE DE SCOPE (2026-07-11)** : on construit le système jusqu'à ce qu'il soit **viable et sûr**,
mais on **S'ARRÊTE À LA SIMULATION + LES SIGNAUX** (sortie type `scanner/status` : backtest, sweep,
signaux, perf simulée). **PAS de concept paper/live broker** dans ce chantier — l'exécution réelle
n'est PAS demandée. Tout nouveau mode/scanner produit des **signaux + une performance simulée**
affichée dans scanner/status, point.

**Concrétisation attendue** : des choses embarquables dans `scanner/status` + la cmd `/scanner`
(nouveaux modes/scanners, portfolio logic, factor/event-driven) — toujours gated par qa-check +
senior-review + backtest walk-forward, immutable trades, sanity. Voir [[dtx-replay-sanity-guard]],
[[signals-desk-system]].

**⚙️ RÈGLE DE BOUCLE (2026-07-11)** : à CHAQUE itération du loop de build, passer une **validation
adversariale + harness** AVANT tout commit/publish : senior-review (Quant/Trader/Risk/Editor/
AI-Forensics à checks NUMÉRIQUES qui recalculent, pas relisent), 7-lentilles pour le scanner,
qa-check/qa-content 0 ❌, backtest walk-forward pour tout nouveau mode. Un artefact qui échoue le
harness NE passe PAS. Zéro fabrication (MCP hard stop). C'est non négociable à chaque loop.

**Priorités validées** (ordre : articles+specs d'abord, puis concrétisation) :
- Scanner EU small-cap PEA-éligible (comble le trou "EU screener = 0", active edges fiscal+capacity).
- Scanners event-driven (PEAD/filings/gap) — edge DevOps, sim-only.
- Factor scanners low-turnover (momentum/quality/low-vol, PEA-friendly).
- Portfolio barbell (cœur systématique factoriel PEA + satellite tactique) + vol-targeting.
- Boucle systématique unifiée signal→sizing→**simulation**→signaux (stop à la sim).
- Contenu : rubrique « Systématique du dimanche », article fiscalité PEA, capacity alpha.
