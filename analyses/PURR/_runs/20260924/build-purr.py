#!/usr/bin/env python3
"""Générateur déterministe de la fiche PURR du 24 septembre 2026.

Lit uniquement les artefacts collectés et hachés (analyses/PURR/_data, source Webull certifiée
completed_only) et le manifeste SEC primaire. Écrit, dans cet ordre :
  1. revision/editorial-judgments.json  (jugements éditoriaux, composantes du score)
  2. data/analyses-data/PURR.json        (la fiche)
  3. revision/numeric-evidence.json      (calcul certifié : valeurs, méthodes, provenance)
  4. data/analyses-evidence/PURR.json    (sidecar : une preuve par valeur numérique)
Aucun chiffre n'est saisi à la main s'il existe dans une source ; les chiffres de dépôts SEC sont
recopiés du texte du document haché et pointent vers son entrée du manifeste primaire.
"""
import hashlib, json, math, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
RUN = 'analyses/PURR/_runs/20260924'
REV = RUN + '/revision'
DATA = 'analyses/PURR/_data'
REF = '2026-09-23'
GEN = RUN + '/build-purr.py'
ANALYSIS = 'data/analyses-data/PURR.json'
EVIDENCE = 'data/analyses-evidence/PURR.json'

def p(rel): return os.path.join(ROOT, rel)
def rj(rel): return json.load(open(p(rel), encoding='utf-8'))
def sha(rel): return hashlib.sha256(open(p(rel), 'rb').read()).hexdigest()
def wj(rel, obj):
    os.makedirs(os.path.dirname(p(rel)), exist_ok=True)
    with open(p(rel), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2); f.write('\n')
def esc(k): return str(k).replace('~', '~0').replace('/', '~1')
def unwrap(d):
    x = d.get('data', d)
    return x['items'][0] if isinstance(x, dict) and 'items' in x else x
def r2(x, n=2): return round(x, n)

# ------------------------------------------------------------------ données collectées
bars_raw = rj(DATA + '/bars.json')
B = '/results/0/data/0/bars'
bars = bars_raw['results'][0]['data'][0]['bars']
assert bars_raw['results'][0]['data'][0]['symbol'] == 'PURR' and bars[-1][0] == REF
LAST = len(bars) - 1
closes = [b[4] for b in bars]
dates = [b[0] for b in bars]
idx = {d: i for i, d in enumerate(dates)}

comp_raw = rj(DATA + '/comparison_bars.json')
comp_root = unwrap(comp_raw)
comp_rows = comp_root['results'][0]['data']
C_PREFIX = '/data/items/0/results/0/data' if 'items' in comp_raw.get('data', {}) else '/results/0/data'
def cpath(t):
    i = next(k for k, r in enumerate(comp_rows) if r['symbol'] == t)
    return i, f'{C_PREFIX}/{i}/bars'

fund = unwrap(rj(DATA + '/fundamentals.json'))
def fres(kind):
    for k, r in enumerate(fund['results']):
        if r['data_type'] == kind: return k, r['data']
    raise KeyError(kind)
FUND_PREFIX = '/data/items/0/results' if 'items' in rj(DATA + '/fundamentals.json').get('data', {}) else '/results'
k_stats, stats = fres('stats'); stats = stats[0]
k_fin, fin = fres('financials'); fin = fin[0]
k_hold, holders = fres('holders'); holders = holders[0]

short_raw = rj(DATA + '/short_squeeze.json'); short = unwrap(short_raw)
SH_PREFIX = '/data/items/0/results' if 'items' in short_raw.get('data', {}) else '/results'
ks = next(k for k, r in enumerate(short['results']) if r['data_type'] == 'short_interest')
si_points = short['results'][ks]['data'][0]['points']
kc = next(k for k, r in enumerate(short['results']) if r['data_type'] == 'ctb')
ctb_hist = short['results'][kc]['data'][0]['history']

status = rj(DATA + '/status.json')
primary = rj(REV + '/primary-manifest.json')
PRIMARY_PATH = REV + '/primary-manifest.json'
DOC = {d['form'] + ':' + d['date']: i for i, d in enumerate(primary['documents'])}
D10K, DPR, DAM1, DAM3, DPRE, D424 = (DOC['10-K:2026-08-27'], DOC['8-K:2026-08-27'], DOC['8-K:2026-09-01'],
                                      DOC['8-K:2026-09-15'], DOC['PRE 14A:2026-09-15'], DOC['424B3:2026-09-23'])

# ------------------------------------------------------------------ calculs locaux
def ret(n): return (closes[LAST] / closes[LAST - n] - 1) * 100
def ema(values, n):
    k = 2 / (n + 1); e = sum(values[:n]) / n
    for v in values[n:]: e = v * k + e * (1 - k)
    return e
tr = [max(bars[i][2] - bars[i][3], abs(bars[i][2] - bars[i - 1][4]), abs(bars[i][3] - bars[i - 1][4])) for i in range(1, len(bars))]
atr = sum(tr[:14]) / 14
for t in tr[14:]: atr = (atr * 13 + t) / 14
gains = [max(closes[i] - closes[i - 1], 0) for i in range(1, len(closes))]
losses = [max(closes[i - 1] - closes[i], 0) for i in range(1, len(closes))]
ag, al = sum(gains[:14]) / 14, sum(losses[:14]) / 14
for i in range(14, len(gains)): ag = (ag * 13 + gains[i]) / 14; al = (al * 13 + losses[i]) / 14
rsi = 100 - 100 / (1 + ag / al)
def macd_line(values):
    k12, k26 = 2 / 13, 2 / 27; e12 = e26 = values[0]; out = []
    for v in values: e12 = v * k12 + e12 * (1 - k12); e26 = v * k26 + e26 * (1 - k26); out.append(e12 - e26)
    return out
ml = macd_line(closes); sig = ema(ml, 9)
ema20, ema50, ema200 = ema(closes, 20), ema(closes, 50), ema(closes, 200)
hi_i = max(range(len(bars)), key=lambda i: bars[i][2]); lo_i = min(range(len(bars)), key=lambda i: bars[i][3])

# Régressions : log-rendements sur les dates communes, 124 dernières observations.
WINDOW = 124
purr_by_date = {b[0]: b[4] for b in bars}
def regress(t):
    _, _pre = cpath(t)
    row = next(r for r in comp_rows if r['symbol'] == t)
    cb = {b[0]: b[4] for b in row['bars']}
    common = [d for d in dates if d in cb]
    rp, rc = [], []
    for a, b in zip(common, common[1:]):
        rp.append(math.log(purr_by_date[b] / purr_by_date[a])); rc.append(math.log(cb[b] / cb[a]))
    rp, rc = rp[-WINDOW:], rc[-WINDOW:]
    n = len(rp); mp, mc = sum(rp) / n, sum(rc) / n
    cov = sum((x - mp) * (y - mc) for x, y in zip(rp, rc)) / (n - 1)
    vp = sum((x - mp) ** 2 for x in rp) / (n - 1); vc = sum((y - mc) ** 2 for y in rc) / (n - 1)
    corr = cov / math.sqrt(vp * vc); beta = cov / vc
    cl = [b[4] for b in row['bars']]; assert row['bars'][-1][0] == REF
    return {'correlation': r2(corr, 4), 'beta': r2(beta, 4), 'r2': r2(corr * corr, 4), 'observations': n,
            'return5d': r2((cl[-1] / cl[-6] - 1) * 100), 'return21d': r2((cl[-1] / cl[-22] - 1) * 100)}

# Valeur liquidative comptable au 30 juin 2026 (10-K, en milliers de dollars) — recopiée du document.
TA_K, TL_K, CASH_K, HYPE_FV_K, HYPE_COST_K, DTL_K = 2060008, 187137, 137917, 1904052, 1363333, 183475
HYPE_0630, COMMON_0630, PREF_CONV = 29275085, 200550458, 26587647
WARRANTS = 27394800
COMMON_0908, SOLD_0908, HYPE_0908 = 237919288, 112952100, 33.2e6
REGISTERED = 160000000
equity_k = TA_K - TL_K
nav_ps_0630 = equity_k * 1000 / (COMMON_0630 + PREF_CONV)
close_0630 = bars[idx['2026-06-30']][4]
p_nav_0630 = close_0630 / nav_ps_0630
hype_price_0630 = HYPE_FV_K * 1000 / HYPE_0630
close_0908 = bars[idx['2026-09-08']][4]
implied_hype_0908 = (close_0908 * (COMMON_0908 + PREF_CONV) - CASH_K * 1000) / HYPE_0908
hype_per_1000_0630 = HYPE_0630 / (COMMON_0630 + PREF_CONV) * 1000
hype_per_1000_0908 = HYPE_0908 / (COMMON_0908 + PREF_CONV) * 1000
remaining_registered = REGISTERED - SOLD_0908
mcap_ref_m = closes[LAST] * COMMON_0908 / 1e6
diluted_0908 = COMMON_0908 + PREF_CONV + WARRANTS

