"""Fortress STEP 0 — assemblage déterministe de fortress-step0.json depuis les réponses brutes persistées (séance du 21/10/2026).
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
dfr = lambda iso: f"{int(iso[8:10])} {MOIS[int(iso[5:7]) - 1]}"


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
for n in ('20_fin_stats_1', '20_fin_stats_2', '20_fin_stats_3'):
    fin.update({k: v['row'] for k, v in qd_rows(load(n), 'financials').items()})

# Macy's : revenus de carte de crédit (partage de revenus avec la banque émettrice, assimilés à des intérêts), Ex. 99.1 du 10/09/2026
_mt, _maccn, _murl = doc_text('edgar_doc_M_20260910_ex991')
_m = re.search(r'26 Weeks Ended August 1, 2026 .*?Credit card revenues, net \$ ([\d,]+) ', _mt)
_mcc = re.findall(r'Credit card revenues, net \$ ([\d,]+) ', _mt)
_mtr = re.findall(r'Total revenue ([\d,]+) ([\d,]+) Cost of sales', _mt)
M_CC_26W = float(_mcc[1].replace(',', ''))
M_TR_26W = float(_mtr[1][0].replace(',', ''))
M_IMPURE_PCT = M_CC_26W / M_TR_26W * 100
M_IMPURE_TXT = (f"revenus de carte de crédit (partage avec la banque émettrice, assimilés à des revenus d'intérêt) : {fr_int(int(M_CC_26W))} M$ "
                f"sur {fr_int(int(M_TR_26W))} M$ de chiffre d'affaires total sur 26 semaines au 1er août 2026, soit {fr(M_IMPURE_PCT)} % < 5 % "
                f"(Ex. 99.1 du 8-K {_maccn}, {_murl})")

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
    elif s == 'M':
        sharia[s] = {'status': 'halal', 'reason': f"activité licite ({groups[s]['industry']}) ; dette/actifs {fr(pct)} % ≤ 33 % ; revenus de carte de crédit {fr(M_IMPURE_PCT)} % du chiffre d'affaires < 5 %",
                     'evidence': ev + [M_IMPURE_TXT, R('edgar_doc_M_20260910_ex991')]}
    else:
        sharia[s] = {'status': 'halal', 'reason': f"activité licite ({groups[s]['industry']}) ; dette/actifs {fr(pct)} % ≤ 33 % ; revenus impurs non mesurés (aucune donnée)",
                     'evidence': ev}
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

# ---------- 6. Éliminatoires, flags, score ----------
cal = {e['symbol']: e for e in load('34_earnings_calendar_filtered')['response']['events']}
cal37 = {}
for res in qd_results(load('37_calendar')):
    for row in res.get('data') or []:
        cal37[row['symbol']] = row
surp = {x['symbol']: x for x in qd_results(load('36_earnings_surprises_trend'))[0]['data']}
stats = {}
for n in ('20_fin_stats_1', '20_fin_stats_2', '20_fin_stats_3'):
    stats.update({k: v['row'] for k, v in qd_rows(load(n), 'stats').items()})
EXCL_WINDOW_END = '2026-11-06'  # fin de la fenêtre d'exclusion résultats du scanner (horizon 03/11 + 3 jours)


def sessions_until(date):
    """Rang de la séance NYSE de publication après REFDATE (calendrier du dépôt tools/lib/market-calendar.js)."""
    env = dict(os.environ, NODE_OPTIONS='')
    out = subprocess.run(['node', '-e', "const c=require('./tools/lib/market-calendar.js');console.log(c.usTradingDaysBetween(process.argv[1],process.argv[2]))",
                          REFDATE, date], cwd=REPO, capture_output=True, text=True, check=True, env=env).stdout.strip()
    return int(out)


GUIDANCE = {}
_m_quote = 'raised its annual guidance'
_g = re.search(r'Adjusted diluted EPS 3,4 \$([\d.]+) to \$([\d.]+) \$([\d.]+) to \$([\d.]+)', _mt)
_mrow = sub_row('M', _maccn)
assert '2.02' in _mrow['items'].split(',') and _mrow['filingDate'] <= REFDATE
GUIDANCE['M'] = {'doc': 'edgar_doc_M_20260910_ex991', 'quote': _m_quote, 'date': _mrow['filingDate'], 'accn': _maccn, 'url': _murl,
                 'found': _m_quote in _mt,
                 'detail': f"BPA ajusté annuel {_g.group(3)}-{_g.group(4)} $ (3 juin) relevé à {_g.group(1)}-{_g.group(2)} $".replace('.', ',')}
for s_ in ('BAX', 'DHT', 'HAFN', 'TECH'):
    GUIDANCE[s_] = {'found': None, 'detail': 'non instruit : au moins deux autres éliminatoires échouent sur preuve',
                    'date': None, 'accn': None, 'url': None, 'doc': None, 'quote': None}


def first(s, form, since='2021-10-20'):
    return [x for x in sub_rows(s) if x['form'] == form and since <= x['filingDate'] <= REFDATE]


DILUTION = {}
_s3, _s3accn, _ = doc_text('edgar_doc_M_20250611_s3asr')
_pi = _s3.find('PROSPECTUS MACY')
assert _pi >= 0 and 'Common Stock' in _s3[_pi:_pi + 400] and 'Debt Securities' in _s3[_pi:_pi + 400]
_m424 = [x for x in sub_rows('M') if x['form'].startswith('424') and x['filingDate'] >= sub_row('M', _s3accn)['filingDate'] and x['filingDate'] <= REFDATE]
_mf = load('edgar_companyfacts_subset_M')['data']['facts']['us-gaap']
_mrep = max([x for x in _mf['PaymentsForRepurchaseOfCommonStock']['units']['USD'] if x['filed'] <= REFDATE and x.get('start', '').startswith('2026')],
            key=lambda x: (x['end'], x['filed']))
DILUTION['M'] = {'clear': True, 'doc': 'edgar_doc_M_20250611_s3asr',
                 'short': f"étagère universelle S-3ASR du {sub_row('M', _s3accn)['filingDate']} jamais tirée ; rachats d'actions en 2026",
                 'text': (f"S-3ASR {_s3accn} du {sub_row('M', _s3accn)['filingDate']} lue au document primaire : étagère universelle (actions ordinaires et "
                          f"préférentielles, bons, contrats d'achat, unités ; dette de Macy's Retail Holdings) ; {len(_m424)} prospectus 424B déposé depuis : jamais tirée ; "
                          f"aucun 8-K Item 3.02/3.03 sur 5 ans ; les S-8 ne bloquent pas ; rachats d'actions de {fr_int(int(_mrep['val'] / 1e6))} M$ "
                          f"du {_mrep['start']} au {_mrep['end']} (XBRL {_mrep['form']} {_mrep['accn']})")}
for s_, label in (('TECH', 'Bio-Techne'),):
    d = first(s_, 'DEFM14A')[-1]
    DILUTION[s_] = {'clear': False, 'doc': None,
                    'short': f"fusion soumise au vote des actionnaires (DEFM14A du {d['filingDate']}) : événement binaire, cours arrimé au prix de l'offre",
                    'text': f"DEFM14A {d['accessionNumber']} du {d['filingDate']} (procuration définitive de fusion, {label}) : opération corporate en cours — rejet §3.4"}
_bx = [x for x in sub_rows('BAX') if x['form'] in ('S-3ASR', '424B2') and x['filingDate'] >= '2025-01-01']
DILUTION['BAX'] = {'clear': 'unknown', 'doc': None,
                   'short': f"étagère S-3ASR et prospectus 424B2 ({', '.join(x['form'] + ' du ' + x['filingDate'] for x in _bx)}) non classés au document primaire",
                   'text': f"{', '.join(x['form'] + ' ' + x['accessionNumber'] for x in _bx)} : nature (dette ou actions) non lue au document primaire — classification inconnue, bloquante par règle, sans effet sur un verdict déjà négatif"}
# Hafnia : émission d'actions nouvelles en septembre 2026 (supplément 424B5 définitif, document primaire lu)
_ha, _ha_accn, _ha_url = doc_text('edgar_doc_HAFN_20260925_424b5')
_hn = re.search(r'We are offering ([\d,]+) of our ordinary shares', _ha)
assert _hn and 'directly to investors' in _ha[:2000]
_hp, _hp_accn, _ = doc_text('edgar_doc_HAFN_20260923_424b5')
assert 'Preliminary Prospectus Supplement dated September 23, 2026' in _hp
HAFN_NEW_SHARES = int(_hn.group(1).replace(',', ''))
DILUTION['HAFN'] = {'clear': False, 'doc': 'edgar_doc_HAFN_20260925_424b5',
                    'short': f"émission de {fr_int(HAFN_NEW_SHARES)} actions ordinaires nouvelles en septembre 2026 (424B5 du {sub_row('HAFN', _ha_accn)['filingDate']})",
                    'text': (f"424B5 préliminaire {_hp_accn} du {sub_row('HAFN', _hp_accn)['filingDate']} puis définitif {_ha_accn} du {sub_row('HAFN', _ha_accn)['filingDate']}, "
                             f"tirés sur l'étagère F-3ASR du 29 mai 2025 : « We are offering {_hn.group(1)} of our ordinary shares » directement à des investisseurs, "
                             f"par agents de placement — émission d'actions par la société dans la fenêtre ; {_ha_url}")}
# DHT : étagère universelle F-3ASR du 19/03/2026 (actions, préférentielles, bons, droits), aucun 424B déposé depuis
_dt, _dt_accn, _dt_url = doc_text('edgar_doc_DHT_20260319_f3asr')
assert 'PROSPECTUS DHT Holdings, Inc. Common Shares Preferred Shares Warrants Rights' in _dt
_d424 = [x for x in sub_rows('DHT') if x['form'].startswith('424') and x['filingDate'] >= sub_row('DHT', _dt_accn)['filingDate'] and x['filingDate'] <= REFDATE]
DILUTION['DHT'] = {'clear': True, 'doc': 'edgar_doc_DHT_20260319_f3asr',
                   'short': f"étagère universelle F-3ASR du {sub_row('DHT', _dt_accn)['filingDate']} jamais tirée",
                   'text': (f"F-3ASR {_dt_accn} du {sub_row('DHT', _dt_accn)['filingDate']} lue au document primaire : actions ordinaires et préférentielles, bons, droits, "
                            f"pour la société ou des actionnaires vendeurs, sans plafond ; {len(_d424)} prospectus 424B déposé depuis : jamais tirée ; "
                            f"émetteur étranger (20-F, 6-K) : les rapports 6-K ne sont pas lus par ce crible ; {_dt_url}")}


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
            flag_failed.append(f"résultats le {nxt} ({rank}e séance après le {REFDATE}{', dans les 10 séances' if rank <= 10 else ''}{', dans la fenêtre d’exclusion du scanner (fin ' + EXCL_WINDOW_END + ')' if nxt <= EXCL_WINDOW_END else ''})")
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
            'risk': f"NON — prochaine publication le {nxt} ({rank}e séance) ; R/R vers la résistance {fr(det['geometry']['rr_to_resistance']) if det['geometry']['rr_to_resistance'] else 'non calculable (aucune résistance au-dessus)'}.",
            'short_seller': f"NON — {dl['short']}.",
        }
        base.update({
            'guidance_raised': {'value': det['guidance'] if det['guidance'] is not None else 'unknown',
                                'evidence': (f"8-K {g['accn']} Ex. 99.1 du {g['date']} : « {g['quote']} » ({g['detail']}) ; {g['url']} ; {R(g['doc'])}" if g['doc'] else g['detail'])},
            'eps_beats': {'count': det['consecutive_beats'],
                          'series': [{'period': x['period'], 'actual': x['eps_actual'], 'estimate': r2(x['eps_estimate'], 5), 'beat': x['beat']} for x in surp[s]['quarters']],
                          'evidence': R('36_earnings_surprises_trend') + ' (+ ' + R('30_earnings_quarterly') + ')'},
            'pe_forward': {'value': r2(det['forward_pe'], 2), 'source': R(QP_FILE[s]) + ' quote.forwardPE'},
            'next_earnings': {'date': nxt, 'within_10_sessions': rank <= 10, 'within_scanner_exclusion_window': nxt <= EXCL_WINDOW_END,
                              'evidence': f"{R('37_calendar')} nextEarningsDate = {cal37[s]['nextEarningsDate']} ({cal37[s]['earningsCalendarSource']})"
                                          + (f", recoupé par {R('34_earnings_calendar_filtered')}" if s in cal else ", hors de l'horizon de 30 jours de " + R('34_earnings_calendar_filtered'))
                                          + f" ; {rank}e séance après le {REFDATE}"},
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
_ps = Counter(groups[x]['sector'] for x in post_sharia)
_ps_txt = ', '.join(f"{FR_SECTOR[k]} {v}" for k, v in _ps.most_common())
_lag = [FR_SECTOR[k] for k, v in sector_rs.items() if v['in_mcp_worst'] or (v['rs5_pts'] < 0 and v['rs21_pts'] < 0)]
_nc_ratio = [s for s in leading if sharia[s]['status'] == 'non_compliant' and s not in NATURE_EXCLUDED]
_earn_out = [s for s in tech_surv if by[s]['next_earnings']['within_10_sessions'] or by[s]['next_earnings']['within_scanner_exclusion_window']]
m_ = by['M']
_nc_txt = ', '.join(x + ' (' + fr(D_RATIO[x]['debt_to_assets_pct']) + ' %)' for x in _nc_ratio)
_tech_out = [s for s in post_sharia if s not in tech_surv]
contrarian = (
    f"Sur {len(leading)} noms des groupes en tête, deux sortent sur la nature de l'activité (Clover Health, assureur santé ; Corebridge, assureur-vie) et "
    f"{len(_nc_ratio)} sur le ratio de dette (au-delà de 33 % des actifs) : {_nc_txt}. "
    f"{len(_tech_out)} autres tombent sur la technique, moyennes cassées ({', '.join(_tech_out)}). "
    f"Des {len(tech_surv)} dossiers qui passent la technique, {len(_earn_out)} publient leurs résultats avant la fin de la fenêtre d'exclusion du {dfr(EXCL_WINDOW_END)} "
    f"({', '.join(s + ' le ' + dfr(by[s]['next_earnings']['date']) for s in _earn_out)}) : c'est le pic de la saison. Bio-Techne est en cours de rachat "
    f"(procuration définitive de fusion) : son cours suit le prix de l'offre, pas le marché. Hafnia vient d'émettre {fr_int(HAFN_NEW_SHARES)} actions nouvelles en septembre. "
    f"Reste Macy's (M), comme la veille : prévision annuelle relevée le {dfr(GUIDANCE['M']['date'])} ({GUIDANCE['M']['detail']}), PE prévisionnel {fr(m_['pe_forward']['value'])}, "
    f"extension {fr(m_['ext_ema20_pct'])} % sur la moyenne à vingt séances, mais la source ne sert que {surp['M']['quarters_available']} trimestres de résultats : "
    f"la série de cinq publications au-dessus du consensus n'est pas démontrable, et la note s'arrête à {m_['score_100']}/100. "
    f"Les {len(post_sharia)} noms conformes ou non démontrés se répartissent en {_ps_txt}, pendant que {(', '.join(_lag[:-1]) + ' et ' + _lag[-1]) if len(_lag) > 1 else _lag[0]} {'est' if len(_lag) == 1 else 'sont'} en retrait : "
    f"aucun A+ mid-cap halal, et le pool vide est le résultat honnête."
)
_partial = sorted(x for x in leading if D_TECH.get(x, {}).get('missing_ranges'))
_unk = [x for x in post_sharia if sharia[x]['status'] == 'unknown']
_unk_names = {'BAX': 'Baxter'}
limits = [
    f"performance_rotations est un facet « current » (statut {rot.get('status')}, univers source daté {rot['source_status']['universe']['fetched_at']}, fraîcheur « {rot['source_status']['universe']['status']} », fenêtre non précisée) ; la rotation sectorielle est recoupée par la force relative des ETF SPDR sur barres certifiées au {REFDATE}.",
    f"Le screener borné en capitalisation a renvoyé {len(mid_syms)} noms ; le contrôle sans borne ({pool_ctrl['total']} noms, sans capitalisation dans la réponse) a été coté en entier : aucun autre titre dont la capitalisation quote tombe entre 2 et 20 G$ : aucun candidat manqué.",
    "Capitalisations et fondamentaux (screener, quote, stats, financials) sont des instantanés courants (market_cap_point_in_time=false), horodatés à la clôture du 20/10 ou avant ; aucune donnée postérieure à la clôture de référence n'a servi.",
    "RunAutoScreener n'est pas appelé (refusé par les permissions du dépôt) ; le régime vient de la collecte scanner du jour (" + regime['source_file'] + ").",
    f"earnings_surprises ne sert que {surp['M']['quarters_available']} trimestres : une série de 5 beats n'est jamais démontrable par cette source ; c'est l'éliminatoire qui retient Macy's.",
    (f"QueryData financials est « current-only » ; le ratio dette/actifs vient de l'XBRL EDGAR (dernier 10-Q/10-K, ou rapport IFRS pour Hafnia et DHT, déposé avant la référence). "
     f"{', '.join(_unk_names.get(x, x) for x in _unk)} ne tague aucune dette porteuse d'intérêt à la date d'arrêté : conformité inconnue, sans effet sur son verdict. "
     f"Pour Hafnia, le dernier bilan XBRL déposé avant la référence est arrêté au {D_RATIO['HAFN']['balance_date']} ; pour DHT, au {D_RATIO['DHT']['balance_date']}."),
    "Clover Health (assureur santé, contrats Medicare Advantage) et Corebridge (assurance-vie et rentes) sont exclus sur la nature de l'activité, sans calcul de ratio.",
    f"Revenus impurs mesurés pour Macy's seulement (revenus de carte de crédit {fr(M_IMPURE_PCT)} % du chiffre d'affaires) ; pour les autres noms conformes, le statut halal repose sur la nature d'activité et le ratio dette porteuse d'intérêt / actifs (≤ 33 %).",
    f"Barres incomplètes ou trouées sur {', '.join(_partial)} ; aucun rejet ne dépend d'un trou, sauf AEO ({D_TECH['AEO']['n_bars']} barres servies), rejeté de toute façon pour empilement EMA cassé.",
    "Les prospectus de Baxter (S-3ASR, 424B2) n'ont pas été ouverts : classification inconnue, bloquante, sans effet sur un verdict déjà négatif. Hafnia et DHT sont des émetteurs étrangers (20-F, 6-K) : leurs rapports 6-K ne sont pas lus par ce crible.",
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
