import{s as Tr,d as f,i as c,a as Ie,b as N,c as xe,e as v,h as Rr,f as G,g as Ht,j as ye,k,l as z,m as Jt,n as qr,o as Er,p as Sr,q as Hr,r as yr,t as Pe,u as Ve,v as Le,w as pt}from"../chunks/scheduler.gCtXCaAC.js";import{S as Mr,i as Cr,d as h,t as $,a as p,c as Re,m as T,b as R,e as q,g as qe}from"../chunks/index.DmJzZqpA.js";import{e as Fr,s as Ir,Q as Ee,p as Lr,a as er,D as Ze,b as Dr,C as D,r as tr,c as Nr}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.xVnsThWF.js";import{w as Ar}from"../chunks/entry.t5gz319j.js";import{A as Br,T as Ur,Q as Se,B as Xe,a as St,L as Rt,b as Ke}from"../chunks/BigValue.vcBvE0eY.js";import{h as Q,p as Pr}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{p as Vr}from"../chunks/stores.CdFJQivx.js";import{G as qt}from"../chunks/Grid.B6K-jFTg.js";import{B as rr}from"../chunks/BubbleChart.CKh_rRrf.js";import{F as Or}from"../chunks/FunnelChart.DhVEYRCl.js";import{H as xr}from"../chunks/Heatmap.9L0bY0b2.js";function Gr(u){let t,r=K.title+"",e;return{c(){t=z("h1"),e=Ve(r),this.h()},l(l){t=G(l,"H1",{class:!0});var n=pt(t);e=Pe(n,r),n.forEach(f),this.h()},h(){N(t,"class","title")},m(l,n){c(l,t,n),Ie(t,e)},p:Le,d(l){l&&f(t)}}}function zr(u){return{c(){this.h()},l(t){this.h()},h(){document.title="Evidence"},m:Le,p:Le,d:Le}}function Qr(u){let t,r,e,l,n;return document.title=t=K.title,{c(){r=k(),e=z("meta"),l=k(),n=z("meta"),this.h()},l(a){r=v(a),e=G(a,"META",{property:!0,content:!0}),l=v(a),n=G(a,"META",{name:!0,content:!0}),this.h()},h(){var a,_;N(e,"property","og:title"),N(e,"content",((a=K.og)==null?void 0:a.title)??K.title),N(n,"name","twitter:title"),N(n,"content",((_=K.og)==null?void 0:_.title)??K.title)},m(a,_){c(a,r,_),c(a,e,_),c(a,l,_),c(a,n,_)},p(a,_){_&0&&t!==(t=K.title)&&(document.title=t)},d(a){a&&(f(r),f(e),f(l),f(n))}}}function Yr(u){var n,a;let t,r,e=(K.description||((n=K.og)==null?void 0:n.description))&&jr(),l=((a=K.og)==null?void 0:a.image)&&Wr();return{c(){e&&e.c(),t=k(),l&&l.c(),r=Ht()},l(_){e&&e.l(_),t=v(_),l&&l.l(_),r=Ht()},m(_,E){e&&e.m(_,E),c(_,t,E),l&&l.m(_,E),c(_,r,E)},p(_,E){var g,y;(K.description||(g=K.og)!=null&&g.description)&&e.p(_,E),(y=K.og)!=null&&y.image&&l.p(_,E)},d(_){_&&(f(t),f(r)),e&&e.d(_),l&&l.d(_)}}}function jr(u){let t,r,e,l,n;return{c(){t=z("meta"),r=k(),e=z("meta"),l=k(),n=z("meta"),this.h()},l(a){t=G(a,"META",{name:!0,content:!0}),r=v(a),e=G(a,"META",{property:!0,content:!0}),l=v(a),n=G(a,"META",{name:!0,content:!0}),this.h()},h(){var a,_,E;N(t,"name","description"),N(t,"content",K.description??((a=K.og)==null?void 0:a.description)),N(e,"property","og:description"),N(e,"content",((_=K.og)==null?void 0:_.description)??K.description),N(n,"name","twitter:description"),N(n,"content",((E=K.og)==null?void 0:E.description)??K.description)},m(a,_){c(a,t,_),c(a,r,_),c(a,e,_),c(a,l,_),c(a,n,_)},p:Le,d(a){a&&(f(t),f(r),f(e),f(l),f(n))}}}function Wr(u){let t,r,e;return{c(){t=z("meta"),r=k(),e=z("meta"),this.h()},l(l){t=G(l,"META",{property:!0,content:!0}),r=v(l),e=G(l,"META",{name:!0,content:!0}),this.h()},h(){var l,n;N(t,"property","og:image"),N(t,"content",er((l=K.og)==null?void 0:l.image)),N(e,"name","twitter:image"),N(e,"content",er((n=K.og)==null?void 0:n.image))},m(l,n){c(l,t,n),c(l,r,n),c(l,e,n)},p:Le,d(l){l&&(f(t),f(r),f(e))}}}function ar(u){let t,r;return t=new Se({props:{queryID:"total_stats",queryResult:u[0]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&1&&(n.queryResult=e[0]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function sr(u){let t,r;return t=new Se({props:{queryID:"by_region",queryResult:u[1]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&2&&(n.queryResult=e[1]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function nr(u){let t,r;return t=new Se({props:{queryID:"by_sector",queryResult:u[2]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&4&&(n.queryResult=e[2]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function or(u){let t,r;return t=new Se({props:{queryID:"heatmap_data",queryResult:u[3]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&8&&(n.queryResult=e[3]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function ir(u){let t,r;return t=new Se({props:{queryID:"sector_mcap_bar",queryResult:u[4]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&16&&(n.queryResult=e[4]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function lr(u){let t,r;return t=new Se({props:{queryID:"pe_distribution",queryResult:u[5]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&32&&(n.queryResult=e[5]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function mr(u){let t,r;return t=new Se({props:{queryID:"funnel_data",queryResult:u[6]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&64&&(n.queryResult=e[6]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function _r(u){let t,r;return t=new Se({props:{queryID:"bubble_data",queryResult:u[7]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&128&&(n.queryResult=e[7]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function fr(u){let t,r;return t=new Se({props:{queryID:"cumulative_mcap_by_region",queryResult:u[8]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&256&&(n.queryResult=e[8]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function ur(u){let t,r;return t=new Se({props:{queryID:"top_movers",queryResult:u[9]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&512&&(n.queryResult=e[9]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function pr(u){let t,r;return t=new Se({props:{queryID:"worst_movers",queryResult:u[10]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&1024&&(n.queryResult=e[10]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function cr(u){let t,r;return t=new Se({props:{queryID:"top_by_upside",queryResult:u[11]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&2048&&(n.queryResult=e[11]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function $r(u){let t,r;return t=new Se({props:{queryID:"top_dividends",queryResult:u[12]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&4096&&(n.queryResult=e[12]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function dr(u){let t,r;return t=new Se({props:{queryID:"all_stocks",queryResult:u[13]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&8192&&(n.queryResult=e[13]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function gr(u){let t,r;return t=new Se({props:{queryID:"recommendation_dist",queryResult:u[14]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&16384&&(n.queryResult=e[14]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function br(u){let t,r;return t=new Se({props:{queryID:"margin_by_sector",queryResult:u[15]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&32768&&(n.queryResult=e[15]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function wr(u){let t,r;return t=new Se({props:{queryID:"growth_vs_value",queryResult:u[16]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&65536&&(n.queryResult=e[16]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function vr(u){let t,r;return t=new Se({props:{queryID:"region_mcap_stacked",queryResult:u[17]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&131072&&(n.queryResult=e[17]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function kr(u){let t,r;return t=new Se({props:{queryID:"pe_by_sector_box",queryResult:u[18]}}),{c(){q(t.$$.fragment)},l(e){R(t.$$.fragment,e)},m(e,l){T(t,e,l),r=!0},p(e,l){const n={};l[0]&262144&&(n.queryResult=e[18]),t.$set(n)},i(e){r||(p(t.$$.fragment,e),r=!0)},o(e){$(t.$$.fragment,e),r=!1},d(e){h(t,e)}}}function Xr(u){let t,r=u[0][0].total_stocks+"",e,l;return{c(){t=Ve("Laboratoire financier interactif Market Watch — "),e=Ve(r),l=Ve(" actions, 11 secteurs, 4 zones geographiques. Toutes les donnees sont pre-calculees pour un chargement instantane.")},l(n){t=Pe(n,"Laboratoire financier interactif Market Watch — "),e=Pe(n,r),l=Pe(n," actions, 11 secteurs, 4 zones geographiques. Toutes les donnees sont pre-calculees pour un chargement instantane.")},m(n,a){c(n,t,a),c(n,e,a),c(n,l,a)},p(n,a){a[0]&1&&r!==(r=n[0][0].total_stocks+"")&&yr(e,r)},d(n){n&&(f(t),f(e),f(l))}}}function Kr(u){let t,r,e,l,n,a,_,E,g,y;return t=new Xe({props:{data:u[0],value:"total_stocks",title:"Actions couvertes",emptySet:"pass"}}),e=new Xe({props:{data:u[0],value:"total_mcap_t",title:"Cap. Totale (T$)",emptySet:"pass"}}),n=new Xe({props:{data:u[0],value:"avg_pe",title:"P/E Forward Moy.",emptySet:"pass"}}),_=new Xe({props:{data:u[0],value:"avg_div_yield",title:"Div. Yield Moy. (%)",emptySet:"pass"}}),g=new Xe({props:{data:u[0],value:"avg_change",title:"Var. Moy. (%)",emptySet:"pass"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment)},l(s){R(t.$$.fragment,s),r=v(s),R(e.$$.fragment,s),l=v(s),R(n.$$.fragment,s),a=v(s),R(_.$$.fragment,s),E=v(s),R(g.$$.fragment,s)},m(s,H){T(t,s,H),c(s,r,H),T(e,s,H),c(s,l,H),T(n,s,H),c(s,a,H),T(_,s,H),c(s,E,H),T(g,s,H),y=!0},p(s,H){const m={};H[0]&1&&(m.data=s[0]),t.$set(m);const M={};H[0]&1&&(M.data=s[0]),e.$set(M);const i={};H[0]&1&&(i.data=s[0]),n.$set(i);const C={};H[0]&1&&(C.data=s[0]),_.$set(C);const b={};H[0]&1&&(b.data=s[0]),g.$set(b)},i(s){y||(p(t.$$.fragment,s),p(e.$$.fragment,s),p(n.$$.fragment,s),p(_.$$.fragment,s),p(g.$$.fragment,s),y=!0)},o(s){$(t.$$.fragment,s),$(e.$$.fragment,s),$(n.$$.fragment,s),$(_.$$.fragment,s),$(g.$$.fragment,s),y=!1},d(s){s&&(f(r),f(l),f(a),f(E)),h(t,s),h(e,s),h(n,s),h(_,s),h(g,s)}}}function Zr(u){let t,r,e,l,n,a;return t=new Xe({props:{data:u[0],value:"avg_beta",title:"Beta Moyen",emptySet:"pass"}}),e=new Xe({props:{data:u[0],value:"avg_margin",title:"Marge Nette Moy. (%)",emptySet:"pass"}}),n=new Xe({props:{data:u[1],value:"nb_stocks",title:"Regions",emptySet:"pass"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment)},l(_){R(t.$$.fragment,_),r=v(_),R(e.$$.fragment,_),l=v(_),R(n.$$.fragment,_)},m(_,E){T(t,_,E),c(_,r,E),T(e,_,E),c(_,l,E),T(n,_,E),a=!0},p(_,E){const g={};E[0]&1&&(g.data=_[0]),t.$set(g);const y={};E[0]&1&&(y.data=_[0]),e.$set(y);const s={};E[0]&2&&(s.data=_[1]),n.$set(s)},i(_){a||(p(t.$$.fragment,_),p(e.$$.fragment,_),p(n.$$.fragment,_),a=!0)},o(_){$(t.$$.fragment,_),$(e.$$.fragment,_),$(n.$$.fragment,_),a=!1},d(_){_&&(f(r),f(l)),h(t,_),h(e,_),h(n,_)}}}function Jr(u){let t,r,e='<a href="#capitalisation-par-secteur-t">Capitalisation par Secteur (T$)</a>',l,n,a,_,E,g='<a href="#capitalisation-par-region">Capitalisation par Region</a>',y,s,H;return n=new Ke({props:{data:u[4],x:"sector",y:"mcap_t",xAxisTitle:"Secteur",yAxisTitle:"Cap. Totale (T$)",title:"Poids des Secteurs",swapXY:"true",sort:"false",emptySet:"pass"}}),s=new Ke({props:{data:u[1],x:"region",y:"total_mcap",title:"Repartition par Zone Geographique",fmt:"usd",emptySet:"pass"}}),{c(){t=z("div"),r=z("h3"),r.innerHTML=e,l=k(),q(n.$$.fragment),a=k(),_=z("div"),E=z("h3"),E.innerHTML=g,y=k(),q(s.$$.fragment),this.h()},l(m){t=G(m,"DIV",{});var M=pt(t);r=G(M,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(r)!=="svelte-zr1bts"&&(r.innerHTML=e),l=v(M),R(n.$$.fragment,M),M.forEach(f),a=v(m),_=G(m,"DIV",{});var i=pt(_);E=G(i,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(E)!=="svelte-1n8a20k"&&(E.innerHTML=g),y=v(i),R(s.$$.fragment,i),i.forEach(f),this.h()},h(){N(r,"class","markdown"),N(r,"id","capitalisation-par-secteur-t"),N(E,"class","markdown"),N(E,"id","capitalisation-par-region")},m(m,M){c(m,t,M),Ie(t,r),Ie(t,l),T(n,t,null),c(m,a,M),c(m,_,M),Ie(_,E),Ie(_,y),T(s,_,null),H=!0},p(m,M){const i={};M[0]&16&&(i.data=m[4]),n.$set(i);const C={};M[0]&2&&(C.data=m[1]),s.$set(C)},i(m){H||(p(n.$$.fragment,m),p(s.$$.fragment,m),H=!0)},o(m){$(n.$$.fragment,m),$(s.$$.fragment,m),H=!1},d(m){m&&(f(t),f(a),f(_)),h(n),h(s)}}}function ea(u){let t,r,e,l,n,a,_,E,g,y,s,H;return t=new D({props:{id:"region",title:"Region"}}),e=new D({props:{id:"nb_stocks",title:"Nb Actions"}}),n=new D({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),_=new D({props:{id:"avg_pe",title:"P/E Fwd Moy."}}),g=new D({props:{id:"avg_div_yield",title:"Div Yield Moy. (%)"}}),s=new D({props:{id:"avg_change",title:"Var Moy. (%)"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment),y=k(),q(s.$$.fragment)},l(m){R(t.$$.fragment,m),r=v(m),R(e.$$.fragment,m),l=v(m),R(n.$$.fragment,m),a=v(m),R(_.$$.fragment,m),E=v(m),R(g.$$.fragment,m),y=v(m),R(s.$$.fragment,m)},m(m,M){T(t,m,M),c(m,r,M),T(e,m,M),c(m,l,M),T(n,m,M),c(m,a,M),T(_,m,M),c(m,E,M),T(g,m,M),c(m,y,M),T(s,m,M),H=!0},p:Le,i(m){H||(p(t.$$.fragment,m),p(e.$$.fragment,m),p(n.$$.fragment,m),p(_.$$.fragment,m),p(g.$$.fragment,m),p(s.$$.fragment,m),H=!0)},o(m){$(t.$$.fragment,m),$(e.$$.fragment,m),$(n.$$.fragment,m),$(_.$$.fragment,m),$(g.$$.fragment,m),$(s.$$.fragment,m),H=!1},d(m){m&&(f(r),f(l),f(a),f(E),f(y)),h(t,m),h(e,m),h(n,m),h(_,m),h(g,m),h(s,m)}}}function ta(u){let t,r,e,l,n,a,_,E,g,y,s,H,m,M;return t=new D({props:{id:"sector",title:"Secteur"}}),e=new D({props:{id:"nb_stocks",title:"Nb Actions"}}),n=new D({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),_=new D({props:{id:"avg_pe",title:"P/E Fwd Moy."}}),g=new D({props:{id:"avg_change",title:"Var Moy. (%)"}}),s=new D({props:{id:"avg_rev_growth",title:"Croiss. CA Moy. (%)"}}),m=new D({props:{id:"avg_margin",title:"Marge Nette Moy. (%)"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment),y=k(),q(s.$$.fragment),H=k(),q(m.$$.fragment)},l(i){R(t.$$.fragment,i),r=v(i),R(e.$$.fragment,i),l=v(i),R(n.$$.fragment,i),a=v(i),R(_.$$.fragment,i),E=v(i),R(g.$$.fragment,i),y=v(i),R(s.$$.fragment,i),H=v(i),R(m.$$.fragment,i)},m(i,C){T(t,i,C),c(i,r,C),T(e,i,C),c(i,l,C),T(n,i,C),c(i,a,C),T(_,i,C),c(i,E,C),T(g,i,C),c(i,y,C),T(s,i,C),c(i,H,C),T(m,i,C),M=!0},p:Le,i(i){M||(p(t.$$.fragment,i),p(e.$$.fragment,i),p(n.$$.fragment,i),p(_.$$.fragment,i),p(g.$$.fragment,i),p(s.$$.fragment,i),p(m.$$.fragment,i),M=!0)},o(i){$(t.$$.fragment,i),$(e.$$.fragment,i),$(n.$$.fragment,i),$(_.$$.fragment,i),$(g.$$.fragment,i),$(s.$$.fragment,i),$(m.$$.fragment,i),M=!1},d(i){i&&(f(r),f(l),f(a),f(E),f(y),f(H)),h(t,i),h(e,i),h(n,i),h(_,i),h(g,i),h(s,i),h(m,i)}}}function ra(u){let t,r='<a href="#heatmap-secteur-x-region--variation-moyenne-">Heatmap Secteur x Region — Variation Moyenne (%)</a>',e,l,n,a,_,E,g='<a href="#capitalisation-sectorielle-empilee-par-region-mds">Capitalisation Sectorielle Empilee par Region (Mds$)</a>',y,s,H,m,M='<a href="#tableau-comparatif-par-region">Tableau Comparatif par Region</a>',i,C,b,I,V='<a href="#tableau-comparatif-par-secteur">Tableau Comparatif par Secteur</a>',Y,P,L,A,O='<a href="#recommandations-analystes">Recommandations Analystes</a>',j,x,W;return l=new xr({props:{data:u[3],x:"x_val",y:"y_val",value:"val",valueFmt:"num2",title:"Performance Moyenne par Secteur et Region (%)",emptySet:"pass"}}),a=new qt({props:{cols:"2",$$slots:{default:[Jr]},$$scope:{ctx:u}}}),s=new Ke({props:{data:u[17],x:"region",y:"mcap_b",series:"sector",title:"Decomposition Sectorielle par Region",yAxisTitle:"Capitalisation (Mds$)",type:"stacked",emptySet:"pass"}}),C=new Ze({props:{data:u[1],rows:"10",emptySet:"pass",$$slots:{default:[ea]},$$scope:{ctx:u}}}),P=new Ze({props:{data:u[2],rows:"15",emptySet:"pass",$$slots:{default:[ta]},$$scope:{ctx:u}}}),x=new Ke({props:{data:u[14],x:"reco",y:"nb",xAxisTitle:"Recommandation",yAxisTitle:"Nombre d'Actions",title:"Distribution des Recommandations Analystes",emptySet:"pass"}}),{c(){t=z("h3"),t.innerHTML=r,e=k(),q(l.$$.fragment),n=k(),q(a.$$.fragment),_=k(),E=z("h3"),E.innerHTML=g,y=k(),q(s.$$.fragment),H=k(),m=z("h3"),m.innerHTML=M,i=k(),q(C.$$.fragment),b=k(),I=z("h3"),I.innerHTML=V,Y=k(),q(P.$$.fragment),L=k(),A=z("h3"),A.innerHTML=O,j=k(),q(x.$$.fragment),this.h()},l(d){t=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(t)!=="svelte-14h0mo7"&&(t.innerHTML=r),e=v(d),R(l.$$.fragment,d),n=v(d),R(a.$$.fragment,d),_=v(d),E=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(E)!=="svelte-adcu5"&&(E.innerHTML=g),y=v(d),R(s.$$.fragment,d),H=v(d),m=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(m)!=="svelte-ccud9n"&&(m.innerHTML=M),i=v(d),R(C.$$.fragment,d),b=v(d),I=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(I)!=="svelte-1fqgcbi"&&(I.innerHTML=V),Y=v(d),R(P.$$.fragment,d),L=v(d),A=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(A)!=="svelte-1nc1zkq"&&(A.innerHTML=O),j=v(d),R(x.$$.fragment,d),this.h()},h(){N(t,"class","markdown"),N(t,"id","heatmap-secteur-x-region--variation-moyenne-"),N(E,"class","markdown"),N(E,"id","capitalisation-sectorielle-empilee-par-region-mds"),N(m,"class","markdown"),N(m,"id","tableau-comparatif-par-region"),N(I,"class","markdown"),N(I,"id","tableau-comparatif-par-secteur"),N(A,"class","markdown"),N(A,"id","recommandations-analystes")},m(d,F){c(d,t,F),c(d,e,F),T(l,d,F),c(d,n,F),T(a,d,F),c(d,_,F),c(d,E,F),c(d,y,F),T(s,d,F),c(d,H,F),c(d,m,F),c(d,i,F),T(C,d,F),c(d,b,F),c(d,I,F),c(d,Y,F),T(P,d,F),c(d,L,F),c(d,A,F),c(d,j,F),T(x,d,F),W=!0},p(d,F){const be={};F[0]&8&&(be.data=d[3]),l.$set(be);const X={};F[0]&18|F[4]&4&&(X.$$scope={dirty:F,ctx:d}),a.$set(X);const ve={};F[0]&131072&&(ve.data=d[17]),s.$set(ve);const Z={};F[0]&2&&(Z.data=d[1]),F[4]&4&&(Z.$$scope={dirty:F,ctx:d}),C.$set(Z);const He={};F[0]&4&&(He.data=d[2]),F[4]&4&&(He.$$scope={dirty:F,ctx:d}),P.$set(He);const we={};F[0]&16384&&(we.data=d[14]),x.$set(we)},i(d){W||(p(l.$$.fragment,d),p(a.$$.fragment,d),p(s.$$.fragment,d),p(C.$$.fragment,d),p(P.$$.fragment,d),p(x.$$.fragment,d),W=!0)},o(d){$(l.$$.fragment,d),$(a.$$.fragment,d),$(s.$$.fragment,d),$(C.$$.fragment,d),$(P.$$.fragment,d),$(x.$$.fragment,d),W=!1},d(d){d&&(f(t),f(e),f(n),f(_),f(E),f(y),f(H),f(m),f(i),f(b),f(I),f(Y),f(L),f(A),f(j)),h(l,d),h(a,d),h(s,d),h(C,d),h(P,d),h(x,d)}}}function aa(u){let t,r,e,l,n,a,_,E,g,y,s,H;return t=new D({props:{id:"name",title:"Secteur"}}),e=new D({props:{id:"min_pe",title:"Min"}}),n=new D({props:{id:"q1",title:"Q1 (25e)"}}),_=new D({props:{id:"median_pe",title:"Mediane"}}),g=new D({props:{id:"q3",title:"Q3 (75e)"}}),s=new D({props:{id:"max_pe",title:"Max"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment),y=k(),q(s.$$.fragment)},l(m){R(t.$$.fragment,m),r=v(m),R(e.$$.fragment,m),l=v(m),R(n.$$.fragment,m),a=v(m),R(_.$$.fragment,m),E=v(m),R(g.$$.fragment,m),y=v(m),R(s.$$.fragment,m)},m(m,M){T(t,m,M),c(m,r,M),T(e,m,M),c(m,l,M),T(n,m,M),c(m,a,M),T(_,m,M),c(m,E,M),T(g,m,M),c(m,y,M),T(s,m,M),H=!0},p:Le,i(m){H||(p(t.$$.fragment,m),p(e.$$.fragment,m),p(n.$$.fragment,m),p(_.$$.fragment,m),p(g.$$.fragment,m),p(s.$$.fragment,m),H=!0)},o(m){$(t.$$.fragment,m),$(e.$$.fragment,m),$(n.$$.fragment,m),$(_.$$.fragment,m),$(g.$$.fragment,m),$(s.$$.fragment,m),H=!1},d(m){m&&(f(r),f(l),f(a),f(E),f(y)),h(t,m),h(e,m),h(n,m),h(_,m),h(g,m),h(s,m)}}}function sa(u){let t,r,e,l,n,a,_,E,g,y,s,H,m,M,i,C;return t=new D({props:{id:"symbol",title:"Ticker"}}),e=new D({props:{id:"name",title:"Nom"}}),n=new D({props:{id:"price",title:"Prix",fmt:"usd"}}),_=new D({props:{id:"dividend_yield",title:"Div Yield (%)",fmt:"num2"}}),g=new D({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),s=new D({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),m=new D({props:{id:"sector",title:"Secteur"}}),i=new D({props:{id:"region",title:"Region"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment),y=k(),q(s.$$.fragment),H=k(),q(m.$$.fragment),M=k(),q(i.$$.fragment)},l(b){R(t.$$.fragment,b),r=v(b),R(e.$$.fragment,b),l=v(b),R(n.$$.fragment,b),a=v(b),R(_.$$.fragment,b),E=v(b),R(g.$$.fragment,b),y=v(b),R(s.$$.fragment,b),H=v(b),R(m.$$.fragment,b),M=v(b),R(i.$$.fragment,b)},m(b,I){T(t,b,I),c(b,r,I),T(e,b,I),c(b,l,I),T(n,b,I),c(b,a,I),T(_,b,I),c(b,E,I),T(g,b,I),c(b,y,I),T(s,b,I),c(b,H,I),T(m,b,I),c(b,M,I),T(i,b,I),C=!0},p:Le,i(b){C||(p(t.$$.fragment,b),p(e.$$.fragment,b),p(n.$$.fragment,b),p(_.$$.fragment,b),p(g.$$.fragment,b),p(s.$$.fragment,b),p(m.$$.fragment,b),p(i.$$.fragment,b),C=!0)},o(b){$(t.$$.fragment,b),$(e.$$.fragment,b),$(n.$$.fragment,b),$(_.$$.fragment,b),$(g.$$.fragment,b),$(s.$$.fragment,b),$(m.$$.fragment,b),$(i.$$.fragment,b),C=!1},d(b){b&&(f(r),f(l),f(a),f(E),f(y),f(H),f(M)),h(t,b),h(e,b),h(n,b),h(_,b),h(g,b),h(s,b),h(m,b),h(i,b)}}}function na(u){let t,r='<a href="#distribution-du-pe-forward">Distribution du P/E Forward</a>',e,l,n,a,_='<a href="#pe-forward-par-secteur-box-plot">P/E Forward par Secteur (Box Plot)</a>',E,g,y,s,H='<a href="#pyramide-des-capitalisations">Pyramide des Capitalisations</a>',m,M,i,C,b='<a href="#marges-par-secteur-">Marges par Secteur (%)</a>',I,V,Y,P,L='<a href="#top-10-rendements-en-dividende">Top 10 Rendements en Dividende</a>',A,O,j,x,W;return l=new Ke({props:{data:u[5],x:"pe_bucket",y:"nb_stocks",xAxisTitle:"Fourchette P/E Forward",yAxisTitle:"Nombre d'Actions",title:"Histogramme — P/E Forward",sort:"false",emptySet:"pass"}}),g=new Ze({props:{data:u[18],rows:"15",emptySet:"pass",$$slots:{default:[aa]},$$scope:{ctx:u}}}),M=new Or({props:{data:u[6],nameCol:"tier",valueCol:"nb",title:"Repartition par Taille de Capitalisation",emptySet:"pass"}}),V=new Ke({props:{data:u[15],x:"sector",y:["gross_margin","operating_margin","profit_margin"],title:"Marges Brute, Operationnelle et Nette par Secteur",yAxisTitle:"Marge (%)",swapXY:"true",sort:"false",type:"grouped",emptySet:"pass"}}),O=new Ke({props:{data:u[12],x:"symbol",y:"dividend_yield",xAxisTitle:"Ticker",yAxisTitle:"Dividend Yield (%)",title:"Meilleurs Rendements en Dividende",sort:"false",emptySet:"pass"}}),x=new Ze({props:{data:u[12],rows:"10",emptySet:"pass",$$slots:{default:[sa]},$$scope:{ctx:u}}}),{c(){t=z("h3"),t.innerHTML=r,e=k(),q(l.$$.fragment),n=k(),a=z("h3"),a.innerHTML=_,E=k(),q(g.$$.fragment),y=k(),s=z("h3"),s.innerHTML=H,m=k(),q(M.$$.fragment),i=k(),C=z("h3"),C.innerHTML=b,I=k(),q(V.$$.fragment),Y=k(),P=z("h3"),P.innerHTML=L,A=k(),q(O.$$.fragment),j=k(),q(x.$$.fragment),this.h()},l(d){t=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(t)!=="svelte-18klvr6"&&(t.innerHTML=r),e=v(d),R(l.$$.fragment,d),n=v(d),a=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(a)!=="svelte-hz91lo"&&(a.innerHTML=_),E=v(d),R(g.$$.fragment,d),y=v(d),s=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(s)!=="svelte-ipos3n"&&(s.innerHTML=H),m=v(d),R(M.$$.fragment,d),i=v(d),C=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(C)!=="svelte-lamgbz"&&(C.innerHTML=b),I=v(d),R(V.$$.fragment,d),Y=v(d),P=G(d,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(P)!=="svelte-1lnx20g"&&(P.innerHTML=L),A=v(d),R(O.$$.fragment,d),j=v(d),R(x.$$.fragment,d),this.h()},h(){N(t,"class","markdown"),N(t,"id","distribution-du-pe-forward"),N(a,"class","markdown"),N(a,"id","pe-forward-par-secteur-box-plot"),N(s,"class","markdown"),N(s,"id","pyramide-des-capitalisations"),N(C,"class","markdown"),N(C,"id","marges-par-secteur-"),N(P,"class","markdown"),N(P,"id","top-10-rendements-en-dividende")},m(d,F){c(d,t,F),c(d,e,F),T(l,d,F),c(d,n,F),c(d,a,F),c(d,E,F),T(g,d,F),c(d,y,F),c(d,s,F),c(d,m,F),T(M,d,F),c(d,i,F),c(d,C,F),c(d,I,F),T(V,d,F),c(d,Y,F),c(d,P,F),c(d,A,F),T(O,d,F),c(d,j,F),T(x,d,F),W=!0},p(d,F){const be={};F[0]&32&&(be.data=d[5]),l.$set(be);const X={};F[0]&262144&&(X.data=d[18]),F[4]&4&&(X.$$scope={dirty:F,ctx:d}),g.$set(X);const ve={};F[0]&64&&(ve.data=d[6]),M.$set(ve);const Z={};F[0]&32768&&(Z.data=d[15]),V.$set(Z);const He={};F[0]&4096&&(He.data=d[12]),O.$set(He);const we={};F[0]&4096&&(we.data=d[12]),F[4]&4&&(we.$$scope={dirty:F,ctx:d}),x.$set(we)},i(d){W||(p(l.$$.fragment,d),p(g.$$.fragment,d),p(M.$$.fragment,d),p(V.$$.fragment,d),p(O.$$.fragment,d),p(x.$$.fragment,d),W=!0)},o(d){$(l.$$.fragment,d),$(g.$$.fragment,d),$(M.$$.fragment,d),$(V.$$.fragment,d),$(O.$$.fragment,d),$(x.$$.fragment,d),W=!1},d(d){d&&(f(t),f(e),f(n),f(a),f(E),f(y),f(s),f(m),f(i),f(C),f(I),f(Y),f(P),f(A),f(j)),h(l,d),h(g,d),h(M,d),h(V,d),h(O,d),h(x,d)}}}function oa(u){let t,r,e,l,n,a,_,E,g,y,s,H,m,M;return t=new D({props:{id:"symbol",title:"Ticker"}}),e=new D({props:{id:"name",title:"Nom"}}),n=new D({props:{id:"price",title:"Prix",fmt:"usd"}}),_=new D({props:{id:"change_pct",title:"Var %",fmt:"num2"}}),g=new D({props:{id:"volume",title:"Volume",fmt:"#,##0"}}),s=new D({props:{id:"sector",title:"Secteur"}}),m=new D({props:{id:"region",title:"Region"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment),y=k(),q(s.$$.fragment),H=k(),q(m.$$.fragment)},l(i){R(t.$$.fragment,i),r=v(i),R(e.$$.fragment,i),l=v(i),R(n.$$.fragment,i),a=v(i),R(_.$$.fragment,i),E=v(i),R(g.$$.fragment,i),y=v(i),R(s.$$.fragment,i),H=v(i),R(m.$$.fragment,i)},m(i,C){T(t,i,C),c(i,r,C),T(e,i,C),c(i,l,C),T(n,i,C),c(i,a,C),T(_,i,C),c(i,E,C),T(g,i,C),c(i,y,C),T(s,i,C),c(i,H,C),T(m,i,C),M=!0},p:Le,i(i){M||(p(t.$$.fragment,i),p(e.$$.fragment,i),p(n.$$.fragment,i),p(_.$$.fragment,i),p(g.$$.fragment,i),p(s.$$.fragment,i),p(m.$$.fragment,i),M=!0)},o(i){$(t.$$.fragment,i),$(e.$$.fragment,i),$(n.$$.fragment,i),$(_.$$.fragment,i),$(g.$$.fragment,i),$(s.$$.fragment,i),$(m.$$.fragment,i),M=!1},d(i){i&&(f(r),f(l),f(a),f(E),f(y),f(H)),h(t,i),h(e,i),h(n,i),h(_,i),h(g,i),h(s,i),h(m,i)}}}function ia(u){let t,r,e,l,n,a,_,E,g,y,s,H,m,M;return t=new D({props:{id:"symbol",title:"Ticker"}}),e=new D({props:{id:"name",title:"Nom"}}),n=new D({props:{id:"price",title:"Prix",fmt:"usd"}}),_=new D({props:{id:"change_pct",title:"Var %",fmt:"num2"}}),g=new D({props:{id:"volume",title:"Volume",fmt:"#,##0"}}),s=new D({props:{id:"sector",title:"Secteur"}}),m=new D({props:{id:"region",title:"Region"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment),y=k(),q(s.$$.fragment),H=k(),q(m.$$.fragment)},l(i){R(t.$$.fragment,i),r=v(i),R(e.$$.fragment,i),l=v(i),R(n.$$.fragment,i),a=v(i),R(_.$$.fragment,i),E=v(i),R(g.$$.fragment,i),y=v(i),R(s.$$.fragment,i),H=v(i),R(m.$$.fragment,i)},m(i,C){T(t,i,C),c(i,r,C),T(e,i,C),c(i,l,C),T(n,i,C),c(i,a,C),T(_,i,C),c(i,E,C),T(g,i,C),c(i,y,C),T(s,i,C),c(i,H,C),T(m,i,C),M=!0},p:Le,i(i){M||(p(t.$$.fragment,i),p(e.$$.fragment,i),p(n.$$.fragment,i),p(_.$$.fragment,i),p(g.$$.fragment,i),p(s.$$.fragment,i),p(m.$$.fragment,i),M=!0)},o(i){$(t.$$.fragment,i),$(e.$$.fragment,i),$(n.$$.fragment,i),$(_.$$.fragment,i),$(g.$$.fragment,i),$(s.$$.fragment,i),$(m.$$.fragment,i),M=!1},d(i){i&&(f(r),f(l),f(a),f(E),f(y),f(H)),h(t,i),h(e,i),h(n,i),h(_,i),h(g,i),h(s,i),h(m,i)}}}function la(u){let t,r,e='<a href="#top-10-hausses">Top 10 Hausses</a>',l,n,a,_,E,g='<a href="#top-10-baisses">Top 10 Baisses</a>',y,s,H;return n=new Ze({props:{data:u[9],rows:"10",emptySet:"pass",$$slots:{default:[oa]},$$scope:{ctx:u}}}),s=new Ze({props:{data:u[10],rows:"10",emptySet:"pass",$$slots:{default:[ia]},$$scope:{ctx:u}}}),{c(){t=z("div"),r=z("h3"),r.innerHTML=e,l=k(),q(n.$$.fragment),a=k(),_=z("div"),E=z("h3"),E.innerHTML=g,y=k(),q(s.$$.fragment),this.h()},l(m){t=G(m,"DIV",{});var M=pt(t);r=G(M,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(r)!=="svelte-4ihfgk"&&(r.innerHTML=e),l=v(M),R(n.$$.fragment,M),M.forEach(f),a=v(m),_=G(m,"DIV",{});var i=pt(_);E=G(i,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(E)!=="svelte-yok1a2"&&(E.innerHTML=g),y=v(i),R(s.$$.fragment,i),i.forEach(f),this.h()},h(){N(r,"class","markdown"),N(r,"id","top-10-hausses"),N(E,"class","markdown"),N(E,"id","top-10-baisses")},m(m,M){c(m,t,M),Ie(t,r),Ie(t,l),T(n,t,null),c(m,a,M),c(m,_,M),Ie(_,E),Ie(_,y),T(s,_,null),H=!0},p(m,M){const i={};M[0]&512&&(i.data=m[9]),M[4]&4&&(i.$$scope={dirty:M,ctx:m}),n.$set(i);const C={};M[0]&1024&&(C.data=m[10]),M[4]&4&&(C.$$scope={dirty:M,ctx:m}),s.$set(C)},i(m){H||(p(n.$$.fragment,m),p(s.$$.fragment,m),H=!0)},o(m){$(n.$$.fragment,m),$(s.$$.fragment,m),H=!1},d(m){m&&(f(t),f(a),f(_)),h(n),h(s)}}}function ma(u){let t,r,e,l,n,a,_,E,g,y,s,H,m,M,i,C;return t=new D({props:{id:"symbol",title:"Ticker"}}),e=new D({props:{id:"name",title:"Nom"}}),n=new D({props:{id:"price",title:"Prix Actuel",fmt:"usd"}}),_=new D({props:{id:"target_price",title:"Target Analystes",fmt:"usd"}}),g=new D({props:{id:"upside_pct",title:"Upside (%)",fmt:"num1"}}),s=new D({props:{id:"recommendation",title:"Reco."}}),m=new D({props:{id:"sector",title:"Secteur"}}),i=new D({props:{id:"region",title:"Region"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment),y=k(),q(s.$$.fragment),H=k(),q(m.$$.fragment),M=k(),q(i.$$.fragment)},l(b){R(t.$$.fragment,b),r=v(b),R(e.$$.fragment,b),l=v(b),R(n.$$.fragment,b),a=v(b),R(_.$$.fragment,b),E=v(b),R(g.$$.fragment,b),y=v(b),R(s.$$.fragment,b),H=v(b),R(m.$$.fragment,b),M=v(b),R(i.$$.fragment,b)},m(b,I){T(t,b,I),c(b,r,I),T(e,b,I),c(b,l,I),T(n,b,I),c(b,a,I),T(_,b,I),c(b,E,I),T(g,b,I),c(b,y,I),T(s,b,I),c(b,H,I),T(m,b,I),c(b,M,I),T(i,b,I),C=!0},p:Le,i(b){C||(p(t.$$.fragment,b),p(e.$$.fragment,b),p(n.$$.fragment,b),p(_.$$.fragment,b),p(g.$$.fragment,b),p(s.$$.fragment,b),p(m.$$.fragment,b),p(i.$$.fragment,b),C=!0)},o(b){$(t.$$.fragment,b),$(e.$$.fragment,b),$(n.$$.fragment,b),$(_.$$.fragment,b),$(g.$$.fragment,b),$(s.$$.fragment,b),$(m.$$.fragment,b),$(i.$$.fragment,b),C=!1},d(b){b&&(f(r),f(l),f(a),f(E),f(y),f(H),f(M)),h(t,b),h(e,b),h(n,b),h(_,b),h(g,b),h(s,b),h(m,b),h(i,b)}}}function _a(u){let t,r,e,l='<a href="#top-10-potentiel-de-hausse-upside-analystes">Top 10 Potentiel de Hausse (Upside Analystes)</a>',n,a,_,E,g;return t=new qt({props:{cols:"2",$$slots:{default:[la]},$$scope:{ctx:u}}}),a=new Ze({props:{data:u[11],rows:"10",emptySet:"pass",$$slots:{default:[ma]},$$scope:{ctx:u}}}),E=new Ke({props:{data:u[11],x:"symbol",y:"upside_pct",xAxisTitle:"Ticker",yAxisTitle:"Upside (%)",title:"Top 10 Potentiel de Hausse selon les Analystes",sort:"false",emptySet:"pass"}}),{c(){q(t.$$.fragment),r=k(),e=z("h3"),e.innerHTML=l,n=k(),q(a.$$.fragment),_=k(),q(E.$$.fragment),this.h()},l(y){R(t.$$.fragment,y),r=v(y),e=G(y,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(e)!=="svelte-ttxo5p"&&(e.innerHTML=l),n=v(y),R(a.$$.fragment,y),_=v(y),R(E.$$.fragment,y),this.h()},h(){N(e,"class","markdown"),N(e,"id","top-10-potentiel-de-hausse-upside-analystes")},m(y,s){T(t,y,s),c(y,r,s),c(y,e,s),c(y,n,s),T(a,y,s),c(y,_,s),T(E,y,s),g=!0},p(y,s){const H={};s[0]&1536|s[4]&4&&(H.$$scope={dirty:s,ctx:y}),t.$set(H);const m={};s[0]&2048&&(m.data=y[11]),s[4]&4&&(m.$$scope={dirty:s,ctx:y}),a.$set(m);const M={};s[0]&2048&&(M.data=y[11]),E.$set(M)},i(y){g||(p(t.$$.fragment,y),p(a.$$.fragment,y),p(E.$$.fragment,y),g=!0)},o(y){$(t.$$.fragment,y),$(a.$$.fragment,y),$(E.$$.fragment,y),g=!1},d(y){y&&(f(r),f(e),f(n),f(_)),h(t,y),h(a,y),h(E,y)}}}function fa(u){let t,r,e,l,n,a,_,E,g,y,s,H,m,M,i,C,b,I,V,Y,P,L,A,O,j,x,W,d,F,be,X,ve,Z,He,we,ke,he,Te;return t=new D({props:{id:"symbol",title:"Ticker"}}),e=new D({props:{id:"name",title:"Nom"}}),n=new D({props:{id:"price",title:"Prix",fmt:"usd"}}),_=new D({props:{id:"change_pct",title:"Var %",fmt:"num2"}}),g=new D({props:{id:"volume",title:"Volume",fmt:"#,##0"}}),s=new D({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),m=new D({props:{id:"pe_trailing",title:"P/E Trail.",fmt:"num1"}}),i=new D({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),b=new D({props:{id:"dividend_yield",title:"Div %",fmt:"num2"}}),V=new D({props:{id:"beta",title:"Beta",fmt:"num2"}}),P=new D({props:{id:"revenue_growth",title:"Croiss. CA %",fmt:"num1"}}),A=new D({props:{id:"earnings_growth",title:"Croiss. BPA %",fmt:"num1"}}),j=new D({props:{id:"profit_margin",title:"Marge Nette %",fmt:"num1"}}),W=new D({props:{id:"roe",title:"ROE %",fmt:"num1"}}),F=new D({props:{id:"target_price",title:"Target",fmt:"usd"}}),X=new D({props:{id:"recommendation",title:"Reco."}}),Z=new D({props:{id:"sector",title:"Secteur"}}),we=new D({props:{id:"region",title:"Region"}}),he=new D({props:{id:"country",title:"Pays"}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment),y=k(),q(s.$$.fragment),H=k(),q(m.$$.fragment),M=k(),q(i.$$.fragment),C=k(),q(b.$$.fragment),I=k(),q(V.$$.fragment),Y=k(),q(P.$$.fragment),L=k(),q(A.$$.fragment),O=k(),q(j.$$.fragment),x=k(),q(W.$$.fragment),d=k(),q(F.$$.fragment),be=k(),q(X.$$.fragment),ve=k(),q(Z.$$.fragment),He=k(),q(we.$$.fragment),ke=k(),q(he.$$.fragment)},l(w){R(t.$$.fragment,w),r=v(w),R(e.$$.fragment,w),l=v(w),R(n.$$.fragment,w),a=v(w),R(_.$$.fragment,w),E=v(w),R(g.$$.fragment,w),y=v(w),R(s.$$.fragment,w),H=v(w),R(m.$$.fragment,w),M=v(w),R(i.$$.fragment,w),C=v(w),R(b.$$.fragment,w),I=v(w),R(V.$$.fragment,w),Y=v(w),R(P.$$.fragment,w),L=v(w),R(A.$$.fragment,w),O=v(w),R(j.$$.fragment,w),x=v(w),R(W.$$.fragment,w),d=v(w),R(F.$$.fragment,w),be=v(w),R(X.$$.fragment,w),ve=v(w),R(Z.$$.fragment,w),He=v(w),R(we.$$.fragment,w),ke=v(w),R(he.$$.fragment,w)},m(w,U){T(t,w,U),c(w,r,U),T(e,w,U),c(w,l,U),T(n,w,U),c(w,a,U),T(_,w,U),c(w,E,U),T(g,w,U),c(w,y,U),T(s,w,U),c(w,H,U),T(m,w,U),c(w,M,U),T(i,w,U),c(w,C,U),T(b,w,U),c(w,I,U),T(V,w,U),c(w,Y,U),T(P,w,U),c(w,L,U),T(A,w,U),c(w,O,U),T(j,w,U),c(w,x,U),T(W,w,U),c(w,d,U),T(F,w,U),c(w,be,U),T(X,w,U),c(w,ve,U),T(Z,w,U),c(w,He,U),T(we,w,U),c(w,ke,U),T(he,w,U),Te=!0},p:Le,i(w){Te||(p(t.$$.fragment,w),p(e.$$.fragment,w),p(n.$$.fragment,w),p(_.$$.fragment,w),p(g.$$.fragment,w),p(s.$$.fragment,w),p(m.$$.fragment,w),p(i.$$.fragment,w),p(b.$$.fragment,w),p(V.$$.fragment,w),p(P.$$.fragment,w),p(A.$$.fragment,w),p(j.$$.fragment,w),p(W.$$.fragment,w),p(F.$$.fragment,w),p(X.$$.fragment,w),p(Z.$$.fragment,w),p(we.$$.fragment,w),p(he.$$.fragment,w),Te=!0)},o(w){$(t.$$.fragment,w),$(e.$$.fragment,w),$(n.$$.fragment,w),$(_.$$.fragment,w),$(g.$$.fragment,w),$(s.$$.fragment,w),$(m.$$.fragment,w),$(i.$$.fragment,w),$(b.$$.fragment,w),$(V.$$.fragment,w),$(P.$$.fragment,w),$(A.$$.fragment,w),$(j.$$.fragment,w),$(W.$$.fragment,w),$(F.$$.fragment,w),$(X.$$.fragment,w),$(Z.$$.fragment,w),$(we.$$.fragment,w),$(he.$$.fragment,w),Te=!1},d(w){w&&(f(r),f(l),f(a),f(E),f(y),f(H),f(M),f(C),f(I),f(Y),f(L),f(O),f(x),f(d),f(be),f(ve),f(He),f(ke)),h(t,w),h(e,w),h(n,w),h(_,w),h(g,w),h(s,w),h(m,w),h(i,w),h(b,w),h(V,w),h(P,w),h(A,w),h(j,w),h(W,w),h(F,w),h(X,w),h(Z,w),h(we,w),h(he,w)}}}function ua(u){let t,r='<a href="#nuage-de-points--pe-forward-vs-variation-">Nuage de Points : P/E Forward vs Variation (%)</a>',e,l,n,a,_='<a href="#croissance-du-ca-vs-pe-forward">Croissance du CA vs P/E Forward</a>',E,g,y,s,H,m,M=u[0][0].total_stocks+"",i,C,b,I,V,Y,P;return l=new rr({props:{data:u[7],x:"pe_forward",y:"change_pct",size:"market_cap",series:"sector",xAxisTitle:"P/E Forward",yAxisTitle:"Variation (%)",title:"Valorisation vs Performance — Taille = Capitalisation",tooltipTitle:"symbol",emptySet:"pass"}}),g=new rr({props:{data:u[16],x:"pe_forward",y:"revenue_growth",size:"market_cap",series:"sector",xAxisTitle:"P/E Forward",yAxisTitle:"Croissance CA (%)",title:"Growth vs Value — Taille = Capitalisation",tooltipTitle:"symbol",emptySet:"pass"}}),I=new Ze({props:{data:u[13],search:"true",rows:"20",emptySet:"pass",$$slots:{default:[fa]},$$scope:{ctx:u}}}),Y=new Dr({props:{data:u[13],text:"Telecharger toutes les donnees (CSV)"}}),{c(){t=z("h3"),t.innerHTML=r,e=k(),q(l.$$.fragment),n=k(),a=z("h3"),a.innerHTML=_,E=k(),q(g.$$.fragment),y=k(),s=z("h3"),H=z("a"),m=Ve("Toutes les Actions ("),i=Ve(M),C=Ve(")"),b=k(),q(I.$$.fragment),V=k(),q(Y.$$.fragment),this.h()},l(L){t=G(L,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(t)!=="svelte-1q9imhd"&&(t.innerHTML=r),e=v(L),R(l.$$.fragment,L),n=v(L),a=G(L,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ye(a)!=="svelte-pnjjrz"&&(a.innerHTML=_),E=v(L),R(g.$$.fragment,L),y=v(L),s=G(L,"H3",{class:!0,id:!0});var A=pt(s);H=G(A,"A",{href:!0});var O=pt(H);m=Pe(O,"Toutes les Actions ("),i=Pe(O,M),C=Pe(O,")"),O.forEach(f),A.forEach(f),b=v(L),R(I.$$.fragment,L),V=v(L),R(Y.$$.fragment,L),this.h()},h(){N(t,"class","markdown"),N(t,"id","nuage-de-points--pe-forward-vs-variation-"),N(a,"class","markdown"),N(a,"id","croissance-du-ca-vs-pe-forward"),N(H,"href","#toutes-les-actions-total_stats0total_stocks"),N(s,"class","markdown"),N(s,"id","toutes-les-actions-total_stats0total_stocks")},m(L,A){c(L,t,A),c(L,e,A),T(l,L,A),c(L,n,A),c(L,a,A),c(L,E,A),T(g,L,A),c(L,y,A),c(L,s,A),Ie(s,H),Ie(H,m),Ie(H,i),Ie(H,C),c(L,b,A),T(I,L,A),c(L,V,A),T(Y,L,A),P=!0},p(L,A){const O={};A[0]&128&&(O.data=L[7]),l.$set(O);const j={};A[0]&65536&&(j.data=L[16]),g.$set(j),(!P||A[0]&1)&&M!==(M=L[0][0].total_stocks+"")&&yr(i,M);const x={};A[0]&8192&&(x.data=L[13]),A[4]&4&&(x.$$scope={dirty:A,ctx:L}),I.$set(x);const W={};A[0]&8192&&(W.data=L[13]),Y.$set(W)},i(L){P||(p(l.$$.fragment,L),p(g.$$.fragment,L),p(I.$$.fragment,L),p(Y.$$.fragment,L),P=!0)},o(L){$(l.$$.fragment,L),$(g.$$.fragment,L),$(I.$$.fragment,L),$(Y.$$.fragment,L),P=!1},d(L){L&&(f(t),f(e),f(n),f(a),f(E),f(y),f(s),f(b),f(V)),h(l,L),h(g,L),h(I,L),h(Y,L)}}}function pa(u){let t,r,e,l,n,a,_,E;return t=new St({props:{label:"Vue Globale",$$slots:{default:[ra]},$$scope:{ctx:u}}}),e=new St({props:{label:"Distribution",$$slots:{default:[na]},$$scope:{ctx:u}}}),n=new St({props:{label:"Top & Flop",$$slots:{default:[_a]},$$scope:{ctx:u}}}),_=new St({props:{label:"Explorer",$$slots:{default:[ua]},$$scope:{ctx:u}}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment)},l(g){R(t.$$.fragment,g),r=v(g),R(e.$$.fragment,g),l=v(g),R(n.$$.fragment,g),a=v(g),R(_.$$.fragment,g)},m(g,y){T(t,g,y),c(g,r,y),T(e,g,y),c(g,l,y),T(n,g,y),c(g,a,y),T(_,g,y),E=!0},p(g,y){const s={};y[0]&147486|y[4]&4&&(s.$$scope={dirty:y,ctx:g}),t.$set(s);const H={};y[0]&299104|y[4]&4&&(H.$$scope={dirty:y,ctx:g}),e.$set(H);const m={};y[0]&3584|y[4]&4&&(m.$$scope={dirty:y,ctx:g}),n.$set(m);const M={};y[0]&73857|y[4]&4&&(M.$$scope={dirty:y,ctx:g}),_.$set(M)},i(g){E||(p(t.$$.fragment,g),p(e.$$.fragment,g),p(n.$$.fragment,g),p(_.$$.fragment,g),E=!0)},o(g){$(t.$$.fragment,g),$(e.$$.fragment,g),$(n.$$.fragment,g),$(_.$$.fragment,g),E=!1},d(g){g&&(f(r),f(l),f(a)),h(t,g),h(e,g),h(n,g),h(_,g)}}}function ca(u){let t;return{c(){t=Ve("Explorateur d'Actions")},l(r){t=Pe(r,"Explorateur d'Actions")},m(r,e){c(r,t,e)},d(r){r&&f(t)}}}function $a(u){let t;return{c(){t=Ve("Analyse Sectorielle")},l(r){t=Pe(r,"Analyse Sectorielle")},m(r,e){c(r,t,e)},d(r){r&&f(t)}}}function da(u){let t;return{c(){t=Ve("Analyse Geographique")},l(r){t=Pe(r,"Analyse Geographique")},m(r,e){c(r,t,e)},d(r){r&&f(t)}}}function ga(u){let t;return{c(){t=Ve("Lab de Valorisation")},l(r){t=Pe(r,"Lab de Valorisation")},m(r,e){c(r,t,e)},d(r){r&&f(t)}}}function ba(u){let t;return{c(){t=Ve("Croissance & Rentabilite")},l(r){t=Pe(r,"Croissance & Rentabilite")},m(r,e){c(r,t,e)},d(r){r&&f(t)}}}function wa(u){let t,r,e,l,n,a,_,E,g,y;return t=new Rt({props:{url:"/explorer",$$slots:{default:[ca]},$$scope:{ctx:u}}}),e=new Rt({props:{url:"/sectors",$$slots:{default:[$a]},$$scope:{ctx:u}}}),n=new Rt({props:{url:"/regions",$$slots:{default:[da]},$$scope:{ctx:u}}}),_=new Rt({props:{url:"/valuations",$$slots:{default:[ga]},$$scope:{ctx:u}}}),g=new Rt({props:{url:"/earnings",$$slots:{default:[ba]},$$scope:{ctx:u}}}),{c(){q(t.$$.fragment),r=k(),q(e.$$.fragment),l=k(),q(n.$$.fragment),a=k(),q(_.$$.fragment),E=k(),q(g.$$.fragment)},l(s){R(t.$$.fragment,s),r=v(s),R(e.$$.fragment,s),l=v(s),R(n.$$.fragment,s),a=v(s),R(_.$$.fragment,s),E=v(s),R(g.$$.fragment,s)},m(s,H){T(t,s,H),c(s,r,H),T(e,s,H),c(s,l,H),T(n,s,H),c(s,a,H),T(_,s,H),c(s,E,H),T(g,s,H),y=!0},p(s,H){const m={};H[4]&4&&(m.$$scope={dirty:H,ctx:s}),t.$set(m);const M={};H[4]&4&&(M.$$scope={dirty:H,ctx:s}),e.$set(M);const i={};H[4]&4&&(i.$$scope={dirty:H,ctx:s}),n.$set(i);const C={};H[4]&4&&(C.$$scope={dirty:H,ctx:s}),_.$set(C);const b={};H[4]&4&&(b.$$scope={dirty:H,ctx:s}),g.$set(b)},i(s){y||(p(t.$$.fragment,s),p(e.$$.fragment,s),p(n.$$.fragment,s),p(_.$$.fragment,s),p(g.$$.fragment,s),y=!0)},o(s){$(t.$$.fragment,s),$(e.$$.fragment,s),$(n.$$.fragment,s),$(_.$$.fragment,s),$(g.$$.fragment,s),y=!1},d(s){s&&(f(r),f(l),f(a),f(E)),h(t,s),h(e,s),h(n,s),h(_,s),h(g,s)}}}function va(u){let t,r,e,l,n,a,_="← Retour Market Watch",E,g,y,s,H,m,M,i,C,b,I,V,Y,P,L,A,O,j,x,W,d,F='<a href="#radiographie-des-145-plus-grandes-capitalisations-mondiales">Radiographie des 145 Plus Grandes Capitalisations Mondiales</a>',be,X,ve,Z,He='<a href="#metriques-cles">Metriques Cles</a>',we,ke,he,Te,w,U,Ye,Ce,Be,Oe,je,De,ct='<a href="#naviguer-dans-le-laboratoire">Naviguer dans le Laboratoire</a>',Ue,Fe,Ge,Ne=typeof K<"u"&&K.title&&K.hide_title!==!0&&Gr();function gt(o,S){return typeof K<"u"&&K.title?Qr:zr}let Ae=gt()(u),Me=typeof K=="object"&&Yr(),ne=u[0]&&ar(u),me=u[1]&&sr(u),_e=u[2]&&nr(u),fe=u[3]&&or(u),J=u[4]&&ir(u),ee=u[5]&&lr(u),oe=u[6]&&mr(u),ue=u[7]&&_r(u),pe=u[8]&&fr(u),ce=u[9]&&ur(u),te=u[10]&&pr(u),re=u[11]&&cr(u),ie=u[12]&&$r(u),$e=u[13]&&dr(u),de=u[14]&&gr(u),ge=u[15]&&br(u),ae=u[16]&&wr(u),se=u[17]&&vr(u),le=u[18]&&kr(u);return X=new Br({props:{status:"info",$$slots:{default:[Xr]},$$scope:{ctx:u}}}),ke=new qt({props:{cols:"5",$$slots:{default:[Kr]},$$scope:{ctx:u}}}),Te=new qt({props:{cols:"3",$$slots:{default:[Zr]},$$scope:{ctx:u}}}),Ce=new Ur({props:{$$slots:{default:[pa]},$$scope:{ctx:u}}}),Fe=new qt({props:{cols:"5",$$slots:{default:[wa]},$$scope:{ctx:u}}}),{c(){Ne&&Ne.c(),t=k(),Ae.c(),r=z("meta"),e=z("meta"),Me&&Me.c(),l=Ht(),n=k(),a=z("a"),a.textContent=_,E=k(),ne&&ne.c(),g=k(),me&&me.c(),y=k(),_e&&_e.c(),s=k(),fe&&fe.c(),H=k(),J&&J.c(),m=k(),ee&&ee.c(),M=k(),oe&&oe.c(),i=k(),ue&&ue.c(),C=k(),pe&&pe.c(),b=k(),ce&&ce.c(),I=k(),te&&te.c(),V=k(),re&&re.c(),Y=k(),ie&&ie.c(),P=k(),$e&&$e.c(),L=k(),de&&de.c(),A=k(),ge&&ge.c(),O=k(),ae&&ae.c(),j=k(),se&&se.c(),x=k(),le&&le.c(),W=k(),d=z("h1"),d.innerHTML=F,be=k(),q(X.$$.fragment),ve=k(),Z=z("h2"),Z.innerHTML=He,we=k(),q(ke.$$.fragment),he=k(),q(Te.$$.fragment),w=k(),U=z("hr"),Ye=k(),q(Ce.$$.fragment),Be=k(),Oe=z("hr"),je=k(),De=z("h2"),De.innerHTML=ct,Ue=k(),q(Fe.$$.fragment),this.h()},l(o){Ne&&Ne.l(o),t=v(o);const S=Rr("svelte-2igo1p",document.head);Ae.l(S),r=G(S,"META",{name:!0,content:!0}),e=G(S,"META",{name:!0,content:!0}),Me&&Me.l(S),l=Ht(),S.forEach(f),n=v(o),a=G(o,"A",{href:!0,style:!0,"data-svelte-h":!0}),ye(a)!=="svelte-80akn7"&&(a.textContent=_),E=v(o),ne&&ne.l(o),g=v(o),me&&me.l(o),y=v(o),_e&&_e.l(o),s=v(o),fe&&fe.l(o),H=v(o),J&&J.l(o),m=v(o),ee&&ee.l(o),M=v(o),oe&&oe.l(o),i=v(o),ue&&ue.l(o),C=v(o),pe&&pe.l(o),b=v(o),ce&&ce.l(o),I=v(o),te&&te.l(o),V=v(o),re&&re.l(o),Y=v(o),ie&&ie.l(o),P=v(o),$e&&$e.l(o),L=v(o),de&&de.l(o),A=v(o),ge&&ge.l(o),O=v(o),ae&&ae.l(o),j=v(o),se&&se.l(o),x=v(o),le&&le.l(o),W=v(o),d=G(o,"H1",{class:!0,id:!0,"data-svelte-h":!0}),ye(d)!=="svelte-81eh5d"&&(d.innerHTML=F),be=v(o),R(X.$$.fragment,o),ve=v(o),Z=G(o,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ye(Z)!=="svelte-8vhfyw"&&(Z.innerHTML=He),we=v(o),R(ke.$$.fragment,o),he=v(o),R(Te.$$.fragment,o),w=v(o),U=G(o,"HR",{class:!0}),Ye=v(o),R(Ce.$$.fragment,o),Be=v(o),Oe=G(o,"HR",{class:!0}),je=v(o),De=G(o,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ye(De)!=="svelte-1oyu6lu"&&(De.innerHTML=ct),Ue=v(o),R(Fe.$$.fragment,o),this.h()},h(){N(r,"name","twitter:card"),N(r,"content","summary_large_image"),N(e,"name","twitter:site"),N(e,"content","@evidence_dev"),N(a,"href","/lab/"),xe(a,"display","inline-flex"),xe(a,"align-items","center"),xe(a,"gap","6px"),xe(a,"padding","6px 14px"),xe(a,"background","#f1f5f9"),xe(a,"border","1px solid #e2e8f0"),xe(a,"border-radius","8px"),xe(a,"color","#475569"),xe(a,"text-decoration","none"),xe(a,"font-size","0.85rem"),xe(a,"margin-bottom","1rem"),N(d,"class","markdown"),N(d,"id","radiographie-des-145-plus-grandes-capitalisations-mondiales"),N(Z,"class","markdown"),N(Z,"id","metriques-cles"),N(U,"class","markdown"),N(Oe,"class","markdown"),N(De,"class","markdown"),N(De,"id","naviguer-dans-le-laboratoire")},m(o,S){Ne&&Ne.m(o,S),c(o,t,S),Ae.m(document.head,null),Ie(document.head,r),Ie(document.head,e),Me&&Me.m(document.head,null),Ie(document.head,l),c(o,n,S),c(o,a,S),c(o,E,S),ne&&ne.m(o,S),c(o,g,S),me&&me.m(o,S),c(o,y,S),_e&&_e.m(o,S),c(o,s,S),fe&&fe.m(o,S),c(o,H,S),J&&J.m(o,S),c(o,m,S),ee&&ee.m(o,S),c(o,M,S),oe&&oe.m(o,S),c(o,i,S),ue&&ue.m(o,S),c(o,C,S),pe&&pe.m(o,S),c(o,b,S),ce&&ce.m(o,S),c(o,I,S),te&&te.m(o,S),c(o,V,S),re&&re.m(o,S),c(o,Y,S),ie&&ie.m(o,S),c(o,P,S),$e&&$e.m(o,S),c(o,L,S),de&&de.m(o,S),c(o,A,S),ge&&ge.m(o,S),c(o,O,S),ae&&ae.m(o,S),c(o,j,S),se&&se.m(o,S),c(o,x,S),le&&le.m(o,S),c(o,W,S),c(o,d,S),c(o,be,S),T(X,o,S),c(o,ve,S),c(o,Z,S),c(o,we,S),T(ke,o,S),c(o,he,S),T(Te,o,S),c(o,w,S),c(o,U,S),c(o,Ye,S),T(Ce,o,S),c(o,Be,S),c(o,Oe,S),c(o,je,S),c(o,De,S),c(o,Ue,S),T(Fe,o,S),Ge=!0},p(o,S){typeof K<"u"&&K.title&&K.hide_title!==!0&&Ne.p(o,S),Ae.p(o,S),typeof K=="object"&&Me.p(o,S),o[0]?ne?(ne.p(o,S),S[0]&1&&p(ne,1)):(ne=ar(o),ne.c(),p(ne,1),ne.m(g.parentNode,g)):ne&&(qe(),$(ne,1,1,()=>{ne=null}),Re()),o[1]?me?(me.p(o,S),S[0]&2&&p(me,1)):(me=sr(o),me.c(),p(me,1),me.m(y.parentNode,y)):me&&(qe(),$(me,1,1,()=>{me=null}),Re()),o[2]?_e?(_e.p(o,S),S[0]&4&&p(_e,1)):(_e=nr(o),_e.c(),p(_e,1),_e.m(s.parentNode,s)):_e&&(qe(),$(_e,1,1,()=>{_e=null}),Re()),o[3]?fe?(fe.p(o,S),S[0]&8&&p(fe,1)):(fe=or(o),fe.c(),p(fe,1),fe.m(H.parentNode,H)):fe&&(qe(),$(fe,1,1,()=>{fe=null}),Re()),o[4]?J?(J.p(o,S),S[0]&16&&p(J,1)):(J=ir(o),J.c(),p(J,1),J.m(m.parentNode,m)):J&&(qe(),$(J,1,1,()=>{J=null}),Re()),o[5]?ee?(ee.p(o,S),S[0]&32&&p(ee,1)):(ee=lr(o),ee.c(),p(ee,1),ee.m(M.parentNode,M)):ee&&(qe(),$(ee,1,1,()=>{ee=null}),Re()),o[6]?oe?(oe.p(o,S),S[0]&64&&p(oe,1)):(oe=mr(o),oe.c(),p(oe,1),oe.m(i.parentNode,i)):oe&&(qe(),$(oe,1,1,()=>{oe=null}),Re()),o[7]?ue?(ue.p(o,S),S[0]&128&&p(ue,1)):(ue=_r(o),ue.c(),p(ue,1),ue.m(C.parentNode,C)):ue&&(qe(),$(ue,1,1,()=>{ue=null}),Re()),o[8]?pe?(pe.p(o,S),S[0]&256&&p(pe,1)):(pe=fr(o),pe.c(),p(pe,1),pe.m(b.parentNode,b)):pe&&(qe(),$(pe,1,1,()=>{pe=null}),Re()),o[9]?ce?(ce.p(o,S),S[0]&512&&p(ce,1)):(ce=ur(o),ce.c(),p(ce,1),ce.m(I.parentNode,I)):ce&&(qe(),$(ce,1,1,()=>{ce=null}),Re()),o[10]?te?(te.p(o,S),S[0]&1024&&p(te,1)):(te=pr(o),te.c(),p(te,1),te.m(V.parentNode,V)):te&&(qe(),$(te,1,1,()=>{te=null}),Re()),o[11]?re?(re.p(o,S),S[0]&2048&&p(re,1)):(re=cr(o),re.c(),p(re,1),re.m(Y.parentNode,Y)):re&&(qe(),$(re,1,1,()=>{re=null}),Re()),o[12]?ie?(ie.p(o,S),S[0]&4096&&p(ie,1)):(ie=$r(o),ie.c(),p(ie,1),ie.m(P.parentNode,P)):ie&&(qe(),$(ie,1,1,()=>{ie=null}),Re()),o[13]?$e?($e.p(o,S),S[0]&8192&&p($e,1)):($e=dr(o),$e.c(),p($e,1),$e.m(L.parentNode,L)):$e&&(qe(),$($e,1,1,()=>{$e=null}),Re()),o[14]?de?(de.p(o,S),S[0]&16384&&p(de,1)):(de=gr(o),de.c(),p(de,1),de.m(A.parentNode,A)):de&&(qe(),$(de,1,1,()=>{de=null}),Re()),o[15]?ge?(ge.p(o,S),S[0]&32768&&p(ge,1)):(ge=br(o),ge.c(),p(ge,1),ge.m(O.parentNode,O)):ge&&(qe(),$(ge,1,1,()=>{ge=null}),Re()),o[16]?ae?(ae.p(o,S),S[0]&65536&&p(ae,1)):(ae=wr(o),ae.c(),p(ae,1),ae.m(j.parentNode,j)):ae&&(qe(),$(ae,1,1,()=>{ae=null}),Re()),o[17]?se?(se.p(o,S),S[0]&131072&&p(se,1)):(se=vr(o),se.c(),p(se,1),se.m(x.parentNode,x)):se&&(qe(),$(se,1,1,()=>{se=null}),Re()),o[18]?le?(le.p(o,S),S[0]&262144&&p(le,1)):(le=kr(o),le.c(),p(le,1),le.m(W.parentNode,W)):le&&(qe(),$(le,1,1,()=>{le=null}),Re());const $t={};S[0]&1|S[4]&4&&($t.$$scope={dirty:S,ctx:o}),X.$set($t);const ze={};S[0]&1|S[4]&4&&(ze.$$scope={dirty:S,ctx:o}),ke.$set(ze);const Qe={};S[0]&3|S[4]&4&&(Qe.$$scope={dirty:S,ctx:o}),Te.$set(Qe);const We={};S[0]&524031|S[4]&4&&(We.$$scope={dirty:S,ctx:o}),Ce.$set(We);const dt={};S[4]&4&&(dt.$$scope={dirty:S,ctx:o}),Fe.$set(dt)},i(o){Ge||(p(ne),p(me),p(_e),p(fe),p(J),p(ee),p(oe),p(ue),p(pe),p(ce),p(te),p(re),p(ie),p($e),p(de),p(ge),p(ae),p(se),p(le),p(X.$$.fragment,o),p(ke.$$.fragment,o),p(Te.$$.fragment,o),p(Ce.$$.fragment,o),p(Fe.$$.fragment,o),Ge=!0)},o(o){$(ne),$(me),$(_e),$(fe),$(J),$(ee),$(oe),$(ue),$(pe),$(ce),$(te),$(re),$(ie),$($e),$(de),$(ge),$(ae),$(se),$(le),$(X.$$.fragment,o),$(ke.$$.fragment,o),$(Te.$$.fragment,o),$(Ce.$$.fragment,o),$(Fe.$$.fragment,o),Ge=!1},d(o){o&&(f(t),f(n),f(a),f(E),f(g),f(y),f(s),f(H),f(m),f(M),f(i),f(C),f(b),f(I),f(V),f(Y),f(P),f(L),f(A),f(O),f(j),f(x),f(W),f(d),f(be),f(ve),f(Z),f(we),f(he),f(w),f(U),f(Ye),f(Be),f(Oe),f(je),f(De),f(Ue)),Ne&&Ne.d(o),Ae.d(o),f(r),f(e),Me&&Me.d(o),f(l),ne&&ne.d(o),me&&me.d(o),_e&&_e.d(o),fe&&fe.d(o),J&&J.d(o),ee&&ee.d(o),oe&&oe.d(o),ue&&ue.d(o),pe&&pe.d(o),ce&&ce.d(o),te&&te.d(o),re&&re.d(o),ie&&ie.d(o),$e&&$e.d(o),de&&de.d(o),ge&&ge.d(o),ae&&ae.d(o),se&&se.d(o),le&&le.d(o),h(X,o),h(ke,o),h(Te,o),h(Ce,o),h(Fe,o)}}}const K={title:"Dashboard Global"};function ka(u,t,r){let e,l;Jt(u,Vr,B=>r(97,e=B)),Jt(u,tr,B=>r(103,l=B));let{data:n}=t,{data:a={},customFormattingSettings:_,__db:E,inputs:g}=n;qr(tr,l="6666cd76f96956469e7be39d750cc7d9",l);let y=Fr(Ar(g));Er(y.subscribe(B=>g=B)),Sr(Nr,{getCustomFormats:()=>_.customFormats||[]});const s=(B,hr)=>Pr(E.query,B,{query_name:hr});Ir(s),e.params,Hr(()=>!0);let H={initialData:void 0,initialError:void 0},m=Q`select
    count(*) as total_stocks,
    round(sum(market_cap) / 1e12, 2) as total_mcap_t,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change,
    round(avg(beta), 2) as avg_beta,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks`,M=`select
    count(*) as total_stocks,
    round(sum(market_cap) / 1e12, 2) as total_mcap_t,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change,
    round(avg(beta), 2) as avg_beta,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks`;a.total_stats_data&&(a.total_stats_data instanceof Error?H.initialError=a.total_stats_data:H.initialData=a.total_stats_data,a.total_stats_columns&&(H.knownColumns=a.total_stats_columns));let i,C=!1;const b=Ee.createReactive({callback:B=>{r(0,i=B)},execFn:s},{id:"total_stats",...H});b(M,{noResolve:m,...H}),globalThis[Symbol.for("total_stats")]={get value(){return i}};let I={initialData:void 0,initialError:void 0},V=Q`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
