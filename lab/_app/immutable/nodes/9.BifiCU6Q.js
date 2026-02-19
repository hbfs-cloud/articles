import{s as Dt,d as l,i as _,a as et,b as M,c as d,h as It,e as z,f as tt,g as Ae,j as k,k as O,l as wt,m as Lt,o as Pt,n as Nt,p as Ut,u as me,r as Se,t as Fe,v as Vt}from"../chunks/scheduler.C1IyP_xX.js";import{S as Bt,i as jt,d as v,t as y,a as g,c as Ie,m as w,b as T,e as R,g as Le}from"../chunks/index.BelnLFQw.js";import{D as xe,e as Gt,s as Qt,Q as Pe,p as Yt,C as D,a as Tt,r as Rt,b as zt}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.D5dJpiGm.js";import{w as Ot}from"../chunks/entry.CvT_HqKe.js";import{A as Xt,B as Be,L as je,Q as Ne}from"../chunks/BigValue.DtjsgKUt.js";import{h as oe,p as Kt}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{p as Jt}from"../chunks/stores.DwqSwx_r.js";import{B as Wt,a as Ge}from"../chunks/ButtonGroup.Cj25vz9s.js";import{B as qt}from"../chunks/BarChart.BRjntLn8.js";function Zt(m){let r,a=L.title+"",t;return{c(){r=O("h1"),t=Fe(a),this.h()},l(s){r=z(s,"H1",{class:!0});var o=Vt(r);t=Se(o,a),o.forEach(l),this.h()},h(){M(r,"class","title")},m(s,o){_(s,r,o),et(r,t)},p:me,d(s){s&&l(r)}}}function ht(m){return{c(){this.h()},l(r){this.h()},h(){document.title="Evidence"},m:me,p:me,d:me}}function xt(m){let r,a,t,s,o;return document.title=r=L.title,{c(){a=k(),t=O("meta"),s=k(),o=O("meta"),this.h()},l(i){a=d(i),t=z(i,"META",{property:!0,content:!0}),s=d(i),o=z(i,"META",{name:!0,content:!0}),this.h()},h(){var i,f;M(t,"property","og:title"),M(t,"content",((i=L.og)==null?void 0:i.title)??L.title),M(o,"name","twitter:title"),M(o,"content",((f=L.og)==null?void 0:f.title)??L.title)},m(i,f){_(i,a,f),_(i,t,f),_(i,s,f),_(i,o,f)},p(i,f){f&0&&r!==(r=L.title)&&(document.title=r)},d(i){i&&(l(a),l(t),l(s),l(o))}}}function er(m){var o;let r,a,t=tr(),s=((o=L.og)==null?void 0:o.image)&&rr();return{c(){t&&t.c(),r=k(),s&&s.c(),a=tt()},l(i){t&&t.l(i),r=d(i),s&&s.l(i),a=tt()},m(i,f){t&&t.m(i,f),_(i,r,f),s&&s.m(i,f),_(i,a,f)},p(i,f){var E;t.p(i,f),(E=L.og)!=null&&E.image&&s.p(i,f)},d(i){i&&(l(r),l(a)),t&&t.d(i),s&&s.d(i)}}}function tr(m){let r,a,t,s,o;return{c(){r=O("meta"),a=k(),t=O("meta"),s=k(),o=O("meta"),this.h()},l(i){r=z(i,"META",{name:!0,content:!0}),a=d(i),t=z(i,"META",{property:!0,content:!0}),s=d(i),o=z(i,"META",{name:!0,content:!0}),this.h()},h(){var i,f;M(r,"name","description"),M(r,"content",L.description),M(t,"property","og:description"),M(t,"content",((i=L.og)==null?void 0:i.description)??L.description),M(o,"name","twitter:description"),M(o,"content",((f=L.og)==null?void 0:f.description)??L.description)},m(i,f){_(i,r,f),_(i,a,f),_(i,t,f),_(i,s,f),_(i,o,f)},p:me,d(i){i&&(l(r),l(a),l(t),l(s),l(o))}}}function rr(m){let r,a,t;return{c(){r=O("meta"),a=k(),t=O("meta"),this.h()},l(s){r=z(s,"META",{property:!0,content:!0}),a=d(s),t=z(s,"META",{name:!0,content:!0}),this.h()},h(){var s,o;M(r,"property","og:image"),M(r,"content",Tt((s=L.og)==null?void 0:s.image)),M(t,"name","twitter:image"),M(t,"content",Tt((o=L.og)==null?void 0:o.image))},m(s,o){_(s,r,o),_(s,a,o),_(s,t,o)},p:me,d(s){s&&(l(r),l(a),l(t))}}}function ar(m){let r,a,t,s,o,i,f,E,b,S;return r=new Ge({props:{value:"%",label:"Toutes"}}),t=new Ge({props:{value:"US",label:"US"}}),o=new Ge({props:{value:"Europe",label:"Europe"}}),f=new Ge({props:{value:"Asia",label:"Asie"}}),b=new Ge({props:{value:"Americas",label:"Ameriques"}}),{c(){R(r.$$.fragment),a=k(),R(t.$$.fragment),s=k(),R(o.$$.fragment),i=k(),R(f.$$.fragment),E=k(),R(b.$$.fragment)},l(p){T(r.$$.fragment,p),a=d(p),T(t.$$.fragment,p),s=d(p),T(o.$$.fragment,p),i=d(p),T(f.$$.fragment,p),E=d(p),T(b.$$.fragment,p)},m(p,q){w(r,p,q),_(p,a,q),w(t,p,q),_(p,s,q),w(o,p,q),_(p,i,q),w(f,p,q),_(p,E,q),w(b,p,q),S=!0},p:me,i(p){S||(g(r.$$.fragment,p),g(t.$$.fragment,p),g(o.$$.fragment,p),g(f.$$.fragment,p),g(b.$$.fragment,p),S=!0)},o(p){y(r.$$.fragment,p),y(t.$$.fragment,p),y(o.$$.fragment,p),y(f.$$.fragment,p),y(b.$$.fragment,p),S=!1},d(p){p&&(l(a),l(s),l(i),l(E)),v(r,p),v(t,p),v(o,p),v(f,p),v(b,p)}}}function Et(m){let r,a;return r=new Ne({props:{queryID:"region_summary",queryResult:m[0]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,s){w(r,t,s),a=!0},p(t,s){const o={};s[0]&1&&(o.queryResult=t[0]),r.$set(o)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function Ct(m){let r,a;return r=new Ne({props:{queryID:"by_country",queryResult:m[1]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,s){w(r,t,s),a=!0},p(t,s){const o={};s[0]&2&&(o.queryResult=t[1]),r.$set(o)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function Mt(m){let r,a;return r=new Ne({props:{queryID:"top10_by_country",queryResult:m[2]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,s){w(r,t,s),a=!0},p(t,s){const o={};s[0]&4&&(o.queryResult=t[2]),r.$set(o)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function Ht(m){let r,a;return r=new Ne({props:{queryID:"sector_breakdown",queryResult:m[3]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,s){w(r,t,s),a=!0},p(t,s){const o={};s[0]&8&&(o.queryResult=t[3]),r.$set(o)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function At(m){let r,a;return r=new Ne({props:{queryID:"region_top_stocks",queryResult:m[4]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,s){w(r,t,s),a=!0},p(t,s){const o={};s[0]&16&&(o.queryResult=t[4]),r.$set(o)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function St(m){let r,a;return r=new Ne({props:{queryID:"region_stocks_all",queryResult:m[5]}}),{c(){R(r.$$.fragment)},l(t){T(r.$$.fragment,t)},m(t,s){w(r,t,s),a=!0},p(t,s){const o={};s[0]&32&&(o.queryResult=t[5]),r.$set(o)},i(t){a||(g(r.$$.fragment,t),a=!0)},o(t){y(r.$$.fragment,t),a=!1},d(t){v(r,t)}}}function ir(m){let r;return{c(){r=Fe("Explorez la repartition geographique des plus grandes capitalisations mondiales. Selectionnez une region pour analyser sa composition par pays et par secteur.")},l(a){r=Se(a,"Explorez la repartition geographique des plus grandes capitalisations mondiales. Selectionnez une region pour analyser sa composition par pays et par secteur.")},m(a,t){_(a,r,t)},d(a){a&&l(r)}}}function nr(m){let r,a,t,s,o,i,f,E,b,S,p,q;return r=new D({props:{id:"country",title:"Pays"}}),t=new D({props:{id:"nb_stocks",title:"Nb Actions"}}),o=new D({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),f=new D({props:{id:"avg_pe",title:"P/E Fwd Moy.",fmt:"num1"}}),b=new D({props:{id:"avg_div_yield",title:"Div Yield Moy. (%)",fmt:"num1"}}),p=new D({props:{id:"avg_change",title:"Var Moy. (%)",fmt:"num1"}}),{c(){R(r.$$.fragment),a=k(),R(t.$$.fragment),s=k(),R(o.$$.fragment),i=k(),R(f.$$.fragment),E=k(),R(b.$$.fragment),S=k(),R(p.$$.fragment)},l(c){T(r.$$.fragment,c),a=d(c),T(t.$$.fragment,c),s=d(c),T(o.$$.fragment,c),i=d(c),T(f.$$.fragment,c),E=d(c),T(b.$$.fragment,c),S=d(c),T(p.$$.fragment,c)},m(c,C){w(r,c,C),_(c,a,C),w(t,c,C),_(c,s,C),w(o,c,C),_(c,i,C),w(f,c,C),_(c,E,C),w(b,c,C),_(c,S,C),w(p,c,C),q=!0},p:me,i(c){q||(g(r.$$.fragment,c),g(t.$$.fragment,c),g(o.$$.fragment,c),g(f.$$.fragment,c),g(b.$$.fragment,c),g(p.$$.fragment,c),q=!0)},o(c){y(r.$$.fragment,c),y(t.$$.fragment,c),y(o.$$.fragment,c),y(f.$$.fragment,c),y(b.$$.fragment,c),y(p.$$.fragment,c),q=!1},d(c){c&&(l(a),l(s),l(i),l(E),l(S)),v(r,c),v(t,c),v(o,c),v(f,c),v(b,c),v(p,c)}}}function sr(m){let r,a,t,s,o,i;return r=new D({props:{id:"sector",title:"Secteur"}}),t=new D({props:{id:"nb_stocks",title:"Nb Actions"}}),o=new D({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),{c(){R(r.$$.fragment),a=k(),R(t.$$.fragment),s=k(),R(o.$$.fragment)},l(f){T(r.$$.fragment,f),a=d(f),T(t.$$.fragment,f),s=d(f),T(o.$$.fragment,f)},m(f,E){w(r,f,E),_(f,a,E),w(t,f,E),_(f,s,E),w(o,f,E),i=!0},p:me,i(f){i||(g(r.$$.fragment,f),g(t.$$.fragment,f),g(o.$$.fragment,f),i=!0)},o(f){y(r.$$.fragment,f),y(t.$$.fragment,f),y(o.$$.fragment,f),i=!1},d(f){f&&(l(a),l(s)),v(r,f),v(t,f),v(o,f)}}}function or(m){let r,a,t,s,o,i,f,E,b,S,p,q,c,C,P,Y,F,N;return r=new D({props:{id:"symbol",title:"Ticker"}}),t=new D({props:{id:"name",title:"Nom"}}),o=new D({props:{id:"price",title:"Prix",fmt:"usd"}}),f=new D({props:{id:"change_pct",title:"Var %",fmt:"num1"}}),b=new D({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),p=new D({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),c=new D({props:{id:"dividend_yield",title:"Div %",fmt:"num1"}}),P=new D({props:{id:"sector",title:"Secteur"}}),F=new D({props:{id:"country",title:"Pays"}}),{c(){R(r.$$.fragment),a=k(),R(t.$$.fragment),s=k(),R(o.$$.fragment),i=k(),R(f.$$.fragment),E=k(),R(b.$$.fragment),S=k(),R(p.$$.fragment),q=k(),R(c.$$.fragment),C=k(),R(P.$$.fragment),Y=k(),R(F.$$.fragment)},l(u){T(r.$$.fragment,u),a=d(u),T(t.$$.fragment,u),s=d(u),T(o.$$.fragment,u),i=d(u),T(f.$$.fragment,u),E=d(u),T(b.$$.fragment,u),S=d(u),T(p.$$.fragment,u),q=d(u),T(c.$$.fragment,u),C=d(u),T(P.$$.fragment,u),Y=d(u),T(F.$$.fragment,u)},m(u,A){w(r,u,A),_(u,a,A),w(t,u,A),_(u,s,A),w(o,u,A),_(u,i,A),w(f,u,A),_(u,E,A),w(b,u,A),_(u,S,A),w(p,u,A),_(u,q,A),w(c,u,A),_(u,C,A),w(P,u,A),_(u,Y,A),w(F,u,A),N=!0},p:me,i(u){N||(g(r.$$.fragment,u),g(t.$$.fragment,u),g(o.$$.fragment,u),g(f.$$.fragment,u),g(b.$$.fragment,u),g(p.$$.fragment,u),g(c.$$.fragment,u),g(P.$$.fragment,u),g(F.$$.fragment,u),N=!0)},o(u){y(r.$$.fragment,u),y(t.$$.fragment,u),y(o.$$.fragment,u),y(f.$$.fragment,u),y(b.$$.fragment,u),y(p.$$.fragment,u),y(c.$$.fragment,u),y(P.$$.fragment,u),y(F.$$.fragment,u),N=!1},d(u){u&&(l(a),l(s),l(i),l(E),l(S),l(q),l(C),l(Y)),v(r,u),v(t,u),v(o,u),v(f,u),v(b,u),v(p,u),v(c,u),v(P,u),v(F,u)}}}function lr(m){let r,a,t,s,o,i,f,E,b,S,p,q,c,C,P,Y,F,N,u,A;return r=new D({props:{id:"symbol",title:"Ticker"}}),t=new D({props:{id:"name",title:"Nom"}}),o=new D({props:{id:"price",title:"Prix",fmt:"usd"}}),f=new D({props:{id:"change_pct",title:"Var %",fmt:"num1"}}),b=new D({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),p=new D({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),c=new D({props:{id:"dividend_yield",title:"Div %",fmt:"num1"}}),P=new D({props:{id:"sector",title:"Secteur"}}),F=new D({props:{id:"region",title:"Region"}}),u=new D({props:{id:"country",title:"Pays"}}),{c(){R(r.$$.fragment),a=k(),R(t.$$.fragment),s=k(),R(o.$$.fragment),i=k(),R(f.$$.fragment),E=k(),R(b.$$.fragment),S=k(),R(p.$$.fragment),q=k(),R(c.$$.fragment),C=k(),R(P.$$.fragment),Y=k(),R(F.$$.fragment),N=k(),R(u.$$.fragment)},l($){T(r.$$.fragment,$),a=d($),T(t.$$.fragment,$),s=d($),T(o.$$.fragment,$),i=d($),T(f.$$.fragment,$),E=d($),T(b.$$.fragment,$),S=d($),T(p.$$.fragment,$),q=d($),T(c.$$.fragment,$),C=d($),T(P.$$.fragment,$),Y=d($),T(F.$$.fragment,$),N=d($),T(u.$$.fragment,$)},m($,H){w(r,$,H),_($,a,H),w(t,$,H),_($,s,H),w(o,$,H),_($,i,H),w(f,$,H),_($,E,H),w(b,$,H),_($,S,H),w(p,$,H),_($,q,H),w(c,$,H),_($,C,H),w(P,$,H),_($,Y,H),w(F,$,H),_($,N,H),w(u,$,H),A=!0},p:me,i($){A||(g(r.$$.fragment,$),g(t.$$.fragment,$),g(o.$$.fragment,$),g(f.$$.fragment,$),g(b.$$.fragment,$),g(p.$$.fragment,$),g(c.$$.fragment,$),g(P.$$.fragment,$),g(F.$$.fragment,$),g(u.$$.fragment,$),A=!0)},o($){y(r.$$.fragment,$),y(t.$$.fragment,$),y(o.$$.fragment,$),y(f.$$.fragment,$),y(b.$$.fragment,$),y(p.$$.fragment,$),y(c.$$.fragment,$),y(P.$$.fragment,$),y(F.$$.fragment,$),y(u.$$.fragment,$),A=!1},d($){$&&(l(a),l(s),l(i),l(E),l(S),l(q),l(C),l(Y),l(N)),v(r,$),v(t,$),v(o,$),v(f,$),v(b,$),v(p,$),v(c,$),v(P,$),v(F,$),v(u,$)}}}function mr(m){let r;return{c(){r=Fe("Accueil")},l(a){r=Se(a,"Accueil")},m(a,t){_(a,r,t)},d(a){a&&l(r)}}}function ur(m){let r;return{c(){r=Fe("Explorateur d'Actions")},l(a){r=Se(a,"Explorateur d'Actions")},m(a,t){_(a,r,t)},d(a){a&&l(r)}}}function fr(m){let r;return{c(){r=Fe("Analyse Sectorielle")},l(a){r=Se(a,"Analyse Sectorielle")},m(a,t){_(a,r,t)},d(a){a&&l(r)}}}function _r(m){let r;return{c(){r=Fe("Lab de Valorisation")},l(a){r=Se(a,"Lab de Valorisation")},m(a,t){_(a,r,t)},d(a){a&&l(r)}}}function $r(m){let r;return{c(){r=Fe("Croissance & Rentabilite")},l(a){r=Se(a,"Croissance & Rentabilite")},m(a,t){_(a,r,t)},d(a){a&&l(r)}}}function pr(m){let r,a,t,s,o,i,f,E,b,S,p,q,c,C,P='<a href="#analyse-geographique">Analyse Geographique</a>',Y,F,N,u,A='<a href="#metriques-de-la-selection">Metriques de la Selection</a>',$,H,ce,J,x,h,ge,ee,ye,W,te,Z,De='<a href="#top-10-pays-par-capitalisation">Top 10 Pays par Capitalisation</a>',de,re,ae,X,ke='<a href="#repartition-par-pays">Repartition par Pays</a>',be,ie,ve,K,ue='<a href="#composition-sectorielle">Composition Sectorielle</a>',fe,ne,we,se,I,le,st='<a href="#top-20-capitalisations-de-la-region">Top 20 Capitalisations de la Region</a>',Qe,Te,Ye,_e,ot='<a href="#toutes-les-actions">Toutes les Actions</a>',ze,Re,Oe,Ue,Xe,qe,Ke,Ee,Je,Ce,We,Me,Ze,He,he,$e=typeof L<"u"&&L.title&&L.hide_title!==!0&&Zt();function Ft(e,n){return typeof L<"u"&&L.title?xt:ht}let Ve=Ft()(m),pe=typeof L=="object"&&er();i=new Wt({props:{name:"region_select",title:"Region",defaultValue:"%",$$slots:{default:[ar]},$$scope:{ctx:m}}});let U=m[0]&&Et(m),V=m[1]&&Ct(m),B=m[2]&&Mt(m),j=m[3]&&Ht(m),G=m[4]&&At(m),Q=m[5]&&St(m);return F=new Xt({props:{status:"info",$$slots:{default:[ir]},$$scope:{ctx:m}}}),H=new Be({props:{data:m[0],value:"nb_stocks",title:"Actions"}}),J=new Be({props:{data:m[0],value:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),h=new Be({props:{data:m[0],value:"avg_pe_forward",title:"P/E Forward Moy."}}),ee=new Be({props:{data:m[0],value:"avg_div_yield",title:"Div. Yield Moy. (%)"}}),W=new Be({props:{data:m[0],value:"avg_change",title:"Var. Moy. (%)"}}),re=new qt({props:{data:m[2],x:"country",y:"total_mcap",xAxisTitle:"Pays",yAxisTitle:"Capitalisation Totale ($)",title:"Capitalisation par Pays",fmt:"usd",swapXY:"true",sort:"false"}}),ie=new xe({props:{data:m[1],rows:"15",$$slots:{default:[nr]},$$scope:{ctx:m}}}),ne=new qt({props:{data:m[3],x:"sector",y:"total_mcap",title:"Repartition Sectorielle dans la Region",fmt:"usd",swapXY:"true",sort:"false"}}),se=new xe({props:{data:m[3],rows:"12",$$slots:{default:[sr]},$$scope:{ctx:m}}}),Te=new xe({props:{data:m[4],rows:"20",$$slots:{default:[or]},$$scope:{ctx:m}}}),Re=new xe({props:{data:m[5],search:"true",rows:"20",$$slots:{default:[lr]},$$scope:{ctx:m}}}),qe=new je({props:{url:"/",$$slots:{default:[mr]},$$scope:{ctx:m}}}),Ee=new je({props:{url:"/explorer",$$slots:{default:[ur]},$$scope:{ctx:m}}}),Ce=new je({props:{url:"/sectors",$$slots:{default:[fr]},$$scope:{ctx:m}}}),Me=new je({props:{url:"/valuations",$$slots:{default:[_r]},$$scope:{ctx:m}}}),He=new je({props:{url:"/earnings",$$slots:{default:[$r]},$$scope:{ctx:m}}}),{c(){$e&&$e.c(),r=k(),Ve.c(),a=O("meta"),t=O("meta"),pe&&pe.c(),s=tt(),o=k(),R(i.$$.fragment),f=k(),U&&U.c(),E=k(),V&&V.c(),b=k(),B&&B.c(),S=k(),j&&j.c(),p=k(),G&&G.c(),q=k(),Q&&Q.c(),c=k(),C=O("h1"),C.innerHTML=P,Y=k(),R(F.$$.fragment),N=k(),u=O("h2"),u.innerHTML=A,$=k(),R(H.$$.fragment),ce=k(),R(J.$$.fragment),x=k(),R(h.$$.fragment),ge=k(),R(ee.$$.fragment),ye=k(),R(W.$$.fragment),te=k(),Z=O("h2"),Z.innerHTML=De,de=k(),R(re.$$.fragment),ae=k(),X=O("h2"),X.innerHTML=ke,be=k(),R(ie.$$.fragment),ve=k(),K=O("h2"),K.innerHTML=ue,fe=k(),R(ne.$$.fragment),we=k(),R(se.$$.fragment),I=k(),le=O("h2"),le.innerHTML=st,Qe=k(),R(Te.$$.fragment),Ye=k(),_e=O("h2"),_e.innerHTML=ot,ze=k(),R(Re.$$.fragment),Oe=k(),Ue=O("hr"),Xe=k(),R(qe.$$.fragment),Ke=k(),R(Ee.$$.fragment),Je=k(),R(Ce.$$.fragment),We=k(),R(Me.$$.fragment),Ze=k(),R(He.$$.fragment),this.h()},l(e){$e&&$e.l(e),r=d(e);const n=It("svelte-2igo1p",document.head);Ve.l(n),a=z(n,"META",{name:!0,content:!0}),t=z(n,"META",{name:!0,content:!0}),pe&&pe.l(n),s=tt(),n.forEach(l),o=d(e),T(i.$$.fragment,e),f=d(e),U&&U.l(e),E=d(e),V&&V.l(e),b=d(e),B&&B.l(e),S=d(e),j&&j.l(e),p=d(e),G&&G.l(e),q=d(e),Q&&Q.l(e),c=d(e),C=z(e,"H1",{class:!0,id:!0,"data-svelte-h":!0}),Ae(C)!=="svelte-svrh1s"&&(C.innerHTML=P),Y=d(e),T(F.$$.fragment,e),N=d(e),u=z(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(u)!=="svelte-1kjt56h"&&(u.innerHTML=A),$=d(e),T(H.$$.fragment,e),ce=d(e),T(J.$$.fragment,e),x=d(e),T(h.$$.fragment,e),ge=d(e),T(ee.$$.fragment,e),ye=d(e),T(W.$$.fragment,e),te=d(e),Z=z(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(Z)!=="svelte-1yo0m1b"&&(Z.innerHTML=De),de=d(e),T(re.$$.fragment,e),ae=d(e),X=z(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(X)!=="svelte-h3wtyj"&&(X.innerHTML=ke),be=d(e),T(ie.$$.fragment,e),ve=d(e),K=z(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(K)!=="svelte-1u8hxyp"&&(K.innerHTML=ue),fe=d(e),T(ne.$$.fragment,e),we=d(e),T(se.$$.fragment,e),I=d(e),le=z(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(le)!=="svelte-9o4vin"&&(le.innerHTML=st),Qe=d(e),T(Te.$$.fragment,e),Ye=d(e),_e=z(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ae(_e)!=="svelte-yw5yjp"&&(_e.innerHTML=ot),ze=d(e),T(Re.$$.fragment,e),Oe=d(e),Ue=z(e,"HR",{class:!0}),Xe=d(e),T(qe.$$.fragment,e),Ke=d(e),T(Ee.$$.fragment,e),Je=d(e),T(Ce.$$.fragment,e),We=d(e),T(Me.$$.fragment,e),Ze=d(e),T(He.$$.fragment,e),this.h()},h(){M(a,"name","twitter:card"),M(a,"content","summary_large_image"),M(t,"name","twitter:site"),M(t,"content","@evidence_dev"),M(C,"class","markdown"),M(C,"id","analyse-geographique"),M(u,"class","markdown"),M(u,"id","metriques-de-la-selection"),M(Z,"class","markdown"),M(Z,"id","top-10-pays-par-capitalisation"),M(X,"class","markdown"),M(X,"id","repartition-par-pays"),M(K,"class","markdown"),M(K,"id","composition-sectorielle"),M(le,"class","markdown"),M(le,"id","top-20-capitalisations-de-la-region"),M(_e,"class","markdown"),M(_e,"id","toutes-les-actions"),M(Ue,"class","markdown")},m(e,n){$e&&$e.m(e,n),_(e,r,n),Ve.m(document.head,null),et(document.head,a),et(document.head,t),pe&&pe.m(document.head,null),et(document.head,s),_(e,o,n),w(i,e,n),_(e,f,n),U&&U.m(e,n),_(e,E,n),V&&V.m(e,n),_(e,b,n),B&&B.m(e,n),_(e,S,n),j&&j.m(e,n),_(e,p,n),G&&G.m(e,n),_(e,q,n),Q&&Q.m(e,n),_(e,c,n),_(e,C,n),_(e,Y,n),w(F,e,n),_(e,N,n),_(e,u,n),_(e,$,n),w(H,e,n),_(e,ce,n),w(J,e,n),_(e,x,n),w(h,e,n),_(e,ge,n),w(ee,e,n),_(e,ye,n),w(W,e,n),_(e,te,n),_(e,Z,n),_(e,de,n),w(re,e,n),_(e,ae,n),_(e,X,n),_(e,be,n),w(ie,e,n),_(e,ve,n),_(e,K,n),_(e,fe,n),w(ne,e,n),_(e,we,n),w(se,e,n),_(e,I,n),_(e,le,n),_(e,Qe,n),w(Te,e,n),_(e,Ye,n),_(e,_e,n),_(e,ze,n),w(Re,e,n),_(e,Oe,n),_(e,Ue,n),_(e,Xe,n),w(qe,e,n),_(e,Ke,n),w(Ee,e,n),_(e,Je,n),w(Ce,e,n),_(e,We,n),w(Me,e,n),_(e,Ze,n),w(He,e,n),he=!0},p(e,n){typeof L<"u"&&L.title&&L.hide_title!==!0&&$e.p(e,n),Ve.p(e,n),typeof L=="object"&&pe.p(e,n);const lt={};n[1]&131072&&(lt.$$scope={dirty:n,ctx:e}),i.$set(lt),e[0]?U?(U.p(e,n),n[0]&1&&g(U,1)):(U=Et(e),U.c(),g(U,1),U.m(E.parentNode,E)):U&&(Le(),y(U,1,1,()=>{U=null}),Ie()),e[1]?V?(V.p(e,n),n[0]&2&&g(V,1)):(V=Ct(e),V.c(),g(V,1),V.m(b.parentNode,b)):V&&(Le(),y(V,1,1,()=>{V=null}),Ie()),e[2]?B?(B.p(e,n),n[0]&4&&g(B,1)):(B=Mt(e),B.c(),g(B,1),B.m(S.parentNode,S)):B&&(Le(),y(B,1,1,()=>{B=null}),Ie()),e[3]?j?(j.p(e,n),n[0]&8&&g(j,1)):(j=Ht(e),j.c(),g(j,1),j.m(p.parentNode,p)):j&&(Le(),y(j,1,1,()=>{j=null}),Ie()),e[4]?G?(G.p(e,n),n[0]&16&&g(G,1)):(G=At(e),G.c(),g(G,1),G.m(q.parentNode,q)):G&&(Le(),y(G,1,1,()=>{G=null}),Ie()),e[5]?Q?(Q.p(e,n),n[0]&32&&g(Q,1)):(Q=St(e),Q.c(),g(Q,1),Q.m(c.parentNode,c)):Q&&(Le(),y(Q,1,1,()=>{Q=null}),Ie());const mt={};n[1]&131072&&(mt.$$scope={dirty:n,ctx:e}),F.$set(mt);const ut={};n[0]&1&&(ut.data=e[0]),H.$set(ut);const ft={};n[0]&1&&(ft.data=e[0]),J.$set(ft);const _t={};n[0]&1&&(_t.data=e[0]),h.$set(_t);const $t={};n[0]&1&&($t.data=e[0]),ee.$set($t);const pt={};n[0]&1&&(pt.data=e[0]),W.$set(pt);const ct={};n[0]&4&&(ct.data=e[2]),re.$set(ct);const rt={};n[0]&2&&(rt.data=e[1]),n[1]&131072&&(rt.$$scope={dirty:n,ctx:e}),ie.$set(rt);const gt={};n[0]&8&&(gt.data=e[3]),ne.$set(gt);const at={};n[0]&8&&(at.data=e[3]),n[1]&131072&&(at.$$scope={dirty:n,ctx:e}),se.$set(at);const it={};n[0]&16&&(it.data=e[4]),n[1]&131072&&(it.$$scope={dirty:n,ctx:e}),Te.$set(it);const nt={};n[0]&32&&(nt.data=e[5]),n[1]&131072&&(nt.$$scope={dirty:n,ctx:e}),Re.$set(nt);const yt={};n[1]&131072&&(yt.$$scope={dirty:n,ctx:e}),qe.$set(yt);const dt={};n[1]&131072&&(dt.$$scope={dirty:n,ctx:e}),Ee.$set(dt);const kt={};n[1]&131072&&(kt.$$scope={dirty:n,ctx:e}),Ce.$set(kt);const bt={};n[1]&131072&&(bt.$$scope={dirty:n,ctx:e}),Me.$set(bt);const vt={};n[1]&131072&&(vt.$$scope={dirty:n,ctx:e}),He.$set(vt)},i(e){he||(g(i.$$.fragment,e),g(U),g(V),g(B),g(j),g(G),g(Q),g(F.$$.fragment,e),g(H.$$.fragment,e),g(J.$$.fragment,e),g(h.$$.fragment,e),g(ee.$$.fragment,e),g(W.$$.fragment,e),g(re.$$.fragment,e),g(ie.$$.fragment,e),g(ne.$$.fragment,e),g(se.$$.fragment,e),g(Te.$$.fragment,e),g(Re.$$.fragment,e),g(qe.$$.fragment,e),g(Ee.$$.fragment,e),g(Ce.$$.fragment,e),g(Me.$$.fragment,e),g(He.$$.fragment,e),he=!0)},o(e){y(i.$$.fragment,e),y(U),y(V),y(B),y(j),y(G),y(Q),y(F.$$.fragment,e),y(H.$$.fragment,e),y(J.$$.fragment,e),y(h.$$.fragment,e),y(ee.$$.fragment,e),y(W.$$.fragment,e),y(re.$$.fragment,e),y(ie.$$.fragment,e),y(ne.$$.fragment,e),y(se.$$.fragment,e),y(Te.$$.fragment,e),y(Re.$$.fragment,e),y(qe.$$.fragment,e),y(Ee.$$.fragment,e),y(Ce.$$.fragment,e),y(Me.$$.fragment,e),y(He.$$.fragment,e),he=!1},d(e){e&&(l(r),l(o),l(f),l(E),l(b),l(S),l(p),l(q),l(c),l(C),l(Y),l(N),l(u),l($),l(ce),l(x),l(ge),l(ye),l(te),l(Z),l(de),l(ae),l(X),l(be),l(ve),l(K),l(fe),l(we),l(I),l(le),l(Qe),l(Ye),l(_e),l(ze),l(Oe),l(Ue),l(Xe),l(Ke),l(Je),l(We),l(Ze)),$e&&$e.d(e),Ve.d(e),l(a),l(t),pe&&pe.d(e),l(s),v(i,e),U&&U.d(e),V&&V.d(e),B&&B.d(e),j&&j.d(e),G&&G.d(e),Q&&Q.d(e),v(F,e),v(H,e),v(J,e),v(h,e),v(ee,e),v(W,e),v(re,e),v(ie,e),v(ne,e),v(se,e),v(Te,e),v(Re,e),v(qe,e),v(Ee,e),v(Ce,e),v(Me,e),v(He,e)}}}const L={title:"Analyse Geographique - Radiographie des 150 Plus Grandes Capitalisations Mondiales",description:"Repartition geographique des capitalisations - par region, pays et secteur"};function cr(m,r,a){let t,s;wt(m,Jt,I=>a(33,t=I)),wt(m,Rt,I=>a(38,s=I));let{data:o}=r,{data:i={},customFormattingSettings:f,__db:E,inputs:b}=o;Lt(Rt,s="36a9a17f2f25c40e261578afe03e4b60",s);let S=Gt(Ot(b));Pt(S.subscribe(I=>a(8,b=I))),Nt(zt,{getCustomFormats:()=>f.customFormats||[]});const p=(I,le)=>Kt(E.query,I,{query_name:le});Qt(p),t.params,Ut(()=>!0);let q={initialData:void 0,initialError:void 0},c=oe`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${b.region_select.value}'`,C=`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${b.region_select.value}'`;i.region_summary_data&&(i.region_summary_data instanceof Error?q.initialError=i.region_summary_data:q.initialData=i.region_summary_data,i.region_summary_columns&&(q.knownColumns=i.region_summary_columns));let P,Y=!1;const F=Pe.createReactive({callback:I=>{a(0,P=I)},execFn:p},{id:"region_summary",...q});F(C,{noResolve:c,...q}),globalThis[Symbol.for("region_summary")]={get value(){return P}};let N={initialData:void 0,initialError:void 0},u=oe`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${b.region_select.value}'
group by country
order by total_mcap desc`,A=`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${b.region_select.value}'
group by country
order by total_mcap desc`;i.by_country_data&&(i.by_country_data instanceof Error?N.initialError=i.by_country_data:N.initialData=i.by_country_data,i.by_country_columns&&(N.knownColumns=i.by_country_columns));let $,H=!1;const ce=Pe.createReactive({callback:I=>{a(1,$=I)},execFn:p},{id:"by_country",...N});ce(A,{noResolve:u,...N}),globalThis[Symbol.for("by_country")]={get value(){return $}};let J={initialData:void 0,initialError:void 0},x=oe`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${b.region_select.value}'
group by country
order by total_mcap desc
limit 10`,h=`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${b.region_select.value}'
group by country
order by total_mcap desc
limit 10`;i.top10_by_country_data&&(i.top10_by_country_data instanceof Error?J.initialError=i.top10_by_country_data:J.initialData=i.top10_by_country_data,i.top10_by_country_columns&&(J.knownColumns=i.top10_by_country_columns));let ge,ee=!1;const ye=Pe.createReactive({callback:I=>{a(2,ge=I)},execFn:p},{id:"top10_by_country",...J});ye(h,{noResolve:x,...J}),globalThis[Symbol.for("top10_by_country")]={get value(){return ge}};let W={initialData:void 0,initialError:void 0},te=oe`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${b.region_select.value}'
group by sector
order by total_mcap desc`,Z=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${b.region_select.value}'
group by sector
order by total_mcap desc`;i.sector_breakdown_data&&(i.sector_breakdown_data instanceof Error?W.initialError=i.sector_breakdown_data:W.initialData=i.sector_breakdown_data,i.sector_breakdown_columns&&(W.knownColumns=i.sector_breakdown_columns));let De,de=!1;const re=Pe.createReactive({callback:I=>{a(3,De=I)},execFn:p},{id:"sector_breakdown",...W});re(Z,{noResolve:te,...W}),globalThis[Symbol.for("sector_breakdown")]={get value(){return De}};let ae={initialData:void 0,initialError:void 0},X=oe`select
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
where region like '${b.region_select.value}'
order by market_cap desc
limit 20`,ke=`select
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
where region like '${b.region_select.value}'
order by market_cap desc
limit 20`;i.region_top_stocks_data&&(i.region_top_stocks_data instanceof Error?ae.initialError=i.region_top_stocks_data:ae.initialData=i.region_top_stocks_data,i.region_top_stocks_columns&&(ae.knownColumns=i.region_top_stocks_columns));let be,ie=!1;const ve=Pe.createReactive({callback:I=>{a(4,be=I)},execFn:p},{id:"region_top_stocks",...ae});ve(ke,{noResolve:X,...ae}),globalThis[Symbol.for("region_top_stocks")]={get value(){return be}};let K={initialData:void 0,initialError:void 0},ue=oe`select
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
where region like '${b.region_select.value}'
order by market_cap desc`,fe=`select
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
where region like '${b.region_select.value}'
order by market_cap desc`;i.region_stocks_all_data&&(i.region_stocks_all_data instanceof Error?K.initialError=i.region_stocks_all_data:K.initialData=i.region_stocks_all_data,i.region_stocks_all_columns&&(K.knownColumns=i.region_stocks_all_columns));let ne,we=!1;const se=Pe.createReactive({callback:I=>{a(5,ne=I)},execFn:p},{id:"region_stocks_all",...K});return se(fe,{noResolve:ue,...K}),globalThis[Symbol.for("region_stocks_all")]={get value(){return ne}},m.$$set=I=>{"data"in I&&a(6,o=I.data)},m.$$.update=()=>{m.$$.dirty[0]&64&&a(7,{data:i={},customFormattingSettings:f,__db:E}=o,i),m.$$.dirty[0]&128&&Yt.set(Object.keys(i).length>0),m.$$.dirty[1]&4&&t.params,m.$$.dirty[0]&256&&a(10,c=oe`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${b.region_select.value}'`),m.$$.dirty[0]&256&&a(11,C=`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${b.region_select.value}'`),m.$$.dirty[0]&7680&&(c||!Y?c||(F(C,{noResolve:c,...q}),a(12,Y=!0)):F(C,{noResolve:c})),m.$$.dirty[0]&256&&a(14,u=oe`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${b.region_select.value}'
group by country
order by total_mcap desc`),m.$$.dirty[0]&256&&a(15,A=`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region like '${b.region_select.value}'
group by country
order by total_mcap desc`),m.$$.dirty[0]&122880&&(u||!H?u||(ce(A,{noResolve:u,...N}),a(16,H=!0)):ce(A,{noResolve:u})),m.$$.dirty[0]&256&&a(18,x=oe`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${b.region_select.value}'
group by country
order by total_mcap desc
limit 10`),m.$$.dirty[0]&256&&a(19,h=`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${b.region_select.value}'
group by country
order by total_mcap desc
limit 10`),m.$$.dirty[0]&1966080&&(x||!ee?x||(ye(h,{noResolve:x,...J}),a(20,ee=!0)):ye(h,{noResolve:x})),m.$$.dirty[0]&256&&a(22,te=oe`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${b.region_select.value}'
group by sector
order by total_mcap desc`),m.$$.dirty[0]&256&&a(23,Z=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap
from market.stocks
where region like '${b.region_select.value}'
group by sector
order by total_mcap desc`),m.$$.dirty[0]&31457280&&(te||!de?te||(re(Z,{noResolve:te,...W}),a(24,de=!0)):re(Z,{noResolve:te})),m.$$.dirty[0]&256&&a(26,X=oe`select
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
where region like '${b.region_select.value}'
order by market_cap desc
limit 20`),m.$$.dirty[0]&256&&a(27,ke=`select
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
where region like '${b.region_select.value}'
order by market_cap desc
limit 20`),m.$$.dirty[0]&503316480&&(X||!ie?X||(ve(ke,{noResolve:X,...ae}),a(28,ie=!0)):ve(ke,{noResolve:X})),m.$$.dirty[0]&256&&a(30,ue=oe`select
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
where region like '${b.region_select.value}'
order by market_cap desc`),m.$$.dirty[0]&256&&a(31,fe=`select
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
where region like '${b.region_select.value}'
order by market_cap desc`),m.$$.dirty[0]&1610612736|m.$$.dirty[1]&3&&(ue||!we?ue||(se(fe,{noResolve:ue,...K}),a(32,we=!0)):se(fe,{noResolve:ue}))},[P,$,ge,De,be,ne,o,i,b,q,c,C,Y,N,u,A,H,J,x,h,ee,W,te,Z,de,ae,X,ke,ie,K,ue,fe,we,t]}class Er extends Bt{constructor(r){super(),jt(this,r,cr,pr,Dt,{data:6},null,[-1,-1])}}export{Er as component};
