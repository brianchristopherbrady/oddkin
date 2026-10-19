import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UNKNOWN_REFERENCE,
  analyze,
  authoredTexts,
  checkReferences,
  referenceIndex,
  type AuthoredText,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const manifest = {
  schemaVersion: '2.1.0',
  modules: [
    {
      kind: 'javascript-module',
      path: 'card.js',
      declarations: [
        {
          kind: 'class',
          name: 'XCard',
          tagName: 'x-card',
          customElement: true,
          description: 'A card. Set `.variant`; listen for `x-close`.',
          members: [
            { kind: 'field', name: 'variant', description: 'Look; see `variant="b"`.' },
            { kind: 'field', name: 'open' },
            { kind: 'method', name: 'close', description: 'Closes; no `opne()` exists.' },
            { kind: 'field', name: 'registry', static: true },
          ],
          attributes: [
            { name: 'variant', type: { text: '"a" | "b"' } },
            { name: 'open', type: { text: 'boolean' } },
          ],
          events: [{ name: 'x-close' }],
          slots: [{ name: '' }, { name: 'footer' }],
          cssParts: [{ name: 'body' }],
          cssProperties: [{ name: '--x-card-gap' }],
          cssStates: [{ name: 'busy' }],
        },
        { kind: 'function', name: 'helper', description: 'Use `.anything`; returns `space.md`.' },
      ],
    },
  ],
};
const metadata = {
  components: {
    'component:x-card': {
      useFor: [
        {
          value: 'Grouping; prefer `x-cards` for lists.',
          provenance: 'authored',
          source: { file: 'src/card.ts', line: 3, column: 4 },
        },
        { value: 'No code spans here.', provenance: 'authored' },
      ],
      a11y: [{ value: 'Extracted `.nothing` is not authored.', provenance: 'extracted' }],
    },
  },
  recipes: { 'recipe:stack': { name: 'stack' } },
};
const index = referenceIndex({
  manifests: [manifest],
  metadata: [metadata],
  packages: [
    {
      name: '@acme/ui',
      exports: { '.': './dist/index.js', './card': './dist/card.js', './css/*.css': './css/*' },
    },
    { name: '@acme/tokens', exports: './dist/index.js' },
  ],
  tokens: ['space.md', 'color.text.primary'],
  variables: ['--acme-space-md'],
});
const check = (text: string, subject: string | null = 'x-card') =>
  checkReferences([{ text, at: 'here', ...(subject ? { subject } : {}) }], index).map(
    (d) => d.message,
  );

