'use strict';

const fs = require('fs');
const path = require('path');

function pointerGet(document, pointer) {
  if (pointer === '') return document;
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return undefined;
  return pointer.slice(1).split('/').reduce((node, raw) => {
    if (node == null) return undefined;
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    return node[key];
  }, document);
}

function loadEvidence(payload, root, id, errors) {
  const rel = payload.evidence && payload.evidence[id] && payload.evidence[id].path;
  if (!rel || path.isAbsolute(rel)) return null;
  const abs = path.resolve(root, rel);
  if (path.relative(root, abs).startsWith('..') || !fs.existsSync(abs)) return null;
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); }
  catch { errors.push(`evidence.${id} is not valid JSON`); return null; }
}

function sameNumber(left, right) {
  return typeof left === 'number' && Number.isFinite(left)
    && typeof right === 'number' && Number.isFinite(right)
    && Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 1e-9);
}

function validateObservationPointers(payload, root) {
  const errors = [];
  const documents = new Map();
  const items = [...(payload.ideas || []), ...(payload.candidates || [])];
  for (const item of items) {
    const ticker = item.ticker || item.symbol || '?';
    for (const [field, proof] of Object.entries(item.market_observations || {})) {
      if (!proof || typeof proof.source_pointer !== 'string') {
        errors.push(`${ticker}: market_observations.${field}.source_pointer is required`);
        continue;
      }
      if (!documents.has(proof.source_id)) documents.set(proof.source_id, loadEvidence(payload, root, proof.source_id, errors));
      const observed = pointerGet(documents.get(proof.source_id), proof.source_pointer);
      if (!(sameNumber(observed, proof.value) || observed === proof.value)) {
        errors.push(`${ticker}: market_observations.${field} does not equal ${proof.source_id}${proof.source_pointer}`);
      }
    }
  }
  return errors;
}

function validateAplusPointers(payload, root) {
  const errors = validateObservationPointers(payload, root);
  const documents = new Map();
  const document = id => {
    if (!documents.has(id)) documents.set(id, loadEvidence(payload, root, id, errors));
    return documents.get(id);
  };
  for (const candidate of payload.candidates || []) {
    const ticker = String(candidate.ticker || '').toUpperCase();
    const guidance = candidate.guidance_proof || {};
    const guidanceRow = pointerGet(document('guidance'), guidance.source_pointer);
    const guidanceTicker = String(guidanceRow && (guidanceRow.ticker || guidanceRow.symbol) || '').toUpperCase();
    const guidanceDate = String(guidanceRow && (guidanceRow.date || guidanceRow.filing_date || guidanceRow.reported_date) || '').slice(0, 10);
    const guidanceRaised = guidanceRow && (guidanceRow.guidance_raised === true
      || ['raised', 'increased', 'upward'].includes(String(guidanceRow.action || guidanceRow.direction || '').toLowerCase()));
    if (!guidanceRow || guidanceTicker !== ticker || guidanceDate !== guidance.date || !guidanceRaised) {
      errors.push(`${ticker}: guidance_proof does not resolve to the dated raised-guidance source row`);
    }
    for (const observation of candidate.eps_beat_proof || []) {
      const row = pointerGet(document('eps_history'), observation && observation.source_pointer);
      const rowTicker = String(row && (row.ticker || row.symbol) || '').toUpperCase();
      const rowDate = String(row && (row.date || row.reported_date || row.quarter_date) || '').slice(0, 10);
      if (!row || rowTicker !== ticker || rowDate !== observation.date
        || !sameNumber(row.actual, observation.actual) || !sameNumber(row.estimate, observation.estimate)) {
        errors.push(`${ticker}: EPS proof ${observation && observation.date} does not resolve to its source row`);
      }
    }
    for (const filing of candidate.sec_review && candidate.sec_review.filings || []) {
      const row = pointerGet(document('sec'), filing && filing.source_pointer);
      const rowTicker = String(row && (row.ticker || row.symbol) || '').toUpperCase();
      if (!row || rowTicker !== ticker || String(row.accession || row.accession_number || '') !== filing.accession) {
        errors.push(`${ticker}: SEC filing ${filing && filing.accession} does not resolve to this issuer's source row`);
      }
    }
  }
  return [...new Set(errors)];
}

module.exports = { pointerGet, validateAplusPointers, validateObservationPointers };
