#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const DATE='2026-08-28', REFDATE='2026-08-27', REFRESHED=new Date().toISOString();

const GROUPS={
  leaders:'NVDA CRWD OKTA CRM',
  cyber:'FTNT TENB PANW ZS',
  software:'NOW SNOW DDOG ORCL MDB',
  hardware:'KLAC SNPS AMKR TTMI VICR AAOI ANET MRVL AVGO AMD SMCI MU DELL HPE INTC',
  infrastructure:'CRWV APLD NBIS WULF CIFR HUT CORZ IREN BE',
  power:'CEG VST GEV',
  crypto:'MSTR COIN MARA CLSK CAN SBET BMNR',
  metals:'CDE AG EQX',
  observed:'LPLA ALLR LUNR RZLV MRSH STRL',
  event:'S'
};
const ROLE={}; Object.entries(GROUPS).forEach(([g,s])=>s.split(' ').forEach(t=>ROLE[t]=g));
const COPY={
  leaders:{theme:'Direct post-earnings leader',thesis:'The direct earnings signal is real, but the first job is to test whether the gap can build a base instead of being chased.',bear:'A strong print can still be fully priced after a vertical reaction.'},
  cyber:{theme:'Cybersecurity follow-through',thesis:'This name tests whether CRWD and OKTA created a durable group move as AI agents expand identity and attack-surface demand.',bear:'Sympathy beta can fade even when the sector narrative remains correct.'},
  software:{theme:'Enterprise software diffusion',thesis:'This name tests whether CRM results translate into paid AI adoption and durable software demand beyond one relief rally.',bear:'AI language in a product deck is not proof of incremental revenue or margin.'},
  hardware:{theme:'AI hardware propagation',thesis:'This company is a read-through on whether AI spending broadens from Nvidia into design, networking, servers, packaging or components.',bear:'The economic link can be genuine while the chart, valuation or customer concentration makes the trade unattractive.'},
  infrastructure:{theme:'AI/HPC infrastructure beta',thesis:'This name bridges compute demand, data-center capacity and power. It should outperform only if contracted economics survive financing and execution risk.',bear:'High beta, funding needs and project execution can overwhelm the AI narrative.'},
  power:{theme:'Second-order power confirmation',thesis:'This company tests whether the AI buildout is becoming a durable electricity and grid-capex cycle.',bear:'Power demand can be real while regulation, commodity exposure or valuation blocks equity upside.'},
  crypto:{theme:'Crypto equity high beta',thesis:'This equity tests whether spot crypto strength is spreading into operating leverage, transaction activity or treasury premiums.',bear:'Dilution, power costs and balance-sheet leverage can make the equity underperform the underlying crypto asset.'},
  metals:{theme:'Precious-metals equity beta',thesis:'This miner tests whether hard-asset strength is translating into equity cash flow rather than remaining a spot-metal move.',bear:'Operational costs, jurisdiction and correlated factor exposure can erase the metal-price benefit.'},
  observed:{theme:'Article observation list',thesis:'This name was explicitly flagged as data-insufficient in the original article. The new dossier replaces that provisional label with current fundamentals, filings and closed-bar geometry.',bear:'Being named in the article creates no economic link to the AI earnings chain and no automatic setup.'},
  event:{theme:'Cyber event-risk read-through',thesis:'This name was identified as a cyber read-through but must be judged on its own post-event structure and filings.',bear:'A group rally does not cancel company-specific earnings and execution risk.'}
};
const EVENT_FACTS={
  NVDA:{summary:'Q2 FY27 revenue was $96.2B (+106% YoY), including $89.0B of Data Center revenue (+117%). Non-GAAP diluted EPS was $2.22; GAAP EPS was $2.46. Q3 revenue guidance is $108.0B +/-2% and assumes no China Data Center compute revenue.',metrics:['Revenue $96.2B (+106% YoY)','Data Center $89.0B (+117% YoY)','GAAP / non-GAAP EPS $2.46 / $2.22','Q3 guide $108.0B +/-2%'],risk:'The 75.0% gross margin and operating growth are strong, but first-half investment gains make net income a less clean operating-quality measure.',url:'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000073/q2fy27pr.htm'},
  CRWD:{summary:'Q2 FY27 revenue was $1.47B (+26%), ending ARR was $5.84B (+25%) and net-new ARR was $332.8M. GAAP diluted EPS was $0.01 versus non-GAAP EPS of $0.31; free cash flow was $377.4M.',metrics:['Revenue $1.47B (+26%)','ARR $5.84B (+25%)','Net-new ARR $332.8M','Free cash flow $377.4M'],risk:'Quarterly stock compensation and related payroll taxes remain material, while GAAP operating income was still negative.',url:'https://www.sec.gov/Archives/edgar/data/1535527/000153552726000029/crwd-20260826xex991.htm'},
  OKTA:{summary:'Q2 FY27 revenue was $805M (+11%), RPO was $4.858B (+17%) and cRPO was $2.585B (+14%). Free cash flow reached $227M, or 28% of revenue; FY27 revenue guidance rose to $3.216B-$3.226B.',metrics:['Revenue $805M (+11%)','RPO $4.858B (+17%)','cRPO $2.585B (+14%)','FCF $227M / 28% margin'],risk:'Growth is improving but remains near 11%, so valuation and stock compensation prevent an A-range quality grade.',url:'https://www.sec.gov/Archives/edgar/data/1660134/000166013426000068/okta-7312026_ex991.htm'},
  CRM:{summary:'Q2 FY27 revenue was $11.3B (+11%), cRPO was $33.5B (+14%) and total RPO was $66.3B (+11%). Agentforce and Data 360 ARR approached $3.9B; FY27 revenue guidance rose to $46.1B-$46.4B.',metrics:['Revenue $11.3B (+11%)','cRPO $33.5B (+14%)','RPO $66.3B (+11%)','Agentforce + Data 360 ARR ~$3.9B'],risk:'Strategic-investment gains materially helped GAAP earnings, and the guidance includes acquisition contributions; operating cash conversion matters more than headline EPS.',url:'https://www.sec.gov/Archives/edgar/data/1108524/000110852426000187/crm-q2fy27xexhibit991.htm'}
};
const RAISED_GUIDANCE=new Set(['NVDA','OKTA','CRM']);
const ROLE_DETAILS={
  NVDA:'The primary signal: accelerator demand, networking and the Rubin ramp set the ceiling for the whole chain.',CRWD:'AI-agent adoption expands identities and attack paths; ARR and net-new ARR show whether security budgets follow.',OKTA:'Identity is the control plane for human and AI agents; cRPO and cash conversion are the cleanest diffusion tests.',CRM:'The software monetization test rests on cRPO, Agentforce/Data 360 ARR and organic growth after acquisition effects.',
  FTNT:'Security appliances, subscriptions and FortiGuard services test whether the cyber move reaches profitable platform vendors.',TENB:'Exposure management is a narrower cyber read-through; ARR durability and cash conversion matter more than sympathy beta.',PANW:'Platform consolidation can capture AI-security budgets, but CyberArk merger consideration and an earnings window dominate near-term risk.',ZS:'Zero-trust demand is a direct AI attack-surface read-through, with billings, ARR and stock compensation determining quality.',NOW:'Workflow automation can monetize enterprise AI through subscriptions; cRPO and renewal economics must confirm it.',SNOW:'Consumption growth, product revenue and RPO determine whether enterprise AI workloads are becoming paid usage.',DDOG:'Cloud observability benefits from AI workloads, but customer expansion and free-cash-flow conversion must justify the multiple.',ORCL:'Cloud infrastructure and database demand link directly to AI capex; the funding plan, RPO and datacenter capex are equally important.',MDB:'Atlas consumption is the relevant AI application signal; losses and stock compensation keep the hurdle high.',S:'SentinelOne is a higher-risk endpoint and AI-security read-through whose own earnings and cash conversion override group momentum.',
  KLAC:'Process-control intensity rises with leading-edge complexity, making inspection demand a cleaner semiconductor-capex transmission channel.',SNPS:'EDA and IP revenue monetize chip complexity before fabrication; acquisition debt and integration are the principal offsets.',AMKR:'Advanced packaging utilization transmits AI demand, but low margins, capex intensity and customer concentration cap quality.',TTMI:'High-end PCB and datacenter interconnect demand provide the link; leverage and execution determine whether growth converts to equity value.',VICR:'Power modules address accelerator density, but customer concentration and a demanding multiple make adoption evidence essential.',AAOI:'Datacenter optics provide direct AI bandwidth beta; losses, the Amazon warrant and the $600M ATM dominate the equity case.',ANET:'AI Ethernet switching is the transmission channel; cloud-customer concentration and valuation sensitivity are the main risks.',MRVL:'Custom silicon, electro-optics and networking diversify AI compute beyond GPUs; its own results and financing matter more than Nvidia sympathy.',AVGO:'Custom accelerators and networking are the core read-through, while VMware cash flow and leverage shape the equity outcome.',AMD:'Datacenter GPUs and CPUs provide the closest compute alternative; mix, gross margin and customer adoption are decisive.',SMCI:'Rack-scale server demand is direct AI beta, but financing, controls and working-capital execution can overwhelm revenue growth.',MU:'HBM and datacenter memory convert accelerator demand into memory pricing and mix; cycle normalization remains the key risk.',DELL:'AI-server backlog can lift revenue while low hardware margins and working capital limit profit conversion.',HPE:'AI systems and networking broaden the chain, but financing debt, integration and system margins require separation.',INTC:'Foundry and accelerator ambitions offer optionality, while foundry losses, capex and government-linked securities dominate the risk.',
  CRWV:'Contracted GPU-cloud capacity is direct AI infrastructure beta; customer concentration, lease obligations and financing decide equity value.',APLD:'Datacenter leases connect power and compute demand, but project funding, tenant concentration and construction delivery are decisive.',NBIS:'AI cloud capacity links accelerator demand to recurring infrastructure revenue; buildout funding and utilization remain the test.',WULF:'HPC hosting can diversify mining economics, but financing and delivery must be measured against power and crypto exposure.',CIFR:'Power assets and HPC optionality are valuable only if contracts outrun mining cyclicality and capital needs.',HUT:'Power, datacenter and mining assets create multiple paths, but financing complexity and execution make the equity highly reflexive.',CORZ:'Long-duration hosting contracts can stabilize compute revenue; leverage, counterparty concentration and buildout execution remain central.',IREN:'Renewable-powered datacenters bridge mining and AI cloud demand; capex, delivery and utilization drive the outcome.',BE:'Fuel-cell deployments can serve constrained datacenter power demand; project economics and customer concentration remain the gate.',
  CEG:'Nuclear generation is a direct beneficiary of firm datacenter load, tempered by regulation, contracting and valuation.',VST:'Generation and retail power exposure can monetize load growth, with commodity hedging and capital allocation shaping returns.',GEV:'Grid equipment and power systems translate AI load into backlog, but project execution and working capital determine cash conversion.',
  MSTR:'The equity is a leveraged bitcoin treasury with preferred and common issuance; BTC per share and financing cost matter more than software.',COIN:'Transaction revenue, subscriptions, stablecoins and custody drive operating leverage; it is not a bitcoin miner.',MARA:'Hashrate, fleet efficiency, hashprice and financing determine whether bitcoin strength reaches shareholders.',CLSK:'Mining output, fleet efficiency and BTC yield must outrun network difficulty and dilution.',CAN:'Mining-machine sales and self-mining create cyclical crypto beta; ADS issuance, warrants and earnings risk are central.',SBET:'The equity is a crypto-treasury financing vehicle; asset value per diluted share and warrant overhang dominate.',BMNR:'Crypto-treasury exposure is financed with common and preferred capital, making NAV premium and dividend claims central.',
  CDE:'Silver and gold prices help only if production, AISC and mine execution convert them into free cash flow.',AG:'Silver leverage depends on production, AISC, reserves and jurisdiction, not the spot move alone.',EQX:'Gold sensitivity must be tested against mine ramp-up, AISC, leverage and jurisdiction risk.',
  LPLA:'Advisor assets, organic flows and client-cash economics drive the brokerage, not the AI earnings chain.',ALLR:'Clinical milestones, cash runway and the equity purchase facility dominate this biotech observation.',LUNR:'Lunar contract backlog, milestone execution and the $500M ATM matter more than broad risk-on sympathy.',RZLV:'Commercial execution and cash runway must offset a large recent share offering and event risk.',MRSH:'Advisory assets, organic flows and client-cash economics are the relevant broker KPIs.',STRL:'Infrastructure backlog, project margins and acquisition integration determine whether the strong chart is supported.'
};
const SEC_NOTES={
  ORCL:'Capital review: a $20B common-stock ATM, mandatory-convertible preferred financing and large senior-note issuance must be assessed separately; a shelf is not an issuance.',
  PANW:'The reviewed 424B3 is merger consideration for CyberArk, including approximately 111.3M PANW shares; it is not classified as a routine warrant financing.',
  MSTR:'Separate programs include a $21B STRC preferred-stock ATM and a $21B Class A common-stock ATM; preferred dividends, seniority and common dilution have different effects.',
  CAN:'The November 2025 prospectus records a firm sale of 63,660,477 ADS at $1.131, not merely unused ATM capacity.',
  SBET:'The June 2026 prospectus offered 10,013,351 common shares plus an equal number of warrants at a $7.49 combined price; warrant strike was $8.15.',
  BMNR:'The June 2026 offering involved 3.5M shares of 9.5% perpetual preferred stock; the dividend claim is distinct from common dilution.',
  ALLR:'The January 2026 prospectus covers up to $6M of common stock under the Tumim purchase agreement.',
  LUNR:'The June 2026 prospectus established up to $500M of Class A common-stock ATM capacity.',
  RZLV:'The January 2026 prospectus covered an offering of 62.5M ordinary shares; this is an executed financing event, not just registration capacity.',
  AAOI:'The reviewed prospectus supplements include the $600M ATM; amendments and supplements are one financing history, not five independent programs.',
  SMCI:'Common-share, ATM and mandatory-convertible preferred financings plus affirmative control-weakness language require a high capital/control risk assessment.',
  MRVL:'The April 2026 prospectus is a senior-notes financing and is classified as debt, not warrant dilution.',
  INTC:'Equity prospectuses require security, seller and proceeds review; no unsupported warrant conclusion is used.',
  CRWV:'The September 2025 424B3 concerned the proposed Core Scientific merger, terminated on October 30, 2025; it is historical transaction evidence, not current financing capacity.',
  APLD:'Reviewed 424B3 filings include 8,393,611 warrant shares and preferred-conversion financing; those claims are distinct from ordinary operating debt.',
  NBIS:'The November 12, 2025 filing established a 25M-share ATM; the September 12, 2025 filing priced 10.810811M shares alongside $2.75B of convertible debt. Legacy going-concern doubt was reported as removed, not current.',
  WULF:'The April 2026 prospectus priced a 47.4M-share base offering at $19 and described a 7.11M-share option; the Q2 10-Q proves the option was exercised and 54.51M shares were ultimately issued for $1.0357B gross.',
  HUT:'The February 2026 ATM disclosed $1B capacity, $284.2M already sold and $715.8M remaining; project debt must be separated from corporate recourse.',
  CORZ:'The August 2026 current report includes a $100M revolver, $500M letter-of-credit facility, liens, covenants, a $150M liquidity floor and two warrant classes.',
  IREN:'The August 2026 annual results supersede stale aggregator fields: FY26 revenue was $707M, impairment was $638.8M, cash was $5.896B, restricted cash was $1.724B and debt was about $7.593B. The $6B ATM had sold about $1B under accession 0001140361-26-007918.',
  GEV:'The February 2026 424B5 issued $2.6B of straight senior notes; generic base-shelf warrant wording is not treated as active dilution.'
};
const EXTRA_FILINGS={
  HUT:{date:'2026-06-10',form:'8-K',accession:'0001104659-26-071952',finding:'$4.25B of 6.129% secured project notes due 2042; project-level security and recourse must be distinguished from corporate debt.',url:'https://www.sec.gov/Archives/edgar/data/1964789/000110465926071952/tm2617190d1_8k.htm'}
};
const FILING_NOTES={
  MSTR:{
    '0001193125-26-279602':'$21B STRC preferred-stock ATM program.',
    '0001193125-26-118806':'$21B common-stock ATM program.',
    '0001193125-26-118796':'STRC preferred-stock program.',
    '0001193125-26-118782':'$2.1B STRK preferred-stock program.'
  },
  ALLR:{
    '0001213900-26-047735':'Resale prospectus for 255,103 previously issued shares; the issuer receives no proceeds from those resales.',
    '0001213900-26-009158':'Up to $6M of common stock under the Tumim purchase agreement.'
  },
  HPE:{'0001645590-26-000055':'30M Series C mandatory-convertible preferred shares were outstanding; the filing showed as many as 87M potentially dilutive common shares and 76M in the diluted-share calculation.'},
  INTC:{'0001193125-26-346806':'Completed sale of 210,526,315 shares plus the fully exercised 31,578,947-share option at $95, totaling 242,105,262 shares and $23B gross proceeds.'},
  SMCI:{
    '0001193125-26-265109':'Common offering covered 45,454,545 shares plus a 6,818,181-share option.',
    '0001193125-26-265112':'75M depositary shares of mandatory-convertible preferred stock represent approximately 113.64M to 136.37M common-share equivalents under the stated conversion rates.',
    '0001193125-26-268520':'ATM capacity was $1.25B; it is separate from the completed common and preferred financings.'
  },
  APLD:{
    '0001493152-25-024319':'Resale registration covers 8,393,611 common shares issuable upon exercise of specified warrants.',
    '0001493152-25-018157':'Preferred financing and conversion history includes a $590M commitment; it is separate from the warrant-share registration.'
  },
  NBIS:{
    '0001104659-25-110025':'25M-share ATM program; no completed sale is inferred from capacity alone.',
    '0001410578-25-002147':'Offering priced 10,810,811 common shares alongside $2.75B of convertible debt.'
  },
  IREN:{
    '0001878848-26-000052':'FY26 annual filing: revenue $707M, cash $5.896B, restricted cash $1.724B, debt about $7.593B and impairment $638.8M.',
    '0001878848-26-000051':'Current report furnished the August 27 annual-results release; the filing-data veto remains active pending full bundle reconciliation.',
    '0001140361-26-007918':'$6B common-stock ATM program; about $1B had been sold under the program.'
  }
};
const EVENT_OVERRIDES={
  SNPS:{date:'2026-08-26',summary:'Synopsys Q3 FY26 revenue was $2.477B versus $1.740B a year earlier; GAAP diluted EPS was $2.84 and non-GAAP diluted EPS was $3.91.',metrics:['Q3 FY26 revenue $2.477B, +42% YoY','GAAP diluted EPS $2.84; non-GAAP diluted EPS $3.91','FY26 revenue midpoint raised to $9.715B; non-GAAP EPS midpoint $15.07'],risk:'Ansys integration, preliminary synergy assumptions and elevated AI expectations can outweigh the quarterly beat.',url:'https://www.sec.gov/Archives/edgar/data/883241/000119312526368620/d157153dex991.htm'},
  MRVL:{date:'2026-08-27',summary:'Marvell Q2 FY27 revenue reached a record $2.739B, up 37%, with Data Center revenue up 46%.',metrics:['Q2 FY27 revenue $2.739B, +37% YoY','GAAP gross margin 53.1%; diluted EPS $0.33','Q3 revenue guide $3.150B +/-5%'],risk:'Customer concentration, preferred-stock dilution and custom-silicon execution can overwhelm the AI demand read-through.',url:'https://www.sec.gov/Archives/edgar/data/1835632/000183563226000022/q227_8kx812026ex-991.htm'}
};
const RISK_OVERRIDES={
  MSTR:'Bitcoin drawdown, mNAV compression and preferred-stock service costs can make the equity underperform spot BTC.',
  COIN:'Trading-volume, fee compression, stablecoin economics and regulation can dominate the crypto tape.',
  SBET:'ETH NAV discount, warrant dilution and financing terms can dominate treasury appreciation.',
  BMNR:'Treasury NAV discount, preferred claims and control quality can dominate underlying crypto performance.'
};
const FINANCIAL_OVERRIDES={
  SMCI:{totalRevenue:39.063072e9,grossMargins:.1082,operatingMargins:.07092,profitMargins:.05710,totalCash:7.521474e9,totalDebt:8.720287e9},
  MU:{operatingMargins:null}
};
const SUPPRESS_GENERIC_CAPITAL_FLAGS=new Set(['PANW','ORCL','CRWV','NBIS','GEV','MRVL','INTC','IREN']);
const EDITORIAL_DIR=path.join(ROOT,'data','analysis-editorial-overrides');
const TRADE_OVERRIDE_DIR=path.join(ROOT,'data','analysis-trade-overrides');
const GRADE_OVERRIDE_DIR=path.join(ROOT,'data','analysis-grade-overrides');
const DILUTED_DISCLOSURE_APPEND={
  ALLR:'Adding 1,373,497 unvested RSUs, 50,000 options and 8,557 warrants to 15,910,724 outstanding shares gives a 17,342,778-share minimum observable diluted exposure; convertibles and variable-price Tumim issuance prevent a complete fully diluted total.',
  AMKR:'Amkor does not provide a current fully diluted point-in-time bridge in the reviewed materials, so unvested awards are not added to the 248.5M basic count without vesting and treasury-stock assumptions.',
  KLAC:'KLA does not provide a current fully diluted point-in-time bridge in the reviewed materials, so no award estimate is added to the 1.31B split-adjusted basic count.',
  LPLA:'LPL does not provide a current fully diluted point-in-time bridge in the reviewed materials, so the dossier does not construct a synthetic total.',
  MRSH:'Marsh does not provide a current fully diluted point-in-time bridge in the reviewed materials, so awards are not added to the basic count heuristically.',
  RZLV:'Rezolve does not provide a current fully diluted point-in-time bridge that reconciles warrant exercise assumptions and Crownpeak consideration-share timing, so no synthetic total is presented.',
  VICR:'Vicor does not provide a current fully diluted point-in-time bridge in the reviewed materials, so awards are not estimated from the 34.4M basic count.'
};
const EDITORIAL_KEYS={
  verdict:new Set(['summary','whyAvoid','whyBuy']),
  business:new Set(['moat','overview','segments','sourceRefs']),
  earnings:new Set(['beatNote','nextEarnings','sourceRefs']),
  fundamentals:new Set(['editorialRows','sourceRefs']),
  capitalStructure:new Set(['sharesOutstanding','shareHistory','sourceRefs']),
  filingsReview:new Set(['additionalFilings','contrarianRisks','findingsByAccession']),
  technicals:new Set(['setupNote','sourceRefs']),
  macro:new Set(['impact']),
  risks:new Set(['pedagogy','riskCards','riskSummary']),
  tradeIdea:new Set(['catalysts','invalidation','thesis']),
  globalScore:new Set(['keyTakeawaysNegative','keyTakeawaysPositive'])
};

