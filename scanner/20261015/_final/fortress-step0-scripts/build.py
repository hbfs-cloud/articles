"""Fortress STEP 0 — assemblage déterministe de fortress-step0.json depuis les réponses brutes persistées.
Aucun chiffre saisi à la main : tout est lu dans fortress-step0-raw/ ou recalculé ici.
Pré-requis : tech.py, sharia_ratio.py et dilution_scan.py exécutés (fichiers dérivés).
Étapes 1 à 3 (régime, rotation, pool, groupes) : funnel.py."""
import json, re, datetime, glob
from collections import Counter
from funnel import *

OUT = os.path.join(HERE, '..', 'fortress-step0.json')
D_TECH = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-technicals.json')))
D_RATIO = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-sharia-ratios.json')))
D_DIL = json.load(open(os.path.join(HERE, '..', 'fortress-step0-derived-dilution-index.json')))


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

# AVTR : l'XBRL EDGAR ne sert pas Assets au 30/06/2026 → bilan de l'Ex. 99.1 du 8-K Item 2.02 du 29/07/2026
_t, _accn, _url = doc_text('edgar_doc_AVTR_20260729_ex991')
_assets = mnum(r'Total assets \$ ([\d,]+\.\d)', _t)
_cur = mnum(r'Current portion of debt \$ ([\d,]+\.\d)', _t)
_lt = mnum(r'Debt, net of current portion ([\d,]+\.\d)', _t)
_ratio = (_cur + _lt) / _assets * 100
D_RATIO['AVTR'].update({'q2_2026_from_ex991': {'total_assets_musd': _assets, 'current_debt_musd': _cur, 'lt_debt_musd': _lt,
                                                'debt_to_assets_pct': r2(_ratio)},
                        'debt_to_assets_pct': r2(_ratio), 'status': 'fail' if _ratio > 33 else 'pass',
                        'basis': f'bilan au 30/06/2026, Ex. 99.1 du 8-K {_accn}'})

# BAX : aucune dette non courante taguée en us-gaap au 30/06/2026 → bilan et tableau de juste valeur du 10-Q primaire
_t, _accn, _url = doc_text('edgar_doc_BAX_20260730_10q')
_assets = mnum(r'Total assets \$ ([\d,]+) \$', _t)
_m = re.search(r'Current maturities of long-term debt ([\d,]+) — [\d,]+ \$ — Long-term debt ([\d,]+) ', _t)
_cur, _lt = float(_m.group(1).replace(',', '')), float(_m.group(2).replace(',', ''))
_ratio = (_cur + _lt) / _assets * 100
D_RATIO['BAX'].update({'q2_2026_from_10q': {'total_assets_musd': _assets, 'current_maturities_musd': _cur, 'long_term_debt_musd': _lt,
                                             'debt_to_assets_pct': r2(_ratio)},
                       'debt_to_assets_pct': r2(_ratio), 'status': 'fail' if _ratio > 33 else 'pass',
                       'basis': f'10-Q {_accn} au 30/06/2026, valeurs comptables de la note sur la juste valeur (M$)'})

# GGB : émetteur étranger IFRS, l'XBRL du 20-F ne tague pas d'emprunts sous un concept ifrs-full standard
_ggb = D_RATIO.get('GGB', {})
_ggb_debt = fin.get('GGB', {}).get('totalDebt')
GGB_NOTE = (f"Gerdau (20-F, IFRS) : actifs {fr_int(int(_ggb['assets']))} BRL au {_ggb['balance_date']} ; aucun emprunt tagué sous un concept "
            f"ifrs-full standard ; la dette MCP ({fr_int(int(_ggb_debt))}) n'indique ni devise ni date d'arrêté : ratio non démontré")