# Base NAV homogène au 30 juin : actifs hors HYPE (trésorerie + autres) moins passif, impôt différé compris.
OTHER_K = TA_K - HYPE_FV_K - CASH_K
NON_HYPE_NET_K = CASH_K + OTHER_K - TL_K
implied_hype_0908 = (close_0908 * (COMMON_0908 + PREF_CONV) - NON_HYPE_NET_K * 1000) / HYPE_0908

# Dilution restante : capacité ÷ prix payé par Chardan (97,5 % du VWAP aujourd'hui, 424B3).
CAP_REMAINING = 1.4e9; CHEF_PRICE = 0.975; MIN_PRICE = 12.02
shares_spot = CAP_REMAINING / (closes[LAST] * CHEF_PRICE)
shares_min = CAP_REMAINING / (MIN_PRICE * CHEF_PRICE)
pct_spot = shares_spot / COMMON_0908 * 100
pct_min = shares_min / COMMON_0908 * 100
registered_proceeds = remaining_registered * closes[LAST] * CHEF_PRICE

# Liquidité : médiane de la valeur échangée sur vingt séances.
import statistics
LIQ_IDX = list(range(LAST - 19, LAST + 1))
liq_series = [{'date': bars[i][0], 'close_pointer': f'/results/0/data/0/bars/{i}/4', 'volume_pointer': f'/results/0/data/0/bars/{i}/5', 'dollar_volume': bars[i][4] * bars[i][5]} for i in LIQ_IDX]
dollar_vol_m = statistics.median(x['dollar_volume'] for x in liq_series) / 1e6

# Zone de congestion en clôtures, du 31 août au 16 septembre.
zone = [b for b in bars if '2026-08-31' <= b[0] <= '2026-09-16']
zone_lo, zone_hi = min(b[4] for b in zone), max(b[4] for b in zone)
zone_top = max(zone, key=lambda b: b[2])

# Plan conditionnel : entrée au retour sur le haut de zone, stop à environ un ATR sous l'entrée.
ENTRY = 12.95; STOP = 11.80; TP1 = round(bars[hi_i][2], 2)
# Plafond d'entrée : plus haut prix où le R/R vers TP1 reste ≥ 1,5, arrondi au cent inférieur.
RR_MIN = 1.5
ENTRY_CAP = math.floor((TP1 + RR_MIN * STOP) / (1 + RR_MIN) * 100) / 100
rr1 = (TP1 - ENTRY) / (ENTRY - STOP)
rr_cap = (TP1 - ENTRY_CAP) / (ENTRY_CAP - STOP)
low_0917 = bars[idx['2026-09-17']][3]
# Exemple de taille (illustratif, non personnalisé) : 10 000 $ de capital, 1 % de perte acceptée.
EX_CAPITAL, EX_RISK = 10000, 100
ex_shares_gap = EX_RISK / (ENTRY * 0.15)
ex_shares_stop = EX_RISK / (ENTRY - STOP)

def fr(x, d=2):
    s = f'{x:,.{d}f}'.replace(',', ' ').replace('.', ',')
    return s
def usd(x, d=2): return fr(x, d) + ' $'

# ------------------------------------------------------------------ jugements éditoriaux
score_components = {'base': 50, 'actif_transparent': 6, 'tendance': 8, 'dilution_structurelle': -18,
                    'dependance_hype': -12, 'extension_court_terme': -6, 'donnees_manquantes': -6}
SCORE = sum(score_components.values())
RISK_SCORE = 8
groups_order = [1, 1, 1, 2, 2, 1]

# ------------------------------------------------------------------ comparables
GROUPS = [
 ('Trésoreries crypto de référence', 1, "Même modèle : émettre des actions au-dessus de l'actif net pour acheter un actif numérique ; la prime ou décote de ces titres transmet l'appétit du marché pour la structure elle-même.",
  [('MSTR', 'leader', 'Leader historique des trésoreries bitcoin', "La valorisation de Strategy fixe la référence de prime sur actif net que le marché accepte pour un véhicule de trésorerie ; une compression de cette prime se propage à tout le segment."),
   ('BMNR', 'direct_peer', "Trésorerie en ether de grande taille", "Même mécanique d'émission continue pour acheter un token : une séance où BMNR décroche sans que l'ether baisse signale une défiance envers le modèle, pas envers l'actif."),
   ('SBET', 'direct_peer', "Trésorerie en ether financée par actions", "Corrélation la plus élevée du classement statistique : ce titre réagit comme PURR aux flux vers les trésoreries d'altcoins plus qu'à son actif propre."),
   ('ASST', 'direct_peer', "Trésorerie bitcoin de taille moyenne", "Pair de taille comparable, utile pour séparer un mouvement propre au HYPE d'un mouvement commun aux trésoreries de petite capitalisation.")]),
 ('Trésorerie HYPE concurrente', 1, "Seule autre trésorerie HYPE cotée dont les barres sont certifiées : elle isole la composante propre au token.",
  [('HYPD', 'direct_peer', "Trésorerie HYPE concurrente de petite taille", "Même actif sous-jacent : si HYPD monte avec PURR, le moteur est le HYPE ; si PURR monte seule, c'est la prime ou le flux sur PURR elle-même.")]),
 ('Exposition amont aux actifs numériques', 1, "Fonds cotés qui répliquent l'actif sous-jacent du secteur ; ils mesurent le bêta crypto général, faute de clôture HYPE certifiée.",
  [('IBIT', 'upstream', 'Fonds bitcoin coté au comptant', "Mesure le régime crypto général ; une baisse du bitcoin précède en général celle des altcoins et des trésoreries qui les portent."),
   ('ETHA', 'upstream', 'Fonds ether coté au comptant', "Proxy le plus proche d'un altcoin de première taille ; utile pour lire le HYPE, dont aucune clôture quotidienne n'est certifiée ici.")]),
 ('Plateformes et émetteurs concurrents ou partenaires', 2, "Places d'échange centralisées et émetteur de stablecoin : ils captent ou partagent le même volume de dérivés et de stablecoins que Hyperliquid.",
  [('COIN', 'downstream', 'Plateforme centralisée, partenaire USDC de Hyperliquid', "Coinbase est déployeur officiel de l'USDC sur Hyperliquid depuis mai 2026 selon le communiqué de résultats : lien commercial réel, mais aussi concurrent direct sur les dérivés."),
   ('HOOD', 'second_order', 'Courtier grand public actif en crypto', "Concurrence sur le flux des particuliers : un transfert de volume vers les dérivés décentralisés se lirait d'abord sur ce titre."),
   ('CRCL', 'downstream', "Émetteur de l'USDC utilisé sur Hyperliquid", "Le rendement des réserves USDC détenu sur Hyperliquid revient en partie au protocole : le volume de stablecoins relie les deux titres."),
   ('BLSH', 'second_order', 'Place de marché institutionnelle crypto', "Concurrent sur la liquidité institutionnelle ; transmission faible et indirecte, retenue comme contrôle."),
   ('GLXY', 'second_order', "Banque d'affaires et gérant crypto", "Exposition diversifiée au cycle crypto ; lit l'appétit institutionnel plus que le HYPE.")]),
 ('Mineurs et infrastructure', 2, "Titres à fort bêta crypto sans lien opérationnel avec Hyperliquid : ils mesurent l'appétit pour le risque du secteur.",
  [('CLSK', 'second_order', 'Mineur de bitcoin', "Bêta crypto élevé ; un décrochage commun avec PURR indiquerait un choc de secteur plutôt qu'un problème propre au HYPE."),
   ('IREN', 'second_order', 'Mineur reconverti vers le calcul pour IA', "Corrélation statistique notable mais moteur mixte crypto et IA : lien de second ordre."),
   ('MARA', 'second_order', 'Mineur et détenteur de bitcoin', "Double exposition production et trésorerie : contrôle utile du bêta bitcoin."),
   ('BTDR', 'second_order', 'Fabricant de machines et mineur', "Bêta crypto élevé, aucune exposition au HYPE : contrôle statistique.")]),
 ('Référence sectorielle', 1, "Fonds sectoriel des entreprises de la chaîne blockchain : benchmark du secteur coté.",
  [('BKCH', 'sector_proxy', 'Fonds coté des entreprises blockchain', "Mesure le mouvement moyen des actions crypto ; l'écart de PURR à ce fonds isole la part propre au titre.")]),
]

