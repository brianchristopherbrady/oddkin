// A search resource over a signal, as an element would own it: @oddkin/app/resource alone.
import { createScope } from '@oddkin/core/scope';
import { signal } from '@oddkin/core/reactive';
import { resource } from '@oddkin/app/resource';

export const query = signal('');
const results = resource({
  source: () => query.value.trim() || undefined,
  load: async (q, { signal: abort }) => (await fetch(`/search?q=${q}`, { signal: abort })).json(),
  timeout: 10_000,
});
createScope().use(results);
results.state.subscribe((state) => globalThis.console.log(state.status));
