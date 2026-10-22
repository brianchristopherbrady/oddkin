/**
 * `oddkin workbench dev`: serves the shell, the data files, and package files from one origin
 * (workbench.md §2.1), watches the inputs, rebuilds, and pushes updates over Server-Sent Events.
 * An invalid edit keeps the last valid data and reports what is wrong.
 */
import { watch, type FSWatcher } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, dirname, extname, isAbsolute, join, relative } from 'node:path';
import type { WorkbenchDiagnostic } from '../internal/diagnostics.js';
import { CONFIG_FILES } from './config.js';
import { writeGenerated } from './generated.js';
import { DOCS_FILES } from './inputs.js';
import { ASSET_DIR, buildWorkbench, formatDiagnostic, type WorkbenchBuild } from './workbench.js';

export const DEFAULT_PORT = 4175;

export interface DevServerOptions {
  /** A configuration file or the directory holding it. Default: the working directory. */
  readonly config?: string;
  /** Default 4175; 0 picks a free port. */
  readonly port?: number;
  /** Default `localhost`, bound to both loopback addresses and not reachable from other machines. */
  readonly host?: string;
  /** Watch the inputs and push updates. Default true. */
  readonly watch?: boolean;
  readonly log?: (line: string) => void;
}

/** What one rebuild changed, as sent to the shell (`event: update`). */
export interface UpdateEvent {
  /** False when the new configuration or data is invalid; the last valid data stays served. */
  readonly ok: boolean;
  readonly index: boolean;
  /** Ids of pages whose data changed, appeared, or disappeared. */
  readonly pages: readonly string[];
  /** `name@version` of packages whose files (other than data inputs) changed. */
  readonly modules: readonly string[];
  /** The shell page changed (its import map or stylesheets): reload it. */
  readonly shell: boolean;
  readonly diagnostics: readonly WorkbenchDiagnostic[];
}

export interface DevServer {
  /** `http://host:port<base>`. */
  readonly url: string;
  /** The build being served (the last valid one). */
  readonly build: WorkbenchBuild;
  /** Rebuild now, as a watched change does. */
  rebuild(changed?: readonly string[]): Promise<UpdateEvent>;
  close(): Promise<void>;
}

