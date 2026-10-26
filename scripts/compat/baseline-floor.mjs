// The browser versions a "Baseline <year>" floor implies: for every web-features feature newly available
// by the cut-off date, the highest version each browser needed. Reads the pinned web-features data.
//   node scripts/compat/baseline-floor.mjs [2024-12-31]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dataPath = require.resolve('web-features/data.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const { version } = JSON.parse(readFileSync(join(dirname(dataPath), 'package.json'), 'utf8'));
const features = data.features ?? data;
const cutoff = process.argv[2] ?? '2024-12-31';
if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff))
  throw new Error(`Cut-off date as YYYY-MM-DD, got ${cutoff}`);

const parts = (v) => String(v).replace('≤', '').split('.').map(Number);
const newer = (a, b) => {
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
};

const floor = {};
let count = 0;
for (const [id, feature] of Object.entries(features)) {
  const low = feature.status?.baseline_low_date?.replace('≤', '');
  if (!low || low > cutoff) continue;
  count++;
  for (const [browser, v] of Object.entries(feature.status.support ?? {})) {
    if (!floor[browser] || newer(v, floor[browser].version))
      floor[browser] = { version: v, feature: id };
  }
}
console.log(`web-features ${version}: ${count} features newly available by ${cutoff}`);
for (const [browser, { version: v, feature }] of Object.entries(floor)) {
  console.log(`${browser.padEnd(16)} ${String(v).padEnd(8)} (highest needed by ${feature})`);
}
