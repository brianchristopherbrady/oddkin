# @oddkin/app

Optional application lifetime, router, and async resources. Components never need it.

**Status:** M6 in progress. Implemented: `./app` (`createApp`, re-exported from the root entry). Planned (M7): `./resource`, `./router`, page suspension. Contract: [core-contracts.md §9](../../docs/architecture/core-contracts.md); entries: [packages.md](../../docs/architecture/packages.md).

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
