import { afterEach, describe, expect, it } from 'vitest';

// How each engine resolves ARIA relationships across shadow boundaries (css-architecture.md §12.1,
// composite widgets). Reflection getters return only references the engine considers valid.

let host: HTMLElement;

afterEach(() => host?.remove());

function element(tag: string, attributes: Record<string, string> = {}): HTMLElement {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** A host with a shadow root holding a combobox and a listbox, and one light-DOM option. */
function composite() {
  host = element('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const input = element('input', { role: 'combobox' });
  const list = element('div', { id: 'list', role: 'listbox' });
  const inner = element('div', { id: 'inner-option', role: 'option' });
  list.append(inner);
  root.append(input, list);
  const light = element('div', { id: 'light-option', role: 'option' });
  host.append(light);
  return { root, input, list, inner, light };
}

let tags = 0;
function internalsHost() {
  const tag = `aria-ref-host-${++tags}`;
  class Host extends HTMLElement {
    readonly internals = this.attachInternals();
  }
  customElements.define(tag, Host);
  host = document.createElement(tag);
  document.body.append(host);
  return host as Host;
}

describe('ARIA references across shadow boundaries (composite widgets)', () => {
  it('reflects ARIA element references on elements and ElementInternals', () => {
    const names = [
      'ariaActiveDescendantElement',
      'ariaControlsElements',
      'ariaLabelledByElements',
      'ariaDescribedByElements',
    ];
    expect(names.filter((name) => !(name in Element.prototype))).toEqual([]);
    expect(names.filter((name) => !(name in ElementInternals.prototype))).toEqual([]);
  });

  it('resolves ID references inside one shadow root', () => {
    const { input, list, inner } = composite();
    input.setAttribute('aria-controls', 'list');
    input.setAttribute('aria-activedescendant', 'inner-option');
    expect(input.ariaControlsElements).toEqual([list]);
    expect(input.ariaActiveDescendantElement).toBe(inner);
  });

  it('does not resolve ID references from a shadow root to the light DOM, or into a shadow root', () => {
    const { input, light } = composite();
    input.setAttribute('aria-activedescendant', 'light-option');
    expect(input.ariaActiveDescendantElement).toBeNull();
    light.setAttribute('aria-controls', 'list');
    expect(light.ariaControlsElements ?? []).toEqual([]);
  });

  it('resolves element references from a shadow root outward to the light DOM', () => {
    const { input, light } = composite();
    input.ariaActiveDescendantElement = light;
    expect(input.ariaActiveDescendantElement).toBe(light);
  });

  it('drops element references from the light DOM into a shadow root', () => {
    const { list, light } = composite();
    light.ariaControlsElements = [list];
    expect(light.ariaControlsElements ?? []).not.toContain(list);
  });

  it('resolves element references from a nested shadow root to its host tree', () => {
    const { root, list } = composite();
    const nested = element('div');
    root.append(nested);
    const trigger = element('button');
    nested.attachShadow({ mode: 'open' }).append(trigger);
    trigger.ariaControlsElements = [list];
    expect(trigger.ariaControlsElements).toEqual([list]);
  });

  it('lets a host carry the composite role through ElementInternals over its light-DOM children', () => {
    const owner = internalsHost();
    owner.internals.role = 'listbox';
    const option = element('div', { role: 'option' });
    const label = element('span');
    owner.append(label, option);
    owner.internals.ariaActiveDescendantElement = option;
    owner.internals.ariaLabelledByElements = [label];
    expect(owner.internals.ariaActiveDescendantElement).toBe(option);
    expect(owner.internals.ariaLabelledByElements).toEqual([label]);
  });
});
