import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generate } from '@oddkin/tokens/generate';
import { emitInspectJson } from '@oddkin/tokens/generate';
import { compareSnapshots, createSnapshot, type SnapshotInputs } from '../src/impact.js';

// The impact prototype on the real @oddkin/components outputs and default theme: every module a
// definition, class, or example names is hashed, so nothing is a coverage gap.

const pkgDir = new URL('../../components/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, pkgDir), 'utf8');
const json = <T>(path: string) => JSON.parse(read(path)) as T;

type Package = SnapshotInputs['packages'][number] & { modules: Record<string, string> };

function inputs(): SnapshotInputs & { packages: Package[] } {
  const manifest = json<SnapshotInputs['packages'][number]['manifest']>('custom-elements.json');
  const metadata = json<SnapshotInputs['packages'][number]['metadata']>('oddkin.metadata.json');
  const pkg = json<{ name: string; version: string; exports: Record<string, unknown> }>(
    'package.json',
  );
  const paths = new Set<string>([
    ...manifest.modules.filter((m) => m.declarations?.some((d) => d.tagName)).map((m) => m.path!),
    ...Object.values(metadata.components ?? {}).flatMap((c) => [
      ...(c.definition?.template ? [c.definition.template.module] : []),
      ...(c.definition?.styles ?? []).map((s) => s.module),
    ]),
    ...Object.values(metadata.examples ?? {}).flatMap((e) => (e.file ? [e.file] : [])),
  ]);
  const config = JSON.parse(
    readFileSync(new URL('../../tokens/themes/default.theme.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
  const theme = generate(config).theme!;
  return {
    packages: [
      {
        name: pkg.name,
        version: pkg.version,
        exports: pkg.exports,
        manifest,
        metadata,
        modules: Object.fromEntries([...paths].map((path) => [path, read(path)])),
      },
    ],
    theme: { config, inspection: JSON.parse(emitInspectJson(theme)) },
  };
}
const selected = (base: SnapshotInputs, head: SnapshotInputs) =>
  compareSnapshots(createSnapshot(base), createSnapshot(head))
    .checks.filter((c) => c.state === 'selected')
    .map((c) => c.id)
    .sort();

describe('change impact on @oddkin/components', () => {
  it('reads every source it depends on: no coverage gaps, no unresolved token reads', () => {
    const snapshot = createSnapshot(inputs());
    expect(snapshot.unresolved).toEqual([]);
    expect(Object.values(snapshot.items).filter((i) => i.kind === 'component')).toHaveLength(4);
  });

  it('a side-nav structural style edit selects only side-nav examples, mistakes excluded', () => {
    const head = inputs();
    head.packages[0]!.modules['dist/side-nav/side-nav.structural.styles.js'] += '\n';
    expect(selected(inputs(), head)).toEqual(
      ['controlled', 'currentInGroup', 'declarative', 'default', 'regions', 'wide'].map(
        (name) => `example:odd-side-nav/${name}`,
      ),
    );
  });

  it('a button template edit also selects the card and input examples whose fixtures render a button', () => {
    const head = inputs();
    head.packages[0]!.modules['dist/button/button.template.js'] += '\n';
    expect(selected(inputs(), head)).toEqual(
      [
        ...[
          'default',
          'disabled',
          'fullWidth',
          'ghost',
          'inForm',
          'large',
          'loading',
          'primary',
          'secondary',
          'small',
        ].map((name) => `example:odd-button/${name}`),
        'example:odd-card/headed',
        'example:odd-input/inForm',
      ].sort(),
    );
  });
});
