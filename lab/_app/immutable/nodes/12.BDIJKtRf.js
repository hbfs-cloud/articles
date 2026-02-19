import{s as Qr,d as s,i as o,a as Jt,b as q,c as Be,e as $,h as zr,f as B,g as Zt,j as be,k as b,l as N,m as xr,n as Xr,o as Kr,p as Wr,q as Jr,t as Tt,u as Rt,v as it,w as Zr}from"../chunks/scheduler.gCtXCaAC.js";import{S as ei,i as ti,d as w,t as c,a as u,c as Re,m as y,b as g,e as k,g as qe}from"../chunks/index.DmJzZqpA.js";import{D as jr,e as ri,s as ii,Q as Te,p as ai,C as G,a as Er,b as li,r as Dr,c as ni}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.xVnsThWF.js";import{w as si}from"../chunks/entry.t5gz319j.js";import{A as oi,B as rt,b as Hr,T as _i,L as Lt,Q as xe,a as di}from"../chunks/BigValue.vcBvE0eY.js";import{h as j,p as fi}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{p as mi}from"../chunks/stores.CdFJQivx.js";import{B as pi,a as Wt}from"../chunks/ButtonGroup.DrUuNe7L.js";import{S as tr}from"../chunks/Slider.Bbm4iusj.js";import{G as ui}from"../chunks/Grid.B6K-jFTg.js";import{B as hr}from"../chunks/BoxPlot.WblEJAel.js";import{B as Gr}from"../chunks/BubbleChart.CKh_rRrf.js";import{H as rr}from"../chunks/Histogram.B5PBVBjM.js";function ci(_){let r,i=O.title+"",t;return{c(){r=N("h1"),t=Rt(i),this.h()},l(f){r=B(f,"H1",{class:!0});var m=Zr(r);t=Tt(m,i),m.forEach(s),this.h()},h(){q(r,"class","title")},m(f,m){o(f,r,m),Jt(r,t)},p:it,d(f){f&&s(r)}}}function $i(_){return{c(){this.h()},l(r){this.h()},h(){document.title="Evidence"},m:it,p:it,d:it}}function bi(_){let r,i,t,f,m;return document.title=r=O.title,{c(){i=b(),t=N("meta"),f=b(),m=N("meta"),this.h()},l(l){i=$(l),t=B(l,"META",{property:!0,content:!0}),f=$(l),m=B(l,"META",{name:!0,content:!0}),this.h()},h(){var l,v;q(t,"property","og:title"),q(t,"content",((l=O.og)==null?void 0:l.title)??O.title),q(m,"name","twitter:title"),q(m,"content",((v=O.og)==null?void 0:v.title)??O.title)},m(l,v){o(l,i,v),o(l,t,v),o(l,f,v),o(l,m,v)},p(l,v){v&0&&r!==(r=O.title)&&(document.title=r)},d(l){l&&(s(i),s(t),s(f),s(m))}}}function vi(_){var m;let r,i,t=wi(),f=((m=O.og)==null?void 0:m.image)&&yi();return{c(){t&&t.c(),r=b(),f&&f.c(),i=Zt()},l(l){t&&t.l(l),r=$(l),f&&f.l(l),i=Zt()},m(l,v){t&&t.m(l,v),o(l,r,v),f&&f.m(l,v),o(l,i,v)},p(l,v){var h;t.p(l,v),(h=O.og)!=null&&h.image&&f.p(l,v)},d(l){l&&(s(r),s(i)),t&&t.d(l),f&&f.d(l)}}}function wi(_){let r,i,t,f,m;return{c(){r=N("meta"),i=b(),t=N("meta"),f=b(),m=N("meta"),this.h()},l(l){r=B(l,"META",{name:!0,content:!0}),i=$(l),t=B(l,"META",{property:!0,content:!0}),f=$(l),m=B(l,"META",{name:!0,content:!0}),this.h()},h(){var l,v;q(r,"name","description"),q(r,"content",O.description),q(t,"property","og:description"),q(t,"content",((l=O.og)==null?void 0:l.description)??O.description),q(m,"name","twitter:description"),q(m,"content",((v=O.og)==null?void 0:v.description)??O.description)},m(l,v){o(l,r,v),o(l,i,v),o(l,t,v),o(l,f,v),o(l,m,v)},p:it,d(l){l&&(s(r),s(i),s(t),s(f),s(m))}}}function yi(_){let r,i,t;return{c(){r=N("meta"),i=b(),t=N("meta"),this.h()},l(f){r=B(f,"META",{property:!0,content:!0}),i=$(f),t=B(f,"META",{name:!0,content:!0}),this.h()},h(){var f,m;q(r,"property","og:image"),q(r,"content",Er((f=O.og)==null?void 0:f.image)),q(t,"name","twitter:image"),q(t,"content",Er((m=O.og)==null?void 0:m.image))},m(f,m){o(f,r,m),o(f,i,m),o(f,t,m)},p:it,d(f){f&&(s(r),s(i),s(t))}}}function gi(_){let r;return{c(){r=Rt("Distributions statistiques, comparaisons sectorielles et screening interactif des multiples de valorisation (P/E, Price-to-Book, Dividend Yield) sur les plus grandes capitalisations mondiales.")},l(i){r=Tt(i,"Distributions statistiques, comparaisons sectorielles et screening interactif des multiples de valorisation (P/E, Price-to-Book, Dividend Yield) sur les plus grandes capitalisations mondiales.")},m(i,t){o(i,r,t)},d(i){i&&s(r)}}}function Fr(_){let r,i;return r=new xe({props:{queryID:"val_summary_static",queryResult:_[0]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&1&&(m.queryResult=t[0]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Mr(_){let r,i;return r=new xe({props:{queryID:"hist_pe_forward",queryResult:_[1]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&2&&(m.queryResult=t[1]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Sr(_){let r,i;return r=new xe({props:{queryID:"hist_div_yield",queryResult:_[2]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&4&&(m.queryResult=t[2]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Cr(_){let r,i;return r=new xe({props:{queryID:"hist_ptb",queryResult:_[3]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&8&&(m.queryResult=t[3]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Ir(_){let r,i;return r=new xe({props:{queryID:"boxplot_pe_sector",queryResult:_[4]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&16&&(m.queryResult=t[4]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Pr(_){let r,i;return r=new xe({props:{queryID:"boxplot_div_region",queryResult:_[5]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&32&&(m.queryResult=t[5]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Ar(_){let r,i;return r=new xe({props:{queryID:"bubble_pe_div",queryResult:_[6]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&64&&(m.queryResult=t[6]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Lr(_){let r,i;return r=new xe({props:{queryID:"top20_dividends_static",queryResult:_[7]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&128&&(m.queryResult=t[7]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Br(_){let r,i;return r=new xe({props:{queryID:"top20_cheapest_pe_static",queryResult:_[8]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&256&&(m.queryResult=t[8]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Nr(_){let r,i;return r=new xe({props:{queryID:"valuation_table_static",queryResult:_[9]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&512&&(m.queryResult=t[9]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function ki(_){let r,i,t,f,m,l,v,h,d,L,E,S,I,Y,P,V,A,U,M,H,x,F,p,R,C,Q;return r=new G({props:{id:"symbol",title:"Ticker"}}),t=new G({props:{id:"name",title:"Nom"}}),m=new G({props:{id:"price",title:"Prix",fmt:"usd"}}),v=new G({props:{id:"pe_trailing",title:"P/E Trailing",fmt:"num1"}}),d=new G({props:{id:"pe_forward",title:"P/E Forward",fmt:"num1"}}),E=new G({props:{id:"price_to_book",title:"Price/Book",fmt:"num1"}}),I=new G({props:{id:"dividend_yield",title:"Div %",fmt:"num2"}}),P=new G({props:{id:"roe",title:"ROE %",fmt:"num1"}}),A=new G({props:{id:"roa",title:"ROA %",fmt:"num1"}}),M=new G({props:{id:"target_price",title:"Target",fmt:"usd"}}),x=new G({props:{id:"recommendation",title:"Reco."}}),p=new G({props:{id:"sector",title:"Secteur"}}),C=new G({props:{id:"country",title:"Pays"}}),{c(){k(r.$$.fragment),i=b(),k(t.$$.fragment),f=b(),k(m.$$.fragment),l=b(),k(v.$$.fragment),h=b(),k(d.$$.fragment),L=b(),k(E.$$.fragment),S=b(),k(I.$$.fragment),Y=b(),k(P.$$.fragment),V=b(),k(A.$$.fragment),U=b(),k(M.$$.fragment),H=b(),k(x.$$.fragment),F=b(),k(p.$$.fragment),R=b(),k(C.$$.fragment)},l(a){g(r.$$.fragment,a),i=$(a),g(t.$$.fragment,a),f=$(a),g(m.$$.fragment,a),l=$(a),g(v.$$.fragment,a),h=$(a),g(d.$$.fragment,a),L=$(a),g(E.$$.fragment,a),S=$(a),g(I.$$.fragment,a),Y=$(a),g(P.$$.fragment,a),V=$(a),g(A.$$.fragment,a),U=$(a),g(M.$$.fragment,a),H=$(a),g(x.$$.fragment,a),F=$(a),g(p.$$.fragment,a),R=$(a),g(C.$$.fragment,a)},m(a,T){y(r,a,T),o(a,i,T),y(t,a,T),o(a,f,T),y(m,a,T),o(a,l,T),y(v,a,T),o(a,h,T),y(d,a,T),o(a,L,T),y(E,a,T),o(a,S,T),y(I,a,T),o(a,Y,T),y(P,a,T),o(a,V,T),y(A,a,T),o(a,U,T),y(M,a,T),o(a,H,T),y(x,a,T),o(a,F,T),y(p,a,T),o(a,R,T),y(C,a,T),Q=!0},p:it,i(a){Q||(u(r.$$.fragment,a),u(t.$$.fragment,a),u(m.$$.fragment,a),u(v.$$.fragment,a),u(d.$$.fragment,a),u(E.$$.fragment,a),u(I.$$.fragment,a),u(P.$$.fragment,a),u(A.$$.fragment,a),u(M.$$.fragment,a),u(x.$$.fragment,a),u(p.$$.fragment,a),u(C.$$.fragment,a),Q=!0)},o(a){c(r.$$.fragment,a),c(t.$$.fragment,a),c(m.$$.fragment,a),c(v.$$.fragment,a),c(d.$$.fragment,a),c(E.$$.fragment,a),c(I.$$.fragment,a),c(P.$$.fragment,a),c(A.$$.fragment,a),c(M.$$.fragment,a),c(x.$$.fragment,a),c(p.$$.fragment,a),c(C.$$.fragment,a),Q=!1},d(a){a&&(s(i),s(f),s(l),s(h),s(L),s(S),s(Y),s(V),s(U),s(H),s(F),s(R)),w(r,a),w(t,a),w(m,a),w(v,a),w(d,a),w(E,a),w(I,a),w(P,a),w(A,a),w(M,a),w(x,a),w(p,a),w(C,a)}}}function Ti(_){let r,i,t,f,m,l,v,h;return r=new Wt({props:{valueLabel:"Toutes",value:"all",default:!0}}),t=new Wt({props:{valueLabel:"Strong Buy",value:"strong_buy"}}),m=new Wt({props:{valueLabel:"Buy",value:"buy"}}),v=new Wt({props:{valueLabel:"Hold",value:"hold"}}),{c(){k(r.$$.fragment),i=b(),k(t.$$.fragment),f=b(),k(m.$$.fragment),l=b(),k(v.$$.fragment)},l(d){g(r.$$.fragment,d),i=$(d),g(t.$$.fragment,d),f=$(d),g(m.$$.fragment,d),l=$(d),g(v.$$.fragment,d)},m(d,L){y(r,d,L),o(d,i,L),y(t,d,L),o(d,f,L),y(m,d,L),o(d,l,L),y(v,d,L),h=!0},p:it,i(d){h||(u(r.$$.fragment,d),u(t.$$.fragment,d),u(m.$$.fragment,d),u(v.$$.fragment,d),h=!0)},o(d){c(r.$$.fragment,d),c(t.$$.fragment,d),c(m.$$.fragment,d),c(v.$$.fragment,d),h=!1},d(d){d&&(s(i),s(f),s(l)),w(r,d),w(t,d),w(m,d),w(v,d)}}}function Yr(_){let r,i;return r=new xe({props:{queryID:"screener_results",queryResult:_[10]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&1024&&(m.queryResult=t[10]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Ur(_){let r,i;return r=new xe({props:{queryID:"screener_stats",queryResult:_[11]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&2048&&(m.queryResult=t[11]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Vr(_){let r,i;return r=new xe({props:{queryID:"screener_bubble",queryResult:_[12]}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&4096&&(m.queryResult=t[12]),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Ri(_){let r,i,t,f,m,l;return r=new rt({props:{data:_[11],value:"nb_matches",title:"Resultats",emptySet:"pass"}}),t=new rt({props:{data:_[11],value:"avg_pe",title:"P/E Forward Moy.",emptySet:"pass"}}),m=new rt({props:{data:_[11],value:"avg_div",title:"Div Yield Moy. (%)",emptySet:"pass"}}),{c(){k(r.$$.fragment),i=b(),k(t.$$.fragment),f=b(),k(m.$$.fragment)},l(v){g(r.$$.fragment,v),i=$(v),g(t.$$.fragment,v),f=$(v),g(m.$$.fragment,v)},m(v,h){y(r,v,h),o(v,i,h),y(t,v,h),o(v,f,h),y(m,v,h),l=!0},p(v,h){const d={};h[0]&2048&&(d.data=v[11]),r.$set(d);const L={};h[0]&2048&&(L.data=v[11]),t.$set(L);const E={};h[0]&2048&&(E.data=v[11]),m.$set(E)},i(v){l||(u(r.$$.fragment,v),u(t.$$.fragment,v),u(m.$$.fragment,v),l=!0)},o(v){c(r.$$.fragment,v),c(t.$$.fragment,v),c(m.$$.fragment,v),l=!1},d(v){v&&(s(i),s(f)),w(r,v),w(t,v),w(m,v)}}}function qi(_){let r,i,t,f,m,l,v,h,d,L,E,S,I,Y,P,V,A,U,M,H,x,F,p,R,C,Q;return r=new G({props:{id:"symbol",title:"Ticker"}}),t=new G({props:{id:"name",title:"Nom"}}),m=new G({props:{id:"price",title:"Prix",fmt:"usd"}}),v=new G({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),d=new G({props:{id:"pe_trailing",title:"P/E Trail",fmt:"num1"}}),E=new G({props:{id:"price_to_book",title:"P/B",fmt:"num1"}}),I=new G({props:{id:"dividend_yield",title:"Div %",fmt:"num2"}}),P=new G({props:{id:"roe",title:"ROE %",fmt:"num1"}}),A=new G({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),M=new G({props:{id:"target_price",title:"Target",fmt:"usd"}}),x=new G({props:{id:"recommendation",title:"Reco."}}),p=new G({props:{id:"sector",title:"Secteur"}}),C=new G({props:{id:"country",title:"Pays"}}),{c(){k(r.$$.fragment),i=b(),k(t.$$.fragment),f=b(),k(m.$$.fragment),l=b(),k(v.$$.fragment),h=b(),k(d.$$.fragment),L=b(),k(E.$$.fragment),S=b(),k(I.$$.fragment),Y=b(),k(P.$$.fragment),V=b(),k(A.$$.fragment),U=b(),k(M.$$.fragment),H=b(),k(x.$$.fragment),F=b(),k(p.$$.fragment),R=b(),k(C.$$.fragment)},l(a){g(r.$$.fragment,a),i=$(a),g(t.$$.fragment,a),f=$(a),g(m.$$.fragment,a),l=$(a),g(v.$$.fragment,a),h=$(a),g(d.$$.fragment,a),L=$(a),g(E.$$.fragment,a),S=$(a),g(I.$$.fragment,a),Y=$(a),g(P.$$.fragment,a),V=$(a),g(A.$$.fragment,a),U=$(a),g(M.$$.fragment,a),H=$(a),g(x.$$.fragment,a),F=$(a),g(p.$$.fragment,a),R=$(a),g(C.$$.fragment,a)},m(a,T){y(r,a,T),o(a,i,T),y(t,a,T),o(a,f,T),y(m,a,T),o(a,l,T),y(v,a,T),o(a,h,T),y(d,a,T),o(a,L,T),y(E,a,T),o(a,S,T),y(I,a,T),o(a,Y,T),y(P,a,T),o(a,V,T),y(A,a,T),o(a,U,T),y(M,a,T),o(a,H,T),y(x,a,T),o(a,F,T),y(p,a,T),o(a,R,T),y(C,a,T),Q=!0},p:it,i(a){Q||(u(r.$$.fragment,a),u(t.$$.fragment,a),u(m.$$.fragment,a),u(v.$$.fragment,a),u(d.$$.fragment,a),u(E.$$.fragment,a),u(I.$$.fragment,a),u(P.$$.fragment,a),u(A.$$.fragment,a),u(M.$$.fragment,a),u(x.$$.fragment,a),u(p.$$.fragment,a),u(C.$$.fragment,a),Q=!0)},o(a){c(r.$$.fragment,a),c(t.$$.fragment,a),c(m.$$.fragment,a),c(v.$$.fragment,a),c(d.$$.fragment,a),c(E.$$.fragment,a),c(I.$$.fragment,a),c(P.$$.fragment,a),c(A.$$.fragment,a),c(M.$$.fragment,a),c(x.$$.fragment,a),c(p.$$.fragment,a),c(C.$$.fragment,a),Q=!1},d(a){a&&(s(i),s(f),s(l),s(h),s(L),s(S),s(Y),s(V),s(U),s(H),s(F),s(R)),w(r,a),w(t,a),w(m,a),w(v,a),w(d,a),w(E,a),w(I,a),w(P,a),w(A,a),w(M,a),w(x,a),w(p,a),w(C,a)}}}function xi(_){let r,i,t,f,m,l,v,h,d,L,E,S,I,Y,P,V,A,U,M;r=new tr({props:{name:"pe_max",title:"P/E Forward Max",min:"0",max:"200",step:"5",defaultValue:"200"}}),t=new tr({props:{name:"div_min",title:"Dividend Yield Min (%)",min:"0",max:"10",step:"0.5",defaultValue:"0"}}),m=new tr({props:{name:"ptb_max",title:"Price-to-Book Max",min:"0",max:"50",step:"1",defaultValue:"50"}}),v=new pi({props:{name:"reco_filter",title:"Recommandation",defaultValue:"all",$$slots:{default:[Ti]},$$scope:{ctx:_}}});let H=_[10]&&Yr(_),x=_[11]&&Ur(_),F=_[12]&&Vr(_);return S=new ui({props:{cols:"3",$$slots:{default:[Ri]},$$scope:{ctx:_}}}),Y=new Gr({props:{data:_[12],x:"pe_forward",y:"dividend_yield",size:"market_cap",series:"sector",xAxisTitle:"P/E Forward",yAxisTitle:"Dividend Yield (%)",title:"Resultats du Screener (taille = capitalisation)",tooltipTitle:"symbol",emptySet:"pass"}}),V=new jr({props:{data:_[10],search:"true",rows:"25",emptySet:"pass",$$slots:{default:[qi]},$$scope:{ctx:_}}}),U=new li({props:{data:_[10],filename:"screener_valorisations",emptySet:"pass"}}),{c(){k(r.$$.fragment),i=b(),k(t.$$.fragment),f=b(),k(m.$$.fragment),l=b(),k(v.$$.fragment),h=b(),H&&H.c(),d=b(),x&&x.c(),L=b(),F&&F.c(),E=b(),k(S.$$.fragment),I=b(),k(Y.$$.fragment),P=b(),k(V.$$.fragment),A=b(),k(U.$$.fragment)},l(p){g(r.$$.fragment,p),i=$(p),g(t.$$.fragment,p),f=$(p),g(m.$$.fragment,p),l=$(p),g(v.$$.fragment,p),h=$(p),H&&H.l(p),d=$(p),x&&x.l(p),L=$(p),F&&F.l(p),E=$(p),g(S.$$.fragment,p),I=$(p),g(Y.$$.fragment,p),P=$(p),g(V.$$.fragment,p),A=$(p),g(U.$$.fragment,p)},m(p,R){y(r,p,R),o(p,i,R),y(t,p,R),o(p,f,R),y(m,p,R),o(p,l,R),y(v,p,R),o(p,h,R),H&&H.m(p,R),o(p,d,R),x&&x.m(p,R),o(p,L,R),F&&F.m(p,R),o(p,E,R),y(S,p,R),o(p,I,R),y(Y,p,R),o(p,P,R),y(V,p,R),o(p,A,R),y(U,p,R),M=!0},p(p,R){const C={};R[2]&268435456&&(C.$$scope={dirty:R,ctx:p}),v.$set(C),p[10]?H?(H.p(p,R),R[0]&1024&&u(H,1)):(H=Yr(p),H.c(),u(H,1),H.m(d.parentNode,d)):H&&(qe(),c(H,1,1,()=>{H=null}),Re()),p[11]?x?(x.p(p,R),R[0]&2048&&u(x,1)):(x=Ur(p),x.c(),u(x,1),x.m(L.parentNode,L)):x&&(qe(),c(x,1,1,()=>{x=null}),Re()),p[12]?F?(F.p(p,R),R[0]&4096&&u(F,1)):(F=Vr(p),F.c(),u(F,1),F.m(E.parentNode,E)):F&&(qe(),c(F,1,1,()=>{F=null}),Re());const Q={};R[0]&2048|R[2]&268435456&&(Q.$$scope={dirty:R,ctx:p}),S.$set(Q);const a={};R[0]&4096&&(a.data=p[12]),Y.$set(a);const T={};R[0]&1024&&(T.data=p[10]),R[2]&268435456&&(T.$$scope={dirty:R,ctx:p}),V.$set(T);const ne={};R[0]&1024&&(ne.data=p[10]),U.$set(ne)},i(p){M||(u(r.$$.fragment,p),u(t.$$.fragment,p),u(m.$$.fragment,p),u(v.$$.fragment,p),u(H),u(x),u(F),u(S.$$.fragment,p),u(Y.$$.fragment,p),u(V.$$.fragment,p),u(U.$$.fragment,p),M=!0)},o(p){c(r.$$.fragment,p),c(t.$$.fragment,p),c(m.$$.fragment,p),c(v.$$.fragment,p),c(H),c(x),c(F),c(S.$$.fragment,p),c(Y.$$.fragment,p),c(V.$$.fragment,p),c(U.$$.fragment,p),M=!1},d(p){p&&(s(i),s(f),s(l),s(h),s(d),s(L),s(E),s(I),s(P),s(A)),w(r,p),w(t,p),w(m,p),w(v,p),H&&H.d(p),x&&x.d(p),F&&F.d(p),w(S,p),w(Y,p),w(V,p),w(U,p)}}}function Ei(_){let r,i;return r=new di({props:{label:"Screener Valorisation",$$slots:{default:[xi]},$$scope:{ctx:_}}}),{c(){k(r.$$.fragment)},l(t){g(r.$$.fragment,t)},m(t,f){y(r,t,f),i=!0},p(t,f){const m={};f[0]&7168|f[2]&268435456&&(m.$$scope={dirty:f,ctx:t}),r.$set(m)},i(t){i||(u(r.$$.fragment,t),i=!0)},o(t){c(r.$$.fragment,t),i=!1},d(t){w(r,t)}}}function Di(_){let r;return{c(){r=Rt("Accueil")},l(i){r=Tt(i,"Accueil")},m(i,t){o(i,r,t)},d(i){i&&s(r)}}}function Hi(_){let r;return{c(){r=Rt("Explorateur d'Actions")},l(i){r=Tt(i,"Explorateur d'Actions")},m(i,t){o(i,r,t)},d(i){i&&s(r)}}}function hi(_){let r;return{c(){r=Rt("Analyse Sectorielle")},l(i){r=Tt(i,"Analyse Sectorielle")},m(i,t){o(i,r,t)},d(i){i&&s(r)}}}function Fi(_){let r;return{c(){r=Rt("Analyse Geographique")},l(i){r=Tt(i,"Analyse Geographique")},m(i,t){o(i,r,t)},d(i){i&&s(r)}}}function Mi(_){let r;return{c(){r=Rt("Croissance & Rentabilite")},l(i){r=Tt(i,"Croissance & Rentabilite")},m(i,t){o(i,r,t)},d(i){i&&s(r)}}}function Si(_){let r,i,t,f,m,l,v="← Retour Market Watch",h,d,L='<a href="#lab-de-valorisation">Lab de Valorisation</a>',E,S,I,Y,P,V,A,U,M,H,x,F,p,R,C,Q,a,T,ne,Ne='<a href="#distributions-statistiques">Distributions Statistiques</a>',Ee,me,qt='<a href="#distribution-du-pe-forward">Distribution du P/E Forward</a>',at,Ye,se,De,pe,xt='<a href="#distribution-du-dividend-yield">Distribution du Dividend Yield</a>',lt,Ue,oe,He,ue,Et='<a href="#distribution-du-price-to-book">Distribution du Price-to-Book</a>',nt,Ve,_e,he,Le,st,we,Dt='<a href="#analyse-sectorielle-des-multiples">Analyse Sectorielle des Multiples</a>',Fe,ae,ot='<a href="#pe-forward-par-secteur-boxplot">P/E Forward par Secteur (BoxPlot)</a>',_t,je,Me,Se,le,dt='<a href="#dividend-yield-par-region-boxplot">Dividend Yield par Region (BoxPlot)</a>',ft,Ge,Ce,Ie,ye,Oe,ge,Ht='<a href="#cartographie-valorisation-vs-rendement">Cartographie Valorisation vs Rendement</a>',mt,ve,de,Qe,We,pt,ke,ze='<a href="#classements">Classements</a>',Pe,ce,ht='<a href="#top-20-rendements-en-dividende">Top 20 Rendements en Dividende</a>',ut,Xe,fe,Ae,$e,Ft='<a href="#top-20-pe-les-plus-bas-actions-sous-evaluees">Top 20 P/E les Plus Bas (actions sous-evaluees)</a>',ct,Ke,D,Mt,Ct,Bt,Je,ir='<a href="#tableau-complet-de-valorisation">Tableau Complet de Valorisation</a>',Nt,St,$t,Yt,It,Ut,Ze,ar='<a href="#screener-interactif">Screener Interactif</a>',Vt,bt,jt,Pt,Gt,vt,Ot,wt,Qt,yt,zt,gt,Xt,kt,Kt,et=typeof O<"u"&&O.title&&O.hide_title!==!0&&ci();function Or(e,n){return typeof O<"u"&&O.title?bi:$i}let At=Or()(_),tt=typeof O=="object"&&vi();S=new oi({props:{status:"info",$$slots:{default:[gi]},$$scope:{ctx:_}}});let z=_[0]&&Fr(_);P=new rt({props:{data:_[0],value:"nb_stocks",title:"Actions analysees"}}),A=new rt({props:{data:_[0],value:"avg_pe_forward",title:"P/E Forward Moy."}}),M=new rt({props:{data:_[0],value:"avg_pe_trailing",title:"P/E Trailing Moy."}}),x=new rt({props:{data:_[0],value:"avg_ptb",title:"Price/Book Moy."}}),p=new rt({props:{data:_[0],value:"avg_div_yield",title:"Div Yield Moy. (%)"}}),C=new rt({props:{data:_[0],value:"avg_roe",title:"ROE Moy. (%)"}});let X=_[1]&&Mr(_);se=new rr({props:{data:_[1],x:"pe_forward",xAxisTitle:"P/E Forward",title:"Distribution du P/E Forward"}});let K=_[2]&&Sr(_);oe=new rr({props:{data:_[2],x:"dividend_yield",xAxisTitle:"Dividend Yield (%)",title:"Distribution du Rendement en Dividende"}});let W=_[3]&&Cr(_);_e=new rr({props:{data:_[3],x:"price_to_book",xAxisTitle:"Price-to-Book",title:"Distribution du Price-to-Book"}});let J=_[4]&&Ir(_);Me=new hr({props:{data:_[4],name:"name",min:"min",intervalBottom:"q1",midpoint:"median",intervalTop:"q3",max:"max",title:"P/E Forward par Secteur",yAxisTitle:"P/E Forward",swapXY:"true"}});let Z=_[5]&&Pr(_);Ce=new hr({props:{data:_[5],name:"name",min:"min",intervalBottom:"q1",midpoint:"median",intervalTop:"q3",max:"max",title:"Dividend Yield par Region",yAxisTitle:"Dividend Yield (%)",swapXY:"true"}});let ee=_[6]&&Ar(_);de=new Gr({props:{data:_[6],x:"pe_forward",y:"dividend_yield",size:"market_cap",series:"sector",xAxisTitle:"P/E Forward",yAxisTitle:"Dividend Yield (%)",title:"P/E Forward vs Rendement en Dividende (taille = capitalisation)",tooltipTitle:"symbol"}});let te=_[7]&&Lr(_);fe=new Hr({props:{data:_[7],x:"symbol",y:"dividend_yield",xAxisTitle:"Ticker",yAxisTitle:"Dividend Yield (%)",title:"Top 20 Dividend Yields",sort:"false"}});let re=_[8]&&Br(_);D=new Hr({props:{data:_[8],x:"symbol",y:"pe_forward",xAxisTitle:"Ticker",yAxisTitle:"P/E Forward",title:"Top 20 - P/E Forward les Plus Bas",sort:"false"}});let ie=_[9]&&Nr(_);return $t=new jr({props:{data:_[9],search:"true",rows:"25",$$slots:{default:[ki]},$$scope:{ctx:_}}}),bt=new _i({props:{$$slots:{default:[Ei]},$$scope:{ctx:_}}}),vt=new Lt({props:{url:"/",$$slots:{default:[Di]},$$scope:{ctx:_}}}),wt=new Lt({props:{url:"/explorer",$$slots:{default:[Hi]},$$scope:{ctx:_}}}),yt=new Lt({props:{url:"/sectors",$$slots:{default:[hi]},$$scope:{ctx:_}}}),gt=new Lt({props:{url:"/regions",$$slots:{default:[Fi]},$$scope:{ctx:_}}}),kt=new Lt({props:{url:"/earnings",$$slots:{default:[Mi]},$$scope:{ctx:_}}}),{c(){et&&et.c(),r=b(),At.c(),i=N("meta"),t=N("meta"),tt&&tt.c(),f=Zt(),m=b(),l=N("a"),l.textContent=v,h=b(),d=N("h1"),d.innerHTML=L,E=b(),k(S.$$.fragment),I=b(),z&&z.c(),Y=b(),k(P.$$.fragment),V=b(),k(A.$$.fragment),U=b(),k(M.$$.fragment),H=b(),k(x.$$.fragment),F=b(),k(p.$$.fragment),R=b(),k(C.$$.fragment),Q=b(),a=N("hr"),T=b(),ne=N("h2"),ne.innerHTML=Ne,Ee=b(),me=N("h3"),me.innerHTML=qt,at=b(),X&&X.c(),Ye=b(),k(se.$$.fragment),De=b(),pe=N("h3"),pe.innerHTML=xt,lt=b(),K&&K.c(),Ue=b(),k(oe.$$.fragment),He=b(),ue=N("h3"),ue.innerHTML=Et,nt=b(),W&&W.c(),Ve=b(),k(_e.$$.fragment),he=b(),Le=N("hr"),st=b(),we=N("h2"),we.innerHTML=Dt,Fe=b(),ae=N("h3"),ae.innerHTML=ot,_t=b(),J&&J.c(),je=b(),k(Me.$$.fragment),Se=b(),le=N("h3"),le.innerHTML=dt,ft=b(),Z&&Z.c(),Ge=b(),k(Ce.$$.fragment),Ie=b(),ye=N("hr"),Oe=b(),ge=N("h2"),ge.innerHTML=Ht,mt=b(),ee&&ee.c(),ve=b(),k(de.$$.fragment),Qe=b(),We=N("hr"),pt=b(),ke=N("h2"),ke.innerHTML=ze,Pe=b(),ce=N("h3"),ce.innerHTML=ht,ut=b(),te&&te.c(),Xe=b(),k(fe.$$.fragment),Ae=b(),$e=N("h3"),$e.innerHTML=Ft,ct=b(),re&&re.c(),Ke=b(),k(D.$$.fragment),Mt=b(),Ct=N("hr"),Bt=b(),Je=N("h2"),Je.innerHTML=ir,Nt=b(),ie&&ie.c(),St=b(),k($t.$$.fragment),Yt=b(),It=N("hr"),Ut=b(),Ze=N("h2"),Ze.innerHTML=ar,Vt=b(),k(bt.$$.fragment),jt=b(),Pt=N("hr"),Gt=b(),k(vt.$$.fragment),Ot=b(),k(wt.$$.fragment),Qt=b(),k(yt.$$.fragment),zt=b(),k(gt.$$.fragment),Xt=b(),k(kt.$$.fragment),this.h()},l(e){et&&et.l(e),r=$(e);const n=zr("svelte-2igo1p",document.head);At.l(n),i=B(n,"META",{name:!0,content:!0}),t=B(n,"META",{name:!0,content:!0}),tt&&tt.l(n),f=Zt(),n.forEach(s),m=$(e),l=B(e,"A",{href:!0,style:!0,"data-svelte-h":!0}),be(l)!=="svelte-80akn7"&&(l.textContent=v),h=$(e),d=B(e,"H1",{class:!0,id:!0,"data-svelte-h":!0}),be(d)!=="svelte-zsjr9d"&&(d.innerHTML=L),E=$(e),g(S.$$.fragment,e),I=$(e),z&&z.l(e),Y=$(e),g(P.$$.fragment,e),V=$(e),g(A.$$.fragment,e),U=$(e),g(M.$$.fragment,e),H=$(e),g(x.$$.fragment,e),F=$(e),g(p.$$.fragment,e),R=$(e),g(C.$$.fragment,e),Q=$(e),a=B(e,"HR",{class:!0}),T=$(e),ne=B(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),be(ne)!=="svelte-1qb4q26"&&(ne.innerHTML=Ne),Ee=$(e),me=B(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),be(me)!=="svelte-18klvr6"&&(me.innerHTML=qt),at=$(e),X&&X.l(e),Ye=$(e),g(se.$$.fragment,e),De=$(e),pe=B(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),be(pe)!=="svelte-cqr107"&&(pe.innerHTML=xt),lt=$(e),K&&K.l(e),Ue=$(e),g(oe.$$.fragment,e),He=$(e),ue=B(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),be(ue)!=="svelte-wu3tya"&&(ue.innerHTML=Et),nt=$(e),W&&W.l(e),Ve=$(e),g(_e.$$.fragment,e),he=$(e),Le=B(e,"HR",{class:!0}),st=$(e),we=B(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),be(we)!=="svelte-1l59d7n"&&(we.innerHTML=Dt),Fe=$(e),ae=B(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),be(ae)!=="svelte-16qx6a4"&&(ae.innerHTML=ot),_t=$(e),J&&J.l(e),je=$(e),g(Me.$$.fragment,e),Se=$(e),le=B(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),be(le)!=="svelte-ryya8y"&&(le.innerHTML=dt),ft=$(e),Z&&Z.l(e),Ge=$(e),g(Ce.$$.fragment,e),Ie=$(e),ye=B(e,"HR",{class:!0}),Oe=$(e),ge=B(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),be(ge)!=="svelte-18e39vj"&&(ge.innerHTML=Ht),mt=$(e),ee&&ee.l(e),ve=$(e),g(de.$$.fragment,e),Qe=$(e),We=B(e,"HR",{class:!0}),pt=$(e),ke=B(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),be(ke)!=="svelte-11sttjo"&&(ke.innerHTML=ze),Pe=$(e),ce=B(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),be(ce)!=="svelte-1274tjh"&&(ce.innerHTML=ht),ut=$(e),te&&te.l(e),Xe=$(e),g(fe.$$.fragment,e),Ae=$(e),$e=B(e,"H3",{class:!0,id:!0,"data-svelte-h":!0}),be($e)!=="svelte-oli21q"&&($e.innerHTML=Ft),ct=$(e),re&&re.l(e),Ke=$(e),g(D.$$.fragment,e),Mt=$(e),Ct=B(e,"HR",{class:!0}),Bt=$(e),Je=B(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),be(Je)!=="svelte-mat9dy"&&(Je.innerHTML=ir),Nt=$(e),ie&&ie.l(e),St=$(e),g($t.$$.fragment,e),Yt=$(e),It=B(e,"HR",{class:!0}),Ut=$(e),Ze=B(e,"H2",{class:!0,id:!0,"data-svelte-h":!0}),be(Ze)!=="svelte-p580wq"&&(Ze.innerHTML=ar),Vt=$(e),g(bt.$$.fragment,e),jt=$(e),Pt=B(e,"HR",{class:!0}),Gt=$(e),g(vt.$$.fragment,e),Ot=$(e),g(wt.$$.fragment,e),Qt=$(e),g(yt.$$.fragment,e),zt=$(e),g(gt.$$.fragment,e),Xt=$(e),g(kt.$$.fragment,e),this.h()},h(){q(i,"name","twitter:card"),q(i,"content","summary_large_image"),q(t,"name","twitter:site"),q(t,"content","@evidence_dev"),q(l,"href","/lab/"),Be(l,"display","inline-flex"),Be(l,"align-items","center"),Be(l,"gap","6px"),Be(l,"padding","6px 14px"),Be(l,"background","#f1f5f9"),Be(l,"border","1px solid #e2e8f0"),Be(l,"border-radius","8px"),Be(l,"color","#475569"),Be(l,"text-decoration","none"),Be(l,"font-size","0.85rem"),Be(l,"margin-bottom","1rem"),q(d,"class","markdown"),q(d,"id","lab-de-valorisation"),q(a,"class","markdown"),q(ne,"class","markdown"),q(ne,"id","distributions-statistiques"),q(me,"class","markdown"),q(me,"id","distribution-du-pe-forward"),q(pe,"class","markdown"),q(pe,"id","distribution-du-dividend-yield"),q(ue,"class","markdown"),q(ue,"id","distribution-du-price-to-book"),q(Le,"class","markdown"),q(we,"class","markdown"),q(we,"id","analyse-sectorielle-des-multiples"),q(ae,"class","markdown"),q(ae,"id","pe-forward-par-secteur-boxplot"),q(le,"class","markdown"),q(le,"id","dividend-yield-par-region-boxplot"),q(ye,"class","markdown"),q(ge,"class","markdown"),q(ge,"id","cartographie-valorisation-vs-rendement"),q(We,"class","markdown"),q(ke,"class","markdown"),q(ke,"id","classements"),q(ce,"class","markdown"),q(ce,"id","top-20-rendements-en-dividende"),q($e,"class","markdown"),q($e,"id","top-20-pe-les-plus-bas-actions-sous-evaluees"),q(Ct,"class","markdown"),q(Je,"class","markdown"),q(Je,"id","tableau-complet-de-valorisation"),q(It,"class","markdown"),q(Ze,"class","markdown"),q(Ze,"id","screener-interactif"),q(Pt,"class","markdown")},m(e,n){et&&et.m(e,n),o(e,r,n),At.m(document.head,null),Jt(document.head,i),Jt(document.head,t),tt&&tt.m(document.head,null),Jt(document.head,f),o(e,m,n),o(e,l,n),o(e,h,n),o(e,d,n),o(e,E,n),y(S,e,n),o(e,I,n),z&&z.m(e,n),o(e,Y,n),y(P,e,n),o(e,V,n),y(A,e,n),o(e,U,n),y(M,e,n),o(e,H,n),y(x,e,n),o(e,F,n),y(p,e,n),o(e,R,n),y(C,e,n),o(e,Q,n),o(e,a,n),o(e,T,n),o(e,ne,n),o(e,Ee,n),o(e,me,n),o(e,at,n),X&&X.m(e,n),o(e,Ye,n),y(se,e,n),o(e,De,n),o(e,pe,n),o(e,lt,n),K&&K.m(e,n),o(e,Ue,n),y(oe,e,n),o(e,He,n),o(e,ue,n),o(e,nt,n),W&&W.m(e,n),o(e,Ve,n),y(_e,e,n),o(e,he,n),o(e,Le,n),o(e,st,n),o(e,we,n),o(e,Fe,n),o(e,ae,n),o(e,_t,n),J&&J.m(e,n),o(e,je,n),y(Me,e,n),o(e,Se,n),o(e,le,n),o(e,ft,n),Z&&Z.m(e,n),o(e,Ge,n),y(Ce,e,n),o(e,Ie,n),o(e,ye,n),o(e,Oe,n),o(e,ge,n),o(e,mt,n),ee&&ee.m(e,n),o(e,ve,n),y(de,e,n),o(e,Qe,n),o(e,We,n),o(e,pt,n),o(e,ke,n),o(e,Pe,n),o(e,ce,n),o(e,ut,n),te&&te.m(e,n),o(e,Xe,n),y(fe,e,n),o(e,Ae,n),o(e,$e,n),o(e,ct,n),re&&re.m(e,n),o(e,Ke,n),y(D,e,n),o(e,Mt,n),o(e,Ct,n),o(e,Bt,n),o(e,Je,n),o(e,Nt,n),ie&&ie.m(e,n),o(e,St,n),y($t,e,n),o(e,Yt,n),o(e,It,n),o(e,Ut,n),o(e,Ze,n),o(e,Vt,n),y(bt,e,n),o(e,jt,n),o(e,Pt,n),o(e,Gt,n),y(vt,e,n),o(e,Ot,n),y(wt,e,n),o(e,Qt,n),y(yt,e,n),o(e,zt,n),y(gt,e,n),o(e,Xt,n),y(kt,e,n),Kt=!0},p(e,n){typeof O<"u"&&O.title&&O.hide_title!==!0&&et.p(e,n),At.p(e,n),typeof O=="object"&&tt.p(e,n);const lr={};n[2]&268435456&&(lr.$$scope={dirty:n,ctx:e}),S.$set(lr),e[0]?z?(z.p(e,n),n[0]&1&&u(z,1)):(z=Fr(e),z.c(),u(z,1),z.m(Y.parentNode,Y)):z&&(qe(),c(z,1,1,()=>{z=null}),Re());const nr={};n[0]&1&&(nr.data=e[0]),P.$set(nr);const sr={};n[0]&1&&(sr.data=e[0]),A.$set(sr);const or={};n[0]&1&&(or.data=e[0]),M.$set(or);const _r={};n[0]&1&&(_r.data=e[0]),x.$set(_r);const dr={};n[0]&1&&(dr.data=e[0]),p.$set(dr);const fr={};n[0]&1&&(fr.data=e[0]),C.$set(fr),e[1]?X?(X.p(e,n),n[0]&2&&u(X,1)):(X=Mr(e),X.c(),u(X,1),X.m(Ye.parentNode,Ye)):X&&(qe(),c(X,1,1,()=>{X=null}),Re());const mr={};n[0]&2&&(mr.data=e[1]),se.$set(mr),e[2]?K?(K.p(e,n),n[0]&4&&u(K,1)):(K=Sr(e),K.c(),u(K,1),K.m(Ue.parentNode,Ue)):K&&(qe(),c(K,1,1,()=>{K=null}),Re());const pr={};n[0]&4&&(pr.data=e[2]),oe.$set(pr),e[3]?W?(W.p(e,n),n[0]&8&&u(W,1)):(W=Cr(e),W.c(),u(W,1),W.m(Ve.parentNode,Ve)):W&&(qe(),c(W,1,1,()=>{W=null}),Re());const ur={};n[0]&8&&(ur.data=e[3]),_e.$set(ur),e[4]?J?(J.p(e,n),n[0]&16&&u(J,1)):(J=Ir(e),J.c(),u(J,1),J.m(je.parentNode,je)):J&&(qe(),c(J,1,1,()=>{J=null}),Re());const cr={};n[0]&16&&(cr.data=e[4]),Me.$set(cr),e[5]?Z?(Z.p(e,n),n[0]&32&&u(Z,1)):(Z=Pr(e),Z.c(),u(Z,1),Z.m(Ge.parentNode,Ge)):Z&&(qe(),c(Z,1,1,()=>{Z=null}),Re());const $r={};n[0]&32&&($r.data=e[5]),Ce.$set($r),e[6]?ee?(ee.p(e,n),n[0]&64&&u(ee,1)):(ee=Ar(e),ee.c(),u(ee,1),ee.m(ve.parentNode,ve)):ee&&(qe(),c(ee,1,1,()=>{ee=null}),Re());const br={};n[0]&64&&(br.data=e[6]),de.$set(br),e[7]?te?(te.p(e,n),n[0]&128&&u(te,1)):(te=Lr(e),te.c(),u(te,1),te.m(Xe.parentNode,Xe)):te&&(qe(),c(te,1,1,()=>{te=null}),Re());const vr={};n[0]&128&&(vr.data=e[7]),fe.$set(vr),e[8]?re?(re.p(e,n),n[0]&256&&u(re,1)):(re=Br(e),re.c(),u(re,1),re.m(Ke.parentNode,Ke)):re&&(qe(),c(re,1,1,()=>{re=null}),Re());const wr={};n[0]&256&&(wr.data=e[8]),D.$set(wr),e[9]?ie?(ie.p(e,n),n[0]&512&&u(ie,1)):(ie=Nr(e),ie.c(),u(ie,1),ie.m(St.parentNode,St)):ie&&(qe(),c(ie,1,1,()=>{ie=null}),Re());const er={};n[0]&512&&(er.data=e[9]),n[2]&268435456&&(er.$$scope={dirty:n,ctx:e}),$t.$set(er);const yr={};n[0]&7168|n[2]&268435456&&(yr.$$scope={dirty:n,ctx:e}),bt.$set(yr);const gr={};n[2]&268435456&&(gr.$$scope={dirty:n,ctx:e}),vt.$set(gr);const kr={};n[2]&268435456&&(kr.$$scope={dirty:n,ctx:e}),wt.$set(kr);const Tr={};n[2]&268435456&&(Tr.$$scope={dirty:n,ctx:e}),yt.$set(Tr);const Rr={};n[2]&268435456&&(Rr.$$scope={dirty:n,ctx:e}),gt.$set(Rr);const qr={};n[2]&268435456&&(qr.$$scope={dirty:n,ctx:e}),kt.$set(qr)},i(e){Kt||(u(S.$$.fragment,e),u(z),u(P.$$.fragment,e),u(A.$$.fragment,e),u(M.$$.fragment,e),u(x.$$.fragment,e),u(p.$$.fragment,e),u(C.$$.fragment,e),u(X),u(se.$$.fragment,e),u(K),u(oe.$$.fragment,e),u(W),u(_e.$$.fragment,e),u(J),u(Me.$$.fragment,e),u(Z),u(Ce.$$.fragment,e),u(ee),u(de.$$.fragment,e),u(te),u(fe.$$.fragment,e),u(re),u(D.$$.fragment,e),u(ie),u($t.$$.fragment,e),u(bt.$$.fragment,e),u(vt.$$.fragment,e),u(wt.$$.fragment,e),u(yt.$$.fragment,e),u(gt.$$.fragment,e),u(kt.$$.fragment,e),Kt=!0)},o(e){c(S.$$.fragment,e),c(z),c(P.$$.fragment,e),c(A.$$.fragment,e),c(M.$$.fragment,e),c(x.$$.fragment,e),c(p.$$.fragment,e),c(C.$$.fragment,e),c(X),c(se.$$.fragment,e),c(K),c(oe.$$.fragment,e),c(W),c(_e.$$.fragment,e),c(J),c(Me.$$.fragment,e),c(Z),c(Ce.$$.fragment,e),c(ee),c(de.$$.fragment,e),c(te),c(fe.$$.fragment,e),c(re),c(D.$$.fragment,e),c(ie),c($t.$$.fragment,e),c(bt.$$.fragment,e),c(vt.$$.fragment,e),c(wt.$$.fragment,e),c(yt.$$.fragment,e),c(gt.$$.fragment,e),c(kt.$$.fragment,e),Kt=!1},d(e){e&&(s(r),s(m),s(l),s(h),s(d),s(E),s(I),s(Y),s(V),s(U),s(H),s(F),s(R),s(Q),s(a),s(T),s(ne),s(Ee),s(me),s(at),s(Ye),s(De),s(pe),s(lt),s(Ue),s(He),s(ue),s(nt),s(Ve),s(he),s(Le),s(st),s(we),s(Fe),s(ae),s(_t),s(je),s(Se),s(le),s(ft),s(Ge),s(Ie),s(ye),s(Oe),s(ge),s(mt),s(ve),s(Qe),s(We),s(pt),s(ke),s(Pe),s(ce),s(ut),s(Xe),s(Ae),s($e),s(ct),s(Ke),s(Mt),s(Ct),s(Bt),s(Je),s(Nt),s(St),s(Yt),s(It),s(Ut),s(Ze),s(Vt),s(jt),s(Pt),s(Gt),s(Ot),s(Qt),s(zt),s(Xt)),et&&et.d(e),At.d(e),s(i),s(t),tt&&tt.d(e),s(f),w(S,e),z&&z.d(e),w(P,e),w(A,e),w(M,e),w(x,e),w(p,e),w(C,e),X&&X.d(e),w(se,e),K&&K.d(e),w(oe,e),W&&W.d(e),w(_e,e),J&&J.d(e),w(Me,e),Z&&Z.d(e),w(Ce,e),ee&&ee.d(e),w(de,e),te&&te.d(e),w(fe,e),re&&re.d(e),w(D,e),ie&&ie.d(e),w($t,e),w(bt,e),w(vt,e),w(wt,e),w(yt,e),w(gt,e),w(kt,e)}}}const O={title:"Valorisations",description:"Analyse des multiples de valorisation, dividendes et metriques fondamentales"};function Ci(_,r,i){let t,f;xr(_,mi,D=>i(68,t=D)),xr(_,Dr,D=>i(73,f=D));let{data:m}=r,{data:l={},customFormattingSettings:v,__db:h,inputs:d}=m;Xr(Dr,f="e8f34ab78181126b95363642c0b4c958",f);let L=ri(si(d));Kr(L.subscribe(D=>i(15,d=D))),Wr(ni,{getCustomFormats:()=>v.customFormats||[]});const E=(D,Mt)=>fi(h.query,D,{query_name:Mt});ii(E),t.params,Jr(()=>!0);let S={initialData:void 0,initialError:void 0},I=j`select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where pe_forward is not null and pe_forward > 0`,Y=`select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where pe_forward is not null and pe_forward > 0`;l.val_summary_static_data&&(l.val_summary_static_data instanceof Error?S.initialError=l.val_summary_static_data:S.initialData=l.val_summary_static_data,l.val_summary_static_columns&&(S.knownColumns=l.val_summary_static_columns));let P,V=!1;const A=Te.createReactive({callback:D=>{i(0,P=D)},execFn:E},{id:"val_summary_static",...S});A(Y,{noResolve:I,...S}),globalThis[Symbol.for("val_summary_static")]={get value(){return P}};let U={initialData:void 0,initialError:void 0},M=j`select
    pe_forward
