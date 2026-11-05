import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { analyzeManifest, stableJson } from '../../packages/analyzer/src/index.js';
import {
  compareSnapshots,
  createSnapshot,
  readPackage,
} from '../../packages/analyzer/src/impact.js';
import { resolveProjectContext } from '../../packages/analyzer/src/kit/context.js';
import { generateKit } from '../../packages/analyzer/src/kit/kit.js';
import { llmsText } from '../../packages/analyzer/src/kit/package-kit.js';
import type { ComponentPageData } from '../../packages/workbench/src/data/index.js';
import { buildWorkbench } from '../../packages/workbench/src/node/index.js';
import { pageCoverage } from '../../packages/workbench/src/panels/model.js';

// A library not built with Oddkin, with examples (ADR 0048 §3). @plain/widgets' build runs
// `oddkin-analyze --manifest custom-elements.json` and publishes the oddkin.metadata.json it
// writes, which describes no components. Workbench, change impact, and the agent kits take the
// components from the manifest and the examples from that file.

vi.setConfig({ testTimeout: 60_000 });

const repo = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURE = join(repo, 'tests/consumers/workbench/plain-widgets');
const roots: string[] = [];
afterAll(() =>
  roots.forEach((dir) =>
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }),
  ),
);
let count = 0;

/** An application inside the repository (so `@oddkin/*` resolves) that installs @plain/widgets. */
function project(edit?: (pkg: string) => void): { root: string; pkg: string } {
  const root = join(repo, '.tmp', `plain-examples-${process.pid}-${++count}`);
  rmSync(root, { recursive: true, force: true });
  roots.push(root);
  const pkg = join(root, 'node_modules/@plain/widgets');
  mkdirSync(pkg, { recursive: true });
  cpSync(FIXTURE, pkg, { recursive: true });
  edit?.(pkg);
  const { metadata } = analyzeManifest({ manifest: join(pkg, 'custom-elements.json') });
  writeFileSync(join(pkg, 'oddkin.metadata.json'), stableJson(metadata));
  const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  manifest.exports['./oddkin.metadata.json'] = './oddkin.metadata.json';
  manifest.files.push('oddkin.metadata.json');
  writeFileSync(join(pkg, 'package.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'plain-app', private: true, dependencies: { '@plain/widgets': '^1' } }),
  );
  writeFileSync(
    join(root, 'oddkin.config.mjs'),
    "export default { library: { packages: ['@plain/widgets'] } };\n",
  );
  return { root, pkg };
}
const append = (file: string, text: string) =>
  writeFileSync(file, `${readFileSync(file, 'utf8')}${text}`);
const EXAMPLES = ['basic', 'info', 'removable'].map((name) => `example:plain-chip/${name}`);

describe('a library not built with Oddkin, with examples', () => {
  it('Workbench: presets and examples on the page its manifest describes', async () => {
    const build = await buildWorkbench({ config: project().root });
    expect(build.diagnostics.filter((d) => /^node\.(examples|metadata)/.test(d.code))).toEqual([]);
    const page = build.data!.pages['components/plain-chip'] as ComponentPageData;
    expect(page.enrichment).toBeUndefined();
    expect(page.registration).toBe('@plain/widgets/chip.js');
    expect(page.examples.map((e) => e['id'])).toEqual(EXAMPLES);
    expect(page.examples[1]?.['definition']).toEqual({
      label: 'Info',
      attributes: { label: 'Beta', tone: 'info' },
      preset: true,
    });
    // Only what an Oddkin analysis of the source would add is still labelled missing.
    expect(
      pageCoverage(page)
        .filter((item) => item.state === 'missing')
        .map((item) => item.id),
    ).toEqual([
      'behavior-and-accessibility/a11y',
      'behavior-and-accessibility/keyboard',
      'guidance/use-for',
      'guidance/not-for',
      'guidance/usage-pairs',
    ]);
    // Frames run the fixture from the example module, which registers the element it names.
    expect(page.exampleModule).toBe('/_oddkin/examples/plain-chip.js');
    expect(build.files.get('examples/plain-chip.js')).toMatch(
      /^import "@plain\/widgets\/chip\.js";\n/,
    );
  });

  it('change impact: an edit to the element selects its examples, with reason paths, and leaves no gap', () => {
    const snapshot = (pkg: string) => createSnapshot({ packages: [readPackage(pkg)] });
    const base = snapshot(project().pkg);
    const head = snapshot(
      project((pkg) => append(join(pkg, 'chip.js'), '// a behavior change\n')).pkg,
    );
    const report = compareSnapshots(base, head);
    expect(report.changes.map((c) => [c.id, c.classification])).toEqual([
      ['class:plain-chip', 'review'],
    ]);
    expect(report.checks).toEqual(
      EXAMPLES.map((id) => ({
        id,
        state: 'selected',
        reason: 'an input on its path changed',
        via: ['class:plain-chip', 'component:plain-chip', id],
      })),
    );
    expect(report.coverageGaps).toEqual([]);
    // An edited example file selects its examples for their own sake: each example's item covers
    // its whole file, since examples share module-level code.
    const edited = snapshot(
      project((pkg) => {
        const file = join(pkg, 'chip.examples.js');
        writeFileSync(file, readFileSync(file, 'utf8').replace("label: 'Beta'", "label: 'Alpha'"));
      }).pkg,
    );
    expect(compareSnapshots(base, edited).checks).toEqual(
      EXAMPLES.map((id) => ({ id, state: 'selected', reason: 'the example changed', via: [id] })),
    );
  });

  it('agent kits: the components the manifest states, with their examples, and what is still unknown', () => {
    const { root } = project();
    const context = resolveProjectContext(root);
    const library = context.libraries.find((l) => l.name === '@plain/widgets')!;
    expect(library.standard).toEqual({
      cemFile: 'custom-elements.json',
      metadataFile: 'oddkin.metadata.json',
    });
    expect(context.context.packages).toEqual([
      expect.objectContaining({
        name: '@plain/widgets',
        registrations: { 'plain-chip': '@plain/widgets/chip.js' },
        metadata: 'node_modules/@plain/widgets/oddkin.metadata.json',
      }),
    ]);
    expect(context.context.examples).toEqual(EXAMPLES);
    const { files, manifest } = generateKit(context, '@plain/widgets', { packaged: true });
    const reference = files.get('references/components/plain-chip.md')!;
    expect(reference).toContain(
      "Generated from `custom-elements.json` and the examples in `oddkin.metadata.json`: the package publishes no other Oddkin metadata, so this component's guidance, event intents, and verification are unknown.",
    );
    for (const id of EXAMPLES) expect(reference).toContain(`- \`${id}\` in chip.examples.js`);
    expect(reference).toContain('Not authored for this component.');
    const guide = files.get('GUIDE.md')!;
    expect(guide).toContain('with its exact API from the manifest, and its examples.');
    expect(guide).toContain(
      'publishes a standard Custom Elements Manifest (`custom-elements.json`) and, in `oddkin.metadata.json`, examples only.',
    );
    expect(guide).toContain('`@plain/widgets/oddkin.metadata.json`, the examples by stable id');
    expect(manifest.metadata?.file).toBe('custom-elements.json');
    expect(llmsText(library, manifest)).toContain(
      '- [oddkin.metadata.json](../oddkin.metadata.json): the examples by stable id',
    );
  });

  it('every tool reads the manifest the community analyzer writes (schema 1.0.0)', async () => {
    // `cem analyze --globs chip.js index.js` (@custom-elements-manifest/analyzer 0.11.0) on the
    // fixture's sources, 2026-11-05 (docs/research/cem-analyzer-adapter.md).
    const generated = readFileSync(
      join(repo, 'tests/libraries-without-oddkin/plain-chip.cem-analyzer.json'),
      'utf8',
    );
    expect((JSON.parse(generated) as { schemaVersion: string }).schemaVersion).toBe('1.0.0');
    const { root, pkg } = project((dir) =>
      writeFileSync(join(dir, 'custom-elements.json'), generated),
    );
    const build = await buildWorkbench({ config: root });
    expect(
      build.diagnostics.filter((d) => /^(node\.(cem|examples|metadata)|metadata)\./.test(d.code)),
    ).toEqual([]);
    const page = build.data!.pages['components/plain-chip'] as ComponentPageData;
    expect(page.registration).toBe('@plain/widgets/chip.js');
    expect(page.examples.map((e) => e['id'])).toEqual(EXAMPLES);
    const read = readPackage(pkg);
    expect(read.diagnostics).toEqual([]);
    const items = Object.keys(createSnapshot({ packages: [read] }).items);
    expect(items).toEqual(
      expect.arrayContaining(['component:plain-chip', 'registration:plain-chip', ...EXAMPLES]),
    );
    const context = resolveProjectContext(root);
    expect(context.diagnostics).toEqual([]);
    expect(context.context.packages).toEqual([
      expect.objectContaining({ registrations: { 'plain-chip': '@plain/widgets/chip.js' } }),
    ]);
    expect(context.context.examples).toEqual(EXAMPLES);
  });
});