blast_groups = []
for gi, (name, order, transmission, rows) in enumerate(GROUPS):
    syms = []
    for t, cls, role, read in rows:
        rg = regress(t)
        syms.append({'ticker': t, 'role': role, **rg, 'relationClass': cls, 'readThrough': read,
                     'confidence': 'medium' if abs(rg['correlation']) >= 0.45 else 'low',
                     'eventRisk': f"Publications et annonces propres à {t} à vérifier séparément ; aucun calendrier n'est déduit de ce tableau."})
    blast_groups.append({'name': name, 'order': groups_order[gi], 'transmission': transmission, 'symbols': syms})

perf_rows = [{'ticker': 'PURR', 'returnPct': r2(ret(21))}] + [
    {'ticker': s['ticker'], 'returnPct': s['return21d']} for g in blast_groups for s in g['symbols']]

si_last = si_points[-1]
ctb_last = ctb_hist[-1].split(',')
ctb_first = ctb_hist[1].split(',') if ctb_hist[0].startswith('date') else ctb_hist[0].split(',')

# ------------------------------------------------------------------ fiche
EVIDENCE_URL = 'https://articles.dailytickers.com/data/analyses-evidence/PURR.json'
SRC_MKT = lambda what: {'name': f'{what} (preuves hachées)', 'url': EVIDENCE_URL, 'date': REF}
def sec_ref(i, name): d = primary['documents'][i]; return {'name': name, 'url': d['url'], 'date': d['date']}
FIVE = fr(ret(5), 1)

a = {
 'meta': {'lang': 'fr', 'dir': 'ltr', 'level': 'intermediate', 'tags': ['us', 'crypto', 'financials', 'speculative', 'small-cap'],
          'grade': 'C', 'date': '2026-09-24', 'dateDisplay': '24 septembre 2026',
          'description': "PURR : trésorerie en HYPE financée par une ligne de capital de 2,5 Md$. Hausse forte, dilution chiffrée, aucun ordre avant le vote prévu le 4 novembre.",
          'ogDescription': "PURR : un pari sur le HYPE, payé en dilution.",
          'version': 3, 'status': 'watch', 'levelsCloseDate': REF, 'assetType': 'stock',
          'lastMcpRefresh': status['captured_at'], 'levelsVerifiedAt': status['captured_at']},
 'header': {'ticker': 'PURR', 'name': 'Hyperliquid Strategies Inc', 'exchange': 'NASDAQ', 'sector': "Trésorerie d'actifs numériques",
            'price': closes[LAST], 'changePct': r2(ret(1)),
            'badges': [{'text': 'Trésorerie HYPE', 'color': 'purple'}, {'text': 'SURVEILLER', 'color': 'blue'}],
            'metrics': {'marketCap': f'{fr(mcap_ref_m, 0)} M$', 'volume': f'{fr(bars[LAST][5] / 1e6, 1)} M'},
            'halal': False, 'halalStatus': 'unknown'},
}

sum_txt = (f"PURR détient le HYPE, le token du réseau Hyperliquid : environ 33,2 millions d'unités au 8 septembre selon le prospectus du 23 septembre. "
           f"Le titre a pris {fr(ret(63))} % en soixante-trois séances et clôture à {usd(closes[LAST])}, à {fr((1 - closes[LAST] / TP1) * 100, 1)} % sous son plus haut depuis la cotation. "
           f"Cette hausse a été financée par l'actionnaire : 112 952 100 actions vendues à Chardan pour environ 1,1 Md$, et environ 1,4 Md$ encore mobilisables. "
           f"Au cours actuel, ce solde représenterait environ {fr(shares_spot / 1e6, 0)} millions d'actions nouvelles, soit {fr(pct_spot, 0)} % du capital. "
           f"Au 30 juin, l'action cotait {fr(p_nav_0630)} fois son actif net comptable par action ; depuis, le cours a pris {fr((closes[LAST] / close_0630 - 1) * 100, 0)} % sans clôture certifiée du HYPE pour mesurer la prime actuelle. "
           "Pas d'achat au cours actuel, ni avant le vote prévu le 4 novembre sur le plafond d'émission Nasdaq : le plan conditionnel est détaillé plus bas.")

a['verdict'] = {
 'score': SCORE, 'conviction': 'Low', 'bias': 'Neutral',
 'confidence': "Confiance faible : aucune clôture certifiée du HYPE, donc prime sur actif net actuelle non mesurable.",
 'summary': sum_txt,
 'whyBuy': [
   "Actif transparent : 29 275 085 HYPE au 30 juin en juste valeur de 1 904,1 M$ selon le 10-K, et un solde publié chaque semaine, avec une semaine de décalage.",
   "Aucune dette financière au 30 juin et 137,9 M$ de trésorerie selon le bilan annuel.",
   f"Tendance nette : {fr(ret(21))} % sur vingt et une séances, clôture au-dessus de la moyenne exponentielle à vingt séances ({usd(ema20)}).",
   "Revenu récurrent de staking et de validateur de 9,46 M$ sur l'exercice clos au 30 juin, que l'actionnaire n'obtiendrait pas sans détenir le token.",
 ],
 'whyAvoid': [
   f"Dilution chiffrable : environ 1,4 Md$ de capacité restante, soit près de {fr(shares_spot / 1e6, 0)} millions d'actions au cours actuel (+{fr(pct_spot, 0)} %) et {fr(shares_min / 1e6, 0)} millions à 12,02 $ (+{fr(pct_min, 0)} %).",
   "Si le vote prévu le 4 novembre est favorable, le plafond Nasdaq de 42 641 847 actions vendues sous 12,02 $ disparaîtrait : l'émission sous ce prix deviendrait possible.",
   f"Extension de court terme : {FIVE} % en cinq séances et RSI à {fr(rsi, 1)}, à {fr((1 - closes[LAST] / TP1) * 100, 1)} % sous le plus haut de {usd(TP1)} du 21 septembre.",
   "Le HYPE est coté sur moins de plateformes que le bitcoin ou l'ether, ce que le prospectus signale comme un risque de liquidité ; aucune clôture quotidienne HYPE n'est certifiée ici.",
   f"Le HYPE par action ne progresse pas : {fr(hype_per_1000_0630, 1)} tokens pour mille actions au 30 juin, {fr(hype_per_1000_0908, 1)} au 8 septembre, préférentielles converties.",
 ],
 'controlChecklist': [
   {'label': 'Clôture quotidienne', 'status': 'pass', 'statusLabel': 'Certifié', 'evidence': f'{len(bars)} séances continues depuis la cotation du 3 décembre 2025 jusqu’au 23 septembre 2026.', 'action': 'Base des niveaux et des régressions.'},
   {'label': 'Prix du HYPE', 'status': 'fail', 'statusLabel': 'Indisponible', 'evidence': 'Aucune clôture HYPE certifiée au 23 septembre : toutes les sources ont échoué.', 'action': 'Prime sur actif net courante non publiée.'},
   {'label': 'Dépôts SEC', 'status': 'pass', 'statusLabel': 'Ouverts', 'evidence': f'{len(primary["documents"])} dépôts décisionnels ouverts et hachés, du 10-K du 27 août au prospectus du 23 septembre.', 'action': 'Dilution chiffrée à partir des documents.'},
 ],
}

