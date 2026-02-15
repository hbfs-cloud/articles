#!/bin/bash
# Daily Scanner — Exécuté chaque soir à 23h via cron
# Génère l'article scanner du jour avec variantes multilangue/multiniveau
# Puis met à jour index.html et commit/push

set -euo pipefail

PROJECT_DIR="/Users/marketwatchxyz/GolandProjects/articles"
DATE=$(date +%Y%m%d)
LOG_FILE="$PROJECT_DIR/scripts/logs/scanner-${DATE}.log"

# Créer le dossier de logs
mkdir -p "$PROJECT_DIR/scripts/logs"

echo "=== Daily Scanner — $DATE — $(date) ===" | tee "$LOG_FILE"

cd "$PROJECT_DIR"

# Vérifier que le scanner du jour n'existe pas déjà
if [ -d "scanner/$DATE" ]; then
    echo "Scanner $DATE déjà généré. Skip." | tee -a "$LOG_FILE"
    exit 0
fi

# Lancer Claude Code avec le prompt de génération scanner
claude -p "
Génère l'article scanner pour aujourd'hui ($DATE).

Étapes :
1. Utilise RunAutoScreener pour détecter le régime + top candidats
2. Utilise RunScreener avec DSL complémentaires (oversold: rsi14<30, momentum: rsi14>60 && vol>sma(vol,20)*1.5, breakout: close>sma(close,20)*1.02)
3. Utilise QueryData types:quote pour les 10 meilleurs tickers
4. Crée scanner/$DATE/index.html en utilisant scanner/20260215/index.html comme template (thème light, ECharts)
5. Crée scanner/$DATE/assets/report.css (copie de scanner/20260215/assets/report.css)
6. Crée scanner/$DATE/variants.json
7. Met à jour le tab scanner dans index.html (nouvelle carte en premier, ancienne sans badge DERNIER SCAN)
8. Git add, commit 'Add daily scanner $DATE' et push
" 2>&1 | tee -a "$LOG_FILE"

echo "=== Done — $(date) ===" | tee -a "$LOG_FILE"
