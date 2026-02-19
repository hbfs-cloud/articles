import{s as Zr,d as o,i as l,a as sr,b as R,c as Ge,e as p,h as xr,f as O,g as nr,j as ve,k as v,l as U,m as Er,n as ea,o as ta,p as ra,q as aa,t as Mt,u as At,v as nt,w as sa}from"../chunks/scheduler.gCtXCaAC.js";import{S as na,i as ia,d,t as $,a as c,c as Ae,m as b,b as y,e as h,g as Le}from"../chunks/index.DmJzZqpA.js";import{D as Wr,e as oa,s as la,Q as Me,p as _a,C as V,a as Ir,b as ma,r as Sr,c as fa}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.xVnsThWF.js";import{w as ua}from"../chunks/entry.t5gz319j.js";import{A as ga,B as Ue,b as Pt,T as ca,L as Gt,Q as Ne,a as $a}from"../chunks/BigValue.vcBvE0eY.js";import{h as Q,p as pa}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{p as va}from"../chunks/stores.CdFJQivx.js";import{B as wa,a as ar}from"../chunks/ButtonGroup.DrUuNe7L.js";import{G as da}from"../chunks/Grid.B6K-jFTg.js";import{F as ba}from"../chunks/FunnelChart.DhVEYRCl.js";import{H as ya}from"../chunks/Heatmap.9L0bY0b2.js";import{H as Dr}from"../chunks/Histogram.B5PBVBjM.js";function ha(_){let r,a=z.title+"",t;return{c(){r=U("h1"),t=At(a),this.h()},l(m){r=O(m,"H1",{class:!0});var g=sa(r);t=Mt(g,a),g.forEach(o),this.h()},h(){R(r,"class","title")},m(m,g){l(m,r,g),sr(r,t)},p:nt,d(m){m&&o(r)}}}function ka(_){return{c(){this.h()},l(r){this.h()},h(){document.title="Evidence"},m:nt,p:nt,d:nt}}function Ra(_){let r,a,t,m,g;return document.title=r=z.title,{c(){a=v(),t=U("meta"),m=v(),g=U("meta"),this.h()},l(n){a=p(n),t=O(n,"META",{property:!0,content:!0}),m=p(n),g=O(n,"META",{name:!0,content:!0}),this.h()},h(){var n,k;R(t,"property","og:title"),R(t,"content",((n=z.og)==null?void 0:n.title)??z.title),R(g,"name","twitter:title"),R(g,"content",((k=z.og)==null?void 0:k.title)??z.title)},m(n,k){l(n,a,k),l(n,t,k),l(n,m,k),l(n,g,k)},p(n,k){k&0&&r!==(r=z.title)&&(document.title=r)},d(n){n&&(o(a),o(t),o(m),o(g))}}}function Ta(_){var g;let r,a,t=Ma(),m=((g=z.og)==null?void 0:g.image)&&Aa();return{c(){t&&t.c(),r=v(),m&&m.c(),a=nr()},l(n){t&&t.l(n),r=p(n),m&&m.l(n),a=nr()},m(n,k){t&&t.m(n,k),l(n,r,k),m&&m.m(n,k),l(n,a,k)},p(n,k){var E;t.p(n,k),(E=z.og)!=null&&E.image&&m.p(n,k)},d(n){n&&(o(r),o(a)),t&&t.d(n),m&&m.d(n)}}}function Ma(_){let r,a,t,m,g;return{c(){r=U("meta"),a=v(),t=U("meta"),m=v(),g=U("meta"),this.h()},l(n){r=O(n,"META",{name:!0,content:!0}),a=p(n),t=O(n,"META",{property:!0,content:!0}),m=p(n),g=O(n,"META",{name:!0,content:!0}),this.h()},h(){var n,k;R(r,"name","description"),R(r,"content",z.description),R(t,"property","og:description"),R(t,"content",((n=z.og)==null?void 0:n.description)??z.description),R(g,"name","twitter:description"),R(g,"content",((k=z.og)==null?void 0:k.description)??z.description)},m(n,k){l(n,r,k),l(n,a,k),l(n,t,k),l(n,m,k),l(n,g,k)},p:nt,d(n){n&&(o(r),o(a),o(t),o(m),o(g))}}}function Aa(_){let r,a,t;return{c(){r=U("meta"),a=v(),t=U("meta"),this.h()},l(m){r=O(m,"META",{property:!0,content:!0}),a=p(m),t=O(m,"META",{name:!0,content:!0}),this.h()},h(){var m,g;R(r,"property","og:image"),R(r,"content",Ir((m=z.og)==null?void 0:m.image)),R(t,"name","twitter:image"),R(t,"content",Ir((g=z.og)==null?void 0:g.image))},m(m,g){l(m,r,g),l(m,a,g),l(m,t,g)},p:nt,d(m){m&&(o(r),o(a),o(t))}}}function La(_){let r;return{c(){r=At("Heatmaps de marges, distributions de croissance, entonnoir de rentabilite et screening interactif Growth vs Value sur les plus grandes capitalisations mondiales.")},l(a){r=Mt(a,"Heatmaps de marges, distributions de croissance, entonnoir de rentabilite et screening interactif Growth vs Value sur les plus grandes capitalisations mondiales.")},m(a,t){l(a,r,t)},d(a){a&&o(r)}}}function Fr(_){let r,a;return r=new Ne({props:{queryID:"earn_summary_static",queryResult:_[0]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&1&&(g.queryResult=t[0]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Or(_){let r,a;return r=new Ne({props:{queryID:"heatmap_margins",queryResult:_[1]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&2&&(g.queryResult=t[1]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Ur(_){let r,a;return r=new Ne({props:{queryID:"avg_rev_growth_sector",queryResult:_[2]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&4&&(g.queryResult=t[2]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Br(_){let r,a;return r=new Ne({props:{queryID:"avg_roe_sector",queryResult:_[3]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&8&&(g.queryResult=t[3]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Gr(_){let r,a;return r=new Ne({props:{queryID:"hist_rev_growth",queryResult:_[4]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&16&&(g.queryResult=t[4]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Pr(_){let r,a;return r=new Ne({props:{queryID:"hist_profit_margin",queryResult:_[5]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&32&&(g.queryResult=t[5]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Vr(_){let r,a;return r=new Ne({props:{queryID:"funnel_profitability",queryResult:_[6]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&64&&(g.queryResult=t[6]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function jr(_){let r,a;return r=new Ne({props:{queryID:"top20_rev_growth_static",queryResult:_[7]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&128&&(g.queryResult=t[7]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Qr(_){let r,a;return r=new Ne({props:{queryID:"top20_roe_static",queryResult:_[8]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&256&&(g.queryResult=t[8]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function zr(_){let r,a;return r=new Ne({props:{queryID:"earnings_table_static",queryResult:_[9]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&512&&(g.queryResult=t[9]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Na(_){let r,a,t,m,g,n,k,E,i,C,q,S,D,A,M,I,w,T,F,X,G,Y,P,K,B,W,j,oe;return r=new V({props:{id:"symbol",title:"Ticker"}}),t=new V({props:{id:"name",title:"Nom"}}),g=new V({props:{id:"price",title:"Prix",fmt:"usd"}}),k=new V({props:{id:"revenue",title:"CA",fmt:"usd"}}),i=new V({props:{id:"revenue_growth",title:"Croiss. CA %",fmt:"num1"}}),q=new V({props:{id:"earnings_growth",title:"Croiss. BPA %",fmt:"num1"}}),D=new V({props:{id:"gross_margin",title:"Marge Brute %",fmt:"num1"}}),M=new V({props:{id:"operating_margin",title:"Marge Op. %",fmt:"num1"}}),w=new V({props:{id:"profit_margin",title:"Marge Nette %",fmt:"num1"}}),F=new V({props:{id:"roe",title:"ROE %",fmt:"num1"}}),G=new V({props:{id:"roa",title:"ROA %",fmt:"num1"}}),P=new V({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),B=new V({props:{id:"sector",title:"Secteur"}}),j=new V({props:{id:"country",title:"Pays"}}),{c(){h(r.$$.fragment),a=v(),h(t.$$.fragment),m=v(),h(g.$$.fragment),n=v(),h(k.$$.fragment),E=v(),h(i.$$.fragment),C=v(),h(q.$$.fragment),S=v(),h(D.$$.fragment),A=v(),h(M.$$.fragment),I=v(),h(w.$$.fragment),T=v(),h(F.$$.fragment),X=v(),h(G.$$.fragment),Y=v(),h(P.$$.fragment),K=v(),h(B.$$.fragment),W=v(),h(j.$$.fragment)},l(f){y(r.$$.fragment,f),a=p(f),y(t.$$.fragment,f),m=p(f),y(g.$$.fragment,f),n=p(f),y(k.$$.fragment,f),E=p(f),y(i.$$.fragment,f),C=p(f),y(q.$$.fragment,f),S=p(f),y(D.$$.fragment,f),A=p(f),y(M.$$.fragment,f),I=p(f),y(w.$$.fragment,f),T=p(f),y(F.$$.fragment,f),X=p(f),y(G.$$.fragment,f),Y=p(f),y(P.$$.fragment,f),K=p(f),y(B.$$.fragment,f),W=p(f),y(j.$$.fragment,f)},m(f,L){b(r,f,L),l(f,a,L),b(t,f,L),l(f,m,L),b(g,f,L),l(f,n,L),b(k,f,L),l(f,E,L),b(i,f,L),l(f,C,L),b(q,f,L),l(f,S,L),b(D,f,L),l(f,A,L),b(M,f,L),l(f,I,L),b(w,f,L),l(f,T,L),b(F,f,L),l(f,X,L),b(G,f,L),l(f,Y,L),b(P,f,L),l(f,K,L),b(B,f,L),l(f,W,L),b(j,f,L),oe=!0},p:nt,i(f){oe||(c(r.$$.fragment,f),c(t.$$.fragment,f),c(g.$$.fragment,f),c(k.$$.fragment,f),c(i.$$.fragment,f),c(q.$$.fragment,f),c(D.$$.fragment,f),c(M.$$.fragment,f),c(w.$$.fragment,f),c(F.$$.fragment,f),c(G.$$.fragment,f),c(P.$$.fragment,f),c(B.$$.fragment,f),c(j.$$.fragment,f),oe=!0)},o(f){$(r.$$.fragment,f),$(t.$$.fragment,f),$(g.$$.fragment,f),$(k.$$.fragment,f),$(i.$$.fragment,f),$(q.$$.fragment,f),$(D.$$.fragment,f),$(M.$$.fragment,f),$(w.$$.fragment,f),$(F.$$.fragment,f),$(G.$$.fragment,f),$(P.$$.fragment,f),$(B.$$.fragment,f),$(j.$$.fragment,f),oe=!1},d(f){f&&(o(a),o(m),o(n),o(E),o(C),o(S),o(A),o(I),o(T),o(X),o(Y),o(K),o(W)),d(r,f),d(t,f),d(g,f),d(k,f),d(i,f),d(q,f),d(D,f),d(M,f),d(w,f),d(F,f),d(G,f),d(P,f),d(B,f),d(j,f)}}}function Ca(_){let r,a,t,m,g,n,k,E;return r=new ar({props:{valueLabel:"Toutes les actions",value:"all",default:!0}}),t=new ar({props:{valueLabel:"Growth (CA > 20%)",value:"growth"}}),g=new ar({props:{valueLabel:"Value (Div > 2%)",value:"value"}}),k=new ar({props:{valueLabel:"Profitable (Marge > 15%)",value:"profitable"}}),{c(){h(r.$$.fragment),a=v(),h(t.$$.fragment),m=v(),h(g.$$.fragment),n=v(),h(k.$$.fragment)},l(i){y(r.$$.fragment,i),a=p(i),y(t.$$.fragment,i),m=p(i),y(g.$$.fragment,i),n=p(i),y(k.$$.fragment,i)},m(i,C){b(r,i,C),l(i,a,C),b(t,i,C),l(i,m,C),b(g,i,C),l(i,n,C),b(k,i,C),E=!0},p:nt,i(i){E||(c(r.$$.fragment,i),c(t.$$.fragment,i),c(g.$$.fragment,i),c(k.$$.fragment,i),E=!0)},o(i){$(r.$$.fragment,i),$(t.$$.fragment,i),$(g.$$.fragment,i),$(k.$$.fragment,i),E=!1},d(i){i&&(o(a),o(m),o(n)),d(r,i),d(t,i),d(g,i),d(k,i)}}}function Xr(_){let r,a;return r=new Ne({props:{queryID:"growth_screener_results",queryResult:_[10]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&1024&&(g.queryResult=t[10]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Yr(_){let r,a;return r=new Ne({props:{queryID:"growth_screener_stats",queryResult:_[11]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&2048&&(g.queryResult=t[11]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Kr(_){let r,a;return r=new Ne({props:{queryID:"growth_screener_bar",queryResult:_[12]}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&4096&&(g.queryResult=t[12]),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function qa(_){let r,a,t,m,g,n,k,E;return r=new Ue({props:{data:_[11],value:"nb_matches",title:"Resultats",emptySet:"pass"}}),t=new Ue({props:{data:_[11],value:"avg_rev_growth",title:"Croiss. CA Moy. (%)",emptySet:"pass"}}),g=new Ue({props:{data:_[11],value:"avg_margin",title:"Marge Nette Moy. (%)",emptySet:"pass"}}),k=new Ue({props:{data:_[11],value:"avg_roe",title:"ROE Moy. (%)",emptySet:"pass"}}),{c(){h(r.$$.fragment),a=v(),h(t.$$.fragment),m=v(),h(g.$$.fragment),n=v(),h(k.$$.fragment)},l(i){y(r.$$.fragment,i),a=p(i),y(t.$$.fragment,i),m=p(i),y(g.$$.fragment,i),n=p(i),y(k.$$.fragment,i)},m(i,C){b(r,i,C),l(i,a,C),b(t,i,C),l(i,m,C),b(g,i,C),l(i,n,C),b(k,i,C),E=!0},p(i,C){const q={};C[0]&2048&&(q.data=i[11]),r.$set(q);const S={};C[0]&2048&&(S.data=i[11]),t.$set(S);const D={};C[0]&2048&&(D.data=i[11]),g.$set(D);const A={};C[0]&2048&&(A.data=i[11]),k.$set(A)},i(i){E||(c(r.$$.fragment,i),c(t.$$.fragment,i),c(g.$$.fragment,i),c(k.$$.fragment,i),E=!0)},o(i){$(r.$$.fragment,i),$(t.$$.fragment,i),$(g.$$.fragment,i),$(k.$$.fragment,i),E=!1},d(i){i&&(o(a),o(m),o(n)),d(r,i),d(t,i),d(g,i),d(k,i)}}}function Ha(_){let r,a,t,m,g,n,k,E,i,C,q,S,D,A,M,I,w,T,F,X,G,Y,P,K,B,W,j,oe,f,L;return r=new V({props:{id:"symbol",title:"Ticker"}}),t=new V({props:{id:"name",title:"Nom"}}),g=new V({props:{id:"price",title:"Prix",fmt:"usd"}}),k=new V({props:{id:"revenue",title:"CA",fmt:"usd"}}),i=new V({props:{id:"revenue_growth",title:"Croiss. CA %",fmt:"num1"}}),q=new V({props:{id:"earnings_growth",title:"Croiss. BPA %",fmt:"num1"}}),D=new V({props:{id:"gross_margin",title:"Marge Brute %",fmt:"num1"}}),M=new V({props:{id:"operating_margin",title:"Marge Op. %",fmt:"num1"}}),w=new V({props:{id:"profit_margin",title:"Marge Nette %",fmt:"num1"}}),F=new V({props:{id:"roe",title:"ROE %",fmt:"num1"}}),G=new V({props:{id:"roa",title:"ROA %",fmt:"num1"}}),P=new V({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),B=new V({props:{id:"dividend_yield",title:"Div %",fmt:"num2"}}),j=new V({props:{id:"sector",title:"Secteur"}}),f=new V({props:{id:"country",title:"Pays"}}),{c(){h(r.$$.fragment),a=v(),h(t.$$.fragment),m=v(),h(g.$$.fragment),n=v(),h(k.$$.fragment),E=v(),h(i.$$.fragment),C=v(),h(q.$$.fragment),S=v(),h(D.$$.fragment),A=v(),h(M.$$.fragment),I=v(),h(w.$$.fragment),T=v(),h(F.$$.fragment),X=v(),h(G.$$.fragment),Y=v(),h(P.$$.fragment),K=v(),h(B.$$.fragment),W=v(),h(j.$$.fragment),oe=v(),h(f.$$.fragment)},l(u){y(r.$$.fragment,u),a=p(u),y(t.$$.fragment,u),m=p(u),y(g.$$.fragment,u),n=p(u),y(k.$$.fragment,u),E=p(u),y(i.$$.fragment,u),C=p(u),y(q.$$.fragment,u),S=p(u),y(D.$$.fragment,u),A=p(u),y(M.$$.fragment,u),I=p(u),y(w.$$.fragment,u),T=p(u),y(F.$$.fragment,u),X=p(u),y(G.$$.fragment,u),Y=p(u),y(P.$$.fragment,u),K=p(u),y(B.$$.fragment,u),W=p(u),y(j.$$.fragment,u),oe=p(u),y(f.$$.fragment,u)},m(u,H){b(r,u,H),l(u,a,H),b(t,u,H),l(u,m,H),b(g,u,H),l(u,n,H),b(k,u,H),l(u,E,H),b(i,u,H),l(u,C,H),b(q,u,H),l(u,S,H),b(D,u,H),l(u,A,H),b(M,u,H),l(u,I,H),b(w,u,H),l(u,T,H),b(F,u,H),l(u,X,H),b(G,u,H),l(u,Y,H),b(P,u,H),l(u,K,H),b(B,u,H),l(u,W,H),b(j,u,H),l(u,oe,H),b(f,u,H),L=!0},p:nt,i(u){L||(c(r.$$.fragment,u),c(t.$$.fragment,u),c(g.$$.fragment,u),c(k.$$.fragment,u),c(i.$$.fragment,u),c(q.$$.fragment,u),c(D.$$.fragment,u),c(M.$$.fragment,u),c(w.$$.fragment,u),c(F.$$.fragment,u),c(G.$$.fragment,u),c(P.$$.fragment,u),c(B.$$.fragment,u),c(j.$$.fragment,u),c(f.$$.fragment,u),L=!0)},o(u){$(r.$$.fragment,u),$(t.$$.fragment,u),$(g.$$.fragment,u),$(k.$$.fragment,u),$(i.$$.fragment,u),$(q.$$.fragment,u),$(D.$$.fragment,u),$(M.$$.fragment,u),$(w.$$.fragment,u),$(F.$$.fragment,u),$(G.$$.fragment,u),$(P.$$.fragment,u),$(B.$$.fragment,u),$(j.$$.fragment,u),$(f.$$.fragment,u),L=!1},d(u){u&&(o(a),o(m),o(n),o(E),o(C),o(S),o(A),o(I),o(T),o(X),o(Y),o(K),o(W),o(oe)),d(r,u),d(t,u),d(g,u),d(k,u),d(i,u),d(q,u),d(D,u),d(M,u),d(w,u),d(F,u),d(G,u),d(P,u),d(B,u),d(j,u),d(f,u)}}}function Ea(_){let r,a,t,m,g,n,k,E,i,C,q,S,D;r=new wa({props:{name:"style_screener",title:"Style d'investissement",defaultValue:"all",$$slots:{default:[Ca]},$$scope:{ctx:_}}});let A=_[10]&&Xr(_),M=_[11]&&Yr(_),I=_[12]&&Kr(_);return n=new da({props:{cols:"4",$$slots:{default:[qa]},$$scope:{ctx:_}}}),E=new Pt({props:{data:_[12],x:"symbol",y:"revenue_growth",xAxisTitle:"Ticker",yAxisTitle:"Croissance CA (%)",title:"Top 20 du filtre selectionne",sort:"false",emptySet:"pass"}}),C=new Wr({props:{data:_[10],search:"true",rows:"25",emptySet:"pass",$$slots:{default:[Ha]},$$scope:{ctx:_}}}),S=new ma({props:{data:_[10],filename:"screener_growth_value",emptySet:"pass"}}),{c(){h(r.$$.fragment),a=v(),A&&A.c(),t=v(),M&&M.c(),m=v(),I&&I.c(),g=v(),h(n.$$.fragment),k=v(),h(E.$$.fragment),i=v(),h(C.$$.fragment),q=v(),h(S.$$.fragment)},l(w){y(r.$$.fragment,w),a=p(w),A&&A.l(w),t=p(w),M&&M.l(w),m=p(w),I&&I.l(w),g=p(w),y(n.$$.fragment,w),k=p(w),y(E.$$.fragment,w),i=p(w),y(C.$$.fragment,w),q=p(w),y(S.$$.fragment,w)},m(w,T){b(r,w,T),l(w,a,T),A&&A.m(w,T),l(w,t,T),M&&M.m(w,T),l(w,m,T),I&&I.m(w,T),l(w,g,T),b(n,w,T),l(w,k,T),b(E,w,T),l(w,i,T),b(C,w,T),l(w,q,T),b(S,w,T),D=!0},p(w,T){const F={};T[2]&268435456&&(F.$$scope={dirty:T,ctx:w}),r.$set(F),w[10]?A?(A.p(w,T),T[0]&1024&&c(A,1)):(A=Xr(w),A.c(),c(A,1),A.m(t.parentNode,t)):A&&(Le(),$(A,1,1,()=>{A=null}),Ae()),w[11]?M?(M.p(w,T),T[0]&2048&&c(M,1)):(M=Yr(w),M.c(),c(M,1),M.m(m.parentNode,m)):M&&(Le(),$(M,1,1,()=>{M=null}),Ae()),w[12]?I?(I.p(w,T),T[0]&4096&&c(I,1)):(I=Kr(w),I.c(),c(I,1),I.m(g.parentNode,g)):I&&(Le(),$(I,1,1,()=>{I=null}),Ae());const X={};T[0]&2048|T[2]&268435456&&(X.$$scope={dirty:T,ctx:w}),n.$set(X);const G={};T[0]&4096&&(G.data=w[12]),E.$set(G);const Y={};T[0]&1024&&(Y.data=w[10]),T[2]&268435456&&(Y.$$scope={dirty:T,ctx:w}),C.$set(Y);const P={};T[0]&1024&&(P.data=w[10]),S.$set(P)},i(w){D||(c(r.$$.fragment,w),c(A),c(M),c(I),c(n.$$.fragment,w),c(E.$$.fragment,w),c(C.$$.fragment,w),c(S.$$.fragment,w),D=!0)},o(w){$(r.$$.fragment,w),$(A),$(M),$(I),$(n.$$.fragment,w),$(E.$$.fragment,w),$(C.$$.fragment,w),$(S.$$.fragment,w),D=!1},d(w){w&&(o(a),o(t),o(m),o(g),o(k),o(i),o(q)),d(r,w),A&&A.d(w),M&&M.d(w),I&&I.d(w),d(n,w),d(E,w),d(C,w),d(S,w)}}}function Ia(_){let r,a;return r=new $a({props:{label:"Growth vs Value",$$slots:{default:[Ea]},$$scope:{ctx:_}}}),{c(){h(r.$$.fragment)},l(t){y(r.$$.fragment,t)},m(t,m){b(r,t,m),a=!0},p(t,m){const g={};m[0]&7168|m[2]&268435456&&(g.$$scope={dirty:m,ctx:t}),r.$set(g)},i(t){a||(c(r.$$.fragment,t),a=!0)},o(t){$(r.$$.fragment,t),a=!1},d(t){d(r,t)}}}function Sa(_){let r;return{c(){r=At("Accueil")},l(a){r=Mt(a,"Accueil")},m(a,t){l(a,r,t)},d(a){a&&o(r)}}}function Da(_){let r;return{c(){r=At("Explorateur d'Actions")},l(a){r=Mt(a,"Explorateur d'Actions")},m(a,t){l(a,r,t)},d(a){a&&o(r)}}}function Fa(_){let r;return{c(){r=At("Analyse Sectorielle")},l(a){r=Mt(a,"Analyse Sectorielle")},m(a,t){l(a,r,t)},d(a){a&&o(r)}}}function Oa(_){let r;return{c(){r=At("Analyse Geographique")},l(a){r=Mt(a,"Analyse Geographique")},m(a,t){l(a,r,t)},d(a){a&&o(r)}}}function Ua(_){let r;return{c(){r=At("Lab de Valorisation")},l(a){r=Mt(a,"Lab de Valorisation")},m(a,t){l(a,r,t)},d(a){a&&o(r)}}}function Ba(_){let r,a,t,m,g,n,k="← Retour Market Watch",E,i,C='<a href="#croissance--rentabilite">Croissance &amp; Rentabilite</a>',q,S,D,A,M,I,w,T,F,X,G,Y,P,K,B,W,j,oe,f,L,u,H,be,Lt='<a href="#heatmap-des-marges-par-secteur">Heatmap des Marges par Secteur</a>',it,we,me,Pe,Ze,ot,ye,Ve='<a href="#croissance-par-secteur">Croissance par Secteur</a>',Ce,ce,Nt='<a href="#croissance-moyenne-du-ca-par-secteur">Croissance Moyenne du CA par Secteur</a>',lt,je,fe,qe,$e,Ct='<a href="#roe-moyen-par-secteur">ROE Moyen par Secteur</a>',_t,Qe,ue,He,Be,mt,he,qt='<a href="#distributions-statistiques">Distributions Statistiques</a>',Ee,le,ft='<a href="#distribution-de-la-croissance-du-ca">Distribution de la Croissance du CA</a>',ut,ze,Ie,Se,_e,gt='<a href="#distribution-de-la-marge-nette">Distribution de la Marge Nette</a>',ct,Xe,De,Fe,ke,Ye,Re,Ht='<a href="#entonnoir-de-rentabilite">Entonnoir de Rentabilite</a>',$t,de,ge,Ke,xe,pt,Te,We='<a href="#classements">Classements</a>',Oe,pe,Et='<a href="#top-20-croissance-du-ca">Top 20 Croissance du CA</a>',vt,Je,N,It,et,or='<a href="#top-20-roe">Top 20 ROE</a>',Vt,St,wt,jt,Ft,Qt,tt,lr='<a href="#tableau-detaille-croissance--rentabilite">Tableau Detaille Croissance &amp; Rentabilite</a>',zt,Dt,dt,Xt,Ot,Yt,rt,_r='<a href="#screener-growth-vs-value">Screener Growth vs Value</a>',Kt,bt,Wt,Ut,Jt,yt,Zt,ht,xt,kt,er,Rt,tr,Tt,rr,at=typeof z<"u"&&z.title&&z.hide_title!==!0&&ha();function Jr(e,s){return typeof z<"u"&&z.title?Ra:ka}let Bt=Jr()(_),st=typeof z=="object"&&Ta();S=new ga({props:{status:"info",$$slots:{default:[La]},$$scope:{ctx:_}}});let J=_[0]&&Fr(_);M=new Ue({props:{data:_[0],value:"nb_stocks",title:"Actions analysees"}}),w=new Ue({props:{data:_[0],value:"avg_rev_growth",title:"Croiss. CA Moy. (%)"}}),F=new Ue({props:{data:_[0],value:"avg_earn_growth",title:"Croiss. BPA Moy. (%)"}}),G=new Ue({props:{data:_[0],value:"avg_gross_margin",title:"Marge Brute Moy. (%)"}}),P=new Ue({props:{data:_[0],value:"avg_op_margin",title:"Marge Op. Moy. (%)"}}),B=new Ue({props:{data:_[0],value:"avg_profit_margin",title:"Marge Nette Moy. (%)"}}),j=new Ue({props:{data:_[0],value:"avg_roe",title:"ROE Moy. (%)"}}),f=new Ue({props:{data:_[0],value:"avg_roa",title:"ROA Moy. (%)"}});let Z=_[1]&&Or(_);me=new ya({props:{data:_[1],x:"margin_type",y:"sector",value:"val",title:"Marges Moyennes par Secteur (%)",xAxisTitle:"Type de Marge",yAxisTitle:"Secteur",valueFmt:"num1"}});let x=_[2]&&Ur(_);fe=new Pt({props:{data:_[2],x:"sector",y:"avg_revenue_growth",xAxisTitle:"Secteur",yAxisTitle:"Croissance CA Moy. (%)",title:"Croissance Moyenne du Chiffre d'Affaires par Secteur",swapXY:"true",sort:"false"}});let ee=_[3]&&Br(_);ue=new Pt({props:{data:_[3],x:"sector",y:"avg_roe",xAxisTitle:"Secteur",yAxisTitle:"ROE Moy. (%)",title:"ROE Moyen par Secteur",swapXY:"true",sort:"false"}});let te=_[4]&&Gr(_);Ie=new Dr({props:{data:_[4],x:"revenue_growth",xAxisTitle:"Croissance CA (%)",title:"Distribution de la Croissance du Chiffre d'Affaires"}});let re=_[5]&&Pr(_);De=new Dr({props:{data:_[5],x:"profit_margin",xAxisTitle:"Marge Nette (%)",title:"Distribution de la Marge Nette"}});let ae=_[6]&&Vr(_);ge=new ba({props:{data:_[6],nameCol:"tier",valueCol:"count",title:"Entonnoir de Rentabilite - Niveaux de Marge Nette"}});let se=_[7]&&jr(_);N=new Pt({props:{data:_[7],x:"symbol",y:"revenue_growth",xAxisTitle:"Ticker",yAxisTitle:"Croissance CA (%)",title:"Top 20 - Croissance du Chiffre d'Affaires",sort:"false"}});let ne=_[8]&&Qr(_);wt=new Pt({props:{data:_[8],x:"symbol",y:"roe",xAxisTitle:"Ticker",yAxisTitle:"ROE (%)",title:"Top 20 - Retour sur Capitaux Propres (ROE)",sort:"false"}});let ie=_[9]&&zr(_);return dt=new Wr({props:{data:_[9],search:"true",rows:"25",$$slots:{default:[Na]},$$scope:{ctx:_}}}),bt=new ca({props:{$$slots:{default:[Ia]},$$scope:{ctx:_}}}),yt=new Gt({props:{url:"/",$$slots:{default:[Sa]},$$scope:{ctx:_}}}),ht=new Gt({props:{url:"/explorer",$$slots:{default:[Da]},$$scope:{ctx:_}}}),kt=new Gt({props:{url:"/sectors",$$slots:{default:[Fa]},$$scope:{ctx:_}}}),Rt=new Gt({props:{url:"/regions",$$slots:{default:[Oa]},$$scope:{ctx:_}}}),Tt=new Gt({props:{url:"/valuations",$$slots:{default:[Ua]},$$scope:{ctx:_}}}),{c(){at&&at.c(),r=v(),Bt.c(),a=U("meta"),t=U("meta"),st&&st.c(),m=nr(),g=v(),n=U("a"),n.textContent=k,E=v(),i=U("h1"),i.innerHTML=C,q=v(),h(S.$$.fragment),D=v(),J&&J.c(),A=v(),h(M.$$.fragment),I=v(),h(w.$$.fragment),T=v(),h(F.$$.fragment),X=v(),h(G.$$.fragment),Y=v(),h(P.$$.fragment),K=v(),h(B.$$.fragment),W=v(),h(j.$$.fragment),oe=v(),h(f.$$.fragment),L=v(),u=U("hr"),H=v(),be=U("h2"),be.innerHTML=Lt,it=v(),Z&&Z.c(),we=v(),h(me.$$.fragment),Pe=v(),Ze=U("hr"),ot=v(),ye=U("h2"),ye.innerHTML=Ve,Ce=v(),ce=U("h3"),ce.innerHTML=Nt,lt=v(),x&&x.c(),je=v(),h(fe.$$.fragment),qe=v(),$e=U("h3"),$e.innerHTML=Ct,_t=v(),ee&&ee.c(),Qe=v(),h(ue.$$.fragment),He=v(),Be=U("hr"),mt=v(),he=U("h2"),he.innerHTML=qt,Ee=v(),le=U("h3"),le.innerHTML=ft,ut=v(),te&&te.c(),ze=v(),h(Ie.$$.fragment),Se=v(),_e=U("h3"),_e.innerHTML=gt,ct=v(),re&&re.c(),Xe=v(),h(De.$$.fragment),Fe=v(),ke=U("hr"),Ye=v(),Re=U("h2"),Re.innerHTML=Ht,$t=v(),ae&&ae.c(),de=v(),h(ge.$$.fragment),Ke=v(),xe=U("hr"),pt=v(),Te=U("h2"),Te.innerHTML=We,Oe=v(),pe=U("h3"),pe.innerHTML=Et,vt=v(),se&&se.c(),Je=v(),h(N.$$.fragment),It=v(),et=U("h3"),et.innerHTML=or,Vt=v(),ne&&ne.c(),St=v(),h(wt.$$.fragment),jt=v(),Ft=U("hr"),Qt=v(),tt=U("h2"),tt.innerHTML=lr,zt=v(),ie&&ie.c(),Dt=v(),h(dt.$$.fragment),Xt=v(),Ot=U("hr"),Yt=v(),rt=U("h2"),rt.innerHTML=_r,Kt=v(),h(bt.$$.fragment),Wt=v(),Ut=U("hr"),Jt=v(),h(yt.$$.fragment),Zt=v(),h(ht.$$.fragment),xt=v(),h(kt.$$.fragment),er=v(),h(Rt.$$.fragment),tr=v(),h(Tt.$$.fragment),this.h()},l(e){at&&at.l(e),r=p(e);const s=xr("svelte-2igo1p",document.head);Bt.l(s),a=O(s,"META",{name:!0,content:!0}),t=O(s,"META",{name:!0,content:!0}),st&&st.l(s),m=nr(),s.forEach(o),g=p(e),n=O(e,"A",{href:!0,style:!0,"data-svelte-h":!0}),ve(n)!=="svelte-80akn7"&&(n.textContent=k),E=p(e),i=O(e,"H1",{class:!0,id:!0,"data-svelte-h":!0}),ve(i)!=="svelte-19cmzkt"&&(i.innerHTML=C),q=p(e),y(S.$$.fragment,e),D=p(e),J&&J.l(e),A=p(e),y(M.$$.fragment,e),I=p(e),y(w.$$.fragment,e),T=p(e),y(F.$$.fragment,e),X=p(e),y(G.$$.fragment,e),Y=p(e),y(P.$$.fragment,e),K=p(e),y(B.$$.fragment,e),W=p(e),y(j.$$.fragment,e),oe=p(e),y(f.$$.fragment,e),L=p(e),u=O(e,"HR",{class:!0}),H=p(e),be=O(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ve(be)!=="svelte-4g2w65"&&(be.innerHTML=Lt),it=p(e),Z&&Z.l(e),we=p(e),y(me.$$.fragment,e),Pe=p(e),Ze=O(e,"HR",{class:!0}),ot=p(e),ye=O(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ve(ye)!=="svelte-11z74um"&&(ye.innerHTML=Ve),Ce=p(e),ce=O(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ve(ce)!=="svelte-68le2g"&&(ce.innerHTML=Nt),lt=p(e),x&&x.l(e),je=p(e),y(fe.$$.fragment,e),qe=p(e),$e=O(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ve($e)!=="svelte-f9igo"&&($e.innerHTML=Ct),_t=p(e),ee&&ee.l(e),Qe=p(e),y(ue.$$.fragment,e),He=p(e),Be=O(e,"HR",{class:!0}),mt=p(e),he=O(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ve(he)!=="svelte-1qb4q26"&&(he.innerHTML=qt),Ee=p(e),le=O(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ve(le)!=="svelte-1f51xp7"&&(le.innerHTML=ft),ut=p(e),te&&te.l(e),ze=p(e),y(Ie.$$.fragment,e),Se=p(e),_e=O(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ve(_e)!=="svelte-4srfv0"&&(_e.innerHTML=gt),ct=p(e),re&&re.l(e),Xe=p(e),y(De.$$.fragment,e),Fe=p(e),ke=O(e,"HR",{class:!0}),Ye=p(e),Re=O(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ve(Re)!=="svelte-gxtmes"&&(Re.innerHTML=Ht),$t=p(e),ae&&ae.l(e),de=p(e),y(ge.$$.fragment,e),Ke=p(e),xe=O(e,"HR",{class:!0}),pt=p(e),Te=O(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ve(Te)!=="svelte-11sttjo"&&(Te.innerHTML=We),Oe=p(e),pe=O(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ve(pe)!=="svelte-y3m17a"&&(pe.innerHTML=Et),vt=p(e),se&&se.l(e),Je=p(e),y(N.$$.fragment,e),It=p(e),et=O(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),ve(et)!=="svelte-a75ntf"&&(et.innerHTML=or),Vt=p(e),ne&&ne.l(e),St=p(e),y(wt.$$.fragment,e),jt=p(e),Ft=O(e,"HR",{class:!0}),Qt=p(e),tt=O(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ve(tt)!=="svelte-1gd8faj"&&(tt.innerHTML=lr),zt=p(e),ie&&ie.l(e),Dt=p(e),y(dt.$$.fragment,e),Xt=p(e),Ot=O(e,"HR",{class:!0}),Yt=p(e),rt=O(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),ve(rt)!=="svelte-uv6q0s"&&(rt.innerHTML=_r),Kt=p(e),y(bt.$$.fragment,e),Wt=p(e),Ut=O(e,"HR",{class:!0}),Jt=p(e),y(yt.$$.fragment,e),Zt=p(e),y(ht.$$.fragment,e),xt=p(e),y(kt.$$.fragment,e),er=p(e),y(Rt.$$.fragment,e),tr=p(e),y(Tt.$$.fragment,e),this.h()},h(){R(a,"name","twitter:card"),R(a,"content","summary_large_image"),R(t,"name","twitter:site"),R(t,"content","@evidence_dev"),R(n,"href","/lab/"),Ge(n,"display","inline-flex"),Ge(n,"align-items","center"),Ge(n,"gap","6px"),Ge(n,"padding","6px 14px"),Ge(n,"background","#f1f5f9"),Ge(n,"border","1px solid #e2e8f0"),Ge(n,"border-radius","8px"),Ge(n,"color","#475569"),Ge(n,"text-decoration","none"),Ge(n,"font-size","0.85rem"),Ge(n,"margin-bottom","1rem"),R(i,"class","markdown"),R(i,"id","croissance--rentabilite"),R(u,"class","markdown"),R(be,"class","markdown"),R(be,"id","heatmap-des-marges-par-secteur"),R(Ze,"class","markdown"),R(ye,"class","markdown"),R(ye,"id","croissance-par-secteur"),R(ce,"class","markdown"),R(ce,"id","croissance-moyenne-du-ca-par-secteur"),R($e,"class","markdown"),R($e,"id","roe-moyen-par-secteur"),R(Be,"class","markdown"),R(he,"class","markdown"),R(he,"id","distributions-statistiques"),R(le,"class","markdown"),R(le,"id","distribution-de-la-croissance-du-ca"),R(_e,"class","markdown"),R(_e,"id","distribution-de-la-marge-nette"),R(ke,"class","markdown"),R(Re,"class","markdown"),R(Re,"id","entonnoir-de-rentabilite"),R(xe,"class","markdown"),R(Te,"class","markdown"),R(Te,"id","classements"),R(pe,"class","markdown"),R(pe,"id","top-20-croissance-du-ca"),R(et,"class","markdown"),R(et,"id","top-20-roe"),R(Ft,"class","markdown"),R(tt,"class","markdown"),R(tt,"id","tableau-detaille-croissance--rentabilite"),R(Ot,"class","markdown"),R(rt,"class","markdown"),R(rt,"id","screener-growth-vs-value"),R(Ut,"class","markdown")},m(e,s){at&&at.m(e,s),l(e,r,s),Bt.m(document.head,null),sr(document.head,a),sr(document.head,t),st&&st.m(document.head,null),sr(document.head,m),l(e,g,s),l(e,n,s),l(e,E,s),l(e,i,s),l(e,q,s),b(S,e,s),l(e,D,s),J&&J.m(e,s),l(e,A,s),b(M,e,s),l(e,I,s),b(w,e,s),l(e,T,s),b(F,e,s),l(e,X,s),b(G,e,s),l(e,Y,s),b(P,e,s),l(e,K,s),b(B,e,s),l(e,W,s),b(j,e,s),l(e,oe,s),b(f,e,s),l(e,L,s),l(e,u,s),l(e,H,s),l(e,be,s),l(e,it,s),Z&&Z.m(e,s),l(e,we,s),b(me,e,s),l(e,Pe,s),l(e,Ze,s),l(e,ot,s),l(e,ye,s),l(e,Ce,s),l(e,ce,s),l(e,lt,s),x&&x.m(e,s),l(e,je,s),b(fe,e,s),l(e,qe,s),l(e,$e,s),l(e,_t,s),ee&&ee.m(e,s),l(e,Qe,s),b(ue,e,s),l(e,He,s),l(e,Be,s),l(e,mt,s),l(e,he,s),l(e,Ee,s),l(e,le,s),l(e,ut,s),te&&te.m(e,s),l(e,ze,s),b(Ie,e,s),l(e,Se,s),l(e,_e,s),l(e,ct,s),re&&re.m(e,s),l(e,Xe,s),b(De,e,s),l(e,Fe,s),l(e,ke,s),l(e,Ye,s),l(e,Re,s),l(e,$t,s),ae&&ae.m(e,s),l(e,de,s),b(ge,e,s),l(e,Ke,s),l(e,xe,s),l(e,pt,s),l(e,Te,s),l(e,Oe,s),l(e,pe,s),l(e,vt,s),se&&se.m(e,s),l(e,Je,s),b(N,e,s),l(e,It,s),l(e,et,s),l(e,Vt,s),ne&&ne.m(e,s),l(e,St,s),b(wt,e,s),l(e,jt,s),l(e,Ft,s),l(e,Qt,s),l(e,tt,s),l(e,zt,s),ie&&ie.m(e,s),l(e,Dt,s),b(dt,e,s),l(e,Xt,s),l(e,Ot,s),l(e,Yt,s),l(e,rt,s),l(e,Kt,s),b(bt,e,s),l(e,Wt,s),l(e,Ut,s),l(e,Jt,s),b(yt,e,s),l(e,Zt,s),b(ht,e,s),l(e,xt,s),b(kt,e,s),l(e,er,s),b(Rt,e,s),l(e,tr,s),b(Tt,e,s),rr=!0},p(e,s){typeof z<"u"&&z.title&&z.hide_title!==!0&&at.p(e,s),Bt.p(e,s),typeof z=="object"&&st.p(e,s);const mr={};s[2]&268435456&&(mr.$$scope={dirty:s,ctx:e}),S.$set(mr),e[0]?J?(J.p(e,s),s[0]&1&&c(J,1)):(J=Fr(e),J.c(),c(J,1),J.m(A.parentNode,A)):J&&(Le(),$(J,1,1,()=>{J=null}),Ae());const fr={};s[0]&1&&(fr.data=e[0]),M.$set(fr);const ur={};s[0]&1&&(ur.data=e[0]),w.$set(ur);const gr={};s[0]&1&&(gr.data=e[0]),F.$set(gr);const cr={};s[0]&1&&(cr.data=e[0]),G.$set(cr);const $r={};s[0]&1&&($r.data=e[0]),P.$set($r);const pr={};s[0]&1&&(pr.data=e[0]),B.$set(pr);const vr={};s[0]&1&&(vr.data=e[0]),j.$set(vr);const wr={};s[0]&1&&(wr.data=e[0]),f.$set(wr),e[1]?Z?(Z.p(e,s),s[0]&2&&c(Z,1)):(Z=Or(e),Z.c(),c(Z,1),Z.m(we.parentNode,we)):Z&&(Le(),$(Z,1,1,()=>{Z=null}),Ae());const dr={};s[0]&2&&(dr.data=e[1]),me.$set(dr),e[2]?x?(x.p(e,s),s[0]&4&&c(x,1)):(x=Ur(e),x.c(),c(x,1),x.m(je.parentNode,je)):x&&(Le(),$(x,1,1,()=>{x=null}),Ae());const br={};s[0]&4&&(br.data=e[2]),fe.$set(br),e[3]?ee?(ee.p(e,s),s[0]&8&&c(ee,1)):(ee=Br(e),ee.c(),c(ee,1),ee.m(Qe.parentNode,Qe)):ee&&(Le(),$(ee,1,1,()=>{ee=null}),Ae());const yr={};s[0]&8&&(yr.data=e[3]),ue.$set(yr),e[4]?te?(te.p(e,s),s[0]&16&&c(te,1)):(te=Gr(e),te.c(),c(te,1),te.m(ze.parentNode,ze)):te&&(Le(),$(te,1,1,()=>{te=null}),Ae());const hr={};s[0]&16&&(hr.data=e[4]),Ie.$set(hr),e[5]?re?(re.p(e,s),s[0]&32&&c(re,1)):(re=Pr(e),re.c(),c(re,1),re.m(Xe.parentNode,Xe)):re&&(Le(),$(re,1,1,()=>{re=null}),Ae());const kr={};s[0]&32&&(kr.data=e[5]),De.$set(kr),e[6]?ae?(ae.p(e,s),s[0]&64&&c(ae,1)):(ae=Vr(e),ae.c(),c(ae,1),ae.m(de.parentNode,de)):ae&&(Le(),$(ae,1,1,()=>{ae=null}),Ae());const Rr={};s[0]&64&&(Rr.data=e[6]),ge.$set(Rr),e[7]?se?(se.p(e,s),s[0]&128&&c(se,1)):(se=jr(e),se.c(),c(se,1),se.m(Je.parentNode,Je)):se&&(Le(),$(se,1,1,()=>{se=null}),Ae());const Tr={};s[0]&128&&(Tr.data=e[7]),N.$set(Tr),e[8]?ne?(ne.p(e,s),s[0]&256&&c(ne,1)):(ne=Qr(e),ne.c(),c(ne,1),ne.m(St.parentNode,St)):ne&&(Le(),$(ne,1,1,()=>{ne=null}),Ae());const Mr={};s[0]&256&&(Mr.data=e[8]),wt.$set(Mr),e[9]?ie?(ie.p(e,s),s[0]&512&&c(ie,1)):(ie=zr(e),ie.c(),c(ie,1),ie.m(Dt.parentNode,Dt)):ie&&(Le(),$(ie,1,1,()=>{ie=null}),Ae());const ir={};s[0]&512&&(ir.data=e[9]),s[2]&268435456&&(ir.$$scope={dirty:s,ctx:e}),dt.$set(ir);const Ar={};s[0]&7168|s[2]&268435456&&(Ar.$$scope={dirty:s,ctx:e}),bt.$set(Ar);const Lr={};s[2]&268435456&&(Lr.$$scope={dirty:s,ctx:e}),yt.$set(Lr);const Nr={};s[2]&268435456&&(Nr.$$scope={dirty:s,ctx:e}),ht.$set(Nr);const Cr={};s[2]&268435456&&(Cr.$$scope={dirty:s,ctx:e}),kt.$set(Cr);const qr={};s[2]&268435456&&(qr.$$scope={dirty:s,ctx:e}),Rt.$set(qr);const Hr={};s[2]&268435456&&(Hr.$$scope={dirty:s,ctx:e}),Tt.$set(Hr)},i(e){rr||(c(S.$$.fragment,e),c(J),c(M.$$.fragment,e),c(w.$$.fragment,e),c(F.$$.fragment,e),c(G.$$.fragment,e),c(P.$$.fragment,e),c(B.$$.fragment,e),c(j.$$.fragment,e),c(f.$$.fragment,e),c(Z),c(me.$$.fragment,e),c(x),c(fe.$$.fragment,e),c(ee),c(ue.$$.fragment,e),c(te),c(Ie.$$.fragment,e),c(re),c(De.$$.fragment,e),c(ae),c(ge.$$.fragment,e),c(se),c(N.$$.fragment,e),c(ne),c(wt.$$.fragment,e),c(ie),c(dt.$$.fragment,e),c(bt.$$.fragment,e),c(yt.$$.fragment,e),c(ht.$$.fragment,e),c(kt.$$.fragment,e),c(Rt.$$.fragment,e),c(Tt.$$.fragment,e),rr=!0)},o(e){$(S.$$.fragment,e),$(J),$(M.$$.fragment,e),$(w.$$.fragment,e),$(F.$$.fragment,e),$(G.$$.fragment,e),$(P.$$.fragment,e),$(B.$$.fragment,e),$(j.$$.fragment,e),$(f.$$.fragment,e),$(Z),$(me.$$.fragment,e),$(x),$(fe.$$.fragment,e),$(ee),$(ue.$$.fragment,e),$(te),$(Ie.$$.fragment,e),$(re),$(De.$$.fragment,e),$(ae),$(ge.$$.fragment,e),$(se),$(N.$$.fragment,e),$(ne),$(wt.$$.fragment,e),$(ie),$(dt.$$.fragment,e),$(bt.$$.fragment,e),$(yt.$$.fragment,e),$(ht.$$.fragment,e),$(kt.$$.fragment,e),$(Rt.$$.fragment,e),$(Tt.$$.fragment,e),rr=!1},d(e){e&&(o(r),o(g),o(n),o(E),o(i),o(q),o(D),o(A),o(I),o(T),o(X),o(Y),o(K),o(W),o(oe),o(L),o(u),o(H),o(be),o(it),o(we),o(Pe),o(Ze),o(ot),o(ye),o(Ce),o(ce),o(lt),o(je),o(qe),o($e),o(_t),o(Qe),o(He),o(Be),o(mt),o(he),o(Ee),o(le),o(ut),o(ze),o(Se),o(_e),o(ct),o(Xe),o(Fe),o(ke),o(Ye),o(Re),o($t),o(de),o(Ke),o(xe),o(pt),o(Te),o(Oe),o(pe),o(vt),o(Je),o(It),o(et),o(Vt),o(St),o(jt),o(Ft),o(Qt),o(tt),o(zt),o(Dt),o(Xt),o(Ot),o(Yt),o(rt),o(Kt),o(Wt),o(Ut),o(Jt),o(Zt),o(xt),o(er),o(tr)),at&&at.d(e),Bt.d(e),o(a),o(t),st&&st.d(e),o(m),d(S,e),J&&J.d(e),d(M,e),d(w,e),d(F,e),d(G,e),d(P,e),d(B,e),d(j,e),d(f,e),Z&&Z.d(e),d(me,e),x&&x.d(e),d(fe,e),ee&&ee.d(e),d(ue,e),te&&te.d(e),d(Ie,e),re&&re.d(e),d(De,e),ae&&ae.d(e),d(ge,e),se&&se.d(e),d(N,e),ne&&ne.d(e),d(wt,e),ie&&ie.d(e),d(dt,e),d(bt,e),d(yt,e),d(ht,e),d(kt,e),d(Rt,e),d(Tt,e)}}}const z={title:"Croissance & Rentabilite",description:"Analyse de la croissance du chiffre d'affaires, des benefices et des marges de rentabilite"};function Ga(_,r,a){let t,m;Er(_,va,N=>a(68,t=N)),Er(_,Sr,N=>a(73,m=N));let{data:g}=r,{data:n={},customFormattingSettings:k,__db:E,inputs:i}=g;ea(Sr,m="aa064b247a24e2a5db5c84aa84e53112",m);let C=oa(ua(i));ta(C.subscribe(N=>a(15,i=N))),ra(fa,{getCustomFormats:()=>k.customFormats||[]});const q=(N,It)=>pa(E.query,N,{query_name:It});la(q),t.params,aa(()=>!0);let S={initialData:void 0,initialError:void 0},D=Q`select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks`,A=`select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks`;n.earn_summary_static_data&&(n.earn_summary_static_data instanceof Error?S.initialError=n.earn_summary_static_data:S.initialData=n.earn_summary_static_data,n.earn_summary_static_columns&&(S.knownColumns=n.earn_summary_static_columns));let M,I=!1;const w=Me.createReactive({callback:N=>{a(0,M=N)},execFn:q},{id:"earn_summary_static",...S});w(A,{noResolve:D,...S}),globalThis[Symbol.for("earn_summary_static")]={get value(){return M}};let T={initialData:void 0,initialError:void 0},F=Q`select sector, 'Brute' as margin_type, round(avg(gross_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Operationnelle' as margin_type, round(avg(operating_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Nette' as margin_type, round(avg(profit_margin),1) as val from market.stocks group by sector`,X=`select sector, 'Brute' as margin_type, round(avg(gross_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Operationnelle' as margin_type, round(avg(operating_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Nette' as margin_type, round(avg(profit_margin),1) as val from market.stocks group by sector`;n.heatmap_margins_data&&(n.heatmap_margins_data instanceof Error?T.initialError=n.heatmap_margins_data:T.initialData=n.heatmap_margins_data,n.heatmap_margins_columns&&(T.knownColumns=n.heatmap_margins_columns));let G,Y=!1;const P=Me.createReactive({callback:N=>{a(1,G=N)},execFn:q},{id:"heatmap_margins",...T});P(X,{noResolve:F,...T}),globalThis[Symbol.for("heatmap_margins")]={get value(){return G}};let K={initialData:void 0,initialError:void 0},B=Q`select
    sector,
    round(avg(revenue_growth), 1) as avg_revenue_growth
