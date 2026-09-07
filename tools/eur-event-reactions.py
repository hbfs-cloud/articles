#!/usr/bin/env python3
"""Recompute reviewed event windows on quote close, same basis as the EUR study."""
import argparse,datetime,hashlib,json,pathlib
p=argparse.ArgumentParser();p.add_argument('artifact');a=p.parse_args();f=pathlib.Path(a.artifact);data=json.loads(f.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def series(source):
    p=pathlib.Path(source['path']);assert sha(p)==source['sha256'],'source changed'
    r=json.loads(p.read_text())['chart']['result'][0];source['series']='quote.close; split-adjusted only'
    return {datetime.datetime.fromtimestamp(t,datetime.timezone.utc).date().isoformat():v for t,v in zip(r['timestamp'],r['indicators']['quote'][0]['close'])}
b=series(data['benchmark_source'])
for event in data['reactions']:
    s=series(event['source'])
    for o in event['observations']:
        start,end=o['prior_close'],o['end_close']
        o['stock_return']=s[end]/s[start]-1;o['benchmark_return']=b[end]/b[start]-1
        o['excess_return_percentage_points']=100*(o['stock_return']-o['benchmark_return'])
data['method']='Quote close, split-adjusted only for stock and price index. Reviewed event windows unchanged; descriptive co-movement, no causal attribution.'
data['computed_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();data['script_sha256']=sha(pathlib.Path(__file__))
f.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