group by region
order by total_mcap desc`,Y=`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
group by region
order by total_mcap desc`;a.by_region_data&&(a.by_region_data instanceof Error?I.initialError=a.by_region_data:I.initialData=a.by_region_data,a.by_region_columns&&(I.knownColumns=a.by_region_columns));let P,L=!1;const A=Ee.createReactive({callback:B=>{r(1,P=B)},execFn:s},{id:"by_region",...I});A(Y,{noResolve:V,...I}),globalThis[Symbol.for("by_region")]={get value(){return P}};let O={initialData:void 0,initialError:void 0},j=Q`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks
group by sector
order by total_mcap desc`,x=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks
group by sector
order by total_mcap desc`;a.by_sector_data&&(a.by_sector_data instanceof Error?O.initialError=a.by_sector_data:O.initialData=a.by_sector_data,a.by_sector_columns&&(O.knownColumns=a.by_sector_columns));let W,d=!1;const F=Ee.createReactive({callback:B=>{r(2,W=B)},execFn:s},{id:"by_sector",...O});F(x,{noResolve:j,...O}),globalThis[Symbol.for("by_sector")]={get value(){return W}};let be={initialData:void 0,initialError:void 0},X=Q`select
    cast(sector as varchar) as y_val,
    cast(region as varchar) as x_val,
    round(avg(change_pct), 2) as val
from market.stocks
group by sector, region`,ve=`select
    cast(sector as varchar) as y_val,
    cast(region as varchar) as x_val,
    round(avg(change_pct), 2) as val
from market.stocks
group by sector, region`;a.heatmap_data_data&&(a.heatmap_data_data instanceof Error?be.initialError=a.heatmap_data_data:be.initialData=a.heatmap_data_data,a.heatmap_data_columns&&(be.knownColumns=a.heatmap_data_columns));let Z,He=!1;const we=Ee.createReactive({callback:B=>{r(3,Z=B)},execFn:s},{id:"heatmap_data",...be});we(ve,{noResolve:X,...be}),globalThis[Symbol.for("heatmap_data")]={get value(){return Z}};let ke={initialData:void 0,initialError:void 0},he=Q`select
    sector,
    round(sum(market_cap) / 1e12, 2) as mcap_t
from market.stocks
group by sector
order by mcap_t desc`,Te=`select
    sector,
    round(sum(market_cap) / 1e12, 2) as mcap_t
from market.stocks
group by sector
order by mcap_t desc`;a.sector_mcap_bar_data&&(a.sector_mcap_bar_data instanceof Error?ke.initialError=a.sector_mcap_bar_data:ke.initialData=a.sector_mcap_bar_data,a.sector_mcap_bar_columns&&(ke.knownColumns=a.sector_mcap_bar_columns));let w,U=!1;const Ye=Ee.createReactive({callback:B=>{r(4,w=B)},execFn:s},{id:"sector_mcap_bar",...ke});Ye(Te,{noResolve:he,...ke}),globalThis[Symbol.for("sector_mcap_bar")]={get value(){return w}};let Ce={initialData:void 0,initialError:void 0},Be=Q`select
    case
        when pe_forward < 0 then 'Negatif'
        when pe_forward >= 0 and pe_forward < 10 then '0-10'
        when pe_forward >= 10 and pe_forward < 15 then '10-15'
        when pe_forward >= 15 and pe_forward < 20 then '15-20'
        when pe_forward >= 20 and pe_forward < 25 then '20-25'
        when pe_forward >= 25 and pe_forward < 30 then '25-30'
        when pe_forward >= 30 and pe_forward < 40 then '30-40'
        when pe_forward >= 40 and pe_forward < 60 then '40-60'
        when pe_forward >= 60 then '60+'
    end as pe_bucket,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null
group by pe_bucket
order by
    case pe_bucket
        when 'Negatif' then 0
        when '0-10' then 1
        when '10-15' then 2
        when '15-20' then 3
        when '20-25' then 4
        when '25-30' then 5
        when '30-40' then 6
        when '40-60' then 7
        when '60+' then 8
    end`,Oe=`select
    case
        when pe_forward < 0 then 'Negatif'
        when pe_forward >= 0 and pe_forward < 10 then '0-10'
        when pe_forward >= 10 and pe_forward < 15 then '10-15'
        when pe_forward >= 15 and pe_forward < 20 then '15-20'
        when pe_forward >= 20 and pe_forward < 25 then '20-25'
        when pe_forward >= 25 and pe_forward < 30 then '25-30'
        when pe_forward >= 30 and pe_forward < 40 then '30-40'
        when pe_forward >= 40 and pe_forward < 60 then '40-60'
        when pe_forward >= 60 then '60+'
    end as pe_bucket,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null
group by pe_bucket
order by
    case pe_bucket
        when 'Negatif' then 0
        when '0-10' then 1
        when '10-15' then 2
        when '15-20' then 3
        when '20-25' then 4
        when '25-30' then 5
        when '30-40' then 6
        when '40-60' then 7
        when '60+' then 8
    end`;a.pe_distribution_data&&(a.pe_distribution_data instanceof Error?Ce.initialError=a.pe_distribution_data:Ce.initialData=a.pe_distribution_data,a.pe_distribution_columns&&(Ce.knownColumns=a.pe_distribution_columns));let je,De=!1;const ct=Ee.createReactive({callback:B=>{r(5,je=B)},execFn:s},{id:"pe_distribution",...Ce});ct(Oe,{noResolve:Be,...Ce}),globalThis[Symbol.for("pe_distribution")]={get value(){return je}};let Ue={initialData:void 0,initialError:void 0},Fe=Q`select 'Mega >1T$' as tier, count(*) as nb, 1 as sort_order from market.stocks where market_cap > 1000000000000
UNION ALL
select '500B-1T$' as tier, count(*) as nb, 2 as sort_order from market.stocks where market_cap > 500000000000 and market_cap <= 1000000000000
UNION ALL
select '100B-500B$' as tier, count(*) as nb, 3 as sort_order from market.stocks where market_cap > 100000000000 and market_cap <= 500000000000
UNION ALL
select '50B-100B$' as tier, count(*) as nb, 4 as sort_order from market.stocks where market_cap > 50000000000 and market_cap <= 100000000000
UNION ALL
select '<50B$' as tier, count(*) as nb, 5 as sort_order from market.stocks where market_cap <= 50000000000
order by sort_order`,Ge=`select 'Mega >1T$' as tier, count(*) as nb, 1 as sort_order from market.stocks where market_cap > 1000000000000
UNION ALL
select '500B-1T$' as tier, count(*) as nb, 2 as sort_order from market.stocks where market_cap > 500000000000 and market_cap <= 1000000000000
UNION ALL
select '100B-500B$' as tier, count(*) as nb, 3 as sort_order from market.stocks where market_cap > 100000000000 and market_cap <= 500000000000
UNION ALL
select '50B-100B$' as tier, count(*) as nb, 4 as sort_order from market.stocks where market_cap > 50000000000 and market_cap <= 100000000000
UNION ALL
select '<50B$' as tier, count(*) as nb, 5 as sort_order from market.stocks where market_cap <= 50000000000
order by sort_order`;a.funnel_data_data&&(a.funnel_data_data instanceof Error?Ue.initialError=a.funnel_data_data:Ue.initialData=a.funnel_data_data,a.funnel_data_columns&&(Ue.knownColumns=a.funnel_data_columns));let Ne,gt=!1;const Et=Ee.createReactive({callback:B=>{r(6,Ne=B)},execFn:s},{id:"funnel_data",...Ue});Et(Ge,{noResolve:Fe,...Ue}),globalThis[Symbol.for("funnel_data")]={get value(){return Ne}};let Ae={initialData:void 0,initialError:void 0},Me=Q`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200`,ne=`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200`;a.bubble_data_data&&(a.bubble_data_data instanceof Error?Ae.initialError=a.bubble_data_data:Ae.initialData=a.bubble_data_data,a.bubble_data_columns&&(Ae.knownColumns=a.bubble_data_columns));let me,_e=!1;const fe=Ee.createReactive({callback:B=>{r(7,me=B)},execFn:s},{id:"bubble_data",...Ae});fe(ne,{noResolve:Me,...Ae}),globalThis[Symbol.for("bubble_data")]={get value(){return me}};let J={initialData:void 0,initialError:void 0},ee=Q`select
    cast(sector as varchar) as sector,
    region,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by sector, region
order by sector`,oe=`select
    cast(sector as varchar) as sector,
    region,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by sector, region
order by sector`;a.cumulative_mcap_by_region_data&&(a.cumulative_mcap_by_region_data instanceof Error?J.initialError=a.cumulative_mcap_by_region_data:J.initialData=a.cumulative_mcap_by_region_data,a.cumulative_mcap_by_region_columns&&(J.knownColumns=a.cumulative_mcap_by_region_columns));let ue,pe=!1;const ce=Ee.createReactive({callback:B=>{r(8,ue=B)},execFn:s},{id:"cumulative_mcap_by_region",...J});ce(oe,{noResolve:ee,...J}),globalThis[Symbol.for("cumulative_mcap_by_region")]={get value(){return ue}};let te={initialData:void 0,initialError:void 0},re=Q`select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct desc
limit 10`,ie=`select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct desc
limit 10`;a.top_movers_data&&(a.top_movers_data instanceof Error?te.initialError=a.top_movers_data:te.initialData=a.top_movers_data,a.top_movers_columns&&(te.knownColumns=a.top_movers_columns));let $e,de=!1;const ge=Ee.createReactive({callback:B=>{r(9,$e=B)},execFn:s},{id:"top_movers",...te});ge(ie,{noResolve:re,...te}),globalThis[Symbol.for("top_movers")]={get value(){return $e}};let ae={initialData:void 0,initialError:void 0},se=Q`select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct asc
limit 10`,le=`select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct asc
limit 10`;a.worst_movers_data&&(a.worst_movers_data instanceof Error?ae.initialError=a.worst_movers_data:ae.initialData=a.worst_movers_data,a.worst_movers_columns&&(ae.knownColumns=a.worst_movers_columns));let o,S=!1;const $t=Ee.createReactive({callback:B=>{r(10,o=B)},execFn:s},{id:"worst_movers",...ae});$t(le,{noResolve:se,...ae}),globalThis[Symbol.for("worst_movers")]={get value(){return o}};let ze={initialData:void 0,initialError:void 0},Qe=Q`select
    symbol,
    name,
    price,
    target_price,
    round(((target_price - price) / price) * 100, 1) as upside_pct,
    recommendation,
    sector,
    region
from market.stocks
where target_price is not null
  and price is not null
  and price > 0
order by upside_pct desc
limit 10`,We=`select
    symbol,
    name,
    price,
    target_price,
    round(((target_price - price) / price) * 100, 1) as upside_pct,
    recommendation,
    sector,
    region
from market.stocks
where target_price is not null
  and price is not null
  and price > 0
order by upside_pct desc
limit 10`;a.top_by_upside_data&&(a.top_by_upside_data instanceof Error?ze.initialError=a.top_by_upside_data:ze.initialData=a.top_by_upside_data,a.top_by_upside_columns&&(ze.knownColumns=a.top_by_upside_columns));let dt,Mt=!1;const Ct=Ee.createReactive({callback:B=>{r(11,dt=B)},execFn:s},{id:"top_by_upside",...ze});Ct(We,{noResolve:Qe,...ze}),globalThis[Symbol.for("top_by_upside")]={get value(){return dt}};let Je={initialData:void 0,initialError:void 0},et=Q`select symbol, name, price, dividend_yield, pe_forward, market_cap, sector, region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 10`,bt=`select symbol, name, price, dividend_yield, pe_forward, market_cap, sector, region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 10`;a.top_dividends_data&&(a.top_dividends_data instanceof Error?Je.initialError=a.top_dividends_data:Je.initialData=a.top_dividends_data,a.top_dividends_columns&&(Je.knownColumns=a.top_dividends_columns));let Ft,It=!1;const Lt=Ee.createReactive({callback:B=>{r(12,Ft=B)},execFn:s},{id:"top_dividends",...Je});Lt(bt,{noResolve:et,...Je}),globalThis[Symbol.for("top_dividends")]={get value(){return Ft}};let tt={initialData:void 0,initialError:void 0},rt=Q`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    revenue_growth,
    earnings_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
order by market_cap desc`,wt=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    revenue_growth,
    earnings_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
