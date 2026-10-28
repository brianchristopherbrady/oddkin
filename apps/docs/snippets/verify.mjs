#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentSnippet, tokenCssSnippet } from '../dist/snippets.js';
import { codeBlocks, pages } from '../dist/pages/index.js';

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
  for (const name of ['core', 'tokens', 'components', 'state', 'app']) {
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
  const pageSamples = await verifyPages(consumer, { css, metadata, customElements });
  console.log(
    `Docs snippets resolve against packed @oddkin/core, tokens, components, state, and app (${pageSamples} authored samples).`,
  );
} finally {
  await rm(work, { recursive: true, force: true });
}

/** The packed manifest of an `@oddkin/*` package, or undefined when it is not installed. */
async function manifestOf(consumer, name) {
  try {
    return JSON.parse(await readFile(join(consumer, 'node_modules', name, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

/** Throws unless `specifier` is a published entry of an installed package. */
async function exportedEntry(consumer, specifier, where) {
  const [scope, name, ...rest] = specifier.split('/');
  const manifest = await manifestOf(consumer, `${scope}/${name}`);
  const key = rest.length ? `./${rest.join('/')}` : '.';
  const target = manifest?.exports?.[key];
  if (!target) throw new Error(`${where}: ${specifier} is not a published entry.`);
  return typeof target === 'string' ? target : target.default;
}

/**
 * The code samples of the authored pages (apps/docs/src/pages): module samples import only
 * published entries, TypeScript ones type-check and JavaScript ones parse; markup uses published
 * elements and attributes, and import maps point at the files the exports name; CSS reads only
 * published tokens.
 */
async function verifyPages(consumer, { css, metadata, customElements }) {
  const dir = join(consumer, 'pages');
  await mkdir(dir);
  const attributes = new Map();
  for (const module of customElements.modules)
    for (const declaration of module.declarations ?? [])
      if (declaration.tagName)
        attributes.set(
          declaration.tagName,
          new Set((declaration.attributes ?? []).map((attribute) => attribute.name)),
        );
  const global = /^(class|id|slot|hidden|lang|dir|title|tabindex|role|aria-[\w-]+|data-[\w-]+)$/;
  let count = 0;
  let typed = false;
  for (const page of pages) {
    for (const [index, { section, code }] of codeBlocks(page).entries()) {
      const where = `/${page.path} #${section}`;
      if (code.verify === 'module') {
        for (const [, from, bare] of code.code.matchAll(/from '([^']+)'|import '([^']+)'/g)) {
          const specifier = from ?? bare;
          if (specifier.startsWith('@oddkin/')) await exportedEntry(consumer, specifier, where);
          else if (!specifier.startsWith('.'))
            throw new Error(`${where}: unexpected import ${specifier}.`);
        }
        const file = join(
          dir,
          code.file ??
            `${page.path.replace(/\W+/g, '-') || 'overview'}-${index}.${code.lang === 'ts' ? 'ts' : 'mjs'}`,
        );
        await writeFile(file, code.code);
        if (code.lang === 'ts') typed = true;
        else node(['--check', file], dir);
      } else if (code.verify === 'markup') {
        for (const [, tag, rest] of code.code.matchAll(/<(odd-[a-z-]+)\b([^>]*)>/g)) {
          const known = attributes.get(tag);
          if (!known || !Object.values(metadata.components).some((c) => c.tag === tag))
            throw new Error(`${where}: <${tag}> is not a published element.`);
          for (const [, attribute] of rest.matchAll(/\s([a-z][\w-]*)(?==|\s|$)/g))
            if (!known.has(attribute) && !global.test(attribute))
              throw new Error(`${where}: <${tag}> has no attribute ${attribute}.`);
        }
        for (const [, scope, name, file] of code.code.matchAll(
          /href="\/node_modules\/(@oddkin)\/([\w-]+)\/([^"]+)"/g,
        )) {
          const manifest = await manifestOf(consumer, `${scope}/${name}`);
          const targets = Object.values(manifest?.exports ?? {}).map((t) =>
            typeof t === 'string' ? t : t.default,
          );
          if (!targets.includes(`./${file}`))
            throw new Error(`${where}: ${scope}/${name} publishes no ${file}.`);
        }
        for (const [, map] of code.code.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g))
          for (const [specifier, url] of Object.entries(JSON.parse(map).imports)) {
            const target = await exportedEntry(consumer, specifier, where);
            const [scope, name] = specifier.split('/');
            if (!url.endsWith(`/node_modules/${scope}/${name}/${target.replace(/^\.\//, '')}`))
              throw new Error(
                `${where}: the import map sends ${specifier} to ${url}, not ${target}.`,
              );
          }
      } else if (code.verify === 'css') {
        for (const [, variable] of code.code.matchAll(/var\((--odd-[\w-]+)/g))
          if (!css.includes(`${variable}:`))
            throw new Error(`${where}: ${variable} is not a published token.`);
      } else if (code.verify !== 'none')
        throw new Error(`${where}: the sample says nothing about how it is checked.`);
      count++;
    }
  }
  if (typed) {
    await writeFile(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2023',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2023', 'DOM', 'DOM.Iterable'],
          noEmit: true,
          strict: true,
          skipLibCheck: true,
        },
        include: ['*.ts'],
      }),
    );
    node([join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'], dir);
  }
  return count;
}
