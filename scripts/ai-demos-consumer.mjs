// The @oddkin/ai demonstrations from packed packages (P0.4): a fresh project installs the packed
// core, tokens, components, and ai, and esbuild, as an application would. Each demo
// (examples/<demo>: index.html, styles.css, src/) is bundled by the project's esbuild against the
// installed packages (their default, production export conditions), with the published token CSS
// and layout.css beside the bundle, as scripts/build-ai-demos.mjs builds them in the workspace.
// The packed-consumers server serves them at /ai-demos/<demo>/; /ai-demos/__ready reports the
// installed packages and each bundle's input files (e2e/ai-demos.spec.ts).
import { cp, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEMOS } from './build-ai-demos.mjs';
import { onlyTarballs } from './workbench-consumer.mjs';

const FILES = ['index.html', 'styles.css', 'src'];
const CSS = {
  'tokens.css': '../../packages/tokens/dist/css/default.css',
  'layout.css': '../../packages/components/dist/css/layout.css',
};

/** Build the project in `site`; `helpers` come from scripts/packed-consumers.mjs. */
export async function buildAiDemosConsumer(site, helpers) {
  const { root, oddkin, tool, freshProject, installedIn, publishedFile, run } = helpers;
  await freshProject(site, [
    ...(await Promise.all(['core', 'tokens', 'components', 'ai'].map(oddkin))),
    await tool('esbuild'),
  ]);
  if (helpers.tarballs) await onlyTarballs(site);
  const esbuild = join(site, 'node_modules', 'esbuild', 'bin', 'esbuild');
  const bundles = {};
  for (const demo of DEMOS) {
    const dir = join(site, demo);
    for (const file of FILES)
      await cp(join(root, 'examples', demo, file), join(dir, file), { recursive: true });
    await mkdir(join(dir, 'dist'), { recursive: true });
    await run(
      [
        esbuild,
        'src/main.js',
        '--bundle',
        '--minify',
        '--format=esm',
        '--target=es2024',
        '--platform=browser',
        '--legal-comments=none',
        '--log-level=error',
        '--outfile=dist/main.js',
        '--metafile=meta.json',
      ],
      dir,
    );
    // Only files the packages publish: publishedFile throws for any other.
    for (const [name, path] of Object.entries(CSS))
      await cp(join(site, await publishedFile(site, path)), join(dir, 'dist', name));
    const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
    bundles[demo] = Object.keys(meta.inputs).sort();
  }
  return {
    site,
    installed: (await installedIn(site)).filter((name) => name.startsWith('@oddkin/')),
    bundles,
  };
}
