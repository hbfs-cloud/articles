'use strict';
const fs=require('fs');
const {simulate}=require('./simulate.js');
const B=JSON.parse(fs.readFileSync('bt-bars.json','utf8'));
const ROWS=JSON.parse(fs.readFileSync('bt-rows.json','utf8'));
const BAND=parseFloat(process.argv[2]||'0.006');

const r2=x=>Math.round(x*100)/100;
const ema=(v,n)=>{const k=2/(n+1);let e=v.slice(0,n).reduce((a,b)=>a+b,0)/n;for(let i=n;i<v.length;i++)e=v[i]*k+e*(1-k);return e};
function atr14(b){const tr=[];for(let i=1;i<b.length;i++)tr.push(Math.max(b[i].h-b[i].l,Math.abs(b[i].h-b[i-1].c),Math.abs(b[i].l-b[i-1].c)));
  let a=tr.slice(0,14).reduce((x,y)=>x+y,0)/14;for(let i=14;i<tr.length;i++)a=(a*13+tr[i])/14;return a}
function piv(b,N,dir){const p=[];for(let i=N;i<b.length-N;i++){let ok=true;
  for(let k=i-N;k<=i+N;k++){if(k===i)continue;if(dir>0?b[k].h>=b[i].h:b[k].l<=b[i].l){ok=false;break}}
  if(ok)p.push({d:b[i].d,v:dir>0?b[i].h:b[i].l})}return p}

/** Méthode HONNÊTE, telle qu'arrêtée : stop sur structure réelle (creux de swing, MM20, MM50),
 *  le plus proche valide ; cible = première zone d'offre cotée à portée (≤4×ATR) ; sinon
 *  mouvement mesuré en zone vierge avérée. R/R mesuré au HAUT de zone. */
function honest(bars,scanDate){
  const hist=bars.filter(b=>b.d<scanDate);
  if(hist.length<220) return null;
  const c=hist.map(x=>x.c), close=c[c.length-1];
  const e20=ema(c,20),e50=ema(c,50),e200=ema(c,200),A=atr14(hist);
  const eL=close, eH=r2(close*(1+BAND));
  if(e50<=e200||e20<e50||close<e20) return {reject:'structure'};
  const lows=piv(hist,10,-1).filter(p=>p.v<eL);
  let hp=piv(hist,10,1).filter(p=>p.v>eH).sort((a,b)=>a.v-b.v);
  const zones=[];for(const p of hp){if(!zones.length||p.v/zones[zones.length-1].v-1>0.01)zones.push(p)}
  const highs=zones.filter(p=>(p.v-eH)>=A);
  const minD=Math.max(1.5*A,eH*0.03), maxD=eH*0.08;
  const cand=[...lows.map(p=>p.v*0.998)];
  if(e20<eH)cand.push(e20*0.985); if(e50<eH)cand.push(e50*0.998);
  const valid=cand.filter(v=>{const d=eH-v;return d>=minD-1e-9&&d<=maxD}).sort((a,b)=>(eH-a)-(eH-b));
  if(!valid.length) return {reject:'pas de stop structurel'};
  const stop=r2(valid[0]), risk=eH-stop;
  const near=highs.filter(p=>(p.v-eH)<=4*A);
  let tp1,tp2;
  if(near.length){tp1=r2(near[0].v);tp2=near[1]?r2(near[1].v):r2(eH+2*(near[0].v-eH))}
  else{tp1=r2(eH+2.6*A);tp2=r2(eH+4.4*A)}
  const rr=(tp1-eH)/risk;
  if(rr<1.5) return {reject:'R/R '+rr.toFixed(2)};
  return {entry_low:r2(eL),entry_high:eH,stop,tp1,tp2,rr:r2(rr),horizon:10};
}

const res={pub:[],hon:[],rejPub:[]};
let accepted=0, rejected=0;
const iso=d=>/^\d{8}$/.test(d)?d.slice(0,4)+"-"+d.slice(4,6)+"-"+d.slice(6):d;
for(const r0 of ROWS){ const r={...r0, scan: iso(r0.scan)};
  const bars=B[r.ticker]; if(!bars)continue;
  const p=simulate(bars,r.scan,{entry_low:r.entry_low,entry_high:r.entry,stop:r.stop,tp1:r.tp1,horizon:r.horizon});
  const h=honest(bars,r.scan);
  if(h&&!h.reject){
    accepted++;
    const hs=simulate(bars,r.scan,h);
    res.hon.push({...r,sim:hs,lv:h});
  } else { rejected++; if(p.r!==undefined) res.rejPub.push({...r,sim:p}); }
  if(p.r!==undefined||p.status==='EN_COURS'||p.status==='NON_REMPLI') res.pub.push({...r,sim:p});
}
const st=a=>{
  const done=a.filter(x=>x.sim.r!==undefined);
  if(!done.length) return {n:0};
  const R=done.map(x=>x.sim.r);
  const wins=done.filter(x=>x.sim.r>0).length;
  const m=R.reduce((x,y)=>x+y,0)/R.length;
  const tp=done.filter(x=>x.sim.status==='TP1').length, sl=done.filter(x=>x.sim.status==='STOP').length;
  const gap=done.filter(x=>x.sim.gapped).length;
  return {n:done.length,wr:Math.round(wins/done.length*1000)/10,exp:Math.round(m*1000)/1000,
    tp1:tp,stop:sl,horizon:done.length-tp-sl,gapped:gap,
    nonRempli:a.filter(x=>x.sim.status==='NON_REMPLI').length,
    enCours:a.filter(x=>x.sim.status==='EN_COURS').length};
};
console.log('\n════ BACKTEST 30 JOURS — bande d\'entrée '+(BAND*100).toFixed(1)+'% ════');
console.log('  '+ROWS.length+' lignes éditoriales publiées, 21 scans, du 10/07 au 07/08\n');
const P=st(res.pub), H=st(res.hon), RJ=st(res.rejPub);
const fmt=(lbl,s)=>console.log('  '+lbl.padEnd(38)+'n='+String(s.n).padEnd(5)+'WR '+String(s.wr??'—').padEnd(7)+'espérance '+String(s.exp??'—').padEnd(9)+'TP1 '+s.tp1+' / stop '+s.stop+' / horizon '+s.horizon+(s.gapped?'  (dont '+s.gapped+' sorties en écart)':''));
fmt('PUBLIÉ (méthode actuelle)',P);
fmt('HONNÊTE — lignes acceptées',H);
fmt('REJETÉ par la méthode honnête',RJ);
console.log('\n  filtre : '+accepted+' acceptées / '+rejected+' rejetées sur '+ROWS.length);
console.log('  non remplies : publié '+P.nonRempli+' | honnête '+H.nonRempli);
console.log('  encore en cours : publié '+P.enCours+' | honnête '+H.enCours);
fs.writeFileSync('bt-out-'+BAND+'.json',JSON.stringify(res,null,1));