from market.stocks
where revenue_growth is not null
group by sector
order by avg_revenue_growth desc`,W=`select
    sector,
    round(avg(revenue_growth), 1) as avg_revenue_growth
from market.stocks
where revenue_growth is not null
group by sector
order by avg_revenue_growth desc`;n.avg_rev_growth_sector_data&&(n.avg_rev_growth_sector_data instanceof Error?K.initialError=n.avg_rev_growth_sector_data:K.initialData=n.avg_rev_growth_sector_data,n.avg_rev_growth_sector_columns&&(K.knownColumns=n.avg_rev_growth_sector_columns));let j,oe=!1;const f=Me.createReactive({callback:N=>{a(2,j=N)},execFn:q},{id:"avg_rev_growth_sector",...K});f(W,{noResolve:B,...K}),globalThis[Symbol.for("avg_rev_growth_sector")]={get value(){return j}};let L={initialData:void 0,initialError:void 0},u=Q`select
    sector,
    round(avg(roe), 1) as avg_roe
from market.stocks
where roe is not null
group by sector
order by avg_roe desc`,H=`select
    sector,
    round(avg(roe), 1) as avg_roe
from market.stocks
where roe is not null
group by sector
order by avg_roe desc`;n.avg_roe_sector_data&&(n.avg_roe_sector_data instanceof Error?L.initialError=n.avg_roe_sector_data:L.initialData=n.avg_roe_sector_data,n.avg_roe_sector_columns&&(L.knownColumns=n.avg_roe_sector_columns));let be,Lt=!1;const it=Me.createReactive({callback:N=>{a(3,be=N)},execFn:q},{id:"avg_roe_sector",...L});it(H,{noResolve:u,...L}),globalThis[Symbol.for("avg_roe_sector")]={get value(){return be}};let we={initialData:void 0,initialError:void 0},me=Q`select
    revenue_growth