a['business'] = {
 'overview': ("<p>Hyperliquid Strategies est née le 2 décembre 2025 du rapprochement entre Sonnet BioTherapeutics et Rorschach Acquisition. "
              "La société n'a plus d'activité biotechnologique depuis la cession à Guidant Biotherapeutics du 31 mars 2026. Son objet est unique : accumuler du HYPE, le token du réseau Hyperliquid, et le placer en staking. "
              "Elle emploie cinq personnes selon son profil et opère un validateur avec Unit Labs depuis mai 2026. Ses tokens sont conservés chez Anchorage Digital Bank.</p>"
              "<p>Le modèle économique est celui d'une trésorerie d'actifs numériques. La société émet des actions, surtout via la ligne de capital ChEF conclue avec Chardan Capital Markets, puis achète du HYPE avec le produit. "
              "Ce mécanisme crée de la valeur pour l'actionnaire uniquement si les actions sont vendues au-dessus de l'actif net par action. En dessous, chaque émission dilue le HYPE détenu par action. "
              "Le 10-K précise d'ailleurs que les ventes d'actions exigent en principe un ratio cours sur actif net supérieur à un seuil cible.</p>"
              "<p>Le revenu d'exploitation reste modeste : 9,46 M$ de staking et de commissions de validateur sur l'exercice, pour 13,95 M$ de frais généraux. "
              "Le résultat net de 305,5 M$ vient d'un gain latent de 709,9 M$ sur le HYPE, diminué d'une perte de 169,2 M$ sur l'engagement d'apport et de 183,5 M$ d'impôt différé : il est comptable, pas encaissé. "
              "Le moteur de valeur reste externe : le prix du HYPE, soutenu par les rachats de token financés par 99 % des revenus du protocole selon le prospectus.</p>"),
 'segments': [{'name': 'Trésorerie HYPE', 'description': 'Actif principal, en juste valeur ; source de la quasi-totalité de la valeur et du résultat comptable.'},
              {'name': 'Staking et validateur', 'description': 'Revenu de 9,46 M$ sur l’exercice ; il ne couvre pas les frais généraux.'}],
 'moat': ("L'avantage revendiqué est la taille : la plus grande trésorerie HYPE cotée aux États-Unis selon la société, un validateur parmi les plus importants du réseau et un accès au HYPE pour des investisseurs qui ne peuvent pas détenir de token. "
          "Cet avantage est fragile : il disparaît si des fonds cotés en HYPE apparaissent, et il ne vaut quelque chose que tant que le marché paie une prime sur l'actif net."),
 'theme': 'Trésorerie d’actifs numériques, token HYPE et financement par ligne de capital',
 'coverageMatrix': [
   {'facet': 'Cours et barres quotidiennes', 'status': 'COUVERT', 'decision': f'{len(bars)} séances continues, certifiées au 23 septembre.'},
   {'facet': 'Comparables', 'status': 'COUVERT', 'decision': f'{sum(len(g["symbols"]) for g in blast_groups)} séries comparables sur 179 séances.'},
   {'facet': 'Prix du HYPE', 'status': 'INDISPONIBLE', 'decision': 'Aucune clôture certifiée : prime sur actif net courante non calculée.'},
   {'facet': 'Options', 'status': 'INEXPLOITABLE', 'decision': 'Intérêt ouvert nul et volatilité implicite non cotée sur l’échéance la plus proche.'},
 ],
 'sourceRefs': [sec_ref(D10K, '10-K — PURR, exercice clos le 30 juin 2026'), sec_ref(D424, 'Prospectus 424B3 — PURR')],
}

a['news'] = [
 {'date': '2026-09-23', 'title': 'Prospectus de revente de 160 millions d’actions', 'impact': 'negative',
  'detail': f"Chardan peut revendre jusqu'à 160 millions d'actions reçues de la ligne ; 112 952 100 étaient déjà vendues au 8 septembre. Les {fr(remaining_registered / 1e6, 2)} millions restantes ne couvrent qu'environ {fr(registered_proceeds / 1e6, 0)} M$ au cours actuel : le solde exigera un nouvel enregistrement.",
  'source': 'SEC, prospectus 424B3', 'sourceUrl': primary['documents'][D424]['url']},
 {'date': '2026-09-15', 'title': 'Vote demandé pour dépasser le plafond Nasdaq', 'impact': 'negative',
  'detail': "Le projet de circulaire soumet au vote prévu le 4 novembre l'émission au-delà de 19,99 % du capital : une approbation lèverait la dernière limite aux ventes sous 12,02 $.",
  'source': 'SEC, PRE 14A', 'sourceUrl': primary['documents'][DPRE]['url']},
 {'date': '2026-09-01', 'title': 'Ligne de capital portée à 2,5 Md$', 'impact': 'neutral',
  'detail': "L'engagement de Chardan passe de 1,0 à 2,5 Md$ : plus de capacité pour acheter du HYPE, mais aussi plus d'actions nouvelles à absorber par le marché.",
  'source': 'SEC, 8-K', 'sourceUrl': primary['documents'][DAM1]['url']},
 {'date': '2026-08-27', 'title': 'Résultats annuels : trésorerie HYPE plus que doublée', 'impact': 'positive',
  'detail': "La trésorerie passe de 12,5 à 29,3 millions de HYPE sur l'exercice, sans dette, grâce à 647 M$ levés sur la ligne de capital.",
  'source': 'SEC, 8-K communiqué', 'sourceUrl': primary['documents'][DPR]['url']},
]

FUND_PROV = {}
def frow(metric, value, signal, source, note, kind='10k', comparison=None):
    FUND_PROV[metric] = kind
    r = {'metric': metric, 'value': value, 'signal': signal, 'signalColor': 'blue', 'source': source, 'note': note}
    if comparison: r['comparison'] = comparison
    return r
a['fundamentals'] = {
 'rows': [
  frow('HYPE détenus', fr(HYPE_0630, 0), '30 juin 2026', '10-K, note 3', 'Unités de token au bilan.'),
  frow('Juste valeur du HYPE', '1 904,1 M$', '30 juin 2026', '10-K, bilan', 'Cours coté sur plateformes actives.'),
  frow('Coût de revient du HYPE', '1 363,3 M$', '30 juin 2026', '10-K, note 3', 'Plus-value latente de 540,7 M$.'),
  frow('Trésorerie', '137,9 M$', '30 juin 2026', '10-K, bilan', 'Hors USDC classé en autres actifs.'),
  frow('Total actif', '2 060,0 M$', '30 juin 2026', '10-K, bilan', 'Dominé par le HYPE.'),
  frow('Total passif', '187,1 M$', '30 juin 2026', '10-K, bilan', 'Dont 183,5 M$ d’impôt différé.'),
  frow('Dette financière', '0', '30 juin 2026', '10-K et communiqué', 'Aucune dette déclarée.'),
  frow('Revenu de staking et de validateur', '9,46 M$', 'Exercice clos le 30 juin 2026', '10-K, compte de résultat', 'Néant sur la période précédente.'),
  frow('Frais généraux et de recherche', '13,95 M$', 'Exercice clos le 30 juin 2026', '10-K, compte de résultat', 'Supérieurs au revenu d’exploitation.'),
  frow('Gain latent sur le HYPE', '709,9 M$', 'Exercice clos le 30 juin 2026', '10-K, compte de résultat', 'Réévaluation, non encaissée.'),
  frow('Perte sur engagement d’apport', '-169,2 M$', 'Exercice clos le 30 juin 2026', '10-K, compte de résultat', 'Écart entre prix convenu et cours à la clôture de la fusion.'),
  frow('Résultat net de l’exercice', '305,5 M$', 'Exercice clos le 30 juin 2026', '10-K', 'Résultat comptable, après 183,5 M$ d’impôt différé.'),
  frow('Flux de trésorerie opérationnel', '-19,1 M$', 'Exercice clos le 30 juin 2026', '10-K', 'La trésorerie vient du financement.'),
  frow('Capitaux levés via la ligne', '647 M$', 'Exercice clos le 30 juin 2026', 'Communiqué du 27 août', 'Puis environ 1,1 Md$ cumulés au 8 septembre.', 'pr'),
  frow('Actions en circulation', fr(COMMON_0908, 0), '8 septembre 2026', 'Prospectus 424B3', 'Contre 200 550 458 au 30 juin.', '424'),
  frow('Actions potentielles des préférentielles', fr(PREF_CONV, 0), '30 juin 2026', '10-K', 'Conversion initiale des 166 173 préférentielles.'),
  frow('Capitalisation de marché', f'{fr(mcap_ref_m, 0)} M$', f'Close du {REF} × actions du 8 septembre', 'Barres certifiées et prospectus', 'Hors préférentielles.', 'mcap'),
  frow('Actif net comptable par action (NAV, book value)', usd(nav_ps_0630), '30 juin 2026, après conversion des préférentielles', '10-K, bilan', 'NAV comptable : HYPE en juste valeur plus autres actifs, moins passif, impôt différé compris.'),
  frow('Cours sur actif net (P/NAV)', f'{fr(p_nav_0630)}x', f'Close du 30 juin 2026 ({usd(close_0630)}) versus NAV du 30 juin', 'Barres certifiées et 10-K',
       'Décote de NAV au 30 juin ; la prime actuelle n’est pas calculable sans clôture HYPE.', 'pnav',
       "Versus le cours de clôture du 30 juin : l'action cotait alors un peu sous la valeur de ses actifs."),
  frow('Prix du HYPE implicite (scénario NAV)', usd(implied_hype_0908), 'Au 8 septembre 2026 : cours, actions et HYPE à la même date ; autres postes du bilan au 30 juin', 'Barres certifiées, prospectus et 10-K',
       'Même base que la NAV : actifs hors HYPE et passif du 30 juin ; le nombre de 33,2 M de tokens est arrondi par la société.', 'implied',
       "Scénario NAV : si le HYPE vaut plus que ce prix, l'action cote sous la valeur de ses actifs ; s'il vaut moins, l'acheteur de l'action paie une prime."),
 ],
 'sourceRefs': [sec_ref(D10K, '10-K — PURR'), SRC_MKT('Barres quotidiennes certifiées')],
}

