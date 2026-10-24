import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { emitInspectJson, generate } from '@oddkin/tokens/generate';
import {
  compareSnapshots,
  createSnapshot,
  readPackage,
  type SnapshotInputs,
} from '../src/impact.js';

// The impact prototype on the real @oddkin/components outputs and default theme: every module a
// definition, class, or example names is hashed, so nothing is a coverage gap.

type Package = SnapshotInputs['packages'][number] & { modules: Record<string, string> };

function inputs(): SnapshotInputs & { packages: Package[] } {
  const config = JSON.parse(
    readFileSync(new URL('../../tokens/themes/default.theme.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
  const theme = generate(config).theme!;
  return {
    packages: [
      readPackage(fileURLToPath(new URL('../../components/', import.meta.url))) as Package,
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
    const published = (
      JSON.parse(
        readFileSync(new URL('../../components/custom-elements.json', import.meta.url), 'utf8'),
      ) as { modules: { declarations?: { tagName?: string }[] }[] }
    ).modules.flatMap((m) => (m.declarations ?? []).filter((d) => d.tagName));
    expect(Object.values(snapshot.items).filter((i) => i.kind === 'component')).toHaveLength(
      published.length,
    );
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

  it('a button template edit also selects the examples whose fixtures render a button', () => {
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
          'pressed',
          'primary',
          'secondary',
          'small',
          'toggle',
        ].map((name) => `example:odd-button/${name}`),
        'example:odd-alert/danger',
        'example:odd-card/headed',
        'example:odd-checkbox/inForm',
        'example:odd-checkbox-group/inForm',
        ...['alert', 'closedByAny', 'default'].map((name) => `example:odd-dialog/${name}`),
        ...['default', 'inlineStart', 'nonModal'].map((name) => `example:odd-drawer/${name}`),
        'example:odd-empty-state/default',
        'example:odd-input/inForm',
        'example:odd-listbox/inForm',
        'example:odd-select/inForm',
        'example:odd-textarea/inForm',
        ...['danger', 'default', 'timed'].map((name) => `example:odd-toast/${name}`),
        ...['default', 'selection', 'vertical'].map((name) => `example:odd-toolbar/${name}`),
        'example:odd-tooltip/default',
        'example:odd-tooltip/inlineEnd',
      ].sort(),
    );
  });
});
