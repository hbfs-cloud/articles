# Demande MCP marketdata — compléter le calendrier économique (à l'owner du MCP)

> Le type `economic_events` (et la fonction DSL `is_near_economic_event`) ne couvre pas les grands
> événements macro US (CPI, FOMC, PPI, PCE…). Résultat : les skills de signaux ne peuvent pas vérifier
> une date macro, et le gating de proximité macro du scanner est aveugle à ces événements.

---

## Symptôme (incident 2026-07-13)

Un digest de signaux a annoncé « CPI **lundi** 8h30 » alors que le CPI (données de juin) sort **mardi
14/07/2026 à 8h30 ET** (source BLS). Le skill a asserté une date FAUSSE parce que le MCP ne fournissait
aucune date de CPI à vérifier → hallucination. C'est exactement ce que notre règle « zéro fabrication,
chaque date vérifiée via MCP » doit empêcher — mais elle suppose que le MCP a la donnée.

## Preuve (couverture actuelle insuffisante)

`QueryData(types="economic_events", start_date="2026-07-08", end_date="2026-07-16")` → renvoie **seulement** :
```
2026-07-15  Retail Sales           US  medium
2026-07-16  Initial Jobless Claims US  medium
2026-07-23  Initial Jobless Claims US  medium
2026-07-30  Initial Jobless Claims US  medium
2026-08-06  Initial Jobless Claims US  medium
2026-08-07  Non-Farm Payrolls      US  high
```
→ **Aucun CPI** (réel : mardi 14/07 8h30, high), **aucun FOMC**, **aucun PPI/PCE**, aucun ISM/GDP.
Le feed se limite à Retail Sales + Jobless Claims (hebdo) + NFP. C'est une couverture partielle.

## Demande

1. **Peupler `economic_events` avec le calendrier macro US HIGH-IMPACT complet**, avec date + **heure**
   (ET) + impact correct :
   - **CPI** (mensuel), **PPI**, **PCE** (core PCE), **FOMC / décision de taux** + minutes, **NFP** (déjà),
     **GDP** (advance/2nd/final), **ISM Manufacturing/Services**, **Retail Sales** (déjà), Univ. Michigan
     sentiment, **Jobless Claims** (déjà, hebdo).
   - Source de référence : calendrier BLS / Fed / BEA (ex. bls.gov/schedule).
   **Critère d'acceptation** : `QueryData(economic_events, 2026-07-08→2026-07-16)` liste le **CPI au
   2026-07-14, 08:30 ET, impact=high** (et le FOMC de juillet à sa vraie date).

2. **Champ `time`/heure** sur chaque event (pas seulement la date) — une thèse « demi-taille avant le
   chiffre » a besoin de savoir si c'est avant/après l'ouverture.

3. **`is_near_economic_event(currency, min_priority, within_days)` (DSL)** doit s'appuyer sur ce calendrier
   complété. Aujourd'hui le scanner l'utilise pour DROP/tag un titre proche d'un event macro (règle
   /scanner « economic event proximity ») — avec un feed sans CPI/FOMC, ce garde-fou **ne se déclenche
   jamais** sur les deux events les plus market-moving. **Critère** : `is_near_economic_event('USD', 2, 2)`
   renvoie true à ≤2 jours d'un CPI/FOMC.

4. **Fenêtre bidirectionnelle** : que `QueryData(economic_events, days=N)` puisse renvoyer les events
   passés proches ET à venir (aujourd'hui la fenêtre semble forward-only depuis today — un `days=10`
   n'affiche rien avant J+2).

## Impact côté articles

Dès que le calendrier est complété : (a) les skills signaux (swing-signals, signals-desk,
macro-event-playbook) vérifient la date macro via MCP avant de la publier (plus d'hallucination), et
(b) le gating de proximité macro du `/scanner` redevient effectif sur CPI/FOMC. En attendant, on durcit
les skills pour **vérifier toute date macro (MCP + WebSearch/BLS) et ne JAMAIS asserter un jour non
vérifié**.
