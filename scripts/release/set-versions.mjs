#!/usr/bin/env node
// Sets release versions in every published package (release-process.md §1, §5): the runtime
// packages share one version, the tools (analyzer, Workbench) another. Internal dependencies
// become caret ranges of the version they point at, and publishConfig gets public access and,
// for a prerelease, its dist-tag. npm 11.19 ignores publishConfig.tag, so the publish command
// still passes `--tag` (a prerelease must never publish as `latest`). `--public` removes
// `private` (only once the owner has authorized publishing). The private apps (`apps/*`) keep
// their version and `private`, and get the same internal ranges. Run `npm install` afterwards.
// `--next [id]` steps both lines' numbered prerelease (1.0.0-beta.0 -> 1.0.0-beta.1, or to
// 1.0.0-rc.0 with `--next rc`); a release or other change of version is named explicitly.
//   node scripts/release/set-versions.mjs --runtime 1.0.0-beta.0 --tools 1.0.0-beta.0 [--public] [--check]
//   node scripts/release/set-versions.mjs --next [id]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TOOLS = new Set(['@oddkin/analyzer', '@oddkin/workbench']);
const SEMVER = /^\d+\.\d+\.\d+(?:-([0-9A-Za-z-]+)(?:\.[0-9A-Za-z-]+)*)?$/;
const DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'devDependencies',
];

const arg = (name) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : undefined;
};
const check = process.argv.includes('--check');
const publish = process.argv.includes('--public');

const read = (folder) =>
  readdirSync(join(root, folder)).map((dir) => {
    const file = join(root, folder, dir, 'package.json');
    return {
      file,
      manifest: JSON.parse(readFileSync(file, 'utf8')),
      published: folder === 'packages',
    };
  });
const packages = read('packages');
const workspaces = [...packages, ...read('apps')];

const step = (version, id) => {
  const [, base, current, number] = /^(\d+\.\d+\.\d+)-([0-9A-Za-z-]+)\.(\d+)$/.exec(version) ?? [];
  if (!base) return undefined;
  return !id || id === current ? `${base}-${current}.${Number(number) + 1}` : `${base}-${id}.0`;
};
const current = (name) => packages.find(({ manifest }) => manifest.name === name).manifest.version;
const nextAt = process.argv.indexOf('--next');
const nextId = arg('--next')?.startsWith('--') ? undefined : arg('--next');
const versions =
  nextAt > -1
    ? {
        runtime: step(current('@oddkin/core'), nextId),
        tools: step(current('@oddkin/analyzer'), nextId),
      }
    : { runtime: arg('--runtime'), tools: arg('--tools') };
if (nextAt > -1 && (arg('--runtime') || arg('--tools') || !versions.runtime || !versions.tools)) {
  console.error(
    `--next steps a numbered prerelease (core ${current('@oddkin/core')}, tools ${current('@oddkin/analyzer')}) and replaces --runtime and --tools; name any other version with --runtime and --tools.`,
  );
  process.exit(2);
}
for (const [group, version] of Object.entries(versions))
  if (!version || !SEMVER.test(version)) {
    console.error(`--${group} needs a semantic version (got ${version ?? 'nothing'}).`);
    process.exit(2);
  }
const versionOf = (name) => (TOOLS.has(name) ? versions.tools : versions.runtime);
const tagOf = (version) =>
  SEMVER.exec(version)[1]?.replace(/\d+$/, '').replace(/[.-]$/, '') || 'latest';

const stale = [];
for (const { file, manifest, published } of workspaces) {
  const version = published ? versionOf(manifest.name) : manifest.version;
  const next = { ...manifest, version };
  for (const field of DEPENDENCY_FIELDS) {
    if (!manifest[field]) continue;
    next[field] = Object.fromEntries(
      Object.entries(manifest[field]).map(([name, range]) =>
        name.startsWith('@oddkin/') ? [name, `^${versionOf(name)}`] : [name, range],
      ),
    );
  }
  if (published) {
    const { tag: _previous, ...publishConfig } = manifest.publishConfig ?? {};
    const tag = tagOf(version);
    next.publishConfig = {
      ...publishConfig,
      access: 'public',
      ...(tag === 'latest' ? {} : { tag }),
    };
    if (publish) delete next.private;
  }
  const text = `${JSON.stringify(next, null, 2)}\n`;
  if (text === readFileSync(file, 'utf8')) continue;
  stale.push(manifest.name);
  if (!check) writeFileSync(file, text);
}
// Core names its version when two copies meet on one page (core-contracts.md §5.1).
const versionFile = join(root, 'packages/core/src/internal/version.ts');
const versionText = readFileSync(versionFile, 'utf8').replace(
  /VERSION = '[^']*'/,
  `VERSION = '${versionOf('@oddkin/core')}'`,
);
if (versionText !== readFileSync(versionFile, 'utf8')) {
  stale.push('@oddkin/core (src/internal/version.ts)');
  if (!check) writeFileSync(versionFile, versionText);
}
if (check && stale.length) {
  console.error(`Not at the requested versions: ${stale.join(', ')}.`);
  process.exit(1);
}
console.log(
  `${check ? 'Checked' : 'Set'} ${packages.length} packages: runtime ${versions.runtime} and tools ${versions.tools}${publish ? ', publishable' : ''}; publish with --tag ${tagOf(versions.runtime)} (tools: --tag ${tagOf(versions.tools)}).${stale.length && !check ? ' Run npm install to update the lockfile, then npm test before npm run verify:metadata (contract records include the version).' : ''}`,
);
