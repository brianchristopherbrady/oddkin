// Fails when a production bundle exceeds its gzip budget (ADR 0019). Run after `npm run build`.
import { BUDGETS, measureSizes } from '../research/benchmarks/size/measure.mjs';

const sizes = await measureSizes();
let failed = false;
for (const [entry, size] of Object.entries(sizes)) {
  const budget = BUDGETS[entry];
  const ok = size.gzip <= budget;
  failed ||= !ok;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${entry.padEnd(10)} ${String(size.gzip).padStart(6)} B gzip (budget ${budget}, ${((size.gzip / budget) * 100).toFixed(1)}%)`,
  );
  if (entry === 'counter' || entry === 'component' || entry === 'list') {
    for (const forbidden of ['packages/state', 'packages/app', 'packages/tokens']) {
      if (size.modules.some((m) => m.startsWith(forbidden))) {
        console.log(`FAIL ${entry} pulls in ${forbidden}`);
        failed = true;
      }
    }
  }
}
if (failed) process.exit(1);