from market.stocks
where revenue_growth is not null
  and revenue_growth > -100
  and revenue_growth < 200`,Pe=`select
    revenue_growth
from market.stocks
where revenue_growth is not null
  and revenue_growth > -100
  and revenue_growth < 200`;n.hist_rev_growth_data&&(n.hist_rev_growth_data instanceof Error?we.initialError=n.hist_rev_growth_data:we.initialData=n.hist_rev_growth_data,n.hist_rev_growth_columns&&(we.knownColumns=n.hist_rev_growth_columns));let Ze,ot=!1;const ye=Me.createReactive({callback:N=>{a(4,Ze=N)},execFn:q},{id:"hist_rev_growth",...we});ye(Pe,{noResolve:me,...we}),globalThis[Symbol.for("hist_rev_growth")]={get value(){return Ze}};let Ve={initialData:void 0,initialError:void 0},Ce=Q`select
    profit_margin
from market.stocks
where profit_margin is not null`,ce=`select
    profit_margin
from market.stocks
where profit_margin is not null`;n.hist_profit_margin_data&&(n.hist_profit_margin_data instanceof Error?Ve.initialError=n.hist_profit_margin_data:Ve.initialData=n.hist_profit_margin_data,n.hist_profit_margin_columns&&(Ve.knownColumns=n.hist_profit_margin_columns));let Nt,lt=!1;const je=Me.createReactive({callback:N=>{a(5,Nt=N)},execFn:q},{id:"hist_profit_margin",...Ve});je(ce,{noResolve:Ce,...Ve}),globalThis[Symbol.for("hist_profit_margin")]={get value(){return Nt}};let fe={initialData:void 0,initialError:void 0},qe=Q`select
    'Marge > 30%' as tier,
    count(*) as count,
    1 as sort_order
