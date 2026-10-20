// A search element on a resource (core-contracts.md §8, the M7 acceptance example): typing
// supersedes requests, stale responses never render, and disconnecting cancels the request with
// no cleanup code in the element.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OddkinElement, define } from '@oddkin/core/element';
import { flush, signal } from '@oddkin/core/reactive';
import { scopeStats, type Scope } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';
import { resource } from '../src/resource/index.js';

/** Stands in for fetch: one request per call, settled by the test; rejects with the abort reason. */
const requests: {
  url: string;
  signal: AbortSignal;
  respond(items: string[]): void;
}[] = [];
function fakeFetch(url: string, init: { signal: AbortSignal }) {
  return new Promise<{ json(): Promise<string[]> }>((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
    requests.push({
      url,
      signal: init.signal,
      respond: (items) => resolve({ json: async () => items }),
    });
  });
}

class ResourceSearch extends OddkinElement {
  readonly query = signal('');
  readonly results = resource({
    name: 'search',
    source: () => this.query.value.trim() || undefined,
    load: async (query, { signal: abort }) => {
      const response = await fakeFetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: abort,
      });
      return response.json();
    },
  });
  protected override connected(scope: Scope) {
    scope.use(this.results);
  }
  protected override render() {
    const state = this.results.state.value;
    const shown =
      state.status === 'success'
        ? state.value.join(', ')
        : state.status === 'pending' && state.previous
          ? `${state.previous.value.join(', ')} (updating)`
          : state.status;
    return html`<output>${shown}</output>`;
  }
}
define('resource-search', ResourceSearch);

let container: HTMLElement;
const unhandled: unknown[] = [];
const onUnhandled = (event: PromiseRejectionEvent) => unhandled.push(event.reason);
beforeEach(() => {
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

const shown = async (el: ResourceSearch) => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await el.updateComplete;
  return el.shadowRoot!.querySelector('output')!.textContent;
};

describe('a search element on a resource', () => {
  it('supersedes requests while typing, keeps stale responses out, and cancels on disconnect', async () => {
    const baseline = scopeStats();
    const el = document.createElement('resource-search') as ResourceSearch;
    container.append(el);
    expect(await shown(el)).toBe('idle');
    expect(requests).toHaveLength(0);

    el.query.value = 'te';
    expect(await shown(el)).toBe('pending');
    el.query.value = 'tea';
    expect(await shown(el)).toBe('pending');
    expect(requests.map((r) => r.url)).toEqual(['/api/search?q=te', '/api/search?q=tea']);
    expect(requests[0]!.signal.aborted).toBe(true);

    requests[1]!.respond(['green tea', 'black tea']);
    expect(await shown(el)).toBe('green tea, black tea');
    requests[0]!.respond(['teapot']); // the superseded request answers last
    expect(await shown(el)).toBe('green tea, black tea');

    el.query.value = 'teapot';
    expect(await shown(el)).toBe('green tea, black tea (updating)');
    el.remove(); // no cleanup code in the element: its connection scope owns the request
    flush();
    expect(requests[2]!.signal.aborted).toBe(true);
    expect((requests[2]!.signal.reason as DOMException).message).toContain('resource-search');
    expect(scopeStats()).toEqual(baseline);

    container.append(el); // reconnecting loads the current query again
    expect(await shown(el)).toBe('green tea, black tea (updating)');
    requests[3]!.respond(['teapot']);
    expect(await shown(el)).toBe('teapot');
    el.remove();
    flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  });
});
