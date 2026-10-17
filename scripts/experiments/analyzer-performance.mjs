// Experiment (M3, ADR 0018): analyzer front-end performance on a synthetic 50-component
// library. Compares the TypeScript 5.9 in-process compiler API (full, warm, incremental)
// with TypeScript 7's unstable IPC API probe.
// Usage: node scripts/experiments/analyzer-performance.mjs [componentCount]
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const count = Number(process.argv[2] ?? 50);
const root = resolve('.tmp/synthetic-library');
await rm(root, { recursive: true, force: true });
await mkdir(join(root, 'src'), { recursive: true });

const component = (i) => `import { MoteElement, css, event, html, prop } from '@mote/core';

/** Fired when item ${i} changes. */
export const change${i} = event<{ value: string; index: number }>('item-${i}-change', { bubbles: true, composed: true, cancelable: false, syncs: 'value' });

/**
 * Synthetic component ${i}.
 * @csspart label - The label.
 */
export class Item${i} extends MoteElement.with({
  value: prop.string({ default: 'v${i}', description: 'Current value.' }),
  label: prop.string({ default: 'Item ${i}' }),
  count: prop.number({ default: ${i} }),
  open: prop.boolean({ reflect: true }),
  tone: prop.enum(['neutral', 'info', 'danger'], { default: 'neutral', reflect: true }),
  items: prop.array<string>(),
}) {
  static override styles = css\`:host { display: block; gap: var(--item-gap, 1rem); color: var(--mote-color-text-primary); }\`;
  static override events = { change${i} };

  select(value: string): void {
    this.value = value;
    this.setState('selected', true);
    this.emit(change${i}, { value, index: ${i} });
  }

  protected override render() {
    return html\`<div part="label"><slot name="label"></slot>\${this.label}</div><slot></slot>\`;
  }
}
`;

const files = [];
for (let i = 0; i < count; i++)
  files.push(writeFile(join(root, 'src', `item-${i}.ts`), component(i)));
const index = [
  "import { define } from '@mote/core';",
  ...Array.from({ length: count }, (_, i) => `import { Item${i} } from './item-${i}.js';`),
  ...Array.from({ length: count }, (_, i) => `define('synthetic-item-${i}', Item${i});`),
].join('\n');
files.push(writeFile(join(root, 'src', 'index.ts'), `${index}\n`));
files.push(
  writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: '@synthetic/ui', version: '1.0.0', type: 'module' }),
  ),
);
files.push(
  writeFile(
    join(root, 'tsconfig.json'),
    JSON.stringify({
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        composite: false,
        declaration: false,
        declarationMap: false,
        noEmit: true,
        rootDir: 'src',
        outDir: 'dist',
        lib: ['ES2023', 'DOM', 'DOM.Iterable'],
      },
      include: ['src'],
    }),
  ),
);
await Promise.all(files);
const project = join(root, 'tsconfig.json');

const time = (fn) => {
  const start = performance.now();
  const value = fn();
  return { ms: Math.round(performance.now() - start), value };
};

// Cold: a fresh Node process loading TypeScript 5.9 and analyzing once.
const cold = time(() =>
  execFileSync(
    process.execPath,
    ['packages/analyzer/dist/bin.js', project, '--out', join(root, 'out')],
    { encoding: 'utf8' },
  ),
);

// Warm and incremental, in-process.
const { analyze } = await import('../../packages/analyzer/dist/index.js');
const first = time(() => analyze({ project }));
const warm = time(() => analyze({ project }));
await writeFile(
  join(root, 'src', 'item-0.ts'),
  component(0).replace('Synthetic component 0.', 'Synthetic component 0, edited.'),
);
const incremental = time(() => analyze({ project, oldProgram: warm.value.program }));
const components = Object.keys(warm.value.metadata.components).length;

// TypeScript 7 unstable API: the analyzability probe (fresh process; includes tsgo startup).
const ts7 = time(() =>
  execFileSync(process.execPath, ['scripts/experiments/analyzability-probe.mjs', project], {
    encoding: 'utf8',
  }),
);
const ts7Components = JSON.parse(ts7.value).length;

const report = {
  components,
  ts59: {
    coldProcessMs: cold.ms,
    firstInProcessMs: first.ms,
    warmMs: warm.ms,
    incrementalAfterOneEditMs: incremental.ms,
    diagnostics: warm.value.diagnostics.length,
  },
  ts7UnstableProbe: {
    coldProcessMs: ts7.ms,
    componentsFound: ts7Components,
    scope: 'with() properties only',
  },
  node: process.version,
};
console.log(JSON.stringify(report, null, 2));
