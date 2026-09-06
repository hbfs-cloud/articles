'use strict';
// File d'attente des épisodes, par date de programmation croissante.
// Les reçus portent le draft_id, les manifestes portent le fichier source : ni l'un ni l'autre
// ne suffit seul, et c'est le couple qui permet de pousser le bon texte au bon brouillon.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

function queue() {
  const bySchedule = new Map();
  for (const p of ['retail-systematic-desk', 'retail-market-operating-system']) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, `data/substack/programs/${p}/remote-receipts.json`), 'utf8'));
    for (const e of (d.episodes || [])) bySchedule.set(`${e.module_id || 'retail-systematic-desk'}|${e.module_episode || e.week}`, e);
  }
  const rows = [];
  const dir = path.join(ROOT, 'data/substack/series');
  for (const s of fs.readdirSync(dir)) {
    const mf = path.join(dir, s, 'manifest.json');
    if (!fs.existsSync(mf)) continue;
    for (const e of (JSON.parse(fs.readFileSync(mf, 'utf8')).episodes || [])) {
      const r = bySchedule.get(`${s}|${e.number}`);
      rows.push({ series: s, number: e.number, file: e.file, title: e.title,
        scheduled_at: e.scheduled_at, draft_id: r ? String(r.draft_id) : null });
    }
  }
  rows.sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  return rows;
}
module.exports = { queue };