const load=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return {};}};
const at=(a,t)=>a.find(x=>x&&x.type===t)||{};
const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(+v)?+v:null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const positive=(...v)=>v.map(num).find(x=>x!==null&&x>0)??null;
const money=v=>{v=num(v);if(v===null)return'N/A';const a=Math.abs(v);if(a>=1e12)return'$'+(v/1e12).toFixed(2)+'T';if(a>=1e9)return'$'+(v/1e9).toFixed(2)+'B';if(a>=1e6)return'$'+(v/1e6).toFixed(1)+'M';return'$'+v.toLocaleString('en-US',{maximumFractionDigits:0});};
const qty=v=>{v=num(v);if(v===null)return'N/A';if(Math.abs(v)>=1e9)return(v/1e9).toFixed(2)+'B';if(Math.abs(v)>=1e6)return(v/1e6).toFixed(1)+'M';return v.toLocaleString('en-US',{maximumFractionDigits:0});};
const parseQtyString=v=>{const m=String(v||'').trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([MB])$/i);return m?Number(m[1])*(m[2].toUpperCase()==='B'?1e9:1e6):null;};
const pct=(v,scale=100)=>num(v)===null?'N/A':(num(v)*scale).toFixed(1)+'%';
const px=v=>num(v)===null?'N/A':'$'+num(v).toFixed(2);
const qresults=(t,f)=>{const j=load(path.join(ROOT,'analyses',t,'_data',f));return j.data?.items?.flatMap(x=>x.results||[])||j.results||[];};
const qtype=(t,f,k)=>{const r=qresults(t,f).find(x=>x.data_type===k);return Array.isArray(r?.data)?r.data:[];};
const csv=lines=>{if(!Array.isArray(lines)||lines.length<2)return[];const h=String(lines[0]).split(',');return lines.slice(1).map(s=>Object.fromEntries(h.map((k,i)=>[k,String(s).split(',')[i]])));};
const levels=lines=>csv(lines).map(x=>num(x.price)).filter(x=>x!==null);
const grade=s=>s>=90?'A+':s>=84?'A':s>=78?'A-':s>=72?'B+':s>=66?'B':s>=60?'B-':s>=54?'C+':s>=48?'C':s>=42?'C-':s>=35?'D+':'D';
const gradeColor=s=>s>=78?'High':s>=60?'Moderate':'Low';
const secUrl=(cik,a,doc)=>`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${a.replace(/-/g,'')}/${doc}`;