order by market_cap desc`;a.all_stocks_data&&(a.all_stocks_data instanceof Error?tt.initialError=a.all_stocks_data:tt.initialData=a.all_stocks_data,a.all_stocks_columns&&(tt.knownColumns=a.all_stocks_columns));let Dt,Nt=!1;const At=Ee.createReactive({callback:B=>{r(13,Dt=B)},execFn:s},{id:"all_stocks",...tt});At(wt,{noResolve:rt,...tt}),globalThis[Symbol.for("all_stocks")]={get value(){return Dt}};let at={initialData:void 0,initialError:void 0},st=Q`select
    recommendation as reco,
    count(*) as nb
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by
    case recommendation
        when 'strongBuy' then 1
        when 'buy' then 2
        when 'hold' then 3
        when 'sell' then 4
        when 'strongSell' then 5
        else 6
    end`,vt=`select
    recommendation as reco,
    count(*) as nb
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by
    case recommendation
        when 'strongBuy' then 1
        when 'buy' then 2
        when 'hold' then 3
        when 'sell' then 4
        when 'strongSell' then 5
        else 6
    end`;a.recommendation_dist_data&&(a.recommendation_dist_data instanceof Error?at.initialError=a.recommendation_dist_data:at.initialData=a.recommendation_dist_data,a.recommendation_dist_columns&&(at.knownColumns=a.recommendation_dist_columns));let Bt,Ut=!1;const Pt=Ee.createReactive({callback:B=>{r(14,Bt=B)},execFn:s},{id:"recommendation_dist",...at});Pt(vt,{noResolve:st,...at}),globalThis[Symbol.for("recommendation_dist")]={get value(){return Bt}};let nt={initialData:void 0,initialError:void 0},ot=Q`select
    sector,
    round(avg(gross_margin), 1) as gross_margin,
    round(avg(operating_margin), 1) as operating_margin,
    round(avg(profit_margin), 1) as profit_margin