from market.stocks
where profit_margin > 30
UNION ALL
select
    'Marge 20-30%' as tier,
    count(*) as count,
    2 as sort_order
from market.stocks
where profit_margin > 20 and profit_margin <= 30
UNION ALL
select
    'Marge 10-20%' as tier,
    count(*) as count,
    3 as sort_order
from market.stocks
where profit_margin > 10 and profit_margin <= 20
UNION ALL
select
    'Marge 0-10%' as tier,
    count(*) as count,
    4 as sort_order
from market.stocks
where profit_margin >= 0 and profit_margin <= 10
UNION ALL
select
    'Marge Negative' as tier,
    count(*) as count,
    5 as sort_order
from market.stocks
where profit_margin < 0
order by sort_order`,$e=`select
    'Marge > 30%' as tier,
    count(*) as count,
    1 as sort_order
from market.stocks
where profit_margin > 30
UNION ALL
select
    'Marge 20-30%' as tier,
    count(*) as count,
    2 as sort_order
from market.stocks
where profit_margin > 20 and profit_margin <= 30
UNION ALL
select
    'Marge 10-20%' as tier,
    count(*) as count,
    3 as sort_order
from market.stocks
where profit_margin > 10 and profit_margin <= 20
UNION ALL
select
    'Marge 0-10%' as tier,
    count(*) as count,
    4 as sort_order
