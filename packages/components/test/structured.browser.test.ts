import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { loadTheme, themeValue } from './probe.js';

// Agent 4's structured-content recipes (component-contracts.md §4), loaded as a page would load them
// from the built package (`dist/css/<name>.css`), with the shipped theme.
const RECIPES = ['typography', 'description-list'];
let links: HTMLLinkElement[] = [];
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
  links = await Promise.all(
    RECIPES.map(
      (name) =>
        new Promise<HTMLLinkElement>((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = new URL(`../dist/css/${name}.css`, import.meta.url).href;
          link.onload = () => resolve(link);
          link.onerror = reject;
          document.head.append(link);
        }),
    ),
  );
});
afterAll(() => {
  for (const link of links) link.remove();
  unload();
});

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
});
const mount = (markup: string, width = 640) => {
  container = document.createElement('div');
  container.style.inlineSize = `${width}px`;
  container.innerHTML = markup;
  document.body.append(container);
  return container.firstElementChild as HTMLElement;
};
const style = (el: Element) => getComputedStyle(el);
const box = (el: Element) => el.getBoundingClientRect();
const px = (property: string, variable: string) => parseFloat(themeValue(property, variable));

const rows = (pairs: [string, string][]) =>
  `<dl class="odd-description-list">${pairs
    .map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`)
    .join('')}</dl>`;
const PAIRS: [string, string][] = [
  ['Owner', 'Alex Morgan'],
  ['Workspace', 'Field notes'],
  ['Region', 'Pacific Northwest'],
  ['Workspace ID', 'ws_83f2a9'],
];

describe('description list recipe', () => {
  it('keeps the term and definition semantics of native <dl> markup', async () => {
    mount(rows(PAIRS));
    expect(page.getByRole('term').elements()).toHaveLength(4);
    expect(page.getByRole('definition').elements()).toHaveLength(4);
    await expect.element(page.getByRole('term').filter({ hasText: 'Owner' })).toBeVisible();
  });

  it('lines every value up on one term column as wide as the longest term', () => {
    const dl = mount(rows(PAIRS));
    const values = [...dl.querySelectorAll('dd')].map((dd) => box(dd).left);
    expect(new Set(values).size).toBe(1);
    const terms = [...dl.querySelectorAll('dt')];
    const widest = Math.max(...terms.map((dt) => box(dt).width));
    // Each pair sits on one line, the term column `space.xs` from the values.
    for (const dt of terms) expect(box(dt).top).toBe(box(dt.nextElementSibling!).top);
    expect(values[0]! - box(dl).left).toBeCloseTo(widest + px('gap', '--odd-space-xs'), 0);
  });

  it('caps the term column at --odd-description-list-term-width (33% by default); long terms wrap', () => {
    const long = 'Primary regional operations contact for environmental planning';
    let dl = mount(rows([[long, 'Alex Morgan'], ...PAIRS]));
    expect(box(dl.querySelector('dt')!).width).toBeCloseTo(640 * 0.33, 0);
    expect(box(dl.querySelector('dt')!).height).toBeGreaterThan(
      box(dl.querySelectorAll('dt')[1]!).height,
    );
    container.remove();
    dl = mount(rows(PAIRS));
    dl.style.setProperty('--odd-description-list-term-width', '40px');
    // Narrower than its longest word, the column stops at that word: \Workspace ID\ wraps.
    const [owner, , , id] = [...dl.querySelectorAll('dt')];
    expect(box(id!).height).toBeGreaterThan(box(owner!).height);
    expect(box(id!).width).toBeLessThan(box(dl).width * 0.2);
  });

  it('divides rows with a rule, `space.md` from each row', () => {
    const dl = mount(rows(PAIRS));
    const [first, second] = [...dl.children] as HTMLElement[];
    expect(style(first!).borderBlockStartStyle).toBe('none');
    expect(style(second!).borderBlockStartStyle).toBe('solid');
    expect(style(second!).borderBlockStartColor).toBe(
      themeValue('color', '--odd-color-border-default'),
    );
    expect(style(second!).borderBlockStartWidth).toBe(
      themeValue('inline-size', '--odd-border-width-default'),
    );
    const md = px('gap', '--odd-space-md');
    expect(parseFloat(style(second!).paddingBlockStart)).toBe(md);
    expect(box(second!).top - box(first!).bottom).toBe(md);
  });

  it('stacks each term above its value below 36rem of its own width, not of the viewport', () => {
    for (const [width, stacked] of [
      [800, false],
      [577, false],
      [576, true],
      [320, true],
    ] as const) {
      const dl = mount(rows(PAIRS), width);
      const dt = dl.querySelector('dt')!;
      const dd = dl.querySelector('dd')!;
      if (stacked) {
        expect(box(dd).top - box(dt).bottom, `${width}px`).toBe(px('gap', '--odd-space-xs'));
        expect(box(dd).left, `${width}px`).toBe(box(dl).left);
        expect(box(dd).width, `${width}px`).toBe(box(dl).width);
      } else expect(box(dd).top, `${width}px`).toBe(box(dt).top);
      container.remove();
    }
  });

  it('wraps long values inside the list, unbroken words included', () => {
    const dl = mount(
      rows([
        [
          'Region',
          'North America / Pacific Northwest / Regional operations / Environmental planning',
        ],
        ['Token', 'x'.repeat(200)],
      ]),
      400,
    );
    for (const dd of dl.querySelectorAll('dd'))
      expect(box(dd).right).toBeLessThanOrEqual(box(dl).right);
    expect(dl.scrollWidth).toBe(dl.clientWidth);
  });

  it('shows terms in the secondary UI role and values in the primary body role', () => {
    const dl = mount(rows(PAIRS));
    const dt = dl.querySelector('dt')!;
    const dd = dl.querySelector('dd')!;
    expect(style(dt).color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(style(dt).fontSize).toBe(themeValue('font-size', '--odd-type-ui-size'));
    expect(style(dd).color).toBe(themeValue('color', '--odd-color-text-primary'));
    expect(style(dd).fontSize).toBe(themeValue('font-size', '--odd-type-body-size'));
    expect(style(dd).marginInlineStart).toBe('0px');
    expect(style(dl).marginBlockStart).toBe('0px');
  });

  it('still pairs bare <dt> and <dd> children in the two columns', () => {
    const dl = mount(
      '<dl class="odd-description-list"><dt>Owner</dt><dd>Alex Morgan</dd><dt>Region</dt><dd>Pacific Northwest</dd></dl>',
    );
    const [dt1, dt2] = dl.querySelectorAll('dt');
    const [dd1, dd2] = dl.querySelectorAll('dd');
    expect(box(dd1!).top).toBe(box(dt1!).top);
    expect(box(dd2!).top).toBe(box(dt2!).top);
    expect(box(dd1!).left).toBe(box(dd2!).left);
  });
});

describe('typography recipe: balanced headings', () => {
  it('balances the heading roles where the engine supports it, and nothing else', () => {
    const root = mount(
      ['display', 'title', 'section', 'body']
        .map((r) => `<p class="odd-type-${r}">${r}</p>`)
        .join(''),
    ).parentElement!;
    const supported = CSS.supports('text-wrap', 'balance');
    for (const role of ['display', 'title', 'section'])
      expect(style(root.querySelector(`.odd-type-${role}`)!).textWrap === 'balance', role).toBe(
        supported,
      );
    expect(style(root.querySelector('.odd-type-body')!).textWrap).not.toBe('balance');
  });
});