a['earnings'] = {
 'quarters': [],
 'nextEarnings': 'Date non confirmée par l’émetteur ; publication du premier trimestre de l’exercice 2027 non annoncée.',
 'beatNote': ("Les comptes annuels du 27 août affichent 9,46 M$ de revenu de staking et de validateur, 13,95 M$ de frais généraux et un résultat net de 305,5 M$, porté par un gain latent de 709,9 M$ sur le HYPE. "
              "Le flux opérationnel est négatif de 19,1 M$. Comparer ce résultat à un consensus de bénéfice par action n'a pas de sens : il dépend du cours du token à la date de clôture. La société ne publie aucune guidance ni outlook chiffré. "
              "Le seul indicateur prospectif utile est le nombre de HYPE par action, que la société publie chaque semaine avec une semaine de décalage. Aucune date de prochaine publication n'est confirmée."),
 'sourceRefs': [sec_ref(DPR, 'Communiqué de résultats — PURR'), sec_ref(D10K, '10-K — PURR')],
}

a['capitalStructure'] = {
 'sharesOutstanding': f'{fr(COMMON_0908, 0)} actions au 8 septembre 2026 selon le prospectus 424B3',
 'dilutionRisk': 'critical',
 'warrants': [
   {'series': 'Ligne ChEF Chardan', 'type': 'Ligne de capital engagée, pas un ATM', 'shares': f'Environ 1,4 Md$ restants, soit {fr(shares_spot / 1e6, 0)} M d’actions au cours actuel', 'expiration': 'Selon contrat', 'note': 'Chardan paie aujourd’hui 97,5 % du VWAP (95,0 % hors séance) ; 98,5 % (97,0 %) au-delà de 160 M d’actions vendues.'},
   {'series': 'Bons conseiller', 'type': 'Bons de souscription', 'shares': f'{fr(WARRANTS, 0)} actions en trois tranches à 9,375, 12,50 et 18,75 $', 'expiration': 'Cinq ans après le 2 décembre 2025', 'note': 'Deux tranches sur trois sont dans la monnaie au cours de référence.'},
   {'series': 'Préférentielles de série A', 'type': 'Actions préférentielles convertibles', 'shares': f'{fr(PREF_CONV, 0)} actions ordinaires potentielles', 'expiration': 'Sans échéance', 'note': 'Conversion soumise à un plafond de détention de 4,99 % ou 9,99 %.'},
 ],
 'atm': {'active': False, 'authorized': 'Aucun programme ATM', 'used': 'Sans objet', 'remaining': 'Sans objet'},
 'shareHistory': (f"Le capital est passé de 123 354 259 actions à la clôture de la fusion à 200 550 458 au 30 juin, puis {fr(COMMON_0908, 0)} au 8 septembre. "
                  f"Le passage au dilué ajoute {fr(PREF_CONV, 0)} actions de conversion des préférentielles et {fr(WARRANTS, 0)} actions des bons conseiller, soit {fr(diluted_0908, 0)} actions. "
                  f"La ligne de capital ajouterait le reste : environ 1,4 Md$ vendus à Chardan à 97,5 % du VWAP représenteraient près de {fr(shares_spot / 1e6, 0)} millions d'actions au cours de {usd(closes[LAST])} (+{fr(pct_spot, 0)} %), "
                  f"et {fr(shares_min / 1e6, 0)} millions au prix plancher de 12,02 $ (+{fr(pct_min, 0)} %). Les {fr(remaining_registered / 1e6, 2)} millions d'actions encore enregistrées ne couvrent qu'environ {fr(registered_proceeds / 1e6, 0)} M$ de ce solde. "
                  "Une émission au-dessus de l'actif net par action augmente le HYPE par action ; en dessous, elle le réduit."),
 'sourceRefs': [sec_ref(D424, 'Prospectus 424B3 — PURR'), sec_ref(D10K, '10-K — PURR')],
}

a['filingsReview'] = {
 'summary': f'{len(primary["documents"])} dépôts décisionnels ouverts et hachés, dont les trois amendements de la ligne de capital ; les formulaires 3, 4 et 13G ne sont pas inventoriés ici.',
 'filings': [{'date': d['date'], 'form': d['form'], 'accession': d['accession'], 'finding': d['finding'], 'url': d['url']} for d in primary['documents']],
 'contrarianRisks': [
   "La ligne de capital vend des actions quand le cours monte : la hausse finance aussi l'offre qui peut la freiner.",
   "Sans clôture HYPE certifiée, la prime actuelle sur actif net peut être bien supérieure à la décote observée au 30 juin.",
   "Si le vote prévu le 4 novembre est favorable, des émissions sous 12,02 $ deviendraient possibles.",
   "Le résultat comptable dépend du cours du token à la clôture ; il ne dit rien de la capacité à créer de la valeur par action.",
 ],
}

a['insiders'] = {'recentTransactions': [], 'signal': 'Aucune conclusion directionnelle : la couverture des déclarations d’initiés est incomplète sur la période.', 'sourceRefs': [SRC_MKT('Déclarations d’initiés')]}
a['shortInterest'] = {'siPct': f"{fr(stats['sharesShort'] / stats['floatShares'] * 100, 1)} %", 'daysToCover': fr(stats['shortRatio'], 2),
                      'trend': f"Dernier relevé fournisseur : {fr(stats['sharesShort'] / 1e6, 1)} M d'actions vendues à découvert pour un flottant de {fr(stats['floatShares'] / 1e6, 1)} M, lui-même antérieur aux émissions de septembre. Position notable mais couverte en moins de deux séances de volume : pas de configuration de squeeze.",
                      'sourceRefs': [SRC_MKT('Position vendeuse')]}
a['options'] = {'maturity': 'Inexploitable', 'maxPain': '', 'cpRatio': '', 'unusual': 'Intérêt ouvert nul et volatilité implicite non cotée : aucune inférence de flux.', 'sourceRefs': [SRC_MKT('Options')]}
a['technicals'] = {
 'ema20': r2(ema20, 4), 'ema50': r2(ema50, 4), 'ema200': r2(ema200, 4), 'rsi14': r2(rsi, 4), 'macd': r2(ml[-1], 4), 'macdSignal': r2(sig, 4), 'atr14': r2(atr, 4),
 'ma50Type': 'EMA', 'ma200Type': 'EMA', 'ma50Available': True, 'ma200Available': False,
 'badges': ['Tendance haussière', 'Étendu à court terme'],
 'supports': [ENTRY, bars[idx['2026-09-15']][3]],
 'resistances': [TP1],
 'setupNote': (f"Indicateurs calculés localement sur {len(bars)} séances certifiées ; la moyenne à deux cents séances reste indicative. "
               f"Du 31 août au 16 septembre, les clôtures sont restées entre {usd(zone_lo)} et {usd(zone_hi)}, avec un plus haut en séance de {usd(zone_top[2])} le 3 septembre ; le titre en est sorti le 18 septembre. "
               f"Support : 12.95 $, juste au-dessus de ce plus haut. Résistance : {usd(TP1)}, plus haut depuis la cotation. "
               f"Plan conditionnel : entrée de référence 12.95 $, stop 11.80 $, soit environ un ATR ({usd(atr)}) sous l'entrée et sous le plus bas du 17 septembre ({usd(low_0917)})."),
 'sourceRefs': [SRC_MKT('Barres quotidiennes')],
}
a['performance'] = {'windowReturns': {'label': 'Rendement de prix sur 21 séances, dividendes non réinvestis', 'startDate': dates[LAST - 21], 'endDate': REF, 'rows': perf_rows},
                    'sourceRefs': [SRC_MKT('Performance')]}

