import { repository, type Page } from './model.js';

export const theming: Page = {
  path: 'guides/theming',
  group: 'Build',
  parent: 'guides',
  eyebrow: 'Guides',
  title: 'Theming and styling',
  summary:
    'Change the theme first; reach for a component’s own variables, parts, and states only when the theme cannot say it.',
  sections: [
    {
      id: 'ladder',
      title: 'Start at the lowest level that works',
      blocks: [
        {
          list: [
            [
              { strong: 'Theme values.' },
              ' Semantic tokens (colours, spacing, radii, type) restyle every element at once, with no JavaScript.',
            ],
            [
              { strong: 'Component variables, parts, and states.' },
              ' Each element documents its ',
              { code: '--odd-<element>-*' },
              ' variables, ',
              { code: '::part()' },
              ' names, and custom states in its reference page.',
            ],
            [
              { strong: 'Your own skin.' },
              ' Every component also exports a foundation entry, ',
              { code: '@oddkin/components/<name>/foundation' },
              ': its behaviour, template, and structural styles, for your visual styles under your own tag.',
            ],
          ],
        },
        {
          p: [
            'Every element’s reference lists the levels it supports (',
            { link: 'Components', href: '/components' },
            ').',
          ],
        },
      ],
    },
    {
      id: 'scopes',
      title: 'Scopes and overrides',
      blocks: [
        {
          p: [
            'The generated tokens sit in the ',
            { code: 'odd.tokens' },
            ' cascade layer, so unlayered page CSS overrides them. Theme, mode, product, and density scopes are attributes; they nest in any order and reach into shadow roots, because tokens are inherited custom properties.',
          ],
        },
        {
          code: {
            lang: 'css',
            verify: 'css',
            code: `.marketing {
  --odd-color-text-primary: #1e1b4b;
  --odd-radius-md: 0;
}`,
          },
        },
      ],
    },
    {
      id: 'components',
      title: 'Style one component',
      blocks: [
        {
          p: [
            'Page selectors never reach inside a component. Use its documented hooks: a variable on the host, a part, or a custom state.',
          ],
        },
        {
          code: {
            lang: 'css',
            verify: 'none',
            code: `odd-button.cta {
  --odd-button-radius: var(--odd-radius-full);
}
odd-input:state(user-invalid)::part(control) {
  outline: 2px solid var(--odd-color-danger-foreground);
}`,
          },
        },
      ],
    },
  ],
};

export const layout: Page = {
  path: 'guides/layout',
  group: 'Build',
  parent: 'guides',
  eyebrow: 'Guides',
  title: 'Layout',
  summary:
    'Arrange pages with a few layout classes and let containers, not the viewport, decide when a layout changes.',
  sections: [
    {
      id: 'classes',
      title: 'Layout classes',
      blocks: [
        {
          p: [
            { code: '@oddkin/components/css/layout.css' },
            ' defines one class per arrangement, each tuned by a variable and spaced by the theme’s layout tokens:',
          ],
        },
        {
          table: {
            caption: 'Layout classes',
            head: ['Class', 'Arrangement', 'Variables'],
            rows: [
              [[{ code: 'odd-stack' }], ['Children in a column'], [{ code: '--odd-stack-gap' }]],
              [[{ code: 'odd-row' }], ['Children in one row'], [{ code: '--odd-row-gap' }]],
              [[{ code: 'odd-cluster' }], ['A row that wraps'], [{ code: '--odd-cluster-gap' }]],
              [
                [{ code: 'odd-grid' }],
                ['Equal columns'],
                [{ code: '--odd-grid-columns' }, ', ', { code: '--odd-grid-gap' }],
              ],
              [
                [{ code: 'odd-auto-grid' }],
                ['As many columns as fit'],
                [{ code: '--odd-auto-grid-min' }],
              ],
              [
                [{ code: 'odd-split' }],
                ['A side beside the main content, wrapping below a minimum'],
                [{ code: '--odd-split-side-width' }, ', ', { code: '--odd-split-main-min' }],
              ],
              [[{ code: 'odd-center' }], ['Its content centred in both directions'], ['']],
              [
                [{ code: 'odd-box' }],
                ['Padding from the inset tokens'],
                [{ code: '--odd-box-inset' }],
              ],
            ],
          },
        },
        {
          code: {
            lang: 'html',
            verify: 'markup',
            code: `<link rel="stylesheet" href="/node_modules/@oddkin/components/dist/css/layout.css" />
<main class="odd-split">
  <nav class="odd-stack">…</nav>
  <article class="odd-stack odd-stack-loose">…</article>
</main>`,
          },
        },
      ],
    },
    {
      id: 'containers',
      title: 'Containers and scrolling',
      blocks: [
        {
          p: [
            { code: '<odd-container>' },
            ' keeps content to a readable measure and is a size container, so what is inside responds to its width. ',
            { code: '<odd-scroll-region>' },
            ' is a labelled, keyboard-scrollable region for content wider or taller than its space.',
          ],
        },
      ],
    },
    {
      id: 'recipes',
      title: 'Inside components',
      blocks: [
        {
          p: [
            'Components arrange their own regions with the same helpers (',
            { code: 'stack' },
            ', ',
            { code: 'row' },
            ', ',
            { code: 'autoGrid' },
            ', ',
            { code: 'split' },
            ') as layout recipes, extracted to CSS at build time; see ',
            { link: 'layout-recipes.md', href: `${repository}docs/architecture/layout-recipes.md` },
            ' and the ',
            { link: 'side navigation guide', href: '/layout/side-nav' },
            '.',
          ],
        },
      ],
    },
  ],
};

