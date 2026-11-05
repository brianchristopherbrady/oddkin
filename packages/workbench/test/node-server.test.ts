import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { EventEmitter } from 'node:events';
import { request } from 'node:http';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ThemeStudioPageData } from '../src/data/types.js';
import type { WorkbenchIndex } from '../src/data/index.js';
import {
  buildWorkbench,
  DevServerError,
  GeneratedDirectoryError,
  MARKER,
  startDevServer,
  type DevServer,
  type UpdateEvent,
} from '../src/node/index.js';
import { fromThisPage } from '../src/node/server.js';
import { acmeProject, removeProject } from './node-project.js';

// Every watcher the server starts, so a test can make one fail.
const watches = vi.hoisted(() => [] as { dir: string; watcher: EventEmitter }[]);
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const watch = ((dir: string, ...rest: unknown[]) => {
    const watcher = (fs.watch as (...args: unknown[]) => EventEmitter)(dir, ...rest);
    watches.push({ dir: String(dir), watcher });
    return watcher;
  }) as unknown as typeof fs.watch;
  return { ...fs, watch, default: { ...fs, watch } };
});

const projects: string[] = [];
const servers: DevServer[] = [];
/** `@oddkin/<name>@<version>` as module URLs name a workspace package. */
const oddkin = (name: string) =>
  `@oddkin/${name}@${(JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8')) as { version: string }).version}`;
afterAll(async () => {
  await Promise.all(servers.map((s) => s.close()));
  projects.forEach(removeProject);
});

async function serve(extra: Record<string, string> = {}, watch = true) {
  const dir = acmeProject(extra);
  projects.push(dir);
  const logs: string[] = [];
  const server = await startDevServer({
    config: dir,
    port: 0,
    watch,
    log: (line) => logs.push(line),
  });
  servers.push(server);
  const get = (path: string, init: RequestInit = {}) => fetch(new URL(path, server.url), init);
  return { dir, server, get, logs };
}

const html = { headers: { accept: 'text/html,application/xhtml+xml' } };

/** An HTTP request with exactly these headers (fetch decides `origin` and `host` itself). */
function send(
  url: URL,
  init: { method: string; headers: Record<string, string>; body: string },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(Object.entries(init.headers).filter(([, v]) => v !== ''));
    const req = request(url, { method: init.method, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (text += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }));
    });
    // A refused oversized body may reset the connection before the reply is read.
    req.on('error', reject);
    req.end(init.body);
  });
}

