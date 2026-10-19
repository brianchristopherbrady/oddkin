import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import '../src/button/button.define.js';
import '../src/card/card.define.js';
import '../src/input/input.define.js';
import '../src/side-nav/side-nav.define.js';
import type { OddkinSideNav } from '../src/side-nav/side-nav.js';
import { ITEMS } from './framework-fixtures.js';

// Each component adds exactly the Tab stops its native equivalent has: no focusable host on top
// of the inner control, nothing unreachable. Comparing with native markup in the same engine
// absorbs engine defaults (WebKit leaves links out of the Tab order).

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const COMPONENTS = `
  <button data-stop="start">Start</button>
  <odd-button data-stop="save">Save</odd-button>
  <odd-button data-stop="off" disabled>Off</odd-button>
  <odd-button data-stop="busy" loading>Busy</odd-button>
  <odd-button data-stop="icon" label="Close"><span slot="start" aria-hidden="true">x</span></odd-button>
  <odd-input data-stop="name" label="Name"></odd-input>
  <odd-input data-stop="locked" label="Locked" disabled></odd-input>
  <odd-input data-stop="ref" label="Reference" readonly value="A-1"></odd-input>
  <fieldset disabled><odd-input data-stop="grouped" label="Grouped"></odd-input></fieldset>
  <odd-card data-stop="card" label="Card"><button data-stop="inside">Inside</button></odd-card>
  <odd-card data-stop="plain"><p>Text only</p></odd-card>
  <odd-side-nav data-stop="nav" label="Primary"></odd-side-nav>
  <button data-stop="end">End</button>`;

const NATIVE = `
  <button data-stop="start">Start</button>
  <button data-stop="save">Save</button>
  <button data-stop="off" disabled>Off</button>
  <button data-stop="busy" aria-disabled="true">Busy</button>
  <button data-stop="icon" aria-label="Close"><span aria-hidden="true">x</span></button>
  <input data-stop="name" aria-label="Name">
  <input data-stop="locked" aria-label="Locked" disabled>
  <input data-stop="ref" aria-label="Reference" readonly value="A-1">
  <fieldset disabled><input data-stop="grouped" aria-label="Grouped"></fieldset>
  <section data-stop="card" aria-label="Card"><button data-stop="inside">Inside</button></section>
  <div data-stop="plain"><p>Text only</p></div>
  <nav data-stop="nav" aria-label="Primary"><ul>
    <li><a href="#overview">Overview</a></li>
    <li><button aria-expanded="false">Guides</button>
      <ul hidden><li><a href="#theming">Theming</a></li></ul></li>
    <li><button>Create project</button></li>
  </ul></nav>
  <button data-stop="end">End</button>`;

/** The focused element inside any shadow roots. */
function deepActive(): Element | null {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

/** `<stop>:<focused element>`, where stop is the nearest `data-stop` across shadow boundaries. */
function describeStop(el: Element): string {
  let node: Node | null = el;
  while (node && !(node instanceof Element && node.hasAttribute('data-stop')))
    node = node.parentNode ?? (node as ShadowRoot).host ?? null;
  return `${(node as Element | null)?.getAttribute('data-stop')}:${el.localName}`;
}

async function tabStops(markup: string): Promise<string[]> {
  container.innerHTML = markup;
  const nav = container.querySelector<OddkinSideNav>('odd-side-nav');
  if (nav) nav.items = ITEMS;
  for (const el of container.querySelectorAll<Element & { updateComplete?: Promise<void> }>('*'))
    await el.updateComplete;
  flush();
  container.querySelector<HTMLElement>('[data-stop="start"]')!.focus();
  const stops: string[] = [];
  for (let i = 0; i < 30; i++) {
    await userEvent.tab();
    const stop = describeStop(deepActive()!);
    stops.push(stop);
    if (stop.startsWith('end:')) break;
  }
  return stops;
}

describe('keyboard targets', () => {
  // Concurrent test pages can take keyboard focus mid-walk under full-suite load; a real
  // regression fails every attempt.
  it(
    'components add the same Tab stops, in the same order, as their native equivalents',
    { retry: 2 },
    async () => {
      const native = await tabStops(NATIVE);
      const components = await tabStops(COMPONENTS);
      expect(native.at(-1)).toBe('end:button');
      expect(components).toEqual(native);
      // Shift+Tab walks the same stops back.
      const back: string[] = [];
      for (let i = 0; i < components.length - 1; i++) {
        await userEvent.tab({ shift: true });
        back.push(describeStop(deepActive()!));
      }
      expect(back).toEqual(components.slice(0, -1).reverse());
    },
  );
});
