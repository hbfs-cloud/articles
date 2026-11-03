"""Fortress STEP 0 — assemblage déterministe de fortress-step0.json depuis les réponses brutes persistées (séance du 03/11/2026,
clôture de référence du 02/11/2026). Aucun chiffre saisi à la main : tout est lu dans fortress-step0-raw/ ou recalculé ici.
Pré-requis : tech.py, sharia_ratio.py et dilution_scan.py exécutés (fichiers dérivés).
Étapes 1 à 3 (régime, rotation, pool, groupes) : funnel.py. Exclusions par nature : nature.py."""
import json, re, datetime, glob, subprocess
from collections import Counter
from funnel import *
from nature import NATURE_EXCLUDED, NATURE_UNKNOWN

OUT = os.path.join(HERE, '..', 'fortress-step0.json')
D_TECH = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-technicals.json')))
D_RATIO = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-sharia-ratios.json')))
D_DIL = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-dilution-index.json')))
MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
dfr = lambda iso: f"{'1er' if int(iso[8:10]) == 1 else int(iso[8:10])} {MOIS[int(iso[5:7]) - 1]}"
EXCL_WINDOW_END = '2026-11-19'  # fin de la fenêtre d'exclusion résultats du scanner du 03/11 (earnings_forward_evidence des signaux publiés)
WIN_START = '2026-05-02'  # fenêtre de dilution : six mois jusqu'à la clôture de référence
EPS_CAP = 4  # trimestres servis par la source (décision du 29 octobre 2026 : 4 sur 4 passe, provisoire)


def doc(name):
    d = load(name)
    return d['data']['text'], d['data']['accession'], d['url']


def sub_rows(s):
    r = load('edgar_submissions_' + s)['data']['filings_recent']
    return [dict(zip(r.keys(), v)) for v in zip(*r.values())]


def win_filings(s):
    return [x for x in sub_rows(s) if WIN_START <= x['filingDate'] <= REFDATE and x['form'] not in ('3', '4', '5', '144')]


# ---------- 3bis. Univers mid-cap (capitalisation quote) ----------
in_band = {s: 2e9 <= (q[s].get('marketCap') or 0) <= 2e10 for s in mid_syms}
mid_band = [s for s in mid_syms if in_band[s]]
leading_band = [s for s in leading if in_band[s]]

# ---------- 4. Sharia ----------
REAL_ESTATE = 'Real Estate'
sharia = {}
for s in leading_band:
    prof = f"profil MCP {R(QP_FILE[s])} (secteur {groups[s]['sector']} / {groups[s]['industry']})"
    if s in NATURE_EXCLUDED:
        sharia[s] = {'status': 'non_compliant', 'reason': f"activité non conforme : {NATURE_EXCLUDED[s]}", 'evidence': [prof]}
        continue
    rr = D_RATIO.get(s) or {}
    pct, mpct = rr.get('debt_to_assets_pct'), rr.get('mcp_debt_to_assets_pct')
    ratio_txt = (f"dette porteuse d'intérêt / actifs = {fr(pct)} % (XBRL {rr['taxonomy']} {rr['form']} arrêté au {rr['balance_date']}, accn {rr['accn']}, balises {', '.join(rr['debt_components'])})"
                 if pct is not None else None)
    ev = [x for x in (ratio_txt, R('edgar_companyfacts_subset_' + s), prof) if x]
    comp = set(rr.get('debt_components') or {})
    only_partial = comp and comp <= {'LineOfCredit', 'LongTermDebtCurrent', 'DebtCurrent', 'ConvertibleDebtNoncurrent', 'ConvertibleNotesPayable', 'ConvertibleNotesPayableCurrent'}
    if pct is None:
        st = {'status': 'unknown', 'reason': "ratio dette/actifs non calculable : aucune dette porteuse d'intérêt taguée en XBRL à la date d'arrêté"
              + (f" (dette fournisseur, locations comprises : {fr(mpct)} % des actifs)" if mpct is not None else '')}
    elif pct > 33:
        st = {'status': 'non_compliant', 'reason': f"dette/actifs {fr(pct)} % > 33 %"}
    elif mpct is not None and mpct > 33 and only_partial:
        st = {'status': 'unknown', 'reason': f"dette XBRL incomplète (seulement {', '.join(sorted(comp))} : {fr(pct)} % des actifs) contre {fr(mpct)} % en dette fournisseur : lectures de part et d'autre du seuil, écart non réconcilié"}
    elif mpct is not None and mpct > 33 and groups[s]['sector'] == REAL_ESTATE and pct < mpct / 2:
        st = {'status': 'unknown', 'reason': f"foncière : dette XBRL {fr(pct)} % des actifs contre {fr(mpct)} % en dette fournisseur, écart non réconcilié (dette hypothécaire possiblement hors balise retenue)"}
    elif s in NATURE_UNKNOWN:
        st = {'status': 'unknown', 'reason': f"dette/actifs {fr(pct)} % ≤ 33 %, mais {NATURE_UNKNOWN[s]}"}
    else:
        st = {'status': 'halal', 'reason': f"activité licite ({groups[s]['industry']}) ; dette/actifs {fr(pct)} % ≤ 33 % ; revenus impurs non mesurés (aucune donnée)"}
    if st['status'] == 'unknown' and s in NATURE_UNKNOWN and NATURE_UNKNOWN[s] not in st['reason']:
        st['reason'] += f" ; de plus, {NATURE_UNKNOWN[s]}"
    st['evidence'] = ev
    sharia[s] = st
