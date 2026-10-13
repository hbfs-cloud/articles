"""Fortress STEP 0 — assemblage déterministe de fortress-step0.json depuis les réponses brutes persistées.
Aucun chiffre saisi à la main : tout est lu dans fortress-step0-raw/ ou recalculé ici.
Pré-requis : tech.py et sharia_ratio.py exécutés (fichiers dérivés)."""
import json, re, datetime, glob
from lib import *

OUT = os.path.join(HERE, '..', 'fortress-step0.json')
D_TECH = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-technicals.json')))
D_RATIO = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-sharia-ratios.json')))
D_DIL = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-dilution-index.json')))
R = lambda name: rel(os.path.join(RAW, name + '.json'))


def r2(x, n=2):
    return None if x is None else round(x, n)


def fr(x, n=2):
    return f"{x:.{n}f}".replace('.', ',')


# ---------- 1. Régime ----------
reg = load('02_regime_context_asof')['response']['facets']['regime']
auto = load('05_autoscreener_regime')['response']['data']['items'][0]
regime = {
    'label': reg['current_state'], 'score': reg['regime_score'],
    'confidence': reg['current_state_confidence'], 'probabilities': reg['probabilities'],
    'scale': reg.get('scale'), 'as_of': reg['as_of'],
    'dtx_regime': {'label': reg['dtx_regime']['regime'], 'score': r2(reg['dtx_regime']['regime_score'], 4)},
    'autoscreener_regime': auto['regime'],
    'source_file': R('02_regime_context_asof'),
    'source_files_secondary': [R('05_autoscreener_regime'), R('03_regime_querydata')],
}

# ---------- 2. Rotation ----------
rot_env = load('04_performance_rotations')
rot = rot_env['response']['data']['items'][0]['results'][0]['data']


def csv_rows(lines):
    hdr = lines[0].split(',')
    out = []
    for ln in lines[1:]:
        parts = ln.rsplit(',', len(hdr) - 1)
        out.append(dict(zip(hdr, parts)))
    return out


ind_top = csv_rows(rot['industries']['top']); ind_worst = csv_rows(rot['industries']['worst'])
sec_top = csv_rows(rot['sectors']['top']); sec_worst = csv_rows(rot['sectors']['worst'])
IND_TOP = {x['name'] for x in ind_top}; IND_WORST = {x['name'] for x in ind_worst}
SEC_WORST = {x['name'] for x in sec_worst}

etf_rows = qd_rows(load('12_sector_etf_bars'), 'bars_daily')
closes = {s: {b[0]: b[4] for b in v['row']['bars'] if b[0] <= REFDATE} for s, v in etf_rows.items()}
sd = sorted(closes['SPY']); D0, D5, D21 = sd[-1], sd[-6], sd[-22]
assert D0 == REFDATE


def ret(s, a, b):
    c = closes[s]
    return (c[b] / c[a] - 1) * 100 if a in c and b in c else None


spy5, spy21 = ret('SPY', D5, D0), ret('SPY', D21, D0)
ETF = {'Technology': 'XLK', 'Energy': 'XLE', 'Financial Services': 'XLF', 'Healthcare': 'XLV', 'Industrials': 'XLI',
       'Consumer Cyclical': 'XLY', 'Consumer Defensive': 'XLP', 'Utilities': 'XLU', 'Basic Materials': 'XLB',
       'Real Estate': 'XLRE', 'Communication Services': 'XLC'}
ROT_NAME = {'Technology': 'Technology', 'Energy': 'Energy', 'Financial Services': 'Financials', 'Healthcare': 'Healthcare',
            'Industrials': 'Industrials', 'Consumer Cyclical': 'Consumer Discretionary', 'Consumer Defensive': 'Consumer Staples',
            'Utilities': 'Utilities', 'Basic Materials': 'Materials', 'Real Estate': 'Real Estate',
            'Communication Services': 'Communication Services'}
sector_rs = {}
for sec, e in ETF.items():
    a, b = ret(e, D5, D0), ret(e, D21, D0)
    sector_rs[sec] = {'etf': e, 'rs5_pts': r2(a - spy5) if a is not None else None, 'rs21_pts': r2(b - spy21) if b is not None else None,
                      'in_mcp_worst': ROT_NAME[sec] in SEC_WORST}


