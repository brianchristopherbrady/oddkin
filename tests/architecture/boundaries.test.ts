import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  });

  it('reports missing artifacts when checking before a build', async () => {
    const root = await workspace({});
    expect(await codes(root, true)).toEqual([
      'boundary.artifact.missing',
      'boundary.artifact.missing',
    ]);
  });
});
