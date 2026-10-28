#!/usr/bin/env node
// Removes every package's build output and TypeScript build info, so the release build starts
// from nothing and no module an earlier build left behind is published (release-process.md §5).
//   node scripts/release/clean.mjs && npm run build
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let removed = 0;
for (const dir of readdirSync(join(root, 'packages'))) {
  const pkg = join(root, 'packages', dir);
  for (const name of readdirSync(pkg))
    if (name === 'dist' || name.endsWith('.tsbuildinfo')) {
      rmSync(join(pkg, name), { recursive: true, force: true });
      removed++;
    }
}
console.log(`Removed ${removed} build outputs; run npm run build.`);
