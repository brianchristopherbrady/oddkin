import { describe, expect, it } from 'vitest';
import { OddkinError, setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { createScope } from '@oddkin/core/scope';
import { createRouter, matchRoutes, route, type AnyRoute } from '../src/router/index.js';

// Routes and matching (core-contracts.md §9): DOM-free parts of @oddkin/app/router.

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof OddkinError ? error.code : `not an OddkinError: ${String(error)}`;
  }
  return undefined;
};

const shape = (path: string, routes: readonly AnyRoute[]) =>
  matchRoutes(routes, path)?.map((level) => [level.route.path, level.params]);

describe('matchRoutes', () => {
  const product = route({
    path: ':id',
    params: (raw) => {
      const id = Number(raw['id']);
      return Number.isInteger(id) ? { id } : undefined;
    },
  });
  const productNew = route({ path: 'new' });
  const products = route({
    path: 'products',
    children: [route({ path: '' }), product, productNew],
  });
  const docs = route({ path: 'docs/*' });
  const home = route({ path: '' });
  const about = route({ path: '/about/' });
  const routes = [home, about, products, docs];

  it('matches static, parameter, index, and rest patterns level by level', () => {
    expect(shape('/', routes)).toEqual([['', {}]]);
    expect(shape('/about', routes)).toEqual([['/about/', {}]]);
    expect(shape('/products', routes)).toEqual([
      ['products', {}],
      ['', {}],
    ]);
    expect(shape('/products/42', routes)).toEqual([
      ['products', {}],
      [':id', { id: 42 }],
    ]);
    expect(shape('/docs/guides/start', routes)).toEqual([['docs/*', { '*': 'guides/start' }]]);
    expect(shape('/docs', routes)).toEqual([['docs/*', { '*': '' }]]);
    expect(shape('/nowhere', routes)).toBeUndefined();
  });

  it('declines a match whose params return undefined and goes on with the next route', () => {
    expect(shape('/products/new', routes)).toEqual([
      ['products', {}],
      ['new', {}],
    ]);
    expect(shape('/products/abc', routes)).toBeUndefined();
  });

  it('tries siblings in definition order: the first full match wins', () => {
    const first = route({ path: ':slug' });
    const second = route({ path: 'fixed' });
    expect(matchRoutes([first, second], '/fixed')![0]!.route).toBe(first);
    expect(matchRoutes([second, first], '/fixed')![0]!.route).toBe(second);
  });

  it('lets a parent end the match when no child matches the empty rest', () => {
    const layout = route({ path: 'guides', children: [route({ path: ':page' })] });
    expect(shape('/guides', [layout])).toEqual([['guides', {}]]);
    expect(shape('/guides/a/b', [layout])).toBeUndefined();
  });

  it('accumulates raw params for inner levels and decodes segments', () => {
    const inner = route({
      path: ':page',
      params: (raw) => ({ section: raw['section'], page: raw['page'] }),
    });
    const outer = route({ path: ':section', children: [inner] });
    expect(shape('/caf%C3%A9/a%20b', [outer])).toEqual([
      [':section', { section: 'café' }],
      [':page', { section: 'café', page: 'a b' }],
    ]);
    expect(shape('/%E0%A4%A', [outer])).toBeUndefined(); // cannot be decoded
    expect(shape('//caf%C3%A9//x/', [outer])).toEqual(shape('/caf%C3%A9/x', [outer]));
  });

  it('propagates a throwing params function', () => {
    const broken = route({
      path: ':id',
      params: (): { id: number } => {
        throw new Error('parser bug');
      },
    });
    expect(() => matchRoutes([broken], '/1')).toThrow('parser bug');
  });
});

