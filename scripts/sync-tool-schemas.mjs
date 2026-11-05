// Copy the JSON Schemas that users' files and exported artifacts follow into the packages that
// publish them (`<package>/schemas/`, exported as `./schemas/*.json`). docs/schemas stays the
// source; `--check` fails when a copy differs, as tests/schemas/schemas.test.ts does.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
/** Package directory → the schemas it publishes (names in docs/schemas, without `.v1.schema.json`). */
const PUBLISHED = {
  'packages/workbench': ['workbench-config', 'docs-content'],
  'packages/analyzer': ['product', 'comparison-snapshot', 'impact-report'],
};

const check = process.argv.includes('--check');
let stale = 0;
let count = 0;
for (const [dir, names] of Object.entries(PUBLISHED)) {
  if (!check) mkdirSync(join(root, dir, 'schemas'), { recursive: true });
  for (const name of names) {
    const file = `${name}.v1.schema.json`;
    const source = readFileSync(join(root, 'docs/schemas', file), 'utf8');
    const target = join(root, dir, 'schemas', file);
    count++;
    if (!check) writeFileSync(target, source);
    else if (!existsSync(target) || readFileSync(target, 'utf8') !== source) {
      console.error(`stale: ${dir}/schemas/${file} (run node scripts/sync-tool-schemas.mjs)`);
      stale++;
    }
  }
}
if (stale) process.exit(1);
console.log(`Tool schemas ${check ? 'checked' : 'written'}: ${count}`);
