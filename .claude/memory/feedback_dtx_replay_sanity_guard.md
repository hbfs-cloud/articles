---
name: dtx-replay-sanity-guard
description: Le MCP dtx est sain — les stats aberrantes viennent d'un replay capturé corrompu par la routine ; garde déterministe assertReplaySanity + qa-check bloque la publication.
metadata:
  type: feedback
---

# dtx replay sanity guard (incident etf_eu DD-89,6 %)

**Incident (2026-07-09)** : la routine scanner nocturne a publié des stats dtx aberrantes —
us_highvol 1169tr/DD-63 %, etf_eu 3404tr/DD-89,6 %, stockbox 1470tr/DD-41 %.

**Diagnostic (2026-07-10)** : le **MCP dtx est SAIN**. Interrogé en direct (`DtxReplay` from=2021-01-01
to=2026-07-06, serveur commit 9a680ed), il reproduit les chiffres sains de la répétition 07-08 :
us_highvol 635tr/DD-27,7 %/Sharpe 1,81, etf_eu 1102tr/DD-29,7 %/Sharpe 2,08, stockbox 172tr/DD-24,7 %/Sharpe 1,56.
Les chiffres cassés **ne sont PAS reproductibles côté serveur**. Signature = explosion du nombre de
trades (×2-8) + DD monstrueux + CAGR effondré = **replay capturé corrompu / param-drifté par la routine**,
PAS un bug moteur. `extractReplayMetrics`/`dtx-mcp-ingest` sont des pass-through fidèles → le garbage
atteignait la status page sans contrôle.

**Why** : « le MCP fait foi » ne couvre que le moteur ; la ROUTINE peut capturer un mauvais job result
(job expiré/mauvais job_id, config en cours d'édition au run, param drift). Sans garde, un DD-89 %
part en publication en silence.

**How to apply** : garde DÉTERMINISTE en place (ne dépend jamais que l'agent s'en souvienne) —
- `config/dtx/_sanity-baselines.json` : bornes universelles (`|DD|>50 %`, `sharpe<0`, `win_rate∉[15,92]`,
  `cagr<-5 %`, `total_trades` >2,2× ou <0,4× baseline) + baselines par mode (issues du run sain).
- `assertReplaySanity(portfolioId, metrics)` dans `tools/dtx-scan.js` → warnings.
- `buildStaging` attache `metricsSuspect:true` + `_sanityWarning[…]`.
- `dtx-mcp-ingest.js` **exit 7** + log loud quand suspect → la routine traite comme « ingest KO »
  (alerte Telegram `alerts`, ne publie pas ce mode, re-appelle DtxReplay).
- `tools/qa-check.js` échoue en dur (`dtx: métriques replay saines`) sur tout staging FRAIS suspect →
  bloque `publish-daily-card.sh`.
Nouveau mode dtx : les tripwires universels s'appliquent quand même ; ajouter sa ligne dans
`_sanity-baselines.json` après un premier run sain. Voir [[mcp-hard-stop]] et le durcissement
anti-silent-skip du staging dtx.