describe('route definitions and router options', () => {
  it('rejects invalid patterns with app.router.route', () => {
    expect(codeOf(() => route({ path: '*/more' }))).toBe('app.router.route');
    expect(codeOf(() => route({ path: 'a/:' }))).toBe('app.router.route');
    expect(
      codeOf(() => route({ path: 'old', redirect: '/new', children: [route({ path: 'x' })] })),
    ).toBe('app.router.route');
    // Plain objects are checked by createRouter, at any depth.
    expect(
      codeOf(() => createRouter({ routes: [{ path: 'a', children: [{ path: '*/b' }] }] })),
    ).toBe('app.router.route');
  });

  it('rejects invalid options with app.router.options', () => {
    expect(codeOf(() => createRouter({ routes: [], base: 'docs/' }))).toBe('app.router.options');
    expect(codeOf(() => createRouter({ routes: [], base: '/docs/?x' }))).toBe('app.router.options');
    expect(codeOf(() => createRouter({ routes: [], mode: 'memory' as never }))).toBe(
      'app.router.options',
    );
    expect(codeOf(() => createRouter({ routes: undefined as never }))).toBe('app.router.options');
  });

  it('builds hrefs for the base path or the fragment, relative to the current location', () => {
    const history = createRouter({ routes: [], base: '/docs' });
    expect(history.href('/')).toBe('/docs/');
    expect(history.href('/components/odd-button?tab=api#usage')).toBe(
      '/docs/components/odd-button?tab=api#usage',
    );
    expect(history.href('guides')).toBe('/docs/guides');
    const hash = createRouter({ routes: [], mode: 'hash' });
    expect(hash.href('/components?q=x')).toBe('#/components?q=x');
    expect(codeOf(() => history.href('https://example.com/'))).toBe('app.router.path');
    expect(codeOf(() => history.href('//example.com/x'))).toBe('app.router.path');
  });

  it('navigates only while running, and needs a window to run', () => {
    const router = createRouter({ routes: [route({ path: '' })] });
    expect(codeOf(() => router.navigate('/'))).toBe('app.router.disconnected');
    expect(codeOf(() => router.refresh())).toBe('app.router.disconnected');
    expect(router.state.value).toMatchObject({ status: 'idle', matches: [] });
    const scope = createScope();
    expect(codeOf(() => scope.use(router))).toBe('app.router.environment'); // Node has no window
    scope.dispose();
  });

  it('keeps the committed location when the History API refuses a new URL', async () => {
    const refusal = new DOMException(
      'Attempt to use history.pushState() more than 100 times per 10 seconds',
      'SecurityError',
    );
    const fakeWindow = {
      history: {
        state: null as unknown,
        scrollRestoration: 'auto',
        pushState() {
          throw refusal;
        },
        replaceState(state: unknown) {
          this.state = state;
        },
      },
      location: {
        pathname: '/',
        search: '',
        hash: '',
        href: 'http://localhost/',
        origin: 'http://localhost',
      },
      document: { title: '', addEventListener() {}, removeEventListener() {} },
      scrollX: 0,
      scrollY: 0,
      scrollTo() {},
      addEventListener() {},
      removeEventListener() {},
    };
    const aborted: unknown[] = [];
    const next = route({
      path: 'next',
      load: ({ signal }) => {
        signal.addEventListener('abort', () => aborted.push(signal.reason));
        return 'next';
      },
    });
    const reported: ErrorContext[] = [];
    setErrorHandler((_error, context) => reported.push(context));
    try {
      const router = createRouter({
        routes: [route({ path: '' }), next],
        window: fakeWindow as unknown as Window,
        announce: false,
      });
      const scope = createScope();
      scope.use(router);
      expect(router.state.value).toMatchObject({ status: 'ready', location: { path: '/' } });
      expect(await router.navigate('/next')).toBe(false);
      expect(router.state.value).toMatchObject({
        status: 'ready',
        location: { path: '/' },
        navigating: undefined,
      });
      expect(aborted).toEqual([refusal]);
      expect(reported).toEqual([{ code: 'app.router.history', origin: 'router' }]);
      expect(fakeWindow.history.scrollRestoration).toBe('manual');
      scope.dispose();
      expect(fakeWindow.history.scrollRestoration).toBe('auto');
    } finally {
      setErrorHandler(undefined);
    }
  });
});
