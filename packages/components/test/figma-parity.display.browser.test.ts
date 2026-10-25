import { describe, expect, it } from 'vitest';
import { compare, expectNone, mount, useParity, useRecipeStyles, type Target } from './parity.js';

// Figma parity for Agent 4's display families (page 158:22; snapshot design/figma/components.json):
// the description list, timeline, and stepper recipes, and the relative time, copy button, and stat
// elements.
useParity();

describe('Figma parity: description list recipe (descriptionList)', () => {
  useRecipeStyles(['base', 'description-list']);

  const list = (region: string) =>
    mount(`<div style="inline-size: 640px"><dl class="odd-description-list">
      <div><dt>Owner</dt><dd>Alex Morgan</dd></div>
      <div><dt>Workspace</dt><dd>Field notes</dd></div>
      <div><dt>Region</dt><dd>${region}</dd></div>
      <div><dt>Workspace ID</dt><dd><code>ws_83f2a9</code></dd></div>
    </dl></div>`).firstElementChild as HTMLElement;
  const targets = (dl: HTMLElement, region: string): Target[] => {
    const row = (i: number) => dl.children[i] as HTMLElement;
    const term = (i: number) => row(i).querySelector('dt')!;
    const value = (i: number) => row(i).querySelector('dd')!;
    return [
      { layer: [], el: dl, kind: 'frame', gap: 'row-gap' },
      // Rows are subgrids: the term-to-value gap is the list's column gap.
      { layer: ['Owner'], el: dl, kind: 'frame', gap: 'column-gap' },
      { layer: ['Owner', 'Owner'], el: term(0), kind: 'text' },
      { layer: ['Owner', 'Alex Morgan'], el: value(0), kind: 'text' },
      { layer: ['Workspace', 'Workspace'], el: term(1), kind: 'text' },
      { layer: ['Workspace', 'Field notes'], el: value(1), kind: 'text' },
      { layer: ['Region', 'Region'], el: term(2), kind: 'text' },
      { layer: ['Region', region], el: value(2), kind: 'text' },
      { layer: ['Workspace ID', 'Workspace ID'], el: term(3), kind: 'text' },
    ];
  };

  for (const [state, region] of [
    ['Horizontal', 'Pacific Northwest'],
    [
      'Long content',
      'North America / Pacific Northwest / Regional operations / Environmental planning and shared services',
    ],
    ['Missing value', 'Not provided'],
  ] as const)
    it(state, () => {
      const dl = list(region);
      expectNone(compare('Oddkin/Common/descriptionList', { State: state }, targets(dl, region)));
      // Figma's dividers are rules in the border colour between rows.
      const divider = getComputedStyle(dl.children[1]!).borderBlockStartColor;
      const probe = document.createElement('div');
      probe.style.color = 'var(--odd-color-border-default)';
      dl.append(probe);
      expect(divider).toBe(getComputedStyle(probe).color);
    });

  it('Stacked', () => {
    const dl = mount(`<div style="inline-size: 320px"><dl class="odd-description-list">
      <div><dt>Owner</dt><dd>Alex Morgan</dd></div>
      <div><dt>Workspace</dt><dd>Field notes</dd></div>
      <div><dt>Region</dt><dd>Pacific Northwest</dd></div>
      <div><dt>Workspace ID</dt><dd><code>ws_83f2a9</code></dd></div>
    </dl></div>`).firstElementChild as HTMLElement;
    const row = dl.children[0] as HTMLElement;
    expectNone(
      compare('Oddkin/Common/descriptionList', { State: 'Stacked' }, [
        { layer: [], el: dl, kind: 'frame', gap: 'row-gap' },
        { layer: ['Owner'], el: row, kind: 'frame', gap: 'row-gap' },
      ]),
    );
  });
});
