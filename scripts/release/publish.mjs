#!/usr/bin/env node
// Publishes the eight packages in dependency order (release-process.md §5). By default every
// publish is a dry run; `--publish` publishes for real, on the owner's say-so. Each package
// publishes with the dist-tag its version implies (`1.0.0-beta.0` -> `beta`), passed as `--tag`
// because npm 11.19 ignores publishConfig.tag. A version already on the registry is skipped, so
// a run stopped part way (a missed npm sign-in) resumes. Run after a clean build and the §3 checks.
//   node scripts/release/publish.mjs            # dry run of all eight
//   node scripts/release/publish.mjs --publish  # the owner, logged in to npm
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ORDER = ['tokens', 'core', 'state', 'app', 'components', 'ai', 'analyzer', 'workbench'];
const npmCli = process.env['npm_execpath']?.endsWith('.js')
  ? process.env['npm_execpath']
  : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const live = process.argv.includes('--publish');

const manifests = ORDER.map((dir) => ({
  dir,
  ...JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8')),
}));
const problems = manifests.flatMap((m) =>
  m.private
    ? [`${m.name} is private`]
    : m.publishConfig?.access !== 'public'
      ? [`${m.name} is not public`]
      : [],
);
if (problems.length) {
  console.error(`Not publishable: ${problems.join('; ')}.`);
  process.exit(1);
}
const onRegistry = (m) => {
  try {
    const args = [npmCli, 'view', `${m.name}@${m.version}`, 'version'];
    const options = { cwd: root, encoding: 'utf8', stdio: 'pipe' };
    return execFileSync(process.execPath, args, options).trim() === m.version;
  } catch {
    return false; // E404: not published yet
  }
};
let skipped = 0;
for (const m of manifests) {
  if (onRegistry(m)) {
    console.log(`Already on the registry: ${m.name}@${m.version}`);
    skipped++;
    continue;
  }
  const tag = /-([0-9A-Za-z-]+)/.exec(m.version)?.[1] ?? 'latest';
  const args = [npmCli, 'publish', '--workspace', `packages/${m.dir}`, '--tag', tag];
  if (!live) args.push('--dry-run');
  console.log(`${live ? 'Publishing' : 'Dry run:'} ${m.name}@${m.version} --tag ${tag}`);
  // Inherited stdio: npm may ask the owner for a one-time password.
  execFileSync(process.execPath, args, { cwd: root, stdio: live ? 'inherit' : 'pipe' });
}
console.log(
  live
    ? `Published ${manifests.length - skipped} packages (${skipped} already there). Check: npm dist-tag ls @oddkin/core`
    : `${manifests.length - skipped} packages would publish (${skipped} already there); the owner runs this with --publish.`,
);
