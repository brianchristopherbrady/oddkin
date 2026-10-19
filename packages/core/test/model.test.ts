import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineModel, m, type Infer } from '../src/model/index.js';
import { toJSONSchema } from '../src/model/schema.js';

const NavigationItemModel = defineModel('acme.navigation-item', {
  version: 2,
  description: 'Navigation entries for a side navigation.',
  schema: m.array(
    m.recursive(
      (self) =>
        m.union('kind', {
          link: m.object({
            id: m.id(),
            label: m.label(),
            href: m.url(),
            target: m.optional(m.enum(['_blank', '_self'])),
            disabled: m.optional(m.boolean()),
          }),
          action: m.object({
            id: m.id(),
            label: m.label(),
            action: m.actionRef(),
            disabled: m.optional(m.boolean()),
          }),
          group: m.object({
            id: m.id(),
            label: m.label(),
            items: m.array(self),
            expanded: m.optional(m.boolean()),
          }),
        }),
      'NavigationItem',
    ),
  ),
  rules: [m.uniqueIds('id')],
  migrations: {
    // v1 used `title`; v2 renamed it to `label`.
    2: (data) => rename(data),
  },
});

function rename(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(rename);
  if (data && typeof data === 'object') {
    const { title, ...rest } = data as Record<string, unknown>;
    const out: Record<string, unknown> = title === undefined ? rest : { ...rest, label: title };
    if (Array.isArray(out['items'])) out['items'] = rename(out['items']);
    return out;
  }
  return data;
}

type Navigation = Infer<typeof NavigationItemModel>;
type NavigationItem = Navigation[number];

const valid = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '/overview' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [
      { id: 'theming', kind: 'link', label: 'Theming', href: '/guides/theming', target: '_self' },
    ],
  },
  { id: 'create', kind: 'action', label: 'Create project', action: 'project.create' },
] satisfies Navigation;

const codes = (result: { diagnostics: readonly { code: string; path: string }[] }) =>
  result.diagnostics.map((d) => [d.code, d.path]);

describe('model types', () => {
  it('infers discriminated, recursive, and optional fields', () => {
    expectTypeOf<Extract<NavigationItem, { kind: 'link' }>>().toEqualTypeOf<{
      kind: 'link';
      id: string;
      label: string;
      href: string;
      target?: '_blank' | '_self' | undefined;
      disabled?: boolean | undefined;
    }>();
    expectTypeOf<Extract<NavigationItem, { kind: 'group' }>['items']>().toEqualTypeOf<
      NavigationItem[]
    >();
    // @ts-expect-error -- an action needs `action`
    const missing: NavigationItem = { id: 'x', kind: 'action', label: 'X' };
    void missing;
  });
});

describe('model validation', () => {
  it('accepts valid data and returns it unchanged', () => {
    const result = NavigationItemModel.validate(valid);
    expect(result).toEqual({ ok: true, value: valid, diagnostics: [] });
    expect(result.value).toBe(valid);
  });

  it('reports precise codes and JSON-pointer paths', () => {
    const result = NavigationItemModel.validate([
      { id: 'a', kind: 'link', label: ' ', href: 'javascript:alert(1)' },
      { id: 'b', kind: 'widget', label: 'B' },
      { kind: 'action', id: 'c', label: 'C', action: 'run();' },
      { id: 'd', kind: 'group', label: 'D', items: [{ id: 'e', label: 'E', href: '/e' }] },
      { id: 'f', kind: 'link', label: 'F', href: '/f', target: '_top', colour: 'red' },
      'nope',
    ]);
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual([
      ['model.label.empty', '/0/label'],
      ['model.url.unsafe', '/0/href'],
      ['model.kind.unknown', '/1/kind'],
      ['model.ref.invalid', '/2/action'],
      ['model.required.missing', '/3/items/0/kind'],
      ['model.value.invalid', '/4/target'],
      ['model.property.unknown', '/4/colour'],
      ['model.type.mismatch', '/5'],
    ]);
    expect(result.diagnostics.find((d) => d.code === 'model.kind.unknown')?.suggestion).toBe(
      'Use one of: link, action, group.',
    );
    expect(result.diagnostics.find((d) => d.code === 'model.property.unknown')?.severity).toBe(
      'warning',
    );
  });

  it('applies whole-value rules such as unique ids across the tree', () => {
    const result = NavigationItemModel.validate([
      { id: 'a', kind: 'link', label: 'A', href: '/a' },
      {
        id: 'g',
        kind: 'group',
        label: 'G',
        items: [{ id: 'a', kind: 'link', label: 'A2', href: '/a2' }],
      },
    ]);
    expect(codes(result)).toEqual([['model.id.duplicate', '/1/items/0/id']]);
    expect(result.diagnostics[0]?.message).toContain('/0/id');
  });

  it('migrates older data and validates the result', () => {
    const v1 = [
      {
        id: 'a',
        kind: 'group',
        title: 'Old',
        items: [{ id: 'b', kind: 'link', title: 'B', href: '/b' }],
      },
    ];
    const migrated = NavigationItemModel.migrate(v1, 1);
    expect(migrated.ok).toBe(true);
    expect(migrated.value?.[0]).toMatchObject({ label: 'Old', items: [{ label: 'B' }] });
    expect(codes(NavigationItemModel.migrate(v1, 0))).toEqual([['model.version.unsupported', '']]);
    expect(codes(NavigationItemModel.migrate(v1, 3))).toEqual([['model.version.unsupported', '']]);
  });
});