from market.stocks
where profit_margin >= 0 and profit_margin <= 10
UNION ALL
select
    'Marge Negative' as tier,
    count(*) as count,
    5 as sort_order
from market.stocks
where profit_margin < 0
order by sort_order`;n.funnel_profitability_data&&(n.funnel_profitability_data instanceof Error?fe.initialError=n.funnel_profitability_data:fe.initialData=n.funnel_profitability_data,n.funnel_profitability_columns&&(fe.knownColumns=n.funnel_profitability_columns));let Ct,_t=!1;const Qe=Me.createReactive({callback:N=>{a(6,Ct=N)},execFn:q},{id:"funnel_profitability",...fe});Qe($e,{noResolve:qe,...fe}),globalThis[Symbol.for("funnel_profitability")]={get value(){return Ct}};let ue={initialData:void 0,initialError:void 0},He=Q`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    profit_margin,
    sector
from market.stocks
where revenue_growth is not null
order by revenue_growth desc
limit 20`,Be=`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    profit_margin,
    sector
from market.stocks
where revenue_growth is not null
order by revenue_growth desc
limit 20`;n.top20_rev_growth_static_data&&(n.top20_rev_growth_static_data instanceof Error?ue.initialError=n.top20_rev_growth_static_data:ue.initialData=n.top20_rev_growth_static_data,n.top20_rev_growth_static_columns&&(ue.knownColumns=n.top20_rev_growth_static_columns));let mt,he=!1;const qt=Me.createReactive({callback:N=>{a(7,mt=N)},execFn:q},{id:"top20_rev_growth_static",...ue});qt(Be,{noResolve:He,...ue}),globalThis[Symbol.for("top20_rev_growth_static")]={get value(){return mt}};let Ee={initialData:void 0,initialError:void 0},le=Q`select
    symbol,
    name,
    roe,
    profit_margin,
    revenue_growth,
    sector
