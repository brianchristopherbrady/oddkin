/**
 * Version-matched agent kits inside the published component packages (ADR 0046 D6): the build
 * writes each owned component library's kit (the entry guide, references, and JSON from
 * `kit.mjs`) with an `llms.txt` into the package's `agent/` directory, listed in its `files`.
 * Coding agents read `node_modules/<package>/agent/GUIDE.md`; the kit always matches the
 * installed version. A library that exports `./composition` also gets the composition
 * reference, generated from its published schemas and declarations.
 *
 *   node scripts/agent-kit/package-kits.mjs [--root <dir>] [--check]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveProjectContext } from './context.mjs';
import { generateKit, writeKit } from './kit.mjs';

export const PACKAGE_KIT_DIR = 'agent';

const code = (value) => `\`${String(value).replace(/`/g, "'")}\``;
const firstSentence = (text = '') => {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  const end = flat.search(/[.!?](\s|$)/);
  return end > -1 ? flat.slice(0, end + 1) : flat;
};

/** Each `export declare function` of a declaration file with the doc comment right above it. */
function declaredFunctions(file) {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/export declare function (\w+)\(([\s\S]*?)\): ([^;]+);/g)].map(
    ({ 1: name, 2: params, 3: returns, index }) => {
      const before = text.slice(0, index).trimEnd();
      const open = before.endsWith('*/') ? before.lastIndexOf('/**') : -1;
      const doc =
        open > -1
          ? before
              .slice(open + 3, -2)
              .split('\n')
              .map((line) => line.replace(/^\s*\*\s?/, '').trim())
              .filter(Boolean)
              .join(' ')
          : '';
      return {
        name,
        doc,
        signature: `${name}(${params.replace(/\s+/g, ' ').trim()}): ${returns.trim()}`,
      };
    },
  );
}

/**
 * The composition reference (data-composition.md §8), from what the package publishes: the
 * entry's declarations, the document schema, and the per-element schemas. Its example is
 * validated with the package's own `validateComposition` before it is written.
 */
export async function compositionReference(library) {
  const exportsMap = library.manifest.exports ?? {};
  const entry = exportsMap['./composition'];
  if (!entry) return undefined;
  const dir = library.dir;
  const target = typeof entry === 'string' ? entry : (entry.default ?? entry.types);
  const types = typeof entry === 'string' ? undefined : entry.types;
  const schemaDir = join(dir, 'schemas', 'composition');
  const documentSchema = JSON.parse(readFileSync(join(schemaDir, 'composition.v1.json'), 'utf8'));
  const elementSchemas = readdirSync(schemaDir)
    .filter((file) => file !== 'composition.v1.json' && file.endsWith('.json'))
    .sort();
  const natives = Object.keys(documentSchema.$defs ?? {})
    .filter((key) => key.startsWith('native-'))
    .map((key) => key.slice('native-'.length));
  const functions = [
    ...declaredFunctions(types ? join(dir, types.replace(/index\.d\.ts$/, 'validate.d.ts')) : ''),
    ...declaredFunctions(types ? join(dir, types.replace(/index\.d\.ts$/, 'render.d.ts')) : ''),
  ];
  const { validateComposition, COMPOSITION_VERSION } = await import(
    pathToFileURL(join(dir, target)).href
  );
  const example = {
    $schema: documentSchema.$id,
    version: COMPOSITION_VERSION,
    root: [
      {
        element: 'odd-card',
        attributes: { label: 'Settings' },
        children: [
          { element: 'p', children: ['Save your changes before leaving.'] },
          {
            element: 'odd-button',
            slot: 'footer',
            attributes: { appearance: 'primary' },
            children: ['Save'],
            actions: { click: 'settings.save' },
          },
        ],
      },
    ],
  };
  const checked = validateComposition(example);
  if (!checked.ok)
    throw new Error(
      `${library.name}: the composition reference's example is invalid: ${JSON.stringify(checked.diagnostics)}`,
    );
  const defs = documentSchema.$defs ?? {};
  const text = [
    `# Interfaces as data: ${code(`${library.name}/composition`)}`,
    '',
    `${documentSchema.description}`,
    '',
    '## Entry',
    '',
    `- ${code(`import { validateComposition, renderComposition } from '${library.name}/composition';`)} (never imported by element entries).`,
    ...functions.map((f) => `- ${code(f.signature)}${f.doc ? `: ${f.doc}` : ''}`),
    '',
    '## Document',
    '',
    `- Schema: ${code(`${library.name}/schemas/composition/composition.v1.json`)} (${code(documentSchema.$id)}). Required: ${(documentSchema.required ?? []).map(code).join(', ')}; ${code('version')} is ${code(COMPOSITION_VERSION)}.`,
    `- ${code('root')} and every ${code('children')}: an array of nodes. A node is a string (text) or an object with ${code('element')}: a published element (one schema each, below) or a native text element (${natives.map(code).join(', ')}).`,
    `- An element object: ${code('element')}, optional ${code('id')} (${firstSentence(defs.id?.description)}), ${code('slot')} (${firstSentence(defs.slot?.description)}), ${code('attributes')} (published attributes and properties only), ${code('children')}, and ${code('actions')}: event name to action name (${firstSentence(defs.action?.description)}).`,
    '- Values are data: no functions, no markup strings, no styles. The host maps action names to its own handlers.',
    '',
    '## Element schemas',
    '',
    `${elementSchemas.length} files in ${code(`${library.name}/schemas/composition/`)}: ${elementSchemas.map((file) => code(file.replace(/\.v\d+\.json$/, ''))).join(', ')}. Each lists the element's attributes with their types, its slots, and its actions.`,
    '',
    '## Example (validated when this kit was generated)',
    '',
    '```json',
    JSON.stringify(example, null, 2),
    '```',
    '',
  ].join('\n');
  return {
    path: 'references/composition.md',
    text,
    entry: { id: 'composition', kind: 'composition', provenance: 'extracted' },
  };
}

