(function() {
  'use strict';

  var LANG_CODE = (new URLSearchParams(window.location.search).get('lang')) || 'en';
  if (['fr','en','ar','es','zh'].indexOf(LANG_CODE) === -1) LANG_CODE = 'en';

  // ═══════════════════════════════════════
  // UI LABELS (all 5 languages)
  // ═══════════════════════════════════════
  var UI = {
    en: {
      agentIntro: 'Pick a workflow. Get a complete, self-configuring AI agent project.',
      factoryIntro: 'Build smart alerts visually. Download a ready-to-run project.',
      agentBtn: 'Agent', agentBtnSub: 'AI workflows + MCP',
      factoryBtn: 'Alerts', factoryBtnSub: 'Smart alert builder',
      aiTool: 'AI Tool',
      dataSource: 'Data Source',
      srcCustom: 'My Watchlist', srcScanner: 'Scanner A+ Picks', srcAuto: 'Auto-Screener',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      generate: 'Generate Project', download: 'Download ZIP', copy: 'Copy CLAUDE.md',
      step1: 'What to monitor', step2: 'When to alert', step3: 'What to do',
      tickersPh: 'AAPL, TSLA, BTC-USD...',
      includes: 'Project includes', howTo: 'How to use',
      howToStep1: 'Unzip \u2192 <code>cd mcp-server && npm install && cd ..</code>',
      howToStep2Agent: '<strong>Claude Code:</strong> <code>claude</code> (MCP server auto-detected via .mcp.json)',
      howToStep2Factory: '<code>claude</code> (MCP auto-detected)',
      howToStep3Agent: '<strong>Cursor:</strong> Open folder in Cursor (.cursorrules auto-detected)',
      howToStep3Factory: '"Start monitoring my alerts"',
      helpTitle: 'How does this work?',
      helpAgentTitle: 'Agent Mode — AI Workflows',
      helpAgentBody: '<p>Agent mode generates a <strong>complete project folder</strong> that transforms your AI into a specialized financial assistant.</p><h4>What you get:</h4><ul><li><strong>CLAUDE.md</strong> — A detailed instruction file that tells the AI exactly what to do: scan markets, analyze picks, monitor risks, generate alerts</li><li><strong>MCP Server</strong> — A local server that connects your AI to <strong>live Market Watch data</strong> (today\'s A+ picks, market regime, VIX, articles). Updated daily.</li><li><strong>.mcp.json</strong> — Auto-configuration file. Claude Code detects it instantly.</li></ul><h4>What it unlocks:</h4><ul><li>Morning scan: the AI fetches today\'s best setups and briefs you</li><li>Real-time monitoring: price alerts, volume spikes, regime changes</li><li>EOD reports: automated end-of-day P&L review</li><li>Deep analysis: multi-source research on any ticker</li></ul><h4>Compatible tools:</h4><p><strong>Claude Code</strong> (full MCP support), <strong>Cursor</strong> (.cursorrules), <strong>Gemini CLI</strong>, <strong>Codex CLI</strong>, <strong>Windsurf</strong>. For ChatGPT/Gemini web, copy CLAUDE.md as system prompt.</p>',
      helpFactoryTitle: 'Alert Mode — Smart Alert Builder',
      helpFactoryBody: '<p>Alert mode lets you <strong>visually build</strong> a custom alert system. Pick conditions, choose actions, download a ready-to-run project.</p><h4>How it works:</h4><ol><li><strong>Choose data source</strong> — your watchlist, today\'s scanner picks, or auto-screener</li><li><strong>Pick conditions</strong> — RSI oversold, MACD cross, VIX spike, insider buy, earnings proximity...</li><li><strong>Choose actions</strong> — Telegram alert, Discord webhook, full analysis, trade plan, save report</li></ol><h4>The AI will:</h4><ul><li>Monitor your conditions continuously during market hours</li><li>Fetch live data via the included MCP server</li><li>Trigger smart alerts with escalation (info → warning → critical)</li><li>Generate actionable analysis when conditions are met</li></ul><p>Think of it as building a <strong>Bloomberg Terminal alert system</strong> — but powered by AI and free.</p>',
      helpClose: 'Got it'
    },
    fr: {
      agentIntro: 'Choisis un workflow. Obtiens un projet IA complet, auto-configuré.',
      factoryIntro: 'Crée des alertes visuellement. Télécharge un projet prêt à l\'emploi.',
      agentBtn: 'Agent', agentBtnSub: 'Workflows IA + MCP',
      factoryBtn: 'Alertes', factoryBtnSub: 'Créateur d\'alertes',
      aiTool: 'Outil IA',
      dataSource: 'Source de données',
      srcCustom: 'Ma Watchlist', srcScanner: 'Picks A+ Scanner', srcAuto: 'Auto-Screener',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      generate: 'Générer le Projet', download: 'Télécharger ZIP', copy: 'Copier CLAUDE.md',
      step1: 'Quoi surveiller', step2: 'Quand alerter', step3: 'Quoi faire',
      tickersPh: 'AAPL, TSLA, BTC-USD...',
      includes: 'Le projet contient', howTo: 'Comment utiliser',
      howToStep1: 'Décompresse le ZIP \u2192 <code>cd mcp-server && npm install && cd ..</code>',
      howToStep2Agent: '<strong>Claude Code :</strong> <code>claude</code> (le MCP server est auto-détecté via .mcp.json)',
      howToStep2Factory: '<code>claude</code> (MCP auto-détecté)',
      howToStep3Agent: '<strong>Cursor :</strong> Ouvre le dossier dans Cursor (.cursorrules auto-détecté)',
      howToStep3Factory: '"Start monitoring my alerts"',
      helpTitle: 'Comment ça marche ?',
      helpAgentTitle: 'Mode Agent — Workflows IA',
      helpAgentBody: '<p>Le mode Agent génère un <strong>dossier projet complet</strong> qui transforme ton IA en assistant financier spécialisé.</p><h4>Ce que tu obtiens :</h4><ul><li><strong>CLAUDE.md</strong> — Un fichier d\'instructions détaillé qui dit à l\'IA exactement quoi faire : scanner les marchés, analyser les picks, surveiller les risques, générer des alertes</li><li><strong>Serveur MCP</strong> — Un serveur local qui connecte ton IA aux <strong>données live Market Watch</strong> (picks A+ du jour, régime de marché, VIX, articles). Mis à jour quotidiennement.</li><li><strong>.mcp.json</strong> — Fichier d\'auto-configuration. Claude Code le détecte instantanément.</li></ul><h4>Ce que ça débloque :</h4><ul><li>Scan matinal : l\'IA fetch les meilleurs setups du jour et te brief</li><li>Surveillance temps réel : alertes de prix, pics de volume, changements de régime</li><li>Rapports EOD : revue P&L automatique en fin de journée</li><li>Analyse approfondie : recherche multi-source sur n\'importe quel ticker</li></ul><h4>Outils compatibles :</h4><p><strong>Claude Code</strong> (support MCP complet), <strong>Cursor</strong> (.cursorrules), <strong>Gemini CLI</strong>, <strong>Codex CLI</strong>, <strong>Windsurf</strong>. Pour ChatGPT/Gemini web, copie le CLAUDE.md comme prompt système.</p>',
      helpFactoryTitle: 'Mode Alertes — Créateur d\'alertes intelligentes',
      helpFactoryBody: '<p>Le mode Alertes te permet de <strong>construire visuellement</strong> un système d\'alertes personnalisé. Choisis les conditions, les actions, télécharge un projet prêt à l\'emploi.</p><h4>Comment ça fonctionne :</h4><ol><li><strong>Choisis la source</strong> — ta watchlist, les picks A+ du scanner, ou l\'auto-screener</li><li><strong>Sélectionne les conditions</strong> — RSI survendu, croisement MACD, pic VIX, achat insider, proximité earnings...</li><li><strong>Choisis les actions</strong> — Alerte Telegram, webhook Discord, analyse complète, plan de trade, sauvegarde</li></ol><h4>L\'IA va :</h4><ul><li>Surveiller tes conditions en continu pendant les heures de marché</li><li>Fetch les données live via le serveur MCP inclus</li><li>Déclencher des alertes intelligentes avec escalade (info → warning → critique)</li><li>Générer des analyses actionnables quand les conditions sont remplies</li></ul><p>C\'est comme construire un <strong>système d\'alertes Bloomberg Terminal</strong> — mais propulsé par l\'IA et gratuit.</p>',
      helpClose: 'Compris'
    },
    ar: {
      agentIntro: '\u0627\u062e\u062a\u0631 \u0633\u064a\u0631 \u0639\u0645\u0644. \u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0645\u0634\u0631\u0648\u0639 \u0648\u0643\u064a\u0644 \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0643\u0627\u0645\u0644.',
      factoryIntro: '\u0623\u0646\u0634\u0626 \u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0630\u0643\u064a\u0629 \u0628\u0635\u0631\u064a\u0627\u064b. \u062d\u0645\u0651\u0644 \u0645\u0634\u0631\u0648\u0639\u0627\u064b \u062c\u0627\u0647\u0632\u0627\u064b.',
      agentBtn: '\u0648\u0643\u064a\u0644', agentBtnSub: 'MCP + \u0633\u064a\u0631 \u0639\u0645\u0644 \u0627\u0644\u0630\u0643\u0627\u0621',
      factoryBtn: '\u062a\u0646\u0628\u064a\u0647\u0627\u062a', factoryBtnSub: '\u0645\u0646\u0634\u0626 \u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0630\u0643\u064a\u0629',
      dataSource: '\u0645\u0635\u062f\u0631 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a',
      srcCustom: '\u0642\u0627\u0626\u0645\u062a\u064a', srcScanner: 'A+ \u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a', srcAuto: '\u0641\u0631\u0632 \u062a\u0644\u0642\u0627\u0626\u064a',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      generate: '\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0634\u0631\u0648\u0639', download: '\u062a\u062d\u0645\u064a\u0644 ZIP', copy: '\u0646\u0633\u062e CLAUDE.md',
      step1: '\u0645\u0627\u0630\u0627 \u062a\u0631\u0627\u0642\u0628', step2: '\u0645\u062a\u0649 \u062a\u064f\u0646\u0628\u0651\u0647', step3: '\u0645\u0627\u0630\u0627 \u062a\u0641\u0639\u0644',
      tickersPh: 'AAPL, TSLA, BTC-USD...',
      includes: '\u064a\u062a\u0636\u0645\u0651\u0646 \u0627\u0644\u0645\u0634\u0631\u0648\u0639', howTo: '\u0643\u064a\u0641\u064a\u0629 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645',
      howToStep1: 'ZIP \u0641\u0643\u0651 \u0627\u0644\u0636\u063a\u0637 \u2192 <code>cd mcp-server && npm install && cd ..</code>',
      howToStep2Agent: '<strong>Claude Code:</strong> <code>claude</code> (\u064a\u062a\u0645 \u0627\u0643\u062a\u0634\u0627\u0641 MCP \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b)',
      howToStep2Factory: '<code>claude</code> (\u0627\u0643\u062a\u0634\u0627\u0641 MCP \u062a\u0644\u0642\u0627\u0626\u064a)',
      howToStep3Agent: '<strong>Cursor:</strong> \u0627\u0641\u062a\u062d \u0627\u0644\u0645\u062c\u0644\u062f \u0641\u064a Cursor',
      howToStep3Factory: '"Start monitoring my alerts"',
      aiTool: '\u0623\u062f\u0627\u0629 \u0627\u0644\u0630\u0643\u0627\u0621',
      helpTitle: '\u0643\u064a\u0641 \u064a\u0639\u0645\u0644\u061f', helpClose: '\u0641\u0647\u0645\u062a'
    },
    es: {
      agentIntro: 'Elige un flujo de trabajo. Obtén un proyecto de agente IA completo.',
      factoryIntro: 'Crea alertas inteligentes visualmente. Descarga un proyecto listo.',
      agentBtn: 'Agente', agentBtnSub: 'Flujos IA + MCP',
      factoryBtn: 'Alertas', factoryBtnSub: 'Constructor de alertas',
      dataSource: 'Fuente de datos',
      srcCustom: 'Mi Watchlist', srcScanner: 'Picks A+ Scanner', srcAuto: 'Auto-Screener',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      generate: 'Generar Proyecto', download: 'Descargar ZIP', copy: 'Copiar CLAUDE.md',
      step1: 'Qué vigilar', step2: 'Cuándo alertar', step3: 'Qué hacer',
      tickersPh: 'AAPL, TSLA, BTC-USD...',
      includes: 'El proyecto incluye', howTo: 'Cómo usar',
      howToStep1: 'Descomprime el ZIP \u2192 <code>cd mcp-server && npm install && cd ..</code>',
      howToStep2Agent: '<strong>Claude Code:</strong> <code>claude</code> (MCP auto-detectado via .mcp.json)',
      howToStep2Factory: '<code>claude</code> (MCP auto-detectado)',
      howToStep3Agent: '<strong>Cursor:</strong> Abre la carpeta en Cursor (.cursorrules auto-detectado)',
      howToStep3Factory: '"Start monitoring my alerts"',
      aiTool: 'Herramienta IA',
      helpTitle: '¿Cómo funciona?', helpClose: 'Entendido'
    },
    zh: {
      agentIntro: '\u9009\u62e9\u5de5\u4f5c\u6d41\u3002\u83b7\u53d6\u5b8c\u6574\u7684\u81ea\u914d\u7f6e AI \u4ee3\u7406\u9879\u76ee\u3002',
      factoryIntro: '\u53ef\u89c6\u5316\u521b\u5efa\u667a\u80fd\u8b66\u62a5\u3002\u4e0b\u8f7d\u5373\u7528\u9879\u76ee\u3002',
      agentBtn: '\u4ee3\u7406', agentBtnSub: 'AI \u5de5\u4f5c\u6d41 + MCP',
      factoryBtn: '\u8b66\u62a5', factoryBtnSub: '\u667a\u80fd\u8b66\u62a5\u6784\u5efa\u5668',
      dataSource: '\u6570\u636e\u6e90',
      srcCustom: '\u6211\u7684\u5173\u6ce8\u5217\u8868', srcScanner: 'A+ \u7cbe\u9009', srcAuto: '\u81ea\u52a8\u7b5b\u9009',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      generate: '\u751f\u6210\u9879\u76ee', download: '\u4e0b\u8f7d ZIP', copy: '\u590d\u5236 CLAUDE.md',
      step1: '\u76d1\u63a7\u4ec0\u4e48', step2: '\u4f55\u65f6\u8b66\u62a5', step3: '\u6267\u884c\u4ec0\u4e48',
      tickersPh: 'AAPL, TSLA, BTC-USD...',
      includes: '\u9879\u76ee\u5305\u542b', howTo: '\u5982\u4f55\u4f7f\u7528',
      howToStep1: '\u89e3\u538b ZIP \u2192 <code>cd mcp-server && npm install && cd ..</code>',
      howToStep2Agent: '<strong>Claude Code:</strong> <code>claude</code>\uff08\u901a\u8fc7 .mcp.json \u81ea\u52a8\u68c0\u6d4b MCP\uff09',
      howToStep2Factory: '<code>claude</code>\uff08\u81ea\u52a8\u68c0\u6d4b MCP\uff09',
      howToStep3Agent: '<strong>Cursor:</strong> \u5728 Cursor \u4e2d\u6253\u5f00\u6587\u4ef6\u5939\uff08.cursorrules \u81ea\u52a8\u68c0\u6d4b\uff09',
      howToStep3Factory: '"Start monitoring my alerts"',
      aiTool: 'AI \u5de5\u5177',
      helpTitle: '\u8fd9\u662f\u5982\u4f55\u5de5\u4f5c\u7684\uff1f', helpClose: '\u660e\u767d\u4e86'
    }
  };
  var L = UI[LANG_CODE] || UI.en;

  // ═══════════════════════════════════════
  // WORKFLOWS — Agent Mode
  // ═══════════════════════════════════════
  // Workflow i18n helper
  var WF_I18N = {
    'trading-desk': {
      sub: { fr: 'Scan → Analyse → Alertes → Rapport EOD', en: 'Scan → Analyze → Alert → EOD Report', ar: '\u0645\u0633\u062d → \u062a\u062d\u0644\u064a\u0644 → \u062a\u0646\u0628\u064a\u0647 → \u062a\u0642\u0631\u064a\u0631', es: 'Escaneo → Análisis → Alerta → Informe', zh: '\u626b\u63cf → \u5206\u6790 → \u8b66\u62a5 → \u65e5\u62a5' },
      desc: { fr: 'Transforme ton IA en desk de trading complet. Chaque matin, il fetch les picks A+, analyse le marché, surveille tes positions, et génère des alertes en temps réel.', en: 'Turn your AI into a full trading desk. Every morning it fetches A+ picks, analyzes the market, monitors positions, and generates real-time alerts.', ar: '\u062d\u0648\u0651\u0644 \u0630\u0643\u0627\u0621\u0643 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0625\u0644\u0649 \u0645\u0643\u062a\u0628 \u062a\u062f\u0627\u0648\u0644 \u0643\u0627\u0645\u0644. \u0643\u0644 \u0635\u0628\u0627\u062d \u064a\u062c\u0644\u0628 \u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a A+ \u0648\u064a\u062d\u0644\u0644 \u0627\u0644\u0633\u0648\u0642 \u0648\u064a\u0631\u0627\u0642\u0628 \u0645\u0631\u0627\u0643\u0632\u0643.', es: 'Convierte tu IA en un desk de trading completo. Cada mañana obtiene los picks A+, analiza el mercado y genera alertas en tiempo real.', zh: '\u5c06\u4f60\u7684 AI \u53d8\u6210\u5b8c\u6574\u7684\u4ea4\u6613\u53f0\u3002\u6bcf\u5929\u65e9\u4e0a\u83b7\u53d6 A+ \u7cbe\u9009\uff0c\u5206\u6790\u5e02\u573a\uff0c\u76d1\u63a7\u4ed3\u4f4d\uff0c\u5b9e\u65f6\u751f\u6210\u8b66\u62a5\u3002' }
    },
    'scanner-sniper': {
      sub: { fr: 'Deep-dive sur les picks A+ du jour', en: 'Deep-dive today\'s A+ picks', ar: '\u062a\u062d\u0644\u064a\u0644 \u0645\u0639\u0645\u0651\u0642 \u0644\u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a A+ \u0627\u0644\u064a\u0648\u0645', es: 'Análisis profundo de los picks A+ del día', zh: '\u6df1\u5165\u5206\u6790\u4eca\u65e5 A+ \u7cbe\u9009' },
      desc: { fr: 'L\'IA récupère les 10 meilleurs setups du scanner Market Watch, fait une analyse multi-source approfondie de chacun, et génère un plan de trade détaillé.', en: 'The AI fetches today\'s top 10 scanner picks, runs deep multi-source analysis on each, and generates detailed trade plans.', ar: '\u064a\u062c\u0644\u0628 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0623\u0641\u0636\u0644 10 \u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a \u0648\u064a\u062c\u0631\u064a \u062a\u062d\u0644\u064a\u0644\u0627\u064b \u0645\u0639\u0645\u0651\u0642\u0627\u064b \u0644\u0643\u0644 \u0645\u0646\u0647\u0627.', es: 'La IA obtiene los 10 mejores setups del scanner, ejecuta un análisis profundo y genera planes de trading detallados.', zh: 'AI \u83b7\u53d6\u626b\u63cf\u5668\u524d 10 \u4e2a\u7cbe\u9009\uff0c\u5bf9\u6bcf\u4e2a\u8fdb\u884c\u591a\u6e90\u6df1\u5ea6\u5206\u6790\uff0c\u751f\u6210\u8be6\u7ec6\u4ea4\u6613\u8ba1\u5212\u3002' }
    },
    'portfolio-sentinel': {
      sub: { fr: 'Surveillance risques + corrélations', en: 'Risk monitoring + correlations', ar: '\u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u0645\u062e\u0627\u0637\u0631 + \u0627\u0644\u0627\u0631\u062a\u0628\u0627\u0637\u0627\u062a', es: 'Monitoreo de riesgos + correlaciones', zh: '\u98ce\u9669\u76d1\u63a7 + \u76f8\u5173\u6027\u5206\u6790' },
      desc: { fr: 'Surveille ton portefeuille en continu : corrélations, drawdown, concentration sectorielle, Greek exposure. Alerte si un seuil de risque est franchi.', en: 'Continuously monitors your portfolio: correlations, drawdown, sector concentration, Greek exposure. Alerts when risk thresholds are breached.', ar: '\u064a\u0631\u0627\u0642\u0628 \u0645\u062d\u0641\u0638\u062a\u0643 \u0628\u0627\u0633\u062a\u0645\u0631\u0627\u0631: \u0627\u0644\u0627\u0631\u062a\u0628\u0627\u0637\u0627\u062a\u060c \u0627\u0644\u062a\u0631\u0627\u062c\u0639\u060c \u062a\u0631\u0643\u064a\u0632 \u0627\u0644\u0642\u0637\u0627\u0639\u0627\u062a. \u064a\u0646\u0628\u0651\u0647 \u0639\u0646\u062f \u062a\u062c\u0627\u0648\u0632 \u0639\u062a\u0628\u0629 \u0627\u0644\u0645\u062e\u0627\u0637\u0631.', es: 'Monitorea tu portafolio continuamente: correlaciones, drawdown, concentración sectorial. Alerta cuando se superan umbrales de riesgo.', zh: '\u6301\u7eed\u76d1\u63a7\u4f60\u7684\u6295\u8d44\u7ec4\u5408\uff1a\u76f8\u5173\u6027\u3001\u56de\u64a4\u3001\u884c\u4e1a\u96c6\u4e2d\u5ea6\u3001Greeks \u654e\u53e3\u3002\u98ce\u9669\u9608\u503c\u7a81\u7834\u65f6\u8b66\u62a5\u3002' }
    },
    'earnings-analyst': {
      sub: { fr: 'Saison des résultats — pré/post analyse', en: 'Earnings season — pre/post analysis', ar: '\u0645\u0648\u0633\u0645 \u0627\u0644\u0623\u0631\u0628\u0627\u062d — \u062a\u062d\u0644\u064a\u0644 \u0642\u0628\u0644/\u0628\u0639\u062f', es: 'Temporada de resultados — análisis pre/post', zh: '\u8d22\u62a5\u5b63 — \u53d1\u5e03\u524d/\u540e\u5206\u6790' },
      desc: { fr: 'Suit le calendrier des earnings, analyse le consensus vs whisper, pricing des options pré-earnings, et fait l\'analyse beat/miss en post-earnings.', en: 'Tracks the earnings calendar, analyzes consensus vs whisper numbers, pre-earnings options pricing, and runs beat/miss analysis post-earnings.', ar: '\u064a\u062a\u0627\u0628\u0639 \u062a\u0642\u0648\u064a\u0645 \u0627\u0644\u0623\u0631\u0628\u0627\u062d\u060c \u064a\u062d\u0644\u0644 \u0627\u0644\u0625\u062c\u0645\u0627\u0639 \u0645\u0642\u0627\u0628\u0644 \u0627\u0644\u062a\u0648\u0642\u0639\u0627\u062a\u060c \u0648\u064a\u062c\u0631\u064a \u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u062a\u0641\u0648\u0642/\u0627\u0644\u0625\u062e\u0641\u0627\u0642 \u0628\u0639\u062f \u0627\u0644\u0625\u0639\u0644\u0627\u0646.', es: 'Sigue el calendario de resultados, analiza consenso vs whisper, pricing de opciones pre-earnings, y análisis beat/miss post-earnings.', zh: '\u8ddf\u8e2a\u8d22\u62a5\u65e5\u5386\uff0c\u5206\u6790\u5171\u8bc6 vs \u5e02\u573a\u4f20\u95fb\uff0c\u53d1\u5e03\u524d\u671f\u6743\u5b9a\u4ef7\uff0c\u53d1\u5e03\u540e\u8d85\u9884\u671f/\u4e0d\u53ca\u9884\u671f\u5206\u6790\u3002' }
    },
    'news-reactor': {
      sub: { fr: 'Détection de news → analyse d\'impact auto', en: 'Breaking news detection → auto impact analysis', ar: '\u0643\u0634\u0641 \u0627\u0644\u0623\u062e\u0628\u0627\u0631 → \u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u062a\u0623\u062b\u064a\u0631 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b', es: 'Detección de noticias → análisis de impacto auto', zh: '\u7a81\u53d1\u65b0\u95fb\u68c0\u6d4b → \u81ea\u52a8\u5f71\u54cd\u5206\u6790' },
      desc: { fr: 'Surveille les news en continu pour ta watchlist. Classe chaque news (market-moving vs bruit), analyse l\'impact, et génère des alertes actionnables.', en: 'Monitors news continuously for your watchlist. Classifies each story (market-moving vs noise), analyzes impact, and generates actionable alerts.', ar: '\u064a\u0631\u0627\u0642\u0628 \u0627\u0644\u0623\u062e\u0628\u0627\u0631 \u0628\u0627\u0633\u062a\u0645\u0631\u0627\u0631 \u0644\u0642\u0627\u0626\u0645\u062a\u0643. \u064a\u0635\u0646\u0651\u0641 \u0643\u0644 \u062e\u0628\u0631 \u0648\u064a\u062d\u0644\u0644 \u0627\u0644\u062a\u0623\u062b\u064a\u0631 \u0648\u064a\u0648\u0644\u0651\u062f \u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u0646\u0641\u064a\u0630.', es: 'Monitorea noticias continuamente para tu watchlist. Clasifica cada noticia y genera alertas accionables.', zh: '\u6301\u7eed\u76d1\u63a7\u4f60\u5173\u6ce8\u5217\u8868\u7684\u65b0\u95fb\u3002\u5c06\u6bcf\u6761\u65b0\u95fb\u5206\u7c7b\uff08\u5f71\u54cd\u5e02\u573a vs \u566a\u97f3\uff09\uff0c\u5206\u6790\u5f71\u54cd\uff0c\u751f\u6210\u53ef\u64cd\u4f5c\u8b66\u62a5\u3002' }
    },
    'alert-architect': {
      sub: { fr: 'Alertes multi-conditions personnalisées', en: 'Custom multi-condition alerts', ar: '\u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0645\u062a\u0639\u062f\u062f\u0629 \u0627\u0644\u0634\u0631\u0648\u0637 \u0645\u062e\u0635\u0635\u0629', es: 'Alertas personalizadas multi-condición', zh: '\u81ea\u5b9a\u4e49\u591a\u6761\u4ef6\u8b66\u62a5' },
      desc: { fr: 'Définis des règles d\'alerte complexes : "Si RSI < 30 ET VIX > 25 ET insider buy détecté → Telegram + analyse complète". Multi-actifs, multi-timeframe.', en: 'Define complex alert rules: "If RSI < 30 AND VIX > 25 AND insider buy detected → Telegram + full analysis". Multi-asset, multi-timeframe.', ar: '\u062d\u062f\u0651\u062f \u0642\u0648\u0627\u0639\u062f \u062a\u0646\u0628\u064a\u0647 \u0645\u0639\u0642\u062f\u0629: "\u0625\u0630\u0627 RSI < 30 \u0648 VIX > 25 → Telegram + \u062a\u062d\u0644\u064a\u0644 \u0643\u0627\u0645\u0644". \u0645\u062a\u0639\u062f\u062f \u0627\u0644\u0623\u0635\u0648\u0644.', es: 'Define reglas de alerta complejas: "Si RSI < 30 Y VIX > 25 Y insider buy → Telegram + análisis completo". Multi-activo, multi-timeframe.', zh: '\u5b9a\u4e49\u590d\u6742\u8b66\u62a5\u89c4\u5219\uff1a"\u5982\u679c RSI < 30 \u4e14 VIX > 25 \u4e14\u68c0\u6d4b\u5230\u5185\u90e8\u4eba\u4e70\u5165 → Telegram + \u5b8c\u6574\u5206\u6790"\u3002\u591a\u8d44\u4ea7\u3001\u591a\u65f6\u95f4\u6846\u67b6\u3002' }
    }
  };

  function wfText(id, field) { return (WF_I18N[id] && WF_I18N[id][field] && WF_I18N[id][field][LANG_CODE]) || WF_I18N[id][field].en; }

  var WORKFLOWS = [
    { id: 'trading-desk', icon: '🏢', title: 'Trading Desk', sub: wfText('trading-desk','sub'), desc: wfText('trading-desk','desc'), files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'README.md'] },
    { id: 'scanner-sniper', icon: '🎯', title: 'Scanner Sniper', sub: wfText('scanner-sniper','sub'), desc: wfText('scanner-sniper','desc'), files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'README.md'] },
    { id: 'portfolio-sentinel', icon: '📊', title: 'Portfolio Sentinel', sub: wfText('portfolio-sentinel','sub'), desc: wfText('portfolio-sentinel','desc'), files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'portfolio.json', 'README.md'] },
    { id: 'earnings-analyst', icon: '📈', title: 'Earnings Analyst', sub: wfText('earnings-analyst','sub'), desc: wfText('earnings-analyst','desc'), files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'earnings-watchlist.json', 'README.md'] },
    { id: 'news-reactor', icon: '📰', title: 'News Reactor', sub: wfText('news-reactor','sub'), desc: wfText('news-reactor','desc'), files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'README.md'] },
    { id: 'alert-architect', icon: '🔔', title: 'Alert Architect', sub: wfText('alert-architect','sub'), desc: wfText('alert-architect','desc'), files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', 'alerts-config.json', 'README.md'] }
  ];

  // ═══════════════════════════════════════
  // WORKFLOW TEMPLATES (CLAUDE.md generators)
  // ═══════════════════════════════════════
  var AUTO_SCREENER_TEXT = 'Auto: Use RunAutoScreener MCP tool to detect market regime and find the best setups automatically. No manual watchlist needed — the screener adapts to current conditions.';

  function normalizeTickers(tickers) {
    if (tickers === '__AUTO_SCREENER__') return AUTO_SCREENER_TEXT;
    return tickers;
  }

  function tplTradingDesk(tickers) {
    tickers = normalizeTickers(tickers);
    return `# Market Watch — Trading Desk 🏢

## Your Role
You are a premium retail trading desk assistant. You run a systematic daily workflow:
scan → analyze → alert → report. You use Market Watch data as your primary signal source.

## Data Sources

### Market Watch Watchlist (Updated Daily 23:00 UTC)
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`
Contains: market regime, VIX, A+ scanner picks with entry/stop/TP/score/catalyst.

### Real-Time Data (if MarketWatch Gateway MCP available)
- \`GetMarketOverview\` — full market snapshot (indices, crypto, rates, sentiment)
- \`QueryData\` — quotes, technicals, sentiment, news per ticker
- \`GetInstruments\` — deep analysis per symbol

### Supplementary
- WebSearch for breaking news and catalysts
- WebFetch for SEC filings, earnings transcripts

## Watchlist
${tickers || 'Auto: loaded from Market Watch scanner A+ picks'}

## Daily Workflow

### ☀️ Pre-Market (7:00 AM)
1. Fetch \`watchlist.json\` for today's picks
2. Get market overview: futures, VIX, DXY, rates, crypto overnight
3. For each A+ pick:
   - Current price vs planned entry zone (±1%)
   - Is the setup still valid? (not already broken out or stopped)
   - Key catalyst today? (earnings, FDA, macro data)
4. **Output:** Morning Briefing with actionable setups

### 📊 Market Hours
Monitor for these triggers:
- Price enters entry zone (±1% of planned entry)
- Volume spike > 2x 20-day average
- RSI crosses 30 (oversold bounce) or 70 (overbought exit)
- Breaking news on watchlist tickers
- VIX spike > 10% intraday (risk-off signal)

When triggered, send alert (see format below).

### 🌙 Post-Market (4:15 PM)
1. Review all positions vs stops and targets
2. Check after-hours earnings and news
3. Calculate daily P&L per position
4. Status each position: ✅ Hit TP / ❌ Stopped / ⏳ Active
5. Preview tomorrow's catalysts
6. **Output:** EOD Report

## Alert Format
\`\`\`
🎯 SETUP TRIGGERED: $TICKER
━━━━━━━━━━━━━━━━━━━━━━━━
Strategy: $STRATEGY
Entry: $ENTRY | Current: $PRICE
Stop: $STOP (-$RISK%) | TP1: $TP1 (+$GAIN1%)
R/R: $RR | Score: $SCORE/100
━━━━━━━━━━━━━━━━━━━━━━━━
Catalyst: $CATALYST
Sizing: $SIZE% of portfolio
\`\`\`

## Risk Rules
- Max 5% portfolio per position
- Max 3 new entries per day
- If VIX > 35: defensive only (no new longs, consider hedges)
- Stop losses are HARD — never move stops against the trade
- If regime changes to RISK-OFF: reduce exposure 50%, add GLD/TLT hedge

## Anti-Hallucination Rules
1. NEVER invent a price or metric — write "checking..." if unknown
2. Every data point must come from a verifiable source
3. Distinguish between FACTS (data) and OPINIONS (analysis)
4. NEVER guarantee returns
5. Always include risk disclaimer

## How to Start
Say one of these commands:
- "Run the morning scan" — executes pre-market workflow
- "Check my alerts" — scans current conditions
- "EOD report" — generates end-of-day review
- "Analyze [TICKER]" — deep-dive a specific pick
`;
  }

  function tplScannerSniper(tickers) {
    tickers = normalizeTickers(tickers);
    return `# Market Watch — Scanner Sniper 🎯

## Your Role
You are a precision analyst. Your job: fetch today's Market Watch A+ picks and run
an institutional-grade deep analysis on each one. No fluff, no generic takes.

## Data Source
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`
${tickers ? '## Additional Tickers\n' + tickers + '\n' : ''}
## For Each A+ Pick, Analyze:

### 1. Setup Validation
- Is the entry zone still valid? (price vs planned entry)
- Has the pattern broken? (invalidation check)
- Volume confirmation? (above average = confirmed)

### 2. Multi-Source Deep Dive
- **Technicals:** RSI, MACD, EMAs, support/resistance, pattern analysis
- **Fundamentals:** P/E, revenue growth, margins, FCF, debt ratio
- **Sentiment:** social media buzz, analyst consensus, insider activity
- **News:** last 7 days catalyst scan
- **Options:** unusual activity, put/call ratio, max pain (if available)

### 3. Trade Plan
For each validated setup, generate:
\`\`\`
📋 TRADE PLAN: $TICKER
━━━━━━━━━━━━━━━━━━
Setup: $STRATEGY
Entry: $ENTRY (limit order)
Stop: $STOP | Risk: $RISK%
TP1: $TP1 (+$GAIN1%) — take 50% profit
TP2: $TP2 (+$GAIN2%) — trail stop to breakeven
R/R: $RR
Position Size: $SIZE% of portfolio
Confidence: $SCORE/100

✅ Confirmations: [list 3 bullish signals]
❌ Invalidations: [list 3 bearish signals]
⏰ Timing: [catalyst date, optimal entry window]
\`\`\`

### 4. Ranking
Rank all picks by composite score:
| Rank | Ticker | Score | Strategy | R/R | Key Catalyst |
|------|--------|-------|----------|-----|-------------|
| 1    | ...    | ...   | ...      | ... | ...         |

## Output Format
- Start with a 3-line executive summary
- Then individual pick analyses (most promising first)
- End with "Today's Best Setup" highlight

## How to Start
Say: "Analyze today's picks" or "Sniper mode"
`;
  }

  function tplPortfolioSentinel(tickers) {
    tickers = normalizeTickers(tickers);
    return `# Market Watch — Portfolio Sentinel 📊

## Your Role
You are a portfolio risk manager. You monitor a portfolio continuously,
track correlations, detect concentration risks, and alert when thresholds are breached.

## Portfolio
${tickers ? tickers.split(',').map(function(t, i) {
  return '- ' + t.trim() + ': [enter allocation %]';
}).join('\n') : '- Define your holdings below:\n- AAPL: 15%\n- NVDA: 12%\n- BTC-USD: 10%\n- GLD: 8%\n- TLT: 5%\n- (edit this list)'}

## Market Context
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`
Use regime and VIX data for risk assessment.

## Daily Risk Report
Generate each morning:

### 1. Portfolio Dashboard
| Holding | Weight | Day Chg | 5d Chg | vs Stop | Signal |
|---------|--------|---------|--------|---------|--------|
| AAPL    | 15%    | +0.8%   | -1.2%  | OK      | ⏳     |

### 2. Risk Metrics
- **Portfolio Beta** vs S&P 500
- **Concentration:** top 3 holdings = X% (alert if > 50%)
- **Sector Exposure:** tech X%, healthcare Y%, ...
- **Correlation Matrix:** flag highly correlated pairs (ρ > 0.8)
- **Max Drawdown:** current vs max acceptable (-10% default)
- **VaR (95%):** estimated daily value at risk

### 3. Alert Triggers
🔴 CRITICAL: Drawdown > -7% → reduce exposure, hedge with puts
🟡 WARNING: Single position > 20% → rebalance
🟡 WARNING: Sector concentration > 40% → diversify
🟢 INFO: Correlation spike detected → review hedges

### 4. Rebalancing Suggestions
If any threshold breached:
- What to trim
- What to add
- Suggested hedge instruments (SH, GLD, TLT, VXX)

## How to Start
Say: "Portfolio check" or "Risk report"
`;
  }

  function tplEarningsAnalyst(tickers) {
    tickers = normalizeTickers(tickers);
    return `# Market Watch — Earnings Analyst 📈

## Your Role
You are an earnings season specialist. You track the earnings calendar,
run pre-earnings analysis, and generate post-earnings assessments.

## Earnings Watchlist
${tickers || 'Auto: loaded from Market Watch watchlist + your additions'}

## Pre-Earnings Workflow (1-3 days before)
For each ticker reporting:

### 1. Consensus Analysis
- EPS estimate (consensus vs whisper)
- Revenue estimate
- Guidance expectations
- Revision momentum (last 30/60/90 days)

### 2. Historical Pattern
- Last 4 quarters: beat/miss, price reaction
- Average post-earnings move (±%)
- Typical gap direction

### 3. Options Intelligence
- Implied move (straddle pricing)
- Put/call ratio change
- Unusual options activity
- Max pain level

### 4. Pre-Earnings Verdict
\`\`\`
📊 PRE-EARNINGS: $TICKER (reports $DATE $TIME)
━━━━━━━━━━━━━━━━━━━━━━━━━━
EPS Est: $EPS | Whisper: $WHISPER
Revenue Est: $REV
Implied Move: ±$MOVE%
Historical Beat Rate: $BEAT%
Signal: BULLISH / BEARISH / NEUTRAL
Position: [hold / trim / add / hedge]
\`\`\`

## Post-Earnings Workflow (within 1 hour)
### 1. Beat/Miss Assessment
- EPS actual vs estimate vs whisper
- Revenue actual vs estimate
- Guidance: raised / maintained / lowered

### 2. Price Reaction Analysis
- After-hours / pre-market move
- Is the move justified? (overreaction check)
- Key quotes from earnings call

### 3. Action Signal
- HOLD: results in-line, thesis intact
- ADD: beat + raised guidance + pullback = opportunity
- TRIM: miss + lowered guidance = risk
- EXIT: thesis broken

## How to Start
Say: "Earnings preview for this week" or "Post-earnings analysis [TICKER]"
`;
  }

  function tplNewsReactor(tickers) {
    tickers = normalizeTickers(tickers);
    return `# Market Watch — News Reactor 📰

## Your Role
You are a real-time news analyst. You monitor news for your watchlist,
classify each story by impact level, and auto-generate actionable analysis.

## Watchlist
${tickers || 'Auto: loaded from Market Watch scanner picks'}

## News Classification System

### 🔴 Level 1 — Market-Moving (immediate action)
- Earnings surprise > ±10%
- FDA approval/rejection
- M&A announcement
- Major contract win/loss
- Regulatory action (SEC, DOJ)
- Geopolitical shock (sanctions, military)
→ **Action:** Full impact analysis + alert + trade suggestion

### 🟡 Level 2 — Notable (monitor)
- Analyst upgrade/downgrade
- Insider buy/sell
- Product launch
- Partnership announcement
- Sector-wide news
→ **Action:** Quick summary + thesis impact check

### ⚪ Level 3 — Noise (log only)
- Routine filings
- Minor personnel changes
- Restatements of known info
→ **Action:** Log, no alert

## Alert Format
\`\`\`
📰 NEWS ALERT [$LEVEL]
━━━━━━━━━━━━━━━━━━
Ticker: $TICKER | Time: $TIME
Headline: $HEADLINE
Source: $SOURCE

Impact: $IMPACT_SUMMARY
Price Before: $PRICE | Expected Move: ±$MOVE%
Thesis Impact: STRENGTHENS / NEUTRAL / WEAKENS
Action: $RECOMMENDED_ACTION
\`\`\`

## Scanning Rules
- Check news every 15 minutes during market hours
- Pre-market (7-9:30 AM): check every 5 minutes
- After-hours: check hourly
- Weekend: check 2x daily for geopolitical events

## How to Start
Say: "Scan for news" or "What's happening with my watchlist?"
`;
  }

  function tplAlertArchitect(tickers) {
    tickers = normalizeTickers(tickers);
    return `# Market Watch — Alert Architect 🔔

## Your Role
You are an alert system manager. You monitor multiple conditions across
multiple assets and trigger smart alerts with escalation logic.

## Monitored Assets
${tickers || 'Auto: loaded from Market Watch scanner picks'}

## Alert Rules

### Rule 1: Oversold Entry
**IF:** RSI(14) < 30 AND Price near support (within 2%)
**AND:** VIX < 30 (not crisis mode)
**THEN:** Send entry alert with trade plan
**Priority:** 🟡 Medium

### Rule 2: Momentum Breakout
**IF:** Price crosses above EMA(200) AND Volume > 2x 20d average
**AND:** MACD histogram turning positive
**THEN:** Send breakout alert + generate full analysis
**Priority:** 🔴 High

### Rule 3: Risk-Off Warning
**IF:** VIX > 25 AND DXY rising AND 10Y yields spiking
**OR:** Portfolio drawdown > -3%
**THEN:** Send urgent risk alert + suggest hedges
**Priority:** 🔴 Critical

### Rule 4: Earnings Proximity
**IF:** Ticker has earnings within 3 trading days
**THEN:** Send pre-earnings briefing
**Priority:** 🟡 Medium

### Rule 5: Insider Signal
**IF:** Insider buy detected > $100K in last 7 days
**THEN:** Send insider alert + company analysis
**Priority:** 🟢 Info

### Rule 6: Regime Change
**IF:** Market regime changes (Risk-On ↔ Risk-Off)
**THEN:** Full portfolio review + rebalancing suggestions
**Priority:** 🔴 Critical

## Escalation Logic
1. 🟢 Info → Log + daily summary
2. 🟡 Medium → Immediate alert + quick analysis
3. 🔴 High → Immediate alert + full analysis + trade plan
4. 🔴 Critical → Immediate alert + portfolio review + action items

## Data Sources
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`

## How to Start
Say: "Start monitoring" or "Check alert conditions"
`;
  }

  var TEMPLATE_MAP = {
    'trading-desk': tplTradingDesk,
    'scanner-sniper': tplScannerSniper,
    'portfolio-sentinel': tplPortfolioSentinel,
    'earnings-analyst': tplEarningsAnalyst,
    'news-reactor': tplNewsReactor,
    'alert-architect': tplAlertArchitect
  };

  // ═══════════════════════════════════════
  // MCP SERVER FILES (embedded for ZIP)
  // ═══════════════════════════════════════
  var MCP_SERVER_INDEX = [
    '#!/usr/bin/env node',
    '',
    '/**',
    ' * Market Watch MCP Server',
    ' * Exposes live Market Watch data to AI agents (Claude Code, Cursor, etc.)',
    ' * Data is fetched from articles.market-watch.xyz static JSON endpoints.',
    ' */',
    '',
    "import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';",
    "import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';",
    "import { z } from 'zod';",
    '',
    "const BASE_URL = 'https://articles.market-watch.xyz';",
    'const DATA_URL = `${BASE_URL}/data`;',
    'const MCP_URL = `${BASE_URL}/mcp`;',
    '',
    'async function fetchJSON(url) {',
    '  const res = await fetch(url);',
    '  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);',
    '  return res.json();',
    '}',
    '',
    'async function fetchWatchlist() {',
    '  return fetchJSON(`${MCP_URL}/watchlist.json`);',
    '}',
    '',
    'async function fetchTabData(tab) {',
    '  return fetchJSON(`${DATA_URL}/${tab}.json`);',
    '}',
    '',
    'function extractCardInfo(html) {',
    '  const titleMatch = html.match(/<h2[^>]*>(.*?)<\\/h2>/s);',
    '  const descMatch = html.match(/<p[^>]*>(.*?)<\\/p>/s);',
    '  const hrefMatch = html.match(/href="([^"]+)"/);',
    '  const dateMatch = html.match(/report-card-meta[^>]*>([^<]+)/);',
    '  const tagsMatch = html.match(/data-tags="([^"]*)"/);',
    '  return {',
    "    title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '',",
    "    description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '',",
    "    href: hrefMatch ? hrefMatch[1] : '',",
    "    date: dateMatch ? dateMatch[1].trim() : '',",
    "    tags: tagsMatch ? tagsMatch[1] : ''",
    '  };',
    '}',
    '',
    "const server = new McpServer({ name: 'market-watch', version: '1.0.0' });",
    '',
    "server.tool('get_watchlist', \"Get today's A+ scanner picks with entry/stop/TP levels, market regime, and alerts.\", {}, async () => {",
    '  const data = await fetchWatchlist();',
    "  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };",
    '});',
    '',
    "server.tool('get_market_regime', 'Get current market regime (Risk-On/Risk-Off), VIX, DXY, S&P 500, fear/greed.', {}, async () => {",
    '  const data = await fetchWatchlist();',
    "  return { content: [{ type: 'text', text: JSON.stringify({ regime: data.regime, vix: data.vix, dxy: data.dxy, us10y: data.us10y, spx: data.spx, fear_greed: data.fear_greed, alerts: data.alerts, updated: data.updated }, null, 2) }] };",
    '});',
    '',
    "server.tool('get_pick_detail', 'Get detailed info on a specific scanner pick by ticker.', { ticker: z.string().describe('Ticker symbol (e.g. AAPL, GLD)') }, async ({ ticker }) => {",
    '  const data = await fetchWatchlist();',
    '  const pick = data.picks.find(p => p.ticker.toUpperCase() === ticker.toUpperCase());',
    '  if (!pick) return { content: [{ type: \'text\', text: `Ticker ${ticker} not found. Available: ${data.picks.map(p => p.ticker).join(\', \')}` }] };',
    "  return { content: [{ type: 'text', text: JSON.stringify({ ...pick, regime: data.regime, updated: data.updated }, null, 2) }] };",
    '});',
    '',
    "server.tool('search_articles', 'Search Market Watch articles by ticker or keyword.', { query: z.string(), tab: z.string().optional() }, async ({ query, tab }) => {",
    "  const tabs = tab ? [tab] : ['analyses', 'daily', 'weekly', 'scanner', 'tech', 'series'];",
    '  const results = [];',
    '  const q = query.toLowerCase();',
    '  for (const t of tabs) {',
    '    try {',
    '      const cards = await fetchTabData(t);',
    '      for (const html of cards) {',
    '        if (html.toLowerCase().includes(q)) results.push({ tab: t, ...extractCardInfo(html) });',
    '      }',
    '    } catch (e) {}',
    '  }',
    '  return { content: [{ type: \'text\', text: results.length > 0 ? JSON.stringify(results.slice(0, 20), null, 2) : `No articles found for "${query}"` }] };',
    '});',
    '',
    "server.tool('get_article_list', 'List latest articles by type.', { tab: z.enum(['daily', 'weekly', 'analyses', 'scanner', 'tech', 'series']), limit: z.number().optional() }, async ({ tab, limit }) => {",
    '  const cards = await fetchTabData(tab);',
    '  const articles = cards.slice(0, limit || 10).map(html => extractCardInfo(html));',
    "  return { content: [{ type: 'text', text: JSON.stringify({ tab, count: cards.length, showing: articles.length, articles }, null, 2) }] };",
    '});',
    '',
    "server.resource('watchlist', 'marketwatch://watchlist', { description: 'Current A+ picks watchlist', mimeType: 'application/json' }, async () => {",
    '  const data = await fetchWatchlist();',
    "  return { contents: [{ uri: 'marketwatch://watchlist', mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };",
    '});',
    '',
    "server.resource('articles-{tab}', new ResourceTemplate('marketwatch://articles/{tab}', { list: undefined }), { description: 'Articles by tab', mimeType: 'application/json' }, async (uri, { tab }) => {",
    '  const cards = await fetchTabData(tab);',
    '  const articles = cards.slice(0, 20).map(html => extractCardInfo(html));',
    "  return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ tab, count: cards.length, articles }, null, 2) }] };",
    '});',
    '',
    'const transport = new StdioServerTransport();',
    'await server.connect(transport);'
  ].join('\n');

  var MCP_SERVER_PKG = JSON.stringify({
    name: "market-watch-mcp",
    version: "1.0.0",
    description: "Market Watch MCP Server — Live scanner picks & articles for AI agents",
    type: "module",
    main: "index.js",
    bin: { "mw-mcp": "./index.js" },
    scripts: { start: "node index.js" },
    dependencies: { "@modelcontextprotocol/sdk": "^1.27.1" }
  }, null, 2);

  var MCP_DOT_JSON = function(serverPath) {
    return JSON.stringify({
      mcpServers: {
        "market-watch": {
          command: "node",
          args: [serverPath]
        }
      }
    }, null, 2);
  };

  // ═══════════════════════════════════════
  // README TEMPLATE
  // ═══════════════════════════════════════
  function generateReadme(workflow, tickers) {
    var wf = WORKFLOWS.find(function(w) { return w.id === workflow; });
    return `# ${wf.icon} ${wf.title} — Market Watch AI Agent

${wf.desc}

## Quick Start (3 steps)

\`\`\`bash
# 1. Install the MCP server (one time only)
cd mcp-server && npm install && cd ..

# 2. Launch Claude Code
claude

# 3. Say one of these:
#    "Run the morning scan"
#    "Analyze today's picks"
#    "Start monitoring"
\`\`\`

That's it. Claude Code auto-detects \`.mcp.json\` and loads the Market Watch MCP server.
The server fetches **live data** from articles.market-watch.xyz (updated daily at 23:00 UTC).

## What's Inside

| File | Purpose |
|------|---------|
| \`CLAUDE.md\` | AI agent configuration (the brain) |
| \`.cursorrules\` | Same config, auto-detected by Cursor |
| \`.mcp.json\` | MCP server config for Claude Code |
| \`mcp-server/index.js\` | The MCP server (fetches live data) |
| \`mcp-server/package.json\` | Server dependencies |
| \`README.md\` | This file |
${workflow === 'portfolio-sentinel' ? '| `portfolio.json` | Your portfolio holdings (edit this) |\n' : ''}${workflow === 'earnings-analyst' ? '| `earnings-watchlist.json` | Tickers to track for earnings |\n' : ''}${workflow === 'alert-architect' ? '| `alerts-config.json` | Alert rules configuration |\n' : ''}
## MCP Server — Available Tools

| Tool | Description |
|------|-------------|
| \`get_watchlist\` | Today's A+ scanner picks with entry/stop/TP |
| \`get_market_regime\` | Current regime, VIX, DXY, fear/greed |
| \`get_pick_detail\` | Deep info on a specific pick by ticker |
| \`search_articles\` | Search 250+ published analyses |
| \`get_article_list\` | List latest articles by type |

## Alternative Setup (Cursor, ChatGPT, Gemini)

### Cursor
1. Open this folder in Cursor → \`.cursorrules\` is auto-detected
2. Ask: "Run the workflow"

### ChatGPT / Gemini / Other
1. Copy the contents of \`CLAUDE.md\`
2. Paste as system prompt
3. The AI will fetch data from \`https://articles.market-watch.xyz/mcp/watchlist.json\`

## Powered by Market Watch
https://articles.market-watch.xyz

---
*This is not financial advice. Always do your own research.*
`;
  }

  // ═══════════════════════════════════════
  // ZIP GENERATION (using JSZip-like approach with Blob)
  // ═══════════════════════════════════════
  function generateZip(workflow, tickers, aiTool) {
    var wf = WORKFLOWS.find(function(w) { return w.id === workflow; });
    var claudeMd = TEMPLATE_MAP[workflow](tickers);
    var readme = generateReadme(workflow, tickers);
    aiTool = aiTool || 'claude-code';

    var files = [
      { name: 'CLAUDE.md', content: claudeMd },
      { name: '.mcp.json', content: MCP_DOT_JSON('./mcp-server/index.js') },
      { name: 'mcp-server/index.js', content: MCP_SERVER_INDEX },
      { name: 'mcp-server/package.json', content: MCP_SERVER_PKG },
      { name: 'README.md', content: readme }
    ];

    // Add tool-specific config files
    if (aiTool === 'cursor' || aiTool === 'claude-code') {
      files.push({ name: '.cursorrules', content: claudeMd });
    }
    if (aiTool === 'windsurf') {
      files.push({ name: '.windsurfrules', content: claudeMd });
    }
    if (aiTool === 'gemini-cli') {
      files.push({ name: 'GEMINI.md', content: claudeMd });
    }
    if (aiTool === 'codex') {
      files.push({ name: 'AGENTS.md', content: claudeMd });
    }

    if (workflow === 'portfolio-sentinel') {
      files.push({
        name: 'portfolio.json',
        content: JSON.stringify({
          holdings: (tickers || 'AAPL,NVDA,BTC-USD,GLD,TLT').split(',').map(function(t, i) {
            return { ticker: t.trim(), weight: Math.round(100 / ((tickers || 'AAPL,NVDA,BTC-USD,GLD,TLT').split(',').length)), notes: '' };
          }),
          risk_tolerance: 'moderate',
          max_drawdown_pct: -10,
          rebalance_threshold_pct: 5
        }, null, 2)
      });
    }

    if (workflow === 'earnings-analyst') {
      files.push({
        name: 'earnings-watchlist.json',
        content: JSON.stringify({
          tickers: (tickers || 'AAPL,NVDA,AVGO,COST').split(',').map(function(t) { return t.trim(); }),
          auto_include_scanner: true,
          lookback_quarters: 4,
          alert_days_before: 3
        }, null, 2)
      });
    }

    if (workflow === 'alert-architect') {
      files.push({
        name: 'alerts-config.json',
        content: JSON.stringify({
          tickers: (tickers || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean),
          use_scanner_picks: true,
          rules: [
            { name: 'Oversold Entry', condition: 'RSI(14) < 30 AND near support', priority: 'medium', enabled: true },
            { name: 'Momentum Breakout', condition: 'Price > EMA(200) AND Volume > 2x avg', priority: 'high', enabled: true },
            { name: 'Risk-Off Warning', condition: 'VIX > 25 OR drawdown > -3%', priority: 'critical', enabled: true }
          ],
          destinations: { telegram: '', discord_webhook: '', save_to_file: true }
        }, null, 2)
      });
    }

    return files;
  }

  // Simple TAR-like download (individual files in a folder)
  // We use a multi-file download approach with a single combined .md for simplicity,
  // or JSZip if available. Fallback: download CLAUDE.md directly.
  function downloadProject(workflow, tickers, aiTool) {
    var files = generateZip(workflow, tickers, aiTool);

    // Try using JSZip if loaded
    if (typeof JSZip !== 'undefined') {
      var zip = new JSZip();
      var folder = zip.folder(workflow);
      files.forEach(function(f) { folder.file(f.name, f.content); });
      zip.generateAsync({ type: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = workflow + '.zip';
        a.click();
        URL.revokeObjectURL(url);
      });
      return;
    }

    // Fallback: download as a single combined file
    var combined = files.map(function(f) {
      return '# ══════════════════════════════════════\n# FILE: ' + f.name + '\n# ══════════════════════════════════════\n\n' + f.content;
    }).join('\n\n\n');

    var blob = new Blob([combined], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = workflow + '-project.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════
  // AI TOOLS
  // ═══════════════════════════════════════
  var AI_TOOLS = [
    { id: 'claude-code', label: 'Claude Code', color: '#d97706', config: '.mcp.json + CLAUDE.md', desc: 'Full MCP support, auto-detects .mcp.json' },
    { id: 'cursor', label: 'Cursor', color: '#6366f1', config: '.cursorrules', desc: 'Auto-detects .cursorrules file' },
    { id: 'gemini-cli', label: 'Gemini CLI', color: '#10b981', config: 'GEMINI.md', desc: 'Google Gemini CLI agent' },
    { id: 'codex', label: 'Codex CLI', color: '#0ea5e9', config: 'AGENTS.md', desc: 'OpenAI Codex CLI agent' },
    { id: 'windsurf', label: 'Windsurf', color: '#8b5cf6', config: '.windsurfrules', desc: 'Codeium Windsurf IDE' },
    { id: 'claude-cowork', label: 'Claude Cowork', color: '#f59e0b', config: 'CLAUDE.md', desc: 'Claude multi-agent collaboration' }
  ];

  function renderAiToolSelector(idPrefix) {
    var html = '<div class="ai-tools" id="' + idPrefix + 'AiTools">';
    AI_TOOLS.forEach(function(tool) {
      html += '<button type="button" class="ai-tool-btn' + (tool.id === 'claude-code' ? ' active' : '') + '" data-tool="' + tool.id + '">';
      html += '<span class="ai-dot" style="background:' + tool.color + '"></span>';
      html += tool.label + '</button>';
    });
    html += '</div>';
    return html;
  }

  function initAiToolSelector(idPrefix) {
    var container = document.getElementById(idPrefix + 'AiTools');
    if (!container) return;
    container.querySelectorAll('.ai-tool-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        container.querySelectorAll('.ai-tool-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
      });
    });
  }

  function getSelectedAiTool(idPrefix) {
    var container = document.getElementById(idPrefix + 'AiTools');
    var active = container ? container.querySelector('.ai-tool-btn.active') : null;
    return active ? active.dataset.tool : 'claude-code';
  }

  // ═══════════════════════════════════════
  // HELP MODAL
  // ═══════════════════════════════════════
  function showHelpModal(mode) {
    var agentTitle = L.helpAgentTitle || UI.en.helpAgentTitle;
    var agentBody = L.helpAgentBody || UI.en.helpAgentBody;
    var factoryTitle = L.helpFactoryTitle || UI.en.helpFactoryTitle;
    var factoryBody = L.helpFactoryBody || UI.en.helpFactoryBody;

    var html = '<div class="help-overlay" id="helpOverlay" onclick="if(event.target===this)window._closeHelp()">';
    html += '<div class="help-dialog">';
    html += '<div class="help-dialog-header"><h3><i class="fa-solid fa-circle-question"></i> ' + (L.helpTitle || UI.en.helpTitle) + '</h3>';
    html += '<button class="help-dialog-close" onclick="window._closeHelp()" type="button"><i class="fa-solid fa-xmark"></i></button></div>';

    html += '<div class="help-section">';
    html += '<div class="help-section-title"><span class="help-icon agent"><i class="fa-solid fa-robot"></i></span> ' + agentTitle + '</div>';
    html += '<div class="help-dialog-body">' + agentBody + '</div></div>';

    html += '<div class="help-section">';
    html += '<div class="help-section-title"><span class="help-icon factory"><i class="fa-solid fa-bolt"></i></span> ' + factoryTitle + '</div>';
    html += '<div class="help-dialog-body">' + factoryBody + '</div></div>';

    html += '<div class="help-dialog-footer"><button onclick="window._closeHelp()">' + (L.helpClose || UI.en.helpClose) + '</button></div>';
    html += '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  window._closeHelp = function() {
    var overlay = document.getElementById('helpOverlay');
    if (overlay) overlay.remove();
  };

  window._showHelp = function() {
    showHelpModal();
  };

  // ═══════════════════════════════════════
  // RENDER AGENT PANEL
  // ═══════════════════════════════════════
  function renderAgentPanel() {
    var panel = document.getElementById('panelAgent');
    if (!panel) return;

    var html = '<p class="lib-intro">' + L.agentIntro + ' <button class="help-btn" type="button" onclick="window._showHelp()" title="?">?</button></p>';
    html += '<div class="wf-grid">';
    WORKFLOWS.forEach(function(wf) {
      html += '<button class="wf-card" data-wf="' + wf.id + '" type="button">';
      html += '<span class="wf-icon">' + wf.icon + '</span>';
      html += '<span class="wf-title">' + wf.title + '</span>';
      html += '<span class="wf-sub">' + wf.sub + '</span>';
      html += '</button>';
    });
    html += '</div>';

    // Config area (shown when a workflow is selected)
    html += '<div class="wf-config" id="wfConfig" style="display:none">';
    html += '<div class="wf-config-header">';
    html += '<span class="wf-config-icon" id="wfConfigIcon"></span>';
    html += '<div><div class="wf-config-title" id="wfConfigTitle"></div>';
    html += '<div class="wf-config-desc" id="wfConfigDesc"></div></div>';
    html += '</div>';

    // AI Tool selector
    html += '<div class="fg"><div class="fl"><i class="fa-solid fa-microchip"></i> ' + L.aiTool + '</div>';
    html += renderAiToolSelector('wf');
    html += '</div>';

    html += '<div class="fg"><div class="fl"><i class="fa-solid fa-database"></i> ' + L.dataSource + '</div>';
    html += '<div class="src-switch" id="wfSrcSwitch">';
    html += '<button type="button" class="src-opt" data-src="custom"><i class="fa-solid fa-pen"></i> ' + L.srcCustom + '</button>';
    html += '<button type="button" class="src-opt active" data-src="scanner"><i class="fa-solid fa-crosshairs"></i> ' + L.srcScanner + '</button>';
    html += '<button type="button" class="src-opt" data-src="auto"><i class="fa-solid fa-wand-magic-sparkles"></i> ' + L.srcAuto + '</button>';
    html += '</div>';
    html += '<input type="text" class="fi" id="wfTickers" placeholder="' + L.watchlistPh + '" style="display:none"></div>';

    html += '<div class="wf-config-files" id="wfConfigFiles"></div>';

    html += '<div class="wf-actions">';
    html += '<button class="gen-btn" id="wfGenerateBtn" type="button" onclick="window._generateAgent()">';
    html += '<i class="fa-solid fa-wand-magic-sparkles"></i> ' + L.generate + '</button>';
    html += '</div></div>';

    // Output area
    html += '<div class="wf-output" id="wfOutput" style="display:none">';
    html += '<div class="output-header"><h3><i class="fa-solid fa-file-code"></i> CLAUDE.md</h3>';
    html += '<div class="output-meta"><span id="wfOutputChars"><i class="fa-solid fa-text-width"></i></span></div></div>';
    html += '<pre class="prompt-output" id="wfOutputCode"></pre>';
    html += '<div class="wf-output-actions">';
    html += '<button class="action-btn primary" onclick="window._copyAgent()"><i class="fa-solid fa-copy"></i> ' + L.copy + '</button>';
    html += '<button class="action-btn" onclick="window._downloadAgent()"><i class="fa-solid fa-download"></i> ' + L.download + '</button>';
    html += '</div>';
    html += '<div class="wf-howto"><div class="pedagogy-box"><h4><i class="fa-solid fa-graduation-cap"></i> ' + L.howTo + '</h4>';
    html += '<ol><li>' + L.howToStep1 + '</li>';
    html += '<li>' + L.howToStep2Agent + '</li>';
    html += '<li>' + L.howToStep3Agent + '</li></ol>';
    html += '</div></div></div>';

    panel.innerHTML = html;

    // Attach card click listeners
    panel.querySelectorAll('.wf-card').forEach(function(card) {
      card.addEventListener('click', function() {
        selectWorkflow(this.dataset.wf);
      });
    });

    // Source switch + AI tool logic
    initSrcSwitch('wfSrcSwitch', 'wfTickers');
    initAiToolSelector('wf');
  }

  // ── Source switch logic ──
  function initSrcSwitch(switchId, inputId) {
    var sw = document.getElementById(switchId);
    var input = document.getElementById(inputId);
    if (!sw || !input) return;
    sw.querySelectorAll('.src-opt').forEach(function(btn) {
      btn.addEventListener('click', function() {
        sw.querySelectorAll('.src-opt').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        input.style.display = this.dataset.src === 'custom' ? '' : 'none';
        if (this.dataset.src === 'custom') input.focus();
      });
    });
  }

  function getSourceTickers(switchId, inputId) {
    var sw = document.getElementById(switchId);
    var active = sw ? sw.querySelector('.src-opt.active') : null;
    var src = active ? active.dataset.src : 'scanner';
    if (src === 'custom') return document.getElementById(inputId).value.trim() || null;
    if (src === 'auto') return '__AUTO_SCREENER__';
    return null; // scanner = null → templates use "Auto: loaded from Market Watch scanner A+ picks"
  }

  var selectedWorkflow = null;

  function selectWorkflow(id) {
    var wf = WORKFLOWS.find(function(w) { return w.id === id; });
    if (!wf) return;
    selectedWorkflow = id;

    // Update card active states
    document.querySelectorAll('.wf-card').forEach(function(c) {
      c.classList.toggle('active', c.dataset.wf === id);
    });

    // Show and populate config
    var config = document.getElementById('wfConfig');
    config.style.display = '';
    document.getElementById('wfConfigIcon').textContent = wf.icon;
    document.getElementById('wfConfigTitle').textContent = wf.title;
    document.getElementById('wfConfigDesc').textContent = wf.desc;

    // Show included files
    var filesHtml = '<div class="fl"><i class="fa-solid fa-folder-open"></i> ' + L.includes + '</div>';
    filesHtml += '<div class="wf-files-list">';
    wf.files.forEach(function(f) {
      var icon = f.endsWith('.md') ? 'fa-file-lines' : 'fa-file-code';
      filesHtml += '<span class="wf-file-badge"><i class="fa-solid ' + icon + '"></i> ' + f + '</span>';
    });
    filesHtml += '</div>';
    document.getElementById('wfConfigFiles').innerHTML = filesHtml;

    // Hide output when switching
    document.getElementById('wfOutput').style.display = 'none';

    // Scroll to config
    config.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  window._generateAgent = function() {
    if (!selectedWorkflow) return;
    var tickers = getSourceTickers('wfSrcSwitch', 'wfTickers');

    var claudeMd = TEMPLATE_MAP[selectedWorkflow](tickers);
    var output = document.getElementById('wfOutput');
    var code = document.getElementById('wfOutputCode');
    code.textContent = claudeMd;
    document.getElementById('wfOutputChars').innerHTML = '<i class="fa-solid fa-text-width"></i> ' + claudeMd.length.toLocaleString() + ' chars';
    output.style.display = '';
    setTimeout(function() { output.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  window._copyAgent = function() {
    var code = document.getElementById('wfOutputCode');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function() {
      if (typeof showCopySuccess === 'function') showCopySuccess('Claude Code');
    });
  };

  window._downloadAgent = function() {
    if (!selectedWorkflow) return;
    var tickers = getSourceTickers('wfSrcSwitch', 'wfTickers');
    var aiTool = getSelectedAiTool('wf');
    downloadProject(selectedWorkflow, tickers, aiTool);
  };

  // ═══════════════════════════════════════
  // FACTORY MODE — Alert Builder
  // ═══════════════════════════════════════
  function t(translations) { return translations[LANG_CODE] || translations.en; }

  var CONDITIONS = [
    { id: 'rsi-low', icon: 'fa-solid fa-arrow-down', label: 'RSI < 30', cat: 'technical' },
    { id: 'rsi-high', icon: 'fa-solid fa-arrow-up', label: 'RSI > 70', cat: 'technical' },
    { id: 'macd-cross', icon: 'fa-solid fa-right-left', label: 'MACD Cross', cat: 'technical' },
    { id: 'ema200-above', icon: 'fa-solid fa-chart-line', label: 'Price > EMA200', cat: 'technical' },
    { id: 'ema200-below', icon: 'fa-solid fa-chart-line', label: 'Price < EMA200', cat: 'technical' },
    { id: 'volume-spike', icon: 'fa-solid fa-volume-high', label: t({fr:'Volume > 2x moy.',en:'Volume > 2x avg',ar:'حجم > 2x المتوسط',es:'Volumen > 2x prom.',zh:'成交量 > 2倍均值'}), cat: 'technical' },
    { id: '52w-high', icon: 'fa-solid fa-mountain-sun', label: t({fr:'Nouveau 52W High',en:'New 52W High',ar:'قمة 52 أسبوع جديدة',es:'Nuevo máx. 52S',zh:'新52周高点'}), cat: 'technical' },
    { id: '52w-low', icon: 'fa-solid fa-water', label: t({fr:'Nouveau 52W Low',en:'New 52W Low',ar:'قاع 52 أسبوع جديد',es:'Nuevo mín. 52S',zh:'新52周低点'}), cat: 'technical' },
    { id: 'vix-25', icon: 'fa-solid fa-triangle-exclamation', label: 'VIX > 25', cat: 'macro' },
    { id: 'vix-35', icon: 'fa-solid fa-skull', label: 'VIX > 35', cat: 'macro' },
    { id: 'regime-change', icon: 'fa-solid fa-rotate', label: t({fr:'Changement de régime',en:'Regime Change',ar:'تغيير النظام',es:'Cambio de régimen',zh:'市场制度变化'}), cat: 'macro' },
    { id: 'rate-decision', icon: 'fa-solid fa-landmark', label: t({fr:'Décision de taux',en:'Rate Decision',ar:'قرار الفائدة',es:'Decisión de tipos',zh:'利率决议'}), cat: 'macro' },
    { id: 'earnings-near', icon: 'fa-solid fa-calendar', label: t({fr:'Earnings < 7j',en:'Earnings < 7d',ar:'أرباح < 7 أيام',es:'Resultados < 7d',zh:'财报 < 7天'}), cat: 'event' },
    { id: 'insider-buy', icon: 'fa-solid fa-user-tie', label: t({fr:'Achat d\'insider',en:'Insider Buy',ar:'شراء من الداخل',es:'Compra insider',zh:'内部人买入'}), cat: 'event' },
    { id: 'analyst-upgrade', icon: 'fa-solid fa-star', label: t({fr:'Upgrade analyste',en:'Analyst Upgrade',ar:'ترقية محلل',es:'Upgrade analista',zh:'分析师上调'}), cat: 'event' },
    { id: 'news-catalyst', icon: 'fa-solid fa-newspaper', label: t({fr:'News majeure',en:'Major News',ar:'أخبار رئيسية',es:'Noticia importante',zh:'重大新闻'}), cat: 'event' }
  ];

  var ACTIONS = [
    { id: 'telegram', icon: 'fa-brands fa-telegram', label: 'Telegram', desc: t({fr:'Alerte instantanée via bot',en:'Instant alert via bot',ar:'تنبيه فوري عبر بوت',es:'Alerta instantánea via bot',zh:'通过机器人即时警报'}) },
    { id: 'discord', icon: 'fa-brands fa-discord', label: 'Discord', desc: 'Webhook' },
    { id: 'full-analysis', icon: 'fa-solid fa-microscope', label: t({fr:'Analyse complète',en:'Full Analysis',ar:'تحليل كامل',es:'Análisis completo',zh:'完整分析'}), desc: t({fr:'Deep-dive automatique',en:'Auto deep-dive',ar:'تحليل معمّق تلقائي',es:'Deep-dive automático',zh:'自动深度分析'}) },
    { id: 'trade-plan', icon: 'fa-solid fa-bullseye', label: 'Trade Plan', desc: 'Entry/Stop/TP' },
    { id: 'save-report', icon: 'fa-solid fa-file-export', label: t({fr:'Sauvegarder',en:'Save Report',ar:'حفظ التقرير',es:'Guardar informe',zh:'保存报告'}), desc: t({fr:'Fichier local',en:'Local file',ar:'ملف محلي',es:'Archivo local',zh:'本地文件'}) }
  ];

  function renderFactoryPanel() {
    var panel = document.getElementById('panelFactory');
    if (!panel) return;

    var html = '<p class="lib-intro">' + L.factoryIntro + ' <button class="help-btn" type="button" onclick="window._showHelp()" title="?">?</button></p>';
    html += '<div class="prompt-card">';

    // AI Tool selector
    html += '<div class="fg"><div class="fl"><i class="fa-solid fa-microchip"></i> ' + L.aiTool + '</div>';
    html += renderAiToolSelector('factory');
    html += '</div>';

    // Step 1: Target
    html += '<div class="factory-step">';
    html += '<div class="factory-step-num">1</div>';
    html += '<div class="factory-step-label">' + L.step1 + '</div>';
    html += '</div>';
    html += '<div class="fg"><div class="fl"><i class="fa-solid fa-database"></i> ' + L.dataSource + '</div>';
    html += '<div class="src-switch" id="factorySrcSwitch">';
    html += '<button type="button" class="src-opt" data-src="custom"><i class="fa-solid fa-pen"></i> ' + L.srcCustom + '</button>';
    html += '<button type="button" class="src-opt active" data-src="scanner"><i class="fa-solid fa-crosshairs"></i> ' + L.srcScanner + '</button>';
    html += '<button type="button" class="src-opt" data-src="auto"><i class="fa-solid fa-wand-magic-sparkles"></i> ' + L.srcAuto + '</button>';
    html += '</div>';
    html += '<input type="text" class="fi" id="factoryTickers" placeholder="' + L.tickersPh + '" style="display:none"></div>';

    // Step 2: Conditions
    html += '<div class="factory-step">';
    html += '<div class="factory-step-num">2</div>';
    html += '<div class="factory-step-label">' + L.step2 + '</div>';
    html += '</div>';
    html += '<div class="focus-chips" id="factoryConditions">';
    CONDITIONS.forEach(function(c) {
      var catClass = c.cat === 'macro' ? ' chip-macro' : c.cat === 'event' ? ' chip-event' : '';
      html += '<button type="button" class="focus-chip' + catClass + '" data-cond="' + c.id + '">';
      html += '<i class="' + c.icon + '"></i> ' + c.label + '</button>';
    });
    html += '</div>';

    // Step 3: Actions
    html += '<div class="factory-step">';
    html += '<div class="factory-step-num">3</div>';
    html += '<div class="factory-step-label">' + L.step3 + '</div>';
    html += '</div>';
    html += '<div class="focus-chips" id="factoryActions">';
    ACTIONS.forEach(function(a) {
      html += '<button type="button" class="focus-chip" data-action="' + a.id + '">';
      html += '<i class="' + a.icon + '"></i> ' + a.label + '</button>';
    });
    html += '</div>';

    // Generate
    html += '<button class="gen-btn" id="factoryGenBtn" type="button" onclick="window._generateFactory()">';
    html += '<i class="fa-solid fa-bolt"></i> ' + L.generate + '</button>';
    html += '</div>';

    // Output
    html += '<div class="wf-output" id="factoryOutput" style="display:none">';
    html += '<div class="output-header"><h3><i class="fa-solid fa-bell"></i> ' + t({fr:'Système d\'Alertes',en:'Alert System',ar:'\u0646\u0638\u0627\u0645 \u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a',es:'Sistema de Alertas',zh:'\u8b66\u62a5\u7cfb\u7edf'}) + '</h3>';
    html += '<div class="output-meta"><span id="factoryOutputChars"><i class="fa-solid fa-text-width"></i></span></div></div>';
    html += '<pre class="prompt-output" id="factoryOutputCode"></pre>';
    html += '<div class="wf-output-actions">';
    html += '<button class="action-btn primary" onclick="window._copyFactory()"><i class="fa-solid fa-copy"></i> ' + L.copy + '</button>';
    html += '<button class="action-btn" onclick="window._downloadFactory()"><i class="fa-solid fa-download"></i> ' + L.download + '</button>';
    html += '</div>';
    html += '<div class="wf-howto"><div class="pedagogy-box"><h4><i class="fa-solid fa-graduation-cap"></i> ' + L.howTo + '</h4>';
    html += '<ol><li>' + L.howToStep1 + '</li>';
    html += '<li>' + L.howToStep2Factory + '</li>';
    html += '<li>' + L.howToStep3Factory + '</li></ol>';
    html += '</div></div></div>';

    panel.innerHTML = html;

    // Chip toggle logic
    panel.querySelectorAll('.focus-chip').forEach(function(chip) {
      chip.addEventListener('click', function() { this.classList.toggle('active'); });
    });

    // Source switch + AI tool logic
    initSrcSwitch('factorySrcSwitch', 'factoryTickers');
    initAiToolSelector('factory');
  }

  function generateAlertCLAUDEmd(tickers, conditions, actions) {
    tickers = normalizeTickers(tickers);
    var condText = conditions.map(function(id) {
      var c = CONDITIONS.find(function(x) { return x.id === id; });
      return c ? '- **' + c.label + '**' : '';
    }).filter(Boolean).join('\n');

    var actionText = actions.map(function(id) {
      var a = ACTIONS.find(function(x) { return x.id === id; });
      return a ? '- **' + a.label + '**: ' + a.desc : '';
    }).filter(Boolean).join('\n');

    return `# Market Watch — Smart Alert System 🔔

## Your Role
You are an intelligent alert monitoring system. You continuously scan market conditions
and trigger alerts when specific criteria are met.

## Data Sources
\`\`\`
Fetch: https://articles.market-watch.xyz/mcp/watchlist.json
\`\`\`
Use MarketWatch Gateway MCP if available for real-time data.

## Monitored Assets
${tickers || 'Auto: loaded from Market Watch scanner A+ picks'}

## Alert Conditions (trigger when ANY is true)
${condText || '- RSI(14) < 30\n- Price > EMA(200) with volume spike\n- VIX > 25'}

## Actions (execute ALL when triggered)
${actionText || '- Full Analysis\n- Save Report'}

## Alert Format
\`\`\`
🔔 ALERT TRIGGERED
━━━━━━━━━━━━━━━━━━━━━━━━
Ticker: $TICKER
Condition: $CONDITION_NAME
Current Value: $VALUE
Threshold: $THRESHOLD
Time: $TIMESTAMP
━━━━━━━━━━━━━━━━━━━━━━━━
Priority: 🔴 HIGH / 🟡 MEDIUM / 🟢 INFO
Action: $ACTIONS_TAKEN
\`\`\`

## Monitoring Schedule
- Pre-market (7:00-9:30 AM): every 5 minutes
- Market hours (9:30 AM-4:00 PM): every 15 minutes
- After-hours: every 30 minutes
- Weekend: 2x daily (crypto + geopolitics only)

## Escalation Logic
1. **Single condition met** → Standard alert
2. **Multiple conditions met** → Elevated priority + full analysis
3. **Critical condition** (VIX > 35, drawdown > -5%) → Urgent alert + portfolio review

## Anti-Hallucination
- Only alert on verifiable conditions (real price data, not estimates)
- Include data source and timestamp with every alert
- If data unavailable, say "DATA UNAVAILABLE" — never guess

## How to Start
Say: "Start monitoring" or "Check conditions now"
`;
  }

  window._generateFactory = function() {
    var tickers = getSourceTickers('factorySrcSwitch', 'factoryTickers');

    var conditions = [];
    document.querySelectorAll('#factoryConditions .focus-chip.active').forEach(function(c) {
      conditions.push(c.dataset.cond);
    });
    var actions = [];
    document.querySelectorAll('#factoryActions .focus-chip.active').forEach(function(c) {
      actions.push(c.dataset.action);
    });

    var claudeMd = generateAlertCLAUDEmd(tickers, conditions, actions);
    var output = document.getElementById('factoryOutput');
    document.getElementById('factoryOutputCode').textContent = claudeMd;
    document.getElementById('factoryOutputChars').innerHTML = '<i class="fa-solid fa-text-width"></i> ' + claudeMd.length.toLocaleString() + ' chars';
    output.style.display = '';
    setTimeout(function() { output.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  window._copyFactory = function() {
    var code = document.getElementById('factoryOutputCode');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function() {
      if (typeof showCopySuccess === 'function') showCopySuccess('Claude Code');
    });
  };

  window._downloadFactory = function() {
    var tickers = getSourceTickers('factorySrcSwitch', 'factoryTickers');
    var aiTool = getSelectedAiTool('factory');
    var conditions = [];
    document.querySelectorAll('#factoryConditions .focus-chip.active').forEach(function(c) {
      conditions.push(c.dataset.cond);
    });
    var actions = [];
    document.querySelectorAll('#factoryActions .focus-chip.active').forEach(function(c) {
      actions.push(c.dataset.action);
    });

    var claudeMd = generateAlertCLAUDEmd(tickers, conditions, actions);
    var readme = '# 🔔 Alert System — Market Watch AI Agent\n\n' +
      'Custom alert monitoring system powered by Market Watch data.\n\n' +
      '## Quick Start\n```bash\ncd mcp-server && npm install && cd ..\nclaude\n# Say: "Start monitoring"\n```\n\n' +
      '## Files\n- `CLAUDE.md` — AI agent configuration\n- `.mcp.json` — MCP server config\n- `mcp-server/` — Live data server\n- `alerts-config.json` — Alert rules (editable)\n\n' +
      '---\n*This is not financial advice.*\n';

    var files = [
      { name: 'CLAUDE.md', content: claudeMd },
      { name: '.mcp.json', content: MCP_DOT_JSON('./mcp-server/index.js') },
      { name: 'mcp-server/index.js', content: MCP_SERVER_INDEX },
      { name: 'mcp-server/package.json', content: MCP_SERVER_PKG },
      { name: 'README.md', content: readme },
      { name: 'alerts-config.json', content: JSON.stringify({
        tickers: (tickers || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean),
        use_scanner_picks: true,
        conditions: conditions,
        actions: actions
      }, null, 2) }
    ];

    // Add tool-specific config
    if (aiTool === 'cursor' || aiTool === 'claude-code') files.push({ name: '.cursorrules', content: claudeMd });
    if (aiTool === 'windsurf') files.push({ name: '.windsurfrules', content: claudeMd });
    if (aiTool === 'gemini-cli') files.push({ name: 'GEMINI.md', content: claudeMd });
    if (aiTool === 'codex') files.push({ name: 'AGENTS.md', content: claudeMd });

    // Download
    if (typeof JSZip !== 'undefined') {
      var zip = new JSZip();
      var folder = zip.folder('alert-system');
      files.forEach(function(f) { folder.file(f.name, f.content); });
      zip.generateAsync({ type: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'alert-system.zip'; a.click();
        URL.revokeObjectURL(url);
      });
    } else {
      var combined = files.map(function(f) {
        return '# FILE: ' + f.name + '\n\n' + f.content;
      }).join('\n\n---\n\n');
      var blob = new Blob([combined], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'alert-system-project.md'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function() {
    renderAgentPanel();
    renderFactoryPanel();
  });

})();
