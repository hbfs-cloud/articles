---
name: telegram-court
description: Spec convergée des notifs Telegram (3 feedbacks user le 14/08) — complètes ET lisibles pour un groupe FR d'investisseurs, une ligne par nom avec contexte simple, zéro pavé de liens, zéro soupe de tickers
type: feedback
---

# Notifs Telegram — la spec convergée (3 itérations user, 2026-08-14)

**Audience** : groupe Telegram FRANCOPHONE d'investisseurs retail. Ils scannent, mais veulent
comprendre chaque ligne sans cliquer.

**Le user a rejeté successivement** :
1. Le pavé avec 6 liens (trop gros, ticker clé noyé) ;
2. La version ultra-compressée « tickers séparés par · » (pas assez complète, compliquée à lire).

**Le format VALIDÉ (v3)** :
- Sections courtes en <b>gras</b> avec un titre parlant (« Nos signaux en cours — tous dans le vert »,
  « Ordres à poser — on attend le bon prix », « On évite »).
- **UNE ligne par nom qui compte** : `• TICKER (secteur/nom simple) — le pourquoi en 5-10 mots + le niveau`.
  Ex : « MNDY (monday.com) — 86–89 $, stop 80, objectif 108 : le "pas cher" du logiciel ».
- Français simple (« imprime des actions » plutôt que « dilution »), pas de jargon non traduit.
- Une phrase de clôture qui résume la doctrine. Disclaimer court.
- ZÉRO pavé de liens (1 max si c'est le cœur). Tickers en <b>gras</b>.
- Rien d'important en fin d'énumération compressée — chaque nom clé a SA ligne.
- Complet ≠ long : complet = tous les noms actifs/nouveaux/re-notés couverts, chacun en une ligne.

**How to apply** : ce format vaut pour tous les canaux (analysis, alerts, learning, daily) et doit
être copié dans les prompts des publishers de workflows.
