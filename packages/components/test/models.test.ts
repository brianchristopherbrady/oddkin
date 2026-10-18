import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { toJSONSchema } from '@oddkin/core/model/schema';
import { NavigationItemModel, type Navigation } from '../src/models/index.js';

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
