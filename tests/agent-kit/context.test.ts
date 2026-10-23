import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { resolveProjectContext } from '../../scripts/agent-kit/context.mjs';
import { acmeWorkspace, repo } from './acme.js';

// Agent-kit pilot, item 859: project context (agent-tooling.md §4, project-context.v1). The
// Oddkin cases read this repository's build outputs (`npm run build` first).
vi.setConfig({ testTimeout: 60_000 });

const schema = JSON.parse(
  readFileSync(join(repo, 'docs/schemas/project-context.v1.schema.json'), 'utf8'),
) as object;
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);

/** Tag names a package publishes, from its generated manifest. */
const tags = (dir: string): string[] =>
  (
    JSON.parse(readFileSync(join(repo, `packages/${dir}/custom-elements.json`), 'utf8')) as {
      modules: { declarations?: { tagName?: string }[] }[];
    }
  ).modules
    .flatMap((m) => m.declarations ?? [])
    .flatMap((d) => (d.tagName ? [d.tagName] : []))
    .sort();

describe('project context of the Oddkin repository', () => {
  const { context, diagnostics } = resolveProjectContext(repo);

  it('is a valid project-context.v1 document without diagnostics', () => {
    expect(validate(context), JSON.stringify(validate.errors)).toBe(true);
    expect(diagnostics).toEqual([]);
  });

  it('lists the packages with exports, their registrations, and their published metadata', () => {
    expect(context.packages.map((p) => p.name)).toEqual([
      '@oddkin/ai',
      '@oddkin/analyzer',
      '@oddkin/app',
      '@oddkin/components',
      '@oddkin/core',
      '@oddkin/state',
      '@oddkin/tokens',
      '@oddkin/workbench',
    ]);
    const components = context.packages.find((p) => p.name === '@oddkin/components')!;
    expect(components.registrations).toEqual(
      Object.fromEntries(
        tags('components').map((tag) => [tag, `@oddkin/components/define/${tag.slice(4)}`]),
      ),
    );
    expect(components.registrations?.['odd-side-nav']).toBe('@oddkin/components/define/side-nav');
    expect(components.metadata).toBe('packages/components/oddkin.metadata.json');
    expect(components.exports).toContain('@oddkin/components/define/side-nav');
    expect(components.exports).not.toContain('@oddkin/components/package.json');
  });

  it('finds each component’s source through its source map', () => {
    expect(context.components?.find((c) => c.tag === 'odd-button')).toEqual({
      tag: 'odd-button',
      source: 'packages/components/src/button/button.definition.ts',
    });
    expect(context.components).toHaveLength(tags('components').length + tags('ai').length);
  });

  it('reads theme axes from the inspection the foundations reference', () => {
    expect(context.theme).toEqual({
      themes: ['default'],
      modes: ['light', 'dark'],
      densities: ['compact'],
      profiles: ['layout.compact', 'navigation.compact'],
      products: [],
    });
  });

  it('lists recipes and usable examples, never explained mistakes', () => {
    expect(context.recipes).toContain('recipe:side-nav');
    expect(context.examples).toContain('example:odd-button/default');
    expect(context.examples).not.toContain('example:odd-button/dangerAppearance');
  });

  it('detects conventions, commands, and capability paths', () => {
    expect(context.conventions).toEqual({ componentLayout: 'folders' });
    expect(context.commands).toEqual({
      build: 'npm run build',
      typecheck: 'npm run typecheck',
      test: 'npm test',
      e2e: 'npm run test:e2e',
      lint: 'npm run lint',
      verify: 'npm run verify',
      metadata: 'npm run verify:metadata',
    });
    expect(context.capabilityPaths).toEqual(['application-services', 'core-authoring']);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(resolveProjectContext(repo).context)).toBe(JSON.stringify(context));
  });
});

describe('project context of a consuming workspace', () => {
  const root = acmeWorkspace();
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const project = resolveProjectContext(root, { themeConfig: 'theme.json' });
  const { context } = project;

  it('is valid and reports a declared package that is not installed', () => {
    expect(validate(context), JSON.stringify(validate.errors)).toBe(true);
    expect(project.diagnostics).toEqual([
      expect.objectContaining({ code: 'agent.context.notInstalled', severity: 'warning' }),
    ]);
    expect(project.diagnostics[0]?.message).toContain('@oddkin/state');
  });

  it('describes its own library, prefix, theme, and installed Oddkin packages', () => {
    expect(context.packages).toEqual([
      expect.objectContaining({
        name: '@acme/ui',
        version: '2.3.0',
        peerRanges: { '@oddkin/core': '^0.0.0' },
        registrations: { 'acme-alert': '@acme/ui', 'acme-panel': '@acme/ui' },
        metadata: 'packages/ui/oddkin.metadata.json',
      }),
      { name: '@oddkin/core', version: '0.0.0', exports: ['@oddkin/core'] },
      { name: '@oddkin/tokens', version: '0.0.0', exports: ['@oddkin/tokens'] },
    ]);
    expect(context.components?.map((c) => [c.tag, c.source])).toEqual([
      ['acme-alert', 'packages/ui/dist/alert.js'],
      ['acme-panel', 'packages/ui/dist/panel.js'],
    ]);
    expect(context.theme).toEqual({
      config: 'theme.json',
      themes: ['harbor'],
      modes: ['light', 'dark'],
      densities: ['compact'],
      profiles: ['layout.compact', 'navigation.compact'],
      products: ['lighthouse'],
    });
    expect(context.recipes).toEqual(['recipe:panel']);
    expect(context.conventions.componentLayout).toBe('colocated');
    expect(context.commands).toEqual({
      build: 'npm run build',
      test: 'npm test',
      lint: 'npm run lint',
    });
    expect(context.capabilityPaths).toEqual(['components-without-state', 'core-authoring']);
  });

  it('fingerprints metadata, theme configuration, and example files', () => {
    const before = context.fingerprint.inputs;
    expect([...project.inputs.keys()].sort()).toEqual([
      'node_modules/@oddkin/core/package.json',
      'node_modules/@oddkin/tokens/package.json',
      'package.json',
      'packages/tokens/inspect.json',
      'packages/ui/custom-elements.json',
      'packages/ui/oddkin.metadata.json',
      'packages/ui/package.json',
      'packages/ui/src/panel.examples.ts',
      'theme.json',
    ]);
    for (const file of ['theme.json', 'packages/ui/src/panel.examples.ts']) {
      const path = join(root, file);
      const original = readFileSync(path, 'utf8');
      writeFileSync(path, `${original}\n`);
      expect(
        resolveProjectContext(root, { themeConfig: 'theme.json' }).context.fingerprint.inputs,
        file,
      ).not.toBe(before);
      writeFileSync(path, original);
    }
    expect(
      resolveProjectContext(root, { themeConfig: 'theme.json' }).context.fingerprint.inputs,
    ).toBe(before);
  });
});
