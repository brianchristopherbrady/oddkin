// The release workflow's checks and summary for scripts/release/publish.mjs --ci (RF-12).
import { createHash } from 'node:crypto';

/** npm moves dist-tags through trusted publishing from this version (docs.npmjs.com/trusted-publishers). */
export const OIDC_DIST_TAG_NPM = '11.21.0';

/** The file `npm pack` writes for a package: `@oddkin/core@1.0.0` -> `oddkin-core-1.0.0.tgz`. */
export function tarballName(name, version) {
  return `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;
}

/** A tarball's integrity as npm records it (`dist.integrity`): SHA-512 of its bytes, in base64. */
export function integrityOf(bytes) {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}

/** The packages whose packed integrity is not the one the verified evidence recorded. */
export function unverified(evidence, packed) {
  const recorded = new Map(
    (evidence?.packages ?? []).map((pkg) => [`${pkg.name}@${pkg.version}`, pkg.integrity]),
  );
  return packed.filter((entry) => recorded.get(entry.spec) !== entry.integrity).map((e) => e.spec);
}

/** Whether npm `version` is at least `minimum` (their `major.minor.patch` numbers). */
export function atLeast(version, minimum) {
  const parse = (value) => String(value).split(/[.-]/, 3).map(Number);
  const [a, b] = [parse(version), parse(minimum)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

/** What stops a `--ci` run before it reads the registry: an empty list lets it go on. */
export function ciProblems({ env, npmVersion, live }) {
  const problems = [];
  if (env['GITHUB_ACTIONS'] !== 'true') problems.push('--ci runs only in GitHub Actions');
  if (!atLeast(npmVersion, OIDC_DIST_TAG_NPM))
    problems.push(
      `npm ${npmVersion} cannot move dist-tags through trusted publishing; install npm ${OIDC_DIST_TAG_NPM} or later`,
    );
  if (live && !(env['ACTIONS_ID_TOKEN_REQUEST_URL'] && env['ACTIONS_ID_TOKEN_REQUEST_TOKEN']))
    problems.push('no OIDC token: the publishing job needs `permissions: id-token: write`');
  return problems;
}

/** What each package did or would do, as Markdown for the run's summary page. */
export function renderSummary(plan, { live }) {
  const publish = (p) =>
    p.publish ? (live ? 'published' : 'would publish') : 'already on npm, same contents';
  const latest = (p) => (p.latest ? (live ? 'moved here' : 'would move here') : '—');
  return [
    `## ${live ? 'Published' : 'Dry run'}`,
    '',
    '| Package | Version | Publish | `latest` |',
    '| --- | --- | --- | --- |',
    ...plan.map((p) => `| ${p.name} | ${p.version} | ${publish(p)} | ${latest(p)} |`),
    '',
    live
      ? "Each version published here carries npm provenance for this run. Next (docs/release-process.md §5): the registry smoke with this version, `RELEASED` in `e2e/duplicate-core.spec.ts`, the tag, and the GitHub Release with this run's evidence."
      : 'Nothing was published. To publish, run the workflow again from `main` with publish ticked.',
    '',
  ].join('\n');
}
