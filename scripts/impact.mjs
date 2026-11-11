// Change impact for this repository (change-impact-and-verification.md §2), local only:
//
//   node scripts/impact.mjs snapshot [--out .oddkin/impact/snapshot.json]
//       Snapshot the built packages (run `npm run build` first) with the default theme.
//   node scripts/impact.mjs compare (<base.json> | --base-ref <git-ref>) [<head.json>] [--run]
//       Compare with the current build (or <head.json>). --base-ref checks the revision out in a
//       temporary git worktree, builds it there, and snapshots it. With --run, the selected checks
//       run in Chromium, Firefox, and WebKit through Vitest and their results are merged.
//
// Tool versions are content hashes of the core, tokens, and analyzer builds, so a change to any of
// them is a version change (full verification, no reuse). Reports are written to
// .oddkin/impact/report.json and report.md. Exit code 1 when a merged check failed.
// scripts/impact-demo.mjs reuses the exports: building a revision, snapshots, and the check run.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const DIR = join(ROOT, '.oddkin/impact');
const BIN = join(ROOT, 'packages/analyzer/dist/impact-bin.js');
const PACKAGES = ['packages/components', 'packages/ai'];
const THEME = 'packages/tokens/themes/default.theme.json';
const TOOLS = {
  core: 'packages/core/dist',
  tokens: 'packages/tokens/dist/generate',
  analyzer: 'packages/analyzer/dist',
};