a['blastRadius'] = {
 'asOf': REF, 'observationTime': status['captured_at'],
 'window': f'Du {dates[LAST - WINDOW]} au {REF}, {WINDOW} rendements quotidiens',
 'methodology': ("Calcul sur les dates communes des clôtures certifiées : rendements logarithmiques quotidiens, corrélation de Pearson, bêta de PURR sur le comparable, carré de la corrélation et nombre d'observations. "
                 "Rendements simples sur cinq et vingt et une séances. Les groupes sont définis par le lien économique, pas par la corrélation ; le HYPE lui-même manque faute de clôture certifiée."),
 'groups': blast_groups,
 'scenarios': [
   {'scenario': 'bullish', 'trigger': 'Le HYPE continue de monter et la société achète plus de tokens par action.', 'firstOrder': 'L’actif net par action progresse plus vite que le nombre d’actions.', 'secondOrder': 'Les trésoreries d’altcoins suivent, SBET et BMNR en premier.', 'confirmation': 'Hausse du HYPE par action dans la mise à jour hebdomadaire.', 'contradiction': 'PURR monte sans que HYPD ne suive : prime propre, fragile.'},
   {'scenario': 'mixed', 'trigger': 'Le HYPE stagne pendant que la ligne de capital continue d’émettre.', 'firstOrder': 'Le cours se tasse sous le poids de l’offre de Chardan.', 'secondOrder': 'Aucune transmission notable aux mineurs ou aux places d’échange.', 'confirmation': 'Volume élevé sans progrès du cours au-dessus de 14,76 $.', 'contradiction': 'Suspension des ventes d’actions annoncée par la société.'},
   {'scenario': 'bearish', 'trigger': 'Le HYPE recule et la prime sur actif net se comprime en même temps.', 'firstOrder': 'Double baisse : actif et multiple, amplifiée par l’émission passée.', 'secondOrder': 'Contagion aux trésoreries de petite taille, ASST et HYPD.', 'confirmation': 'Cours sous 11,80 $ avec volume en hausse.', 'contradiction': 'Rachat d’actions relancé sous l’actif net.'},
 ],
 'contradictions': [
   "La corrélation la plus forte est avec SBET, une trésorerie en ether : le titre suit le segment autant que son propre token.",
   f"Le bêta de PURR contre le fonds ether ETHA n'est que de {fr(blast_groups[2]['symbols'][1]['beta'], 2)} : le HYPE a son propre cycle, que les fonds bitcoin et ether ne mesurent pas.",
 ],
 'missingData': [
   "Aucune clôture quotidienne HYPE certifiée au 23 septembre : prime sur actif net courante non calculable.",
   "LGHL, autre trésorerie HYPE, et FWDI ont été exclus : leurs barres présentaient des géométries invalides fin avril.",
   "Les séries de prix viennent d'une source de secours certifiée, la source principale présentant des séances manquantes.",
 ],
 'sourceRefs': [SRC_MKT('Barres des comparables'), sec_ref(DPR, 'Communiqué de résultats — PURR')],
}

a['risks'] = {
 'riskScore': RISK_SCORE, 'riskProfile': 'Very High',
 'riskSummary': ("Le risque combine trois couches : le prix d'un seul token, une prime sur actif net qui peut disparaître, et une émission d'actions continue qui transforme chaque rebond en offre. "
                 "Aucune dette n'aggrave le scénario baissier, mais rien ne le freine non plus."),
 'riskCards': [
   {'title': 'Dilution par la ligne de capital', 'severity': 'critical', 'points': [f'Environ 1,4 Md$ restants : près de {fr(shares_spot / 1e6, 0)} M d’actions au cours actuel, {fr(shares_min / 1e6, 0)} M à 12,02 $.', 'Vote prévu le 4 novembre sur le dépassement du plafond de 19,99 %.'], 'verdict': 'Risque central : il plafonne le potentiel tant que la société vend des actions dans la hausse.'},
   {'title': 'Dépendance et liquidité du HYPE', 'severity': 'high', 'points': ['Actif unique ; le 10-K cite la forte corrélation entre l’action et le token.', 'Le HYPE est coté sur moins de plateformes que le bitcoin ou l’ether : le prospectus y voit un risque de liquidité.'], 'verdict': 'Le dossier est un substitut du token, avec un risque de modèle et de liquidité en plus.'},
   {'title': 'Prime sur actif net', 'severity': 'high', 'points': [f'Décote de {fr((1 - p_nav_0630) * 100, 1)} % au 30 juin, cours en hausse de {fr((closes[LAST] / close_0630 - 1) * 100, 0)} % depuis.', 'Le solde de HYPE n’est publié qu’avec une semaine de décalage.'], 'verdict': 'Une compression de prime ferait baisser le titre même si le token tient.'},
   {'title': 'Garde et validateur', 'severity': 'medium', 'points': ['Tokens conservés chez un seul dépositaire, Anchorage Digital Bank.', 'Validateur exposé à une suspension des récompenses et, en cas de faute grave, à une perte de tokens (slashing).'], 'verdict': 'Risque opérationnel faible en probabilité, mais concentré sur l’actif unique de la société.'},
   {'title': 'Fiscalité et régulation', 'severity': 'medium', 'points': ['Impôt différé de 183,5 M$ sur plus-values latentes.', 'Risque d’impôt minimum sur les sociétés souligné dans le 10-K.'], 'verdict': 'Coût latent réel, sans effet de trésorerie immédiat, mais qui réduit l’actif net revenant à l’actionnaire.'},
 ],
 'pedagogy': (f"Pour un particulier, le risque concret est le gap : le HYPE se négocie la nuit et le week-end, pas l'action. Une baisse du token un samedi se lit à l'ouverture du lundi, sans possibilité de sortir entre-temps. "
              f"La liquidité en séance est réelle : environ {fr(dollar_vol_m, 0)} M$ échangés par séance, en médiane sur vingt séances. "
              f"Le stop de 11,80 $ est à un ATR de l'entrée ; un gap peut le franchir. Exemple de taille, non personnalisé : avec 10 000 $ de capital et 1 % de perte acceptée, soit 100 $, calculer la taille sur une perte de 15 % donne environ {fr(ex_shares_gap, 0)} actions, contre {fr(ex_shares_stop, 0)} si l'on se fiait au seul stop. "
              f"Ne pas poursuivre le titre après {FIVE} % en cinq séances, et ne pas entrer avant le résultat du vote prévu le 4 novembre."),
}

a['tradeIdea'] = {
 'entry': ENTRY, 'stop': STOP, 'tp1': TP1, 'tp2': None,
 'stopPct': f'{(STOP / ENTRY - 1) * 100:+.1f}%', 'tp1Pct': f'{(TP1 / ENTRY - 1) * 100:+.1f}%', 'tp2Pct': None,
 'rr': f'1:{rr1:.2f} (objectif 1)', 'status': 'watch',
 'entryNote': f'Clôture entre 12,95 et {fr(ENTRY_CAP)} $ après contact de 12,95 $ ; R/R de {fr(rr1)} à 12,95 $, {fr(rr_cap)} au pire prix de la bande',
 'statusNote': "Plan conditionnel : aucun ordre au cours actuel ni avant le vote prévu le 4 novembre. Niveaux calculés sur la clôture du 23 septembre, à revalider sur les barres après le vote.",
 'thesis': (f"Pas d'achat après {FIVE} % en cinq séances. Après le vote prévu le 4 novembre, l'entrée n'est valable que si une séance touche 12.95 $ puis clôture entre 12.95 et {fr(ENTRY_CAP)} $, "
            f"et si la mise à jour hebdomadaire ne montre pas de recul du HYPE par action. Rien au-dessus de {fr(ENTRY_CAP)} $ : au-delà, le ratio passerait sous 1,5. "
            f"Stop : ordre stop à 11.80 $ ; en cas de gap sous ce niveau, la sortie se fait à l'ouverture, avec une perte supérieure à {fr((1 - STOP / ENTRY) * 100, 1)} %. "
            f"Premier objectif au plus haut de {usd(TP1)} : ratio de {fr(rr1)} à 12,95 $, {fr(rr_cap)} au pire prix de la bande ({fr(ENTRY_CAP)} $). Ces niveaux datent de la clôture du 23 septembre et seront à revalider après le vote."),
 'catalysts': ['Mise à jour hebdomadaire du nombre de HYPE détenus, publiée avec une semaine de décalage.', 'Date d’enregistrement du 30 septembre puis vote prévu le 4 novembre sur le plafond d’émission.', 'Premier trimestre de l’exercice 2027, date non confirmée.'],
 'invalidation': ['Ouverture sous 12,95 $ : pas d’entrée ce jour-là ; clôture au-dessus de ' + fr(ENTRY_CAP) + ' $ : pas d’entrée non plus.', 'Ouverture ou cours sous 11,80 $ : scénario annulé, sortie par l’ordre stop.', 'Baisse du HYPE par action d’une semaine à l’autre, ou vote favorable suivi de ventes sous 12,02 $ : pas d’entrée.'],
}
a['globalScore'] = {
 'keyTakeawaysPositive': ['Actif transparent, publié chaque semaine.', 'Aucune dette financière au 30 juin.', 'Tendance haussière nette depuis juin.'],
 'keyTakeawaysNegative': [f'Dilution chiffrable : +{fr(pct_spot, 0)} % d’actions au cours actuel.', 'Prime sur actif net courante non mesurable.', 'Titre étendu après la hausse de septembre.'],
}
a['disclaimer'] = 'Document de recherche éducatif. Ni conseil financier, ni signal de trading. Aucun ordre au cours actuel.'
a['social'] = {'platforms': [], 'sourceRefs': [SRC_MKT('Sentiment')]}

