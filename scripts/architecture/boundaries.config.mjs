// Package boundary rules. Source of truth: docs/architecture/packages.md.
// `kind`: 'browser' packages ship browser code and may not depend on third-party
// runtime packages, Node built-ins, or Node-only Mote packages. 'node' packages
// are development tooling. 'mixed' packages have browser entries plus explicit
// Node entries (`nodeEntries`, `nodeSources`).
// `domFree`: export subpaths that must import in Node without DOM globals.
// Entries listed here but not yet present in `exports` are skipped until created.

/** @type {import('./check-boundaries.mjs').BoundaryConfig} */
export default {
  packages: {
    '@mote/core': {
      kind: 'browser',
      allow: [],
      domFree: [
        './reactive',
        './scope',
        './layout',
        './layout/inspect',
        './collections',
        './model',
        './model/schema',
        './diagnostics',
      ],
    },
    '@mote/tokens': {
      kind: 'mixed',
      allow: [],
      domFree: ['.', './theme', './generate', './refs', './values', './conditions'],
      nodeEntries: ['./node'],
      nodeSources: ['src/node/'],
    },
    '@mote/state': { kind: 'browser', allow: ['@mote/core'], domFree: ['./store'] },
    '@mote/app': {
      kind: 'mixed',
      allow: ['@mote/core', '@mote/state'],
      domFree: [],
      nodeEntries: ['./node'],
      nodeSources: ['src/node/'],
    },
    '@mote/components': { kind: 'browser', allow: ['@mote/core', '@mote/tokens'], domFree: [] },
    '@mote/analyzer': { kind: 'node', allow: ['@mote/tokens', '@mote/core'] },
    '@mote/workbench': {
      kind: 'mixed',
      allow: [
        '@mote/core',
        '@mote/tokens',
        '@mote/components',
        '@mote/state',
        '@mote/app',
        '@mote/analyzer',
      ],
      domFree: ['./examples', './config', './pages', './content'],
      nodeEntries: ['./node'],
      nodeSources: ['src/node/'],
      // Only Node entries and sources may reach these internal dependencies.
      nodeOnlyDependencies: ['@mote/analyzer'],
    },
    '@mote/agent': { kind: 'node', allow: ['@mote/analyzer', '@mote/tokens'] },
    '@mote/docs': {
      kind: 'browser',
      allow: [
        '@mote/core',
        '@mote/state',
        '@mote/app',
        '@mote/tokens',
        '@mote/components',
        '@mote/workbench',
      ],
      domFree: [],
    },
  },
};
