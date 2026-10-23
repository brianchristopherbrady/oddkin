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
import type { OddkinListbox } from '../src/listbox/listbox.js';
import type { OddkinSelect } from '../src/select/select.js';
import type { OddkinSplitPanel } from '../src/split-panel/split-panel.js';
import type { OddkinTree, TreeItemRecord } from '../src/tree/tree.js';

// Figma parity of the shared modules of the collections lane (component-contracts.md §2.9): the
// option row on `ListboxOption` and `MenuItem`, drawn by a test element (odd-listbox's own rows
// are compared below; odd-menu's when it exists). The navigation row's parity is odd-side-nav's (figma-parity.browser.test.ts).
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

deliberate([
  /^Tree (Empty|Loading) Status surface (fills|strokes|stroke\w+Weight|\w+Radius) /,
  'The empty and loading states sit inside the tree’s own surface (one border and card.radius for every state) instead of a second status surface.',
]);

// Figma's sample hierarchy. The error state is the author’s `status` slot content, and the
// visible "Project files" heading in the state frames is the page’s (the tree is named by `label`).
const TREE: readonly TreeItemRecord[] = [
  {
    id: 'components',
    label: 'Components',
    children: [
      {
        id: 'forms',
        label: 'Forms',
        children: [
          { id: 'text-field', label: 'Text field' },
          { id: 'combobox', label: 'Combobox' },
        ],
      },
      { id: 'navigation', label: 'Navigation', children: [{ id: 'tabs', label: 'Tabs' }] },
    ],
  },
  { id: 'foundations', label: 'Foundations', children: [{ id: 'color', label: 'Color' }] },
];
const mountTree = async (props: Partial<OddkinTree>) => {
  const el = mount('<odd-tree label="Project files"></odd-tree>') as OddkinTree;
  Object.assign(el, { items: TREE, ...props });
  await settle(el);
  return el;
};
const treeRow = (el: Element, label: string) =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]')].find(
    (each) => each.querySelector('.label')!.textContent === label,
  )!;
const treeLabel = (el: Element, label: string) => treeRow(el, label).querySelector('.label')!;

deliberate([
  /^ListboxOption \S+ Listbox option strokes \(none\): border /,
  'odd-listbox, and odd-select’s customizable picker, draw the divider between square rows as each later row’s top border (border.default), where Figma’s listbox surface shows a line between options.',
]);
deliberate([
  /^listbox (Empty|Loading) Status surface (fills|strokes|stroke\w+Weight|\w+Radius|effects|effectStyle) /,
  'The empty and loading states sit inside the listbox’s raised surface (part base), which draws the fill, border, radius, and elevation once for every state.',
]);

const ROLES =
  '<option value="viewer">Viewer</option><option value="editor" selected>Editor</option><option value="admin">Administrator</option><option value="owner" disabled>Owner</option>';
const mountListbox = async (attributes = '', children = ROLES) => {
  const el = mount(
    `<odd-listbox label="Workspace role" style="inline-size: 240px" ${attributes}>${children}</odd-listbox>`,
  ) as OddkinListbox;
  await settle(el);
  return el;
};
const listboxRow = (el: Element, label: string) =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (row) => row.querySelector('.option-text')!.textContent === label,
  )!;