export const formsAccessibility: Page = {
  path: 'guides/forms-accessibility',
  group: 'Build',
  parent: 'guides',
  eyebrow: 'Guides',
  title: 'Forms and accessibility',
  summary:
    'Form controls behave like native fields, and every element follows the WAI-ARIA Authoring Practices for its pattern.',
  sections: [
    {
      id: 'forms',
      title: 'Native forms',
      blocks: [
        {
          list: [
            [
              'Controls are form-associated: they submit their ',
              { code: 'name' },
              ' and value, reset with the form, and follow a disabled ',
              { code: '<fieldset>' },
              '.',
            ],
            [
              'Validation uses the constraint API (',
              { code: 'required' },
              ', ',
              { code: 'checkValidity()' },
              ', ',
              { code: 'validity' },
              '); errors show after the user leaves a field or submits, with the ',
              { code: ':state(user-invalid)' },
              ' custom state.',
            ],
            [
              { code: '<odd-validation-summary>' },
              ' lists a form’s problems after a submission that validation blocked, takes focus, and links each problem to its control.',
            ],
          ],
        },
        {
          code: {
            lang: 'html',
            verify: 'markup',
            code: `<form>
  <odd-input name="email" type="email" label="Email" required></odd-input>
  <odd-checkbox name="terms" required>I accept the terms</odd-checkbox>
  <odd-button type="submit" appearance="primary">Create account</odd-button>
</form>`,
          },
        },
      ],
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      blocks: [
        {
          list: [
            [
              'Each element names its pattern and keyboard model in its reference (',
              { code: 'a11y' },
              ' and ',
              { code: 'keyboard' },
              ' in the metadata).',
            ],
            [
              'Focus rings are outlines that stay visible in forced-colours mode; colour never carries meaning alone.',
            ],
            [
              'Targets never fall below the target-size token; text wraps inside narrow containers.',
            ],
            ['Motion follows ', { code: 'prefers-reduced-motion' }, '.'],
          ],
        },
        {
          note: [
            'Screen-reader passes and some browser and zoom checks are still open; they are listed as limitations, not passes, in the verification record.',
          ],
        },
      ],
    },
  ],
};

export const composition: Page = {
  path: 'guides/composition',
  group: 'Build',
  parent: 'guides',
  eyebrow: 'Guides',
  title: 'Composition: data, templates, or both',
  summary:
    'Write markup when the structure is fixed; pass data when it comes from somewhere else; describe a whole interface as data when an agent or a server produces it.',
  sections: [
    {
      id: 'choose',
      title: 'Which to use',
      blocks: [
        {
          table: {
            caption: 'Data, templates, or a composition document',
            head: ['When', 'Use'],
            rows: [
              [['The structure is known when you write it'], ['Markup: slots and children']],
              [['A list comes from an API or a CMS'], ['A data property, validated by its model']],
              [['Most entries are data, a few need custom markup'], ['Data plus slots (hybrid)']],
              [['An agent or a server describes the interface'], ['A composition document']],
            ],
          },
        },
      ],
    },
    {
      id: 'models',
      title: 'Validate external data',
      blocks: [
        {
          p: [
            'TypeScript types do not check JSON at run time. Data properties publish a model that does, and the same model is a JSON Schema:',
          ],
        },
        {
          code: {
            lang: 'js',
            verify: 'module',
            code: `import '@oddkin/components/define/side-nav';
import { NavigationItemModel } from '@oddkin/components/models';

const nav = document.querySelector('odd-side-nav');
const result = NavigationItemModel.validate(await (await fetch('/nav.json')).json());
if (result.ok) nav.items = result.value;`,
          },
        },
        {
          p: [
            'Replace the array to change entries; never mutate it. The ',
            { link: 'side navigation guide', href: '/layout/side-nav' },
            ' shows data, markup, and hybrid side by side.',
          ],
        },
      ],
    },
    {
      id: 'documents',
      title: 'Interfaces as data',
      blocks: [
        {
          p: [
            { code: '@oddkin/components/composition' },
            ' validates and renders a composition document: published elements, attributes, and properties only, with actions reported to your handler by name. See ',
            { link: 'Agent tooling', href: '/tooling' },
            ' and ',
            {
              link: 'data-composition.md §8',
              href: `${repository}docs/architecture/data-composition.md`,
            },
            '.',
          ],
        },
      ],
    },
  ],
};