describe('authored references', () => {
  it('accepts every reference the contracts declare, and leaves other code spans as prose', () => {
    const valid = [
      '`<x-card variant="a">`, `<x-card open>`, `x-card::part(body)`, `x-card:state(busy)`',
      '`.variant`, `.open = false`, `close()`, `variant="b"`, `slot="footer"`, `::part(body)`',
      '`:state(busy)`, `--x-card-gap`, `--acme-space-md`, `space.md`, `color.text.primary`',
      '`@acme/ui`, `@acme/ui/card`, `@acme/ui/css/theme.css`, `@acme/tokens`, `x-close`',
      'the `x-close` event, the `stack` layout recipe, the `stack` recipe',
      // Prose: HTML, ARIA, DOM APIs, native events, values, and other scopes.
      '`<button>`, `aria-expanded="true"`, `role="region"`, the `submit` event, `detail.reason`',
      '`ElementInternals.states`, `variant`, `footer`, `new FormData(form)`, `@other/pkg/x`',
    ];
    for (const text of valid) expect(check(text), text).toEqual([]);
  });

  it('reports each reference that resolves to nothing', () => {
    const cases: [string, string][] = [
      ['`.varient`', '`.varient` is not a property or method of x-card'],
      ['`opne()`', '`opne()` is not a method of x-card'],
      ['`open()`', '`open()` is not a method of x-card'],
      ['`variant="c"`', '`variant="c"` gives x-card [variant] a value outside a, b'],
      ['`tone="loud"`', '`tone="loud"` names an attribute x-card does not declare'],
      ['`slot="header"`', '`slot="header"` names a slot x-card does not declare'],
      ['`::part(head)`', '`::part(head)` names a part x-card does not declare'],
      ['`:state(idle)`', '`:state(idle)` names a custom state x-card does not declare'],
      ['`x-card:state(idle)`', 'names a custom state x-card does not declare'],
      ['`<x-card variant="c">`', 'gives x-card [variant] a value outside a, b'],
      ['`x-cards`', '`x-cards` is not a known element or event'],
      ['`<x-cards open>`', '`<x-cards open>` is not a known element'],
      ['`--x-card-margin`', 'is neither a token variable nor a declared CSS property'],
      ['`space.mdd`', '`space.mdd` is not a token'],
      ['`@acme/ui/cards`', '`@acme/ui/cards` is not a public entry point'],
      ['`@acme/tokens/refs`', '`@acme/tokens/refs` is not a public entry point'],
      ['the `x-open` event', '`x-open` is not an event of x-card'],
      ['the `grid` layout recipe', '`grid` is not a known layout recipe'],
    ];
    for (const [text, message] of cases) {
      const found = check(text);
      expect(found, text).toHaveLength(1);
      expect(found[0], text).toContain(message);
    }
    const [diagnostic] = checkReferences(
      [{ text: '`.varient`', subject: 'x-card', at: 'odd place', source: at(1) }],
      index,
    );
    expect(diagnostic).toEqual({
      code: UNKNOWN_REFERENCE,
      severity: 'warning',
      message: 'odd place: `.varient` is not a property or method of x-card.',
      source: at(1),
      suggestion: 'Cite only names the published contracts declare, or drop the code span.',
    });
  });

  it('checks member-shaped references only against the element the text describes', () => {
    expect(check('`.anything`, `whatever()`, `x="y"`, `::part(none)`', null)).toEqual([]);
    // Elements, entry points, variables, and tokens are global.
    expect(check('`x-cards`, `@acme/ui/cards`, `--nope`, `space.mdd`', null)).toHaveLength(4);
    // A member path whose first segment is a property is not a token.
    expect(check('`variant.a`')).toEqual([]);
  });

  it('gathers authored text from CEM descriptions, authored metadata facts, and examples', () => {
    const example: AuthoredText = {
      text: 'Use `slot="footer"`.',
      subject: 'x-card',
      at: 'example:x-card/default guidance',
    };
    const texts = authoredTexts(manifest, metadata, [{ texts: [example] }, {}]);
    expect(texts.map((t) => [t.at, t.subject ?? null])).toEqual([
      ['x-card', 'x-card'],
      ['x-card variant', 'x-card'],
      ['x-card close', 'x-card'],
      ['helper', null],
      ['x-card useFor/0', 'x-card'],
      ['example:x-card/default guidance', 'x-card'],
    ]);
    expect(texts[4]?.source).toEqual({ file: 'src/card.ts', line: 3, column: 4 });
    expect(checkReferences(texts, index).map((d) => d.message)).toEqual([
      'x-card close: `opne()` is not a method of x-card.',
      'x-card useFor/0: `x-cards` is not a known element or event.',
    ]);
  });

  it('reads literal example labels, guidance, and mistake explanations with their locations', () => {
    const composed = analyze({
      project: resolve(root, 'tests/fixtures/analyzer-composed/tsconfig.json'),
    });
    const texts = composed.examples.flatMap((e) => e.texts ?? []);
    expect(texts).toEqual([
      {
        text: "The attribute's presence makes the panel dismissible, whatever its value.",
        subject: 'acme-panel',
        at: 'example:acme-panel/dismissibleFalse explanation',
        source: { file: 'src/panel/panel.examples.ts', line: 16, column: 20 },
      },
    ]);
  }, 60_000);
});

function at(line: number) {
  return { file: 'src/card.ts', line, column: 1 };
}