post_sharia = [s for s in leading_band if sharia[s]['status'] != 'non_compliant']

# ---------- 5. Techniques ----------
cal37, CAL37_FILE = {}, {}
for _n in sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('37_calendar_')):
    for res in qd_results(load(_n)):
        for row in res.get('data') or []:
            cal37[row['symbol']] = row
            CAL37_FILE[row['symbol']] = _n


def seg_missing(t):
    return [m for m in (t.get('missing_ranges') or []) if t.get('segment_start') and m['start'] >= t['segment_start']]


def tech_gate(s):
    t = D_TECH[s]
    fails = []
    if t.get('error') or t['n_bars'] < 250 or len(seg_missing(t)) > 5:
        fails.append(f"barres insuffisantes ({t['n_bars']} barres dans le dernier segment continu, {len(seg_missing(t))} séances manquantes dans ce segment ; il en faut 250)")
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

# ---------- 6. Éliminatoires, flags, score ----------
cal = {e['symbol']: e for e in load('34_earnings_calendar_filtered')['response']['events']}
surp, SURP_FILE, EQ_FILE = {}, {}, {}
for _n in sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('36_earnings_surprises_trend_')):
    for x in qd_results(load(_n))[0]['data']:
        surp[x['symbol']] = x
        SURP_FILE[x['symbol']] = _n
        EQ_FILE[x['symbol']] = _n.replace('36_earnings_surprises_trend_', '30_earnings_quarterly_')
stats = {}
for n in sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('20_fin_stats_')):
    stats.update({k: v['row'] for k, v in qd_rows(load(n), 'stats').items()})


def ordfr(n):
    return '1re' if n == 1 else f'{n}e'


def sessions_until(date):
    """Rang de la séance NYSE de publication après REFDATE (calendrier du dépôt tools/lib/market-calendar.js)."""
    env = dict(os.environ, NODE_OPTIONS='')
    out = subprocess.run(['node', '-e', "const c=require('./tools/lib/market-calendar.js');console.log(c.usTradingDaysBetween(process.argv[1],process.argv[2]))",
                          REFDATE, date], cwd=REPO, capture_output=True, text=True, check=True, env=env).stdout.strip()
    return int(out)


# Guidance : communiqué de résultats (Ex. 99.1) du dernier trimestre, lu au document primaire EDGAR.
GUID_DOCS = {'M': ('edgar_doc_M_20260910_ex991', r'raised its annual fiscal year 2026 guidance[^.]*\.'),
             'LTH': ('edgar_doc_LTH_20261029_ex991', r'Raised 2026 outlook'),
             'FIVE': ('edgar_doc_FIVE_20260902_ex991', r'Increases Full Year 2026 Sales and EPS Outlook'),
             'NDSN': ('edgar_doc_NDSN_20260819_ex991', r'the Company is increasing its full year guidance')}
GUIDANCE = {}
for s_, (dn, pat) in GUID_DOCS.items():
    _t, _accn, _url = doc(dn)
    m = re.search(pat, _t)
    assert m, s_
    _d = [x for x in sub_rows(s_) if x['accessionNumber'] == _accn][0]['filingDate']
    GUIDANCE[s_] = {'found': True, 'detail': 'relèvement explicite des perspectives annuelles', 'date': _d, 'accn': _accn, 'url': _url, 'doc': dn, 'quote': m.group(0).strip()}
