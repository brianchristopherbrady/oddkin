import { afterEach, describe, expect, it } from 'vitest';
import { flush } from '@oddkin/core/reactive';
import { generate } from '@oddkin/tokens/generate';
import { defineLayoutRecipe, grid, stack } from '../src/layout/index.js';
import type { OddkinSideNav } from '../src/side-nav/side-nav.js';
import '../src/side-nav/side-nav.define.js';

// Condition thresholds are compiled into query text (theming-and-styling.md §11, "Invalidation"):
// runtime custom properties never move them; a changed threshold needs regenerated CSS.

const frames: HTMLElement[] = [];
afterEach(() => {
  for (const frame of frames.splice(0)) frame.remove();
  flush();
});
function frame(width: string): HTMLElement {
  const el = document.createElement('div');
  el.style.inlineSize = width;
  document.body.append(el);
  frames.push(el);
  return el;
}
const display = (host: Element) =>
  getComputedStyle(host.shadowRoot!.querySelector('.content')!).display;

/** The theme's `navigation.expanded` condition, as recipes receive it. */
function conditionsFor(minInlineSize: string) {
  const { theme } = generate({
    brand: { primary: '#6250e8' },
    conditions: { 'navigation.expanded': { container: 'side-nav', minInlineSize } },
  });
  return Object.fromEntries(theme!.conditions);
}

describe('condition thresholds', () => {
  it('runtime custom properties never move the side navigation threshold', async () => {
    const host = frame('39rem');
    const nav = document.createElement('odd-side-nav') as OddkinSideNav;
    nav.items = [{ id: 'a', kind: 'link', label: 'A', href: '#a' }];
    host.append(nav);
    await nav.updateComplete;
    expect(display(nav)).toBe('flex');
    for (const [name, value] of [
      ['--odd-layout-sidebar-width', '1rem'],
      ['--odd-layout-main-min', '1rem'],
      ['--odd-navigation-item-gap', '0'],
      ['font-size', '8px'],
    ] as const)
      nav.style.setProperty(name, value);
    // `rem` thresholds follow the root font size, not the element's.
    expect(display(nav)).toBe('flex');
    host.style.inlineSize = '40rem';
    expect(display(nav)).toBe('grid');
  });

  it('a changed theme threshold reaches a recipe only through newly generated CSS', () => {
    const recipe = (conditions: ReturnType<typeof conditionsFor>) =>
      defineLayoutRecipe({
        name: 'threshold-probe',
        container: { name: 'side-nav' },
        regions: { root: stack(), content: stack() },
        when: { 'navigation.expanded': { content: grid({ columns: 3 }) } },
        conditions,
      });
    const before = recipe(conditionsFor('40rem'));
    const sheet = before.styles.sheetFor(document)!;
    const rules = () => [...sheet.cssRules].map((r) => r.cssText).join('\n');
    const original = rules();
    const after = recipe(conditionsFor('30rem'));
    expect(before.cssText).toContain('min-inline-size: 40rem');
    expect(after.cssText).toContain('min-inline-size: 30rem');
    expect(after.cssText.replace('30rem', '40rem')).toBe(before.cssText);
    // The earlier stylesheet is untouched; elements using it keep the old threshold.
    expect(rules()).toBe(original);

    const mount = (styles: CSSStyleSheet) => {
      const host = document.createElement('div');
      host.attachShadow({ mode: 'open' }).innerHTML =
        '<div class="root"><div class="content"></div></div>';
      host.shadowRoot!.adoptedStyleSheets = [styles];
      frame('35rem').append(host);
      return host;
    };
    expect(display(mount(sheet))).toBe('flex');
    expect(display(mount(after.styles.sheetFor(document)!))).toBe('grid');
  });
});