from market.stocks
where pe_forward > 0 and pe_forward < 200`,H=`select
    pe_forward
from market.stocks
where pe_forward > 0 and pe_forward < 200`;l.hist_pe_forward_data&&(l.hist_pe_forward_data instanceof Error?U.initialError=l.hist_pe_forward_data:U.initialData=l.hist_pe_forward_data,l.hist_pe_forward_columns&&(U.knownColumns=l.hist_pe_forward_columns));let x,F=!1;const p=Te.createReactive({callback:D=>{i(1,x=D)},execFn:E},{id:"hist_pe_forward",...U});p(H,{noResolve:M,...U}),globalThis[Symbol.for("hist_pe_forward")]={get value(){return x}};let R={initialData:void 0,initialError:void 0},C=j`select
    dividend_yield
from market.stocks
where dividend_yield is not null and dividend_yield > 0`,Q=`select
    dividend_yield
from market.stocks
where dividend_yield is not null and dividend_yield > 0`;l.hist_div_yield_data&&(l.hist_div_yield_data instanceof Error?R.initialError=l.hist_div_yield_data:R.initialData=l.hist_div_yield_data,l.hist_div_yield_columns&&(R.knownColumns=l.hist_div_yield_columns));let a,T=!1;const ne=Te.createReactive({callback:D=>{i(2,a=D)},execFn:E},{id:"hist_div_yield",...R});ne(Q,{noResolve:C,...R}),globalThis[Symbol.for("hist_div_yield")]={get value(){return a}};let Ne={initialData:void 0,initialError:void 0},Ee=j`select
    price_to_book