from market.stocks
where roe is not null
order by roe desc
limit 20`,ft=`select
    symbol,
    name,
    roe,
    profit_margin,
    revenue_growth,
    sector
from market.stocks
where roe is not null
order by roe desc
limit 20`;n.top20_roe_static_data&&(n.top20_roe_static_data instanceof Error?Ee.initialError=n.top20_roe_static_data:Ee.initialData=n.top20_roe_static_data,n.top20_roe_static_columns&&(Ee.knownColumns=n.top20_roe_static_columns));let ut,ze=!1;const Ie=Me.createReactive({callback:N=>{a(8,ut=N)},execFn:q},{id:"top20_roe_static",...Ee});Ie(ft,{noResolve:le,...Ee}),globalThis[Symbol.for("top20_roe_static")]={get value(){return ut}};let Se={initialData:void 0,initialError:void 0},_e=Q`select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
order by revenue_growth desc nulls last`,gt=`select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
order by revenue_growth desc nulls last`;n.earnings_table_static_data&&(n.earnings_table_static_data instanceof Error?Se.initialError=n.earnings_table_static_data:Se.initialData=n.earnings_table_static_data,n.earnings_table_static_columns&&(Se.knownColumns=n.earnings_table_static_columns));let ct,Xe=!1;const De=Me.createReactive({callback:N=>{a(9,ct=N)},execFn:q},{id:"earnings_table_static",...Se});De(gt,{noResolve:_e,...Se}),globalThis[Symbol.for("earnings_table_static")]={get value(){return ct}};let Fe={initialData:void 0,initialError:void 0},ke=Q`select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )
order by
  case
    when '${i.style_screener}' = 'growth' then revenue_growth
    when '${i.style_screener}' = 'value' then dividend_yield
    when '${i.style_screener}' = 'profitable' then profit_margin
    else revenue_growth
  end desc nulls last`,Ye=`select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )
