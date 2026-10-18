/**
 * Attribute-position directives: objects that manage an element through a binding
 * position instead of writing a string (class lists, CSSOM styles, refs, live values).
 * Directives are applied in the commit phase like any other part write.
 */

export const ATTRIBUTE_DIRECTIVE: unique symbol = Symbol.for('oddkin.attributeDirective') as never;

export type DirectivePartType = 'attribute' | 'boolean' | 'property';

export interface DirectiveBinding {
  readonly type: DirectivePartType;
  /** Name as written in the template (without its prefix). */
  readonly name: string;
}

export interface DirectiveResult<S> {
  readonly state: S;
  /** True if the DOM changed (drives `updated` and commit accounting). */
  readonly changed: boolean;
}

export interface DirectiveHandler<D, S> {
  /** Used in diagnostics, e.g. `classMap`. */
  readonly name: string;
  /** Binding types the directive accepts. */
  readonly parts: readonly DirectivePartType[];
  /** Required binding name (case-insensitive), e.g. `class` for `classMap`. */
  readonly bindingName?: string;
  apply(
    directive: D,
    element: Element,
    binding: DirectiveBinding,
    state: S | undefined,
  ): DirectiveResult<S>;
  /** Undo the directive's effects when the binding is disposed or switches to a plain value. */
  clear?(element: Element, state: S): void;
}

export interface AttributeDirective {
  readonly [ATTRIBUTE_DIRECTIVE]: DirectiveHandler<any, any>;
}

export function isAttributeDirective(value: unknown): value is AttributeDirective {
  return typeof value === 'object' && value !== null && ATTRIBUTE_DIRECTIVE in value;
}
