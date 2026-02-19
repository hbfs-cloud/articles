import{s as mt,d as _,i as g,g as Ze,v as Ue,J as ut,N as ct,O as vt,y as jt,z as Vt,A as Wt,B as Qt,a as lt,b as A,c as We,e as k,h as Yt,f as ie,j as Ye,k as v,l as ue,m as wt,n as Xt,o as Jt,p as Kt,q as Zt,t as et,u as tt,w as xt,x as er}from"../chunks/scheduler.gCtXCaAC.js";import{S as _t,i as gt,t as d,a as m,g as Ne,c as Pe,d as w,m as h,b as C,e as R}from"../chunks/index.DmJzZqpA.js";import{l as tr,w as rr,x as ar,z as ft,A as Qe,y as ht,B as nr,F as Ut,G as or,Q as De,H as sr,J as lr,K as ir,D as it,e as ur,s as fr,p as cr,C as X,a as Ct,d as Rt,r as Tt,c as mr}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.xVnsThWF.js";import{w as _r}from"../chunks/entry.t5gz319j.js";import{E as gr,A as pr,b as pt,T as dr,L as nt,Q as Ve,a as $r,B as ot}from"../chunks/BigValue.vcBvE0eY.js";import{h as ne,p as br}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{p as yr}from"../chunks/stores.CdFJQivx.js";import{B as kr,a as vr}from"../chunks/ButtonGroup.DrUuNe7L.js";import{G as wr}from"../chunks/Grid.B6K-jFTg.js";import{G as St}from"../chunks/Group.CEgnm8fW.js";import{F as hr}from"../chunks/FunnelChart.DhVEYRCl.js";import{H as Cr}from"../chunks/Heatmap.9L0bY0b2.js";function Rr(l){let t,r;return t=new gr({props:{data:l[2],config:l[6],width:l[4],height:l[5],echartsOptions:l[0],printEchartsConfig:l[1]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&4&&(s.data=e[2]),n[0]&64&&(s.config=e[6]),n[0]&16&&(s.width=e[4]),n[0]&32&&(s.height=e[5]),n[0]&1&&(s.echartsOptions=e[0]),n[0]&2&&(s.printEchartsConfig=e[1]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Tr(l){let t,r;return t=new Ut({props:{chartType:"Sankey Diagram",error:l[3]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&8&&(s.error=e[3]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Sr(l){let t,r,e,n;const s=[Tr,Rr],a=[];function u(b,y){return b[3]?0:1}return t=u(l),r=a[t]=s[t](l),{c(){r.c(),e=Ze()},l(b){r.l(b),e=Ze()},m(b,y){a[t].m(b,y),g(b,e,y),n=!0},p(b,y){let H=t;t=u(b),t===H?a[t].p(b,y):(Ne(),d(a[H],1,1,()=>{a[H]=null}),Pe(),r=a[t],r?r.p(b,y):(r=a[t]=s[t](b),r.c()),m(r,1),r.m(e.parentNode,e))},i(b){n||(m(r),n=!0)},o(b){d(r),n=!1},d(b){b&&_(e),a[t].d(b)}}}function Er(l,t){l.forEach(r=>{Object.prototype.hasOwnProperty.call(t,r.name)&&(r.depth=t[r.name])})}function qr(l,t,r){let e,n,s,a,u=Ue,b=()=>(u(),u=ut(s,T=>r(47,a=T)),s),y,H=Ue,p=()=>(H(),H=ut(n,T=>r(48,y=T)),n),E,f=Ue,F=()=>(f(),f=ut(e,T=>r(49,E=T)),e);l.$$.on_destroy.push(()=>u()),l.$$.on_destroy.push(()=>H()),l.$$.on_destroy.push(()=>f());const{resolveColor:V,resolveColorPalette:le}=tr();let{echartsOptions:U=void 0}=t,{printEchartsConfig:x=!1}=t,{valueFmt:P=void 0}=t,{percentFmt:z=void 0}=t,O,B,{colorPalette:$="default"}=t,{data:q=void 0}=t,{sourceCol:J="source"}=t,{targetCol:fe="target"}=t,{valueCol:W="value"}=t,{percentCol:ke=void 0}=t,{title:N=void 0}=t,{subtitle:M=void 0}=t,{nodeLabels:I="name"}=t,{linkLabels:D=void 0}=t,{outlineColor:i=void 0}=t,{outlineWidth:S=void 0}=t,{nodeAlign:de="justify"}=t,{nodeGap:$e=10}=t,{nodeWidth:oe=20}=t,{orient:ce="horizontal"}=t,{sort:me=!1}=t,{depthOverride:Ae}=t,{linkColor:He="base-content-muted"}=t,se=[],_e,be,{chartAreaHeight:Re="300"}=t,Oe,ve,Te,ge,Ie,Be,ze,Se,we,pe,Le,Me="400px",je="100%",Ee,qe,ye;return l.$$set=T=>{"echartsOptions"in T&&r(0,U=T.echartsOptions),"printEchartsConfig"in T&&r(1,x=T.printEchartsConfig),"valueFmt"in T&&r(11,P=T.valueFmt),"percentFmt"in T&&r(12,z=T.percentFmt),"colorPalette"in T&&r(13,$=T.colorPalette),"data"in T&&r(2,q=T.data),"sourceCol"in T&&r(14,J=T.sourceCol),"targetCol"in T&&r(15,fe=T.targetCol),"valueCol"in T&&r(16,W=T.valueCol),"percentCol"in T&&r(17,ke=T.percentCol),"title"in T&&r(18,N=T.title),"subtitle"in T&&r(19,M=T.subtitle),"nodeLabels"in T&&r(20,I=T.nodeLabels),"linkLabels"in T&&r(21,D=T.linkLabels),"outlineColor"in T&&r(22,i=T.outlineColor),"outlineWidth"in T&&r(23,S=T.outlineWidth),"nodeAlign"in T&&r(24,de=T.nodeAlign),"nodeGap"in T&&r(25,$e=T.nodeGap),"nodeWidth"in T&&r(26,oe=T.nodeWidth),"orient"in T&&r(27,ce=T.orient),"sort"in T&&r(28,me=T.sort),"depthOverride"in T&&r(29,Ae=T.depthOverride),"linkColor"in T&&r(30,He=T.linkColor),"chartAreaHeight"in T&&r(10,Re=T.chartAreaHeight)},l.$$.update=()=>{if(l.$$.dirty[0]&8192&&F(r(9,e=le($))),l.$$.dirty[0]&4194304&&p(r(8,n=V(i))),l.$$.dirty[0]&1073741824&&b(r(7,s=V(He))),l.$$.dirty[0]&1069538332|l.$$.dirty[1]&524287)try{rr(q,[J,fe,W],[ke]),q.map(G=>{se.push(G[J],G[fe])});const T=[...new Set(se)].map((G,Fe)=>({name:G,itemStyle:{color:E==null?void 0:E[Fe%(E==null?void 0:E.length)]}}));if(r(33,_e=q.map(G=>({source:G[J],target:G[fe],value:G[W],percent:G[ke]}))),Re){if(r(10,Re=Number(Re)),isNaN(Re))throw Error("chartAreaHeight must be a number");if(Re<=0)throw Error("chartAreaHeight must be a positive number")}else r(10,Re=300);r(34,Oe=!!N),r(35,ve=!!M),r(36,Te=15),r(37,ge=13),r(38,Ie=10*ve),r(39,Be=Oe*Te+ve*ge+Ie*Math.max(Oe,ve)),r(40,ze=10),r(41,Se=8),r(42,we=ze+Be),r(43,pe=Se),r(44,Le=Re+we+pe),r(5,Me=Le+"px"),r(4,je="100%"),r(45,Ee=ar(q)),r(46,qe=Ee[W].format),r(31,O=P?ft(P):qe),r(32,B=z?ft(z):ft("pct"));let he;he={type:"sankey",layout:"none",layoutIterations:me==="true"?32:0,left:"10%",top:ce==="vertical"?we+10:we,bottom:ce==="vertical"?0:10,width:"70%",nodeGap:$e,nodeWidth:oe,nodeAlign:de,orient:ce,emphasis:{focus:"adjacency"},label:{show:["name","value","full"].includes(I),position:ce==="vertical"?"top":"right",fontSize:ce==="vertical"?10.5:12,formatter(G){let Fe;return I==="name"?Fe=`${ht(G.data.name)}`:I==="value"?Fe=`${Qe(G.value,O)}`:Fe=`${ht(G.data.name)} (${Qe(G.value,O)})`,Fe}},edgeLabel:{show:["value","percent","full"].includes(D),color:"black",textBorderColor:"white",textBorderWidth:2,formatter(G){let Fe;return D==="value"?Fe=`${Qe(G.data.value,O)}`:D==="percent"?Fe=ke?`${Qe(G.data.percent,B)}`:"":Fe=`${Qe(G.data.value,O)}`+(ke?` (${Qe(G.data.percent,B)})`:""),Fe}},labelLayout:{hideOverlap:!0},itemStyle:{borderColor:y,borderWidth:S},lineStyle:{color:a},tooltip:{formatter(G){return G.data.name?`<span style='font-weight: 600'>${Qe(G.data.name)}</span><br/> ${Qe(G.value,O)}`:`<span style='font-weight: 600'>${Qe(G.data[J])} &rarr; ${Qe(G.data.target)}</span><br/> ${Qe(G.data.value,O)}`},extraCssText:"box-shadow: 0 3px 6px rgba(0,0,0,.15); box-shadow: 0 2px 4px rgba(0,0,0,.12); z-index: 1;",order:"valueDesc"},data:T,links:_e,animationDuration:500},Ae&&Er(he.data,Ae),r(6,ye={title:{text:N,subtext:M,subtextStyle:{width:je}},tooltip:{trigger:"item"},series:[he]})}catch(T){if(r(3,be=T.message),console.error("Error in SankeyDiagram: "+T.message),nr)throw be}},[U,x,q,be,je,Me,ye,s,n,e,Re,P,z,$,J,fe,W,ke,N,M,I,D,i,S,de,$e,oe,ce,me,Ae,He,O,B,_e,Oe,ve,Te,ge,Ie,Be,ze,Se,we,pe,Le,Ee,qe,a,y,E]}class Fr extends _t{constructor(t){super(),gt(this,t,qr,Sr,mt,{echartsOptions:0,printEchartsConfig:1,valueFmt:11,percentFmt:12,colorPalette:13,data:2,sourceCol:14,targetCol:15,valueCol:16,percentCol:17,title:18,subtitle:19,nodeLabels:20,linkLabels:21,outlineColor:22,outlineWidth:23,nodeAlign:24,nodeGap:25,nodeWidth:26,orient:27,sort:28,depthOverride:29,linkColor:30,chartAreaHeight:10},null,[-1,-1])}}function Hr(l){let t;const r=l[5].default,e=jt(r,l,l[6],null);return{c(){e&&e.c()},l(n){e&&e.l(n)},m(n,s){e&&e.m(n,s),t=!0},p(n,s){e&&e.p&&(!t||s&64)&&Vt(e,r,n,n[6],t?Qt(r,n[6],s,null):Wt(n[6]),null)},i(n){t||(m(e,n),t=!0)},o(n){d(e,n),t=!1},d(n){e&&e.d(n)}}}function Mr(l){let t,r;const e=[l[4],{data:De.isQuery(l[9])?Array.from(l[9]):l[9]}];let n={$$slots:{default:[Hr]},$$scope:{ctx:l}};for(let s=0;s<e.length;s+=1)n=ct(n,e[s]);return t=new Fr({props:n}),{c(){R(t.$$.fragment)},l(s){C(t.$$.fragment,s)},m(s,a){h(t,s,a),r=!0},p(s,a){const u=a&528?sr(e,[a&16&&lr(s[4]),a&512&&{data:De.isQuery(s[9])?Array.from(s[9]):s[9]}]):{};a&64&&(u.$$scope={dirty:a,ctx:s}),t.$set(u)},i(s){r||(m(t.$$.fragment,s),r=!0)},o(s){d(t.$$.fragment,s),r=!1},d(s){w(t,s)}}}function Dr(l){let t,r;return t=new ir({props:{slot:"empty",emptyMessage:l[2],emptySet:l[1],chartType:zt,isInitial:l[3]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n&4&&(s.emptyMessage=e[2]),n&2&&(s.emptySet=e[1]),n&8&&(s.isInitial=e[3]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Ar(l){let t,r;return t=new Ut({props:{slot:"error",title:zt,error:l[9].error.message}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n&512&&(s.error=e[9].error.message),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Ir(l){let t,r;return t=new or({props:{data:l[0],$$slots:{error:[Ar,({loaded:e})=>({9:e}),({loaded:e})=>e?512:0],empty:[Dr],default:[Mr,({loaded:e})=>({9:e}),({loaded:e})=>e?512:0]},$$scope:{ctx:l}}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,[n]){const s={};n&1&&(s.data=e[0]),n&606&&(s.$$scope={dirty:n,ctx:e}),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}let zt="Sankey Diagram";function Lr(l,t,r){let e,{$$slots:n={},$$scope:s}=t,{data:a}=t;const u=De.isQuery(a)?a.hash:void 0;let b=(a==null?void 0:a.hash)===u,{emptySet:y=void 0}=t,{emptyMessage:H=void 0}=t;return l.$$set=p=>{r(8,t=ct(ct({},t),vt(p))),"data"in p&&r(0,a=p.data),"emptySet"in p&&r(1,y=p.emptySet),"emptyMessage"in p&&r(2,H=p.emptyMessage),"$$scope"in p&&r(6,s=p.$$scope)},l.$$.update=()=>{l.$$.dirty&1&&r(3,b=(a==null?void 0:a.hash)===u),r(4,e={...Object.fromEntries(Object.entries(t).filter(([,p])=>p!==void 0))})},t=vt(t),[a,y,H,b,e,n,s]}class Nr extends _t{constructor(t){super(),gt(this,t,Lr,Ir,mt,{data:0,emptySet:1,emptyMessage:2})}}function Et(l,t,r){const e=l.slice();return e[84]=t[r],e}function Pr(l){let t,r=j.title+"",e;return{c(){t=ue("h1"),e=tt(r),this.h()},l(n){t=ie(n,"H1",{class:!0});var s=xt(t);e=et(s,r),s.forEach(_),this.h()},h(){A(t,"class","title")},m(n,s){g(n,t,s),lt(t,e)},p:Ue,d(n){n&&_(t)}}}function Or(l){return{c(){this.h()},l(t){this.h()},h(){document.title="Evidence"},m:Ue,p:Ue,d:Ue}}function Br(l){let t,r,e,n,s;return document.title=t=j.title,{c(){r=v(),e=ue("meta"),n=v(),s=ue("meta"),this.h()},l(a){r=k(a),e=ie(a,"META",{property:!0,content:!0}),n=k(a),s=ie(a,"META",{name:!0,content:!0}),this.h()},h(){var a,u;A(e,"property","og:title"),A(e,"content",((a=j.og)==null?void 0:a.title)??j.title),A(s,"name","twitter:title"),A(s,"content",((u=j.og)==null?void 0:u.title)??j.title)},m(a,u){g(a,r,u),g(a,e,u),g(a,n,u),g(a,s,u)},p(a,u){u&0&&t!==(t=j.title)&&(document.title=t)},d(a){a&&(_(r),_(e),_(n),_(s))}}}function Gr(l){var s,a;let t,r,e=(j.description||((s=j.og)==null?void 0:s.description))&&Ur(),n=((a=j.og)==null?void 0:a.image)&&zr();return{c(){e&&e.c(),t=v(),n&&n.c(),r=Ze()},l(u){e&&e.l(u),t=k(u),n&&n.l(u),r=Ze()},m(u,b){e&&e.m(u,b),g(u,t,b),n&&n.m(u,b),g(u,r,b)},p(u,b){var y,H;(j.description||(y=j.og)!=null&&y.description)&&e.p(u,b),(H=j.og)!=null&&H.image&&n.p(u,b)},d(u){u&&(_(t),_(r)),e&&e.d(u),n&&n.d(u)}}}function Ur(l){let t,r,e,n,s;return{c(){t=ue("meta"),r=v(),e=ue("meta"),n=v(),s=ue("meta"),this.h()},l(a){t=ie(a,"META",{name:!0,content:!0}),r=k(a),e=ie(a,"META",{property:!0,content:!0}),n=k(a),s=ie(a,"META",{name:!0,content:!0}),this.h()},h(){var a,u,b;A(t,"name","description"),A(t,"content",j.description??((a=j.og)==null?void 0:a.description)),A(e,"property","og:description"),A(e,"content",((u=j.og)==null?void 0:u.description)??j.description),A(s,"name","twitter:description"),A(s,"content",((b=j.og)==null?void 0:b.description)??j.description)},m(a,u){g(a,t,u),g(a,r,u),g(a,e,u),g(a,n,u),g(a,s,u)},p:Ue,d(a){a&&(_(t),_(r),_(e),_(n),_(s))}}}function zr(l){let t,r,e;return{c(){t=ue("meta"),r=v(),e=ue("meta"),this.h()},l(n){t=ie(n,"META",{property:!0,content:!0}),r=k(n),e=ie(n,"META",{name:!0,content:!0}),this.h()},h(){var n,s;A(t,"property","og:image"),A(t,"content",Ct((n=j.og)==null?void 0:n.image)),A(e,"name","twitter:image"),A(e,"content",Ct((s=j.og)==null?void 0:s.image))},m(n,s){g(n,t,s),g(n,r,s),g(n,e,s)},p:Ue,d(n){n&&(_(t),_(r),_(e))}}}function jr(l){let t;return{c(){t=tt("Explorez la repartition geographique des plus grandes capitalisations mondiales. Les visualisations statiques montrent les flux Region-Secteur, les heatmaps et les classements par pays. L'onglet Par Region permet d'explorer une zone en detail.")},l(r){t=et(r,"Explorez la repartition geographique des plus grandes capitalisations mondiales. Les visualisations statiques montrent les flux Region-Secteur, les heatmaps et les classements par pays. L'onglet Par Region permet d'explorer une zone en detail.")},m(r,e){g(r,t,e)},d(r){r&&_(t)}}}function qt(l){let t,r;return t=new Ve({props:{queryID:"sankey_flows",queryResult:l[0]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&1&&(s.queryResult=e[0]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Ft(l){let t,r;return t=new Ve({props:{queryID:"heatmap_region_sector",queryResult:l[1]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&2&&(s.queryResult=e[1]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Ht(l){let t,r;return t=new Ve({props:{queryID:"mcap_by_region_sector",queryResult:l[2]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&4&&(s.queryResult=e[2]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Mt(l){let t,r;return t=new Ve({props:{queryID:"country_summary",queryResult:l[3]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&8&&(s.queryResult=e[3]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Dt(l){let t,r;return t=new Ve({props:{queryID:"top15_countries_mcap",queryResult:l[4]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&16&&(s.queryResult=e[4]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function At(l){let t,r;return t=new Ve({props:{queryID:"funnel_region",queryResult:l[5]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&32&&(s.queryResult=e[5]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function It(l){let t,r;return t=new Ve({props:{queryID:"region_overview",queryResult:l[6]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&64&&(s.queryResult=e[6]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Lt(l){let t,r;return t=new Ve({props:{queryID:"region_list_btn",queryResult:l[7]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&128&&(s.queryResult=e[7]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Vr(l){let t,r='<a href="#nombre-dactions-par-region">Nombre d&#39;Actions par Region</a>',e,n,s;return n=new hr({props:{data:l[5],nameCol:"region",valueCol:"nb_stocks",title:"Repartition des Actions par Region"}}),{c(){t=ue("h3"),t.innerHTML=r,e=v(),R(n.$$.fragment),this.h()},l(a){t=ie(a,"H3",{class:!0,id:!0,"data-svelte-h":!0}),Ye(t)!=="svelte-y4x0y0"&&(t.innerHTML=r),e=k(a),C(n.$$.fragment,a),this.h()},h(){A(t,"class","markdown"),A(t,"id","nombre-dactions-par-region")},m(a,u){g(a,t,u),g(a,e,u),h(n,a,u),s=!0},p(a,u){const b={};u[0]&32&&(b.data=a[5]),n.$set(b)},i(a){s||(m(n.$$.fragment,a),s=!0)},o(a){d(n.$$.fragment,a),s=!1},d(a){a&&(_(t),_(e)),w(n,a)}}}function Wr(l){let t,r='<a href="#top-15-pays-par-capitalisation">Top 15 Pays par Capitalisation</a>',e,n,s;return n=new pt({props:{data:l[4],x:"country",y:"total_mcap",xAxisTitle:"Pays",yAxisTitle:"Capitalisation Totale ($)",title:"Top 15 Pays par Capitalisation",fmt:"usd",swapXY:"true",sort:"false"}}),{c(){t=ue("h3"),t.innerHTML=r,e=v(),R(n.$$.fragment),this.h()},l(a){t=ie(a,"H3",{class:!0,id:!0,"data-svelte-h":!0}),Ye(t)!=="svelte-164wpou"&&(t.innerHTML=r),e=k(a),C(n.$$.fragment,a),this.h()},h(){A(t,"class","markdown"),A(t,"id","top-15-pays-par-capitalisation")},m(a,u){g(a,t,u),g(a,e,u),h(n,a,u),s=!0},p(a,u){const b={};u[0]&16&&(b.data=a[4]),n.$set(b)},i(a){s||(m(n.$$.fragment,a),s=!0)},o(a){d(n.$$.fragment,a),s=!1},d(a){a&&(_(t),_(e)),w(n,a)}}}function Qr(l){let t,r,e,n;return t=new St({props:{$$slots:{default:[Vr]},$$scope:{ctx:l}}}),e=new St({props:{$$slots:{default:[Wr]},$$scope:{ctx:l}}}),{c(){R(t.$$.fragment),r=v(),R(e.$$.fragment)},l(s){C(t.$$.fragment,s),r=k(s),C(e.$$.fragment,s)},m(s,a){h(t,s,a),g(s,r,a),h(e,s,a),n=!0},p(s,a){const u={};a[0]&32|a[2]&33554432&&(u.$$scope={dirty:a,ctx:s}),t.$set(u);const b={};a[0]&16|a[2]&33554432&&(b.$$scope={dirty:a,ctx:s}),e.$set(b)},i(s){n||(m(t.$$.fragment,s),m(e.$$.fragment,s),n=!0)},o(s){d(t.$$.fragment,s),d(e.$$.fragment,s),n=!1},d(s){s&&_(r),w(t,s),w(e,s)}}}function Yr(l){let t,r,e,n,s,a,u,b,y,H,p,E;return t=new X({props:{id:"region",title:"Region"}}),e=new X({props:{id:"nb_stocks",title:"Nb Actions"}}),s=new X({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),u=new X({props:{id:"avg_pe",title:"P/E Fwd Moy.",fmt:"num1"}}),y=new X({props:{id:"avg_div",title:"Div Yield Moy. (%)",fmt:"num2"}}),p=new X({props:{id:"avg_change",title:"Var. Moy. (%)",fmt:"num2"}}),{c(){R(t.$$.fragment),r=v(),R(e.$$.fragment),n=v(),R(s.$$.fragment),a=v(),R(u.$$.fragment),b=v(),R(y.$$.fragment),H=v(),R(p.$$.fragment)},l(f){C(t.$$.fragment,f),r=k(f),C(e.$$.fragment,f),n=k(f),C(s.$$.fragment,f),a=k(f),C(u.$$.fragment,f),b=k(f),C(y.$$.fragment,f),H=k(f),C(p.$$.fragment,f)},m(f,F){h(t,f,F),g(f,r,F),h(e,f,F),g(f,n,F),h(s,f,F),g(f,a,F),h(u,f,F),g(f,b,F),h(y,f,F),g(f,H,F),h(p,f,F),E=!0},p:Ue,i(f){E||(m(t.$$.fragment,f),m(e.$$.fragment,f),m(s.$$.fragment,f),m(u.$$.fragment,f),m(y.$$.fragment,f),m(p.$$.fragment,f),E=!0)},o(f){d(t.$$.fragment,f),d(e.$$.fragment,f),d(s.$$.fragment,f),d(u.$$.fragment,f),d(y.$$.fragment,f),d(p.$$.fragment,f),E=!1},d(f){f&&(_(r),_(n),_(a),_(b),_(H)),w(t,f),w(e,f),w(s,f),w(u,f),w(y,f),w(p,f)}}}function Xr(l){let t,r,e,n,s,a,u,b,y,H,p,E;return t=new X({props:{id:"country",title:"Pays"}}),e=new X({props:{id:"nb_stocks",title:"Nb Actions"}}),s=new X({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),u=new X({props:{id:"avg_pe",title:"P/E Fwd Moy.",fmt:"num1"}}),y=new X({props:{id:"avg_div",title:"Div Yield Moy. (%)",fmt:"num2"}}),p=new X({props:{id:"avg_change",title:"Var. Moy. (%)",fmt:"num2"}}),{c(){R(t.$$.fragment),r=v(),R(e.$$.fragment),n=v(),R(s.$$.fragment),a=v(),R(u.$$.fragment),b=v(),R(y.$$.fragment),H=v(),R(p.$$.fragment)},l(f){C(t.$$.fragment,f),r=k(f),C(e.$$.fragment,f),n=k(f),C(s.$$.fragment,f),a=k(f),C(u.$$.fragment,f),b=k(f),C(y.$$.fragment,f),H=k(f),C(p.$$.fragment,f)},m(f,F){h(t,f,F),g(f,r,F),h(e,f,F),g(f,n,F),h(s,f,F),g(f,a,F),h(u,f,F),g(f,b,F),h(y,f,F),g(f,H,F),h(p,f,F),E=!0},p:Ue,i(f){E||(m(t.$$.fragment,f),m(e.$$.fragment,f),m(s.$$.fragment,f),m(u.$$.fragment,f),m(y.$$.fragment,f),m(p.$$.fragment,f),E=!0)},o(f){d(t.$$.fragment,f),d(e.$$.fragment,f),d(s.$$.fragment,f),d(u.$$.fragment,f),d(y.$$.fragment,f),d(p.$$.fragment,f),E=!1},d(f){f&&(_(r),_(n),_(a),_(b),_(H)),w(t,f),w(e,f),w(s,f),w(u,f),w(y,f),w(p,f)}}}function Nt(l){let t,r;return t=new vr({props:{value:l[84].value,valueLabel:l[84].label}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&128&&(s.value=e[84].value),n[0]&128&&(s.valueLabel=e[84].label),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Jr(l){let t,r,e=Rt(l[7]),n=[];for(let a=0;a<e.length;a+=1)n[a]=Nt(Et(l,e,a));const s=a=>d(n[a],1,1,()=>{n[a]=null});return{c(){for(let a=0;a<n.length;a+=1)n[a].c();t=Ze()},l(a){for(let u=0;u<n.length;u+=1)n[u].l(a);t=Ze()},m(a,u){for(let b=0;b<n.length;b+=1)n[b]&&n[b].m(a,u);g(a,t,u),r=!0},p(a,u){if(u[0]&128){e=Rt(a[7]);let b;for(b=0;b<e.length;b+=1){const y=Et(a,e,b);n[b]?(n[b].p(y,u),m(n[b],1)):(n[b]=Nt(y),n[b].c(),m(n[b],1),n[b].m(t.parentNode,t))}for(Ne(),b=e.length;b<n.length;b+=1)s(b);Pe()}},i(a){if(!r){for(let u=0;u<e.length;u+=1)m(n[u]);r=!0}},o(a){n=n.filter(Boolean);for(let u=0;u<n.length;u+=1)d(n[u]);r=!1},d(a){a&&_(t),er(n,a)}}}function Pt(l){let t,r;return t=new Ve({props:{queryID:"rg_stats",queryResult:l[8]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&256&&(s.queryResult=e[8]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Ot(l){let t,r;return t=new Ve({props:{queryID:"rg_sector_breakdown",queryResult:l[9]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&512&&(s.queryResult=e[9]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Bt(l){let t,r;return t=new Ve({props:{queryID:"rg_sector_mcap",queryResult:l[10]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&1024&&(s.queryResult=e[10]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Gt(l){let t,r;return t=new Ve({props:{queryID:"rg_top_stocks",queryResult:l[11]}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&2048&&(s.queryResult=e[11]),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function Kr(l){let t,r,e,n,s,a,u,b,y,H;return t=new X({props:{id:"sector",title:"Secteur"}}),e=new X({props:{id:"nb_stocks",title:"Nb Actions"}}),s=new X({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),u=new X({props:{id:"avg_pe",title:"P/E Fwd Moy.",fmt:"num1"}}),y=new X({props:{id:"avg_change",title:"Var. Moy. (%)",fmt:"num2"}}),{c(){R(t.$$.fragment),r=v(),R(e.$$.fragment),n=v(),R(s.$$.fragment),a=v(),R(u.$$.fragment),b=v(),R(y.$$.fragment)},l(p){C(t.$$.fragment,p),r=k(p),C(e.$$.fragment,p),n=k(p),C(s.$$.fragment,p),a=k(p),C(u.$$.fragment,p),b=k(p),C(y.$$.fragment,p)},m(p,E){h(t,p,E),g(p,r,E),h(e,p,E),g(p,n,E),h(s,p,E),g(p,a,E),h(u,p,E),g(p,b,E),h(y,p,E),H=!0},p:Ue,i(p){H||(m(t.$$.fragment,p),m(e.$$.fragment,p),m(s.$$.fragment,p),m(u.$$.fragment,p),m(y.$$.fragment,p),H=!0)},o(p){d(t.$$.fragment,p),d(e.$$.fragment,p),d(s.$$.fragment,p),d(u.$$.fragment,p),d(y.$$.fragment,p),H=!1},d(p){p&&(_(r),_(n),_(a),_(b)),w(t,p),w(e,p),w(s,p),w(u,p),w(y,p)}}}function Zr(l){let t,r,e,n,s,a,u,b,y,H,p,E,f,F,V,le,U,x,P,z,O,B;return t=new X({props:{id:"symbol",title:"Ticker"}}),e=new X({props:{id:"name",title:"Nom"}}),s=new X({props:{id:"price",title:"Prix",fmt:"usd"}}),u=new X({props:{id:"change_pct",title:"Var %",fmt:"num2"}}),y=new X({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),p=new X({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),f=new X({props:{id:"dividend_yield",title:"Div %",fmt:"num2"}}),V=new X({props:{id:"revenue_growth",title:"Croiss. CA %",fmt:"num1"}}),U=new X({props:{id:"profit_margin",title:"Marge Nette %",fmt:"num1"}}),P=new X({props:{id:"sector",title:"Secteur"}}),O=new X({props:{id:"country",title:"Pays"}}),{c(){R(t.$$.fragment),r=v(),R(e.$$.fragment),n=v(),R(s.$$.fragment),a=v(),R(u.$$.fragment),b=v(),R(y.$$.fragment),H=v(),R(p.$$.fragment),E=v(),R(f.$$.fragment),F=v(),R(V.$$.fragment),le=v(),R(U.$$.fragment),x=v(),R(P.$$.fragment),z=v(),R(O.$$.fragment)},l($){C(t.$$.fragment,$),r=k($),C(e.$$.fragment,$),n=k($),C(s.$$.fragment,$),a=k($),C(u.$$.fragment,$),b=k($),C(y.$$.fragment,$),H=k($),C(p.$$.fragment,$),E=k($),C(f.$$.fragment,$),F=k($),C(V.$$.fragment,$),le=k($),C(U.$$.fragment,$),x=k($),C(P.$$.fragment,$),z=k($),C(O.$$.fragment,$)},m($,q){h(t,$,q),g($,r,q),h(e,$,q),g($,n,q),h(s,$,q),g($,a,q),h(u,$,q),g($,b,q),h(y,$,q),g($,H,q),h(p,$,q),g($,E,q),h(f,$,q),g($,F,q),h(V,$,q),g($,le,q),h(U,$,q),g($,x,q),h(P,$,q),g($,z,q),h(O,$,q),B=!0},p:Ue,i($){B||(m(t.$$.fragment,$),m(e.$$.fragment,$),m(s.$$.fragment,$),m(u.$$.fragment,$),m(y.$$.fragment,$),m(p.$$.fragment,$),m(f.$$.fragment,$),m(V.$$.fragment,$),m(U.$$.fragment,$),m(P.$$.fragment,$),m(O.$$.fragment,$),B=!0)},o($){d(t.$$.fragment,$),d(e.$$.fragment,$),d(s.$$.fragment,$),d(u.$$.fragment,$),d(y.$$.fragment,$),d(p.$$.fragment,$),d(f.$$.fragment,$),d(V.$$.fragment,$),d(U.$$.fragment,$),d(P.$$.fragment,$),d(O.$$.fragment,$),B=!1},d($){$&&(_(r),_(n),_(a),_(b),_(H),_(E),_(F),_(le),_(x),_(z)),w(t,$),w(e,$),w(s,$),w(u,$),w(y,$),w(p,$),w(f,$),w(V,$),w(U,$),w(P,$),w(O,$)}}}function xr(l){let t,r,e,n,s,a,u,b,y,H,p,E,f,F,V,le,U,x='<a href="#repartition-sectorielle">Repartition Sectorielle</a>',P,z,O,B,$,q,J='<a href="#top-20-actions-de-la-region">Top 20 Actions de la Region</a>',fe,W,ke;t=new kr({props:{name:"region_select",title:"Region",$$slots:{default:[Jr]},$$scope:{ctx:l}}});let N=l[8]&&Pt(l),M=l[9]&&Ot(l),I=l[10]&&Bt(l),D=l[11]&&Gt(l);return u=new ot({props:{data:l[8],value:"nb_stocks",title:"Actions",emptySet:"pass"}}),y=new ot({props:{data:l[8],value:"total_mcap",title:"Capitalisation Totale",fmt:"usd",emptySet:"pass"}}),p=new ot({props:{data:l[8],value:"avg_pe",title:"P/E Forward Moy.",emptySet:"pass"}}),f=new ot({props:{data:l[8],value:"avg_div",title:"Div Yield Moy. (%)",emptySet:"pass"}}),V=new ot({props:{data:l[8],value:"avg_change",title:"Var. Moy. (%)",emptySet:"pass"}}),z=new pt({props:{data:l[10],x:"sector",y:"total_mcap",title:"Capitalisation par Secteur dans la Region",fmt:"usd",swapXY:"true",sort:"false",emptySet:"pass"}}),B=new it({props:{data:l[9],rows:"12",emptySet:"pass",$$slots:{default:[Kr]},$$scope:{ctx:l}}}),W=new it({props:{data:l[11],rows:"20",emptySet:"pass",$$slots:{default:[Zr]},$$scope:{ctx:l}}}),{c(){R(t.$$.fragment),r=v(),N&&N.c(),e=v(),M&&M.c(),n=v(),I&&I.c(),s=v(),D&&D.c(),a=v(),R(u.$$.fragment),b=v(),R(y.$$.fragment),H=v(),R(p.$$.fragment),E=v(),R(f.$$.fragment),F=v(),R(V.$$.fragment),le=v(),U=ue("h3"),U.innerHTML=x,P=v(),R(z.$$.fragment),O=v(),R(B.$$.fragment),$=v(),q=ue("h3"),q.innerHTML=J,fe=v(),R(W.$$.fragment),this.h()},l(i){C(t.$$.fragment,i),r=k(i),N&&N.l(i),e=k(i),M&&M.l(i),n=k(i),I&&I.l(i),s=k(i),D&&D.l(i),a=k(i),C(u.$$.fragment,i),b=k(i),C(y.$$.fragment,i),H=k(i),C(p.$$.fragment,i),E=k(i),C(f.$$.fragment,i),F=k(i),C(V.$$.fragment,i),le=k(i),U=ie(i,"H3",{class:!0,id:!0,"data-svelte-h":!0}),Ye(U)!=="svelte-pl34da"&&(U.innerHTML=x),P=k(i),C(z.$$.fragment,i),O=k(i),C(B.$$.fragment,i),$=k(i),q=ie(i,"H3",{class:!0,id:!0,"data-svelte-h":!0}),Ye(q)!=="svelte-wgrdau"&&(q.innerHTML=J),fe=k(i),C(W.$$.fragment,i),this.h()},h(){A(U,"class","markdown"),A(U,"id","repartition-sectorielle"),A(q,"class","markdown"),A(q,"id","top-20-actions-de-la-region")},m(i,S){h(t,i,S),g(i,r,S),N&&N.m(i,S),g(i,e,S),M&&M.m(i,S),g(i,n,S),I&&I.m(i,S),g(i,s,S),D&&D.m(i,S),g(i,a,S),h(u,i,S),g(i,b,S),h(y,i,S),g(i,H,S),h(p,i,S),g(i,E,S),h(f,i,S),g(i,F,S),h(V,i,S),g(i,le,S),g(i,U,S),g(i,P,S),h(z,i,S),g(i,O,S),h(B,i,S),g(i,$,S),g(i,q,S),g(i,fe,S),h(W,i,S),ke=!0},p(i,S){const de={};S[0]&128|S[2]&33554432&&(de.$$scope={dirty:S,ctx:i}),t.$set(de),i[8]?N?(N.p(i,S),S[0]&256&&m(N,1)):(N=Pt(i),N.c(),m(N,1),N.m(e.parentNode,e)):N&&(Ne(),d(N,1,1,()=>{N=null}),Pe()),i[9]?M?(M.p(i,S),S[0]&512&&m(M,1)):(M=Ot(i),M.c(),m(M,1),M.m(n.parentNode,n)):M&&(Ne(),d(M,1,1,()=>{M=null}),Pe()),i[10]?I?(I.p(i,S),S[0]&1024&&m(I,1)):(I=Bt(i),I.c(),m(I,1),I.m(s.parentNode,s)):I&&(Ne(),d(I,1,1,()=>{I=null}),Pe()),i[11]?D?(D.p(i,S),S[0]&2048&&m(D,1)):(D=Gt(i),D.c(),m(D,1),D.m(a.parentNode,a)):D&&(Ne(),d(D,1,1,()=>{D=null}),Pe());const $e={};S[0]&256&&($e.data=i[8]),u.$set($e);const oe={};S[0]&256&&(oe.data=i[8]),y.$set(oe);const ce={};S[0]&256&&(ce.data=i[8]),p.$set(ce);const me={};S[0]&256&&(me.data=i[8]),f.$set(me);const Ae={};S[0]&256&&(Ae.data=i[8]),V.$set(Ae);const He={};S[0]&1024&&(He.data=i[10]),z.$set(He);const se={};S[0]&512&&(se.data=i[9]),S[2]&33554432&&(se.$$scope={dirty:S,ctx:i}),B.$set(se);const _e={};S[0]&2048&&(_e.data=i[11]),S[2]&33554432&&(_e.$$scope={dirty:S,ctx:i}),W.$set(_e)},i(i){ke||(m(t.$$.fragment,i),m(N),m(M),m(I),m(D),m(u.$$.fragment,i),m(y.$$.fragment,i),m(p.$$.fragment,i),m(f.$$.fragment,i),m(V.$$.fragment,i),m(z.$$.fragment,i),m(B.$$.fragment,i),m(W.$$.fragment,i),ke=!0)},o(i){d(t.$$.fragment,i),d(N),d(M),d(I),d(D),d(u.$$.fragment,i),d(y.$$.fragment,i),d(p.$$.fragment,i),d(f.$$.fragment,i),d(V.$$.fragment,i),d(z.$$.fragment,i),d(B.$$.fragment,i),d(W.$$.fragment,i),ke=!1},d(i){i&&(_(r),_(e),_(n),_(s),_(a),_(b),_(H),_(E),_(F),_(le),_(U),_(P),_(O),_($),_(q),_(fe)),w(t,i),N&&N.d(i),M&&M.d(i),I&&I.d(i),D&&D.d(i),w(u,i),w(y,i),w(p,i),w(f,i),w(V,i),w(z,i),w(B,i),w(W,i)}}}function ea(l){let t,r;return t=new $r({props:{label:"Par Region",$$slots:{default:[xr]},$$scope:{ctx:l}}}),{c(){R(t.$$.fragment)},l(e){C(t.$$.fragment,e)},m(e,n){h(t,e,n),r=!0},p(e,n){const s={};n[0]&3968|n[2]&33554432&&(s.$$scope={dirty:n,ctx:e}),t.$set(s)},i(e){r||(m(t.$$.fragment,e),r=!0)},o(e){d(t.$$.fragment,e),r=!1},d(e){w(t,e)}}}function ta(l){let t;return{c(){t=tt("Accueil")},l(r){t=et(r,"Accueil")},m(r,e){g(r,t,e)},d(r){r&&_(t)}}}function ra(l){let t;return{c(){t=tt("Explorateur d'Actions")},l(r){t=et(r,"Explorateur d'Actions")},m(r,e){g(r,t,e)},d(r){r&&_(t)}}}function aa(l){let t;return{c(){t=tt("Analyse Sectorielle")},l(r){t=et(r,"Analyse Sectorielle")},m(r,e){g(r,t,e)},d(r){r&&_(t)}}}function na(l){let t;return{c(){t=tt("Lab de Valorisation")},l(r){t=et(r,"Lab de Valorisation")},m(r,e){g(r,t,e)},d(r){r&&_(t)}}}function oa(l){let t;return{c(){t=tt("Croissance & Rentabilite")},l(r){t=et(r,"Croissance & Rentabilite")},m(r,e){g(r,t,e)},d(r){r&&_(t)}}}function sa(l){let t,r,e,n,s,a,u="← Retour Market Watch",b,y,H='<a href="#analyse-geographique">Analyse Geographique</a>',p,E,f,F,V,le,U,x,P,z,O,B,$='<a href="#flux-region-vers-secteur">Flux Region vers Secteur</a>',q,J,fe,W,ke='<a href="#heatmap--performance-moyenne-par-region-et-secteur">Heatmap : Performance Moyenne par Region et Secteur</a>',N,M,I,D,i='<a href="#capitalisation-par-region-et-secteur">Capitalisation par Region et Secteur</a>',S,de,$e,oe,ce,me,Ae='<a href="#synthese-par-region">Synthese par Region</a>',He,se,_e,be,Re='<a href="#detail-par-pays">Detail par Pays</a>',Oe,ve,Te,ge,Ie,Be,ze,Se,we,pe,Le,Me,je,Ee,qe,ye,T,he=typeof j<"u"&&j.title&&j.hide_title!==!0&&Pr();function G(o,c){return typeof j<"u"&&j.title?Br:Or}let Ge=G()(l),Ce=typeof j=="object"&&Gr();E=new pr({props:{status:"info",$$slots:{default:[jr]},$$scope:{ctx:l}}});let K=l[0]&&qt(l),ee=l[1]&&Ft(l),te=l[2]&&Ht(l),re=l[3]&&Mt(l),Q=l[4]&&Dt(l),Y=l[5]&&At(l),Z=l[6]&&It(l),ae=l[7]&&Lt(l);return J=new Nr({props:{data:l[0],sourceCol:"source",targetCol:"target",valueCol:"amount",title:"Repartition des Actions : Region vers Secteur"}}),M=new Cr({props:{data:l[1],x:"sector",y:"region",value:"avg_change",valueFmt:"num2",title:"Variation Moyenne (%) : Region x Secteur"}}),de=new pt({props:{data:l[2],x:"region",y:"total_mcap",series:"sector",type:"stacked",xAxisTitle:"Region",yAxisTitle:"Capitalisation Totale ($)",title:"Capitalisation par Region (empile par Secteur)",fmt:"usd"}}),oe=new wr({props:{cols:"2",$$slots:{default:[Qr]},$$scope:{ctx:l}}}),se=new it({props:{data:l[6],rows:"10",$$slots:{default:[Yr]},$$scope:{ctx:l}}}),ve=new it({props:{data:l[3],search:"true",rows:"20",$$slots:{default:[Xr]},$$scope:{ctx:l}}}),ge=new dr({props:{$$slots:{default:[ea]},$$scope:{ctx:l}}}),Se=new nt({props:{url:"/",$$slots:{default:[ta]},$$scope:{ctx:l}}}),pe=new nt({props:{url:"/explorer",$$slots:{default:[ra]},$$scope:{ctx:l}}}),Me=new nt({props:{url:"/sectors",$$slots:{default:[aa]},$$scope:{ctx:l}}}),Ee=new nt({props:{url:"/valuations",$$slots:{default:[na]},$$scope:{ctx:l}}}),ye=new nt({props:{url:"/earnings",$$slots:{default:[oa]},$$scope:{ctx:l}}}),{c(){he&&he.c(),t=v(),Ge.c(),r=ue("meta"),e=ue("meta"),Ce&&Ce.c(),n=Ze(),s=v(),a=ue("a"),a.textContent=u,b=v(),y=ue("h1"),y.innerHTML=H,p=v(),R(E.$$.fragment),f=v(),K&&K.c(),F=v(),ee&&ee.c(),V=v(),te&&te.c(),le=v(),re&&re.c(),U=v(),Q&&Q.c(),x=v(),Y&&Y.c(),P=v(),Z&&Z.c(),z=v(),ae&&ae.c(),O=v(),B=ue("h2"),B.innerHTML=$,q=v(),R(J.$$.fragment),fe=v(),W=ue("h2"),W.innerHTML=ke,N=v(),R(M.$$.fragment),I=v(),D=ue("h2"),D.innerHTML=i,S=v(),R(de.$$.fragment),$e=v(),R(oe.$$.fragment),ce=v(),me=ue("h3"),me.innerHTML=Ae,He=v(),R(se.$$.fragment),_e=v(),be=ue("h3"),be.innerHTML=Re,Oe=v(),R(ve.$$.fragment),Te=v(),R(ge.$$.fragment),Ie=v(),Be=ue("hr"),ze=v(),R(Se.$$.fragment),we=v(),R(pe.$$.fragment),Le=v(),R(Me.$$.fragment),je=v(),R(Ee.$$.fragment),qe=v(),R(ye.$$.fragment),this.h()},l(o){he&&he.l(o),t=k(o);const c=Yt("svelte-2igo1p",document.head);Ge.l(c),r=ie(c,"META",{name:!0,content:!0}),e=ie(c,"META",{name:!0,content:!0}),Ce&&Ce.l(c),n=Ze(),c.forEach(_),s=k(o),a=ie(o,"A",{href:!0,style:!0,"data-svelte-h":!0}),Ye(a)!=="svelte-80akn7"&&(a.textContent=u),b=k(o),y=ie(o,"H1",{class:!0,id:!0,"data-svelte-h":!0}),Ye(y)!=="svelte-svrh1s"&&(y.innerHTML=H),p=k(o),C(E.$$.fragment,o),f=k(o),K&&K.l(o),F=k(o),ee&&ee.l(o),V=k(o),te&&te.l(o),le=k(o),re&&re.l(o),U=k(o),Q&&Q.l(o),x=k(o),Y&&Y.l(o),P=k(o),Z&&Z.l(o),z=k(o),ae&&ae.l(o),O=k(o),B=ie(o,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ye(B)!=="svelte-u2a51w"&&(B.innerHTML=$),q=k(o),C(J.$$.fragment,o),fe=k(o),W=ie(o,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ye(W)!=="svelte-17gzc6e"&&(W.innerHTML=ke),N=k(o),C(M.$$.fragment,o),I=k(o),D=ie(o,"H2",{class:!0,id:!0,"data-svelte-h":!0}),Ye(D)!=="svelte-8fluv6"&&(D.innerHTML=i),S=k(o),C(de.$$.fragment,o),$e=k(o),C(oe.$$.fragment,o),ce=k(o),me=ie(o,"H3",{class:!0,id:!0,"data-svelte-h":!0}),Ye(me)!=="svelte-6pkvoo"&&(me.innerHTML=Ae),He=k(o),C(se.$$.fragment,o),_e=k(o),be=ie(o,"H3",{class:!0,id:!0,"data-svelte-h":!0}),Ye(be)!=="svelte-1g1rrex"&&(be.innerHTML=Re),Oe=k(o),C(ve.$$.fragment,o),Te=k(o),C(ge.$$.fragment,o),Ie=k(o),Be=ie(o,"HR",{class:!0}),ze=k(o),C(Se.$$.fragment,o),we=k(o),C(pe.$$.fragment,o),Le=k(o),C(Me.$$.fragment,o),je=k(o),C(Ee.$$.fragment,o),qe=k(o),C(ye.$$.fragment,o),this.h()},h(){A(r,"name","twitter:card"),A(r,"content","summary_large_image"),A(e,"name","twitter:site"),A(e,"content","@evidence_dev"),A(a,"href","/lab/"),We(a,"display","inline-flex"),We(a,"align-items","center"),We(a,"gap","6px"),We(a,"padding","6px 14px"),We(a,"background","#f1f5f9"),We(a,"border","1px solid #e2e8f0"),We(a,"border-radius","8px"),We(a,"color","#475569"),We(a,"text-decoration","none"),We(a,"font-size","0.85rem"),We(a,"margin-bottom","1rem"),A(y,"class","markdown"),A(y,"id","analyse-geographique"),A(B,"class","markdown"),A(B,"id","flux-region-vers-secteur"),A(W,"class","markdown"),A(W,"id","heatmap--performance-moyenne-par-region-et-secteur"),A(D,"class","markdown"),A(D,"id","capitalisation-par-region-et-secteur"),A(me,"class","markdown"),A(me,"id","synthese-par-region"),A(be,"class","markdown"),A(be,"id","detail-par-pays"),A(Be,"class","markdown")},m(o,c){he&&he.m(o,c),g(o,t,c),Ge.m(document.head,null),lt(document.head,r),lt(document.head,e),Ce&&Ce.m(document.head,null),lt(document.head,n),g(o,s,c),g(o,a,c),g(o,b,c),g(o,y,c),g(o,p,c),h(E,o,c),g(o,f,c),K&&K.m(o,c),g(o,F,c),ee&&ee.m(o,c),g(o,V,c),te&&te.m(o,c),g(o,le,c),re&&re.m(o,c),g(o,U,c),Q&&Q.m(o,c),g(o,x,c),Y&&Y.m(o,c),g(o,P,c),Z&&Z.m(o,c),g(o,z,c),ae&&ae.m(o,c),g(o,O,c),g(o,B,c),g(o,q,c),h(J,o,c),g(o,fe,c),g(o,W,c),g(o,N,c),h(M,o,c),g(o,I,c),g(o,D,c),g(o,S,c),h(de,o,c),g(o,$e,c),h(oe,o,c),g(o,ce,c),g(o,me,c),g(o,He,c),h(se,o,c),g(o,_e,c),g(o,be,c),g(o,Oe,c),h(ve,o,c),g(o,Te,c),h(ge,o,c),g(o,Ie,c),g(o,Be,c),g(o,ze,c),h(Se,o,c),g(o,we,c),h(pe,o,c),g(o,Le,c),h(Me,o,c),g(o,je,c),h(Ee,o,c),g(o,qe,c),h(ye,o,c),T=!0},p(o,c){typeof j<"u"&&j.title&&j.hide_title!==!0&&he.p(o,c),Ge.p(o,c),typeof j=="object"&&Ce.p(o,c);const Xe={};c[2]&33554432&&(Xe.$$scope={dirty:c,ctx:o}),E.$set(Xe),o[0]?K?(K.p(o,c),c[0]&1&&m(K,1)):(K=qt(o),K.c(),m(K,1),K.m(F.parentNode,F)):K&&(Ne(),d(K,1,1,()=>{K=null}),Pe()),o[1]?ee?(ee.p(o,c),c[0]&2&&m(ee,1)):(ee=Ft(o),ee.c(),m(ee,1),ee.m(V.parentNode,V)):ee&&(Ne(),d(ee,1,1,()=>{ee=null}),Pe()),o[2]?te?(te.p(o,c),c[0]&4&&m(te,1)):(te=Ht(o),te.c(),m(te,1),te.m(le.parentNode,le)):te&&(Ne(),d(te,1,1,()=>{te=null}),Pe()),o[3]?re?(re.p(o,c),c[0]&8&&m(re,1)):(re=Mt(o),re.c(),m(re,1),re.m(U.parentNode,U)):re&&(Ne(),d(re,1,1,()=>{re=null}),Pe()),o[4]?Q?(Q.p(o,c),c[0]&16&&m(Q,1)):(Q=Dt(o),Q.c(),m(Q,1),Q.m(x.parentNode,x)):Q&&(Ne(),d(Q,1,1,()=>{Q=null}),Pe()),o[5]?Y?(Y.p(o,c),c[0]&32&&m(Y,1)):(Y=At(o),Y.c(),m(Y,1),Y.m(P.parentNode,P)):Y&&(Ne(),d(Y,1,1,()=>{Y=null}),Pe()),o[6]?Z?(Z.p(o,c),c[0]&64&&m(Z,1)):(Z=It(o),Z.c(),m(Z,1),Z.m(z.parentNode,z)):Z&&(Ne(),d(Z,1,1,()=>{Z=null}),Pe()),o[7]?ae?(ae.p(o,c),c[0]&128&&m(ae,1)):(ae=Lt(o),ae.c(),m(ae,1),ae.m(O.parentNode,O)):ae&&(Ne(),d(ae,1,1,()=>{ae=null}),Pe());const Je={};c[0]&1&&(Je.data=o[0]),J.$set(Je);const Ke={};c[0]&2&&(Ke.data=o[1]),M.$set(Ke);const rt={};c[0]&4&&(rt.data=o[2]),de.$set(rt);const at={};c[0]&48|c[2]&33554432&&(at.$$scope={dirty:c,ctx:o}),oe.$set(at);const xe={};c[0]&64&&(xe.data=o[6]),c[2]&33554432&&(xe.$$scope={dirty:c,ctx:o}),se.$set(xe);const L={};c[0]&8&&(L.data=o[3]),c[2]&33554432&&(L.$$scope={dirty:c,ctx:o}),ve.$set(L);const st={};c[0]&3968|c[2]&33554432&&(st.$$scope={dirty:c,ctx:o}),ge.$set(st);const dt={};c[2]&33554432&&(dt.$$scope={dirty:c,ctx:o}),Se.$set(dt);const $t={};c[2]&33554432&&($t.$$scope={dirty:c,ctx:o}),pe.$set($t);const bt={};c[2]&33554432&&(bt.$$scope={dirty:c,ctx:o}),Me.$set(bt);const yt={};c[2]&33554432&&(yt.$$scope={dirty:c,ctx:o}),Ee.$set(yt);const kt={};c[2]&33554432&&(kt.$$scope={dirty:c,ctx:o}),ye.$set(kt)},i(o){T||(m(E.$$.fragment,o),m(K),m(ee),m(te),m(re),m(Q),m(Y),m(Z),m(ae),m(J.$$.fragment,o),m(M.$$.fragment,o),m(de.$$.fragment,o),m(oe.$$.fragment,o),m(se.$$.fragment,o),m(ve.$$.fragment,o),m(ge.$$.fragment,o),m(Se.$$.fragment,o),m(pe.$$.fragment,o),m(Me.$$.fragment,o),m(Ee.$$.fragment,o),m(ye.$$.fragment,o),T=!0)},o(o){d(E.$$.fragment,o),d(K),d(ee),d(te),d(re),d(Q),d(Y),d(Z),d(ae),d(J.$$.fragment,o),d(M.$$.fragment,o),d(de.$$.fragment,o),d(oe.$$.fragment,o),d(se.$$.fragment,o),d(ve.$$.fragment,o),d(ge.$$.fragment,o),d(Se.$$.fragment,o),d(pe.$$.fragment,o),d(Me.$$.fragment,o),d(Ee.$$.fragment,o),d(ye.$$.fragment,o),T=!1},d(o){o&&(_(t),_(s),_(a),_(b),_(y),_(p),_(f),_(F),_(V),_(le),_(U),_(x),_(P),_(z),_(O),_(B),_(q),_(fe),_(W),_(N),_(I),_(D),_(S),_($e),_(ce),_(me),_(He),_(_e),_(be),_(Oe),_(Te),_(Ie),_(Be),_(ze),_(we),_(Le),_(je),_(qe)),he&&he.d(o),Ge.d(o),_(r),_(e),Ce&&Ce.d(o),_(n),w(E,o),K&&K.d(o),ee&&ee.d(o),te&&te.d(o),re&&re.d(o),Q&&Q.d(o),Y&&Y.d(o),Z&&Z.d(o),ae&&ae.d(o),w(J,o),w(M,o),w(de,o),w(oe,o),w(se,o),w(ve,o),w(ge,o),w(Se,o),w(pe,o),w(Me,o),w(Ee,o),w(ye,o)}}}const j={title:"Analyse Geographique"};function la(l,t,r){let e,n;wt(l,yr,L=>r(63,e=L)),wt(l,Tt,L=>r(68,n=L));let{data:s}=t,{data:a={},customFormattingSettings:u,__db:b,inputs:y}=s;Xt(Tt,n="36a9a17f2f25c40e261578afe03e4b60",n);let H=ur(_r(y));Jt(H.subscribe(L=>r(14,y=L))),Kt(mr,{getCustomFormats:()=>u.customFormats||[]});const p=(L,st)=>br(b.query,L,{query_name:st});fr(p),e.params,Zt(()=>!0);let E={initialData:void 0,initialError:void 0},f=ne`select
    region as source,
    sector as target,
    count(*) as amount
