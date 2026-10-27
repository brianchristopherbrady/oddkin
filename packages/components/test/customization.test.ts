import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ElementDefinition } from '@oddkin/core/element';
import type { CSSResult } from '@oddkin/core/styles';

// Customization levels (multi-product.md §6): each level an element declares with
// `@customization` (published as `customization.levels`) is one it ships. Level 1: its default
// styles read theme roles. Level 2: it documents parts, slots, or component variables, and reads
// each variable it documents (contract.browser.test.ts renders each part and slot). Level 3: its
// foundation entry exports the behavior, the template, and every structural sheet of its
// definition, and no default skin; those sheets read no visual roles; the definition ends with
// its skin, which test/derived.ts replaces. Reads the build (`npm run build`).
const json = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Record<string, any>;
const metadata = json('../oddkin.metadata.json');
const declarations = (
  json('../custom-elements.json')['modules'] as { declarations?: Record<string, any>[] }[]
).flatMap((m) => m.declarations ?? []);
const theme = new Set(
  [
    ...readFileSync(new URL('../../tokens/dist/css/default.css', import.meta.url), 'utf8').matchAll(
      /(--odd-[\w-]+)\s*:/g,
    ),
  ].map((match) => match[1]!),
);

const isDefinition = (value: unknown): value is ElementDefinition =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ElementDefinition).name === 'string' &&
  typeof (value as ElementDefinition).element === 'function';
const definitions = Object.entries(
  import.meta.glob<Record<string, unknown>>('../src/*/index.ts', { eager: true }),
).flatMap(([path, module]) =>
  Object.values(module)
    .filter(isDefinition)
    .map((definition) => ({ folder: path.split('/')[2]!, definition })),
);
const foundations = import.meta.glob<Record<string, unknown>>('../src/*/foundation.ts', {
  eager: true,
});
// Each style source by its export name.
const names = new Map<unknown, string>();
for (const module of Object.values(
  import.meta.glob<Record<string, unknown>>('../src/**/*.ts', { eager: true }),
))
  for (const [name, value] of Object.entries(module))
    if (typeof value === 'object' && value !== null && 'cssText' in value) names.set(value, name);

// Structural: the `*StructuralStyles` sheets, generated layout recipes, and the shared primitives.
const PRIMITIVES = ['hostStyles', 'visuallyHiddenStyles', 'glyphStyles', 'spinnerStyles'];
const structural = (name: string) =>
  name.endsWith('StructuralStyles') || name.endsWith('RecipeStyles') || PRIMITIVES.includes(name);
// Visual roles: colour, type, borders and radii, elevation, motion, and the focus ring.
const VISUAL = /^--odd-(?:color|type|border|elevation|motion|focus)-|^--odd-.*(?:radius|shadow)/;
const reads = (css: string) => [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!);
const levels = (tag: string) =>
  (metadata['components'][`component:${tag}`].customization.levels as { value?: number[] }).value ??
  [];

describe('customization levels', () => {
  it('are declared by every element; only odd-tab-panel, which has no look of its own, lacks level 1', () => {
    const declared = Object.fromEntries(
      definitions.map(({ definition }) => [definition.name, levels(definition.name)]),
    );
    for (const [tag, value] of Object.entries(declared))
      expect(value, tag).toEqual(tag === 'odd-tab-panel' ? [2, 3] : [1, 2, 3]);
  });

  describe.each(definitions.map(({ folder, definition }) => [definition.name, folder, definition]))(
    '%s',
    (tag, folder, definition) => {
      const declared = levels(tag);
      const styles = definition.styles as readonly CSSResult[];
      const css = styles.map((style) => style.cssText).join('\n');

      it.runIf(declared.includes(1))('level 1: its default styles read theme roles', () => {
        expect(reads(css).filter((name) => theme.has(name)).length).toBeGreaterThan(0);
      });

      it.runIf(declared.includes(2))(
        'level 2: documents parts, slots, or variables, and reads each variable it documents',
        () => {
          const declaration = declarations.find((d) => d['tagName'] === tag)!;
          // `--_` properties are the element's own wiring, not customization paths.
          const variables = (
            (declaration['cssProperties'] ?? []) as { name: string; description?: string }[]
          ).filter((variable) => !variable.name.startsWith('--_'));
          const documented = [
            ...(declaration['cssParts'] ?? []),
            ...(declaration['slots'] ?? []),
            ...variables,
          ];
          expect(documented.length).toBeGreaterThan(0);
          const read = new Set(reads(css));
          for (const variable of variables) {
            expect(variable.description, variable.name).toBeTruthy();
            expect(read.has(variable.name) || theme.has(variable.name), variable.name).toBe(true);
          }
        },
      );

      it.runIf(declared.includes(3))(
        'level 3: the foundation entry exports the behavior, template, and structural sheets, and no skin',
        () => {
          const exported = new Set(Object.values(foundations[`../src/${folder}/foundation.ts`]!));
          expect(exported.has(definition.element)).toBe(true);
          expect(exported.has(definition.template)).toBe(true);
          const named = styles.map((style) => names.get(style)!);
          expect(named.filter((name) => structural(name)).sort()).toEqual(
            styles
              .filter((style) => exported.has(style))
              .map((style) => names.get(style)!)
              .sort(),
          );
          expect(structural(named.at(-1)!), 'the definition ends with its skin').toBe(false);
          const visual = styles
            .filter((style) => exported.has(style))
            .flatMap((style) => reads(style.cssText))
            .filter((name) => VISUAL.test(name));
          expect(visual).toEqual([]);
        },
      );
    },
  );
});
