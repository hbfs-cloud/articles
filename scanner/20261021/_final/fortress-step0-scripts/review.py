"""fortress-review.json (format du 15/10) dérivé de fortress-step0.json — aucun chiffre ajouté."""
import json, datetime
from lib import *
S = json.load(open(os.path.join(HERE, '..', 'fortress-step0.json')))
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
funnel = dict(S['funnel'])
funnel['_post_sharia_note'] = (f"post_sharia compte {funnel['post_sharia_confirmed']} noms jugés conformes et "
                               + ', '.join(c['ticker'] for c in S['candidates'] if c['sharia']['status'] == 'unknown')
                               + ', dont la conformité reste inconnue.')
wc = []
for c in S['candidates']:
    if c['grade'] == 'A' or c['sharia']['status'] == 'unknown':
        wc.append({'ticker': c['ticker'], 'name': c['name'], 'grade': c['grade'], 'compliance_status': c['sharia']['status'],
                   'sharia_reason': c['sharia']['reason'], 'score_100': c['score_100'], 'eliminators_failed': c['eliminators_failed'],
                   'missing_proofs': c['missing_proofs'],
                   'eligible_for_watch_pool': c['grade'] == 'A',
                   'note': ('Grade A : surveillance seulement, jamais un ordre.' if c['grade'] == 'A' else
                            'Conformité inconnue mais dossier rejeté sur preuves (éliminatoires échoués) : ne va pas en surveillance.')})
review = {
    'reference_close': S['reference_close'], 'reviewed_at': now, 'pm_ran_at': S['pm_ran_at'], 'pm_status': S['pm_status'],
    'mandate': S['mandate'], 'funnel': funnel, 'limits': S['limits'], 'contrarian_note': S['contrarian_note'],
    'fortress_pool': S['fortress_pool'], 'watch': {}, 'watch_candidates': wc, 'excluded': S['excluded'],
    'step0_source': 'scanner/20261021/_final/fortress-step0.json',
}
json.dump(review, open(os.path.join(HERE, '..', 'fortress-review.json'), 'w'), indent=2, ensure_ascii=False)
print(json.dumps(funnel, ensure_ascii=False)); print('pool', review['fortress_pool'], 'watch_candidates', [(w['ticker'], w['grade'], w['eligible_for_watch_pool']) for w in wc]); print(len(review['excluded']), 'exclus')
