/**
 * Attach contract-test evidence to published metadata and require it: run after `npm test`.
 * Fails when a required browser has no record for the current inputs, or a recorded case
 * failed. Facts that were not executed stay unverified and are listed.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { BROWSERS, CONTRACT_TESTS, attach } from './verification.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
const validRecord = ajv.compile(
  JSON.parse(readFileSync(join(root, 'docs/schemas/conformance-result.v1.schema.json'), 'utf8')),
);
for (const dir of Object.keys(CONTRACT_TESTS)) {
  const pkgDir = join(root, dir);
  const evidence = join(pkgDir, '.oddkin/verification');
  for (const entry of existsSync(evidence)
    ? readdirSync(evidence, { recursive: true, withFileTypes: true })
    : []) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const path = join(entry.parentPath, entry.name);
    if (!validRecord(JSON.parse(readFileSync(path, 'utf8')))) {
      console.error(
        `invalid conformance-result.v1 record ${path}: ${ajv.errorsText(validRecord.errors)}`,
      );
      process.exitCode = 1;
    }
  }
  const report = attach(root, pkgDir, { requireAll: true });
  const total = Object.values(report.verified).reduce((sum, n) => sum + n, 0);
  console.log(
    `${dir}: ${total} verified facts across ${Object.keys(report.verified).length} element(s) in ${BROWSERS.join(', ')}.`,
  );
  if (report.stale.length) console.log(`  ignored ${report.stale.length} stale record(s)`);
  // Facts that were not executed (e.g. slots and parts without authored examples) stay unverified.
  const skipped = new Map();
  for (const n of report.notExecuted) skipped.set(n.tag, (skipped.get(n.tag) ?? 0) + 1);
  if (skipped.size)
    console.log(
      `  not executed (unverified): ${[...skipped].map(([tag, n]) => `${tag} ${n}`).join(', ')}`,
    );
  for (const f of report.failed) console.error(`  failed: ${f.tag} ${f.case} (${f.browser})`);
  for (const m of report.missing)
    console.error(`  missing: no current ${m.browser} record for ${m.tag}; run npm test`);
  if (report.failed.length || report.missing.length) process.exitCode = 1;
}
