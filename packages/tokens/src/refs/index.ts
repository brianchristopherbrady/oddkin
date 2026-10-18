/**
 * `@oddkin/tokens/refs` — typed CSS custom-property references. DOM-free, registration-free,
 * no runtime state: `token('space.md')` → `'var(--odd-space-md)'`.
 *
 * Names are typed for the default theme. For a configured theme, use the `refs.ts` module
 * that `oddkin-tokens build --format ts` emits for it.
 */
import type { TokenName } from '../generated/default-names.js';

export type { TokenName };

/**
 * A `var(--odd-…)` reference that follows runtime theme, mode, product, and density
 * scopes. Optional `fallback` is used where the property is not declared.
 */
export function token(name: TokenName, fallback?: string): string {
  return `var(--odd-${name.replace(/\./g, '-')}${fallback === undefined ? '' : `, ${fallback}`})`;
}

/** The custom-property name for a token, e.g. for `style.setProperty`. */
export function tokenVariable(name: TokenName): string {
  return `--odd-${name.replace(/\./g, '-')}`;
}