_ct, _ca, _cu = doc('edgar_doc_CAKE_20261027_ex991')
assert not re.search(r'guidance|outlook', _ct, re.I)
GUIDANCE['CAKE'] = {'found': None, 'detail': f"communiqué du 27 octobre (8-K {_ca}, Ex. 99.1, lu) sans perspective chiffrée ; les perspectives figurent dans l'Ex. 99.2, présentation en images non lisible en texte",
                    'date': None, 'accn': _ca, 'url': _cu, 'doc': None, 'quote': None}
for s_ in tech_surv:
    GUIDANCE.setdefault(s_, {'found': None, 'detail': 'non instruite : le dossier est rejeté sur des preuves indépendantes de la guidance (résultats dans la fenêtre ou éliminatoires échoués)',
                             'date': None, 'accn': None, 'url': None, 'doc': None, 'quote': None})

OFFER = ('S-1', 'S-3', 'S-3ASR', 'S-4', 'F-1', 'F-3', '424B', 'DEFM14A')


def _win_offers(s):
    return [x for x in D_DIL[s]['hits'] if x['form'].startswith(OFFER) and WIN_START <= x['filingDate'] <= REFDATE]


def _win_8k(s):
    return [x for x in D_DIL[s]['hits'] if x['form'].startswith('8-K') and any(i in (x['items'] or '').split(',') for i in ('3.02', '3.03')) and WIN_START <= x['filingDate'] <= REFDATE]


def wl(s):
    return ', '.join(f"{x['form']}{(' ' + x['items']) if x['items'] else ''} du {x['filingDate']}" for x in win_filings(s))


DILUTION = {}
# Dossiers instruits jusqu'au bout : chaque 8-K 1.01/8.01 de la fenêtre lu au document primaire.
_m, _ma, _mu = doc('edgar_doc_M_20261023_8k')
assert 'decision to resign from the Board' in _m and not _win_offers('M') and not _win_8k('M')
DILUTION['M'] = {'clear': True, 'doc': 'edgar_doc_M_20261023_8k',
                 'short': "aucune offre d'actions ni 8-K 3.02/3.03 dans la fenêtre ; S-8 du 27 mai (plan d'actions des salariés) ; 8-K 5.02 du 23 octobre lu : départ d'un administrateur au 11 décembre, sans désaccord",
                 'text': f"dépôts de la fenêtre ({dfr(WIN_START)} au {dfr(REFDATE)}) : {wl('M')} ; 8-K {_ma} lu : démission de Paul C. Varga du conseil au 11 décembre 2026, remplacé comme administrateur référent ; {_mu}"}
_l1, _l1a, _l1u = doc('edgar_doc_LTH_20260813_8k')
_l2, _l2a, _l2u = doc('edgar_doc_LTH_20260507_8k')
assert 'Term Loan Facility' in _l1 and 'Share Repurchase' in _l2 and not _win_offers('LTH') and not _win_8k('LTH')
DILUTION['LTH'] = {'clear': True, 'doc': 'edgar_doc_LTH_20260813_8k',
                   'short': "aucune offre d'actions ni 8-K 3.02/3.03 dans la fenêtre ; 8-K du 13 août lu (refinancement du prêt à terme de 985 M$, dette) ; 8-K du 7 mai lu (rachat d'actions auprès des actionnaires historiques) ; Schedules 13D/A des actionnaires historiques",
                   'text': f"dépôts de la fenêtre : {wl('LTH')} ; 8-K {_l1a} lu : avenant au contrat de crédit, marge abaissée de 0,25 point ; 8-K {_l2a} lu : rachat d'actions par la société auprès d'affiliés de Leonard Green, TPG et Partners Group ; {_l1u}"}
_f1, _f1a, _f1u = doc('edgar_doc_FIVE_20261014_8k')
_f2, _f2a, _f2u = doc('edgar_doc_FIVE_20260722_8k')
assert 'Third Amendment to Credit Agreement' in _f1 and 'cybersecurity incident' in _f2 and not _win_offers('FIVE') and not _win_8k('FIVE')
DILUTION['FIVE'] = {'clear': True, 'doc': 'edgar_doc_FIVE_20261014_8k',
                    'short': "aucune offre d'actions ni 8-K 3.02/3.03 dans la fenêtre ; 8-K du 14 octobre lu (avenant au crédit renouvelable, dette) ; 8-K du 22 juillet lu (incident informatique contenu)",
                    'text': f"dépôts de la fenêtre : {wl('FIVE')} ; 8-K {_f1a} et {_f2a} lus ; {_f1u}"}
