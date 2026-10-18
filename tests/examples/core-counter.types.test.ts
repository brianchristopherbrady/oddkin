import { expectTypeOf, it } from 'vitest';
// Types come from the emitted declarations, not the sources: this proves `with()` survives
// declaration emit for downstream consumers.
import type {
  DemoCounter,
  DemoGreeting,
  countChange,
} from '../../examples/core-counter/dist/index.js';
import type { EventDetail, OddkinElement } from '@oddkin/core';

it('exposes inferred property types through emitted declarations', () => {
  expectTypeOf<DemoGreeting['name']>().toEqualTypeOf<string>();
  expectTypeOf<DemoGreeting['excited']>().toEqualTypeOf<boolean>();
  expectTypeOf<DemoGreeting['tone']>().toEqualTypeOf<'plain' | 'warm' | 'formal'>();
  expectTypeOf<DemoGreeting['history']>().toEqualTypeOf<string[]>();
  expectTypeOf<DemoCounter['step']>().toEqualTypeOf<number>();
  expectTypeOf<DemoCounter['count']>().toEqualTypeOf<number>();
  expectTypeOf<DemoGreeting>().toMatchTypeOf<OddkinElement>();
  expectTypeOf<DemoGreeting>().toMatchTypeOf<HTMLElement>();
  expectTypeOf<EventDetail<typeof countChange>>().toEqualTypeOf<{ count: number }>();
  expectTypeOf<HTMLElementTagNameMap['demo-greeting']>().toEqualTypeOf<DemoGreeting>();
});
