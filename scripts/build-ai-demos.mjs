// Production static builds of the @oddkin/ai demonstrations. Each demo's src/main.js is bundled
// with the packages' default (production) export conditions into examples/<demo>/dist/main.js,
// next to the token CSS, so examples/<demo>/ is a self-contained static site: no backend, no
// credentials, no import maps. Run after `npm run build`.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const DEMOS = ['ai-research', 'ai-writing', 'ai-agent'];

for (const demo of DEMOS) {
  const dir = join(root, 'examples', demo);
  const out = join(dir, 'dist');
  await mkdir(out, { recursive: true });
  const result = await build({
    absWorkingDir: root,
    entryPoints: [join(dir, 'src/main.js')],
    outfile: join(out, 'main.js'),
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
  });
  await copyFile(join(root, 'packages/tokens/dist/css/default.css'), join(out, 'tokens.css'));
  const bytes = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0);
  console.log(`demo ${demo}: ${bytes} B (minified)`);
}
