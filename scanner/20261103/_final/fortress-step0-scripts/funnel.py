"""Fortress STEP 0 — étapes 1 à 3 (régime, rotation, pool mid-cap, groupes), réutilisées par build.py.
Lecture seule des réponses brutes persistées ; aucun chiffre saisi à la main.
Régime : scanner/<date>/_data/regime_authority.json (collecte scanner du jour) — RunAutoScreener est interdit par
les permissions du dépôt, il n'est donc plus appelé."""
import json
from lib import *

R = lambda name: rel(os.path.join(RAW, name + '.json'))
REGIME_FILE = os.path.normpath(os.path.join(HERE, '..', '..', '_data', 'regime_authority.json'))


def r2(x, n=2):
    return None if x is None else round(x, n)


def fr(x, n=2):
    return f"{x:.{n}f}".replace('.', ',')


# ---------- 1. Régime ----------
_ra = json.load(open(REGIME_FILE))
_reg = _ra['response']['facets']['regime'] if 'response' in _ra else _ra['facets']['regime']
regime = {
    'label': _reg.get('current_state'), 'score': _reg.get('regime_score'),
    'confidence': _reg.get('current_state_confidence'), 'probabilities': _reg.get('probabilities'),
    'scale': _reg.get('scale'), 'as_of': _reg.get('as_of'),
    'dtx_regime': ({'label': _reg['dtx_regime'].get('regime'), 'score': r2(_reg['dtx_regime'].get('regime_score'), 4)}
                   if isinstance(_reg.get('dtx_regime'), dict) else None),
    'source_file': rel(REGIME_FILE),
    'source_files_secondary': [R('03_regime_querydata')],
    'note': 'RunAutoScreener non appelé (refusé par les permissions du dépôt) ; régime lu dans la collecte scanner du jour.',
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
for _s, _v in etf_rows.items():
    assert _v['row'].get('served_completed_end') == REFDATE, (_s, _v['row'].get('served_completed_end'))
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
        lag = True; why.append(f"secteur {ROT_NAME[sector]} dans la liste sectors.worst de performance_rotations (04_performance_rotations)")
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
laggards = [f"{ROT_NAME[k]} ({v['etf']} {fr(v['rs5_pts'])} pts / {fr(v['rs21_pts'])} pts vs SPY sur 5/21 séances{', liste sectors.worst de performance_rotations' if v['in_mcp_worst'] else ''})"
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
_qp_files = sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('11_pool_quote_profile_'))
for name in _qp_files:
    env = load(name)
    q.update({k: v['row'] for k, v in qd_rows(env, 'quote').items()})
    p.update({k: v['row'] for k, v in qd_rows(env, 'profile').items()})
QP_FILE = {}
for name in _qp_files:
    for k in qd_rows(load(name), 'quote'):
        QP_FILE[k] = name
mid_syms = [c['symbol'] for c in pool_mid['candidates']]
missed = [c['symbol'] for c in pool_ctrl['candidates'] if c['symbol'] not in mid_syms and q.get(c['symbol'], {}).get('marketCap')
          and 2e9 <= q[c['symbol']]['marketCap'] <= 2e10]
assert not missed, missed
scr = {c['symbol']: c for c in pool_mid['candidates']}

groups = {}
for s in mid_syms:
    pr = p[s]
    g, why = classify_group(pr.get('sector'), pr.get('industry'))
    groups[s] = {'sector': pr.get('sector'), 'industry': pr.get('industry'), 'country': pr.get('country'), 'class': g, 'why': why}
leading = [s for s in mid_syms if groups[s]['class'] == 'leader']

if __name__ == '__main__':
    print('regime', regime['label'], regime['score'], regime['confidence'])
    print('window', rotation['window_sessions'])
    for k, v in sector_rs.items():
        print(f"  {k:24} {v}")
    for s in mid_syms:
        g = groups[s]
        print(f"{s:5} {q[s]['marketCap']/1e9:6.2f}B {g['class']:8} {g['sector']} / {g['industry']} / {g['country']} :: {g['why']}")
    print('leading', leading)
