# @oddkin/app

Optional application lifetime, router, and async resources. Components never need it.

**Status:** Implemented: `./app` (`createApp`, M6), `./resource` (`resource`, M7), `./command` (`command`, M7), `./router` (`createRouter`, `route`, `matchRoutes`, M7), and `./lifecycle` (`pageLifecycle`, M7), all re-exported from the root entry. Examples: [examples/router](../../examples/router/), [examples/lifecycle](../../examples/lifecycle/). Contract: [core-contracts.md §8–§9](../../docs/architecture/core-contracts.md); entries: [packages.md](../../docs/architecture/packages.md).

## Applications (`@oddkin/app/app`)

```js
import { createApp } from '@oddkin/app';
import { createContext } from '@oddkin/state/context';
import { createStore } from '@oddkin/state/store';

export const cartContext = createContext('cart');

const shop = createApp({
  name: 'shop',
  root: document.querySelector('#shop'),
  setup({ scope, provide, use }) {
    const cart = createStore({ items: [] });
    scope.add(() => cart.dispose()); // ends with stop()
    provide(cartContext, cart); // elements below the root consume it
    return { cart };
  },
});

const { cart } = shop.start();
shop.stop(); // everything the run registered is disposed
shop.start(); // setup runs again with fresh ownership
```

- `start()` and `stop()` are idempotent; `app.running` is tracked and `app.services` belongs to the current run.
- If `setup` throws, the partial run is disposed and the application stays stopped.
- One running application per root; applications with different roots never affect each other, and an application inside another's root overrides context below its own root.
- There is no global application and importing the package registers nothing.

## Resources (`@oddkin/app/resource`, DOM-free)

```js
import { resource } from '@oddkin/app/resource';

class ProductSearch extends OddkinElement {
  query = signal('');
  results = resource({
    source: () => this.query.value.trim() || undefined, // undefined: idle
    load: async (query, { signal }) => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      return response.json();
    },
    timeout: 10_000,
  });
  connected(scope) {
    scope.use(this.results); // no cleanup code: the connection owns the request
  }
  render() {
    const state = this.results.state.value; // idle | pending | success | error
    return html`<p>${state.status === 'success' ? state.value.length : state.status}</p>`;
  }
}
```

Typing a new query aborts the previous request; a stale response never renders, even if the request ignored its signal. Disconnecting aborts the request with the element's reason and keeps the latest success; reconnecting loads again unless `freshFor` says it is fresh. `refresh()`, `retry()`, and `cancel()` are explicit; a timeout is an error (`TimeoutError`), a cancellation is not.

## Commands (`@oddkin/app/command`, DOM-free)

Resources read; commands change things. A command runs only when asked, while it is connected to a scope that owns its runs.

```js
import { command } from '@oddkin/app/command';

class SaveNote extends OddkinElement {
  save = command({
    name: 'save note',
    run: async (note, { signal }) => {
      const response = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Idempotency-Key': note.revision },
        body: JSON.stringify(note),
        signal,
      });
      if (!response.ok) throw new HttpError(response.status);
      return response.json();
    },
    // Nothing is retried unless a policy says which failures are safe to repeat.
    retry: { retries: 2, when: (error) => error.status === 503, delay: (attempt) => 500 * attempt },
  });
  connected(scope) {
    scope.use(this.save); // the connection owns the runs
  }
  async submit(note) {
    const outcome = await this.save.run(note); // never rejects
    if (outcome.status === 'cancelled') {
      // Unknown, not undone: the server may have saved it. Read it again; roll nothing back.
      this.current.refresh(); // `current` is a resource that reads the note
    }
  }
}
```

