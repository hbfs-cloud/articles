"""Ratio dette porteuse d'intérêt / actifs, point-in-time (dernier 10-Q/10-K déposé <= refdate), source EDGAR XBRL.
Dette = LongTermDebt (courant + non courant) si publié pour la même date d'arrêté ; sinon somme des composantes
(LongTermDebtNoncurrent + LongTermDebtCurrent/DebtCurrent, ConvertibleNotesPayable, SeniorNotes, LineOfCredit...).
Les obligations locatives ne sont PAS comptées (dette porteuse d'intérêt seulement) ; la dette MCP (définition fournisseur,
peut inclure les locations) est rapportée à titre de contrôle."""
import json
from lib import *

TICKS = ['AVTR', 'AMRX', 'TALO', 'HST', 'CAI', 'HIMS', 'M', 'SMMT', 'GAP', 'ABCL', 'ASST', 'BFLY', 'RXRX', 'BHC']
fin = {}
for n in ('22_financials_current_1', '22_financials_current_2'):
    for s, v in qd_rows(load(n), 'financials').items():
        fin[s] = v['row']


def facts(t):
    return load('edgar_companyfacts_subset_' + t)['data']['facts'].get('us-gaap', {})


def at(f, tag, end):
    """valeur du tag à la date d'arrêté `end`, déposée <= refdate (la plus récente déposée)."""
    if tag not in f:
        return None
    xs = [x for x in f[tag]['units'].get('USD', []) if x['end'] == end and x['filed'] <= REFDATE
          and x.get('form', '').startswith(('10-Q', '10-K')) and 'start' not in x]
    if not xs:
        return None
    return max(xs, key=lambda x: x['filed'])


out = {}
for t in TICKS:
    f = facts(t)
    A = [x for x in f.get('Assets', {}).get('units', {}).get('USD', []) if x['filed'] <= REFDATE and x.get('form', '').startswith(('10-Q', '10-K'))]
    if not A:
        out[t] = {'status': 'unknown', 'reason': 'Assets absent du XBRL EDGAR'}
        continue
    a = max(A, key=lambda x: (x['end'], x['filed']))
    end = a['end']
    comp = {}
    ltd = at(f, 'LongTermDebt', end)
    if ltd:
        comp['LongTermDebt'] = ltd['val']
    else:
        for tag in ('LongTermDebtNoncurrent', 'LongTermDebtCurrent', 'DebtCurrent', 'ConvertibleNotesPayable',
                    'ConvertibleDebtNoncurrent', 'ConvertibleNotesPayableCurrent', 'SeniorNotes', 'LongTermNotesPayable',
                    'NotesPayable', 'LongTermLineOfCredit', 'LineOfCredit', 'SecuredDebt', 'UnsecuredDebt',
                    'LongTermDebtAndCapitalLeaseObligations', 'OtherLongTermDebtNoncurrent'):
            v = at(f, tag, end)
            if v:
                comp[tag] = v['val']
        # éviter le double comptage évident : LongTermDebtAndCapitalLeaseObligations englobe Noncurrent
        if 'LongTermDebtAndCapitalLeaseObligations' in comp and 'LongTermDebtNoncurrent' in comp:
            comp.pop('LongTermDebtAndCapitalLeaseObligations')
    debt = sum(comp.values()) if comp else None
    mcp_debt = fin.get(t, {}).get('totalDebt')
    r = {'assets': a['val'], 'balance_date': end, 'filed': a['filed'], 'form': a['form'], 'accn': a['accn'],
         'debt_components': comp, 'interest_bearing_debt': debt,
         'debt_to_assets_pct': round(debt / a['val'] * 100, 2) if debt is not None else None,
         'mcp_total_debt': mcp_debt,
         'mcp_debt_to_assets_pct': round(mcp_debt / a['val'] * 100, 2) if mcp_debt else None}
    if debt is None:
        r['status'] = 'unknown'
        r['reason'] = 'aucune dette porteuse d’intérêt taguée en XBRL à la date d’arrêté'
    else:
        r['status'] = 'fail' if r['debt_to_assets_pct'] > 33 else 'pass'
    out[t] = r
    print(f"{t:5} end={end} assets={a['val']/1e9:.3f}B debt={None if debt is None else round(debt/1e9,3)}B ratio={r['debt_to_assets_pct']} mcp={r['mcp_debt_to_assets_pct']} {r['status']} {list(comp)}")
json.dump(out, open(os.path.join(HERE, '..', 'fortress-step0-derived-sharia-ratios.json'), 'w'), indent=1)
