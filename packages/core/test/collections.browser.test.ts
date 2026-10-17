import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collection } from '../src/collections/index.js';
import { computed, flush, signal } from '../src/reactive/index.js';
import { createScope } from '../src/scope/index.js';
import { html, render, repeat } from '../src/template/index.js';

interface Item {
  id: string;
  label: string;
}

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  flush();
  container.remove();
});

const texts = () => [...container.querySelectorAll('li span')].map((s) => s.textContent);

describe('collections with repeat (cache invalidation)', () => {
  it('updates an item when an external signal it reads changes, with the same item object', () => {
    const items = collection<Item>({ key: (i) => i.id });
    const a = { id: 'a', label: 'Alpha' };
    items.set([a]);
    const locale = signal('en');
    render(
      html`<ul>
        ${repeat(
          items.flat,
          (e) => e.key,
          (e) => html`<li><span>${computed(() => `${locale.value}:${e.item.label}`)}</span></li>`,
        )}
      </ul>`,
      container,
    );
    expect(texts()).toEqual(['en:Alpha']);
    locale.value = 'fr';
    flush();
    expect(texts()).toEqual(['fr:Alpha']);
    expect(items.flat.value[0]?.item).toBe(a);
  });

  it('re-renders items when the renderer changes', () => {
    const items = collection<Item>({ key: (i) => i.id });
    items.set([{ id: 'a', label: 'Alpha' }]);
    const view = (renderer: (label: string) => string) =>
      html`<ul>
        ${repeat(
          items.flat,
          (e) => e.key,
          (e) => html`<li><span>${renderer(e.item.label)}</span></li>`,
        )}
      </ul>`;
    render(
      view((l) => l.toUpperCase()),
      container,
    );
    expect(texts()).toEqual(['ALPHA']);
    render(
      view((l) => l.toLowerCase()),
      container,
    );
    flush();
    expect(texts()).toEqual(['alpha']);
  });

  it('keeps focus and typed input state when items reorder', () => {
    const items = collection<Item>({ key: (i) => i.id });
    const a = { id: 'a', label: 'A' };
    const b = { id: 'b', label: 'B' };
    const c = { id: 'c', label: 'C' };
    items.set([a, b, c]);
    render(
      html`<ul>
        ${repeat(
          items.flat,
          (e) => e.key,
          (e) => html`<li><span>${e.item.label}</span><input data-key=${e.key} /></li>`,
        )}
      </ul>`,
      container,
    );
    const input = container.querySelector('input[data-key="b"]') as HTMLInputElement;
    input.value = 'typed';
    input.focus();
    items.set([c, b, a]);
    flush();
    expect(texts()).toEqual(['C', 'B', 'A']);
    expect(container.querySelector('input[data-key="b"]')).toBe(input);
    expect(input.value).toBe('typed');
    expect(document.activeElement).toBe(input);
  });

  it('disposes an entry’s scope and bindings when it is removed', () => {
    const owner = createScope();
    const items = collection<Item>({ key: (i) => i.id, owner });
    items.set([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);
    const ticks = signal(0);
    const cleaned: string[] = [];
    render(
      html`<ul>
        ${repeat(
          items.flat,
          (e) => e.key,
          (e) => {
            items.scopeFor(e.key, (scope) => scope.add(() => cleaned.push(String(e.key))));
            return html`<li><span>${computed(() => `${e.item.label}${ticks.value}`)}</span></li>`;
          },
        )}
      </ul>`,
      container,
    );
    items.set([{ id: 'b', label: 'B' }].map((x) => items.byKey('b')?.item ?? x));
    flush();
    expect(texts()).toEqual(['B0']);
    expect(cleaned).toEqual(['a']);
    owner.dispose();
    expect(cleaned).toEqual(['a', 'b']);
  });
});
