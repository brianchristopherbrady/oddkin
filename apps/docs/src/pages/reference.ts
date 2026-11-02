import { repository, type Page } from './model.js';

export const install: Page = {
  path: 'installation',
  group: 'Start here',
  eyebrow: 'Start here',
  title: 'Installation',
  summary:
    'Install from npm, or load the packages as native ES modules through an import map. Types ship with every package.',
  sections: [
    {
      id: 'npm',
      title: 'npm',
      blocks: [
        { p: ['Install the packages you use; each one brings only its own dependencies.'] },
        { fact: 'packages' },
        {
          code: {
            lang: 'sh',
            verify: 'none',
            code: 'npm install @oddkin/tokens@beta @oddkin/core@beta @oddkin/components@beta',
          },
        },
        {
          note: [
            'The packages are in beta: the ',
            { code: '@beta' },
            ' tag installs the current beta, and contracts may still change before 1.0.0.',
          ],
        },
      ],
    },
    {
      id: 'bundler',
      title: 'With a bundler',
      blocks: [
        {
          p: [
            'For an app built with Vite or another bundler, start from the bundler’s own template, then install the packages. With Vite and TypeScript:',
          ],
        },
        {
          code: {
            lang: 'sh',
            verify: 'none',
            code: `npm create vite@latest my-app -- --template vanilla-ts
cd my-app
npm install @oddkin/tokens@beta @oddkin/core@beta @oddkin/components@beta`,
          },
        },
        {
          p: [
            'Import the theme stylesheet and the elements you use from the entry module (',
            { code: 'src/main.ts' },
            ' in that template). The bundler resolves both, so there is no import map or ',
            { code: 'node_modules' },
            ' link to write.',
          ],
        },
        {
          code: {
            lang: 'js',
            verify: 'module',
            code: `import '@oddkin/tokens/css/default.css';
import '@oddkin/components/define/button';`,
          },
        },
        {
          p: [
            'Then write the elements in the page’s HTML, as ',
            { link: 'Components in any app', href: '/getting-started/components' },
            ' shows.',
          ],
        },
      ],
    },
    {
      id: 'esm',
      title: 'Native ES modules and import maps',
      blocks: [
        {
          p: [
            'Every entry is a standard ES module with bare imports, so a page can load the packages without a bundler. An import map lists one URL per exported entry: entries map to different files (',
            { code: '@oddkin/components/define/button' },
            ' is ',
            { code: 'dist/button/button.define.js' },
            '), so a prefix mapping is not enough.',
          ],
        },
        {
          code: {
            lang: 'html',
            verify: 'markup',
            code: `<script type="importmap">
  {
    "imports": {
      "@oddkin/core/element": "/node_modules/@oddkin/core/dist/prod/element/index.js",
      "@oddkin/core/reactive": "/node_modules/@oddkin/core/dist/prod/reactive/index.js",
      "@oddkin/core/styles": "/node_modules/@oddkin/core/dist/prod/styles/index.js",
      "@oddkin/core/template": "/node_modules/@oddkin/core/dist/prod/template/index.js",
      "@oddkin/tokens/refs": "/node_modules/@oddkin/tokens/dist/refs/index.js",
      "@oddkin/components/define/button": "/node_modules/@oddkin/components/dist/button/button.define.js"
    }
  }
</script>
<script type="module">
  import '@oddkin/components/define/button';
</script>`,
          },
        },
        {
          p: [
            'These are the six entries ',
            { code: 'odd-button' },
            ' loads. Other elements import further entries: list each one the browser reports as unresolved, or generate the map from the packages’ ',
            { code: 'exports' },
            ' with ',
            { code: 'createImportMap()' },
            ' from ',
            { code: '@oddkin/workbench/data' },
            '. The links point into ',
            { code: 'node_modules' },
            ', so serve the page from the project’s root with any static file server. ',
            { code: 'examples/components-only' },
            ' in the repository is a complete page with its map and a strict Content Security Policy.',
          ],
        },
        {
          p: [
            'Packages that carry development diagnostics publish two builds: the ',
            { code: 'development' },
            ' export condition names ',
            { code: 'dist/' },
            ' (with the diagnostics) and ',
            { code: 'default' },
            ' names ',
            { code: 'dist/prod/' },
            '. Bundlers pick the condition for you; a hand-written map chooses one.',
          ],
        },
      ],
    },
    {
      id: 'typescript',
      title: 'TypeScript and plain JavaScript',
      blocks: [
        {
          p: [
            'Every package ships declaration files, and each element registers its tag in ',
            { code: 'HTMLElementTagNameMap' },
            ', so ',
            { code: "document.querySelector('odd-button')" },
            ' is typed. Plain JavaScript uses the same entries.',
          ],
        },
        {
          code: {
            lang: 'ts',
            verify: 'module',
            code: `import '@oddkin/components/define/button';

const button = document.querySelector('odd-button');
if (button) button.disabled = true;`,
          },
        },
      ],
    },
    {
      id: 'browsers',
      title: 'Supported browsers',
      blocks: [
        { fact: 'browser-floor' },
        {
          p: [
            { link: 'Browser support', href: '/support/browsers' },
            ' lists what each platform feature needs and how it falls back.',
          ],
        },
      ],
    },
  ],
};

