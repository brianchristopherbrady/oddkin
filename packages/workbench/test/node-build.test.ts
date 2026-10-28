import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchRoutes } from '@oddkin/app/router';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { shellRoutes } from '../src/app/routes.js';
import type { WorkbenchIndex } from '../src/data/index.js';
import {
  buildStatic,
  GeneratedDirectoryError,
  MARKER,
  run,
  type StaticBuild,
} from '../src/node/index.js';
import { acmeProject, removeProject } from './node-project.js';

const projects: string[] = [];
afterAll(() => projects.forEach(removeProject));

/** Every file below `dir` with its size and modification time, sorted by path. */
const snapshot = (dir: string, prefix = ''): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      if (e.isDirectory()) return snapshot(join(dir, e.name), `${prefix}${e.name}/`);
      const { size, mtimeMs } = statSync(join(dir, e.name));
      return [`${prefix}${e.name} ${size} ${mtimeMs}`];
    })
    .sort();

// Each fresh build copies the published browser files of Workbench's own packages (about
// 1,300), so the tests share one project and output directory, in order.
describe('workbench build', { timeout: 180_000 }, () => {
  let dir = '';
  let out = '';
  let first: StaticBuild;
  beforeAll(() => {
    dir = acmeProject();
    projects.push(dir);
    out = join(dir, 'site');
  });

  it('writes the shell, data, and published package files under a base path', async () => {
    const result = await buildStatic({ config: dir, out, hosting: { basePath: '/docs/ui/' } });
    first = result;
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.out).toBe(out);
    const shell = readFileSync(join(out, 'index.html'), 'utf8');
    expect(shell).toContain('<oddkin-workbench index="/docs/ui/_oddkin/index.json">');
    expect(shell).not.toContain('events=');
    const index = JSON.parse(
      readFileSync(join(out, '_oddkin', 'index.json'), 'utf8'),
    ) as WorkbenchIndex;
    expect(index.registry.basePath).toBe('/docs/ui/');
    // History mode: every page path and legacy path loads the shell, so deep links and
    // refreshes work on a host without rewrites; 404.html for hosts that serve one.
    for (const path of [
      'components/acme-button/index.html',
      'components/index.html',
      'playground/index.html',
      'foundations/theme-studio/index.html',
      '404.html',
    ])
      expect(readFileSync(join(out, ...path.split('/')), 'utf8')).toBe(shell);
    // Each written path is one the shell's router answers.
    const routes = shellRoutes(index.registry, () => undefined);
    for (const file of result.files.filter((f) => f.endsWith('/index.html')))
      expect(matchRoutes(routes, `/${file.slice(0, -'/index.html'.length)}`), file).not.toBe(
        undefined,
      );
    // Package files: browser files as published, never sources or packages' node_modules.
    expect(result.files).toContain('_oddkin/m/@acme/ui@1.4.0/dist/define/button.js');
    expect(result.files).toContain('_oddkin/m/@acme/icons@2.1.0/index.js');
    expect(result.files).toContain('_oddkin/m/@acme/tokens@1.0.0/dist/acme.inspect.json');
    expect(result.files.some((f) => f.endsWith('secret.ts'))).toBe(false);
    expect(result.files.some((f) => f.endsWith('.d.ts') || f.includes('/node_modules/'))).toBe(
      false,
    );
    // Every browser file the import maps name is in the output (not documents such as
    // @oddkin/core/CONTRACTS.md).
    for (const name of ['shell.importmap.json', 'frame.importmap.json']) {
      const map = JSON.parse(readFileSync(join(out, '_oddkin', name), 'utf8')) as {
        imports: Record<string, string>;
      };
      const files = Object.values(map.imports).filter((url) => /\.(m?js|css|json)$/.test(url));
      expect(files.length).toBeGreaterThan(10);
      for (const url of files)
        expect(existsSync(join(out, url.slice('/docs/ui/'.length))), url).toBe(true);
    }
    expect(readdirSync(out)).toContain(MARKER);
  });

  it('is deterministic, rewrites nothing unchanged, and removes what it no longer writes', async () => {
    const before = snapshot(out);
    writeFileSync(join(out, 'stale.html'), 'old\n');
    const second = await buildStatic({ config: dir, out, hosting: { basePath: '/docs/ui/' } });
    expect(second.written).toEqual([]);
    expect(second.removed).toEqual(['stale.html']);
    expect(snapshot(out)).toEqual(before);
    expect(second.files).toEqual(first.files);
  });

  it('runs as oddkin workbench build', async () => {
    const lines: string[] = [];
    const errors: string[] = [];
    const io = { out: (t: string) => lines.push(t), err: (t: string) => errors.push(t) };
    expect(
      await run(['workbench', 'build', '--config', dir, '--out', out, '--base', '/docs/ui/'], io),
    ).toBe(0);
    expect(lines.at(-1)).toMatch(
      /^Workbench build: .*site \(\d+ files: 0 written, 0 removed\), base path \/docs\/ui\/$/,
    );
    expect(await run(['workbench', 'build', '--config', dir, '--routing', 'path'], io)).toBe(2);
    expect(await run(['workbench', 'build', '--config', dir, '--base', 'x'], io)).toBe(1);
    expect(errors.join('\n')).toContain('config.basePath.invalid');
  });

  it('writes the shell once in hash mode and names modules a package does not publish', async () => {
    // @acme/icons now publishes only lib/, so the module its exports name is missing.
    writeFileSync(
      join(dir, 'node_modules', '@acme', 'icons', 'package.json'),
      JSON.stringify({
        name: '@acme/icons',
        version: '2.1.0',
        type: 'module',
        exports: './index.js',
        files: ['lib'],
      }),
    );
    const result = await buildStatic({ config: dir, out, hosting: { routing: 'hash' } });
    expect(result.files.filter((f) => f.endsWith('.html'))).toEqual([
      '_oddkin/frame.html',
      'index.html',
    ]);
    expect(result.removed).toContain('components/acme-button/index.html');
    expect(
      result.diagnostics.filter((d) => d.code === 'node.build.unpublished').map((d) => d.path),
    ).toEqual(['/frame.importmap.json/imports/@acme/icons']);
  });

  it('writes nothing for an invalid configuration and refuses an unmarked directory', async () => {
    const other = join(dir, 'other');
    const invalid = await buildStatic({ config: dir, out: other, hosting: { basePath: 'docs' } });
    expect(invalid.out).toBeUndefined();
    expect(invalid.diagnostics.map((d) => d.code)).toContain('config.basePath.invalid');
    expect(existsSync(other)).toBe(false);
    // Data that builds but has errors (a documented package is not installed) writes nothing too.
    const missing = join(dir, 'missing');
    mkdirSync(missing);
    writeFileSync(
      join(missing, 'oddkin.config.json'),
      JSON.stringify({ library: { packages: ['@acme/ui', '@acme/absent'] } }),
    );
    const partial = await buildStatic({ config: missing, out: other });
    expect(partial.build.data).toBeDefined();
    expect(partial.diagnostics.map((d) => d.code)).toContain('node.package.missing');
    expect(partial.out).toBeUndefined();
    expect(existsSync(other)).toBe(false);

    // The default output directory, .oddkin/workbench-build, is refused without its marker.
    const fallback = join(dir, '.oddkin', 'workbench-build');
    mkdirSync(fallback, { recursive: true });
    writeFileSync(join(fallback, 'mine.txt'), 'authored\n');
    await expect(buildStatic({ config: dir })).rejects.toThrow(GeneratedDirectoryError);
    await expect(buildStatic({ config: dir })).rejects.toThrow(fallback);
    expect(readdirSync(fallback)).toEqual(['mine.txt']);
  });
});
