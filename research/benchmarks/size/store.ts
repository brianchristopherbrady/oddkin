// A shared store with a selector, updates, and a named action: @oddkin/state/store alone.
import { action, createStore } from '@oddkin/state/store';

const cart = createStore({ items: [] as readonly string[], coupon: '' });
const count = cart.select((state) => state.items.length);
export const add = action('cart/add', (item: string) =>
  cart.update((state) => ({ ...state, items: [...state.items, item] })),
);
count.subscribe((n) => globalThis.console.log(n));
