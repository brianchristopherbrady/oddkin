import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buttonDefinition, buttonStructuralStyles } from '../src/button/index.js';
import { cardDefinition, cardStructuralStyles } from '../src/card/index.js';
import { inputDefinition, inputStructuralStyles } from '../src/input/index.js';

// Styling contract (theming-and-styling.md §7): components read inherited theme roles, expose
// documented component variables read with a role fallback, and never declare theme properties
// on :host, which would mask ancestor scopes. Reads the built CEM and generated theme
// (`npm run build`).
const cem = JSON.parse(
  readFileSync(new URL('../custom-elements.json', import.meta.url), 'utf8'),
) as {
  modules: {
    declarations?: {
      tagName?: string;
      cssProperties?: { name: string; description?: string }[];
    }[];
  }[];
};
const theme = new Set(
  [
    ...readFileSync(new URL('../../tokens/dist/css/default.css', import.meta.url), 'utf8').matchAll(
      /(--odd-[\w-]+)\s*:/g,
    ),
  ].map((match) => match[1]!),
);
const components = [
  { definition: buttonDefinition, structural: buttonStructuralStyles },
  { definition: cardDefinition, structural: cardStructuralStyles },
  { definition: inputDefinition, structural: inputStructuralStyles },
];
const cssOf = (definition: { readonly styles?: unknown }) =>
  (definition.styles as readonly { cssText: string }[]).map((style) => style.cssText).join('\n');
const reads = (css: string) =>
  [...css.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)].map((m) => ({ name: m[1]!, fallback: !!m[2] }));
const documented = (tag: string) =>
  cem.modules.flatMap((m) => m.declarations ?? []).find((d) => d.tagName === tag)?.cssProperties ??
  [];

describe.each(components)('$definition.name styles', ({ definition, structural }) => {
  const tag = definition.name;
  const css = cssOf(definition);
  // Form controls share one family of field variables (control.styles.ts), documented on each.
  const own = (name: string) => name.startsWith(`--${tag}-`) || name.startsWith('--odd-field-');

  it('declare no custom properties, so ancestor theme scopes stay visible inside', () => {
    expect(css.match(/(?:^|[{;\s])--[\w-]+\s*:/g) ?? []).toEqual([]);
  });

  it('read only roles the generated theme declares', () => {
    const unknown = reads(css)
      .filter((read) => !own(read.name))
      .map((read) => read.name)
      .filter((name) => !theme.has(name));
    expect(unknown).toEqual([]);
  });

  it('read each component variable with a role fallback unless the theme declares it', () => {
    for (const read of reads(css).filter((r) => own(r.name))) {
      // A theme-declared variable is never unset, so a fallback after it would be dead.
      if (theme.has(read.name)) expect(read.fallback, read.name).toBe(false);
      else expect(read.fallback, read.name).toBe(true);
    }
  });

  it('document exactly the component variables they read, each with a description', () => {
    const variables = documented(tag);
    for (const variable of variables) expect(variable.description, variable.name).toBeTruthy();
    const read = new Set(
      reads(css)
        .map((r) => r.name)
        .filter(own),
    );
    // Theme roles named like component variables are read as tokens; they are still documented.
    for (const name of theme) if (own(name)) read.add(name);
    expect(variables.map((v) => v.name).sort()).toEqual([...read].sort());
  });

  it('keep brand and visual roles out of the structural styles', () => {
    expect(reads(structural.cssText).filter((r) => r.name.startsWith('--odd-'))).toEqual([]);
  });
});

it('only card.padding and card.radius are theme roles named like component variables', () => {
  const tags = components.map((c) => c.definition.name);
  const shared = [...theme].filter((name) => tags.some((tag) => name.startsWith(`--${tag}-`)));
  expect(shared.sort()).toEqual(['--odd-card-padding', '--odd-card-radius']);
});
