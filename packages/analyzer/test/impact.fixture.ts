/**
 * A small library whose dependencies are known by construction, for change-impact known-answer
 * tests (change-impact-and-verification.md §6). Every input is an artifact the real tools emit:
 * CEM, `oddkin.metadata.json`, token inspection JSON, ThemeConfig, and `product.v1` manifests.
 *
 *   acme-button        template button.template, styles button.structural (radius.control)
 *                      + button.skin (color.action)
 *   acme-quiet-button  extends acme-button: same template and structural styles, own skin
 *                      quiet.skin (color.text)
 *   acme-card          card.template, card.skin (color.surface, radius.surface)
 *   acme-field         field.template, field.skin (color.surface, radius.control)
 *   acme-dialog        dialog.template, dialog.skin (color.surface); renders acme-button
 *   example acme-card/withAction renders an acme-button in its fixture (metadata `uses`)
 *
 *   tokens: color.brand → color.action; color.text; color.surface;
 *           radius.base → radius.control, radius.surface
 *   products: p1 has its own brand (sets color.brand); p2 overrides radius.control;
 *             p3 applies to acme-button and acme-card only; the rest use the base theme.
 */
import type { SnapshotInputs } from '../src/impact.js';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
export type LibraryInputs = Mutable<SnapshotInputs>;

const field = (name: string, type: string, extra: object = {}) => ({
  kind: 'field',
  name,
  type: { text: type },
  ...extra,
});
const declaration = (name: string, tagName: string, extra: object = {}) => ({
  kind: 'class',
  name,
  tagName,
  customElement: true,
  description: `${name}.`,
  ...extra,
});
// A function, so the two declarations never share objects (parsed JSON never does).
const buttonApi = () => ({
  members: [
    field('appearance', '"primary" | "secondary"', {
      default: "'secondary'",
      attribute: 'appearance',
      reflects: true,
    }),
    field('disabled', 'boolean', { default: 'false', attribute: 'disabled', reflects: true }),
  ],
  attributes: [
    { name: 'appearance', type: { text: '"primary" | "secondary"' }, fieldName: 'appearance' },
    { name: 'disabled', type: { text: 'boolean' }, fieldName: 'disabled' },
  ],
  slots: [{ name: '' }],
  cssParts: [{ name: 'control' }],
  cssProperties: [{ name: '--acme-button-bg' }],
});
const ref = (module: string, name: string) => ({ module, name });

