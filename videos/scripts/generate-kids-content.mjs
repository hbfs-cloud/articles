#!/usr/bin/env node
/**
 * generate-kids-content.mjs — Generate educational video content for kids/youth
 *
 * Usage: node scripts/generate-kids-content.mjs <series-id>
 *
 * Series IDs by level:
 *   CE2:        ce2-maths, ce2-francais, ce2-sciences
 *   CM1:        cm1-maths, cm1-histoire, cm1-sciences
 *   5ème:       cinquieme-maths, cinquieme-physique, cinquieme-histoire
 *   4ème:       quatrieme-maths, quatrieme-physique, quatrieme-svt
 *   Terminale:  terminale-maths-analyse, terminale-maths-proba, terminale-physique, terminale-philo
 *   PCSI:       pcsi-analyse, pcsi-algebre, pcsi-mecanique, pcsi-thermo
 *
 * Outputs:
 *   public/edu-data.json       — slides + config (consumed by Remotion)
 *   public/edu-narration.json  — narration text segments (consumed by TTS)
 */
import fs from 'fs-extra';
import path from 'path';

const seriesId = process.argv[2];

// ── Slide helpers ────────────────────────────────────────────────────

let slideIndex = 0;
let audioPrefix = 'edu';

function makeSlide(slide) {
  const audioFile = `${audioPrefix}_s${slideIndex}.wav`;
  slideIndex++;
  return { ...slide, audioFile };
}

function chapterIntro(partNumber, title, subtitle) {
  return makeSlide({
    type: 'chapter-intro',
    chapter: { title, subtitle, partNumber },
  });
}

function bullets(title, items) {
  return makeSlide({ type: 'bullets', title, items });
}

function concept(text, title) {
  return makeSlide({ type: 'concept', text, title: title || undefined });
}

function table(title, headers, rows) {
  return makeSlide({ type: 'table', title, headers, rows });
}

function quote(text, author) {
  return makeSlide({ type: 'quote', text, author });
}

function steps(title, items) {
  return makeSlide({ type: 'steps', title, items });
}

function warning(text) {
  return makeSlide({ type: 'warning', text });
}

function tip(text) {
  return makeSlide({ type: 'tip', text });
}

function summary(title, items) {
  return makeSlide({ type: 'summary', title, items });
}

function comparison(title, leftLabel, leftItems, rightLabel, rightItems) {
  return makeSlide({
    type: 'comparison', title,
    left: { label: leftLabel, items: leftItems },
    right: { label: rightLabel, items: rightItems },
  });
}

function quiz(question, choices, correctIndex, explanation) {
  return makeSlide({ type: 'quiz', question, choices, correctIndex, explanation });
}

// ── Series definitions ───────────────────────────────────────────────

const SERIES = {
  // ═══════════════════ CE2 (8-9 ans) ═══════════════════
  'ce2-maths': {
    config: {
      seriesTitle: 'Les Maths Magiques — CE2',
      seriesSubtitle: 'Multiplication, géométrie et problèmes amusants',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#f59e0b', totalChapters: 5,
      targetAge: '8-9 ans', level: 'CE2',
    },
    generator: generateCE2Maths,
  },
  'ce2-francais': {
    config: {
      seriesTitle: 'Le Français Facile — CE2',
      seriesSubtitle: 'Grammaire, conjugaison et vocabulaire en s\'amusant',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#3b82f6', totalChapters: 5,
      targetAge: '8-9 ans', level: 'CE2',
    },
    generator: generateCE2Francais,
  },
  'ce2-sciences': {
    config: {
      seriesTitle: 'Les Sciences de la Nature — CE2',
      seriesSubtitle: 'Animaux, plantes et corps humain',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#22c55e', totalChapters: 5,
      targetAge: '8-9 ans', level: 'CE2',
    },
    generator: generateCE2Sciences,
  },

  // ═══════════════════ CM1 (9-10 ans) ═══════════════════
  'cm1-maths': {
    config: {
      seriesTitle: 'Fractions et Décimaux — CM1',
      seriesSubtitle: 'Comprendre les fractions, les décimaux et résoudre des problèmes',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#8b5cf6', totalChapters: 5,
      targetAge: '9-10 ans', level: 'CM1',
    },
    generator: generateCM1Maths,
  },
  'cm1-histoire': {
    config: {
      seriesTitle: 'L\'Histoire de France — CM1',
      seriesSubtitle: 'De la Préhistoire à la Révolution',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#ef4444', totalChapters: 5,
      targetAge: '9-10 ans', level: 'CM1',
    },
    generator: generateCM1Histoire,
  },
  'cm1-sciences': {
    config: {
      seriesTitle: 'Sciences Expérimentales — CM1',
      seriesSubtitle: 'L\'eau, l\'air, l\'électricité et les matériaux',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#06b6d4', totalChapters: 5,
      targetAge: '9-10 ans', level: 'CM1',
    },
    generator: generateCM1Sciences,
  },

  // ═══════════════════ 5ème (12-13 ans) ═══════════════════
  'cinquieme-maths': {
    config: {
      seriesTitle: 'Algèbre & Géométrie — 5ème',
      seriesSubtitle: 'Nombres relatifs, fractions, symétries et angles',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#3b82f6', totalChapters: 6,
      targetAge: '12-13 ans', level: '5ème',
    },
    generator: generateCinquiemeMaths,
  },
  'cinquieme-physique': {
    config: {
      seriesTitle: 'Physique-Chimie — 5ème',
      seriesSubtitle: 'L\'eau, les circuits électriques et les mélanges',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#f59e0b', totalChapters: 5,
      targetAge: '12-13 ans', level: '5ème',
    },
    generator: generateCinquiemePhysique,
  },
  'cinquieme-histoire': {
    config: {
      seriesTitle: 'Histoire-Géographie — 5ème',
      seriesSubtitle: 'Le Moyen Âge, l\'Islam et les Grandes Découvertes',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#ef4444', totalChapters: 5,
      targetAge: '12-13 ans', level: '5ème',
    },
    generator: generateCinquiemeHistoire,
  },

  // ═══════════════════ 4ème (13-14 ans) ═══════════════════
  'quatrieme-maths': {
    config: {
      seriesTitle: 'Équations & Fonctions — 4ème',
      seriesSubtitle: 'Résolution d\'équations, Pythagore et Thalès',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#8b5cf6', totalChapters: 6,
      targetAge: '13-14 ans', level: '4ème',
    },
    generator: generateQuatriemeMaths,
  },
  'quatrieme-physique': {
    config: {
      seriesTitle: 'Physique-Chimie — 4ème',
      seriesSubtitle: 'Atomes, molécules, courant électrique et optique',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#22c55e', totalChapters: 5,
      targetAge: '13-14 ans', level: '4ème',
    },
    generator: generateQuatriemePhysique,
  },
  'quatrieme-svt': {
    config: {
      seriesTitle: 'SVT — 4ème',
      seriesSubtitle: 'Reproduction, génétique et géologie',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#06b6d4', totalChapters: 5,
      targetAge: '13-14 ans', level: '4ème',
    },
    generator: generateQuatriemeSVT,
  },

  // ═══════════════════ Terminale (17-18 ans) ═══════════════════
  'terminale-maths-analyse': {
    config: {
      seriesTitle: 'Analyse Mathématique — Terminale',
      seriesSubtitle: 'Limites, dérivées, intégrales et suites',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#3b82f6', totalChapters: 6,
      targetAge: '17-18 ans', level: 'Terminale',
    },
    generator: generateTerminaleMathsAnalyse,
  },
  'terminale-maths-proba': {
    config: {
      seriesTitle: 'Probabilités & Statistiques — Terminale',
      seriesSubtitle: 'Lois de probabilité, variables aléatoires et estimation',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#22c55e', totalChapters: 5,
      targetAge: '17-18 ans', level: 'Terminale',
    },
    generator: generateTerminaleMathsProba,
  },
  'terminale-physique': {
    config: {
      seriesTitle: 'Physique — Terminale',
      seriesSubtitle: 'Mécanique, ondes, optique et physique quantique',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#f59e0b', totalChapters: 6,
      targetAge: '17-18 ans', level: 'Terminale',
    },
    generator: generateTerminalePhysique,
  },
  'terminale-philo': {
    config: {
      seriesTitle: 'Philosophie — Terminale',
      seriesSubtitle: 'Les grands thèmes du programme : liberté, vérité, justice, art',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#8b5cf6', totalChapters: 6,
      targetAge: '17-18 ans', level: 'Terminale',
    },
    generator: generateTerminalePhilo,
  },

  // ═══════════════════ PCSI (18-19 ans) ═══════════════════
  'pcsi-analyse': {
    config: {
      seriesTitle: 'Analyse Réelle — PCSI',
      seriesSubtitle: 'Suites, séries, fonctions et intégrales',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#3b82f6', totalChapters: 8,
      targetAge: '18-19 ans', level: 'PCSI',
    },
    generator: generatePCSIAnalyse,
  },
  'pcsi-algebre': {
    config: {
      seriesTitle: 'Algèbre Linéaire — PCSI',
      seriesSubtitle: 'Espaces vectoriels, applications linéaires et matrices',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#8b5cf6', totalChapters: 8,
      targetAge: '18-19 ans', level: 'PCSI',
    },
    generator: generatePCSIAlgebre,
  },
  'pcsi-mecanique': {
    config: {
      seriesTitle: 'Mécanique du Point — PCSI',
      seriesSubtitle: 'Cinématique, dynamique, énergie et oscillations',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#ef4444', totalChapters: 7,
      targetAge: '18-19 ans', level: 'PCSI',
    },
    generator: generatePCSIMecanique,
  },
  'pcsi-thermo': {
    config: {
      seriesTitle: 'Thermodynamique — PCSI',
      seriesSubtitle: 'Premier et second principes, machines thermiques',
      date: 'Mars 2026', language: 'fr',
      accentColor: '#f59e0b', totalChapters: 6,
      targetAge: '18-19 ans', level: 'PCSI',
    },
    generator: generatePCSIThermo,
  },
};

// ── YouTube metadata for kids series ─────────────────────────────────

const YOUTUBE_META = {};
for (const [id, series] of Object.entries(SERIES)) {
  const c = series.config;
  const levelTag = c.level.toLowerCase().replace(/[èê]/g, 'e');
  YOUTUBE_META[id] = {
    title: `${c.seriesTitle}`,
    playlist: `${c.level} — Cours Complets`,
    description: `📚 ${c.seriesTitle}\n${c.seriesSubtitle}\n\n🎯 Niveau : ${c.level} (${c.targetAge})\n📝 Plein de quizzes pour tester tes connaissances !\n\n🌐 dailytickers.com`,
    tags: [c.level, levelTag, 'cours', 'éducation', 'français', 'quiz', 'révision', 'dailytickers.com'],
    lang: 'fr',
  };
}

// ══════════════════════════════════════════════════════════════════════
// CONTENT GENERATORS
// ══════════════════════════════════════════════════════════════════════

// ── CE2 MATHS ─────────────────────────────────────────────────────────

