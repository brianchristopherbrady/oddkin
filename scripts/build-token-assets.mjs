// Build generated token assets after `tsc -b`:
// - @oddkin/tokens/css/default.css from packages/tokens/themes/default.theme.json (Node API)
// - examples/tokens-css-only/generated/*.css via the real `oddkin-tokens` CLI binary
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
    ...files,
    ...cli.stdout
      .trim()
      .split('\n')
      .map((l) => l.replace(/^wrote /, '')),
  ].join(', ')}`,
);