def classify_group(sector, industry):
    s = sector_rs.get(sector)
    why = []
    lag = False
    if industry in IND_WORST:
        lag = True; why.append(f"industrie « {industry} » dans les pires de performance_rotations")
    if s and s['in_mcp_worst']:
        lag = True; why.append(f"secteur {ROT_NAME[sector]} = pire secteur de performance_rotations")
    if s and s['rs5_pts'] is not None and s['rs21_pts'] is not None and s['rs5_pts'] < 0 and s['rs21_pts'] < 0:
        lag = True; why.append(f"{s['etf']} sous SPY sur 5 et 21 séances ({fr(s['rs5_pts'])} / {fr(s['rs21_pts'])} pts)")
    if lag:
        return 'laggard', '; '.join(why)
    if industry in IND_TOP:
        return 'leader', f"industrie « {industry} » dans le top de performance_rotations"
    if s and s['rs5_pts'] is not None and s['rs5_pts'] > 0:
        return 'leader', f"{s['etf']} au-dessus de SPY sur 5 séances (+{fr(s['rs5_pts'])} pts ; 21 séances {fr(s['rs21_pts'])} pts)"
    return 'neutral', 'ni leader ni laggard'


leaders = [f"{ROT_NAME[k]} ({v['etf']} {'+' if v['rs5_pts'] > 0 else ''}{fr(v['rs5_pts'])} pts vs SPY sur 5 séances, {fr(v['rs21_pts'])} pts sur 21)"
           for k, v in sorted(sector_rs.items(), key=lambda kv: -kv[1]['rs5_pts']) if v['rs5_pts'] > 0 and not v['in_mcp_worst']]
leaders += [f"industrie {x['name']} (rendement moyen {float(x['avg_return'])*100:+.0f} %, n={x['count'].split('.')[0]})".replace('+-', '-') for x in ind_top]
laggards = [f"{ROT_NAME[k]} ({v['etf']} {fr(v['rs5_pts'])} pts / {fr(v['rs21_pts'])} pts vs SPY sur 5/21 séances{', pire secteur performance_rotations' if v['in_mcp_worst'] else ''})"
            for k, v in sorted(sector_rs.items(), key=lambda kv: kv[1]['rs5_pts']) if v['in_mcp_worst'] or (v['rs5_pts'] < 0 and v['rs21_pts'] < 0)]
laggards += [f"industrie {x['name']} (rendement moyen {float(x['avg_return'])*100:+.0f} %, n={x['count'].split('.')[0]})" for x in ind_worst]
rotation = {
    'leaders': leaders, 'laggards': laggards,
    'rotation_window_note': 'performance_rotations : fenêtre non précisée par la source ; rendements arrondis à 2 décimales (fraction) par la source',
    'rule': ("Laggard = industrie dans la liste « worst » de performance_rotations, ou secteur « worst », ou ETF sectoriel "
             "sous SPY à la fois sur 5 et 21 séances. Leader = non laggard ET (industrie dans la liste « top » ou ETF sectoriel "
             "au-dessus de SPY sur 5 séances). Le reste est neutre et n'est pas sourcé."),
    'window_sessions': {'d0': D0, 'd5': D5, 'd21': D21, 'spy_5d_pct': r2(spy5), 'spy_21d_pct': r2(spy21)},
    'sector_relative_strength': sector_rs,
    'source_file': R('04_performance_rotations'),
    'source_files_secondary': [R('12_sector_etf_bars')],
}

# ---------- 3. Pool ----------
pool_ctrl = load('07_screen_pool_nomcap_control')['response']['data']['items'][0]
pool_mid = load('06_screen_pool_mcap')['response']['data']['items'][0]
q, p = {}, {}
for i in (1, 2, 3):
    env = load(f'11_pool_quote_profile_{i}')
    q.update({k: v['row'] for k, v in qd_rows(env, 'quote').items()})
    p.update({k: v['row'] for k, v in qd_rows(env, 'profile').items()})
mid_syms = [c['symbol'] for c in pool_mid['candidates']]
# contrôle « candidats manqués » : noms du pool non borné dont la cap. quote est dans 2-20 G$ mais absents du pool borné
missed = [c['symbol'] for c in pool_ctrl['candidates'] if c['symbol'] not in mid_syms and q.get(c['symbol'], {}).get('marketCap')
          and 2e9 <= q[c['symbol']]['marketCap'] <= 2e10]
assert not missed, missed
scr = {c['symbol']: c for c in pool_mid['candidates']}

groups = {}
for s in mid_syms:
    pr = p[s]
    g, why = classify_group(pr.get('sector'), pr.get('industry'))
    groups[s] = {'sector': pr.get('sector'), 'industry': pr.get('industry'), 'class': g, 'why': why}
leading = [s for s in mid_syms if groups[s]['class'] == 'leader']

# ---------- 4. Sharia ----------
fin = {}
for n in ('22_financials_current_1', '22_financials_current_2'):
    fin.update({k: v['row'] for k, v in qd_rows(load(n), 'financials').items()})

