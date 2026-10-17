#!/usr/bin/env node
// Packs every publishable workspace package, installs the tarballs into a fresh
// consumer outside the workspace, and verifies runtime imports, declarations,
// and the installed dependency graph. Run after `npm run build`.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
  // Packages without a root entry (e.g. @mote/workbench) are checked through their subpaths.
  const subpaths = Object.keys(manifest.exports ?? {}).filter((key) => key !== './package.json');
  const specifiers = subpaths.includes('.')
    ? [manifest.name]
    : subpaths.map((key) => `${manifest.name}/${key.slice(2)}`);
  names.push({ name: manifest.name, dir: join(packagesDir, entry.name), specifiers });
}

const work = await mkdtemp(join(tmpdir(), 'mote-packs-'));
const failures = [];
try {
  const tarballs = [];
  for (const { name, dir } of names) {
    const [info] = JSON.parse(npm(['pack', '--json', '--pack-destination', work], dir));
    const files = info.files.map((file) => file.path);
    const leaked = files.filter((file) => file.startsWith('src/') || file.startsWith('test/'));
    if (leaked.length) failures.push(`${name}: tarball includes ${leaked.join(', ')}`);
    if (!files.some((file) => file.startsWith('dist/')))
      failures.push(`${name}: tarball has no dist/ (run npm run build)`);
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
      if (!dep.startsWith('@mote/') && !underTooling) unexpected.add(dep);
      walk(info.dependencies, underTooling || nodeOnly.has(dep));
    }
  };
  walk(installed.dependencies);
  if (unexpected.size)
    failures.push(`unexpected runtime dependencies installed: ${[...unexpected].join(', ')}`);

  const specifiers = names.flatMap(({ specifiers }) => specifiers);
  const imports = specifiers.map((spec, i) => `import * as p${i} from '${spec}';`).join('\n');
  const checks = specifiers
    .map(
      (spec, i) =>
        `if (Object.keys(p${i}).length === 0) throw new Error('${spec} has no exports');`,
    )
    .join('\n');
  await writeFile(join(consumer, 'runtime.mjs'), `${imports}\n${checks}\n`);
  node(['runtime.mjs'], consumer);

  // @mote/tokens ships its CLI, default CSS, and JSON Schema, and the installed CLI works.
  await writeFile(
    join(consumer, 'assets.mjs'),
    [
      "import { readFileSync } from 'node:fs';",
      "for (const spec of ['@mote/tokens/css/default.css', '@mote/tokens/schema.json']) {",
      "  const text = readFileSync(new URL(import.meta.resolve(spec)), 'utf8');",
      "  if (!text.includes(spec.endsWith('.css') ? '--mote-color-action-default' : 'Mote theme configuration')) throw new Error(spec + ' content mismatch');",
      '}',
    ].join('\n'),
  );
  node(['assets.mjs'], consumer);
  const bin = join(consumer, 'node_modules', '@mote', 'tokens', 'dist', 'node', 'bin.js');
  node([bin, 'init', 'theme.json'], consumer);
  node([bin, 'build', 'theme.json', '--out', 'tokens', '--strict'], consumer);
  // The installed analyzer runs from its tarball (Node-only tooling with its own TypeScript).
  node([join(consumer, 'node_modules', '@mote', 'analyzer', 'dist', 'bin.js'), '--help'], consumer);
  const built = await readdir(join(consumer, 'tokens'));
  for (const file of [
    'default.css',
    'default.refs.ts',
    'default.values.ts',
    'default.inspect.json',
  ]) {
    if (!built.includes(file))
      failures.push(`mote-tokens build in a consumer did not write ${file}`);
  }

  await writeFile(
    join(consumer, 'types.ts'),
    `${imports}\nexport const all: readonly object[] = [${specifiers.map((_, i) => `p${i}`).join(', ')}];\n`,
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
  `Packed-consumer verification OK: ${names.map((p) => p.name).join(', ')} installed from tarballs outside the workspace; runtime imports and declarations resolve; no third-party runtime dependencies outside Node-only tooling.`,
);
