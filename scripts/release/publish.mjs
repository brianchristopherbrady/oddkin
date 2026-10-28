#!/usr/bin/env node
// Publishes the eight packages in dependency order (release-process.md §5). By default every
// publish is a dry run; `--publish` publishes for real, on the owner's say-so. Each package
// publishes with the dist-tag its version implies (`1.0.0-beta.0` -> `beta`), passed as `--tag`
// because npm 11.19 ignores publishConfig.tag. A version already on npm with the same packed
// contents is skipped, so a run stopped part way (a missed npm sign-in) resumes. Other contents
// under a published version, or nothing left to publish, stop the run, dry run included: the
// versions were not stepped (set-versions.mjs --next). Run after a clean build and the §3 checks.
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
const npm = (...args) =>
  execFileSync(process.execPath, [npmCli, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
const publishedIntegrity = (m) => {
  try {
    return npm('view', `${m.name}@${m.version}`, 'dist.integrity').trim();
  } catch (error) {
    if (/\bE404\b/.test(String(error.stderr))) return undefined;
    throw error;
  }
};
const packedIntegrity = (m) =>
  JSON.parse(npm('pack', '--dry-run', '--json', '--workspace', `packages/${m.dir}`))[0].integrity;

const already = [];
const changed = [];
const pending = manifests.filter((m) => {
  const published = publishedIntegrity(m);
  if (published === undefined) return true;
  (published === packedIntegrity(m) ? already : changed).push(`${m.name}@${m.version}`);
  return false;
});
const step = 'step the versions first: node scripts/release/set-versions.mjs --next';
if (changed.length) {
  console.error(`Already on npm with other contents: ${changed.join(', ')}; ${step}.`);
  process.exit(1);
}
if (!pending.length) {
  console.error(`Nothing to publish: every package is on npm at its version; ${step}.`);
  process.exit(1);
}
for (const name of already) console.log(`Already on npm with these contents: ${name}`);
for (const m of pending) {
  const tag = /-([0-9A-Za-z-]+)/.exec(m.version)?.[1] ?? 'latest';
  const args = [npmCli, 'publish', '--workspace', `packages/${m.dir}`, '--tag', tag];
  if (!live) args.push('--dry-run');
  console.log(`${live ? 'Publishing' : 'Dry run:'} ${m.name}@${m.version} --tag ${tag}`);
  // Inherited stdio: npm may ask the owner for a one-time password.
  execFileSync(process.execPath, args, { cwd: root, stdio: live ? 'inherit' : 'pipe' });
}
console.log(
  live
    ? `Published ${pending.length} packages (${already.length} already there). Check: npm dist-tag ls @oddkin/core`
    : `${pending.length} packages would publish (${already.length} already there); the owner runs this with --publish.`,
);
