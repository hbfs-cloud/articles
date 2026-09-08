'use strict';

// Applies to a documentary review only. It does not change the historical records
// or the DTX panels. Keep these exact hooks shared with the status generator.
const hooks = [
  ["    var rows=document.querySelectorAll('tr[data-sig-ticker]');", "    var rows=Array.from(document.querySelectorAll('tr[data-sig-ticker]')).filter(function(row){var panel=row.closest('.mode-panel');return !panel || panel.dataset.publicationReview!=='1';}); // scanner-review:signal-guard"],
  ["    if(!panel)return;\n    // Casablanca (BVC) panel:", "    if(!panel)return;\n    if(panel.dataset.publicationReview==='1')return; // scanner-review:mtm-guard\n    // Casablanca (BVC) panel:"],
  ["      document.querySelectorAll(modeId ? '#p-'+modeId : '.mode-panel').forEach(function(p){", "      document.querySelectorAll(modeId ? '#p-'+modeId : '.mode-panel').forEach(function(p){\n        if(p.dataset.publicationReview==='1')return; // scanner-review:actions-guard"],
];

function guardStatusHtml(html) {
  const live = html.includes('// ── Signal Live Tracker v2') || html.includes('// ── Position Live MtM');
  if (!live) return html; // Static historical pages have no live runtime to guard.
  for (const [old, guarded] of hooks) {
    if (html.includes(guarded)) continue;
    if (!html.includes(old) || html.indexOf(old) !== html.lastIndexOf(old)) throw new Error('scanner review: missing/ambiguous live status guard hook');
    html = html.replace(old, guarded);
  }
  return html;
}

function freezeStatusHtml(html) {
  html = guardStatusHtml(html);
  // The overlay preserves the old document build date. Fetch the review-aware
  // runtime and banner styles even when that historical build is already cached.
  html = html.replace(/(\/(?:assets\/live-engine-ui\.js|assets\/report\.css|report\.css))(?:\?[^"'\s<>]*)?/g, '$1?v=scanner-review-v1');
  return html.replace(/<div\b[^>]*\bclass="[^"]*\bmode-panel\b[^"]*"[^>]*>/g, tag => {
    if (/\bdata-asset-class="dtx"/.test(tag)) return tag;
    if (/\bdata-publication-review="1"/.test(tag)) return tag;
    return tag.replace(/>$/, ' data-publication-review="1">');
  });
}

module.exports = { guardStatusHtml, freezeStatusHtml };
