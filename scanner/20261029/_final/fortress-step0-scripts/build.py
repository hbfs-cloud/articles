"""Fortress STEP 0 — assemblage déterministe de fortress-step0.json depuis les réponses brutes persistées (séance du 29/10/2026).
Aucun chiffre saisi à la main : tout est lu dans fortress-step0-raw/ ou recalculé ici.
Pré-requis : tech.py, sharia_ratio.py et dilution_scan.py exécutés (fichiers dérivés).
Étapes 1 à 3 (régime, rotation, pool, groupes) : funnel.py."""
import json, re, datetime, glob, subprocess
from collections import Counter
from funnel import *
from sharia_ratio import NATURE_EXCLUDED

OUT = os.path.join(HERE, '..', 'fortress-step0.json')
D_TECH = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-technicals.json')))
D_RATIO = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-sharia-ratios.json')))
D_DIL = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-dilution-index.json')))
MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
dfr = lambda iso: f"{'1er' if int(iso[8:10]) == 1 else int(iso[8:10])} {MOIS[int(iso[5:7]) - 1]}"


def doc_text(name):
    d = load(name)
    return d['data']['text'], d['data']['accession'], d['url']


def sub_rows(s):
    r = load('edgar_submissions_' + s)['data']['filings_recent']
    return [dict(zip(r.keys(), v)) for v in zip(*r.values())]


def sub_row(s, accn):
    m = [x for x in sub_rows(s) if x['accessionNumber'] == accn]
    assert len(m) == 1, (s, accn)
    return m[0]


def fr_int(n):
    return f"{n:,}".replace(',', ' ')


def mnum(pat, txt):
    return float(re.search(pat, txt).group(1).replace(',', ''))


# ---------- 4. Sharia ----------
fin = {}
for n in sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('20_fin_stats_')):
    fin.update({k: v['row'] for k, v in qd_rows(load(n), 'financials').items()})

sharia = {}
for s in leading:
    if s in NATURE_EXCLUDED:
        sharia[s] = {'status': 'non_compliant', 'reason': f"activité non conforme : {NATURE_EXCLUDED[s]}",
                     'evidence': [f"profil MCP {R(QP_FILE[s])} (secteur {groups[s]['sector']} / {groups[s]['industry']})"]}
        continue
    rr = D_RATIO.get(s) or {}
    pct = rr.get('debt_to_assets_pct')
    ratio_txt = (f"dette porteuse d'intérêt / actifs = {fr(pct)} % (XBRL {rr['form']} arrêté au {rr['balance_date']}, accn {rr['accn']})"
                 if pct is not None else None)
    ev = [x for x in (ratio_txt, R('edgar_companyfacts_subset_' + s)) if x]
    if pct is None:
        sharia[s] = {'status': 'unknown', 'reason': "ratio dette/actifs non calculable : aucune dette porteuse d'intérêt taguée en XBRL à la date d'arrêté", 'evidence': ev}
    elif pct > 33:
        sharia[s] = {'status': 'non_compliant', 'reason': f"dette/actifs {fr(pct)} % > 33 %", 'evidence': ev}
    else:
        sharia[s] = {'status': 'halal', 'reason': f"activité licite ({groups[s]['industry']}) ; dette/actifs {fr(pct)} % ≤ 33 % ; revenus impurs non mesurés (aucune donnée)",
                     'evidence': ev}
post_sharia = [s for s in leading if sharia[s]['status'] != 'non_compliant']


# ---------- 5. Techniques ----------
cal37, CAL37_FILE = {}, {}
for _n in ('37_calendar_a', '37_calendar_b'):
    for res in qd_results(load(_n)):
        for row in res.get('data') or []:
            cal37[row['symbol']] = row
            CAL37_FILE[row['symbol']] = _n


def tech_gate(s):
    t = D_TECH[s]
    fails = []
    if t.get('error') or t['n_bars'] < 250 or len(t['missing_ranges'] or []) > 5:
        fails.append(f"barres incomplètes ({t['n_bars']} barres servies, {len(t['missing_ranges'] or [])} séances manquantes)")
    if not t.get('stack'):
        fails.append(f"empilement EMA cassé (EMA20 {fr(t['ema20'])} / EMA50 {fr(t['ema50'])} / EMA200 {fr(t['ema200'])})")
    elif not t['ema_stack_rising']:
        flat = [f"{n} {fr(t[k.replace('_rising', '')])} contre {fr(t[k.replace('_rising', '_5ago')])} il y a 5 séances"
                for n, k in (('EMA20', 'ema20_rising'), ('EMA50', 'ema50_rising'), ('EMA200', 'ema200_rising')) if not t[k]]
        fails.append(f"empilement EMA20>EMA50>EMA200 en place mais pente non montante ({'; '.join(flat)})")
    if not (50 <= t['rsi14'] <= 68):
        fails.append(f"RSI14 {fr(t['rsi14'], 1)} hors 50-68")
    if t['abnormal_last5']:
        a = t['abnormal_last5'][-1]
        le = ((cal37.get(s) or {}).get('lastEarningsDate') or '')[:10]
        if a['date'] == le:
            fails.append(f"volume anormal le {a['date']} ({', '.join(a['flags'])}), jour de publication de ses résultats (lastEarningsDate {le} dans {R(CAL37_FILE[s])}) : publication dans les trois séances qui précèdent l'entrée")
        else:
            fails.append(f"volume anormal le {a['date']} ({', '.join(a['flags'])}) sans catalyseur bénin identifié")
    return fails


tech_fail = {s: tech_gate(s) for s in post_sharia}
tech_surv = [s for s in post_sharia if not tech_fail[s]]

# ---------- 6. Éliminatoires, flags, score ----------
cal = {e['symbol']: e for e in load('34_earnings_calendar_filtered')['response']['events']}
surp, SURP_FILE, EQ_FILE = {}, {}, {}
for _k in ('a', 'b'):
    for x in qd_results(load('36_earnings_surprises_trend_' + _k))[0]['data']:
        surp[x['symbol']] = x
        SURP_FILE[x['symbol']] = '36_earnings_surprises_trend_' + _k
        EQ_FILE[x['symbol']] = '30_earnings_quarterly_' + _k
