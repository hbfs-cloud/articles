'use strict';

function finitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function checkLevels(idea, prefix = idea.ticker || idea.symbol || '?', options = {}) {
  const minRr = options.minRr ?? 1.5;
  const minStopAtr = options.minStopAtr ?? 1.5;
  const maxTargetAtr = options.maxTargetAtr ?? 3.0;
  const errors = [];
  for (const field of ['spot', 'entry', 'stop', 'tp1', 'atr14', 'rr']) {
    if (!finitePositive(idea[field])) errors.push(`${prefix}: ${field} must be a positive finite number`);
  }
  if (errors.length) return errors;
  const side = String(idea.side || 'long').toLowerCase();
  if (!['long', 'short'].includes(side)) return [`${prefix}: side must be long or short`];
  const spot = Number(idea.spot);
  const entry = Number(idea.entry);
  const stop = Number(idea.stop);
  const tp1 = Number(idea.tp1);
  const atr = Number(idea.atr14);
  const risk = side === 'long' ? entry - stop : stop - entry;
  const reward = side === 'long' ? tp1 - entry : entry - tp1;
  if (!(risk > 0)) errors.push(`${prefix}: stop is on the wrong side of entry`);
  if (!(reward > 0)) errors.push(`${prefix}: TP1 is on the wrong side of entry`);
  if (risk > 0 && reward > 0) {
    const rr = reward / risk;
    if (rr < minRr - 1e-9) errors.push(`${prefix}: recomputed R/R ${rr.toFixed(3)} is below ${minRr}`);
    if (Math.abs(rr - Number(idea.rr)) > 0.02) errors.push(`${prefix}: published R/R ${idea.rr} differs from recomputed ${rr.toFixed(3)}`);
    const stopAtr = risk / atr;
    if (stopAtr < minStopAtr - 1e-9) errors.push(`${prefix}: stop distance ${stopAtr.toFixed(3)} ATR is below ${minStopAtr}`);
    const targetAtr = reward / atr;
    if (targetAtr > maxTargetAtr + 1e-9) errors.push(`${prefix}: TP1 distance ${targetAtr.toFixed(3)} ATR exceeds the ${maxTargetAtr.toFixed(1)} ATR reachability cap`);
  }
  const entryDistance = Math.abs(entry - spot) / spot;
  if (entryDistance > 0.03 + 1e-9) errors.push(`${prefix}: entry is ${(entryDistance * 100).toFixed(2)}% from spot (max 3%)`);
  return errors;
}

function checkEvidence(idea, referenceClose, { minEarningsSessions = 4 } = {}) {
  const ticker = idea.ticker || idea.symbol || '?';
  const errors = [];
  if (idea.data_date !== referenceClose) errors.push(`${ticker}: data_date must equal reference_close ${referenceClose}`);
  if (!Number.isInteger(idea.earnings_sessions) || idea.earnings_sessions < minEarningsSessions) {
    errors.push(`${ticker}: earnings_sessions must be an integer >= ${minEarningsSessions}`);
  }
  if (!['clear', 'not_applicable'].includes(idea.sec_status)) errors.push(`${ticker}: sec_status must be clear or not_applicable`);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(idea.sec_checked_at || ''))) errors.push(`${ticker}: sec_checked_at is missing or invalid`);
  else {
    const today = new Date().toISOString().slice(0, 10);
    if (idea.sec_checked_at < referenceClose || idea.sec_checked_at > today) errors.push(`${ticker}: sec_checked_at must be between reference_close and today`);
  }
  const sources = new Set(idea.source_ids || []);
  for (const source of ['bars', 'technicals', 'calendar', 'sec']) {
    if (!sources.has(source)) errors.push(`${ticker}: source_ids is missing ${source}`);
  }
  const observations = idea.market_observations;
  if (!observations || typeof observations !== 'object' || Array.isArray(observations)) {
    errors.push(`${ticker}: market_observations is required`);
  } else {
    for (const [field, sourceId] of [['spot', 'bars'], ['atr14', 'technicals']]) {
      const proof = observations[field];
      if (!proof || proof.value !== idea[field] || proof.as_of !== referenceClose || proof.source_id !== sourceId) {
        errors.push(`${ticker}: market_observations.${field} must bind the exact value/date to ${sourceId}`);
      }
      if (!proof || typeof proof.source_pointer !== 'string' || !proof.source_pointer.startsWith('/')) {
        errors.push(`${ticker}: market_observations.${field}.source_pointer is required`);
      }
    }
  }
  return errors;
}

