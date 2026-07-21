---
name: editorial-voice-no-ai
description: Règle #1 de rédaction tout le site — concis, direct, actionnable, JAMAIS "style IA" (lisible enfant 10 ans sur Substack/Telegram)
metadata:
  type: feedback
---

Tout contenu publié (site, Substack, Telegram, notes) : **concis, direct, actionnable, non détectable comme IA**. Un lecteur ne doit pas pouvoir dire « c'est de l'IA ». (Règle affinée après plusieurs retours lecteur ayant flagué des posts Substack comme fortement IA.)

**Why:** un tic ou une thèse recyclée casse la crédibilité ; la valeur de DailyTickers = le moteur (rotation/flux/niveaux/invalidations), pas la prose.

## Checklist avant publication

**Couche 1 — bannir les tics IA/marketing :** « Hold one idea… », « Here's the thing », « The bottom line », « That divergence is the whole story », « buckle up », « let's dive in », « it's worth noting », « in a world where », « delve », « tapestry », « game-changer », « navigating the… » (FR : « il est important de noter », « force est de constater »…). Éviter la structure ultra-templatée (contexte→3 points→outlook→conclusion) et les paragraphes trop lisses/homogènes. Bannir les flourishes de closer (antithèses « X told you nothing, Y told you everything », paires mignonnes, métaphores-punch). Pas de définitions réflexes (« a call option is… »).

**Couche 2 — empreinte intellectuelle** (un texte propre mais vide sonne autant IA que les tics) : catalyseur PRÉCIS vérifié (`news`), flux institutionnels réels (`unusual_options`/`dark_pool`), asymétrie non-consensuelle (`technicals`), thèse falsifiable. Garder les chiffres réels (niveaux/entries/stops/perfs) = signal de crédibilité + actionnable.

**Couche 3 — méta : NE PAS s'auto-évaluer sur l'AI-ness.** Un LLM est juge et partie ; « 0 tic au linter » ≠ indétectable. Les détecteurs voient le squelette partagé (hook→idée unique→langage simple→image→niveaux→invalidations→closer) : plusieurs posts qui se ressemblent = tell. Modèle cible : **IA = recherche + notes brutes, humain = voix finale** (ou passe adverse d'un 2ᵉ modèle qui liste ce qui trahit l'IA). Ne jamais présenter son propre texte comme « clean/humain ».

**Couche 4 — densité & non-récurrence :** ne PAS republier une thèse déjà sortie récemment sans apport neuf (approfondir / nouvelles données / contre-argument, ou ne pas publier). Si l'article se résume à ≤3 phrases d'info réelle noyées dans ~380 mots, c'est de l'emballage → couper. Par défaut format **data-forward** (chart + table flux + niveaux suivis), prose minimale.

**Registre :** site = institutionnel (FT/Economist + terminal) ; Substack/Telegram = ultra-simple, niveau enfant 10 ans. Concision + anti-IA partout ; seul le niveau de langue change.

**How to apply:** suivre la spec canonique **`EDITORIAL_STYLE.md`** (recette MCP + checklist), passer `node tools/check-ai-tells.js <path> [--strict]`, et le gate AI-Forensics du harness `senior-review` (détecteur adversarial anti-slop) avant publication. Reproductible par les routines cloud. Voir [[site-and-scanner-design]].
