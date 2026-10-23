import type { ExampleSet } from '@oddkin/workbench/examples';

// Every component's examples, found by file name, so catalog-wide tests cover a new component
// without edits. Node-safe: example modules import element types only.
const modules = import.meta.glob<{ default: ExampleSet }>('../src/*/*.examples.ts', {
  eager: true,
});

export const exampleSets: Readonly<Record<string, ExampleSet>> = Object.fromEntries(
  Object.values(modules)
    .map(({ default: set }) => [set.component, set] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);
