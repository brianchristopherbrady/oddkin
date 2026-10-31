import { repository, type Page } from './model.js';

export const frameworks: Page = {
  path: 'installation/frameworks',
  group: 'Start here',
  parent: 'installation',
  eyebrow: 'Installation',
  title: 'Framework guides',
  summary:
    'The elements are standard custom elements: frameworks render them like any HTML element. Opt-in typings check properties and events in React, Vue, and Svelte templates.',
  sections: [
    {
      id: 'versions',
      title: 'Verified versions',
      blocks: [
        { fact: 'framework-versions' },
        {
          p: [
            'The React, Vue, and Svelte typings are checked by compile-time fixtures in ',
            { code: 'tests/frameworks' },
            ' as part of ',
            { code: 'npm run typecheck' },
            ': each fixture uses real elements and lists the mistakes its checker must reject.',
          ],
        },
      ],
    },
    {
      id: 'react',
      title: 'React',
      blocks: [
        {
          p: [
            'React 19 sets properties on custom elements and listens to their events through ',
            { code: 'on' },
            ' plus the event name. Import the typings once to type every registered element:',
          ],
        },
        {
          code: {
            lang: 'ts',
            verify: 'none',
            code: `import type {} from '@oddkin/components/frameworks/react';
import '@oddkin/components/define/side-nav';

export function Shell({ items }) {
  return (
    <odd-side-nav
      label="Primary"
      items={items}
      current="overview"
      onodd-action={(event) => run(event.detail.action)}
    />
  );
}`,
          },
        },
      ],
    },
    {
      id: 'vue',
      title: 'Vue',
      blocks: [
        {
          p: [
            'Tell Vue’s compiler that ',
            { code: 'odd-*' },
            ' tags are custom elements (',
            { code: 'compilerOptions.isCustomElement' },
            '), then bind properties with ',
            { code: ':' },
            ' and events with ',
            { code: '@' },
            '. ',
            { code: 'v-model' },
            ' works on the form controls.',
          ],
        },
        {
          code: {
            lang: 'html',
            verify: 'none',
            code: `<script setup lang="ts">
import type {} from '@oddkin/components/frameworks/vue';
import '@oddkin/components/define/input';
import { ref } from 'vue';

const name = ref('Ada');
</script>

<template>
  <odd-input v-model="name" label="Name" name="name" required />
</template>`,
          },
        },
      ],
    },
    {
      id: 'svelte',
      title: 'Svelte',
      blocks: [
        {
          p: [
            'Svelte 5 sets properties when the element has them; event attributes use ',
            { code: 'on' },
            ' plus the event name.',
          ],
        },
        {
          code: {
            lang: 'html',
            verify: 'none',
            code: `<script lang="ts">
  import type {} from '@oddkin/components/frameworks/svelte';
  import '@oddkin/components/define/input';
  let name = $state('Ada');
</script>

<odd-input
  label="Name"
  name="name"
  value={name}
  oninput={(event) => (name = event.currentTarget.value)}
></odd-input>`,
          },
        },
      ],
    },
    {
      id: 'angular',
      title: 'Angular',
      blocks: [
        {
          p: [
            'Add ',
            { code: 'CUSTOM_ELEMENTS_SCHEMA' },
            ' to the component that renders ',
            { code: 'odd-*' },
            ' tags, bind properties with ',
            { code: '[property]' },
            ' and events with ',
            { code: '(odd-action)' },
            '. Angular has no typings fixture yet, so its templates are not type-checked against the elements.',
          ],
        },
      ],
    },
    {
      id: 'interop',
      title: 'External stores',
      blocks: [
        {
          p: [
            'A store with ',
            { code: 'getSnapshot()' },
            ' and ',
            { code: 'subscribe()' },
            ' (React’s ',
            { code: 'useSyncExternalStore' },
            ' shape, Redux, Zustand) is read with ',
            { code: 'fromExternal()' },
            ' from ',
            { code: '@oddkin/core/reactive' },
            ', and any Oddkin signal is exposed the same way with ',
            { code: 'toExternal()' },
            '. See ',
            {
              link: 'core-contracts.md §5',
              href: `${repository}docs/architecture/core-contracts.md`,
            },
            '.',
          ],
        },
      ],
    },
  ],
};