_n1, _n1a, _n1u = doc('edgar_doc_NDSN_20261023_8k')
_npx = re.search(r'enterprise value of approximately \$(\d+) million', _n1).group(1)
assert 'completed its acquisition of Contrinex' in _n1 and not _win_offers('NDSN') and not _win_8k('NDSN')
DILUTION['NDSN'] = {'clear': True, 'doc': 'edgar_doc_NDSN_20261023_8k',
                    'short': f"aucune offre d'actions ni 8-K 3.02/3.03 dans la fenêtre ; 8-K du 23 octobre lu : rachat de Contrinex réalisé, valeur d'entreprise d'environ {_npx} M$, acquéreur et opération close",
                    'text': f"dépôts de la fenêtre : {wl('NDSN')} ; 8-K {_n1a} lu : acquisition réalisée de Contrinex Holding SA ; {_n1u}"}
assert not _win_offers('CAKE') and not _win_8k('CAKE')
DILUTION['CAKE'] = {'clear': True, 'doc': None,
                    'short': "aucune offre d'actions ni 8-K 3.02/3.03 dans la fenêtre (index EDGAR) ; aucun 8-K 1.01 dans la fenêtre",
                    'text': f"dépôts de la fenêtre : {wl('CAKE')}"}
for s_ in tech_surv:
    if s_ in DILUTION:
        continue
    wo, w8 = _win_offers(s_), _win_8k(s_)
    lst = ', '.join(f"{x['form']} du {x['filingDate']}" for x in wo + w8)
    DILUTION[s_] = {'clear': None, 'doc': None,
                    'short': ('non instruite (dossier rejeté sur d’autres preuves) ; index EDGAR : ' + (lst + ' dans la fenêtre, non lus' if lst else "aucune offre ni 8-K item 3.02/3.03 dans la fenêtre")),
                    'text': (f"index EDGAR des soumissions ({D_DIL[s_]['window'][0]} au {REFDATE}) : " + (lst + ' dans la fenêtre de dilution, documents non lus' if lst else "aucun formulaire d'offre ni 8-K portant l'item 3.02 ou 3.03 dans la fenêtre de dilution")
                             + " ; dossier rejeté sur d'autres preuves, dilution non instruite")}


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


def beats_pass(s):
    b, qa = surp[s]['consecutive_beats'], surp[s]['quarters_available']
    return b >= 5 or (qa == EPS_CAP and b == EPS_CAP)


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
    sec_ok = DILUTION[s]['clear'] is True and not t['abnormal_last5']
    comp = {'guidance_relevee': 5 if guid else 0, 'beats_eps': 5 if beats_pass(s) else 0, 'valorisation_pe_fwd_35': 5 if (fpe and 0 < fpe < 35) else 0,
            'extension_ema20_3pct': 5 if ext_ok else 0, 'peg_1_5': 15 if peg_ok else 0, 'buyback_actif': 8 if buyback else 0,
            'dividende_actif': 7 if div else 0, 'structure_validee': 20 if structure else 0, 'rr_2_5': 15 if rr_ok else 0,
            'sec_clean_catalyseur': 15 if sec_ok else 0}
    detail = {'guidance': GUIDANCE[s]['found'], 'consecutive_beats': beats, 'quarters_served': surp[s]['quarters_available'], 'forward_pe': fpe, 'ext_ok': ext_ok, 'peg_ratio_raw': peg,
              'buyback_ytd_2026_usd': rep_last['val'] if rep_last else None,
              'buyback_basis': (f"XBRL PaymentsForRepurchaseOfCommonStock {rep_last['start']}→{rep_last['end']} ({rep_last['form']} {rep_last['accn']})" if rep_last else 'aucun rachat 2026 tagué en XBRL ≤ refdate'),
              'dividend_yield': q[s].get('dividendYield'), 'sessions_above_ema50': t['sessions_above_ema50'], 'geometry': geo}
    return sum(comp.values()), comp, detail


