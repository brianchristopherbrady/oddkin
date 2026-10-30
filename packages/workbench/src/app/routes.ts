/**
 * The shell's routes, generated from the page registry (workbench-pages.md §2): every visible
 * page, legacy routes as redirects, and the Products notice. DOM-free, so it can be tested
 * with `matchRoutes` in Node.
 */
import { route, type AnyRoute, type RouteContext } from '@oddkin/app/router';
import { resolveLegacyRoute } from '../pages/navigation.js';
import type { PageEntry, PageRegistry } from '../pages/types.js';

/** What a route level shows: a registry page with the data its loader returned, or a notice. */
export type ShellView =
  | { readonly kind: 'page'; readonly page: PageEntry; readonly data: unknown }
  | { readonly kind: 'notice'; readonly code: 'products.disabled' };

/** Loads a page's data (and anything its view needs) for one navigation. */
export type PageLoader = (
  page: PageEntry,
  context: RouteContext<unknown, unknown>,
) => unknown | PromiseLike<unknown>;

interface Node {
  page?: PageEntry;
  redirect?: string;
  notice?: 'products.disabled';
  readonly children: Map<string, Node>;
}

function level(
  registry: PageRegistry,
  node: Node,
  load: PageLoader,
): Partial<AnyRoute> | undefined {
  const { page, redirect, notice } = node;
  if (page) {
    return {
      name: page.id,
      title: page.title,
      load: async (context: RouteContext<unknown, unknown>): Promise<ShellView> => ({
        kind: 'page',
        page,
        data: await load(page, context),
      }),
    };
  }
  if (redirect) {
    const from = redirect;
    return {
      redirect: ({ location }) => {
        const result = resolveLegacyRoute(registry, from, location.search);
        return result?.kind === 'redirect' ? result.to : '/';
      },
    };
  }
  if (notice) {
    return {
      title: 'Products and modes',
      load: (): ShellView => ({ kind: 'notice', code: notice }),
    };
  }
  return undefined;
}

function toRoutes(registry: PageRegistry, node: Node, load: PageLoader): AnyRoute[] {
  const routes: AnyRoute[] = [];
  for (const [segment, child] of node.children) {
    const own = level(registry, child, load);
    const children = toRoutes(registry, child, load);
    if (children.length)
      routes.push(
        route({
          path: segment,
          children: own ? [route({ ...own, path: '' }), ...children] : children,
        }),
      );
    else if (own) routes.push(route({ ...own, path: segment }));
  }
  return routes;
}

/**
 * Routes for every visible page (nested by path segment), each legacy route of a visible page
 * as a redirect resolved like `resolveLegacyRoute`, `/foundations/products` as a notice when
 * Products and modes is not shown, and, without a home page, `/` redirecting to the first
 * primary destination that has content.
 */
export function shellRoutes(registry: PageRegistry, load: PageLoader): AnyRoute[] {
  const root: Node = { children: new Map() };
  const at = (path: string) => {
    let node = root;
    for (const segment of path.split('/').filter(Boolean)) {
      let child = node.children.get(segment);
      if (!child) node.children.set(segment, (child = { children: new Map() }));
      node = child;
    }
    return node;
  };
  for (const page of registry.pages) if (page.visible) at(page.route).page = page;
  for (const page of registry.pages) {
    if (!page.visible) continue;
    for (const legacy of page.legacyRoutes ?? []) {
      const node = at(legacy);
      if (!node.page) node.redirect = legacy;
    }
  }
  if (!registry.pages.some((p) => p.id === 'products' && p.visible)) {
    const node = at('/foundations/products');
    if (!node.page) node.notice = 'products.disabled';
  }
  const own = level(registry, root, load);
  // Without a home page, the base URL goes to the first primary destination with content: a
  // library without foundation data opens on its components, not on an explanation.
  const primary = registry.primaryNav.flatMap((id) =>
    registry.pages.filter((p) => p.id === id && p.visible),
  );
  const first = primary.find((p) => p.availability !== 'unavailable') ?? primary[0];
  const entry = own ?? (first && first.route !== '/' ? { redirect: first.route } : undefined);
  return [...(entry ? [route({ ...entry, path: '' })] : []), ...toRoutes(registry, root, load)];
}