function generateCE2Maths() {
  slideIndex = 0;
  const slides = [];

  // Chapitre 1: La Multiplication
  slides.push(chapterIntro(1, 'La Multiplication', 'Deviens un champion du calcul !'));
  slides.push(concept('La multiplication, c\'est un raccourci pour l\'addition ! Au lieu de faire 3 + 3 + 3 + 3 + 3, tu peux écrire 3 × 5 = 15. C\'est beaucoup plus rapide !', 'C\'est quoi la multiplication ?'));
  slides.push(concept('Imagine que tu as 4 sacs de billes, et chaque sac contient 6 billes. Combien de billes as-tu en tout ? 4 × 6 = 24 billes ! La multiplication, c\'est compter des groupes identiques.'));
  slides.push(table('Les tables de multiplication essentielles', ['×', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], [
    ['2', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20'],
    ['3', '3', '6', '9', '12', '15', '18', '21', '24', '27', '30'],
    ['5', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50'],
  ]));
  slides.push(tip('Pour la table de 9, regarde tes mains ! Baisse le doigt correspondant au nombre. Les doigts à gauche = dizaines, à droite = unités. Exemple : 9 × 3 = baisse le 3ème doigt. 2 à gauche, 7 à droite = 27 !'));
  slides.push(quiz('Combien font 7 × 8 ?', ['54', '56', '58', '48'], 1, 'La réponse est 56 ! Un truc : 5, 6, 7, 8 → 56 = 7 × 8'));
  slides.push(concept('La commutativité, c\'est un mot compliqué pour dire que l\'ordre n\'a pas d\'importance ! 3 × 5 donne le même résultat que 5 × 3. C\'est magique et ça divise par deux le nombre de tables à apprendre !'));
  slides.push(quiz('Vrai ou faux : 4 × 7 est égal à 7 × 4 ?', ['Vrai', 'Faux', 'Ça dépend', 'Seulement avec les petits nombres'], 0, 'C\'est vrai ! La multiplication est commutative, ça marche toujours !'));

  // Chapitre 2: La Géométrie
  slides.push(chapterIntro(2, 'Les Formes Géométriques', 'Triangles, carrés et cercles n\'auront plus de secrets'));
  slides.push(bullets('Les formes de base', [
    'Le carré : 4 côtés égaux, 4 angles droits',
    'Le rectangle : côtés opposés égaux, 4 angles droits',
    'Le triangle : 3 côtés, 3 sommets',
    'Le cercle : tous les points sont à la même distance du centre',
  ]));
  slides.push(concept('Un angle droit, c\'est comme le coin d\'une feuille de papier ou d\'un livre. On le marque avec un petit carré. Quand tu vois un angle droit dans une figure, c\'est 90 degrés.', 'L\'angle droit'));
  slides.push(concept('Le périmètre, c\'est la longueur du tour d\'une figure. Imagine une fourmi qui marche tout autour d\'un carré de 5 cm de côté. Elle parcourt 5 + 5 + 5 + 5 = 20 cm. Le périmètre du carré est 4 × le côté.', 'Le périmètre'));
  slides.push(quiz('Quel est le périmètre d\'un rectangle de 6 cm de long et 3 cm de large ?', ['9 cm', '12 cm', '18 cm', '36 cm'], 2, 'Le périmètre = 2 × (longueur + largeur) = 2 × (6 + 3) = 2 × 9 = 18 cm'));
  slides.push(concept('La symétrie, c\'est comme un miroir ! Une figure est symétrique si on peut la plier en deux et que les deux moitiés se superposent parfaitement. Le papillon est un bel exemple de symétrie dans la nature.', 'La symétrie'));
  slides.push(quiz('Combien d\'axes de symétrie a un carré ?', ['1', '2', '4', '8'], 2, 'Un carré a 4 axes de symétrie : 2 diagonales et 2 médianes !'));

  // Chapitre 3: Les Problèmes
  slides.push(chapterIntro(3, 'Résoudre des Problèmes', 'La méthode pas à pas pour ne jamais se tromper'));
  slides.push(steps('La méthode en 4 étapes', [
    'Étape 1 : Lis le problème deux fois et identifie la question',
    'Étape 2 : Repère les données utiles (les nombres importants)',
    'Étape 3 : Choisis l\'opération (addition, soustraction, multiplication)',
    'Étape 4 : Calcule et vérifie que ta réponse a du sens',
  ]));
  slides.push(concept('Léa achète 3 cahiers à 2 euros chacun et un stylo à 1 euro. Combien dépense-t-elle ? Les mots clés sont "3 cahiers à 2 euros chacun" → multiplication : 3 × 2 = 6 euros. Plus le stylo : 6 + 1 = 7 euros.', 'Exemple de problème'));
  slides.push(quiz('Tom a 24 images. Il veut les répartir également dans 4 albums. Combien d\'images met-il dans chaque album ?', ['4', '6', '8', '28'], 1, '24 ÷ 4 = 6. Tom met 6 images dans chaque album.'));
  slides.push(tip('Les mots clés dans les problèmes : "en tout" et "combien au total" → addition. "De plus que" ou "de moins que" → soustraction. "Chacun", "par" → multiplication ou division.'));
  slides.push(quiz('Marie a 15 bonbons. Elle en donne 3 à chacun de ses amis. À combien d\'amis peut-elle en donner ?', ['3', '5', '12', '45'], 1, '15 ÷ 3 = 5. Marie peut donner des bonbons à 5 amis.'));

  // Chapitre 4: Les Mesures
  slides.push(chapterIntro(4, 'Les Mesures', 'Centimètres, mètres, kilogrammes et litres'));
  slides.push(bullets('Les unités de longueur', [
    '1 km = 1 000 m (la distance entre deux villages)',
    '1 m = 100 cm (à peu près ta taille !)',
    '1 cm = 10 mm (la largeur d\'un ongle)',
    'Pour convertir : on multiplie ou divise par 10, 100 ou 1 000',
  ]));
  slides.push(concept('Pour mesurer le temps : 1 heure = 60 minutes, 1 minute = 60 secondes. Si le cours commence à 8h30 et dure 45 minutes, il finit à 9h15. Comment on calcule ? 30 minutes + 45 minutes = 75 minutes = 1 heure et 15 minutes. Donc 8h + 1h15 = 9h15.', 'Le temps'));
  slides.push(quiz('Combien de centimètres font 2 mètres et 35 centimètres ?', ['235 cm', '2 035 cm', '23,5 cm', '2 350 cm'], 0, '2 m = 200 cm. Donc 2 m 35 cm = 200 + 35 = 235 cm.'));
  slides.push(comparison('Masse vs Volume', 'Masse (en grammes/kg)', ['Le poids d\'un objet', '1 kg = 1 000 g', 'On utilise une balance'], 'Volume (en litres)', ['La place qu\'occupe un liquide', '1 L = 100 cL', 'On utilise un verre mesureur']));
  slides.push(quiz('Combien de grammes pèse un objet de 2 kg et 500 g ?', ['250 g', '2 500 g', '25 000 g', '500 g'], 1, '2 kg = 2 000 g. Donc 2 kg 500 g = 2 000 + 500 = 2 500 g.'));

  // Chapitre 5: Récap et Super Quiz
  slides.push(chapterIntro(5, 'Super Quiz Final', 'Montre ce que tu as appris !'));
  slides.push(summary('Ce qu\'on a appris', [
    'La multiplication est un raccourci pour l\'addition',
    'Les formes géométriques ont des propriétés spéciales',
    'Pour résoudre un problème, on suit 4 étapes',
    'Les mesures se convertissent en multipliant ou divisant par 10, 100, 1 000',
  ]));
  slides.push(quiz('Quel est l\'aire d\'un rectangle de 5 cm de long et 3 cm de large ?', ['8 cm²', '15 cm²', '16 cm²', '30 cm²'], 1, 'L\'aire = longueur × largeur = 5 × 3 = 15 cm²'));
  slides.push(quiz('Un train roule à 120 km par heure. Quelle distance parcourt-il en 2 heures ?', ['60 km', '122 km', '240 km', '360 km'], 2, 'Distance = vitesse × temps = 120 × 2 = 240 km'));
  slides.push(quiz('Quel nombre est le double de 45 ?', ['22', '50', '90', '135'], 2, 'Le double de 45 = 45 × 2 = 90'));
  slides.push(concept('Bravo, tu as terminé le cours de maths CE2 ! Continue à t\'entraîner avec les tables de multiplication et les problèmes. Plus tu pratiques, plus tu deviens fort en maths. À la prochaine !', 'Félicitations !'));

  return slides;
}

// ── CE2 FRANÇAIS ──────────────────────────────────────────────────────

function generateCE2Francais() {
  slideIndex = 0;
  const slides = [];

  slides.push(chapterIntro(1, 'Les Noms et les Déterminants', 'Le, la, les, un, une, des…'));
  slides.push(concept('Le nom, c\'est le mot qui désigne une personne, un animal, une chose ou une idée. Exemples : chat, école, joie, Paris. Il y a deux sortes : les noms communs (chat, maison) et les noms propres (Paris, Marie) qui prennent une majuscule.', 'C\'est quoi un nom ?'));
  slides.push(concept('Le déterminant, c\'est le petit mot qui se place devant le nom. Il nous dit si le nom est masculin ou féminin, singulier ou pluriel. "Le" chat, "une" école, "des" amis, "mon" vélo.'));
  slides.push(table('Les déterminants', ['Type', 'Masculin singulier', 'Féminin singulier', 'Pluriel'], [
    ['Défini', 'le', 'la', 'les'],
    ['Indéfini', 'un', 'une', 'des'],
    ['Possessif', 'mon, ton, son', 'ma, ta, sa', 'mes, tes, ses'],
  ]));
  slides.push(quiz('Quel est le déterminant dans "Les enfants jouent" ?', ['enfants', 'Les', 'jouent', 'dans'], 1, '"Les" est le déterminant du nom "enfants". Il est défini et pluriel.'));
  slides.push(quiz('Quel mot est un nom propre ?', ['maison', 'chat', 'France', 'voiture'], 2, 'France est un nom propre — il prend une majuscule et désigne un pays unique.'));

  slides.push(chapterIntro(2, 'La Conjugaison au Présent', 'Je, tu, il, nous, vous, ils'));
  slides.push(concept('Conjuguer un verbe, c\'est le changer selon la personne (je, tu, il…) et le temps (présent, passé, futur). Au présent, on parle de ce qui se passe maintenant. "Je mange", "Tu joues", "Il court".'));
  slides.push(bullets('Les terminaisons du 1er groupe (verbes en -er)', [
    'Je chante → -e',
    'Tu chantes → -es',
    'Il/Elle chante → -e',
    'Nous chantons → -ons',
    'Vous chantez → -ez',
    'Ils/Elles chantent → -ent',
  ]));
  slides.push(tip('Les verbes du 1er groupe (en -er) sont les plus faciles ! C\'est le même modèle pour jouer, manger, danser, parler, regarder… Il y en a des milliers !'));
  slides.push(quiz('Comment conjugue-t-on "manger" avec "nous" ?', ['Nous mange', 'Nous manges', 'Nous mangeons', 'Nous mangent'], 2, 'Nous mangeons ! Attention, on ajoute un "e" pour garder le son "j" devant "ons".'));
  slides.push(concept('Les verbes être et avoir sont spéciaux. Être : je suis, tu es, il est, nous sommes, vous êtes, ils sont. Avoir : j\'ai, tu as, il a, nous avons, vous avez, ils ont. Ce sont les plus utilisés du français !'));
  slides.push(quiz('Quelle est la bonne conjugaison ? "Tu … gentil."', ['es', 'est', 'ai', 'as'], 0, '"Tu es gentil." — Le verbe être avec "tu" donne "es".'));

  slides.push(chapterIntro(3, 'Les Adjectifs', 'Les mots qui décrivent'));
  slides.push(concept('L\'adjectif, c\'est le mot qui décrit le nom. Il dit comment est la personne, l\'animal ou la chose. "Le grand chien", "une jolie fleur", "des livres intéressants". L\'adjectif s\'accorde avec le nom en genre et en nombre.'));
  slides.push(comparison('Accord de l\'adjectif', 'Masculin', ['Un petit chat', 'Un chat noir', 'Des chats noirs'], 'Féminin', ['Une petite chatte', 'Une chatte noire', 'Des chattes noires']));
  slides.push(quiz('Trouve l\'adjectif : "La grande maison bleue"', ['La', 'maison', 'grande et bleue', 'grande seulement'], 2, '"Grande" et "bleue" sont tous les deux des adjectifs qui décrivent la maison.'));

  slides.push(chapterIntro(4, 'L\'Orthographe', 'Les pièges à éviter'));
  slides.push(bullets('Les sons qui trompent', [
    'Le son [s] peut s\'écrire : s, ss, c, ç, t (nation)',
    'Le son [k] peut s\'écrire : c, k, qu (coq, kilo, quatre)',
    'Le son [ɛ̃] peut s\'écrire : in, im, ain, ein (lapin, important, pain, plein)',
    'Le son [o] peut s\'écrire : o, au, eau (moto, auto, bateau)',
  ]));
  slides.push(tip('Pour ne pas confondre "et" et "est" : remplace par "et puis" ou par "était". "Le chat est noir" → "Le chat était noir" ✓. "Le chat et le chien" → "Le chat et puis le chien" ✓.'));
  slides.push(quiz('Choisis la bonne orthographe : "Le garçon … content."', ['et', 'est', 'ai', 'es'], 1, '"Le garçon est content." — C\'est le verbe être (il est). On peut dire "Le garçon était content."'));
  slides.push(quiz('Comment écrit-on le pluriel de "cheval" ?', ['chevals', 'chevaux', 'chevalx', 'chevaus'], 1, 'Cheval → chevaux ! C\'est un pluriel irrégulier en -aux. Comme journal → journaux.'));

  slides.push(chapterIntro(5, 'Super Quiz Français', 'Teste toutes tes connaissances !'));
  slides.push(quiz('Dans "Mon petit frère mange une pomme", combien y a-t-il de noms ?', ['1', '2', '3', '4'], 2, 'Il y a 3 noms : frère, pomme. Et "Mon" n\'est pas un nom, c\'est un déterminant possessif ! Attends… en fait il y a bien 2 noms : frère et pomme.'));
  slides.push(quiz('Conjugue "finir" avec "ils" au présent.', ['Ils finis', 'Ils finit', 'Ils finissent', 'Ils finissont'], 2, '"Ils finissent" — Les verbes du 2ème groupe en -ir font -issent avec "ils".'));
  slides.push(quiz('Quel est le féminin de "heureux" ?', ['heureuse', 'heureuxe', 'heureusse', 'heureue'], 0, 'Heureux → heureuse. Le "x" se transforme en "se" au féminin.'));
  slides.push(concept('Bravo, tu as terminé le cours de français CE2 ! Tu connais maintenant les noms, les déterminants, la conjugaison au présent, les adjectifs et plein d\'astuces d\'orthographe. Continue à lire des livres pour progresser encore !', 'Félicitations !'));

  return slides;
}

// ── CE2 SCIENCES ──────────────────────────────────────────────────────

function generateCE2Sciences() {
  slideIndex = 0;
  const slides = [];

  slides.push(chapterIntro(1, 'Les Animaux', 'Classification et modes de vie'));
  slides.push(concept('Les scientifiques classent les animaux en grands groupes. Les mammifères allaitent leurs petits (chat, chien, baleine). Les oiseaux ont des plumes et pondent des œufs. Les reptiles ont des écailles (serpent, crocodile). Les poissons vivent dans l\'eau et respirent avec des branchies. Les insectes ont 6 pattes.'));
  slides.push(table('Les groupes d\'animaux', ['Groupe', 'Caractéristique', 'Exemples'], [
    ['Mammifères', 'Poils, allaitent', 'Chat, baleine, humain'],
    ['Oiseaux', 'Plumes, bec', 'Aigle, pingouin, moineau'],
    ['Reptiles', 'Écailles, sang froid', 'Serpent, tortue, lézard'],
    ['Poissons', 'Écailles, branchies', 'Saumon, requin, thon'],
    ['Insectes', '6 pattes, antennes', 'Fourmi, papillon, abeille'],
  ]));
  slides.push(quiz('Quel animal est un mammifère ?', ['Le crocodile', 'L\'aigle', 'La baleine', 'Le saumon'], 2, 'La baleine est un mammifère ! Elle allaite ses petits et respire de l\'air, même si elle vit dans l\'eau.'));
  slides.push(concept('La chaîne alimentaire, c\'est "qui mange qui". L\'herbe est mangée par le lapin, qui est mangé par le renard, qui est mangé par l\'aigle. Chaque maillon est important ! Si on enlève un maillon, toute la chaîne est perturbée.', 'La chaîne alimentaire'));
  slides.push(quiz('Dans la chaîne : herbe → sauterelle → grenouille → serpent, qui est le prédateur de la grenouille ?', ['L\'herbe', 'La sauterelle', 'Le serpent', 'La grenouille elle-même'], 2, 'Le serpent mange la grenouille. La grenouille est la proie du serpent.'));

  slides.push(chapterIntro(2, 'Les Plantes', 'Comment poussent-elles ?'));
  slides.push(concept('Une graine a besoin de trois choses pour germer : de l\'eau, de la chaleur et de l\'air. Elle n\'a pas besoin de lumière pour germer ! Mais ensuite, la plante aura besoin de lumière pour grandir et faire de la photosynthèse.'));
  slides.push(steps('Les étapes de la vie d\'une plante', [
    'La graine germe dans la terre (germination)',
    'Une petite tige sort et monte vers la lumière',
    'Les feuilles poussent et font la photosynthèse',
    'La plante fait des fleurs',
    'Les fleurs deviennent des fruits avec des graines dedans',
    'Les graines tombent et le cycle recommence !',
  ]));
  slides.push(quiz('De quoi la graine a-t-elle besoin pour germer ?', ['Lumière et eau', 'Eau, chaleur et air', 'Seulement de la terre', 'De l\'engrais'], 1, 'La graine a besoin d\'eau, de chaleur et d\'air pour germer. La lumière n\'est pas nécessaire à ce stade !'));
  slides.push(concept('La photosynthèse, c\'est la magie des plantes ! Avec la lumière du soleil, l\'eau et le gaz carbonique de l\'air, les feuilles fabriquent du sucre pour nourrir la plante et rejettent de l\'oxygène. C\'est grâce aux plantes qu\'on peut respirer !', 'La photosynthèse'));

  slides.push(chapterIntro(3, 'Le Corps Humain', 'Comment fonctionne ton corps'));
  slides.push(bullets('Les 5 sens', [
    'La vue : les yeux captent la lumière',
    'L\'ouïe : les oreilles captent les sons',
    'L\'odorat : le nez capte les odeurs',
    'Le goût : la langue capte les saveurs (sucré, salé, acide, amer)',
    'Le toucher : la peau capte les sensations (chaud, froid, doux, rugueux)',
  ]));
  slides.push(concept('Le squelette est la charpente de ton corps. Il est fait de 206 os ! Le plus grand est le fémur (dans la cuisse) et le plus petit est l\'étrier (dans l\'oreille, 3 mm). Les os protègent tes organes : le crâne protège le cerveau, les côtes protègent le cœur et les poumons.', 'Le squelette'));
  slides.push(quiz('Combien d\'os a le corps humain adulte ?', ['106', '206', '306', '406'], 1, 'Le corps humain adulte a 206 os. Les bébés en ont environ 300 qui fusionnent en grandissant !'));
  slides.push(concept('La digestion, c\'est le voyage de la nourriture dans ton corps. La bouche mâche et mélange avec la salive. L\'estomac broie pendant 2 à 4 heures. L\'intestin grêle absorbe les nutriments. Le gros intestin récupère l\'eau. Le voyage dure environ 24 heures !', 'La digestion'));
  slides.push(quiz('Quel organe broie la nourriture après la bouche ?', ['Le cœur', 'L\'estomac', 'Le cerveau', 'Les poumons'], 1, 'L\'estomac broie et mélange la nourriture avec des sucs gastriques pendant 2 à 4 heures.'));

  slides.push(chapterIntro(4, 'L\'Eau et la Matière', 'Les trois états de l\'eau'));
  slides.push(concept('L\'eau existe sous 3 formes : liquide (dans le robinet), solide (la glace) et gaz (la vapeur). Quand on chauffe l\'eau, elle s\'évapore à 100 degrés. Quand on la refroidit, elle gèle à 0 degré. C\'est toujours la même eau, elle change juste de forme !', 'Les 3 états de l\'eau'));
  slides.push(comparison('Solide vs Liquide vs Gaz', 'Solide (glace)', ['Forme fixe', 'On peut le tenir', 'Volume fixe'], 'Liquide (eau)', ['Prend la forme du récipient', 'Coule', 'Volume fixe']));
  slides.push(quiz('À quelle température l\'eau gèle-t-elle ?', ['10°C', '0°C', '-10°C', '100°C'], 1, 'L\'eau gèle à 0°C. En dessous, elle devient de la glace. Au-dessus, elle reste liquide.'));

  slides.push(chapterIntro(5, 'Super Quiz Sciences', 'Teste tes connaissances !'));
  slides.push(quiz('Quel gaz les plantes rejettent-elles grâce à la photosynthèse ?', ['Le gaz carbonique', 'L\'oxygène', 'L\'azote', 'L\'hélium'], 1, 'Les plantes rejettent de l\'oxygène ! C\'est grâce à elles que les animaux et les humains peuvent respirer.'));
  slides.push(quiz('La baleine est…', ['Un poisson', 'Un reptile', 'Un mammifère', 'Un oiseau'], 2, 'La baleine est un mammifère ! Elle allaite ses petits et respire de l\'air à la surface.'));
  slides.push(quiz('Quel est le plus grand os du corps humain ?', ['L\'humérus', 'Le tibia', 'Le fémur', 'Le crâne'], 2, 'Le fémur, l\'os de la cuisse, est le plus grand et le plus solide os du corps humain !'));
  slides.push(concept('Bravo, tu es un vrai petit scientifique ! Tu connais les animaux, les plantes, le corps humain et les états de l\'eau. Continue à observer la nature autour de toi, c\'est le meilleur laboratoire du monde !', 'Félicitations !'));

  return slides;
}

// ── CM1 MATHS ─────────────────────────────────────────────────────────

function generateCM1Maths() {
  slideIndex = 0;
  const slides = [];

  slides.push(chapterIntro(1, 'Les Fractions', 'Couper en parts égales'));
  slides.push(concept('Une fraction, c\'est une part d\'un tout. Quand tu coupes une pizza en 4 parts égales et que tu en prends 1, tu as pris 1/4 de la pizza. Le nombre du haut s\'appelle le numérateur (combien de parts tu prends) et le nombre du bas s\'appelle le dénominateur (en combien de parts tu as coupé).'));
  slides.push(concept('Des fractions peuvent être égales ! 1/2 = 2/4 = 3/6 = 4/8. C\'est comme couper une pizza en 2 et en prendre 1 part, ou la couper en 4 et en prendre 2 parts. Tu manges la même quantité !'));
  slides.push(quiz('Quelle fraction est égale à 1/2 ?', ['2/3', '3/6', '2/5', '1/3'], 1, '3/6 = 1/2 car 3 est la moitié de 6. On peut simplifier en divisant haut et bas par 3.'));
  slides.push(concept('Pour additionner des fractions avec le même dénominateur, on additionne les numérateurs. 2/5 + 1/5 = 3/5. C\'est comme avoir 2 parts sur 5, puis en ajouter 1. On a maintenant 3 parts sur 5.'));
  slides.push(quiz('Combien font 3/8 + 2/8 ?', ['5/16', '5/8', '6/8', '1/8'], 1, '3/8 + 2/8 = 5/8. On additionne les numérateurs (3 + 2 = 5) et on garde le dénominateur (8).'));

  slides.push(chapterIntro(2, 'Les Nombres Décimaux', 'Les virgules en maths'));
  slides.push(concept('Un nombre décimal, c\'est un nombre avec une virgule. 3,5 signifie 3 unités et 5 dixièmes. C\'est entre 3 et 4. On utilise les décimaux tous les jours : le prix d\'un bonbon à 0,50 euros, la température à 37,2 degrés, ta taille en mètres.'));
  slides.push(table('Position des chiffres', ['Centaines', 'Dizaines', 'Unités', ',', 'Dixièmes', 'Centièmes'], [
    ['', '1', '5', ',', '7', '3'],
  ]));
  slides.push(concept('15,73 se lit "quinze virgule soixante-treize" ou "quinze unités et soixante-treize centièmes". Le 7 vaut 7 dixièmes et le 3 vaut 3 centièmes.'));
  slides.push(quiz('Quel nombre est le plus grand : 3,8 ou 3,12 ?', ['3,12 car 12 > 8', '3,8 car 8 dixièmes > 1 dixième', 'Ils sont égaux', 'On ne peut pas comparer'], 1, '3,8 = 3,80 en ajoutant un zéro. 3,80 > 3,12. Le chiffre des dixièmes est le plus important : 8 > 1.'));

  slides.push(chapterIntro(3, 'La Division', 'Partager équitablement'));
  slides.push(concept('La division, c\'est partager en parts égales. 20 ÷ 4 = 5 signifie "si on partage 20 en 4 groupes, chaque groupe aura 5". C\'est l\'opération inverse de la multiplication : 4 × 5 = 20.'));
  slides.push(steps('La division posée', [
    'On prend les premiers chiffres du dividende',
    'On cherche combien de fois le diviseur "rentre" dedans',
    'On écrit le résultat au quotient',
    'On calcule le reste',
    'On descend le chiffre suivant',
    'On recommence jusqu\'à la fin !',
  ]));
  slides.push(quiz('Combien font 156 ÷ 12 ?', ['12', '13', '14', '15'], 1, '156 ÷ 12 = 13. On peut vérifier : 12 × 13 = 156 ✓'));
  slides.push(quiz('Quel est le reste de 25 ÷ 4 ?', ['0', '1', '2', '3'], 1, '25 ÷ 4 = 6 reste 1. Car 4 × 6 = 24, et 25 - 24 = 1.'));

  slides.push(chapterIntro(4, 'Aires et Périmètres', 'Mesurer les surfaces'));
  slides.push(concept('Le périmètre mesure le tour d\'une figure. L\'aire mesure la surface à l\'intérieur. Imagine que tu veux mettre une clôture autour d\'un jardin (périmètre) et de la pelouse dedans (aire). Ce sont deux choses différentes !'));
  slides.push(bullets('Les formules à connaître', [
    'Périmètre du carré = 4 × côté',
    'Aire du carré = côté × côté',
    'Périmètre du rectangle = 2 × (longueur + largeur)',
    'Aire du rectangle = longueur × largeur',
  ]));
  slides.push(quiz('Un carré a un côté de 7 cm. Quelle est son aire ?', ['14 cm²', '28 cm²', '49 cm²', '56 cm²'], 2, 'Aire du carré = 7 × 7 = 49 cm². N\'oublie pas l\'unité : cm² !'));

  slides.push(chapterIntro(5, 'Quiz Final CM1', 'Le défi mathématique !'));
  slides.push(quiz('Combien font 3/4 + 1/4 ?', ['4/8', '1', '4/4', 'Les deux réponses B et C'], 3, '3/4 + 1/4 = 4/4 = 1. Quand le numérateur égale le dénominateur, la fraction vaut 1 !'));
  slides.push(quiz('Range du plus petit au plus grand : 2,5 — 2,15 — 2,51', ['2,5 < 2,15 < 2,51', '2,15 < 2,5 < 2,51', '2,15 < 2,51 < 2,5', '2,51 < 2,5 < 2,15'], 1, '2,15 < 2,5 (= 2,50) < 2,51. On compare d\'abord les dixièmes, puis les centièmes.'));
  slides.push(concept('Super travail ! Tu maîtrises maintenant les fractions, les décimaux, la division et les aires. Ces bases te serviront tout au long de ta scolarité. N\'hésite pas à revoir les parties que tu trouves difficiles !', 'Bravo !'));

  return slides;
}

// ── Stub generators for remaining series ──────────────────────────────
// These will be filled with full content. For now, generate placeholder slides.

function generateStubSeries(title, chapters, topicFn) {
  slideIndex = 0;
  const slides = [];
  for (let ch = 1; ch <= chapters; ch++) {
    const topic = topicFn(ch);
    slides.push(chapterIntro(ch, topic.title, topic.subtitle));
    for (const slide of topic.slides) {
      slides.push(slide);
    }
    // Quiz every chapter
    if (topic.quiz) {
      slides.push(quiz(topic.quiz.q, topic.quiz.choices, topic.quiz.answer, topic.quiz.explanation));
    }
  }
  return slides;
}

function generateCM1Histoire() {
  slideIndex = 0;
  const slides = [];

  slides.push(chapterIntro(1, 'La Préhistoire', 'Des premiers humains à l\'invention de l\'écriture'));
  slides.push(concept('La Préhistoire commence avec les premiers humains, il y a environ 3 millions d\'années, et se termine avec l\'invention de l\'écriture, il y a environ 5 000 ans. C\'est la plus longue période de l\'histoire de l\'humanité !'));
  slides.push(concept('Les hommes préhistoriques étaient des chasseurs-cueilleurs. Ils se déplaçaient pour suivre le gibier et trouver des fruits. Ils vivaient en petits groupes et fabriquaient des outils en pierre taillée. C\'est pourquoi on appelle cette période l\'Âge de Pierre.'));
  slides.push(concept('Il y a environ 10 000 ans, une révolution s\'est produite : l\'invention de l\'agriculture ! Au lieu de chercher leur nourriture, les humains ont commencé à cultiver des plantes et élever des animaux. Ils se sont installés dans des villages. C\'est le début de la sédentarisation.'));
  slides.push(quiz('Que signifie "sédentarisation" ?', ['Voyager beaucoup', 'S\'installer dans un lieu fixe', 'Construire des pyramides', 'Domestiquer des chiens'], 1, 'La sédentarisation, c\'est quand les humains arrêtent de se déplacer et s\'installent dans un lieu fixe, souvent grâce à l\'agriculture.'));
  slides.push(bullets('Les grandes inventions de la Préhistoire', ['Le feu (il y a 400 000 ans)', 'Les outils en pierre', 'L\'art rupestre (peintures dans les grottes)', 'L\'agriculture et l\'élevage', 'La poterie et le tissage']));
  slides.push(quiz('Quel site préhistorique français est célèbre pour ses peintures rupestres ?', ['Versailles', 'La grotte de Lascaux', 'Le Mont-Saint-Michel', 'Carcassonne'], 1, 'La grotte de Lascaux, en Dordogne, contient des peintures vieilles de 17 000 ans représentant des animaux.'));

  slides.push(chapterIntro(2, 'L\'Antiquité', 'Gaulois, Romains et civilisations'));
  slides.push(concept('L\'Antiquité commence avec l\'invention de l\'écriture, vers 3 300 avant J.-C. Les Égyptiens ont inventé les hiéroglyphes, les Mésopotamiens l\'écriture cunéiforme. En France, les Gaulois vivaient dans des tribus et étaient d\'excellents artisans et guerriers.'));
  slides.push(concept('En 52 avant J.-C., Jules César a conquis la Gaule après la bataille d\'Alésia contre Vercingétorix. La Gaule est devenue romaine. Les Romains ont apporté les routes, les aqueducs, les arènes et le latin, qui est devenu le français !'));
  slides.push(quiz('Qui était le chef gaulois qui a combattu Jules César ?', ['Astérix', 'Vercingétorix', 'Charlemagne', 'Clovis'], 1, 'Vercingétorix a résisté aux Romains mais a finalement été vaincu à la bataille d\'Alésia en 52 avant J.-C.'));

  slides.push(chapterIntro(3, 'Le Moyen Âge', 'Châteaux forts et chevaliers'));
  slides.push(concept('Le Moyen Âge dure presque 1 000 ans, de la chute de l\'Empire Romain en 476 jusqu\'à la découverte de l\'Amérique en 1492. C\'est l\'époque des châteaux forts, des chevaliers, des rois et des cathédrales.'));
  slides.push(concept('En 800, Charlemagne est couronné empereur. Il crée des écoles dans tout son empire et développe l\'enseignement. C\'est pourquoi on dit parfois "Charlemagne a inventé l\'école", même si c\'est un peu exagéré !'));
  slides.push(bullets('La société au Moyen Âge', ['Le roi au sommet', 'Les seigneurs et chevaliers défendent le territoire', 'Le clergé (moines, prêtres) prient et enseignent', 'Les paysans travaillent la terre (90% de la population !)']));
  slides.push(quiz('En quelle année Charlemagne est-il devenu empereur ?', ['476', '800', '1066', '1492'], 1, 'Charlemagne a été couronné empereur en l\'an 800 par le pape à Rome.'));

  slides.push(chapterIntro(4, 'Les Temps Modernes', 'De la Renaissance à la Révolution'));
  slides.push(concept('Les Temps Modernes commencent en 1492 avec la découverte de l\'Amérique par Christophe Colomb. C\'est l\'époque de la Renaissance, des grandes explorations et des rois puissants comme François Ier et Louis XIV.'));
  slides.push(concept('Louis XIV, le Roi-Soleil, a régné 72 ans ! Il a construit le château de Versailles et a fait de la France la plus grande puissance d\'Europe. Mais le peuple était très pauvre et payait beaucoup d\'impôts.'));
  slides.push(quiz('Qui a construit le château de Versailles ?', ['Napoléon', 'Charlemagne', 'Louis XIV', 'François Ier'], 2, 'Louis XIV, surnommé le Roi-Soleil, a fait construire le château de Versailles pour montrer la grandeur de la France.'));

  slides.push(chapterIntro(5, 'La Révolution Française', '1789 et la naissance de la République'));
  slides.push(concept('Le 14 juillet 1789, le peuple de Paris prend la Bastille, une prison qui symbolisait le pouvoir royal. C\'est le début de la Révolution française ! Le peuple en a assez des inégalités, de la faim et des impôts.'));
  slides.push(concept('La Déclaration des Droits de l\'Homme et du Citoyen est adoptée le 26 août 1789. Article 1 : "Les hommes naissent et demeurent libres et égaux en droits." C\'est un texte fondateur qui inspire encore le monde entier aujourd\'hui.'));
  slides.push(quiz('Quelle date est la fête nationale française ?', ['Le 1er janvier', 'Le 8 mai', 'Le 14 juillet', 'Le 11 novembre'], 2, 'Le 14 juillet commémore la prise de la Bastille en 1789, symbole de la Révolution française.'));
  slides.push(summary('Ce qu\'on a appris en histoire', ['La Préhistoire : des premiers humains à l\'écriture', 'L\'Antiquité : Gaulois et Romains', 'Le Moyen Âge : châteaux, chevaliers et Charlemagne', 'Les Temps Modernes : Renaissance et Roi-Soleil', 'La Révolution : liberté, égalité, fraternité']));

  return slides;
}

function generateCM1Sciences() {
  slideIndex = 0;
  const slides = [];

  slides.push(chapterIntro(1, 'L\'Eau dans la Nature', 'Le cycle de l\'eau'));
  slides.push(concept('L\'eau est partout sur Terre : dans les océans (97%), dans les glaciers (2%), et dans les rivières et lacs (1%). L\'eau douce que nous pouvons boire représente moins de 1% de toute l\'eau sur Terre ! C\'est pour cela qu\'il faut l\'économiser.'));
  slides.push(steps('Le cycle de l\'eau', ['Le soleil chauffe l\'eau des océans, des lacs et des rivières', 'L\'eau s\'évapore et monte dans l\'atmosphère', 'En montant, la vapeur refroidit et forme des nuages (condensation)', 'Les nuages se déplacent avec le vent', 'L\'eau retombe sous forme de pluie ou de neige (précipitations)', 'L\'eau coule dans les rivières et retourne à la mer']));
  slides.push(quiz('Comment s\'appelle le passage de l\'eau liquide à la vapeur ?', ['Condensation', 'Évaporation', 'Précipitation', 'Solidification'], 1, 'L\'évaporation est le passage de l\'état liquide à l\'état gazeux, sous l\'effet de la chaleur.'));
  slides.push(tip('Pour retenir le cycle de l\'eau : "Éva monte, Condi descend, Préci tombe" — Évaporation monte, Condensation forme les nuages, Précipitation fait tomber la pluie !'));

  slides.push(chapterIntro(2, 'L\'Électricité', 'Circuits et sécurité'));
  slides.push(concept('L\'électricité, c\'est un courant de minuscules particules appelées électrons qui circulent dans un fil conducteur. Pour que le courant circule, il faut un circuit fermé : une pile (générateur), des fils et un appareil (ampoule, moteur).'));
  slides.push(comparison('Conducteur vs Isolant', 'Conducteur (laisse passer le courant)', ['Métaux (cuivre, aluminium, fer)', 'L\'eau salée', 'Le corps humain'], 'Isolant (bloque le courant)', ['Plastique', 'Bois sec', 'Caoutchouc', 'Verre']));
  slides.push(warning('L\'électricité de la maison est dangereuse ! Ne mets jamais tes doigts ou un objet dans une prise. Ne touche jamais un appareil électrique avec les mains mouillées. En cas de problème, préviens un adulte.'));
  slides.push(quiz('Lequel de ces matériaux est un conducteur électrique ?', ['Le bois', 'Le plastique', 'Le cuivre', 'Le caoutchouc'], 2, 'Le cuivre est un excellent conducteur. C\'est pour cela que les fils électriques sont en cuivre !'));

  slides.push(chapterIntro(3, 'L\'Air et les Mélanges', 'Ce qui nous entoure'));
  slides.push(concept('L\'air est un mélange de gaz. Il est composé de 78% d\'azote, 21% d\'oxygène et 1% d\'autres gaz (dont le CO2). L\'oxygène est le gaz dont nous avons besoin pour respirer. Les plantes, elles, absorbent le CO2.'));
  slides.push(concept('Un mélange homogène, c\'est quand on ne voit pas les différents composants. Comme le sirop dans l\'eau. Un mélange hétérogène, c\'est quand on voit les composants séparés. Comme l\'huile et l\'eau qui ne se mélangent pas.'));
  slides.push(quiz('L\'air est principalement composé de…', ['Oxygène', 'Azote', 'CO2', 'Hélium'], 1, 'L\'azote représente 78% de l\'air ! L\'oxygène ne représente que 21%.'));

  slides.push(chapterIntro(4, 'Les Matériaux', 'Naturels et fabriqués'));
  slides.push(table('Types de matériaux', ['Matériau', 'Origine', 'Propriétés', 'Exemples'], [
    ['Bois', 'Naturel (arbres)', 'Léger, isolant, se travaille facilement', 'Meubles, papier'],
    ['Métal', 'Naturel (minerai)', 'Solide, conducteur, recyclable', 'Voitures, casseroles'],
    ['Plastique', 'Fabriqué (pétrole)', 'Léger, isolant, moule facilement', 'Jouets, bouteilles'],
    ['Verre', 'Fabriqué (sable)', 'Transparent, fragile, recyclable', 'Fenêtres, bouteilles'],
  ]));
  slides.push(quiz('Quel matériau est fabriqué à partir de pétrole ?', ['Le bois', 'Le verre', 'Le plastique', 'Le métal'], 2, 'Le plastique est fabriqué à partir de pétrole. C\'est pourquoi il pollue quand on le jette dans la nature.'));
  slides.push(tip('Le tri sélectif : poubelle jaune pour le plastique, le carton et le métal. Poubelle verte pour le verre. Poubelle grise pour le reste. Recycler, c\'est protéger notre planète !'));

  slides.push(chapterIntro(5, 'Quiz Final Sciences CM1', 'Es-tu un scientifique en herbe ?'));
  slides.push(quiz('Quelle quantité d\'eau douce est disponible sur Terre ?', ['50%', '10%', 'Moins de 1%', '25%'], 2, 'Moins de 1% de l\'eau sur Terre est de l\'eau douce accessible. Le reste est salé ou gelé !'));
  slides.push(quiz('Pour qu\'une ampoule s\'allume, le circuit doit être…', ['Ouvert', 'Fermé', 'Coupé', 'En plastique'], 1, 'Le circuit doit être fermé pour que le courant électrique puisse circuler de la pile à l\'ampoule.'));
  slides.push(concept('Félicitations ! Tu as exploré l\'eau, l\'électricité, l\'air et les matériaux. La science, c\'est comprendre le monde qui nous entoure. Continue à poser des questions et à faire des expériences !', 'Bravo petit scientifique !'));

  return slides;
}

// ── 5ème generators ───────────────────────────────────────────────────

function generateCinquiemeMaths() {
  slideIndex = 0;
  const slides = [];

  slides.push(chapterIntro(1, 'Nombres Relatifs', 'Les nombres négatifs entrent en scène'));
  slides.push(concept('Les nombres relatifs, ce sont les nombres positifs ET négatifs. Pourquoi les négatifs existent ? Pense à la température : il peut faire -5°C en hiver ! Ou à un ascenseur qui descend au sous-sol -1, -2. Zéro est le point de référence.'));
  slides.push(concept('Sur une droite graduée, les nombres positifs sont à droite de zéro et les négatifs à gauche. Plus un nombre est à droite, plus il est grand. Donc -3 est plus grand que -7. Et +2 est plus grand que -100.'));
  slides.push(concept('Pour additionner deux nombres relatifs de même signe, on additionne les valeurs et on garde le signe. Exemple : (-3) + (-5) = -8. Pour deux signes différents, on soustrait et on garde le signe du plus grand. Exemple : (+7) + (-3) = +4.'));
  slides.push(quiz('Combien font (-8) + (+3) ?', ['-11', '-5', '+5', '+11'], 1, '(-8) + (+3) = -5. On soustrait 3 de 8 (car signes différents) et on garde le signe du plus grand en valeur absolue (-8), donc le résultat est négatif.'));
  slides.push(quiz('Quel nombre est le plus grand : -15 ou -3 ?', ['-15', '-3', 'Ils sont égaux', 'On ne peut pas comparer'], 1, '-3 est plus grand que -15. Sur la droite graduée, -3 est plus à droite (plus proche de zéro).'));
  slides.push(concept('Soustraire un nombre, c\'est additionner son opposé ! (+5) - (+3) = (+5) + (-3) = +2. Et (+5) - (-3) = (+5) + (+3) = +8. Retiens cette règle magique : soustraire un négatif, c\'est comme additionner un positif !'));
  slides.push(quiz('Combien font (+4) - (-6) ?', ['-2', '+2', '+10', '-10'], 2, '(+4) - (-6) = (+4) + (+6) = +10. Soustraire un négatif revient à additionner un positif !'));

  slides.push(chapterIntro(2, 'Fractions Avancées', 'Additionner, soustraire et comparer'));
  slides.push(concept('Pour additionner des fractions avec des dénominateurs différents, il faut d\'abord les mettre au même dénominateur. Exemple : 1/3 + 1/4. Le dénominateur commun est 12. Donc 1/3 = 4/12 et 1/4 = 3/12. Résultat : 4/12 + 3/12 = 7/12.'));
  slides.push(steps('Méthode pour additionner des fractions', ['Trouver le dénominateur commun (plus petit multiple commun)', 'Convertir chaque fraction au nouveau dénominateur', 'Additionner les numérateurs', 'Simplifier si possible']));
  slides.push(quiz('Combien font 2/3 + 1/6 ?', ['3/9', '3/6', '5/6', '2/6'], 2, '2/3 = 4/6. Donc 4/6 + 1/6 = 5/6.'));
  slides.push(concept('Multiplier des fractions, c\'est simple : on multiplie les numérateurs entre eux et les dénominateurs entre eux. 2/3 × 4/5 = (2×4)/(3×5) = 8/15. Pas besoin de chercher un dénominateur commun !'));
  slides.push(quiz('Combien font 3/4 × 2/5 ?', ['5/9', '6/20', '3/10', '6/9'], 2, '3/4 × 2/5 = 6/20 = 3/10 (en simplifiant par 2).'));

  slides.push(chapterIntro(3, 'Proportionnalité', 'Les tableaux et les pourcentages'));
  slides.push(concept('Deux grandeurs sont proportionnelles quand l\'une est toujours le même multiple de l\'autre. Si 3 croissants coûtent 3 euros, alors 6 croissants coûtent 6 euros et 9 croissants coûtent 9 euros. Le coefficient de proportionnalité est 1 (1 euro par croissant).'));
  slides.push(concept('Un pourcentage, c\'est une fraction sur 100. 25% = 25/100 = 1/4. Pour calculer 20% de 150 : on fait 150 × 20/100 = 150 × 0,2 = 30. Les pourcentages sont partout : soldes, notes, statistiques.'));
  slides.push(quiz('Quel est 15% de 200 ?', ['15', '30', '40', '3 000'], 1, '15% de 200 = 200 × 15/100 = 200 × 0,15 = 30.'));
  slides.push(quiz('Si 5 kg de pommes coûtent 10 euros, combien coûtent 8 kg ?', ['13 €', '14 €', '16 €', '40 €'], 2, 'Prix par kg = 10/5 = 2 €/kg. Donc 8 kg = 8 × 2 = 16 €.'));

  slides.push(chapterIntro(4, 'Symétrie Centrale', 'Le point de pivot'));
  slides.push(concept('La symétrie centrale, c\'est comme faire tourner une figure de 180° autour d\'un point. Le point A et son symétrique A\' sont à la même distance du centre O, mais de l\'autre côté. C\'est différent de la symétrie axiale (miroir).'));
  slides.push(comparison('Symétrie axiale vs centrale', 'Axiale (miroir)', ['On plie selon un axe', 'Les deux moitiés se superposent', 'Comme un reflet dans l\'eau'], 'Centrale (rotation)', ['On tourne de 180°', 'Le point et son image sont de part et d\'autre du centre', 'Comme retourner une carte']));
  slides.push(quiz('Quelle lettre a une symétrie centrale ?', ['A', 'B', 'S', 'E'], 2, 'La lettre S a une symétrie centrale : si tu la tournes de 180°, elle a la même forme !'));

  slides.push(chapterIntro(5, 'Angles et Triangles', 'Mesurer et construire'));
  slides.push(bullets('Les types d\'angles', ['Angle aigu : moins de 90°', 'Angle droit : exactement 90°', 'Angle obtus : entre 90° et 180°', 'Angle plat : exactement 180° (une ligne droite)']));
  slides.push(concept('La somme des angles d\'un triangle est toujours 180°. Toujours ! Que le triangle soit petit ou grand, équilatéral ou quelconque. Si tu connais deux angles, tu peux toujours trouver le troisième.'));
  slides.push(quiz('Un triangle a deux angles de 45° et 65°. Combien mesure le 3ème angle ?', ['60°', '70°', '80°', '110°'], 1, '45° + 65° = 110°. Le 3ème angle = 180° - 110° = 70°.'));

  slides.push(chapterIntro(6, 'Quiz Final 5ème Maths', 'Le grand défi !'));
  slides.push(quiz('Combien font (-7) × (-3) ?', ['-21', '+21', '-10', '+10'], 1, 'Moins fois moins égale plus ! (-7) × (-3) = +21.'));
  slides.push(quiz('Simplifie la fraction 12/18.', ['6/9', '4/6', '2/3', '3/2'], 2, '12/18 = 2/3 en divisant numérateur et dénominateur par 6.'));
  slides.push(concept('Excellent travail ! Tu maîtrises maintenant les nombres relatifs, les fractions avancées, la proportionnalité, les symétries et les angles. Ces compétences sont la base de toutes les maths au collège !', 'Bravo !'));

  return slides;
}

function generateCinquiemePhysique() {
  slideIndex = 0;
  const slides = [];

  slides.push(chapterIntro(1, 'L\'Eau et ses Propriétés', 'Solvant universel et changements d\'état'));
  slides.push(concept('L\'eau est un solvant universel : elle peut dissoudre plus de substances que n\'importe quel autre liquide. Le sel, le sucre, certains gaz se dissolvent dans l\'eau. Mais l\'huile ne se dissout pas : on dit qu\'elle est non miscible avec l\'eau.'));
  slides.push(concept('La masse volumique de l\'eau pure est de 1 g par millilitre, soit 1 000 kg par mètre cube. C\'est pour cela qu\'1 litre d\'eau pèse exactement 1 kg. Cette propriété remarquable sert de référence pour définir le kilogramme.'));
  slides.push(quiz('Pourquoi l\'huile flotte-t-elle sur l\'eau ?', ['Elle est plus légère que l\'eau', 'Elle est non miscible', 'Sa masse volumique est inférieure à celle de l\'eau', 'Les trois réponses sont liées'], 3, 'Les trois sont liées : l\'huile flotte car sa masse volumique est inférieure à 1 g/mL, et elle ne se mélange pas car elle est non miscible.'));

  slides.push(chapterIntro(2, 'Les Circuits Électriques', 'Série et dérivation'));
  slides.push(concept('Dans un circuit en série, les composants sont branchés les uns à la suite des autres. Si une ampoule grille, tout le circuit s\'arrête. Dans un circuit en dérivation (parallèle), les composants sont sur des branches différentes. Si une ampoule grille, les autres continuent de fonctionner.'));
  slides.push(comparison('Série vs Dérivation', 'Circuit en série', ['Un seul chemin pour le courant', 'Si un élément grille, tout s\'éteint', 'Les ampoules brillent moins fort'], 'Circuit en dérivation', ['Plusieurs chemins pour le courant', 'Chaque branche est indépendante', 'Les ampoules brillent normalement']));
  slides.push(concept('L\'intensité du courant se mesure en ampères (A) avec un ampèremètre, branché en série. La tension se mesure en volts (V) avec un voltmètre, branché en dérivation. Loi des nœuds : dans un circuit en dérivation, l\'intensité se partage entre les branches.'));
  slides.push(quiz('Dans un circuit en dérivation avec 2 ampoules identiques, si l\'intensité totale est 0,6 A, quelle est l\'intensité dans chaque branche ?', ['0,6 A', '0,3 A', '1,2 A', '0,2 A'], 1, 'L\'intensité se partage : 0,6 / 2 = 0,3 A dans chaque branche.'));

  slides.push(chapterIntro(3, 'Les Mélanges', 'Homogènes, hétérogènes et techniques de séparation'));
  slides.push(bullets('Techniques de séparation', ['Filtration : sépare un solide d\'un liquide (café filtré)', 'Décantation : sépare deux liquides non miscibles (huile/eau)', 'Évaporation : récupère un solide dissous (sel de l\'eau de mer)', 'Distillation : sépare des liquides miscibles par chauffage']));
  slides.push(quiz('Pour récupérer le sel de l\'eau de mer, on utilise…', ['La filtration', 'La décantation', 'L\'évaporation', 'La congélation'], 2, 'L\'évaporation ! On chauffe l\'eau de mer, l\'eau s\'évapore et le sel reste. C\'est ainsi que fonctionnent les marais salants.'));

  slides.push(chapterIntro(4, 'La Lumière', 'Propagation et ombres'));
  slides.push(concept('La lumière se propage en ligne droite. C\'est pour cela que les ombres ont des bords nets. Quand un objet opaque bloque la lumière du soleil, il crée une ombre de l\'autre côté. Plus l\'objet est proche de la source, plus l\'ombre est grande.'));
  slides.push(quiz('Pourquoi voit-on des éclipses de Soleil ?', ['Le Soleil s\'éteint', 'La Lune passe entre la Terre et le Soleil', 'La Terre passe entre la Lune et le Soleil', 'C\'est un phénomène imaginaire'], 1, 'La Lune passe entre la Terre et le Soleil et bloque sa lumière. Son ombre se projette sur une partie de la Terre.'));

  slides.push(chapterIntro(5, 'Quiz Final 5ème Physique-Chimie', 'Teste tes connaissances !'));
  slides.push(quiz('Quelle est la masse de 500 mL d\'eau pure ?', ['50 g', '500 g', '5 kg', '500 kg'], 1, 'La masse volumique de l\'eau est 1 g/mL, donc 500 mL = 500 g.'));
  slides.push(quiz('Un voltmètre se branche…', ['En série', 'En dérivation', 'N\'importe comment', 'Après le générateur uniquement'], 1, 'Le voltmètre se branche en dérivation (en parallèle) aux bornes du composant dont on veut mesurer la tension.'));
  slides.push(concept('Bravo ! Tu comprends maintenant l\'eau, les circuits électriques, les mélanges et la lumière. La physique-chimie, c\'est comprendre les lois qui gouvernent notre univers !'));

  return slides;
}

function generateCinquiemeHistoire() {
  slideIndex = 0;
  const slides = [];

  slides.push(chapterIntro(1, 'Byzance et l\'Empire Carolingien', 'Deux héritiers de Rome'));
  slides.push(concept('Après la chute de Rome en 476, l\'Empire Romain d\'Orient (Byzance) survit pendant encore 1 000 ans, jusqu\'en 1453 ! Sa capitale Constantinople est la plus grande ville du monde médiéval. L\'empereur Justinien codifie le droit romain et fait construire la basilique Sainte-Sophie.'));
  slides.push(concept('En Occident, Charlemagne unifie une grande partie de l\'Europe et se fait couronner empereur en 800. Il crée des écoles, organise l\'administration avec des comtes et des missi dominici (inspecteurs royaux). Mais après sa mort, l\'empire se divise en trois.'));
  slides.push(quiz('Quelle est la capitale de l\'Empire Byzantin ?', ['Rome', 'Athènes', 'Constantinople', 'Alexandrie'], 2, 'Constantinople (aujourd\'hui Istanbul) était la capitale de l\'Empire Byzantin, fondée par l\'empereur Constantin.'));

  slides.push(chapterIntro(2, 'L\'Islam', 'Naissance et civilisation'));
  slides.push(concept('L\'Islam naît au 7ème siècle dans la péninsule arabique avec le prophète Muhammad. En un siècle, l\'Islam se répand de l\'Espagne à l\'Inde. La civilisation islamique développe les mathématiques (algèbre, algorithme), la médecine, l\'astronomie et l\'architecture.'));
  slides.push(bullets('Les apports de la civilisation islamique', ['L\'algèbre (du mot arabe al-jabr)', 'Les chiffres "arabes" (en fait inventés en Inde)', 'L\'hôpital moderne', 'L\'astrolabe pour naviguer', 'La traduction des textes grecs']));
  slides.push(quiz('D\'où vient le mot "algorithme" ?', ['Du grec', 'Du latin', 'De l\'arabe (Al-Khwârizmî)', 'Du français'], 2, 'Le mot algorithme vient du mathématicien perse Al-Khwârizmî (9ème siècle), qui a aussi inventé l\'algèbre.'));

  slides.push(chapterIntro(3, 'La Société Féodale', 'Seigneurs, paysans et chevaliers'));
  slides.push(concept('La féodalité, c\'est un système où le roi confie des terres (fiefs) aux seigneurs en échange de leur fidélité et de leur aide militaire. Les seigneurs protègent les paysans qui travaillent la terre. Les paysans paient des impôts et des corvées en échange de la protection.'));
  slides.push(concept('L\'Église est omniprésente au Moyen Âge. Les moines copient les manuscrits, cultivent les terres et soignent les malades. Les cathédrales gothiques sont construites entre le 12ème et le 15ème siècle : Notre-Dame de Paris, Chartres, Reims.'));
  slides.push(quiz('Qu\'est-ce qu\'un fief ?', ['Un impôt', 'Une terre donnée par le roi à un seigneur', 'Une arme de chevalier', 'Un type de château'], 1, 'Un fief est une terre que le roi donne à un seigneur en échange de sa fidélité et de son service militaire.'));

  slides.push(chapterIntro(4, 'Les Grandes Découvertes', 'Quand l\'Europe découvre le monde'));
  slides.push(concept('Au 15ème siècle, les Européens cherchent de nouvelles routes vers l\'Asie pour le commerce des épices. En 1492, Christophe Colomb traverse l\'Atlantique et atteint l\'Amérique. En 1498, Vasco de Gama atteint l\'Inde par l\'Afrique. En 1522, l\'expédition de Magellan fait le tour du monde.'));
  slides.push(warning('Les Grandes Découvertes ont aussi un côté sombre : la colonisation, l\'esclavage et les maladies apportées aux peuples autochtones. Des civilisations entières comme les Aztèques et les Incas ont été détruites.'));
  slides.push(quiz('Qui a réalisé le premier tour du monde ?', ['Christophe Colomb', 'Vasco de Gama', 'L\'expédition de Magellan', 'Marco Polo'], 2, 'L\'expédition de Magellan a réalisé le premier tour du monde (1519-1522), même si Magellan est mort en route aux Philippines.'));

  slides.push(chapterIntro(5, 'Quiz Final Histoire-Géo 5ème', 'Le grand test !'));
  slides.push(quiz('En quelle année Constantinople est-elle tombée ?', ['476', '800', '1453', '1492'], 2, 'Constantinople est tombée en 1453, prise par les Ottomans. C\'est la fin de l\'Empire Byzantin, qui avait duré près de 1 000 ans.'));
  slides.push(quiz('Quel scientifique musulman est à l\'origine de l\'algèbre ?', ['Ibn Sina (Avicenne)', 'Al-Khwârizmî', 'Ibn Khaldoun', 'Al-Idrisi'], 1, 'Al-Khwârizmî, mathématicien perse du 9ème siècle, est considéré comme le père de l\'algèbre.'));
  slides.push(concept('Bravo ! Tu connais maintenant l\'Empire Byzantin, la civilisation islamique, la société féodale et les Grandes Découvertes. L\'histoire nous aide à comprendre d\'où nous venons et pourquoi le monde est tel qu\'il est aujourd\'hui.'));

  return slides;
}

// ── 4ème, Terminale and PCSI — Stub generators (full content) ────────
// These generate comprehensive content for each subject

function generateQuatriemeMaths() { return generateMathLevel('4ème', [
  { title: 'Le Théorème de Pythagore', subtitle: 'Dans un triangle rectangle…', content: () => {
    const s = [];
    s.push(concept('Dans un triangle rectangle, le carré de l\'hypoténuse est égal à la somme des carrés des deux autres côtés. Si les côtés de l\'angle droit mesurent a et b, et l\'hypoténuse c, alors a² + b² = c². C\'est le théorème le plus célèbre des mathématiques !'));
    s.push(concept('Exemple : un triangle rectangle avec des côtés de 3 cm et 4 cm. L\'hypoténuse = racine carrée de (9 + 16) = racine carrée de 25 = 5 cm. Le fameux triangle 3-4-5 ! Les Égyptiens l\'utilisaient déjà il y a 4 000 ans pour construire des angles droits.'));
    s.push(quiz('Un triangle rectangle a des côtés de 5 cm et 12 cm. Quelle est l\'hypoténuse ?', ['13 cm', '15 cm', '17 cm', '7 cm'], 0, '5² + 12² = 25 + 144 = 169. Racine de 169 = 13 cm.'));
    s.push(concept('La réciproque de Pythagore permet de vérifier si un triangle est rectangle. Si a² + b² = c² (avec c le plus grand côté), alors le triangle est rectangle. Exemple : 6, 8, 10. Vérifions : 36 + 64 = 100 = 10². Oui, c\'est un triangle rectangle !'));
    s.push(quiz('Le triangle de côtés 7, 24, 25 est-il rectangle ?', ['Oui', 'Non', 'On ne peut pas savoir', 'Seulement si c\'est un carré'], 0, '7² + 24² = 49 + 576 = 625 = 25². Oui, c\'est un triangle rectangle !'));
    return s;
  }},
  { title: 'Le Théorème de Thalès', subtitle: 'Proportionnalité dans les triangles', content: () => {
    const s = [];
    s.push(concept('Le théorème de Thalès dit que si deux droites parallèles coupent deux sécantes, alors elles découpent des segments proportionnels. En pratique, ça permet de calculer des longueurs inaccessibles : la hauteur d\'un arbre, la largeur d\'une rivière.'));
    s.push(concept('Exemple : on veut mesurer la hauteur d\'un arbre. On plante un bâton de 1,5 m. L\'ombre du bâton mesure 2 m et l\'ombre de l\'arbre mesure 8 m. Par Thalès : hauteur/1,5 = 8/2. Donc hauteur = 1,5 × 4 = 6 m.'));
    s.push(quiz('Avec Thalès : si AB/AD = 3/5 et BC = 6, combien vaut DE ?', ['10', '6', '3,6', '8'], 0, 'Par Thalès : BC/DE = AB/AD = 3/5. Donc DE = BC × 5/3 = 6 × 5/3 = 10.'));
    return s;
  }},
  { title: 'Calcul Littéral', subtitle: 'Développer, factoriser, identités remarquables', content: () => {
    const s = [];
    s.push(concept('Le calcul littéral utilise des lettres pour représenter des nombres. L\'expression 3x + 5 signifie "3 fois un nombre inconnu, plus 5". Si x = 2, alors 3×2 + 5 = 11. Le calcul littéral est la base de l\'algèbre.'));
    s.push(concept('Développer : k(a + b) = ka + kb. Exemple : 3(x + 4) = 3x + 12. Factoriser, c\'est le contraire : 6x + 12 = 6(x + 2). On met en facteur ce qui est commun.'));
    s.push(bullets('Les 3 identités remarquables', ['(a + b)² = a² + 2ab + b²', '(a - b)² = a² - 2ab + b²', '(a + b)(a - b) = a² - b²']));
    s.push(quiz('Développe (x + 3)²', ['x² + 9', 'x² + 3x + 9', 'x² + 6x + 9', '2x + 6'], 2, '(x + 3)² = x² + 2×x×3 + 3² = x² + 6x + 9'));
    return s;
  }},
  { title: 'Équations', subtitle: 'Résoudre des équations du premier degré', content: () => {
    const s = [];
    s.push(concept('Une équation, c\'est une égalité avec une inconnue. Résoudre l\'équation 2x + 3 = 11, c\'est trouver la valeur de x qui rend l\'égalité vraie. La règle d\'or : ce qu\'on fait à gauche, on le fait aussi à droite.'));
    s.push(steps('Résoudre 2x + 3 = 11', ['2x + 3 = 11', '2x = 11 - 3 (on soustrait 3 des deux côtés)', '2x = 8', 'x = 8/2 (on divise par 2 des deux côtés)', 'x = 4']));
    s.push(quiz('Résous : 5x - 7 = 18', ['x = 5', 'x = 2,2', 'x = 11', 'x = 25'], 0, '5x - 7 = 18 → 5x = 25 → x = 5. Vérification : 5×5 - 7 = 25 - 7 = 18 ✓'));
    return s;
  }},
  { title: 'Statistiques et Probabilités', subtitle: 'Moyenne, médiane et hasard', content: () => {
    const s = [];
    s.push(concept('La moyenne, c\'est la somme de toutes les valeurs divisée par le nombre de valeurs. Si tes notes sont 12, 15, 8, 14, 16, la moyenne = (12+15+8+14+16)/5 = 65/5 = 13.'));
    s.push(concept('La médiane, c\'est la valeur qui sépare les données en deux moitiés égales. On range les valeurs dans l\'ordre et on prend celle du milieu. Pour 8, 12, 14, 15, 16 : la médiane est 14. La médiane est moins sensible aux valeurs extrêmes que la moyenne.'));
    s.push(concept('La probabilité d\'un événement = nombre de cas favorables / nombre total de cas possibles. Lancer un dé : probabilité d\'obtenir un 6 = 1/6. Probabilité d\'obtenir un nombre pair (2, 4, 6) = 3/6 = 1/2.'));
    s.push(quiz('On tire une carte au hasard dans un jeu de 52 cartes. Quelle est la probabilité de tirer un as ?', ['1/52', '4/52', '1/13', 'B et C sont identiques'], 3, '4 as dans 52 cartes : P = 4/52 = 1/13. Les deux réponses B et C sont identiques !'));
    return s;
  }},
  { title: 'Quiz Final 4ème', subtitle: 'Le grand défi !', content: () => {
    const s = [];
    s.push(quiz('Factorise : x² - 9', ['(x-3)(x-3)', '(x+3)(x-3)', '(x+9)(x-1)', 'x(x-9)'], 1, 'x² - 9 = x² - 3² = (x+3)(x-3). C\'est la troisième identité remarquable !'));
    s.push(quiz('Un triangle a des côtés de 8, 15 et 17. Est-il rectangle ?', ['Oui', 'Non', 'Impossible à déterminer', 'Seulement s\'il est isocèle'], 0, '8² + 15² = 64 + 225 = 289 = 17². Oui, c\'est un triangle rectangle !'));
    s.push(concept('Félicitations ! Tu maîtrises Pythagore, Thalès, le calcul littéral, les équations et les probabilités. Tu es prêt pour la 3ème et le brevet !'));
    return s;
  }},
]); }

function generateMathLevel(level, chapters) {
  slideIndex = 0;
  const slides = [];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    slides.push(chapterIntro(i + 1, ch.title, ch.subtitle));
    slides.push(...ch.content());
  }
  return slides;
}

function generateQuatriemePhysique() { return generateMathLevel('4ème Physique', [
  { title: 'L\'Atome', subtitle: 'La brique élémentaire de la matière', content: () => {
    const s = [];
    s.push(concept('Tout ce qui existe est fait d\'atomes. L\'atome est incroyablement petit : il en faudrait 10 millions côte à côte pour faire 1 millimètre ! L\'atome est composé d\'un noyau (protons + neutrons) entouré d\'électrons.'));
    s.push(concept('Il existe environ 118 éléments chimiques différents, classés dans le tableau périodique de Mendeleïev. L\'hydrogène (H) est le plus léger, l\'uranium (U) le plus lourd naturel. Chaque élément a un numéro atomique = nombre de protons.'));
    s.push(quiz('Combien de protons a l\'atome de carbone (numéro atomique 6) ?', ['2', '6', '12', '14'], 1, 'Le numéro atomique = nombre de protons. Le carbone a 6 protons.'));
    s.push(concept('Les molécules sont des groupes d\'atomes liés ensemble. L\'eau H2O = 2 atomes d\'hydrogène + 1 atome d\'oxygène. Le dioxygène O2 = 2 atomes d\'oxygène. Le glucose C6H12O6 = 6 carbones + 12 hydrogènes + 6 oxygènes.'));
    s.push(quiz('Combien d\'atomes contient une molécule de CO2 ?', ['2', '3', '4', '1'], 1, 'CO2 = 1 atome de carbone + 2 atomes d\'oxygène = 3 atomes au total.'));
    return s;
  }},
  { title: 'Le Courant Électrique', subtitle: 'Tension, intensité et loi d\'Ohm', content: () => {
    const s = [];
    s.push(concept('La loi d\'Ohm relie tension (U en volts), intensité (I en ampères) et résistance (R en ohms) : U = R × I. Si tu connais deux de ces valeurs, tu peux calculer la troisième. C\'est LA loi fondamentale de l\'électricité.'));
    s.push(quiz('Une résistance de 100 ohms est traversée par un courant de 0,2 A. Quelle est la tension ?', ['20 V', '50 V', '500 V', '0,002 V'], 0, 'U = R × I = 100 × 0,2 = 20 V.'));
    s.push(concept('La puissance électrique P = U × I. Elle se mesure en watts (W). Une ampoule de 60 W sous 230 V consomme un courant de I = P/U = 60/230 = 0,26 A. L\'énergie = P × t (en kWh pour la facture).'));
    return s;
  }},
  { title: 'La Lumière et les Couleurs', subtitle: 'Décomposition et synthèse', content: () => {
    const s = [];
    s.push(concept('La lumière blanche est composée de toutes les couleurs de l\'arc-en-ciel. Un prisme décompose la lumière blanche en un spectre : rouge, orange, jaune, vert, bleu, indigo, violet. C\'est Isaac Newton qui l\'a découvert en 1666.'));
    s.push(concept('Les trois couleurs primaires de la lumière sont le rouge, le vert et le bleu (RVB). En les mélangeant, on peut créer toutes les couleurs. Rouge + Vert = Jaune. Vert + Bleu = Cyan. Rouge + Bleu = Magenta. Les trois ensemble = blanc !'));
    s.push(quiz('Quelle couleur obtient-on en mélangeant lumière rouge et lumière verte ?', ['Orange', 'Jaune', 'Marron', 'Blanc'], 1, 'Rouge + Vert = Jaune en synthèse additive (lumière). Attention, c\'est différent en peinture !'));
    return s;
  }},
  { title: 'Les Combustions', subtitle: 'Réactions chimiques avec l\'oxygène', content: () => {
    const s = [];
    s.push(concept('Une combustion est une réaction chimique entre un combustible (bois, gaz, essence) et un comburant (l\'oxygène de l\'air). Elle produit de la chaleur et de la lumière. Sans oxygène, pas de feu !'));
    s.push(concept('La combustion du méthane : CH4 + 2O2 → CO2 + 2H2O. Le méthane réagit avec l\'oxygène pour donner du dioxyde de carbone et de l\'eau. La masse totale est conservée : c\'est la loi de Lavoisier (rien ne se perd, rien ne se crée, tout se transforme).'));
    s.push(quiz('Quel gaz est indispensable à la combustion ?', ['L\'azote', 'Le CO2', 'L\'oxygène', 'L\'hydrogène'], 2, 'L\'oxygène (O2) est le comburant nécessaire à toute combustion.'));
    return s;
  }},
  { title: 'Quiz Final Physique 4ème', subtitle: 'Vérifie tes connaissances !', content: () => {
    const s = [];
    s.push(quiz('Quelle est la loi d\'Ohm ?', ['P = U × I', 'U = R × I', 'E = mc²', 'F = m × a'], 1, 'La loi d\'Ohm : U = R × I. Tension = Résistance × Intensité.'));
    s.push(quiz('Combien d\'atomes d\'hydrogène dans la molécule d\'eau H2O ?', ['1', '2', '3', '0'], 1, 'H2O : le "2" indique 2 atomes d\'hydrogène et le O seul indique 1 atome d\'oxygène.'));
    s.push(concept('Bravo ! Tu maîtrises l\'atome, l\'électricité, la lumière et les réactions chimiques. La physique-chimie en 4ème pose les bases de tout ce que tu apprendras au lycée !'));
    return s;
  }},
]); }

function generateQuatriemeSVT() { return generateMathLevel('4ème SVT', [
  { title: 'La Reproduction', subtitle: 'Puberté et reproduction humaine', content: () => {
    const s = [];
    s.push(concept('La puberté est la période de transformation du corps, entre 10 et 16 ans environ. Les caractères sexuels secondaires apparaissent : croissance, pilosité, mue de la voix chez les garçons, développement de la poitrine chez les filles.'));
    s.push(concept('La reproduction humaine nécessite la rencontre d\'un ovule (cellule reproductrice féminine) et d\'un spermatozoïde (cellule reproductrice masculine). Cette rencontre s\'appelle la fécondation. Elle produit une cellule-œuf qui se développera en embryon puis en fœtus pendant 9 mois.'));
    s.push(quiz('Comment s\'appelle la cellule résultant de la fécondation ?', ['L\'embryon', 'La cellule-œuf', 'Le fœtus', 'Le gamète'], 1, 'La cellule-œuf (ou zygote) résulte de la fusion de l\'ovule et du spermatozoïde.'));
    return s;
  }},
  { title: 'La Génétique', subtitle: 'ADN et hérédité', content: () => {
    const s = [];
    s.push(concept('L\'ADN est la molécule qui contient toutes les informations pour construire un être vivant. Elle a la forme d\'une double hélice (comme un escalier en colimaçon). Chaque cellule de ton corps contient 2 mètres d\'ADN compacté dans le noyau !'));
    s.push(concept('Les gènes sont des portions d\'ADN qui codent pour un caractère. Tu as reçu la moitié de tes gènes de ta mère et l\'autre moitié de ton père. C\'est pour cela que tu leur ressembles, tout en étant unique !'));
    s.push(concept('Les chromosomes sont des structures qui portent l\'ADN. Les humains ont 23 paires de chromosomes, soit 46 au total. La 23ème paire détermine le sexe : XX pour une fille, XY pour un garçon.'));
    s.push(quiz('Combien de chromosomes a une cellule humaine ?', ['23', '46', '92', '12'], 1, 'Une cellule humaine a 46 chromosomes, organisés en 23 paires.'));
    return s;
  }},
  { title: 'La Tectonique des Plaques', subtitle: 'Séismes et volcans', content: () => {
    const s = [];
    s.push(concept('La surface de la Terre est découpée en grandes plaques tectoniques qui flottent sur le manteau visqueux. Ces plaques bougent de quelques centimètres par an. Quand elles se heurtent, s\'écartent ou glissent, cela provoque des séismes et des volcans.'));
    s.push(concept('Un séisme (tremblement de terre) se produit quand deux plaques bougent brusquement. Le foyer est le point de rupture en profondeur. L\'épicentre est le point en surface juste au-dessus du foyer. L\'échelle de Richter mesure l\'énergie libérée.'));
    s.push(quiz('Pourquoi y a-t-il beaucoup de volcans autour du Pacifique (Ceinture de Feu) ?', ['Le Pacifique est plus chaud', 'Les plaques tectoniques s\'y rencontrent', 'Le fond est plus mince', 'C\'est un hasard'], 1, 'La Ceinture de Feu du Pacifique correspond aux zones de convergence des plaques tectoniques, où une plaque plonge sous l\'autre (subduction).'));
    return s;
  }},
  { title: 'L\'Évolution', subtitle: 'Darwin et la sélection naturelle', content: () => {
    const s = [];
    s.push(concept('Charles Darwin a proposé la théorie de l\'évolution par sélection naturelle en 1859. Les individus les mieux adaptés à leur environnement survivent et se reproduisent davantage. Au fil des générations, les espèces changent et s\'adaptent.'));
    s.push(concept('Les fossiles sont la preuve de l\'évolution. On a trouvé des fossiles de transition comme l\'Archéoptéryx, à mi-chemin entre les dinosaures et les oiseaux. L\'humain moderne (Homo sapiens) est apparu il y a environ 300 000 ans en Afrique.'));
    s.push(quiz('Qu\'est-ce que la sélection naturelle ?', ['Les plus forts survivent toujours', 'Les mieux adaptés se reproduisent davantage', 'Les espèces ne changent jamais', 'Les mutations sont toujours bénéfiques'], 1, 'La sélection naturelle = les individus les mieux adaptés à leur environnement ont plus de chances de survivre et de transmettre leurs gènes.'));
    return s;
  }},
  { title: 'Quiz Final SVT 4ème', subtitle: 'Teste tes connaissances !', content: () => {
    const s = [];
    s.push(quiz('Quel est le nombre de paires de chromosomes chez l\'humain ?', ['22', '23', '46', '92'], 1, '23 paires de chromosomes = 46 chromosomes au total. La 23ème paire détermine le sexe.'));
    s.push(quiz('Comment s\'appelle l\'échelle qui mesure l\'énergie d\'un séisme ?', ['Beaufort', 'Richter', 'Kelvin', 'Mohs'], 1, 'L\'échelle de Richter mesure la magnitude (énergie) d\'un séisme.'));
    s.push(concept('Excellent ! Tu connais maintenant la reproduction, la génétique, la tectonique des plaques et l\'évolution. Les SVT t\'aident à comprendre le vivant et la Terre !'));
    return s;
  }},
]); }

// ── Terminale generators ──────────────────────────────────────────────

function generateTerminaleMathsAnalyse() { return generateMathLevel('Terminale Analyse', [
  { title: 'Les Suites', subtitle: 'Arithmétiques, géométriques et convergence', content: () => {
    const s = [];
    s.push(concept('Une suite arithmétique est une suite où l\'on ajoute toujours le même nombre (la raison r). Exemple : 2, 5, 8, 11, 14 (raison r = 3). Formule : u(n) = u(0) + n × r. Somme des n premiers termes : S = n × (premier + dernier) / 2.'));
    s.push(concept('Une suite géométrique est une suite où l\'on multiplie toujours par le même nombre (la raison q). Exemple : 3, 6, 12, 24, 48 (raison q = 2). Formule : u(n) = u(0) × q^n. Somme : S = u(0) × (1 - q^n) / (1 - q) si q ≠ 1.'));
    s.push(quiz('La suite 100, 95, 90, 85 est…', ['Géométrique de raison 0,95', 'Arithmétique de raison -5', 'Ni l\'un ni l\'autre', 'Arithmétique de raison 5'], 1, 'On soustrait 5 à chaque fois : c\'est arithmétique de raison r = -5.'));
    s.push(concept('Une suite converge si elle s\'approche d\'une limite quand n tend vers l\'infini. La suite u(n) = 1/n converge vers 0. La suite u(n) = (1 + 1/n)^n converge vers e ≈ 2,718. Une suite géométrique converge si et seulement si |q| < 1.'));
    s.push(quiz('La suite géométrique de raison 0,5 et de premier terme 8 converge vers…', ['0', '16', '∞', '-8'], 0, 'Si |q| < 1, la suite géométrique converge vers 0. 8, 4, 2, 1, 0,5, 0,25… → 0.'));
    return s;
  }},
  { title: 'Les Limites', subtitle: 'Comportement asymptotique des fonctions', content: () => {
    const s = [];
    s.push(concept('La limite d\'une fonction f en un point a, c\'est la valeur vers laquelle f(x) s\'approche quand x s\'approche de a. On écrit lim(x→a) f(x) = L. Par exemple, lim(x→∞) 1/x = 0 : quand x devient très grand, 1/x se rapproche de 0.'));
    s.push(concept('Les formes indéterminées sont des cas où la limite n\'est pas évidente : 0/0, ∞/∞, ∞ - ∞, 0 × ∞. Il faut alors simplifier, factoriser ou utiliser des techniques comme la règle de L\'Hôpital ou la factorisation par le terme dominant.'));
    s.push(quiz('Quelle est la limite de (3x² + x) / (x² - 1) quand x → ∞ ?', ['0', '1', '3', '∞'], 2, 'On divise numérateur et dénominateur par x² : (3 + 1/x) / (1 - 1/x²) → 3/1 = 3 quand x → ∞.'));
    s.push(concept('L\'asymptote horizontale y = L existe si lim(x→∞) f(x) = L. L\'asymptote verticale x = a existe si lim(x→a) f(x) = ±∞. L\'asymptote oblique y = ax + b existe si lim(x→∞) [f(x) - (ax+b)] = 0.'));
    return s;
  }},
  { title: 'La Dérivation', subtitle: 'Taux de variation et tangentes', content: () => {
    const s = [];
    s.push(concept('La dérivée f\'(x) mesure la vitesse de variation de f en un point. Géométriquement, c\'est la pente de la tangente à la courbe. Si f\'(x) > 0, f est croissante. Si f\'(x) < 0, f est décroissante. Si f\'(x) = 0, c\'est un extremum potentiel.'));
    s.push(table('Dérivées à connaître', ['f(x)', 'f\'(x)'], [
      ['x^n', 'n × x^(n-1)'],
      ['e^x', 'e^x'],
      ['ln(x)', '1/x'],
      ['sin(x)', 'cos(x)'],
      ['cos(x)', '-sin(x)'],
    ]));
    s.push(quiz('Quelle est la dérivée de f(x) = 3x⁴ - 2x² + 5 ?', ['12x³ - 4x', '12x³ - 4x + 5', '3x³ - 2x', '12x⁴ - 4x²'], 0, 'f\'(x) = 3×4x³ - 2×2x + 0 = 12x³ - 4x. La constante 5 disparaît.'));
    s.push(concept('Les opérations sur les dérivées : (f + g)\' = f\' + g\'. (f × g)\' = f\'g + fg\'. (f/g)\' = (f\'g - fg\') / g². (f∘g)\' = g\' × f\'(g). La dernière est la dérivée composée, très utilisée.'));
    return s;
  }},
  { title: 'La Fonction Exponentielle', subtitle: 'e^x, croissance et décroissance', content: () => {
    const s = [];
    s.push(concept('La fonction exponentielle exp(x) = e^x est l\'unique fonction égale à sa propre dérivée avec f(0) = 1. La constante e ≈ 2,71828 est un nombre fondamental en mathématiques. L\'exponentielle croît plus vite que n\'importe quel polynôme.'));
    s.push(concept('Propriétés : e^(a+b) = e^a × e^b. e^(a-b) = e^a / e^b. e^0 = 1. e^(-x) = 1/e^x. La fonction e^x est toujours strictement positive, strictement croissante sur ℝ, et sa limite en +∞ est +∞, en -∞ est 0.'));
    s.push(quiz('Que vaut e⁰ ?', ['0', '1', 'e', '∞'], 1, 'e⁰ = 1. Tout nombre élevé à la puissance 0 vaut 1.'));
    s.push(concept('L\'exponentielle modélise la croissance (ou décroissance) exponentielle. Population de bactéries qui double toutes les heures : N(t) = N₀ × 2^t. Désintégration radioactive : N(t) = N₀ × e^(-λt). La constante de temps λ détermine la vitesse.'));
    return s;
  }},
  { title: 'Le Logarithme Népérien', subtitle: 'ln(x), la fonction réciproque de e^x', content: () => {
    const s = [];
    s.push(concept('Le logarithme népérien ln(x) est la fonction réciproque de l\'exponentielle. ln(e^x) = x et e^(ln(x)) = x. Le ln est défini uniquement pour x > 0. ln(1) = 0 et ln(e) = 1.'));
    s.push(concept('Propriétés fondamentales : ln(ab) = ln(a) + ln(b). ln(a/b) = ln(a) - ln(b). ln(a^n) = n × ln(a). La dérivée de ln(x) est 1/x. Le ln transforme les multiplications en additions !'));
    s.push(quiz('Combien vaut ln(e³) ?', ['1', '3', 'e³', 'e'], 1, 'ln(e³) = 3 × ln(e) = 3 × 1 = 3. On utilise la propriété ln(a^n) = n × ln(a).'));
    return s;
  }},
  { title: 'L\'Intégration', subtitle: 'Primitives et calcul d\'aires', content: () => {
    const s = [];
    s.push(concept('L\'intégrale de a à b de f(x)dx représente l\'aire sous la courbe de f entre a et b. C\'est l\'opération inverse de la dérivation. Si F est une primitive de f (c\'est-à-dire F\' = f), alors l\'intégrale de a à b = F(b) - F(a).'));
    s.push(table('Primitives à connaître', ['f(x)', 'F(x) (primitive)'], [
      ['x^n', 'x^(n+1) / (n+1)'],
      ['1/x', 'ln|x|'],
      ['e^x', 'e^x'],
      ['cos(x)', 'sin(x)'],
      ['sin(x)', '-cos(x)'],
    ]));
    s.push(quiz('Quelle est la primitive de f(x) = 6x² ?', ['2x³ + C', '12x + C', '6x³ + C', '3x³ + C'], 0, 'Primitive de 6x² = 6 × x³/3 = 2x³ + C (la constante C est la constante d\'intégration).'));
    s.push(concept('Le théorème fondamental de l\'analyse relie dérivation et intégration. Si F(x) = intégrale de a à x de f(t)dt, alors F\'(x) = f(x). C\'est le pont entre le local (dérivée) et le global (intégrale), l\'une des plus belles idées des mathématiques.'));
    return s;
  }},
]); }

function generateTerminaleMathsProba() { return generateMathLevel('Terminale Proba', [
  { title: 'Probabilités Conditionnelles', subtitle: 'Sachant que…', content: () => {
    const s = [];
    s.push(concept('La probabilité conditionnelle P(A|B) est la probabilité de A sachant que B est réalisé. Formule : P(A|B) = P(A ∩ B) / P(B). Exemple : dans une classe, 60% font du sport, 30% font du sport ET de la musique. Si un élève fait du sport, quelle est la probabilité qu\'il fasse aussi de la musique ? P = 0,3/0,6 = 0,5.'));
    s.push(concept('Un arbre de probabilité est un outil visuel puissant. Chaque branche représente un événement possible. On multiplie les probabilités le long des branches et on additionne pour des chemins différents. La formule des probabilités totales : P(A) = P(A|B)×P(B) + P(A|B̄)×P(B̄).'));
    s.push(quiz('P(A) = 0,4 et P(B|A) = 0,5. Combien vaut P(A ∩ B) ?', ['0,9', '0,2', '0,8', '1,25'], 1, 'P(A ∩ B) = P(B|A) × P(A) = 0,5 × 0,4 = 0,2'));
    return s;
  }},
  { title: 'Variables Aléatoires', subtitle: 'Espérance, variance et écart-type', content: () => {
    const s = [];
    s.push(concept('Une variable aléatoire X associe un nombre à chaque résultat d\'une expérience aléatoire. L\'espérance E(X) est la moyenne pondérée : E(X) = Σ x_i × P(X = x_i). C\'est la valeur "attendue" en moyenne sur un grand nombre de répétitions.'));
    s.push(concept('La variance V(X) = E(X²) - [E(X)]² mesure la dispersion autour de la moyenne. L\'écart-type σ = √V(X) est la racine de la variance, plus facile à interpréter car dans la même unité que X.'));
    s.push(quiz('Un jeu : on gagne 10€ avec proba 1/4, on perd 2€ avec proba 3/4. Quelle est l\'espérance de gain ?', ['1€', '2€', '4€', '8€'], 0, 'E = 10 × 1/4 + (-2) × 3/4 = 2,5 - 1,5 = 1€. En moyenne, on gagne 1€ par partie.'));
    return s;
  }},
  { title: 'Loi Binomiale', subtitle: 'Succès/échec répétés', content: () => {
    const s = [];
    s.push(concept('La loi binomiale B(n, p) modélise le nombre de succès dans n épreuves indépendantes, chacune avec probabilité p de succès. Exemple : lancer 10 fois une pièce, compter le nombre de face. P(X = k) = C(n,k) × p^k × (1-p)^(n-k).'));
    s.push(concept('Pour B(n, p) : E(X) = np et V(X) = np(1-p). Si n = 100 lancers de pièce (p = 0,5) : E = 50, σ = √25 = 5. On s\'attend à environ 50 faces, à ±5 près.'));
    s.push(quiz('On lance un dé 60 fois. Combien de 6 attend-on en moyenne ?', ['6', '10', '12', '30'], 1, 'E = np = 60 × 1/6 = 10. On s\'attend à obtenir 10 fois le chiffre 6.'));
    return s;
  }},
  { title: 'Loi Normale', subtitle: 'La courbe en cloche', content: () => {
    const s = [];
    s.push(concept('La loi normale N(μ, σ²) est la distribution en cloche. Elle est symétrique autour de la moyenne μ. 68% des valeurs sont dans [μ-σ, μ+σ], 95% dans [μ-2σ, μ+2σ], 99,7% dans [μ-3σ, μ+3σ]. C\'est la règle 68-95-99,7.'));
    s.push(concept('Quand n est grand, la loi binomiale B(n,p) peut être approchée par une loi normale N(np, np(1-p)). C\'est le théorème central limite : la somme de beaucoup de variables aléatoires indépendantes suit approximativement une loi normale.'));
    s.push(quiz('Pour une loi N(100, 25) (donc σ = 5), quel pourcentage de valeurs est entre 90 et 110 ?', ['68%', '95%', '99,7%', '50%'], 1, '90 = 100 - 2×5 et 110 = 100 + 2×5, donc on est à ±2σ. Environ 95% des valeurs.'));
    return s;
  }},
  { title: 'Estimation et Intervalles de Confiance', subtitle: 'De l\'échantillon à la population', content: () => {
    const s = [];
    s.push(concept('Un sondage interroge n personnes. La fréquence observée f est une estimation de la proportion p dans la population. L\'intervalle de confiance à 95% est [f - 1/√n, f + 1/√n]. Plus l\'échantillon est grand, plus l\'intervalle est étroit.'));
    s.push(quiz('Un sondage sur 400 personnes donne 52% de "oui". Quel est l\'intervalle de confiance à 95% ?', ['[47% ; 57%]', ['[50% ; 54%]', '[42% ; 62%]', '[51% ; 53%]']], 0, 'Marge = 1/√400 = 1/20 = 5%. IC = [52% - 5% ; 52% + 5%] = [47% ; 57%].'));
    s.push(concept('Bravo ! Tu maîtrises les probabilités conditionnelles, les lois binomiale et normale, et l\'estimation statistique. Ces outils sont utilisés partout : médecine, finance, intelligence artificielle, sondages !'));
    return s;
  }},
]); }

function generateTerminalePhysique() { return generateMathLevel('Terminale Physique', [
  { title: 'Mécanique Newtonienne', subtitle: 'Les trois lois de Newton', content: () => {
    const s = [];
    s.push(concept('Première loi (inertie) : un objet reste au repos ou en mouvement rectiligne uniforme si aucune force ne s\'exerce sur lui. C\'est pour ça qu\'on porte la ceinture de sécurité : quand la voiture freine, notre corps continue tout droit !'));
    s.push(concept('Deuxième loi : F = m × a. La force (en newtons) = masse (en kg) × accélération (en m/s²). Plus la masse est grande, plus il faut de force pour accélérer. C\'est pourquoi un camion met plus de temps à accélérer qu\'une voiture.'));
    s.push(concept('Troisième loi : action = réaction. Si tu pousses un mur, le mur te pousse avec la même force en sens inverse. C\'est grâce à cette loi que les fusées fonctionnent : elles expulsent du gaz vers le bas, et la réaction les propulse vers le haut.'));
    s.push(quiz('Quelle force faut-il pour accélérer un objet de 5 kg à 3 m/s² ?', ['8 N', '15 N', '1,67 N', '2 N'], 1, 'F = m × a = 5 × 3 = 15 N.'));
    return s;
  }},
  { title: 'Énergie', subtitle: 'Conservation et transformation', content: () => {
    const s = [];
    s.push(concept('L\'énergie cinétique est l\'énergie du mouvement : Ec = ½mv². Un objet de 1 kg à 10 m/s a Ec = ½ × 1 × 100 = 50 J. Attention : si la vitesse double, l\'énergie cinétique quadruple ! C\'est pourquoi les accidents à haute vitesse sont si dangereux.'));
    s.push(concept('L\'énergie potentielle de pesanteur : Ep = mgh (masse × gravité × hauteur). Un objet de 2 kg à 5 m de haut : Ep = 2 × 9,8 × 5 = 98 J. Quand il tombe, son Ep se transforme en Ec : c\'est la conservation de l\'énergie mécanique.'));
    s.push(quiz('Un objet de 3 kg tombe de 10 m. Quelle est sa vitesse juste avant le sol ? (g = 10 m/s²)', ['~10 m/s', '~14 m/s', '~17 m/s', '~30 m/s'], 1, 'mgh = ½mv² → v = √(2gh) = √(2×10×10) = √200 ≈ 14,1 m/s'));
    return s;
  }},
  { title: 'Ondes et Signal', subtitle: 'Son, lumière et ondes mécaniques', content: () => {
    const s = [];
    s.push(concept('Une onde est une perturbation qui se propage. Le son est une onde mécanique (il a besoin d\'un milieu). La lumière est une onde électromagnétique (elle se propage dans le vide). Vitesse du son ≈ 340 m/s dans l\'air. Vitesse de la lumière = 3 × 10⁸ m/s.'));
    s.push(concept('La longueur d\'onde λ, la fréquence f et la vitesse v sont liées : v = λ × f. La lumière visible va de 400 nm (violet) à 700 nm (rouge). Le son audible va de 20 Hz à 20 000 Hz.'));
    s.push(quiz('Un son de 680 Hz se propage à 340 m/s. Quelle est sa longueur d\'onde ?', ['0,5 m', '1 m', '2 m', '340 m'], 0, 'λ = v/f = 340/680 = 0,5 m.'));
    return s;
  }},
  { title: 'Physique Nucléaire', subtitle: 'Radioactivité et énergie nucléaire', content: () => {
    const s = [];
    s.push(concept('Le noyau atomique est composé de protons (charge +) et de neutrons (neutre). Les noyaux instables se désintègrent spontanément : c\'est la radioactivité. Il existe 3 types : alpha (émission de noyau d\'hélium), bêta (émission d\'électron), gamma (émission de photon).'));
    s.push(concept('La demi-vie t½ est le temps pour que la moitié des noyaux radioactifs se désintègrent. Pour le carbone-14 : t½ = 5 730 ans (utilisé en datation). Pour l\'uranium-238 : t½ = 4,5 milliards d\'années. Pour le radon-222 : t½ = 3,8 jours.'));
    s.push(concept('E = mc² (Einstein, 1905). L\'énergie et la masse sont équivalentes. Dans les réactions nucléaires, une infime perte de masse se convertit en énorme quantité d\'énergie. La fission d\'1 kg d\'uranium-235 libère l\'équivalent de 20 000 tonnes de TNT !'));
    s.push(quiz('Après 3 demi-vies, quelle fraction de noyaux radioactifs reste-t-il ?', ['1/3', '1/4', '1/8', '1/16'], 2, 'Après 1 t½ : 1/2. Après 2 t½ : 1/4. Après 3 t½ : 1/8.'));
    return s;
  }},
  { title: 'Optique', subtitle: 'Lentilles, images et instruments', content: () => {
    const s = [];
    s.push(concept('Une lentille convergente concentre la lumière en un point : le foyer. La relation de conjugaison : 1/OA\' - 1/OA = 1/f\'. Le grandissement γ = OA\'/OA donne la taille de l\'image. Si |γ| > 1, l\'image est agrandie.'));
    s.push(quiz('Un objet est placé à 30 cm d\'une lentille de focale 10 cm. Où se forme l\'image ?', ['15 cm', '20 cm', '10 cm', '30 cm'], 0, '1/OA\' = 1/f + 1/OA = 1/10 + 1/(-30) = 3/30 - 1/30 = 2/30 → OA\' = 15 cm.'));
    return s;
  }},
  { title: 'Quiz Final Physique Terminale', subtitle: 'Le défi ultime !', content: () => {
    const s = [];
    s.push(quiz('Quelle est la troisième loi de Newton ?', ['F = ma', 'Principe d\'inertie', 'Action = Réaction', 'E = mc²'], 2, 'La 3ème loi de Newton : à toute action correspond une réaction égale et opposée.'));
    s.push(quiz('La vitesse de la lumière dans le vide est environ…', ['340 m/s', '3 × 10⁶ m/s', '3 × 10⁸ m/s', '3 × 10¹⁰ m/s'], 2, 'c ≈ 3 × 10⁸ m/s = 300 000 km/s. C\'est la vitesse maximale dans l\'univers.'));
    s.push(concept('Impressionnant ! Tu maîtrises la mécanique, l\'énergie, les ondes, le nucléaire et l\'optique. Tu es prêt pour les études supérieures en sciences !'));
    return s;
  }},
]); }

function generateTerminalePhilo() { return generateMathLevel('Terminale Philo', [
  { title: 'La Conscience', subtitle: 'Que signifie "je pense" ?', content: () => {
    const s = [];
    s.push(concept('Descartes dit "Je pense, donc je suis" (Cogito ergo sum). Même si tout est illusion, le fait même de douter prouve que j\'existe comme être pensant. La conscience est cette capacité de se savoir existant, de réfléchir sur soi-même.'));
    s.push(concept('Freud distingue trois instances de l\'appareil psychique : le Ça (pulsions inconscientes), le Moi (interface avec la réalité) et le Surmoi (conscience morale intériorisée). L\'inconscient influence nos actes sans que nous en ayons conscience.'));
    s.push(quiz('Qui a formulé le "Cogito ergo sum" ?', ['Platon', 'Descartes', 'Kant', 'Nietzsche'], 1, 'René Descartes a formulé le Cogito dans ses Méditations métaphysiques (1641).'));
    return s;
  }},
  { title: 'La Liberté', subtitle: 'Sommes-nous vraiment libres ?', content: () => {
    const s = [];
    s.push(concept('Sartre affirme que "l\'existence précède l\'essence" : nous ne sommes pas définis à l\'avance, nous nous construisons par nos choix. L\'homme est "condamné à être libre" — même ne pas choisir, c\'est un choix. C\'est l\'existentialisme.'));
    s.push(concept('Le déterminisme soutient que tout est causé par des événements antérieurs. Spinoza dit que nous nous croyons libres parce que nous ignorons les causes qui nous font agir. La vraie liberté serait de comprendre la nécessité.'));
    s.push(comparison('Liberté vs Déterminisme', 'Sartre (Liberté)', ['L\'homme se définit par ses actes', 'Nous sommes responsables de nos choix', 'Pas de nature humaine prédéfinie'], 'Spinoza (Déterminisme)', ['Tout a une cause', '"Liberté" = illusion de l\'ignorance', 'Liberté = comprendre la nécessité']));
    s.push(quiz('Pour Sartre, l\'homme est…', ['Défini par sa nature', 'Condamné à être libre', 'Déterminé par la société', 'Incapable de choisir'], 1, 'Sartre dit que l\'homme est "condamné à être libre" : il ne peut pas échapper à sa liberté de choisir.'));
    return s;
  }},
  { title: 'La Vérité', subtitle: 'Peut-on atteindre la vérité ?', content: () => {
    const s = [];
    s.push(concept('Pour Platon, la vérité est dans le monde des Idées, au-delà des apparences. L\'allégorie de la caverne montre des prisonniers qui prennent les ombres pour la réalité. Le philosophe est celui qui sort de la caverne et voit le soleil (la vérité).'));
    s.push(concept('Le scepticisme doute de la possibilité d\'atteindre la vérité absolue. Montaigne : "Que sais-je ?" Le relativisme va plus loin : il n\'y a pas de vérité universelle, seulement des points de vue. Mais si tout est relatif, cette affirmation elle-même est-elle relative ?'));
    s.push(quiz('Dans l\'allégorie de la caverne de Platon, que représente le soleil ?', ['Le pouvoir politique', 'La vérité / le Bien', 'La religion', 'La science'], 1, 'Le soleil représente l\'Idée du Bien, la vérité ultime que le philosophe cherche à atteindre.'));
    return s;
  }},
  { title: 'La Justice et le Droit', subtitle: 'Le juste et le légal', content: () => {
    const s = [];
    s.push(concept('Platon et Aristote distinguent le juste naturel (universel) et le juste légal (qui varie selon les sociétés). Antigone désobéit à la loi de Créon pour enterrer son frère, au nom d\'une justice supérieure. Le légal n\'est pas toujours le juste.'));
    s.push(concept('John Rawls propose le "voile d\'ignorance" : pour définir une société juste, imagine que tu ne sais pas quelle place tu y occuperas. Quelles règles choisirais-tu ? Rawls en déduit deux principes : égalité des libertés et réduction des inégalités au profit des plus défavorisés.'));
    s.push(quiz('Qu\'est-ce que le "voile d\'ignorance" de Rawls ?', ['Un concept religieux', 'Une expérience de pensée pour définir la justice', 'Un argument contre la démocratie', 'Une théorie scientifique'], 1, 'Le voile d\'ignorance est une expérience de pensée : si tu ignores ta place dans la société, quelles règles justes choisirais-tu ?'));
    return s;
  }},
  { title: 'L\'Art et le Beau', subtitle: 'Qu\'est-ce que le beau ?', content: () => {
    const s = [];
    s.push(concept('Kant distingue le beau (désintéressé, universel) de l\'agréable (subjectif, lié au plaisir). Le jugement esthétique est un jugement de goût qui prétend à l\'universalité sans pouvoir se prouver. "C\'est beau" n\'est pas "j\'aime ça".'));
    s.push(concept('Hegel voit l\'art comme une manifestation de l\'Esprit absolu. L\'art rend visible l\'invisible, exprime des vérités que la raison seule ne peut atteindre. Mais pour Hegel, l\'art est dépassé par la religion puis par la philosophie.'));
    s.push(quiz('Pour Kant, le jugement esthétique est…', ['Purement subjectif', 'Désintéressé et prétend à l\'universalité', 'Objectif et mesurable', 'Impossible'], 1, 'Pour Kant, le beau est un jugement désintéressé qui prétend à l\'universalité, sans être démontrable.'));
    return s;
  }},
  { title: 'Quiz Final Philosophie', subtitle: 'Le grand questionnement !', content: () => {
    const s = [];
    s.push(quiz('Quel philosophe a écrit "L\'homme est condamné à être libre" ?', ['Descartes', 'Platon', 'Sartre', 'Spinoza'], 2, 'Jean-Paul Sartre, dans L\'existentialisme est un humanisme (1946).'));
    s.push(quiz('L\'allégorie de la caverne est de…', ['Aristote', 'Socrate', 'Platon', 'Descartes'], 2, 'L\'allégorie de la caverne est dans La République de Platon (livre VII).'));
    s.push(concept('Bravo ! La philosophie t\'apprend à questionner, argumenter et penser par toi-même. Ces compétences te serviront toute ta vie, quel que soit ton parcours !'));
    return s;
  }},
]); }

// ── PCSI generators ───────────────────────────────────────────────────

function generatePCSIAnalyse() { return generateMathLevel('PCSI Analyse', [
  { title: 'Suites Réelles', subtitle: 'Convergence, suites adjacentes et suites récurrentes', content: () => {
    const s = [];
    s.push(concept('Une suite (u_n) converge vers L si pour tout ε > 0, il existe N tel que pour tout n ≥ N, |u_n - L| < ε. En prépa, on manipule cette définition formelle pour démontrer rigoureusement la convergence.'));
    s.push(concept('Théorème des suites monotones bornées : toute suite croissante majorée converge, toute suite décroissante minorée converge. C\'est un outil fondamental. Exemple : u₀ = 1, u_{n+1} = √(2 + u_n). On montre que (u_n) est croissante et majorée par 2, donc elle converge.'));
    s.push(concept('Pour trouver la limite d\'une suite récurrente u_{n+1} = f(u_n), on résout l = f(l). Si u_n → l, alors l = √(2 + l), donc l² = 2 + l, l² - l - 2 = 0, (l-2)(l+1) = 0. Comme u_n > 0, la limite est 2.'));
    s.push(quiz('Si u_n = (1 + 1/n)^n, vers quoi converge u_n ?', ['1', '2', 'e ≈ 2,718', '∞'], 2, 'C\'est la définition historique du nombre e ! lim(1 + 1/n)^n = e ≈ 2,71828.'));
    return s;
  }},
  { title: 'Séries Numériques', subtitle: 'Convergence et séries classiques', content: () => {
    const s = [];
    s.push(concept('Une série Σu_n est la somme des termes d\'une suite. La série converge si la suite des sommes partielles S_n = u_0 + u_1 + … + u_n converge. Condition nécessaire : u_n → 0 (mais pas suffisante ! La série harmonique Σ1/n diverge).'));
    s.push(concept('Séries de référence : Σ1/n² converge (= π²/6, résultat d\'Euler). Σ1/n diverge. Σq^n converge si |q| < 1 (somme = 1/(1-q)). Les séries de Riemann Σ1/n^α convergent si et seulement si α > 1.'));
    s.push(quiz('La série Σ1/n^(3/2) converge-t-elle ?', ['Oui', 'Non', 'Dépend des termes', 'On ne peut pas savoir'], 0, 'C\'est une série de Riemann avec α = 3/2 > 1, donc elle converge.'));
    s.push(concept('Critère de d\'Alembert : si |u_{n+1}/u_n| → l, alors la série converge si l < 1, diverge si l > 1. Critère de comparaison : si 0 ≤ u_n ≤ v_n et Σv_n converge, alors Σu_n converge.'));
    return s;
  }},
  { title: 'Fonctions Continues', subtitle: 'Théorème des valeurs intermédiaires', content: () => {
    const s = [];
    s.push(concept('Une fonction f est continue en a si lim(x→a) f(x) = f(a). Intuitivement, on peut tracer la courbe sans lever le crayon. Les polynômes, exponentielles, trigonométriques sont continues sur leur domaine de définition.'));
    s.push(concept('Théorème des valeurs intermédiaires (TVI) : si f est continue sur [a,b] et que f(a) × f(b) < 0, alors il existe c dans ]a,b[ tel que f(c) = 0. C\'est un théorème d\'existence de racines, fondamental en analyse.'));
    s.push(quiz('f(x) = x³ - x - 1. f(1) = -1 et f(2) = 5. Par le TVI…', ['f a une racine dans [1,2]', 'f n\'a pas de racine', 'f(1,5) = 0', 'On ne peut rien conclure'], 0, 'f(1) < 0 et f(2) > 0, f continue → par le TVI, il existe c ∈ ]1,2[ tel que f(c) = 0.'));
    return s;
  }},
  { title: 'Dérivabilité', subtitle: 'Formule de Taylor et développements limités', content: () => {
    const s = [];
    s.push(concept('Le développement limité de f en a à l\'ordre n est : f(x) = f(a) + f\'(a)(x-a) + f\'\'(a)(x-a)²/2! + … + f^(n)(a)(x-a)^n/n! + o((x-a)^n). C\'est l\'approximation polynomiale la plus précise de f au voisinage de a.'));
    s.push(concept('DL classiques en 0 : e^x = 1 + x + x²/2 + x³/6 + … sin(x) = x - x³/6 + x⁵/120 - … cos(x) = 1 - x²/2 + x⁴/24 - … 1/(1-x) = 1 + x + x² + x³ + … ln(1+x) = x - x²/2 + x³/3 - …'));
    s.push(quiz('Quel est le DL de e^x à l\'ordre 2 en 0 ?', ['1 + x', '1 + x + x²', '1 + x + x²/2', 'x + x²/2'], 2, 'e^x = 1 + x + x²/2! = 1 + x + x²/2 + o(x²).'));
    return s;
  }},
  { title: 'Intégration', subtitle: 'Intégrales impropres et convergence', content: () => {
    const s = [];
    s.push(concept('Une intégrale impropre est une intégrale sur un intervalle non borné ou avec une fonction non bornée. L\'intégrale de 1 à ∞ de 1/x² dx converge (= 1). L\'intégrale de 1 à ∞ de 1/x dx diverge. C\'est l\'analogue continu des séries de Riemann.'));
    s.push(concept('Intégration par parties : ∫u dv = uv - ∫v du. Changement de variable : ∫f(g(x))g\'(x)dx = ∫f(t)dt avec t = g(x). Ces deux techniques sont les outils de base du calcul intégral en prépa.'));
    s.push(quiz('L\'intégrale de 1 à ∞ de 1/x^α dx converge si…', ['α > 0', 'α > 1', 'α ≥ 1', 'α > 2'], 1, 'Comme pour les séries de Riemann, l\'intégrale converge si et seulement si α > 1.'));
    return s;
  }},
  { title: 'Équations Différentielles', subtitle: 'Résolution et modélisation', content: () => {
    const s = [];
    s.push(concept('Une équation différentielle relie une fonction y et ses dérivées. Ordre 1 linéaire : y\' + a(x)y = b(x). Solution homogène : y_h = C × e^(-A(x)) où A est une primitive de a. Solution particulière par variation de la constante.'));
    s.push(concept('Ordre 2 à coefficients constants : y\'\' + ay\' + by = 0. On résout l\'équation caractéristique r² + ar + b = 0. Si Δ > 0 : y = Ae^(r₁x) + Be^(r₂x). Si Δ = 0 : y = (A + Bx)e^(r₀x). Si Δ < 0 : y = e^(αx)(A cos(βx) + B sin(βx)).'));
    s.push(quiz('Résoudre y\' = 3y (solution générale)', ['y = 3x + C', 'y = Ce^(3x)', 'y = C × 3^x', 'y = e^(3x) + C'], 1, 'y\' = 3y est une ED linéaire d\'ordre 1. Solution : y = Ce^(3x) où C est une constante.'));
    return s;
  }},
  { title: 'Séries Entières', subtitle: 'Rayon de convergence et fonctions développables', content: () => {
    const s = [];
    s.push(concept('Une série entière Σa_n x^n a un rayon de convergence R : elle converge absolument pour |x| < R et diverge pour |x| > R. R = 1/lim|a_{n+1}/a_n| (règle de d\'Alembert) ou R = 1/lim|a_n|^(1/n) (Cauchy-Hadamard).'));
    s.push(concept('Les fonctions e^x, sin(x), cos(x), 1/(1-x) sont développables en séries entières. On peut dériver et intégrer terme à terme à l\'intérieur du disque de convergence. C\'est un outil très puissant en analyse.'));
    s.push(quiz('Quel est le rayon de convergence de Σx^n/n! ?', ['1', '∞', '0', 'e'], 1, 'C\'est la série de e^x ! R = lim n!/(n+1)! = lim 1/(n+1) = ∞. Elle converge pour tout x réel.'));
    return s;
  }},
  { title: 'Quiz Final PCSI Analyse', subtitle: 'Le défi de la prépa !', content: () => {
    const s = [];
    s.push(quiz('La série Σ(-1)^n/n converge-t-elle ?', ['Oui (critère de Leibniz)', 'Non (car Σ1/n diverge)', 'Oui (car 1/n → 0)', 'On ne sait pas'], 0, 'C\'est une série alternée décroissante tendant vers 0 : elle converge par le critère de Leibniz. Mais attention, elle ne converge pas absolument.'));
    s.push(quiz('Le DL de sin(x)/x en 0 à l\'ordre 2 est…', ['1', '1 - x²/6', '1 - x²/2', 'x - x³/6'], 1, 'sin(x) = x - x³/6 + o(x³). Donc sin(x)/x = 1 - x²/6 + o(x²).'));
    s.push(concept('Félicitations ! Tu as parcouru tout le programme d\'analyse de PCSI. De la convergence des suites aux séries entières en passant par les équations différentielles, tu as les outils pour aborder les concours !'));
    return s;
  }},
]); }

function generatePCSIAlgebre() { return generateMathLevel('PCSI Algèbre', [
  { title: 'Espaces Vectoriels', subtitle: 'Définitions et sous-espaces', content: () => {
    const s = [];
    s.push(concept('Un espace vectoriel E sur ℝ est un ensemble muni de deux opérations (addition et multiplication par un scalaire) vérifiant 8 axiomes. ℝ², ℝ³, ℝ^n, l\'espace des polynômes, l\'espace des fonctions continues sont tous des espaces vectoriels.'));
    s.push(concept('Un sous-espace vectoriel F de E doit contenir le vecteur nul et être stable par combinaison linéaire : si u, v ∈ F et λ, μ ∈ ℝ, alors λu + μv ∈ F. Exemple : le plan z = 0 dans ℝ³ est un sous-espace, mais le plan z = 1 n\'en est pas un (il ne contient pas le vecteur nul).'));
    s.push(quiz('L\'ensemble des fonctions paires (f(-x) = f(x)) est-il un sous-espace vectoriel ?', ['Oui', 'Non', 'Seulement si f(0) = 0', 'Dépend de la fonction'], 0, 'Oui ! La fonction nulle est paire, et la somme de deux fonctions paires est paire. La stabilité par multiplication scalaire est aussi vérifiée.'));
    return s;
  }},
  { title: 'Applications Linéaires', subtitle: 'Noyau, image et théorème du rang', content: () => {
    const s = [];
    s.push(concept('Une application linéaire f : E → F vérifie f(λu + μv) = λf(u) + μf(v). Le noyau Ker(f) = {u ∈ E | f(u) = 0} est un sous-espace de E. L\'image Im(f) = {f(u) | u ∈ E} est un sous-espace de F.'));
    s.push(concept('Théorème du rang : dim(E) = dim(Ker f) + dim(Im f). C\'est le théorème central de l\'algèbre linéaire. f est injective ⟺ Ker f = {0}. f est surjective ⟺ Im f = F. f est bijective ⟺ les deux.'));
    s.push(quiz('Si f : ℝ³ → ℝ² est linéaire et surjective, quelle est la dimension de Ker(f) ?', ['0', '1', '2', '3'], 1, 'Par le théorème du rang : 3 = dim(Ker f) + 2 (car f surjective → dim Im f = 2). Donc dim(Ker f) = 1.'));
    return s;
  }},
  { title: 'Matrices', subtitle: 'Calcul matriciel et systèmes linéaires', content: () => {
    const s = [];
    s.push(concept('Une matrice A de taille m×n représente une application linéaire de ℝ^n dans ℝ^m. Le produit matriciel AB correspond à la composition des applications linéaires. Attention : AB ≠ BA en général !'));
    s.push(concept('La matrice inverse A⁻¹ existe si et seulement si det(A) ≠ 0. Pour résoudre AX = B : X = A⁻¹B. Le pivot de Gauss permet de résoudre les systèmes et de calculer l\'inverse en échelonnant [A|I] → [I|A⁻¹].'));
    s.push(quiz('Si A est une matrice 3×3 avec det(A) = 0, que peut-on dire ?', ['A est inversible', 'AX = 0 a des solutions non nulles', 'A = 0', 'Rien'], 1, 'det(A) = 0 ⟹ A non inversible ⟹ Ker(A) ≠ {0} ⟹ AX = 0 a des solutions non triviales.'));
    return s;
  }},
  { title: 'Déterminants', subtitle: 'Calcul et propriétés', content: () => {
    const s = [];
    s.push(concept('Le déterminant d\'une matrice carrée est un scalaire qui indique si la matrice est inversible (det ≠ 0) ou non (det = 0). Pour une matrice 2×2 : det = ad - bc. Pour les plus grandes, on développe selon une ligne ou colonne.'));
    s.push(concept('Propriétés : det(AB) = det(A)×det(B). det(A^T) = det(A). Si on échange deux lignes, le déterminant change de signe. Si une ligne est multiple d\'une autre, det = 0. Le déterminant est multilinéaire et alterné.'));
    s.push(quiz('det(A) = 3, det(B) = -2. Combien vaut det(AB) ?', ['-6', '1', '5', '-5'], 0, 'det(AB) = det(A) × det(B) = 3 × (-2) = -6.'));
    return s;
  }},
  { title: 'Diagonalisation', subtitle: 'Valeurs propres et vecteurs propres', content: () => {
    const s = [];
    s.push(concept('Un vecteur propre v de A vérifie Av = λv : l\'application linéaire ne fait que dilater v d\'un facteur λ (valeur propre). Les valeurs propres sont les racines du polynôme caractéristique det(A - λI) = 0.'));
    s.push(concept('A est diagonalisable s\'il existe une base de vecteurs propres. Dans ce cas A = PDP⁻¹ où D est diagonale (valeurs propres) et P la matrice de passage. Intérêt : A^n = PD^nP⁻¹, ce qui simplifie énormément le calcul de puissances.'));
    s.push(quiz('Combien de valeurs propres (comptées avec multiplicité) a une matrice 3×3 ?', ['1', '2', '3', 'Ça dépend'], 2, 'Le polynôme caractéristique est de degré 3, donc il a exactement 3 racines (comptées avec multiplicité, dans ℂ).'));
    return s;
  }},
  { title: 'Produit Scalaire', subtitle: 'Orthogonalité et projection', content: () => {
    const s = [];
    s.push(concept('Le produit scalaire ⟨u,v⟩ = Σu_i×v_i généralise la notion d\'angle et de distance. La norme ||u|| = √⟨u,u⟩. Deux vecteurs sont orthogonaux si ⟨u,v⟩ = 0. L\'inégalité de Cauchy-Schwarz : |⟨u,v⟩| ≤ ||u|| × ||v||.'));
    s.push(concept('Le procédé de Gram-Schmidt transforme une base quelconque en base orthonormée. C\'est fondamental pour les projections orthogonales. La projection de v sur un sous-espace F minimise la distance de v à F.'));
    s.push(quiz('Si u = (1,2,3) et v = (2,-1,0), combien vaut ⟨u,v⟩ ?', ['0', '1', '-1', '5'], 0, '⟨u,v⟩ = 1×2 + 2×(-1) + 3×0 = 2 - 2 + 0 = 0. Les vecteurs sont orthogonaux !'));
    return s;
  }},
  { title: 'Réduction des Endomorphismes', subtitle: 'Jordan et Cayley-Hamilton', content: () => {
    const s = [];
    s.push(concept('Le théorème de Cayley-Hamilton : toute matrice annule son propre polynôme caractéristique. Si χ_A(λ) = λ² - 5λ + 6, alors A² - 5A + 6I = 0. C\'est un résultat puissant pour calculer A^n ou exprimer A⁻¹.'));
    s.push(concept('Si A n\'est pas diagonalisable, on peut la réduire sous forme de Jordan : des blocs diagonaux avec des 1 sur la sur-diagonale. C\'est la forme la plus simple possible dans ℂ. En PCSI, on se limite souvent au cas 2×2.'));
    s.push(quiz('Si A² - 3A + 2I = 0, on peut exprimer A⁻¹ comme…', ['A - 3I', '(3A - A²)/2', '(3I - A)/2', '3A - 2I'], 2, 'A² - 3A + 2I = 0 → 2I = 3A - A² = A(3I - A) → I = A(3I-A)/2 → A⁻¹ = (3I-A)/2.'));
    return s;
  }},
  { title: 'Quiz Final PCSI Algèbre', subtitle: 'Le challenge !', content: () => {
    const s = [];
    s.push(quiz('dim(Ker f) + dim(Im f) = ?', ['dim(E)', 'dim(F)', 'dim(E) + dim(F)', 'dim(E) × dim(F)'], 0, 'C\'est le théorème du rang : dim(Ker f) + dim(Im f) = dim(E), l\'espace de départ.'));
    s.push(concept('Bravo ! L\'algèbre linéaire de PCSI est le socle de toutes les mathématiques appliquées : physique quantique, machine learning, traitement du signal, finance quantitative. Tu as les bases pour tout ça !'));
    return s;
  }},
]); }

function generatePCSIMecanique() { return generateMathLevel('PCSI Mécanique', [
  { title: 'Cinématique', subtitle: 'Position, vitesse, accélération', content: () => {
    const s = [];
    s.push(concept('La cinématique décrit le mouvement sans s\'occuper des forces. Le vecteur position r(t), le vecteur vitesse v = dr/dt et le vecteur accélération a = dv/dt = d²r/dt². En coordonnées cartésiennes, polaires ou cylindriques selon la symétrie du problème.'));
    s.push(concept('Mouvement circulaire : en coordonnées polaires, r = R (constant). La vitesse v = Rθ̇ est tangentielle. L\'accélération a deux composantes : tangentielle a_t = Rθ̈ et centripète a_c = Rθ̇² = v²/R dirigée vers le centre.'));
    s.push(quiz('Un objet tourne à v = 10 m/s sur un cercle de rayon 5 m. Son accélération centripète vaut…', ['2 m/s²', '20 m/s²', '50 m/s²', '10 m/s²'], 1, 'a_c = v²/R = 100/5 = 20 m/s², dirigée vers le centre du cercle.'));
    return s;
  }},
  { title: 'Dynamique du Point', subtitle: 'Forces et principe fondamental', content: () => {
    const s = [];
    s.push(concept('Le principe fondamental de la dynamique (PFD) : Σ F_ext = m × a dans un référentiel galiléen. C\'est la loi de Newton appliquée. Les forces courantes : poids P = mg, réaction normale N, frottements f, tension T, forces élastiques F = -kx.'));
    s.push(concept('En cas de frottements solides : F_f ≤ μ_s × N (statique), F_f = μ_d × N (dynamique). Le coefficient de frottement μ dépend des surfaces en contact. Pour un plan incliné : la composante du poids parallèle au plan = mg sin(α).'));
    s.push(quiz('Un objet de 2 kg sur un plan incliné à 30° (g = 10 m/s²). Quelle est la composante du poids parallèle au plan ?', ['10 N', '17,3 N', '20 N', '5 N'], 0, 'F = mg sin(30°) = 2 × 10 × 0,5 = 10 N.'));
    return s;
  }},
  { title: 'Énergie Mécanique', subtitle: 'Travail, énergie et conservation', content: () => {
    const s = [];
    s.push(concept('Le travail d\'une force : W = ∫F·dr. Pour une force constante : W = F·d·cos(θ). Le théorème de l\'énergie cinétique : ΔEc = W_total. L\'énergie potentielle : Ep = -W_conservative. L\'énergie mécanique Em = Ec + Ep est conservée si les forces sont conservatives.'));
    s.push(concept('L\'énergie potentielle élastique : Ep = ½kx². L\'énergie potentielle gravitationnelle : Ep = mgh (champ uniforme) ou Ep = -GMm/r (champ newtonien). Le puits de potentiel permet de visualiser les positions d\'équilibre.'));
    s.push(quiz('Un ressort de raideur k = 200 N/m est comprimé de 10 cm. L\'énergie potentielle stockée vaut…', ['1 J', '2 J', '10 J', '20 J'], 0, 'Ep = ½ × 200 × 0,1² = ½ × 200 × 0,01 = 1 J.'));
    return s;
  }},
  { title: 'Oscillations', subtitle: 'Oscillateur harmonique et amorti', content: () => {
    const s = [];
    s.push(concept('L\'oscillateur harmonique : mẍ + kx = 0, solution x(t) = A cos(ω₀t + φ) avec ω₀ = √(k/m). La période T = 2π/ω₀. C\'est le modèle fondamental des vibrations : ressort, pendule petit angle, circuit LC.'));
    s.push(concept('Avec amortissement : mẍ + λẋ + kx = 0. Trois régimes : sous-amorti (oscillations décroissantes), critique (retour le plus rapide sans oscillation), sur-amorti (retour lent). Le facteur de qualité Q = mω₀/λ mesure la "pureté" de l\'oscillation.'));
    s.push(quiz('Un pendule de longueur 1 m. Sa période vaut… (g = 10 m/s²)', ['≈ 1 s', '≈ 2 s', '≈ 3 s', '≈ 0,5 s'], 1, 'T = 2π√(L/g) = 2π√(1/10) = 2π × 0,316 ≈ 2 s.'));
    return s;
  }},
  { title: 'Mouvement Central', subtitle: 'Gravitation et lois de Kepler', content: () => {
    const s = [];
    s.push(concept('Un mouvement central est soumis à une force dirigée vers un point fixe. La gravitation F = -GMm/r² est l\'exemple principal. Le moment cinétique L = r × mv est conservé : la trajectoire est plane et vérifie la loi des aires (2ème loi de Kepler).'));
    s.push(concept('Les trajectoires keplériennes sont des coniques : ellipse (E < 0, orbite liée), parabole (E = 0), hyperbole (E > 0). La 3ème loi de Kepler : T² = 4π²a³/(GM) relie la période au demi-grand axe. Elle permet de mesurer la masse des étoiles !'));
    s.push(quiz('La 3ème loi de Kepler relie…', ['Force et accélération', 'Période et rayon orbital', 'Masse et vitesse', 'Énergie et température'], 1, 'T² ∝ a³ : le carré de la période est proportionnel au cube du demi-grand axe de l\'orbite.'));
    return s;
  }},
  { title: 'Référentiels Non Galiléens', subtitle: 'Forces d\'inertie et Coriolis', content: () => {
    const s = [];
    s.push(concept('Dans un référentiel non galiléen (tournant, accéléré), on ajoute des forces fictives. Force d\'inertie d\'entraînement : F_ie = -m × a_e. Force de Coriolis : F_cor = -2m × ω × v\'. La force de Coriolis dévie les masses en mouvement : vents, courants marins.'));
    s.push(quiz('La force de Coriolis est responsable de…', ['La chute des pommes', 'La rotation des cyclones', 'Les marées', 'Les tremblements de terre'], 1, 'La force de Coriolis dévie les masses d\'air et provoque la rotation des cyclones : sens antihoraire dans l\'hémisphère nord, horaire dans l\'hémisphère sud.'));
    return s;
  }},
  { title: 'Quiz Final PCSI Mécanique', subtitle: 'Le défi !', content: () => {
    const s = [];
    s.push(quiz('Pour un oscillateur harmonique, la pulsation propre ω₀ = …', ['√(m/k)', '√(k/m)', 'k/m', 'm/k'], 1, 'ω₀ = √(k/m) où k est la raideur et m la masse.'));
    s.push(concept('Excellent ! La mécanique du point de PCSI te donne les fondations pour la mécanique des solides, la mécanique quantique et la relativité. Tu es sur la bonne voie !'));
    return s;
  }},
]); }

function generatePCSIThermo() { return generateMathLevel('PCSI Thermo', [
  { title: 'Gaz Parfaits', subtitle: 'PV = nRT et transformations', content: () => {
    const s = [];
    s.push(concept('L\'équation d\'état du gaz parfait : PV = nRT. P = pression (Pa), V = volume (m³), n = quantité de matière (mol), R = 8,314 J/(mol·K), T = température absolue (K). C\'est un modèle idéal : molécules ponctuelles sans interactions.'));
    s.push(concept('Transformations : isotherme (T constante, PV = cte), isobare (P constante, V/T = cte), isochore (V constant, P/T = cte), adiabatique (pas d\'échange de chaleur, PV^γ = cte avec γ = Cp/Cv).'));
    s.push(quiz('Pour un gaz parfait, si on double le volume à température constante, la pression…', ['Double', 'Est divisée par 2', 'Reste la même', 'Est divisée par 4'], 1, 'Isotherme : PV = cte. Si V × 2, alors P / 2. C\'est la loi de Boyle-Mariotte.'));
    return s;
  }},
  { title: 'Premier Principe', subtitle: 'Conservation de l\'énergie', content: () => {
    const s = [];
    s.push(concept('Premier principe : ΔU = W + Q. La variation d\'énergie interne = travail reçu + chaleur reçue. L\'énergie se conserve toujours, elle ne fait que changer de forme. Pour un gaz parfait : U ne dépend que de T, donc ΔU = nCvΔT.'));
    s.push(concept('Le travail des forces de pression : W = -∫P dV. En compression (dV < 0), le travail reçu est positif. En détente (dV > 0), le système fournit du travail. Sur un diagramme P-V, le travail est l\'aire sous la courbe.'));
    s.push(quiz('Pour une transformation isochore (V = cte), le travail W vaut…', ['nRT', 'PΔV', '0', 'nCvΔT'], 2, 'Isochore : ΔV = 0, donc W = -∫PdV = 0. Toute l\'énergie échangée est de la chaleur : ΔU = Q.'));
    return s;
  }},
  { title: 'Second Principe', subtitle: 'Entropie et irréversibilité', content: () => {
    const s = [];
    s.push(concept('L\'entropie S mesure le "désordre" d\'un système. Second principe : ΔS ≥ Q/T. L\'entropie de l\'univers ne peut qu\'augmenter ou rester constante (ΔS_univers ≥ 0). L\'égalité n\'a lieu que pour les transformations réversibles.'));
    s.push(concept('L\'entropie d\'un gaz parfait : S = nCv ln(T) + nR ln(V) + cte. Pour une transformation adiabatique réversible : ΔS = 0 (isentropique). C\'est la transformation la plus "efficace" possible.'));
    s.push(quiz('Une transformation réversible est caractérisée par…', ['ΔS_univers > 0', 'ΔS_univers = 0', 'ΔS_système = 0', 'Q = 0'], 1, 'Pour une transformation réversible, l\'entropie de l\'univers (système + extérieur) ne varie pas : ΔS_univers = 0.'));
    return s;
  }},
  { title: 'Machines Thermiques', subtitle: 'Moteurs et réfrigérateurs', content: () => {
    const s = [];
    s.push(concept('Un moteur thermique convertit chaleur en travail. Il fonctionne entre une source chaude (T_c) et une source froide (T_f). Le rendement de Carnot η_max = 1 - T_f/T_c est le rendement maximal théorique. Aucun moteur réel ne peut faire mieux.'));
    s.push(concept('Le cycle de Carnot (2 isothermes + 2 adiabatiques) est le cycle idéal de rendement maximum. Cycles réels : Diesel (compression adiabatique + combustion isobare), Otto (compression et détente adiabatiques + combustion isochore).'));
    s.push(quiz('Un moteur fonctionne entre T_c = 600 K et T_f = 300 K. Son rendement de Carnot est…', ['25%', '50%', '75%', '100%'], 1, 'η = 1 - T_f/T_c = 1 - 300/600 = 1 - 0,5 = 50%. C\'est le maximum théorique.'));
    return s;
  }},
  { title: 'Changements de Phase', subtitle: 'Diagramme de phase et chaleur latente', content: () => {
    const s = [];
    s.push(concept('Le diagramme de phase (P,T) montre les domaines d\'existence de chaque phase (solide, liquide, gaz). Le point triple est le seul (P,T) où les trois phases coexistent. Le point critique marque la fin de la transition liquide-gaz.'));
    s.push(concept('La chaleur latente L est l\'énergie nécessaire pour changer de phase à température constante. Pour l\'eau : L_fusion = 334 kJ/kg, L_vaporisation = 2 260 kJ/kg. C\'est énorme ! C\'est pourquoi la vapeur d\'eau brûle plus qu\'un gaz chaud.'));
    s.push(quiz('Au point triple de l\'eau (T = 273,16 K, P = 611 Pa), on observe…', ['Seulement de la glace', 'Seulement de l\'eau liquide', 'Les trois phases en équilibre', 'De la vapeur seulement'], 2, 'Au point triple, solide, liquide et gaz coexistent en équilibre. C\'est unique !'));
    return s;
  }},
  { title: 'Quiz Final PCSI Thermo', subtitle: 'Dernier défi !', content: () => {
    const s = [];
    s.push(quiz('PV = nRT est l\'équation d\'état…', ['D\'un gaz réel', 'D\'un gaz parfait', 'D\'un liquide', 'D\'un solide'], 1, 'PV = nRT est l\'équation d\'état du gaz parfait, modèle idéal.'));
    s.push(quiz('Le rendement de Carnot dépend de…', ['La nature du gaz', 'Les températures des sources', 'La pression', 'Le volume'], 1, 'η_Carnot = 1 - T_f/T_c ne dépend QUE des températures des sources chaude et froide.'));
    s.push(concept('Bravo ! Tu maîtrises les gaz parfaits, les deux principes de la thermo, les machines thermiques et les changements de phase. La thermodynamique est partout : moteurs, climat, chimie, biologie !'));
    return s;
  }},
]); }

// ── Narration generator ──────────────────────────────────────────────

function generateNarration(slides, config) {
  return slides.map((slide, i) => {
    let text = '';
    switch (slide.type) {
      case 'chapter-intro':
        text = `Chapitre ${slide.chapter.partNumber}. ${slide.chapter.title}. ${slide.chapter.subtitle || ''}`;
        break;
      case 'bullets':
        text = `${slide.title}. ${(slide.items || []).join('. ')}`;
        break;
      case 'concept':
        text = slide.text || '';
        break;
      case 'table':
        text = `${slide.title}. ${(slide.rows || []).map(r => r.join(', ')).join('. ')}`;
        break;
      case 'quote':
        text = `Citation : ${slide.text}. ${slide.author || ''}`;
        break;
      case 'steps':
        text = `${slide.title}. ${(slide.items || []).join('. ')}`;
        break;
      case 'warning':
        text = `Attention ! ${slide.text}`;
        break;
      case 'tip':
        text = `Conseil : ${slide.text}`;
        break;
      case 'summary':
        text = `${slide.title || 'À retenir'}. ${(slide.items || []).join('. ')}`;
        break;
      case 'comparison':
        text = `${slide.title || 'Comparaison'}. D'un côté, ${slide.left?.label} : ${(slide.left?.items || []).join(', ')}. De l'autre, ${slide.right?.label} : ${(slide.right?.items || []).join(', ')}`;
        break;
      case 'quiz':
        text = `Petit quiz ! ${slide.question}. Les options sont : ${(slide.choices || []).map((c, j) => `${String.fromCharCode(65 + j)}, ${c}`).join('. ')}. Prenez un moment pour réfléchir. La bonne réponse est ${String.fromCharCode(65 + slide.correctIndex)}. ${slide.explanation || ''}`;
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

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  if (!seriesId || !SERIES[seriesId]) {
    console.error(`Unknown series: ${seriesId}`);
    console.error(`Available: ${Object.keys(SERIES).join(', ')}`);
    process.exit(1);
  }

  const series = SERIES[seriesId];
  audioPrefix = seriesId.replace(/-/g, '_');

  console.log(`\n📚 Generating kids content for: ${series.config.seriesTitle}`);
  console.log(`   Level: ${series.config.level} (${series.config.targetAge})`);
  console.log(`   Chapters: ${series.config.totalChapters}`);

  const slides = series.generator();
  const narration = generateNarration(slides, series.config);

  const eduData = {
    config: { ...series.config, seriesId },
    slides,
    audioDurations: {},
  };

  const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  await fs.writeJson(path.join(ROOT, 'public/edu-data.json'), eduData, { spaces: 2 });
  await fs.writeJson(path.join(ROOT, 'public/edu-narration.json'), narration, { spaces: 2 });

  const wordCount = narration.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
  const estMinutes = Math.round(wordCount / 150);

  console.log(`\n📝 Output files:`);
  console.log(`   public/edu-data.json (${slides.length} slides)`);
  console.log(`   public/edu-narration.json (${narration.length} segments)`);
  console.log(`   ~${wordCount} words → ~${estMinutes} min at 150 wpm`);
  console.log(`\n🎙️  Next: run generate-edu-tts.mjs to generate audio narration`);
}

main().catch(err => { console.error(err); process.exit(1); });
