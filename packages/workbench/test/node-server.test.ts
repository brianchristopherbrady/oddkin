import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { WorkbenchIndex } from '../src/data/index.js';
import {
  DevServerError,
  GeneratedDirectoryError,
  MARKER,
  startDevServer,
  type DevServer,
  type UpdateEvent,
} from '../src/node/index.js';
import { acmeProject, removeProject } from './node-project.js';

const projects: string[] = [];
const servers: DevServer[] = [];
afterAll(async () => {
  await Promise.all(servers.map((s) => s.close()));
  projects.forEach(removeProject);
});

async function serve(extra: Record<string, string> = {}, watch = true) {
  const dir = acmeProject(extra);
  projects.push(dir);
  const server = await startDevServer({ config: dir, port: 0, watch });
  servers.push(server);
  const get = (path: string, init: RequestInit = {}) => fetch(new URL(path, server.url), init);
  return { dir, server, get };
}

const html = { headers: { accept: 'text/html,application/xhtml+xml' } };

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
    expect((await get('_oddkin/m/@oddkin/core@0.0.0/package.json')).status).toBe(200);
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
      '_oddkin/m/@oddkin/analyzer@0.0.0/package.json',
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
});
