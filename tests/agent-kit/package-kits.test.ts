import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it, vi } from 'vitest';
import { resolveProjectContext } from '../../packages/analyzer/src/kit/context.js';
import { GUIDE_BUDGET } from '../../packages/analyzer/src/kit/kit.js';
import { packageKit } from '../../packages/analyzer/src/kit/package-kit.js';
import { repo } from './acme.js';

// Version-matched agent kits inside the packages (ADR 0046 D6): what the build writes into
// packages/<name>/agent/ and the tarball ships (verify-packs checks the packed copy).
vi.setConfig({ testTimeout: 60_000 });

const json = (path: string) => JSON.parse(readFileSync(join(repo, path), 'utf8'));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(
  json('docs/schemas/agent-kit.v1.schema.json') as object,
);
const project = resolveProjectContext(repo);
const library = (name: string) => project.libraries.find((l) => l.name === name)!;

describe('packaged agent kits', () => {
  it('ship the guide, references, JSON, and llms.txt for @oddkin/components', async () => {
    const { dir, files, manifest } = await packageKit(project, library('@oddkin/components'));
    expect(dir.replaceAll('\\', '/')).toMatch(/packages\/components\/agent$/);
    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(manifest.packaging).toEqual(['llms-txt']);
    // No workspace inputs file: a consumer has nothing to compare it with.
    expect(files.has('inputs.json')).toBe(false);
    // No JSON bundles: the package ships the metadata and manifest they would repeat.
    expect([...files.keys()].filter((path) => path.startsWith('json/'))).toEqual([]);
    for (const entry of manifest.entries) expect(files.has(entry.path), entry.path).toBe(true);
    const guide = files.get('GUIDE.md')!;
    expect(Buffer.byteLength(guide)).toBeLessThanOrEqual(GUIDE_BUDGET);
    expect(guide).toContain('matches the installed version');
    expect(guide).not.toContain('scripts/agent-kit');
    // The repository's own commands mean nothing in a project that installs the package.
    expect(guide).not.toContain('## Workspace commands');
    expect(guide).toContain('references/composition.md');
    expect(guide).toContain('`@oddkin/components/oddkin.metadata.json`');
    const llms = files.get('llms.txt')!;
    expect(llms.split('\n')[0]).toBe(`# @oddkin/components ${manifest.library.version}`);
    expect(llms).toContain('- [GUIDE.md](GUIDE.md)');
    expect(llms).toMatch(/- \[odd-button\]\(references\/components\/odd-button\.md\): \S/);
  });

  it('record the metadata they were generated from', async () => {
    const { manifest } = await packageKit(project, library('@oddkin/ai'));
    const hash = createHash('sha256')
      .update(readFileSync(join(repo, 'packages/ai/oddkin.metadata.json')))
      .digest('hex');
    expect(manifest.metadata).toEqual({ file: 'oddkin.metadata.json', sha256: hash });
    expect(manifest.entries.some((e) => e.kind === 'composition')).toBe(false);
  });

  it('document the composition entry from what the package publishes', async () => {
    const { files } = await packageKit(project, library('@oddkin/components'));
    const text = files.get('references/composition.md')!;
    expect(text).toContain("from '@oddkin/components/composition'");
    expect(text).toMatch(/`validateComposition\(document: unknown/);
    expect(text).toMatch(/`renderComposition\(document: unknown, target: ParentNode/);
    // The types the entry's functions take and return, with their members and doc comments.
    expect(text).toContain('- `RenderCompositionOptions`');
    expect(text).toContain(
      '  - `allow: readonly string[]`: Every tag the renderer may create, natives included; anything else is refused.',
    );
    expect(text).toContain('  - `onAction?: (action: CompositionAction) => void`: ');
    expect(text).toContain(
      '- `CompositionAction`: An event of a rendered element, mapped to an action name by the composition.\n',
    );
    expect(text).toContain('- `CompositionNode = string | CompositionElement`');
    expect(text).toContain('  - `dispose(): void`: Removes the nodes and their action listeners.');
    expect(text).toContain('@oddkin/components/schemas/composition/composition.v1.json');
    expect(text).toContain('`odd-button`');
    // The example parses and names the document schema.
    const example = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(text)![1]!);
    expect(example.$schema).toBe('https://oddkin.dev/schemas/composition/composition.v1.json');
  });

  it('come out the same from the installed package, so a project can check them', async () => {
    // A project that installs the packages: their published files, copied out of the workspace.
    const consumer = mkdtempSync(join(tmpdir(), 'oddkin-kit-'));
    try {
      const names = ['core', 'tokens', 'components'];
      writeFileSync(
        join(consumer, 'package.json'),
        JSON.stringify({
          name: 'consumer',
          private: true,
          dependencies: Object.fromEntries(names.map((name) => [`@oddkin/${name}`, '*'])),
        }),
      );
      for (const name of names) {
        const from = join(repo, 'packages', name);
        const manifest = json(`packages/${name}/package.json`) as { files: string[] };
        for (const entry of ['package.json', ...manifest.files.filter((f) => f !== 'agent')])
          if (existsSync(join(from, entry)))
            cpSync(join(from, entry), join(consumer, 'node_modules', '@oddkin', name, entry), {
              recursive: true,
            });
      }
      const installed = resolveProjectContext(consumer);
      const components = installed.libraries.find((l) => l.name === '@oddkin/components')!;
      expect(components.owned).toBe(false);
      const regenerated = await packageKit(installed, components);
      const built = await packageKit(project, library('@oddkin/components'));
      expect([...regenerated.files.keys()].sort()).toEqual([...built.files.keys()].sort());
      for (const [path, text] of built.files) expect(regenerated.files.get(path), path).toBe(text);
    } finally {
      rmSync(consumer, { recursive: true, force: true });
    }
  });
});