from market.stocks
where price_to_book > 0 and price_to_book < 50`,me=`select
    price_to_book
from market.stocks
where price_to_book > 0 and price_to_book < 50`;l.hist_ptb_data&&(l.hist_ptb_data instanceof Error?Ne.initialError=l.hist_ptb_data:Ne.initialData=l.hist_ptb_data,l.hist_ptb_columns&&(Ne.knownColumns=l.hist_ptb_columns));let qt,at=!1;const Ye=Te.createReactive({callback:D=>{i(3,qt=D)},execFn:E},{id:"hist_ptb",...Ne});Ye(me,{noResolve:Ee,...Ne}),globalThis[Symbol.for("hist_ptb")]={get value(){return qt}};let se={initialData:void 0,initialError:void 0},De=j`select
    sector as name,
    min(pe_forward) as min,
    percentile_cont(0.25) within group (order by pe_forward) as q1,
    median(pe_forward) as median,
    percentile_cont(0.75) within group (order by pe_forward) as q3,
    max(pe_forward) as max
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector`,pe=`select
    sector as name,
    min(pe_forward) as min,
    percentile_cont(0.25) within group (order by pe_forward) as q1,
    median(pe_forward) as median,
    percentile_cont(0.75) within group (order by pe_forward) as q3,
    max(pe_forward) as max
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector`;l.boxplot_pe_sector_data&&(l.boxplot_pe_sector_data instanceof Error?se.initialError=l.boxplot_pe_sector_data:se.initialData=l.boxplot_pe_sector_data,l.boxplot_pe_sector_columns&&(se.knownColumns=l.boxplot_pe_sector_columns));let xt,lt=!1;const Ue=Te.createReactive({callback:D=>{i(4,xt=D)},execFn:E},{id:"boxplot_pe_sector",...se});Ue(pe,{noResolve:De,...se}),globalThis[Symbol.for("boxplot_pe_sector")]={get value(){return xt}};let oe={initialData:void 0,initialError:void 0},He=j`select
    region as name,
    min(dividend_yield) as min,
    percentile_cont(0.25) within group (order by dividend_yield) as q1,
    median(dividend_yield) as median,
    percentile_cont(0.75) within group (order by dividend_yield) as q3,
    max(dividend_yield) as max
