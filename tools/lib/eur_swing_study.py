"""Offline, deterministic EUR comparison. No orders and no future probability forecast.

The contemporaneous Islamic holdings define a survivorship-biased research universe,
not a historical investable universe. All periods below end at the captured close.
"""
import json, math, hashlib, pathlib, datetime
import numpy as np

BASE = None
SPEC = {
    'version': 1, 'reference_close': None, 'anchor': None,
    'horizon_sessions': 10, 'sensitivity_horizon': 5,
    'entry': 'open of first session of each disjoint local-calendar block',
    'exit': 'close of tenth held session; no intraperiod stop or profit target',
    'adjustment': 'OHLC multiplied by adjclose/close; theoretical dividend reinvestment',
    'roundtrip_friction': 0.002, 'friction_sensitivity': [0.001, 0.003],
    'tax_convention': 'current issuer purchase tax applied to every historical episode; not actual historical tax',
    'ranking': 'descending mean net return, among eligible current uptrend candidates; p*gain displayed alongside losses',
    'min_episodes': 30, 'bootstrap_replicates': 2000, 'bootstrap_block': 5, 'seed': 1729,
    'current_filters': {'sma_sessions': 200, 'median_20_turnover_min_eur': 5000000,
                        'extension_from_sma20_atr_min': -1.5, 'extension_from_sma20_atr_max': 2.0},
    'conditional_cohort': 'entry previous adjusted close above its SMA200; non-overlapping blocks, dependence addressed by block bootstrap',
    'limitations': ['current holdings selection and survivorship bias', 'no out-of-sample future calibration',
                   'ranking across many names creates selection bias', 'bootstrap intervals are pointwise, not simultaneous',
                   'no actual stop/target backtest', 'before personal taxation and dividend purification']
}

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def summarize(a, seed, ci=True):
    a=np.asarray(a,dtype=float); n=len(a)
    if not n: return {'n':0}
    win=a>0; p=float(win.mean()); gain=float(a[win].mean()) if win.any() else 0.
    loss=float(-a[~win].mean()) if (~win).any() else 0.
    result={'n':n,'win_frequency':p,'mean_gain':gain,'mean_loss':loss,
            'p_times_gain':p*gain,'loss_contribution':(1-p)*loss,'mean_net':float(a.mean()),
            'median_net':float(np.median(a)), 'q10':float(np.quantile(a,.1)),
            'worst_decile_mean':float(np.sort(a)[:max(1,math.ceil(n*.1))].mean())}
    assert abs(result['mean_net']-(p*gain-(1-p)*loss))<1e-12
    if ci:
        rng=np.random.default_rng(seed); block=min(SPEC['bootstrap_block'],n)
        starts=rng.integers(0,n,size=(SPEC['bootstrap_replicates'],math.ceil(n/block)))
        ix=((starts[:,:,None]+np.arange(block))%n).reshape(len(starts),-1)[:,:n]
        samples=a[ix]
        result['mean_ci95']=[float(v) for v in np.quantile(samples.mean(axis=1),[.025,.975])]
        result['frequency_ci95']=[float(v) for v in np.quantile((samples>0).mean(axis=1),[.025,.975])]
    return result