function validateTradeIdeas(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return ['payload must be an object'];
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(payload.reference_close || ''))) errors.push('reference_close is missing or invalid');
  if (!['ready', 'no_setup'].includes(payload.status)) errors.push('status must be ready or no_setup');
  if (!Array.isArray(payload.ideas)) errors.push('ideas[] is required');
  if (errors.length) return errors;
  if (payload.status === 'no_setup' && payload.ideas.length !== 0) errors.push('no_setup must have zero ideas');
  if (payload.status === 'ready' && (payload.ideas.length < 1 || payload.ideas.length > 5)) errors.push('ready must contain 1 to 5 ideas');

  const seen = new Set();
  const families = new Map();
  for (const idea of payload.ideas) {
    const ticker = String(idea.ticker || '').toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) errors.push(`${ticker || '?'}: invalid ticker`);
    if (seen.has(ticker)) errors.push(`${ticker}: duplicate ticker`);
    seen.add(ticker);
    if (!idea.family || typeof idea.family !== 'string') errors.push(`${ticker}: family is required`);
    else families.set(idea.family, (families.get(idea.family) || 0) + 1);
    errors.push(...checkLevels(idea, ticker));
    errors.push(...checkEvidence(idea, payload.reference_close, { minEarningsSessions: 4 }));
    if (!(idea.source_ids || []).includes('flows')) errors.push(`${ticker}: source_ids is missing flows`);
  }
  if (payload.ideas.length >= 3) {
    const maxFamily = Math.max(...families.values(), 0);
    if (maxFamily / payload.ideas.length > 0.60 + 1e-9) errors.push('one family exceeds 60% of the basket');
  }
  if (payload.ideas.length >= 2) {
    if (typeof payload.max_pairwise_correlation !== 'number' || !Number.isFinite(payload.max_pairwise_correlation)) errors.push('max_pairwise_correlation is required for a multi-name basket');
    else if (payload.max_pairwise_correlation > 0.70) errors.push('max pairwise correlation exceeds 0.70');
  }
  return [...new Set(errors)];
}

