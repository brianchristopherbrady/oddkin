// A cart element on a command (core-contracts.md §8, the M7 command example): an optimistic
// addition is rolled back only when the server refuses it; a cancellation rolls nothing back and
// reads the cart again, because the server may have added the item anyway; and an explicit retry
// policy repeats only the failure that is safe to repeat.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OddkinElement, define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { scopeStats, type Scope } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';
import { createStore } from '@oddkin/state/store';
import { command } from '../src/command/index.js';
import { resource } from '../src/resource/index.js';

interface Item {
  readonly id: string;
  readonly name: string;
}

class HttpError extends Error {
  override name = 'HttpError';
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

/** The server's cart. It deduplicates additions on the item id, so repeating a POST is safe. */
let serverItems: readonly Item[] = [];
interface Request {
  readonly method: 'GET' | 'POST';
  readonly item: Item | undefined;
  readonly signal: AbortSignal;
  /** The server processes the request (200) or refuses it; the client may have stopped waiting. */
  respond(status?: number): void;
}
const requests: Request[] = [];

/** Stands in for fetch: rejects with the abort reason, while the server may still process it. */
function api(method: Request['method'], item: Item | undefined, signal: AbortSignal) {
  return new Promise<readonly Item[]>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
    requests.push({
      method,
      item,
      signal,
      respond(status = 200) {
        if (status !== 200) return reject(new HttpError(status));
        if (item && !serverItems.some((i) => i.id === item.id))
          serverItems = [...serverItems, item];
        resolve(serverItems);
      },
    });
  });
}

const tea: Item = { id: 'tea', name: 'Tea' };
const cake: Item = { id: 'cake', name: 'Cake' };
const jam: Item = { id: 'jam', name: 'Jam' };

class CommandCart extends OddkinElement {
  /** What the user sees: the server's cart, plus an optimistic addition. */
  readonly items = createStore<readonly Item[]>([]);
  readonly cart = resource({
    name: 'cart',
    source: () => 'cart',
    load: (_key: string, { signal }) => api('GET', undefined, signal),
  });
  readonly add = command({
    name: 'add to cart',
    run: (item: Item, { signal }) => api('POST', item, signal),
    // Only a 503 is retried: the server did not process the request (and deduplicates anyway).
    retry: {
      retries: 2,
      when: (error) => error instanceof HttpError && error.status === 503,
      delay: (attempt) => 10 * attempt,
    },
  });

  protected override connected(scope: Scope) {
    scope.use(this.cart);
    scope.use(this.add);
    // Whenever the server's cart is read, it replaces what the user sees.
    scope.effect(() => {
      const cart = this.cart.state.value;
      if (cart.status === 'success') this.items.update(() => cart.value);
    });
  }

  async addItem(item: Item): Promise<void> {
    this.items.update((items) => [...items, item]); // optimistic
    const rollBack = () => this.items.update((items) => items.filter((i) => i.id !== item.id));
    const outcome = await this.add.run(item);
    switch (outcome.status) {
      case 'success':
        this.items.update(() => outcome.value); // the server's cart, with the item
        break;
      case 'error':
        // An answer from the server says it did not add the item: roll back. A failure without an
        // answer leaves the outcome unknown, as a cancellation does.
        if (outcome.error instanceof HttpError) rollBack();
        else this.cart.refresh();
        break;
      case 'cancelled':
        // The client stopped waiting; the server may have added it anyway. Nothing is rolled
        // back: read the cart again.
        this.cart.refresh();
        break;
      case 'dropped':
        rollBack(); // never sent
    }
  }

  protected override render() {
    const adding = this.add.state.value;
    const cart = this.cart.state.value;
    const busy = adding.status === 'pending' || cart.status === 'pending';
    const status =
      adding.status === 'pending'
        ? adding.attempt > 1
          ? `Retrying ${adding.input.name} (attempt ${adding.attempt})`
          : `Adding ${adding.input.name}`
        : adding.status === 'error'
          ? `Could not add ${adding.input.name}: ${(adding.error as Error).message}`
          : adding.status === 'cancelled'
            ? cart.status === 'pending'
              ? `Cancelled; checking whether ${adding.input.name} was added`
              : 'Cancelled'
            : adding.status === 'success'
              ? `Added ${adding.input.name}`
              : '';
    return html`
      <output>${this.items.state.value.map((i) => i.name).join(', ') || 'empty'}</output>
      <p role="status">${status}</p>
      <button type="button" data-add="tea" ?disabled=${busy} @click=${() => this.addItem(tea)}>
        Add tea
      </button>
      <button type="button" data-add="cake" ?disabled=${busy} @click=${() => this.addItem(cake)}>
        Add cake
      </button>
      <button type="button" data-add="jam" ?disabled=${busy} @click=${() => this.addItem(jam)}>
        Add jam
      </button>
      <button
        type="button"
        data-cancel
        ?disabled=${adding.status !== 'pending'}
        @click=${() => this.add.cancel()}
      >
        Cancel
      </button>
    `;
  }
}
define('command-cart', CommandCart);