from market.stocks
where region is not null and sector is not null
group by region, sector
order by amount desc`,F=`select
    region as source,
    sector as target,
    count(*) as amount
from market.stocks
where region is not null and sector is not null
group by region, sector
order by amount desc`;a.sankey_flows_data&&(a.sankey_flows_data instanceof Error?E.initialError=a.sankey_flows_data:E.initialData=a.sankey_flows_data,a.sankey_flows_columns&&(E.knownColumns=a.sankey_flows_columns));let V,le=!1;const U=De.createReactive({callback:L=>{r(0,V=L)},execFn:p},{id:"sankey_flows",...E});U(F,{noResolve:f,...E}),globalThis[Symbol.for("sankey_flows")]={get value(){return V}};let x={initialData:void 0,initialError:void 0},P=ne`select
    region,
    sector,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, sector`,z=`select
    region,
    sector,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, sector`;a.heatmap_region_sector_data&&(a.heatmap_region_sector_data instanceof Error?x.initialError=a.heatmap_region_sector_data:x.initialData=a.heatmap_region_sector_data,a.heatmap_region_sector_columns&&(x.knownColumns=a.heatmap_region_sector_columns));let O,B=!1;const $=De.createReactive({callback:L=>{r(1,O=L)},execFn:p},{id:"heatmap_region_sector",...x});$(z,{noResolve:P,...x}),globalThis[Symbol.for("heatmap_region_sector")]={get value(){return O}};let q={initialData:void 0,initialError:void 0},J=ne`select
    region,
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, total_mcap desc`,fe=`select
    region,
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, total_mcap desc`;a.mcap_by_region_sector_data&&(a.mcap_by_region_sector_data instanceof Error?q.initialError=a.mcap_by_region_sector_data:q.initialData=a.mcap_by_region_sector_data,a.mcap_by_region_sector_columns&&(q.knownColumns=a.mcap_by_region_sector_columns));let W,ke=!1;const N=De.createReactive({callback:L=>{r(2,W=L)},execFn:p},{id:"mcap_by_region_sector",...q});N(fe,{noResolve:J,...q}),globalThis[Symbol.for("mcap_by_region_sector")]={get value(){return W}};let M={initialData:void 0,initialError:void 0},I=ne`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where country is not null
group by country
order by total_mcap desc`,D=`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where country is not null
group by country
order by total_mcap desc`;a.country_summary_data&&(a.country_summary_data instanceof Error?M.initialError=a.country_summary_data:M.initialData=a.country_summary_data,a.country_summary_columns&&(M.knownColumns=a.country_summary_columns));let i,S=!1;const de=De.createReactive({callback:L=>{r(3,i=L)},execFn:p},{id:"country_summary",...M});de(D,{noResolve:I,...M}),globalThis[Symbol.for("country_summary")]={get value(){return i}};let $e={initialData:void 0,initialError:void 0},oe=ne`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where country is not null
group by country
order by total_mcap desc
limit 15`,ce=`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where country is not null
group by country
order by total_mcap desc
limit 15`;a.top15_countries_mcap_data&&(a.top15_countries_mcap_data instanceof Error?$e.initialError=a.top15_countries_mcap_data:$e.initialData=a.top15_countries_mcap_data,a.top15_countries_mcap_columns&&($e.knownColumns=a.top15_countries_mcap_columns));let me,Ae=!1;const He=De.createReactive({callback:L=>{r(4,me=L)},execFn:p},{id:"top15_countries_mcap",...$e});He(ce,{noResolve:oe,...$e}),globalThis[Symbol.for("top15_countries_mcap")]={get value(){return me}};let se={initialData:void 0,initialError:void 0},_e=ne`select
    region,
    count(*) as nb_stocks