stats = {}
for n in sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('20_fin_stats_')):
    stats.update({k: v['row'] for k, v in qd_rows(load(n), 'stats').items()})
EXCL_WINDOW_END = '2026-11-16'  # fin de la fenêtre d'exclusion résultats du scanner (horizon 11/11 + 3 séances)
WIN_START = '2026-04-28'  # fenêtre de dilution : six mois jusqu'à la clôture de référence


def ordfr(n):
    return '1re' if n == 1 else f'{n}e'


def sessions_until(date):
    """Rang de la séance NYSE de publication après REFDATE (calendrier du dépôt tools/lib/market-calendar.js)."""
    env = dict(os.environ, NODE_OPTIONS='')
    out = subprocess.run(['node', '-e', "const c=require('./tools/lib/market-calendar.js');console.log(c.usTradingDaysBetween(process.argv[1],process.argv[2]))",
                          REFDATE, date], cwd=REPO, capture_output=True, text=True, check=True, env=env).stdout.strip()
    return int(out)


GUIDANCE = {}
for s_ in tech_surv:
    GUIDANCE[s_] = {'found': None, 'detail': 'non instruite : le dossier est rejeté sur des preuves indépendantes de la guidance (résultats dans la fenêtre ou éliminatoires échoués)',
                    'date': None, 'accn': None, 'url': None, 'doc': None, 'quote': None}


def first(s, form, since='2021-10-28'):
    return [x for x in sub_rows(s) if x['form'] == form and since <= x['filingDate'] <= REFDATE]


DILUTION = {}
OFFER = ('S-1', 'S-3', 'S-3ASR', 'S-4', 'F-1', 'F-3', '424B', 'DEFM14A')
def _win_offers(s):
    return [x for x in D_DIL[s]['hits'] if x['form'].startswith(OFFER) and WIN_START <= x['filingDate'] <= REFDATE]
def _win_8k(s):
    return [x for x in D_DIL[s]['hits'] if x['form'].startswith('8-K') and any(i in (x['items'] or '').split(',') for i in ('3.02', '3.03')) and WIN_START <= x['filingDate'] <= REFDATE]
# BlackBerry : obligations convertibles 3 % 2029 (8-K du 29/01/2024 lu), hors fenêtre ; 8-K 8.01 du 22/09/2026 lu (contrat QNX)
_bb, _bb_accn, _bb_url = doc_text('edgar_doc_BB_20240129_8k')
_bbm = re.search(r'\$([\d.]+) million aggregate principal amount of its ([\d.]+)% Convertible Senior Notes due (\d{4})', _bb)
_bb2, _bb2_accn, _bb2_url = doc_text('edgar_doc_BB_20260922_8k')
assert _bbm and 'design win' in _bb2 and not _win_offers('BB') and not _win_8k('BB')
DILUTION['BB'] = {'clear': True, 'doc': 'edgar_doc_BB_20240129_8k',
                  'short': f"aucune offre d'actions dans la fenêtre ; obligations convertibles {_bbm.group(2).replace('.', ',')} % {_bbm.group(3)} ({_bbm.group(1).replace('.', ',')} M$, placées le {dfr(sub_row('BB', _bb_accn)['filingDate'])} 2024, conversion au choix du porteur) : dilution potentielle, pas une émission en cours",
                  'text': (f"8-K {_bb_accn} du {sub_row('BB', _bb_accn)['filingDate']} lu au document primaire : placement privé de {_bbm.group(1)} M$ d'obligations convertibles de premier rang à {_bbm.group(2)} % échéance {_bbm.group(3)} "
                           f"(items 1.01, 2.03 et 3.02), hors fenêtre ; dans la fenêtre, seul le 8-K {_bb2_accn} du {sub_row('BB', _bb2_accn)['filingDate']} (item 8.01, lu : contrat de conception QNX avec Vector et Coretura) et un Schedule 13D/A ; "
                           f"aucun S-3, 424B ni 8-K portant l'item 3.02 ou 3.03 depuis le {dfr(WIN_START)} 2026 ; {_bb_url}")}
EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']


def en_date(txt, after='Item 1.01'):
    m = re.search(r'On (' + '|'.join(EN_MONTHS) + r') (\d{1,2}), (\d{4})', txt[txt.find(after):])
    return f"{m.group(3)}-{EN_MONTHS.index(m.group(1)) + 1:02d}-{int(m.group(2)):02d}"


def fr_amt(x):
    return fr_int(int(x)) if float(x).is_integer() else fr(x)


# Rachats en numéraire signés (8-K item 1.01 lus au document primaire) : opération binaire, le cours est arrimé au prix offert
MERGERS = {'TECH': ('edgar_doc_TECH_20260626_8k', 'Merck KGaA', 'Merck KGaA (Darmstadt)'),
           'AES': ('edgar_doc_AES_20260302_8k', 'EQT Infrastructure VI', "des véhicules contrôlés par des fonds de Global Infrastructure Management et le fonds EQT Infrastructure VI"),
           'VRNS': ('edgar_doc_VRNS_20261015_8k', 'Proofpoint, Inc.', 'Proofpoint')}