order by
  case
    when '${i.style_screener}' = 'growth' then revenue_growth
    when '${i.style_screener}' = 'value' then dividend_yield
    when '${i.style_screener}' = 'profitable' then profit_margin
    else revenue_growth
  end desc nulls last`;n.growth_screener_results_data&&(n.growth_screener_results_data instanceof Error?Fe.initialError=n.growth_screener_results_data:Fe.initialData=n.growth_screener_results_data,n.growth_screener_results_columns&&(Fe.knownColumns=n.growth_screener_results_columns));let Re,Ht=!1;const $t=Me.createReactive({callback:N=>{a(10,Re=N)},execFn:q},{id:"growth_screener_results",...Fe});$t(Ye,{noResolve:ke,...Fe}),globalThis[Symbol.for("growth_screener_results")]={get value(){return Re}};let de={initialData:void 0,initialError:void 0},ge=Q`select
    count(*) as nb_matches,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin,
    round(avg(roe), 1) as avg_roe
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )`,Ke=`select
    count(*) as nb_matches,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin,
    round(avg(roe), 1) as avg_roe
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )`;n.growth_screener_stats_data&&(n.growth_screener_stats_data instanceof Error?de.initialError=n.growth_screener_stats_data:de.initialData=n.growth_screener_stats_data,n.growth_screener_stats_columns&&(de.knownColumns=n.growth_screener_stats_columns));let xe,pt=!1;const Te=Me.createReactive({callback:N=>{a(11,xe=N)},execFn:q},{id:"growth_screener_stats",...de});Te(Ke,{noResolve:ge,...de}),globalThis[Symbol.for("growth_screener_stats")]={get value(){return xe}};let We={initialData:void 0,initialError:void 0},Oe=Q`select
    symbol,
    revenue_growth,
    profit_margin,
    sector
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20`,pe=`select
    symbol,
    revenue_growth,
    profit_margin,
    sector
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20`;n.growth_screener_bar_data&&(n.growth_screener_bar_data instanceof Error?We.initialError=n.growth_screener_bar_data:We.initialData=n.growth_screener_bar_data,n.growth_screener_bar_columns&&(We.knownColumns=n.growth_screener_bar_columns));let Et,vt=!1;const Je=Me.createReactive({callback:N=>{a(12,Et=N)},execFn:q},{id:"growth_screener_bar",...We});return Je(pe,{noResolve:Oe,...We}),globalThis[Symbol.for("growth_screener_bar")]={get value(){return Et}},_.$$set=N=>{"data"in N&&a(13,g=N.data)},_.$$.update=()=>{_.$$.dirty[0]&8192&&a(14,{data:n={},customFormattingSettings:k,__db:E}=g,n),_.$$.dirty[0]&16384&&_a.set(Object.keys(n).length>0),_.$$.dirty[2]&64&&t.params,_.$$.dirty[0]&983040&&(D||!I?D||(w(A,{noResolve:D,...S}),a(19,I=!0)):w(A,{noResolve:D})),_.$$.dirty[0]&15728640&&(F||!Y?F||(P(X,{noResolve:F,...T}),a(23,Y=!0)):P(X,{noResolve:F})),_.$$.dirty[0]&251658240&&(B||!oe?B||(f(W,{noResolve:B,...K}),a(27,oe=!0)):f(W,{noResolve:B})),_.$$.dirty[0]&1879048192|_.$$.dirty[1]&1&&(u||!Lt?u||(it(H,{noResolve:u,...L}),a(31,Lt=!0)):it(H,{noResolve:u})),_.$$.dirty[1]&30&&(me||!ot?me||(ye(Pe,{noResolve:me,...we}),a(35,ot=!0)):ye(Pe,{noResolve:me})),_.$$.dirty[1]&480&&(Ce||!lt?Ce||(je(ce,{noResolve:Ce,...Ve}),a(39,lt=!0)):je(ce,{noResolve:Ce})),_.$$.dirty[1]&7680&&(qe||!_t?qe||(Qe($e,{noResolve:qe,...fe}),a(43,_t=!0)):Qe($e,{noResolve:qe})),_.$$.dirty[1]&122880&&(He||!he?He||(qt(Be,{noResolve:He,...ue}),a(47,he=!0)):qt(Be,{noResolve:He})),_.$$.dirty[1]&1966080&&(le||!ze?le||(Ie(ft,{noResolve:le,...Ee}),a(51,ze=!0)):Ie(ft,{noResolve:le})),_.$$.dirty[1]&31457280&&(_e||!Xe?_e||(De(gt,{noResolve:_e,...Se}),a(55,Xe=!0)):De(gt,{noResolve:_e})),_.$$.dirty[0]&32768&&a(57,ke=Q`select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )
order by
  case
    when '${i.style_screener}' = 'growth' then revenue_growth
    when '${i.style_screener}' = 'value' then dividend_yield
    when '${i.style_screener}' = 'profitable' then profit_margin
    else revenue_growth
  end desc nulls last`),_.$$.dirty[0]&32768&&a(58,Ye=`select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )
