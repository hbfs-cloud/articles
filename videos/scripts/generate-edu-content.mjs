#!/usr/bin/env node
/**
 * generate-edu-content.mjs — Generate educational video slide JSON + narration text
 *
 * Usage: node scripts/generate-edu-content.mjs <series-id>
 *
 * Series IDs:
 *   debuter-trading     → "Bien Débuter en Trading" (2h, FR)
 *   ai-singularity-fr   → "AI Singularity" (3h, FR)
 *   ai-singularity-en   → "AI Singularity" (3h, EN)
 *   swing-trading       → "Swing Trading Rentable" (2h, FR)
 *   maitrise-expert     → "Maîtrise Expert" (3h, FR)
 *   algo-million        → "Algo Million" (2h, FR)
 *   bourses-mena        → "Bourses MENA" (2h, FR)
 *
 * Outputs:
 *   public/edu-data.json       — slides + config (consumed by Remotion)
 *   public/edu-narration.json  — narration text segments (consumed by TTS)
 */
import fs from 'fs-extra';
import path from 'path';

const seriesId = process.argv[2] || 'debuter-trading';

// ── Series definitions ──────────────────────────────────────────────

const SERIES = {
  'debuter-trading': {
    config: {
      seriesTitle: 'Bien Débuter en Trading',
      seriesSubtitle: 'Le guide complet pour comprendre les marchés et investir intelligemment',
      date: 'Mars 2026',
      language: 'fr',
      accentColor: '#3b82f6',
      totalChapters: 6,
    },
    generator: generateDebuterTrading,
  },
  'ai-singularity-fr': {
    config: {
      seriesTitle: 'AI Singularity',
      seriesSubtitle: 'L\'intelligence artificielle va-t-elle transformer la finance pour toujours ?',
      date: 'Mars 2026',
      language: 'fr',
      accentColor: '#8b5cf6',
      totalChapters: 15,
    },
    generator: generateAISingularityFR,
  },
  'ai-singularity-en': {
    config: {
      seriesTitle: 'AI Singularity',
      seriesSubtitle: 'Will artificial intelligence transform finance forever?',
      date: 'March 2026',
      language: 'en',
      accentColor: '#8b5cf6',
      totalChapters: 15,
    },
    generator: generateAISingularityEN,
  },
  'swing-trading': {
    config: {
      seriesTitle: 'Swing Trading Rentable',
      seriesSubtitle: 'Maîtrisez le swing trading : du setup à la routine quotidienne',
      date: 'Mars 2026',
      language: 'fr',
      accentColor: '#f59e0b',
      totalChapters: 6,
    },
    generator: generateSwingTrading,
  },
  'maitrise-expert': {
    config: {
      seriesTitle: 'Maîtrise Expert — Le VIX',
      seriesSubtitle: 'Volatilité et stratégies avancées : maîtriser le VIX comme un pro',
      date: 'Mars 2026',
      language: 'fr',
      accentColor: '#ef4444',
      totalChapters: 5,
    },
    generator: generateMaitriseExpert,
  },
  'algo-million': {
    config: {
      seriesTitle: 'De Zéro au Million',
      seriesSubtitle: 'Construisez votre système de trading algorithmique de A à Z',
      date: 'Mars 2026',
      language: 'fr',
      accentColor: '#10b981',
      totalChapters: 12,
    },
    generator: generateAlgoMillion,
  },
  'bourses-mena': {
    config: {
      seriesTitle: 'Bourses MENA',
      seriesSubtitle: 'Investir dans les marchés du Moyen-Orient et d\'Afrique du Nord',
      date: 'Mars 2026',
      language: 'fr',
      accentColor: '#d97706',
      totalChapters: 6,
    },
    generator: generateBoursesMENA,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

let slideIndex = 0;
let audioPrefix = 'edu'; // Set per series to avoid collisions

function makeSlide(slide) {
  const audioFile = `${audioPrefix}_s${slideIndex}.wav`;
  slideIndex++;
  return { ...slide, audioFile };
}

function chapterIntro(partNumber, totalPartsOrTitle, titleOrSubtitle, subtitle) {
  // Support both 4-arg (partNumber, totalParts, title, subtitle) and 3-arg (partNumber, title, subtitle)
  if (subtitle !== undefined) {
    return makeSlide({
      type: 'chapter-intro',
      chapter: { title: titleOrSubtitle, subtitle, partNumber, totalParts: totalPartsOrTitle },
    });
  }
  return makeSlide({
    type: 'chapter-intro',
    chapter: { title: totalPartsOrTitle, subtitle: titleOrSubtitle, partNumber },
  });
}

function bullets(title, items) {
  return makeSlide({ type: 'bullets', title, items });
}

function concept(title, text) {
  return makeSlide({ type: 'concept', title, text });
}

function table(title, headers, rows) {
  return makeSlide({ type: 'table', title, headers, rows });
}

function quote(text, source) {
  return makeSlide({ type: 'quote', text, source });
}

function steps(title, stepsArr) {
  return makeSlide({ type: 'steps', title, steps: stepsArr });
}

function warning(title, text) {
  return makeSlide({ type: 'warning', title, text });
}

function tip(titleOrText, text) {
  if (text !== undefined) {
    return makeSlide({ type: 'tip', title: titleOrText, text });
  }
  return makeSlide({ type: 'tip', text: titleOrText });
}

function summary(title, items) {
  return makeSlide({ type: 'summary', title, items });
}

function comparison(title, left, right) {
  return makeSlide({ type: 'comparison', title, left, right });
}

function quiz(question, choices, correctIndex, explanation) {
  return makeSlide({ type: 'quiz', question, choices, correctIndex, explanation });
}

// ── Narration generators ─────────────────────────────────────────────

function generateNarration(slides, config) {
  return slides.map((slide, i) => {
    let text = '';
    switch (slide.type) {
      case 'chapter-intro':
        text = `Chapitre ${slide.chapter.partNumber} sur ${slide.chapter.totalParts}. ${slide.chapter.title}. ${slide.chapter.subtitle || ''}`;
        break;
      case 'bullets':
        text = `${slide.title || ''}. ${(slide.items || []).join('. ')}`;
        break;
      case 'concept':
        text = `${slide.title || 'Concept clé'}. ${slide.text}`;
        break;
      case 'table':
        text = `${slide.title || 'Tableau comparatif'}. ${(slide.headers || []).join(', ')}. ${(slide.rows || []).slice(0, 4).map(r => r.join(', ')).join('. ')}`;
        break;
      case 'quote':
        text = `Citation : ${slide.text}. ${slide.source || ''}`;
        break;
      case 'steps':
        text = `${slide.title || 'Les étapes'}. ${(slide.steps || []).map(s => `Étape ${s.number}, ${s.title}. ${s.description}`).join('. ')}`;
        break;
      case 'warning':
        text = `Attention ! ${slide.title || ''}. ${slide.text}`;
        break;
      case 'tip':
        text = `Conseil pro : ${slide.text}`;
        break;
      case 'summary':
        text = `${slide.title || 'À retenir'}. ${(slide.items || []).join('. ')}`;
        break;
      case 'comparison':
        text = `${slide.title || 'Comparaison'}. D'un côté, ${slide.left?.label} : ${(slide.left?.items || []).join(', ')}. De l'autre, ${slide.right?.label} : ${(slide.right?.items || []).join(', ')}`;
        break;
      case 'quiz':
        text = `Petit quiz ! ${slide.question}. Les options sont : ${(slide.choices || []).map((c, i) => `${String.fromCharCode(65 + i)}, ${c}`).join('. ')}. Prenez un moment pour réfléchir. La bonne réponse est ${String.fromCharCode(65 + slide.correctIndex)}. ${slide.explanation || ''}`;
        break;
      default:
        text = slide.text || slide.title || '';
    }
    return {
      key: slide.audioFile.replace('.wav', ''),
      text: text.trim(),
      audioFile: slide.audioFile,
    };
  });
}

// ════════════════════════════════════════════════════════════════════
// SERIES 1: BIEN DÉBUTER EN TRADING (2h, ~480 slides)
// ════════════════════════════════════════════════════════════════════

function generateDebuterTrading() {
  slideIndex = 0;
  const slides = [];

  // ════════════════════════════════════════════════════════════════
  // TARGET: ~250 slides, ~18,000 words narration = ~2h at 150 wpm
  // Quizzes every 15-20 min = ~7 quizzes
  // Style: dynamique, abordable, didactique, français
  // ════════════════════════════════════════════════════════════════

  // ── CHAPITRE 1: Comprendre le Marché (~25 min, ~55 slides) ─────
  slides.push(chapterIntro(1, 6, 'Comprendre le Marché', 'Qui sont les acteurs, comment ils bougent les prix, et comment ne pas se faire piéger'));

  slides.push(bullets('Les 6 Acteurs du Marché', [
    'Les particuliers (retail) : 20-25% du volume — agiles mais émotionnels',
    'Les institutionnels : 60-70% du volume — fonds de pension, hedge funds, fonds souverains',
    'Les market makers (Citadel, Virtu, Jane Street) : fournissent la liquidité via le spread',
    'Le trading haute fréquence (HFT) : 50-70% du volume total, positions de quelques millisecondes',
    'Les dark pools : 30-40% des actions US échangées hors marché, dans l\'opacité',
    'Les banques centrales (Fed, BCE, BoJ) : contrôlent les taux, font du QE/QT, bougent des trillions',
  ]));

  slides.push(table('Qui fait quoi sur les marchés ?', ['Acteur', '% Volume', 'Horizon', 'Avantage'], [
    ['Retail', '20-25%', 'Jours-Mois', 'Agilité'],
    ['Institutionnels', '60-70%', 'Mois-Années', 'Ressources'],
    ['Market Makers', '~15%', 'Secondes', 'Spread'],
    ['HFT/Algos', '50-70%', 'Millisecondes', 'Vitesse'],
    ['Dark Pools', '30-40%', 'Variable', 'Opacité'],
    ['Banques Centrales', 'Variable', 'Années', 'Pouvoir'],
  ]));

  slides.push(concept('Bienvenue dans cette formation', 'Avant de plonger dans le vif du sujet, un mot important. Cette formation va vous donner toutes les bases pour comprendre les marchés financiers et commencer à investir. On va parler de stratégies, de psychologie, de risk management, et d\'outils concrets. Mais rappelez-vous : ceci n\'est pas un conseil financier. Chaque décision d\'investissement est la vôtre. L\'objectif ici, c\'est de vous donner les outils pour décider intelligemment.'));

  slides.push(concept('Ce que vous allez apprendre dans cette formation', 'En deux heures, nous allons couvrir six grands chapitres. Premièrement, comprendre le marché : qui sont les acteurs, comment ils manipulent les prix, et comment ne pas se faire piéger. Deuxièmement, le stock picking : les 4 méthodes éprouvées pour choisir des actions. Troisièmement, construire un portefeuille : diversification, ETF, DCA, et la question des dividendes. Quatrièmement, l\'art du all-in intelligent : quand et comment concentrer ses positions avec discipline. Cinquièmement, les stratégies avancées : les 8 stratégies qui ont survécu à 100 ans de marchés, les options, et le backtesting. Et sixièmement, la psychologie du trader : gérer les pertes, les gains, et ses émotions. C\'est parti.'));

  slides.push(concept('Pourquoi investir en bourse ?', 'Le livret A rapporte 3% par an. L\'inflation en Europe tourne autour de 2-3%. En termes réels, votre argent ne travaille presque pas sur un livret. En comparaison, le S&P 500 a rapporté en moyenne 10,5% par an sur les 50 dernières années. 10 000 euros investis dans le S&P 500 en 1980 valent aujourd\'hui plus de 1,2 million d\'euros. La bourse n\'est pas un casino — c\'est le moteur de création de richesse le plus puissant au monde, à condition de savoir comment l\'utiliser.'));

  slides.push(concept('Le cas GameStop — Janvier 2021', 'L\'action passe de 17$ à 483$ en quelques jours. Les particuliers de Reddit s\'organisent contre les hedge funds. Melvin Capital perd 6,8 milliards de dollars. C\'est la preuve que le retail peut bousculer Wall Street — mais aussi que ces moments sont exceptionnels et très risqués.'));

  slides.push(concept('Les market makers — Les arbitres invisibles', 'Citadel Securities, Virtu Financial, Jane Street — ces noms ne vous disent peut-être rien, mais ils font tourner le marché. Un market maker est un intermédiaire qui affiche en permanence un prix d\'achat et un prix de vente pour chaque action. La différence entre les deux, c\'est le spread, et c\'est comme ça qu\'ils gagnent leur vie. Citadel Securities traite environ 25% de toutes les actions américaines et 40% du volume retail. Quand vous achetez Apple sur Robinhood ou Trade Republic, votre ordre passe probablement par Citadel. Ce n\'est pas de la manipulation — c\'est le moteur de la liquidité. Sans market makers, il serait impossible d\'acheter ou vendre instantanément.'));

  slides.push(concept('Le trading haute fréquence — La course aux microsecondes', 'Le HFT représente 50 à 70% du volume total des marchés américains. Ces algorithmes détiennent des positions pendant des millisecondes — littéralement plus vite que vous ne pouvez cligner des yeux. Ils gagnent des fractions de centime par transaction, mais sur des milliards de transactions. Les firmes de HFT dépensent des millions pour placer leurs serveurs physiquement plus près des exchanges : quelques mètres de câble en moins représentent quelques microsecondes de gain. Est-ce que c\'est juste ? C\'est discutable. Mais en tant qu\'investisseur retail, le HFT ne vous affecte pas vraiment si votre horizon est supérieur à quelques heures. C\'est un problème pour les day traders, pas pour les swing traders ou les investisseurs long terme.'));

  slides.push(concept('Les dark pools — Le marché dans l\'ombre', 'Environ 30 à 40% des actions américaines s\'échangent hors du marché public, dans ce qu\'on appelle les dark pools. Ce sont des bourses privées, gérées par les grandes banques, où les ordres ne sont pas visibles avant exécution. Pourquoi ? Parce que si un fonds de pension veut acheter 10 millions d\'actions Apple, il ne veut pas que le marché voie son ordre et fasse monter le prix avant qu\'il ait fini d\'acheter. C\'est légitime, mais ça crée une asymétrie d\'information. Le retail voit le marché public ; les institutionnels voient le marché complet. La solution ? N\'utilisez jamais d\'ordres à marché sur des small caps à faible liquidité — utilisez des ordres limite pour vous protéger.'));

  slides.push(concept('Comment suivre les gros poissons', 'Les institutionnels laissent des traces. Les 13F déposés à la SEC révèlent les positions des hedge funds chaque trimestre. Le Form 4 montre les achats et ventes d\'insiders en temps réel. WhaleWisdom compile tout ça. Quand un PDG achète des actions de sa propre entreprise, c\'est un signal fort : il met son propre argent en jeu. C\'est souvent plus fiable que n\'importe quel rapport d\'analyste.'));

  slides.push(tip('Comment utiliser les filings SEC gratuitement : allez sur EDGAR (sec.gov/cgi-bin/browse-edgar), cherchez le ticker, regardez les Form 4 (insider transactions) et les 13F (positions des fonds). C\'est gratuit, c\'est la source primaire, et c\'est ce que les pros utilisent. Pas besoin d\'abonnement payant pour commencer.'));

  slides.push(bullets('Les 7 Manipulations à Connaître', [
    'Le Spoofing : des ordres fantômes pour tromper le marché — responsable du Flash Crash de 2010',
    'Le Wash Trading : on s\'achète et se vend à soi-même pour gonfler le volume — 95% du volume Bitcoin était du wash trading en 2019',
    'Le Pump & Dump : on accumule, on promeut, on vend — le token Squid Game a fait +75 000% puis zéro',
    'Le Short & Distort : on short puis on publie un rapport négatif — Hindenburg Research en est le maître',
  ]));

  slides.push(bullets('Manipulations (suite)', [
    'Le Front-Running : on trade avant le client — la controverse PFOF (Payment for Order Flow)',
    'Le Délit d\'initié : Martha Stewart a fait de la prison pour 45 000$ de pertes évitées',
    'Le Corner de marché : les frères Hunt sur l\'argent en 1979, Porsche sur VW en 2008 (+10 milliards d\'euros)',
  ]));

  slides.push(concept('Le cas Porsche-Volkswagen 2008', 'En octobre 2008, Porsche révèle qu\'il détient secrètement 74% de Volkswagen. Les hedge funds avaient massivement shorté VW. Résultat : un short squeeze historique. L\'action VW passe de 200 à 1 000 euros en deux jours, faisant de VW la plus grande capitalisation boursière mondiale pendant quelques heures. Porsche empoche plus de 10 milliards d\'euros de profit. C\'est le plus grand cornering de marché de l\'histoire moderne.'));

  slides.push(warning('Sanctions pour manipulation', 'Jusqu\'à 25 ans de prison et 25 millions de dollars d\'amende aux États-Unis. En France, l\'AMF peut infliger jusqu\'à 100 millions d\'euros. Ce n\'est pas un jeu.'));

  slides.push(concept('Le Flash Crash de 2010 expliqué', 'Le 6 mai 2010, le Dow Jones chute de 1 000 points en 5 minutes — soit 9% de sa valeur — avant de remonter presque entièrement en 20 minutes. Des trillions de dollars de capitalisation ont disparu et réapparu en moins d\'une demi-heure. L\'enquête a révélé que Navinder Sarao, un trader travaillant depuis la chambre de ses parents à Londres, avait utilisé du spoofing — des ordres de vente massifs qu\'il annulait avant exécution — pour déclencher la cascade. Un seul homme, depuis une banlieue londonienne, a mis à genoux le marché le plus liquide du monde. C\'est la preuve que la structure du marché est fragile et que les algos amplifient les mouvements.'));

  slides.push(concept('Le Wash Trading en crypto — L\'épidémie', 'En 2019, le rapport Bitwise a choqué l\'industrie : 95% du volume Bitcoin affiché sur les exchanges était du wash trading. Les plateformes se vendaient et s\'achetaient à elles-mêmes pour gonfler leurs volumes et attirer les utilisateurs. Comment le détecter ? Regardez le "real volume" sur des plateformes comme CoinMarketCap ou Messari, qui filtrent le wash trading. Si le volume d\'un token explose sans mouvement de prix significatif, c\'est suspect. Et si un obscur exchange affiche plus de volume que Binance sur un token, c\'est quasiment certain.'));

  slides.push(concept('Le Pump & Dump moderne — Les Réseaux Sociaux', 'Le pump and dump classique se faisait par téléphone dans les années 90 — pensez au Loup de Wall Street. Aujourd\'hui, ça se fait sur Telegram, Discord et TikTok. Le schéma est toujours le même : un groupe accumule silencieusement une position, puis déclenche une campagne virale avec des émojis fusée et des promesses de rendements de 1000%. Les retardataires achètent au sommet pendant que les organisateurs vendent. Le token Squid Game en est l\'exemple parfait : +75 000% en quelques jours, puis zéro en quelques minutes quand les créateurs ont vidé la liquidité. Si c\'est trop beau pour être vrai, ça l\'est toujours.'));

  slides.push(steps('Comment vous protéger des manipulations', [
    { number: 1, title: 'Vérifiez la source', description: 'Toute recommandation doit avoir une source vérifiable : SEC filing, rapport d\'analyste, données de marché' },
    { number: 2, title: 'Méfiez-vous du volume anormal', description: 'Un volume qui explose sur un small cap sans news = manipulation probable' },
    { number: 3, title: 'Ignorez les "tuyaux"', description: 'Si quelqu\'un vous dit "j\'ai une info confidentielle", c\'est soit illégal, soit un piège, soit les deux' },
    { number: 4, title: 'Diversifiez toujours', description: 'La meilleure protection contre une manipulation, c\'est de ne jamais tout mettre sur un seul ticker' },
  ]));

  // VIX
  slides.push(concept('Le VIX — Le Thermomètre de la Peur', 'Le VIX mesure la volatilité implicite du S&P 500 sur 30 jours. En dessous de 15, c\'est le calme plat — attention à l\'excès de confiance. Entre 20 et 30, les nerfs commencent à lâcher. Au-dessus de 40, c\'est la panique — mais historiquement, acheter quand le VIX dépasse 40 donne en moyenne +25% sur les 12 mois suivants.'));

  slides.push(table('Les 5 niveaux du VIX', ['VIX', 'État', 'Ce que ça veut dire'], [
    ['< 15', 'Calme / Complaisance', 'Attention, trop de confiance'],
    ['15-20', 'Normal', 'Marché sain'],
    ['20-30', 'Nervosité', 'Prudence recommandée'],
    ['30-40', 'Peur', 'Opportunités possibles'],
    ['> 40', 'Panique', 'Historiquement, le meilleur moment pour acheter'],
  ]));

  slides.push(warning('Ne JAMAIS trader le VIX via ETF', 'L\'UVXY a perdu 99,9% depuis sa création. Le contango détruit votre capital chaque jour. Le VIX est un indicateur à lire, pas un produit à acheter.'));

  slides.push(concept('Contango : le tueur silencieux des ETF VIX', 'Le contango, c\'est quand les futures à terme coûtent plus cher que le spot. Chaque mois, l\'ETF VIX doit "rouler" ses futures : il vend le contrat qui expire (moins cher) et achète le suivant (plus cher). Cette différence, c\'est de l\'argent perdu. C\'est comme payer un loyer mensuel sur votre position. Sur un an, ça peut représenter 30 à 50% de perte, même si le VIX n\'a pas bougé. C\'est pour ça que l\'UVXY perd 99,9% sur le long terme.'));

  slides.push(concept('Le VIX en pratique — Exemple concret', 'En mars 2020, le VIX a atteint 82 — un record. Le S&P 500 avait chuté de 34% en un mois à cause du COVID. Ceux qui ont acheté le S&P 500 le jour où le VIX a touché 82 ont gagné plus de 100% en un an. En octobre 2022, le VIX a touché 33 pendant la baisse liée à l\'inflation. Ceux qui ont acheté ont gagné 25% en 6 mois. Le pattern est clair : VIX extrême = peur maximale = opportunité maximale. Mais attention : il faut avoir du cash disponible pour saisir ces moments, ce qui ramène à notre leçon sur le cash comme position.'));

  slides.push(concept('Comment lire le VIX au quotidien', 'Prenez l\'habitude de checker le VIX chaque matin. Cherchez le ticker VIX sur TradingView ou Yahoo Finance. Deux choses à regarder : le niveau absolu (est-on en zone calme, normale, ou panique ?) et la tendance (monte-t-il ou baisse-t-il ?). Un VIX qui monte doucement depuis 3 semaines, même s\'il est encore à 18, est un signal d\'alerte. Un VIX qui baisse après un pic, c\'est le marché qui dit "la tempête est passée". Formule rapide : VIX divisé par racine de 252 donne le mouvement journalier attendu du S&P. Un VIX à 20 signifie environ 1,26% de mouvement journalier attendu.'));

  slides.push(concept('Le VVIX — La Peur de la Peur', 'Le VVIX mesure la volatilité du VIX lui-même. C\'est un indicateur avancé. Quand le VVIX commence à monter alors que le VIX est encore bas, c\'est souvent un signal précoce que la volatilité va augmenter. Les pros l\'utilisent comme un système d\'alerte précoce. C\'est la peur de la peur : le marché commence à s\'inquiéter de l\'arrivée de la volatilité.'));

  slides.push(concept('Volatilité réalisée vs implicite', 'La volatilité réalisée (HV), c\'est ce qui s\'est passé : combien le prix a bougé sur les 20 ou 30 derniers jours. La volatilité implicite (IV), c\'est ce que le marché anticipe. Quand l\'IV est beaucoup plus haute que la HV, le marché est nerveux et les options sont chères. C\'est le moment de vendre des options (covered calls). Quand l\'IV est basse, les options sont bon marché : c\'est le moment d\'acheter des protections (puts).'));

  // Cash is a position
  slides.push(quote('Le cash est une position.', 'Warren Buffett — 334 milliards de dollars en cash chez Berkshire Hathaway fin 2024'));

  slides.push(table('Allocation cash selon la phase de marché', ['Phase', '% Cash', 'Pourquoi'], [
    ['Bull market', '10-15%', 'Rester investi, garder une réserve'],
    ['Incertitude', '20-30%', 'Protéger le capital'],
    ['Correction', '30-50%', 'Attendre les opportunités'],
    ['Panique', 'Déployer !', 'C\'est le moment d\'acheter'],
  ]));

  slides.push(tip('Si vous ratez les 10 meilleurs jours du S&P 500 sur 20 ans, votre rendement passe de 9,8% à 5,6% par an. Étude JPMorgan. Être 100% cash trop longtemps vous coûte très cher.'));

  slides.push(steps('5 signaux pour revenir sur le marché', [
    { number: 1, title: 'Le VIX repasse sous 20', description: 'La peur se dissipe, les conditions se normalisent' },
    { number: 2, title: 'Un breakout technique majeur', description: 'Le S&P 500 casse une résistance clé avec du volume' },
    { number: 3, title: 'Capitulation visible', description: 'Volume record à la baisse, sentiment extrêmement négatif — c\'est souvent le bottom' },
    { number: 4, title: 'L\'amplitude s\'améliore', description: 'Plus d\'actions montent que descendent — le breadth s\'élargit' },
    { number: 5, title: 'Les spreads de crédit se resserrent', description: 'Le marché obligataire arrête de pricer le risque — signal de confiance' },
  ]));

  // Signal vs Bruit
  slides.push(concept('Signal vs Bruit', '95% de l\'information financière quotidienne est du bruit. Le marché ne regarde vraiment que 7 choses : les décisions de la Fed, l\'inflation (CPI), les emplois (NFP), le PCE core, les résultats d\'entreprises, les spreads de crédit, et la courbe des taux.'));

  slides.push(comparison('Signal ou Bruit ?',
    { label: 'Signal (à suivre)', items: ['Décisions FOMC (±1,5-2% sur le S&P)', 'CPI / Core PCE', 'Résultats trimestriels', 'Courbe des taux', 'Spreads de crédit'] },
    { label: 'Bruit (à ignorer)', items: ['Influenceurs TikTok', 'BFM Business en continu', 'Groupes Telegram VIP', 'Tweets "crash imminent"', 'Prédictions de fin d\'année'] }
  ));

  slides.push(concept('Le filtre en 3 questions', 'Avant de réagir à n\'importe quelle information financière, posez-vous 3 questions. Premièrement : est-ce une source primaire ou un dérivé ? Un rapport de la Fed est une source primaire. Un tweet qui cite un tweet qui cite un article est du bruit. Deuxièmement : est-ce une donnée ou une opinion ? Le CPI à 3,2% est une donnée. "L\'inflation est hors de contrôle" est une opinion. Troisièmement : est-ce un consensus ou un outlier ? Si tout le monde dit la même chose, c\'est déjà dans les prix. L\'outlier a plus de valeur — mais il faut vérifier sa crédibilité.'));

  slides.push(tip('Faites l\'expérience du journal silencieux : pendant une semaine, coupez toutes les sources de bruit financier. Pas de BFM, pas de Twitter finance, pas de YouTube trading. Consultez uniquement les données primaires une fois par jour : indices, VIX, calendrier éco. Vous verrez que vos décisions seront meilleures. Le bruit crée de l\'anxiété et des trades émotionnels.'));

  slides.push(bullets('Sources fiables recommandées', [
    'FRED (Federal Reserve Economic Data) : toutes les données macro, gratuites, à jour',
    'SEC EDGAR : tous les filings des entreprises US — la source de vérité',
    'CME FedWatch : les probabilités de hausse/baisse des taux en temps réel',
    'CBOE : les données de volatilité et d\'options',
    'Yahoo Finance : données de prix, financials, news — l\'outil de base gratuit',
    'TradingView : graphiques professionnels avec un plan gratuit très complet',
  ]));

  // Mégatrends
  slides.push(bullets('6 Vraies Mégatendances 2025-2035', [
    'Intelligence Artificielle : marché de 1 800 milliards $ d\'ici 2030',
    'Vieillissement de la population : healthcare et silver economy',
    'Transition énergétique : 4 000 milliards $/an d\'investissement nécessaire',
    'Cybersécurité : chaque entreprise en a besoin, pas de retour en arrière',
    'Relocalisation industrielle (reshoring) : fin de la dépendance à la Chine',
    'Défense : les budgets militaires explosent partout dans le monde',
  ]));

  slides.push(comparison('Tendance réelle vs Hype',
    { label: 'Investir (tendance réelle)', items: ['IA (adoption massive, CAPEX record)', 'Cybersécurité (nécessité structurelle)', 'Énergie propre (législation + CAPEX)'] },
    { label: 'Prudence (hype passée)', items: ['Métaverse (Meta a perdu 46 milliards $)', 'Blockchain pour tout (la plupart des projets morts)', 'Cannabis (-90% depuis les sommets)'] }
  ));

  slides.push(concept('Le test simple : sera-t-il encore là dans 10 ans ?', 'Voici le test le plus simple pour distinguer une vraie tendance d\'un effet de mode. Posez-vous la question : est-ce que ce thème sera encore pertinent dans 10 ans ? L\'IA ? Oui, clairement. Le vieillissement de la population ? C\'est démographique, c\'est inévitable. Le Metaverse tel que présenté par Meta ? Les gens n\'ont pas envie de porter un casque 8 heures par jour. Si c\'est encore là dans 10 ans, investissez. Si c\'est un souvenir dans 3 ans, tradez si vous êtes rapide. Si vous hésitez, attendez.'));

  slides.push(table('Validation d\'une mégatendance', ['Critère', 'Tendance réelle', 'Hype'], [
    ['TAM (marché total)', '> 500 Mds $', '< 50 Mds $'],
    ['CAPEX des grands groupes', 'En forte hausse', 'Annonces sans investissement'],
    ['Adoption institutionnelle', 'Fonds, ETF, mandats', 'Que du retail'],
    ['Législation favorable', 'Subventions, régulations', 'Vide juridique'],
    ['Test des 10 ans', '✅ Évident', '❓ Incertain'],
  ]));

  // Saisonnalités
  slides.push(bullets('Les Saisonnalités qui Marchent Vraiment', [
    'Sell in May : Novembre-Avril = +7,1% en moyenne vs Mai-Octobre = +1,8%',
    'Santa Rally : dernière semaine de décembre + 2 premiers jours de janvier = +1,3%',
    'Effet janvier : les small caps surperforment (rebond post tax-loss harvesting)',
    'Triple Witching : 3ème vendredi de mars/juin/sept/déc — volume 2 à 3x le normal',
  ]));

  slides.push(concept('Les Banques Centrales — Les dieux du marché', 'La Réserve Fédérale américaine est l\'institution la plus puissante du monde financier. Quand la Fed baisse les taux d\'intérêt, elle rend l\'emprunt moins cher, ce qui stimule l\'économie et fait monter les actions. Quand elle monte les taux, c\'est le contraire : l\'argent coûte plus cher, les entreprises investissent moins, et les actions baissent. Le Quantitative Easing — l\'impression monétaire — a propulsé les marchés entre 2009 et 2021. Le Quantitative Tightening — le retrait de liquidité — a pesé sur les marchés en 2022-2023. Jerome Powell, le président de la Fed, peut faire bouger les marchés de 2% en une phrase. Suivez les réunions FOMC comme un fan de foot suit la Ligue des Champions.'));

  slides.push(concept('Le cycle FOMC expliqué', 'La Réserve Fédérale américaine se réunit 8 fois par an pour décider des taux d\'intérêt. Voici comment le marché réagit. J moins 2, la veille et l\'avant-veille : le marché est prudent, le volume baisse. Le jour J à 14h heure de l\'Est : la volatilité explose, le marché peut bouger de 1,5 à 2% dans les minutes suivantes. Ne tradez JAMAIS pendant les 30 premières minutes après une annonce FOMC. J plus 1 : la vraie direction se confirme. C\'est là que vous pouvez agir.'));

  slides.push(table('Rotation sectorielle et cycles économiques', ['Phase', 'Secteurs favorisés', 'Pourquoi'], [
    ['Expansion précoce', 'Financières, Industrielles', 'Les taux sont bas, le crédit revient'],
    ['Expansion tardive', 'Tech, Énergie', 'La croissance accélère, la demande explose'],
    ['Contraction précoce', 'Santé, Utilities', 'Les gens ont besoin de soins et d\'électricité'],
    ['Contraction tardive', 'Financières, Small Caps', 'Les premiers à rebondir quand les taux baissent'],
  ]));

  slides.push(bullets('8 indicateurs avancés que les pros surveillent', [
    'ISM PMI : au-dessus de 50 = expansion, en dessous = contraction',
    'Courbe des taux : inversée 7 fois sur 7 avant une récession depuis 1970',
    'Demandes initiales de chômage : hausse rapide = alerte récession',
    'Cuivre (Dr Copper) : le métal qui prédit l\'économie mondiale',
    'Baltic Dry Index : le coût du transport maritime = température du commerce mondial',
    'Spreads de crédit : l\'écart HY-IG s\'élargit = le marché a peur',
    'Housing Starts : le marché immobilier est un indicateur avancé de 6-12 mois',
    'Confiance des consommateurs : les gens dépensent-ils ? C\'est 70% du PIB US',
  ]));

  slides.push(concept('L\'or — La Valeur Refuge Universelle', 'L\'or n\'est pas un investissement au sens classique. L\'or ne produit rien, ne verse pas de dividende, et ne génère pas de cash-flow. Mais l\'or est le seul actif qui n\'est la dette de personne. En période de crise, quand tout le monde perd confiance, l\'or monte. Warren Buffett détestait l\'or pendant 40 ans et a fini par investir dans Barrick Gold. Pour l\'or physique, les ETF GLD ou IAU sont les plus simples. Ne touchez JAMAIS aux certificats or non alloués.'));

  slides.push(concept('La finance islamique — Un marché en pleine croissance', 'Avec 1,8 milliard de musulmans dans le monde, la finance islamique est un segment majeur. Les principes sont clairs : pas de riba (intérêts), pas de secteurs haram (alcool, jeu, armement, tabac), ratio dette/actifs inférieur à 33%, et revenus impurs inférieurs à 5%. Il existe des indices dédiés comme le DJIM (Dow Jones Islamic Market), des ETF comme HLAL et SPUS, et des plateformes de screening comme Zoya et Musaffa. Performance surprise : pendant la crise de 2008, les indices sharia-conformes ont perdu 33% contre 37% pour le marché global. L\'exclusion des financières surendettées a joué comme une protection naturelle.'));

  slides.push(concept('Le risque politique — L\'éléphant dans la pièce', 'Un tweet de Trump sur les tarifs peut faire chuter le S&P de 1,5% en quelques minutes. La règle des 48 heures s\'applique : ne tradez JAMAIS sur un post de réseau social. Attendez 48 heures. Dans la plupart des cas, le marché corrige et revient à la normale. Le cycle présidentiel américain montre que l\'année 3 du mandat est historiquement la meilleure (+16,6% en moyenne depuis 1928) car le président booste l\'économie avant les élections.'));

  // QUIZ 1 (~18 min mark)
  slides.push(quiz(
    'Le VIX est à 38. Que faites-vous ?',
    ['Je vends tout immédiatement', 'Je commence à chercher des opportunités d\'achat', 'J\'achète du UVXY pour profiter de la peur', 'J\'ignore le VIX, c\'est du bruit'],
    1,
    'Historiquement, acheter quand le VIX dépasse 35-40 donne +25% en moyenne sur 12 mois. C\'est le moment de chercher, pas de paniquer — et surtout pas d\'acheter des ETF VIX !'
  ));

  // Premiers pas
  slides.push(concept('Les régulateurs — Vos meilleurs alliés', 'Les régulateurs existent pour vous protéger. Aux États-Unis, la SEC surveille les marchés et publie tous les filings d\'entreprise sur EDGAR — c\'est gratuit et c\'est la source de vérité absolue. La FINRA régule les courtiers et publie BrokerCheck — vérifiez toujours un courtier avant d\'ouvrir un compte. En France, l\'AMF (Autorité des Marchés Financiers) publie une liste noire de sites d\'arnaques : consultez-la avant d\'investir sur une plateforme inconnue. Le site de l\'AMF propose aussi des outils éducatifs gratuits et de qualité. En Europe, l\'ESMA a imposé des règles strictes sur le levier et les CFD — c\'est pourquoi 82% des comptes CFD sont affichés comme perdants.'));

  slides.push(concept('Comment utiliser EDGAR concrètement', 'Allez sur sec.gov et cherchez un ticker. Les documents clés : le 10-K est le rapport annuel — c\'est le document le plus complet sur une entreprise, avec 200-300 pages de données. Le 10-Q est le rapport trimestriel, plus court. Le 8-K est un événement ponctuel (acquisition, changement de direction, résultats préliminaires). Le Form 4 montre les transactions d\'insiders en temps réel — c\'est souvent le plus utile pour un investisseur. Et le 13F montre les positions des fonds de plus de 100 millions de dollars. Astuce : abonnez-vous aux notifications EDGAR pour vos tickers — vous recevrez un email à chaque nouveau filing.'));

  slides.push(concept('Le Paper Trading — Votre période d\'essai', 'Avant de risquer un centime, faites 30 trades en paper trading. TradingView offre un simulateur gratuit avec des données en temps réel. Interactive Brokers propose aussi un compte démo. L\'objectif n\'est pas de gagner — c\'est de tester votre méthode dans des conditions réelles sans le stress de l\'argent réel. Deux règles importantes : premièrement, tradez exactement comme si c\'était de l\'argent réel — ne prenez pas de risques que vous ne prendriez pas en vrai. Deuxièmement, tenez un journal de chaque trade — si vous ne tenez pas un journal en paper trading, vous ne le ferez pas en réel.'));

  slides.push(concept('Ouvrir un PEA — Faites-le MAINTENANT', 'Même avec 10 euros, ouvrez un PEA aujourd\'hui. Pourquoi ? Parce que le compteur fiscal de 5 ans démarre à l\'ouverture. Après 5 ans, 0% d\'impôt sur les plus-values (hors prélèvements sociaux de 17,2%). Plus vous attendez, plus vous repoussez cette exonération.'));

  slides.push(table('Quel compte pour quoi ?', ['Compte', 'Fiscalité', 'Plafond', 'Pour qui'], [
    ['PEA', '0% IR après 5 ans', '150 000 €', 'Tout le monde — ouvrez-le en premier'],
    ['CTO', '30% flat tax', 'Illimité', 'Actions US, ETF exotiques'],
    ['Assurance-Vie', 'Avantages après 8 ans', 'Illimité', 'Transmission, fonds euros'],
  ]));

  slides.push(steps('Vos 4 premiers pas', [
    { number: 1, title: 'Ouvrir un PEA', description: 'Boursorama, Fortuneo, ou Trade Republic. Le compteur des 5 ans démarre maintenant.' },
    { number: 2, title: '30 trades en paper trading', description: 'Utilisez TradingView (gratuit) pour vous entraîner sans risquer un centime.' },
    { number: 3, title: 'Premier investissement', description: 'Un ETF MSCI World (CW8) ou S&P 500 en DCA mensuel. Commencez petit.' },
    { number: 4, title: 'Tenir un journal', description: 'Notez chaque trade, la raison d\'entrée, le résultat, et ce que vous avez appris.' },
  ]));

  slides.push(summary('Chapitre 1 — À Retenir', [
    'Les institutionnels font 60-70% du volume — vous jouez dans leur terrain',
    'Le VIX est un thermomètre, pas un produit à trader',
    'Le cash est une position légitime — surtout en phase d\'incertitude',
    '95% de l\'info est du bruit — filtrez impitoyablement',
    'Ouvrez un PEA maintenant, même avec 10 euros',
  ]));

  // ── CHAPITRE 2: Le Stock Picking (~20 min) ────────────────────────
  slides.push(chapterIntro(2, 6, 'Le Guide du Stock Picking', 'Choisir ses actions comme un pro : les 4 méthodes qui marchent'));

  slides.push(concept('Récap du Chapitre 1 — En quelques mots', 'Avant de passer au stock picking, faisons le point. Le marché est un écosystème complexe dominé par les institutionnels à 60-70%. Les manipulations existent : spoofing, wash trading, pump and dump — apprenez à les reconnaître. Le VIX est votre thermomètre : au-dessus de 40, c\'est historiquement le meilleur moment pour acheter. Le cash est une position légitime, surtout en phase d\'incertitude. Et 95% de l\'information est du bruit — filtrez impitoyablement. Maintenant, passons à l\'action : comment choisir des actions qui vont surperformer ?'));

  slides.push(concept('Transition vers le stock picking', 'Maintenant que vous comprenez le marché, ses acteurs, et ses pièges, passons à l\'action. Comment choisir des actions individuelles ? C\'est ce qu\'on appelle le stock picking. Attention : le stock picking n\'est pas obligatoire. Si vous voulez la simplicité totale, un ETF World en DCA suffit et battra 97% des traders actifs. Mais si vous voulez aller plus loin, si vous êtes prêt à y consacrer du temps et de la discipline, le stock picking peut significativement surperformer les indices. La clé, c\'est d\'avoir une méthode, de la tester, et de s\'y tenir. Pas d\'intuitions, pas de tuyaux — un process rigoureux.'));

  slides.push(concept('C\'est quoi le Stock Picking ?', 'Le stock picking, c\'est l\'art de sélectionner des actions individuelles plutôt que d\'acheter un indice entier. C\'est plus risqué qu\'un ETF, mais ça peut largement surperformer si vous appliquez une méthode rigoureuse. La clé : avoir un process, pas des intuitions.'));

  slides.push(table('3 Profils d\'Investisseur', ['Profil', 'Perte max acceptable', 'Capitalisation', 'Méthode privilégiée'], [
    ['Prudent', '5-10%', 'Large Cap', 'Index Picking + Value'],
    ['Équilibré', '10-20%', 'Mid Cap', 'Rotation + Momentum'],
    ['Offensif', '20-40%', 'Small Cap', 'Momentum + Rotation'],
  ]));

  slides.push(bullets('Les Avantages Cachés du Retail', [
    'Agilité totale : vous pouvez acheter des small caps instantanément, un fonds ne peut pas',
    'Aucune contrainte de reporting : tenez une position 5 ans sans la pression d\'un comité',
    'Invisibilité : personne ne copie vos trades ni ne front-run vos ordres',
    'Pas de contraintes de mandat : vous pouvez tout acheter, de l\'or au Bitcoin en passant par les obligations',
  ]));

  // Les 4 méthodes
  slides.push(steps('Méthode 1 : Rotation Sectorielle', [
    { number: 1, title: 'Identifier le secteur chaud', description: 'Comparez les ETF sectoriels sur 1-3 mois. Quel secteur surperforme ?' },
    { number: 2, title: 'Choisir les leaders du secteur', description: 'Les 3-5 meilleures actions du secteur en termes de momentum et qualité' },
    { number: 3, title: 'Rotation mensuelle', description: 'Chaque mois, vérifiez si le secteur est toujours en tête. Sinon, pivotez.' },
  ]));

  slides.push(table('Capitalisation boursière — La taille compte', ['Catégorie', 'Taille', 'Exemples', 'Risque'], [
    ['Mega Cap', '> 200 Mds $', 'Apple, LVMH, Microsoft', 'Très faible'],
    ['Large Cap', '10-200 Mds $', 'Air Liquide, Safran', 'Faible'],
    ['Mid Cap', '2-10 Mds $', 'Dassault Aviation, Hims', 'Modéré'],
    ['Small Cap', '300M-2 Mds $', 'KULR, POET Technologies', 'Élevé'],
    ['Micro Cap', '< 300M $', 'Penny stocks', 'Très élevé'],
  ]));

  slides.push(concept('La matrice Profil × Capitalisation', 'Voici comment croiser votre profil et la capitalisation. Un profil prudent sur du large cap, c\'est de l\'index picking classique : achetez les meilleures actions de l\'indice. Un profil équilibré sur du mid cap, c\'est de la rotation sectorielle avec du momentum : suivez les secteurs chauds. Un profil offensif sur du small cap, c\'est du momentum pur : scannez les breakouts avec du volume. L\'erreur fatale, c\'est d\'être offensif sur du small cap alors que vous êtes un débutant. Commencez par le profil prudent sur du large cap. Montez en compétence avant de monter en risque.'));

  slides.push(concept('Règle d\'or : la taille dicte la méthode', 'Vous ne pouvez pas analyser un micro cap comme un mega cap. Sur un mega cap comme Apple, l\'analyse fondamentale est reine : les données sont abondantes, les analystes nombreux, et le marché est très efficient. Sur un small cap, c\'est l\'analyse technique et le catalyseur qui comptent : les données sont rares, la liquidité faible, et un seul contrat peut faire bouger le prix de 10%. Adaptez votre méthode à la taille du poisson que vous chassez.'));

  slides.push(concept('Cas concret : Énergie Q4 2025', 'Le XLE (ETF énergie) a fait +10,7% en un mois tandis que le S&P 500 ne faisait que +2,3%. En se concentrant sur les leaders du secteur — ExxonMobil, Chevron, ConocoPhillips — on captait cette surperformance. Avantage : c\'est mécanique, 15 minutes par mois, et ça a prouvé +3 à 5% par an au-dessus de l\'indice.'));

  slides.push(steps('Méthode 2 : Index Picking', [
    { number: 1, title: 'Choisir un indice de référence', description: 'CAC 40, S&P 500, Dow Jones — votre terrain de jeu' },
    { number: 2, title: 'Filtrer avec 3 critères', description: 'Croissance du CA > 5%, dividende > 2%, dette/EBITDA < 3x' },
    { number: 3, title: 'Construire un panier de 10-15', description: 'Les meilleures actions de l\'indice selon vos critères' },
  ]));

  slides.push(tip('La stratégie "Top 10 CAC 40" : prenez les 10 actions du CAC avec le plus haut rendement dividende, gardez-les un an, rebalancez. Cette stratégie bat le CAC 40 sept années sur dix. Temps requis : 1 heure par trimestre.'));

  slides.push(steps('Méthode 3 : Momentum', [
    { number: 1, title: 'Scanner les performances 3 mois', description: 'Quelles actions ont le plus monté sur 3 mois ?' },
    { number: 2, title: 'Vérifier : prix au-dessus de la SMA 50', description: 'Pas de momentum sans tendance haussière confirmée' },
    { number: 3, title: 'Confirmer le volume', description: 'Le volume doit augmenter — sinon c\'est du mouvement sans conviction' },
    { number: 4, title: 'Stop-loss à -8%', description: 'Non négociable. Le momentum peut s\'inverser brutalement.' },
  ]));

  slides.push(concept('Cas concret : Palantir Q4 2025', 'Palantir, ticker PLTR, était un candidat momentum parfait. L\'action était au-dessus de sa SMA 50, le volume augmentait régulièrement, et les contrats gouvernementaux tombaient les uns après les autres. Entrée à 72 dollars, sortie à 98 dollars, soit +36% en 3 mois. Mais attention : l\'action avait déjà fait +400% sur l\'année. Le momentum trader entre sur des pullbacks, pas sur des rallyes. C\'est la différence entre un trader discipliné et un trader FOMO.'));

  slides.push(warning('Le piège FOMO du Momentum', 'Ne JAMAIS acheter une action qui a fait +50% en un mois sans consolidation. C\'est le piège classique. Attendez un pullback vers la SMA 20 ou un test de support avant d\'entrer. Le momentum, c\'est surfer sur une tendance — pas sauter sur un train à grande vitesse.'));

  slides.push(steps('Méthode 4 : Value Investing', [
    { number: 1, title: 'Trouver un P/E bas vs le secteur', description: 'ArcelorMittal P/E 5,2x quand le secteur est à 9,8x — ça intrigue' },
    { number: 2, title: 'Vérifier que c\'est pas un piège à valeur', description: 'Les bénéfices sont-ils stables ? La dette raisonnable ? Le dividende maintenu ?' },
    { number: 3, title: 'Acheter et être patient', description: 'Horizon 6-18 mois. ArcelorMittal a fait +33% en 8 mois.' },
  ]));

  slides.push(table('Comparaison des 4 Méthodes', ['Méthode', 'Difficulté', 'Temps/sem.', 'Rendement attendu', 'Risque'], [
    ['Rotation Sectorielle', '⭐⭐', '15 min/mois', '+3-5%/an vs indice', 'Modéré'],
    ['Index Picking', '⭐', '1h/trimestre', '+2-4%/an vs indice', 'Faible'],
    ['Momentum', '⭐⭐⭐', '2-4h/mois', '+5-12%/an', 'Élevé'],
    ['Value Investing', '⭐⭐⭐', '5-10h/mois', '+3-8%/an', 'Modéré'],
  ]));

  // QUIZ 2 (~30 min mark)
  slides.push(quiz(
    'Une action a fait +50% en 1 mois. Que faites-vous ?',
    ['J\'achète immédiatement, le momentum est fort !', 'J\'attends un pullback vers la SMA 20 avant d\'entrer', 'Je shorte car c\'est trop haut', 'Je la mets dans ma watchlist et j\'oublie'],
    1,
    'En momentum trading, on ne saute jamais sur un train en marche. On attend un pullback vers la SMA 20 ou un test de support. Le FOMO est l\'ennemi numéro 1 du trader momentum.'
  ));

  slides.push(concept('Le piège du Value Trap', 'Une action pas chère n\'est pas forcément une bonne affaire. Le "value trap", c\'est une action qui semble bon marché — P/E bas, rendement élevé — mais qui est en réalité en déclin structurel. Comment les détecter ? Trois critères. Premièrement, les bénéfices sont-ils stables ou en baisse ? Un P/E bas parce que les bénéfices s\'effondrent, c\'est un piège. Deuxièmement, la dette est-elle raisonnable ? Une dette/EBITDA supérieure à 3x est un warning. Troisièmement, le dividende est-il maintenu ? Si le payout ratio dépasse 80%, le dividende va probablement être coupé. Le value investing, ce n\'est pas acheter ce qui est bon marché — c\'est acheter ce qui est temporairement sous-évalué par le marché.'));

  slides.push(concept('L\'impact des news et du contexte', 'Quatre types de contexte bougent les marchés. La politique monétaire : quand la Fed baisse les taux, les actions montent parce que les alternatives (obligations) deviennent moins attractives. La géopolitique : une guerre commerciale ou un conflit militaire crée de l\'incertitude — le VIX monte. Les earnings : 70% du mouvement annuel d\'une action vient de ses 4 publications de résultats. Et les données macro : CPI, NFP, et PMI donnent le ton pour des semaines. Chaque méthode de stock picking est impactée différemment : le momentum souffre en période de choc géopolitique, le value investing brille en fin de correction.'));

  slides.push(concept('Comment utiliser les ADR chinois', 'Les ADR (American Depositary Receipts) chinois comme Alibaba ou Baidu offrent des valorisations incroyablement basses : Alibaba à un P/E de 8-12x contre 25-30x pour Amazon. Mais attention : les ADR utilisent une structure VIE (Variable Interest Entity) — vous ne possédez pas vraiment les actions chinoises, mais un contrat aux Îles Caïmans. En plus, le risque de delisting HFCAA est réel. Règle : maximum 5% du portefeuille en ADR chinois, et préférez les listings Hong Kong si possible.'));

  slides.push(concept('La rotation géographique', 'Quand le dollar est faible, les marchés émergents et l\'Europe surperforment parce que leurs exportations deviennent plus compétitives. Quand le dollar est fort, la tech US domine parce que les capitaux affluent vers la sécurité américaine. Après une crise, les émergents et les small caps rebondissent le plus vite. En période d\'inflation élevée, les matières premières et l\'Amérique latine brillent. Suivez le dollar index DXY pour anticiper ces rotations.'));

  // Validation / Invalidation
  slides.push(comparison('Signaux de Validation vs Invalidation',
    { label: '✅ Signaux verts — Renforcer', items: ['Prix au-dessus de la SMA 50', 'Volume en hausse', 'Earnings beat', 'Insiders qui achètent', 'RSI entre 50 et 70'] },
    { label: '❌ Signaux rouges — Couper', items: ['Cassure sous la SMA 50', 'Volume qui s\'effondre', 'Earnings miss', 'Insiders qui vendent', 'Stop touché'] }
  ));

  // L'IA comme outil
  slides.push(bullets('L\'IA comme Outil de Recherche', [
    'Perplexity : recherche en temps réel, parfait pour les news et données récentes',
    'Claude : analyse nuancée et profonde, idéal pour les thèses d\'investissement',
    'ChatGPT : polyvalent, bon pour les comparaisons et résumés',
    'Prompt magique : "Donne-moi 7 raisons de NE PAS acheter [action]" — force l\'analyse contradictoire',
  ]));

  slides.push(warning('Les 5 Pièges de l\'IA', 'L\'IA hallucine des données (vérifiez toujours sur Yahoo Finance). Ses données peuvent être obsolètes. Elle a une fausse assurance — elle ne dit jamais "je ne sais pas". Elle a un biais de conformité (elle dit ce que vous voulez entendre). Et elle a un biais de popularité — elle favorise les actions connues.'));

  slides.push(steps('Arbre de décision pour le stock picking', [
    { number: 1, title: 'Trouvez un candidat', description: 'Scan sectoriel, screener, ou recommandation vérifiée' },
    { number: 2, title: 'Au-dessus de la SMA 50 ?', description: 'Non → Ne pas toucher. Oui → Continuer.' },
    { number: 3, title: 'Volume en hausse ?', description: 'Non → Watchlist. Oui → Continuer.' },
    { number: 4, title: 'Fondamentaux OK ?', description: 'Croissance + dette raisonnable → Acheter avec stop à -8%' },
  ]));

  slides.push(summary('Chapitre 2 — À Retenir', [
    '4 méthodes éprouvées : rotation sectorielle, index picking, momentum, value',
    'Le retail a des avantages uniques : agilité, invisibilité, pas de contraintes',
    'Toujours définir un stop-loss AVANT d\'entrer en position',
    'L\'IA est un outil de recherche, pas un oracle — vérifiez tout',
    'FOMO = ennemi n°1 du momentum trader',
  ]));

  // ── CHAPITRE 3: Construire son Portefeuille (~20 min) ─────────────
  slides.push(chapterIntro(3, 6, 'Construire son Portefeuille', 'De la diversification à la routine quotidienne de l\'investisseur'));

  slides.push(table('Combien de positions selon votre capital ?', ['Capital', 'Nb positions', 'Taille par position'], [
    ['< 2 000 €', '3-5', '400-700 €'],
    ['2 000-10 000 €', '5-8', '250-2 000 €'],
    ['10 000-50 000 €', '8-15', '700-6 000 €'],
    ['> 50 000 €', '15-25', '2 000-3 300 €'],
  ]));

  slides.push(concept('Pourquoi 90% des débutants perdent de l\'argent', 'L\'AMF publie régulièrement des études sur les performances des investisseurs particuliers en France. Le constat est brutal : environ 90% des traders actifs perdent de l\'argent sur 4 ans. Pourquoi ? Trois raisons principales. Premièrement, les frais : commissions, spread, et surtout le slippage s\'accumulent. Deuxièmement, l\'excès de trading : chaque trade est une occasion de se tromper. Les gagnants tradent peu. Troisièmement, l\'absence de méthode : acheter et vendre sur des intuitions, des "tuyaux", ou des émotions. Cette formation est là pour que vous fassiez partie des 10% qui réussissent — avec une méthode, de la discipline, et de la patience.'));

  slides.push(concept('La Règle des 90%', 'Une étude de Statman de 1987, confirmée par Evans et Archer, montre que 90% du bénéfice de la diversification est atteint avec seulement 15 à 20 actions. Au-delà, vous ajoutez de la complexité sans réduire significativement le risque. Concentrez-vous sur la qualité, pas la quantité.'));

  slides.push(bullets('Les ETF Essentiels pour un PEA', [
    'Amundi MSCI World (CW8) — 0,38% de frais — l\'ETF universel',
    'Amundi S&P 500 — 0,15% de frais — le cœur de portefeuille',
    'Amundi Nasdaq-100 — 0,23% de frais — pour la surpondération tech',
    'Amundi MSCI Emerging Markets — 0,20% — diversification géographique',
    'Lyxor STOXX 600 — 0,07% — le moins cher pour l\'Europe',
  ]));

  slides.push(concept('DCA vs Lump Sum', 'Le DCA (investir un montant fixe chaque mois) perd contre le lump sum (tout investir d\'un coup) deux tiers du temps — étude Vanguard 2012. Mais le DCA est psychologiquement supérieur : vous ne risquez jamais d\'investir tout au plus haut. Pour un débutant, le DCA mensuel est la meilleure stratégie.'));

  slides.push(warning('La Fausse Diversification', 'Le MSCI World, c\'est 70% US et 25% tech. C\'est un ETF américain déguisé. Acheter S&P 500 + MSCI World = 85% US. Acheter AAPL + MSFT + un ETF Nasdaq + CW8 = corrélation de 0,95. La vraie diversification : US + Europe + Émergents + Obligations + Or + Immobilier.'));

  slides.push(concept('Les ETF — L\'outil magique du débutant', 'Un ETF, c\'est un panier d\'actions en une seule transaction. Au lieu d\'acheter les 500 actions du S&P 500 une par une (impraticable et ruineux en frais), vous achetez un ETF qui réplique l\'indice pour 0,15% de frais par an. C\'est la révolution de l\'investissement passif. Trois avantages clés : la diversification instantanée (un ETF World vous expose à 1 500 entreprises dans 23 pays), les frais ultra-bas (0,07% à 0,38% par an contre 1,5 à 2% pour un fonds actif), et la transparence (vous savez exactement ce qu\'il contient). En PEA, les ETF synthétiques (à réplication indirecte) vous donnent accès au S&P 500 et au Nasdaq malgré la restriction aux titres européens.'));

  slides.push(concept('Réplication physique vs synthétique', 'Il y a deux types d\'ETF et la différence compte. L\'ETF à réplication physique achète vraiment toutes les actions de l\'indice. C\'est le plus simple et le plus transparent. L\'ETF à réplication synthétique utilise un swap (un contrat avec une banque) pour reproduire la performance de l\'indice. Pourquoi c\'est important ? En PEA, les ETF physiques sont limités aux actions européennes. Mais les ETF synthétiques, bien que techniquement "européens", peuvent répliquer le S&P 500, le Nasdaq, ou les marchés émergents via des swaps. C\'est comme ça qu\'Amundi ou Lyxor vous donnent accès au monde entier dans un PEA. Le risque de contrepartie existe mais est très encadré par la réglementation UCITS.'));

  slides.push(concept('Exemple de portfolio 10 000 euros', 'Voici un exemple concret. Sur 10 000 euros dans un PEA : 3 000 euros sur un ETF MSCI World (CW8) pour le socle global. 2 000 euros sur un ETF S&P 500 pour surpondérer les US. 1 500 euros sur TotalEnergies pour l\'énergie et le dividende à 5%. 1 000 euros sur Safran pour l\'aéronautique et la défense. 1 000 euros sur LVMH pour le luxe français. 1 000 euros sur BNP Paribas pour les financières. Et 500 euros en cash pour les opportunités. Vous avez 6 positions, 3 secteurs, et un mix d\'ETF et d\'actions individuelles. C\'est simple, diversifié, et gérable.'));

  slides.push(concept('Le DCA en pratique', 'Le Dollar Cost Averaging, c\'est investir un montant fixe chaque mois, quoi qu\'il arrive. Disons 300 euros par mois dans un ETF S&P 500. En janvier, le prix est à 100 euros par part : vous achetez 3 parts. En février, ça baisse à 80 euros : vous achetez 3,75 parts. En mars, ça remonte à 110 euros : vous achetez 2,7 parts. Votre prix moyen : 95,38 euros, soit moins que la moyenne arithmétique de 96,67 euros. C\'est l\'avantage mathématique du DCA : vous achetez automatiquement plus quand c\'est moins cher.'));

  slides.push(table('DCA vs Lump Sum — Les chiffres', ['Scénario', 'DCA', 'Lump Sum', 'Gagnant'], [
    ['Marché haussier', '+8,2%', '+10,5%', 'Lump Sum'],
    ['Marché baissier puis haussier', '+12,4%', '+7,3%', 'DCA'],
    ['Marché volatile latéral', '+5,1%', '+4,8%', 'DCA'],
    ['Statistiquement (66% du temps)', '—', '—', 'Lump Sum'],
    ['Psychologiquement', '😌', '😰', 'DCA'],
  ]));

  slides.push(table('4 Styles de Trading', ['Style', 'Durée', 'Pour qui', 'Verdict'], [
    ['Scalping', 'Secondes', 'Traders pro', '❌ Impossible pour un salarié'],
    ['Day Trading', 'Heures', 'Temps plein', '❌ 97% perdent de l\'argent'],
    ['Swing Trading', 'Jours-Semaines', 'Salariés', '✅ Idéal pour commencer'],
    ['Buy & Hold', 'Mois-Années', 'Tout le monde', '✅ Le plus performant long terme'],
  ]));

  slides.push(tip('Le combo gagnant pour un salarié parisien : 80% Buy & Hold (ETF + quelques actions de qualité en DCA) + 20% Swing Trading (2-3 positions actives maximum). Le meilleur des deux mondes.'));

  slides.push(concept('Les heures de marché à connaître', 'Si vous travaillez à Paris, voici vos fenêtres. Le pré-market US commence à 10h, heure de Paris. Le marché européen est ouvert de 9h à 17h30. Le marché US ouvre à 15h30, heure de Paris, et ferme à 22h. Les 30 premières minutes et les 30 dernières minutes sont les plus volatiles — c\'est là que les pros exécutent. La pause déjeuner européenne (12h-13h30) est souvent calme : c\'est le moment de faire vos analyses.'));

  slides.push(concept('Évaluer la force relative d\'une action', 'La force relative compare la performance d\'une action à celle de son indice de référence. Si Apple monte de 5% alors que le S&P 500 monte de 2%, Apple a une force relative positive. C\'est un indicateur puissant parce qu\'il montre les flux de capitaux : les actions à force relative croissante attirent les institutionnels. Sur TradingView, vous pouvez afficher le ratio AAPL/SPY pour visualiser cette force relative directement. Les meilleures opportunités de momentum se trouvent dans les actions qui surperforment leur indice depuis 3 à 6 mois avec un volume croissant. C\'est le signe que les "smart money" s\'accumulent progressivement.'));

  slides.push(concept('Les 5 indicateurs de température du marché', 'Chaque matin, avant d\'ouvrir une position, vérifiez ces 5 indicateurs. Le VIX : niveau de peur (en dessous de 20 = calme). Le breadth : combien d\'actions montent versus descendent (sur 2000 actions). Les spreads high yield : l\'écart entre obligations pourries et obligations d\'État — s\'il s\'élargit, les institutionnels ont peur. Le put/call ratio : au-dessus de 1 = les gens achètent plus de protections que d\'appels haussiers — c\'est un signal de peur, souvent un bottom. Et le pourcentage d\'actions au-dessus de leur SMA 200 : en dessous de 30% = marché survendu, opportunité probable. Ces 5 indicateurs prennent 2 minutes à vérifier et donnent une image complète de la santé du marché.'));

  slides.push(concept('Lire une page Yahoo Finance', 'Yahoo Finance est votre outil de base gratuit. Tapez un ticker, et vous trouvez tout. Le prix en temps réel et le changement journalier. Le P/E ratio : comparez-le au secteur, pas en absolu. Le volume : un volume anormalement haut signale quelque chose. Le market cap : ça vous dit la taille de l\'entreprise. Les 52-week high et low : où en est le prix par rapport à son range annuel. Les estimations d\'earnings : ce que les analystes attendent pour le prochain trimestre. Et les insider transactions dans l\'onglet Holders : qui achète, qui vend.'));

  // Dividendes
  slides.push(concept('Les Dividendes — Revenus Passifs', 'Un portefeuille de 50 000 € en actions à 4% de rendement génère 2 000 € par an de revenus passifs. En PEA après 5 ans, c\'est quasiment net d\'impôt. Les Dividend Aristocrats comme Coca-Cola, Johnson & Johnson et Procter & Gamble augmentent leur dividende depuis 25 années consécutives ou plus. C\'est le pouvoir des intérêts composés appliqué aux dividendes : en 20 ans, le rendement sur votre prix d\'achat initial peut atteindre 8 à 10%.'));

  slides.push(bullets('4 stratégies de dividendes', [
    'High Yield : choisir les actions avec le rendement le plus élevé — risque : le dividende peut être coupé',
    'Dividend Growth : choisir les actions qui augmentent leur dividende chaque année — plus sûr, rendement initial plus faible',
    'Dogs of the CAC : les 10 plus hauts rendements du CAC 40, rebalancé chaque année',
    'DRIP (réinvestissement automatique) : les dividendes achètent automatiquement plus d\'actions — effet boule de neige',
  ]));

  slides.push(warning('Le piège du rendement trop élevé', 'Un rendement de dividende au-dessus de 8% est un drapeau rouge. Ça signifie souvent que le prix de l\'action a chuté parce que le marché anticipe une coupe du dividende. Vérifiez le payout ratio : si l\'entreprise distribue plus de 80% de ses bénéfices en dividendes, c\'est insoutenable. Et vérifiez que le dividende a été maintenu ou augmenté sur les 5 dernières années.'));

  slides.push(concept('Récap du Chapitre 2 — Les méthodes en bref', 'Nous avons vu 4 méthodes de stock picking. La rotation sectorielle : suivez les secteurs chauds, 15 minutes par mois. L\'index picking : filtrez les meilleures actions d\'un indice, une heure par trimestre. Le momentum : surfez sur les tendances avec des stops à moins 8%, attention au FOMO. Le value investing : achetez les sous-évalués, attention aux value traps. Chaque méthode a son profil idéal. Commencez par une seule, maîtrisez-la, puis diversifiez votre approche. Et n\'oubliez pas : l\'IA est un outil de recherche, pas un oracle — vérifiez toujours ses réponses.'));

  slides.push(concept('Peut-on vivre de la bourse ?', 'C\'est la question que tout le monde se pose. Faisons les maths. Pour vivre avec 3 000 euros par mois en France, il vous faut 36 000 euros par an. Si votre portefeuille génère 6% par an (dividendes + plus-values), il vous faut 600 000 euros de capital. C\'est beaucoup, mais c\'est atteignable en 20-25 ans de DCA discipliné. Trois chemins réalistes : le dividende aristocrate (construire un portefeuille de 500K+ en actions à dividende croissant), le retiré-comblé (ETF S&P 500 + règle des 4% de retrait), ou le hybride (revenus de trading actif + portefeuille passif). Le chemin le plus fiable est le plus ennuyeux : DCA pendant 20 ans.'));

  slides.push(table('Modèles de portefeuille selon l\'objectif', ['Objectif', 'Composition', 'Rendement visé', 'Risque'], [
    ['Préservation du capital', '60% Obligations + 30% ETF + 10% Or', '4-5%/an', 'Très faible'],
    ['Croissance modérée', '50% ETF World + 20% ETF US + 20% Actions + 10% Cash', '7-9%/an', 'Modéré'],
    ['Croissance agressive', '40% Actions + 30% ETF + 15% Small Caps + 10% Crypto + 5% Cash', '10-15%/an', 'Élevé'],
    ['Revenu passif', '50% Dividend Aristocrats + 30% REITs + 20% Obligations', '5-7% dividende', 'Modéré'],
  ]));

  slides.push(concept('Le risque de change — L\'ennemi invisible', 'Si vous achetez des actions US avec un PEA (via un ETF à réplication synthétique) ou un CTO, vous êtes exposé au taux de change euro/dollar. Si le dollar baisse de 10%, vos gains en euros baissent de 10% même si l\'action n\'a pas bougé. À l\'inverse, un dollar fort booste vos rendements en euros. Solutions : certains ETF sont "hedgés" (couverts contre le change), mais les frais sont plus élevés. Pour le long terme, le risque de change se lisse. Pour le court terme, c\'est un facteur à surveiller.'));

  // QUIZ 3 (~45 min mark)
  slides.push(quiz(
    'Le MSCI World contient combien de pourcentage d\'actions américaines ?',
    ['Environ 30%', 'Environ 50%', 'Environ 70%', 'Environ 90%'],
    2,
    'Le MSCI World est composé à environ 70% d\'actions américaines et 25% de tech. C\'est un ETF américain déguisé ! Pour une vraie diversification, combinez-le avec de l\'Europe, des émergents et d\'autres classes d\'actifs.'
  ));

  slides.push(bullets('L\'IA comme Copilote de Portefeuille', [
    '"Analyse mon portefeuille : 40% CW8, 20% S&P, 20% LVMH, 20% cash. Quels sont les risques de corrélation ?"',
    '"Donne-moi 5 ETF décorrélés de mon portefeuille actuel"',
    '"Compare les dividendes de TotalEnergies, Sanofi et Air Liquide sur 10 ans"',
    'Limitation : l\'IA ne connaît pas VOS objectifs personnels — elle optimise dans le vide',
  ]));

  slides.push(summary('Chapitre 3 — À Retenir', [
    '15-20 positions suffisent pour 90% de la diversification',
    'Le DCA mensuel en ETF est la meilleure stratégie pour un débutant',
    'Le MSCI World n\'est pas vraiment "World" — 70% US, 25% tech',
    '80% Buy & Hold + 20% Swing = le combo idéal pour un salarié',
    'Les dividendes créent des revenus passifs — privilégiez le PEA',
  ]));

  // ── CHAPITRE 4: L'Art du All-In (~20 min) ─────────────────────────
  slides.push(chapterIntro(4, 6, 'L\'Art du All-In Intelligent', 'Quand et comment concentrer ses positions — avec discipline'));

  slides.push(concept('Ouvrir un compte — Le guide pratique', 'En France, vous avez 3 enveloppes fiscales principales. Le PEA : c\'est le graal fiscal. Après 5 ans, zéro impôt sur les plus-values (seulement 17,2% de prélèvements sociaux). Plafond de 150 000 euros de versements. Limité aux actions européennes et ETF éligibles — mais les ETF synthétiques vous donnent accès au S&P 500, au Nasdaq, aux émergents. Le CTO : pas d\'avantage fiscal (30% flat tax), mais accès à tout — actions US, options, crypto. L\'assurance-vie : avantages après 8 ans, parfait pour la transmission. Commencez par le PEA.'));

  slides.push(table('Comparatif des meilleurs courtiers PEA', ['Courtier', 'Frais/ordre', 'Point fort', 'Point faible'], [
    ['Boursorama', '0,50%', 'Banque en ligne complète', 'Frais un peu élevés'],
    ['Fortuneo', '0,35%', 'Bon rapport qualité/prix', 'Interface vieillissante'],
    ['Bourse Direct', '0,09%', 'Les frais les plus bas', 'Interface basique'],
    ['Trade Republic', '1 €/ordre', 'Simple, moderne, DCA auto', 'Gamme limitée'],
    ['Interactive Brokers', '0,05%', 'Le pro — tout, partout', 'Complexe pour débuter'],
  ]));

  slides.push(bullets('7 astuces fiscales essentielles', [
    'Remplissez le PEA AVANT le CTO — la différence fiscale est énorme après 5 ans',
    'Compensez les gains et les pertes dans le CTO — les moins-values se reportent 10 ans',
    'Ne retirez JAMAIS d\'argent du PEA avant 5 ans — sinon clôture et perte de l\'avantage fiscal',
    'Déclarez TOUJOURS vos moins-values — même si vous ne payez pas d\'impôts, créez du stock de déficit',
    'Préférez les ETF capitalisants pour l\'exposition US en PEA — pas de retenue à la source sur les dividendes réinvestis',
    'Ouvrez un PEA-PME en plus : 75 000 euros de plafond supplémentaire pour les small caps françaises',
    'L\'assurance-vie avant 70 ans : exonération de droits de succession jusqu\'à 152 500 euros par bénéficiaire',
  ]));

  slides.push(warning('Le All-In, ce n\'est PAS du casino', 'Concentrer ses positions peut être légitime — mais seulement si 5 conditions sont réunies simultanément. Sans discipline, le all-in est de la roulette russe financière. Avec discipline, c\'est ce qui fait la différence entre +10% et +100% dans une année.'));

  slides.push(steps('Les 5 Conditions du All-In Légitime', [
    { number: 1, title: 'Conviction fondamentale', description: 'Vous comprenez le business en profondeur — pas juste un graphique' },
    { number: 2, title: 'Timing technique', description: 'Breakout confirmé, volume en hausse, tendance alignée sur 3 timeframes' },
    { number: 3, title: 'Risk/Reward ≥ 1:3', description: 'Vous risquez 1 pour gagner 3 minimum. Non négociable.' },
    { number: 4, title: 'Catalyseur identifié', description: 'Earnings, FDA approval, contrat majeur — quelque chose va déclencher le mouvement' },
    { number: 5, title: 'Capacité à perdre', description: 'Si ça tourne mal, votre vie financière continue normalement' },
  ]));

  slides.push(concept('Récap du Chapitre 3 — L\'essentiel du portefeuille', 'Le chapitre 3 nous a appris que 15 à 20 positions suffisent pour 90% de la diversification. Le DCA mensuel en ETF est la meilleure stratégie pour un débutant — mathématiquement perdante contre le lump sum deux tiers du temps, mais psychologiquement gagnante pour 100% des débutants. Attention à la fausse diversification : le MSCI World est 70% américain. Le combo idéal pour un salarié : 80% buy and hold en ETF plus 20% swing trading sur quelques positions actives. Les dividendes créent des revenus passifs — privilégiez le PEA pour l\'avantage fiscal. Et la question "peut-on vivre de la bourse" a une réponse : oui, avec 600 000 euros de capital et de la discipline.'));

  slides.push(concept('Cas d\'étude — Le all-in qui a marché', 'Prenons un cas concret. En octobre 2022, le marché était en bear market, le VIX à 33. NVIDIA cotait autour de 115 dollars. Les 5 conditions étaient réunies : conviction fondamentale forte (l\'IA générative explosait avec ChatGPT en préparation), timing technique (breakout au-dessus de la SMA 50 après des mois de consolidation), R/R de 1:4 (stop à 95 dollars, objectif à 200 dollars), catalyseur identifié (Earnings + adoption massive de l\'IA), et capacité à perdre (20% du portefeuille maximum). Résultat 12 mois plus tard : NVDA à 490 dollars, soit +326%. L\'entrée échelonnée en 3 tranches a permis de construire la position progressivement en captant le pullback de novembre et le breakout de janvier.'));

  slides.push(concept('Cas d\'étude — Le all-in qui a raté', 'Maintenant, le cas opposé. Début 2021, beaucoup d\'investisseurs retail ont fait un "all-in" sur Peloton (PTON) à 160 dollars. Le COVID avait boosté les ventes de vélos d\'appartement, les résultats étaient excellents. Mais 3 des 5 conditions n\'étaient pas réunies : le R/R était médiocre (le prix avait déjà fait +500% en un an), il n\'y avait pas de catalyseur futur (le boom COVID était derrière), et le VIX était bas — signe de complaisance, pas d\'opportunité. Résultat : Peloton est passé de 160 à 5 dollars en 18 mois. -97%. Le all-in sans les 5 conditions est une roulette russe. Ne confondez jamais conviction et certitude.'));

  slides.push(concept('L\'Entrée Échelonnée — L\'Approche Intelligente', 'Plutôt que de mettre 100% d\'un coup, divisez votre entrée en 3 tranches. Première tranche à 33% sur le signal initial. Deuxième tranche à 33% sur la confirmation (pullback + rebond). Troisième tranche à 34% sur le breakout du premier objectif. Vous réduisez le risque de timing tout en gardant une position significative.'));

  slides.push(table('Routine Quotidienne du Trader Salarié', ['Heure', 'Action', 'Durée'], [
    ['7h00', 'Scan des pre-market US + news overnight', '10 min'],
    ['8h30', 'Vérification alertes TradingView', '5 min'],
    ['12h30', 'Point mi-journée Europe', '5 min'],
    ['15h30', 'Ouverture US — exécution si setup validé', '15 min'],
    ['22h00', 'Bilan du jour + journal de trading', '10 min'],
  ]));

  // Validation
  slides.push(comparison('Signaux de Validation d\'un All-In',
    { label: '🟢 Feu Vert — Go', items: ['Breakout avec volume 2x la moyenne', 'Insiders achètent dans les 30 derniers jours', 'Consensus analystes en hausse', 'Secteur en rotation favorable', 'RSI entre 55 et 70'] },
    { label: '🔴 Feu Rouge — Stop', items: ['Volume qui baisse sur la montée', 'Insiders qui vendent massivement', 'Short interest en forte hausse', 'Dilution récente (S-3 filing)', 'VIX > 30 sans raison macro claire'] }
  ));

  slides.push(bullets('L\'IA comme Avocat du Diable', [
    'Prompt "Red Team" : "Je veux mettre 30% de mon portfolio sur NVDA. Joue le rôle d\'un analyste baissier et donne-moi 10 raisons pour lesquelles c\'est une mauvaise idée."',
    'Prompt contradictoire : "Compare les risques de NVDA vs AMD vs INTC. Sois brutal et honnête."',
    'Règle : si l\'IA ne trouve pas 5 vrais risques, vous n\'avez pas assez cherché',
    'Comparer les réponses de Claude, ChatGPT et Perplexity — les divergences sont informatives',
  ]));

  slides.push(concept('Votre checklist All-In en 10 points', 'Avant chaque all-in, passez en revue ces 10 points. Un : est-ce que je comprends le business en profondeur ? Si vous ne pouvez pas expliquer le modèle économique à un enfant de 12 ans, vous ne comprenez pas assez. Deux : le setup technique est-il validé sur 3 timeframes ? Daily, weekly, monthly doivent être alignés. Trois : le R/R est-il supérieur à 1 pour 3 ? Quatre : y a-t-il un catalyseur identifié dans les 30 prochains jours ? Cinq : les insiders achètent-ils ? Six : le secteur est-il en rotation favorable ? Sept : le VIX est-il sous 25 ? Huit : ai-je demandé à une IA de "red teamer" ma thèse ? Neuf : puis-je perdre cette somme sans impact sur ma vie ? Dix : ai-je écrit tout ça dans mon journal ?'));

  slides.push(concept('L\'utilisation de l\'IA pour valider une conviction', 'L\'IA est un outil extraordinaire si vous l\'utilisez correctement. Le prompt le plus puissant n\'est pas "dois-je acheter NVDA ?" — l\'IA dira oui parce qu\'elle veut vous faire plaisir. Le prompt le plus puissant est "Je vais mettre 30% de mon portefeuille sur NVDA. Joue le rôle d\'un analyste fondamentalement baissier et donne-moi 10 raisons concrètes pour lesquelles c\'est une terrible idée." Utilisez ce prompt sur Claude, ChatGPT, ET Perplexity. Comparez les réponses. Les points de divergence entre les trois sont les plus informatifs : c\'est là que l\'incertitude est la plus grande, et donc là que le risque réel se cache.'));

  slides.push(concept('Configurer les alertes TradingView', 'TradingView est l\'outil indispensable du trader moderne, et le plan gratuit suffit pour commencer. Voici les 4 alertes à mettre en place sur chaque position. Premièrement, une alerte de prix sur votre stop-loss. Deuxièmement, une alerte sur votre premier objectif de profit. Troisièmement, une alerte sur les volumes anormaux — configurez "Volume Greater Than 2x Average". Quatrièmement, une alerte sur le croisement de la SMA 50 : si le prix passe en dessous, c\'est un signal de vente. Ces 4 alertes vous permettent de suivre vos positions sans regarder l\'écran toute la journée.'));

  slides.push(concept('Le calendrier économique — Les dates qui comptent', 'Chaque mois, certaines dates font bouger les marchés de façon prévisible. Le premier vendredi du mois, c\'est le NFP, le rapport sur l\'emploi américain. Le CPI sort vers le 10-13 du mois. Les réunions FOMC ont lieu 8 fois par an. Et les earnings season commencent environ 2 semaines après la fin de chaque trimestre : janvier-février pour le Q4, avril-mai pour le Q1, juillet-août pour le Q2, et octobre-novembre pour le Q3. Notez ces dates dans votre agenda. Ne prenez JAMAIS de nouvelle position la veille d\'un événement macro majeur.'));

  slides.push(concept('Comment s\'informer sans se faire manipuler', 'Les réseaux sociaux sont un piège pour l\'investisseur. Twitter finance, c\'est 95% de bruit et 5% de signal. Les comptes avec des fusées et des émojis diamant sont presque toujours des pump and dump déguisés. Voici les règles. Premièrement, séparez vos sources d\'information de vos sources de divertissement. Deuxièmement, suivez des comptes institutionnels plutôt que des influenceurs. Troisièmement, méfiez-vous de quiconque vous montre des P&L spectaculaires — les pertes ne sont jamais montrées. Et quatrièmement, si quelqu\'un vous promet des rendements garantis, c\'est une arnaque. Toujours.'));

  slides.push(bullets('Les bonnes sources francophones', [
    'Investir.fr : l\'hebdo de référence, analyses sérieuses, payant mais fiable',
    'Boursorama : données de marché gratuites et de qualité, forum animé (avec les réserves habituelles)',
    'Zone Bourse : analyses fondamentales et consensus analystes, partie gratuite généreuse',
    'Les Échos / Le Revenu : actualité macro et entreprises, bonne couverture européenne',
    'Xavier Delmas (YouTube) : vulgarisation finance de qualité, sans sensationnalisme',
  ]));

  // QUIZ 4 (~60 min mark = 1h)
  slides.push(quiz(
    'Votre portefeuille de 15 000 € et vous voulez "all-in" sur un ticker. Comment entrez-vous en position ?',
    ['100% d\'un coup pour maximiser le gain', '3 tranches de 33% : signal, confirmation, breakout', '50% maintenant, 50% si ça monte de 10%', 'J\'emprunte pour mettre encore plus'],
    1,
    'L\'entrée échelonnée en 3 tranches réduit le risque de timing. Jamais de levier ni d\'emprunt pour un all-in. Et n\'oubliez pas : les 5 conditions doivent être réunies AVANT de commencer.'
  ));

  slides.push(concept('Le concept du Heat — Risque total du portefeuille', 'Le heat, c\'est le risque total de toutes vos positions ouvertes combinées. Si vous avez 5 positions et que chacune risque 2% de votre portefeuille, votre heat total est de 10%. C\'est comme la température dans une cocotte-minute : plus le heat monte, plus le risque d\'explosion est élevé. La règle : gardez votre heat total en dessous de 6% en temps normal. Si vous faites un all-in, votre heat monte temporairement — mais jamais au-dessus de 10%. Le heat est la métrique que les traders professionnels surveillent en permanence mais que les amateurs ignorent complètement.'));

  slides.push(concept('Quand NE PAS faire de all-in', 'Même si toutes les conditions techniques sont réunies, le all-in est parfois interdit. Premièrement : si vous venez de subir une perte importante — votre jugement est altéré. Deuxièmement : si le VIX est au-dessus de 30 sans raison macro claire — le marché est en mode panique. Troisièmement : à la veille d\'une annonce majeure comme le FOMC, le CPI, ou les earnings. Le gap overnight peut vous détruire. Quatrièmement : si vous n\'avez pas fait de post-mortem écrit de votre dernière perte. Le meilleur all-in est celui que vous ne faites pas parce que les conditions n\'étaient pas parfaites.'));

  slides.push(summary('Chapitre 4 — À Retenir', [
    'Le all-in n\'est légitime QUE si les 5 conditions sont réunies',
    'Entrée échelonnée en 3 tranches : signal → confirmation → breakout',
    'Utilisez l\'IA comme avocat du diable, pas comme cheerleader',
    'Routine quotidienne : 45 minutes max pour un salarié',
    'Si l\'IA ne trouve pas 5 vrais risques, vous n\'avez pas assez cherché',
  ]));

  // ── CHAPITRE 5: Stratégies Avancées (~20 min) ────────────────────
  slides.push(chapterIntro(5, 6, 'Stratégies Avancées', '8 stratégies qui ont survécu à 100 ans de marchés'));

  slides.push(table('8 Stratégies Éprouvées', ['Stratégie', 'Rendement', 'Drawdown max', 'Temps requis'], [
    ['Buy & Hold', '~10%/an', '-57%', '5 min/mois'],
    ['DCA', '~9-10%/an', 'Lissé', '5 min/mois'],
    ['Momentum', '~12%/an', '-50%+', '2-4h/mois'],
    ['Value Investing', '~13%/an', '-55%', '5-10h/mois'],
    ['Dividend Growth', '~9-10%/an', '-45%', '2h/trimestre'],
    ['Barbell (Taleb)', 'Variable', 'Limité', '2-4h/mois'],
    ['Pairs Trading', '~5-8%/an', '-15-25%', '5-10h/mois'],
    ['Dogs of the Dow', '~11%/an', '-40%', '1h/an'],
  ]));

  slides.push(concept('Récap du Chapitre 4 — La discipline du all-in', 'Le all-in est légitime si et seulement si les 5 conditions sont réunies : conviction fondamentale, timing technique, R/R supérieur à 1 pour 3, catalyseur identifié, et capacité à perdre. L\'entrée se fait en 3 tranches pour réduire le risque de timing. L\'IA est votre avocat du diable, pas votre cheerleader. Le heat total du portefeuille ne doit jamais dépasser 10%. Et parfois, le meilleur all-in est celui que vous ne faites pas. Les cas NVIDIA et Peloton illustrent la différence entre un all-in discipliné et un all-in émotionnel.'));

  slides.push(concept('La Stratégie Barbell de Nassim Taleb', '85 à 90% de votre portefeuille en ultra-safe (obligations d\'État, fonds euros, cash) et 10 à 15% en ultra-agressif (options, crypto, startups). Aucun milieu. Vous ne pouvez pas perdre plus de 15%, mais vos 10-15% agressifs peuvent faire x10. C\'est l\'antifragilité appliquée à l\'investissement.'));

  slides.push(concept('Dogs of the Dow — 100% Mécanique', 'Chaque 1er janvier, achetez les 10 actions du Dow Jones avec le rendement dividende le plus élevé. Tenez-les un an. Rebalancez. C\'est tout. Cette stratégie bat le Dow Jones presque tous les ans et ne demande qu\'une heure par an. Rendement historique : environ 11% par an.'));

  slides.push(concept('La stratégie Pairs Trading', 'Le pairs trading, c\'est de l\'arbitrage statistique. Vous achetez une action et shortez une autre du même secteur. Par exemple : long Coca-Cola, short Pepsi. Si le secteur monte, Coca et Pepsi montent toutes les deux — votre gain vient de la surperformance relative de Coca. Si le secteur baisse, vos deux positions baissent — mais votre short sur Pepsi compense. Vous êtes market-neutral : le marché peut monter ou descendre, vous gagnez tant que Coca fait mieux que Pepsi. Rendement plus faible (5-8% par an) mais drawdown très limité (15-25%).'));

  slides.push(concept('Le Dividend Growth Investing', 'Plutôt que de chercher les rendements les plus élevés aujourd\'hui, cherchez les entreprises qui augmentent leur dividende chaque année. Coca-Cola augmente son dividende depuis 62 années consécutives. Johnson & Johnson depuis 62 ans aussi. Procter & Gamble depuis 68 ans. Si vous aviez acheté Coca-Cola il y a 30 ans, votre rendement sur votre prix d\'achat serait aujourd\'hui de 12% par an, pas 3%. C\'est la magie du "yield on cost" — le dividende grossit pendant que votre prix d\'achat ne bouge pas. Rendement modeste au début, exponentiel sur le long terme.'));

  slides.push(quote('Le temps est l\'ami de l\'entreprise merveilleuse et l\'ennemi de l\'entreprise médiocre.', 'Warren Buffett'));

  slides.push(warning('7 Fausses Bonnes Idées', 'Le market timing rate : manquer les 10 meilleurs jours du S&P sur 20 ans divise votre rendement par deux. Les penny stocks : 90% perdent de la valeur en 3 ans. Les "tuyaux" : c\'est soit du délit d\'initié, soit déjà pricé. La martingale : 6 pertes consécutives = 6 400€ risqués pour gagner 100€. Le day trading : 97% perdent selon l\'étude de Berkeley.'));

  // Options
  slides.push(bullets('Options — Les Bases en 2 Minutes', [
    'Un Call : le droit d\'acheter à un prix fixé → vous gagnez si ça monte',
    'Un Put : le droit de vendre à un prix fixé → vous gagnez si ça baisse',
    'Les 4 Grecs : Delta (sensibilité au prix), Theta (érosion temporelle), Vega (sensibilité à la volatilité), Gamma (accélération)',
    'Règle d\'or : ne risquez JAMAIS plus de 2% par trade en options',
  ]));

  slides.push(comparison('3 Stratégies Options pour Débutants',
    { label: '✅ Stratégies adaptées', items: ['Covered Call : vendre des calls sur vos actions pour générer du revenu', 'Protective Put : acheter un put pour assurer votre portefeuille', 'Cash-Secured Put : vendre un put pour acheter moins cher'] },
    { label: '❌ À ne JAMAIS faire', items: ['Vendre des puts nus (naked puts) : risque illimité', 'Acheter des options à très court terme : le theta vous mange', 'Utiliser plus de 5% du portefeuille en options spéculatives'] }
  ));

  slides.push(concept('Le Timing de Marché — Pourquoi ça ne marche pas', 'Les données sont impitoyables. Sur 20 ans, si vous ratez les 10 meilleurs jours du S&P 500, votre rendement est divisé par deux. Problème : 6 des 10 meilleurs jours surviennent dans les 2 semaines qui suivent les 10 pires jours. Autrement dit, pour capter les rebonds, il faut être présent pendant les krachs. Le market timing, c\'est essayer de prédire l\'imprévisible. Le temps passé dans le marché bat systématiquement le timing du marché. Ce n\'est pas une opinion — c\'est ce que montrent les données sur 100 ans.'));

  slides.push(table('$10 000 investis dans le S&P 500 sur 20 ans', ['Scénario', 'Résultat', 'Rendement annuel'], [
    ['Resté investi 100% du temps', '~64 000 $', '9,8%/an'],
    ['Raté les 10 meilleurs jours', '~29 000 $', '5,6%/an'],
    ['Raté les 20 meilleurs jours', '~17 000 $', '2,7%/an'],
    ['Raté les 30 meilleurs jours', '~11 000 $', '0,5%/an'],
  ]));

  slides.push(concept('Les saisonnalités appliquées aux stratégies', 'Les saisonnalités interagissent avec les stratégies. Le momentum fonctionne particulièrement bien de novembre à avril, pendant la période "Sell in May". Le value investing a tendance à mieux performer après les périodes de tax-loss harvesting, c\'est-à-dire en janvier-février quand les "value traps" que les gens ont vendues en décembre pour des raisons fiscales rebondissent. Le Santa Rally de fin décembre favorise les large caps. Et le Triple Witching (3ème vendredi de mars, juin, septembre, décembre) crée des opportunités de volatilité pour les traders de momentum et d\'options. Adaptez votre intensité de trading au calendrier.'));

  slides.push(concept('Les options expliquées simplement', 'Imaginez que vous voulez acheter un appartement à Paris. Le propriétaire vous dit : "Pour 5 000 euros, je vous réserve l\'appartement à 500 000 euros pendant 3 mois." Si le prix monte à 600 000 euros, vous exercez votre option : vous gagnez 95 000 euros (600K - 500K - 5K de prime). Si le prix ne monte pas, vous perdez juste les 5 000 euros de réservation. C\'est exactement ça, un call. Et un put, c\'est l\'inverse : vous payez une prime pour pouvoir vendre à un prix garanti, même si le marché s\'effondre. C\'est une assurance. Les options sont un outil de précision chirurgicale — puissant pour les pros, dangereux pour les débutants.'));

  slides.push(concept('Les Grecs — Le tableau de bord des options', 'Les "Grecs" sont les 4 paramètres qui font varier le prix d\'une option. Le Delta mesure combien l\'option bouge quand l\'action bouge de 1 dollar — un delta de 0,5 signifie que si l\'action monte de 1 dollar, votre option monte de 50 cents. Le Theta mesure l\'érosion temporelle — chaque jour qui passe, votre option perd de la valeur, comme un glaçon qui fond. Le Vega mesure la sensibilité à la volatilité — quand le VIX monte, toutes les options prennent de la valeur. Et le Gamma mesure l\'accélération du Delta — c\'est le turbo. Pour un débutant, retenez ceci : le Theta est votre ennemi si vous achetez des options, et votre ami si vous les vendez.'));

  slides.push(concept('Les ETF d\'obligations — Le filet de sécurité', 'Les obligations sont souvent ignorées par les débutants, mais elles sont essentielles pour un portefeuille équilibré. En période de récession, les obligations d\'État montent quand les actions baissent — c\'est la corrélation négative qui protège votre portefeuille. Les ETF facilitent l\'accès : TLT pour les obligations US long terme, BND pour un mix global, AGG pour les investment grade. En PEA, des ETF comme le Lyxor Euro Government Bond sont disponibles. La règle classique "100 moins votre âge en actions" est simpliste mais pas stupide : à 30 ans, 70% actions et 30% obligations. À 60 ans, 40% actions et 60% obligations.'));

  slides.push(concept('Les investissements alternatifs', 'Au-delà des actions et obligations, il existe 6 classes d\'actifs alternatives. L\'immobilier coté (REITs) : des dividendes de 4-6% sans gérer de locataires. L\'or : la couverture ultime contre le chaos. Les matières premières : pétrole, cuivre, blé — via les producteurs, pas les ETF. Les cryptomonnaies : Bitcoin comme "or numérique", très volatile. Le private equity : réservé aux grosses fortunes, mais les ETF PE arrivent. Et les obligations : le socle de stabilité, surtout les obligations d\'État. Un portefeuille vraiment diversifié combine 4-5 de ces classes.'));

  // La règle des 2%
  slides.push(concept('La Règle des 2% — Le Commandement Suprême', 'Ne risquez JAMAIS plus de 2% de votre capital total par trade. Sur un portefeuille de 20 000€, ça fait 400€ de risque maximum. Si votre stop-loss est à 5% du prix d\'entrée, votre position maximale est de 8 000€. Cette règle est ce qui sépare les traders qui survivent de ceux qui explosent.'));

  // QUIZ 5 (~75 min mark)
  slides.push(quiz(
    'Vous avez 20 000 € et la règle des 2%. Votre stop est à 5% sous l\'entrée. Quelle est la taille maximale de votre position ?',
    ['2 000 €', '4 000 €', '8 000 €', '10 000 €'],
    2,
    'Risque max = 2% de 20 000 € = 400 €. Si le stop est à 5%, alors 400 € / 5% = 8 000 € maximum par position. C\'est mathématique et non négociable.'
  ));

  slides.push(concept('Volatilité et ATR — Calculer la taille de position', 'L\'ATR, c\'est l\'Average True Range : la distance moyenne que parcourt une action en un jour. Si l\'ATR est de 2 euros et que vous risquez 2% de votre portefeuille de 20 000 euros, soit 400 euros, votre position maximale est de 400 divisé par 2, soit 200 actions. C\'est une approche dynamique : sur une action volatile (ATR élevé), vous prenez une position plus petite. Sur une action stable (ATR faible), vous pouvez prendre une position plus grande. Le résultat : chaque position a le même impact sur votre portefeuille, indépendamment de la volatilité de l\'action.'));

  slides.push(bullets('4 stratégies de couverture (hedging)', [
    'Protective Put : achetez un put sur votre position — c\'est une assurance. Ça coûte le premium mais ça limite votre perte maximum.',
    'Collar : achetez un put et vendez un call sur la même position — le call finance partiellement le put. Protection gratuite mais rendement plafonné.',
    'Position inverse : shortez un ETF du même secteur — si votre action baisse avec le secteur, le short compense.',
    'Diversification temporelle : n\'entrez pas tout d\'un coup. 3 tranches sur 3 semaines réduisent le risque de timing.',
  ]));

  slides.push(concept('Le drawdown management — Couper ou tenir ?', 'Voici l\'arbre de décision quand une position est en perte. Premièrement : est-ce que votre stop a été touché ? Si oui, coupez. Pas de négociation. Deuxièmement : est-ce que la thèse d\'investissement a changé ? Si l\'entreprise a publié de mauvais résultats ou qu\'un concurrent a tout changé, coupez. Si la thèse est intacte et que la baisse est liée au marché global, tenez. Troisièmement : est-ce que la perte représente plus de 2% de votre portefeuille ? Si oui, réduisez la position pour revenir à 2% de risque maximum. La discipline sur les drawdowns est ce qui sépare les traders qui font des carrières de ceux qui font des feux d\'artifice.'));

  slides.push(concept('Backtesting — Testez Avant de Risquer', 'Avant de déployer une stratégie en réel, testez-la sur les données historiques. Utilisez TradingView (gratuit) ou QuantConnect (gratuit). Attention aux 4 pièges mortels : le biais du survivant (vous ne testez que les actions qui existent encore), le sur-ajustement (votre stratégie marche parfaitement sur le passé mais pas sur le futur), l\'oubli des frais, et le look-ahead bias (utiliser des données du futur).'));

  slides.push(steps('Les 4 pièges mortels du backtesting', [
    { number: 1, title: 'Biais du survivant', description: 'Vous testez sur les actions qui existent aujourd\'hui — mais celles qui ont fait faillite ne sont pas dans vos données. Résultat faussé.' },
    { number: 2, title: 'Sur-ajustement (overfitting)', description: 'Votre stratégie fonctionne parfaitement sur le passé parce que vous l\'avez "overfit" aux données. Elle échouera en temps réel.' },
    { number: 3, title: 'Oubli des frais et slippage', description: 'Les commissions, le spread, et le slippage mangent 1-3% par an. Incluez-les dans vos backtests.' },
    { number: 4, title: 'Look-ahead bias', description: 'Utiliser une info que vous n\'aviez pas encore au moment du trade. Exemple : filtrer sur les résultats annuels alors qu\'ils ne sont publiés qu\'en mars.' },
  ]));

  slides.push(concept('Les outils de backtesting gratuits', 'Vous n\'avez pas besoin de dépenser un centime pour backtester. TradingView offre un outil de replay qui vous permet de rejouer les marchés jour par jour — parfait pour tester votre jugement visuel. QuantConnect est gratuit et permet de coder des stratégies en Python ou C# avec des données historiques de 30 ans. Portfolio Visualizer est un outil en ligne gratuit pour tester l\'allocation d\'actifs — tapez vos ETF, choisissez les dates, et voyez les résultats. Et pour les plus avancés, la librairie Python "backtrader" est open source et très puissante. Le backtest ne garantit rien, mais il élimine les stratégies qui n\'ont jamais fonctionné — ce qui est déjà énorme.'));

  slides.push(concept('Le Walk-Forward Testing', 'La bonne méthode de backtest s\'appelle le walk-forward testing. Prenez 5 ans de données. Optimisez votre stratégie sur les 3 premières années (in-sample). Testez-la sur les 2 années suivantes (out-of-sample), sans modification. Si elle marche en out-of-sample, avancez la fenêtre d\'un an et recommencez. Si elle ne marche qu\'en in-sample, c\'est de l\'overfitting. Les métriques clés : le Sharpe ratio (rendement/risque, vous voulez au-dessus de 1), le maximum drawdown (votre pire scénario), et le nombre de trades (pas assez de trades = résultats non statistiquement significatifs).'));

  slides.push(steps('Construire votre plan de trading', [
    { number: 1, title: 'Quel est votre objectif ?', description: 'Croissance du capital, revenus passifs, ou les deux ? Soyez précis : "8% par an" est un objectif.' },
    { number: 2, title: 'Quel est votre horizon ?', description: '1 an, 5 ans, 20 ans ? Ça change tout : la stratégie, le sizing, et la tolérance au risque.' },
    { number: 3, title: 'Combien de temps par semaine ?', description: '30 min = DCA en ETF. 2h = swing trading. 20h+ = day trading (déconseillé).' },
    { number: 4, title: 'Quelles sont vos règles d\'entrée ?', description: 'Écrivez-les. "J\'achète quand..." avec des critères objectifs et mesurables.' },
    { number: 5, title: 'Quelles sont vos règles de sortie ?', description: 'Stop-loss, take-profit, trailing stop. Si vous n\'avez pas de règle de sortie AVANT d\'entrer, n\'entrez pas.' },
  ]));

  slides.push(summary('Chapitre 5 — À Retenir', [
    '8 stratégies ont survécu à 100 ans de marchés — choisissez la vôtre',
    'La règle des 2% est le commandement suprême du risk management',
    'Le market timing ne marche pas — le temps dans le marché bat le timing',
    'Les options sont un outil puissant mais dangereux — covered calls pour commencer',
    'Backtestez toujours avant de déployer en réel',
    'Écrivez votre plan de trading — si ce n\'est pas écrit, ce n\'est pas un plan',
  ]));

  // ── CHAPITRE 6: Se Remettre d'une Perte (~20 min) ────────────────
  slides.push(chapterIntro(6, 6, 'Se Remettre d\'une Perte', 'La psychologie du trader : gérer les pertes, les gains, et ses émotions'));

  slides.push(concept('Les 5 Phases du Deuil en Trading', 'Elisabeth Kübler-Ross a identifié 5 phases de deuil que tout trader traverse après une grosse perte. Le déni : "c\'est temporaire, ça va remonter" — c\'est la phase la plus dangereuse, celle où -10% devient -50%. La colère : "le marché est truqué !" — mène au revenge trading. La négociation : "si ça revient à mon prix d\'entrée, je vends" — le marché se fiche de votre prix d\'entrée. La dépression. Et enfin l\'acceptation : "j\'ai perdu, voici ce que j\'ai appris, voici mon plan."'));

  slides.push(table('L\'Asymétrie Brutale des Pertes', ['Perte', 'Gain nécessaire pour revenir', 'Commentaire'], [
    ['-10%', '+11,1%', 'Gérable'],
    ['-20%', '+25%', 'Commence à faire mal'],
    ['-30%', '+42,9%', 'Très difficile à rattraper'],
    ['-50%', '+100%', 'Il faut doubler pour revenir'],
    ['-90%', '+900%', 'Quasi impossible'],
  ]));

  slides.push(warning('Règle des 48 heures', 'Après une perte significative, ne faites RIEN pendant 48 à 72 heures. Pas de trading, pas de revenge trade, pas de "je vais me refaire". Marchez, dormez, parlez à quelqu\'un. Les 6 erreurs fatales post-perte : doubler la mise, changer de stratégie sous l\'émotion, ignorer le stop, abandonner le journal, trader plus gros pour compenser, et accuser les autres.'));

  slides.push(table('Ce que font les traders gagnants vs perdants', ['Critère', 'Top 20%', 'Bottom 20%'], [
    ['Trades/mois', '2-4', '15-25'],
    ['Holding period', '3-12 mois', '2-10 jours'],
    ['Coupe à', '-8%', '-40%'],
    ['Tient un journal', '85%', '3%'],
    ['Utilise un plan écrit', '92%', '11%'],
    ['Risque/trade', '1-2%', '5-15%'],
  ]));

  slides.push(concept('Le revenge trading — L\'erreur fatale', 'Après une perte, la tentation est immense de "se refaire" immédiatement. C\'est le revenge trading, et c\'est l\'erreur la plus destructrice en trading. Le mécanisme est simple : vous venez de perdre 1 000 euros, la colère monte, vous prenez une position 2 fois plus grosse "pour compenser", et vous perdez encore plus. Le revenge trading transforme une perte de 5% en une perte de 20%. La solution est contre-intuitive : après une perte significative, ne faites RIEN. La règle des 48 heures existe parce que votre cerveau a besoin de temps pour sortir du mode émotionnel et revenir au mode rationnel.'));

  slides.push(concept('Les 6 erreurs fatales post-perte', 'Voici ce que font les perdants après une grosse perte. Premièrement, doubler la mise pour "revenir plus vite" — c\'est la martingale, et ça ne marche pas. Deuxièmement, changer de stratégie sous l\'émotion — si votre stratégie était bonne, la perte fait partie du jeu. Troisièmement, ignorer le stop sur le prochain trade "pour ne pas être stoppé encore" — c\'est comme retirer la ceinture de sécurité après un accident. Quatrièmement, abandonner le journal — c\'est exactement le moment où le journal est le plus utile. Cinquièmement, trader plus gros pour compenser — c\'est le revenge trading. Sixièmement, accuser les autres (le marché est truqué, le broker m\'a piégé) — vous êtes responsable de vos trades.'));

  slides.push(concept('L\'Étude Barber & Odean', 'Sur 66 465 comptes analysés, les 20% les plus performants tradent peu (2-4 fois par mois), gardent longtemps (3-12 mois), coupent vite (à -8%), et tiennent un journal (85% d\'entre eux). Les 20% les moins performants font l\'inverse exact. La performance est inversement corrélée à la fréquence de trading.'));

  slides.push(table('Les biais cognitifs du trader', ['Biais', 'Ce que ça fait', 'L\'antidote'], [
    ['Aversion à la perte', 'Vous gardez les perdants trop longtemps', 'Stop-loss automatique'],
    ['Coûts irrécupérables', '"J\'ai déjà perdu 5K, je ne peux pas vendre"', 'La perte passée ne change pas l\'avenir'],
    ['Effet de disposition', 'Vous vendez les gagnants trop tôt', 'Trailing stop + règle des tiers'],
    ['Biais de confirmation', 'Vous cherchez ce qui confirme votre thèse', 'Prompt IA "devil\'s advocate"'],
    ['Ancrage', 'Vous restez fixé sur votre prix d\'entrée', 'Le marché se fiche de votre prix'],
    ['Biais de récence', 'Les derniers événements dominent votre pensée', 'Reculez et regardez le monthly chart'],
  ]));

  slides.push(concept('Anatomie d\'un drawdown', 'Un drawdown, c\'est la distance entre le point le plus haut et le point le plus bas de votre portefeuille. Le S&P 500 a un drawdown moyen intra-annuel de 14%. C\'est normal. Un drawdown de 20-30% arrive en moyenne tous les 5-7 ans. Un drawdown de 50% arrive une fois par génération : 2000-2002, 2008-2009, 2020 (brièvement). La question n\'est pas "est-ce que ça va arriver" mais "suis-je préparé quand ça arrive". La préparation, c\'est le sizing, le stop-loss, et la diversification.'));

  slides.push(steps('Plan de récupération en 5 étapes', [
    { number: 1, title: 'Stop total 48-72h', description: 'Fermez les plateformes. Marchez. Dormez. Le marché sera encore là dans 3 jours.' },
    { number: 2, title: 'Post-mortem écrit', description: 'Écrivez ce qui s\'est passé, pourquoi, et ce que vous auriez dû faire différemment.' },
    { number: 3, title: 'Réduire la taille de 50-75%', description: 'Revenez avec des positions 2 à 4 fois plus petites. Reconstruisez la confiance.' },
    { number: 4, title: 'Appliquer la règle du 1%', description: 'Temporairement, passez de 2% à 1% de risque par trade. Soyez conservateur.' },
    { number: 5, title: '10 trades positifs consécutifs', description: 'Avant d\'augmenter la taille, prouvez-vous que votre méthode fonctionne encore.' },
  ]));

  slides.push(concept('Le sizing adaptatif post-drawdown', 'Quand vous êtes en drawdown, la taille de vos positions doit diminuer proportionnellement. Si vous avez perdu 10% de votre capital, passez temporairement de la règle des 2% à la règle du 1%. Si vous avez perdu 20%, passez à 0,5%. L\'idée : quand vous êtes en difficulté, réduisez le risque pour protéger ce qui reste, tout en continuant à trader pour reconstruire la confiance. Le concept de "heat" est utile : le heat, c\'est le risque total de toutes vos positions ouvertes combinées. En temps normal, gardez le heat sous 6%. En drawdown, descendez à 3%.'));

  slides.push(concept('Le post-mortem : la clé de l\'amélioration', 'Après chaque perte significative (plus de 1% du portefeuille), écrivez un post-mortem. Quatre questions. Premièrement : quel était mon plan initial ? Si vous n\'aviez pas de plan, c\'est le problème numéro 1. Deuxièmement : à quel moment ai-je dévié du plan ? La déviation est presque toujours le point de rupture. Troisièmement : quelle émotion a guidé ma décision ? La peur, la cupidité, ou le FOMO ? Identifiez-la. Quatrièmement : que ferais-je différemment la prochaine fois ? Écrivez une règle concrète. Les traders qui font des post-mortem systématiques améliorent leur performance de 20 à 40% sur 6 mois.'));

  slides.push(concept('Le position sizing adaptatif — Méthode concrète', 'Voici un exemple concret de position sizing post-drawdown. Imaginons un portefeuille de 20 000 euros. En conditions normales, vous risquez 2% par trade, soit 400 euros. Si votre stop est à 5%, votre position max est de 8 000 euros. Maintenant, supposons que vous êtes en drawdown de 15% — votre portefeuille est à 17 000 euros. Vous passez à la règle du 1% : risque max = 170 euros. Avec un stop à 5%, votre position max est de 3 400 euros. Vous avez réduit votre exposition de 58%. C\'est la discipline qui vous permet de survivre. Quand vous aurez reconstitué votre capital à 19 000 euros, vous pouvez remonter progressivement à 1,5% puis 2%.'));

  slides.push(concept('Le journal de trading — Votre arme secrète', 'Le journal de trading est l\'outil numéro 1 des traders gagnants. 85% des top performers en tiennent un, contre seulement 3% des perdants. Que noter ? Le ticker, la date, le prix d\'entrée et de sortie, la taille de la position, la raison d\'entrée (technique, fondamentale, catalyseur), la raison de sortie (stop, TP, signal), votre état émotionnel au moment de la décision (calme, anxieux, euphorique, en colère), et la leçon tirée. Après 50 trades, analysez vos patterns. Vous découvrirez que vous tradez mieux certains jours, certaines heures, certains types de setup. C\'est la base de l\'amélioration continue. Un journal Excel suffit. Certains utilisent Tradervue ou Edgewonk.'));

  slides.push(concept('La heatmap personnelle', 'Après 3 mois de journal, créez votre heatmap personnelle. C\'est un tableau avec les jours en colonnes et les heures en lignes. Colorez en vert les trades gagnants et en rouge les perdants. Les patterns émergent vite : peut-être que vous êtes excellent le mardi matin mais terrible le vendredi après-midi. Peut-être que vos meilleurs trades viennent à l\'ouverture US (15h30) et vos pires trades à la clôture (21h-22h). Cette connaissance de vous-même est inestimable. Adaptez votre activité à vos zones de force et évitez de trader dans vos zones de faiblesse.'));

  slides.push(concept('4 légendes et leurs catastrophes', 'George Soros a perdu 800 millions de dollars en un seul jour lors du crash de 1987. Jesse Livermore a tout perdu trois fois — y compris sa vie. Long-Term Capital Management, un fonds de deux prix Nobel, a failli faire s\'effondrer le système financier en 1998. Et Bill Ackman a perdu 4 milliards sur Valeant Pharmaceuticals entre 2015 et 2017. Le point commun ? Même les meilleurs se trompent. La différence entre les survivants et les autres, c\'est le risk management. Soros est revenu parce qu\'il n\'avait jamais risqué la totalité de son capital.'));

  // Gestion des gains
  slides.push(bullets('Pourquoi les Gains sont AUSSI Dangereux', [
    'L\'excès de confiance : après +50%, on se croit invincible et on augmente la taille',
    'Le changement de méthode : "ça marche tellement bien, je vais trader plus souvent"',
    'L\'oubli de prendre des profits : "ça va continuer à monter" — et -30% en 2 jours',
    'Le lifestyle creep : dépenser les gains non réalisés',
  ]));

  slides.push(steps('La Règle des Tiers pour les Gains', [
    { number: 1, title: 'Premier tiers au TP1', description: 'Prenez 33% de profits au premier objectif. Sécurisez.' },
    { number: 2, title: 'Deuxième tiers au TP2', description: 'Prenez 33% supplémentaires. Remontez le stop au break-even.' },
    { number: 3, title: 'Dernier tiers : laissez courir', description: 'Le dernier tiers court avec un trailing stop. C\'est lui qui fait les gros gains.' },
  ]));

  // QUIZ 6 (~100 min mark)
  slides.push(quiz(
    'Vous perdez 30% sur une position. Quel gain vous faut-il pour revenir à zéro ?',
    ['+30%', '+35%', '+42,9%', '+50%'],
    2,
    'Si vous aviez 1 000 € et perdez 30%, il vous reste 700 €. Pour revenir à 1 000 €, vous devez gagner 300/700 = 42,9%. C\'est l\'asymétrie brutale des pertes — plus vous perdez, plus c\'est difficile de revenir.'
  ));

  // Émotions
  slides.push(steps('La Boîte à Outils du Trader Discipliné', [
    { number: 1, title: 'Le journal de trading', description: 'Notez chaque trade : raison d\'entrée, sortie, émotions ressenties, leçon tirée' },
    { number: 2, title: 'La heatmap personnelle', description: 'À quelle heure tradez-vous le mieux ? Quel jour ? Analysez vos patterns' },
    { number: 3, title: 'La règle des 3 strikes', description: '3 pertes consécutives = stop trading pour la journée. Non négociable.' },
    { number: 4, title: 'Le circuit-breaker personnel', description: '-5% sur le mois = réduire la taille de 50%. -10% = pause d\'une semaine.' },
    { number: 5, title: 'La checklist pré-trade', description: 'Setup dans le plan ? Stop défini ? R/R > 1:2 ? État émotionnel OK ? Heat respecté ?' },
  ]));

  slides.push(bullets('Corps & Esprit — Les Fondations Invisibles', [
    'Sommeil : un trader en dette de sommeil fait les mêmes erreurs qu\'un trader alcoolisé',
    'Exercice : le cortisol du stress baisse de 40% avec 30 min d\'exercice quotidien',
    'Alimentation : les pics de glycémie créent des pics de décision impulsive',
    'Méditation : même 5 minutes de pleine conscience améliorent la prise de décision',
  ]));

  slides.push(concept('La gestion des gains — les 5 pièges du succès', 'Les gains créent autant de problèmes que les pertes, mais de façon plus insidieuse. Piège numéro 1 : le lifestyle creep — vous gagnez 10 000 euros sur un trade et vous vous achetez une montre. Cet argent ne composera plus jamais. Piège numéro 2 : l\'augmentation de taille prématurée — après 3 trades gagnants, vous doublez vos positions et le 4ème trade efface tout. Piège numéro 3 : la complaisance — vous arrêtez de faire vos devoirs, vous arrêtez le journal, vous pensez que c\'est facile. Piège numéro 4 : le changement de style — "ça marche si bien en swing, je vais faire du day trading" — non. Piège numéro 5 : ignorer la fiscalité — 30% de flat tax sur les gains en CTO, à provisionner immédiatement.'));

  slides.push(concept('Le calendrier de gestion des gains', 'Après chaque mois positif, prenez une heure pour faire ce bilan. Premièrement : retirez 30% des gains pour les impôts (en CTO) et mettez-les de côté. Deuxièmement : analysez vos trades gagnants — était-ce du skill ou de la chance ? Si vous ne pouvez pas expliquer pourquoi vous avez gagné, c\'est probablement de la chance. Troisièmement : ajustez votre taille de position — mais vers le HAUT seulement si votre edge est confirmé sur au moins 20 trades. Quatrièmement : récompensez-vous modestement — un bon dîner, pas une voiture. L\'argent qui reste en bourse compose exponentiellement.'));

  slides.push(concept('La routine matinale du trader discipliné', 'Voici la routine idéale. Au réveil : pas de téléphone pendant 30 minutes. Un verre d\'eau, 5 minutes de respiration ou méditation. Ensuite, 10 minutes de scan macro : indices, VIX, calendrier éco du jour, news overnight. Puis, vérification de vos positions ouvertes et de vos alertes. Enfin, écriture de votre plan du jour : quelles actions surveiller, quels setups attendre, quel est votre budget de risque pour la journée. Cette routine prend 25 minutes et fait toute la différence entre un trader réactif et un trader proactif.'));

  slides.push(warning('Quand le trading devient une addiction', 'Si vous reconnaissez ces signes, il faut prendre du recul. Vous tradez même quand il n\'y a pas de setup, juste pour "l\'action". Vous cachez vos pertes à votre entourage. Vous augmentez la taille de vos positions pour retrouver l\'adrénaline. Vous ne pouvez pas dormir sans vérifier vos positions. Le trading peut devenir une addiction au même titre que le jeu. En France : Joueurs Info Service au 09 74 75 13 13, SOS Joueurs, et Gamblers Anonymous France. Demander de l\'aide n\'est pas un échec — c\'est un signe de maturité.'));

  slides.push(comparison('Investissement vs Jeu — Les 3 critères',
    { label: 'Investissement', items: ['Avantage statistique positif (edge)', 'Gestion du risque disciplinée', 'Horizon de temps > 1 mois'] },
    { label: 'Jeu', items: ['Pas d\'avantage statistique (espérance négative)', 'Pas de stop-loss, on "espère"', 'Gratification instantanée recherchée'] }
  ));

  // La stratégie Mega Fainéant
  slides.push(concept('BONUS : La Stratégie du Mega Fainéant', 'Vous voulez le meilleur rendement avec zéro effort ? Voici la recette : ouvrez un PEA, mettez en place un virement automatique mensuel, achetez un seul ETF (CW8 ou S&P 500) chaque mois. Ne regardez jamais. Ne vendez jamais. En 30 ans, 300 € par mois dans le S&P 500 deviennent plus de 500 000 €. Warren Buffett a gagné son pari de 1 million de dollars : le S&P 500 a fait +125,8% sur 10 ans contre +36% pour les hedge funds.'));

  slides.push(bullets('Les 5 Commandements du Mega Fainéant', [
    'Automatise : virement mensuel le 1er du mois, pas de décision à prendre',
    'Ne regarde jamais : moins tu regardes, mieux tu dors — et mieux tu performes',
    'Ne vends jamais : même quand ça baisse. Surtout quand ça baisse.',
    'Augmente graduellement : +50€/mois chaque année',
    'Ignore tout le monde : le beau-frère, BFM, Twitter — tout le monde',
  ]));

  slides.push(table('Simulation DCA sur 30 ans', ['Période', 'Montant investi', 'Valeur du portefeuille'], [
    ['Année 1', '3 600 €', '~3 960 €'],
    ['Année 5', '18 000 €', '~24 300 €'],
    ['Année 10', '36 000 €', '~62 000 €'],
    ['Année 20', '72 000 €', '~210 000 €'],
    ['Année 30', '108 000 €', '~620 000 €'],
  ]));

  slides.push(concept('Le pari de Buffett — La preuve ultime', 'En 2007, Warren Buffett a parié 1 million de dollars qu\'un simple fonds indiciel S&P 500 battrait n\'importe quelle sélection de hedge funds sur 10 ans. Ted Seides a relevé le défi avec 5 fonds de fonds. Résultat en 2017 : le S&P 500 a fait +125,8%. Les hedge funds ? +36%. Le Mega Fainéant a écrasé les cerveaux les mieux payés de Wall Street. La simplicité bat la complexité. La patience bat l\'intelligence.'));

  slides.push(quote('Si vous n\'êtes pas prêt à détenir une action pendant 10 ans, ne pensez même pas à la détenir pendant 10 minutes.', 'Warren Buffett'));

  // Plan d'action
  slides.push(steps('Votre plan d\'action sur 30 jours', [
    { number: 1, title: 'Semaine 1 : les bases', description: 'Ouvrir un PEA. Installer TradingView. Lire la page Yahoo Finance de 5 actions connues.' },
    { number: 2, title: 'Semaine 2 : le paper trading', description: 'Faire 10 trades en paper trading. Tenir un journal. Identifier votre profil (prudent/équilibré/offensif).' },
    { number: 3, title: 'Semaine 3 : le premier investissement', description: 'Premier DCA : 100-300€ sur un ETF MSCI World ou S&P 500. Mettre en place le virement automatique.' },
    { number: 4, title: 'Semaine 4 : la routine', description: 'Installer la routine matinale. Configurer 4 alertes TradingView. Faire votre premier stock picking.' },
  ]));

  slides.push(bullets('Les 5 livres essentiels pour approfondir', [
    'Flash Boys (Michael Lewis) : pour comprendre le HFT et la structure du marché',
    'L\'Investisseur Intelligent (Benjamin Graham) : la bible du value investing',
    'Fooled by Randomness (Nassim Taleb) : pourquoi on confond chance et talent',
    'Zero to One (Peter Thiel) : comment identifier les entreprises qui vont changer le monde',
    'Principles (Ray Dalio) : la macro-économie et les cycles expliqués par un milliardaire',
  ]));

  // QUIZ FINAL (~115 min mark)
  slides.push(quiz(
    'Quel est le commandement suprême du risk management ?',
    ['Ne jamais avoir plus de 5 positions', 'Toujours avoir un stop mental', 'Ne jamais risquer plus de 2% par trade', 'Couper ses pertes à -20%'],
    2,
    'La règle des 2% : ne risquez JAMAIS plus de 2% de votre capital total par trade. C\'est mathématique, non négociable, et c\'est ce qui sépare les traders qui survivent de ceux qui explosent.'
  ));

  slides.push(quiz(
    'Quelle stratégie a battu les hedge funds sur 10 ans dans le pari de Buffett ?',
    ['Le value investing concentré', 'Un fonds indiciel S&P 500', 'Le pairs trading', 'Le momentum sur les mega caps'],
    1,
    'Un simple fonds indiciel S&P 500 a fait +125,8% contre +36% pour les hedge funds. Warren Buffett a prouvé que la simplicité et la patience battent la complexité et les frais élevés. C\'est la stratégie du Mega Fainéant.'
  ));

  // 10 Règles d'Or
  slides.push(bullets('Les 10 Règles d\'Or du Retail', [
    '1. Ne risquez jamais plus de 2% par trade',
    '2. Le stop-loss se définit AVANT l\'entrée, pas après',
    '3. Le journal de trading est obligatoire — 85% des gagnants en tiennent un',
    '4. N\'écoutez personne — faites vos propres analyses',
    '5. Le cash est une position légitime et sous-estimée',
    '6. Coupez vos pertes vite, laissez courir vos gains',
    '7. La patience est la compétence la plus rentable',
    '8. Le marché a toujours raison — votre ego a toujours tort',
    '9. Commencez petit, augmentez progressivement',
    '10. L\'objectif n°1 est de survivre — les gains viendront après',
  ]));

  slides.push(summary('Chapitre 6 — À Retenir', [
    'L\'asymétrie des pertes est brutale : -50% nécessite +100% pour revenir',
    'Règle des 48h après une perte : ne rien faire pendant 2-3 jours',
    'Les traders gagnants tradent peu, gardent longtemps, et tiennent un journal',
    'Les gains sont aussi dangereux que les pertes — prenez des profits en 3 tiers',
    'La stratégie Mega Fainéant bat 97% des traders actifs',
  ]));

  // Conclusion
  slides.push(table('Calendrier de l\'investisseur — Année 1', ['Période', 'Objectif', 'Action'], [
    ['Mois 1-2', 'Les bases', 'Ouvrir PEA, 30 paper trades, lire 1 livre'],
    ['Mois 3-4', 'Premier capital', 'DCA mensuel en ETF, journal quotidien'],
    ['Mois 5-6', 'Stock picking', 'Analyser 20 actions, acheter 3-5 positions'],
    ['Mois 7-9', 'Affiner la méthode', 'Choisir 1 des 4 méthodes, backtester'],
    ['Mois 10-12', 'Routine établie', 'Bilan annuel, plan pour l\'année 2'],
  ]));

  slides.push(concept('La lettre à votre futur vous', 'Prenez 10 minutes pour écrire une lettre à vous-même dans un an. Notez : votre capital aujourd\'hui, vos objectifs pour l\'année, votre profil de risque, les erreurs que vous ne voulez pas refaire, et ce que vous voulez avoir appris. Mettez un rappel dans votre calendrier pour dans 12 mois. Quand vous relirez cette lettre, vous serez impressionné par le chemin parcouru. La progression en trading est lente et souvent invisible au quotidien — mais énorme sur un an.'));

  slides.push(concept('Les outils recommandés — Votre arsenal', 'Voici votre boîte à outils pour démarrer. Pour les graphiques : TradingView, gratuit et professionnel. Pour les données : Yahoo Finance et SEC EDGAR, gratuits tous les deux. Pour la macro : FRED, les données économiques de la Fed. Pour le backtesting : QuantConnect ou Portfolio Visualizer. Pour l\'IA : Claude pour l\'analyse profonde, Perplexity pour la recherche en temps réel. Pour le journal : un simple Google Sheet suffit. Vous n\'avez pas besoin de dépenser un centime pour commencer. Tous les outils essentiels sont gratuits.'));

  slides.push(concept('Le calendrier de l\'investisseur — Votre feuille de route', 'Votre première année devrait suivre un rythme progressif. Mois 1 et 2 : les fondations — ouvrir le PEA, lire un livre, faire 30 paper trades. Mois 3 et 4 : déployer le premier capital en DCA sur un ETF et commencer le journal quotidien. Mois 5 et 6 : analyser 20 actions en profondeur et acheter 3 à 5 premières positions individuelles. Mois 7 à 9 : choisir et affiner l\'une des 4 méthodes de stock picking. Mois 10 à 12 : bilan annuel et planification de l\'année 2. Ne brûlez pas les étapes.'));

  slides.push(concept('Merci et Bonne Route !', 'Vous avez maintenant toutes les bases pour commencer à investir intelligemment. Rappelez-vous : l\'objectif numéro un est de survivre. Les gains viendront naturellement avec la discipline, la patience et l\'apprentissage continu. Ouvrez ce PEA, faites vos 30 trades en paper trading, et lancez-vous. Le meilleur moment pour planter un arbre, c\'était il y a 20 ans. Le deuxième meilleur moment, c\'est maintenant.'));

  return slides;
}

// ════════════════════════════════════════════════════════════════════
// PLACEHOLDER GENERATORS (will be filled when we process each video)
// ════════════════════════════════════════════════════════════════════

function generateAISingularityFR() {
  slideIndex = 0;
  return [

    // ============================================================
    // PARTIE 1 : INTRODUCTION — LE POINT D'INFLEXION
    // ============================================================
    chapterIntro(1, "Le Point d'Inflexion", "Nous sommes au bord de la plus grande disruption technologique de l'histoire humaine"),

    concept("Pourquoi cette serie ?", "Les 5 prochaines annees vont redefinir ce qui est humainement possible. L'IA n'est pas une simple amelioration technologique : c'est une revolution structurelle qui va remodeler chaque secteur de l'economie. Cette serie en 15 chapitres cartographie le paysage d'investissement a travers la singularite IA. Marche adressable total estime : plus de 15 700 milliards de dollars d'ici 2030."),

    concept("Le changement de paradigme", "Toutes les quelques decennies, une technologie emerge qui ne se contente pas d'ameliorer les processus existants, mais recable fondamentalement l'architecture de la creation de valeur economique. La machine a vapeur l'a fait dans les annees 1780. L'electricite dans les annees 1890. Internet dans les annees 1990. L'intelligence artificielle le fait maintenant — mais a une vitesse qui rend chaque revolution precedente glaciaire en comparaison."),

    table("Les lois de scaling du compute IA", ["Modele", "Annee", "Parametres", "Compute (FLOPs)", "Capacite"],
      [
        ["GPT-2", "2019", "1,5 milliard", "~1,5 x 10^21", "Paragraphes coherents"],
        ["GPT-3", "2020", "175 milliards", "~3,1 x 10^23", "Few-shot, code"],
        ["GPT-4", "2023", "~1,8 trillion (MoE)", "~2,1 x 10^25", "Raisonnement expert"],
        ["GPT-4.5 / Claude 3.5", "2024", "~3-5 trillions", "~1 x 10^26", "Workflows agentiques"],
        ["Classe GPT-5", "2025E", "~10 trillions+", "~1 x 10^27", "Recherche niveau PhD"],
        ["Prochaine frontiere", "2027E", "~50-100 trillions", "~1 x 10^29", "Science autonome"]
      ]),

    concept("Pourquoi les exponentielles sont contre-intuitives", "Le cerveau humain est calibre pour l'estimation lineaire. Si vous marchez 1 km par jour, apres 30 jours vous avez marche 30 km. Mais la croissance exponentielle est profondement differente : si vous doublez un centime chaque jour, apres 30 jours vous avez 5,4 millions de dollars. Apres 40 jours : 5,5 milliards. Le compute IA suit une courbe super-exponentielle. Quand les experts disent qu'on sous-estime l'impact, c'est exactement pour ca."),

    comparison("L'IA vs les revolutions precedentes",
      { label: "Internet (1995-2005)", items: ["A numerise la distribution d'information", "Goulot d'etranglement supprime : cout de distribution", "Emplois deplaces : agents de voyage, vendeurs", "Capitalisation creee : ~3 000 Mds$", "Amelioration : ~50% par an (bande passante)"] },
      { label: "IA (2023-2030)", items: ["Numerise la cognition et la prise de decision", "Goulot supprime : l'offre d'expertise humaine", "Emplois deplaces : travailleurs du savoir, analystes, codeurs, radiologues", "Capitalisation projetee : ~25 000 Mds$+", "Amelioration : ~1000% par an (capacite IA)"] }
    ),

    bullets("Les 5 vagues de disruption IA", [
      "Vague 1 — Chatbots & Copilotes (2020-2023) : ChatGPT, GitHub Copilot, Midjourney. DEPLOYE. ~100 Mds$ TAM",
      "Vague 2 — Agents Autonomes (2024-2025) : Claude Code, Devin, Copilot Studio. EN DEPLOIEMENT. ~1 100 Mds$ TAM d'ici 2030",
      "Vague 3 — IA Physique (2025-2027) : Tesla Optimus, Figure AI, Waymo L4. EMERGENT. ~2 500 Mds$ TAM",
      "Vague 4 — IA Scientifique (2027-2029) : AlphaFold 3, decouverte de medicaments. R&D. ~3 000 Mds$ TAM",
      "Vague 5 — AGI / ASI (2029-2030+) : Intelligence generale. SPECULATIF. ~2 000 Mds$ TAM"
    ]),

    concept("Les capacites emergentes", "Dans les systemes complexes, l'emergence se produit quand le tout est superieur a la somme de ses parties. En IA, quand les chercheurs augmentent le nombre de parametres et les donnees d'entrainement, les modeles acquierent soudainement des competences qu'on ne leur a jamais explicitement enseignees — comme le code, le raisonnement ou la traduction. Ces capacites emergent brusquement a des seuils specifiques, pas graduellement. C'est la raison fondamentale pour laquelle les previsions sur l'IA ont ete systematiquement trop conservatrices."),

    steps("Le cadre d'investissement en 4 quadrants", [
      { step: "Infrastructure (Picks & Shovels)", detail: "NVDA, AMD, TSM, AVGO, MRVL, VRT, EQIX, CEG — Certitude elevee, horizon 1-3 ans" },
      { step: "Plateformes (Couche OS)", detail: "MSFT, GOOG, AMZN, META, ORCL, SNOW, MDB — Risque moyen-eleve, horizon 2-5 ans" },
      { step: "Applications (Gagnants utilisateurs)", detail: "PLTR, AXON, PANW, ISRG, DDOG, NOW — Rendement eleve mais risque eleve, horizon 3-5 ans" },
      { step: "Perdants (Short / A eviter)", detail: "INFY, WIT, RHI, MAN, UPWK, FVRR — Short asymetrique, horizon 1-3 ans" }
    ]),

    table("Precedents historiques des revolutions tech", ["Revolution", "Ere", "Gagnants iconiques", "Perdants iconiques", "Rendement total leaders"],
      [
        ["Chemins de fer", "1840-1880", "Union Pacific, J.P. Morgan", "Canaux, diligences", "~8 000%"],
        ["Electricite", "1880-1930", "GE, Westinghouse", "Fabricants de lampes a gaz", "~12 000%"],
        ["Internet", "1993-2010", "Amazon (+170 000%), Google", "Blockbuster, Kodak", "~170 000%"],
        ["Mobile", "2007-2020", "Apple (+7 500%), TSMC", "Nokia (-95%), BlackBerry (-97%)", "~7 500%"],
        ["IA", "2020-2035E", "NVDA (+25 000%), MSFT, PLTR", "IT outsourcers, SaaS legacy", "?? (Nous sommes ici)"]
      ]),

    tip("Le cadre de Carlota Perez", "Chaque revolution technologique suit un schema en deux phases : Phase 1 — Installation (Frenesie speculative, infrastructures construites en avance, bulle inevitable). Phase 2 — Deploiement (la technologie s'integre dans l'economie reelle, les vrais gains de productivite apparaissent). Amazon est passe de 100$ en 1999 a 5$ en 2001 puis a 200$ sur 20 ans. Les plus gros rendements vont aux investisseurs qui achetent l'infrastructure pendant la phase d'installation et tiennent a travers le retournement."),

    warning("Le risque : Capex sans revenus", "Les hyperscalers doivent generer 600 milliards de dollars de revenus IA annuels d'ici 2028 pour justifier les niveaux d'investissement actuels. Fin 2025, les revenus attribuables a l'IA totalisent environ 80-100 Mds$. L'ecart est reel et constitue le risque principal de la these."),

    quiz("Quel est le taux d'amelioration annuel des capacites IA selon les donnees empiriques ?",
      ["Environ 50% par an, comme la bande passante internet", "Environ 100% par an (doublement)", "Environ 1000% par an (10x)", "Environ 30% par an, comme les processeurs mobiles"],
      2, "Le compute IA se double environ tous les 6 mois, soit 4x par an. Avec les ameliorations algorithmiques, on arrive a environ 10x par an — c'est 16 fois plus rapide que la loi de Moore !"),

    summary("Chapitre 1 — Points cles", [
      "L'IA represente la plus grande creation de richesse de l'histoire humaine (~15-25 000 Mds$ d'ici 2030)",
      "Le compute IA progresse 16x plus vite que la loi de Moore",
      "5 vagues de disruption : chatbots, agents, IA physique, IA scientifique, AGI",
      "4 quadrants d'investissement : Infrastructure, Plateformes, Applications, Perdants",
      "Les hyperscalers ont engage 340 Mds$ de capex en 2025 — le capital est contractuellement engage"
    ]),

    // ============================================================
    // PARTIE 2 : LA COURSE AU COMPUTE
    // ============================================================
    chapterIntro(2, "La Course au Compute", "L'infrastructure internet est en train d'etre reconstruite de zero. C'est une opportunite a 1 000 milliards de dollars."),

    concept("Le buildout a 1 000 milliards", "Nous assistons au plus grand cycle d'investissement en infrastructures depuis le chemin de fer transcontinental. Les 5 hyperscalers — Microsoft, Alphabet, Meta, Amazon et Oracle — se sont collectivement engages a depenser plus de 336 milliards de dollars en capex pour l'annee 2025 seule, la grande majorite orientee vers la capacite IA des data centers. Ce n'est pas un phenomene d'une annee : le capex cumulatif depasse 1 500 milliards d'ici 2028."),

    table("Capex IA des hyperscalers (FY2025E)", ["Entreprise", "Capex FY2025E", "Croissance YoY", "% IA du Capex", "Focus"],
      [
        ["Amazon (AMZN)", "100 Mds$+", "+67%", "~60%", "AWS Trainium3, Bedrock, Projet Rainier (Anthropic)"],
        ["Microsoft (MSFT)", "80 Mds$", "+54%", "~70%", "Azure AI, clusters OpenAI (Stargate), Maia 2"],
        ["Alphabet (GOOG)", "75 Mds$", "+43%", "~65%", "TPU v6 Trillium, Gemini, DeepMind"],
        ["Meta (META)", "60-65 Mds$", "+72%", "~80%", "Clusters Llama, MTIA v2"],
        ["Oracle (ORCL)", "16 Mds$", "+100%+", "~85%", "OCI Gen2, partenariats IA souveraine"],
        ["TOTAL Big 5", "~336 Mds$", "+58% moy.", "~68%", "—"]
      ]),

    concept("La chaine d'approvisionnement GPU : du sable a la superintelligence", "La pile de compute IA a 5 couches critiques : 1) Fabrication de wafers (TSMC, Samsung — 3nm/5nm), 2) Packaging avance (CoWoS — LE GOULOT D'ETRANGLEMENT), 3) Design de puces (NVDA, AMD, AVGO), 4) Systemes (SMCI, Dell, HPE — serveurs DGX/HGX), 5) Data Centers (EQIX, DLR, VRT — alimentation, refroidissement, terrain). Chaque couche presente des opportunites d'investissement differentes."),

    warning("Le goulot CoWoS", "Contrairement a la croyance populaire, la contrainte principale n'est PAS la capacite de fabrication de wafers — TSMC a largement assez de capacite 5nm. Le vrai point de blocage est le packaging avance CoWoS de TSMC. Chaque GPU Blackwell B200 necessite 2x la surface CoWoS d'un H100. L'utilisation est a 100%. Delai de livraison : 52+ semaines. C'est ce goulot qui limite le chiffre d'affaires de Nvidia."),

    concept("Pourquoi la HBM est la revolution de la memoire", "La High Bandwidth Memory n'est pas juste de la DRAM plus rapide. C'est une architecture fondamentalement differente : des puces memoire empilees verticalement et collees directement sur le package GPU via CoWoS. Un stack HBM3e fournit 1,2 TB/s de bande passante — environ 10x celle de la DDR5. Sans HBM, l'IA moderne n'existerait pas. SK Hynix controle ~50% de l'offre, suivie de Samsung (~40%) et Micron (~10%). La HBM commande un prix 5-6x superieur a la DRAM standard."),

    bullets("La dominance NVIDIA en chiffres", [
      "130 Mds$ de revenu estimé FY25 — 73% de marge brute",
      "92% de part de marche des accelerateurs IA data center",
      "Cadence annuelle de produits : H100 (2023) -> B200 (2025) -> R100 (2026) -> R200 (2027)",
      "Le fosse CUDA : 4+ millions de developpeurs, 300+ bibliotheques optimisees GPU, chaque framework ML optimise pour CUDA en priorite",
      "CUDA n'est pas une fonctionnalite — c'est un verrou ecosystemique equivalent a Windows dans les annees 1990"
    ]),

    comparison("Nvidia vs les challengers",
      { label: "NVIDIA B200 (leader)", items: ["Meilleure performance entrainement", "CUDA : ecosysteme dominant", "Disponible sur tous les clouds + on-prem", "~85% de part de marche", "Prix premium : 30-40K$ par GPU"] },
      { label: "AMD MI325X (challenger)", items: ["~85% de la perf du B200", "ROCm : 2-3 ans derriere CUDA", "Azure, OCI, on-prem", "~8% de part de marche", "15-20% moins cher"] }
    ),

    concept("Entrainement vs Inference : le basculement economique", "L'entrainement construit le cerveau — cout unique de 100-500M$ pour les modeles de pointe. L'inference utilise le cerveau entraine — chaque requete ChatGPT, chaque suggestion Copilot. Avec le deploiement a grande echelle, l'inference depassera l'entrainement de 10 a 100x d'ici 2027. L'inference est plus sensible aux couts, plus adaptee aux ASICs personnalises. C'est l'ouverture que AMD, Broadcom et AWS Trainium ciblent."),

    quiz("Pourquoi CUDA de Nvidia est-il considere comme un fosse competitif quasi-infranchissable ?",
      ["Parce que les GPUs Nvidia sont 10x plus rapides que les concurrents", "A cause de l'ecosysteme : 4M+ developpeurs, 300+ bibliotheques, tous les frameworks ML optimises pour CUDA", "Parce que Nvidia detient des brevets bloquant toute concurrence", "Parce que CUDA est open source et gratuit"],
      1, "La force de CUDA n'est pas la performance brute du hardware, mais l'ecosysteme massif construit sur 18 ans. Réécrire et reoptimiser des bases de code pour ROCm d'AMD couterait plus cher que les economies hardware."),

    summary("Chapitre 2 — Points cles", [
      "336 Mds$ de capex hyperscaler en 2025, trajectoire vers 600 Mds$+ d'ici 2027",
      "Le goulot d'etranglement est le packaging CoWoS, pas la fabrication de wafers",
      "NVIDIA detient 92% du marche GPU IA grace au fosse ecosystemique CUDA",
      "AMD est le challenger credible avec le MI300X/MI325X, mais ROCm reste 2-3 ans derriere",
      "L'inference va dominer la demande compute d'ici 2027 — ouverture pour les ASICs"
    ]),

    // ============================================================
    // PARTIE 3 : LES AGENTS AUTONOMES
    // ============================================================
    chapterIntro(3, "Les Agents Autonomes", "Le logiciel qui mange le logiciel. L'ere du Chat se termine. L'ere du Faire commence."),

    steps("Les 4 eres de l'IA : des chatbots aux agents", [
      { step: "Ere 1 — Bots regles (2015-2022)", detail: "Arbres de decision, flux scriptes. Les menus telephoniques frustrants. Creation de valeur : ~5 Mds$" },
      { step: "Ere 2 — Chat LLM (2023)", detail: "ChatGPT. Comprehension du langage naturel au niveau humain mais fondamentalement reactif. Creation : ~100 Mds$" },
      { step: "Ere 3 — Copilotes (2024)", detail: "GitHub Copilot, Microsoft 365 Copilot. Humain dans la boucle. Gains de productivite 20-40%. Creation : ~500 Mds$" },
      { step: "Ere 4 — Agents Autonomes (2025+)", detail: "Systemes qui observent, planifient, agissent et s'auto-corrigent SANS intervention humaine. Gains : 10-100x. Creation : 2-5 000 Mds$" }
    ]),

    concept("La boucle agentique", "La distinction critique entre un chatbot et un agent est la boucle agentique — un cycle persistant de perception, raisonnement et action. Pensez-y comme un employe senior : un chatbot est comme demander une question a un collegue au dejeuner. Un copilote est un analyste junior qui prepare un document que vous relisez. Un agent autonome est un manager senior : vous lui donnez un objectif et il collecte les donnees, cree les graphiques, redige les analyses, coordonne les approbations, et livre le produit final — vous sollicitant uniquement pour les decisions de jugement."),

    table("Cout Agent vs Humain par categorie de tache", ["Categorie", "Cout humain/h", "Cout agent/h", "Reduction", "Gain vitesse"],
      [
        ["Support client L1", "25$", "0,50$", "-98%", "10x"],
        ["Revue de code & QA", "75$", "2,00$", "-97%", "20x"],
        ["Analyse de donnees", "100$", "5,00$", "-95%", "50x"],
        ["Revue doc. juridique", "300$", "10,00$", "-97%", "100x"],
        ["Developpement logiciel", "120$", "4,00$", "-97%", "10-50x"],
        ["Modelisation financiere", "150$", "8,00$", "-95%", "30x"],
        ["Redaction contenu", "60$", "1,00$", "-98%", "40x"]
      ]),

    concept("Le paradoxe de Jevons pour les agents IA", "Le paradoxe de Jevons dit que quand une technologie rend une ressource moins chere, la consommation totale de cette ressource AUGMENTE plutot que diminue. Quand les moteurs a charbon sont devenus plus efficaces, la consommation de charbon a explose. Meme logique pour les agents IA : quand le cout du travail cognitif s'effondre, la demande de travail cognitif va exploser. Les entreprises ne vont pas simplement licencier leur equipe support — elles vont fournir un support personalise 24/7 a chaque client, dans chaque langue. L'effet net est plus probablement une expansion du PIB qu'un chomage de masse."),

    bullets("Les gagnants de l'economie des agents", [
      "MSFT — 400M utilisateurs Office = plus grande distribution d'agents. Copilot + Azure AI double fosse",
      "CRM (Salesforce) — Agentforce : l'agent enterprise le plus complet. Modele par conversation, pas par siege",
      "PLTR (Palantir) — AIP Ontology pour orchestration d'agents sur donnees complexes. Govt + commercial",
      "NOW (ServiceNow) — Now Assist : agents ITSM qui reduisent le temps de resolution de 50%+",
      "SNOW (Snowflake) — Cortex AI : la couche memoire des agents. Les agents ont besoin d'acces structure aux donnees",
      "DDOG (Datadog) — Observabilite LLM. Les agents en production ont besoin de monitoring et tracing"
    ]),

    warning("Les perdants : Services IT et BPO face a la menace existentielle", "L'industrie mondiale des services IT et BPO de 600 Mds$+ — construite sur l'arbitrage du travail — fait face a la disruption la plus severe depuis que la robotique a disrupted la fabrication. Les agents IA offrent un ratio de cout 50:1 a 200:1 vs meme la main-d'oeuvre offshore la moins chere. L'industrie IT indienne emploie 5 millions de personnes et genere 250 Mds$ de revenus annuels. INFY, WIT, CTSH sont les plus vulnerables. Les agences de staffing (RHI, MAN) font face a l'extinction pure et simple."),

    quiz("Combien coute une heure de support client L1 effectue par un agent IA, compare au cout humain ?",
      ["15$ vs 25$ (reduction de 40%)", "5$ vs 25$ (reduction de 80%)", "0,50$ vs 25$ (reduction de 98%)", "Le cout est identique mais l'agent est plus rapide"],
      2, "Un agent IA coute environ 0,50$ par heure pour le support client L1, contre 25$ pour un humain — une reduction de 98%. Et l'agent obtient un score de satisfaction client (CSAT) de 85% contre 82% pour l'humain."),

    summary("Chapitre 3 — Points cles", [
      "L'IA passe de repondre aux questions (chatbot) a executer des workflows complets (agent autonome)",
      "Reduction de cout de 95-98% pour la plupart des taches de travail intellectuel routinier",
      "Les plateformes (MSFT, CRM, PLTR, NOW) sont les gagnants a plus haute conviction",
      "Les services IT indiens (250 Mds$ de revenus) font face a une menace existentielle",
      "Le paradoxe de Jevons suggere une expansion nette du PIB plutot qu'un chomage de masse"
    ]),

    // ============================================================
    // PARTIE 4 : LA REVOLUTION SANTE
    // ============================================================
    chapterIntro(4, "La Revolution Sante", "La biologie n'est plus une science de pipettes et boites de Petri. Elle devient un probleme d'ingenierie calculable."),

    concept("La these TechBio", "L'industrie pharmaceutique est le secteur le plus inefficace en capital de l'economie moderne. Depuis 1950, le nombre de medicaments approuves par milliard de dollars de R&D a diminue de moitie environ tous les 9 ans — la loi d'Eroom (Moore a l'envers). Cout moyen par medicament approuve : 2,6 milliards de dollars. Timeline : 10-15 ans. Taux d'echec : ~90%. Mais l'IA inverse cette tendance : cout projete en approche IA-first : ~300M$, timeline : 3-5 ans, taux d'echec projete : ~60%."),

    concept("La biologie est le prochain probleme logiciel", "Le genome humain a 3,2 milliards de paires de bases — environ 800 megaoctets, moins qu'un fichier video. L'ADN est du code. Les proteines sont des executables compiles. Les maladies sont des bugs. La conception de medicaments est du debogage. Pendant 50 ans, les biologistes ont attaque ces problemes experimentalement. L'IA inverse le modele : simuler des milliards d'interactions moleculaires in silico, puis tester uniquement les candidats les plus prometteurs in vivo. Au lieu de tester 10 000 composes en esperant qu'un marche, vous cribblez 10 milliards par ordinateur et avancez les 50 meilleurs."),

    bullets("AlphaFold : la Pierre de Rosette de la biologie", [
      "En decembre 2020, AlphaFold2 de DeepMind a resolu le probleme du repliement des proteines — un grand defi de 50 ans",
      "Plus de 200 millions de structures proteiques predites — l'univers proteique connu entier",
      "Avant AlphaFold : determiner une structure prenait des mois et coutait 100-500K$. Maintenant : quelques secondes, cout quasi nul",
      "AlphaFold3 (2024) : modelise les interactions proteine-ADN, proteine-ARN et proteine-ligand",
      "1,8 million de chercheurs dans 190 pays ont utilise la base AlphaFold. Plus de 20 000 articles scientifiques l'ont citee"
    ]),

    bullets("Les pionniers de la decouverte de medicaments par IA", [
      "Insilico Medicine — Premier medicament concu par IA en Phase II (ISM001-055 pour la fibrose pulmonaire). 30 mois de la decouverte au clinique vs 4-6 ans habituels",
      "Recursion (RXRX) — Plus grand dataset biologique au monde : 50+ petaoctets. 2,8 millions d'experiences par semaine, entierement automatisees",
      "Schrodinger (SDGR) — Plateforme de chimie computationnelle. Partenariats avec Lilly, BMS, Pfizer",
      "Plus de 100 medicaments decouverts par IA sont maintenant en essais cliniques — contre moins de 30 en 2023"
    ]),

    table("Pharma traditionnelle vs TechBio IA-first", ["Metrique", "Pharma traditionnelle", "TechBio IA-first", "Amelioration"],
      [
        ["Phase de decouverte", "4-6 ans", "6-18 mois", "3-4x plus rapide"],
        ["Pre-clinique", "1-3 ans", "6-12 mois", "2x plus rapide"],
        ["Essais cliniques", "6-8 ans", "3-5 ans", "1,5-2x plus rapide"],
        ["Cout total", "2,0-2,6 Mds$", "200-400M$", "5-10x moins cher"],
        ["Taux succes Phase II", "~28%", "~40-50%", "+12-22 points"],
        ["Composes cribbles", "5K-10K (labo)", "1 Mds+ (in silico)", "100 000x plus"]
      ]),

    tip("Tickers sante IA a surveiller", "LLY (Eli Lilly) — leader pharma integrant l'IA. ISRG (Intuitive Surgical) — robots chirurgicaux Da Vinci, IA ameliorant les procedures. RXRX (Recursion) — pure play biologie computationnelle. SDGR (Schrodinger) — chimie computationnelle. VEEV (Veeva) — cloud pour pharma. ETFs : XBI (biotech), ARKG (genomique). La robotique chirurgicale est un marche en expansion avec le da Vinci 5 et ses 9 000+ systemes installes."),

    quiz("Combien de temps a pris Insilico Medicine pour amener son medicament ISM001-055 de la decouverte au Phase II ?",
      ["6 ans, comme la moyenne traditionnelle", "4 ans grace a quelques optimisations", "Moins de 30 mois — un record historique", "18 mois, car c'etait un medicament simple"],
      2, "ISM001-055 est le premier medicament entierement concu par IA a atteindre les essais de Phase II. L'ensemble du parcours a pris moins de 30 mois — alors que la phase de decouverte seule prend traditionnellement 4 a 6 ans. C'est le premier medicament 'double IA' de l'histoire : l'IA a a la fois identifie la cible et concu la molecule."),

    summary("Chapitre 4 — Points cles", [
      "La loi d'Eroom (la R&D pharma devient plus chere) est en train d'etre inversee par l'IA",
      "AlphaFold a resolu le probleme du repliement des proteines — un defi de 50 ans",
      "100+ medicaments decouverts par IA sont en essais cliniques en 2026",
      "L'approche IA-first reduit les couts de 5-10x et les delais de 3-4x",
      "NVIDIA qualifie la biologie de prochain marche logiciel a 1 000 milliards de dollars"
    ]),

    // ============================================================
    // PARTIE 5 : LA DISRUPTION CREATIVE
    // ============================================================
    chapterIntro(5, "La Disruption Creative", "Le cout marginal de creer du contenu de qualite professionnelle s'effondre vers zero. La propriete intellectuelle devient roi."),

    table("Effondrement des couts de production de contenu", ["Type contenu", "Cout traditionnel", "Cout IA (2026)", "Reduction", "Outils cles"],
      [
        ["Image (1 photo)", "500-2 000$", "0,02-0,08$", "-99,9%", "DALL-E 3, Midjourney v7, Flux Pro"],
        ["Video (par seconde)", "5 000-15 000$", "0,05-0,20$", "-99,99%", "Sora, Runway Gen-3, Kling"],
        ["Musique (1 piste)", "5 000-20 000$", "0,10-1,00$", "-99,99%", "Suno v4, Udio, Stable Audio 2"],
        ["Texte (1 000 mots)", "100-500$", "0,005-0,02$", "-99,99%", "Claude, GPT-4o, Gemini"],
        ["Voix-off (par minute)", "50-300$", "0,01-0,05$", "-99,98%", "ElevenLabs, Play.ht, OpenAI TTS"],
        ["Asset 3D / Jeu", "500-5 000$", "0,50-5,00$", "-99,9%", "Meshy, Luma Genie, Nvidia Edify 3D"]
      ]),

    concept("L'effet barbell dans les marches creatifs", "Quand le cout de produire du contenu 'suffisamment bon' tombe a zero, le marche ne s'effondre pas uniformement. Il bifurque en haltere : la valeur se concentre aux deux extremes. Le haut de gamme premium (concerts Taylor Swift, films Nolan, GTA VI) — la rarete et l'authenticite commandent des primes plus elevees que jamais. Le bas de gamme commodite (contenu IA infini, quasi-gratuit). Et au milieu ? Le milieu mort — freelances, photographes stock, agences mid-tier, traducteurs. Leur production est desormais indistinguable de l'IA, mais 1 000x plus chere."),

    bullets("Plus d'un milliard d'images IA generees en 2024", [
      "1 Mds+ images IA generees en 2024 seul",
      "Reduction de cout de 99,9% pour la generation d'images",
      "30 secondes du prompt a la production finale",
      "Un operateur avec des outils IA produit en un apres-midi ce qui necesitait une equipe de 20-50 specialistes pendant des semaines",
      "Guerre du copyright a 100 Mds$ : NYT vs OpenAI, Getty vs Stability AI, artistes vs plateformes"
    ]),

    comparison("Gagnants vs Perdants du contenu IA",
      { label: "Gagnants", items: ["Disney, Netflix — proprietaires d'IP premium", "RBLX (Roblox) — UGC gaming + outils IA", "SPOT (Spotify) — plateforme de distribution", "Adobe — outils IA pour createurs (Firefly)", "Entreprises avec des marques fortes"] },
      { label: "Perdants", items: ["GETY (Getty Images) — -60% depuis le pic", "Shutterstock — marginalise par l'IA", "Agences de pub mid-tier", "Freelances generalistes (design, copy)", "Maisons de traduction"] }
    ),

    quiz("Quel est le phenomene economique qui fait que quand la creation de contenu devient quasi-gratuite, la valeur se concentre aux extremes ?",
      ["Le paradoxe de Jevons", "L'effet barbell (haltere)", "La loi d'Eroom", "Le dilemme de l'innovateur"],
      1, "L'effet barbell decrit la bifurcation du marche quand la production de contenu 'suffisamment bon' tombe a zero. La valeur se concentre a deux extremes : le premium (IP authentique) et la commodite (volume IA infini). Le milieu est ecrase."),

    summary("Chapitre 5 — Points cles", [
      "Reduction de cout de 95-99,9% sur tous les types de contenu en moins de 36 mois",
      "L'effet barbell : le premium et la commodite gagnent, le milieu meurt",
      "La propriete intellectuelle est l'actif le plus precieux de l'ere IA",
      "Guerre du copyright a 100 Mds$ en cours — resultat incertain",
      "Les plateformes de distribution (Spotify, Netflix, Roblox) gagnent face aux createurs mid-tier"
    ]),

    // ============================================================
    // PARTIE 6 : LA CONDUITE AUTONOME
    // ============================================================
    chapterIntro(6, "La Conduite Autonome", "Robotaxis et l'effondrement des couts de transport. L'industrie automobile de 3 000 milliards est au bord de sa plus violente disruption depuis Henry Ford."),

    concept("La revolution du cout au kilometre", "Un Americain moyen depense 12 182$ par an pour sa voiture — soit environ 1,10$/km. Un Uber coute environ 4$/km, dont 65-75% va au chauffeur humain. Un robotaxi en 2026 opere a environ 0,80$/km. D'ici 2030, avec les economies d'echelle : ~0,40$/km. A ce prix, posseder une voiture devient irrationnel pour la plupart des consommateurs urbains et periurbains."),

    concept("Le paradoxe de l'utilisation", "La voiture privee moyenne reste garee 95% du temps. C'est l'un des actifs les plus sous-utilises qu'un menage possede. Un robotaxi peut rouler 60 000-80 000 km par an, repartissant son cout en capital sur 15-20x plus de kilometres. Cet avantage d'utilisation est la raison fondamentale pour laquelle les robotaxis seront moins chers que la possession — ce n'est pas principalement la suppression du chauffeur, mais l'utilisation de l'actif 18 heures par jour au lieu d'1 heure."),

    comparison("Waymo vs Tesla FSD",
      { label: "Waymo (Alphabet)", items: ["150 000+ courses payantes par semaine", "LiDAR + radar + cartes HD, domaine geofence", "~1 500 vehicules dans 6 villes US", "85% moins de crashes avec blessures que les humains", "Rating 4,8/5,0", "Approche : securite d'abord, mise a l'echelle progressive"] },
      { label: "Tesla FSD v13", items: ["100% cameras + reseaux de neurones, pas de LiDAR", "1,8 milliard de km de donnees de conduite reelle", "Intervention : ~1 pour 2 400 km (proche du L4 supervise)", "Approche : vision pure, mise a l'echelle globale sans pre-mapping", "Cybercab (robotaxi dedie) annonce pour fin 2026, prix cible 30 000$", "Avantage : donnees massives de la flotte + fabrication a echelle"] }
    ),

    bullets("L'ecosysteme de la conduite autonome", [
      "Waymo (GOOG) — seul service de robotaxi entierement autonome a echelle commerciale",
      "Tesla (TSLA) — pari vision pure, plus grande base de donnees AV au monde",
      "Mobileye (MBLY) — systemes ADAS pour constructeurs traditionnels, 50M+ vehicules equipes",
      "Le transport routier autonome : Aurora, TuSimple (Chine), Plus.ai — marche camionnage US de 900 Mds$/an",
      "Assurance : les donnees de securite AV reduisent les primes — Swiss Re confirme 85% moins de blessures"
    ]),

    quiz("Quel pourcentage du temps une voiture privee moyenne est-elle garee ?",
      ["50% du temps", "75% du temps", "85% du temps", "95% du temps"],
      3, "La voiture privee moyenne est garee 95% du temps ! C'est l'un des actifs les plus sous-utilises qu'un menage possede. Un robotaxi, en roulant 18h/jour, repartit son cout sur 15-20x plus de kilometres, ce qui est la raison fondamentale de son avantage economique."),

    summary("Chapitre 6 — Points cles", [
      "Le robotaxi coute ~0,80$/km en 2026 vs 4$/km pour un Uber et 1,10$/km pour une voiture privee",
      "Waymo realise 150 000+ courses autonomes par semaine dans 6 villes US",
      "Tesla FSD v13 approche la securite de niveau humain avec la vision pure",
      "D'ici 2030 a 0,40$/km, posseder une voiture deviendra irrationnel en zone urbaine",
      "Le transport routier autonome represente un marche de 900 Mds$/an aux US"
    ]),

    // ============================================================
    // PARTIE 7 : LA TRANSFORMATION DE L'EDUCATION
    // ============================================================
    chapterIntro(7, "La Transformation de l'Education", "Les tuteurs IA et la fin de l'ecole-usine. L'industrie de 6 500 milliards de dollars ne sera plus jamais la meme."),

    concept("Le probleme 2-Sigma de Bloom", "En 1984, le psychologue Benjamin Bloom a publie l'une des decouvertes les plus importantes de l'histoire de l'education. Les etudiants recevant un tutorat individuel performent 2 ecarts-types au-dessus de la moyenne en classe — surpassant 98% des etudiants en salle de classe conventionnelle. Il a appele ca le 'Probleme 2-Sigma' : comment offrir le tutorat 1-a-1 a chaque etudiant quand il n'y a pas assez de tuteurs pour 1,5 milliard d'etudiants ? Pendant 40 ans, personne n'a pu le resoudre. L'economie etait impossible : un tuteur humain coute 30-80$ de l'heure. L'IA change cette equation."),

    table("Methodes d'enseignement comparees", ["Methode", "Taille d'effet", "Percentile", "Scalabilite", "Cout/etudiant/h"],
      [
        ["Classe traditionnelle (30:1)", "0,0 (base)", "50e", "Elevee", "2-5$"],
        ["Apprentissage de maitrise", "+1,0 sigma", "84e", "Moyenne", "5-10$"],
        ["Tuteur humain 1-a-1", "+2,0 sigma", "98e", "Non scalable", "30-80$"],
        ["Tuteur IA (classe GPT-4, 2025)", "+1,5-1,8 sigma", "93-96e", "Illimitee", "0,02-0,10$"],
        ["Cours en ligne (MOOC)", "+0,3 sigma", "62e", "Elevee", "0,50-3$"]
      ]),

    bullets("Duolingo : le grand gagnant de l'education IA", [
      "113M+ utilisateurs actifs mensuels — en hausse de 50% en 18 mois depuis le pivot IA",
      "Duolingo Max avec GPT-4 : Expliquer ma reponse, Jeu de role IA, Appel video",
      "Action : +200% depuis l'annonce de l'integration IA en Q1 2023",
      "Ratio DAU/MAU de 28% — parmi les plus eleves des apps grand public",
      "Expansion au-dela des langues : cours de maths, musique en beta",
      "La repetition espacee IA suit 300+ parametres par utilisateur — impossible pour un enseignant humain avec 30 eleves"
    ]),

    warning("La destruction de Chegg : etude de cas", "Chegg (CHGG) vendait des solutions de devoirs a 15,95$/mois. Quand ChatGPT a ete lance en novembre 2022, il a offert le meme service — gratuitement, instantanement, souvent avec de meilleures explications. Resultats : action -80% depuis le pic, abonnes en chute libre, licenciements massifs. C'est le canari dans la mine de l'education. Tout business model qui consiste a vendre des reponses a des questions est existentiellement menace."),

    quiz("Selon l'etude de Bloom, quel avantage un tutorat individuel donne-t-il par rapport a une classe traditionnelle ?",
      ["L'etudiant passe du 50e au 70e percentile (amelioration moderee)", "L'etudiant surpasse 84% de la classe (1 ecart-type)", "L'etudiant surpasse 98% de la classe (2 ecarts-types)", "L'etudiant double ses notes en moyenne"],
      2, "Le resultat emblematique de Bloom montre que le tutorat 1-a-1 produit un avantage de 2 ecarts-types, placant l'etudiant moyen tutore au 98e percentile. Les tuteurs IA GPT-4 atteignent deja 1,5-1,8 sigma — 90% de l'effet — pour 0,05$/heure au lieu de 50$/heure."),

    summary("Chapitre 7 — Points cles", [
      "Le probleme 2-Sigma de Bloom est resolu par les tuteurs IA a 0,1% du cout",
      "Duolingo (DUOL) : 113M MAU, +200% en bourse depuis le pivot IA",
      "Chegg (CHGG) : -80% — destruction par ChatGPT du modele 'vente de reponses'",
      "Les tuteurs IA GPT-4 atteignent 1,5-1,8 sigma d'effet pour 0,02-0,10$/heure",
      "Le marche mondial de l'education : 6 500 Mds$ — meme 1% capture = 65 Mds$ de revenus"
    ]),

    // ============================================================
    // PARTIE 8 : CYBERSECURITE A L'ERE DE L'IA
    // ============================================================
    chapterIntro(8, "Cybersecurite a l'Ere de l'IA", "La surface d'attaque explose exponentiellement. La securite est devenue un probleme de donnees."),

    bullets("L'explosion de la surface d'attaque IA", [
      "Cybercriminalite : 8 000 Mds$ en 2023, projection 15 300 Mds$ d'ici 2027 — 3e 'economie' mondiale",
      "Deepfakes & ingenierie sociale : fraude au PDG avec clones vocaux IA, cout moyen 4,7M$ par incident. Un employe a Hong Kong a transfere 25M$ apres un appel video avec des collegues deepfakes",
      "Phishing IA a echelle : emails parfaits, personalises depuis LinkedIn. Taux de clic 3x plus eleve. Volume +1 265% depuis le lancement de ChatGPT",
      "Malware polymorphe : se reecrit a chaque execution, evite toute detection par signatures. 75% des intrusions en 2025 sont sans malware (outils legitimes detournes)",
      "Le probleme d'asymetrie : le cout de l'attaquant tend vers zero, le cout du defenseur augmente"
    ]),

    concept("Pourquoi la defense IA n'est pas optionnelle — elle est existentielle", "Un attaquant peut utiliser un LLM open-source pour generer 10 000 emails de phishing uniques en minutes, a cout marginal quasi nul. Il peut scanner des millions d'adresses IP en heures. Il peut creer un deepfake audio du PDG a partir de 30 secondes d'appel de resultats. Pendant ce temps, un analyste SOC humain coute 120 000$/an et peut investiguer environ 20 alertes par quart de travail. Le volume d'attaques croit exponentiellement tandis que la capacite humaine croit lineairement. Seule l'IA peut combler ce fosse."),

    table("Cout par type d'incident cyber", ["Type d'incident", "Cout moyen", "Temps de detection", "Amplification IA"],
      [
        ["Ransomware", "5,1M$", "23 jours", "IA cible les donnees de plus haute valeur"],
        ["Fraude email d'entreprise", "4,9M$", "N/A (fraude bancaire)", "Deepfake voix/video du PDG"],
        ["Exfiltration de donnees", "4,5M$", "277 jours", "IA trouve les donnees sensibles plus vite"],
        ["Attaque chaine d'approvisionnement", "4,6M$", "294 jours", "IA cartographie les graphes de dependance"],
        ["Mauvaise config cloud", "3,9M$", "12 heures", "Bots scannent en temps reel"]
      ]),

    concept("Le malware polymorphe explique", "L'antivirus traditionnel fonctionne en comparant les fichiers a une base de 'signatures' connues. Le malware polymorphe se reecrit a chaque execution — le comportement malveillant est le meme mais le code est completement different. L'IA generative va plus loin : elle utilise des LLMs pour reecrire non seulement la structure mais la logique elle-meme. L'antivirus par signatures detecte 0% de ces variantes. Seule l'IA comportementale — qui observe ce que fait un programme plutot que a quoi il ressemble — peut les detecter. C'est pourquoi CrowdStrike et SentinelOne ont remplace l'antivirus traditionnel dans chaque entreprise du Fortune 500."),

    bullets("Les leaders de la cybersecurite IA", [
      "CRWD (CrowdStrike) — Charlotte AI, plateforme Falcon, detection comportementale. Market cap ~90 Mds$",
      "PANW (Palo Alto Networks) — XSIAM (SOC autonome), consolidation 76 outils en 1 plateforme",
      "FTNT (Fortinet) — FortiAI, securite reseau, fort dans le mid-market",
      "S (SentinelOne) — Purple AI, detection endpoint IA-native. Plus petit mais croissance rapide",
      "ZS (Zscaler) — Zero Trust cloud-native. Chaque session est verifiee, jamais de confiance implicite",
      "Marche global cybersecurite : 266 Mds$ en 2025, croissance 12-15% par an"
    ]),

    quiz("De combien le volume de phishing a-t-il augmente depuis le lancement de ChatGPT ?",
      ["Il a double (+100%)", "Il a augmente de 500%", "Il a augmente de 1 265%", "Il est reste stable car les defenses ont evolue aussi"],
      2, "Selon SlashNext (2025), le volume de phishing a augmente de 1 265% depuis le lancement de ChatGPT. Les LLMs generent des emails grammaticalement parfaits et contextuellement personnalises, avec un taux de clic 3x plus eleve que les campagnes traditionnelles."),

    summary("Chapitre 8 — Points cles", [
      "La cybercriminalite passera de 8 000 Mds$ (2023) a 15 300 Mds$ (2027)",
      "L'IA arme les attaquants (deepfakes, phishing, malware polymorphe) mais est aussi la seule defense viable",
      "CrowdStrike, Palo Alto et SentinelOne menent la defense IA comportementale",
      "Le Zero Trust devient obligatoire — chaque session verifiee, jamais de confiance implicite",
      "Marche cybersecurite de 266 Mds$ en croissance de 12-15% par an — un des secteurs les plus defensifs"
    ]),

    // ============================================================
    // PARTIE 9 : ROBOTIQUE & IA PHYSIQUE
    // ============================================================
    chapterIntro(9, "Robotique et IA Physique", "L'ere de l'IA physique a commence. Les robots humanoides arrivent — et le marche adressable est de 30 a 50 000 milliards de dollars."),

    concept("Le paradoxe de Moravec", "En 1988, le roboticien Hans Moravec a observe quelque chose de contre-intuitif : il est relativement facile de faire jouer aux ordinateurs aux echecs, mais extremement difficile de leur donner les competences motrices d'un enfant d'un an. L'evolution a passe 540 millions d'annees a optimiser les competences sensorimotrices mais seulement quelques millions d'annees sur le raisonnement abstrait. Les modeles de fondation modernes et le transfert sim-to-real sont en train de resoudre ce paradoxe."),

    table("Comparaison des robots humanoides", ["Robot", "Entreprise", "Prix cible", "Timeline", "Avantage cle"],
      [
        ["Optimus Gen 3", "Tesla (TSLA)", "25-30K$ (2027E)", "Interne 2025, vente 2027E", "Echelle de fabrication, reseaux FSD, integration verticale"],
        ["Figure 02", "Figure AI", "~50K$", "Deploiement pilote 2025", "Partenariat OpenAI, interaction vocale, manipulation dextre"],
        ["Neo", "1X Technologies", "~40K$", "Pilote 2025", "Plus leger (30kg), actionneurs souples, design domestique"],
        ["Digit", "Agility Robotics", "~75-100K$", "En livraison", "Premier deploye commercialement, partenariat Amazon"],
        ["Atlas (Electrique)", "Boston Dynamics (Hyundai)", "N/A", "Pilote 2025", "Meilleure mobilite, decennies de R&D, fabrication Hyundai"],
        ["Unitree H1", "Unitree Robotics", "16K$", "En livraison", "Avantage cout chinois, iteration rapide, plateforme ouverte"]
      ]),

    concept("Le calcul du remplacement de main-d'oeuvre", "Un magasinier aux US coute environ 45-55K$/an en compensation totale. Il travaille 2 000 heures/an avec pauses, absences et turnover. Un robot humanoide a 30 000$ avec une duree de vie de 5 ans travaille 20+ heures/jour, 365 jours/an, sans assurance sante, sans vacances, sans accidents du travail. Cout annuel d'exploitation : environ 10-15K$. Le retour sur investissement est inferieur a 12 mois. A ce prix, chaque CFO rationnel du monde va deployer des robots pour le travail physique repetitif."),

    bullets("L'ecosysteme de la robotique industrielle", [
      "Marche des robots industriels : 16,2 Mds$ en 2024, projection 35 Mds$ d'ici 2028 (CAGR 21%)",
      "FANUC : leader mondial (~18% part de marche), CNC et bras articules",
      "ABB Robotics : robots collaboratifs, electronique, controleur OmniCore + vision IA",
      "Universal Robots (Teradyne) : ~50% du marche des cobots",
      "Densite mondiale : 151 robots pour 10 000 travailleurs manufactiers — mais la Coree du Sud : 1 012 !",
      "Le transfert sim-to-real (simulation vers monde reel) est la percee technique qui permet l'IA physique"
    ]),

    quiz("Quel est le retour sur investissement estime pour un robot humanoide a 30 000$ remplacant un magasinier ?",
      ["3-5 ans", "2-3 ans", "Moins de 12 mois", "Le robot n'est jamais rentable car il tombe en panne"],
      2, "Un magasinier coute 45-55K$/an mais travaille 2 000 heures. Un robot a 30K$ (amorti sur 5 ans = 6K$/an) plus 10-15K$ de cout operationnel travaille 7 300+ heures/an. Le retour sur investissement est inferieur a 12 mois, ce qui en fait une decision evidente pour tout directeur financier."),

    summary("Chapitre 9 — Points cles", [
      "6+ entreprises serieuses construisent des robots humanoides pour la production de masse",
      "Tesla Optimus vise 25-30K$ d'ici 2027 — retour sur investissement en moins de 12 mois",
      "Le marche adressable des humanoides est de 30-50 000 Mds$ (marche mondial du travail)",
      "Le transfert sim-to-real est la percee technique cle de l'IA physique",
      "Le marche des robots industriels atteindra 35 Mds$ d'ici 2028 (CAGR 21%)"
    ]),

    // ============================================================
    // PARTIE 10 : LA DISRUPTION DE LA FINANCE
    // ============================================================
    chapterIntro(10, "La Disruption de la Finance", "La democratisation de l'alpha. L'IA transforme chaque segment de la finance — du trading au conseil en passant par la DeFi."),

    bullets("La fin du monopole de l'alpha", [
      "L'IA democratise des capacites autrefois reservees aux hedge funds a plusieurs milliards",
      "Le trading algorithmique represente deja 60-70% du volume sur les bourses americaines",
      "Bloomberg GPT et les agents integres au terminal automatisent l'analyse financiere",
      "Morgan Stanley a deploye 'AI @ Morgan Stanley' pour 15 000+ conseillers financiers",
      "Les robo-advisors IA de nouvelle generation gèrent les portefeuilles avec des frais de 0,25% vs 1-2% pour un conseiller humain"
    ]),

    table("L'IA dans la banque : cas d'usage", ["Fonction", "Avant IA", "Avec IA", "Impact"],
      [
        ["Detection de fraude", "Regles statiques, 60% taux de detection", "ML temps reel, 95%+ detection", "Reduction de pertes de 40-60%"],
        ["Scoring de credit", "FICO + donnees limitees", "1000+ variables alternatives", "30% plus de prets approuves, meme taux de defaut"],
        ["Trading", "Modeles quantitatifs lineaires", "Deep learning sur donnees alternatives", "Alpha supplementaire de 2-5% par an"],
        ["Conformite (KYC/AML)", "Revue manuelle, 30 min/client", "IA automatisee, 2 min/client", "Reduction des couts de 70%"],
        ["Service client", "Centres d'appels, 10 min de temps moyen", "Chatbots IA, 30 sec de resolution", "Satisfaction client +15%"]
      ]),

    concept("DeFi + IA : la pile financiere autonome", "La convergence de la finance decentralisee et de l'intelligence artificielle cree des systemes financiers qui fonctionnent de maniere autonome 24/7. Des protocoles IA gerent automatiquement la liquidite, optimisent le yield farming, et executent des strategies de trading complexes sans intervention humaine. C'est l'avenir de la finance : des agents IA qui gerent de l'argent pour d'autres agents IA."),

    quiz("Quel pourcentage du volume de trading sur les bourses americaines est deja algorithmique ?",
      ["20-30%", "40-50%", "60-70%", "85-90%"],
      2, "Le trading algorithmique represente deja 60-70% du volume sur les bourses americaines. L'IA de nouvelle generation va plus loin en integrant des donnees alternatives (images satellite, sentiment social, trafic web) pour generer de l'alpha supplementaire."),

    summary("Chapitre 10 — Points cles", [
      "L'IA democratise les capacites de trading et d'analyse autrefois reservees a l'elite",
      "300+ cas d'usage de l'IA dans la banque — de la detection de fraude au scoring de credit",
      "Les robo-advisors IA nouvelle generation offrent des performances superieures a 0,25% de frais",
      "La convergence DeFi + IA cree la pile financiere autonome du futur",
      "Les perdants : courtiers traditionnels, analystes generiques, back-office non automatise"
    ]),

    // ============================================================
    // PARTIE 11 : L'OPTIMISATION ENERGETIQUE
    // ============================================================
    chapterIntro(11, "L'Optimisation Energetique", "La crise energetique de l'IA et la renaissance nucleaire. La demande electrique des data centers va doubler la consommation de certains pays."),

    concept("La crise energetique de l'IA", "La demande electrique des data centers americains a atteint 35 GW en 2024, soit ~4% de la production electrique US. Projection : 80-100 GW d'ici 2030, soit 9-12%. Ces 65 GW supplementaires equivalent a ajouter TOUTE la consommation electrique de la France au reseau US en 6 ans. Un rack NVIDIA Blackwell GB200 NVL72 consomme 120 kW — 12 a 24 fois plus qu'un rack cloud traditionnel. Un seul entrainement de modele frontiere : 10+ GWh, l'equivalent de l'alimentation de 1 000 foyers americains pendant un an."),

    comparison("Pourquoi le nucleaire domine l'equation",
      { label: "Solaire & Eolien", items: ["Bon marche mais intermittent", "Facteur de capacite 25-35%", "Necessite du stockage massif", "Difficile a placer pres des data centers", "Conflit d'usage des sols"] },
      { label: "Nucleaire", items: ["Simultanement zero-carbone, baseload et scalable", "Facteur de capacite 90%+", "Constellation Energy (CEG) : +275% depuis 2023", "Microsoft : redemarrage de Three Mile Island (837 MW)", "Google : premier PPA d'entreprise pour des SMRs (500 MW)"] }
    ),

    table("Les mega-deals Nucleaire + IA", ["Deal", "Acheteur", "Fournisseur", "Capacite", "Statut"],
      [
        ["Redemarrage Three Mile Island", "Microsoft", "Constellation (CEG)", "837 MW", "En cours"],
        ["Campus DC Susquehanna", "Amazon (AWS)", "Talen Energy", "960 MW", "Actif"],
        ["PPA SMR Kairos", "Google", "Kairos Power", "500 MW", "Developpement"],
        ["Data centers SMR", "Oracle", "Plusieurs vendeurs SMR", "1 GW+", "Annonce"],
        ["Programme EPR2 France", "EDF / Etat francais", "Framatome", "24,7 GW (14 reacteurs)", "Planification"]
      ]),

    concept("Le reseau electrique : le vrai goulot d'etranglement", "Le reseau electrique americain est un patchwork vieux de 70 ans. Le transformateur de puissance moyen a plus de 40 ans — bien au-dela de sa duree de vie de 30 ans. Il faut 2 000+ milliards de dollars d'investissement d'ici 2035 et 75 000+ km de nouvelles lignes haute tension. Mais le delai moyen pour autoriser et construire une ligne de transmission est de 10-15 ans. Le goulot n'est pas technologique — c'est reglementaire. Eaton (ETN), qui fabrique les transformateurs et equipements de reseau, est l'un des mieux positionnes dans toute la chaine d'investissement IA."),

    quiz("Combien d'electricite consomme un rack NVIDIA Blackwell GB200 NVL72 par rapport a un rack cloud traditionnel ?",
      ["2 fois plus (double)", "5 fois plus", "12 a 24 fois plus (120 kW vs 5-10 kW)", "Environ la meme chose grace aux optimisations d'efficacite"],
      2, "Un rack cloud traditionnel consomme 5-10 kW. Un rack Blackwell GB200 NVL72, le standard pour l'entrainement de modeles de classe GPT-5, consomme 120 kW — soit 12 a 24 fois plus. C'est cette densite de puissance qui cree la crise energetique de l'IA."),

    summary("Chapitre 11 — Points cles", [
      "La demande electrique des data centers US passera de 35 GW (2024) a 80-100 GW (2030)",
      "Le nucleaire est la seule source simultanement zero-carbone, baseload et scalable",
      "Microsoft, Amazon, Google et Oracle signent des mega-deals nucleaires",
      "Le reseau electrique est le vrai goulot : infrastructure de 70 ans, 2 000+ Mds$ d'investissement necessaire",
      "Eaton (ETN) et Constellation (CEG) sont les meilleurs positionnements dans la chaine energetique IA"
    ]),

    // ============================================================
    // PARTIE 12 : LE CHOC DU MARCHE DU TRAVAIL
    // ============================================================
    chapterIntro(12, "Le Choc du Marche du Travail", "Le grand deplacement. L'IA cible les travailleurs du savoir — la couche la plus couteuse de la main-d'oeuvre."),

    concept("Le grand deplacement", "Contrairement aux vagues d'automatisation precedentes qui remplacaient le travail manuel, les agents IA ciblent le travail intellectuel — la couche la plus couteuse. McKinsey estime que 60-70% de toutes les activites professionnelles dans le monde sont augmentables par l'IA. Le FMI avertit que 40% des emplois mondiaux sont exposes a l'IA. La question n'est pas SI des emplois seront deplaces, mais COMBIEN, A QUELLE VITESSE, et LESQUELS."),

    steps("Qui est deplace en premier ?", [
      { step: "Immediat (2024-2025)", detail: "Support client L1, saisie de donnees, traduction basique, generation de code routinier, tests QA" },
      { step: "Court terme (2025-2027)", detail: "Analyse financiere junior, revue juridique, redaction marketing, comptabilite, diagnostic medical de routine" },
      { step: "Moyen terme (2027-2030)", detail: "Gestion de projet, design UX, enseignement, programmation complexe, recherche scientifique assistee" },
      { step: "Long terme (2030+)", detail: "Strategie d'entreprise, negociation complexe, leadership, creativite de pointe — les taches necessitant jugement humain" }
    ]),

    warning("L'industrie du staffing face a l'extinction", "Les agences d'interim comme Robert Half (RHI) et ManpowerGroup (MAN) facturent 20-35% de majoration sur les travailleurs du savoir temporaires. Quand le travail sous-jacent est remplace par des agents, le modele d'intermediation entier s'evapore. Il n'y a pas de 'pivot' pour une agence d'interim — toute leur proposition de valeur est l'acces au talent humain. Ce sont les expressions short les plus propres de la these agentique."),

    concept("Le paradoxe de la productivite", "Historiquement, chaque revolution technologique a cree plus d'emplois qu'elle n'en a detruits — mais avec un decalage douloureux de 10-20 ans. La revolution industrielle a cree les metiers de l'usine mais detruit les artisans. Internet a cree le community manager mais detruit le libraire. L'IA creera probablement de nouveaux metiers impossibles a imaginer aujourd'hui — 'ingenieur de prompts' n'existait pas il y a 3 ans — mais la transition sera douloureuse. Le debat sur le revenu universel de base (UBI) n'est plus academique."),

    quiz("Selon McKinsey, quel pourcentage des activites professionnelles mondiales sont augmentables par l'IA ?",
      ["20-30%", "40-50%", "60-70%", "80-90%"],
      2, "McKinsey estime que 60-70% de toutes les activites professionnelles dans le monde sont augmentables par l'IA. Cela ne signifie pas que 60-70% des emplois disparaissent — mais que la majorite des taches au sein de chaque emploi seront transformees. Les travailleurs qui apprennent a utiliser l'IA deviendront enormement plus productifs."),

    summary("Chapitre 12 — Points cles", [
      "60-70% des activites professionnelles mondiales sont augmentables par l'IA (McKinsey)",
      "L'IA cible les travailleurs du savoir — la couche la plus couteuse et la plus sensible",
      "Les agences de staffing (RHI, MAN) font face a un risque d'extinction",
      "Le paradoxe de productivite : a long terme, plus d'emplois crees que detruits — mais transition douloureuse",
      "Le debat UBI n'est plus academique — c'est une necessite politique a moyen terme"
    ]),

    // ============================================================
    // PARTIE 13 : LA GEOPOLITIQUE DE LA COURSE A L'IA
    // ============================================================
    chapterIntro(13, "La Geopolitique de la Course a l'IA", "La nouvelle course aux armements. Taiwan, la Guerre des Puces, et l'IA souveraine."),

    concept("La nouvelle course aux armements", "La competition IA entre les Etats-Unis et la Chine n'est pas simplement une course technologique — c'est une lutte pour la suprematie geopolitique du 21e siecle. Celui qui domine l'IA domine l'economie, la defense et l'influence mondiale. Les controles d'exportation americains ont lance une 'Guerre des Puces' qui remodele les chaines d'approvisionnement mondiales."),

    steps("La timeline de la Guerre des Puces", [
      { step: "Mai 2019 : Huawei sur la Entity List", detail: "Ventes de smartphones Huawei s'effondrent hors de Chine. QCOM -12%." },
      { step: "Octobre 2022 : Controles d'export semiconducteurs", detail: "NVIDIA perd ~15 Mds$ de revenus Chine. ASML, AMAT, LRCX restreints." },
      { step: "Janvier 2023 : Pays-Bas et Japon rejoignent les controles", detail: "ASML interdit de vendre l'EUV en Chine. Alliance trilaterale des puces formee." },
      { step: "Janvier 2025 : Le choc DeepSeek V3", detail: "Modele chinois rivalisant avec GPT-4 avec une fraction du compute. NVDA -17% en un jour (-593 Mds$ de market cap)." },
      { step: "2026+ : Controles etendus aux poids de modeles et acces cloud", detail: "MSFT, AMZN, GOOG restreints de fournir du compute IA aux entites chinoises." }
    ]),

    warning("Taiwan : l'endroit le plus dangereux du monde", "TSMC produit 92% des semiconducteurs les plus avances au monde. Chaque GPU NVIDIA, chaque processeur Apple, chaque modem Qualcomm est fabrique sur une petite ile a 160 km des cotes de la Chine continentale. Le 'Bouclier de Silicium' : la dependance mondiale a TSMC rend une invasion prohibitivement couteuse. Trois scenarios : Blocus (15-20% de probabilite d'ici 2030), Zone grise (25-30%), Invasion complete (5-10%). Les primes d'assurance risque de guerre ont augmente de 300%+ depuis 2022."),

    concept("L'IA souveraine : chaque nation construit la sienne", "Chaque nation avec des ressources et de l'ambition construit sa propre capacite IA — pas pour rivaliser avec OpenAI, mais parce que la dependance envers l'IA d'une nation etrangere est une vulnerabilite de securite nationale. L'Arabie Saoudite a engage 100 Mds$+, les Emirats 30 Mds$+. La France construit 14 nouveaux reacteurs EPR2. Le Japon, l'Inde, Singapour investissent massivement. NVIDIA genere des milliards de revenus de contrats d'IA souveraine."),

    concept("Le paradoxe DeepSeek", "Le developpement le plus destabilisant : DeepSeek V3 a demontre que l'innovation algorithmique peut partiellement compenser les restrictions hardware. Si la Chine peut construire des modeles de classe GPT-4 avec 1/10e du compute, l'efficacite de la strategie de controle des exportations est fondamentalement remise en question. Cela a declenche la plus grande perte de market cap d'un jour de NVIDIA et force une reevaluation de toute la these du 'fosse compute'."),

    quiz("Quel pourcentage des semiconducteurs les plus avances au monde (sub-7nm) est fabrique par TSMC a Taiwan ?",
      ["60%", "75%", "85%", "92%"],
      3, "TSMC fabrique 92% des semiconducteurs les plus avances du monde. Cette concentration extreme sur une ile de 36 000 km2 situee a 160 km de la Chine continentale est ce que The Economist appelle 'l'endroit le plus dangereux de la Terre'. Le CHIPS Act americain vise a reduire cette dependance, mais les fabs de TSMC en Arizona ne seront pas a pleine production avant 2028-2029."),

    summary("Chapitre 13 — Points cles", [
      "La Guerre des Puces US-Chine est la nouvelle course aux armements du 21e siecle",
      "TSMC fabrique 92% des puces avancees — vulnerabilite extreme sur Taiwan",
      "DeepSeek V3 a remis en question l'efficacite des controles d'exportation",
      "L'IA souveraine emerge mondialement : chaque nation veut sa propre infrastructure IA",
      "Les primes d'assurance risque de guerre sur Taiwan ont augmente de 300%+ depuis 2022"
    ]),

    // ============================================================
    // PARTIE 14 : LES PERDANTS ET L'OBSOLESCENCE
    // ============================================================
    chapterIntro(14, "Les Perdants et l'Obsolescence", "Le dilemme de l'innovateur a l'ere de l'IA. Qui sera le Kodak de la revolution IA ?"),

    concept("Le dilemme de l'innovateur version IA", "Clayton Christensen a montre que les entreprises dominantes echouent non pas par incompetence mais parce qu'elles font exactement ce que leurs clients actuels demandent — au lieu de se cannibaliser pour la prochaine vague. Dans l'ere IA, le dilemme est encore plus aigu : les incumbents doivent deployer une technologie qui detruit leurs propres revenus. Accenture facture des heures de consultants humains — deployer des agents IA cannibalise son propre modele."),

    table("La liste des perdants par secteur", ["Secteur", "Entreprises a risque", "Risque", "Raison"],
      [
        ["BPO / Outsourcing", "INFY, WIT, CTSH", "Tres eleve", "Agents IA remplacent 50-80% du travail offshore"],
        ["Staffing / Interim", "RHI, MAN", "Extreme", "Modele d'intermediation disparait quand le travail est automatise"],
        ["Education legacy", "CHGG, 2U, Pearson", "Extreme", "ChatGPT offre gratuitement ce que Chegg vendait 16$/mois"],
        ["Media / Stock content", "GETY, Shutterstock", "Tres eleve", "Contenu IA genere a 0,1% du cout"],
        ["Freelance marketplaces", "UPWK, FVRR", "Eleve", "Les agents font directement ce que les freelances proposent"],
        ["Centres d'appels", "TTEC, TELE", "Extreme", "Resolution par IA a 98% de reduction de cout"]
      ]),

    comparison("Modele traditionnel vs Modele IA",
      { label: "Services IT traditionnels", items: ["Necessite des bureaux a Bangalore, Manille, Cracovie", "Visas H-1B pour la prestation sur site", "3-6 mois de montee en competence par recrue", "20% de turnover annuel", "Revenus proportionnels aux effectifs", "Plafonne a 2 080 heures facturables par an"] },
      { label: "Modele Agent IA", items: ["Fonctionne sur infrastructure cloud, pas de bureaux", "Pas de paperasse immigration", "Deploiement en minutes, pas en mois", "0% d'attrition, retention infinie", "Revenus proportionnels au compute (exponentiel)", "Disponible 8 760 heures par an, chaque annee"] }
    ),

    warning("Comment shorter la disruption", "Les shorts les plus propres sur la these IA sont : RHI et MAN (agences d'interim — modele d'intermediation qui disparait), CHGG (modele 'vente de reponses' detruit par ChatGPT), INFY et WIT (services IT indiens — arbitrage travail rendu obsolete). La cle : le marche traite encore la faiblesse de revenus comme cyclique, pas seculaire. Quand les donnees d'adoption agentique deviendront claires, les estimations consensus seront revisees a la baisse de 15-25%."),

    quiz("Pourquoi Accenture est-elle mieux positionnee que Infosys face a la disruption IA ?",
      ["Parce qu'Accenture n'utilise pas l'IA", "Parce qu'Accenture investit 3 Mds$ en IA et reforme 250K travailleurs, tandis qu'Infosys bouge plus lentement", "Parce qu'Accenture a plus de clients", "Parce qu'Accenture est americaine et pas indienne"],
      1, "Accenture investit agressivement 3 Mds$ dans ses capacites IA et reforme 250 000 travailleurs pour pivoter d'un modele 'vente d'heures' vers un modele 'vente de resultats'. Infosys et Wipro bougent plus lentement, ce qui explique leur risque de disruption plus eleve. Les entreprises qui pivotent avec succes survivront — celles qui s'accrochent au modele body-shop font face a des baisses de revenus de 20-40% sur 3-5 ans."),

    summary("Chapitre 14 — Points cles", [
      "Le dilemme de l'innovateur est encore plus aigu dans l'ere IA — les incumbents doivent se cannibaliser",
      "Les agences de staffing (RHI, MAN) font face a l'extinction — pas de pivot possible",
      "Les services IT indiens (5M employes, 250 Mds$ revenus) sont structurellement menaces",
      "Chegg est l'exemple type : -80% depuis que ChatGPT offre le meme service gratuitement",
      "Les shorts les plus propres : RHI, MAN, CHGG, INFY, WIT, UPWK"
    ]),

    // ============================================================
    // PARTIE 15 : CONCLUSION — LE PORTEFEUILLE SINGULARITE
    // ============================================================
    chapterIntro(15, "Le Portefeuille Singularite", "20 positions. 6 categories. Une these : les entreprises qui construisent, alimentent, securisent et deploient physiquement l'IA seront les dominants createurs de richesse de la prochaine decennie."),

    concept("Philosophie du portefeuille : l'antifragilite", "Nassim Nicholas Taleb a introduit le concept d'antifragilite : des systemes qui gagnent du desordre. Un portefeuille robuste resiste aux chocs. Un portefeuille antifragile en beneficie. Si l'adoption IA est plus lente que prevu, nos positions Energie profitent de l'electrification generale. Si l'IA cause un conflit geopolitique, nos positions Defense augmentent. Si l'IA provoque un crash de marche, notre reserve cash permet d'acheter les meilleures convictions au rabais. Le portefeuille n'a pas besoin que l'IA reussisse pour generer des rendements — il a besoin que l'IA continue d'etre tentee, ce qui est certain."),

    steps("Les 3 principes du portefeuille", [
      { step: "Principe 1 : Le Barbell", detail: "70% positions core (entreprises etablies, profitables avec vent arriere IA). 20% paris haute conviction (pure plays, volatilite elevee, upside asymetrique). 10% couvertures et cash." },
      { step: "Principe 2 : Horizon long 3-5 ans", detail: "La disruption IA n'est pas un trade trimestriel. Le portefeuille est concu pour tenir a travers des drawdowns de 30-40%. Les revisions trimestrielles ajustent le positionnement, mais la these reste inchangee sauf invalidation fondamentale." },
      { step: "Principe 3 : Diversification sectorielle dans le theme", detail: "Compute + Logiciel + Energie + IA Physique + Defense + Couvertures. Ces secteurs ont une faible cross-correlation malgre le theme IA partage. Une restriction reglementaire sur le logiciel IA n'affecte pas les actions nucleaires." }
    ]),

    table("Le Singularity 20 — Le portefeuille complet", ["Ticker", "Categorie", "Poids", "These"],
      [
        ["NVDA", "Compute", "5%", "Monopole GPU. Cycle Blackwell en demarrage."],
        ["TSM", "Compute", "4%", "Fabrique 90%+ des puces avancees. Irreplacable."],
        ["AVGO", "Compute", "4%", "Accelerateurs custom (XPUs) + networking."],
        ["AMD", "Compute", "3%", "Challenger credible #2 avec MI300X/EPYC."],
        ["MSFT", "Logiciel", "5%", "Copilot monetise 400M utilisateurs Office."],
        ["PLTR", "Logiciel", "4%", "AIP : systeme d'exploitation IA gouvernement + commercial."],
        ["CRM", "Logiciel", "3%", "Agentforce : agents IA pour CRM. 150K clients."],
        ["CRWD", "Logiciel", "3%", "Cybersecurite IA-native. Charlotte AI."],
        ["CEG", "Energie", "4%", "Plus grande flotte nucleaire US. Deal Microsoft TMI."],
        ["VST", "Energie", "3%", "Nucleaire + gaz. PPAs data centers."],
        ["ETN", "Energie", "3%", "Infra electrique data centers. Backlog multi-annees."],
        ["TSLA", "IA Physique", "4%", "Optimus humanoide + FSD + Dojo compute."],
        ["UBER", "IA Physique", "3%", "Plateforme deploiement vehicules autonomes."],
        ["ISRG", "IA Physique", "3%", "Robots chirurgicaux Da Vinci. Modele razor/blade."],
        ["LMT", "Defense", "3%", "Premier contractant defense. Autonomie + cyber."],
        ["AXON", "Defense", "3%", "Taser + bodycam + Draft One IA (rapports police)."],
        ["DUOL", "Applications", "2%", "Tuteur IA. 113M MAU. +200% depuis pivot IA."],
        ["Short INFY", "Couverture", "-2%", "Services IT indiens — arbitrage travail obsolete."],
        ["Short RHI", "Couverture", "-2%", "Staffing — modele d'intermediation en voie d'extinction."],
        ["Cash", "Reserve", "10%", "Deploiement opportuniste sur corrections."]
      ]),

    concept("Analyse de scenarios", "Scenario bull (25% proba) : AGI d'ici 2028, adoption acceleree, le portefeuille fait +150-200% sur 3 ans. Scenario base (50% proba) : deploiement progressif, capex maintenu, le portefeuille fait +60-100% sur 3 ans (20-25% CAGR). Scenario bear (20% proba) : bulle IA eclatement, correction de 40-50%, mais les positions defensives (CEG, ETN, CRWD, LMT) limitent les pertes. Meme dans le bear case, les infrastructures construites restent et les gagnants a long terme sont les memes. Scenario catastrophe (5% proba) : conflit Taiwan, recession globale, portefeuille -30 a -50% temporairement. La reserve cash de 10% permet de racheter au plus bas."),

    tip("Guide d'implementation", "1) Ne pas tout acheter d'un coup — echelonner sur 3-6 mois. 2) Acheter les pullbacks, pas les breakouts. 3) Dimensionner les positions : max 5% par titre pour le Singularity 20. 4) Rebalancer trimestriellement. 5) Si un titre depasse 8% du portefeuille, prendre partiellement les profits. 6) La discipline de gestion des risques compte plus que le stock picking. 7) Garder toujours 10% en cash pour les opportunites. 8) Ne jamais risquer plus de 2% du portefeuille sur un seul trade."),

    quote("Le futur est deja la — il n'est juste pas distribue uniformement.", "William Gibson"),

    quiz("Quel est le principe le plus important du portefeuille Singularite selon la philosophie d'antifragilite ?",
      ["Maximiser le rendement a tout prix", "Le portefeuille doit profiter du desordre, pas juste y resister", "Investir uniquement dans les semiconducteurs IA", "Eviter toute volatilite"],
      1, "L'antifragilite, concept de Nassim Taleb, decrit des systemes qui gagnent du desordre. Le portefeuille Singularite est concu pour que chaque scenario (ralentissement IA, conflit geopolitique, crash de marche, succes au-dela des attentes) beneficie a au moins une partie des positions. Le portefeuille n'a pas besoin que l'IA reussisse — juste qu'elle continue d'etre tentee."),

    summary("Serie AI Singularity — Recapitulatif final", [
      "L'IA est la plus grande creation de richesse de l'histoire : 15-25 000 Mds$ TAM d'ici 2030",
      "15 secteurs analyses : Compute, Agents, Sante, Creatif, Automobile, Education, Cyber, Robotique, Finance, Energie, Travail, Geopolitique, Perdants",
      "Le Singularity 20 : portefeuille de 20 positions couvrant 6 categories avec principe d'antifragilite",
      "Conviction elevee, horizon 3-5 ans, volatilite elevee (drawdowns 30-40% possibles) mais alpha attendu de 15-25% CAGR",
      "La discipline de gestion des risques et la patience a travers les drawdowns sont ce qui separe les rendements transformationnels des rendements moyens"
    ]),

    quote("Les plus gros rendements vont aux investisseurs qui achetent l'infrastructure pendant la phase d'installation et tiennent a travers le retournement. Amazon est passe de 100$ en 1999 a 5$ en 2001 a 200$ sur 20 ans.", "Carlota Perez (paraphrase)")

  ];
}

function generateAISingularityEN() {
  slideIndex = 0;
  return [

    // =====================================================================
    // PART 1: INTRODUCTION — THE INFLECTION POINT
    // =====================================================================
    chapterIntro(1, "Introduction: The Inflection Point", "Why 2025-2030 is the most critical period in technological history"),

    concept("The Paradigm Shift", "Every few decades, a technology emerges that does not merely improve existing processes but fundamentally rewires the architecture of economic value creation. The steam engine did it in the 1780s. Electricity in the 1890s. The internet in the 1990s. Artificial intelligence is doing it now — but at a pace that makes every prior revolution look glacial by comparison."),

    bullets("AI Adoption Speed vs. Historical Precedents", [
      "The internet took 7 years to go from 14 million to 400 million users (1993-2000)",
      "Smartphones took 5 years to reach 1 billion units (2007-2012)",
      "ChatGPT reached 100 million users in just 2 months",
      "But adoption speed is just the surface — the real story is capability scaling"
    ]),

    table("The Compute Scaling Laws", ["Model", "Year", "Parameters", "Capability Jump"], [
      ["GPT-2", "2019", "1.5 Billion", "Coherent paragraphs"],
      ["GPT-3", "2020", "175 Billion", "Few-shot learning, code"],
      ["GPT-4", "2023", "~1.8 Trillion (MoE)", "Expert-level reasoning"],
      ["GPT-4.5 / Claude 3.5", "2024", "~3-5 Trillion", "Agentic workflows"],
      ["GPT-5 class", "2025E", "~10 Trillion+", "PhD-level research"],
      ["Next frontier", "2027E", "~50-100 Trillion", "Autonomous science"]
    ]),

    concept("Why Exponentials Are Unintuitive", "Our brains evolved for linear estimation. Walk 1 km per day, after 30 days you have walked 30 km. But exponential growth is profoundly different: double a penny every day and after 30 days you have $5.4 million. After 40 days: $5.5 billion. AI compute is on a super-exponential curve — approximately 16x the rate of Moore's Law. By 2027, AI capabilities will be roughly 1,000x what they were in 2024."),

    comparison("AI vs. Previous Tech Revolutions", {
      label: "Internet (1995-2005)",
      items: [
        "Digitized information distribution",
        "Removed distribution cost bottleneck",
        "Created ~$3T in market cap",
        "Displaced travel agents, retail clerks",
        "~50% YoY improvement (bandwidth)"
      ]
    }, {
      label: "AI (2023-2030)",
      items: [
        "Digitizing cognition itself",
        "Removing human expertise supply bottleneck",
        "Projected $25T+ in market cap",
        "Displacing knowledge workers, analysts, coders",
        "~1000% YoY improvement (capability)"
      ]
    }),

    bullets("The Five Waves of AI Disruption", [
      "Wave 1 — Chatbots & Copilots (2020-2023): ChatGPT, Copilot, Midjourney — DEPLOYED",
      "Wave 2 — Autonomous Agents (2024-2025): Claude Code, Devin, enterprise agents — DEPLOYING NOW",
      "Wave 3 — Physical AI (2025-2027): Tesla Optimus, Waymo, drone swarms — EMERGING",
      "Wave 4 — Scientific AI (2027-2029): AlphaFold, AI-designed drugs — R&D PHASE",
      "Wave 5 — AGI / ASI (2029+): General-purpose superintelligence — SPECULATIVE"
    ]),

    concept("Total Addressable Market", "Each wave unlocks a progressively larger market. Wave 1 (chatbots) is a ~$100B market. By Wave 4 (scientific AI), we are disrupting multi-trillion dollar industries like pharma ($1.5T), materials ($5T), and energy ($8T). The cumulative TAM by 2030 exceeds $15 trillion. This is not hype — it is the most conservative estimate from McKinsey."),

    table("The Four Quadrants of AI Investing", ["Quadrant", "Description", "Key Tickers", "Time Horizon"], [
      ["Infrastructure", "Chips, servers, data centers, power", "NVDA, AMD, TSM, AVGO, VRT", "1-3 years"],
      ["Platforms", "Cloud, model APIs, developer tools", "MSFT, GOOG, AMZN, META, ORCL", "2-5 years"],
      ["Applications", "Companies deploying AI for dominance", "PLTR, AXON, PANW, ISRG, NOW", "3-5 years"],
      ["Losers (Short)", "Existentially threatened businesses", "INFY, WIT, UPWK, FVRR", "1-3 years"]
    ]),

    table("Historical Tech Revolutions: Returns", ["Revolution", "Duration", "Iconic Winners", "Total Return (20Y)"], [
      ["Railroads", "1840-1880", "Union Pacific, J.P. Morgan", "~8,000%"],
      ["Electricity", "1880-1930", "GE, Westinghouse", "~12,000%"],
      ["Internet", "1993-2010", "Amazon, Google, Apple", "~170,000% (AMZN)"],
      ["Mobile", "2007-2020", "Apple, TSMC, Qualcomm", "~7,500% (AAPL)"],
      ["AI", "2020-2035E", "NVDA (+25,000% since 2019)", "We are here"]
    ]),

    tip("The Investment Framework", "Being early is not the same as being wrong, but being too early is economically indistinguishable from being wrong. The key is identifying which wave we are in and which is coming next, then positioning ahead of the institutional capital flow."),

    table("Hyperscaler AI Capex Explosion", ["Company", "FY2023", "FY2025E", "YoY Growth"], [
      ["Microsoft", "$28B", "$80B", "+54%"],
      ["Alphabet", "$32.3B", "$75B", "+43%"],
      ["Meta", "$28.1B", "$60-65B", "+60%"],
      ["Amazon", "$48.4B", "$100B", "+33%"],
      ["TOTAL Big 5", "$145.4B", "$340-345B", "+53%"]
    ]),

    summary("Part 1 Key Takeaways", [
      "AI compute is scaling at 16x the rate of Moore's Law",
      "Five waves of disruption: from chatbots to AGI",
      "Total addressable market exceeds $15 trillion by 2030",
      "The largest wealth creation event in human history is underway",
      "This series maps the investment landscape across 15 deep-dive chapters"
    ]),

    quiz("What is the approximate rate at which AI compute is scaling compared to Moore's Law?", [
      "2x the rate of Moore's Law",
      "5x the rate of Moore's Law",
      "16x the rate of Moore's Law",
      "100x the rate of Moore's Law"
    ], 2, "AI training compute has been doubling every 6 months since 2010, which is approximately 16x faster than Moore's Law's 18-month doubling cycle for transistor density."),

    // =====================================================================
    // PART 2: THE COMPUTE ARMS RACE
    // =====================================================================
    chapterIntro(2, "The Compute Arms Race", "The $1 Trillion datacenter buildout and the GPU demand explosion"),

    concept("The $1 Trillion Buildout", "We are witnessing the largest infrastructure investment cycle since the transcontinental railroad. The five major hyperscalers — Microsoft, Alphabet, Meta, Amazon, and Oracle — have collectively committed to spending over $336 billion on capital expenditures in FY2025 alone. Cumulative AI infrastructure spend will exceed $1.5 trillion by 2028. The motivation is existential: no hyperscaler can afford to fall behind."),

    table("Hyperscaler AI Capex (FY2025)", ["Company", "Capex", "YoY Growth", "AI % of Capex", "Focus"], [
      ["Amazon", "$100B+", "+67%", "~60%", "AWS Trainium3, Bedrock, Anthropic cluster"],
      ["Microsoft", "$80B", "+54%", "~70%", "Azure AI, Stargate, Maia 2 ASICs"],
      ["Alphabet", "$75B", "+43%", "~65%", "TPU v6 Trillium, Gemini, DeepMind"],
      ["Meta", "$60-65B", "+72%", "~80%", "Llama clusters, MTIA v2, Reels inference"],
      ["Oracle", "$16B", "+100%+", "~85%", "OCI Gen2 AI, sovereign AI"]
    ]),

    steps("The AI Compute Stack: From Sand to Superintelligence", [
      { step: "Wafer Fab", detail: "TSMC, Samsung — 3nm/5nm silicon manufacturing" },
      { step: "Advanced Packaging", detail: "CoWoS technology — THE BOTTLENECK at 100% utilization" },
      { step: "Chip Design", detail: "NVIDIA, AMD, Broadcom — GPU and ASIC design" },
      { step: "Systems Integration", detail: "SuperMicro, Dell, HPE — Server assembly" },
      { step: "Data Centers", detail: "Equinix, Digital Realty, Vertiv — Power, cooling, land" }
    ]),

    concept("The CoWoS Bottleneck", "Contrary to popular belief, the primary constraint is not wafer fabrication — TSMC has ample 5nm capacity. The real chokepoint is CoWoS (Chip-on-Wafer-on-Substrate) advanced packaging. Each Blackwell B200 GPU requires 2x the CoWoS area of an H100. CoWoS capacity was at 100% utilization with 52+ week lead times. This is the binding constraint on NVIDIA's revenue trajectory."),

    concept("Why HBM Is the Memory Revolution", "High Bandwidth Memory is not just faster DRAM — it is a fundamentally different architecture. Memory dies are vertically stacked using through-silicon vias. An HBM3e stack provides 1.2 TB/s bandwidth — roughly 10x DDR5. A Blackwell B200 uses 8 stacks for 8 TB/s aggregate bandwidth. Without HBM, modern AI would not exist. SK Hynix controls ~50% of supply; HBM commands 5-6x the ASP of standard DRAM."),

    table("NVIDIA Product Roadmap", ["Generation", "Architecture", "Process", "HBM", "Key Innovation", "Timeline"], [
      ["H100", "Hopper", "4nm", "80GB HBM3", "Transformer Engine", "2023"],
      ["B100/B200", "Blackwell", "4NP", "192GB HBM3e", "Dual-die, NVLink 5", "2025"],
      ["R100", "Rubin", "3nm", "288GB HBM4", "NVLink 6, 2x Blackwell", "2026"],
      ["R200", "Rubin Ultra", "3nm+", "HBM4e", "Full-stack refresh", "2027"]
    ]),

    bullets("NVIDIA's Dominance: The Numbers", [
      "92% market share in data center AI accelerators",
      "$130B FY25E revenue with 73% gross margins",
      "Annual product cadence — new architecture every year",
      "CUDA ecosystem: 4M+ developers, 15 years of library optimization",
      "Competitors (AMD, Google TPU, custom ASICs) fighting for the remaining 8%"
    ]),

    concept("Why CUDA Is the Moat", "Hardware performance alone does not explain NVIDIA's dominance. The true moat is CUDA — the proprietary parallel computing platform with 15+ years of optimized libraries. Every major AI framework (PyTorch, TensorFlow, JAX) runs on CUDA first. Switching costs are enormous: rewriting millions of lines of optimized CUDA code for AMD's ROCm or custom ASICs is a multi-year, multi-million dollar effort."),

    comparison("Training vs. Inference", {
      label: "Training",
      items: [
        "Teaching the AI — building the brain",
        "Requires the most powerful GPUs",
        "Massive clusters (10K-100K GPUs)",
        "NVIDIA dominance strongest here",
        "~30% of total AI compute spend"
      ]
    }, {
      label: "Inference",
      items: [
        "Running the trained model",
        "Lower power, optimized for latency",
        "Deployed at edge and cloud",
        "ASICs and custom chips competitive",
        "~70% and growing rapidly"
      ]
    }),

    table("The Picks & Shovels Ecosystem", ["Ticker", "Company", "Role", "AI Revenue Thesis"], [
      ["ANET", "Arista Networks", "Data center networking", "AI cluster networking $3B+ TAM"],
      ["VRT", "Vertiv Holdings", "Thermal & power management", "AI racks draw 40-120kW vs 10kW traditional"],
      ["MU", "Micron", "HBM3e memory", "HBM revenue zero to $4B+ in FY25"],
      ["ASML", "ASML Holding", "EUV lithography monopoly", "No advanced chips without ASML machines"],
      ["MRVL", "Marvell", "Custom AI interconnect", "ASIC partnerships with Amazon & Google"]
    ]),

    warning("Risk: The 'Air Pocket' Scenario", "The capex cycle could pause if hyperscalers pull back spending. A 2000-style overinvestment correction is the bear case. Also: the Taiwan scenario — TSMC fabricates 90%+ of advanced AI chips on an island that China considers its territory. Valuation compression is the third risk: NVIDIA at 30x+ forward earnings leaves little room for error."),

    summary("Part 2 Key Takeaways", [
      "$336B in hyperscaler AI capex for 2025 alone — $1.5T cumulative by 2028",
      "CoWoS packaging is the real bottleneck, not wafer fab",
      "NVIDIA dominates with 92% share; CUDA is the true moat",
      "The supply chain creates multiple investment opportunities beyond GPUs",
      "Annual GPU cadence means competitors are perpetually chasing"
    ]),

    quiz("What is the primary bottleneck in AI chip supply?", [
      "TSMC's wafer fabrication capacity",
      "NVIDIA's chip design speed",
      "CoWoS advanced packaging technology",
      "HBM memory production"
    ], 2, "CoWoS (Chip-on-Wafer-on-Substrate) packaging is at 100% utilization with 52+ week lead times. Each Blackwell B200 requires 2x the CoWoS area of an H100, making this the binding constraint on GPU production."),

    // =====================================================================
    // PART 3: AUTONOMOUS AI AGENTS
    // =====================================================================
    chapterIntro(3, "Autonomous AI Agents", "Software Eating Software — from answering questions to doing work"),

    concept("From Chat to Do", "The era of 'Chat' is ending. The era of 'Do' is beginning. AI is graduating from answering questions to executing multi-step workflows autonomously — and it is repricing every labor-intensive business on the planet. This is the shift from a $100B chatbot market to a $2-5 Trillion enterprise transformation."),

    steps("The Four Eras of AI", [
      { step: "Rule-Based Bots (2015-2022)", detail: "Decision trees, keyword matching. 'Press 1 for billing.' Market value: ~$5B" },
      { step: "LLM Chat (2023)", detail: "ChatGPT moment. Natural language but purely reactive. Market value: ~$100B" },
      { step: "Copilots (2024)", detail: "Human-in-the-loop. GitHub Copilot, 365 Copilot. 20-40% productivity gain. Value: ~$500B" },
      { step: "Autonomous Agents (2025+)", detail: "Goal-directed systems that observe, plan, act, and self-correct. 10-100x productivity. Value: $2-5T" }
    ]),

    concept("The Agentic Loop", "The critical distinction between a chatbot and an agent is the agentic loop: OBSERVE (read environment, APIs, data) → PLAN (decompose goal, sequence steps) → ACT (execute tools, write code, call APIs) → REFLECT (evaluate result, self-correct). This cycle runs until a goal is achieved. Think of it as a senior manager, not an intern — you say 'prepare the quarterly board deck' and they independently handle everything."),

    table("Agent Cost vs. Human Cost", ["Task Category", "Human Cost/hr", "Agent Cost/hr", "Reduction", "Speed Gain"], [
      ["L1 Customer Support", "$25", "$0.50", "-98%", "10x faster"],
      ["Code Review & QA", "$75", "$2.00", "-97%", "20x faster"],
      ["Legal Document Review", "$300", "$10.00", "-97%", "100x faster"],
      ["Financial Modeling", "$150", "$8.00", "-95%", "30x faster"],
      ["Software Development", "$120", "$4.00", "-97%", "10-50x faster"],
      ["Content Writing", "$60", "$1.00", "-98%", "40x faster"]
    ]),

    bullets("Key Capability Milestones", [
      "Tool Use (Mid-2023): Models can call APIs, run code, browse the web",
      "Multi-Step Reasoning (Late 2023): Chain-of-thought across 10+ steps",
      "Self-Correction (Early 2024): Detect and recover from errors autonomously",
      "Persistent Memory (Mid-2024): 1M+ token context windows, RAG",
      "Multi-Agent Orchestration (2025): Agents delegate to sub-agents, review each other"
    ]),

    table("The Agent Platform Winners", ["Ticker", "Company", "Market Cap", "AI Rev Growth", "Thesis"], [
      ["MSFT", "Microsoft", "$3.1T", "~60% YoY", "400M Office users = largest agent distribution"],
      ["CRM", "Salesforce", "$280B", "~80% YoY", "Agentforce: per-conversation pricing paradigm shift"],
      ["PLTR", "Palantir", "$250B", "~100% YoY", "AIP Ontology for complex agent orchestration"],
      ["NOW", "ServiceNow", "$200B", "~50% YoY", "Now Assist reduces ticket resolution 50%+"],
      ["DDOG", "Datadog", "$45B", "~55% YoY", "LLM Observability — agents need monitoring"]
    ]),

    warning("The BPO Extinction Event", "IT services companies face existential disruption. Infosys (317K employees, $59K revenue per employee), Wipro (234K employees, $47K rev/employee), Cognizant (347K employees) — their business model is selling human hours. When an AI agent does the same work for 97% less, the entire value proposition collapses. Robert Half and ManpowerGroup face 'extreme' disruption risk."),

    comparison("BPO Model vs. Agent Model", {
      label: "Traditional BPO",
      items: [
        "Revenue = headcount x billing rate x utilization",
        "Scale requires hiring more humans",
        "Margins capped at 10-15%",
        "Quality varies with individual performance",
        "Speed limited by human capacity"
      ]
    }, {
      label: "AI Agent Model",
      items: [
        "Revenue = per-task or per-conversation pricing",
        "Scale is infinite (compute elastic)",
        "Margins 80-90% (software economics)",
        "Quality consistent and measurable",
        "Speed: 10-100x faster"
      ]
    }),

    summary("Part 3 Key Takeaways", [
      "Agents execute multi-step workflows autonomously — not just chat",
      "95-98% cost reduction vs. human labor across knowledge work",
      "$150B+ agent market by 2028, growing from near-zero in 2023",
      "MSFT, CRM, PLTR are the platform winners; BPO companies are the losers",
      "Enterprise agent adoption projected at 35% of Fortune 500 by end 2025"
    ]),

    quiz("What is the key difference between a copilot and an autonomous agent?", [
      "Agents are faster but less accurate",
      "Copilots use AI while agents use traditional code",
      "Agents observe, plan, act, and self-correct without human intervention",
      "Copilots work in the cloud while agents work locally"
    ], 2, "A copilot is human-in-the-loop — it drafts suggestions that a human must approve. An autonomous agent runs a persistent loop of observe, plan, act, and reflect until the goal is achieved, escalating only when genuine judgment is needed."),

    // =====================================================================
    // PART 4: HEALTHCARE REVOLUTION
    // =====================================================================
    chapterIntro(4, "The Healthcare Revolution", "Biology becomes computable — AI drug discovery, surgical robotics, precision medicine"),

    concept("The TechBio Thesis", "For decades, drug development followed Eroom's Law — the opposite of Moore's Law — where the cost of developing a new drug doubled every 9 years. AI is breaking this pattern by treating biology as an information science. The human genome is 3.2 billion base pairs — roughly 800 megabytes of data, less than a single movie file. Biology is becoming a computable engineering problem."),

    table("Traditional vs. AI-First Drug Development", ["Metric", "Traditional Pharma", "AI-First TechBio", "Improvement"], [
      ["Discovery Phase", "4-6 years", "6-18 months", "3-4x faster"],
      ["Pre-clinical", "1-3 years", "6-12 months", "2x faster"],
      ["Clinical Trials (I-III)", "6-8 years", "3-5 years", "1.5-2x faster"],
      ["Total Cost", "$2.0-2.6 Billion", "$200-400 Million", "5-10x cheaper"],
      ["Phase II Success Rate", "~28%", "~40-50% (projected)", "+12-22 pts"],
      ["Compounds Screened", "5K-10K (wet lab)", "1 Billion+ (in silico)", "100,000x more"]
    ]),

    concept("AlphaFold: The Rosetta Stone of Biology", "DeepMind's AlphaFold predicted the 3D structure of over 200 million proteins — virtually every known protein in existence — in seconds rather than the years it previously took using X-ray crystallography. This is the equivalent of mapping the entire human genome, but for protein structures. It unlocks drug target identification at unprecedented speed."),

    bullets("AI Drug Discovery: Real Results", [
      "Insilico Medicine's ISM001-055: first AI-designed drug to reach Phase II clinical trials",
      "Recursion Pharmaceuticals: 50 petabytes of biological data, 2.8M experiments per week",
      "Over 100 AI-discovered drugs now in clinical trials globally",
      "First AI-designed drug FDA approval projected for 2027-2028",
      "Recursion + Exscientia merger combines structure-based and phenomics approaches"
    ]),

    bullets("AI in Diagnostics: Better Than Human Eyes", [
      "Paige AI: 96% sensitivity in prostate cancer pathology detection (FDA approved)",
      "Viz.ai: 97% sensitivity in stroke detection from CT scans (510k cleared)",
      "Google Health LYNA: 99% accuracy detecting breast cancer metastasis (research stage)",
      "Dexcom G7: best-in-class continuous glucose monitoring with AI prediction",
      "Tempus AI: multi-modal oncology AI matching patients to genomic therapies"
    ]),

    concept("Intuitive Surgical: The Undisputed King", "ISRG has the razor-and-blade moat of the century. Each da Vinci robot costs $1.5M+ but the real profit comes from mandatory consumable instruments ($2K-3K per procedure) and service contracts. With 14M+ procedures in its dataset, da Vinci 5 brings AI-enhanced surgical guidance. They performed 2.3M+ procedures last year — every single one generates data to train the AI."),

    table("Healthcare AI Investment Targets", ["Ticker", "Company", "AI Exposure", "Thesis", "Risk"], [
      ["LLY", "Eli Lilly", "25%", "GLP-1 dominance + AI-accelerated pipeline", "Valuation"],
      ["ISRG", "Intuitive Surgical", "35%", "Robotic surgery monopoly, AI surgical guidance", "Low"],
      ["RXRX", "Recursion Pharma", "95%", "Largest bio dataset (50PB), NVIDIA partnership", "High (pre-profit)"],
      ["VEEV", "Veeva Systems", "40%", "Cloud CRM for 90% of top pharma + AI tools", "Low"],
      ["SDGR", "Schrodinger", "90%", "Physics-based computational chemistry", "Medium"]
    ]),

    warning("Why Most Biotech Investors Lose Money", "Regulatory risk (FDA bottleneck), clinical trial failures (72% of Phase II trials fail historically), pricing pressure from the IRA (Medicare price negotiations), and extreme valuation volatility. Biotech is binary — a single trial readout can move a stock +50% or -40% in a day."),

    summary("Part 4 Key Takeaways", [
      "AI cuts drug development from 10+ years and $2.6B to 2-3 years and $200-400M",
      "AlphaFold predicted 200M+ protein structures — the Rosetta Stone of biology",
      "Over 100 AI-discovered drugs now in clinical trials",
      "ISRG's da Vinci 5 brings AI-enhanced surgery with a 14M procedure dataset",
      "First AI-designed drug FDA approval expected in 2027-2028"
    ]),

    quiz("How much faster can AI-first drug discovery screen compounds vs. traditional wet labs?", [
      "10x more compounds",
      "1,000x more compounds",
      "100,000x more compounds",
      "1 million x more compounds"
    ], 2, "AI-first drug discovery can screen 1 billion+ compounds in silico versus 5,000-10,000 in traditional wet lab screening — roughly 100,000 times more candidates."),

    // =====================================================================
    // PART 5: CREATIVE DISRUPTION
    // =====================================================================
    chapterIntro(5, "Creative Disruption", "The content cost collapse and the death of the 'average' creative"),

    table("Content Cost Collapse: Traditional vs AI (2026)", ["Content Type", "Traditional Cost", "AI Cost", "Reduction"], [
      ["Image (1 photo)", "$500-$2,000", "$0.02-$0.08", "-99.9%"],
      ["Video (per second)", "$5,000-$15,000", "$0.05-$0.20", "-99.99%"],
      ["Music (1 track)", "$5,000-$20,000", "$0.10-$1.00", "-99.99%"],
      ["Text (1,000 words)", "$100-$500", "$0.005-$0.02", "-99.99%"],
      ["Voice-over (per minute)", "$50-$300", "$0.01-$0.05", "-99.98%"],
      ["3D Asset / Game Object", "$500-$5,000", "$0.50-$5.00", "-99.9%"]
    ]),

    concept("The Barbell Effect", "When the cost of producing 'good enough' content drops to zero, the market does not collapse uniformly. It bifurcates into a barbell. The Premium End: scarcity and authenticity command higher premiums than ever. The Commodity End: volume explodes, unit value collapses to zero. The Dead Middle: average freelancers whose output is now indistinguishable from AI — but 1,000x more expensive."),

    bullets("IP Owners Win: Content Libraries as Moats", [
      "Disney: Marvel, Star Wars, Pixar — 60-70% VFX cost reduction via AI",
      "Netflix: 280M subs, AI dubbing, dynamic thumbnails, script scoring",
      "Take-Two: GTA VI world 10x larger at similar budget thanks to AI NPCs and procedural generation",
      "Roblox: 80M+ DAU, AI tools let kids build AAA-quality worlds with prompts"
    ]),

    comparison("Tool Makers vs. Stock Media", {
      label: "Winners: Tool Makers",
      items: [
        "Adobe Firefly: $2.5B+ incremental ARR by 2027E",
        "30 years of creative workflow lock-in",
        "Commercially safe training data (Content Credentials)",
        "Canva: 190M+ MAU, Magic Studio, IPO candidate"
      ]
    }, {
      label: "Losers: Stock Media",
      items: [
        "Getty Images: -90% from peak, core product obsolete",
        "Shutterstock: -88% from peak, library usage declining",
        "Fiverr: -93% from peak, gig economy crushed",
        "Chegg: -99% from peak, terminal business model"
      ]
    }),

    bullets("The Copyright Battleground: $100B Question", [
      "NYT v. OpenAI/Microsoft: landmark trial scheduled 2026 — defines publisher rights",
      "Getty v. Stability AI: defines visual IP rights in AI training",
      "Authors Guild v. OpenAI: could establish per-work licensing for text training",
      "UMG/RIAA v. Suno/Udio: existential for AI music generation"
    ]),

    concept("The Creator Economy 2.0: The Solo Studio", "One person with AI tools can now produce content that previously required a team of 20. The MrBeast model: AI handles editing, thumbnails, translations — human provides taste, personality, and judgment. The 'solo studio' democratizes Hollywood-quality production, but the winner-take-all dynamics intensify."),

    summary("Part 5 Key Takeaways", [
      "Content creation costs have collapsed 99%+ across every medium",
      "The market bifurcates: premium IP holders thrive, average creators die",
      "Adobe is the 'picks and shovels' winner with Firefly and Content Credentials",
      "Major copyright lawsuits in 2026 will define the rules for AI training",
      "One person can now produce what used to require 20-person teams"
    ]),

    quiz("What is the 'Barbell Effect' in creative markets?", [
      "AI makes all content equally valuable",
      "Premium IP and commodity content thrive; the average middle gets crushed",
      "Only large studios survive while independents fail",
      "Content prices uniformly decrease by 50%"
    ], 1, "The Barbell Effect means the market bifurcates: premium IP owners command higher prices (scarcity and authenticity), commodity AI content explodes in volume, and the 'dead middle' — average freelancers whose output is indistinguishable from AI but 1,000x more expensive — gets crushed."),

    // =====================================================================
    // PART 6: AUTONOMOUS DRIVING
    // =====================================================================
    chapterIntro(6, "Autonomous Driving", "The $11 Trillion transportation revolution and the cost-per-mile collapse"),

    concept("The Utilization Paradox", "Your car sits parked 95% of the time. It is one of the most underutilized assets in the world. The average American spends $12,182 per year on car ownership — $2.50 per mile. A robotaxi operating 60,000-80,000 miles per year at $0.50 per mile in 2026 and $0.25 per mile by 2030 fundamentally changes the economics of transportation. An 80-90% cost reduction makes car ownership irrational for most urban dwellers."),

    table("Cost Per Mile: Human vs. Robotaxi", ["Component", "Uber (Human)", "Robotaxi (2026)", "Robotaxi (2030E)"], [
      ["Driver/Operator", "$1.65 (66%)", "$0.00", "$0.00"],
      ["Vehicle Depreciation", "$0.18", "$0.18", "$0.08"],
      ["Energy (Electric)", "$0.15", "$0.06", "$0.04"],
      ["Insurance", "$0.22", "$0.12", "$0.05"],
      ["Maintenance", "$0.10", "$0.08", "$0.04"],
      ["TOTAL", "$2.50/mi", "$0.50/mi", "$0.25/mi"]
    ]),

    bullets("The State of L4 Autonomy (2026)", [
      "Waymo: 150,000+ paid rides per week, the quiet leader with the best safety data",
      "Tesla FSD v13: vision-only end-to-end neural nets, 7M+ vehicles collecting data",
      "Cruise (GM): $10B+ invested, restructured and restarting after 2023 incidents",
      "Aurora: autonomous trucking partner with PACCAR and FedEx",
      "Mobileye: selling SuperVision L2++ to VW, Porsche — not robotaxi but huge ADAS TAM"
    ]),

    table("Safety Data: AI vs. Human Drivers", ["Metric", "Human Average", "Waymo AV", "Tesla FSD v13", "Improvement"], [
      ["Fatal crashes per 100M miles", "1.35", "0.00 (25M mi)", "~0.20 (est.)", "100% / 85%"],
      ["Injury crashes per 100M miles", "77.0", "11.5", "~15.0 (est.)", "85% / 81%"],
      ["Property damage claims / mile", "1.0x baseline", "0.08x", "~0.25x", "92% / 75%"]
    ]),

    concept("End-to-End Neural Nets", "Traditional self-driving used modular pipelines: separate modules for perception, prediction, and planning. Tesla's end-to-end approach feeds raw camera pixels directly into a single neural network that outputs steering and acceleration. This is fundamentally different — the system learns to drive holistically rather than chaining brittle modules together. It is why Tesla's FSD improved more in 6 months than in the previous 5 years."),

    bullets("Autonomous Trucking: The Graveyard and Survivors", [
      "TuSimple: delisted, defunct in the US — camera-first approach failed",
      "Embark: shut down, capital returned to investors",
      "Kodiak Robotics: pivoted to defense (military autonomous logistics)",
      "Aurora (AUR): the survivor — commercial pilot with FedEx and PACCAR",
      "Tesla Semi + FSD: early testing with PepsiCo pilot fleet"
    ]),

    table("The AV Investment Landscape", ["Ticker", "Company", "Role", "Risk", "Key Thesis"], [
      ["TSLA", "Tesla", "Full stack vehicle + software", "High", "Only company with fleet data at scale — 7M+ vehicles"],
      ["GOOGL", "Alphabet (Waymo)", "L4 commercial service", "Medium", "Waymo valued at $0 in GOOGL stock — free optionality"],
      ["UBER", "Uber", "Demand aggregation", "Low", "The app you hail the robot through — asset-light model"],
      ["AUR", "Aurora", "Autonomous trucking", "High", "Partnered with PACCAR and FedEx, cash runway to 2027"]
    ]),

    summary("Part 6 Key Takeaways", [
      "Robotaxis cut cost per mile from $2.50 to $0.25 — an 90% reduction",
      "Waymo leads with 150K+ paid rides per week and the best safety record",
      "Tesla FSD v13 end-to-end neural nets are a paradigm shift in approach",
      "Car ownership becomes irrational for urban dwellers when robotaxis scale",
      "Most autonomous trucking startups have failed — Aurora is the survivor"
    ]),

    quiz("What percentage of its lifetime does the average privately owned car sit parked?", [
      "50%",
      "75%",
      "85%",
      "95%"
    ], 3, "The average car sits parked 95% of the time, making it one of the most underutilized assets in the world. A robotaxi operating 60,000-80,000 miles per year completely changes the utilization equation."),

    // =====================================================================
    // PART 7: EDUCATION TRANSFORMATION
    // =====================================================================
    chapterIntro(7, "Education Transformation", "Bloom's 2-Sigma Problem solved — AI tutors outperform classroom instruction"),

    concept("Bloom's 2-Sigma Problem", "In 1984, educational psychologist Benjamin Bloom proved that students receiving 1-on-1 tutoring performed 2 standard deviations above students in traditional classrooms — meaning the average tutored student outperformed 98% of classroom students. The problem: 1-on-1 human tutoring costs $30-80/hour and is not scalable. AI tutors now achieve +1.5-1.8 sigma at $0.02-$0.10 per hour. This is the holy grail of education."),

    table("Teaching Methods Compared", ["Method", "Effect Size", "Percentile", "Scalability", "Cost/Student/Hr"], [
      ["Traditional Classroom (30:1)", "0.0σ (baseline)", "50th", "High", "$2-$5"],
      ["Mastery Learning (group)", "+1.0σ", "84th", "Medium", "$5-$10"],
      ["Human 1-on-1 Tutoring", "+2.0σ", "98th", "Not scalable", "$30-$80"],
      ["AI Tutor (GPT-4 class)", "+1.5-1.8σ", "93rd-96th", "Unlimited", "$0.02-$0.10"],
      ["Pre-AI MOOC", "+0.3σ", "62nd", "High", "$0.50-$3"]
    ]),

    comparison("Winners vs. Losers in EdTech", {
      label: "Winner: Duolingo (DUOL)",
      items: [
        "AI-native gamification: GPT-4 roleplay, adaptive learning",
        "113M+ monthly active users, expanding to math and music",
        "Stock performance: massive outperformance since 2023",
        "$14B market cap, ~$700M revenue"
      ]
    }, {
      label: "Loser: Chegg (CHGG)",
      items: [
        "ChatGPT is a free, better Chegg — homework help obsolete",
        "Stock down -99% from peak ($115 to ~$1.50)",
        "Revenue declining 50%+ year-over-year",
        "The canary in the coal mine for content commoditization"
      ]
    }),

    concept("Why MOOCs Failed and AI Tutors Won't", "MOOCs (circa 2012-2016) had completion rates of just 3-5%. Why? They were just recorded lectures with no personalization. AI tutors are fundamentally different: they adapt in real-time to each student's knowledge gaps, use spaced repetition for retention, provide instant feedback, and never lose patience. The difference is like comparing a highway (MOOC) to a GPS system that adjusts the route in real-time (AI tutor)."),

    table("The Credential Crisis", ["Pathway", "Duration", "Total Cost", "Median Starting Salary", "ROI (5Y)"], [
      ["Top 50 University", "4 years", "$180,000", "$65,000", "1.8x"],
      ["Average University", "4 years", "$104,000", "$48,000", "2.3x"],
      ["Coding Bootcamp", "3-6 months", "$15,000", "$60,000", "20x"],
      ["Google Career Certificate", "6 months", "$300", "$50,000", "833x"],
      ["AI Self-Study + Portfolio", "6-12 months", "$20-$200", "Varies", "Varies"]
    ]),

    summary("Part 7 Key Takeaways", [
      "AI tutors achieve 1.5-1.8σ improvement at 0.1% the cost of human tutoring",
      "Duolingo thrives with AI-native gamification; Chegg is destroyed (-99% from peak)",
      "The $6.5 trillion global education market is being rebuilt from scratch",
      "Credentials are being unbundled — a Google Certificate has 833x ROI vs. 1.8x for a top university",
      "The 2-Sigma Problem is effectively solved — unlimited personalized tutoring at near-zero cost"
    ]),

    quiz("What is Bloom's 2-Sigma finding?", [
      "AI tutors are twice as expensive as human tutors",
      "Students with 1-on-1 tutoring outperform 98% of classroom students",
      "Online learning is 2x more effective than in-person",
      "Class sizes should be limited to 2 students per teacher"
    ], 1, "Benjamin Bloom demonstrated in 1984 that 1-on-1 tutored students performed 2 standard deviations above the mean — meaning they outperformed 98% of students receiving traditional classroom instruction."),

    // =====================================================================
    // PART 8: CYBERSECURITY AI
    // =====================================================================
    chapterIntro(8, "Cybersecurity AI", "The AI arms race in security — when attackers use AI, defenders must too"),

    concept("The Asymmetry Problem", "Global cybercrime costs reached $8 trillion in 2023 and are projected to hit $15.3 trillion by 2027. Here is the core problem: the attacker's cost is approaching zero while the defender's cost is rising. An attacker can use AI to generate thousands of unique phishing emails, create deepfake CEO voices for wire fraud, and write polymorphic malware that mutates to evade detection — all for pennies. Defense requires AI too."),

    table("Global Cybercrime Cost Trajectory", ["Year", "Cost", "YoY Growth", "Key Driver", "Major Incident"], [
      ["2021", "$6.0T", "--", "Ransomware surge", "Colonial Pipeline, Kaseya"],
      ["2023", "$8.0T", "+13%", "AI-enhanced phishing", "MOVEit, MGM ($100M)"],
      ["2024", "$9.5T", "+19%", "Deepfakes + credential theft", "Change Healthcare ($2.9B)"],
      ["2026E", "$12.8T", "+17%", "Autonomous attack campaigns", "--"],
      ["2027E", "$15.3T", "+20%", "Full AI arms race", "--"]
    ]),

    bullets("AI-Powered Attack Vectors (2025+)", [
      "Deepfakes & Social Engineering: AI-generated voice clones for wire fraud (already happening)",
      "AI-Powered Phishing at Scale: thousands of unique, personalized emails per second",
      "Polymorphic Malware: AI generates new variants that evade signature-based detection",
      "Automated Zero-Day Discovery: AI finds vulnerabilities faster than human researchers",
      "Autonomous Attack Campaigns: end-to-end hacking with minimal human oversight"
    ]),

    comparison("SOC 1.0 vs. SOC 3.0 (AI-First)", {
      label: "Traditional SOC",
      items: [
        "Mean Time to Detect: 197 days",
        "Mean Time to Respond: 4.5 hours",
        "Alerts Investigated: 0.2% of total",
        "False Positive Rate: 95%",
        "Analyst Burnout/Turnover: 35% annual"
      ]
    }, {
      label: "AI-Native SOC",
      items: [
        "Mean Time to Detect: 14 days (93% faster)",
        "Mean Time to Respond: 30 minutes (89% faster)",
        "Alerts Investigated: 100% triaged (500x coverage)",
        "False Positive Rate: <5% (19x reduction)",
        "Analyst Burnout/Turnover: 12% annual"
      ]
    }),

    concept("Zero Trust: Identity Is the New Perimeter", "The old security model gave you a master key at the front door. Zero Trust assumes breach: every request is verified, every identity is authenticated, every device is checked. In a world of remote work and cloud-native applications, there is no perimeter to defend. Identity becomes the only constant — and AI is needed to verify identity in real-time across billions of transactions."),

    table("Cybersecurity Platform Comparison", ["Attribute", "CrowdStrike", "Palo Alto", "Zscaler", "Fortinet"], [
      ["Core Strength", "Endpoint (Falcon)", "Network + Platform (XSIAM)", "Cloud Zero Trust", "Hardware + SD-WAN"],
      ["AI Engine", "Charlotte AI", "Precision AI + XSIAM", "AI-powered DLP", "FortiAI"],
      ["ARR / Revenue", "$4.2B ARR", "$8.5B Rev", "$2.6B Rev", "$6.1B Rev"],
      ["Rev Growth", "+28%", "+15%", "+26%", "+12%"],
      ["FCF Margin", "33%", "38%", "26%", "28%"]
    ]),

    tip("The Platform Consolidation Megatrend", "The long tail of 200+ security vendors held 53% market share in 2022 — projected to shrink to 38% by 2027. CrowdStrike, Palo Alto, and Zscaler are growing at the expense of fragmented point solutions. CISOs want fewer vendors, not more. The winning strategy: buy the platform consolidators."),

    summary("Part 8 Key Takeaways", [
      "Cybercrime costs: $8T in 2023 → $15.3T by 2027 — security is non-discretionary",
      "AI-first SOC reduces detection time by 93% and response time by 89%",
      "Platform consolidation is the megatrend — CrowdStrike, Palo Alto, Zscaler are the winners",
      "Zero Trust replaces perimeter-based defense; identity is the new security boundary",
      "More AI adoption = more attack surface = more demand for AI-powered defense"
    ]),

    quiz("By how much does an AI-native SOC reduce Mean Time to Detect threats?", [
      "50% faster (from 197 to ~100 days)",
      "75% faster (from 197 to ~50 days)",
      "93% faster (from 197 to 14 days)",
      "99% faster (from 197 to 2 days)"
    ], 2, "An AI-native SOC reduces Mean Time to Detect from 197 days to just 14 days — a 93% improvement. It also triages 100% of alerts (vs. 0.2%) and reduces false positives from 95% to under 5%."),

    // =====================================================================
    // PART 9: ROBOTICS & PHYSICAL AI
    // =====================================================================
    chapterIntro(9, "Robotics & Physical AI", "Humanoid robots create a $30-50 Trillion labor substitute market"),

    concept("Moravec's Paradox", "In 1988, roboticist Hans Moravec observed something counterintuitive: what is easy for humans — walking, grasping, navigating — is extremely hard for machines. And what is hard for humans — chess, mathematics, data analysis — is trivially easy for computers. For 40 years, robots excelled at repetitive factory tasks but could not fold laundry. Physical AI is finally solving Moravec's Paradox — what was easy for humans is becoming possible for machines."),

    table("The Humanoid Robot Race", ["Robot", "Company", "Target Price", "Timeline", "Key Advantage"], [
      ["Optimus Gen 3", "Tesla", "$25-30K (2027E)", "Internal 2025, sale 2027", "Manufacturing scale, FSD neural nets"],
      ["Figure 02", "Figure AI", "~$50K est.", "Pilot 2025", "OpenAI partnership, speech interaction"],
      ["Neo", "1X Technologies", "~$40K est.", "Pilot 2025", "Lightest humanoid, home-friendly"],
      ["Digit", "Agility Robotics", "~$75-100K", "Shipping (warehouse)", "First commercially deployed, Amazon partner"],
      ["Atlas", "Boston Dynamics", "N/A", "2025 pilot", "Best mobility, decades of R&D"],
      ["Unitree H1/G1", "Unitree", "$16K (H1)", "Shipping", "Chinese cost advantage, open platform"]
    ]),

    bullets("The Economics: Robot vs. Human Worker", [
      "Average warehouse worker costs $45,000-55,000/year",
      "A humanoid robot at $30,000 with 5-year lifespan = $6,000/year + energy costs",
      "Robots work 20+ hours/day, 365 days/year — no breaks, no benefits, no turnover",
      "Payback period: under 12 months in warehouse settings",
      "Total addressable market for humanoid labor substitution: $30-50 Trillion"
    ]),

    concept("Sim-to-Real Transfer", "Training a robot in the real world is slow, expensive, and dangerous. The breakthrough is simulation: NVIDIA Isaac Sim, Google MuJoCo, and Unity Robotics create physics-accurate virtual worlds where robots train at 1000x real-time speed. A robot can experience 10 years of manipulation practice in a single day of simulation. Then transfer that learning to a physical body. This is why humanoid robots have improved more in the last 2 years than in the previous 20."),

    table("Robotics Market Trajectory ($B)", ["Segment", "2022", "2024E", "2028E", "CAGR"], [
      ["Industrial Robots", "$11.5B", "$13.8B", "$22B", "11%"],
      ["Collaborative Robots (cobots)", "$1.2B", "$2.4B", "$7B", "34%"],
      ["Warehouse/Logistics AMRs", "$4.5B", "$7.2B", "$18B", "26%"],
      ["Surgical Robots", "$6.2B", "$8.5B", "$16B", "17%"],
      ["Humanoid Robots", "~$0", "$0.1B", "$8B", "N/A (nascent)"],
      ["Total Robotics Market", "$25B", "$35B", "$79B", "21%"]
    ]),

    bullets("The Physical AI Software Stack", [
      "Simulation: NVIDIA Isaac Sim, MuJoCo (Google) — train at 1000x real-time",
      "Foundation Models: Google RT-2, NVIDIA GR00T — vision-language-action models",
      "Manipulation: dexterous grasping approaching human-level dexterity",
      "Locomotion: bipedal walking on stairs, uneven terrain, confined spaces",
      "Fleet Orchestration: coordinating hundreds of robots in shared spaces"
    ]),

    tip("Tesla's Robotics Edge", "Tesla is the only company with (a) manufacturing expertise to produce millions of robots at automotive cost structures, (b) real-world AI training data from 7M+ vehicles with cameras and neural nets, (c) Dojo supercomputer for training, and (d) vertical integration from chip design to final assembly. This is why the bull case for Tesla includes a $5T+ valuation."),

    summary("Part 9 Key Takeaways", [
      "Moravec's Paradox is being solved — physical tasks that were easy for humans are now possible for robots",
      "Six serious humanoid robot programs are racing to market, led by Tesla Optimus",
      "Robot economics: $6,000/year vs. $55,000/year for a human worker — under 12-month payback",
      "Sim-to-real transfer is the breakthrough: 10 years of practice in a single day",
      "Total robotics market: $25B today → $79B by 2028, with humanoids the wildcard"
    ]),

    quiz("What is Moravec's Paradox?", [
      "Robots are always more expensive than humans",
      "What is easy for humans (physical tasks) is extremely hard for machines — and vice versa",
      "More robots leads to more human jobs, not fewer",
      "Simulation training is always better than real-world training"
    ], 1, "Moravec's Paradox observes that high-level reasoning (chess, math) is easy for computers but sensorimotor tasks (walking, grasping objects) are extremely difficult. Physical AI and sim-to-real transfer are finally overcoming this paradox."),

    // =====================================================================
    // PART 10: FINANCE DISRUPTION
    // =====================================================================
    chapterIntro(10, "Finance Disruption", "The Algorithm Is the Banker — AI transforms trading, banking, and advisory"),

    concept("The Democratization of Alpha", "Renaissance Technologies' Medallion Fund has generated 66% annualized returns before fees for over 30 years using pure ML and statistical methods. Today, every major fund is AI-first: Two Sigma (10,000+ data signals, 1,600 engineers), Citadel (26% return in 2023, $1B+ AI infrastructure), D.E. Shaw, Man AHL. The edge is not whether you use AI — it is how fast you adopt it."),

    table("AI Quant Hedge Fund Landscape", ["Fund", "AUM ($B)", "AI/ML Focus", "Avg. Annual Return"], [
      ["Renaissance (Medallion)", "$10", "Pure ML / Statistical", "66% (before fees)"],
      ["Two Sigma", "$60", "ML + NLP + Alt Data", "18-22%"],
      ["D.E. Shaw", "$60", "Systematic + Discretionary", "15-20%"],
      ["Citadel", "$65", "Multi-strategy + AI", "26% (2023)"],
      ["Man AHL", "$50", "Trend-following + ML", "12-15%"],
      ["Bridgewater", "$124", "Macro + NLP integration", "8-12%"]
    ]),

    table("AI Banking Use Cases", ["Use Case", "Cost Savings", "Adoption Rate (2025)", "Impact Level"], [
      ["Fraud Detection", "$40B+ prevented/yr", "95%+ of large banks", "Transformative"],
      ["AI Credit Scoring", "25-30% lower defaults", "65% of lenders", "High"],
      ["Automated Loan Origination", "70% cost reduction", "45% of mortgage lenders", "High"],
      ["AML / KYC Compliance", "50% fewer false positives", "80% of top 50 banks", "Medium-High"],
      ["Algorithmic Trading", "15-25% better execution", "100% of top banks", "Transformative"],
      ["Risk Modeling", "30% more accurate VaR", "70% of G-SIBs", "High"]
    ]),

    concept("The Death of the 1% Fee", "Traditional financial advisors charge 1-1.25% of AUM with $250K minimums. Betterment and Wealthfront charge 0.25% with no minimum. Schwab Intelligent Portfolios charges 0%. By 2027, AI advisors will provide real-time, tax-optimized, personalized advice for 0-0.10% AUM with zero minimum. The $500B robo-advisory market will reach $1.5 trillion by 2028. Traditional advisors charging 1% cannot survive."),

    bullets("Alternative Data: The New Edge", [
      "Satellite imagery: parking lot traffic, oil storage levels, crop yields ($100K-$1M/yr)",
      "Credit card transactions: revenue nowcasting, consumer spending trends ($200K-$2M/yr)",
      "Social sentiment: retail positioning, meme stock detection ($10K-$200K/yr)",
      "Web scraping: app downloads, job postings, web traffic ($50K-$500K/yr)",
      "Patent filings: innovation pipeline tracking, competitive intelligence ($20K-$100K/yr)"
    ]),

    warning("Finance Disruption Losers", "Regional banks (no AI budget, branch-heavy costs), traditional wealth advisors (1% AUM fee unsustainable), manual compliance/audit (90% cost reduction via AI AML/KYC), and traditional credit bureaus (FICO challenged by AI alt-data models). Floor traders are already 95% displaced — AI is expanding into the last holdout: illiquid OTC markets."),

    summary("Part 10 Key Takeaways", [
      "Every major hedge fund is now AI-first — the Medallion Fund returned 66% annually for 30 years",
      "300+ banking use cases from fraud detection to algorithmic trading",
      "The 1% advisory fee is dying — robo-advisors charge 0-0.25% with superior tax optimization",
      "Alternative data ($100K-$2M/yr datasets) is the new edge in finance",
      "Regional banks and traditional advisors face existential disruption"
    ]),

    quiz("What is the approximate annual return of Renaissance Technologies' Medallion Fund?", [
      "15% annualized",
      "30% annualized",
      "66% annualized before fees",
      "100% annualized"
    ], 2, "The Medallion Fund has generated approximately 66% annualized returns before fees for over 30 years, making it the most successful investment fund in history — powered by pure machine learning and statistical methods."),

    // =====================================================================
    // PART 11: ENERGY & POWER
    // =====================================================================
    chapterIntro(11, "Energy & Power", "No Electrons = No Intelligence — the AI power crisis and the nuclear renaissance"),

    concept("The AI Power Crisis", "A traditional Google search consumes roughly 0.3 Wh of electricity. A ChatGPT query consumes 3-10 Wh — 10-30x more. AI data center power demand was 35 GW in 2024 and is projected to reach 80-100 GW by 2030 — the entire electricity consumption of France. Utilities are calling this the 'most significant load growth in a generation.' No electrons means no intelligence."),

    bullets("Why AI Uses So Much Power", [
      "A single AI training run (GPT-5 class) consumes 10+ GWh of electricity",
      "AI inference racks draw 40-120 kW per rack vs. 10 kW for traditional servers",
      "Hyperscalers are building energy procurement teams as large as their engineering teams",
      "Data center power demand: 35 GW (2024) → 80-100 GW by 2030",
      "Nuclear is the only source that is simultaneously carbon-free, baseload (90%+ capacity factor), and scalable"
    ]),

    table("Major Nuclear + AI Deals", ["Deal", "Buyer", "Capacity", "Timeline", "Status"], [
      ["Three Mile Island Restart", "Microsoft", "837 MW", "2028", "In Progress"],
      ["Susquehanna DC Campus", "Amazon (AWS)", "960 MW", "2025-2026", "Active"],
      ["Kairos SMR PPA", "Google", "500 MW", "2030-2035", "Development"],
      ["SMR Data Centers", "Oracle", "1 GW+", "2030+", "Announced"],
      ["Palisades Restart", "Holtec", "800 MW", "2025-2026", "In Progress"],
      ["France EPR2 Program", "EDF", "24.7 GW (14 reactors)", "2035-2050", "Planning"]
    ]),

    concept("The Grid Is the Real Bottleneck", "You can build all the generation capacity you want, but if the transmission lines cannot deliver the power, it does not matter. The US grid was built in the 1950s-70s for a distributed generation model. AI data centers need massive, concentrated power feeds. Permitting a new transmission line takes 7-10 years. The grid modernization TAM exceeds $2 trillion. This is why companies like Eaton (transformers, switchgear, UPS) have backlogs at all-time highs."),

    table("Battery Technology Comparison", ["Technology", "Cost ($/kWh)", "Duration", "Key Player", "Status"], [
      ["Lithium-ion (LFP)", "$139", "2-4 hours", "CATL, BYD, Tesla", "Dominant"],
      ["Sodium-ion", "$80-100", "2-4 hours", "CATL, HiNa", "Shipping"],
      ["Iron-air", "~$20 (target)", "100+ hours", "Form Energy", "Pilot 2025"],
      ["Vanadium Flow", "$300-400", "4-12 hours", "Invinity", "Niche Deployed"],
      ["Compressed Air", "$100-150", "8-24 hours", "Hydrostor", "Projects Planned"]
    ]),

    table("Energy Picks for the AI Era", ["Ticker", "Company", "Thesis", "Moat"], [
      ["CEG", "Constellation Energy", "Largest US nuclear fleet (21 GW). Microsoft TMI restart deal.", "Irreplaceable assets"],
      ["VST", "Vistra Corp", "Largest Texas power producer. 6.4 GW nuclear.", "Texas market position"],
      ["ETN", "Eaton Corp", "Transformers, switchgear, UPS for data centers. $2T grid TAM.", "Critical infrastructure"],
      ["FSLR", "First Solar", "Only US-manufactured utility solar. 70+ GW backlog.", "US manufacturing"],
      ["GEV", "GE Vernova", "Most efficient gas turbines globally. Only 3 competitors.", "Oligopoly"]
    ]),

    summary("Part 11 Key Takeaways", [
      "AI data centers consume 10-30x more power per query than traditional search",
      "Power demand: 35 GW today → 80-100 GW by 2030 (the entire output of France)",
      "Nuclear renaissance is real: Microsoft, Amazon, Google, Oracle all signing nuclear PPAs",
      "The grid is the true bottleneck — $2T+ in modernization needed",
      "CEG, VST, ETN are the energy picks; nuclear is the only carbon-free baseload solution"
    ]),

    quiz("How much more electricity does a ChatGPT query consume compared to a Google search?", [
      "About the same amount",
      "2-3x more",
      "10-30x more",
      "100x more"
    ], 2, "A traditional Google search consumes about 0.3 Wh. A ChatGPT query consumes 3-10 Wh — roughly 10 to 30 times more electricity. At billions of queries per day, this creates enormous power demand."),

    // =====================================================================
    // PART 12: LABOR MARKET SHOCK
    // =====================================================================
    chapterIntro(12, "The Labor Market Shock", "300 million jobs exposed — the Great Displacement is here"),

    concept("The Inversion", "Previous technological revolutions displaced blue-collar workers: factory workers, farm hands, assembly line operators. AI inverts this pattern. White-collar, educated, knowledge workers are the primary targets. Call center agents, data entry clerks, translators, paralegals, junior developers, financial analysts, copywriters — the very jobs that required expensive university degrees are the ones being automated first."),

    table("Who Gets Displaced First?", ["Job Category", "Workers (Global)", "Timeline", "Wage Impact", "Example"], [
      ["Call Centers", "17M", "2024-2026", "-60% to -80%", "Klarna replaced 700 agents with AI"],
      ["Data Entry", "12M", "2024-2025", "-90%+ (elimination)", "UiPath replacing entire teams"],
      ["Translation", "0.6M", "2024-2026", "-70% to -90%", "DeepL now near-human quality"],
      ["Paralegal / Legal Research", "1.2M", "2025-2027", "-40% to -60%", "Harvey AI, CaseText"],
      ["Junior Software Dev", "8M", "2025-2028", "-30% to -50%", "GitHub Copilot, Cursor, Devin"],
      ["Financial Analysis (Jr)", "2.5M", "2025-2028", "-35% to -55%", "Bloomberg GPT, JPM IndexGPT"],
      ["Copywriting", "3M", "2024-2026", "-60% to -80%", "Jasper, ChatGPT — commodity content is free"]
    ]),

    bullets("The Productivity Paradox: Real Case Studies", [
      "Klarna: AI bot handles 2/3 of all customer chats — replaced 700 agents, saving $40M/year",
      "BT Group: AI replacing 55,000 jobs by 2030 (-42% of total workforce)",
      "IBM: paused hiring for roles AI can do — 7,800 back-office roles eliminated",
      "Duolingo: replaced 10% of contractors with AI content generation",
      "UPS: AI route optimization + back-office automation cut 12,000 jobs"
    ]),

    concept("The Taste Layer Theory", "In every displaced profession, a thin layer of senior experts will survive and thrive — those with taste, judgment, and client relationships that AI cannot replicate. A senior architect with 20 years of experience who can envision a building will thrive using AI as a superpower. A junior CAD operator whose only skill was drafting is replaced entirely. The value shifts from execution to curation and judgment."),

    concept("The Jevons Paradox", "In 1865, economist William Stanley Jevons observed that as coal-powered steam engines became more efficient, total coal consumption increased rather than decreased — because cheaper energy created new demand. Will the same happen with AI? Cheaper cognition could create new demand for cognitive work that does not yet exist. But this time may be different — AI can potentially do the new jobs too, creating an unprecedented situation in economic history."),

    comparison("Staffing Industry: Before vs. After AI", {
      label: "Before AI",
      items: [
        "Robert Half: $7.2B peak revenue (2022)",
        "ManpowerGroup: $20.7B peak revenue (2022)",
        "Temp staffing = reliable revenue model",
        "White-collar placements = highest margins"
      ]
    }, {
      label: "After AI (2026)",
      items: [
        "Robert Half: $5.1B (-29% from peak), stock -40%",
        "ManpowerGroup: $18.2B (-12% from peak), stock -30%",
        "AI agents eliminate the need for temporary humans",
        "Matching function itself being disrupted by AI"
      ]
    }),

    summary("Part 12 Key Takeaways", [
      "300M+ jobs globally exposed to AI automation by 2030",
      "White-collar workers are the primary targets — an inversion of historical patterns",
      "Klarna replaced 700 agents saving $40M/year; BT cutting 42% of workforce",
      "The 'Taste Layer' survives: senior experts with judgment, not execution skills",
      "Staffing agencies (RHI, MAN) face critical disruption as intermediary value disappears"
    ]),

    quiz("Which company replaced 700 customer service agents with an AI bot?", [
      "Amazon",
      "IBM",
      "Klarna",
      "Uber"
    ], 2, "In February 2024, fintech company Klarna announced that its AI customer service bot was handling two-thirds of all customer chats, effectively replacing 700 full-time agents and saving $40 million in annualized costs."),

    // =====================================================================
    // PART 13: GEOPOLITICS OF AI
    // =====================================================================
    chapterIntro(13, "The Geopolitics of AI", "AI is the new nuclear — the US-China compute arms race and the Silicon Shield"),

    concept("The Compute Curtain", "The US export controls have created what analysts call the 'Compute Curtain' — a digital Iron Curtain dividing the world into those with access to frontier AI compute and those without. Since October 2022, the US has systematically restricted China's access to advanced GPUs (H100, then H800/A800), EUV lithography (via ASML), and now even cloud-based AI compute. The question: does this contain China or accelerate their indigenous innovation?"),

    table("The Chip War Timeline", ["Date", "Event", "Target", "Impact"], [
      ["May 2019", "Huawei added to Entity List", "Huawei", "Phone sales crater outside China"],
      ["Oct 2022", "Sweeping semiconductor export controls", "All China AI", "NVDA loses ~$15B China access"],
      ["Jan 2023", "Netherlands & Japan join controls", "ASML, Tokyo Electron", "EUV banned to China"],
      ["Oct 2023", "Updated rules close loopholes", "H800, A800 chips", "China-specific GPUs also banned"],
      ["Jan 2025", "DeepSeek V3 shocks the world", "US compute thesis", "Matches GPT-4 with fraction of compute — NVDA -17%"],
      ["Q1 2026", "Controls on AI model weights & cloud", "Cloud providers", "MSFT, AMZN, GOOG restricted"]
    ]),

    concept("The Silicon Shield", "Taiwan's semiconductor monopoly functions as a 'Silicon Shield' — the theory that the world's economic dependence on TSMC makes a Chinese invasion irrational. TSMC fabricates 90%+ of the world's most advanced chips. Destroying or capturing TSMC would crash the global economy. But this theory was not tested until recently, and every major power is now building alternative fab capacity — TSMC Arizona, Samsung Texas, Intel Ohio — as insurance."),

    table("Sovereign AI: Every Nation Wants Its Own", ["Nation", "Budget", "Key Players", "Strategic Goal"], [
      ["Saudi Arabia", "$100B+", "NEOM, Aramco Digital", "Post-oil economy, AI as Vision 2030"],
      ["UAE", "$30B+", "G42, TII (Falcon LLM)", "Regional AI hub"],
      ["India", "$15B", "Reliance Jio AI, IndiaAI Mission", "AI for 1.4B population"],
      ["France", "EUR 7B", "Mistral AI, Scaleway", "European AI sovereignty"],
      ["Japan", "$14B", "Preferred Networks, SakanaAI", "Address demographic crisis"],
      ["UK", "GBP 3.5B", "DeepMind, AI Safety Institute", "Post-Brexit tech differentiation"]
    ]),

    bullets("Defense AI: The Ukraine Laboratory", [
      "Ukraine has become the world's laboratory for AI warfare: autonomous drones, ISR, electronic warfare",
      "Palantir (PLTR): Gotham intelligence + AIP platform, $2.8B+ revenue, US Gov = 55%",
      "Anduril (private): Lattice OS, Altius drones, $1.5B+ ARR, Palmer Luckey-founded",
      "AeroVironment (AVAV): Switchblade loitering munitions, battle-proven in Ukraine",
      "Shield AI (private): Hivemind AI pilot, autonomous drone swarms without GPS",
      "NATO spending surge + Replicator program = massive tailwind for defense AI"
    ]),

    warning("The DeepSeek Shock", "In January 2025, Chinese lab DeepSeek released V3, which matched GPT-4 performance with a fraction of the compute. NVIDIA stock dropped 17% in a single day. This shattered the assumption that export controls would keep China 3-5 years behind. It also proved that algorithmic efficiency — not just raw compute — is a viable path to frontier AI. The compute moat is real but not impenetrable."),

    summary("Part 13 Key Takeaways", [
      "The 'Compute Curtain' divides the world into AI haves and have-nots",
      "DeepSeek proved China can match US models with less compute — export controls accelerate innovation",
      "The Silicon Shield: TSMC's monopoly makes Taiwan invasion economically irrational",
      "Every major nation is building sovereign AI capability — bullish for infrastructure",
      "Defense AI is booming: PLTR, Anduril, AVAV are the key plays"
    ]),

    quiz("What happened when DeepSeek V3 was released in January 2025?", [
      "NVIDIA stock rose 20% on increased demand expectations",
      "China announced it was abandoning its AI program",
      "It matched GPT-4 with a fraction of compute — NVIDIA dropped 17%",
      "The US imposed additional export controls immediately"
    ], 2, "DeepSeek V3 matched GPT-4 performance using significantly less compute than expected, challenging the thesis that raw compute advantage is unassailable. NVIDIA stock dropped 17% in a single day as investors feared the demand thesis was weakened."),

    // =====================================================================
    // PART 14: THE LOSERS & OBSOLESCENCE
    // =====================================================================
    chapterIntro(14, "The Losers & Obsolescence", "If your business is middleman arbitrage, your stock is going to zero"),

    concept("The Innovator's Dilemma", "Clayton Christensen's 1997 classic explains why well-managed, customer-focused incumbents are rational to ignore disruptive technologies — until it is too late. Kodak invented the digital camera in 1975 but shelved it to protect film revenue. Blockbuster turned down buying Netflix for $50M in 2000. Nokia dismissed the iPhone as a gimmick. The pattern repeats — and AI disruption is 3x faster than any before it."),

    table("Historical Disruption Case Studies", ["Incumbent", "Disruptor", "Peak Valuation", "Time to Obsolescence", "Key Mistake"], [
      ["Kodak", "Digital cameras / Smartphones", "$31B (1997)", "~15 years", "Invented digital camera but shelved it"],
      ["Blockbuster", "Netflix", "$5B (2004)", "~10 years", "Turned down Netflix for $50M"],
      ["Nokia", "iPhone / Android", "$250B (2007)", "~6 years", "Dismissed capacitive touch"],
      ["BlackBerry", "iPhone / Android", "$83B (2008)", "~5 years", "Believed keyboard moat was unbreachable"],
      ["BPO/IT Services", "AI Agents (2024+)", "$250B sector", "~3-5 years (est.)", "Software disruption is 3x faster"]
    ]),

    bullets("BPO / Outsourcing: The Revenue Collapse Timeline", [
      "Phase 1 (2024-2025): New contract growth slows, AI pilots erode incremental headcount",
      "Phase 2 (2026-2027): Existing contracts not renewed — enterprise agents replace outsourced teams",
      "Phase 3 (2028-2030): Mass layoffs, consolidation, structural decline to utility status",
      "Revenue formula at risk: (employees) x (billing rate) x (utilization) = revenue → AI breaks every variable"
    ]),

    table("The Zero List: Companies Heading to Zero", ["Ticker", "Company", "Market Cap", "AI Threat", "Timeline", "Conviction"], [
      ["CHGG", "Chegg", "~$250M", "Terminal", "12-24 months", "Very High"],
      ["TTEC", "TTEC Holdings", "~$200M", "Terminal", "18-36 months", "Very High"],
      ["LZ", "LegalZoom", "~$1.3B", "Severe", "24-48 months", "High"],
      ["GETY", "Getty Images", "~$700M", "Severe", "24-48 months", "High"],
      ["WIT", "Wipro", "~$28B", "High", "36-60 months", "Medium-High"],
      ["FVRR", "Fiverr", "~$900M", "High", "24-48 months", "Medium"]
    ]),

    warning("Media & Content Casualties", "Getty Images: -90% from peak — AI image generation replaces stock photos. Shutterstock: -86% from peak. Fiverr: -93% — logo design, copywriting, translation gigs automated. Upwork: -81% — entry-level freelance work displaced. Gannett: -78% — local news summarized by AI, ad revenue migrating. Chegg: -99% from peak — the ultimate canary in the coal mine."),

    concept("How to Short Disruption", "Short selling is hard: timing is uncertain, squeeze risk is real, and being early looks identical to being wrong. Charlie Munger said 'being short and seeing a promoter take the stock up is very irritating.' Rules: use put options (defined risk), size positions 1-2% max, cover if a short rallies 35%+, and consider pair trades — long the disruptor, short the disrupted — to reduce directional exposure."),

    steps("Position Sizing Rules for Shorts", [
      { step: "Maximum 2% portfolio per short", detail: "Asymmetric risk — stocks can go up infinitely, only down 100%" },
      { step: "Cover if rally exceeds 35%", detail: "Do not fight the market. Re-evaluate thesis before re-entering" },
      { step: "Use put options when available", detail: "Defined risk — max loss is the premium paid" },
      { step: "Pair with long positions", detail: "Long MSFT / Short WIT reduces directional exposure" },
      { step: "Monitor short interest", detail: "Crowded shorts (>20% SI) face squeeze risk" }
    ]),

    summary("Part 14 Key Takeaways", [
      "The Innovator's Dilemma is repeating: incumbents rationally ignore AI until too late",
      "Time to obsolescence is compressing: 15 years (Kodak) → 6 years (Nokia) → 3-5 years (BPO)",
      "Chegg (-99%), Getty (-90%), Fiverr (-93%): middleman businesses being destroyed",
      "BPO/IT services ($250B sector) faces structural decline in 3-5 years",
      "Short selling requires strict risk management: defined risk, 2% max, cover rules"
    ]),

    quiz("What is Clayton Christensen's 'Innovator's Dilemma'?", [
      "Innovative companies always succeed because they take risks",
      "Well-managed incumbents rationally ignore disruptive tech until it is too late",
      "Startups always beat large companies in every market",
      "Innovation always benefits shareholders in the short term"
    ], 1, "The Innovator's Dilemma explains why well-managed, customer-focused incumbents are rational to ignore disruptive technologies — because their existing customers do not want them and the initial market is too small. By the time the disruption scales, it is too late to respond."),

    // =====================================================================
    // PART 15: CONCLUSION — THE SINGULARITY 20 PORTFOLIO
    // =====================================================================
    chapterIntro(15, "Conclusion: The Singularity 20 Portfolio", "The final model portfolio, risk management, and the 2030 end-state"),

    concept("Portfolio Philosophy: Antifragility", "Nassim Nicholas Taleb's concept: systems that gain from disorder. Our portfolio is structured to benefit from volatility, not just survive it. 70% Core Positions (high conviction, lower risk), 20% High-Conviction Bets (potential 3-5x), 10% Hedges & Cash (protection + dry powder). The hedges bucket ensures the portfolio makes money even when the AI thesis faces temporary setbacks."),

    table("The Singularity 20 — Core Holdings", ["Ticker", "Company", "Category", "Weight", "Entry Zone", "Risk"], [
      ["NVDA", "NVIDIA", "Compute", "5%", "$110-130", "Medium"],
      ["TSM", "TSMC", "Compute", "4%", "$160-185", "Med-High"],
      ["AVGO", "Broadcom", "Compute", "4%", "$180-210", "Medium"],
      ["AMD", "AMD", "Compute", "3%", "$100-125", "Med-High"],
      ["MSFT", "Microsoft", "Software", "5%", "$380-420", "Low"],
      ["PLTR", "Palantir", "Software", "4%", "$60-80", "Med-High"],
      ["CRM", "Salesforce", "Software", "3%", "$270-310", "Medium"],
      ["CRWD", "CrowdStrike", "Software", "3%", "$300-350", "Medium"]
    ]),

    table("The Singularity 20 — Energy, Physical, Defense", ["Ticker", "Company", "Category", "Weight", "Entry Zone", "Risk"], [
      ["CEG", "Constellation Energy", "Energy", "4%", "$200-250", "Medium"],
      ["VST", "Vistra", "Energy", "3%", "$100-130", "Medium"],
      ["ETN", "Eaton Corp", "Energy", "3%", "$280-320", "Low-Med"],
      ["TSLA", "Tesla", "Physical AI", "4%", "$250-320", "High"],
      ["UBER", "Uber", "Physical AI", "3%", "$65-80", "Medium"],
      ["ISRG", "Intuitive Surgical", "Physical AI", "3%", "$500-560", "Low-Med"],
      ["LMT", "Lockheed Martin", "Defense", "3%", "$450-520", "Low"],
      ["PANW", "Palo Alto Networks", "Defense", "3%", "$170-200", "Medium"]
    ]),

    table("The Hedges", ["Ticker", "Company", "Type", "Weight", "Thesis"], [
      ["RHI", "Robert Half (Short)", "Hedge", "-2%", "White-collar staffing in structural decline"],
      ["CHGG", "Chegg (Short)", "Hedge", "-2%", "Terminal business — ChatGPT is free Chegg"],
      ["GETY", "Getty Images (Short)", "Hedge", "-1%", "AI image generation makes stock photos obsolete"],
      ["SGOV/Cash", "T-Bills", "Cash", "10%", "Dry powder for 30%+ drawdowns, earns 4-5%"]
    ]),

    steps("Rebalancing Rules", [
      { step: "Winner Trim", detail: "Any position exceeding 15% → trim to 10%. Redeploy to lagging sectors." },
      { step: "Trailing Stop (High-Beta)", detail: "TSLA, PLTR, AMD down 20% from 52-week high → reduce by 50%." },
      { step: "Sector Cap", detail: "Any sector exceeding 25% → trim the most overweight name." },
      { step: "Cash Deployment", detail: "Portfolio drawdown >15% → deploy 50% of cash into NVDA, MSFT, CEG." },
      { step: "Short Cover", detail: "Short rallies 35%+ → cover immediately. Re-evaluate before re-entering." }
    ]),

    table("Scenario Analysis: 5-Year Outcomes", ["Metric", "Bull Case", "Base Case", "Bear Case"], [
      ["AI Adoption Rate", "Faster — AGI by 2028", "Steady acceleration", "Plateau — scaling diminishes"],
      ["Portfolio CAGR", "+45%", "+22%", "-15% then recovery"],
      ["Max Drawdown", "-20%", "-35%", "-55%"],
      ["$100K Becomes", "$640K", "$270K", "$160K (after recovery)"],
      ["Key Winners", "NVDA +300%, PLTR +400%", "MSFT +80%, NVDA +120%", "LMT +40%, Shorts profitable"]
    ]),

    concept("The Kelly Criterion for Position Sizing", "John Kelly's formula from 1956 provides mathematically optimal bet sizing: f* = (bp - q) / b, where b is odds, p is probability of winning, q is probability of losing. For a position with 60% win probability and 2:1 payoff, Kelly says bet 40% of bankroll. But full Kelly is too aggressive for investing — use half-Kelly (20%) as maximum for highest-conviction positions."),

    steps("Implementation Guide", [
      { step: "Account Structure", detail: "Tax-advantaged (IRA/401k) for high-turnover shorts and tax-loss harvesting. Taxable for long-term holds." },
      { step: "Dollar-Cost Averaging", detail: "Do not deploy 100% at once. Build positions over 3-6 months. Accelerate buying on 10%+ dips." },
      { step: "Order Discipline", detail: "Use limit orders only. Never market orders on wide spreads. Scale into positions in 3-4 tranches." },
      { step: "Annual Review", detail: "Re-evaluate every position against thesis. Replace invalidated names with next-best candidate from same category." }
    ]),

    quote("The future is already here — it is just not evenly distributed.", "William Gibson"),

    tip("The Correlation Insight", "Energy (CEG, VST, ETN) has only 0.28-0.35 correlation with Software and Compute. When tech sells off — which happened brutally in 2022 — energy positions provided a cushion. The short basket profits during broad market selloffs. This is not just diversification — it is structural portfolio antifragility."),

    bullets("Series Recap: 15 Parts, One Thesis", [
      "Part 1-2: AI compute is scaling 16x Moore's Law. $336B capex in 2025. NVDA dominates.",
      "Part 3: Autonomous agents reprice all knowledge work. BPO is dying.",
      "Part 4: AI cuts drug development cost 5-10x. Biology becomes computable.",
      "Part 5: Content creation costs collapse 99%. IP owners win, middlemen lose.",
      "Part 6: Robotaxis at $0.25/mile make car ownership irrational.",
      "Part 7: AI tutors solve Bloom's 2-Sigma Problem at 0.1% the cost.",
      "Part 8: Cybercrime hits $15.3T by 2027. More AI = more attack surface = more demand.",
      "Part 9: Humanoid robots target a $30-50T labor market. Moravec's Paradox finally solved.",
      "Part 10: Every major hedge fund is AI-first. The 1% advisory fee is dying.",
      "Part 11: AI needs 80-100 GW by 2030. Nuclear renaissance is real.",
      "Part 12: 300M+ jobs exposed. White-collar workers are the primary targets.",
      "Part 13: US-China Compute Curtain. DeepSeek shocked the world.",
      "Part 14: Middleman businesses going to zero. Time to obsolescence compressing.",
      "Part 15: The Singularity 20 portfolio — 20 positions for the next decade."
    ]),

    summary("The Final Word", [
      "The AI Singularity Trade is not a stock tip — it is a structural thesis about the next decade",
      "20 positions: 16% Compute, 15% Software, 10% Energy, 10% Physical AI, 6% Defense, -5% Shorts, 10% Cash",
      "Bull case: $100K → $640K in 5 years (CAGR +45%)",
      "Base case: $100K → $270K in 5 years (CAGR +22%)",
      "The future is already here. The only question is: are you positioned for it?"
    ]),

    quiz("In the Singularity 20 portfolio, what percentage is allocated to cash/T-bills as dry powder?", [
      "0% — fully invested at all times",
      "5%",
      "10%",
      "20%"
    ], 2, "The portfolio allocates 10% to SGOV/Cash (T-Bills) as dry powder for 30%+ drawdowns. This cash earns 4-5% risk-free while waiting to be deployed into highest-conviction names at pre-defined entry zones during market corrections."),

    quote("The best time to invest in a revolution is before the revolution is obvious. The second best time is now.", "AI Singularity Trade Series")

  ];
}

// ════════════════════════════════════════════════════════════════════
// SERIES: SWING TRADING RENTABLE (2h, ~180 slides, FR)
// Source: series/swing-mode/ (6 articles)
// ════════════════════════════════════════════════════════════════════

function generateSwingTrading() {
  slideIndex = 0;
  const slides = [];

  // ════════════════════════════════════════════════════════════════
  // TARGET: ~180 slides, ~13,000 words narration = ~2h at 110 wpm FR
  // Quizzes every ~25-30 slides = 7 quizzes minimum
  // Style: dynamique, abordable, didactique, tout public, français
  // 6 chapitres = 6 parties de la série Swing Mode
  // ════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════
  // CHAPITRE 1 : LE SETUP — TON POSTE DE TRADING (~30 slides, ~20 min)
  // ══════════════════════════════════════════════════════════════════

  slides.push(chapterIntro(1, 6, 'Le Setup — Ton Poste de Trading', 'Définition du swing trading, statistiques réalistes, choix du broker, outils gratuits, et philosophie des 4 positions décorrélées'));

  slides.push(concept('Bienvenue dans Swing Mode', 'Bienvenue dans cette formation complète sur le swing trading. En deux heures, on va couvrir absolument tout ce dont tu as besoin pour passer de zéro à rentable. Pas de promesses bidon, pas de screenshots de gains truqués. Juste une méthode structurée, éprouvée, que tu peux appliquer avec un job à temps plein et 15 minutes par jour. Cette formation couvre 6 parties : le setup, le scanner, les 3 stratégies, les alertes, la gestion de position, et la routine. C\'est parti.'));

  slides.push(concept('C\'est quoi le swing trading ?', 'Le swing trading, c\'est le juste milieu entre le day trading et l\'investissement long terme. Tu gardes tes positions entre quelques jours et quelques semaines — assez longtemps pour capter un mouvement de prix, mais pas assez pour t\'endormir dessus. Contrairement au day trading, tu n\'as pas besoin d\'être collé à ton écran toute la journée. Tu scannes le marché le soir en 15 minutes, tu places tes ordres, et tu vis ta vie. C\'est le meilleur rapport effort-rendement pour un particulier.'));

  slides.push(table('Swing Trading vs Day Trading vs Investissement', ['Critère', 'Day Trading', 'Swing Trading', 'Investissement'], [
    ['Durée', 'Minutes à heures', 'Jours à semaines', 'Mois à années'],
    ['Temps écran/jour', '6-8h minimum', '15-30 minutes', '5 min/semaine'],
    ['Capital minimum', '25 000$ (PDT rule)', '2 000 à 5 000$', '100$ et plus'],
    ['Win rate typique', '40-50%', '45-55%', 'Non applicable'],
    ['Risk/Reward cible', '1:1.5', '1:2 à 1:3', 'Non applicable'],
    ['Stress', 'Très élevé', 'Modéré', 'Faible'],
    ['Compatible avec un job', 'Non', 'Oui', 'Oui'],
  ]));

  slides.push(concept('Pourquoi le swing ?', 'Le swing trading est le style le plus adapté si tu as un job, des études ou une vie. Pas besoin de 6 écrans, pas besoin de 25 000 dollars de capital minimum comme le PDT rule l\'exige pour le day trading aux États-Unis. Tu analyses le marché le soir, tu places tes alertes, et tu ne regardes ton téléphone que quand TradingView te prévient. C\'est 15 à 30 minutes par jour. Pas plus.'));

  slides.push(concept('Les vrais chiffres — pas de bullshit', 'Oublie les screenshots de plus 500% sur Twitter. Voilà les vrais chiffres d\'un swing trader discipliné sur des actions matures. Win rate : 45 à 55%. Ça veut dire que tu perds presque la moitié de tes trades. Et c\'est normal. Le secret, c\'est le risk-reward : tu vises 1:2 minimum. Quand tu gagnes, tu gagnes 2 fois plus que quand tu perds. Rendement annuel réaliste : 10 à 30%. Max drawdown : moins 15%. C\'est la réalité.'));

  slides.push(concept('L\'espérance mathématique', 'La formule magique du swing trader, c\'est l\'espérance mathématique. E égale le win rate multiplié par le gain moyen, moins le loss rate multiplié par la perte moyenne. Avec un win rate de 50% et un ratio risk-reward de 1:2, ton espérance est positive. Tu perds la moitié de tes trades, mais tu gagnes 2 fois plus quand tu as raison. C\'est la magie du money management. Un trader avec 40% de win rate et un ratio de 1:3 gagne plus qu\'un trader avec 60% de win rate et un ratio de 1:1.'));

  slides.push(warning('Année 1 — Sois réaliste', 'La première année, 80% des débutants perdent de l\'argent. Ton objectif n\'est pas de devenir riche. C\'est de survivre et d\'apprendre. Vise le breakeven la première année, 10 à 15% la deuxième. Si tu fais 20% ou plus régulièrement après 2 ans, tu es dans le top 10% des traders particuliers.'));

  slides.push(concept('Choisir son broker', 'Le broker, c\'est ton outil numéro un. Tu fais 4 à 8 trades par mois, pas 50 par jour. Ce qui compte : des frais bas, l\'accès aux marchés US et européens, des ordres conditionnels comme le stop loss et l\'OCO, et un PEA si tu es résident fiscal français pour la fiscalité à 17,2% au lieu de 30%. Notre recommandation : Interactive Brokers pour le CTO, c\'est le standard professionnel. Et Bourse Direct ou Saxo pour le PEA si tu es en France.'));

  slides.push(table('Comparatif Brokers', ['Broker', 'Frais US', 'Frais EU', 'PEA', 'Note'], [
    ['Interactive Brokers', '1$/ordre', '~4€/ordre', 'Non', 'Le meilleur global'],
    ['DEGIRO', '1€/ordre', '2€/ordre', 'Non', 'Budget EU'],
    ['Trade Republic', '1€/ordre', '1€/ordre', 'Non', 'Ultra simple'],
    ['Saxo Banque', '~8€/ordre', '~5€/ordre', 'Oui', 'PEA complet'],
    ['Bourse Direct', 'N/A', '~2€/ordre', 'Oui', 'PEA pas cher'],
  ]));

  slides.push(bullets('Tes outils de swing trader — le kit essentiel', [
    'TradingView : charts, indicateurs, alertes. Le plan gratuit suffit pour commencer. Ajoute les EMA 21, 50 et 200 plus le RSI 14.',
    'Finviz : screener gratuit ultra-puissant. Filtre par secteur, performance, volume, patterns techniques.',
    'Calendrier économique : Investing.com ou ForexFactory. Les annonces macro comme le CPI, le FOMC ou le NFP impactent toutes tes positions.',
    'Google Sheets : ton journal de trading. Gratuit, collaboratif, et tu peux automatiser avec des formules.',
    'Earnings Whispers : calendrier des résultats trimestriels. Crucial pour éviter de tenir un swing pendant un earnings.',
  ]));

  slides.push(tip('Setup minimaliste pour démarrer. Jour 1 : TradingView gratuit plus ton broker plus Google Sheets. C\'est tout. Tu ajouteras Finviz et le calendrier économique la semaine 2 quand tu commenceras à scanner. N\'achète aucun abonnement payant avant d\'avoir fait 50 trades.'));

  slides.push(concept('L\'IA comme copilote — pas comme pilote', 'L\'intelligence artificielle ne remplace pas ton jugement. Elle accélère ton workflow. Un scanner automatique peut détecter le régime de marché et proposer les meilleurs candidats du jour. Un outil d\'analyse peut te donner 30 métriques sur un ticker en quelques secondes. Mais c\'est toi qui appuies sur le bouton. L\'IA est un outil d\'aide à la décision, pas un oracle. Ne délègue jamais la décision finale. C\'est ton argent, c\'est ta responsabilité.'));

  slides.push(concept('Pourquoi on trade des actions de 20 ans et plus', 'Notre philosophie est claire : on ne swing trade que des actions cotées depuis au moins 20 ans. Pourquoi ? Parce qu\'une action qui a survécu 20 ans a prouvé quelque chose. Elle a traversé au moins 2 récessions, une crise majeure et des dizaines de corrections. Elle a 20 ans de données techniques, ce qui rend les supports et résistances fiables. Elle est liquide, couverte par les analystes, et son drawdown est limité. On ne trade pas de penny stocks, de SPACs, d\'IPOs récentes ou de meme stocks. Ces instruments ont trop de bruit et pas assez d\'historique.'));

  slides.push(concept('Max 4 positions décorrélées', 'Pourquoi maximum 4 positions ? Parce que c\'est le sweet spot entre diversification et concentration. Avec une seule position, tu as un risque maximum et un stress intense. Avec 10 positions, tu dilues tes meilleures idées et tu gères un quasi-ETF. 4, c\'est le juste milieu. Mais attention : 4 positions, ça ne suffit pas si elles sont corrélées. Si tes 4 trades sont 4 techs américaines, tu as en réalité un seul trade sur le NASDAQ. L\'objectif : une corrélation inférieure à 0,5 entre chaque paire.'));

  slides.push(bullets('Exemple de portefeuille décorrélé', [
    'Position 1 : MSFT — Tech US, beta 1.1',
    'Position 2 : TotalEnergies — Énergie EU, beta 0.8',
    'Position 3 : JNJ — Santé US, beta 0.5',
    'Position 4 : SAP — Tech EU, beta 1.05',
    'Chaque position dans un secteur différent, mix US et Europe, mix beta défensif et offensif.',
  ]));

  slides.push(comparison('Les réseaux sociaux : le bon et le toxique',
    { label: 'Utile (veille)', items: ['Flux d\'actualité rapide sur X/FinTwit', 'Due diligence communautaire sur Reddit', 'Tutoriels techniques sur YouTube', 'Communautés de partage de setups sur Discord'] },
    { label: 'Toxique (à fuir)', items: ['Pump and dump sur Telegram', 'Faux gourous avec screenshots truqués', 'Signaux payants bidons', 'Prédictions catastrophistes en boucle', 'Formations "deviens riche en 3 mois"'] }
  ));

  // Quiz 1 (~slide 18)
  slides.push(quiz(
    'Quel est le capital minimum requis pour le swing trading ?',
    ['25 000 dollars comme le day trading', '2 000 à 5 000 dollars', '100 000 dollars', 'Il n\'y a pas de minimum'],
    1,
    'Le swing trading ne nécessite que 2 000 à 5 000 dollars pour démarrer. La règle PDT des 25 000 dollars ne s\'applique qu\'au day trading aux États-Unis.'
  ));

  slides.push(summary('À retenir — Chapitre 1', [
    'Le swing trading, c\'est 15 à 30 minutes par jour, compatible avec un job.',
    'Win rate de 45-55% avec un risk-reward de 1:2 minimum. L\'espérance mathématique fait le travail.',
    'Broker recommandé : IBKR pour le CTO, Bourse Direct pour le PEA.',
    'Outils gratuits : TradingView, Finviz, Google Sheets, calendrier économique.',
    'Max 4 positions décorrélées, uniquement sur des actions cotées 20 ans et plus.',
    'L\'IA est un copilote, pas un pilote. C\'est toi qui décides.',
  ]));

  // ══════════════════════════════════════════════════════════════════
  // CHAPITRE 2 : LE SCANNER — TROUVER LES BONS COUPS (~30 slides, ~20 min)
  // ══════════════════════════════════════════════════════════════════

  slides.push(chapterIntro(2, 6, 'Le Scanner — Trouver les Bons Coups', 'Construire ton univers de 40 tickers, scanner en 5 à 10 minutes par jour, filtres techniques, watchlist et décorrélation'));

  slides.push(concept('Ton univers de trading : 40 tickers', 'Tu ne peux pas scanner 5 000 actions par jour. Tu n\'en as pas besoin. Notre univers est filtré, mature et décorrélé : environ 40 tickers US et européens, tous cotés depuis plus de 20 ans, liquides, avec un historique technique exploitable. C\'est ton terrain de chasse permanent. Avec 40 valeurs, tu connais chaque action par coeur au bout de quelques semaines : ses supports, ses résistances, son comportement autour des earnings, sa corrélation sectorielle.'));

  slides.push(table('L\'univers de trading US et EU', ['Secteur', 'US (~20 tickers)', 'EU (~20 tickers)'], [
    ['Tech', 'MSFT, AAPL, GOOGL, AMZN, ORCL', 'SAP, ASML, Dassault Systèmes, Capgemini'],
    ['Santé', 'JNJ, UNH, PFE, ABT, MRK', 'Sanofi, Roche, Novartis, AstraZeneca'],
    ['Consommation', 'PG, KO, HD, MCD', 'LVMH, Nestlé, L\'Oréal, Unilever'],
    ['Finance', 'JPM, GS, BAC', 'Allianz, BNP Paribas, HSBC'],
    ['Énergie', 'XOM, CVX', 'TotalEnergies, Shell, BP'],
    ['Industrie', 'CAT, HON, UNP', 'Siemens, Air Liquide, Schneider'],
  ]));

  slides.push(concept('Le scan quotidien — 5 à 10 minutes', 'Chaque soir ou avant l\'ouverture, tu passes 5 à 10 minutes maximum pour scanner ton univers. L\'objectif n\'est pas de tout analyser en profondeur. C\'est de repérer les anomalies qui méritent un deuxième regard. Tu vérifies le régime de marché via le VIX, tu checkes tes alertes TradingView, tu consultes le calendrier des earnings, tu notes les gaps overnight, et tu mets à jour ta watchlist. C\'est tout. Et surtout : mets un timer. Le piège du scan quotidien, c\'est de tomber dans un rabbit hole de deux heures.'));

  slides.push(steps('La routine de scan quotidien en 5 étapes', [
    { number: 1, title: 'Régime marché', description: 'VIX supérieur à 25 égale prudence. SPY sous l\'EMA 50 égale mode défensif. 30 secondes.' },
    { number: 2, title: 'Alertes TradingView', description: 'Tes alertes pré-configurées sur les EMA, le RSI et le volume t\'envoient les signaux automatiquement.' },
    { number: 3, title: 'Calendrier earnings', description: 'Vérifie si un de tes tickers publie ses résultats cette semaine. Si oui, pas de swing dessus.' },
    { number: 4, title: 'Gaps overnight', description: 'Un gap de plus ou moins 3% sur un de tes tickers ? Note-le pour analyse approfondie.' },
    { number: 5, title: 'Mise à jour watchlist', description: 'Ajoute les nouveaux candidats, retire ceux qui ont touché leur cible ou leur stop.' },
  ]));

  slides.push(concept('Le scan hebdomadaire — 30 minutes le dimanche', 'Le samedi ou dimanche, tu prends 30 minutes pour passer tes 40 tickers en revue sur le graphique weekly. C\'est la session la plus importante de la semaine. Tu cherches les configurations de moyen terme. L\'EMA 21 weekly te donne la tendance court terme. L\'EMA 50, la tendance intermédiaire. Un croisement EMA 21 sur 50, c\'est un signal fort. Tu cherches aussi les patterns de consolidation : drapeaux, triangles, ranges. Quand ça comprime, ça finit par exploser.'));

  slides.push(concept('Le scan mensuel — 1 heure de recul', 'Une fois par mois, tu prends du recul pour comprendre la big picture. Quels secteurs sont en rotation ? Où va l\'argent institutionnel ? Tu analyses la rotation sectorielle, le cycle économique, le breadth du marché et les flux institutionnels. Le cycle classique : début de cycle, les financières et les industrielles mènent. Mid-cycle, la tech et la consommation accélèrent. Fin de cycle, l\'énergie et les matériaux montent. En récession, la santé et les staples résistent. Savoir où tu es dans le cycle te dit quels secteurs scanner en priorité.'));

  slides.push(concept('Les 3 filtres essentiels', 'Tu n\'as besoin que de 3 critères techniques pour filtrer 90% du bruit. Filtre un : le volume doit être supérieur à 1,5 fois la moyenne 20 jours. Sans volume, un mouvement de prix est suspect. Filtre deux : le RSI 14 doit être entre 30 et 70, idéalement entre 40 et 60. On évite les extrêmes. Filtre trois : le prix doit être au-dessus de l\'EMA 50 pour un swing long. Les trois doivent être réunis. Si un seul manque, tu passes. Il y aura toujours un autre setup demain.'));

  slides.push(concept('Finviz — ton screener gratuit', 'Sur finviz.com, configure ces filtres : Market Cap en Large et Mega pour éliminer les small caps. Average Volume supérieur à 1 million pour la liquidité. IPO Date à plus de 20 ans, notre règle d\'or. RSI 14 entre 30 et 70 pour la zone neutre. Prix au-dessus de la SMA 50 pour la tendance haussière. Et Relative Volume supérieur à 1,5 pour le volume au-dessus de la moyenne. Sauvegarde ce preset. Tu l\'ouvres chaque soir en 30 secondes.'));

  slides.push(concept('La watchlist active : 15 à 20 valeurs', 'Ton univers de 40 tickers, c\'est ta liste longue. Ta watchlist active, c\'est une liste courte de 15 à 20 valeurs qui montrent des signes intéressants cette semaine. Chaque dimanche, tu mets cette liste à jour. Le plus important : la colonne Notes. C\'est là que tu écris ce que tu attends pour agir. Par exemple : attendre le pullback sur l\'EMA 21, ou breakout au-dessus de 180 dollars, ou bien éviter car earnings dans 5 jours. Chaque ligne doit répondre à la question : qu\'est-ce qui me ferait entrer ?'));

  slides.push(concept('Vérifier la décorrélation', 'Avant de prendre un trade, vérifie qu\'il ne fait pas doublon avec une position existante. La règle : corrélation entre deux positions inférieure à 0,5, c\'est OK. Supérieure à 0,7, c\'est un doublon. Par exemple, Tech plus Healthcare, corrélation à 0,35, bonne décorrélation. Énergie plus Tech, corrélation à 0,20, excellente. Mais MSFT plus SAP, corrélation à 0,72, attention, c\'est un quasi-doublon sectoriel même si l\'un est US et l\'autre européen.'));

  slides.push(bullets('Les 4 faux positifs à éliminer', [
    'Breakout sans volume : le prix casse une résistance mais le volume est inférieur à la moyenne. 70% de ces breakouts échouent dans les 3 jours.',
    'Gap du week-end : les gaps d\'ouverture le lundi matin sont souvent comblés dans la journée. Attends 30 minutes de confirmation.',
    'Mouvement pré-earnings : un ticker qui monte de 5% avant ses résultats, c\'est de l\'anticipation spéculative, pas un signal technique.',
    'Piège de rotation : un secteur entier monte de 3% sur une journée ? C\'est souvent un short squeeze sectoriel. Attends 2-3 jours pour confirmer.',
  ]));

  slides.push(tip('La règle des 24 heures : quand tu repères un signal intéressant, ne trade pas immédiatement. Note le ticker, le prix, le setup, et reviens 24 heures plus tard. Si le signal est toujours valide le lendemain, c\'est un vrai setup. Si le prix est déjà reparti dans l\'autre sens, tu viens d\'éviter un faux positif.'));

  // Quiz 2 (~slide 33)
  slides.push(quiz(
    'Parmi ces 3 filtres de scan, lequel confirme la participation des institutionnels ?',
    ['Le RSI entre 30 et 70', 'Le prix au-dessus de l\'EMA 50', 'Le volume supérieur à 1,5 fois la moyenne 20 jours', 'Les Bollinger Bands'],
    2,
    'Un volume supérieur à 1,5 fois la moyenne 20 jours signifie que les gros joueurs sont présents. Sans volume, un mouvement de prix est suspect et probablement du bruit retail.'
  ));

  slides.push(summary('À retenir — Chapitre 2', [
    'Univers de trading limité à 40 tickers matures et décorrélés, US et EU.',
    'Scan quotidien en 5-10 minutes : régime, alertes, earnings, gaps, watchlist.',
    'Scan hebdomadaire en 30 minutes sur les graphiques weekly. Scan mensuel en 1 heure pour la big picture.',
    '3 filtres essentiels : volume supérieur à 1,5x, RSI entre 30 et 70, prix au-dessus de l\'EMA 50.',
    'Watchlist active de 15-20 valeurs avec des notes d\'action précises.',
    'Toujours vérifier la décorrélation avant d\'entrer. Corrélation supérieure à 0,7 c\'est un doublon.',
  ]));

  // ══════════════════════════════════════════════════════════════════
  // CHAPITRE 3 : LES 3 STRATÉGIES — PAR LA PRATIQUE (~35 slides, ~25 min)
  // ══════════════════════════════════════════════════════════════════

  slides.push(chapterIntro(3, 6, 'Les 3 Stratégies — Par la Pratique', 'Pullback EMA 21, Breakout Compression, Recovery Post-Correction : 3 setups concrets avec entrée, stop, targets et backtests'));

  slides.push(concept('Trois stratégies, trois contextes', 'On ne va pas te donner 15 stratégies. Trois suffisent. Un trader rentable n\'a pas besoin de 20 stratégies. Il a besoin de 2 à 3 stratégies qu\'il maîtrise parfaitement. La clé, c\'est la répétition et l\'exécution, pas la collection. Warren Buffett appelle ça le circle of competence : reste dans ton cercle, et tu gagnes.'));

  slides.push(table('Vue d\'ensemble des 3 stratégies', ['Stratégie', 'Type', 'Win Rate', 'R/R', 'Régime Idéal'], [
    ['Pullback EMA 21', 'Trend-following', '55-60%', '1:2', 'Risk-On'],
    ['Breakout Compression', 'Breakout / Momentum', '45-50%', '1:3', 'Neutral'],
    ['Recovery Post-Correction', 'Mean-reversion', '60-65%', '1:2.5', 'Risk-Off'],
  ]));

  // Stratégie 1: Pullback EMA 21
  slides.push(concept('Stratégie 1 : Pullback EMA 21 — Surfer la tendance', 'C\'est la stratégie la plus fiable en marché haussier. L\'idée est simple : une action en tendance haussière respire. Elle monte, elle recule un peu vers sa moyenne mobile, puis elle repart. Ton job : acheter le recul. L\'EMA 21, c\'est 21 jours de bourse, soit environ un mois. C\'est la moyenne mobile préférée des swing traders institutionnels. Elle est assez rapide pour coller au prix, mais assez lente pour filtrer le bruit.'));

  slides.push(bullets('Conditions du setup Pullback EMA 21', [
    'Prix au-dessus de l\'EMA 50 ET de l\'EMA 200 : la tendance de fond est haussière. Pas de négociation.',
    'Pullback vers l\'EMA 21 : le prix revient toucher ou s\'approcher de l\'EMA 21. C\'est le dip que tu attends.',
    'Volume en expansion sur le rebond : quand le prix rebondit sur l\'EMA 21, le volume doit être supérieur à 1,5 fois la moyenne. Les acheteurs sont là.',
    'RSI entre 40 et 55 : pas en survente extrême, pas en surachat. La zone idéale.',
  ]));

  slides.push(steps('Exécution du Pullback EMA 21', [
    { number: 1, title: 'Entrée', description: 'Bougie de retournement haussière comme un engulfing ou un marteau sur l\'EMA 21, avec un volume supérieur à 1,5 fois la moyenne.' },
    { number: 2, title: 'Stop Loss', description: 'Sous l\'EMA 50 ou sous le dernier creux du pullback, le plus proche des deux.' },
    { number: 3, title: 'Target 1', description: 'Le dernier sommet local. Tu sécurises 50% de ta position ici.' },
    { number: 4, title: 'Target 2', description: 'Extension Fibonacci 1,618 depuis le creux du pullback. Tu laisses courir le reste avec un trailing stop.' },
  ]));

  slides.push(concept('Exemple réel : MSFT, pullback mars 2025', 'Microsoft en tendance haussière forte. Mi-mars, le prix recule de 430 dollars vers l\'EMA 21 autour de 410 dollars. Le volume explose sur la bougie de rebond. Stop sous l\'EMA 50 à 395 dollars. TP1 au sommet précédent à 430 dollars. TP2 à l\'extension Fibonacci à 455 dollars. Résultat : un ratio risk-reward de 1:2 sur TP1 et 1:3 sur TP2. C\'est ça, surfer la tendance.'));

  slides.push(concept('Pourquoi l\'EMA 21 et pas une autre ?', 'L\'EMA 21 est la moyenne mobile préférée des swing traders institutionnels parce qu\'elle correspond à un mois de trading. Quand le prix la respecte comme support, ça te dit que la tendance est saine et ordonnée. Si le prix casse l\'EMA 21 mais tient l\'EMA 50, la tendance est plus faible mais toujours intacte. Si l\'EMA 50 casse, c\'est terminé, tu sors.'));

  // Stratégie 2: Breakout Compression
  slides.push(concept('Stratégie 2 : Breakout Compression — L\'explosion après le calme', 'Le marché alterne entre contraction et expansion. Cette stratégie capture le moment où une action sort de sa compression, comme un ressort qui se détend. Pendant la phase de compression, les Bollinger Bands se resserrent, le volume baisse progressivement, l\'ADX tombe sous 20. Le marché s\'endort sur ce titre. Et quand il se réveille, le mouvement est explosif.'));

  slides.push(bullets('Conditions du setup Breakout Compression', [
    'Bollinger Bands squeeze : la largeur des BB est à son plus bas sur 20 jours. Les bandes se resserrent comme un étau.',
    'Volume en déclin : pendant la compression, le volume baisse progressivement.',
    'ADX inférieur à 20 : l\'indicateur de force de tendance confirme l\'absence de tendance.',
    'Pas d\'earnings imminents : une compression avant un earnings, c\'est un event play, pas le même setup.',
  ]));

  slides.push(steps('Exécution du Breakout Compression', [
    { number: 1, title: 'Entrée', description: 'Clôture au-dessus de la Bollinger Band supérieure avec un volume supérieur à 2 fois la moyenne. Le breakout doit être net.' },
    { number: 2, title: 'Stop Loss', description: 'Sous la BB médiane, soit la SMA 20. Si le prix rentre dans les bandes, le breakout a échoué.' },
    { number: 3, title: 'Target 1', description: 'Largeur du squeeze projetée depuis le point de breakout. Tu sécurises 50% ici.' },
    { number: 4, title: 'Target 2', description: '1,5 fois la largeur du squeeze. Trailing stop sur le reste.' },
  ]));

  slides.push(concept('Exemple réel : SAP, breakout janvier 2025', 'SAP range entre 230 et 240 euros pendant 3 semaines. Les Bollinger Bands se compressent, le volume s\'assèche. Le 20 janvier, breakout au-dessus de 240 avec un volume 3 fois la moyenne. Stop sous la SMA 20 à 233. TP1 à 250, soit la largeur du range projetée. TP2 à 258. Ratio risk-reward de 1:3. Le breakout après compression est le setup avec le meilleur potentiel de gain, mais le win rate est plus bas à 45-50%.'));

  slides.push(tip('Comment repérer la compression : regarde les Bollinger Bands sur TradingView. Quand elles se resserrent au point de presque se toucher, c\'est une compression. L\'indicateur BB Width ou Squeeze Momentum rend ça encore plus visible. Le plus important : ne pas anticiper la direction. Attends que le prix casse la bande supérieure ou inférieure avec du volume.'));

  // Stratégie 3: Recovery Post-Correction
  slides.push(concept('Stratégie 3 : Recovery Post-Correction — Acheter la peur', 'Quand le marché panique et que des blue chips de qualité perdent 15 à 25% en quelques jours sur un sell-off global, c\'est le moment de passer à l\'achat. Attention : la cause doit être macro, comme une récession, une hausse de taux ou une crise géopolitique, pas un problème propre à l\'entreprise comme un profit warning ou un scandale. Les corrections de marché sont les meilleures amies du swing trader patient.'));

  slides.push(bullets('Conditions du setup Recovery Post-Correction', [
    'Action qualité, blue chip : cotée 20 ans et plus, bilan solide, leader de secteur. Pas une small cap en détresse.',
    'Baisse de 15 à 25% depuis le sommet 52 semaines : une correction significative mais pas un effondrement structurel.',
    'Sell-off marché, pas company-specific : la cause est macro, pas un problème propre à l\'entreprise.',
    'RSI 14 inférieur à 30 : l\'action est en zone de survente extrême. La probabilité de rebond technique est élevée.',
  ]));

  slides.push(steps('Exécution du Recovery Post-Correction', [
    { number: 1, title: 'Entrée', description: 'Première bougie verte après le creux, avec le RSI qui croise au-dessus de 30. Le rebond doit être confirmé, pas anticipé.' },
    { number: 2, title: 'Stop Loss', description: 'Sous le creux récent, le point bas de la correction. Si ça casse, c\'est plus qu\'une correction.' },
    { number: 3, title: 'Target 1', description: '50% du retracement de la baisse. Tu sécurises 50% de ta position ici.' },
    { number: 4, title: 'Target 2', description: 'Retour au niveau pré-correction, le sommet avant le sell-off. Trailing stop sur le reste.' },
  ]));

  slides.push(concept('Exemple réel : Procter and Gamble, octobre 2023', 'Procter and Gamble chute de 162 à 140 dollars, soit moins 13,5% en 3 semaines lors de la correction d\'octobre 2023 quand les taux 10 ans US ont touché 5%. Le RSI tombe à 25. Première bougie verte le 27 octobre avec du volume. Entrée à 141, stop sous le creux à 138, TP1 à 151, soit 50% de retracement, TP2 retour à 162. Ratio risk-reward de 1:2,5 sur TP2.'));

  slides.push(warning('L\'erreur fatale : attraper un couteau qui tombe', 'La règle d\'or de cette stratégie : ne jamais acheter pendant la chute. Tu attends la confirmation du retournement. Première bougie verte plus RSI au-dessus de 30. Ce n\'est pas grave de rater les premiers 2-3% du rebond. L\'important, c\'est de ne pas acheter un titre qui continue de chuter. La patience est littéralement ce qui sépare les gagnants des perdants sur ce type de setup.'));

  // Backtests
  slides.push(table('Backtests 2010-2025 sur 50 blue chips', ['Métrique', 'Pullback EMA 21', 'Breakout Compression', 'Recovery'], [
    ['Nombre de trades', '1 240', '680', '320'],
    ['Win Rate', '57,3%', '47,8%', '62,1%'],
    ['R/R Moyen', '1:2,1', '1:3,2', '1:2,4'],
    ['Profit Factor', '1,82', '1,65', '2,15'],
    ['Rendement Annuel', '18,5%', '22,3%', '15,8%'],
    ['Max Drawdown', '-12,4%', '-18,7%', '-8,2%'],
  ]));

  slides.push(concept('Quelle stratégie quand ?', 'Le Pullback EMA 21 est ton pain quotidien. C\'est la stratégie la plus fréquente avec 1 240 trades en 15 ans. Tu l\'utilises quand le marché est en Risk-On, VIX sous 20, indices haussiers. Le Breakout Compression est plus rare mais plus explosif, idéal en marché neutre. Et le Recovery Post-Correction, c\'est ton arme secrète quand le marché panique, VIX au-dessus de 25 et blue chips en solde.'));

  // Quiz 3 (~slide 56)
  slides.push(quiz(
    'Pour la stratégie Pullback EMA 21, quel est le signal d\'entrée ?',
    ['Le prix casse la Bollinger Band supérieure', 'Le RSI croise au-dessus de 30', 'Bougie de retournement haussière sur l\'EMA 21 avec un volume supérieur à 1,5 fois la moyenne', 'Le MACD croise sa ligne de signal'],
    2,
    'L\'entrée du Pullback EMA 21 se fait sur une bougie de retournement haussière comme un engulfing ou un marteau qui se forme sur l\'EMA 21, avec un volume au moins 1,5 fois supérieur à la moyenne 20 jours.'
  ));

  slides.push(summary('À retenir — Chapitre 3', [
    'Trois stratégies suffisent : Pullback EMA 21 en risk-on, Breakout Compression en neutre, Recovery en risk-off.',
    'Pullback EMA 21 : win rate 55-60%, R/R 1:2. La plus fiable et la plus fréquente.',
    'Breakout Compression : win rate 45-50%, R/R 1:3. Plus rare mais plus explosive.',
    'Recovery Post-Correction : win rate 60-65%, R/R 1:2,5. Uniquement sur des blue chips en sell-off macro.',
    'Ne jamais attraper un couteau qui tombe. Toujours attendre la confirmation.',
    'Backtest sur 15 ans : les 3 stratégies sont rentables avec un profit factor supérieur à 1,6.',
  ]));

  // ══════════════════════════════════════════════════════════════════
  // CHAPITRE 4 : LES ALERTES — TIMING ET CONFIRMATION (~30 slides, ~20 min)
  // ══════════════════════════════════════════════════════════════════

  slides.push(chapterIntro(4, 6, 'Les Alertes — Timing, Confirmation et Invalidation', 'Alertes TradingView, confirmation multi-timeframe, signaux d\'entrée, les 6 scénarios d\'invalidation et la checklist pré-trade'));

  slides.push(concept('Pourquoi les alertes sont indispensables', 'Sans alertes, tu fais du screen watching. Tu fixes ton écran en espérant voir un signal. C\'est inefficace, stressant, et tu finiras par entrer trop tôt par impatience. Les alertes font le travail de surveillance à ta place. Tu ne regardes le graphique que quand le prix arrive dans ta zone d\'intérêt. TradingView gratuit permet 5 alertes actives, le plan Essential en permet 20.'));

  slides.push(bullets('Les 4 types d\'alertes à maîtriser', [
    'Alerte sur prix : tu définis un niveau clé. Quand le prix le touche, tu reçois une notification. Exemple : préviens-moi si Apple descend à 180 dollars.',
    'Alerte sur indicateur : quand un indicateur atteint une valeur. Exemple : RSI 14 croise au-dessus de 30.',
    'Alerte sur dessin : tu traces une trendline ou un canal, et l\'alerte se déclenche quand le prix le casse.',
    'Notifications mobile : active les notifications push sur l\'app TradingView. Tu reçois l\'alerte sur ton téléphone, tu analyses en 2 minutes.',
  ]));

  slides.push(tip('Pour chaque setup dans ta watchlist, pose 3 alertes minimum. Une alerte prix sur ta zone d\'entrée. Une alerte RSI qui croise 30 ou 70 pour confirmer la survente ou le surachat. Et une alerte sur ta trendline ou ton canal pour le signal de breakout.'));

  slides.push(concept('L\'alignement multi-timeframe : Monthly, Weekly, Daily', 'Le multi-timeframe, c\'est la compétence numéro 1 qui sépare les débutants des traders rentables. L\'idée est simple : tu ne trades jamais contre la tendance du timeframe supérieur. Le Monthly te donne la direction de fond, en 30 secondes. Le Weekly te montre le setup en 2-3 minutes. Le Daily te donne le timing précis de l\'entrée en 5 minutes. Règle absolue : ne prends un long que si les 3 timeframes sont alignés haussiers, ou au minimum le monthly neutre et le weekly haussier.'));

  slides.push(concept('Pourquoi le multi-timeframe est crucial', 'Imagine que tu vois un beau pullback haussier sur le daily. Tu es excité, tu veux acheter. Mais si tu zoomes sur le weekly, tu vois que le prix vient de casser un support majeur et que la tendance est baissière. Ton pullback n\'est en fait qu\'un rebond technique dans une tendance baissière, un piège à acheteurs. Le multi-timeframe t\'empêche de tomber dans ce piège. 30 secondes sur le monthly peuvent te sauver des centaines de dollars.'));

  slides.push(concept('Signal 1 : le Volume Spike', 'Le volume, c\'est la conviction du marché. Un mouvement de prix sans volume, c\'est du bruit. Un mouvement avec un volume 1,5 fois supérieur à la moyenne, c\'est un signal que les institutionnels participent. Quand le prix casse une résistance avec un volume de 2 fois la moyenne, c\'est comme un vote : plus il y a de votants, plus le résultat est légitime. Un breakout sur volume faible est souvent un fakeout.'));

  slides.push(concept('Signal 2 : la Divergence RSI', 'La divergence, c\'est quand le prix et le RSI ne vont pas dans le même sens. Divergence haussière : le prix fait un nouveau plus bas, mais le RSI fait un plus bas plus haut. Ça signifie que la pression vendeuse s\'essouffle. C\'est souvent le prélude à un retournement. Attention : la divergence ne donne pas le timing exact. Elle te dit de te préparer. L\'entrée se fait quand tu as une confirmation supplémentaire.'));

  slides.push(concept('Signal 3 : le Croisement MACD', 'Le MACD est un indicateur retardé. Il confirme un mouvement déjà en cours. Quand le MACD croise sa ligne de signal par le bas, c\'est un signal haussier. Par le haut, c\'est baissier. C\'est justement ce qu\'on veut en swing : on ne cherche pas à attraper le bottom exact, on veut confirmer que le momentum a tourné. Utilise-le en complément du RSI, jamais seul.'));

  slides.push(concept('Signal 4 : les Patterns de retournement', 'Les bougies japonaises donnent un signal visuel. Trois patterns clés pour le swing. Le Hammer, ou marteau : longue mèche basse, petit corps en haut. Signal haussier après une baisse. L\'Engulfing, ou avalement : une grosse bougie verte qui avale complètement la rouge précédente. Signal fort. Et le Morning Star, ou étoile du matin : pattern en 3 bougies, grande rouge puis petit corps puis grande verte. Signal très fiable. Mais rappelle-toi : un pattern seul ne vaut rien. Un marteau sur un support majeur avec du volume et une divergence RSI, là tu as un vrai setup.'));

  slides.push(bullets('Les 6 scénarios d\'invalidation — quand NE PAS entrer', [
    'Earnings dans moins de 5 jours : les résultats créent un gap imprévisible. Ton analyse technique ne vaut rien.',
    'FOMC, CPI ou NFP cette semaine : les annonces macro créent de la volatilité extrême. Attends 24 à 48 heures après.',
    'Volume en baisse sur le breakout : c\'est un fakeout. Les institutionnels ne participent pas.',
    'RSI au-dessus de 70 : le titre est déjà surchauffé. Tu arrives en retard, le risk-reward est mauvais.',
    'Spread bid-ask supérieur à 0,5% : illiquidité. Tu paieras plus cher à l\'entrée et vendras moins cher à la sortie.',
    'Corrélation supérieure à 0,7 avec une position existante : tu doubles ton exposition, pas tes positions.',
  ]));

  slides.push(concept('Les 4 types d\'ordres pour le swing', 'Le type d\'ordre que tu utilises peut faire la différence. L\'ordre Market, c\'est l\'exécution immédiate mais avec du slippage, à éviter la plupart du temps. L\'ordre Limit, c\'est ton ordre principal, tu contrôles le prix d\'entrée. L\'ordre Stop-Limit se déclenche quand le prix atteint un seuil puis exécute un limit, parfait pour les breakout trades. Et l\'OCO, One Cancels Other, c\'est deux ordres liés : ton take profit et ton stop loss ensemble. Celui qui se déclenche en premier annule l\'autre. Zéro gestion manuelle.'));

  slides.push(concept('L\'entrée échelonnée : le système 50, 25, 25', 'Au lieu de tout investir en un coup, divise ton entrée en 3 tranches. 50% sur le signal principal, quand ton setup se déclenche avec tous les critères. 25% sur la confirmation, quand le prix confirme ta direction le lendemain ou le surlendemain. Et les 25% restants en renfort, si le mouvement s\'accélère dans ton sens avec du volume. Ça réduit le risque d\'un mauvais timing et améliore ton prix moyen d\'entrée.'));

  slides.push(bullets('La checklist pré-trade en 8 points', [
    'Point 1 : Régime de marché favorable ? VIX, tendance des indices.',
    'Point 2 : Alignement multi-timeframe ? Monthly, Weekly et Daily dans le même sens.',
    'Point 3 : Volume supérieur à 1,5 fois la moyenne ?',
    'Point 4 : RSI dans la zone appropriée pour ta stratégie ?',
    'Point 5 : Pas d\'earnings ni d\'événement macro dans les 5 prochains jours ?',
    'Point 6 : Stop loss défini AVANT l\'entrée ? R/R supérieur à 1:2 ?',
    'Point 7 : Sizing calculé ? Risque maximum 1-2% du capital ?',
    'Point 8 : Pas de doublon avec une position existante ? Corrélation vérifiée ?',
  ]));

  // Quiz 4 (~slide 77)
  slides.push(quiz(
    'Que signifie une divergence haussière entre le prix et le RSI ?',
    ['Le prix et le RSI montent en même temps', 'Le prix fait un nouveau plus haut mais le RSI baisse', 'Le prix fait un nouveau plus bas mais le RSI fait un plus bas plus haut', 'Le RSI est au-dessus de 70'],
    2,
    'La divergence haussière se produit quand le prix fait de nouveaux plus bas mais que le RSI fait des plus bas plus hauts. Cela signifie que la pression vendeuse s\'essouffle et annonce souvent un retournement haussier.'
  ));

  slides.push(summary('À retenir — Chapitre 4', [
    'Pose 3 alertes minimum par setup : prix, RSI, et trendline sur TradingView.',
    'Multi-timeframe obligatoire : Monthly pour la direction, Weekly pour le setup, Daily pour le timing.',
    '4 signaux de confirmation : volume spike, divergence RSI, croisement MACD, pattern de retournement.',
    '6 scénarios d\'invalidation : si un seul est présent, tu ne trades pas.',
    'L\'ordre Limit est ton ordre principal. L\'OCO automatise tes sorties.',
    'Checklist pré-trade en 8 points : vérifie TOUT avant de cliquer.',
  ]));

  // ══════════════════════════════════════════════════════════════════
  // CHAPITRE 5 : GÉRER LA POSITION — DU STOP AU CASH OUT (~30 slides, ~20 min)
  // ══════════════════════════════════════════════════════════════════

  slides.push(chapterIntro(5, 6, 'Gérer la Position — Du Stop au Cash Out', 'Stop loss, take profit partiel, position sizing, journal de trading et gestion du drawdown'));

  slides.push(concept('Le stop loss : ta ceinture de sécurité', 'Tu ne conduis pas sans ceinture, tu ne trades pas sans stop. Le stop loss est non négociable. C\'est la première chose que tu définis avant d\'entrer en position. Il existe 5 types de stop, et en pratique tu en combines souvent 2 ou 3.'));

  slides.push(bullets('Les 5 types de stop loss', [
    'Stop Fixe : pourcentage fixe sous ton entrée, typiquement moins 2 à 3%. Simple et prévisible, idéal pour débuter.',
    'Stop ATR : s\'adapte à la volatilité du titre. Formule : Entrée moins 2 fois l\'ATR 14. Le plus intelligent.',
    'Trailing Stop : suit le prix à la hausse, protège tes gains, ne recule jamais. Idéal après le TP1.',
    'Stop Temps : sortie si rien ne se passe après 5 à 10 jours. Libère ton capital pour de meilleures opportunités.',
    'Stop Invalidation : cassure d\'un niveau technique clé, support, EMA 50 ou 200, trendline. La thèse est morte, tu sors.',
  ]));

  slides.push(table('Quel stop pour quelle situation ?', ['Type', 'Quand l\'utiliser', 'Avantage', 'Piège'], [
    ['Fixe (-2/-3%)', 'Débutant, capital limité', 'Simple, prévisible', 'Ignore la volatilité'],
    ['ATR x 2', 'Toujours (standard pro)', 'Adapté au titre', 'Peut être large sur titres volatils'],
    ['Trailing', 'Après TP1, en tendance', 'Protège les gains', 'Coupé trop tôt en range'],
    ['Temps (5-10j)', 'Trade qui stagne', 'Libère le capital', 'Peut sortir avant le mouvement'],
    ['Invalidation', 'Setup technique clair', 'Logique de marché', 'Stop parfois loin de l\'entrée'],
  ]));

  slides.push(concept('Take Profit Partiel : 50% à TP1 plus Trailing', 'La plus grosse erreur du débutant : soit il prend ses profits trop tôt par peur de perdre ses gains, soit il laisse tout courir et le trade revient à zéro. La solution : le take profit partiel. Tu vends 50% de ta position au TP1, c\'est-à-dire le dernier sommet ou la résistance technique la plus proche. Le ratio risk-reward de 1:2 est garanti. Les 50% restants courent avec un trailing stop. Si ça continue de monter, tu captures le bonus. Si ça retourne, tu as déjà verrouillé du profit.'));

  slides.push(concept('Le calcul du TP1 en pratique', 'Exemple concret. Tu achètes MSFT à 420 dollars, ton stop est à 410 dollars, donc ton risque par action est de 10 dollars. TP1 égale 420 plus 2 fois 10, soit 440 dollars. À 440 dollars, tu vends 50% de ta position et tu remontes ton stop au prix d\'entrée sur le solde. C\'est un trade gratuit. Le reste court avec un trailing stop à 1,5 fois l\'ATR sous le plus haut. C\'est simple, c\'est systématique, et ça marche.'));

  slides.push(concept('Position Sizing — la règle du 1 à 2%', 'Le position sizing est la compétence numéro 1 du trader rentable. Ce n\'est pas sexy, ce n\'est pas glamour, mais c\'est ce qui te garde en vie. La règle : ne jamais risquer plus de 1 à 2% de ton capital par trade. La formule : Taille égale Capital multiplié par 1% divisé par la différence entre l\'Entrée et le Stop.'));

  slides.push(concept('Exemple de position sizing', 'Capital de 10 000 dollars. Risque maximum à 1%, soit 100 dollars. Tu veux acheter une action à 50 dollars avec un stop à 47. Le risque par action est de 3 dollars. Taille égale 100 divisé par 3, soit 33 actions. Tu investis 1 650 dollars, soit 16,5% de ton capital, mais tu ne risques que 100 dollars grâce au stop loss. Remarque bien : le pourcentage du capital investi n\'est PAS la même chose que le risque. C\'est toute la magie du sizing.'));

  slides.push(table('Risque par trade et survie', ['Risque par trade', 'Pertes consécutives avant -50%', 'Verdict'], [
    ['1%', '69 pertes', 'Ultra sûr'],
    ['2%', '35 pertes', 'Recommandé'],
    ['5%', '13 pertes', 'Risqué'],
    ['10%', '7 pertes', 'Suicidaire'],
    ['20%', '3 pertes', 'Compte cramé'],
  ]));

  slides.push(warning('Pourquoi ne jamais dépasser 2% par trade', 'Avec un risque de 2% par trade, il te faut 35 pertes consécutives pour perdre 50% de ton capital. Quasiment impossible avec une stratégie correcte. Avec 5%, il n\'en faut que 13. Avec 10%, seulement 7. Les traders qui crament leur compte risquent 5 à 10% par trade. Mathématiquement, c\'est un suicide.'));

  slides.push(concept('Le Journal de Trading — ton meilleur professeur', 'Le journal de trading, c\'est ton meilleur professeur. Pas de journal, pas de progression. Chaque trade, gagnant ou perdant, doit être documenté. Les colonnes essentielles : date, ticker, stratégie utilisée, prix d\'entrée, stop, TP1, taille de position, résultat en dollars, ratio R/R réalisé, notes sur le déroulement, et surtout la colonne erreur. Même sur un trade gagnant, note si tu as fait une erreur. Un trade gagnant avec une erreur est pire qu\'un trade perdant bien exécuté, parce que l\'erreur va se répéter.'));

  slides.push(concept('Scénarios P&L réalistes — compte 10 000 dollars', 'Voyons des scénarios réalistes sur un compte de 10 000 dollars avec un risque de 1% par trade et un R/R de 1:2. Bon mois : 3 wins et 1 loss, soit plus 400 dollars. Mois plat : 2 wins et 2 losses, plus 100 dollars. Mauvais mois : 1 win et 3 losses, moins 200 dollars. Même avec seulement 50% de win rate, tu es en profit grâce au R/R positif.'));

  slides.push(concept('La gestion du drawdown', 'Le drawdown, c\'est la baisse maximale de ton capital depuis son plus haut. C\'est inévitable. Le protocole : à moins 10%, tu fais une pause d\'une semaine. Tu reviews ton journal, tu identifies l\'erreur systémique. À moins 15%, tu réduis à 2 positions et tu divises ta taille par 2. Mode survie. À moins 20%, tu arrêtes de trader pendant 1 mois. Tu fermes tout, tu passes en paper trading, et tu analyses tes 3 derniers mois. Pas de revenge trading. Jamais.'));

  slides.push(table('L\'asymétrie des pertes', ['Perte', 'Gain nécessaire pour revenir', 'Difficulté'], [
    ['-5%', '+5,3%', 'Facile'],
    ['-10%', '+11,1%', 'Gérable'],
    ['-20%', '+25%', 'Difficile'],
    ['-30%', '+42,9%', 'Très difficile'],
    ['-50%', '+100%', 'Quasi impossible'],
  ]));

  slides.push(warning('Le piège du revenge trading', 'Le revenge trading, c\'est trader pour se refaire après une perte. C\'est le tueur numéro 1 de comptes. Après une perte, attends 24 heures minimum avant le prochain trade. Si tu as envie d\'ouvrir un trade après 22 heures, ferme l\'ordinateur. Le trade sera encore là demain. Va marcher, faire du sport, le cortisol doit redescendre. En période de doute, réduis tes positions de moitié et reconstruis la confiance petit à petit.'));

  // Quiz 5 (~slide 101)
  slides.push(quiz(
    'Capital 10 000 dollars, entrée à 80 dollars, stop à 76 dollars. Combien d\'actions maximum avec un risque de 1% ?',
    ['12 actions', '20 actions', '25 actions', '33 actions'],
    2,
    'Risque max égale 10 000 multiplié par 1%, soit 100 dollars. Risque par action : 80 moins 76 égale 4 dollars. Taille : 100 divisé par 4 égale 25 actions, soit 2 000 dollars investis. Tu investis 20% de ton capital mais tu ne risques que 1%.'
  ));

  slides.push(summary('À retenir — Chapitre 5', [
    '5 types de stop : fixe, ATR (le standard pro), trailing, temps, invalidation. Combine-les.',
    'Take profit partiel : 50% à TP1 avec un R/R de 1:2 garanti, trailing sur le reste.',
    'Position sizing : risque 1-2% max par trade. Formule : Capital fois 1% divisé par Entrée moins Stop.',
    'Journal obligatoire avec la colonne Erreur, même sur les trades gagnants.',
    'Drawdown : -10% égale pause, -15% égale mode survie, -20% égale stop total.',
    'Jamais de revenge trading. Attends 24 heures après une perte.',
  ]));

  // ══════════════════════════════════════════════════════════════════
  // CHAPITRE 6 : LE CONTEXTE ET LA ROUTINE — DEVENIR RÉGULIER (~30 slides, ~20 min)
  // ══════════════════════════════════════════════════════════════════

  slides.push(chapterIntro(6, 6, 'Le Contexte et La Routine — Devenir Régulier', 'Régime de marché Risk-On vs Risk-Off, rotation défensives-tech, routine quotidienne, hebdomadaire et mensuelle, objectifs réalistes et scaling progressif'));

  slides.push(concept('Le régime de marché — ta boussole', 'Avant de placer un seul trade, tu dois répondre à une question fondamentale : le marché est-il en mode risk-on ou risk-off ? C\'est la différence entre nager avec le courant ou contre lui. En risk-on, les investisseurs cherchent le rendement : tech, growth, crypto. En risk-off, ils fuient vers la sécurité : obligations, or, défensives. Deux indicateurs te suffisent : le VIX et le DXY.'));

  slides.push(table('Les 4 zones du VIX', ['Zone', 'Niveau', 'Régime', 'Action Swing'], [
    ['< 15', 'Calme', 'Risk-On fort', 'Momentum et breakout, positions agressives'],
    ['15 à 20', 'Normal', 'Risk-On modéré', 'Swing classique, tes 3 stratégies fonctionnent'],
    ['20 à 30', 'Nerveux', 'Transition Risk-Off', 'Réduire le sizing, stops serrés, privilégier les défensives'],
    ['> 30', 'Panique', 'Risk-Off extrême', 'Cash is king, pas de nouveau trade, protéger le capital'],
  ]));

  slides.push(concept('Le DXY — le Dollar Index', 'Le DXY mesure la force du dollar face à un panier de devises. Un dollar fort, DXY en hausse au-dessus de 105, est généralement négatif pour les actions, les matières premières et les marchés émergents. Un dollar faible, DXY sous 100, est positif pour les actifs risqués. DXY stable entre 100 et 105, neutre, concentre-toi sur les catalyseurs individuels.'));

  slides.push(tip('Comment détecter le régime en 30 secondes. Chaque matin, ouvre TradingView et regarde deux choses : le VIX et les futures S&P 500. Si le VIX est sous 20 et les futures sont verts, c\'est risk-on, tu peux chercher des setups agressifs. Si le VIX perce 25 et les futures sont rouges, c\'est risk-off, tu passes en mode défensif ou tu restes cash.'));

  slides.push(concept('La rotation Défensives vs Tech', 'Le marché n\'est pas monolithique. Quand la peur monte, l\'argent quitte la tech pour se réfugier dans les défensives. Quand la confiance revient, c\'est l\'inverse. Les défensives, ce sont des valeurs comme JNJ, Procter and Gamble, Coca-Cola, Nestlé. Beta inférieur à 0,8, dividendes stables, revenus récurrents. Les tech, c\'est MSFT, ASML, SAP, Apple. Beta supérieur à 1, forte croissance, volatilité élevée. La règle : VIX sous 20, surpondérer la tech. VIX au-dessus de 25, pivoter vers les défensives.'));

  slides.push(table('Défensives vs Tech — Performance par régime', ['Ticker', 'Type', 'Beta', 'Perf Risk-On', 'Perf Risk-Off'], [
    ['JNJ', 'Défensive', '0.55', '+8%', '-3%'],
    ['PG', 'Défensive', '0.45', '+6%', '-2%'],
    ['Nestlé', 'Défensive', '0.50', '+5%', '-3%'],
    ['MSFT', 'Tech', '1.10', '+22%', '-15%'],
    ['AAPL', 'Tech', '1.20', '+25%', '-18%'],
    ['ASML', 'Tech', '1.35', '+30%', '-22%'],
  ]));

  slides.push(concept('Pivoter ne veut pas dire tout vendre', 'Si tu as 4 positions et que le VIX perce 25, ne liquide pas ton portefeuille. Ne prends simplement pas de nouveaux trades tech. Si une position défensive donne un signal, prends-la en priorité. Si une position tech touche son stop, ne la replace pas. Attends que le régime redevienne favorable. C\'est une rotation douce, pas un switch brutal.'));

  slides.push(concept('Le risque de change EUR/USD — l\'ennemi invisible', 'Si tu es basé en Europe et que tu trades des actions US, tu es exposé au taux de change EUR/USD sans même t\'en rendre compte. Tu peux avoir raison sur MSFT avec un gain de 5% et perdre de l\'argent si l\'euro s\'est apprécié de 7% sur la même période. Ton rendement réel en euros, c\'est le rendement de l\'action plus la variation du change. Sur un swing de 2 à 4 semaines, l\'EUR/USD peut bouger de 2 à 3%.'));

  slides.push(comparison('US vs Europe — les deux marchés',
    { label: 'Avantages US', items: ['Liquidité imbattable, spreads micro', 'Diversité sectorielle massive', 'Horaires décalés : scan le soir après le boulot', 'Plus de volatilité donc plus de setups swing'] },
    { label: 'Avantages Europe', items: ['PEA : fiscalité 17,2% au lieu de 30%', 'Zéro risque de change si on trade en euros', 'Même timezone, réactivité immédiate aux news', 'Blue chips comme SAP et ASML excellentes pour le swing'] }
  ));

  slides.push(tip('La stratégie optimale pour un résident européen. PEA pour les actions européennes comme SAP, ASML, TotalEnergies et Sanofi avec la fiscalité à 17,2%. Et CTO chez Interactive Brokers pour les actions US comme MSFT, Apple, JNJ et Procter and Gamble avec la liquidité maximale. Tu trades l\'Europe le matin, tu scannes les US le soir. Tes 4 positions sont naturellement diversifiées géographiquement.'));

  slides.push(concept('La routine quotidienne — 5 minutes chrono', 'La régularité bat le talent. 5 minutes chaque matin, c\'est tout ce dont tu as besoin. Première minute : VIX et futures, c\'est ta météo du jour. Deuxième minute : alertes TradingView, un signal déclenché pendant la nuit ? Troisième minute : calendrier des earnings, pas de surprise. Quatrième et cinquième minutes : mise à jour du journal si un trade s\'est clôturé. 5 minutes par jour fois 250 jours, ça fait 20 heures par an de veille active. Moins qu\'une saison de série Netflix.'));

  slides.push(concept('La routine hebdomadaire — 30 minutes le dimanche soir', 'Chaque dimanche soir, tu consacres 30 minutes à préparer ta semaine. 10 minutes pour scanner ta watchlist et identifier les candidats. 5 minutes pour relire tes trades de la semaine dans ton journal. 5 minutes pour mettre à jour la watchlist, supprimer les tickers épuisés et ajouter les nouveaux. Et 10 minutes pour analyser chaque candidat avec les 3 stratégies et noter le plan d\'entrée avec stop et TP.'));

  slides.push(concept('La routine mensuelle — 1 heure le premier dimanche', 'Une fois par mois, tu fais le bilan complet. C\'est ton audit personnel. 15 minutes de revue de performance : P&L, win rate, R/R moyen, drawdown max. 15 minutes d\'analyse des erreurs : classe tes pertes par catégorie, quelle erreur revient le plus ? 15 minutes d\'ajustement stratégie : quelle stratégie performe le mieux ce mois ? Concentre-toi dessus. Et 15 minutes d\'objectifs pour le mois suivant. Le trader qui tient un journal progresse 3 fois plus vite.'));

  slides.push(table('Objectifs réalistes année par année', ['Année', 'Objectif Performance', 'Positions', 'Focus'], [
    ['Année 1', 'Breakeven (0%)', '0 puis 1', 'Apprendre, 50+ trades, tenir le journal'],
    ['Année 2', '+10 à 15%', '1-2', 'Régularité, respect des stops, spécialisation'],
    ['Année 3+', '+20 à 30%', '3-4', 'Routine automatisée, 4 positions, compounding'],
  ]));

  slides.push(concept('Pourquoi ces chiffres sont réalistes', 'Le S&P 500 fait environ 10% par an historiquement. Si tu fais 20 à 30% en année 3, tu bats le marché de 2 à 3 fois. C\'est excellent. Les vendeurs de formations qui promettent 100% par an mentent. Les hedge funds les plus performants font 15 à 25%. Tu as un avantage en tant que particulier : pas de frais de gestion, pas de contraintes de taille, pas de clients à rassurer. Utilise cet avantage pour être patient, pas pour être gourmand.'));

  slides.push(table('Scaling progressif — de 0 à 4 positions', ['Phase', 'Période', 'Positions', 'Capital', 'Objectif'], [
    ['Paper trading', 'Mois 1-2', '0 réelle', '0 euros', 'Maîtriser scanner, alertes, journal. 20+ trades paper.'],
    ['Initiation', 'Mois 3-4', '1 position', '500-1000 euros', 'Vivre un vrai trade. Respecter le stop.'],
    ['Expansion', 'Mois 5-8', '2 positions', '2000-3000 euros', 'Gérer 2 trades simultanés, décorrélés.'],
    ['Croisière', 'Mois 9-12', '3-4 positions', '5000+ euros', 'Pleine allocation. Rotation. Routine automatisée.'],
  ]));

  slides.push(warning('90% des débutants qui explosent leur compte', '90% des traders débutants qui crament leur compte ont un point commun : ils sont allés trop vite, trop tôt. Ils passent de 0 à 4 positions en 2 semaines, sans paper trading, sans journal, sans compréhension du régime. Le résultat est prévisible : un drawdown de moins 20% dès le premier mois, suivi d\'un abandon. Respecte le calendrier de 12 mois. Slow is smooth, smooth is fast.'));

  slides.push(bullets('Ta boîte à outils permanente', [
    'Trading in the Zone de Mark Douglas : LE livre sur la psychologie du trading. Discipline, biais, état d\'esprit. À lire et relire.',
    'Technical Analysis de John Murphy : la bible de l\'analyse technique. Supports, résistances, patterns, volumes.',
    'TradingView pour les charts, Finviz pour le screening, Google Sheets pour le journal.',
    'Le calendrier économique sur Investing.com ou ForexFactory. Les annonces macro impactent tout.',
  ]));

  // Quiz 6 (~slide 127)
  slides.push(quiz(
    'Que fais-tu quand le VIX passe au-dessus de 25 ?',
    ['Tu augmentes tes positions tech pour profiter de la volatilité', 'Tu réduis le sizing, serres les stops et privilégies les défensives', 'Tu achètes du Bitcoin', 'Tu fermes immédiatement toutes tes positions'],
    1,
    'Un VIX au-dessus de 25 signale une transition vers le risk-off. Tu réduis le sizing, tu serres les stops, et tu privilégies les valeurs défensives comme JNJ, PG ou Nestlé. Tu ne fermes pas tout d\'un coup, c\'est une rotation douce.'
  ));

  // Quiz 7 (~slide 128)
  slides.push(quiz(
    'Combien de temps la routine quotidienne doit-elle prendre ?',
    ['30 minutes', '1 heure', '5 minutes', '15 minutes'],
    2,
    '5 minutes maximum. C\'est suffisant pour checker le VIX et les futures, vérifier les alertes TradingView, consulter le calendrier earnings, et mettre à jour le journal si un trade s\'est clôturé. 5 minutes par jour fois 250 jours égale 20 heures par an.'
  ));

  slides.push(concept('Le récapitulatif de la série Swing Mode', 'Tu as parcouru les 6 étapes. Le Setup : broker, outils, règle des 20 ans, 4 positions décorrélées. Le Scanner : univers de 40 tickers, scan quotidien et hebdomadaire, 3 filtres essentiels. Les 3 Stratégies : Pullback EMA 21, Breakout Compression, Recovery Post-Correction. Les Alertes : multi-timeframe, 4 signaux de confirmation, 6 invalidations, checklist 8 points. La Gestion : stop loss, take profit partiel, sizing, journal, drawdown. Et La Routine : régime de marché, rotation défensives-tech, routine 5-30-60.'));

  slides.push(quote('Le swing trading n\'est pas un sprint. C\'est un marathon de discipline.', 'La différence entre toi et les 90% qui abandonnent, c\'est la régularité. 5 minutes par jour, 30 minutes par semaine, 1 heure par mois. C\'est tout. Le reste, c\'est de la patience.'));

  slides.push(summary('Le mot de la fin — Swing Mode', [
    '15 à 30 minutes par jour suffisent. Le swing trading est compatible avec une vie normale.',
    'Trois stratégies, pas quinze. Le Pullback, le Breakout et le Recovery couvrent tous les régimes.',
    'Le money management fait tout : 1-2% de risque par trade, R/R de 1:2 minimum, 4 positions décorrélées.',
    'La première année, l\'objectif est de survivre et d\'apprendre, pas de devenir riche.',
    'Paper trading pendant 2 mois avant le premier euro en jeu. Slow is smooth, smooth is fast.',
    'Tiens ton journal, respecte tes stops, suis ta routine. La régularité bat le talent.',
    'Bonne chance. Et bienvenue dans le Swing Mode.',
  ]));

  return slides;
}

function generateMaitriseExpert() {
  let slideIndex = 0;
  const slides = [];

  // ============================================================
  // CHAPITRE 1 — VIX Decoded (~50 slides)
  // ============================================================

  slides.push(chapterIntro(1, 'VIX Decoded', 'Ce que l\'indice de la peur mesure vraiment — et pourquoi la plupart se trompent'));

  slides.push(concept('Qu\'est-ce que le VIX ?',
    'Le VIX mesure la volatilité implicite à 30 jours du S&P 500, extraite des prix des options SPX. Ce n\'est PAS un "indice de peur" — c\'est le prix de l\'assurance. Quand le VIX est à 20, le marché anticipe des mouvements quotidiens d\'environ 1.26% (20 / racine de 252).'));

  slides.push(bullets('VIX = Volatilité Implicite à 30 Jours', [
    'VIX à 20 → mouvement quotidien attendu ≈ 1.26%',
    'VIX à 40 → mouvement quotidien attendu ≈ 2.52%',
    'VIX à 80 → mouvement quotidien attendu ≈ 5.04%',
    'Le VIX ne dit RIEN sur la direction — seulement l\'amplitude attendue'
  ]));

  slides.push(concept('La Formule du Mouvement Quotidien',
    'Mouvement quotidien = VIX / √252 ≈ VIX / 15.87. C\'est la conversion de la volatilité annualisée en volatilité quotidienne. Un VIX à 20 signifie que le marché des options price un mouvement d\'environ 1.26% par jour sur le S&P 500.'));

  slides.push(comparison('Volatilité Implicite vs. Réalisée',
    { label: 'Implicite (IV)', items: [
      'Anticipation du marché (forward-looking)',
      'Extraite des prix des options SPX',
      'C\'est le VIX (CBOE)',
      'Habituellement SUPÉRIEURE à la réalisée'
    ]},
    { label: 'Réalisée (RV)', items: [
      'Ce qui s\'est réellement passé (backward-looking)',
      'Calculée à partir des rendements du sous-jacent',
      'HV20, HV30, RVOL',
      'Habituellement INFÉRIEURE à l\'implicite'
    ]}
  ));

  slides.push(concept('La Prime de Risque de Volatilité (VRP)',
    'L\'écart entre IV et RV s\'appelle la Volatility Risk Premium. L\'IV dépasse la RV environ 85% du temps. C\'est logique : les vendeurs d\'options exigent une prime pour assumer le risque d\'incertitude, comme une compagnie d\'assurance. Cette prime persistante est la base de nombreuses stratégies de trading de volatilité.'));

  slides.push(tip('Analogie Clé', 'La volatilité implicite est la MÉTÉO PRÉVUE. La volatilité réalisée est le BULLETIN MÉTÉO. La prévision est presque toujours un peu plus dramatique que la réalité — sauf quand un ouragan imprévu frappe.'));

  slides.push(warning('Quand le VRP s\'inverse',
    'Quand la volatilité réalisée dépasse l\'implicite, c\'est un signal de dislocation du marché. Le marché a été pris de court. Cela s\'est produit lors du crash COVID de mars 2020 et du Volmageddon de février 2018.'));

  slides.push(steps('Comment le VIX est Calculé', [
    { step: 'Sélection des options', detail: 'Le CBOE sélectionne deux expirations qui encadrent une fenêtre de 30 jours sur le S&P 500' },
    { step: 'Filtrage des strikes', detail: 'Toutes les options hors de la monnaie (OTM) sont utilisées — puts en dessous du forward, calls au-dessus. Options à bid zéro exclues.' },
    { step: 'Pondération par distance', detail: 'Chaque option contribue proportionnellement à l\'espacement entre ses strikes voisins. 200-300+ options par expiration.' },
    { step: 'Interpolation à 30 jours', detail: 'Le CBOE interpole entre les deux expirations pour cibler exactement 30 jours calendaires.' }
  ]));

  slides.push(concept('Pourquoi la Chaîne Complète d\'Options ?',
    'L\'ancien VXO (pré-2003) n\'utilisait que 8 options at-the-money. Le nouveau VIX utilise TOUTE la chaîne OTM car le prix théorique d\'un variance swap peut être répliqué par un portefeuille de toutes les options OTM. Cela capture le smile de volatilité complet, y compris le skew des puts.'));

  slides.push(concept('Le Put Skew — Pourquoi le VIX Est Biaisé',
    'Le côté des puts OTM contribue PLUS que le côté des calls au VIX. C\'est le fameux "put skew" : les investisseurs paient une prime pour la protection baissière, ce qui gonfle le VIX au-delà de ce qu\'un modèle symétrique suggérerait. Quand les gestionnaires achètent massivement des puts SPX, le VIX monte — même si la vol ATM n\'a pas changé.'));

  slides.push(bullets('Structure par Terme du VIX — Les Indices', [
    'VIX9D : 9 jours — ultra court terme, très sensible aux événements',
    'VIX : 30 jours — la mesure standard',
    'VIX3M : 3 mois — attentes à moyen terme',
    'VIX6M : 6 mois — vue structurelle',
    'VIX1Y : 12 mois — perspective annuelle'
  ]));

  slides.push(comparison('Contango vs. Backwardation',
    { label: 'Contango (80-85% du temps)', items: [
      'Pente ascendante : VIX9D < VIX < VIX3M',
      'Marché calme et ordonné',
      'Roll yield négatif pour les ETPs long VIX',
      'VXX et UVXY perdent de la valeur constamment',
      'Exemples : 2017, 2019, 2021'
    ]},
    { label: 'Backwardation (15-20%)', items: [
      'Pente inversée : VIX9D > VIX > VIX3M',
      'Stress aigu, panique',
      'Roll yield positif pour les longs VIX',
      'Souvent près des creux de marché à court terme',
      'Exemples : Fév 2018, Mars 2020, Août 2024'
    ]}
  ));

  slides.push(tip('Structure > Niveau',
    'Un VIX à 25 en contango raconte une histoire totalement différente d\'un VIX à 25 en backwardation. En contango : "la vol est modérément élevée mais stable". En backwardation : "on sort d\'un spike massif — le pire est peut-être passé". Les pros ne tradent JAMAIS sur le niveau seul.'));

  slides.push(table('Le Ratio VIX/VIX3M en Pratique',
    ['Ratio', 'Structure', 'Interprétation', 'Action'],
    [
      ['< 0.85', 'Contango profond', 'Complaisance, risque de spike', 'Acheter protection (pas cher)'],
      ['0.85 - 1.00', 'Contango normal', 'Marché ordonné', 'Business as usual'],
      ['1.00 - 1.10', 'Backwardation', 'Stress — achat contrariant', 'Commencer à accumuler des longs'],
      ['> 1.10', 'Inversion profonde', 'Panique — retournement probable', 'Déployer 2ème tranche']
    ]
  ));

  slides.push(bullets('Les 4 Régimes de Volatilité', [
    'Complaisance (VIX < 15) : marché endormi, options pas chères — ~30% du temps',
    'Normal (VIX 15-20) : zone Goldilocks, tout fonctionne — ~35% du temps',
    'Élevé (VIX 20-30) : stress sans panique, corrections — ~25% du temps',
    'Crise (VIX > 30) : panique totale, liquidité asséchée — ~10% du temps'
  ]));

  slides.push(table('Régimes et Rendements Forward',
    ['Régime', 'VIX', 'Temps passé', 'Rendement SPX 30j', 'Risque Max DD'],
    [
      ['Complaisance', '< 15', '~30%', '+0.8%', 'Faible (mais piège)'],
      ['Normal', '15-20', '~35%', '+1.0%', 'Modéré'],
      ['Élevé', '20-30', '~25%', '+0.5%', 'Élevé'],
      ['Crise', '> 30', '~10%', '+2.5%', 'Extrême (meilleurs rendements !)']
    ]
  ));

  slides.push(concept('La Vérité Contre-Intuitive',
    'Les MEILLEURS rendements forward à 30 jours viennent du régime de CRISE. Un VIX > 30 — le régime qui semble le plus dangereux — produit historiquement les rendements moyens les plus élevés. Le confort n\'est pas la sécurité, et l\'inconfort n\'est pas le danger.'));

  slides.push(concept('L\'Asymétrie VIX / S&P 500',
    'Le VIX monte PLUS VITE sur les baisses du SPX qu\'il ne baisse sur les hausses de même amplitude. Une baisse de 2% du SPX peut faire monter le VIX de 18.5%. Une hausse de 2% ne le fait baisser que de 9.2%. Le ratio d\'asymétrie augmente avec l\'amplitude du mouvement.'));

  slides.push(table('Quantifier l\'Asymétrie',
    ['Mouvement SPX', 'VIX (jour de baisse)', 'VIX (jour de hausse)', 'Ratio'],
    [
      ['0.5%', '+3.2%', '-2.1%', '1.52x'],
      ['1.0%', '+7.8%', '-4.5%', '1.73x'],
      ['2.0%', '+18.5%', '-9.2%', '2.01x'],
      ['3.0%', '+32.0%', '-14.1%', '2.27x'],
      ['5.0%+', '+55%+', '-18%', '3.0x+']
    ]
  ));

  slides.push(bullets('3 Mécanismes de l\'Asymétrie', [
    'Demande de puts : les institutionnels achètent massivement des puts lors des baisses → gonfle le VIX',
    'Effet de levier (Fischer Black 1976) : les prix baissent → levier augmente → vol augmente → cercle vicieux',
    'Amplification comportementale (Kahneman) : les pertes sont ressenties 2.5x plus intensément que les gains'
  ]));

  slides.push(concept('Le Plancher et le Plafond du VIX',
    'Le VIX a un plancher naturel autour de 10-12 (minimum irréductible de volatilité réalisée). Mais il n\'a PAS de plafond théorique — il peut atteindre 80, 90 ou plus (record intraday : 89.53 en mars 2020). Plancher fini + plafond infini = expression ultime de l\'asymétrie.'));

  slides.push(quiz(
    'Quand le VIX est à 20, quel mouvement quotidien le marché anticipe-t-il sur le S&P 500 ?',
    ['0.20%', '1.26%', '2.00%', '20.00%'],
    1,
    'VIX / √252 ≈ 20 / 15.87 ≈ 1.26%. Le VIX exprime une volatilité annualisée qu\'il faut diviser par la racine du nombre de jours de trading.'
  ));

  slides.push(bullets('4 Mythes du VIX Débunkés', [
    'MYTHE 1 : "Le VIX prédit les crashes" → FAUX. Il RÉAGIT, il ne prédit pas. VIX était à 14 mi-février 2020.',
    'MYTHE 2 : "VIX élevé = vendre tout" → FAUX. Les meilleurs rendements forward viennent des VIX élevés.',
    'MYTHE 3 : "Le VIX est un indicateur de peur" → TROMPEUR. C\'est le prix de l\'assurance, pas la peur elle-même.',
    'MYTHE 4 : "Acheter UVXY quand le VIX est bas et attendre" → DÉSASTREUX. Le contango détruit 60-90% par an.'
  ]));

  slides.push(summary('Chapitre 1 — Récap VIX Decoded', [
    'VIX = volatilité implicite 30 jours du SPX, pas un "indice de peur"',
    'Formule : mouvement quotidien = VIX / √252',
    'Prime de risque de volatilité : l\'IV dépasse la RV 85% du temps',
    'Structure par terme : contango (normal) vs backwardation (panique)',
    '4 régimes : Complaisance < 15, Normal 15-20, Élevé 20-30, Crise > 30',
    'Asymétrie fondamentale : le VIX monte plus vite qu\'il ne descend',
    'Le VIX a un plancher (~10-12) mais PAS de plafond'
  ]));

  // ============================================================
  // CHAPITRE 2 — Saisonnalité du VIX (~50 slides)
  // ============================================================

  slides.push(chapterIntro(2, 'Saisonnalité du VIX', 'Les patterns calendaires prévisibles — et comment les exploiter'));

  slides.push(concept('Pourquoi la Saisonnalité Persiste',
    'Les patterns saisonniers du VIX ne sont pas un hasard statistique. Ils sont pilotés par des forces structurelles qui se répètent chaque année : rebalancement fiscal de fin d\'année, tax-loss harvesting en Q4, concentration des earnings, cadence du FOMC, et liquidité des vacances.'));

  slides.push(table('VIX Moyen par Mois (35 ans de données : 1990-2025)',
    ['Mois', 'VIX Moyen', 'Niveau'],
    [
      ['Janvier', '19.1', 'Bas'],
      ['Février', '19.6', 'Bas'],
      ['Mars', '20.2', 'Moyen'],
      ['Avril', '18.8', 'Bas'],
      ['Mai', '19.4', 'Moyen'],
      ['Juin', '19.0', 'Bas'],
      ['Juillet', '18.5', 'Plus bas'],
      ['Août', '20.8', 'Moyen-Haut'],
      ['Septembre', '21.7', 'Haut'],
      ['Octobre', '22.3', 'Le Plus Haut'],
      ['Novembre', '19.8', 'Moyen'],
      ['Décembre', '17.4', 'Le Plus Bas']
    ]
  ));

  slides.push(concept('Le Pattern en U Annuel',
    'Le VIX suit un arc saisonnier en forme de U : bas en début d\'année et en été, montée progressive vers un pic en septembre-octobre, puis effondrement vers la fin d\'année. Octobre à 22.3 vs Décembre à 17.4 — un écart de près de 5 points.'));

  slides.push(concept('Le Paradoxe d\'Octobre',
    'Octobre a la pire réputation (crashes de 1929, 1987, 2008). VIX record à 89.53 le 24 octobre 2008. MAIS c\'est aussi le mois où se forment le plus de creux de marché. Les mêmes forces qui créent la panique (ventes forcées, liquidations) créent aussi la capitulation.'));

  slides.push(bullets('Événements Historiques d\'Octobre', [
    '29 oct. 1929 — "Black Tuesday" : Dow -12% en une journée',
    '19 oct. 1987 — "Black Monday" : S&P -20.5% en une séance',
    'Octobre 2008 — VIX à 89.53, S&P -17% sur le mois',
    'Octobre 2018 — VIX à 28.8, pivot de la Fed en janvier 2019',
    '12 oct. 2022 — Creux du bear market à 3,491 SPX, +55% ensuite'
  ]));

  slides.push(tip('Le Spread d\'Octobre',
    'L\'écart entre IV et RV en octobre est le plus large de tous les mois : 3.2 points en moyenne. Cela signifie que vendre la volatilité d\'octobre a historiquement été profitable — mais avec un risque de queue significatif.'));

  slides.push(concept('Le Cycle Trimestriel des Earnings',
    'La saison des earnings est le catalyseur VIX le plus prévisible. 4 fois par an, ~80% des entreprises du S&P 500 publient leurs résultats dans une fenêtre de 3 semaines. Pattern : la vol monte avant, puis s\'effondre après (le "vol crush").'));

  slides.push(table('Cycle Vol des Earnings par Trimestre',
    ['Métrique', 'Q1 (Jan-Fév)', 'Q2 (Avr-Mai)', 'Q3 (Jul-Août)', 'Q4 (Oct-Nov)'],
    [
      ['Hausse VIX pré-earnings', '+2.1 pts', '+1.2 pts', '+1.8 pts', '+2.8 pts'],
      ['Baisse VIX post-earnings', '-2.5 pts', '-1.8 pts', '-2.0 pts', '-3.8 pts'],
      ['Durée du crush', '6 jours', '5 jours', '7 jours', '8 jours'],
      ['Catalyseur clé', 'Big Tech + guidance', 'Macro (CPI, Fed)', 'Liquidité été', 'Fin année fiscale'],
      ['Win rate vente vol post-pic', '68%', '64%', '62%', '74%']
    ]
  ));

  slides.push(concept('Le Phénomène du "Vol Crush"',
    'Quand une entreprise publie ses résultats, l\'incertitude se résout INSTANTANÉMENT. La IV de ses options s\'effondre de 30-60% en une nuit. Au niveau de l\'indice, quand 40+ entreprises du S&P publient la même semaine, le VIX baisse significativement.'));

  slides.push(steps('Positionner Autour des Earnings', [
    { step: 'Phase expansion (pré-earnings)', detail: 'Acheter calls VIX ou VXX 2-3 semaines avant. Vendre des iron condors SPX sur les noms individuels.' },
    { step: 'Phase crush (post-earnings)', detail: 'Vendre des puts VIX ou shorter UVXY après la 1ère semaine de publications. Fenêtre de 5-8 jours.' },
    { step: 'Timing optimal', detail: 'Entrer quand le VIX est sous sa MM20 mais le calendrier montre les earnings qui approchent.' }
  ]));

  slides.push(quiz(
    'Quel trimestre montre le plus grand "vol crush" post-earnings ?',
    ['Q1 (Janvier-Février)', 'Q2 (Avril-Mai)', 'Q3 (Juillet-Août)', 'Q4 (Octobre-Novembre)'],
    3,
    'Le Q4 montre le crush le plus important à -3.8 points, car il combine les earnings, la fin d\'année fiscale, et l\'anxiété d\'octobre qui se dissipe.'
  ));

  slides.push(concept('Le Cycle FOMC du VIX',
    'Le FOMC se réunit 8 fois par an. Pattern caractéristique : compression avant (VIX -0.8 pts sur T-5 à T-1), spike intraday le jour J (+1.2 pts puis effondrement), puis relâchement après (VIX -1.1 pts sur T+1 à T+5). Le post-FOMC drift est une des anomalies les plus documentées.'));

  slides.push(table('Meetings FOMC : Dot Plot vs. Non-Dot Plot',
    ['Métrique', 'Dot Plot (4/an)', 'Non-Dot Plot (4/an)'],
    [
      ['VIX moyen à T-1', '21.4', '18.9'],
      ['Mouvement SPX le jour J', '±1.2%', '±0.7%'],
      ['Vol crush post-meeting', '-1.8 pts', '-0.6 pts'],
      ['Fréquence des surprises', '22%', '8%'],
      ['Spike VIX intraday max', '+4.2 pts', '+1.8 pts']
    ]
  ));

  slides.push(tip('Le Trade FOMC le Plus Consistant',
    'Vendre des straddles/strangles SPX 1-2 jours avant le meeting, fermer 1-2 jours après. Win rate : 71% depuis 2012. Gain moyen : 12% sur le premium. Perte moyenne quand ça échoue : -18%. Réduire la taille de 50% pour les meetings Dot Plot.'));

  slides.push(concept('L\'Effet OPEX (Expiration des Options)',
    'L\'OPEX crée des effets MÉCANIQUES sur la volatilité. 3-4 jours avant : VIX baisse (-0.9 pts) car les dealers sont long gamma et suppriment la vol. Après l\'OPEX : VIX remonte (+1.1 pts) car le gamma disparaît. Le Quad Witching (mars, juin, sept, déc) amplifie ces effets.'));

  slides.push(bullets('Le Quad Witching — Expiration Quadruple', [
    'Options equity + options indice + futures equity + futures indice expirent le même jour',
    'Volume +40-60% au-dessus de la moyenne',
    '4-5 trillions $ de notionnel expirent en une séance',
    'VIX gap souvent à la hausse le lundi suivant',
    'Le Quad Witching de septembre est le PIRE (coïncide avec fin année fiscale)'
  ]));

  slides.push(concept('0DTE : Le Nouvel OPEX Quotidien',
    'Depuis les expirations quotidiennes SPX en 2022, les 0DTE représentent ~50% du volume d\'options SPX. Cela crée une suppression de vol quotidienne et des spikes intraday en fin de séance, mais atténue l\'impact de l\'OPEX mensuel traditionnel.'));

  slides.push(warning('La Leçon Volmageddon (5 Février 2018)',
    'Le VIX est passé de 17 à 50 en une séance — une boucle de rétroaction entre les produits short-vol (XIV, SVXY) et les futures VIX. L\'ETF XIV a perdu 96% en une nuit et a été liquidé. 2 milliards $ détruits en quelques heures. Les mécanismes d\'options ne sont pas un bruit de fond — ILS SONT le marché.'));

  slides.push(concept('Effets des Vacances sur le VIX',
    'Les vacances créent des patterns très fiables : la semaine de Thanksgiving est la plus basse volatilité de l\'année (-2.1 pts, 78% WR). Noël-Nouvel An : -1.8 pts, 74% WR. Semaine du 4 juillet : -1.2 pts, 70% WR. MAIS les surprises d\'août dans un environnement de faible liquidité sont amplifiées.'));

  slides.push(table('Impact des Vacances sur le VIX',
    ['Période', 'Variation VIX Moy.', 'Win Rate', 'Volume', 'Risque Clé'],
    [
      ['Semaine Thanksgiving', '-2.1 pts', '78%', '-30%', 'Gap Black Friday'],
      ['Noël – Nouvel An', '-1.8 pts', '74%', '-40%', 'Reversal janvier'],
      ['Semaine 4 Juillet', '-1.2 pts', '70%', '-25%', 'Spikes faible liquidité'],
      ['Labor Day', '+0.8 pts', '62%', '+10%', 'Pré-positionnement sept.'],
      ['Doldrums Été (Jun-Aug)', '-0.4/sem', '55%', '-15%', 'Surprises août']
    ]
  ));

  slides.push(concept('L\'Effet Janvier en Volatilité',
    'Plus tradeable que la version equity : Semaine 1 de janvier, VIX monte de +1.8 pts (reset des budgets risque). Semaines 2-3 : continuation (earnings bancaires). Fin janvier : pic autour des earnings Big Tech, puis crush. Pattern observé dans 29 des 35 dernières années (83% hit rate).'));

  slides.push(quiz(
    'Quel mois affiche le VIX moyen le plus BAS historiquement ?',
    ['Avril (18.8)', 'Juillet (18.5)', 'Décembre (17.4)', 'Juin (19.0)'],
    2,
    'Décembre à 17.4 est le mois le plus bas, combinant la fin du tax-loss harvesting, le rebalancement institutionnel terminé, et les équipes squelettiques.'
  ));

  slides.push(table('Playbook Mensuel — Actions par Mois',
    ['Mois', 'Biais', 'Action'],
    [
      ['Janvier', 'Long Vol', 'Reset des risques + buildup earnings. Acheter calls VIX.'],
      ['Février', 'Short Vol', 'Post-earnings crush. Vendre du premium.'],
      ['Mars', 'Prudence', 'Quad Witching + Dot Plot FOMC. Trader le cycle FOMC.'],
      ['Avril', 'Short Vol', 'Plus bas VIX après décembre. Idéal pour vendre du premium.'],
      ['Mai', 'Prudence', '"Sell in May" commence. Mois de transition.'],
      ['Juin', 'Flat', 'Quad Witching + Doldrums. Faible conviction.'],
      ['Juillet', 'Short Vol', 'Plus bas VIX (18.5). Compression 4 juillet.'],
      ['Août', 'Long Vol', 'Surprises estivales. Acheter des puts OTM pas chers.'],
      ['Septembre', 'Long Vol', 'Pire mois historique. Rédemptions + fin année fiscale.'],
      ['Octobre', 'Prudence', 'Plus haut VIX mais creux de marché. Acheter sur panique.'],
      ['Novembre', 'Short Vol', 'Crush post-earnings + compression Thanksgiving.'],
      ['Décembre', 'Short Vol', 'Plus bas VIX (17.4). Santa Rally. Préparer le reversal janvier.']
    ]
  ));

  slides.push(steps('Framework de Stratégie Saisonnière (3 Couches)', [
    { step: 'Couche 1 : Biais mensuel', detail: 'Chaque mois reçoit un biais directionnel basé sur l\'historique du VIX. C\'est le point de départ.' },
    { step: 'Couche 2 : Overlay événementiel', detail: 'FOMC, earnings, OPEX, vacances modulent le biais. Timing précis dans le mois.' },
    { step: 'Couche 3 : Filtre de régime', detail: 'Les patterns saisonniers fonctionnent en régime normal (VIX 12-25). Si VIX > 30, les trades saisonniers sont OFF.' }
  ]));

  slides.push(warning('Règles de Risk Management Saisonnières', 'Règle 1 : VIX > 30 ou backwardation = tous les trades saisonniers OFF. Règle 2 : Taille = 25-50% de la taille normale. Règle 3 : Moyenne mensuelle + 1 écart-type = invalidation. Règle 4 : Saisonnalité seule = 65%. Avec positionnement + technique = 75%+.'));

  slides.push(summary('Chapitre 2 — Récap Saisonnalité', [
    'Pattern en U : bas début d\'année/été, pic sept-oct, effondrement fin d\'année',
    'Paradoxe d\'octobre : plus haut VIX mais aussi là où les creux se forment',
    'Cycle earnings 4x/an : buildup avant, crush après. Q4 = plus grand crush (-3.8 pts)',
    'FOMC : compression-release. Vente straddles T-1 → close T+2 = 71% WR',
    'OPEX supprime puis libère : semaine post-OPEX = 2.3x plus de grands mouvements',
    'Vacances : Thanksgiving (-2.1 pts, 78% WR), Noël (-1.8 pts)',
    'Tendances, PAS garanties : fonctionnent en régime normal, cassent en crise'
  ]));

  // ============================================================
  // CHAPITRE 3 — Le VIX comme Indicateur (~50 slides)
  // ============================================================

  slides.push(chapterIntro(3, 'Le VIX comme Indicateur', 'Signal contrariant, retour à la moyenne, VVIX, spreads de crédit et dashboard'));

  slides.push(concept('Le VIX : Indicateur Contrariant Puissant',
    'Les données sont remarquablement consistantes : plus le VIX est élevé à l\'entrée, plus les rendements futurs sont élevés. Acheter le SPY quand le VIX > 30 produit un rendement moyen de +22.4% sur 12 mois avec un win rate de 88% sur 6 mois. C\'est l\'un des résultats les plus robustes en finance quantitative.'));

  slides.push(table('Rendements Forward du SPX par Niveau de VIX à l\'Entrée',
    ['VIX à l\'entrée', '1 Mois', '3 Mois', '6 Mois', '12 Mois', 'Win Rate 6M'],
    [
      ['< 15', '+0.8%', '+2.1%', '+3.9%', '+7.1%', '62%'],
      ['15-20', '+1.1%', '+3.0%', '+5.4%', '+9.8%', '68%'],
      ['20-30', '+1.6%', '+4.5%', '+8.2%', '+14.3%', '76%'],
      ['30-40', '+2.8%', '+7.1%', '+12.6%', '+22.4%', '88%'],
      ['> 40', '+3.5%', '+9.8%', '+16.4%', '+28.7%', '92%']
    ]
  ));

  slides.push(bullets('Pourquoi le Signal Contrariant Fonctionne', [
    'Surréaction comportementale : les humains surpondèrent les événements négatifs récents',
    'Épuisement mécanique : à VIX > 30, les ventes forcées (appels de marge, risk parity) sont largement terminées',
    'Retour à la moyenne : la volatilité est la variable financière la plus mean-reverting qui existe'
  ]));

  slides.push(warning('Le Piège du Timing',
    'Le signal contrariant fonctionne mieux sur 3-6 mois que sur 1 jour. Acheter le premier jour où le VIX passe 30 peut signifier acheter dans une chute en cours. Le VIX peut aller de 30 à 50 à 80 (2008, 2020). Utiliser le SCALING : 25% à VIX 30, 25% à VIX 35, 25% à VIX 40, 25% à VIX 45+.'));

  slides.push(concept('Le Retour à la Moyenne — La Propriété la Plus Fiable',
    'Si vous ne pouvez connaître qu\'une chose sur le VIX, c\'est ceci : le VIX REVIENT TOUJOURS à la moyenne. Aucune autre variable financière n\'exhibe un retour à la moyenne aussi fort et consistant. Les actions peuvent trender des années. Les devises peuvent maintenir de nouveaux ranges indéfiniment. Mais le VIX revient TOUJOURS.'));

  slides.push(table('Vitesse de Retour à la Moyenne par Niveau de Spike',
    ['Niveau de Spike', 'Jours médians < 25', 'Jours médians < 20', 'Jours médians < 18', '% Réversion en 10 jours'],
    [
      ['VIX 25-30', '5 jours', '18 jours', '26 jours', '35%'],
      ['VIX 30-40', '8 jours', '22 jours', '34 jours', '42%'],
      ['VIX 40-50', '6 jours', '28 jours', '45 jours', '48%'],
      ['VIX > 50', '4 jours', '35 jours', '58 jours', '55%']
    ]
  ));

  slides.push(bullets('Études de Cas : Spike & Decay', [
    '2008 GFC : Pic 80.86 → < 50 en 15 jours, mais < 20 en ~350 jours (spike structurel)',
    '2011 Dégradation US : Pic 48.00 → < 20 en 45 jours, réversion 52% en 10 jours',
    '2015 Chine Flash Crash : Pic 40.74 → < 20 en 18 jours — l\'un des plus rapides',
    '2018 Volmageddon : Pic 37.32 → < 20 en 10 jours, réversion 47% en 10 jours',
    '2020 COVID : Pic 82.69 → < 40 en 8 jours, mais < 20 en ~170 jours (structurel)'
  ]));

  slides.push(comparison('Spikes Événementiels vs. Structurels',
    { label: 'Événementiel (2011, 2015, 2018)', items: [
      'Catalyseur unique et identifiable',
      'Réversion rapide en 2-4 semaines',
      'La structure sous-jacente est intacte',
      'Vendre agressivement après le spike'
    ]},
    { label: 'Structurel (2008, 2020)', items: [
      'Changement de régime fondamental',
      'Réversion lente sur des mois',
      'Conditions économiques persistantes',
      'Vendre prudemment, ou pas du tout'
    ]}
  ));

  slides.push(quiz(
    'Le VIX a spiké à 40. En combien de jours médians revient-il sous 25 ?',
    ['2 jours', '6 jours', '18 jours', '45 jours'],
    1,
    'Pour les spikes VIX 40-50, le retour sous 25 prend en médiane 6 jours. Contre-intuitivement, les spikes plus élevés revertent souvent plus vite en pourcentage.'
  ));

  slides.push(concept('Le Ratio VIX/VIX3M — Le Meilleur Outil de Timing',
    'Ce ratio compare la vol 30 jours à la vol 93 jours. C\'est potentiellement le SIGNAL DE TIMING LE PLUS PUISSANT de tout l\'écosystème de la volatilité. Il vous dit non seulement le niveau de peur, mais si cette peur est aiguë (événement) ou chronique (structurelle).'));

  slides.push(concept('Le Sweet Spot : Ratio > 1.0',
    'Quand le ratio VIX/VIX3M croise au-dessus de 1.0, les rendements 3 mois sont en moyenne de +6.8% avec un win rate de 82%. Le combo VIX > 30 ET ratio > 1.0 (25 occurrences depuis 1990) donne un rendement 6M moyen de +15.2% avec 91% de win rate.'));

  slides.push(concept('Le VVIX — La Volatilité de la Volatilité',
    'Le VVIX mesure la volatilité implicite des options SUR le VIX. C\'est l\'incertitude du marché sur sa propre incertitude. VVIX < 85 = complaisance extrême (risque de spike VIX). VVIX 90-110 = normal. VVIX > 120 = le marché attend de gros mouvements du VIX.'));

  slides.push(bullets('4 Divergences VVIX/VIX — Signaux Cachés', [
    'VVIX monte, VIX flat → "Calme avant la tempête" — acheter des puts SPY ou calls VIX',
    'VIX monte, VVIX baisse → Divergence haussière — le spike s\'épuise, signal d\'achat',
    'Les deux montent ensemble → "Tout brûle" — NE PAS acheter, attendre la divergence',
    'VVIX bas (< 85) + VIX bas (< 14) → Complaisance extrême — acheter protection pas chère'
  ]));

  slides.push(concept('VIX et Spreads de Crédit — Le Vrai Détecteur de Risque',
    'Le VIX mesure la peur equity. Les spreads de crédit mesurent la peur de solvabilité. Quand les deux spikent ensemble = risque réel. Quand seul le VIX spike avec crédit calme = correction technique qui va reverter. Monitorer le ratio HYG/TLT comme proxy en temps réel.'));

  slides.push(table('4 Scénarios VIX × Crédit',
    ['Scénario', 'VIX', 'HY Spreads', 'Interprétation', 'Win Rate Long SPY 1M'],
    [
      ['A', 'Spike', 'Calme', 'Correction technique — acheter', '78% (moy. +3.2%)'],
      ['B', 'Spike', 'Spike', 'Vrai risk-off — attendre', '52% (moy. +0.4%)'],
      ['C', 'Bas', 'S\'élargissent', 'Risque furtif — DANGER', '45% (moy. -1.8%)'],
      ['D', 'Bas', 'Serrés', 'Goldilocks — trend-following', '71% (moy. +1.5%)']
    ]
  ));

  slides.push(concept('Scénario A en Pratique : Août 2024',
    'Le 5 août 2024, VIX de 15 à 65 intraday — carry trade yen. Le SPY a chuté de 4.5% mais les spreads de crédit (HYG) ont à peine bougé (-1%). Le marché obligataire criait : "C\'est un événement technique !". Ceux qui ont acheté ont été récompensés par +8% en 3 semaines.'));

  slides.push(concept('Scénario B en Pratique : Mars 2020',
    'COVID : VIX et spreads de crédit ont spiké simultanément. HYG -22% du pic au creux, VIX à 82. Ceux qui ont acheté le spike initial sans vérifier le crédit ont subi 15% de baisse supplémentaire. Le vrai signal d\'achat est venu quand la Fed a annoncé le QE illimité le 23 mars.'));

  slides.push(steps('Le Framework 3-Check Avant d\'Acheter un Spike', [
    { step: 'Check 1 — HYG/TLT', detail: 'HYG sous-performe TLT de plus de 2% sur la semaine ? Si oui = stress crédit réel, ne pas se précipiter.' },
    { step: 'Check 2 — CDX Investment Grade', detail: 'Le spread CDX IG s\'est élargi de plus de 20bps sur la semaine ? Si oui = repricing du risque crédit institutionnel.' },
    { step: 'Check 3 — TED spread (SOFR-T-bill)', detail: 'Le spread interbancaire a spiké ? Si oui = crise de liquidité/financement, risque systémique possible.' }
  ]));

  slides.push(tip('Pourquoi le Crédit Mène l\'Equity',
    'Les investisseurs obligataires prêtent de l\'argent, pas des rêves. Ils se soucient d\'une seule chose : vais-je récupérer mon argent ? Quand ils exigent des spreads plus élevés, c\'est qu\'ils sont VRAIMENT inquiets. Le Scénario C (crédit s\'élargit, VIX calme) est le signal LE PLUS DANGEREUX.'));

  slides.push(quiz(
    'Lors d\'un spike VIX, quel scénario offre le MEILLEUR win rate pour acheter du SPY ?',
    ['Scénario A : VIX spike + crédit calme (78%)', 'Scénario B : VIX spike + crédit spike (52%)', 'Scénario C : VIX bas + crédit s\'élargit (45%)', 'Scénario D : VIX bas + crédit serré (71%)'],
    0,
    'Le Scénario A (VIX spike mais crédit calme) a un win rate de 78% car il indique une correction technique — le marché obligataire ne voit pas de risque fondamental.'
  ));

  slides.push(bullets('Le Dashboard VIX Quotidien — 5 Checks en 5 Minutes', [
    '1. Quel régime ? VIX < 15, 15-20, 20-30, ou > 30',
    '2. Structure par terme normale ? VIX/VIX3M ratio. > 1.0 = zone d\'achat contrariant',
    '3. Un spike VIX se prépare ? VVIX en hausse avec VIX plat = "calme avant tempête"',
    '4. Le crédit confirme ? HYG/TLT. VIX élevé + crédit calme = technique (acheter)',
    '5. Taux de changement du VIX ? VIX déjà +50% en 5 jours → plus probable de reverter'
  ]));

  slides.push(table('Matrice de Décision du Dashboard',
    ['VIX', 'Structure', 'VVIX', 'Crédit', 'Taille', 'Action'],
    [
      ['< 15', 'Contango', '< 90', 'Serré', '100%', 'Full risk-on. Trend-follow.'],
      ['15-20', 'Contango', '90-110', 'Normal', '75-100%', 'Standard. Pas d\'action spéciale.'],
      ['20-30', 'Flat', '110-120', 'Calme', '50-75%', 'Réduire expo. Élargir stops.'],
      ['> 30', 'Backw.', '> 120', 'Calme', '50% + scale', 'Scénario A : accumuler des longs.'],
      ['> 30', 'Backw.', '> 120', 'Spike', '25% max', 'Scénario B : attendre stabilisation.']
    ]
  ));

  slides.push(concept('Quand les Signaux VIX Échouent',
    'Un système qui marche 85% du temps est exceptionnel. Mais si les 15% d\'échecs coûtent 3x ce que vous avez gagné sur les 85%, vous êtes net négatif. Le signal contrariant VIX a exactement ce risque d\'asymétrie. Les échecs les plus notables : 2008 (VIX 30 → 80, SPX -40% encore), 2022 (4 faux signaux), et octobre 2018 (VIX 25 pas suffisant).'));

  slides.push(bullets('6 Red Flags — Quand NE PAS Acheter le Spike VIX', [
    '1. Spreads de crédit explosent (Scénario B = vrai risk-off)',
    '2. Backwardation persistante > 5 jours (changement de régime structurel)',
    '3. La Fed resserre activement (pression structurelle sur les multiples)',
    '4. Breadth s\'effondre (< 30% des actions SPX au-dessus de leur MM200)',
    '5. C\'est le 2ème ou 3ème spike dans une séquence (premier spike = meilleur WR)',
    '6. Institution financière majeure en détresse (Lehman, SVB)'
  ]));

  slides.push(concept('La Question Ultime : "2015 ou 2008 ?"',
    'Avant d\'acheter un spike, demandez-vous : c\'est un 2015 (événementiel, réversion rapide) ou un 2008 (structurel, grind lent) ? Le framework 3-Check (spreads crédit, CDX IG, TED spread) est votre meilleur outil pour distinguer les deux.'));

  slides.push(summary('Chapitre 3 — Récap VIX comme Indicateur', [
    'Signal contrariant puissant : VIX > 30 → +22% avg 12M, 88% WR sur 6M',
    'Mean reversion = propriété fondamentale. Événementiel = 2-4 sem. Structurel = mois.',
    'Ratio VIX/VIX3M > 1.0 = zone d\'achat contrariant (82% WR sur 3M)',
    'Divergences VVIX : VVIX monte + VIX plat = tempête imminente',
    'Confirmation crédit : VIX spike + crédit calme = technique, acheter (78% WR)',
    'Dashboard 5 checks chaque matin avant le marché',
    '6 Red Flags pour filtrer les 15% d\'échecs'
  ]));

  // ============================================================
  // CHAPITRE 4 — Trader le VIX (~50 slides)
  // ============================================================

  slides.push(chapterIntro(4, 'Trader le VIX', 'Futures, ETPs, options et 5 setups de trading'));

  slides.push(concept('On Ne Peut PAS Acheter le VIX Spot',
    'Le VIX est un indice calculé. Tout ce que vous tradez est un DÉRIVÉ D\'UN DÉRIVÉ : Options SPX → VIX → Futures VIX → ETPs VIX → Options sur futures VIX. Chaque couche ajoute des mécaniques, des coûts et de la complexité. La plupart des pertes retail viennent de ne pas comprendre à quelle couche ils sont exposés.'));

  slides.push(warning('L\'Erreur #1 des Particuliers',
    '"Le VIX est à 13, il doit monter, donc j\'achète UVXY et j\'attends." Cette logique a détruit plus de capital retail que presque tout autre trade. UVXY peut perdre 90%+ en un an même si le VIX spot termine l\'année au même niveau. La "taxe contango" broie les positions longues.'));

  slides.push(bullets('Les Futures VIX — La Base de Tout', [
    'Taille du contrat : 1,000$ × VIX. Un point de mouvement = 1,000$ par contrat',
    'Tick size : 0.05 points = 50$ par contrat',
    'Settlement : cash-settled sur la SOQ (Special Opening Quotation)',
    'Marge : typiquement 7,500-12,000$ par contrat',
    '9 expirations mensuelles + hebdomadaires pour les mois proches',
    'Trading quasiment 24h (dimanche 17h – vendredi 16h CT)'
  ]));

  slides.push(concept('La Courbe des Futures — Le Chart le Plus Important',
    'En contango (80% du temps), la courbe est ascendante : les mois proches sont moins chers que les mois éloignés. En backwardation (20%), la courbe s\'inverse. La PENTE de la courbe détermine le roll yield — le gain ou la perte que les ETPs subissent à chaque roulement de contrat.'));

  slides.push(concept('La Taxe Contango — Le Tueur Silencieux',
    'En contango, les ETPs long VIX comme VXX et UVXY doivent vendre le contrat en expiration (bas) et acheter le mois suivant (plus cher). Chaque jour. Ce roll négatif coûte typiquement 5-10% par mois, soit 40-70% par an. C\'est comme payer un loyer pour le privilège d\'être long volatilité.'));

  slides.push(table('La Mécanique de la Destruction (VIX spot flat à 18 sur 1 an)',
    ['Métrique', 'VIX Spot', 'VXX (1x)', 'UVXY (1.5x)'],
    [
      ['Valeur initiale', '18.00', '100$', '100$'],
      ['Coût mensuel de roll', 'N/A', '~5%', '~7.5%'],
      ['Après 3 mois', '18.00', '85.74$', '79.14$'],
      ['Après 6 mois', '18.00', '73.51$', '62.63$'],
      ['Après 12 mois', '18.00', '54.04$', '39.22$'],
      ['Perte annuelle', '0%', '-46%', '-61%']
    ]
  ));

  slides.push(tip('Quand le Contango Travaille POUR Vous',
    'Si le contango détruit les positions longues, il BÉNÉFICIE logiquement les positions short. SVXY (0.5x short VIX) et les stratégies qui vendent systématiquement les futures VIX capturent un roll yield positif. 30-50% par an en marchés calmes. Le piège ? Risque illimité si le VIX spike.'));

  slides.push(quiz(
    'Après 12 mois avec un VIX spot inchangé à 18, combien a perdu UVXY (1.5x long) ?',
    ['-20%', '-46%', '-61%', '-90%'],
    2,
    'UVXY perd environ 61% en 12 mois uniquement à cause du contango, même si le VIX spot n\'a pas bougé. Le roll négatif de ~7.5% par mois s\'accumule exponentiellement.'
  ));

  slides.push(table('Paysage des ETPs VIX',
    ['Ticker', 'Levier', 'Roll', 'Meilleur Usage'],
    [
      ['UVXY', '1.5x Long', 'Négatif (bleed)', 'Trades de spike court terme, day trading'],
      ['VXX', '1x Long', 'Négatif (bleed)', 'Hedges de portefeuille, paris modérés'],
      ['SVXY', '0.5x Short', 'Positif (harvest)', 'Revenu short vol, capture contango'],
      ['SVOL', '~0.25x Short + hedge', 'Positif (hedgé)', 'Revenu avec protection de queue'],
      ['VIXM', '1x Long Mid-Term', 'Moins négatif', 'Hedges long terme, moins de decay']
    ]
  ));

  slides.push(concept('Volmageddon — Le Jour Qui a Changé le Trading VIX',
    'Le 5 février 2018 : VIX de 17 à 37 intraday (+116%). L\'ETN XIV (1x inverse VIX, 2.1 milliards$ d\'actifs) a déclenché son "événement de terminaison" — perte de 96% → liquidation par Credit Suisse. 2 milliards$ détruits. SVXY restructuré de 1x à 0.5x short. Leçon : toujours dimensionner pour un TRIPLEMENT du VIX, pas un doublement.'));

  slides.push(concept('Les Options VIX — L\'Outil de Précision',
    'Les options VIX sont des options sur FUTURES VIX, pas sur VIX spot. Exercice européen uniquement. Cash-settled. Multiplicateur : 100$ par point. Un call VIX à 2.50$ coûte 250$. Pas de risque d\'assignation anticipée — perte max = prime payée.'));

  slides.push(steps('Exemple : VIX 20/35 Call Spread (Hedge de Queue)', [
    { step: 'Acheter VIX 20 Call à 2.00$ (coût : 200$)', detail: 'Profite si VIX dépasse 20 au settlement' },
    { step: 'Vendre VIX 35 Call à 0.80$ (crédit : 80$)', detail: 'Réduit le coût net' },
    { step: 'Coût net : 1.20$ (120$ par spread)', detail: 'Max profit : 13.80$ (1,380$) si VIX ≥ 35' },
    { step: 'Ratio R/R : 11.5 : 1', detail: 'Risquer 120$ pour gagner 1,380$. Breakeven : VIX SOQ à 21.20' }
  ]));

  slides.push(concept('Pourquoi les Institutions Adorent les Call Spreads VIX',
    'Le ratio de payoff 11:1 explique pourquoi les institutions utilisent les call spreads VIX comme "hedges de queue". Allouer 0.25-0.50% du portefeuille par mois à ces hedges. La plupart expirent sans valeur, mais le spike occasionnel paie des années de premiums.'));

  slides.push(bullets('Règles de Sizing pour Produits VIX', [
    '1-3% max du portefeuille sur une seule position VIX',
    '5% max d\'exposition VIX totale (futures + ETPs + options combinés)',
    'VIX peut bouger 50%+ en un jour. UVXY (1.5x) peut bouger 75%+',
    'ZÉRO levier additionnel sur les produits levierisés. JAMAIS marginer UVXY.',
    'Options long = risque défini (premium payé). Toujours préféré pour la plupart des traders.'
  ]));

  slides.push(comparison('Types de Stop Loss pour le VIX',
    { label: 'Fonctionnent', items: [
      'Stop temporel : max 3-5 jours pour UVXY, 5-10 pour VXX',
      'Stop en dollars : montant max de perte défini à l\'avance',
      'Stop sur niveau VIX : VIX > 30 = sortir les shorts vol'
    ]},
    { label: 'Ne fonctionnent PAS', items: [
      'Stops en pourcentage classiques (gaps, mouvements overnight)',
      'Trailing stops serrés (la vol des produits VIX les déclenche)',
      '"Je vais attendre que ça revienne" (contango mange tout)'
    ]}
  ));

  slides.push(quiz(
    'Quel produit VIX est le MIEUX adapté pour un hedge de portefeuille de 1-5 jours ?',
    ['SVXY (0.5x Short)', 'VXX (1x Long)', 'SVOL (Short + Hedge)', 'VIXM (Mid-Term)'],
    1,
    'VXX (1x Long) est adapté aux hedges de courte durée (1-5 jours). UVXY offre plus de capture de spike mais avec plus de decay. SVXY et SVOL sont SHORT vol — l\'opposé d\'un hedge.'
  ));

  slides.push(concept('Les 5 Setups du Playbook VIX — Vue d\'Ensemble',
    'Nous allons détailler 5 stratégies concrètes avec conditions d\'entrée, sortie, sizing et risk management. Ce ne sont pas des théories — ce sont des stratégies utilisées par les desks de volatilité et les traders retail informés.'));

  slides.push(steps('Setup 1 : Spike Fade — Vendre Vol Après un Spike Extrême', [
    { step: 'Entrée', detail: 'VIX > 35, VIX/VIX3M > 1.2, VIX clôture SOUS le plus haut de la veille (confirmation)' },
    { step: 'Instrument', detail: 'SVXY shares ou VIX put spread' },
    { step: 'Sizing', detail: '1% max du portefeuille' },
    { step: 'Stop', detail: 'VIX fait un nouveau plus haut au-dessus du spike d\'entrée' },
    { step: 'Cible', detail: 'VIX < 25 ou 50% du max du spread. Durée : 5-15 jours. Win rate : ~72%' }
  ]));

  slides.push(steps('Setup 2 : Pre-Event Hedge — Calls VIX Avant FOMC/CPI', [
    { step: 'Entrée', detail: '5 jours avant FOMC, CPI, NFP. VIX < 20 (protection pas chère)' },
    { step: 'Instrument', detail: 'VIX call spread (20/30 ou 22/32)' },
    { step: 'Sizing', detail: '0.25-0.50% du portefeuille' },
    { step: 'Stop', detail: 'Aucun — risque défini (premium payé)' },
    { step: 'Cible', detail: 'Fermer le jour après l\'événement. Win rate : ~35% mais R/R 5:1 compense.' }
  ]));

  slides.push(steps('Setup 3 : Contango Harvest — Shorter UVXY en Fort Contango', [
    { step: 'Entrée', detail: 'VIX < 18, contango > 7%, VIX/VIX3M < 0.85, SPX > 20-DMA' },
    { step: 'Instrument', detail: 'SVXY ou short UVXY + petit call spread VIX comme hedge' },
    { step: 'Sizing', detail: '2% max, entrer en 3 tranches progressives' },
    { step: 'Stop', detail: 'VIX > 25 = réduire 50%. VIX > 30 = sortie complète.' },
    { step: 'Cible', detail: 'Cycle de roll mensuel (15-20 jours). Win rate : ~80% mais pertes peuvent être sévères.' }
  ]));

  slides.push(steps('Setup 4 : Mean Reversion Swing — Put Spread VIX Après Élévation Prolongée', [
    { step: 'Entrée', detail: 'VIX > 25 pendant 5+ jours consécutifs, première clôture sous la SMA 5 jours' },
    { step: 'Confirmation', detail: 'VVIX en baisse, structure par terme s\'aplatit' },
    { step: 'Instrument', detail: 'VIX put spread (ex. 22/15)' },
    { step: 'Stop', detail: 'VIX fait un nouveau plus haut au-dessus du niveau d\'entrée' },
    { step: 'Cible', detail: 'VIX < 20 ou 60% de la valeur max du spread. Win rate : ~65%' }
  ]));

  slides.push(steps('Setup 5 : Tail Hedge — Position VIX Calls Permanente', [
    { step: 'Entrée', detail: 'Mensuelle — 60-90 DTE, systématique, quel que soit le niveau du VIX' },
    { step: 'Instrument', detail: 'VIX call spread (25-delta/10-delta)' },
    { step: 'Sizing', detail: '0.25-0.50% du portefeuille par mois' },
    { step: 'Gestion', detail: 'Aucun stop — hold to expiry. Si VIX > 35 : prendre 50% de profit.' },
    { step: 'Performance', detail: 'Win rate : ~15% mais gagnants paient 10-20x. EV positive sur un cycle complet.' }
  ]));

  slides.push(table('Résumé du Playbook',
    ['Setup', 'Direction', 'Win Rate', 'R/R', 'Fréquence/an', 'Difficulté'],
    [
      ['1. Spike Fade', 'Short Vol', '~72%', '2:1', '3-5x', 'Intermédiaire'],
      ['2. Pre-Event Hedge', 'Long Vol', '~35%', '5:1', '8-12x', 'Débutant'],
      ['3. Contango Harvest', 'Short Vol', '~80%', '1.5:1', '8-10x', 'Avancé'],
      ['4. Mean Reversion', 'Short Vol', '~65%', '3:1', '4-6x', 'Intermédiaire'],
      ['5. Tail Hedge', 'Long Vol', '~15%', '15:1', '12x', 'Débutant']
    ]
  ));

  slides.push(tip('L\'Espérance de Gain Compte Plus que le Win Rate',
    'Setup 5 (Tail Hedge) a 15% de WR — vous perdez 85% du temps. Pourtant c\'est l\'un des plus profitables sur un cycle. EV = (0.15 × 15) - (0.85 × 1) = +1.40 par unité risquée. Le win rate est de la vanité ; l\'espérance de gain est la raison.'));

  slides.push(summary('Chapitre 4 — Récap Trader le VIX', [
    'VIX spot n\'est PAS tradable — tout est dérivé de futures VIX',
    'La courbe des futures est roi : contango (80%) détruit les longs, bénéficie les shorts',
    'ETPs longs = tactiques (1-5 jours), JAMAIS stratégiques. Contango bleed = mort lente.',
    'Short vol = revenu stable JUSQU\'À CE QUE ça ne le soit plus (Volmageddon)',
    'Options VIX = meilleur R/R. Européennes, cash-settled, risque défini.',
    'Sizing : 1-3% max par position, 5% total. PAS de levier sur produits levierisés.',
    '5 setups : Spike Fade, Pre-Event, Contango Harvest, Mean Reversion, Tail Hedge'
  ]));

  // ============================================================
  // CHAPITRE 5 — Stratégies Avancées (~50 slides)
  // ============================================================

  slides.push(chapterIntro(5, 'Stratégies Avancées', 'Vol globale, dispersion, VRP, variance swaps, hedging de queue et le framework complet'));

  slides.push(concept('La Famille Mondiale de la Volatilité',
    'Le VIX n\'est que le début. Il existe des indices de volatilité pour chaque grand marché mondial : VSTOXX (Euro Stoxx 50), VDAX-NEW (DAX 40), VFTSE (FTSE 100), VXN (Nasdaq 100), Nikkei VI (Nikkei 225), VHSI (Hang Seng), VKOSPI (KOSPI 200), India VIX (Nifty 50).'));

  slides.push(table('Indices de Volatilité Mondiaux',
    ['Indice', 'Sous-jacent', 'Range Typique', 'Corrélation VIX', 'Driver Clé'],
    [
      ['VIX', 'S&P 500', '12-25', '1.00', 'Fed, earnings, macro US'],
      ['VSTOXX', 'Euro Stoxx 50', '15-30', '0.80-0.92', 'BCE, fragmentation politique, énergie'],
      ['VXN', 'Nasdaq 100', '16-35', '0.92-0.98', 'Earnings mega-cap tech'],
      ['Nikkei VI', 'Nikkei 225', '15-30', '0.65-0.82', 'BOJ, carry trade yen'],
      ['VHSI', 'Hang Seng', '18-40', '0.50-0.75', 'Régulation Chine, tensions US-CN'],
      ['India VIX', 'Nifty 50', '10-28', '0.45-0.65', 'Élections, RBI, flux retail']
    ]
  ));

  slides.push(concept('Pourquoi le VSTOXX Trade avec une Prime',
    'Le VSTOXX est typiquement 3-5 points au-dessus du VIX. Raisons : (1) plus grande fragmentation politique (20 risques souverains vs 1 aux US), (2) marché d\'options moins liquide avec des spreads bid-ask plus larges, (3) sensibilité plus élevée aux prix de l\'énergie. Pendant le Brexit, VSTOXX à 43 vs VIX à 26 — prime de 65%.'));

  slides.push(warning('La Convergence des Corrélations en Crise',
    'En dessous de VIX 20, les indices régionaux peuvent diverger selon les facteurs locaux. MAIS au-dessus de VIX 30-35, TOUTES les corrélations convergent vers 0.90+. En crise (Mars 2020, Août 2015), chaque indice vol bouge en parfait unisson. Vous NE POUVEZ PAS hedger le VIX en shortant le VHSI.'));

  slides.push(concept('La Composition du S&P 500 a Changé Fondamentalement',
    'S&P 500 en 2006 : Top 5 = ~12% (ExxonMobil, GE, Microsoft, Citi, BofA). S&P 500 en 2026 : Top 7 = ~32% (Apple, Microsoft, NVIDIA, Amazon, Alphabet, Meta, Tesla). La concentration a presque triplé. Le VIX est devenu un proxy de la vol tech mega-cap.'));

  slides.push(table('Impact de la Concentration sur le VIX',
    ['Métrique', 'S&P 2006', 'S&P 2026', 'Impact VIX'],
    [
      ['Poids Top 5', '~12%', '~28%', '+2-3 pts de plancher structurel'],
      ['Poids Top 10', '~20%', '~36%', 'Événements single-stock bougent le VIX'],
      ['Poids secteur tech', '~15%', '~35%', 'VIX = proxy vol tech'],
      ['Range VIX "normal"', '10-14', '14-18', 'Baseline décalé vers le haut']
    ]
  ));

  slides.push(tip('Ajuster le VIX pour la Composition',
    'Un VIX de 15 aujourd\'hui approxime un VIX de 12 en 2005 en termes de diversification sous-jacente. Goldman Sachs et JPMorgan estiment que 2-3 points du VIX actuel sont attribuables à la concentration seule. Quand on dit "VIX élevé à 18", le VIX ajusté est plutôt 15-16 — normal.'));

  slides.push(quiz(
    'Quel pourcentage du S&P 500 les 7 plus grandes actions représentent-elles en 2026 ?',
    ['~12%', '~20%', '~25%', '~32%'],
    3,
    'Le Magnificent 7 (Apple, Microsoft, NVIDIA, Amazon, Alphabet, Meta, Tesla) représente ~32% du S&P 500 en 2026, contre ~12% pour le Top 5 en 2006.'
  ));

  slides.push(concept('La Transmission Cross-Market de la Volatilité',
    'Quand un spike vol se produit, il se propage à travers les 3 fuseaux horaires en séquence prévisible : Phase 1 (US) → Phase 2 (Asie, 12-14h après) → Phase 3 (Europe, puis feedback vers les US). ~70% des spikes vol mondiaux trouvent leur origine aux US.'));

  slides.push(steps('Le Relais Volatilité en 3 Phases', [
    { step: 'Phase 1 : US (16h-21h ET)', detail: 'Catalyseur US (CPI, Fed, earnings). VIX spike +3-10 pts. USD se renforce. Futures Nikkei/DAX/FTSE gappent à la baisse.' },
    { step: 'Phase 2 : Asie (9h-15h JST)', detail: 'Marchés asiatiques ouvrent dans le choc. Nikkei VI spike 1.2-1.5x le mouvement VIX. Carry trade yen amplifie.' },
    { step: 'Phase 3 : Europe & Feedback (9h-17h30 CET)', detail: 'VSTOXX match 80-100% du mouvement VIX. Puis feedback : pre-market US réagit au selloff mondial cumulé.' }
  ]));

  slides.push(concept('Exception : Transmission Inverse (Asie → US)',
    'Le 5 août 2024, la BOJ a augmenté ses taux de manière inattendue. Le Nikkei a chuté de 12% (pire depuis 1987), Nikkei VI > 70. Le VIX a ouvert à 38 le lendemain SANS catalyseur US. Les spikes de transmission inverse revertent généralement plus VITE car l\'économie US n\'est pas directement touchée.'));

  slides.push(concept('Le Trading de Dispersion',
    'La dispersion exploite l\'écart entre la vol d\'indice et les vols de single-stocks. Le concept clé : les options d\'indice intègrent une "corrélation implicite". Quand la corrélation réelle est inférieure à celle pricée, les traders de dispersion profitent.'));

  slides.push(concept('Mécanique Simplifiée de la Dispersion',
    'Vendre un straddle sur l\'indice + acheter des straddles sur les actions individuelles. Si la corrélation implicite est 0.70 mais la réalisée n\'est que 0.50, l\'indice bouge moins que pricé → votre short expire pour moins → profit. Les stocks individuels bougent autant → vos longs break even.'));

  slides.push(comparison('Quand la Dispersion Fonctionne vs. Explose',
    { label: 'Fonctionne (corrélation basse)', items: [
      'Saisons d\'earnings : stocks gap ±5-15%, indice bouge peu',
      'Rotation sectorielle : tech vend, énergie monte',
      'VIX en baisse : corrélation implicite diminue',
      'Indice corrélation implicite < 50'
    ]},
    { label: 'Explose (corrélation haute)', items: [
      'Crashes macro : tout vend ensemble (corrélation → 1)',
      'VIX > 35 : corrélation implicite surge à 0.80+',
      'Mars 2020 : corrélation à 0.95+ pendant des semaines',
      'Concentration : Mag 7 fait bouger l\'indice seul'
    ]}
  ));

  slides.push(concept('La Prime de Risque de Volatilité (VRP) — Le Concept Central',
    'Le VRP est l\'écart persistant entre l\'IV et la RV. En moyenne, l\'IV surestime la RV de 2-4 points. Si le VIX est à 18, la vol réalisée 30 jours sera typiquement 14-16. Cet écart est la "prime d\'assurance" — les acheteurs d\'options paient systématiquement trop, les vendeurs récoltent cette prime. C\'est l\'équivalent de la prime de risque equity pour les traders de vol.'));

  slides.push(bullets('Statistiques Clés du VRP', [
    'VRP moyen depuis 1990 : ~3.2 points (VIX - vol réalisée 30j)',
    '85% du temps, le VIX dépasse la vol réalisée subséquente',
    '15% du temps, la vol réalisée dépasse le VIX (DANGER)',
    'Des fonds de plusieurs milliards $ sont bâtis sur la récolte systématique du VRP'
  ]));

  slides.push(quiz(
    'Quel pourcentage du temps la volatilité implicite (VIX) dépasse-t-elle la volatilité réalisée ?',
    ['50%', '65%', '85%', '95%'],
    2,
    'L\'IV dépasse la RV environ 85% du temps. C\'est la base de toute l\'industrie de la vente de volatilité — les acheteurs d\'options paient systématiquement plus que ce que le marché va effectivement bouger.'
  ));

  slides.push(bullets('3 Façons de Récolter le VRP', [
    '1. Short strangles SPX/SPY : vendre puts et calls OTM, 30-45 DTE, 16-delta. Le plus pur mais risque illimité → utiliser des iron condors.',
    '2. Short futures VIX (roll down) : en contango, le front-month converge vers le spot. SVXY automatise ça. Risque : catastrophe en spike.',
    '3. Vente de puts sur indices : cash-secured ou put spreads SPY 5-10% sous le spot. Le CBOE PUT Index surperforme le SPX sur 30+ ans en risk-adjusted.'
  ]));

  slides.push(warning('Quand le VRP S\'Inverse — Zone de Danger',
    'Si la vol réalisée 10 jours dépasse le VIX de 3+ points → ARRÊTER de vendre de la vol IMMÉDIATEMENT. Ce VRP inversé a précédé chaque crash majeur des 20 dernières années : février 2018 (VIX à 13, RV 10j grimpant à 20 → Volmageddon), février 2020 (VIX à 15, RV montant → COVID crash).'));

  slides.push(concept('Variance Swaps — L\'Instrument des Pros',
    'Un variance swap est un contrat où vous pariez si la variance réelle (vol²) sera supérieure ou inférieure à un niveau convenu. Avantage clé : CONVEXITÉ. Si la vol double de 20 à 40, un vol swap paie 20 (linéaire). Un variance swap paie 1,600 - 400 = 1,200 (exponentiel). Les variance swaps sont des hedges de queue NATURELS.'));

  slides.push(table('Variance Swap vs Vol Swap vs Futures VIX',
    ['Feature', 'Variance Swap', 'Vol Swap', 'Futures VIX'],
    [
      ['Payoff', 'Linéaire en variance (convexe en vol)', 'Linéaire en vol', 'Linéaire en VIX'],
      ['Sensibilité queue', 'Très haute', 'Modérée', 'Haute mais limitée'],
      ['Utilisateurs', 'Hedge funds, vol desks', 'Corporates, certains fonds', 'Retail, ETPs'],
      ['Liquidité', 'OTC seulement, institutionnel', 'OTC, moins liquide', 'Exchange, très liquide'],
      ['Coût de roll', 'Aucun', 'Aucun', 'Significatif (contango)'],
      ['Capital requis', '5M$+ notionnel', '1M$+', '10K$+ (1 contrat)']
    ]
  ));

  slides.push(bullets('Approximation Retail des Variance Swaps', [
    'VIX call spreads (ex. 20/35) : le call long fournit la convexité, le short cap le risque',
    'VIX call ratio backspread (1x2) : vendre 1 ATM, acheter 2 OTM. Coût ~0$. Profits accélèrent si VIX monte.',
    'SPX put ratio backspread : vendre 1 ATM put, acheter 2 far OTM puts. Profite de manière disproportionnée en crash.',
    'Limitation : ces structures expirent. Les variance swaps n\'ont pas de coût de roll.'
  ]));

  slides.push(concept('Le Hedging de Risque de Queue — La Philosophie',
    'Le hedging de queue accepte de petites pertes constantes en échange de payoffs MASSIFS pendant les crises. L\'idée : la majeure partie du drawdown d\'un investisseur vient d\'une poignée d\'événements extrêmes. Protégez-vous contre ceux-là, et vous pouvez être plus agressif le reste du temps. Universa : +3,612% en mars 2020.'));

  slides.push(table('Stratégies de Hedging de Queue Comparées',
    ['Stratégie', 'Coût Annuel', 'Payoff en crash -30%', 'Complexité', 'Idéal Pour'],
    [
      ['VIX Calls (35-50 strike)', '0.5-1.5%', '+15-50% portfolio', 'Basse', 'Simple, set-and-forget'],
      ['SPX Put Spreads', '0.8-2.0%', '+10-25% portfolio', 'Moyenne', 'Coût-conscious, défini'],
      ['Barbell Taleb', '0.3-0.8% net', '+5-15% portfolio', 'Basse', 'Long terme, antifragile'],
      ['VIX Call Ratio Backspread', '~0%', '+10-30% portfolio', 'Haute', 'Traders sophistiqués'],
      ['Pas de hedge', '0%', '-30% portfolio', 'Aucune', 'Croyants du time-in-market']
    ]
  ));

  slides.push(concept('Le Barbell de Taleb',
    '90% dans les actifs les plus sûrs possibles (T-bills, obligations court terme) + 10% dans les paris les plus convexes (options far OTM, calls VIX, positions asymétriques). Le génie : ÉLIMINER le milieu. Pas de positions "risque modéré" qui donnent l\'illusion de sécurité mais s\'effondrent en crise.'));

  slides.push(tip('Gestion du Bleed — Le Problème Comportemental',
    'Le plus grand défi du hedging de queue est le coût constant. 1-2% par an qui expire sans valeur. Sur 5 ans calmes = 5-10% de rendement sacrifié. Solutions : (1) utiliser des spreads pour réduire le coût, (2) acheter plus de protection quand VIX est bas (c\'est pas cher), (3) accepter que le bleed est le prix pour rester dans le jeu.'));

  slides.push(quiz(
    'Quelle stratégie a le MEILLEUR ratio risque/rendement pour un hedge de queue ?',
    ['Acheter des puts SPY ATM', 'VIX Call Spreads 20/35 (R/R 11:1)', 'Shorter UVXY', 'Acheter des T-bills'],
    1,
    'Les VIX Call Spreads offrent un R/R de 11:1 — risquer 120$ pour potentiellement gagner 1,380$. Les puts ATM sont plus chers et sans la convexité du VIX.'
  ));

  slides.push(steps('L\'Arbre de Décision en 6 Étapes — Le Framework Complet', [
    { step: 'Étape 1 : Vérifier niveau VIX + régime', detail: '< 15 = acheter protection. 15-25 = VRP harvesting. 25-35 = defined-risk only, taille ÷ 2. > 35 = mean reversion après stabilisation.' },
    { step: 'Étape 2 : Vérifier structure par terme', detail: 'Contango = roll-down strategies viables. Backwardation = attendre 3+ jours après le pic pour trades de mean reversion.' },
    { step: 'Étape 3 : Vérifier saisonnalité', detail: 'Sept-Oct = réduire vente de vol. Juil-Déc = lean into vol selling. Ajuster sizing selon le calendrier.' },
    { step: 'Étape 4 : Confirmation cross-asset', detail: 'VIX seul vs VIX + crédit + MOVE + DXY + vol globale. Multi-confirmation = plus probable de persister.' },
    { step: 'Étape 5 : Sélectionner l\'instrument', detail: 'Vendre vol → options SPX. Acheter vol → calls VIX/puts SPX. Jamais ETPs VIX > 1 semaine.' },
    { step: 'Étape 6 : Dimensionner', detail: 'Max 2-3% par trade vol. Max 5% total. Si un mouvement VIX de 20 pts impacterait votre portfolio de > 5%, c\'est trop gros.' }
  ]));

  slides.push(table('Le Framework Complet — Référence Rapide',
    ['VIX', 'Régime', 'Stratégie Primaire', 'Instrument', 'Taille Max'],
    [
      ['< 15', 'Complaisance', 'Acheter protection, tail hedges', 'VIX calls, SPX put spreads', '1-2%'],
      ['15-20', 'Normal', 'Récolter VRP (vendre premium)', 'SPX put spreads, iron condors', '2-3%'],
      ['20-25', 'Légèrement élevé', 'VRP sélectif + protection', 'Défini-risque uniquement', '1.5-2%'],
      ['25-35', 'Peur', 'Vente vol défini-risque OU attendre', 'Iron condors larges, VIX put spreads', '1%'],
      ['> 35', 'Crise', 'Mean reversion (après stabilisation)', 'VIX call spreads (vente), time spreads', '0.5-1%']
    ]
  ));

  slides.push(concept('Les 10 Commandements du Trading de Volatilité — Synthèse Finale',
    'En 5 parties, nous avons construit une compréhension complète de la volatilité. Distillons tout en 10 principes fondamentaux forgés par des décennies de trading institutionnel.'));

  slides.push(bullets('Les 10 Commandements (Partie 1)', [
    'I. Ne confondez JAMAIS VIX et volatilité. C\'est un prix d\'assurance, pas de la peur.',
    'II. Respectez le retour à la moyenne. Chaque spike > 30 s\'est résolu en 1-6 mois. Mais utilisez du risque défini.',
    'III. Surveillez la structure par terme. Contango vs backwardation raconte plus que le niveau.',
    'IV. Ne vendez JAMAIS de vol nue avec taille. Utilisez des spreads. Un événement de queue efface des années de primes.',
    'V. Ajustez pour la composition. VIX 15 en 2026 ≠ VIX 15 en 2005. La concentration a triplé.'
  ]));

  slides.push(bullets('Les 10 Commandements (Partie 2)', [
    'VI. Cross-vérifiez avec d\'autres indices de vol. VIX spike sans confirmation VSTOXX/crédit = événement local.',
    'VII. Respectez la saisonnalité. Sept-Oct = haute vol. Juil-Déc = basse. FOMC, OPEX, earnings = patterns prévisibles.',
    'VIII. Maintenez un hedge de queue. 0.5-1.5% annuel en convexité far OTM. Le meilleur moment d\'acheter = quand "la vol est morte".',
    'IX. Surveillez l\'inversion du VRP. Vol réalisée 10j > VIX de 3+ pts = ARRÊTER de vendre vol immédiatement.',
    'X. Réduisez la taille. Puis réduisez encore. Chaque blowup en vol vient d\'un sizing excessif. LTCM, Volmageddon, XIV.'
  ]));

  slides.push(quote(
    'La volatilité est la seule classe d\'actifs où être en avance, c\'est la même chose qu\'avoir tort.',
    'Sagesse de la volatilité'
  ));

  slides.push(concept('Le Mot de la Fin',
    'Vous pouvez avoir raison sur la direction de la vol et quand même perdre de l\'argent à cause du timing, du coût de roll, ou du decay. Un call VIX acheté une semaine trop tôt peut expirer sans valeur même si le VIX spike finalement à 40. En trading de vol, le timing N\'EST PAS juste important — c\'est TOUT. Le sizing et le risque défini sont non-négociables.'));

  slides.push(quiz(
    'Quelle est la règle de sizing maximum recommandée pour l\'exposition VIX totale d\'un portefeuille ?',
    ['1% max', '5% max', '10% max', '20% max'],
    1,
    '5% max d\'exposition VIX totale combinée (futures + ETPs + options). Chaque position individuelle ne devrait pas dépasser 2-3%. Si un mouvement VIX de 20 pts impacterait votre portfolio de plus de 5%, réduisez.'
  ));

  slides.push(summary('Chapitre 5 — Récap Stratégies Avancées', [
    'Famille mondiale : VSTOXX, VXN, Nikkei VI, VHSI, India VIX — corrélation converge en crise',
    'Composition du S&P a changé : Top 7 = 32% → VIX est un proxy tech mega-cap',
    'Transmission cross-market : US → Asie → Europe → feedback en 24h',
    'Dispersion : vendre vol d\'indice, acheter vol single-stock (short corrélation)',
    'VRP : IV > RV 85% du temps. Récolte = business model de milliards$. STOP si VRP s\'inverse.',
    'Variance swaps : convexes, hedges de queue naturels. Retail → call ratio backspreads',
    'Hedging de queue : 0.5-1.5%/an en convexité. Barbell Taleb = 90% sûr + 10% convexe',
    'Framework 6 étapes : Régime → Structure → Saison → Cross-asset → Instrument → Sizing'
  ]));

  slides.push(summary('SYNTHÈSE FINALE — Maîtrise du VIX en 8 Points', [
    '1. Le VIX mesure le prix de l\'assurance SPX 30 jours, pas la peur',
    '2. Mean reversion est la propriété la plus fiable — mais timing = tout',
    '3. Structure par terme + VVIX + crédit = le toolkit de timing complet',
    '4. Saisonnalité donne un edge de 65-75% en régime normal — jamais en crise',
    '5. Les ETPs VIX sont des outils tactiques (jours), JAMAIS stratégiques',
    '6. Le VRP est la source de revenu la plus fiable en vol — mais le 15% d\'échecs peut tuer',
    '7. Hedges de queue permanents (0.5-1.5%/an) = le prix de rester dans le jeu',
    '8. Sizing > direction > timing. Si votre position vous empêche de dormir, divisez par 2.'
  ]));

  return slides;
}

function generateAlgoMillion() {
  slideIndex = 0;
  const slides = [];

  // ============================================================
  // INTRODUCTION GENERALE (~5 slides)
  // ============================================================
  slides.push(concept(
    'Algo Trading : De 100K au Million',
    'Bienvenue dans cette formation complete de 2 heures. On va parcourir les 12 piliers du trading algorithmique : de l\'infrastructure technique jusqu\'au scaling au-dela du million. Objectif : transformer 100 000 euros en 1 000 000 euros en 24 mois, sans levier, long only, avec un drawdown maximum de 25%.'
  ));

  slides.push(bullets('Ce que vous allez apprendre', [
    'Partie 1-2 : Infrastructure cloud et pipeline de donnees',
    'Partie 3-4 : Alpha factors et construction de portefeuille',
    'Partie 5 : Execution et microstructure de marche',
    'Partie 6-7 : Strategies momentum et mean-reversion',
    'Partie 8-9 : Cross-asset, rotation sectorielle et regime ML',
    'Partie 10 : Mise en production et monitoring',
    'Partie 11-12 : Vivre de son algo et scaling'
  ]));

  slides.push(table(
    'Les mathematiques de l\'objectif',
    ['Parametre', 'Valeur'],
    [
      ['Capital initial', '100 000 euros'],
      ['Capital cible', '1 000 000 euros'],
      ['Horizon', '24 mois'],
      ['CAGR requis', '~216% (faisable en algo multi-strategie)'],
      ['Return mensuel moyen', '~10.4% par mois'],
      ['Max Drawdown', '25% maximum'],
      ['Levier', 'Aucun (margin 1:1)'],
      ['Direction', 'Long only']
    ]
  ));

  slides.push(concept(
    'Pourquoi 8-12 strategies complementaires ?',
    'Aucune strategie seule ne peut fournir un CAGR de 216%. C\'est la combinaison et la gestion dynamique de 8 a 12 strategies decorrelees qui rend l\'objectif atteignable. Le momentum seul crash en bear market. La mean-reversion seule stagne en bull. Ensemble, elles se compensent et lissent la courbe de performance.'
  ));

  slides.push(table(
    'La trajectoire realiste sur 24 mois',
    ['Mois', 'Equity', 'PnL mensuel'],
    [
      ['0', '100 000 euros', '-'],
      ['3', '118 000 euros', '~5 500 euros/mois'],
      ['6', '142 000 euros', '~7 200 euros/mois'],
      ['9', '173 000 euros', '~9 800 euros/mois'],
      ['12', '215 000 euros', '~13 000 euros/mois'],
      ['15', '278 000 euros', '~18 500 euros/mois'],
      ['18', '370 000 euros', '~26 000 euros/mois'],
      ['24', '1 000 000 euros', '~40 000 euros/mois']
    ]
  ));

  slides.push(warning(
    'Ce n\'est PAS un schema pour devenir riche rapidement',
    'Ces chiffres supposent un systeme multi-strategie parfaitement calibre, un Sharpe de 1.5-2.0, et ZERO retrait pendant 18 mois. Un seul drawdown de 25% au mauvais moment peut retarder l\'objectif de 6 mois. Le risque est reel. Ce plan necessite une expertise technique de niveau professionnel, pas un copier-coller d\'indicateurs.'
  ));

  // ============================================================
  // CHAPITRE 1 : INFRASTRUCTURE (slides 5-19)
  // ============================================================
  slides.push(chapterIntro(1, 'Infrastructure & Stack Technique', 'VM cloud, Interactive Brokers, Python stack, securite'));

  slides.push(table(
    'L\'architecture cible : cout total ~60 euros/mois',
    ['Composant', 'Technologie', 'Cout/mois'],
    [
      ['VM Cloud', 'Hetzner CPX41 (8 vCPU, 16 GB)', '~30 euros'],
      ['Broker', 'Interactive Brokers Pro', '~10 euros'],
      ['Language', 'Python 3.12 + Rust extensions', 'Gratuit'],
      ['Database', 'TimescaleDB + DuckDB', 'Gratuit'],
      ['Orchestration', 'systemd + cron + healthcheck', 'Gratuit'],
      ['AI Assistant', 'Claude Code', '~20 dollars'],
      ['Alertes', 'Discord webhooks', 'Gratuit']
    ]
  ));

  slides.push(concept(
    'Pourquoi une VM cloud et pas votre ordinateur ?',
    'Une VM cloud plutot qu\'un PC local pour des raisons critiques : uptime 99.99% (pas de coupure de courant ou d\'internet), latence reseau reduite (datacenters proches des exchanges), et isolation de l\'environnement de production. Votre PC est pour le developpement, la VM est pour la production. Si votre chat marche sur le clavier pendant un rebalancement, c\'est game over.'
  ));

  slides.push(comparison(
    'VM Cloud : quel provider choisir ?',
    { label: 'Hetzner (recommande)', items: [
      'CPX41 : 8 vCPU, 16 GB pour ~28 euros/mois',
      'Datacenters EU (Falkenstein, Nuremberg)',
      '~80ms de latence vers NYSE',
      'Meilleur rapport qualite/prix du marche'
    ]},
    { label: 'AWS / DigitalOcean', items: [
      'AWS c6a.2xlarge : ~200 dollars/mois',
      'DigitalOcean Premium : ~96 dollars/mois',
      'Meilleure latence (~5-10ms)',
      'Surdimensionne pour du trading daily/swing'
    ]}
  ));

  slides.push(concept(
    'Interactive Brokers : le broker de reference',
    'IBKR Pro est le seul broker qui offre : acces a 150+ marches mondiaux, API complete (TWS API / ib_insync), commissions ultra-competitives ($0.0035/action), market data gratuit avec plus de 10K d\'equity, et le Securities Lending Program. Toujours utiliser IB Gateway (headless, plus stable que TWS) sur les ports 4001 (live) et 4002 (paper).'
  ));

  slides.push(table(
    'Configuration IBKR pour l\'algo trading',
    ['Setting', 'Valeur', 'Pourquoi'],
    [
      ['Account Type', 'Individual Pro (pas Lite !)', 'Pro = routing direct, pas de PFOF'],
      ['Base Currency', 'EUR', 'Evite les frais de conversion pour les achats EU'],
      ['API Connection', 'IB Gateway (headless)', 'Plus stable et moins gourmand que TWS'],
      ['API Port', '4001 (live) / 4002 (paper)', 'Standard IBKR'],
      ['Max Order Rate', '50 orders/seconde', 'Suffisant pour daily/swing']
    ]
  ));

  slides.push(tip(
    'Le mode Paper Trading : votre meilleur ami',
    'Testez TOUT en paper trading avant de passer en live. Le port 4002 d\'IBKR simule exactement les conditions reelles : fills, rejections, pacing violations. Un changement de code = minimum 2 semaines en paper avant le live. La discipline sauve votre capital.'
  ));

  slides.push(table(
    'Le stack Python production-grade',
    ['Categorie', 'Package', 'Role'],
    [
      ['Broker API', 'ib_insync', 'Interface IBKR asynchrone'],
      ['Data', 'pandas + polars', 'Polars 10x plus rapide pour le backtest'],
      ['ML/Stats', 'scikit-learn, xgboost', 'Regimes, facteurs, classification'],
      ['Backtest', 'vectorbt', '1000x plus rapide que l\'event-driven'],
      ['Optimization', 'scipy, cvxpy', 'Portfolio optimization, risk budgeting'],
      ['Database', 'psycopg2, duckdb', 'TimescaleDB + analytics locale'],
      ['Monitoring', 'prometheus_client, structlog', 'Metriques + logging JSON']
    ]
  ));

  slides.push(steps('Workflow Claude Code : l\'arme secrete', [
    { step: 'Design & Spec', detail: 'VOUS definissez l\'architecture, les contraintes, les metriques cibles. Claude ne comprend pas votre alpha.' },
    { step: 'Implementation', detail: 'CLAUDE ecrit le code Python, les tests, les configs. Prompt detaille = code production-grade.' },
    { step: 'Debug & Optimisation', detail: 'CLAUDE analyse les logs, identifie les bugs, optimise les performances automatiquement.' },
    { step: 'Validation', detail: 'VOUS validez les resultats et prenez les decisions strategiques. Claude accelere votre boucle x10.' }
  ]));

  slides.push(table(
    'Securite de la VM : les mesures non-negociables',
    ['Mesure', 'Implementation', 'Criticite'],
    [
      ['SSH', 'Cle ED25519, port non standard, no password', 'Critique'],
      ['Firewall', 'UFW : seuls SSH + IBKR 4001/4002', 'Critique'],
      ['Secrets', 'Variables d\'environnement ou Vault', 'Critique'],
      ['2FA IBKR', 'IBKR Mobile Auth obligatoire', 'Critique'],
      ['Kill switch', 'Script qui liquide TOUTES les positions en urgence', 'Critique'],
      ['Backups', 'Daily backup chiffre vers S3', 'Critique'],
      ['fail2ban', 'Ban apres 3 tentatives, 24h de ban', 'Important']
    ]
  ));

  slides.push(warning(
    'Le kill switch est vital',
    'Un script qui liquide toutes les positions en une seule commande est absolument critique. En cas de bug, de crash du systeme, ou d\'evenement de marche extreme, vous devez pouvoir tout couper en quelques secondes. Testez-le regulierement en paper trading.'
  ));

  slides.push(summary('Infrastructure : points cles', [
    'VM Hetzner CPX41 (~30 euros/mois) + IBKR Pro = infrastructure complete pour ~60 euros/mois',
    'Stack Python : ib_insync, polars, vectorbt, xgboost, TimescaleDB',
    'Claude Code accelere le developpement x10 : vous definissez le quoi, Claude fait le comment',
    'Securite non negociable : SSH hardened, firewall, 2FA IBKR, kill switch'
  ]));

  // ============================================================
  // CHAPITRE 2 : DATA PIPELINE (slides 20-33)
  // ============================================================
  slides.push(chapterIntro(2, 'Data Pipeline & Feature Engineering', 'Ingestion multi-sources, 50 features, stockage, qualite des donnees'));

  slides.push(quote(
    'Les donnees sont le petrole du trading algorithmique. Sans donnees propres, vos strategies backtestent sur du bruit.',
    'Principe fondamental du quant'
  ));

  slides.push(concept(
    'Le pipeline qui separe les amateurs des pros',
    'Un data pipeline robuste est la fondation invisible de tout systeme de trading. Sans donnees propres, vos strategies backtestent sur du bruit. Le pipeline doit gerer : l\'ingestion multi-sources (IBKR, Yahoo, SEC EDGAR), le nettoyage (splits, dividendes, fusions), le stockage efficace (Parquet + DuckDB + TimescaleDB), et le feature engineering systematique.'
  ));

  slides.push(steps('Architecture du pipeline en 5 etapes', [
    { step: 'Ingestion', detail: 'Fetchers asynchrones pour 6 sources : IBKR (bars), Yahoo Finance (quotes), SEC EDGAR (13F, Form 4), FRED (macro), News APIs, Alternative data' },
    { step: 'Validation', detail: 'Chaque barre est validee : pas de trous, volumes coherents, prix dans les bornes. Les anomalies sont flaggees, pas supprimees.' },
    { step: 'Ajustement', detail: 'Corporate actions : splits, dividendes, fusions, spin-offs. C\'est le probleme que 95% des backtests ignorent.' },
    { step: 'Feature Engineering', detail: '50 features calculees en pipeline : momentum, value, quality, volatilite, sentiment, technique.' },
    { step: 'Stockage', detail: 'Feature Store : Parquet pour l\'historique, DuckDB pour l\'analytique, TimescaleDB pour le temps reel.' }
  ]));

  slides.push(warning(
    'Corporate Actions : le piege mortel du backtest',
    'Un split 4:1 d\'Apple transforme un cours de 500$ en 125$. Si votre backtest ne l\'ajuste pas retroactivement, il voit une chute de -75% et genere un faux signal de mean-reversion. Les dividendes non ajustes faussent tous les calculs de rendement. Toujours utiliser des prix ajustes (adjusted close), et verifier les corporate actions MANUELLEMENT sur les penny stocks.'
  ));

  slides.push(table(
    'Les 50 features : 6 familles',
    ['Famille', 'Nombre', 'Horizon optimal', 'Sharpe typique'],
    [
      ['Momentum', '12 facteurs', '1-12 mois', '0.4-0.8'],
      ['Value', '8 facteurs', '6-24 mois', '0.2-0.5'],
      ['Quality', '6 facteurs', '12-36 mois', '0.3-0.6'],
      ['Volatility/Risk', '8 facteurs', '1-4 semaines', '0.3-0.7'],
      ['Sentiment/Flow', '10 facteurs', '1-5 jours', '0.2-0.5'],
      ['Technical/Pattern', '8 facteurs', '1-10 jours', '0.1-0.4']
    ]
  ));

  slides.push(table(
    'Les 6 sources de donnees qui couvrent le monde',
    ['Source', 'Donnees', 'Frequence'],
    [
      ['IBKR (TWS API)', 'Bars OHLCV, positions, ordres', 'Temps reel'],
      ['Yahoo Finance', 'Quotes, financials, splits, dividendes', 'Daily'],
      ['SEC EDGAR', 'Form 4 (insiders), 13F (institutionnels)', 'Trimestriel'],
      ['FRED', 'Taux, inflation, PMI, chiffres macro', 'Mensuel'],
      ['News APIs', 'Titres, sentiment FinBERT', 'Temps reel'],
      ['Alternative Data', 'Social sentiment, flows, short interest', 'Daily']
    ]
  ));

  slides.push(concept(
    'Le stockage optimal : Parquet + DuckDB + TimescaleDB',
    'Parquet : format colonnaire ultra-compact pour l\'historique. 10 ans de donnees pour 3000 symboles en moins de 2 Go. DuckDB : moteur SQL analytique en memoire pour les requetes ad-hoc et les backtests. TimescaleDB : PostgreSQL avec extension time-series pour les requetes en production avec indexation temporelle optimisee.'
  ));

  slides.push(concept(
    'Feature Store : l\'entrepot du quant solo',
    'Le Feature Store stocke toutes les features pre-calculees, pret-a-servir pour le backtest et le live trading. Architecture : Parquet partitionne par date pour l\'historique (rapide a lire en batch), DuckDB pour les requetes analytiques ad-hoc, TimescaleDB pour les queries temps reel en production. Point-in-time retrieval est obligatoire pour eviter le look-ahead bias.'
  ));

  slides.push(tip(
    'Qualite des donnees : la paranoia qui sauve votre capital',
    'Implementez des checks automatiques : alertes si plus de 5% de donnees manquantes un jour, detection des prix aberrants (> 3 sigma du jour precedent), verification que le nombre de symboles dans l\'univers ne change pas brutalement. Un pipeline silencieux qui ingere des donnees corrompues est pire que pas de pipeline du tout.'
  ));

  slides.push(summary('Data Pipeline : points cles', [
    '6 sources de donnees : IBKR, Yahoo, SEC EDGAR, FRED, News, Alternative data',
    'Corporate actions (splits, dividendes) : le probleme ignore par 95% des backtests',
    '50 features en 6 familles : momentum, value, quality, volatilite, sentiment, technique',
    'Feature Store avec point-in-time retrieval pour eviter le look-ahead bias',
    'Qualite des donnees : checks automatiques, alertes, paranoia productive'
  ]));

  slides.push(concept(
    'Le point-in-time retrieval : eviter le look-ahead bias',
    'Le look-ahead bias est le peche mortel du backtesting. Il consiste a utiliser des donnees qui n\'etaient pas encore disponibles au moment de la decision. Exemple : utiliser les earnings Q4 publies en fevrier pour une decision de trading en janvier. Le Feature Store doit GARANTIR qu\'on ne voit que les donnees disponibles a la date de simulation. Un seul bug de ce type invalide tout le backtest.'
  ));

  slides.push(comparison(
    'Parquet vs TimescaleDB : quand utiliser quoi ?',
    { label: 'Parquet (batch/backtest)', items: [
      'Format colonnaire ultra-compact',
      '10 ans de donnees en < 2 Go',
      'Lecture sequentielle tres rapide',
      'Ideal pour vectorbt et les backtests massifs'
    ]},
    { label: 'TimescaleDB (production/live)', items: [
      'Requetes SQL temps reel optimisees',
      'Indexation temporelle native',
      'Compression automatique de l\'historique',
      'Ideal pour le trading engine en production'
    ]}
  ));

  // QUIZ 1 (apres ~25 slides)
  slides.push(quiz(
    'Pourquoi utilise-t-on Polars plutot que Pandas pour le backtest ?',
    [
      'Polars a une meilleure documentation',
      'Polars est environ 10x plus rapide grace a son execution parallele',
      'Polars supporte plus de formats de fichiers',
      'Polars est ecrit en Python pur'
    ],
    1,
    'Polars est ecrit en Rust et exploite le parallelisme natif, ce qui le rend environ 10 fois plus rapide que Pandas pour les operations de backtest sur de gros datasets. C\'est crucial quand on traite 3000 symboles sur 10 ans de donnees.'
  ));

  // ============================================================
  // CHAPITRE 3 : ALPHA FACTORS (slides ~34-48)
  // ============================================================
  slides.push(chapterIntro(3, 'Alpha Factors & Signal Research', '50+ facteurs, processus de recherche, anti-overfit'));

  slides.push(quote(
    'Un facteur sans justification economique est du data mining. Le data mining produit des backtests magnifiques et des pertes reelles.',
    'Principe de recherche alpha'
  ));

  slides.push(concept(
    'Qu\'est-ce qu\'un alpha factor ?',
    'Un alpha factor est une variable predictive qui capture une anomalie de marche exploitable. La recherche academique a identifie des centaines de facteurs, mais seuls environ 50 restent profitables apres couts de transaction et ajustement pour le data mining bias. Chaque facteur doit avoir une justification economique AVANT de regarder les donnees.'
  ));

  slides.push(table(
    'Les 12 facteurs Momentum : les plus puissants',
    ['Facteur', 'Calcul', 'IC moyen'],
    [
      ['MOM_12_1', 'Return 12 mois excluant le dernier mois', '0.04-0.06'],
      ['MOM_6_1', 'Return 6 mois excluant le dernier mois', '0.03-0.05'],
      ['ACCEL_MOM', 'Acceleration : MOM_6_1 - MOM_12_7', '0.03-0.05'],
      ['EARNINGS_MOM', 'Surprise de resultats standardisee (SUE)', '0.04-0.07'],
      ['REVISION_MOM', 'Variation du consensus EPS 1 mois', '0.03-0.06'],
      ['IDIO_MOM', 'Momentum residuel apres Fama-French 5 facteurs', '0.03-0.05'],
      ['PRICE_52W', 'Prix / 52-week high', '0.03-0.05'],
      ['VOL_MOM', 'Return x (Volume / Volume_avg_20)', '0.02-0.04']
    ]
  ));

  slides.push(concept(
    'Le momentum : l\'anomalie la plus robuste de la finance',
    'Documente par Jegadeesh & Titman en 1993, le momentum persiste depuis 200 ans sur tous les marches. Pourquoi ca marche : sous-reaction des investisseurs aux bonnes nouvelles, herding des institutionnels, disposition effect des particuliers (vendre les gagnants trop tot). Son risque connu : les momentum crashes (mars 2009, novembre 2020).'
  ));

  slides.push(tip(
    'Le MOM_12_1 : le roi des facteurs',
    'Le momentum 12 mois excluant le dernier mois est le facteur le plus cite en finance academique. Pourquoi exclure le dernier mois ? Parce que le dernier mois capture le "short-term reversal" (les gagnants recents sous-performent a 1 mois). En excluant ce mois, on isole le momentum pur de moyen terme, qui est le signal le plus propre et le plus stable.'
  ));

  slides.push(concept(
    'IC : Information Coefficient, la mesure du signal',
    'L\'IC est la correlation entre le facteur et les rendements futurs. Un IC de 0.03 parait faible, mais sur 3000 actions avec rebalancement mensuel, ca genere un alpha significatif. La regle : IC > 0.02 est exploitable, IC > 0.05 est excellent, IC > 0.10 est suspicieux (verifier l\'overfitting). L\'IC Decay mesure combien de temps le signal reste predictif.'
  ));

  slides.push(table(
    'Facteurs Value & Quality',
    ['Facteur', 'Calcul', 'IC'],
    [
      ['FCF_YIELD', 'Free Cash Flow / Enterprise Value', '0.03-0.05'],
      ['E/P', '1 / Forward P/E', '0.02-0.04'],
      ['EBITDA_EV', 'EBITDA / Enterprise Value', '0.02-0.04'],
      ['ROE', 'Net Income / Equity', '0.02-0.04'],
      ['PIOTROSKI_F', 'F-Score (9 criteres binaires)', '0.03-0.05'],
      ['ACCRUALS', '(NI - CFO) / Total Assets', '0.02-0.04'],
      ['GROSS_MARGIN', 'Gross Profit / Revenue', '0.02-0.03']
    ]
  ));

  slides.push(bullets('Facteurs Sentiment & Alternatifs', [
    'SOCIAL_MOMENTUM : variation 7j du volume de mentions positives (StockTwits)',
    'SHORT_INTEREST_CHG : variation du short interest sur 14 jours',
    'INSIDER_BUY : achats insiders net / Market Cap sur 30 jours (IC 0.03-0.06)',
    'OPTIONS_SKEW : IV Put 25 delta / IV Call 25 delta',
    'NEWS_SENTIMENT : score NLP des news 7 derniers jours (FinBERT)',
    'FLOW_IMBALANCE : net institutional flow (13F trimestriel)'
  ]));

  slides.push(steps('Le Research Process anti-overfit', [
    { step: 'Economic Prior', detail: 'Chaque facteur DOIT avoir une justification economique AVANT l\'analyse. Si la reponse est vague, rejeter.' },
    { step: 'Univers Disjoint', detail: 'Tester sur un univers DIFFERENT de celui de la production. Si ca marche dans les deux, c\'est robuste.' },
    { step: 'Walk-Forward OOS', detail: 'JAMAIS de backtest in-sample uniquement. Walk-forward avec train/test splits disjoints. CPCV pour le scoring.' },
    { step: 'Deflated Sharpe', detail: 'Corriger le Sharpe pour le nombre de tests effectues. Un Sharpe de 1.0 trouve apres 1000 tests vaut zero.' }
  ]));

  slides.push(table(
    'Combinaison des facteurs : methodes',
    ['Methode', 'IC boost', 'Risque d\'overfit', 'Recommandation'],
    [
      ['Equal Weight', 'x racine(N)', 'Zero', 'Baseline, toujours tester en premier'],
      ['IC-Weighted', 'Legerement meilleur', 'Faible', 'Ameliore l\'equal-weight'],
      ['Ridge Regression', 'Optimal lineaire', 'Modere', 'Bon compromis perf/robustesse'],
      ['XGBoost', 'Non-lineaire x2-3', 'Eleve', 'Uniquement avec CPCV strict'],
      ['Neural Network', 'Variable', 'Tres eleve', 'Non recommande a notre taille']
    ]
  ));

  slides.push(warning(
    'Le danger numero 1 : l\'overfitting',
    'Avec 50+ facteurs et 20 ans de donnees, il est trivial de trouver une combinaison qui backtest a 200%+ de CAGR. Mais cette combinaison ne survivra pas en production. Le processus de recherche doit etre concu pour MINIMISER l\'overfitting a chaque etape. Si ca semble trop beau pour etre vrai, ca l\'est probablement.'
  ));

  slides.push(concept(
    'La magie de la combinaison : IC composite en racine de N',
    'Si chaque facteur a un IC de 0.03 et qu\'ils sont peu correles entre eux, la combinaison de N facteurs augmente l\'IC composite proportionnellement a racine de N. Avec 10 facteurs independants, l\'IC passe de 0.03 a environ 0.095. C\'est le multiplicateur gratuit de la diversification des signaux.'
  ));

  slides.push(summary('Alpha Factors : points cles', [
    '50+ facteurs en 6 familles : Momentum (le plus puissant), Value, Quality, Volatilite, Sentiment, Technique',
    'Chaque facteur doit avoir un economic prior AVANT l\'analyse de donnees',
    'Process anti-overfit : Prior economique, Univers disjoint, Walk-Forward, Deflated Sharpe',
    'Combinaison : Equal-weight en baseline, Ridge Regression en sweet spot'
  ]));

  // QUIZ 2 (~50 slides)
  slides.push(quiz(
    'Qu\'est-ce que le Deflated Sharpe Ratio ?',
    [
      'Le Sharpe ajuste pour l\'inflation',
      'Le Sharpe corrige pour le nombre de tests effectues (data mining)',
      'Le Sharpe calcule sur une periode plus courte',
      'Le Sharpe divise par la volatilite du benchmark'
    ],
    1,
    'Le Deflated Sharpe Ratio de Bailey & Lopez de Prado corrige le Sharpe observe pour le nombre de strategies testees. Plus vous testez de variantes, plus vous avez de chances de trouver un Sharpe eleve par hasard. Le DSR penalise cette exploration pour donner un Sharpe "reel".'
  ));

  // ============================================================
  // CHAPITRE 4 : PORTFOLIO CONSTRUCTION (slides ~50-65)
  // ============================================================
  slides.push(chapterIntro(4, 'Portfolio Construction & Optimisation', 'Kelly Criterion, HRP, Risk Budgeting, contraintes'));

  slides.push(concept(
    'Pourquoi la construction de portefeuille est le vrai edge',
    'La majorite des traders algo passent 90% de leur temps sur les signaux alpha et 10% sur la construction de portefeuille. C\'est une erreur fondamentale. Un excellent allocateur avec des signaux moyens bat systematiquement un mauvais allocateur avec d\'excellents signaux. L\'alpha d\'un signal decroit avec le crowding, mais l\'alpha de construction de portefeuille est structurel et durable.'
  ));

  slides.push(concept(
    'Kelly Criterion : la formule qui maximise la croissance',
    'f* = mu / sigma carre. C\'est la fraction optimale de capital a risquer pour maximiser le taux de croissance geometrique. Mais le Full Kelly genere des drawdowns insoutenables (50-70%). On utilise le Half-Kelly qui maintient 75% de la croissance optimale tout en limitant le drawdown max a environ 25%, exactement notre contrainte.'
  ));

  slides.push(table(
    'Kelly fractionnel : quel niveau choisir ?',
    ['Fraction', 'Croissance vs Full', 'Volatilite', 'Max DD typique', 'Avis'],
    [
      ['Full Kelly (1.0)', '100%', '~40%', '50-70%', 'Theorique uniquement'],
      ['3/4 Kelly (0.75)', '94%', '~30%', '35-50%', 'Agressif'],
      ['Half Kelly (0.50)', '75%', '~20%', '20-30%', 'NOTRE CHOIX'],
      ['Quarter Kelly (0.25)', '44%', '~10%', '10-15%', 'Conservateur']
    ]
  ));

  slides.push(concept(
    'Le shrinkage bayesien : l\'astuce critique',
    'Le Kelly standard surestime le sizing car il prend les rendements historiques au pied de la lettre. Le shrinkage bayesien tire les estimations vers un prior sceptique (mu = 0). Resultat : une strategie avec 500 trades et Sharpe 1.2 garde ~95% de son Kelly brut, mais une strategie avec 30 trades et Sharpe 2.5 ne garde que ~37%. Scepticisme proportionnel a l\'incertitude.'
  ));

  slides.push(steps('HRP : l\'alternative moderne a Markowitz', [
    { step: 'Tree Clustering', detail: 'Calculer la matrice de correlation, convertir en distance, appliquer le clustering agglomeratif. Resultat : un dendrogramme.' },
    { step: 'Quasi-Diagonalisation', detail: 'Reordonner les actifs selon l\'ordre du dendrogramme. Les actifs similaires sont cote a cote, creant une structure quasi-diagonale.' },
    { step: 'Recursive Bisection', detail: 'Diviser recursivement le portefeuille en deux clusters. Allouer le capital inversement proportionnel a la variance de chaque cluster.' }
  ]));

  slides.push(table(
    'Comparatif des methodes d\'allocation (backtest 2010-2025)',
    ['Methode', 'CAGR', 'Sharpe', 'Max DD', 'Calmar'],
    [
      ['Equal Weight', '12.4%', '0.65', '-34.2%', '0.36'],
      ['Risk Parity', '10.8%', '0.72', '-22.1%', '0.49'],
      ['Min Variance', '8.6%', '0.81', '-18.5%', '0.46'],
      ['HRP', '13.1%', '0.82', '-19.8%', '0.66'],
      ['Kelly + HRP', '18.7%', '0.91', '-24.3%', '0.77']
    ]
  ));

  slides.push(bullets('Les 4 piliers de la construction de portefeuille', [
    'Sizing : combien allouer a chaque position ? (Kelly Criterion)',
    'Diversification : comment decorrelees les positions ? (HRP, Risk Parity)',
    'Contraintes : quelles limites hard imposer ? (max 10% par position, 30% par secteur)',
    'Dynamique : comment reallouer dans le temps ? (Meta-allocateur adaptatif au regime)'
  ]));

  slides.push(concept(
    'Pourquoi pas Markowitz ?',
    'L\'optimisation Mean-Variance de Markowitz avec 500 actifs necessite d\'estimer 125 250 parametres dans la matrice de covariance. Toute erreur d\'estimation est amplifiee par l\'inversion de la matrice, produisant des poids extremes et instables. En pratique, le simple equal-weight bat souvent Markowitz out-of-sample. HRP resout ce probleme sans inversion de matrice.'
  ));

  slides.push(concept(
    'Risk Budgeting : chaque strategie a son budget de risque',
    'Au lieu d\'allouer du capital, on alloue du RISQUE. Chaque strategie recoit un budget de risque proportionnel a son Sharpe historique et a la confiance qu\'on lui accorde. La confiance se calcule sur 4 dimensions : nombre de trades (30%), stabilite OOS (35%), anciennete live (20%), coherence economique (15%).'
  ));

  slides.push(summary('Portfolio Construction : points cles', [
    'Half-Kelly pour le sizing : 75% de la croissance optimale, DD max ~25%',
    'HRP (Lopez de Prado, 2016) remplace Markowitz : pas d\'inversion de matrice',
    'Kelly + HRP = meilleur Calmar ratio (0.77 vs 0.36 pour equal-weight)',
    'Risk Budgeting avec score de confiance sur 4 dimensions'
  ]));

  // QUIZ 3 (~65 slides)
  slides.push(quiz(
    'Pourquoi n\'utilise-t-on PAS l\'optimisation de Markowitz ?',
    [
      'Parce qu\'elle est trop lente a calculer',
      'Parce qu\'elle necessite des donnees en temps reel',
      'Parce qu\'elle amplifie les erreurs d\'estimation de la matrice de covariance',
      'Parce qu\'elle ne fonctionne qu\'avec des obligations'
    ],
    2,
    'L\'optimisation Mean-Variance de Markowitz est un amplificateur d\'erreurs d\'estimation. Avec 500 actifs, la matrice de covariance a 125 250 parametres a estimer. Toute erreur est amplifiee par l\'inversion de la matrice, produisant des poids extremes et instables. HRP resout ce probleme sans inversion.'
  ));

  // ============================================================
  // CHAPITRE 5 : EXECUTION (slides ~66-78)
  // ============================================================
  slides.push(chapterIntro(5, 'Execution & Market Microstructure', 'OMS, routage intelligent, slippage, multi-marches'));

  slides.push(quote(
    'L\'execution est le dernier kilometre du trading algo. Un signal parfait mal execute est un signal perdant.',
    'Principe de microstructure'
  ));

  slides.push(concept(
    'La microstructure : ce qui se passe vraiment',
    'La microstructure etudie comment les prix se forment tick par tick. Comprendre le spread bid-ask, la profondeur du carnet, et le market impact est la difference entre perdre 0.5% par trade en slippage (catastrophique sur 1000 trades/an) et gagner 0.05% en execution alpha. Modele d\'impact : sigma x racine(Q/V).'
  ));

  slides.push(table(
    'Impact de marche par type d\'actif',
    ['Type', 'ADV typique', 'Spread moyen', 'Fenetre d\'execution'],
    [
      ['US Large-Cap (AAPL)', '$5B+', '1-2 bps', 'Market order OK'],
      ['US Mid-Cap', '$100-500M', '3-8 bps', 'Limit order'],
      ['US Small-Cap', '$10-100M', '10-30 bps', 'TWAP 30min'],
      ['EU Large-Cap (ASML)', '200M-1B euros', '5-15 bps', 'Limit order'],
      ['EU Mid-Cap', '20-200M euros', '15-40 bps', 'TWAP 1h'],
      ['ETF (SPY, QQQ)', '$20B+', '1 bps', 'Market order OK']
    ]
  ));

  slides.push(warning(
    'La regle des 1% ADV',
    'Ne JAMAIS placer un ordre representant plus de 1% du volume quotidien moyen (ADV) en un seul bloc. Au-dela, le market impact devient significatif et potentiellement detectable par les predateurs HFT. Pour un portefeuille de 100K euros, cette contrainte est rarement atteinte sur les large-caps mais critique sur les small-caps EU.'
  ));

  slides.push(bullets('L\'OMS : le systeme nerveux de l\'execution', [
    'Pre-trade checks : position finale OK ? Taille < 1% ADV ? Marche ouvert ? Pas de doublon ?',
    'Routing intelligent : Large-cap urgent = ADAPTIVE, Small-cap = TWAP, Cloture = LOC',
    'Cycle de vie complet : PENDING > VALIDATED > SUBMITTED > PARTIAL_FILL > FILLED',
    'Fill management : relancer les partial fills, annuler apres TTL, logger le slippage',
    'Post-trade : slippage en bps = (fill_price - decision_price) / decision_price x 10000'
  ]));

  slides.push(comparison(
    'Algorithmes d\'execution',
    { label: 'TWAP (Time-Weighted)', items: [
      'Decouper l\'ordre en tranches egales dans le temps',
      'Simple et previsible',
      'Ideal pour les small-caps',
      'Risque : vulnerable si le prix bouge fort'
    ]},
    { label: 'VWAP (Volume-Weighted)', items: [
      'Calibrer la taille des tranches sur le profil de volume',
      'Plus sophistique, meilleur prix moyen',
      'Ideal pour les mid-caps liquides',
      'Necessite un modele de volume intraday'
    ]}
  ));

  slides.push(table(
    'Pre-trade Risk Checks : les garde-fous en temps reel',
    ['Check', 'Regle', 'Si viole'],
    [
      ['Position finale', 'Respecte les contraintes du portefeuille', 'Rejet de l\'ordre'],
      ['Taille vs ADV', '< 1% du volume quotidien moyen', 'Split en TWAP'],
      ['Marche ouvert', 'Le marche est ouvert pour ce symbole', 'Mise en queue'],
      ['Anti-doublon', 'Pas de meme symbole+side en 5 minutes', 'Rejet + alerte'],
      ['Capital dispo', 'Cash + ventes en cours suffisants', 'Rejet'],
      ['Trading halt', 'Pas de suspension sur ce symbole', 'Rejet + alerte']
    ]
  ));

  slides.push(concept(
    'Multi-marches : gestion des fuseaux horaires',
    'Trader US + EU + APAC implique 3 sessions avec des chevauchements partiels. APAC ouvre quand l\'EU dort, l\'EU ouvre quand les US dorment. Le scheduler doit gerer les jours feries specifiques a chaque bourse (Golden Week au Japon, etc.). Toujours stocker les timestamps en UTC et convertir au moment de l\'affichage.'
  ));

  slides.push(summary('Execution : points cles', [
    'Comprendre la microstructure : spread, depth, market impact',
    'Regle des 1% ADV : ne jamais depasser en un seul bloc',
    'OMS avec pre-trade checks, routing intelligent, et post-trade analysis',
    'TWAP pour les small-caps, VWAP pour les mid-caps, Market pour les large-caps',
    'Gestion multi-timezone : tout en UTC, calendriers de chaque bourse'
  ]));

  // ============================================================
  // CHAPITRE 6 : MOMENTUM STRATEGIES (slides ~79-95)
  // ============================================================
  slides.push(chapterIntro(6, 'Strategies Momentum Cross-Region', '4 strategies, backtest 2010-2025, code complet'));

  slides.push(concept(
    'Le momentum : le facteur le mieux documente en finance',
    'Les actions qui ont bien performe sur les 3-12 derniers mois tendent a continuer de bien performer. Ce phenomene persiste depuis 200 ans, sur tous les marches. Quatre explications : sous-reaction aux bonnes nouvelles, herding institutionnel, disposition effect des particuliers, et achat mecanique par les ETF indiciels.'
  ));

  slides.push(table(
    'Les 4 strategies momentum et leur role',
    ['Strategie', 'Univers', 'Holding', 'Allocation'],
    [
      ['Cross-Section Momentum (CSM)', '1500 actions US+EU+APAC', '1 mois', '20%'],
      ['Time-Series Momentum (TSMOM)', '50 ETF sectoriels + pays', '1-3 mois', '16%'],
      ['Post-Earnings Drift (PEAD)', 'Actions post-earnings surprise', '5-20 jours', '15%'],
      ['Industry Rotation', '11 secteurs GICS', '1 mois', '14%']
    ]
  ));

  slides.push(concept(
    'CSM : le classique revisite',
    'Acheter les gagnants, eviter les perdants. Notre version enrichit le signal avec un momentum composite multi-facteurs : 40% MOM_12_1 + 25% MOM_6_1 + 20% ACCEL_MOM + 15% proximite 52W High. Filtre qualite obligatoire : ROE > 5%, Debt/Equity < 3, Revenue growth > -20%. Top 30 positions, rebalancement mensuel.'
  ));

  slides.push(table(
    'Resultats backtest CSM (2010-2025)',
    ['Metrique', 'CSM Long-Only', 'SPY'],
    [
      ['CAGR', '24.3%', '13.2%'],
      ['Sharpe Ratio', '1.35', '0.72'],
      ['Max Drawdown', '-22.1%', '-33.9%'],
      ['Calmar Ratio', '1.10', '0.39'],
      ['Win Rate (mois)', '64%', '62%'],
      ['Avg win / Avg loss', '1.8', '-']
    ]
  ));

  slides.push(tip(
    'Le filtre qualite : eviter les "momentum traps"',
    'Un momentum trap est une action qui monte fort pour de mauvaises raisons : short squeeze, pump & dump, speculation sans fondamentaux. Le filtre qualite (ROE > 5%, dette raisonnable, revenus en croissance) elimine 15-20% des candidats mais ameliore le Sharpe de 0.2-0.3 points. La qualite n\'est pas optionnelle, elle est structurelle.'
  ));

  slides.push(concept(
    'TSMOM : le trend following sur ETF',
    'Contrairement au CSM (relatif : quoi acheter), le TSMOM est absolu : faut-il etre investi ? Si un actif a un trend positif sur 12 mois, on est long. Si negatif, on est cash (long-only = pas de short). S\'applique a un univers de 50 ETF sectoriels et regionaux. Le TSMOM est le gardien macro du portefeuille.'
  ));

  slides.push(bullets('Filtres qualite pour eviter les momentum traps', [
    'ROE > 5% : exclure les zombies qui montent sur du short squeeze',
    'Debt/Equity < 3 : exclure les surendettes vulnerables',
    'Revenue growth > -20% : exclure les entreprises en declin structurel',
    'Pas d\'earnings dans les 5 prochains jours : eviter la volatilite pre-annonce',
    'Short interest < 20% : eviter les short squeezes non fondamentaux'
  ]));

  slides.push(concept(
    'Industry Rotation : surfer les cycles economiques',
    'Les 11 secteurs GICS ne performent pas en meme temps. La tech surperforme en expansion, l\'energie en late-cycle, la sante en recession. Le signal combine : PMI manufacturing, yield curve slope, credit spreads, et momentum sectoriel relatif. Rebalancement mensuel sur les 3-4 secteurs les plus forts.'
  ));

  slides.push(concept(
    'PEAD : Post-Earnings Announcement Drift',
    'Les actions qui publient des resultats superieurs aux attentes tendent a continuer de monter pendant 5 a 20 jours apres l\'annonce. C\'est la sous-reaction du marche a l\'information. Signal : SUE (Standardized Unexpected Earnings) > 2. Holding court (5-20 jours), alpha evenementiel pur, decorrelees du momentum classique.'
  ));

  slides.push(warning(
    'Le momentum crash : le talon d\'Achille',
    'CSM a subi un drawdown de -22.1% en mars 2020 (COVID). Quand le marche se retourne violemment, les gagnants recents chutent plus que le marche. C\'est EXACTEMENT pourquoi on combine avec la mean-reversion (Partie 7) et un detecteur de regime (Partie 9) qui reduit l\'allocation momentum en Risk-Off.'
  ));

  slides.push(summary('Strategies Momentum : points cles', [
    '4 strategies complementaires : CSM, TSMOM, PEAD, Industry Rotation',
    'CSM = moteur principal (CAGR 24.3%, Sharpe 1.35)',
    'TSMOM = gardien macro (bascule en cash quand le trend est negatif)',
    'PEAD = alpha evenementiel (5-20 jours post-earnings)',
    'Risque connu : momentum crashes => combinaison avec mean-reversion obligatoire'
  ]));

  // QUIZ 4 (~95 slides)
  slides.push(quiz(
    'Quelle est la difference entre CSM et TSMOM ?',
    [
      'CSM est plus rapide que TSMOM',
      'CSM compare les actions entre elles (relatif), TSMOM mesure le trend absolu',
      'TSMOM trade des actions individuelles, CSM trade des ETF',
      'CSM est une strategie de mean-reversion'
    ],
    1,
    'Le Cross-Section Momentum (CSM) est RELATIF : il classe les actions entre elles et achete les meilleures. Le Time-Series Momentum (TSMOM) est ABSOLU : il mesure si le trend d\'un actif est positif ou negatif, independamment des autres. CSM dit "quoi acheter", TSMOM dit "faut-il etre investi".'
  ));

  // ============================================================
  // CHAPITRE 7 : MEAN REVERSION (slides ~96-112)
  // ============================================================
  slides.push(chapterIntro(7, 'Mean Reversion & Statistical Arbitrage', 'RSI Bounce, Pairs Trading, Bollinger Reversion'));

  slides.push(concept(
    'Le yin du yang momentum',
    'Le momentum dit : ce qui monte continuera de monter (horizon 1-12 mois). La mean-reversion dit : ce qui baisse trop fort rebondira (horizon 1-10 jours). Les deux sont vrais simultanement mais sur des horizons differents. Cette complementarite est la cle d\'un portefeuille resilient.'
  ));

  slides.push(table(
    'Autocorrelation par horizon temporel',
    ['Horizon', 'Autocorrelation', 'Strategie dominante', 'Sharpe'],
    [
      ['1-5 jours', 'Negative (-0.05 a -0.10)', 'Mean Reversion', '0.6-1.0'],
      ['1-4 semaines', 'Environ zero', 'Neutre / PEAD', '-'],
      ['1-12 mois', 'Positive (+0.05 a +0.15)', 'Momentum', '0.8-1.5'],
      ['3-5 ans', 'Negative (-0.10 a -0.20)', 'Value / Long-term MR', '0.4-0.7']
    ]
  ));

  slides.push(steps('RSI Oversold Bounce : acheter la panique', [
    { step: 'Signal d\'entree', detail: 'RSI(14) < 25 ET Prix > EMA(200) ET Volume > 1.5x moyenne 20j ET action d\'indice majeur' },
    { step: 'Filtres de securite', detail: 'Pas d\'earnings dans les 5 prochains jours. RSI pas reste < 30 pendant plus de 10 jours consecutifs (evite les falling knives)' },
    { step: 'Entree', detail: 'Achat a l\'ouverture du lendemain, limit order a 0.5% sous l\'ouverture' },
    { step: 'Sortie', detail: 'Take profit : RSI > 50 OU +8%. Stop loss : -4%. Time stop : 10 jours max.' }
  ]));

  slides.push(table(
    'Resultats RSI Bounce (2010-2025)',
    ['Metrique', 'RSI Bounce'],
    [
      ['CAGR', '14.2%'],
      ['Sharpe', '0.85'],
      ['Max DD', '-12.8%'],
      ['Win Rate', '58%'],
      ['Avg holding', '5.2 jours'],
      ['Profit Factor', '2.2'],
      ['Correlation avec CSM', '-0.15 (LE GRAAL)']
    ]
  ));

  slides.push(tip(
    'La correlation negative : le graal de la diversification',
    'La correlation de -0.15 entre RSI Bounce et CSM est le point crucial. Quand le momentum souffre (les gagnants plongent), c\'est exactement le moment ou la mean-reversion prospere (les surventes rebondissent). Cette anti-correlation naturelle reduit le drawdown combine de maniere disproportionnee.'
  ));

  slides.push(tip(
    'Le time stop : la sortie oubliee',
    'Le time stop (sortie apres N jours si ni TP ni SL atteint) est la sortie la plus negligee en mean-reversion. Pourtant, si un RSI oversold ne rebondit pas en 10 jours, la these est invalidee. Rester en position "parce que ca va finir par remonter" est le biais cognitif qui transforme une strategie profitable en source de pertes. Fixez un time stop et respectez-le.'
  ));

  slides.push(concept(
    'Bollinger Band Reversion : la troisieme strategie mean-reversion',
    'Quand le prix sort de la bande inferieure de Bollinger (moyenne 20 jours +/- 2 ecarts-types), c\'est un signal de survente statistique. Filtre : uniquement les actions avec un ADR (Average Daily Range) > 2% et qui sont au-dessus de leur EMA 50. Holding moyen : 3-5 jours. Win rate ~55% mais ratio gain/perte de 2:1.'
  ));

  slides.push(concept(
    'Pairs Trading : arbitrage statistique',
    'Le pairs trading exploite les relations stables entre deux actifs. Quand deux actions historiquement correlee divergent, on achete celle qui a baisse. La cle : utiliser la cointegration (Engle-Granger ou Johansen), pas la simple correlation. Deux actions cointegrees ont un spread stationnaire qui revient TOUJOURS a la moyenne.'
  ));

  slides.push(comparison(
    'Correlation vs Cointegration',
    { label: 'Correlation', items: [
      'Les rendements bougent dans la meme direction',
      'Peut etre transitoire et instable',
      'Mesure une relation lineaire instantanee',
      'Insuffisante pour le pairs trading'
    ]},
    { label: 'Cointegration', items: [
      'Le spread entre les deux prix est stationnaire',
      'Revient toujours a la moyenne',
      'Propriete plus stable et plus exploitable',
      'Test Engle-Granger ou Johansen'
    ]}
  ));

  slides.push(table(
    'Pairs Trading : exemples de paires cointegrees',
    ['Paire', 'Secteur', 'Half-life du spread', 'Sharpe'],
    [
      ['Coca-Cola / PepsiCo', 'Consumer Staples', '12 jours', '0.8'],
      ['ASML / Tokyo Electron', 'Semis', '15 jours', '0.7'],
      ['Visa / Mastercard', 'Financials', '8 jours', '0.9'],
      ['Airbus / Boeing', 'Aerospace', '20 jours', '0.6'],
      ['Shell / TotalEnergies', 'Energy', '10 jours', '0.8']
    ]
  ));

  slides.push(concept(
    'Combinaison momentum + mean-reversion : le portefeuille anti-fragile',
    'En combinant CSM (Sharpe 1.35, DD -22.1%) avec RSI Bounce (Sharpe 0.85, DD -12.8%, correlation -0.15), le portefeuille combine atteint un Sharpe de ~1.5 avec un DD de ~15%. La correlation negative fait que les pertes de l\'un sont compensees par les gains de l\'autre. C\'est la diversification des STRATEGIES, pas seulement des actifs.'
  ));

  slides.push(summary('Mean Reversion : points cles', [
    'Complementaire au momentum : fonctionne sur des horizons courts (1-10 jours)',
    'RSI Bounce : CAGR 14.2%, Sharpe 0.85, DD -12.8%, correlation -0.15 avec CSM',
    'Pairs Trading via cointegration (pas simple correlation)',
    'L\'anti-correlation naturelle momentum/mean-reversion reduit le DD combine'
  ]));

  // QUIZ 5 (~112 slides)
  slides.push(quiz(
    'Pourquoi le RSI Oversold Bounce exige que le prix soit AU-DESSUS de l\'EMA 200 ?',
    [
      'Pour s\'assurer que l\'action est volatile',
      'Pour confirmer que la tendance long-terme est haussiere et qu\'on achete un creux temporaire',
      'Pour eviter les actions trop cheres',
      'Pour reduire le nombre de trades'
    ],
    1,
    'Le filtre Prix > EMA(200) garantit que la tendance de fond est haussiere. On ne veut acheter que des creux temporaires dans un trend positif, pas des actions en chute libre structurelle (falling knives). C\'est la difference entre "acheter la panique" et "attraper un couteau qui tombe".'
  ));

  // ============================================================
  // CHAPITRE 8 : CROSS-ASSET (slides ~113-125)
  // ============================================================
  slides.push(chapterIntro(8, 'Cross-Asset & Rotation Sectorielle', 'Dual Momentum, Sector Rotation, Tail Hedging'));

  slides.push(concept(
    'Le probleme des strategies intra-equity en bear market',
    'Les strategies momentum et mean-reversion sont toutes des strategies sur actions. En bear market generalise comme 2008 ou mars 2020, TOUTES les actions baissent simultanement. Meme la mean-reversion souffre car les rebonds sont brefs et violents. La seule protection : basculer vers des classes d\'actifs decorrelees.'
  ));

  slides.push(concept(
    'Pourquoi les strategies cross-asset sont indispensables',
    'Les strategies momentum et mean-reversion sont toutes intra-equity. En bear market generalise, meme la mean-reversion souffre car toutes les actions baissent simultanement. Les strategies cross-asset resolvent ce probleme en basculant vers des classes d\'actifs decorrelees : obligations (TLT), or (GLD), cash.'
  ));

  slides.push(table(
    'Matrice de correlation cross-asset',
    ['', 'Actions US', 'Actions EU', 'Obligations', 'Or'],
    [
      ['Actions US', '1.00', '0.85', '-0.30', '0.05'],
      ['Actions EU', '0.85', '1.00', '-0.25', '0.10'],
      ['Obligations', '-0.30', '-0.25', '1.00', '0.20'],
      ['Or', '0.05', '0.10', '0.20', '1.00']
    ]
  ));

  slides.push(concept(
    'Dual Momentum : le modele d\'Antonacci revisite',
    'Le Dual Momentum combine momentum RELATIF (quel actif surperforme : US vs International) et momentum ABSOLU (est-ce que le trend est positif). Resultat : investi dans le meilleur actif quand les marches montent, et en cash/obligations quand ils baissent. Notre version ajoute un overlay VIX : si VIX > 30, equity reduite de 50%. Si VIX > 40, 100% safe haven.'
  ));

  slides.push(table(
    'Resultats Dual Momentum (2010-2025)',
    ['Metrique', 'Dual Momentum', '60/40', 'SPY'],
    [
      ['CAGR', '14.8%', '8.5%', '13.2%'],
      ['Sharpe', '0.90', '0.62', '0.72'],
      ['Max DD', '-12.5%', '-20.8%', '-33.9%'],
      ['Calmar', '1.18', '0.41', '0.39']
    ]
  ));

  slides.push(tip(
    'Le max DD de -12.5% vs -33.9% pour SPY',
    'Le Dual Momentum a esquive 64% du crash COVID en basculant en safe haven des mars 2020 (signal absolu negatif). C\'est exactement son role dans le portefeuille : proteger pendant les crises. La difference entre "inconfortable mais gerable" et "catastrophique".'
  ));

  slides.push(bullets('L\'overlay VIX : le circuit-breaker automatique', [
    'VIX < 15 : Risk-On complet, allocation equity maximale',
    'VIX 15-20 : Neutre, allocation standard',
    'VIX 20-28 : Early Risk-Off, equity reduite de 30%, safe haven augmente',
    'VIX 28-35 : Risk-Off, equity reduite de 50%',
    'VIX > 35 : Crisis mode, 100% safe haven, zero equity',
    'Le VIX est le "thermometre de la peur" — il est mean-revertant avec un plancher a ~12'
  ]));

  slides.push(concept(
    'Sector Rotation avancee : 33 ETF sur 3 regions',
    'La rotation sectorielle etendue couvre US (XLK, XLF, XLE...), EU (EXV6, EXX5...) et APAC. Signal composite : 25% relative strength 3M, 20% breadth thrust, 20% earnings momentum sectoriel, 20% flow institutionnel, 15% sensibilite au regime macro. Surfer les cycles economiques avec precision.'
  ));

  slides.push(summary('Cross-Asset : points cles', [
    'Dual Momentum : momentum relatif + absolu + overlay VIX',
    'Bascule vers obligations/or/cash en bear market',
    'Max DD -12.5% vs -33.9% pour SPY sur la meme periode',
    'Sector Rotation sur 33 ETF US/EU/APAC'
  ]));

  // ============================================================
  // CHAPITRE 9 : REGIME ADAPTATIF & ML (slides ~126-142)
  // ============================================================
  slides.push(chapterIntro(9, 'Regime Adaptatif & Machine Learning', 'HMM, XGBoost, GARCH, NLP financier'));

  slides.push(concept(
    'Pourquoi les strategies statiques echouent',
    'Le cimetiere des backtests parfaits est rempli de strategies qui fonctionnaient magnifiquement sur les donnees historiques mais qui se sont effondrees en production. La raison : les marches changent de regime. Un marche bull, un marche bear, et un marche lateral requierent des strategies differentes. Le meta-allocateur doit detecter le regime et ajuster les poids en temps reel.'
  ));

  slides.push(steps('Hidden Markov Models : les etats caches du marche', [
    { step: 'Principe', detail: 'Le marche alterne entre N etats caches (bull, bear, lateral) avec des probabilites de transition. Le HMM estime ces etats a partir des rendements et de la volatilite observes.' },
    { step: 'Entrainement', detail: 'Algorithme Baum-Welch sur 10 ans de donnees. Typiquement 3-4 etats : Low-Vol Bull, High-Vol Bull, Correction, Crisis.' },
    { step: 'Inference', detail: 'A chaque nouveau jour, calculer la probabilite d\'etre dans chaque etat. Ajuster les poids du portefeuille en consequence.' },
    { step: 'Action', detail: 'Regime bull : max momentum. Regime bear : max safe-haven. Regime lateral : max mean-reversion.' }
  ]));

  slides.push(table(
    'Impact du detecteur de regime sur le portefeuille',
    ['Regime', 'Allocation Momentum', 'Allocation Mean-Rev', 'Allocation Safe-Haven'],
    [
      ['Bull (Low Vol)', '65%', '15%', '5%'],
      ['Bull (High Vol)', '40%', '25%', '15%'],
      ['Correction', '15%', '35%', '30%'],
      ['Crisis', '0%', '20%', '60%']
    ]
  ));

  slides.push(concept(
    'Le Reinforcement Learning : l\'approche emergente',
    'Le RL apprend une politique d\'allocation en interagissant avec un environnement simule. L\'agent recoit une recompense (PnL ajuste au risque) et optimise sa politique sur des milliers d\'episodes. Prometteur en theorie, mais en pratique tres difficile a stabiliser et sujet a l\'overfitting sur l\'environnement de simulation. Approche experimentale uniquement.'
  ));

  slides.push(concept(
    'XGBoost pour le signal alpha',
    'Au-dela des facteurs lineaires, XGBoost capture des interactions non-lineaires entre facteurs. Exemple : momentum fort + volume elevee + sentiment positif = signal beaucoup plus fort que la somme. Mais attention : risque d\'overfit tres eleve. Uniquement avec CPCV strict (Combinatorial Purged Cross-Validation) et plus de 10 ans de donnees.'
  ));

  slides.push(bullets('Les 4 regimes detectes par le HMM', [
    'Low-Vol Bull : marche calme et haussier. Allocation max en momentum. Le regime le plus frequent (~45% du temps).',
    'High-Vol Bull : marche haussier mais nerveux. Reduire le sizing, augmenter la mean-reversion.',
    'Correction : baisse de 5-15%. Basculer vers safe haven et mean-reversion. Ne pas paniquer.',
    'Crisis : baisse > 15%, VIX > 35. 60% safe haven, 20% mean-reversion, 0% momentum. Le regime le plus rare (~5%) mais le plus destructeur.'
  ]));

  slides.push(concept(
    'NLP financier : FinBERT pour le sentiment des news',
    'FinBERT est un modele de langage specialise en finance. Il analyse les titres et articles de news pour en extraire un score de sentiment (-1 a +1). Utilise comme facteur complementaire, le sentiment NLP ameliore l\'IC composite de 0.01-0.02. Pas enorme seul, mais precieux en combinaison avec les autres facteurs.'
  ));

  slides.push(concept(
    'GARCH : prevoir la volatilite de demain',
    'Le modele GARCH capture le clustering de volatilite : les periodes de haute volatilite sont suivies de haute volatilite, et vice-versa. On utilise GARCH(1,1) pour prevoir la vol a 1-5 jours et ajuster dynamiquement le sizing des positions. En periode de vol elevee, on reduit automatiquement les positions.'
  ));

  slides.push(warning(
    'Le piege du Machine Learning en finance',
    'Plus votre modele est complexe (neural networks, deep learning), plus le risque d\'overfit est eleve. En finance, les donnees sont bruitees, non-stationnaires, et limitees en taille. Un modele qui memorise le passe au lieu de generaliser est pire qu\'un modele lineaire simple. Toujours commencer simple, complexifier seulement si le gain est significatif OOS.'
  ));

  slides.push(summary('Regime Adaptatif & ML : points cles', [
    'HMM detecte les regimes caches : bull, bear, correction, crisis',
    'Le meta-allocateur ajuste les poids en temps reel selon le regime',
    'XGBoost pour les interactions non-lineaires (avec CPCV strict)',
    'GARCH pour la prevision de volatilite et le sizing dynamique',
    'Regle d\'or : commencer simple, complexifier seulement si gain OOS significatif'
  ]));

  // QUIZ 6 (~142 slides)
  slides.push(quiz(
    'A quoi sert le HMM (Hidden Markov Model) dans notre systeme ?',
    [
      'A predire le prix exact d\'une action demain',
      'A detecter le regime de marche (bull, bear, lateral) et ajuster les allocations',
      'A optimiser la matrice de covariance',
      'A calculer le Kelly Criterion'
    ],
    1,
    'Le HMM detecte les etats caches du marche (bull, bear, correction, crisis) a partir des rendements et de la volatilite observes. Le meta-allocateur utilise cette detection pour ajuster dynamiquement les poids : plus de momentum en bull, plus de mean-reversion en lateral, plus de safe-haven en crisis.'
  ));

  // ============================================================
  // CHAPITRE 10 : PRODUCTION & OPS (slides ~143-155)
  // ============================================================
  slides.push(chapterIntro(10, 'Production, Monitoring & Scale', 'Docker, Nomad, CI/CD, hardening, monitoring'));

  slides.push(quote(
    'Si la VM brule, vous la reconstruisez en 15 minutes. Tout est dans Git.',
    'Philosophie Infrastructure as Code'
  ));

  slides.push(concept(
    'Everything as Code : tout dans Git',
    'L\'integralite du systeme vit dans un seul depot Git : infrastructure (Terraform), orchestration (Nomad), secrets (Vault), containerisation (Docker), CI/CD (GitHub Actions), strategies (Python). Rien n\'est configure manuellement. Tout est reproductible, auditable, et versionne. Si la VM brule, vous la reconstruisez en 15 minutes.'
  ));

  slides.push(steps('Le stack DevOps du trader solo', [
    { step: 'Terraform', detail: 'Provisionne la VM Hetzner, firewall, DNS, volumes. La VM est INVISIBLE sur Internet (Tailscale only).' },
    { step: 'Docker', detail: 'Chaque service est containerise : trading engine, data pipeline, IB Gateway, monitoring, Discord bot.' },
    { step: 'Nomad', detail: 'Orchestrateur de jobs : gere le deploiement, le scaling, et le restart automatique des containers.' },
    { step: 'Vault', detail: 'Gestion des secrets : credentials IBKR, webhooks Discord, cles API. Jamais en clair dans le code.' },
    { step: 'GitHub Actions', detail: 'CI : tests + lint + security scan. CD : deploy to production. Weekly : validation des backtests.' }
  ]));

  slides.push(bullets('Tailscale : la VM invisible', [
    'La VM n\'a AUCUN port ouvert sur Internet sauf Tailscale (41641/UDP)',
    'Pas de SSH public, pas de HTTP, RIEN sauf le VPN mesh',
    'Seul votre laptop (via Tailscale) peut acceder a la VM',
    'MagicDNS : trading.tail12345.ts.net',
    'Resultat : surface d\'attaque quasi nulle'
  ]));

  slides.push(concept(
    'Monitoring Discord securise',
    'Chaque matin a 7h, le bot Discord poste : PnL du jour/semaine/mois, positions ouvertes, drawdown actuel, prochains rebalancements. Alertes en temps reel : si DD > 10%, si une strategie underperform, si le service tombe, si CPU/RAM anomal. Le Discord est votre tableau de bord.'
  ));

  slides.push(steps('Le pipeline CI/CD pour le trading', [
    { step: 'Push sur Git', detail: 'Vous commitez un changement de strategie ou de parametre.' },
    { step: 'CI : Tests automatiques', detail: 'GitHub Actions lance : unit tests, integration tests, linting, security scan (dependabot, bandit).' },
    { step: 'CI : Backtest de regression', detail: 'Le changement ne doit pas degrader le Sharpe ou augmenter le DD sur le backtest de reference.' },
    { step: 'CD : Deploy en paper', detail: 'Si tous les tests passent, deploiement automatique en paper trading pendant 48h.' },
    { step: 'CD : Promotion en live', detail: 'Apres validation en paper, promotion manuelle (ou automatique si le Sharpe paper > seuil).' }
  ]));

  slides.push(warning(
    'Le role humain irreductible',
    'Claude Code ecrit le code, Docker le deploie, Nomad l\'orchestre, GitHub Actions le teste. Mais VOUS decidez : quelles strategies ajouter/retirer, quels parametres ajuster, quand augmenter le capital, quand suspendre le systeme. L\'automatisation elimine les decisions emotionnelles repetitives, pas les decisions strategiques.'
  ));

  slides.push(tip(
    'Le lifecycle management automatise',
    'Le systeme gere automatiquement le cycle de vie des strategies : promotion (paper -> live), degradation (live -> paper si Sharpe < 0.5 pendant 3 mois), arret (paper -> archive si aucune amelioration en 6 mois). Pas de decision emotionnelle. Le code decide.'
  ));

  slides.push(summary('Production & Ops : points cles', [
    'Everything as Code : Terraform + Docker + Nomad + Vault',
    'VM invisible via Tailscale (zero surface d\'attaque)',
    'CI/CD GitHub Actions : tests, security scan, deploy automatise',
    'Monitoring Discord : PnL, positions, alertes en temps reel',
    'Lifecycle automatise : promotion, degradation, arret des strategies'
  ]));

  // QUIZ 7 (~155 slides)
  slides.push(quiz(
    'Pourquoi utilise-t-on Tailscale plutot que d\'ouvrir le port SSH ?',
    [
      'Parce que Tailscale est plus rapide',
      'Pour reduire la surface d\'attaque a quasi zero (pas de port ouvert sur Internet)',
      'Parce que SSH ne fonctionne pas sur Hetzner',
      'Pour economiser de la bande passante'
    ],
    1,
    'Avec Tailscale, la VM n\'expose AUCUN port sur Internet public. Seuls les appareils autorises dans votre reseau Tailscale peuvent se connecter. Cela elimine les attaques par force brute SSH, les scans de ports, et toute intrusion via Internet. La securite d\'une VM de trading est critique car elle contient vos credentials broker.'
  ));

  // ============================================================
  // CHAPITRE 11 : VIVRE DE SON ALGO (slides ~156-168)
  // ============================================================
  slides.push(chapterIntro(11, 'Vivre de son Algo', 'Retraits adaptatifs, fiscalite, guardrails anti-ruine'));

  slides.push(concept(
    'Le probleme que personne ne pose dans les livres de quant',
    'Comment vivre de cet argent sans detruire le compound engine qui l\'a cree ? J\'ai vu des traders systematiques brillants, Sharpe > 2.5, drawdown < 8%, se retrouver au tapis en 18 mois parce qu\'ils ont confondu revenus du trading et salaire stable. Le trading algo genere des flux non-lineaires, non-gaussiens, et auto-correles. Les traiter comme un salaire fixe est la recette du desastre.'
  ));

  slides.push(steps('Les 3 phases de la transition', [
    { step: 'Accumulation pure (0-18 mois)', detail: 'Compound a 100% sans retrait. Chaque euro retire pendant cette phase coute exponentiellement plus cher. Un retrait de 5000 euros au mois 6 coute ~42 000 euros en valeur terminale.' },
    { step: 'Seuil critique (18-24 mois)', detail: 'Capital >= 750K euros, track record >= 18 mois live, Sharpe >= 1.5, Max DD <= 20%. Debut des prelevements chirurgicaux.' },
    { step: 'Rente stabilisee (24+ mois)', detail: 'Capital >= 1M euros. Les retraits sont geres par le WithdrawalManager automatise. Le capital continue de croitre, mais plus lentement.' }
  ]));

  slides.push(comparison(
    'Retraite classique vs Algo Trading Rentier',
    { label: 'Retraite 60/40', items: [
      'Rendement : 7-8% nominal/an',
      'Volatilite : 10-12%',
      'Taux de retrait : 3-4% / an',
      'Horizon : 30+ ans'
    ]},
    { label: 'Algo Trading Rentier', items: [
      'Rendement : 30-60% nominal/an',
      'Volatilite : 25-45%',
      'Taux de retrait : 15-25% / an (adaptatif)',
      'Risque : alpha decay, regime shift'
    ]}
  ));

  slides.push(concept(
    'Variable Percentage Withdrawal (VPW)',
    'Le retrait mensuel s\'ajuste dynamiquement : withdrawal_rate = min(monthly_return x fraction, max_monthly). Ajustements : si drawdown > 10%, fraction x 0.5. Si drawdown > 20%, retrait suspendu. Si Sharpe 6M > 2.0, fraction x 1.25 (bonus). Si buffer < 3 mois, fraction x 0.25 (reconstitution). L\'automatisation elimine les decisions emotionnelles.'
  ));

  slides.push(tip(
    'Le cout du compound perdu',
    'Un retrait de 5 000 euros au mois 6 sur un compte a 150K euros ne coute pas 5 000 euros. Il coute environ 42 000 euros en valeur terminale a 36 mois avec un CAGR de 40%. Pendant la phase d\'accumulation, chaque euro retire coute exponentiellement plus cher que sa valeur faciale. Vivez de votre job, de vos economies, de freelance — de tout sauf du compte trading.'
  ));

  slides.push(table(
    'Budget mensuel du million-rentier',
    ['Poste', 'Montant', 'Notes'],
    [
      ['Logement', '2 000 euros', 'Location moderee ou credit rembourse'],
      ['Alimentation', '800 euros', 'Couple ou famille'],
      ['Transport', '400 euros', 'Voiture + transports'],
      ['Assurances', '500 euros', 'Sante, habitation, RC pro'],
      ['Loisirs/voyages', '1 000 euros', 'Raisonnable'],
      ['Impots (Flat Tax)', '~3 000 euros', '30% sur les gains retires'],
      ['Epargne de precaution', '1 000 euros', 'Buffer reconstitution'],
      ['TOTAL', '~8 700 euros/mois', 'A 60% de la capacite de retrait']
    ]
  ));

  slides.push(table(
    'Fiscalite France : les structures',
    ['Structure', 'Taux', 'Avantage'],
    [
      ['Flat Tax (PFU)', '30%', 'Simple, par defaut'],
      ['PEA', '17.2% (PS seuls)', 'Apres 5 ans, uniquement actions EU'],
      ['Holding SAS/SASU', 'IS 15-25% + flat tax', 'Optimise si reinvestissement'],
      ['Assurance-Vie', '7.5-12.8%', 'Apres 8 ans, plafonds annuels']
    ]
  ));

  slides.push(concept(
    'Psychologie du shift : grinder vers rentier',
    'Apres 18 mois a regarder une equity curve monter sans y toucher, le premier retrait provoque l\'aversion au desinvestissement. Symptomes : paralysie (incapable d\'appuyer sur "retrait"), compensation (augmenter le risque pour "rattraper"), micro-management (verifier le PnL 30 fois par jour). La solution : automatisation complete des retraits. Le WithdrawalManager decide, pas vous.'
  ));

  slides.push(warning(
    'Le piege du lifestyle creep',
    'A 1M euros avec 15K euros/mois net, la tentation est immense : appartement plus grand, voiture, business class. Chaque augmentation de train de vie est un plancher permanent qui reduit votre marge de securite. Le trader rentier qui reussit a 10 ans est celui qui vit a 60% de sa capacite de retrait, pas a 100%.'
  ));

  slides.push(bullets('Guardrails anti-ruine', [
    'Suspension automatique des retraits si DD > 20%',
    'Buffer cash de 6 mois sur un compte separe (50-60K euros)',
    'Regle du 60% : ne jamais vivre a plus de 60% de la capacite de retrait',
    'Diversification : immobilier, obligations, assurance-vie en parallele',
    'Circuit-breaker : si le capital tombe sous 500K euros, retour en Phase 1'
  ]));

  slides.push(summary('Vivre de son Algo : points cles', [
    '3 phases : accumulation pure, seuil critique, rente stabilisee',
    'VPW adaptatif : retraits ajustes au drawdown, Sharpe, et buffer',
    'Flat Tax 30% par defaut, PEA pour les actions EU (17.2% apres 5 ans)',
    'Guardrails anti-ruine : suspension DD > 20%, buffer 6 mois, regle du 60%'
  ]));

  // ============================================================
  // CHAPITRE 12 : SCALING & EXIT (slides ~169-183)
  // ============================================================
  slides.push(chapterIntro(12, 'Scaling & Exit', 'Analyse de capacite, multi-VM, licensing, family office, sortie'));

  slides.push(concept(
    'Le chapitre final : la machine vous libere',
    'Vous avez franchi le million. Felicitations — et bienvenue dans de nouveaux problemes. A 100K euros, vous etiez un bruit de fond dans le carnet d\'ordres. A 1M euros, vous laissez une empreinte. A 3M euros, certaines strategies small-cap sont physiquement impossibles. Ce chapitre couvre l\'adaptation au succes.'
  ));

  slides.push(concept(
    'Quand votre taille deplace le marche',
    'A 100K euros, vous etes un bruit de fond. A 1M euros, vous laissez une empreinte. A 3M euros, certaines strategies small-cap sont physiquement impossibles sans market impact. La formule de capacite : Capacity = ADV x MaxParticipation x AvgHolding x UniverseSize x DiversificationFactor.'
  ));

  slides.push(table(
    'Capacites par strategie',
    ['Strategie', 'US Large', 'US Small', 'EU Large', 'EU Small'],
    [
      ['Momentum 20j', '$50M+', '$2M', '$20M', '$500K'],
      ['Mean Reversion 5j', '$30M', '$1.5M', '$15M', '$400K'],
      ['Cross-Asset Rotation', '$200M+', 'N/A', '$100M+', 'N/A'],
      ['Stat Arb Pairs', '$20M', '$800K', '$10M', '$300K'],
      ['Options Selling', '$100M+', '$2M', '$30M', 'N/A']
    ]
  ));

  slides.push(tip(
    'La strategie d\'adaptation au scaling',
    'Au fur et a mesure que le capital croit, migrez les allocations des small-caps vers les large-caps et les ETF. Avec 1-3M euros, aucune contrainte de capacite sur US et EU large-caps. Le probleme se pose uniquement sur les small-caps et les marches APAC peu liquides.'
  ));

  slides.push(concept(
    'Family Office mono-personne',
    'Avec 3-5M euros, vous pouvez structurer un family office : SAS/SASU pour la gestion, assurance-vie luxembourgeoise pour l\'optimisation fiscale, immobilier locatif pour les revenus decorrelees. L\'objectif est de diversifier les sources de revenus au-dela du trading pour proteger votre patrimoine contre l\'alpha decay de vos strategies.'
  ));

  slides.push(bullets('Au-dela du trading : diversifier les revenus', [
    'Licensing de signaux : vendre vos signaux alpha via API (SaaS)',
    'Family office mono-personne : structure SAS, assurance-vie, immobilier',
    'Managed accounts : gerer le capital de proches (attention regulation AMF)',
    'Education : cours, newsletter, consulting (monetiser votre expertise)',
    'Angel investing : utiliser votre edge data pour evaluer les startups fintech'
  ]));

  slides.push(concept(
    'Options Selling : la strategie post-million',
    'Avec plus de 1M euros de capital, vous accedez a la vente d\'options (covered calls, cash-secured puts). C\'est une source de rendement complementaire qui profite du decay temporel (theta) et de la volatilite elevee. Capacite enorme ($100M+ sur les US large-caps). Attention au gamma risk : une perte sur une vente de put peut etre catastrophique si non hedgee.'
  ));

  slides.push(concept(
    'Licensing de signaux : monetiser votre alpha',
    'Vendre vos signaux alpha via API (SaaS model) a d\'autres traders ou fonds. Valorisation : 10-20% du PnL genere par le signal. Avantages : revenus recurrents decorreles de votre propre trading, scalabilite illimitee. Risques : l\'alpha decay s\'accelere quand plus de capital suit le meme signal (crowding), necessites reglementaires (AMF en France).'
  ));

  slides.push(steps('Les 4 scenarios de sortie', [
    { step: 'Scaling indefini', detail: 'Continuer a faire croitre le capital. Le systeme tourne, vous optimisez. Objectif : 10M euros+.' },
    { step: 'Rente passive', detail: 'Stabiliser le capital a 3-5M euros, retirer 8-12%/an. Le systeme est en pilote automatique.' },
    { step: 'Vente du systeme', detail: 'Vendre l\'IP (algorithmes, infra, track record) a un hedge fund ou un family office. Valuation : 3-5x le PnL annuel.' },
    { step: 'Reconversion', detail: 'Utiliser le capital et les competences pour un nouveau projet : fintech, fund management, enseignement.' }
  ]));

  slides.push(quote(
    'Le plus dur n\'est pas de faire un million. C\'est de ne pas le perdre en vivant dessus.',
    'Lecon de la serie Algo Trading'
  ));

  slides.push(summary('Scaling & Exit : points cles', [
    'Analyse de capacite : formule ADV x Participation x Holding x Univers x Diversification',
    'Avec 1-3M euros, pas de contrainte sur US/EU large-caps',
    'Diversifier les revenus : licensing, family office, education',
    '4 scenarios de sortie : scaling, rente, vente, reconversion'
  ]));

  // QUIZ 8 (~183 slides)
  slides.push(quiz(
    'Quelle est la strategie d\'adaptation quand le capital augmente ?',
    [
      'Augmenter le levier',
      'Migrer les allocations des small-caps vers les large-caps et ETF plus liquides',
      'Reduire le nombre de strategies',
      'Shorter les marches pour hedger'
    ],
    1,
    'Quand le capital augmente, l\'impact de marche sur les small-caps devient trop eleve. La solution est de migrer progressivement vers des instruments plus liquides : large-caps US/EU et ETF. Ces instruments ont des capacites de $50M a $200M+, bien au-dela de la taille d\'un trader individuel.'
  ));

  // ============================================================
  // CONCLUSION GENERALE (~5 slides)
  // ============================================================
  slides.push(concept(
    'Le mot de la fin : patience et discipline',
    'Le trading algorithmique est un marathon, pas un sprint. Les premiers mois sont frustrants : bugs, faux signaux, drawdowns. La tentation est forte de tout changer apres chaque perte. Mais le systeme est concu pour fonctionner sur des centaines de trades, pas sur un seul. Faites confiance au processus, pas a vos emotions.'
  ));

  slides.push(concept(
    'Recapitulatif : les 12 piliers du systeme',
    'Infrastructure (~60 euros/mois) + Data Pipeline (50 features) + Alpha Factors (6 familles) + Portfolio Construction (Kelly + HRP) + Execution (OMS intelligent) + 8 strategies complementaires (momentum + mean-reversion + cross-asset) + Detection de regime ML + Production DevOps + Retraits adaptatifs + Scaling. Chaque pilier est indispensable.'
  ));

  slides.push(table(
    'Les 8 strategies du portefeuille',
    ['#', 'Strategie', 'Type', 'Allocation', 'Role'],
    [
      ['1', 'CSM', 'Momentum', '20%', 'Moteur principal'],
      ['2', 'TSMOM', 'Momentum', '16%', 'Direction macro'],
      ['3', 'PEAD', 'Momentum', '15%', 'Alpha evenementiel'],
      ['4', 'Industry Rotation', 'Momentum', '14%', 'Rotation cyclique'],
      ['5', 'RSI Bounce', 'Mean Reversion', '~10%', 'Anti-crash'],
      ['6', 'Pairs Trading', 'Mean Reversion', '~7%', 'Arbitrage statistique'],
      ['7', 'Dual Momentum', 'Cross-Asset', '~12%', 'Protection macro'],
      ['8', 'Sector Rotation', 'Cross-Asset', '~6%', 'Cycles sectoriels']
    ]
  ));

  slides.push(bullets('Les lecons les plus importantes', [
    'Aucune strategie seule ne suffit : c\'est la COMBINAISON qui cree l\'edge',
    'L\'anti-overfit est plus important que le signal : Prior economique, Walk-Forward, Deflated Sharpe',
    'La construction de portefeuille (Kelly + HRP) est le vrai alpha structurel',
    'L\'execution compte : 0.5% de slippage x 1000 trades/an = 500% de couts cumules',
    'Le regime change tout : adapter les poids au regime est non-negociable',
    'La psychologie du retrait est aussi dure que la psychologie du trading',
    'Everything as Code : si la VM brule, vous reconstruisez en 15 minutes'
  ]));

  slides.push(quote(
    'La machine vous libere. Mais c\'est a vous de la construire, de la tester, et de lui faire confiance.',
    'De 100K au Million — Conclusion'
  ));

  slides.push(summary('Merci d\'avoir suivi cette formation !', [
    '12 chapitres, ~180 slides, 2 heures de contenu',
    'De l\'infrastructure au scaling, en passant par 8 strategies complementaires',
    'Objectif : 100K euros -> 1M euros en 24 mois, sans levier, long only, DD max 25%',
    'La serie complete est disponible sur articles.dailytickers.com',
    'Bonne chance dans votre aventure de trading algorithmique !'
  ]));

  return slides;
}

function generateBoursesMENA() {
  let slideIndex = 0;
  const slides = [];

  function add(slide) {
    slide.index = slideIndex++;
    slides.push(slide);
  }

  // ======================================================================
  // INTRODUCTION GÉNÉRALE
  // ======================================================================
  add(chapterIntro(0, 'Les Bourses du Maghreb & Moyen-Orient', 'Un univers financier méconnu de 4 000 milliards de dollars'));

  add(bullets('Ce que vous allez apprendre', [
    'Les 15 places boursières du monde arabe — de Casablanca à Tadawul',
    'Le Maghreb boursier : Casablanca, Tunis, Alger — forces et faiblesses',
    'Les mastodontes du Golfe : Aramco, IHC, Emaar et les fonds souverains',
    'Opportunités structurelles et risques spécifiques de la région',
    'Guide pratique : courtiers, ETFs, fiscalité et outils',
    'Crypto, fintech et avenir des marchés MENA'
  ]));

  add(concept('Pourquoi s\'intéresser aux bourses MENA ?',
    'Le monde arabe abrite plus de 15 places boursières avec une capitalisation totale dépassant les 4 000 milliards de dollars. Pourtant, elles restent invisibles pour la plupart des investisseurs occidentaux. Cette série va vous ouvrir les portes de cet univers financier méconnu — avec ses opportunités uniques et ses pièges à éviter.'));

  add(quote('Le meilleur investissement est celui que personne ne regarde.', 'Warren Buffett'));

  // ======================================================================
  // CHAPITRE 1 — PANORAMA DES BOURSES MENA
  // ======================================================================
  add(chapterIntro(1, 'Panorama — Un Monde de Bourses Méconnues', '15 places boursières, une capitalisation colossale'));

  add(concept('Pourquoi le monde arabe a ses propres bourses',
    'Le monde arabe abrite plus de 15 places boursières. Certaines existent depuis plus d\'un siècle — la Bourse du Caire a été fondée en 1883, soit seulement 11 ans après celle de Tokyo. La capitalisation totale dépasse les 4 000 milliards de dollars, portée par un géant : Saudi Aramco, valorisée à plus de 1 800 milliards de dollars.'));

  add(table('Les 15 bourses de la région MENA',
    ['Pays', 'Bourse', 'Capitalisation', 'Devise'],
    [
      ['Arabie Saoudite', 'Tadawul', '~$2 800 Mds', 'SAR (peg USD)'],
      ['Abu Dhabi', 'ADX', '~$700 Mds', 'AED (peg USD)'],
      ['Dubaï', 'DFM', '~$180 Mds', 'AED (peg USD)'],
      ['Qatar', 'QSE', '~$170 Mds', 'QAR (peg USD)'],
      ['Koweït', 'Boursa Kuwait', '~$150 Mds', 'KWD'],
      ['Égypte', 'EGX', '~$45 Mds', 'EGP'],
      ['Maroc', 'Casablanca', '~$70 Mds', 'MAD'],
      ['Bahreïn', 'BHB', '~$30 Mds', 'BHD'],
      ['Oman', 'MSX', '~$25 Mds', 'OMR']
    ]
  ));

  add(table('Les petites bourses MENA',
    ['Pays', 'Bourse', 'Capitalisation', 'Particularité'],
    [
      ['Jordanie', 'ASE', '~$25 Mds', 'Marché stable'],
      ['Tunisie', 'BVMT', '~$8 Mds', 'Micro-marché'],
      ['Liban', 'BSE', '~$3 Mds', 'Paralysée par la crise'],
      ['Palestine', 'PEX', '~$5 Mds', 'Marché de niche'],
      ['Irak', 'ISX', '~$10 Mds', 'En reconstruction'],
      ['Algérie', 'SGBV', '~$100 M', '5 titres seulement !']
    ]
  ));

  add(concept('Tadawul domine tout',
    'Le fait le plus frappant : Tadawul pèse à elle seule plus de 65% de la capitalisation totale de la région, principalement grâce à Saudi Aramco ($1 800 Mds). Le rapport entre la plus grande bourse (Tadawul, $2 800 Mds) et la plus petite (Alger, $100 M) est de 1 à 28 000 ! Chaque marché a ses propres dynamiques et ses propres risques.'));

  add(bullets('Les grands indices MENA', [
    'TASI — Tadawul All Share Index (Arabie Saoudite), le plus suivi',
    'MASI — Moroccan All Shares Index (Casablanca), +22% en 2024',
    'FADGI — FTSE ADX General Index (Abu Dhabi)',
    'DFMGI — DFM General Index (Dubaï)',
    'QE Index — Qatar Exchange Index',
    'EGX30 — Egyptian Exchange 30 (Le Caire)',
    'TUNINDEX — Indice principal de la Bourse de Tunis'
  ]));

  add(table('Horaires de trading — Attention aux décalages !',
    ['Bourse', 'Jours', 'Horaires', 'Fuseau'],
    [
      ['Tadawul', 'Dim-Jeu', '10h00-15h00', 'GMT+3'],
      ['ADX / DFM', 'Lun-Ven', '10h00-14h00', 'GMT+4'],
      ['QSE', 'Dim-Jeu', '9h30-13h10', 'GMT+3'],
      ['Boursa Kuwait', 'Dim-Jeu', '9h00-12h40', 'GMT+3'],
      ['EGX', 'Dim-Jeu', '10h00-14h30', 'GMT+2'],
      ['Casablanca', 'Lun-Ven', '9h30-15h30', 'GMT+1'],
      ['BVMT (Tunis)', 'Lun-Ven', '9h00-14h10', 'GMT+1']
    ]
  ));

  add(warning('Calendrier différent !',
    'La majorité des bourses du Moyen-Orient fonctionnent du dimanche au jeudi — pas du lundi au vendredi. Le vendredi est le jour de repos. Les bourses du Maghreb et les Émirats (depuis 2022) suivent le calendrier occidental lundi-vendredi. Ce décalage crée des gaps d\'information et des opportunités d\'arbitrage.'));

  add(concept('Devises et risque de change',
    'Les monnaies du Golfe (SAR, AED, QAR, BHD, OMR) sont arrimées (pegged) au dollar américain à taux fixe. Zéro risque de change en USD ! En revanche, les monnaies du Maghreb (MAD, TND, DZD) et la livre égyptienne (EGP) subissent des dévaluations chroniques. La livre égyptienne a perdu 65% de sa valeur en 5 ans.'));

  add(concept('Pétrole et bourses du Golfe — La corrélation',
    'Il est impossible de comprendre les marchés du Golfe sans parler du pétrole. La corrélation Brent-Tadawul est de +0,72 et Brent-ADX de +0,68. Quand le pétrole monte, les bourses du Golfe suivent. Mais attention : la corrélation Brent-Casablanca n\'est que de 0,15. Le Maroc est un importateur net — la hausse du brut est même négative pour son économie.'));

  add(tip('La Bourse du Caire — Pionnière historique',
    'Fondée en 1883 à Alexandrie, puis 1903 au Caire, l\'EGX est la plus ancienne bourse du monde arabe. Elle a survécu à deux guerres mondiales, aux nationalisations de Nasser (1961), et au Printemps arabe (2011). Elle a même été fermée pendant 55 jours en 2011 — un risque unique aux marchés émergents.'));

  add(summary('Panorama — Ce qu\'il faut retenir', [
    '15 bourses, capitalisation totale de $4 000+ Mds',
    'Tadawul représente 65% à elle seule (grâce à Aramco)',
    'Disparité colossale : de $2 800 Mds à $100 M',
    'Dimanche-jeudi au Golfe, lundi-vendredi au Maghreb',
    'Devises du Golfe peggées au dollar = zéro risque de change',
    'Corrélation forte avec le pétrole pour les bourses du Golfe'
  ]));

  // Quiz 1 (~slide 20)
  add(quiz(
    'Quelle est la plus ancienne bourse du monde arabe ?',
    ['Tadawul (Arabie Saoudite)', 'Bourse du Caire (Égypte)', 'Bourse de Casablanca (Maroc)', 'QSE (Qatar)'],
    1,
    'La Bourse du Caire (EGX) a été fondée en 1883 à Alexandrie, soit seulement 11 ans après celle de Tokyo. Tadawul n\'a été créée qu\'en 2007.'
  ));

  add(quiz(
    'Combien de titres sont cotés à la Bourse d\'Alger (SGBV) ?',
    ['Environ 200', 'Environ 50', 'Environ 5', 'Environ 500'],
    2,
    'La SGBV d\'Alger est la plus petite bourse de la région avec seulement 5 titres cotés (Saidal, Biopharm, Alliance Assurances, EGH El Aurassi, Dahli) pour une capitalisation d\'environ 100 millions de dollars.'
  ));

  // ======================================================================
  // CHAPITRE 2 — CASABLANCA, TUNIS, ALGER
  // ======================================================================
  add(chapterIntro(2, 'Casablanca, Tunis, Alger — Le Maghreb Boursier', 'Trois bourses, trois réalités très différentes'));

  add(concept('Casablanca — La star incontestée du Maghreb',
    'La Bourse de Casablanca est de loin le marché le plus développé d\'Afrique du Nord. Fondée en 1929, modernisée dans les années 1990, elle abrite environ 75 sociétés cotées pour une capitalisation d\'environ $70 milliards (700 milliards de dirhams). C\'est la deuxième bourse d\'Afrique après Johannesburg.'));

  add(bullets('Casablanca en chiffres', [
    'Market Cap : ~$70 Mds (700 Mrd MAD)',
    'Volume quotidien : ~$15-20M — liquidité modeste',
    'Titres cotés : ~75',
    'Régulateur : AMMC (Autorité Marocaine du Marché des Capitaux)',
    'Indice phare : MASI (~15 000 points), +22% en 2024',
    'Secteur dominant : bancaire (~40% de la capitalisation)'
  ]));

  add(concept('Le MASI — Moroccan All Shares Index',
    'Le MASI inclut toutes les valeurs cotées, pondérées par la capitalisation flottante. Sa base est 1000 au 31 décembre 1991. En février 2026, il se situe autour de 15 000 points. Il a réalisé +22% en 2024 — des performances qui rivalisent avec les meilleurs marchés émergents. L\'indice MASI 20 regroupe les 20 valeurs les plus liquides.'));

  add(table('Top 10 valeurs du MASI',
    ['Société', 'Secteur', 'Market Cap', 'Dividende'],
    [
      ['Attijariwafa Bank', 'Banque', '~$11B', '~3,5%'],
      ['Maroc Telecom (IAM)', 'Télécoms', '~$9B', '~5,5%'],
      ['BCP (Banque Populaire)', 'Banque', '~$6B', '~3,2%'],
      ['LafargeHolcim Maroc', 'BTP/Matériaux', '~$4,5B', '~4,0%'],
      ['BMCE (Bank of Africa)', 'Banque', '~$3,5B', '~2,8%'],
      ['Label\'Vie', 'Distribution', '~$2,5B', '~1,5%'],
      ['Managem', 'Mines', '~$2,2B', '~1,0%'],
      ['Marsa Maroc', 'Logistique', '~$2,0B', '~4,5%'],
      ['Taqa Morocco', 'Énergie', '~$1,8B', '~7,0%'],
      ['Ciments du Maroc', 'BTP', '~$1,6B', '~5,0%']
    ]
  ));

  add(comparison('Casablanca — Catalyseurs vs Risques',
    { label: 'Catalyseurs haussiers', items: [
      'Coupe du Monde 2030 : investissements massifs en infrastructure',
      'Expansion africaine des banques marocaines (25 pays)',
      'IPO à venir : privatisations en cours',
      'Digitalisation et paiement mobile en plein essor'
    ]},
    { label: 'Risques à surveiller', items: [
      'Liquidité faible : $15-20M/jour, spreads larges',
      'Risque sécheresse : agriculture = 12% du PIB',
      'Inflation et impact sur les marges bancaires',
      'Dirham partiellement flottant depuis 2018'
    ]}
  ));

  add(concept('Tunis — Le micro-marché résilient',
    'La Bourse des Valeurs Mobilières de Tunis (BVMT) est un marché de poche. Avec environ 80 titres cotés et une capitalisation de seulement $8 milliards, elle est 9 fois plus petite que Casablanca. Volume quotidien : seulement $2-3 millions ! Pourtant, elle a une histoire respectable depuis 1969 et des caractéristiques intéressantes.'));

  add(table('Les valeurs phares de Tunis',
    ['Société', 'Secteur', 'Market Cap', 'Profil'],
    [
      ['BIAT', 'Banque', '~$1,2B', 'Plus grande banque privée de Tunisie'],
      ['SFBT', 'Boissons', '~$800M', 'Monopole sur la bière (Celtia)'],
      ['Poulina Group', 'Conglomérat', '~$500M', 'Plus grand groupe privé tunisien'],
      ['Délice Holding', 'Agroalimentaire', '~$450M', 'Danone Tunisie'],
      ['STB', 'Banque publique', '~$300M', 'En restructuration']
    ]
  ));

  add(warning('Le piège de la liquidité à Tunis',
    'Sur la BVMT, certains titres mid-cap ne s\'échangent que quelques milliers de dollars par jour. Vendre $100 000 d\'un titre peut prendre 3-5 jours et faire baisser le cours de 5-10%. Règle d\'or : ne jamais représenter plus de 10% du volume quotidien d\'un titre.'));

  add(concept('Alger — Le marché fantôme',
    'La SGBV d\'Alger est le cas le plus extrême. Créée en 1999, elle ne compte que 5 titres cotés pour une capitalisation d\'environ $100 millions. L\'Algérie interdit le rapatriement libre des profits pour les investisseurs étrangers. Vous pouvez gagner de l\'argent à Alger, mais le sortir du pays est un parcours administratif de plusieurs mois.'));

  add(comparison('Casablanca vs Tunis vs Alger',
    { label: 'Casablanca', items: [
      'Market Cap : $70 Mds',
      '75 titres cotés',
      'Volume : $15-20M/jour',
      'Ouvert aux étrangers',
      'MSCI Frontier Markets'
    ]},
    { label: 'Tunis / Alger', items: [
      'Tunis : $8 Mds, Alger : $100M',
      '80 titres / 5 titres',
      'Volume : $3M / quasi-nul',
      'Accès limité / fermé',
      'Marchés de niche'
    ]}
  ));

  add(summary('Le Maghreb boursier — Ce qu\'il faut retenir', [
    'Casablanca est la star : $70 Mds, 2ème bourse d\'Afrique',
    'Dominée par les banques (~40%) et Maroc Telecom',
    'Coupe du Monde 2030 = catalyseur majeur pour Casablanca',
    'Tunis : micro-marché ($8 Mds), liquidité très faible',
    'Alger : marché quasi-inexistant (5 titres, $100M)',
    'Attention au risque de change sur MAD et TND'
  ]));

  // Quiz 2 (~slide 40)
  add(quiz(
    'Quelle est la plus grande entreprise cotée à la Bourse de Casablanca ?',
    ['Maroc Telecom', 'Attijariwafa Bank', 'OCP Group', 'LafargeHolcim Maroc'],
    1,
    'Attijariwafa Bank est la plus grande capitalisation du MASI (~$11 Mds). C\'est la plus grande banque d\'Afrique par réseau, présente dans 25 pays africains. OCP n\'est pas coté en bourse (entreprise d\'État).'
  ));

  add(quiz(
    'Quel événement sportif est un catalyseur majeur pour la Bourse de Casablanca ?',
    ['Les Jeux Olympiques 2028', 'La Coupe du Monde 2030', 'La CAN 2025', 'Les Jeux Méditerranéens 2030'],
    1,
    'La Coupe du Monde 2030, co-organisée par le Maroc, l\'Espagne et le Portugal, va générer des investissements massifs en infrastructure (stades, routes, hôtels). Les entreprises de BTP, ciment et logistique cotées à Casablanca en seront les premières bénéficiaires.'
  ));

  // ======================================================================
  // CHAPITRE 3 — LES BOURSES DU GOLFE
  // ======================================================================
  add(chapterIntro(3, 'Tadawul, ADX, DFM, QSE — Les Bourses du Golfe', 'Aramco, IHC, Emaar et les fonds souverains'));

  add(concept('Tadawul — La plus grande bourse du monde arabe',
    'Tadawul (Saudi Exchange) est le colosse de la région MENA. Capitalisation : $2 800 milliards, volume quotidien : $1-3 milliards. C\'est l\'une des 10 plus grandes bourses du monde, devant la Corée du Sud, l\'Australie ou le Brésil. Depuis 2019, elle est incluse dans l\'indice MSCI Emerging Markets.'));

  add(table('Top 10 valeurs du TASI (Tadawul)',
    ['Société', 'Secteur', 'Market Cap'],
    [
      ['Saudi Aramco', 'Énergie', '~$1 800B'],
      ['Al Rajhi Bank', 'Banque islamique', '~$100B'],
      ['SNB (Saudi National Bank)', 'Banque', '~$65B'],
      ['STC (Saudi Telecom)', 'Télécoms', '~$55B'],
      ['SABIC', 'Pétrochimie', '~$50B'],
      ['Acwa Power', 'Énergie verte', '~$30B'],
      ['Ma\'aden', 'Mines', '~$25B'],
      ['Riyad Bank', 'Banque', '~$22B'],
      ['Jabal Omar Dev.', 'Immobilier', '~$10B'],
      ['Elm Company', 'Tech/Services', '~$9B']
    ]
  ));

  add(concept('Saudi Aramco — La société la plus profitable du monde',
    'Saudi Aramco (2222.SR) est un monstre financier sans équivalent. Profits annuels : $100-160 milliards. Production : 12 millions de barils par jour. Réserves prouvées : 261 milliards de barils. Dividende annuel : $80-100 milliards — le plus gros dividende de toutes les sociétés cotées au monde. Son IPO de 2019 a levé $25,6 milliards, un record mondial.'));

  add(warning('Le piège du flottant d\'Aramco',
    'Seuls 1,7% du capital d\'Aramco sont cotés en bourse. Le flottant réel est d\'environ $30 milliards — comparable à une mid-cap américaine malgré une capitalisation de $1 800 milliards. Cela rend le titre vulnérable aux pressions vendeuses et limite sa représentation dans les indices internationaux.'));

  add(concept('Vision 2030 — La transformation saoudienne',
    'Le plan Vision 2030 du prince Mohammed bin Salman vise à diversifier l\'économie au-delà du pétrole. Le PIF (Public Investment Fund) est le bras armé de cette transformation. Des IPO gigantesques sont prévues : NEOM ($500 Mds), Roshn (immobilier), CEER (voitures électriques). Tadawul vise +150 nouvelles cotations d\'ici 2030.'));

  add(concept('ADX — Abu Dhabi et l\'empire IHC',
    'L\'ADX est devenu l\'un des marchés les plus dynamiques grâce à deux forces motrices. D\'abord, IHC (International Holding Company) — le conglomérat de Sheikh Tahnoon passé de $300M à $240 milliards de capitalisation en 7 ans, une multiplication par 800 ! Ensuite, les IPO d\'ADNOC, le géant pétrolier d\'Abu Dhabi.'));

  add(table('Les poids lourds de l\'ADX',
    ['Société', 'Secteur', 'Market Cap'],
    [
      ['IHC', 'Conglomérat', '~$240B'],
      ['e& (Etisalat)', 'Télécoms', '~$55B'],
      ['FAB (First Abu Dhabi Bank)', 'Banque', '~$45B'],
      ['ADNOC Distribution', 'Énergie', '~$25B'],
      ['ADNOC Drilling', 'Services pétroliers', '~$15B'],
      ['Aldar Properties', 'Immobilier', '~$12B']
    ]
  ));

  add(concept('DFM — Dubaï, immobilier et tourisme',
    'Le DFM est le marché de Dubaï — la ville-vitrine du Golfe. Plus petit que l\'ADX ($180B vs $700B), il se distingue par son exposition à l\'immobilier et au tourisme. Emaar Properties (constructeur du Burj Khalifa et du Dubai Mall) est la star du DFM avec une capitalisation de ~$30 milliards.'));

  add(table('Les poids lourds du DFM (Dubaï)',
    ['Société', 'Secteur', 'Market Cap'],
    [
      ['Emaar Properties', 'Immobilier', '~$30B'],
      ['Emirates NBD', 'Banque', '~$20B'],
      ['DAMAC Properties', 'Immobilier', '~$8B'],
      ['Air Arabia', 'Aviation low-cost', '~$5B'],
      ['DEWA', 'Utilities', '~$20B']
    ]
  ));

  add(concept('Bourse du Qatar (QSE)',
    'Le Qatar abrite la Qatar Stock Exchange avec une capitalisation d\'environ $170 milliards. Les deux poids lourds sont QNB (Qatar National Bank) — la plus grande banque d\'Afrique et du Moyen-Orient par actifs — et Industries Qatar (pétrochimie, engrais, acier). Le fonds souverain QIA ($500 Mds) est l\'un des plus puissants au monde.'));

  add(tip('Les fonds souverains — Les vrais maîtres du jeu',
    'Les fonds souverains du Golfe sont les architectes invisibles des marchés. PIF (Arabie Saoudite) : $930 Mds, ADIA (Abu Dhabi) : $900 Mds, QIA (Qatar) : $500 Mds, KIA (Koweït) : $800 Mds. Leurs décisions d\'investissement, de privatisation et d\'IPO façonnent les indices boursiers de toute la région.'));

  add(summary('Les bourses du Golfe — Ce qu\'il faut retenir', [
    'Tadawul = 65% de la capitalisation MENA, portée par Aramco',
    'ADX dominé par IHC ($240B) et les IPO ADNOC',
    'DFM = proxy immobilier et tourisme de Dubaï',
    'Qatar : QNB + Industries Qatar, fonds souverain QIA puissant',
    'Vision 2030 : la variable clé pour l\'avenir du Tadawul',
    'Devises peggées au dollar = zéro risque de change'
  ]));

  // Quiz 3 (~slide 60)
  add(quiz(
    'Quelle est la capitalisation boursière de Saudi Aramco ?',
    ['~$500 milliards', '~$1 800 milliards', '~$3 000 milliards', '~$240 milliards'],
    1,
    'Saudi Aramco est valorisée à environ $1 800 milliards, ce qui en fait l\'une des sociétés les plus précieuses au monde. Ses profits annuels ($100-160 Mds) sont les plus élevés de l\'histoire.'
  ));

  add(quiz(
    'IHC (International Holding Company) a vu sa capitalisation multipliée par combien entre 2018 et 2025 ?',
    ['x10', 'x100', 'x800', 'x50'],
    2,
    'IHC est passé de $300 millions en 2018 à plus de $240 milliards en 2025 — une multiplication par 800 en 7 ans. C\'est le conglomérat de Sheikh Tahnoon bin Zayed, frère du président des Émirats.'
  ));

  // ======================================================================
  // CHAPITRE 4 — OPPORTUNITÉS & RISQUES
  // ======================================================================
  add(chapterIntro(4, 'Opportunités & Risques', 'Pourquoi investir dans la région MENA — et pourquoi être prudent'));

  add(concept('La bombe démographique — 400 millions d\'habitants',
    'La région MENA compte 400 millions d\'habitants avec un âge médian de 25-30 ans (vs 43 en Europe). 60% de la population a moins de 30 ans. Pic démographique prévu à 600M+ en 2050. C\'est le même "dividende démographique" qui a propulsé la croissance asiatique dans les années 1970-2000. Les secteurs gagnants : banques, télécoms, e-commerce, éducation.'));

  add(concept('Sous-bancarisation — Un océan bleu',
    'Entre 50% et 70% de la population MENA n\'a pas de compte bancaire. En Égypte, seulement 33% de la population est bancarisée ! C\'est un marché vierge pour les fintechs et banques mobiles. Exemple : Fawry en Égypte est passée de 0 à 40 millions d\'utilisateurs en captant les non-bancarisés. Son IPO au Caire a fait +125% le premier jour.'));

  add(table('Taux de bancarisation par pays',
    ['Pays', 'Bancarisation', 'Mobile', 'Opportunité fintech'],
    [
      ['Maroc', '53%', '128%', 'Très forte'],
      ['Égypte', '33%', '95%', 'Massive'],
      ['Tunisie', '37%', '120%', 'Très forte'],
      ['Algérie', '43%', '110%', 'Forte (régulée)'],
      ['Arabie Saoudite', '74%', '170%', 'Modérée'],
      ['Émirats', '88%', '200%', 'Mature']
    ]
  ));

  add(bullets('Urbanisation massive — Méga-projets pharaoniques', [
    'NEOM (Arabie Saoudite) : $500 Mds — ville futuriste de 170 km, THE LINE, station de ski Trojena',
    'Nouveau Caire (Égypte) : $58 Mds — nouvelle capitale, tour de 385m (plus haute d\'Afrique)',
    'Lusail City (Qatar) : $45 Mds — 200 000 résidents',
    'Masdar City (UAE) : $22 Mds — ville zéro carbone',
    'Tanger Med (Maroc) : $13 Mds — 1er port d\'Afrique'
  ]));

  add(concept('Transition énergétique — Du pétrole au solaire',
    'Paradoxalement, les pays pétroliers du Golfe sont parmi les plus gros investisseurs au monde dans les énergies renouvelables. L\'irradiation solaire MENA : 2 000-2 400 kWh/m²/an (vs 900-1 100 en Europe du Nord). $200 milliards d\'investissement renouvelable prévu 2024-2030. Noor Ouarzazate (Maroc, 580 MW), Al Dhafra Solar (UAE, 2 GW), NEOM Green Hydrogen.'));

  add(table('Tourisme MENA en expansion',
    ['Pays', 'Touristes/an (2024)', 'Objectif', '% du PIB'],
    [
      ['Maroc', '14,5M', '17,5M (2028)', '7%'],
      ['Émirats', '21M', '25M (2027)', '12%'],
      ['Arabie Saoudite', '27M', '100M (2030)', '4% → 10%'],
      ['Tunisie', '10M', '12M (2027)', '8%'],
      ['Égypte', '15M', '30M (2028)', '5%']
    ]
  ));

  // --- RISQUES ---
  add(concept('Risque géopolitique — Le plus imprévisible',
    'La région MENA est la zone la plus géopolitiquement instable au monde. La Bourse du Caire a chuté de -37% pendant la révolution de 2011 et a été fermée pendant 55 jours. La Bourse de Damas a fermé à cause de la guerre civile. Le Tadawul a chuté de -15% lors de l\'attaque sur Aramco en 2019. Dans la région MENA, le risque de fermeture de marché est réel.'));

  add(table('Risque de change — L\'érosion silencieuse',
    ['Devise', 'Régime', 'Perte vs USD (5 ans)', 'Risque'],
    [
      ['EGP (Livre égyptienne)', 'Flottant dirigé', '-65%', 'Extrême'],
      ['TND (Dinar tunisien)', 'Flottant dirigé', '-30%', 'Élevé'],
      ['DZD (Dinar algérien)', 'Flottant dirigé', '-25%', 'Élevé'],
      ['MAD (Dirham marocain)', 'Panier EUR/USD', '-12%', 'Modéré'],
      ['SAR (Riyal saoudien)', 'Peg USD', '0%', 'Faible'],
      ['AED (Dirham émirati)', 'Peg USD', '0%', 'Faible']
    ]
  ));

  add(concept('Le piège du change — Exemple concret',
    'Un investisseur français achète des actions égyptiennes. L\'action gagne +40% en livres égyptiennes, mais la livre perd -50% face à l\'euro. Rendement réel = (1 + 0,40) x (1 - 0,50) - 1 = -30%. Le gain boursier a été entièrement dévoré par la dévaluation ! Pour les marchés à monnaie volatile, intégrez toujours le risque de change.'));

  add(concept('Liquidité faible — Le piège de la sortie',
    'Sur de nombreux marchés MENA, sortir d\'une position prend des jours, voire des semaines. Comparaison des volumes quotidiens : NYSE = $25 Mds/jour, Tadawul = $2 Mds, Casablanca = $15M, Tunis = $3M. Sur un marché peu liquide, vous êtes prisonnier de votre propre position.'));

  add(warning('Gouvernance d\'entreprise — Le risque familial',
    'La majorité des entreprises MENA sont contrôlées par des familles fondatrices ou l\'État. Le flottant est souvent inférieur à 30%. Risques : transactions avec parties liées non divulguées, dilution soudaine, dividendes imprévisibles, comptabilité selon normes locales, reporting en arabe uniquement. Bonne nouvelle : adoption progressive des normes IFRS.'));

  add(concept('Dutch Disease — La malédiction du pétrole',
    'L\'abondance de revenus pétroliers rend les autres secteurs non compétitifs. Quand le pétrole baisse, toute l\'économie souffre car rien n\'a été développé pour compenser. Vision 2030 est la réponse saoudienne : réduire la dépendance pétrolière de 62% à 28% du PIB. Le succès de Vision 2030 est LA variable n°1 pour l\'avenir du marché saoudien.'));

  // Quiz 4 (~slide 85)
  add(quiz(
    'Un investisseur achète des actions au Caire. L\'action gagne +40% en livres, la livre perd -50%. Quel est son rendement réel ?',
    ['+40%', '-10%', '-30%', '0%'],
    2,
    'Rendement réel = (1 + 0,40) x (1 - 0,50) - 1 = 0,70 - 1 = -30%. Le gain boursier de 40% est annulé par la dévaluation de 50% de la monnaie. C\'est l\'illustration parfaite du risque de change.'
  ));

  // --- SECTEURS ---
  add(bullets('Les 6 secteurs stars de la région MENA', [
    '1. Finance islamique — $4 000 Mds d\'actifs, +12%/an, sukuk, banques halal',
    '2. Immobilier — Emaar, Aldar, DAMAC, boom et bust cycliques',
    '3. Mines & Phosphates — Maroc = 70% des réserves mondiales de phosphate (OCP)',
    '4. Tourisme & Aviation — Air Arabia, hub mondial de Dubaï, Saudia IPO prévue',
    '5. Agroalimentaire — Almarai, Savola, Poulina, demande structurelle croissante',
    '6. Télécoms — Machines à dividendes : STC (3,5%), e& (4,2%), Maroc Telecom (5,8%)'
  ]));

  add(concept('Finance islamique — Un marché de $4 000 milliards',
    'La finance islamique représente plus de $4 000 milliards d\'actifs, dont la majorité en MENA. Les banques islamiques fonctionnent sans intérêt (riba), utilisent le partage de profit (mudaraba, musharaka) et émettent des sukuk (obligations islamiques). Al Rajhi Bank est la plus grande banque islamique au monde. Le marché des sukuk dépasse $800 milliards d\'encours.'));

  add(concept('Comment fonctionne un sukuk ?',
    'Un sukuk n\'est pas une obligation classique qui paie un intérêt fixe. Il représente une part de propriété dans un actif tangible (immeuble, projet d\'infrastructure). Le rendement provient des revenus de cet actif (loyers, profits), pas d\'un intérêt. C\'est cette structure de propriété réelle qui rend le sukuk conforme à la charia. Les sukuk sont notés par Moody\'s, S&P et Fitch.'));

  add(table('Télécoms MENA — Les machines à dividendes',
    ['Opérateur', 'Pays', 'Abonnés', 'Dividend Yield'],
    [
      ['STC', 'Arabie Saoudite', '160M+', '3,5%'],
      ['e& (Etisalat)', 'Émirats', '170M+', '4,2%'],
      ['Ooredoo', 'Qatar', '120M+', '4,0%'],
      ['Maroc Telecom', 'Maroc', '77M+', '5,8%'],
      ['Zain Group', 'Koweït', '50M+', '5,2%'],
      ['Vodafone Egypt', 'Égypte', '45M+', '2,5%']
    ]
  ));

  add(table('Radar risque/rendement par pays',
    ['Pays', 'Potentiel', 'Risque', 'Liquidité', 'Verdict'],
    [
      ['Arabie Saoudite', 'Élevé', 'Modéré', 'Bonne', 'Recommandé'],
      ['Émirats (ADX/DFM)', 'Élevé', 'Faible', 'Bonne', 'Recommandé'],
      ['Maroc', 'Modéré', 'Modéré', 'Faible', 'Intéressant'],
      ['Qatar', 'Modéré', 'Faible', 'Moyenne', 'Intéressant'],
      ['Égypte', 'Très élevé', 'Élevé', 'Moyenne', 'Spéculatif'],
      ['Tunisie', 'Modéré', 'Élevé', 'Très faible', 'Prudence'],
      ['Algérie', 'Limité', 'Élevé', 'Quasi-nulle', 'Éviter']
    ]
  ));

  add(concept('Le nearshoring — L\'opportunité cachée du Maghreb',
    'Depuis le COVID et les tensions géopolitiques, les entreprises européennes relocalisent leurs chaînes d\'approvisionnement. Le Maroc attire Renault, Stellantis, Boeing, Safran. La Tunisie accueille des centres de services IT. C\'est un moteur de croissance séculaire qui ne dépend ni du pétrole ni du tourisme. Croissance PIB attendue : Golfe 3-5%/an, Maroc 3-4%/an, Égypte 4-6%/an vs Zone Euro 1-2%.'));

  add(summary('Opportunités & Risques — Ce qu\'il faut retenir', [
    'Démographie jeune (âge médian 25-30 ans) = dividende démographique',
    'Sous-bancarisation massive = océan bleu pour les fintechs',
    'Méga-projets ($1 000+ Mds en cours) = demande d\'infrastructure',
    'Risque géopolitique non diversifiable — fermeture de marché possible',
    'Change : livre égyptienne -65% en 5 ans, devises du Golfe stables',
    'Vision 2030 est la variable clé pour l\'avenir de la région',
    'Télécoms et agroalimentaire = valeurs défensives à dividendes'
  ]));

  // Quiz 5 (~slide 100)
  add(quiz(
    'Qu\'est-ce que la "Dutch Disease" (maladie hollandaise) ?',
    ['Une pandémie qui a frappé les Pays-Bas', 'L\'excès de pétrole qui rend les autres secteurs non compétitifs', 'Une taxe spéciale sur les importations', 'Un accord commercial entre pays du Golfe'],
    1,
    'La Dutch Disease survient quand l\'abondance d\'une ressource naturelle (pétrole) génère tellement de revenus que les autres secteurs (agriculture, industrie) deviennent non compétitifs. Vision 2030 est la tentative saoudienne de guérir cette maladie.'
  ));

  // ======================================================================
  // CHAPITRE 5 — GUIDE PRATIQUE
  // ======================================================================
  add(chapterIntro(5, 'Guide Pratique — Accéder aux Marchés MENA', 'Courtiers, ETFs, fiscalité et outils'));

  add(steps('Ouvrir un compte — Bourse de Casablanca', [
    { step: 'Choisir un courtier agréé AMMC', detail: 'Attijariwafa Bourse, BMCE Capital Bourse, CDG Capital Bourse, Upline Securities, CFG Marchés' },
    { step: 'Constituer le dossier', detail: 'Passeport, justificatif de domicile, attestation bancaire. MRE : compte en dirhams convertibles' },
    { step: 'Alimenter le compte', detail: 'Virement international en MAD. Compte en devises convertibles pour non-résidents. Délai : 3-5 jours' },
    { step: 'Passer des ordres', detail: 'Trading 9h30-15h30 (GMT+1). Commission : 0,4-0,8%. Règlement : T+3' }
  ]));

  add(steps('Accéder au Tadawul (Arabie Saoudite)', [
    { step: 'Obtenir le statut QFII', detail: 'Minimum $500M (institutions) ou $1M (particuliers qualifiés). Inscription auprès de la CMA' },
    { step: 'Alternative : accès via swap', detail: 'Interactive Brokers et Saxo offrent un accès via P-Notes ou swaps. Coût supplémentaire : 0,5-1,5%/an' },
    { step: 'Trading', detail: 'Dimanche-jeudi, 10h-15h (GMT+3). SAR peggé au USD. Commission : 0,12% (instit.) à 0,3% (retail)' }
  ]));

  add(steps('Accéder au DFM & ADX (Émirats)', [
    { step: 'Choisir un courtier', detail: 'Emirates NBD Securities, FAB Securities, EFG Hermes. Interactive Brokers offre aussi un accès direct' },
    { step: 'Obtenir un NIN', detail: 'National Investor Number, l\'équivalent d\'un compte titres. Procédure en ligne, 2-3 jours' },
    { step: 'Trading', detail: 'Lun-ven (depuis 2022), 10h-14h (GMT+4). AED peggé au USD. Commission : 0,15-0,275%' }
  ]));

  add(concept('La voie la plus simple — Les ETFs',
    'Pour la plupart des investisseurs, les ETFs sont le moyen le plus pratique d\'accéder aux marchés MENA. Pas de compte local, pas de risque de courtier exotique, liquidité garantie sur les bourses occidentales. Le tout avec une diversification automatique.'));

  add(table('Les principaux ETFs MENA',
    ['ETF', 'Ticker', 'Frais (TER)', 'Actif Net', 'Couverture'],
    [
      ['iShares MSCI Saudi Arabia', 'KSA', '0,74%', '$900M', 'Arabie Saoudite'],
      ['Franklin FTSE Saudi Arabia', 'FLSA', '0,39%', '$220M', 'Saudi large & mid'],
      ['iShares MSCI Qatar', 'QAT', '0,59%', '$90M', 'Qatar'],
      ['iShares MSCI UAE', 'UAE', '0,59%', '$50M', 'Émirats'],
      ['VanEck Africa', 'AFK', '0,79%', '$70M', 'Afrique (Maroc, Égypte)'],
      ['iShares MSCI Frontier', 'FM', '0,79%', '$500M', 'Frontier (Maroc, Tunisie)'],
      ['WisdomTree ME Dividend', 'GULF', '0,88%', '$40M', 'GCC dividendes']
    ]
  ));

  add(tip('Stratégie "Core MENA" en 3 ETFs',
    'Pour $10 000 d\'exposition MENA diversifiée : 50% KSA ($5 000) pour l\'Arabie Saoudite, 30% UAE ($3 000) pour les Émirats, 20% FM ($2 000) pour les marchés Frontier incluant Maroc et Tunisie. Coût moyen : ~0,70%/an. Rééquilibrage semestriel recommandé.'));

  add(comparison('ETFs MENA — Avantages vs Inconvénients',
    { label: 'Avantages', items: [
      'Pas de compte local requis',
      'Liquidité sur les bourses occidentales',
      'Diversification automatique (panier)',
      'Pas de risque de courtier exotique',
      'Couverture de change implicite (peg USD)'
    ]},
    { label: 'Inconvénients', items: [
      'Frais élevés : 0,39-0,88% vs 0,03% pour SPY',
      'Couverture limitée (pas d\'ETF Tunisie pur)',
      'Concentration sectorielle (banques, énergie)',
      'Tracking error plus élevé',
      'Certains ETFs sont peu liquides ($40-90M)'
    ]}
  ));

  add(concept('ADRs & GDRs — Actions MENA à New York et Londres',
    'Les ADRs/GDRs permettent d\'acheter des actions MENA sur les bourses occidentales. La couverture est encore limitée : Orascom Construction (Euronext), CIB Égypte (Londres), Telecom Egypt (Londres). Aramco n\'a pas d\'ADR — le gouvernement saoudien ne souhaite pas se soumettre au reporting SEC. Attention aux GDRs peu liquides : les spreads bid-ask sont souvent de 2-5%.'));

  add(table('Fiscalité — Impôts par pays',
    ['Pays', 'Plus-Values', 'Dividendes (retenue source)', 'Convention France'],
    [
      ['Arabie Saoudite', '0%', '5%', 'Oui (2012)'],
      ['Émirats', '0%', '0%', 'Oui (1989)'],
      ['Qatar', '0%', '0%', 'Oui (1990)'],
      ['Koweït', '0%', '0%', 'Oui (1982)'],
      ['Bahreïn', '0%', '0%', 'Oui (1993)'],
      ['Maroc', '15%', '15%', 'Oui (1970, rév. 2018)'],
      ['Tunisie', '10%', '10%', 'Oui (1973)'],
      ['Égypte', '10%', '10%', 'Oui (1980)']
    ]
  ));

  add(concept('La Zakat — L\'impôt islamique',
    'En Arabie Saoudite et dans certains pays du Golfe, les entreprises sont soumises à la Zakat : un impôt islamique de 2,5% sur la richesse nette (pas sur les bénéfices). Pour un investisseur étranger, la Zakat est déjà intégrée dans les résultats — vous n\'avez rien à payer en plus. Mais c\'est un coût qui réduit les bénéfices distribuables de 2-3%.'));

  add(bullets('Outils et ressources pour l\'investisseur MENA', [
    'TradingView : tickers MENA au format TADAWUL:2222 (Aramco), CASABLANCA:IAM (Maroc Telecom)',
    'Argaam.com : analyses financières MENA (arabe + anglais)',
    'Mubasher.info : données temps réel bourses arabes',
    'Investing.com : données générales, section MENA',
    'Boursa Kuwait, DFM, ADX : sites officiels avec données en anglais',
    'AMMC.ma et CMF (Tunisie) : rapports des régulateurs'
  ]));

  add(summary('Guide pratique — Ce qu\'il faut retenir', [
    'Émiratis : accès le plus simple, pas de restrictions QFII',
    'Tadawul : accès QFII ou via swap (Interactive Brokers, Saxo)',
    'ETFs : la voie la plus pratique — KSA, UAE, FM pour un portefeuille Core MENA',
    'Fiscalité très avantageuse au Golfe (0% plus-values et dividendes)',
    'GDRs : option limitée et peu liquide',
    'Toujours vérifier le volume quotidien avant d\'investir directement'
  ]));

  // Quiz 6 (~slide 125)
  add(quiz(
    'Quel est le moyen le plus simple pour un investisseur français d\'avoir une exposition au marché saoudien ?',
    ['Ouvrir un compte QFII au Tadawul', 'Acheter l\'ETF KSA ou FLSA sur NYSE', 'Acheter un GDR d\'Aramco à Londres', 'Investir via un fond de pension'],
    1,
    'Les ETFs comme KSA (iShares MSCI Saudi Arabia, $900M d\'actifs) ou FLSA (Franklin, frais 0,39%) sont accessibles depuis n\'importe quel courtier occidental. Pas besoin de QFII ni de compte local. Aramco n\'a pas de GDR/ADR.'
  ));

  add(quiz(
    'Quel est le taux d\'imposition sur les plus-values boursières aux Émirats ?',
    ['15%', '10%', '5%', '0%'],
    3,
    'Les Émirats ne prélèvent ni impôt sur les plus-values, ni retenue à la source sur les dividendes. C\'est l\'un des régimes fiscaux les plus avantageux au monde pour les investisseurs.'
  ));

  // ======================================================================
  // CHAPITRE 6 — CRYPTO, FINTECH & AVENIR
  // ======================================================================
  add(chapterIntro(6, 'Crypto, Fintech & Avenir', 'La révolution numérique qui transforme la région MENA'));

  add(concept('Crypto dans le monde arabe — Un paysage fragmenté',
    'L\'adoption crypto dans la région MENA est un contraste saisissant. D\'un côté, Dubaï est devenu un hub crypto mondial avec VARA, le premier régulateur entièrement dédié aux actifs virtuels. De l\'autre, le Maroc et l\'Algérie interdisent officiellement les cryptomonnaies. Chaque pays trace sa propre voie.'));

  add(table('Statut crypto par pays MENA',
    ['Pays', 'Statut', 'Régulateur', 'Adoption'],
    [
      ['Émirats (Dubaï)', 'Régulé (VARA)', 'VARA + SCA', 'Très élevée'],
      ['Émirats (Abu Dhabi)', 'Régulé (ADGM)', 'FSRA', 'Élevée'],
      ['Bahreïn', 'Régulé', 'CBB', 'Modérée'],
      ['Arabie Saoudite', 'Non régulé (toléré)', 'SAMA', 'Croissante'],
      ['Égypte', 'Non régulé (toléré)', 'CBE', 'Informelle'],
      ['Maroc', 'Interdit (2017)', 'Bank Al-Maghrib', 'Clandestine'],
      ['Algérie', 'Interdit (2018)', 'Banque d\'Algérie', 'Très faible'],
      ['Tunisie', 'Non régulé (hostile)', 'BCT', 'Informelle']
    ]
  ));

  add(concept('VARA — Le régulateur crypto de Dubaï',
    'La Virtual Assets Regulatory Authority (VARA), créée en mars 2022, est le premier régulateur au monde dédié aux actifs virtuels. 19 exchanges licenciés, 1 000+ entreprises crypto à Dubaï (+300% depuis 2022), volume mensuel estimé à $30 milliards, et 0% d\'impôt sur les plus-values crypto. Binance, OKX, Bybit et Crypto.com ont tous leur siège régional à Dubaï.'));

  add(bullets('Pourquoi Dubaï attire les entreprises crypto', [
    'Régulation claire — VARA offre un cadre juridique précis (vs incertitude aux USA ou en Europe)',
    '0% d\'impôt — pas d\'impôt sur les revenus, les plus-values ou les sociétés',
    'Écosystème complet — avocats spécialisés, banques crypto-friendly, data centers',
    'Fuseau horaire idéal (GMT+4) — entre l\'Asie et l\'Europe',
    '19 exchanges licenciés : Binance, OKX, Bybit, BitOasis, etc.'
  ]));

  add(concept('Bitcoin Mining au Moyen-Orient',
    'Le Moyen-Orient a un avantage majeur : l\'énergie bon marché. Coût électrique : $0,02-0,05/kWh (vs $0,10-0,20 en Europe). Marathon Digital a installé une ferme de 250 MW à Abu Dhabi. Oman utilise le gaz torché pour alimenter les machines de minage — transformant un déchet environnemental en revenu. Le minage de Bitcoin est en train de devenir une industrie stratégique dans le Golfe.'));

  add(concept('Le débat halal/haram — La crypto est-elle conforme à la charia ?',
    'Les avis des savants islamiques sont profondément divisés. Arguments "halal" : Bitcoin est un actif numérique (pas de riba/intérêt dans le protocole), blockchain transparente, minage = travail productif. Arguments "haram" : spéculation excessive (maysir), pas de valeur intrinsèque, utilisée pour des activités illicites. Wahed Invest propose un portefeuille crypto "sharia-compliant" avec screening islamique.'));

  add(table('Exchanges crypto régionaux',
    ['Exchange', 'Siège', 'Licence', 'Spécialité'],
    [
      ['Rain Financial', 'Bahreïn', 'CBB + VARA', '1er exchange licencié MENA (2019)'],
      ['CoinMENA', 'Bahreïn', 'CBB', 'Focus GCC, interface arabe'],
      ['BitOasis', 'Dubaï', 'VARA', 'Vétéran MENA (2015)'],
      ['M2', 'Abu Dhabi', 'FSRA (ADGM)', 'Custody institutionnel'],
      ['Binance MENA', 'Dubaï', 'VARA', 'Plus grand exchange mondial']
    ]
  ));

  add(warning('Le paradoxe marocain',
    'Le Maroc a officiellement interdit les cryptomonnaies en 2017. Pourtant, c\'est le 1er adopteur crypto d\'Afrique du Nord selon Chainalysis. Des millions de Marocains utilisent des exchanges P2P et des VPN. Bank Al-Maghrib travaille sur un projet de CBDC et une révision réglementaire est attendue d\'ici 2026-2027. Le passage de l\'interdiction à la régulation semble inévitable.'));

  // --- FINTECH ---
  add(concept('L\'explosion des fintechs MENA',
    'La combinaison d\'une population jeune, sous-bancarisée, ultra-connectée (pénétration smartphone > 80%) et d\'un cadre réglementaire favorable crée un terrain idéal. Le secteur a levé plus de $3,5 milliards de capital-risque entre 2020 et 2025. Les licornes émergent : STC Pay ($1,3 Md), Tabby ($1,5 Md), Tamara ($1 Md).'));

  add(table('Les fintechs stars de la région',
    ['Fintech', 'Pays', 'Service', 'Utilisateurs'],
    [
      ['Fawry', 'Égypte', 'Réseau de paiement', '40M+'],
      ['STC Pay', 'Arabie Saoudite', 'Wallet mobile', '12M+'],
      ['Tabby', 'Émirats', 'BNPL', '10M+'],
      ['Tamara', 'Arabie Saoudite', 'BNPL', '8M+'],
      ['CashPlus', 'Maroc', 'Transfert d\'argent', '5M+'],
      ['Paymob', 'Égypte', 'Payment gateway', '250K marchands']
    ]
  ));

  add(bullets('Néobanques & banques digitales MENA', [
    'Payit (UAE) — Wallet digital de FAB, 3M+ utilisateurs',
    'meem (Bahreïn) — 1ère banque digitale islamique du Golfe',
    'D360 Bank (Arabie Saoudite) — 1ère banque digitale saoudienne, licence SAMA complète',
    'Wio Bank (UAE) — Joint venture ADQ + e& + Alpha Dhabi, valorisée $2 Mds+'
  ]));

  add(concept('Robo-advisors & investissement halal',
    'Les plateformes de robo-advisory halal combinent gestion algorithmique et conformité charia. Le screening filtre les entreprises selon l\'activité (max 5% de revenus interdits : alcool, jeu, armes) et la structure financière (dette/actifs < 33%). Sarwa ($500M d\'AUM aux UAE) et Wahed ($300M) sont les leaders. Investissement minimum : $100.'));

  // --- AVENIR ---
  add(concept('MSCI Upgrades — Le catalyseur des flux',
    'La classification MSCI détermine les flux institutionnels. L\'upgrade du Koweït de Frontier à Emerging Markets en 2020 a déclenché $4,5 milliards de flux passifs et +28% en 12 mois. Le Maroc est candidat à un upgrade similaire, ce qui pourrait générer $2-3 milliards de flux entrants. L\'Arabie Saoudite, les Émirats et le Qatar sont déjà Emerging Markets.'));

  add(concept('Interconnexion des bourses GCC',
    'Les six bourses du Golfe (GCC) travaillent à une interconnexion technique : trader sur les six marchés depuis un compte unique. Capitalisation combinée : $4 200+ milliards. Si ce projet aboutit, il créerait l\'un des plus grands marchés intégrés des pays émergents, rivalisant avec Hong Kong.'));

  add(table('IPOs et privatisations à venir',
    ['Entreprise', 'Pays', 'Secteur', 'Valeur estimée'],
    [
      ['Aramco (secondaire)', 'Arabie Saoudite', 'Pétrole', '$10-15 Mds'],
      ['Saudia Airlines', 'Arabie Saoudite', 'Aviation', '$5-8 Mds'],
      ['Riyadh Air', 'Arabie Saoudite', 'Aviation', '$3-5 Mds'],
      ['Saudi Electricity (2ndaire)', 'Arabie Saoudite', 'Utilities', '$5 Mds'],
      ['ADNOC Gas (extension)', 'Émirats', 'Énergie', '$3 Mds']
    ]
  ));

  add(concept('Sukuk & Green Bonds — Le nouveau marché obligataire',
    'Le marché des sukuk dépasse $800 milliards d\'encours (+15-20%/an). Les green bonds et sustainability-linked bonds se multiplient ($35 Mds en MENA), financés par les revenus pétroliers mais destinés à financer la transition énergétique. Rendement sukuk investment grade : 4-6%. Rating souverain UAE et Arabie Saoudite : AAA (Moody\'s/S&P).'));

  add(concept('IA et trading algorithmique arrivent dans la région',
    'L\'intelligence artificielle commence à transformer les marchés MENA. Tadawul a lancé un partenariat avec des fournisseurs de données AI. Les fonds souverains (PIF, ADIA) investissent massivement dans l\'IA. Abu Dhabi a créé G42, un champion régional de l\'IA en partenariat avec Microsoft. Les robo-advisors halal utilisent déjà le machine learning pour le screening charia automatique.'));

  add(bullets('Timeline — Ce qui arrive en 2025-2030', [
    '2025 : IPO Saudia Airlines, extension ADNOC Gas, nouvelles licences VARA',
    '2026 : Riyadh Air commence ses opérations, révision crypto au Maroc attendue',
    '2027 : Objectif 25M touristes aux Émirats, interconnexion GCC potentielle',
    '2028 : Objectif 17,5M touristes au Maroc, Coupe du Monde préparatifs',
    '2030 : Objectif Vision 2030, 100M touristes en Arabie Saoudite, NEOM phase 1',
    '2035 : Maturité potentielle des marchés MENA, intégration financière régionale'
  ]));

  // Quiz 7 (~slide 165)
  add(quiz(
    'Quel est le premier régulateur au monde entièrement dédié aux actifs virtuels (crypto) ?',
    ['La SEC (États-Unis)', 'L\'AMF (France)', 'VARA (Dubaï)', 'La FCA (Royaume-Uni)'],
    2,
    'VARA (Virtual Assets Regulatory Authority), créée en mars 2022 à Dubaï, est le premier régulateur au monde dédié exclusivement aux actifs virtuels. Il a licencié 19 exchanges dont Binance et OKX.'
  ));

  add(quiz(
    'Quel événement a généré $4,5 milliards de flux passifs et +28% de performance sur le marché du Koweït ?',
    ['L\'IPO d\'Aramco', 'L\'upgrade MSCI de Frontier à Emerging Markets en 2020', 'La découverte de pétrole', 'L\'interconnexion GCC'],
    1,
    'Quand le Koweït a été reclassé de Frontier à Emerging Markets par MSCI en 2020, les ETFs et fonds indiciels qui répliquent l\'indice MSCI Emerging Markets ont dû acheter des actions koweïtiennes, déclenchant $4,5 milliards de flux entrants.'
  ));

  // ======================================================================
  // CONCLUSION GÉNÉRALE
  // ======================================================================
  add(chapterIntro(0, 'Conclusion — Les Marchés MENA en un Regard', 'Synthèse et enseignements de la série'));

  add(summary('Les 8 enseignements de la série complète', [
    '15 bourses, $4 000+ Mds de capitalisation — un continent financier méconnu',
    'Tadawul (65% de la région) dominée par Aramco — le titan à $1 800 Mds',
    'Casablanca est le champion du Maghreb — Alger est un marché fantôme',
    'Démographie jeune + sous-bancarisation = opportunités structurelles uniques',
    'Risque géopolitique et risque de change sont les deux menaces majeures',
    'ETFs (KSA, UAE, FM) = voie la plus simple pour s\'exposer',
    'Dubaï est devenu le hub crypto mondial grâce à VARA',
    'Vision 2030, MSCI upgrades et interconnexion GCC transformeront la région'
  ]));

  add(comparison('Golfe vs Maghreb — Le résumé',
    { label: 'Golfe (Tadawul, ADX, DFM, QSE)', items: [
      'Capitalisation massive ($3 800+ Mds)',
      'Devises peggées au dollar (0% risque de change)',
      'Liquidité correcte à bonne',
      'Fiscalité très avantageuse (0% impôts)',
      'Dépendance pétrole (Dutch Disease)',
      'Vision 2030 comme catalyseur'
    ]},
    { label: 'Maghreb (Casablanca, Tunis, Alger)', items: [
      'Capitalisation modeste ($78 Mds total)',
      'Risque de change réel (MAD, TND, DZD)',
      'Liquidité faible à quasi-nulle',
      'Fiscalité modérée (10-15%)',
      'Diversification sectorielle (banques, BTP, agro)',
      'Nearshoring et Coupe du Monde 2030'
    ]}
  ));

  add(quote('Les marchés les plus rentables sont ceux que les autres ignorent. La région MENA est l\'un des derniers continents financiers inexplorés.',
    'Série Bourses MENA — DailyTickers'));

  add(warning('Rappel final — Avertissement',
    'Ce contenu est strictement éducatif et ne constitue pas un conseil en investissement. Les marchés MENA comportent des risques spécifiques (géopolitique, change, liquidité) qui peuvent entraîner des pertes significatives. Consultez un conseiller financier agréé avant toute décision d\'investissement.'));

  add(tip('Pour aller plus loin',
    'Retrouvez la série complète en 6 parties sur articles.dailytickers.com/series/bourses-mena/. Chaque article contient des tableaux de données, des graphiques ECharts interactifs, et des quiz pour tester vos connaissances. Abonnez-vous au briefing quotidien pour suivre l\'actualité des marchés MENA.'));

  // Quiz final 8 (~slide 180)
  add(quiz(
    'Quel pays MENA offre le meilleur profil risque/rendement pour un investisseur débutant ?',
    ['L\'Égypte — potentiel très élevé', 'Les Émirats — stabilité + accès + 0% impôt', 'La Tunisie — dividendes attractifs', 'L\'Algérie — marché vierge'],
    1,
    'Les Émirats combinent stabilité politique, absence de risque de change (peg USD), bonne liquidité, accès ouvert aux étrangers, et 0% d\'impôt. C\'est le point d\'entrée idéal pour découvrir les marchés MENA.'
  ));

  return slides;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const series = SERIES[seriesId];
  if (!series) {
    console.error(`Unknown series: ${seriesId}. Available: ${Object.keys(SERIES).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n📚 Generating content for: ${series.config.seriesTitle}`);
  console.log(`   Language: ${series.config.language}, Chapters: ${series.config.totalChapters}`);

  // Set audio prefix per series to avoid filename collisions between videos
  audioPrefix = seriesId.replace(/-/g, '_');
  const slides = series.generator();
  const narration = generateNarration(slides, series.config);

  const eduData = {
    config: series.config,
    slides,
    audioDurations: {}, // filled after TTS
  };

  const outSuffix = process.argv.includes('--output-suffix')
    ? `-${process.argv[process.argv.indexOf('--output-suffix') + 1]}`
    : '';
  const dataFile = `public/edu-data${outSuffix}.json`;
  const narrFile = `public/edu-narration${outSuffix}.json`;
  await fs.writeJson(dataFile, eduData, { spaces: 2 });
  await fs.writeJson(narrFile, narration, { spaces: 2 });

  console.log(`\n✅ Generated ${slides.length} slides`);
  console.log(`   Types: ${[...new Set(slides.map(s => s.type))].join(', ')}`);
  console.log(`   Quizzes: ${slides.filter(s => s.type === 'quiz').length}`);
  console.log(`   Chapters: ${slides.filter(s => s.type === 'chapter-intro').length}`);
  console.log(`   Narration segments: ${narration.length}`);

  // Estimate duration (avg 15s per slide)
  const estMinutes = Math.round(slides.length * 15 / 60);
  console.log(`   Estimated duration: ~${estMinutes} min (${Math.round(estMinutes/60*10)/10}h)`);
  console.log(`\n📝 Output files:`);
  console.log(`   public/edu-data.json (${Math.round(JSON.stringify(eduData).length / 1024)}KB)`);
  console.log(`   public/edu-narration.json (${Math.round(JSON.stringify(narration).length / 1024)}KB)`);
  console.log(`\n🎙️  Next: run generate-edu-tts.mjs to generate audio narration`);
}

main().catch(err => { console.error(err); process.exit(1); });