def analyze(row, tax):
    symbol=row['yahoo_symbol']; file=BASE/(symbol+'.json')
    raw=json.loads(file.read_text()); r=raw['chart']['result'][0]; meta=r['meta']; q=r['indicators']['quote'][0]
    dates=[datetime.datetime.fromtimestamp(t,datetime.timezone.utc).date().isoformat() for t in r['timestamp']]
    valid=[i for i,d in enumerate(dates) if SPEC['anchor']<=d<=SPEC['reference_close']]
    assert all(all(q[k][i] is not None and math.isfinite(q[k][i]) and q[k][i]>0 for k in ('open','high','low','close'))
               and r['indicators']['adjclose'][0]['adjclose'][i] is not None
               and math.isfinite(r['indicators']['adjclose'][0]['adjclose'][i])
               for i in valid),'missing_or_invalid_session; do not compress the calendar'
    assert meta['currency']=='EUR' and meta['symbol']==symbol
    assert valid and dates[valid[-1]]==SPEC['reference_close']
    ds=[dates[i] for i in valid]; assert ds==sorted(set(ds))
    close=np.array([q['close'][i] for i in valid]); op=np.array([q['open'][i] for i in valid]);
    hi=np.array([q['high'][i] for i in valid]); lo=np.array([q['low'][i] for i in valid]);
    adj=np.array([r['indicators']['adjclose'][0]['adjclose'][i] for i in valid]); factor=adj/close
    assert np.all(lo<=np.minimum(op,close)+.0001) and np.all(hi>=np.maximum(op,close)-.0001), 'inconsistent_historical_ohlc'
    assert np.all(hi>=lo) and np.all(factor>0)
    ao=op*factor; ah=hi*factor; al=lo*factor
    sma=np.full(len(adj),np.nan); sma[199:]=np.convolve(adj,np.ones(200)/200,'valid')
    cost=tax+SPEC['roundtrip_friction']
    def episodes(h=10, offset=0):
        out=[]
        for i in range(offset,len(ds)-h+1,h):
            j=i+h-1
            gross=float(adj[j]/ao[i]-1)
            out.append({'entry_date':ds[i],'exit_date':ds[j], 'gross':gross,'net':gross-cost,
                        'prior_uptrend':bool(i>=200 and adj[i-1]>sma[i-1]),
                        'mae':float(al[i:j+1].min()/ao[i]-1)})
        return out
    eps=episodes(); current_up=bool(adj[-1]>sma[-1])
    # No retuning: only uptrend cohort used for the eligible long-only ranking.
    cohort=[e for e in eps if e['prior_uptrend']]
    tr=np.maximum(ah[1:]-al[1:],np.maximum(abs(ah[1:]-adj[:-1]),abs(al[1:]-adj[:-1])))
    atr=float(tr[:14].mean())
    for v in tr[14:]: atr=(atr*13+v)/14
    atr/=factor[-1]
    s20=float(adj[-20:].mean()/factor[-1]); extension=(close[-1]-s20)/atr
    vol=np.array([q['volume'][i] or 0 for i in valid],dtype=float)
    turnover=float(np.median(vol[-20:]*close[-20:]))
    seed=SPEC['seed']+int(hashlib.sha256(symbol.encode()).hexdigest()[:8],16)
    stats=summarize([e['net'] for e in cohort],seed)
    offsets=[]
    for off in range(10):
        a=[e['net'] for e in episodes(offset=off) if e['prior_uptrend']]
        offsets.append({'offset':off,**summarize(a,seed,False)})
    f=SPEC['current_filters']; reasons=[]
    if len(cohort)<SPEC['min_episodes']: reasons.append('insufficient_uptrend_episodes')
    if not current_up: reasons.append('below_sma200')
    if turnover<f['median_20_turnover_min_eur']: reasons.append('turnover_below_threshold')
    if not f['extension_from_sma20_atr_min']<=extension<=f['extension_from_sma20_atr_max']: reasons.append('outside_pullback_band')
    if ('preferred' in row.get('share_class_review','').lower() and not row.get('ordinary_class_confirmed',False)
        and 'no_preferred_flag' not in row.get('share_class_review','')) or 'PREF' in row.get('issueName','') or ' PRF ' in row.get('issueName',''):
        reasons.append('preferred_share_class_requires_separate_review')
    if stats.get('mean_net',-1)<=0: reasons.append('nonpositive_historical_mean')
    return {**row,'source_sha256':digest(file),'observations':len(ds), 'first_date':ds[0], 'last_date':ds[-1],
            'close':float(close[-1]),'change_1d':float(adj[-1]/adj[-2]-1),'return_20d':float(adj[-1]/adj[-21]-1),
            'sma20':s20,'sma50':float(adj[-50:].mean()/factor[-1]),'sma200':float(sma[-1]/factor[-1]),
            'atr14':atr,'extension20_atr':float(extension),'median20_turnover_eur':turnover,
            'prior10_low':float(lo[-10:].min()),'prior10_high':float(hi[-10:].max()),
            'latest_low':float(lo[-1]),'latest_high':float(hi[-1]),
            'tax_rate':tax,'total_cost_assumption':cost,'current_uptrend':current_up,'forward_win_probability':None,'study_type':'historical_conditional_baseline',
            'eligible':not reasons,'rejection_reasons':reasons,'conditional':stats,
            'unconditional':summarize([e['net'] for e in eps],seed),
            'recent_2y':summarize([e['net'] for e in cohort if e['entry_date']>=(datetime.date.fromisoformat(SPEC['reference_close'])-datetime.timedelta(days=731)).isoformat()],seed),
            'earlier':summarize([e['net'] for e in cohort if e['entry_date']<(datetime.date.fromisoformat(SPEC['reference_close'])-datetime.timedelta(days=731)).isoformat()],seed),
            'five_sessions':summarize([e['net'] for e in episodes(5) if e['prior_uptrend']],seed),
            'offset_sensitivity':offsets,
            'cost_sensitivity':[{'roundtrip_friction':c,'mean_net':stats.get('mean_net',0)+SPEC['roundtrip_friction']-c} for c in SPEC['friction_sensitivity']],
            'episodes':eps}

