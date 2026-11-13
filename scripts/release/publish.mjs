#!/usr/bin/env node
// Publishes the eight packages in dependency order (release-process.md §5). By default every
// publish is a dry run; `--publish` publishes for real, on the owner's say-so. Each package
// publishes with the dist-tag its version implies (`1.0.0-beta.0` -> `beta`), passed as `--tag`
// because npm 11.19 ignores publishConfig.tag. Until a package has a stable version, `latest`
// moves to each new prerelease too (`npm dist-tag add`, one more npm approval per package).
// A version already on npm with the same packed contents is skipped, so a run stopped part way
// (a missed npm sign-in) resumes. Other contents under a published version, or nothing left to
// do, stop the run, dry run included: the versions were not stepped (set-versions.mjs --next).
// `--ci` is the release workflow's mode (.github/workflows/release.yml, RF-12): npm trusted
// publishing through GitHub's OIDC token, with provenance, and a summary on the run's page.
// `--tarballs <dir>` publishes the files `npm pack` wrote there instead of the workspaces, each
// first checked against the integrity `<dir>/evidence.json` recorded: the release job publishes
// exactly what the verify job built and checked, and installs nothing itself.
// Run after a clean build and the §3 checks.
//   node scripts/release/publish.mjs            # dry run of all eight
//   node scripts/release/publish.mjs --publish  # the owner, logged in to npm
//   node scripts/release/publish.mjs --ci --tarballs <dir> [--publish]   # release.yml
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ciProblems, integrityOf, renderSummary, tarballName, unverified } from './publish-ci.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ORDER = ['tokens', 'core', 'state', 'app', 'components', 'ai', 'analyzer', 'workbench'];
// npm through its CLI script and the current Node: no shell. Run directly (not from an npm
// script), npm_execpath is unset; Node installs npm beside itself (Windows) or under ../lib.
const npmCli = [
  process.env['npm_execpath'],
  join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
].find((path) => path?.endsWith('.js') && existsSync(path));
const live = process.argv.includes('--publish');
const ci = process.argv.includes('--ci');
const tarballsAt = process.argv.indexOf('--tarballs');
const tarballs = tarballsAt >= 0 ? resolve(process.argv[tarballsAt + 1] ?? '') : undefined;
if (!npmCli) {
  console.error('npm-cli.js was not found beside this Node binary.');
  process.exit(1);
}

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
if (ci) {
  const blocked = ciProblems({ env: process.env, npmVersion: npm('--version').trim(), live });
  if (blocked.length) {
    console.error(`Not publishing from CI: ${blocked.join('; ')}.`);
    process.exit(1);
  }
}
const view = (...args) => {
  try {
    return JSON.parse(npm('view', ...args, '--json'));
  } catch (error) {
    if (/\bE404\b/.test(String(error.stderr))) return undefined;
    throw error;
  }
};
const tarballOf = (m) => join(tarballs, tarballName(m.name, m.version));
const packedIntegrity = (m) =>
  tarballs
    ? integrityOf(readFileSync(tarballOf(m)))
    : JSON.parse(npm('pack', '--dry-run', '--json', '--workspace', `packages/${m.dir}`))[0]
        .integrity;
if (tarballs) {
  const missing = manifests.filter((m) => !existsSync(tarballOf(m))).map((m) => tarballOf(m));
  if (missing.length) {
    console.error(`No tarball: ${missing.join(', ')}.`);
    process.exit(1);
  }
  // Only what the verified evidence recorded is published.
  const evidenceFile = join(tarballs, 'evidence.json');
  const evidence = existsSync(evidenceFile)
    ? JSON.parse(readFileSync(evidenceFile, 'utf8'))
    : undefined;
  const notVerified = unverified(
    evidence,
    manifests.map((m) => ({ spec: `${m.name}@${m.version}`, integrity: packedIntegrity(m) })),
  );
  if (notVerified.length) {
    console.error(
      `Not the packages the evidence recorded: ${notVerified.join(', ')} (${evidenceFile}).`,
    );
    process.exit(1);
  }
}

const plan = manifests.map((m) => {
  const registry = view(m.name, 'versions', 'dist-tags');
  const versions = [registry?.versions ?? []].flat();
  const published = versions.includes(m.version);
  return {
    ...m,
    spec: `${m.name}@${m.version}`,
    publish: !published,
    changed: published && view(`${m.name}@${m.version}`, 'dist.integrity') !== packedIntegrity(m),
    // Until a stable release, latest follows the prereleases; a first publish takes it anyway.
    latest:
      m.version.includes('-') &&
      registry !== undefined &&
      !versions.some((v) => !v.includes('-')) &&
      registry['dist-tags']?.latest !== m.version,
  };
});
const step = 'step the versions first: node scripts/release/set-versions.mjs --next';
const changed = plan.filter((p) => p.changed).map((p) => p.spec);
if (changed.length) {
  console.error(`Already on npm with other contents: ${changed.join(', ')}; ${step}.`);
  process.exit(1);
}
const todo = plan.filter((p) => p.publish || p.latest);
if (!todo.length) {
  console.error(`Nothing to publish: every package is on npm at its version; ${step}.`);
  process.exit(1);
}
for (const p of plan) if (!p.publish) console.log(`Already on npm with these contents: ${p.spec}`);
for (const p of todo) {
  if (p.publish) {
    const tag = /-([0-9A-Za-z-]+)/.exec(p.version)?.[1] ?? 'latest';
    const target = tarballs ? [tarballOf(p)] : ['--workspace', `packages/${p.dir}`];
    const args = [npmCli, 'publish', ...target, '--tag', tag];
    if (!live) args.push('--dry-run');
    // Trusted publishing adds provenance by default; asking for it makes a run without it fail.
    else if (ci) args.push('--provenance');
    console.log(`${live ? 'Publishing' : 'Dry run:'} ${p.spec} --tag ${tag}`);
    // Inherited stdio: npm may ask the owner for a one-time password.
    execFileSync(process.execPath, args, { cwd: root, stdio: live ? 'inherit' : 'pipe' });
    if (live && ci)
      console.log(
        `::notice title=Published ${p.spec}::https://www.npmjs.com/package/${p.name}/v/${p.version}`,
      );
  }
  if (p.latest) {
    // npm dist-tag has no dry run.
    console.log(
      `${live ? 'Moving latest:' : 'Dry run, not run:'} npm dist-tag add ${p.spec} latest`,
    );
    if (live)
      execFileSync(process.execPath, [npmCli, 'dist-tag', 'add', p.spec, 'latest'], {
        cwd: root,
        stdio: 'inherit',
      });
  }
}
const published = todo.filter((p) => p.publish).length;
const moved = todo.filter((p) => p.latest).length;
const there = plan.length - published;
if (ci && process.env['GITHUB_STEP_SUMMARY'])
  appendFileSync(process.env['GITHUB_STEP_SUMMARY'], renderSummary(plan, { live }));
console.log(
  live
    ? `Published ${published} packages and moved latest for ${moved} (${there} already there). Check: npm dist-tag ls @oddkin/core`
    : `${published} packages would publish and latest would move for ${moved} (${there} already there); the owner runs this with --publish.`,
);
