// The golden path (P0.5): one scenario through the whole system from packed packages, as teams
// would run it (sources in tests/golden-path/):
//   repo/       a library team's npm workspaces, with the packed Oddkin packages installed:
//     library/  its theme config built to CSS by `oddkin-tokens`; two elements on @oddkin/core
//               compiled by tsc; their metadata, examples included, from `oddkin-analyze`; then
//               packed like any package;
//     site/     the library's Workbench site from `oddkin workbench build`: the catalog, each
//               element's live preview, and Theme Studio on the library's theme;
//   app/        another team's application on the library's tarball, with the router, state, and
//               an AI element, type-checked and bundled by Vite.
// scripts/packed-consumers.mjs runs it for /golden-path/ (the app, with the site under site/), and
// e2e/golden-path.spec.ts checks both. Still to come: the library's agent kit (P0.5's step 5).
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

/**
 * Build the projects in `work`, the site for `base` (the app's URL path). The helpers come from
 * scripts/packed-consumers.mjs: `oddkin(name)` is the install spec of a packed package (or of the
 * registry version under test, when `tarballs` is false), `tool(name)` a build tool's, `install`
 * installs specs into a project, `freshProject` empties a directory first, `installedIn` lists a
 * project's packages, `filesUnder` a directory's files, and `run` / `npm` run node scripts.
 */
export async function buildGoldenPath(work, base, helpers) {
  const { root, oddkin, tool, install, freshProject, installedIn, filesUnder, run, npm } = helpers;
  const source = join(root, 'tests/golden-path');
  const specs = (names) => Promise.all(names.map(oddkin));
  const steps = [];
  const step = async (name, args, cwd) => {
    const started = Date.now();
    await run(args, cwd);
    steps.push({ name, ms: Date.now() - started });
  };

  // The library team's workspaces: the library and its site, with the Oddkin packages they use.
  const repo = join(work, 'repo');
  await mkdir(repo, { recursive: true });
  const workspaces = ['library', 'site'];
  await writeFile(
    join(repo, 'package.json'),
    JSON.stringify({ name: 'acme', private: true, type: 'module', workspaces }),
  );
  for (const dir of workspaces) await cp(join(source, dir), join(repo, dir), { recursive: true });
  await install(repo, [
    ...(await specs(['core', 'tokens', 'components', 'state', 'app', 'analyzer', 'workbench'])),
    await tool('typescript'),
  ]);
  if (helpers.tarballs) await onlyTarballs(repo);

  // 1–3. The library: the theme's CSS, the compiled elements, and their metadata; then a tarball.
  const library = join(repo, 'library');
  const theme = ['build', 'theme.json', '--out', 'dist/theme', '--format', 'css', '--strict'];
  await step('theme', [await bin(repo, '@oddkin/tokens', 'oddkin-tokens'), ...theme], library);
  await step('compile', [join(repo, 'node_modules/typescript/bin/tsc'), '-p', '.'], library);
  const analyzer = await bin(repo, '@oddkin/analyzer', 'oddkin-analyze');
  const analyze = ['tsconfig.json', '--out', '.', '--no-history', '--strict'];
  await step('analyze', [analyzer, ...analyze], library);
  const [pack] = JSON.parse(await npm(['pack', '--json', '--pack-destination', work], library));
  const tarball = join(work, pack.filename);

  // 4. The site: Workbench documents the library from the workspace, examples included.
  const build = ['workbench', 'build', '--out', 'dist', '--base', `${base}site/`];
  const workbench = await bin(repo, '@oddkin/workbench', 'oddkin');
  await step('site', [workbench, ...build], join(repo, 'site'));

  // 6. The app: another team installs the library's tarball and bundles with Vite.
  const app = join(work, 'app');
  await freshProject(app, [
    ...(await specs(['core', 'tokens', 'components', 'state', 'app', 'ai'])),
    tarball,
    await tool('vite'),
    await tool('typescript'),
  ]);
  if (helpers.tarballs) await onlyTarballs(app);
  await cp(join(source, 'app'), app, { recursive: true });
  await step('check', [join(app, 'node_modules/typescript/bin/tsc'), '-p', '.'], app);
  const vite = join(app, 'node_modules/vite/bin/vite.js');
  await step('bundle', [vite, 'build', '--base', './', '--outDir', 'dist', '--emptyOutDir'], app);
  const dist = join(app, 'dist');
  const files = await filesUnder(dist);
  await cp(join(repo, 'site/dist'), join(dist, 'site'), { recursive: true });

  const manifest = JSON.parse(await readFile(join(library, 'custom-elements.json'), 'utf8'));
  const css = await readFile(join(library, 'dist/theme/acme.css'), 'utf8');
  return {
    site: dist,
    installed: (await installedIn(app)).filter((name) => /^@(oddkin|acme)\//.test(name)),
    imports: {},
    files,
    library: {
      files: pack.files.map((file) => file.path).sort(),
      elements: manifest.modules
        .flatMap((module) => module.declarations ?? [])
        .flatMap((declaration) => (declaration.tagName ? [declaration.tagName] : []))
        .sort(),
      brand: /--odd-ref-brand-600:\s*([^;]+);/.exec(css)?.[1],
    },
    steps,
  };
}
