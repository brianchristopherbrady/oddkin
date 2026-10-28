#!/usr/bin/env node
// Packs every publishable workspace package, installs the tarballs into a fresh
// consumer outside the workspace, and verifies runtime imports, declarations,
// and the installed dependency graph. Run after `npm run build`.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import boundaries from './architecture/boundaries.config.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
// Run npm through its CLI script with the current Node binary: no shell, so paths
// with spaces and argument escaping behave the same on every platform.
const npmCli = process.env['npm_execpath']?.endsWith('.js')
  ? process.env['npm_execpath']
  : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const node = (args, cwd) =>
  execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const npm = (args, cwd) => node([npmCli, ...args], cwd);

const packagesDir = join(root, 'packages');
const names = [];
for (const entry of await readdir(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = JSON.parse(
    await readFile(join(packagesDir, entry.name, 'package.json'), 'utf8'),
  );
  // Every JavaScript export is imported from the installed tarball; assets are checked below.
  const target = (value) => (typeof value === 'string' ? value : value?.default);
  const specifiers = Object.entries(manifest.exports ?? {})
    .filter(([, value]) => /\.m?js$/.test(target(value) ?? ''))
    .map(([key]) => (key === '.' ? manifest.name : `${manifest.name}/${key.slice(2)}`));
  names.push({ name: manifest.name, dir: join(packagesDir, entry.name), specifiers });
}

const work = await mkdtemp(join(tmpdir(), 'oddkin-packs-'));
const failures = [];
const cemConsumers = [];
let contractCount = 0;
const sizes = [];
const kits = [];
try {
  const tarballs = [];
  for (const { name, dir } of names) {
    const [info] = JSON.parse(npm(['pack', '--json', '--pack-destination', work], dir));
    const files = info.files.map((file) => file.path);
    const leaked = files.filter((file) => file.startsWith('src/') || file.startsWith('test/'));
    if (leaked.length) failures.push(`${name}: tarball includes ${leaked.join(', ')}`);
    if (!files.some((file) => file.startsWith('dist/')))
      failures.push(`${name}: tarball has no dist/ (run npm run build)`);
    if (name === '@oddkin/core')
      for (const file of ['CONTRACTS.md', 'contracts.json'])
        if (!files.includes(file)) failures.push(`${name}: tarball has no ${file}`);
    // A package that lists `agent` ships its version-matched agent kit (ADR 0046 D6).
    const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    // Release hygiene (docs/release-process.md §3).
    for (const file of ['LICENSE', 'README.md'])
      if (!files.includes(file)) failures.push(`${name}: tarball has no ${file}`);
    const directory = relative(root, dir).split(sep).join('/');
    if (manifest.license !== 'MIT') failures.push(`${name}: license is ${manifest.license}`);
    if (!manifest.description) failures.push(`${name}: no description`);
    if (manifest.type !== 'module') failures.push(`${name}: type is not "module"`);
    if (manifest.sideEffects === undefined) failures.push(`${name}: sideEffects is not declared`);
    if (manifest.repository?.directory !== directory)
      failures.push(`${name}: repository.directory is not ${directory}`);
    for (const [key, value] of Object.entries(manifest.exports ?? {}))
      if (
        /\.m?js$/.test(typeof value === 'string' ? value : (value?.default ?? '')) &&
        !value?.types
      )
        failures.push(`${name}: export ${key} has no types`);
    const agentBytes = info.files
      .filter((file) => file.path.startsWith('agent/'))
      .reduce((sum, file) => sum + file.size, 0);
    if (manifest.files?.includes('agent')) {
      for (const file of ['agent/GUIDE.md', 'agent/kit.json', 'agent/llms.txt'])
        if (!files.includes(file))
          failures.push(`${name}: tarball has no ${file} (run npm run build)`);
      kits.push(name);
    }
    sizes.push(
      `${name} ${(info.size / 1024).toFixed(1)} KiB${agentBytes ? ` (agent kit ${(agentBytes / 1024).toFixed(1)} KiB unpacked)` : ''}`,
    );
    tarballs.push(join(work, info.filename));
  }

  const consumer = join(work, 'consumer');
  await mkdir(consumer);
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' }),
  );
  npm(['install', '--no-audit', '--no-fund', '--ignore-scripts', ...tarballs], consumer);

  const installed = JSON.parse(npm(['ls', '--all', '--json'], consumer));
  // Third-party packages may appear only beneath Node-only tooling packages (e.g. the analyzer's
  // TypeScript dependency), never beneath browser packages.
  const nodeOnly = new Set(
    Object.entries(boundaries.packages)
      .filter(([, rule]) => rule.kind === 'node')
      .map(([name]) => name),
  );
  const unexpected = new Set();
  const walk = (deps = {}, underTooling = false) => {
    for (const [dep, info] of Object.entries(deps)) {
      if (!dep.startsWith('@oddkin/') && !underTooling) unexpected.add(dep);
      walk(info.dependencies, underTooling || nodeOnly.has(dep));
    }
  };
  walk(installed.dependencies);
  if (unexpected.size)
    failures.push(`unexpected runtime dependencies installed: ${[...unexpected].join(', ')}`);

  const specifiers = names.flatMap(({ specifiers }) => specifiers);
  const imports = specifiers.map((spec, i) => `import * as p${i} from '${spec}';`).join('\n');
  // Registration entries (`…/define/…`) export nothing by design; they must still load.
  const checks = specifiers
    .map((spec, i) =>
      /\/define(\/|$)/.test(spec)
        ? ''
        : `if (Object.keys(p${i}).length === 0) throw new Error('${spec} has no exports');`,
    )
    .join('\n');
  await writeFile(join(consumer, 'runtime.mjs'), `${imports}\n${checks}\n`);
  node(['runtime.mjs'], consumer);

  // Published assets: token CSS and schema, component metadata; the installed tokens CLI works.
  await writeFile(
    join(consumer, 'assets.mjs'),
    [
      "import { readFileSync } from 'node:fs';",
      'const expected = {',
      "  '@oddkin/tokens/css/default.css': '--odd-color-action-default',",
      "  '@oddkin/tokens/schema.json': 'Oddkin theme configuration',",
      '  \'@oddkin/tokens/inspect/default.json\': \'"cssVariable": "--odd-space-md"\',',
      '  \'@oddkin/tokens/inspect/default.contrast.json\': \'"id": "color.text.primary|color.canvas|light"\',',
      '  \'@oddkin/components/custom-elements.json\': \'"tagName": "odd-button"\',',
      '  \'@oddkin/components/oddkin.metadata.json\': \'"registration": "@oddkin/components/define/button"\',',
      '};',
      'for (const [spec, needle] of Object.entries(expected)) {',
      "  const text = readFileSync(new URL(import.meta.resolve(spec)), 'utf8');",
      "  if (!text.includes(needle)) throw new Error(spec + ' content mismatch');",
      '}',
    ].join('\n'),
  );
  node(['assets.mjs'], consumer);

  // Each packed agent kit matches the packed metadata it was generated from, keeps its guide within
  // budget, and lists only files it ships.
  await writeFile(
    join(consumer, 'kits.mjs'),
    [
      "import { createHash } from 'node:crypto';",
      "import { existsSync, readFileSync } from 'node:fs';",
      "import { dirname, join } from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      `for (const name of ${JSON.stringify(kits)}) {`,
      "  const dir = dirname(fileURLToPath(import.meta.resolve(name + '/package.json')));",
      "  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));",
      "  const kit = JSON.parse(readFileSync(join(dir, 'agent', 'kit.json'), 'utf8'));",
      "  if (kit.library.name !== name || kit.library.version !== pkg.version) throw new Error(name + ': kit is for ' + kit.library.name + '@' + kit.library.version);",
      "  const hash = createHash('sha256').update(readFileSync(join(dir, kit.metadata.file))).digest('hex');",
      "  if (hash !== kit.metadata.sha256) throw new Error(name + ': agent kit does not match the packed ' + kit.metadata.file);",
      "  const guide = Buffer.byteLength(readFileSync(join(dir, 'agent', kit.guide.path), 'utf8'));",
      "  if (guide !== kit.guide.bytes || guide > kit.guide.budgetBytes) throw new Error(name + ': GUIDE.md is ' + guide + ' bytes (budget ' + kit.guide.budgetBytes + ')');",
      "  for (const entry of kit.entries) if (!existsSync(join(dir, 'agent', entry.path))) throw new Error(name + ': kit lists missing ' + entry.path);",
      '}',
    ].join('\n'),
  );
  node(['kits.mjs'], consumer);

  // Contract ids resolve offline to the installed @oddkin/core's own CONTRACTS.md and version.
  await writeFile(
    join(consumer, 'contracts.mjs'),
    [
      "import { readFileSync } from 'node:fs';",
      "import { contractIndex, resolveContract } from '@oddkin/analyzer';",
      "const index = contractIndex('@oddkin/core', process.cwd());",
      "if (!index) throw new Error('@oddkin/core/contracts.json does not resolve');",
      "const installed = JSON.parse(readFileSync(new URL(import.meta.resolve('@oddkin/core/package.json')), 'utf8'));",
      'const ids = Object.keys(index.contracts);',
      "if (ids.length === 0) throw new Error('no contracts in contracts.json');",
      'for (const id of ids) {',
      '  const contract = resolveContract(id, process.cwd());',
      "  if (!contract || !contract.text.includes('Id: `' + id + '`')) throw new Error(id + ' has no section');",
      "  if (contract.version !== installed.version || !contract.path.includes('node_modules')) throw new Error(id + ' did not resolve to the installed package');",
      '}',
      'console.log(ids.length);',
    ].join('\n'),
  );
  contractCount = Number(node(['contracts.mjs'], consumer).trim());

  // An independent CEM consumer (the VS Code custom-data generator, not Oddkin code) reads the
  // manifest each installed package names in `customElements`; editors would get every
  // element, attribute, CSS property, and part.
  const { getVsCodeCssCustomData, getVsCodeHtmlCustomData } =
    await import('custom-element-vs-code-integration');
  for (const { name } of names) {
    const dir = join(consumer, 'node_modules', ...name.split('/'));
    const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    if (!manifest.customElements) continue;
    const cem = JSON.parse(await readFile(join(dir, manifest.customElements), 'utf8'));
    const html = JSON.parse(getVsCodeHtmlCustomData(cem, { hideLogs: true }));
    const css = JSON.parse(getVsCodeCssCustomData(cem, { hideLogs: true }));
    const tags = new Map(html.tags.map((tag) => [tag.name, tag]));
    const cssNames = new Set([...css.properties, ...css.pseudoElements].map((item) => item.name));
    const elements = cem.modules
      .flatMap((module) => module.declarations ?? [])
      .filter((declaration) => declaration.customElement && declaration.tagName);
    for (const element of elements) {
      const tag = tags.get(element.tagName);
      if (!tag) {
        failures.push(`${name}: custom data has no <${element.tagName}>`);
        continue;
      }
      const attributes = new Set(tag.attributes.map((attribute) => attribute.name));
      const missing = [
        ...(element.attributes ?? []).filter((a) => !attributes.has(a.name)).map((a) => a.name),
        ...(element.cssProperties ?? []).filter((p) => !cssNames.has(p.name)).map((p) => p.name),
        ...(element.cssParts ?? [])
          .filter((p) => !cssNames.has(`::part(${p.name})`))
          .map((p) => `::part(${p.name})`),
      ];
      if (missing.length)
        failures.push(`${name}: custom data for <${element.tagName}> lacks ${missing.join(', ')}`);
    }
    if (name === '@oddkin/components') {
      const appearance = tags
        .get('odd-button')
        ?.attributes.find((attribute) => attribute.name === 'appearance');
      const values = (appearance?.values ?? []).map((value) => value.name).join(',');
      if (values !== 'primary,secondary,ghost')
        failures.push(`custom data for odd-button appearance has values "${values}"`);
    }
    cemConsumers.push(`${name} (${elements.length} elements)`);
  }
  const bin = join(consumer, 'node_modules', '@oddkin', 'tokens', 'dist', 'node', 'bin.js');
  node([bin, 'init', 'theme.json'], consumer);
  node([bin, 'build', 'theme.json', '--out', 'tokens', '--strict'], consumer);
  // The installed analyzer runs from its tarball (Node-only tooling with its own TypeScript).
  node(
    [join(consumer, 'node_modules', '@oddkin', 'analyzer', 'dist', 'bin.js'), '--help'],
    consumer,
  );
  const built = await readdir(join(consumer, 'tokens'));
  for (const file of [
    'default.css',
    'default.refs.ts',
    'default.values.ts',
    'default.inspect.json',
    'default.contrast.json',
  ]) {
    if (!built.includes(file))
      failures.push(`oddkin-tokens build in a consumer did not write ${file}`);
  }

  await writeFile(
    join(consumer, 'types.ts'),
    [
      imports,
      `export const all: readonly object[] = [${specifiers.map((_, i) => `p${i}`).join(', ')}];`,
      // Typed refs: the default theme's token names are a closed union.
      "import { token, tokenVariable } from '@oddkin/tokens/refs';",
      "export const refs: string[] = [token('color.action.default'), tokenVariable('space.md')];",
      '// @ts-expect-error -- not a token of the default theme',
      "export const unknownRef = token('color.action.nope');",
      '',
    ].join('\n'),
  );
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        lib: ['ES2023', 'DOM'],
      },
      files: ['types.ts'],
    }),
  );
  node([join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'], consumer);

  // Opt-in React typings from the installed tarballs: registering imports bring the tag names,
  // and a mistyped prop fails. Framework types come from the workspace (no network install).
  await writeFile(
    join(consumer, 'jsx.tsx'),
    [
      "import type {} from '@oddkin/components/frameworks/react';",
      "import type {} from '@oddkin/components/define/side-nav';",
      "import type {} from '@oddkin/ai/define/prompt-input';",
      'export const nav = <odd-side-nav label="Primary" onodd-action={(e) => e.detail.action.trim()} />;',
      'export const prompt = <odd-prompt-input onodd-prompt-submit={(e) => e.detail.text.trim()} />;',
      '// @ts-expect-error -- unknown property',
      'export const wrong = <odd-side-nav itemz={1} />;',
    ].join('\n'),
  );
  // Vue and Svelte typings from the installed tarballs, through the types their checkers read.
  await writeFile(
    join(consumer, 'frameworks.ts'),
    [
      "import type {} from '@oddkin/components/frameworks/vue';",
      "import type {} from '@oddkin/components/frameworks/svelte';",
      "import type {} from '@oddkin/components/define/side-nav';",
      "import type { GlobalComponents } from 'vue';",
      "import type { SvelteHTMLElements } from 'svelte/elements';",
      "type VueNav = InstanceType<GlobalComponents['odd-side-nav']>['$props'];",
      "type SvelteNav = SvelteHTMLElements['odd-side-nav'];",
      "export const vue: VueNav = { label: 'Primary', onOddAction: (e) => void e.detail.action.trim() };",
      "export const svelte: SvelteNav = { label: 'Primary', 'onodd-action': (e) => void e.detail.action.trim() };",
      '// @ts-expect-error -- items is an array of entries',
      'export const wrongVue: VueNav = { items: 1 };',
      '// @ts-expect-error -- items is an array of entries',
      'export const wrongSvelte: SvelteNav = { items: 1 };',
    ].join('\n'),
  );
  const types = join(root, 'node_modules', '@types', 'react');
  await writeFile(
    join(consumer, 'tsconfig.jsx.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        jsx: 'react-jsx',
        lib: ['ES2023', 'DOM'],
        types: [],
        paths: {
          react: [join(types, 'index.d.ts')],
          'react/jsx-runtime': [join(types, 'jsx-runtime.d.ts')],
          vue: [join(root, 'node_modules', 'vue', 'dist', 'vue.d.mts')],
          'svelte/elements': [join(root, 'node_modules', 'svelte', 'elements.d.ts')],
        },
      },
      files: ['jsx.tsx', 'frameworks.ts'],
    }),
  );
  node(
    [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.jsx.json'],
    consumer,
  );
} catch (error) {
  failures.push(String(error.stderr || error.stdout || error.message).trim());
} finally {
  await rm(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`Packed-consumer verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `Packed-consumer verification OK: ${names.map((p) => p.name).join(', ')} installed from tarballs outside the workspace; each tarball has LICENSE and README.md, and each manifest its licence, description, repository directory, module type, sideEffects, and types for every JavaScript export; runtime imports and declarations resolve; typed token refs reject an unknown name; React, Vue, and Svelte typings type-check from the installed packages; no third-party runtime dependencies outside Node-only tooling; ${contractCount} core contracts resolve offline from the installed package; an independent CEM consumer (custom-element-vs-code-integration) read ${cemConsumers.join(' and ')}; agent kits match their packed metadata in ${kits.join(' and ')}. Tarballs: ${sizes.join('; ')}.`,
);
