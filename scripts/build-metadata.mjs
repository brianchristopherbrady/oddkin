/**
 * Generate published metadata for component packages: `custom-elements.json` (standard CEM)
 * and `oddkin.metadata.json` at the package root, from @oddkin/analyzer. Fails on any analyzer
 * error or warning so published metadata never contains unresolved dynamic definitions, and on
 * authored text that cites a name no published contract declares.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyze,
  authoredTexts,
  checkReferences,
  referenceIndex,
  writeOutputs,
} from '../packages/analyzer/dist/index.js';
import { CONTRACT_TESTS, attach } from './verification.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// Packages whose published contract includes component metadata.
const PACKAGES = ['packages/components', 'packages/ai'];

let failed = false;
const print = (d, dir) => {
  const at = d.source ? ` ${join(dir, d.source.file)}:${d.source.line}:${d.source.column}` : '';
  console.error(`${d.severity} ${d.code}${at}: ${d.message}`);
  failed = true;
};
const results = [];
for (const dir of PACKAGES) {
  const pkgDir = join(root, dir);
  const manifest = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
  const result = analyze({
    project: join(pkgDir, 'tsconfig.json'),
    library: { name: manifest.name, version: manifest.version, prefix: 'odd-' },
  });
  for (const d of result.diagnostics) print(d, dir);
  results.push({ dir, result });
  const files = await writeOutputs(result, pkgDir);
  console.log(`Metadata: ${files.map((f) => relative(root, f)).join(', ')}`);
  // Evidence from earlier contract-test runs is attached while it matches the current inputs.
  if (CONTRACT_TESTS[dir]) {
    const report = attach(root, pkgDir);
    const total = Object.values(report.verified).reduce((sum, n) => sum + n, 0);
    console.log(`Verified facts from current contract-test records: ${total}`);
  }
}

// Authored references resolve against every published contract: elements of both packages,
// public entry points of the workspace packages, default-theme tokens, and layout recipes.
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const tokens = readFileSync(
  join(root, 'packages/tokens/dist/generated/default-names.d.ts'),
  'utf8',
);
const css = readFileSync(join(root, 'packages/tokens/dist/css/default.css'), 'utf8');
const index = referenceIndex({
  manifests: results.map(({ result }) => result.manifest),
  metadata: results.map(({ result }) => result.metadata),
  packages: readdirSync(join(root, 'packages')).map((d) => read(`packages/${d}/package.json`)),
  tokens: [...tokens.matchAll(/'([^']+)'/g)].map((m) => m[1]),
  variables: [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
});
for (const { dir, result } of results) {
  const texts = authoredTexts(result.manifest, result.metadata, result.examples);
  for (const d of checkReferences(texts, index)) print(d, dir);
}
if (failed) process.exitCode = 1;
