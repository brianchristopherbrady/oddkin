import { describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { OddkinElement, define } from '@oddkin/core/element';
import { html } from '@oddkin/core/template';
import { focusRingStyles } from '../src/styles/focus-ring.styles.js';
import { checkGlyph, glyphStyles } from '../src/styles/glyphs.js';
import { hostStyles } from '../src/styles/host.styles.js';
import { optionRowStructuralStyles } from '../src/styles/option-row.structural.styles.js';
import { optionRowStyles } from '../src/styles/option-row.styles.js';
import {
  compare,
  deliberate,
  expectNone,
  interact,
  mount,
  settle,
  shadowPart,
  transitions,
  useParity,
  type Target,
} from './parity.js';
import { themeValue } from './probe.js';
import type { OddkinSplitPanel } from '../src/split-panel/split-panel.js';

// Figma parity of the shared modules of the collections lane (component-contracts.md §2.9): the
// option row on `ListboxOption` and `MenuItem`, drawn by a test element until odd-listbox and
// odd-menu use it. The navigation row's parity is odd-side-nav's (figma-parity.browser.test.ts).
useParity();

deliberate(
  [
    /^ListboxOption \S+ Listbox option fills \(--odd-color-surface-raised\): background-color rgba\(0, 0, 0, 0\)/,
    'Option rows are transparent over the surface they sit on (raised in every Oddkin collection), so a surface change applies once.',
  ],
  [
    /^ListboxOption \S+ Listbox option topLeftRadius \(--odd-radius-none\)/,
    'The shared option row takes control.radius (MenuItem, CommandItem); odd-listbox squares its rows itself, as Figma draws them between dividers.',
  ],
  [
    /^ListboxOption \S+\/Focus Listbox option strokeTopWeight \(--odd-border-width-default\): border-block-start-width 0px/,
    'Figma keeps a stroke weight on the focused option frame with no stroke colour; the row draws focus only with the inset ring.',
  ],
);

class TestOptionRows extends OddkinElement {
  static override styles = [
    hostStyles,
    optionRowStructuralStyles,
    glyphStyles,
    focusRingStyles,
    optionRowStyles,
  ];
  override render() {
    return html`<div role="listbox" aria-label="Rows">
      <div class="option" role="option" aria-selected="false" id="plain">
        <span class="option-label">Viewer</span><span class="option-check">${checkGlyph}</span>
      </div>
      <div class="option" role="option" aria-selected="true" id="selected">
        <span class="option-label">Editor<span class="option-description">Can edit</span></span
        ><span class="option-check">${checkGlyph}</span>
      </div>
      <div class="option" role="option" aria-selected="false" aria-disabled="true" id="disabled">
        <span class="option-label">Owner</span><span class="option-end">Ctrl O</span>
      </div>
      <button class="option danger" role="menuitem" id="danger" type="button">
        <span class="option-label">Delete project</span><span class="option-end">Ctrl D</span>
      </button>
    </div>`;
  }
}
define('test-option-rows', TestOptionRows);
const row = (el: Element, id: string) => el.shadowRoot!.getElementById(id) as HTMLElement;
const part = (el: Element, id: string, cls: string) =>
  row(el, id).querySelector<HTMLElement>(`.${cls}`)!;

describe('Figma parity: option row (ListboxOption)', () => {
  for (const [selected, state, id] of [
    ['False', 'Default', 'plain'],
    ['True', 'Default', 'selected'],
    ['False', 'Disabled', 'disabled'],
    ['False', 'Focus', 'plain'],
    ['True', 'Focus', 'selected'],
  ] as const)
    it(`${selected}/${state}`, async () => {
      const el = mount('<test-option-rows></test-option-rows>');
      await settle(el);
      const option = row(el, id);
      if (state === 'Focus') option.classList.add('active');
      const targets: Target[] = [
        { layer: ['Listbox option'], el: option, kind: 'frame', gap: 'column-gap' },
        { layer: ['Listbox option', 'Label'], el: part(el, id, 'option-label'), kind: 'text' },
      ];
      if (state === 'Focus')
        targets.push({
          layer: ['Listbox option', 'Focus indicator · inset'],
          el: option,
          kind: 'ring',
        });
      await transitions(targets);
      expectNone(
        compare('Oddkin/Common/ListboxOption', { Selected: selected, State: state }, targets),
      );
    });
});

describe('Figma parity: option row (MenuItem)', () => {
  for (const [state, id] of [
    ['Default', 'plain'],
    ['Destructive', 'danger'],
    ['Disabled', 'disabled'],
  ] as const)
    it(state, async () => {
      const el = mount('<test-option-rows></test-option-rows>');
      await settle(el);
      const surface = [`MenuItem / ${state}`, 'Surface'];
      const targets: Target[] = [
        { layer: surface, el: row(el, id), kind: 'frame', gap: 'column-gap' },
        {
          layer: [...surface, 'Duplicate project'],
          el: part(el, id, 'option-label'),
          kind: 'text',
        },
      ];
      if (id !== 'plain')
        targets.push({
          layer: [...surface, 'Ctrl D'],
          el: part(el, id, 'option-end'),
          kind: 'text',
        });
      expectNone(compare('Oddkin/Common/MenuItem', { State: state }, targets));
    });
});

describe('option row module', () => {
  it('shows the check only on selected or checked rows, and lays out label, description, and end', async () => {
    const el = mount('<test-option-rows></test-option-rows>');
    await settle(el);
    expect(getComputedStyle(part(el, 'plain', 'option-check')).visibility).toBe('hidden');
    expect(getComputedStyle(part(el, 'selected', 'option-check')).visibility).toBe('visible');
    row(el, 'plain').setAttribute('aria-checked', 'true');
    expect(getComputedStyle(part(el, 'plain', 'option-check')).visibility).toBe('visible');
    const label = part(el, 'selected', 'option-label');
    expect(getComputedStyle(label).flexDirection).toBe('column');
    expect(getComputedStyle(part(el, 'selected', 'option-description')).fontSize).toBe(
      themeValue('font-size', '--odd-type-small-size'),
    );
    expect(getComputedStyle(row(el, 'disabled')).cursor).toBe('not-allowed');
    // Control-sized rows.
    expect(`${row(el, 'plain').getBoundingClientRect().height}px`).toBe(
      themeValue('block-size', '--odd-control-height-md'),
    );
    await userEvent.hover(row(el, 'plain'));
    expect(getComputedStyle(row(el, 'plain')).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-hover'),
    );
    await userEvent.hover(row(el, 'disabled'));
    expect(getComputedStyle(row(el, 'disabled')).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    // The end text follows the label at the inline end.
    const end = part(el, 'disabled', 'option-end').getBoundingClientRect();
    expect(end.right).toBeCloseTo(
      row(el, 'disabled').getBoundingClientRect().right -
        parseFloat(getComputedStyle(row(el, 'disabled')).paddingInlineEnd),
      0,
    );
  });

  it('draws the focus ring on a focused menu item as on the active option', async () => {
    const el = mount('<test-option-rows></test-option-rows>');
    await settle(el);
    row(el, 'plain').classList.add('active');
    const active = getComputedStyle(row(el, 'plain'));
    const button = row(el, 'danger');
    button.focus({ focusVisible: true } as FocusOptions);
    // Keyboard-like focus: a programmatic focus after a key press is :focus-visible.
    if (!button.matches(':focus-visible')) return;
    const focused = getComputedStyle(button);
    expect(focused.outlineWidth).toBe(active.outlineWidth);
    expect(focused.outlineColor).toBe(active.outlineColor);
    expect(focused.outlineOffset).toBe(active.outlineOffset);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the active ring, the selection, and disabled text visible in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const el = mount('<test-option-rows></test-option-rows>');
        await settle(el);
        const system = (property: string, color: string) => {
          const probe = document.createElement('span');
          probe.style.setProperty(property, color);
          el.parentElement!.append(probe);
          return getComputedStyle(probe).getPropertyValue(property);
        };
        row(el, 'plain').classList.add('active');
        expect(getComputedStyle(row(el, 'plain')).outlineColor).toBe(system('color', 'CanvasText'));
        expect(getComputedStyle(row(el, 'selected')).backgroundColor).toBe(
          system('background-color', 'Highlight'),
        );
        expect(getComputedStyle(row(el, 'selected')).color).toBe(system('color', 'HighlightText'));
        expect(getComputedStyle(row(el, 'disabled')).color).toBe(system('color', 'GrayText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );
});

deliberate([
  /^Splitter\/\w+ Focus \w+ resize handle (strokes|strokeTopWeight) \(--odd-(color-focus-ring|border-width-default)\): border-block-start-(color|width)/,
  'The separator shows the shared focus ring (an outline of focus.width, like every focusable part) instead of the 1px stroke Figma draws in the focus colour.',
]);

describe('Figma parity: odd-split-panel (Splitter)', () => {
  for (const [family, orientation, layer, grip] of [
    ['Splitter/vertical', 'horizontal', 'Vertical resize handle', '\u22ee'],
    ['Splitter/horizontal', 'vertical', 'Horizontal resize handle', '\u2022\u2022\u2022'],
  ] as const)
    for (const state of ['Default', 'Hover', 'Focus', 'Dragging'])
      it(`${family} ${state}`, async () => {
        const el = mount(
          `<odd-split-panel orientation="${orientation}" style="block-size: 200px"><p slot="start">Files</p><p slot="end">Design system</p></odd-split-panel>`,
        ) as OddkinSplitPanel;
        await settle(el);
        const separator = shadowPart(el, 'separator');
        if (state === 'Dragging') el._dragging.value = true;
        await interact(state, separator);
        await settle(el);
        const targets: Target[] = [
          { layer: [layer], el: separator, kind: 'frame' },
          { layer: [layer, grip], el: separator.querySelector('.glyph')!, kind: 'text' },
        ];
        await transitions(targets);
        expectNone(compare(`Oddkin/Common/${family}`, { State: state }, targets));
      });
});