function deepMerge(base,override){
  if(!override||typeof override!=='object'||Array.isArray(override))return override;
  const out={...(base&&typeof base==='object'&&!Array.isArray(base)?base:{})};
  for(const[k,v]of Object.entries(override))out[k]=v&&typeof v==='object'&&!Array.isArray(v)?deepMerge(out[k],v):v;
  return out;
}

function loadEditorialOverrides(){
  if(!fs.existsSync(EDITORIAL_DIR))return{};
  return fs.readdirSync(EDITORIAL_DIR).filter(f=>f.endsWith('.json')).sort().reduce((all,f)=>{
    const group=load(path.join(EDITORIAL_DIR,f));
    for(const[t,v]of Object.entries(group)){
      if(all[t])throw new Error(`Duplicate editorial override for ${t}: ${f}`);
      all[t]=v;
    }
    return all;
  },{});
}

function loadGroupedOverrides(dir,label){
  if(!fs.existsSync(dir))return{};
  return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort().reduce((all,f)=>{
    const group=load(path.join(dir,f));
    for(const[t,v]of Object.entries(group)){
      if(all[t])throw new Error(`Duplicate ${label} override for ${t}: ${f}`);
      all[t]=v;
    }
    return all;
  },{});
}

function applyTradeOverride(data,override){
  if(!override)return data;
  const t=data.header.ticker,entry=Number(data.tradeIdea.entry);
  if(Number(override.entry)!==entry)throw new Error(`${t}: trade override cannot change entry ${entry}`);
  const stop=Number(override.stop),tp1=Number(override.tp1),tp2=Number(override.tp2);
  if(![stop,tp1,tp2].every(Number.isFinite))throw new Error(`${t}: trade override levels must be finite numbers`);
  const long=tp1>entry;
  if(!(long?stop<entry&&entry<tp1&&tp1<tp2:stop>entry&&entry>tp1&&tp1>tp2))throw new Error(`${t}: trade override geometry is inconsistent`);
  const basis=override.basis||{};
  if(basis.asOf!==REFDATE||!basis.stop||!basis.tp1||!basis.tp2||!/^analyses\/[A-Z0-9.\-]+\/_data\/bars\.json$/.test(basis.source||''))throw new Error(`${t}: trade override needs dated stop/TP basis and a bars source`);
  const risk=Math.abs(entry-stop),rr1=Math.abs(tp1-entry)/risk,rr2=Math.abs(tp2-entry)/risk;
  Object.assign(data.tradeIdea,{
    stop,tp1,tp2,
    stopPct:`${((stop/entry-1)*100).toFixed(1)}%`,
    tp1Pct:`${tp1>=entry?'+':''}${((tp1/entry-1)*100).toFixed(1)}%`,
    tp2Pct:`${tp2>=entry?'+':''}${((tp2/entry-1)*100).toFixed(1)}%`,
    rr:`1:${rr1.toFixed(2)} to TP1 / 1:${rr2.toFixed(2)} to TP2`,
    entryNote:`${data.tradeIdea.entryNote} Stop basis: ${basis.stop} TP1 basis: ${basis.tp1} TP2 basis: ${basis.tp2}`
  });
  if(override.status){
    const allowed=new Set(['watch','wait','rejected']);
    if(!allowed.has(override.status)||String(override.statusReason||'').trim().length<30)throw new Error(`${t}: trade status override requires watch/wait/rejected and a substantive statusReason`);
    data.tradeIdea.status=override.status;
    data.tradeIdea.statusNote=override.statusReason;
    data.tradeIdea.entryNote=`${override.statusReason} Stop basis: ${basis.stop} TP1 basis: ${basis.tp1} TP2 basis: ${basis.tp2}`;
    data.meta.status=override.status;
    data.verdict.bias=override.status==='watch'?'Bullish':'Neutral';
    if(data.filingsReview?.summary)data.filingsReview.summary=data.filingsReview.summary.replace(/trade state (?:pending|watch|wait|rejected)/i,`trade state ${override.status}`);
    if(data.globalScore?.mindsetTip){
      data.globalScore.mindsetTip=data.globalScore.mindsetTip.replace(/Current trade state: (?:pending|watch|wait|rejected)\./i,`Current trade state: ${override.status}.`);
    }
    if(Array.isArray(data.header?.badges))data.header.badges=data.header.badges.map(b=>['pending','watch','wait','rejected'].includes(String(b?.text||'').toLowerCase())?{...b,text:override.status.toUpperCase(),color:override.status==='watch'?'blue':'amber'}:b);
    if(Array.isArray(data.technicals?.badges))data.technicals.badges=data.technicals.badges.map(b=>['pending','watch','wait','rejected'].includes(String(b).toLowerCase())?override.status.toUpperCase():b);
    if(/absent from the frozen/i.test(override.statusReason)||/absent from the frozen/i.test(basis.entry||'')){
      const dated=`For ${t}, only stop ${px(stop)}, TP1 ${px(tp1)} and TP2 ${px(tp2)} are dated structural pivots through ${basis.asOf}; entry ${px(entry)} has no observed provenance.`;
      const operational=/\b(?:activat(?:e|es|ed|ion)|entry|order|sizing|size(?: the position)?|cap (?:portfolio )?risk|risk no more|calculate shares|chase|stop distance|15-minute confirmation|watch status|confirmation remains)\b/i;
      const keepNonOperational=text=>String(text||'').split(/(?<=[.!?])\s+/).filter(sentence=>!operational.test(sentence)).join(' ').trim();
      const dormantNote=override.statusReason;
      const cleanedSummary=keepNonOperational(data.verdict?.summary);
      if(data.verdict)data.verdict.summary=`${cleanedSummary}${cleanedSummary?' ':''}${dormantNote}`;
      for(const key of['whyBuy','whyAvoid'])if(Array.isArray(data.verdict?.[key])){
        data.verdict[key]=data.verdict[key].map(point=>operational.test(point)?`${t}: the captured record does not establish an executable regular-session setup.`:point);
      }
      data.technicals.setupNote=`${override.statusReason} ${dated} ${t} requires a newly observed regular-session structure before execution can be reconsidered. Daily indicators and pivots run only through the 2026-08-27 close.`;
      const openingIndicator=(data.macro?.indicators||[]).find(x=>x.name==='Opening observation');
      if(openingIndicator)openingIndicator.signal=`${t}: no executable regular-session level is established by this frozen observation.`;
      const executionCard=(data.risks?.riskCards||[]).find(card=>/structural execution|trade gate|watch geometry/i.test(card.title||''));
      if(executionCard){
        executionCard.points=[override.statusReason,dated];
        executionCard.verdict=`${t} has zero authorized sizing and no executable order until a fresh dated RTH structure replaces the dormant entry.`;
      }
      for(const card of data.risks?.riskCards||[]){
        if(card===executionCard)continue;
        card.points=(card.points||[]).map(point=>operational.test(point)?`${data.header.name}: ${card.title.toLowerCase()} remains context, not trade authorization, while the observed setup is incomplete.`:point);
        if(operational.test(card.verdict||''))card.verdict=`${card.title} cannot authorize execution for ${t} without a newly observed regular-session structure.`;
      }
      const pedagogyLead=keepNonOperational(data.risks?.pedagogy);
      if(data.risks){
        data.risks.riskSummary=`${keepNonOperational(data.risks.riskSummary)} ${dormantNote}`.trim();
        data.risks.pedagogy=`${pedagogyLead} For ${data.header.name}, gap behavior and liquidity, spread or slippage are not established for this dormant structure; the sizing implication is zero, event timing must be rechecked, and the old level must not be chased or anticipated.`.trim();
      }
      const fundamentalInvalidations=(data.tradeIdea.invalidation||[]).filter(x=>!/activat|order|siz|stop|opening|slippage|spread|chase/i.test(x)).slice(-2);
      data.tradeIdea.horizon=`${t}: no active holding horizon`;
      data.tradeIdea.thesis=`${keepNonOperational(data.tradeIdea.thesis)} ${override.statusReason} ${t}'s dated ${px(stop)} stop and ${px(tp1)}/${px(tp2)} targets remain analytical references, not operational instructions.`.trim();
      data.tradeIdea.invalidation=[override.statusReason,`${t} needs a fresh regular-session structure before its dormant entry, stop, targets or sizing can become operational.`,...fundamentalInvalidations];
      while(data.tradeIdea.invalidation.length<3)data.tradeIdea.invalidation.push(`${t} company-specific fundamental deterioration requires a new dossier before execution.`);
      const preservedCatalysts=(data.tradeIdea.catalysts||[]).filter(x=>!/15-minute|activation|opening range/i.test(x));
      data.tradeIdea.catalysts=[...preservedCatalysts,`${t} fresh RTH structure with an observed entry`,`${t} revalidation of the dated ${px(stop)} structural reference`,`${t} event calendar cleared before execution`].slice(0,Math.max(3,preservedCatalysts.length));
      for(const key of['keyTakeawaysPositive','keyTakeawaysNegative'])if(Array.isArray(data.globalScore?.[key])){
        data.globalScore[key]=data.globalScore[key].map(point=>operational.test(point)?`${data.header.name}: no current RTH setup is evidenced.`:point);
      }
      data.disclaimer=`${t} research snapshot dated ${DATE}, for education rather than personalized advice. Rebuild the market structure from fresh dated evidence before treating any displayed level as operational.`;
    }
  }
  const selectLevels=(required,existing)=>[...required,...(existing||[])]
    .filter(Number.isFinite)
    .filter((v,i,a)=>a.indexOf(v)===i)
    .slice(0,3)
    .sort((a,b)=>a-b);
  const existingSupports=override.replaceTechnicalLevels===true?[]:data.technicals.supports;
  const existingResistances=override.replaceTechnicalLevels===true?[]:data.technicals.resistances;
  data.technicals.supports=selectLevels(long?[stop]:[entry,tp1,tp2],existingSupports);
  data.technicals.resistances=selectLevels(long?[entry,tp1,tp2]:[stop],existingResistances);
  return data;
}

