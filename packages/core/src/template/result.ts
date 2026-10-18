/**
 * Template results: the inert description returned by `html` / `svg` tags.
 * Contract: docs/architecture/core-contracts.md §1, §6.
 */

const TEMPLATE_RESULT: unique symbol = Symbol.for('oddkin.templateResult') as never;

export type TemplateKind = 'html' | 'svg';

export interface TemplateResult {
  readonly [TEMPLATE_RESULT]: true;
  readonly kind: TemplateKind;
  readonly strings: TemplateStringsArray;
  readonly values: readonly unknown[];
}

function tag(kind: TemplateKind) {
  return (strings: TemplateStringsArray, ...values: unknown[]): TemplateResult => ({
    [TEMPLATE_RESULT]: true,
    kind,
    strings,
    values,
  });
}

/**
 * Describe HTML with bindings. Interpolations are text, attribute (`name=`), boolean
 * attribute (`?name=`), property (`.name=`), or event (`@name=`) bindings — never markup.
 */
export const html = tag('html');

/** Describe SVG content (children of an `<svg>` element) with the same bindings as `html`. */
export const svg = tag('svg');

export function isTemplateResult(value: unknown): value is TemplateResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[TEMPLATE_RESULT] === true
  );
}

/** Renders nothing in a child position; removes the attribute in an attribute position. */
export const nothing: null = null;