# ------------------------------------------------------------------ écriture fiche + jugements
judg_paths = ['meta.date', 'meta.dateDisplay', 'meta.version', 'verdict.score', 'risks.riskScore'] + [f'blastRadius.groups.{i}.order' for i in range(len(blast_groups))]
def get(o, dotted):
    for k in dotted.split('.'): o = o[int(k)] if isinstance(o, list) else o[k]
    return o
J = {'ticker': 'PURR', 'score_components': score_components, 'judgments': {}}
for jp in judg_paths:
    J['judgments'][jp] = {'value': get(a, jp), 'reason': 'Métadonnée ou jugement éditorial explicite, distinct d’une mesure de marché.' if not jp.startswith('blast') else 'Classement économique des groupes de comparaison : premier ou second ordre de transmission.'}
wj(REV + '/editorial-judgments.json', J)
wj(ANALYSIS, a)

# ------------------------------------------------------------------ provenance
inputs = []
for name, rel in [('bars', DATA + '/bars.json'), ('comparison', DATA + '/comparison_bars.json'), ('fund', DATA + '/fundamentals.json'),
                  ('status', DATA + '/status.json'), ('insiders', DATA + '/insiders.json')]:
    inputs.append({'name': name, 'path': rel, 'sha256': sha(rel)})
inputs.append({'name': 'primary', 'path': PRIMARY_PATH, 'sha256': sha(PRIMARY_PATH), 'kind': 'primary_sec_manifest_v1'})
inputs.append({'name': 'judgments', 'path': REV + '/editorial-judgments.json', 'sha256': sha(REV + '/editorial-judgments.json'), 'kind': 'editorial_judgment'})
INP = {i['name']: i for i in inputs}
def dep(n, ptr): return {'input_path': INP[n]['path'], 'input_sha256': INP[n]['sha256'], 'source_pointer': ptr}
def prov(n, ptr, method, more=()):
    d = {**dep(n, ptr), 'input_name': n, 'method': method}
    if more: d['additional_inputs'] = list(more)
    return d
def pdoc(i, method, more=()): return prov('primary', f'/documents/{i}', method, more)
SPTR = f'{FUND_PREFIX}/{k_stats}/data/0'
SIPTR = f'{SH_PREFIX}/{ks}/data/0/points/{len(si_points) - 1}'
CTBPTR = f'{SH_PREFIX}/{kc}/data/0/history'

def source_for(path):
    if path in J['judgments']: return prov('judgments', '/judgments/' + esc(path) + '/value', J['judgments'][path]['reason'])
    m = re.match(r'^(.*)\.sourceRefs\.(\d+)\.(date|url|name)$', path)
    if m:
        ref = get(a, m.group(1) + '.sourceRefs.' + m.group(2))
        if ref['url'] == EVIDENCE_URL: return prov('status', '/captured_at', 'Date de séance de référence ; preuves hachées publiées dans le sidecar.')
        i = next(k for k, d in enumerate(primary['documents']) if d['url'] == ref['url'])
        return pdoc(i, 'Métadonnée bibliographique du document exact ouvert et haché.')
    if path == 'performance.windowReturns.label': return prov('bars', B, 'Libellé de la fenêtre de vingt et une séances.')
    if path in ('meta.levelsCloseDate', 'blastRadius.asOf', 'performance.windowReturns.endDate'): return prov('bars', f'{B}/{LAST}/0', 'Dernière séance quotidienne complète.')
    if path in ('meta.lastMcpRefresh', 'meta.levelsVerifiedAt', 'blastRadius.observationTime'): return prov('status', '/captured_at', 'Horodatage exact de la collecte.')
    if path == 'performance.windowReturns.startDate': return prov('bars', f'{B}/{LAST - 21}/0', 'Date de départ de la fenêtre de vingt et une séances.')
    if path == 'header.price': return prov('bars', f'{B}/{LAST}/4', 'Dernier close quotidien complet.')
    if path == 'header.changePct': return prov('bars', f'{B}/{LAST}/4', '100 × (close / close précédent − 1).', [dep('bars', f'{B}/{LAST - 1}/4')])
    if path == 'header.metrics.marketCap': return prov('bars', f'{B}/{LAST}/4', 'Close × actions du 8 septembre (prospectus), en millions.', [dep('primary', f'/documents/{D424}')])
    if path == 'header.metrics.volume': return prov('bars', f'{B}/{LAST}/5', 'Volume de la dernière séance, en millions.')
    if path == 'header.metrics.beta':
        _, cp = cpath('ETHA'); return prov('comparison', cp, 'Bêta local de PURR sur le fonds ether, log-rendements sur la fenêtre commune.', [dep('bars', B)])
    if path.startswith('meta.') or path.startswith('header.'): return prov('bars', B, 'Métadonnée descriptive adossée à la série certifiée.')
    if path.startswith('verdict.summary') or path.startswith('verdict.whyBuy') or path.startswith('verdict.whyAvoid') or path.startswith('verdict.confidence'):
        return prov('bars', f'{B}/{LAST}/4', 'Clôtures certifiées pour les performances ; chiffres de capital et de trésorerie recopiés des dépôts hachés.', [dep('primary', f'/documents/{D424}'), dep('primary', f'/documents/{D10K}')])
    if path.startswith('verdict.controlChecklist'): return prov('bars', B, 'Nombre de séances certifiées et dates de la série ; dépôts SEC du manifeste.', [dep('primary', '/documents')])
    if path.startswith('business.coverageMatrix'): return prov('comparison', C_PREFIX, 'Nombre de séries et de séances effectivement collectées.', [dep('bars', B)])
    if path.startswith('business.'): return pdoc(D10K, 'Description d’activité, dates de fusion et de cession, revenus : 10-K et prospectus.', [dep('primary', f'/documents/{D424}')])
    m = re.match(r'^news\.(\d+)\.', path)
    if m:
        i = next(k for k, d in enumerate(primary['documents']) if d['url'] == a['news'][int(m.group(1))]['sourceUrl'])
        return pdoc(i, 'Date du dépôt et conséquence économique attribuée.')
    m = re.match(r'^fundamentals\.rows\.(\d+)\.', path)
    if m:
        kind = FUND_PROV[a['fundamentals']['rows'][int(m.group(1))]['metric']]
        if kind == 'mcap': return prov('bars', f'{B}/{LAST}/4', 'Close × actions du 8 septembre, en millions.', [dep('primary', f'/documents/{D424}')])
        if kind == 'pnav': return prov('bars', f'{B}/{idx["2026-06-30"]}/4', 'Close du 30 juin ÷ actif net comptable par action du 30 juin.', [dep('primary', f'/documents/{D10K}')])
        if kind == 'implied': return prov('bars', f'{B}/{idx["2026-09-08"]}/4', '(Close du 8 septembre × (actions + préférentielles converties) − (trésorerie + autres actifs − passif) du 30 juin) ÷ HYPE du 8 septembre.', [dep('primary', f'/documents/{D424}'), dep('primary', f'/documents/{D10K}')])
        if kind == '424': return pdoc(D424, 'Chiffre lu dans le prospectus du 23 septembre.')
        if kind == 'pr': return pdoc(DPR, 'Capitaux levés sur l’exercice, communiqué du 27 août.', [dep('primary', f'/documents/{D424}')])
        return pdoc(D10K, 'Poste exact du 10-K au 30 juin 2026 ; montants en millions sauf unités de token et actions.')
    if path.startswith('fundamentals.'): return pdoc(D10K, 'Source proximale de la section.')
    if path.startswith('earnings.'): return pdoc(DPR, 'Comptes annuels et absence de guidance ; aucune date future confirmée.', [dep('primary', f'/documents/{D10K}')])
    if path.startswith('capitalStructure.'): return pdoc(D424, 'Actions, préférentielles, bons, capacité et prix de la ligne de capital lus dans les dépôts hachés ; actions nécessaires = capacité ÷ (close × 97,5 %).', [dep('primary', f'/documents/{D10K}'), dep('primary', f'/documents/{DAM3}'), dep('bars', f'{B}/{LAST}/4')])
    m = re.match(r'^filingsReview\.filings\.(\d+)\.', path)
    if m: return pdoc(int(m.group(1)), 'Constat et référence du dépôt exact haché.')
    if path.startswith('filingsReview.'): return prov('primary', '/documents', 'Synthèse du corpus primaire.')
    if path.startswith('shortInterest.'): return prov('fund', SPTR + '/sharesShort', 'Actions vendues à découvert ÷ flottant du fournisseur, en pourcentage ; ratio de couverture fournisseur.', [dep('fund', SPTR + '/floatShares'), dep('fund', SPTR + '/shortRatio')])
    if path.startswith('options.'): return prov('status', '/captured_at', 'Chaîne d’options collectée, jugée inexploitable ; aucune valeur publiée.')
    if path.startswith('insiders.'): return prov('insiders', '/status', 'Couverture des déclarations d’initiés.')
    if path.startswith('social.'): return prov('status', '/captured_at', 'Sentiment collecté, sans usage décisionnel.')
    if path.startswith('technicals.') or path.startswith('tradeIdea.'):
        return prov('bars', B, 'Indicateurs calculés localement (EMA, RSI et ATR de Wilder, MACD 12/26/9) et niveaux lus sur les barres certifiées ; géométrie de trade recalculée depuis les niveaux.')
    if path.startswith('performance.windowReturns.rows.'):
        i = int(path.split('.')[3]); t = a['performance']['windowReturns']['rows'][i]['ticker']
        if t == 'PURR': return prov('bars', B, 'Rendement simple de prix sur vingt et une séances.')
        _, cp = cpath(t); return prov('comparison', cp, 'Rendement simple de prix sur vingt et une séances.')
    m = re.match(r'^blastRadius\.groups\.(\d+)\.symbols\.(\d+)\.', path)
    if m:
        t = a['blastRadius']['groups'][int(m.group(1))]['symbols'][int(m.group(2))]['ticker']; _, cp = cpath(t)
        return prov('comparison', cp, 'Dates communes ; log-rendements ; Pearson, bêta PURR sur comparable, carré de corrélation, observations, rendements 5 et 21 séances.', [dep('bars', B)])
    if path.startswith('blastRadius.'): return prov('comparison', C_PREFIX, 'Fenêtre, méthode et scénarios adossés aux séries comparables ; niveaux de prix de PURR.', [dep('bars', B)])
    if path == 'risks.pedagogy': return prov('bars', f'{B}/{LAST - 19}', 'Liquidité : médiane de close × volume sur les barres pointées de LAST−19 à LAST (série listée dans numeric-evidence, bloc liquidity) ; stop, ATR et exemple de taille recalculés depuis les niveaux.', [dep('bars', f'{B}/{LAST}')])
    if path.startswith('risks.'): return pdoc(D424, 'Capacité d’émission, vote et fiscalité lus dans les dépôts ; décote au 30 juin calculée ; volumes et hausse sur barres certifiées.', [dep('primary', f'/documents/{DPRE}'), dep('bars', B)])
    if path.startswith('globalScore.') or path.startswith('disclaimer'): return prov('bars', B, 'Synthèse éditoriale.')
    raise KeyError('mapping manquant : ' + path)

