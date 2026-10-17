import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoteError, setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { observerCount } from '../src/reactive/graph.js';
import {
  batch,
  computed,
  effect,
  flush,
  isReadable,
  settled,
  signal,
  untracked,
} from '../src/reactive/index.js';

let reported: Array<{ error: unknown; context: ErrorContext }>;

beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ error, context }));
});

afterEach(() => {
  flush();
  setErrorHandler(undefined);
});

describe('signal', () => {
  it('reads, writes, updates, and peeks', () => {
    const count = signal(1);
    count.value = 2;
    count.update((n) => n + 1);
    expect(count.value).toBe(3);
    expect(count.peek()).toBe(3);
  });

  it('uses Object.is equality by default and skips no-op writes', () => {
    const value = signal<number>(NaN);
    const onChange = vi.fn();
    value.subscribe(onChange);
    value.value = NaN;
    expect(onChange).not.toHaveBeenCalled();
    value.value = 0;
    value.value = -0;
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('supports custom equality', () => {
    const point = signal({ x: 1 }, { equals: (a, b) => a.x === b.x });
    const onChange = vi.fn();
    point.subscribe(onChange);
    point.value = { x: 1 };
    expect(onChange).not.toHaveBeenCalled();
    point.value = { x: 2 };
    expect(onChange).toHaveBeenCalledWith({ x: 2 });
  });

  it('is identified by the readable protocol', () => {
    expect(isReadable(signal(1))).toBe(true);
    expect(isReadable(computed(() => 1))).toBe(true);
    expect(isReadable({ value: 1 })).toBe(false);
    expect(isReadable(null)).toBe(false);
  });
});

describe('computed', () => {
  it('is lazy and memoized', () => {
    const a = signal(1);
    const fn = vi.fn(() => a.value * 2);
    const double = computed(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(double.value).toBe(2);
    expect(double.value).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);
    a.value = 5;
    expect(fn).toHaveBeenCalledTimes(1);
    expect(double.value).toBe(10);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reflects writes inside a batch immediately', () => {
    const quantity = signal(1);
    const price = signal(12);
    const total = computed(() => quantity.value * price.value);
    const seen = batch(() => {
      quantity.value = 2;
      price.value = 15;
      return total.value;
    });
    expect(seen).toBe(30);
    expect(total.value).toBe(30);
  });

  it('is glitch-free through a diamond', () => {
    const a = signal(1);
    const b = computed(() => a.value * 2);
    const c = computed(() => a.value + 1);
    const dFn = vi.fn(() => `${b.value}/${c.value}`);
    const d = computed(dFn);
    const seenBySubscriber: string[] = [];
    d.subscribe((value) => seenBySubscriber.push(value));
    const seenByEffect: string[] = [];
    effect(() => {
      seenByEffect.push(d.value);
    });
    a.value = 2;
    a.value = 3;
    flush();
    expect(seenBySubscriber).toEqual(['4/3', '6/4']);
    expect(seenByEffect).toEqual(['2/2', '6/4']);
    expect(dFn).toHaveBeenCalledTimes(3);
  });

  it('tracks dynamic dependencies and drops unused ones', () => {
    const useA = signal(true);
    const a = signal('a');
    const b = signal('b');
    const fn = vi.fn(() => (useA.value ? a.value : b.value));
    const choice = computed(fn);
    const onChange = vi.fn();
    choice.subscribe(onChange);
    useA.value = false;
    expect(onChange).toHaveBeenLastCalledWith('b');
    fn.mockClear();
    a.value = 'a2';
    expect(fn).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(observerCount(a)).toBe(0);
  });

  it('does not notify when the derived value is unchanged', () => {
    const n = signal(2);
    const isEven = computed(() => n.value % 2 === 0);
    const onChange = vi.fn();
    isEven.subscribe(onChange);
    n.value = 4;
    expect(onChange).not.toHaveBeenCalled();
    n.value = 5;
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('caches errors and recovers when dependencies change', () => {
    const input = signal('{"ok":true}');
    const fn = vi.fn(() => JSON.parse(input.value) as unknown);
    const parsed = computed(fn);
    expect(parsed.value).toEqual({ ok: true });
    input.value = '{bad';
    expect(() => parsed.value).toThrow(SyntaxError);
    expect(() => parsed.value).toThrow(SyntaxError);
    expect(fn).toHaveBeenCalledTimes(2);
    input.value = '{"ok":false}';
    expect(parsed.value).toEqual({ ok: false });
  });

  it('reports cycles with a stable code', () => {
    const a: { value: number } = computed((): number => b.value + 1);
    const b: { value: number } = computed((): number => a.value + 1);
    expect(() => a.value).toThrow(MoteError);
    try {
      a.value;
    } catch (error) {
      expect((error as MoteError).code).toBe('reactive.cycle');
    }
  });

  it('forbids writes while evaluating', () => {
    const other = signal(0);
    const impure = computed(() => {
      other.value = 1;
      return 1;
    });
    expect(() => impure.value).toThrow(/reactive\.write\.inComputed/);
    expect(() => untracked(() => impure.value)).toThrow(/reactive\.write\.inComputed/);
  });

  it('notifies after being re-observed when sources changed while unobserved', () => {
    const a = signal(1);
    const double = computed(() => a.value * 2);
    const stopFirst = double.subscribe(() => {});
    stopFirst();
    a.value = 5;
    const onChange = vi.fn();
    double.subscribe(onChange);
    expect(onChange).not.toHaveBeenCalled();
    a.value = 6;
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('propagates through a deep chain with one evaluation per level', () => {
    const root = signal(0);
    const fns = Array.from({ length: 50 }, () => vi.fn());
    let last: { readonly value: number } = root;
    for (const fn of fns) {
      const previous = last;
      fn.mockImplementation(() => previous.value + 1);
      last = computed(fn as () => number);
    }
    const onChange = vi.fn();
    (last as ReturnType<typeof computed<number>>).subscribe(onChange);
    root.value = 1;
    expect(onChange).toHaveBeenCalledWith(51);
    for (const fn of fns) expect(fn).toHaveBeenCalledTimes(2);
  });

  it('registers with sources only while observed', () => {
    const a = signal(1);
    const double = computed(() => a.value * 2);
    expect(double.value).toBe(2);
    expect(observerCount(a)).toBe(0);
    const stop = double.subscribe(() => {});
    expect(observerCount(a)).toBe(1);
    stop();
    expect(observerCount(a)).toBe(0);
    a.value = 3;
    expect(double.value).toBe(6);
  });
});

describe('batch and subscribe', () => {
  it('notifies synchronously outside a batch', () => {
    const a = signal(1);
    const onChange = vi.fn();
    a.subscribe(onChange);
    a.value = 2;
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('notifies once at the outermost batch boundary with the final value', () => {
    const a = signal(1);
    const total = computed(() => a.value * 10);
    const onA = vi.fn();
    const onTotal = vi.fn();
    a.subscribe(onA);
    total.subscribe(onTotal);
    batch(() => {
      a.value = 2;
      batch(() => {
        a.value = 3;
      });
      expect(onA).not.toHaveBeenCalled();
      a.value = 4;
    });
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onA).toHaveBeenCalledWith(4);
    expect(onTotal).toHaveBeenCalledTimes(1);
    expect(onTotal).toHaveBeenCalledWith(40);
  });

  it('skips notification when a batch restores the original value', () => {
    const a = signal(1);
    const onChange = vi.fn();
    a.subscribe(onChange);
    batch(() => {
      a.value = 2;
      a.value = 1;
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('returns the batch result', () => {
    expect(batch(() => 42)).toBe(42);
  });

  it('stops notifying after unsubscribe and allows double dispose', () => {
    const a = signal(1);
    const onChange = vi.fn();
    const stop = a.subscribe(onChange);
    stop();
    stop();
    a.value = 2;
    expect(onChange).not.toHaveBeenCalled();
    expect(observerCount(a)).toBe(0);
  });

  it('provides a bound, stable subscribe function for external stores', () => {
    const a = signal(1);
    const { subscribe } = a;
    expect(a.subscribe).toBe(subscribe);
    const onChange = vi.fn();
    const stop = subscribe(onChange);
    a.value = 2;
    stop();
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('handles reentrant writes from subscribers in the same flush', () => {
    const celsius = signal(0);
    const fahrenheit = signal(32);
    const log: string[] = [];
    celsius.subscribe((c) => {
      log.push(`c=${c}`);
      fahrenheit.value = (c * 9) / 5 + 32;
    });
    fahrenheit.subscribe((f) => log.push(`f=${f}`));
    celsius.value = 100;
    expect(log).toEqual(['c=100', 'f=212']);
  });

  it('stops runaway subscriber loops and reports them', () => {
    const a = signal(0);
    a.subscribe((n) => {
      a.value = n + 1;
    });
    a.value = 1;
    expect(reported.map((r) => r.context.code)).toEqual(['reactive.flush.runaway']);
  });

  it('isolates subscriber errors', () => {
    const a = signal(0);
    const after = vi.fn();
    a.subscribe(() => {
      throw new Error('boom');
    });
    a.subscribe(after);
    a.value = 1;
    expect(after).toHaveBeenCalledWith(1);
    expect(reported.map((r) => r.context.code)).toEqual(['reactive.subscribe.error']);
  });
});

describe('effect', () => {
  it('runs immediately, then once per flush for any number of writes', async () => {
    const a = signal(1);
    const runs: number[] = [];
    effect(() => {
      runs.push(a.value);
    });
    expect(runs).toEqual([1]);
    a.value = 2;
    a.value = 3;
    a.value = 4;
    expect(runs).toEqual([1]);
    await settled();
    expect(runs).toEqual([1, 4]);
  });

  it('runs cleanup before each rerun and on dispose', () => {
    const a = signal(1);
    const log: string[] = [];
    const dispose = effect(() => {
      const value = a.value;
      log.push(`run ${value}`);
      return () => log.push(`cleanup ${value}`);
    });
    a.value = 2;
    flush();
    dispose();
    dispose();
    a.value = 3;
    flush();
    expect(log).toEqual(['run 1', 'cleanup 1', 'run 2', 'cleanup 2']);
    expect(observerCount(a)).toBe(0);
  });

  it('skips reruns when a computed dependency did not change', () => {
    const n = signal(2);
    const parity = computed(() => n.value % 2);
    const fn = vi.fn(() => {
      parity.value;
    });
    effect(fn);
    n.value = 4;
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs commit-phase effects before post-phase effects', () => {
    const a = signal(0);
    const order: string[] = [];
    effect(() => {
      a.value;
      order.push('post');
    });
    effect(
      () => {
        a.value;
        order.push('commit');
      },
      { phase: 'commit' },
    );
    order.length = 0;
    a.value = 1;
    flush();
    expect(order).toEqual(['commit', 'post']);
  });

  it('converges when an effect writes a value it reads', () => {
    const value = signal(15);
    effect(() => {
      if (value.value > 10) value.value = 10;
    });
    flush();
    expect(value.value).toBe(10);
    value.value = 20;
    flush();
    expect(value.value).toBe(10);
    expect(reported).toEqual([]);
  });

  it('reruns when an effect writes a value it read during the same run', () => {
    const count = signal(0);
    const runs: number[] = [];
    effect(() => {
      runs.push(count.value);
      if (count.value < 2) count.value = count.value + 1;
    });
    flush();
    expect(runs).toEqual([0, 1, 2]);
  });

  it('can dispose itself during its own run', () => {
    const a = signal(0);
    const fn = vi.fn();
    const dispose: () => void = effect(() => {
      fn(a.value);
      if (a.value === 1) dispose();
    });
    a.value = 1;
    flush();
    a.value = 2;
    flush();
    expect(fn.mock.calls).toEqual([[0], [1]]);
    expect(observerCount(a)).toBe(0);
  });

  it('stops runaway effects and reports them', () => {
    const a = signal(0);
    effect(() => {
      a.value = a.value + 1;
    });
    flush();
    expect(reported.map((r) => r.context.code)).toEqual(['reactive.flush.runaway']);
  });

  it('isolates effect and cleanup errors', () => {
    const a = signal(0);
    const healthy = vi.fn(() => {
      a.value;
    });
    effect(
      () => {
        a.value;
        throw new Error('effect failed');
      },
      { name: 'broken' },
    );
    effect(() => {
      a.value;
      return () => {
        throw new Error('cleanup failed');
      };
    });
    effect(healthy);
    a.value = 1;
    flush();
    expect(healthy).toHaveBeenCalledTimes(2);
    expect(reported.map((r) => [r.context.code, r.context.origin])).toEqual([
      ['reactive.effect.error', 'broken'],
      ['reactive.effect.error', 'broken'],
      ['reactive.effect.cleanupError', undefined],
    ]);
  });

  it('does not track reads inside untracked or cleanup', () => {
    const tracked = signal(0);
    const ignored = signal(0);
    const fn = vi.fn(() => {
      tracked.value;
      untracked(() => ignored.value);
    });
    effect(fn);
    ignored.value = 1;
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
    tracked.value = 1;
    flush();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cannot be created while a computed value evaluates', () => {
    const bad = computed(() => effect(() => {}));
    expect(() => bad.value).toThrow(/reactive\.effect\.inComputed/);
  });

  it('settled resolves immediately when nothing is pending', async () => {
    await expect(settled()).resolves.toBeUndefined();
  });
});
