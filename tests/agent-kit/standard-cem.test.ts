import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { afterAll, describe, expect, it } from 'vitest';
import { main } from '../../packages/analyzer/src/kit/cli.js';
import {
  exportedSpecifier,
  resolveProjectContext,
  standardComponents,
} from '../../packages/analyzer/src/kit/context.js';
import { generateKit } from '../../packages/analyzer/src/kit/kit.js';
import { packageKit } from '../../packages/analyzer/src/kit/package-kit.js';
import {
  exportedSpecifier as workbenchSpecifier,
  type PackageManifest,
} from '../../packages/workbench/src/data/import-map.js';
import { repo } from './acme.js';

// A library not built with Oddkin (CF.3): plain custom elements described by a standard Custom
// Elements Manifest alone. Its kit holds what the manifest states and says what is unknown.

const FIXTURE = join(repo, 'tests/consumers/workbench/plain-widgets');
const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'oddkin-standard-cem-'));
  temps.push(dir);
  return dir;
};
const schema = (name: string) =>
  JSON.parse(readFileSync(join(repo, `docs/schemas/${name}.v1.schema.json`), 'utf8')) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats.default(ajv);
const validKit = ajv.compile(schema('agent-kit'));
const validContext = ajv.compile(schema('project-context'));

/** An application that installs @plain/widgets and nothing from Oddkin. */
function consumer(): string {
  const root = temp();
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'plain-app',
      private: true,
      dependencies: { '@plain/widgets': '^1.0.0' },
    }),
  );
  mkdirSync(join(root, 'node_modules/@plain'), { recursive: true });
  cpSync(FIXTURE, join(root, 'node_modules/@plain/widgets'), { recursive: true });
  return root;
}

