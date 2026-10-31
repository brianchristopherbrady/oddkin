// The golden path (P0.5): one scenario through the whole system from packed packages, as teams
// would run it (sources in tests/golden-path/):
//   repo/       a library team's npm workspaces, with the packed Oddkin packages installed:
//     library/  its theme config built to CSS by `oddkin-tokens`; two elements on @oddkin/core
//               compiled by tsc; their metadata, examples included, from `oddkin-analyze`; its
//               agent kit from `oddkin-kit`, beside the team's AGENTS.md; then packed like any
//               package;
//     site/     the library's Workbench site from `oddkin workbench build`: the catalog, each
//               element's live preview, and Theme Studio on the library's theme;
//   app/        another team's application on the library's tarball, with the router, state, and
//               an AI element, type-checked and bundled by Vite. The kits its packages ship are
//               checked there: regenerated from the installed packages, and every import they
//               name resolved.
// scripts/packed-consumers.mjs runs it for /golden-path/ (the app, with the site under site/), and
// e2e/golden-path.spec.ts checks both.
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

// The AGENTS.md the library team wrote; `oddkin-kit agents-md --write` must keep this text.
const AGENTS_NOTES = '# Acme widgets\n\nNotes the team wrote for coding agents, kept as written.\n';

// Run in the app: every import specifier the kits name (registration entries, classes, and entry
// points, in the guides and references) resolved through the installed packages' exports.
const RESOLVE_KIT_IMPORTS = `import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const names = process.argv.slice(2);
const result = { checked: 0, unresolved: [] };
for (const name of names) {
  const dir = join('node_modules', ...name.split('/'), 'agent');
  const refs = join(dir, 'references');
  const texts = [
    join(dir, 'GUIDE.md'),
    ...readdirSync(refs, { recursive: true })
      .filter((file) => file.endsWith('.md'))
      .map((file) => join(refs, file)),
  ];
  const specifiers = new Set();
  for (const file of texts)
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(/(?:import|from) '([^'<>]+)'/g))
      specifiers.add(spec);
  for (const spec of specifiers) {
    result.checked++;
    try {
      import.meta.resolve(spec);
    } catch (error) {
      result.unresolved.push(name + ': ' + spec + ' (' + error.code + ')');
    }
  }
}
console.log(JSON.stringify(result));
`;

// Run in the library team's repository (it has the packed @oddkin/workbench): the examples each
// package publishes in its metadata, checked against the manifest it publishes, as installed in
// the app. Correct examples give no diagnostic; each explained mistake gives the one it declares.
const CHECK_PUBLISHED_EXAMPLES = `import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkExamples, validateUsage } from '@oddkin/workbench/examples';
const [modules, ...names] = process.argv.slice(2);
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const report = {};
for (const name of names) {
  const dir = join(modules, ...name.split('/'));
  const manifest = read(join(dir, 'package.json'));
  const metadata = read(join(dir, 'oddkin.metadata.json'));
  const cem = read(join(dir, manifest.customElements.replace(/^\\.\\//, '')));
  const declarations = cem.modules.flatMap((m) => m.declarations ?? []).filter((d) => d.tagName);
  const sets = new Map();
  let computed = 0;
  for (const example of Object.values(metadata.examples ?? {})) {
    // An example whose values are computed has no literal definition to check.
    if (!example.definition) {
      computed++;
      continue;
    }
    const tag = example.component.replace(/^component:/, '');
    const set = sets.get(tag) ?? { component: tag, examples: {} };
    set.examples[example.name] = example.definition;
    sets.set(tag, set);
  }
  const problems = [];
  let checked = 0;
  let mistakes = 0;
  for (const set of sets.values()) {
    const declaration = declarations.find((d) => d.tagName === set.component);
    if (!declaration) {
      problems.push(set.component + ': not in the manifest');
      continue;
    }
    const fields = (declaration.members ?? []).filter(
      (m) => m.kind === 'field' && !m.static && !m.readonly,
    );
    const slots = (declaration.slots ?? []).map((s) => s.name);
    for (const d of checkExamples(set, { properties: fields.map((m) => m.name), slots }))
      problems.push(set.component + ': ' + d.code + ' at ' + d.path);
    const found = validateUsage(set, {
      properties: fields.map((m) => ({ name: m.name, type: m.type?.text, attribute: m.attribute })),
      slots,
    });
    for (const [example, definition] of Object.entries(set.examples)) {
      checked++;
      if (definition.incorrect) mistakes++;
      const codes = found.filter((d) => d.path?.startsWith('/examples/' + example + '/')).map((d) => d.code);
      const expected = definition.incorrect ? [definition.incorrect.diagnostic] : [];
      if (codes.join() !== expected.join())
        problems.push(set.component + '/' + example + ': ' + (codes.join() || 'none') + ', expected ' + (expected.join() || 'none'));
    }
  }
  report[name] = { checked, mistakes, computed, problems };
}
console.log(JSON.stringify(report));
`;

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
  // 5. The library's agent kit, written from its metadata into library/agent/ (which its "files"
  // list) before it is packed, and the managed section of the team's AGENTS.md.
  const kit = await bin(repo, '@oddkin/analyzer', 'oddkin-kit');
  await step('kit', [kit, 'package'], repo);
  await writeFile(join(repo, 'AGENTS.md'), AGENTS_NOTES);
  await step('agents-md', [kit, 'agents-md', '--write'], repo);
  const agentsMd = await readFile(join(repo, 'AGENTS.md'), 'utf8');
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
  // 5, on the app's side: each kit its packages ship comes out file for file from the installed
  // package (the library team's packed oddkin-kit), and every import a kit names resolves.
  const shipped = ['@acme/widgets', '@oddkin/ai', '@oddkin/components'];
  const check = ['package', '--check', '--root', app, ...shipped.flatMap((n) => ['--package', n])];
  await step('kit-check', [kit, ...check], app);
  await writeFile(join(app, 'kit-imports.mjs'), RESOLVE_KIT_IMPORTS);
  const imports = JSON.parse(await run([join(app, 'kit-imports.mjs'), ...shipped], app));
  // The examples those packages publish, against the manifests installed in the app.
  await writeFile(join(repo, 'check-examples.mjs'), CHECK_PUBLISHED_EXAMPLES);
  const examples = JSON.parse(
    await run([join(repo, 'check-examples.mjs'), join(app, 'node_modules'), ...shipped], repo),
  );
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
    kit: {
      shipped,
      imports,
      examples,
      agentsMd: {
        kept: agentsMd.startsWith(AGENTS_NOTES),
        managed:
          agentsMd.includes('<!-- oddkin:agents:begin') && agentsMd.includes('@acme/widgets'),
      },
    },
    steps,
  };
}
