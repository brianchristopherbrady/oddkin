import { describe, expect, it } from 'vitest';
import { computed } from '@oddkin/core/reactive';
import { DecisionController } from '../src/internal/decision.js';

const host = { shadowRoot: null } as unknown as Element;

describe('DecisionController', () => {
  it('asks once per record key until the host settles it', () => {
    const decisions = new DecisionController(host, () => undefined);
    expect(decisions.request('a:1', 'approve')).toBe(true);
    expect(decisions.request('a:1', 'reject')).toBe(false);
    expect([decisions.asked('a:1'), decisions.choice('a:1')]).toEqual([true, 'approve']);
    expect([decisions.asked('a:2'), decisions.choice('a:2')]).toEqual([false, undefined]);

    // The same record, still waiting: the guard holds.
    decisions.settle('a:1');
    expect(decisions.asked('a:1')).toBe(true);
    // The host says the request is over (it failed): the view may ask again.
    decisions.settle('a:1', true);
    expect(decisions.asked('a:1')).toBe(false);
    expect(decisions.request('a:1', 'reject')).toBe(true);
    // Another revision of the record releases the guard.
    decisions.settle('a:2');
    expect(decisions.asked('a:1')).toBe(false);
    decisions.request('a:2');
    decisions.settle(undefined);
    expect(decisions.asked('a:2')).toBe(false);
  });

  it('is reactive, so templates follow the guard', () => {
    const decisions = new DecisionController(host, () => undefined);
    const pending = computed(() => decisions.asked('q:3'));
    const chosen = computed(() => decisions.choice('q:3'));
    expect([pending.value, chosen.value]).toEqual([false, undefined]);
    decisions.request('q:3', 'skip');
    expect([pending.value, chosen.value]).toEqual([true, 'skip']);
    decisions.settle('q:3', true);
    expect([pending.value, chosen.value]).toEqual([false, undefined]);
  });
});
