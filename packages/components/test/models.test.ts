import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { toJSONSchema } from '@oddkin/core/model/schema';
import { m, type Infer } from '@oddkin/core/model';
import {
  NavigationItemModel,
  navigationModel,
  TableColumnModel,
  TableRowModel,
  type Navigation,
  type TableColumn,
  type TableRow,
} from '../src/models/index.js';
import { navigationKinds } from '../src/side-nav/index.js';

const navigation = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '/overview' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [{ id: 'theming', kind: 'link', label: 'Theming', href: '/guides/theming' }],
  },
  { id: 'create', kind: 'action', label: 'Create project', action: 'project.create' },
] satisfies Navigation;

// Invalid combinations are type errors locally.
// @ts-expect-error -- a link needs an href
const noHref: Navigation = [{ id: 'a', kind: 'link', label: 'A' }];
// @ts-expect-error -- an action names its action
const noAction: Navigation = [{ id: 'b', kind: 'action', label: 'B', href: '/b' }];
void noHref;
void noAction;

const codes = (result: { diagnostics: readonly { code: string; path: string }[] }) =>
  result.diagnostics.map((d) => [d.code, d.path]);

describe('NavigationItemModel', () => {
  it('accepts valid navigation without copying it', () => {
    const result = NavigationItemModel.validate(navigation);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(navigation);
  });

  it('rejects external data with path-precise diagnostics', () => {
    const result = NavigationItemModel.validate([
      { id: 'a', kind: 'link', label: 'A' },
      { id: 'b', kind: 'link', label: 'B', href: 'javascript:alert(1)' },
      { id: 'c', kind: 'group', label: '', items: [{ id: 'd', kind: 'menu', label: 'D' }] },
    ]);
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual([
      ['model.required.missing', '/0/href'],
      ['model.url.unsafe', '/1/href'],
      ['model.label.empty', '/2/label'],
      ['model.kind.unknown', '/2/items/0/kind'],
    ]);
    const duplicate = NavigationItemModel.validate([
      { id: 'a', kind: 'link', label: 'A', href: '/a' },
      {
        id: 'g',
        kind: 'group',
        label: 'G',
        items: [{ id: 'a', kind: 'link', label: 'A', href: '/' }],
      },
    ]);
    expect(codes(duplicate)).toEqual([['model.id.duplicate', '/1/items/0/id']]);
  });

  it('migrates version 0 data (title, children) to version 1', () => {
    const result = NavigationItemModel.migrate(
      [
        {
          id: 'guides',
          kind: 'group',
          title: 'Guides',
          children: [{ id: 't', kind: 'link', title: 'Theming', href: '/t' }],
        },
      ],
      0,
    );
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([
      {
        id: 'guides',
        kind: 'group',
        label: 'Guides',
        items: [{ id: 't', kind: 'link', label: 'Theming', href: '/t' }],
      },
    ]);
    expect(codes(NavigationItemModel.migrate([], 2))).toEqual([['model.version.unsupported', '']]);
  });

  it('publishes a JSON Schema that agrees with validate() on portable cases', () => {
    const schema = toJSONSchema(NavigationItemModel);
    const ajv = new Ajv2020({ strict: false });
    addFormats.default(ajv);
    const check = ajv.compile(schema);
    expect(check(navigation)).toBe(true);
    const missingHref = [{ id: 'a', kind: 'link', label: 'A' }];
    expect(check(missingHref)).toBe(false);
    expect(NavigationItemModel.validate(missingHref).ok).toBe(false);
  });
});