from market.stocks
where dividend_yield is not null and dividend_yield > 0
group by region`,ue=`select
    region as name,
    min(dividend_yield) as min,
    percentile_cont(0.25) within group (order by dividend_yield) as q1,
    median(dividend_yield) as median,
    percentile_cont(0.75) within group (order by dividend_yield) as q3,
    max(dividend_yield) as max
from market.stocks
where dividend_yield is not null and dividend_yield > 0
group by region`;l.boxplot_div_region_data&&(l.boxplot_div_region_data instanceof Error?oe.initialError=l.boxplot_div_region_data:oe.initialData=l.boxplot_div_region_data,l.boxplot_div_region_columns&&(oe.knownColumns=l.boxplot_div_region_columns));let Et,nt=!1;const Ve=Te.createReactive({callback:D=>{i(5,Et=D)},execFn:E},{id:"boxplot_div_region",...oe});Ve(ue,{noResolve:He,...oe}),globalThis[Symbol.for("boxplot_div_region")]={get value(){return Et}};let _e={initialData:void 0,initialError:void 0},he=j`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null`,Le=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null`;l.bubble_pe_div_data&&(l.bubble_pe_div_data instanceof Error?_e.initialError=l.bubble_pe_div_data:_e.initialData=l.bubble_pe_div_data,l.bubble_pe_div_columns&&(_e.knownColumns=l.bubble_pe_div_columns));let st,we=!1;const Dt=Te.createReactive({callback:D=>{i(6,st=D)},execFn:E},{id:"bubble_pe_div",..._e});Dt(Le,{noResolve:he,..._e}),globalThis[Symbol.for("bubble_pe_div")]={get value(){return st}};let Fe={initialData:void 0,initialError:void 0},ae=j`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 20`,ot=`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 20`;l.top20_dividends_static_data&&(l.top20_dividends_static_data instanceof Error?Fe.initialError=l.top20_dividends_static_data:Fe.initialData=l.top20_dividends_static_data,l.top20_dividends_static_columns&&(Fe.knownColumns=l.top20_dividends_static_columns));let _t,je=!1;const Me=Te.createReactive({callback:D=>{i(7,_t=D)},execFn:E},{id:"top20_dividends_static",...Fe});Me(ot,{noResolve:ae,...Fe}),globalThis[Symbol.for("top20_dividends_static")]={get value(){return _t}};let Se={initialData:void 0,initialError:void 0},le=j`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    price_to_book,
    market_cap,
    sector,
    recommendation
from market.stocks
where pe_forward > 0
order by pe_forward asc
limit 20`,dt=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    price_to_book,
    market_cap,
    sector,
    recommendation
