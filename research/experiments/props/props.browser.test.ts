// Assessment of the props() prototype against the proposed contract (data-composition.md §2).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MoteElement, define, flush, html, prop, render, signal } from '@mote/core';
import { setErrorHandler, type ErrorContext } from '@mote/core/diagnostics';
import { props } from './props.js';

let reported: ErrorContext[];
let container: HTMLElement;

class PropsNav extends MoteElement.with({
  label: prop.string({ default: 'Navigation' }),
  current: prop.string({ default: '' }),
  items: prop.array<string>(),
}) {
  renders = 0;
  protected override render() {
    this.renders++;
    return html`<p>${this.label}: ${this.items.join(',')} [${this.current}]</p>`;
  }
}
define('props-nav', PropsNav);

const nav = () => container.querySelector('props-nav') as PropsNav;
const text = (el: Element | null) => el?.shadowRoot?.textContent?.replace(/\s+/g, ' ').trim();

beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context));
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  render(null, container);
  container.remove();
  flush();
  setErrorHandler(undefined);
});

describe('props() prototype', () => {
  it('sets declared properties from a configuration object; unknown keys are reported and skipped', () => {
    const config = { label: 'Primary', items: ['a', 'b'], onselect: () => {} };
    render(html`<props-nav .props=${props(config)}></props-nav>`, container);
    flush();
    expect(text(nav())).toBe('Primary: a,b []');
    expect(reported.map((r) => r.code)).toEqual(['props.key.unknown']);
    // A native event-handler property is not a declared property: no handler is wired.
    expect(nav().onselect).toBeNull();
  });

  it('readable values update the target without re-running the parent render', () => {
    const current = signal('a');
    let parentRenders = 0;
    const view = () => {
      parentRenders++;
      return html`<props-nav .props=${props({ items: ['a', 'b'], current })}></props-nav>`;
    };
    render(view(), container);
    current.value = 'b';
    flush();
    expect(text(nav())).toBe('Navigation: a,b [b]');
    expect(parentRenders).toBe(1);
  });

  it('a key removed between renders resets that property to its declared default', () => {
    const view = (config: Record<string, unknown>) =>
      html`<props-nav .props=${props(config)}></props-nav>`;
    render(view({ label: 'Primary', current: 'a' }), container);
    flush();
    render(view({ current: 'a' }), container);
    flush();
    expect([nav().label, nav().current]).toEqual(['Navigation', 'a']);
  });

  it('values set before the element is defined are replayed on upgrade (keys unchecked)', async () => {
    render(
      html`<props-late .props=${props({ label: 'Early', missing: 1 })}></props-late>`,
      container,
    );
    flush();
    define('props-late', class PropsLate extends PropsNav {});
    await (container.querySelector('props-late') as PropsNav).updateComplete;
    expect(text(container.querySelector('props-late'))).toBe('Early: []');
    // Unknown keys cannot be detected before definition: they stay as plain own properties.
    expect(reported).toEqual([]);
    expect((container.querySelector('props-late') as unknown as { missing: number }).missing).toBe(
      1,
    );
  });

  it('precedence with an explicit binding is source-order dependent (contract not met)', () => {
    const explicit = signal('Explicit');
    const fromProps = signal('From props');
    render(
      html`<props-nav .label=${explicit} .props=${props({ label: fromProps })}></props-nav>`,
      container,
    );
    flush();
    // The later binding in source order commits last.
    expect(nav().label).toBe('From props');
    explicit.value = 'Explicit 2';
    flush();
    // Whichever binding changed most recently wins; the contract wanted the explicit one always.
    expect(nav().label).toBe('Explicit 2');
  });
});
