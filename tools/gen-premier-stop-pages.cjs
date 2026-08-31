#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'series', 'premier-stop');

const chapters = [
  { n: 1, slug: 'ep1', short: 'La règle des 1-2 %', title: "La règle des 1-2 % : c'est le stop qui décide de la taille" },
  { n: 2, slug: 'ep2', short: 'Où placer le stop', title: 'Où placer le stop : structure, volatilité ou temps ?' },
  { n: 3, slug: 'ep3', short: 'Stop réel ou mental', title: 'Stop réel ou mental : choisir une protection qui existe vraiment' },
  { n: 4, slug: 'ep4', short: 'Le trou du gap', title: 'Le trou du gap : quand le marché saute votre stop' },
  { n: 5, slug: 'ep5', short: 'Déplacer son stop', title: 'Déplacer son stop sans étouffer un trade gagnant' },
  { n: 6, slug: 'ep6', short: 'Sortir gagnant', title: 'Sortir gagnant : cible, partiels ou trailing stop ?' },
];

const pages = {
  2: {
    description: "Un stop utile invalide une idée de trading. Méthode pratique pour choisir entre structure, volatilité et limite de temps sans adapter le niveau à la perte souhaitée.",
    intro: "Un stop n'est pas un chiffre rond ni un pourcentage confortable. C'est la frontière observable au-delà de laquelle le scénario d'achat ne tient plus. Cette frontière vient du graphique et du comportement normal du titre ; la taille de position vient ensuite.",
    badges: ['Structure', 'ATR', 'Bruit de marché', 'Invalidation'],
    sections: [
      ['La décision en une minute', `
        <p><strong>Règle par défaut :</strong> utilisez d'abord la structure qui justifie l'entrée. Ajoutez ensuite une marge liée à la volatilité pour éviter qu'une oscillation normale ne déclenche la sortie. Si aucune structure nette n'existe, il n'y a pas de niveau défendable et donc pas de trade.</p>
        <div class="step-grid">
          <div class="step-card"><div class="step-number">1</div><h4>Nommer le scénario</h4><p>Breakout, rebond sur support, reprise de moyenne ou pivot post-résultats.</p></div>
          <div class="step-card"><div class="step-number">2</div><h4>Trouver l'invalidation</h4><p>Le plus bas, le support ou la zone dont la rupture détruit précisément ce scénario.</p></div>
          <div class="step-card"><div class="step-number">3</div><h4>Mesurer le bruit</h4><p>Comparer la marge au range quotidien ou à l'ATR. Un stop dans le bruit est un faux filet.</p></div>
          <div class="step-card"><div class="step-number">4</div><h4>Calculer la taille</h4><p>Seulement maintenant : risque monétaire divisé par la distance entrée-stop.</p></div>
        </div>`],
      ['Trois familles de stops', `
        <div class="table-scroll"><table class="compare-table"><thead><tr><th>Méthode</th><th>Quand elle convient</th><th>Erreur fréquente</th><th>Invalidation</th></tr></thead><tbody>
          <tr><td><strong>Structure</strong></td><td>Support, pivot, base ou plus bas clairement lisible</td><td>Poser le stop exactement sur le niveau visible</td><td>Clôture ou passage sous la zone, selon le plan</td></tr>
          <tr><td><strong>Volatilité</strong></td><td>Titre nerveux sans niveau millimétré</td><td>Employer un multiple d'ATR sans thèse graphique</td><td>Mouvement anormal au-delà du bruit mesuré</td></tr>
          <tr><td><strong>Temps</strong></td><td>Catalyseur ou breakout qui doit fonctionner vite</td><td>Attendre indéfiniment parce que le prix ne baisse pas</td><td>Absence de confirmation après N séances</td></tr>
        </tbody></table></div>
        <div class="alert-box"><h4>Le pourcentage fixe n'est pas une quatrième méthode</h4><p>« Toujours 5 % sous l'entrée » ignore que deux titres peuvent avoir des volatilités très différentes. Le pourcentage sert à mesurer la distance obtenue, jamais à inventer l'invalidation.</p></div>`],
      ['Exemple contrôlé : même risque, géométries différentes', `
        <p>L'épisode 1 comparait deux plans publiés le 13 août 2026. Cleveland-Cliffs avait une distance entrée-stop de 7,9 %, Medtronic de 3,9 %. Avec une enveloppe identique de 50 $, le premier exigeait un ticket d'environ 625 $, le second d'environ 1 271 $. Le stop plus éloigné ne rendait pas CLF plus risqué : il imposait une position plus petite.</p>
        <div id="lesson-chart" class="echart-box" style="height:340px" role="img" aria-label="Comparaison de la distance au stop et du capital engagé pour CLF et MDT"></div>
        <p class="source-note">Exemple daté du 13 août 2026, repris de l'épisode 1. Il illustre le sizing ; il ne constitue pas un signal actuel.</p>`],
      ['Contrôle contradictoire', `
        <ul class="checklist">
          <li><i class="fa-solid fa-circle-xmark" style="color:#dc2626"></i><span><strong>Le niveau est-il trop évident ?</strong> Une marge sous la zone évite de confondre test du support et rupture.</span></li>
          <li><i class="fa-solid fa-circle-xmark" style="color:#dc2626"></i><span><strong>Le stop est-il si loin que le ratio rendement/risque disparaît ?</strong> Réduire la taille ne répare pas une cible insuffisante.</span></li>
          <li><i class="fa-solid fa-circle-xmark" style="color:#dc2626"></i><span><strong>Un événement peut-il rendre le niveau inutile ?</strong> Earnings, décision réglementaire ou biotech peuvent créer un gap au-delà du stop.</span></li>
          <li><i class="fa-solid fa-circle-check" style="color:#0e7490"></i><span><strong>Pouvez-vous expliquer en une phrase pourquoi le trade est faux sous ce prix ?</strong> Sinon, le niveau n'est pas auditable.</span></li>
        </ul>`],
    ],
    takeaways: ['Le scénario choisit la structure ; la structure choisit le stop.', "L'ATR mesure le bruit, il ne remplace pas une thèse.", 'Un stop éloigné impose une taille plus petite, pas un dépassement de risque.', 'Un ratio rendement/risque médiocre reste médiocre après le sizing.', 'Les événements binaires exigent une décision séparée sur le risque de gap.'],
    chart: `{tooltip:{trigger:'axis'},legend:{bottom:0},grid:{left:55,right:55,top:35,bottom:55},xAxis:{type:'category',data:['CLF','MDT']},yAxis:[{type:'value',name:'Distance %',axisLabel:{formatter:'{value}%'}},{type:'value',name:'Ticket $',axisLabel:{formatter:'{value} $'}}],series:[{name:'Distance au stop',type:'bar',data:[7.9,3.9],itemStyle:{color:'#0e7490'}},{name:'Capital engagé',type:'bar',yAxisIndex:1,data:[625,1271],itemStyle:{color:'#9333ea'}}]}`,
  },
  3: {
    description: "Stop broker, alerte ou sortie mentale : avantages, limites et choix par défaut pour qu'une invalidation devienne une protection réellement exécutable.",
    intro: "Un stop écrit dans un carnet ne protège rien si vous n'êtes pas devant l'écran. Un ordre chez le broker protège mieux, mais son prix d'exécution n'est pas garanti en cas de gap. Le bon choix dépend de votre disponibilité, de la liquidité et de la vitesse du risque.",
    badges: ['Ordre broker', 'Alerte', 'Liquidité', 'Discipline'],
    sections: [
      ['Verdict opérationnel', `<div class="takeaway-box"><h3>Par défaut : protection native chez le broker</h3><p>Pour un investisseur retail qui ne surveille pas chaque tick, un stop réel est le seul dispositif qui reste actif pendant une réunion, une panne de téléphone ou un mouvement brutal. Le stop mental est une exception exigeante, pas une version plus sophistiquée.</p></div>`],
      ['Comparer les protections', `<div class="table-scroll"><table class="compare-table"><thead><tr><th>Protection</th><th>Force</th><th>Faiblesse</th><th>Usage défendable</th></tr></thead><tbody>
        <tr><td><strong>Stop-market</strong></td><td>Priorité à la sortie une fois déclenché</td><td>Prix non garanti, surtout dans un gap</td><td>Titre liquide, priorité absolue au contrôle de la perte</td></tr>
        <tr><td><strong>Stop-limit</strong></td><td>Refuse un prix pire que la limite</td><td>Peut ne jamais être exécuté</td><td>Cas très liquides où rester coincé est acceptable</td></tr>
        <tr><td><strong>Alerte + ordre manuel</strong></td><td>Permet de confirmer une clôture ou un faux break</td><td>Délai humain et indisponibilité</td><td>Trader présent, processus écrit, liquidité élevée</td></tr>
        <tr><td><strong>Stop mental</strong></td><td>Évite certaines chasses intraday</td><td>Biais, hésitation, aucune protection hors écran</td><td>Professionnel supervisant activement la position</td></tr>
      </tbody></table></div>`],
      ['Le test des cinq contraintes', `<div class="step-grid">
        <div class="step-card"><div class="step-number">1</div><h4>Présence</h4><p>Serez-vous réellement disponible quand le niveau est touché ?</p></div>
        <div class="step-card"><div class="step-number">2</div><h4>Liquidité</h4><p>Le spread et la profondeur permettent-ils une sortie ordonnée ?</p></div>
        <div class="step-card"><div class="step-number">3</div><h4>Session</h4><p>L'ordre est-il actif pendant les heures où le risque peut survenir ?</p></div>
        <div class="step-card"><div class="step-number">4</div><h4>Événement</h4><p>Une publication peut-elle ouvrir bien au-delà du niveau ?</p></div>
        <div class="step-card"><div class="step-number">5</div><h4>Broker</h4><p>Connaissez-vous précisément le déclencheur, la durée et les règles de l'ordre ?</p></div>
      </div>`],
      ["Ce qu'un stop ne garantit jamais", `<div class="alert-box"><h4>Déclenchement ne veut pas dire prix garanti</h4><p>Un stop-market devient un ordre au marché après déclenchement. S'il n'existe aucun acheteur près du niveau, l'exécution se fait plus bas. Un stop-limit contrôle le prix, mais pas l'exécution. Il n'existe pas d'ordre qui garantisse simultanément sortie et prix dans toutes les conditions.</p></div><p>La protection complète combine donc trois éléments : un niveau d'invalidation, une taille assez petite pour absorber un dérapage raisonnable et une politique explicite face aux événements binaires.</p>`],
    ],
    takeaways: ['Un stop mental n’est pas actif lorsque vous êtes absent.', 'Stop-market : sortie prioritaire, prix non garanti.', 'Stop-limit : prix encadré, sortie non garantie.', "Le type d'ordre doit être choisi avant l'entrée et vérifié chez le broker.", 'La taille doit intégrer le fait que le fill peut être pire que le niveau.'],
  },
  4: {
    description: "Comprendre le gap au-delà du stop, le slippage et les limites des ordres stop afin de dimensionner une position qui peut survivre à une ouverture discontinue.",
    intro: "Entre deux cotations, il peut ne rien exister. Si une action clôture à 40 $, que votre stop est à 36 $ et que la première transaction suivante se fait à 30 $, aucun ordre ne peut fabriquer les acheteurs manquants entre 36 $ et 30 $. C'est le trou du gap.",
    badges: ['Gap', 'Slippage', 'Earnings', 'Risque binaire'],
    sections: [
      ['Le mécanisme', `<div class="formula-box"><div class="formula-label">Perte réellement subie</div>Nombre d'actions × (prix d'entrée − prix d'exécution)</div><p>Le niveau du stop sert de déclencheur. Le prix d'exécution dépend du prochain marché disponible. Cette distinction devient critique hors séance, sur une petite capitalisation ou après une annonce.</p>`],
      ['Un même plan, quatre ouvertures', `<p>Exemple pédagogique : 12 actions achetées à 40 $, stop déclencheur à 36 $. Le risque planifié vaut 48 $. Le graphique montre comment la perte augmente lorsque la première liquidité disponible se trouve sous le stop.</p><div id="lesson-chart" class="echart-box" style="height:350px" role="img" aria-label="Perte selon le prix d'exécution après un gap"></div><p class="source-note">Scénario illustratif, hors frais. Il ne prédit aucune distribution de gap.</p>`],
      ['Avant un événement binaire', `<ul class="checklist">
        <li><i class="fa-solid fa-calendar-xmark" style="color:#dc2626"></i><span><strong>Conserver ou sortir est une nouvelle décision.</strong> Le plan technique régulier ne suffit plus quand un résultat peut revaloriser le titre instantanément.</span></li>
        <li><i class="fa-solid fa-scale-balanced" style="color:#0e7490"></i><span><strong>Réduire la taille avant l'annonce</strong> diminue le dommage potentiel ; cela ne transforme pas le gap en risque borné.</span></li>
        <li><i class="fa-solid fa-ban" style="color:#dc2626"></i><span><strong>Un stop-limit serré peut laisser toute la position ouverte</strong> si le marché saute sous la limite.</span></li>
        <li><i class="fa-solid fa-circle-check" style="color:#0e7490"></i><span><strong>L'absence de position est une position.</strong> Refuser un risque non quantifiable est une décision valide.</span></li>
      </ul>`],
      ['Contrôle retail', `<div class="table-scroll"><table class="compare-table"><thead><tr><th>Question</th><th>Si la réponse est non</th></tr></thead><tbody>
        <tr><td>Connaissez-vous la date du prochain earnings ou verdict réglementaire ?</td><td>Pas de nouvelle entrée.</td></tr>
        <tr><td>Pouvez-vous accepter une perte supérieure à l'enveloppe planifiée ?</td><td>Sortir ou réduire avant l'événement.</td></tr>
        <tr><td>Le titre est-il liquide pendant la session concernée ?</td><td>Ne pas compter sur un fill proche du stop.</td></tr>
        <tr><td>Votre broker active-t-il l'ordre dans cette session ?</td><td>La protection est incomplète.</td></tr>
      </tbody></table></div>`],
    ],
    takeaways: ["Un stop déclenche un ordre ; il ne garantit pas le prix d'exécution.", 'Le gap transforme une perte planifiée en perte potentiellement supérieure.', 'Le stop-limit peut éviter un mauvais prix en échange du risque de ne pas sortir.', 'Avant un événement binaire, conserver la position exige une décision dédiée.', "Quand l'amplitude plausible est inconnue, réduire ou sortir est plus honnête que feindre la précision."],
    chart: `{tooltip:{trigger:'axis',valueFormatter:v=>v+' $'},grid:{left:55,right:25,top:30,bottom:45},xAxis:{type:'category',data:['36 $','34 $','32 $','30 $'],name:'Prix d’exécution'},yAxis:{type:'value',name:'Perte $'},series:[{type:'bar',data:[48,72,96,120],itemStyle:{color:p=>['#0e7490','#f59e0b','#f97316','#dc2626'][p.dataIndex]},label:{show:true,position:'top',formatter:'{c} $'}}]}`,
  },
  5: {
    description: "Règles déterministes pour relever un stop gagnant sans le reculer, éviter le break-even automatique et laisser respirer une tendance.",
    intro: "Un stop peut monter parce que le marché a créé une nouvelle structure qui invalide désormais le trade plus haut. Il ne doit jamais descendre parce que la perte devient inconfortable. La différence tient en une règle : le prix fournit la preuve avant le déplacement.",
    badges: ['Break-even', 'Trailing', 'Partiels', 'Nouvelle structure'],
    sections: [
      ["La machine d'état", `<div class="step-grid">
        <div class="step-card"><div class="step-number">1</div><h4>Risque initial</h4><p>Stop d'origine intact. Aucun déplacement parce que le trade est légèrement vert.</p></div>
        <div class="step-card"><div class="step-number">2</div><h4>Confirmation</h4><p>Le prix franchit le niveau prévu et construit un nouveau pivot exploitable.</p></div>
        <div class="step-card"><div class="step-number">3</div><h4>Protection</h4><p>Le stop remonte sous cette nouvelle structure, avec une marge compatible avec le bruit.</p></div>
        <div class="step-card"><div class="step-number">4</div><h4>Sortie</h4><p>Le marché invalide la nouvelle structure ou atteint la règle de sortie prévue.</p></div>
      </div>`],
      ['Trois règles non négociables', `<ul class="checklist">
        <li><i class="fa-solid fa-arrow-up" style="color:#0e7490"></i><span><strong>Un stop long ne se déplace que vers le haut.</strong> Le reculer augmente le risque après l'entrée et réécrit le contrat.</span></li>
        <li><i class="fa-solid fa-chart-line" style="color:#0e7490"></i><span><strong>Le marché doit créer la nouvelle invalidation.</strong> Un gain latent de 0,3 R n'est pas une structure.</span></li>
        <li><i class="fa-solid fa-clock" style="color:#0e7490"></i><span><strong>La cadence correspond à l'horizon.</strong> Un swing quotidien ne se pilote pas avec chaque bougie de cinq minutes.</span></li>
      </ul>`],
      ['Le piège du break-even', `<div class="alert-box"><h4>Prix d'entrée ne signifie pas niveau technique</h4><p>Déplacer automatiquement le stop au prix d'achat dès que le trade gagne 1 R paraît prudent. Mais ce prix n'a souvent aucune importance pour le marché. Le titre peut revenir tester le breakout, toucher votre break-even, puis repartir sans vous.</p></div><p>Le break-even devient défendable seulement s'il coïncide avec une nouvelle structure ou si le plan testé l'impose. Sinon, il sert surtout à soulager l'émotion du trader.</p>`],
      ['Choisir une méthode et ne pas les mélanger', `<div class="table-scroll"><table class="compare-table"><thead><tr><th>Méthode</th><th>Déplacement</th><th>Convient à</th><th>Risque</th></tr></thead><tbody>
        <tr><td><strong>Pivots</strong></td><td>Sous chaque nouveau creux ascendant confirmé</td><td>Swing discrétionnaire lisible</td><td>Rendre tard une partie du gain</td></tr>
        <tr><td><strong>ATR</strong></td><td>Distance mécanique sous le plus haut</td><td>Tendance régulière et système testé</td><td>Paramètre trop serré en volatilité croissante</td></tr>
        <tr><td><strong>Moyenne mobile</strong></td><td>Clôture sous une moyenne définie</td><td>Tendance longue et liquide</td><td>Retard important après retournement rapide</td></tr>
        <tr><td><strong>Temps</strong></td><td>Sortie si le progrès attendu n'arrive pas</td><td>Breakout ou catalyseur rapide</td><td>Quitter une accumulation lente valide</td></tr>
      </tbody></table></div>`],
    ],
    takeaways: ['Ne jamais élargir le risque initial après l’entrée.', 'Un gain latent ne suffit pas : attendre une nouvelle structure.', "Le break-even automatique protège l'ego, pas forcément le capital.", "La cadence du stop doit correspondre à l'horizon du trade.", 'Une seule méthode de trailing par plan, choisie avant l’entrée.'],
  },
  6: {
    description: "Construire une sortie gagnante cohérente : objectifs, partiels, trailing stop, multiples de risque et journal de décision.",
    intro: "Vendre au plus haut est impossible à systématiser. Une bonne sortie n'est donc pas celle qui capture chaque dernier dollar ; c'est celle qui applique une règle cohérente avec le setup, préserve une espérance positive et peut être répétée sans improvisation.",
    badges: ['Objectif', 'R multiple', 'Partiels', 'Journal'],
    sections: [
      ["Choisir la sortie avant l'entrée", `<div class="table-scroll"><table class="compare-table"><thead><tr><th>Sortie</th><th>Force</th><th>Faiblesse</th><th>Setup adapté</th></tr></thead><tbody>
        <tr><td><strong>Cible fixe</strong></td><td>Simple, ratio connu avant l'entrée</td><td>Coupe les tendances exceptionnelles</td><td>Retour vers résistance ou range</td></tr>
        <tr><td><strong>Partiel + runner</strong></td><td>Monétise une partie et conserve l'optionalité</td><td>Complexifie l'exécution et réduit parfois le gain moyen</td><td>Breakout avec plusieurs résistances</td></tr>
        <tr><td><strong>Trailing stop</strong></td><td>Laisse courir les grandes tendances</td><td>Rend une partie du gain latent</td><td>Momentum ou tendance durable</td></tr>
        <tr><td><strong>Sortie temps</strong></td><td>Libère le capital d'une idée inactive</td><td>Peut précéder un départ tardif</td><td>Catalyseur censé agir rapidement</td></tr>
      </tbody></table></div>`],
      ['Raisonner en R', `<p><strong>1 R</strong> est le risque initial par action. Si l'entrée vaut 40 $ et le stop 36 $, 1 R vaut 4 $. Une sortie à 48 $ produit +2 R ; une sortie au stop produit −1 R. Cette unité permet de comparer des titres et tailles très différents.</p><div id="lesson-chart" class="echart-box" style="height:340px" role="img" aria-label="Espérance de plusieurs profils de gains et pertes exprimés en R"></div><p class="source-note">Profils illustratifs : l'espérance dépend conjointement du taux de réussite et du gain moyen.</p>`],
      ['Le plan de sortie complet', `<div class="step-grid">
        <div class="step-card"><div class="step-number">1</div><h4>Invalidation</h4><p>Stop initial et risque maximum documentés.</p></div>
        <div class="step-card"><div class="step-number">2</div><h4>Premier objectif</h4><p>Niveau économique ou technique et ratio R correspondant.</p></div>
        <div class="step-card"><div class="step-number">3</div><h4>Runner</h4><p>Quantité restante et méthode de trailing explicite.</p></div>
        <div class="step-card"><div class="step-number">4</div><h4>Temps</h4><p>Date ou nombre de séances après lequel l'idée doit être revue.</p></div>
        <div class="step-card"><div class="step-number">5</div><h4>Événement</h4><p>Décision avant earnings, dividende ou annonce binaire.</p></div>
        <div class="step-card"><div class="step-number">6</div><h4>Journal</h4><p>Fill réel, slippage, MFE, MAE et respect du plan.</p></div>
      </div>`],
      ['Audit après le trade', `<ul class="checklist">
        <li><i class="fa-solid fa-circle-check" style="color:#0e7490"></i><span>La sortie a-t-elle suivi la règle écrite, même si le cours a continué ensuite ?</span></li>
        <li><i class="fa-solid fa-circle-check" style="color:#0e7490"></i><span>Le gain moyen en R compense-t-il réellement les pertes et les coûts ?</span></li>
        <li><i class="fa-solid fa-circle-check" style="color:#0e7490"></i><span>Les partiels améliorent-ils les résultats mesurés ou seulement le confort émotionnel ?</span></li>
        <li><i class="fa-solid fa-circle-check" style="color:#0e7490"></i><span>Le slippage réel correspond-il à l'hypothèse utilisée pour dimensionner ?</span></li>
      </ul><div class="alert-box"><h4>Ne jugez jamais une règle sur un seul trade</h4><p>Une cible fixe peut sembler mauvaise après une envolée, et un trailing stop mauvais après avoir rendu un gros gain. La comparaison doit porter sur une série homogène de trades, avec coûts, taux de réussite, gain moyen et drawdown.</p></div>`],
    ],
    takeaways: ["La sortie se décide avant l'entrée, pas sous pression.", 'R permet de comparer des trades de prix et de tailles différents.', 'Partiels et trailing répondent à des objectifs différents.', "Une règle cohérente peut être bonne même si elle ne vend pas au plus haut.", 'Le journal mesure la qualité du processus sur une série, jamais sur une anecdote.'],
    chart: `{tooltip:{trigger:'axis'},legend:{bottom:0},grid:{left:55,right:25,top:35,bottom:55},xAxis:{type:'category',data:['45% gagnants à +1R','40% à +2R','30% à +3R']},yAxis:{type:'value',name:'Espérance (R/trade)'},series:[{name:'Espérance illustrative',type:'bar',data:[-0.1,0.2,0.2],itemStyle:{color:p=>p.value>0?'#0e7490':'#dc2626'},label:{show:true,position:'top',formatter:'{c} R'}}]}`,
  },
};

