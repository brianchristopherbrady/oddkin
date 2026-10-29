import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

// apps/docs/build.mjs, the static site GitHub Pages serves: one document per route, a 404 page,
// a policy that allows only the import map inline, and every file a document names.
const root = fileURLToPath(new URL('../../', import.meta.url));
const build = (out: string) =>
  execFileSync(process.execPath, ['apps/docs/build.mjs', '--out', out], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
const documentAt = (out: string, path: string) =>
  join(out, ...path.split('/').filter(Boolean), 'index.html');

describe('the static docs build', () => {
  // A stable folder: on Windows, first writes of new files are slow while they are scanned.
  const out = join(root, '.oddkin/docs-site-test');
  beforeAll(() => {
    build(out);
  }, 300_000);

  it('writes a document for each authored page, metadata route, and component, and a 404 page', async () => {
    const { pages, clientPages } = await import('../../apps/docs/src/pages/index.js');
    const metadata = JSON.parse(
      readFileSync(join(root, 'packages/components/oddkin.metadata.json'), 'utf8'),
    ) as { components: Record<string, { tag: string }> };
    const routes = [
      ...pages.map((page) => `/${page.path}`),
      ...clientPages.map((page) => `/${page.path}`),
      ...Object.values(metadata.components).map(({ tag }) => `/components/${tag}`),
    ];
    for (const route of routes) expect(existsSync(documentAt(out, route)), route).toBe(true);
    const notFound = readFileSync(join(out, '404.html'), 'utf8');
    expect(notFound).toContain('<main id="main" tabindex="-1" aria-busy="true">');
    expect(readFileSync(documentAt(out, '/installation'), 'utf8')).toContain(
      '<h1>Installation</h1>',
    );
  });

  it('allows the import map by its hash, and no other inline script', () => {
    const html = readFileSync(documentAt(out, '/'), 'utf8');
    const map = /<script type="importmap">([^<]*)<\/script>/.exec(html)?.[1] ?? '';
    const hash = createHash('sha256').update(map).digest('base64');
    const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
    expect(policy).toContain(`script-src 'self' 'sha256-${hash}';`);
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
    expect(html.match(/<script(?![^>]*\bsrc=)[^>]*>/g)).toEqual(['<script type="importmap">']);
  });

  it('contains every file the documents and the import map name', () => {
    const html = readFileSync(documentAt(out, '/getting-started'), 'utf8');
    const map = JSON.parse(
      /<script type="importmap">([^<]*)<\/script>/.exec(html)?.[1] ?? '{}',
    ) as {
      imports: Record<string, string>;
    };
    const assets = [...html.matchAll(/(?:href|src)="(\/[^"]+\.(?:css|js))"/g)].map(
      ([, path]) => path,
    );
    for (const path of [...assets, ...Object.values(map.imports)])
      expect(existsSync(join(out, ...path!.split('/').filter(Boolean))), path).toBe(true);
    for (const [, path = ''] of html.matchAll(/href="(\/[^".#?]*)"/g))
      expect(existsSync(documentAt(out, path)), path).toBe(true);
  });

  it('copies browser files only: no Node-only modules or type declarations', () => {
    expect(existsSync(join(out, 'packages/workbench/dist/node'))).toBe(false);
    expect(existsSync(join(out, 'packages/analyzer'))).toBe(false);
    expect(existsSync(join(out, 'packages/core/dist/index.d.ts'))).toBe(false);
    expect(existsSync(join(out, 'packages/core/dist/index.js'))).toBe(true);
  });

  it('writes the reference data with example values, a document per reference page, and the preview frame', () => {
    const index = JSON.parse(readFileSync(join(out, '_oddkin/index.json'), 'utf8')) as {
      pages: Record<string, string>;
      registry: {
        pages: { id: string; kind: string; route: string; group?: string; title: string }[];
      };
    };
    const components = index.registry.pages.filter((page) => page.kind === 'component');
    expect(components.some((page) => page.group === 'AI')).toBe(true);
    // Titles a tag cannot spell come from the docs' authored content (apps/docs/oddkin.docs.ts).
    const title = (id: string) => components.find((page) => page.id === id)?.title;
    expect([title('components/odd-ai-label'), title('components/odd-one-time-code')]).toEqual([
      'AI label',
      'One-time code',
    ]);
    for (const page of components) {
      expect(existsSync(documentAt(out, page.route)), page.route).toBe(true);
      expect(existsSync(join(out, '_oddkin', index.pages[page.id]!)), page.id).toBe(true);
    }
    const button = JSON.parse(
      readFileSync(join(out, '_oddkin', index.pages['components/odd-button']!), 'utf8'),
    ) as { examples: { name: string; definition?: { slots?: Record<string, string> } }[] };
    expect(button.examples.find((e) => e.name === 'default')?.definition?.slots).toEqual({
      default: 'Save',
    });
    // The frame document: the import map allowed by its hash, its module and stylesheets present.
    const frame = readFileSync(join(out, 'apps/docs/frame.html'), 'utf8');
    const map = /<script type="importmap">([^<]*)<\/script>/.exec(frame)?.[1] ?? '';
    const hash = createHash('sha256').update(map).digest('base64');
    expect(frame).toContain(`script-src 'self' 'sha256-${hash}';`);
    expect(frame.match(/<script(?![^>]*\bsrc=)[^>]*>/g)).toEqual(['<script type="importmap">']);
    for (const [, path = ''] of frame.matchAll(/(?:href|src)="(\/[^"]+)"/g))
      expect(existsSync(join(out, ...path.split('/').filter(Boolean))), path).toBe(true);
    // Pages allow the frames.
    expect(readFileSync(documentAt(out, '/components'), 'utf8')).toContain("frame-src 'self'");
  });

  it('lists every catalog component in the Components sidebar, and links each to its source', async () => {
    const { sourcePath } = await import('../../apps/docs/src/reference.js');
    const index = JSON.parse(readFileSync(join(out, '_oddkin/index.json'), 'utf8')) as {
      pages: Record<string, string>;
      registry: { pages: { id: string; kind: string; route: string; group?: string }[] };
    };
    const html = readFileSync(documentAt(out, '/components/odd-button'), 'utf8');
    const sidebar = html.slice(html.indexOf('<odd-side-nav'), html.indexOf('</odd-side-nav>'));
    for (const page of index.registry.pages.filter((p) => p.kind === 'component')) {
      const listed = sidebar.includes(`<a class="nav-section" href="${page.route}"`);
      // The AI elements have their own page (/ai), as in the catalog.
      expect(listed, page.route).toBe(page.group !== 'AI');
      const data = JSON.parse(readFileSync(join(out, '_oddkin', index.pages[page.id]!), 'utf8'));
      expect(existsSync(join(root, sourcePath(data))), page.id).toBe(true);
    }
  });

  it('replaces only a folder it wrote', () => {
    const other = mkdtempSync(join(tmpdir(), 'oddkin-docs-other-'));
    writeFileSync(join(other, 'keep.txt'), 'not the docs site');
    expect(() => build(other)).toThrow(/not empty/);
    expect(readFileSync(join(other, 'keep.txt'), 'utf8')).toBe('not the docs site');
    rmSync(other, { recursive: true, force: true });
  });
});
