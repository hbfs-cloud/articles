'use strict';
// Assemble l'attestation AQ-1.1 d'une fiche à partir des trois revues indépendantes (review-<role>.json),
// après contrôle que chaque revue vise exactement le JSON et le sidecar courants.
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const ROOT = '/Users/marketwatchxyz/GolandProjects/articles';
const T = process.argv[2], RUN = process.argv[3] || '20261009';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
const analysisPath = `data/analyses-data/${T}.json`, evidencePath = `data/analyses-evidence/${T}.json`;
const aSha = sha(analysisPath), eSha = sha(evidencePath);
const rev = `analyses/${T}/_runs/${RUN}/revision`;
const reviews = ['senior_qa', 'contrarian', 'retail_war_room'].map(role => {
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, rev, `review-${role}.json`), 'utf8'));
  if (r.analysisSha256 !== aSha || r.evidenceSha256 !== eSha) throw Error(`${role}: revue sur un hash périmé`);
  if (r.status !== 'PASS' || r.score < 80 || r.score > 100) throw Error(`${role}: statut ${r.status} score ${r.score}`);
  if (r.checks.length !== 38 || r.checks.some(c => c.status === 'BLOCK')) throw Error(`${role}: checks invalides`);
  const st = fs.statSync(path.join(ROOT, rev, `review-${role}.json`));
  return { schemaVersion: 'AQ-1.1-attestation', ticker: T, analysisPath, analysisSha256: aSha, evidencePath, evidenceSha256: eSha,
    reviewerId: r.reviewerId, reviewerName: r.reviewerName, roles: [role], reviewedAt: st.mtime.toISOString(), status: 'PASS', score: r.score,
    checks: r.checks.map(c => ({ id: c.id, status: c.status, rationale: c.rationale, evidenceRefs: c.evidenceRefs })) };
});
const out = path.join(ROOT, rev, 'aq11-attestation.json');
fs.writeFileSync(out, JSON.stringify({ schemaVersion: 'AQ-1.1-attestation', reviews }, null, 2) + '\n');
console.log(`${T}: attestation écrite (${reviews.map(r => r.roles[0] + ' ' + r.score).join(', ')}) analysis=${aSha.slice(0, 12)} evidence=${eSha.slice(0, 12)}`);
