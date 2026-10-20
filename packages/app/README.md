# @oddkin/app

Optional application lifetime, router, and async resources. Components never need it.

**Status:** Implemented: `./app` (`createApp`, M6) and `./resource` (`resource`, M7), both re-exported from the root entry. Planned (M7): `./router`, commands, page suspension. Contract: [core-contracts.md §8–§9](../../docs/architecture/core-contracts.md); entries: [packages.md](../../docs/architecture/packages.md).

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
