// The router in a real document (core-contracts.md §9): the URL and the History API, native
// anchors intercepted at the document, nested and lazy levels with their own scopes, cancellation,
// errors, redirects, a base path, hash mode, titles, and stop/restart as an application service.
import { describe, expect, it } from 'vitest';
import { scopeStats } from '@oddkin/core/scope';
import { createApp } from '../src/app/index.js';
import { createRouter, route } from '../src/router/index.js';
import {
  back,
  click,
  fixture,
  forward,
  here,
  link,
  settle,
  start,
  stop,
  until,
  useRouterFixture,
} from './router-fixture.js';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

useRouterFixture();

describe('the router', () => {
  it('commits nested levels from the URL; navigation pushes or replaces and keeps unchanged levels', async () => {
    const loads: string[] = [];
    const left: string[] = [];
    const products = route({
      path: 'products',
      title: 'Products',
      load: ({ scope, signal }) => {
        loads.push('products');
        scope.add(() => left.push(`products: ${(signal.reason as DOMException).message}`));
        return 'list';
      },
      children: [
        route({ path: '', load: () => 'index' }),
        route({
          path: ':id',
          params: (raw) => {
            const id = Number(raw['id']);
            return Number.isInteger(id) ? { id } : undefined;
          },
          title: (match) => `Product ${match.params.id}`,
          load: ({ params, scope, signal }) => {
            loads.push(`product ${params.id}`);
            scope.add(() =>
              left.push(`product ${params.id}: ${(signal.reason as DOMException).message}`),
            );
            return { id: params.id };
          },
        }),
      ],
    });
    const router = start('/app/products/7?x=1#top', { routes: [route({ path: '' }), products] });
    expect(router.state.value).toMatchObject({
      status: 'ready',
      location: { path: '/products/7', search: '?x=1', hash: '#top' },
      navigating: undefined,
    });
    expect(router.state.value.matches.map((m) => m.status === 'ready' && m.data)).toEqual([
      'list',
      { id: 7 },
    ]);
    expect(document.title).toBe('Product 7');
    const listMatch = router.state.value.matches[0];
    const length = fixture.pushes;

    expect(await router.navigate('/products/8')).toBe(true);
    expect(here()).toBe('/app/products/8');
    expect(fixture.pushes).toBe(length + 1);
    expect(loads).toEqual(['products', 'product 7', 'product 8']);
    expect(router.state.value.matches[0]).toBe(listMatch); // the kept level is the same match
    expect(left).toEqual(['product 7: router left ":id"']);
    expect(document.title).toBe('Product 8');

    await router.navigate('/products', { replace: true });
    expect(fixture.pushes).toBe(length + 1);
    expect(here()).toBe('/app/products');
    expect(router.state.value.matches.map((m) => m.route.path)).toEqual(['products', '']);
    expect(document.title).toBe('Products');

    await router.navigate('/products/abc'); // declined by the params function: nothing matches
    expect(router.state.value).toMatchObject({ status: 'not-found', matches: [] });
    expect(here()).toBe('/app/products/abc');
    expect(left).toContain('products: router left "products"');
  });

  it('loads lazily; a superseded navigation is aborted, never commits, and leaves no entry', async () => {
    const baseline = scopeStats();
    const loads = new Map<string, { deferred: Deferred<string>; signal: AbortSignal }>();
    const page = route({
      path: ':name',
      load: ({ params, signal }) => {
        const entry = { deferred: deferred<string>(), signal };
        loads.set(params['name']!, entry);
        return entry.deferred.promise;
      },
    });
    const router = start('/app/', { routes: [route({ path: '' }), page] });
    expect(router.state.value.status).toBe('ready');
    const length = fixture.pushes;

    const a = router.navigate('/a');
    expect(router.state.value).toMatchObject({
      status: 'ready',
      location: { path: '/' },
      navigating: { path: '/a' },
    });
    expect(here()).toBe('/app/'); // the URL changes when the navigation commits
    const b = router.navigate('/b');
    const aborted = loads.get('a')!.signal;
    expect(aborted.aborted).toBe(true);
    expect((aborted.reason as DOMException).message).toBe('router navigation superseded');
    loads.get('a')!.deferred.resolve('A'); // the superseded load finishes anyway
    expect(await a).toBe(false);
    expect(router.state.value.navigating).toEqual({ path: '/b', search: '', hash: '' });
    loads.get('b')!.deferred.resolve('B');
    expect(await b).toBe(true);
    expect(router.state.value.matches.map((m) => m.status === 'ready' && m.data)).toEqual(['B']);
    expect(here()).toBe('/app/b');
    expect(fixture.pushes).toBe(length + 1);

    stop();
    expect(scopeStats()).toEqual(baseline);
  });

  it('keeps a parent when a nested level fails; lazy-load failures are errors; refresh() loads again', async () => {
    let fail = true;
    const missing = `/__oddkin_missing_${Date.now()}__.js`;
    const child = route({
      path: 'broken',
      load: async () => {
        if (fail) throw new Error('child failed');
        return 'child';
      },
    });
    const lazy = route({ path: 'lazy', load: () => import(/* @vite-ignore */ missing) });
    const badSearch = route({
      path: 'bad-search',
      search: (): { q: string } => {
        throw new Error('bad query');
      },
    });
    const badParams = route({
      path: 'bad-params/:x',
      params: (): { x: number } => {
        throw new Error('params bug');
      },
    });
    const section = route({
      path: 'section',
      load: () => 'section',
      children: [child, lazy, badSearch, badParams],
    });
    const router = start('/app/section/broken', { routes: [section] });
    await until(() => router.state.value.status !== 'idle');
    expect(router.state.value).toMatchObject({
      status: 'error',
      error: { message: 'child failed' },
    });
    expect(router.state.value.matches.map((m) => m.status)).toEqual(['ready', 'error']);
    expect(here()).toBe('/app/section/broken');

    fail = false;
    expect(await router.refresh()).toBe(true);
    expect(router.state.value.status).toBe('ready');
    expect(router.state.value.matches.map((m) => m.status === 'ready' && m.data)).toEqual([
      'section',
      'child',
    ]);

    expect(await router.navigate('/section/lazy')).toBe(true);
    expect(router.state.value.status).toBe('error');
    expect(router.state.value.matches.map((m) => m.status)).toEqual(['ready', 'error']);
    expect(router.state.value.error).toBeInstanceOf(Error);

    // A throwing search parser fails its level; a throwing params parser fails the match.
    await router.navigate('/section/bad-search');
    expect(router.state.value).toMatchObject({ status: 'error', error: { message: 'bad query' } });
    expect(router.state.value.matches.map((m) => m.status)).toEqual(['ready', 'error']);
    await router.navigate('/section/bad-params/1');
    expect(router.state.value).toMatchObject({
      status: 'error',
      matches: [],
      error: { message: 'params bug' },
    });
  });

  it('follows back and forward; only levels that declare search reload for a new query; a hash reloads nothing', async () => {
    const loads: string[] = [];
    const search = route({
      path: 'search',
      search: (params) => ({ q: params.get('q') ?? '' }),
      load: ({ search }) => {
        loads.push(`search ${search.q}`);
        return search.q;
      },
    });
    const plain = route({
      path: 'plain',
      load: ({ location }) => {
        loads.push(`plain ${location.search}`);
        return 'plain';
      },
    });
    const router = start('/app/plain', { routes: [plain, search] });
    await router.navigate('/plain?page=2');
    await router.navigate('#notes');
    expect(loads).toEqual(['plain ']);
    expect(router.state.value.location).toEqual({
      path: '/plain',
      search: '?page=2',
      hash: '#notes',
    });
    await router.navigate('/search?q=tea');
    await router.navigate('/search?q=coffee');
    expect(loads).toEqual(['plain ', 'search tea', 'search coffee']);
    expect(router.match(search)?.search).toEqual({ q: 'coffee' });
    expect(router.match(plain)).toBeUndefined();

    await back();
    expect(here()).toBe('/app/search?q=tea');
    expect(router.state.value.location?.search).toBe('?q=tea');
    expect(loads.at(-1)).toBe('search tea');
    await back();
    expect(router.state.value.location).toEqual({
      path: '/plain',
      search: '?page=2',
      hash: '#notes',
    });
    expect(loads.at(-1)).toBe('plain ?page=2');
    await back();
    expect(router.state.value.location).toEqual({ path: '/plain', search: '?page=2', hash: '' });
    expect(loads.at(-1)).toBe('plain ?page=2'); // only the hash changed: nothing reloads
    await forward();
    await forward();
    expect(router.state.value.location).toEqual({ path: '/search', search: '?q=tea', hash: '' });
  });

  it('intercepts only primary, unmodified clicks on links inside the base path', async () => {
    const router = start('/app/', {
      routes: [route({ path: '' }), route({ path: 'products/:id' }), route({ path: 'file.pdf' })],
    });
    const length = fixture.pushes;
    expect(await click(link('/app/products/1'))).toBe(true);
    expect(here()).toBe('/app/products/1');
    const host = document.createElement('div');
    fixture.container.append(host);
    const inShadow = document.createElement('a');
    inShadow.setAttribute('href', '/app/products/2');
    host.attachShadow({ mode: 'open' }).append(inShadow);
    expect(await click(inShadow)).toBe(true);
    expect(here()).toBe('/app/products/2');
    expect(await click(link('3', { target: '_self' }))).toBe(true); // relative to the page URL
    expect(here()).toBe('/app/products/3');
    expect(fixture.pushes).toBe(length + 3);

    const escapes: [string, HTMLAnchorElement, MouseEventInit | undefined][] = [
      ['ctrl', link('/app/products/4'), { ctrlKey: true }],
      ['meta', link('/app/products/4'), { metaKey: true }],
      ['shift', link('/app/products/4'), { shiftKey: true }],
      ['alt', link('/app/products/4'), { altKey: true }],
      ['middle button', link('/app/products/4'), { button: 1 }],
      ['target', link('/app/products/4', { target: '_blank' }), undefined],
      ['download', link('/app/file.pdf', { download: '' }), undefined],
      ['rel=external', link('/app/products/4', { rel: 'noopener external' }), undefined],
      ['outside the base path', link('/elsewhere/products/4'), undefined],
      ['another origin', link('https://example.com/app/products/4'), undefined],
      ['a fragment of this page', link('#section'), undefined],
    ];
    for (const [name, anchor, init] of escapes) {
      expect(await click(anchor, init), name).toBe(false);
    }
    const handled = link('/app/products/5');
    handled.addEventListener('click', (event) => event.preventDefault());
    await click(handled); // the application handled it first
    expect(router.state.value.location?.path).toBe('/products/3');
    expect(here()).toBe('/app/products/3');
    expect(fixture.pushes).toBe(length + 3);

    expect(await click(link('/app/products/3'))).toBe(true); // the same URL replaces
    expect(fixture.pushes).toBe(length + 3);
    expect(await click(link('/app'))).toBe(true); // the base path without its trailing slash
    expect(router.state.value.location).toEqual({ path: '/', search: '', hash: '' });
    expect(here()).toBe('/app/');
  });

  it('redirects where a navigation ends, pushing or replacing like the navigation; loops are errors', async () => {
    const components = route({ path: 'components' });
    const playground = route({
      path: 'playground',
      redirect: ({ location }) => `/components${location.search}`,
    });
    const loopA = route({ path: 'loop-a', redirect: '/loop-b' });
    const loopB = route({ path: 'loop-b', redirect: '/loop-a' });
    const router = start('/app/playground?tag=odd-button', {
      routes: [components, playground, loopA, loopB],
    });
    expect(here()).toBe('/app/components?tag=odd-button'); // the legacy URL was replaced
    expect(router.match(components)).toBeDefined();
    const length = fixture.pushes;
    expect(await click(link('/app/playground'))).toBe(true);
    expect(here()).toBe('/app/components');
    expect(fixture.pushes).toBe(length + 1);

    await router.navigate('/loop-a');
    expect(router.state.value).toMatchObject({
      status: 'error',
      error: { code: 'app.router.redirect' },
    });
  });

  it('hash mode keeps the path in the fragment; in-page fragments keep the route', async () => {
    const loads: string[] = [];
    const page = route({
      path: ':name',
      load: ({ params }) => {
        loads.push(params['name']!);
        return params['name'];
      },
    });
    const router = start('/app/index.html#/start', {
      routes: [route({ path: '' }), page],
      mode: 'hash',
    });
    expect(router.state.value.location).toEqual({ path: '/start', search: '', hash: '' });
    expect(router.href('/next?x=1')).toBe('#/next?x=1');
    await router.navigate('/next');
    expect(location.pathname).toBe('/app/index.html');
    expect(location.hash).toBe('#/next');
    expect(await click(link('#/other'))).toBe(true);
    expect(location.hash).toBe('#/other');
    expect(await click(link('#details'))).toBe(true); // an in-page fragment of the route
    expect(location.hash).toBe('#/other#details');
    expect(router.state.value.location).toEqual({ path: '/other', search: '', hash: '#details' });
    expect(loads).toEqual(['start', 'next', 'other']);

    await back();
    expect(router.state.value.location).toEqual({ path: '/other', search: '', hash: '' });
    await back();
    expect(router.state.value.location?.path).toBe('/next');
    // A fragment set directly is read as a fragment of the current route and written in full.
    const changed = new Promise<void>((resolve) => {
      window.addEventListener('popstate', () => resolve(), { once: true });
      window.addEventListener('hashchange', () => resolve(), { once: true });
    });
    location.hash = 'notes';
    await changed;
    await until(() => location.hash === '#/next#notes');
    expect(router.state.value.location).toEqual({ path: '/next', search: '', hash: '#notes' });
    expect(loads).toEqual(['start', 'next', 'other', 'next']);
  });

  it('sets the document title from the deepest title, as the application formats it', async () => {
    const router = start('/app/guides/start', {
      routes: [
        route({
          path: 'guides',
          title: 'Guides',
          children: [
            route({ path: ':page' }),
            route({
              path: 'broken/:x',
              title: () => {
                throw new Error('title bug');
              },
            }),
          ],
        }),
      ],
      formatTitle: (title, state) =>
        state.status === 'not-found' ? 'Not found · Oddkin' : `${title} · Oddkin`,
    });
    expect(document.title).toBe('Guides · Oddkin'); // the page has no title: its parent's
    await router.navigate('/missing');
    expect(document.title).toBe('Not found · Oddkin');
    await router.navigate('/guides/broken/1');
    expect(document.title).toBe('Not found · Oddkin'); // left alone
    expect(fixture.reported).toEqual([{ code: 'app.router.title', origin: 'router' }]);
  });

  it('runs as an application service: stop ends every level with its reason; restart reads the URL again', async () => {
    const baseline = scopeStats();
    const reasons: unknown[] = [];
    const page = route({
      path: ':name',
      load: ({ signal }) => {
        signal.addEventListener('abort', () => reasons.push(signal.reason));
        return 'ok';
      },
    });
    history.pushState(null, '', '/app/one');
    const router = createRouter({ base: '/app/', routes: [page] });
    const app = createApp({
      name: 'docs',
      setup({ use }) {
        use(router);
      },
    });
    app.start();
    expect(router.state.value).toMatchObject({ status: 'ready', location: { path: '/one' } });
    const reason = new Error('shutting down');
    app.stop(reason);
    expect(reasons).toEqual([reason]);
    expect(router.state.value.status).toBe('idle');
    expect(scopeStats()).toEqual(baseline);
    expect(() => router.navigate('/two')).toThrow('app.router.disconnected');
    expect(await click(link('/app/two'))).toBe(false); // no listener is left

    history.replaceState(null, '', '/app/three');
    app.start();
    expect(router.state.value).toMatchObject({ status: 'ready', location: { path: '/three' } });
    expect(await click(link('/app/four'))).toBe(true);
    expect(router.state.value.location?.path).toBe('/four');
    app.stop();
    expect(scopeStats()).toEqual(baseline);
  });
});
