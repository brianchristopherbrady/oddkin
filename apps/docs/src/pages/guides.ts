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
        {
          p: [
            'This site publishes the same kits for the version it documents: its ',
            { link: 'llms.txt', href: '/llms.txt' },
            ' lists each package’s guide and references, one link per component, with the files under ',
            { code: '/agent/' },
            '.',
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

const project = repository.replace(/\/blob\/main\/$/, '');

/**
 * Change impact (IMPLEMENTATION_PLAN.md CF.2): the recorded run in docs/impact-demo, generated from
 * its report, and the evidence the site's claims rest on.
 */
export const changeImpact: Page = {
  path: 'change-impact',
  group: 'Explore',
  eyebrow: 'Tools',
  title: 'Change impact',
  summary:
    'What a change to a component library breaks, which components it reaches and by what path, and which examples check it, from the files two builds publish.',
  sections: [
    {
      id: 'how',
      title: 'How it works',
      blocks: [
        {
          p: [
            { code: 'oddkin-impact' },
            ' (in ',
            { code: '@oddkin/analyzer' },
            ') takes a snapshot of each revision’s built packages: the Custom Elements Manifest, ',
            { code: 'oddkin.metadata.json' },
            ', the package exports, and a hash of each module they name. It reads these files and runs none of the code. Each change between two snapshots is classified:',
          ],
        },
        {
          list: [
            [
              { strong: 'Incompatible' },
              ': a removed component, property, attribute, event, method, slot, part, CSS property, custom state, registration, export, or token; a token whose type or unit changed; a property whose values narrowed.',
            ],
            [
              { strong: 'Review' },
              ': any other change to a contract, such as a token value, a template, a style, or a widened type. A person decides.',
            ],
            [{ strong: 'Informational' }, ': an addition, or a change to descriptions only.'],
          ],
        },
        {
          p: [
            'From each change it follows the dependencies (a style that reads a token, a definition that uses a style, a component built with another) to the components it affects. Their examples are the checks it selects, each with the path that selected it. A check passes only when every run of it passed; a check that did not run is never shown as passing.',
          ],
        },
        {
          code: {
            lang: 'sh',
            verify: 'none',
            code: `# A snapshot of each revision's built package directories
npx oddkin-impact snapshot <package-dir>... --out base.json
npx oddkin-impact snapshot <package-dir>... --out head.json
# The changes, the affected components, and the selected checks
npx oddkin-impact compare base.json head.json --markdown report.md --json report.json`,
          },
        },
        {
          p: [
            { code: '--theme' },
            ' and ',
            { code: '--inspection' },
            ' add a theme’s tokens to a snapshot. ',
            { code: '--results' },
            ' merges the results of the checks you ran, and ',
            { code: 'compare' },
            ' then exits with 1 when one failed. Everything runs locally: there is no hosted service, and nothing is published.',
          ],
        },
      ],
    },
    {
      id: 'sample',
      title: 'A recorded change',
      blocks: [
        {
          p: [
            'In this repository, ',
            { code: 'scripts/impact-demo.mjs' },
            ' makes a real change and reports on it. In a temporary worktree it commits two edits on a base commit (the menu’s ',
            { code: 'item' },
            ' part becomes ',
            { code: 'menuitem' },
            ', and the default theme’s specimen surface gets lighter), builds both revisions with their own build steps, compares them, and runs the selected checks on the head’s build in three browsers. This page is generated from the run recorded in ',
            { link: 'docs/impact-demo', href: `${project}/tree/main/docs/impact-demo` },
            '.',
          ],
        },
        { fact: 'impact-commits' },
        { fact: 'impact-summary' },
      ],
    },
    {
      id: 'changes',
      title: 'What changed',
      blocks: [
        {
          p: [
            'Renaming the part breaks a consumer’s ',
            { code: 'odd-menu::part(item)' },
            ' rule, and no test notices. Items are matched by id, so without a migration record a rename is a removal and an addition: the report notes the likely rename, as the two parts have the same contract, and still counts the removal.',
          ],
        },
        { fact: 'impact-changes' },
      ],
    },
    {
      id: 'affected',
      title: 'What it affects',
      blocks: [
        { p: ['Each path runs from a changed item to the component it reaches.'] },
        { fact: 'impact-affected' },
      ],
    },
    {
      id: 'checks',
      title: 'What checks it',
      blocks: [
        {
          p: [
            'The examples of the affected components, run on the head’s build. ',
            { link: 'The report', href: `${repository}docs/impact-demo/report.md` },
            ' lists each check with its path.',
          ],
        },
        { fact: 'impact-checks' },
      ],
    },
    {
      id: 'agent-context',
      title: 'What agents read',
      blocks: [
        {
          p: [
            'The agent kits of both revisions, packaged with the same ',
            { code: 'oddkin-kit' },
            ', differ where the change does, so an agent that reads the head’s kit finds the new part and the new value. Each ',
            { code: 'kit.json' },
            ' holds a fingerprint of the kit’s inputs (',
            { code: 'inputs' },
            ') and the hash of the metadata it was written from (',
            { code: 'sha256' },
            '), so a kit that no longer matches its package is detectable.',
          ],
        },
        { fact: 'impact-kit' },
      ],
    },
    {
      id: 'reproduce',
      title: 'Reproduce it',
      blocks: [
        { p: ['In a checkout of the repository:'] },
        { fact: 'impact-reproduce' },
        {
          p: [
            'The files go to ',
            { code: '.oddkin/impact/demo' },
            '; ',
            { code: '--record <dir>' },
            ' copies the ones recorded here. The script exits with 1 when a selected check fails.',
          ],
        },
      ],
    },
    {
      id: 'evidence',
      title: 'The evidence',
      blocks: [
        { p: ['What the site’s claims rest on, where each is kept:'] },
        {
          cards: [
            {
              title: 'CI in three browsers',
              text: 'Each push to main and each pull request: lint, type checks, the build, the unit tests, the browser and end-to-end tests in Chromium, Firefox, and WebKit, the packed packages, and a change-impact report against its base in the job summary.',
              href: `${project}/actions/workflows/ci.yml`,
              action: 'View the CI runs',
              meta: '.github/workflows/ci.yml',
            },
            {
              title: 'Fresh installs',
              text: 'New Vite, React, Vue, Svelte, and Angular projects install the packed packages and their own build tools, type-check when they use TypeScript, and are tested from their production builds. Each week, the same tests install the published packages from npm.',
              href: `${repository}e2e/fresh-consumers.spec.ts`,
              action: 'View the fresh-install tests',
              meta: 'e2e/fresh-consumers.spec.ts',
            },
            {
              title: 'Change-impact analysis',
              text: 'How snapshots, classifications, dependency paths, and check states work, and what is not built yet.',
              href: `${repository}docs/architecture/change-impact-and-verification.md`,
              action: 'Read the change-impact analysis',
              meta: 'docs/architecture',
            },
            {
              title: 'Architecture decisions',
              text: 'Every decision record, with its area and status, as the records give them.',
              href: '/architecture#decisions',
              action: 'View the decision records',
              meta: 'docs/architecture/decisions',
            },
            {
              title: 'The recorded run',
              text: 'The patch, the report in Markdown and JSON, and the kit diff this page is generated from.',
              href: `${project}/tree/main/docs/impact-demo`,
              action: 'View the recorded files',
              meta: 'docs/impact-demo',
            },
          ],
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
              'The snapshot and report formats are not frozen: they can change in a minor release (',
              {
                link: 'ADR 0047',
                href: `${repository}docs/architecture/decisions/0047-m8-checkpoint-candidate-v1-contracts.md`,
              },
              ').',
            ],
            [
              'A path is only as complete as its inputs. A module whose source was not supplied, a package that was not read, or a dynamic definition is listed as a coverage gap, and widens the selection to every example of its package.',
            ],
            ['Visual differences and component-family mappings are not compared yet.'],
            [
              'A library described only by a standard Custom Elements Manifest gets its changes and affected components; it gets checks where it publishes examples (',
              {
                link: 'libraries not built with Oddkin',
                href: `${repository}docs/architecture/libraries-without-oddkin.md`,
              },
              ').',
            ],
          ],
        },
      ],
    },
  ],
};