NAME = {s: (load('edgar_company_tickers_subset')['data'].get(s) or {}).get('title') for s in post_sharia}
excluded, cands = {}, []
for s in mid_syms:
    gs = groups[s]
    if not in_band[s]:
        excluded[s] = f"Capitalisation quote de {fr(q[s]['marketCap'] / 1e9)} Md$ hors de la bande 2-20 Md$ (le screener la classait dans la bande) : hors univers mid-cap."
    elif gs['class'] != 'leader':
        excluded[s] = f"Groupe {'en retrait' if gs['class'] == 'laggard' else 'neutre'} ({gs['sector']} / {gs['industry']}) : {gs['why']}."
    elif sharia[s]['status'] == 'non_compliant':
        excluded[s] = f"Non conforme Sharia : {sharia[s]['reason']}."

for s in post_sharia:
    t = D_TECH[s]
    base = {
        'ticker': s, 'name': NAME[s],
        'group': f"{groups[s]['sector']} / {groups[s]['industry']} ({groups[s]['why']})",
        'market_cap': q[s]['marketCap'], 'close': t['close'], 'ema20': r2(t['ema20'], 4), 'ema50': r2(t['ema50'], 4), 'ema200': r2(t['ema200'], 4),
        'rsi': r2(t['rsi14']), 'atr': r2(t['atr14'], 4), 'ext_ema20_pct': r2(t['ext_ema20_pct']), 'ema_stack_rising': t['ema_stack_rising'],
        'avg_volume_50': r2(t['avg_volume_50'], 0), 'bars_source': t['source_file'], 'sharia': sharia[s],
    }
    if s in tech_surv:
        tot, comp, det = score(s)
        g = GUIDANCE[s]; dl = DILUTION[s]
        nxt = (cal37.get(s, {}).get('nextEarningsDate') or '')[:10] or None
        if s in cal and nxt:
            assert cal[s]['report_date'] == nxt, (s, cal[s]['report_date'], nxt)
        rank = sessions_until(nxt) if nxt else None
        in10 = rank is not None and rank <= 10
        inwin = nxt is not None and nxt <= EXCL_WINDOW_END
        elim_failed, missing = [], []
        if det['guidance'] is not True:
            elim_failed.append('guidance relevée non prouvée')
            missing.append({'field': 'guidance_raised', 'reason': g['detail']})
        if not beats_pass(s):
            elim_failed.append(f"beats EPS consécutifs = {det['consecutive_beats']} sur {det['quarters_served']} trimestres servis (il faut 4 sur 4 tant que la source plafonne à 4)")
        if not (det['forward_pe'] and 0 < det['forward_pe'] < 35):
            elim_failed.append(f"PE forward {fr(det['forward_pe'])} hors ]0 ; 35[")
        if not det['ext_ok']:
            elim_failed.append(f"extension EMA20 {fr(t['ext_ema20_pct'])} % > 3 %" if t['ext_ema20_pct'] > 3 else 'structure EMA/RSI')
        flag_failed = []
        if dl['clear'] is not True:
            flag_failed.append(f"flag dilution/événement : {dl['short']}" if dl['clear'] is False else f"dilution non classée : {dl['short']}")
        if in10 or inwin:
            flag_failed.append(f"résultats le {nxt} ({ordfr(rank)} séance après le {REFDATE}{', dans les 10 séances' if in10 else ''}{', dans la fenêtre d’exclusion du scanner (fin ' + EXCL_WINDOW_END + ')' if inwin else ''})")
        if not det['peg_ratio_raw'] or det['peg_ratio_raw'] <= 0:
            missing.append({'field': 'peg', 'reason': 'stats.pegRatio absent ou nul, aucune estimation substituée'})
        if sharia[s]['status'] == 'unknown':
            missing.append({'field': 'sharia_compliance', 'reason': sharia[s]['reason']})
        eps_prov = det['consecutive_beats'] == EPS_CAP == det['quarters_served']
        grade = 'A+' if (tot >= 92 and not elim_failed and not flag_failed and sharia[s]['status'] == 'halal') else (
            'A' if tot >= 88 and len(elim_failed) <= 1 and not flag_failed else 'reject')
        votes = {
            'quant': f"NON — note {tot}/100 ({'< 88' if tot < 88 else '< 92'}) ; {det['consecutive_beats']} beats consécutifs sur {det['quarters_served']} trimestres servis.",
            'pm_alpha': (f"NON — guidance relevée prouvée le {g['date']}, mais " + (', '.join(elim_failed) if elim_failed else f"note {tot}/100 sous 88") + '.' if det['guidance'] else f"NON — {', '.join(elim_failed)}."),
            'risk': (f"NON — prochaine publication le {nxt} ({ordfr(rank)} séance)" if nxt else "NON — aucune publication dans les 30 jours du calendrier filtré") + f" ; R/R vers la résistance {fr(det['geometry']['rr_to_resistance']) if det['geometry']['rr_to_resistance'] else 'non calculable (aucune résistance au-dessus)'}.",
            'short_seller': f"NON — {dl['short']}.",
        }
        base.update({
            'guidance_raised': {'value': det['guidance'] if det['guidance'] is not None else 'unknown',
                                'evidence': (f"8-K {g['accn']} Ex. 99.1 du {g['date']} : « {g['quote']} » ; {g['url']} ; {R(g['doc'])}" if g['doc'] else g['detail'])},
            'eps_beats': {'count': det['consecutive_beats'], 'quarters_served': det['quarters_served'], 'eps_beats_provisional': eps_prov,
                          'series': [{'period': x['period'], 'actual': x['eps_actual'], 'estimate': r2(x['eps_estimate'], 5), 'beat': x['beat']} for x in surp[s]['quarters']],
                          'evidence': R(SURP_FILE[s]) + ' (+ ' + R(EQ_FILE[s]) + ')' + (' ; 4 sur 4, historique limité par la source' if eps_prov else '')},
            'pe_forward': {'value': r2(det['forward_pe'], 2), 'source': R(QP_FILE[s]) + ' quote.forwardPE'},
            'next_earnings': {'date': nxt, 'within_10_sessions': in10, 'within_scanner_exclusion_window': inwin,
                              'evidence': (f"{R(CAL37_FILE[s])} nextEarningsDate = {cal37[s]['nextEarningsDate']} ({cal37[s].get('earningsCalendarSource')})" if nxt else
                                           f"{R(CAL37_FILE[s])} : nextEarningsDate vide, lastEarningsDate = {cal37[s].get('lastEarningsDate')}")
                                          + (f", recoupé par {R('34_earnings_calendar_filtered')}" if s in cal else ", absent de l'horizon de 30 jours de " + R('34_earnings_calendar_filtered'))
                                          + (f" ; {ordfr(rank)} séance après le {REFDATE}" if rank else '')},
            'dilution': {'clear': dl['clear'], 'window': [WIN_START, REFDATE], 'filings_reviewed': len(D_DIL[s]['hits']) if s in D_DIL else 0,
                         'evidence': f"{dl['text']} ; index EDGAR {R('edgar_submissions_' + s)}" + (f" ; document primaire {R(dl['doc'])}" if dl['doc'] else '')},
            'score_100': tot, 'score_breakdown': comp,
            'grade': grade, 'eliminators_failed': elim_failed + flag_failed, 'missing_proofs': missing,
            'war_room': {'votes': votes, 'verdict': 'REJET (0/4 oui)' if grade == 'reject' else 'À REVOIR'},
            'levels': None,
            'notes': {'score_inputs': {k: v for k, v in det.items() if k != 'geometry'},
                      'geometry_for_rr_component_only': {k: r2(v, 4) if isinstance(v, float) else v for k, v in det['geometry'].items()}},
        })
        if grade == 'reject':
            excluded[s] = f"Note {tot}/100 : " + ' ; '.join((elim_failed + flag_failed) or [f"les éliminatoires passent, mais la note reste sous 88 ({', '.join(k for k, v in comp.items() if v == 0)} à zéro)"]) + '.'
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
assert not aplus, 'A+ trouvé : produire les niveaux et le fortress_pool avant de publier'

