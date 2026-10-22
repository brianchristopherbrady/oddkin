/**
 * Check the published custom-element manifests against the API vocabulary (ADR 0045).
 *   node scripts/check-vocabulary.mjs [--json]
 * Exits 1 when any element uses a name outside the vocabulary.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkManifest } from './vocabulary.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const findings = ['packages/components', 'packages/ai'].flatMap((dir) =>
  checkManifest(JSON.parse(readFileSync(join(root, dir, 'custom-elements.json'), 'utf8'))),
);
if (process.argv.includes('--json')) console.log(JSON.stringify(findings, null, 2));
else {
  for (const f of findings) console.log(`${f.code}  <${f.tag}> ${f.name}: ${f.message}`);
  console.log(`Vocabulary: ${findings.length} finding(s).`);
}
process.exitCode = findings.length ? 1 : 0;