- `state` is `idle`, `pending` (with `attempt` and the failure being retried), `success`, `error` (with `attempts`), or `cancelled`. A cancellation is not a rollback: the client stopped waiting and the server may have applied the change, so the state says `cancelled`, never `idle`, until `reset()`.
- `run(input)` starts at once, keeping the caller's user activation, and resolves `success`, `error`, `cancelled`, or `dropped` (never started). It throws `app.command.disconnected` unless the command is connected.
- One run at a time by default (`concurrency: 'exclusive'` drops a second run while one is pending); `queue` runs them in order and `latest` keeps only the latest waiting input. A running mutation is never aborted to start another.
- `cancel()` aborts the pending run's signal and drops waiting runs; the owner's end (for example the element disconnecting) does the same with its reason. `timeout` fails an attempt with a `TimeoutError`.

## Router (`@oddkin/app/router`)

```js
import { createApp, createRouter, route } from '@oddkin/app';

const router = createRouter({
  base: '/docs/', // explicit; or mode: 'hash' for static hosts without rewrites
  routes: [
    route({ path: '', title: 'Home', load: () => import('./pages/home.js') }),
    route({
      path: 'components',
      title: 'Components',
      children: [
        route({
          path: ':tag',
          title: ({ params }) => params.tag,
          load: ({ params, signal }) => fetchMetadata(params.tag, signal),
        }),
      ],
    }),
    route({ path: 'playground', redirect: '/components' }),
  ],
  formatTitle: (title) => (title ? `${title} · Docs` : 'Docs'),
  focus: () => document.querySelector('main h1'), // after a navigation to another path
});

createApp({ root: document.querySelector('#docs'), setup: ({ use }) => void use(router) }).start();
// A shell element renders router.state; links stay <a href=${router.href('/components')}>.
```

- The URL is the source of truth. A navigation loads its new levels in parallel and commits once they settle; unchanged outer levels, with their scopes and data, are kept. A newer navigation aborts a pending one, which never commits and leaves no history entry.
- `router.state` is `{ status, location, matches, error, navigating }`: `ready`, `error` (a failed level, outer levels kept), `not-found`, or `idle` while stopped; `router.match(route)` returns a typed match.
- Links are intercepted at the document only for primary, unmodified clicks inside the base path. Modified clicks, `target`, `download`, `rel="external"`, other origins, and fragment links of the page behave natively.
- Back and forward, query and fragment changes, redirects (legacy routes), titles, `refresh()`, and stop/restart with the application are handled.
- After a navigation to another path, focus moves to `focus(state)` and the title is announced in a polite live region (`announce: false` or `announce: (state) => message` to change it). Scroll restoration: new paths start at the top, fragments scroll into view, and back, forward, and reloads return to where each entry was left (`scroll: false` to opt out).

## Page suspension (`@oddkin/app/lifecycle`)

Browsers keep pages in a back/forward cache and restore them with the same JavaScript heap. Suspension is not disposal: nothing is stopped or rebuilt when the user leaves, and nothing starts again when they return. Opt in with one service:

```js
import { createApp, pageLifecycle, resource } from '@oddkin/app';

const news = resource({ source: () => 'today', load, revalidateOnRestore: true });

createApp({
  setup({ app, scope, use }) {
    use(pageLifecycle(app)); // pagehide/pageshow/visibilitychange, once, for this run
    use(new LiveFeed()); // suspend() closes its socket, resume() opens a new one
    scope.use(news); // loads again after a restoration
  },
}).start();
```

- While the page is in the cache (or frozen, where the browser has `freeze`), the application is suspended: `app.suspend()` calls the services' `suspend()` in reverse order, and restoration calls their `resume()` in order. Nothing is disposed, no listener is registered again, and `unload` is never used.
- Resources keep their state unless they opt in with `revalidateOnRestore` (fresh data by `freshFor` is kept). Commands are never retried.
- `lifecycle.state` follows `{ visible, suspended, restorations }`. Importing the package adds no listener; components never watch the page lifecycle themselves.
- A real restoration is verified in Chromium; Playwright's Firefox and WebKit do not restore pages from the cache, so it is not verified there ([examples/lifecycle](../../examples/lifecycle/), `e2e/lifecycle.spec.ts`).