function applyGradeOverride(data,override){
  if(!override)return data;
  const t=data.header.ticker,score=Number(override.score),g=String(override.grade||'');
  if(!Number.isInteger(score)||score<0||score>100||grade(score)!==g)throw new Error(`${t}: grade override score/grade mismatch`);
  if(override.asOf!==REFDATE||String(override.basis||'').trim().length<40)throw new Error(`${t}: grade override needs a dated substantive basis`);
  data.verdict.score=score;
  data.meta.grade=g;
  const row=(data.fundamentals.rows||[]).find(x=>x.metric==='Fundamental grade audit');
  if(row){row.value=`${score}/100 (${g})`;row.signal=override.basis;row.signalColor=score>=72?'green':score>=54?'amber':'red';}
  return data;
}

function validateEditorialOverride(ticker,override){
  for(const[section,value]of Object.entries(override||{})){
    if(section==='news'){
      if(!Array.isArray(value))throw new Error(`${ticker}: editorial news must be an array`);
      continue;
    }
    const allowed=EDITORIAL_KEYS[section];
    if(!allowed)throw new Error(`${ticker}: editorial override cannot replace ${section}`);
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${ticker}: editorial ${section} must be an object`);
    for(const key of Object.keys(value))if(!allowed.has(key))throw new Error(`${ticker}: editorial override cannot replace ${section}.${key}`);
  }
}

function applyEditorialOverride(data,override){
  if(!override)return data;
  validateEditorialOverride(data.header.ticker,override);
  const editorialRows=override.fundamentals?.editorialRows||[];
  const additionalFilings=override.filingsReview?.additionalFilings||[];
  const findingsByAccession=override.filingsReview?.findingsByAccession||{};
  const clean=JSON.parse(JSON.stringify(override));
  if(clean.fundamentals)delete clean.fundamentals.editorialRows;
  if(clean.filingsReview){
    delete clean.filingsReview.additionalFilings;
    delete clean.filingsReview.findingsByAccession;
  }
  const merged=deepMerge(data,clean);
  const overriddenShares=parseQtyString(override.capitalStructure?.sharesOutstanding);
  if(overriddenShares&&positive(merged.header?.price)&&merged.header?.metrics){
    merged.header.metrics.marketCap=money(overriddenShares*merged.header.price);
  }
  if(editorialRows.length){
    const names=new Set(editorialRows.map(x=>x.metric));
    merged.fundamentals.rows=[...editorialRows,...merged.fundamentals.rows.filter(x=>!names.has(x.metric))];
    // A provider-level EBITDA field has no inspectable period or denominator.
    // Remove it when the curated rows supply a dated EBITDA or mine-margin bridge.
    if(editorialRows.some(x=>/EBITDA|mine-margin/i.test(x.metric||''))){
      merged.fundamentals.rows=merged.fundamentals.rows.filter(x=>x.metric!=='EBITDA');
    }
  }
  if(Array.isArray(merged.business?.segments)){
    merged.business.segments=merged.business.segments.map(s=>({
      name:s.name||s.segment||'Reported activity',
      revenue:s.revenue||s.value||'',
      ...(s.pct?{pct:s.pct}:{}),
      description:s.description||s.signal||''
    }));
  }
  if(additionalFilings.length){
    if(!Array.isArray(additionalFilings))throw new Error(`${data.header.ticker}: additional SEC filings must be an array`);
    const byAccession=new Map((merged.filingsReview.filings||[]).map(f=>[f.accession,f]));
    for(const filing of additionalFilings){
      if(!/^\d{10}-\d{2}-\d{6}$/.test(filing.accession||'')||!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//i.test(filing.url||''))throw new Error(`${data.header.ticker}: malformed additional SEC filing`);
      byAccession.set(filing.accession,filing);
    }
    merged.filingsReview.filings=[...byAccession.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  }
  if(Object.keys(findingsByAccession).length){
    const secRecord=(sec.records||[]).find(r=>r.ticker===merged.header.ticker);
    const filingInventory=[...(secRecord?.filings||[]),...(merged.filingsReview.filings||[])];
    const byAccession=new Map(filingInventory.map(f=>[f.accession,f]));
    const missing=Object.keys(findingsByAccession).filter(accession=>!byAccession.has(accession));
    if(missing.length)throw new Error(`${merged.header.ticker}: editorial SEC findings missing from inventory: ${missing.join(', ')}`);
    merged.filingsReview.filings=Object.keys(findingsByAccession).map(accession=>{
      const f=byAccession.get(accession);
      return {date:f.date,form:f.form,accession:f.accession,finding:findingsByAccession[accession],url:f.url};
    });
    merged.filingsReview.summary=`${merged.filingsReview.filings.length} decision-relevant primary filing(s) are displayed with accession-specific findings. Grade ${merged.meta.grade} measures fundamentals; trade state ${merged.tradeIdea.status} measures timing and is evaluated separately.`;
  }
  const {entry,stop,tp1,tp2}=merged.tradeIdea||{};
  if([entry,stop,tp1,tp2].every(Number.isFinite)){
    const long=tp1>entry;
    if(!(merged.technicals.supports||[]).length)merged.technicals.supports=(long?[stop]:[tp2,tp1]).filter(Number.isFinite).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
    if(!(merged.technicals.resistances||[]).length)merged.technicals.resistances=(long?[entry,tp1,tp2]:[entry,stop]).filter(Number.isFinite).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
  }
  const t=merged.header.ticker,lower=t.toLowerCase();
  if(DILUTED_DISCLOSURE_APPEND[t]&&!/fully diluted|minimum observable diluted/i.test(merged.capitalStructure?.shareHistory||'')){
    merged.capitalStructure.shareHistory=`${merged.capitalStructure.shareHistory} ${DILUTED_DISCLOSURE_APPEND[t]}`;
  }
  const marketRef=(name,url)=>[{name,url,date:REFDATE}];
  if(merged.shortInterest)merged.shortInterest.sourceRefs=marketRef('Nasdaq short-interest history',`https://www.nasdaq.com/market-activity/stocks/${lower}/short-interest`);
  if(merged.options)merged.options.sourceRefs=marketRef('Nasdaq options chain',`https://www.nasdaq.com/market-activity/stocks/${lower}/option-chain`);
  if(merged.social)merged.social.sourceRefs=marketRef('Stocktwits symbol stream',`https://stocktwits.com/symbol/${encodeURIComponent(t)}`);
  if(merged.performance)merged.performance.sourceRefs=marketRef('Nasdaq historical prices',`https://www.nasdaq.com/market-activity/stocks/${lower}/historical`);
  if(merged.insiders)merged.insiders.sourceRefs=marketRef('Nasdaq insider activity',`https://www.nasdaq.com/market-activity/stocks/${lower}/insider-activity`);
  if(merged.capitalFlow){
    merged.capitalFlow.netFlow='N/A';
    merged.capitalFlow.institutionalFlow='N/A';
    merged.capitalFlow.retailFlow='N/A';
    merged.capitalFlow.darkPoolPct='N/A';
    merged.capitalFlow.signal=`${t}: directional flow remains unscored because no dated, inspectable transaction-level source was captured.`;
    merged.capitalFlow.sourceRefs=[];
  }
  if(merged.technicals){
    if(!/daily (?:indicators|bars|structure|pivots).*2026-08-27|2026-08-27.*daily (?:indicators|bars|structure|pivots)/i.test(merged.technicals.setupNote||'')){
      merged.technicals.setupNote=`${merged.technicals.setupNote} Daily indicators and pivots run only through the 2026-08-27 close.`;
    }
    merged.technicals.sourceRefs=[
      {name:`Nasdaq ${t} quote and market activity`,url:`https://www.nasdaq.com/market-activity/stocks/${lower}`,date:DATE},
      {name:`Nasdaq ${t} historical prices`,url:`https://www.nasdaq.com/market-activity/stocks/${lower}/historical`,date:REFDATE},
      ...(merged.technicals.sourceRefs||[]).filter(ref=>!/^Finviz /i.test(ref.name||''))
    ];
  }
  if(merged.globalScore&&merged.risks?.pedagogy){
    const companySpecific=String(merged.risks.pedagogy).split(/(?<=[.!?])\s+/)[0];
    merged.globalScore.mindsetTip=`${companySpecific} Current trade state: ${merged.tradeIdea.status}.`;
  }
  // The quote-provider field has no inspectable EBITDA denominator. Curated,
  // dated valuation rows carry the reproducible measures instead.
  if(merged.header?.metrics){
    merged.header.metrics.evEbitda='';
    if(merged.header.metrics.marketCap==='$0')merged.header.metrics.marketCap='';
  }
  if(merged.tradeIdea?.status==='pending'){
    merged.tradeIdea.status='wait';
    merged.meta.status='wait';
    merged.tradeIdea.statusNote=`Wait: ${merged.tradeIdea.statusNote||'the plan is not active.'}`;
    if(Array.isArray(merged.header?.badges))merged.header.badges=merged.header.badges.map(b=>String(b?.text||'').toLowerCase()==='pending'?{...b,text:'WAIT'}:b);
    if(Array.isArray(merged.technicals?.badges))merged.technicals.badges=merged.technicals.badges.map(b=>String(b).toLowerCase()==='pending'?'WAIT':b);
    if(merged.filingsReview?.summary)merged.filingsReview.summary=merged.filingsReview.summary.replace(/trade state pending/i,'trade state wait');
  }
  if(merged.tradeIdea?.status==='wait'&&merged.verdict?.summary)merged.verdict.summary=merged.verdict.summary.replace(/trade remains pending/gi,'trade remains on wait');
  merged.meta.tags=(merged.meta.tags||[]).filter(tag=>tag!=='editorial-reviewed');
  return merged;
}

function bars(t){
  const b=qtype(t,'bars.json','bars_daily')[0]?.bars||[];
  return b.map(r=>({date:String(r[0]).slice(0,10),open:num(r[1]),high:num(r[2]),low:num(r[3]),close:num(r[4]),volume:num(r[5])})).filter(x=>x.close!==null&&x.date<=REFDATE);
}
function ema(values,period){
  if(!values.length)return null;
  const k=2/(period+1);let value=values[0];
  for(let i=1;i<values.length;i++)value=values[i]*k+value*(1-k);
  return value;
}
function atrFromBars(rows,period=14){
  if(rows.length<2)return null;
  const tr=rows.slice(1).map((x,i)=>Math.max(x.high-x.low,Math.abs(x.high-rows[i].close),Math.abs(x.low-rows[i].close))).filter(Number.isFinite);
  return tr.length?tr.slice(-period).reduce((a,b)=>a+b,0)/Math.min(period,tr.length):null;
}
function rsiFromBars(rows,period=14){
  const changes=rows.slice(1).map((x,i)=>x.close-rows[i].close).slice(-period);
  if(changes.length<period)return null;
  const gain=changes.reduce((a,x)=>a+Math.max(x,0),0)/period,loss=changes.reduce((a,x)=>a+Math.max(-x,0),0)/period;
  return loss===0?100:100-(100/(1+gain/loss));
}
function intradayRows(items){
  const raw=at(items,'instrument_bar_intraday15m').bars||[];
  return csv(raw).map(x=>({time:x.time,open:num(x.open),high:num(x.high),low:num(x.low),close:num(x.close),volume:num(x.volume)})).filter(x=>x.time&&x.close!==null);
}
function structuralLevels(rows,spot){
  const sample=rows.slice(-100),lows=[],highs=[];
  for(let i=2;i<sample.length-2;i++){
    const x=sample[i],before=sample.slice(i-2,i),after=sample.slice(i+1,i+3);
    if(before.every(y=>x.low<=y.low)&&after.every(y=>x.low<=y.low))lows.push(x.low);
    if(before.every(y=>x.high>=y.high)&&after.every(y=>x.high>=y.high))highs.push(x.high);
  }
  const unique=xs=>xs.sort((a,b)=>a-b).filter((x,i,a)=>i===0||Math.abs(x/a[i-1]-1)>.008);
  return {supports:unique(lows.filter(x=>x<spot&&x>spot*.80)).sort((a,b)=>b-a),resistances:unique(highs.filter(x=>x>spot&&x<spot*1.30))};
}
function performance(b,days){if(b.length<2)return null;const end=b.at(-1),cut=new Date(end.date+'T00:00:00Z')-days*86400000;const start=b.find(x=>new Date(x.date+'T00:00:00Z')>=cut)||b[0];return start.close?(end.close/start.close-1)*100:null;}
function ytd(b){const end=b.at(-1);if(!end)return null;const prior=b.filter(x=>x.date<`${end.date.slice(0,4)}-01-01`).at(-1);return prior?.close?(end.close/prior.close-1)*100:null;}
function news(t,name){
  const rows=qtype(t,'sentiment.json','news').flat(3).filter(x=>x?.title);
  const keys=[t.toLowerCase(),String(name).toLowerCase().split(/\s+/)[0]];
  return rows.filter(x=>keys.some(k=>k.length>2&&x.title.toLowerCase().includes(k))).slice(0,5).map(x=>({date:String(x.publishedAt||DATE).slice(0,10),title:x.title,source:x.source||'Market news',sourceUrl:x.url,impact:/beat|raise|record|growth|surge/i.test(x.title)?'positive':/miss|cut|fall|risk|probe|offering/i.test(x.title)?'negative':'neutral',detail:'Headline context only; the trade decision uses the structured levels and filing review.'}));
}

function filingFinding(f){
  const r=f.review||{};
  if(/^10-|20-F|40-F/.test(f.form)) return 'Periodic report reviewed for liquidity, leverage, stock compensation and material risks.';
  if(f.form==='424B5'||f.form==='424B3') return r.offeringType==='debt'?'Prospectus classified as debt, not an equity raise.':r.offeringType==='equity'?'Equity-related prospectus; dilution terms require sizing before entry.':'Prospectus reviewed; instrument type is not assumed from the form alone.';
  if(/S-3|F-3|S-1|F-1/.test(f.form)) return 'Registration capacity exists; a shelf alone is not evidence that securities were sold.';
  if(f.form==='EFFECT') return 'Registration effectiveness notice; it does not prove issuance by itself.';
  return 'Current report reviewed for results and material company events.';
}

function build(t,secRecord,priorVersion=0){
  const items=load(path.join(ROOT,'analyses',t,'_data','instrument.json')).data?.items||[];
  if(!items.length)throw new Error(`${t}: instrument bundle missing`);
  const md=at(items,'instrument_metadata'),qt=at(items,'instrument_quote'),pr=at(items,'instrument_comprehensive_profile');
  const fn=at(items,'instrument_comprehensive_financial'),st=at(items,'instrument_comprehensive_stats'),te=at(items,'instrument_technicals');
  if(t==='IREN')Object.assign(fn,{totalRevenue:707e6,totalCash:5.896e9,totalDebt:7.593e9});
  if(FINANCIAL_OVERRIDES[t])Object.assign(fn,FINANCIAL_OVERRIDES[t]);
  const sr=at(items,'instrument_support_resistance'),cal=at(items,'instrument_calendar'),ho=at(items,'instrument_comprehensive_holders');
  const ins=at(items,'instrument_insider_transactions'),si=at(items,'instrument_short_interest'),mp=at(items,'instrument_max_pain'),ov=at(items,'instrument_options_volume_ratio');
  const sh=at(items,'instrument_shariah_compliance'),sw=at(items,'instrument_sentiment_stocktwits'),so=at(items,'instrument_sentiment_overall'),dp=at(items,'instrument_dark_pool');
  const earnings=items.filter(x=>x.type==='instrument_comprehensive_earnings_quarterly');
  const b=bars(t),dailyClose=b.at(-1)?.close,spot=positive(qt.price,dailyClose);if(!spot)throw new Error(`${t}: no price`);
  const trailing52=b.slice(-252),low52=trailing52.length?Math.min(...trailing52.map(x=>x.low)):null,high52=trailing52.length?Math.max(...trailing52.map(x=>x.high)):null;
  const closes=b.map(x=>x.close),atr=positive(atrFromBars(b))??Math.max(spot*.04,1),ema20=positive(ema(closes.slice(-120),20))??dailyClose,ema50=positive(ema(closes.slice(-220),50))??dailyClose,ema200=positive(ema(closes,200))??dailyClose,rsi14=positive(rsiFromBars(b))??50;
  const derived=structuralLevels(b,spot),mcpSupports=levels(sr.supports).filter(x=>x<spot&&x>spot*.80).sort((a,b)=>b-a),mcpResistances=levels(sr.resistances).filter(x=>x>spot&&x<spot*1.30).sort((a,b)=>a-b);
  const supports=derived.supports.length?derived.supports:mcpSupports,resistances=derived.resistances.length?derived.resistances:mcpResistances;
  const rows15=intradayRows(items),rthRows=rows15.filter(x=>String(x.time).startsWith(DATE)&&x.volume>0),opening=rthRows[0]||null,quoteTime=String(qt.timestamp||qt.fetchedAt||REFRESHED);
  const nearestSupport=supports.find(x=>x>=spot*.88),nearestResistance=resistances.find(x=>x<=spot*1.20);
  const extended=(spot/ema20-1)>.055||rsi14>72;
  const entry=opening?opening.high:(nearestResistance||spot);
  const structuralStop=Math.min(opening?.low??entry-atr,nearestSupport&&nearestSupport<entry?nearestSupport:entry-atr*.75);
  const riskDistance=clamp(entry-structuralStop,atr*.60,atr*2),stop=Math.max(.01,entry-riskDistance);
  const rrCandidates=resistances.filter(x=>x>=entry+riskDistance*1.5&&x<=entry+riskDistance*4);
  const tp1=rrCandidates.find(x=>x<=entry+riskDistance*2.5)||entry+riskDistance*1.6;
  const secondResistance=rrCandidates.find(x=>x>tp1&&x>=entry+riskDistance*2);
  const tp2=secondResistance||Math.max(tp1+riskDistance*.7,entry+riskDistance*2.3);
  const eventDate=cal.nextEarningsDate?String(cal.nextEarningsDate).slice(0,10):null;
  const daysToEvent=eventDate?Math.round((new Date(eventDate)-new Date(DATE))/86400000):null;
  let state=extended||spot>entry*1.03?'pending':'watch';
  if(daysToEvent!==null&&daysToEvent>=0&&daysToEvent<=7)state='pending';
  const manualEventVeto=t==='ORCL'&&daysToEvent!==null&&daysToEvent>=0&&daysToEvent<=14;
  const filingDataVeto=t==='IREN';
  if(manualEventVeto||filingDataVeto)state='pending';
  const calendarVeto=t==='ALLR'&&!eventDate;
  if(calendarVeto)state='pending';
  if(!opening)state='pending';
  const eventVeto=(daysToEvent!==null&&daysToEvent>=0&&daysToEvent<=7)||manualEventVeto;
  const status=filingDataVeto?'Filing-data veto: the August annual results supersede stale aggregator fields; levels remain inactive until the financial bundle is reconciled.':eventVeto?`Event veto: earnings are scheduled for ${eventDate}; the displayed levels are inactive until a post-release review.`:calendarVeto?'Calendar veto: the next earnings date is not confirmed; levels remain inactive.':!opening?`No regular-session opening bar was captured; levels remain inactive.`:extended||spot>entry*1.03?`Wait. Activation requires a completed 15-minute close back above ${px(entry)} with non-zero regular-session volume.`:`Watch ${px(entry)}: activation requires a completed 15-minute close above it with non-zero regular-session volume.`;

  const reviewed=secRecord?.reviewed||[],extraReviewed=EXTRA_FILINGS[t]?[EXTRA_FILINGS[t]]:[],reviewedForDisplay=[...reviewed,...extraReviewed],filings=(secRecord?.filings||[]).slice(0,10);
  const agg=reviewed.reduce((a,x)=>{for(const[k,v]of Object.entries(x.review?.flags||{}))a[k]=a[k]||v;return a;},{});
  const offeringReviewed=reviewed.filter(x=>/^424B/.test(x.form));
  const offeringAgg=offeringReviewed.reduce((a,x)=>{for(const[k,v]of Object.entries(x.review?.flags||{}))a[k]=a[k]||v;return a;},{});
  const suppressGenericCapital=SUPPRESS_GENERIC_CAPITAL_FLAGS.has(t);
  const equityProspectus=reviewed.some(x=>/^424B/.test(x.form)&&x.review?.offeringType==='equity');
  const small=(qt.marketCap||Infinity)<10e9,lossmaking=(fn.profitMargins||0)<0;
  let dilutionRisk=secRecord?.error?'unknown':(offeringAgg.atm||equityProspectus||(!suppressGenericCapital&&offeringAgg.warrants))?(small||lossmaking?'high':'moderate'):agg.stockComp?'moderate':'low';
  if(t==='SMCI')dilutionRisk='high';
  const atmConclusion=offeringAgg.atm?'ATM/sales-agreement language was detected in a prospectus supplement. ':offeringReviewed.length?'No ATM program was established by the reviewed prospectus supplements. ':'No prospectus supplement was reviewed, so no ATM conclusion is inferred. ';
  const secSummary=secRecord?.error?'SEC issuer mapping failed; the dossier is not eligible for an active trade.':`${reviewedForDisplay.length} primary document(s) opened from official EDGAR. ${atmConclusion}${!suppressGenericCapital&&offeringAgg.warrants?'Active warrant language was detected in a prospectus supplement. ':''}${!suppressGenericCapital&&offeringAgg.convertibles?'Convertible language was detected in a prospectus supplement. ':''}${agg.materialWeakness?'Affirmative material-weakness language was detected. ':''}A registration statement alone is not treated as an issuance.`;
  if(secRecord?.error)state='pending';

  const valuation=load(path.join(ROOT,'analyses',t,'_data','valuation.json')),board=load(path.join(ROOT,'analyses',t,'_data','quality-board.json'));
  const scoreParts={base:55,growth:0,grossMargin:0,operatingMargin:0,earningsGrowth:0,roe:0,balanceSheet:0,qualityBoard:0,capitalStructure:0,controls:0};
  const revenueGrowth=num(fn.revenueGrowth),grossMargin=num(fn.grossMargins),operatingMargin=num(fn.operatingMargins),earningsGrowth=num(fn.earningsGrowth),roe=num(fn.returnOnEquity);
  scoreParts.growth=revenueGrowth===null?0:revenueGrowth>.30?14:revenueGrowth>.20?11:revenueGrowth>.10?7:revenueGrowth>0?3:-7;
  scoreParts.grossMargin=grossMargin===null?0:grossMargin>.70?8:grossMargin>.40?4:grossMargin>.20?2:-2;
  scoreParts.operatingMargin=operatingMargin===null?0:operatingMargin>.20?8:operatingMargin>0?5:operatingMargin>-.10?1:-6;
  scoreParts.earningsGrowth=earningsGrowth!==null&&earningsGrowth>.20?5:earningsGrowth!==null&&earningsGrowth<-.20?-3:0;
  scoreParts.roe=roe!==null&&roe>.15?5:0;
  if(!['power','crypto','metals'].includes(ROLE[t]))scoreParts.balanceSheet=(fn.totalCash||0)>(fn.totalDebt||0)?4:(fn.totalDebt||0)>3*(fn.totalCash||1)?-4:0;
  scoreParts.qualityBoard=board.signal==='bullish'?6:board.signal==='bearish'?-6:0;
  scoreParts.capitalStructure=dilutionRisk==='low'?4:dilutionRisk==='moderate'?-1:dilutionRisk==='high'?-9:-12;
  scoreParts.controls=agg.materialWeakness?-8:0;
  let score=Object.values(scoreParts).reduce((a,b)=>a+b,0);
  const aPlusGate=RAISED_GUIDANCE.has(t)&&earnings.length>=5&&earnings.filter(x=>num(x.actual)>num(x.estimate)).length>=5&&positive(qt.forwardPE)!==null&&positive(qt.forwardPE)<35&&(spot/ema20-1)<=.03;
  const gradeCaps={OKTA:71,DDOG:77,ORCL:77,SNPS:71,AMKR:65,TTMI:71,VICR:77,ANET:83,SMCI:65,NBIS:59,CORZ:59,BE:71,GEV:71,BMNR:59,SBET:41,AG:83,EQX:83,LPLA:83,STRL:83,RZLV:41};
  score=clamp(Math.round(score),20,Math.min(aPlusGate?92:89,gradeCaps[t]||99));
  const g=grade(score),copy=COPY[ROLE[t]],sip=positive(si.percentOfFloat,st.shortPercentOfFloat),siScale=sip!==null&&sip>1?1:100;
  const insiderRows=csv(ins.recent_trades).slice(0,8);
  const event=EVENT_OVERRIDES[t]||EVENT_FACTS[t]||null,roleDetail=ROLE_DETAILS[t]||copy.thesis;
  const anchorFact=['hardware','infrastructure','power'].includes(ROLE[t])?'NVIDIA anchor: Q2 FY27 revenue was $96.2B, Data Center revenue was $89.0B and Q3 revenue guidance was $108.0B +/-2%.':ROLE[t]==='cyber'?'Cyber anchor: CrowdStrike reported $1.47B revenue, $5.84B ARR and $332.8M net-new ARR.':ROLE[t]==='software'?'Software anchor: Salesforce reported $11.3B revenue, $33.5B cRPO and about $3.9B of Agentforce plus Data 360 ARR.':null;
  const anchorSource=['hardware','infrastructure','power'].includes(ROLE[t])?EVENT_FACTS.NVDA:ROLE[t]==='cyber'?EVENT_FACTS.CRWD:ROLE[t]==='software'?EVENT_FACTS.CRM:null;
  const refs=reviewedForDisplay.slice(0,6).map(f=>({name:`${f.form}: ${f.accession}`,url:f.url,date:f.date}));
  if(event)refs.unshift({name:'Official earnings exhibit 99.1',url:event.url,date:event.date||'2026-08-26'});
  const firstCapitalAccession=reviewed.find(f=>/^424B/.test(f.form))?.accession;
  const triggerRr=(tp1-entry)/(entry-stop);
  const companyRisk=RISK_OVERRIDES[t]||event?.risk||copy.bear;
  const capitalPoints=[secSummary,...(SEC_NOTES[t]?[SEC_NOTES[t]]:[]),agg.goingConcern&&t!=='NBIS'?'Going-concern language appears in a reviewed filing.':'No current going-concern conclusion is inferred.',dilutionRisk==='high'?(SEC_NOTES[t]?'Financing terms are quantified above and keep activation conservative.':'Financing/dilution risk requires direct term sizing before entry.'):'No unquantified issuance amount is invented.'];
  const riskScore=clamp(4+(dilutionRisk==='high'?3:dilutionRisk==='moderate'?1:0)+((st.beta||0)>1.6?1:0)+(lossmaking?1:0)+(extended?1:0),2,10);
  const scoreRationale=Object.entries(scoreParts).map(([k,v])=>`${k} ${v>=0?'+':''}${v}`).join(', ')+`; capped score ${score}/100`;
  const eventRows=event?event.metrics.map((v,i)=>({metric:i===0?'Latest earnings':'Earnings KPI',value:v,signal:'Official Exhibit 99.1',signalColor:'blue'})):[];
  const specialRows=t==='IREN'?[{metric:'FY26 filing override',value:'Revenue $707M; impairment $638.8M',signal:'Official August 2026 annual results supersede aggregator',signalColor:'amber'},{metric:'Restricted cash',value:'$1.724B',signal:'Separate from $5.896B cash',signalColor:'amber'}]:[];
  const directEarnings=t==='SNPS'?[{quarter:'2026-07-31',epsActual:2.84,epsEstimate:null,surprise:'Official Q3 FY26 GAAP; estimate N/A'}]:t==='MRVL'?[{quarter:'2026-08-01',epsActual:.33,epsEstimate:null,surprise:'Official Q2 FY27 GAAP; estimate N/A'}]:[];
  const marginKnown=num(fn.profitMargins)!==null&&num(fn.profitMargins)!==0;
  const positiveCase=[roleDetail,`Revenue growth ${pct(fn.revenueGrowth)}${marginKnown&&num(fn.profitMargins)>0?`; net margin ${pct(fn.profitMargins)}`:''}`,opening?`Single activation ${px(entry)}, structural stop ${px(stop)}, TP1 ${px(tp1)}`:'No active entry: current-session RTH confirmation was unavailable at collection time.'];

  return {
    meta:{lang:'en',dir:'ltr',level:'intermediate',tags:['us','equities','ai-chain',ROLE[t],String(pr.sector||'stocks').toLowerCase().replace(/[^a-z0-9]+/g,'-')],grade:g,date:DATE,dateDisplay:'August 28, 2026',version:priorVersion+1,status:state,levelsCloseDate:REFDATE,lastMcpRefresh:REFRESHED,description:`${t}: individual ${copy.theme.toLowerCase()} dossier with official SEC review and actionable trade state.`,ogDescription:`${t}: fundamentals, SEC filings, technical structure, risks and trade levels.`},
    header:{ticker:t,name:md.shortName||md.name||t,exchange:md.exchange||'US',sector:pr.sector||'Unclassified',price:spot,changePct:(num(qt.changePercent)||0)*100,badges:[{text:copy.theme,color:'blue'},{text:state.toUpperCase(),color:state==='watch'?'blue':'amber'}],metrics:{marketCap:money(qt.marketCap),volume:qty(qt.volume),fwdPE:positive(qt.forwardPE)===null?'N/A':positive(qt.forwardPE).toFixed(1)+'x',beta:num(st.beta)||0,range52w:low52!==null&&high52!==null?`${px(low52)} – ${px(high52)}`:'N/A',shortInterest:pct(sip,siScale),analystTarget:positive(fn.targetMeanPrice)===null?'N/A':px(fn.targetMeanPrice),evEbitda:positive(st.enterpriseToEbitda)===null?'N/A':positive(st.enterpriseToEbitda).toFixed(1)+'x'},halal:sh.status==='compliant',halalStatus:sh.status==='compliant'?'halal':sh.status==='non-compliant'?'non-halal':'unknown'},
    verdict:{score,conviction:gradeColor(score),bias:state==='watch'?'Bullish':'Neutral',confidence:'Moderate confidence',summary:`${event?event.summary+' ':''}${roleDetail} ${status} Quote timestamp: ${quoteTime}. Daily indicators end at ${REFDATE}.`,whyBuy:positiveCase,whyAvoid:[companyRisk,status,...capitalPoints.slice(0,2)]},
    business:{overview:`<p><strong>Transmission channel:</strong> ${roleDetail}</p>${anchorFact?`<p><strong>Post-earnings anchor:</strong> ${anchorFact}</p>`:''}<p>${String(pr.longBusinessSummary||(md.name||t)+' operates in '+(pr.industry||pr.sector||'its reported market')+'.').replace(/\bseamless\b/gi,'integrated')}</p>`,moat:`Quality credit comes from reported growth, margins, balance-sheet capacity and the deterministic board; the AI label itself earns no points.`,theme:copy.theme},
    news:news(t,md.shortName||md.name||t),
    fundamentals:{rows:[...eventRows,...specialRows,
      {metric:'Revenue (TTM)',value:money(fn.totalRevenue),signal:pct(fn.revenueGrowth)+' YoY',signalColor:(fn.revenueGrowth||0)>=0?'green':'red'},
      {metric:'EBITDA',value:positive(fn.ebitda)===null?'N/A':money(fn.ebitda),signal:positive(st.enterpriseToEbitda)===null?'Multiple unavailable':positive(st.enterpriseToEbitda).toFixed(1)+'x EV/EBITDA',signalColor:'blue'},
      {metric:'Gross Margin',value:pct(fn.grossMargins),signal:'Reported',signalColor:'blue'},
      {metric:'Operating Margin',value:num(fn.operatingMargins)===null?'N/A':pct(fn.operatingMargins),signal:num(fn.operatingMargins)===null?'Suppressed: source fields mixed periods':(fn.operatingMargins||0)>0?'Profitable':'Loss-making',signalColor:num(fn.operatingMargins)===null?'gray':(fn.operatingMargins||0)>0?'green':'red'},
      {metric:'Net Margin',value:!marginKnown?'N/A':pct(fn.profitMargins),signal:!marginKnown?'Not reliably available':(fn.profitMargins||0)>0?'Positive':'Negative',signalColor:!marginKnown?'gray':(fn.profitMargins||0)>0?'green':'red'},
      {metric:'ROE',value:pct(fn.returnOnEquity),signal:'Capital efficiency',signalColor:(fn.returnOnEquity||0)>=.12?'green':'amber'},
      {metric:'Cash',value:money(fn.totalCash),signal:'Liquidity; sector accounting may limit direct debt netting',signalColor:'green'},
      {metric:'Debt',value:money(fn.totalDebt),signal:'Balance-sheet claim',signalColor:(fn.totalDebt||0)>(fn.totalCash||0)?'amber':'green'},
      {metric:'Intrinsic-value model',value:positive(valuation.modelValue)===null?'N/A':money(valuation.modelValue),signal:positive(valuation.modelValue)===null?'Fail-closed: insufficient or non-economic output':`${valuation.signal||'neutral'} / confidence ${valuation.confidence||0}`,signalColor:valuation.signal==='bullish'?'green':valuation.signal==='bearish'?'red':'gray'},
      {metric:'Value / quality panel',value:`${board.tally?.bullish||0} positive / ${board.tally?.bearish||0} negative / ${board.tally?.neutral||0} neutral`,signal:`${board.signal||'neutral'} / confidence ${board.confidence||0}`,signalColor:board.signal==='bullish'?'green':board.signal==='bearish'?'red':'gray'},
      {metric:'Fundamental grade audit',value:`${score}/100 (${g})`,signal:scoreRationale,signalColor:score>=72?'green':score>=54?'amber':'red'}
    ],sourceRefs:refs},
    earnings:{quarters:[...directEarnings,...earnings.slice(0,4-directEarnings.length).map(x=>({quarter:String(x.date).slice(0,10),epsActual:num(x.actual)||0,epsEstimate:num(x.estimate)||0,surprise:num(x.actual)!==null&&num(x.estimate)?(((num(x.actual)-num(x.estimate))/Math.abs(num(x.estimate)))*100).toFixed(1)+'%':'N/A'}))],beatStreak:earnings.filter(x=>num(x.actual)>num(x.estimate)).length,beatNote:`Official latest release is shown first where the structured feed lagged; ${earnings.filter(x=>num(x.actual)>num(x.estimate)).length}/${earnings.length} captured feed quarters beat estimates.`,nextEarnings:eventDate||'Not confirmed'},
    insiders:{insiderPct:pct(ho.insidersPercent,1),institutionPct:pct(ho.institutionsPercent,1),recentTransactions:insiderRows.map(x=>({date:x.date,insider:x.insider,type:/purchase|buy/i.test(x.type)?'buy':/sale|sell/i.test(x.type)?'sell':'grant',shares:qty(x.shares),value:num(x.shares)!==null&&num(x.price)!==null?money(num(x.shares)*num(x.price)):'N/A'})),signal:insiderRows.length?'Structured transactions shown; grants and sales are not treated as thesis confirmation.':'No structured transaction table was captured.',sourceRefs:refs},
    capitalStructure:{sharesOutstanding:qty(positive(st.sharesOutstanding)??(positive(qt.marketCap)&&spot?qt.marketCap/spot:null)),sharesAuthorized:'See filing review',dilutionRisk,shareHistory:secSummary,sourceRefs:refs},
    filingsReview:{summary:`${Math.max(filings.length,reviewedForDisplay.length)} relevant SEC filing(s) were inventoried and ${reviewedForDisplay.length} primary document(s) were opened. Grade ${g} measures fundamental quality; trade state ${state} measures timing.`,filings:reviewedForDisplay.map(f=>({date:f.date,form:f.form,accession:f.accession,finding:FILING_NOTES[t]?.[f.accession]||((SEC_NOTES[t]&&f.accession===firstCapitalAccession)?SEC_NOTES[t]:f.finding||filingFinding(f)),url:f.url})),contrarianRisks:[companyRisk,...capitalPoints]},
    shortInterest:{siPct:pct(sip,siScale),daysToCover:num(si.daysToCover)!==null?num(si.daysToCover).toFixed(2):num(st.shortRatio)!==null?num(st.shortRatio).toFixed(2):'N/A',ctb:positive(si.costToBorrow)===null?'N/A':pct(si.costToBorrow,si.costToBorrow>1?1:100),trend:`${t} point-in-time short-interest context only; no acceleration claim without a comparable dated series.`,squeezeScore:'Context only',sourceRefs:refs},
    options:{callOI:qty(mp.totalCallOI),putOI:qty(mp.totalPutOI),cpRatio:num(mp.callPutRatio)===null?'N/A':num(mp.callPutRatio).toFixed(2),maxPain:px(mp.maxPainStrike),ivMean:'N/A',skew:num(ov.put_call_volume_ratio)===null?'N/A':`Put/call volume ${num(ov.put_call_volume_ratio).toFixed(2)}`,unusual:ov.unusual_activity?'Unusual activity detected':'No unusual activity confirmed',sourceRefs:refs},
    technicals:{rsi14,...(num(te.macd)!==null?{macd:num(te.macd)}:{}),...(num(te.signal)!==null?{macdSignal:num(te.signal)}:{}),ema20,ema50,ema200,ma50Type:'EMA',ma200Type:'EMA',ma50Available:b.length>=50,ma200Available:b.length>=200,atr14:atr,badges:[`RSI ${rsi14.toFixed(1)}`,state.toUpperCase(),copy.theme],supports:supports.slice(0,3),resistances:resistances.slice(0,3),setupNote:`${status} Quote ${px(spot)} is timestamped ${quoteTime}. ${opening?`Activation ${px(entry)} and stop ${px(stop)} use the observed regular-session opening range (${opening.time}, high ${px(opening.high)}, low ${px(opening.low)}) plus ATR.`:`Displayed geometry is a dormant structural reference only; no current-session RTH opening range was available, so it is not an executable setup.`} EMA, ATR, RSI and structural pivots use daily bars closed through ${REFDATE}.`,wyckoff:'Transitional',radarValues:{rsi:clamp(Math.round(100-Math.abs(rsi14-55)*2),0,100),trend:spot>ema20?70:40,volume:clamp(Math.round((qt.volume||0)/1e6*10),10,100),momentum:extended?75:55,volatility:clamp(Math.round(atr/spot*1000),10,100),support:entry>=spot*.97?70:40},sourceRefs:refs},
    macro:{indicators:[{name:'Reference close',value:REFDATE,signal:'Daily structure is point-in-time controlled'},{name:'Quote snapshot',value:quoteTime,signal:'Exact timestamp; not represented as a publication-time live quote'},{name:'Opening observation',value:opening?.time||'Unavailable',signal:'Regular-session range used for the single activation level'}],regime:'risk-on',impact:`${anchorFact?anchorFact+' ':''}Company filings and entry geometry override the sector label.`,sourceRefs:[{name:'AI-chain daily article',url:'/daily/20260827/',date:'2026-08-27'},...(anchorSource?[{name:'Official earnings Exhibit 99.1',url:anchorSource.url,date:'2026-08-26'}]:[])]},
    risks:{riskScore,riskProfile:riskScore>=7?'High':riskScore>=5?'Moderate':'Low',riskSummary:`Dilution ${dilutionRisk}; beta ${num(st.beta)===null?'N/A':num(st.beta).toFixed(2)}; trade state ${state}.`,riskCards:[
      {title:'Trade Geometry',severity:triggerRr<1.5?'high':'medium',icon:'fa-chart-line',points:[`R/R from the single ${px(entry)} activation to TP1 is ${triggerRr.toFixed(2)}R`,status],probability:triggerRr<1.5?65:45,impact:70,verdict:triggerRr<1.5?'Inactive: the first reachable target does not pay for risk.':'Activation requires a completed 15-minute close and non-zero regular-session volume.'},
      {title:'Capital and SEC',severity:dilutionRisk==='high'?'high':dilutionRisk==='moderate'?'medium':'low',icon:'fa-coins',points:capitalPoints,probability:dilutionRisk==='high'?75:dilutionRisk==='moderate'?50:25,impact:dilutionRisk==='high'?80:45,verdict:`Official filing review rates dilution risk ${dilutionRisk}.`},
      {title:'Thesis Failure',severity:'medium',icon:'fa-link-slash',points:[companyRisk,roleDetail],probability:50,impact:65,verdict:'Require company-specific confirmation, not group sympathy.'}
    ],pedagogy:'A real economic link to AI, power, crypto or metals does not guarantee a good entry. The setup must pay for normal volatility and company-specific risk.',riskRadarValues:{dilution:dilutionRisk==='high'?90:dilutionRisk==='moderate'?55:20,burnRate:lossmaking?80:25,beta:clamp(Math.round((st.beta||1)*45),10,100),shortInterest:clamp(Math.round((sip||0)*500),5,100),insiderSelling:ins.net_activity==='bearish'?75:30,macroRisk:50},sourceRefs:refs},
    social:{platforms:[{platform:'Stocktwits',icon:'fa-solid fa-comments',mentions:String(sw.messageCount||'N/A'),trend:sw.sentimentLabel||'unavailable',trendColor:sw.sentimentLabel==='positive'?'green':sw.sentimentLabel==='negative'?'red':'gray',detail:`${sw.watchers||'N/A'} watchers; not used as a trigger.`},{platform:'Aggregate sentiment',icon:'fa-solid fa-satellite-dish',mentions:String(so.sourceCount||'N/A'),trend:so.sentimentLabel||'unavailable',trendColor:'gray',detail:`Confidence ${pct(so.confidence)}.`}],pumpDumpScore:clamp((small?2:0)+(dilutionRisk==='high'?2:0)+((sip||0)>.2?2:0),0,6),pumpDumpChecklist:[{criterion:'SEC issuer mapping complete',pass:!secRecord?.error},{criterion:'Short interest below 20%',pass:(sip||0)<=.2},{criterion:`SEC-reviewed dilution risk is ${dilutionRisk}`,pass:dilutionRisk==='low'}],sourceRefs:refs},
    performance:{ytd:num(ytd(b))===null?'N/A':ytd(b).toFixed(1)+'%',oneYear:b.length<230?'N/A — insufficient one-year history':performance(b,365).toFixed(1)+'%',threeYear:'N/A — insufficient aligned history',benchmarks:[],alpha:'Not calculated without aligned benchmark bars.',sourceRefs:refs},
    capitalFlow:{netFlow:'N/A',institutionalFlow:'N/A',retailFlow:'N/A',darkPoolPct:num(dp.percentVolume)===null?'N/A':pct(dp.percentVolume,dp.percentVolume>1?1:100),signal:`${t}: directional flow remains unscored without aligned, dated transaction-level data.`,sourceRefs:refs},
    tradeIdea:{entry:Number(entry.toFixed(4)),entryNote:opening?`Single activation level ${px(entry)} from the observed RTH opening range. Quote snapshot ${px(spot)} at ${quoteTime}. ${status}`:`Dormant structural reference, not an order level. Quote snapshot ${px(spot)} at ${quoteTime}. ${status}`,stop:Number(stop.toFixed(4)),stopPct:`${((stop/entry-1)*100).toFixed(1)}%`,tp1:Number(tp1.toFixed(4)),tp1Pct:`+${((tp1/entry-1)*100).toFixed(1)}%`,tp2:Number(tp2.toFixed(4)),tp2Pct:`+${((tp2/entry-1)*100).toFixed(1)}%`,rr:`1:${((tp1-entry)/(entry-stop)).toFixed(2)} to TP1 / 1:${((tp2-entry)/(entry-stop)).toFixed(2)} to TP2`,horizon:'10 trading sessions after activation',thesis:`${event?event.summary+' ':''}${roleDetail} ${status}`,catalysts:[copy.theme,opening?'Completed 15-minute close above activation with non-zero RTH volume':'Fresh RTH opening range required before any activation',`Next earnings: ${eventDate||'not confirmed'}`],invalidation:[`Hard stop ${px(stop)} only after a valid activation`,companyRisk,'Any new earnings, regulatory or financing event requires a fresh review.'],status:state,statusNote:status},
    globalScore:{profile:copy.theme,keyTakeawaysPositive:[roleDetail,`Revenue growth: ${pct(fn.revenueGrowth)}`,`Grade audit: ${scoreRationale}`],keyTakeawaysNegative:[companyRisk,...capitalPoints.slice(0,2)],mindsetTip:`For ${t}, grade ${g} controls business quality while ${state} controls timing; neither overrides the stated activation and invalidation.`},
    disclaimer:`${t} research snapshot dated ${DATE}, for education rather than personalized advice. Revalidate the quote timestamp, event calendar and activation before acting.`
  };
}

const sec=load(path.join(ROOT,'data','analyses-data','_ai-chain-sec.json'));
const secMap=new Map((sec.records||[]).map(x=>[x.ticker,x]));
const editorialOverrides=loadEditorialOverrides();
const tradeOverrides=loadGroupedOverrides(TRADE_OVERRIDE_DIR,'trade');
const gradeOverrides=loadGroupedOverrides(GRADE_OVERRIDE_DIR,'grade');
const editorialOnly=process.argv.includes('--editorial-only');
const headBaseline=process.argv.includes('--head-baseline');
if(headBaseline&&!editorialOnly)throw new Error('--head-baseline requires --editorial-only');
const requested=process.argv.slice(2).filter(x=>!x.startsWith('--')).map(x=>x.toUpperCase());
const tickers=requested.length?requested:Object.keys(ROLE);
for(const t of tickers){
  if(!ROLE[t])throw new Error(`Unknown AI-chain ticker ${t}`);
  const out=path.join(ROOT,'data','analyses-data',`${t}.json`);
  const prior=headBaseline?JSON.parse(execFileSync('git',['show',`HEAD:data/analyses-data/${t}.json`],{cwd:ROOT,encoding:'utf8'})):load(out);
  const sameBatch=prior.meta?.date===DATE&&Array.isArray(prior.meta?.tags)&&prior.meta.tags.includes('ai-chain');
  const priorVersion=sameBatch?Math.max(0,(Number(prior.meta?.version)||1)-1):(Number(prior.meta?.version)||0);
  if(editorialOnly&&!prior.meta)throw new Error(`${t}: existing validated dossier is required for --editorial-only`);
  if(editorialOnly&&!editorialOverrides[t])throw new Error(`${t}: editorial override is required for --editorial-only`);
  const base=editorialOnly?prior:build(t,secMap.get(t)||{ticker:t,error:'SEC batch record missing'},priorVersion);
  const data=applyTradeOverride(applyEditorialOverride(applyGradeOverride(base,gradeOverrides[t]),editorialOverrides[t]),tradeOverrides[t]);
  const lifecycle=data.tradeIdea?.status;
  if(lifecycle&&data.globalScore?.mindsetTip){
    data.globalScore.mindsetTip=data.globalScore.mindsetTip.replace(/Current trade state: (?:pending|watch|wait|rejected)\./i,`Current trade state: ${lifecycle}.`);
  }
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');
  console.log(`[ai-chain] ${t}: ${data.meta.grade} ${data.verdict.score} / ${data.tradeIdea.status} / dilution ${data.capitalStructure.dilutionRisk}`);
}
