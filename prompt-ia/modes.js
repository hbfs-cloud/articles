(function() {
  'use strict';

  var LANG_CODE = (new URLSearchParams(window.location.search).get('lang')) || 'en';
  if (['fr','en','ar','es','zh'].indexOf(LANG_CODE) === -1) LANG_CODE = 'en';

  function t(obj) { return obj[LANG_CODE] || obj.en; }

  // ═══════════════════════════════════════
  // UI LABELS (all 5 languages)
  // ═══════════════════════════════════════
  var UI = {
    en: {
      liveTitle: 'Live Data Preview',
      liveSub: 'This is the real data your AI agent will access via MCP.',
      regime: 'Regime', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: 'Fear/Greed', picks: 'A+ Picks', updated: 'Updated',
      entry: 'Entry', stop: 'Stop', tp1: 'TP1', score: 'Score',
      agentIntro: 'Pick a workflow below. Download a ready-to-run project for your AI tool.',
      dataSource: 'Data Source',
      srcScanner: 'A+ Picks', srcAuto: 'Auto-Screener', srcCustom: 'Custom',
      generate: 'Download Project', download: 'Download ZIP', copy: 'Copy CLAUDE.md',
      includes: 'Project includes', howTo: 'How to use',
      howToStep1: 'Unzip the project folder',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: 'Open folder in <strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong>, or <strong>Codex CLI</strong> — config files auto-detected',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: 'Custom tickers',
      tickersOpt: 'optional — defaults to scanner picks',
      helpTitle: 'How does this work?',
      helpBody: '<p>This generates a <strong>complete project folder</strong> that transforms your AI coding tool into a financial assistant.</p><h4>What you get:</h4><ul><li><strong>CLAUDE.md / .cursorrules / GEMINI.md</strong> — Instructions that tell the AI what to do</li><li><strong>MCP Server</strong> — A local server that connects your AI to <strong>live DailyTickers data</strong> (A+ picks, regime, VIX, 250+ articles)</li><li><strong>.mcp.json</strong> — Auto-configuration. Claude Code detects it instantly.</li></ul><h4>What it actually does:</h4><ul><li><strong>Morning Briefing:</strong> Run <code>claude</code> and say "morning scan" — the AI fetches today\'s picks and gives you a 30-second briefing</li><li><strong>Deep Analysis:</strong> Say "analyze AVGO" — multi-source research with trade plan</li><li><strong>Custom Alerts:</strong> Say "check alert conditions" — the AI checks your rules against live data</li></ul><h4>Be honest about limits:</h4><ul><li>The AI checks data <strong>when you ask it to</strong>, not continuously in the background</li><li>DailyTickers data updates <strong>daily at 23:00 UTC</strong>, not in real-time</li><li>For real-time alerts, you need a proper alerting service — this is an <strong>analysis assistant</strong></li></ul><h4>Compatible with:</h4><p><strong>Claude Code</strong> (best — full MCP), <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong>, <strong>Codex CLI</strong>. For ChatGPT/Gemini web: copy CLAUDE.md as system prompt.</p>',
      helpClose: 'Got it',
      noData: 'Loading live data...',
      errorData: 'Could not load live data',
      extTitle: 'Chrome Extension',
      extSub: 'Inject live DailyTickers data directly into your browser — A+ picks, regime, VIX overlaid on Yahoo Finance, TradingView, Finviz and more.',
      extStep1: 'Go to <code>chrome://extensions</code> → enable <strong>Developer Mode</strong>',
      extStep2: 'Click <strong>Load unpacked</strong>',
      extStep3: 'Select the <code>mcp/extension/</code> folder',
      extSites: 'Yahoo Finance · TradingView · Finviz · StockTwits · Reddit · DeepSeek',
      extInstall: 'Install Extension'
    },
    fr: {
      liveTitle: 'Aperçu des Données Live',
      liveSub: 'Ce sont les vraies données que ton agent IA va utiliser via MCP.',
      regime: 'Régime', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: 'Fear/Greed', picks: 'Picks A+', updated: 'Mis à jour',
      entry: 'Entrée', stop: 'Stop', tp1: 'TP1', score: 'Score',
      agentIntro: 'Choisis un workflow. Télécharge un projet prêt à l\'emploi pour ton outil IA.',
      dataSource: 'Source de données',
      srcScanner: 'Picks A+', srcAuto: 'Auto-Screener', srcCustom: 'Personnalisé',
      generate: 'Télécharger le Projet', download: 'Télécharger ZIP', copy: 'Copier CLAUDE.md',
      includes: 'Le projet contient', howTo: 'Comment utiliser',
      howToStep1: 'Décompresse le dossier',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: 'Ouvre le dossier dans <strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong> ou <strong>Codex CLI</strong> — fichiers de config auto-détectés',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: 'Tickers personnalisés',
      tickersOpt: 'optionnel — par défaut les picks du scanner',
      helpTitle: 'Comment ça marche ?',
      helpBody: '<p>Ceci génère un <strong>dossier projet complet</strong> qui transforme ton outil IA en assistant financier.</p><h4>Ce que tu obtiens :</h4><ul><li><strong>CLAUDE.md / .cursorrules / GEMINI.md</strong> — Instructions qui disent à l\'IA quoi faire</li><li><strong>Serveur MCP</strong> — Un serveur local qui connecte ton IA aux <strong>données live DailyTickers</strong> (picks A+, régime, VIX, 250+ articles)</li><li><strong>.mcp.json</strong> — Auto-configuration. Claude Code le détecte instantanément.</li></ul><h4>Ce que ça fait concrètement :</h4><ul><li><strong>Briefing matinal :</strong> Lance <code>claude</code> et dis "scan du matin" — l\'IA fetch les picks du jour et te brief en 30 secondes</li><li><strong>Analyse approfondie :</strong> Dis "analyse AVGO" — recherche multi-source avec plan de trade</li><li><strong>Alertes personnalisées :</strong> Dis "vérifie les conditions d\'alerte" — l\'IA vérifie tes règles contre les données live</li></ul><h4>Soyons honnêtes :</h4><ul><li>L\'IA vérifie les données <strong>quand tu le demandes</strong>, pas en continu en arrière-plan</li><li>Les données DailyTickers sont mises à jour <strong>quotidiennement à 23:00 UTC</strong>, pas en temps réel</li><li>Pour des alertes temps réel, il faut un service d\'alertes dédié — ceci est un <strong>assistant d\'analyse</strong></li></ul><h4>Compatible avec :</h4><p><strong>Claude Code</strong> (idéal — MCP complet), <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong>, <strong>Codex CLI</strong>. Pour ChatGPT/Gemini web : copie le CLAUDE.md comme prompt système.</p>',
      helpClose: 'Compris',
      noData: 'Chargement des données live...',
      errorData: 'Impossible de charger les données live',
      extTitle: 'Extension Chrome',
      extSub: 'Injecte les données live DailyTickers dans ton navigateur — picks A+, régime, VIX directement sur Yahoo Finance, TradingView, Finviz et plus.',
      extStep1: 'Va sur <code>chrome://extensions</code> → active le <strong>Mode développeur</strong>',
      extStep2: 'Clique sur <strong>Charger l\'extension non empaquetée</strong>',
      extStep3: 'Sélectionne le dossier <code>mcp/extension/</code>',
      extSites: 'Yahoo Finance · TradingView · Finviz · StockTwits · Reddit · DeepSeek',
      extInstall: 'Installer l\'extension'
    },
    ar: {
      liveTitle: '\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062d\u064a\u0629',
      liveSub: '\u0647\u0630\u0647 \u0647\u064a \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062d\u0642\u064a\u0642\u064a\u0629 \u0627\u0644\u062a\u064a \u0633\u064a\u0635\u0644 \u0625\u0644\u064a\u0647\u0627 \u0648\u0643\u064a\u0644\u0643 \u0627\u0644\u0630\u0643\u064a \u0639\u0628\u0631 MCP.',
      regime: '\u0627\u0644\u0646\u0638\u0627\u0645', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: '\u062e\u0648\u0641/\u0637\u0645\u0639', picks: '\u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a A+', updated: '\u0645\u062d\u062f\u0651\u062b',
      entry: '\u062f\u062e\u0648\u0644', stop: '\u0648\u0642\u0641', tp1: 'TP1', score: '\u0646\u0642\u0627\u0637',
      agentIntro: '\u0627\u062e\u062a\u0631 \u0633\u064a\u0631 \u0639\u0645\u0644. \u062d\u0645\u0651\u0644 \u0645\u0634\u0631\u0648\u0639\u0627\u064b \u062c\u0627\u0647\u0632\u0627\u064b \u0644\u0623\u062f\u0627\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a.',
      dataSource: '\u0645\u0635\u062f\u0631 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a',
      srcScanner: '\u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a A+', srcAuto: '\u0641\u0631\u0632 \u062a\u0644\u0642\u0627\u0626\u064a', srcCustom: '\u0645\u062e\u0635\u0635',
      generate: '\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0634\u0631\u0648\u0639', download: '\u062a\u062d\u0645\u064a\u0644 ZIP', copy: '\u0646\u0633\u062e CLAUDE.md',
      includes: '\u064a\u062a\u0636\u0645\u0651\u0646 \u0627\u0644\u0645\u0634\u0631\u0648\u0639', howTo: '\u0643\u064a\u0641\u064a\u0629 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645',
      howToStep1: '\u0641\u0643\u0651 \u0636\u063a\u0637 \u0627\u0644\u0645\u062c\u0644\u062f',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: '\u0627\u0641\u062a\u062d \u0627\u0644\u0645\u062c\u0644\u062f \u0641\u064a <strong>Claude Code</strong>\u060c <strong>Cursor</strong>\u060c <strong>Windsurf</strong>\u060c <strong>Gemini CLI</strong> \u0623\u0648 <strong>Codex CLI</strong>',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: '\u0631\u0645\u0648\u0632 \u0645\u062e\u0635\u0635\u0629',
      tickersOpt: '\u0627\u062e\u062a\u064a\u0627\u0631\u064a \u2014 \u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0627\u064b \u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u0627\u0633\u062d',
      helpTitle: '\u0643\u064a\u0641 \u064a\u0639\u0645\u0644\u061f',
      helpBody: '<p>\u064a\u0646\u0634\u0626 <strong>\u0645\u062c\u0644\u062f \u0645\u0634\u0631\u0648\u0639 \u0643\u0627\u0645\u0644</strong> \u064a\u062d\u0648\u0651\u0644 \u0623\u062f\u0627\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0625\u0644\u0649 \u0645\u0633\u0627\u0639\u062f \u0645\u0627\u0644\u064a.</p><h4>\u0645\u0627 \u062a\u062d\u0635\u0644 \u0639\u0644\u064a\u0647:</h4><ul><li><strong>CLAUDE.md</strong> \u2014 \u062a\u0639\u0644\u064a\u0645\u0627\u062a \u0644\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a</li><li><strong>\u062e\u0627\u062f\u0645 MCP</strong> \u2014 \u064a\u0631\u0628\u0637 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0628\u0628\u064a\u0627\u0646\u0627\u062a DailyTickers \u0627\u0644\u062d\u064a\u0629</li></ul><h4>\u0645\u0627 \u064a\u0641\u0639\u0644\u0647 \u0641\u0639\u0644\u064a\u0627\u064b:</h4><ul><li><strong>\u0645\u0644\u062e\u0635 \u0635\u0628\u0627\u062d\u064a:</strong> \u0634\u063a\u0651\u0644 <code>claude</code> \u0648\u0642\u0644 "\u0645\u0633\u062d \u0627\u0644\u0635\u0628\u0627\u062d" \u2014 \u0645\u0644\u062e\u0635 \u0641\u064a 30 \u062b\u0627\u0646\u064a\u0629</li><li><strong>\u062a\u062d\u0644\u064a\u0644 \u0639\u0645\u064a\u0642:</strong> \u0642\u0644 "analyze AVGO" \u2014 \u0628\u062d\u062b \u0645\u062a\u0639\u062f\u062f \u0627\u0644\u0645\u0635\u0627\u062f\u0631</li></ul><h4>\u0627\u0644\u062d\u062f\u0648\u062f:</h4><ul><li>\u0627\u0644\u0630\u0643\u0627\u0621 \u064a\u062a\u062d\u0642\u0642 <strong>\u0639\u0646\u062f\u0645\u0627 \u062a\u0637\u0644\u0628</strong>\u060c \u0644\u064a\u0633 \u0628\u0627\u0633\u062a\u0645\u0631\u0627\u0631</li><li>\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u062a\u062a\u062d\u062f\u062b <strong>\u064a\u0648\u0645\u064a\u0627\u064b \u0627\u0644\u0633\u0627\u0639\u0629 23:00 UTC</strong></li></ul>',
      helpClose: '\u0641\u0647\u0645\u062a',
      noData: '\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a...',
      errorData: '\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a',
      extTitle: '\u0625\u0636\u0627\u0641\u064a\u0629 Chrome',
      extSub: '\u0623\u062f\u062e\u0644 \u0628\u064a\u0627\u0646\u0627\u062a DailyTickers \u0627\u0644\u062d\u064a\u0629 \u0645\u0628\u0627\u0634\u0631\u0629\u064b \u0641\u064a \u0645\u062a\u0635\u0641\u062d\u0643 \u2014 Yahoo Finance \u0648TradingView \u0648Finviz \u0648\u063a\u064a\u0631\u0647\u0627.',
      extStep1: '\u0627\u0630\u0647\u0628 \u0625\u0644\u0649 <code>chrome://extensions</code> \u2190 \u0641\u0639\u0651\u0644 <strong>\u0648\u0636\u0639 \u0627\u0644\u0645\u0637\u0648\u0651\u0631</strong>',
      extStep2: '\u0627\u0636\u063a\u0637 <strong>\u062a\u062d\u0645\u064a\u0644 \u063a\u064a\u0631 \u0645\u062d\u0632\u0648\u0645</strong>',
      extStep3: '\u062d\u062f\u062f \u0645\u062c\u0644\u062f <code>mcp/extension/</code>',
      extSites: 'Yahoo Finance \u00b7 TradingView \u00b7 Finviz \u00b7 StockTwits \u00b7 Reddit \u00b7 DeepSeek',
      extInstall: '\u062a\u062b\u0628\u064a\u062a \u0627\u0644\u0625\u0636\u0627\u0641\u064a\u0629'
    },
    es: {
      liveTitle: 'Vista Previa de Datos en Vivo',
      liveSub: 'Estos son los datos reales que tu agente IA accederá via MCP.',
      regime: 'Régimen', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: 'Miedo/Codicia', picks: 'Picks A+', updated: 'Actualizado',
      entry: 'Entrada', stop: 'Stop', tp1: 'TP1', score: 'Puntos',
      agentIntro: 'Elige un flujo de trabajo. Descarga un proyecto listo para tu herramienta IA.',
      dataSource: 'Fuente de datos',
      srcScanner: 'Picks A+', srcAuto: 'Auto-Screener', srcCustom: 'Personalizado',
      generate: 'Descargar Proyecto', download: 'Descargar ZIP', copy: 'Copiar CLAUDE.md',
      includes: 'El proyecto incluye', howTo: 'Cómo usar',
      howToStep1: 'Descomprime la carpeta',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: 'Abre la carpeta en <strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong> o <strong>Codex CLI</strong>',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: 'Tickers personalizados',
      tickersOpt: 'opcional — por defecto los picks del scanner',
      helpTitle: '¿Cómo funciona?',
      helpBody: '<p>Genera una <strong>carpeta de proyecto completa</strong> que transforma tu herramienta IA en asistente financiero.</p><h4>Lo que obtienes:</h4><ul><li><strong>CLAUDE.md</strong> — Instrucciones para la IA</li><li><strong>Servidor MCP</strong> — Conecta la IA a datos en vivo de DailyTickers</li></ul><h4>Lo que hace:</h4><ul><li><strong>Briefing matutino:</strong> Ejecuta <code>claude</code> y di "morning scan" — resumen en 30 segundos</li><li><strong>Análisis profundo:</strong> Di "analyze AVGO" — investigación multi-fuente</li></ul><h4>Limitaciones:</h4><ul><li>La IA verifica <strong>cuando tú lo pides</strong>, no continuamente</li><li>Datos actualizados <strong>diariamente a las 23:00 UTC</strong></li></ul>',
      helpClose: 'Entendido',
      noData: 'Cargando datos en vivo...',
      errorData: 'No se pudieron cargar los datos',
      extTitle: 'Extensión de Chrome',
      extSub: 'Inyecta datos en vivo de DailyTickers en tu navegador — picks A+, régimen, VIX en Yahoo Finance, TradingView, Finviz y más.',
      extStep1: 'Ve a <code>chrome://extensions</code> → activa el <strong>Modo desarrollador</strong>',
      extStep2: 'Haz clic en <strong>Cargar descomprimida</strong>',
      extStep3: 'Selecciona la carpeta <code>mcp/extension/</code>',
      extSites: 'Yahoo Finance · TradingView · Finviz · StockTwits · Reddit · DeepSeek',
      extInstall: 'Instalar extensión'
    },
    zh: {
      liveTitle: '\u5b9e\u65f6\u6570\u636e\u9884\u89c8',
      liveSub: '\u8fd9\u662f\u4f60\u7684 AI \u4ee3\u7406\u901a\u8fc7 MCP \u8bbf\u95ee\u7684\u771f\u5b9e\u6570\u636e\u3002',
      regime: '\u5e02\u573a\u5236\u5ea6', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: '\u6050\u60e7/\u8d2a\u5a6a', picks: 'A+ \u7cbe\u9009', updated: '\u66f4\u65b0\u65f6\u95f4',
      entry: '\u5165\u573a', stop: '\u6b62\u635f', tp1: 'TP1', score: '\u5206\u6570',
      agentIntro: '\u9009\u62e9\u5de5\u4f5c\u6d41\u3002\u4e0b\u8f7d\u9002\u7528\u4e8e\u4f60 AI \u5de5\u5177\u7684\u5373\u7528\u9879\u76ee\u3002',
      dataSource: '\u6570\u636e\u6e90',
      srcScanner: 'A+ \u7cbe\u9009', srcAuto: '\u81ea\u52a8\u7b5b\u9009', srcCustom: '\u81ea\u5b9a\u4e49',
      generate: '\u4e0b\u8f7d\u9879\u76ee', download: '\u4e0b\u8f7d ZIP', copy: '\u590d\u5236 CLAUDE.md',
      includes: '\u9879\u76ee\u5305\u542b', howTo: '\u5982\u4f55\u4f7f\u7528',
      howToStep1: '\u89e3\u538b\u6587\u4ef6\u5939',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: '\u5728 <strong>Claude Code</strong>\u3001<strong>Cursor</strong>\u3001<strong>Windsurf</strong>\u3001<strong>Gemini CLI</strong> \u6216 <strong>Codex CLI</strong> \u4e2d\u6253\u5f00\u6587\u4ef6\u5939',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: '\u81ea\u5b9a\u4e49\u80a1\u7968',
      tickersOpt: '\u53ef\u9009 \u2014 \u9ed8\u8ba4\u4f7f\u7528\u626b\u63cf\u5668\u7cbe\u9009',
      helpTitle: '\u8fd9\u662f\u5982\u4f55\u5de5\u4f5c\u7684\uff1f',
      helpBody: '<p>\u751f\u6210\u4e00\u4e2a<strong>\u5b8c\u6574\u7684\u9879\u76ee\u6587\u4ef6\u5939</strong>\uff0c\u5c06\u4f60\u7684 AI \u5de5\u5177\u53d8\u6210\u91d1\u878d\u52a9\u624b\u3002</p><h4>\u4f60\u5c06\u83b7\u5f97\uff1a</h4><ul><li><strong>CLAUDE.md</strong> \u2014 AI \u6307\u4ee4\u6587\u4ef6</li><li><strong>MCP \u670d\u52a1\u5668</strong> \u2014 \u8fde\u63a5 AI \u5230 DailyTickers \u5b9e\u65f6\u6570\u636e</li></ul><h4>\u5b9e\u9645\u529f\u80fd\uff1a</h4><ul><li><strong>\u665a\u95f4\u7b80\u62a5\uff1a</strong>\u8fd0\u884c <code>claude</code> \u8bf4 "morning scan" \u2014 30\u79d2\u7b80\u62a5</li><li><strong>\u6df1\u5ea6\u5206\u6790\uff1a</strong>\u8bf4 "analyze AVGO" \u2014 \u591a\u6e90\u7814\u7a76</li></ul><h4>\u9650\u5236\uff1a</h4><ul><li>AI <strong>\u5728\u4f60\u8981\u6c42\u65f6</strong>\u68c0\u67e5\uff0c\u4e0d\u662f\u6301\u7eed\u76d1\u63a7</li><li>\u6570\u636e<strong>\u6bcf\u65e5 23:00 UTC \u66f4\u65b0</strong></li></ul>',
      helpClose: '\u660e\u767d\u4e86',
      noData: '\u6b63\u5728\u52a0\u8f7d\u5b9e\u65f6\u6570\u636e...',
      errorData: '\u65e0\u6cd5\u52a0\u8f7d\u5b9e\u65f6\u6570\u636e',
      extTitle: 'Chrome \u6269\u5c55\u7a0b\u5e8f',
      extSub: '\u5c06 DailyTickers \u5b9e\u65f6\u6570\u636e\u76f4\u63a5\u6ce8\u5165\u6d4f\u89c8\u5668 \u2014 Yahoo Finance\u3001TradingView\u3001Finviz \u7b49\u3002',
      extStep1: '\u524d\u5f80 <code>chrome://extensions</code> \u2192 \u5f00\u542f<strong>\u5f00\u53d1\u8005\u6a21\u5f0f</strong>',
      extStep2: '\u70b9\u51fb<strong>\u52a0\u8f7d\u5df2\u89e3\u538b\u7684\u6269\u5c55\u7a0b\u5e8f</strong>',
      extStep3: '\u9009\u62e9 <code>mcp/extension/</code> \u6587\u4ef6\u5939',
      extSites: 'Yahoo Finance \u00b7 TradingView \u00b7 Finviz \u00b7 StockTwits \u00b7 Reddit \u00b7 DeepSeek',
      extInstall: '\u5b89\u88c5\u6269\u5c55\u7a0b\u5e8f'
    }
  };
  var L = UI[LANG_CODE] || UI.en;

  // ═══════════════════════════════════════
  // 2 WORKFLOWS (simplified)
  // ═══════════════════════════════════════
  var WORKFLOWS = [
    {
      id: 'morning-briefing',
      icon: '\u2615',
      title: 'Morning Briefing',
      sub: t({
        fr: 'Lance claude → "scan du matin" → briefing 30s',
        en: 'Run claude → "morning scan" → 30s briefing',
        ar: '\u0634\u063a\u0651\u0644 claude → "\u0645\u0633\u062d \u0627\u0644\u0635\u0628\u0627\u062d" → \u0645\u0644\u062e\u0635 30 \u062b\u0627\u0646\u064a\u0629',
        es: 'Ejecuta claude → "scan matutino" → briefing 30s',
        zh: '\u8fd0\u884c claude → "\u665a\u95f4\u626b\u63cf" → 30\u79d2\u7b80\u62a5'
      }),
      desc: t({
        fr: 'Chaque matin, lance Claude Code et dis "scan du matin". L\'IA fetch les picks A+ du jour, le régime de marché, les catalyseurs, et te donne un briefing actionnable en 30 secondes. Pas de monitoring continu — un snapshot ponctuel quand tu le demandes.',
        en: 'Every morning, open Claude Code and say "morning scan". The AI fetches today\'s A+ picks, market regime, catalysts, and gives you an actionable briefing in 30 seconds. No continuous monitoring — a point-in-time snapshot when you ask.',
        ar: '\u0643\u0644 \u0635\u0628\u0627\u062d\u060c \u0634\u063a\u0651\u0644 Claude Code \u0648\u0642\u0644 "\u0645\u0633\u062d \u0627\u0644\u0635\u0628\u0627\u062d". \u0627\u0644\u0630\u0643\u0627\u0621 \u064a\u062c\u0644\u0628 \u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a A+ \u0648\u064a\u0639\u0637\u064a\u0643 \u0645\u0644\u062e\u0635\u0627\u064b \u0641\u064a 30 \u062b\u0627\u0646\u064a\u0629.',
        es: 'Cada mañana, abre Claude Code y di "scan matutino". La IA obtiene los picks A+ del día y te da un briefing en 30 segundos.',
        zh: '\u6bcf\u5929\u65e9\u4e0a\u6253\u5f00 Claude Code \u8bf4 "morning scan"\u3002AI \u83b7\u53d6\u4eca\u65e5 A+ \u7cbe\u9009\u548c\u5e02\u573a\u72b6\u6001\uff0c30\u79d2\u5185\u7ed9\u4f60\u7b80\u62a5\u3002'
      }),
      files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', '.cursorrules', 'GEMINI.md', 'AGENTS.md', '.windsurfrules']
    },
    {
      id: 'deep-analysis',
      icon: '\ud83d\udd2c',
      title: 'Deep Analysis',
      sub: t({
        fr: '"analyse AVGO" → recherche multi-source → plan de trade',
        en: '"analyze AVGO" → multi-source research → trade plan',
        ar: '"analyze AVGO" → \u0628\u062d\u062b \u0645\u062a\u0639\u062f\u062f \u0627\u0644\u0645\u0635\u0627\u062f\u0631 → \u062e\u0637\u0629 \u062a\u062f\u0627\u0648\u0644',
        es: '"analyze AVGO" → investigación multi-fuente → plan de trading',
        zh: '"analyze AVGO" → \u591a\u6e90\u7814\u7a76 → \u4ea4\u6613\u8ba1\u5212'
      }),
      desc: t({
        fr: 'Dis "analyse [TICKER]" et l\'IA fait une deep-dive complète : techniques, fondamentaux, sentiment, options, news. Génère un plan de trade avec entry/stop/TP et un score de confiance. Tu peux aussi demander un rapport EOD ou vérifier des conditions d\'alerte.',
        en: 'Say "analyze [TICKER]" and the AI runs a complete deep-dive: technicals, fundamentals, sentiment, options, news. Generates a trade plan with entry/stop/TP and a confidence score. You can also ask for an EOD report or check alert conditions.',
        ar: '\u0642\u0644 "analyze [TICKER]" \u0648\u0627\u0644\u0630\u0643\u0627\u0621 \u064a\u0642\u0648\u0645 \u0628\u062a\u062d\u0644\u064a\u0644 \u0634\u0627\u0645\u0644: \u0641\u0646\u064a\u060c \u0623\u0633\u0627\u0633\u064a\u060c \u0645\u0634\u0627\u0639\u0631\u060c \u062e\u064a\u0627\u0631\u0627\u062a\u060c \u0623\u062e\u0628\u0627\u0631. \u064a\u0646\u0634\u0626 \u062e\u0637\u0629 \u062a\u062f\u0627\u0648\u0644.',
        es: 'Di "analyze [TICKER]" y la IA hace un deep-dive completo: técnicos, fundamentales, sentimiento, opciones, noticias. Genera un plan de trading.',
        zh: '\u8bf4 "analyze [TICKER]"\uff0cAI \u8fdb\u884c\u5168\u9762\u6df1\u5ea6\u5206\u6790\uff1a\u6280\u672f\u9762\u3001\u57fa\u672c\u9762\u3001\u60c5\u7eea\u3001\u671f\u6743\u3001\u65b0\u95fb\u3002\u751f\u6210\u4ea4\u6613\u8ba1\u5212\u3002'
      }),
      files: ['CLAUDE.md', '.mcp.json', 'mcp-server/', '.cursorrules', 'GEMINI.md', 'AGENTS.md', '.windsurfrules']
    }
  ];

  // ═══════════════════════════════════════
  // WORKFLOW TEMPLATES
  // ═══════════════════════════════════════
  function tplMorningBriefing(tickers) {
    return '# DailyTickers \u2014 Morning Briefing \u2615\n\n' +
      '## Your Role\n' +
      'You are a concise morning market analyst. When the user says "morning scan" or "scan du matin",\n' +
      'you fetch live data and deliver a 30-second actionable briefing.\n\n' +
      '## Data Sources\n' +
      '### MCP Tools (primary)\n' +
      '- `get_watchlist` \u2014 Today\'s A+ scanner picks with entry/stop/TP\n' +
      '- `get_market_regime` \u2014 Current regime, VIX, DXY, fear/greed\n' +
      '- `get_scanner_performance` \u2014 Scanner hit rates and track record\n' +
      '- `get_earnings_calendar` \u2014 This week\'s earnings and macro events\n' +
      '- `search_articles` \u2014 Find relevant published analyses\n\n' +
      '### Supplementary\n' +
      '- WebSearch for breaking news (if available)\n' +
      '- `https://articles.dailytickers.com/mcp/watchlist.json` (direct fetch fallback)\n\n' +
      (tickers ? '## Custom Watchlist\n' + tickers + '\n\n' : '') +
      '## Morning Scan Workflow\n' +
      'When the user says "morning scan":\n\n' +
      '1. **Fetch** today\'s watchlist via `get_watchlist`\n' +
      '2. **Fetch** market regime via `get_market_regime`\n' +
      '3. **Fetch** earnings calendar via `get_earnings_calendar`\n' +
      '4. **Output** this briefing format:\n\n' +
      '```\n' +
      '\u2615 MORNING BRIEFING \u2014 [DATE]\n' +
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
      'Regime: [RISK-ON/OFF] | VIX: [X] | DXY: [X] | F&G: [X]\n\n' +
      '\ud83c\udfaf TODAY\'S BEST SETUPS:\n' +
      '1. $TICKER \u2014 $STRATEGY | Entry $X | R/R $X | Score $X/100\n' +
      '   Catalyst: $CATALYST\n' +
      '2. ...\n\n' +
      '\ud83d\udcc5 KEY EVENTS TODAY:\n' +
      '- [earnings / macro events]\n\n' +
      '\u26a0\ufe0f RISK FLAGS:\n' +
      '- [any elevated risks]\n' +
      '```\n\n' +
      '## Other Commands\n' +
      '- "Check [TICKER]" \u2014 quick price check vs planned entry\n' +
      '- "EOD report" \u2014 review all positions vs stops and targets\n' +
      '- "What\'s the scanner track record?" \u2014 fetch performance stats\n' +
      '- "Earnings this week?" \u2014 fetch earnings calendar\n\n' +
      '## Risk Rules\n' +
      '- Max 5% portfolio per position\n' +
      '- If VIX > 35: defensive only (no new longs)\n' +
      '- Stop losses are HARD \u2014 never move stops against the trade\n\n' +
      '## Anti-Hallucination\n' +
      '1. NEVER invent a price \u2014 say "checking..." if unknown\n' +
      '2. Every data point must come from MCP tools or verifiable sources\n' +
      '3. Distinguish FACTS (data) from OPINIONS (analysis)\n' +
      '4. NEVER guarantee returns\n' +
      '5. Always include: "This is not financial advice"\n';
  }

  function tplDeepAnalysis(tickers) {
    return '# DailyTickers \u2014 Deep Analysis \ud83d\udd2c\n\n' +
      '## Your Role\n' +
      'You are an institutional-grade equity analyst. When the user says "analyze [TICKER]",\n' +
      'you run a comprehensive multi-source analysis and generate a detailed trade plan.\n\n' +
      '## Data Sources\n' +
      '### MCP Tools (primary)\n' +
      '- `get_watchlist` \u2014 Check if ticker is in today\'s A+ picks\n' +
      '- `get_market_regime` \u2014 Market context for the analysis\n' +
      '- `get_pick_detail` \u2014 Detailed pick info if in scanner\n' +
      '- `get_scanner_performance` \u2014 Historical scanner accuracy\n' +
      '- `get_earnings_calendar` \u2014 Upcoming earnings for the ticker\n' +
      '- `search_articles` \u2014 Find our published analysis on this ticker\n\n' +
      '### Supplementary\n' +
      '- WebSearch for recent news, analyst ratings, insider transactions\n' +
      '- `https://articles.dailytickers.com/mcp/watchlist.json` (direct fetch fallback)\n\n' +
      (tickers ? '## Default Watchlist\n' + tickers + '\n\n' : '') +
      '## Analysis Framework\n' +
      'For each ticker, analyze:\n\n' +
      '### 1. Setup Validation\n' +
      '- Is the entry zone still valid? (current price vs planned entry)\n' +
      '- Has the pattern broken? (invalidation check)\n' +
      '- Volume confirmation? (above average = confirmed)\n\n' +
      '### 2. Multi-Source Deep Dive\n' +
      '- **Technicals:** RSI, MACD, EMAs, support/resistance, pattern analysis\n' +
      '- **Fundamentals:** P/E, revenue growth, margins, FCF, debt ratio\n' +
      '- **Sentiment:** analyst consensus, insider activity\n' +
      '- **News:** last 7 days catalyst scan\n' +
      '- **Options:** unusual activity, put/call ratio, implied move (if available)\n\n' +
      '### 3. Trade Plan\n' +
      '```\n' +
      '\ud83d\udccb TRADE PLAN: $TICKER\n' +
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
      'Setup: $STRATEGY\n' +
      'Entry: $ENTRY (limit order)\n' +
      'Stop: $STOP | Risk: $RISK%\n' +
      'TP1: $TP1 (+$GAIN1%) \u2014 take 50% profit\n' +
      'TP2: $TP2 (+$GAIN2%) \u2014 trail stop to breakeven\n' +
      'R/R: $RR\n' +
      'Position Size: $SIZE% of portfolio\n' +
      'Confidence: $SCORE/100\n\n' +
      '\u2705 Confirmations: [3 bullish signals]\n' +
      '\u274c Invalidations: [3 bearish signals]\n' +
      '\u23f0 Timing: [catalyst date, optimal entry window]\n' +
      '```\n\n' +
      '## Other Commands\n' +
      '- "Analyze today\'s picks" \u2014 run analysis on all A+ picks\n' +
      '- "Compare [TICKER1] vs [TICKER2]" \u2014 side-by-side\n' +
      '- "Check alert conditions" \u2014 scan for RSI < 30, volume spikes, regime changes\n' +
      '- "EOD report" \u2014 end-of-day P&L review\n' +
      '- "Earnings preview [TICKER]" \u2014 pre-earnings analysis\n\n' +
      '## Alert Conditions (check on demand)\n' +
      'When user says "check alerts", scan these conditions:\n' +
      '- RSI(14) < 30 on any watchlist ticker (oversold entry)\n' +
      '- Price enters entry zone (\u00b11% of planned entry)\n' +
      '- Volume > 2x 20-day average (unusual activity)\n' +
      '- VIX > 25 (risk-off warning)\n' +
      '- Insider buy detected > $100K last 7 days\n' +
      '- Earnings within 3 trading days\n\n' +
      '## Anti-Hallucination\n' +
      '1. NEVER invent a price \u2014 say "checking..." if unknown\n' +
      '2. Every data point must come from MCP tools or verifiable sources\n' +
      '3. Distinguish FACTS (data) from OPINIONS (analysis)\n' +
      '4. NEVER guarantee returns\n' +
      '5. Always include: "This is not financial advice"\n';
  }

  var TEMPLATE_MAP = {
    'morning-briefing': tplMorningBriefing,
    'deep-analysis': tplDeepAnalysis
  };

  // ═══════════════════════════════════════
  // MCP SERVER v2.0 — loaded from bundle
  // Bundle generated by: node tools/bundle-mcp-server.js
  // Contains 24 files: index.js, package.json, lib/*.js
  // ═══════════════════════════════════════
  var MCP_SERVER_BUNDLE = null; // loaded async at page init

  function loadMcpBundle() {
    return fetch('/prompt-ia/mcp-server-bundle.json')
      .then(function(res) { return res.json(); })
      .then(function(data) { MCP_SERVER_BUNDLE = data; })
      .catch(function(err) { console.warn('MCP bundle load failed:', err); });
  }
  // Start loading immediately
  loadMcpBundle();

  var MCP_DOT_JSON = function(serverPath) {
    return JSON.stringify({
      mcpServers: {
        "dailytickers": {
          command: "node",
          args: [serverPath]
        }
      }
    }, null, 2);
  };

  // ═══════════════════════════════════════
  // README
  // ═══════════════════════════════════════
  function generateReadme(workflow, tickers) {
    var wf = WORKFLOWS.find(function(w) { return w.id === workflow; });
    return '# ' + wf.icon + ' ' + wf.title + ' \u2014 DailyTickers AI Agent\n\n' +
      wf.desc + '\n\n' +
      '## Quick Start (3 steps)\n\n' +
      '```bash\n' +
      '# 1. Install the MCP server\n' +
      'cd mcp-server && npm install && cd ..\n\n' +
      '# 2. Open folder in your AI tool\n' +
      'claude              # Claude Code (auto-detects .mcp.json)\n' +
      '# or open in Cursor  (auto-detects .cursorrules)\n' +
      '# or open in Windsurf (auto-detects .windsurfrules)\n\n' +
      '# 3. Say:\n' +
      (workflow === 'morning-briefing' ? '#    "morning scan"\n' : '#    "analyze [TICKER]"\n') +
      '```\n\n' +
      '## MCP Server Tools\n\n' +
      '| Tool | Description |\n' +
      '|------|-------------|\n' +
      '| `get_watchlist` | Today\'s A+ picks with entry/stop/TP |\n' +
      '| `get_market_regime` | Regime, VIX, DXY, fear/greed |\n' +
      '| `get_pick_detail` | Deep info on a specific pick |\n' +
      '| `get_scanner_performance` | Scanner track record & hit rates |\n' +
      '| `get_earnings_calendar` | This week\'s earnings & macro events |\n' +
      '| `search_articles` | Search 250+ published analyses |\n' +
      '| `get_article_list` | List latest articles by type |\n\n' +
      '## Data Updates\n' +
      'DailyTickers data updates **daily at 23:00 UTC**. The MCP server fetches live from\n' +
      '`articles.dailytickers.com` — no API key needed.\n\n' +
      '## Compatible Tools\n' +
      '- **Claude Code** — `.mcp.json` + `CLAUDE.md` (best experience)\n' +
      '- **Cursor** — `.cursorrules`\n' +
      '- **Windsurf** — `.windsurfrules`\n' +
      '- **Gemini CLI** — `GEMINI.md`\n' +
      '- **Codex CLI** — `AGENTS.md`\n' +
      '- **ChatGPT / Gemini web** — Copy `CLAUDE.md` as system prompt\n\n' +
      '---\n*This is not financial advice. Always do your own research.*\n';
  }

  // ═══════════════════════════════════════
  // ZIP GENERATION
  // ═══════════════════════════════════════
  function generateFiles(workflow, tickers) {
    var claudeMd = TEMPLATE_MAP[workflow](tickers);
    var files = [
      { name: 'CLAUDE.md', content: claudeMd },
      { name: '.mcp.json', content: MCP_DOT_JSON('./mcp-server/index.js') },
      { name: '.cursorrules', content: claudeMd },
      { name: '.windsurfrules', content: claudeMd },
      { name: 'GEMINI.md', content: claudeMd },
      { name: 'AGENTS.md', content: claudeMd },
      { name: 'README.md', content: generateReadme(workflow, tickers) }
    ];

    // Inject full MCP Server v2.0 from bundle (24 files: Yahoo, Binance, Webull, screener, etc.)
    if (MCP_SERVER_BUNDLE) {
      Object.keys(MCP_SERVER_BUNDLE).forEach(function(path) {
        files.push({ name: path, content: MCP_SERVER_BUNDLE[path] });
      });
    }

    return files;
  }

  function downloadProject(workflow, tickers) {
    // Ensure MCP bundle is loaded before generating ZIP
    if (!MCP_SERVER_BUNDLE) {
      loadMcpBundle().then(function() { downloadProject(workflow, tickers); });
      return;
    }

    var files = generateFiles(workflow, tickers);

    if (typeof JSZip !== 'undefined') {
      var zip = new JSZip();
      var folder = zip.folder(workflow);
      files.forEach(function(f) { folder.file(f.name, f.content); });
      zip.generateAsync({ type: 'blob' }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = workflow + '.zip'; a.click();
        URL.revokeObjectURL(url);
      });
      return;
    }

    // Fallback
    var combined = files.map(function(f) {
      return '# FILE: ' + f.name + '\n\n' + f.content;
    }).join('\n\n---\n\n');
    var blob = new Blob([combined], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = workflow + '-project.md'; a.click();
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════
  // LIVE PREVIEW — fetch & render watchlist.json
  // ═══════════════════════════════════════
  var liveData = null;

  function fetchLiveData() {
    var url = 'https://articles.dailytickers.com/mcp/watchlist.json';
    fetch(url).then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function(data) {
      liveData = data;
      renderLivePreview(data);
    }).catch(function() {
      var el = document.getElementById('livePreviewContent');
      if (el) el.innerHTML = '<p style="text-align:center;color:#94a3b8;font-size:.78rem">' + L.errorData + '</p>';
    });
  }

  function regimeColor(regime) {
    if (!regime) return '#64748b';
    var r = regime.toUpperCase();
    if (r.indexOf('RISK-OFF') >= 0) return '#ef4444';
    if (r.indexOf('RISK-ON') >= 0) return '#10b981';
    return '#f59e0b';
  }

  function renderLivePreview(data) {
    var el = document.getElementById('livePreviewContent');
    if (!el) return;

    var html = '<div class="live-metrics">';
    html += '<div class="live-metric"><span class="live-metric-label">' + L.regime + '</span>';
    html += '<span class="live-metric-value" style="color:' + regimeColor(data.regime) + '">' + (data.regime || '?') + '</span></div>';
    html += '<div class="live-metric"><span class="live-metric-label">' + L.vixLabel + '</span>';
    html += '<span class="live-metric-value">' + (data.vix || '?') + '</span></div>';
    html += '<div class="live-metric"><span class="live-metric-label">' + L.spxLabel + '</span>';
    html += '<span class="live-metric-value">' + (data.spx ? data.spx.toLocaleString() : '?') + '</span></div>';
    html += '<div class="live-metric"><span class="live-metric-label">' + L.fearGreed + '</span>';
    html += '<span class="live-metric-value">' + (data.fear_greed || '?') + '/100</span></div>';
    html += '</div>';

    if (data.picks && data.picks.length > 0) {
      html += '<iframe src="/widget/?mode=vertical" class="live-widget-iframe" title="A+ Picks"></iframe>';
    }

    if (data.updated) {
      var date = new Date(data.updated);
      html += '<div class="live-updated">' + L.updated + ': ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</div>';
    }

    el.innerHTML = html;
  }

  // ═══════════════════════════════════════
  // HELP MODAL
  // ═══════════════════════════════════════
  function showHelpModal() {
    var html = '<div class="help-overlay" id="helpOverlay" onclick="if(event.target===this)window._closeHelp()">';
    html += '<div class="help-dialog">';
    html += '<div class="help-dialog-header"><h3><i class="fa-solid fa-circle-question"></i> ' + L.helpTitle + '</h3>';
    html += '<button class="help-dialog-close" onclick="window._closeHelp()" type="button"><i class="fa-solid fa-xmark"></i></button></div>';
    html += '<div class="help-dialog-body">' + L.helpBody + '</div>';
    html += '<div class="help-dialog-footer"><button onclick="window._closeHelp()">' + L.helpClose + '</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  window._closeHelp = function() {
    var overlay = document.getElementById('helpOverlay');
    if (overlay) overlay.remove();
  };

  window._showHelp = function() { showHelpModal(); };

  // ═══════════════════════════════════════
  // RENDER AGENT PANEL (now the only mode panel for Agent + Factory merged)
  // ═══════════════════════════════════════
  var selectedWorkflow = null;

  function renderAgentPanel() {
    var panel = document.getElementById('panelAgent');
    if (!panel) return;

    var html = '';

    // Live Preview
    html += '<div class="live-preview-card" id="livePreviewCard">';
    html += '<div class="live-preview-header"><h3><i class="fa-solid fa-signal"></i> ' + L.liveTitle + '</h3>';
    html += '<button class="help-btn" type="button" onclick="window._showHelp()" title="?">?</button></div>';
    html += '<p class="live-preview-sub">' + L.liveSub + '</p>';
    html += '<div id="livePreviewContent"><p style="text-align:center;color:#94a3b8;font-size:.78rem;padding:1rem 0"><i class="fa-solid fa-spinner fa-spin"></i> ' + L.noData + '</p></div>';
    html += '</div>';

    // Intro
    html += '<p class="lib-intro" style="margin-top:1rem">' + L.agentIntro + '</p>';

    // Workflow cards (just 2)
    html += '<div class="wf-grid wf-grid-2">';
    WORKFLOWS.forEach(function(wf) {
      html += '<button class="wf-card" data-wf="' + wf.id + '" type="button">';
      html += '<span class="wf-icon">' + wf.icon + '</span>';
      html += '<span class="wf-title">' + wf.title + '</span>';
      html += '<span class="wf-sub">' + wf.sub + '</span>';
      html += '</button>';
    });
    html += '</div>';

    // Chrome Extension card
    html += '<div class="ext-card" style="margin-top:1.25rem;background:linear-gradient(135deg,#1e3a5f 0%,#1a2e4a 100%);border:1px solid #2d5a8e;border-radius:12px;padding:1.25rem 1.5rem">';
    html += '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.6rem">';
    html += '<span style="font-size:1.5rem">🧩</span>';
    html += '<div><div style="font-weight:700;font-size:.95rem;color:#e2e8f0">' + (L.extTitle || 'Chrome Extension') + '</div>';
    html += '<div style="font-size:.75rem;color:#94a3b8;margin-top:.1rem">' + (L.extSub || '') + '</div></div>';
    html += '<a href="/mcp/#extension" target="_blank" style="margin-left:auto;flex-shrink:0;background:#3b82f6;color:#fff;font-size:.75rem;font-weight:600;padding:.4rem .9rem;border-radius:6px;text-decoration:none;white-space:nowrap">' + (L.extInstall || 'Install') + '</a>';
    html += '</div>';
    html += '<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:.75rem 1rem;margin-top:.5rem">';
    html += '<ol style="margin:0;padding-left:1.2rem;font-size:.76rem;color:#cbd5e1;line-height:1.8">';
    html += '<li>' + (L.extStep1 || '') + '</li>';
    html += '<li>' + (L.extStep2 || '') + '</li>';
    html += '<li>' + (L.extStep3 || '') + '</li>';
    html += '</ol>';
    html += '</div>';
    html += '<div style="margin-top:.6rem;font-size:.7rem;color:#64748b">' + (L.extSites || '') + '</div>';
    html += '</div>';

    // Config area
    html += '<div class="wf-config" id="wfConfig" style="display:none">';
    html += '<div class="wf-config-header">';
    html += '<span class="wf-config-icon" id="wfConfigIcon"></span>';
    html += '<div><div class="wf-config-title" id="wfConfigTitle"></div>';
    html += '<div class="wf-config-desc" id="wfConfigDesc"></div></div>';
    html += '</div>';

    // Data source switch (3-way)
    html += '<div class="fg"><div class="fl"><i class="fa-solid fa-database"></i> ' + L.dataSource + '</div>';
    html += '<div class="src-switch" id="wfSrcSwitch">';
    html += '<button type="button" class="src-opt active" data-src="scanner"><i class="fa-solid fa-crosshairs"></i> ' + L.srcScanner + '</button>';
    html += '<button type="button" class="src-opt" data-src="auto"><i class="fa-solid fa-wand-magic-sparkles"></i> ' + L.srcAuto + '</button>';
    html += '<button type="button" class="src-opt" data-src="custom"><i class="fa-solid fa-pen"></i> ' + L.srcCustom + '</button>';
    html += '</div>';
    html += '<input type="text" class="fi" id="wfTickers" placeholder="' + L.watchlistPh + '" style="display:none"></div>';

    html += '<div class="wf-config-files" id="wfConfigFiles"></div>';

    html += '<div class="wf-actions">';
    html += '<button class="gen-btn" id="wfGenerateBtn" type="button" onclick="window._generateAgent()">';
    html += '<i class="fa-solid fa-wand-magic-sparkles"></i> ' + L.generate + '</button>';
    html += '</div></div>';

    // Post-download area (how-to + copy option)
    html += '<div class="wf-output" id="wfOutput" style="display:none">';
    html += '<div class="wf-howto"><div class="pedagogy-box"><h4><i class="fa-solid fa-graduation-cap"></i> ' + L.howTo + '</h4>';
    html += '<ol><li>' + L.howToStep1 + '</li>';
    html += '<li>' + L.howToStep2 + '</li>';
    html += '<li>' + L.howToStep3 + '</li></ol>';
    html += '</div></div>';
    html += '<div class="wf-output-actions">';
    html += '<button class="action-btn" onclick="window._copyAgent()"><i class="fa-solid fa-copy"></i> ' + L.copy + '</button>';
    html += '</div></div>';

    panel.innerHTML = html;

    // Attach card click listeners
    panel.querySelectorAll('.wf-card').forEach(function(card) {
      card.addEventListener('click', function() { selectWorkflow(this.dataset.wf); });
    });

    // Init source switch
    initSrcSwitch('wfSrcSwitch', 'wfTickers');

    // Fetch live data
    fetchLiveData();
  }

  // ═══════════════════════════════════════
  // SOURCE SWITCH (A+ Picks / Auto-Screener / Custom)
  // ═══════════════════════════════════════
  function initSrcSwitch(switchId, inputId) {
    var switchEl = document.getElementById(switchId);
    var inputEl = document.getElementById(inputId);
    if (!switchEl || !inputEl) return;

    switchEl.querySelectorAll('.src-opt').forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchEl.querySelectorAll('.src-opt').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        inputEl.style.display = btn.dataset.src === 'custom' ? '' : 'none';
        if (btn.dataset.src === 'custom') inputEl.focus();
      });
    });
  }

  function getSourceTickers() {
    var switchEl = document.getElementById('wfSrcSwitch');
    if (!switchEl) return null;
    var active = switchEl.querySelector('.src-opt.active');
    if (!active) return null;
    var src = active.dataset.src;

    if (src === 'custom') {
      var val = document.getElementById('wfTickers').value.trim();
      return val || null;
    }
    if (src === 'scanner' && liveData && liveData.picks) {
      return liveData.picks.map(function(p) { return p.ticker; }).join(', ');
    }
    // 'auto' = no tickers specified, agent uses RunAutoScreener
    return null;
  }

  function selectWorkflow(id) {
    var wf = WORKFLOWS.find(function(w) { return w.id === id; });
    if (!wf) return;
    selectedWorkflow = id;

    document.querySelectorAll('.wf-card').forEach(function(c) {
      c.classList.toggle('active', c.dataset.wf === id);
    });

    var config = document.getElementById('wfConfig');
    config.style.display = '';
    document.getElementById('wfConfigIcon').textContent = wf.icon;
    document.getElementById('wfConfigTitle').textContent = wf.title;
    document.getElementById('wfConfigDesc').textContent = wf.desc;

    var filesHtml = '<div class="fl"><i class="fa-solid fa-folder-open"></i> ' + L.includes + '</div>';
    filesHtml += '<div class="wf-files-list">';
    wf.files.forEach(function(f) {
      var icon = f.endsWith('/') ? 'fa-folder' : f.endsWith('.md') ? 'fa-file-lines' : 'fa-file-code';
      filesHtml += '<span class="wf-file-badge"><i class="fa-solid ' + icon + '"></i> ' + f + '</span>';
    });
    filesHtml += '</div>';
    document.getElementById('wfConfigFiles').innerHTML = filesHtml;

    document.getElementById('wfOutput').style.display = 'none';
    config.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  window._generateAgent = function() {
    if (!selectedWorkflow) return;
    var tickers = getSourceTickers();
    downloadProject(selectedWorkflow, tickers);
    // Show how-to after download
    var output = document.getElementById('wfOutput');
    if (output) {
      output.style.display = '';
      setTimeout(function() { output.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 300);
    }
  };

  window._copyAgent = function() {
    if (!selectedWorkflow) return;
    var tickers = getSourceTickers();
    var claudeMd = TEMPLATE_MAP[selectedWorkflow](tickers);
    navigator.clipboard.writeText(claudeMd).then(function() {
      if (typeof showCopySuccess === 'function') showCopySuccess('CLAUDE.md');
    });
  };

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function() {
    renderAgentPanel();

    // Factory panel is now merged into Agent — hide the Factory tab button
    var factoryBtn = document.getElementById('modeFactoryBtn');
    if (factoryBtn) factoryBtn.style.display = 'none';
  });

})();
