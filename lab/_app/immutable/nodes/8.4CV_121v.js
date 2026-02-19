import{s as xi,m as di,d,b as V,i as u,a as Tt,f as W,w as Tr,e as $,l as Z,k as g,n as ea,r as pi,t as ft,u as mt,v as st,M as ci,C as na,c as ht,h as sa,g as dr,j as pe,o as oa,p as _a,q as fa,x as ma}from"../chunks/scheduler.gCtXCaAC.js";import{S as ta,i as ra,d as w,t as p,a as m,m as k,b as y,e as h,g as de,c as ue}from"../chunks/index.DmJzZqpA.js";import{q as da,t as ua,u as pa,v as ca,e as $a,s as ga,Q as ge,p as va,a as $i,D as Dt,b as ia,C as A,d as gi,r as vi,c as ba}from"../chunks/VennDiagram.svelte_svelte_type_style_lang.xVnsThWF.js";import{w as wa}from"../chunks/entry.t5gz319j.js";import{A as ka,B as Rt,T as ya,L as Rr,Q as ve,a as Er,b as It}from"../chunks/BigValue.vcBvE0eY.js";import{h as O,p as ha}from"../chunks/setTrackProxy.DjIbdjlZ.js";import{H as Ra}from"../chunks/HiddenInPrint.DPJoLMT8.js";import{c as Ta}from"../chunks/checkRequiredProps.o_C_V3S5.js";import{D as qa,a as aa}from"../chunks/Dropdown.XHrE_Wqs.js";import{B as Ea,a as Fr}from"../chunks/ButtonGroup.DrUuNe7L.js";import{p as Fa}from"../chunks/stores.CdFJQivx.js";import{S as mi}from"../chunks/Slider.Bbm4iusj.js";import{B as ui}from"../chunks/BubbleChart.CKh_rRrf.js";function bi(o){let t,i,e,n,s=o[3]&&wi(o);return{c(){t=Z("span"),i=mt(o[0]),e=g(),s&&s.c(),this.h()},l(a){t=W(a,"SPAN",{class:!0});var R=Tr(t);i=ft(R,o[0]),e=$(R),s&&s.l(R),R.forEach(d),this.h()},h(){V(t,"class","text-xs font-medium block mb-0.5")},m(a,R){u(a,t,R),Tt(t,i),Tt(t,e),s&&s.m(t,null),n=!0},p(a,R){(!n||R&1)&&pi(i,a[0]),a[3]?s?(s.p(a,R),R&8&&m(s,1)):(s=wi(a),s.c(),m(s,1),s.m(t,null)):s&&(de(),p(s,1,1,()=>{s=null}),ue())},i(a){n||(m(s),n=!0)},o(a){p(s),n=!1},d(a){a&&d(t),s&&s.d()}}}function wi(o){let t,i;return t=new ca({props:{description:o[3]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n&8&&(s.description=e[3]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ca(o){let t,i,e;return{c(){t=Z("input"),this.h()},l(n){t=W(n,"INPUT",{class:!0,placeholder:!0}),this.h()},h(){V(t,"class","font-medium border pb-1 pt-[3px] h-8 border-base-300 bg-base-100 pr-3 rounded-md px-2 sm:text-xs max-w-fit bg-transparent cursor-text bg-right bg-no-repeat focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-base-content-muted shadow-sm text-base placeholder:font-normal placeholder:text-base-content-muted/80"),V(t,"placeholder",o[2])},m(n,s){u(n,t,s),ci(t,o[4]),i||(e=na(t,"input",o[11]),i=!0)},p(n,s){s&4&&V(t,"placeholder",n[2]),s&16&&t.value!==n[4]&&ci(t,n[4])},i:st,o:st,d(n){n&&d(t),i=!1,e()}}}function Da(o){let t,i;return t=new pa({props:{inputType:"TextInput",error:o[6],height:"32",width:"246"}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p:st,i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ha(o){let t,i,e,n,s,a,R=o[0]&&bi(o);const C=[Da,Ca],r=[];function F(c,I){return c[6].length?0:1}return e=F(o),n=r[e]=C[e](o),{c(){t=Z("div"),R&&R.c(),i=g(),n.c(),this.h()},l(c){t=W(c,"DIV",{class:!0});var I=Tr(t);R&&R.l(I),i=$(I),n.l(I),I.forEach(d),this.h()},h(){V(t,"class",s=`${o[0]?"-mt-0.5":"mt-2"} mb-4 ml-0 mr-2 inline-block align-bottom`)},m(c,I){u(c,t,I),R&&R.m(t,null),Tt(t,i),r[e].m(t,null),a=!0},p(c,I){c[0]?R?(R.p(c,I),I&1&&m(R,1)):(R=bi(c),R.c(),m(R,1),R.m(t,i)):R&&(de(),p(R,1,1,()=>{R=null}),ue()),n.p(c,I),(!a||I&1&&s!==(s=`${c[0]?"-mt-0.5":"mt-2"} mb-4 ml-0 mr-2 inline-block align-bottom`))&&V(t,"class",s)},i(c){a||(m(R),m(n),a=!0)},o(c){p(R),p(n),a=!1},d(c){c&&d(t),R&&R.d(),r[e].d()}}}function Ia(o){let t,i;return t=new Ra({props:{enabled:o[1],$$slots:{default:[Ha]},$$scope:{ctx:o}}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,[n]){const s={};n&2&&(s.enabled=e[1]),n&16413&&(s.$$scope={dirty:n,ctx:e}),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Sa(o,t,i){let e;const n=da();di(o,n,f=>i(12,e=f));let{title:s}=t,{name:a}=t,{hideDuringPrint:R=!0}=t,{placeholder:C="Type to search"}=t,{defaultValue:r=void 0}=t,{description:F=void 0}=t,{unsafe:c=!1}=t,I=!1;const M=()=>{let f=P;c||(f=f.replaceAll("'","''")),ea(n,e[a]={toString(){return f},sql:`'${f}'`,search:S=>`damerau_levenshtein(${S}, '${f}')`},e)};let P=r;typeof r<"u"&&M();let q=[];try{Ta({name:a})}catch(f){q.push(f.message)}function N(){P=this.value,i(4,P)}return o.$$set=f=>{"title"in f&&i(0,s=f.title),"name"in f&&i(8,a=f.name),"hideDuringPrint"in f&&i(1,R=f.hideDuringPrint),"placeholder"in f&&i(2,C=f.placeholder),"defaultValue"in f&&i(9,r=f.defaultValue),"description"in f&&i(3,F=f.description),"unsafe"in f&&i(7,c=f.unsafe)},o.$$.update=()=>{o.$$.dirty&128&&i(7,c=ua(c)),o.$$.dirty&1040&&(P&&i(10,I=!0),I&&M())},[s,R,C,F,P,n,q,c,a,r,I,N]}class Ma extends ta{constructor(t){super(),ra(this,t,Sa,Ia,xi,{title:0,name:8,hideDuringPrint:1,placeholder:2,defaultValue:9,description:3,unsafe:7})}}function ki(o,t,i){const e=o.slice();return e[192]=t[i],e}function La(o){let t,i=Le.title+"",e;return{c(){t=Z("h1"),e=mt(i),this.h()},l(n){t=W(n,"H1",{class:!0});var s=Tr(t);e=ft(s,i),s.forEach(d),this.h()},h(){V(t,"class","title")},m(n,s){u(n,t,s),Tt(t,e)},p:st,d(n){n&&d(t)}}}function Aa(o){return{c(){this.h()},l(t){this.h()},h(){document.title="Evidence"},m:st,p:st,d:st}}function Pa(o){let t,i,e,n,s;return document.title=t=Le.title,{c(){i=g(),e=Z("meta"),n=g(),s=Z("meta"),this.h()},l(a){i=$(a),e=W(a,"META",{property:!0,content:!0}),n=$(a),s=W(a,"META",{name:!0,content:!0}),this.h()},h(){var a,R;V(e,"property","og:title"),V(e,"content",((a=Le.og)==null?void 0:a.title)??Le.title),V(s,"name","twitter:title"),V(s,"content",((R=Le.og)==null?void 0:R.title)??Le.title)},m(a,R){u(a,i,R),u(a,e,R),u(a,n,R),u(a,s,R)},p(a,R){R&0&&t!==(t=Le.title)&&(document.title=t)},d(a){a&&(d(i),d(e),d(n),d(s))}}}function Na(o){var s;let t,i,e=Ua(),n=((s=Le.og)==null?void 0:s.image)&&Va();return{c(){e&&e.c(),t=g(),n&&n.c(),i=dr()},l(a){e&&e.l(a),t=$(a),n&&n.l(a),i=dr()},m(a,R){e&&e.m(a,R),u(a,t,R),n&&n.m(a,R),u(a,i,R)},p(a,R){var C;e.p(a,R),(C=Le.og)!=null&&C.image&&n.p(a,R)},d(a){a&&(d(t),d(i)),e&&e.d(a),n&&n.d(a)}}}function Ua(o){let t,i,e,n,s;return{c(){t=Z("meta"),i=g(),e=Z("meta"),n=g(),s=Z("meta"),this.h()},l(a){t=W(a,"META",{name:!0,content:!0}),i=$(a),e=W(a,"META",{property:!0,content:!0}),n=$(a),s=W(a,"META",{name:!0,content:!0}),this.h()},h(){var a,R;V(t,"name","description"),V(t,"content",Le.description),V(e,"property","og:description"),V(e,"content",((a=Le.og)==null?void 0:a.description)??Le.description),V(s,"name","twitter:description"),V(s,"content",((R=Le.og)==null?void 0:R.description)??Le.description)},m(a,R){u(a,t,R),u(a,i,R),u(a,e,R),u(a,n,R),u(a,s,R)},p:st,d(a){a&&(d(t),d(i),d(e),d(n),d(s))}}}function Va(o){let t,i,e;return{c(){t=Z("meta"),i=g(),e=Z("meta"),this.h()},l(n){t=W(n,"META",{property:!0,content:!0}),i=$(n),e=W(n,"META",{name:!0,content:!0}),this.h()},h(){var n,s;V(t,"property","og:image"),V(t,"content",$i((n=Le.og)==null?void 0:n.image)),V(e,"name","twitter:image"),V(e,"content",$i((s=Le.og)==null?void 0:s.image))},m(n,s){u(n,t,s),u(n,i,s),u(n,e,s)},p:st,d(n){n&&(d(t),d(i),d(e))}}}function yi(o){let t,i;return t=new ve({props:{queryID:"all_stocks",queryResult:o[0]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&1&&(s.queryResult=e[0]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function hi(o){let t,i;return t=new ve({props:{queryID:"static_count",queryResult:o[1]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&2&&(s.queryResult=e[1]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ri(o){let t,i;return t=new ve({props:{queryID:"static_avg_pe",queryResult:o[2]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&4&&(s.queryResult=e[2]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ti(o){let t,i;return t=new ve({props:{queryID:"static_total_mcap",queryResult:o[3]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&8&&(s.queryResult=e[3]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function qi(o){let t,i;return t=new ve({props:{queryID:"static_avg_div",queryResult:o[4]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&16&&(s.queryResult=e[4]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ei(o){let t,i;return t=new ve({props:{queryID:"static_avg_beta",queryResult:o[5]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&32&&(s.queryResult=e[5]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Fi(o){let t,i;return t=new ve({props:{queryID:"static_median_pe",queryResult:o[6]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&64&&(s.queryResult=e[6]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ci(o){let t,i;return t=new ve({props:{queryID:"bubble_all",queryResult:o[7]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&128&&(s.queryResult=e[7]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Di(o){let t,i;return t=new ve({props:{queryID:"pe_distribution",queryResult:o[8]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&256&&(s.queryResult=e[8]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Hi(o){let t,i;return t=new ve({props:{queryID:"top20_mcap",queryResult:o[9]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&512&&(s.queryResult=e[9]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ii(o){let t,i;return t=new ve({props:{queryID:"top20_volume",queryResult:o[10]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&1024&&(s.queryResult=e[10]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Si(o){let t,i;return t=new ve({props:{queryID:"reco_breakdown",queryResult:o[11]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&2048&&(s.queryResult=e[11]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Mi(o){let t,i;return t=new ve({props:{queryID:"top_gainers",queryResult:o[12]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&4096&&(s.queryResult=e[12]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Li(o){let t,i;return t=new ve({props:{queryID:"top_losers",queryResult:o[13]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&8192&&(s.queryResult=e[13]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ai(o){let t,i;return t=new ve({props:{queryID:"sector_mcap_treemap",queryResult:o[14]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&16384&&(s.queryResult=e[14]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Pi(o){let t,i;return t=new ve({props:{queryID:"region_breakdown",queryResult:o[15]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&32768&&(s.queryResult=e[15]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ni(o){let t,i;return t=new ve({props:{queryID:"high_dividend",queryResult:o[16]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&65536&&(s.queryResult=e[16]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ui(o){let t,i;return t=new ve({props:{queryID:"pe_vs_growth",queryResult:o[17]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&131072&&(s.queryResult=e[17]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Vi(o){let t,i;return t=new ve({props:{queryID:"beta_distribution",queryResult:o[18]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&262144&&(s.queryResult=e[18]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Bi(o){let t,i;return t=new ve({props:{queryID:"upside_potential",queryResult:o[19]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&524288&&(s.queryResult=e[19]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function ji(o){let t,i;return t=new ve({props:{queryID:"sector_list",queryResult:o[20]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&1048576&&(s.queryResult=e[20]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function zi(o){let t,i;return t=new ve({props:{queryID:"filtered_stocks",queryResult:o[21]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&2097152&&(s.queryResult=e[21]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Oi(o){let t,i;return t=new ve({props:{queryID:"filtered_count",queryResult:o[22]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&4194304&&(s.queryResult=e[22]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Yi(o){let t,i;return t=new ve({props:{queryID:"filtered_avg_pe",queryResult:o[23]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&8388608&&(s.queryResult=e[23]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Gi(o){let t,i;return t=new ve({props:{queryID:"filtered_total_mcap",queryResult:o[24]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&16777216&&(s.queryResult=e[24]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Qi(o){let t,i;return t=new ve({props:{queryID:"filtered_avg_div",queryResult:o[25]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&33554432&&(s.queryResult=e[25]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ji(o){let t,i;return t=new ve({props:{queryID:"filtered_avg_change",queryResult:o[26]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&67108864&&(s.queryResult=e[26]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Xi(o){let t,i;return t=new ve({props:{queryID:"filtered_bubble",queryResult:o[27]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&134217728&&(s.queryResult=e[27]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ki(o){let t,i;return t=new ve({props:{queryID:"filtered_sector_breakdown",queryResult:o[28]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&268435456&&(s.queryResult=e[28]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Wi(o){let t,i;return t=new ve({props:{queryID:"search_results",queryResult:o[29]}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&536870912&&(s.queryResult=e[29]),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Ba(o){let t,i=o[1][0].total+"",e,n,s,a="Vue Globale",R,C,r="Classements",F,c,I="Filtrage Interactif",M,P,q="Recherche",N;return{c(){t=mt("Centre de commande pour explorer "),e=mt(i),n=mt(" actions dans 11 secteurs et 3 zones geographiques. Les onglets "),s=Z("b"),s.textContent=a,R=mt(" et "),C=Z("b"),C.textContent=r,F=mt(" affichent des donnees statiques pre-rendues. L'onglet "),c=Z("b"),c.textContent=I,M=mt(" permet de filtrer dynamiquement avec 6 criteres. L'onglet "),P=Z("b"),P.textContent=q,N=mt(" permet de trouver un titre par symbole.")},l(f){t=ft(f,"Centre de commande pour explorer "),e=ft(f,i),n=ft(f," actions dans 11 secteurs et 3 zones geographiques. Les onglets "),s=W(f,"B",{"data-svelte-h":!0}),pe(s)!=="svelte-zs1g06"&&(s.textContent=a),R=ft(f," et "),C=W(f,"B",{"data-svelte-h":!0}),pe(C)!=="svelte-q5o1d8"&&(C.textContent=r),F=ft(f," affichent des donnees statiques pre-rendues. L'onglet "),c=W(f,"B",{"data-svelte-h":!0}),pe(c)!=="svelte-dp85mp"&&(c.textContent=I),M=ft(f," permet de filtrer dynamiquement avec 6 criteres. L'onglet "),P=W(f,"B",{"data-svelte-h":!0}),pe(P)!=="svelte-1215jb5"&&(P.textContent=q),N=ft(f," permet de trouver un titre par symbole.")},m(f,S){u(f,t,S),u(f,e,S),u(f,n,S),u(f,s,S),u(f,R,S),u(f,C,S),u(f,F,S),u(f,c,S),u(f,M,S),u(f,P,S),u(f,N,S)},p(f,S){S[0]&2&&i!==(i=f[1][0].total+"")&&pi(e,i)},d(f){f&&(d(t),d(e),d(n),d(s),d(R),d(C),d(F),d(c),d(M),d(P),d(N))}}}function ja(o){let t,i,e,n,s,a,R,C,r,F;return t=new A({props:{id:"region",title:"Region"}}),e=new A({props:{id:"nb_stocks",title:"Nb Actions"}}),s=new A({props:{id:"total_mcap",title:"Cap. Totale",fmt:"usd"}}),R=new A({props:{id:"avg_pe",title:"P/E Forward Moy.",fmt:"num1"}}),r=new A({props:{id:"avg_div",title:"Div Yield Moy. (%)",fmt:"num2"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment)},l(c){y(t.$$.fragment,c),i=$(c),y(e.$$.fragment,c),n=$(c),y(s.$$.fragment,c),a=$(c),y(R.$$.fragment,c),C=$(c),y(r.$$.fragment,c)},m(c,I){k(t,c,I),u(c,i,I),k(e,c,I),u(c,n,I),k(s,c,I),u(c,a,I),k(R,c,I),u(c,C,I),k(r,c,I),F=!0},p:st,i(c){F||(m(t.$$.fragment,c),m(e.$$.fragment,c),m(s.$$.fragment,c),m(R.$$.fragment,c),m(r.$$.fragment,c),F=!0)},o(c){p(t.$$.fragment,c),p(e.$$.fragment,c),p(s.$$.fragment,c),p(R.$$.fragment,c),p(r.$$.fragment,c),F=!1},d(c){c&&(d(i),d(n),d(a),d(C)),w(t,c),w(e,c),w(s,c),w(R,c),w(r,c)}}}function za(o){let t,i,e,n,s,a,R,C,r,F,c,I,M,P,q,N,f,S,H,z,D,Y,te,re,Q,ae,J,se,ne,x,K,ee,le,oe,G,_e,X,ie;return t=new A({props:{id:"symbol",title:"Ticker"}}),e=new A({props:{id:"name",title:"Nom"}}),s=new A({props:{id:"price",title:"Prix",fmt:"usd"}}),R=new A({props:{id:"change_pct",title:"Var %",fmt:"num1"}}),r=new A({props:{id:"volume",title:"Volume",fmt:"#,##0"}}),c=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),M=new A({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),q=new A({props:{id:"pe_trailing",title:"P/E Trail",fmt:"num1"}}),f=new A({props:{id:"dividend_yield",title:"Div %",fmt:"num2"}}),H=new A({props:{id:"beta",title:"Beta",fmt:"num2"}}),D=new A({props:{id:"price_to_book",title:"P/Book",fmt:"num1"}}),te=new A({props:{id:"revenue_growth",title:"Croiss. CA %",fmt:"num1"}}),Q=new A({props:{id:"profit_margin",title:"Marge Nette %",fmt:"num1"}}),J=new A({props:{id:"roe",title:"ROE %",fmt:"num1"}}),ne=new A({props:{id:"target_price",title:"Target",fmt:"usd"}}),K=new A({props:{id:"recommendation",title:"Reco."}}),le=new A({props:{id:"sector",title:"Secteur"}}),G=new A({props:{id:"region",title:"Region"}}),X=new A({props:{id:"country",title:"Pays"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment),F=g(),h(c.$$.fragment),I=g(),h(M.$$.fragment),P=g(),h(q.$$.fragment),N=g(),h(f.$$.fragment),S=g(),h(H.$$.fragment),z=g(),h(D.$$.fragment),Y=g(),h(te.$$.fragment),re=g(),h(Q.$$.fragment),ae=g(),h(J.$$.fragment),se=g(),h(ne.$$.fragment),x=g(),h(K.$$.fragment),ee=g(),h(le.$$.fragment),oe=g(),h(G.$$.fragment),_e=g(),h(X.$$.fragment)},l(_){y(t.$$.fragment,_),i=$(_),y(e.$$.fragment,_),n=$(_),y(s.$$.fragment,_),a=$(_),y(R.$$.fragment,_),C=$(_),y(r.$$.fragment,_),F=$(_),y(c.$$.fragment,_),I=$(_),y(M.$$.fragment,_),P=$(_),y(q.$$.fragment,_),N=$(_),y(f.$$.fragment,_),S=$(_),y(H.$$.fragment,_),z=$(_),y(D.$$.fragment,_),Y=$(_),y(te.$$.fragment,_),re=$(_),y(Q.$$.fragment,_),ae=$(_),y(J.$$.fragment,_),se=$(_),y(ne.$$.fragment,_),x=$(_),y(K.$$.fragment,_),ee=$(_),y(le.$$.fragment,_),oe=$(_),y(G.$$.fragment,_),_e=$(_),y(X.$$.fragment,_)},m(_,L){k(t,_,L),u(_,i,L),k(e,_,L),u(_,n,L),k(s,_,L),u(_,a,L),k(R,_,L),u(_,C,L),k(r,_,L),u(_,F,L),k(c,_,L),u(_,I,L),k(M,_,L),u(_,P,L),k(q,_,L),u(_,N,L),k(f,_,L),u(_,S,L),k(H,_,L),u(_,z,L),k(D,_,L),u(_,Y,L),k(te,_,L),u(_,re,L),k(Q,_,L),u(_,ae,L),k(J,_,L),u(_,se,L),k(ne,_,L),u(_,x,L),k(K,_,L),u(_,ee,L),k(le,_,L),u(_,oe,L),k(G,_,L),u(_,_e,L),k(X,_,L),ie=!0},p:st,i(_){ie||(m(t.$$.fragment,_),m(e.$$.fragment,_),m(s.$$.fragment,_),m(R.$$.fragment,_),m(r.$$.fragment,_),m(c.$$.fragment,_),m(M.$$.fragment,_),m(q.$$.fragment,_),m(f.$$.fragment,_),m(H.$$.fragment,_),m(D.$$.fragment,_),m(te.$$.fragment,_),m(Q.$$.fragment,_),m(J.$$.fragment,_),m(ne.$$.fragment,_),m(K.$$.fragment,_),m(le.$$.fragment,_),m(G.$$.fragment,_),m(X.$$.fragment,_),ie=!0)},o(_){p(t.$$.fragment,_),p(e.$$.fragment,_),p(s.$$.fragment,_),p(R.$$.fragment,_),p(r.$$.fragment,_),p(c.$$.fragment,_),p(M.$$.fragment,_),p(q.$$.fragment,_),p(f.$$.fragment,_),p(H.$$.fragment,_),p(D.$$.fragment,_),p(te.$$.fragment,_),p(Q.$$.fragment,_),p(J.$$.fragment,_),p(ne.$$.fragment,_),p(K.$$.fragment,_),p(le.$$.fragment,_),p(G.$$.fragment,_),p(X.$$.fragment,_),ie=!1},d(_){_&&(d(i),d(n),d(a),d(C),d(F),d(I),d(P),d(N),d(S),d(z),d(Y),d(re),d(ae),d(se),d(x),d(ee),d(oe),d(_e)),w(t,_),w(e,_),w(s,_),w(R,_),w(r,_),w(c,_),w(M,_),w(q,_),w(f,_),w(H,_),w(D,_),w(te,_),w(Q,_),w(J,_),w(ne,_),w(K,_),w(le,_),w(G,_),w(X,_)}}}function Oa(o){let t,i='<a href="#nuage-de-points--pe-forward-vs-variation-journaliere">Nuage de Points : P/E Forward vs Variation Journaliere</a>',e,n,s='<em class="markdown">Chaque bulle represente une action. La taille reflete la capitalisation boursiere. La couleur distingue les regions.</em>',a,R,C,r,F='<a href="#distribution-des-pe-forward">Distribution des P/E Forward</a>',c,I,M='<em class="markdown">Combien d&#39;actions se trouvent dans chaque tranche de P/E ? La majorite des grandes capitalisations se concentrent entre 10x et 40x les benefices.</em>',P,q,N,f,S='<a href="#top-20-capitalisations-mondiales">Top 20 Capitalisations Mondiales</a>',H,z,D,Y,te='<a href="#capitalisation-par-secteur">Capitalisation par Secteur</a>',re,Q,ae,J,se='<a href="#repartition-par-region">Repartition par Region</a>',ne,x,K,ee,le='<a href="#distribution-du-beta">Distribution du Beta</a>',oe,G,_e='<em class="markdown">Le beta mesure la sensibilite d&#39;une action au marche. Un beta superieur a 1 amplifie les mouvements, un beta inferieur a 1 les amortit.</em>',X,ie,_,L,Ae='<a href="#pe-forward-vs-croissance-du-ca">P/E Forward vs Croissance du CA</a>',fe,me,T='<em class="markdown">Les actions en haut a gauche (faible P/E, forte croissance) representent potentiellement les meilleures opportunites PEG.</em>',b,U,Pe,be,ce,it,Ne=o[1][0].total+"",nt,rt,Ue,$e,tt,at,$t;return R=new ui({props:{data:o[7],x:"pe_forward",y:"change_pct",size:"market_cap",series:"region",xAxisTitle:"P/E Forward",yAxisTitle:"Variation du Jour (%)",title:"P/E Forward vs Performance — Toutes les Actions",tooltipTitle:"symbol"}}),q=new It({props:{data:o[8],x:"pe_range",y:"nb_stocks",xAxisTitle:"Tranche P/E Forward",yAxisTitle:"Nombre d'Actions",title:"Distribution des P/E Forward",sort:"false"}}),z=new It({props:{data:o[9],x:"symbol",y:"market_cap",series:"region",xAxisTitle:"Ticker",yAxisTitle:"Capitalisation ($)",title:"Top 20 par Capitalisation Boursiere",fmt:"usd",sort:"false"}}),Q=new It({props:{data:o[14],x:"sector",y:"total_mcap",title:"Poids des Secteurs (Capitalisation Totale)",fmt:"usd",swapXY:"true",sort:"false"}}),x=new Dt({props:{data:o[15],rows:"5",$$slots:{default:[ja]},$$scope:{ctx:o}}}),ie=new It({props:{data:o[18],x:"beta_range",y:"nb_stocks",xAxisTitle:"Tranche de Beta",yAxisTitle:"Nombre d'Actions",title:"Distribution du Beta — Profil de Risque du Portefeuille",sort:"false"}}),U=new ui({props:{data:o[17],x:"pe_forward",y:"revenue_growth",size:"market_cap",series:"sector",xAxisTitle:"P/E Forward",yAxisTitle:"Croissance CA (%)",title:"Valorisation vs Croissance",tooltipTitle:"symbol"}}),$e=new ia({props:{data:o[0],queryName:"market_stocks_all"}}),at=new Dt({props:{data:o[0],search:"true",rows:"25",$$slots:{default:[za]},$$scope:{ctx:o}}}),{c(){t=Z("h2"),t.innerHTML=i,e=g(),n=Z("p"),n.innerHTML=s,a=g(),h(R.$$.fragment),C=g(),r=Z("h2"),r.innerHTML=F,c=g(),I=Z("p"),I.innerHTML=M,P=g(),h(q.$$.fragment),N=g(),f=Z("h2"),f.innerHTML=S,H=g(),h(z.$$.fragment),D=g(),Y=Z("h2"),Y.innerHTML=te,re=g(),h(Q.$$.fragment),ae=g(),J=Z("h2"),J.innerHTML=se,ne=g(),h(x.$$.fragment),K=g(),ee=Z("h2"),ee.innerHTML=le,oe=g(),G=Z("p"),G.innerHTML=_e,X=g(),h(ie.$$.fragment),_=g(),L=Z("h2"),L.innerHTML=Ae,fe=g(),me=Z("p"),me.innerHTML=T,b=g(),h(U.$$.fragment),Pe=g(),be=Z("h2"),ce=Z("a"),it=mt("Catalogue Complet — "),nt=mt(Ne),rt=mt(" Actions"),Ue=g(),h($e.$$.fragment),tt=g(),h(at.$$.fragment),this.h()},l(E){t=W(E,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(t)!=="svelte-1ugvr31"&&(t.innerHTML=i),e=$(E),n=W(E,"P",{class:!0,"data-svelte-h":!0}),pe(n)!=="svelte-xytrcj"&&(n.innerHTML=s),a=$(E),y(R.$$.fragment,E),C=$(E),r=W(E,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(r)!=="svelte-10zsaz"&&(r.innerHTML=F),c=$(E),I=W(E,"P",{class:!0,"data-svelte-h":!0}),pe(I)!=="svelte-12ichu8"&&(I.innerHTML=M),P=$(E),y(q.$$.fragment,E),N=$(E),f=W(E,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(f)!=="svelte-8ytj"&&(f.innerHTML=S),H=$(E),y(z.$$.fragment,E),D=$(E),Y=W(E,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(Y)!=="svelte-1ykwel1"&&(Y.innerHTML=te),re=$(E),y(Q.$$.fragment,E),ae=$(E),J=W(E,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(J)!=="svelte-1g7soae"&&(J.innerHTML=se),ne=$(E),y(x.$$.fragment,E),K=$(E),ee=W(E,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(ee)!=="svelte-q4i0gr"&&(ee.innerHTML=le),oe=$(E),G=W(E,"P",{class:!0,"data-svelte-h":!0}),pe(G)!=="svelte-1jzmwaf"&&(G.innerHTML=_e),X=$(E),y(ie.$$.fragment,E),_=$(E),L=W(E,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(L)!=="svelte-1sxakdl"&&(L.innerHTML=Ae),fe=$(E),me=W(E,"P",{class:!0,"data-svelte-h":!0}),pe(me)!=="svelte-1dnh768"&&(me.innerHTML=T),b=$(E),y(U.$$.fragment,E),Pe=$(E),be=W(E,"H2",{class:!0,id:!0});var B=Tr(be);ce=W(B,"A",{href:!0});var lt=Tr(ce);it=ft(lt,"Catalogue Complet — "),nt=ft(lt,Ne),rt=ft(lt," Actions"),lt.forEach(d),B.forEach(d),Ue=$(E),y($e.$$.fragment,E),tt=$(E),y(at.$$.fragment,E),this.h()},h(){V(t,"class","markdown"),V(t,"id","nuage-de-points--pe-forward-vs-variation-journaliere"),V(n,"class","markdown"),V(r,"class","markdown"),V(r,"id","distribution-des-pe-forward"),V(I,"class","markdown"),V(f,"class","markdown"),V(f,"id","top-20-capitalisations-mondiales"),V(Y,"class","markdown"),V(Y,"id","capitalisation-par-secteur"),V(J,"class","markdown"),V(J,"id","repartition-par-region"),V(ee,"class","markdown"),V(ee,"id","distribution-du-beta"),V(G,"class","markdown"),V(L,"class","markdown"),V(L,"id","pe-forward-vs-croissance-du-ca"),V(me,"class","markdown"),V(ce,"href","#catalogue-complet--static_count0total-actions"),V(be,"class","markdown"),V(be,"id","catalogue-complet--static_count0total-actions")},m(E,B){u(E,t,B),u(E,e,B),u(E,n,B),u(E,a,B),k(R,E,B),u(E,C,B),u(E,r,B),u(E,c,B),u(E,I,B),u(E,P,B),k(q,E,B),u(E,N,B),u(E,f,B),u(E,H,B),k(z,E,B),u(E,D,B),u(E,Y,B),u(E,re,B),k(Q,E,B),u(E,ae,B),u(E,J,B),u(E,ne,B),k(x,E,B),u(E,K,B),u(E,ee,B),u(E,oe,B),u(E,G,B),u(E,X,B),k(ie,E,B),u(E,_,B),u(E,L,B),u(E,fe,B),u(E,me,B),u(E,b,B),k(U,E,B),u(E,Pe,B),u(E,be,B),Tt(be,ce),Tt(ce,it),Tt(ce,nt),Tt(ce,rt),u(E,Ue,B),k($e,E,B),u(E,tt,B),k(at,E,B),$t=!0},p(E,B){const lt={};B[0]&128&&(lt.data=E[7]),R.$set(lt);const gt={};B[0]&256&&(gt.data=E[8]),q.$set(gt);const pt={};B[0]&512&&(pt.data=E[9]),z.$set(pt);const yt={};B[0]&16384&&(yt.data=E[14]),Q.$set(yt);const dt={};B[0]&32768&&(dt.data=E[15]),B[6]&512&&(dt.$$scope={dirty:B,ctx:E}),x.$set(dt);const ct={};B[0]&262144&&(ct.data=E[18]),ie.$set(ct);const ot={};B[0]&131072&&(ot.data=E[17]),U.$set(ot),(!$t||B[0]&2)&&Ne!==(Ne=E[1][0].total+"")&&pi(nt,Ne);const vt={};B[0]&1&&(vt.data=E[0]),$e.$set(vt);const ut={};B[0]&1&&(ut.data=E[0]),B[6]&512&&(ut.$$scope={dirty:B,ctx:E}),at.$set(ut)},i(E){$t||(m(R.$$.fragment,E),m(q.$$.fragment,E),m(z.$$.fragment,E),m(Q.$$.fragment,E),m(x.$$.fragment,E),m(ie.$$.fragment,E),m(U.$$.fragment,E),m($e.$$.fragment,E),m(at.$$.fragment,E),$t=!0)},o(E){p(R.$$.fragment,E),p(q.$$.fragment,E),p(z.$$.fragment,E),p(Q.$$.fragment,E),p(x.$$.fragment,E),p(ie.$$.fragment,E),p(U.$$.fragment,E),p($e.$$.fragment,E),p(at.$$.fragment,E),$t=!1},d(E){E&&(d(t),d(e),d(n),d(a),d(C),d(r),d(c),d(I),d(P),d(N),d(f),d(H),d(D),d(Y),d(re),d(ae),d(J),d(ne),d(K),d(ee),d(oe),d(G),d(X),d(_),d(L),d(fe),d(me),d(b),d(Pe),d(be),d(Ue),d(tt)),w(R,E),w(q,E),w(z,E),w(Q,E),w(x,E),w(ie,E),w(U,E),w($e,E),w(at,E)}}}function Ya(o){let t,i,e,n,s,a,R,C,r,F,c,I,M,P,q,N;return t=new A({props:{id:"symbol",title:"Ticker"}}),e=new A({props:{id:"name",title:"Nom"}}),s=new A({props:{id:"price",title:"Prix",fmt:"usd"}}),R=new A({props:{id:"change_pct",title:"Variation %",fmt:"num2"}}),r=new A({props:{id:"volume",title:"Volume",fmt:"#,##0"}}),c=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),M=new A({props:{id:"sector",title:"Secteur"}}),q=new A({props:{id:"region",title:"Region"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment),F=g(),h(c.$$.fragment),I=g(),h(M.$$.fragment),P=g(),h(q.$$.fragment)},l(f){y(t.$$.fragment,f),i=$(f),y(e.$$.fragment,f),n=$(f),y(s.$$.fragment,f),a=$(f),y(R.$$.fragment,f),C=$(f),y(r.$$.fragment,f),F=$(f),y(c.$$.fragment,f),I=$(f),y(M.$$.fragment,f),P=$(f),y(q.$$.fragment,f)},m(f,S){k(t,f,S),u(f,i,S),k(e,f,S),u(f,n,S),k(s,f,S),u(f,a,S),k(R,f,S),u(f,C,S),k(r,f,S),u(f,F,S),k(c,f,S),u(f,I,S),k(M,f,S),u(f,P,S),k(q,f,S),N=!0},p:st,i(f){N||(m(t.$$.fragment,f),m(e.$$.fragment,f),m(s.$$.fragment,f),m(R.$$.fragment,f),m(r.$$.fragment,f),m(c.$$.fragment,f),m(M.$$.fragment,f),m(q.$$.fragment,f),N=!0)},o(f){p(t.$$.fragment,f),p(e.$$.fragment,f),p(s.$$.fragment,f),p(R.$$.fragment,f),p(r.$$.fragment,f),p(c.$$.fragment,f),p(M.$$.fragment,f),p(q.$$.fragment,f),N=!1},d(f){f&&(d(i),d(n),d(a),d(C),d(F),d(I),d(P)),w(t,f),w(e,f),w(s,f),w(R,f),w(r,f),w(c,f),w(M,f),w(q,f)}}}function Ga(o){let t,i,e,n,s,a,R,C,r,F,c,I,M,P,q,N;return t=new A({props:{id:"symbol",title:"Ticker"}}),e=new A({props:{id:"name",title:"Nom"}}),s=new A({props:{id:"price",title:"Prix",fmt:"usd"}}),R=new A({props:{id:"change_pct",title:"Variation %",fmt:"num2"}}),r=new A({props:{id:"volume",title:"Volume",fmt:"#,##0"}}),c=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),M=new A({props:{id:"sector",title:"Secteur"}}),q=new A({props:{id:"region",title:"Region"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment),F=g(),h(c.$$.fragment),I=g(),h(M.$$.fragment),P=g(),h(q.$$.fragment)},l(f){y(t.$$.fragment,f),i=$(f),y(e.$$.fragment,f),n=$(f),y(s.$$.fragment,f),a=$(f),y(R.$$.fragment,f),C=$(f),y(r.$$.fragment,f),F=$(f),y(c.$$.fragment,f),I=$(f),y(M.$$.fragment,f),P=$(f),y(q.$$.fragment,f)},m(f,S){k(t,f,S),u(f,i,S),k(e,f,S),u(f,n,S),k(s,f,S),u(f,a,S),k(R,f,S),u(f,C,S),k(r,f,S),u(f,F,S),k(c,f,S),u(f,I,S),k(M,f,S),u(f,P,S),k(q,f,S),N=!0},p:st,i(f){N||(m(t.$$.fragment,f),m(e.$$.fragment,f),m(s.$$.fragment,f),m(R.$$.fragment,f),m(r.$$.fragment,f),m(c.$$.fragment,f),m(M.$$.fragment,f),m(q.$$.fragment,f),N=!0)},o(f){p(t.$$.fragment,f),p(e.$$.fragment,f),p(s.$$.fragment,f),p(R.$$.fragment,f),p(r.$$.fragment,f),p(c.$$.fragment,f),p(M.$$.fragment,f),p(q.$$.fragment,f),N=!1},d(f){f&&(d(i),d(n),d(a),d(C),d(F),d(I),d(P)),w(t,f),w(e,f),w(s,f),w(R,f),w(r,f),w(c,f),w(M,f),w(q,f)}}}function Qa(o){let t,i,e,n,s,a,R,C,r,F,c,I,M,P;return t=new A({props:{id:"symbol",title:"Ticker"}}),e=new A({props:{id:"name",title:"Nom"}}),s=new A({props:{id:"volume",title:"Volume",fmt:"#,##0"}}),R=new A({props:{id:"price",title:"Prix",fmt:"usd"}}),r=new A({props:{id:"change_pct",title:"Var %",fmt:"num2"}}),c=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),M=new A({props:{id:"sector",title:"Secteur"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment),F=g(),h(c.$$.fragment),I=g(),h(M.$$.fragment)},l(q){y(t.$$.fragment,q),i=$(q),y(e.$$.fragment,q),n=$(q),y(s.$$.fragment,q),a=$(q),y(R.$$.fragment,q),C=$(q),y(r.$$.fragment,q),F=$(q),y(c.$$.fragment,q),I=$(q),y(M.$$.fragment,q)},m(q,N){k(t,q,N),u(q,i,N),k(e,q,N),u(q,n,N),k(s,q,N),u(q,a,N),k(R,q,N),u(q,C,N),k(r,q,N),u(q,F,N),k(c,q,N),u(q,I,N),k(M,q,N),P=!0},p:st,i(q){P||(m(t.$$.fragment,q),m(e.$$.fragment,q),m(s.$$.fragment,q),m(R.$$.fragment,q),m(r.$$.fragment,q),m(c.$$.fragment,q),m(M.$$.fragment,q),P=!0)},o(q){p(t.$$.fragment,q),p(e.$$.fragment,q),p(s.$$.fragment,q),p(R.$$.fragment,q),p(r.$$.fragment,q),p(c.$$.fragment,q),p(M.$$.fragment,q),P=!1},d(q){q&&(d(i),d(n),d(a),d(C),d(F),d(I)),w(t,q),w(e,q),w(s,q),w(R,q),w(r,q),w(c,q),w(M,q)}}}function Ja(o){let t,i,e,n;return t=new A({props:{id:"recommendation",title:"Recommandation"}}),e=new A({props:{id:"nb_stocks",title:"Nombre d'Actions"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment)},l(s){y(t.$$.fragment,s),i=$(s),y(e.$$.fragment,s)},m(s,a){k(t,s,a),u(s,i,a),k(e,s,a),n=!0},p:st,i(s){n||(m(t.$$.fragment,s),m(e.$$.fragment,s),n=!0)},o(s){p(t.$$.fragment,s),p(e.$$.fragment,s),n=!1},d(s){s&&d(i),w(t,s),w(e,s)}}}function Xa(o){let t,i,e,n,s,a,R,C,r,F,c,I,M,P,q,N;return t=new A({props:{id:"symbol",title:"Ticker"}}),e=new A({props:{id:"name",title:"Nom"}}),s=new A({props:{id:"dividend_yield",title:"Div. Yield %",fmt:"num2"}}),R=new A({props:{id:"price",title:"Prix",fmt:"usd"}}),r=new A({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),c=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),M=new A({props:{id:"sector",title:"Secteur"}}),q=new A({props:{id:"region",title:"Region"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment),F=g(),h(c.$$.fragment),I=g(),h(M.$$.fragment),P=g(),h(q.$$.fragment)},l(f){y(t.$$.fragment,f),i=$(f),y(e.$$.fragment,f),n=$(f),y(s.$$.fragment,f),a=$(f),y(R.$$.fragment,f),C=$(f),y(r.$$.fragment,f),F=$(f),y(c.$$.fragment,f),I=$(f),y(M.$$.fragment,f),P=$(f),y(q.$$.fragment,f)},m(f,S){k(t,f,S),u(f,i,S),k(e,f,S),u(f,n,S),k(s,f,S),u(f,a,S),k(R,f,S),u(f,C,S),k(r,f,S),u(f,F,S),k(c,f,S),u(f,I,S),k(M,f,S),u(f,P,S),k(q,f,S),N=!0},p:st,i(f){N||(m(t.$$.fragment,f),m(e.$$.fragment,f),m(s.$$.fragment,f),m(R.$$.fragment,f),m(r.$$.fragment,f),m(c.$$.fragment,f),m(M.$$.fragment,f),m(q.$$.fragment,f),N=!0)},o(f){p(t.$$.fragment,f),p(e.$$.fragment,f),p(s.$$.fragment,f),p(R.$$.fragment,f),p(r.$$.fragment,f),p(c.$$.fragment,f),p(M.$$.fragment,f),p(q.$$.fragment,f),N=!1},d(f){f&&(d(i),d(n),d(a),d(C),d(F),d(I),d(P)),w(t,f),w(e,f),w(s,f),w(R,f),w(r,f),w(c,f),w(M,f),w(q,f)}}}function Ka(o){let t,i,e,n,s,a,R,C,r,F,c,I,M,P,q,N,f,S;return t=new A({props:{id:"symbol",title:"Ticker"}}),e=new A({props:{id:"name",title:"Nom"}}),s=new A({props:{id:"price",title:"Prix Actuel",fmt:"usd"}}),R=new A({props:{id:"target_price",title:"Target Analystes",fmt:"usd"}}),r=new A({props:{id:"upside_pct",title:"Potentiel (%)",fmt:"num1"}}),c=new A({props:{id:"recommendation",title:"Reco."}}),M=new A({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),q=new A({props:{id:"sector",title:"Secteur"}}),f=new A({props:{id:"region",title:"Region"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment),F=g(),h(c.$$.fragment),I=g(),h(M.$$.fragment),P=g(),h(q.$$.fragment),N=g(),h(f.$$.fragment)},l(H){y(t.$$.fragment,H),i=$(H),y(e.$$.fragment,H),n=$(H),y(s.$$.fragment,H),a=$(H),y(R.$$.fragment,H),C=$(H),y(r.$$.fragment,H),F=$(H),y(c.$$.fragment,H),I=$(H),y(M.$$.fragment,H),P=$(H),y(q.$$.fragment,H),N=$(H),y(f.$$.fragment,H)},m(H,z){k(t,H,z),u(H,i,z),k(e,H,z),u(H,n,z),k(s,H,z),u(H,a,z),k(R,H,z),u(H,C,z),k(r,H,z),u(H,F,z),k(c,H,z),u(H,I,z),k(M,H,z),u(H,P,z),k(q,H,z),u(H,N,z),k(f,H,z),S=!0},p:st,i(H){S||(m(t.$$.fragment,H),m(e.$$.fragment,H),m(s.$$.fragment,H),m(R.$$.fragment,H),m(r.$$.fragment,H),m(c.$$.fragment,H),m(M.$$.fragment,H),m(q.$$.fragment,H),m(f.$$.fragment,H),S=!0)},o(H){p(t.$$.fragment,H),p(e.$$.fragment,H),p(s.$$.fragment,H),p(R.$$.fragment,H),p(r.$$.fragment,H),p(c.$$.fragment,H),p(M.$$.fragment,H),p(q.$$.fragment,H),p(f.$$.fragment,H),S=!1},d(H){H&&(d(i),d(n),d(a),d(C),d(F),d(I),d(P),d(N)),w(t,H),w(e,H),w(s,H),w(R,H),w(r,H),w(c,H),w(M,H),w(q,H),w(f,H)}}}function Wa(o){let t,i='<a href="#top-10-hausses-du-jour">Top 10 Hausses du Jour</a>',e,n,s,a,R='<a href="#top-10-baisses-du-jour">Top 10 Baisses du Jour</a>',C,r,F,c,I='<a href="#top-20-volumes-echanges">Top 20 Volumes Echanges</a>',M,P,q,N,f,S,H='<a href="#recommandations-analystes">Recommandations Analystes</a>',z,D,Y='<em class="markdown">Repartition des recommandations des analystes sell-side sur l&#39;univers couvert.</em>',te,re,Q,ae,J,se,ne='<a href="#top-15-rendements-en-dividende">Top 15 Rendements en Dividende</a>',x,K,ee,le,oe,G,_e='<a href="#top-20-potentiel-de-hausse-vs-target-analystes">Top 20 Potentiel de Hausse (vs Target Analystes)</a>',X,ie,_='<em class="markdown">Ecart entre le prix actuel et l&#39;objectif de cours consensus des analystes.</em>',L,Ae,fe,me,T;return n=new Dt({props:{data:o[12],rows:"10",$$slots:{default:[Ya]},$$scope:{ctx:o}}}),r=new Dt({props:{data:o[13],rows:"10",$$slots:{default:[Ga]},$$scope:{ctx:o}}}),P=new It({props:{data:o[10],x:"symbol",y:"volume",xAxisTitle:"Ticker",yAxisTitle:"Volume",title:"Top 20 par Volume d'Echanges",sort:"false",fmt:"#,##0"}}),N=new Dt({props:{data:o[10],rows:"20",$$slots:{default:[Qa]},$$scope:{ctx:o}}}),re=new It({props:{data:o[11],x:"recommendation",y:"nb_stocks",xAxisTitle:"Recommandation",yAxisTitle:"Nombre d'Actions",title:"Repartition des Recommandations Analystes",sort:"false"}}),ae=new Dt({props:{data:o[11],rows:"10",$$slots:{default:[Ja]},$$scope:{ctx:o}}}),K=new It({props:{data:o[16],x:"symbol",y:"dividend_yield",xAxisTitle:"Ticker",yAxisTitle:"Dividend Yield (%)",title:"Top 15 — Meilleurs Rendements en Dividende",sort:"false"}}),le=new Dt({props:{data:o[16],rows:"15",$$slots:{default:[Xa]},$$scope:{ctx:o}}}),Ae=new It({props:{data:o[19],x:"symbol",y:"upside_pct",xAxisTitle:"Ticker",yAxisTitle:"Potentiel de Hausse (%)",title:"Top 20 — Plus Fort Potentiel de Hausse",sort:"false"}}),me=new Dt({props:{data:o[19],rows:"20",$$slots:{default:[Ka]},$$scope:{ctx:o}}}),{c(){t=Z("h2"),t.innerHTML=i,e=g(),h(n.$$.fragment),s=g(),a=Z("h2"),a.innerHTML=R,C=g(),h(r.$$.fragment),F=g(),c=Z("h2"),c.innerHTML=I,M=g(),h(P.$$.fragment),q=g(),h(N.$$.fragment),f=g(),S=Z("h2"),S.innerHTML=H,z=g(),D=Z("p"),D.innerHTML=Y,te=g(),h(re.$$.fragment),Q=g(),h(ae.$$.fragment),J=g(),se=Z("h2"),se.innerHTML=ne,x=g(),h(K.$$.fragment),ee=g(),h(le.$$.fragment),oe=g(),G=Z("h2"),G.innerHTML=_e,X=g(),ie=Z("p"),ie.innerHTML=_,L=g(),h(Ae.$$.fragment),fe=g(),h(me.$$.fragment),this.h()},l(b){t=W(b,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(t)!=="svelte-u2nj33"&&(t.innerHTML=i),e=$(b),y(n.$$.fragment,b),s=$(b),a=W(b,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(a)!=="svelte-1mqqoot"&&(a.innerHTML=R),C=$(b),y(r.$$.fragment,b),F=$(b),c=W(b,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(c)!=="svelte-1i6tz0e"&&(c.innerHTML=I),M=$(b),y(P.$$.fragment,b),q=$(b),y(N.$$.fragment,b),f=$(b),S=W(b,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(S)!=="svelte-o0fjzs"&&(S.innerHTML=H),z=$(b),D=W(b,"P",{class:!0,"data-svelte-h":!0}),pe(D)!=="svelte-17cvosr"&&(D.innerHTML=Y),te=$(b),y(re.$$.fragment,b),Q=$(b),y(ae.$$.fragment,b),J=$(b),se=W(b,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(se)!=="svelte-6t5fbp"&&(se.innerHTML=ne),x=$(b),y(K.$$.fragment,b),ee=$(b),y(le.$$.fragment,b),oe=$(b),G=W(b,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(G)!=="svelte-vkdvna"&&(G.innerHTML=_e),X=$(b),ie=W(b,"P",{class:!0,"data-svelte-h":!0}),pe(ie)!=="svelte-1mmzuku"&&(ie.innerHTML=_),L=$(b),y(Ae.$$.fragment,b),fe=$(b),y(me.$$.fragment,b),this.h()},h(){V(t,"class","markdown"),V(t,"id","top-10-hausses-du-jour"),V(a,"class","markdown"),V(a,"id","top-10-baisses-du-jour"),V(c,"class","markdown"),V(c,"id","top-20-volumes-echanges"),V(S,"class","markdown"),V(S,"id","recommandations-analystes"),V(D,"class","markdown"),V(se,"class","markdown"),V(se,"id","top-15-rendements-en-dividende"),V(G,"class","markdown"),V(G,"id","top-20-potentiel-de-hausse-vs-target-analystes"),V(ie,"class","markdown")},m(b,U){u(b,t,U),u(b,e,U),k(n,b,U),u(b,s,U),u(b,a,U),u(b,C,U),k(r,b,U),u(b,F,U),u(b,c,U),u(b,M,U),k(P,b,U),u(b,q,U),k(N,b,U),u(b,f,U),u(b,S,U),u(b,z,U),u(b,D,U),u(b,te,U),k(re,b,U),u(b,Q,U),k(ae,b,U),u(b,J,U),u(b,se,U),u(b,x,U),k(K,b,U),u(b,ee,U),k(le,b,U),u(b,oe,U),u(b,G,U),u(b,X,U),u(b,ie,U),u(b,L,U),k(Ae,b,U),u(b,fe,U),k(me,b,U),T=!0},p(b,U){const Pe={};U[0]&4096&&(Pe.data=b[12]),U[6]&512&&(Pe.$$scope={dirty:U,ctx:b}),n.$set(Pe);const be={};U[0]&8192&&(be.data=b[13]),U[6]&512&&(be.$$scope={dirty:U,ctx:b}),r.$set(be);const ce={};U[0]&1024&&(ce.data=b[10]),P.$set(ce);const it={};U[0]&1024&&(it.data=b[10]),U[6]&512&&(it.$$scope={dirty:U,ctx:b}),N.$set(it);const Ne={};U[0]&2048&&(Ne.data=b[11]),re.$set(Ne);const nt={};U[0]&2048&&(nt.data=b[11]),U[6]&512&&(nt.$$scope={dirty:U,ctx:b}),ae.$set(nt);const rt={};U[0]&65536&&(rt.data=b[16]),K.$set(rt);const Ue={};U[0]&65536&&(Ue.data=b[16]),U[6]&512&&(Ue.$$scope={dirty:U,ctx:b}),le.$set(Ue);const $e={};U[0]&524288&&($e.data=b[19]),Ae.$set($e);const tt={};U[0]&524288&&(tt.data=b[19]),U[6]&512&&(tt.$$scope={dirty:U,ctx:b}),me.$set(tt)},i(b){T||(m(n.$$.fragment,b),m(r.$$.fragment,b),m(P.$$.fragment,b),m(N.$$.fragment,b),m(re.$$.fragment,b),m(ae.$$.fragment,b),m(K.$$.fragment,b),m(le.$$.fragment,b),m(Ae.$$.fragment,b),m(me.$$.fragment,b),T=!0)},o(b){p(n.$$.fragment,b),p(r.$$.fragment,b),p(P.$$.fragment,b),p(N.$$.fragment,b),p(re.$$.fragment,b),p(ae.$$.fragment,b),p(K.$$.fragment,b),p(le.$$.fragment,b),p(Ae.$$.fragment,b),p(me.$$.fragment,b),T=!1},d(b){b&&(d(t),d(e),d(s),d(a),d(C),d(F),d(c),d(M),d(q),d(f),d(S),d(z),d(D),d(te),d(Q),d(J),d(se),d(x),d(ee),d(oe),d(G),d(X),d(ie),d(L),d(fe)),w(n,b),w(r,b),w(P,b),w(N,b),w(re,b),w(ae,b),w(K,b),w(le,b),w(Ae,b),w(me,b)}}}function Zi(o){let t,i;return t=new aa({props:{value:o[192].value,valueLabel:o[192].label}}),{c(){h(t.$$.fragment)},l(e){y(t.$$.fragment,e)},m(e,n){k(t,e,n),i=!0},p(e,n){const s={};n[0]&1048576&&(s.value=e[192].value),n[0]&1048576&&(s.valueLabel=e[192].label),t.$set(s)},i(e){i||(m(t.$$.fragment,e),i=!0)},o(e){p(t.$$.fragment,e),i=!1},d(e){w(t,e)}}}function Za(o){let t,i,e,n;t=new aa({props:{value:"%",valueLabel:"Tous les secteurs"}});let s=gi(o[20]),a=[];for(let C=0;C<s.length;C+=1)a[C]=Zi(ki(o,s,C));const R=C=>p(a[C],1,1,()=>{a[C]=null});return{c(){h(t.$$.fragment),i=g();for(let C=0;C<a.length;C+=1)a[C].c();e=dr()},l(C){y(t.$$.fragment,C),i=$(C);for(let r=0;r<a.length;r+=1)a[r].l(C);e=dr()},m(C,r){k(t,C,r),u(C,i,r);for(let F=0;F<a.length;F+=1)a[F]&&a[F].m(C,r);u(C,e,r),n=!0},p(C,r){if(r[0]&1048576){s=gi(C[20]);let F;for(F=0;F<s.length;F+=1){const c=ki(C,s,F);a[F]?(a[F].p(c,r),m(a[F],1)):(a[F]=Zi(c),a[F].c(),m(a[F],1),a[F].m(e.parentNode,e))}for(de(),F=s.length;F<a.length;F+=1)R(F);ue()}},i(C){if(!n){m(t.$$.fragment,C);for(let r=0;r<s.length;r+=1)m(a[r]);n=!0}},o(C){p(t.$$.fragment,C),a=a.filter(Boolean);for(let r=0;r<a.length;r+=1)p(a[r]);n=!1},d(C){C&&(d(i),d(e)),w(t,C),ma(a,C)}}}function xa(o){let t,i,e,n,s,a,R,C;return t=new Fr({props:{valueLabel:"Toutes",value:"%",default:!0}}),e=new Fr({props:{valueLabel:"US",value:"US"}}),s=new Fr({props:{valueLabel:"Europe",value:"Europe"}}),R=new Fr({props:{valueLabel:"Asie",value:"Asia"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment)},l(r){y(t.$$.fragment,r),i=$(r),y(e.$$.fragment,r),n=$(r),y(s.$$.fragment,r),a=$(r),y(R.$$.fragment,r)},m(r,F){k(t,r,F),u(r,i,F),k(e,r,F),u(r,n,F),k(s,r,F),u(r,a,F),k(R,r,F),C=!0},p:st,i(r){C||(m(t.$$.fragment,r),m(e.$$.fragment,r),m(s.$$.fragment,r),m(R.$$.fragment,r),C=!0)},o(r){p(t.$$.fragment,r),p(e.$$.fragment,r),p(s.$$.fragment,r),p(R.$$.fragment,r),C=!1},d(r){r&&(d(i),d(n),d(a)),w(t,r),w(e,r),w(s,r),w(R,r)}}}function el(o){let t,i,e,n,s,a,R,C,r,F,c,I,M,P,q,N,f,S,H,z,D,Y,te,re,Q,ae,J,se,ne,x,K,ee,le,oe,G,_e,X,ie;return t=new A({props:{id:"symbol",title:"Ticker"}}),e=new A({props:{id:"name",title:"Nom"}}),s=new A({props:{id:"price",title:"Prix",fmt:"usd"}}),R=new A({props:{id:"change_pct",title:"Var %",fmt:"num2"}}),r=new A({props:{id:"volume",title:"Volume",fmt:"#,##0"}}),c=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),M=new A({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),q=new A({props:{id:"pe_trailing",title:"P/E Trail",fmt:"num1"}}),f=new A({props:{id:"dividend_yield",title:"Div %",fmt:"num2"}}),H=new A({props:{id:"beta",title:"Beta",fmt:"num2"}}),D=new A({props:{id:"price_to_book",title:"P/Book",fmt:"num1"}}),te=new A({props:{id:"revenue_growth",title:"Croiss. CA %",fmt:"num1"}}),Q=new A({props:{id:"profit_margin",title:"Marge Nette %",fmt:"num1"}}),J=new A({props:{id:"roe",title:"ROE %",fmt:"num1"}}),ne=new A({props:{id:"target_price",title:"Target",fmt:"usd"}}),K=new A({props:{id:"recommendation",title:"Reco."}}),le=new A({props:{id:"sector",title:"Secteur"}}),G=new A({props:{id:"region",title:"Region"}}),X=new A({props:{id:"country",title:"Pays"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment),F=g(),h(c.$$.fragment),I=g(),h(M.$$.fragment),P=g(),h(q.$$.fragment),N=g(),h(f.$$.fragment),S=g(),h(H.$$.fragment),z=g(),h(D.$$.fragment),Y=g(),h(te.$$.fragment),re=g(),h(Q.$$.fragment),ae=g(),h(J.$$.fragment),se=g(),h(ne.$$.fragment),x=g(),h(K.$$.fragment),ee=g(),h(le.$$.fragment),oe=g(),h(G.$$.fragment),_e=g(),h(X.$$.fragment)},l(_){y(t.$$.fragment,_),i=$(_),y(e.$$.fragment,_),n=$(_),y(s.$$.fragment,_),a=$(_),y(R.$$.fragment,_),C=$(_),y(r.$$.fragment,_),F=$(_),y(c.$$.fragment,_),I=$(_),y(M.$$.fragment,_),P=$(_),y(q.$$.fragment,_),N=$(_),y(f.$$.fragment,_),S=$(_),y(H.$$.fragment,_),z=$(_),y(D.$$.fragment,_),Y=$(_),y(te.$$.fragment,_),re=$(_),y(Q.$$.fragment,_),ae=$(_),y(J.$$.fragment,_),se=$(_),y(ne.$$.fragment,_),x=$(_),y(K.$$.fragment,_),ee=$(_),y(le.$$.fragment,_),oe=$(_),y(G.$$.fragment,_),_e=$(_),y(X.$$.fragment,_)},m(_,L){k(t,_,L),u(_,i,L),k(e,_,L),u(_,n,L),k(s,_,L),u(_,a,L),k(R,_,L),u(_,C,L),k(r,_,L),u(_,F,L),k(c,_,L),u(_,I,L),k(M,_,L),u(_,P,L),k(q,_,L),u(_,N,L),k(f,_,L),u(_,S,L),k(H,_,L),u(_,z,L),k(D,_,L),u(_,Y,L),k(te,_,L),u(_,re,L),k(Q,_,L),u(_,ae,L),k(J,_,L),u(_,se,L),k(ne,_,L),u(_,x,L),k(K,_,L),u(_,ee,L),k(le,_,L),u(_,oe,L),k(G,_,L),u(_,_e,L),k(X,_,L),ie=!0},p:st,i(_){ie||(m(t.$$.fragment,_),m(e.$$.fragment,_),m(s.$$.fragment,_),m(R.$$.fragment,_),m(r.$$.fragment,_),m(c.$$.fragment,_),m(M.$$.fragment,_),m(q.$$.fragment,_),m(f.$$.fragment,_),m(H.$$.fragment,_),m(D.$$.fragment,_),m(te.$$.fragment,_),m(Q.$$.fragment,_),m(J.$$.fragment,_),m(ne.$$.fragment,_),m(K.$$.fragment,_),m(le.$$.fragment,_),m(G.$$.fragment,_),m(X.$$.fragment,_),ie=!0)},o(_){p(t.$$.fragment,_),p(e.$$.fragment,_),p(s.$$.fragment,_),p(R.$$.fragment,_),p(r.$$.fragment,_),p(c.$$.fragment,_),p(M.$$.fragment,_),p(q.$$.fragment,_),p(f.$$.fragment,_),p(H.$$.fragment,_),p(D.$$.fragment,_),p(te.$$.fragment,_),p(Q.$$.fragment,_),p(J.$$.fragment,_),p(ne.$$.fragment,_),p(K.$$.fragment,_),p(le.$$.fragment,_),p(G.$$.fragment,_),p(X.$$.fragment,_),ie=!1},d(_){_&&(d(i),d(n),d(a),d(C),d(F),d(I),d(P),d(N),d(S),d(z),d(Y),d(re),d(ae),d(se),d(x),d(ee),d(oe),d(_e)),w(t,_),w(e,_),w(s,_),w(R,_),w(r,_),w(c,_),w(M,_),w(q,_),w(f,_),w(H,_),w(D,_),w(te,_),w(Q,_),w(J,_),w(ne,_),w(K,_),w(le,_),w(G,_),w(X,_)}}}function tl(o){let t,i='<em class="markdown">Utilisez les 6 filtres ci-dessous pour affiner votre selection. Le tableau, les graphiques et les metriques se mettent a jour en temps reel.</em>',e,n,s,a,R,C,r,F,c,I,M,P,q='<a href="#synthese-de-la-selection-filtree">Synthese de la Selection Filtree</a>',N,f,S,H,z,D,Y,te,re,Q,ae,J,se='<a href="#nuage-de-points-filtre">Nuage de Points Filtre</a>',ne,x,K,ee,le='<a href="#repartition-sectorielle-selection-filtree">Repartition Sectorielle (Selection Filtree)</a>',oe,G,_e,X,ie='<a href="#tableau-detaille--selection-filtree">Tableau Detaille — Selection Filtree</a>',_,L,Ae,fe,me;return n=new qa({props:{name:"sector_dd",title:"Secteur",defaultValue:"%",$$slots:{default:[Za]},$$scope:{ctx:o}}}),a=new Ea({props:{name:"region_bg",title:"Region",defaultValue:"%",$$slots:{default:[xa]},$$scope:{ctx:o}}}),C=new mi({props:{name:"pe_slider",title:"P/E Forward Maximum",min:"0",max:"200",step:"5",defaultValue:"200"}}),F=new mi({props:{name:"mcap_slider",title:"Capitalisation Minimum ($)",min:"0",max:"2000000000000",step:"50000000000",fmt:"usd0",defaultValue:"0"}}),I=new mi({props:{name:"div_slider",title:"Dividend Yield Minimum (%)",min:"0",max:"10",step:"0.5",defaultValue:"0"}}),f=new Rt({props:{data:o[22],value:"nb",title:"Actions",emptySet:"pass"}}),H=new Rt({props:{data:o[24],value:"total_mcap",title:"Cap. Totale",fmt:"usd",emptySet:"pass"}}),D=new Rt({props:{data:o[23],value:"avg_pe",title:"P/E Forward Moy.",emptySet:"pass"}}),te=new Rt({props:{data:o[25],value:"avg_div",title:"Div. Yield Moy. (%)",emptySet:"pass"}}),Q=new Rt({props:{data:o[26],value:"avg_change",title:"Var. Moy. (%)",emptySet:"pass"}}),x=new ui({props:{data:o[27],x:"pe_forward",y:"change_pct",size:"market_cap",series:"region",xAxisTitle:"P/E Forward",yAxisTitle:"Variation du Jour (%)",title:"P/E Forward vs Performance — Selection Filtree",tooltipTitle:"symbol",emptySet:"pass"}}),G=new It({props:{data:o[28],x:"sector",y:"total_mcap",title:"Capitalisation par Secteur — Selection Filtree",fmt:"usd",swapXY:"true",sort:"false",emptySet:"pass"}}),L=new ia({props:{data:o[21],queryName:"filtered_stocks_export",emptySet:"pass"}}),fe=new Dt({props:{data:o[21],search:"true",rows:"25",emptySet:"pass",$$slots:{default:[el]},$$scope:{ctx:o}}}),{c(){t=Z("p"),t.innerHTML=i,e=g(),h(n.$$.fragment),s=g(),h(a.$$.fragment),R=g(),h(C.$$.fragment),r=g(),h(F.$$.fragment),c=g(),h(I.$$.fragment),M=g(),P=Z("h3"),P.innerHTML=q,N=g(),h(f.$$.fragment),S=g(),h(H.$$.fragment),z=g(),h(D.$$.fragment),Y=g(),h(te.$$.fragment),re=g(),h(Q.$$.fragment),ae=g(),J=Z("h3"),J.innerHTML=se,ne=g(),h(x.$$.fragment),K=g(),ee=Z("h3"),ee.innerHTML=le,oe=g(),h(G.$$.fragment),_e=g(),X=Z("h3"),X.innerHTML=ie,_=g(),h(L.$$.fragment),Ae=g(),h(fe.$$.fragment),this.h()},l(T){t=W(T,"P",{class:!0,"data-svelte-h":!0}),pe(t)!=="svelte-1m6y297"&&(t.innerHTML=i),e=$(T),y(n.$$.fragment,T),s=$(T),y(a.$$.fragment,T),R=$(T),y(C.$$.fragment,T),r=$(T),y(F.$$.fragment,T),c=$(T),y(I.$$.fragment,T),M=$(T),P=W(T,"H3",{class:!0,id:!0,"data-svelte-h":!0}),pe(P)!=="svelte-ej8bbi"&&(P.innerHTML=q),N=$(T),y(f.$$.fragment,T),S=$(T),y(H.$$.fragment,T),z=$(T),y(D.$$.fragment,T),Y=$(T),y(te.$$.fragment,T),re=$(T),y(Q.$$.fragment,T),ae=$(T),J=W(T,"H3",{class:!0,id:!0,"data-svelte-h":!0}),pe(J)!=="svelte-uak026"&&(J.innerHTML=se),ne=$(T),y(x.$$.fragment,T),K=$(T),ee=W(T,"H3",{class:!0,id:!0,"data-svelte-h":!0}),pe(ee)!=="svelte-z01p8i"&&(ee.innerHTML=le),oe=$(T),y(G.$$.fragment,T),_e=$(T),X=W(T,"H3",{class:!0,id:!0,"data-svelte-h":!0}),pe(X)!=="svelte-x16xi9"&&(X.innerHTML=ie),_=$(T),y(L.$$.fragment,T),Ae=$(T),y(fe.$$.fragment,T),this.h()},h(){V(t,"class","markdown"),V(P,"class","markdown"),V(P,"id","synthese-de-la-selection-filtree"),V(J,"class","markdown"),V(J,"id","nuage-de-points-filtre"),V(ee,"class","markdown"),V(ee,"id","repartition-sectorielle-selection-filtree"),V(X,"class","markdown"),V(X,"id","tableau-detaille--selection-filtree")},m(T,b){u(T,t,b),u(T,e,b),k(n,T,b),u(T,s,b),k(a,T,b),u(T,R,b),k(C,T,b),u(T,r,b),k(F,T,b),u(T,c,b),k(I,T,b),u(T,M,b),u(T,P,b),u(T,N,b),k(f,T,b),u(T,S,b),k(H,T,b),u(T,z,b),k(D,T,b),u(T,Y,b),k(te,T,b),u(T,re,b),k(Q,T,b),u(T,ae,b),u(T,J,b),u(T,ne,b),k(x,T,b),u(T,K,b),u(T,ee,b),u(T,oe,b),k(G,T,b),u(T,_e,b),u(T,X,b),u(T,_,b),k(L,T,b),u(T,Ae,b),k(fe,T,b),me=!0},p(T,b){const U={};b[0]&1048576|b[6]&512&&(U.$$scope={dirty:b,ctx:T}),n.$set(U);const Pe={};b[6]&512&&(Pe.$$scope={dirty:b,ctx:T}),a.$set(Pe);const be={};b[0]&4194304&&(be.data=T[22]),f.$set(be);const ce={};b[0]&16777216&&(ce.data=T[24]),H.$set(ce);const it={};b[0]&8388608&&(it.data=T[23]),D.$set(it);const Ne={};b[0]&33554432&&(Ne.data=T[25]),te.$set(Ne);const nt={};b[0]&67108864&&(nt.data=T[26]),Q.$set(nt);const rt={};b[0]&134217728&&(rt.data=T[27]),x.$set(rt);const Ue={};b[0]&268435456&&(Ue.data=T[28]),G.$set(Ue);const $e={};b[0]&2097152&&($e.data=T[21]),L.$set($e);const tt={};b[0]&2097152&&(tt.data=T[21]),b[6]&512&&(tt.$$scope={dirty:b,ctx:T}),fe.$set(tt)},i(T){me||(m(n.$$.fragment,T),m(a.$$.fragment,T),m(C.$$.fragment,T),m(F.$$.fragment,T),m(I.$$.fragment,T),m(f.$$.fragment,T),m(H.$$.fragment,T),m(D.$$.fragment,T),m(te.$$.fragment,T),m(Q.$$.fragment,T),m(x.$$.fragment,T),m(G.$$.fragment,T),m(L.$$.fragment,T),m(fe.$$.fragment,T),me=!0)},o(T){p(n.$$.fragment,T),p(a.$$.fragment,T),p(C.$$.fragment,T),p(F.$$.fragment,T),p(I.$$.fragment,T),p(f.$$.fragment,T),p(H.$$.fragment,T),p(D.$$.fragment,T),p(te.$$.fragment,T),p(Q.$$.fragment,T),p(x.$$.fragment,T),p(G.$$.fragment,T),p(L.$$.fragment,T),p(fe.$$.fragment,T),me=!1},d(T){T&&(d(t),d(e),d(s),d(R),d(r),d(c),d(M),d(P),d(N),d(S),d(z),d(Y),d(re),d(ae),d(J),d(ne),d(K),d(ee),d(oe),d(_e),d(X),d(_),d(Ae)),w(n,T),w(a,T),w(C,T),w(F,T),w(I,T),w(f,T),w(H,T),w(D,T),w(te,T),w(Q,T),w(x,T),w(G,T),w(L,T),w(fe,T)}}}function rl(o){let t,i,e,n,s,a,R,C,r,F,c,I,M,P,q,N,f,S,H,z;return t=new A({props:{id:"symbol",title:"Ticker"}}),e=new A({props:{id:"name",title:"Nom"}}),s=new A({props:{id:"price",title:"Prix",fmt:"usd"}}),R=new A({props:{id:"change_pct",title:"Var %",fmt:"num2"}}),r=new A({props:{id:"market_cap",title:"Cap.",fmt:"usd"}}),c=new A({props:{id:"pe_forward",title:"P/E Fwd",fmt:"num1"}}),M=new A({props:{id:"dividend_yield",title:"Div %",fmt:"num2"}}),q=new A({props:{id:"sector",title:"Secteur"}}),f=new A({props:{id:"region",title:"Region"}}),H=new A({props:{id:"country",title:"Pays"}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment),C=g(),h(r.$$.fragment),F=g(),h(c.$$.fragment),I=g(),h(M.$$.fragment),P=g(),h(q.$$.fragment),N=g(),h(f.$$.fragment),S=g(),h(H.$$.fragment)},l(D){y(t.$$.fragment,D),i=$(D),y(e.$$.fragment,D),n=$(D),y(s.$$.fragment,D),a=$(D),y(R.$$.fragment,D),C=$(D),y(r.$$.fragment,D),F=$(D),y(c.$$.fragment,D),I=$(D),y(M.$$.fragment,D),P=$(D),y(q.$$.fragment,D),N=$(D),y(f.$$.fragment,D),S=$(D),y(H.$$.fragment,D)},m(D,Y){k(t,D,Y),u(D,i,Y),k(e,D,Y),u(D,n,Y),k(s,D,Y),u(D,a,Y),k(R,D,Y),u(D,C,Y),k(r,D,Y),u(D,F,Y),k(c,D,Y),u(D,I,Y),k(M,D,Y),u(D,P,Y),k(q,D,Y),u(D,N,Y),k(f,D,Y),u(D,S,Y),k(H,D,Y),z=!0},p:st,i(D){z||(m(t.$$.fragment,D),m(e.$$.fragment,D),m(s.$$.fragment,D),m(R.$$.fragment,D),m(r.$$.fragment,D),m(c.$$.fragment,D),m(M.$$.fragment,D),m(q.$$.fragment,D),m(f.$$.fragment,D),m(H.$$.fragment,D),z=!0)},o(D){p(t.$$.fragment,D),p(e.$$.fragment,D),p(s.$$.fragment,D),p(R.$$.fragment,D),p(r.$$.fragment,D),p(c.$$.fragment,D),p(M.$$.fragment,D),p(q.$$.fragment,D),p(f.$$.fragment,D),p(H.$$.fragment,D),z=!1},d(D){D&&(d(i),d(n),d(a),d(C),d(F),d(I),d(P),d(N),d(S)),w(t,D),w(e,D),w(s,D),w(R,D),w(r,D),w(c,D),w(M,D),w(q,D),w(f,D),w(H,D)}}}function il(o){let t,i='<em class="markdown">Tapez un symbole (ticker) pour trouver rapidement une action. Les resultats sont tries par pertinence.</em>',e,n,s,a,R='<a href="#resultats-de-recherche">Resultats de Recherche</a>',C,r,F;return n=new Ma({props:{name:"search_input",title:"Rechercher un Ticker",placeholder:"Ex: AAPL, MSFT, NVDA..."}}),r=new Dt({props:{data:o[29],rows:"20",emptySet:"pass",$$slots:{default:[rl]},$$scope:{ctx:o}}}),{c(){t=Z("p"),t.innerHTML=i,e=g(),h(n.$$.fragment),s=g(),a=Z("h3"),a.innerHTML=R,C=g(),h(r.$$.fragment),this.h()},l(c){t=W(c,"P",{class:!0,"data-svelte-h":!0}),pe(t)!=="svelte-c6n338"&&(t.innerHTML=i),e=$(c),y(n.$$.fragment,c),s=$(c),a=W(c,"H3",{class:!0,id:!0,"data-svelte-h":!0}),pe(a)!=="svelte-1kd6bvz"&&(a.innerHTML=R),C=$(c),y(r.$$.fragment,c),this.h()},h(){V(t,"class","markdown"),V(a,"class","markdown"),V(a,"id","resultats-de-recherche")},m(c,I){u(c,t,I),u(c,e,I),k(n,c,I),u(c,s,I),u(c,a,I),u(c,C,I),k(r,c,I),F=!0},p(c,I){const M={};I[0]&536870912&&(M.data=c[29]),I[6]&512&&(M.$$scope={dirty:I,ctx:c}),r.$set(M)},i(c){F||(m(n.$$.fragment,c),m(r.$$.fragment,c),F=!0)},o(c){p(n.$$.fragment,c),p(r.$$.fragment,c),F=!1},d(c){c&&(d(t),d(e),d(s),d(a),d(C)),w(n,c),w(r,c)}}}function al(o){let t,i,e,n,s,a,R,C;return t=new Er({props:{label:"Vue Globale",$$slots:{default:[Oa]},$$scope:{ctx:o}}}),e=new Er({props:{label:"Classements",$$slots:{default:[Wa]},$$scope:{ctx:o}}}),s=new Er({props:{label:"Filtrage Interactif",$$slots:{default:[tl]},$$scope:{ctx:o}}}),R=new Er({props:{label:"Recherche",$$slots:{default:[il]},$$scope:{ctx:o}}}),{c(){h(t.$$.fragment),i=g(),h(e.$$.fragment),n=g(),h(s.$$.fragment),a=g(),h(R.$$.fragment)},l(r){y(t.$$.fragment,r),i=$(r),y(e.$$.fragment,r),n=$(r),y(s.$$.fragment,r),a=$(r),y(R.$$.fragment,r)},m(r,F){k(t,r,F),u(r,i,F),k(e,r,F),u(r,n,F),k(s,r,F),u(r,a,F),k(R,r,F),C=!0},p(r,F){const c={};F[0]&443267|F[6]&512&&(c.$$scope={dirty:F,ctx:r}),t.$set(c);const I={};F[0]&605184|F[6]&512&&(I.$$scope={dirty:F,ctx:r}),e.$set(I);const M={};F[0]&535822336|F[6]&512&&(M.$$scope={dirty:F,ctx:r}),s.$set(M);const P={};F[0]&536870912|F[6]&512&&(P.$$scope={dirty:F,ctx:r}),R.$set(P)},i(r){C||(m(t.$$.fragment,r),m(e.$$.fragment,r),m(s.$$.fragment,r),m(R.$$.fragment,r),C=!0)},o(r){p(t.$$.fragment,r),p(e.$$.fragment,r),p(s.$$.fragment,r),p(R.$$.fragment,r),C=!1},d(r){r&&(d(i),d(n),d(a)),w(t,r),w(e,r),w(s,r),w(R,r)}}}function ll(o){let t;return{c(){t=mt("Accueil")},l(i){t=ft(i,"Accueil")},m(i,e){u(i,t,e)},d(i){i&&d(t)}}}function nl(o){let t;return{c(){t=mt("Analyse Sectorielle")},l(i){t=ft(i,"Analyse Sectorielle")},m(i,e){u(i,t,e)},d(i){i&&d(t)}}}function sl(o){let t;return{c(){t=mt("Analyse Geographique")},l(i){t=ft(i,"Analyse Geographique")},m(i,e){u(i,t,e)},d(i){i&&d(t)}}}function ol(o){let t;return{c(){t=mt("Lab de Valorisation")},l(i){t=ft(i,"Lab de Valorisation")},m(i,e){u(i,t,e)},d(i){i&&d(t)}}}function _l(o){let t;return{c(){t=mt("Croissance & Rentabilite")},l(i){t=ft(i,"Croissance & Rentabilite")},m(i,e){u(i,t,e)},d(i){i&&d(t)}}}function fl(o){let t,i,e,n,s,a,R="← Retour Market Watch",C,r,F,c,I,M,P,q,N,f,S,H,z,D,Y,te,re,Q,ae,J,se,ne,x,K,ee,le,oe,G,_e,X,ie,_,L='<a href="#explorateur-dactions">Explorateur d&#39;Actions</a>',Ae,fe,me,T,b='<a href="#metriques-globales">Metriques Globales</a>',U,Pe,be,ce,it,Ne,nt,rt,Ue,$e,tt,at,$t,E,B,lt,gt,pt,yt,dt,ct,ot,vt,ut,St,wt,kt,_t=typeof Le<"u"&&Le.title&&Le.hide_title!==!0&&La();function Pt(l,v){return typeof Le<"u"&&Le.title?Pa:Aa}let Ht=Pt()(o),bt=typeof Le=="object"&&Na(),we=o[0]&&yi(o),ke=o[1]&&hi(o),De=o[2]&&Ri(o),Ve=o[3]&&Ti(o),Be=o[4]&&qi(o),je=o[5]&&Ei(o),ye=o[6]&&Fi(o),he=o[7]&&Ci(o),He=o[8]&&Di(o),ze=o[9]&&Hi(o),Oe=o[10]&&Ii(o),Ye=o[11]&&Si(o),Re=o[12]&&Mi(o),Te=o[13]&&Li(o),Ie=o[14]&&Ai(o),Ge=o[15]&&Pi(o),Qe=o[16]&&Ni(o),Je=o[17]&&Ui(o),qe=o[18]&&Vi(o),Ee=o[19]&&Bi(o),Se=o[20]&&ji(o),Xe=o[21]&&zi(o),Ke=o[22]&&Oi(o),We=o[23]&&Yi(o),Fe=o[24]&&Gi(o),Ce=o[25]&&Qi(o),Me=o[26]&&Ji(o),Ze=o[27]&&Xi(o),xe=o[28]&&Ki(o),et=o[29]&&Wi(o);return fe=new ka({props:{status:"info",$$slots:{default:[Ba]},$$scope:{ctx:o}}}),Pe=new Rt({props:{data:o[1],value:"total",title:"Actions Couvertes"}}),ce=new Rt({props:{data:o[3],value:"total_mcap",title:"Capitalisation Totale",fmt:"usd"}}),Ne=new Rt({props:{data:o[2],value:"avg_pe",title:"P/E Forward Moyen"}}),rt=new Rt({props:{data:o[6],value:"median_pe",title:"P/E Forward Median"}}),$e=new Rt({props:{data:o[4],value:"avg_div",title:"Div. Yield Moyen (%)"}}),at=new Rt({props:{data:o[5],value:"avg_beta",title:"Beta Moyen"}}),E=new ya({props:{$$slots:{default:[al]},$$scope:{ctx:o}}}),pt=new Rr({props:{url:"/",$$slots:{default:[ll]},$$scope:{ctx:o}}}),dt=new Rr({props:{url:"/sectors",$$slots:{default:[nl]},$$scope:{ctx:o}}}),ot=new Rr({props:{url:"/regions",$$slots:{default:[sl]},$$scope:{ctx:o}}}),ut=new Rr({props:{url:"/valuations",$$slots:{default:[ol]},$$scope:{ctx:o}}}),wt=new Rr({props:{url:"/earnings",$$slots:{default:[_l]},$$scope:{ctx:o}}}),{c(){_t&&_t.c(),t=g(),Ht.c(),i=Z("meta"),e=Z("meta"),bt&&bt.c(),n=dr(),s=g(),a=Z("a"),a.textContent=R,C=g(),we&&we.c(),r=g(),ke&&ke.c(),F=g(),De&&De.c(),c=g(),Ve&&Ve.c(),I=g(),Be&&Be.c(),M=g(),je&&je.c(),P=g(),ye&&ye.c(),q=g(),he&&he.c(),N=g(),He&&He.c(),f=g(),ze&&ze.c(),S=g(),Oe&&Oe.c(),H=g(),Ye&&Ye.c(),z=g(),Re&&Re.c(),D=g(),Te&&Te.c(),Y=g(),Ie&&Ie.c(),te=g(),Ge&&Ge.c(),re=g(),Qe&&Qe.c(),Q=g(),Je&&Je.c(),ae=g(),qe&&qe.c(),J=g(),Ee&&Ee.c(),se=g(),Se&&Se.c(),ne=g(),Xe&&Xe.c(),x=g(),Ke&&Ke.c(),K=g(),We&&We.c(),ee=g(),Fe&&Fe.c(),le=g(),Ce&&Ce.c(),oe=g(),Me&&Me.c(),G=g(),Ze&&Ze.c(),_e=g(),xe&&xe.c(),X=g(),et&&et.c(),ie=g(),_=Z("h1"),_.innerHTML=L,Ae=g(),h(fe.$$.fragment),me=g(),T=Z("h2"),T.innerHTML=b,U=g(),h(Pe.$$.fragment),be=g(),h(ce.$$.fragment),it=g(),h(Ne.$$.fragment),nt=g(),h(rt.$$.fragment),Ue=g(),h($e.$$.fragment),tt=g(),h(at.$$.fragment),$t=g(),h(E.$$.fragment),B=g(),lt=Z("hr"),gt=g(),h(pt.$$.fragment),yt=g(),h(dt.$$.fragment),ct=g(),h(ot.$$.fragment),vt=g(),h(ut.$$.fragment),St=g(),h(wt.$$.fragment),this.h()},l(l){_t&&_t.l(l),t=$(l);const v=sa("svelte-2igo1p",document.head);Ht.l(v),i=W(v,"META",{name:!0,content:!0}),e=W(v,"META",{name:!0,content:!0}),bt&&bt.l(v),n=dr(),v.forEach(d),s=$(l),a=W(l,"A",{href:!0,style:!0,"data-svelte-h":!0}),pe(a)!=="svelte-80akn7"&&(a.textContent=R),C=$(l),we&&we.l(l),r=$(l),ke&&ke.l(l),F=$(l),De&&De.l(l),c=$(l),Ve&&Ve.l(l),I=$(l),Be&&Be.l(l),M=$(l),je&&je.l(l),P=$(l),ye&&ye.l(l),q=$(l),he&&he.l(l),N=$(l),He&&He.l(l),f=$(l),ze&&ze.l(l),S=$(l),Oe&&Oe.l(l),H=$(l),Ye&&Ye.l(l),z=$(l),Re&&Re.l(l),D=$(l),Te&&Te.l(l),Y=$(l),Ie&&Ie.l(l),te=$(l),Ge&&Ge.l(l),re=$(l),Qe&&Qe.l(l),Q=$(l),Je&&Je.l(l),ae=$(l),qe&&qe.l(l),J=$(l),Ee&&Ee.l(l),se=$(l),Se&&Se.l(l),ne=$(l),Xe&&Xe.l(l),x=$(l),Ke&&Ke.l(l),K=$(l),We&&We.l(l),ee=$(l),Fe&&Fe.l(l),le=$(l),Ce&&Ce.l(l),oe=$(l),Me&&Me.l(l),G=$(l),Ze&&Ze.l(l),_e=$(l),xe&&xe.l(l),X=$(l),et&&et.l(l),ie=$(l),_=W(l,"H1",{class:!0,id:!0,"data-svelte-h":!0}),pe(_)!=="svelte-1u6m5qh"&&(_.innerHTML=L),Ae=$(l),y(fe.$$.fragment,l),me=$(l),T=W(l,"H2",{class:!0,id:!0,"data-svelte-h":!0}),pe(T)!=="svelte-1fxxn94"&&(T.innerHTML=b),U=$(l),y(Pe.$$.fragment,l),be=$(l),y(ce.$$.fragment,l),it=$(l),y(Ne.$$.fragment,l),nt=$(l),y(rt.$$.fragment,l),Ue=$(l),y($e.$$.fragment,l),tt=$(l),y(at.$$.fragment,l),$t=$(l),y(E.$$.fragment,l),B=$(l),lt=W(l,"HR",{class:!0}),gt=$(l),y(pt.$$.fragment,l),yt=$(l),y(dt.$$.fragment,l),ct=$(l),y(ot.$$.fragment,l),vt=$(l),y(ut.$$.fragment,l),St=$(l),y(wt.$$.fragment,l),this.h()},h(){V(i,"name","twitter:card"),V(i,"content","summary_large_image"),V(e,"name","twitter:site"),V(e,"content","@evidence_dev"),V(a,"href","/lab/"),ht(a,"display","inline-flex"),ht(a,"align-items","center"),ht(a,"gap","6px"),ht(a,"padding","6px 14px"),ht(a,"background","#f1f5f9"),ht(a,"border","1px solid #e2e8f0"),ht(a,"border-radius","8px"),ht(a,"color","#475569"),ht(a,"text-decoration","none"),ht(a,"font-size","0.85rem"),ht(a,"margin-bottom","1rem"),V(_,"class","markdown"),V(_,"id","explorateur-dactions"),V(T,"class","markdown"),V(T,"id","metriques-globales"),V(lt,"class","markdown")},m(l,v){_t&&_t.m(l,v),u(l,t,v),Ht.m(document.head,null),Tt(document.head,i),Tt(document.head,e),bt&&bt.m(document.head,null),Tt(document.head,n),u(l,s,v),u(l,a,v),u(l,C,v),we&&we.m(l,v),u(l,r,v),ke&&ke.m(l,v),u(l,F,v),De&&De.m(l,v),u(l,c,v),Ve&&Ve.m(l,v),u(l,I,v),Be&&Be.m(l,v),u(l,M,v),je&&je.m(l,v),u(l,P,v),ye&&ye.m(l,v),u(l,q,v),he&&he.m(l,v),u(l,N,v),He&&He.m(l,v),u(l,f,v),ze&&ze.m(l,v),u(l,S,v),Oe&&Oe.m(l,v),u(l,H,v),Ye&&Ye.m(l,v),u(l,z,v),Re&&Re.m(l,v),u(l,D,v),Te&&Te.m(l,v),u(l,Y,v),Ie&&Ie.m(l,v),u(l,te,v),Ge&&Ge.m(l,v),u(l,re,v),Qe&&Qe.m(l,v),u(l,Q,v),Je&&Je.m(l,v),u(l,ae,v),qe&&qe.m(l,v),u(l,J,v),Ee&&Ee.m(l,v),u(l,se,v),Se&&Se.m(l,v),u(l,ne,v),Xe&&Xe.m(l,v),u(l,x,v),Ke&&Ke.m(l,v),u(l,K,v),We&&We.m(l,v),u(l,ee,v),Fe&&Fe.m(l,v),u(l,le,v),Ce&&Ce.m(l,v),u(l,oe,v),Me&&Me.m(l,v),u(l,G,v),Ze&&Ze.m(l,v),u(l,_e,v),xe&&xe.m(l,v),u(l,X,v),et&&et.m(l,v),u(l,ie,v),u(l,_,v),u(l,Ae,v),k(fe,l,v),u(l,me,v),u(l,T,v),u(l,U,v),k(Pe,l,v),u(l,be,v),k(ce,l,v),u(l,it,v),k(Ne,l,v),u(l,nt,v),k(rt,l,v),u(l,Ue,v),k($e,l,v),u(l,tt,v),k(at,l,v),u(l,$t,v),k(E,l,v),u(l,B,v),u(l,lt,v),u(l,gt,v),k(pt,l,v),u(l,yt,v),k(dt,l,v),u(l,ct,v),k(ot,l,v),u(l,vt,v),k(ut,l,v),u(l,St,v),k(wt,l,v),kt=!0},p(l,v){typeof Le<"u"&&Le.title&&Le.hide_title!==!0&&_t.p(l,v),Ht.p(l,v),typeof Le=="object"&&bt.p(l,v),l[0]?we?(we.p(l,v),v[0]&1&&m(we,1)):(we=yi(l),we.c(),m(we,1),we.m(r.parentNode,r)):we&&(de(),p(we,1,1,()=>{we=null}),ue()),l[1]?ke?(ke.p(l,v),v[0]&2&&m(ke,1)):(ke=hi(l),ke.c(),m(ke,1),ke.m(F.parentNode,F)):ke&&(de(),p(ke,1,1,()=>{ke=null}),ue()),l[2]?De?(De.p(l,v),v[0]&4&&m(De,1)):(De=Ri(l),De.c(),m(De,1),De.m(c.parentNode,c)):De&&(de(),p(De,1,1,()=>{De=null}),ue()),l[3]?Ve?(Ve.p(l,v),v[0]&8&&m(Ve,1)):(Ve=Ti(l),Ve.c(),m(Ve,1),Ve.m(I.parentNode,I)):Ve&&(de(),p(Ve,1,1,()=>{Ve=null}),ue()),l[4]?Be?(Be.p(l,v),v[0]&16&&m(Be,1)):(Be=qi(l),Be.c(),m(Be,1),Be.m(M.parentNode,M)):Be&&(de(),p(Be,1,1,()=>{Be=null}),ue()),l[5]?je?(je.p(l,v),v[0]&32&&m(je,1)):(je=Ei(l),je.c(),m(je,1),je.m(P.parentNode,P)):je&&(de(),p(je,1,1,()=>{je=null}),ue()),l[6]?ye?(ye.p(l,v),v[0]&64&&m(ye,1)):(ye=Fi(l),ye.c(),m(ye,1),ye.m(q.parentNode,q)):ye&&(de(),p(ye,1,1,()=>{ye=null}),ue()),l[7]?he?(he.p(l,v),v[0]&128&&m(he,1)):(he=Ci(l),he.c(),m(he,1),he.m(N.parentNode,N)):he&&(de(),p(he,1,1,()=>{he=null}),ue()),l[8]?He?(He.p(l,v),v[0]&256&&m(He,1)):(He=Di(l),He.c(),m(He,1),He.m(f.parentNode,f)):He&&(de(),p(He,1,1,()=>{He=null}),ue()),l[9]?ze?(ze.p(l,v),v[0]&512&&m(ze,1)):(ze=Hi(l),ze.c(),m(ze,1),ze.m(S.parentNode,S)):ze&&(de(),p(ze,1,1,()=>{ze=null}),ue()),l[10]?Oe?(Oe.p(l,v),v[0]&1024&&m(Oe,1)):(Oe=Ii(l),Oe.c(),m(Oe,1),Oe.m(H.parentNode,H)):Oe&&(de(),p(Oe,1,1,()=>{Oe=null}),ue()),l[11]?Ye?(Ye.p(l,v),v[0]&2048&&m(Ye,1)):(Ye=Si(l),Ye.c(),m(Ye,1),Ye.m(z.parentNode,z)):Ye&&(de(),p(Ye,1,1,()=>{Ye=null}),ue()),l[12]?Re?(Re.p(l,v),v[0]&4096&&m(Re,1)):(Re=Mi(l),Re.c(),m(Re,1),Re.m(D.parentNode,D)):Re&&(de(),p(Re,1,1,()=>{Re=null}),ue()),l[13]?Te?(Te.p(l,v),v[0]&8192&&m(Te,1)):(Te=Li(l),Te.c(),m(Te,1),Te.m(Y.parentNode,Y)):Te&&(de(),p(Te,1,1,()=>{Te=null}),ue()),l[14]?Ie?(Ie.p(l,v),v[0]&16384&&m(Ie,1)):(Ie=Ai(l),Ie.c(),m(Ie,1),Ie.m(te.parentNode,te)):Ie&&(de(),p(Ie,1,1,()=>{Ie=null}),ue()),l[15]?Ge?(Ge.p(l,v),v[0]&32768&&m(Ge,1)):(Ge=Pi(l),Ge.c(),m(Ge,1),Ge.m(re.parentNode,re)):Ge&&(de(),p(Ge,1,1,()=>{Ge=null}),ue()),l[16]?Qe?(Qe.p(l,v),v[0]&65536&&m(Qe,1)):(Qe=Ni(l),Qe.c(),m(Qe,1),Qe.m(Q.parentNode,Q)):Qe&&(de(),p(Qe,1,1,()=>{Qe=null}),ue()),l[17]?Je?(Je.p(l,v),v[0]&131072&&m(Je,1)):(Je=Ui(l),Je.c(),m(Je,1),Je.m(ae.parentNode,ae)):Je&&(de(),p(Je,1,1,()=>{Je=null}),ue()),l[18]?qe?(qe.p(l,v),v[0]&262144&&m(qe,1)):(qe=Vi(l),qe.c(),m(qe,1),qe.m(J.parentNode,J)):qe&&(de(),p(qe,1,1,()=>{qe=null}),ue()),l[19]?Ee?(Ee.p(l,v),v[0]&524288&&m(Ee,1)):(Ee=Bi(l),Ee.c(),m(Ee,1),Ee.m(se.parentNode,se)):Ee&&(de(),p(Ee,1,1,()=>{Ee=null}),ue()),l[20]?Se?(Se.p(l,v),v[0]&1048576&&m(Se,1)):(Se=ji(l),Se.c(),m(Se,1),Se.m(ne.parentNode,ne)):Se&&(de(),p(Se,1,1,()=>{Se=null}),ue()),l[21]?Xe?(Xe.p(l,v),v[0]&2097152&&m(Xe,1)):(Xe=zi(l),Xe.c(),m(Xe,1),Xe.m(x.parentNode,x)):Xe&&(de(),p(Xe,1,1,()=>{Xe=null}),ue()),l[22]?Ke?(Ke.p(l,v),v[0]&4194304&&m(Ke,1)):(Ke=Oi(l),Ke.c(),m(Ke,1),Ke.m(K.parentNode,K)):Ke&&(de(),p(Ke,1,1,()=>{Ke=null}),ue()),l[23]?We?(We.p(l,v),v[0]&8388608&&m(We,1)):(We=Yi(l),We.c(),m(We,1),We.m(ee.parentNode,ee)):We&&(de(),p(We,1,1,()=>{We=null}),ue()),l[24]?Fe?(Fe.p(l,v),v[0]&16777216&&m(Fe,1)):(Fe=Gi(l),Fe.c(),m(Fe,1),Fe.m(le.parentNode,le)):Fe&&(de(),p(Fe,1,1,()=>{Fe=null}),ue()),l[25]?Ce?(Ce.p(l,v),v[0]&33554432&&m(Ce,1)):(Ce=Qi(l),Ce.c(),m(Ce,1),Ce.m(oe.parentNode,oe)):Ce&&(de(),p(Ce,1,1,()=>{Ce=null}),ue()),l[26]?Me?(Me.p(l,v),v[0]&67108864&&m(Me,1)):(Me=Ji(l),Me.c(),m(Me,1),Me.m(G.parentNode,G)):Me&&(de(),p(Me,1,1,()=>{Me=null}),ue()),l[27]?Ze?(Ze.p(l,v),v[0]&134217728&&m(Ze,1)):(Ze=Xi(l),Ze.c(),m(Ze,1),Ze.m(_e.parentNode,_e)):Ze&&(de(),p(Ze,1,1,()=>{Ze=null}),ue()),l[28]?xe?(xe.p(l,v),v[0]&268435456&&m(xe,1)):(xe=Ki(l),xe.c(),m(xe,1),xe.m(X.parentNode,X)):xe&&(de(),p(xe,1,1,()=>{xe=null}),ue()),l[29]?et?(et.p(l,v),v[0]&536870912&&m(et,1)):(et=Wi(l),et.c(),m(et,1),et.m(ie.parentNode,ie)):et&&(de(),p(et,1,1,()=>{et=null}),ue());const Mt={};v[0]&2|v[6]&512&&(Mt.$$scope={dirty:v,ctx:l}),fe.$set(Mt);const nr={};v[0]&2&&(nr.data=l[1]),Pe.$set(nr);const sr={};v[0]&8&&(sr.data=l[3]),ce.$set(sr);const or={};v[0]&4&&(or.data=l[2]),Ne.$set(or);const qt={};v[0]&64&&(qt.data=l[6]),rt.$set(qt);const Et={};v[0]&16&&(Et.data=l[4]),$e.$set(Et);const Lt={};v[0]&32&&(Lt.data=l[5]),at.$set(Lt);const _r={};v[0]&1073741699|v[6]&512&&(_r.$$scope={dirty:v,ctx:l}),E.$set(_r);const fr={};v[6]&512&&(fr.$$scope={dirty:v,ctx:l}),pt.$set(fr);const mr={};v[6]&512&&(mr.$$scope={dirty:v,ctx:l}),dt.$set(mr);const Ft={};v[6]&512&&(Ft.$$scope={dirty:v,ctx:l}),ot.$set(Ft);const Ct={};v[6]&512&&(Ct.$$scope={dirty:v,ctx:l}),ut.$set(Ct);const At={};v[6]&512&&(At.$$scope={dirty:v,ctx:l}),wt.$set(At)},i(l){kt||(m(we),m(ke),m(De),m(Ve),m(Be),m(je),m(ye),m(he),m(He),m(ze),m(Oe),m(Ye),m(Re),m(Te),m(Ie),m(Ge),m(Qe),m(Je),m(qe),m(Ee),m(Se),m(Xe),m(Ke),m(We),m(Fe),m(Ce),m(Me),m(Ze),m(xe),m(et),m(fe.$$.fragment,l),m(Pe.$$.fragment,l),m(ce.$$.fragment,l),m(Ne.$$.fragment,l),m(rt.$$.fragment,l),m($e.$$.fragment,l),m(at.$$.fragment,l),m(E.$$.fragment,l),m(pt.$$.fragment,l),m(dt.$$.fragment,l),m(ot.$$.fragment,l),m(ut.$$.fragment,l),m(wt.$$.fragment,l),kt=!0)},o(l){p(we),p(ke),p(De),p(Ve),p(Be),p(je),p(ye),p(he),p(He),p(ze),p(Oe),p(Ye),p(Re),p(Te),p(Ie),p(Ge),p(Qe),p(Je),p(qe),p(Ee),p(Se),p(Xe),p(Ke),p(We),p(Fe),p(Ce),p(Me),p(Ze),p(xe),p(et),p(fe.$$.fragment,l),p(Pe.$$.fragment,l),p(ce.$$.fragment,l),p(Ne.$$.fragment,l),p(rt.$$.fragment,l),p($e.$$.fragment,l),p(at.$$.fragment,l),p(E.$$.fragment,l),p(pt.$$.fragment,l),p(dt.$$.fragment,l),p(ot.$$.fragment,l),p(ut.$$.fragment,l),p(wt.$$.fragment,l),kt=!1},d(l){l&&(d(t),d(s),d(a),d(C),d(r),d(F),d(c),d(I),d(M),d(P),d(q),d(N),d(f),d(S),d(H),d(z),d(D),d(Y),d(te),d(re),d(Q),d(ae),d(J),d(se),d(ne),d(x),d(K),d(ee),d(le),d(oe),d(G),d(_e),d(X),d(ie),d(_),d(Ae),d(me),d(T),d(U),d(be),d(it),d(nt),d(Ue),d(tt),d($t),d(B),d(lt),d(gt),d(yt),d(ct),d(vt),d(St)),_t&&_t.d(l),Ht.d(l),d(i),d(e),bt&&bt.d(l),d(n),we&&we.d(l),ke&&ke.d(l),De&&De.d(l),Ve&&Ve.d(l),Be&&Be.d(l),je&&je.d(l),ye&&ye.d(l),he&&he.d(l),He&&He.d(l),ze&&ze.d(l),Oe&&Oe.d(l),Ye&&Ye.d(l),Re&&Re.d(l),Te&&Te.d(l),Ie&&Ie.d(l),Ge&&Ge.d(l),Qe&&Qe.d(l),Je&&Je.d(l),qe&&qe.d(l),Ee&&Ee.d(l),Se&&Se.d(l),Xe&&Xe.d(l),Ke&&Ke.d(l),We&&We.d(l),Fe&&Fe.d(l),Ce&&Ce.d(l),Me&&Me.d(l),Ze&&Ze.d(l),xe&&xe.d(l),et&&et.d(l),w(fe,l),w(Pe,l),w(ce,l),w(Ne,l),w(rt,l),w($e,l),w(at,l),w(E,l),w(pt,l),w(dt,l),w(ot,l),w(ut,l),w(wt,l)}}}const Le={title:"Explorateur d'Actions",description:"Filtrez et explorez les plus grandes capitalisations boursieres par secteur, region, valorisation et metriques cles"};function ml(o,t,i){let e,n;di(o,Fa,j=>i(153,e=j)),di(o,vi,j=>i(158,n=j));let{data:s}=t,{data:a={},customFormattingSettings:R,__db:C,inputs:r}=s;ea(vi,n="d83fc44a5148cfdf9de0d3d9fb6933b3",n);let F=$a(wa(r));oa(F.subscribe(j=>i(32,r=j))),_a(ba,{getCustomFormats:()=>R.customFormats||[]});const c=(j,la)=>ha(C.query,j,{query_name:la});ga(c),e.params,fa(()=>!0);let I={initialData:void 0,initialError:void 0},M=O`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
order by market_cap desc`,P=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
order by market_cap desc`;a.all_stocks_data&&(a.all_stocks_data instanceof Error?I.initialError=a.all_stocks_data:I.initialData=a.all_stocks_data,a.all_stocks_columns&&(I.knownColumns=a.all_stocks_columns));let q,N=!1;const f=ge.createReactive({callback:j=>{i(0,q=j)},execFn:c},{id:"all_stocks",...I});f(P,{noResolve:M,...I}),globalThis[Symbol.for("all_stocks")]={get value(){return q}};let S={initialData:void 0,initialError:void 0},H=O`select count(*) as total from market.stocks`,z="select count(*) as total from market.stocks";a.static_count_data&&(a.static_count_data instanceof Error?S.initialError=a.static_count_data:S.initialData=a.static_count_data,a.static_count_columns&&(S.knownColumns=a.static_count_columns));let D,Y=!1;const te=ge.createReactive({callback:j=>{i(1,D=j)},execFn:c},{id:"static_count",...S});te(z,{noResolve:H,...S}),globalThis[Symbol.for("static_count")]={get value(){return D}};let re={initialData:void 0,initialError:void 0},Q=O`select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where pe_forward is not null and pe_forward > 0`,ae=`select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where pe_forward is not null and pe_forward > 0`;a.static_avg_pe_data&&(a.static_avg_pe_data instanceof Error?re.initialError=a.static_avg_pe_data:re.initialData=a.static_avg_pe_data,a.static_avg_pe_columns&&(re.knownColumns=a.static_avg_pe_columns));let J,se=!1;const ne=ge.createReactive({callback:j=>{i(2,J=j)},execFn:c},{id:"static_avg_pe",...re});ne(ae,{noResolve:Q,...re}),globalThis[Symbol.for("static_avg_pe")]={get value(){return J}};let x={initialData:void 0,initialError:void 0},K=O`select sum(market_cap) as total_mcap from market.stocks`,ee="select sum(market_cap) as total_mcap from market.stocks";a.static_total_mcap_data&&(a.static_total_mcap_data instanceof Error?x.initialError=a.static_total_mcap_data:x.initialData=a.static_total_mcap_data,a.static_total_mcap_columns&&(x.knownColumns=a.static_total_mcap_columns));let le,oe=!1;const G=ge.createReactive({callback:j=>{i(3,le=j)},execFn:c},{id:"static_total_mcap",...x});G(ee,{noResolve:K,...x}),globalThis[Symbol.for("static_total_mcap")]={get value(){return le}};let _e={initialData:void 0,initialError:void 0},X=O`select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where dividend_yield is not null and dividend_yield > 0`,ie=`select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where dividend_yield is not null and dividend_yield > 0`;a.static_avg_div_data&&(a.static_avg_div_data instanceof Error?_e.initialError=a.static_avg_div_data:_e.initialData=a.static_avg_div_data,a.static_avg_div_columns&&(_e.knownColumns=a.static_avg_div_columns));let _,L=!1;const Ae=ge.createReactive({callback:j=>{i(4,_=j)},execFn:c},{id:"static_avg_div",..._e});Ae(ie,{noResolve:X,..._e}),globalThis[Symbol.for("static_avg_div")]={get value(){return _}};let fe={initialData:void 0,initialError:void 0},me=O`select round(avg(beta), 2) as avg_beta
from market.stocks
where beta is not null`,T=`select round(avg(beta), 2) as avg_beta
from market.stocks
where beta is not null`;a.static_avg_beta_data&&(a.static_avg_beta_data instanceof Error?fe.initialError=a.static_avg_beta_data:fe.initialData=a.static_avg_beta_data,a.static_avg_beta_columns&&(fe.knownColumns=a.static_avg_beta_columns));let b,U=!1;const Pe=ge.createReactive({callback:j=>{i(5,b=j)},execFn:c},{id:"static_avg_beta",...fe});Pe(T,{noResolve:me,...fe}),globalThis[Symbol.for("static_avg_beta")]={get value(){return b}};let be={initialData:void 0,initialError:void 0},ce=O`select round(median(pe_forward), 1) as median_pe
from market.stocks
where pe_forward is not null and pe_forward > 0`,it=`select round(median(pe_forward), 1) as median_pe
from market.stocks
where pe_forward is not null and pe_forward > 0`;a.static_median_pe_data&&(a.static_median_pe_data instanceof Error?be.initialError=a.static_median_pe_data:be.initialData=a.static_median_pe_data,a.static_median_pe_columns&&(be.knownColumns=a.static_median_pe_columns));let Ne,nt=!1;const rt=ge.createReactive({callback:j=>{i(6,Ne=j)},execFn:c},{id:"static_median_pe",...be});rt(it,{noResolve:ce,...be}),globalThis[Symbol.for("static_median_pe")]={get value(){return Ne}};let Ue={initialData:void 0,initialError:void 0},$e=O`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and change_pct is not null`,tt=`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and change_pct is not null`;a.bubble_all_data&&(a.bubble_all_data instanceof Error?Ue.initialError=a.bubble_all_data:Ue.initialData=a.bubble_all_data,a.bubble_all_columns&&(Ue.knownColumns=a.bubble_all_columns));let at,$t=!1;const E=ge.createReactive({callback:j=>{i(7,at=j)},execFn:c},{id:"bubble_all",...Ue});E(tt,{noResolve:$e,...Ue}),globalThis[Symbol.for("bubble_all")]={get value(){return at}};let B={initialData:void 0,initialError:void 0},lt=O`select
    case
        when pe_forward < 10 then '0-10'
        when pe_forward < 20 then '10-20'
        when pe_forward < 30 then '20-30'
        when pe_forward < 40 then '30-40'
        when pe_forward < 50 then '40-50'
        when pe_forward < 75 then '50-75'
        when pe_forward < 100 then '75-100'
        else '100+'
    end as pe_range,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null and pe_forward > 0
group by 1
order by
    case
        when pe_forward < 10 then 1
        when pe_forward < 20 then 2
        when pe_forward < 30 then 3
        when pe_forward < 40 then 4
        when pe_forward < 50 then 5
        when pe_forward < 75 then 6
        when pe_forward < 100 then 7
        else 8
    end`,gt=`select
    case
        when pe_forward < 10 then '0-10'
        when pe_forward < 20 then '10-20'
        when pe_forward < 30 then '20-30'
        when pe_forward < 40 then '30-40'
        when pe_forward < 50 then '40-50'
        when pe_forward < 75 then '50-75'
        when pe_forward < 100 then '75-100'
        else '100+'
    end as pe_range,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null and pe_forward > 0
group by 1
order by
    case
        when pe_forward < 10 then 1
        when pe_forward < 20 then 2
        when pe_forward < 30 then 3
        when pe_forward < 40 then 4
        when pe_forward < 50 then 5
        when pe_forward < 75 then 6
        when pe_forward < 100 then 7
        else 8
    end`;a.pe_distribution_data&&(a.pe_distribution_data instanceof Error?B.initialError=a.pe_distribution_data:B.initialData=a.pe_distribution_data,a.pe_distribution_columns&&(B.knownColumns=a.pe_distribution_columns));let pt,yt=!1;const dt=ge.createReactive({callback:j=>{i(8,pt=j)},execFn:c},{id:"pe_distribution",...B});dt(gt,{noResolve:lt,...B}),globalThis[Symbol.for("pe_distribution")]={get value(){return pt}};let ct={initialData:void 0,initialError:void 0},ot=O`select
    symbol,
    name,
    market_cap,
    region,
    sector
from market.stocks
order by market_cap desc
limit 20`,vt=`select
    symbol,
    name,
    market_cap,
    region,
    sector
from market.stocks
order by market_cap desc
limit 20`;a.top20_mcap_data&&(a.top20_mcap_data instanceof Error?ct.initialError=a.top20_mcap_data:ct.initialData=a.top20_mcap_data,a.top20_mcap_columns&&(ct.knownColumns=a.top20_mcap_columns));let ut,St=!1;const wt=ge.createReactive({callback:j=>{i(9,ut=j)},execFn:c},{id:"top20_mcap",...ct});wt(vt,{noResolve:ot,...ct}),globalThis[Symbol.for("top20_mcap")]={get value(){return ut}};let kt={initialData:void 0,initialError:void 0},_t=O`select
    symbol,
    name,
    volume,
    price,
    change_pct,
    market_cap,
    sector
from market.stocks
where volume is not null and volume > 0
order by volume desc
limit 20`,Pt=`select
    symbol,
    name,
    volume,
    price,
    change_pct,
    market_cap,
    sector
from market.stocks
where volume is not null and volume > 0
order by volume desc
limit 20`;a.top20_volume_data&&(a.top20_volume_data instanceof Error?kt.initialError=a.top20_volume_data:kt.initialData=a.top20_volume_data,a.top20_volume_columns&&(kt.knownColumns=a.top20_volume_columns));let qr,Ht=!1;const bt=ge.createReactive({callback:j=>{i(10,qr=j)},execFn:c},{id:"top20_volume",...kt});bt(Pt,{noResolve:_t,...kt}),globalThis[Symbol.for("top20_volume")]={get value(){return qr}};let we={initialData:void 0,initialError:void 0},ke=O`select
    recommendation,
    count(*) as nb_stocks
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by nb_stocks desc`,De=`select
    recommendation,
    count(*) as nb_stocks
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by nb_stocks desc`;a.reco_breakdown_data&&(a.reco_breakdown_data instanceof Error?we.initialError=a.reco_breakdown_data:we.initialData=a.reco_breakdown_data,a.reco_breakdown_columns&&(we.knownColumns=a.reco_breakdown_columns));let Ve,Be=!1;const je=ge.createReactive({callback:j=>{i(11,Ve=j)},execFn:c},{id:"reco_breakdown",...we});je(De,{noResolve:ke,...we}),globalThis[Symbol.for("reco_breakdown")]={get value(){return Ve}};let ye={initialData:void 0,initialError:void 0},he=O`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct desc
limit 10`,He=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct desc
limit 10`;a.top_gainers_data&&(a.top_gainers_data instanceof Error?ye.initialError=a.top_gainers_data:ye.initialData=a.top_gainers_data,a.top_gainers_columns&&(ye.knownColumns=a.top_gainers_columns));let ze,Oe=!1;const Ye=ge.createReactive({callback:j=>{i(12,ze=j)},execFn:c},{id:"top_gainers",...ye});Ye(He,{noResolve:he,...ye}),globalThis[Symbol.for("top_gainers")]={get value(){return ze}};let Re={initialData:void 0,initialError:void 0},Te=O`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct asc
limit 10`,Ie=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct asc
limit 10`;a.top_losers_data&&(a.top_losers_data instanceof Error?Re.initialError=a.top_losers_data:Re.initialData=a.top_losers_data,a.top_losers_columns&&(Re.knownColumns=a.top_losers_columns));let Ge,Qe=!1;const Je=ge.createReactive({callback:j=>{i(13,Ge=j)},execFn:c},{id:"top_losers",...Re});Je(Ie,{noResolve:Te,...Re}),globalThis[Symbol.for("top_losers")]={get value(){return Ge}};let qe={initialData:void 0,initialError:void 0},Ee=O`select
    sector,
    sum(market_cap) as total_mcap,
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
group by sector
order by total_mcap desc`,Se=`select
    sector,
    sum(market_cap) as total_mcap,
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
group by sector
order by total_mcap desc`;a.sector_mcap_treemap_data&&(a.sector_mcap_treemap_data instanceof Error?qe.initialError=a.sector_mcap_treemap_data:qe.initialData=a.sector_mcap_treemap_data,a.sector_mcap_treemap_columns&&(qe.knownColumns=a.sector_mcap_treemap_columns));let Xe,Ke=!1;const We=ge.createReactive({callback:j=>{i(14,Xe=j)},execFn:c},{id:"sector_mcap_treemap",...qe});We(Se,{noResolve:Ee,...qe}),globalThis[Symbol.for("sector_mcap_treemap")]={get value(){return Xe}};let Fe={initialData:void 0,initialError:void 0},Ce=O`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
group by region
order by total_mcap desc`,Me=`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
group by region
order by total_mcap desc`;a.region_breakdown_data&&(a.region_breakdown_data instanceof Error?Fe.initialError=a.region_breakdown_data:Fe.initialData=a.region_breakdown_data,a.region_breakdown_columns&&(Fe.knownColumns=a.region_breakdown_columns));let Ze,xe=!1;const et=ge.createReactive({callback:j=>{i(15,Ze=j)},execFn:c},{id:"region_breakdown",...Fe});et(Me,{noResolve:Ce,...Fe}),globalThis[Symbol.for("region_breakdown")]={get value(){return Ze}};let l={initialData:void 0,initialError:void 0},v=O`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 15`,Mt=`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 15`;a.high_dividend_data&&(a.high_dividend_data instanceof Error?l.initialError=a.high_dividend_data:l.initialData=a.high_dividend_data,a.high_dividend_columns&&(l.knownColumns=a.high_dividend_columns));let nr,sr=!1;const or=ge.createReactive({callback:j=>{i(16,nr=j)},execFn:c},{id:"high_dividend",...l});or(Mt,{noResolve:v,...l}),globalThis[Symbol.for("high_dividend")]={get value(){return nr}};let qt={initialData:void 0,initialError:void 0},Et=O`select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null and pe_forward > 0 and pe_forward < 200
  and revenue_growth is not null`,Lt=`select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null and pe_forward > 0 and pe_forward < 200
  and revenue_growth is not null`;a.pe_vs_growth_data&&(a.pe_vs_growth_data instanceof Error?qt.initialError=a.pe_vs_growth_data:qt.initialData=a.pe_vs_growth_data,a.pe_vs_growth_columns&&(qt.knownColumns=a.pe_vs_growth_columns));let _r,fr=!1;const mr=ge.createReactive({callback:j=>{i(17,_r=j)},execFn:c},{id:"pe_vs_growth",...qt});mr(Lt,{noResolve:Et,...qt}),globalThis[Symbol.for("pe_vs_growth")]={get value(){return _r}};let Ft={initialData:void 0,initialError:void 0},Ct=O`select
    case
        when beta < 0.5 then '< 0.5 (Defensif)'
        when beta < 0.8 then '0.5-0.8 (Faible)'
        when beta < 1.0 then '0.8-1.0 (Modere)'
        when beta < 1.2 then '1.0-1.2 (Marche)'
        when beta < 1.5 then '1.2-1.5 (Eleve)'
        else '> 1.5 (Agressif)'
    end as beta_range,
    count(*) as nb_stocks
from market.stocks
where beta is not null
group by 1
order by
    case
        when beta < 0.5 then 1
        when beta < 0.8 then 2
        when beta < 1.0 then 3
        when beta < 1.2 then 4
        when beta < 1.5 then 5
        else 6
    end`,At=`select
    case
        when beta < 0.5 then '< 0.5 (Defensif)'
        when beta < 0.8 then '0.5-0.8 (Faible)'
        when beta < 1.0 then '0.8-1.0 (Modere)'
        when beta < 1.2 then '1.0-1.2 (Marche)'
        when beta < 1.5 then '1.2-1.5 (Eleve)'
        else '> 1.5 (Agressif)'
    end as beta_range,
    count(*) as nb_stocks
from market.stocks
where beta is not null
group by 1
order by
    case
        when beta < 0.5 then 1
        when beta < 0.8 then 2
        when beta < 1.0 then 3
        when beta < 1.2 then 4
        when beta < 1.5 then 5
        else 6
    end`;a.beta_distribution_data&&(a.beta_distribution_data instanceof Error?Ft.initialError=a.beta_distribution_data:Ft.initialData=a.beta_distribution_data,a.beta_distribution_columns&&(Ft.knownColumns=a.beta_distribution_columns));let Cr,Dr=!1;const Hr=ge.createReactive({callback:j=>{i(18,Cr=j)},execFn:c},{id:"beta_distribution",...Ft});Hr(At,{noResolve:Ct,...Ft}),globalThis[Symbol.for("beta_distribution")]={get value(){return Cr}};let Nt={initialData:void 0,initialError:void 0},Ut=O`select
    symbol,
    name,
    price,
    target_price,
    round((target_price - price) / price * 100, 1) as upside_pct,
    recommendation,
    pe_forward,
    sector,
    region
from market.stocks
where target_price is not null and price is not null and price > 0
order by upside_pct desc
limit 20`,ur=`select
    symbol,
    name,
    price,
    target_price,
    round((target_price - price) / price * 100, 1) as upside_pct,
    recommendation,
    pe_forward,
    sector,
    region
from market.stocks
where target_price is not null and price is not null and price > 0
order by upside_pct desc
limit 20`;a.upside_potential_data&&(a.upside_potential_data instanceof Error?Nt.initialError=a.upside_potential_data:Nt.initialData=a.upside_potential_data,a.upside_potential_columns&&(Nt.knownColumns=a.upside_potential_columns));let Ir,Sr=!1;const Mr=ge.createReactive({callback:j=>{i(19,Ir=j)},execFn:c},{id:"upside_potential",...Nt});Mr(ur,{noResolve:Ut,...Nt}),globalThis[Symbol.for("upside_potential")]={get value(){return Ir}};let Vt={initialData:void 0,initialError:void 0},Bt=O`select distinct sector as value, sector as label
from market.stocks
order by sector`,pr=`select distinct sector as value, sector as label
from market.stocks
order by sector`;a.sector_list_data&&(a.sector_list_data instanceof Error?Vt.initialError=a.sector_list_data:Vt.initialData=a.sector_list_data,a.sector_list_columns&&(Vt.knownColumns=a.sector_list_columns));let Lr,Ar=!1;const Pr=ge.createReactive({callback:j=>{i(20,Lr=j)},execFn:c},{id:"sector_list",...Vt});Pr(pr,{noResolve:Bt,...Vt}),globalThis[Symbol.for("sector_list")]={get value(){return Lr}};let jt={initialData:void 0,initialError:void 0},zt=O`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
order by market_cap desc`,cr=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
order by market_cap desc`;a.filtered_stocks_data&&(a.filtered_stocks_data instanceof Error?jt.initialError=a.filtered_stocks_data:jt.initialData=a.filtered_stocks_data,a.filtered_stocks_columns&&(jt.knownColumns=a.filtered_stocks_columns));let Nr,Ur=!1;const Vr=ge.createReactive({callback:j=>{i(21,Nr=j)},execFn:c},{id:"filtered_stocks",...jt});Vr(cr,{noResolve:zt,...jt}),globalThis[Symbol.for("filtered_stocks")]={get value(){return Nr}};let Ot={initialData:void 0,initialError:void 0},Yt=O`select count(*) as nb
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))`,$r=`select count(*) as nb
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))`;a.filtered_count_data&&(a.filtered_count_data instanceof Error?Ot.initialError=a.filtered_count_data:Ot.initialData=a.filtered_count_data,a.filtered_count_columns&&(Ot.knownColumns=a.filtered_count_columns));let Br,jr=!1;const zr=ge.createReactive({callback:j=>{i(22,Br=j)},execFn:c},{id:"filtered_count",...Ot});zr($r,{noResolve:Yt,...Ot}),globalThis[Symbol.for("filtered_count")]={get value(){return Br}};let Gt={initialData:void 0,initialError:void 0},Qt=O`select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0`,gr=`select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0`;a.filtered_avg_pe_data&&(a.filtered_avg_pe_data instanceof Error?Gt.initialError=a.filtered_avg_pe_data:Gt.initialData=a.filtered_avg_pe_data,a.filtered_avg_pe_columns&&(Gt.knownColumns=a.filtered_avg_pe_columns));let Or,Yr=!1;const Gr=ge.createReactive({callback:j=>{i(23,Or=j)},execFn:c},{id:"filtered_avg_pe",...Gt});Gr(gr,{noResolve:Qt,...Gt}),globalThis[Symbol.for("filtered_avg_pe")]={get value(){return Or}};let Jt={initialData:void 0,initialError:void 0},Xt=O`select sum(market_cap) as total_mcap
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))`,vr=`select sum(market_cap) as total_mcap
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))`;a.filtered_total_mcap_data&&(a.filtered_total_mcap_data instanceof Error?Jt.initialError=a.filtered_total_mcap_data:Jt.initialData=a.filtered_total_mcap_data,a.filtered_total_mcap_columns&&(Jt.knownColumns=a.filtered_total_mcap_columns));let Qr,Jr=!1;const Xr=ge.createReactive({callback:j=>{i(24,Qr=j)},execFn:c},{id:"filtered_total_mcap",...Jt});Xr(vr,{noResolve:Xt,...Jt}),globalThis[Symbol.for("filtered_total_mcap")]={get value(){return Qr}};let Kt={initialData:void 0,initialError:void 0},Wt=O`select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and dividend_yield is not null and dividend_yield > 0`,br=`select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and dividend_yield is not null and dividend_yield > 0`;a.filtered_avg_div_data&&(a.filtered_avg_div_data instanceof Error?Kt.initialError=a.filtered_avg_div_data:Kt.initialData=a.filtered_avg_div_data,a.filtered_avg_div_columns&&(Kt.knownColumns=a.filtered_avg_div_columns));let Kr,Wr=!1;const Zr=ge.createReactive({callback:j=>{i(25,Kr=j)},execFn:c},{id:"filtered_avg_div",...Kt});Zr(br,{noResolve:Wt,...Kt}),globalThis[Symbol.for("filtered_avg_div")]={get value(){return Kr}};let Zt={initialData:void 0,initialError:void 0},xt=O`select round(avg(change_pct), 2) as avg_change
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and change_pct is not null`,wr=`select round(avg(change_pct), 2) as avg_change
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and change_pct is not null`;a.filtered_avg_change_data&&(a.filtered_avg_change_data instanceof Error?Zt.initialError=a.filtered_avg_change_data:Zt.initialData=a.filtered_avg_change_data,a.filtered_avg_change_columns&&(Zt.knownColumns=a.filtered_avg_change_columns));let xr,ei=!1;const ti=ge.createReactive({callback:j=>{i(26,xr=j)},execFn:c},{id:"filtered_avg_change",...Zt});ti(wr,{noResolve:xt,...Zt}),globalThis[Symbol.for("filtered_avg_change")]={get value(){return xr}};let er={initialData:void 0,initialError:void 0},tr=O`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider})
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0
  and change_pct is not null`,kr=`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider})
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0
  and change_pct is not null`;a.filtered_bubble_data&&(a.filtered_bubble_data instanceof Error?er.initialError=a.filtered_bubble_data:er.initialData=a.filtered_bubble_data,a.filtered_bubble_columns&&(er.knownColumns=a.filtered_bubble_columns));let ri,ii=!1;const ai=ge.createReactive({callback:j=>{i(27,ri=j)},execFn:c},{id:"filtered_bubble",...er});ai(kr,{noResolve:tr,...er}),globalThis[Symbol.for("filtered_bubble")]={get value(){return ri}};let rr={initialData:void 0,initialError:void 0},ir=O`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
group by sector
order by total_mcap desc`,yr=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
group by sector
order by total_mcap desc`;a.filtered_sector_breakdown_data&&(a.filtered_sector_breakdown_data instanceof Error?rr.initialError=a.filtered_sector_breakdown_data:rr.initialData=a.filtered_sector_breakdown_data,a.filtered_sector_breakdown_columns&&(rr.knownColumns=a.filtered_sector_breakdown_columns));let li,ni=!1;const si=ge.createReactive({callback:j=>{i(28,li=j)},execFn:c},{id:"filtered_sector_breakdown",...rr});si(yr,{noResolve:ir,...rr}),globalThis[Symbol.for("filtered_sector_breakdown")]={get value(){return li}};let ar={initialData:void 0,initialError:void 0},lr=O`SELECT symbol, name, price, change_pct, market_cap, pe_forward, dividend_yield, sector, region, country
FROM market.stocks
ORDER BY ${r.search_input.search("symbol")}
LIMIT 20`,hr=`SELECT symbol, name, price, change_pct, market_cap, pe_forward, dividend_yield, sector, region, country
FROM market.stocks
ORDER BY ${r.search_input.search("symbol")}
LIMIT 20`;a.search_results_data&&(a.search_results_data instanceof Error?ar.initialError=a.search_results_data:ar.initialData=a.search_results_data,a.search_results_columns&&(ar.knownColumns=a.search_results_columns));let oi,_i=!1;const fi=ge.createReactive({callback:j=>{i(29,oi=j)},execFn:c},{id:"search_results",...ar});return fi(hr,{noResolve:lr,...ar}),globalThis[Symbol.for("search_results")]={get value(){return oi}},o.$$set=j=>{"data"in j&&i(30,s=j.data)},o.$$.update=()=>{o.$$.dirty[0]&1073741824&&i(31,{data:a={},customFormattingSettings:R,__db:C}=s,a),o.$$.dirty[1]&1&&va.set(Object.keys(a).length>0),o.$$.dirty[4]&536870912&&e.params,o.$$.dirty[1]&60&&(M||!N?M||(f(P,{noResolve:M,...I}),i(36,N=!0)):f(P,{noResolve:M})),o.$$.dirty[1]&960&&(H||!Y?H||(te(z,{noResolve:H,...S}),i(40,Y=!0)):te(z,{noResolve:H})),o.$$.dirty[1]&15360&&(Q||!se?Q||(ne(ae,{noResolve:Q,...re}),i(44,se=!0)):ne(ae,{noResolve:Q})),o.$$.dirty[1]&245760&&(K||!oe?K||(G(ee,{noResolve:K,...x}),i(48,oe=!0)):G(ee,{noResolve:K})),o.$$.dirty[1]&3932160&&(X||!L?X||(Ae(ie,{noResolve:X,..._e}),i(52,L=!0)):Ae(ie,{noResolve:X})),o.$$.dirty[1]&62914560&&(me||!U?me||(Pe(T,{noResolve:me,...fe}),i(56,U=!0)):Pe(T,{noResolve:me})),o.$$.dirty[1]&1006632960&&(ce||!nt?ce||(rt(it,{noResolve:ce,...be}),i(60,nt=!0)):rt(it,{noResolve:ce})),o.$$.dirty[1]&1073741824|o.$$.dirty[2]&7&&($e||!$t?$e||(E(tt,{noResolve:$e,...Ue}),i(64,$t=!0)):E(tt,{noResolve:$e})),o.$$.dirty[2]&120&&(lt||!yt?lt||(dt(gt,{noResolve:lt,...B}),i(68,yt=!0)):dt(gt,{noResolve:lt})),o.$$.dirty[2]&1920&&(ot||!St?ot||(wt(vt,{noResolve:ot,...ct}),i(72,St=!0)):wt(vt,{noResolve:ot})),o.$$.dirty[2]&30720&&(_t||!Ht?_t||(bt(Pt,{noResolve:_t,...kt}),i(76,Ht=!0)):bt(Pt,{noResolve:_t})),o.$$.dirty[2]&491520&&(ke||!Be?ke||(je(De,{noResolve:ke,...we}),i(80,Be=!0)):je(De,{noResolve:ke})),o.$$.dirty[2]&7864320&&(he||!Oe?he||(Ye(He,{noResolve:he,...ye}),i(84,Oe=!0)):Ye(He,{noResolve:he})),o.$$.dirty[2]&125829120&&(Te||!Qe?Te||(Je(Ie,{noResolve:Te,...Re}),i(88,Qe=!0)):Je(Ie,{noResolve:Te})),o.$$.dirty[2]&2013265920&&(Ee||!Ke?Ee||(We(Se,{noResolve:Ee,...qe}),i(92,Ke=!0)):We(Se,{noResolve:Ee})),o.$$.dirty[3]&15&&(Ce||!xe?Ce||(et(Me,{noResolve:Ce,...Fe}),i(96,xe=!0)):et(Me,{noResolve:Ce})),o.$$.dirty[3]&240&&(v||!sr?v||(or(Mt,{noResolve:v,...l}),i(100,sr=!0)):or(Mt,{noResolve:v})),o.$$.dirty[3]&3840&&(Et||!fr?Et||(mr(Lt,{noResolve:Et,...qt}),i(104,fr=!0)):mr(Lt,{noResolve:Et})),o.$$.dirty[3]&61440&&(Ct||!Dr?Ct||(Hr(At,{noResolve:Ct,...Ft}),i(108,Dr=!0)):Hr(At,{noResolve:Ct})),o.$$.dirty[3]&983040&&(Ut||!Sr?Ut||(Mr(ur,{noResolve:Ut,...Nt}),i(112,Sr=!0)):Mr(ur,{noResolve:Ut})),o.$$.dirty[3]&15728640&&(Bt||!Ar?Bt||(Pr(pr,{noResolve:Bt,...Vt}),i(116,Ar=!0)):Pr(pr,{noResolve:Bt})),o.$$.dirty[1]&2&&i(118,zt=O`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
order by market_cap desc`),o.$$.dirty[1]&2&&i(119,cr=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue_growth,
    profit_margin,
    roe,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
order by market_cap desc`),o.$$.dirty[3]&251658240&&(zt||!Ur?zt||(Vr(cr,{noResolve:zt,...jt}),i(120,Ur=!0)):Vr(cr,{noResolve:zt})),o.$$.dirty[1]&2&&i(122,Yt=O`select count(*) as nb
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))`),o.$$.dirty[1]&2&&i(123,$r=`select count(*) as nb
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))`),o.$$.dirty[3]&1879048192|o.$$.dirty[4]&1&&(Yt||!jr?Yt||(zr($r,{noResolve:Yt,...Ot}),i(124,jr=!0)):zr($r,{noResolve:Yt})),o.$$.dirty[1]&2&&i(126,Qt=O`select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0`),o.$$.dirty[1]&2&&i(127,gr=`select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0`),o.$$.dirty[4]&30&&(Qt||!Yr?Qt||(Gr(gr,{noResolve:Qt,...Gt}),i(128,Yr=!0)):Gr(gr,{noResolve:Qt})),o.$$.dirty[1]&2&&i(130,Xt=O`select sum(market_cap) as total_mcap
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))`),o.$$.dirty[1]&2&&i(131,vr=`select sum(market_cap) as total_mcap
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))`),o.$$.dirty[4]&480&&(Xt||!Jr?Xt||(Xr(vr,{noResolve:Xt,...Jt}),i(132,Jr=!0)):Xr(vr,{noResolve:Xt})),o.$$.dirty[1]&2&&i(134,Wt=O`select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and dividend_yield is not null and dividend_yield > 0`),o.$$.dirty[1]&2&&i(135,br=`select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and dividend_yield is not null and dividend_yield > 0`),o.$$.dirty[4]&7680&&(Wt||!Wr?Wt||(Zr(br,{noResolve:Wt,...Kt}),i(136,Wr=!0)):Zr(br,{noResolve:Wt})),o.$$.dirty[1]&2&&i(138,xt=O`select round(avg(change_pct), 2) as avg_change
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and change_pct is not null`),o.$$.dirty[1]&2&&i(139,wr=`select round(avg(change_pct), 2) as avg_change
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and change_pct is not null`),o.$$.dirty[4]&122880&&(xt||!ei?xt||(ti(wr,{noResolve:xt,...Zt}),i(140,ei=!0)):ti(wr,{noResolve:xt})),o.$$.dirty[1]&2&&i(142,tr=O`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider})
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0
  and change_pct is not null`),o.$$.dirty[1]&2&&i(143,kr=`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider})
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
  and pe_forward is not null and pe_forward > 0
  and change_pct is not null`),o.$$.dirty[4]&1966080&&(tr||!ii?tr||(ai(kr,{noResolve:tr,...er}),i(144,ii=!0)):ai(kr,{noResolve:tr})),o.$$.dirty[1]&2&&i(146,ir=O`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
group by sector
order by total_mcap desc`),o.$$.dirty[1]&2&&i(147,yr=`select
    sector,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
where (sector like '${r.sector_dd.value}' or '${r.sector_dd.value}' = '%')
  and (region like '${r.region_bg.value}' or '${r.region_bg.value}' = '%')
  and (pe_forward <= ${r.pe_slider} or pe_forward is null)
  and (market_cap >= ${r.mcap_slider} or market_cap is null)
  and (dividend_yield >= ${r.div_slider} or (${r.div_slider} = 0 and (dividend_yield is null or dividend_yield >= 0)))
group by sector
order by total_mcap desc`),o.$$.dirty[4]&31457280&&(ir||!ni?ir||(si(yr,{noResolve:ir,...rr}),i(148,ni=!0)):si(yr,{noResolve:ir})),o.$$.dirty[1]&2&&i(150,lr=O`SELECT symbol, name, price, change_pct, market_cap, pe_forward, dividend_yield, sector, region, country
FROM market.stocks
ORDER BY ${r.search_input.search("symbol")}
LIMIT 20`),o.$$.dirty[1]&2&&i(151,hr=`SELECT symbol, name, price, change_pct, market_cap, pe_forward, dividend_yield, sector, region, country
FROM market.stocks
ORDER BY ${r.search_input.search("symbol")}
LIMIT 20`),o.$$.dirty[4]&503316480&&(lr||!_i?lr||(fi(hr,{noResolve:lr,...ar}),i(152,_i=!0)):fi(hr,{noResolve:lr}))},i(34,M=O`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
order by market_cap desc`),i(35,P=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    high_52w,
    low_52w,
    pe_trailing,
    pe_forward,
    dividend_yield,
    beta,
    price_to_book,
    revenue,
    revenue_growth,
    earnings_growth,
    gross_margin,
    operating_margin,
    profit_margin,
    roe,
    roa,
    target_price,
    recommendation,
    region,
    sector,
    country
from market.stocks
order by market_cap desc`),i(38,H=O`select count(*) as total from market.stocks`),i(39,z="select count(*) as total from market.stocks"),i(42,Q=O`select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where pe_forward is not null and pe_forward > 0`),i(43,ae=`select round(avg(pe_forward), 1) as avg_pe
from market.stocks
where pe_forward is not null and pe_forward > 0`),i(46,K=O`select sum(market_cap) as total_mcap from market.stocks`),i(47,ee="select sum(market_cap) as total_mcap from market.stocks"),i(50,X=O`select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where dividend_yield is not null and dividend_yield > 0`),i(51,ie=`select round(avg(dividend_yield), 2) as avg_div
from market.stocks
where dividend_yield is not null and dividend_yield > 0`),i(54,me=O`select round(avg(beta), 2) as avg_beta
from market.stocks
where beta is not null`),i(55,T=`select round(avg(beta), 2) as avg_beta
from market.stocks
where beta is not null`),i(58,ce=O`select round(median(pe_forward), 1) as median_pe
from market.stocks
where pe_forward is not null and pe_forward > 0`),i(59,it=`select round(median(pe_forward), 1) as median_pe
from market.stocks
where pe_forward is not null and pe_forward > 0`),i(62,$e=O`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and change_pct is not null`),i(63,tt=`select
    symbol,
    name,
    pe_forward,
    change_pct,
    market_cap,
    region,
    sector
from market.stocks
where pe_forward is not null
  and pe_forward > 0
  and pe_forward < 200
  and change_pct is not null`),i(66,lt=O`select
    case
        when pe_forward < 10 then '0-10'
        when pe_forward < 20 then '10-20'
        when pe_forward < 30 then '20-30'
        when pe_forward < 40 then '30-40'
        when pe_forward < 50 then '40-50'
        when pe_forward < 75 then '50-75'
        when pe_forward < 100 then '75-100'
        else '100+'
    end as pe_range,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null and pe_forward > 0
group by 1
order by
    case
        when pe_forward < 10 then 1
        when pe_forward < 20 then 2
        when pe_forward < 30 then 3
        when pe_forward < 40 then 4
        when pe_forward < 50 then 5
        when pe_forward < 75 then 6
        when pe_forward < 100 then 7
        else 8
    end`),i(67,gt=`select
    case
        when pe_forward < 10 then '0-10'
        when pe_forward < 20 then '10-20'
        when pe_forward < 30 then '20-30'
        when pe_forward < 40 then '30-40'
        when pe_forward < 50 then '40-50'
        when pe_forward < 75 then '50-75'
        when pe_forward < 100 then '75-100'
        else '100+'
    end as pe_range,
    count(*) as nb_stocks
from market.stocks
where pe_forward is not null and pe_forward > 0
group by 1
order by
    case
        when pe_forward < 10 then 1
        when pe_forward < 20 then 2
        when pe_forward < 30 then 3
        when pe_forward < 40 then 4
        when pe_forward < 50 then 5
        when pe_forward < 75 then 6
        when pe_forward < 100 then 7
        else 8
    end`),i(70,ot=O`select
    symbol,
    name,
    market_cap,
    region,
    sector
from market.stocks
order by market_cap desc
limit 20`),i(71,vt=`select
    symbol,
    name,
    market_cap,
    region,
    sector
from market.stocks
order by market_cap desc
limit 20`),i(74,_t=O`select
    symbol,
    name,
    volume,
    price,
    change_pct,
    market_cap,
    sector
from market.stocks
where volume is not null and volume > 0
order by volume desc
limit 20`),i(75,Pt=`select
    symbol,
    name,
    volume,
    price,
    change_pct,
    market_cap,
    sector
from market.stocks
where volume is not null and volume > 0
order by volume desc
limit 20`),i(78,ke=O`select
    recommendation,
    count(*) as nb_stocks
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by nb_stocks desc`),i(79,De=`select
    recommendation,
    count(*) as nb_stocks
from market.stocks
where recommendation is not null and recommendation != ''
group by recommendation
order by nb_stocks desc`),i(82,he=O`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct desc
limit 10`),i(83,He=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct desc
limit 10`),i(86,Te=O`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct asc
limit 10`),i(87,Ie=`select
    symbol,
    name,
    price,
    change_pct,
    volume,
    market_cap,
    sector,
    region
from market.stocks
where change_pct is not null
order by change_pct asc
limit 10`),i(90,Ee=O`select
    sector,
    sum(market_cap) as total_mcap,
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
group by sector
order by total_mcap desc`),i(91,Se=`select
    sector,
    sum(market_cap) as total_mcap,
    count(*) as nb_stocks,
    round(avg(pe_forward), 1) as avg_pe
from market.stocks
group by sector
order by total_mcap desc`),i(94,Ce=O`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
group by region
order by total_mcap desc`),i(95,Me=`select
    region,
    count(*) as nb_stocks,
    sum(market_cap) as total_mcap,
    round(avg(pe_forward), 1) as avg_pe,
    round(avg(dividend_yield), 2) as avg_div
from market.stocks
group by region
order by total_mcap desc`),i(98,v=O`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 15`),i(99,Mt=`select
    symbol,
    name,
    dividend_yield,
    price,
    pe_forward,
    market_cap,
    sector,
    region
from market.stocks
where dividend_yield is not null and dividend_yield > 0
order by dividend_yield desc
limit 15`),i(102,Et=O`select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null and pe_forward > 0 and pe_forward < 200
  and revenue_growth is not null`),i(103,Lt=`select
    symbol,
    name,
    pe_forward,
    revenue_growth,
    market_cap,
    sector,
    region
from market.stocks
where pe_forward is not null and pe_forward > 0 and pe_forward < 200
  and revenue_growth is not null`),i(106,Ct=O`select
    case
        when beta < 0.5 then '< 0.5 (Defensif)'
        when beta < 0.8 then '0.5-0.8 (Faible)'
        when beta < 1.0 then '0.8-1.0 (Modere)'
        when beta < 1.2 then '1.0-1.2 (Marche)'
        when beta < 1.5 then '1.2-1.5 (Eleve)'
        else '> 1.5 (Agressif)'
    end as beta_range,
    count(*) as nb_stocks
from market.stocks
where beta is not null
group by 1
order by
    case
        when beta < 0.5 then 1
        when beta < 0.8 then 2
        when beta < 1.0 then 3
        when beta < 1.2 then 4
        when beta < 1.5 then 5
        else 6
    end`),i(107,At=`select
    case
        when beta < 0.5 then '< 0.5 (Defensif)'
        when beta < 0.8 then '0.5-0.8 (Faible)'
        when beta < 1.0 then '0.8-1.0 (Modere)'
        when beta < 1.2 then '1.0-1.2 (Marche)'
        when beta < 1.5 then '1.2-1.5 (Eleve)'
        else '> 1.5 (Agressif)'
    end as beta_range,
    count(*) as nb_stocks
from market.stocks
where beta is not null
group by 1
order by
    case
        when beta < 0.5 then 1
        when beta < 0.8 then 2
        when beta < 1.0 then 3
        when beta < 1.2 then 4
        when beta < 1.5 then 5
        else 6
    end`),i(110,Ut=O`select
    symbol,
    name,
    price,
    target_price,
    round((target_price - price) / price * 100, 1) as upside_pct,
    recommendation,
    pe_forward,
    sector,
    region
from market.stocks
where target_price is not null and price is not null and price > 0
order by upside_pct desc
limit 20`),i(111,ur=`select
    symbol,
    name,
    price,
    target_price,
    round((target_price - price) / price * 100, 1) as upside_pct,
    recommendation,
    pe_forward,
    sector,
    region
from market.stocks
where target_price is not null and price is not null and price > 0
order by upside_pct desc
limit 20`),i(114,Bt=O`select distinct sector as value, sector as label
from market.stocks
order by sector`),i(115,pr=`select distinct sector as value, sector as label
from market.stocks
order by sector`),[q,D,J,le,_,b,Ne,at,pt,ut,qr,Ve,ze,Ge,Xe,Ze,nr,_r,Cr,Ir,Lr,Nr,Br,Or,Qr,Kr,xr,ri,li,oi,s,a,r,I,M,P,N,S,H,z,Y,re,Q,ae,se,x,K,ee,oe,_e,X,ie,L,fe,me,T,U,be,ce,it,nt,Ue,$e,tt,$t,B,lt,gt,yt,ct,ot,vt,St,kt,_t,Pt,Ht,we,ke,De,Be,ye,he,He,Oe,Re,Te,Ie,Qe,qe,Ee,Se,Ke,Fe,Ce,Me,xe,l,v,Mt,sr,qt,Et,Lt,fr,Ft,Ct,At,Dr,Nt,Ut,ur,Sr,Vt,Bt,pr,Ar,jt,zt,cr,Ur,Ot,Yt,$r,jr,Gt,Qt,gr,Yr,Jt,Xt,vr,Jr,Kt,Wt,br,Wr,Zt,xt,wr,ei,er,tr,kr,ii,rr,ir,yr,ni,ar,lr,hr,_i,e]}class Tl extends ta{constructor(t){super(),ra(this,t,ml,fl,xi,{data:30},null,[-1,-1,-1,-1,-1,-1,-1])}}export{Tl as component};