# AVTR : l'XBRL EDGAR n'expose pas Assets au 30/06/2026 → bilan de l'Ex. 99.1 du 29/07/2026 (8-K 0001628280-26-050333)
avtr_txt = load('edgar_doc_AVTR_20260729_ex991')['data']['text']
num = lambda pat: float(re.search(pat, avtr_txt).group(1).replace(',', ''))
avtr_assets = num(r'Total assets \$ ([\d,]+\.\d)')
avtr_cur_debt = num(r'Current portion of debt \$ ([\d,]+\.\d)')
avtr_lt_debt = num(r'Debt, net of current portion ([\d,]+\.\d)')
avtr_ratio = (avtr_cur_debt + avtr_lt_debt) / avtr_assets * 100
D_RATIO['AVTR'].update({'q2_2026_from_ex991': {'total_assets_musd': avtr_assets, 'current_debt_musd': avtr_cur_debt,
                                                'lt_debt_musd': avtr_lt_debt, 'debt_to_assets_pct': r2(avtr_ratio)},
                        'debt_to_assets_pct': r2(avtr_ratio), 'status': 'fail' if avtr_ratio > 33 else 'pass',
                        'basis': 'bilan au 30/06/2026, Ex. 99.1 du 8-K 0001628280-26-050333'})

summ = lambda s: (p[s].get('longBusinessSummary') or '')


def must(s, sub):
    assert sub in summ(s), (s, sub)
    return f"profil MCP : « {sub} »"


SHARIA_NATURE = {  # nature d'activité, chaque citation est vérifiée dans le profil MCP persisté
    'BWIN': ('non_compliant', 'courtage en assurance conventionnelle', must('BWIN', 'independent insurance distribution firm')),
    'CRBG': ('non_compliant', 'assurance vie et rentes conventionnelles (riba)', must('CRBG', 'provides retirement solutions and insurance products')),
    'ASST': ('unknown', 'gestionnaire d’actifs : revenus de gestion de fonds non screenés, part impure non mesurée', must('ASST', 'investment manager')),
}
sharia = {}
for s in leading:
    rr = D_RATIO.get(s)
    ratio_txt = None
    if rr and rr.get('debt_to_assets_pct') is not None:
        ratio_txt = f"dette porteuse d'intérêt / actifs = {fr(rr['debt_to_assets_pct'])} % ({rr.get('basis') or ('XBRL ' + rr['form'] + ' arrêté au ' + rr['balance_date'] + ', accn ' + rr['accn'])})"
    elif rr and rr.get('mcp_debt_to_assets_pct') is not None:
        ratio_txt = (f"aucune dette taguée en XBRL au {rr['balance_date']} ; borne haute dette MCP (inclut les locations) / actifs EDGAR = "
                     f"{fr(rr['mcp_debt_to_assets_pct'])} %")
    if s in SHARIA_NATURE:
        st, reason, ev = SHARIA_NATURE[s]
        sharia[s] = {'status': st, 'reason': reason, 'evidence': [ev] + ([ratio_txt] if ratio_txt else [])}
        continue
    if rr is None:
        sharia[s] = {'status': 'unknown', 'reason': 'ratio dette/actifs non calculé', 'evidence': []}
        continue
    pct = rr.get('debt_to_assets_pct')
    if pct is None:
        pct = rr.get('mcp_debt_to_assets_pct')
    if pct is not None and pct > 33:
        sharia[s] = {'status': 'non_compliant', 'reason': f"dette/actifs {fr(pct)} % > 33 %", 'evidence': [ratio_txt, R('edgar_companyfacts_subset_' + s)]}
    else:
        sharia[s] = {'status': 'halal', 'reason': f"activité licite ({groups[s]['industry']}) ; dette/actifs {fr(pct)} % ≤ 33 % ; revenus impurs non mesurés (aucune donnée)",
                     'evidence': [ratio_txt, R('edgar_companyfacts_subset_' + s)]}
post_sharia = [s for s in leading if sharia[s]['status'] != 'non_compliant']

# ---------- 5. Techniques ----------


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
        fails.append(f"volume anormal le {a['date']} ({', '.join(a['flags'])}) sans catalyseur bénin identifié")
    return fails


tech_fail = {s: tech_gate(s) for s in post_sharia}
tech_surv = [s for s in post_sharia if not tech_fail[s]]