from market.stocks
group by sector
order by profit_margin desc`,kt=`select
    sector,
    round(avg(gross_margin), 1) as gross_margin,
    round(avg(operating_margin), 1) as operating_margin,
    round(avg(profit_margin), 1) as profit_margin
from market.stocks
group by sector
order by profit_margin desc`;a.margin_by_sector_data&&(a.margin_by_sector_data instanceof Error?nt.initialError=a.margin_by_sector_data:nt.initialData=a.margin_by_sector_data,a.margin_by_sector_columns&&(nt.knownColumns=a.margin_by_sector_columns));let Vt,Ot=!1;const xt=Ee.createReactive({callback:B=>{r(15,Vt=B)},execFn:s},{id:"margin_by_sector",...nt});xt(kt,{noResolve:ot,...nt}),globalThis[Symbol.for("margin_by_sector")]={get value(){return Vt}};let it={initialData:void 0,initialError:void 0},lt=Q`select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and revenue_growth is not null`,yt=`select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and revenue_growth is not null`;a.growth_vs_value_data&&(a.growth_vs_value_data instanceof Error?it.initialError=a.growth_vs_value_data:it.initialData=a.growth_vs_value_data,a.growth_vs_value_columns&&(it.knownColumns=a.growth_vs_value_columns));let Gt,zt=!1;const Qt=Ee.createReactive({callback:B=>{r(16,Gt=B)},execFn:s},{id:"growth_vs_value",...it});Qt(yt,{noResolve:lt,...it}),globalThis[Symbol.for("growth_vs_value")]={get value(){return Gt}};let mt={initialData:void 0,initialError:void 0},_t=Q`select
    cast(region as varchar) as region,
    cast(sector as varchar) as sector,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by region, sector
