// Production builds for packages that ship development diagnostics.
// For every workspace package with dist/internal/dev.js, writes dist/prod/** from the tsc
// output: the `DEV` import is removed, `DEV` is defined as false, and dead branches are
// dropped per file (module structure, specifiers, and public exports stay identical).
// Package exports map "development" to dist/ and "default" to dist/prod/.
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const DEV_IMPORT = /^import \{ DEV \} from '(?:\.\.?\/)+(?:internal\/)?dev\.js';\r?\n/m;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith('.js')) yield path;
  }
}

export async function buildProduction(packageDir) {
  const dist = join(packageDir, 'dist');
  const prod = join(dist, 'prod');
  await rm(prod, { recursive: true, force: true });
  let files = 0;
  for await (const file of walk(dist)) {
    if (file.startsWith(prod)) continue;
    const rel = relative(dist, file);
    let code = await readFile(file, 'utf8');
    const usesDev = DEV_IMPORT.test(code);
    if (rel.replace(/\\/g, '/') === 'internal/dev.js') code = 'export const DEV = false;\n';
    else if (usesDev) code = code.replace(DEV_IMPORT, '');
    const result = await transform(code, {
      loader: 'js',
      format: 'esm',
      target: 'es2024',
      minifySyntax: true,
      define: usesDev ? { DEV: 'false' } : {},
      sourcefile: rel,
    });
    if (usesDev && /\bDEV\b/.test(result.code)) {
      throw new Error(`${file}: DEV still referenced after the production transform`);
    }
    const out = join(prod, rel);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, result.code);
    files++;
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const group of ['packages']) {
    for (const name of await readdir(join(root, group))) {
      const dir = join(root, group, name);
      if (!existsSync(join(dir, 'dist', 'internal', 'dev.js'))) continue;
      const files = await buildProduction(dir);
      console.log(`production build: ${group}/${name} (${files} modules)`);
    }
  }
}
