"""Dated local report. Reads immutable scan/collection inputs; never edits them."""
import collections
import hashlib
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = ROOT / 'scanner/retrospective/20260919'
def read(name): return json.loads((OUT / name).read_text())
def evidence(path):
    p = ROOT / path
    return {'path': str(path), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
def fmt(x): return f'{x:.2f}'.replace('.', ',')
def table(headers, rows):
    return '<div class="scroll"><table><thead><tr>' + ''.join('<th>'+html.escape(str(x))+'</th>' for x in headers) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td>'+html.escape(str(x))+'</td>' for x in row)+'</tr>' for row in rows) + '</tbody></table></div>'
def section(title, body, warn=False): return '<section class="card'+(' warn' if warn else '')+'"><h2>'+title+'</h2>'+body+'</section>'

c = read('cohort-manifest.json')
r = read('retro-results.json')
intraday = read('_data/intraday-bars-15m.json')['sessions']
base = '_data/collections-v2/week/'
def daily(name): return {x['symbol']: x['bars'] for x in read(base+name+'.json')['data']['items'][0]['results'][0]['data']}
bars, bench = daily('bars_positions'), daily('bench')
envelope_conflicts = []
for symbol, daily_rows in bars.items():
    for day, op, hi, lo, close, volume in daily_rows:
        ib = intraday[day][symbol]
        ih, il = max(b['high'] for b in ib), min(b['low'] for b in ib)
        if ih > hi + .011 or il < lo - .011:
            envelope_conflicts.append({'symbol':symbol,'date':day,'daily_high':hi,'daily_low':lo,'intraday_high':ih,'intraday_low':il})
benchmarks = [{'symbol':s,'start':'2026-09-14 open','end':'2026-09-18 close','open':b[0][1],'close':b[-1][4],'return_pct':(b[-1][4]/b[0][1]-1)*100} for s,b in bench.items()]
repeats = collections.Counter(p['ticker'] for p in c['proposals'])
strategies = collections.Counter(p['strategy'] for p in c['proposals'])
regimes = collections.Counter(p['regime'] for p in c['proposals'])
sectors = collections.Counter(p['sector'] or 'Non renseigné' for p in c['proposals'])
etfs = {'BITO','XLE','XOP','IBIT','BUG','HACK','CTA'}
inputs = [evidence('scanner/retrospective/20260919/'+n) for n in ['cohort-manifest.json','retro-results.json','_data/intraday-bars-15m.json',base+'bars_positions.json',base+'bench.json']]
inputs.append(evidence('scanner/retrospective/20260919/_data/crosscheck-5m/bars_intraday_5m.json'))
crosscheck = []
for row in read('_data/crosscheck-5m/bars_intraday_5m.json')['data']['items'][0]['results'][0]['data']:
    regular = [b for b in row['data'] if 'T13:30:00Z' <= b[0][10:] < 'T20:00:00Z']
    assert len(regular) == 78 and len({b[0] for b in regular}) == 78
    crosscheck.append({'symbol':row['symbol'],'regular_bars':78,'high':max(b[2] for b in regular),'low':min(b[3] for b in regular)})
diag = {'reference_close':'2026-09-18','inputs':inputs,'cohort':{'proposals':35,'unique_symbols':28,'scans':4,'mature':0,'non_mature':35,'stocks':27,'etfs':8},'benchmark_open_to_close':benchmarks,'by_sector':dict(sectors),'by_regime':dict(regimes),'by_strategy':dict(strategies),'repeated_tickers':{k:v for k,v in repeats.items() if v>1},'repeat_proposals_after_first':sum(v-1 for v in repeats.values()),'model_only':{'filled':r['summary']['filled'],'chase':sum(x.get('fill_policy')=='chase' for x in r['outcomes']),'no_fill':r['summary']['no_fill'],'execution_certified':False},'daily_intraday_envelope_conflicts':envelope_conflicts,'final_statistics':{'hit_rate':None,'mean_r':None,'median_r':None,'profit_factor':None,'drawdown':None,'winner_dependency':None,'reason':'No horizon-complete proposals; execution contract not replayed.'},'publication':{'mode':'local_provisional_review','performance_certified':False}}
assert len(c['proposals']) == len(r['outcomes']) == 35
assert sum(p['ticker'] in etfs for p in c['proposals']) == 8
assert r['summary']['non_mature'] == 35 and r['summary']['resolved'] == 0
diag['crosscheck_5m'] = crosscheck
(OUT/'diagnostics.json').write_text(json.dumps(diag,indent=2,ensure_ascii=False)+'\n')

old = (OUT/'index.html').read_text()
head = old[:old.index('<body>')]
head = re.sub(r'<title>.*?</title>', '<title>Rétro scanner du 14 au 18 septembre 2026 — bilan provisoire | DailyTickers</title>', head)
head = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="35 propositions, quatre scans et aucun horizon terminé. Bilan provisoire du scanner et audit des règles d’entrée.">', head)
if 'property="og:title"' not in head:
    head = head.replace('</head>', '<meta property="og:title" content="Rétro scanner — 14 au 18 septembre 2026"><meta property="og:description" content="35 propositions et aucun horizon terminé : bilan provisoire, exécution non certifiée."><meta property="og:image" content="https://articles.dailytickers.com/logo.svg"><meta property="og:url" content="https://articles.dailytickers.com/scanner/retrospective/20260919/"></head>')
nav = re.search(r'<nav class="brand-bar">[\s\S]*?</nav>',old).group()
hero = '<header class="hero"><div class="wrap"><p>Scanner · semaine du 14 au 18 septembre 2026</p><h1>35 propositions, un bilan encore ouvert</h1><p>Quatre scans · 28 titres · observation à la clôture du 18 septembre</p><div id="article-clickable-tags" class="card-tags"></div><div class="coverage"><strong>Bilan provisoire.</strong> Aucun horizon de dix séances n’est terminé. La performance finale et l’exécution restent non certifiées.</div></div></header>'
sections = []
sections.append(section('Ce que l’on peut conclure cette semaine', '<p><strong>Il est trop tôt pour noter les résultats du scanner.</strong> Les 35 propositions des 14, 15, 16 et 17 septembre restent dans leur horizon. Le dossier du 18 septembre est absent des archives locales : aucune sélection ne lui est attribuée. Les observations déjà arrêtées par le modèle restent exclues des statistiques finales, comme les lignes encore ouvertes.</p><p>Le défaut établi concerne la mesure : le calcul historique retient 24 entrées hypothétiques, dont <strong>15 achats au-dessus du prix LIMIT publié</strong>. Les scans interdisaient cette poursuite. Leurs résultats ne mesurent donc pas ce qu’un lecteur respectant les instructions aurait pu exécuter.</p><p><strong>Conséquence :</strong> ne pas augmenter l’exposition, changer les seuils ou proclamer une famille gagnante à partir de ce bilan. Le prochain contrôle complet doit intervenir après la clôture du 1er octobre, une fois les horizons couverts et les règles de sortie réconciliées.</p>', True))
sections.append(section('Couverture et maturité', '<p><strong>Couverture de mesure complète</strong> pour les horodatages : les 28 titres possèdent chacun les 26 observations régulières de quinze minutes sur les cinq séances collectées. <strong>Données complètes ; maturité partielle.</strong> Cette formule désigne uniquement la présence des barres. Les 0 résultats clos à horizon mûr laissent les 35 propositions hors bilan final.</p><p>Quatre séries présentent des écarts entre les extrêmes quotidiens et les extrêmes intraday du 18 septembre : EMR, JNJ, REXR et XOP. Les deux observations sont conservées ; aucun cours n’est corrigé arbitrairement. Une série complète en temps n’est pas une preuve d’exécution.</p>'+table(['Scan','Propositions','Régime publié','Horizon'],[[s['folder'][6:]+' septembre',s['count'],s['regime'],'10 séances, non terminé'] for s in c['scans']])+ '<p>27 propositions portent sur des actions et 8 sur des ETF. Chaque proposition reste comptée, y compris les répétitions : AAPL apparaît trois fois ; META, EMR, JNJ, UNM et BUG deux fois chacun.</p>'))
sections.append(section('Simulation des niveaux, exécution non certifiée', '<p>Le modèle observe seulement la première bougie de quinze minutes pour entrer et tolère un achat jusqu’à 2 % au-dessus du niveau. Les publications décrivent un ordre LIMIT valable la séance, sans poursuite du prix. Les <strong>11 absences d’entrée du modèle</strong> ne prouvent donc pas onze ordres restés non exécutés pendant toute la séance.</p><p>Les invalidations en clôture et leurs sorties à l’ouverture suivante ne sont pas rejouées. La répartition de sortie à 50 % au premier objectif est une convention du modèle, pas une preuve de transaction. Les observations de cours ne documentent ni la file d’attente, ni les quantités réellement servies. Les scans récents indiquent une entrée sans condition de VWAP : ajouter aujourd’hui cette confirmation changerait aussi leur contrat.</p><p>Les dates de fin calculées par l’ancien moteur ajoutent dix séances après la date du scan. Elles doivent être rapprochées de la convention éditoriale qui peut compter la séance d’entrée. Cette divergence n’affecte pas le constat présent : aucun des 35 horizons n’est terminé au 18 septembre.</p>', True))
sections.append(section('Le marché sur la même fenêtre', table(['Référence','Ouverture du 14','Clôture du 18','Variation'], [[b['symbol'],fmt(b['open']),fmt(b['close']),f"{b['return_pct']:+.2f} %".replace('.',',')] for b in benchmarks])+'<p>Ces variations vont de l’ouverture du lundi à la clôture du vendredi, hors dividendes et coûts. Le Nasdaq progresse davantage que le S&amp;P 500, tandis que les petites capitalisations reculent. Ce constat ne mesure ni l’alpha du scanner ni un portefeuille investi ; les propositions n’ont pas toutes la même date de départ.</p>'))
sections.append(section('Concentration et répétitions',table(['Famille','Propositions'],strategies.items())+table(['Secteur publié','Propositions'],sectors.items())+'<p>Le panier compte 25 propositions sous le régime RECOVERY et 10 sous RISK-ON, tels qu’ils étaient enregistrés au moment de la sélection. Sept propositions réutilisent un titre déjà présenté plus tôt dans la semaine. Elles restent dans le dénominateur, mais ne constituent pas sept observations indépendantes supplémentaires.</p><p>La comparaison actions seules, ETF seuls et panier combiné reste sans statistique finale : aucun de ces groupes ne contient un horizon mûr. Il en va de même pour les familles, secteurs, régimes et titres nouveaux ou répétés. Une dépendance aux meilleurs trades, un drawdown de portefeuille ou un avantage ajusté du risque ne peuvent pas être déduits de ce lot.</p>'))
sections.append(section('Statistiques diagnostiques, sans verdict','<p>Taux de réussite, R moyen, R médian, profit factor et drawdown : <strong>non calculables sur un échantillon mûr vide</strong>. Ce n’est pas un rendement nul. Les données présentes ne permettent aucun verdict sur la cohorte scanner. Le fichier de calcul brut contient un rendement moyen de zéro par défaut lorsque le nombre de résultats est nul ; cette valeur technique ne représente aucune performance et n’est pas utilisée ici.</p>'))
for heading,key in [('Par scan','by_scan'),('Par stratégie','by_strategy')]:
    sections.append(section(heading,'<p class="section-note">Inventaire du diagnostic historique uniquement. « Ouverts » compte ses scénarios encore ouverts, pas des positions exécutées. Les résultats mûrs sont tous absents.</p>'+table(['Groupe','Propositions','Résolus mûrs','Ouverts du modèle','TP1+','R moyen','PF'],[[x['name'],x['proposed'],x['resolved'],x['pending'],'N/D','N/D','N/D'] for x in r[key]])))
sections.append(section('Les 35 propositions conservées',table(['Scan','Titre','Famille','Entrée LIMIT','Stop','Objectif 1','Horizon'],[[p['scan_folder'][6:]+'/09',p['ticker'],p['strategy'],fmt(p['entry']),fmt(p['stop']),fmt(p['tp1']),'Non terminé'] for p in c['proposals']])+'<p>Ces niveaux reproduisent les archives et ne constituent pas de nouveaux ordres. Une ligne non déclenchée n’est pas reportée automatiquement à la séance suivante.</p>'))
sections.append(section('QCOM : une sélection incohérente dans les archives','<p>QCOM est écarté le 14 septembre pour un risque lié aux émissions d’actions et warrants, retenu le 15, puis écarté les 16 et 17. Les pages suivantes attribuent ce rejet à des opérations mentionnées dans des déclarations réglementaires que le filtre par type de formulaire ne suffisait pas à détecter.</p><p><strong>La proposition du 15 reste parmi les 35.</strong> La supprimer après avoir identifié le défaut améliorerait artificiellement le bilan. Le correctif porte sur la lecture des opérations et la cohérence des exclusions entre scans ; cette rétro ne prétend pas que le risque a causé un mouvement de cours. Sources : <a href="../../20260914/signals.json">archive du 14</a>, <a href="../../20260915/signals.json">du 15</a>, <a href="../../20260916/signals.json">du 16</a> et <a href="../../20260917/signals.json">du 17</a>.</p>', True))
sections.append(section('Ce qui reste à résoudre','<p>Réconcilier la durée de validité de l’ordre, la règle de non-poursuite, les invalidations en clôture, la répartition aux objectifs et le décompte des dix séances avec chaque publication originale. Puis prolonger les observations jusqu’au terme de tous les horizons. Aucun réglage de stratégie n’est changé par cette rétrospective.</p><p>Une seconde collecte en cinq minutes retrouve les écarts d’extrêmes sur les quatre titres signalés. Elle ne permet pas de déclarer les barres quotidiennes exactes ni de corriger silencieusement les cours. Le conflit reste ouvert pour toute future mesure d’exécution.</p><p>Les versions des archives sont identifiées par leur empreinte. Les révisions enregistrées précèdent les séances ciblées, mais l’historique du dépôt ne prouve pas à quelle heure chaque version a été effectivement accessible au lecteur. Les preuves de mise en ligne devront compléter le dossier pour certifier cette chronologie.</p>'))
sections.append(section('Sources et portée','<p>Les <a href="./cohort-manifest.json">35 propositions et leurs sources</a>, les <a href="./diagnostics.json">diagnostics et empreintes des preuves</a> et le <a href="./retro-results.json">calcul historique explicitement hypothétique</a> sont conservés avec ce bilan. Les cours ont été collectés le 19 septembre, avec une clôture de référence au 18. Les données courantes de risques, partiellement indisponibles, ne gouvernent aucun résultat ni aucune nouvelle conclusion sur un émetteur.</p><p>Le rapport est local et provisoire. Les contrôles de présence et de fraîcheur ont réussi ; la certification de performance reste impossible pour les raisons ci-dessus. Les archives des scans et les historiques scellés restent inchangés.</p>'))
footer='<footer class="article-footer"><p><strong>DailyTickers</strong> — contenu éducatif. Les scénarios hypothétiques ne sont pas des performances réalisées.</p></footer><script src="/assets/core.js"></script><script src="/assets/tag-renderer.js"></script></body></html>'
(OUT/'index.html').write_text(head+'<body>'+nav+hero+'<main class="wrap">'+''.join(sections)+'</main>'+footer)
print('Dated report rendered; 35 archived proposals; no final performance.')
