// Workbench from packed packages (P0.3, M12): a fresh project installs the packed Workbench, the
// packed Oddkin components (an Oddkin library), and @plain/widgets (a library without Oddkin: a
// standard Custom Elements Manifest only, tests/consumers/workbench/plain-widgets), each from a
// tarball, and documents both with its oddkin.config.ts:
//   `oddkin-tokens init`      the theme Theme Studio edits;
//   `oddkin workbench build`  the static site, served by scripts/packed-consumers.mjs under
//                             /workbench/ (a subpath);
//   `oddkin workbench dev`    the dev server, started on DEV_PORT for the e2e to use.
// e2e/workbench-packed.spec.ts checks both.
import { spawn } from 'node:child_process';
import { cp, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The dev server's port: the last of the e2e ports (4173–4177) without a server of its own. */
export const DEV_PORT = 4176;

/** The file behind `command`, a bin of `pkg` installed in the project `dir`. */
async function bin(dir, pkg, command) {
  const pkgDir = join(dir, 'node_modules', ...pkg.split('/'));
  const manifest = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
  return join(pkgDir, manifest.bin[command]);
}

/** Throw if the project `dir` took an @oddkin package from the registry instead of a tarball. */
async function onlyTarballs(dir) {
  const lock = JSON.parse(await readFile(join(dir, 'package-lock.json'), 'utf8'));
  const fetched = Object.entries(lock.packages)
    .filter(([path, entry]) => /node_modules\/@oddkin\/[^/]+$/.test(path) && !entry.link)
    .filter(([, entry]) => !String(entry.resolved).startsWith('file:'))
    .map(([path, entry]) => `${path} (${entry.resolved})`);
  if (fetched.length) throw new Error(`${dir} installed from the registry: ${fetched.join(', ')}`);
}

/** Start `oddkin workbench dev` in `dir` and resolve once it serves its index. */
async function startDev(dir, workbench) {
  const url = `http://127.0.0.1:${DEV_PORT}/`;
  const args = [workbench, 'workbench', 'dev', '--port', String(DEV_PORT), '--host', '127.0.0.1'];
  const child = spawn(process.execPath, args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  // The server stops with this process (packed-consumers stops on SIGINT/SIGTERM by exiting).
  process.on('exit', () => child.kill());
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(`oddkin workbench dev exited (${child.exitCode}):\n${output}`);
    try {
      if ((await fetch(`${url}_oddkin/index.json`)).ok) return url;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`oddkin workbench dev did not answer on ${url} within 60 s:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * Build the project in `work` for `base` (its URL path on the packed-consumers server). The
 * helpers come from scripts/packed-consumers.mjs, as for the golden path: `oddkin(name)` is the
 * install spec of a packed package (or of the registry version under test, when `tarballs` is
 * false), `freshProject` installs specs into an emptied directory, `installedIn` lists a
 * project's packages, `filesUnder` a directory's files, and `run` / `npm` run node scripts.
 */
export async function buildWorkbenchConsumer(work, base, helpers) {
  const { root, oddkin, freshProject, installedIn, filesUnder, run, npm } = helpers;
  const source = join(root, 'tests/consumers/workbench');
  const [plain] = JSON.parse(
    await npm(['pack', '--json', '--pack-destination', work], join(source, 'plain-widgets')),
  );
  const project = join(work, 'project');
  const packages = ['core', 'tokens', 'components', 'state', 'app', 'analyzer', 'workbench'];
  await freshProject(project, [
    ...(await Promise.all(packages.map(oddkin))),
    join(work, plain.filename),
  ]);
  if (helpers.tarballs) await onlyTarballs(project);
  await cp(join(source, 'oddkin.config.ts'), join(project, 'oddkin.config.ts'));
  await run([await bin(project, '@oddkin/tokens', 'oddkin-tokens'), 'init'], project);
  const workbench = await bin(project, '@oddkin/workbench', 'oddkin');
  const build = ['workbench', 'build', '--out', 'dist', '--base', base];
  const built = await run([workbench, ...build], project);
  const dist = join(project, 'dist');
  return {
    site: dist,
    installed: (await installedIn(project)).filter((name) => /^@(oddkin|plain)\//.test(name)),
    imports: {},
    files: await filesUnder(dist),
    build: built.trim(),
    dev: await startDev(project, workbench),
  };
}