export const concepts: Page = {
  path: 'core',
  group: 'Build',
  label: 'Core and state',
  eyebrow: 'Core and state',
  title: 'Core concepts',
  summary:
    'Signals hold state, templates bind to it, and a scope owns every piece of work an element starts. The full contracts are in core-contracts.md.',
  sections: [
    {
      id: 'signals',
      title: 'Signals',
      blocks: [
        {
          p: [
            'A signal holds a value; ',
            { code: 'computed()' },
            ' derives one. Reads and writes are synchronous, and ',
            { code: 'batch()' },
            ' groups writes so observers see one change.',
          ],
        },
        {
          code: {
            lang: 'ts',
            verify: 'module',
            code: `import { batch, computed, signal } from '@oddkin/core/reactive';

const quantity = signal(1);
const price = signal(12);
const total = computed(() => quantity.value * price.value);

batch(() => {
  quantity.value = 2;
  price.value = 15;
});
console.log(total.value); // 30`,
          },
        },
      ],
    },
    {
      id: 'binding-rule',
      title: 'The binding rule',
      blocks: [
        {
          list: [
            [
              { strong: 'Render-tracked reads.' },
              ' Reading ',
              { code: '.value' },
              ' while ',
              { code: 'render()' },
              ' runs makes it a dependency: a change renders again.',
            ],
            [
              { strong: 'Direct readable bindings.' },
              ' Passing the signal itself, ',
              { code: '${this.count}' },
              ', binds that one part: a change updates it without running ',
              { code: 'render()' },
              '.',
            ],
            [
              { strong: 'Untracked snapshots.' },
              ' Event handlers and asynchronous callbacks run later, outside the render: a ',
              { code: '.value' },
              ' read there is a snapshot and subscribes to nothing.',
            ],
          ],
        },
        {
          code: {
            lang: 'ts',
            verify: 'module',
            code: `import { OddkinElement, define, html, signal } from '@oddkin/core';

class DemoCounter extends OddkinElement {
  private count = signal(0);
  private increment = () => this.count.update((value) => value + 1);

  override render() {
    // The text binding follows count; incrementing does not re-run render().
    return html\`<button type="button" @click=\${this.increment}>Count: \${this.count}</button>\`;
  }
}

define('demo-counter', DemoCounter);`,
          },
        },
        {
          p: [
            'The settled wording, with what a template does with each kind of value, is the binding rule in ',
            {
              link: 'core-contracts.md §1',
              href: `${repository}docs/architecture/core-contracts.md`,
            },
            ' and its binding-value matrix (§6.1).',
          ],
        },
      ],
    },
    {
      id: 'scope',
      title: 'Ownership with Scope',
      blocks: [
        {
          p: [
            'Each connection gives the element a ',
            { code: 'Scope' },
            '. Listeners, timers, effects, requests, and controllers registered on it end when the element disconnects, and start again from ',
            { code: 'connected(scope)' },
            ' when it reconnects. There is no separate cleanup method to forget.',
          ],
        },
      ],
    },
  ],
};
