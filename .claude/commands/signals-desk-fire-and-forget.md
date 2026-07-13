# /signals-desk-fire-and-forget — Signaux du jour, lean + autonome (mains-libres)

Variant **fire-and-forget** de `/signals-desk` : sort **3-5 bons signaux du jour**, indépendant du reste (PAS de bilan/ledger/sweep/state-aggregation/harness multi-persona), et **auto-poste** sur `alerts`. Pour un run mains-libres (cron/cloud) ou un post rapide. Le **`/signals-desk` complet reste la référence** (bilan + ledger + harness) quand tu veux la version riche.

**Exécuter** : lance le workflow `signals-desk-fire-and-forget` →
`Workflow({ name: "signals-desk-fire-and-forget", args: { dryRun, universe, macroEvents } })`.

## Arguments
`$ARGUMENTS`
- **vide** → run complet **autonome + POST** sur `alerts` (`args:{}`).
- **`dry-run` / `ne poste pas`** → `args:{dryRun:true}` : produit le digest, ne poste PAS (montre le résultat).
- **contrainte d'univers** (ex. `US large caps`, `ajoute crypto`) → `args:{universe:"..."}`.
- **dates macro pré-vérifiées** (optionnel) → `args:{macroEvents:[{name,dateISO,timeET,impact}]}` — sinon l'agent vérifie CPI/FOMC via le MCP `economic_events` (calendrier officiel depuis v115) ou WebSearch en fallback.

## Comportement fire-and-forget (ne reste JAMAIS muet)
- **MCP down / stale** → poste « ⚠️ MCP indisponible, aucun signal » (zéro fabrication) — ne reste pas silencieux.
- **0 setup propre** ou **tout droppé au recalcul R/R** → poste « pas de setup propre aujourd'hui ».
- Sinon → poste les **3-5 signaux** + log léger (`signals-ledger.js append`) + push `main`.

## Garde-fous (conservés du signals-desk)
- Preflight MCP `GetStatus` — down/stale>48h/incohérent → statut posté, rien fabriqué.
- **Zéro hallucination** : chaque chiffre = un appel MCP de la session.
- **R/R_TP1 ≥ 1,5 RECALCULÉ en 2ᵉ passe** (contrôle croisé — attrape un R/R gonflé, cf post-mortem 10/07) ; stop ≥ 1,5×ATR14 ; entrée ≤ 3 % du spot (actionnable) ; earnings ≤ 3 séances → DROP ; dilution → DROP.
- **Date macro VÉRIFIÉE** (MCP `economic_events` officiel, ou WebSearch/BLS fallback) — jamais un jour non vérifié (leçon `macro-date-verify`).
- **Idées ≠ données desk** : `alerts` PUBLIC → idées de trade uniquement, jamais positions/equity/P&L réels. Telegram `format:"html"` `<b>` (jamais `**`).