for s_, (dn, must, acq) in MERGERS.items():
    _t, _accn, _url = doc_text(dn)
    assert must in _t and 'Agreement and Plan of Merger' in _t, s_
    _px = mnum(r'right to receive \$\s?([\d.,]+) in cash', _t)
    _sd = en_date(_t)
    _cl = D_TECH[s_]['close']
    _defm = [x for x in D_DIL[s_]['hits'] if x['form'] in ('DEFM14A', 'PREM14A') and WIN_START <= x['filingDate'] <= REFDATE]
    _dtxt = (' ; ' + ', '.join(f"{x['form']} du {dfr(x['filingDate'])}" for x in _defm) + ' dans la fenêtre (non lus)') if _defm else ''
    DILUTION[s_] = {'clear': False, 'doc': dn, 'merger_price': _px,
                    'short': (f"rachat en numéraire signé le {dfr(_sd)} {_sd[:4]} avec {acq} : {fr(_px)} $ par action (8-K {_accn}, item 1.01, lu) ; "
                              f"clôture du {dfr(REFDATE)} à {fr(_cl)} $, {fr((_px / _cl - 1) * 100)} % sous le prix offert{_dtxt}"),
                    'text': (f"8-K {_accn} du {sub_row(s_, _accn)['filingDate']} lu au document primaire : accord et plan de fusion signé le {_sd}, chaque action convertie en droit de recevoir "
                             f"{_px:.2f} $ en numéraire ; opération binaire (réalisation ou rupture) pendant l'horizon, cours arrimé au prix offert{_dtxt} ; {_url}")}
# Zeta Global : actions émises en paiement de services (424B5 lus), revente par des actionnaires
_z1, _z1a, _z1u = doc_text('edgar_doc_ZETA_20260911_424b5')
_z2, _z2a, _z2u = doc_text('edgar_doc_ZETA_20261016_424b5')
_zm1 = mnum(r'Up to \$([\d,]+) of Shares of Class A Common Stock', _z1)
_zm2 = mnum(r'Up to \$([\d,]+) of Shares of Class A Common Stock Offered by Us', _z2)
_zs2 = mnum(r'Up to ([\d,]+) Shares of Class A Common Stock Offered by the Selling Stockholders', _z2)
assert 'in satisfaction of payment for services' in _z1 and 'in satisfaction of payment for services' in _z2
_zo = [x for x in D_DIL['ZETA']['hits'] if x['form'].startswith('424B') and WIN_START <= x['filingDate'] <= REFDATE]
DILUTION['ZETA'] = {'clear': False, 'doc': 'edgar_doc_ZETA_20261016_424b5',
                    'short': (f"émissions d'actions dans la fenêtre : 424B5 du {dfr(sub_row('ZETA', _z1a)['filingDate'])} (jusqu'à {fr_amt(_zm1 / 1e6)} M$ d'actions de classe A en paiement de services) et du "
                              f"{dfr(sub_row('ZETA', _z2a)['filingDate'])} (jusqu'à {fr(_zm2 / 1e6)} M$, plus revente de {fr_int(int(_zs2))} actions par des actionnaires), lus"),
                    'text': (f"424B5 {_z1a} et {_z2a} lus au document primaire : actions de classe A émises au fil des échéances en paiement d'un prestataire, prix = moyenne pondérée des cinq séances ; "
                             f"autres prospectus de la fenêtre dans l'index : " + ', '.join(f"{x['form']} du {x['filingDate']}" for x in _zo) + f" ; {_z2u}")}
# Strive : programme de vente au fil de l'eau d'actions de préférence (424B5 du 26/10 lu)
_a1, _a1a, _a1u = doc_text('edgar_doc_ASST_20261026_424b5')
_am = re.search(r'Up to \$([\d,]+) of ([\d.]+)% Series A Perpetual SATS Preferred Stock', _a1)
assert _am and 'Controlled Equity Offering' in _a1 and 'at the market offering' in _a1
_ao = [x for x in D_DIL['ASST']['hits'] if x['form'].startswith('424B') and WIN_START <= x['filingDate'] <= REFDATE and x['accessionNumber'] != _a1a]
DILUTION['ASST'] = {'clear': False, 'doc': 'edgar_doc_ASST_20261026_424b5',
                    'short': (f"programme de vente au fil de l'eau ouvert le {dfr(sub_row('ASST', _a1a)['filingDate'])} : jusqu'à {fr(float(_am.group(1).replace(',', '')) / 1e9, 0)} Md$ d'actions de préférence perpétuelles SATS à "
                              f"{fr(float(_am.group(2)), 0)} % (424B5 lu) ; autres 424B5 de la fenêtre : " + ', '.join(f"{dfr(x['filingDate'])}" for x in _ao) + ' (non lus)'),
                    'text': (f"424B5 {_a1a} lu au document primaire : contrat de vente au fil de l'eau (Controlled Equity Offering) avec sept agents, actions de préférence perpétuelles SATS à {_am.group(2)} % "
                             f"pour un montant de {_am.group(1)} $ au plus ; {_a1u}")}
# Dossiers rejetés sur les résultats dans la fenêtre : dilution non instruite, offres de la fenêtre seulement recensées dans l'index
for s_ in tech_surv:
    if s_ in DILUTION:
        continue
    wo, w8 = _win_offers(s_), _win_8k(s_)
    lst = ', '.join(f"{x['form']} du {x['filingDate']}" for x in wo + w8)
    DILUTION[s_] = {'clear': None, 'doc': None,
                    'short': ('non instruite (dossier rejeté sur les résultats dans la fenêtre) ; index EDGAR : ' + (lst + ' dans la fenêtre, non lus' if lst else "aucune offre ni 8-K item 3.02/3.03 dans la fenêtre")),
                    'text': (f"index EDGAR des soumissions sur cinq ans ({D_DIL[s_]['window'][0]} au {REFDATE}) : " + (lst + ' dans la fenêtre de dilution, documents non lus' if lst else "aucun formulaire d'offre ni 8-K portant l'item 3.02 ou 3.03 dans la fenêtre de dilution")
                             + " ; dossier rejeté sur la date de résultats, dilution non instruite")}