order by region, mcap_b desc`,ht=`select
    cast(region as varchar) as region,
    cast(sector as varchar) as sector,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by region, sector
order by region, mcap_b desc`;a.region_mcap_stacked_data&&(a.region_mcap_stacked_data instanceof Error?mt.initialError=a.region_mcap_stacked_data:mt.initialData=a.region_mcap_stacked_data,a.region_mcap_stacked_columns&&(mt.knownColumns=a.region_mcap_stacked_columns));let Yt,jt=!1;const Wt=Ee.createReactive({callback:B=>{r(17,Yt=B)},execFn:s},{id:"region_mcap_stacked",...mt});Wt(ht,{noResolve:_t,...mt}),globalThis[Symbol.for("region_mcap_stacked")]={get value(){return Yt}};let ft={initialData:void 0,initialError:void 0},ut=Q`select
    sector as name,
    round(percentile_cont(0.25) within group (order by pe_forward), 1) as q1,
    round(median(pe_forward), 1) as median_pe,
    round(percentile_cont(0.75) within group (order by pe_forward), 1) as q3,
    round(min(pe_forward), 1) as min_pe,
    round(max(pe_forward), 1) as max_pe
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector
order by median_pe desc`,Tt=`select
    sector as name,
    round(percentile_cont(0.25) within group (order by pe_forward), 1) as q1,
    round(median(pe_forward), 1) as median_pe,
    round(percentile_cont(0.75) within group (order by pe_forward), 1) as q3,
    round(min(pe_forward), 1) as min_pe,
    round(max(pe_forward), 1) as max_pe
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector
order by median_pe desc`;a.pe_by_sector_box_data&&(a.pe_by_sector_box_data instanceof Error?ft.initialError=a.pe_by_sector_box_data:ft.initialData=a.pe_by_sector_box_data,a.pe_by_sector_box_columns&&(ft.knownColumns=a.pe_by_sector_box_columns));let Xt,Kt=!1;const Zt=Ee.createReactive({callback:B=>{r(18,Xt=B)},execFn:s},{id:"pe_by_sector_box",...ft});return Zt(Tt,{noResolve:ut,...ft}),globalThis[Symbol.for("pe_by_sector_box")]={get value(){return Xt}},u.$$set=B=>{"data"in B&&r(19,n=B.data)},u.$$.update=()=>{u.$$.dirty[0]&524288&&r(20,{data:a={},customFormattingSettings:_,__db:E}=n,a),u.$$.dirty[0]&1048576&&Lr.set(Object.keys(a).length>0),u.$$.dirty[3]&16&&e.params,u.$$.dirty[0]&31457280&&(m||!C?m||(b(M,{noResolve:m,...H}),r(24,C=!0)):b(M,{noResolve:m})),u.$$.dirty[0]&503316480&&(V||!L?V||(A(Y,{noResolve:V,...I}),r(28,L=!0)):A(Y,{noResolve:V})),u.$$.dirty[0]&1610612736|u.$$.dirty[1]&3&&(j||!d?j||(F(x,{noResolve:j,...O}),r(32,d=!0)):F(x,{noResolve:j})),u.$$.dirty[1]&60&&(X||!He?X||(we(ve,{noResolve:X,...be}),r(36,He=!0)):we(ve,{noResolve:X})),u.$$.dirty[1]&960&&(he||!U?he||(Ye(Te,{noResolve:he,...ke}),r(40,U=!0)):Ye(Te,{noResolve:he})),u.$$.dirty[1]&15360&&(Be||!De?Be||(ct(Oe,{noResolve:Be,...Ce}),r(44,De=!0)):ct(Oe,{noResolve:Be})),u.$$.dirty[1]&245760&&(Fe||!gt?Fe||(Et(Ge,{noResolve:Fe,...Ue}),r(48,gt=!0)):Et(Ge,{noResolve:Fe})),u.$$.dirty[1]&3932160&&(Me||!_e?Me||(fe(ne,{noResolve:Me,...Ae}),r(52,_e=!0)):fe(ne,{noResolve:Me})),u.$$.dirty[1]&62914560&&(ee||!pe?ee||(ce(oe,{noResolve:ee,...J}),r(56,pe=!0)):ce(oe,{noResolve:ee})),u.$$.dirty[1]&1006632960&&(re||!de?re||(ge(ie,{noResolve:re,...te}),r(60,de=!0)):ge(ie,{noResolve:re})),u.$$.dirty[1]&1073741824|u.$$.dirty[2]&7&&(se||!S?se||($t(le,{noResolve:se,...ae}),r(64,S=!0)):$t(le,{noResolve:se})),u.$$.dirty[2]&120&&(Qe||!Mt?Qe||(Ct(We,{noResolve:Qe,...ze}),r(68,Mt=!0)):Ct(We,{noResolve:Qe})),u.$$.dirty[2]&1920&&(et||!It?et||(Lt(bt,{noResolve:et,...Je}),r(72,It=!0)):Lt(bt,{noResolve:et})),u.$$.dirty[2]&30720&&(rt||!Nt?rt||(At(wt,{noResolve:rt,...tt}),r(76,Nt=!0)):At(wt,{noResolve:rt})),u.$$.dirty[2]&491520&&(st||!Ut?st||(Pt(vt,{noResolve:st,...at}),r(80,Ut=!0)):Pt(vt,{noResolve:st})),u.$$.dirty[2]&7864320&&(ot||!Ot?ot||(xt(kt,{noResolve:ot,...nt}),r(84,Ot=!0)):xt(kt,{noResolve:ot})),u.$$.dirty[2]&125829120&&(lt||!zt?lt||(Qt(yt,{noResolve:lt,...it}),r(88,zt=!0)):Qt(yt,{noResolve:lt})),u.$$.dirty[2]&2013265920&&(_t||!jt?_t||(Wt(ht,{noResolve:_t,...mt}),r(92,jt=!0)):Wt(ht,{noResolve:_t})),u.$$.dirty[3]&15&&(ut||!Kt?ut||(Zt(Tt,{noResolve:ut,...ft}),r(96,Kt=!0)):Zt(Tt,{noResolve:ut}))},r(22,m=Q`select
    count(*) as total_stocks,
    round(sum(market_cap) / 1e12, 2) as total_mcap_t,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change,
    round(avg(beta), 2) as avg_beta,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks`),r(23,M=`select
    count(*) as total_stocks,
    round(sum(market_cap) / 1e12, 2) as total_mcap_t,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change,
    round(avg(beta), 2) as avg_beta,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks`),r(26,V=Q`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
