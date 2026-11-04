import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import type {
  OddkinTable,
  TableCell,
  TableColumn,
  TableRow,
  TableSortDetail,
  TableSortDirection,
} from '../src/table/table.js';
import { sortRows } from '../src/table/table.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-table, with the shipped theme.
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

const COLUMNS: readonly TableColumn[] = [
  { key: 'name', label: 'Project', sortable: true },
  { key: 'owner', label: 'Owner' },
  { key: 'tasks', label: 'Open tasks', align: 'end', sortable: true },
  { key: 'active', label: 'Active' },
];
const ROWS: readonly TableRow[] = [
  { id: 'b', cells: { name: 'beacon', owner: 'Jonas', tasks: 31, active: true } },
  { id: 'a', cells: { name: 'Atlas', owner: 'Mira', tasks: 12, active: false } },
  { id: 'd', cells: { name: 'Delta', owner: 'Sam', tasks: null } },
  { id: 'c', cells: { name: 'cinder 10', owner: 'Ada', tasks: 4, active: true } },
  { id: 'e', cells: { name: 'cinder 9', owner: 'Lee', tasks: 4 } },
];

async function mount(props: Partial<OddkinTable> = {}, html = '') {
  container = document.createElement('div');
  container.innerHTML = `<odd-table label="Projects" style="inline-size: 640px">${html}</odd-table>`;
  document.body.append(container);
  const el = container.querySelector<OddkinTable>('odd-table')!;
  Object.assign(el, { columns: COLUMNS, rows: ROWS, ...props });
  await settle(el);
  const log: string[] = [];
  el.addEventListener('odd-sort', (e) => {
    const { column, direction } = (e as CustomEvent<TableSortDetail>).detail;
    log.push(`sort ${column} ${direction}`);
  });
  el.addEventListener('input', () => log.push(`input ${el.selected}`));
  el.addEventListener('change', () => log.push(`change ${el.selected}`));
  return { el, log };
}
const root = (el: Element) => el.shadowRoot!;
const bodyRows = (el: Element) => [...root(el).querySelectorAll<HTMLElement>('tbody tr')];
const column = (el: Element, index: number) =>
  bodyRows(el).map((row) =>
    row.querySelectorAll(':scope > :is(th, td):not(.selection)')[index]!.textContent!.trim(),
  );
const header = (el: Element, label: string) =>
  [...root(el).querySelectorAll<HTMLElement>('thead th')].find(
    (th) => th.textContent!.trim() === label,
  )!;

