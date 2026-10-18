import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, parse } from 'es-module-lexer';
import { describe, expect, it } from 'vitest';

// What a minimal consumer loads: every module reachable from a component, foundation, or
// registration entry, following imports across Oddkin packages through their `exports`.
// Run after `npm run build`.

const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
interface Manifest {
  name: string;
  exports?: Record<string, string | { default?: string }>;
}
const manifests = new Map<string, { dir: string; manifest: Manifest }>();
for (const entry of await readdir(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(packagesDir, entry.name);
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as Manifest;
  manifests.set(manifest.name, { dir, manifest });
}

const target = (value: string | { default?: string } | undefined) =>
  typeof value === 'string' ? value : value?.default;
function resolveSpecifier(specifier: string): string {
  const name = specifier.split('/').slice(0, 2).join('/');
  const pkg = manifests.get(name);
  if (!pkg) throw new Error(`Unexpected import ${specifier}`);
  const subpath = `.${specifier.slice(name.length)}`;
  const file = target(pkg.manifest.exports?.[subpath === '.' ? '.' : subpath]);
  if (!file) throw new Error(`${specifier} is not exported`);
  return join(pkg.dir, file);
}

/** Every module reached from `specifier`, as `@scope/pkg:path` and as public specifiers. */
async function reach(specifier: string) {
  await init;
  const files = new Set<string>();
  const specifiers = new Set<string>([specifier]);
  const visit = async (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    for (const record of parse(await readFile(file, 'utf8'))[0]) {
      const next = record.specifier;
      if (!next) continue;
      if (next.startsWith('.')) await visit(resolve(dirname(file), next));
      else {
        specifiers.add(next);
        await visit(resolveSpecifier(next));
      }
    }
  };
  await visit(resolveSpecifier(specifier));
  const name = (file: string) => {
    for (const [pkg, { dir }] of manifests)
      if (file.startsWith(dir)) return `${pkg}:${relative(dir, file).replaceAll('\\', '/')}`;
    return file;
  };
  return { files: [...files].map(name), specifiers: [...specifiers] };
}

// Tooling and data-only code that ordinary component consumers must never load.
const EXCLUDED: readonly [string, (s: { files: string[]; specifiers: string[] }) => boolean][] = [
  [
    'component model validators',
    (r) => r.files.some((f) => f.startsWith('@oddkin/components:dist/models/')),
  ],
  ['the JSON Schema emitter', (r) => r.specifiers.includes('@oddkin/core/model/schema')],
  ['the core model builder', (r) => r.specifiers.includes('@oddkin/core/model')],
  ['the data-composition renderer', (r) => r.files.some((f) => f.includes(':dist/composition/'))],
  ['recipe inspection', (r) => r.specifiers.includes('@oddkin/core/layout/inspect')],
  ['the recipe engine', (r) => r.specifiers.includes('@oddkin/core/layout')],
  ['layout presets', (r) => r.files.some((f) => f.startsWith('@oddkin/components:dist/layout/'))],
  [
    'the token generator',
    (r) => r.specifiers.some((s) => /^@oddkin\/tokens\/(generate|node|theme)/.test(s)),
  ],
  [
    'conformance and testing helpers',
    (r) => r.specifiers.some((s) => s.startsWith('@oddkin/workbench')),
  ],
  ['the analyzer', (r) => r.specifiers.some((s) => s.startsWith('@oddkin/analyzer'))],
  ['agent tooling', (r) => r.specifiers.some((s) => s.startsWith('@oddkin/agent'))],
];

const components = manifests.get('@oddkin/components')!.manifest;
const consumerEntries = Object.entries(components.exports ?? {})
  .filter(([key, value]) => /\.js$/.test(target(value) ?? ''))
  .map(([key]) => key)
  .filter((key) => !['./models', './layout', './side-nav/recipe'].includes(key))
  .map((key) => `@oddkin/components${key.slice(1)}`);

describe('minimal component consumers', () => {
  it('cover every component, foundation, and registration entry', () => {
    expect(consumerEntries).toEqual(
      expect.arrayContaining([
        '@oddkin/components/button',
        '@oddkin/components/button/foundation',
        '@oddkin/components/define/button',
        '@oddkin/components/define/side-nav',
        '@oddkin/components/styles',
      ]),
    );
  });

  it.each(consumerEntries)(
    '%s loads no tooling, validators, schemas, or recipe engine',
    async (entry) => {
      const reached = await reach(entry);
      const loaded = EXCLUDED.filter(([, test]) => test(reached)).map(([label]) => label);
      expect(loaded).toEqual([]);
    },
  );

  it('the opt-in entries are where models and the recipe engine live', async () => {
    expect((await reach('@oddkin/components/models')).specifiers).toContain('@oddkin/core/model');
    expect((await reach('@oddkin/components/layout')).specifiers).toContain('@oddkin/core/layout');
    expect((await reach('@oddkin/components/side-nav/recipe')).specifiers).toContain(
      '@oddkin/core/layout',
    );
  });
});