export const browserSupport: Page = {
  path: 'support/browsers',
  group: 'Project',
  parent: 'support',
  eyebrow: 'Help and releases',
  title: 'Browser support',
  summary:
    'The supported browsers and every platform feature Oddkin uses, with how it is adopted and what happens below its baseline. Generated from the compatibility registry.',
  sections: [
    { id: 'floor', title: 'Supported browsers', blocks: [{ fact: 'browser-floor' }] },
    {
      id: 'features',
      title: 'Platform features',
      blocks: [
        { fact: 'browser-features' },
        {
          p: [
            'The full matrix, with the browser data versions it was computed from, is ',
            {
              link: 'docs/compatibility/matrix.md',
              href: `${repository}docs/compatibility/matrix.md`,
            },
            '.',
          ],
        },
      ],
    },
  ],
};

export const agents: Page = {
  path: 'tooling',
  group: 'Explore',
  eyebrow: 'Tools',
  title: 'Agent tooling',
  summary:
    'Each installed package carries an agent kit generated from its own metadata, so an agent reads the API of the version you installed.',
  sections: [
    {
      id: 'kits',
      title: 'The packaged kits',
      blocks: [
        {
          list: [
            [
              { code: 'node_modules/@oddkin/components/agent/GUIDE.md' },
              ' and ',
              { code: 'node_modules/@oddkin/ai/agent/GUIDE.md' },
              ': a short entry guide (within an 8 KiB budget) linking one reference per element under ',
              { code: 'references/' },
              '.',
            ],
            [
              { code: 'agent/llms.txt' },
              ': the same index in the ',
              { link: 'llms.txt', href: 'https://llmstxt.org/' },
              ' format.',
            ],
            [
              { code: 'agent/kit.json' },
              ': the manifest, with a fingerprint of every input, so a stale kit is detectable.',
            ],
          ],
        },
        {
          p: [
            'Point your agent’s instructions (an ',
            { code: 'AGENTS.md' },
            ' line, for example) at the guide of each package you use. Publishing a file does not make every assistant read it.',
          ],
        },
      ],
    },
    {
      id: 'metadata',
      title: 'What the kits are generated from',
      blocks: [
        {
          p: [
            { code: 'custom-elements.json' },
            ' (the standard Custom Elements Manifest) and ',
            { code: 'oddkin.metadata.json' },
            ': when to use each element and when not, accessibility and keyboard notes, customization levels, style mappings to tokens, and examples. Both are package exports, so tools can read them directly.',
          ],
        },
      ],
    },
    {
      id: 'your-library',
      title: 'A kit for your own library',
      blocks: [
        {
          p: [
            { code: 'oddkin-kit' },
            ' (in ',
            { code: '@oddkin/analyzer' },
            ') writes the same kit for your library from the metadata the analyzer publishes, checks it, and keeps a managed section of ',
            { code: 'AGENTS.md' },
            ' that points agents at the kits. Run it in the workspace root:',
          ],
        },
        {
          code: {
            lang: 'sh',
            verify: 'none',
            code: `# The kit your package ships, in <package>/agent/ (list "agent" in the package's "files")
npx oddkin-kit package
# Check it against the package's metadata; --package <name> checks an installed package's kit
npx oddkin-kit package --check
# The managed section of AGENTS.md; text outside its markers is kept
npx oddkin-kit agents-md --write`,
          },
        },
        {
          p: [
            'A stale, missing, or over-budget kit, or a stale ',
            { code: 'AGENTS.md' },
            ' section, exits with 1, so CI can run the checks. A kit a package ships depends only on what the package publishes, so a project that installs it regenerates the same files.',
          ],
        },
      ],
    },
    {
      id: 'composition',
      title: 'Interfaces as data',
      blocks: [
        {
          p: [
            'An agent that produces structured output can describe an interface as a composition document. ',
            { code: 'validateComposition()' },
            ' checks it against JSON Schemas generated from the metadata, and ',
            { code: 'renderComposition()' },
            ' renders only published elements, attributes, and properties: no scripts, no HTML strings, no ',
            { code: 'on*' },
            ' attributes.',
          ],
        },
        {
          code: {
            lang: 'js',
            verify: 'module',
            code: `import { validateComposition } from '@oddkin/components/composition';

const result = validateComposition({
  version: 1,
  root: [{ element: 'odd-button', attributes: { appearance: 'primary' }, children: ['Save'] }],
});
if (!result.ok) console.table(result.diagnostics);`,
          },
        },
      ],
    },
    {
      id: 'limits',
      title: 'Limits',
      blocks: [
        {
          list: [
            [
              'There is no Oddkin MCP server or agent package yet; the kits and the metadata are the interface.',
            ],
            [
              'A packaged kit describes the version installed; for your own components, write a kit with ',
              { code: 'oddkin-kit' },
              '.',
            ],
          ],
        },
      ],
    },
  ],
};