def levels_geometry(s):
    t = D_TECH[s]
    entry = t['close']; atr = t['atr14']
    atr_lo, atr_hi = entry - 2 * atr, entry - 1.6 * atr
    sup = t['low10'] if t['low10'] < entry else None
    if sup is not None and sup >= atr_lo:
        stop, basis = min(sup, atr_hi), f"plus bas 10 séances {fr(sup)} (dans/au-dessus de la bande 1,6-2 ATR [{fr(atr_lo)} ; {fr(atr_hi)}])"
    else:
        stop, basis = atr_hi, f"close − 1,6×ATR14 (support 10 séances {fr(sup) if sup else 'absent'} sous la bande)"
    risk = entry - stop
    res = [x for x in (t['high60'], t['high250']) if x > entry]
    res_lvl = min(res) if res else None
    rr = (res_lvl - entry) / risk if res_lvl else None
    return {'entry': entry, 'stop': stop, 'stop_basis': basis, 'risk': risk, 'nearest_resistance': res_lvl,
            'rr_to_resistance': rr, 'tp_needed_2_5R': entry + 2.5 * risk}


def score(s):
    t = D_TECH[s]
    guid = GUIDANCE[s]['found'] is True
    beats = surp[s]['consecutive_beats']
    fpe = q[s].get('forwardPE')
    ext_ok = t['ext_ema20_pct'] <= 3 and t['ema_stack_rising'] and 50 <= t['rsi14'] <= 68
    peg = stats[s].get('pegRatio')
    peg_ok = bool(peg) and 0 < peg < 1.5
    f = load('edgar_companyfacts_subset_' + s)['data']['facts'].get('us-gaap', {})
    rep = [x for x in f.get('PaymentsForRepurchaseOfCommonStock', {}).get('units', {}).get('USD', []) if x['filed'] <= REFDATE and x.get('start', '').startswith('2026')]
    rep_last = max(rep, key=lambda x: (x['end'], x['filed'])) if rep else None
    buyback = bool(rep_last and rep_last['val'] > 0)
    div = (q[s].get('dividendYield') or 0) > 0
    structure = t['sessions_above_ema50'] >= 15 and t['ema_stack_rising'] and 50 <= t['rsi14'] <= 68
    geo = levels_geometry(s)
    rr_ok = geo['rr_to_resistance'] is not None and geo['rr_to_resistance'] >= 2.5
    sec_ok = DILUTION[s]['clear'] is True and not [a for a in t['abnormal_last5']]
    comp = {'guidance_relevee': 5 if guid else 0, 'beats_eps_5': 5 if beats >= 5 else 0, 'valorisation_pe_fwd_35': 5 if (fpe and 0 < fpe < 35) else 0,
            'extension_ema20_3pct': 5 if ext_ok else 0, 'peg_1_5': 15 if peg_ok else 0, 'buyback_actif': 8 if buyback else 0,
            'dividende_actif': 7 if div else 0, 'structure_validee': 20 if structure else 0, 'rr_2_5': 15 if rr_ok else 0,
            'sec_clean_catalyseur': 15 if sec_ok else 0}
    detail = {'guidance': GUIDANCE[s]['found'], 'consecutive_beats': beats, 'forward_pe': fpe, 'ext_ok': ext_ok, 'peg_ratio_raw': peg,
              'buyback_ytd_2026_usd': rep_last['val'] if rep_last else None,
              'buyback_basis': (f"XBRL PaymentsForRepurchaseOfCommonStock {rep_last['start']}→{rep_last['end']} ({rep_last['form']} {rep_last['accn']})" if rep_last else 'aucun rachat 2026 tagué en XBRL ≤ refdate'),
              'dividend_yield': q[s].get('dividendYield'), 'sessions_above_ema50': t['sessions_above_ema50'], 'geometry': geo}
    return sum(comp.values()), comp, detail


excluded, cands = {}, []
for s in mid_syms:
    gs = groups[s]
    if gs['class'] != 'leader':
        excluded[s] = f"Groupe {'en retrait' if gs['class'] == 'laggard' else 'neutre'} ({gs['sector']} / {gs['industry']}) : {gs['why']}."
    elif sharia[s]['status'] == 'non_compliant':
        excluded[s] = f"Non conforme Sharia : {sharia[s]['reason']}."

