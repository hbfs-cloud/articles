#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILING_DATES = require('./lib/sec-filing-dates-2026.json');
const ASOF = '2026-08-27';
const SEC_ASOF = '2026-08-28';
const REFRESHED = new Date().toISOString();

const PLANS = {
  OKTA:{v:'Validated only on a pullback',lo:142,hi:144.38,s:130.82,sp:-9.39,t1:174.85,u1:21.11,r:2.25,c:'Test $142-$145, then reclaim $146 and VWAP',x:'15-minute close below $140; hard stop $130.82',q:76},
  AMZN:{v:'Watch; initial plan rejected',lo:254,hi:258,s:246.20,sp:-4.57,t1:276.39,u1:7.13,r:1.56,c:'Break $259.66, then hold the retest',x:'Below $246.20',q:64},
  TSM:{v:'Watch; target remains too distant',lo:423,hi:429,s:408.09,sp:-4.87,t1:465.73,u1:8.56,r:1.76,c:'Break $429.64 and hold VWAP',x:'Below $408.09',q:64},
  AMRZ:{v:'Wait for a new base',lo:43.94,hi:44.20,s:42.70,sp:-3.39,t1:46.38,u1:4.93,t2:47.42,r:1.45,r2:2.15,c:'Hold the pullback, reclaim $45.06; ideally $46.25',x:'Below $42.70',q:53},
  FSLR:{v:'Wait; trend is damaged',lo:208.42,hi:209.68,s:199.54,sp:-4.84,t1:224.68,u1:7.15,t2:232.08,r:1.48,r2:2.21,c:'Reclaim $213.20 and VWAP',x:'Below $199.54',q:48},
  GEN:{v:'Wait; stop sits inside normal noise',lo:30.53,hi:30.74,s:29.74,sp:-3.25,t1:32.17,u1:4.65,t2:32.85,r:1.43,r2:2.11,c:'Break $30.74, then hold a $30.50 retest',x:'Below $29.74',q:51},
  DINO:{v:'Wait for a new pivot',lo:97.10,hi:97.78,s:93.92,sp:-3.95,t1:103.58,u1:5.93,t2:106.20,r:1.50,r2:2.18,c:'Break above $98.44',x:'Below $93.92',q:53},
  CNC:{v:'Wait; insider flow is negative',lo:64.90,hi:65.70,s:61.96,sp:-5.69,t1:72.06,u1:9.68,r:1.70,c:'Reclaim $66.21 and VWAP',x:'Below $61.96',q:49},
  ARWR:{v:'Wait for regular-session confirmation',lo:88,hi:89.20,s:83.68,sp:-6.19,t1:98.40,u1:10.31,r:1.67,c:'Break $89.59 with confirmed volume',x:'Below $83.68',q:54},
  BHVN:{v:'Speculative; first target does not pay enough',lo:14.34,hi:14.34,s:12.60,sp:-12.13,t1:16.74,u1:16.70,t2:17.28,r:1.38,r2:1.69,c:'15-minute reversal around $14.20-$14.50',x:'Below $12.60',q:38},
  DHT:{v:'Wait; first resistance is too close',lo:19.20,hi:19.55,s:18.23,sp:-6.75,t1:21.60,u1:10.49,r:1.55,c:'Break $19.565, then hold the retest',x:'Below $18.23',q:53},
  ELVN:{v:'Wait; flows conflict',lo:60.20,hi:60.80,s:57.05,sp:-6.17,t1:67.39,u1:10.84,r:1.76,c:'Break above $61.80',x:'Below $57.05',q:52},
  IBKR:{v:'Rejected at current levels',lo:96.65,hi:97.32,s:94.12,sp:-3.29,t1:101.81,u1:4.61,t2:104.07,r:1.40,r2:2.11,c:'Break $97.34, then hold the retest',x:'Below $94.12; conventional financial business',q:36},
  CRWD:{v:'Wait for post-earnings digestion',lo:207.58,hi:207.58,s:180.79,sp:-12.90,t1:229.08,u1:10.36,r:0.80,c:'Pull back to $203-$208, then reclaim $208',x:'Below $180.79',q:45},
  VG:{v:'Rejected; stop sits inside normal noise',lo:14.49,hi:14.60,s:13.90,sp:-4.79,t1:15.66,u1:7.26,t2:16.17,r:1.51,r2:2.24,c:'Break above $14.73',x:'Below $13.90',q:39},
  NBTX:{v:'Rejected',lo:40.49,hi:40.49,s:35.87,sp:-11.41,t1:45.74,u1:12.96,r:1.14,c:'Pull back, then reclaim $40.50',x:'Below $35.87',q:31}
};
const TRIGGERS = {OKTA:146,AMZN:259.66,TSM:429.64,AMRZ:45.06,FSLR:213.20,GEN:30.74,DINO:98.44,CNC:66.21,ARWR:89.59,BHVN:14.50,DHT:19.565,ELVN:61.80,IBKR:97.34,CRWD:208,VG:14.73,NBTX:40.50};
const VERSIONS = {AMZN:3,TSM:3,IBKR:2};
const PRESENTATION = {
  OKTA:{grade:'B-',score:70,state:'missed'}, AMZN:{grade:'B',score:74,state:'watch'},
  TSM:{grade:'B+',score:82,state:'watch'}, AMRZ:{grade:'C',score:49,state:'rejected'},
  FSLR:{grade:'C+',score:58,state:'wait'}, GEN:{grade:'C',score:50,state:'wait'},
  DINO:{grade:'C+',score:59,state:'wait'}, CNC:{grade:'C-',score:43,state:'wait'},
  ARWR:{grade:'C+',score:58,state:'wait'}, BHVN:{grade:'D+',score:38,state:'speculative'},
  DHT:{grade:'C+',score:58,state:'wait'}, ELVN:{grade:'C+',score:58,state:'wait'},
  IBKR:{grade:'B+',score:78,state:'rejected'}, CRWD:{grade:'B-',score:68,state:'missed'},
  VG:{grade:'C-',score:44,state:'rejected'}, NBTX:{grade:'C-',score:45,state:'missed'}
};

