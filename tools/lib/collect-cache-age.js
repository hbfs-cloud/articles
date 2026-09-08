'use strict';
// Filesystem timestamps change on checkout/copy. Only a captured response dates a cache.
function cacheAgeMinutes(value, now = Date.now()) {
  const timestamp = value && (value.captured_at || value.result?.captured_at || value.data?.captured_at);
  if (typeof timestamp !== 'string') return null;
  const captured = Date.parse(timestamp);
  if (!Number.isFinite(captured) || captured > now) return null;
  return (now - captured) / 60000;
}
module.exports = { cacheAgeMinutes };