for s in post_sharia:
    t = D_TECH[s]
    base = {
        'ticker': s, 'name': (load('edgar_company_tickers_subset')['data'].get(s) or {}).get('title'),
        'group': f"{groups[s]['sector']} / {groups[s]['industry']} ({groups[s]['why']})",
        'market_cap': q[s]['marketCap'], 'close': t['close'], 'ema20': r2(t['ema20'], 4), 'ema50': r2(t['ema50'], 4), 'ema200': r2(t['ema200'], 4),
        'rsi': r2(t['rsi14']), 'atr': r2(t['atr14'], 4), 'ext_ema20_pct': r2(t['ext_ema20_pct']), 'ema_stack_rising': t['ema_stack_rising'],
        'avg_volume_50': r2(t['avg_volume_50'], 0), 'bars_source': t['source_file'], 'sharia': sharia[s],
    }
    if s in tech_surv:
        tot, comp, det = score(s)
        g = GUIDANCE[s]; dl = DILUTION[s]
        nxt = cal37[s]['nextEarningsDate'][:10]
        if s in cal:
            assert cal[s]['report_date'] == nxt, (s, cal[s]['report_date'], nxt)
        rank = sessions_until(nxt)
        elim_failed = []
        if det['guidance'] is not True:
            elim_failed.append('guidance relevée non prouvée' if det['guidance'] is None else 'guidance relevée')
        if det['consecutive_beats'] < 5: elim_failed.append(f"beats EPS consécutifs = {det['consecutive_beats']} (< 5)")
        if not (det['forward_pe'] and 0 < det['forward_pe'] < 35): elim_failed.append(f"PE forward {fr(det['forward_pe'])} hors ]0 ; 35[")
        if not det['ext_ok']: elim_failed.append(f"extension EMA20 {fr(t['ext_ema20_pct'])} % > 3 %" if t['ext_ema20_pct'] > 3 else 'structure EMA/RSI')
        flag_failed = []
        if dl['clear'] is not True:
            flag_failed.append(f"flag dilution/événement : {dl['short']}" if dl['clear'] is False else f"dilution non classée : {dl['short']}")
        if rank <= 10 or nxt <= EXCL_WINDOW_END:
            flag_failed.append(f"résultats le {nxt} ({ordfr(rank)} séance après le {REFDATE}{', dans les 10 séances' if rank <= 10 else ''}{', dans la fenêtre d’exclusion du scanner (fin ' + EXCL_WINDOW_END + ')' if nxt <= EXCL_WINDOW_END else ''})")
        missing = []
        if not det['peg_ratio_raw'] or det['peg_ratio_raw'] <= 0:
            missing.append('PEG : stats.pegRatio absent ou nul, aucune estimation substituée')
        missing.append(f"historique EPS limité à {surp[s]['quarters_available']} trimestres par la source : ≥ 5 beats non démontrables")
        if det['guidance'] is None:
            missing.append('guidance du dernier trimestre non instruite')
        grade = 'A+' if (tot >= 92 and not elim_failed and not flag_failed and sharia[s]['status'] == 'halal') else (
            'A' if tot >= 88 and len(elim_failed) <= 1 else 'reject')
        votes = {
            'quant': f"NON — score {tot}/100 ({'< 88' if tot < 88 else '< 92'}) ; {det['consecutive_beats']} beats consécutifs sur {surp[s]['quarters_available']} trimestres servis.",
            'pm_alpha': (f"NON — guidance relevée prouvée le {g['date']} ({g['detail']}), mais {', '.join(elim_failed) or 'score insuffisant'}." if det['guidance'] else f"NON — {', '.join(elim_failed)}."),
            'risk': f"NON — prochaine publication le {nxt} ({ordfr(rank)} séance) ; R/R vers la résistance {fr(det['geometry']['rr_to_resistance']) if det['geometry']['rr_to_resistance'] else 'non calculable (aucune résistance au-dessus)'}.",
            'short_seller': f"NON — {dl['short']}.",
        }
        base.update({
            'guidance_raised': {'value': det['guidance'] if det['guidance'] is not None else 'unknown',
                                'evidence': (f"8-K {g['accn']} Ex. 99.1 du {g['date']} : « {g['quote']} » ({g['detail']}) ; {g['url']} ; {R(g['doc'])}" if g['doc'] else g['detail'])},
            'eps_beats': {'count': det['consecutive_beats'],
                          'series': [{'period': x['period'], 'actual': x['eps_actual'], 'estimate': r2(x['eps_estimate'], 5), 'beat': x['beat']} for x in surp[s]['quarters']],
                          'evidence': R(SURP_FILE[s]) + ' (+ ' + R(EQ_FILE[s]) + ')'},
            'pe_forward': {'value': r2(det['forward_pe'], 2), 'source': R(QP_FILE[s]) + ' quote.forwardPE'},
            'next_earnings': {'date': nxt, 'within_10_sessions': rank <= 10, 'within_scanner_exclusion_window': nxt <= EXCL_WINDOW_END,
                              'evidence': f"{R(CAL37_FILE[s])} nextEarningsDate = {cal37[s]['nextEarningsDate']} ({cal37[s]['earningsCalendarSource']})"
                                          + (f", recoupé par {R('34_earnings_calendar_filtered')}" if s in cal else ", hors de l'horizon de 30 jours de " + R('34_earnings_calendar_filtered'))
                                          + f" ; {ordfr(rank)} séance après le {REFDATE}"},
            'dilution': {'clear': dl['clear'], 'window': D_DIL[s]['window'], 'filings_reviewed': len(D_DIL[s]['hits']),
                         'evidence': f"{dl['text']} ; index EDGAR {R('edgar_submissions_' + s)}" + (f" ; document primaire {R(dl['doc'])}" if dl['doc'] else '')},
            'score_100': tot, 'score_breakdown': comp,
            'grade': grade, 'eliminators_failed': elim_failed + flag_failed, 'missing_proofs': missing,
            'war_room': {'votes': votes, 'verdict': 'REJET (0/4 oui)' if grade == 'reject' else 'À REVOIR'},
            'levels': None,
            'notes': {'score_inputs': {k: v for k, v in det.items() if k != 'geometry'},
                      'geometry_for_rr_component_only': {k: r2(v, 4) if isinstance(v, float) else v for k, v in det['geometry'].items()}},
        })
        if grade == 'reject':
            excluded[s] = f"Note {tot}/100 : " + ' ; '.join(elim_failed + flag_failed) + '.'
    else:
        tf = tech_fail[s]
        base.update({
            'guidance_raised': {'value': 'unknown', 'evidence': 'non instruit : rejet technique en amont'},
            'eps_beats': {'count': None, 'series': [], 'evidence': 'non instruit : rejet technique en amont'},
            'pe_forward': {'value': r2(q[s].get('forwardPE')), 'source': 'quote MCP (non utilisé pour la décision)'},
            'next_earnings': {'date': None, 'within_10_sessions': 'unknown', 'evidence': 'non instruit : rejet technique en amont'},
            'dilution': {'clear': 'unknown', 'window': None, 'filings_reviewed': 0, 'evidence': 'non instruit : rejet technique en amont'},
            'score_100': None, 'score_breakdown': {'note': 'non noté : rejet technique avant les éliminatoires'},
            'grade': 'reject', 'eliminators_failed': [f"technique : {x}" for x in tf], 'missing_proofs': [],
            'war_room': {'votes': {k: 'NON — rejet technique, dossier non instruit.' for k in ('quant', 'pm_alpha', 'risk', 'short_seller')}, 'verdict': 'REJET (0/4 oui)'},
            'levels': None,
        })
        excluded[s] = 'Rejet technique : ' + ' ; '.join(tf) + '.'
    cands.append(base)

by = {c['ticker']: c for c in cands}
earn_clear = [s for s in tech_surv if not by[s]['next_earnings']['within_10_sessions'] and not by[s]['next_earnings']['within_scanner_exclusion_window']]
elim_all = [s for s in tech_surv if not [x for x in by[s]['eliminators_failed'] if not x.startswith(('flag', 'résultats', 'dilution'))]]
aplus = [c for c in cands if c['grade'] == 'A+']
a_grade = [c for c in cands if c['grade'] == 'A']

