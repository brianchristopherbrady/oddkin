// Fails when a production bundle or shipped stylesheet exceeds its gzip budget (ADR 0019,
// css-architecture.md §12). Run after `npm run build`.
import {
  BUDGETS,
  CSS_BUDGETS,
  measureCssSizes,
  measureSizes,
} from '../research/benchmarks/size/measure.mjs';

const report = (entry, size, budget) => {
  const ok = size <= budget;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${entry.padEnd(20)} ${String(size).padStart(6)} B gzip (budget ${budget}, ${((size / budget) * 100).toFixed(1)}%)`,
  );
  return ok;
};

const sizes = await measureSizes();
let failed = false;
const forbid = (entry, size, list) => {
  for (const forbidden of list) {
    if (size.modules.some((m) => m.includes(forbidden))) {
      console.log(`FAIL ${entry} pulls in ${forbidden}`);
      failed = true;
    }
  }
};
// Optional core features and tooling stay out of every graph that does not import them
// (IMPLEMENTATION_PLAN §3): no schema emitters, recipe inspection, analyzer, or Workbench.
const TOOLING = [
  'packages/core/dist/prod/model/schema',
  'packages/core/dist/prod/layout/inspect',
  'packages/analyzer',
  'packages/workbench',
  'node_modules/typescript',
  // Framework fixtures are test-only dev dependencies.
  'node_modules/react',
  'node_modules/vue',
  'node_modules/@vue',
  'node_modules/@angular',
  'node_modules/svelte',
];
// Feature entries a minimal counter, a typical component, or a registered side navigation do not
// import, so their bytes never reach those graphs.
const FEATURES = ['layout', 'collections', 'model', 'helpers', 'i18n'].map(
  (feature) => `packages/core/dist/prod/${feature}/`,
);
for (const [entry, size] of Object.entries(sizes)) {
  failed = !report(entry, size.gzip, BUDGETS[entry]) || failed;
  // Workbench's own entries contain Workbench, and nothing else from this list.
  forbid(
    entry,
    size,
    entry.startsWith('workbench-') ? TOOLING.filter((t) => t !== 'packages/workbench') : TOOLING,
  );
  if (entry === 'counter' || entry === 'component')
    forbid(entry, size, [...FEATURES, 'packages/core/dist/prod/controllers/']);
  if (entry === 'list')
    forbid(
      entry,
      size,
      ['layout/', 'model/', 'controllers/'].map((f) => `packages/core/dist/prod/${f}`),
    );
  if (entry === 'side-nav') forbid(entry, size, FEATURES);
  // Composition documents (ADR 0046 D3): only an application that renders them loads the entry,
  // and the entry registers no element.
  if (entry === 'composition') forbid(entry, size, ['.define.js']);
  else forbid(entry, size, ['packages/components/dist/composition/']);
  // The DOM-free store loads only the reactive graph and diagnostics: no element, template, or
  // style modules, no Scope, and nothing from @oddkin/app.
  if (entry === 'store')
    forbid(entry, size, [
      ...['element/', 'template/', 'styles/', 'scope/'].map((f) => `packages/core/dist/prod/${f}`),
      'packages/app',
    ]);
  // Context needs no rendering code and no store.
  if (entry === 'context')
    forbid(entry, size, [
      ...['element/', 'template/', 'styles/'].map((f) => `packages/core/dist/prod/${f}`),
      'packages/state/dist/prod/store/',
      'packages/app',
    ]);
  // Persistence is DOM-free like the store it follows: no DOM module, no Scope, no context.
  if (entry === 'persist')
    forbid(entry, size, [
      ...['element/', 'template/', 'styles/', 'scope/'].map((f) => `packages/core/dist/prod/${f}`),
      'packages/state/dist/prod/context/',
      'packages/app',
    ]);
  // An application root needs no rendering code, persistence, or inspection unless it imports them.
  if (entry === 'app')
    forbid(entry, size, [
      ...['element/', 'template/', 'styles/'].map((f) => `packages/core/dist/prod/${f}`),
      'packages/state/dist/prod/persist/',
      'packages/state/dist/prod/inspect/',
    ]);
  // A resource is DOM-free: no rendering code, no state package, no application or router code.
  if (entry === 'resource')
    forbid(entry, size, [
      ...['element/', 'template/', 'styles/'].map((f) => `packages/core/dist/prod/${f}`),
      'packages/state',
      'packages/app/dist/prod/app/',
    ]);
  // A command is DOM-free like a resource, and loads neither resources nor application code.
  if (entry === 'command')
    forbid(entry, size, [
      ...['element/', 'template/', 'styles/'].map((f) => `packages/core/dist/prod/${f}`),
      'packages/state',
      'packages/app/dist/prod/app/',
      'packages/app/dist/prod/resource/',
    ]);
  // A router needs no rendering code, no state package, and no resource or command code.
  if (entry === 'router')
    forbid(entry, size, [
      ...['element/', 'template/', 'styles/'].map((f) => `packages/core/dist/prod/${f}`),
      'packages/state',
      'packages/app/dist/prod/resource/',
      'packages/app/dist/prod/command/',
    ]);
  // Following the page lifecycle loads no rendering code, router, resource, or command code.
  if (entry === 'lifecycle')
    forbid(entry, size, [
      ...['element/', 'template/', 'styles/'].map((f) => `packages/core/dist/prod/${f}`),
      'packages/state/dist/prod/store/',
      'packages/state/dist/prod/persist/',
      'packages/app/dist/prod/router/',
      'packages/app/dist/prod/resource/',
      'packages/app/dist/prod/command/',
    ]);
  if (entry === 'counter' || entry === 'component' || entry === 'list') {
    for (const forbidden of ['packages/state', 'packages/app', 'packages/tokens']) {
      if (size.modules.some((m) => m.startsWith(forbidden))) {
        console.log(`FAIL ${entry} pulls in ${forbidden}`);
        failed = true;
      }
    }
  }
  // AI entries never load frameworks, Oddkin app services, or optional heavy integrations.
  if (entry.startsWith('ai-')) {
    const optional = [
      'packages/ai/dist/prod/highlight',
      'packages/ai/dist/prod/voice/',
      'packages/ai/dist/prod/stream/',
    ];
    const headless =
      entry === 'ai-headless'
        ? [
            'packages/components',
            'packages/core/dist/prod/template',
            'packages/ai/dist/prod/markdown',
          ]
        : [];
    for (const forbidden of [
      'packages/state',
      'packages/app',
      'node_modules/react',
      'node_modules/vue',
      ...optional,
      ...headless,
    ]) {
      if (size.modules.some((m) => m.includes(forbidden))) {
        console.log(`FAIL ${entry} pulls in ${forbidden}`);
        failed = true;
      }
    }
  }
}
for (const [entry, size] of Object.entries(await measureCssSizes()))
  failed = !report(entry, size, CSS_BUDGETS[entry]) || failed;
if (failed) process.exit(1);