const fail = (message) => {
  console.error(message);
  process.exit(2);
};
export const run = (command, args, cwd, env) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${cwd}`);
};
/** Run the oddkin-impact command line; its usage errors (exit 2) stop this script. */
export const cli = (args) => {
  const result = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
  if (result.status === 2) fail(result.stderr || result.stdout);
  return result;
};

/** SHA-256 of every .js file under `dir` (development builds only), by relative path. */
function buildHash(dir) {
  const files = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'prod') walk(path);
      } else if (entry.name.endsWith('.js')) files.push(path);
    }
  };
  if (existsSync(dir)) walk(dir);
  const hash = createHash('sha256');
  for (const file of files.sort())
    hash.update(`${relative(dir, file).split('\\').join('/')}\n`).update(readFileSync(file));
  return `sha256-${hash.digest('hex').slice(0, 16)}`;
}

/** Snapshot the built packages of the checkout at `root` with the current oddkin-impact CLI. */
export async function snapshot(root, out) {
  if (!existsSync(BIN)) fail('Build first: npm run build');
  mkdirSync(dirname(out), { recursive: true });
  const { generate, emitInspectJson } = await import(
    pathToFileURL(join(root, 'packages/tokens/dist/generate/index.js')).href
  );
  const config = JSON.parse(readFileSync(join(root, THEME), 'utf8'));
  const result = generate(config);
  if (!result.ok) fail(JSON.stringify(result.diagnostics));
  const inspection = `${out}.inspect.json`;
  writeFileSync(inspection, emitInspectJson(result.theme, result.diagnostics));
  const suiteFile = join(root, 'packages/workbench/src/conformance/button.ts');
  const suiteVersion = existsSync(suiteFile)
    ? /version: '([^']+)'/.exec(readFileSync(suiteFile, 'utf8'))?.[1]
    : undefined;
  const packages = PACKAGES.map((p) => join(root, p)).filter((p) =>
    existsSync(join(p, 'custom-elements.json')),
  );
  const outcome = cli([
    'snapshot',
    ...packages,
    '--theme',
    join(root, THEME),
    '--inspection',
    inspection,
    ...(suiteVersion ? ['--suite', `oddkin.button@${suiteVersion}:odd-button`] : []),
    ...Object.entries(TOOLS).flatMap(([name, dir]) => [
      '--tool',
      `${name}=${buildHash(join(root, dir))}`,
    ]),
    // The checkout's commit and whether it had uncommitted changes (Workstream C provenance).
    '--source',
    root,
    '--out',
    out,
  ]);
  console.log(outcome.stdout.trim());
}

/**
 * Give a worktree its own node_modules: third-party entries link to this checkout's, workspace
 * packages link to the worktree's packages, so its build never reads today's sources. Returns
 * the links made; they are removed with rmdir, which deletes a junction and never its target.
 */
function linkDependencies(worktree) {
  const links = [];
  const link = (target, path) => {
    symlinkSync(target, path, 'junction');
    links.push(path);
  };
  const main = join(ROOT, 'node_modules');
  const own = join(worktree, 'node_modules');
  mkdirSync(own, { recursive: true });
  for (const entry of readdirSync(main, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.name === '@oddkin') {
      mkdirSync(join(own, '@oddkin'), { recursive: true });
      for (const pkg of readdirSync(join(main, '@oddkin'))) {
        const source =
          pkg === 'docs' ? join(worktree, 'apps/docs') : join(worktree, 'packages', pkg);
        if (existsSync(source)) link(source, join(own, '@oddkin', pkg));
      }
    } else link(join(main, entry.name), join(own, entry.name));
  }
  // Packages with their own pinned dependencies (the analyzer's TypeScript).
  for (const pkg of readdirSync(join(ROOT, 'packages'))) {
    const modules = join(ROOT, 'packages', pkg, 'node_modules');
    if (existsSync(modules) && existsSync(join(worktree, 'packages', pkg)))
      link(modules, join(worktree, 'packages', pkg, 'node_modules'));
  }
  return links;
}

/** The commit a git revision names; an unknown revision stops this script. */
export function commitOf(ref, cwd = ROOT) {
  const sha = spawnSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd,
    encoding: 'utf8',
  });
  if (sha.status !== 0) fail(`Unknown git revision: ${ref}`);
  return sha.stdout.trim();
}

/** The build step a snapshot needs last: the metadata reads the token assets and production build. */
export const METADATA_STEP = 'scripts/build-metadata.mjs';

/**
 * Check `ref` out in a temporary worktree, let `prepare(worktree)` change it (the demonstration
 * commits its change there), give it its own dependencies, build it with its own build steps
 * through the step `through`, and return `fn(worktree)`. The worktree is always removed.
 */
export async function withBuiltRevision(
  ref,
  fn,
  { prepare, through = METADATA_STEP, name = 'base' } = {},
) {
  const commit = commitOf(ref);
  const worktree = join(DIR, `${name}-${commit.slice(0, 12)}`);
  run('git', ['worktree', 'add', '--detach', worktree, commit], ROOT);
  let links = [];
  try {
    if (prepare) await prepare(worktree);
    links = linkDependencies(worktree);
    // The revision's own build steps, read from its package.json: they change over time.
    const steps = JSON.parse(readFileSync(join(worktree, 'package.json'), 'utf8'))
      .scripts.build.split('&&')
      .map((step) => step.trim().split(/\s+/));
    for (const [command, ...args] of steps) {
      if (command === 'tsc')
        run(
          process.execPath,
          [join(worktree, 'node_modules/typescript/bin/tsc'), ...args],
          worktree,
        );
      else if (command === 'node') run(process.execPath, args, worktree);
      else throw new Error(`Unsupported build step at ${ref}: ${command} ${args.join(' ')}`);
      if (args[0] === through) break;
    }
    return await fn(worktree);
  } finally {
    // Unlink junctions first, so removing the worktree can never reach their targets. rmdir
    // removes a Windows junction; a POSIX symlink is unlinked (rmdir fails on it with ENOTDIR).
    for (const path of links.reverse())
      if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink())
        (process.platform === 'win32' ? rmdirSync : unlinkSync)(path);
    run('git', ['worktree', 'remove', '--force', worktree], ROOT);
  }
}

/** Build `ref` in a temporary worktree and snapshot it. */
async function snapshotRef(ref, out) {
  await withBuiltRevision(ref, (worktree) => snapshot(worktree, out));
  console.log(`Base: ${ref} (${commitOf(ref).slice(0, 12)})`);
}

/**
 * Run the checks `report` selected on the checkout at `root` (built) in Chromium, Firefox, and
 * WebKit (tests/impact/selected.browser.test.ts), and return the result files, copied to
 * `results` when that is not where the run writes them.
 */
export function runSelected(root, report, results = join(root, '.oddkin/impact/results')) {
  const { checks, head } = JSON.parse(readFileSync(report, 'utf8'));
  const selected = checks.filter((c) => c.state === 'selected');
  const own = join(root, '.oddkin/impact');
  const written = join(own, 'results');
  rmSync(written, { recursive: true, force: true });
  mkdirSync(own, { recursive: true });
  const selection = join(own, 'selection.json');
  // The runs happen on the head's checkout, so their result files record the head's commit.
  writeFileSync(
    selection,
    `${JSON.stringify({ checks: selected.map(({ id, product }) => ({ id, ...(product ? { product } : {}) })), ...(head?.source ? { source: head.source } : {}) }, null, 2)}\n`,
  );
  try {
    if (selected.length) {
      const vitest = spawnSync(
        process.execPath,
        [
          join(root, 'node_modules/vitest/vitest.mjs'),
          'run',
          '--project',
          'browser',
          'tests/impact/selected.browser.test.ts',
        ],
        { cwd: root, stdio: 'inherit' },
      );
      if (vitest.status !== 0)
        console.error(`Vitest exited with ${vitest.status}; merging what ran.`);
    }
  } finally {
    rmSync(selection, { force: true });
  }
  const files = existsSync(written) ? readdirSync(written) : [];
  if (resolve(results) === resolve(written)) return files.map((file) => join(written, file));
  rmSync(results, { recursive: true, force: true });
  mkdirSync(results, { recursive: true });
  for (const file of files) copyFileSync(join(written, file), join(results, file));
  return files.map((file) => join(results, file));
}

const main = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const [command, ...rest] = main ? process.argv.slice(2) : [];
const option = (name) => {
  const at = rest.indexOf(name);
  return at >= 0 ? rest[at + 1] : undefined;
};
const positionals = rest.filter(
  (arg, i) => !arg.startsWith('--') && !['--out', '--base-ref'].includes(rest[i - 1] ?? ''),
);

if (!main) {
  // Imported: the exports only.
} else if (command === 'snapshot') {
  await snapshot(ROOT, resolve(option('--out') ?? join(DIR, 'snapshot.json')));
} else if (command === 'compare') {
  const ref = option('--base-ref');
  const [first, second] = positionals;
  const base = ref ? join(DIR, 'base.json') : first && resolve(first);
  const given = ref ? first : second;
  if (!base)
    fail(
      'Usage: node scripts/impact.mjs compare (<base.json> | --base-ref <ref>) [<head.json>] [--run]',
    );
  if (ref) await snapshotRef(ref, base);
  const head = given ? resolve(given) : join(DIR, 'head.json');
  if (!given) await snapshot(ROOT, head);
  const report = join(DIR, 'report.json');
  const markdown = join(DIR, 'report.md');
  let result = cli(['compare', base, head, '--json', report, '--markdown', markdown]);
  if (rest.includes('--run')) {
    const files = runSelected(ROOT, report);
    result = cli([
      'compare',
      base,
      head,
      ...files.flatMap((file) => ['--results', file]),
      '--json',
      report,
      '--markdown',
      markdown,
    ]);
  }
  console.log(result.stdout);
  console.log(`Report: ${relative(ROOT, report)}, ${relative(ROOT, markdown)}`);
  process.exitCode = result.status ?? 0;
} else {
  fail(
    'Usage: node scripts/impact.mjs snapshot [--out <file>] | compare (<base.json> | --base-ref <ref>) [<head.json>] [--run]',
  );
}
