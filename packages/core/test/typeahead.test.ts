import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Typeahead } from '../src/controllers/typeahead.js';
import { createScope, scopeStats, type Scope } from '../src/scope/index.js';

// DOM-free: string items, `type()` called directly, Scope timers under fake timers.
const FRUITS = ['Apple', 'Apricot', 'Banana', 'blueberry', 'Cherry', 'Éclair', 'Elderberry'];

let scope: Scope;
let active: number;
let matches: number[];

const typeahead = (options: Partial<ConstructorParameters<typeof Typeahead<string>>[0]> = {}) =>
  scope.use(
    new Typeahead<string>({
      items: () => FRUITS,
      active: () => active,
      onMatch: (index) => {
        matches.push(index);
        active = index;
      },
      ...options,
    }),
  );

beforeEach(() => {
  vi.useFakeTimers();
  scope = createScope({ name: 'typeahead test' });
  active = -1;
  matches = [];
});
afterEach(() => {
  scope.dispose();
  vi.useRealTimers();
});

describe('Typeahead (DOM-free)', () => {
  it('moves to the first match after the current item and cycles when the same character repeats', () => {
    const t = typeahead();
    expect(t.type('a')).toBe(true);
    expect(matches).toEqual([0]);
    expect(t.type('a')).toBe(true);
    expect(matches).toEqual([0, 1]);
    t.type('a');
    // Wraps to the first match again.
    expect(matches).toEqual([0, 1, 0]);
    expect(t.query).toBe('aaa');
  });

  it('matches a longer query starting at the current item, ignoring case and accents', () => {
    const t = typeahead();
    t.type('b');
    t.type('l');
    expect(matches).toEqual([2, 3]);
    t.reset();
    t.type('e');
    // "Éclair" matches "e" before "Elderberry".
    expect(matches).toEqual([2, 3, 5]);
    t.type('l');
    expect(matches).toEqual([2, 3, 5, 6]);
  });

  it('stays on the current item when it still matches a longer query, and moves nowhere without a match', () => {
    const t = typeahead();
    t.type('a');
    t.type('p');
    expect(matches).toEqual([0]);
    t.type('z');
    expect(matches).toEqual([0]);
    expect(t.query).toBe('apz');
  });

  it('starts the query again after the timeout', () => {
    const t = typeahead({ timeout: 300 });
    t.type('b');
    vi.advanceTimersByTime(299);
    t.type('l');
    expect(t.query).toBe('bl');
    vi.advanceTimersByTime(300);
    expect(t.query).toBe('');
    t.type('c');
    expect(matches).toEqual([2, 3, 4]);
  });

  it('uses the 500 ms APG timeout by default, counted from the last key', () => {
    const t = typeahead();
    t.type('c');
    vi.advanceTimersByTime(400);
    t.type('h');
    vi.advanceTimersByTime(499);
    expect(t.query).toBe('ch');
    vi.advanceTimersByTime(1);
    expect(t.query).toBe('');
  });

  it('releases its timer on reset', () => {
    const before = scopeStats().timers;
    const t = typeahead();
    t.type('c');
    t.type('h');
    expect(scopeStats().timers).toBe(before + 1);
    t.reset();
    expect(t.query).toBe('');
    expect(scopeStats().timers).toBe(before);
  });

  it('takes Space only while a query is in progress, and never takes named keys', () => {
    const items = ['New file', 'New folder', 'Newsletter'];
    const t = typeahead({ items: () => items });
    expect(t.type(' ')).toBe(false);
    expect(t.type('Enter')).toBe(false);
    expect(t.type('ArrowDown')).toBe(false);
    expect(t.query).toBe('');
    t.type('n');
    t.type('e');
    t.type('w');
    expect(t.type(' ')).toBe(true);
    t.type('f');
    t.type('o');
    expect(matches).toEqual([0, 1]);
  });

  it('accepts one character outside the basic plane', () => {
    const items = ['🍎 Apple', '🍌 Banana'];
    const t = typeahead({ items: () => items });
    expect(t.type('🍌')).toBe(true);
    expect(matches).toEqual([1]);
  });

  it('skips items the caller excludes and matches by the caller’s text', () => {
    const records = [
      { label: 'Alpha', disabled: true },
      { label: 'Atlas', disabled: false },
    ];
    let current = -1;
    const found: number[] = [];
    const t = scope.use(
      new Typeahead<(typeof records)[number]>({
        items: () => records,
        active: () => current,
        onMatch: (index) => found.push((current = index)),
        text: (record) => `  ${record.label}`,
        skip: (record) => record.disabled,
      }),
    );
    t.type('a');
    expect(found).toEqual([1]);
  });

  it('does nothing before it is connected or after its scope is disposed, and leaves no timer behind', () => {
    const baseline = scopeStats();
    const loose = new Typeahead<string>({
      items: () => FRUITS,
      active: () => -1,
      onMatch: (index) => matches.push(index),
    });
    expect(loose.type('a')).toBe(false);
    const own = createScope();
    own.use(loose);
    loose.type('a');
    expect(scopeStats().timers).toBe(baseline.timers + 1);
    own.dispose();
    expect(scopeStats()).toEqual(baseline);
    expect(loose.query).toBe('');
    expect(loose.type('b')).toBe(false);
    expect(matches).toEqual([0]);
  });

  it('handles an empty or changing item list', () => {
    let items: string[] = [];
    const t = typeahead({ items: () => items });
    expect(t.type('a')).toBe(true);
    expect(matches).toEqual([]);
    t.reset();
    items = ['Zebra', 'Apple'];
    active = 5; // stale index from a longer list
    t.type('a');
    expect(matches).toEqual([1]);
  });
});
