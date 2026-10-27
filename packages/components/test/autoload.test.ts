import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFINED_NAMES } from '../src/autoload/names.js';

// The optional autoloader (ADR 0046 D9): it knows exactly the package's define/* entries, and
// no other module reaches it (it observes the document on import).
const pkgDir = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};
const names = Object.keys(manifest.exports)
  .filter((key) => key.startsWith('./define/'))
  .map((key) => key.slice('./define/'.length))
  .sort();

const namesModule = (list: string[]) =>
  `// Generated from package.json's define/* exports by packages/components/test/autoload.test.ts\n` +
  `// (UPDATE_FIXTURES=1). Do not edit.\n` +
  `export const DEFINED_NAMES =\n  '${list.join(' ')}'.split(\n    ' ',\n  );\n`;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')
        ? [join(dir, entry.name)]
        : [],
  );
}

describe('@oddkin/components/autoload', () => {
  it('knows exactly the define/* entries the package exports', () => {
    const file = join(pkgDir, 'src/autoload/names.ts');
    if (process.env['UPDATE_FIXTURES']) writeFileSync(file, namesModule(names));
    expect([...DEFINED_NAMES].sort()).toEqual(names);
    expect(readFileSync(file, 'utf8')).toBe(namesModule(names));
    expect(manifest.exports['./autoload']).toEqual({
      types: './dist/autoload/autoload.d.ts',
      default: './dist/autoload/autoload.js',
    });
  });

  it('is in no other module graph', () => {
    const importers = sources(join(pkgDir, 'src'))
      .filter((file) => !file.includes(`${join('src', 'autoload')}`))
      .filter((file) =>
        /from ['"][^'"]*autoload[^'"]*['"]|import ['"][^'"]*autoload/.test(
          readFileSync(file, 'utf8'),
        ),
      )
      .map((file) => relative(pkgDir, file));
    expect(importers).toEqual([]);
  });
});