# ---------- 7. Note contrarienne et limites (chiffres lus dans les fichiers) ----------
FR_SECTOR = {'Healthcare': 'santé', 'Energy': 'énergie', 'Real Estate': 'immobilier', 'Financial Services': 'finance',
             'Consumer Cyclical': 'consommation discrétionnaire', 'Technology': 'technologie', 'Industrials': 'industrie',
             'Basic Materials': 'matériaux', 'Communication Services': 'communication', 'Utilities': 'services publics',
             'Consumer Defensive': 'consommation de base'}
def _clean(n):
    n = re.sub(r',?\s+(Inc\.?|Corp\.?|Corporation|Incorporated|Holdings,? Inc\.?|Group Holdings,? Inc\.?)$', '', n or '', flags=re.I).strip()
    return n.title() if n.isupper() else n


nm = lambda s: f"{_clean(NAME.get(s)) or s} ({s})"
_nat = [s for s in leading_band if s in NATURE_EXCLUDED]
_nc_ratio = [s for s in leading_band if sharia[s]['status'] == 'non_compliant' and s not in NATURE_EXCLUDED]
_unk = [s for s in post_sharia if sharia[s]['status'] == 'unknown']
_tech_out = [s for s in post_sharia if s not in tech_surv]
_tech_kind = Counter(tech_fail[s][0].split(' (')[0] for s in _tech_out)
_earn_out = sorted([s for s in tech_surv if by[s]['next_earnings']['within_10_sessions'] or by[s]['next_earnings']['within_scanner_exclusion_window']], key=lambda s: (by[s]['next_earnings']['date'], s))
_rest = [s for s in tech_surv if s not in _earn_out]
_full = [s for s in _rest if not [x for x in by[s]['eliminators_failed']]]
_one = [s for s in _rest if len([x for x in by[s]['eliminators_failed'] if not x.startswith(('flag', 'résultats', 'dilution'))]) == 1]
_lag = sorted({FR_SECTOR[k] for k, v in sector_rs.items() if v['in_mcp_worst'] or (v['rs5_pts'] < 0 and v['rs21_pts'] < 0)})
_ps = Counter(groups[x]['sector'] for x in post_sharia)