let container: HTMLElement;
const unhandled: unknown[] = [];
const onUnhandled = (event: PromiseRejectionEvent) => unhandled.push(event.reason);
beforeEach(() => {
  serverItems = [];
  requests.length = 0;
  unhandled.length = 0;
  window.addEventListener('unhandledrejection', onUnhandled);
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  window.removeEventListener('unhandledrejection', onUnhandled);
  container.remove();
  flush();
});

const view = async (el: CommandCart) => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await el.updateComplete;
  const root = el.shadowRoot!;
  return {
    cart: root.querySelector('output')!.textContent,
    status: root.querySelector('[role="status"]')!.textContent,
  };
};
const button = (el: CommandCart, selector: string) =>
  el.shadowRoot!.querySelector<HTMLButtonElement>(selector)!;
/** Wait (real timers) until the fake server has received `count` requests. */
const requestCount = async (count: number) => {
  for (let i = 0; i < 100 && requests.length < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(requests).toHaveLength(count);
};

describe('a cart element on a command', () => {
  it('rolls back only what the server refused; a cancellation reads the cart again', async () => {
    const el = document.createElement('command-cart') as CommandCart;
    container.append(el);
    await view(el);
    expect(button(el, '[data-add="tea"]').disabled).toBe(true); // the cart is loading
    requests[0]!.respond();
    expect(await view(el)).toEqual({ cart: 'empty', status: '' });

    // A 503 is retried under the policy, with the same item (the server deduplicates on its id).
    button(el, '[data-add="tea"]').click();
    expect(await view(el)).toEqual({ cart: 'Tea', status: 'Adding Tea' });
    expect(button(el, '[data-add="cake"]').disabled).toBe(true); // one addition at a time
    requests[1]!.respond(503);
    expect(await view(el)).toEqual({ cart: 'Tea', status: 'Retrying Tea (attempt 2)' });
    await requestCount(3);
    expect(requests[2]).toMatchObject({ method: 'POST', item: tea });
    requests[2]!.respond();
    expect(await view(el)).toEqual({ cart: 'Tea', status: 'Added Tea' });

    // A refusal is not retried, and the optimistic item is rolled back.
    button(el, '[data-add="cake"]').click();
    expect(await view(el)).toEqual({ cart: 'Tea, Cake', status: 'Adding Cake' });
    requests[3]!.respond(409);
    expect(await view(el)).toEqual({ cart: 'Tea', status: 'Could not add Cake: HTTP 409' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(requests).toHaveLength(4);

    // Cancelling stops waiting and rolls nothing back; the cart is read again.
    button(el, '[data-add="cake"]').click();
    expect(await view(el)).toEqual({ cart: 'Tea, Cake', status: 'Adding Cake' });
    button(el, '[data-cancel]').click();
    expect(await view(el)).toEqual({
      cart: 'Tea, Cake',
      status: 'Cancelled; checking whether Cake was added',
    });
    expect(requests[4]!.signal.aborted).toBe(true);
    expect(requests[5]).toMatchObject({ method: 'GET' });
    requests[4]!.respond(); // the server processed the cancelled request anyway
    requests[5]!.respond();
    expect(await view(el)).toEqual({ cart: 'Tea, Cake', status: 'Cancelled' });
    expect(serverItems).toEqual([tea, cake]);

    el.remove();
    flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  });

  it("disconnecting cancels the pending addition with the element's reason", async () => {
    const baseline = scopeStats();
    const el = document.createElement('command-cart') as CommandCart;
    container.append(el);
    await view(el);
    requests[0]!.respond();
    await view(el);
    button(el, '[data-add="jam"]').click();
    expect(await view(el)).toEqual({ cart: 'Jam', status: 'Adding Jam' });

    el.remove(); // no cleanup code in the element: its connection scope owns the run
    flush();
    expect(requests[1]!.signal.aborted).toBe(true);
    expect((requests[1]!.signal.reason as DOMException).message).toContain('command-cart');
    expect(el.add.state.value.status).toBe('cancelled');
    // The addition's continuation runs while disconnected: its refresh() does nothing.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requests).toHaveLength(2);
    expect(scopeStats()).toEqual(baseline);

    container.append(el); // reconnecting reads the cart again: the server never got the jam
    await view(el);
    requests[2]!.respond();
    expect((await view(el)).cart).toBe('empty');
    el.remove();
    flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
    expect(scopeStats()).toEqual(baseline);
  });
});
