#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentSnippet, tokenCssSnippet } from '../dist/snippets.js';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const npmCli = process.env['npm_execpath']?.endsWith('.js')
  ? process.env['npm_execpath']
  : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const run = (args, cwd) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const node = (args, cwd) =>
  execFileSync(process.execPath, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
const work = await mkdtemp(join(tmpdir(), 'oddkin-doc-snippets-'));

try {
  const tarballs = [];
  for (const name of ['core', 'tokens', 'components']) {
    const directory = join(root, 'packages', name);
    const [info] = JSON.parse(run(['pack', '--json', '--pack-destination', work], directory));
    tarballs.push(join(work, info.filename));
  }
  const consumer = join(work, 'consumer');
  await mkdir(consumer);
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'docs-snippet-consumer', private: true, type: 'module' }),
  );
  run(['install', '--no-audit', '--no-fund', '--ignore-scripts', ...tarballs], consumer);

  const componentsDir = join(consumer, 'node_modules', '@oddkin', 'components');
  const tokensDir = join(consumer, 'node_modules', '@oddkin', 'tokens');
  const componentManifest = JSON.parse(await readFile(join(componentsDir, 'package.json'), 'utf8'));
  const metadata = JSON.parse(await readFile(join(componentsDir, 'oddkin.metadata.json'), 'utf8'));
  const customElements = JSON.parse(
    await readFile(join(componentsDir, 'custom-elements.json'), 'utf8'),
  );
  for (const component of Object.values(metadata.components)) {
    const registration = component.registration;
    const target = componentManifest.exports?.[`./${registration.split('/').slice(2).join('/')}`];
    if (!target || !component.tag)
      throw new Error(`Unpublished component snippet entry: ${registration}`);
    const snippet = componentSnippet(registration, component.tag);
    if (!snippet.includes(`document.createElement('${component.tag}')`))
      throw new Error(`Snippet omitted <${component.tag}>.`);
    const source = join(consumer, `${component.tag}.mjs`);
    await writeFile(source, snippet);
    node(['--check', source], consumer);
    const published = customElements.modules.some((module) =>
      module.exports?.some((item) => item.name === component.tag),
    );
    if (!published) throw new Error(`The packed CEM has no registration for <${component.tag}>.`);
  }
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2023',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2023', 'DOM'],
          allowJs: true,
          checkJs: true,
          noEmit: true,
          strict: true,
          skipLibCheck: true,
        },
        include: ['*.mjs'],
      },
      null,
      2,
    ),
  );
  node([join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'], consumer);

  const tokenManifest = JSON.parse(await readFile(join(tokensDir, 'package.json'), 'utf8'));
  const cssTarget = tokenManifest.exports?.['./css/default.css'];
  const inspectionTarget = tokenManifest.exports?.['./inspect/default.json'];
  if (typeof cssTarget !== 'string' || typeof inspectionTarget !== 'string')
    throw new Error('The packed token package does not publish its CSS and inspection exports.');
  const [css, inspectionText] = await Promise.all([
    readFile(join(tokensDir, cssTarget), 'utf8'),
    readFile(join(tokensDir, inspectionTarget), 'utf8'),
  ]);
  const inspection = JSON.parse(inspectionText);
  for (const [, variable] of tokenCssSnippet.matchAll(/var\((--odd-[\w-]+)/g)) {
    if (!css.includes(`${variable}:`))
      throw new Error(`The copied token snippet references unpublished CSS variable ${variable}.`);
    if (!inspection.tokens.some((token) => token.cssVariable === variable))
      throw new Error(`The token inspection does not contain ${variable}.`);
  }
  console.log(
    'Docs snippets resolve against packed @oddkin/core, @oddkin/tokens, and @oddkin/components.',
  );
} finally {
  await rm(work, { recursive: true, force: true });
}
