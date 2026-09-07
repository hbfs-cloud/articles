"""Offline invariants for the recurring EUR research calculation (no network)."""
import datetime,importlib.util,json,pathlib,tempfile,unittest
MODULE=pathlib.Path(__file__).resolve().parents[1]/'lib'/'eur_swing_study.py'
spec=importlib.util.spec_from_file_location('eur_swing',MODULE)
eur=importlib.util.module_from_spec(spec);spec.loader.exec_module(eur)

class EurStudyTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.base=pathlib.Path(self.tmp.name);eur.BASE=self.base
        start=datetime.datetime(2020,1,1,tzinfo=datetime.timezone.utc)
        days=[start+datetime.timedelta(days=i) for i in range(1200)]
        days=[d for d in days if d.weekday()<5]
        close=[100+i*.1 for i in range(len(days))]
        self.raw={'chart':{'result':[{'meta':{'symbol':'TEST.DE','currency':'EUR'},'timestamp':[int(d.timestamp()) for d in days],
            'indicators':{'quote':[{'open':[v-.02 for v in close],'high':[v+.5 for v in close],
                'low':[v-.5 for v in close],'close':close,'volume':[100000]*len(close)}],
                'adjclose':[{'adjclose':close}]}}]}}
        self.row={'yahoo_symbol':'TEST.DE','ticker':'TEST','issueName':'Test ordinary equity','isin':'DE0000000001',
                  'country':'Germany','share_class_review':'provider_name_no_preferred_flag'}
        eur.SPEC['anchor']=days[0].date().isoformat();eur.SPEC['reference_close']=days[-1].date().isoformat()
        self.save()
    def tearDown(self):self.tmp.cleanup()
    def save(self):(self.base/'TEST.DE.json').write_text(json.dumps(self.raw))
    def test_expectation_counts_losses_and_zero(self):
        a=eur.summarize([.1,-.2,0],17)
        self.assertAlmostEqual(a['mean_net'],-.1/3)
        self.assertAlmostEqual(a['mean_net'],a['p_times_gain']-a['loss_contribution'])
        self.assertEqual(a,eur.summarize([.1,-.2,0],17))
    def test_ten_sessions_and_no_lookahead(self):
        r=eur.analyze(self.row,.004);eps=r['episodes'];raw=self.raw['chart']['result'][0]
        close=raw['indicators']['quote'][0]['close'];op=raw['indicators']['quote'][0]['open']
        self.assertAlmostEqual(eps[0]['gross'],close[9]/op[0]-1)
        self.assertAlmostEqual(eps[0]['net'],eps[0]['gross']-.006)
        self.assertFalse(eps[19]['prior_uptrend']);self.assertTrue(eps[20]['prior_uptrend'])
        for a,b in zip(eps,eps[1:]):self.assertLess(a['exit_date'],b['entry_date'])
        self.assertIsNone(r['forward_win_probability'])
    def test_missing_bar_does_not_compress_calendar(self):
        self.raw['chart']['result'][0]['indicators']['quote'][0]['open'][220]=None;self.save()
        with self.assertRaisesRegex(AssertionError,'compress'):eur.analyze(self.row,0)
    def test_inconsistent_range_is_rejected(self):
        self.raw['chart']['result'][0]['indicators']['quote'][0]['low'][-1]=999;self.save()
        with self.assertRaisesRegex(AssertionError,'inconsistent'):eur.analyze(self.row,0)
    def test_explicit_class_review_overrides_uninformative_name(self):
        self.row['share_class_review']='preferred_requires_separate_review'
        r=eur.analyze(self.row,0)
        self.assertFalse(r['eligible']);self.assertIn('preferred_share_class_requires_separate_review',r['rejection_reasons'])
    def test_wrong_currency_is_rejected(self):
        self.raw['chart']['result'][0]['meta']['currency']='USD';self.save()
        with self.assertRaises(AssertionError):eur.analyze(self.row,0)

if __name__=='__main__':unittest.main()