const SEC_REVIEWS = {
  OKTA:{cik:'1660134',dilution:'low',capital:'Convertibles were repaid in cash. Okta repurchased 4.57M shares for $366M and retained $555M of authorization, but $231M of first-half stock compensation exceeded $190M of net income.',filings:[['10-Q','0001660134-26-000069','Confirms cash redemption of the 2026 notes, repurchases and material stock compensation.'],['10-K','0001660134-26-000020','Provides the full capital structure and cyber-risk history.']],risks:['Buybacks partly offset continuing stock-based compensation rather than creating pure per-share accretion.','Longer sales cycles can weaken RPO conversion; the 2022-2023 security incidents remain a reputational overhang.']},
  AMZN:{cik:'1018724',dilution:'moderate',capital:'The 2026 prospectus supplements fund debt, not a conventional equity raise. Globalstar consideration may nevertheless issue roughly 24.8M-41.3M Amazon shares; first-half stock compensation was $10.1B.',filings:[['10-Q','0001018724-26-000026','Shows trailing free cash flow of negative $7.6B after the infrastructure build and large lease commitments.'],['S-4/A','0001104659-26-096195','Documents the Globalstar transaction and its stock component.'],['424B5','0001104659-26-081786','Debt prospectus; it must not be mislabeled as an equity offering.']],risks:['The AI build has changed the financial regime: $169B of net capital spending and major future lease and purchase commitments.','Reported profit includes non-operating investment gains; TP1 still offers weak reward/risk at confirmation.']},
  TSM:{cik:'1046179',dilution:'low',capital:'No 2026 equity offering was identified. Liquidity was NT$3.13T, while first-half property, plant and equipment additions reached NT$962B and Arizona guarantees were drawn.',filings:[['20-F','0001628280-26-025362','Establishes customer, Taiwan and foreign-fab concentration; no 2026 424B5 exists.'],['6-K','0001628280-26-000451','Updates second-quarter results and capital expenditure.']],risks:['Two customers represented 36% of 2025 revenue and about 80% of non-current assets remained in Taiwan.','Overseas fabs structurally dilute margins; geopolitics and earthquakes are non-diversifiable operating risks.']},
  AMRZ:{cik:'2035989',dilution:'low',capital:'Share repurchases and a falling share count imply low dilution, but leverage is material: $5.27B of notes, $735M of commercial paper and first-half interest expense of $150M.',filings:[['10-Q','0002035989-26-000067','Confirms negative first-half free cash flow, leverage and an unremediated material control weakness.'],['10-K','0002035989-26-000017','Frames the post-spin accounting, goodwill and separation risks.']],risks:['Internal control remains ineffective for lack of sufficient US-GAAP expertise; the CFO has changed.','$9.04B of goodwill and historical allocated costs make post-spin comparability and autonomous cash generation uncertain.']},
  FSLR:{cik:'1274494',dilution:'low',capital:'No 2026 equity offering was identified. The 10-Q reports 107.47M shares and only $37.6M of principal debt, so financing dilution is low.',filings:[['10-Q','0001274494-26-000170','Quantifies Series 7 warranty exposure and the balance sheet.'],['8-K','0001274494-26-000169','Provides the latest operating update.']],risks:['Series 7 defects carry an estimated $40M-$65M loss range.','Backlog economics depend on 45X credits and can be reopened; tellurium supply and factory impairment remain material.']},
  GEN:{cik:'849399',dilution:'moderate',capital:'No ATM or equity offering was identified, but 12M MoneyLion CVRs may settle as $276M of shares and $524M of unrecognized stock compensation remains.',filings:[['10-Q','0000849399-26-000031','Documents the CVRs, stock compensation, debt and consumer-finance exposure.'],['8-K','0000849399-26-000028','Updates results and restructuring.']],risks:['Debt of $8.23B and goodwill of $10.94B dwarf $2.66B of equity.','MoneyLion adds regulatory and credit risk; springing maturities and restructuring reduce financial flexibility.']},
  DINO:{cik:'1915657',dilution:'low',capital:'Capital returns are strongly anti-dilutive: 4.02M shares were repurchased in the first half, another 2.375M in August, and a new $1.5B authorization was approved.',filings:[['10-Q','0001915657-26-000057','Separates recurring operations from reserve releases, RIN sales and renewables impairment.'],['8-K','0001628280-26-059117','Documents the latest capital-allocation and operating update.']],risks:['Profit growth was flattered by a $642M lower-of-cost-or-market reserve release and $239M of RIN sales.','Refining remains cyclical; renewables impairment, Mississauga closure and a possible Lubricants separation add execution risk.']},
  CNC:{cik:'1071739',dilution:'moderate',capital:'Financing dilution is low, but employee issuance was net dilutive: about 3.1M shares issued versus 0.9M repurchased in the first half; $1.8B of buyback authority remained.',filings:[['10-Q','0001071739-26-000153','Shows reserve sensitivity, employee issuance and unusual working-capital presentation.'],['8-K','0001071739-26-000165','Updates regulatory and corporate events.']],risks:['IBNR reserves of $12.9B and a $481M risk-adjustment benefit make earnings quality sensitive to estimates.','$970M of receivable sales in operating cash flow, exit charges and CMS/securities litigation weaken comparability.']},
  ARWR:{cik:'879407',dilution:'high',capital:'A $500M ATM remains relevant after $76.1M of gross issuance. January financing raised $230M and included pre-funded warrants; $700M of 0% convertible notes mature in 2032.',filings:[['10-Q','0000879407-26-000057','Confirms $1.60B of liquidity, ATM usage and commercial/clinical spending.'],['424B5','0001193125-26-007968','Documents the January equity and pre-funded-warrant financing.'],['S-3ASR','0001193125-25-314755','Establishes the shelf and ATM capacity.']],risks:['REDEMPLO launch execution, sNDA timing and SHASTA/YOSEMITE trial outcomes remain binary.','Liquidity covers at least twelve months, but the filing does not justify an invented multi-year runway.']},
  BHVN:{cik:'1935979',dilution:'high',capital:'The ATM issued 17.16M shares for $178.9M net in the first half and still had $350M available. Liquidity was $267.9M versus $235.0M of first-half operating cash burn.',filings:[['10-Q','0001935979-26-000066','Quantifies burn, ATM issuance and the $250M secured debt.'],['8-K','0001935979-26-000072','Describes the conditional SK transaction; proceeds are not cash until closing.'],['424B5','0001628280-26-029924','Documents the active ATM capacity.']],risks:['The SK consideration is conditional and cannot be included in current liquidity before closing.','RISE 3 and taldefgrobep readouts are binary; secured debt includes royalty claims and potentially costly repayment premiums.']},
  DHT:{cik:'169858',dilution:'low',capital:'The shelf permits future securities but proves neither an active ATM nor live warrants. At June 30 DHT had $161.7M cash, $434.8M debt and $273.1M net debt across 23 VLCCs.',filings:[['20-F','0001140361-26-010407','Provides audited fleet, capital and cyclical risk disclosure.'],['F-3ASR','0001140361-26-010426','Authorizes future securities but is not evidence of current dilution.'],['6-K','0000950157-26-000847','Updates Q2 fleet, debt and dividend figures.']],risks:['The $1.22 Q2 dividend distributes ordinary net income and is cyclical and discretionary, not bond-like.','VLCC rate normalization, vessel values, sanctions/shadow-fleet exposure, drydocks and debt can reverse cash returns quickly.']},
  ELVN:{cik:'1981287',dilution:'high',capital:'The June offering raised $460M gross through 10.53M shares and 1.73M warrants. A $200M ATM remains available, 4.585M pre-funded warrants are outstanding and authorized shares doubled to 200M.',filings:[['10-Q','0001193125-26-335155','Reports $895.2M liquidity and management runway guidance through 2030.'],['424B5','0001193125-26-269621','Documents the June equity and warrant financing.'],['S-3ASR','0001193125-25-179946','Establishes shelf and ATM capacity.']],risks:['The thesis is now concentrated on Phase 1 ELVN-001; ELVN-002 is no longer developed.','A strong cash runway lowers near-term financing risk but does not remove clinical concentration or the existing warrant overhang.']},
  IBKR:{cik:'1381197',dilution:'moderate',capital:'The July exchange issued 2.50M shares, about 0.55%, without cash proceeds while acquiring matching IBG LLC interests. It is not classic economic dilution, but it expands float and can create selling pressure.',filings:[['10-Q','0001381197-26-000147','Reports accounts, customer equity, DARTs, net interest income and ownership structure.'],['424B5','0001381197-26-000133','Documents the recurring UP-C exchange.'],['424B5','0001381197-26-000138','Registers employee promotional shares.']],risks:['Public shareholders own only 26.5% of IBG LLC and IBKR remits 85% of exchange-related tax savings to Holdings.','Rate sensitivity, customer leverage and recurring exchanges matter more than an invalid cash-versus-debt comparison for a broker.']},
  CRWD:{cik:'1535527',dilution:'moderate',capital:'Quarterly stock compensation was $376.9M, or $399.0M with related payroll taxes, and unrecognized SBC was about $2.88B. This is material economic dilution despite strong free cash flow.',filings:[['8-K','0001535527-26-000029','Reports revenue of $1.47B, ARR of $5.84B and net-new ARR of $332.8M.'],['10-Q','0001535527-26-000031','Shows the GAAP/non-GAAP gap, SBC, ARR policy and regulatory inquiries.']],risks:['GAAP operating loss was $33.2M versus $371.6M of non-GAAP operating profit.','SEC/DOJ information requests concern revenue recognition and ARR reporting; ARR can retain expired contracts while renewal is negotiated.']},
  VG:{cik:'2007855',dilution:'moderate',capital:'The economic share count includes about 531.5M Class A and 1.969B Class B shares. At $14.51 that implies roughly $36.3B of equity value, not the Class-A-only $7.7B figure.',filings:[['10-Q','0002007855-26-000062','Reports $42.39B gross debt, $3.12B cash and CP2 capital spending.'],['424B4','0001193125-25-012218','Documents the IPO, dual-class economics and 97.8% voting control.'],['S-1','0001193125-24-282957','Discloses historical customer concentration.']],risks:['BP seeks $3.7B to more than $6B after an adverse partial ruling; other customer claims exceed $2.4B.','CP2 is highly levered and capital intensive; dual-class control and historic customer concentration leave public holders with limited influence.']},
  NBTX:{cik:'1760854',dilution:'high',capital:'The 2026 offering raised EUR85M gross through 2.185M shares and 345,099 pre-funded warrants, about 5% immediate dilution. A $200M shelf and 5.624M JJDC resale shares are also registered.',filings:[['424B5','0001140361-26-022604','Final terms for the equity and pre-funded-warrant offering.'],['F-3','0001140361-25-007433','Establishes the $200M shelf and JJDC resale registration.']],risks:['Year-end cash was EUR52.8M, not dollars; the disclosed standalone runway was only through early 2028 before the offering.','The company remains largely dependent on JNJ-1900/Janssen and had another 4.985M potential shares under equity instruments.']}
};

