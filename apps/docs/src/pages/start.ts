import type { Page } from './model.js';

/** The five getting-started paths (plan M11). */
export const startTokens: Page = {
  path: 'getting-started/tokens',
  group: 'Start here',
  parent: 'getting-started',
  eyebrow: 'Getting started',
  title: 'Tokens only',
  summary:
    'Use the design tokens as CSS custom properties in your own CSS. No Oddkin JavaScript, no components.',
  sections: [
    {
      id: 'load',
      title: 'Load a theme stylesheet',
      blocks: [
        {
          p: [
            'The default theme is one stylesheet, the ',
            { code: '@oddkin/tokens/css/default.css' },
            ' export. Its declarations sit in the ',
            { code: 'odd.tokens' },
            ' cascade layer, so any unlayered CSS on your page overrides them.',
          ],
        },
        {
          code: {
            lang: 'html',
            verify: 'markup',
            code: '<link rel="stylesheet" href="/node_modules/@oddkin/tokens/dist/css/default.css" />',
          },
        },
      ],
    },
    {
      id: 'use',
      title: 'Use semantic tokens',
      blocks: [
        {
          p: [
            'Read semantic roles (what a value is for), not reference ramps: ',
            { code: '--odd-color-text-primary' },
            ' follows the light or dark mode and any theme scope it sits in.',
          ],
        },
        {
          code: {
            lang: 'css',
            verify: 'css',
            code: `.notice {
  color: var(--odd-color-text-primary);
  background: var(--odd-color-surface-raised);
  padding: var(--odd-space-md);
  border-radius: var(--odd-radius-md);
}`,
          },
        },
        {
          p: [
            'Scope a theme, mode, or density to part of a page with ',
            { code: 'data-odd-mode' },
            ', ',
            { code: 'data-odd-theme' },
            ', ',
            { code: 'data-odd-product' },
            ', and ',
            { code: 'data-odd-density' },
            ' attributes; scopes nest in any order.',
          ],
        },
        {
          code: {
            lang: 'html',
            verify: 'markup',
            code: '<aside data-odd-mode="dark" class="notice">Shown in the dark mode.</aside>',
          },
        },
      ],
    },
    {
      id: 'theme',
      title: 'Generate your own theme',
      blocks: [
        {
          p: [
            'One brand colour is enough for a complete theme. ',
            { code: 'oddkin-tokens' },
            ' checks a theme file and writes CSS, typed references, values, and DTCG documents.',
          ],
        },
        {
          code: {
            lang: 'sh',
            verify: 'none',
            code: `npx oddkin-tokens init
npx oddkin-tokens check oddkin.theme.json
npx oddkin-tokens build oddkin.theme.json --out tokens`,
          },
        },
        {
          p: [
            'See ',
            { link: 'Theming', href: '/guides/theming' },
            ' for roles, scopes, and overrides, and ',
            { link: 'Foundations', href: '/foundations' },
            ' for every token of the default theme.',
          ],
        },
      ],
    },
  ],
};