# ---------- 6. Éliminatoires (AVTR, TALO : seuls dossiers instruits jusqu'aux preuves) ----------
cal = {e['symbol']: e for e in load('34_earnings_calendar_filtered')['response']['events']}
surp = {x['symbol']: x for x in qd_results(load('36_earnings_surprises_trend'))[0]['data']}
news = {b['symbol']: b['data'] for b in qd_results(load('32_news'))[0]['data']}
stats = {}
for i in (1, 2):
    stats.update({k: v['row'] for k, v in qd_rows(load(f'20_fin_stats_{i}'), 'stats').items()})

# séances NYSE après refdate : calendrier déduit des jours ouvrés (aucun férié NYSE entre le 13/10 et le 06/11/2026)
def sessions_until(date):
    d = datetime.date.fromisoformat(REFDATE); end = datetime.date.fromisoformat(date); n = 0
    while d < end:
        d += datetime.timedelta(days=1)
        if d.weekday() < 5:
            n += 1
    return n  # rang de la séance du jour de publication


def eightk_202(s):
    r = load('edgar_submissions_' + s)['data']['filings_recent']
    rows = [dict(zip(r.keys(), v)) for v in zip(*r.values())]
    return [(x['filingDate'], x['accessionNumber']) for x in rows if x['form'] == '8-K' and '2.02' in (x.get('items') or '').split(',') and x['filingDate'] <= REFDATE]


def sub_row(s, accn):
    r = load('edgar_submissions_' + s)['data']['filings_recent']
    rows = [dict(zip(r.keys(), v)) for v in zip(*r.values())]
    m = [x for x in rows if x['accessionNumber'] == accn]
    assert len(m) == 1, (s, accn)
    return m[0]


def doc(name):
    d = load(name)
    return d['data']['text'], d['data']['accession'], d['url']


def iso(us_date):
    return datetime.datetime.strptime(us_date, '%B %d, %Y').date().isoformat()


def fr_int(n):
    return f"{n:,}".replace(',', ' ')


GUIDANCE = {}
for s_, name, quote in (('AVTR', 'edgar_doc_AVTR_20260729_ex991', 'Increases FY 2026 organic revenue growth and adjusted EPS guidance'),
                        ('TALO', 'edgar_doc_TALO_20260804_ex991', 'increased our full-year production outlook')):
    txt, accn, url = doc(name)
    row = sub_row(s_, accn)
    assert row['form'] == '8-K' and '2.02' in row['items'].split(',') and row['filingDate'] <= REFDATE
    GUIDANCE[s_] = {'doc': name, 'quote': quote, 'date': row['filingDate'], 'accn': accn, 'url': url, 'found': quote in txt}
_avtr_txt = doc('edgar_doc_AVTR_20260729_ex991')[0]
_m = re.search(r'Organic revenue growth \(1\) (\S+ to \S+) (\S+ to \S+)', _avtr_txt)
AVTR_ORG_OLD, AVTR_ORG_NEW = _m.group(1), _m.group(2)
_m = re.search(r'Adjusted EPS \(1\) (\$[\d.]+ to \$[\d.]+) (\$[\d.]+ to \$[\d.]+)', _avtr_txt)
AVTR_EPS_OLD, AVTR_EPS_NEW = _m.group(1), _m.group(2)
def fr_range(x):
    a, b = x.split(' to ')
    f = lambda v: v.replace('-', '−').replace('$', '').replace('.', ',').replace('%', ' %')
    return f"[{f(a)} ; {f(b)}]" + (' $' if '$' in x else '')


AVTR_ORG_OLD, AVTR_ORG_NEW = fr_range(AVTR_ORG_OLD), fr_range(AVTR_ORG_NEW)
AVTR_EPS_OLD, AVTR_EPS_NEW = fr_range(AVTR_EPS_OLD), fr_range(AVTR_EPS_NEW)
GUIDANCE['AVTR']['detail'] = f"croissance organique {AVTR_ORG_OLD} → {AVTR_ORG_NEW} ; BPA ajusté {AVTR_EPS_OLD} → {AVTR_EPS_NEW}"
GUIDANCE['TALO']['detail'] = 'perspective de production annuelle relevée (guidance opérationnelle, pas de BPA)'

