import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Example pages load packages through an inline import map with no bundler. When a package
// module gains an import (e.g. a new @oddkin/core subpath), every page that reaches it needs the
// mapping, or the page fails to start. Walk each page's static import graph from its module
// script, as the browser would, and require every specifier to resolve to a file.
// After editing a map, run `node scripts/update-csp-hash.mjs <page>` (see csp.test.ts).

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pages = [
  'core-counter',
  'components-only',
  'css-gallery',
  'side-nav',
  'editable-list',
  'forms',
  'full-app',
  'autoload',
  'app-header',
];

const IMPORTS = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
];
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function walk(page: string) {
  const dir = resolve(repo, 'examples', page);
  const html = readFileSync(resolve(dir, 'index.html'), 'utf8');
  const map = JSON.parse(
    /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{"imports":{}}',
  ) as { imports: Record<string, string> };
  const entries = [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map((m) =>
    resolve(dir, m[1]!),
  );
  const unresolved: string[] = [];
  const seen = new Set<string>();
  const resolveSpecifier = (specifier: string, from: string): string | undefined => {
    if (specifier.startsWith('.') || specifier.startsWith('/'))
      return resolve(dirname(from), specifier);
    const exact = map.imports[specifier];
    if (exact) return resolve(dir, exact);
    const prefix = Object.keys(map.imports)
      .filter((key) => key.endsWith('/') && specifier.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    return prefix ? resolve(dir, map.imports[prefix]! + specifier.slice(prefix.length)) : undefined;
  };
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = withoutComments(readFileSync(file, 'utf8'));
    for (const pattern of IMPORTS)
      for (const [, specifier] of source.matchAll(pattern)) {
        const target = resolveSpecifier(specifier!, file);
        if (!target || !existsSync(target)) {
          unresolved.push(
            `${specifier} (from ${file.slice(repo.length + 1).replaceAll('\\', '/')})`,
          );
          continue;
        }
        if (target.endsWith('.js')) visit(target);
      }
  };
  for (const entry of entries) visit(entry);
  return { entries, modules: seen.size, unresolved };
}

describe.each(pages)('%s import map', (page) => {
  it('resolves every static import the page reaches', () => {
    const { entries, modules, unresolved } = walk(page);
    expect(entries.length).toBeGreaterThan(0);
    expect(modules).toBeGreaterThan(1);
    expect(unresolved).toEqual([]);
  });
});