export const startComponents: Page = {
  path: 'getting-started/components',
  group: 'Start here',
  parent: 'getting-started',
  eyebrow: 'Getting started',
  title: 'Components in any app',
  summary:
    'Register the elements you use, then write ordinary HTML. They work in plain pages and in every framework.',
  sections: [
    {
      id: 'register',
      title: 'Register the elements you use',
      blocks: [
        {
          p: [
            'Each element has a registration entry, ',
            { code: '@oddkin/components/define/<name>' },
            '. Importing it defines the tag; importing anything else registers nothing.',
          ],
        },
        {
          code: {
            lang: 'js',
            verify: 'module',
            code: `import '@oddkin/components/define/button';
import '@oddkin/components/define/input';`,
          },
        },
        {
          code: {
            lang: 'html',
            verify: 'markup',
            code: `<form>
  <odd-input name="email" type="email" label="Email" required></odd-input>
  <odd-button appearance="primary" type="submit">Subscribe</odd-button>
</form>`,
          },
        },
        {
          p: [
            'Load a theme stylesheet too (',
            { link: 'Tokens only', href: '/getting-started/tokens' },
            '): component styles read the semantic tokens.',
          ],
        },
      ],
    },
    {
      id: 'forms',
      title: 'Native forms',
      blocks: [
        {
          p: [
            'Form controls are form-associated: they submit with ',
            { code: 'name' },
            ', take part in validation and reset, and follow disabled fieldsets, so ',
            { code: 'new FormData(form)' },
            ' reads them like native fields.',
          ],
        },
      ],
    },
    {
      id: 'autoload',
      title: 'Markup you do not control',
      blocks: [
        {
          p: [
            'For content written by people or agents, the optional autoloader registers each ',
            { code: 'odd-*' },
            ' element when its tag first appears. For an application, import each entry instead: a bundler sees it and nothing is fetched after the first render.',
          ],
        },
        { code: { lang: 'js', verify: 'module', code: "import '@oddkin/components/autoload';" } },
      ],
    },
    {
      id: 'next',
      title: 'Next',
      blocks: [
        {
          list: [
            [
              { link: 'Components', href: '/components' },
              ': every element with its API and examples.',
            ],
            [
              { link: 'Framework guides', href: '/installation/frameworks' },
              ': React, Angular, Vue, and Svelte.',
            ],
            [{ link: 'Forms and accessibility', href: '/guides/forms-accessibility' }],
          ],
        },
      ],
    },
  ],
};

export const startAuthor: Page = {
  path: 'getting-started/author',
  group: 'Start here',
  parent: 'getting-started',
  eyebrow: 'Getting started',
  title: 'Author custom elements',
  summary:
    'Typed properties, templates that update only what changed, scoped styles, and cleanup that follows the element.',
  sections: [
    {
      id: 'element',
      title: 'Declare the element',
      blocks: [
        {
          p: [
            { code: 'OddkinElement.with()' },
            ' declares public properties with their attribute conversion, defaults, and reflection; the metadata and the TypeScript types come from the same declaration.',
          ],
        },
        {
          code: {
            lang: 'ts',
            verify: 'module',
            file: 'demo-greeting.ts',
            code: `import { OddkinElement, prop } from '@oddkin/core';

export class DemoGreeting extends OddkinElement.with({
  name: prop.string({ default: 'world', description: 'Who to greet.' }),
  excited: prop.boolean({ reflect: true, description: 'Adds emphasis.' }),
}) {}`,
          },
        },
      ],
    },
    {
      id: 'compose',
      title: 'Template, styles, and registration',
      blocks: [
        {
          p: [
            'A definition joins the class, its template, and its styles; ',
            { code: 'define()' },
            ' registers it. Keep registration in its own module so importing the element registers nothing.',
          ],
        },
        {
          code: {
            lang: 'ts',
            verify: 'module',
            file: 'demo-greeting.define.ts',
            code: `import { compose, css, define, html } from '@oddkin/core';
import { DemoGreeting } from './demo-greeting.js';

export const demoGreetingDefinition = compose({
  name: 'demo-greeting',
  element: DemoGreeting,
  template: (el: DemoGreeting) => html\`<p>Hello, \${el.name}\${el.excited ? '!' : '.'}</p>\`,
  styles: css\`
    :host {
      display: block;
    }
  \`,
});

define(demoGreetingDefinition);`,
          },
        },
      ],
    },
    {
      id: 'reactivity',
      title: 'Reactivity and ownership',
      blocks: [
        {
          p: [
            'Reading a property or a signal’s ',
            { code: '.value' },
            ' while rendering tracks it, so the element renders again when it changes. Work started in ',
            { code: 'connected(scope)' },
            ' belongs to that scope and stops when the element disconnects. ',
            { link: 'Core concepts', href: '/core' },
            ' explains both.',
          ],
        },
      ],
    },
  ],
};

