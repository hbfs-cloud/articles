"""Ratio dette porteuse d'intérêt / actifs, point-in-time (dernier 10-Q/10-K déposé <= refdate), source EDGAR XBRL.
Dette = LongTermDebt (courant + non courant) si publié pour la même date d'arrêté ; sinon somme des composantes
(LongTermDebtNoncurrent + LongTermDebtCurrent/DebtCurrent, ConvertibleNotesPayable, SeniorNotes, LineOfCredit...).
Les obligations locatives ne sont PAS comptées (dette porteuse d'intérêt seulement) ; la dette MCP (définition fournisseur,
peut inclure les locations) est rapportée à titre de contrôle."""
import json
from lib import *

from funnel import leading as _LEAD
# Exclus d'office par la nature de l'activité (banque, assurance) : aucun ratio calculé
NATURE_EXCLUDED = {'CRBG': "assureur vie et retraite conventionnel (rentes fixes, indexées et variables, assurance vie, compte à intérêt fixe) d'après le profil MCP"}  # 28/10 : profils MCP des 21 noms des groupes en tête lus
TICKS = [t for t in _LEAD if t not in NATURE_EXCLUDED]
fin = {}
for n in sorted(f[:-5] for f in os.listdir(RAW) if f.startswith('20_fin_stats_')):
    for s, v in qd_rows(load(n), 'financials').items():
        fin[s] = v['row']


FORMS = ('10-Q', '10-K', '20-F', '40-F', '6-K')
IFRS_DEBT = ('Borrowings', 'CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings', 'NoncurrentPortionOfNoncurrentBorrowings',
             'CurrentPortionOfNoncurrentBorrowings', 'NoncurrentBorrowings', 'CurrentBorrowings', 'ShorttermBorrowings', 'LongtermBorrowings')


def facts(t):
    """Taxonomie dont le dernier bilan (Assets déposé <= refdate) est le plus récent : us-gaap, ou ifrs-full pour un
    émetteur passé aux normes IFRS (Frontline : us-gaap arrêté en 2022, ifrs-full au 31/12/2025)."""
    f = load('edgar_companyfacts_subset_' + t)['data']['facts']
    best = None
    for tax in ('us-gaap', 'ifrs-full'):
        A = f.get(tax, {}).get('Assets', {}).get('units', {})
        ends = [x['end'] for xs in A.values() for x in xs if x['filed'] <= REFDATE and x.get('form', '').startswith(FORMS) and 'start' not in x]
        if ends and (best is None or max(ends) > best[0]):
            best = (max(ends), tax)
    tax = best[1] if best else 'us-gaap'
    return f.get(tax, {}), tax


def unit_of(f):
    a = f.get('Assets', {}).get('units', {})
    return 'USD' if 'USD' in a else (sorted(a)[0] if a else 'USD')


def at(f, tag, end, unit='USD'):
    """valeur du tag à la date d'arrêté `end`, déposée <= refdate (la plus récente déposée)."""
    if tag not in f:
        return None
    xs = [x for x in f[tag]['units'].get(unit, []) if x['end'] == end and x['filed'] <= REFDATE
          and x.get('form', '').startswith(FORMS) and 'start' not in x]
    if not xs:
        return None
    return max(xs, key=lambda x: x['filed'])