group by region
order by total_mcap desc`),r(27,Y=`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
group by region
order by total_mcap desc`),r(30,j=Q`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks
group by sector
order by total_mcap desc`),r(31,x=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin
from market.stocks
group by sector
order by total_mcap desc`),r(34,X=Q`select
    cast(sector as varchar) as y_val,
    cast(region as varchar) as x_val,
    round(avg(change_pct), 2) as val
from market.stocks
group by sector, region`),r(35,ve=`select
    cast(sector as varchar) as y_val,
    cast(region as varchar) as x_val,
    round(avg(change_pct), 2) as val
from market.stocks
group by sector, region`),r(38,he=Q`select
    sector,
    round(sum(market_cap) / 1e12, 2) as mcap_t
from market.stocks
group by sector
order by mcap_t desc`),r(39,Te=`select
    sector,
    round(sum(market_cap) / 1e12, 2) as mcap_t
from market.stocks
group by sector
order by mcap_t desc`),r(42,Be=Q`select
    case
        when pe_forward < 0 then 'Negatif'
        when pe_forward >= 0 and pe_forward < 10 then '0-10'
        when pe_forward >= 10 and pe_forward < 15 then '10-15'
        when pe_forward >= 15 and pe_forward < 20 then '15-20'
        when pe_forward >= 20 and pe_forward < 25 then '20-25'
        when pe_forward >= 25 and pe_forward < 30 then '25-30'
        when pe_forward >= 30 and pe_forward < 40 then '30-40'
        when pe_forward >= 40 and pe_forward < 60 then '40-60'
        when pe_forward >= 60 then '60+'
    end as pe_bucket,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null
group by pe_bucket
order by
    case pe_bucket
        when 'Negatif' then 0
        when '0-10' then 1
        when '10-15' then 2
        when '15-20' then 3
        when '20-25' then 4
        when '25-30' then 5
        when '30-40' then 6
        when '40-60' then 7
        when '60+' then 8
    end`),r(43,Oe=`select
    case
        when pe_forward < 0 then 'Negatif'
        when pe_forward >= 0 and pe_forward < 10 then '0-10'
        when pe_forward >= 10 and pe_forward < 15 then '10-15'
        when pe_forward >= 15 and pe_forward < 20 then '15-20'
        when pe_forward >= 20 and pe_forward < 25 then '20-25'
        when pe_forward >= 25 and pe_forward < 30 then '25-30'
        when pe_forward >= 30 and pe_forward < 40 then '30-40'
        when pe_forward >= 40 and pe_forward < 60 then '40-60'
        when pe_forward >= 60 then '60+'
    end as pe_bucket,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null
group by pe_bucket
order by
    case pe_bucket
        when 'Negatif' then 0
        when '0-10' then 1
        when '10-15' then 2
        when '15-20' then 3
        when '20-25' then 4
        when '25-30' then 5
        when '30-40' then 6
        when '40-60' then 7
        when '60+' then 8
    end`),r(46,Fe=Q`select 'Mega >1T$' as tier, count(*) as nb, 1 as sort_order from market.stocks where market_cap > 1000000000000
UNION ALL
select '500B-1T$' as tier, count(*) as nb, 2 as sort_order from market.stocks where market_cap > 500000000000 and market_cap <= 1000000000000
UNION ALL
select '100B-500B$' as tier, count(*) as nb, 3 as sort_order from market.stocks where market_cap > 100000000000 and market_cap <= 500000000000
UNION ALL
select '50B-100B$' as tier, count(*) as nb, 4 as sort_order from market.stocks where market_cap > 50000000000 and market_cap <= 100000000000
UNION ALL
select '<50B$' as tier, count(*) as nb, 5 as sort_order from market.stocks where market_cap <= 50000000000
order by sort_order`),r(47,Ge=`select 'Mega >1T$' as tier, count(*) as nb, 1 as sort_order from market.stocks where market_cap > 1000000000000
UNION ALL
select '500B-1T$' as tier, count(*) as nb, 2 as sort_order from market.stocks where market_cap > 500000000000 and market_cap <= 1000000000000
UNION ALL
select '100B-500B$' as tier, count(*) as nb, 3 as sort_order from market.stocks where market_cap > 100000000000 and market_cap <= 500000000000
UNION ALL
select '50B-100B$' as tier, count(*) as nb, 4 as sort_order from market.stocks where market_cap > 50000000000 and market_cap <= 100000000000
UNION ALL
select '<50B$' as tier, count(*) as nb, 5 as sort_order from market.stocks where market_cap <= 50000000000
order by sort_order`),r(50,Me=Q`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200`),r(51,ne=`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200`),r(54,ee=Q`select
    cast(sector as varchar) as sector,
    region,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by sector, region
order by sector`),r(55,oe=`select
    cast(sector as varchar) as sector,
    region,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by sector, region
order by sector`),r(58,re=Q`select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct desc
limit 10`),r(59,ie=`select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct desc
limit 10`),r(62,se=Q`select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct asc
limit 10`),r(63,le=`select symbol, name, price, change_pct, volume, market_cap, sector, region
from market.stocks
order by change_pct asc
limit 10`),r(66,Qe=Q`select
    symbol,
    name,
    price,
    target_price,
    round(((target_price - price) / price) * 100, 1) as upside_pct,
    recommendation,
    sector,
    region
from market.stocks
where target_price is not null
  and price is not null
  and price > 0
order by upside_pct desc
limit 10`),r(67,We=`select
    symbol,
    name,
    price,
    target_price,
    round(((target_price - price) / price) * 100, 1) as upside_pct,
    recommendation,
    sector,
    region
from market.stocks
where target_price is not null
  and price is not null
  and price > 0
order by upside_pct desc
limit 10`),r(70,et=Q`select symbol, name, price, dividend_yield, pe_forward, market_cap, sector, region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 10`),r(71,bt=`select symbol, name, price, dividend_yield, pe_forward, market_cap, sector, region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 10`),r(74,rt=Q`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    revenue_growth,
    earnings_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
order by market_cap desc`),r(75,wt=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    revenue_growth,
    earnings_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
order by market_cap desc`),r(78,st=Q`select
    recommendation as reco,
    count(*) as nb
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by
    case recommendation
        when 'strongBuy' then 1
        when 'buy' then 2
        when 'hold' then 3
        when 'sell' then 4
        when 'strongSell' then 5
        else 6
    end`),r(79,vt=`select
    recommendation as reco,
    count(*) as nb
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by
    case recommendation
        when 'strongBuy' then 1
        when 'buy' then 2
        when 'hold' then 3
        when 'sell' then 4
        when 'strongSell' then 5
        else 6
    end`),r(82,ot=Q`select
    sector,
    round(avg(gross_margin), 1) as gross_margin,
    round(avg(operating_margin), 1) as operating_margin,
    round(avg(profit_margin), 1) as profit_margin
from market.stocks
group by sector
order by profit_margin desc`),r(83,kt=`select
    sector,
    round(avg(gross_margin), 1) as gross_margin,
    round(avg(operating_margin), 1) as operating_margin,
    round(avg(profit_margin), 1) as profit_margin
from market.stocks
group by sector
order by profit_margin desc`),r(86,lt=Q`select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and revenue_growth is not null`),r(87,yt=`select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and revenue_growth is not null`),r(90,_t=Q`select
    cast(region as varchar) as region,
    cast(sector as varchar) as sector,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by region, sector
order by region, mcap_b desc`),r(91,ht=`select
    cast(region as varchar) as region,
    cast(sector as varchar) as sector,
    round(sum(market_cap) / 1e9, 1) as mcap_b
from market.stocks
group by region, sector
order by region, mcap_b desc`),r(94,ut=Q`select
    sector as name,
    round(percentile_cont(0.25) within group (order by pe_forward), 1) as q1,
    round(median(pe_forward), 1) as median_pe,
    round(percentile_cont(0.75) within group (order by pe_forward), 1) as q3,
    round(min(pe_forward), 1) as min_pe,
    round(max(pe_forward), 1) as max_pe
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector
order by median_pe desc`),r(95,Tt=`select
    sector as name,
    round(percentile_cont(0.25) within group (order by pe_forward), 1) as q1,
    round(median(pe_forward), 1) as median_pe,
    round(percentile_cont(0.75) within group (order by pe_forward), 1) as q3,
    round(min(pe_forward), 1) as min_pe,
    round(max(pe_forward), 1) as max_pe
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector
order by median_pe desc`),[i,P,W,Z,w,je,Ne,me,ue,$e,o,dt,Ft,Dt,Bt,Vt,Gt,Yt,Xt,n,a,H,m,M,C,I,V,Y,L,O,j,x,d,be,X,ve,He,ke,he,Te,U,Ce,Be,Oe,De,Ue,Fe,Ge,gt,Ae,Me,ne,_e,J,ee,oe,pe,te,re,ie,de,ae,se,le,S,ze,Qe,We,Mt,Je,et,bt,It,tt,rt,wt,Nt,at,st,vt,Ut,nt,ot,kt,Ot,it,lt,yt,zt,mt,_t,ht,jt,ft,ut,Tt,Kt,e]}class Ia extends Mr{constructor(t){super(),Cr(this,t,ka,va,Tr,{data:19},null,[-1,-1,-1,-1,-1])}}export{Ia as component};