describe('navigationModel(kinds)', () => {
  const kinds = navigationKinds.extend({
    'badge-link': {
      semantics: 'link',
      model: m.object({ id: m.id(), label: m.label(), href: m.url(), count: m.number() }),
      render: (item) => item.label,
    },
  });
  const model = navigationModel(kinds);
  const data = [
    ...navigation,
    { id: 'inbox', kind: 'badge-link', label: 'Inbox', href: '/inbox', count: 3 },
    {
      id: 'more',
      kind: 'group',
      label: 'More',
      items: [{ id: 'alerts', kind: 'badge-link', label: 'Alerts', href: '/alerts', count: 1 }],
    },
  ];

  it('validates project kinds at any depth with their model fragments', () => {
    expect(model.validate(data).ok).toBe(true);
    // The built-in model and an element without these kinds know nothing about them.
    expect(codes(NavigationItemModel.validate(data))).toEqual([
      ['model.kind.unknown', '/3/kind'],
      ['model.kind.unknown', '/4/items/0/kind'],
    ]);
    expect(
      codes(
        model.validate([{ id: 'x', kind: 'badge-link', label: 'X', href: '/x', count: 'many' }]),
      ),
    ).toEqual([['model.type.mismatch', '/0/count']]);
  });

  it('keeps ids unique across built-in and project kinds and publishes the kinds in its schema', () => {
    expect(codes(model.validate([...data, { ...data[3]! }]))).toEqual([
      ['model.id.duplicate', '/5/id'],
    ]);
    const check = new Ajv2020({ strict: false }).compile(toJSONSchema(model));
    expect(check(data)).toBe(true);
    expect(check([{ id: 'x', kind: 'badge-link', label: 'X', href: '/x' }])).toBe(false);
  });
});

describe('TableColumnModel and TableRowModel', () => {
  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'id', label: 'Code' },
    { key: 'budget', label: 'Budget', align: 'end', sortable: true },
  ] satisfies TableColumn[];
  const rows = [
    { id: 'atlas', cells: { name: 'Atlas', id: 'A-1', budget: 1200, archived: false } },
    { id: 'beacon', cells: { name: 'Beacon', id: 'atlas', budget: null } },
  ] satisfies TableRow[];
  // @ts-expect-error -- a cell holds one plain value
  const nested: TableRow = { id: 'x', cells: { name: { first: 'X' } } };
  void nested;

  it('names the types the models infer', () => {
    expectTypeOf<TableColumn>().toEqualTypeOf<Infer<typeof TableColumnModel>[number]>();
    expectTypeOf<TableRow>().toEqualTypeOf<Infer<typeof TableRowModel>[number]>();
  });

  it('accepts columns and rows, a cell keyed like a row id included, without copying them', () => {
    expect(TableColumnModel.validate(columns)).toEqual({
      ok: true,
      value: columns,
      diagnostics: [],
    });
    expect(TableRowModel.validate(rows)).toEqual({ ok: true, value: rows, diagnostics: [] });
  });

  it('reports duplicate keys and ids, bad alignments, and cells that are not plain values', () => {
    expect(
      codes(
        TableColumnModel.validate([
          { key: 'name', label: 'Name' },
          { key: 'size', label: ' ', align: 'left' },
        ]),
      ),
    ).toEqual([
      ['model.label.empty', '/1/label'],
      ['model.value.invalid', '/1/align'],
    ]);
    expect(
      codes(
        TableColumnModel.validate([
          { key: 'name', label: 'Name' },
          { key: 'name', label: 'Name again' },
        ]),
      ),
    ).toEqual([['model.id.duplicate', '/1/key']]);
    expect(
      codes(
        TableRowModel.validate([
          { id: 'a', cells: { name: ['A'] } },
          { id: 'b', cells: [] },
        ]),
      ),
    ).toEqual([
      ['model.type.mismatch', '/0/cells/name'],
      ['model.type.mismatch', '/1/cells'],
    ]);
    expect(
      codes(
        TableRowModel.validate([
          { id: 'a', cells: {} },
          { id: 'a', cells: {} },
        ]),
      ),
    ).toEqual([['model.id.duplicate', '/1/id']]);
  });

  it('publishes JSON Schemas that agree with validate() on portable cases', () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    const checkColumns = ajv.compile(toJSONSchema(TableColumnModel));
    const checkRows = ajv.compile(toJSONSchema(TableRowModel));
    for (const sample of [columns, [{ key: 'a' }], [{ key: 'a', label: 'A', align: 'left' }]])
      expect(checkColumns(sample)).toBe(TableColumnModel.validate(sample).ok);
    for (const sample of [rows, [{ id: 'a', cells: { x: [1] } }], [{ id: 'a' }]])
      expect(checkRows(sample)).toBe(TableRowModel.validate(sample).ok);
  });
});
