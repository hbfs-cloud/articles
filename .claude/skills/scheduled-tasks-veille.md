---
name: scheduled-tasks-veille
description: Discord bot scheduled tasks + tech intelligence reports. Auto-load when user mentions veille tech, tâche planifiée, Discord bot, schedule, claude-discord-bot, or commit/push workflow after publication.
user_invocable: false
---

# Tâches Planifiées

Gérées via le **bot Discord** (`claude-discord-bot`), pas via cron.

| Tâche | Schedule | Commande |
|-------|----------|----------|
| Briefing Daily | Tous les jours 7h | `every day at 07:00 articles analyse daily` |
| Scanner | Lun-Ven 23h | `every weekday at 23:00 articles scan du jour` |
| Rétrospective | Vendredi 23h | `every friday at 23:00 articles rétrospective scanner` |
| Veille Tech | Tous les jours 18h | `every day at 18:00 articles veille tech 18h` |

## "Veille Tech 18h" — Intelligence & Sujets
Rapport de veille stratégique pour rédaction de dailytickers.com. **Pas d'article HTML généré**, rapport Discord uniquement.

1. **Trends du moment** (WebSearch) :
   - Systematic trading & quant finance : nouvelles stratégies, backtests publiés, librairies open-source
   - AI agentic pour finance : agents LLM, copilots trading, tools GenAI en prod
   - Fintech & finance software : releases, levées de fonds, acquisitions
   - Cybersécurité : vulnérabilités critiques, attaques notables, outils défensifs
   - Data science / ML / LLMs : papers arXiv récents, benchmarks, modèles publiés

2. **Veille concurrentielle** (WebSearch) :
   - Blogs quant : QuantConnect, Alpaca, Man Institute, Two Sigma, Alpha Architect, Quantocracy
   - Publications tech-finance : Bloomberg, Refinitiv, Morningstar tech
   - Newsletters & agrégateurs : ML-quant.com, The Gradient, Import AI

3. **Réseaux sociaux & communautés** :
   - Reddit : r/algotrading, r/MachineLearning, r/datascience, r/netsec (top posts semaine)
   - HackerNews : fils "Ask HN" et "Show HN" pertinents
   - GitHub Trending : repos finance/ML/security du jour

4. **Propositions éditoriales** : 5 à 8 sujets d'articles avec :
   - Titre accrocheur
   - Angle différenciant (pourquoi nous, pourquoi maintenant)
   - Tags taxonomie
   - Priorité éditoriale (1 = urgent, 3 = backlog)

Format sortie : sections **gras** Discord, listes concises, aucun HTML.

## Post-tâche : Commit & Push (OBLIGATOIRE)
Après chaque tâche réussie : `add_card.js` → vérifier `git status` → `git add` (fichiers spécifiques) → `git commit` → `git push origin main`.
**Ne PAS push si** : HTML < 10KB, `add_card.js` échoué, génération incomplète.
