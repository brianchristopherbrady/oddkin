/**
 * Projections of the registry. Every navigation surface reads from the same registry, so
 * routes, primary navigation, sidebars, cards, and search cannot drift apart.
 */
import type { PageEntry, PageRegistry } from './types.js';

const byOrder = (pages: readonly PageEntry[]) =>
  pages
    .map((page, index) => ({ page, index }))
    .sort((a, b) => (a.page.order ?? a.index) - (b.page.order ?? b.index) || a.index - b.index)
    .map((p) => p.page);

/** Visible primary navigation entries in configured order. */
export function primaryNavigation(registry: PageRegistry): PageEntry[] {
  const byId = new Map(registry.pages.map((p) => [p.id, p] as const));
  return registry.primaryNav.flatMap((id) => {
    const page = byId.get(id);
    return page?.visible ? [page] : [];
  });
}

/** Contextual sidebar for a section, grouped when the section has groups. */
export function sidebar(
  registry: PageRegistry,
  section: string,
): { group: string | undefined; pages: PageEntry[] }[] {
  const pages = registry.pages.filter((p) => p.visible && p.nav.sidebar && p.section === section);
  const groups = new Map<string | undefined, PageEntry[]>();
  for (const page of pages) groups.set(page.group, [...(groups.get(page.group) ?? []), page]);
  return [...groups].map(([group, entries]) => ({ group, pages: byOrder(entries) }));
}

/** Overview cards for a section (never Theme Studio). */
export function cards(registry: PageRegistry, section: string): PageEntry[] {
  return byOrder(registry.pages.filter((p) => p.visible && p.nav.card && p.section === section));
}

/** Search entries: every visible page that opts into search. */
export function searchEntries(
  registry: PageRegistry,
): { id: string; title: string; summary?: string; tags: readonly string[]; route: string }[] {
  return registry.pages
    .filter((p) => p.visible && p.nav.search)
    .map((p) => ({
      id: p.id,
      title: p.title,
      ...(p.summary ? { summary: p.summary } : {}),
      tags: p.tags ?? [],
      route: p.route,
    }));
}

/** "On this page" entries: visible sections, only when there are at least two. */
export function onThisPage(page: PageEntry): { id: string; title: string }[] {
  const visible = page.sections.filter((s) => s.visible);
  return visible.length >= 2 ? visible.map(({ id, title }) => ({ id, title })) : [];
}

/** URL for a route under the base path, in history or hash mode. */
export function href(registry: PageRegistry, route: string): string {
  const relative = route.replace(/^\//, '');
  return registry.routing === 'hash'
    ? `${registry.basePath}#/${relative}`
    : `${registry.basePath}${relative}`;
}

export type RedirectResult =
  | { readonly kind: 'redirect'; readonly to: string }
  | { readonly kind: 'notice'; readonly code: 'products.disabled' };

/**
 * Resolve a legacy route (relative to the base path). `/playground?component=<tag>` goes to
 * that component when it exists, keeping other parameters; `/foundations/products` without
 * Products and modes gives a notice instead of a redirect.
 */
export function resolveLegacyRoute(
  registry: PageRegistry,
  path: string,
  search = '',
): RedirectResult | undefined {
  const params = new URLSearchParams(search);
  if (path === '/playground') {
    const tag = params.get('component');
    const target = tag
      ? registry.pages.find((p) => p.id === `components/${tag}` && p.visible)
      : undefined;
    const owner = registry.pages.find((p) => p.visible && p.legacyRoutes?.includes(path));
    if (!target && !owner) return undefined;
    params.delete('component');
    const rest = params.toString();
    return { kind: 'redirect', to: `${(target ?? owner)?.route}${rest ? `?${rest}` : ''}` };
  }
  const owner = registry.pages.find((p) => p.visible && p.legacyRoutes?.includes(path));
  if (owner) return { kind: 'redirect', to: `${owner.route}${search}` };
  if (
    path === '/foundations/products' &&
    !registry.pages.some((p) => p.id === 'products' && p.visible)
  ) {
    return { kind: 'notice', code: 'products.disabled' };
  }
  return undefined;
}

/** Static redirect stubs for history-mode builds (meta refresh + canonical link). */
export function staticRedirects(registry: PageRegistry): { from: string; to: string }[] {
  if (registry.routing !== 'history') return [];
  return registry.pages.flatMap((p) =>
    p.visible ? (p.legacyRoutes ?? []).map((from) => ({ from, to: p.route })) : [],
  );
}