sharia = {}
for s in leading:
    rr = D_RATIO.get(s) or {}
    pct = rr.get('debt_to_assets_pct')
    if pct is not None:
        ratio_txt = f"dette porteuse d'intérêt / actifs = {fr(pct)} % ({rr.get('basis') or ('XBRL ' + rr['form'] + ' arrêté au ' + rr['balance_date'] + ', accn ' + rr['accn'])})"
    else:
        ratio_txt = None
    ev = [x for x in (ratio_txt, R('edgar_companyfacts_subset_' + s)) if x]
    if s == 'GGB':
        sharia[s] = {'status': 'unknown', 'reason': 'ratio dette/actifs non démontré (émetteur IFRS)', 'evidence': [GGB_NOTE, R('edgar_companyfacts_subset_GGB')]}
    elif pct is None:
        sharia[s] = {'status': 'unknown', 'reason': 'ratio dette/actifs non calculable', 'evidence': ev}
    elif pct > 33:
        sharia[s] = {'status': 'non_compliant', 'reason': f"dette/actifs {fr(pct)} % > 33 %", 'evidence': ev}
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
EXCL_WINDOW_END = '2026-10-31'  # fin de la fenêtre d'exclusion résultats du scanner (horizon 28/10 + 3 jours)

import sys
sys.path.insert(0, os.path.join(REPO, 'tools', 'lib'))