// Corrections from the final filing-level review.
SEC_REVIEWS.GEN.filings[1] = ['8-K','0000849399-26-000014','Documents the restructuring program and its expected charges.'];
SEC_REVIEWS.CNC.filings[1][2] = 'Updates the CFO transition and reaffirmed guidance.';
SEC_REVIEWS.CNC.risks[1] = '$970M of receivable sales in operating cash flow, $315M-$365M of 2026 severance and CMS/securities litigation weaken comparability.';
SEC_REVIEWS.AMZN.filings.push(['8-K','0001104659-26-021050','Discloses a potential OpenAI commitment of up to $50B.']);
SEC_REVIEWS.AMZN.risks[0] = 'The AI build has changed the financial regime: $169B of net capital spending, major lease and purchase commitments, and a potential $50B OpenAI commitment.';
SEC_REVIEWS.ARWR.filings.push(['424B5','0001193125-26-007962','Documents the $700M 0% convertible notes due 2032.']);
SEC_REVIEWS.DHT.capital += ' A new $250M facility matures in 2033 at SOFR plus 135 basis points; its $250M accordion is uncommitted.';
SEC_REVIEWS.DHT.filings.push(['6-K','0000950157-26-000711','Documents the June $250M revolving facility.'],['6-K','0000950157-26-000813','Updates the July fleet renewal.']);
SEC_REVIEWS.IBKR.filings[2][2] = 'Registers shares used in customer-acquisition and loyalty promotions.';
SEC_REVIEWS.IBKR.filings[0][2] = 'Reports 5.185M accounts, $930.3B customer equity, 4.824M DARTs, $673M commissions and $1.06B net interest income.';
SEC_REVIEWS.CRWD.filings[0][2] = 'Reports $1.47B revenue, $5.84B ARR, $332.8M net-new ARR, $10.7B RPO and $5.01B cash.';
SEC_REVIEWS.CRWD.risks[1] = 'SEC/DOJ requests concern revenue and ARR reporting; ARR can retain expired contracts during renewal, and a prior SBC error reduced reported first-half FY26 loss by $13.465M.';

