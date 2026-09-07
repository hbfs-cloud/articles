#!/usr/bin/env node
'use strict';
// Dated editorial payload + immutable calculation sources -> HTML and bound claims.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {renderValue}=require('./validate-content-claims');
const ROOT=path.resolve(__dirname,'..');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const input=process.argv[2];if(!input){console.error('Usage: node tools/render-eur-opportunities.js <edition.json>');process.exit(2);}
const e=JSON.parse(fs.readFileSync(input,'utf8'));const claims=[];const sources={};
for(const [key,p]of Object.entries(e.sources)){const bytes=fs.readFileSync(path.join(ROOT,p));sources[key]={path:p,hash:sha(bytes),value:JSON.parse(bytes)};}
const formats={eur:{format:'fr',scale:1,decimals:2,suffix:' €'},pct:{format:'fr',scale:100,decimals:2,suffix:' %',sign:'always'},freq:{format:'fr',scale:100,decimals:1,suffix:' %'},int:{format:'fr',scale:1,decimals:0},decimal:{format:'fr',scale:1,decimals:2},date:{format:'fr_date',parts:'weekday_day_month'},tax:{format:'fr',scale:100,decimals:2,suffix:' %'}};
function bind(html){return html.replace(/\[\[claim:([a-z_]+):(\/[^\]\s]*):([a-z]+)\]\]/g,(_,key,pointer,fmt)=>{const source=sources[key];if(!source||!formats[fmt])throw Error('Unknown source or format');const value=pointer.split('/').slice(1).reduce((x,k)=>{if(!x||!Object.hasOwn(x,k))throw Error('Missing pointer '+pointer);return x[k];},source.value);const render=formats[fmt];const text=renderValue(value,render);if(text===null)throw Error('Invalid numeric/date value '+pointer);const id='eur_'+String(claims.length+1).padStart(4,'0');claims.push({id,source_artifact:source.path,source_sha256:source.hash,source_pointer:pointer,source_value:value,render,rendered_text:text});return `<span data-claim="${id}">${escape(text)}</span>`;});}
const main=e.sections.map(s=>`<section id="${escape(s.id)}" class="section"><div class="section-heading"><h2>${escape(s.title)}</h2>${s.badge?`<span class="status neutral">${escape(s.badge)}</span>`:''}</div>${bind(s.html)}</section>`).join('\n');
if(/\[\[claim:/.test(main))throw Error('Unexpanded claim');
const measured=sources.study.value;
const chart=measured.ranking.slice(0,6).map(symbol=>{const row=measured.results.find(r=>r.yahoo_symbol===symbol);if(!row||!row.eligible)throw Error('Chart rank absent from eligible study');return {name:symbol.split('.')[0],gain:row.conditional.p_times_gain*100,loss:row.conditional.loss_contribution*100,net:row.conditional.mean_net*100};});
const vars={TITLE:escape(e.title),DESCRIPTION:escape(e.description),CANONICAL:escape(e.canonical),META:escape(e.meta),HEADLINE:escape(e.headline),SUBTITLE:escape(e.subtitle),YEAR:escape(e.reference_close.slice(0,4)),BADGES:e.badges.map(x=>`<span class="hero-badge">${escape(x)}</span>`).join(''),MAIN:main,FAB:e.navigation.map(x=>`<a href="#${escape(x.id)}" class="fnav-item" data-section="${escape(x.id)}"><i class="fas ${escape(x.icon)}" aria-hidden="true"></i><span>${escape(x.label)}</span></a>`).join(''),CHART_DATA:JSON.stringify(chart).replace(/</g,'\\u003c')};
if(e.navigation.length!==6)throw Error('Exactly six navigation entries required');
let html=fs.readFileSync(path.join(__dirname,'templates/eur-opportunities.html'),'utf8').replace(/\{\{([A-Z_]+)\}\}/g,(_,k)=>{if(!(k in vars))throw Error('Missing template value '+k);return vars[k];});
const article=path.join(ROOT,e.article_path);fs.writeFileSync(article,html);fs.mkdirSync(path.join(path.dirname(article),'_data'),{recursive:true});
fs.writeFileSync(path.join(path.dirname(article),'_data/claims.json'),JSON.stringify({schema_version:1,reference_close:e.reference_close,article_path:e.article_path,article_sha256:sha(html),literals:[],claims},null,2)+'\n');
console.log(`Rendered ${e.article_path}: ${Buffer.byteLength(html)} bytes, ${claims.length} bound claims`);
