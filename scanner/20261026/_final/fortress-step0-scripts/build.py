"""Fortress STEP 0 — assemblage déterministe de fortress-step0.json depuis les réponses brutes persistées (séance du 26/10/2026).
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
for n in sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('20_fin_stats_')):
    stats.update({k: v['row'] for k, v in qd_rows(load(n), 'stats').items()})
EXCL_WINDOW_END = '2026-11-09'  # fin de la fenêtre d'exclusion résultats du scanner (horizon 06/11 + 3 jours)
WIN_START = '2026-04-23'  # fenêtre de dilution : six mois jusqu'à la clôture de référence


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


def first(s, form, since='2021-10-23'):
    return [x for x in sub_rows(s) if x['form'] == form and since <= x['filingDate'] <= REFDATE]


DILUTION = {}
OFFER = ('S-1', 'S-3', 'S-3ASR', 'S-4', 'F-1', 'F-3', '424B', 'DEFM14A')
def _win_offers(s):
    return [x for x in D_DIL[s]['hits'] if x['form'].startswith(OFFER) and WIN_START <= x['filingDate'] <= REFDATE]
def _win_8k(s):
    return [x for x in D_DIL[s]['hits'] if x['form'].startswith('8-K') and any(i in (x['items'] or '').split(',') for i in ('3.02', '3.03')) and WIN_START <= x['filingDate'] <= REFDATE]
# Strive : 424B5 du 16/10/2026 (document primaire lu) — 7 000 000 actions de préférence perpétuelles SATS à 15 %, programme au fil de l'eau annoncé
_as, _as_accn, _as_url = doc_text('edgar_doc_ASST_20261016_424b5')
_asm = re.search(r'STRIVE, INC\. ([\d,]+) Shares ([\d.]+)% Series A Perpetual SATS Preferred Stock', _as)
_asp = re.search(r'Per Share Total Public offering price \$ ([\d.]+) \$ ([\d,]+)', _as)
assert _asm and _asp and 'commence an at-the-market offering of SATS Stock' in _as
_a424 = [x for x in sub_rows('ASST') if x['form'].startswith('424') and WIN_START <= x['filingDate'] <= REFDATE]
_a302 = [x for x in sub_rows('ASST') if x['form'].startswith('8-K') and any(i in (x.get('items') or '').split(',') for i in ('3.02', '3.03')) and WIN_START <= x['filingDate'] <= REFDATE]
DILUTION['ASST'] = {'clear': False, 'doc': 'edgar_doc_ASST_20261016_424b5',
                    'short': f"émission de {_asm.group(1).replace(',', ' ')} actions de préférence perpétuelles SATS à {float(_asm.group(2)):g} % ({_asp.group(2).replace(',', ' ')} $, 424B5 du {dfr(sub_row('ASST', _as_accn)['filingDate'])}), programme au fil de l'eau annoncé",
                    'text': (f"424B5 {_as_accn} du {sub_row('ASST', _as_accn)['filingDate']} lu au document primaire : {_asm.group(1)} actions de préférence perpétuelles « SATS » à dividende cumulatif de {_asm.group(2)} %, "
                             f"prix {_asp.group(1)} $, {_asp.group(2)} $ au total, et intention de lancer un programme d'émission au fil de l'eau de ces actions ; "
                             f"{len(_a424)} prospectus 424B dans la fenêtre de dilution ouverte le {dfr(WIN_START)} 2026 ({', '.join(x['filingDate'] for x in _a424)}) et {len(_a302)} 8-K portant l'item 3.02 ou 3.03 ({', '.join(x['filingDate'] for x in _a302)}) : émission d'actions en cours ; {_as_url}")}
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
# dLocal : émetteur étranger ; 424B3 de septembre 2025 = vente par General Atlantic (lu), aucun produit pour la société
_dl, _dl_accn, _dl_url = doc_text('edgar_doc_DLO_20250904_424b3')
_dlm = re.search(r'This is a public offering of ([\d,]+) Class A common shares .*?by (General Atlantic [A-Z. ]+?), or the selling shareholder', _dl)
assert _dlm and 'We will not receive any proceeds' in _dl and not _win_offers('DLO')
DILUTION['DLO'] = {'clear': True, 'doc': 'edgar_doc_DLO_20250904_424b3',
                   'short': f"émetteur étranger (20-F, 6-K) sans offre d'actions dans la fenêtre ; 424B3 de septembre 2025 = vente de {_dlm.group(1).replace(',', ' ')} actions par un actionnaire existant ; rapports 6-K non lus",
                   'text': (f"424B3 {_dl_accn} du {sub_row('DLO', _dl_accn)['filingDate']} lu au document primaire : offre de {_dlm.group(1)} actions de classe A par {_dlm.group(2).strip()}, actionnaire vendeur ; « We will not receive any proceeds » : aucune action nouvelle ; "
                            f"hors fenêtre ; dans la fenêtre, seul un Schedule 13D/A ; les rapports 6-K, par lesquels un émetteur étranger peut annoncer un placement non enregistré, n'ont pas été lus ; {_dl_url}")}
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
                          'evidence': R('36_earnings_surprises_trend') + ' (+ ' + R('30_earnings_quarterly') + ')'},
            'pe_forward': {'value': r2(det['forward_pe'], 2), 'source': R(QP_FILE[s]) + ' quote.forwardPE'},
            'next_earnings': {'date': nxt, 'within_10_sessions': rank <= 10, 'within_scanner_exclusion_window': nxt <= EXCL_WINDOW_END,
                              'evidence': f"{R('37_calendar')} nextEarningsDate = {cal37[s]['nextEarningsDate']} ({cal37[s]['earningsCalendarSource']})"
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
NAMEFR = {'GGB': 'Gerdau (GGB)', 'DHT': 'DHT', 'ASST': 'Strive (ASST)', 'SWKS': 'Skyworks (SWKS)', 'ZETA': 'Zeta Global (ZETA)',
          'IOVA': 'Iovance (IOVA)', 'BB': 'BlackBerry (BB)', 'DLO': 'dLocal (DLO)'}
_ps = Counter(groups[x]['sector'] for x in post_sharia)
_ps_txt = ', '.join(f"{FR_SECTOR[k]} {v}" for k, v in _ps.most_common())
_lag = [FR_SECTOR[k] for k, v in sector_rs.items() if v['in_mcp_worst'] or (v['rs5_pts'] < 0 and v['rs21_pts'] < 0)]
_nc_ratio = [s for s in leading if sharia[s]['status'] == 'non_compliant' and s not in NATURE_EXCLUDED]
_earn_out = sorted([s for s in tech_surv if by[s]['next_earnings']['within_10_sessions'] or by[s]['next_earnings']['within_scanner_exclusion_window']], key=lambda s: by[s]['next_earnings']['date'])
_rest = [s for s in tech_surv if s not in _earn_out]
assert sorted(_rest) == ['ASST', 'BB', 'DLO'] and all(by[x]['grade'] == 'reject' for x in _rest), [(x, by[x]['grade']) for x in _rest]
_nc_txt = ', '.join(x + ' (' + fr(D_RATIO[x]['debt_to_assets_pct']) + ' %' + (', bilan du ' + dfr(D_RATIO[x]['balance_date']) + ' ' + D_RATIO[x]['balance_date'][:4] if D_RATIO[x].get('fallback') else '') + ')' for x in _nc_ratio)
_tech_out = [s for s in post_sharia if s not in tech_surv]
_tech_why = {s: tech_fail[s][0].split(' (')[0] for s in _tech_out}
_tech_groups = Counter(_tech_why.values())
_as_txt = load('edgar_doc_ASST_20261016_424b5')['data']['text']
_btc = re.search(r'As of (\w+ \d+, \d{4}), we held approximately ([\d,]+) bitcoin', _as_txt)
assert _btc
_b, _d, _a = by['BB'], by['DLO'], by['ASST']
contrarian = (
    f"Sur {len(leading)} noms des groupes en tête, quatre sortent sur la nature de l'activité (Clover Health, assureur santé ; Inter & Co, banque ; Old Republic, assureur ; StoneCo, qui préfinance des créances et prête) et "
    f"{len(_nc_ratio)} sur le ratio de dette (au-delà de 33 % des actifs) : {_nc_txt}. "
    f"{len(_tech_out)} autres tombent sur la technique : {', '.join(k + ' (' + ', '.join(s for s in _tech_out if _tech_why[s] == k) + ')' for k in _tech_groups)}. "
    f"Des {len(tech_surv)} dossiers qui passent la technique, {len(_earn_out)} publient leurs résultats avant la fin de la fenêtre d'exclusion du {dfr(EXCL_WINDOW_END)} "
    f"({', '.join(NAMEFR[s] + ' le ' + dfr(by[s]['next_earnings']['date']) for s in _earn_out)}) : c'est le pic de la saison. "
    f"Restent trois dossiers, tous rejetés sur leurs éliminatoires : BlackBerry (BB), qui publie le {dfr(_b['next_earnings']['date'])}, PE prévisionnel {fr(_b['pe_forward']['value'])} au-dessus de 35 et {_b['eps_beats']['count']} résultats au-dessus du consensus sur {surp['BB']['quarters_available']} trimestres servis ; "
    f"dLocal (DLO), le {dfr(_d['next_earnings']['date'])}, aucune série de résultats au-dessus du consensus ({_d['eps_beats']['count']} d'affilée) ; "
    f"Strive (ASST), le {dfr(_a['next_earnings']['date'])} : extension {fr(_a['ext_ema20_pct'])} % sur la moyenne à vingt séances, PE prévisionnel négatif ({fr(_a['pe_forward']['value']).replace('-', '−')}), {_a['eps_beats']['count']} résultat au-dessus du consensus d'affilée, "
    f"et {DILUTION['ASST']['short']} ; c'est une trésorerie en bitcoin ({_btc.group(2).replace(',', ' ')} bitcoins au {dfr(datetime.datetime.strptime(_btc.group(1), '%B %d, %Y').strftime('%Y-%m-%d'))} 2026, selon ce prospectus), dont la conformité reste débattue et non démontrée. "
    f"Les {len(post_sharia)} noms conformes ou non démontrés se répartissent en {_ps_txt}, pendant que {(', '.join(_lag[:-1]) + ' et ' + _lag[-1]) if len(_lag) > 1 else _lag[0]} {'est' if len(_lag) == 1 else 'sont'} en retrait : "
    f"aucun A+ mid-cap halal, et le pool vide est le résultat honnête."
)
_partial = sorted(x for x in post_sharia if D_TECH.get(x, {}).get('missing_ranges'))
_big_holes = [x for x in _partial if len(D_TECH[x]['missing_ranges'] or []) > 5]
_unk = [x for x in post_sharia if sharia[x]['status'] == 'unknown']
_unk_names = {'IOVA': 'Iovance', 'TOST': 'Toast', 'PEGA': 'Pegasystems', 'ASST': 'Strive', 'GGB': 'Gerdau'}
_ifrs = sorted(x for x in D_RATIO if D_RATIO[x].get('taxonomy') == 'ifrs-full')
_stale_bal = sorted(x for x in D_RATIO if D_RATIO[x].get('balance_date') and D_RATIO[x]['balance_date'] < '2026-01-01' and not D_RATIO[x].get('fallback'))
_fb = sorted(x for x in D_RATIO if D_RATIO[x].get('fallback'))
assert _fb == ['BAX'] and all(any('barres incomplètes' in f for f in tech_fail[x]) for x in _big_holes)
_bx = D_RATIO['BAX']
_beats_cap = [x for x in tech_surv if surp[x]['consecutive_beats'] == surp[x]['quarters_available'] == 4]
limits = [
    f"performance_rotations est un facet « current » (statut {rot.get('status')}, univers source daté {rot['source_status']['universe']['fetched_at']}, fraîcheur « {rot['source_status']['universe']['status']} », fenêtre non précisée) ; la rotation sectorielle est recoupée par la force relative des ETF SPDR sur barres certifiées au {REFDATE}.",
    f"Le screener borné en capitalisation a renvoyé {len(mid_syms)} noms ; le contrôle sans borne ({pool_ctrl['total']} noms, sans capitalisation dans la réponse) a été coté en entier : aucun autre titre dont la capitalisation quote tombe entre 2 et 20 G$ : aucun candidat manqué.",
    "Capitalisations et fondamentaux (screener, quote, stats, financials) sont des instantanés courants (market_cap_point_in_time=false), relevés le samedi 24/10 ; aucune barre ni aucun dépôt postérieur à la clôture de référence du vendredi 23/10 n'a servi.",
    "RunAutoScreener n'est pas appelé (refusé par les permissions du dépôt) ; le régime vient de la collecte scanner du jour (" + regime['source_file'] + ").",
    f"earnings_surprises ne sert que {max(surp[x]['quarters_available'] for x in tech_surv)} trimestres au plus : une série de 5 beats n'est jamais démontrable par cette source ; {', '.join(NAMEFR[x] for x in _beats_cap)}, avec 4 beats sur 4 trimestres servis, butent sur cette limite.",
    (f"QueryData financials est « current-only » ; le ratio dette/actifs vient de l'XBRL EDGAR (dernier 10-Q/10-K, ou rapport IFRS 20-F/40-F pour {', '.join(_ifrs)}, déposé avant la référence ; la taxonomie retenue est celle du bilan le plus récent, d'où Frontline lu en IFRS au 31/12/2025 et non sur sa série us-gaap arrêtée en 2022). "
     f"{', '.join(_unk_names.get(x, x) for x in _unk)} ne taguent aucune dette porteuse d'intérêt à la date d'arrêté : conformité inconnue, sans effet sur leurs verdicts. "
     f"Baxter : le 10-Q au {_bx['fallback']['latest_balance_date']} ne tague que la part courante de la dette ; ratio calculé sur le bilan du {_bx['balance_date']} ({fr(_bx['interest_bearing_debt'] / 1e9, 3)} Md$ de dette à long terme pour {fr(_bx['assets'] / 1e9, 3)} Md$ d'actifs, {fr(_bx['debt_to_assets_pct'])} %), dette fournisseur {fr(_bx['mcp_debt_to_assets_pct'])} %. "
     f"Bilans XBRL antérieurs à 2026 pour {', '.join(x + ' (' + D_RATIO[x]['balance_date'] + ')' for x in _stale_bal)}. "
     f"GameStop à {fr(D_RATIO['GME']['debt_to_assets_pct'])} % sur ses billets à long terme (XBRL LongTermNotesPayable), quel que soit leur coupon."),
    "Clover Health (assureur santé, contrats Medicare Advantage), Inter & Co (banque), Old Republic (assurance spécialisée et assurance titres) et StoneCo (prépaiement de créances, banque numérique et crédit, d'après son profil) sont exclus sur la nature de l'activité, sans calcul de ratio. Ardagh Metal Packaging fabrique aussi des canettes pour boissons alcoolisées, d'après son profil ; elle sort de toute façon sur le ratio de dette.",
    "Revenus impurs non mesurés : pour les noms conformes, le statut halal repose sur la nature d'activité et le ratio dette porteuse d'intérêt / actifs (≤ 33 %).",
    (f"Barres incomplètes ou trouées sur {', '.join(_partial)} ; {', '.join(x + ' (' + str(D_TECH[x]['n_bars']) + ' barres, ' + str(len(D_TECH[x]['missing_ranges'])) + ' séances manquantes)' for x in _big_holes)} "
     f"sont rejetés pour barres incomplètes (leur empilement EMA est aussi cassé) ; pour les autres, moins de six séances manquent et aucun verdict n'en dépend."),
    ("Dilution lue au document primaire pour Strive (424B5 du 16 octobre : actions de préférence SATS à 15 %, programme au fil de l'eau annoncé), BlackBerry (8-K du 29 janvier 2024 : obligations convertibles à 3 % 2029, conversion au choix du porteur ; 8-K du 22 septembre 2026 : contrat QNX) "
     "et dLocal (424B3 de septembre 2025 : vente par General Atlantic, aucune action nouvelle) ; les rapports 6-K de dLocal, émetteur étranger, n'ont pas été lus. "
     "Pour les cinq dossiers rejetés sur la date de résultats, la dilution n'est pas instruite : " + ' ; '.join(f"{NAMEFR[x]} — {DILUTION[x]['short'].split(' ; ', 1)[1]}" for x in _earn_out) + '.'),
    "La guidance n'est instruite pour aucun des huit survivants techniques : chacun est rejeté sur des preuves qui n'en dépendent pas (résultats dans la fenêtre pour cinq ; série de beats, PE prévisionnel, extension ou dilution pour BlackBerry, dLocal et Strive).",
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