from market.stocks
where region is not null
group by region
order by nb_stocks desc`,be=`select
    region,
    count(*) as nb_stocks
from market.stocks
where region is not null
group by region
order by nb_stocks desc`;a.funnel_region_data&&(a.funnel_region_data instanceof Error?se.initialError=a.funnel_region_data:se.initialData=a.funnel_region_data,a.funnel_region_columns&&(se.knownColumns=a.funnel_region_columns));let Re,Oe=!1;const ve=De.createReactive({callback:L=>{r(5,Re=L)},execFn:p},{id:"funnel_region",...se});ve(be,{noResolve:_e,...se}),globalThis[Symbol.for("funnel_region")]={get value(){return Re}};let Te={initialData:void 0,initialError:void 0},ge=ne`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null
group by region
order by total_mcap desc`,Ie=`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null
group by region
order by total_mcap desc`;a.region_overview_data&&(a.region_overview_data instanceof Error?Te.initialError=a.region_overview_data:Te.initialData=a.region_overview_data,a.region_overview_columns&&(Te.knownColumns=a.region_overview_columns));let Be,ze=!1;const Se=De.createReactive({callback:L=>{r(6,Be=L)},execFn:p},{id:"region_overview",...Te});Se(Ie,{noResolve:ge,...Te}),globalThis[Symbol.for("region_overview")]={get value(){return Be}};let we={initialData:void 0,initialError:void 0},pe=ne`select distinct region as value, region as label
from market.stocks
where region is not null
order by region`,Le=`select distinct region as value, region as label
from market.stocks
where region is not null
order by region`;a.region_list_btn_data&&(a.region_list_btn_data instanceof Error?we.initialError=a.region_list_btn_data:we.initialData=a.region_list_btn_data,a.region_list_btn_columns&&(we.knownColumns=a.region_list_btn_columns));let Me,je=!1;const Ee=De.createReactive({callback:L=>{r(7,Me=L)},execFn:p},{id:"region_list_btn",...we});Ee(Le,{noResolve:pe,...we}),globalThis[Symbol.for("region_list_btn")]={get value(){return Me}};let qe={initialData:void 0,initialError:void 0},ye=ne`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${y.region_select.value}'`,T=`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${y.region_select.value}'`;a.rg_stats_data&&(a.rg_stats_data instanceof Error?qe.initialError=a.rg_stats_data:qe.initialData=a.rg_stats_data,a.rg_stats_columns&&(qe.knownColumns=a.rg_stats_columns));let he,G=!1;const Fe=De.createReactive({callback:L=>{r(8,he=L)},execFn:p},{id:"rg_stats",...qe});Fe(T,{noResolve:ye,...qe}),globalThis[Symbol.for("rg_stats")]={get value(){return he}};let Ge={initialData:void 0,initialError:void 0},Ce=ne`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${y.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc`,K=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${y.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc`;a.rg_sector_breakdown_data&&(a.rg_sector_breakdown_data instanceof Error?Ge.initialError=a.rg_sector_breakdown_data:Ge.initialData=a.rg_sector_breakdown_data,a.rg_sector_breakdown_columns&&(Ge.knownColumns=a.rg_sector_breakdown_columns));let ee,te=!1;const re=De.createReactive({callback:L=>{r(9,ee=L)},execFn:p},{id:"rg_sector_breakdown",...Ge});re(K,{noResolve:Ce,...Ge}),globalThis[Symbol.for("rg_sector_breakdown")]={get value(){return ee}};let Q={initialData:void 0,initialError:void 0},Y=ne`select
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region = '${y.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc`,Z=`select
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region = '${y.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc`;a.rg_sector_mcap_data&&(a.rg_sector_mcap_data instanceof Error?Q.initialError=a.rg_sector_mcap_data:Q.initialData=a.rg_sector_mcap_data,a.rg_sector_mcap_columns&&(Q.knownColumns=a.rg_sector_mcap_columns));let ae,o=!1;const c=De.createReactive({callback:L=>{r(10,ae=L)},execFn:p},{id:"rg_sector_mcap",...Q});c(Z,{noResolve:Y,...Q}),globalThis[Symbol.for("rg_sector_mcap")]={get value(){return ae}};let Xe={initialData:void 0,initialError:void 0},Je=ne`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    revenue_growth,
    profit_margin,
    sector,
    country
from market.stocks
where region = '${y.region_select.value}'
order by market_cap desc
limit 20`,Ke=`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    revenue_growth,
    profit_margin,
    sector,
    country
from market.stocks
where region = '${y.region_select.value}'
order by market_cap desc
limit 20`;a.rg_top_stocks_data&&(a.rg_top_stocks_data instanceof Error?Xe.initialError=a.rg_top_stocks_data:Xe.initialData=a.rg_top_stocks_data,a.rg_top_stocks_columns&&(Xe.knownColumns=a.rg_top_stocks_columns));let rt,at=!1;const xe=De.createReactive({callback:L=>{r(11,rt=L)},execFn:p},{id:"rg_top_stocks",...Xe});return xe(Ke,{noResolve:Je,...Xe}),globalThis[Symbol.for("rg_top_stocks")]={get value(){return rt}},l.$$set=L=>{"data"in L&&r(12,s=L.data)},l.$$.update=()=>{l.$$.dirty[0]&4096&&r(13,{data:a={},customFormattingSettings:u,__db:b}=s,a),l.$$.dirty[0]&8192&&cr.set(Object.keys(a).length>0),l.$$.dirty[2]&2&&e.params,l.$$.dirty[0]&491520&&(f||!le?f||(U(F,{noResolve:f,...E}),r(18,le=!0)):U(F,{noResolve:f})),l.$$.dirty[0]&7864320&&(P||!B?P||($(z,{noResolve:P,...x}),r(22,B=!0)):$(z,{noResolve:P})),l.$$.dirty[0]&125829120&&(J||!ke?J||(N(fe,{noResolve:J,...q}),r(26,ke=!0)):N(fe,{noResolve:J})),l.$$.dirty[0]&2013265920&&(I||!S?I||(de(D,{noResolve:I,...M}),r(30,S=!0)):de(D,{noResolve:I})),l.$$.dirty[1]&15&&(oe||!Ae?oe||(He(ce,{noResolve:oe,...$e}),r(34,Ae=!0)):He(ce,{noResolve:oe})),l.$$.dirty[1]&240&&(_e||!Oe?_e||(ve(be,{noResolve:_e,...se}),r(38,Oe=!0)):ve(be,{noResolve:_e})),l.$$.dirty[1]&3840&&(ge||!ze?ge||(Se(Ie,{noResolve:ge,...Te}),r(42,ze=!0)):Se(Ie,{noResolve:ge})),l.$$.dirty[1]&61440&&(pe||!je?pe||(Ee(Le,{noResolve:pe,...we}),r(46,je=!0)):Ee(Le,{noResolve:pe})),l.$$.dirty[0]&16384&&r(48,ye=ne`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${y.region_select.value}'`),l.$$.dirty[0]&16384&&r(49,T=`select
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${y.region_select.value}'`),l.$$.dirty[1]&983040&&(ye||!G?ye||(Fe(T,{noResolve:ye,...qe}),r(50,G=!0)):Fe(T,{noResolve:ye})),l.$$.dirty[0]&16384&&r(52,Ce=ne`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${y.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc`),l.$$.dirty[0]&16384&&r(53,K=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region = '${y.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc`),l.$$.dirty[1]&15728640&&(Ce||!te?Ce||(re(K,{noResolve:Ce,...Ge}),r(54,te=!0)):re(K,{noResolve:Ce})),l.$$.dirty[0]&16384&&r(56,Y=ne`select
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region = '${y.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc`),l.$$.dirty[0]&16384&&r(57,Z=`select
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region = '${y.region_select.value}'
  and sector is not null
group by sector
order by total_mcap desc`),l.$$.dirty[1]&251658240&&(Y||!o?Y||(c(Z,{noResolve:Y,...Q}),r(58,o=!0)):c(Z,{noResolve:Y})),l.$$.dirty[0]&16384&&r(60,Je=ne`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    revenue_growth,
    profit_margin,
    sector,
    country
from market.stocks
where region = '${y.region_select.value}'
order by market_cap desc
limit 20`),l.$$.dirty[0]&16384&&r(61,Ke=`select
    symbol,
    name,
    price,
    change_pct,
    market_cap,
    pe_forward,
    dividend_yield,
    revenue_growth,
    profit_margin,
    sector,
    country
from market.stocks
where region = '${y.region_select.value}'
order by market_cap desc
limit 20`),l.$$.dirty[1]&1879048192|l.$$.dirty[2]&1&&(Je||!at?Je||(xe(Ke,{noResolve:Je,...Xe}),r(62,at=!0)):xe(Ke,{noResolve:Je}))},r(16,f=ne`select
    region as source,
    sector as target,
    count(*) as amount
from market.stocks
where region is not null and sector is not null
group by region, sector
order by amount desc`),r(17,F=`select
    region as source,
    sector as target,
    count(*) as amount
from market.stocks
where region is not null and sector is not null
group by region, sector
order by amount desc`),r(20,P=ne`select
    region,
    sector,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, sector`),r(21,z=`select
    region,
    sector,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, sector`),r(24,J=ne`select
    region,
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, total_mcap desc`),r(25,fe=`select
    region,
    sector,
    sum(market_cap) as total_mcap
from market.stocks
where region is not null and sector is not null
group by region, sector
order by region, total_mcap desc`),r(28,I=ne`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where country is not null
group by country
order by total_mcap desc`),r(29,D=`select
    country,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where country is not null
group by country
order by total_mcap desc`),r(32,oe=ne`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where country is not null
group by country
order by total_mcap desc
limit 15`),r(33,ce=`select
    country,
    sum(market_cap) as total_mcap
from market.stocks
where country is not null
group by country
order by total_mcap desc
limit 15`),r(36,_e=ne`select
    region,
    count(*) as nb_stocks
from market.stocks
where region is not null
group by region
order by nb_stocks desc`),r(37,be=`select
    region,
    count(*) as nb_stocks
from market.stocks
where region is not null
group by region
order by nb_stocks desc`),r(40,ge=ne`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null
group by region
order by total_mcap desc`),r(41,Ie=`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div,
    round(avg(change_pct), 2) as avg_change
from market.stocks
where region is not null
group by region
order by total_mcap desc`),r(44,pe=ne`select distinct region as value, region as label
from market.stocks
where region is not null
order by region`),r(45,Le=`select distinct region as value, region as label
from market.stocks
where region is not null
order by region`),[V,O,W,i,me,Re,Be,Me,he,ee,ae,rt,s,a,y,E,f,F,le,x,P,z,B,q,J,fe,ke,M,I,D,S,$e,oe,ce,Ae,se,_e,be,Oe,Te,ge,Ie,ze,we,pe,Le,je,qe,ye,T,G,Ge,Ce,K,te,Q,Y,Z,o,Xe,Je,Ke,at,e]}class ka extends _t{constructor(t){super(),gt(this,t,la,sa,mt,{data:12},null,[-1,-1,-1])}}export{ka as component};
