---
name: telegram-notifications-qa
description: Telegram publication notification QA rules. Auto-load when user runs telegram-publish-notify.js, publish-with-media.sh, mentions Telegram topic, notif, article publication. Per-article-type QA checklists + common errors to avoid.
user_invocable: false
---

# Notification Telegram — Règles QA (CRITIQUE, NE JAMAIS SKIP)

## Principe général
**La notification Telegram est LA vitrine publique de chaque publication. Une notif erronée = mauvaise image.**

Toute notification est obligatoirement en français, concise, actionnable, autosuffisante et reliée au même
snapshot certifié que l'article. Le lien peut compléter le message mais ne doit jamais être nécessaire pour
comprendre le contexte, les faits décisifs, ce qu'il faut faire ou surveiller et l'invalidation. Toute valeur,
niveau ou performance doit correspondre exactement au livrable revu.

## Pipeline correct (dans cet ordre)
1. Générer + indexer + push l'article HTML
2. Lancer le pipeline media : `bash tools/publish-with-media.sh --type TYPE --path PATH`
   - Si timeout video → fallback text automatique
   - **JAMAIS** appeler `telegram-publish-notify.js` sans `--path`
   - **JAMAIS** appeler `telegram-publish-notify.js --help` en production

## QA Checklist par type d'article

### Daily Briefing
- [ ] Titre contient date du jour (ex: « 29 mars 2026 ») — PAS date passée
- [ ] Snapshot marché contient ≥ 4 indices réels avec % variation
- [ ] Lien pointe vers `/daily/YYYYMMDD/` correct
- [ ] Audio ou vidéo joint si dispo — sinon notif text seule (pas de silence)
- [ ] Topic Telegram : 73 (Daily News)

### Weekly Review
- [ ] Titre contient semaine couverte (ex: « Semaine du 24 mars »)
- [ ] Performance 5 jours indices incluse
- [ ] Lien vers `/weekly/YYYYMMDD/`
- [ ] Topic Telegram : 74 (Weekly Review)

### Scanner
- [ ] Top 3 setups avec ticker + score dans notif
- [ ] Régime marché (risk-on/off) mentionné
- [ ] Lien vers `/scanner/YYYYMMDD/`
- [ ] Topic Telegram : 72 (Portfolio Live)
- [ ] Pas de Short Squeeze dans top 3

### Stock Analysis
- [ ] Ticker et nom société en titre
- [ ] Thèse de trade en 1 ligne
- [ ] Lien vers `/analyses/TICKER/`
- [ ] Topic Telegram : 75 (Stock Analysis)

### Series / Learning / Tech
- [ ] Sujet clairement identifiable en titre
- [ ] Lien correct
- [ ] Topic Telegram : 76 (Learning)

## Erreurs qui ne doivent JAMAIS se reproduire
- ❌ Notification en anglais, teaser dépendant du lien ou CTA sans synthèse actionnable
- ❌ Chiffre, niveau ou invalidation qui diverge du snapshot certifié et revu
- ❌ Notif envoyée avec `artPath = ''` → message fallback générique
- ❌ `telegram-publish-notify.js` appelé sans `--path` (maintenant bloqué par guard)
- ❌ Article daté J publié avec contenu de J-1
- ❌ Notification envoyée avant push Git
- ❌ Notification en doublon (deux messages pour même article)

## Commande manuelle re-notification (si notif ratée)
```bash
cd /home/ci/projects/articles
node tools/telegram-publish-notify.js --type daily --path daily/YYYYMMDD/index.html --dry-run
# Vérifier preview, puis sans --dry-run
node tools/telegram-publish-notify.js --type daily --path daily/YYYYMMDD/index.html
```