claims, strings, methods = {}, {}, {}
def walk(v, path=''):
    if isinstance(v, bool): return
    if isinstance(v, (int, float)) or (isinstance(v, str) and re.search(r'\d', v)):
        claims[path] = source_for(path); methods[path] = claims[path]['method']
        if isinstance(v, str): strings[path] = v
    elif isinstance(v, dict):
        for k, x in v.items(): walk(x, f'{path}.{k}' if path else k)
    elif isinstance(v, list):
        for k, x in enumerate(v): walk(x, f'{path}.{k}' if path else str(k))
walk(a)

calc = {
 'kind': 'deterministic_analysis_calculation_v1', 'ticker': 'PURR', 'reference_close': REF,
 'analysis_sha256': sha(ANALYSIS), 'generator_path': GEN, 'generator_sha256': sha(GEN),
 'inputs': inputs, 'score_components': score_components,
 'valuation_scenario': {'status': 'non_applicable', 'reason_code': 'NON_POSITIVE_EBITDA',
                        'reason': "EBITDA fournisseur nul : aucun multiple d'EBITDA pertinent pour une trésorerie d'actifs ; la grille retenue est l'actif net.",
                        'basis': dep('fund', f'{FUND_PREFIX}/{k_fin}/data/0/ebitda')},
 'dilution_scenario': {'capacity_usd': CAP_REMAINING, 'chardan_price_ratio': CHEF_PRICE, 'shares_at_close': shares_spot, 'pct_at_close': pct_spot, 'shares_at_12_02': shares_min, 'pct_at_12_02': pct_min, 'registered_remaining_shares': remaining_registered, 'registered_proceeds_usd': registered_proceeds},
 'liquidity': {'source_artifact': DATA + '/bars.json', 'method': 'médiane de close × volume sur les vingt dernières séances', 'series': liq_series, 'median_dollar_volume_20d_musd': dollar_vol_m},
 'entry_band': {'entry': ENTRY, 'cap': ENTRY_CAP, 'stop': STOP, 'tp1': TP1, 'rr_min': RR_MIN, 'rr_entry': rr1, 'rr_cap': rr_cap, 'formula': 'cap = floor((tp1 + rr_min × stop) / (1 + rr_min), 0,01)'},
 'sizing_example': {'capital': EX_CAPITAL, 'risk_usd': EX_RISK, 'shares_on_15pct_gap': ex_shares_gap, 'shares_on_stop': ex_shares_stop},
 'nav_framework': {'non_hype_net_0630_k': NON_HYPE_NET_K, 'equity_0630_k': equity_k, 'nav_per_share_0630': nav_ps_0630, 'close_0630': close_0630, 'p_nav_0630': p_nav_0630,
                   'hype_price_0630_bilan': hype_price_0630, 'close_0908': close_0908, 'implied_hype_0908': implied_hype_0908,
                   'hype_per_1000_0630': hype_per_1000_0630, 'hype_per_1000_0908': hype_per_1000_0908},
 'values': a, 'string_numeric_claims': strings, 'methods': methods, 'claim_provenance': claims,
 'limitations': ['Aucune clôture HYPE certifiée : prime courante non calculée.', 'Actifs hors HYPE et passif du 30 juin utilisés pour le prix HYPE implicite du 8 septembre ; 33,2 M de tokens arrondis.', 'Capacité restante « environ 1,4 Md$ » (424B3) ; spread non mesuré, donc non publié.', 'LGHL et FWDI exclus pour barres invalides.'],
}
NUM = REV + '/numeric-evidence.json'
wj(NUM, calc); h = sha(NUM)
def ptr(path):
    v = get(a, path)
    return '/values/' + '/'.join(esc(k) for k in path.split('.')) if not isinstance(v, str) else '/string_numeric_claims/' + esc(path)
wj(EVIDENCE, {'ticker': 'PURR', 'reference_close': REF, 'analysis_path': ANALYSIS, 'analysis_sha256': sha(ANALYSIS),
              'claims': [{'path': k, 'value': get(a, k), 'as_of': REF, 'source_artifact': NUM, 'source_sha256': h, 'source_pointer': ptr(k)} for k in claims]})
print(f'PURR: {len(claims)} claims, score {SCORE}, NAV/action 30/06 {nav_ps_0630:.4f}, P/NAV {p_nav_0630:.4f}, HYPE implicite 08/09 {implied_hype_0908:.2f}, R/R {rr1:.2f}')
print('HYPE/1000 actions', round(hype_per_1000_0630, 2), round(hype_per_1000_0908, 2))
