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
  figma,
  interact,
  layersOf,
  mount,
  settle,
  shadowPart,
  transitions,
  useParity,
  variantIndex,
  type Target,
} from './parity.js';
import { themeValue } from './probe.js';
import type { OddkinCombobox } from '../src/combobox/combobox.js';
import type { OddkinCommandPalette } from '../src/command-palette/command-palette.js';
import type { OddkinListbox } from '../src/listbox/listbox.js';
import type { MenuItemRecord, OddkinMenu } from '../src/menu/menu.js';
import type { OddkinPicker } from '../src/picker/picker.js';
import type { OddkinSelect } from '../src/select/select.js';
import type { OddkinSplitButton } from '../src/split-button/split-button.js';
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
  for (const [family, orientation, layer] of [
    ['Splitter/vertical', 'horizontal', 'Vertical resize handle'],
    ['Splitter/horizontal', 'vertical', 'Horizontal resize handle'],
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
        // The grip is the handle's one text layer, whatever the snapshot names it ("•••", "Grip · more").
        const grip = figma
          .get(`Oddkin/Common/${family}`)!
          .layers.find((l) => l.path.length === 2 && l.path[0] === layer)!.path[1]!;
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

deliberate([
  /^Menu .+ Surface \[4\] (fills \(--odd-color-border-default\): background-color rgba\(0, 0, 0, 0\)|strokes \(none\): border )/,
  'The separator is a top border in border.default (forced colours keep a border visible), where Figma fills a 1px frame.',
]);

// Figma's sample menu: a headed group, a submenu, a separator, and a destructive action.
const menuItems = (disabled = ''): MenuItemRecord[] => [
  {
    kind: 'group',
    label: 'Project actions',
    items: [
      { id: 'new', label: 'New project', shortcut: 'Ctrl N' },
      {
        id: 'duplicate',
        label: 'Duplicate project',
        shortcut: 'Ctrl D',
        disabled: disabled === 'duplicate',
      },
      {
        id: 'move',
        label: 'Move to workspace',
        disabled: disabled === 'move',
        items: [{ id: 'mine', label: 'My workspace' }],
      },
    ],
  },
  { kind: 'separator' },
  { id: 'delete', label: 'Delete project', tone: 'danger', shortcut: 'Ctrl D' },
];
const openMenu = async (items: MenuItemRecord[], keyboard: boolean) => {
  const el = mount('<odd-menu label="Project actions"></odd-menu>') as OddkinMenu;
  el.items = items;
  await settle(el);
  const trigger = shadowPart(el, 'trigger');
  if (keyboard) {
    trigger.focus();
    await userEvent.keyboard('{Enter}');
  } else await userEvent.click(trigger);
  const surface = el.shadowRoot!.getElementById('menu')!;
  await expect.poll(() => surface.matches(':popover-open')).toBe(true);
  await settle(el);
  return { el, surface, row: (path: string) => el.shadowRoot!.getElementById(`item-${path}`)! };
};

describe('Figma parity: odd-menu (Menu)', () => {
  for (const state of ['Open', 'Keyboard focus', 'Disabled item'] as const)
    it(state, async () => {
      const { surface, row } = await openMenu(
        menuItems(state === 'Disabled item' ? 'move' : ''),
        state === 'Keyboard focus',
      );
      if (state === 'Keyboard focus') {
        await userEvent.keyboard('{ArrowDown}');
        expect(row('0-1').matches(':focus-visible')).toBe(true);
      }
      const frame = [`Menu / ${state}`, 'Surface'];
      const targets: Target[] = [
        { layer: frame, el: surface, kind: 'frame' },
        {
          layer: [...frame, 'Project actions'],
          el: surface.querySelector('.group-label')!,
          kind: 'text',
        },
        {
          layer: [...frame, 'Surface [4]'],
          el: surface.querySelector('.separator')!,
          kind: 'frame',
        },
      ];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/Menu', { State: state }, targets));
    });

  // The menu's own rows: the option row with the menu's focused surface.
  for (const [state, path, disabled] of [
    ['Default', '0-1', ''],
    ['Destructive', '2', ''],
    ['Disabled', '0-1', 'duplicate'],
    ['Focus', '0-1', ''],
  ] as const)
    it(`rows as MenuItem ${state}`, async () => {
      const { row } = await openMenu(menuItems(disabled), state === 'Focus');
      if (state === 'Focus') await userEvent.keyboard('{ArrowDown}');
      const item = row(path);
      const surface = [`MenuItem / ${state}`, 'Surface'];
      const targets: Target[] = [
        { layer: surface, el: item, kind: 'frame', gap: 'column-gap' },
        {
          layer: [...surface, 'Duplicate project'],
          el: item.querySelector('.option-text')!,
          kind: 'text',
        },
        { layer: [...surface, 'Ctrl D'], el: item.querySelector('.option-end')!, kind: 'text' },
      ];
      if (state === 'Focus')
        targets.push({ layer: [...surface, 'Surface'], el: item, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/MenuItem', { State: state }, targets));
    });
});

describe('Figma parity: odd-split-button (splitAction)', () => {
  for (const state of ['Default', 'Focus'] as const)
    it(state, async () => {
      const el = mount(
        '<odd-split-button value="create" appearance="primary">Create project<option value="template">From a template</option></odd-split-button>',
      ) as OddkinSplitButton;
      await settle(el);
      const menu = el.shadowRoot!.querySelector<OddkinMenu>('odd-menu')!;
      await settle(menu);
      const trigger = shadowPart(menu, 'trigger');
      if (state === 'Focus') {
        shadowPart(el, 'primary').focus();
        await userEvent.tab();
        expect(trigger.matches(':focus-visible')).toBe(true);
      }
      const frame = `Button group / split action / ${state}`;
      const targets: Target[] = [{ layer: [frame, 'Surface'], el: trigger, kind: 'frame' }];
      if (state === 'Focus')
        targets.push({ layer: [frame, 'Surface [2]'], el: trigger, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/splitAction', { State: state }, targets));
    });
});

const PROJECT_OPTIONS =
  '<option value="atlas">Atlas</option><option value="design">Design systems</option><option value="research">Research</option>';
const mountCombobox = async (attributes: string) => {
  const el = mount(
    `<odd-combobox style="inline-size: 320px" ${attributes}>${PROJECT_OPTIONS}</odd-combobox>`,
  ) as OddkinCombobox;
  await settle(el);
  return el;
};

deliberate(
  [
    /^combobox \w+ Surface paddingLeft \(--odd-control-padding-inline-md\): padding-inline-start/,
    'The search glyph is an adornment over the field box, as on odd-input’s search field (the control module pads the box for it), so the text starts after the glyph inside the padding; Figma lays the glyph out as the first child after the same padding.',
  ],
  [
    /^multiselect Closed Surface paddingTop \(--odd-space-none\): padding-block-start/,
    'One field height for one chip and for several: the box keeps Figma’s Multiple selected padding (space.xs above and below), so it does not grow when the first chip arrives or a second row wraps.',
  ],
);

describe('Figma parity: odd-combobox (combobox)', () => {
  for (const state of ['Closed', 'Disabled'] as const)
    it(state, async () => {
      const el = await mountCombobox(
        `label="Find a project" description="Search by project name." placeholder="Choose a project…"${state === 'Disabled' ? ' value="design" disabled' : ''}`,
      );
      const frame = `Combobox / ${state}`;
      const input = shadowPart(el, 'input');
      const targets: Target[] = [
        { layer: [frame, 'Find a project'], el: shadowPart(el, 'label'), kind: 'text' },
        {
          layer: [frame, 'Search by project name.'],
          el: shadowPart(el, 'description'),
          kind: 'text',
        },
        {
          layer: [frame, 'Dropdown surface', 'Surface'],
          el: shadowPart(el, 'control'),
          kind: 'frame',
        },
        state === 'Closed'
          ? {
              layer: [frame, 'Dropdown surface', 'Surface', 'Choose a project…'],
              el: input,
              kind: 'text',
              pseudo: '::placeholder',
            }
          : { layer: [frame, 'Dropdown surface', 'Surface', 'Des'], el: input, kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/combobox', { State: state }, targets));
    });

  // Open: the popup is the listbox surface below the field (Figma joins both in one surface).
  for (const state of ['Open', 'Loading'] as const)
    it(state, async () => {
      const el = await mountCombobox(
        `label="Find a project"${state === 'Loading' ? ' loading' : ''}`,
      );
      shadowPart(el, 'input').focus();
      await userEvent.keyboard('{ArrowDown}');
      await settle(el);
      const frame = `Combobox / ${state}`;
      const targets: Target[] = [
        { layer: [frame, 'Dropdown surface'], el: shadowPart(el, 'popup'), kind: 'frame' },
      ];
      if (state === 'Loading')
        targets.push({
          layer: [frame, 'Dropdown surface', 'Surface [2]', 'Searching projects…'],
          el: shadowPart(el, 'loading'),
          kind: 'text',
        });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/combobox', { State: state }, targets));
    });
});

describe('Figma parity: odd-combobox multiple (multiselect)', () => {
  for (const state of ['Closed', 'Multiple selected'] as const)
    it(state, async () => {
      const el = await mountCombobox(
        `label="Topics" description="Add one or more topics." multiple`,
      );
      el.values = state === 'Closed' ? ['design'] : ['design', 'research'];
      await settle(el);
      const frame = `Multiselect / ${state}`;
      const chip = (label: string) =>
        [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="chip"]')].find((c) =>
          c.textContent?.includes(label),
        )!;
      const targets: Target[] = [
        { layer: [frame, 'Topics'], el: shadowPart(el, 'label'), kind: 'text' },
        {
          layer: [frame, 'Dropdown surface', 'Surface'],
          el: shadowPart(el, 'control'),
          kind: 'frame',
        },
      ];
      if (state === 'Closed')
        targets.push({
          layer: [frame, 'Add one or more topics.'],
          el: shadowPart(el, 'description'),
          kind: 'text',
        });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/multiselect', { State: state }, targets));
      // The chips are Figma chip instances: drawn with the chip module (odd-chip's look).
      const chips = [
        {
          layer: ['Removable chip / Default', 'Surface'],
          el: chip('Design systems'),
          kind: 'frame' as const,
        },
      ];
      await transitions(chips);
      expectNone(compare('Oddkin/Common/chip', { State: 'Default' }, chips));
    });
});

const PALETTE_COMMANDS = [
  { id: 'new', label: 'New project', shortcut: 'Ctrl N', group: 'Commands & projects' },
  { id: 'atlas', label: 'Atlas', group: 'Commands & projects' },
  {
    id: 'beacon',
    label: 'Beacon',
    shortcut: 'Ctrl B',
    group: 'Commands & projects',
    disabled: true,
  },
];
const openPalette = async (attributes: string, items = PALETTE_COMMANDS) => {
  const el = mount(
    `<odd-command-palette label="Command palette" ${attributes}></odd-command-palette>`,
  ) as OddkinCommandPalette;
  el.items = items;
  await settle(el);
  el.show();
  await settle(el);
  return el;
};

describe('Figma parity: odd-command-palette (CommandPalette)', () => {
  it('Results', async () => {
    const el = await openPalette('');
    const input = shadowPart(el, 'input') as HTMLInputElement;
    input.value = 'Design';
    const root = 'Command palette';
    const targets: Target[] = [
      { layer: [root], el: shadowPart(el, 'dialog'), kind: 'frame' },
      { layer: [root, 'COMMANDS & PROJECTS'], el: shadowPart(el, 'group'), kind: 'text' },
      { layer: [root, 'Search commands'], el: shadowPart(el, 'search'), kind: 'frame' },
      { layer: [root, 'Search commands', 'Query'], el: input, kind: 'text' },
      {
        layer: [root, 'Search commands', 'Esc'],
        el: el.shadowRoot!.querySelector('.hint')!,
        kind: 'text',
      },
      { layer: [root, 'Keyboard guidance'], el: shadowPart(el, 'footer'), kind: 'frame' },
      {
        layer: [root, 'Keyboard guidance', '\u2191 \u2193 Navigate'],
        el: shadowPart(el, 'footer'),
        kind: 'text',
      },
    ];
    await transitions(targets);
    expectNone(compare('Oddkin/Common/CommandPalette', { State: 'Results' }, targets));
  });

  for (const [state, layer, part] of [
    ['Loading', 'Searching your workspace\u2026', 'loading'],
    ['No results', 'No matching commands', 'empty'],
  ] as const)
    it(state, async () => {
      const el = await openPalette(state === 'Loading' ? 'loading' : '', []);
      const targets: Target[] = [
        { layer: ['Command palette', layer], el: shadowPart(el, part), kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/CommandPalette', { State: state }, targets));
    });
});

describe('Figma parity: odd-command-palette rows (CommandItem)', () => {
  for (const [state, label] of [
    ['Focus', 'New project'],
    ['Default', 'Atlas'],
    ['Disabled', 'Beacon'],
  ] as const)
    it(state, async () => {
      const el = await openPalette('');
      const row = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (r) => r.querySelector('.option-text')!.textContent === label,
      )!;
      expect(row.classList.contains('active')).toBe(state === 'Focus');
      const targets: Target[] = [
        { layer: ['Command option'], el: row, kind: 'frame' },
        {
          layer: ['Command option', 'Label'],
          el: row.querySelector('.option-text')!,
          kind: 'text',
        },
      ];
      if (row.querySelector('.shortcut'))
        targets.push({
          layer: ['Command option', 'Shortcut'],
          el: row.querySelector('.shortcut')!,
          kind: 'text',
        });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/CommandItem', { State: state }, targets));
    });
});

// Figma's Picker sample: map layers, three deep (picker.json).
const PICKER_LAYERS: TreeItemRecord[] = [
  {
    id: 'workspace',
    label: 'Workspace layers',
    children: [
      {
        id: 'transportation',
        label: 'Transportation',
        children: [
          { id: 'roads', label: 'Roads' },
          { id: 'rail', label: 'Rail' },
        ],
      },
      { id: 'boundaries', label: 'Boundaries' },
      { id: 'buildings', label: 'Buildings' },
    ],
  },
];
const PICKER_OPTIONS =
  '<option value="roads">Roads</option><option value="rail">Rail</option><option value="boundaries">Boundaries</option><option value="buildings">Buildings</option>';
type PickerContent = 'Tree' | 'Listbox';
type PickerSelection = 'Single' | 'Multiple';
const PICKER_STATES = ['Empty', 'Selected', 'Open', 'Focus', 'Invalid', 'Disabled'] as const;

/** A picker in one of Figma's states: chosen as Figma draws it, opened by pointer or keyboard. */
const mountPicker = async (
  content: PickerContent,
  selection: PickerSelection,
  state: (typeof PICKER_STATES)[number],
) => {
  const multiple = selection === 'Multiple';
  const attributes = [
    'label="Map layers"',
    state === 'Invalid'
      ? 'error="Select at least one layer."'
      : 'description="Choose from the available layers."',
    `placeholder="${multiple ? 'Choose layers…' : 'Choose a layer…'}"`,
    multiple ? 'multiple' : '',
    state === 'Disabled' ? 'disabled' : '',
  ].join(' ');
  const el = mount(
    `<odd-picker style="inline-size: 384px" ${attributes}>${content === 'Listbox' ? PICKER_OPTIONS : ''}</odd-picker>`,
  ) as OddkinPicker;
  if (content === 'Tree') el.items = PICKER_LAYERS;
  if (state !== 'Empty' && state !== 'Invalid') {
    if (multiple) el.values = ['roads', 'rail', 'boundaries'];
    else el.value = 'roads';
  }
  await settle(el);
  const popup = shadowPart(el, 'popup');
  if (state === 'Open') await userEvent.click(shadowPart(el, 'control'));
  if (state === 'Focus') {
    await userEvent.tab();
    expect(shadowPart(el, 'trigger').matches(':focus-visible')).toBe(true);
    // Focus apart from the selection: Buildings in the tree, Rail in the list.
    await userEvent.keyboard(content === 'Tree' ? '{ArrowDown}{End}' : '{ArrowDown}{ArrowDown}');
  }
  if (state === 'Open' || state === 'Focus')
    await expect.poll(() => popup.matches(':popover-open')).toBe(true);
  await settle(el);
  return el;
};
const pickerRow = (el: Element, label: string) =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"], [role="option"]')].find(
    (row) => row.querySelector('.label, .option-text')!.textContent === label,
  )!;

// The popup is a top-layer popover over the help text below the field, where Figma lays the
// popover out in the flow above it; the bindings are the same.
describe('Figma parity: odd-picker (Picker)', () => {
  for (const content of ['Tree', 'Listbox'] as const)
    for (const selection of ['Single', 'Multiple'] as const)
      for (const state of PICKER_STATES)
        it(`${content}/${selection}/${state}`, async () => {
          const el = await mountPicker(content, selection, state);
          const multiple = selection === 'Multiple';
          const open = state === 'Open' || state === 'Focus';
          const chosen = state !== 'Empty' && state !== 'Invalid';
          const surface = 'Picker surface';
          const field = `Field · ${selection}`;
          const popover = `Popover · ${content}`;
          const targets: Target[] = [
            { layer: ['Map layers'], el: shadowPart(el, 'label'), kind: 'text' },
            state === 'Invalid'
              ? { layer: ['Select at least one layer.'], el: shadowPart(el, 'error'), kind: 'text' }
              : {
                  layer: ['Choose from the available layers.'],
                  el: shadowPart(el, 'description'),
                  kind: 'text',
                },
          ];
          if (!chosen)
            targets.push({
              layer: [surface, field, 'Value', 'Choose a layer…'],
              el: el.shadowRoot!.querySelector('.placeholder')!,
              kind: 'text',
            });
          else if (!multiple)
            targets.push({
              layer: [surface, field, 'Value', 'Transportation / Roads'],
              el: el.shadowRoot!.querySelector('.value')!,
              kind: 'text',
            });
          else
            targets.push({
              layer: [surface, field, 'Value'],
              el: el.shadowRoot!.querySelector('.chips')!,
              kind: 'frame',
              gap: 'column-gap',
            });
          if (open) {
            const actions = [surface, popover, 'Footer', 'Picker actions'];
            targets.push(
              {
                layer: [surface, popover, 'Content'],
                el: el.shadowRoot!.querySelector('.content')!,
                kind: 'frame',
                gap: 'row-gap',
                fields: [['minHeight', 'min-block-size']],
              },
              { layer: actions, el: shadowPart(el, 'footer'), kind: 'frame', gap: 'column-gap' },
              {
                layer: [...actions, multiple ? '3 selected' : 'Choose one item'],
                el: shadowPart(el, 'summary'),
                kind: 'text',
              },
            );
          }
          if (state === 'Focus')
            targets.push({
              layer: [surface, 'Focus indicator'],
              el: shadowPart(el, 'popup'),
              pseudo: '::before',
              kind: 'frame',
            });
          await transitions(targets);
          expectNone(
            compare(
              'Oddkin/Common/Picker',
              { Content: content, Selection: selection, State: state },
              targets,
            ),
          );

          // The field is multiselect/Field in its Picker state; Invalid and Disabled override its
          // stroke and fill as the control module draws them.
          const box = shadowPart(el, 'control');
          if (state === 'Invalid')
            expect(getComputedStyle(box).borderTopColor).toBe(
              themeValue('border-top-color', '--odd-color-danger-foreground'),
            );
          else if (state === 'Disabled')
            expect(getComputedStyle(box).backgroundColor).toBe(
              themeValue('background-color', '--odd-color-surface-sunken'),
            );
          else {
            const fieldTargets: Target[] = [
              {
                layer: [],
                el: box,
                kind: 'frame',
                gap: 'column-gap',
                fields: [['minHeight', 'min-block-size']],
              },
            ];
            expectNone(
              compare('Oddkin/Common/multiselect/Field', { State: 'Picker' }, fieldTargets),
            );
          }
          if (!open) return;
          // The popup is popover in its Picker state; the content is Tree (Picker states) or the
          // listbox surface's rows.
          const popupTargets: Target[] = [
            { layer: [], el: shadowPart(el, 'popup'), kind: 'frame' },
          ];
          expectNone(compare('Oddkin/Common/popover', { State: 'Picker' }, popupTargets));
          if (content === 'Tree') {
            const tree: Target[] = [
              { layer: [], el: shadowPart(el, 'tree'), kind: 'frame', gap: 'row-gap' },
            ];
            expectNone(
              compare('Oddkin/Common/Tree', { State: `Picker ${selection.toLowerCase()}` }, tree),
            );
            // Two levels below the top, as Figma's derived indent (2 × navigation.indent).
            const top = pickerRow(el, 'Workspace layers').getBoundingClientRect().left;
            expect(pickerRow(el, 'Roads').getBoundingClientRect().left - top).toBe(32);
            const roads = pickerRow(el, 'Roads');
            const current: Target[] = [
              {
                layer: ['NavigationItem / Current', 'Surface'],
                el: roads,
                kind: 'frame',
                gap: 'column-gap',
              },
              {
                layer: ['NavigationItem / Current', 'Surface', 'Surface'],
                el: roads,
                kind: 'marker',
              },
            ];
            expectNone(compare('Oddkin/Common/NavigationItem', { State: 'Current' }, current));
            if (state === 'Focus') {
              const buildings = pickerRow(el, 'Buildings');
              expect(buildings.classList.contains('active')).toBe(true);
              const ring: Target[] = [
                {
                  layer: ['NavigationItem / Focus', 'Surface', 'Surface'],
                  el: buildings,
                  kind: 'ring',
                },
              ];
              expectNone(compare('Oddkin/Common/NavigationItem', { State: 'Focus' }, ring));
            }
          } else {
            const roads = pickerRow(el, 'Roads');
            const rows: Target[] = [
              { layer: ['Listbox option'], el: roads, kind: 'frame', gap: 'column-gap' },
            ];
            expectNone(
              compare('Oddkin/Common/ListboxOption', { Selected: 'True', State: 'Default' }, rows),
            );
            if (state === 'Focus') {
              const rail = pickerRow(el, 'Rail');
              expect(rail.classList.contains('active')).toBe(true);
              const ring: Target[] = [
                { layer: ['Listbox option', 'Focus indicator · inset'], el: rail, kind: 'ring' },
              ];
              expectNone(
                compare(
                  'Oddkin/Common/ListboxOption',
                  { Selected: multiple ? 'True' : 'False', State: 'Focus' },
                  ring,
                ),
              );
            }
          }
          // The footer's actions are sm buttons: Close and Clear ghost, Done primary.
          for (const [part, appearance] of multiple
            ? ([
                ['clear-all', 'ghost'],
                ['close', 'primary'],
              ] as const)
            : ([['close', 'ghost']] as const)) {
            const family = figma.get('Oddkin/Common/button/sm')!;
            const values = { Appearance: appearance, Size: 'sm', State: 'Default' };
            const frame = layersOf(family, variantIndex(family, values)).find(
              (l) => l.path.length === 1,
            )!.path;
            const button = shadowPart(el, part);
            const buttons: Target[] = [
              { layer: frame, el: button, kind: 'frame', gap: 'column-gap' },
              { layer: [...frame, 'Label'], el: button, kind: 'text' },
            ];
            expectNone(compare('Oddkin/Common/button/sm', values, buttons));
          }
        });
});

// Figma's multiselect members: 75 people in three departments (Design, Eng., Product), as the
// value displays and selection panels count them.
const DEPARTMENTS = ['Design', 'Engineering', 'Product'] as const;
const FIRST = [
  'Amelia',
  'Noah',
  'Olivia',
  'Liam',
  'Isabella',
  'Benjamin',
  'Charlotte',
  'Henry',
  'Mia',
  'Lucas',
  'Harper',
  'James',
  'Sophia',
  'Ethan',
  'Ava',
];
const LAST = ['Johnson', 'Williams', 'Brown', 'Wilson', 'Moore'];
const MEMBERS = Array.from({ length: 75 }, (_, i) => ({
  value: `m${i + 1}`,
  label: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
  group: DEPARTMENTS[i % 3]!,
}));
const VALUE_WIDTH = 360; // Figma's multiselect/Field and Display (the value area is 276 px of it)

/** A multiple combobox drawing `count` chosen members with `view`, measured at Figma's width. */
const mountMembers = async (view: string, count: number, attributes = '') => {
  const el = mount(
    `<odd-combobox style="inline-size: ${VALUE_WIDTH}px" label="Team members" placeholder="Choose members…" multiple view="${view}" ${attributes}></odd-combobox>`,
  ) as OddkinCombobox;
  el.options = MEMBERS;
  el.values = MEMBERS.slice(0, count).map((m) => m.value);
  await settle(el);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await settle(el);
  return el;
};

/** The one layer below `parent` in a variant (Figma names the "+N" text by its count). */
const childLayer = (family: string, values: Record<string, string>, parent: string[]) => {
  const f = figma.get(family)!;
  const at = parent.join(' > ') + ' > ';
  const layer = layersOf(f, variantIndex(f, values)).find(
    (l) => l.path.join(' > ').startsWith(at) && l.path.length === parent.length + 1,
  );
  return layer?.path;
};
const valueFamily = (view: string) => `Oddkin/Common/multiselect/Value/${view}`;
const hasLayer = (family: string, values: Record<string, string>, path: string[]) => {
  const f = figma.get(family)!;
  return layersOf(f, variantIndex(f, values)).some((l) => l.path.join(' > ') === path.join(' > '));
};

// Figma's Count options per value display (multiselect/Value/<view>).
const COUNTS: Record<string, string[]> = {
  chips: ['0', '1', '3', '10', '32', '75'],
  count: ['0', '1', '3', '10', '32', '75'],
  text: ['0', '1', '2', '3', '10', '32', '75'],
  auto: ['0', '1', '2', '3', '4', '5', '10', '32', '75'],
  expandable: ['0', '1', '3', '10', '32', '75'],
  grouped: ['0', '1', '3', '10', '32', '75'],
  avatars: ['0', '1', '3', '10', '32', '75'],
};

describe('Figma parity: multiple value views (multiselect/Value/*)', () => {
  for (const view of ['chips', 'count', 'text', 'auto', 'expandable', 'grouped'] as const)
    for (const count of COUNTS[view]!)
      it(`${view} ${count}`, async () => {
        const family = valueFamily(view);
        const values = { Count: count };
        const el = await mountMembers(view, Number(count));
        const root = el.shadowRoot!;
        const targets: Target[] = [];
        const more = (parent: string[]) => {
          const overflow = [...parent, 'Selection overflow'];
          if (!hasLayer(family, values, overflow)) return;
          targets.push({ layer: overflow, el: shadowPart(el, 'more'), kind: 'frame' });
          targets.push({
            layer: childLayer(family, values, overflow)!,
            el: shadowPart(el, 'more'),
            kind: 'text',
          });
        };
        if (count === '0')
          targets.push({
            layer: ['Placeholder'],
            el: shadowPart(el, 'input'),
            kind: 'text',
            pseudo: '::placeholder',
          });
        else if (hasLayer(family, values, ['Visible chips'])) {
          targets.push({
            layer: ['Visible chips'],
            el: root.querySelector('.chips')!,
            kind: 'frame',
            gap: 'column-gap',
          });
          more(['Visible chips']);
        } else if (hasLayer(family, values, ['Count summary']))
          targets.push(
            {
              layer: ['Count summary'],
              el: shadowPart(el, 'value'),
              kind: 'frame',
              gap: 'column-gap',
            },
            {
              layer: ['Count summary', 'Value'],
              el: root.querySelector('.value-text')!,
              kind: 'text',
            },
          );
        else if (view === 'text')
          targets.push({ layer: ['Value'], el: shadowPart(el, 'value'), kind: 'text' });
        else if (view === 'expandable') {
          targets.push({
            layer: ['Selected chips · row 1'],
            el: root.querySelector('.chips')!,
            kind: 'frame',
            gap: 'column-gap',
          });
          more(['Selected chips · row 2']);
        } else if (view === 'grouped') {
          const summaries = [...root.querySelectorAll<HTMLElement>('[part~="group-summary"]')];
          targets.push({
            layer: ['Group summary'],
            el: root.querySelector('.chips')!,
            kind: 'frame',
            gap: 'column-gap',
          });
          summaries.forEach((summary, i) => {
            const layer = [
              'Group summary',
              i ? `Selection overflow [${i + 1}]` : 'Selection overflow',
            ];
            if (!hasLayer(family, values, layer)) return;
            targets.push({ layer, el: summary, kind: 'frame' });
            targets.push({ layer: childLayer(family, values, layer)!, el: summary, kind: 'text' });
          });
        }
        await transitions(targets);
        expectNone(compare(family, values, targets));
      });
});

deliberate([
  /^AvatarItem .* (top|bottom)(Left|Right)Radius \(--odd-radius-full\): border-(start|end)-(start|end)-radius 50%/,
  'odd-avatar draws its circle with 50% of its own size; radius.full (9999px) draws the same circle.',
]);

describe('Figma parity: the avatars view (multiselect/Value/avatars, AvatarItem)', () => {
  it('draws each chosen member as an AvatarItem, overlapping by space.2xs', async () => {
    const el = await mountMembers('avatars', 3);
    const avatars = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="avatar"]')];
    expect(avatars).toHaveLength(3);
    const base = avatars[0]!.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const targets: Target[] = [
      { layer: [], el: base, kind: 'frame' },
      { layer: ['Initials'], el: base, kind: 'text' },
    ];
    await transitions(targets);
    expectNone(compare('Oddkin/Common/AvatarItem', {}, targets));
    // Figma's stack: itemSpacing -4 (a literal), the theme's space.2xs.
    const [first, second] = avatars.map((a) => a.getBoundingClientRect());
    expect(Math.round(first!.right - second!.left)).toBe(
      Math.round(parseFloat(themeValue('column-gap', '--odd-space-2xs'))),
    );
  });
});

describe('Figma parity: the selection panel (multiselect/SelectionPanel Inline)', () => {
  for (const layout of ['Inline', 'Inline collapsed'] as const)
    it(layout, async () => {
      const el = await mountMembers('count', 32, 'review');
      shadowPart(el, 'input').focus();
      await userEvent.keyboard('{ArrowDown}');
      await settle(el);
      if (layout === 'Inline collapsed') {
        shadowPart(el, 'selected-toggle').click();
        await settle(el);
      }
      const root = el.shadowRoot!;
      const section = ['Menu content', 'Selected-items section'];
      const targets: Target[] = [
        {
          layer: ['Menu content'],
          el: root.querySelector('.selection')!,
          kind: 'frame',
          gap: 'row-gap',
        },
        {
          layer: ['Menu content', 'Selection summary'],
          el: root.querySelector('.selection-summary')!,
          kind: 'frame',
          gap: 'column-gap',
        },
        {
          layer: ['Menu content', 'Selection summary', '32 selected'],
          el: shadowPart(el, 'summary'),
          kind: 'text',
        },
        { layer: section, el: shadowPart(el, 'selected'), kind: 'frame' },
        {
          layer: [...section, 'Selected section toggle'],
          el: shadowPart(el, 'selected-toggle'),
          kind: 'frame',
          gap: 'column-gap',
        },
        {
          layer: [...section, 'Selected section toggle', 'Selected (32)'],
          el: root.querySelector('.selected-heading')!,
          kind: 'text',
        },
      ];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/multiselect/SelectionPanel', { Layout: layout }, targets));
    });
});

describe('Figma parity: the selected-items review (multiselect/SelectedItems)', () => {
  it('Show all opens the bounded review of every chosen value', async () => {
    const el = await mountMembers('expandable', 32);
    shadowPart(el, 'show-all').click();
    await settle(el);
    const review = shadowPart(el, 'review');
    const targets: Target[] = [
      { layer: [], el: review, kind: 'frame', gap: 'row-gap' },
      {
        layer: ['32 selected · scroll to review all names'],
        el: review.querySelector('.review-count')!,
        kind: 'text',
      },
      {
        layer: ['Bounded selected-chip area', 'All selected chips'],
        el: review.querySelector('.chips')!,
        kind: 'frame',
        gap: 'column-gap',
      },
    ];
    await transitions(targets);
    expectNone(compare('Oddkin/Common/multiselect/SelectedItems', {}, targets));
    // Figma's 160 px scrolling area.
    expect(getComputedStyle(review.querySelector('.chips')!).maxBlockSize).toBe('160px');
  });
});
