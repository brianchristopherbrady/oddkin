/**
 * Opt-in Svelte 5 markup typings (checked by svelte-check) for every `odd-*` element whose package
 * types are loaded: `import type {} from '@oddkin/components/frameworks/svelte'`. Types only;
 * nothing runs. Properties come from each element class (`ElementProperties`); events from its
 * `static events`, as `on<event>` handler attributes. Svelte 5 accepts `bind:value` only on native
 * controls: bind `value` and handle `oninput` on `odd-input`.
 */
import type { ElementEventMap, ElementProperties } from '@oddkin/core/element';
import type { HTMLAttributes } from 'svelte/elements';

export type OddkinSvelteAttributes<E extends HTMLElement> = Omit<
  HTMLAttributes<E>,
  keyof ElementProperties<E> | `on${keyof ElementEventMap<E> & string}`
> &
  ElementProperties<E> & {
    [K in keyof ElementEventMap<E> & string as `on${K}`]?: (
      event: ElementEventMap<E>[K] & { currentTarget: E },
    ) => void;
  };

type OddkinSvelteElements = {
  [
    T in keyof HTMLElementTagNameMap as T extends `odd-${string}` ? T : never
  ]: OddkinSvelteAttributes<HTMLElementTagNameMap[T]>;
};

declare module 'svelte/elements' {
  interface SvelteHTMLElements extends OddkinSvelteElements {}
}