/** Read `update` events from the live-update stream, skipping rebuilds that changed nothing. */
async function subscribe(url: string) {
  const controller = new AbortController();
  const response = await fetch(new URL('_oddkin/events', url), { signal: controller.signal });
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  const read = async (ms: number) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no event within ${ms} ms`)), ms);
    });
    try {
      return await Promise.race([reader.read(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    response,
    async next(ms = 15_000): Promise<UpdateEvent> {
      for (;;) {
        const end = buffer.indexOf('\n\n');
        if (end !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (!/^event: update$/m.test(block) || !data) continue;
          const event = JSON.parse(data) as UpdateEvent;
          const noop =
            event.ok &&
            !event.index &&
            !event.shell &&
            !event.pages.length &&
            !event.modules.length;
          if (!noop) return event;
          continue;
        }
        const { value, done } = await read(ms);
        if (done) throw new Error('the stream ended');
        buffer += value;
      }
    },
    /** Resolves true once the server ends the stream. */
    async ended(ms = 10_000) {
      for (;;) if ((await read(ms)).done) return true;
    },
    close: () => controller.abort(),
  };
}

describe('workbench dev server', { timeout: 60_000 }, () => {
  it('serves the shell for page paths, the data files, and package files', async () => {
    const { server, get } = await serve({}, false);
    expect(server.url).toMatch(/^http:\/\/localhost:\d+\/$/);
    const port = new URL(server.url).port;
    expect((await fetch(`http://127.0.0.1:${port}/`, html)).status).toBe(200);
    expect((await fetch(`http://[::1]:${port}/`, html)).status).toBe(200);
    const shell = await get('', html);
    expect(shell.status).toBe(200);
    expect(shell.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const page = await shell.text();
    expect(page).toContain(
      '<oddkin-workbench index="/_oddkin/index.json" events="/_oddkin/events">',
    );
    // History mode: a deep link gets the shell, as from a host with rewrites; non-page requests do not.
    expect(await (await get('components/acme-button', html)).text()).toBe(page);
    expect((await get('index.html', html)).status).toBe(200);
    expect((await get('components/acme-button')).status).toBe(404);
    expect((await get('favicon.ico', { headers: { accept: 'image/*' } })).status).toBe(404);

    const index = await get('_oddkin/index.json');
    expect(index.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(index.headers.get('cache-control')).toBe('no-cache');
    const data = (await index.json()) as WorkbenchIndex;
    expect(data.branding.name).toBe('Acme UI');
    expect(
      await (await get(`_oddkin/${data.pages['components/acme-button']}`)).json(),
    ).toMatchObject({
      id: 'components/acme-button',
      kind: 'component',
    });
    expect(await (await get('_oddkin/frame.importmap.json')).json()).toEqual(
      server.build.frameImportMap,
    );
    const frame = await get('_oddkin/frame.html');
    expect(frame.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await frame.text()).toContain('data-oddkin-preview');
    expect((await get('_oddkin/missing.json')).status).toBe(404);

    const module = await get('_oddkin/m/@acme/ui@1.4.0/dist/define/button.js');
    expect(module.status).toBe(200);
    expect(module.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await module.text()).toContain("customElements.define('acme-button'");
    const etag = module.headers.get('etag')!;
    expect(etag).toMatch(/^W\/"\d+-\d+"$/);
    const again = await get('_oddkin/m/@acme/ui@1.4.0/dist/define/button.js', {
      headers: { 'if-none-match': etag },
    });
    expect(again.status).toBe(304);
    const head = await get('_oddkin/m/@acme/icons@2.1.0/index.js', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    // The shell's own packages are served from the same place.
    expect((await get(`_oddkin/m/${oddkin('core')}/package.json`)).status).toBe(200);
  });

  it('refuses paths outside packages, unknown packages and versions, and other methods', async () => {
    const { dir, get } = await serve({ 'secret/secret.txt': 'not for the browser\n' }, false);
    // A link inside a package that leads outside it is refused (the real path is checked).
    symlinkSync(
      join(dir, 'secret'),
      join(dir, 'node_modules', '@acme', 'ui', 'dist', 'outside'),
      'junction',
    );
    expect((await get('_oddkin/m/@acme/ui@1.4.0/dist/outside/secret.txt')).status).toBe(404);
    expect((await get('_oddkin/m/@acme/ui@1.4.0/dist/index.js')).status).toBe(200);
    for (const path of [
      '_oddkin/m/@acme/ui@1.4.0/..%2F..%2F..%2Fpackage.json',
      '_oddkin/m/@acme/ui@1.4.0/%2e%2e/icons/index.js',
      '_oddkin/m/@acme/ui@1.4.0/dist%5C..%5C..%5Cicons%5Cindex.js',
      '_oddkin/m/@acme/ui@1.4.0/node_modules/x.js',
      '_oddkin/m/@acme/ui@1.4.0/',
      '_oddkin/m/@acme/ui@1.4.0/dist',
      '_oddkin/m/@acme/ui@9.9.9/dist/index.js',
      '_oddkin/m/@acme/ui/dist/index.js',
      '_oddkin/m/left-pad@1.0.0/index.js',
      '_oddkin/m/%E0%A4%A/index.js',
      `_oddkin/m/${oddkin('analyzer')}/package.json`,
    ])
      expect((await get(path)).status, path).toBe(404);
    const post = await get('', { method: 'POST' });
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
  });

  it('serves under a base path, and in hash mode only at the entry', async () => {
    const { server, get } = await serve(
      {
        'oddkin.config.ts':
          "export default { library: { packages: ['@acme/ui'] }, hosting: { basePath: '/docs/acme/', routing: 'hash' } };\n",
      },
      false,
    );
    expect(server.url).toMatch(/\/docs\/acme\/$/);
    const bare = await get('/docs/acme?x=1', { redirect: 'manual' });
    expect(bare.status).toBe(308);
    expect(bare.headers.get('location')).toBe('/docs/acme/?x=1');
    expect((await get('/docs/acme/', html)).status).toBe(200);
    // No rewrites in hash mode: deep paths are not found, like on a static host.
    expect((await get('/docs/acme/components/acme-button', html)).status).toBe(404);
    expect((await get('/', html)).status).toBe(404);
    expect((await get('/docs/acme/_oddkin/index.json')).status).toBe(200);
    expect((await get('/_oddkin/index.json')).status).toBe(404);
  });

  it('writes the marked generated directory, and refuses one it did not create', async () => {
    const { dir, server } = await serve({}, false);
    const out = join(dir, '.oddkin', 'workbench');
    expect(existsSync(join(out, MARKER))).toBe(true);
    expect(readFileSync(join(out, 'index.json'), 'utf8')).toBe(
      server.build.files.get('index.json'),
    );

    const other = acmeProject({ '.oddkin/workbench/notes.txt': 'authored\n' });
    projects.push(other);
    await expect(startDevServer({ config: other, port: 0, watch: false })).rejects.toBeInstanceOf(
      GeneratedDirectoryError,
    );
    expect(readFileSync(join(other, '.oddkin', 'workbench', 'notes.txt'), 'utf8')).toBe(
      'authored\n',
    );
  });

  it('does not start without a valid configuration', async () => {
    const dir = acmeProject({
      'oddkin.config.ts': 'export default { library: { packages: [] } };\n',
    });
    projects.push(dir);
    const error = await startDevServer({ config: dir, port: 0 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DevServerError);
    expect((error as DevServerError).diagnostics.map((d) => d.code)).toEqual([
      'config.library.missing',
    ]);
  });

  it("diffs Theme Studio's draft against the theme file, and writes it only when confirmed", async () => {
    const theme = '{\n  "name": "acme",\n  "brand": { "primary": "#123456" }\n}\n';
    const { dir, server, get } = await serve(
      {
        'oddkin.config.ts':
          "export default { library: { packages: ['@acme/ui'] }, themeStudio: { themeConfig: './oddkin.theme.json' } };\n",
        'oddkin.theme.json': theme,
      },
      false,
    );
    const index = (await (await get('_oddkin/index.json')).json()) as WorkbenchIndex;
    const page = (await (
      await get(`_oddkin/${index.pages['theme-studio']}`)
    ).json()) as ThemeStudioPageData;
    expect(page.studio.save).toEqual({ file: 'oddkin.theme.json', url: '/_oddkin/theme-file' });
    const { origin, port } = new URL(server.url);
    const post = (payload: unknown, headers: Record<string, string> = {}) =>
      send(new URL('_oddkin/theme-file', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin, ...headers },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
      });
    const file = () => readFileSync(join(dir, 'oddkin.theme.json'), 'utf8');
    const draft = { name: 'acme', brand: { primary: '#0a7d33' } };

    const diff = await post({ config: draft });
    expect(diff.status).toBe(200);
    const shown = JSON.parse(diff.body) as { version: string };
    expect(shown).toEqual({
      file: 'oddkin.theme.json',
      version: expect.stringMatching(/^[0-9a-f]{16}$/),
      lines: [
        '@@ -1,4 +1,4 @@',
        ' {',
        '   "name": "acme",',
        '-  "brand": { "primary": "#123456" }',
        '+  "brand": { "primary": "#0a7d33" }',
        ' }',
      ],
    });
    expect(file()).toBe(theme);
    // A write names the content the reader's diff was made from; anything else gets the new diff.
    const stale = await post({ config: draft, version: '0000000000000000', write: true });
    expect([stale.status, JSON.parse(stale.body)]).toEqual([409, shown]);
    expect(file()).toBe(theme);
    const written = await post({ config: draft, version: shown.version, write: true });
    expect(JSON.parse(written.body)).toMatchObject({ written: true, lines: [] });
    expect(file()).toBe('{\n  "name": "acme",\n  "brand": { "primary": "#0a7d33" }\n}\n');

    // Only a Workbench page served here, on this machine: not another site, not a name rebound
    // to this address, and only JSON bodies up to 1 MiB.
    const refused = [
      await post({ config: draft }, { origin: 'http://evil.example' }),
      // A page on another port of this machine is another origin.
      await post({ config: draft }, { origin: 'http://localhost:1' }),
      await post(
        { config: draft },
        { origin: `http://evil.example:${port}`, host: `evil.example:${port}` },
      ),
      await post({ config: draft }, { 'sec-fetch-site': 'cross-site' }),
      await post({ config: draft }, { origin: '' }),
      await post({ config: draft }, { 'content-type': 'text/plain' }),
      await post('{ not json'),
      await post({ config: [1] }),
      await post({ config: { notes: 'x'.repeat(1 << 20) } }),
    ];
    expect(refused.map((r) => r.status)).toEqual([403, 403, 403, 403, 403, 415, 400, 400, 413]);
    expect((await get('_oddkin/theme-file')).status).toBe(404);
    expect(file()).toBe('{\n  "name": "acme",\n  "brand": { "primary": "#0a7d33" }\n}\n');

    // A client on another machine is refused even when its headers name this page.
    const from = (remoteAddress: string) =>
      fromThisPage({ socket: { remoteAddress }, headers: { origin, host: new URL(origin).host } });
    expect(['127.0.0.1', '::1', '::ffff:127.0.0.1'].map(from)).toEqual([true, true, true]);
    expect(['192.168.1.20', '::ffff:10.0.0.2', '127.0.0.2', ''].map(from)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('offers saving each JSON file of a theme, its bases too, and only in the dev server', async () => {
    const config = (file: string) =>
      `export default { library: { packages: ['@acme/ui'] }, themeStudio: { themeConfig: './${file}' } };\n`;
    const studio = async (files: Record<string, string>, save: boolean) => {
      const dir = acmeProject(files);
      projects.push(dir);
      const build = await buildWorkbench({ config: dir, save });
      const page = build.data?.pages['theme-studio'] as ThemeStudioPageData;
      return { dir, build, studio: page.studio };
    };
    const json = {
      'oddkin.config.ts': config('a.theme.json'),
      'a.theme.json': '{ "name": "a" }\n',
    };
    const built = await studio(json, false);
    expect(built.studio.save).toBeUndefined();
    expect(built.build.themeFile).toBeUndefined();
    expect(built.build.themeFiles).toBeUndefined();
    expect(built.studio.missing.map((m) => m.item)).not.toContain('save');
    // A theme file on no base is one draft, as before.
    expect(built.studio.files).toBeUndefined();

    const code = await studio(
      {
        'oddkin.config.ts': config('a.theme.mjs'),
        'a.theme.mjs': "export default { name: 'a' };\n",
      },
      true,
    );
    expect(code.studio.save).toBeUndefined();
    expect(code.build.themeFile).toBeUndefined();
    expect(code.build.themeFiles).toBeUndefined();
    expect(code.studio.missing).toContainEqual({
      item: 'save',
      supply: expect.stringContaining('a .json theme file: a.theme.mjs is code'),
    });

    // Each file of a theme on bases is its own draft, as written: the theme file is saved, and
    // so is a base of the project; one in an installed package or in code is not.
    const files = {
      'oddkin.config.ts': config('a.theme.json'),
      'a.theme.json': '{ "extends": "./mid.theme.json", "name": "a" }\n',
      'mid.theme.json':
        '{ "extends": "@acme/brand/base.theme.json", "status": { "info": "#0055aa" } }\n',
      'node_modules/@acme/brand/package.json':
        '{ "name": "@acme/brand", "version": "1.0.0", "exports": { "./base.theme.json": "./base.theme.json" } }\n',
      'node_modules/@acme/brand/base.theme.json':
        '{ "name": "base", "brand": { "primary": "#123456" } }\n',
    };
    const based = await studio(files, true);
    const url = '/_oddkin/theme-file';
    expect(based.studio.save).toEqual({ file: 'a.theme.json', url });
    expect(based.studio.missing.map((m) => m.item)).not.toContain('save');
    expect(based.studio.files).toEqual([
      {
        file: 'node_modules/@acme/brand/base.theme.json',
        config: { name: 'base', brand: { primary: '#123456' } },
        unsaveable: expect.stringContaining(
          'node_modules/@acme/brand/base.theme.json belongs to an installed package',
        ),
      },
      {
        file: 'mid.theme.json',
        config: { extends: '@acme/brand/base.theme.json', status: { info: '#0055aa' } },
        base: 'node_modules/@acme/brand/base.theme.json',
        save: url,
      },
      {
        file: 'a.theme.json',
        config: { extends: './mid.theme.json', name: 'a' },
        base: 'mid.theme.json',
        save: url,
      },
    ]);
    // The baseline is still the merged model, as the CLI builds it.
    expect(based.studio.config).toEqual({
      name: 'a',
      brand: { primary: '#123456' },
      status: { info: '#0055aa' },
    });
    expect([...(based.build.themeFiles ?? [])]).toEqual([
      ['mid.theme.json', join(based.dir, 'mid.theme.json')],
      ['a.theme.json', join(based.dir, 'a.theme.json')],
    ]);
    // A change to any file of the theme rebuilds the page.
    expect(based.build.inputs?.dataFiles).toEqual(
      expect.arrayContaining(
        ['a.theme.json', 'mid.theme.json', 'node_modules/@acme/brand/base.theme.json'].map((f) =>
          join(based.dir, ...f.split('/')),
        ),
      ),
    );
    // A static build lists the files without saving.
    expect((await studio(files, false)).studio.files?.map((f) => Object.keys(f))).toEqual([
      ['file', 'config'],
      ['file', 'config', 'base'],
      ['file', 'config', 'base'],
    ]);
    // In code, a base is read-only too.
    const coded = await studio(
      {
        'oddkin.config.ts': config('a.theme.json'),
        'a.theme.json': '{ "extends": "./base.theme.mjs" }\n',
        'base.theme.mjs': "export default { name: 'base' };\n",
      },
      true,
    );
    expect(coded.studio.files?.[0]).toMatchObject({
      file: 'base.theme.mjs',
      unsaveable: expect.stringContaining('a .json theme file: base.theme.mjs is code'),
    });
  });

  it("offers a team's own app with the draft, only in the dev server", async () => {
    const dir = acmeProject({
      'oddkin.config.ts':
        "export default { library: { packages: ['@acme/ui'] }, themeStudio: { themeConfig: './a.theme.json', app: 'http://localhost:5173/' } };\n",
      'a.theme.json': '{ "name": "a" }\n',
    });
    projects.push(dir);
    const studio = async (save: boolean) =>
      (
        (await buildWorkbench({ config: dir, save })).data?.pages[
          'theme-studio'
        ] as ThemeStudioPageData
      ).studio;
    expect((await studio(true)).app).toBe('http://localhost:5173/');
    // A built site has no app beside it.
    expect(await studio(false)).not.toHaveProperty('app');
  });

  it('lists the files of several themes once each, and the themes by name', async () => {
    const dir = acmeProject({
      'oddkin.config.ts':
        "export default { library: { packages: ['@acme/ui'] }, themeStudio: { themes: { clinic: './clinic.theme.json', portal: './portal.theme.json', gone: './gone.theme.json' } } };\n",
      'base.theme.json': '{ "name": "base", "brand": { "primary": "#123456" } }\n',
      'clinic.theme.json': '{ "extends": "./base.theme.json", "name": "clinic" }\n',
      'portal.theme.json':
        '{ "extends": "./base.theme.json", "name": "portal", "products": { "kiosk": { "brand": { "primary": "#aa0000" } } } }\n',
    });
    projects.push(dir);
    const build = await buildWorkbench({ config: dir, save: true });
    const { studio } = build.data?.pages['theme-studio'] as ThemeStudioPageData;
    const url = '/_oddkin/theme-file';
    expect(studio.files?.map((f) => [f.file, f.base, f.save])).toEqual([
      ['base.theme.json', undefined, url],
      ['clinic.theme.json', 'base.theme.json', url],
      ['portal.theme.json', 'base.theme.json', url],
    ]);
    expect(studio.themes).toEqual([
      { file: 'clinic.theme.json', name: 'clinic' },
      { file: 'portal.theme.json', name: 'portal' },
    ]);
    // The first theme is the baseline, as themeConfig's would be.
    expect([studio.source, studio.save?.file]).toEqual([
      './clinic.theme.json',
      'clinic.theme.json',
    ]);
    expect(studio.config).toMatchObject({ name: 'clinic', brand: { primary: '#123456' } });
    expect([...(build.themeFiles?.keys() ?? [])]).toEqual([
      'base.theme.json',
      'clinic.theme.json',
      'portal.theme.json',
    ]);
    expect(build.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'node.themeStudio.config',
        path: '/themeStudio/themes/gone',
        message: expect.stringContaining('themeStudio.themes.gone'),
      }),
    );
    // Two themes on no base are listed too: each is a draft of its own.
    const two = acmeProject({
      'oddkin.config.ts':
        "export default { library: { packages: ['@acme/ui'] }, themeStudio: { themeConfig: './a.theme.json', themes: { b: './b.theme.json' } } };\n",
      'a.theme.json': '{ "name": "a" }\n',
      'b.theme.json': '{ "name": "b" }\n',
    });
    projects.push(two);
    const pair = (await buildWorkbench({ config: two })).data?.pages[
      'theme-studio'
    ] as ThemeStudioPageData;
    expect(pair.studio.files?.map((f) => f.file)).toEqual(['a.theme.json', 'b.theme.json']);
    expect(pair.studio.themes).toEqual([
      { file: 'a.theme.json' },
      { file: 'b.theme.json', name: 'b' },
    ]);
  });

  it("writes the file of the theme a save names, and only the theme's own files", async () => {
    const product = '{\n  "extends": "./base.theme.json",\n  "name": "product"\n}\n';
    const base = '{\n  "name": "base",\n  "brand": { "primary": "#123456" }\n}\n';
    const { dir, server } = await serve(
      {
        'oddkin.config.ts':
          "export default { library: { packages: ['@acme/ui'] }, themeStudio: { themeConfig: './product.theme.json' } };\n",
        'product.theme.json': product,
        'base.theme.json': base,
        'other.theme.json': base,
      },
      false,
    );
    const { origin } = new URL(server.url);
    const post = (payload: unknown) =>
      send(new URL('_oddkin/theme-file', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(payload),
      });
    const read = (file: string) => readFileSync(join(dir, file), 'utf8');
    const draft = { name: 'base', brand: { primary: '#0a7d33' } };
    const diff = await post({ file: 'base.theme.json', config: draft });
    const shown = JSON.parse(diff.body) as { file: string; version: string };
    expect([diff.status, shown.file]).toEqual([200, 'base.theme.json']);
    const written = await post({
      file: 'base.theme.json',
      config: draft,
      version: shown.version,
      write: true,
    });
    expect(JSON.parse(written.body)).toMatchObject({ file: 'base.theme.json', written: true });
    expect(read('base.theme.json')).toBe(
      '{\n  "name": "base",\n  "brand": { "primary": "#0a7d33" }\n}\n',
    );
    // The product file is untouched: saving a base never copies it into a product, or back.
    expect(read('product.theme.json')).toBe(product);
    // No request names a file outside the theme, or a path that leads elsewhere.
    for (const file of ['other.theme.json', '../base.theme.json', 'oddkin.config.ts', 'x'])
      expect((await post({ file, config: draft })).status).toBe(403);
    expect(read('other.theme.json')).toBe(base);
    // Without a name, a save writes the theme file, as before.
    expect(JSON.parse((await post({ config: { name: 'product' } })).body)).toMatchObject({
      file: 'product.theme.json',
    });
  });

  it("keeps the ./node entry's declarations free of node: modules, for consumers without @types/node", () => {
    // verify-packs type-checks a consumer with lib DOM and no @types/node (CI issue #3).
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/["']node:/);
      for (const [, path] of text.matchAll(/from ["'](\.\.?\/[^"']+)\.js["']/g))
        visit(join(dirname(file), `${path}.d.ts`));
    };
    visit('packages/workbench/dist/node/index.d.ts');
    expect([...seen].map((file) => file.split(/[\\/]/).pop())).toContain('server.d.ts');
  });

  it('pushes updates for configuration, content, data, and module changes', async () => {
    const { dir, server, get } = await serve({
      'node_modules/@acme/extra/package.json':
        '{ "name": "@acme/extra", "version": "1.0.0", "exports": "./index.js" }',
      'node_modules/@acme/extra/index.js': 'export {};\n',
    });
    const stream = await subscribe(server.url);
    expect(stream.response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    const config = join(dir, 'oddkin.config.ts');
    const original = readFileSync(config, 'utf8');

    writeFileSync(config, original.replace("name: 'Acme UI'", "name: 'Acme Two'"));
    let event = await stream.next();
    expect(event).toMatchObject({ ok: true, index: true, shell: true, modules: [] });
    expect(((await (await get('_oddkin/index.json')).json()) as WorkbenchIndex).branding.name).toBe(
      'Acme Two',
    );
    expect(await (await get('', html)).text()).toContain('<title>Acme Two</title>');
    // The generated directory follows.
    const generated = readFileSync(join(dir, '.oddkin', 'workbench', 'index.json'), 'utf8');
    expect(JSON.parse(generated).branding.name).toBe('Acme Two');

    // Authored content appears without a restart.
    writeFileSync(
      join(dir, 'oddkin.docs.ts'),
      "export default { pages: { 'components/acme-card': { summary: 'Edited.' } } };\n",
    );
    event = await stream.next();
    expect(event).toMatchObject({ ok: true, index: true, shell: false });
    const card = server.build.data!.index.registry.pages.find(
      (p) => p.id === 'components/acme-card',
    );
    expect(card?.summary).toBe('Edited.');

    // A module change is reported as such; the data is unchanged.
    const button = join(dir, 'node_modules', '@acme', 'ui', 'dist', 'define', 'button.js');
    writeFileSync(button, `${readFileSync(button, 'utf8')}// edited\n`);
    event = await stream.next();
    expect(event).toMatchObject({ ok: true, index: false, pages: [], modules: ['@acme/ui@1.4.0'] });

    // A data input (the manifest) changes the pages built from it, and is not a module change;
    // nor is anything below a package's own node_modules (written in the same batch).
    const nested = join(dir, 'node_modules', '@acme', 'ui', 'node_modules', 'junk', 'index.js');
    mkdirSync(dirname(nested), { recursive: true });
    writeFileSync(nested, 'export {};\n');
    const cem = join(dir, 'node_modules', '@acme', 'ui', 'custom-elements.json');
    writeFileSync(
      cem,
      readFileSync(cem, 'utf8').replace('Triggers an action.', 'Starts an action.'),
    );
    event = await stream.next();
    expect(event.ok).toBe(true);
    expect(event.pages).toContain('components/acme-button');
    expect(event.modules).toEqual([]);

    // An invalid edit keeps the last valid data and says why.
    writeFileSync(config, 'export default { library: { packages: [] } };\n');
    event = await stream.next();
    expect(event.ok).toBe(false);
    expect(event.diagnostics.map((d) => d.code)).toContain('config.library.missing');
    expect(((await (await get('_oddkin/index.json')).json()) as WorkbenchIndex).branding.name).toBe(
      'Acme Two',
    );
    // Hosting changes need a restart.
    writeFileSync(
      config,
      original.replace(
        "branding: { name: 'Acme UI' },",
        "branding: { name: 'Acme UI' }, hosting: { basePath: '/x/' },",
      ),
    );
    event = await stream.next();
    expect(event.ok).toBe(false);
    expect(event.diagnostics[0]?.code).toBe('node.dev.restart');
    writeFileSync(config, original);
    event = await stream.next();
    expect(event).toMatchObject({ ok: true, index: true });

    // A package documented later is watched from then on.
    writeFileSync(
      config,
      original.replace("packages: ['@acme/ui']", "packages: ['@acme/ui', '@acme/extra']"),
    );
    event = await stream.next();
    expect(event.ok).toBe(true);
    writeFileSync(join(dir, 'node_modules', '@acme', 'extra', 'index.js'), 'export const x = 1;\n');
    event = await stream.next();
    expect(event.modules).toEqual(['@acme/extra@1.0.0']);

    // rebuild() runs the same update on demand.
    expect(await server.rebuild()).toMatchObject({
      ok: true,
      index: false,
      pages: [],
      modules: [],
    });

    await server.close();
    expect(await stream.ended()).toBe(true);
    await expect(get('_oddkin/index.json')).rejects.toThrow();
  });

  it('keeps watching through renames, and through a package deleted and installed again', async () => {
    const { dir, server, logs } = await serve();
    const stream = await subscribe(server.url);
    const config = join(dir, 'oddkin.config.ts');
    const original = readFileSync(config, 'utf8');

    // The configuration renamed away (some editors save so) and back stays watched.
    renameSync(config, `${config}.bak`);
    let event = await stream.next();
    expect(event.ok).toBe(false);
    renameSync(`${config}.bak`, config);
    writeFileSync(config, original.replace("name: 'Acme UI'", "name: 'Acme Three'"));
    event = await stream.next();
    expect(event).toMatchObject({ ok: true, index: true });
    expect(server.build.data?.index.branding.name).toBe('Acme Three');

    // A reinstall deletes the package directory: its pages go, and the build says it is missing.
    const until = async (match: (event: UpdateEvent) => boolean) => {
      for (;;) {
        const next = await stream.next();
        if (match(next)) return next;
      }
    };
    const missing = (next: UpdateEvent) =>
      next.diagnostics.some((d) => d.code === 'node.package.missing');
    // Once the server has noticed, the directory's old watcher is gone, whatever it still hears.
    const noticed = async () => {
      const seen = logs.filter((line) => line.includes('went away')).length;
      await vi.waitFor(
        () => expect(logs.filter((line) => line.includes('went away')).length).toBe(seen + 1),
        { timeout: 10_000 },
      );
    };
    const ui = join(dir, 'node_modules', '@acme', 'ui');
    const copy = join(dir, 'ui-copy');
    cpSync(ui, copy, { recursive: true });
    const gone = noticed();
    rmSync(ui, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    await until(missing);
    await gone;
    // A new directory in its place brings them back and is watched again.
    cpSync(copy, ui, { recursive: true });
    await until((next) => !missing(next) && next.pages.includes('components/acme-button'));
    const cem = join(ui, 'custom-elements.json');
    writeFileSync(
      cem,
      readFileSync(cem, 'utf8').replace('Triggers an action.', 'Starts an action.'),
    );
    const served = () =>
      server.build.files.get(server.build.data!.index.pages['components/acme-button']!) ?? '';
    await until(() => served().includes('Starts an action.'));
    // npm moves an old package aside before writing the new one, and Windows reports no event
    // for a watched directory renamed away: the server still rebuilds without it, then with the
    // new directory, which it watches.
    const aside = noticed();
    renameSync(ui, join(dir, 'ui-aside'));
    await until(missing);
    await aside;
    cpSync(copy, ui, { recursive: true });
    await until((next) => !missing(next));
    writeFileSync(
      cem,
      readFileSync(cem, 'utf8').replace('Triggers an action.', 'Begins an action.'),
    );
    await until(() => served().includes('Begins an action.'));
    stream.close();
  });

  it('watches a directory again when its watcher fails', async () => {
    const { dir, server } = await serve();
    const stream = await subscribe(server.url);
    const ui = join(dir, 'node_modules', '@acme', 'ui');
    const failing = watches.findLast((w) => w.dir.toLowerCase() === ui.toLowerCase());
    // Windows reports a watched directory deleted under it as an error (EPERM), not an event.
    failing!.watcher.emit('error', Object.assign(new Error('EPERM'), { code: 'EPERM' }));
    const cem = join(ui, 'custom-elements.json');
    writeFileSync(
      cem,
      readFileSync(cem, 'utf8').replace('Triggers an action.', 'Starts an action.'),
    );
    const served = () =>
      server.build.files.get(server.build.data!.index.pages['components/acme-button']!) ?? '';
    while (!served().includes('Starts an action.')) await stream.next();
    stream.close();
  });
});
