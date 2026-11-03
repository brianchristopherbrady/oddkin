// Build generated token assets after `tsc -b`:
// - @oddkin/tokens/css/default.css from packages/tokens/themes/default.theme.json (Node API)
// - @oddkin/tokens/scss/refs and /scss/values, the default theme's Sass modules
// - examples/tokens-css-only/generated/*.css via the real `oddkin-tokens` CLI binary
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { emitScssRefs, emitScssValues } from '../packages/tokens/dist/generate/index.js';
import { buildTheme, formatDiagnostics } from '../packages/tokens/dist/node/index.js';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const config = JSON.parse(await readFile('packages/tokens/themes/default.theme.json', 'utf8'));
const { result, files } = await buildTheme(config, {
  outDir: 'packages/tokens/dist/css',
  formats: ['css'],
});
if (!result.ok || result.diagnostics.length) fail(formatDiagnostics(result.diagnostics));
// Token inspection for tooling (@oddkin/tokens/inspect/default.json): component metadata
// references these facts instead of recomputing them.
const inspection = await buildTheme(config, {
  outDir: 'packages/tokens/dist/inspect',
  formats: ['json'],
});
if (!inspection.result.ok) fail(formatDiagnostics(inspection.result.diagnostics));
// Sass modules (`@use 'pkg:@oddkin/tokens/scss/refs' as oddkin;`), named for their export paths.
await mkdir('packages/tokens/dist/scss', { recursive: true });
const scss = [
  ['packages/tokens/dist/scss/refs.scss', emitScssRefs(result.theme)],
  ['packages/tokens/dist/scss/values.scss', emitScssValues(result.theme)],
];
for (const [path, text] of scss) await writeFile(path, text);
const written = [...files, ...inspection.files, ...scss.map(([path]) => path)];

const cli = spawnSync(
  process.execPath,
  [
    'packages/tokens/dist/node/bin.js',
    'build',
    'examples/tokens-css-only/theme.json',
    '--out',
    'examples/tokens-css-only/generated',
    '--format',
    'css',
    '--strict',
  ],
  { encoding: 'utf8' },
);
if (cli.status !== 0) fail(`oddkin-tokens failed (${cli.status}):\n${cli.stderr}${cli.stdout}`);

console.log(
  `Token assets: ${[
    ...written,
    ...cli.stdout
      .trim()
      .split('\n')
      .map((l) => l.replace(/^wrote /, '')),
  ].join(', ')}`,
);
