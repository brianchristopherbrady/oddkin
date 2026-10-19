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
  forbid(entry, size, TOOLING);
  if (entry === 'counter' || entry === 'component')
    forbid(entry, size, [...FEATURES, 'packages/core/dist/prod/controllers/']);
  if (entry === 'list')
    forbid(
      entry,
      size,
      ['layout/', 'model/', 'controllers/'].map((f) => `packages/core/dist/prod/${f}`),
    );
  if (entry === 'side-nav') forbid(entry, size, FEATURES);
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