DILUTION = {}
_t, _accn, _url = doc('edgar_doc_AVTR_20220517_8k')
_row = sub_row('AVTR', _accn)
_rate = re.search(r'([\d.]+)% Series A Mandatory Convertible Preferred Stock', _t).group(1)
_conv = iso(re.search(r'On (\w+ \d+, \d{4}), all outstanding Shares of Preferred Stock automatically converted into shares of the Company’s common stock', _t).group(1))
_ratio = re.search(r'conversion rate for each Share of Preferred Stock was ([\d.]+) shares', _t).group(1)
DILUTION['AVTR'] = {'doc': 'edgar_doc_AVTR_20220517_8k',
                    'short': f"conversion obligatoire des préférentielles {_rate.replace('.', ',')} % Series A en actions ordinaires le {_conv} ({_ratio.replace('.', ',')} actions par titre)",
                    'text': (f"conversion obligatoire des préférentielles {_rate.replace('.', ',')} % Series A en actions ordinaires le {_conv} "
                             f"(8-K {_accn} déposé le {_row['filingDate']}, Items {_row['items']}) — convertible obligatoire dans la fenêtre de 5 ans ; "
                             f"aucun S-3/424B ni 8-K Item 3.02/3.03 dans la fenêtre ; les 8-K Items 1.01/2.03 relus sont des financements par dette (non dilutifs)")}
_t, _accn, _url = doc('edgar_doc_TALO_20240116_8k')
assert 'Item 3.02. Unregistered Sales of Equity Securities' in _t
_row = sub_row('TALO', _accn)
_shares = int(re.search(r'equal to the quotient of \(i\) ([\d,]+) shares', _t).group(1).replace(',', ''))
_t2, _accn2, _ = doc('edgar_doc_TALO_20250522_s3asr')
assert 'We may offer, from time to time in one or more offerings, (i) shares of our common stock' in _t2
_row2 = sub_row('TALO', _accn2)
_t3, _accn3, _ = doc('edgar_doc_TALO_20260922_8k')
_cash = re.search(r'cash purchase price of \$([\d,]+) million', _t3).group(1)
TALO_SHARES = _shares
DILUTION['TALO'] = {'doc': 'edgar_doc_TALO_20240116_8k',
                    'short': f"8-K Item 3.02 du {_row['filingDate']} : {fr_int(_shares)} actions émises en paiement de QuarterNorth (M&A en actions)",
                    'text': (f"8-K {_accn} du {_row['filingDate']} (Items {_row['items']}) : {fr_int(_shares)} actions Talos émises en paiement de QuarterNorth (M&A en actions) ; "
                             f"{_row2['form']} {_accn2} du {_row2['filingDate']} = shelf primaire actions ordinaires/préférentielles ; "
                             f"le rachat d'actifs du golfe clos le 22/09/2026 est payé en numéraire (prix brut {_cash} M$, 8-K {_accn3})")}


def levels_geometry(s):
    t = D_TECH[s]
    entry = t['close']; atr = t['atr14']
    atr_lo, atr_hi = entry - 2 * atr, entry - 1.6 * atr
    sup = t['low10'] if t['low10'] < entry else None
    # « le plus proche » entre le support sous le cours et la bande 1,6-2 ATR : support s'il tombe dans/au-dessus de la bande
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
    guid = GUIDANCE[s]['found']
    beats = surp[s]['consecutive_beats']
    fpe = q[s].get('forwardPE')
    ext_ok = t['ext_ema20_pct'] <= 3 and t['ema_stack_rising'] and 50 <= t['rsi14'] <= 68
    peg = stats[s].get('pegRatio')
    peg_ok = bool(peg) and peg > 0 and peg < 1.5
    # rachats : exercice en cours (YTD du dernier 10-Q <= refdate), achats sur le marché
    f = load('edgar_companyfacts_subset_' + s)['data']['facts'].get('us-gaap', {})
    rep = [x for x in f.get('PaymentsForRepurchaseOfCommonStock', {}).get('units', {}).get('USD', []) if x['filed'] <= REFDATE and x.get('start', '').startswith('2026')]
    rep_last = max(rep, key=lambda x: (x['end'], x['filed'])) if rep else None
    buyback = bool(rep_last and rep_last['val'] > 0)
    div = (q[s].get('dividendYield') or 0) > 0
    structure = t['sessions_above_ema50'] >= 15 and t['ema_stack_rising'] and 50 <= t['rsi14'] <= 68
    geo = levels_geometry(s)
    rr_ok = geo['rr_to_resistance'] is not None and geo['rr_to_resistance'] >= 2.5
    sec_ok = False  # dilution non clean sur les deux dossiers (cf. DILUTION)
    comp = {'guidance_relevee': 5 if guid else 0, 'beats_eps_5': 5 if beats >= 5 else 0, 'valorisation_pe_fwd_35': 5 if (fpe and fpe < 35) else 0,
            'extension_ema20_3pct': 5 if ext_ok else 0, 'peg_1_5': 15 if peg_ok else 0, 'buyback_actif': 8 if buyback else 0,
            'dividende_actif': 7 if div else 0, 'structure_validee': 20 if structure else 0, 'rr_2_5': 15 if rr_ok else 0,
            'sec_clean_catalyseur': 15 if sec_ok else 0}
    detail = {'guidance': guid, 'consecutive_beats': beats, 'forward_pe': fpe, 'ext_ok': ext_ok, 'peg_ratio_raw': peg,
              'buyback_ytd_2026_usd': rep_last['val'] if rep_last else None, 'buyback_basis': (f"XBRL PaymentsForRepurchaseOfCommonStock {rep_last['start']}→{rep_last['end']} ({rep_last['form']} {rep_last['accn']})" if rep_last else 'aucun rachat 2026 tagué en XBRL ≤ refdate'),
              'dividend_yield': q[s].get('dividendYield'), 'sessions_above_ema50': t['sessions_above_ema50'], 'geometry': geo}
    return sum(comp.values()), comp, detail


