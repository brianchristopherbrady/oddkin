import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, stableJson } from '@oddkin/analyzer';
import { emitInspectJson, generate } from '@oddkin/tokens/generate';

// A consuming workspace unlike Oddkin's own: prefix acme-, colocated components (the analyzer
// fixture library), the harbor theme with a product, and @oddkin packages installed, not linked.

export const repo = fileURLToPath(new URL('../../', import.meta.url));

const write = (file: string, content: string | object) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === 'string' ? content : stableJson(content));
};

export function acmeWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'oddkin-agent-kit-'));
  const theme = JSON.parse(readFileSync(join(repo, 'examples/tokens-css-only/theme.json'), 'utf8'));
  delete theme.$schema;
  const generated = generate(theme);
  if (!generated.ok || !generated.theme) throw new Error(JSON.stringify(generated.diagnostics));
  const inspection = JSON.parse(emitInspectJson(generated.theme, generated.diagnostics));
  const result = analyze({
    project: join(repo, 'tests/fixtures/analyzer-library/tsconfig.json'),
    library: { name: '@acme/ui', version: '2.3.0', prefix: 'acme-' },
    tokens: { inspection, source: { package: '@acme/tokens', export: './inspect.json' } },
  });
  const metadata = {
    ...result.metadata,
    examples: {
      'example:acme-panel/basic': {
        component: 'component:acme-panel',
        name: 'basic',
        file: 'src/panel.examples.ts',
      },
    },
  };
  write(join(root, 'package.json'), {
    name: 'acme-app',
    private: true,
    workspaces: ['packages/*'],
    engines: { node: '>=24' },
    scripts: { build: 'acme-build', test: 'vitest run', lint: 'eslint .', dev: 'acme-dev' },
    dependencies: { '@oddkin/tokens': '^0.0.0', '@oddkin/state': '^0.0.0' },
  });
  write(join(root, 'theme.json'), theme);
  write(join(root, 'packages/ui/package.json'), {
    name: '@acme/ui',
    version: '2.3.0',
    type: 'module',
    customElements: './custom-elements.json',
    exports: {
      '.': './dist/index.js',
      './panel': './dist/panel.js',
      './custom-elements.json': './custom-elements.json',
      './oddkin.metadata.json': './oddkin.metadata.json',
    },
    peerDependencies: { '@oddkin/core': '^0.0.0' },
    dependencies: { '@acme/tokens': '2.3.0' },
  });
  write(join(root, 'packages/ui/custom-elements.json'), result.manifest);
  write(join(root, 'packages/ui/oddkin.metadata.json'), metadata);
  write(join(root, 'packages/ui/src/panel.examples.ts'), '// examples for acme-panel\n');
  write(join(root, 'packages/tokens/package.json'), {
    name: '@acme/tokens',
    version: '2.3.0',
    exports: { './inspect.json': './inspect.json' },
  });
  write(join(root, 'packages/tokens/inspect.json'), inspection);
  for (const name of ['core', 'tokens'])
    write(join(root, `node_modules/@oddkin/${name}/package.json`), {
      name: `@oddkin/${name}`,
      version: '0.0.0',
      exports: { '.': './index.js' },
    });
  return root;
}