const appendFilingInventory = (ticker, filings) => {
  const seen = new Set(SEC_REVIEWS[ticker].filings.map(x=>x[1]));
  filings.forEach(x=>{ if(!seen.has(x[1])) SEC_REVIEWS[ticker].filings.push(x); });
};
appendFilingInventory('OKTA', [
  ['8-K','0001660134-26-000003','Material-event filing reviewed in the 2026 inventory.'],['8-K','0001660134-26-000016','Results and corporate-event filing reviewed.'],
  ['8-K','0001660134-26-000024','Material-event filing reviewed.'],['8-K','0001660134-26-000029','Material-event filing reviewed.'],
  ['8-K','0001193125-26-170498','Material-event filing reviewed.'],['8-K','0001660134-26-000050','Quarterly-results filing reviewed.'],
  ['8-K','0001660134-26-000054','Material-event filing reviewed.'],['8-K','0001660134-26-000068','Post-earnings filing reviewed.']
]);
appendFilingInventory('AMZN', [
  ['10-K','0001018724-26-000004','Annual filing reviewed for the full capital and commitment baseline.'],
  ['S-3ASR','0001104659-26-011240','Automatic shelf registration reviewed.'],
  ['424B5','0001104659-26-025560','Debt prospectus supplement reviewed; not an equity offering.'],['424B5','0001104659-26-026082','Debt prospectus supplement reviewed; not an equity offering.'],
  ['424B5','0001104659-26-027125','Debt prospectus supplement reviewed; not an equity offering.'],['424B5','0001104659-26-027669','Debt prospectus supplement reviewed; not an equity offering.'],
  ['424B5','0001104659-26-071190','Debt prospectus supplement reviewed; not an equity offering.'],['424B5','0001104659-26-072332','Debt prospectus supplement reviewed; not an equity offering.'],
  ['424B5','0001104659-26-080950','Debt prospectus supplement reviewed; not an equity offering.'],['S-4','0001104659-26-089294','Globalstar transaction registration reviewed.'],
  ['EFFECT','9999999995-26-002695','Effectiveness notice for the transaction registration reviewed.']
  ,['8-K','0001018724-26-000002','Annual-results filing reviewed.'],['8-K','0001104659-26-027729','Debt issuance event reviewed.'],
  ['8-K','0001104659-26-028556','Debt issuance event reviewed.'],['8-K','0001104659-26-042880','Material-event filing reviewed.'],
  ['8-K','0001018724-26-000012','Quarterly-results filing reviewed.'],['8-K','0001104659-26-072140','Debt issuance event reviewed.'],
  ['8-K','0001104659-26-073562','Debt issuance event reviewed.'],['8-K','0001104659-26-082293','Debt issuance event reviewed.'],
  ['8-K','0001018724-26-000024','Quarterly-results filing reviewed.']
]);
appendFilingInventory('TSM', [
  ['6-K','0001628280-26-000008','January results filing reviewed.'],['6-K','0001628280-26-000024','February financial filing reviewed.'],
  ['6-K','0001628280-26-000199','April results filing reviewed.'],['6-K','0001628280-26-000201','April financial statements reviewed.'],
  ['6-K','0001628280-26-000278','May operating filing reviewed.'],['6-K','0001628280-26-000541','August operating filing reviewed.'],
  ['6-K','0001628280-26-000076','Material-event filing reviewed.'],['6-K','0001628280-26-000215','Material-event filing reviewed.'],
  ['6-K','0001628280-26-000280','Material-event filing reviewed.'],['6-K','0001628280-26-000539','Material-event filing reviewed.']
  ,['6-K','0001046179-26-000005','January monthly revenue filing reviewed.'],['6-K','0001046179-26-000015','February monthly revenue filing reviewed.'],
  ['6-K','0001046179-26-000031','March monthly revenue filing reviewed.'],['6-K','0001046179-26-000136','April monthly revenue filing reviewed.'],
  ['6-K','0001046179-26-000213','May monthly revenue filing reviewed.'],['6-K','0001046179-26-000367','June monthly revenue filing reviewed.'],
  ['6-K','0001046179-26-000447','July monthly revenue filing reviewed.'],['6-K','0001046179-26-000471','August monthly revenue filing reviewed.']
]);
appendFilingInventory('AMRZ', [
  ['8-K','0002035989-26-000004','Material-event filing reviewed.'],['8-K','0002035989-26-000008','Material-event filing reviewed.'],
  ['8-K','0001140361-26-004899','Material-event filing reviewed.'],['8-K','0002035989-26-000012','Material-event filing reviewed.'],
  ['8-K','0002035989-26-000020','Material-event filing reviewed.'],['8-K','0001140361-26-012350','Material-event filing reviewed.'],
  ['8-K','0002035989-26-000040','Material-event filing reviewed.'],['8-K','0002035989-26-000043','Material-event filing reviewed.'],
  ['8-K','0002035989-26-000050','Quarterly-results filing reviewed.'],['8-K','0002035989-26-000064','Quarterly-results filing reviewed.'],
  ['8-K','0001140361-26-034208','Material-event filing reviewed.']
]);
SEC_REVIEWS.TSM.filings = SEC_REVIEWS.TSM.filings.map(x => x[0] === '6-K'
  ? [x[0],x[1].replace('0001628280-','0001046179-'),x[2]]
  : x);

const BUSINESS_OVERRIDES = {
  ARWR:'Arrowhead commercializes REDEMPLO (plozasiran) and is building the launch while pursuing label expansion and the SHASTA and YOSEMITE programs. Commercial execution now matters alongside clinical outcomes.',
  DHT:'DHT owns and operates 23 very large crude carriers after the Bauhinia sale and Impala delivery. Earnings, vessel values and its dividend remain directly exposed to the VLCC rate cycle.',
  ELVN:'Enliven is now concentrated on ELVN-001, a Phase 1 program. ELVN-002 is no longer in development, so the investment case has become a single-program clinical thesis.'
};

const CAPITAL_OVERRIDES = {
  ARWR:{atm:{active:true,authorized:'$500M program',used:'$76.1M gross through nine months',remaining:'Verify the latest 10-Q before entry'},warrants:[{series:'January 2026',type:'Pre-funded',shares:'1.550M',note:'Issued in the 2026 financing'},{series:'Legacy',type:'Outstanding warrants',shares:'917,441',note:'Legacy overhang disclosed in the 10-Q'}],convertibles:[{amount:'$700M at 0%',conversionPrice:'$87.07 initial',maturity:'2032'}]},
  BHVN:{atm:{active:true,authorized:'Program disclosed in the 424B5',used:'$178.9M net in the first half',remaining:'$350M'}},
  ELVN:{atm:{active:true,authorized:'$200M',used:'Not stated in this review',remaining:'$200M disclosed as available'},warrants:[{series:'Pre-funded',type:'Outstanding warrants',shares:'4.585M',note:'Aggregate outstanding pre-funded warrants'}]}
};

const BALANCE_OVERRIDES = {
  DHT:{cash:161700000,debt:434800000},
  CRWD:{cash:5010000000},
  VG:{cash:3120000000,debt:42386000000}
};

const num = v => v === null || v === undefined || v === '' ? null : Number.isFinite(+v) ? +v : null;
const secUrl = (cik, accession) => {
  const issuerCik = ({169858:'1331284',1981287:'1672619'})[cik] || cik;
  return `https://www.sec.gov/Archives/edgar/data/${issuerCik}/${accession.replace(/-/g,'')}/`;
};
const positive = (...values) => values.map(num).find(v => v !== null && v > 0) ?? null;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const px = v => num(v) === null ? 'N/A' : '$'+num(v).toFixed(2);
const money = v => {
  v=num(v); if(v===null)return 'N/A'; const a=Math.abs(v);
  if(a>=1e12)return '$'+(v/1e12).toFixed(2)+'T';
  if(a>=1e9)return '$'+(v/1e9).toFixed(2)+'B';
  if(a>=1e6)return '$'+(v/1e6).toFixed(1)+'M';
  return '$'+v.toLocaleString('en-US',{maximumFractionDigits:0});
};
const qty = v => {
  v=num(v); if(v===null)return 'N/A';
  if(Math.abs(v)>=1e9)return (v/1e9).toFixed(2)+'B';
  if(Math.abs(v)>=1e6)return (v/1e6).toFixed(1)+'M';
  return v.toLocaleString('en-US',{maximumFractionDigits:0});
};
const pct = (v,scale=100) => num(v)===null?'N/A':(num(v)*scale).toFixed(1)+'%';
const load = f => { try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return {};} };
const at = (a,t) => a.find(x=>x&&x.type===t)||{};
const qresults = (t,f) => {
  const j=load(path.join(ROOT,'analyses',t,'_data',f));
  return j.data?.items?.flatMap(x=>x.results||[])||j.results||[];
};
const qtype = (t,f,k) => {
  const r=qresults(t,f).find(x=>x.data_type===k);
  return Array.isArray(r?.data)?r.data:[];
};
const csv = lines => {
  if(!Array.isArray(lines)||lines.length<2||typeof lines[0]!=='string')return [];
  const h=lines[0].split(',');
  return lines.slice(1).map(s=>Object.fromEntries(h.map((k,i)=>[k,String(s).split(',')[i]])));
};
const refs = t => [
  {name:'Company filings — SEC EDGAR',url:`https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(t)}`,date:ASOF},
  {name:'Market and company data',url:`https://finance.yahoo.com/quote/${encodeURIComponent(t)}/`,date:ASOF}
];
const grade = s => s>=72?'B+':s>=62?'B':s>=52?'C+':s>=42?'C':s>=32?'D+':'D';
const levels = (lines,fallback) => {
  const a=csv(lines).map(x=>num(x.price)).filter(x=>x!==null);
  return (a.length?a:fallback).slice(0,3);
};
const bars = t => (qtype(t,'bars.json','bars_daily')[0]?.bars||[])
  .map(r=>({date:r[0],close:num(r[4])})).filter(x=>x.close!==null);
