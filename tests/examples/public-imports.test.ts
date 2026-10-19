import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Published examples use only real public entry points (agent-tooling.md §7): every `@oddkin/*`
// specifier in an example app or an authored `*.examples.ts` is an `exports` entry of that
// package, so a reader can copy the import. Authored examples, from which kit references are
// generated, import the package's own internals for types only. Evidence levels stay separate:
// this is static evidence; typecheck is compile evidence; examples.browser.test.ts and the
// contract tests are browser evidence. Packed packages are checked in M12.

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const files = (dir: string, accept: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return ['node_modules', 'dist', 'generated'].includes(entry.name) ? [] : files(path, accept);
    return accept(entry.name) ? [path] : [];
  });
const rel = (path: string) => relative(repo, path).replaceAll('\\', '/');

const exportsOf = new Map<string, Set<string>>();
for (const dir of readdirSync(join(repo, 'packages'))) {
  const manifest = JSON.parse(
    readFileSync(join(repo, 'packages', dir, 'package.json'), 'utf8'),
  ) as {
    name: string;
    exports?: Record<string, unknown>;
  };
  exportsOf.set(manifest.name, new Set(Object.keys(manifest.exports ?? {})));
}
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](@oddkin\/[^'"]+)['"]/g;
const subpath = (specifier: string) => {
  const [scope, name, ...rest] = specifier.split('/');
  return { pkg: `${scope}/${name}`, entry: rest.length ? `./${rest.join('/')}` : '.' };
};

const sources = [
  ...files(join(repo, 'examples'), (n) => /\.(js|mjs|ts|html)$/.test(n) && !n.endsWith('.d.ts')),
  ...files(join(repo, 'packages'), (n) => n.endsWith('.examples.ts')),
];

describe('examples use public entry points', () => {
  it('finds the example apps and authored examples', () => {
    expect(sources.filter((f) => f.endsWith('.examples.ts')).length).toBeGreaterThanOrEqual(4);
    expect(sources.filter((f) => rel(f).startsWith('examples/')).length).toBeGreaterThan(10);
  });

  it.each(sources.map((file) => [rel(file), file] as const))('%s', (_name, file) => {
    const text = readFileSync(file, 'utf8');
    const problems: string[] = [];
    for (const [, specifier] of text.matchAll(SPECIFIER)) {
      const { pkg, entry } = subpath(specifier!);
      const entries = exportsOf.get(pkg);
      if (!entries) problems.push(`${specifier}: no workspace package ${pkg}`);
      else if (!entries.has(entry)) problems.push(`${specifier}: ${pkg} exports no "${entry}"`);
    }
    if (file.endsWith('.examples.ts'))
      for (const [line] of text.matchAll(/^import (?!type )[^;]*from '\.{1,2}\/[^']+';$/gm))
        problems.push(`runtime import of package internals: ${line}`);
    expect(problems).toEqual([]);
  });
});