export class DevServerError extends Error {
  constructor(
    message: string,
    readonly diagnostics: readonly WorkbenchDiagnostic[],
  ) {
    super(message);
    this.name = 'DevServerError';
  }
}

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const inside = (file: string, dir: string) => {
  const rel = relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

const OUTPUT = ['.oddkin', 'workbench'];

export async function startDevServer(options: DevServerOptions = {}): Promise<DevServer> {
  const log = options.log ?? (() => {});
  const buildOptions = { ...(options.config ? { config: options.config } : {}), events: true };
  let current = await buildWorkbench(buildOptions);
  const config = current.config;
  if (!current.data || !config)
    throw new DevServerError('The Workbench could not be built.', current.diagnostics);
  const base = config.hosting.basePath;
  const routing = config.hosting.routing;
  await writeGenerated(join(current.root, ...OUTPUT), current.files);

  const clients = new Set<ServerResponse>();
  const send = (res: ServerResponse, status: number, type: string, body: string | Buffer) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(body);
  };
  const notFound = (res: ServerResponse) =>
    send(res, 404, 'text/plain; charset=utf-8', 'Not found');

  async function packageFile(req: IncomingMessage, res: ServerResponse, path: string) {
    let segments: string[];
    try {
      segments = path.split('/').map(decodeURIComponent);
    } catch {
      return notFound(res);
    }
    const scoped = segments[0]?.startsWith('@');
    const key = scoped ? `${segments[0]}/${segments[1]}` : segments[0];
    const rest = segments.slice(scoped ? 2 : 1);
    const dir = key ? current.packages.get(key) : undefined;
    const unsafe = rest.some(
      (s) => s === '' || s === '.' || s === '..' || s === 'node_modules' || /[\\/:\0]/.test(s),
    );
    if (!dir || rest.length === 0 || unsafe) return notFound(res);
    let file: string;
    try {
      file = await realpath(join(dir, ...rest));
    } catch {
      return notFound(res);
    }
    const info = inside(file, dir) ? await stat(file) : undefined;
    if (!info?.isFile()) return notFound(res);
    const etag = `W/"${info.size}-${Math.trunc(info.mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag, 'cache-control': 'no-cache' }).end();
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
      etag,
    });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  }

  function events(req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' }).end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    if (base !== '/' && path === base.slice(0, -1)) {
      res.writeHead(308, { location: `${base}${url.search}` }).end();
      return;
    }
    if (!path.startsWith(base)) return notFound(res);
    const rest = path.slice(base.length);
    if (rest.startsWith(ASSET_DIR)) {
      const asset = rest.slice(ASSET_DIR.length);
      if (asset === 'events') return events(req, res);
      if (asset.startsWith('m/')) return packageFile(req, res, asset.slice(2));
      const file = current.files.get(asset);
      return file === undefined
        ? notFound(res)
        : send(res, 200, TYPES[extname(asset).toLowerCase()] ?? 'application/octet-stream', file);
    }
    // History mode serves the shell for every page path, as a host with rewrites does; hash
    // mode serves it only at the entry, as a static host without rewrites does.
    const entry = rest === '' || rest === 'index.html';
    const html = (req.headers.accept ?? '').includes('text/html');
    if (!entry && (routing === 'hash' || !html)) return notFound(res);
    send(res, 200, TYPES['.html'] as string, current.shell as string);
  }

  const handleRequest = (req: IncomingMessage, res: ServerResponse) => {
    handle(req, res).catch((error: unknown) => {
      log(`error ${req.url}: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  };
  const host = options.host ?? 'localhost';
  const servers: Server[] = [];
  const listen = (server: Server, port: number, address: string) =>
    new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, address, () => {
        server.off('error', reject);
        resolve();
      });
    });
  let port = options.port ?? DEFAULT_PORT;
  try {
    const addresses = host === 'localhost' ? ['127.0.0.1', '::1'] : [host];
    for (const address of addresses) {
      const server = createServer(handleRequest);
      servers.push(server);
      await listen(server, port, address);
      if (options.port === undefined || options.port === 0)
        port = (server.address() as AddressInfo).port;
    }
  } catch (error) {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            if (server.listening) {
              server.close(() => resolve());
              server.closeAllConnections();
            } else resolve();
          }),
      ),
    );
    throw error;
  }
  const url = `http://${host.includes(':') ? `[${host}]` : host}:${port}${base}`;

  // Watching: package directories recursively; the configuration's directory and the
  // directories of authored content and data files outside packages, by file name.
  const watchers = new Map<string, FSWatcher>();
  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<unknown> = Promise.resolve();
  let closed = false;

  const changed = (path: string) => {
    if (closed) return;
    pending.add(path);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const paths = [...pending];
      pending = new Set();
      running = running
        .then(() => update(paths))
        .catch((error: unknown) =>
          log(`error: rebuild failed: ${error instanceof Error ? error.message : String(error)}`),
        );
    }, 80);
  };

  function watchTargets(build: WorkbenchBuild): Map<string, (name: string) => boolean> {
    const targets = new Map<string, (name: string) => boolean>();
    const packages = build.inputs?.graph ?? [];
    const ignored = new Set(['node_modules', '.oddkin', '.git']);
    for (const pkg of packages)
      targets.set(`r:${pkg.dir}`, (name) => !name.split(/[\\/]/).some((s) => ignored.has(s)));
    const names = new Set<string>([...CONFIG_FILES, ...DOCS_FILES]);
    const files = [
      ...(build.configFile ? [build.configFile] : []),
      ...(build.inputs?.contentFiles ?? []),
      ...(build.inputs?.dataFiles ?? []).filter((f) => !packages.some((p) => inside(f, p.dir))),
    ];
    for (const file of files) names.add(basename(file));
    for (const dir of new Set([build.root, ...files.map((file) => dirname(file))]))
      targets.set(`d:${dir}`, (name) => names.has(name));
    return targets;
  }

  function rewatch(build: WorkbenchBuild) {
    if (options.watch === false) return;
    const targets = watchTargets(build);
    for (const [key, watcher] of watchers)
      if (!targets.has(key)) {
        watcher.close();
        watchers.delete(key);
      }
    for (const [key, accept] of targets) {
      if (watchers.has(key)) continue;
      const dir = key.slice(2);
      try {
        const watcher = watch(dir, { recursive: key.startsWith('r:') }, (_event, name) => {
          if (name && accept(String(name))) changed(join(dir, String(name)));
        });
        watcher.on('error', (error) => {
          log(`warning: stopped watching ${dir}: ${error.message}`);
          watcher.close();
          watchers.delete(key);
        });
        watchers.set(key, watcher);
      } catch (error) {
        log(
          `warning: cannot watch ${dir}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  const broadcast = (event: UpdateEvent) => {
    const text = `event: update\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(text);
  };

  async function update(paths: readonly string[] = []): Promise<UpdateEvent> {
    const next = await buildWorkbench(buildOptions);
    const dataFiles = new Set([
      ...(next.inputs?.dataFiles ?? []),
      ...(current.inputs?.dataFiles ?? []),
    ]);
    const modules = new Set<string>();
    for (const path of paths) {
      if (dataFiles.has(path)) continue;
      for (const pkg of current.inputs?.graph ?? [])
        if (inside(path, pkg.dir)) modules.add(`${pkg.name}@${pkg.version}`);
    }
    let event: UpdateEvent;
    if (
      !next.data ||
      !next.config ||
      next.config.hosting.basePath !== base ||
      next.config.hosting.routing !== routing
    ) {
      const restart: WorkbenchDiagnostic[] =
        next.config &&
        (next.config.hosting.basePath !== base || next.config.hosting.routing !== routing)
          ? [
              {
                code: 'node.dev.restart',
                severity: 'error',
                message:
                  'hosting.basePath or hosting.routing changed; restart the dev server to apply it.',
              },
            ]
          : [];
      event = {
        ok: false,
        index: false,
        pages: [],
        modules: [...modules],
        shell: false,
        diagnostics: [...restart, ...next.diagnostics],
      };
    } else {
      const pages = new Set<string>();
      const before = current.data?.index.pages ?? {};
      const after = next.data.index.pages;
      for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
        const file = after[id] ?? before[id];
        if (file && current.files.get(file) !== next.files.get(file)) pages.add(id);
      }
      try {
        await writeGenerated(join(next.root, ...OUTPUT), next.files);
      } catch (error) {
        log(`error: ${error instanceof Error ? error.message : String(error)}`);
      }
      event = {
        ok: true,
        index: current.files.get('index.json') !== next.files.get('index.json'),
        pages: [...pages],
        modules: [...modules],
        shell: current.shell !== next.shell,
        diagnostics: next.diagnostics,
      };
      current = next;
      rewatch(current);
    }
    if (!closed) broadcast(event);
    const what = event.ok
      ? [
          event.index && 'index',
          event.pages.length && `${event.pages.length} page(s)`,
          event.modules.length && `modules of ${event.modules.join(', ')}`,
          event.shell && 'shell',
        ]
          .filter(Boolean)
          .join(', ') || 'nothing changed'
      : `kept the last valid data (${event.diagnostics.filter((d) => d.severity === 'error').length} error(s))`;
    log(`update: ${what}`);
    for (const d of event.diagnostics) if (d.severity === 'error') log(formatDiagnostic(d));
    return event;
  }

  rewatch(current);
  return {
    url,
    get build() {
      return current;
    },
    rebuild(paths = []) {
      const result = running.then(() => update(paths));
      running = result.catch(() => undefined);
      return result;
    },
    async close() {
      closed = true;
      clearTimeout(timer);
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
      await running.catch(() => {});
      for (const client of clients) client.end();
      clients.clear();
      await Promise.all(
        servers.map(
          (server) =>
            new Promise<void>((resolve) => {
              server.close(() => resolve());
              server.closeAllConnections();
            }),
        ),
      );
    },
  };
}
