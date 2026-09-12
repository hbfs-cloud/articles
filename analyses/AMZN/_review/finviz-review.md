# AMZN — contrôle du graphique Finviz

Contrôle effectué le 12 septembre 2026 pour la clôture de référence du 11 septembre.

## Rendu et snapshot

- Le renderer conserve Finviz comme source: `finvizChartSrc()` dans `tools/render-analysis.js` cherche `analyses/AMZN/assets/finviz-20260911.png` lorsque `meta.levelsCloseDate` vaut `2026-09-11`; à défaut il utilise l’URL Finviz distante.
- La prévisualisation existante avait été rendue avant ce snapshot et référence donc l’URL distante. Aucun renderer, JSON ou HTML n’a été changé dans ce contrôle. Au prochain rendu depuis le même JSON, le helper sélectionnera l’asset local daté.
- Source téléchargée : `https://charts2.finviz.com/chart.ashx?t=AMZN&ty=c&ta=1&p=d&s=l`
- Asset : `analyses/AMZN/assets/finviz-20260911.png`
- SHA-256 : `de5758aa2f7e74544b11508f29280b61fc5e8ebe12654cf6385f1fdb1b3e4830`
- Format : PNG 466 × 219.

## Inspection visuelle

L’image affiche bien **AMZN**, l’étiquette de séance **Sep 11** et la dernière clôture **256.78**. Le bandeau distingue l’after-hours, **AH: -0.08 (0.03%)**, de la séance régulière; ce mouvement hors séance ne remplace donc pas la clôture du 11 septembre dans les niveaux publiés.

Le graphique montre également +4.89 (+1.94%) pour la séance et les moyennes mobiles affichées (SMA 20: 258.96, SMA 50: 255.25, SMA 200: 239.80). Ces lectures restent une confirmation visuelle du chart Finviz et ne remplacent aucune donnée numérique MCP du dossier.
