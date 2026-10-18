/**
 * Attach contract-test evidence to a package's published oddkin.metadata.json. Records come
 * from `packages/<pkg>/.oddkin/verification/<suite>/<browser>/<tag>.json` (written by the
 * package's contract browser test) and count only when they were made against the current
 * custom-elements.json and the same implementation files; see attachVerification.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { attachVerification, stableJson } from '../packages/analyzer/dist/index.js';

export const BROWSERS = ['chromium', 'firefox', 'webkit'];

const sha256 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('hex')}`;

function files(dir, accept, skip = () => false) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (skip(path)) return [];
    return entry.isDirectory() ? files(path, accept, skip) : accept(path) ? [path] : [];
  });
}

/**
 * Hash of the files the contract test runs: the package's TypeScript sources and the
 * development builds of @oddkin/core and @oddkin/tokens. Must match the browser-side hash in
 * packages/components/test/contract.browser.test.ts (repository-relative paths, sorted).
 */
export function implementationHash(root, pkgDir) {
  const list = [
    ...files(join(pkgDir, 'src'), (p) => p.endsWith('.ts')),
    ...files(
      join(root, 'packages/core/dist'),
      (p) => p.endsWith('.js'),
      (p) => p === join(root, 'packages/core/dist/prod'),
    ),
    ...files(join(root, 'packages/tokens/dist'), (p) => p.endsWith('.js')),
  ]
    .map((path) => [relative(root, path).split(sep).join('/'), path])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256(list.map(([name, path]) => `${name}\n${readFileSync(path, 'utf8')}\n`).join(''));
}

/** Attach current evidence to `<pkgDir>/oddkin.metadata.json`; returns the report. */
export function attach(root, pkgDir, test, { requireAll = false } = {}) {
  const metadataPath = join(pkgDir, 'oddkin.metadata.json');
  const manifestPath = join(pkgDir, 'custom-elements.json');
  const records = files(join(pkgDir, '.oddkin/verification'), (p) => p.endsWith('.json')).map(
    (path) => JSON.parse(readFileSync(path, 'utf8')),
  );
  const current = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const { metadata, report } = attachVerification(current, records, {
    inputs: {
      manifest: sha256(readFileSync(manifestPath, 'utf8')),
      sources: implementationHash(root, pkgDir),
    },
    browsers: BROWSERS,
    test,
    ...(requireAll
      ? { require: Object.values(current.components ?? {}).map((component) => component.tag) }
      : {}),
  });
  writeFileSync(metadataPath, stableJson(metadata));
  return report;
}
