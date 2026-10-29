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
  const link = nav.shadowRoot!.querySelector('a[aria-current]')!;
  const style = getComputedStyle(link);
  return {
    marker: getComputedStyle(link, '::before').backgroundColor,
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
    const link = nav.shadowRoot!.querySelector('a[aria-current]')!;
    const style = getComputedStyle(link);
    const product = await navIn({ 'data-odd-product': 'clinic' });
    expect(getComputedStyle(link, '::before').backgroundColor).toBe(product.marker);
    expect(style.paddingInlineStart).toBe(inner.padding);
  });
});

describe('odd-side-nav sources render equivalently', () => {
  const LINKS = [
    ['Overview', '#overview'],
    ['Components', '#components'],
    ['A long label that wraps onto a second line in a narrow navigation', '#long'],
  ] as const;

  async function mount(setup: (nav: OddkinSideNav) => void, markup = '') {
    const nav = document.createElement('odd-side-nav') as OddkinSideNav;
    nav.label = 'Primary';
    nav.innerHTML = markup;
    setup(nav);
    const frame = document.createElement('div');
    frame.style.inlineSize = '16rem';
    frame.append(nav);
    document.body.append(frame);
    roots.push(frame);
    await nav.updateComplete;
    flush();
    return nav;
  }
  const fromData = (nav: OddkinSideNav) => {
    nav.items = LINKS.map(([label, href], i) => ({ id: `l${i}`, kind: 'link', label, href }));
    nav.current = 'l1';
  };
  const slottedMarkup = LINKS.map(
    ([label, href], i) => `<a href="${href}"${i === 1 ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
  const project = (a: HTMLAnchorElement) => [
    a.textContent?.trim(),
    a.getAttribute('href'),
    a.getAttribute('aria-current'),
  ];
  const box = (a: Element) => {
    const s = getComputedStyle(a);
    const bar = getComputedStyle(a, '::before');
    return [
      s.display,
      s.alignItems,
      s.minHeight,
      s.paddingInlineStart,
      s.paddingBlockStart,
      bar.content,
      bar.width,
      bar.height,
      bar.backgroundColor,
      s.borderTopLeftRadius,
      s.backgroundColor,
      s.color,
      s.fontSize,
      s.fontWeight,
      s.lineHeight,
      s.textDecorationLine,
      Math.round(a.getBoundingClientRect().height),
    ];
  };

  it('data, slotted, and hybrid sources expose the same links with the same computed boxes', async () => {
    const data = await mount(fromData);
    const slotted = await mount(() => {}, slottedMarkup);
    const hybrid = await mount(
      fromData,
      '<strong slot="header">Acme</strong><small slot="footer">Signed in</small>',
    );
    const dataLinks = [...data.shadowRoot!.querySelectorAll('a')];
    const slottedLinks = [...slotted.querySelectorAll('a')];
    const hybridLinks = [...hybrid.shadowRoot!.querySelectorAll('a')];
    expect(slottedLinks.map(project)).toEqual(dataLinks.map(project));
    expect(hybridLinks.map(project)).toEqual(dataLinks.map(project));
    for (let i = 0; i < LINKS.length; i++) {
      expect(box(slottedLinks[i]!), `slotted link ${i}`).toEqual(box(dataLinks[i]!));
      expect(box(hybridLinks[i]!), `hybrid link ${i}`).toEqual(box(dataLinks[i]!));
    }
    for (const nav of [data, slotted, hybrid])
      expect(nav.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).toBe('Primary');
    expect(hybrid.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.hidden).toBe(false);
    expect(hybrid.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!.hidden).toBe(false);
    // Data entries are list items; slotted links keep the author's markup (no list here).
    expect(data.shadowRoot!.querySelectorAll('li')).toHaveLength(LINKS.length);
  });
});
