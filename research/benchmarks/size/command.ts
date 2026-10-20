// A mutation with an explicit retry policy, as an element or application would own it:
// @oddkin/app/command alone.
import { createScope } from '@oddkin/core/scope';
import { command } from '@oddkin/app/command';

const save = command({
  name: 'save',
  run: async (body: string, { signal }) => {
    const response = await fetch('/api/notes', { method: 'POST', body, signal });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  },
  retry: { retries: 2, when: (error) => String(error).includes('503'), delay: (n) => 250 * n },
  timeout: 10_000,
});
createScope().use(save);
save.state.subscribe((state) => globalThis.console.log(state.status));
export const submit = (body: string) => save.run(body);
