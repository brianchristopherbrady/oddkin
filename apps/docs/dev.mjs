import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { docsFacts, siteFacts } from './facts.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const portIndex = process.argv.indexOf('--port');
const port = portIndex === -1 ? 4177 : Number(process.argv[portIndex + 1]);
const host = '127.0.0.1';
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function targetOf(value) {
  return typeof value === 'string' ? value : value?.default;
}

async function publicExports() {
  const packages = await readdir(join(root, 'packages'), { withFileTypes: true });
  const imports = {};
  const manifests = new Map();
  for (const entry of packages) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, 'packages', entry.name);
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    manifests.set(manifest.name, { directory, manifest });
    for (const [name, target] of Object.entries(manifest.exports ?? {})) {
      const path = targetOf(target);
      if (!path || !/\.[cm]?js$/.test(path)) continue;
      const specifier = name === '.' ? manifest.name : `${manifest.name}/${name.slice(2)}`;
      imports[specifier] = `/${relativePackagePath(entry.name, path)}`;
    }
  }
  return { imports, manifests };
}

function relativePackagePath(packageName, target) {
  return join('packages', packageName, target).split(sep).join('/');
}

const { imports, manifests } = await publicExports();
const site = await import(pathToFileURL(join(root, 'apps/docs/dist/pages/index.js')).href);
const facts = await docsFacts(root);
const release = await siteFacts(root);
const shell = join(root, 'apps/docs/index.html');
// Reference pages (src/reference.ts): Workbench data with the packages' authored examples, built in Node.
const { buildWorkbench } = await import(
  pathToFileURL(join(root, 'packages/workbench/dist/node/index.js')).href
);
const reference = await buildWorkbench({
  config: join(root, 'apps/docs'),
  hosting: { basePath: '/' },
});

/** The shell filled for `pathname`; the server sends its policy as a header, not a meta element. */
const documentFor = (template, pathname) =>
  site.renderDocument(template, pathname, facts, release).replace('<!-- docs:csp -->', '');

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${host}:${port}`).pathname);
  } catch (error) {
    response.writeHead(400).end(`Invalid request path: ${String(error)}`);
    return;
  }

  let path;
  if (pathname.startsWith('/_oddkin/')) {
    const file = pathname.endsWith('.json')
      ? reference.files.get(pathname.slice('/_oddkin/'.length))
      : undefined;
    if (file === undefined) response.writeHead(404).end('Not found');
    else response.writeHead(200, { 'content-type': types['.json'] }).end(file);
    return;
  }
  if (pathname.startsWith('/public/')) {
    const parts = pathname.slice('/public/'.length).split('/');
    const packageName = parts.slice(0, 2).join('/');
    const subpath = parts.slice(2).join('/');
    const pkg = manifests.get(packageName);
    const exported = pkg?.manifest.exports?.[`./${subpath}`];
    const target = targetOf(exported);
    if (!pkg || !target || /\.(?:m?js)$/.test(target)) {
      response.writeHead(404).end('Not a published asset');
      return;
    }
    path = resolve(pkg.directory, target);
  } else {
    const requestPath = pathname === '/' ? '/apps/docs/index.html' : pathname;
    path = resolve(root, normalize(`.${requestPath}`));
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    } catch (error) {
      // Routes have no file extension; a missing asset (such as /favicon.ico) is a 404, not the shell.
      if (
        error?.code === 'ENOENT' &&
        !pathname.startsWith('/packages/') &&
        !pathname.startsWith('/apps/') &&
        !extname(pathname)
      ) {
        path = join(root, 'apps/docs/index.html');
      } else if (error?.code === 'ENOENT') {
        response.writeHead(404).end('Not found');
        return;
      } else {
        console.error(`Could not resolve ${pathname}`, error);
        response.writeHead(500).end('Unable to resolve file');
        return;
      }
    }
  }

  try {
    const body = await readFile(path);
    const nonce = randomBytes(18).toString('base64');
    const html = extname(path) === '.html';
    const text = html ? body.toString('utf8') : '';
    const page = path === shell ? documentFor(text, pathname) : text;
    const content = html
      ? page.replace(
          '<script type="importmap" id="oddkin-import-map"></script>',
          `<script type="importmap" nonce="${nonce}">${JSON.stringify({ imports }).replace(/</g, '\\u003c')}</script>`,
        )
      : body;
    response.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'content-security-policy': `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types oddkin-template`,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error?.code === 'ENOENT') response.writeHead(404).end('Not found');
    else {
      console.error(`Could not serve ${pathname}`, error);
      response.writeHead(500).end('Unable to serve file');
    }
  }
});

server.on('error', (error) => {
  console.error(`Docs server failed at http://${host}:${port}/`, error);
  process.exitCode = 1;
});
server.listen(port, host, () =>
  console.log(`Oddkin docs at http://${host}:${port}/ (imports resolved from package exports)`),
);
