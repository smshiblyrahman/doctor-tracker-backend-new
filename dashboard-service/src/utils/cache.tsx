interface Entry {
  expiresAt: number;
  value: Promise<unknown>;
}

/**
 * Tiny in-process TTL cache that also de-duplicates concurrent identical requests
 * (the in-flight promise is shared). Failed lookups are evicted immediately so an
 * outage does not get cached.
 */
export function createTtlCache(ttlSeconds: number) {
  const store = new Map<string, Entry>();

  function get<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (ttlSeconds <= 0) return load();
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expiresAt > now) return hit.value as Promise<T>;

    const value = load().catch((err) => {
      store.delete(key);
      throw err;
    });
    store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
    return value;
  }

  return { get, clear: () => store.clear() };
}
