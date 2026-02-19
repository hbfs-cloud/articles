import{s as Ut,d as u,i as m,a as nt,b as T,c as me,e as v,h as Gt,f as U,g as Ve,j as Se,k as p,l as G,m as Mt,n as Qt,o as jt,p as Kt,q as Wt,v as De,x as Xt,t as Be,u as Ne,w as Yt}from"../chunks/scheduler.DUeqUKQe.js";import{S as xt,i as Jt,d as w,t as c,a as $,c as Ie,m as y,b,e as k,g as Le}from"../chunks/index.CVl63dJC.js";import{D as Zt,e as er,s as tr,Q as Oe,p as rr,c as qt,C as te,a as Et,r as Ht,b as ar}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.bnRE_UwI.js";import{w as nr}from"../chunks/entry.D0Bk6KXv.js";import{A as lr,B as Fe,L as Ge,Q as Pe}from"../chunks/BigValue.0kiTwXtZ.js";import{h as fe,p as ir}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{D as sr,a as Pt}from"../chunks/Dropdown.B0Q0ZFA7.js";import{B as or,a as it}from"../chunks/ButtonGroup.DILzvq_0.js";import{p as _r}from"../chunks/stores.BK-KNejn.js";import{B as Ft}from"../chunks/BarChart.jQu-dQ_N.js";import{S as ur}from"../chunks/ScatterPlot.BxBbfADR.js";function Dt(o,r,a){const t=o.slice();return t[48]=r[a],t}function fr(o){let r,a=A.title+"",t;return{c(){r=G("h1"),t=Ne(a),this.h()},l(_){r=U(_,"H1",{class:!0});var f=Yt(r);t=Be(f,a),f.forEach(u),this.h()},h(){T(r,"class","title")},m(_,f){m(_,r,f),nt(r,t)},p:De,d(_){_&&u(r)}}}function mr(o){return{c(){this.h()},l(r){this.h()},h(){document.title="Evidence"},m:De,p:De,d:De}}function gr(o){let r,a,t,_,f;return document.title=r=A.title,{c(){a=p(),t=G("meta"),_=p(),f=G("meta"),this.h()},l(n){a=v(n),t=U(n,"META",{property:!0,content:!0}),_=v(n),f=U(n,"META",{name:!0,content:!0}),this.h()},h(){var n,g;T(t,"property","og:title"),T(t,"content",((n=A.og)==null?void 0:n.title)??A.title),T(f,"name","twitter:title"),T(f,"content",((g=A.og)==null?void 0:g.title)??A.title)},m(n,g){m(n,a,g),m(n,t,g),m(n,_,g),m(n,f,g)},p(n,g){g&0&&r!==(r=A.title)&&(document.title=r)},d(n){n&&(u(a),u(t),u(_),u(f))}}}function $r(o){var f;let r,a,t=cr(),_=((f=A.og)==null?void 0:f.image)&&vr();return{c(){t&&t.c(),r=p(),_&&_.c(),a=Ve()},l(n){t&&t.l(n),r=v(n),_&&_.l(n),a=Ve()},m(n,g){t&&t.m(n,g),m(n,r,g),_&&_.m(n,g),m(n,a,g)},p(n,g){var d;t.p(n,g),(d=A.og)!=null&&d.image&&_.p(n,g)},d(n){n&&(u(r),u(a)),t&&t.d(n),_&&_.d(n)}}}function cr(o){let r,a,t,_,f;return{c(){r=G("meta"),a=p(),t=G("meta"),_=p(),f=G("meta"),this.h()},l(n){r=U(n,"META",{name:!0,content:!0}),a=v(n),t=U(n,"META",{property:!0,content:!0}),_=v(n),f=U(n,"META",{name:!0,content:!0}),this.h()},h(){var n,g;T(r,"name","description"),T(r,"content",A.description),T(t,"property","og:description"),T(t,"content",((n=A.og)==null?void 0:n.description)??A.description),T(f,"name","twitter:description"),T(f,"content",((g=A.og)==null?void 0:g.description)??A.description)},m(n,g){m(n,r,g),m(n,a,g),m(n,t,g),m(n,_,g),m(n,f,g)},p:De,d(n){n&&(u(r),u(a),u(t),u(_),u(f))}}}function vr(o){let r,a,t;return{c(){r=G("meta"),a=p(),t=G("meta"),this.h()},l(_){r=U(_,"META",{property:!0,content:!0}),a=v(_),t=U(_,"META",{name:!0,content:!0}),this.h()},h(){var _,f;T(r,"property","og:image"),T(r,"content",Et((_=A.og)==null?void 0:_.image)),T(t,"name","twitter:image"),T(t,"content",Et((f=A.og)==null?void 0:f.image))},m(_,f){m(_,r,f),m(_,a,f),m(_,t,f)},p:De,d(_){_&&(u(r),u(a),u(t))}}}function pr(o){let r,a,t,_,f,n;return r=new it({props:{value:"all",label:"Toutes"}}),t=new it({props:{value:"growth",label:"Croissance (CA > 20%)"}}),f=new it({props:{value:"value",label:"Valeur (Div > 2%)"}}),{c(){k(r.$$.fragment),a=p(),k(t.$$.fragment),_=p(),k(f.$$.fragment)},l(g){b(r.$$.fragment,g),a=v(g),b(t.$$.fragment,g),_=v(g),b(f.$$.fragment,g)},m(g,d){y(r,g,d),m(g,a,d),y(t,g,d),m(g,_,d),y(f,g,d),n=!0},p:De,i(g){n||($(r.$$.fragment,g),$(t.$$.fragment,g),$(f.$$.fragment,g),n=!0)},o(g){c(r.$$.fragment,g),c(t.$$.fragment,g),c(f.$$.fragment,g),n=!1},d(g){g&&(u(a),u(_)),w(r,g),w(t,g),w(f,g)}}}function St(o){let r,a;return r=new Pe({props:{queryID:"sector_list_earn",queryResult:o[0]}}),{c(){k(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const f={};_[0]&1&&(f.queryResult=t[0]),r.$set(f)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function It(o){let r,a;return r=new Pt({props:{value:o[48].value,valueLabel:o[48].label}}),{c(){k(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const f={};_[0]&1&&(f.value=t[48].value),_[0]&1&&(f.valueLabel=t[48].label),r.$set(f)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function dr(o){let r,a,t,_;r=new Pt({props:{value:"%",valueLabel:"Tous les secteurs"}});let f=qt(o[0]),n=[];for(let d=0;d<f.length;d+=1)n[d]=It(Dt(o,f,d));const g=d=>c(n[d],1,1,()=>{n[d]=null});return{c(){k(r.$$.fragment),a=p();for(let d=0;d<n.length;d+=1)n[d].c();t=Ve()},l(d){b(r.$$.fragment,d),a=v(d);for(let i=0;i<n.length;i+=1)n[i].l(d);t=Ve()},m(d,i){y(r,d,i),m(d,a,i);for(let C=0;C<n.length;C+=1)n[C]&&n[C].m(d,i);m(d,t,i),_=!0},p(d,i){if(i[0]&1){f=qt(d[0]);let C;for(C=0;C<f.length;C+=1){const M=Dt(d,f,C);n[C]?(n[C].p(M,i),$(n[C],1)):(n[C]=It(M),n[C].c(),$(n[C],1),n[C].m(t.parentNode,t))}for(Le(),C=f.length;C<n.length;C+=1)g(C);Ie()}},i(d){if(!_){$(r.$$.fragment,d);for(let i=0;i<f.length;i+=1)$(n[i]);_=!0}},o(d){c(r.$$.fragment,d),n=n.filter(Boolean);for(let i=0;i<n.length;i+=1)c(n[i]);_=!1},d(d){d&&(u(a),u(t)),w(r,d),Xt(n,d)}}}function Lt(o){let r,a;return r=new Pe({props:{queryID:"earnings_filtered",queryResult:o[1]}}),{c(){k(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const f={};_[0]&2&&(f.queryResult=t[1]),r.$set(f)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function Bt(o){let r,a;return r=new Pe({props:{queryID:"earnings_summary",queryResult:o[2]}}),{c(){k(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const f={};_[0]&4&&(f.queryResult=t[2]),r.$set(f)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function Nt(o){let r,a;return r=new Pe({props:{queryID:"top20_rev_growth",queryResult:o[3]}}),{c(){k(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const f={};_[0]&8&&(f.queryResult=t[3]),r.$set(f)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function Ot(o){let r,a;return r=new Pe({props:{queryID:"scatter_growth",queryResult:o[4]}}),{c(){k(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const f={};_[0]&16&&(f.queryResult=t[4]),r.$set(f)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function Vt(o){let r,a;return r=new Pe({props:{queryID:"top_margins",queryResult:o[5]}}),{c(){k(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const f={};_[0]&32&&(f.queryResult=t[5]),r.$set(f)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function wr(o){let r;return{c(){r=Ne("Analysez les dynamiques de croissance et de rentabilite des plus grandes capitalisations. Filtrez par style (Croissance vs Valeur) et par secteur pour identifier les profils les plus attractifs.")},l(a){r=Be(a,"Analysez les dynamiques de croissance et de rentabilite des plus grandes capitalisations. Filtrez par style (Croissance vs Valeur) et par secteur pour identifier les profils les plus attractifs.")},m(a,t){m(a,r,t)},d(a){a&&u(r)}}}function yr(o){let r,a,t,_,f,n,g,d,i,C,M,H,F,Q,V,J,P,O,q,ee,W,j,X,E,z,Z;return r=new te({props:{id:"symbol",title:"Ticker"}}),t=new te({props:{id:"name",title:"Nom"}}),f=new te({props:{id:"revenue",title:"CA",fmt:"usd"}}),g=new te({props:{id:"revenue_growth",title:"Croiss. CA %",fmt:"num1"}}),i=new te({props:{id:"earnings_growth",title:"Croiss. BPA %",fmt:"num1"}}),M=new te({props:{id:"gross_margin",title:"Marge Brute %",fmt:"num1"}}),F=new te({props:{id:"operating_margin",title:"Marge Op. %",fmt:"num1"}}),V=new te({props:{id:"profit_margin",title:"Marge Nette %",fmt:"num1"}}),P=new te({props:{id:"roe",title:"ROE %",fmt:"num1"}}),q=new te({props:{id:"roa",title:"ROA %",fmt:"num1"}}),W=new te({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),X=new te({props:{id:"sector",title:"Secteur"}}),z=new te({props:{id:"country",title:"Pays"}}),{c(){k(r.$$.fragment),a=p(),k(t.$$.fragment),_=p(),k(f.$$.fragment),n=p(),k(g.$$.fragment),d=p(),k(i.$$.fragment),C=p(),k(M.$$.fragment),H=p(),k(F.$$.fragment),Q=p(),k(V.$$.fragment),J=p(),k(P.$$.fragment),O=p(),k(q.$$.fragment),ee=p(),k(W.$$.fragment),j=p(),k(X.$$.fragment),E=p(),k(z.$$.fragment)},l(s){b(r.$$.fragment,s),a=v(s),b(t.$$.fragment,s),_=v(s),b(f.$$.fragment,s),n=v(s),b(g.$$.fragment,s),d=v(s),b(i.$$.fragment,s),C=v(s),b(M.$$.fragment,s),H=v(s),b(F.$$.fragment,s),Q=v(s),b(V.$$.fragment,s),J=v(s),b(P.$$.fragment,s),O=v(s),b(q.$$.fragment,s),ee=v(s),b(W.$$.fragment,s),j=v(s),b(X.$$.fragment,s),E=v(s),b(z.$$.fragment,s)},m(s,h){y(r,s,h),m(s,a,h),y(t,s,h),m(s,_,h),y(f,s,h),m(s,n,h),y(g,s,h),m(s,d,h),y(i,s,h),m(s,C,h),y(M,s,h),m(s,H,h),y(F,s,h),m(s,Q,h),y(V,s,h),m(s,J,h),y(P,s,h),m(s,O,h),y(q,s,h),m(s,ee,h),y(W,s,h),m(s,j,h),y(X,s,h),m(s,E,h),y(z,s,h),Z=!0},p:De,i(s){Z||($(r.$$.fragment,s),$(t.$$.fragment,s),$(f.$$.fragment,s),$(g.$$.fragment,s),$(i.$$.fragment,s),$(M.$$.fragment,s),$(F.$$.fragment,s),$(V.$$.fragment,s),$(P.$$.fragment,s),$(q.$$.fragment,s),$(W.$$.fragment,s),$(X.$$.fragment,s),$(z.$$.fragment,s),Z=!0)},o(s){c(r.$$.fragment,s),c(t.$$.fragment,s),c(f.$$.fragment,s),c(g.$$.fragment,s),c(i.$$.fragment,s),c(M.$$.fragment,s),c(F.$$.fragment,s),c(V.$$.fragment,s),c(P.$$.fragment,s),c(q.$$.fragment,s),c(W.$$.fragment,s),c(X.$$.fragment,s),c(z.$$.fragment,s),Z=!1},d(s){s&&(u(a),u(_),u(n),u(d),u(C),u(H),u(Q),u(J),u(O),u(ee),u(j),u(E)),w(r,s),w(t,s),w(f,s),w(g,s),w(i,s),w(M,s),w(F,s),w(V,s),w(P,s),w(q,s),w(W,s),w(X,s),w(z,s)}}}function br(o){let r;return{c(){r=Ne("Accueil")},l(a){r=Be(a,"Accueil")},m(a,t){m(a,r,t)},d(a){a&&u(r)}}}function kr(o){let r;return{c(){r=Ne("Explorateur d'Actions")},l(a){r=Be(a,"Explorateur d'Actions")},m(a,t){m(a,r,t)},d(a){a&&u(r)}}}function hr(o){let r;return{c(){r=Ne("Analyse Sectorielle")},l(a){r=Be(a,"Analyse Sectorielle")},m(a,t){m(a,r,t)},d(a){a&&u(r)}}}function Tr(o){let r;return{c(){r=Ne("Analyse Geographique")},l(a){r=Be(a,"Analyse Geographique")},m(a,t){m(a,r,t)},d(a){a&&u(r)}}}function Cr(o){let r;return{c(){r=Ne("Lab de Valorisation")},l(a){r=Be(a,"Lab de Valorisation")},m(a,t){m(a,r,t)},d(a){a&&u(r)}}}function Rr(o){let r,a,t,_,f,n,g="← Retour Market Watch",d,i,C,M,H,F,Q,V,J,P,O,q,ee='<a href="#croissance--rentabilite">Croissance &amp; Rentabilite</a>',W,j,X,E,z='<a href="#metriques-agregees">Metriques Agregees</a>',Z,s,h,re,ae,Y,ge,ne,we,le,ie,x,$e,se,ye,oe,_e,K,be='<a href="#top-20-croissance-du-chiffre-daffaires">Top 20 Croissance du Chiffre d&#39;Affaires</a>',ke,ue,he,R,Qe='<a href="#croissance-ca-vs-croissance-benefices">Croissance CA vs Croissance Benefices</a>',je,Te,Ke,ce,st='<a href="#top-20-marge-nette">Top 20 Marge Nette</a>',We,Ce,Xe,ve,ot='<a href="#tableau-detaille-croissance--rentabilite">Tableau Detaille Croissance &amp; Rentabilite</a>',Ye,Re,xe,ze,Je,Ae,Ze,Me,et,qe,tt,Ee,rt,He,at,pe=typeof A<"u"&&A.title&&A.hide_title!==!0&&fr();function zt(e,l){return typeof A<"u"&&A.title?gr:mr}let Ue=zt()(o),de=typeof A=="object"&&$r();i=new or({props:{name:"style_filter",title:"Style d'investissement",defaultValue:"all",$$slots:{default:[pr]},$$scope:{ctx:o}}});let D=o[0]&&St(o);H=new sr({props:{name:"earn_sector",title:"Secteur",defaultValue:"%",$$slots:{default:[dr]},$$scope:{ctx:o}}});let S=o[1]&&Lt(o),I=o[2]&&Bt(o),L=o[3]&&Nt(o),B=o[4]&&Ot(o),N=o[5]&&Vt(o);return j=new lr({props:{status:"info",$$slots:{default:[wr]},$$scope:{ctx:o}}}),s=new Fe({props:{data:o[2],value:"nb_stocks",title:"Actions"}}),re=new Fe({props:{data:o[2],value:"avg_rev_growth",title:"Croiss. CA Moy. (%)"}}),Y=new Fe({props:{data:o[2],value:"avg_earn_growth",title:"Croiss. BPA Moy. (%)"}}),ne=new Fe({props:{data:o[2],value:"avg_gross_margin",title:"Marge Brute Moy. (%)"}}),le=new Fe({props:{data:o[2],value:"avg_op_margin",title:"Marge Op. Moy. (%)"}}),x=new Fe({props:{data:o[2],value:"avg_profit_margin",title:"Marge Nette Moy. (%)"}}),se=new Fe({props:{data:o[2],value:"avg_roe",title:"ROE Moy. (%)"}}),oe=new Fe({props:{data:o[2],value:"avg_roa",title:"ROA Moy. (%)"}}),ue=new Ft({props:{data:o[3],x:"symbol",y:"revenue_growth",xAxisTitle:"Ticker",yAxisTitle:"Croissance CA (%)",title:"Top 20 - Croissance du Chiffre d'Affaires",sort:"false"}}),Te=new ur({props:{data:o[4],x:"revenue_growth",y:"earnings_growth",size:"market_cap",series:"sector",xAxisTitle:"Croissance CA (%)",yAxisTitle:"Croissance Benefices (%)",title:"Croissance Revenue vs Earnings",tooltipTitle:"symbol"}}),Ce=new Ft({props:{data:o[5],x:"symbol",y:"profit_margin",xAxisTitle:"Ticker",yAxisTitle:"Marge Nette (%)",title:"Top 20 - Marge Nette la Plus Elevee",sort:"false"}}),Re=new Zt({props:{data:o[1],search:"true",rows:"20",$$slots:{default:[yr]},$$scope:{ctx:o}}}),Ae=new Ge({props:{url:"/",$$slots:{default:[br]},$$scope:{ctx:o}}}),Me=new Ge({props:{url:"/explorer",$$slots:{default:[kr]},$$scope:{ctx:o}}}),qe=new Ge({props:{url:"/sectors",$$slots:{default:[hr]},$$scope:{ctx:o}}}),Ee=new Ge({props:{url:"/regions",$$slots:{default:[Tr]},$$scope:{ctx:o}}}),He=new Ge({props:{url:"/valuations",$$slots:{default:[Cr]},$$scope:{ctx:o}}}),{c(){pe&&pe.c(),r=p(),Ue.c(),a=G("meta"),t=G("meta"),de&&de.c(),_=Ve(),f=p(),n=G("a"),n.textContent=g,d=p(),k(i.$$.fragment),C=p(),D&&D.c(),M=p(),k(H.$$.fragment),F=p(),S&&S.c(),Q=p(),I&&I.c(),V=p(),L&&L.c(),J=p(),B&&B.c(),P=p(),N&&N.c(),O=p(),q=G("h1"),q.innerHTML=ee,W=p(),k(j.$$.fragment),X=p(),E=G("h2"),E.innerHTML=z,Z=p(),k(s.$$.fragment),h=p(),k(re.$$.fragment),ae=p(),k(Y.$$.fragment),ge=p(),k(ne.$$.fragment),we=p(),k(le.$$.fragment),ie=p(),k(x.$$.fragment),$e=p(),k(se.$$.fragment),ye=p(),k(oe.$$.fragment),_e=p(),K=G("h2"),K.innerHTML=be,ke=p(),k(ue.$$.fragment),he=p(),R=G("h2"),R.innerHTML=Qe,je=p(),k(Te.$$.fragment),Ke=p(),ce=G("h2"),ce.innerHTML=st,We=p(),k(Ce.$$.fragment),Xe=p(),ve=G("h2"),ve.innerHTML=ot,Ye=p(),k(Re.$$.fragment),xe=p(),ze=G("hr"),Je=p(),k(Ae.$$.fragment),Ze=p(),k(Me.$$.fragment),et=p(),k(qe.$$.fragment),tt=p(),k(Ee.$$.fragment),rt=p(),k(He.$$.fragment),this.h()},l(e){pe&&pe.l(e),r=v(e);const l=Gt("svelte-2igo1p",document.head);Ue.l(l),a=U(l,"META",{name:!0,content:!0}),t=U(l,"META",{name:!0,content:!0}),de&&de.l(l),_=Ve(),l.forEach(u),f=v(e),n=U(e,"A",{href:!0,style:!0,"data-svelte-h":!0}),Se(n)!=="svelte-80akn7"&&(n.textContent=g),d=v(e),b(i.$$.fragment,e),C=v(e),D&&D.l(e),M=v(e),b(H.$$.fragment,e),F=v(e),S&&S.l(e),Q=v(e),I&&I.l(e),V=v(e),L&&L.l(e),J=v(e),B&&B.l(e),P=v(e),N&&N.l(e),O=v(e),q=U(e,"H1",{class:!0,id:!0,"data-svelte-h":!0}),Se(q)!=="svelte-19cmzkt"&&(q.innerHTML=ee),W=v(e),b(j.$$.fragment,e),X=v(e),E=U(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Se(E)!=="svelte-b57xge"&&(E.innerHTML=z),Z=v(e),b(s.$$.fragment,e),h=v(e),b(re.$$.fragment,e),ae=v(e),b(Y.$$.fragment,e),ge=v(e),b(ne.$$.fragment,e),we=v(e),b(le.$$.fragment,e),ie=v(e),b(x.$$.fragment,e),$e=v(e),b(se.$$.fragment,e),ye=v(e),b(oe.$$.fragment,e),_e=v(e),K=U(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Se(K)!=="svelte-7vy10r"&&(K.innerHTML=be),ke=v(e),b(ue.$$.fragment,e),he=v(e),R=U(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Se(R)!=="svelte-ol9zr"&&(R.innerHTML=Qe),je=v(e),b(Te.$$.fragment,e),Ke=v(e),ce=U(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Se(ce)!=="svelte-yq46gd"&&(ce.innerHTML=st),We=v(e),b(Ce.$$.fragment,e),Xe=v(e),ve=U(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Se(ve)!=="svelte-1gd8faj"&&(ve.innerHTML=ot),Ye=v(e),b(Re.$$.fragment,e),xe=v(e),ze=U(e,"HR",{class:!0}),Je=v(e),b(Ae.$$.fragment,e),Ze=v(e),b(Me.$$.fragment,e),et=v(e),b(qe.$$.fragment,e),tt=v(e),b(Ee.$$.fragment,e),rt=v(e),b(He.$$.fragment,e),this.h()},h(){T(a,"name","twitter:card"),T(a,"content","summary_large_image"),T(t,"name","twitter:site"),T(t,"content","@evidence_dev"),T(n,"href","/lab/"),me(n,"display","inline-flex"),me(n,"align-items","center"),me(n,"gap","6px"),me(n,"padding","6px 14px"),me(n,"background","#f1f5f9"),me(n,"border","1px solid #e2e8f0"),me(n,"border-radius","8px"),me(n,"color","#475569"),me(n,"text-decoration","none"),me(n,"font-size","0.85rem"),me(n,"margin-bottom","1rem"),T(q,"class","markdown"),T(q,"id","croissance--rentabilite"),T(E,"class","markdown"),T(E,"id","metriques-agregees"),T(K,"class","markdown"),T(K,"id","top-20-croissance-du-chiffre-daffaires"),T(R,"class","markdown"),T(R,"id","croissance-ca-vs-croissance-benefices"),T(ce,"class","markdown"),T(ce,"id","top-20-marge-nette"),T(ve,"class","markdown"),T(ve,"id","tableau-detaille-croissance--rentabilite"),T(ze,"class","markdown")},m(e,l){pe&&pe.m(e,l),m(e,r,l),Ue.m(document.head,null),nt(document.head,a),nt(document.head,t),de&&de.m(document.head,null),nt(document.head,_),m(e,f,l),m(e,n,l),m(e,d,l),y(i,e,l),m(e,C,l),D&&D.m(e,l),m(e,M,l),y(H,e,l),m(e,F,l),S&&S.m(e,l),m(e,Q,l),I&&I.m(e,l),m(e,V,l),L&&L.m(e,l),m(e,J,l),B&&B.m(e,l),m(e,P,l),N&&N.m(e,l),m(e,O,l),m(e,q,l),m(e,W,l),y(j,e,l),m(e,X,l),m(e,E,l),m(e,Z,l),y(s,e,l),m(e,h,l),y(re,e,l),m(e,ae,l),y(Y,e,l),m(e,ge,l),y(ne,e,l),m(e,we,l),y(le,e,l),m(e,ie,l),y(x,e,l),m(e,$e,l),y(se,e,l),m(e,ye,l),y(oe,e,l),m(e,_e,l),m(e,K,l),m(e,ke,l),y(ue,e,l),m(e,he,l),m(e,R,l),m(e,je,l),y(Te,e,l),m(e,Ke,l),m(e,ce,l),m(e,We,l),y(Ce,e,l),m(e,Xe,l),m(e,ve,l),m(e,Ye,l),y(Re,e,l),m(e,xe,l),m(e,ze,l),m(e,Je,l),y(Ae,e,l),m(e,Ze,l),y(Me,e,l),m(e,et,l),y(qe,e,l),m(e,tt,l),y(Ee,e,l),m(e,rt,l),y(He,e,l),at=!0},p(e,l){typeof A<"u"&&A.title&&A.hide_title!==!0&&pe.p(e,l),Ue.p(e,l),typeof A=="object"&&de.p(e,l);const _t={};l[1]&1048576&&(_t.$$scope={dirty:l,ctx:e}),i.$set(_t),e[0]?D?(D.p(e,l),l[0]&1&&$(D,1)):(D=St(e),D.c(),$(D,1),D.m(M.parentNode,M)):D&&(Le(),c(D,1,1,()=>{D=null}),Ie());const ut={};l[0]&1|l[1]&1048576&&(ut.$$scope={dirty:l,ctx:e}),H.$set(ut),e[1]?S?(S.p(e,l),l[0]&2&&$(S,1)):(S=Lt(e),S.c(),$(S,1),S.m(Q.parentNode,Q)):S&&(Le(),c(S,1,1,()=>{S=null}),Ie()),e[2]?I?(I.p(e,l),l[0]&4&&$(I,1)):(I=Bt(e),I.c(),$(I,1),I.m(V.parentNode,V)):I&&(Le(),c(I,1,1,()=>{I=null}),Ie()),e[3]?L?(L.p(e,l),l[0]&8&&$(L,1)):(L=Nt(e),L.c(),$(L,1),L.m(J.parentNode,J)):L&&(Le(),c(L,1,1,()=>{L=null}),Ie()),e[4]?B?(B.p(e,l),l[0]&16&&$(B,1)):(B=Ot(e),B.c(),$(B,1),B.m(P.parentNode,P)):B&&(Le(),c(B,1,1,()=>{B=null}),Ie()),e[5]?N?(N.p(e,l),l[0]&32&&$(N,1)):(N=Vt(e),N.c(),$(N,1),N.m(O.parentNode,O)):N&&(Le(),c(N,1,1,()=>{N=null}),Ie());const ft={};l[1]&1048576&&(ft.$$scope={dirty:l,ctx:e}),j.$set(ft);const mt={};l[0]&4&&(mt.data=e[2]),s.$set(mt);const gt={};l[0]&4&&(gt.data=e[2]),re.$set(gt);const $t={};l[0]&4&&($t.data=e[2]),Y.$set($t);const ct={};l[0]&4&&(ct.data=e[2]),ne.$set(ct);const vt={};l[0]&4&&(vt.data=e[2]),le.$set(vt);const pt={};l[0]&4&&(pt.data=e[2]),x.$set(pt);const dt={};l[0]&4&&(dt.data=e[2]),se.$set(dt);const wt={};l[0]&4&&(wt.data=e[2]),oe.$set(wt);const yt={};l[0]&8&&(yt.data=e[3]),ue.$set(yt);const bt={};l[0]&16&&(bt.data=e[4]),Te.$set(bt);const kt={};l[0]&32&&(kt.data=e[5]),Ce.$set(kt);const lt={};l[0]&2&&(lt.data=e[1]),l[1]&1048576&&(lt.$$scope={dirty:l,ctx:e}),Re.$set(lt);const ht={};l[1]&1048576&&(ht.$$scope={dirty:l,ctx:e}),Ae.$set(ht);const Tt={};l[1]&1048576&&(Tt.$$scope={dirty:l,ctx:e}),Me.$set(Tt);const Ct={};l[1]&1048576&&(Ct.$$scope={dirty:l,ctx:e}),qe.$set(Ct);const Rt={};l[1]&1048576&&(Rt.$$scope={dirty:l,ctx:e}),Ee.$set(Rt);const At={};l[1]&1048576&&(At.$$scope={dirty:l,ctx:e}),He.$set(At)},i(e){at||($(i.$$.fragment,e),$(D),$(H.$$.fragment,e),$(S),$(I),$(L),$(B),$(N),$(j.$$.fragment,e),$(s.$$.fragment,e),$(re.$$.fragment,e),$(Y.$$.fragment,e),$(ne.$$.fragment,e),$(le.$$.fragment,e),$(x.$$.fragment,e),$(se.$$.fragment,e),$(oe.$$.fragment,e),$(ue.$$.fragment,e),$(Te.$$.fragment,e),$(Ce.$$.fragment,e),$(Re.$$.fragment,e),$(Ae.$$.fragment,e),$(Me.$$.fragment,e),$(qe.$$.fragment,e),$(Ee.$$.fragment,e),$(He.$$.fragment,e),at=!0)},o(e){c(i.$$.fragment,e),c(D),c(H.$$.fragment,e),c(S),c(I),c(L),c(B),c(N),c(j.$$.fragment,e),c(s.$$.fragment,e),c(re.$$.fragment,e),c(Y.$$.fragment,e),c(ne.$$.fragment,e),c(le.$$.fragment,e),c(x.$$.fragment,e),c(se.$$.fragment,e),c(oe.$$.fragment,e),c(ue.$$.fragment,e),c(Te.$$.fragment,e),c(Ce.$$.fragment,e),c(Re.$$.fragment,e),c(Ae.$$.fragment,e),c(Me.$$.fragment,e),c(qe.$$.fragment,e),c(Ee.$$.fragment,e),c(He.$$.fragment,e),at=!1},d(e){e&&(u(r),u(f),u(n),u(d),u(C),u(M),u(F),u(Q),u(V),u(J),u(P),u(O),u(q),u(W),u(X),u(E),u(Z),u(h),u(ae),u(ge),u(we),u(ie),u($e),u(ye),u(_e),u(K),u(ke),u(he),u(R),u(je),u(Ke),u(ce),u(We),u(Xe),u(ve),u(Ye),u(xe),u(ze),u(Je),u(Ze),u(et),u(tt),u(rt)),pe&&pe.d(e),Ue.d(e),u(a),u(t),de&&de.d(e),u(_),w(i,e),D&&D.d(e),w(H,e),S&&S.d(e),I&&I.d(e),L&&L.d(e),B&&B.d(e),N&&N.d(e),w(j,e),w(s,e),w(re,e),w(Y,e),w(ne,e),w(le,e),w(x,e),w(se,e),w(oe,e),w(ue,e),w(Te,e),w(Ce,e),w(Re,e),w(Ae,e),w(Me,e),w(qe,e),w(Ee,e),w(He,e)}}}const A={title:"Croissance & Rentabilite - Radiographie des 150 Plus Grandes Capitalisations Mondiales",description:"Analyse de la croissance du chiffre d'affaires, des benefices et des marges de rentabilite"};function Ar(o,r,a){let t,_;Mt(o,_r,R=>a(33,t=R)),Mt(o,Ht,R=>a(38,_=R));let{data:f}=r,{data:n={},customFormattingSettings:g,__db:d,inputs:i}=f;Qt(Ht,_="aa064b247a24e2a5db5c84aa84e53112",_);let C=er(nr(i));jt(C.subscribe(R=>a(8,i=R))),Kt(ar,{getCustomFormats:()=>g.customFormats||[]});const M=(R,Qe)=>ir(d.query,R,{query_name:Qe});tr(M),t.params,Wt(()=>!0);let H={initialData:void 0,initialError:void 0},F=fe`select distinct sector as value, sector as label
from market.stocks
order by sector`,Q=`select distinct sector as value, sector as label
from market.stocks
order by sector`;n.sector_list_earn_data&&(n.sector_list_earn_data instanceof Error?H.initialError=n.sector_list_earn_data:H.initialData=n.sector_list_earn_data,n.sector_list_earn_columns&&(H.knownColumns=n.sector_list_earn_columns));let V,J=!1;const P=Oe.createReactive({callback:R=>{a(0,V=R)},execFn:M},{id:"sector_list_earn",...H});P(Q,{noResolve:F,...H}),globalThis[Symbol.for("sector_list_earn")]={get value(){return V}};let O={initialData:void 0,initialError:void 0},q=fe`select
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
    country
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
order by revenue_growth desc nulls last`,ee=`select
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
    country
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
order by revenue_growth desc nulls last`;n.earnings_filtered_data&&(n.earnings_filtered_data instanceof Error?O.initialError=n.earnings_filtered_data:O.initialData=n.earnings_filtered_data,n.earnings_filtered_columns&&(O.knownColumns=n.earnings_filtered_columns));let W,j=!1;const X=Oe.createReactive({callback:R=>{a(1,W=R)},execFn:M},{id:"earnings_filtered",...O});X(ee,{noResolve:q,...O}),globalThis[Symbol.for("earnings_filtered")]={get value(){return W}};let E={initialData:void 0,initialError:void 0},z=fe`select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )`,Z=`select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )`;n.earnings_summary_data&&(n.earnings_summary_data instanceof Error?E.initialError=n.earnings_summary_data:E.initialData=n.earnings_summary_data,n.earnings_summary_columns&&(E.knownColumns=n.earnings_summary_columns));let s,h=!1;const re=Oe.createReactive({callback:R=>{a(2,s=R)},execFn:M},{id:"earnings_summary",...E});re(Z,{noResolve:z,...E}),globalThis[Symbol.for("earnings_summary")]={get value(){return s}};let ae={initialData:void 0,initialError:void 0},Y=fe`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20`,ge=`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20`;n.top20_rev_growth_data&&(n.top20_rev_growth_data instanceof Error?ae.initialError=n.top20_rev_growth_data:ae.initialData=n.top20_rev_growth_data,n.top20_rev_growth_columns&&(ae.knownColumns=n.top20_rev_growth_columns));let ne,we=!1;const le=Oe.createReactive({callback:R=>{a(3,ne=R)},execFn:M},{id:"top20_rev_growth",...ae});le(ge,{noResolve:Y,...ae}),globalThis[Symbol.for("top20_rev_growth")]={get value(){return ne}};let ie={initialData:void 0,initialError:void 0},x=fe`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and revenue_growth is not null
  and earnings_growth is not null`,$e=`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and revenue_growth is not null
  and earnings_growth is not null`;n.scatter_growth_data&&(n.scatter_growth_data instanceof Error?ie.initialError=n.scatter_growth_data:ie.initialData=n.scatter_growth_data,n.scatter_growth_columns&&(ie.knownColumns=n.scatter_growth_columns));let se,ye=!1;const oe=Oe.createReactive({callback:R=>{a(4,se=R)},execFn:M},{id:"scatter_growth",...ie});oe($e,{noResolve:x,...ie}),globalThis[Symbol.for("scatter_growth")]={get value(){return se}};let _e={initialData:void 0,initialError:void 0},K=fe`select
    symbol,
    name,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and profit_margin is not null
