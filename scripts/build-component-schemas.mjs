// Emit JSON Schemas for the @oddkin/components models into packages/components/schemas/
// (published with the package, at the paths `oddkin.metadata.json` records). The models are the
// single source. Run after `tsc -b`; `--check` fails when the committed schemas are stale.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'packages/components/schemas');
const check = process.argv.includes('--check');
const { toJSONSchema } = await import(
  pathToFileURL(join(root, 'packages/core/dist/model/schema.js')).href
);
const models = await import(
  pathToFileURL(join(root, 'packages/components/dist/models/index.js')).href
);

await mkdir(out, { recursive: true });
let stale = 0;
const written = [];
for (const value of Object.values(models)) {
  if (typeof value?.validate !== 'function' || typeof value?.name !== 'string') continue;
  const file = `${value.name}.v${value.version}.json`;
  const id = `https://oddkin.dev/schemas/components/${file}`;
  const text = `${JSON.stringify(toJSONSchema(value, { id }), null, 2)}\n`;
  const path = join(out, file);
  if (check) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== text) {
      console.error(`stale: packages/components/schemas/${file}`);
      stale++;
    }
  } else await writeFile(path, text);
  written.push(file);
}
if (stale) process.exit(1);
console.log(`Component schemas ${check ? 'checked' : 'written'}: ${written.length}`);
