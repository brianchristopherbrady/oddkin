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

  it('replaces only a folder it wrote', () => {
    const other = mkdtempSync(join(tmpdir(), 'oddkin-docs-other-'));
    writeFileSync(join(other, 'keep.txt'), 'not the docs site');
    expect(() => build(other)).toThrow(/not empty/);
    expect(readFileSync(join(other, 'keep.txt'), 'utf8')).toBe('not the docs site');
    rmSync(other, { recursive: true, force: true });
  });
});
