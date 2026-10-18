import { compose, define, type ElementDefinition } from '@oddkin/core/element';
import { css, type CSSResult } from '@oddkin/core/styles';
import { buttonDefinition } from '../src/button/index.js';
import { cardDefinition } from '../src/card/index.js';
import { inputDefinition } from '../src/input/index.js';
import { sideNavDefinition } from '../src/side-nav/index.js';

// A derived implementation of each element (customization level 3): a subclass with the shared
// definition's template and structural styles and a different skin in place of the default one.
// Importing this module registers `derived-button`, `derived-card`, `derived-input`, and
// `derived-side-nav`; shared fixtures then run unchanged against both tags.

export const definitions: Record<string, ElementDefinition> = Object.fromEntries(
  [buttonDefinition, cardDefinition, inputDefinition, sideNavDefinition].map((definition) => [
    definition.name,
    definition as unknown as ElementDefinition,
  ]),
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