export function library(products: number): LibraryInputs {
  const ids = Array.from({ length: products }, (_, i) => `p${i + 1}`);
  const modules: Record<string, string> = {};
  for (const path of [
    'dist/button/button.js',
    'dist/button/button.template.js',
    'dist/button/button.structural.styles.js',
    'dist/button/button.styles.js',
    'dist/quiet/quiet.js',
    'dist/quiet/quiet.styles.js',
    'dist/card/card.js',
    'dist/card/card.template.js',
    'dist/card/card.styles.js',
    'dist/field/field.js',
    'dist/field/field.template.js',
    'dist/field/field.styles.js',
    'dist/dialog/dialog.js',
    'dist/dialog/dialog.template.js',
    'dist/dialog/dialog.styles.js',
    'src/button/button.examples.ts',
    'src/card/card.examples.ts',
  ])
    modules[path] = `// ${path}\nexport const source = 1;\n`;

  const example = (tag: string, name: string, extra: object = {}) => [
    `example:${tag}/${name}`,
    {
      component: `component:${tag}`,
      name,
      file: `src/${tag.slice(5)}/${tag.slice(5)}.examples.ts`,
      ...extra,
    },
  ];
  return {
    packages: [
      {
        name: '@acme/ui',
        version: '1.0.0',
        exports: {
          './button': './dist/button/index.js',
          './define/button': './dist/button/button.define.js',
        },
        modules,
        manifest: {
          modules: [
            {
              path: 'dist/button/button.js',
              declarations: [declaration('AcmeButton', 'acme-button', buttonApi())],
            },
            {
              path: 'dist/quiet/quiet.js',
              declarations: [declaration('AcmeQuietButton', 'acme-quiet-button', buttonApi())],
            },
            {
              path: 'dist/card/card.js',
              declarations: [
                declaration('AcmeCard', 'acme-card', {
                  members: [
                    field('padding', '"sm" | "md"', { default: "'md'", attribute: 'padding' }),
                  ],
                  attributes: [
                    { name: 'padding', type: { text: '"sm" | "md"' }, fieldName: 'padding' },
                  ],
                  slots: [{ name: '' }, { name: 'header' }],
                  cssParts: [{ name: 'frame' }],
                }),
              ],
            },
            {
              path: 'dist/field/field.js',
              declarations: [
                declaration('AcmeField', 'acme-field', {
                  members: [field('value', 'string')],
                  events: [{ name: 'input', type: { text: 'CustomEvent' } }],
                  cssParts: [{ name: 'control' }],
                }),
              ],
            },
            {
              path: 'dist/dialog/dialog.js',
              declarations: [
                declaration('AcmeDialog', 'acme-dialog', {
                  members: [field('open', 'boolean', { default: 'false', attribute: 'open' })],
                  attributes: [{ name: 'open', type: { text: 'boolean' }, fieldName: 'open' }],
                  slots: [{ name: '' }],
                }),
              ],
            },
          ],
        },
        metadata: {
          components: {
            'component:acme-button': {
              tag: 'acme-button',
              registration: '@acme/ui/define/button',
              definition: {
                template: ref('dist/button/button.template.js', 'buttonTemplate'),
                styles: [
                  ref('dist/button/button.structural.styles.js', 'buttonStructuralStyles'),
                  ref('dist/button/button.styles.js', 'buttonStyles'),
                ],
              },
            },
            'component:acme-quiet-button': {
              tag: 'acme-quiet-button',
              definition: {
                extends: 'component:acme-button',
                template: ref('dist/button/button.template.js', 'buttonTemplate'),
                styles: [
                  ref('dist/button/button.structural.styles.js', 'buttonStructuralStyles'),
                  ref('dist/quiet/quiet.styles.js', 'quietStyles'),
                ],
              },
            },
            'component:acme-card': {
              tag: 'acme-card',
              definition: {
                template: ref('dist/card/card.template.js', 'cardTemplate'),
                styles: [ref('dist/card/card.styles.js', 'cardStyles')],
              },
            },
            'component:acme-field': {
              tag: 'acme-field',
              definition: {
                template: ref('dist/field/field.template.js', 'fieldTemplate'),
                styles: [ref('dist/field/field.styles.js', 'fieldStyles')],
              },
            },
            'component:acme-dialog': {
              tag: 'acme-dialog',
              definition: {
                template: ref('dist/dialog/dialog.template.js', 'dialogTemplate'),
                styles: [ref('dist/dialog/dialog.styles.js', 'dialogStyles')],
                dependencies: { action: 'component:acme-button' },
              },
            },
          },
          templates: {
            'dist/button/button.template.js#buttonTemplate': { slots: [''], parts: ['control'] },
            'dist/card/card.template.js#cardTemplate': { slots: ['', 'header'], parts: ['frame'] },
            'dist/field/field.template.js#fieldTemplate': { parts: ['control'] },
            'dist/dialog/dialog.template.js#dialogTemplate': { slots: [''] },
          },
          styles: {
            'dist/button/button.structural.styles.js#buttonStructuralStyles': {
              tokens: ['radius.control'],
            },
            'dist/button/button.styles.js#buttonStyles': {
              tokens: ['color.action', '--acme-button-bg'],
            },
            'dist/quiet/quiet.styles.js#quietStyles': { tokens: ['--odd-color-text'] },
            'dist/card/card.styles.js#cardStyles': { tokens: ['color.surface', 'radius.surface'] },
            'dist/field/field.styles.js#fieldStyles': {
              tokens: ['color.surface', 'radius.control'],
            },
            'dist/dialog/dialog.styles.js#dialogStyles': { tokens: ['color.surface'] },
          },
          examples: Object.fromEntries([
            example('acme-button', 'default'),
            example('acme-button', 'primary'),
            example('acme-button', 'disabledFalse', {
              incorrect: {
                diagnostic: 'usage.boolean.false',
                correct: 'example:acme-button/default',
              },
            }),
            example('acme-quiet-button', 'default'),
            example('acme-card', 'default'),
            // Its fixture renders an acme-button in the footer.
            example('acme-card', 'withAction', { uses: ['component:acme-button'] }),
            example('acme-field', 'default'),
            example('acme-dialog', 'default'),
          ]),
          diagnostics: [],
        },
      },
    ],
    theme: {
      config: {
        name: 'default',
        brand: { primary: '#3355ff' },
        products: Object.fromEntries(
          ids.map((id) => [
            id,
            id === 'p1'
              ? { brand: { primary: '#0a7d5a' } }
              : id === 'p2'
                ? { overrides: { 'radius.control': '0px' } }
                : {},
          ]),
        ),
      },
      inspection: {
        theme: 'default',
        tokens: [
          {
            name: 'color.brand',
            cssVariable: '--odd-color-brand',
            type: 'color',
            definition: '#3355ff',
            value: '#3355ff',
          },
          {
            name: 'color.action',
            cssVariable: '--odd-color-action',
            type: 'color',
            definition: '{color.brand}',
            value: '#3355ff',
          },
          {
            name: 'color.text',
            cssVariable: '--odd-color-text',
            type: 'color',
            definition: '#111111',
            value: '#111111',
          },
          {
            name: 'color.surface',
            cssVariable: '--odd-color-surface',
            type: 'color',
            definition: '#ffffff',
            value: '#ffffff',
          },
          {
            name: 'radius.base',
            cssVariable: '--odd-radius-base',
            type: 'dimension',
            definition: '4px',
            value: '4px',
          },
          {
            name: 'radius.control',
            cssVariable: '--odd-radius-control',
            type: 'dimension',
            definition: '{radius.base}',
            value: '4px',
          },
          {
            name: 'radius.surface',
            cssVariable: '--odd-radius-surface',
            type: 'dimension',
            definition: '{radius.base}',
            value: '4px',
          },
        ],
        scopes: ids.map((id) => ({
          selector: `[data-odd-product="${id}"]`,
          changed: id === 'p1' ? ['color.brand'] : id === 'p2' ? ['radius.control'] : [],
          redeclared: id === 'p1' ? ['color.action'] : [],
        })),
      },
    },
    products: ids.map((id) => ({
      id,
      theme: { config: './theme.json', product: id },
      ...(id === 'p3' ? { components: ['acme-button', 'acme-card'] } : {}),
    })),
    suites: [
      { id: 'oddkin.button', version: '1.0.0', targets: ['acme-button', 'acme-quiet-button'] },
    ],
    versions: { analyzer: '0.1.0', generator: '0.1.0', metadataSchema: '1' },
  };
}

/** A deep copy to edit into the head revision. */
export const clone = <T>(value: T): T => structuredClone(value);
