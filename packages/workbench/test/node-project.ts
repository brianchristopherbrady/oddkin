/**
 * Throwaway projects for the Node tests: a project directory inside the repository (so
 * `@oddkin/*` packages resolve) with its own `node_modules` holding an "Acme" library.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

let count = 0;

/** Create `files` (relative path → content) in a new project directory and return it. */
export function makeProject(files: Readonly<Record<string, string>>): string {
  const dir = join(process.cwd(), '.tmp', `wb-${process.pid}-${++count}`);
  rmSync(dir, { recursive: true, force: true });
  for (const [path, content] of Object.entries(files)) {
    const file = join(dir, ...path.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return dir;
}

export function removeProject(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const acmeMetadata = () => {
  const metadata = JSON.parse(fixture('acme.oddkin.metadata.json')) as {
    foundations: Record<string, Record<string, unknown>>;
  };
  // The spacing foundation references @acme/tokens' inspection, as Oddkin libraries do.
  metadata.foundations['foundation:spacing'] = {
    ...metadata.foundations['foundation:spacing'],
    generation: {
      value: { theme: 'acme', source: { package: '@acme/tokens', export: './inspect.json' } },
      provenance: 'extracted',
    },
  };
  return metadata;
};

/** An Acme project: config, the library, one dependency, and a token package. */
export function acmeProject(extra: Readonly<Record<string, string>> = {}): string {
  return makeProject({
    'package.json': json({ name: 'acme-docs', private: true, type: 'module' }),
    'oddkin.config.ts': `const config: { library: { packages: string[] }; branding: { name: string } } = {
  library: { packages: ['@acme/ui'] },
  branding: { name: 'Acme UI' },
};
export default config;
`,
    'node_modules/@acme/ui/package.json': json({
      name: '@acme/ui',
      version: '1.4.0',
      type: 'module',
      customElements: './custom-elements.json',
      exports: {
        '.': './dist/index.js',
        './define/button': './dist/define/button.js',
        './oddkin.metadata.json': './oddkin.metadata.json',
        './package.json': './package.json',
      },
      dependencies: { '@acme/icons': '^2.0.0', '@acme/tokens': '^1.0.0' },
    }),
    'node_modules/@acme/ui/custom-elements.json': fixture('acme.custom-elements.json'),
    'node_modules/@acme/ui/oddkin.metadata.json': json(acmeMetadata()),
    'node_modules/@acme/ui/dist/index.js': "export * from '@acme/icons';\n",
    'node_modules/@acme/ui/dist/define/button.js':
      "import { icon } from '@acme/icons';\ncustomElements.define('acme-button', class extends HTMLElement { connectedCallback() { this.textContent = icon; } });\n",
    'node_modules/@acme/ui/src/secret.ts': '// not exported, but inside the package\n',
    'node_modules/@acme/icons/package.json': json({
      name: '@acme/icons',
      version: '2.1.0',
      type: 'module',
      exports: './index.js',
    }),
    'node_modules/@acme/icons/index.js': "export const icon = '★';\n",
    'node_modules/@acme/tokens/package.json': json({
      name: '@acme/tokens',
      version: '1.0.0',
      exports: { './inspect.json': './dist/acme.inspect.json', './package.json': './package.json' },
    }),
    'node_modules/@acme/tokens/dist/acme.inspect.json': json({
      theme: 'acme',
      tokens: [
        { name: 'space.sm', cssVariable: '--acme-space-sm', value: '0.5rem' },
        { name: 'space.md', cssVariable: '--acme-space-md', value: '1rem' },
      ],
    }),
    ...extra,
  });
}