describe('<odd-table>', () => {
  it('renders the columns and rows as a native table named by its label', async () => {
    const { el } = await mount();
    const table = root(el).querySelector('table')!;
    expect(table.getAttribute('aria-label')).toBe('Projects');
    expect(
      [...root(el).querySelectorAll('thead th')].map((th) => [
        th.textContent!.trim(),
        th.getAttribute('scope'),
      ]),
    ).toEqual([
      ['Project', 'col'],
      ['Owner', 'col'],
      ['Open tasks', 'col'],
      ['Active', 'col'],
    ]);
    // The first cell of each row is its header; booleans read as text, and null is empty.
    expect(bodyRows(el)[0]!.firstElementChild!.matches('th[scope="row"]')).toBe(true);
    expect(column(el, 0)).toEqual(['beacon', 'Atlas', 'Delta', 'cinder 10', 'cinder 9']);
    expect(column(el, 2)).toEqual(['31', '12', '', '4', '4']);
    expect(column(el, 3)).toEqual(['Yes', 'No', '', 'Yes', '']);
    // End-aligned columns, header and cells.
    expect(getComputedStyle(header(el, 'Open tasks')).textAlign).toBe('end');
    expect(getComputedStyle(bodyRows(el)[0]!.children[2]!).textAlign).toBe('end');
    // The theme's header surface and row rules.
    expect(getComputedStyle(header(el, 'Owner')).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-sunken'),
    );
  });

  it('sorts by sort and direction, stably, with empty cells last both ways', async () => {
    const { el } = await mount({ sort: 'tasks' });
    expect(column(el, 0)).toEqual(['cinder 10', 'cinder 9', 'Atlas', 'beacon', 'Delta']);
    expect(header(el, 'Open tasks').getAttribute('aria-sort')).toBe('ascending');
    expect(header(el, 'Project').hasAttribute('aria-sort')).toBe(false);
    el.direction = 'descending';
    await settle(el);
    expect(column(el, 0)).toEqual(['beacon', 'Atlas', 'cinder 10', 'cinder 9', 'Delta']);
    expect(header(el, 'Open tasks').getAttribute('aria-sort')).toBe('descending');
    // Text compares by the language's collation, numbers inside it numerically.
    el.sort = 'name';
    el.direction = 'ascending';
    await settle(el);
    expect(column(el, 0)).toEqual(['Atlas', 'beacon', 'cinder 9', 'cinder 10', 'Delta']);
    // An unknown column, or no sort, keeps the given order.
    el.sort = 'nope';
    await settle(el);
    expect(column(el, 0)).toEqual(['beacon', 'Atlas', 'Delta', 'cinder 10', 'cinder 9']);
  });

  it('orders numbers as numbers, text by collation, false before true, and empty cells last', () => {
    const collator = new Intl.Collator('en', { numeric: true });
    const order = (values: readonly TableCell[], direction: TableSortDirection = 'ascending') =>
      sortRows(
        values.map((value, index) => ({ id: String(index), cells: { v: value } })),
        'v',
        direction,
        collator,
      ).map((row) => `${row.id}:${String(row.cells['v'])}`);
    expect(order([10, 9, null, 100, 9])).toEqual(['1:9', '4:9', '0:10', '3:100', '2:null']);
    // Descending reverses the values, not the ties, and keeps empty cells last.
    expect(order([10, 9, null, 100, 9], 'descending')).toEqual([
      '3:100',
      '0:10',
      '1:9',
      '4:9',
      '2:null',
    ]);
    expect(order([true, false, '', true])).toEqual(['1:false', '0:true', '3:true', '2:']);
    expect(order(['b', 'A', 'a10', 'a9'])).toEqual(['1:A', '3:a9', '2:a10', '0:b']);
    expect(order(['b', 'A', 'a10', 'a9'], 'descending')).toEqual(['0:b', '2:a10', '3:a9', '1:A']);
    // Numbers compare as numbers, which text with numeric collation would not do for these.
    expect(order([1.5, -2, 1.25])).toEqual(['1:-2', '2:1.25', '0:1.5']);
    // Values of different types compare as text.
    expect(order(['x', 2, true])).toEqual(['1:2', '2:true', '0:x']);
  });

  it('sorts from a sortable header, reports odd-sort, and keeps the order when it is canceled', async () => {
    const { el, log } = await mount();
    expect(header(el, 'Owner').querySelector('button')).toBeNull();
    const sortButton = (label: string) => header(el, label).querySelector('button')!;
    await userEvent.click(sortButton('Open tasks'));
    await settle(el);
    expect([el.sort, el.direction, el.getAttribute('sort'), el.getAttribute('direction')]).toEqual([
      'tasks',
      'ascending',
      'tasks',
      'ascending',
    ]);
    expect(column(el, 0)[0]).toBe('cinder 10');
    await userEvent.click(sortButton('Open tasks'));
    await settle(el);
    expect(el.direction).toBe('descending');
    await userEvent.click(sortButton('Project'));
    await settle(el);
    expect(log).toEqual(['sort tasks ascending', 'sort tasks descending', 'sort name ascending']);
    // Keyboard: Enter on the focused button.
    sortButton('Project').focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.direction).toBe('descending');
    el.addEventListener('odd-sort', (e) => e.preventDefault(), { once: true });
    await userEvent.click(sortButton('Open tasks'));
    await settle(el);
    expect([el.sort, el.direction]).toEqual(['name', 'descending']);
  });

  it('with no-sort keeps the given order and still marks the sorted header', async () => {
    const { el, log } = await mount({ noSort: true, sort: 'tasks', direction: 'descending' });
    expect(el.hasAttribute('no-sort')).toBe(true);
    expect(column(el, 0)).toEqual(['beacon', 'Atlas', 'Delta', 'cinder 10', 'cinder 9']);
    expect(header(el, 'Open tasks').getAttribute('aria-sort')).toBe('descending');
    await userEvent.click(header(el, 'Project').querySelector('button')!);
    await settle(el);
    expect(log).toEqual(['sort name ascending']);
    expect(column(el, 0)).toEqual(['beacon', 'Atlas', 'Delta', 'cinder 10', 'cinder 9']);
  });

  it('selects one row with radios named from the first cell', async () => {
    const { el, log } = await mount({ selection: 'single', selected: ['a'] });
    const controls = [...root(el).querySelectorAll<HTMLInputElement>('tbody input')];
    expect(
      controls.map((input) => [input.type, input.getAttribute('aria-label'), input.checked]),
    ).toEqual([
      ['radio', 'Select beacon', false],
      ['radio', 'Select Atlas', true],
      ['radio', 'Select Delta', false],
      ['radio', 'Select cinder 10', false],
      ['radio', 'Select cinder 9', false],
    ]);
    expect(bodyRows(el)[1]!.classList.contains('selected')).toBe(true);
    await userEvent.click(controls[2]!);
    await settle(el);
    expect(el.selected).toEqual(['d']);
    expect(log).toEqual(['input d', 'change d']);
    expect(bodyRows(el).map((row) => row.classList.contains('selected'))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    // The arrow keys move the selection between the radios (WebKit does not focus a clicked radio).
    controls[2]!.focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle(el);
    expect(el.selected).toEqual(['c']);
    expect(root(el).querySelector('thead .selection')!.textContent!.trim()).toBe('Selection');
  });

  it('selects nothing with selection none, and names a row by its id without a first cell', async () => {
    const { el } = await mount({
      selected: ['a'],
      rows: [...ROWS, { id: 'x', cells: { name: null } }],
    });
    expect(root(el).querySelector('input')).toBeNull();
    expect(bodyRows(el).some((row) => row.classList.contains('selected'))).toBe(false);
    el.selection = 'multiple';
    await settle(el);
    expect(bodyRows(el)[1]!.classList.contains('selected')).toBe(true);
    expect(root(el).querySelectorAll('tbody input')[5]!.getAttribute('aria-label')).toBe(
      'Select x',
    );
  });

  it('selects several rows with checkboxes, and every row or none from the header', async () => {
    const { el, log } = await mount({ selection: 'multiple', selected: ['a', 'elsewhere'] });
    const all = root(el).querySelector<HTMLInputElement>('thead input')!;
    expect([all.getAttribute('aria-label'), all.checked, all.indeterminate]).toEqual([
      'Select all rows',
      false,
      true,
    ]);
    const box = (index: number) =>
      root(el).querySelectorAll<HTMLInputElement>('tbody input')[index]!;
    await userEvent.click(box(0));
    await settle(el);
    expect(el.selected).toEqual(['a', 'elsewhere', 'b']);
    await userEvent.click(box(1));
    await settle(el);
    expect(el.selected).toEqual(['elsewhere', 'b']);
    await userEvent.click(all);
    await settle(el);
    expect(el.selected).toEqual(['elsewhere', 'b', 'a', 'd', 'c', 'e']);
    expect([all.checked, all.indeterminate]).toEqual([true, false]);
    await userEvent.click(all);
    await settle(el);
    expect(el.selected).toEqual(['elsewhere']);
    expect(log).toEqual([
      'input a,elsewhere,b',
      'change a,elsewhere,b',
      'input elsewhere,b',
      'change elsewhere,b',
      'input elsewhere,b,a,d,c,e',
      'change elsewhere,b,a,d,c,e',
      'input elsewhere',
      'change elsewhere',
    ]);
    // A selected row takes the selection surface.
    el.selected = ['b'];
    await settle(el);
    expect(getComputedStyle(bodyRows(el)[0]!).backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-surface'),
    );
  });

  it('shows loading, then an error, then the rows, then the empty state, each in their place', async () => {
    const { el } = await mount(
      { loading: true, error: 'The projects could not be loaded.', selection: 'multiple' },
      '<button slot="error">Try again</button>',
    );
    const status = () => root(el).querySelector<HTMLElement>('[part~="status"]');
    const all = () => root(el).querySelector<HTMLInputElement>('thead input')!;
    const table = root(el).querySelector('table')!;
    // Loading comes first, over the rows and the error, across the selection column too.
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(status()!.textContent!.trim()).toBe('Loading…');
    expect(status()!.getAttribute('colspan')).toBe('5');
    expect(all().disabled).toBe(true);
    el.loading = false;
    await settle(el);
    expect(table.hasAttribute('aria-busy')).toBe(false);
    expect(status()!.querySelector('[role="alert"]')!.textContent).toBe(
      'The projects could not be loaded.',
    );
    const slot = status()!.querySelector<HTMLSlotElement>('slot[name="error"]')!;
    expect(slot.assignedElements().map((e) => e.textContent)).toEqual(['Try again']);
    expect(all().disabled).toBe(true);
    el.error = '';
    await settle(el);
    expect(status()).toBeNull();
    expect(bodyRows(el)).toHaveLength(5);
    expect(all().disabled).toBe(false);
    el.selection = 'none';
    el.rows = [];
    await settle(el);
    expect(status()!.textContent!.trim()).toBe('No rows to show');
    expect(status()!.getAttribute('colspan')).toBe('4');
    // The header stays in every state.
    expect(root(el).querySelectorAll('thead th')).toHaveLength(4);
  });
});