/** llms.txt (llmstxt.org) for the packaged kit: the guide first, then every reference. */
export function llmsText(library, manifest) {
  const description = library.manifest.description ?? '';
  const components = manifest.entries.filter((e) => e.kind === 'component');
  const declarations = new Map(
    (library.cem?.modules ?? [])
      .flatMap((m) => m.declarations ?? [])
      .filter((d) => d.tagName)
      .map((d) => [d.tagName, d]),
  );
  const others = manifest.entries.filter((e) => !['component', 'json'].includes(e.kind));
  return [
    `# ${library.name} ${library.version}`,
    '',
    ...(description ? [`> ${description}`, ''] : []),
    'The agent kit for this installed version, generated from its published metadata. Read GUIDE.md first.',
    '',
    '## Guide',
    '',
    `- [GUIDE.md](GUIDE.md): install, register, the components by category, and the rules`,
    ...others.map((e) => `- [${e.id}](${e.path})`),
    '',
    '## Components',
    '',
    ...components.map((e) => {
      const tag = e.id.replace(/^component:/, '');
      const summary = firstSentence(declarations.get(tag)?.description);
      return `- [${tag}](${e.path})${summary ? `: ${summary}` : ''}`;
    }),
    '',
    '## Optional',
    '',
    '- [oddkin.metadata.json](../oddkin.metadata.json): every component, recipe, stylesheet, and model by stable id',
    '- [custom-elements.json](../custom-elements.json): the custom elements manifest',
    '',
  ].join('\n');
}

/** Generate the packaged kit of one library: `{ dir, files, manifest }`. */
export async function packageKit(project, library) {
  const composition = await compositionReference(library);
  const { files, manifest } = generateKit(project, library.name, {
    packaged: true,
    extra: composition ? [composition] : [],
  });
  manifest.packaging = ['llms-txt'];
  files.set('kit.json', `${JSON.stringify(manifest, null, 2)}\n`);
  files.set('llms.txt', llmsText(library, manifest));
  return { dir: join(library.dir, PACKAGE_KIT_DIR), files, manifest };
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: 'string', default: '.' },
      check: { type: 'boolean', default: false },
    },
  });
  const root = resolve(values.root);
  const project = resolveProjectContext(root);
  for (const d of project.diagnostics) console.error(`${d.severity} ${d.code}: ${d.message}`);
  let failed = false;
  for (const library of project.libraries.filter((l) => l.owned)) {
    const { dir, files, manifest } = await packageKit(project, library);
    const where = relative(root, dir).split('\\').join('/');
    if (manifest.guide.bytes > manifest.guide.budgetBytes) {
      failed = true;
      console.error(`error agent.kit.guideBudget: ${library.name}'s GUIDE.md exceeds its budget.`);
    }
    if (values.check) {
      const stale = [...files].filter(
        ([path, text]) =>
          !existsSync(join(dir, path)) || readFileSync(join(dir, path), 'utf8') !== text,
      );
      if (stale.length) {
        failed = true;
        console.error(
          `error agent.kit.stale: ${where} (${stale.length} of ${files.size} files differ)\n  → node scripts/agent-kit/package-kits.mjs`,
        );
      } else console.log(`${library.name}: current (${where})`);
      continue;
    }
    writeKit(dir, files);
    console.log(
      `${library.name}: ${files.size} files in ${where}; GUIDE.md ${manifest.guide.bytes} of ${manifest.guide.budgetBytes} bytes`,
    );
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main();