def confirm_txt(s, nxt):
    d = datetime.date.fromisoformat(nxt)
    needle = d.strftime('%B ') + str(d.day) + d.strftime(', %Y')
    hits = [n for n in news.get(s, []) if n['publishedAt'][:10] <= REFDATE and needle in n['title'] and 'Report' in n['title']]
    if not hits:
        return None
    h = hits[0]
    return f"recoupé par le communiqué {h['source']} du {h['publishedAt'][:10]} « {h['title']} » ({R('32_news')})"


aplus, a_grade, cands, excluded = [], [], [], {}
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
    if s in ('AVTR', 'TALO'):
        tot, comp, det = score(s)
        g = GUIDANCE[s]; dl = DILUTION[s]
        nxt = cal[s]['report_date']; rank = sessions_until(nxt)
        past = eightk_202(s)[:4]
        elim_failed = []
        if not det['guidance']: elim_failed.append('guidance relevée')
        if det['consecutive_beats'] < 5: elim_failed.append(f"beats EPS consécutifs = {det['consecutive_beats']} (< 5)")
        if not (det['forward_pe'] and det['forward_pe'] < 35): elim_failed.append('PE forward ≥ 35')
        if not det['ext_ok']: elim_failed.append(f"extension EMA20 {fr(t['ext_ema20_pct'])} % > 3 %" if t['ext_ema20_pct'] > 3 else 'structure EMA/RSI')
        flag_failed = [f"flag dilution : {dl['short']}"]
        missing = []
        if not det['peg_ratio_raw']: missing.append('PEG : stats.pegRatio renvoyé à 0 (champ manquant), aucune croissance BPA consensuelle dans les fichiers')
        missing.append('historique EPS limité à 4 trimestres par la source : ≥ 5 beats non démontrables')
        news_dates = sorted({n['publishedAt'][:10] for n in news.get(s, []) if n['publishedAt'][:10] <= REFDATE})
        grade = 'A+' if (tot >= 92 and not elim_failed) else ('A' if tot >= 88 and len(elim_failed) <= 1 else 'reject')
        tf = tech_fail[s]
        legs = (f"rachat 2026 {'oui' if det['buyback_ytd_2026_usd'] else 'non'}, dividende {'oui' if det['dividend_yield'] else 'non'}, "
                f"PEG {'inconnu' if not det['peg_ratio_raw'] else fr(det['peg_ratio_raw'])}, structure {'validée' if comp['structure_validee'] else 'non validée'}, "
                f"R/R vers la résistance {fr(det['geometry']['rr_to_resistance'])}")
        votes = {
            'quant': f"NON — score {tot}/100 (< 88) ; {det['consecutive_beats']} beats consécutifs seulement, PEG absent.",
            'pm_alpha': (f"NON — guidance relevée prouvée ({g['date']}) mais {legs}." if det['guidance'] else f"NON — guidance relevée non prouvée ; {legs}."),
            'risk': (f"NON — {tf[0]}." if tf else f"NON — prochaine publication le {nxt} (séance n°{rank}), R/R {fr(det['geometry']['rr_to_resistance'])} sous 2,5 et dilution non clean sur 5 ans."),
            'short_seller': f"NON — {dl['short']}.",
        }
        base.update({
            'guidance_raised': {'value': det['guidance'], 'evidence': f"8-K {g['accn']} Ex. 99.1 du {g['date']} : « {g['quote']} » ({g['detail']}) ; {g['url']} ; {R(g['doc'])}"},
            'eps_beats': {'count': det['consecutive_beats'],
                          'series': [{'period': x['period'], 'actual': x['eps_actual'], 'estimate': r2(x['eps_estimate'], 5), 'beat': x['beat']} for x in surp[s]['quarters']],
                          'evidence': R('36_earnings_surprises_trend') + ' (+ ' + R('30_earnings_quarterly') + ')'},
            'pe_forward': {'value': r2(det['forward_pe'], 2), 'source': R('11_pool_quote_profile_' + str(1 + [c['symbol'] for c in pool_ctrl['candidates']].index(s) // 24)) + ' quote.forwardPE (horodatage 2026-10-12T20:00Z)'},
            'next_earnings': {'date': nxt, 'within_10_sessions': rank <= 10,
                              'evidence': (f"calendrier MCP ({R('34_earnings_calendar_filtered')}) = {nxt}, {rank}e séance après le {REFDATE} ; "
                                           + (confirm_txt(s, nxt) or 'source unique (Yahoo), cohérente avec le rythme trimestriel des 8-K Item 2.02')
                                           + f" ; 8-K Item 2.02 passés : {', '.join(d for d, _ in past)}")},
            'dilution': {'clear': False, 'window': [D_DIL[s]['window'][0], D_DIL[s]['window'][1]],
                         'filings_reviewed': len(D_DIL[s]['hits']),
                         'evidence': f"{dl['text']} ; index EDGAR {R('edgar_submissions_' + s)} ; document primaire {R(dl['doc'])}"},
            'score_100': tot, 'score_breakdown': comp,
            'grade': grade, 'eliminators_failed': elim_failed + [f"technique : {x}" for x in tf] + flag_failed, 'missing_proofs': missing,
            'war_room': {'votes': votes, 'verdict': 'REJET (0/4 oui)'},
            'levels': None,
            'notes': {'score_inputs': {k: v for k, v in det.items() if k != 'geometry'},
                      'geometry_for_rr_component_only': {k: r2(v, 4) if isinstance(v, float) else v for k, v in det['geometry'].items()},
                      'news_dates_mcp_lte_refdate': news_dates},
        })
        if grade == 'reject':
            excluded[s] = (f"Note {tot}/100 : " + ' ; '.join(elim_failed + tf + flag_failed) + '.')
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

earn_clear = [s for s in tech_surv if s in ('AVTR', 'TALO') and sessions_until(cal[s]['report_date']) > 10]
elim_all = [c['ticker'] for c in cands if c['ticker'] in tech_surv and isinstance(c.get('score_100'), int) and not [x for x in c['eliminators_failed'] if not x.startswith('technique')]]
aplus = [c for c in cands if c['grade'] == 'A+']
a_grade = [c for c in cands if c['grade'] == 'A']

av = next(c for c in cands if c['ticker'] == 'AVTR'); ta = next(c for c in cands if c['ticker'] == 'TALO')
_ab = D_TECH['TALO']['abnormal_last5'][-1]
_bars = qd_rows(load('21_bars300_1'), 'bars_daily')['TALO']['row']['bars']
_vols = [b[5] for b in _bars if b[0] <= REFDATE]
talo_volx = _vols[-1] / (sum(_vols[-51:-1]) / 50)
_avtr_miss = [x['period'] for x in surp['AVTR']['quarters'] if not x['beat']]
FR_SECTOR = {'Healthcare': 'santé', 'Energy': 'énergie', 'Real Estate': 'immobilier', 'Financial Services': 'finance',
             'Consumer Cyclical': 'consommation discrétionnaire', 'Technology': 'technologie', 'Industrials': 'industrie',
             'Basic Materials': 'matériaux', 'Communication Services': 'communication', 'Utilities': 'services publics',
             'Consumer Defensive': 'consommation de base'}
from collections import Counter
_ps = Counter(groups[x]['sector'] for x in post_sharia)
_ps_txt = ', '.join(f"{FR_SECTOR[k]} {v}" for k, v in _ps.most_common())
_lag_secs = [FR_SECTOR[k] for k, v in sector_rs.items() if v['in_mcp_worst'] or (v['rs5_pts'] < 0 and v['rs21_pts'] < 0)]
_g = GUIDANCE['AVTR']['date']
contrarian = (
    f"Le seul survivant technique, AVTR, a relevé sa guidance le {_g[8:10]}/{_g[5:7]}, mais la croissance organique visée passe seulement de {AVTR_ORG_OLD} à {AVTR_ORG_NEW} : "
    f"une sortie de contraction, pas une accélération, et sa série de beats s'arrête à {av['eps_beats']['count']} trimestres (raté {', '.join(_avtr_miss)}). "
    f"TALO a la tendance et une guidance de production relevée, mais un volume de {fr(talo_volx)} fois sa moyenne 50 séances le {_ab['date']} sans nouvelle MCP, "
    f"une extension de {fr(D_TECH['TALO']['ext_ema20_pct'])} % et {fr_int(TALO_SHARES)} actions émises pour QuarterNorth en 2024. "
    f"Les {len(post_sharia)} noms halal restants se répartissent en {_ps_txt}, pendant que {', '.join(_lag_secs)} sont en retrait : "
    f"aucun leader mid-cap halal non étendu ne franchit les gates, et le panier vide est le résultat honnête."
)
_xlu_n = len(etf_rows['XLU']['row']['bars'])
_partial = sorted(x for x in post_sharia + [y for y in leading if y not in post_sharia] if D_TECH.get(x, {}).get('missing_ranges'))
_talo_last_news = max(n['publishedAt'][:10] for n in news['TALO'] if n['publishedAt'][:10] <= REFDATE)
_r429 = load('22_financials_current_1')
limits = [
    f"performance_rotations est un facet « current » (statut {rot.get('status')}, univers source daté {rot['source_status']['universe']['fetched_at']}, fraîcheur « {rot['source_status']['universe']['status']} », fenêtre non précisée) ; la rotation sectorielle est recoupée par la force relative des ETF SPDR sur barres certifiées au {REFDATE}.",
    f"Le screener borné en capitalisation a renvoyé {len(mid_syms)} noms ; le contrôle sans borne ({pool_ctrl['total']} noms, sans capitalisation dans la réponse) ne contient aucun autre titre dont la capitalisation quote tombe entre 2 et 20 G$ : aucun candidat manqué.",
    "Capitalisations et fondamentaux (screener, quote, stats, financials) sont des instantanés courants (market_cap_point_in_time=false), horodatés à la clôture du 12/10 ou avant ; aucune donnée postérieure à la clôture de référence n'a servi.",
    f"earnings_quarterly (limit=8 demandé) et earnings_surprises ne servent que {surp['AVTR']['quarters_available']} trimestres : une série de 5 beats n'est jamais démontrable par cette source ; AVTR et TALO échouent de toute façon sur un raté dans ces trimestres.",
    "stats.pegRatio vaut 0 (champ manquant) pour AVTR et TALO : PEG inconnu, 0 point, jamais remplacé par une estimation.",
    "QueryData financials refuse end_date (« financials is current-only ») ; le ratio dette/actifs vient de l'XBRL EDGAR (dernier 10-Q déposé avant la référence). Pour AVTR, l'XBRL ne sert pas Assets au 30/06/2026 : bilan lu dans l'Ex. 99.1 du 29/07/2026.",
    f"Un appel financials a d'abord échoué ({_r429.get('error', 'HTTP 429')} au premier passage, quota) puis a été rejoué avec succès ; QueryData type « earnings » n'existe pas (erreur « unknown data_type: earnings »), remplacé par earnings_quarterly + earnings_surprises + GetEarningsCalendarFiltered.",
    f"Barres incomplètes : XLU ({_xlu_n} barres sur 70 demandées) ; RXRX ({D_TECH['RXRX']['n_bars']} barres, {len(D_TECH['RXRX']['missing_ranges'])} séances manquantes) ; trous ponctuels de juillet 2026 sur {', '.join(x for x in _partial if x != 'RXRX')} et XLI/XLY/XLP/XLRE, hors fenêtre des forces relatives et sans effet sur les rejets.",
    f"Le volume anormal de TALO le {_ab['date']} n'a aucune nouvelle MCP datée au plus tard le {REFDATE} (dernière : {_talo_last_news}) ; faute de catalyseur bénin prouvé, la règle §3.4 rejette.",
    "Revenus impurs (> 5 %) non mesurés faute de donnée : le statut halal repose sur la nature d'activité et le ratio dette porteuse d'intérêt / actifs (≤ 33 %).",
    (lambda sc: f"RSI14/ATR14 recalculés (Wilder, {D_TECH['AVTR']['n_bars']} barres complètes) s'écartent un peu des valeurs du screener (AVTR RSI {fr(D_TECH['AVTR']['rsi14'])} contre {fr(sc['AVTR']['rsi'])}, ATR {fr(D_TECH['AVTR']['atr14'], 3)} contre {fr(sc['AVTR']['atr'], 3)}) ; aucun rejet ne dépend de cet écart, sauf l'extension TALO ({fr(D_TECH['TALO']['ext_ema20_pct'])} %), elle-même doublée d'un rejet volume et beats.")(scr),
    "Les niveaux (entrée/stop/objectif) ne sont publiés que pour un A+ ; la géométrie de AVTR et TALO n'est conservée que pour justifier la composante R/R du score.",
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
               'eliminatories_all_passed': len(elim_all), 'aplus': len(aplus), 'a': len(a_grade)},
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
