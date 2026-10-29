/**
 * Static build of the docs site, for GitHub Pages or any host that serves files:
 *   node apps/docs/build.mjs [--out <dir>]   (default .oddkin/docs-site; run after `npm run build`)
 *
 * Writes one document per route (authored pages in full, metadata routes as the shell the client
 * fills), 404.html for every other path, the docs app's own files, the reference pages' Workbench
 * data (_oddkin/) and preview frame (apps/docs/frame.html), and the published browser files
 * of the packages the pages load. Each document carries its Content-Security-Policy as a meta
 * element, with the import map allowed by its hash. The output directory is replaced only when it
 * is empty or was written by this script.
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { docsFacts, siteFacts } from './facts.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outIndex = process.argv.indexOf('--out');
const out = resolve(root, outIndex === -1 ? '.oddkin/docs-site' : process.argv[outIndex + 1]);
const MARKER = '.oddkin-docs-site';

/** Packages whose browser files the pages load; the analyzer runs only in Node. */
const BROWSER_PACKAGES = ['core', 'tokens', 'state', 'app', 'components', 'ai', 'workbench'];

const targetOf = (value) => (typeof value === 'string' ? value : value?.default);
const urlPath = (path) => path.split(sep).join('/');

async function prepareOut() {
  if (out === root || root.startsWith(out + sep))
    throw new Error(`Refusing to write the docs site to ${out}: it contains the repository.`);
  const existing = await readdir(out).catch(() => []);
  if (existing.length && !existing.includes(MARKER))
    throw new Error(
      `${out} is not empty and was not written by this script; choose another --out.`,
    );
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, MARKER), 'Written by apps/docs/build.mjs; replaced on every build.\n');
}

/** Copies the files under `from` that `keep` accepts, skipping Node-only `node` folders. */
async function copyTree(from, to, keep) {
  const entries = await readdir(from, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && keep(entry.name));
  if (files.length) await mkdir(to, { recursive: true });
  await Promise.all(files.map((entry) => copyFile(join(from, entry.name), join(to, entry.name))));
  let count = files.length;
  for (const entry of entries)
    if (entry.isDirectory() && entry.name !== 'node')
      count += await copyTree(join(from, entry.name), join(to, entry.name), keep);
  return count;
}

async function packages() {
  const imports = {};
  const assets = [];
  for (const dir of BROWSER_PACKAGES) {
    const base = join(root, 'packages', dir);
    const manifest = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'));
    for (const [name, value] of Object.entries(manifest.exports ?? {})) {
      const target = targetOf(value);
      if (!target || name.includes('*')) continue;
      const subpath = name === '.' ? '' : name.slice(2);
      if (/\.[cm]?js$/.test(target)) {
        if (target.split('/').includes('node')) continue;
        imports[subpath ? `${manifest.name}/${subpath}` : manifest.name] =
          `/${urlPath(join('packages', dir, target))}`;
      } else
        assets.push({ from: join(base, target), to: join(out, 'public', manifest.name, subpath) });
    }
  }
  return { imports, assets };
}

const html = (path) => join(out, ...path.split('/').filter(Boolean), 'index.html');

async function main() {
  const site = await import(pathToFileURL(join(root, 'apps/docs/dist/pages/index.js')).href);
  const facts = await docsFacts(root);
  const template = await readFile(join(root, 'apps/docs/index.html'), 'utf8');
  await prepareOut();

  // Reference pages (src/reference.ts): Workbench data with the packages' authored examples.
  const { buildWorkbench } = await import(
    pathToFileURL(join(root, 'packages/workbench/dist/node/index.js')).href
  );
  const reference = await buildWorkbench({
    config: join(root, 'apps/docs'),
    hosting: { basePath: '/' },
  });
  if (!reference.data)
    throw new Error(
      `The reference data could not be built: ${reference.diagnostics.map((d) => d.message).join(' ')}`,
    );
  const release = await siteFacts(root, reference.data.index);

  const { imports, assets } = await packages();
  const importMap = JSON.stringify({ imports }).replace(/</g, '\\u003c');
  const hash = createHash('sha256').update(importMap).digest('base64');
  const policy = [
    "default-src 'none'",
    `script-src 'self' 'sha256-${hash}'`,
    "style-src 'self'",
    "connect-src 'self'",
    "img-src 'self'",
    // Reference pages show live examples in same-origin frames (frame.html).
    "frame-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "require-trusted-types-for 'script'",
    'trusted-types oddkin-template',
  ].join('; ');
  const documentFor = (pathname) =>
    withPolicy(site.renderDocument(template, pathname, facts, release));
  const withPolicy = (document) =>
    document
      .replace(
        '<!-- docs:csp -->',
        `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      )
      .replace(
        '<script type="importmap" id="oddkin-import-map"></script>',
        `<script type="importmap">${importMap}</script>`,
      );

  const referenceFiles = [...reference.files.keys()]
    .filter((path) => path === 'index.json' || path.startsWith('pages/'))
    .sort();
  for (const path of referenceFiles) {
    const file = join(out, '_oddkin', ...path.split('/'));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, reference.files.get(path));
  }

  // Metadata routes: the shell, which the client renders from the published files.
  const metadata = JSON.parse(
    await readFile(join(root, 'packages/components/oddkin.metadata.json'), 'utf8'),
  );
  const routes = [
    ...site.pages.map((page) => `/${page.path}`),
    ...site.clientPages.map((page) => `/${page.path}`),
    ...reference.data.index.registry.pages
      .filter((page) => page.kind === 'component' && page.visible)
      .map((page) => page.route),
    ...Object.entries(metadata.foundations).map(
      ([key, value]) => `/foundations/${value.id ?? key.replace(/^foundation:/, '')}`,
    ),
    '/search',
  ];
  for (const route of new Set(routes)) {
    const file = html(route);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, documentFor(route));
  }
  await writeFile(join(out, '404.html'), documentFor('/404'));

  let files = 0;
  for (const dir of BROWSER_PACKAGES)
    files += await copyTree(
      join(root, 'packages', dir, 'dist'),
      join(out, 'packages', dir, 'dist'),
      (name) => /\.(?:js|css|json)$/.test(name),
    );
  for (const { from, to } of assets) {
    if (!(await stat(from).catch(() => null))?.isFile()) continue;
    await mkdir(dirname(to), { recursive: true });
    await copyFile(from, to);
    files++;
  }
  files += await copyTree(join(root, 'apps/docs/dist'), join(out, 'apps/docs/dist'), (name) =>
    name.endsWith('.js'),
  );
  for (const name of ['styles.css', 'mode.js', 'frame.css']) {
    await copyFile(join(root, 'apps/docs', name), join(out, 'apps/docs', name));
    files++;
  }
  await writeFile(
    join(out, 'apps/docs/frame.html'),
    withPolicy(await readFile(join(root, 'apps/docs/frame.html'), 'utf8')),
  );
  files += 1 + referenceFiles.length;
  console.log(
    `Docs site: ${new Set(routes).size} routes and 404.html, ${files} files, in ${urlPath(relative(root, out)) || '.'}`,
  );
}

await main();
