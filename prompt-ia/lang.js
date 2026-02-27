// ═══════════════════════════════════════════════════════
// LANG.JS — i18n dictionary for Prompt IA
// ═══════════════════════════════════════════════════════
var LANG = {
  meta: {
    fr: { title:'Prompt IA | Market Watch', desc:'Generateur de mega-prompts d\'analyse financiere — Collez le prompt dans ChatGPT, Claude, Grok ou Perplexity et obtenez une analyse institutionnelle complete.', ogTitle:'Prompt IA | Market Watch', ogDesc:'Generez un mega-prompt d\'analyse financiere adapte a votre IA, langue et niveau.' },
    en: { title:'AI Prompt | Market Watch', desc:'Financial analysis mega-prompt generator — Paste the prompt into ChatGPT, Claude, Grok or Perplexity and get a complete institutional-grade analysis.', ogTitle:'AI Prompt | Market Watch', ogDesc:'Generate a financial analysis mega-prompt tailored to your AI, language and skill level.' },
    ar: { title:'\u0628\u0631\u0648\u0645\u064a\u062a IA | Market Watch', desc:'\u0645\u0648\u0644\u0651\u062f \u0628\u0631\u0648\u0645\u0628\u062a\u0627\u062a \u062a\u062d\u0644\u064a\u0644 \u0645\u0627\u0644\u064a \u0645\u062a\u0642\u062f\u0651\u0645\u0629 \u2014 \u0627\u0644\u0635\u0642 \u0627\u0644\u0628\u0631\u0648\u0645\u0628\u062a \u0641\u064a ChatGPT \u0623\u0648 Claude \u0623\u0648 Grok \u0623\u0648 Perplexity \u0648\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u062a\u062d\u0644\u064a\u0644 \u0645\u0624\u0633\u0633\u064a \u0634\u0627\u0645\u0644.', ogTitle:'\u0628\u0631\u0648\u0645\u064a\u062a IA | Market Watch', ogDesc:'\u0623\u0646\u0634\u0626 \u0628\u0631\u0648\u0645\u0628\u062a \u062a\u062d\u0644\u064a\u0644 \u0645\u0627\u0644\u064a \u0645\u064f\u062d\u0633\u064e\u0646 \u062d\u0633\u0628 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0648\u0627\u0644\u0644\u063a\u0629 \u0648\u0627\u0644\u0645\u0633\u062a\u0648\u0649.' }
  },
  ui: {
    fr: {
      heroTitle: 'Prompt IA',
      heroSub: 'M\u00e9ga-prompt d\'analyse financi\u00e8re en un clic \u2014 optimis\u00e9 pour ChatGPT, Claude, Grok, Perplexity',
      homeTitle: 'Accueil',
      generate: 'G\u00e9n\u00e9rer',
      generating: 'G\u00e9n\u00e9ration...',
      generateFull: 'G\u00e9n\u00e9rer le Prompt',
      intentLabel: 'Intention',
      customize: 'Personnaliser',
      assetType: 'Type d\'actif',
      targetAi: 'IA cible',
      aiHint: 'Auto = IA recommand\u00e9e selon le contexte',
      level: 'Niveau',
      format: 'Format',
      reportLang: 'Langue du rapport',
      focus: 'Focus',
      thesis: 'Th\u00e8se',
      thesisOpt: '\u2014 optionnel',
      thesisPlaceholder: 'D\u00e9crivez votre hypoth\u00e8se ou s\u00e9lectionnez un template...',
      catalysts: 'Catalyseurs',
      catalystOpt: '\u2014 optionnel',
      catalystPlaceholder: 'Ex : Earnings le 1er mai, rumeur de rachat...',
      outputTitle: 'Prompt principal',
      copy: 'Copier',
      copied: 'Copi\u00e9',
      newBtn: 'Nouveau',
      libTitle: 'Biblioth\u00e8que',
      libCount: '30 prompts test\u00e9s',
      libOpen: 'Ouvrir',
      libClose: 'Fermer',
      copiedMsg: 'Prompt copi\u00e9 !',
      copiedSub: 'Collez-le dans ',
      copyAiDefault: 'votre IA',
      openIn: 'Ouvrir dans ',
      otherAi: 'Autre IA',
      compTitle: 'Prompts compl\u00e9mentaires',
      disclaimer: 'L\'IA est un assistant, pas un oracle. V\u00e9rifiez toujours sur les sources primaires.',
      learnMore: 'En savoir plus',
      footer: '&copy; 2026 Market Watch. Donn\u00e9es via MarketWatch Gateway. Ceci n\'est pas un conseil financier.',
      truncNote: '[Prompt tronqu\u00e9 \u2014 collez la version compl\u00e8te via le bouton Copier]',
      heroToolLabel: 'Outil interactif',
      badgeMulti: 'Multi-actifs',
      badgeAi: 'IA recommand\u00e9e',
      badgeAntiH: 'Anti-hallucination',
      howTitle: 'Comment \u00e7a marche',
      step1Title: 'Ticker + Intention',
      step1Desc: 'AAPL, BTC-USD, EUR/USD...',
      step2Title: 'G\u00e9n\u00e9rer',
      step2Desc: 'Prompt principal + compl\u00e9mentaires',
      step3Title: 'Coller',
      step3Desc: 'Dans l\'IA recommand\u00e9e',
      genTitle: 'G\u00e9n\u00e9rateur',
      libDividerTitle: 'Biblioth\u00e8que de Prompts',
      libDesc: 'Prompts test\u00e9s et optimis\u00e9s issus de nos s\u00e9ries \u00e9ducatives. Cliquez pour d\u00e9plier, puis copiez.',
      aiDividerTitle: 'Quelle IA pour quel usage ?',
      aiCompareTitle: 'Forces & Faiblesses des IA',
      aiCompareDesc: 'Le g\u00e9n\u00e9rateur recommande automatiquement la meilleure IA. Voici pourquoi.',
      aiColAi: 'IA',
      aiColStr: 'Forces',
      aiColWeak: 'Faiblesses',
      resDividerTitle: 'Aller plus loin',
      resTitle: 'S\u00e9ries \u00c9ducatives'
    },
    en: {
      heroTitle: 'AI Prompt',
      heroSub: 'Financial analysis mega-prompt in one click \u2014 optimized for ChatGPT, Claude, Grok, Perplexity',
      homeTitle: 'Home',
      generate: 'Generate',
      generating: 'Generating...',
      generateFull: 'Generate Prompt',
      intentLabel: 'Intent',
      customize: 'Customize',
      assetType: 'Asset type',
      targetAi: 'Target AI',
      aiHint: 'Auto = AI recommended based on context',
      level: 'Level',
      format: 'Format',
      reportLang: 'Report language',
      focus: 'Focus',
      thesis: 'Thesis',
      thesisOpt: '\u2014 optional',
      thesisPlaceholder: 'Describe your hypothesis or select a template...',
      catalysts: 'Catalysts',
      catalystOpt: '\u2014 optional',
      catalystPlaceholder: 'Ex: Earnings on May 1st, buyout rumor...',
      outputTitle: 'Main prompt',
      copy: 'Copy',
      copied: 'Copied',
      newBtn: 'New',
      libTitle: 'Library',
      libCount: '30 tested prompts',
      libOpen: 'Open',
      libClose: 'Close',
      copiedMsg: 'Prompt copied!',
      copiedSub: 'Paste it into ',
      copyAiDefault: 'your AI',
      openIn: 'Open in ',
      otherAi: 'Other AI',
      compTitle: 'Complementary prompts',
      disclaimer: 'AI is an assistant, not an oracle. Always verify on primary sources.',
      learnMore: 'Learn more',
      footer: '&copy; 2026 Market Watch. Data via MarketWatch Gateway. This is not financial advice.',
      truncNote: '[Prompt truncated \u2014 paste the full version via the Copy button]',
      heroToolLabel: 'Interactive Tool',
      badgeMulti: 'Multi-asset',
      badgeAi: 'AI recommended',
      badgeAntiH: 'Anti-hallucination',
      howTitle: 'How it works',
      step1Title: 'Ticker + Intent',
      step1Desc: 'AAPL, BTC-USD, EUR/USD...',
      step2Title: 'Generate',
      step2Desc: 'Primary + complementary prompts',
      step3Title: 'Paste',
      step3Desc: 'Into the recommended AI',
      genTitle: 'Generator',
      libDividerTitle: 'Prompt Library',
      libDesc: 'Tested and optimized prompts from our educational series. Click to expand, then copy.',
      aiDividerTitle: 'Which AI for which use?',
      aiCompareTitle: 'AI Strengths & Weaknesses',
      aiCompareDesc: 'The generator automatically recommends the best AI. Here\'s why.',
      aiColAi: 'AI',
      aiColStr: 'Strengths',
      aiColWeak: 'Weaknesses',
      resDividerTitle: 'Learn more',
      resTitle: 'Educational Series'
    },
    ar: {
      heroTitle: '\u0628\u0631\u0648\u0645\u064a\u062a IA',
      heroSub: '\u0628\u0631\u0648\u0645\u0628\u062a \u062a\u062d\u0644\u064a\u0644 \u0645\u0627\u0644\u064a \u0636\u062e\u0645 \u0628\u0646\u0642\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u2014 \u0645\u064f\u062d\u0633\u064e\u0646 \u0644\u0640 ChatGPT\u060c Claude\u060c Grok\u060c Perplexity',
      homeTitle: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
      generate: '\u0625\u0646\u0634\u0627\u0621',
      generating: '\u062c\u0627\u0631\u064d \u0627\u0644\u0625\u0646\u0634\u0627\u0621...',
      generateFull: '\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0628\u0631\u0648\u0645\u0628\u062a',
      intentLabel: '\u0627\u0644\u0647\u062f\u0641',
      customize: '\u062a\u062e\u0635\u064a\u0635',
      assetType: '\u0646\u0648\u0639 \u0627\u0644\u0623\u0635\u0644',
      targetAi: '\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641',
      aiHint: 'Auto = \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0645\u0648\u0635\u0649 \u0628\u0647 \u062d\u0633\u0628 \u0627\u0644\u0633\u064a\u0627\u0642',
      level: '\u0627\u0644\u0645\u0633\u062a\u0648\u0649',
      format: '\u0627\u0644\u0635\u064a\u063a\u0629',
      reportLang: '\u0644\u063a\u0629 \u0627\u0644\u062a\u0642\u0631\u064a\u0631',
      focus: '\u0627\u0644\u062a\u0631\u0643\u064a\u0632',
      thesis: '\u0627\u0644\u0623\u0637\u0631\u0648\u062d\u0629',
      thesisOpt: '\u2014 \u0627\u062e\u062a\u064a\u0627\u0631\u064a',
      thesisPlaceholder: '\u0635\u0641 \u0641\u0631\u0636\u064a\u062a\u0643 \u0623\u0648 \u0627\u062e\u062a\u0631 \u0642\u0627\u0644\u0628\u064b\u0627...',
      catalysts: '\u0627\u0644\u0645\u062d\u0641\u0651\u0632\u0627\u062a',
      catalystOpt: '\u2014 \u0627\u062e\u062a\u064a\u0627\u0631\u064a',
      catalystPlaceholder: '\u0645\u062b\u0627\u0644: \u0623\u0631\u0628\u0627\u062d \u0641\u064a 1 \u0645\u0627\u064a\u0648\u060c \u0634\u0627\u0626\u0639\u0629 \u0627\u0633\u062a\u062d\u0648\u0627\u0630...',
      outputTitle: '\u0627\u0644\u0628\u0631\u0648\u0645\u0628\u062a \u0627\u0644\u0631\u0626\u064a\u0633\u064a',
      copy: '\u0646\u0633\u062e',
      copied: '\u062a\u0645 \u0627\u0644\u0646\u0633\u062e',
      newBtn: '\u062c\u062f\u064a\u062f',
      libTitle: '\u0627\u0644\u0645\u0643\u062a\u0628\u0629',
      libCount: '30 \u0628\u0631\u0648\u0645\u0628\u062a \u0645\u062e\u062a\u0628\u0631',
      libOpen: '\u0641\u062a\u062d',
      libClose: '\u0625\u063a\u0644\u0627\u0642',
      copiedMsg: '!\u062a\u0645 \u0646\u0633\u062e \u0627\u0644\u0628\u0631\u0648\u0645\u0628\u062a',
      copiedSub: '\u0627\u0644\u0635\u0642\u0647 \u0641\u064a ',
      copyAiDefault: '\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
      openIn: '\u0641\u062a\u062d \u0641\u064a ',
      otherAi: '\u0630\u0643\u0627\u0621 \u0622\u062e\u0631',
      compTitle: '\u0628\u0631\u0648\u0645\u0628\u062a\u0627\u062a \u062a\u0643\u0645\u064a\u0644\u064a\u0629',
      disclaimer: '\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0645\u0633\u0627\u0639\u062f\u060c \u0644\u064a\u0633 \u0648\u062d\u064a\u064b\u0627. \u062a\u062d\u0642\u0642 \u062f\u0627\u0626\u0645\u064b\u0627 \u0645\u0646 \u0627\u0644\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0623\u0635\u0644\u064a\u0629.',
      learnMore: '\u0627\u0639\u0631\u0641 \u0623\u0643\u062b\u0631',
      footer: '&copy; 2026 Market Watch. \u0628\u064a\u0627\u0646\u0627\u062a \u0639\u0628\u0631 MarketWatch Gateway. \u0647\u0630\u0627 \u0644\u064a\u0633 \u0646\u0635\u064a\u062d\u0629 \u0645\u0627\u0644\u064a\u0629.',
      truncNote: '[\u062a\u0645 \u0627\u0642\u062a\u0637\u0627\u0639 \u0627\u0644\u0628\u0631\u0648\u0645\u0628\u062a \u2014 \u0627\u0644\u0635\u0642 \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u0629 \u0639\u0628\u0631 \u0632\u0631 \u0646\u0633\u062e]',
      heroToolLabel: '\u0623\u062f\u0627\u0629 \u062a\u0641\u0627\u0639\u0644\u064a\u0629',
      badgeMulti: '\u0645\u062a\u0639\u062f\u062f \u0627\u0644\u0623\u0635\u0648\u0644',
      badgeAi: '\u0630\u0643\u0627\u0621 \u0645\u0648\u0635\u0649 \u0628\u0647',
      badgeAntiH: '\u0645\u0636\u0627\u062f \u0644\u0644\u0647\u0644\u0648\u0633\u0629',
      howTitle: '\u0643\u064a\u0641 \u064a\u0639\u0645\u0644',
      step1Title: '\u0631\u0645\u0632 + \u0647\u062f\u0641',
      step1Desc: 'AAPL, BTC-USD, EUR/USD...',
      step2Title: '\u0625\u0646\u0634\u0627\u0621',
      step2Desc: '\u0628\u0631\u0648\u0645\u0628\u062a \u0631\u0626\u064a\u0633\u064a + \u062a\u0643\u0645\u064a\u0644\u064a',
      step3Title: '\u0644\u0635\u0642',
      step3Desc: '\u0641\u064a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0645\u0648\u0635\u0649 \u0628\u0647',
      genTitle: '\u0627\u0644\u0645\u0648\u0644\u0651\u062f',
      libDividerTitle: '\u0645\u0643\u062a\u0628\u0629 \u0627\u0644\u0628\u0631\u0648\u0645\u0628\u062a\u0627\u062a',
      libDesc: '\u0628\u0631\u0648\u0645\u0628\u062a\u0627\u062a \u0645\u062e\u062a\u0628\u0631\u0629 \u0648\u0645\u062d\u0633\u0651\u0646\u0629. \u0627\u0646\u0642\u0631 \u0644\u0644\u062a\u0648\u0633\u064a\u0639 \u062b\u0645 \u0627\u0646\u0633\u062e.',
      aiDividerTitle: '\u0623\u064a \u0630\u0643\u0627\u0621 \u0644\u0623\u064a \u0627\u0633\u062a\u062e\u062f\u0627\u0645\u061f',
      aiCompareTitle: '\u0646\u0642\u0627\u0637 \u0627\u0644\u0642\u0648\u0629 \u0648\u0627\u0644\u0636\u0639\u0641',
      aiCompareDesc: '\u0627\u0644\u0645\u0648\u0644\u0651\u062f \u064a\u0648\u0635\u064a \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u0628\u0623\u0641\u0636\u0644 \u0630\u0643\u0627\u0621.',
      aiColAi: '\u0627\u0644\u0630\u0643\u0627\u0621',
      aiColStr: '\u0627\u0644\u0642\u0648\u0629',
      aiColWeak: '\u0627\u0644\u0636\u0639\u0641',
      resDividerTitle: '\u0627\u0639\u0631\u0641 \u0623\u0643\u062b\u0631',
      resTitle: '\u0633\u0644\u0627\u0633\u0644 \u062a\u0639\u0644\u064a\u0645\u064a\u0629'
    }
  },
  chips: {
    intent: {
      fr: [
        { value:'inform', icon:'fa-solid fa-magnifying-glass', label:'Analyser' },
        { value:'buy', icon:'fa-solid fa-cart-shopping', label:'Acheter' },
        { value:'sell', icon:'fa-solid fa-hand-holding-dollar', label:'Vendre' },
        { value:'short', icon:'fa-solid fa-arrow-trend-down', label:'Shorter' },
        { value:'hedge', icon:'fa-solid fa-shield-halved', label:'Hedger' },
        { value:'scan', icon:'fa-solid fa-binoculars', label:'Scanner' },
        { value:'macro', icon:'fa-solid fa-globe', label:'Macro' }
      ],
      en: [
        { value:'inform', icon:'fa-solid fa-magnifying-glass', label:'Analyze' },
        { value:'buy', icon:'fa-solid fa-cart-shopping', label:'Buy' },
        { value:'sell', icon:'fa-solid fa-hand-holding-dollar', label:'Sell' },
        { value:'short', icon:'fa-solid fa-arrow-trend-down', label:'Short' },
        { value:'hedge', icon:'fa-solid fa-shield-halved', label:'Hedge' },
        { value:'scan', icon:'fa-solid fa-binoculars', label:'Scan' },
        { value:'macro', icon:'fa-solid fa-globe', label:'Macro' }
      ],
      ar: [
        { value:'inform', icon:'fa-solid fa-magnifying-glass', label:'\u0627\u0644\u0628\u062d\u062b' },
        { value:'buy', icon:'fa-solid fa-cart-shopping', label:'\u0634\u0631\u0627\u0621' },
        { value:'sell', icon:'fa-solid fa-hand-holding-dollar', label:'\u0628\u064a\u0639' },
        { value:'short', icon:'fa-solid fa-arrow-trend-down', label:'Short' },
        { value:'hedge', icon:'fa-solid fa-shield-halved', label:'\u062a\u062d\u0648\u0651\u0637' },
        { value:'scan', icon:'fa-solid fa-binoculars', label:'\u0645\u0633\u062d' },
        { value:'macro', icon:'fa-solid fa-globe', label:'\u0645\u0627\u0643\u0631\u0648' }
      ]
    },
    asset: {
      fr: [
        { value:'stock', icon:'fa-solid fa-building', label:'Action' },
        { value:'biotech', icon:'fa-solid fa-dna', label:'Biotech' },
        { value:'crypto', icon:'fa-brands fa-bitcoin', label:'Crypto' },
        { value:'etf', icon:'fa-solid fa-layer-group', label:'ETF' },
        { value:'forex', icon:'fa-solid fa-money-bill-transfer', label:'Forex' },
        { value:'commodity', icon:'fa-solid fa-oil-well', label:'Mat. 1\u00e8re' },
        { value:'index', icon:'fa-solid fa-chart-pie', label:'Indice' },
        { value:'macro', icon:'fa-solid fa-globe', label:'Macro' }
      ],
      en: [
        { value:'stock', icon:'fa-solid fa-building', label:'Stock' },
        { value:'biotech', icon:'fa-solid fa-dna', label:'Biotech' },
        { value:'crypto', icon:'fa-brands fa-bitcoin', label:'Crypto' },
        { value:'etf', icon:'fa-solid fa-layer-group', label:'ETF' },
        { value:'forex', icon:'fa-solid fa-money-bill-transfer', label:'Forex' },
        { value:'commodity', icon:'fa-solid fa-oil-well', label:'Commodity' },
        { value:'index', icon:'fa-solid fa-chart-pie', label:'Index' },
        { value:'macro', icon:'fa-solid fa-globe', label:'Macro' }
      ],
      ar: [
        { value:'stock', icon:'fa-solid fa-building', label:'\u0633\u0647\u0645' },
        { value:'biotech', icon:'fa-solid fa-dna', label:'\u0628\u064a\u0648\u062a\u0643' },
        { value:'crypto', icon:'fa-brands fa-bitcoin', label:'\u0643\u0631\u064a\u0628\u062a\u0648' },
        { value:'etf', icon:'fa-solid fa-layer-group', label:'ETF' },
        { value:'forex', icon:'fa-solid fa-money-bill-transfer', label:'\u0641\u0648\u0631\u0643\u0633' },
        { value:'commodity', icon:'fa-solid fa-oil-well', label:'\u0633\u0644\u0639\u0629' },
        { value:'index', icon:'fa-solid fa-chart-pie', label:'\u0645\u0624\u0634\u0631' },
        { value:'macro', icon:'fa-solid fa-globe', label:'\u0645\u0627\u0643\u0631\u0648' }
      ]
    },
    level: {
      fr: [
        { value:'beginner', icon:'fa-solid fa-seedling', label:'D\u00e9butant' },
        { value:'intermediate', icon:'fa-solid fa-chart-simple', label:'Interm\u00e9diaire', selected:true },
        { value:'expert', icon:'fa-solid fa-brain', label:'Expert' }
      ],
      en: [
        { value:'beginner', icon:'fa-solid fa-seedling', label:'Beginner' },
        { value:'intermediate', icon:'fa-solid fa-chart-simple', label:'Inter.', selected:true },
        { value:'expert', icon:'fa-solid fa-brain', label:'Expert' }
      ],
      ar: [
        { value:'beginner', icon:'fa-solid fa-seedling', label:'\u0645\u0628\u062a\u062f\u0626' },
        { value:'intermediate', icon:'fa-solid fa-chart-simple', label:'\u0645\u062a\u0648\u0633\u0637', selected:true },
        { value:'expert', icon:'fa-solid fa-brain', label:'\u062e\u0628\u064a\u0631' }
      ]
    },
    format: {
      fr: [
        { value:'detailed', icon:'fa-solid fa-file-alt', label:'D\u00e9taill\u00e9e', selected:true },
        { value:'concise', icon:'fa-solid fa-compress', label:'Succincte' },
        { value:'telegram', icon:'fa-brands fa-telegram', label:'Telegram' },
        { value:'twitter', icon:'fa-brands fa-x-twitter', label:'X' }
      ],
      en: [
        { value:'detailed', icon:'fa-solid fa-file-alt', label:'Detailed', selected:true },
        { value:'concise', icon:'fa-solid fa-compress', label:'Concise' },
        { value:'telegram', icon:'fa-brands fa-telegram', label:'Telegram' },
        { value:'twitter', icon:'fa-brands fa-x-twitter', label:'X' }
      ],
      ar: [
        { value:'detailed', icon:'fa-solid fa-file-alt', label:'\u0645\u0641\u0635\u0651\u0644', selected:true },
        { value:'concise', icon:'fa-solid fa-compress', label:'\u0645\u062e\u062a\u0635\u0631' },
        { value:'telegram', icon:'fa-brands fa-telegram', label:'Telegram' },
        { value:'twitter', icon:'fa-brands fa-x-twitter', label:'X' }
      ]
    },
    reportLang: {
      fr: [
        { value:'fr', icon:'fa-solid fa-flag', label:'FR', selected:true },
        { value:'en', icon:'fa-solid fa-flag', label:'EN' },
        { value:'ar', icon:'fa-solid fa-flag', label:'AR' }
      ],
      en: [
        { value:'fr', icon:'fa-solid fa-flag', label:'FR' },
        { value:'en', icon:'fa-solid fa-flag', label:'EN', selected:true },
        { value:'ar', icon:'fa-solid fa-flag', label:'AR' }
      ],
      ar: [
        { value:'fr', icon:'fa-solid fa-flag', label:'FR' },
        { value:'en', icon:'fa-solid fa-flag', label:'EN' },
        { value:'ar', icon:'fa-solid fa-flag', label:'AR', selected:true }
      ]
    },
    focus: {
      fr: [
        { value:'all', icon:'fa-solid fa-layer-group', label:'Complet', selected:true },
        { value:'technical', icon:'fa-solid fa-chart-area', label:'Technique' },
        { value:'fundamental', icon:'fa-solid fa-building-columns', label:'Fondamental' },
        { value:'sentiment', icon:'fa-solid fa-users', label:'Sentiment' },
        { value:'risk', icon:'fa-solid fa-triangle-exclamation', label:'Risques' },
        { value:'trade', icon:'fa-solid fa-bullseye', label:'Trade' }
      ],
      en: [
        { value:'all', icon:'fa-solid fa-layer-group', label:'Full', selected:true },
        { value:'technical', icon:'fa-solid fa-chart-area', label:'Technical' },
        { value:'fundamental', icon:'fa-solid fa-building-columns', label:'Fundamental' },
        { value:'sentiment', icon:'fa-solid fa-users', label:'Sentiment' },
        { value:'risk', icon:'fa-solid fa-triangle-exclamation', label:'Risks' },
        { value:'trade', icon:'fa-solid fa-bullseye', label:'Trade' },
        { value:'sharia', icon:'fa-solid fa-mosque', label:'Sharia' }
      ],
      ar: [
        { value:'all', icon:'fa-solid fa-layer-group', label:'\u0634\u0627\u0645\u0644', selected:true },
        { value:'technical', icon:'fa-solid fa-chart-area', label:'\u062a\u0642\u0646\u064a' },
        { value:'fundamental', icon:'fa-solid fa-building-columns', label:'\u0623\u0633\u0627\u0633\u064a' },
        { value:'sentiment', icon:'fa-solid fa-users', label:'\u0645\u0639\u0646\u0648\u064a\u0627\u062a' },
        { value:'risk', icon:'fa-solid fa-triangle-exclamation', label:'\u0645\u062e\u0627\u0637\u0631' },
        { value:'trade', icon:'fa-solid fa-bullseye', label:'\u062a\u062f\u0627\u0648\u0644' },
        { value:'sharia', icon:'fa-solid fa-mosque', label:'\u0634\u0631\u064a\u0639\u0629' }
      ]
    },
    ai: [
      { value:'auto', icon:'fa-solid fa-wand-magic-sparkles', label:'Auto', id:'aiAutoChip', selected:true },
      { value:'chatgpt', icon:'fa-solid fa-message', label:'ChatGPT' },
      { value:'claude', icon:'fa-solid fa-feather', label:'Claude' },
      { value:'perplexity', icon:'fa-solid fa-magnifying-glass-chart', label:'Perplexity' },
      { value:'grok', icon:'fa-solid fa-xmark', label:'Grok' },
      { value:'gemini', icon:'fa-solid fa-gem', label:'Gemini' },
      { value:'deepseek', icon:'fa-solid fa-water', label:'DeepSeek' }
    ]
  },
  libTabs: {
    fr: [
      { cat:'all', label:'Tous' },
      { cat:'essential', label:'Essentiel' },
      { cat:'stock', label:'Stock-Picking' },
      { cat:'portfolio', label:'Portefeuille' },
      { cat:'crypto', label:'Crypto' },
      { cat:'macro', label:'Macro' },
      { cat:'special', label:'Sp\u00e9cial' }
    ],
    en: [
      { cat:'all', label:'All' },
      { cat:'essential', label:'Essential' },
      { cat:'stock', label:'Stock-Picking' },
      { cat:'portfolio', label:'Portfolio' },
      { cat:'crypto', label:'Crypto' },
      { cat:'macro', label:'Macro' },
      { cat:'special', label:'Special' }
    ],
    ar: [
      { cat:'all', label:'\u0627\u0644\u0643\u0644' },
      { cat:'essential', label:'\u0623\u0633\u0627\u0633\u064a' },
      { cat:'stock', label:'Stock-Picking' },
      { cat:'portfolio', label:'\u0645\u062d\u0641\u0638\u0629' },
      { cat:'crypto', label:'\u0643\u0631\u064a\u0628\u062a\u0648' },
      { cat:'macro', label:'\u0645\u0627\u0643\u0631\u0648' },
      { cat:'special', label:'\u062e\u0627\u0635' }
    ]
  },
  assetBadgeLabels: {
    fr: { stock:'Action', biotech:'Biotech', crypto:'Crypto', etf:'ETF', forex:'Forex', commodity:'Mat. 1\u00e8re', index:'Indice', macro:'Macro' },
    en: { stock:'Stock', biotech:'Biotech', crypto:'Crypto', etf:'ETF', forex:'Forex', commodity:'Commodity', index:'Index', macro:'Macro' },
    ar: { stock:'\u0633\u0647\u0645', biotech:'\u0628\u064a\u0648\u062a\u0643', crypto:'\u0643\u0631\u064a\u0628\u062a\u0648', etf:'ETF', forex:'\u0641\u0648\u0631\u0643\u0633', commodity:'\u0633\u0644\u0639\u0629', index:'\u0645\u0624\u0634\u0631', macro:'\u0645\u0627\u0643\u0631\u0648' }
  },
  thesisTemplates: {
    fr: [
      { icon:'fa-arrow-trend-up', label:'Rebond technique', text:'Le titre semble survendu apr\u00e8s une correction r\u00e9cente. Les indicateurs techniques (RSI < 30, MACD divergence haussi\u00e8re) sugg\u00e8rent un rebond imminent.' },
      { icon:'fa-gem', label:'Valeur cach\u00e9e', text:'Je pense que le march\u00e9 sous-\u00e9value cette entreprise. Le P/E est inf\u00e9rieur \u00e0 la moyenne sectorielle et les fondamentaux sont solides.' },
      { icon:'fa-microchip', label:'Croissance IA', text:'L\'entreprise est positionn\u00e9e sur le th\u00e8me de l\'intelligence artificielle. Je veux \u00e9valuer si la croissance attendue justifie la valorisation.' },
      { icon:'fa-chart-bar', label:'Pr\u00e9-earnings', text:'Les earnings arrivent bient\u00f4t. Je veux analyser les attentes du march\u00e9 et d\u00e9terminer s\'il y a une opportunit\u00e9.' },
      { icon:'fa-coins', label:'Dividende', text:'Je m\'int\u00e9resse \u00e0 ce titre pour son dividende. Je veux \u00e9valuer la p\u00e9rennit\u00e9 du dividende et la solidit\u00e9 financi\u00e8re.' },
      { icon:'fa-bolt', label:'Short squeeze', text:'Le short interest est \u00e9lev\u00e9 et le CTB augmente. Je veux \u00e9valuer le potentiel de short squeeze.' },
      { icon:'fa-compass', label:'D\u00e9couverte', text:'Je d\u00e9couvre ce titre et je veux une analyse compl\u00e8te pour comprendre le business model, la valorisation et les risques.' }
    ],
    en: [
      { icon:'fa-arrow-trend-up', label:'Technical bounce', text:'The stock looks oversold after a recent correction. Technical indicators (RSI < 30, bullish MACD divergence) suggest an imminent bounce.' },
      { icon:'fa-gem', label:'Hidden value', text:'I think the market undervalues this company. The P/E is below the sector average and fundamentals are solid.' },
      { icon:'fa-microchip', label:'AI growth', text:'The company is positioned on the AI theme. I want to evaluate if expected growth justifies the valuation.' },
      { icon:'fa-chart-bar', label:'Pre-earnings', text:'Earnings are coming soon. I want to analyze market expectations and determine if there\'s an opportunity.' },
      { icon:'fa-coins', label:'Dividend', text:'I\'m interested in this stock for its dividend. I want to evaluate dividend sustainability and financial strength.' },
      { icon:'fa-bolt', label:'Short squeeze', text:'Short interest is high and CTB is rising. I want to evaluate short squeeze potential.' },
      { icon:'fa-compass', label:'Discovery', text:'I\'m discovering this stock and want a complete analysis to understand the business model, valuation and risks.' }
    ],
    ar: [
      { icon:'fa-arrow-trend-up', label:'\u0627\u0631\u062a\u062f\u0627\u062f \u0641\u0646\u064a', text:'\u064a\u0628\u062f\u0648 \u0627\u0644\u0633\u0647\u0645 \u0645\u064f\u0628\u0627\u0644\u063a\u064b\u0627 \u0641\u064a \u0627\u0644\u0628\u064a\u0639 \u0628\u0639\u062f \u062a\u0635\u062d\u064a\u062d \u0623\u062e\u064a\u0631. \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0641\u0646\u064a\u0629 (RSI < 30\u060c \u062a\u0628\u0627\u0639\u062f MACD \u0635\u0639\u0648\u062f\u064a) \u062a\u0634\u064a\u0631 \u0625\u0644\u0649 \u0627\u0631\u062a\u062f\u0627\u062f \u0648\u0634\u064a\u0643.' },
      { icon:'fa-gem', label:'\u0642\u064a\u0645\u0629 \u0645\u062e\u0641\u064a\u0629', text:'\u0623\u0639\u062a\u0642\u062f \u0623\u0646 \u0627\u0644\u0633\u0648\u0642 \u064a\u0642\u0644\u0651\u0644 \u0645\u0646 \u0642\u064a\u0645\u0629 \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0643\u0629. P/E \u0623\u0642\u0644 \u0645\u0646 \u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0642\u0637\u0627\u0639 \u0648\u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0627\u062a \u0645\u062a\u064a\u0646\u0629.' },
      { icon:'fa-microchip', label:'\u0646\u0645\u0648 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a', text:'\u0627\u0644\u0634\u0631\u0643\u0629 \u0645\u0648\u0636\u0648\u0639\u0629 \u0639\u0644\u0649 \u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a. \u0623\u0631\u064a\u062f \u062a\u0642\u064a\u064a\u0645 \u0645\u0627 \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0646\u0645\u0648 \u0627\u0644\u0645\u062a\u0648\u0642\u0639 \u064a\u0628\u0631\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645.' },
      { icon:'fa-chart-bar', label:'\u0642\u0628\u0644 \u0627\u0644\u0623\u0631\u0628\u0627\u062d', text:'\u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0642\u0627\u062f\u0645\u0629 \u0642\u0631\u064a\u0628\u064b\u0627. \u0623\u0631\u064a\u062f \u062a\u062d\u0644\u064a\u0644 \u062a\u0648\u0642\u0639\u0627\u062a \u0627\u0644\u0633\u0648\u0642 \u0648\u062a\u062d\u062f\u064a\u062f \u0645\u0627 \u0625\u0630\u0627 \u0643\u0627\u0646\u062a \u0647\u0646\u0627\u0643 \u0641\u0631\u0635\u0629.' },
      { icon:'fa-coins', label:'\u062a\u0648\u0632\u064a\u0639\u0627\u062a', text:'\u0623\u0647\u062a\u0645 \u0628\u0647\u0630\u0627 \u0627\u0644\u0633\u0647\u0645 \u0628\u0633\u0628\u0628 \u062a\u0648\u0632\u064a\u0639\u0627\u062a\u0647. \u0623\u0631\u064a\u062f \u062a\u0642\u064a\u064a\u0645 \u0627\u0633\u062a\u062f\u0627\u0645\u0629 \u0627\u0644\u062a\u0648\u0632\u064a\u0639\u0627\u062a \u0648\u0627\u0644\u0642\u0648\u0629 \u0627\u0644\u0645\u0627\u0644\u064a\u0629.' },
      { icon:'fa-bolt', label:'Short squeeze', text:'\u0646\u0633\u0628\u0629 \u0627\u0644\u0628\u064a\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0643\u0634\u0648\u0641 \u0645\u0631\u062a\u0641\u0639\u0629 \u0648CTB \u064a\u062a\u0632\u0627\u064a\u062f. \u0623\u0631\u064a\u062f \u062a\u0642\u064a\u064a\u0645 \u0625\u0645\u0643\u0627\u0646\u064a\u0629 short squeeze.' },
      { icon:'fa-compass', label:'\u0627\u0643\u062a\u0634\u0627\u0641', text:'\u0623\u0643\u062a\u0634\u0641 \u0647\u0630\u0627 \u0627\u0644\u0633\u0647\u0645 \u0648\u0623\u0631\u064a\u062f \u062a\u062d\u0644\u064a\u0644\u064b\u0627 \u0634\u0627\u0645\u0644\u064b\u0627 \u0644\u0641\u0647\u0645 \u0646\u0645\u0648\u0630\u062c \u0627\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0648\u0627\u0644\u0645\u062e\u0627\u0637\u0631.' }
    ]
  },
  catalystTemplates: {
    fr: [
      { icon:'fa-chart-bar', label:'Earnings', text:'Earnings \u00e0 venir (date estim\u00e9e)' },
      { icon:'fa-flask', label:'FDA / R\u00e9sultats cliniques', text:'D\u00e9cision FDA / r\u00e9sultats Phase III attendus' },
      { icon:'fa-handshake', label:'Rachat / M&A', text:'Rumeur de rachat / offre d\'acquisition potentielle' },
      { icon:'fa-rocket', label:'Lancement produit', text:'Lancement d\'un nouveau produit / service majeur' },
      { icon:'fa-gavel', label:'R\u00e9gulation', text:'Changement r\u00e9glementaire / d\u00e9cision judiciaire attendue' },
      { icon:'fa-landmark', label:'FOMC / Fed', text:'R\u00e9union FOMC / d\u00e9cision de taux directeur' }
    ],
    en: [
      { icon:'fa-chart-bar', label:'Earnings', text:'Upcoming earnings (estimated date)' },
      { icon:'fa-flask', label:'FDA / Clinical results', text:'FDA decision / Phase III results expected' },
      { icon:'fa-handshake', label:'Buyout / M&A', text:'Buyout rumor / potential acquisition offer' },
      { icon:'fa-rocket', label:'Product launch', text:'Major new product / service launch' },
      { icon:'fa-gavel', label:'Regulation', text:'Regulatory change / court decision expected' },
      { icon:'fa-landmark', label:'FOMC / Fed', text:'FOMC meeting / interest rate decision' }
    ],
    ar: [
      { icon:'fa-chart-bar', label:'\u0623\u0631\u0628\u0627\u062d', text:'\u0623\u0631\u0628\u0627\u062d \u0642\u0627\u062f\u0645\u0629 (\u062a\u0627\u0631\u064a\u062e \u062a\u0642\u062f\u064a\u0631\u064a)' },
      { icon:'fa-flask', label:'FDA / \u0646\u062a\u0627\u0626\u062c \u0633\u0631\u064a\u0631\u064a\u0629', text:'\u0642\u0631\u0627\u0631 FDA / \u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0645\u0631\u062d\u0644\u0629 \u0627\u0644\u062b\u0627\u0644\u062b\u0629 \u0627\u0644\u0645\u062a\u0648\u0642\u0639\u0629' },
      { icon:'fa-handshake', label:'\u0627\u0633\u062a\u062d\u0648\u0627\u0630 / M&A', text:'\u0634\u0627\u0626\u0639\u0629 \u0627\u0633\u062a\u062d\u0648\u0627\u0630 / \u0639\u0631\u0636 \u0627\u0633\u062a\u062d\u0648\u0627\u0630 \u0645\u062d\u062a\u0645\u0644' },
      { icon:'fa-rocket', label:'\u0625\u0637\u0644\u0627\u0642 \u0645\u0646\u062a\u062c', text:'\u0625\u0637\u0644\u0627\u0642 \u0645\u0646\u062a\u062c / \u062e\u062f\u0645\u0629 \u062c\u062f\u064a\u062f\u0629 \u0631\u0626\u064a\u0633\u064a\u0629' },
      { icon:'fa-gavel', label:'\u062a\u0646\u0638\u064a\u0645', text:'\u062a\u063a\u064a\u064a\u0631 \u062a\u0646\u0638\u064a\u0645\u064a / \u0642\u0631\u0627\u0631 \u0642\u0636\u0627\u0626\u064a \u0645\u062a\u0648\u0642\u0639' },
      { icon:'fa-landmark', label:'FOMC / Fed', text:'\u0627\u062c\u062a\u0645\u0627\u0639 FOMC / \u0642\u0631\u0627\u0631 \u0633\u0639\u0631 \u0627\u0644\u0641\u0627\u0626\u062f\u0629' }
    ]
  }
};
