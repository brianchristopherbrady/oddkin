import { readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { init, parse } from 'es-module-lexer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DiagnosticList } from '../src/internal/diagnostics.js';
import {
  buildWorkbench,
  findPackageDir,
  isPackageName,
  loadInputs,
  loadWorkbenchConfig,
  packageGraph,
  WORKBENCH_DIR,
} from '../src/node/index.js';
import type { ComponentPageData, FoundationPageData, WorkbenchIndex } from '../src/data/index.js';
import { acmeProject, makeProject, removeProject } from './node-project.js';

const projects: string[] = [];
const track = (dir: string) => (projects.push(dir), dir);
afterAll(() => projects.forEach(removeProject));
beforeAll(() => init);

// Loading TypeScript configs and reading real packages; allow for a busy machine.
describe('configuration loading', { timeout: 30_000 }, () => {
  it('loads oddkin.config.ts from a directory, with type annotations stripped', async () => {
    const dir = track(acmeProject());
    const loaded = await loadWorkbenchConfig(dir);
    expect(loaded.file).toBe(join(dir, 'oddkin.config.ts'));
    expect(loaded.root).toBe(dir);
    expect(loaded.config?.library.packages).toEqual(['@acme/ui']);
    expect(loaded.config?.hosting).toEqual({ basePath: '/', routing: 'history' });
    expect(loaded.diagnostics).toEqual([]);
  });

  it('prefers .ts over .json, and loads JSON and .mjs files named directly', async () => {
    const dir = track(
      makeProject({
        'oddkin.config.ts': "export default { library: { packages: ['a'] } };\n",
        'oddkin.config.json': '{ "library": { "packages": ["b"] } }',
        'other.mjs': "export default { library: { packages: ['c'] } };\n",
      }),
    );
    expect((await loadWorkbenchConfig(dir)).config?.library.packages).toEqual(['a']);
    const json = await loadWorkbenchConfig(join(dir, 'oddkin.config.json'));
    expect(json.config?.library.packages).toEqual(['b']);
    expect((await loadWorkbenchConfig(join(dir, 'other.mjs'))).config?.library.packages).toEqual([
      'c',
    ]);
  });

  it('reads an edited configuration again', async () => {
    const dir = track(
      makeProject({ 'oddkin.config.mjs': "export default { library: { packages: ['a'] } };\n" }),
    );
    expect((await loadWorkbenchConfig(dir)).config?.library.packages).toEqual(['a']);
    writeFileSync(
      join(dir, 'oddkin.config.mjs'),
      "export default { library: { packages: ['z'] } };\n",
    );
    expect((await loadWorkbenchConfig(dir)).config?.library.packages).toEqual(['z']);
  });

  it('explains a missing, failing, empty, or invalid configuration', async () => {
    const dir = track(
      makeProject({
        'throws/oddkin.config.mjs': "throw new Error('broken on purpose');\n",
        'nodefault/oddkin.config.mjs': 'export const config = {};\n',
        'invalid/oddkin.config.json': '{ "library": { "packages": [] }, "playground": true }',
        'typescript/oddkin.config.ts': "throw new Error('ts broken');\n",
        'empty/readme.txt': '',
      }),
    );
    const codes = async (path: string) =>
      (await loadWorkbenchConfig(join(dir, path))).diagnostics.map((d) => d.code);
    expect(await codes('empty')).toEqual(['node.config.missing']);
    expect(await codes('nowhere')).toEqual(['node.config.missing']);
    expect(await codes('throws')).toEqual(['node.config.load']);
    expect((await loadWorkbenchConfig(join(dir, 'throws'))).diagnostics[0]?.message).toContain(
      'broken on purpose',
    );
    expect((await loadWorkbenchConfig(join(dir, 'nodefault'))).diagnostics[0]?.message).toContain(
      'has no default export',
    );
    // A failing TypeScript file gets a hint about type stripping (Node's own refusal of
    // non-erasable syntax is checked through the built command, where Vite does not transform).
    const ts = await loadWorkbenchConfig(join(dir, 'typescript'));
    expect(ts.diagnostics[0]?.code).toBe('node.config.load');
    expect(ts.diagnostics[0]?.message).toContain('ts broken');
    expect(ts.diagnostics[0]?.message).toContain('erasable syntax only');
    expect((await loadWorkbenchConfig(join(dir, 'throws'))).diagnostics[0]?.message).not.toContain(
      'erasable',
    );
    const invalid = await loadWorkbenchConfig(join(dir, 'invalid'));
    expect(invalid.config).toBeUndefined();
    expect(invalid.diagnostics.map((d) => d.code)).toEqual([
      'config.key.unknown',
      'config.library.missing',
    ]);
  });
});

describe('package graphs', { timeout: 30_000 }, () => {
  it('finds packages up the tree and follows dependencies breadth first', () => {
    const dir = track(acmeProject());
    const out = new DiagnosticList();
    const graph = packageGraph(['@acme/ui'], dir, out);
    expect(out.items).toEqual([]);
    expect(graph.map((p) => `${p.name}@${p.version}`)).toEqual([
      '@acme/ui@1.4.0',
      '@acme/icons@2.1.0',
      '@acme/tokens@1.0.0',
    ]);
    expect(graph[0]?.dir).toBe(join(dir, 'node_modules', '@acme', 'ui'));
    // Looked up from a nested directory, the same package is found.
    expect(findPackageDir('@acme/ui', join(dir, 'node_modules', '@acme', 'ui', 'dist'))).toBe(
      graph[0]?.dir,
    );
  });

  it('prefers a nested copy for its dependent and keeps both copies in the graph', () => {
    const dir = track(
      acmeProject({
        'node_modules/@acme/ui/node_modules/@acme/icons/package.json':
          '{ "name": "@acme/icons", "version": "1.0.0", "exports": "./old.js" }',
        'node_modules/@acme/other/package.json':
          '{ "name": "@acme/other", "version": "1.0.0", "dependencies": { "@acme/icons": "2" } }',
      }),
    );
    const graph = packageGraph(['@acme/ui', '@acme/other'], dir, new DiagnosticList());
    expect(graph.map((p) => `${p.name}@${p.version}`)).toEqual([
      '@acme/ui@1.4.0',
      '@acme/other@1.0.0',
      '@acme/icons@1.0.0',
      '@acme/tokens@1.0.0',
      '@acme/icons@2.1.0',
    ]);
  });

  it('resolves linked packages to their real directory and visits each once', () => {
    const dir = track(acmeProject());
    const target = join(dir, 'node_modules', '@acme', 'icons');
    symlinkSync(target, join(dir, 'node_modules', 'icons-link'), 'junction');
    const graph = packageGraph(['icons-link', '@acme/icons'], dir, new DiagnosticList());
    expect(graph).toHaveLength(1);
    expect(graph[0]).toMatchObject({ name: 'icons-link', dir: target });
    expect(findPackageDir('icons-link', dir)).toBe(target);
  });

  it('reports missing packages: an error for a documented one, a warning for a dependency', () => {
    const dir = track(
      acmeProject({
        'node_modules/@acme/ui/package.json':
          '{ "name": "@acme/ui", "version": "1.4.0", "dependencies": { "@acme/gone": "1" }, "peerDependencies": { "@acme/gone": "1", "@acme/maybe": "1", "@acme/needed": "1" }, "peerDependenciesMeta": { "@acme/maybe": { "optional": true } } }',
      }),
    );
    const out = new DiagnosticList();
    packageGraph(['@acme/ui', '@acme/nope'], dir, out);
    expect(out.items.map((d) => `${d.severity} ${d.code} ${d.path}`)).toEqual([
      'error node.package.missing /library/packages/@acme/nope',
      'warning node.package.missing /packages/@acme/ui/dependencies/@acme/gone',
      'warning node.package.missing /packages/@acme/ui/dependencies/@acme/needed',
    ]);
  });

  it('skips Node-only packages and never treats unsafe names as paths', () => {
    const dir = track(acmeProject());
    const graph = packageGraph(['@acme/ui'], dir, new DiagnosticList(), { skip: ['@acme/tokens'] });
    expect(graph.map((p) => p.name)).toEqual(['@acme/ui', '@acme/icons']);
    for (const name of ['../x', '@acme/../x', '.hidden', '@a/b/c', 'a\\b', '', '@acme/.x'])
      expect(isPackageName(name), name).toBe(false);
    expect(findPackageDir('../package.json', dir)).toBeUndefined();
    expect(isPackageName('@oddkin/core')).toBe(true);
  });
});

describe('inputs and builds', { timeout: 60_000 }, () => {
  it('reads CEM, enrichment, the referenced token inspection, and authored content', async () => {
    const dir = track(
      acmeProject({
        'oddkin.docs.ts':
          "export default { pages: { 'components/acme-card': { summary: 'Authored summary.' } } };\n",
      }),
    );
    const { config } = await loadWorkbenchConfig(dir);
    const out = new DiagnosticList();
    const inputs = await loadInputs(dir, config!, out);
    expect(out.items).toEqual([]);
    expect(inputs.libraries).toHaveLength(1);
    expect(inputs.libraries[0]?.cem?.modules).toHaveLength(3);
    expect(inputs.libraries[0]?.metadata?.library?.prefix).toBe('acme-');
    expect(inputs.tokens?.tokens.map((t) => t.name)).toEqual(['space.sm', 'space.md']);
    expect(inputs.docs?.pages['components/acme-card']?.summary).toBe('Authored summary.');
    const ui = join(dir, 'node_modules', '@acme', 'ui');
    expect(inputs.dataFiles).toEqual([
      join(ui, 'custom-elements.json'),
      join(ui, 'oddkin.metadata.json'),
      join(dir, 'node_modules', '@acme', 'tokens', 'dist', 'acme.inspect.json'),
    ]);
    expect(inputs.contentFiles).toEqual([join(dir, 'oddkin.docs.ts')]);
  });

  it('diagnoses missing manifests, unattributed CEM, and unusable content', async () => {
    const dir = track(
      acmeProject({
        'oddkin.config.json': JSON.stringify({
          library: { packages: ['@acme/icons', '@acme/ui'], cem: ['./elsewhere.json'] },
          content: { files: ['docs.md', 'missing.json', 'bad.json', 'a.json', 'b.json'] },
        }),
        'docs.md': '# Docs\n',
        'bad.json': '{ "nopages": true }',
        'a.json':
          '{ "pages": { "foundations": { "title": "A" } }, "aliases": { "x": "a" }, "locale": "en" }',
        'b.json':
          '{ "pages": { "foundations": { "title": "B" } }, "aliases": { "x": "y", "z": "y" }, "locale": "fr" }',
        'elsewhere.json': '{ "modules": [] }',
        'node_modules/@acme/tokens/dist/acme.inspect.json': '{ not json',
      }),
    );
    const { config } = await loadWorkbenchConfig(join(dir, 'oddkin.config.json'));
    const out = new DiagnosticList();
    const inputs = await loadInputs(dir, config!, out);
    expect(out.items.map((d) => d.code)).toEqual([
      'node.cem.missing',
      'node.cem.unattributed',
      'node.tokens.invalid',
      'node.content.unsupported',
      'node.content.missing',
      'node.content.invalid',
      'node.content.duplicate',
    ]);
    expect(inputs.tokens).toBeUndefined();
    expect(inputs.docs?.pages['foundations']?.title).toBe('A');
    // The first file wins for pages, aliases, and the locale.
    expect(inputs.docs?.aliases).toEqual({ x: 'a', z: 'y' });
    expect(inputs.docs?.locale).toBe('en');
    // Every configured content file is watched, including the ones that failed.
    expect(inputs.contentFiles).toHaveLength(5);
  });

  it('takes a listed manifest inside a package that declares none', async () => {
    const dir = track(
      acmeProject({
        'oddkin.config.json': JSON.stringify({
          library: { packages: ['@acme/icons'], cem: ['node_modules/@acme/icons/elements.json'] },
        }),
        'node_modules/@acme/icons/elements.json': JSON.stringify({
          modules: [
            {
              path: 'index.js',
              declarations: [
                { kind: 'class', name: 'AcmeIcon', customElement: true, tagName: 'acme-icon' },
              ],
            },
          ],
        }),
      }),
    );
    const { config } = await loadWorkbenchConfig(join(dir, 'oddkin.config.json'));
    const out = new DiagnosticList();
    const inputs = await loadInputs(dir, config!, out);
    expect(out.items).toEqual([]);
    expect(inputs.libraries[0]?.cem?.modules[0]?.declarations?.[0]?.tagName).toBe('acme-icon');
    expect(inputs.dataFiles).toEqual([
      join(dir, 'node_modules', '@acme', 'icons', 'elements.json'),
    ]);
  });

  it('uses the first of several token inspections, and says so', async () => {
    const dir = track(acmeProject());
    const metadataFile = join(dir, 'node_modules', '@acme', 'ui', 'oddkin.metadata.json');
    const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));
    metadata.foundations['foundation:color'].generation = {
      value: { source: { package: '@acme/other-tokens', export: './inspect.json' } },
      provenance: 'extracted',
    };
    writeFileSync(metadataFile, JSON.stringify(metadata));
    const { config } = await loadWorkbenchConfig(dir);
    const out = new DiagnosticList();
    const inputs = await loadInputs(dir, config!, out);
    expect(out.items.map((d) => d.code)).toEqual(['node.tokens.sources']);
    expect(out.items[0]?.message).toContain('@acme/tokens/inspect.json is used');
    expect(inputs.tokens?.tokens).toHaveLength(2);
  });

  it('reads one default content file: the first of oddkin.docs.*', async () => {
    const dir = track(
      acmeProject({
        'oddkin.docs.ts': "export default { pages: { foundations: { title: 'From TS' } } };\n",
        'oddkin.docs.json': '{ "pages": { "foundations": { "title": "From JSON" } } }',
      }),
    );
    const { config } = await loadWorkbenchConfig(dir);
    const out = new DiagnosticList();
    const inputs = await loadInputs(dir, config!, out);
    expect(out.items).toEqual([]);
    expect(inputs.docs?.pages['foundations']?.title).toBe('From TS');
    expect(inputs.contentFiles).toEqual([join(dir, 'oddkin.docs.ts')]);
  });

  it('builds data, import maps, and the shell page for a library with dependencies', async () => {
    const dir = track(acmeProject());
    const build = await buildWorkbench({ config: dir, events: true });
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const index = JSON.parse(build.files.get('index.json')!) as WorkbenchIndex;
    expect(index.branding.name).toBe('Acme UI');
    for (const file of Object.values(index.pages)) expect(build.files.has(file)).toBe(true);
    const spacing = JSON.parse(
      build.files.get('pages/foundations/spacing.json')!,
    ) as FoundationPageData;
    expect(spacing.tokens.map((t) => t.value)).toEqual(['0.5rem', '1rem']);
    const button = JSON.parse(
      build.files.get('pages/components/acme-button.json')!,
    ) as ComponentPageData;
    expect(button.package).toBe('@acme/ui');
    // Frames load the library and its dependencies under versioned URLs.
    expect(build.frameImportMap?.imports).toEqual({
      '@acme/icons': '/_oddkin/m/@acme/icons@2.1.0/index.js',
      '@acme/tokens/inspect.json': '/_oddkin/m/@acme/tokens@1.0.0/dist/acme.inspect.json',
      '@acme/ui': '/_oddkin/m/@acme/ui@1.4.0/dist/index.js',
      '@acme/ui/define/button': '/_oddkin/m/@acme/ui@1.4.0/dist/define/button.js',
      '@acme/ui/oddkin.metadata.json': '/_oddkin/m/@acme/ui@1.4.0/oddkin.metadata.json',
    });
    expect(JSON.parse(build.files.get('frame.importmap.json')!)).toEqual(build.frameImportMap);
    expect(build.packages.get('@acme/ui@1.4.0')).toBe(join(dir, 'node_modules', '@acme', 'ui'));
    expect(build.packages.get('@oddkin/workbench@0.0.0')).toBe(WORKBENCH_DIR.replace(/[\\/]$/, ''));
    // The shell page: its own import map, the default theme's tokens, and the live-update stream.
    const shell = build.shell!;
    expect(shell).toContain('<title>Acme UI</title>');
    expect(shell).toContain(
      '<oddkin-workbench index="/_oddkin/index.json" events="/_oddkin/events">',
    );
    expect(shell).toContain('href="/_oddkin/m/@oddkin/tokens@0.0.0/dist/css/default.css"');
    const shellMap = JSON.parse(/<script type="importmap">(.*?)<\/script>/.exec(shell)![1]!);
    expect(shellMap.imports['@oddkin/app/router']).toBe(
      '/_oddkin/m/@oddkin/app@0.0.0/dist/router/index.js',
    );
    // Node-only dependencies never reach the shell.
    expect(Object.keys(shellMap.imports).some((k) => k.startsWith('@oddkin/analyzer'))).toBe(false);
    expect(Object.keys(shellMap.imports).some((k) => k.startsWith('typescript'))).toBe(false);
    expect([...build.packages.keys()].some((k) => k.startsWith('@oddkin/analyzer'))).toBe(false);
    expect(JSON.parse(build.files.get('shell.importmap.json')!)).toEqual(shellMap);
    // Without the dev server, the shell has no event stream.
    const quiet = await buildWorkbench({ config: dir });
    expect(quiet.shell).not.toContain('events=');
  });

  it('uses the base path in every URL, and reports what could not be built', async () => {
    const dir = track(
      acmeProject({
        'oddkin.config.json': JSON.stringify({
          library: { packages: ['@acme/ui', '@acme/missing'] },
          hosting: { basePath: '/docs/acme/' },
        }),
      }),
    );
    const build = await buildWorkbench({ config: join(dir, 'oddkin.config.json') });
    expect(build.frameImportMap?.imports['@acme/ui']).toBe(
      '/docs/acme/_oddkin/m/@acme/ui@1.4.0/dist/index.js',
    );
    expect(build.shell).toContain('index="/docs/acme/_oddkin/index.json"');
    const index = JSON.parse(build.files.get('index.json')!) as WorkbenchIndex;
    expect(index.diagnostics.map((d) => d.code)).toContain('node.package.missing');
    expect(build.diagnostics.map((d) => d.code)).toContain('node.package.missing');

    const invalid = await buildWorkbench({
      config: join(track(makeProject({ 'oddkin.config.json': '{}' })), 'oddkin.config.json'),
    });
    expect(invalid.data).toBeUndefined();
    expect(invalid.shell).toBeUndefined();
    expect(invalid.files.size).toBe(0);
    expect(invalid.diagnostics.map((d) => d.code)).toEqual(['config.library.missing']);
  });

  it('gives frames an import map that resolves every module the real components import', async () => {
    const build = await buildWorkbench({ config: 'tests/fixtures/workbench-oddkin' });
    expect(build.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const imports = build.frameImportMap!.imports;
    const resolves = (specifier: string) =>
      specifier in imports ||
      Object.keys(imports).some((key) => key.endsWith('/') && specifier.startsWith(key));
    // Every bare specifier in the library's built modules, from each registration entry outward.
    const toFile = (url: string) => {
      const [, key, rest] = /^\/_oddkin\/m\/((?:@[^/]+\/)?[^/]+)\/(.*)$/.exec(url)!;
      return join(build.packages.get(key!)!, ...rest!.split('/'));
    };
    const seen = new Set<string>();
    const pending = Object.entries(imports)
      .filter(([key]) => key.startsWith('@oddkin/components/define/'))
      .map(([, url]) => url);
    expect(pending).toHaveLength(4);
    const unresolved: string[] = [];
    for (let url = pending.pop(); url; url = pending.pop()) {
      if (seen.has(url)) continue;
      seen.add(url);
      const [found] = parse(readFileSync(toFile(url), 'utf8'));
      for (const { specifier } of found) {
        if (!specifier) continue;
        if (specifier.startsWith('.')) pending.push(new URL(specifier, `http://x${url}`).pathname);
        else if (!resolves(specifier)) unresolved.push(`${specifier} (from ${url})`);
        else if (specifier in imports) pending.push(imports[specifier]!);
      }
    }
    expect(unresolved).toEqual([]);
    expect(seen.size).toBeGreaterThan(20);
    // Each served module is a file inside its package.
    for (const url of seen) expect(statSync(toFile(url)).isFile(), url).toBe(true);
  });
});