describe('a library described by a standard CEM alone', () => {
  it('enters the project context with what its manifest states, and no Oddkin adoption path', () => {
    const project = resolveProjectContext(consumer());
    expect(validContext(project.context), JSON.stringify(validContext.errors)).toBe(true);
    const library = project.libraries.find((l) => l.name === '@plain/widgets');
    expect(library?.standard).toEqual({ cemFile: 'custom-elements.json' });
    expect(library?.metadata).toEqual({
      components: {
        'component:plain-chip': {
          tag: 'plain-chip',
          cem: { module: 'chip.js', name: 'PlainChip' },
          registration: '@plain/widgets/chip.js',
          registeredIn: 'chip.js',
        },
      },
    });
    expect(project.context.packages).toEqual([
      expect.objectContaining({
        name: '@plain/widgets',
        registrations: { 'plain-chip': '@plain/widgets/chip.js' },
      }),
    ]);
    expect(project.context.packages[0]).not.toHaveProperty('metadata');
    expect(project.context.capabilityPaths).toEqual([]);
  });

  it("reads its metadata's examples only for the manifest's elements, and no metadata of an unknown schema", () => {
    const root = consumer();
    const dir = join(root, 'node_modules/@plain/widgets');
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    pkg.exports['./oddkin.metadata.json'] = './oddkin.metadata.json';
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
    const metadata = (schema: string) =>
      JSON.stringify({
        schema,
        components: {},
        examples: {
          'example:plain-chip/basic': {
            component: 'component:plain-chip',
            name: 'basic',
            file: 'chip.examples.js',
          },
          'example:plain-gone/basic': {
            component: 'component:plain-gone',
            name: 'basic',
            file: 'gone.examples.js',
          },
        },
      });
    writeFileSync(
      join(dir, 'oddkin.metadata.json'),
      metadata('https://oddkin.dev/schemas/oddkin-metadata/v1.json'),
    );
    const project = resolveProjectContext(root);
    const library = project.libraries.find((l) => l.name === '@plain/widgets');
    expect(library?.standard).toEqual({
      cemFile: 'custom-elements.json',
      metadataFile: 'oddkin.metadata.json',
    });
    expect(Object.keys(library?.metadata['examples'] ?? {})).toEqual(['example:plain-chip/basic']);
    expect(project.diagnostics).toEqual([
      expect.objectContaining({ code: 'metadata.example.undeclared', severity: 'warning' }),
    ]);
    // A later schema is not read: the library is what its manifest states.
    writeFileSync(
      join(dir, 'oddkin.metadata.json'),
      metadata('https://oddkin.dev/schemas/oddkin-metadata/v2.json'),
    );
    const later = resolveProjectContext(root);
    expect(later.libraries.find((l) => l.name === '@plain/widgets')?.standard).toEqual({
      cemFile: 'custom-elements.json',
    });
    expect(later.context.packages[0]).not.toHaveProperty('metadata');
    expect(later.diagnostics).toEqual([
      expect.objectContaining({ code: 'metadata.schema.unsupported', severity: 'error' }),
    ]);
  });

  it('registers through an export that re-exports the defining module, or says none does', () => {
    const cem = JSON.parse(readFileSync(join(FIXTURE, 'custom-elements.json'), 'utf8'));
    const only = (exports: Record<string, string>) =>
      standardComponents('@plain/widgets', { exports }, cem)['component:plain-chip'];
    expect(only({ '.': './index.js' }).registration).toBe('@plain/widgets');
    expect(only({ './other': './other.js' })).toEqual({
      tag: 'plain-chip',
      cem: { module: 'chip.js', name: 'PlainChip' },
      registeredIn: 'chip.js',
    });
  });

  it('names the registration entry Workbench names: exact subpaths, patterns, exclusions, no exports', () => {
    // Workbench's own case (packages/workbench/test/node-inputs.test.ts), through the kit.
    const definition = (path: string, tag: string) => ({
      kind: 'javascript-module',
      path,
      declarations: [{ kind: 'class', name: 'X', customElement: true, tagName: tag }],
      exports: [
        { kind: 'js', name: 'X', declaration: { name: 'X' } },
        { kind: 'custom-element-definition', name: tag, declaration: { name: 'X' } },
      ],
    });
    const registrations = (manifest: Record<string, unknown>, modules: object[]) =>
      Object.fromEntries(
        Object.values<{ tag: string; registration?: string }>(
          standardComponents(manifest['name'] as string, manifest, { modules }),
        ).map((c) => [c.tag, c.registration ?? null]),
      );
    expect(
      registrations(
        {
          name: '@plain/kit',
          exports: {
            '.': './index.js',
            './elements/*': './dist/elements/*.js',
            './elements/secret': null,
          },
        },
        [
          definition('dist/elements/chip.js', 'plain-chip'),
          definition('index.js', 'plain-badge'),
          definition('dist/elements/secret.js', 'plain-secret'),
          definition('internal/other.js', 'plain-other'),
        ],
      ),
    ).toEqual({
      'plain-chip': '@plain/kit/elements/chip',
      'plain-badge': '@plain/kit',
      'plain-secret': null,
      'plain-other': null,
    });
    expect(
      registrations({ name: '@plain/old', main: 'index.js' }, [
        definition('src/old.js', 'plain-old'),
      ]),
    ).toEqual({ 'plain-old': '@plain/old/src/old.js' });
    // Every case resolves as Workbench's import maps do.
    const cases: [Record<string, unknown>, string][] = [
      [{ name: 'a', exports: './i.js' }, 'i.js'],
      [{ name: 'a', exports: { import: './i.js', require: './i.cjs' } }, './i.js'],
      [{ name: 'a', exports: { '.': { development: './dev.js', default: './i.js' } } }, 'i.js'],
      [{ name: 'a', exports: { '.': { development: './dev.js', default: './i.js' } } }, 'dev.js'],
      [{ name: 'a', exports: { './x/*': './dist/x/*.js', './x/hidden': null } }, 'dist/x/y.js'],
      [
        { name: 'a', exports: { './x/*': './dist/x/*.js', './x/hidden': null } },
        'dist/x/hidden.js',
      ],
      [{ name: 'a', exports: { './*': ['./dist/*.js'] } }, 'dist/z.js'],
      [{ name: 'a', exports: { '.': './i.js', require: './i.cjs' } }, 'i.js'],
      [{ name: 'a' }, 'lib/q.js'],
    ];
    for (const [manifest, file] of cases)
      expect(exportedSpecifier(manifest, file), JSON.stringify([manifest, file])).toBe(
        workbenchSpecifier(manifest as unknown as PackageManifest, file),
      );
  });

  it('gets a kit of the manifest facts that states what is unknown, and invents nothing', () => {
    const project = resolveProjectContext(consumer());
    const { files, manifest } = generateKit(project, '@plain/widgets');
    expect(validKit(manifest), JSON.stringify(validKit.errors)).toBe(true);
    expect([...files.keys()].sort()).toEqual([
      'GUIDE.md',
      'inputs.json',
      'json/components.json',
      'kit.json',
      'references/choosing-components.md',
      'references/components/plain-chip.md',
    ]);
    expect(manifest.metadata?.file).toBe('custom-elements.json');
    const reference = files.get('references/components/plain-chip.md')!;
    expect(reference).toContain(
      'Generated from `custom-elements.json` alone: the package publishes no Oddkin metadata',
    );
    expect(reference).toContain("- Register: `import '@plain/widgets/chip.js';`");
    expect(reference).toContain("- Class: `import { PlainChip } from '@plain/widgets';`");
    for (const fact of [
      '`removable`',
      '`plain-remove`',
      '`icon`',
      '`count`',
      '`--plain-chip-color`',
    ])
      expect(reference).toContain(fact);
    expect(reference).toContain('| `count` | none |');
    expect(reference).toContain('Not authored for this component.');
    expect(reference).toContain('None authored.');
    const guide = files.get('GUIDE.md')!;
    expect(guide).toContain(
      "Registration entries: `<plain-chip>` `import '@plain/widgets/chip.js';`.",
    );
    expect(guide).toContain('- `<plain-chip>`');
    expect(guide).toContain('publishes a standard Custom Elements Manifest');
    expect(guide).toContain('- Tokens: no token inspection was found for this library.');
    expect(guide).not.toContain('Property-only values');
    expect(guide).not.toContain('**Other:**');
    const bundle = JSON.parse(files.get('json/components.json')!);
    expect(bundle.entries['component:plain-chip'].metadata).toBeNull();
    expect(bundle.entries['component:plain-chip'].declaration.tagName).toBe('plain-chip');
  });

  it('is packaged by its own workspace, and the command line writes and checks it', async () => {
    const root = temp();
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'plain-repo', private: true, workspaces: ['packages/*'] }),
    );
    cpSync(FIXTURE, join(root, 'packages/widgets'), { recursive: true });
    const project = resolveProjectContext(root);
    const library = project.libraries.find((l) => l.name === '@plain/widgets')!;
    expect(library.owned).toBe(true);
    const { files, manifest } = await packageKit(project, library);
    expect(validKit(manifest), JSON.stringify(validKit.errors)).toBe(true);
    expect(files.get('GUIDE.md')).toContain(
      '- JSON shipped beside this kit: `@plain/widgets/custom-elements.json`, the custom elements manifest.',
    );
    expect(files.get('llms.txt')).toContain(
      '- [custom-elements.json](../custom-elements.json): the custom elements manifest',
    );
    expect(files.get('llms.txt')).not.toContain('oddkin.metadata.json');

    const io = { out: () => {}, err: (text: string) => errors.push(text) };
    const errors: string[] = [];
    expect(await main(['package', '--root', root], io)).toBe(0);
    expect(await main(['package', '--root', root, '--check'], io)).toBe(0);
    const app = consumer();
    expect(await main(['--root', app, '--package', '@plain/widgets'], io)).toBe(0);
    expect(await main(['--root', app, '--package', '@plain/widgets', '--check'], io)).toBe(0);
    expect(errors).toEqual([]);
  });
});
