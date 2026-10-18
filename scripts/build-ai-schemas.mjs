// Emit JSON Schemas for the @oddkin/ai record models into packages/ai/schemas/ (published with the
// package). The models are the single source; nothing here is maintained by hand.
// Run after `tsc -b`; `--check` fails when the committed schemas differ from the models.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'packages/ai/schemas');
const check = process.argv.includes('--check');
const { toJSONSchema } = await import(
  pathToFileURL(join(root, 'packages/core/dist/model/schema.js')).href
);
const models = await import(pathToFileURL(join(root, 'packages/ai/dist/contracts/models.js')).href);

await mkdir(out, { recursive: true });
let stale = 0;
const written = [];
for (const value of Object.values(models)) {
  if (typeof value?.validate !== 'function' || typeof value?.name !== 'string') continue;
  const file = `${value.name}.v${value.version}.schema.json`;
  const text = `${JSON.stringify(toJSONSchema(value, { id: `https://oddkin.dev/schemas/ai/${file}` }), null, 2)}\n`;
  const path = join(out, file);
  if (check) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== text) {
      console.error(`stale: packages/ai/schemas/${file}`);
      stale++;
    }
  } else await writeFile(path, text);
  written.push(file);
}
if (stale) process.exit(1);
console.log(`AI schemas ${check ? 'checked' : 'written'}: ${written.length}`);
