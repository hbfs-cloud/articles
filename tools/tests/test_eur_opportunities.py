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

    def cash_event(self, index, amount, implied_amount=None):
        """Create a vendor event and its independently specified adjustment."""
        r=self.raw['chart']['result'][0]
        close=r['indicators']['quote'][0]['close']
        implied=amount if implied_amount is None else implied_amount
        factor=1-implied/close[index-1]
        r['indicators']['adjclose'][0]['adjclose']=[
            value*(factor if i<index else 1) for i,value in enumerate(close)]
        stamp=r['timestamp'][index]
        r['events']={'dividends':{str(stamp):{'date':stamp,'amount':amount}}}
        self.save()

    def test_cash_entitlement_boundaries_and_payment_after_exit(self):
        for ex_date,expected in [('2026-09-01',0),('2026-09-02',.05),
                                 ('2026-09-10',.05),('2026-09-11',0)]:
            with self.subTest(ex_date=ex_date):
                event={'ex_date':ex_date,'amount':5,'status':'reconciled',
                       'payment_date':'2026-09-30'}
                self.assertAlmostEqual(eur.entitlement('2026-09-01','2026-09-10',
                                                      [event],100),expected)
        uncertain={'ex_date':'2026-09-10','amount':None,'status':'unverifiable'}
        self.assertIsNone(eur.entitlement('2026-09-01','2026-09-10',[uncertain],100))
        # An unknown dividend detached before a new purchase creates no claim.
        self.assertEqual(eur.entitlement('2026-09-10','2026-09-20',[uncertain],100),0)

    def test_price_cash_and_adjusted_ratio_are_not_double_counted(self):
        r=self.raw['chart']['result'][0];q=r['indicators']['quote'][0]
        n=len(q['close']);close=[100. if i<225 else 97. for i in range(n)]
        q.update({'open':close[:],'close':close,'high':[v+.5 for v in close],
                  'low':[v-.5 for v in close]})
        self.cash_event(225,5.)
        episode=eur.analyze(self.row,.004)['episodes'][22]
        self.assertAlmostEqual(episode['gross'],-.03)
        self.assertAlmostEqual(episode['net'],-.036)
        self.assertAlmostEqual(episode['vendor_cash_claim_return'],.05)
        self.assertAlmostEqual(episode['vendor_gross_economic_return'],.02)
        self.assertAlmostEqual(episode['vendor_adjusted_ratio_return'],97/95-1)
        self.assertNotAlmostEqual(episode['vendor_gross_economic_return'],
                                  episode['vendor_adjusted_ratio_return'])
        self.assertIsNone(episode['personal_net_cash_return'])

    def test_already_split_adjusted_price_and_cash_are_scale_invariant(self):
        self.cash_event(225,4.)
        before=eur.analyze(self.row,0)
        r=self.raw['chart']['result'][0];q=r['indicators']['quote'][0]
        for key in ('open','high','low','close'):
            q[key]=[v/4 for v in q[key]]
        q['volume']=[v*4 for v in q['volume']]
        r['indicators']['adjclose'][0]['adjclose']=[
            v/4 for v in r['indicators']['adjclose'][0]['adjclose']]
        for event in r['events']['dividends'].values():event['amount']/=4
        # The metadata must not cause a second adjustment of normalized prices/cash.
        stamp=r['timestamp'][230]
        r['events']['splits']={str(stamp):{'date':stamp,'numerator':4.,
                                          'denominator':1.,'splitRatio':'4:1'}}
        self.save();after=eur.analyze(self.row,0)
        self.assertEqual(before['conditional'],after['conditional'])
        self.assertEqual(before['median20_turnover_eur'],after['median20_turnover_eur'])
        for first,second in zip(before['episodes'],after['episodes']):
            for key in ('gross','net','mae','vendor_cash_claim_return',
                        'vendor_gross_economic_return','vendor_adjusted_ratio_return'):
                self.assertAlmostEqual(first[key],second[key],msg=key)
        self.assertAlmostEqual(before['atr14']/4,after['atr14'])
        self.assertAlmostEqual(before['sma200']/4,after['sma200'])

    def test_technicals_preserve_the_actual_ex_dividend_price_gap(self):
        r=self.raw['chart']['result'][0];q=r['indicators']['quote'][0];n=len(q['close'])
        q.update({'open':[100.]*(n-1)+[95.],'close':[100.]*(n-1)+[95.],
                  'high':[100.5]*(n-1)+[95.],'low':[99.5]*(n-1)+[95.]})
        self.cash_event(n-1,5.)
        result=eur.analyze(self.row,0)
        for key,expected in [('change_1d',-.05),('return_20d',-.05),
                             ('sma20',99.75),('sma50',99.9),('sma200',99.975),
                             ('atr14',18/14),('prior10_low',95.),('prior10_high',100.5),
                             ('latest_low',95.),('latest_high',95.)]:
            self.assertAlmostEqual(result[key],expected,msg=key)
        self.assertAlmostEqual(result['gap_risk']['worst_open_gap'],-.05)
        self.assertFalse(result['current_uptrend'])

    def test_dividend_adjustments_do_not_change_price_cohort_or_ranking_inputs(self):
        before=eur.analyze(self.row,0)
        self.cash_event(225,5.)
        after=eur.analyze(self.row,0)
        for key in ('conditional','unconditional','five_sessions','offset_sensitivity',
                    'recent_2y','earlier','eligible','rejection_reasons','gap_risk',
                    'sma20','sma50','sma200','atr14','extension20_atr','prior10_low',
                    'prior10_high','return_20d','change_1d'):
            self.assertEqual(before[key],after[key],msg=key)
        self.assertEqual(len(before['episodes']),len(after['episodes']))
        for first,second in zip(before['episodes'],after['episodes']):
            for key in ('entry_date','exit_date','gross','net','prior_uptrend','mae'):
                self.assertEqual(first[key],second[key],msg=key)
        self.assertGreater(after['episodes'][22]['vendor_cash_claim_return'],0)

    def test_inconsistent_or_missing_cash_event_is_null_without_dropping_price_episode(self):
        baseline=eur.analyze(self.row,0)
        self.cash_event(225,.07740001,implied_amount=.09)
        inconsistent=eur.analyze(self.row,0)
        diagnostic=inconsistent['dividend_diagnostics']
        self.assertEqual(diagnostic['events'][0]['status'],
                         'amount_adjustment_inconsistency_or_unverifiable')
        self.assertEqual(diagnostic['unknown_cash_episodes'],1)
        self.assertIsNone(inconsistent['episodes'][22]['vendor_cash_claim_return'])
        self.assertIsNone(inconsistent['episodes'][22]['vendor_gross_economic_return'])
        self.assertEqual(inconsistent['conditional'],baseline['conditional'])
        self.assertEqual(len(inconsistent['episodes']),len(baseline['episodes']))
        # A factor jump with no listed distribution must not manufacture cash=0.
        self.raw['chart']['result'][0]['events']={};self.save()
        missing=eur.analyze(self.row,0)
        self.assertEqual(missing['dividend_diagnostics']['events'][0]['status'],
                         'unexplained_adjustment_change')
        self.assertIsNone(missing['episodes'][22]['vendor_cash_claim_return'])
        self.assertEqual(missing['conditional'],baseline['conditional'])

if __name__=='__main__':unittest.main()
