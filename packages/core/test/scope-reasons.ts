import { describe, expect, it } from 'vitest';
import { createScope } from '../src/scope/index.js';

/** Disposal reasons reach every signal a lifetime owns (core-contracts.md §4); Node and three engines. */
export function scopeReasonCases(): void {
  describe('Scope disposal reasons', () => {
    it('reach a signal first read after disposal', () => {
      const scope = createScope();
      const reason = new Error('route changed');
      scope.dispose(reason);
      expect(scope.signal.aborted).toBe(true);
      expect(scope.signal.reason).toBe(reason);
    });

    it('reach children and grandchildren, read before or after disposal', () => {
      const parent = createScope();
      const child = parent.child();
      const grandchild = child.child();
      const early = child.signal;
      const reason = new Error('app stopped');
      parent.dispose(reason);
      expect(early.reason).toBe(reason);
      expect(grandchild.signal.reason).toBe(reason);
    });

    it('reach a child created after disposal', () => {
      const parent = createScope();
      const reason = new Error('gone');
      parent.dispose(reason);
      const child = parent.child();
      expect(child.disposed).toBe(true);
      expect(child.signal.reason).toBe(reason);
    });

    it('reach the run scope of an owned effect when its owner is disposed', () => {
      const owner = createScope();
      let run: AbortSignal | undefined;
      owner.effect((scope) => {
        run = scope.signal;
      });
      const reason = new Error('disconnected');
      owner.dispose(reason);
      expect(run?.reason).toBe(reason);
    });

    it('stay the first one given: an earlier disposal keeps its own, a later call changes nothing', () => {
      const parent = createScope();
      const child = parent.child();
      const own = new Error('closed');
      child.dispose(own);
      parent.dispose(new Error('parent'));
      expect(child.signal.reason).toBe(own);
      const scope = createScope();
      const first = new Error('first');
      scope.dispose(first);
      scope.dispose(new Error('second'));
      expect(scope.signal.reason).toBe(first);
    });

    it('default to an AbortError for a disposal without a reason', () => {
      const parent = createScope();
      const child = parent.child();
      parent.dispose();
      expect((child.signal.reason as DOMException).name).toBe('AbortError');
      expect((parent.signal.reason as DOMException).name).toBe('AbortError');
    });
  });
}
