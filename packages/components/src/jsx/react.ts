/**
 * Opt-in React 19 JSX typings for every `odd-*` element whose package types are loaded:
 * `import type {} from '@oddkin/components/jsx/react'`. Types only; nothing runs. Properties come
 * from each element class (`ElementProperties`); `on<event>` props from its `static events`
 * (React 19 adds a lowercase `on<name>` prop on a custom element as a listener for `<name>`).
 * React's own `onInput` and `onChange` stay available. React sets a property only once the
 * element is defined.
 */
import type { ElementProperties } from '@oddkin/core/element';
import type { HTMLAttributes, RefAttributes } from 'react';

type OwnEvents<E> = E extends { readonly _events?: infer M } ? NonNullable<M> : {};

export type OddkinReactProps<E extends HTMLElement> = Omit<
  HTMLAttributes<E>,
  keyof ElementProperties<E>
> &
  RefAttributes<E> &
  ElementProperties<E> & {
    [K in keyof OwnEvents<E> & string as `on${K}`]?: (event: OwnEvents<E>[K]) => void;
  };

type OddkinReactElements = {
  [T in keyof HTMLElementTagNameMap as T extends `odd-${string}` ? T : never]: OddkinReactProps<
    HTMLElementTagNameMap[T]
  >;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends OddkinReactElements {}
  }
}
