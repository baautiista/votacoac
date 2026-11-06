// Only aggregate public data is cached. Accounts, sessions and individual records never enter this cache.
const caches = new WeakMap();
export function publicCached(db, key, read, ttl = 5000) {
  let cache = caches.get(db); if (!cache) { cache = new Map(); caches.set(db, cache); }
  const existing = cache.get(key); if (existing && existing.expires > Date.now()) return existing.promise;
  const entry = { expires: Date.now() + ttl, promise: Promise.resolve().then(read) }; cache.set(key, entry);
  entry.promise.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
  return entry.promise;
}
export function invalidatePublic(db) { caches.get(db)?.clear(); }
