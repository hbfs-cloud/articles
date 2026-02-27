// ═══════════════════════════════════════════════════════
// APP.JS — Single-page i18n prompt generator
// Depends on: lang.js (LANG), library.js (LIBRARY)
// ═══════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── LANGUAGE DETECTION ──
  var params = new URLSearchParams(location.search);
  var CURRENT_LANG = params.get('lang') || 'en';
  if (['fr','en','ar'].indexOf(CURRENT_LANG) === -1) CURRENT_LANG = 'en';

  var L = LANG.ui[CURRENT_LANG];

  // ── APPLY LANGUAGE TO PAGE ──
  function applyLang() {
    var html = document.documentElement;
    html.lang = CURRENT_LANG;
    if (CURRENT_LANG === 'ar') { html.dir = 'rtl'; } else { html.removeAttribute('dir'); }

    // Meta
    var m = LANG.meta[CURRENT_LANG];
    document.title = m.title;
    var metaDesc = document.getElementById('metaDesc'); if (metaDesc) metaDesc.content = m.desc;
    var ogTitle = document.getElementById('ogTitle'); if (ogTitle) ogTitle.content = m.ogTitle;
    var ogDesc = document.getElementById('ogDesc'); if (ogDesc) ogDesc.content = m.ogDesc;

    // UI text elements
    setText('heroTitle', L.heroTitle);
    setText('heroSub', L.heroSub);
    setText('generateLabel', L.generate);
    setText('intentLabel', L.intentLabel);
    setText('customizeLabel', L.customize);
    setText('assetLabel', L.assetType);
    setText('aiLabel', L.targetAi);
    setText('aiHint', L.aiHint);
    setText('levelLabel', L.level);
    setText('formatLabel', L.format);
    setText('reportLangLabel', L.reportLang);
    setText('focusLabel', L.focus);
    setText('thesisLabel', L.thesis);
    setText('thesisOpt', L.thesisOpt);
    setText('catalystLabel', L.catalysts);
    setText('catalystOpt', L.catalystOpt);
    setText('outputTitle', L.outputTitle);
    setText('copyLabel', L.copy);
    setText('resetLabel', L.newBtn);
    setText('libTitle', L.libTitle);
    setText('libCount', L.libCount);
    setText('libOpenLabel', L.libOpen);
    setText('copiedText', L.copiedMsg);
    setText('disclaimerHint', L.disclaimer);

    // Placeholders
    var thesisInput = document.getElementById('thesisInput');
    if (thesisInput) thesisInput.placeholder = L.thesisPlaceholder;
    var catalystInput = document.getElementById('catalystInput');
    if (catalystInput) catalystInput.placeholder = L.catalystPlaceholder;

    // Home button title
    var homeBtn = document.getElementById('homeBtn');
    if (homeBtn) homeBtn.title = L.homeTitle;

    // Footer
    var footer = document.getElementById('footerArea');
    if (footer) footer.innerHTML = L.footer + '<br><a href="/" title="' + L.homeTitle + '"><i class="fas fa-house"></i></a>';

    // New UI text elements
    setText('heroToolLabel', L.heroToolLabel);
    setText('badgeMulti', L.badgeMulti);
    setText('badgeAi', L.badgeAi);
    setText('badgeAntiH', L.badgeAntiH);
    setText('howTitle', L.howTitle);
    setText('step1Title', L.step1Title);
    setText('step1Desc', L.step1Desc);
    setText('step2Title', L.step2Title);
    setText('step2Desc', L.step2Desc);
    setText('step3Title', L.step3Title);
    setText('step3Desc', L.step3Desc);
    setText('genTitle', L.genTitle);
    setText('libDividerTitle', L.libDividerTitle);
    setText('libDesc', L.libDesc);
    setText('aiDividerTitle', L.aiDividerTitle);
    setText('aiCompareTitle', L.aiCompareTitle);
    setText('aiCompareDesc', L.aiCompareDesc);
    setText('aiColAi', L.aiColAi);
    setText('aiColStr', L.aiColStr);
    setText('aiColWeak', L.aiColWeak);
    setText('resDividerTitle', L.resDividerTitle);
    setText('resTitle', L.resTitle);

    // Lang switcher
    document.querySelectorAll('#langSwitcher a').forEach(function(a) {
      var lang = a.getAttribute('data-lang');
      a.href = '?lang=' + lang;
      a.classList.toggle('active', lang === CURRENT_LANG);
    });
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el && text !== undefined) el.textContent = text;
  }

  // ── RENDER INTENT CHIPS (only intent stays as chips) ──
  function renderChips(groupId, chips) {
    var group = document.getElementById(groupId);
    if (!group) return;
    group.innerHTML = '';
    chips.forEach(function(c) {
      var chip = document.createElement('div');
      chip.className = 'chip' + (c.selected ? ' selected' : '');
      chip.setAttribute('data-value', c.value);
      chip.innerHTML = '<i class="' + c.icon + '"></i> ' + c.label;
      chip.addEventListener('click', function() {
        group.querySelectorAll('.chip').forEach(function(x) { x.classList.remove('selected'); });
        this.classList.add('selected');
      });
      group.appendChild(chip);
    });
  }

  // ── RENDER MULTI-SELECT CHIPS (focus group allows multiple) ──
  function renderMultiChips(groupId, chips) {
    var group = document.getElementById(groupId);
    if (!group) return;
    group.innerHTML = '';
    chips.forEach(function(c) {
      var chip = document.createElement('div');
      chip.className = 'chip' + (c.selected ? ' selected' : '');
      chip.setAttribute('data-value', c.value);
      chip.innerHTML = '<i class="' + c.icon + '"></i> ' + c.label;
      chip.addEventListener('click', function() {
        if (c.value === 'all') {
          group.querySelectorAll('.chip').forEach(function(x) { x.classList.remove('selected'); });
          this.classList.add('selected');
        } else {
          group.querySelector('.chip[data-value="all"]')?.classList.remove('selected');
          this.classList.toggle('selected');
          if (!group.querySelector('.chip.selected')) {
            group.querySelector('.chip[data-value="all"]')?.classList.add('selected');
          }
        }
      });
      group.appendChild(chip);
    });
  }

  function renderAllControls() {
    var chips = LANG.chips;
    renderChips('intentGroup', chips.intent[CURRENT_LANG]);
    renderChips('assetGroup', chips.asset[CURRENT_LANG]);
    renderChips('aiGroup', chips.ai);
    renderChips('levelGroup', chips.level[CURRENT_LANG]);
    renderChips('formatGroup', chips.format[CURRENT_LANG]);
    renderChips('langGroup', chips.reportLang[CURRENT_LANG]);
    renderMultiChips('focusGroup', chips.focus[CURRENT_LANG]);
  }

  // ── GET VALUES (chip groups) ──
  function getSelected(id) {
    var chip = document.querySelector('#' + id + ' .chip.selected');
    return chip ? chip.dataset.value : '';
  }
  function getAllSelected(id) {
    return Array.from(document.querySelectorAll('#' + id + ' .chip.selected')).map(function(c) { return c.dataset.value; });
  }

  // ── ASSET TYPE AUTO-DETECTION ──
  var KNOWN_ETF = ['SPY','QQQ','DIA','IWM','GLD','SLV','USO','TLT','EFA','EEM','FXI','VTI','VOO','ARKK','XLF','XLE','XLK','XLV','XLI','ICLN','VGK','EWG','EWQ','EWU','EWJ','EWY','EWH','MCHI','SH','SQQQ','TQQQ','UVXY','VXX','IBIT','BITO'];
  var KNOWN_INDEX = ['^GSPC','^DJI','^IXIC','^RUT','^VIX','^TNX','^STOXX50E','^GDAXI','^FCHI','^N225','^HSI','^AORD'];
  var KNOWN_BIOTECH = ['MRNA','BNTX','REGN','VRTX','GILD','AMGN','BIIB','ILMN','SGEN','BMRN','ALNY','RARE','NBIX','IONS','EXAS','CRSP','EDIT','NTLA','BEAM','VERV','ACAD','HALO','RCKT','RVMD','PCVX','TGTX','KRTX','IMVT','TARA','BMNR','PRAX','MDGL','ARQT','CRNX','APLS','AVDL','NUVB','ABCL','DNA'];
  var FOREX_PAIRS = ['EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','NZD/USD','USD/CAD','EUR/GBP','EUR/JPY','GBP/JPY','EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','NZDUSD','USDCAD','EURGBP','EURJPY','GBPJPY','EURUSD=X','GBPUSD=X','JPY=X'];
  var COMMODITY_TICKERS = ['GC=F','SI=F','CL=F','NG=F','HG=F','PL=F','PA=F','ZC=F','ZW=F','ZS=F','KC=F','CT=F','SB=F','CC=F'];

  function detectAssetType(ticker) {
    if (!ticker) return 'stock';
    var t = ticker.toUpperCase().replace(/\s+/g,'');
    if (FOREX_PAIRS.indexOf(t) !== -1 || /^[A-Z]{3}\/[A-Z]{3}$/.test(t) || /^[A-Z]{6}=X$/.test(t)) return 'forex';
    if (t.indexOf('-USD') !== -1 || t.indexOf('-EUR') !== -1 || t.indexOf('-BTC') !== -1 || /^(BTC|ETH|SOL|XRP|DOGE|ADA|DOT|AVAX|MATIC|LINK|UNI|AAVE|SHIB|PEPE|WIF|BONK)/.test(t)) return 'crypto';
    if (KNOWN_ETF.indexOf(t) !== -1) return 'etf';
    if (KNOWN_INDEX.indexOf(t) !== -1 || t.charAt(0) === '^') return 'index';
    if (COMMODITY_TICKERS.indexOf(t) !== -1) return 'commodity';
    if (KNOWN_BIOTECH.indexOf(t) !== -1) return 'biotech';
    return 'stock';
  }

  function updateAssetBadge(type) {
    var labels = LANG.assetBadgeLabels[CURRENT_LANG];
    var area = document.getElementById('assetBadgeArea');
    if (type && type !== 'stock') {
      area.innerHTML = '<span class="asset-badge ' + type + '"><i class="fa-solid fa-tag"></i> ' + (labels[type] || type) + '</span>';
    } else {
      area.innerHTML = '';
    }
  }

  // Auto-suggest asset type on ticker input
  document.getElementById('tickerInput').addEventListener('input', function() {
    this.value = this.value.toUpperCase();
    var detected = detectAssetType(this.value.trim());
    var current = getSelected('assetGroup') || 'stock';
    if (current === 'stock' || current === detected) {
      selectChip('assetGroup', detected);
    }
    updateAssetBadge(detected);
  });

  // Helper: programmatically select a chip in a group
  function selectChip(groupId, value) {
    var group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('selected'); });
    var target = group.querySelector('.chip[data-value="' + value + '"]');
    if (target) target.classList.add('selected');
  }

  // ── TEMPLATES (thesis & catalyst) ──
  function renderTemplates(templates, containerId, targetId) {
    var container = document.getElementById(containerId);
    container.innerHTML = '';
    templates.forEach(function(t) {
      var btn = document.createElement('div');
      btn.className = 'thesis-tpl';
      btn.innerHTML = '<i class="fa-solid ' + t.icon + '"></i> ' + t.label;
      btn.addEventListener('click', function() {
        var el = document.getElementById(targetId);
        el.value = t.text;
        el.focus();
      });
      container.appendChild(btn);
    });
  }

  // ── AI RECOMMENDATION ENGINE ──
  var aiLabels = { chatgpt:'ChatGPT', claude:'Claude', perplexity:'Perplexity', grok:'Grok', gemini:'Gemini', deepseek:'DeepSeek' };

  // Translated AI recommendation reasons
  var aiReasonMap = {
    fr: {
      crypto_grok: 'Accès X/Twitter temps réel — idéal pour les narratifs crypto, meme coins et buzz communautaire',
      crypto_perplexity: 'Sources web citées — données on-chain, régulation, actualités vérifiées',
      biotech_claude: 'Raisonnement nuancé — excellent pour évaluer les probabilités FDA et les risques cliniques',
      biotech_chatgpt: 'Analyse longue détaillée — pipeline, brevets, comparaison avec les concurrents',
      forex_deepseek: 'Calculs de carry trade, différentiels de taux, modèles PPP',
      forex_chatgpt: 'Patterns, supports/résistances, corrélations inter-devises',
      macro_claude: 'Vision long terme, interconnexions macro, raisonnement systémique',
      macro_chatgpt: 'Tableaux de données macro, comparaisons historiques, calendrier économique',
      etf_perplexity: 'Données récentes de flux ETF, rebalancement, top holdings actuels',
      etf_deepseek: 'Tracking error, TER, comparaison avec pairs, performance risk-adjusted',
      commodity_chatgpt: 'Analyse détaillée offre/demande, géopolitique, saisonnalité',
      commodity_gemini: 'Tendances de recherche, corrélations avec cycles économiques',
      index_chatgpt: 'Secteurs, breadth, rotation, niveaux techniques détaillés',
      index_deepseek: 'Corrélations, régime VIX, spread analysis, modèles statistiques',
      scan_perplexity: 'Screening basé sur les news récentes et catalyseurs à venir',
      scan_grok: 'Tickers en tendance sur X/Twitter, buzz retail, meme potential',
      short_chatgpt: 'SI %, CTB, FTDs, dark pool — données factuelles avec browsing',
      short_grok: 'Détection de pump & dump, activité suspecte sur X/Twitter',
      hedge_deepseek: 'Calculs de Greeks, stratégies de couverture optimales, hedge ratio',
      hedge_chatgpt: 'Options chain, corrélations, instruments de couverture disponibles',
      default_claude: 'Le meilleur pour identifier les risques cachés et challenger votre thèse',
      default_perplexity: 'Actualités sourcées, consensus analystes, calendrier à venir'
    },
    en: {
      crypto_grok: 'Real-time X/Twitter access — ideal for crypto narratives, meme coins and community buzz',
      crypto_perplexity: 'Cited web sources — on-chain data, regulation, verified news',
      biotech_claude: 'Nuanced reasoning — excellent for evaluating FDA probabilities and clinical risks',
      biotech_chatgpt: 'Detailed long analysis — pipeline, patents, competitor comparison',
      forex_deepseek: 'Carry trade calculations, rate differentials, PPP models',
      forex_chatgpt: 'Patterns, support/resistance, cross-currency correlations',
      macro_claude: 'Long-term vision, macro interconnections, systemic reasoning',
      macro_chatgpt: 'Macro data tables, historical comparisons, economic calendar',
      etf_perplexity: 'Recent ETF flow data, rebalancing, current top holdings',
      etf_deepseek: 'Tracking error, TER, peer comparison, risk-adjusted performance',
      commodity_chatgpt: 'Detailed supply/demand analysis, geopolitics, seasonality',
      commodity_gemini: 'Search trends, correlations with economic cycles',
      index_chatgpt: 'Sectors, breadth, rotation, detailed technical levels',
      index_deepseek: 'Correlations, VIX regime, spread analysis, statistical models',
      scan_perplexity: 'Screening based on recent news and upcoming catalysts',
      scan_grok: 'Trending tickers on X/Twitter, retail buzz, meme potential',
      short_chatgpt: 'SI %, CTB, FTDs, dark pool — factual data with browsing',
      short_grok: 'Pump & dump detection, suspicious activity on X/Twitter',
      hedge_deepseek: 'Greeks calculations, optimal hedging strategies, hedge ratio',
      hedge_chatgpt: 'Options chain, correlations, available hedging instruments',
      default_claude: 'Best at identifying hidden risks and challenging your thesis',
      default_perplexity: 'Sourced news, analyst consensus, upcoming calendar'
    },
    ar: {
      crypto_grok: 'وصول X/Twitter فوري — مثالي لسرديات الكريبتو وعملات الميم',
      crypto_perplexity: 'مصادر ويب موثقة — بيانات on-chain، تنظيم، أخبار موثقة',
      biotech_claude: 'تحليل دقيق — ممتاز لتقييم احتمالات FDA والمخاطر السريرية',
      biotech_chatgpt: 'تحليل مفصل طويل — خط الأنابيب، براءات الاختراع، مقارنة المنافسين',
      forex_deepseek: 'حسابات carry trade، فروق الأسعار، نماذج PPP',
      forex_chatgpt: 'أنماط، دعم/مقاومة، ارتباطات العملات',
      macro_claude: 'رؤية طويلة الأجل، ترابطات ماكرو، تفكير منهجي',
      macro_chatgpt: 'جداول بيانات ماكرو، مقارنات تاريخية، تقويم اقتصادي',
      etf_perplexity: 'بيانات تدفقات ETF الحديثة، إعادة التوازن، أعلى الحيازات',
      etf_deepseek: 'خطأ التتبع، TER، مقارنة الأقران، أداء معدل المخاطر',
      commodity_chatgpt: 'تحليل مفصل للعرض/الطلب، جيوسياسية، موسمية',
      commodity_gemini: 'اتجاهات البحث، ارتباطات مع الدورات الاقتصادية',
      index_chatgpt: 'قطاعات، اتساع السوق، دوران، مستويات فنية مفصلة',
      index_deepseek: 'ارتباطات، نظام VIX، تحليل الفروق، نماذج إحصائية',
      scan_perplexity: 'فرز بناءً على الأخبار الأخيرة والمحفزات القادمة',
      scan_grok: 'أسهم رائجة على X/Twitter، ضجة التجزئة',
      short_chatgpt: 'SI %، CTB، FTDs، dark pool — بيانات فعلية',
      short_grok: 'كشف pump & dump، نشاط مشبوه على X/Twitter',
      hedge_deepseek: 'حسابات Greeks، استراتيجيات تحوط مثلى',
      hedge_chatgpt: 'سلسلة الخيارات، ارتباطات، أدوات تحوط متاحة',
      default_claude: 'الأفضل في تحديد المخاطر الخفية وتحدي أطروحتك',
      default_perplexity: 'أخبار موثقة، إجماع المحللين، تقويم قادم'
    }
  };

  // Angle labels per language
  var aiAngleMap = {
    fr: { social:'Sentiment social', news_onchain:'News & on-chain', risk:'Analyse risque', pipeline:'Pipeline complet', quant:'Quantitatif', technique:'Analyse technique', structural:'Analyse structurelle', data:'Données détaillées', flux:'Flux & holdings', quant2:'Analyse quantitative', supply:'Supply/demand', trends:'Google Trends', full:'Analyse complète', stats:'Quant', news:'Actualités', social2:'Social momentum', short_data:'Données short', sentiment:'Sentiment', options:'Options & Greeks', instruments:'Instruments', contra:'Analyse contradictoire', catalysts:'News & catalyseurs' },
    en: { social:'Social sentiment', news_onchain:'News & on-chain', risk:'Risk analysis', pipeline:'Full pipeline', quant:'Quantitative', technique:'Technical analysis', structural:'Structural analysis', data:'Detailed data', flux:'Flows & holdings', quant2:'Quantitative analysis', supply:'Supply/demand', trends:'Google Trends', full:'Full analysis', stats:'Quant', news:'News', social2:'Social momentum', short_data:'Short data', sentiment:'Sentiment', options:'Options & Greeks', instruments:'Instruments', contra:'Contrarian analysis', catalysts:'News & catalysts' },
    ar: { social:'معنويات اجتماعية', news_onchain:'أخبار & on-chain', risk:'تحليل مخاطر', pipeline:'خط أنابيب كامل', quant:'كمي', technique:'تحليل فني', structural:'تحليل هيكلي', data:'بيانات مفصلة', flux:'تدفقات & حيازات', quant2:'تحليل كمي', supply:'عرض/طلب', trends:'Google Trends', full:'تحليل كامل', stats:'كمي', news:'أخبار', social2:'زخم اجتماعي', short_data:'بيانات short', sentiment:'معنويات', options:'Options & Greeks', instruments:'أدوات', contra:'تحليل معاكس', catalysts:'أخبار & محفزات' }
  };

  function getAiRecommendations(assetType, intent) {
    var rec = { primary: 'chatgpt', complementary: [] };
    var R = aiReasonMap[CURRENT_LANG];
    var A = aiAngleMap[CURRENT_LANG];

    if (assetType === 'crypto') {
      rec.primary = 'chatgpt';
      rec.complementary = [
        { ai:'grok', angle:A.social, reason:R.crypto_grok },
        { ai:'perplexity', angle:A.news_onchain, reason:R.crypto_perplexity }
      ];
    } else if (assetType === 'biotech') {
      rec.primary = 'perplexity';
      rec.complementary = [
        { ai:'claude', angle:A.risk, reason:R.biotech_claude },
        { ai:'chatgpt', angle:A.pipeline, reason:R.biotech_chatgpt }
      ];
    } else if (assetType === 'forex') {
      rec.primary = 'perplexity';
      rec.complementary = [
        { ai:'deepseek', angle:A.quant, reason:R.forex_deepseek },
        { ai:'chatgpt', angle:A.technique, reason:R.forex_chatgpt }
      ];
    } else if (assetType === 'macro') {
      rec.primary = 'perplexity';
      rec.complementary = [
        { ai:'claude', angle:A.structural, reason:R.macro_claude },
        { ai:'chatgpt', angle:A.data, reason:R.macro_chatgpt }
      ];
    } else if (assetType === 'etf') {
      rec.primary = 'chatgpt';
      rec.complementary = [
        { ai:'perplexity', angle:A.flux, reason:R.etf_perplexity },
        { ai:'deepseek', angle:A.quant2, reason:R.etf_deepseek }
      ];
    } else if (assetType === 'commodity') {
      rec.primary = 'perplexity';
      rec.complementary = [
        { ai:'chatgpt', angle:A.supply, reason:R.commodity_chatgpt },
        { ai:'gemini', angle:A.trends, reason:R.commodity_gemini }
      ];
    } else if (assetType === 'index') {
      rec.primary = 'perplexity';
      rec.complementary = [
        { ai:'chatgpt', angle:A.full, reason:R.index_chatgpt },
        { ai:'deepseek', angle:A.stats, reason:R.index_deepseek }
      ];
    } else {
      if (intent === 'scan') {
        rec.primary = 'chatgpt';
        rec.complementary = [
          { ai:'perplexity', angle:A.news, reason:R.scan_perplexity },
          { ai:'grok', angle:A.social2, reason:R.scan_grok }
        ];
      } else if (intent === 'short') {
        rec.primary = 'claude';
        rec.complementary = [
          { ai:'chatgpt', angle:A.short_data, reason:R.short_chatgpt },
          { ai:'grok', angle:A.sentiment, reason:R.short_grok }
        ];
      } else if (intent === 'hedge') {
        rec.primary = 'claude';
        rec.complementary = [
          { ai:'deepseek', angle:A.options, reason:R.hedge_deepseek },
          { ai:'chatgpt', angle:A.instruments, reason:R.hedge_chatgpt }
        ];
      } else {
        rec.primary = 'chatgpt';
        rec.complementary = [
          { ai:'claude', angle:A.contra, reason:R.default_claude },
          { ai:'perplexity', angle:A.catalysts, reason:R.default_perplexity }
        ];
      }
    }
    return rec;
  }

  // ── SMART LINKS ──
  var smartLinkLabels = {
    fr: { ecoCalendar:'Calendrier éco' },
    en: { ecoCalendar:'Eco calendar' },
    ar: { ecoCalendar:'تقويم اقتصادي' }
  };

  function getSmartLinks(ticker, assetType) {
    if (!ticker) return [];
    var t = ticker.replace('/','-');
    var links = [];

    if (assetType === 'crypto') {
      var coin = ticker.replace('-USD','').replace('-EUR','').toLowerCase();
      links.push({ icon:'fa-solid fa-chart-line', label:'TradingView', url:'https://www.tradingview.com/symbols/' + ticker.replace('-','') + '/' });
      links.push({ icon:'fa-solid fa-coins', label:'CoinGecko', url:'https://www.coingecko.com/en/coins/' + coin });
      links.push({ icon:'fa-solid fa-chart-area', label:'CoinMarketCap', url:'https://coinmarketcap.com/currencies/' + coin + '/' });
      links.push({ icon:'fa-brands fa-x-twitter', label:'$' + ticker.split('-')[0], url:'https://x.com/search?q=%24' + ticker.split('-')[0] + '&f=live' });
      links.push({ icon:'fa-brands fa-reddit', label:'Reddit', url:'https://www.reddit.com/search/?q=' + coin + '&sort=new' });
    } else if (assetType === 'forex') {
      var pair = ticker.replace('/','');
      links.push({ icon:'fa-solid fa-chart-line', label:'TradingView', url:'https://www.tradingview.com/symbols/' + pair + '/' });
      links.push({ icon:'fa-solid fa-newspaper', label:'ForexFactory', url:'https://www.forexfactory.com/calendar' });
      links.push({ icon:'fa-solid fa-landmark', label:'Fed', url:'https://www.federalreserve.gov/' });
    } else if (assetType === 'macro') {
      links.push({ icon:'fa-solid fa-calendar', label:smartLinkLabels[CURRENT_LANG].ecoCalendar, url:'https://www.forexfactory.com/calendar' });
      links.push({ icon:'fa-solid fa-landmark', label:'Fed', url:'https://www.federalreserve.gov/' });
      links.push({ icon:'fa-solid fa-newspaper', label:'Bloomberg', url:'https://www.bloomberg.com/markets' });
      links.push({ icon:'fa-solid fa-chart-line', label:'TradingView', url:'https://www.tradingview.com/' });
    } else {
      links.push({ icon:'fa-solid fa-chart-column', label:'Yahoo Finance', url:'https://finance.yahoo.com/quote/' + t + '/' });
      links.push({ icon:'fa-solid fa-chart-line', label:'TradingView', url:'https://www.tradingview.com/symbols/' + t + '/' });
      links.push({ icon:'fa-solid fa-table', label:'Finviz', url:'https://finviz.com/quote.ashx?t=' + t });
      if (assetType !== 'index' && assetType !== 'commodity') {
        links.push({ icon:'fa-solid fa-file-lines', label:'SEC EDGAR', url:'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + t + '&type=&dateb=&owner=include&count=10' });
      }
      links.push({ icon:'fa-solid fa-comments', label:'StockTwits', url:'https://stocktwits.com/symbol/' + t });
      links.push({ icon:'fa-brands fa-x-twitter', label:'$' + t, url:'https://x.com/search?q=%24' + t + '&f=live' });
      links.push({ icon:'fa-solid fa-arrow-trend-up', label:'Google Trends', url:'https://trends.google.com/trends/explore?q=' + t + '&geo=US' });
    }
    return links;
  }

  // ── AI PREAMBLES (prompt content — uses report language, not UI language) ──
  var preambleMap = {
    fr: {
      roles: { crypto:'analyste crypto institutionnel', forex:'analyste FX senior', macro:'stratégiste macro', default:'analyste financier institutionnel senior' },
      chatgpt: function(role, ticker) { return 'Tu es un ' + role + ' avec 20 ans d\'expérience. Tu as accès à Internet via le browsing. Recherche les données les plus récentes.\n\nSOURCES à consulter :\n- Yahoo Finance / Google Finance pour les prix et fondamentaux\n- TradingView pour les niveaux techniques\n- SEC EDGAR pour les filings (si applicable)\n- MarketWatch, Bloomberg, Reuters pour les news\n\nIMPORTANT : Chaque chiffre doit provenir d\'une source vérifiable. Si tu ne trouves pas une donnée, dis-le.'; },
      claude: function(role) { return 'Tu es un ' + role + '. Tu n\'as pas accès à Internet mais tu peux fournir une analyse approfondie.\n\nMÉTHODOLOGIE :\n- Indique la date de ta dernière mise à jour\n- Précise si c\'est une donnée connue ou une estimation\n- Propose des LIENS pour vérification manuelle\n- Tableaux Markdown pour les données chiffrées\n\nIMPORTANT : Si tu n\'es pas certain d\'un chiffre, mentionne "à vérifier".'; },
      perplexity: function(role) { return 'Tu es un ' + role + '. Tu as accès à la recherche web en temps réel.\n\nINSTRUCTIONS :\n- Recherche les données les plus récentes\n- Cite TOUTES tes sources avec liens cliquables\n- Recoupement obligatoire : chaque chiffre confirmé par 2+ sources\n- Priorise les données des 7 derniers jours\n\nFORMAT : Markdown structuré avec headers, tableaux, et sources inline.'; },
      grok: function(role, ticker) { return 'Tu es un ' + role + '. Tu as accès aux données X/Twitter en temps réel.\n\nAVANTAGE GROK :\n- Analyse le sentiment autour de $' + ticker + ' sur X/Twitter\n- Identifie les narratifs, influenceurs et changements de sentiment\n- Recherche web pour les données fondamentales\n\nIMPORTANT : Sépare faits et opinions. Chaque chiffre sourcé.'; },
      gemini: function(role) { return 'Tu es un ' + role + '. Tu as accès à la recherche Google.\n\nSOURCES : Google Finance, Yahoo Finance, Google News, Google Trends\n\nFORMAT : Markdown structuré, exhaustif et précis.\n\nIMPORTANT : Ne génère aucun chiffre sans source.'; },
      deepseek: function(role) { return 'Tu es un ' + role + ' spécialisé dans l\'analyse quantitative.\n\nMÉTHODOLOGIE :\n- Analyse détaillée et structurée\n- Tableaux Markdown pour toutes les données\n- Développe les raisonnements et montre tes calculs\n\nIMPORTANT : Marque les données non vérifiables avec [à vérifier].'; }
    },
    en: {
      roles: { crypto:'institutional crypto analyst', forex:'senior FX analyst', macro:'macro strategist', default:'senior institutional financial analyst' },
      chatgpt: function(role, ticker) { return 'You are a ' + role + ' with 20 years of experience. You have Internet access via browsing. Search for the most recent data.\n\nSOURCES to consult:\n- Yahoo Finance / Google Finance for prices and fundamentals\n- TradingView for technical levels\n- SEC EDGAR for filings (if applicable)\n- MarketWatch, Bloomberg, Reuters for news\n\nIMPORTANT: Every figure must come from a verifiable source. If you can\'t find data, say so.'; },
      claude: function(role) { return 'You are a ' + role + '. You don\'t have Internet access but can provide in-depth analysis.\n\nMETHODOLOGY:\n- State your last update date\n- Specify if it\'s known data or an estimate\n- Suggest LINKS for manual verification\n- Markdown tables for numerical data\n\nIMPORTANT: If unsure about a figure, mention "to verify".'; },
      perplexity: function(role) { return 'You are a ' + role + '. You have real-time web search access.\n\nINSTRUCTIONS:\n- Search for the most recent data\n- Cite ALL your sources with clickable links\n- Cross-referencing mandatory: each figure confirmed by 2+ sources\n- Prioritize data from the last 7 days\n\nFORMAT: Structured Markdown with headers, tables, and inline sources.'; },
      grok: function(role, ticker) { return 'You are a ' + role + '. You have real-time X/Twitter data access.\n\nGROK ADVANTAGE:\n- Analyze sentiment around $' + ticker + ' on X/Twitter\n- Identify narratives, influencers and sentiment shifts\n- Web search for fundamental data\n\nIMPORTANT: Separate facts and opinions. Every figure sourced.'; },
      gemini: function(role) { return 'You are a ' + role + '. You have Google search access.\n\nSOURCES: Google Finance, Yahoo Finance, Google News, Google Trends\n\nFORMAT: Structured, comprehensive and precise Markdown.\n\nIMPORTANT: Never generate a figure without a source.'; },
      deepseek: function(role) { return 'You are a ' + role + ' specialized in quantitative analysis.\n\nMETHODOLOGY:\n- Detailed and structured analysis\n- Markdown tables for all data\n- Show your reasoning and calculations\n\nIMPORTANT: Mark unverifiable data with [to verify].'; }
    },
    ar: {
      roles: { crypto:'محلل كريبتو مؤسسي', forex:'محلل FX كبير', macro:'استراتيجي ماكرو', default:'محلل مالي مؤسسي كبير' },
      chatgpt: function(role, ticker) { return 'أنت ' + role + ' بخبرة 20 عامًا. لديك وصول للإنترنت. ابحث عن أحدث البيانات.\n\nالمصادر:\n- Yahoo Finance / Google Finance للأسعار والأساسيات\n- TradingView للمستويات الفنية\n- SEC EDGAR للإيداعات\n- MarketWatch, Bloomberg, Reuters للأخبار\n\nمهم: كل رقم يجب أن يأتي من مصدر قابل للتحقق.'; },
      claude: function(role) { return 'أنت ' + role + '. ليس لديك وصول للإنترنت لكن يمكنك تقديم تحليل معمق.\n\nالمنهجية:\n- حدد تاريخ آخر تحديث\n- وضّح إن كانت بيانات معروفة أو تقديرات\n- اقترح روابط للتحقق اليدوي\n\nمهم: إن لم تكن متأكدًا، اذكر "يجب التحقق".'; },
      perplexity: function(role) { return 'أنت ' + role + '. لديك وصول للبحث في الويب.\n\nالتعليمات:\n- ابحث عن أحدث البيانات\n- استشهد بجميع مصادرك بروابط\n- التحقق المتبادل إلزامي\n\nالصيغة: Markdown منظم.'; },
      grok: function(role, ticker) { return 'أنت ' + role + '. لديك وصول لبيانات X/Twitter.\n\nميزة Grok:\n- حلل المعنويات حول $' + ticker + '\n- حدد السرديات والمؤثرين\n\nمهم: افصل الحقائق عن الآراء.'; },
      gemini: function(role) { return 'أنت ' + role + '. لديك وصول لبحث Google.\n\nالمصادر: Google Finance, Yahoo Finance, Google News\n\nالصيغة: Markdown منظم وشامل.\n\nمهم: لا تنشئ أي رقم بدون مصدر.'; },
      deepseek: function(role) { return 'أنت ' + role + ' متخصص في التحليل الكمي.\n\nالمنهجية:\n- تحليل مفصل ومنظم\n- جداول Markdown لجميع البيانات\n- أظهر حساباتك\n\nمهم: علّم البيانات غير القابلة للتحقق بـ [يجب التحقق].'; }
    }
  };

  function getAiPreamble(ai, ticker, assetType) {
    var reportLang = getSelected('langGroup') || CURRENT_LANG;
    var pm = preambleMap[reportLang] || preambleMap.en;
    var role = pm.roles[assetType] || pm.roles.default;
    var fn = pm[ai] || pm.chatgpt;
    return fn(role, ticker);
  }

  // ── INTENT / FORMAT / LEVEL INSTRUCTIONS (use report language) ──
  var intentMap = {
    fr: {
      inform: 'OBJECTIF : ANALYSE INFORMATIVE\n- Présente les arguments bull ET bear de manière équilibrée\n- Pas de recommandation directe\n- Focus sur la compréhension du business, des fondamentaux et du contexte',
      buy: 'OBJECTIF : ÉVALUATION POUR ACHAT\n- Focus sur : points d\'entrée, supports, catalyseurs haussiers\n- Trade idea obligatoire : entry/stop/TP1/TP2/R:R\n- Si le titre n\'est pas attractif, dis-le clairement',
      sell: 'OBJECTIF : ÉVALUATION POUR VENTE\n- Focus sur : signaux de distribution, résistances, surachat\n- Niveaux de take-profit et zones de danger\n- Si le titre a encore du potentiel, dis-le avec les conditions',
      short: 'OBJECTIF : ÉVALUATION POUR SHORT\n- Focus sur : faiblesses fondamentales, signaux baissiers, surachat\n- Analyse le short interest : SI %, CTB, jours pour couvrir\n- ATTENTION : risque de short squeeze\n- Trade idea short : entry/stop/TP avec R:R',
      hedge: 'OBJECTIF : HEDGING\n- Focus sur : corrélations, beta, instruments de couverture\n- Propose : puts protecteurs, collar, pairs trade\n- Analyse le coût du hedge vs le risque couvert\n- Si options disponibles : Greeks, IV, stratégies optimales',
      scan: 'OBJECTIF : SCREENING / SCANNER\n- Identifie les meilleurs candidats selon les critères donnés\n- Score chaque candidat sur : technique, fondamental, sentiment, risque\n- Top 5-10 avec justification détaillée\n- Pour chaque candidat : entrée suggérée, stop, catalyseur',
      macro: 'OBJECTIF : ANALYSE MACRO\n- Vue d\'ensemble des marchés et de l\'environnement macro\n- Taux, devises, commodities, indices — interconnexions\n- Régime de marché : risk-on / risk-off / transition\n- Implications pour le portefeuille et les secteurs'
    },
    en: {
      inform: 'OBJECTIVE: INFORMATIVE ANALYSIS\n- Present bull AND bear arguments in a balanced way\n- No direct recommendation\n- Focus on understanding the business, fundamentals and context',
      buy: 'OBJECTIVE: BUY EVALUATION\n- Focus on: entry points, supports, bullish catalysts\n- Mandatory trade idea: entry/stop/TP1/TP2/R:R\n- If the stock is not attractive, say so clearly',
      sell: 'OBJECTIVE: SELL EVALUATION\n- Focus on: distribution signals, resistances, overbought\n- Take-profit levels and danger zones\n- If the stock still has potential, state the conditions',
      short: 'OBJECTIVE: SHORT EVALUATION\n- Focus on: fundamental weaknesses, bearish signals, overbought\n- Analyze short interest: SI %, CTB, days to cover\n- WARNING: short squeeze risk\n- Short trade idea: entry/stop/TP with R:R',
      hedge: 'OBJECTIVE: HEDGING\n- Focus on: correlations, beta, hedging instruments\n- Suggest: protective puts, collar, pairs trade\n- Analyze hedge cost vs covered risk\n- If options available: Greeks, IV, optimal strategies',
      scan: 'OBJECTIVE: SCREENING / SCANNER\n- Identify best candidates based on given criteria\n- Score each candidate on: technical, fundamental, sentiment, risk\n- Top 5-10 with detailed justification\n- For each candidate: suggested entry, stop, catalyst',
      macro: 'OBJECTIVE: MACRO ANALYSIS\n- Market overview and macro environment\n- Rates, FX, commodities, indices — interconnections\n- Market regime: risk-on / risk-off / transition\n- Portfolio and sector implications'
    },
    ar: {
      inform: 'الهدف: تحليل معلوماتي\n- قدم حجج الشراء والبيع بشكل متوازن\n- بدون توصية مباشرة\n- التركيز على فهم العمل والأساسيات والسياق',
      buy: 'الهدف: تقييم للشراء\n- التركيز على: نقاط الدخول، الدعم، المحفزات الصعودية\n- فكرة تداول إلزامية: دخول/وقف/TP1/TP2/R:R',
      sell: 'الهدف: تقييم للبيع\n- التركيز على: إشارات التوزيع، المقاومات\n- مستويات جني الأرباح ومناطق الخطر',
      short: 'الهدف: تقييم للبيع على المكشوف\n- التركيز على: نقاط الضعف الأساسية، إشارات هبوطية\n- تحليل SI %، CTB\n- تحذير: خطر short squeeze',
      hedge: 'الهدف: التحوط\n- التركيز على: الارتباطات، بيتا، أدوات التحوط\n- اقتراح: puts واقية، collar، pairs trade',
      scan: 'الهدف: فرز / مسح\n- حدد أفضل المرشحين\n- سجل كل مرشح: فني، أساسي، معنويات، مخاطر\n- أعلى 5-10 مع تبرير مفصل',
      macro: 'الهدف: تحليل ماكرو\n- نظرة عامة على الأسواق والبيئة الكلية\n- أسعار، عملات، سلع، مؤشرات — ترابطات\n- نظام السوق: risk-on / risk-off'
    }
  };

  var formatMap = {
    fr: {
      detailed: 'FORMAT : Analyse détaillée.\n- Headers Markdown (##) pour chaque section\n- Tableaux pour les données chiffrées\n- Minimum 3000 mots\n- Emoji pour les signaux (✅ bullish, ❌ bearish, ⚪ neutre)',
      concise: 'FORMAT : Synthèse exécutive.\n- Max 800 mots, bullet points\n- Verdict → Niveaux → Risques → Action\n- 1 phrase max par point',
      telegram: 'FORMAT : Message Telegram (max 4000 chars).\n- Emoji pour structurer : 📊 💰 📈 💡 ⚠️ 🔗\n- Compact et scannable',
      twitter: 'FORMAT : Thread X/Twitter (5-8 tweets, 280 chars max).\n- $TICKER (cashtag) dans chaque tweet\n- Max 2 hashtags/tweet'
    },
    en: {
      detailed: 'FORMAT: Detailed analysis.\n- Markdown headers (##) for each section\n- Tables for numerical data\n- Minimum 3000 words\n- Emoji for signals (✅ bullish, ❌ bearish, ⚪ neutral)',
      concise: 'FORMAT: Executive summary.\n- Max 800 words, bullet points\n- Verdict → Levels → Risks → Action\n- 1 sentence max per point',
      telegram: 'FORMAT: Telegram message (max 4000 chars).\n- Emoji to structure: 📊 💰 📈 💡 ⚠️ 🔗\n- Compact and scannable',
      twitter: 'FORMAT: X/Twitter thread (5-8 tweets, 280 chars max).\n- $TICKER (cashtag) in each tweet\n- Max 2 hashtags/tweet'
    },
    ar: {
      detailed: 'الصيغة: تحليل مفصل.\n- عناوين Markdown (##) لكل قسم\n- جداول للبيانات الرقمية\n- حد أدنى 3000 كلمة',
      concise: 'الصيغة: ملخص تنفيذي.\n- حد أقصى 800 كلمة\n- حكم → مستويات → مخاطر → إجراء',
      telegram: 'الصيغة: رسالة Telegram (حد أقصى 4000 حرف).\n- إيموجي للتنظيم',
      twitter: 'الصيغة: سلسلة X/Twitter (5-8 تغريدات، 280 حرف كحد أقصى).\n- $TICKER في كل تغريدة'
    }
  };

  var levelMap = {
    fr: {
      beginner: 'NIVEAU : DÉBUTANT\n- Explique chaque terme technique entre parenthèses\n- Analogies du quotidien pour les concepts complexes\n- Avis clair et actionnable\n- Rappelle les règles de base (diversifier, ne pas investir plus qu\'on peut perdre)',
      intermediate: 'NIVEAU : INTERMÉDIAIRE\n- L\'utilisateur connaît RSI, MACD, P/E, EPS\n- Confluence des signaux techniques et fondamentaux\n- Trade ideas avec sizing et gestion du risque',
      expert: 'NIVEAU : EXPERT\n- Terminologie sans explication : Wyckoff, VWAP, gamma exposure, dark pools\n- Analyse quantitative, Greeks, inter-marché\n- Trades complexes : spreads, hedges, Kelly criterion\n- Flux institutionnels (13F, dark pools, block trades)'
    },
    en: {
      beginner: 'LEVEL: BEGINNER\n- Explain each technical term in parentheses\n- Daily-life analogies for complex concepts\n- Clear, actionable opinion\n- Remind basic rules (diversify, never invest more than you can afford to lose)',
      intermediate: 'LEVEL: INTERMEDIATE\n- User knows RSI, MACD, P/E, EPS\n- Technical and fundamental signal confluence\n- Trade ideas with sizing and risk management',
      expert: 'LEVEL: EXPERT\n- No explanations needed: Wyckoff, VWAP, gamma exposure, dark pools\n- Quantitative analysis, Greeks, cross-market\n- Complex trades: spreads, hedges, Kelly criterion\n- Institutional flows (13F, dark pools, block trades)'
    },
    ar: {
      beginner: 'المستوى: مبتدئ\n- اشرح كل مصطلح تقني بين قوسين\n- تشبيهات من الحياة اليومية\n- رأي واضح وقابل للتنفيذ',
      intermediate: 'المستوى: متوسط\n- المستخدم يعرف RSI, MACD, P/E, EPS\n- تقاطع الإشارات الفنية والأساسية\n- أفكار تداول مع sizing وإدارة المخاطر',
      expert: 'المستوى: خبير\n- لا حاجة لشرح: Wyckoff, VWAP, gamma exposure, dark pools\n- تحليل كمي، Greeks، عبر الأسواق\n- تداولات معقدة: spreads, hedges, Kelly criterion'
    }
  };

  function getIntentInstructions(intent) {
    var reportLang = getSelected('langGroup') || CURRENT_LANG;
    var m = intentMap[reportLang] || intentMap.en;
    return m[intent] || m.inform;
  }
  function getFormatInstructions(format) {
    var reportLang = getSelected('langGroup') || CURRENT_LANG;
    var m = formatMap[reportLang] || formatMap.en;
    return m[format] || m.detailed;
  }
  function getLevelInstructions(level) {
    var reportLang = getSelected('langGroup') || CURRENT_LANG;
    var m = levelMap[reportLang] || levelMap.en;
    return m[level] || m.intermediate;
  }

  // ── SECTIONS (adapted per asset type, in report language) ──
  var sectionsMap = {
    fr: {
      crypto: function() { return {
        verdict: '## 1. VERDICT EXPRESS\n- Note : A+ à D, conviction %, biais\n- Ce que fait le projet en 2-3 phrases\n- Radar : Tokenomics, Adoption, Technique, Risque, Narratif (/10)',
        tokenomics: '## 2. TOKENOMICS\n- Supply : max, circulating, inflation rate\n- Distribution : team, VCs, community, treasury\n- Vesting schedule & prochains unlocks\n- Mécanismes : burn, staking rewards, buyback',
        onchain: '## 3. ON-CHAIN\n- TVL (Total Value Locked) et tendance\n- Active addresses (30d trend)\n- Volume DEX vs CEX\n- Whale wallets : accumulation ou distribution\n- Staking ratio',
        news: '## 4. ACTUALITÉS & ROADMAP\n- 4-6 news récentes avec impact\n- Roadmap : prochaines étapes\n- Upgrades techniques (ex: EIP, hard fork)',
        technicals: '## 5. ANALYSE TECHNIQUE\n| Indicateur | Valeur | Signal |\n|------------|--------|--------|\n| RSI(14) | | |\n| MACD | | |\n| EMA 20/50/200 | | |\n| Funding rate | | |\n| Open Interest | | |\n- Supports & Résistances clés\n- Pattern en cours',
        sentiment: '## 6. SENTIMENT & SOCIAL\n- X/Twitter : tendance, influenceurs\n- Reddit : activité, sentiment\n- Fear & Greed Index crypto\n- Narratif dominant',
        risk: '## 7. RISQUES\n1. Régulation (SEC, MiCA)\n2. Smart contract (audits, bugs)\n3. Concentration des holders\n4. Concurrence\n5. Liquidité\n- Score risque : 1-10',
        trade: '## 8. TRADE IDEA\n- Entrée, Stop Loss, TP1, TP2, R/R\n- Signaux de confirmation / invalidation\n- Horizon et sizing',
        rating: '## 9. NOTE GLOBALE\n- Conviction A+ à D\n- Biais + Confiance %\n- 3 points positifs + 3 risques'
      }; },
      forex: function() { return {
        verdict: '## 1. VERDICT EXPRESS\n- Biais directionnel + conviction\n- Paire en 1 phrase\n- Radar : Taux, Technique, Sentiment, Macro, Flux (/10)',
        rates: '## 2. DIFFÉRENTIELS DE TAUX\n- Taux directeurs des deux banques centrales\n- Anticipations de marché (Fed funds futures, OIS)\n- Carry trade : rendement vs risque',
        macro: '## 3. CONTEXTE MACRO\n- Balance commerciale\n- Flux de capitaux\n- Indicateurs récents (CPI, PMI, NFP)\n- Divergence de cycle économique',
        cot: '## 4. POSITIONNEMENT\n- COT (Commitment of Traders)\n- Positionnement spéculatif net\n- Extrêmes historiques',
        technicals: '## 5. ANALYSE TECHNIQUE\n| Indicateur | Valeur | Signal |\n|------------|--------|--------|\n| RSI(14) | | |\n| MACD | | |\n| EMA 20/50/200 | | |\n- Supports & Résistances\n- Pattern en cours\n- Corrélation DXY, or, pétrole',
        trade: '## 6. TRADE IDEA\n- Entrée, Stop, TP1, TP2, R/R\n- Pips risk, position sizing\n- Horizon',
        rating: '## 7. NOTE GLOBALE\n- Conviction + biais directionnel'
      }; },
      macro: function() { return {
        regime: '## 1. RÉGIME DE MARCHÉ\n- Risk-on / Risk-off / Transition\n- VIX, credit spreads, DXY, courbe des taux\n- Comparaison avec régimes historiques similaires',
        rates: '## 2. TAUX & OBLIGATIONS\n- US10Y, US2Y, spread 2Y/10Y\n- Anticipations Fed (dots, futures)\n- Crédit : investment grade vs high yield spreads',
        fx: '## 3. DEVISES\n- DXY et majeurs (EUR, JPY, GBP)\n- Émergents à surveiller\n- Implications pour les earnings US',
        commodities: '## 4. MATIÈRES PREMIÈRES\n- Pétrole : supply/demand, OPEC\n- Or : risk-off proxy, real yields\n- Cuivre : indicateur économique avancé',
        indices: '## 5. INDICES\n- S&P 500, Nasdaq, Russell 2000\n- Market breadth : advance/decline, % above 200MA\n- Rotation sectorielle',
        geo: '## 6. GÉOPOLITIQUE\n- Risques géopolitiques majeurs\n- Impact sur les marchés\n- Tarifs / sanctions / élections',
        calendar: '## 7. CALENDRIER\n- Données macro à venir (semaine prochaine)\n- Earnings majeurs\n- Réunions banques centrales',
        positioning: '## 8. POSITIONNEMENT\n- Flows ETF (risk-on vs defensive)\n- Put/Call ratio, AAII sentiment\n- Secteurs : surpondérer / sous-pondérer',
        rating: '## 9. CONCLUSION\n- Scénario central + scénario alternatif\n- Actions recommandées pour le portefeuille'
      }; },
      commodity: function() { return {
        verdict: '## 1. VERDICT EXPRESS\n- Biais + conviction\n- Radar : Supply, Demand, Technique, Macro, Saisonnalité (/10)',
        supply: '## 2. OFFRE\n- Production mondiale, stocks\n- OPEC / producteurs majeurs\n- Perturbations géopolitiques',
        demand: '## 3. DEMANDE\n- Consommation par zone (US, Chine, EU)\n- Cycle industriel\n- Tendances structurelles (transition énergétique)',
        technicals: '## 4. ANALYSE TECHNIQUE\n- Supports & Résistances\n- Contango vs backwardation (courbe futures)\n- Saisonnalité historique',
        macro: '## 5. CONTEXTE MACRO\n- DXY (corrélation inverse)\n- Inflation expectations\n- Politique monétaire',
        trade: '## 6. TRADE IDEA\n- Entrée, Stop, TP1, TP2, R/R\n- Instrument recommandé (futures, ETF, CFD)',
        rating: '## 7. NOTE GLOBALE'
      }; },
      stock: function(assetType) {
        var s = {
          verdict: '## 1. VERDICT EXPRESS\n- Note : A+ à D, conviction %, biais\n- Ce que fait l\'entreprise en 2-3 phrases\n- 3 raisons d\'acheter vs 3 raisons d\'éviter\n- Radar : Marges, ROE, Croissance, Cash Flow, Valorisation, Momentum (/10)',
          business: '## 2. BUSINESS MODEL\n- Segments principaux avec % du CA\n- Moat / avantage compétitif\n- Position dans le cycle de vie',
          news: '## 3. ACTUALITÉS RÉCENTES\n- 4-6 news : [Date] Titre — Impact (✅/❌/⚪)',
          fundamentals: '## 4. FONDAMENTAUX\n| Métrique | Valeur | Commentaire |\n|----------|--------|-------------|\n| CA | | YoY % |\n| EBITDA | | Marge % |\n| EPS | | vs consensus |\n| P/E | | vs secteur |\n| FCF | | Yield % |\n| Dette/Equity | | |\n| Target analystes | | Upside % |',
          insiders: '## 5. INSIDERS & INSTITUTIONNELS\n- % insiders, transactions récentes\n- % institutions, top 5 holders',
          technicals: '## 6. ANALYSE TECHNIQUE\n| Indicateur | Valeur | Signal |\n|------------|--------|--------|\n| RSI(14) | | |\n| MACD | | |\n| EMA 20/50/200 | | |\n- 3 Supports + 3 Résistances\n- Pattern en cours\n- Signal global',
          sector: '## 7. POSITIONNEMENT SECTORIEL\n- Comparaison 4-5 peers\n- Performance relative',
          macro: '## 8. CONTEXTE MACRO\n- Régime : risk-on / risk-off\n- Corrélations SPX, VIX, DXY, taux\n- Impact macro sur le titre',
          risk: '## 9. RISQUES\n1. Dilution 2. Short Interest 3. Cash Burn 4. Exécution 5. Régulation\n- Score risque : 1-10',
          trade: '## 10. TRADE IDEA\n- Entrée, Stop Loss, TP1, TP2, R/R (min 1:1.5)\n- Thèse du trade, confirmations, invalidations\n- Horizon, sizing',
          sharia: '## 11. CONFORMITÉ SHARIA\n- ✅ Halal | ⚠️ Borderline | ❌ Non-Halal\n- Ratio dette/capitalisation (< 30%)\n- Revenus non-halal (< 5%)',
          rating: '## 12. NOTE GLOBALE\n- Conviction A+ à D\n- Biais + Confiance %\n- 3 points positifs + 3 risques majeurs'
        };
        if (assetType === 'biotech') s.pipeline = '## PIPELINE & FDA\n- Phase I/II/III : molécules en développement\n- Prochaines dates FDA (PDUFA, AdCom)\n- Probabilité de succès par phase\n- Comparaison avec concurrents en développement\n- Brevets : expiration, exclusivité';
        if (assetType === 'etf') { s.holdings = '## STRUCTURE ETF\n- Top 10 holdings avec %\n- Concentration (top 10 = X%)\n- TER / frais\n- Tracking error vs benchmark\n- Flows récents (inflows/outflows)\n- Réplication : physique vs synthétique'; delete s.insiders; delete s.business; }
        if (assetType === 'index') { delete s.insiders; delete s.business; s.breadth = '## MARKET BREADTH\n- Advance/Decline line\n- % au-dessus EMA 200\n- Nombre de nouveaux highs vs lows\n- McClellan Oscillator si disponible'; }
        return s;
      }
    },
    en: {
      crypto: function() { return {
        verdict: '## 1. EXPRESS VERDICT\n- Rating: A+ to D, conviction %, bias\n- What the project does in 2-3 sentences\n- Radar: Tokenomics, Adoption, Technical, Risk, Narrative (/10)',
        tokenomics: '## 2. TOKENOMICS\n- Supply: max, circulating, inflation rate\n- Distribution: team, VCs, community, treasury\n- Vesting schedule & upcoming unlocks\n- Mechanisms: burn, staking rewards, buyback',
        onchain: '## 3. ON-CHAIN\n- TVL (Total Value Locked) and trend\n- Active addresses (30d trend)\n- Volume DEX vs CEX\n- Whale wallets: accumulation or distribution\n- Staking ratio',
        news: '## 4. NEWS & ROADMAP\n- 4-6 recent news with impact\n- Roadmap: next milestones\n- Technical upgrades (e.g. EIP, hard fork)',
        technicals: '## 5. TECHNICAL ANALYSIS\n| Indicator | Value | Signal |\n|-----------|-------|--------|\n| RSI(14) | | |\n| MACD | | |\n| EMA 20/50/200 | | |\n| Funding rate | | |\n| Open Interest | | |\n- Key Supports & Resistances\n- Current pattern',
        sentiment: '## 6. SENTIMENT & SOCIAL\n- X/Twitter: trend, influencers\n- Reddit: activity, sentiment\n- Crypto Fear & Greed Index\n- Dominant narrative',
        risk: '## 7. RISKS\n1. Regulation (SEC, MiCA)\n2. Smart contract (audits, bugs)\n3. Holder concentration\n4. Competition\n5. Liquidity\n- Risk score: 1-10',
        trade: '## 8. TRADE IDEA\n- Entry, Stop Loss, TP1, TP2, R/R\n- Confirmation / invalidation signals\n- Horizon and sizing',
        rating: '## 9. OVERALL RATING\n- Conviction A+ to D\n- Bias + Confidence %\n- 3 positives + 3 risks'
      }; },
      forex: function() { return {
        verdict: '## 1. EXPRESS VERDICT\n- Directional bias + conviction\n- Pair in 1 sentence\n- Radar: Rates, Technical, Sentiment, Macro, Flows (/10)',
        rates: '## 2. RATE DIFFERENTIALS\n- Policy rates of both central banks\n- Market expectations (Fed funds futures, OIS)\n- Carry trade: yield vs risk',
        macro: '## 3. MACRO CONTEXT\n- Trade balance\n- Capital flows\n- Recent indicators (CPI, PMI, NFP)\n- Economic cycle divergence',
        cot: '## 4. POSITIONING\n- COT (Commitment of Traders)\n- Net speculative positioning\n- Historical extremes',
        technicals: '## 5. TECHNICAL ANALYSIS\n| Indicator | Value | Signal |\n|-----------|-------|--------|\n| RSI(14) | | |\n| MACD | | |\n| EMA 20/50/200 | | |\n- Supports & Resistances\n- Current pattern\n- DXY, gold, oil correlation',
        trade: '## 6. TRADE IDEA\n- Entry, Stop, TP1, TP2, R/R\n- Pips risk, position sizing\n- Horizon',
        rating: '## 7. OVERALL RATING\n- Conviction + directional bias'
      }; },
      macro: function() { return {
        regime: '## 1. MARKET REGIME\n- Risk-on / Risk-off / Transition\n- VIX, credit spreads, DXY, yield curve\n- Comparison with similar historical regimes',
        rates: '## 2. RATES & BONDS\n- US10Y, US2Y, 2Y/10Y spread\n- Fed expectations (dots, futures)\n- Credit: IG vs HY spreads',
        fx: '## 3. CURRENCIES\n- DXY and majors (EUR, JPY, GBP)\n- Emerging markets to watch\n- Implications for US earnings',
        commodities: '## 4. COMMODITIES\n- Oil: supply/demand, OPEC\n- Gold: risk-off proxy, real yields\n- Copper: leading economic indicator',
        indices: '## 5. INDICES\n- S&P 500, Nasdaq, Russell 2000\n- Market breadth: advance/decline, % above 200MA\n- Sector rotation',
        geo: '## 6. GEOPOLITICS\n- Major geopolitical risks\n- Market impact\n- Tariffs / sanctions / elections',
        calendar: '## 7. CALENDAR\n- Upcoming macro data (next week)\n- Major earnings\n- Central bank meetings',
        positioning: '## 8. POSITIONING\n- ETF flows (risk-on vs defensive)\n- Put/Call ratio, AAII sentiment\n- Sectors: overweight / underweight',
        rating: '## 9. CONCLUSION\n- Central scenario + alternative scenario\n- Recommended portfolio actions'
      }; },
      commodity: function() { return {
        verdict: '## 1. EXPRESS VERDICT\n- Bias + conviction\n- Radar: Supply, Demand, Technical, Macro, Seasonality (/10)',
        supply: '## 2. SUPPLY\n- Global production, inventories\n- OPEC / major producers\n- Geopolitical disruptions',
        demand: '## 3. DEMAND\n- Consumption by region (US, China, EU)\n- Industrial cycle\n- Structural trends (energy transition)',
        technicals: '## 4. TECHNICAL ANALYSIS\n- Supports & Resistances\n- Contango vs backwardation (futures curve)\n- Historical seasonality',
        macro: '## 5. MACRO CONTEXT\n- DXY (inverse correlation)\n- Inflation expectations\n- Monetary policy',
        trade: '## 6. TRADE IDEA\n- Entry, Stop, TP1, TP2, R/R\n- Recommended instrument (futures, ETF, CFD)',
        rating: '## 7. OVERALL RATING'
      }; },
      stock: function(assetType) {
        var s = {
          verdict: '## 1. EXPRESS VERDICT\n- Rating: A+ to D, conviction %, bias\n- What the company does in 2-3 sentences\n- 3 reasons to buy vs 3 reasons to avoid\n- Radar: Margins, ROE, Growth, Cash Flow, Valuation, Momentum (/10)',
          business: '## 2. BUSINESS MODEL\n- Main segments with % of revenue\n- Moat / competitive advantage\n- Position in lifecycle',
          news: '## 3. RECENT NEWS\n- 4-6 news: [Date] Title — Impact (✅/❌/⚪)',
          fundamentals: '## 4. FUNDAMENTALS\n| Metric | Value | Comment |\n|--------|-------|---------|\n| Revenue | | YoY % |\n| EBITDA | | Margin % |\n| EPS | | vs consensus |\n| P/E | | vs sector |\n| FCF | | Yield % |\n| Debt/Equity | | |\n| Analyst Target | | Upside % |',
          insiders: '## 5. INSIDERS & INSTITUTIONS\n- % insiders, recent transactions\n- % institutions, top 5 holders',
          technicals: '## 6. TECHNICAL ANALYSIS\n| Indicator | Value | Signal |\n|-----------|-------|--------|\n| RSI(14) | | |\n| MACD | | |\n| EMA 20/50/200 | | |\n- 3 Supports + 3 Resistances\n- Current pattern\n- Overall signal',
          sector: '## 7. SECTOR POSITIONING\n- Comparison with 4-5 peers\n- Relative performance',
          macro: '## 8. MACRO CONTEXT\n- Regime: risk-on / risk-off\n- Correlations SPX, VIX, DXY, rates\n- Macro impact on the stock',
          risk: '## 9. RISKS\n1. Dilution 2. Short Interest 3. Cash Burn 4. Execution 5. Regulation\n- Risk score: 1-10',
          trade: '## 10. TRADE IDEA\n- Entry, Stop Loss, TP1, TP2, R/R (min 1:1.5)\n- Trade thesis, confirmations, invalidations\n- Horizon, sizing',
          sharia: '## 11. SHARIA COMPLIANCE\n- ✅ Halal | ⚠️ Borderline | ❌ Non-Halal\n- Debt/capitalization ratio (< 30%)\n- Non-halal revenue (< 5%)',
          rating: '## 12. OVERALL RATING\n- Conviction A+ to D\n- Bias + Confidence %\n- 3 positives + 3 major risks'
        };
        if (assetType === 'biotech') s.pipeline = '## PIPELINE & FDA\n- Phase I/II/III: molecules in development\n- Upcoming FDA dates (PDUFA, AdCom)\n- Success probability by phase\n- Comparison with competitors\n- Patents: expiration, exclusivity';
        if (assetType === 'etf') { s.holdings = '## ETF STRUCTURE\n- Top 10 holdings with %\n- Concentration (top 10 = X%)\n- TER / fees\n- Tracking error vs benchmark\n- Recent flows (inflows/outflows)\n- Replication: physical vs synthetic'; delete s.insiders; delete s.business; }
        if (assetType === 'index') { delete s.insiders; delete s.business; s.breadth = '## MARKET BREADTH\n- Advance/Decline line\n- % above EMA 200\n- New highs vs new lows\n- McClellan Oscillator if available'; }
        return s;
      }
    },
    ar: { crypto: function() { return sectionsMap.en.crypto(); }, forex: function() { return sectionsMap.en.forex(); }, macro: function() { return sectionsMap.en.macro(); }, commodity: function() { return sectionsMap.en.commodity(); }, stock: function(a) { return sectionsMap.en.stock(a); } }
  };

  function getSections(focus, level, intent, assetType) {
    var reportLang = getSelected('langGroup') || CURRENT_LANG;
    var sm = sectionsMap[reportLang] || sectionsMap.en;
    var sections;
    if (assetType === 'crypto') sections = sm.crypto();
    else if (assetType === 'forex') sections = sm.forex();
    else if (assetType === 'macro') sections = sm.macro();
    else if (assetType === 'commodity') sections = sm.commodity();
    else sections = sm.stock(assetType);

    var focusMap = {
      all: Object.keys(sections),
      technical: ['verdict','technicals','trade','rating'],
      fundamental: ['verdict','business','fundamentals','insiders','sector','rating'],
      sentiment: ['verdict','news','sentiment','rating'],
      risk: ['verdict','risk','rating'],
      trade: ['verdict','technicals','trade','rating'],
      sharia: ['verdict','business','fundamentals','sharia','risk','rating']
    };

    var selected = [];
    focus.forEach(function(f) {
      (focusMap[f] || focusMap.all).forEach(function(k) {
        if (selected.indexOf(k) === -1 && sections[k]) selected.push(k);
      });
    });
    if (selected.length === 0) selected = Object.keys(sections);

    if (level !== 'expert') {
      selected = selected.filter(function(s) { return s !== 'bottom' && s !== 'manipulation'; });
    }
    if (['buy','sell','short','hedge'].indexOf(intent) !== -1 && selected.indexOf('trade') === -1 && sections.trade) {
      selected.splice(selected.length - 1, 0, 'trade');
    }

    var result = '', num = 1;
    selected.forEach(function(key) {
      if (sections[key]) {
        result += sections[key].replace(/^## \d+\./, '## ' + num + '.') + '\n\n';
        num++;
      }
    });
    return result;
  }

  // ── GENERATE PROMPT ──
  var promptLangInstr = {
    fr: 'LANGUE : FRANÇAIS\nRédige en français. Accents obligatoires.',
    en: 'LANGUAGE: ENGLISH\nWrite in professional financial English.',
    ar: 'اللغة: العربية\nاكتب التحليل بالعربية الفصحى.'
  };
  var promptAssetLabels = {
    fr: { stock:'Action', biotech:'Biotech', crypto:'Crypto', etf:'ETF', forex:'Forex', commodity:'Matière première', index:'Indice', macro:'Macro' },
    en: { stock:'Stock', biotech:'Biotech', crypto:'Crypto', etf:'ETF', forex:'Forex', commodity:'Commodity', index:'Index', macro:'Macro' },
    ar: { stock:'سهم', biotech:'بيوتك', crypto:'كريبتو', etf:'ETF', forex:'فوركس', commodity:'سلعة', index:'مؤشر', macro:'ماكرو' }
  };
  var promptMiscLabels = {
    fr: {
      asset: 'ACTIF', overview: "Vue d'ensemble", date: "DATE : aujourd'hui",
      thesis: "THÈSE D'INVESTISSEMENT", thesisValidate: "Valide ou infirme cette thèse avec des données. Si fragile, dis-le clairement.",
      catalysts: "CATALYSEURS À ANALYSER",
      sections: "SECTIONS", antiHalluc: "RÈGLES ANTI-HALLUCINATION",
      ah1: "1. NE JAMAIS inventer un chiffre — écris \"Non disponible\" si inconnu",
      ah2: "2. Chaque métrique DOIT avoir sa source et sa date",
      ah3: "3. Distingue FAITS et OPINIONS", ah4: "4. NE JAMAIS garantir un rendement", ah5: "5. Disclaimer obligatoire en fin d'analyse",
      pedagogy: "COUCHE PÉDAGOGIQUE", ped1: "- Explique ton raisonnement", ped2: "- UN insight d'apprentissage", ped3: "- UN piège de trading courant à éviter",
      final: "BLOC FINAL", launch: "Lance l'analyse maintenant.",
      continuation: "IMPORTANT : Si tu atteins la limite de longueur, termine la section en cours et écris :\n\"⏩ SUITE — tape 'Continuer' pour la suite.\""
    },
    en: {
      asset: 'ASSET', overview: 'Overview', date: 'DATE: today',
      thesis: 'INVESTMENT THESIS', thesisValidate: 'Validate or disprove this thesis with data. If fragile, say so clearly.',
      catalysts: 'CATALYSTS TO ANALYZE',
      sections: 'SECTIONS', antiHalluc: 'ANTI-HALLUCINATION RULES',
      ah1: '1. NEVER invent a figure — write "Not available" if unknown',
      ah2: '2. Every metric MUST have its source and date',
      ah3: '3. Distinguish FACTS and OPINIONS', ah4: '4. NEVER guarantee a return', ah5: '5. Mandatory disclaimer at end of analysis',
      pedagogy: 'EDUCATIONAL LAYER', ped1: '- Explain your reasoning', ped2: '- ONE learning insight', ped3: '- ONE common trading trap to avoid',
      final: 'FINAL BLOCK', launch: 'Start the analysis now.',
      continuation: 'IMPORTANT: If you reach the length limit, finish the current section and write:\n"⏩ CONTINUED — type \'Continue\' for the rest."'
    },
    ar: {
      asset: 'الأصل', overview: 'نظرة عامة', date: 'التاريخ: اليوم',
      thesis: 'أطروحة الاستثمار', thesisValidate: 'تحقق من هذه الأطروحة بالبيانات. إن كانت هشة، قل ذلك بوضوح.',
      catalysts: 'المحفزات للتحليل',
      sections: 'الأقسام', antiHalluc: 'قواعد مكافحة الهلوسة',
      ah1: '1. لا تخترع أي رقم — اكتب "غير متوفر" إن كان مجهولًا',
      ah2: '2. كل مقياس يجب أن يكون له مصدر وتاريخ',
      ah3: '3. ميّز بين الحقائق والآراء', ah4: '4. لا تضمن أي عائد أبدًا', ah5: '5. إخلاء مسؤولية إلزامي',
      pedagogy: 'طبقة تعليمية', ped1: '- اشرح تفكيرك', ped2: '- درس تعليمي واحد', ped3: '- فخ تداول شائع لتجنبه',
      final: 'الكتلة النهائية', launch: 'ابدأ التحليل الآن.',
      continuation: 'مهم: إذا وصلت لحد الطول، أنهِ القسم الحالي واكتب:\n"⏩ يتبع — اكتب \'متابعة\' للبقية."'
    }
  };

  function generatePrompt(ai, assetType) {
    var ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    if (!ticker && assetType !== 'macro') return null;

    var thesis = document.getElementById('thesisInput').value.trim();
    var catalyst = document.getElementById('catalystInput').value.trim();
    var lang = getSelected('langGroup') || CURRENT_LANG;
    var level = getSelected('levelGroup') || 'intermediate';
    var format = getSelected('formatGroup') || 'detailed';
    var focus = getAllSelected('focusGroup');
    var intent = getSelected('intentGroup') || 'inform';
    var ML = promptMiscLabels[lang] || promptMiscLabels.en;
    var assetLabel = promptAssetLabels[lang] || promptAssetLabels.en;

    var p = '';
    p += getAiPreamble(ai, ticker, assetType) + '\n\n';
    p += ML.continuation + '\n\n';

    p += '═══════════════════════════════════════\n';
    p += (promptLangInstr[lang] || promptLangInstr.en) + '\n';
    p += '═══════════════════════════════════════\n\n';

    p += getLevelInstructions(level) + '\n\n';
    p += getIntentInstructions(intent) + '\n\n';
    p += getFormatInstructions(format) + '\n\n';

    p += '═══════════════════════════════════════\n';
    p += ML.asset + ' : ' + (ticker || ML.overview) + ' (' + (assetLabel[assetType] || 'Stock') + ')\n';
    p += ML.date + '\n';
    p += '═══════════════════════════════════════\n\n';

    if (thesis) {
      p += ML.thesis + ' :\n« ' + thesis + ' »\n' + ML.thesisValidate + '\n\n';
    }
    if (catalyst) {
      p += ML.catalysts + ' :\n' + catalyst + '\n\n';
    }

    p += '═══════════════════════════════════════\n' + ML.sections + '\n═══════════════════════════════════════\n\n';
    p += getSections(focus, level, intent, assetType);

    p += '═══════════════════════════════════════\n' + ML.antiHalluc + '\n═══════════════════════════════════════\n';
    p += ML.ah1 + '\n' + ML.ah2 + '\n' + ML.ah3 + '\n' + ML.ah4 + '\n' + ML.ah5 + '\n\n';

    if (level === 'beginner' || level === 'intermediate') {
      p += '═══════════════════════════════════════\n' + ML.pedagogy + '\n═══════════════════════════════════════\n';
      p += ML.ped1 + '\n' + ML.ped2 + '\n' + ML.ped3 + '\n\n';
    }

    p += '═══════════════════════════════════════\n' + ML.final + '\n═══════════════════════════════════════\n';
    p += '✅ Points clés (3-5)\n⚠️ Risques (3-5)\n🎯 Biais & Déclencheur\n📊 Conviction : [Note] | Confiance : [%]\n\n';
    p += ML.launch;
    return p;
  }

  // ── GENERATE BUTTON ──
  document.getElementById('generateBtn').addEventListener('click', function() {
    var ticker = document.getElementById('tickerInput').value.trim();
    var assetType = getSelected('assetGroup') || 'stock';
    var intent = getSelected('intentGroup') || 'inform';

    if (!ticker && assetType !== 'macro') {
      document.getElementById('tickerInput').focus();
      document.getElementById('tickerInput').classList.add('error');
      setTimeout(function() { document.getElementById('tickerInput').classList.remove('error'); }, 2000);
      return;
    }

    var btn = this;
    btn.disabled = true;
    btn.classList.add('generating');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + L.generating;

    setTimeout(function() {
      var selectedAi = getSelected('aiGroup');
      var rec = getAiRecommendations(assetType, intent);
      var primaryAi = (selectedAi && selectedAi !== 'auto') ? selectedAi : rec.primary;

      var prompt = generatePrompt(primaryAi, assetType);
      if (!prompt) {
        btn.disabled = false;
        btn.classList.remove('generating');
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ' + L.generateFull;
        return;
      }

      document.getElementById('promptOutput').textContent = prompt;
      document.getElementById('outputTarget').innerHTML = '<i class="fa-solid fa-robot"></i> ' + (aiLabels[primaryAi] || primaryAi);
      var badgeLabels = LANG.assetBadgeLabels[CURRENT_LANG];
      document.getElementById('outputAsset').innerHTML = '<i class="fa-solid fa-tag"></i> ' + (badgeLabels[assetType] || '');
      document.getElementById('outputChars').innerHTML = '<i class="fa-solid fa-text-width"></i> ' + prompt.length.toLocaleString() + ' chars';

      // Complementary prompts
      var compArea = document.getElementById('compPromptsArea');
      compArea.innerHTML = '';
      if (rec.complementary.length > 0) {
        var h = '<h4><i class="fa-solid fa-layer-group"></i> ' + L.compTitle + '</h4>';
        rec.complementary.forEach(function(c) {
          var compPrompt = generatePrompt(c.ai, assetType);
          h += '<div class="comp-card">';
          h += '<span class="comp-ai-badge ' + c.ai + '">' + (aiLabels[c.ai] || c.ai) + '</span>';
          h += '<div class="comp-info"><p class="comp-angle">' + c.angle + '</p><p class="comp-reason">' + c.reason + '</p></div>';
          h += '<button class="comp-open" data-ai="' + c.ai + '" data-prompt="' + btoa(unescape(encodeURIComponent(compPrompt))) + '" onclick="openCompInAi(this)"><i class="fa-solid fa-arrow-up-right-from-square"></i> ' + L.openIn + (aiLabels[c.ai] || c.ai) + '</button>';
          h += '<button class="comp-copy" data-prompt="' + btoa(unescape(encodeURIComponent(compPrompt))) + '" onclick="copyCompPrompt(this)"><i class="fa-solid fa-copy"></i> ' + L.copy + '</button>';
          h += '</div>';
        });
        compArea.innerHTML = h;
      }

      // Smart links
      var linksArea = document.getElementById('smartLinksArea');
      var links = getSmartLinks(ticker, assetType);
      if (links.length > 0) {
        linksArea.innerHTML = links.map(function(l) {
          return '<a href="' + l.url + '" target="_blank" rel="noopener" class="smart-link"><i class="' + l.icon + '"></i> ' + l.label + '</a>';
        }).join('');
      } else {
        linksArea.innerHTML = '';
      }

      renderOpenAiButtons(primaryAi, prompt);

      var outputCard = document.getElementById('outputCard');
      outputCard.classList.remove('visible');
      void outputCard.offsetWidth;
      outputCard.classList.add('visible');

      btn.disabled = false;
      btn.classList.remove('generating');
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ' + L.generateFull;
      setTimeout(function() { outputCard.scrollIntoView({ behavior:'smooth', block:'start' }); }, 100);
    }, 400);
  });

  // ── COPY ──
  function showCopySuccess(aiName) {
    document.getElementById('copyAiName').textContent = aiName || L.copyAiDefault;
    document.getElementById('copiedSub').innerHTML = L.copiedSub + '<span id="copyAiName">' + (aiName || L.copyAiDefault) + '</span>';
    document.getElementById('copyOverlay').classList.add('show');
    document.getElementById('copySuccess').classList.add('show');
    setTimeout(function() {
      document.getElementById('copyOverlay').classList.remove('show');
      document.getElementById('copySuccess').classList.remove('show');
    }, 2000);
  }

  function clipCopy(text, cb) {
    navigator.clipboard.writeText(text).then(cb).catch(function() {
      var t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.left = '-9999px';
      document.body.appendChild(t); t.select(); document.execCommand('copy');
      document.body.removeChild(t); cb();
    });
  }

  // ── DEEP LINKS (hybrid: ?q= for short prompts, copy+homepage for long) ──
  var AI_DIRECT_URLS = {
    chatgpt:    { base: 'https://chatgpt.com/', param: 'q' },
    claude:     { base: 'https://claude.ai/new', param: 'q' },
    perplexity: { base: 'https://www.perplexity.ai/search/new', param: 'q' },
    grok:       { base: 'https://grok.x.ai/', param: 'text' },
    gemini:     { base: 'https://gemini.google.com/app', param: 'text' },
    deepseek:   { base: 'https://chat.deepseek.com/', param: null }
  };
  var MAX_URL_LENGTH = 2000;

  function openInAi(ai, prompt) {
    var cfg = AI_DIRECT_URLS[ai];
    if (!cfg) return;

    // For short prompts and AIs that support ?q=, use direct deep link
    var directUrl = null;
    if (cfg.param) {
      var encoded = encodeURIComponent(prompt);
      var testUrl = cfg.base + (cfg.base.indexOf('?') > -1 ? '&' : '?') + cfg.param + '=' + encoded;
      if (testUrl.length <= MAX_URL_LENGTH) {
        directUrl = testUrl;
      }
    }

    if (directUrl) {
      // Short prompt: open directly with ?q= (pre-filled)
      clipCopy(prompt, function() {
        showCopySuccess(aiLabels[ai] || ai);
        setTimeout(function() { window.open(directUrl, '_blank'); }, 200);
      });
    } else {
      // Long prompt: copy to clipboard + open homepage
      clipCopy(prompt, function() {
        showCopySuccess(aiLabels[ai] || ai);
        setTimeout(function() { window.open(cfg.base, '_blank'); }, 300);
      });
    }
  }

  function renderOpenAiButtons(primaryAi, prompt) {
    var row = document.getElementById('openAiRow');

    var others = Object.keys(AI_DIRECT_URLS).filter(function(k) { return k !== primaryAi; });
    var h = '<button class="open-ai-primary ' + primaryAi + '" type="button" data-ai="' + primaryAi + '">';
    h += '<i class="fa-solid fa-copy"></i> ' + L.openIn + (aiLabels[primaryAi] || primaryAi) + '</button>';

    h += '<div class="open-ai-more" id="openAiMore">';
    h += '<button class="open-ai-more-btn" type="button" id="openAiMoreBtn">' + L.otherAi + ' <i class="fa-solid fa-chevron-down"></i></button>';
    h += '<div class="open-ai-dropdown">';
    others.forEach(function(ai) {
      h += '<button class="open-ai-drop-item" type="button" data-ai="' + ai + '">';
      h += '<span class="ai-dot ' + ai + '"></span>' + (aiLabels[ai] || ai) + '</button>';
    });
    h += '</div></div>';
    row.innerHTML = h;

    // Primary button: copy + open
    row.querySelector('.open-ai-primary').addEventListener('click', function() {
      openInAi(this.dataset.ai, prompt);
    });
    // Dropdown items: copy + open
    row.querySelectorAll('.open-ai-drop-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openInAi(this.dataset.ai, prompt);
      });
    });
    // Toggle dropdown
    document.getElementById('openAiMoreBtn').addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('openAiMore').classList.toggle('open');
    });
    document.addEventListener('click', function closeDropdown() {
      var el = document.getElementById('openAiMore');
      if (el) el.classList.remove('open');
      document.removeEventListener('click', closeDropdown);
    });
  }

  window.openCompInAi = function(btn) {
    var encoded = btn.getAttribute('data-prompt');
    var prompt = decodeURIComponent(escape(atob(encoded)));
    var ai = btn.getAttribute('data-ai');
    openInAi(ai, prompt);
  };

  window.copyCompPrompt = function(btn) {
    var encoded = btn.getAttribute('data-prompt');
    var prompt = decodeURIComponent(escape(atob(encoded)));
    var aiName = btn.parentElement.querySelector('.comp-ai-badge').textContent;
    clipCopy(prompt, function() {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> ' + L.copied;
      showCopySuccess(aiName);
      setTimeout(function() { btn.innerHTML = '<i class="fa-solid fa-copy"></i> ' + L.copy; }, 2000);
    });
  };

  document.getElementById('copyBtn').addEventListener('click', function() {
    var prompt = document.getElementById('promptOutput').textContent;
    var selectedAi = getSelected('aiGroup');
    var rec = getAiRecommendations(getSelected('assetGroup'), getSelected('intentGroup'));
    var ai = (selectedAi && selectedAi !== 'auto') ? selectedAi : rec.primary;
    clipCopy(prompt, function() { showCopySuccess(aiLabels[ai] || ai); });
  });

  document.getElementById('downloadBtn').addEventListener('click', function() {
    var prompt = document.getElementById('promptOutput').textContent;
    var ticker = document.getElementById('tickerInput').value.trim().toUpperCase() || 'PROMPT';
    var blob = new Blob([prompt], { type:'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'prompt-' + ticker + '-' + new Date().toISOString().slice(0,10) + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('outputCard').classList.remove('visible');
    document.getElementById('tickerInput').value = '';
    document.getElementById('thesisInput').value = '';
    document.getElementById('catalystInput').value = '';
    document.getElementById('tickerInput').focus();
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  document.getElementById('tickerInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('generateBtn').click(); }
  });

  // ── PROMPT LIBRARY ──
  function renderLibrary() {
    // Tabs
    var tabsEl = document.getElementById('libTabs');
    var tabs = LANG.libTabs[CURRENT_LANG];
    tabsEl.innerHTML = '';
    tabs.forEach(function(t, i) {
      var btn = document.createElement('div');
      btn.className = 'prompt-lib-tab' + (i === 0 ? ' active' : '');
      btn.setAttribute('data-cat', t.cat);
      btn.textContent = t.label;
      btn.addEventListener('click', function() {
        tabsEl.querySelectorAll('.prompt-lib-tab').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
        var cat = this.dataset.cat;
        document.querySelectorAll('.prompt-lib-card').forEach(function(card) {
          card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
        });
      });
      tabsEl.appendChild(btn);
    });

    // Cards
    var grid = document.getElementById('promptLibGrid');
    grid.innerHTML = '';
    LIBRARY.forEach(function(p) {
      var card = document.createElement('div');
      card.className = 'prompt-lib-card';
      card.setAttribute('data-cat', p.cat);

      var title = p.title[CURRENT_LANG] || p.title.en;
      var badge = p.badge ? (p.badge[CURRENT_LANG] || p.badge.en) : '';
      var desc = p.desc ? (p.desc[CURRENT_LANG] || p.desc.en) : '';
      var code = p.code ? (p.code[CURRENT_LANG] || p.code.en) : '';
      var hasSource = p.source && p.source.url;
      var sourceLabel = hasSource ? (p.source[CURRENT_LANG] || p.source.en) : '';
      var isStub = !code;

      var bodyHtml = '';
      if (isStub) {
        var stubMsg = CURRENT_LANG === 'fr' ? 'Bientôt disponible — restez connecté !' :
                      CURRENT_LANG === 'ar' ? 'قريبًا — ابقَ على اتصال!' :
                      'Coming soon — stay tuned!';
        bodyHtml = '<p class="prompt-lib-desc" style="opacity:.5;font-style:italic">' + stubMsg + '</p>';
      } else {
        bodyHtml = (desc ? '<p class="prompt-lib-desc">' + desc + '</p>' : '') +
          '<div class="prompt-lib-code" style="position:relative">' +
            '<button class="prompt-lib-copy" onclick="copyLib(this)">' + L.copy + '</button>' +
            code +
          '</div>' +
          (hasSource ? '<div class="prompt-lib-source"><i class="fa-solid fa-book"></i> <a href="' + p.source.url + '">' + sourceLabel + '</a></div>' : '');
      }

      card.innerHTML =
        '<div class="prompt-lib-header">' +
          '<div class="plh-left">' +
            '<span class="prompt-lib-num" style="background:' + p.numBg + ';color:' + p.numColor + '">' + p.num + '</span>' +
            '<h4>' + title + '</h4>' +
          '</div>' +
          '<span class="prompt-lib-badge" style="background:' + p.badgeBg + ';color:' + p.badgeColor + '">' + badge + '</span>' +
          (isStub ? '<span style="font-size:.6rem;color:var(--slate-400);font-weight:600">SOON</span>' : '<i class="fa-solid fa-chevron-down plh-chevron"></i>') +
        '</div>' +
        '<div class="prompt-lib-body">' + bodyHtml + '</div>';

      // Expand/collapse
      card.querySelector('.prompt-lib-header').addEventListener('click', function() {
        var isOpen = card.hasAttribute('open');
        if (isOpen) card.removeAttribute('open');
        else card.setAttribute('open','');
      });

      grid.appendChild(card);
    });
  }

  window.copyLib = function(btn) {
    var code = btn.parentElement;
    var text = code.textContent.replace(L.copy,'').replace('✓ ' + L.copied,'').trim();
    clipCopy(text, function() {
      btn.textContent = '✓ ' + L.copied;
      setTimeout(function() { btn.textContent = L.copy; }, 1500);
    });
  };

  // ── AI COMPARISON TABLE ──
  function renderAiTable() {
    var data = {
      fr: [
        { name:'ChatGPT', str:['Browsing web','Analyse longue','Polyvalent'], weak:['Hallucinations','Pas de sources'] },
        { name:'Claude', str:['Raisonnement','Analyse risque','Nuanc\u00e9'], weak:['Pas d\'Internet','Coupure de connaissances'] },
        { name:'Perplexity', str:['Sources cit\u00e9es','Temps r\u00e9el','Factuel'], weak:['Analyse courte','Moins cr\u00e9atif'] },
        { name:'Grok', str:['X/Twitter live','Sentiment social','Crypto'], weak:['Mod\u00e8le jeune','Moins fiable'] },
        { name:'Gemini', str:['Google Search','Trends','Multimodal'], weak:['Prudent','Analyse financi\u00e8re limit\u00e9e'] },
        { name:'DeepSeek', str:['Quantitatif','Calculs','Open-source'], weak:['Pas d\'Internet','Censure CN'] }
      ],
      en: [
        { name:'ChatGPT', str:['Web browsing','Long analysis','Versatile'], weak:['Hallucinations','No citations'] },
        { name:'Claude', str:['Reasoning','Risk analysis','Nuanced'], weak:['No Internet','Knowledge cutoff'] },
        { name:'Perplexity', str:['Cited sources','Real-time','Factual'], weak:['Short analysis','Less creative'] },
        { name:'Grok', str:['X/Twitter live','Social sentiment','Crypto'], weak:['Young model','Less reliable'] },
        { name:'Gemini', str:['Google Search','Trends','Multimodal'], weak:['Conservative','Limited finance'] },
        { name:'DeepSeek', str:['Quantitative','Calculations','Open-source'], weak:['No Internet','CN censorship'] }
      ],
      ar: [
        { name:'ChatGPT', str:['Browsing','\u062a\u062d\u0644\u064a\u0644 \u0637\u0648\u064a\u0644','\u0645\u062a\u0639\u062f\u062f'], weak:['\u0647\u0644\u0648\u0633\u0627\u062a','\u0628\u062f\u0648\u0646 \u0645\u0635\u0627\u062f\u0631'] },
        { name:'Claude', str:['\u062a\u0641\u0643\u064a\u0631','\u0645\u062e\u0627\u0637\u0631','\u062f\u0642\u064a\u0642'], weak:['\u0628\u062f\u0648\u0646 \u0625\u0646\u062a\u0631\u0646\u062a','\u0642\u0637\u0639 \u0645\u0639\u0631\u0641\u064a'] },
        { name:'Perplexity', str:['\u0645\u0635\u0627\u062f\u0631','\u0641\u0648\u0631\u064a','\u0648\u0627\u0642\u0639\u064a'], weak:['\u062a\u062d\u0644\u064a\u0644 \u0642\u0635\u064a\u0631','\u0623\u0642\u0644 \u0625\u0628\u062f\u0627\u0639\u064b\u0627'] },
        { name:'Grok', str:['X/Twitter','\u0645\u0639\u0646\u0648\u064a\u0627\u062a','\u0643\u0631\u064a\u0628\u062a\u0648'], weak:['\u0646\u0645\u0648\u0630\u062c \u062c\u062f\u064a\u062f','\u0623\u0642\u0644 \u0645\u0648\u062b\u0648\u0642\u064a\u0629'] },
        { name:'Gemini', str:['Google Search','Trends','\u0645\u062a\u0639\u062f\u062f'], weak:['\u062d\u0630\u0631','\u0645\u0627\u0644\u064a\u0629 \u0645\u062d\u062f\u0648\u062f\u0629'] },
        { name:'DeepSeek', str:['\u0643\u0645\u0651\u064a','\u062d\u0633\u0627\u0628\u0627\u062a','\u0645\u0641\u062a\u0648\u062d'], weak:['\u0628\u062f\u0648\u0646 \u0625\u0646\u062a\u0631\u0646\u062a','\u0631\u0642\u0627\u0628\u0629 CN'] }
      ]
    };
    var rows = data[CURRENT_LANG] || data.en;
    var tbody = document.getElementById('aiTableBody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(function(r) {
      return '<tr><td class="ai-name">' + r.name + '</td><td>' +
        r.str.map(function(s) { return '<span class="str-tag green">' + s + '</span>'; }).join(' ') +
        '</td><td>' +
        r.weak.map(function(w) { return '<span class="str-tag red">' + w + '</span>'; }).join(' ') +
        '</td></tr>';
    }).join('');
  }

  // ── RESOURCE GRID ──
  function renderResources() {
    var resources = {
      fr: [
        { icon:'fa-solid fa-graduation-cap', bg:'#eef2ff', color:'#6366f1', title:'Guide du Sp\u00e9culateur', desc:'7 parties pour ma\u00eetriser le trading', href:'/series/guide-speculateur/part1/' },
        { icon:'fa-solid fa-chart-line', bg:'#ecfdf5', color:'#059669', title:'Swing Mode', desc:'Scanner, setups et gestion du risque', href:'/series/swing-mode/part1-setup/' },
        { icon:'fa-solid fa-building-columns', bg:'#fffbeb', color:'#d97706', title:'Patrimoine en Europe', desc:'Fiscalit\u00e9, PEA, assurance-vie', href:'/series/patrimoine-europe/part1/' },
        { icon:'fa-solid fa-newspaper', bg:'#fef2f2', color:'#dc2626', title:'Briefings Quotidiens', desc:'Analyses de march\u00e9 chaque matin', href:'/?tab=daily' }
      ],
      en: [
        { icon:'fa-solid fa-graduation-cap', bg:'#eef2ff', color:'#6366f1', title:'Speculator Guide', desc:'7-part trading mastery course', href:'/series/guide-speculateur/part1/' },
        { icon:'fa-solid fa-chart-line', bg:'#ecfdf5', color:'#059669', title:'Swing Mode', desc:'Scanner, setups and risk management', href:'/series/swing-mode/part1-setup/' },
        { icon:'fa-solid fa-building-columns', bg:'#fffbeb', color:'#d97706', title:'European Wealth', desc:'Tax optimization, PEA, insurance', href:'/series/patrimoine-europe/part1/' },
        { icon:'fa-solid fa-newspaper', bg:'#fef2f2', color:'#dc2626', title:'Daily Briefings', desc:'Market analysis every morning', href:'/?tab=daily' }
      ],
      ar: [
        { icon:'fa-solid fa-graduation-cap', bg:'#eef2ff', color:'#6366f1', title:'\u062f\u0644\u064a\u0644 \u0627\u0644\u0645\u0636\u0627\u0631\u0628', desc:'7 \u0623\u062c\u0632\u0627\u0621 \u0644\u0625\u062a\u0642\u0627\u0646 \u0627\u0644\u062a\u062f\u0627\u0648\u0644', href:'/series/guide-speculateur/part1/' },
        { icon:'fa-solid fa-chart-line', bg:'#ecfdf5', color:'#059669', title:'Swing Mode', desc:'\u0645\u0627\u0633\u062d\u060c \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0648\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u062e\u0627\u0637\u0631', href:'/series/swing-mode/part1-setup/' },
        { icon:'fa-solid fa-building-columns', bg:'#fffbeb', color:'#d97706', title:'\u0627\u0644\u062b\u0631\u0648\u0629 \u0627\u0644\u0623\u0648\u0631\u0648\u0628\u064a\u0629', desc:'\u0636\u0631\u0627\u0626\u0628\u060c PEA\u060c \u062a\u0623\u0645\u064a\u0646', href:'/series/patrimoine-europe/part1/' },
        { icon:'fa-solid fa-newspaper', bg:'#fef2f2', color:'#dc2626', title:'\u062a\u0642\u0627\u0631\u064a\u0631 \u064a\u0648\u0645\u064a\u0629', desc:'\u062a\u062d\u0644\u064a\u0644\u0627\u062a \u0643\u0644 \u0635\u0628\u0627\u062d', href:'/?tab=daily' }
      ]
    };
    var items = resources[CURRENT_LANG] || resources.en;
    var grid = document.getElementById('resourceGrid');
    if (!grid) return;
    grid.innerHTML = items.map(function(r) {
      return '<a href="' + r.href + '" class="resource-card">' +
        '<div class="resource-icon" style="background:' + r.bg + ';color:' + r.color + '"><i class="' + r.icon + '"></i></div>' +
        '<div><h4>' + r.title + '</h4><p>' + r.desc + '</p></div></a>';
    }).join('');
  }

  // ── DISCLAIMER ──
  function renderDisclaimer() {
    var box = document.getElementById('disclaimerBox');
    if (!box) return;
    box.innerHTML = '<i class="fa-solid fa-shield-halved"></i> ' + L.disclaimer;
  }

  // ── INIT ──
  applyLang();
  renderAllControls();
  renderTemplates(LANG.thesisTemplates[CURRENT_LANG], 'thesisTemplates', 'thesisInput');
  renderTemplates(LANG.catalystTemplates[CURRENT_LANG], 'catalystTemplates', 'catalystInput');
  renderLibrary();
  renderAiTable();
  renderResources();
  renderDisclaimer();

})();
