# @oddkin/state

Optional stores, selectors, context, persistence, and inspection. Reusable components never need it: an application feature owns a store and hands values to components as properties.

**Status:** M6 in progress. Implemented: `./store` and `./context` (both re-exported from the root entry) and `./inspect`. Planned: `./persist`. Contract: [core-contracts.md §7](../../docs/architecture/core-contracts.md); entries: [packages.md](../../docs/architecture/packages.md).

## Stores (`@oddkin/state/store`, DOM-free)

```js
import { action, createStore, shallowEqual } from '@oddkin/state/store';

const cart = createStore({ items: [], coupon: '' }, { name: 'cart' });
const count = cart.select((state) => state.items.length); // memoized readable
const summary = cart.select((s) => ({ count: s.items.length, coupon: s.coupon }), {
  equals: shallowEqual,
});

export const addItem = action('cart/add', (item) => {
  cart.update((state) => ({ ...state, items: [...state.items, item] }));
});
```

- `cart.state` and selectors are ordinary Oddkin readables: bind them in templates (`${count}`), read them in effects, combine them with other signals. A selector follows the store only while something observes it, and notifies only when the selected value changes.
- `cart.getSnapshot` and `cart.subscribe` are the shared external-store contract, so `useSyncExternalStore(cart.subscribe, cart.getSnapshot)` in React and `fromExternal(cart)` in Oddkin take the store as is. Subscribers are notified once per `batch()` or `action()`.
- Every snapshot's plain objects and arrays are frozen in both builds, so mutating one throws. Build the next snapshot instead and keep unchanged parts by reference; replace maps and sets (`new Map(map).set(key, value)`). `createStore(initial, { freeze: false })` opts out.
- `reset()` returns to the initial snapshot; `dispose()` releases every subscriber, after which updates throw `state.store.disposed`.

## Context (`@oddkin/state/context`)

```js
import { consume, createContext, provide } from '@oddkin/state/context';

export const cartContext = createContext('cart');

// An application shell or any ancestor element provides a value (or a readable to follow):
class ShopShell extends OddkinElement {
  #provider = provide(this, cartContext, cart);
  connected(scope) {
    scope.use(this.#provider);
  }
}

// A descendant reads the nearest provider's value as a readable:
class CartBadge extends OddkinElement {
  cart = consume(this, cartContext, { required: true });
  connected(scope) {
    scope.use(this.cart);
  }
}
```

Requests use the community context protocol (`context-request` events), so they cross shadow roots and interoperate with other implementations such as Lit's. The nearest provider wins; a consumer moved elsewhere, or whose provider stops, finds the next provider; a provider that connects later is found too. `required: true` reports `state.context.missing` when nothing answers.

## Inspection (`@oddkin/state/inspect`)

```js
import { inspect, storeStats } from '@oddkin/state/inspect';

const inspector = inspect(cart, { limit: 20 });
addItem({ id: 'tea' });
inspector.updates; // [{ previous, next, actions: ['cart/add'] }]
storeStats(); // { stores, subscriptions } — live counts for leak tests
```

Stores carry only counters and one observer hook; nothing is recorded unless a store is inspected.
