import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBoundaries } from '../../scripts/architecture/check-boundaries.mjs';

type Files = Record<string, string>;
const roots: string[] = [];

const manifest = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    name,
    version: '0.0.0',
    type: 'module',
    exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
    ...extra,
  });

async function workspace(files: Files): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'oddkin-boundaries-'));
  roots.push(root);
  const all: Files = {
    'package.json': JSON.stringify({ private: true, workspaces: ['packages/*'] }),
    'packages/core/package.json': manifest('@oddkin/core'),
    'packages/core/src/index.ts': "export const core = 'core';\n",
    ...files,
  };
  for (const [path, content] of Object.entries(all)) {
    const full = join(root, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return root;
}

const codes = async (root: string, artifacts = false) =>
  (await checkBoundaries(root, { artifacts })).diagnostics.map((d) => d.code).sort();

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('checkBoundaries', () => {
  describe('registration entries and barrels', () => {
    const componentFiles = {
      'packages/core/src/card/card.ts': 'export class Card {}\n',
      'packages/core/src/card/card.definition.ts':
        "import { Card } from './card.js';\nexport const cardDefinition = { element: Card };\n",
      'packages/core/src/card/card.define.ts':
        "import { cardDefinition } from './card.definition.js';\ndeclare const define: (d: unknown) => void;\ndefine(cardDefinition);\n",
    };

    it('accepts side-effect-free barrels, the define() implementation, and app entries', async () => {
      const root = await workspace({
        ...componentFiles,
        'packages/core/src/card/index.ts':
          "export { Card } from './card.js';\nexport { cardDefinition } from './card.definition.js';\n",
        'packages/core/src/element/define.ts': 'export function define(): void {}\n',
        'packages/core/src/index.ts':
          "export * from './card/index.js';\nexport { define } from './element/define.js';\n",
        'examples/demo/src/define.ts': "import '../../../packages/core/src/card/card.define.js';\n",
        'examples/demo/src/main.ts': "import './define.js';\n",
      });
      expect(await codes(root)).toEqual([]);
    });

    it('rejects a barrel that reaches a *.define module through other modules', async () => {
      const root = await workspace({
        ...componentFiles,
        'packages/core/src/card/register.ts': "import './card.define.js';\nexport {};\n",
        'packages/core/src/card/index.ts':
          "export { Card } from './card.js';\nexport * from './register.js';\n",
      });
      const { diagnostics } = await checkBoundaries(root);
      expect(diagnostics.map((d) => [d.code, d.file])).toEqual([
        ['boundary.registration.barrel', 'packages/core/src/card/register.ts'],
      ]);
      expect(diagnostics[0]?.message).toContain('packages/core/src/card/card.define.ts');
    });

    it('requires registration entries to be declared side-effectful', async () => {
      const files = (sideEffects: unknown) => ({
        ...componentFiles,
        'packages/core/package.json': manifest('@oddkin/core', { sideEffects }),
      });
      expect(await codes(await workspace(files(false)))).toEqual([
        'boundary.registration.sideEffects',
      ]);
      expect(await codes(await workspace(files(['./dist/other.js'])))).toEqual([
        'boundary.registration.sideEffects',
      ]);
      expect(await codes(await workspace(files(['./dist/**/*.define.js'])))).toEqual([]);
      expect(await codes(await workspace(files(['dist/card/card.define.js'])))).toEqual([]);
    });

    it('rejects example barrels importing a define aggregator or a package define subpath', async () => {
      const root = await workspace({
        'examples/demo/src/define.ts': "import './card.define.js';\n",
        'examples/demo/src/card.define.ts': 'customElements.define("x-card", class {});\n',
        'examples/demo/src/index.ts': "import './define.js';\nexport {};\n",
        'examples/other/src/index.ts': "import '@acme/ui/define/button';\nexport {};\n",
      });
      expect(await codes(root)).toEqual([
        'boundary.registration.barrel',
        'boundary.registration.barrel',
      ]);
    });
  });

  it('accepts an allowed dependency through a public export', async () => {
    const root = await workspace({
      'packages/state/package.json': manifest('@oddkin/state', {
        dependencies: { '@oddkin/core': '0.0.0' },
      }),
      'packages/state/src/index.ts':
        "import { core } from '@oddkin/core';\nexport const state = core;\n",
    });
    expect(await codes(root)).toEqual([]);
  });

  it('actually scans imports, including side-effect and type-only imports', async () => {
    const root = await workspace({
      'packages/state/package.json': manifest('@oddkin/state', {
        dependencies: { '@oddkin/core': '0.0.0' },
      }),
      'packages/state/src/index.ts':
        "import '@oddkin/core';\nimport type { core } from '@oddkin/core';\nexport type Core = typeof core;\n",
    });
    const { stats, diagnostics } = await checkBoundaries(root);
    expect(diagnostics).toEqual([]);
    expect(stats).toEqual({ sourceFiles: 2, importsScanned: 2 });
  });

  it('rejects a forbidden package import with a useful message', async () => {
    const root = await workspace({
      'packages/state/package.json': manifest('@oddkin/state', {
        dependencies: { '@oddkin/core': '0.0.0' },
      }),
      'packages/state/src/index.ts': 'export const state = 1;\n',
      'packages/components/package.json': manifest('@oddkin/components', {
        dependencies: { '@oddkin/state': '0.0.0' },
      }),
      'packages/components/src/index.ts': "import '@oddkin/state';\n",
    });
    const { diagnostics } = await checkBoundaries(root);
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      'boundary.dependency.forbidden',
      'boundary.import.forbidden',
    ]);
    const importError = diagnostics.find((d) => d.code === 'boundary.import.forbidden');
    expect(importError?.message).toBe('@oddkin/components may not import @oddkin/state.');
    expect(importError?.file).toBe('packages/components/src/index.ts');
    expect(importError?.fix).toContain('@oddkin/core, @oddkin/tokens');
  });

  it('rejects private deep imports and undeclared dependencies', async () => {
    const root = await workspace({
      'packages/state/package.json': manifest('@oddkin/state'),
      'packages/state/src/index.ts': "import '@oddkin/core/src/internal.js';\n",
    });
    expect(await codes(root)).toEqual(['boundary.import.private', 'boundary.import.undeclared']);
  });

  it('rejects third-party runtime dependencies and imports in browser packages', async () => {
    const root = await workspace({
      'packages/core/package.json': manifest('@oddkin/core', {
        dependencies: { lodash: '^4.0.0' },
      }),
      'packages/core/src/index.ts': "import 'lodash';\n",
    });
    expect(await codes(root)).toEqual([
      'boundary.dependency.thirdParty',
      'boundary.import.thirdParty',
    ]);
  });

  it('rejects Node built-ins in browser code and imports that leave the package', async () => {
    const root = await workspace({
      'packages/core/src/index.ts': "import 'node:fs';\nimport '../../tokens/src/index.js';\n",
    });
    expect(await codes(root)).toEqual([
      'boundary.import.nodeBuiltin',
      'boundary.import.outsidePackage',
    ]);
  });

  it('allows Node-only dependencies only from Node sources of mixed packages', async () => {
    const root = await workspace({
      'packages/analyzer/package.json': manifest('@oddkin/analyzer'),
      'packages/analyzer/src/index.ts': "import 'node:fs';\n",
      'packages/workbench/package.json': manifest('@oddkin/workbench', {
        dependencies: { '@oddkin/analyzer': '0.0.0' },
      }),
      'packages/workbench/src/index.ts': "import '@oddkin/analyzer';\n",
      'packages/workbench/src/node/cli.ts': "import '@oddkin/analyzer';\nimport 'node:path';\n",
    });
    const { diagnostics } = await checkBoundaries(root);
    expect(diagnostics.map((d) => [d.code, d.file])).toEqual([
      ['boundary.import.nodeOnly', 'packages/workbench/src/index.ts'],
    ]);
  });

  it('lets development-only example sources import tooling that shipped code cannot', async () => {
    const files = {
      'packages/workbench/package.json': manifest('@oddkin/workbench', {
        exports: { './examples': './dist/examples/index.js' },
      }),
      'packages/workbench/src/examples/index.ts': 'export const defineExamples = () => {};\n',
      'packages/components/src/button/button.ts': 'export class Button {}\n',
      'packages/components/src/button/button.examples.ts':
        "import { defineExamples } from '@oddkin/workbench/examples';\nimport type {} from './button.js';\nexport default defineExamples();\n",
    };
    const declared = await workspace({
      ...files,
      'packages/components/package.json': manifest('@oddkin/components', {
        devDependencies: { '@oddkin/workbench': '0.0.0' },
      }),
    });
    expect(await codes(declared)).toEqual([]);

    const misused = await workspace({
      ...files,
      'packages/components/package.json': manifest('@oddkin/components'),
      'packages/components/src/index.ts':
        "export { default } from './button/button.examples.js';\n",
      'packages/components/src/button/button.ts':
        "import '@oddkin/workbench/examples';\nexport class Button {}\n",
    });
    const { diagnostics } = await checkBoundaries(misused);
    expect(diagnostics.map((d) => [d.code, d.file]).sort()).toEqual([
      ['boundary.import.devSource', 'packages/components/src/index.ts'],
      ['boundary.import.forbidden', 'packages/components/src/button/button.ts'],
      ['boundary.import.undeclared', 'packages/components/src/button/button.examples.ts'],
    ]);
  });

  it('detects dependency cycles', async () => {
    const root = await workspace({
      'packages/core/package.json': manifest('@oddkin/core', {
        dependencies: { '@oddkin/state': '0.0.0' },
      }),
      'packages/state/package.json': manifest('@oddkin/state', {
        dependencies: { '@oddkin/core': '0.0.0' },
      }),
      'packages/state/src/index.ts': 'export {};\n',
    });
    const { diagnostics } = await checkBoundaries(root, {
      config: {
        packages: {
          '@oddkin/core': { kind: 'browser', allow: ['@oddkin/state'] },
          '@oddkin/state': { kind: 'browser', allow: ['@oddkin/core'] },
        },
      },
    });
    expect(diagnostics.map((d) => d.code)).toEqual(['boundary.cycle']);
    expect(diagnostics[0]?.message).toContain('@oddkin/core -> @oddkin/state -> @oddkin/core');
  });

  it('flags unknown Oddkin packages', async () => {
    const root = await workspace({ 'packages/extra/package.json': manifest('@oddkin/extra') });
    expect(await codes(root)).toEqual(['boundary.package.unknown']);
  });

  it('checks built artifacts for Node reachability and DOM-free entries', async () => {
    const root = await workspace({
      'packages/core/dist/index.js': "import './internal.js';\nexport const core = 1;\n",
      'packages/core/dist/internal.js': "import 'node:fs';\n",
      'packages/core/dist/index.d.ts': 'export declare const core: number;\n',
      'packages/tokens/package.json': manifest('@oddkin/tokens'),
      'packages/tokens/src/index.ts': 'export {};\n',
      'packages/tokens/dist/index.js': 'export const base = HTMLElement;\n',
      'packages/tokens/dist/index.d.ts': 'export {};\n',
    });
    const { diagnostics } = await checkBoundaries(root, { artifacts: true });
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      'boundary.artifact.nodeBuiltin',
      'boundary.domFree.failed',
    ]);
    expect(diagnostics.find((d) => d.code === 'boundary.artifact.nodeBuiltin')?.message).toContain(
      '@oddkin/core -> ./internal.js -> node:fs',
    );
    expect(diagnostics.find((d) => d.code === 'boundary.domFree.failed')?.message).toContain(
      'HTMLElement',
    );
    // Spawns Node for the DOM-free import check; slow under full-suite load.
  }, 30_000);

  it('reports missing artifacts when checking before a build', async () => {
    const root = await workspace({});
    expect(await codes(root, true)).toEqual([
      'boundary.artifact.missing',
      'boundary.artifact.missing',
    ]);
  });

  it('lets framework typings import their framework for types only, from types-only entries', async () => {
    const config = {
      packages: {
        '@oddkin/core': {
          kind: 'browser' as const,
          allow: [],
          typeOnly: { sources: 'src/jsx/', entries: ['./jsx/react'], allow: ['react'] },
        },
      },
    };
    const files = (exports: Record<string, unknown>, typings: string) => ({
      'packages/core/package.json': manifest('@oddkin/core', {
        exports: { '.': { types: './dist/index.d.ts' }, ...exports },
      }),
      'packages/core/src/jsx/react.ts': typings,
      'packages/core/dist/index.d.ts': 'export {};\n',
      'packages/core/dist/jsx/react.d.ts':
        "import type { FC } from 'react';\nexport type X = FC;\n",
    });
    const typesOnly = { './jsx/react': { types: './dist/jsx/react.d.ts' } };
    const check = async (root: string) =>
      (await checkBoundaries(root, { artifacts: true, config })).diagnostics.map((d) => d.code);

    const ok = await workspace(
      files(typesOnly, "import type { FC } from 'react';\nexport type X = FC;\n"),
    );
    expect(await check(ok)).toEqual([]);

    // A value import is not types-only; the same import outside src/jsx/ is not typings at all.
    const value = await workspace(
      files(typesOnly, "import { useState } from 'react';\nuseState;\n"),
    );
    expect(await check(value)).toEqual(['boundary.import.thirdParty']);
    const elsewhere = await workspace({
      ...files(typesOnly, 'export {};\n'),
      'packages/core/src/index.ts': "import type { FC } from 'react';\nexport type X = FC;\n",
    });
    expect(await check(elsewhere)).toEqual(['boundary.import.thirdParty']);

    // A types-only entry with JavaScript, and another package's types in typings, are rejected.
    const runtime = await workspace({
      ...files(
        { './jsx/react': { types: './dist/jsx/react.d.ts', default: './dist/jsx/react.js' } },
        "import type { FC } from 'react';\nexport type X = FC;\n",
      ),
      'packages/core/dist/jsx/react.js': 'export {};\n',
    });
    expect(await check(runtime)).toEqual(['boundary.typeOnly.runtime']);
    const other = await workspace(
      files(typesOnly, "import type { App } from 'vue';\nexport type X = App;\n"),
    );
    expect(await check(other)).toEqual(['boundary.import.thirdParty']);
  });

  describe('browser declarations', () => {
    const config = {
      packages: {
        '@oddkin/core': { kind: 'browser' as const, allow: [] },
        '@oddkin/analyzer': { kind: 'node' as const, allow: [] },
        '@oddkin/tokens': {
          kind: 'mixed' as const,
          allow: [],
          nodeEntries: ['./node'],
          nodeSources: ['src/node/'],
        },
      },
    };
    const typesOnly = (name: string, exports: Record<string, string>) =>
      JSON.stringify({
        name,
        version: '0.0.0',
        type: 'module',
        exports: Object.fromEntries(
          Object.entries(exports).map(([key, types]) => [key, { types }]),
        ),
      });
    // Stand-ins for installed packages, and the workspace links npm makes for Oddkin's own.
    const installed = {
      'node_modules/@types/node/package.json': JSON.stringify({
        name: '@types/node',
        types: 'index.d.ts',
      }),
      'node_modules/@types/node/index.d.ts': 'declare var Buffer: { from(s: string): unknown };\n',
      'node_modules/typescript/package.json': JSON.stringify({
        name: 'typescript',
        types: 'lib/typescript.d.ts',
      }),
      'node_modules/typescript/lib/typescript.d.ts':
        'export interface Node {\n  kind: number;\n}\n',
      'node_modules/pad/package.json': JSON.stringify({ name: 'pad', types: 'index.d.ts' }),
      'node_modules/pad/index.d.ts': 'export declare function pad(s: string): string;\n',
      'packages/analyzer/package.json': typesOnly('@oddkin/analyzer', {
        '.': './dist/index.d.ts',
      }),
      'packages/analyzer/dist/index.d.ts': 'export interface Analysis {\n  ok: boolean;\n}\n',
      'packages/tokens/package.json': typesOnly('@oddkin/tokens', {
        '.': './dist/index.d.ts',
        './node': './dist/node/index.d.ts',
      }),
      'packages/tokens/dist/index.d.ts': 'export declare const tokens: string[];\n',
      'packages/tokens/dist/node/index.d.ts': 'export interface ThemeFile {\n  path: string;\n}\n',
    };
    /** The `boundary.declarations.*` diagnostics for a browser entry declaring `declarations`. */
    const check = async (declarations: string) => {
      const root = await workspace({
        ...installed,
        'packages/core/package.json': typesOnly('@oddkin/core', { '.': './dist/index.d.ts' }),
        'packages/core/dist/index.d.ts': declarations,
      });
      for (const name of ['analyzer', 'tokens']) {
        const link = join(root, 'node_modules', '@oddkin', name);
        await mkdir(dirname(link), { recursive: true });
        await symlink(join(root, 'packages', name), link, 'junction');
      }
      const { diagnostics } = await checkBoundaries(root, { artifacts: true, config });
      return diagnostics.filter((d) => d.code.startsWith('boundary.declarations.'));
    };

    it('accepts declarations a browser project reads with the DOM library alone', async () => {
      expect(
        await check(
          "export declare const host: HTMLElement;\nexport declare const tokens: typeof import('@oddkin/tokens').tokens;\n",
        ),
      ).toEqual([]);
      // A standard library a declaration asks for is TypeScript's, not the compiler's API.
      expect(
        await check('/// <reference lib="esnext" />\nexport declare const host: HTMLElement;\n'),
      ).toEqual([]);
    }, 30_000);

    it("rejects Node's types, by reference or by global", async () => {
      const referenced = await check(
        '/// <reference types="node" />\nexport declare const data: typeof Buffer;\n',
      );
      expect(referenced.map((d) => [d.code, d.file])).toEqual([
        ['boundary.declarations.node', 'packages/core/dist/index.d.ts'],
      ]);
      expect(referenced[0]?.message).toContain('node_modules/@types/node/index.d.ts');
      const global = await check('export declare const data: Buffer;\n');
      expect(global.map((d) => d.code)).toEqual(['boundary.declarations.error']);
      expect(global[0]?.message).toContain("Cannot find name 'Buffer'");
    }, 30_000);

    it("rejects the TypeScript compiler's types, a Node-only package, a Node entry, and third-party types", async () => {
      const cases = {
        'boundary.declarations.compiler':
          "import type { Node } from 'typescript';\nexport type Leak = Node;\n",
        'boundary.declarations.nodeOnly':
          "import type { Analysis } from '@oddkin/analyzer';\nexport type Leak = Analysis;\n",
        'boundary.declarations.thirdParty':
          "import type { pad } from 'pad';\nexport type Leak = typeof pad;\n",
      };
      for (const [code, declarations] of Object.entries(cases))
        expect((await check(declarations)).map((d) => d.code)).toEqual([code]);
      const nodeEntry = await check(
        "import type { ThemeFile } from '@oddkin/tokens/node';\nexport type Leak = ThemeFile;\n",
      );
      expect(nodeEntry.map((d) => d.code)).toEqual(['boundary.declarations.nodeOnly']);
      expect(nodeEntry[0]?.message).toContain('@oddkin/tokens/node, a Node entry');
    }, 60_000);
  });

  describe("a Node package's browser types", () => {
    const config = {
      packages: {
        '@oddkin/core': { kind: 'browser' as const, allow: ['@oddkin/analyzer'] },
        '@oddkin/analyzer': {
          kind: 'node' as const,
          allow: [],
          browserTypes: ['./metadata/types'],
        },
      },
    };
    const analyzer = (types: string, exports: Record<string, unknown> = {}) => ({
      'packages/analyzer/package.json': JSON.stringify({
        name: '@oddkin/analyzer',
        version: '0.0.0',
        type: 'module',
        exports: {
          '.': { types: './dist/index.d.ts', default: './dist/index.js' },
          './metadata/types': { types: './dist/metadata-types.d.ts' },
          ...exports,
        },
      }),
      'packages/analyzer/src/index.ts': "import 'node:fs';\nexport const analyze = 1;\n",
      'packages/analyzer/dist/index.js': "import 'node:fs';\nexport const analyze = 1;\n",
      'packages/analyzer/dist/index.d.ts': 'export declare const analyze: number;\n',
      'packages/analyzer/dist/metadata-types.d.ts': types,
    });
    const core = (source: string, declarations = 'export {};\n') => ({
      'packages/core/package.json': manifest('@oddkin/core', {
        dependencies: { '@oddkin/analyzer': '0.0.0' },
      }),
      'packages/core/src/index.ts': source,
      'packages/core/dist/index.js': 'export {};\n',
      'packages/core/dist/index.d.ts': declarations,
    });
    const run = async (files: Files, artifacts = false) => {
      const root = await workspace(files);
      const link = join(root, 'node_modules', '@oddkin', 'analyzer');
      await mkdir(dirname(link), { recursive: true });
      await symlink(join(root, 'packages', 'analyzer'), link, 'junction');
      return (await checkBoundaries(root, { artifacts, config })).diagnostics.map((d) => [
        d.code,
        d.file,
      ]);
    };
    const types = 'export interface Metadata {\n  readonly name: string;\n}\n';

    it('lets browser code import them with import type only, and nothing else of the package', async () => {
      const typeImport =
        "import type { Metadata } from '@oddkin/analyzer/metadata/types';\nexport type M = Metadata;\n";
      expect(await run({ ...analyzer(types), ...core(typeImport) })).toEqual([]);
      // A value import of the same entry, or a type import of another entry, is Node-only.
      expect(
        await run({
          ...analyzer(types),
          ...core("import { Metadata } from '@oddkin/analyzer/metadata/types';\nMetadata;\n"),
        }),
      ).toEqual([['boundary.import.nodeOnly', 'packages/core/src/index.ts']]);
      expect(
        await run({
          ...analyzer(types),
          ...core(
            "import type { analyze } from '@oddkin/analyzer';\nexport type A = typeof analyze;\n",
          ),
        }),
      ).toEqual([['boundary.import.nodeOnly', 'packages/core/src/index.ts']]);
    });

    it('lets browser declarations reach them, and requires them types-only and import-free', async () => {
      const declarations =
        "import type { Metadata } from '@oddkin/analyzer/metadata/types';\nexport type M = Metadata;\n";
      expect(
        await run({ ...analyzer(types), ...core('export {};\n', declarations) }, true),
      ).toEqual([]);
      const codes = async (files: Files) => (await run(files, true)).map(([code]) => code);
      expect(
        await codes({
          ...analyzer(types, {
            './metadata/types': {
              types: './dist/metadata-types.d.ts',
              default: './dist/metadata-types.js',
            },
          }),
          'packages/analyzer/dist/metadata-types.js': 'export {};\n',
          ...core('export {};\n', declarations),
        }),
      ).toEqual(['boundary.browserTypes.runtime']);
      for (const leak of [
        "import type { Stats } from 'node:fs';\nexport type S = Stats;\n",
        '/// <reference types="node" />\nexport {};\n',
        "export type S = import('node:fs').Stats;\n",
      ])
        expect(await codes({ ...analyzer(leak), ...core('export {};\n', declarations) })).toContain(
          'boundary.browserTypes.imports',
        );
    }, 60_000);
  });
});