const perf = (b,days) => {
  if(b.length<2)return null;
  const end=b.at(-1), cut=new Date(end.date+'T00:00:00Z').getTime()-days*86400000;
  const start=b.find(x=>new Date(x.date+'T00:00:00Z').getTime()>=cut)||b[0];
  return start.close?(end.close/start.close-1)*100:null;
};
const ytdPerf = b => {
  if(b.length<2)return null;
  const year=String(b.at(-1).date).slice(0,4), prior=b.filter(x=>String(x.date)<`${year}-01-01`).at(-1);
  if(!prior)return null;
  return prior.close?(b.at(-1).close/prior.close-1)*100:null;
};
const news = (t,name) => {
  const raw=qtype(t,'sentiment.json','news').flat(3).filter(x=>x&&x.title);
  const keys=[t.toLowerCase(),String(name).toLowerCase().split(/\s+/)[0]];
  return raw.filter(x=>keys.some(k=>k.length>2&&x.title.toLowerCase().includes(k))).slice(0,6).map(x=>({
    date:String(x.publishedAt||ASOF).slice(0,10),title:x.title,source:x.source||'Market news',
    sourceUrl:x.url,impact:/surge|beat|record|raise|growth|higher|upgrade/i.test(x.title)?'positive':/fall|drop|cut|risk|lower|miss|downgrade/i.test(x.title)?'negative':'neutral',
    detail:/surge|beat|record|raise|growth|higher|upgrade/i.test(x.title)?'Potentially supportive for expectations; verify the magnitude in the primary release before acting.':/fall|drop|cut|risk|lower|miss|downgrade/i.test(x.title)?'Potential downside risk; the headline alone does not quantify the impact.':'Context only; no trade conclusion is drawn from this headline.'
  }));
};
const catalystText = x => {
  if(typeof x === 'string') return x;
  if(!x || typeof x !== 'object') return null;
  return x.detail || x.description || x.headline || x.title || x.reason ||
    x.catalyst?.detail || x.catalyst?.description || x.catalyst?.headline || null;
};
const countWord=(n,word)=>`${n||0} ${word}${Number(n)===1?'':'s'}`;

