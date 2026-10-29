// Bundles each consumer with esbuild, so each bundle carries its own copy of @oddkin/core (and of
// the button module): two independently built applications on one page. Run after `npm run build`.
// With `released`, consumer A is built from that version of the published packages instead,
// installed from npm into a project in the system temporary directory (once per version).
//
//   node examples/duplicate-core/build.mjs [--released 1.0.0-beta.0]
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
// npm's own script, run with this Node: set for npm scripts, else beside Node (Windows, POSIX).
const npmCli = [
  process.env['npm_execpath'],
  join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
].find((file) => file?.endsWith('.js') && existsSync(file));

/** Whether `dir` has the published components (and with them, core) at `version`. */
async function installedAt(dir, version) {
  const manifest = join(dir, 'node_modules/@oddkin/components/package.json');
  return existsSync(manifest) && JSON.parse(await readFile(manifest, 'utf8')).version === version;
}

/**
 * Consumer A's entry in a project with the published core and components at `version`. Parallel
 * test workers each install beside the shared project and move theirs into place; one wins.
 */
async function releasedEntry(version) {
  let dir = join(tmpdir(), `oddkin-duplicate-core-${version}`);
  if (!(await installedAt(dir, version))) {
    const staging = `${dir}-${process.pid}`;
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    await writeFile(
      join(staging, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    const packages = ['core', 'components'].map((name) => `@oddkin/${name}@${version}`);
    const args = ['install', '--no-audit', '--no-fund', '--ignore-scripts', ...packages];
    await promisify(execFile)(process.execPath, [npmCli, ...args], { cwd: staging });
    try {
      await rename(staging, dir);
    } catch {
      if (await installedAt(dir, version)) await rm(staging, { recursive: true, force: true });
      else dir = staging;
    }
  }
  // Each worker its own entry file: a copy another worker is writing is never read half-written.
  const entry = join(dir, `consumer-a.${process.pid}.js`);
  await copyFile(join(here, 'src', 'consumer-a.js'), entry);
  return entry;
}

/**
 * The two bundles, development builds (diagnostic messages kept). With `released`, consumer A
 * runs on that version of the published packages. Writes dist/ when `write`.
 */
export async function bundleConsumers({ write = false, released } = {}) {
  const bundles = {};
  for (const name of ['a', 'b']) {
    // Bundled from its own project, consumer A resolves the published packages, not the workspace.
    const entry = name === 'a' && released ? await releasedEntry(released) : undefined;
    const result = await build({
      absWorkingDir: entry ? dirname(entry) : root,
      entryPoints: [entry ?? join(here, 'src', `consumer-${name}.js`)],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      conditions: ['development'],
      logLevel: 'warning',
    });
    if (entry) await rm(entry, { force: true });
    bundles[name] = result.outputFiles[0].text;
  }
  if (write) {
    await mkdir(join(here, 'dist'), { recursive: true });
    for (const [name, code] of Object.entries(bundles))
      await writeFile(join(here, 'dist', `consumer-${name}.js`), code);
  }
  return bundles;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--released');
  await bundleConsumers({ write: true, released: at > -1 ? process.argv[at + 1] : undefined });
}