def zeros(s):
    c = by[s]['score_breakdown']
    lab = {'guidance_relevee': 'guidance', 'beats_eps': 'beats', 'valorisation_pe_fwd_35': 'PE', 'extension_ema20_3pct': 'extension',
           'peg_1_5': f"PEG {fr(stats[s].get('pegRatio'))}" if stats[s].get('pegRatio') else 'PEG absent',
           'buyback_actif': 'rachats', 'dividende_actif': 'dividende',
           'structure_validee': f"structure ({D_TECH[s]['sessions_above_ema50']} séances au-dessus de l'EMA50, il en faut 15)",
           'rr_2_5': f"R/R {fr(by[s]['notes']['geometry_for_rr_component_only']['rr_to_resistance'])} vers la résistance",
           'sec_clean_catalyseur': 'SEC'}
    return ', '.join(lab[k] for k, v in c.items() if v == 0)


contrarian = (
    f"Le crible en dollars échangés (≥ 20 M$ par jour sur vingt séances) sert {len(mid_syms)} noms entre 2 et 20 Md$ selon le screener ; "
    f"{len(mid_syms) - len(mid_band)} sort{'ent' if len(mid_syms) - len(mid_band) > 1 else ''} sur la capitalisation de la quote. "
    f"{len(leading_band)} sont dans des groupes en tête ; {' et '.join(_lag)} {'est' if len(_lag) == 1 else 'sont'} en retrait. "
    f"{len(_nat)} sortent sur la nature de l'activité (banques, assureurs, crédit, foncière hypothécaire, paris en ligne, assureur santé, armement) "
    f"et {len(_nc_ratio)} sur la dette au-delà de 33 % des actifs. "
    f"Sur {len(post_sharia)} noms restants, dont {len(_unk)} à la conformité inconnue, {len(_tech_out)} tombent sur la technique. "
    f"Des {len(tech_surv)} survivants, {len(_earn_out)} publient avant le {dfr(EXCL_WINDOW_END)}, dont {sum(1 for s in _earn_out if by[s]['next_earnings']['date'] <= '2026-11-04')} entre le 3 et le 4 novembre : c'est un pari sur le chiffre, pas un A+. "
    + (f"{nm(_full[0])} est le seul à passer les quatre éliminatoires (guidance relevée le {dfr(GUIDANCE[_full[0]]['date'])}, "
       f"4 beats sur 4 trimestres servis, PE prévisionnel {fr(by[_full[0]]['pe_forward']['value'])}, extension {fr(by[_full[0]]['ext_ema20_pct'])} %) "
       f"et un dossier SEC propre, mais sa note s'arrête à {by[_full[0]]['score_100']}/100 : {zeros(_full[0])} à zéro. "
       if len(_full) == 1 else '')
    + (f"Avec un seul éliminatoire manqué, {', '.join(nm(s) + ' note ' + str(by[s]['score_100']) for s in _one)} restent loin de 88. " if _one else '')
    + f"Aucun A+ mid-cap halal ni aucun A ce matin : le pool vide est le résultat honnête, sans ordre."
)
_ifrs = sorted(x for x in D_RATIO if D_RATIO[x].get('taxonomy') == 'ifrs-full')
_seg = sorted(x for x in post_sharia if D_TECH[x].get('segment_dropped_bars'))
_small = sorted(x for x in post_sharia if seg_missing(D_TECH[x]))
_beats_cap = [x for x in tech_surv if surp[x]['consecutive_beats'] == surp[x]['quarters_available'] == 4]
limits = [
    f"performance_rotations est un facet « current » (statut {rot.get('status')}, fenêtre non précisée) ; la rotation sectorielle est recoupée par la force relative des ETF SPDR sur barres certifiées au {REFDATE}.",
    f"Le screener borné en capitalisation a renvoyé {len(mid_syms)} noms ; le contrôle sans borne ({pool_ctrl['total']} noms, sans capitalisation dans la réponse) a été coté en entier : aucun autre titre dont la capitalisation quote tombe entre 2 et 20 Md$, aucun candidat manqué. "
    + (', '.join(f"{x} ({fr(q[x]['marketCap'] / 1e9)} Md$ en quote)" for x in mid_syms if not in_band[x]) + ' sort de la bande à la lecture de la quote.' if len(mid_band) < len(mid_syms) else ''),
    "Capitalisations et fondamentaux (screener, quote, stats, financials) sont des instantanés courants (market_cap_point_in_time=false), relevés le mardi 3 novembre avant l'ouverture ; aucune barre postérieure à la clôture du lundi 2 novembre n'a servi.",
    "RunAutoScreener n'est pas appelé (refusé par les permissions du dépôt) ; le régime vient de la collecte scanner du jour (" + regime['source_file'] + ").",
    f"earnings_surprises ne sert que 4 trimestres : la règle provisoire du 29 octobre (4 sur 4) s'applique ; {', '.join(_beats_cap)} affichent 4 sur 4.",
    (f"Le ratio dette/actifs vient de l'XBRL EDGAR (dernier 10-Q/10-K, ou rapport IFRS pour {', '.join(_ifrs)}, déposé avant la référence) ; les locations sont exclues, la dette du fournisseur sert de contrôle. "
     f"Conformité inconnue pour {', '.join(_unk)} : dette non taguée, lectures non réconciliées ou revenus impurs possibles (alcool, armement, crédit) ; aucun de ces noms n'est rejeté sur ce seul motif."),
    (f"Barres : pour {', '.join(_seg)}, la source sert une barre isolée de juillet 2024 suivie d'un trou ; les moyennes sont calculées sur le dernier segment continu (§9 du skill). "
     f"{', '.join(_small)} ont une à trois séances manquantes en juillet 2026 dans le segment : tolérées (≤ 5), comme les séances précédentes."),
    "Les niveaux (entrée/stop/objectif) ne sont publiés que pour un A+ ; la géométrie des dossiers instruits ne sert qu'à la composante R/R du score.",
]
raw_files = sorted(rel(x) for x in glob.glob(os.path.join(RAW, '*.json')))

