// The one authored host contract, copied into packages so an installed kit is self-contained.
// --check callers compare without writing; third-party workspaces without this source are untouched.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const RESPONSIVENESS_SOURCE = 'docs/architecture/responsiveness.md';
export const RESPONSIVENESS_ASSET = 'RESPONSIVENESS.md';

export async function syncResponsiveness(root, { check = false } = {}) {
  const source = join(root, RESPONSIVENESS_SOURCE);
  if (!existsSync(source)) return { ok: true, changed: [] };
  const text = `<!-- Generated from ${RESPONSIVENESS_SOURCE}; edit that source. -->\n\n${await readFile(source, 'utf8')}`;
  const changed = [];
  for (const name of ['components', 'ai']) {
    const directory = join(root, 'packages', name);
    const manifestFile = join(directory, 'package.json');
    if (!existsSync(manifestFile)) continue;
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    if (manifest.name !== `@oddkin/${name}`) continue;
    const target = join(directory, RESPONSIVENESS_ASSET);
    const current = existsSync(target) ? await readFile(target, 'utf8') : undefined;
    if (current === text) continue;
    changed.push(`packages/${name}/${RESPONSIVENESS_ASSET}`);
    if (!check) await writeFile(target, text);
  }
  return { ok: !check || changed.length === 0, changed };
}
