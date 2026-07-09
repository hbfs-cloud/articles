# /signals-desk — Chef d'orchestre des signaux (sélection contextuelle + bilan + post Telegram)

Exécute le skill **signals-desk** : lis `.claude/skills/signals-desk.md` et suis-le **EXACTEMENT**, de bout en bout.

Pipeline : preflight MCP → régime **live** → sélection 2-3 familles (matrice contexte→brique : swing/squeeze/earnings/rotation/macro) + **presets testés** (`config/signal-presets.yaml`) → validation niveaux (R/R≥1.5 à une entrée actionnable, earnings ±3j → DROP, dilution → DROP) → **boucle d'amélioration** (`node tools/signals-ledger.js lessons` → pondère la sélection) → **bilan** via le registre (`signals-ledger.js report` + `sweep`) → **HARNESS** senior-review (BLOCK = pas de post) → cohérence Strategist → digest → **post Telegram `alerts`** → **log** (`signals-ledger.js append`).

## Arguments
`$ARGUMENTS`
- vide → run complet + **post** sur `alerts`.
- `ne poste pas` / `dry-run` → tout sauf le post (montrer le résultat).
- contrainte d'univers (ex. `US large caps`, `ajoute crypto`) → l'appliquer à la sélection.

## Garde-fous (non négociables)
- Preflight MCP `GetStatus`/`GetHealth` — down / stale >48h / incohérent → **STOP** + `send_message(to='alerts')`, ne rien poster.
- **Zéro hallucination** : chaque chiffre vient d'un appel MCP de la session.
- **Idées ≠ données desk** : `alerts` est PUBLIC → idées de trade uniquement, JAMAIS positions/equity/P&L/ordres réels.
- Telegram `format:"html"` avec balises `<b>` (jamais markdown `**`).
- **Harness BLOCK ou MCP STOP → NE PAS POSTER.**
