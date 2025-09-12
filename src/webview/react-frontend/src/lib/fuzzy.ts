export type FuzzyItem = { key: string; label: string; path?: string };

function scoreSimple(query: string, target: string): number {
  if (!query) return 0.1; // minimal score for empty query
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const idx = t.indexOf(q);
  if (idx >= 0) {
    // direct substring match, favor starts-with
    return 100 - idx * 2 - (t.length - q.length) * 0.1;
  }
  // very small fuzzy: in-order char match
  let ti = 0;
  let matched = 0;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    let found = false;
    while (ti < t.length) {
      if (t[ti] === ch) { found = true; ti++; break; }
      ti++;
    }
    if (found) matched++;
    else break;
  }
  if (matched === 0) return -Infinity;
  return matched * 1 - (t.length - matched) * 0.01;
}

export function fuzzySearch<T extends FuzzyItem>(query: string, items: T[], limit = 10): T[] {
  const scored = items.map((it) => ({ it, s: scoreSimple(query, it.label + ' ' + (it.path || '')) }))
    .filter((x) => x.s > -Infinity)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
  return scored;
}