from market.stocks
where pe_forward > 0
order by pe_forward asc
limit 20`;l.top20_cheapest_pe_static_data&&(l.top20_cheapest_pe_static_data instanceof Error?Se.initialError=l.top20_cheapest_pe_static_data:Se.initialData=l.top20_cheapest_pe_static_data,l.top20_cheapest_pe_static_columns&&(Se.knownColumns=l.top20_cheapest_pe_static_columns));let ft,Ge=!1;const Ce=Te.createReactive({callback:D=>{i(8,ft=D)},execFn:E},{id:"top20_cheapest_pe_static",...Se});Ce(dt,{noResolve:le,...Se}),globalThis[Symbol.for("top20_cheapest_pe_static")]={get value(){return ft}};let Ie={initialData:void 0,initialError:void 0},ye=j`select
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
    region,
    country
from market.stocks
order by pe_forward asc nulls last`,Oe=`select
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
    region,
    country
from market.stocks
order by pe_forward asc nulls last`;l.valuation_table_static_data&&(l.valuation_table_static_data instanceof Error?Ie.initialError=l.valuation_table_static_data:Ie.initialData=l.valuation_table_static_data,l.valuation_table_static_columns&&(Ie.knownColumns=l.valuation_table_static_columns));let ge,Ht=!1;const mt=Te.createReactive({callback:D=>{i(9,ge=D)},execFn:E},{id:"valuation_table_static",...Ie});mt(Oe,{noResolve:ye,...Ie}),globalThis[Symbol.for("valuation_table_static")]={get value(){return ge}};let ve={initialData:void 0,initialError:void 0},de=j`select
    symbol,
    name,
    price,
    pe_forward,
    pe_trailing,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    market_cap,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )
