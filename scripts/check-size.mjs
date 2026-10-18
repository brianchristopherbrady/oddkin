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
for (const [entry, size] of Object.entries(sizes)) {
  failed = !report(entry, size.gzip, BUDGETS[entry]) || failed;
  if (entry === 'counter' || entry === 'component' || entry === 'list') {
    for (const forbidden of ['packages/state', 'packages/app', 'packages/tokens']) {
      if (size.modules.some((m) => m.startsWith(forbidden))) {
        console.log(`FAIL ${entry} pulls in ${forbidden}`);
        failed = true;
      }
    }
  }
}
for (const [entry, size] of Object.entries(await measureCssSizes()))
  failed = !report(entry, size, CSS_BUDGETS[entry]) || failed;
if (failed) process.exit(1);
