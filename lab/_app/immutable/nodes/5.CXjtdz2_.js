import{s as Ot,d as f,i as m,a as et,b as C,c as p,h as Vt,e as j,f as Oe,g as Be,j as d,k as K,l as Tt,m as Pt,o as Ut,n as zt,p as Gt,u as qe,w as Qt,r as Fe,t as De,v as jt}from"../chunks/scheduler.C1IyP_xX.js";import{S as Kt,i as Xt,d as w,t as c,a as $,c as Ee,m as y,b,e as h,g as He}from"../chunks/index.BelnLFQw.js";import{D as Yt,e as Jt,s as Wt,Q as Ne,p as Zt,c as Ct,C as ne,a as Rt,r as At,b as xt}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.D5dJpiGm.js";import{w as er}from"../chunks/entry.CvT_HqKe.js";import{A as tr,B as Me,L as ze,Q as Ve}from"../chunks/BigValue.DtjsgKUt.js";import{h as _e,p as rr}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{D as ar,a as Bt}from"../chunks/Dropdown.DsH0HoBc.js";import{B as nr,a as rt}from"../chunks/ButtonGroup.Cj25vz9s.js";import{p as lr}from"../chunks/stores.DwqSwx_r.js";import{B as Mt}from"../chunks/BarChart.BRjntLn8.js";import{S as ir}from"../chunks/ScatterPlot.roexMIYd.js";function qt(o,r,a){const t=o.slice();return t[48]=r[a],t}function sr(o){let r,a=A.title+"",t;return{c(){r=K("h1"),t=De(a),this.h()},l(_){r=j(_,"H1",{class:!0});var u=jt(r);t=Fe(u,a),u.forEach(f),this.h()},h(){C(r,"class","title")},m(_,u){m(_,r,u),et(r,t)},p:qe,d(_){_&&f(r)}}}function or(o){return{c(){this.h()},l(r){this.h()},h(){document.title="Evidence"},m:qe,p:qe,d:qe}}function _r(o){let r,a,t,_,u;return document.title=r=A.title,{c(){a=d(),t=K("meta"),_=d(),u=K("meta"),this.h()},l(n){a=p(n),t=j(n,"META",{property:!0,content:!0}),_=p(n),u=j(n,"META",{name:!0,content:!0}),this.h()},h(){var n,g;C(t,"property","og:title"),C(t,"content",((n=A.og)==null?void 0:n.title)??A.title),C(u,"name","twitter:title"),C(u,"content",((g=A.og)==null?void 0:g.title)??A.title)},m(n,g){m(n,a,g),m(n,t,g),m(n,_,g),m(n,u,g)},p(n,g){g&0&&r!==(r=A.title)&&(document.title=r)},d(n){n&&(f(a),f(t),f(_),f(u))}}}function ur(o){var u;let r,a,t=fr(),_=((u=A.og)==null?void 0:u.image)&&mr();return{c(){t&&t.c(),r=d(),_&&_.c(),a=Oe()},l(n){t&&t.l(n),r=p(n),_&&_.l(n),a=Oe()},m(n,g){t&&t.m(n,g),m(n,r,g),_&&_.m(n,g),m(n,a,g)},p(n,g){var v;t.p(n,g),(v=A.og)!=null&&v.image&&_.p(n,g)},d(n){n&&(f(r),f(a)),t&&t.d(n),_&&_.d(n)}}}function fr(o){let r,a,t,_,u;return{c(){r=K("meta"),a=d(),t=K("meta"),_=d(),u=K("meta"),this.h()},l(n){r=j(n,"META",{name:!0,content:!0}),a=p(n),t=j(n,"META",{property:!0,content:!0}),_=p(n),u=j(n,"META",{name:!0,content:!0}),this.h()},h(){var n,g;C(r,"name","description"),C(r,"content",A.description),C(t,"property","og:description"),C(t,"content",((n=A.og)==null?void 0:n.description)??A.description),C(u,"name","twitter:description"),C(u,"content",((g=A.og)==null?void 0:g.description)??A.description)},m(n,g){m(n,r,g),m(n,a,g),m(n,t,g),m(n,_,g),m(n,u,g)},p:qe,d(n){n&&(f(r),f(a),f(t),f(_),f(u))}}}function mr(o){let r,a,t;return{c(){r=K("meta"),a=d(),t=K("meta"),this.h()},l(_){r=j(_,"META",{property:!0,content:!0}),a=p(_),t=j(_,"META",{name:!0,content:!0}),this.h()},h(){var _,u;C(r,"property","og:image"),C(r,"content",Rt((_=A.og)==null?void 0:_.image)),C(t,"name","twitter:image"),C(t,"content",Rt((u=A.og)==null?void 0:u.image))},m(_,u){m(_,r,u),m(_,a,u),m(_,t,u)},p:qe,d(_){_&&(f(r),f(a),f(t))}}}function gr(o){let r,a,t,_,u,n;return r=new rt({props:{value:"all",label:"Toutes"}}),t=new rt({props:{value:"growth",label:"Croissance (CA > 20%)"}}),u=new rt({props:{value:"value",label:"Valeur (Div > 2%)"}}),{c(){h(r.$$.fragment),a=d(),h(t.$$.fragment),_=d(),h(u.$$.fragment)},l(g){b(r.$$.fragment,g),a=p(g),b(t.$$.fragment,g),_=p(g),b(u.$$.fragment,g)},m(g,v){y(r,g,v),m(g,a,v),y(t,g,v),m(g,_,v),y(u,g,v),n=!0},p:qe,i(g){n||($(r.$$.fragment,g),$(t.$$.fragment,g),$(u.$$.fragment,g),n=!0)},o(g){c(r.$$.fragment,g),c(t.$$.fragment,g),c(u.$$.fragment,g),n=!1},d(g){g&&(f(a),f(_)),w(r,g),w(t,g),w(u,g)}}}function Et(o){let r,a;return r=new Ve({props:{queryID:"sector_list_earn",queryResult:o[0]}}),{c(){h(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const u={};_[0]&1&&(u.queryResult=t[0]),r.$set(u)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function Ht(o){let r,a;return r=new Bt({props:{value:o[48].value,valueLabel:o[48].label}}),{c(){h(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const u={};_[0]&1&&(u.value=t[48].value),_[0]&1&&(u.valueLabel=t[48].label),r.$set(u)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function $r(o){let r,a,t,_;r=new Bt({props:{value:"%",valueLabel:"Tous les secteurs"}});let u=Ct(o[0]),n=[];for(let v=0;v<u.length;v+=1)n[v]=Ht(qt(o,u,v));const g=v=>c(n[v],1,1,()=>{n[v]=null});return{c(){h(r.$$.fragment),a=d();for(let v=0;v<n.length;v+=1)n[v].c();t=Oe()},l(v){b(r.$$.fragment,v),a=p(v);for(let i=0;i<n.length;i+=1)n[i].l(v);t=Oe()},m(v,i){y(r,v,i),m(v,a,i);for(let T=0;T<n.length;T+=1)n[T]&&n[T].m(v,i);m(v,t,i),_=!0},p(v,i){if(i[0]&1){u=Ct(v[0]);let T;for(T=0;T<u.length;T+=1){const M=qt(v,u,T);n[T]?(n[T].p(M,i),$(n[T],1)):(n[T]=Ht(M),n[T].c(),$(n[T],1),n[T].m(t.parentNode,t))}for(He(),T=u.length;T<n.length;T+=1)g(T);Ee()}},i(v){if(!_){$(r.$$.fragment,v);for(let i=0;i<u.length;i+=1)$(n[i]);_=!0}},o(v){c(r.$$.fragment,v),n=n.filter(Boolean);for(let i=0;i<n.length;i+=1)c(n[i]);_=!1},d(v){v&&(f(a),f(t)),w(r,v),Qt(n,v)}}}function Ft(o){let r,a;return r=new Ve({props:{queryID:"earnings_filtered",queryResult:o[1]}}),{c(){h(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const u={};_[0]&2&&(u.queryResult=t[1]),r.$set(u)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function Dt(o){let r,a;return r=new Ve({props:{queryID:"earnings_summary",queryResult:o[2]}}),{c(){h(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const u={};_[0]&4&&(u.queryResult=t[2]),r.$set(u)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function St(o){let r,a;return r=new Ve({props:{queryID:"top20_rev_growth",queryResult:o[3]}}),{c(){h(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const u={};_[0]&8&&(u.queryResult=t[3]),r.$set(u)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function It(o){let r,a;return r=new Ve({props:{queryID:"scatter_growth",queryResult:o[4]}}),{c(){h(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const u={};_[0]&16&&(u.queryResult=t[4]),r.$set(u)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function Lt(o){let r,a;return r=new Ve({props:{queryID:"top_margins",queryResult:o[5]}}),{c(){h(r.$$.fragment)},l(t){b(r.$$.fragment,t)},m(t,_){y(r,t,_),a=!0},p(t,_){const u={};_[0]&32&&(u.queryResult=t[5]),r.$set(u)},i(t){a||($(r.$$.fragment,t),a=!0)},o(t){c(r.$$.fragment,t),a=!1},d(t){w(r,t)}}}function cr(o){let r;return{c(){r=De("Analysez les dynamiques de croissance et de rentabilite des plus grandes capitalisations. Filtrez par style (Croissance vs Valeur) et par secteur pour identifier les profils les plus attractifs.")},l(a){r=Fe(a,"Analysez les dynamiques de croissance et de rentabilite des plus grandes capitalisations. Filtrez par style (Croissance vs Valeur) et par secteur pour identifier les profils les plus attractifs.")},m(a,t){m(a,r,t)},d(a){a&&f(r)}}}function vr(o){let r,a,t,_,u,n,g,v,i,T,M,V,E,G,U,z,x,Q,q,Z,H,ue,X,F,D,P;return r=new ne({props:{id:"symbol",title:"Ticker"}}),t=new ne({props:{id:"name",title:"Nom"}}),u=new ne({props:{id:"revenue",title:"CA",fmt:"usd"}}),g=new ne({props:{id:"revenue_growth",title:"Croiss. CA %",fmt:"num1"}}),i=new ne({props:{id:"earnings_growth",title:"Croiss. BPA %",fmt:"num1"}}),M=new ne({props:{id:"gross_margin",title:"Marge Brute %",fmt:"num1"}}),E=new ne({props:{id:"operating_margin",title:"Marge Op. %",fmt:"num1"}}),U=new ne({props:{id:"profit_margin",title:"Marge Nette %",fmt:"num1"}}),x=new ne({props:{id:"roe",title:"ROE %",fmt:"num1"}}),q=new ne({props:{id:"roa",title:"ROA %",fmt:"num1"}}),H=new ne({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),X=new ne({props:{id:"sector",title:"Secteur"}}),D=new ne({props:{id:"country",title:"Pays"}}),{c(){h(r.$$.fragment),a=d(),h(t.$$.fragment),_=d(),h(u.$$.fragment),n=d(),h(g.$$.fragment),v=d(),h(i.$$.fragment),T=d(),h(M.$$.fragment),V=d(),h(E.$$.fragment),G=d(),h(U.$$.fragment),z=d(),h(x.$$.fragment),Q=d(),h(q.$$.fragment),Z=d(),h(H.$$.fragment),ue=d(),h(X.$$.fragment),F=d(),h(D.$$.fragment)},l(s){b(r.$$.fragment,s),a=p(s),b(t.$$.fragment,s),_=p(s),b(u.$$.fragment,s),n=p(s),b(g.$$.fragment,s),v=p(s),b(i.$$.fragment,s),T=p(s),b(M.$$.fragment,s),V=p(s),b(E.$$.fragment,s),G=p(s),b(U.$$.fragment,s),z=p(s),b(x.$$.fragment,s),Q=p(s),b(q.$$.fragment,s),Z=p(s),b(H.$$.fragment,s),ue=p(s),b(X.$$.fragment,s),F=p(s),b(D.$$.fragment,s)},m(s,k){y(r,s,k),m(s,a,k),y(t,s,k),m(s,_,k),y(u,s,k),m(s,n,k),y(g,s,k),m(s,v,k),y(i,s,k),m(s,T,k),y(M,s,k),m(s,V,k),y(E,s,k),m(s,G,k),y(U,s,k),m(s,z,k),y(x,s,k),m(s,Q,k),y(q,s,k),m(s,Z,k),y(H,s,k),m(s,ue,k),y(X,s,k),m(s,F,k),y(D,s,k),P=!0},p:qe,i(s){P||($(r.$$.fragment,s),$(t.$$.fragment,s),$(u.$$.fragment,s),$(g.$$.fragment,s),$(i.$$.fragment,s),$(M.$$.fragment,s),$(E.$$.fragment,s),$(U.$$.fragment,s),$(x.$$.fragment,s),$(q.$$.fragment,s),$(H.$$.fragment,s),$(X.$$.fragment,s),$(D.$$.fragment,s),P=!0)},o(s){c(r.$$.fragment,s),c(t.$$.fragment,s),c(u.$$.fragment,s),c(g.$$.fragment,s),c(i.$$.fragment,s),c(M.$$.fragment,s),c(E.$$.fragment,s),c(U.$$.fragment,s),c(x.$$.fragment,s),c(q.$$.fragment,s),c(H.$$.fragment,s),c(X.$$.fragment,s),c(D.$$.fragment,s),P=!1},d(s){s&&(f(a),f(_),f(n),f(v),f(T),f(V),f(G),f(z),f(Q),f(Z),f(ue),f(F)),w(r,s),w(t,s),w(u,s),w(g,s),w(i,s),w(M,s),w(E,s),w(U,s),w(x,s),w(q,s),w(H,s),w(X,s),w(D,s)}}}function pr(o){let r;return{c(){r=De("Accueil")},l(a){r=Fe(a,"Accueil")},m(a,t){m(a,r,t)},d(a){a&&f(r)}}}function dr(o){let r;return{c(){r=De("Explorateur d'Actions")},l(a){r=Fe(a,"Explorateur d'Actions")},m(a,t){m(a,r,t)},d(a){a&&f(r)}}}function wr(o){let r;return{c(){r=De("Analyse Sectorielle")},l(a){r=Fe(a,"Analyse Sectorielle")},m(a,t){m(a,r,t)},d(a){a&&f(r)}}}function yr(o){let r;return{c(){r=De("Analyse Geographique")},l(a){r=Fe(a,"Analyse Geographique")},m(a,t){m(a,r,t)},d(a){a&&f(r)}}}function br(o){let r;return{c(){r=De("Lab de Valorisation")},l(a){r=Fe(a,"Lab de Valorisation")},m(a,t){m(a,r,t)},d(a){a&&f(r)}}}function hr(o){let r,a,t,_,u,n,g,v,i,T,M,V,E,G,U,z,x='<a href="#croissance--rentabilite">Croissance &amp; Rentabilite</a>',Q,q,Z,H,ue='<a href="#metriques-agregees">Metriques Agregees</a>',X,F,D,P,s,k,ve,Y,le,ee,pe,ie,de,J,se,te,we,re,Se='<a href="#top-20-croissance-du-chiffre-daffaires">Top 20 Croissance du Chiffre d&#39;Affaires</a>',oe,W,fe,ae,Ie='<a href="#croissance-ca-vs-croissance-benefices">Croissance CA vs Croissance Benefices</a>',ye,R,Le,me,at='<a href="#top-20-marge-nette">Top 20 Marge Nette</a>',Ge,be,Qe,ge,nt='<a href="#tableau-detaille-croissance--rentabilite">Tableau Detaille Croissance &amp; Rentabilite</a>',je,he,Ke,Pe,Xe,ke,Ye,Te,Je,Ce,We,Re,Ze,Ae,xe,$e=typeof A<"u"&&A.title&&A.hide_title!==!0&&sr();function Nt(e,l){return typeof A<"u"&&A.title?_r:or}let Ue=Nt()(o),ce=typeof A=="object"&&ur();n=new nr({props:{name:"style_filter",title:"Style d'investissement",defaultValue:"all",$$slots:{default:[gr]},$$scope:{ctx:o}}});let S=o[0]&&Et(o);i=new ar({props:{name:"earn_sector",title:"Secteur",defaultValue:"%",$$slots:{default:[$r]},$$scope:{ctx:o}}});let I=o[1]&&Ft(o),L=o[2]&&Dt(o),B=o[3]&&St(o),N=o[4]&&It(o),O=o[5]&&Lt(o);return q=new tr({props:{status:"info",$$slots:{default:[cr]},$$scope:{ctx:o}}}),F=new Me({props:{data:o[2],value:"nb_stocks",title:"Actions"}}),P=new Me({props:{data:o[2],value:"avg_rev_growth",title:"Croiss. CA Moy. (%)"}}),k=new Me({props:{data:o[2],value:"avg_earn_growth",title:"Croiss. BPA Moy. (%)"}}),Y=new Me({props:{data:o[2],value:"avg_gross_margin",title:"Marge Brute Moy. (%)"}}),ee=new Me({props:{data:o[2],value:"avg_op_margin",title:"Marge Op. Moy. (%)"}}),ie=new Me({props:{data:o[2],value:"avg_profit_margin",title:"Marge Nette Moy. (%)"}}),J=new Me({props:{data:o[2],value:"avg_roe",title:"ROE Moy. (%)"}}),te=new Me({props:{data:o[2],value:"avg_roa",title:"ROA Moy. (%)"}}),W=new Mt({props:{data:o[3],x:"symbol",y:"revenue_growth",xAxisTitle:"Ticker",yAxisTitle:"Croissance CA (%)",title:"Top 20 - Croissance du Chiffre d'Affaires",sort:"false"}}),R=new ir({props:{data:o[4],x:"revenue_growth",y:"earnings_growth",size:"market_cap",series:"sector",xAxisTitle:"Croissance CA (%)",yAxisTitle:"Croissance Benefices (%)",title:"Croissance Revenue vs Earnings",tooltipTitle:"symbol"}}),be=new Mt({props:{data:o[5],x:"symbol",y:"profit_margin",xAxisTitle:"Ticker",yAxisTitle:"Marge Nette (%)",title:"Top 20 - Marge Nette la Plus Elevee",sort:"false"}}),he=new Yt({props:{data:o[1],search:"true",rows:"20",$$slots:{default:[vr]},$$scope:{ctx:o}}}),ke=new ze({props:{url:"/",$$slots:{default:[pr]},$$scope:{ctx:o}}}),Te=new ze({props:{url:"/explorer",$$slots:{default:[dr]},$$scope:{ctx:o}}}),Ce=new ze({props:{url:"/sectors",$$slots:{default:[wr]},$$scope:{ctx:o}}}),Re=new ze({props:{url:"/regions",$$slots:{default:[yr]},$$scope:{ctx:o}}}),Ae=new ze({props:{url:"/valuations",$$slots:{default:[br]},$$scope:{ctx:o}}}),{c(){$e&&$e.c(),r=d(),Ue.c(),a=K("meta"),t=K("meta"),ce&&ce.c(),_=Oe(),u=d(),h(n.$$.fragment),g=d(),S&&S.c(),v=d(),h(i.$$.fragment),T=d(),I&&I.c(),M=d(),L&&L.c(),V=d(),B&&B.c(),E=d(),N&&N.c(),G=d(),O&&O.c(),U=d(),z=K("h1"),z.innerHTML=x,Q=d(),h(q.$$.fragment),Z=d(),H=K("h2"),H.innerHTML=ue,X=d(),h(F.$$.fragment),D=d(),h(P.$$.fragment),s=d(),h(k.$$.fragment),ve=d(),h(Y.$$.fragment),le=d(),h(ee.$$.fragment),pe=d(),h(ie.$$.fragment),de=d(),h(J.$$.fragment),se=d(),h(te.$$.fragment),we=d(),re=K("h2"),re.innerHTML=Se,oe=d(),h(W.$$.fragment),fe=d(),ae=K("h2"),ae.innerHTML=Ie,ye=d(),h(R.$$.fragment),Le=d(),me=K("h2"),me.innerHTML=at,Ge=d(),h(be.$$.fragment),Qe=d(),ge=K("h2"),ge.innerHTML=nt,je=d(),h(he.$$.fragment),Ke=d(),Pe=K("hr"),Xe=d(),h(ke.$$.fragment),Ye=d(),h(Te.$$.fragment),Je=d(),h(Ce.$$.fragment),We=d(),h(Re.$$.fragment),Ze=d(),h(Ae.$$.fragment),this.h()},l(e){$e&&$e.l(e),r=p(e);const l=Vt("svelte-2igo1p",document.head);Ue.l(l),a=j(l,"META",{name:!0,content:!0}),t=j(l,"META",{name:!0,content:!0}),ce&&ce.l(l),_=Oe(),l.forEach(f),u=p(e),b(n.$$.fragment,e),g=p(e),S&&S.l(e),v=p(e),b(i.$$.fragment,e),T=p(e),I&&I.l(e),M=p(e),L&&L.l(e),V=p(e),B&&B.l(e),E=p(e),N&&N.l(e),G=p(e),O&&O.l(e),U=p(e),z=j(e,"H1",{class:!0,id:!0,"data-svelte-h":!0}),Be(z)!=="svelte-19cmzkt"&&(z.innerHTML=x),Q=p(e),b(q.$$.fragment,e),Z=p(e),H=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Be(H)!=="svelte-b57xge"&&(H.innerHTML=ue),X=p(e),b(F.$$.fragment,e),D=p(e),b(P.$$.fragment,e),s=p(e),b(k.$$.fragment,e),ve=p(e),b(Y.$$.fragment,e),le=p(e),b(ee.$$.fragment,e),pe=p(e),b(ie.$$.fragment,e),de=p(e),b(J.$$.fragment,e),se=p(e),b(te.$$.fragment,e),we=p(e),re=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Be(re)!=="svelte-7vy10r"&&(re.innerHTML=Se),oe=p(e),b(W.$$.fragment,e),fe=p(e),ae=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Be(ae)!=="svelte-ol9zr"&&(ae.innerHTML=Ie),ye=p(e),b(R.$$.fragment,e),Le=p(e),me=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Be(me)!=="svelte-yq46gd"&&(me.innerHTML=at),Ge=p(e),b(be.$$.fragment,e),Qe=p(e),ge=j(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Be(ge)!=="svelte-1gd8faj"&&(ge.innerHTML=nt),je=p(e),b(he.$$.fragment,e),Ke=p(e),Pe=j(e,"HR",{class:!0}),Xe=p(e),b(ke.$$.fragment,e),Ye=p(e),b(Te.$$.fragment,e),Je=p(e),b(Ce.$$.fragment,e),We=p(e),b(Re.$$.fragment,e),Ze=p(e),b(Ae.$$.fragment,e),this.h()},h(){C(a,"name","twitter:card"),C(a,"content","summary_large_image"),C(t,"name","twitter:site"),C(t,"content","@evidence_dev"),C(z,"class","markdown"),C(z,"id","croissance--rentabilite"),C(H,"class","markdown"),C(H,"id","metriques-agregees"),C(re,"class","markdown"),C(re,"id","top-20-croissance-du-chiffre-daffaires"),C(ae,"class","markdown"),C(ae,"id","croissance-ca-vs-croissance-benefices"),C(me,"class","markdown"),C(me,"id","top-20-marge-nette"),C(ge,"class","markdown"),C(ge,"id","tableau-detaille-croissance--rentabilite"),C(Pe,"class","markdown")},m(e,l){$e&&$e.m(e,l),m(e,r,l),Ue.m(document.head,null),et(document.head,a),et(document.head,t),ce&&ce.m(document.head,null),et(document.head,_),m(e,u,l),y(n,e,l),m(e,g,l),S&&S.m(e,l),m(e,v,l),y(i,e,l),m(e,T,l),I&&I.m(e,l),m(e,M,l),L&&L.m(e,l),m(e,V,l),B&&B.m(e,l),m(e,E,l),N&&N.m(e,l),m(e,G,l),O&&O.m(e,l),m(e,U,l),m(e,z,l),m(e,Q,l),y(q,e,l),m(e,Z,l),m(e,H,l),m(e,X,l),y(F,e,l),m(e,D,l),y(P,e,l),m(e,s,l),y(k,e,l),m(e,ve,l),y(Y,e,l),m(e,le,l),y(ee,e,l),m(e,pe,l),y(ie,e,l),m(e,de,l),y(J,e,l),m(e,se,l),y(te,e,l),m(e,we,l),m(e,re,l),m(e,oe,l),y(W,e,l),m(e,fe,l),m(e,ae,l),m(e,ye,l),y(R,e,l),m(e,Le,l),m(e,me,l),m(e,Ge,l),y(be,e,l),m(e,Qe,l),m(e,ge,l),m(e,je,l),y(he,e,l),m(e,Ke,l),m(e,Pe,l),m(e,Xe,l),y(ke,e,l),m(e,Ye,l),y(Te,e,l),m(e,Je,l),y(Ce,e,l),m(e,We,l),y(Re,e,l),m(e,Ze,l),y(Ae,e,l),xe=!0},p(e,l){typeof A<"u"&&A.title&&A.hide_title!==!0&&$e.p(e,l),Ue.p(e,l),typeof A=="object"&&ce.p(e,l);const lt={};l[1]&1048576&&(lt.$$scope={dirty:l,ctx:e}),n.$set(lt),e[0]?S?(S.p(e,l),l[0]&1&&$(S,1)):(S=Et(e),S.c(),$(S,1),S.m(v.parentNode,v)):S&&(He(),c(S,1,1,()=>{S=null}),Ee());const it={};l[0]&1|l[1]&1048576&&(it.$$scope={dirty:l,ctx:e}),i.$set(it),e[1]?I?(I.p(e,l),l[0]&2&&$(I,1)):(I=Ft(e),I.c(),$(I,1),I.m(M.parentNode,M)):I&&(He(),c(I,1,1,()=>{I=null}),Ee()),e[2]?L?(L.p(e,l),l[0]&4&&$(L,1)):(L=Dt(e),L.c(),$(L,1),L.m(V.parentNode,V)):L&&(He(),c(L,1,1,()=>{L=null}),Ee()),e[3]?B?(B.p(e,l),l[0]&8&&$(B,1)):(B=St(e),B.c(),$(B,1),B.m(E.parentNode,E)):B&&(He(),c(B,1,1,()=>{B=null}),Ee()),e[4]?N?(N.p(e,l),l[0]&16&&$(N,1)):(N=It(e),N.c(),$(N,1),N.m(G.parentNode,G)):N&&(He(),c(N,1,1,()=>{N=null}),Ee()),e[5]?O?(O.p(e,l),l[0]&32&&$(O,1)):(O=Lt(e),O.c(),$(O,1),O.m(U.parentNode,U)):O&&(He(),c(O,1,1,()=>{O=null}),Ee());const st={};l[1]&1048576&&(st.$$scope={dirty:l,ctx:e}),q.$set(st);const ot={};l[0]&4&&(ot.data=e[2]),F.$set(ot);const _t={};l[0]&4&&(_t.data=e[2]),P.$set(_t);const ut={};l[0]&4&&(ut.data=e[2]),k.$set(ut);const ft={};l[0]&4&&(ft.data=e[2]),Y.$set(ft);const mt={};l[0]&4&&(mt.data=e[2]),ee.$set(mt);const gt={};l[0]&4&&(gt.data=e[2]),ie.$set(gt);const $t={};l[0]&4&&($t.data=e[2]),J.$set($t);const ct={};l[0]&4&&(ct.data=e[2]),te.$set(ct);const vt={};l[0]&8&&(vt.data=e[3]),W.$set(vt);const pt={};l[0]&16&&(pt.data=e[4]),R.$set(pt);const dt={};l[0]&32&&(dt.data=e[5]),be.$set(dt);const tt={};l[0]&2&&(tt.data=e[1]),l[1]&1048576&&(tt.$$scope={dirty:l,ctx:e}),he.$set(tt);const wt={};l[1]&1048576&&(wt.$$scope={dirty:l,ctx:e}),ke.$set(wt);const yt={};l[1]&1048576&&(yt.$$scope={dirty:l,ctx:e}),Te.$set(yt);const bt={};l[1]&1048576&&(bt.$$scope={dirty:l,ctx:e}),Ce.$set(bt);const ht={};l[1]&1048576&&(ht.$$scope={dirty:l,ctx:e}),Re.$set(ht);const kt={};l[1]&1048576&&(kt.$$scope={dirty:l,ctx:e}),Ae.$set(kt)},i(e){xe||($(n.$$.fragment,e),$(S),$(i.$$.fragment,e),$(I),$(L),$(B),$(N),$(O),$(q.$$.fragment,e),$(F.$$.fragment,e),$(P.$$.fragment,e),$(k.$$.fragment,e),$(Y.$$.fragment,e),$(ee.$$.fragment,e),$(ie.$$.fragment,e),$(J.$$.fragment,e),$(te.$$.fragment,e),$(W.$$.fragment,e),$(R.$$.fragment,e),$(be.$$.fragment,e),$(he.$$.fragment,e),$(ke.$$.fragment,e),$(Te.$$.fragment,e),$(Ce.$$.fragment,e),$(Re.$$.fragment,e),$(Ae.$$.fragment,e),xe=!0)},o(e){c(n.$$.fragment,e),c(S),c(i.$$.fragment,e),c(I),c(L),c(B),c(N),c(O),c(q.$$.fragment,e),c(F.$$.fragment,e),c(P.$$.fragment,e),c(k.$$.fragment,e),c(Y.$$.fragment,e),c(ee.$$.fragment,e),c(ie.$$.fragment,e),c(J.$$.fragment,e),c(te.$$.fragment,e),c(W.$$.fragment,e),c(R.$$.fragment,e),c(be.$$.fragment,e),c(he.$$.fragment,e),c(ke.$$.fragment,e),c(Te.$$.fragment,e),c(Ce.$$.fragment,e),c(Re.$$.fragment,e),c(Ae.$$.fragment,e),xe=!1},d(e){e&&(f(r),f(u),f(g),f(v),f(T),f(M),f(V),f(E),f(G),f(U),f(z),f(Q),f(Z),f(H),f(X),f(D),f(s),f(ve),f(le),f(pe),f(de),f(se),f(we),f(re),f(oe),f(fe),f(ae),f(ye),f(Le),f(me),f(Ge),f(Qe),f(ge),f(je),f(Ke),f(Pe),f(Xe),f(Ye),f(Je),f(We),f(Ze)),$e&&$e.d(e),Ue.d(e),f(a),f(t),ce&&ce.d(e),f(_),w(n,e),S&&S.d(e),w(i,e),I&&I.d(e),L&&L.d(e),B&&B.d(e),N&&N.d(e),O&&O.d(e),w(q,e),w(F,e),w(P,e),w(k,e),w(Y,e),w(ee,e),w(ie,e),w(J,e),w(te,e),w(W,e),w(R,e),w(be,e),w(he,e),w(ke,e),w(Te,e),w(Ce,e),w(Re,e),w(Ae,e)}}}const A={title:"Croissance & Rentabilite - Radiographie des 150 Plus Grandes Capitalisations Mondiales",description:"Analyse de la croissance du chiffre d'affaires, des benefices et des marges de rentabilite"};function kr(o,r,a){let t,_;Tt(o,lr,R=>a(33,t=R)),Tt(o,At,R=>a(38,_=R));let{data:u}=r,{data:n={},customFormattingSettings:g,__db:v,inputs:i}=u;Pt(At,_="aa064b247a24e2a5db5c84aa84e53112",_);let T=Jt(er(i));Ut(T.subscribe(R=>a(8,i=R))),zt(xt,{getCustomFormats:()=>g.customFormats||[]});const M=(R,Le)=>rr(v.query,R,{query_name:Le});Wt(M),t.params,Gt(()=>!0);let V={initialData:void 0,initialError:void 0},E=_e`select distinct sector as value, sector as label
from market.stocks
order by sector`,G=`select distinct sector as value, sector as label
from market.stocks
order by sector`;n.sector_list_earn_data&&(n.sector_list_earn_data instanceof Error?V.initialError=n.sector_list_earn_data:V.initialData=n.sector_list_earn_data,n.sector_list_earn_columns&&(V.knownColumns=n.sector_list_earn_columns));let U,z=!1;const x=Ne.createReactive({callback:R=>{a(0,U=R)},execFn:M},{id:"sector_list_earn",...V});x(G,{noResolve:E,...V}),globalThis[Symbol.for("sector_list_earn")]={get value(){return U}};let Q={initialData:void 0,initialError:void 0},q=_e`select
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
order by revenue_growth desc nulls last`,Z=`select
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
order by revenue_growth desc nulls last`;n.earnings_filtered_data&&(n.earnings_filtered_data instanceof Error?Q.initialError=n.earnings_filtered_data:Q.initialData=n.earnings_filtered_data,n.earnings_filtered_columns&&(Q.knownColumns=n.earnings_filtered_columns));let H,ue=!1;const X=Ne.createReactive({callback:R=>{a(1,H=R)},execFn:M},{id:"earnings_filtered",...Q});X(Z,{noResolve:q,...Q}),globalThis[Symbol.for("earnings_filtered")]={get value(){return H}};let F={initialData:void 0,initialError:void 0},D=_e`select
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
  )`,P=`select
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
  )`;n.earnings_summary_data&&(n.earnings_summary_data instanceof Error?F.initialError=n.earnings_summary_data:F.initialData=n.earnings_summary_data,n.earnings_summary_columns&&(F.knownColumns=n.earnings_summary_columns));let s,k=!1;const ve=Ne.createReactive({callback:R=>{a(2,s=R)},execFn:M},{id:"earnings_summary",...F});ve(P,{noResolve:D,...F}),globalThis[Symbol.for("earnings_summary")]={get value(){return s}};let Y={initialData:void 0,initialError:void 0},le=_e`select
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
limit 20`,ee=`select
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
limit 20`;n.top20_rev_growth_data&&(n.top20_rev_growth_data instanceof Error?Y.initialError=n.top20_rev_growth_data:Y.initialData=n.top20_rev_growth_data,n.top20_rev_growth_columns&&(Y.knownColumns=n.top20_rev_growth_columns));let pe,ie=!1;const de=Ne.createReactive({callback:R=>{a(3,pe=R)},execFn:M},{id:"top20_rev_growth",...Y});de(ee,{noResolve:le,...Y}),globalThis[Symbol.for("top20_rev_growth")]={get value(){return pe}};let J={initialData:void 0,initialError:void 0},se=_e`select
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
  and earnings_growth is not null`,te=`select
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
  and earnings_growth is not null`;n.scatter_growth_data&&(n.scatter_growth_data instanceof Error?J.initialError=n.scatter_growth_data:J.initialData=n.scatter_growth_data,n.scatter_growth_columns&&(J.knownColumns=n.scatter_growth_columns));let we,re=!1;const Se=Ne.createReactive({callback:R=>{a(4,we=R)},execFn:M},{id:"scatter_growth",...J});Se(te,{noResolve:se,...J}),globalThis[Symbol.for("scatter_growth")]={get value(){return we}};let oe={initialData:void 0,initialError:void 0},W=_e`select
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
limit 20`,fe=`select
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
limit 20`;n.top_margins_data&&(n.top_margins_data instanceof Error?oe.initialError=n.top_margins_data:oe.initialData=n.top_margins_data,n.top_margins_columns&&(oe.knownColumns=n.top_margins_columns));let ae,Ie=!1;const ye=Ne.createReactive({callback:R=>{a(5,ae=R)},execFn:M},{id:"top_margins",...oe});return ye(fe,{noResolve:W,...oe}),globalThis[Symbol.for("top_margins")]={get value(){return ae}},o.$$set=R=>{"data"in R&&a(6,u=R.data)},o.$$.update=()=>{o.$$.dirty[0]&64&&a(7,{data:n={},customFormattingSettings:g,__db:v}=u,n),o.$$.dirty[0]&128&&Zt.set(Object.keys(n).length>0),o.$$.dirty[1]&4&&t.params,o.$$.dirty[0]&7680&&(E||!z?E||(x(G,{noResolve:E,...V}),a(12,z=!0)):x(G,{noResolve:E})),o.$$.dirty[0]&256&&a(14,q=_e`select
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
order by revenue_growth desc nulls last`),o.$$.dirty[0]&256&&a(15,Z=`select
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
order by revenue_growth desc nulls last`),o.$$.dirty[0]&122880&&(q||!ue?q||(X(Z,{noResolve:q,...Q}),a(16,ue=!0)):X(Z,{noResolve:q})),o.$$.dirty[0]&256&&a(18,D=_e`select
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
  )`),o.$$.dirty[0]&256&&a(19,P=`select
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
  )`),o.$$.dirty[0]&1966080&&(D||!k?D||(ve(P,{noResolve:D,...F}),a(20,k=!0)):ve(P,{noResolve:D})),o.$$.dirty[0]&256&&a(22,le=_e`select
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
limit 20`),o.$$.dirty[0]&256&&a(23,ee=`select
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
limit 20`),o.$$.dirty[0]&31457280&&(le||!ie?le||(de(ee,{noResolve:le,...Y}),a(24,ie=!0)):de(ee,{noResolve:le})),o.$$.dirty[0]&256&&a(26,se=_e`select
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
  and earnings_growth is not null`),o.$$.dirty[0]&256&&a(27,te=`select
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
  and earnings_growth is not null`),o.$$.dirty[0]&503316480&&(se||!re?se||(Se(te,{noResolve:se,...J}),a(28,re=!0)):Se(te,{noResolve:se})),o.$$.dirty[0]&256&&a(30,W=_e`select
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
limit 20`),o.$$.dirty[0]&256&&a(31,fe=`select
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
limit 20`),o.$$.dirty[0]&1610612736|o.$$.dirty[1]&3&&(W||!Ie?W||(ye(fe,{noResolve:W,...oe}),a(32,Ie=!0)):ye(fe,{noResolve:W}))},a(10,E=_e`select distinct sector as value, sector as label
from market.stocks
order by sector`),a(11,G=`select distinct sector as value, sector as label
from market.stocks
order by sector`),[U,H,s,pe,we,ae,u,n,i,V,E,G,z,Q,q,Z,ue,F,D,P,k,Y,le,ee,ie,J,se,te,re,oe,W,fe,Ie,t]}class Lr extends Kt{constructor(r){super(),Xt(this,r,kr,hr,Ot,{data:6},null,[-1,-1])}}export{Lr as component};
