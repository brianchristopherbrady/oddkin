import { describe, expect, it } from 'vitest';
import {
  compare,
  expectNone,
  figma,
  mount,
  settle,
  useParity,
  useRecipeStyles,
  variantIndex,
  type Target,
} from './parity.js';

// Figma parity for the layout classes of layout.css and the layout elements (component-contracts.md §1, §4; the owner's
// Oddkin/Layout/* families, section 457:2078 on page 158:22, snapshot 2026-10-23). Each family's
// bound gaps and insets equal the tokens Figma binds, and each review panel's response at 320, 640,
// and 960 px holds (Review · 01–10): the outcomes are read from the families' descriptions.
useParity();
useRecipeStyles(['layout']);

const WIDTHS = [320, 640, 960] as const;
const at = (width: number, markup: string) =>
  mount(`<div style="inline-size: ${width}px">${markup}</div>`).firstElementChild as HTMLElement;
const items = (n: number, style = '') =>
  Array.from({ length: n }, (_, i) => `<div style="${style}">Child ${i + 1}</div>`).join('');
const rows = (el: Element) =>
  new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().top))).size;
/** Removes what `mount` added for `el`. */
const done = (el: Element) => {
  let node = el;
  while (node.parentElement && node.parentElement !== document.body) node = node.parentElement;
  node.remove();
};
const columns = (el: Element) =>
  new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().left))).size;

