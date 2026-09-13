'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { latestPublishedScan } = require('./published-scan');
const { newYorkDateISO, nextUSTradingDay, previousUSTradingDay } = require('./market-calendar');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Editorial preview only. Never fed to mode selection, orders, positions or tracking.
function loadNextSession(root, now = new Date()) {
  const cards = JSON.parse(fs.readFileSync(path.join(root, 'data/scanner.json'), 'utf8'));
  const date = latestPublishedScan(cards);
  const today = newYorkDateISO(now);
  if (date <= today.replaceAll('-', '')) return null;
  const session = nextUSTradingDay(today);
  if (date !== session.replaceAll('-', '')) throw new Error('scanner preview: published date is not the next US session');
  const dir = `scanner/${date}`;
  if (fs.existsSync(path.join(root, dir, 'review.json'))) return null;
  const source = `${dir}/signals.json`;
  const bytes = fs.readFileSync(path.join(root, source));
  const data = JSON.parse(bytes);
  if (data.scanDate !== date || data.referenceClose !== previousUSTradingDay(session)) throw new Error('scanner preview: reference close mismatch');
  const html = fs.readFileSync(path.join(root, dir, 'index.html'));
  const provenance = [{ path: source, sha256: sha(bytes) }, { path: `${dir}/index.html`, sha256: sha(html) }];
  // All three published reviews must bind the displayed article and structured signals.
  for (const role of ['senior', 'contrarian', 'retail']) {
    const reviewPath = `${dir}/reviews/${role}.md`;
    const review = fs.readFileSync(path.join(root, reviewPath), 'utf8');
    provenance.push({ path: reviewPath, sha256: sha(review) });
    if (!review.includes(sha(html)) || !review.includes(sha(bytes))) throw new Error(`scanner preview: unbound ${role} review`);
  }
  function verifyEvidence(v) {
    if (!v || typeof v !== 'object') return;
    if (v.source_artifact || v.source_report) {
      if (!/^[a-f0-9]{64}$/.test(v.source_sha256 || '')) throw new Error('scanner preview: incomplete evidence pair');
      // Old source_report references may name a private working copy. Only its
      // byte-identical published archive is usable by a clean deployment.
      const rel = v.source_artifact || (v.source_report.startsWith('.agent/')
        ? `${dir}/primaries/source-reports/${v.source_sha256}.json` : v.source_report);
      const p = fs.realpathSync(path.resolve(root, rel));
      if (!p.startsWith(fs.realpathSync(root) + path.sep) || sha(fs.readFileSync(p)) !== v.source_sha256) throw new Error('scanner preview: source evidence mismatch');
      if (!provenance.some(x => x.path === rel)) provenance.push({ path: rel, sha256: v.source_sha256 });
    }
    Object.values(v).forEach(verifyEvidence);
  }
  verifyEvidence(data.signals);
  if (!Array.isArray(data.signals) || data.signals.length < 8 || data.signals.length > 10 || new Set(data.signals.map(s => s.ticker)).size !== data.signals.length) throw new Error('scanner preview: missing candidates');
  const candidates = data.signals.map(s => {
    if (!/^[A-Z0-9.^-]+$/.test(s.ticker) || ![s.entry, s.stop, s.tp1, s.tp2].every(n => Number.isFinite(n) && n > 0)) throw new Error('scanner preview: invalid candidate');
    return { ticker: s.ticker, name: s.name, strategy: s.strategy, entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2, horizon: s.horizon };
  });
  return { state: 'preview_non_executable', scan_date: date, session_date: session, reference_close: data.referenceClose,
    new_entries_allowed: false, article_url: `/${dir}/`, source: { path: source, sha256: sha(bytes) }, provenance, candidates };
}
function renderNextSession(p) {
  if (!p) return '';
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(p.session_date + 'T12:00:00Z'));
  const price = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0$';
  const strategies = { Breakout: 'Cassure', Pullback: 'Repli', Momentum: 'Continuation' };
  return `<section id="next-session-preparation" class="section-card" data-state="preview_non_executable" style="font-size:1rem;line-height:1.55">
  <style>#next-session-preparation p,#next-session-preparation a{font-size:16px!important;line-height:1.55!important}#next-session-preparation h3{font-size:18px!important}#next-session-preparation article{margin:0!important}</style>
  <h2 style="font-size:1.3rem;margin:0 0 .6rem">Préparation pour ${esc(date)}</h2>
  <p style="margin:0 0 .7rem">${p.candidates.length} valeurs issues du dernier scanner publié, sur la clôture du ${esc(p.reference_close)}. Le suivi ci-dessous conserve les positions et résultats des séances passées.</p>
  <p style="margin:0 0 1rem"><strong>Aucun ordre exécutable actuellement.</strong> Ces repères restent à revalider à l’ouverture : configuration, gap, liquidité et risque. La sélection éditoriale ne constitue pas une allocation par mode.</p>
  <div class="next-session-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:.8rem">
  ${p.candidates.map(s => `<article style="border:1px solid var(--border);border-radius:10px;padding:1rem;min-width:0"><h3 style="font-size:1.1rem;margin:0 0 .3rem">${esc(s.ticker)} <span style="font-size:.95rem;font-weight:400">· ${esc(strategies[s.strategy] || s.strategy)}</span></h3><p style="margin:0 0 .6rem">${esc(s.name)}</p><p style="margin:0">Limite préparée : <strong>${price(s.entry)}</strong><br>Stop : ${price(s.stop)}<br>Objectifs : ${price(s.tp1)} / ${price(s.tp2)}</p></article>`).join('')}
  </div><p style="margin:1rem 0 0"><a href="${p.article_url}">Lire les thèses, les risques et les conditions d’entrée du scanner →</a></p></section>`;
}
module.exports = { loadNextSession, renderNextSession };
