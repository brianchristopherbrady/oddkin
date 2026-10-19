// Writes packages/core/CONTRACTS.md and contracts.json from docs/architecture/core-contracts.md.
// `--check` fails when either file is stale, without writing (run in `npm run lint`).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE, TARGETS, generateContracts } from './contracts.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');
const { markdown, index, ids, problems } = generateContracts(
  readFileSync(join(root, SOURCE), 'utf8'),
);
if (problems.length) {
  console.error(`Contract markers in ${SOURCE}:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const outputs = { [TARGETS.markdown]: markdown, [TARGETS.index]: index };
const stale = [];
for (const [file, text] of Object.entries(outputs)) {
  let current;
  try {
    current = readFileSync(join(root, file), 'utf8');
  } catch {
    current = undefined;
  }
  if (current === text) continue;
  if (check) stale.push(file);
  else writeFileSync(join(root, file), text);
}
if (stale.length) {
  console.error(`Stale generated contracts: ${stale.join(', ')}. Run \`npm run contracts\`.`);
  process.exit(1);
}
console.log(`Contracts: ${ids.length} sections from ${SOURCE}${check ? ' (up to date)' : ''}.`);
