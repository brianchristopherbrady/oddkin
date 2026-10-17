#!/usr/bin/env node
// Packs every publishable workspace package, installs the tarballs into a fresh
// consumer outside the workspace, and verifies runtime imports, declarations,
// and the installed dependency graph. Run after `npm run build`.
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  names.push({ name: manifest.name, dir: join(packagesDir, entry.name) });
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
  const unexpected = new Set();
  const walk = (deps = {}) => {
    for (const [dep, info] of Object.entries(deps)) {
      if (!dep.startsWith('@mote/')) unexpected.add(dep);
      walk(info.dependencies);
    }
  };
  walk(installed.dependencies);
  if (unexpected.size)
    failures.push(`unexpected runtime dependencies installed: ${[...unexpected].join(', ')}`);

  const imports = names
    .map(({ name }, i) => `import { packageName as p${i} } from '${name}';`)
    .join('\n');
  const checks = names
    .map(({ name }, i) => `if (p${i} !== '${name}') throw new Error('${name} mismatch');`)
    .join('\n');
  await writeFile(join(consumer, 'runtime.mjs'), `${imports}\n${checks}\n`);
  node(['runtime.mjs'], consumer);

  await writeFile(
    join(consumer, 'types.ts'),
    `${imports}\nexport const all: string[] = [${names.map((_, i) => `p${i}`).join(', ')}];\n`,
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
  `Packed-consumer verification OK: ${names.map((p) => p.name).join(', ')} installed from tarballs outside the workspace; runtime imports and declarations resolve; no third-party runtime dependencies.`,
);
