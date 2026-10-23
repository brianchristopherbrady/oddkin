import { compose, define, type ElementDefinition } from '@oddkin/core/element';
import { css, type CSSResult } from '@oddkin/core/styles';
import './register.js';

// A derived implementation of every component (customization level 3): a subclass with the shared
// definition's template and structural styles and a different skin in place of the default one,
// registered as `derived-<name>`. Shared fixtures then run unchanged against both tags. Components
// are found by file name, so a new one needs no edit here.
const entries = import.meta.glob<Record<string, unknown>>('../src/*/index.ts', { eager: true });

const isDefinition = (value: unknown): value is ElementDefinition =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ElementDefinition).name === 'string' &&
  typeof (value as ElementDefinition).element === 'function';

export const definitions: Record<string, ElementDefinition> = Object.fromEntries(
  Object.values(entries)
    .flatMap((module) => Object.values(module).filter(isDefinition))
    .map((definition) => [definition.name, definition] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);
export const derivedSkin = css`
  :host {
    --derived: 1;
  }
`;
export const derivedTag = (tag: string) => tag.replace(/^odd-/, 'derived-');

for (const definition of Object.values(definitions)) {
  const styles = definition.styles as readonly CSSResult[];
  define(compose({
    ...definition,
    name: derivedTag(definition.name),
    element: class extends definition.element {},
    styles: [...styles.slice(0, -1), derivedSkin],
  }));
}