# ---------- 7. Note contrarienne et limites (chiffres lus dans les fichiers) ----------
FR_SECTOR = {'Healthcare': 'santé', 'Energy': 'énergie', 'Real Estate': 'immobilier', 'Financial Services': 'finance',
             'Consumer Cyclical': 'consommation discrétionnaire', 'Technology': 'technologie', 'Industrials': 'industrie',
             'Basic Materials': 'matériaux', 'Communication Services': 'communication', 'Utilities': 'services publics',
             'Consumer Defensive': 'consommation de base'}
NAMEFR = {'TALO': 'Talos Energy (TALO)', 'TECH': 'Bio-Techne (TECH)', 'BB': 'BlackBerry (BB)', 'DHT': 'DHT Holdings (DHT)',
          'ZETA': 'Zeta Global (ZETA)', 'VRNS': 'Varonis (VRNS)', 'AES': 'AES Corporation (AES)', 'ASST': 'Strive (ASST)'}
NCNAME = {'SM': 'SM Energy', 'KD': 'Kyndryl', 'FRO': 'Frontline', 'CLF': 'Cleveland-Cliffs', 'BAX': 'Baxter', 'DBX': 'Dropbox',
          'CRGY': 'Crescent Energy', 'AQN': 'Algonquin Power & Utilities', 'TRU': 'TransUnion'}
