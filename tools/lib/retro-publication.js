'use strict';

/**
 * Classify a retrospective from its public page and its result sidecar.
 *
 * A coverage review is deliberately not a performance retrospective.  It may
 * omit a grade and must not advance the performance dashboard, but only when
 * both public representations say so.  Requiring the pair prevents a marker
 * added to HTML alone from silently weakening the historic QA rules.
 */
function classifyRetroPublication(html, results) {
  const markerMatch = String(html || '').match(/\bdata-retro-publication\s*=\s*["']([^"']+)["']/i);
  // `forensic_audit` is also documentary: it can analyse hypothetical levels,
  // but it cannot advance a certified performance record.
  const marker = Boolean(markerMatch && ['coverage_review', 'forensic_audit'].includes(markerMatch[1].toLowerCase()));
  const publication = results && typeof results === 'object' ? results.publication : null;
  const declaredType = publication && publication.type === 'coverage_review';
  const uncertified = publication && publication.cohort_performance_certified === false;
  const claimsCoverageReview = marker || declaredType;

  if (!claimsCoverageReview) return { kind: 'performance' };

  if (marker && declaredType && uncertified) return { kind: 'coverage_review' };

  const missing = [];
  if (!marker) missing.push('marqueur HTML documentaire data-retro-publication');
  if (!declaredType) missing.push('retro-results.publication.type="coverage_review"');
  if (!uncertified) missing.push('retro-results.publication.cohort_performance_certified=false');
  return {
    kind: 'invalid_coverage_review',
    reason: `déclaration couverture incomplète: ${missing.join(', ')}`,
  };
}

module.exports = { classifyRetroPublication };