function build(t,p){
  const a=load(path.join(ROOT,'analyses',t,'_data','instrument.json')).data?.items||[];
  if(!a.length)throw new Error(t+': instrument bundle missing');
  const md=at(a,'instrument_metadata'), qt=at(a,'instrument_quote'), pr=at(a,'instrument_comprehensive_profile');
  const fn=at(a,'instrument_comprehensive_financial'), st=at(a,'instrument_comprehensive_stats');
  const ho=at(a,'instrument_comprehensive_holders'), te=at(a,'instrument_technicals');
  const sr=at(a,'instrument_support_resistance'), sh=at(a,'instrument_shariah_compliance');
  const ins=at(a,'instrument_insider_transactions'), si=at(a,'instrument_short_interest');
  const mp=at(a,'instrument_max_pain'), ov=at(a,'instrument_options_volume_ratio');
  const so=at(a,'instrument_sentiment_overall'), sw=at(a,'instrument_sentiment_stocktwits');
  const dp=at(a,'instrument_dark_pool'), fl=at(a,'instrument_flags'), cal=at(a,'instrument_calendar');
  const er=a.filter(x=>x.type==='instrument_comprehensive_earnings_quarterly');
  const b=bars(t), price=num(qt.price)??b.at(-1)?.close, entry=(p.lo+p.hi)/2;
  const trigger=TRIGGERS[t], triggerRr=(p.t1-trigger)/(trigger-p.s);
  const fmoney=v=>t==='TSM'?`TWD ${money(v).replace('$','')}`:t==='NBTX'?`EUR ${money(v).replace('$','')}`:money(v);
  const valuation=load(path.join(ROOT,'analyses',t,'_data','valuation.json'));
  const board=load(path.join(ROOT,'analyses',t,'_data','quality-board.json'));
  const high=price>p.hi*1.03, low=price<p.s, presentation=PRESENTATION[t], secReview=SEC_REVIEWS[t];
  const tradeState=presentation.state, score=presentation.score;
  const sec=(a.filter(x=>x.type==='instrument_sec_filing').map(x=>x.content||'').join('\n')+'\n'+JSON.stringify(qtype(t,'dilution.json','sec_filings'))).toLowerCase();
  const atm=/at.the.market|atm offering|open market sale agreement/.test(sec), warrant=/warrant/.test(sec);
  const small=(qt.marketCap||Infinity)<5e9, dil=secReview.dilution;
  const sip=positive(si.percentOfFloat)??positive(st.shortPercentOfFloat), effectiveSip=t==='VG'?null:sip;
  const move=load(path.join(ROOT,'analyses',t,'_data','move.json'));
  const baseRisk=Math.round(4+(dil==='high'?2:dil==='moderate'||dil==='unknown'?1:0)+((st.beta||0)>1.5?1:0)+((effectiveSip||0)>.1?1:0)+(ins.net_activity==='bearish'?1:0));
  const risk=clamp(Math.max(baseRisk,num(move.risk_score)!==null?Math.ceil(num(move.risk_score)/10):0),2,9);
  const e50=positive(te.ema50,qt.fiftyDayAverage), e200=positive(te.ema200,qt.twoHundredDayAvg);
  const e20=positive(te.ema20)??entry, recent=csv(ins.recent_trades).slice(0,8);
  const filingRefs=secReview.filings.map(([form,accession])=>({name:`${form} — ${accession}`,url:secUrl(secReview.cik,accession),date:FILING_DATES[accession]}));
  const missingFilingDates=secReview.filings.filter(([,accession])=>!FILING_DATES[accession]);
  if(missingFilingDates.length) throw new Error(`${t}: missing official filing dates for ${missingFilingDates.map(x=>x[1]).join(', ')}`);
  const r=[...filingRefs,...refs(t).slice(1)];
  const status=tradeState==='missed'?`The original entry is no longer available at ${px(price)}. Do not chase; rebuild the setup after a new base.`:tradeState==='rejected'?`Rejected at current levels. A new analysis is required before any entry.`:tradeState==='speculative'?`Speculative watch only. Confirmation remains mandatory: ${p.c}.`:`${tradeState==='watch'?'Watchlist':'Wait state'}: ${p.c}.`;
  const companyKey=String(md.shortName||md.name||t).toLowerCase().split(/\s+/)[0];
  const catalysts=(move.catalysts||[]).filter(x=>{
    if(!x || typeof x!=='object' || x.kind!=='news') return true;
    const hay=`${x.headline||''} ${x.detail||''}`.toLowerCase();
    return hay.includes(t.toLowerCase()) || (companyKey.length>2 && hay.includes(companyKey));
  }).map(x=>{
    if(x?.kind==='risk' && x.headline==='short_squeeze_pressure') return 'Crowded-positioning pressure is flagged, but it is not an entry trigger.';
    if(x?.kind==='risk' && x.headline==='high_ctb') return 'Borrow pressure is flagged as elevated; the exact cost-to-borrow rate is unavailable.';
    if(x?.kind==='filing') return null;
    return catalystText(x);
  }).filter(Boolean).slice(0,3);
  [p.c,`Analyst mean target: ${px(fn.targetMeanPrice)}`,`Next earnings: ${cal.nextEarningsDate||'not confirmed'}`].forEach(x=>{if(catalysts.length<3)catalysts.push(x);});
  const rr2=p.r2??(p.t2?(p.t2-entry)/(entry-p.s):null);
  const siScale=sip!==null&&sip>1?1:100;
  const balance=BALANCE_OVERRIDES[t]||{}, reportedCash=balance.cash??fn.totalCash, reportedDebt=balance.debt??fn.totalDebt;
  const businessOverview=BUSINESS_OVERRIDES[t]||pr.longBusinessSummary||(md.name||t)+' operates in '+(pr.industry||pr.sector||'its reported market')+'.';
  const structuredCapital=CAPITAL_OVERRIDES[t]||{};
  const siDisplay=effectiveSip===null?'N/A — float basis requires reconciliation':pct(effectiveSip,siScale);

  return {
    meta:{lang:'en',dir:'ltr',level:'intermediate',assetType:'stock',tags:['us','equities','trade-idea',String(pr.sector||'stocks').toLowerCase().replace(/[^a-z0-9]+/g,'-')],grade:presentation.grade,date:'2026-08-28',dateDisplay:'August 28, 2026',version:VERSIONS[t]||1,status:'active',lastMcpRefresh:REFRESHED,description:`${t}: ${p.v}. Fresh review of fundamentals, capital structure, technicals and trade levels.`,ogDescription:`${t}: verdict, risks, confirmation, invalidation and current trade levels.`},
    header:{ticker:t,name:md.shortName||md.name||t,exchange:md.exchange||'US',sector:pr.sector||'Unclassified',price,changePct:(num(qt.changePercent)||0)*100,badges:[{text:p.v,color:tradeState==='watch'?'blue':tradeState==='missed'||tradeState==='rejected'?'red':'amber'},{text:pr.industry||pr.sector||'Equity',color:'blue'}],metrics:{marketCap:t==='VG'?'$36.3B economic (A+B)':money(qt.marketCap),volume:qty(qt.volume),fwdPE:positive(qt.forwardPE)===null?'N/A':positive(qt.forwardPE).toFixed(1)+'x',beta:num(st.beta)||0,range52w:positive(qt.fiftyTwoWeekLow)&&positive(qt.fiftyTwoWeekHigh)?`${px(qt.fiftyTwoWeekLow)} – ${px(qt.fiftyTwoWeekHigh)}`:'N/A',shortInterest:t==='VG'?'N/A — float basis disputed':pct(sip,siScale),analystTarget:px(fn.targetMeanPrice),evEbitda:t==='TSM'||t==='CRWD'||positive(st.enterpriseToEbitda)===null?'N/A':positive(st.enterpriseToEbitda).toFixed(1)+'x'},halal:sh.status==='compliant',halalStatus:sh.status==='compliant'?'halal':sh.status==='non-compliant'?'non-halal':'unknown'},
    verdict:{score,conviction:score>=70?'High':score>=60?'Moderate':'Low',bias:tradeState==='watch'?'Bullish':'Neutral',confidence:'Moderate confidence',summary:`${businessOverview.split('. ').slice(0,2).join('. ')}. ${p.v}. ${status}`,whyBuy:[`Revenue growth: ${pct(fn.revenueGrowth)}; earnings growth: ${pct(fn.earningsGrowth)}`,t==='IBKR'||t==='CNC'?'Balance-sheet totals require sector-specific interpretation; see the SEC review.':`Cash ${fmoney(reportedCash)} versus debt ${fmoney(reportedDebt)}`,`Defined confirmation: ${p.c}`],whyAvoid:[status,`First-target reward/risk at confirmation: ${triggerRr.toFixed(2)}R`,secReview.risks[0]]},
    business:{overview:`<p>${businessOverview}</p>`,moat:`The trade assumes no moat beyond the reported economics in ${pr.industry||'the company industry'}.`,theme:pr.industry||pr.sector||'Equity'},
    news:news(t,md.shortName||md.name||t),
    fundamentals:{rows:[
      {metric:'Revenue (TTM)',value:fmoney(fn.totalRevenue),signal:pct(fn.revenueGrowth)+' YoY',signalColor:(fn.revenueGrowth||0)>=0?'green':'red'},
      {metric:'EBITDA',value:positive(fn.ebitda)===null?'N/A':fmoney(fn.ebitda),signal:t==='TSM'?'ADR and statement units are not compared':positive(fn.ebitda)===null||positive(st.enterpriseToEbitda)===null?'Not meaningful / unavailable':positive(st.enterpriseToEbitda).toFixed(1)+'x EV/EBITDA',signalColor:'blue'},
      {metric:'Gross Margin',value:pct(fn.grossMargins),signal:'Reported',signalColor:'blue'},
      {metric:'Operating Margin',value:num(fn.totalRevenue)>0?pct(fn.operatingMargins):'N/A',signal:num(fn.totalRevenue)>0?((fn.operatingMargins||0)>0?'Profitable':'Loss-making'):'Not meaningful without revenue',signalColor:num(fn.totalRevenue)>0&&fn.operatingMargins>0?'green':'red'},
      {metric:'Net Margin',value:num(fn.totalRevenue)>0?pct(fn.profitMargins):'N/A',signal:num(fn.totalRevenue)>0?((fn.profitMargins||0)>0?'Positive':'Negative'):'Not meaningful without revenue',signalColor:num(fn.totalRevenue)>0&&fn.profitMargins>0?'green':'red'},
      {metric:'ROE',value:pct(fn.returnOnEquity),signal:'Capital efficiency',signalColor:(fn.returnOnEquity||0)>=.12?'green':'amber'},
      {metric:'Cash',value:fmoney(reportedCash),signal:t==='IBKR'||t==='CNC'?'Sector balance sheet; do not net mechanically':'Liquidity',signalColor:'green'},
      {metric:'Debt',value:fmoney(reportedDebt),signal:t==='IBKR'||t==='CNC'?'Sector balance sheet; do not net mechanically':'Balance-sheet claim',signalColor:(reportedDebt||0)>(reportedCash||0)?'amber':'green'},
      {metric:'Forward P/E',value:positive(qt.forwardPE)===null?'N/A':positive(qt.forwardPE).toFixed(1)+'x',signal:'No estimate substituted',signalColor:'gray'},
      {metric:'Intrinsic-value model',value:num(valuation.modelValue)===null?'N/A':money(valuation.modelValue),signal:num(valuation.modelValue)===null?'Fail-closed: insufficient inputs':`${valuation.signal||'neutral'} / confidence ${valuation.confidence||0}`,signalColor:valuation.signal==='bullish'?'green':valuation.signal==='bearish'?'red':'gray'},
      {metric:'Value / quality panel',value:`${board.tally?.bullish||0} positive / ${board.tally?.bearish||0} negative / ${board.tally?.neutral||0} neutral`,signal:`${board.signal||'neutral'} / confidence ${board.confidence||0}`,signalColor:board.signal==='bullish'?'green':board.signal==='bearish'?'red':'gray'},
      {metric:'Analyst Mean Target',value:px(fn.targetMeanPrice),signal:'Consensus, not a guarantee',signalColor:'blue'}
    ],sourceRefs:r},
    earnings:{quarters:er.slice(0,4).map(x=>({quarter:String(x.date).slice(0,10),epsActual:num(x.actual)||0,epsEstimate:num(x.estimate)||0,surprise:num(x.actual)!==null&&num(x.estimate)?(((num(x.actual)-num(x.estimate))/Math.abs(num(x.estimate)))*100).toFixed(1)+'%':'N/A'})),beatStreak:er.filter(x=>num(x.actual)!==null&&num(x.estimate)!==null&&num(x.actual)>num(x.estimate)).length,beatNote:`${er.filter(x=>num(x.actual)>num(x.estimate)).length}/${er.length} captured quarters beat estimates`,nextEarnings:cal.nextEarningsDate||'Not confirmed'},
    insiders:{insiderPct:pct(ho.insidersPercent,1),institutionPct:pct(ho.institutionsPercent,1),recentTransactions:recent.map(x=>({date:x.date,insider:x.insider,type:/purchase|buy/i.test(x.type)?'buy':/sale|sell/i.test(x.type)?'sell':'grant',shares:qty(x.shares),value:num(x.shares)!==null&&num(x.price)!==null?money(num(x.shares)*num(x.price)):'N/A'})),signal:recent.length?`${ins.net_activity||'neutral'} aggregate feed — ${countWord(ins.buys_count,'buy')} and ${countWord(ins.sells_count,'sale')}`:'No structured transaction table was captured; aggregate counts are not used.',sourceRefs:r},
    capitalStructure:{sharesOutstanding:t==='VG'?`${qty(st.sharesOutstanding)} Class A only`:qty(st.sharesOutstanding),sharesAuthorized:'See filing review',dilutionRisk:dil,...(structuredCapital.atm?{atm:structuredCapital.atm}:{}),...(structuredCapital.warrants?{warrants:structuredCapital.warrants}:{}),...(structuredCapital.convertibles?{convertibles:structuredCapital.convertibles}:{}),shareHistory:secReview.capital,sourceRefs:filingRefs},
    filingsReview:{summary:`Official filings were reviewed through ${SEC_ASOF}; the table lists the decision-relevant documents rather than every routine filing. The ${presentation.grade} grade describes the full dossier; the trade state (${tradeState}) is a separate timing decision.`,filings:secReview.filings.map(([form,accession,finding])=>({date:FILING_DATES[accession],form,accession,finding,url:secUrl(secReview.cik,accession)})),contrarianRisks:secReview.risks},
    shortInterest:{siPct:siDisplay,daysToCover:effectiveSip===null?'N/A':num(si.daysToCover)!==null?num(si.daysToCover).toFixed(2):num(st.shortRatio)!==null?num(st.shortRatio).toFixed(2):'N/A',ctb:effectiveSip===null?'N/A':positive(si.costToBorrow)===null?'N/A':pct(si.costToBorrow,si.costToBorrow>1?1:100),trend:effectiveSip===null?'The Class A float denominator must be reconciled before publishing short-interest percentages.':'Current snapshot only; no acceleration claim without a comparable historical series.',squeezeScore:effectiveSip===null?'Not scored':num(move.squeeze_score)>=70?'Elevated':'Low to moderate',sourceRefs:r},
    options:{callOI:qty(mp.totalCallOI),putOI:qty(mp.totalPutOI),cpRatio:num(mp.callPutRatio)===null?'N/A':num(mp.callPutRatio).toFixed(2),maxPain:px(mp.maxPainStrike),ivMean:'N/A',skew:num(ov.put_call_volume_ratio)===null?'N/A':`Put/call volume ${num(ov.put_call_volume_ratio).toFixed(2)}`,unusual:ov.unusual_activity?'Unusual activity detected':'No unusual activity confirmed',sourceRefs:r},
    technicals:{rsi14:num(te.rsi)||50,...(num(te.macd)!==null?{macd:num(te.macd)}:{}),...(num(te.signal)!==null?{macdSignal:num(te.signal)}:{}),ema20:e20,ema50:e50??entry,ema200:e200??entry,ma50Type:positive(te.ema50)?'EMA':'SMA',ma200Type:positive(te.ema200)?'EMA':'SMA',ma50Available:e50!==null,ma200Available:e200!==null,atr14:num(te.atr)||Math.abs(entry-p.s),badges:[`RSI ${num(te.rsi)===null?'N/A':num(te.rsi).toFixed(1)}`,tradeState.toUpperCase(),p.v],supports:levels(sr.supports,[]).filter(v=>v<price),resistances:levels(sr.resistances,[]).filter(v=>v>price),setupNote:`${p.v}. Required confirmation: ${p.c}. ${e50!==null||e200!==null?'Available moving averages are shown with their provider type.':'The dataset has insufficient history for 50-day and 200-day averages; both remain unavailable.'}`,wyckoff:'Transitional',radarValues:{rsi:clamp(Math.round(100-Math.abs((te.rsi||50)-55)*2),0,100),trend:tradeState==='watch'?70:50,volume:clamp(Math.round((qt.volume||0)/1e6*15),10,100),momentum:high?80:55,volatility:clamp(Math.round((te.atr||0)/(price||1)*1000),10,100),support:tradeState==='watch'?70:50},sourceRefs:r},
    macro:{indicators:[{name:'Market regime',value:'Risk-on 0.79',signal:'Trend support, not a timing trigger'},{name:'VIX',value:'14.51',signal:'Low current protection price'}],regime:'risk-on',impact:'The broad regime supports long setups, but rates and ticker-specific confirmation override the label.',sourceRefs:[{name:'Systematic market regime snapshot',url:'/data/analyses-data/market-regime-20260827.json',date:ASOF}]},
    risks:{riskScore:risk,riskProfile:risk>=8?'High':risk>=5?'High':'Moderate',riskSummary:`Dilution: ${dil}; beta: ${num(st.beta)===null?'N/A':num(st.beta).toFixed(2)}; insider signal: ${ins.net_activity||'unavailable'}.`,riskCards:[
      {title:'Trade Structure',severity:triggerRr<1.5?'high':'medium',icon:'fa-chart-line',points:[`First-target reward/risk at confirmation: ${triggerRr.toFixed(2)}R`,status],probability:triggerRr<1.5?65:45,impact:70,verdict:p.c},
      {title:'Capital and Dilution',severity:dil==='high'?'high':dil==='moderate'?'medium':'low',icon:'fa-coins',points:[secReview.capital,...secReview.risks],probability:dil==='high'?70:dil==='moderate'?45:25,impact:dil==='high'?80:dil==='moderate'?55:35,verdict:`SEC review: ${dil} dilution risk. Filings and accessions are listed below.`},
      {title:'Positioning',severity:ins.net_activity==='bearish'?'medium':'low',icon:'fa-user-tie',points:[`${ins.buys_count||0} insider buys vs ${ins.sells_count||0} sells`,`Short interest: ${siDisplay}`],probability:50,impact:45,verdict:'Positioning is context, not a standalone trigger.'}
    ],pedagogy:'A precise stop does not make a setup valid. Entry location, normal volatility, event risk and reachable resistance decide whether the risk is paid.',riskRadarValues:{dilution:dil==='high'?85:dil==='moderate'?55:dil==='unknown'?60:25,burnRate:t==='BHVN'?90:(fn.profitMargins||0)<0?75:25,beta:clamp(Math.round((st.beta||1)*45),10,100),shortInterest:effectiveSip===null?0:clamp(Math.round((effectiveSip||0)*500),5,100),insiderSelling:ins.net_activity==='bearish'?75:30,macroRisk:45},sourceRefs:r},
    social:{platforms:[{platform:'Stocktwits',icon:'fa-solid fa-comments',mentions:String(sw.messageCount||'N/A'),trend:sw.sentimentLabel||'unavailable',trendColor:sw.sentimentLabel==='positive'?'green':sw.sentimentLabel==='negative'?'red':'gray',detail:`${sw.watchers||'N/A'} watchers; not used as a trigger.`},{platform:'Aggregate sentiment',icon:'fa-solid fa-satellite-dish',mentions:String(so.sourceCount||'N/A'),trend:so.sentimentLabel||'unavailable',trendColor:so.sentimentLabel==='positive'?'green':so.sentimentLabel==='negative'?'red':'gray',detail:`Confidence ${pct(so.confidence)}.`}],pumpDumpScore:clamp((small?2:0)+(fl.is_halted_recently?2:0)+(fl.is_top_ctb?1:0)+(dil==='high'?1:0)+((effectiveSip||0)>.2?2:0),0,6),pumpDumpChecklist:[{criterion:'No recent halt flag',pass:!fl.is_halted_recently},{criterion:effectiveSip===null?'Short interest withheld pending float reconciliation':'Short interest below 20%',pass:effectiveSip!==null&&(effectiveSip||0)<=.2},{criterion:`SEC-reviewed dilution risk is ${dil}`,pass:dil==='low'}],sourceRefs:r},
    performance:{ytd:num(ytdPerf(b))===null?'N/A — insufficient calendar-year history':ytdPerf(b).toFixed(1)+'%',oneYear:b.length<230?'N/A — insufficient one-year history':num(perf(b,365))===null?'N/A — insufficient history':perf(b,365).toFixed(1)+'%',threeYear:'N/A — insufficient point-in-time history',benchmarks:[],alpha:'Not calculated without aligned benchmark bars.',sourceRefs:r},
    capitalFlow:{netFlow:'N/A',institutionalFlow:'N/A',retailFlow:'N/A',darkPoolPct:num(dp.percentVolume)===null?'N/A':pct(dp.percentVolume,dp.percentVolume>1?1:100),signal:'No directional flow claim is made when detailed, aligned flow data is unavailable.',sourceRefs:r},
    tradeIdea:{entry,entryNote:`Original zone ${px(p.lo)}-${px(p.hi)}. ${p.c}. At the conservative ${px(trigger)} confirmation price, TP1 pays ${triggerRr.toFixed(2)}R.`,stop:p.s,stopPct:`${p.sp.toFixed(2)}% risk`,tp1:p.t1,tp1Pct:`${p.u1.toFixed(2)}% upside`,...(p.t2?{tp2:p.t2,tp2Pct:'Stretch target; use the stated TP2 reward/risk below.'}:{}),rr:`Confirmation TP1 1:${triggerRr.toFixed(2)}; original plan 1:${p.r.toFixed(2)}${num(rr2)!==null?` / TP2 1:${rr2.toFixed(2)}`:''}`,horizon:'10 trading sessions',thesis:tradeState==='rejected'||tradeState==='missed'?`${p.v}. ${status}`:`${p.v}. Monitor ${p.c.toLowerCase()}; no market order and no chase outside the zone.`,catalysts,invalidation:[p.x,status,'Any earnings, clinical, regulatory or financing event before entry requires a fresh review.'],status:tradeState,statusNote:status},
    globalScore:{profile:pr.sector||'Equity',keyTakeawaysPositive:[`Defined trigger: ${p.c}`,`Dilution assessment after filing review: ${dil}`,`Revenue growth: ${pct(fn.revenueGrowth)}`],keyTakeawaysNegative:[status,`First-target R/R at confirmation: ${triggerRr.toFixed(2)}R`,...secReview.risks],mindsetTip:'Wait for confirmation and preserve the invalidation.'},
    disclaimer:'Educational market analysis, not financial advice. Prices can gap and losses can exceed the planned stop.'
  };
}

for(const t of (process.argv.slice(2).map(x=>x.toUpperCase()).length?process.argv.slice(2).map(x=>x.toUpperCase()):Object.keys(PLANS))){
  if(!PLANS[t])throw new Error('Unknown plan: '+t);
  const data=build(t,PLANS[t]), out=path.join(ROOT,'data','analyses-data',t+'.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');
  console.log(`[analysis-data] ${t}: ${data.meta.grade} / ${data.verdict.score} — ${data.tradeIdea.status}`);
}