_ps = Counter(groups[x]['sector'] for x in post_sharia)
_ps_txt = ', '.join(f"{FR_SECTOR[k]} {v}" for k, v in _ps.most_common())
_lag = [FR_SECTOR[k] for k, v in sector_rs.items() if v['in_mcp_worst'] or (v['rs5_pts'] < 0 and v['rs21_pts'] < 0)]
_nc_ratio = [s for s in leading if sharia[s]['status'] == 'non_compliant' and s not in NATURE_EXCLUDED]
_nat = [s for s in leading if s in NATURE_EXCLUDED]
assert _nat == ['FNB', 'RYAN', 'CRBG', 'CLOV', 'FHB'], _nat
_earn_out = sorted([s for s in tech_surv if by[s]['next_earnings']['within_10_sessions'] or by[s]['next_earnings']['within_scanner_exclusion_window']], key=lambda s: (by[s]['next_earnings']['date'], s))
_rest = [s for s in tech_surv if s not in _earn_out]
assert _rest == ['BB'] and by['BB']['grade'] == 'reject', [(x, by[x]['grade']) for x in _rest]
_nc_txt = ', '.join(NCNAME[x] + ' (' + ('' if NCNAME[x] == x else x + ', ') + fr(D_RATIO[x]['debt_to_assets_pct']) + ' %' + (', bilan du ' + dfr(D_RATIO[x]['balance_date']) + ' ' + D_RATIO[x]['balance_date'][:4] if D_RATIO[x].get('fallback') else '') + ')' for x in _nc_ratio)
_tech_out = [s for s in post_sharia if s not in tech_surv]
_tech_why = {s: ('volume anormal le jour de ses résultats' if 'jour de publication de ses résultats' in tech_fail[s][0] else tech_fail[s][0].split(' (')[0]) for s in _tech_out}
_tech_groups = Counter(_tech_why.values())
_b = by['BB']
_dht6k = sum(1 for x in sub_rows('DHT') if x['form'] == '6-K' and WIN_START <= x['filingDate'] <= REFDATE)
_mg = [s for s in _earn_out if s in MERGERS]
assert _mg == ['VRNS', 'AES', 'TECH'], _mg
assert all(0 <= DILUTION[s]['merger_price'] / D_TECH[s]['close'] - 1 < 0.02 for s in _mg)
_mg_txt = ', '.join(f"{NAMEFR[s].split(' (')[0]} ({fr(DILUTION[s]['merger_price'])} $ offerts, clôture {fr(D_TECH[s]['close'])} $)" for s in ('TECH', 'AES', 'VRNS'))
contrarian = (
    f"Sur {len(leading)} noms des groupes en tête, {len(_nat)} sortent sur la nature de l'activité : deux banques régionales (F.N.B., First Hawaiian), un intermédiaire d'assurance (Ryan Specialty), "
    f"un assureur vie et retraite que la source range en « Asset Management » (Corebridge Financial) et un assureur santé (Clover Health) ; "
    f"{len(_nc_ratio)} sortent sur le ratio de dette (au-delà de 33 % des actifs) : {_nc_txt}. "
    f"{len(_tech_out)} autres tombent sur la technique : {', '.join(k + ' (' + ', '.join(s for s in _tech_out if _tech_why[s] == k) + ')' for k in _tech_groups)}. "
    f"Des {len(tech_surv)} dossiers qui passent la technique, {len(_earn_out)} publient leurs résultats avant la fin de la fenêtre d'exclusion du {dfr(EXCL_WINDOW_END)} "
    f"({', '.join(NAMEFR[s] + ' le ' + dfr(by[s]['next_earnings']['date']) for s in _earn_out)}) : c'est le pic de la saison. "
    f"Trois d'entre eux font l'objet d'une offre de rachat en numéraire signée et clôturent à moins de 2 % du prix offert : {_mg_txt} ; c'est une opération binaire, pas une tendance. "
    f"Zeta Global émet des actions en paiement de services et Strive a ouvert un programme de vente au fil de l'eau d'actions de préférence : les deux échouent aussi sur la dilution. "
    f"Reste BlackBerry (BB), qui ne publie que le {dfr(_b['next_earnings']['date'])}, hors fenêtre, mais tombe sur trois éliminatoires : PE prévisionnel {fr(_b['pe_forward']['value'])}, au-dessus de 35 ; "
    f"extension {fr(_b['ext_ema20_pct'])} % sur la moyenne à vingt séances, au-dessus de 3 % ; et {_b['eps_beats']['count']} résultats au-dessus du consensus sur {surp['BB']['quarters_available']} trimestres servis, quand il en faut cinq d'affilée. "
    f"Les {len(post_sharia)} noms conformes ou non démontrés se répartissent en {_ps_txt}, tandis que les secteurs {(', '.join(_lag[:-1]) + ' et ' + _lag[-1]) if len(_lag) > 1 else _lag[0]} {'est' if len(_lag) == 1 else 'sont'} en retrait "
    f"(liste sectors.worst de performance_rotations, ou ETF sectoriel sous SPY sur 5 et 21 séances) : "
    f"aucun A+ mid-cap halal, et le pool vide est le résultat honnête. La Réserve fédérale a rendu sa décision de taux le mercredi 28 octobre (registre data/scheduled-events.json) ; "
    f"l'indice des prix PCE et le PIB américains sortent ce jeudi 29 octobre à 8 h 30, heure de New York (scanner/20261029/_data/economic_events.json) : aucune entrée nouvelle du book n'y est exposée."
)
_partial = sorted(x for x in post_sharia if D_TECH.get(x, {}).get('missing_ranges'))
_big_holes = [x for x in _partial if len(D_TECH[x]['missing_ranges'] or []) > 5]
_small = [x for x in _partial if x not in _big_holes]
_unk = [x for x in post_sharia if sharia[x]['status'] == 'unknown']
_unk_names = {'PATH': 'UiPath', 'FIG': 'Figma', 'TOST': 'Toast', 'ASST': 'Strive', 'AES': 'AES'}
_ifrs = sorted(x for x in D_RATIO if D_RATIO[x].get('taxonomy') == 'ifrs-full')
_stale_bal = sorted(x for x in D_RATIO if D_RATIO[x].get('balance_date') and D_RATIO[x]['balance_date'] < '2026-01-01' and not D_RATIO[x].get('fallback'))
_fb = sorted(x for x in D_RATIO if D_RATIO[x].get('fallback'))
assert _fb == ['BAX'] and all(any('barres incomplètes' in f for f in tech_fail[x]) for x in _big_holes)
assert all((D_RATIO[x]['debt_to_assets_pct'] > 33) == (D_RATIO[x]['mcp_debt_to_assets_pct'] > 33) for x in _stale_bal), _stale_bal
_hole = D_TECH[_big_holes[0]]['missing_ranges'] if _big_holes else []
assert all(D_TECH[x]['missing_ranges'] == _hole for x in _big_holes)
_ax = D_RATIO['AES']
_bx = D_RATIO['BAX']
assert _bx['debt_to_assets_pct'] > 33 and _bx['mcp_debt_to_assets_pct'] > 33
_vr = D_RATIO['VRNS']
_beats_cap = [x for x in tech_surv if surp[x]['consecutive_beats'] == surp[x]['quarters_available'] == 4]
_unk_other = [x for x in _unk if x != 'AES']
assert all(by[x]['grade'] == 'reject' for x in _unk)
limits = [
    f"performance_rotations est un facet « current » (statut {rot.get('status')}, univers source daté {rot['source_status']['universe']['fetched_at']}, fraîcheur « {rot['source_status']['universe']['status']} », fenêtre non précisée) ; la rotation sectorielle est recoupée par la force relative des ETF SPDR sur barres certifiées au {REFDATE}.",
    f"Le screener borné en capitalisation a renvoyé {len(mid_syms)} noms ; le contrôle sans borne ({pool_ctrl['total']} noms, sans capitalisation dans la réponse) a été coté en entier : aucun autre titre dont la capitalisation quote tombe entre 2 et 20 G$ : aucun candidat manqué.",
    "Capitalisations et fondamentaux (screener, quote, stats, financials) sont des instantanés courants (market_cap_point_in_time=false), relevés le jeudi 29/10 avant l'ouverture ; aucune barre ni aucun dépôt postérieur à la clôture de référence du mercredi 28/10 n'a servi.",
    "RunAutoScreener n'est pas appelé (refusé par les permissions du dépôt) ; le régime vient de la collecte scanner du jour (" + regime['source_file'] + ").",
    f"earnings_surprises ne sert que {max(surp[x]['quarters_available'] for x in tech_surv)} trimestres au plus : une série de 5 beats n'est jamais démontrable par cette source ; {', '.join(NAMEFR[x] for x in _beats_cap)}, avec 4 beats sur 4 trimestres servis, butent sur cette limite.",
    (f"QueryData financials est « current-only » ; le ratio dette/actifs vient de l'XBRL EDGAR (dernier 10-Q/10-K{(', ou rapport IFRS 20-F pour ' + ', '.join(_ifrs)) if _ifrs else ''}, déposé avant la référence). "
     f"{', '.join(_unk_names.get(x, x) for x in _unk_other)} ne taguent aucune dette porteuse d'intérêt à la date d'arrêté : conformité inconnue, sans effet sur leurs verdicts (rejetés sur la technique, ou sur les résultats et la dilution pour Strive). "
     f"AES : aucune des balises de dette retenues n'est renseignée au {_ax['balance_date']} en XBRL us-gaap, alors que la dette fournisseur représente {fr(_ax['mcp_debt_to_assets_pct'])} % des actifs : conformité inconnue faute de preuve XBRL, sans effet (offre de rachat et résultats dans la fenêtre). "
     f"Baxter : le 10-Q au {_bx['fallback']['latest_balance_date']} ne tague que la part courante de la dette ; ratio calculé sur le bilan du {_bx['balance_date']} ({fr(_bx['interest_bearing_debt'] / 1e9, 3)} Md$ de dette à long terme pour {fr(_bx['assets'] / 1e9, 3)} Md$ d'actifs, {fr(_bx['debt_to_assets_pct'])} %), dette fournisseur {fr(_bx['mcp_debt_to_assets_pct'])} % : au-dessus du seuil dans les deux lectures. "
     f"Bilans antérieurs au 1er janvier 2026 pour {', '.join(_stale_bal)} (derniers bilans tagués déposés avant la référence) : lectures XBRL et fournisseur du même côté du seuil pour chacun. "
     f"Varonis à {fr(_vr['debt_to_assets_pct'])} % sur ses seules obligations convertibles (XBRL ConvertibleDebtNoncurrent), {fr(_vr['mcp_debt_to_assets_pct'])} % en dette fournisseur : conforme sous le seuil dans les deux lectures."),
    ("Cinq des trente noms des groupes en tête sortent sur la nature de l'activité, d'après leur profil : F.N.B. et First Hawaiian (banques régionales), Ryan Specialty (produits et services d'assurance de spécialité pour courtiers, agents et assureurs), "
     "Corebridge Financial (rangée en « Asset Management » par la source mais décrite comme assureur vie et retraite) et Clover Health (plans Medicare Advantage). TransUnion est une agence d'évaluation du crédit, pas un prêteur : jugée sur son ratio de dette, elle sort. "
     "Strive (gestionnaire d'actifs d'après son profil) et les services publics AES et Algonquin sont jugés sur leur ratio de dette."),
    "Revenus impurs non mesurés : pour les noms conformes, le statut halal repose sur la nature d'activité et le ratio dette porteuse d'intérêt / actifs (≤ 33 %).",
    (f"Barres incomplètes sur {', '.join(_big_holes)} : {len(_hole)} séances manquent entre la première barre servie ({D_TECH[_big_holes[0]]['first_bar']}) et le {_hole[-1]['end']}, sur {D_TECH[_big_holes[0]]['n_bars']} barres servies ; ils sont rejetés pour barres incomplètes (leur empilement EMA est aussi cassé). "
     f"{', '.join(x + ' (' + str(len(D_TECH[x]['missing_ranges'])) + (' séance manquante, ' if len(D_TECH[x]['missing_ranges']) == 1 else ' séances manquantes, ') + ', '.join(m['start'] for m in D_TECH[x]['missing_ranges']) + ')' for x in _small)} : aucun verdict n'en dépend."),
    ("Dilution et opérations lues au document primaire : BlackBerry (8-K du 29 janvier 2024 : obligations convertibles à 3 % 2029, conversion au choix du porteur, hors fenêtre ; 8-K du 22 septembre 2026 : contrat QNX) ; "
     + ' ; '.join(f"{NAMEFR[x]} — {DILUTION[x]['short']}" for x in ('TECH', 'AES', 'VRNS', 'ZETA', 'ASST')) + '. '
     + f"Pour {' et '.join(NAMEFR[x] for x in _earn_out if DILUTION[x]['doc'] is None)}, rejetés sur la date de résultats, la dilution n'est pas instruite : "
     + ' ; '.join(f"{NAMEFR[x]} — {DILUTION[x]['short'].split(' ; ', 1)[1]}" for x in _earn_out if DILUTION[x]['doc'] is None)
     + f" ; DHT Holdings est un émetteur étranger : ses {_dht6k} rapports 6-K de la fenêtre ne sont pas relevés par cet index ni lus."),
    f"La guidance n'est instruite pour aucun des {len(tech_surv)} survivants techniques : chacun est rejeté sur des preuves qui n'en dépendent pas (résultats dans la fenêtre pour {len(_earn_out)} ; PE prévisionnel, extension et série de beats pour BlackBerry).",
    "Les niveaux (entrée/stop/objectif) ne sont publiés que pour un A+ ; la géométrie des dossiers instruits ne sert qu'à la composante R/R du score.",
]
raw_files = sorted(rel(x) for x in glob.glob(os.path.join(RAW, '*.json')))