def main(base, reference_close, anchor, taxes_file=None):
    global BASE
    BASE = pathlib.Path(base).resolve()
    SPEC['reference_close'] = reference_close
    SPEC['anchor'] = anchor
    universe=json.loads((BASE/'universe-resolved.json').read_text()); rows=universe['rows']
    taxpath=pathlib.Path(taxes_file) if taxes_file else BASE/'taxes'/'mapping.json'
    taxes=json.loads(taxpath.read_text())
    assert taxes.get('reference_date')==reference_close, 'tax mapping reference date missing or mismatched'
    assert taxes.get('scope'), 'tax mapping scope/assumptions missing'
    results=[]; excluded=[]
    for row in rows:
        symbol=row.get('yahoo_symbol')
        try:
            if not symbol: raise ValueError('unresolved_listing_identity')
            if symbol not in taxes['by_symbol']: raise ValueError('tax_not_verified')
            tax=taxes['by_symbol'][symbol]
            assert isinstance(tax.get('rate'),(int,float)) and math.isfinite(tax['rate']) and 0<=tax['rate']<=.1,'invalid_tax_rate'
            assert tax.get('basis') and tax.get('status'),'tax_basis_or_status_missing'
            results.append(analyze(row,tax['rate']))
        except Exception as exc: excluded.append({'name':row.get('name',row.get('issueName')), 'symbol':symbol,'reason':str(exc) or type(exc).__name__})
    eligible=sorted([r for r in results if r['eligible']],key=lambda r:(-r['conditional']['mean_net'],r['yahoo_symbol']))
    result={'schema_version':'eur-swing-study.v1','spec':SPEC,'algorithm_sha256':digest(pathlib.Path(__file__)),
            'universe_sha256':digest(BASE/'universe-resolved.json'),'tax_mapping_sha256':digest(taxpath),
            'universe_count':len(rows),'analyzed_count':len(results),'eligible_count':len(eligible),
            'ranking':[r['yahoo_symbol'] for r in eligible], 'results':results,'excluded':excluded}
    (BASE/'study.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    if not results: raise ValueError('No analyzable securities; exclusions retained in study.json')
    print(json.dumps({'universe':len(rows),'analyzed':len(results),'excluded':excluded,'ranking':[
        {'symbol':r['yahoo_symbol'],'country':r.get('country'),'close':r['close'],'n':r['conditional']['n'],
         'p':r['conditional']['win_frequency'],'pxgain':r['conditional']['p_times_gain'],'mean':r['conditional']['mean_net'],
         'ci':r['conditional']['mean_ci95'],'extension':r['extension20_atr']} for r in eligible]},ensure_ascii=False,indent=2))