order by
  case
    when '${i.style_screener}' = 'growth' then revenue_growth
    when '${i.style_screener}' = 'value' then dividend_yield
    when '${i.style_screener}' = 'profitable' then profit_margin
    else revenue_growth
  end desc nulls last`),_.$$.dirty[1]&503316480&&(ke||!Ht?ke||($t(Ye,{noResolve:ke,...Fe}),a(59,Ht=!0)):$t(Ye,{noResolve:ke})),_.$$.dirty[0]&32768&&a(61,ge=Q`select
    count(*) as nb_matches,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin,
    round(avg(roe), 1) as avg_roe
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )`),_.$$.dirty[0]&32768&&a(62,Ke=`select
    count(*) as nb_matches,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(profit_margin), 1) as avg_margin,
    round(avg(roe), 1) as avg_roe
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )`),_.$$.dirty[1]&1610612736|_.$$.dirty[2]&3&&(ge||!pt?ge||(Te(Ke,{noResolve:ge,...de}),a(63,pt=!0)):Te(Ke,{noResolve:ge})),_.$$.dirty[0]&32768&&a(65,Oe=Q`select
    symbol,
    revenue_growth,
    profit_margin,
    sector
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20`),_.$$.dirty[0]&32768&&a(66,pe=`select
    symbol,
    revenue_growth,
    profit_margin,
    sector
from market.stocks
where (
    '${i.style_screener}' = 'all'
    or ('${i.style_screener}' = 'growth' and revenue_growth > 20)
    or ('${i.style_screener}' = 'value' and dividend_yield > 2)
    or ('${i.style_screener}' = 'profitable' and profit_margin > 15)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20`),_.$$.dirty[2]&60&&(Oe||!vt?Oe||(Je(pe,{noResolve:Oe,...We}),a(67,vt=!0)):Je(pe,{noResolve:Oe}))},a(17,D=Q`select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks`),a(18,A=`select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks`),a(21,F=Q`select sector, 'Brute' as margin_type, round(avg(gross_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Operationnelle' as margin_type, round(avg(operating_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Nette' as margin_type, round(avg(profit_margin),1) as val from market.stocks group by sector`),a(22,X=`select sector, 'Brute' as margin_type, round(avg(gross_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Operationnelle' as margin_type, round(avg(operating_margin),1) as val from market.stocks group by sector
UNION ALL
select sector, 'Nette' as margin_type, round(avg(profit_margin),1) as val from market.stocks group by sector`),a(25,B=Q`select
    sector,
    round(avg(revenue_growth), 1) as avg_revenue_growth
from market.stocks
where revenue_growth is not null
group by sector
order by avg_revenue_growth desc`),a(26,W=`select
    sector,
    round(avg(revenue_growth), 1) as avg_revenue_growth
from market.stocks
where revenue_growth is not null
group by sector
order by avg_revenue_growth desc`),a(29,u=Q`select
    sector,
    round(avg(roe), 1) as avg_roe
from market.stocks
where roe is not null
group by sector
order by avg_roe desc`),a(30,H=`select
    sector,
    round(avg(roe), 1) as avg_roe
from market.stocks
where roe is not null
group by sector
order by avg_roe desc`),a(33,me=Q`select
    revenue_growth
from market.stocks
where revenue_growth is not null
  and revenue_growth > -100
  and revenue_growth < 200`),a(34,Pe=`select
    revenue_growth
from market.stocks
where revenue_growth is not null
  and revenue_growth > -100
  and revenue_growth < 200`),a(37,Ce=Q`select
    profit_margin
from market.stocks
where profit_margin is not null`),a(38,ce=`select
    profit_margin
from market.stocks
where profit_margin is not null`),a(41,qe=Q`select
    'Marge > 30%' as tier,
    count(*) as count,
    1 as sort_order
from market.stocks
where profit_margin > 30
UNION ALL
select
    'Marge 20-30%' as tier,
    count(*) as count,
    2 as sort_order
from market.stocks
where profit_margin > 20 and profit_margin <= 30
UNION ALL
select
    'Marge 10-20%' as tier,
    count(*) as count,
    3 as sort_order
from market.stocks
where profit_margin > 10 and profit_margin <= 20
UNION ALL
select
    'Marge 0-10%' as tier,
    count(*) as count,
    4 as sort_order
from market.stocks
where profit_margin >= 0 and profit_margin <= 10
UNION ALL
select
    'Marge Negative' as tier,
    count(*) as count,
    5 as sort_order
from market.stocks
where profit_margin < 0
order by sort_order`),a(42,$e=`select
    'Marge > 30%' as tier,
    count(*) as count,
    1 as sort_order
from market.stocks
where profit_margin > 30
UNION ALL
select
    'Marge 20-30%' as tier,
    count(*) as count,
    2 as sort_order
from market.stocks
where profit_margin > 20 and profit_margin <= 30
UNION ALL
select
    'Marge 10-20%' as tier,
    count(*) as count,
    3 as sort_order
from market.stocks
where profit_margin > 10 and profit_margin <= 20
UNION ALL
select
    'Marge 0-10%' as tier,
    count(*) as count,
    4 as sort_order
from market.stocks
where profit_margin >= 0 and profit_margin <= 10
UNION ALL
select
    'Marge Negative' as tier,
    count(*) as count,
    5 as sort_order
from market.stocks
where profit_margin < 0
order by sort_order`),a(45,He=Q`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    profit_margin,
    sector
from market.stocks
where revenue_growth is not null
order by revenue_growth desc
limit 20`),a(46,Be=`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    profit_margin,
    sector
from market.stocks
where revenue_growth is not null
order by revenue_growth desc
limit 20`),a(49,le=Q`select
    symbol,
    name,
    roe,
    profit_margin,
    revenue_growth,
    sector
from market.stocks
where roe is not null
order by roe desc
limit 20`),a(50,ft=`select
    symbol,
    name,
    roe,
    profit_margin,
    revenue_growth,
    sector
from market.stocks
where roe is not null
order by roe desc
limit 20`),a(53,_e=Q`select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
order by revenue_growth desc nulls last`),a(54,gt=`select
    symbol,
    name,
    price,
    market_cap,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
order by revenue_growth desc nulls last`),[M,G,j,be,Ze,Nt,Ct,mt,ut,ct,Re,xe,Et,g,n,i,S,D,A,I,T,F,X,Y,K,B,W,oe,L,u,H,Lt,we,me,Pe,ot,Ve,Ce,ce,lt,fe,qe,$e,_t,ue,He,Be,he,Ee,le,ft,ze,Se,_e,gt,Xe,Fe,ke,Ye,Ht,de,ge,Ke,pt,We,Oe,pe,vt,t]}class ts extends na{constructor(r){super(),ia(this,r,Ga,Ba,Zr,{data:13},null,[-1,-1,-1])}}export{ts as component};