describe('Figma parity: odd-listbox (listbox)', () => {
  for (const state of ['Selected', 'Keyboard focus', 'Disabled option'] as const)
    it(state, async () => {
      const el = await mountListbox();
      if (state === 'Keyboard focus') {
        shadowPart(el, 'listbox').focus();
        await userEvent.keyboard('{ArrowDown}');
        await settle(el);
      }
      const targets: Target[] = [
        { layer: [`Listbox / ${state}`, 'Surface'], el: shadowPart(el, 'base'), kind: 'frame' },
        {
          layer: [`Listbox / ${state}`, 'Workspace role'],
          el: shadowPart(el, 'label'),
          kind: 'text',
        },
      ];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/listbox', { State: state }, targets));
    });

  for (const [state, text] of [
    ['Empty', 'No items available'],
    ['Loading', 'Loading…'],
  ] as const)
    it(state, async () => {
      const el = await mountListbox(state === 'Loading' ? 'loading' : '', '');
      const status = shadowPart(el, state === 'Empty' ? 'empty' : 'loading');
      const frame = [`Workspace role / ${state}`];
      const targets: Target[] = [
        { layer: frame, el: shadowPart(el, 'field'), kind: 'frame' },
        { layer: [...frame, 'Workspace role'], el: shadowPart(el, 'label'), kind: 'text' },
        { layer: [...frame, 'Status surface'], el: status, kind: 'frame' },
        { layer: [...frame, 'Status surface', text], el: status, kind: 'text' },
      ];
      expectNone(compare('Oddkin/Common/listbox', { State: state }, targets));
    });

  // The rows are the shared option row, squared by the listbox.
  for (const [selected, state, label] of [
    ['False', 'Default', 'Viewer'],
    ['True', 'Default', 'Editor'],
    ['False', 'Disabled', 'Owner'],
    ['False', 'Focus', 'Administrator'],
    ['True', 'Focus', 'Editor'],
  ] as const)
    it(`rows as ListboxOption ${selected}/${state}`, async () => {
      // Moving without selecting needs `multiple`: a single listbox selects the active option.
      const el = await mountListbox(selected === 'False' && state === 'Focus' ? 'multiple' : '');
      if (state === 'Focus') {
        shadowPart(el, 'listbox').focus();
        if (label === 'Administrator') await userEvent.keyboard('{ArrowDown}');
        await settle(el);
      }
      const row = listboxRow(el, label);
      const targets: Target[] = [
        { layer: ['Listbox option'], el: row, kind: 'frame', gap: 'column-gap' },
        {
          layer: ['Listbox option', 'Label'],
          el: row.querySelector('.option-label')!,
          kind: 'text',
        },
      ];
      if (state === 'Focus')
        targets.push({
          layer: ['Listbox option', 'Focus indicator · inset'],
          el: row,
          kind: 'ring',
        });
      await transitions(targets);
      expectNone(
        compare('Oddkin/Common/ListboxOption', { Selected: selected, State: state }, targets),
      );
    });
});

describe('Figma parity: odd-tree (Tree)', () => {
  for (const state of ['Selected', 'Keyboard focus', 'Collapsed'] as const)
    it(state, async () => {
      // Expanded down to Forms, as Figma draws it: by the selection, or set.
      const el = await mountTree(
        state === 'Selected'
          ? { value: 'text-field' }
          : state === 'Keyboard focus'
            ? { expanded: ['components', 'forms'] }
            : {},
      );
      if (state === 'Keyboard focus') await interact('Focus', treeRow(el, 'Combobox'));
      const surface = [`Tree / ${state}`, 'Surface'];
      const targets: Target[] = [
        { layer: surface, el: shadowPart(el, 'base'), kind: 'frame' },
        { layer: [...surface, 'Components'], el: treeLabel(el, 'Components'), kind: 'text' },
      ];
      if (state === 'Collapsed')
        targets.push({
          layer: [...surface, 'Foundations'],
          el: treeLabel(el, 'Foundations'),
          kind: 'text',
        });
      else
        targets.push(
          { layer: [...surface, 'Forms'], el: treeLabel(el, 'Forms'), kind: 'text' },
          { layer: [...surface, 'Navigation'], el: treeLabel(el, 'Navigation'), kind: 'text' },
        );
      await transitions(targets);
      expectNone(compare('Oddkin/Common/Tree', { State: state }, targets));
    });

  // The rows are the shared navigation item: selected as Current, focused as Focus.
  for (const state of ['Current', 'Focus'] as const)
    it(`rows as NavigationItem ${state}`, async () => {
      const el = await mountTree({ value: 'text-field' });
      const entry = treeRow(el, state === 'Current' ? 'Text field' : 'Combobox');
      if (state === 'Focus') await interact('Focus', entry);
      const frame = [`NavigationItem / ${state}`, 'Surface'];
      const targets: Target[] = [
        { layer: frame, el: entry, kind: 'frame', gap: 'column-gap' },
        { layer: [...frame, 'Components'], el: entry, kind: 'text' },
        { layer: [...frame, 'Surface'], el: entry, kind: state === 'Current' ? 'marker' : 'ring' },
      ];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/NavigationItem', { State: state }, targets));
    });

  for (const [state, text] of [
    ['Empty', 'No items available'],
    ['Loading', 'Loading…'],
  ] as const)
    it(state, async () => {
      const el = await mountTree({ items: [], loading: state === 'Loading' });
      const status = shadowPart(el, state === 'Empty' ? 'empty' : 'loading');
      const surface = [`Project files / ${state}`, 'Status surface'];
      const targets: Target[] = [
        { layer: surface, el: status, kind: 'frame' },
        { layer: [...surface, text], el: status, kind: 'text' },
      ];
      expectNone(compare('Oddkin/Common/Tree', { State: state }, targets));
    });
});

