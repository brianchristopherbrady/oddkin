// Streaming from a real endpoint, from packed packages (P0.4): a fresh project installs the packed
// core, tokens, components, and ai, copies examples/ai-stream, maps the page's imports to the
// installed packages (rewriting the CSP hash of the import map), and runs the example's own
// server, which answers in the AI SDK UI message stream format, on PORT. The packed-consumers
// server also serves the page under /ai-stream/ (without the API); /ai-stream/__ready reports the
// URL of the example's server for e2e/ai-stream.spec.ts.
import { spawn } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onlyTarballs } from './workbench-consumer.mjs';

/** The example server's port: the next after the docs site's 4177. */
export const PORT = 4178;
const FILES = ['index.html', 'main.js', 'styles.css', 'server.mjs', 'responses.json'];

/** Start the example's server in `dir` and resolve with its URL once it serves the page. */
async function start(dir) {
  const url = `http://127.0.0.1:${PORT}/`;
  const args = ['server.mjs', '--port', String(PORT), '--host', '127.0.0.1'];
  const child = spawn(process.execPath, args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  // The server stops with this process (packed-consumers stops on SIGINT/SIGTERM by exiting).
  process.on('exit', () => child.kill());
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(`server.mjs exited (${child.exitCode}):\n${output}`);
    try {
      if ((await fetch(url)).ok) return url;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`server.mjs did not answer on ${url} within 30 s:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Build the project in `site`; `helpers` come from scripts/packed-consumers.mjs. */
export async function buildAiStreamConsumer(site, helpers) {
  const { root, oddkin, freshProject, installedIn, importMap, withImportMap, publishedFile } =
    helpers;
  await freshProject(site, await Promise.all(['core', 'tokens', 'components', 'ai'].map(oddkin)));
  if (helpers.tarballs) await onlyTarballs(site);
  for (const file of FILES) await cp(join(root, 'examples/ai-stream', file), join(site, file));
  let html = await readFile(join(site, 'index.html'), 'utf8');
  const map = await importMap([join(site, 'main.js')], {
    modules: join(site, 'node_modules'),
    pageDir: site,
  });
  html = withImportMap(html, map.imports);
  for (const [, href] of html.matchAll(/href="([^"]+)"/g))
    html = html.replace(`href="${href}"`, `href="${await publishedFile(site, href)}"`);
  if (html.includes('../../'))
    throw new Error('ai-stream: index.html still references the workspace');
  await writeFile(join(site, 'index.html'), html);
  return {
    site,
    installed: (await installedIn(site)).filter((name) => name.startsWith('@oddkin/')),
    ...map,
    url: await start(site),
  };
}
