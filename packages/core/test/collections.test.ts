import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  activeModel,
  collection,
  disabledModel,
  expansionModel,
  selectionModel,
  visibleEntries,
  type Key,
} from '../src/collections/index.js';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { signal } from '../src/reactive/index.js';
import { createScope } from '../src/scope/index.js';

interface Item {
  id?: string;
  label: string;
  disabled?: boolean;
  items?: Item[];
}

let reported: ErrorContext[];
beforeEach(() => {
  reported = [];
  setErrorHandler((_e, context) => reported.push(context));
});
afterEach(() => setErrorHandler(undefined));

const make = (owner = createScope()) =>
  collection<Item>({
    key: (item) => item.id,
    children: (item) => item.items,
    disabled: (item) => !!item.disabled,
    owner,
  });

const data: Item[] = [
  { id: 'a', label: 'A' },
  {
    id: 'g',
    label: 'Group',
    items: [
      { id: 'g1', label: 'G1' },
      { id: 'g2', label: 'G2', disabled: true },
    ],
  },
  { id: 'b', label: 'B' },
];

describe('collection', () => {
  it('flattens in document order with depth, parents, and paths', () => {
    const c = make();
    c.set(data);
    expect(
      c.flat.value.map((e) => [e.key, e.depth, e.parentKey, e.index, e.position, e.path]),
    ).toEqual([
      ['a', 0, undefined, 0, 0, '/0'],
      ['g', 0, undefined, 1, 1, '/1'],
      ['g1', 1, 'g', 0, 2, '/1/items/0'],
      ['g2', 1, 'g', 1, 3, '/1/items/1'],
      ['b', 0, undefined, 2, 4, '/2'],
    ]);
    expect(c.byKey('g')?.hasChildren).toBe(true);
    expect(c.childrenOf('g').map((e) => e.key)).toEqual(['g1', 'g2']);
    expect(c.ancestorsOf('g2')).toEqual(['g']);
  });

  it('reuses entries whose key, item, and position are unchanged', () => {
    const c = make();
    c.set(data);
    const before = new Map(c.flat.value.map((e) => [e.key, e]));
    const replacedB = { id: 'b', label: 'B2' };
    c.set([data[0] as Item, data[1] as Item, replacedB]);
    const after = new Map(c.flat.value.map((e) => [e.key, e]));
    expect(after.get('a')).toBe(before.get('a'));
    expect(after.get('g1')).toBe(before.get('g1'));
    expect(after.get('b')).not.toBe(before.get('b'));
    expect(after.get('b')?.item).toBe(replacedB);
  });

  it('reports missing and duplicate keys with paths and skips those items', () => {
    const c = make();
    c.set([
      { id: 'a', label: 'A' },
      { label: 'no key' },
      { id: 'g', label: 'G', items: [{ id: 'a', label: 'dup' }] },
    ]);
    expect(c.diagnostics.value.map((d) => [d.code, d.path])).toEqual([
      ['collection.key.missing', '/1'],
      ['collection.key.duplicate', '/2/items/0'],
    ]);
    expect(reported.map((r) => r.code)).toEqual([
      'collection.key.missing',
      'collection.key.duplicate',
    ]);
    expect(c.flat.value.map((e) => e.key)).toEqual(['a', 'g']);
  });

  it('owns a scope per entry, disposed when the key leaves or the owner ends', () => {
    const owner = createScope();
    const c = make(owner);
    c.set(data);
    const a = c.scopeFor('a');
    const b = c.scopeFor('b');
    expect(c.scopeFor('a')).toBe(a);
    let cleaned = 0;
    a.add(() => cleaned++);
    c.set([data[1] as Item, data[2] as Item]);
    expect([a.disposed, b.disposed, cleaned]).toEqual([true, false, 1]);
    owner.dispose();
    expect(b.disposed).toBe(true);
    expect(() => make(undefined as never).scopeFor('x')).toThrowError();
  });
});

describe('state models', () => {
  const c = make();
  c.set(data);

  it('selection: single and multiple, ignoring disabled and unknown keys', () => {
    const single = selectionModel({ mode: 'single', collection: c });
    single.select('a');
    single.select('b');
    single.select('g2');
    single.select('zzz');
    expect([...single.selected.value]).toEqual(['b']);
    const multiple = selectionModel({ mode: 'multiple', collection: c });
    multiple.select('a');
    multiple.toggle('b');
    multiple.toggle('a');
    expect([...multiple.selected.value]).toEqual(['b']);
    const { toggle } = multiple;
    toggle('a');
    expect([...multiple.selected.value].sort()).toEqual(['a', 'b']);
    multiple.clear();
    expect(multiple.selected.value.size).toBe(0);
  });

  it('controlled models report intent and never change the value themselves', () => {
    const value = signal<ReadonlySet<Key>>(new Set(['a']));
    const requests: Key[][] = [];
    const model = selectionModel({
      mode: 'single',
      collection: c,
      controlled: { value, onChange: (next) => requests.push([...next]) },
    });
    model.select('b');
    expect([...model.selected.value]).toEqual(['a']);
    expect(requests).toEqual([['b']]);
    value.value = new Set(['b']);
    expect(model.isSelected('b')).toBe(true);
  });

  it('expansion and visible entries', () => {
    const expansion = expansionModel({ collection: c });
    const visible = visibleEntries(c, expansion);
    expect(visible.value.map((e) => e.key)).toEqual(['a', 'g', 'b']);
    expansion.expand('a');
    expansion.toggle('g');
    expect([...expansion.expanded.value]).toEqual(['g']);
    expect(visible.value.map((e) => e.key)).toEqual(['a', 'g', 'g1', 'g2', 'b']);
    expansion.collapse('g');
    expect(visible.value.map((e) => e.key)).toEqual(['a', 'g', 'b']);
  });

  it('disabled keys come from the collection', () => {
    expect([...disabledModel(c).disabled.value]).toEqual(['g2']);
  });

  it('active (roving focus target) skips disabled and hidden entries and recovers from removal', () => {
    const expansion = expansionModel({ collection: c, initial: ['g'] });
    const active = activeModel({ entries: visibleEntries(c, expansion) });
    expect(active.active.value).toBe('a');
    active.next();
    active.next();
    active.next();
    expect(active.active.value).toBe('b');
    active.next();
    expect(active.active.value).toBe('b');
    active.previous();
    expect(active.active.value).toBe('g1');
    active.setActive('g2');
    expect(active.active.value).toBe('g1');
    expansion.collapse('g');
    expect(active.active.value).toBe('a');
    const wrapping = activeModel({ entries: c.flat, wrap: true, initial: 'b' });
    wrapping.next();
    expect(wrapping.active.value).toBe('a');
    wrapping.last();
    expect(wrapping.active.value).toBe('b');
  });
});
