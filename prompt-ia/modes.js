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
      generate: 'Generate Project', download: 'Download ZIP', copy: 'Copy CLAUDE.md',
      includes: 'Project includes', howTo: 'How to use',
      howToStep1: 'Unzip the project folder',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: 'Open folder in <strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong>, or <strong>Codex CLI</strong> — config files auto-detected',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: 'Custom tickers',
      tickersOpt: 'optional — defaults to scanner picks',
      helpTitle: 'How does this work?',
      helpBody: '<p>This generates a <strong>complete project folder</strong> that transforms your AI coding tool into a financial assistant.</p><h4>What you get:</h4><ul><li><strong>CLAUDE.md / .cursorrules / GEMINI.md</strong> — Instructions that tell the AI what to do</li><li><strong>MCP Server</strong> — A local server that connects your AI to <strong>live Market Watch data</strong> (A+ picks, regime, VIX, 250+ articles)</li><li><strong>.mcp.json</strong> — Auto-configuration. Claude Code detects it instantly.</li></ul><h4>What it actually does:</h4><ul><li><strong>Morning Briefing:</strong> Run <code>claude</code> and say "morning scan" — the AI fetches today\'s picks and gives you a 30-second briefing</li><li><strong>Deep Analysis:</strong> Say "analyze AVGO" — multi-source research with trade plan</li><li><strong>Custom Alerts:</strong> Say "check alert conditions" — the AI checks your rules against live data</li></ul><h4>Be honest about limits:</h4><ul><li>The AI checks data <strong>when you ask it to</strong>, not continuously in the background</li><li>Market Watch data updates <strong>daily at 23:00 UTC</strong>, not in real-time</li><li>For real-time alerts, you need a proper alerting service — this is an <strong>analysis assistant</strong></li></ul><h4>Compatible with:</h4><p><strong>Claude Code</strong> (best — full MCP), <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong>, <strong>Codex CLI</strong>. For ChatGPT/Gemini web: copy CLAUDE.md as system prompt.</p>',
      helpClose: 'Got it',
      noData: 'Loading live data...',
      errorData: 'Could not load live data'
    },
    fr: {
      liveTitle: 'Aperçu des Données Live',
      liveSub: 'Ce sont les vraies données que ton agent IA va utiliser via MCP.',
      regime: 'Régime', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: 'Fear/Greed', picks: 'Picks A+', updated: 'Mis à jour',
      entry: 'Entrée', stop: 'Stop', tp1: 'TP1', score: 'Score',
      agentIntro: 'Choisis un workflow. Télécharge un projet prêt à l\'emploi pour ton outil IA.',
      generate: 'Générer le Projet', download: 'Télécharger ZIP', copy: 'Copier CLAUDE.md',
      includes: 'Le projet contient', howTo: 'Comment utiliser',
      howToStep1: 'Décompresse le dossier',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: 'Ouvre le dossier dans <strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong> ou <strong>Codex CLI</strong> — fichiers de config auto-détectés',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: 'Tickers personnalisés',
      tickersOpt: 'optionnel — par défaut les picks du scanner',
      helpTitle: 'Comment ça marche ?',
      helpBody: '<p>Ceci génère un <strong>dossier projet complet</strong> qui transforme ton outil IA en assistant financier.</p><h4>Ce que tu obtiens :</h4><ul><li><strong>CLAUDE.md / .cursorrules / GEMINI.md</strong> — Instructions qui disent à l\'IA quoi faire</li><li><strong>Serveur MCP</strong> — Un serveur local qui connecte ton IA aux <strong>données live Market Watch</strong> (picks A+, régime, VIX, 250+ articles)</li><li><strong>.mcp.json</strong> — Auto-configuration. Claude Code le détecte instantanément.</li></ul><h4>Ce que ça fait concrètement :</h4><ul><li><strong>Briefing matinal :</strong> Lance <code>claude</code> et dis "scan du matin" — l\'IA fetch les picks du jour et te brief en 30 secondes</li><li><strong>Analyse approfondie :</strong> Dis "analyse AVGO" — recherche multi-source avec plan de trade</li><li><strong>Alertes personnalisées :</strong> Dis "vérifie les conditions d\'alerte" — l\'IA vérifie tes règles contre les données live</li></ul><h4>Soyons honnêtes :</h4><ul><li>L\'IA vérifie les données <strong>quand tu le demandes</strong>, pas en continu en arrière-plan</li><li>Les données Market Watch sont mises à jour <strong>quotidiennement à 23:00 UTC</strong>, pas en temps réel</li><li>Pour des alertes temps réel, il faut un service d\'alertes dédié — ceci est un <strong>assistant d\'analyse</strong></li></ul><h4>Compatible avec :</h4><p><strong>Claude Code</strong> (idéal — MCP complet), <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong>, <strong>Codex CLI</strong>. Pour ChatGPT/Gemini web : copie le CLAUDE.md comme prompt système.</p>',
      helpClose: 'Compris',
      noData: 'Chargement des données live...',
      errorData: 'Impossible de charger les données live'
    },
    ar: {
      liveTitle: '\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062d\u064a\u0629',
      liveSub: '\u0647\u0630\u0647 \u0647\u064a \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062d\u0642\u064a\u0642\u064a\u0629 \u0627\u0644\u062a\u064a \u0633\u064a\u0635\u0644 \u0625\u0644\u064a\u0647\u0627 \u0648\u0643\u064a\u0644\u0643 \u0627\u0644\u0630\u0643\u064a \u0639\u0628\u0631 MCP.',
      regime: '\u0627\u0644\u0646\u0638\u0627\u0645', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: '\u062e\u0648\u0641/\u0637\u0645\u0639', picks: '\u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a A+', updated: '\u0645\u062d\u062f\u0651\u062b',
      entry: '\u062f\u062e\u0648\u0644', stop: '\u0648\u0642\u0641', tp1: 'TP1', score: '\u0646\u0642\u0627\u0637',
      agentIntro: '\u0627\u062e\u062a\u0631 \u0633\u064a\u0631 \u0639\u0645\u0644. \u062d\u0645\u0651\u0644 \u0645\u0634\u0631\u0648\u0639\u0627\u064b \u062c\u0627\u0647\u0632\u0627\u064b \u0644\u0623\u062f\u0627\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a.',
      generate: '\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0634\u0631\u0648\u0639', download: '\u062a\u062d\u0645\u064a\u0644 ZIP', copy: '\u0646\u0633\u062e CLAUDE.md',
      includes: '\u064a\u062a\u0636\u0645\u0651\u0646 \u0627\u0644\u0645\u0634\u0631\u0648\u0639', howTo: '\u0643\u064a\u0641\u064a\u0629 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645',
      howToStep1: '\u0641\u0643\u0651 \u0636\u063a\u0637 \u0627\u0644\u0645\u062c\u0644\u062f',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: '\u0627\u0641\u062a\u062d \u0627\u0644\u0645\u062c\u0644\u062f \u0641\u064a <strong>Claude Code</strong>\u060c <strong>Cursor</strong>\u060c <strong>Windsurf</strong>\u060c <strong>Gemini CLI</strong> \u0623\u0648 <strong>Codex CLI</strong>',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: '\u0631\u0645\u0648\u0632 \u0645\u062e\u0635\u0635\u0629',
      tickersOpt: '\u0627\u062e\u062a\u064a\u0627\u0631\u064a \u2014 \u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0627\u064b \u0627\u062e\u062a\u064a\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u0627\u0633\u062d',
      helpTitle: '\u0643\u064a\u0641 \u064a\u0639\u0645\u0644\u061f',
      helpBody: '<p>\u064a\u0646\u0634\u0626 <strong>\u0645\u062c\u0644\u062f \u0645\u0634\u0631\u0648\u0639 \u0643\u0627\u0645\u0644</strong> \u064a\u062d\u0648\u0651\u0644 \u0623\u062f\u0627\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0625\u0644\u0649 \u0645\u0633\u0627\u0639\u062f \u0645\u0627\u0644\u064a.</p><h4>\u0645\u0627 \u062a\u062d\u0635\u0644 \u0639\u0644\u064a\u0647:</h4><ul><li><strong>CLAUDE.md</strong> \u2014 \u062a\u0639\u0644\u064a\u0645\u0627\u062a \u0644\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a</li><li><strong>\u062e\u0627\u062f\u0645 MCP</strong> \u2014 \u064a\u0631\u0628\u0637 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0628\u0628\u064a\u0627\u0646\u0627\u062a Market Watch \u0627\u0644\u062d\u064a\u0629</li></ul><h4>\u0645\u0627 \u064a\u0641\u0639\u0644\u0647 \u0641\u0639\u0644\u064a\u0627\u064b:</h4><ul><li><strong>\u0645\u0644\u062e\u0635 \u0635\u0628\u0627\u062d\u064a:</strong> \u0634\u063a\u0651\u0644 <code>claude</code> \u0648\u0642\u0644 "\u0645\u0633\u062d \u0627\u0644\u0635\u0628\u0627\u062d" \u2014 \u0645\u0644\u062e\u0635 \u0641\u064a 30 \u062b\u0627\u0646\u064a\u0629</li><li><strong>\u062a\u062d\u0644\u064a\u0644 \u0639\u0645\u064a\u0642:</strong> \u0642\u0644 "analyze AVGO" \u2014 \u0628\u062d\u062b \u0645\u062a\u0639\u062f\u062f \u0627\u0644\u0645\u0635\u0627\u062f\u0631</li></ul><h4>\u0627\u0644\u062d\u062f\u0648\u062f:</h4><ul><li>\u0627\u0644\u0630\u0643\u0627\u0621 \u064a\u062a\u062d\u0642\u0642 <strong>\u0639\u0646\u062f\u0645\u0627 \u062a\u0637\u0644\u0628</strong>\u060c \u0644\u064a\u0633 \u0628\u0627\u0633\u062a\u0645\u0631\u0627\u0631</li><li>\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u062a\u062a\u062d\u062f\u062b <strong>\u064a\u0648\u0645\u064a\u0627\u064b \u0627\u0644\u0633\u0627\u0639\u0629 23:00 UTC</strong></li></ul>',
      helpClose: '\u0641\u0647\u0645\u062a',
      noData: '\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a...',
      errorData: '\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a'
    },
    es: {
      liveTitle: 'Vista Previa de Datos en Vivo',
      liveSub: 'Estos son los datos reales que tu agente IA accederá via MCP.',
      regime: 'Régimen', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: 'Miedo/Codicia', picks: 'Picks A+', updated: 'Actualizado',
      entry: 'Entrada', stop: 'Stop', tp1: 'TP1', score: 'Puntos',
      agentIntro: 'Elige un flujo de trabajo. Descarga un proyecto listo para tu herramienta IA.',
      generate: 'Generar Proyecto', download: 'Descargar ZIP', copy: 'Copiar CLAUDE.md',
      includes: 'El proyecto incluye', howTo: 'Cómo usar',
      howToStep1: 'Descomprime la carpeta',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: 'Abre la carpeta en <strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong>, <strong>Gemini CLI</strong> o <strong>Codex CLI</strong>',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: 'Tickers personalizados',
      tickersOpt: 'opcional — por defecto los picks del scanner',
      helpTitle: '¿Cómo funciona?',
      helpBody: '<p>Genera una <strong>carpeta de proyecto completa</strong> que transforma tu herramienta IA en asistente financiero.</p><h4>Lo que obtienes:</h4><ul><li><strong>CLAUDE.md</strong> — Instrucciones para la IA</li><li><strong>Servidor MCP</strong> — Conecta la IA a datos en vivo de Market Watch</li></ul><h4>Lo que hace:</h4><ul><li><strong>Briefing matutino:</strong> Ejecuta <code>claude</code> y di "morning scan" — resumen en 30 segundos</li><li><strong>Análisis profundo:</strong> Di "analyze AVGO" — investigación multi-fuente</li></ul><h4>Limitaciones:</h4><ul><li>La IA verifica <strong>cuando tú lo pides</strong>, no continuamente</li><li>Datos actualizados <strong>diariamente a las 23:00 UTC</strong></li></ul>',
      helpClose: 'Entendido',
      noData: 'Cargando datos en vivo...',
      errorData: 'No se pudieron cargar los datos'
    },
    zh: {
      liveTitle: '\u5b9e\u65f6\u6570\u636e\u9884\u89c8',
      liveSub: '\u8fd9\u662f\u4f60\u7684 AI \u4ee3\u7406\u901a\u8fc7 MCP \u8bbf\u95ee\u7684\u771f\u5b9e\u6570\u636e\u3002',
      regime: '\u5e02\u573a\u5236\u5ea6', vixLabel: 'VIX', dxyLabel: 'DXY', spxLabel: 'S&P 500',
      fearGreed: '\u6050\u60e7/\u8d2a\u5a6a', picks: 'A+ \u7cbe\u9009', updated: '\u66f4\u65b0\u65f6\u95f4',
      entry: '\u5165\u573a', stop: '\u6b62\u635f', tp1: 'TP1', score: '\u5206\u6570',
      agentIntro: '\u9009\u62e9\u5de5\u4f5c\u6d41\u3002\u4e0b\u8f7d\u9002\u7528\u4e8e\u4f60 AI \u5de5\u5177\u7684\u5373\u7528\u9879\u76ee\u3002',
      generate: '\u751f\u6210\u9879\u76ee', download: '\u4e0b\u8f7d ZIP', copy: '\u590d\u5236 CLAUDE.md',
      includes: '\u9879\u76ee\u5305\u542b', howTo: '\u5982\u4f55\u4f7f\u7528',
      howToStep1: '\u89e3\u538b\u6587\u4ef6\u5939',
      howToStep2: '<code>cd mcp-server && npm install && cd ..</code>',
      howToStep3: '\u5728 <strong>Claude Code</strong>\u3001<strong>Cursor</strong>\u3001<strong>Windsurf</strong>\u3001<strong>Gemini CLI</strong> \u6216 <strong>Codex CLI</strong> \u4e2d\u6253\u5f00\u6587\u4ef6\u5939',
      watchlistPh: 'AAPL, NVDA, BTC-USD...',
      tickersLabel: '\u81ea\u5b9a\u4e49\u80a1\u7968',
      tickersOpt: '\u53ef\u9009 \u2014 \u9ed8\u8ba4\u4f7f\u7528\u626b\u63cf\u5668\u7cbe\u9009',
      helpTitle: '\u8fd9\u662f\u5982\u4f55\u5de5\u4f5c\u7684\uff1f',
      helpBody: '<p>\u751f\u6210\u4e00\u4e2a<strong>\u5b8c\u6574\u7684\u9879\u76ee\u6587\u4ef6\u5939</strong>\uff0c\u5c06\u4f60\u7684 AI \u5de5\u5177\u53d8\u6210\u91d1\u878d\u52a9\u624b\u3002</p><h4>\u4f60\u5c06\u83b7\u5f97\uff1a</h4><ul><li><strong>CLAUDE.md</strong> \u2014 AI \u6307\u4ee4\u6587\u4ef6</li><li><strong>MCP \u670d\u52a1\u5668</strong> \u2014 \u8fde\u63a5 AI \u5230 Market Watch \u5b9e\u65f6\u6570\u636e</li></ul><h4>\u5b9e\u9645\u529f\u80fd\uff1a</h4><ul><li><strong>\u665a\u95f4\u7b80\u62a5\uff1a</strong>\u8fd0\u884c <code>claude</code> \u8bf4 "morning scan" \u2014 30\u79d2\u7b80\u62a5</li><li><strong>\u6df1\u5ea6\u5206\u6790\uff1a</strong>\u8bf4 "analyze AVGO" \u2014 \u591a\u6e90\u7814\u7a76</li></ul><h4>\u9650\u5236\uff1a</h4><ul><li>AI <strong>\u5728\u4f60\u8981\u6c42\u65f6</strong>\u68c0\u67e5\uff0c\u4e0d\u662f\u6301\u7eed\u76d1\u63a7</li><li>\u6570\u636e<strong>\u6bcf\u65e5 23:00 UTC \u66f4\u65b0</strong></li></ul>',
      helpClose: '\u660e\u767d\u4e86',
      noData: '\u6b63\u5728\u52a0\u8f7d\u5b9e\u65f6\u6570\u636e...',
      errorData: '\u65e0\u6cd5\u52a0\u8f7d\u5b9e\u65f6\u6570\u636e'
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
    return '# Market Watch \u2014 Morning Briefing \u2615\n\n' +
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
      '- `https://articles.market-watch.xyz/mcp/watchlist.json` (direct fetch fallback)\n\n' +
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
    return '# Market Watch \u2014 Deep Analysis \ud83d\udd2c\n\n' +
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
      '- `https://articles.market-watch.xyz/mcp/watchlist.json` (direct fetch fallback)\n\n' +
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
  // MCP SERVER FILES (embedded for ZIP)
  // ═══════════════════════════════════════
  var MCP_SERVER_INDEX = [
    '#!/usr/bin/env node',
    '',
    '/**',
    ' * Market Watch MCP Server',
    ' * Exposes live Market Watch data to AI agents.',
    ' * Data fetched from articles.market-watch.xyz.',
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
    "const server = new McpServer({ name: 'market-watch', version: '1.1.0' });",
    '',
    "server.tool('get_watchlist', \"Get today's A+ scanner picks with entry/stop/TP, market regime, and alerts.\", {}, async () => {",
    '  const data = await fetchJSON(`${MCP_URL}/watchlist.json`);',
    "  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };",
    '});',
    '',
    "server.tool('get_market_regime', 'Get current market regime, VIX, DXY, S&P 500, fear/greed.', {}, async () => {",
    '  const data = await fetchJSON(`${MCP_URL}/watchlist.json`);',
    "  return { content: [{ type: 'text', text: JSON.stringify({ regime: data.regime, vix: data.vix, dxy: data.dxy, us10y: data.us10y, spx: data.spx, fear_greed: data.fear_greed, alerts: data.alerts, updated: data.updated }, null, 2) }] };",
    '});',
    '',
    "server.tool('get_pick_detail', 'Get detailed info on a specific scanner pick.', { ticker: z.string().describe('Ticker symbol') }, async ({ ticker }) => {",
    '  const data = await fetchJSON(`${MCP_URL}/watchlist.json`);',
    '  const pick = data.picks.find(p => p.ticker.toUpperCase() === ticker.toUpperCase());',
    '  if (!pick) return { content: [{ type: \'text\', text: `Ticker ${ticker} not found. Available: ${data.picks.map(p => p.ticker).join(\', \')}` }] };',
    "  return { content: [{ type: 'text', text: JSON.stringify({ ...pick, regime: data.regime, updated: data.updated }, null, 2) }] };",
    '});',
    '',
    "server.tool('get_scanner_performance', 'Scanner hit rates, best/worst picks, strategy breakdown.', {}, async () => {",
    '  const data = await fetchJSON(`${MCP_URL}/scanner-performance.json`);',
    "  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };",
    '});',
    '',
    "server.tool('get_earnings_calendar', 'Upcoming earnings and macro events this week.', {}, async () => {",
    '  const data = await fetchJSON(`${MCP_URL}/earnings-calendar.json`);',
    "  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };",
    '});',
    '',
    "server.tool('search_articles', 'Search 250+ published analyses by ticker or keyword.', { query: z.string(), tab: z.string().optional() }, async ({ query, tab }) => {",
    "  const tabs = tab ? [tab] : ['analyses', 'daily', 'weekly', 'scanner'];",
    '  const results = [];',
    '  const q = query.toLowerCase();',
    '  for (const t of tabs) {',
    '    try {',
    '      const cards = await fetchJSON(`${DATA_URL}/${t}.json`);',
    '      for (const html of cards) {',
    '        if (html.toLowerCase().includes(q)) {',
    '          const m = html.match(/<h2[^>]*>(.*?)<\\/h2>/s);',
    '          const h = html.match(/href="([^"]+)"/);',
    "          results.push({ tab: t, title: m ? m[1].replace(/<[^>]+>/g,'').trim() : '', href: h ? h[1] : '' });",
    '        }',
    '      }',
    '    } catch (e) {}',
    '  }',
    '  return { content: [{ type: \'text\', text: results.length > 0 ? JSON.stringify(results.slice(0, 20), null, 2) : `No articles found for "${query}"` }] };',
    '});',
    '',
    "server.tool('get_article_list', 'List latest articles by type.', { tab: z.enum(['daily', 'weekly', 'analyses', 'scanner']), limit: z.number().optional() }, async ({ tab, limit }) => {",
    '  const cards = await fetchJSON(`${DATA_URL}/${tab}.json`);',
    '  const articles = cards.slice(0, limit || 10).map(html => {',
    '    const m = html.match(/<h2[^>]*>(.*?)<\\/h2>/s);',
    '    const h = html.match(/href="([^"]+)"/);',
    '    const d = html.match(/report-card-meta[^>]*>([^<]+)/);',
    "    return { title: m ? m[1].replace(/<[^>]+>/g,'').trim() : '', href: h ? h[1] : '', date: d ? d[1].trim() : '' };",
    '  });',
    "  return { content: [{ type: 'text', text: JSON.stringify({ tab, count: cards.length, articles }, null, 2) }] };",
    '});',
    '',
    "server.resource('watchlist', 'marketwatch://watchlist', { description: 'Current A+ picks', mimeType: 'application/json' }, async () => {",
    '  const data = await fetchJSON(`${MCP_URL}/watchlist.json`);',
    "  return { contents: [{ uri: 'marketwatch://watchlist', mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };",
    '});',
    '',
    'const transport = new StdioServerTransport();',
    'await server.connect(transport);'
  ].join('\n');

  var MCP_SERVER_PKG = JSON.stringify({
    name: "market-watch-mcp",
    version: "1.1.0",
    description: "Market Watch MCP Server — Live scanner picks, regime, earnings for AI agents",
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
  // README
  // ═══════════════════════════════════════
  function generateReadme(workflow, tickers) {
    var wf = WORKFLOWS.find(function(w) { return w.id === workflow; });
    return '# ' + wf.icon + ' ' + wf.title + ' \u2014 Market Watch AI Agent\n\n' +
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
      'Market Watch data updates **daily at 23:00 UTC**. The MCP server fetches live from\n' +
      '`articles.market-watch.xyz` — no API key needed.\n\n' +
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
    return [
      { name: 'CLAUDE.md', content: claudeMd },
      { name: '.mcp.json', content: MCP_DOT_JSON('./mcp-server/index.js') },
      { name: 'mcp-server/index.js', content: MCP_SERVER_INDEX },
      { name: 'mcp-server/package.json', content: MCP_SERVER_PKG },
      { name: '.cursorrules', content: claudeMd },
      { name: '.windsurfrules', content: claudeMd },
      { name: 'GEMINI.md', content: claudeMd },
      { name: 'AGENTS.md', content: claudeMd },
      { name: 'README.md', content: generateReadme(workflow, tickers) }
    ];
  }

  function downloadProject(workflow, tickers) {
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
    var url = 'https://articles.market-watch.xyz/mcp/watchlist.json';
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
      html += '<div class="live-picks-title"><i class="fa-solid fa-crosshairs"></i> ' + L.picks + '</div>';
      html += '<div class="live-picks">';
      data.picks.forEach(function(pick) {
        html += '<div class="live-pick">';
        html += '<div class="live-pick-header">';
        html += '<span class="live-pick-ticker">' + pick.ticker + '</span>';
        html += '<span class="live-pick-score">' + pick.score + '/100</span>';
        html += '</div>';
        html += '<div class="live-pick-strategy">' + pick.strategy + '</div>';
        html += '<div class="live-pick-levels">';
        html += '<span>' + L.entry + ': <strong>$' + pick.entry + '</strong></span>';
        html += '<span>' + L.stop + ': $' + pick.stop + '</span>';
        html += '<span>' + L.tp1 + ': $' + pick.tp1 + '</span>';
        html += '<span>R/R: ' + pick.rr + '</span>';
        html += '</div>';
        if (pick.catalyst) html += '<div class="live-pick-catalyst">' + pick.catalyst + '</div>';
        html += '</div>';
      });
      html += '</div>';
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

    // Config area
    html += '<div class="wf-config" id="wfConfig" style="display:none">';
    html += '<div class="wf-config-header">';
    html += '<span class="wf-config-icon" id="wfConfigIcon"></span>';
    html += '<div><div class="wf-config-title" id="wfConfigTitle"></div>';
    html += '<div class="wf-config-desc" id="wfConfigDesc"></div></div>';
    html += '</div>';

    // Optional custom tickers (simple text field, not 3-way switch)
    html += '<div class="fg"><div class="fl"><i class="fa-solid fa-chart-line"></i> ' + L.tickersLabel + ' <span class="opt">' + L.tickersOpt + '</span></div>';
    html += '<input type="text" class="fi" id="wfTickers" placeholder="' + L.watchlistPh + '"></div>';

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
    html += '<li>' + L.howToStep2 + '</li>';
    html += '<li>' + L.howToStep3 + '</li></ol>';
    html += '</div></div></div>';

    panel.innerHTML = html;

    // Attach card click listeners
    panel.querySelectorAll('.wf-card').forEach(function(card) {
      card.addEventListener('click', function() { selectWorkflow(this.dataset.wf); });
    });

    // Fetch live data
    fetchLiveData();
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
    var tickers = document.getElementById('wfTickers').value.trim() || null;
    var claudeMd = TEMPLATE_MAP[selectedWorkflow](tickers);
    var output = document.getElementById('wfOutput');
    document.getElementById('wfOutputCode').textContent = claudeMd;
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
    var tickers = document.getElementById('wfTickers').value.trim() || null;
    downloadProject(selectedWorkflow, tickers);
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
