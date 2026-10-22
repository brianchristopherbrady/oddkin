// Bundles each consumer with esbuild, so each bundle carries its own copy of @oddkin/core (and of
// the button module): two independently built applications on one page. Run after `npm run build`.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

/** The two bundles, development builds (diagnostic messages kept). Writes dist/ when `write`. */
export async function bundleConsumers({ write = false } = {}) {
  const bundles = {};
  for (const name of ['a', 'b']) {
    const result = await build({
      absWorkingDir: root,
      entryPoints: [join(here, 'src', `consumer-${name}.js`)],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      conditions: ['development'],
      logLevel: 'warning',
    });
    bundles[name] = result.outputFiles[0].text;
  }
  if (write) {
    await mkdir(join(here, 'dist'), { recursive: true });
    for (const [name, code] of Object.entries(bundles))
      await writeFile(join(here, 'dist', `consumer-${name}.js`), code);
  }
  return bundles;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await bundleConsumers({ write: true });
