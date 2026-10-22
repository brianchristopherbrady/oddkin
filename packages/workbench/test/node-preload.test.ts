import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { preloadGraph, resolveModule } from '../src/node/preload.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function packageDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'oddkin-preload-'));
  dirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

const map = {
  imports: {
    app: '/m/app@1.0.0/index.js',
    'lib/': '/m/lib@2.0.0/',
    lib: '/m/lib@2.0.0/main.js',
  },
};

describe('modulepreload graphs', () => {
  it('resolves specifiers as the browser does with an import map', () => {
    expect(resolveModule(map, './a.js', '/m/app@1.0.0/dir/b.js')).toBe('/m/app@1.0.0/dir/a.js');
    expect(resolveModule(map, '../a.js', '/m/app@1.0.0/dir/b.js')).toBe('/m/app@1.0.0/a.js');
    expect(resolveModule(map, 'lib', '/x.js')).toBe('/m/lib@2.0.0/main.js');
    expect(resolveModule(map, 'lib/deep/x.js', '/x.js')).toBe('/m/lib@2.0.0/deep/x.js');
    expect(resolveModule(map, 'unmapped', '/x.js')).toBeUndefined();
    expect(resolveModule(map, 'https://cdn.example/x.js', '/x.js')).toBeUndefined();
  });

  it('lists the static graph once, entry first, without dynamic imports or missing files', () => {
    const app = packageDir({
      'index.js': [
        "import { a } from './a.js';",
        "export { b } from './b.js';",
        "import 'lib';",
        '/** Not an import: import x from "./comment.js" */',
        "const later = () => import('./lazy.js');",
        "const text = `await import('./template.js')`;",
      ].join('\n'),
      'a.js': "import * as ns from './b.js';export const a = 1;",
      'b.js': "import {a} from './a.js';export const b = 2;",
      'lazy.js': '',
    });
    const lib = packageDir({ 'main.js': "import './missing.js';\nexport * from 'lib/util.js';" });
    writeFileSync(join(lib, 'util.js'), '');
    const roots = new Map([
      ['/m/app@1.0.0/', app],
      ['/m/lib@2.0.0/', lib],
    ]);
    expect(preloadGraph(map, 'app', roots)).toEqual([
      '/m/app@1.0.0/index.js',
      '/m/app@1.0.0/a.js',
      '/m/app@1.0.0/b.js',
      '/m/lib@2.0.0/main.js',
      '/m/lib@2.0.0/util.js',
    ]);
    expect(preloadGraph(map, 'unknown', roots)).toEqual([]);
  });
});