order by profit_margin desc
limit 20`,be=`select
    symbol,
    name,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and profit_margin is not null
order by profit_margin desc
limit 20`;n.top_margins_data&&(n.top_margins_data instanceof Error?_e.initialError=n.top_margins_data:_e.initialData=n.top_margins_data,n.top_margins_columns&&(_e.knownColumns=n.top_margins_columns));let ke,ue=!1;const he=Oe.createReactive({callback:R=>{a(5,ke=R)},execFn:M},{id:"top_margins",..._e});return he(be,{noResolve:K,..._e}),globalThis[Symbol.for("top_margins")]={get value(){return ke}},o.$$set=R=>{"data"in R&&a(6,f=R.data)},o.$$.update=()=>{o.$$.dirty[0]&64&&a(7,{data:n={},customFormattingSettings:g,__db:d}=f,n),o.$$.dirty[0]&128&&rr.set(Object.keys(n).length>0),o.$$.dirty[1]&4&&t.params,o.$$.dirty[0]&7680&&(F||!J?F||(P(Q,{noResolve:F,...H}),a(12,J=!0)):P(Q,{noResolve:F})),o.$$.dirty[0]&256&&a(14,q=fe`select
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
    country
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
order by revenue_growth desc nulls last`),o.$$.dirty[0]&256&&a(15,ee=`select
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
    country
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
order by revenue_growth desc nulls last`),o.$$.dirty[0]&122880&&(q||!j?q||(X(ee,{noResolve:q,...O}),a(16,j=!0)):X(ee,{noResolve:q})),o.$$.dirty[0]&256&&a(18,z=fe`select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )`),o.$$.dirty[0]&256&&a(19,Z=`select
    count(*) as nb_stocks,
    round(avg(revenue_growth), 1) as avg_rev_growth,
    round(avg(earnings_growth), 1) as avg_earn_growth,
    round(avg(gross_margin), 1) as avg_gross_margin,
    round(avg(operating_margin), 1) as avg_op_margin,
    round(avg(profit_margin), 1) as avg_profit_margin,
    round(avg(roe), 1) as avg_roe,
    round(avg(roa), 1) as avg_roa
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )`),o.$$.dirty[0]&1966080&&(z||!h?z||(re(Z,{noResolve:z,...E}),a(20,h=!0)):re(Z,{noResolve:z})),o.$$.dirty[0]&256&&a(22,Y=fe`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20`),o.$$.dirty[0]&256&&a(23,ge=`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and revenue_growth is not null
order by revenue_growth desc
limit 20`),o.$$.dirty[0]&31457280&&(Y||!we?Y||(le(ge,{noResolve:Y,...ae}),a(24,we=!0)):le(ge,{noResolve:Y})),o.$$.dirty[0]&256&&a(26,x=fe`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and revenue_growth is not null
  and earnings_growth is not null`),o.$$.dirty[0]&256&&a(27,$e=`select
    symbol,
    name,
    revenue_growth,
    earnings_growth,
    market_cap,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and revenue_growth is not null
  and earnings_growth is not null`),o.$$.dirty[0]&503316480&&(x||!ye?x||(oe($e,{noResolve:x,...ie}),a(28,ye=!0)):oe($e,{noResolve:x})),o.$$.dirty[0]&256&&a(30,K=fe`select
    symbol,
    name,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and profit_margin is not null
order by profit_margin desc
limit 20`),o.$$.dirty[0]&256&&a(31,be=`select
    symbol,
    name,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    sector
from market.stocks
where sector like '${i.earn_sector.value}'
  and (
    '${i.style_filter.value}' = 'all'
    or ('${i.style_filter.value}' = 'growth' and revenue_growth > 20)
    or ('${i.style_filter.value}' = 'value' and dividend_yield > 2)
  )
  and profit_margin is not null
order by profit_margin desc
limit 20`),o.$$.dirty[0]&1610612736|o.$$.dirty[1]&3&&(K||!ue?K||(he(be,{noResolve:K,..._e}),a(32,ue=!0)):he(be,{noResolve:K}))},a(10,F=fe`select distinct sector as value, sector as label
from market.stocks
order by sector`),a(11,Q=`select distinct sector as value, sector as label
from market.stocks
order by sector`),[V,W,s,ne,se,ke,f,n,i,H,F,Q,J,O,q,ee,j,E,z,Z,h,ae,Y,ge,we,ie,x,$e,ye,_e,K,be,ue,t]}class Vr extends xt{constructor(r){super(),Jt(this,r,Ar,Rr,Ut,{data:6},null,[-1,-1])}}export{Vr as component};
