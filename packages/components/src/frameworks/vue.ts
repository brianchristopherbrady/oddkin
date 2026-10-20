/**
 * Opt-in Vue 3 template typings (checked by vue-tsc) for every `odd-*` element whose package
 * types are loaded: `import type {} from '@oddkin/components/frameworks/vue'`. Types only; nothing
 * runs. Properties come from each element class (`ElementProperties`); events from its
 * `static events`, as `@<event>` listeners and `on<Event>` props. Bind object values with `.prop`
 * (`:items.prop`) when the element may render before its definition loads; `v-model` binds
 * `value` and `input`.
 */
import type { ElementEventMap, ElementProperties } from '@oddkin/core/element';
import type { AllowedComponentProps, HTMLAttributes, VNodeProps } from 'vue';

type Camel<S extends string> = S extends `${infer H}-${infer T}`
  ? `${H}${Capitalize<Camel<T>>}`
  : S;

// `@odd-action` compiles to an `onOddAction` prop.
type Listeners<E> = {
  [K in keyof ElementEventMap<E> & string as `on${Capitalize<Camel<K>>}`]?: (
    event: ElementEventMap<E>[K],
  ) => void;
};

// `v-model` on a custom element type-checks as `modelValue` but binds `value` and `input`.
type Model<E> = E extends { value: infer V } ? { modelValue?: V } : {};

/** A component-like constructor for `GlobalComponents`, as Vue's guide types custom elements. */
export type OddkinVueElement<E extends HTMLElement> = new () => E & {
  $props: Omit<HTMLAttributes, keyof ElementProperties<E>> &
    ElementProperties<E> &
    Listeners<E> &
    Model<E> &
    VNodeProps &
    AllowedComponentProps;
};

type OddkinVueElements = {
  [T in keyof HTMLElementTagNameMap as T extends `odd-${string}` ? T : never]: OddkinVueElement<
    HTMLElementTagNameMap[T]
  >;
};

declare module 'vue' {
  interface GlobalComponents extends OddkinVueElements {}
}