out = {}
for t in TICKS:
    f, tax = facts(t)
    U = unit_of(f)
    A = [x for x in f.get('Assets', {}).get('units', {}).get(U, []) if x['filed'] <= REFDATE and x.get('form', '').startswith(FORMS) and 'start' not in x]
    if not A:
        out[t] = {'status': 'unknown', 'reason': 'Assets absent du XBRL EDGAR'}
        continue
    a = max(A, key=lambda x: (x['end'], x['filed']))
    end = a['end']
    comp = {}
    ltd = at(f, 'LongTermDebt', end, U) if tax == 'us-gaap' else None
    if tax == 'ifrs-full':
        for tag in IFRS_DEBT:
            v = at(f, tag, end, U)
            if v:
                comp[tag] = v['val']
        if 'Borrowings' in comp:  # total IFRS (courant + non courant) : seul, sans ses composantes
            comp = {'Borrowings': comp['Borrowings']}
        if 'CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings' in comp:
            comp.pop('CurrentPortionOfNoncurrentBorrowings', None); comp.pop('CurrentBorrowings', None); comp.pop('ShorttermBorrowings', None)
        if 'NoncurrentPortionOfNoncurrentBorrowings' in comp:
            comp.pop('NoncurrentBorrowings', None); comp.pop('LongtermBorrowings', None)
    elif ltd:
        comp['LongTermDebt'] = ltd['val']
    else:
        for tag in ('LongTermDebtNoncurrent', 'LongTermDebtCurrent', 'DebtCurrent', 'ConvertibleNotesPayable',
                    'ConvertibleDebtNoncurrent', 'ConvertibleNotesPayableCurrent', 'SeniorNotes', 'LongTermNotesPayable',
                    'NotesPayable', 'LongTermLineOfCredit', 'LineOfCredit', 'SecuredDebt', 'UnsecuredDebt',
                    'LongTermDebtAndCapitalLeaseObligations', 'OtherLongTermDebtNoncurrent', 'SecuredLongTermDebt',
                    'NotesPayableRelatedPartiesClassifiedNoncurrent', 'NotesPayableRelatedPartiesClassifiedCurrent'):
            v = at(f, tag, end, U)
            if v:
                comp[tag] = v['val']
        # éviter le double comptage évident : LongTermDebtAndCapitalLeaseObligations englobe Noncurrent
        if 'LongTermDebtAndCapitalLeaseObligations' in comp and 'LongTermDebtNoncurrent' in comp:
            comp.pop('LongTermDebtAndCapitalLeaseObligations')
        # UnsecuredDebt / SecuredDebt sont des ventilations (souvent en nominal) de la même dette : ignorées si le
        # total non courant est déjà tagué (TSCO : 2 153 826 000 non courant contre 2 170 000 000 nominal non garanti)
        if 'LongTermDebtNoncurrent' in comp:
            comp.pop('UnsecuredDebt', None); comp.pop('SecuredDebt', None)
    debt = sum(comp.values()) if comp else None
    fallback = None
    if (debt is None or set(comp) <= {'LongTermDebtAndCapitalLeaseObligationsCurrent', 'LongTermDebtCurrent', 'DebtCurrent'}) and tax == 'us-gaap':
        # Repli : dernier bilan où la dette totale (LongTermDebt) et Assets sont tous deux tagués, déposé <= refdate.
        LT = [x for x in f.get('LongTermDebt', {}).get('units', {}).get(U, []) if x['filed'] <= REFDATE and x.get('form', '').startswith(FORMS) and 'start' not in x]
        for x in sorted(LT, key=lambda x: (x['end'], x['filed']), reverse=True):
            a2 = at(f, 'Assets', x['end'], U)
            if a2:
                fallback = {'reason': f"dette totale non taguée au {end} (seule la part courante ou rien) : bilan du {x['end']} retenu", 'latest_balance_date': end}
                a, end, comp, debt = a2, x['end'], {'LongTermDebt': x['val']}, x['val']
                break
    mcp_debt = fin.get(t, {}).get('totalDebt')
    r = {'taxonomy': tax, 'unit': U, 'assets': a['val'], 'balance_date': end, 'filed': a['filed'], 'form': a['form'], 'accn': a['accn'],
         'debt_components': comp, 'interest_bearing_debt': debt,
         'debt_to_assets_pct': round(debt / a['val'] * 100, 2) if debt is not None else None,
         'mcp_total_debt': mcp_debt, 'fallback': fallback,
         'mcp_debt_to_assets_pct': round(mcp_debt / a['val'] * 100, 2) if (mcp_debt and U == 'USD') else None}
    if debt is None:
        r['status'] = 'unknown'
        r['reason'] = 'aucune dette porteuse d’intérêt taguée en XBRL à la date d’arrêté'
    else:
        r['status'] = 'fail' if r['debt_to_assets_pct'] > 33 else 'pass'
    out[t] = r
    print(f"{t:5} end={end} assets={a['val']/1e9:.3f}B debt={None if debt is None else round(debt/1e9,3)}B ratio={r['debt_to_assets_pct']} mcp={r['mcp_debt_to_assets_pct']} {r['status']} {list(comp)}")
json.dump(out, open(os.path.join(HERE, '..', 'fortress-step0-derived-sharia-ratios.json'), 'w'), indent=1)
