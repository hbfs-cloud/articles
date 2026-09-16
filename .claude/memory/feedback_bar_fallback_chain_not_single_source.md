---
name: bar-fallback-chain-not-single-source
description: Le repli par symbole des barres quotidiennes doit essayer PLUSIEURS sources dans l'ordre ; un seul repli tombe avec son fournisseur et abat la chaîne de suivi.
metadata:
  type: feedback
---

`fetchCertifiedDailyBars` ne rejouait un symbole défectueux que sur **tiingo**. Le 2026-09-16 à
20h54 UTC, tiingo était en **cooldown côté serveur** et NU restait bloqué sur une barre yahoo
incohérente (`open 14.01 outside [13.58, 14.00]`) : la chaîne de suivi, de sweep et de cycle de vie
mourait entière pour un symbole dont le trade était déjà expiré.

**webull servait la barre juste** — `o=14.01 h=14.07 l=13.58 c=13.81` — et l'intraday quinze minutes
le confirmait indépendamment : la première bougie de séance (13:30Z) touche exactement 14,07, alors
que yahoo publiait un plus-haut de 14,00. C'est le défaut documenté du 2026-09-15 : **le plus-haut
est calculé sur la séance régulière SANS l'impression d'ouverture**. Un plus-haut tronqué fait
manquer un take-profit, un plus-bas tronqué manque un stop.

`ALT_BAR_SOURCES = ['tiingo', 'webull']` : on essaie dans l'ordre, chaque repli est lui-même
normalisé (une source alternative qui se contredit aussi n'est pas une réparation, on passe à la
suivante), et on n'échoue que si AUCUNE ne rend une série cohérente. Sept séries réparées ce
soir-là : NU, XLE, CLSK, CSGP, MARA, S, VST.

**Why:** un fournisseur secondaire tombe régulièrement (cooldown, 429, maintenance). Faire dépendre
une chaîne publication-critique d'un repli unique, c'est se donner un point de défaillance de plus,
pas un filet.

**How to apply:** ne jamais traiter un repli de données comme binaire. Quand une source alternative
existe, l'ajouter à la liste ordonnée plutôt que de choisir « la » bonne. Et vérifier une barre
suspecte contre l'intraday avant de conclure : c'est la seule preuve indépendante du fournisseur.
Ne JAMAIS traiter un défaut de bornes OHLC par une exclusion de symbole — voir
[[symbol-exclusions-reprove-dont-copy]].
