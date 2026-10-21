/**
 * Searchable navigation (workbench-pages.md §2): entries are projected from the page registry,
 * so search can never list a page that navigation does not have. DOM-free.
 */
import { searchEntries } from '../pages/navigation.js';
import type { PageKind, PageRegistry } from '../pages/types.js';

export interface SearchItem {
  readonly id: string;
  readonly kind: PageKind;
  readonly title: string;
  readonly summary?: string;
  readonly tags: readonly string[];
  readonly route: string;
}

/** Search entries of the registry, with each page's kind (component, foundation, …). */
export function searchItems(registry: PageRegistry): SearchItem[] {
  const kinds = new Map(registry.pages.map((p) => [p.id, p.kind] as const));
  return searchEntries(registry).map((entry) => ({
    ...entry,
    kind: kinds.get(entry.id) as PageKind,
  }));
}

/** Most relevant first: title, then the id (a tag name), then tags, then the summary. */
function score(item: SearchItem, words: readonly string[]): number {
  const title = item.title.toLowerCase();
  const id = item.id.toLowerCase();
  const tags = item.tags.map((t) => t.toLowerCase());
  const summary = (item.summary ?? '').toLowerCase();
  let total = 0;
  for (const word of words) {
    const points = title.startsWith(word)
      ? 8
      : title.split(/\s+/).some((w) => w.startsWith(word))
        ? 6
        : title.includes(word)
          ? 5
          : id.includes(word)
            ? 4
            : tags.some((t) => t.includes(word))
              ? 3
              : summary.includes(word)
                ? 1
                : 0;
    if (points === 0) return 0;
    total += points;
  }
  return total;
}

/** Items matching every word of `query`, best first, at most `limit`; `total` counts them all. */
export function search(
  items: readonly SearchItem[],
  query: string,
  limit = 20,
): { results: SearchItem[]; total: number } {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { results: [], total: 0 };
  const ranked = items
    .map((item) => ({ item, points: score(item, words) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.item.title.localeCompare(b.item.title));
  return { results: ranked.slice(0, limit).map((r) => r.item), total: ranked.length };
}
