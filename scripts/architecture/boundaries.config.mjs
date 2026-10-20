// Package boundary rules. Source of truth: docs/architecture/packages.md.
// `kind`: 'browser' packages ship browser code and may not depend on third-party
// runtime packages, Node built-ins, or Node-only Oddkin packages. 'node' packages
// are development tooling. 'mixed' packages have browser entries plus explicit
// Node entries (`nodeEntries`, `nodeSources`).
// `domFree`: export subpaths that must import in Node without DOM globals.
// Entries listed here but not yet present in `exports` are skipped until created.

/** @type {import('./check-boundaries.mjs').BoundaryConfig} */
export default {
  packages: {
    '@oddkin/core': {
      kind: 'browser',
      allow: [],
      // Element, template, and style entries need a DOM to run but must import without one
      // (server rendering, Node tooling); reactive and scope must also run without one.
      domFree: [
        '.',
        './reactive',
        './scope',
        './template',
        './styles',
        './element',
        './helpers/class-map',
        './helpers/style-map',
        './helpers/ref',
        './helpers/live',
        './layout',
        './layout/inspect',
        './collections',
        './model',
        './model/schema',
        './diagnostics',
        './controllers/focus',
        './controllers/announce',
        './controllers/observe',
        './controllers/form',
        './i18n',
      ],
    },
    '@oddkin/tokens': {
      kind: 'mixed',
      allow: [],
      domFree: ['.', './theme', './generate', './refs', './values', './conditions'],
      nodeEntries: ['./node'],
      nodeSources: ['src/node/'],
    },
    '@oddkin/state': {
      kind: 'browser',
      allow: ['@oddkin/core'],
      domFree: ['.', './store', './context', './inspect'],
    },
    '@oddkin/app': {
      kind: 'mixed',
      allow: ['@oddkin/core', '@oddkin/state'],
      domFree: [],
      nodeEntries: ['./node'],
      nodeSources: ['src/node/'],
    },
    '@oddkin/components': {
      kind: 'browser',
      allow: ['@oddkin/core', '@oddkin/tokens'],
      domFree: ['./layout'],
      // Colocated examples (ADR 0021) are type-checked and tested but excluded from the build.
      devSources: { suffix: '.examples', allow: ['@oddkin/workbench'] },
      // Opt-in framework typings: React, Vue, and Svelte types only, from types-only entries.
      typeOnly: {
        sources: 'src/frameworks/',
        entries: ['./frameworks/react', './frameworks/vue', './frameworks/svelte'],
        allow: ['react', 'vue', 'svelte'],
      },
    },
    // Optional AI interaction package (ADR 0040). Nothing general-purpose may depend on it.
    '@oddkin/ai': {
      kind: 'browser',
      allow: ['@oddkin/core', '@oddkin/tokens', '@oddkin/components'],
      // Colocated examples (ADR 0021) are type-checked and tested but excluded from the build.
      devSources: { suffix: '.examples', allow: ['@oddkin/workbench'] },
      domFree: [
        '.',
        './contracts',
        './controllers',
        './events',
        './stream',
        './markdown',
        './highlight',
      ],
    },
    '@oddkin/analyzer': { kind: 'node', allow: ['@oddkin/tokens', '@oddkin/core'] },
    '@oddkin/workbench': {
      kind: 'mixed',
      allow: [
        '@oddkin/core',
        '@oddkin/tokens',
        '@oddkin/components',
        '@oddkin/state',
        '@oddkin/app',
        '@oddkin/analyzer',
      ],
      domFree: [
        './examples',
        './config',
        './pages',
        './content',
        './conformance',
        './conformance/button',
      ],
      nodeEntries: ['./node'],
      nodeSources: ['src/node/'],
      // Only Node entries and sources may reach these internal dependencies.
      nodeOnlyDependencies: ['@oddkin/analyzer'],
    },
    '@oddkin/agent': { kind: 'node', allow: ['@oddkin/analyzer', '@oddkin/tokens'] },
    '@oddkin/docs': {
      kind: 'browser',
      allow: [
        '@oddkin/core',
        '@oddkin/state',
        '@oddkin/app',
        '@oddkin/tokens',
        '@oddkin/components',
        '@oddkin/workbench',
      ],
      domFree: [],
    },
  },
};