order by pe_forward asc`,Qe=`select
    symbol,
    name,
    price,
    pe_forward,
    pe_trailing,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    market_cap,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )
order by pe_forward asc`;l.screener_results_data&&(l.screener_results_data instanceof Error?ve.initialError=l.screener_results_data:ve.initialData=l.screener_results_data,l.screener_results_columns&&(ve.knownColumns=l.screener_results_columns));let We,pt=!1;const ke=Te.createReactive({callback:D=>{i(10,We=D)},execFn:E},{id:"screener_results",...ve});ke(Qe,{noResolve:de,...ve}),globalThis[Symbol.for("screener_results")]={get value(){return We}};let ze={initialData:void 0,initialError:void 0},Pe=j`select
    count(*) as nb_matches,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )`,ce=`select
    count(*) as nb_matches,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )`;l.screener_stats_data&&(l.screener_stats_data instanceof Error?ze.initialError=l.screener_stats_data:ze.initialData=l.screener_stats_data,l.screener_stats_columns&&(ze.knownColumns=l.screener_stats_columns));let ht,ut=!1;const Xe=Te.createReactive({callback:D=>{i(11,ht=D)},execFn:E},{id:"screener_stats",...ze});Xe(ce,{noResolve:Pe,...ze}),globalThis[Symbol.for("screener_stats")]={get value(){return ht}};let fe={initialData:void 0,initialError:void 0},Ae=j`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and pe_forward < 200
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and dividend_yield is not null
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )`,$e=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and pe_forward < 200
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and dividend_yield is not null
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )`;l.screener_bubble_data&&(l.screener_bubble_data instanceof Error?fe.initialError=l.screener_bubble_data:fe.initialData=l.screener_bubble_data,l.screener_bubble_columns&&(fe.knownColumns=l.screener_bubble_columns));let Ft,ct=!1;const Ke=Te.createReactive({callback:D=>{i(12,Ft=D)},execFn:E},{id:"screener_bubble",...fe});return Ke($e,{noResolve:Ae,...fe}),globalThis[Symbol.for("screener_bubble")]={get value(){return Ft}},_.$$set=D=>{"data"in D&&i(13,m=D.data)},_.$$.update=()=>{_.$$.dirty[0]&8192&&i(14,{data:l={},customFormattingSettings:v,__db:h}=m,l),_.$$.dirty[0]&16384&&ai.set(Object.keys(l).length>0),_.$$.dirty[2]&64&&t.params,_.$$.dirty[0]&983040&&(I||!V?I||(A(Y,{noResolve:I,...S}),i(19,V=!0)):A(Y,{noResolve:I})),_.$$.dirty[0]&15728640&&(M||!F?M||(p(H,{noResolve:M,...U}),i(23,F=!0)):p(H,{noResolve:M})),_.$$.dirty[0]&251658240&&(C||!T?C||(ne(Q,{noResolve:C,...R}),i(27,T=!0)):ne(Q,{noResolve:C})),_.$$.dirty[0]&1879048192|_.$$.dirty[1]&1&&(Ee||!at?Ee||(Ye(me,{noResolve:Ee,...Ne}),i(31,at=!0)):Ye(me,{noResolve:Ee})),_.$$.dirty[1]&30&&(De||!lt?De||(Ue(pe,{noResolve:De,...se}),i(35,lt=!0)):Ue(pe,{noResolve:De})),_.$$.dirty[1]&480&&(He||!nt?He||(Ve(ue,{noResolve:He,...oe}),i(39,nt=!0)):Ve(ue,{noResolve:He})),_.$$.dirty[1]&7680&&(he||!we?he||(Dt(Le,{noResolve:he,..._e}),i(43,we=!0)):Dt(Le,{noResolve:he})),_.$$.dirty[1]&122880&&(ae||!je?ae||(Me(ot,{noResolve:ae,...Fe}),i(47,je=!0)):Me(ot,{noResolve:ae})),_.$$.dirty[1]&1966080&&(le||!Ge?le||(Ce(dt,{noResolve:le,...Se}),i(51,Ge=!0)):Ce(dt,{noResolve:le})),_.$$.dirty[1]&31457280&&(ye||!Ht?ye||(mt(Oe,{noResolve:ye,...Ie}),i(55,Ht=!0)):mt(Oe,{noResolve:ye})),_.$$.dirty[0]&32768&&i(57,de=j`select
    symbol,
    name,
    price,
    pe_forward,
    pe_trailing,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    market_cap,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )
order by pe_forward asc`),_.$$.dirty[0]&32768&&i(58,Qe=`select
    symbol,
    name,
    price,
    pe_forward,
    pe_trailing,
    price_to_book,
    dividend_yield,
    roe,
    roa,
    market_cap,
    target_price,
    recommendation,
    sector,
    region,
    country
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )
order by pe_forward asc`),_.$$.dirty[1]&503316480&&(de||!pt?de||(ke(Qe,{noResolve:de,...ve}),i(59,pt=!0)):ke(Qe,{noResolve:de})),_.$$.dirty[0]&32768&&i(61,Pe=j`select
    count(*) as nb_matches,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )`),_.$$.dirty[0]&32768&&i(62,ce=`select
    count(*) as nb_matches,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )`),_.$$.dirty[1]&1610612736|_.$$.dirty[2]&3&&(Pe||!ut?Pe||(Xe(ce,{noResolve:Pe,...ze}),i(63,ut=!0)):Xe(ce,{noResolve:Pe})),_.$$.dirty[0]&32768&&i(65,Ae=j`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and pe_forward < 200
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and dividend_yield is not null
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )`),_.$$.dirty[0]&32768&&i(66,$e=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward <= ${d.pe_max}
  and pe_forward < 200
  and coalesce(dividend_yield, 0) >= ${d.div_min}
  and dividend_yield is not null
  and price_to_book > 0
  and price_to_book <= ${d.ptb_max}
  and (
    '${d.reco_filter}' = 'all'
    or recommendation = '${d.reco_filter}'
  )`),_.$$.dirty[2]&60&&(Ae||!ct?Ae||(Ke($e,{noResolve:Ae,...fe}),i(67,ct=!0)):Ke($e,{noResolve:Ae}))},i(17,I=j`select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where pe_forward is not null and pe_forward > 0`),i(18,Y=`select
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe_forward,
    round(avg(pe_trailing), 1) as avg_pe_trailing,
    round(avg(price_to_book), 1) as avg_ptb,
    round(avg(dividend_yield), 2) as avg_div_yield,
    round(avg(roe), 1) as avg_roe
from market.stocks
where pe_forward is not null and pe_forward > 0`),i(21,M=j`select
    pe_forward
from market.stocks
where pe_forward > 0 and pe_forward < 200`),i(22,H=`select
    pe_forward
from market.stocks
where pe_forward > 0 and pe_forward < 200`),i(25,C=j`select
    dividend_yield
from market.stocks
where dividend_yield is not null and dividend_yield > 0`),i(26,Q=`select
    dividend_yield
from market.stocks
where dividend_yield is not null and dividend_yield > 0`),i(29,Ee=j`select
    price_to_book
from market.stocks
where price_to_book > 0 and price_to_book < 50`),i(30,me=`select
    price_to_book
from market.stocks
where price_to_book > 0 and price_to_book < 50`),i(33,De=j`select
    sector as name,
    min(pe_forward) as min,
    percentile_cont(0.25) within group (order by pe_forward) as q1,
    median(pe_forward) as median,
    percentile_cont(0.75) within group (order by pe_forward) as q3,
    max(pe_forward) as max
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector`),i(34,pe=`select
    sector as name,
    min(pe_forward) as min,
    percentile_cont(0.25) within group (order by pe_forward) as q1,
    median(pe_forward) as median,
    percentile_cont(0.75) within group (order by pe_forward) as q3,
    max(pe_forward) as max
from market.stocks
where pe_forward > 0 and pe_forward < 200
group by sector`),i(37,He=j`select
    region as name,
    min(dividend_yield) as min,
    percentile_cont(0.25) within group (order by dividend_yield) as q1,
    median(dividend_yield) as median,
    percentile_cont(0.75) within group (order by dividend_yield) as q3,
    max(dividend_yield) as max
from market.stocks
where dividend_yield is not null and dividend_yield > 0
group by region`),i(38,ue=`select
    region as name,
    min(dividend_yield) as min,
    percentile_cont(0.25) within group (order by dividend_yield) as q1,
    median(dividend_yield) as median,
    percentile_cont(0.75) within group (order by dividend_yield) as q3,
    max(dividend_yield) as max
from market.stocks
where dividend_yield is not null and dividend_yield > 0
group by region`),i(41,he=j`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null`),i(42,Le=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    market_cap,
    sector
from market.stocks
where pe_forward > 0
  and pe_forward < 200
  and dividend_yield is not null`),i(45,ae=j`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 20`),i(46,ot=`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    country
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 20`),i(49,le=j`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    price_to_book,
    market_cap,
    sector,
    recommendation
from market.stocks
where pe_forward > 0
order by pe_forward asc
limit 20`),i(50,dt=`select
    symbol,
    name,
    pe_forward,
    dividend_yield,
    price_to_book,
    market_cap,
    sector,
    recommendation
from market.stocks
where pe_forward > 0
order by pe_forward asc
limit 20`),i(53,ye=j`select
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
    region,
    country
from market.stocks
order by pe_forward asc nulls last`),i(54,Oe=`select
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
    region,
    country
from market.stocks
order by pe_forward asc nulls last`),[P,x,a,qt,xt,Et,st,_t,ft,ge,We,ht,Ft,m,l,d,S,I,Y,V,U,M,H,F,R,C,Q,T,Ne,Ee,me,at,se,De,pe,lt,oe,He,ue,nt,_e,he,Le,we,Fe,ae,ot,je,Se,le,dt,Ge,Ie,ye,Oe,Ht,ve,de,Qe,pt,ze,Pe,ce,ut,fe,Ae,$e,ct,t]}class Xi extends ei{constructor(r){super(),ti(this,r,Ci,Si,Qr,{data:13},null,[-1,-1,-1])}}export{Xi as component};
