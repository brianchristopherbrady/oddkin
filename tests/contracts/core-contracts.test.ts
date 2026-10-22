import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contractIndex, resolveContract } from '@oddkin/analyzer';
import { SOURCE, TARGETS, generateContracts } from '../../scripts/contracts.mjs';

// docs/architecture/core-contracts.md is the only source of the contract text @oddkin/core ships
// (CONTRACTS.md, contracts.json); ids are stable and resolve offline against the installed package.

const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const generated = generateContracts(read(SOURCE));

// Renaming or removing an id breaks references in published metadata: change this list deliberately.
const IDS = [
  'binding-rule',
  'composition',
  'properties',
  'events',
  'lifecycle',
  'scope',
  'controllers',
  'i18n',
  'reactivity',
  'external-store',
  'copies',
  'templates',
  'rendering',
  'update-complete',
  'failure-ownership',
  'roles',
].map((name) => `contract:core/${name}`);

describe('core contracts', () => {
  it('are generated from the canonical document and current (run `npm run contracts`)', () => {
    expect(generated.problems).toEqual([]);
    expect(read(TARGETS.markdown), TARGETS.markdown).toBe(generated.markdown);
    expect(read(TARGETS.index), TARGETS.index).toBe(generated.index);
  });

  it('keep their stable ids, each mapped to one section of the packaged file', () => {
    expect(generated.ids).toEqual(IDS);
    const markdown = read(TARGETS.markdown);
    const index = JSON.parse(read(TARGETS.index)) as {
      package: string;
      file: string;
      contracts: Record<string, { title: string; anchor: string }>;
    };
    expect([index.package, index.file]).toEqual(['@oddkin/core', 'CONTRACTS.md']);
    expect(Object.keys(index.contracts)).toEqual(IDS);
    for (const [id, { title, anchor }] of Object.entries(index.contracts)) {
      expect(markdown.split(`<a id="${anchor}"></a>`), id).toHaveLength(2);
      expect(markdown, id).toContain(`## ${title}\n\nId: \`${id}\``);
    }
    // Repository links and research citations do not resolve in an installed package.
    expect(markdown).not.toMatch(/\]\((?!#|https?:)/);
    expect(markdown).not.toMatch(/\[R\d+/);
  });

  it('ship in the @oddkin/core package', () => {
    const manifest = JSON.parse(read('packages/core/package.json')) as {
      files: string[];
      exports: Record<string, unknown>;
    };
    expect(manifest.files).toEqual(expect.arrayContaining(['CONTRACTS.md', 'contracts.json']));
    expect(manifest.exports['./CONTRACTS.md']).toBe('./CONTRACTS.md');
    expect(manifest.exports['./contracts.json']).toBe('./contracts.json');
  });

  it('report malformed markers instead of generating', () => {
    const problems = (source: string) =>
      generateContracts(source).problems.map((p) => p.replace(/^.*?:\d+: /, ''));
    expect(problems('<!-- contract:core/a "A" -->\ntext')).toEqual([
      'contract:core/a is never closed',
    ]);
    expect(
      problems(
        '<!-- contract:core/a "A" -->\n<!-- contract:core/b "B" -->\n<!-- /contract:core/a -->',
      ),
    ).toEqual([
      'contract:core/a closes contract:core/b',
      'contract:core/a is never closed',
      'contract:core/b is never closed',
    ]);
    expect(problems('<!-- contract:app/a "A" -->\nx\n<!-- /contract:app/a -->')).toEqual([
      'contract:app/a is not a contract:core/ id',
    ]);
    expect(
      problems(
        '<!-- contract:core/a "A" -->\nx\n<!-- /contract:core/a -->\n<!-- contract:core/a "B" -->\ny\n<!-- /contract:core/a -->',
      ),
    ).toEqual(['contract:core/a is titled both "A" and "B"']);
    expect(problems('<!-- contract: core/a -->')).toEqual(['malformed contract marker']);
    expect(problems('<!-- contract:core/a "A" -->\n\n<!-- /contract:core/a -->')).toEqual([
      'contract:core/a has no text',
    ]);
  });

  it('resolve offline against the installed package, with its version', () => {
    const version = (JSON.parse(read('packages/core/package.json')) as { version: string }).version;
    const index = contractIndex('@oddkin/core', fileURLToPath(root));
    expect(index?.version).toBe(version);
    for (const id of IDS) {
      const contract = resolveContract(id);
      expect(contract?.version, id).toBe(version);
      expect(contract?.path.endsWith('CONTRACTS.md'), id).toBe(true);
      expect(contract?.text, id).toMatch(new RegExp(`^<a id="${contract?.anchor}"></a>`));
      expect(contract?.text, id).toContain(`Id: \`${id}\``);
    }
    expect(resolveContract('contract:core/nonexistent')).toBeUndefined();
    expect(resolveContract('contract:nowhere/scope')).toBeUndefined();
    expect(resolveContract('core/scope')).toBeUndefined();
  });

  it('are the only contracts published metadata references, at the current text', () => {
    const index = JSON.parse(read(TARGETS.index)) as {
      contracts: Record<string, { sha256: string }>;
    };
    for (const pkg of ['components', 'ai']) {
      const metadata = JSON.parse(read(`packages/${pkg}/oddkin.metadata.json`)) as {
        components: Record<string, { contracts?: string[] }>;
        contracts?: Record<string, { sha256: string; anchor: string }>;
      };
      const cited = new Set(Object.values(metadata.components).flatMap((c) => c.contracts ?? []));
      expect(cited.size, pkg).toBeGreaterThan(0);
      expect(Object.keys(metadata.contracts ?? {}).sort(), pkg).toEqual([...cited].sort());
      for (const [id, entry] of Object.entries(metadata.contracts ?? {}))
        expect(entry.sha256, `${pkg} ${id}`).toBe(index.contracts[id]?.sha256);
    }
  });
});