doc_out = {
    'reference_close': REFDATE,
    'pm_ran_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'pm_status': 'step0_executed',
    'mandate': 'Fortress = book A+ halal, actions US mid-cap 2 à 20 Md$, crible propre (STEP 0). Aucun ordre broker.',
    'regime': regime,
    'rotation': rotation,
    'funnel': {'screened': pool_ctrl['total'], 'midcap_2_20b': len(mid_band), 'leading_groups': len(leading_band),
               'post_sharia': len(post_sharia), 'technical_survivors': len(tech_surv), 'earnings_clear': len(earn_clear),
               'eliminatories_all_passed': len(elim_all), 'aplus': len(aplus), 'a': len(a_grade),
               'post_sharia_confirmed': sum(1 for s in post_sharia if sharia[s]['status'] == 'halal'),
               'post_sharia_unknown': len(_unk)},
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
           'midcap': mid_band, 'leading': leading_band, 'post_sharia': post_sharia, 'technical_survivors': tech_surv,
           'earnings_clear': earn_clear, 'eliminatories_all_passed': elim_all}, open(os.path.join(HERE, '..', 'fortress-step0-derived-funnel.json'), 'w'), indent=1, ensure_ascii=False)
json.dump(doc_out, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(json.dumps(doc_out['funnel'])); print('A+', [c['ticker'] for c in aplus], 'A', [c['ticker'] for c in a_grade])
for c in cands:
    if c['score_100'] is not None:
        print(c['ticker'], c['grade'], c['score_100'], c['sharia']['status'], c['eliminators_failed'])
print(contrarian)
