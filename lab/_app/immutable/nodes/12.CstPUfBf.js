import{s as Ut,d as _,i as u,a as nt,b as C,c as $e,e as c,h as Vt,f as j,g as Ge,j as he,k as v,l as Q,m as Ft,n as Ot,o as jt,p as Qt,q as Gt,x as Yt,t as ze,u as Ue,v as ye,w as Kt}from"../chunks/scheduler.DUeqUKQe.js";import{S as Wt,i as Xt,d as g,t as $,a as p,c as Ne,m as y,b as k,e as T,g as xe}from"../chunks/index.CVl63dJC.js";import{D as mt,e as Jt,s as Zt,Q as Be,p as er,c as Ct,C as A,a as Dt,r as Mt,b as tr}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.bnRE_UwI.js";import{w as rr}from"../chunks/entry.D0Bk6KXv.js";import{A as ir,B as Qe,L as We,Q as Ve}from"../chunks/BigValue.0kiTwXtZ.js";import{h as le,p as ar}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{D as lr,a as Bt}from"../chunks/Dropdown.B0Q0ZFA7.js";import{p as nr}from"../chunks/stores.BK-KNejn.js";import{B as sr}from"../chunks/BarChart.jQu-dQ_N.js";import{S as or}from"../chunks/ScatterPlot.BxBbfADR.js";function Ht(o,r,i){const t=o.slice();return t[54]=r[i],t}function fr(o){let r,i=H.title+"",t;return{c(){r=Q("h1"),t=Ue(i),this.h()},l(f){r=j(f,"H1",{class:!0});var m=Kt(r);t=ze(m,i),m.forEach(_),this.h()},h(){C(r,"class","title")},m(f,m){u(f,r,m),nt(r,t)},p:ye,d(f){f&&_(r)}}}function mr(o){return{c(){this.h()},l(r){this.h()},h(){document.title="Evidence"},m:ye,p:ye,d:ye}}function _r(o){let r,i,t,f,m;return document.title=r=H.title,{c(){i=v(),t=Q("meta"),f=v(),m=Q("meta"),this.h()},l(a){i=c(a),t=j(a,"META",{property:!0,content:!0}),f=c(a),m=j(a,"META",{name:!0,content:!0}),this.h()},h(){var a,w;C(t,"property","og:title"),C(t,"content",((a=H.og)==null?void 0:a.title)??H.title),C(m,"name","twitter:title"),C(m,"content",((w=H.og)==null?void 0:w.title)??H.title)},m(a,w){u(a,i,w),u(a,t,w),u(a,f,w),u(a,m,w)},p(a,w){w&0&&r!==(r=H.title)&&(document.title=r)},d(a){a&&(_(i),_(t),_(f),_(m))}}}function ur(o){var m;let r,i,t=dr(),f=((m=H.og)==null?void 0:m.image)&&pr();return{c(){t&&t.c(),r=v(),f&&f.c(),i=Ge()},l(a){t&&t.l(a),r=c(a),f&&f.l(a),i=Ge()},m(a,w){t&&t.m(a,w),u(a,r,w),f&&f.m(a,w),u(a,i,w)},p(a,w){var b;t.p(a,w),(b=H.og)!=null&&b.image&&f.p(a,w)},d(a){a&&(_(r),_(i)),t&&t.d(a),f&&f.d(a)}}}function dr(o){let r,i,t,f,m;return{c(){r=Q("meta"),i=v(),t=Q("meta"),f=v(),m=Q("meta"),this.h()},l(a){r=j(a,"META",{name:!0,content:!0}),i=c(a),t=j(a,"META",{property:!0,content:!0}),f=c(a),m=j(a,"META",{name:!0,content:!0}),this.h()},h(){var a,w;C(r,"name","description"),C(r,"content",H.description),C(t,"property","og:description"),C(t,"content",((a=H.og)==null?void 0:a.description)??H.description),C(m,"name","twitter:description"),C(m,"content",((w=H.og)==null?void 0:w.description)??H.description)},m(a,w){u(a,r,w),u(a,i,w),u(a,t,w),u(a,f,w),u(a,m,w)},p:ye,d(a){a&&(_(r),_(i),_(t),_(f),_(m))}}}function pr(o){let r,i,t;return{c(){r=Q("meta"),i=v(),t=Q("meta"),this.h()},l(f){r=j(f,"META",{property:!0,content:!0}),i=c(f),t=j(f,"META",{name:!0,content:!0}),this.h()},h(){var f,m;C(r,"property","og:image"),C(r,"content",Dt((f=H.og)==null?void 0:f.image)),C(t,"name","twitter:image"),C(t,"content",Dt((m=H.og)==null?void 0:m.image))},m(f,m){u(f,r,m),u(f,i,m),u(f,t,m)},p:ye,d(f){f&&(_(r),_(i),_(t))}}}function At(o){let r,i;return r=new Ve({props:{queryID:"sector_list_val",queryResult:o[0]}}),{c(){T(r.$$.fragment)},l(t){k(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&1&&(m.queryResult=t[0]),r.$set(m)},i(t){i||(p(r.$$.fragment,t),i=!0)},o(t){$(r.$$.fragment,t),i=!1},d(t){g(r,t)}}}function St(o){let r,i;return r=new Bt({props:{value:o[54].value,valueLabel:o[54].label}}),{c(){T(r.$$.fragment)},l(t){k(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&1&&(m.value=t[54].value),f[0]&1&&(m.valueLabel=t[54].label),r.$set(m)},i(t){i||(p(r.$$.fragment,t),i=!0)},o(t){$(r.$$.fragment,t),i=!1},d(t){g(r,t)}}}function $r(o){let r,i,t,f;r=new Bt({props:{value:"%",valueLabel:"Tous les secteurs"}});let m=Ct(o[0]),a=[];for(let b=0;b<m.length;b+=1)a[b]=St(Ht(o,m,b));const w=b=>$(a[b],1,1,()=>{a[b]=null});return{c(){T(r.$$.fragment),i=v();for(let b=0;b<a.length;b+=1)a[b].c();t=Ge()},l(b){k(r.$$.fragment,b),i=c(b);for(let d=0;d<a.length;d+=1)a[d].l(b);t=Ge()},m(b,d){y(r,b,d),u(b,i,d);for(let R=0;R<a.length;R+=1)a[R]&&a[R].m(b,d);u(b,t,d),f=!0},p(b,d){if(d[0]&1){m=Ct(b[0]);let R;for(R=0;R<m.length;R+=1){const q=Ht(b,m,R);a[R]?(a[R].p(q,d),p(a[R],1)):(a[R]=St(q),a[R].c(),p(a[R],1),a[R].m(t.parentNode,t))}for(xe(),R=m.length;R<a.length;R+=1)w(R);Ne()}},i(b){if(!f){p(r.$$.fragment,b);for(let d=0;d<m.length;d+=1)p(a[d]);f=!0}},o(b){$(r.$$.fragment,b),a=a.filter(Boolean);for(let d=0;d<a.length;d+=1)$(a[d]);f=!1},d(b){b&&(_(i),_(t)),g(r,b),Yt(a,b)}}}function It(o){let r,i;return r=new Ve({props:{queryID:"valuation_summary",queryResult:o[1]}}),{c(){T(r.$$.fragment)},l(t){k(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&2&&(m.queryResult=t[1]),r.$set(m)},i(t){i||(p(r.$$.fragment,t),i=!0)},o(t){$(r.$$.fragment,t),i=!1},d(t){g(r,t)}}}function Lt(o){let r,i;return r=new Ve({props:{queryID:"scatter_pe_div",queryResult:o[2]}}),{c(){T(r.$$.fragment)},l(t){k(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&4&&(m.queryResult=t[2]),r.$set(m)},i(t){i||(p(r.$$.fragment,t),i=!0)},o(t){$(r.$$.fragment,t),i=!1},d(t){g(r,t)}}}function Pt(o){let r,i;return r=new Ve({props:{queryID:"top20_dividends",queryResult:o[3]}}),{c(){T(r.$$.fragment)},l(t){k(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&8&&(m.queryResult=t[3]),r.$set(m)},i(t){i||(p(r.$$.fragment,t),i=!0)},o(t){$(r.$$.fragment,t),i=!1},d(t){g(r,t)}}}function ht(o){let r,i;return r=new Ve({props:{queryID:"valuation_table",queryResult:o[4]}}),{c(){T(r.$$.fragment)},l(t){k(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&16&&(m.queryResult=t[4]),r.$set(m)},i(t){i||(p(r.$$.fragment,t),i=!0)},o(t){$(r.$$.fragment,t),i=!1},d(t){g(r,t)}}}function Nt(o){let r,i;return r=new Ve({props:{queryID:"cheapest_pe",queryResult:o[5]}}),{c(){T(r.$$.fragment)},l(t){k(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&32&&(m.queryResult=t[5]),r.$set(m)},i(t){i||(p(r.$$.fragment,t),i=!0)},o(t){$(r.$$.fragment,t),i=!1},d(t){g(r,t)}}}function xt(o){let r,i;return r=new Ve({props:{queryID:"most_expensive_pe",queryResult:o[6]}}),{c(){T(r.$$.fragment)},l(t){k(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&64&&(m.queryResult=t[6]),r.$set(m)},i(t){i||(p(r.$$.fragment,t),i=!0)},o(t){$(r.$$.fragment,t),i=!1},d(t){g(r,t)}}}function cr(o){let r;return{c(){r=Ue("Comparez les multiples de valorisation (P/E, Price-to-Book) et les rendements en dividendes des plus grandes capitalisations mondiales. Filtrez par secteur pour des comparaisons homogenes.")},l(i){r=ze(i,"Comparez les multiples de valorisation (P/E, Price-to-Book) et les rendements en dividendes des plus grandes capitalisations mondiales. Filtrez par secteur pour des comparaisons homogenes.")},m(i,t){u(i,r,t)},d(i){i&&_(r)}}}function vr(o){let r,i,t,f,m,a,w,b,d,R,q,D;return r=new A({props:{id:"symbol",title:"Ticker"}}),t=new A({props:{id:"name",title:"Nom"}}),m=new A({props:{id:"pe_forward",title:"P/E Forward",fmt:"num1"}}),w=new A({props:{id:"dividend_yield",title:"Div %",fmt:"num1"}}),d=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),q=new A({props:{id:"sector",title:"Secteur"}}),{c(){T(r.$$.fragment),i=v(),T(t.$$.fragment),f=v(),T(m.$$.fragment),a=v(),T(w.$$.fragment),b=v(),T(d.$$.fragment),R=v(),T(q.$$.fragment)},l(n){k(r.$$.fragment,n),i=c(n),k(t.$$.fragment,n),f=c(n),k(m.$$.fragment,n),a=c(n),k(w.$$.fragment,n),b=c(n),k(d.$$.fragment,n),R=c(n),k(q.$$.fragment,n)},m(n,E){y(r,n,E),u(n,i,E),y(t,n,E),u(n,f,E),y(m,n,E),u(n,a,E),y(w,n,E),u(n,b,E),y(d,n,E),u(n,R,E),y(q,n,E),D=!0},p:ye,i(n){D||(p(r.$$.fragment,n),p(t.$$.fragment,n),p(m.$$.fragment,n),p(w.$$.fragment,n),p(d.$$.fragment,n),p(q.$$.fragment,n),D=!0)},o(n){$(r.$$.fragment,n),$(t.$$.fragment,n),$(m.$$.fragment,n),$(w.$$.fragment,n),$(d.$$.fragment,n),$(q.$$.fragment,n),D=!1},d(n){n&&(_(i),_(f),_(a),_(b),_(R)),g(r,n),g(t,n),g(m,n),g(w,n),g(d,n),g(q,n)}}}function wr(o){let r,i,t,f,m,a,w,b,d,R,q,D;return r=new A({props:{id:"symbol",title:"Ticker"}}),t=new A({props:{id:"name",title:"Nom"}}),m=new A({props:{id:"pe_forward",title:"P/E Forward",fmt:"num1"}}),w=new A({props:{id:"dividend_yield",title:"Div %",fmt:"num1"}}),d=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),q=new A({props:{id:"sector",title:"Secteur"}}),{c(){T(r.$$.fragment),i=v(),T(t.$$.fragment),f=v(),T(m.$$.fragment),a=v(),T(w.$$.fragment),b=v(),T(d.$$.fragment),R=v(),T(q.$$.fragment)},l(n){k(r.$$.fragment,n),i=c(n),k(t.$$.fragment,n),f=c(n),k(m.$$.fragment,n),a=c(n),k(w.$$.fragment,n),b=c(n),k(d.$$.fragment,n),R=c(n),k(q.$$.fragment,n)},m(n,E){y(r,n,E),u(n,i,E),y(t,n,E),u(n,f,E),y(m,n,E),u(n,a,E),y(w,n,E),u(n,b,E),y(d,n,E),u(n,R,E),y(q,n,E),D=!0},p:ye,i(n){D||(p(r.$$.fragment,n),p(t.$$.fragment,n),p(m.$$.fragment,n),p(w.$$.fragment,n),p(d.$$.fragment,n),p(q.$$.fragment,n),D=!0)},o(n){$(r.$$.fragment,n),$(t.$$.fragment,n),$(m.$$.fragment,n),$(w.$$.fragment,n),$(d.$$.fragment,n),$(q.$$.fragment,n),D=!1},d(n){n&&(_(i),_(f),_(a),_(b),_(R)),g(r,n),g(t,n),g(m,n),g(w,n),g(d,n),g(q,n)}}}function br(o){let r,i,t,f,m,a,w,b,d,R,q,D,n,E,G,ee,Y,S,K,te,L,ne,I,re,P,O;return r=new A({props:{id:"symbol",title:"Ticker"}}),t=new A({props:{id:"name",title:"Nom"}}),m=new A({props:{id:"price",title:"Prix",fmt:"usd"}}),w=new A({props:{id:"pe_trailing",title:"P/E Trailing",fmt:"num1"}}),d=new A({props:{id:"pe_forward",title:"P/E Forward",fmt:"num1"}}),q=new A({props:{id:"price_to_book",title:"Price/Book",fmt:"num1"}}),n=new A({props:{id:"dividend_yield",title:"Div %",fmt:"num1"}}),G=new A({props:{id:"roe",title:"ROE %",fmt:"num1"}}),Y=new A({props:{id:"roa",title:"ROA %",fmt:"num1"}}),K=new A({props:{id:"target_price",title:"Target",fmt:"usd"}}),L=new A({props:{id:"recommendation",title:"Reco."}}),I=new A({props:{id:"sector",title:"Secteur"}}),P=new A({props:{id:"country",title:"Pays"}}),{c(){T(r.$$.fragment),i=v(),T(t.$$.fragment),f=v(),T(m.$$.fragment),a=v(),T(w.$$.fragment),b=v(),T(d.$$.fragment),R=v(),T(q.$$.fragment),D=v(),T(n.$$.fragment),E=v(),T(G.$$.fragment),ee=v(),T(Y.$$.fragment),S=v(),T(K.$$.fragment),te=v(),T(L.$$.fragment),ne=v(),T(I.$$.fragment),re=v(),T(P.$$.fragment)},l(s){k(r.$$.fragment,s),i=c(s),k(t.$$.fragment,s),f=c(s),k(m.$$.fragment,s),a=c(s),k(w.$$.fragment,s),b=c(s),k(d.$$.fragment,s),R=c(s),k(q.$$.fragment,s),D=c(s),k(n.$$.fragment,s),E=c(s),k(G.$$.fragment,s),ee=c(s),k(Y.$$.fragment,s),S=c(s),k(K.$$.fragment,s),te=c(s),k(L.$$.fragment,s),ne=c(s),k(I.$$.fragment,s),re=c(s),k(P.$$.fragment,s)},m(s,F){y(r,s,F),u(s,i,F),y(t,s,F),u(s,f,F),y(m,s,F),u(s,a,F),y(w,s,F),u(s,b,F),y(d,s,F),u(s,R,F),y(q,s,F),u(s,D,F),y(n,s,F),u(s,E,F),y(G,s,F),u(s,ee,F),y(Y,s,F),u(s,S,F),y(K,s,F),u(s,te,F),y(L,s,F),u(s,ne,F),y(I,s,F),u(s,re,F),y(P,s,F),O=!0},p:ye,i(s){O||(p(r.$$.fragment,s),p(t.$$.fragment,s),p(m.$$.fragment,s),p(w.$$.fragment,s),p(d.$$.fragment,s),p(q.$$.fragment,s),p(n.$$.fragment,s),p(G.$$.fragment,s),p(Y.$$.fragment,s),p(K.$$.fragment,s),p(L.$$.fragment,s),p(I.$$.fragment,s),p(P.$$.fragment,s),O=!0)},o(s){$(r.$$.fragment,s),$(t.$$.fragment,s),$(m.$$.fragment,s),$(w.$$.fragment,s),$(d.$$.fragment,s),$(q.$$.fragment,s),$(n.$$.fragment,s),$(G.$$.fragment,s),$(Y.$$.fragment,s),$(K.$$.fragment,s),$(L.$$.fragment,s),$(I.$$.fragment,s),$(P.$$.fragment,s),O=!1},d(s){s&&(_(i),_(f),_(a),_(b),_(R),_(D),_(E),_(ee),_(S),_(te),_(ne),_(re)),g(r,s),g(t,s),g(m,s),g(w,s),g(d,s),g(q,s),g(n,s),g(G,s),g(Y,s),g(K,s),g(L,s),g(I,s),g(P,s)}}}function gr(o){let r;return{c(){r=Ue("Accueil")},l(i){r=ze(i,"Accueil")},m(i,t){u(i,r,t)},d(i){i&&_(r)}}}function yr(o){let r;return{c(){r=Ue("Explorateur d'Actions")},l(i){r=ze(i,"Explorateur d'Actions")},m(i,t){u(i,r,t)},d(i){i&&_(r)}}}function kr(o){let r;return{c(){r=Ue("Analyse Sectorielle")},l(i){r=ze(i,"Analyse Sectorielle")},m(i,t){u(i,r,t)},d(i){i&&_(r)}}}function Tr(o){let r;return{c(){r=Ue("Analyse Geographique")},l(i){r=ze(i,"Analyse Geographique")},m(i,t){u(i,r,t)},d(i){i&&_(r)}}}function Rr(o){let r;return{c(){r=Ue("Croissance & Rentabilite")},l(i){r=ze(i,"Croissance & Rentabilite")},m(i,t){u(i,r,t)},d(i){i&&_(r)}}}function Er(o){let r,i,t,f,m,a,w="← Retour DailyTickers",b,d,R,q,D,n,E,G,ee,Y,S,K='<a href="#lab-de-valorisation">Lab de Valorisation</a>',te,L,ne,I,re='<a href="#metriques-de-valorisation">Metriques de Valorisation</a>',P,O,s,F,ke,J,oe,ae,Te,fe,Re,Z,me,ie,Oe='<a href="#pe-forward-vs-rendement-en-dividende">P/E Forward vs Rendement en Dividende</a>',Ee,_e,ue,W,qe='<a href="#top-20-rendements-en-dividende">Top 20 Rendements en Dividende</a>',Fe,de,Ce,X,ce='<a href="#les-moins-cheres-pe-forward">Les Moins Cheres (P/E Forward)</a>',ve,pe,De,se,M='<a href="#les-plus-cheres-pe-forward">Les Plus Cheres (P/E Forward)</a>',je,Me,Xe,we,_t='<a href="#tableau-complet-de-valorisation">Tableau Complet de Valorisation</a>',Je,He,Ze,Ye,et,Ae,tt,Se,rt,Ie,it,Le,at,Pe,lt,be=typeof H<"u"&&H.title&&H.hide_title!==!0&&fr();function zt(e,l){return typeof H<"u"&&H.title?_r:mr}let Ke=zt()(o),ge=typeof H=="object"&&ur(),h=o[0]&&At(o);R=new lr({props:{name:"val_sector",title:"Secteur",defaultValue:"%",$$slots:{default:[$r]},$$scope:{ctx:o}}});let N=o[1]&&It(o),x=o[2]&&Lt(o),B=o[3]&&Pt(o),z=o[4]&&ht(o),U=o[5]&&Nt(o),V=o[6]&&xt(o);return L=new ir({props:{status:"info",$$slots:{default:[cr]},$$scope:{ctx:o}}}),O=new Qe({props:{data:o[1],value:"nb_stocks",title:"Actions"}}),F=new Qe({props:{data:o[1],value:"avg_pe_forward",title:"P/E Forward Moy."}}),J=new Qe({props:{data:o[1],value:"avg_pe_trailing",title:"P/E Trailing Moy."}}),ae=new Qe({props:{data:o[1],value:"avg_ptb",title:"Price/Book Moy."}}),fe=new Qe({props:{data:o[1],value:"avg_div_yield",title:"Div Yield Moy. (%)"}}),Z=new Qe({props:{data:o[1],value:"avg_roe",title:"ROE Moy. (%)"}}),_e=new or({props:{data:o[2],x:"pe_forward",y:"dividend_yield",size:"market_cap",series:"sector",xAxisTitle:"P/E Forward",yAxisTitle:"Dividend Yield (%)",title:"Valorisation vs Rendement",tooltipTitle:"symbol"}}),de=new sr({props:{data:o[3],x:"symbol",y:"dividend_yield",xAxisTitle:"Ticker",yAxisTitle:"Dividend Yield (%)",title:"Top 20 Dividend Yields",sort:"false"}}),pe=new mt({props:{data:o[5],rows:"15",$$slots:{default:[vr]},$$scope:{ctx:o}}}),Me=new mt({props:{data:o[6],rows:"15",$$slots:{default:[wr]},$$scope:{ctx:o}}}),He=new mt({props:{data:o[4],search:"true",rows:"20",$$slots:{default:[br]},$$scope:{ctx:o}}}),Ae=new We({props:{url:"/",$$slots:{default:[gr]},$$scope:{ctx:o}}}),Se=new We({props:{url:"/explorer",$$slots:{default:[yr]},$$scope:{ctx:o}}}),Ie=new We({props:{url:"/sectors",$$slots:{default:[kr]},$$scope:{ctx:o}}}),Le=new We({props:{url:"/regions",$$slots:{default:[Tr]},$$scope:{ctx:o}}}),Pe=new We({props:{url:"/earnings",$$slots:{default:[Rr]},$$scope:{ctx:o}}}),{c(){be&&be.c(),r=v(),Ke.c(),i=Q("meta"),t=Q("meta"),ge&&ge.c(),f=Ge(),m=v(),a=Q("a"),a.textContent=w,b=v(),h&&h.c(),d=v(),T(R.$$.fragment),q=v(),N&&N.c(),D=v(),x&&x.c(),n=v(),B&&B.c(),E=v(),z&&z.c(),G=v(),U&&U.c(),ee=v(),V&&V.c(),Y=v(),S=Q("h1"),S.innerHTML=K,te=v(),T(L.$$.fragment),ne=v(),I=Q("h2"),I.innerHTML=re,P=v(),T(O.$$.fragment),s=v(),T(F.$$.fragment),ke=v(),T(J.$$.fragment),oe=v(),T(ae.$$.fragment),Te=v(),T(fe.$$.fragment),Re=v(),T(Z.$$.fragment),me=v(),ie=Q("h2"),ie.innerHTML=Oe,Ee=v(),T(_e.$$.fragment),ue=v(),W=Q("h2"),W.innerHTML=qe,Fe=v(),T(de.$$.fragment),Ce=v(),X=Q("h2"),X.innerHTML=ce,ve=v(),T(pe.$$.fragment),De=v(),se=Q("h2"),se.innerHTML=M,je=v(),T(Me.$$.fragment),Xe=v(),we=Q("h2"),we.innerHTML=_t,Je=v(),T(He.$$.fragment),Ze=v(),Ye=Q("hr"),et=v(),T(Ae.$$.fragment),tt=v(),T(Se.$$.fragment),rt=v(),T(Ie.$$.fragment),it=v(),T(Le.$$.fragment),at=v(),T(Pe.$$.fragment),this.h()},l(e){be&&be.l(e),r=c(e);const l=Vt("svelte-2igo1p",document.head);Ke.l(l),i=j(l,"META",{name:!0,content:!0}),t=j(l,"META",{name:!0,content:!0}),ge&&ge.l(l),f=Ge(),l.forEach(_),m=c(e),a=j(e,"A",{href:!0,style:!0,"data-svelte-h":!0}),he(a)!=="svelte-80akn7"&&(a.textContent=w),b=c(e),h&&h.l(e),d=c(e),k(R.$$.fragment,e),q=c(e),N&&N.l(e),D=c(e),x&&x.l(e),n=c(e),B&&B.l(e),E=c(e),z&&z.l(e),G=c(e),U&&U.l(e),ee=c(e),V&&V.l(e),Y=c(e),S=j(e,"H1",{class:!0,id:!0,"data-svelte-h":!0}),he(S)!=="svelte-zsjr9d"&&(S.innerHTML=K),te=c(e),k(L.$$.fragment,e),ne=c(e),I=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),he(I)!=="svelte-s01145"&&(I.innerHTML=re),P=c(e),k(O.$$.fragment,e),s=c(e),k(F.$$.fragment,e),ke=c(e),k(J.$$.fragment,e),oe=c(e),k(ae.$$.fragment,e),Te=c(e),k(fe.$$.fragment,e),Re=c(e),k(Z.$$.fragment,e),me=c(e),ie=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),he(ie)!=="svelte-oz9qz5"&&(ie.innerHTML=Oe),Ee=c(e),k(_e.$$.fragment,e),ue=c(e),W=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),he(W)!=="svelte-1382ye5"&&(W.innerHTML=qe),Fe=c(e),k(de.$$.fragment,e),Ce=c(e),X=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),he(X)!=="svelte-1bktzf4"&&(X.innerHTML=ce),ve=c(e),k(pe.$$.fragment,e),De=c(e),se=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),he(se)!=="svelte-j05cyg"&&(se.innerHTML=M),je=c(e),k(Me.$$.fragment,e),Xe=c(e),we=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),he(we)!=="svelte-mat9dy"&&(we.innerHTML=_t),Je=c(e),k(He.$$.fragment,e),Ze=c(e),Ye=j(e,"HR",{class:!0}),et=c(e),k(Ae.$$.fragment,e),tt=c(e),k(Se.$$.fragment,e),rt=c(e),k(Ie.$$.fragment,e),it=c(e),k(Le.$$.fragment,e),at=c(e),k(Pe.$$.fragment,e),this.h()},h(){C(i,"name","twitter:card"),C(i,"content","summary_large_image"),C(t,"name","twitter:site"),C(t,"content","@evidence_dev"),C(a,"href","/lab/"),$e(a,"display","inline-flex"),$e(a,"align-items","center"),$e(a,"gap","6px"),$e(a,"padding","6px 14px"),$e(a,"background","#f1f5f9"),$e(a,"border","1px solid #e2e8f0"),$e(a,"border-radius","8px"),$e(a,"color","#475569"),$e(a,"text-decoration","none"),$e(a,"font-size","0.85rem"),$e(a,"margin-bottom","1rem"),C(S,"class","markdown"),C(S,"id","lab-de-valorisation"),C(I,"class","markdown"),C(I,"id","metriques-de-valorisation"),C(ie,"class","markdown"),C(ie,"id","pe-forward-vs-rendement-en-dividende"),C(W,"class","markdown"),C(W,"id","top-20-rendements-en-dividende"),C(X,"class","markdown"),C(X,"id","les-moins-cheres-pe-forward"),C(se,"class","markdown"),C(se,"id","les-plus-cheres-pe-forward"),C(we,"class","markdown"),C(we,"id","tableau-complet-de-valorisation"),C(Ye,"class","markdown")},m(e,l){be&&be.m(e,l),u(e,r,l),Ke.m(document.head,null),nt(document.head,i),nt(document.head,t),ge&&ge.m(document.head,null),nt(document.head,f),u(e,m,l),u(e,a,l),u(e,b,l),h&&h.m(e,l),u(e,d,l),y(R,e,l),u(e,q,l),N&&N.m(e,l),u(e,D,l),x&&x.m(e,l),u(e,n,l),B&&B.m(e,l),u(e,E,l),z&&z.m(e,l),u(e,G,l),U&&U.m(e,l),u(e,ee,l),V&&V.m(e,l),u(e,Y,l),u(e,S,l),u(e,te,l),y(L,e,l),u(e,ne,l),u(e,I,l),u(e,P,l),y(O,e,l),u(e,s,l),y(F,e,l),u(e,ke,l),y(J,e,l),u(e,oe,l),y(ae,e,l),u(e,Te,l),y(fe,e,l),u(e,Re,l),y(Z,e,l),u(e,me,l),u(e,ie,l),u(e,Ee,l),y(_e,e,l),u(e,ue,l),u(e,W,l),u(e,Fe,l),y(de,e,l),u(e,Ce,l),u(e,X,l),u(e,ve,l),y(pe,e,l),u(e,De,l),u(e,se,l),u(e,je,l),y(Me,e,l),u(e,Xe,l),u(e,we,l),u(e,Je,l),y(He,e,l),u(e,Ze,l),u(e,Ye,l),u(e,et,l),y(Ae,e,l),u(e,tt,l),y(Se,e,l),u(e,rt,l),y(Ie,e,l),u(e,it,l),y(Le,e,l),u(e,at,l),y(Pe,e,l),lt=!0},p(e,l){typeof H<"u"&&H.title&&H.hide_title!==!0&&be.p(e,l),Ke.p(e,l),typeof H=="object"&&ge.p(e,l),e[0]?h?(h.p(e,l),l[0]&1&&p(h,1)):(h=At(e),h.c(),p(h,1),h.m(d.parentNode,d)):h&&(xe(),$(h,1,1,()=>{h=null}),Ne());const ut={};l[0]&1|l[1]&67108864&&(ut.$$scope={dirty:l,ctx:e}),R.$set(ut),e[1]?N?(N.p(e,l),l[0]&2&&p(N,1)):(N=It(e),N.c(),p(N,1),N.m(D.parentNode,D)):N&&(xe(),$(N,1,1,()=>{N=null}),Ne()),e[2]?x?(x.p(e,l),l[0]&4&&p(x,1)):(x=Lt(e),x.c(),p(x,1),x.m(n.parentNode,n)):x&&(xe(),$(x,1,1,()=>{x=null}),Ne()),e[3]?B?(B.p(e,l),l[0]&8&&p(B,1)):(B=Pt(e),B.c(),p(B,1),B.m(E.parentNode,E)):B&&(xe(),$(B,1,1,()=>{B=null}),Ne()),e[4]?z?(z.p(e,l),l[0]&16&&p(z,1)):(z=ht(e),z.c(),p(z,1),z.m(G.parentNode,G)):z&&(xe(),$(z,1,1,()=>{z=null}),Ne()),e[5]?U?(U.p(e,l),l[0]&32&&p(U,1)):(U=Nt(e),U.c(),p(U,1),U.m(ee.parentNode,ee)):U&&(xe(),$(U,1,1,()=>{U=null}),Ne()),e[6]?V?(V.p(e,l),l[0]&64&&p(V,1)):(V=xt(e),V.c(),p(V,1),V.m(Y.parentNode,Y)):V&&(xe(),$(V,1,1,()=>{V=null}),Ne());const dt={};l[1]&67108864&&(dt.$$scope={dirty:l,ctx:e}),L.$set(dt);const pt={};l[0]&2&&(pt.data=e[1]),O.$set(pt);const $t={};l[0]&2&&($t.data=e[1]),F.$set($t);const ct={};l[0]&2&&(ct.data=e[1]),J.$set(ct);const vt={};l[0]&2&&(vt.data=e[1]),ae.$set(vt);const wt={};l[0]&2&&(wt.data=e[1]),fe.$set(wt);const bt={};l[0]&2&&(bt.data=e[1]),Z.$set(bt);const gt={};l[0]&4&&(gt.data=e[2]),_e.$set(gt);const yt={};l[0]&8&&(yt.data=e[3]),de.$set(yt);const st={};l[0]&32&&(st.data=e[5]),l[1]&67108864&&(st.$$scope={dirty:l,ctx:e}),pe.$set(st);const ot={};l[0]&64&&(ot.data=e[6]),l[1]&67108864&&(ot.$$scope={dirty:l,ctx:e}),Me.$set(ot);const ft={};l[0]&16&&(ft.data=e[4]),l[1]&67108864&&(ft.$$scope={dirty:l,ctx:e}),He.$set(ft);const kt={};l[1]&67108864&&(kt.$$scope={dirty:l,ctx:e}),Ae.$set(kt);const Tt={};l[1]&67108864&&(Tt.$$scope={dirty:l,ctx:e}),Se.$set(Tt);const Rt={};l[1]&67108864&&(Rt.$$scope={dirty:l,ctx:e}),Ie.$set(Rt);const Et={};l[1]&67108864&&(Et.$$scope={dirty:l,ctx:e}),Le.$set(Et);const qt={};l[1]&67108864&&(qt.$$scope={dirty:l,ctx:e}),Pe.$set(qt)},i(e){lt||(p(h),p(R.$$.fragment,e),p(N),p(x),p(B),p(z),p(U),p(V),p(L.$$.fragment,e),p(O.$$.fragment,e),p(F.$$.fragment,e),p(J.$$.fragment,e),p(ae.$$.fragment,e),p(fe.$$.fragment,e),p(Z.$$.fragment,e),p(_e.$$.fragment,e),p(de.$$.fragment,e),p(pe.$$.fragment,e),p(Me.$$.fragment,e),p(He.$$.fragment,e),p(Ae.$$.fragment,e),p(Se.$$.fragment,e),p(Ie.$$.fragment,e),p(Le.$$.fragment,e),p(Pe.$$.fragment,e),lt=!0)},o(e){$(h),$(R.$$.fragment,e),$(N),$(x),$(B),$(z),$(U),$(V),$(L.$$.fragment,e),$(O.$$.fragment,e),$(F.$$.fragment,e),$(J.$$.fragment,e),$(ae.$$.fragment,e),$(fe.$$.fragment,e),$(Z.$$.fragment,e),$(_e.$$.fragment,e),$(de.$$.fragment,e),$(pe.$$.fragment,e),$(Me.$$.fragment,e),$(He.$$.fragment,e),$(Ae.$$.fragment,e),$(Se.$$.fragment,e),$(Ie.$$.fragment,e),$(Le.$$.fragment,e),$(Pe.$$.fragment,e),lt=!1},d(e){e&&(_(r),_(m),_(a),_(b),_(d),_(q),_(D),_(n),_(E),_(G),_(ee),_(Y),_(S),_(te),_(ne),_(I),_(P),_(s),_(ke),_(oe),_(Te),_(Re),_(me),_(ie),_(Ee),_(ue),_(W),_(Fe),_(Ce),_(X),_(ve),_(De),_(se),_(je),_(Xe),_(we),_(Je),_(Ze),_(Ye),_(et),_(tt),_(rt),_(it),_(at)),be&&be.d(e),Ke.d(e),_(i),_(t),ge&&ge.d(e),_(f),h&&h.d(e),g(R,e),N&&N.d(e),x&&x.d(e),B&&B.d(e),z&&z.d(e),U&&U.d(e),V&&V.d(e),g(L,e),g(O,e),g(F,e),g(J,e),g(ae,e),g(fe,e),g(Z,e),g(_e,e),g(de,e),g(pe,e),g(Me,e),g(He,e),g(Ae,e),g(Se,e),g(Ie,e),g(Le,e),g(Pe,e)}}}const H={title:"Lab de Valorisation - Radiographie des 150 Plus Grandes Capitalisations Mondiales",description:"Analyse des multiples de valorisation, dividendes et metriques fondamentales"};function qr(o,r,i){let t,f;Ft(o,nr,M=>i(38,t=M)),Ft(o,Mt,M=>i(43,f=M));let{data:m}=r,{data:a={},customFormattingSettings:w,__db:b,inputs:d}=m;Ot(Mt,f="e8f34ab78181126b95363642c0b4c958",f);let R=Jt(rr(d));jt(R.subscribe(M=>i(9,d=M))),Qt(tr,{getCustomFormats:()=>w.customFormats||[]});const q=(M,je)=>ar(b.query,M,{query_name:je});Zt(q),t.params,Gt(()=>!0);let D={initialData:void 0,initialError:void 0},n=le`select distinct sector as value, sector as label
from market.stocks
order by sector`,E=`select distinct sector as value, sector as label
from market.stocks
order by sector`;a.sector_list_val_data&&(a.sector_list_val_data instanceof Error?D.initialError=a.sector_list_val_data:D.initialData=a.sector_list_val_data,a.sector_list_val_columns&&(D.knownColumns=a.sector_list_val_columns));let G,ee=!1;const Y=Be.createReactive({callback:M=>{i(0,G=M)},execFn:q},{id:"sector_list_val",...D});Y(E,{noResolve:n,...D}),globalThis[Symbol.for("sector_list_val")]={get value(){return G}};let S={initialData:void 0,initialError:void 0},K=le`select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0`,te=`select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0`;a.valuation_summary_data&&(a.valuation_summary_data instanceof Error?S.initialError=a.valuation_summary_data:S.initialData=a.valuation_summary_data,a.valuation_summary_columns&&(S.knownColumns=a.valuation_summary_columns));let L,ne=!1;const I=Be.createReactive({callback:M=>{i(1,L=M)},execFn:q},{id:"valuation_summary",...S});I(te,{noResolve:K,...S}),globalThis[Symbol.for("valuation_summary")]={get value(){return L}};let re={initialData:void 0,initialError:void 0},P=le`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector,
    recommendation
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null`,O=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector,
    recommendation
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null`;a.scatter_pe_div_data&&(a.scatter_pe_div_data instanceof Error?re.initialError=a.scatter_pe_div_data:re.initialData=a.scatter_pe_div_data,a.scatter_pe_div_columns&&(re.knownColumns=a.scatter_pe_div_columns));let s,F=!1;const ke=Be.createReactive({callback:M=>{i(2,s=M)},execFn:q},{id:"scatter_pe_div",...re});ke(O,{noResolve:P,...re}),globalThis[Symbol.for("scatter_pe_div")]={get value(){return s}};let J={initialData:void 0,initialError:void 0},oe=le`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where sector like '${d.val_sector.value}'
  and dividend_yield is not null
  and dividend_yield > 0
order by dividend_yield desc
limit 20`,ae=`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where sector like '${d.val_sector.value}'
  and dividend_yield is not null
  and dividend_yield > 0
order by dividend_yield desc
limit 20`;a.top20_dividends_data&&(a.top20_dividends_data instanceof Error?J.initialError=a.top20_dividends_data:J.initialData=a.top20_dividends_data,a.top20_dividends_columns&&(J.knownColumns=a.top20_dividends_columns));let Te,fe=!1;const Re=Be.createReactive({callback:M=>{i(3,Te=M)},execFn:q},{id:"top20_dividends",...J});Re(ae,{noResolve:oe,...J}),globalThis[Symbol.for("top20_dividends")]={get value(){return Te}};let Z={initialData:void 0,initialError:void 0},me=le`select
    symbol,
    name,
    price,
    pe_trailing,
    pe_forward,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    target_price,
    recommendation,
    sector,
    country
from market.stocks
where sector like '${d.val_sector.value}'
order by pe_forward asc nulls last`,ie=`select
    symbol,
    name,
    price,
    pe_trailing,
    pe_forward,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    target_price,
    recommendation,
    sector,
    country
from market.stocks
where sector like '${d.val_sector.value}'
order by pe_forward asc nulls last`;a.valuation_table_data&&(a.valuation_table_data instanceof Error?Z.initialError=a.valuation_table_data:Z.initialData=a.valuation_table_data,a.valuation_table_columns&&(Z.knownColumns=a.valuation_table_columns));let Oe,Ee=!1;const _e=Be.createReactive({callback:M=>{i(4,Oe=M)},execFn:q},{id:"valuation_table",...Z});_e(ie,{noResolve:me,...Z}),globalThis[Symbol.for("valuation_table")]={get value(){return Oe}};let ue={initialData:void 0,initialError:void 0},W=le`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
order by pe_forward asc
limit 15`,qe=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
order by pe_forward asc
limit 15`;a.cheapest_pe_data&&(a.cheapest_pe_data instanceof Error?ue.initialError=a.cheapest_pe_data:ue.initialData=a.cheapest_pe_data,a.cheapest_pe_columns&&(ue.knownColumns=a.cheapest_pe_columns));let Fe,de=!1;const Ce=Be.createReactive({callback:M=>{i(5,Fe=M)},execFn:q},{id:"cheapest_pe",...ue});Ce(qe,{noResolve:W,...ue}),globalThis[Symbol.for("cheapest_pe")]={get value(){return Fe}};let X={initialData:void 0,initialError:void 0},ce=le`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
order by pe_forward desc
limit 15`,ve=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
order by pe_forward desc
limit 15`;a.most_expensive_pe_data&&(a.most_expensive_pe_data instanceof Error?X.initialError=a.most_expensive_pe_data:X.initialData=a.most_expensive_pe_data,a.most_expensive_pe_columns&&(X.knownColumns=a.most_expensive_pe_columns));let pe,De=!1;const se=Be.createReactive({callback:M=>{i(6,pe=M)},execFn:q},{id:"most_expensive_pe",...X});return se(ve,{noResolve:ce,...X}),globalThis[Symbol.for("most_expensive_pe")]={get value(){return pe}},o.$$set=M=>{"data"in M&&i(7,m=M.data)},o.$$.update=()=>{o.$$.dirty[0]&128&&i(8,{data:a={},customFormattingSettings:w,__db:b}=m,a),o.$$.dirty[0]&256&&er.set(Object.keys(a).length>0),o.$$.dirty[1]&128&&t.params,o.$$.dirty[0]&15360&&(n||!ee?n||(Y(E,{noResolve:n,...D}),i(13,ee=!0)):Y(E,{noResolve:n})),o.$$.dirty[0]&512&&i(15,K=le`select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0`),o.$$.dirty[0]&512&&i(16,te=`select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0`),o.$$.dirty[0]&245760&&(K||!ne?K||(I(te,{noResolve:K,...S}),i(17,ne=!0)):I(te,{noResolve:K})),o.$$.dirty[0]&512&&i(19,P=le`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector,
    recommendation
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null`),o.$$.dirty[0]&512&&i(20,O=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector,
    recommendation
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null`),o.$$.dirty[0]&3932160&&(P||!F?P||(ke(O,{noResolve:P,...re}),i(21,F=!0)):ke(O,{noResolve:P})),o.$$.dirty[0]&512&&i(23,oe=le`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where sector like '${d.val_sector.value}'
  and dividend_yield is not null
  and dividend_yield > 0
order by dividend_yield desc
limit 20`),o.$$.dirty[0]&512&&i(24,ae=`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where sector like '${d.val_sector.value}'
  and dividend_yield is not null
  and dividend_yield > 0
order by dividend_yield desc
limit 20`),o.$$.dirty[0]&62914560&&(oe||!fe?oe||(Re(ae,{noResolve:oe,...J}),i(25,fe=!0)):Re(ae,{noResolve:oe})),o.$$.dirty[0]&512&&i(27,me=le`select
    symbol,
    name,
    price,
    pe_trailing,
    pe_forward,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    target_price,
    recommendation,
    sector,
    country
from market.stocks
where sector like '${d.val_sector.value}'
order by pe_forward asc nulls last`),o.$$.dirty[0]&512&&i(28,ie=`select
    symbol,
    name,
    price,
    pe_trailing,
    pe_forward,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    target_price,
    recommendation,
    sector,
    country
from market.stocks
where sector like '${d.val_sector.value}'
order by pe_forward asc nulls last`),o.$$.dirty[0]&1006632960&&(me||!Ee?me||(_e(ie,{noResolve:me,...Z}),i(29,Ee=!0)):_e(ie,{noResolve:me})),o.$$.dirty[0]&512&&i(31,W=le`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
order by pe_forward asc
limit 15`),o.$$.dirty[0]&512&&i(32,qe=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
order by pe_forward asc
limit 15`),o.$$.dirty[0]&1073741824|o.$$.dirty[1]&7&&(W||!de?W||(Ce(qe,{noResolve:W,...ue}),i(33,de=!0)):Ce(qe,{noResolve:W})),o.$$.dirty[0]&512&&i(35,ce=le`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
order by pe_forward desc
limit 15`),o.$$.dirty[0]&512&&i(36,ve=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where sector like '${d.val_sector.value}'
  and pe_forward is not null
  and pe_forward > 0
order by pe_forward desc
limit 15`),o.$$.dirty[1]&120&&(ce||!De?ce||(se(ve,{noResolve:ce,...X}),i(37,De=!0)):se(ve,{noResolve:ce}))},i(11,n=le`select distinct sector as value, sector as label
from market.stocks
order by sector`),i(12,E=`select distinct sector as value, sector as label
from market.stocks
order by sector`),[G,L,s,Te,Oe,Fe,pe,m,a,d,D,n,E,ee,S,K,te,ne,re,P,O,F,J,oe,ae,fe,Z,me,ie,Ee,ue,W,qe,de,X,ce,ve,De,t]}class Nr extends Wt{constructor(r){super(),Xt(this,r,qr,Er,Ut,{data:7},null,[-1,-1])}}export{Nr as component};
