/**
 * LRU cache utility for storing computed values
 */
export function createLRUCache<K, V>(limit: number) {
  const cache = new Map<K, V>();

  function touch(key: K, value: V): V {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > limit) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
    return value;
  }

  return {
    get: (key: K) => cache.get(key),
    set: (key: K, value: V) => cache.set(key, value),
    touch,
    clear: () => cache.clear(),
    size: () => cache.size,
  };
}
