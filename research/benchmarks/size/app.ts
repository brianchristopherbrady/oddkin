// An application root that owns a store and provides it as context: @oddkin/app/app.
import { createApp } from '@oddkin/app/app';
import { createContext } from '@oddkin/state/context';
import { createStore } from '@oddkin/state/store';

const cartContext = createContext<ReturnType<typeof createStore<{ items: string[] }>>>('cart');
export const shop = createApp({
  name: 'shop',
  root: document.body,
  setup({ scope, provide }) {
    const cart = createStore({ items: [] as string[] });
    scope.add(() => cart.dispose());
    provide(cartContext, cart);
    return { cart };
  },
});
shop.start();
