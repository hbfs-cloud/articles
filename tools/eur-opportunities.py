#!/usr/bin/env python3
"""Collect, compare and audit EUR Islamic research universes. Never submits trades or publishes.

Supply a dated provider holdings export and a reviewed issuer-tax mapping. All inputs
and failures are retained; rates, company calendars and compliance are not guessed.
"""
import argparse,collections,concurrent.futures,datetime,hashlib,json,pathlib,sys,urllib.parse,urllib.request
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent/'lib'))
import eur_swing_study

EXCHANGES={
 'Euronext Amsterdam':('AS','AMS'), 'Xetra':('DE','GER'), 'Deutsche Boerse Xetra':('DE','GER'),
 'Nyse Euronext - Euronext Paris':('PA','PAR'), 'Bolsa De Madrid':('MC','MCE'),
 'Borsa Italiana':('MI','MIL'), 'Nyse Euronext - Euronext Brussels':('BR','BRU'),
 'Irish Stock Exchange - All Market':('IR','ISE'), 'Nasdaq Omx Helsinki Ltd.':('HE','HEL'),
 'Wiener Boerse Ag':('VI','VIE'), 'Nyse Euronext - Euronext Lisbon':('LS','LIS')}
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(pathlib.Path(p).read_text())
def write(p,x):pathlib.Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def day(t):return datetime.datetime.fromtimestamp(t,datetime.timezone.utc).date().isoformat()

def universe(args):
    raw=read(args.holdings); cols=raw['componentsByNameMap']['holdings']['containersByNameMap']['all']['dataPointsByNameMap']
    requested=datetime.date.fromisoformat(args.provider_date)
    assert requested<=datetime.datetime.now(datetime.timezone.utc).date(),'future provider date'
    assert requested.strftime('%Y%m%d')==str(cols['asOfDate']['value']),'provider date differs from raw holdings'
    values={k:v['value'] for k,v in cols.items() if isinstance(v,dict) and isinstance(v.get('value'),list)}
    rows=[]
    for i in range(len(values['assetClass'])):
        r={k:v[i] for k,v in values.items() if len(v)>i}
        if r.get('assetClass')!='Equity' or r.get('marketCurrencyCode')!='EUR':continue
        keys=['assetClass','marketCurrencyCode','ticker','isin','exchange','issueName','countryOfRisk','sectorName']
        r={k:r.get(k) for k in keys}; r['country']=r['countryOfRisk']; ex=EXCHANGES.get(r['exchange'])
        r['yahoo_symbol_candidate']=f"{r['ticker']}.{ex[0]}" if ex else None
        r['share_class_review']='preferred_requires_separate_review' if 'PREF' in r['issueName'] or ' PRF ' in r['issueName'] else 'provider_name_no_preferred_flag'
        rows.append(r)
    if not rows:raise ValueError('No EUR equity rows in provider export')
    if len({r['isin'] for r in rows})!=len(rows):raise ValueError('Duplicate ISIN: resolve listings before collection')
    out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
    write(out/'universe.json',{'as_of':args.provider_date,'captured_at':now(),'source_url':args.source_url,
       'raw_source_file':str(args.holdings),'raw_sha256':sha(args.holdings),'provider':'iShares MSCI World Islamic UCITS ETF',
       'universe_definition':'All EUR equity rows in dated provider holdings; not all EUR equities or point-in-time historical members',
       'count':len(rows),'country_counts':dict(collections.Counter(r['country'] for r in rows)),
       'exchange_counts':dict(collections.Counter(r['exchange'] for r in rows)),'rows':rows})
    print(f'Provider universe: {len(rows)} EUR equity lines')