function validateAplus(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return ['payload must be an object'];
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(payload.reference_close || ''))) errors.push('reference_close is missing or invalid');
  if (!['ready', 'no_setup'].includes(payload.status)) errors.push('status must be ready or no_setup');
  if (!Array.isArray(payload.candidates)) errors.push('candidates[] is required');
  if (errors.length) return errors;
  if (payload.status === 'no_setup' && payload.candidates.length !== 0) errors.push('no_setup must have zero candidates');
  if (payload.status === 'ready' && (payload.candidates.length < 1 || payload.candidates.length > 10)) errors.push('ready must contain 1 to 10 candidates');
  const seen = new Set();
  for (const candidate of payload.candidates) {
    const ticker = String(candidate.ticker || '').toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) errors.push(`${ticker || '?'}: invalid ticker`);
    if (seen.has(ticker)) errors.push(`${ticker}: duplicate candidate`);
    seen.add(ticker);
    errors.push(...checkLevels(candidate, ticker, { minRr: 1.5, minStopAtr: 1.5, maxTargetAtr: 4.0 }));
    errors.push(...checkEvidence(candidate, payload.reference_close, { minEarningsSessions: 10 }));
    if (candidate.guidance_raised !== true) errors.push(`${ticker}: guidance_raised must be true`);
    if (!String(candidate.guidance_source || '').trim() || !(candidate.source_ids || []).includes('guidance')) errors.push(`${ticker}: raised guidance needs a primary guidance source`);
    if (!(candidate.source_ids || []).includes('corporate_actions')) errors.push(`${ticker}: source_ids is missing corporate_actions`);
    if (!Number.isInteger(candidate.eps_beats_consecutive) || candidate.eps_beats_consecutive < 5) errors.push(`${ticker}: fewer than five consecutive EPS beats`);
    if (!String(candidate.eps_beats_source || '').trim() || !(candidate.source_ids || []).includes('eps_history')) errors.push(`${ticker}: five-beat history needs a bound primary source`);
    const guidanceProof = candidate.guidance_proof;
    if (!guidanceProof || guidanceProof.ticker !== ticker || guidanceProof.action !== 'raised'
      || guidanceProof.primary !== true || guidanceProof.source_id !== 'guidance'
      || !/^20\d{2}-\d{2}-\d{2}$/.test(String(guidanceProof.date || ''))
      || guidanceProof.date > payload.reference_close) {
      errors.push(`${ticker}: guidance_proof must be a dated primary raised-guidance observation`);
    }
    const beatProof = candidate.eps_beat_proof;
    if (!Array.isArray(beatProof) || beatProof.length < 5) {
      errors.push(`${ticker}: eps_beat_proof needs at least five quarterly observations`);
    } else {
      const dates = new Set();
      for (const observation of beatProof) {
        const valid = observation && observation.ticker === ticker && observation.source_id === 'eps_history'
          && /^20\d{2}-\d{2}-\d{2}$/.test(String(observation.date || ''))
          && observation.date <= payload.reference_close
          && Number.isFinite(observation.actual) && Number.isFinite(observation.estimate)
          && observation.actual > observation.estimate;
        if (!valid) errors.push(`${ticker}: every eps_beat_proof row must be dated, numeric and actual > estimate`);
        if (observation && dates.has(observation.date)) errors.push(`${ticker}: duplicate EPS proof quarter ${observation.date}`);
        if (observation) dates.add(observation.date);
      }
      if (dates.size < 5) errors.push(`${ticker}: eps_beat_proof needs five unique quarters`);
    }
    const secReview = candidate.sec_review;
    if (!secReview || secReview.ticker !== ticker || secReview.source_id !== 'sec'
      || secReview.primary_reviewed !== true || secReview.checked_through !== payload.reference_close
      || !/^20\d{2}-\d{2}-\d{2}$/.test(String(secReview.checked_from || ''))
      || !Array.isArray(secReview.forms_reviewed) || secReview.forms_reviewed.length === 0
      || !Array.isArray(secReview.filings) || secReview.filings.length === 0
      || secReview.filings.some(filing => !filing || !String(filing.accession || '').trim()
        || typeof filing.source_pointer !== 'string' || !filing.source_pointer.startsWith('/'))
      || secReview.dilution !== 'clear' || secReview.issuance_capacity !== 'clear'
      || secReview.corporate_actions !== 'clear') {
      errors.push(`${ticker}: sec_review must bind the primary filing window and all clean classifications`);
    }
    const pePass = finitePositive(candidate.forward_pe) && candidate.forward_pe < 35;
    const exceptionPass = !!(candidate.pe_exception
      && candidate.pe_exception.eligible === true
      && candidate.pe_exception.global_monopoly === true
      && typeof candidate.pe_exception.eps_growth_pct === 'number'
      && candidate.pe_exception.eps_growth_pct > 25
      && typeof candidate.pe_exception.peg === 'number'
      && candidate.pe_exception.peg < 2
      && String(candidate.pe_exception.evidence || '').trim());
    if (!pePass && !exceptionPass) errors.push(`${ticker}: forward PE gate failed without documented exception`);
    if (!finitePositive(candidate.peg)) errors.push(`${ticker}: PEG must be a positive finite number`);
    if (typeof candidate.ema20_extension_pct !== 'number' || !Number.isFinite(candidate.ema20_extension_pct) || candidate.ema20_extension_pct > 3) errors.push(`${ticker}: EMA20 extension exceeds 3% or is missing`);
    if (candidate.sec_status !== 'clear') errors.push(`${ticker}: A+ requires sec_status=clear`);
    if (candidate.dilution_status !== 'clear') errors.push(`${ticker}: dilution_status must be clear`);
    if (candidate.issuance_capacity_status !== 'clear') errors.push(`${ticker}: issuance_capacity_status must be clear`);
    if (candidate.corporate_action_status !== 'clear') errors.push(`${ticker}: corporate_action_status must be clear`);
    for (const [field, sourceId] of [['forward_pe', 'technicals'], ['peg', 'technicals'], ['ema20_extension_pct', 'technicals']]) {
      const proof = candidate.market_observations && candidate.market_observations[field];
      if (!proof || proof.value !== candidate[field] || proof.as_of !== payload.reference_close || proof.source_id !== sourceId) {
        errors.push(`${ticker}: market_observations.${field} must bind the exact value/date to ${sourceId}`);
      }
      if (!proof || typeof proof.source_pointer !== 'string' || !proof.source_pointer.startsWith('/')) {
        errors.push(`${ticker}: market_observations.${field}.source_pointer is required`);
      }
    }

    const expectedComponents = {
      guidance_gate: candidate.guidance_raised === true ? 5 : 0,
      eps_beats_gate: Number.isInteger(candidate.eps_beats_consecutive) && candidate.eps_beats_consecutive >= 5 ? 5 : 0,
      valuation_gate: pePass || exceptionPass ? 5 : 0,
      extension_gate: typeof candidate.ema20_extension_pct === 'number' && candidate.ema20_extension_pct <= 3 ? 5 : 0,
      peg: finitePositive(candidate.peg) && candidate.peg < 1.5 ? 15 : 0,
      buyback: candidate.buyback_active === true ? 8 : 0,
      dividend: candidate.dividend_active === true ? 7 : 0,
      structure: candidate.structure_pass === true ? 20 : 0,
      risk_reward: finitePositive(candidate.rr) && candidate.rr >= 2.5 ? 15 : 0,
      sec_catalyst: candidate.sec_catalyst_verified === true && candidate.sec_status === 'clear' ? 15 : 0,
    };
    if (!candidate.score_components || typeof candidate.score_components !== 'object' || Array.isArray(candidate.score_components)) {
      errors.push(`${ticker}: score_components is required`);
    } else {
      for (const [key, expected] of Object.entries(expectedComponents)) {
        if (candidate.score_components[key] !== expected) errors.push(`${ticker}: score_components.${key} must equal ${expected}`);
      }
      const extra = Object.keys(candidate.score_components).filter(key => !(key in expectedComponents));
      if (extra.length) errors.push(`${ticker}: unknown score_components: ${extra.join(', ')}`);
    }
    const recomputedScore = Object.values(expectedComponents).reduce((sum, value) => sum + value, 0);
    if (candidate.score !== recomputedScore) errors.push(`${ticker}: score ${candidate.score} differs from recomputed ${recomputedScore}`);
    if (recomputedScore < 92) errors.push(`${ticker}: recomputed score must be between 92 and 100`);
    const war = candidate.war_room || {};
    const expectedRoles = ['pm', 'quant', 'risk', 'short_seller'];
    const votes = Array.isArray(war.votes) ? war.votes : [];
    const roles = votes.map(vote => vote && vote.role).sort();
    if (votes.length !== 4 || JSON.stringify(roles) !== JSON.stringify(expectedRoles)) errors.push(`${ticker}: war room needs one vote from each required role`);
    const approvals = votes.filter(vote => vote && vote.approve === true).length;
    if (votes.some(vote => typeof vote.approve !== 'boolean' || !Array.isArray(vote.critical_errors))) errors.push(`${ticker}: every war-room vote needs approve and critical_errors[]`);
    if (votes.some(vote => Array.isArray(vote.critical_errors) && vote.critical_errors.length > 0)) errors.push(`${ticker}: a war-room vote contains a critical error`);
    if (war.total !== 4 || war.votes_for !== approvals || approvals < 3) errors.push(`${ticker}: war room needs at least 3/4 reconciled votes`);
    if (!Array.isArray(war.critical_errors) || war.critical_errors.length > 0) errors.push(`${ticker}: war room critical_errors must be an empty array`);
  }
  if (payload.candidates.length >= 2) {
    if (typeof payload.max_pairwise_correlation !== 'number' || !Number.isFinite(payload.max_pairwise_correlation)) errors.push('max_pairwise_correlation is required for a multi-name A+ basket');
    else if (payload.max_pairwise_correlation > 0.70) errors.push('A+ max pairwise correlation exceeds 0.70');
  }
  return [...new Set(errors)];
}

module.exports = { checkEvidence, checkLevels, validateAplus, validateTradeIdeas };
