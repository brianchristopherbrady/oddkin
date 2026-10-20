// Type-checks the opt-in Vue and Svelte typings with their own template checkers. vue-tsc and
// svelte-check need TypeScript's JavaScript API, which TypeScript 7 does not have (ADR 0018), so
// they live in tooling/framework-types with TypeScript 5.9; Vue and Svelte resolve from the root.
// Run after `tsc -b` (the checks read the built declarations).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tools = join(root, 'tooling', 'framework-types');
const bin = (path) => join(tools, 'node_modules', ...path.split('/'));

if (
  !existsSync(bin('vue-tsc/bin/vue-tsc.js')) ||
  !existsSync(bin('svelte-check/bin/svelte-check'))
) {
  const npm = process.env['npm_execpath']?.endsWith('.js')
    ? process.env['npm_execpath']
    : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  execFileSync(process.execPath, [npm, 'ci', '--no-audit', '--no-fund', '--ignore-scripts'], {
    cwd: tools,
    stdio: 'inherit',
  });
}

const failures = [];
const vue = spawnSync(
  process.execPath,
  [bin('vue-tsc/bin/vue-tsc.js'), '-p', join(root, 'tests/frameworks/vue/tsconfig.json')],
  { encoding: 'utf8' },
);
if (vue.status !== 0) failures.push(`vue-tsc:\n${vue.stdout}${vue.stderr}`);

// svelte-check ignores @ts-expect-error in markup: Shell.svelte must be clean and Mistakes.svelte
// must produce exactly the expected errors.
const svelteDir = join(root, 'tests/frameworks/svelte');
const svelte = spawnSync(
  process.execPath,
  [
    bin('svelte-check/bin/svelte-check'),
    '--workspace',
    svelteDir,
    '--tsconfig',
    join(svelteDir, 'tsconfig.json'),
    '--output',
    'machine',
    '--fail-on-warnings',
  ],
  { encoding: 'utf8' },
);
const problems = [
  ...svelte.stdout.matchAll(/^\d+ (ERROR|WARNING) "([^"]+)" (\d+:\d+) "(.*)"$/gm),
].map(([, severity, file, at, text]) => ({ severity, file, at, text: JSON.parse(`"${text}"`) }));
if (!/COMPLETED/.test(svelte.stdout))
  failures.push(`svelte-check did not run:\n${svelte.stdout}${svelte.stderr}`);
const unexpected = problems.filter((p) => p.file !== 'Mistakes.svelte' || p.severity !== 'ERROR');
const expected = JSON.parse(readFileSync(join(svelteDir, 'mistakes.expected.json'), 'utf8'));
const mistakes = problems.filter((p) => p.file === 'Mistakes.svelte').map((p) => p.text);
if (unexpected.length)
  failures.push(
    `svelte-check reported:\n${unexpected.map((p) => `${p.file}:${p.at} ${p.severity} ${p.text}`).join('\n')}`,
  );
if (JSON.stringify(mistakes) !== JSON.stringify(expected))
  failures.push(
    `Mistakes.svelte errors differ from mistakes.expected.json:\n${JSON.stringify(mistakes, null, 2)}`,
  );

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}
console.log(
  `Framework typings OK: vue-tsc (strictTemplates) and svelte-check, ${expected.length} expected Svelte errors.`,
);