export const startApp: Page = {
  path: 'getting-started/app',
  group: 'Start here',
  parent: 'getting-started',
  eyebrow: 'Getting started',
  title: 'A full Oddkin application',
  summary:
    'An application root that owns its services, a store provided as context, a router, and requests that cancel themselves.',
  sections: [
    {
      id: 'root',
      title: 'An application root',
      blocks: [
        {
          p: [
            { code: 'createApp()' },
            ' runs your setup with a scope: everything registered there is disposed by ',
            { code: 'stop()' },
            '. Values provided as context reach the elements below the root.',
          ],
        },
        {
          code: {
            lang: 'js',
            verify: 'module',
            code: `import { createApp } from '@oddkin/app/app';
import { createContext } from '@oddkin/state/context';
import { createStore } from '@oddkin/state/store';

export const cartContext = createContext('cart');

const shop = createApp({
  name: 'shop',
  root: document.querySelector('#shop'),
  setup({ scope, provide }) {
    const cart = createStore({ items: [] });
    scope.add(() => cart.dispose());
    provide(cartContext, cart);
    return { cart };
  },
});

shop.start();`,
          },
        },
      ],
    },
    {
      id: 'services',
      title: 'Routes, resources, and commands',
      blocks: [
        {
          list: [
            [
              { code: '@oddkin/app/router' },
              ': nested routes, each level owning a scope while it matches; links stay native ',
              { code: '<a href>' },
              '.',
            ],
            [
              { code: '@oddkin/app/resource' },
              ': a request follows its source, aborts when superseded or disconnected, and never renders a stale response.',
            ],
            [
              { code: '@oddkin/app/command' },
              ': changes that run when asked, with explicit cancellation and retry.',
            ],
            [
              { code: '@oddkin/app/lifecycle' },
              ': page suspension and restoration from the back/forward cache.',
            ],
          ],
        },
        {
          p: ['Components never need these packages: add them when your application does.'],
        },
      ],
    },
  ],
};

export const startWorkbench: Page = {
  path: 'getting-started/workbench',
  group: 'Start here',
  parent: 'getting-started',
  eyebrow: 'Getting started',
  title: 'Document your library with Workbench',
  summary:
    'Generate component pages, API tables, and live previews for any custom-element library, from its Custom Elements Manifest.',
  sections: [
    {
      id: 'analyze',
      title: 'Analyze the library',
      blocks: [
        {
          p: [
            'The analyzer reads your TypeScript sources without running them and writes ',
            { code: 'custom-elements.json' },
            ' and the richer ',
            { code: 'oddkin.metadata.json' },
            '. Anything it cannot read statically is reported with its location, never guessed.',
          ],
        },
        { code: { lang: 'sh', verify: 'none', code: 'npx oddkin analyze tsconfig.json' } },
      ],
    },
    {
      id: 'serve',
      title: 'Serve the Workbench',
      blocks: [
        {
          code: {
            lang: 'sh',
            verify: 'none',
            code: 'npx oddkin workbench dev --config oddkin.config.ts',
          },
        },
        {
          p: [
            'Each component page combines the API, examples, and an isolated preview. A library that publishes only a standard Custom Elements Manifest gets the same pages, with the enrichment it does not supply labelled as missing.',
          ],
        },
      ],
    },
    {
      id: 'examples',
      title: 'Add examples',
      blocks: [
        {
          p: [
            'Colocated ',
            { code: '*.examples.ts' },
            ' files declare named examples, typed from the element’s own properties; the Workbench shows them and tests can mount them.',
          ],
        },
        {
          code: {
            lang: 'ts',
            verify: 'none',
            code: `import { defineExamples } from '@oddkin/workbench/examples';

export default defineExamples('demo-greeting', {
  default: { label: 'Default', props: { name: 'Ada' } },
  excited: { label: 'Excited', props: { name: 'Ada', excited: true } },
});`,
          },
        },
      ],
    },
  ],
};
