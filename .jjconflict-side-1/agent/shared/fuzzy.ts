import uFuzzy from "@leeoniya/ufuzzy";

const uf = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
});

interface FuzzyResult<T> {
  item: T;
  score: number;
}

export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const [idxs] = uf.search([text], query);
  return idxs !== null && idxs.length > 0;
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): FuzzyResult<T>[] {
  if (!query) {
    return items.map((item) => ({ item, score: 1 }));
  }

  const haystack = items.map(getText);
  const [idxs, info] = uf.search(haystack, query);

  if (!idxs || idxs.length === 0 || !info) return [];

  const order = uf.sort(info, haystack, query);
  return order.map((orderIdx, rank) => ({
    item: items[idxs[orderIdx]],
    score: 1 - rank / order.length,
  }));
}

export function fuzzySort<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  return fuzzyFilter(items, query, getText).map((r) => r.item);
}