describe('JSON Schema emitter', () => {
  const schema = toJSONSchema(NavigationItemModel);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats.default(ajv);
  const validate = ajv.compile(schema);

  it('emits draft 2020-12 with $defs for recursion and lists unportable rules', () => {
    expect(schema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://oddkin.dev/schemas/models/acme.navigation-item.v2.json',
      title: 'acme.navigation-item',
      type: 'array',
      items: { $ref: '#/$defs/NavigationItem' },
      $comment: 'Also enforced by validate(), not expressible here: uniqueIds(id).',
    });
    expect(Object.keys(schema['$defs'] as object)).toEqual(['NavigationItem']);
  });

  it('agrees with validate() on portable rules', () => {
    const samples: unknown[] = [
      valid,
      [{ id: 'a', kind: 'link', label: '', href: '/a' }],
      [{ id: 'a', kind: 'link', label: 'A', href: 'javascript:alert(1)' }],
      [{ id: 'a', kind: 'link', label: 'A', href: ' JaVaScRiPt:x' }],
      [{ id: 'a', kind: 'action', label: 'A', action: 'Do It' }],
      [{ id: 'a', kind: 'mystery', label: 'A' }],
      [{ id: 'a', kind: 'group', label: 'G', items: [{ id: 'b', kind: 'link', label: 'B' }] }],
      [{ id: 'a', kind: 'link', label: 'A', href: '/a', target: '_top' }],
    ];
    for (const sample of samples)
      expect(validate(sample), JSON.stringify(sample)).toBe(
        NavigationItemModel.validate(sample).ok,
      );
  });
});

describe('m.json', () => {
  const Payload = defineModel('acme.payload', {
    version: 1,
    schema: m.object({ id: m.id(), data: m.json({ description: 'Opaque payload.', maxDepth: 3 }) }),
  });

  it('accepts JSON values and infers JsonValue', () => {
    for (const data of [null, true, 1.5, 'x', [1, 'a', null], { a: { b: [1] } }])
      expect(Payload.validate({ id: 'p', data }).ok, JSON.stringify(data)).toBe(true);
    expectTypeOf<Infer<typeof Payload>['data']>().toEqualTypeOf<
      import('../src/model/index.js').JsonValue
    >();
  });

  it('rejects non-JSON values and excessive depth', () => {
    for (const data of [Number.NaN, Infinity, () => 1, new Date(0), { a: undefined }, [[[[1]]]]]) {
      const result = Payload.validate({ id: 'p', data });
      expect(result.ok, String(data)).toBe(false);
      expect(result.diagnostics[0]?.path).toMatch(/^\/data/);
    }
  });

  it('emits an unconstrained schema with its description', () => {
    const schema = toJSONSchema(Payload) as { properties: Record<string, unknown> };
    expect(schema.properties['data']).toEqual({ description: 'Opaque payload.' });
  });
});

describe('nesting limit', () => {
  const Tree = defineModel('acme.tree', {
    version: 1,
    schema: m.recursive((self) => m.object({ id: m.id(), items: m.optional(m.array(self)) })),
  });
  const chain = (levels: number) => {
    let node: { id: string; items?: unknown[] } = { id: 'leaf' };
    for (let i = 0; i < levels; i++) node = { id: `n${i}`, items: [node] };
    return node;
  };
  const pointer = (levels: number) => '/items/0'.repeat(levels);

  it('validates nesting up to maxDepth and reports deeper data at its path', () => {
    expect(Tree.validate(chain(32)).ok).toBe(true);
    const deep = Tree.validate(chain(33));
    expect(deep.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['model.depth.exceeded', pointer(33)],
    ]);
    const Shallow = defineModel('acme.shallow', {
      version: 1,
      schema: Tree.schema,
      maxDepth: 2,
    });
    expect(Shallow.validate(chain(2)).ok).toBe(true);
    expect(Shallow.validate(chain(3)).diagnostics.map((d) => d.code)).toEqual([
      'model.depth.exceeded',
    ]);
  });

  it('returns diagnostics for hostile depth and cycles instead of exhausting the stack', () => {
    const result = Tree.validate(chain(100_000));
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toEqual(['model.depth.exceeded']);
    const cyclic: { id: string; items: unknown[] } = { id: 'loop', items: [] };
    cyclic.items.push(cyclic);
    expect(Tree.validate(cyclic).diagnostics.map((d) => d.code)).toEqual(['model.depth.exceeded']);
  });
});