doc = {
    'reference_close': REFDATE,
    'pm_ran_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'pm_status': 'step0_executed',
    'mandate': 'Fortress = book A+ halal, actions US mid-cap 2 à 20 Md$, crible propre (STEP 0). Aucun ordre broker.',
    'regime': regime,
    'rotation': rotation,
    'funnel': {'screened': pool_ctrl['total'], 'midcap_2_20b': len(mid_syms), 'leading_groups': len(leading),
               'post_sharia': len(post_sharia), 'technical_survivors': len(tech_surv), 'earnings_clear': len(earn_clear),
               'eliminatories_all_passed': len(elim_all), 'aplus': len(aplus), 'a': len(a_grade),
               'post_sharia_confirmed': sum(1 for s in post_sharia if sharia[s]['status'] == 'halal'),
               'post_sharia_unknown': sum(1 for s in post_sharia if sharia[s]['status'] == 'unknown')},
    'candidates': cands,
    'fortress_pool': [],
    'watch': [{'ticker': c['ticker'], 'name': c['name'], 'grade': 'A', 'compliance_status': c['sharia']['status'], 'sharia_reason': c['sharia']['reason'],
               'market_cap': c['market_cap'], 'close': c['close'], 'rsi': c['rsi'], 'ext_ema20_pct': c['ext_ema20_pct'], 'ema_stack_rising': c['ema_stack_rising'],
               'next_earnings': c['next_earnings'], 'eliminators_failed': c['eliminators_failed'], 'missing_proofs': c['missing_proofs']} for c in a_grade],
    'excluded': excluded,
    'contrarian_note': contrarian,
    'limits': limits,
    'raw_files': raw_files,
}
json.dump({'screen_expr': load('06_screen_pool_mcap')['args']['pass_expr'], 'screen_control_expr': load('07_screen_pool_nomcap_control')['args']['pass_expr'],
           'midcap': mid_syms, 'leading': leading, 'post_sharia': post_sharia, 'technical_survivors': tech_surv,
           'earnings_clear': earn_clear, 'eliminatories_all_passed': elim_all}, open(os.path.join(HERE, '..', 'fortress-step0-derived-funnel.json'), 'w'), indent=1, ensure_ascii=False)
assert not aplus  # aucun A+ : pas de niveaux ni de fortress_pool à produire
json.dump(doc, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(json.dumps(doc['funnel'])); print('A+', [c['ticker'] for c in aplus], 'A', [c['ticker'] for c in a_grade])
for c in cands: print(c['ticker'], c['grade'], c['score_100'], c['eliminators_failed'])
print(contrarian)
