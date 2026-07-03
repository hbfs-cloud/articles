---
name: editorial-voice-no-ai
description: Règle #1 de rédaction tout le site — concis, direct, actionnable, JAMAIS "style IA" (lisible enfant 10 ans sur Substack/Telegram)
metadata:
  type: feedback
---

Tout contenu publié (site, Substack, Telegram, notes) : **concis, direct, actionnable, et non détectable comme IA**. Un lecteur ne doit pas pouvoir dire « c'est de l'IA ».

**Bannir les tics IA/marketing** : « Hold one idea… », « Here's the thing », « The bottom line », « That divergence is the whole story », « buckle up », « let's dive in », « it's worth noting », « in a world where », « delve », « tapestry », « game-changer », « navigating the… » (FR : « il est important de noter », « force est de constater »…). Éviter la structure ultra-templatée (contexte→3 points→outlook→conclusion) et les paragraphes trop lisses/homogènes.

**Voix humaine** : point de vue, rythme varié (phrases courtes ET longues, fragments), images concrètes. **Garder les chiffres réels** (niveaux/entries/stops/perfs) = signal de crédibilité + actionnable.

**Registre** : site = institutionnel (FT/Economist + terminal) ; Substack/Telegram = ultra-simple, niveau enfant 10 ans. Concision + anti-IA partout ; seul le niveau de langue change.

**Why:** un lecteur a détecté le post Substack « Rotation on Trial » comme fortement IA (tics, structure figée, style trop homogène). Le user : « je veux pas qu'on puisse voir aussi facilement que c'est de l'IA ».

**Deux couches** (raffinement après 3 rejets lecteur) : (1) anti-tics de style ; (2) **empreinte intellectuelle** — catalyseur PRÉCIS vérifié (`news`), flux institutionnels réels (`unusual_options`/`dark_pool`), asymétrie non-consensuelle (`technicals`), thèse falsifiable. Un texte propre mais sans info « creusée » sonne autant IA que les tics. Le critique : « aucune empreinte intellectuelle identifiable ».

**Couche 3 (méta, 5ᵉ retour lecteur) : NE PAS s'auto-évaluer sur l'AI-ness.** Un LLM est juge et partie ; « 0 tic au linter » ≠ indétectable. Les détecteurs voient le **squelette partagé** (hook→idée unique→langage simple→image→niveaux→2-3 invalidations→closer mémorable) : plusieurs posts qui se ressemblent = tell. Bannir les flourishes de closer (antithèses « X told you nothing, Y told you everything », paires mignonnes, métaphores-punch). **Modèle cible : IA = recherche+notes brutes, humain = voix finale** (ou passe adverse d'un 2ᵉ modèle qui liste ce qui trahit l'IA). Ne jamais présenter son propre texte comme « clean/humain ».

**How to apply:** avant toute publication, suivre la spec canonique **`EDITORIAL_STYLE.md`** (recette MCP + checklist couche 2 ≥4 + couche 3 méta) puis `node tools/check-ai-tells.js <path> [--strict]`. Reproductible par les routines cloud (fichier versionné). Voir [[scanner-editorial-design]].
