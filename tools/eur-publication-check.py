#!/usr/bin/env python3
"""Fail-closed local EUR publication check; never deploys or certifies brokerage/religion."""
import argparse,hashlib,json,pathlib,subprocess,sys,datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def check(article):
    base=article.parent;x=base/'_external';study=load(x/'study.json');review=load(base/'_review/reviews.json')
    h=sha(article);assert review['article_sha256']==h,'review HTML stale'
    assert review['status']=='ready_for_authorized_publication','reviews not ready'
    assert review['reference_close']==study['spec']['reference_close'],'review date stale'
    assert study['schema_version']=='eur-swing-study.v2','dividend-safe price study required'
    assert study['algorithm_sha256']==sha(ROOT/'tools/lib/eur_swing_study.py'),'study algorithm stale'
    assert study['tax_mapping_sha256']==sha(x/'taxes/mapping.json'),'tax mapping stale'
    for rel in ['_external/study.json','_external/dividends.json','_external/facts.json','_external/event-reactions.json','_external/harness.json','_external/_collect.json','_data/claims.json','_review/browser-current.json']:
        assert review['source_hashes'].get(rel)==sha(base/rel),'review source stale: '+rel
    for name in ['senior_halal','contrarian_retail','visual']:
        r=review['reviews'][name];assert r['status']=='PASS' and r['html_sha256']==h,'independent review missing/stale: '+name
        rawpath=base/r['artifact'];assert sha(rawpath)==r['artifact_sha256'],'independent report changed'
        raw=load(rawpath);assert raw.get('verdict',raw.get('status'))=='PASS' and raw.get('article_sha256',raw.get('html_sha256'))==h,'independent report not approved'
        for rel,digest in raw.get('source_hashes',{}).items():
            assert sha(base/rel)==digest,'independent source changed: '+rel
        for rel,digest in raw.get('screenshot_hashes',{}).items():
            assert sha(base/'_review'/rel)==digest,'reviewed screenshot changed: '+rel
        for source in raw.get('sources',[]):
            assert sha(ROOT/source['path'])==source['sha256'],'independent source changed: '+source['path']
    for src in load(x/'harness.json')['sources']:
        assert src['sha256']==sha(x/(src['name']+'.json')),'harness source stale: '+src['name']
    browser=load(base/'_review/browser-current.json')
    assert browser['html_sha256']==browser['html_sha256_after']==h,'browser stale'
    assert {r['width'] for r in browser['results']}=={390,768,1440},'viewport coverage missing'
    for r in browser['results']:
        assert not r['overflow'] and not r['errors'] and not r['brokenAnchors'] and not r['badHeadings'],'browser failure'
        assert r['tableScrollWorks'] and r['menuOpens'] and r['menuCloses'] and r['charts']>0,'interaction failure'
    ed=load(x/'edition.json');div=load(x/'dividends.json')
    assert set(ed['operational_priority_symbols'])<=set(div['actionable_symbols']),'priority lacks clear dividend calendar'
    assert ed['sources']['dividends']==str((x/'dividends.json').relative_to(ROOT)),'dividends not bound'
    html=article.read_text()
    for symbol in div['research_only_symbols']:
        assert symbol in html,'restricted ranked line omitted without explanation'
    assert 'dividendes' in html and 'purification' in html and 'cash' in html,'dividend/net scope absent'
    cmds=[['python3','tools/eur-dividend-gate.py','validate','--input',str((x/'dividends.json').relative_to(ROOT))],
          ['node','tools/validate-content-claims.js',str((base/'_data/claims.json').relative_to(ROOT))],
          ['node','tools/qa-content.js',str(article.relative_to(ROOT)),'--strict'],
          ['node','tools/validate-content-hierarchy.js',str(article.relative_to(ROOT))],
          ['node','tools/check-ai-tells.js',str(article.relative_to(ROOT))],
          ['python3','-m','unittest','discover','-s','tools/tests','-p','test_eur*.py']]
    checks=[]
    for cmd in cmds:
        r=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True)
        checks.append({'command':cmd,'exit_code':r.returncode,'output':r.stdout+r.stderr})
        if r.returncode:raise AssertionError('check failed: '+str(cmd)+'\n'+r.stdout+r.stderr)
    out={'schema_version':'eur-publication-check.v1','status':'PASS','checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'article_sha256':h,'review_sha256':sha(base/'_review/reviews.json'),'checker_sha256':sha(pathlib.Path(__file__)),
         'checks':checks,'scope':'Artifact, arithmetic, source, documented review and browser gates. No individual religious certification or trade-order approval.'}
    (base/'_review/publication-check.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print('PASS publication checks: '+h)
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('article',help='path to index.html');a=p.parse_args()
    try:check(pathlib.Path(a.article).resolve())
    except (AssertionError,KeyError,FileNotFoundError,ValueError) as exc:print('FAIL: '+str(exc),file=sys.stderr);sys.exit(1)
