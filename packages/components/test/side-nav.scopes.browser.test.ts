import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { flush } from '@oddkin/core/reactive';
import { generate } from '@oddkin/tokens/generate';
import type { OddkinSideNav } from '../src/side-nav/side-nav.js';
import '../src/side-nav/side-nav.define.js';

// odd-side-nav inside product, density, and mode scopes of a generated theme: the scopes
// re-declare roles on ancestors, and the element's shadow styles read them unchanged.

const themeSheet = new CSSStyleSheet();
beforeAll(() => {
  const { css } = generate({
    brand: { primary: '#6250e8' },
    products: { clinic: { brand: { primary: '#0f766e' } } },
  });
  themeSheet.replaceSync(css!);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, themeSheet];
  return () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== themeSheet);
  };
});

const roots: HTMLElement[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.remove();
  flush();
});

async function navIn(attributes: Record<string, string>) {
  const scope = document.createElement('div');
  for (const [name, value] of Object.entries(attributes)) scope.setAttribute(name, value);
  const nav = document.createElement('odd-side-nav') as OddkinSideNav;
  nav.items = [
    { id: 'a', kind: 'link', label: 'Current', href: '#a' },
    { id: 'b', kind: 'link', label: 'Other', href: '#b' },
  ];
  nav.current = 'a';
  scope.append(nav);
  document.body.append(scope);
  roots.push(scope);
  await nav.updateComplete;
  flush();
  const style = getComputedStyle(nav.shadowRoot!.querySelector('a[aria-current]')!);
  return {
    marker: style.borderInlineStartColor,
    padding: style.paddingInlineStart,
    height: style.minHeight,
    text: style.color,
  };
}

describe('odd-side-nav in generated theme scopes', () => {
  it('takes the product brand, the density spacing, and the mode colours from its ancestors', async () => {
    const base = await navIn({});
    const product = await navIn({ 'data-odd-product': 'clinic' });
    const compact = await navIn({ 'data-odd-density': 'compact' });
    const both = await navIn({ 'data-odd-product': 'clinic', 'data-odd-density': 'compact' });
    const dark = await navIn({ 'data-odd-mode': 'dark' });

    expect(product.marker).not.toBe(base.marker);
    expect(product.padding).toBe(base.padding);
    expect(parseFloat(compact.padding)).toBeLessThan(parseFloat(base.padding));
    expect(compact.marker).toBe(base.marker);
    expect(both.marker).toBe(product.marker);
    expect(both.padding).toBe(compact.padding);
    expect(dark.text).not.toBe(base.text);
  });

  it('nested scopes resolve to the innermost value', async () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-odd-product', 'clinic');
    document.body.append(outer);
    roots.push(outer);
    const inner = await navIn({ 'data-odd-density': 'compact' });
    const nested = document.createElement('div');
    nested.setAttribute('data-odd-density', 'compact');
    const nav = roots.at(-1)!.querySelector('odd-side-nav')!;
    nested.append(nav);
    outer.append(nested);
    await nav.updateComplete;
    const style = getComputedStyle(nav.shadowRoot!.querySelector('a[aria-current]')!);
    const product = await navIn({ 'data-odd-product': 'clinic' });
    expect(style.borderInlineStartColor).toBe(product.marker);
    expect(style.paddingInlineStart).toBe(inner.padding);
  });
});