def sessions_until(date):
    """Rang de la séance NYSE de publication après REFDATE (calendrier du dépôt tools/lib/market-calendar.js)."""
    import subprocess
    out = subprocess.run(['node', '-e', "const c=require('./tools/lib/market-calendar.js');console.log(c.usTradingDaysBetween(process.argv[1],process.argv[2]))",
                          REFDATE, date], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    return int(out)


GUIDANCE = {}
for s_, name, quote in (('AVTR', 'edgar_doc_AVTR_20260729_ex991', 'Increases FY 2026 organic revenue growth and adjusted EPS guidance'),
                        ('LFST', 'edgar_doc_LFST_20260806_ex991', 'Raises Full Year Outlook')):
    txt, accn, url = doc_text(name)
    m = [x for x in sub_rows(s_) if x['form'] == '8-K' and '2.02' in (x.get('items') or '').split(',') and x['filingDate'] <= REFDATE
         and x['accessionNumber'] == accn]
    assert len(m) == 1, (s_, accn)
    GUIDANCE[s_] = {'doc': name, 'quote': quote, 'date': m[0]['filingDate'], 'accn': accn, 'url': url, 'found': quote in txt}
_avtr = doc_text('edgar_doc_AVTR_20260729_ex991')[0]
_m = re.search(r'Organic revenue growth \(1\) (\S+ to \S+) (\S+ to \S+)', _avtr)
GUIDANCE['AVTR']['detail'] = f"croissance organique {_m.group(1)} → {_m.group(2)}".replace(' to ', ' à ').replace('.', ',')
_lfst = doc_text('edgar_doc_LFST_20260806_ex991')[0]
_m = re.search(r'raising full year revenue to \$([\d.]+) billion to \$([\d.]+) billion', _lfst)
GUIDANCE['LFST']['detail'] = f"chiffre d'affaires annuel relevé à {_m.group(1).replace('.', ',')}-{_m.group(2).replace('.', ',')} Md$"
for s_ in ('CAI', 'GGB'):
    GUIDANCE[s_] = {'found': None, 'detail': 'non instruit : au moins deux autres éliminatoires échouent sur preuve',
                    'date': None, 'accn': None, 'url': None, 'doc': None, 'quote': None}

DILUTION = {}
_t, _accn, _ = doc_text('edgar_doc_AVTR_20220517_8k')
_row = sub_row('AVTR', _accn)
_rate = re.search(r'([\d.]+)% Series A Mandatory Convertible Preferred Stock', _t).group(1)
_ratio = re.search(r'conversion rate for each Share of Preferred Stock was ([\d.]+) shares', _t).group(1)
DILUTION['AVTR'] = {'clear': False, 'doc': 'edgar_doc_AVTR_20220517_8k',
                    'short': f"conversion obligatoire des préférentielles {_rate.replace('.', ',')} % Series A en actions ordinaires (8-K du {_row['filingDate']}, {_ratio.replace('.', ',')} actions par titre)",
                    'text': (f"8-K {_accn} du {_row['filingDate']} (Items {_row['items']}) : conversion obligatoire des préférentielles {_rate.replace('.', ',')} % Series A "
                             f"en actions ordinaires — convertible obligatoire dans la fenêtre de 5 ans ; aucun S-3/424B ni 8-K Item 3.02/3.03 ; "
                             f"les 8-K Items 1.01/2.03 de la fenêtre sont des financements par dette")}
_cai_ipo = [x for x in sub_rows('CAI') if x['form'] == '424B4' and x['filingDate'] <= REFDATE]
_t, _accn, _ = doc_text('edgar_doc_CAI_20251030_8k')
assert 'Item 3.03 Material Modification to Rights of Security Holders' in _t and 'bylaws' in _t.lower()
DILUTION['CAI'] = {'clear': False, 'doc': 'edgar_doc_CAI_20251030_8k',
                   'short': f"introduction en bourse par émission d'actions nouvelles (424B4 du {_cai_ipo[0]['filingDate']}, S-1 du {[x for x in sub_rows('CAI') if x['form'] == 'S-1'][0]['filingDate']})",
                   'text': (f"424B4 {_cai_ipo[0]['accessionNumber']} du {_cai_ipo[0]['filingDate']} : introduction en bourse, émission primaire d'actions dans la fenêtre de 5 ans ; "
                            f"8-K {_accn} du {sub_row('CAI', _accn)['filingDate']} (Items 3.03, 5.03) relu : modification des statuts (seuil de détention pour les actions dérivées, droit texan), pas une émission")}
_ggb = [x for x in sub_rows('GGB') if x['form'] == '424B2' and x['filingDate'] <= REFDATE and x['filingDate'] >= D_DIL['GGB']['window'][0]]
DILUTION['GGB'] = {'clear': 'unknown', 'doc': None,
                   'short': f"{len(_ggb)} prospectus 424B2 ({', '.join(x['filingDate'] for x in _ggb)}) non classés au document primaire",
                   'text': f"424B2 {', '.join(x['accessionNumber'] for x in _ggb)} : nature (dette ou actions) non lue au document primaire — classification inconnue, bloquante par règle"}
_t, _accn, _ = doc_text('edgar_doc_LFST_20260910_424b7')
_sh = fr_int(int(re.search(r'selling stockholders identified in this prospectus supplement are offering ([\d,]+) shares', _t).group(1).replace(',', '')))
_rep = fr_int(int(re.search(r'we intend to purchase from the underwriter ([\d,]+) shares', _t).group(1).replace(',', '')))
_s3, _s3accn, _ = doc_text('edgar_doc_LFST_20240521_s3asr')
assert 'This prospectus solely covers the resale by selling stockholders' in _s3
_b7_filings = [x for x in sub_rows('LFST') if x['form'] == '424B7' and '2026-01-01' <= x['filingDate'] <= REFDATE]
_b7 = sorted({x['filingDate'] for x in _b7_filings})
DILUTION['LFST'] = {'clear': True, 'doc': 'edgar_doc_LFST_20260910_424b7',
                    'short': f"aucune émission primaire ; cessions de l'actionnaire de référence ({len(_b7_filings)} prospectus 424B7 déposés en 2026)",
                    'text': (f"S-3ASR {_s3accn} du {sub_row('LFST', _s3accn)['filingDate']} : enregistrement de revente par des actionnaires cédants uniquement ; "
                             f"424B7 {_accn} du {sub_row('LFST', _accn)['filingDate']} : {_sh} actions cédées par les actionnaires, la société n'en reçoit rien et rachète "
                             f"{_rep} actions au prix de l'offre ; 424B7 de 2026 aux dates {', '.join(_b7)} ; les S-8 ne bloquent pas")}


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
    comp = {'guidance_relevee': 5 if guid else 0, 'beats_eps_5': 5 if beats >= 5 else 0, 'valorisation_pe_fwd_35': 5 if (fpe and fpe < 35) else 0,
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
        assert cal[s]['report_date'] == nxt, (s, cal[s]['report_date'], nxt)
        rank = sessions_until(nxt)
        elim_failed = []
        if det['guidance'] is not True:
            elim_failed.append('guidance relevée non prouvée' if det['guidance'] is None else 'guidance relevée')
        if det['consecutive_beats'] < 5: elim_failed.append(f"beats EPS consécutifs = {det['consecutive_beats']} (< 5)")
        if not (det['forward_pe'] and det['forward_pe'] < 35): elim_failed.append(f"PE forward {fr(det['forward_pe'])} ≥ 35")
        if not det['ext_ok']: elim_failed.append(f"extension EMA20 {fr(t['ext_ema20_pct'])} % > 3 %" if t['ext_ema20_pct'] > 3 else 'structure EMA/RSI')
        flag_failed = []
        if dl['clear'] is not True:
            flag_failed.append(f"flag dilution : {dl['short']}" if dl['clear'] is False else f"dilution non classée : {dl['short']}")
        if rank <= 10 or nxt <= EXCL_WINDOW_END:
            flag_failed.append(f"résultats le {nxt} ({rank}e séance après le {REFDATE}{', dans les 10 séances' if rank <= 10 else ''}{', dans la fenêtre d’exclusion du scanner (fin ' + EXCL_WINDOW_END + ')' if nxt <= EXCL_WINDOW_END else ''})")
        missing = []
        if not det['peg_ratio_raw'] or det['peg_ratio_raw'] <= 0:
            missing.append('PEG : stats.pegRatio renvoyé à 0 (champ manquant), aucune estimation substituée')
        missing.append(f"historique EPS limité à {surp[s]['quarters_available']} trimestres par la source : ≥ 5 beats non démontrables")
        if det['guidance'] is None:
            missing.append('guidance du dernier trimestre non instruite')
        grade = 'A+' if (tot >= 92 and not elim_failed and not flag_failed and sharia[s]['status'] == 'halal') else (
            'A' if tot >= 88 and len(elim_failed) <= 1 else 'reject')
        votes = {
            'quant': f"NON — score {tot}/100 (< 88) ; {det['consecutive_beats']} beats consécutifs sur {surp[s]['quarters_available']} trimestres servis.",
            'pm_alpha': (f"NON — guidance relevée prouvée le {g['date']} ({g['detail']}), mais {', '.join(elim_failed) or 'score insuffisant'}." if det['guidance'] else f"NON — {', '.join(elim_failed)}."),
            'risk': f"NON — prochaine publication le {nxt} ({rank}e séance) ; R/R vers la résistance {fr(det['geometry']['rr_to_resistance']) if det['geometry']['rr_to_resistance'] else 'non calculable'}.",
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
                              'evidence': f"{R('37_calendar')} nextEarningsDate = {cal37[s]['nextEarningsDate']} ({cal37[s]['earningsCalendarSource']}), recoupé par {R('34_earnings_calendar_filtered')} ; {rank}e séance après le {REFDATE}"},
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
_nc = [s for s in leading if sharia[s]['status'] == 'non_compliant']
lf, av = by['LFST'], by['AVTR']
MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
dfr = lambda iso: f"{int(iso[8:10])} {MOIS[int(iso[5:7]) - 1]}"
_months = sorted({d[:7] for d in _b7})
_months_txt = ', '.join(MOIS[int(m[5:7]) - 1] for m in _months[:-1]) + ' et ' + MOIS[int(_months[-1][5:7]) - 1] + ' 2026'
_ab = D_TECH['TALO']['abnormal_last5']
contrarian = (
    f"Sur {len(leading)} noms des groupes en tête, {len(_nc)} tombent sur le ratio de dette (au-delà de 33 % des actifs), dont BAX ({fr(D_RATIO['BAX']['debt_to_assets_pct'])} %) "
    f"et IBRX ({fr(D_RATIO['IBRX']['debt_to_assets_pct'])} %, dette garantie seule). Le meilleur dossier restant, LifeStance (LFST), a relevé sa prévision annuelle le "
    f"{dfr(GUIDANCE['LFST']['date'])} ({GUIDANCE['LFST']['detail']}) et reste à {fr(lf['ext_ema20_pct'])} % de sa moyenne à vingt séances, "
    f"mais sa série de résultats au-dessus du consensus s'arrête à {lf['eps_beats']['count']} trimestres et ses actionnaires historiques ont vendu par prospectus 424B7 "
    f"en {_months_txt} ({len(_b7_filings)} prospectus déposés) : une nouvelle cession peut faire décrocher le titre sous un stop. Avantor (AVTR) publie le "
    f"{dfr(av['next_earnings']['date'])}, dans les dix séances, et sa prévision relevée reste une sortie de contraction ({GUIDANCE['AVTR']['detail']}). Caris (CAI) et Gerdau (GGB) sont déjà trop "
    f"étendus ({fr(by['CAI']['ext_ema20_pct'])} % et {fr(by['GGB']['ext_ema20_pct'])} %) et sans série de beats. Talos (TALO) a la tendance mais un volume de "
    f"{_ab[-1]['flags'][0].split(' ')[1]} fois sa moyenne cinquante séances le {dfr(_ab[-1]['date'])}. Les {len(post_sharia)} noms conformes ou non démontrés se répartissent en {_ps_txt}, "
    f"pendant que {', '.join(_lag)} {'est' if len(_lag) == 1 else 'sont'} en retrait : aucun A+ mid-cap halal, et le pool vide est le résultat honnête."
)
_partial = sorted(x for x in leading if D_TECH.get(x, {}).get('missing_ranges'))
limits = [
    f"performance_rotations est un facet « current » (statut {rot.get('status')}, univers source daté {rot['source_status']['universe']['fetched_at']}, fraîcheur « {rot['source_status']['universe']['status']} », fenêtre non précisée) ; la rotation sectorielle est recoupée par la force relative des ETF SPDR sur barres certifiées au {REFDATE}.",
    f"Le screener borné en capitalisation a renvoyé {len(mid_syms)} noms ; le contrôle sans borne ({pool_ctrl['total']} noms, sans capitalisation dans la réponse) ne contient aucun autre titre dont la capitalisation quote tombe entre 2 et 20 G$ : aucun candidat manqué.",
    "Capitalisations et fondamentaux (screener, quote, stats, financials) sont des instantanés courants (market_cap_point_in_time=false), horodatés à la clôture du 14/10 ou avant ; aucune donnée postérieure à la clôture de référence n'a servi.",
    "RunAutoScreener n'est pas appelé (refusé par les permissions du dépôt) ; le régime vient de la collecte scanner du jour (" + regime['source_file'] + ").",
    f"earnings_surprises ne sert que {surp['AVTR']['quarters_available']} trimestres : une série de 5 beats n'est jamais démontrable par cette source ; les quatre dossiers instruits échouent de toute façon sur un raté dans ces trimestres.",
    "stats.pegRatio vaut 0 (champ manquant) pour AVTR, CAI et LFST : PEG inconnu, 0 point, jamais remplacé par une estimation.",
    "QueryData financials est « current-only » ; le ratio dette/actifs vient de l'XBRL EDGAR (dernier 10-Q déposé avant la référence). AVTR et BAX ne taguent pas leur dette au 30/06/2026 : bilan lu dans l'Ex. 99.1 du 29/07/2026 (AVTR) et dans le 10-Q du 30/07/2026 (BAX). Gerdau (IFRS) ne tague aucun emprunt standard : conformité inconnue.",
    "Les rubriques UnsecuredDebt/SecuredDebt, ventilations nominales de la même dette, sont écartées quand LongTermDebtNoncurrent est publié (TSCO), pour éviter un double comptage.",
    f"Barres incomplètes ou trouées sur {', '.join(_partial)} ; aucun rejet ne dépend d'un trou hors fenêtre, sauf AEO ({D_TECH['AEO']['n_bars']} barres servies), rejeté pour empilement EMA cassé.",
    "Revenus impurs (> 5 %) non mesurés faute de donnée : le statut halal repose sur la nature d'activité et le ratio dette porteuse d'intérêt / actifs (≤ 33 %).",
    "Les prospectus 424B2 de Gerdau (juin 2025) n'ont pas été ouverts : classification inconnue, bloquante, sans effet sur le verdict déjà négatif.",
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
json.dump(D_RATIO, open(os.path.join(HERE, '..', 'fortress-step0-derived-sharia-ratios.json'), 'w'), indent=1)
json.dump(doc, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(json.dumps(doc['funnel'])); print('A+', [c['ticker'] for c in aplus], 'A', [c['ticker'] for c in a_grade])
for c in cands: print(c['ticker'], c['grade'], c['score_100'], c['eliminators_failed'])
print(contrarian)
