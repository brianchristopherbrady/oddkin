// Type-level checks for defineExamples (compiled by `npm run typecheck`, not executed).
import { defineExamples } from '../src/examples/index.js';

interface TypedNav extends HTMLElement {
  label: string;
  items: readonly string[];
  open: boolean;
  toggle(): void;
}
declare global {
  interface HTMLElementTagNameMap {
    'typed-nav': TypedNav;
  }
}

export const ok = defineExamples('typed-nav', {
  default: { props: { label: 'Primary', items: ['a'] } },
  fixture: {
    fixture: ({ element }) => {
      element.open = true;
      // @ts-expect-error -- fixture elements are typed from the tag
      element.missing = 1;
    },
  },
});

export const unknownKey = defineExamples('typed-nav', {
  // @ts-expect-error -- unknown property key on a registered tag
  typo: { props: { lable: 'Primary' } },
});

export const wrongType = defineExamples('typed-nav', {
  // @ts-expect-error -- wrong value type
  bad: { props: { open: 'yes' } },
});

export const methodsExcluded = defineExamples('typed-nav', {
  // @ts-expect-error -- methods are not example props
  bad: { props: { toggle: () => {} } },
});

// Unregistered tags accept any keys; checkExamples validates them against metadata instead.
export const loose = defineExamples('plain-tag', { any: { props: { anything: 1 } } });
