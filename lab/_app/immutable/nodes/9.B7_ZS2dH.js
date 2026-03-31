import{s as Nt,d as s,i as u,a as it,b as M,c as le,e as k,h as Ut,f as Y,g as nt,j as Ae,k as b,l as O,m as Et,n as Vt,o as Bt,p as jt,q as Gt,v as me,t as Se,u as Fe,w as Qt}from"../chunks/scheduler.DUeqUKQe.js";import{S as zt,i as Yt,d as v,t as y,a as g,c as Ne,m as w,b as T,e as R,g as Ue}from"../chunks/index.CVl63dJC.js";import{D as at,e as Ot,s as Xt,Q as Ve,p as xt,C as D,a as Ct,r as Mt,b as Kt}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.bnRE_UwI.js";import{w as Wt}from"../chunks/entry.D0Bk6KXv.js";import{A as Jt,B as Qe,L as ze,Q as Be}from"../chunks/BigValue.0kiTwXtZ.js";import{h as oe,p as Zt}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{p as ht}from"../chunks/stores.BK-KNejn.js";import{B as er,a as Ye}from"../chunks/ButtonGroup.DILzvq_0.js";import{B as Ht}from"../chunks/BarChart.jQu-dQ_N.js";function tr(m){let r,a=P.title+"",t;return{c(){r=O("h1"),t=Fe(a),this.h()},l(o){r=Y(o,"H1",{class:!0});var l=Qt(r);t=Se(l,a),l.forEach(s),this.h()},h(){M(r,"class","title")},m(o,l){u(o,r,l),it(r,t)},p:me,d(o){o&&s(r)}}}function rr(m){return{c(){this.h()},l(r){this.h()},h(){document.title="Evidence"},m:me,p:me,d:me}}function ar(m){let r,a,t,o,l;return document.title=r=P.title,{c(){a=b(),t=O("meta"),o=b(),l=O("meta"),this.h()},l(i){a=k(i),t=Y(i,"META",{property:!0,content:!0}),o=k(i),l=Y(i,"META",{name:!0,content:!0}),this.h()},h(){var i,f;M(t,"property","og:title"),M(t,"content",((i=P.og)==null?void 0:i.title)??P.title),M(l,"name","twitter:title"),M(l,"content",((f=P.og)==null?void 0:f.title)??P.title)},m(i,f){u(i,a,f),u(i,t,f),u(i,o,f),u(i,l,f)},p(i,f){f&0&&r!==(r=P.title)&&(document.title=r)},d(i){i&&(s(a),s(t),s(o),s(l))}}}function ir(m){var l;let r,a,t=nr(),o=((l=P.og)==null?void 0:l.image)&&sr();return{c(){t&&t.c(),r=b(),o&&o.c(),a=nt()},l(i){t&&t.l(i),r=k(i),o&&o.l(i),a=nt()},m(i,f){t&&t.m(i,f),u(i,r,f),o&&o.m(i,f),u(i,a,f)},p(i,f){var C;t.p(i,f),(C=P.og)!=null&&C.image&&o.p(i,f)},d(i){i&&(s(r),s(a)),t&&t.d(i),o&&o.d(i)}}}function nr(m){let r,a,t,o,l;return{c(){r=O("meta"),a=b(),t=O("meta"),o=b(),l=O("meta"),this.h()},l(i){r=Y(i,"META",{name:!0,content:!0}),a=k(i),t=Y(i,"META",{property:!0,content:!0}),o=k(i),l=Y(i,"META",{name:!0,content:!0}),this.h()},h(){var i,f;M(r,"name","description"),M(r,"content",P.description),M(t,"property","og:description"),M(t,"content",((i=P.og)==null?void 0:i.description)??P.description),M(l,"name","twitter:description"),M(l,"content",((f=P.og)==null?void 0:f.description)??P.description)},m(i,f){u(i,r,f),u(i,a,f),u(i,t,f),u(i,o,f),u(i,l,f)},p:me,d(i){i&&(s(r),s(a),s(t),s(o),s(l))}}}function sr(m){let r,a,t;return{c(){r=O("meta"),a=b(),t=O("meta"),this.h()},l(o){r=Y(o,"META",{property:!0,content:!0}),a=k(o),t=Y(o,"META",{name:!0,content:!0}),this.h()},h(){var o,l;M(r,"property","og:image"),M(r,"content",Ct((o=P.og)==null?void 0:o.image)),M(t,"name","twitter:image"),M(t,"content",Ct((l=P.og)==null?void 0:l.image))},m(o,l){u(o,r,l),u(o,a,l),u(o,t,l)},p:me,d(o){o&&(s(r),s(a),s(t))}}}function or(m){let r,a,t,o,l,i,f,C,d,I;return r=new Ye({props:{value:"%",label:"Toutes"}}),t=new Ye({props:{value:"US",label:"US"}}),l=new Ye({props:{value:"Europe",label:"Europe"}}),f=new Ye({props:{value:"Asia",label:"Asie"}}),d=new Ye({props:{value:"Americas",label:"Ameriques"}}),{c(){R(r.$$.fragment),a=b(),R(t.$$.fragment),o=b(),R(l.$$.fragment),i=b(),R(f.$$.fragment),C=b(),R(d.$$.fragment)},l(p){T(r.$$.fragment,p),a=k(p),T(t.$$.fragment,p),o=k(p),T(l.$$.fragment,p),i=k(p),T(f.$$.fragment,p),C=k(p),T(d.$$.fragment,p)},m(p,q){w(r,p,q),u(p,a,q),w(t,p,q),u(p,o,q),w(l,p,q),u(p,i,q),w(f,p,q),u(p,C,q),w(d,p,q),I=!0},p:me,i(p){I||(g(r.$$.fragment,p),g(t.$$.fragment,p),g(l.$$.fragment,p),g(f.$$.fragment,p),g(d.$$.fragment,p),I=!0)},o(p){y(r.$$.fragment,p),y(t.$$.fragment,p),y(l.$$.fragment,p),y(f.$$.fragment,p),y(d.$$.fragment,p),I=!1},d(p){p&&(s(a),s(o),s(i),s(C)),v(r,p),v(t,p),v(l,p),v(f,p),v(d,p)}}}function At(m){let r,a;return r=new Be({props:{queryID:"region_summary",queryResult:m[0]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,o){w(r,t,o),a=!0},p(t,o){const l={};o[0]&1&&(l.queryResult=t[0]),r.$set(l)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function St(m){let r,a;return r=new Be({props:{queryID:"by_country",queryResult:m[1]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,o){w(r,t,o),a=!0},p(t,o){const l={};o[0]&2&&(l.queryResult=t[1]),r.$set(l)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function Ft(m){let r,a;return r=new Be({props:{queryID:"top10_by_country",queryResult:m[2]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,o){w(r,t,o),a=!0},p(t,o){const l={};o[0]&4&&(l.queryResult=t[2]),r.$set(l)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function Dt(m){let r,a;return r=new Be({props:{queryID:"sector_breakdown",queryResult:m[3]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,o){w(r,t,o),a=!0},p(t,o){const l={};o[0]&8&&(l.queryResult=t[3]),r.$set(l)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function It(m){let r,a;return r=new Be({props:{queryID:"region_top_stocks",queryResult:m[4]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,o){w(r,t,o),a=!0},p(t,o){const l={};o[0]&16&&(l.queryResult=t[4]),r.$set(l)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function Lt(m){let r,a;return r=new Be({props:{queryID:"region_stocks_all",queryResult:m[5]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,o){w(r,t,o),a=!0},p(t,o){const l={};o[0]&32&&(l.queryResult=t[5]),r.$set(l)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function lr(m){let r;return{c(){r=Fe("Explorez la repartition geographique des plus grandes capitalisations mondiales. Selectionnez une region pour analyser sa composition par pays et par secteur.")},l(a){r=Se(a,"Explorez la repartition geographique des plus grandes capitalisations mondiales. Selectionnez une region pour analyser sa composition par pays et par secteur.")},m(a,t){u(a,r,t)},d(a){a&&s(r)}}}function mr(m){let r,a,t,o,l,i,f,C,d,I,p,q;return r=new D({props:{id:"country",title:"Pays"}}),t=new D({props:{id:"nb_stocks",title:"Nb Actions"}}),l=new D({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),f=new D({props:{id:"avg_pe",title:"P/E Fwd Moy.",fmt:"num1"}}),d=new D({props:{id:"avg_div_yield",title:"Div Yield Moy. (%)",fmt:"num1"}}),p=new D({props:{id:"avg_change",title:"Var Moy. (%)",fmt:"num1"}}),{c(){R(r.$$.fragment),a=b(),R(t.$$.fragment),o=b(),R(l.$$.fragment),i=b(),R(f.$$.fragment),C=b(),R(d.$$.fragment),I=b(),R(p.$$.fragment)},l(c){T(r.$$.fragment,c),a=k(c),T(t.$$.fragment,c),o=k(c),T(l.$$.fragment,c),i=k(c),T(f.$$.fragment,c),C=k(c),T(d.$$.fragment,c),I=k(c),T(p.$$.fragment,c)},m(c,H){w(r,c,H),u(c,a,H),w(t,c,H),u(c,o,H),w(l,c,H),u(c,i,H),w(f,c,H),u(c,C,H),w(d,c,H),u(c,I,H),w(p,c,H),q=!0},p:me,i(c){q||(g(r.$$.fragment,c),g(t.$$.fragment,c),g(l.$$.fragment,c),g(f.$$.fragment,c),g(d.$$.fragment,c),g(p.$$.fragment,c),q=!0)},o(c){y(r.$$.fragment,c),y(t.$$.fragment,c),y(l.$$.fragment,c),y(f.$$.fragment,c),y(d.$$.fragment,c),y(p.$$.fragment,c),q=!1},d(c){c&&(s(a),s(o),s(i),s(C),s(I)),v(r,c),v(t,c),v(l,c),v(f,c),v(d,c),v(p,c)}}}function ur(m){let r,a,t,o,l,i;return r=new D({props:{id:"sector",title:"Secteur"}}),t=new D({props:{id:"nb_stocks",title:"Nb Actions"}}),l=new D({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),{c(){R(r.$$.fragment),a=b(),R(t.$$.fragment),o=b(),R(l.$$.fragment)},l(f){T(r.$$.fragment,f),a=k(f),T(t.$$.fragment,f),o=k(f),T(l.$$.fragment,f)},m(f,C){w(r,f,C),u(f,a,C),w(t,f,C),u(f,o,C),w(l,f,C),i=!0},p:me,i(f){i||(g(r.$$.fragment,f),g(t.$$.fragment,f),g(l.$$.fragment,f),i=!0)},o(f){y(r.$$.fragment,f),y(t.$$.fragment,f),y(l.$$.fragment,f),i=!1},d(f){f&&(s(a),s(o)),v(r,f),v(t,f),v(l,f)}}}function fr(m){let r,a,t,o,l,i,f,C,d,I,p,q,c,H,L,N,F,U;return r=new D({props:{id:"symbol",title:"Ticker"}}),t=new D({props:{id:"name",title:"Nom"}}),l=new D({props:{id:"price",title:"Prix",fmt:"usd"}}),f=new D({props:{id:"change_pct",title:"Var %",fmt:"num1"}}),d=new D({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),p=new D({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),c=new D({props:{id:"dividend_yield",title:"Div %",fmt:"num1"}}),L=new D({props:{id:"sector",title:"Secteur"}}),F=new D({props:{id:"country",title:"Pays"}}),{c(){R(r.$$.fragment),a=b(),R(t.$$.fragment),o=b(),R(l.$$.fragment),i=b(),R(f.$$.fragment),C=b(),R(d.$$.fragment),I=b(),R(p.$$.fragment),q=b(),R(c.$$.fragment),H=b(),R(L.$$.fragment),N=b(),R(F.$$.fragment)},l(_){T(r.$$.fragment,_),a=k(_),T(t.$$.fragment,_),o=k(_),T(l.$$.fragment,_),i=k(_),T(f.$$.fragment,_),C=k(_),T(d.$$.fragment,_),I=k(_),T(p.$$.fragment,_),q=k(_),T(c.$$.fragment,_),H=k(_),T(L.$$.fragment,_),N=k(_),T(F.$$.fragment,_)},m(_,E){w(r,_,E),u(_,a,E),w(t,_,E),u(_,o,E),w(l,_,E),u(_,i,E),w(f,_,E),u(_,C,E),w(d,_,E),u(_,I,E),w(p,_,E),u(_,q,E),w(c,_,E),u(_,H,E),w(L,_,E),u(_,N,E),w(F,_,E),U=!0},p:me,i(_){U||(g(r.$$.fragment,_),g(t.$$.fragment,_),g(l.$$.fragment,_),g(f.$$.fragment,_),g(d.$$.fragment,_),g(p.$$.fragment,_),g(c.$$.fragment,_),g(L.$$.fragment,_),g(F.$$.fragment,_),U=!0)},o(_){y(r.$$.fragment,_),y(t.$$.fragment,_),y(l.$$.fragment,_),y(f.$$.fragment,_),y(d.$$.fragment,_),y(p.$$.fragment,_),y(c.$$.fragment,_),y(L.$$.fragment,_),y(F.$$.fragment,_),U=!1},d(_){_&&(s(a),s(o),s(i),s(C),s(I),s(q),s(H),s(N)),v(r,_),v(t,_),v(l,_),v(f,_),v(d,_),v(p,_),v(c,_),v(L,_),v(F,_)}}}function _r(m){let r,a,t,o,l,i,f,C,d,I,p,q,c,H,L,N,F,U,_,E;return r=new D({props:{id:"symbol",title:"Ticker"}}),t=new D({props:{id:"name",title:"Nom"}}),l=new D({props:{id:"price",title:"Prix",fmt:"usd"}}),f=new D({props:{id:"change_pct",title:"Var %",fmt:"num1"}}),d=new D({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),p=new D({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),c=new D({props:{id:"dividend_yield",title:"Div %",fmt:"num1"}}),L=new D({props:{id:"sector",title:"Secteur"}}),F=new D({props:{id:"region",title:"Region"}}),_=new D({props:{id:"country",title:"Pays"}}),{c(){R(r.$$.fragment),a=b(),R(t.$$.fragment),o=b(),R(l.$$.fragment),i=b(),R(f.$$.fragment),C=b(),R(d.$$.fragment),I=b(),R(p.$$.fragment),q=b(),R(c.$$.fragment),H=b(),R(L.$$.fragment),N=b(),R(F.$$.fragment),U=b(),R(_.$$.fragment)},l($){T(r.$$.fragment,$),a=k($),T(t.$$.fragment,$),o=k($),T(l.$$.fragment,$),i=k($),T(f.$$.fragment,$),C=k($),T(d.$$.fragment,$),I=k($),T(p.$$.fragment,$),q=k($),T(c.$$.fragment,$),H=k($),T(L.$$.fragment,$),N=k($),T(F.$$.fragment,$),U=k($),T(_.$$.fragment,$)},m($,A){w(r,$,A),u($,a,A),w(t,$,A),u($,o,A),w(l,$,A),u($,i,A),w(f,$,A),u($,C,A),w(d,$,A),u($,I,A),w(p,$,A),u($,q,A),w(c,$,A),u($,H,A),w(L,$,A),u($,N,A),w(F,$,A),u($,U,A),w(_,$,A),E=!0},p:me,i($){E||(g(r.$$.fragment,$),g(t.$$.fragment,$),g(l.$$.fragment,$),g(f.$$.fragment,$),g(d.$$.fragment,$),g(p.$$.fragment,$),g(c.$$.fragment,$),g(L.$$.fragment,$),g(F.$$.fragment,$),g(_.$$.fragment,$),E=!0)},o($){y(r.$$.fragment,$),y(t.$$.fragment,$),y(l.$$.fragment,$),y(f.$$.fragment,$),y(d.$$.fragment,$),y(p.$$.fragment,$),y(c.$$.fragment,$),y(L.$$.fragment,$),y(F.$$.fragment,$),y(_.$$.fragment,$),E=!1},d($){$&&(s(a),s(o),s(i),s(C),s(I),s(q),s(H),s(N),s(U)),v(r,$),v(t,$),v(l,$),v(f,$),v(d,$),v(p,$),v(c,$),v(L,$),v(F,$),v(_,$)}}}function $r(m){let r;return{c(){r=Fe("Accueil")},l(a){r=Se(a,"Accueil")},m(a,t){u(a,r,t)},d(a){a&&s(r)}}}function pr(m){let r;return{c(){r=Fe("Explorateur d'Actions")},l(a){r=Se(a,"Explorateur d'Actions")},m(a,t){u(a,r,t)},d(a){a&&s(r)}}}function cr(m){let r;return{c(){r=Fe("Analyse Sectorielle")},l(a){r=Se(a,"Analyse Sectorielle")},m(a,t){u(a,r,t)},d(a){a&&s(r)}}}function gr(m){let r;return{c(){r=Fe("Lab de Valorisation")},l(a){r=Se(a,"Lab de Valorisation")},m(a,t){u(a,r,t)},d(a){a&&s(r)}}}function yr(m){let r;return{c(){r=Fe("Croissance & Rentabilite")},l(a){r=Se(a,"Croissance & Rentabilite")},m(a,t){u(a,r,t)},d(a){a&&s(r)}}}function dr(m){let r,a,t,o,l,i,f="← Retour DailyTickers",C,d,I,p,q,c,H,L,N,F,U='<a href="#analyse-geographique">Analyse Geographique</a>',_,E,$,A,De='<a href="#metriques-de-la-selection">Metriques de la Selection</a>',ee,X,ue,te,de,re,ae,x,fe,ie,ke,J,_e='<a href="#top-10-pays-par-capitalisation">Top 10 Pays par Capitalisation</a>',ne,W,be,Z,Ie='<a href="#repartition-par-pays">Repartition par Pays</a>',se,K,$e,h,Le='<a href="#composition-sectorielle">Composition Sectorielle</a>',ve,S,Pe,we,Oe,pe,ut='<a href="#top-20-capitalisations-de-la-region">Top 20 Capitalisations de la Region</a>',Xe,Te,xe,ce,ft='<a href="#toutes-les-actions">Toutes les Actions</a>',Ke,Re,We,je,Je,qe,Ze,Ee,he,Ce,et,Me,tt,He,rt,ge=typeof P<"u"&&P.title&&P.hide_title!==!0&&tr();function Pt(e,n){return typeof P<"u"&&P.title?ar:rr}let Ge=Pt()(m),ye=typeof P=="object"&&ir();d=new er({props:{name:"region_select",title:"Region",defaultValue:"%",$$slots:{default:[or]},$$scope:{ctx:m}}});let V=m[0]&&At(m),B=m[1]&&St(m),j=m[2]&&Ft(m),G=m[3]&&Dt(m),Q=m[4]&&It(m),z=m[5]&&Lt(m);return E=new Jt({props:{status:"info",$$slots:{default:[lr]},$$scope:{ctx:m}}}),X=new Qe({props:{data:m[0],value:"nb_stocks",title:"Actions"}}),te=new Qe({props:{data:m[0],value:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),re=new Qe({props:{data:m[0],value:"avg_pe_forward",title:"P/E Forward Moy."}}),x=new Qe({props:{data:m[0],value:"avg_div_yield",title:"Div. Yield Moy. (%)"}}),ie=new Qe({props:{data:m[0],value:"avg_change",title:"Var. Moy. (%)"}}),W=new Ht({props:{data:m[2],x:"country",y:"total_mcap",xAxisTitle:"Pays",yAxisTitle:"Capitalisation Totale ($)",title:"Capitalisation par Pays",fmt:"usd",swapXY:"true",sort:"false"}}),K=new at({props:{data:m[1],rows:"15",$$slots:{default:[mr]},$$scope:{ctx:m}}}),S=new Ht({props:{data:m[3],x:"sector",y:"total_mcap",title:"Repartition Sectorielle dans la Region",fmt:"usd",swapXY:"true",sort:"false"}}),we=new at({props:{data:m[3],rows:"12",$$slots:{default:[ur]},$$scope:{ctx:m}}}),Te=new at({props:{data:m[4],rows:"20",$$slots:{default:[fr]},$$scope:{ctx:m}}}),Re=new at({props:{data:m[5],search:"true",rows:"20",$$slots:{default:[_r]},$$scope:{ctx:m}}}),qe=new ze({props:{url:"/",$$slots:{default:[$r]},$$scope:{ctx:m}}}),Ee=new ze({props:{url:"/explorer",$$slots:{default:[pr]},$$scope:{ctx:m}}}),Ce=new ze({props:{url:"/sectors",$$slots:{default:[cr]},$$scope:{ctx:m}}}),Me=new ze({props:{url:"/valuations",$$slots:{default:[gr]},$$scope:{ctx:m}}}),He=new ze({props:{url:"/earnings",$$slots:{default:[yr]},$$scope:{ctx:m}}}),{c(){ge&&ge.c(),r=b(),Ge.c(),a=O("meta"),t=O("meta"),ye&&ye.c(),o=nt(),l=b(),i=O("a"),i.textContent=f,C=b(),R(d.$$.fragment),I=b(),V&&V.c(),p=b(),B&&B.c(),q=b(),j&&j.c(),c=b(),G&&G.c(),H=b(),Q&&Q.c(),L=b(),z&&z.c(),N=b(),F=O("h1"),F.innerHTML=U,_=b(),R(E.$$.fragment),$=b(),A=O("h2"),A.innerHTML=De,ee=b(),R(X.$$.fragment),ue=b(),R(te.$$.fragment),de=b(),R(re.$$.fragment),ae=b(),R(x.$$.fragment),fe=b(),R(ie.$$.fragment),ke=b(),J=O("h2"),J.innerHTML=_e,ne=b(),R(W.$$.fragment),be=b(),Z=O("h2"),Z.innerHTML=Ie,se=b(),R(K.$$.fragment),$e=b(),h=O("h2"),h.innerHTML=Le,ve=b(),R(S.$$.fragment),Pe=b(),R(we.$$.fragment),Oe=b(),pe=O("h2"),pe.innerHTML=ut,Xe=b(),R(Te.$$.fragment),xe=b(),ce=O("h2"),ce.innerHTML=ft,Ke=b(),R(Re.$$.fragment),We=b(),je=O("hr"),Je=b(),R(qe.$$.fragment),Ze=b(),R(Ee.$$.fragment),he=b(),R(Ce.$$.fragment),et=b(),R(Me.$$.fragment),tt=b(),R(He.$$.fragment),this.h()},l(e){ge&&ge.l(e),r=k(e);const n=Ut("svelte-2igo1p",document.head);Ge.l(n),a=Y(n,"META",{name:!0,content:!0}),t=Y(n,"META",{name:!0,content:!0}),ye&&ye.l(n),o=nt(),n.forEach(s),l=k(e),i=Y(e,"A",{href:!0,style:!0,"data-svelte-h":!0}),Ae(i)!=="svelte-80akn7"&&(i.textContent=f),C=k(e),T(d.$$.fragment,e),I=k(e),V&&V.l(e),p=k(e),B&&B.l(e),q=k(e),j&&j.l(e),c=k(e),G&&G.l(e),H=k(e),Q&&Q.l(e),L=k(e),z&&z.l(e),N=k(e),F=Y(e,"H1",{class:!0,id:!0,"data-svelte-h":!0}),Ae(F)!=="svelte-svrh1s"&&(F.innerHTML=U),_=k(e),T(E.$$.fragment,e),$=k(e),A=Y(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(A)!=="svelte-1kjt56h"&&(A.innerHTML=De),ee=k(e),T(X.$$.fragment,e),ue=k(e),T(te.$$.fragment,e),de=k(e),T(re.$$.fragment,e),ae=k(e),T(x.$$.fragment,e),fe=k(e),T(ie.$$.fragment,e),ke=k(e),J=Y(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(J)!=="svelte-1yo0m1b"&&(J.innerHTML=_e),ne=k(e),T(W.$$.fragment,e),be=k(e),Z=Y(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(Z)!=="svelte-h3wtyj"&&(Z.innerHTML=Ie),se=k(e),T(K.$$.fragment,e),$e=k(e),h=Y(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(h)!=="svelte-1u8hxyp"&&(h.innerHTML=Le),ve=k(e),T(S.$$.fragment,e),Pe=k(e),T(we.$$.fragment,e),Oe=k(e),pe=Y(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(pe)!=="svelte-9o4vin"&&(pe.innerHTML=ut),Xe=k(e),T(Te.$$.fragment,e),xe=k(e),ce=Y(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(ce)!=="svelte-yw5yjp"&&(ce.innerHTML=ft),Ke=k(e),T(Re.$$.fragment,e),We=k(e),je=Y(e,"HR",{class:!0}),Je=k(e),T(qe.$$.fragment,e),Ze=k(e),T(Ee.$$.fragment,e),he=k(e),T(Ce.$$.fragment,e),et=k(e),T(Me.$$.fragment,e),tt=k(e),T(He.$$.fragment,e),this.h()},h(){M(a,"name","twitter:card"),M(a,"content","summary_large_image"),M(t,"name","twitter:site"),M(t,"content","@evidence_dev"),M(i,"href","/lab/"),le(i,"display","inline-flex"),le(i,"align-items","center"),le(i,"gap","6px"),le(i,"padding","6px 14px"),le(i,"background","#f1f5f9"),le(i,"border","1px solid #e2e8f0"),le(i,"border-radius","8px"),le(i,"color","#475569"),le(i,"text-decoration","none"),le(i,"font-size","0.85rem"),le(i,"margin-bottom","1rem"),M(F,"class","markdown"),M(F,"id","analyse-geographique"),M(A,"class","markdown"),M(A,"id","metriques-de-la-selection"),M(J,"class","markdown"),M(J,"id","top-10-pays-par-capitalisation"),M(Z,"class","markdown"),M(Z,"id","repartition-par-pays"),M(h,"class","markdown"),M(h,"id","composition-sectorielle"),M(pe,"class","markdown"),M(pe,"id","top-20-capitalisations-de-la-region"),M(ce,"class","markdown"),M(ce,"id","toutes-les-actions"),M(je,"class","markdown")},m(e,n){ge&&ge.m(e,n),u(e,r,n),Ge.m(document.head,null),it(document.head,a),it(document.head,t),ye&&ye.m(document.head,null),it(document.head,o),u(e,l,n),u(e,i,n),u(e,C,n),w(d,e,n),u(e,I,n),V&&V.m(e,n),u(e,p,n),B&&B.m(e,n),u(e,q,n),j&&j.m(e,n),u(e,c,n),G&&G.m(e,n),u(e,H,n),Q&&Q.m(e,n),u(e,L,n),z&&z.m(e,n),u(e,N,n),u(e,F,n),u(e,_,n),w(E,e,n),u(e,$,n),u(e,A,n),u(e,ee,n),w(X,e,n),u(e,ue,n),w(te,e,n),u(e,de,n),w(re,e,n),u(e,ae,n),w(x,e,n),u(e,fe,n),w(ie,e,n),u(e,ke,n),u(e,J,n),u(e,ne,n),w(W,e,n),u(e,be,n),u(e,Z,n),u(e,se,n),w(K,e,n),u(e,$e,n),u(e,h,n),u(e,ve,n),w(S,e,n),u(e,Pe,n),w(we,e,n),u(e,Oe,n),u(e,pe,n),u(e,Xe,n),w(Te,e,n),u(e,xe,n),u(e,ce,n),u(e,Ke,n),w(Re,e,n),u(e,We,n),u(e,je,n),u(e,Je,n),w(qe,e,n),u(e,Ze,n),w(Ee,e,n),u(e,he,n),w(Ce,e,n),u(e,et,n),w(Me,e,n),u(e,tt,n),w(He,e,n),rt=!0},p(e,n){typeof P<"u"&&P.title&&P.hide_title!==!0&&ge.p(e,n),Ge.p(e,n),typeof P=="object"&&ye.p(e,n);const _t={};n[1]&131072&&(_t.$$scope={dirty:n,ctx:e}),d.$set(_t),e[0]?V?(V.p(e,n),n[0]&1&&g(V,1)):(V=At(e),V.c(),g(V,1),V.m(p.parentNode,p)):V&&(Ue(),y(V,1,1,()=>{V=null}),Ne()),e[1]?B?(B.p(e,n),n[0]&2&&g(B,1)):(B=St(e),B.c(),g(B,1),B.m(q.parentNode,q)):B&&(Ue(),y(B,1,1,()=>{B=null}),Ne()),e[2]?j?(j.p(e,n),n[0]&4&&g(j,1)):(j=Ft(e),j.c(),g(j,1),j.m(c.parentNode,c)):j&&(Ue(),y(j,1,1,()=>{j=null}),Ne()),e[3]?G?(G.p(e,n),n[0]&8&&g(G,1)):(G=Dt(e),G.c(),g(G,1),G.m(H.parentNode,H)):G&&(Ue(),y(G,1,1,()=>{G=null}),Ne()),e[4]?Q?(Q.p(e,n),n[0]&16&&g(Q,1)):(Q=It(e),Q.c(),g(Q,1),Q.m(L.parentNode,L)):Q&&(Ue(),y(Q,1,1,()=>{Q=null}),Ne()),e[5]?z?(z.p(e,n),n[0]&32&&g(z,1)):(z=Lt(e),z.c(),g(z,1),z.m(N.parentNode,N)):z&&(Ue(),y(z,1,1,()=>{z=null}),Ne());const $t={};n[1]&131072&&($t.$$scope={dirty:n,ctx:e}),E.$set($t);const pt={};n[0]&1&&(pt.data=e[0]),X.$set(pt);const ct={};n[0]&1&&(ct.data=e[0]),te.$set(ct);const gt={};n[0]&1&&(gt.data=e[0]),re.$set(gt);const yt={};n[0]&1&&(yt.data=e[0]),x.$set(yt);const dt={};n[0]&1&&(dt.data=e[0]),ie.$set(dt);const kt={};n[0]&4&&(kt.data=e[2]),W.$set(kt);const st={};n[0]&2&&(st.data=e[1]),n[1]&131072&&(st.$$scope={dirty:n,ctx:e}),K.$set(st);const bt={};n[0]&8&&(bt.data=e[3]),S.$set(bt);const ot={};n[0]&8&&(ot.data=e[3]),n[1]&131072&&(ot.$$scope={dirty:n,ctx:e}),we.$set(ot);const lt={};n[0]&16&&(lt.data=e[4]),n[1]&131072&&(lt.$$scope={dirty:n,ctx:e}),Te.$set(lt);const mt={};n[0]&32&&(mt.data=e[5]),n[1]&131072&&(mt.$$scope={dirty:n,ctx:e}),Re.$set(mt);const vt={};n[1]&131072&&(vt.$$scope={dirty:n,ctx:e}),qe.$set(vt);const wt={};n[1]&131072&&(wt.$$scope={dirty:n,ctx:e}),Ee.$set(wt);const Tt={};n[1]&131072&&(Tt.$$scope={dirty:n,ctx:e}),Ce.$set(Tt);const Rt={};n[1]&131072&&(Rt.$$scope={dirty:n,ctx:e}),Me.$set(Rt);const qt={};n[1]&131072&&(qt.$$scope={dirty:n,ctx:e}),He.$set(qt)},i(e){rt||(g(d.$$.fragment,e),g(V),g(B),g(j),g(G),g(Q),g(z),g(E.$$.fragment,e),g(X.$$.fragment,e),g(te.$$.fragment,e),g(re.$$.fragment,e),g(x.$$.fragment,e),g(ie.$$.fragment,e),g(W.$$.fragment,e),g(K.$$.fragment,e),g(S.$$.fragment,e),g(we.$$.fragment,e),g(Te.$$.fragment,e),g(Re.$$.fragment,e),g(qe.$$.fragment,e),g(Ee.$$.fragment,e),g(Ce.$$.fragment,e),g(Me.$$.fragment,e),g(He.$$.fragment,e),rt=!0)},o(e){y(d.$$.fragment,e),y(V),y(B),y(j),y(G),y(Q),y(z),y(E.$$.fragment,e),y(X.$$.fragment,e),y(te.$$.fragment,e),y(re.$$.fragment,e),y(x.$$.fragment,e),y(ie.$$.fragment,e),y(W.$$.fragment,e),y(K.$$.fragment,e),y(S.$$.fragment,e),y(we.$$.fragment,e),y(Te.$$.fragment,e),y(Re.$$.fragment,e),y(qe.$$.fragment,e),y(Ee.$$.fragment,e),y(Ce.$$.fragment,e),y(Me.$$.fragment,e),y(He.$$.fragment,e),rt=!1},d(e){e&&(s(r),s(l),s(i),s(C),s(I),s(p),s(q),s(c),s(H),s(L),s(N),s(F),s(_),s($),s(A),s(ee),s(ue),s(de),s(ae),s(fe),s(ke),s(J),s(ne),s(be),s(Z),s(se),s($e),s(h),s(ve),s(Pe),s(Oe),s(pe),s(Xe),s(xe),s(ce),s(Ke),s(We),s(je),s(Je),s(Ze),s(he),s(et),s(tt)),ge&&ge.d(e),Ge.d(e),s(a),s(t),ye&&ye.d(e),s(o),v(d,e),V&&V.d(e),B&&B.d(e),j&&j.d(e),G&&G.d(e),Q&&Q.d(e),z&&z.d(e),v(E,e),v(X,e),v(te,e),v(re,e),v(x,e),v(ie,e),v(W,e),v(K,e),v(S,e),v(we,e),v(Te,e),v(Re,e),v(qe,e),v(Ee,e),v(Ce,e),v(Me,e),v(He,e)}}}const P={title:"Analyse Geographique - Radiographie des 150 Plus Grandes Capitalisations Mondiales",description:"Repartition geographique des capitalisations - par region, pays et secteur"};function kr(m,r,a){let t,o;Et(m,ht,S=>a(33,t=S)),Et(m,Mt,S=>a(38,o=S));let{data:l}=r,{data:i={},customFormattingSettings:f,__db:C,inputs:d}=l;Vt(Mt,o="36a9a17f2f25c40e261578afe03e4b60",o);let I=Ot(Wt(d));Bt(I.subscribe(S=>a(8,d=S))),jt(Kt,{getCustomFormats:()=>f.customFormats||[]});const p=(S,Pe)=>Zt(C.query,S,{query_name:Pe});Xt(p),t.params,Gt(()=>!0);let q={initialData:void 0,initialError:void 0},c=oe`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${d.region_select.value}'`,H=`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${d.region_select.value}'`;i.region_summary_data&&(i.region_summary_data instanceof Error?q.initialError=i.region_summary_data:q.initialData=i.region_summary_data,i.region_summary_columns&&(q.knownColumns=i.region_summary_columns));let L,N=!1;const F=Ve.createReactive({callback:S=>{a(0,L=S)},execFn:p},{id:"region_summary",...q});F(H,{noResolve:c,...q}),globalThis[Symbol.for("region_summary")]={get value(){return L}};let U={initialData:void 0,initialError:void 0},_=oe`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${d.region_select.value}'
group by country
order by total_mcap desc`,E=`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${d.region_select.value}'
group by country
order by total_mcap desc`;i.by_country_data&&(i.by_country_data instanceof Error?U.initialError=i.by_country_data:U.initialData=i.by_country_data,i.by_country_columns&&(U.knownColumns=i.by_country_columns));let $,A=!1;const De=Ve.createReactive({callback:S=>{a(1,$=S)},execFn:p},{id:"by_country",...U});De(E,{noResolve:_,...U}),globalThis[Symbol.for("by_country")]={get value(){return $}};let ee={initialData:void 0,initialError:void 0},X=oe`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${d.region_select.value}'
group by country
order by total_mcap desc
limit 10`,ue=`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${d.region_select.value}'
group by country
order by total_mcap desc
limit 10`;i.top10_by_country_data&&(i.top10_by_country_data instanceof Error?ee.initialError=i.top10_by_country_data:ee.initialData=i.top10_by_country_data,i.top10_by_country_columns&&(ee.knownColumns=i.top10_by_country_columns));let te,de=!1;const re=Ve.createReactive({callback:S=>{a(2,te=S)},execFn:p},{id:"top10_by_country",...ee});re(ue,{noResolve:X,...ee}),globalThis[Symbol.for("top10_by_country")]={get value(){return te}};let ae={initialData:void 0,initialError:void 0},x=oe`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${d.region_select.value}'
group by sector
order by total_mcap desc`,fe=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${d.region_select.value}'
group by sector
order by total_mcap desc`;i.sector_breakdown_data&&(i.sector_breakdown_data instanceof Error?ae.initialError=i.sector_breakdown_data:ae.initialData=i.sector_breakdown_data,i.sector_breakdown_columns&&(ae.knownColumns=i.sector_breakdown_columns));let ie,ke=!1;const J=Ve.createReactive({callback:S=>{a(3,ie=S)},execFn:p},{id:"sector_breakdown",...ae});J(fe,{noResolve:x,...ae}),globalThis[Symbol.for("sector_breakdown")]={get value(){return ie}};let _e={initialData:void 0,initialError:void 0},ne=oe`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    sector,
    country
from market.stocks
where region like '${d.region_select.value}'
order by market_cap desc
limit 20`,W=`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    sector,
    country
from market.stocks
where region like '${d.region_select.value}'
order by market_cap desc
limit 20`;i.region_top_stocks_data&&(i.region_top_stocks_data instanceof Error?_e.initialError=i.region_top_stocks_data:_e.initialData=i.region_top_stocks_data,i.region_top_stocks_columns&&(_e.knownColumns=i.region_top_stocks_columns));let be,Z=!1;const Ie=Ve.createReactive({callback:S=>{a(4,be=S)},execFn:p},{id:"region_top_stocks",..._e});Ie(W,{noResolve:ne,..._e}),globalThis[Symbol.for("region_top_stocks")]={get value(){return be}};let se={initialData:void 0,initialError:void 0},K=oe`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where region like '${d.region_select.value}'
order by market_cap desc`,$e=`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where region like '${d.region_select.value}'
order by market_cap desc`;i.region_stocks_all_data&&(i.region_stocks_all_data instanceof Error?se.initialError=i.region_stocks_all_data:se.initialData=i.region_stocks_all_data,i.region_stocks_all_columns&&(se.knownColumns=i.region_stocks_all_columns));let h,Le=!1;const ve=Ve.createReactive({callback:S=>{a(5,h=S)},execFn:p},{id:"region_stocks_all",...se});return ve($e,{noResolve:K,...se}),globalThis[Symbol.for("region_stocks_all")]={get value(){return h}},m.$$set=S=>{"data"in S&&a(6,l=S.data)},m.$$.update=()=>{m.$$.dirty[0]&64&&a(7,{data:i={},customFormattingSettings:f,__db:C}=l,i),m.$$.dirty[0]&128&&xt.set(Object.keys(i).length>0),m.$$.dirty[1]&4&&t.params,m.$$.dirty[0]&256&&a(10,c=oe`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${d.region_select.value}'`),m.$$.dirty[0]&256&&a(11,H=`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${d.region_select.value}'`),m.$$.dirty[0]&7680&&(c||!N?c||(F(H,{noResolve:c,...q}),a(12,N=!0)):F(H,{noResolve:c})),m.$$.dirty[0]&256&&a(14,_=oe`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${d.region_select.value}'
group by country
order by total_mcap desc`),m.$$.dirty[0]&256&&a(15,E=`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${d.region_select.value}'
group by country
order by total_mcap desc`),m.$$.dirty[0]&122880&&(_||!A?_||(De(E,{noResolve:_,...U}),a(16,A=!0)):De(E,{noResolve:_})),m.$$.dirty[0]&256&&a(18,X=oe`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${d.region_select.value}'
group by country
order by total_mcap desc
limit 10`),m.$$.dirty[0]&256&&a(19,ue=`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${d.region_select.value}'
group by country
order by total_mcap desc
limit 10`),m.$$.dirty[0]&1966080&&(X||!de?X||(re(ue,{noResolve:X,...ee}),a(20,de=!0)):re(ue,{noResolve:X})),m.$$.dirty[0]&256&&a(22,x=oe`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${d.region_select.value}'
group by sector
order by total_mcap desc`),m.$$.dirty[0]&256&&a(23,fe=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${d.region_select.value}'
group by sector
order by total_mcap desc`),m.$$.dirty[0]&31457280&&(x||!ke?x||(J(fe,{noResolve:x,...ae}),a(24,ke=!0)):J(fe,{noResolve:x})),m.$$.dirty[0]&256&&a(26,ne=oe`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    sector,
    country
from market.stocks
where region like '${d.region_select.value}'
order by market_cap desc
limit 20`),m.$$.dirty[0]&256&&a(27,W=`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    sector,
    country
from market.stocks
where region like '${d.region_select.value}'
order by market_cap desc
limit 20`),m.$$.dirty[0]&503316480&&(ne||!Z?ne||(Ie(W,{noResolve:ne,..._e}),a(28,Z=!0)):Ie(W,{noResolve:ne})),m.$$.dirty[0]&256&&a(30,K=oe`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where region like '${d.region_select.value}'
order by market_cap desc`),m.$$.dirty[0]&256&&a(31,$e=`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    sector,
    region,
    country
from market.stocks
where region like '${d.region_select.value}'
order by market_cap desc`),m.$$.dirty[0]&1610612736|m.$$.dirty[1]&3&&(K||!Le?K||(ve($e,{noResolve:K,...se}),a(32,Le=!0)):ve($e,{noResolve:K}))},[L,$,te,ie,be,h,l,i,d,q,c,H,N,U,_,E,A,ee,X,ue,de,ae,x,fe,ke,_e,ne,W,Z,se,K,$e,Le,t]}class Ar extends zt{constructor(r){super(),Yt(this,r,kr,dr,Nt,{data:6},null,[-1,-1])}}export{Ar as component};
