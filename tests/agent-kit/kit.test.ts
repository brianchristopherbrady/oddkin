import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { resolveProjectContext } from '../../scripts/agent-kit/context.mjs';
import { checkKit, generateKit, main, writeKit } from '../../scripts/agent-kit/kit.mjs';
import { acmeWorkspace, repo } from './acme.js';

// Agent-kit pilot, items 860–861: kits for @oddkin/components and a consuming library with a
// different prefix, packages, and theme (agent-tooling.md §5, agent-kit.v1), and freshness.
vi.setConfig({ testTimeout: 60_000 });

const json = (path: string) => JSON.parse(readFileSync(join(repo, path), 'utf8'));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(
  json('docs/schemas/agent-kit.v1.schema.json') as object,
);
const temp = mkdtempSync(join(tmpdir(), 'oddkin-kits-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

describe('the @oddkin/components kit', () => {
  const project = resolveProjectContext(repo);
  const { files, manifest } = generateKit(project, '@oddkin/components');
  const file = (path: string) => files.get(path) ?? '';
  const cem = json('packages/components/custom-elements.json');
  const metadata = json('packages/components/oddkin.metadata.json');
  const componentIds = (cem.modules as { declarations?: { tagName?: string }[] }[])
    .flatMap((m) => m.declarations ?? [])
    .flatMap((d) => (d.tagName ? [`component:${d.tagName}`] : []))
    .sort();

  it('has a valid kit.json listing every reference it wrote, with the guide within budget', () => {
    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(componentIds).toContain('component:odd-side-nav');
    expect(manifest.entries.map((e) => e.id)).toEqual([
      ...componentIds,
      'choosing',
      'tokens:component',
      'tokens:foundation',
      'tokens:layout',
      'tokens:reference',
      'tokens:semantic',
      'recipe:side-nav',
      ...Object.keys(metadata.stylesheets).sort(),
      'model:oddkin.navigation',
      'json:components',
      'json:tokens',
      'json:recipes',
      'json:stylesheets',
      'json:models',
    ]);
    expect(Object.keys(metadata.stylesheets)).toContain('stylesheet:layout');
    for (const entry of manifest.entries.filter((e) => e.id.startsWith('stylesheet:')))
      expect([entry.kind, entry.path], entry.id).toEqual([
        'stylesheet',
        `references/stylesheets/${entry.id.slice('stylesheet:'.length)}.md`,
      ]);
    for (const entry of manifest.entries) expect(files.has(entry.path), entry.path).toBe(true);
    expect(manifest.guide.bytes).toBe(Buffer.byteLength(file('GUIDE.md')));
    expect(manifest.guide.bytes).toBeLessThanOrEqual(manifest.guide.budgetBytes);
    expect(manifest.fingerprint.packages).toEqual({
      '@oddkin/components': '0.0.0',
      '@oddkin/core': '0.0.0',
      '@oddkin/tokens': '0.0.0',
    });
  });

  it('states exact imports, registrations, and property-only values from the metadata', () => {
    const sideNav = file('references/components/odd-side-nav.md');
    expect(sideNav).toContain("`import '@oddkin/components/define/side-nav';`");
    expect(sideNav).toContain("`import { OddkinSideNav } from '@oddkin/components/side-nav';`");
    expect(sideNav).toMatch(/\| `items` \| none: assign as a property \|/);
    expect(sideNav).toMatch(
      /\| `odd-toggle` \| CustomEvent<NavigationToggleDetail> \| user \(authored\) \|/,
    );
    expect(sideNav).toContain('- Levels: 1, 2, 3 (authored)');
    expect(file('GUIDE.md')).toContain('`odd-side-nav.items`');
  });

  it('documents exactly the published properties, events, slots, and parts', () => {
    for (const declaration of cem.modules
      .flatMap((m: any) => m.declarations)
      .filter((d: any) => d.tagName)) {
      const reference = file(`references/components/${declaration.tagName}.md`);
      const section = (title: string) =>
        reference.split(`## ${title}\n`)[1]?.split('\n## ')[0] ?? '';
      const names = (title: string) =>
        [...section(title).matchAll(/^\| `([^`]+)`/gm)].map((m) => m[1]);
      expect(names('Properties'), declaration.tagName).toEqual(
        declaration.members.filter((m: any) => m.kind === 'field').map((m: any) => m.name),
      );
      expect(names('Events')).toEqual((declaration.events ?? []).map((e: any) => e.name));
      expect(names('Parts')).toEqual((declaration.cssParts ?? []).map((p: any) => p.name));
      expect(names('Slots')).toEqual(
        (declaration.slots ?? []).filter((s: any) => s.name).map((s: any) => s.name),
      );
    }
  });

  it('lists explained mistakes apart from examples, with their diagnostic and correction', () => {
    const button = file('references/components/odd-button.md');
    const [examples, mistakes] = button.split('Explained mistakes');
    for (const [id, example] of Object.entries(metadata.examples as Record<string, any>)) {
      if (example.component !== 'component:odd-button') continue;
      if (example.incorrect) {
        expect(mistakes).toContain(`\`${id}\` produces \`${example.incorrect.diagnostic}\``);
        expect(examples).not.toContain(`\`${id}\``);
      } else expect(examples).toContain(`\`${id}\``);
    }
  });

  it('documents each document stylesheet: its import, layer, classes, and author variables', () => {
    const layout = file('references/stylesheets/layout.md');
    expect(layout).toContain(
      'Import `@oddkin/components/css/layout.css` once per document; its rules are in the',
    );
    expect(layout).toContain(metadata.stylesheets['stylesheet:layout'].description);
    expect(layout).toMatch(/## Classes\n\n.*`\.odd-stack`/);
    expect(layout).toMatch(/## Variables an author may set\n\n.*`--odd-stack-gap`/);
    expect(layout).toMatch(/## Tokens read\n\n.*`layout\.gap`/);
    expect(file('references/stylesheets/reset.md')).not.toContain('## Classes');
    expect(file('GUIDE.md')).toContain('references/stylesheets/layout.md');
  });

  it('keeps authored guidance authored, with its source', () => {
    const useFor = metadata.components['component:odd-card'].useFor[0];
    expect(file('references/components/odd-card.md')).toContain(
      `- Use for: ${useFor.value} (${useFor.source.file}:${useFor.source.line})`,
    );
    expect(file('references/choosing-components.md')).toContain('## Containers');
  });

  it('bundles contracts keyed by stable id, each with the fingerprint', () => {
    const components = JSON.parse(file('json/components.json'));
    expect(components.fingerprint).toEqual(manifest.fingerprint);
    expect(Object.keys(components.entries)).toEqual(componentIds);
    expect(components.entries['component:odd-card'].metadata).toEqual(
      metadata.components['component:odd-card'],
    );
    const tokens = JSON.parse(file('json/tokens.json'));
    expect(Object.keys(tokens.entries)).toHaveLength(
      json('packages/tokens/dist/inspect/default.inspect.json').tokens.length,
    );
  });

  it('is deterministic', () => {
    const again = generateKit(resolveProjectContext(repo), '@oddkin/components').files;
    expect([...again]).toEqual([...files]);
  });
});

describe('a consuming library’s kit', () => {
  const root = acmeWorkspace();
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const load = () => resolveProjectContext(root, { themeConfig: 'theme.json' });
  const { files, manifest } = generateKit(load(), '@acme/ui');
  const file = (path: string) => files.get(path) ?? '';

  it('describes its own prefix, theme, recipes, and models', () => {
    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(manifest.library).toEqual({ name: '@acme/ui', version: '2.3.0' });
    expect(manifest.entries.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        'component:acme-alert',
        'component:acme-panel',
        'recipe:panel',
        'model:acme.message',
      ]),
    );
    expect(file('references/tokens/semantic.md')).toContain('Theme `harbor`');
    expect(file('references/components/acme-panel.md')).toContain("`import '@acme/ui';`");
    expect(file('references/models/acme.message.md')).toContain(
      '`schemas/acme.message.v1.json` in the package (not exported)',
    );
    expect(file('GUIDE.md')).not.toContain('odd-');
  });

  it('says what is not authored instead of inventing it', () => {
    expect(file('references/components/acme-alert.md')).toContain(
      'Not authored for this component.',
    );
    expect(manifest.entries.find((e) => e.id === 'choosing')).toMatchObject({ notAuthored: true });
    expect(file('references/components/acme-alert.md')).toContain('None authored.');
    expect(file('references/components/acme-alert.md')).toMatch(
      /- Levels: unknown \(not declared\)/,
    );
  });

  it('is current after writing and stale after a metadata, theme, example, or content change', () => {
    const dir = join(temp, 'acme');
    writeKit(dir, files);
    expect(checkKit(dir, load(), '@acme/ui')).toEqual({ status: 'current', changed: [] });
    for (const [path, change] of [
      ['packages/ui/oddkin.metadata.json', 'changed'],
      ['theme.json', 'changed'],
      ['packages/ui/src/panel.examples.ts', 'changed'],
      ['oddkin.docs.ts', 'added'],
    ] as const) {
      const full = join(root, path);
      const original = existsSync(full) ? readFileSync(full, 'utf8') : undefined;
      writeFileSync(full, `${original ?? 'export default {};'}\n`);
      expect(checkKit(dir, load(), '@acme/ui'), path).toEqual({
        status: 'stale',
        changed: [`${path} (${change})`],
      });
      if (original === undefined) rmSync(full);
      else writeFileSync(full, original);
    }
    expect(checkKit(dir, load(), '@acme/ui').status).toBe('current');
    expect(checkKit(join(temp, 'none'), load(), '@acme/ui').status).toBe('missing');
  });

  it('is stale when the generator or a package version changes', () => {
    const dir = join(temp, 'acme-versions');
    const kit = JSON.parse(file('kit.json'));
    kit.fingerprint.generator.version = '0.0.0-pilot.000000000000';
    kit.fingerprint.packages['@acme/ui'] = '2.2.0';
    writeKit(dir, new Map([...files, ['kit.json', JSON.stringify(kit)]]));
    expect(checkKit(dir, load(), '@acme/ui').changed).toEqual([
      expect.stringMatching(/^generator 0\.0\.0-pilot\.000000000000 → 0\.0\.0-pilot\./),
      '@acme/ui 2.2.0 → 2.3.0',
    ]);
  });

  it('never replaces a directory that holds something other than a kit', () => {
    const dir = join(temp, 'occupied');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'notes.txt'), 'mine');
    expect(() => writeKit(dir, files)).toThrow(/refusing/);
    expect(readFileSync(join(dir, 'notes.txt'), 'utf8')).toBe('mine');
  });

  it('names the refresh command when --check finds a stale kit', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = join(temp, 'cli');
    expect(await main(['--root', root, '--theme-config', 'theme.json', '--out', out])).toBe(0);
    expect(
      await main(['--root', root, '--theme-config', 'theme.json', '--out', out, '--check']),
    ).toBe(0);
    writeFileSync(join(root, 'theme.json'), `${readFileSync(join(root, 'theme.json'), 'utf8')}\n`);
    expect(
      await main(['--root', root, '--theme-config', 'theme.json', '--out', out, '--check']),
    ).toBe(1);
    const message = errors.mock.calls.map((c) => String(c[0])).join('\n');
    expect(message).toContain('error agent.kit.stale: @acme/ui');
    expect(message).toContain('theme.json (changed)');
    expect(message).toContain(`→ node scripts/agent-kit/kit.mjs --package @acme/ui --out ${out}`);
    errors.mockRestore();
    logs.mockRestore();
  });
});