const SELECT_ROLES = ROLES.replace(' selected', '');
const mountSelect = async (attributes: string) => {
  const el = mount(
    `<odd-select label="Workspace role" style="inline-size: 320px" ${attributes}>${SELECT_ROLES}</odd-select>`,
  ) as OddkinSelect;
  await settle(el);
  return el.shadowRoot!.querySelector('select')!;
};
// The customizable select: its open picker is drawn with the option rows (Chromium, WebKit).
const customizable = CSS.supports('(appearance: base-select) and selector(::picker(select))');

describe('Figma parity: odd-select (select)', () => {
  for (const [state, attributes, value] of [
    [
      'Closed',
      'description="Choose the access level." placeholder="Choose a role…"',
      'Choose a role…',
    ],
    ['Disabled', 'description="Choose the access level." value="editor" disabled', 'Editor'],
    ['Invalid', 'value="editor" error="Choose a role to continue."', 'Editor'],
  ] as const)
    it(state, async () => {
      const select = await mountSelect(attributes);
      const el = (select.getRootNode() as ShadowRoot).host;
      // WebKit draws a `base-select` select in a shadow root styled, but reports unstyled
      // computed values for it; the closed control's rules are the same without it.
      if (server.browser === 'webkit') select.style.appearance = 'none';
      const frame = `Select / ${state}`;
      const targets: Target[] = [
        { layer: [frame, 'Workspace role'], el: shadowPart(el, 'label'), kind: 'text' },
        { layer: [frame, 'Dropdown surface', 'Surface'], el: select, kind: 'frame' },
        { layer: [frame, 'Dropdown surface', 'Surface', value], el: select, kind: 'text' },
        state === 'Invalid'
          ? {
              layer: [frame, 'Choose a role to continue.'],
              el: shadowPart(el, 'error'),
              kind: 'text',
            }
          : {
              layer: [frame, 'Choose the access level.'],
              el: shadowPart(el, 'description'),
              kind: 'text',
            },
      ];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/select', { State: state }, targets));
    });

  // The open picker's rows are the shared option row on the listbox surface (computed values of
  // the picker's options are not reported by WebKit).
  for (const [selected, state, label] of [
    ['False', 'Default', 'Viewer'],
    ['True', 'Default', 'Editor'],
    ['False', 'Disabled', 'Owner'],
  ] as const)
    it.runIf(customizable && server.browser !== 'webkit')(
      `picker rows as ListboxOption ${selected}/${state}`,
      async () => {
        const select = await mountSelect('value="editor"');
        await userEvent.click(select);
        await expect.poll(() => select.matches(':open')).toBe(true);
        const row = [...select.options].find((option) => option.label === label)!;
        const targets: Target[] = [
          { layer: ['Listbox option'], el: row, kind: 'frame', gap: 'column-gap' },
          { layer: ['Listbox option', 'Label'], el: row, kind: 'text' },
        ];
        await transitions(targets);
        expectNone(
          compare('Oddkin/Common/ListboxOption', { Selected: selected, State: state }, targets),
        );
        await userEvent.keyboard('{Escape}');
      },
    );
});
