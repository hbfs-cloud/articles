---
name: refresh-body-stale
description: "Le nightly refresh-analyses met à jour le header mais laisse le corps cassé (prix $0.00, placeholders, EMA copiées, banners TP1-HIT périmés). Gates : qa-content --strict étendu + pre-commit + CI."
metadata:
  type: feedback
---

# Nightly refresh : corps d'article à moitié régénéré

**Incident (audit 2026-07-02)** : 4 des 5 analyses rafraîchies le 2026-07-01 (MTB, EQX,
IOVA, RDDT) publiées avec : prix header $0.00 (+0.00%), double badge Score (88 ET 50),
EMA20 copiée sur EMA200, "See article for details" ×5, Entry Zone $0.00, banners
« TP1-HIT » au présent alors que le prix est repassé sous TP1, short interest donné
3 fois avec 3 valeurs. Récidive du mode d'échec ALT/IOVA/ALLR de juin.

**Why:** Le refresh met à jour les tuiles hero puis échoue/abandonne sur le corps sans
gate de sortie. La règle Content QA Gate existait mais qa-content ne détectait pas ces
classes de bugs, et la routine cloud n'a pas de hook pre-commit (`.git/hooks` non versionné).

**How to apply (routine refresh-analyses — OBLIGATOIRE):**
1. Après CHAQUE analyse rafraîchie : `node tools/qa-content.js analyses/<TICKER>/index.html --strict`
   → exit 1 = NE PAS committer cette page ; restaurer la version d'archive plutôt que publier cassé.
2. Un refresh met à jour header ET corps ensemble : prix/EMAs/SI/DTC/shares via MCP frais,
   banners de statut de trade au passé (« TP1 touché le JJ/MM »), jamais de placeholder.
3. Filets en place : qa-content --strict détecte désormais prix $0.00, Entry $0.00,
   placeholders, badges Score dupliqués, EMA20==EMA200 (FAIL) ; pre-commit local gate les
   articles stagés ; CI `.github/workflows/qa-content.yml` rougit sur tout push fautif.
Lié : [[analyses-factcheck]], [[no-hallucination]], [[mcp-hard-stop]].
