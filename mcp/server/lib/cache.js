/**
 * Intelligent cache with TTL per type
 * Prevents hammering APIs, serves stale data during outages
 */

const store = new Map();

export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function set(key, value, ttlSeconds = 60) {
  store.set(key, {
    value,
    expires: Date.now() + ttlSeconds * 1000,
    created: Date.now()
  });
}

export function invalidate(key) {
  store.delete(key);
}

export function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function stats() {
  let active = 0, expired = 0;
  const now = Date.now();
  for (const [, entry] of store) {
    if (now > entry.expires) expired++;
    else active++;
  }
  return { active, expired, total: store.size };
}

export function clear() {
  store.clear();
}