function nav(current) {
  const previous = current > 1 ? `<a class="series-arrow" href="/series/premier-stop/ep${current - 1}/" aria-label="Épisode précédent"><i class="fas fa-chevron-left"></i></a>` : '<span class="series-arrow disabled" aria-label="Aucun épisode précédent"><i class="fas fa-chevron-left"></i></span>';
  const next = current < 6 ? `<a class="series-arrow" href="/series/premier-stop/ep${current + 1}/" aria-label="Épisode suivant"><i class="fas fa-chevron-right"></i></a>` : '<span class="series-arrow disabled" aria-label="Aucun épisode suivant"><i class="fas fa-chevron-right"></i></span>';
  const steps = chapters.map(ch => `<a href="/series/premier-stop/${ch.slug}/" class="series-step${ch.n === current ? ' current' : ''}" title="${ch.title.replace(/"/g, '&quot;')}"${ch.n === current ? ' aria-current="step"' : ''}><span class="series-num">${ch.n}</span><span class="series-label">${ch.short}</span></a>`).join('');
  return `<div class="series-bar"><div class="series-bar-inner">${previous}<span class="series-title">Ton premier stop</span><div class="series-steps">${steps}</div><span class="series-counter">${current}/6</span>${next}</div></div>`;
}

function page(n) {
  const data = pages[n];
  const chapter = chapters[n - 1];
  const sectionHtml = data.sections.map(([heading, body], index) => `<div class="section-divider" id="section-${index + 1}">${heading}</div><section class="content-card"><h2>${heading}</h2>${body}</section>`).join('\n');
  const takeaway = data.takeaways.map(item => `<li><i class="fa-solid fa-check"></i><span>${item}</span></li>`).join('');
  const prev = chapters[n - 2];
  const next = chapters[n];
  const adjacent = `<nav class="lesson-adjacent" aria-label="Navigation entre épisodes">${prev ? `<a href="/series/premier-stop/${prev.slug}/"><i class="fa-solid fa-arrow-left"></i><span><small>Épisode ${prev.n}</small>${prev.short}</span></a>` : '<span></span>'}${next ? `<a href="/series/premier-stop/${next.slug}/"><span><small>Épisode ${next.n}</small>${next.short}</span><i class="fa-solid fa-arrow-right"></i></a>` : `<a href="/?tab=series"><span><small>Parcours terminé</small>Voir toutes les séries</span><i class="fa-solid fa-graduation-cap"></i></a>`}</nav>`;
  const chart = data.chart ? `<script>(function(){if(typeof echarts==='undefined')return;var el=document.getElementById('lesson-chart');if(!el)return;var chart=echarts.init(el);chart.setOption(${data.chart});window.addEventListener('resize',function(){chart.resize()});})();</script>` : '';
  return `<!DOCTYPE html>
<html lang="fr" data-tags="formation,education,technique,debutant" data-tab="series">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${chapter.title} | Ton premier stop — Épisode ${n}/6 | DailyTickers</title>
  <meta name="description" content="${data.description}">
  <meta property="og:title" content="${chapter.title}"><meta property="og:description" content="${data.description}">
  <meta property="og:url" content="https://articles.dailytickers.com/series/premier-stop/${chapter.slug}/"><meta property="og:type" content="article"><meta property="og:image" content="https://articles.dailytickers.com/favicon.ico">
  <link rel="icon" href="/favicon.ico"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  ${data.chart ? '<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>' : ''}
  <link rel="stylesheet" href="/assets/report.css?v=20260831-1">
  <style>
    .hero-section{padding:3.5rem 1.5rem 5rem;text-align:center;background:#ecfeff;border-bottom:1px solid #bae6fd}.hero-date{font-size:.78rem;font-weight:800;color:#0e7490;text-transform:uppercase;margin-bottom:1rem}.hero-title{max-width:900px;margin:0 auto 1rem;font-size:clamp(1.75rem,4vw,2.7rem);letter-spacing:0}.hero-subtitle{max-width:760px;margin:0 auto;color:#475569;line-height:1.7}.hero-badges{display:flex;justify-content:center;gap:.5rem;flex-wrap:wrap;margin-top:1.5rem}.hero-badge{padding:.42rem .75rem;border:1px solid #a5f3fc;background:#fff;color:#0e7490;border-radius:6px;font-size:.76rem;font-weight:700}.section-divider{display:flex;align-items:center;gap:1rem;margin:2.5rem 0 1rem;color:#0e7490;font-size:.76rem;font-weight:800;text-transform:uppercase}.section-divider:after{content:'';height:1px;background:#cbd5e1;flex:1}.step-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.8rem;margin:1.5rem 0}.step-card{border:1px solid #dbe3ec;border-top:3px solid #0e7490;padding:1rem;background:#fff}.step-number{width:30px;height:30px;display:grid;place-items:center;background:#0e7490;color:#fff;font-weight:800;border-radius:4px;margin-bottom:.65rem}.step-card h4{margin:0 0 .35rem}.step-card p{font-size:.88rem;margin:0;color:#64748b}.table-scroll{overflow-x:auto}.compare-table{min-width:680px}.formula-box{background:#0f172a;color:#fff;padding:1.25rem;margin:1.25rem 0;text-align:center;font-size:1.12rem;font-weight:700;border-radius:6px}.formula-label{font-size:.68rem;text-transform:uppercase;color:#67e8f9;margin-bottom:.4rem}.source-note{font-size:.78rem;color:#64748b}.lesson-adjacent{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:2rem 0}.lesson-adjacent>a{display:flex;align-items:center;justify-content:space-between;gap:.75rem;border:1px solid #cbd5e1;padding:1rem;color:#0f172a;background:#fff;text-decoration:none}.lesson-adjacent>a:last-child{text-align:right}.lesson-adjacent small{display:block;color:#64748b;font-size:.68rem;text-transform:uppercase;margin-bottom:.2rem}.takeaway-list li>span{min-width:0}.article-footer a{color:inherit}@media(max-width:640px){.hero-section{padding:2rem 1rem 3.5rem}.lesson-adjacent{grid-template-columns:1fr}.lesson-adjacent>span{display:none}.content-card{padding:1.15rem}.echart-box{height:300px!important}}
  </style>
</head>
<body>
<nav class="brand-bar"><div class="brand-bar-inner"><a href="/" class="brand-logo"><img src="/logo.svg" alt="" width="36" height="36"><span class="brand-title">DailyTickers</span></a><div class="brand-nav"><a href="/?tab=weekly">Hebdo</a><a href="/?tab=daily">Daily</a><a href="/?tab=analyses">Analyses</a><a href="/?tab=scanner">Scanner</a><a href="/?tab=radar">Radar</a><a href="/?tab=series">Séries</a></div><div class="brand-actions"><a href="/" class="brand-home-btn" title="Accueil"><i class="fas fa-house"></i></a></div></div></nav>
<header class="hero-section"><div class="hero-date"><i class="fa-solid fa-shield-halved"></i> Ton premier stop — Épisode ${n} sur 6</div><h1 class="hero-title">${chapter.title}</h1><p class="hero-subtitle">${data.intro}</p><div class="hero-badges">${data.badges.map(x => `<span class="hero-badge">${x}</span>`).join('')}</div></header>
${nav(n)}
<main class="container">${sectionHtml}<section class="content-card"><div class="takeaway-box"><h3><i class="fa-solid fa-key"></i> À retenir — Épisode ${n}</h3><ul class="takeaway-list">${takeaway}</ul></div>${adjacent}</section></main>
${nav(n)}
<footer class="article-footer">&copy; 2026 DailyTickers. Contenu éducatif. Ceci n'est pas un conseil financier.<br><a href="https://dailytickers.substack.com" rel="noopener">Suivre DailyTickers sur Substack</a></footer>
${chart}
<script src="/assets/core.js?v=20260831-1"></script><script src="/assets/echarts-responsive.js"></script><script src="/assets/tag-renderer.js"></script>
</body></html>\n`;
}

for (let n = 2; n <= 6; n++) {
  const dir = path.join(OUT, `ep${n}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(n));
}

const ep1File = path.join(OUT, 'ep1', 'index.html');
let ep1 = fs.readFileSync(ep1File, 'utf8');
ep1 = ep1.replaceAll('/assets/report.css?v=20260830-2', '/assets/report.css?v=20260831-1').replaceAll('/assets/core.js?v=20260830-2', '/assets/core.js?v=20260831-1');
ep1 = ep1.replace(/<div class="series-bar"><div class="series-bar-inner">[\s\S]*?<\/div><\/div>/g, nav(1));
ep1 = ep1.replace(/<div class="next-card">[\s\S]*?<\/div>\s*<\/div>/, `<a class="next-card" href="/series/premier-stop/ep2/" style="text-decoration:none"><i class="fa-solid fa-map-pin"></i><div><div class="next-label">Épisode 2 sur 6</div><div class="next-title">Où placer le stop : structure, volatilité ou temps ?</div></div></a>`);
fs.writeFileSync(ep1File, ep1);

console.log('Generated premier-stop episodes 2-6 and repaired episode 1 navigation.');
