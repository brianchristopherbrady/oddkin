/**
 * Generate published metadata for component packages: `custom-elements.json` (standard CEM)
 * and `oddkin.metadata.json` at the package root, from @oddkin/analyzer. Fails on any analyzer
 * error or warning so published metadata never contains unresolved dynamic definitions.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, writeOutputs } from '../packages/analyzer/dist/index.js';
import { attach } from './verification.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// Packages whose published contract includes component metadata.
const PACKAGES = ['packages/components', 'packages/ai'];
// Packages whose contract tests record evidence (attached while it matches the current inputs).
const CONTRACT_TESTS = {
  'packages/components': 'packages/components/test/contract.browser.test.ts',
};

let failed = false;
for (const dir of PACKAGES) {
  const pkgDir = join(root, dir);
  const manifest = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
  const result = analyze({
    project: join(pkgDir, 'tsconfig.json'),
    library: { name: manifest.name, version: manifest.version, prefix: 'odd-' },
  });
  for (const d of result.diagnostics) {
    const at = d.source ? ` ${d.source.file}:${d.source.line}:${d.source.column}` : '';
    console.error(`${d.severity} ${d.code}${at}: ${d.message}`);
    failed = true;
  }
  const files = await writeOutputs(result, pkgDir);
  console.log(`Metadata: ${files.map((f) => relative(root, f)).join(', ')}`);
  if (CONTRACT_TESTS[dir]) {
    const report = attach(root, pkgDir, CONTRACT_TESTS[dir]);
    const total = Object.values(report.verified).reduce((sum, n) => sum + n, 0);
    console.log(`Verified facts from current contract-test records: ${total}`);
  }
}
if (failed) process.exitCode = 1;