def collect(args):
    out=pathlib.Path(args.out);u=read(out/'universe.json')
    if datetime.date.fromisoformat(args.refdate)>datetime.datetime.now(datetime.timezone.utc).date():raise ValueError('Future reference date')
    def one(r):
        sym=r.get('yahoo_symbol_candidate'); start=now()
        if not sym:return {'symbol':None,'isin':r['isin'],'ok':False,'error':'unmapped_listing','captured_at':start}
        url='https://query1.finance.yahoo.com/v8/finance/chart/'+urllib.parse.quote(sym,safe='')+'?range=5y&interval=1d&events=div%2Csplits&includeAdjustedClose=true'
        file=out/(sym+'.json')
        try:
            if file.exists():raise ValueError('raw_file_exists; use a fresh run directory to preserve snapshots')
            raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read()
            j=json.loads(raw)
            if j['chart']['error']:raise ValueError(str(j['chart']['error']))
            rj=j['chart']['result'][0];m=rj['meta'];file.write_bytes(raw)
            return {'symbol':sym,'url':url,'file':file.name,'captured_at':start,'sha256':sha(file),'ok':True,
                'name':m.get('longName',m.get('shortName')),'exchange':m.get('exchangeName'),'currency':m.get('currency'),
                'timezone':m.get('exchangeTimezoneName'),'last_day':day(rj['timestamp'][-1]),
                'quote_timestamp':m.get('regularMarketTime'),'session_end':m.get('currentTradingPeriod',{}).get('regular',{}).get('end')}
        except Exception as exc:return {'symbol':sym,'url':url,'captured_at':start,'ok':False,'error':str(exc)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:results=list(ex.map(one,u['rows']))
    write(out/'universe-collection.json',{'authorization':args.authorization,'reference_close':args.refdate,
       'universe_sha256':sha(out/'universe.json'),'sources':results})
    errors=[r for r in results if not r['ok']]
    print(json.dumps({'collected':len(results)-len(errors),'failures':errors},indent=2))
    if errors:raise ValueError('Collection incomplete; failed rows retained')

def validate(args):
    out=pathlib.Path(args.out);u=read(out/'universe.json');c=read(out/'universe-collection.json');rows=[]
    assert c['universe_sha256']==sha(out/'universe.json'),'universe changed since capture'
    assert c.get('authorization'),'external source authorization missing'
    assert datetime.date.fromisoformat(args.refdate)<=datetime.datetime.now(datetime.timezone.utc).date(),'future reference close'
    assert len(c['sources'])==len(u['rows'])==u['count'],'universe coverage mismatch'
    age=(datetime.date.fromisoformat(args.refdate)-datetime.date.fromisoformat(u['as_of'])).days
    assert 0<=age<=7,'provider holdings stale or future dated'
    for row in u['rows']:
        sym=row.get('yahoo_symbol_candidate');src=next(x for x in c['sources'] if x['symbol']==sym)
        assert src['ok'],src
        file=out/src['file'];assert sha(file)==src['sha256'],sym+' raw hash'
        r=read(file)['chart']['result'][0];m=r['meta']
        assert src['last_day']==day(r['timestamp'][-1]),sym+' journal/raw last date mismatch'
        assert src['quote_timestamp']==m['regularMarketTime'],sym+' journal/raw quote time mismatch'
        assert src['session_end']==m['currentTradingPeriod']['regular']['end'],sym+' journal/raw session mismatch'
        assert m['symbol']==sym and m['currency']=='EUR' and m['instrumentType']=='EQUITY',sym+' identity'
        assert m['exchangeName']==EXCHANGES[row['exchange']][1],sym+' venue'
        capture=datetime.datetime.fromisoformat(src['captured_at']).timestamp()
        assert capture<=datetime.datetime.now(datetime.timezone.utc).timestamp(),sym+' future capture'
        assert src['session_end']<capture and src['quote_timestamp']<=capture,sym+' main session not completed at capture'
        assert src['last_day']==args.refdate and day(src['quote_timestamp'])==args.refdate,sym+' stale close'
        assert abs(m['regularMarketPrice']-r['indicators']['quote'][0]['close'][-1])<.02,sym+' quote/close mismatch'
        assert row['isin'] and len(row['isin'])==12,sym+' provider ISIN'
        rows.append({**row,'yahoo_symbol':sym,'vendor_name':src['name'],'raw_sha256':src['sha256'],
           'identity_check':'symbol, venue, EUR, equity type checked; provider ISIN retained; issuer-name review remains editorial'})
    resolved={**u,'raw_universe_sha256':sha(out/'universe.json'),'collection_sha256':sha(out/'universe-collection.json'),'rows':rows}
    write(out/'universe-resolved.json',resolved)
    print(f'PASS: {len(rows)} EUR listings, completed vendor main-session close {args.refdate}; not MCP certification')

def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='command',required=True)
    u=sub.add_parser('universe');u.add_argument('--holdings',required=True);u.add_argument('--provider-date',required=True);u.add_argument('--source-url',required=True);u.add_argument('--out',required=True)
    c=sub.add_parser('collect');c.add_argument('--out',required=True);c.add_argument('--refdate',required=True);c.add_argument('--authorization',required=True)
    v=sub.add_parser('validate');v.add_argument('--out',required=True);v.add_argument('--refdate',required=True)
    s=sub.add_parser('study');s.add_argument('--out',required=True);s.add_argument('--refdate',required=True);s.add_argument('--anchor',required=True);s.add_argument('--taxes')
    args=p.parse_args()
    if args.command=='universe':universe(args)
    elif args.command=='collect':collect(args)
    elif args.command=='validate':validate(args)
    else:
        validate(args)
        eur_swing_study.main(args.out,args.refdate,args.anchor,args.taxes)
if __name__=='__main__':
    try:main()
    except (AssertionError,ValueError,KeyError,OSError) as e:
        print(f'FAIL: {e}',file=sys.stderr);sys.exit(1)
