# @oddkin/app

Optional application lifetime, router, and async resources. Components never need it.

**Status:** Implemented: `./app` (`createApp`, M6), `./resource` (`resource`, M7), and `./command` (`command`, M7), all re-exported from the root entry. Planned (M7): `./router`, page suspension. Contract: [core-contracts.md §8–§9](../../docs/architecture/core-contracts.md); entries: [packages.md](../../docs/architecture/packages.md).

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