describe('Figma parity: layout classes (Oddkin/Layout/*)', () => {
  it('Box: the inset is layout.inset, and None and Roomy use space.none and space.xl', () => {
    const family = figma.get('Oddkin/Layout/Box')!;
    for (const [inset, modifier] of [
      ['Default', ''],
      ['None', ' odd-box-none'],
      ['Roomy', ' odd-box-roomy'],
    ] as const) {
      variantIndex(family, { Inset: inset });
      const box = mount(`<div class="odd-box${modifier}">${items(1)}</div>`);
      expectNone(compare(family.name, { Inset: inset }, [{ layer: [], el: box, kind: 'frame' }]));
      done(box);
    }
  });

  it('Stack: the gap is layout.gap, and Tight and Loose use space.xs and space.lg', () => {
    for (const [gap, modifier] of [
      ['Default', ''],
      ['Tight', ' odd-stack-tight'],
      ['Loose', ' odd-stack-loose'],
    ] as const) {
      const stack = mount(`<div class="odd-stack${modifier}">${items(2)}</div>`);
      const targets: Target[] = [
        { layer: [], el: stack, kind: 'frame' },
        { layer: ['Content'], el: stack, kind: 'frame', gap: 'row-gap' },
      ];
      expectNone(compare('Oddkin/Layout/Stack', { Gap: gap }, targets));
      // Children keep the full width.
      expect(stack.lastElementChild!.getBoundingClientRect().width).toBe(
        stack.getBoundingClientRect().width,
      );
      done(stack);
    }
  });

  it('Row: layout.gap, centred on the cross axis, without wrapping; Between spreads the children', () => {
    for (const [justify, modifier] of [
      ['Start', ''],
      ['Between', ' odd-row-between'],
    ] as const) {
      for (const width of WIDTHS) {
        const row = at(
          width,
          `<div class="odd-row${modifier}">${items(3, 'inline-size: 80px')}</div>`,
        );
        if (width === 320)
          expectNone(
            compare('Oddkin/Layout/Row', { Justify: justify }, [
              { layer: ['Content'], el: row, kind: 'frame', gap: 'column-gap' },
            ]),
          );
        expect(rows(row)).toBe(1);
        const [first, , last] = [...row.children].map((c) => c.getBoundingClientRect());
        expect(first!.width).toBe(80);
        if (justify === 'Between') expect(last!.right).toBe(row.getBoundingClientRect().right);
        else expect(last!.right).toBe(row.getBoundingClientRect().left + 3 * 80 + 2 * 16);
        done(row);
      }
    }
  });

  it('Cluster: layout.gap in both axes; six 96 px children wrap to 2, 2, and 1 rows', () => {
    const expected = { 320: 2, 640: 2, 960: 1 };
    for (const width of WIDTHS) {
      const cluster = at(width, `<div class="odd-cluster">${items(6, 'inline-size: 96px')}</div>`);
      expectNone(
        compare('Oddkin/Layout/Cluster', {}, [
          {
            layer: ['Content'],
            el: cluster,
            kind: 'frame',
            gap: 'column-gap',
            fields: [['counterAxisSpacing', 'row-gap']],
          },
        ]),
      );
      expect(rows(cluster), `${width}px`).toBe(expected[width]);
      done(cluster);
    }
  });

  it('Grid: layout.gap between equal columns; Columns 1–4 hold at every width', () => {
    for (const count of [1, 2, 3, 4]) {
      for (const width of WIDTHS) {
        const grid = at(
          width,
          `<div class="odd-grid" style="--odd-grid-columns: ${count}">${items(6)}</div>`,
        );
        expectNone(
          compare('Oddkin/Layout/Grid', { Columns: String(count) }, [
            {
              layer: [],
              el: grid,
              kind: 'frame',
              fields: [
                ['gridColumnGap', 'column-gap'],
                ['gridRowGap', 'row-gap'],
              ],
            },
          ]),
        );
        expect(columns(grid), `${count} at ${width}px`).toBe(count);
        done(grid);
      }
    }
  });

  it('AutoGrid: layout.gap; 1, 2, and 3 columns at 320, 640, and 960 px', () => {
    const expected = { 320: 1, 640: 2, 960: 3 };
    for (const width of WIDTHS) {
      const grid = at(width, `<div class="odd-auto-grid">${items(6)}</div>`);
      expectNone(
        compare('Oddkin/Layout/AutoGrid', {}, [
          {
            layer: ['Content'],
            el: grid,
            kind: 'frame',
            gap: 'column-gap',
            fields: [['counterAxisSpacing', 'row-gap']],
          },
        ]),
      );
      expect(columns(grid), `${width}px`).toBe(expected[width]);
      done(grid);
    }
  });

  it('Split: sidebar-width side, main-min main, layout.gap; stacked at 320 px, side by side from 640 px', () => {
    for (const width of WIDTHS) {
      const split = at(width, '<div class="odd-split"><nav>Side</nav><main>Main</main></div>');
      const [side, main] = [...split.children] as HTMLElement[];
      const stacked = width === 320;
      expectNone(
        compare('Oddkin/Layout/Split', { Arrangement: stacked ? 'Stacked' : 'Side by side' }, [
          { layer: [], el: split, kind: 'frame', gap: 'column-gap' },
          { layer: ['Side'], el: side!, kind: 'frame', fields: [['width', 'flex-basis']] },
          { layer: ['Main'], el: main!, kind: 'frame', fields: [['minWidth', 'min-inline-size']] },
        ]),
      );
      expect(rows(split), `${width}px`).toBe(stacked ? 2 : 1);
      done(split);
    }
  });

  it('Center: the content sits in the middle of the region on both axes', () => {
    const center = mount(
      '<div class="odd-center" style="block-size: 192px"><div style="inline-size: 50%">Child</div></div>',
    );
    expectNone(compare('Oddkin/Layout/Center', {}, [{ layer: [], el: center, kind: 'frame' }]));
    const outer = center.getBoundingClientRect();
    const inner = center.firstElementChild!.getBoundingClientRect();
    expect(inner.left - outer.left).toBeCloseTo(outer.right - inner.right, 0);
    expect(inner.top - outer.top).toBeCloseTo(outer.bottom - inner.bottom, 0);
  });

  it('AspectRatio: 16:9 by default (180, 360, 540 px high), 4:3 and 1:1 through the property', () => {
    const expected = { '16:9': 9 / 16, '4:3': 3 / 4, '1:1': 1 };
    for (const [ratio, factor] of Object.entries(expected)) {
      variantIndex(figma.get('Oddkin/Layout/AspectRatio')!, { Ratio: ratio });
      const style =
        ratio === '16:9' ? '' : ` style="--odd-aspect-ratio: ${ratio.replace(':', ' / ')}"`;
      for (const width of WIDTHS) {
        const box = at(width, `<div class="odd-aspect-ratio"${style}><img alt=""></div>`);
        expect(box.getBoundingClientRect().height, `${ratio} at ${width}px`).toBe(width * factor);
        expect(box.firstElementChild!.getBoundingClientRect().height).toBe(width * factor);
        expectNone(
          compare('Oddkin/Layout/AspectRatio', { Ratio: ratio }, [
            { layer: [], el: box, kind: 'frame' },
          ]),
        );
        done(box);
      }
    }
    // The ratio holds when the content is taller.
    const tall = at(320, `<div class="odd-aspect-ratio">${items(1, 'block-size: 400px')}</div>`);
    expect(tall.getBoundingClientRect().height).toBe(180);
  });

  it('ScrollRegion: children layout.gap apart and full width; 192 px high, it scrolls at every width', async () => {
    for (const width of WIDTHS) {
      const region = at(
        width,
        `<odd-scroll-region label="Items" style="block-size: 192px">${items(6, 'block-size: 48px')}</odd-scroll-region>`,
      );
      await settle(region);
      await new Promise(requestAnimationFrame);
      await settle(region);
      const base = region.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
      const content = region.shadowRoot!.querySelector('.content')!;
      expectNone(
        compare('Oddkin/Layout/ScrollRegion', {}, [
          { layer: [], el: base, kind: 'frame' },
          { layer: ['Content'], el: content, kind: 'frame', gap: 'row-gap' },
        ]),
      );
      expect(base.getBoundingClientRect().height).toBe(192);
      expect(base.getAttribute('role'), `${width}px`).toBe('region');
      for (const child of region.children)
        expect(child.getBoundingClientRect().width).toBe(content.getBoundingClientRect().width);
      done(region);
    }
  });

  it('Container: no inset of its own; constrained to layout.measure (40rem), fluid at full width', async () => {
    for (const measure of ['Constrained', 'Fluid'] as const) {
      for (const width of WIDTHS) {
        const el = at(
          width,
          `<odd-container measure="${measure.toLowerCase()}">${items(1)}</odd-container>`,
        );
        await settle(el);
        const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
        expectNone(
          compare('Oddkin/Layout/Container', { Measure: measure }, [
            { layer: [], el, kind: 'frame' },
            { layer: ['Content'], el: base, kind: 'frame' },
          ]),
        );
        const expected = measure === 'Fluid' ? width : Math.min(width, 640);
        expect(el.getBoundingClientRect().width, `${measure} at ${width}px`).toBe(expected);
        done(el);
      }
    }
  });
});
