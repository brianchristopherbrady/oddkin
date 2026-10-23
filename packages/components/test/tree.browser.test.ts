import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinTree, TreeItemRecord } from '../src/tree/tree.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-tree (component-contracts.md §3.4), with the shipped theme.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
  flush();
});

const ITEMS: readonly TreeItemRecord[] = [
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

async function mount(props: Partial<OddkinTree> = {}, attributes = '') {
  container = document.createElement('div');
  container.innerHTML = `<button id="before">before</button><odd-tree label="Project files" style="inline-size: 320px" ${attributes}></odd-tree><button id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector<OddkinTree>('odd-tree')!;
  Object.assign(el, { items: ITEMS, ...props });
  await settle(el);
  const log: string[] = [];
  el.addEventListener('odd-toggle', (e) => {
    const { id, expanded } = (e as CustomEvent<{ id: string; expanded: boolean }>).detail;
    log.push(`toggle ${id} ${expanded}`);
  });
  el.addEventListener('input', () => log.push(`input ${el.multiple ? el.values : el.value}`));
  el.addEventListener('change', () => log.push(`change ${el.multiple ? el.values : el.value}`));
  return { el, log };
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const rows = (el: Element) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]'),
];
const labels = (el: Element) => rows(el).map((row) => row.querySelector('.label')!.textContent);
const row = (el: Element, label: string) =>
  rows(el).find((each) => each.querySelector('.label')!.textContent === label)!;
/** The focused row's label, or the id of the focused element outside the tree. */
const focused = () => {
  const active = document.activeElement;
  return active?.shadowRoot?.activeElement?.querySelector('.label')?.textContent ?? active?.id;
};
const press = async (el: OddkinTree, label: string, keys: string) => {
  row(el, label).focus();
  await userEvent.keyboard(keys);
  await settle(el);
};

describe('odd-tree', () => {
  it('is a named tree of rows with their level, place, expansion, and selection', async () => {
    const { el } = await mount({ value: 'text-field' });
    await expect
      .element(page.getByRole('tree', { name: 'Project files', exact: true }))
      .toBeVisible();
    // Items holding the selected item start expanded.
    expect(labels(el)).toEqual([
      'Components',
      'Forms',
      'Text field',
      'Combobox',
      'Navigation',
      'Foundations',
    ]);
    const attributes = (label: string) =>
      ['aria-level', 'aria-setsize', 'aria-posinset', 'aria-expanded', 'aria-selected'].map(
        (name) => row(el, label).getAttribute(name),
      );
    expect(attributes('Components')).toEqual(['1', '2', '1', 'true', null]);
    expect(attributes('Forms')).toEqual(['2', '2', '1', 'true', null]);
    expect(attributes('Text field')).toEqual(['3', '2', '1', null, 'true']);
    expect(attributes('Combobox')).toEqual(['3', '2', '2', null, null]);
    expect(attributes('Navigation')).toEqual(['2', '2', '2', 'false', null]);
    expect(attributes('Foundations')).toEqual(['1', '2', '2', 'false', null]);
    expect(part(el, 'tree').hasAttribute('aria-multiselectable')).toBe(false);
    expect(part(el, 'tree').hasAttribute('aria-busy')).toBe(false);
    expect(part(el, 'loading').hidden).toBe(true);
    expect(part(el, 'empty').hidden).toBe(true);
    // With `multiple`, every row reports whether it is selected.
    el.multiple = true;
    el.values = ['combobox'];
    await settle(el);
    expect(part(el, 'tree').getAttribute('aria-multiselectable')).toBe('true');
    expect(row(el, 'Combobox').getAttribute('aria-selected')).toBe('true');
    expect(row(el, 'Components').getAttribute('aria-selected')).toBe('false');
  });

  it('is one Tab stop, on the selected row or else the first', async () => {
    const { el } = await mount({ value: 'combobox' });
    (container.querySelector('#before') as HTMLElement).focus();
    await userEvent.tab();
    expect(focused()).toBe('Combobox');
    await userEvent.tab();
    expect(focused()).toBe('after');
    el.value = '';
    await settle(el);
    (container.querySelector('#before') as HTMLElement).focus();
    await userEvent.tab();
    expect(focused()).toBe('Components');
    expect(rows(el).filter((each) => each.tabIndex === 0)).toHaveLength(1);
  });

  it('moves with Up, Down, Home, and End, and expands, enters, collapses, and leaves with the inline arrows', async () => {
    const { el, log } = await mount();
    expect(labels(el)).toEqual(['Components', 'Foundations']);
    await press(el, 'Components', '{ArrowDown}');
    expect(focused()).toBe('Foundations');
    await userEvent.keyboard('{ArrowUp}');
    expect(focused()).toBe('Components');
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    expect(log).toEqual(['toggle components true']);
    expect(labels(el)).toEqual(['Components', 'Forms', 'Navigation', 'Foundations']);
    expect(focused()).toBe('Components');
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('Forms');
    // A leaf ignores Right; Left goes to the parent.
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    await settle(el);
    expect(focused()).toBe('Text field');
    await userEvent.keyboard('{ArrowLeft}');
    expect(focused()).toBe('Forms');
    await userEvent.keyboard('{ArrowLeft}');
    await settle(el);
    expect(row(el, 'Forms').getAttribute('aria-expanded')).toBe('false');
    expect(focused()).toBe('Forms');
    await userEvent.keyboard('{End}{ArrowDown}');
    expect(focused()).toBe('Foundations');
    await userEvent.keyboard('{Home}');
    expect(focused()).toBe('Components');
    // At a top-level row, Left with nothing to collapse stays.
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await settle(el);
    expect(focused()).toBe('Components');
    expect(log).toEqual([
      'toggle components true',
      'toggle forms true',
      'toggle forms false',
      'toggle components false',
    ]);
  });

  it('mirrors the inline arrows right to left', async () => {
    const { el } = await mount({}, 'dir="rtl"');
    await press(el, 'Components', '{ArrowLeft}');
    expect(row(el, 'Components').getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(focused()).toBe('Forms');
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('Components');
    // The closed chevron points to the inline end, so it is mirrored too.
    const chevron = row(el, 'Foundations').querySelector('.toggle svg')!;
    expect(getComputedStyle(chevron).scale).toBe('-1 1');
  });

  it('selects with Enter, Space, or a click on the row, and reports it once', async () => {
    const { el, log } = await mount();
    await press(el, 'Foundations', '{Enter}');
    expect(el.value).toBe('foundations');
    await userEvent.keyboard('{Enter}');
    await press(el, 'Components', ' ');
    expect(el.value).toBe('components');
    await userEvent.click(row(el, 'Foundations').querySelector('.label')!);
    await settle(el);
    expect(el.value).toBe('foundations');
    expect(log).toEqual([
      'input foundations',
      'change foundations',
      'input components',
      'change components',
      'input foundations',
      'change foundations',
    ]);
    expect(row(el, 'Foundations').getAttribute('aria-selected')).toBe('true');
    expect(row(el, 'Components').hasAttribute('aria-selected')).toBe(false);
  });

  it('toggles items in and out of the selection with multiple', async () => {
    const { el, log } = await mount({ multiple: true, values: ['foundations'] });
    await press(el, 'Components', ' ');
    expect(el.values).toEqual(['foundations', 'components']);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await settle(el);
    expect(el.values).toEqual(['components']);
    expect(log).toEqual([
      'input foundations,components',
      'change foundations,components',
      'input components',
      'change components',
    ]);
  });

  it('expands or collapses with a click on the chevron, without selecting', async () => {
    const { el, log } = await mount();
    await userEvent.click(row(el, 'Components').querySelector('.toggle')!);
    await settle(el);
    expect(labels(el)).toContain('Forms');
    expect(el.value).toBe('');
    await userEvent.click(row(el, 'Components').querySelector('.toggle')!);
    await settle(el);
    expect(labels(el)).not.toContain('Forms');
    expect(log).toEqual(['toggle components true', 'toggle components false']);
  });

  it('expands every sibling with *, keeping focus and the Tab stop on the focused row', async () => {
    const { el, log } = await mount();
    await press(el, 'Foundations', '*');
    expect(log).toEqual(['toggle components true', 'toggle foundations true']);
    expect(labels(el)).toEqual(['Components', 'Forms', 'Navigation', 'Foundations', 'Color']);
    expect(focused()).toBe('Foundations');
    expect(row(el, 'Foundations').tabIndex).toBe(0);
    await userEvent.keyboard('{ArrowUp}');
    expect(focused()).toBe('Navigation');
  });

  it('moves to the next row starting with the typed characters', async () => {
    const { el } = await mount({ expanded: ['components', 'forms'] });
    await press(el, 'Components', 'f');
    expect(focused()).toBe('Forms');
    await userEvent.keyboard('f');
    expect(focused()).toBe('Foundations');
    // Space continues a query in progress instead of selecting.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await userEvent.keyboard('Text f');
    await settle(el);
    expect(focused()).toBe('Text field');
    expect(el.value).toBe('');
  });

  it('keeps or sets the expansion as odd-toggle allows', async () => {
    const { el, log } = await mount();
    el.addEventListener('odd-toggle', (e) => e.preventDefault(), { once: true });
    await press(el, 'Components', '{ArrowRight}');
    expect(row(el, 'Components').getAttribute('aria-expanded')).toBe('false');
    // Controlled: only `expanded` changes the rows.
    el.expanded = [];
    await settle(el);
    await press(el, 'Components', '{ArrowRight}');
    expect(labels(el)).toEqual(['Components', 'Foundations']);
    el.expanded = ['components', 'navigation'];
    await settle(el);
    expect(labels(el)).toEqual(['Components', 'Forms', 'Navigation', 'Tabs', 'Foundations']);
    expect(log).toEqual(['toggle components true', 'toggle components true']);
  });

  it('marks a lazy item busy until its children arrive', async () => {
    const lazy = [{ id: 'projects', label: 'Projects', lazy: true }];
    const { el, log } = await mount({ items: lazy });
    expect(row(el, 'Projects').getAttribute('aria-expanded')).toBe('false');
    await press(el, 'Projects', '{ArrowRight}');
    expect(log).toEqual(['toggle projects true']);
    expect(row(el, 'Projects').getAttribute('aria-busy')).toBe('true');
    expect(row(el, 'Projects').querySelector('.toggle .spinner')).not.toBeNull();
    el.items = [{ ...lazy[0]!, children: [{ id: 'site', label: 'Site' }] }];
    await settle(el);
    expect(labels(el)).toEqual(['Projects', 'Site']);
    expect(row(el, 'Projects').hasAttribute('aria-busy')).toBe(false);
    expect(focused()).toBe('Projects');
    // Loaded with no children: nothing to expand.
    el.items = [{ ...lazy[0]!, children: [] }];
    await settle(el);
    expect(row(el, 'Projects').hasAttribute('aria-expanded')).toBe(false);
  });

  it('skips disabled rows and neither selects nor expands them', async () => {
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta', disabled: true, children: [{ id: 'c', label: 'Gamma' }] },
      { id: 'd', label: 'Delta' },
    ];
    const { el, log } = await mount({ items });
    expect(row(el, 'Beta').getAttribute('aria-disabled')).toBe('true');
    await press(el, 'Alpha', '{ArrowDown}');
    expect(focused()).toBe('Delta');
    await userEvent.click(row(el, 'Beta').querySelector('.toggle')!, { force: true });
    await userEvent.click(row(el, 'Beta').querySelector('.label')!, { force: true });
    await settle(el);
    expect(labels(el)).toEqual(['Alpha', 'Beta', 'Delta']);
    expect(el.value).toBe('');
    expect(log).toEqual([]);
    expect(getComputedStyle(row(el, 'Beta')).cursor).toBe('not-allowed');
  });

  it('shows the loading, empty, and status states', async () => {
    const { el } = await mount({ items: [], loading: true });
    expect(part(el, 'tree').getAttribute('aria-busy')).toBe('true');
    expect(part(el, 'loading').hidden).toBe(false);
    expect(part(el, 'loading').textContent).toBe('Loading…');
    expect(part(el, 'loading').querySelector('.spinner')).not.toBeNull();
    expect(part(el, 'empty').hidden).toBe(true);
    el.loading = false;
    await settle(el);
    expect(part(el, 'tree').hasAttribute('aria-busy')).toBe(false);
    await expect.element(page.getByText('No items available')).toBeVisible();
    el.strings = { empty: 'Nothing here yet', loading: 'Fetching…' };
    await settle(el);
    await expect.element(page.getByText('Nothing here yet')).toBeVisible();
    el.innerHTML =
      '<p slot="empty">Add a file to start.</p><p slot="status" role="alert">Unable to load</p>';
    await expect.element(page.getByText('Add a file to start.')).toBeVisible();
    await expect.element(page.getByRole('alert')).toHaveTextContent('Unable to load');
    // Rows and the busy row together while refreshing.
    el.items = ITEMS;
    el.loading = true;
    await settle(el);
    expect(part(el, 'empty').hidden).toBe(true);
    expect(part(el, 'loading').textContent).toBe('Fetching…');
    expect(rows(el)).toHaveLength(2);
  });

  it('draws the surface, indents rows by level, and marks the selected row with a bar and weight', async () => {
    const { el } = await mount({ value: 'text-field' });
    const base = getComputedStyle(part(el, 'base'));
    expect(base.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-default'),
    );
    expect(base.borderTopColor).toBe(themeValue('border-top-color', '--odd-color-border-default'));
    expect(base.borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-card-radius'),
    );
    const indent = parseFloat(themeValue('margin-left', '--odd-navigation-indent'));
    const start = (label: string) => row(el, label).getBoundingClientRect().left;
    const inner = part(el, 'base').getBoundingClientRect().left + parseFloat(base.borderLeftWidth);
    expect(start('Components') - inner).toBeCloseTo(
      parseFloat(themeValue('padding-left', '--odd-space-sm')),
      0,
    );
    expect(start('Forms') - start('Components')).toBeCloseTo(indent, 0);
    expect(start('Text field') - start('Forms')).toBeCloseTo(indent, 0);
    // Indented rows end where the others do, separated by the navigation gap.
    const box = (label: string) => row(el, label).getBoundingClientRect();
    expect(box('Text field').right).toBeCloseTo(box('Components').right, 0);
    expect(box('Forms').top - box('Components').bottom).toBeCloseTo(
      parseFloat(themeValue('row-gap', '--odd-navigation-item-gap')),
      0,
    );
    // Labels of a level line up whether or not the row has a chevron: a leaf keeps the box.
    const toggle = (each: string) =>
      row(el, each).querySelector('.toggle')!.getBoundingClientRect();
    expect(toggle('Text field').width).toBeGreaterThan(0);
    expect(toggle('Text field').width).toBe(toggle('Forms').width);
    const label = (each: string) => row(el, each).querySelector('.label')!.getBoundingClientRect();
    expect(label('Navigation').left).toBeCloseTo(label('Forms').left, 0);
    const selected = getComputedStyle(row(el, 'Text field'));
    expect(selected.borderInlineStartColor).toBe(
      themeValue('border-left-color', '--odd-color-action-default'),
    );
    expect(selected.fontWeight).toBe(themeValue('font-weight', '--odd-font-weight-semibold'));
    expect(getComputedStyle(row(el, 'Combobox')).fontWeight).not.toBe(selected.fontWeight);
    await userEvent.hover(row(el, 'Combobox'));
    await expect
      .poll(() => getComputedStyle(row(el, 'Combobox')).backgroundColor)
      .toBe(themeValue('background-color', '--odd-color-surface-hover'));
  });

  it('draws item icons with odd-icon', async () => {
    const items = [{ id: 'readme', label: 'README', icon: '/icons/file.svg' }];
    const { el } = await mount({ items });
    const icon = row(el, 'README').querySelector('odd-icon')!;
    expect(icon).not.toBeNull();
    expect(customElements.get('odd-icon')).toBeDefined();
    expect(icon.getAttribute('src')).toBe('/icons/file.svg');
  });

  it.runIf(server.browser === 'chromium')('marks the selected row in forced colours', async () => {
    const session = cdp();
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    });
    try {
      const { el } = await mount({ value: 'text-field' });
      const probe = document.createElement('span');
      probe.style.color = 'Highlight';
      container.append(probe);
      expect(getComputedStyle(row(el, 'Text field')).borderInlineStartColor).toBe(
        getComputedStyle(probe).color,
      );
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] });
    }
  });

  it('releases everything when removed', async () => {
    const before = scopeStats();
    const { el } = await mount({ value: 'text-field' });
    await press(el, 'Forms', 'f');
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
