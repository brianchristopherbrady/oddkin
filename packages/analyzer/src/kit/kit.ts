/**
 * Agent kits, generation (agent-tooling.md §5): an entry guide, references, and JSON contract
 * bundles for one library, generated from its published metadata and its theme's token
 * inspection, with a freshness check. Exact API facts are extracted; guidance is shown only where
 * the library authored it.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  exportTarget,
  inputsHash,
  type Fingerprint,
  type Library,
  type Project,
} from './context.js';

export const KIT_SCHEMA = 'https://oddkin.dev/schemas/agent-kit/v1.json';
export const GUIDE_BUDGET = 8192;
const INPUTS_FILE = 'inputs.json';

export interface KitEntry {
  id: string;
  path: string;
  kind:
    | 'component'
    | 'choosing'
    | 'tokens'
    | 'recipe'
    | 'stylesheet'
    | 'model'
    | 'composition'
    | 'task'
    | 'json';
  provenance: 'extracted' | 'authored' | 'verified';
  notAuthored?: boolean;
}

export interface KitManifest {
  schema: string;
  library: { name: string; version: string };
  fingerprint: Fingerprint;
  metadata: { file: string; sha256: string };
  guide: { path: string; budgetBytes: number; bytes: number };
  entries: KitEntry[];
  packaging?: Array<'agent-skills' | 'agents-md' | 'ide-instructions' | 'llms-txt'>;
}

/** A reference added to a kit: its path in the kit, its text, and its manifest entry. */
export interface KitFile {
  path: string;
  text: string;
  entry: Omit<KitEntry, 'path'>;
}

export const kitDirName = (name: string): string => name.replace(/^@/, '').replace(/\//g, '-');
export const refreshCommand = (name: string, out: string): string =>
  `npx oddkin-kit --package ${name} --out ${out}`;

const cell = (value: unknown): string =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');
const code = (value: unknown): string => `\`${String(value).replace(/`/g, "'")}\``;
const table = (head: string[], rows: unknown[][]): string =>
  rows.length
    ? [
        `| ${head.join(' | ')} |`,
        `| ${head.map(() => '---').join(' | ')} |`,
        ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
        '',
      ].join('\n')
    : '';
const at = (fact: any): string => (fact.source ? ` (${fact.source.file}:${fact.source.line})` : '');
const posix = (path: string): string => path.split('\\').join('/');

/** The input files one library's kit depends on: its package, the theme, and the workspace manifest. */
function kitInputs(project: Project, library: Library): Map<string, string> {
  const rel = (file: string) => posix(relative(project.root, file));
  const prefix = `${rel(library.dir)}/`;
  const shared = new Set([
    'package.json',
    ...(project.inspection ? [rel(project.inspection.file)] : []),
  ]);
  if (project.context.theme?.config) shared.add(project.context.theme.config);
  return new Map(
    [...project.inputs].filter(
      ([path]) => path.startsWith(prefix) || shared.has(path) || /^oddkin\.docs\./.test(path),
    ),
  );
}

/**
 * A packaged kit's inputs: the files its package publishes, by path in the package, and the
 * theme's token inspection, by its package export. The same in the workspace that builds the
 * package and in a project that installs it, so the installed package can regenerate its kit.
 */
function packagedInputs(project: Project, library: Library): Map<string, string> {
  const files: string[] = library.manifest['files'] ?? [];
  const published = (path: string) =>
    path === 'package.json' ||
    files.some((entry) => {
      const name = entry.replace(/^\.\//, '').replace(/\/$/, '');
      return path === name || path.startsWith(`${name}/`);
    });
  const inputs = new Map<string, string>();
  for (const [path, hash] of project.inputs) {
    const inPackage = posix(relative(library.dir, resolve(project.root, path)));
    if (!inPackage.startsWith('../') && !inPackage.startsWith('agent/') && published(inPackage))
      inputs.set(inPackage, hash);
  }
  const inspection = project.inspection;
  if (inspection?.source) {
    const hash = project.inputs.get(posix(relative(project.root, inspection.file)));
    if (hash) inputs.set(`${inspection.source.package}${inspection.source.export.slice(1)}`, hash);
  }
  return inputs;
}

function fingerprintOf(
  project: Project,
  library: Library,
  inputs: Map<string, string>,
): Fingerprint {
  const versions: Record<string, string> = { [library.name]: library.version };
  for (const dep of Object.keys({
    ...library.manifest['dependencies'],
    ...library.manifest['peerDependencies'],
  }))
    for (const p of project.context.packages) if (p.name === dep) versions[p.name] = p.version;
  return {
    generator: { ...project.context.fingerprint.generator },
    schemaVersion: 1,
    packages: versions,
    inputs: inputsHash(inputs),
  };
}

/** SHA-256 of a library's published metadata file, as packed. */
export const metadataHash = (dir: string): string =>
  createHash('sha256')
    .update(readFileSync(join(dir, 'oddkin.metadata.json')))
    .digest('hex');

const declarationOf = (cem: any, component: any): any =>
  cem?.modules
    ?.find((m: any) => m.path === component.cem.module)
    ?.declarations?.find((d: any) => d.name === component.cem.name);

/** The shortest public specifier whose module exports the class (not a registration entry). */
function classImport(library: Library, component: any): string | undefined {
  const exporting = new Set(
    (library.cem?.['modules'] ?? [])
      .filter((m: any) =>
        m.exports?.some((e: any) => e.kind === 'js' && e.name === component.cem.name),
      )
      .map((m: any) => m.path),
  );
  const specifiers = Object.keys(library.manifest['exports'] ?? {})
    .filter((subpath) => exporting.has(exportTarget(library.manifest, subpath)))
    .map((subpath) => (subpath === '.' ? library.name : `${library.name}${subpath.slice(1)}`))
    .sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  return specifiers[0];
}

function componentReference(
  library: Library,
  component: any,
  categories: Record<string, any>,
  examples: Array<[string, any]>,
): string {
  const declaration = declarationOf(library.cem, component) ?? {};
  const tag: string = component.tag;
  const propertyOnly = new Set(
    (component.propertyOnly ?? []).map((p: any) => p.property.split('#')[1]),
  );
  const intents = new Map<string, string>(
    (component.events ?? []).map((e: any) => [
      e.event.split('#')[1],
      e.intent.known === false ? 'unknown (not declared)' : `${e.intent.value} (authored)`,
    ]),
  );
  const fields = (declaration.members ?? []).filter((m: any) => m.kind === 'field');
  const methods = (declaration.members ?? []).filter((m: any) => m.kind === 'method');
  const imported = classImport(library, component);
  const category = component.category ? categories[component.category]?.label : undefined;
  const lines: string[] = [
    `# ${code(`<${tag}>`)}${declaration.name ? ` (${declaration.name})` : ''}`,
    '',
    `Package ${code(library.name)} ${library.version}${category ? ` · category ${category}` : ''}. Generated from \`custom-elements.json\` and \`oddkin.metadata.json\`; facts are extracted unless marked authored or verified.`,
    '',
    ...(declaration.description ? [declaration.description, ''] : []),
    '## Import and register',
    '',
    `- Register: ${code(`import '${component.registration}';`)}`,
    imported
      ? `- Class: ${code(`import { ${component.cem.name} } from '${imported}';`)}`
      : '- Class: no public export of the class was found.',
    ...Object.entries<string>(component.definition?.dependencies ?? {}).map(
      ([role, dep]) => `- Dependency (${role}): ${code(`<${dep.replace(/^component:/, '')}>`)}`,
    ),
    ...(component.definition?.extends
      ? [
          `- Recomposed from ${code(`<${component.definition.extends.replace(/^component:/, '')}>`)}`,
        ]
      : []),
    '',
    '## Properties',
    '',
    table(
      ['Property', 'Attribute', 'Type', 'Default', 'Description'],
      fields.map((f: any) => [
        code(f.name),
        propertyOnly.has(f.name)
          ? 'none: assign as a property'
          : f.attribute
            ? `${code(f.attribute)}${f.reflects ? ' (reflects)' : ''}`
            : f.readonly
              ? 'none (read-only)'
              : 'none',
        f.type?.text ?? '',
        f.default ?? '',
        f.description ?? '',
      ]),
    ) || 'None.\n',
    ...(methods.length
      ? [
          '## Methods',
          '',
          table(
            ['Method', 'Description'],
            methods.map((m: any) => [code(`${m.name}()`), m.description ?? '']),
          ),
        ]
      : []),
    '## Events',
    '',
    table(
      ['Event', 'Type', 'Intent', 'Description'],
      (declaration.events ?? []).map((e: any) => [
        code(e.name),
        e.type?.text ?? '',
        intents.get(e.name) ?? 'unknown (not declared)',
        e.description ?? '',
      ]),
    ) || 'None.\n',
  ];
  for (const [title, key] of [
    ['Slots', 'slots'],
    ['Parts', 'cssParts'],
    ['CSS custom properties', 'cssProperties'],
    ['Custom states', 'cssStates'],
  ] as const) {
    const entries = declaration[key] ?? [];
    lines.push(
      `## ${title}`,
      '',
      table(
        ['Name', 'Description'],
        entries.map((s: any) => [s.name ? code(s.name) : '(default)', s.description ?? '']),
      ) || 'None.\n',
    );
  }
  lines.push('## Guidance (authored)', '');
  let authored = 0;
  for (const [label, key] of [
    ['Use for', 'useFor'],
    ['Not for', 'notFor'],
    ['Accessibility', 'a11y'],
    ['Keyboard', 'keyboard'],
    ['Limitations', 'limitations'],
  ] as const)
    for (const fact of component[key] ?? []) {
      authored++;
      lines.push(`- ${label}: ${fact.value}${at(fact)}`);
    }
  if (!authored) lines.push('Not authored for this component.');
  lines.push('', '## Examples', '');
  const own = examples.filter(([, e]) => e.component === `component:${tag}`);
  const correct = own.filter(([, e]) => !e.incorrect);
  const mistakes = own.filter(([, e]) => e.incorrect);
  lines.push(
    ...(correct.length
      ? correct.map(
          ([id, e]) =>
            `- ${code(id)} in ${e.file} (package source)${e.previewRoles ? `, preview roles ${e.previewRoles.join(', ')}` : ''}`,
        )
      : ['None authored.']),
  );
  if (mistakes.length)
    lines.push(
      '',
      'Explained mistakes (never use these as patterns):',
      '',
      ...mistakes.map(
        ([id, e]) =>
          `- ${code(id)} produces ${code(e.incorrect.diagnostic)}; correct: ${code(e.incorrect.correct)}`,
      ),
    );
  const customization = component.customization;
  if (customization) {
    lines.push(
      '',
      '## Customization',
      '',
      `- Levels: ${customization.levels?.known === false ? 'unknown (not declared)' : `${customization.levels.value.join(', ')} (authored)`}`,
    );
    if (customization.variables?.length)
      lines.push(
        `- Variables: ${customization.variables.map((v: string) => code(v.split('#')[1])).join(', ')}`,
      );
  }
  if (component.contracts?.length)
    lines.push('', '## Contracts', '', ...component.contracts.map((id: string) => `- ${code(id)}`));
  const verified = (component.verification ?? []).filter((v: any) => v.provenance === 'verified');
  if (verified.length) {
    lines.push('', '## Verified', '');
    for (const v of verified)
      lines.push(
        `- ${v.facts.length} facts verified by ${code(v.suite)} in ${v.conditions.browsers.map((b: any) => `${b.name} ${b.version}`).join(', ')} (${v.source.test}, ${v.source.date.slice(0, 10)})`,
      );
  }
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

function choosingReference(
  library: Library,
  components: any[],
  categories: Record<string, any>,
): { text: string; notAuthored: boolean } {
  const groups = new Map<string, any[]>();
  for (const c of components) {
    const label = c.category ? (categories[c.category]?.label ?? c.category) : 'No category';
    groups.set(label, [...(groups.get(label) ?? []), c]);
  }
  const lines = [
    `# Choosing components in ${library.name}`,
    '',
    'From authored `@useFor`, `@notFor`, and `@category`.',
    '',
  ];
  let authored = 0;
  for (const [label, list] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
    lines.push(`## ${label}`, '');
    for (const c of list) {
      const facts = [
        ...(c.useFor ?? []).map((f: any) => `  - Use for: ${f.value}`),
        ...(c.notFor ?? []).map((f: any) => `  - Not for: ${f.value}`),
      ];
      authored += facts.length;
      lines.push(`- ${code(`<${c.tag}>`)}`, ...(facts.length ? facts : ['  - Not authored.']));
    }
    lines.push('');
  }
  return { text: `${lines.join('\n').trimEnd()}\n`, notAuthored: authored === 0 };
}

const valueText = (value: unknown): string =>
  value && typeof value === 'object'
    ? Object.entries(value)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join('; ')
    : String(value ?? '');

function tokenReference(category: string, tokens: any[], inspection: Record<string, any>): string {
  return `${[
    `# Tokens: ${category}`,
    '',
    `Theme ${code(inspection['theme'])}, modes ${(inspection['modes'] as string[]).join(', ')}. From the theme's token inspection.`,
    '',
    table(
      ['Token', 'CSS variable', 'Type', 'Value', 'Defined as', 'Origin'],
      tokens.map((t) => [
        code(t.name),
        code(t.cssVariable),
        t.type,
        valueText(t.value),
        typeof t.definition === 'string' && /^\{[^}]+\}$/.test(t.definition)
          ? `alias of ${code(t.definition.slice(1, -1))}`
          : valueText(t.definition),
        t.origin,
      ]),
    ),
  ]
    .join('\n')
    .trimEnd()}\n`;
}

function recipeReference(id: string, recipe: any): string {
  return `${[
    `# Recipe ${recipe.name}`,
    '',
    `Id ${code(id)}.${recipe.container ? ` Container ${code(recipe.container.name ?? JSON.stringify(recipe.container))}.` : ''}`,
    '',
    table(
      ['Region', 'Helper'],
      Object.entries<any>(recipe.regions ?? {}).map(([region, r]) => [code(region), r.helper]),
    ),
    ...(recipe.variants
      ? [
          '## Variants',
          '',
          ...Object.entries<string[]>(recipe.variants).map(
            ([k, v]) => `- ${code(k)}: ${v.join(', ')}`,
          ),
          '',
        ]
      : []),
    ...(recipe.conditions?.length
      ? ['## Conditions', '', ...recipe.conditions.map((c: string) => `- ${code(c)}`), '']
      : []),
    ...(recipe.parts?.length
      ? ['## Parts', '', ...recipe.parts.map((p: string) => `- ${code(p)}`), '']
      : []),
    `Layers: ${recipe.layers.join(' → ')}.`,
  ]
    .join('\n')
    .trimEnd()}\n`;
}

function stylesheetReference(id: string, sheet: any): string {
  const list = (title: string, values: string[]) =>
    values.length ? [`## ${title}`, '', values.map(code).join(', '), ''] : [];
  return `${[
    `# Stylesheet ${sheet.name}`,
    '',
    `Id ${code(id)}. Import ${code(sheet.import)} once per document; its rules are in the ${code(sheet.layer)} layer.`,
    '',
    ...(sheet.description ? [sheet.description, ''] : []),
    ...list(
      'Classes',
      sheet.classes.map((c: string) => `.${c}`),
    ),
    ...list('Variables an author may set', sheet.variables),
    ...list('Tokens read', sheet.tokens),
  ]
    .join('\n')
    .trimEnd()}\n`;
}

/** The public specifier of a package file, through exact or `*` pattern exports. */
function exportedAs(library: Library, file: string): string | undefined {
  for (const [subpath, target] of Object.entries<any>(library.manifest['exports'] ?? {})) {
    const path =
      typeof target === 'string'
        ? target
        : (target?.development ?? target?.import ?? target?.default);
    if (typeof path !== 'string') continue;
    if (!path.includes('*')) {
      if (path.replace(/^\.\//, '') === file) return `${library.name}${subpath.slice(1)}`;
      continue;
    }
    const [before = '', after = ''] = path.replace(/^\.\//, '').split('*');
    if (
      file.startsWith(before) &&
      file.endsWith(after) &&
      file.length >= before.length + after.length
    )
      return `${library.name}${subpath.slice(1).replace('*', file.slice(before.length, file.length - after.length))}`;
  }
  return undefined;
}

function modelReference(library: Library, id: string, model: any): string {
  const exported = exportedAs(library, model.schema);
  return `${[
    `# Model ${model.name} v${model.version}`,
    '',
    `Id ${code(id)}. JSON Schema: ${exported ? code(exported) : `${code(model.schema)} in the package (not exported)`}.`,
    ...(model.kinds?.length ? ['', `Kinds: ${model.kinds.map(code).join(', ')}.`] : []),
  ].join('\n')}\n`;
}

/** The guide: what to read first, small enough for every context window. */
function guide(
  project: Project,
  library: Library,
  components: any[],
  categories: Record<string, any>,
  entries: KitEntry[],
  packaged: boolean,
): string {
  const deps = Object.keys({
    ...library.manifest['dependencies'],
    ...library.manifest['peerDependencies'],
  })
    .filter((d) => d.startsWith('@oddkin/'))
    .sort();
  const metadata = library.metadata;
  const propertyOnly = components.flatMap((c) =>
    (c.propertyOnly ?? []).map((p: any) => code(`${c.tag}.${p.property.split('#')[1]}`)),
  );
  const userEvents = components.flatMap((c) =>
    (c.events ?? [])
      .filter((e: any) => e.intent.value === 'user')
      .map((e: any) => code(e.event.split('#')[1])),
  );
  const contracts = Object.entries<any>(metadata['contracts'] ?? {});
  const commands = Object.entries(project.context.commands ?? {});
  const refs = (kind: KitEntry['kind']) => entries.filter((e) => e.kind === kind);
  // One stated rule for every `<prefix-name>` → `<package>/define/<name>` entry keeps the guide within budget.
  const defineEntry = (c: any) => `${library.name}/define/${c.tag.slice(c.tag.indexOf('-') + 1)}`;
  const regular = components.filter((c) => c.registration === defineEntry(c));
  const irregular = components.filter((c) => c.registration !== defineEntry(c));
  const byCategory = new Map<string, string[]>();
  for (const c of components) {
    const label: string = c.category ? (categories[c.category]?.label ?? c.category) : 'Other';
    byCategory.set(label, [...(byCategory.get(label) ?? []), c.tag]);
  }
  const groups = [...byCategory].sort(([a], [b]) =>
    a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b),
  );
  const inspection = project.inspection;
  const firstContract = contracts[0]?.[1];
  // The theme's stylesheet: the CSS export named after the theme, in the package the inspection comes from.
  const themeCss = inspection?.source
    ? project.context.packages
        .find((p) => p.name === inspection.source!.package)
        ?.exports?.find((specifier) => specifier.endsWith(`/css/${inspection.data['theme']}.css`))
    : undefined;
  return `${[
    `# ${library.name} ${library.version}: agent guide`,
    '',
    packaged
      ? `Generated from this package's published metadata when it was built (fingerprint in kit.json), so it matches the installed version. Read the reference for a component before using it.`
      : `Generated by \`oddkin-kit\` (\`@oddkin/analyzer\`) from published metadata (fingerprint in kit.json). Read the reference for a component before using it. If \`${refreshCommand(library.name, '<out>')} --check\` reports the kit as stale, regenerate it first.`,
    '',
    '## Install and register',
    '',
    `- Package ${code(library.name)}${deps.length ? `, which depends on ${deps.map(code).join(', ')}` : ''}.`,
    ...(regular.length
      ? [
          `- Register an element once before using its tag: ${code(`import '${library.name}/define/<name>';`)}, where \`<name>\` is the tag after its prefix (${code(`<${regular[0].tag}>`)}: ${code(`import '${regular[0].registration}';`)}). Class exports are in each component reference.`,
        ]
      : []),
    ...(irregular.length
      ? [
          `- Registration entries${regular.length ? ' that differ from that rule' : ''}: ${irregular.map((c) => `${code(`<${c.tag}>`)} ${code(`import '${c.registration}';`)}`).join('; ')}.`,
        ]
      : []),
    ...(themeCss
      ? [
          `- Link the theme's stylesheet once per document, ${code(themeCss)}: the design tokens every component reads.`,
        ]
      : []),
    `- Without a bundler, an import map must map every bare specifier a page loads, the packages' own imports included${deps.length ? ` (${deps.map((d) => code(`${d}/…`)).join(', ')})` : ''}, to the file each package's \`exports\` names under the \`default\` condition. Never mix in a \`development\` build: it is a second copy of the package.`,
    '',
    '## Components',
    '',
    'Each has a reference at `references/components/<tag>.md` with its exact API, guidance, and examples.',
    '',
    ...groups.map(
      ([label, tags]) => `- **${label}:** ${tags.map((t) => code(`<${t}>`)).join(', ')}`,
    ),
    '',
    'Choosing between them: references/choosing-components.md.',
    '',
    '## Rules from the metadata',
    '',
    propertyOnly.length
      ? `- Property-only values (assign as JavaScript properties, never attributes): ${propertyOnly.join(', ')}.`
      : '- No property-only values.',
    userEvents.length
      ? `- Events declared with user intent (authored; see each reference): ${[...new Set(userEvents)].join(', ')}. Other events state their intent, or that it is unknown, in each reference.`
      : '- No events declare user intent.',
    ...(firstContract
      ? [
          `- Contracts the components reference (${code(`${firstContract.package}/${firstContract.file}`)}): ${contracts.map(([id, c]) => `${code(id)} ${c.title}`).join('; ')}.`,
        ]
      : []),
    '',
    '## More references',
    '',
    ...(refs('tokens').length && inspection
      ? [
          `- Tokens (theme ${code(inspection.data['theme'])}): ${refs('tokens')
            .map((e) => e.path)
            .join(', ')}.`,
        ]
      : ['- Tokens: no token inspection was found for this library.']),
    ...(refs('recipe').length
      ? [
          `- Recipes: ${refs('recipe')
            .map((e) => e.path)
            .join(', ')}.`,
        ]
      : []),
    ...(refs('stylesheet').length
      ? [
          `- Document stylesheets (opt-in CSS: reset, layout classes, native-element recipes): ${refs(
            'stylesheet',
          )
            .map((e) => e.path)
            .join(', ')}.`,
        ]
      : []),
    ...refs('composition').map(
      (e) => `- Interfaces as data (validate and render JSON documents): ${e.path}.`,
    ),
    ...(refs('model').length
      ? [
          `- Models: ${refs('model')
            .map((e) => e.path)
            .join(', ')}.`,
        ]
      : []),
    packaged
      ? `- JSON keyed by stable id, shipped beside this kit: ${code(`${library.name}/oddkin.metadata.json`)} (components, recipes, stylesheets, models), ${code(`${library.name}/custom-elements.json`)}${inspection?.source ? `, and the theme's tokens in ${code(`${inspection.source.package}${inspection.source.export.slice(1)}`)}` : ''}.`
      : `- JSON contract bundles keyed by stable id: ${refs('json')
          .map((e) => e.path)
          .join(', ')}.`,
    ...(commands.length && !packaged
      ? ['', '## Workspace commands', '', ...commands.map(([k, v]) => `- ${k}: ${code(v)}`)]
      : []),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

/**
 * Generate one library's kit: `files` maps kit-relative paths to text; `manifest` is kit.json
 * (agent-kit.v1). `packaged`: the kit ships inside the package (no workspace inputs file, and a
 * guide that needs no refresh command). `extra`: more references.
 */
export function generateKit(
  project: Project,
  name: string,
  { packaged = false, extra = [] }: { packaged?: boolean; extra?: KitFile[] } = {},
): { files: Map<string, string>; manifest: KitManifest } {
  const library = project.libraries.find((l) => l.name === name);
  if (!library) throw new Error(`${name} publishes no oddkin.metadata.json in this workspace.`);
  const inputs = packaged ? packagedInputs(project, library) : kitInputs(project, library);
  const fingerprint = fingerprintOf(project, library, inputs);
  const metadata = library.metadata;
  const categories: Record<string, any> = metadata['categories'] ?? {};
  const components = Object.values<any>(metadata['components'] ?? {}).sort((a, b) =>
    a.tag < b.tag ? -1 : 1,
  );
  const examples = Object.entries<any>(metadata['examples'] ?? {});
  const files = new Map<string, string>();
  const entries: KitEntry[] = [];
  const add = (path: string, text: string, entry?: Omit<KitEntry, 'path'>) => {
    files.set(path, text);
    if (entry) entries.push({ ...entry, path });
  };
  for (const c of components)
    add(`references/components/${c.tag}.md`, componentReference(library, c, categories, examples), {
      id: `component:${c.tag}`,
      kind: 'component',
      provenance: 'extracted',
    });
  const choosing = choosingReference(library, components, categories);
  add('references/choosing-components.md', choosing.text, {
    id: 'choosing',
    kind: 'choosing',
    provenance: 'authored',
    ...(choosing.notAuthored ? { notAuthored: true } : {}),
  });
  const bundle = (entriesById: unknown) =>
    `${JSON.stringify({ fingerprint, entries: entriesById }, null, 2)}\n`;
  const tokens = project.inspection?.data;
  if (tokens) {
    const byCategory = new Map<string, any[]>();
    for (const t of tokens['tokens'] as any[])
      byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t]);
    for (const [category, list] of [...byCategory].sort(([a], [b]) => (a < b ? -1 : 1)))
      add(`references/tokens/${category}.md`, tokenReference(category, list, tokens), {
        id: `tokens:${category}`,
        kind: 'tokens',
        provenance: 'extracted',
      });
  }
  for (const [id, recipe] of Object.entries<any>(metadata['recipes'] ?? {}))
    add(`references/recipes/${recipe.name}.md`, recipeReference(id, recipe), {
      id,
      kind: 'recipe',
      provenance: 'extracted',
    });
  for (const [id, sheet] of Object.entries<any>(metadata['stylesheets'] ?? {}))
    add(`references/stylesheets/${sheet.name}.md`, stylesheetReference(id, sheet), {
      id,
      kind: 'stylesheet',
      provenance: 'extracted',
    });
  for (const [id, model] of Object.entries<any>(metadata['models'] ?? {}))
    add(`references/models/${model.name}.md`, modelReference(library, id, model), {
      id,
      kind: 'model',
      provenance: 'extracted',
    });
  // A packaged kit points at the metadata, manifest, and token inspection the packages ship.
  if (!packaged) {
    add(
      'json/components.json',
      bundle(
        Object.fromEntries(
          components.map((c) => [
            `component:${c.tag}`,
            {
              package: library.name,
              version: library.version,
              declaration: declarationOf(library.cem, c) ?? null,
              metadata: c,
            },
          ]),
        ),
      ),
      { id: 'json:components', kind: 'json', provenance: 'extracted' },
    );
    if (tokens)
      add(
        'json/tokens.json',
        bundle(Object.fromEntries((tokens['tokens'] as any[]).map((t) => [`token:${t.name}`, t]))),
        { id: 'json:tokens', kind: 'json', provenance: 'extracted' },
      );
    if (metadata['recipes'])
      add('json/recipes.json', bundle(metadata['recipes']), {
        id: 'json:recipes',
        kind: 'json',
        provenance: 'extracted',
      });
    if (metadata['stylesheets'])
      add('json/stylesheets.json', bundle(metadata['stylesheets']), {
        id: 'json:stylesheets',
        kind: 'json',
        provenance: 'extracted',
      });
    if (metadata['models'])
      add('json/models.json', bundle(metadata['models']), {
        id: 'json:models',
        kind: 'json',
        provenance: 'extracted',
      });
  }
  for (const { path, text, entry } of extra) add(path, text, entry);
  const guideText = guide(project, library, components, categories, entries, packaged);
  files.set('GUIDE.md', guideText);
  const manifest: KitManifest = {
    schema: KIT_SCHEMA,
    library: { name: library.name, version: library.version },
    fingerprint,
    // The metadata the kit was generated from, so a packed kit can be checked against the packed file.
    metadata: { file: 'oddkin.metadata.json', sha256: metadataHash(library.dir) },
    guide: { path: 'GUIDE.md', budgetBytes: GUIDE_BUDGET, bytes: Buffer.byteLength(guideText) },
    entries,
  };
  files.set('kit.json', `${JSON.stringify(manifest, null, 2)}\n`);
  if (!packaged)
    files.set(
      INPUTS_FILE,
      `${JSON.stringify({ inputs: fingerprint.inputs, files: Object.fromEntries([...inputs].sort(([a], [b]) => (a < b ? -1 : 1))) }, null, 2)}\n`,
    );
  return { files, manifest };
}

/** Write a kit into `dir`, replacing an earlier kit there; refuses a directory that holds something else. */
export function writeKit(dir: string, files: Map<string, string>): void {
  if (existsSync(dir) && readdirSync(dir).length) {
    let previous: { schema?: string } | undefined;
    try {
      previous = JSON.parse(readFileSync(join(dir, 'kit.json'), 'utf8'));
    } catch {
      previous = undefined;
    }
    if (previous?.schema !== KIT_SCHEMA)
      throw new Error(`${dir} is not empty and holds no agent kit; refusing to replace it.`);
    rmSync(dir, { recursive: true });
  }
  for (const [path, text] of files) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

/**
 * Compare a written kit with the current inputs: `current`, or `stale` with the changed inputs
 * (`agent.kit.stale`), or `missing`.
 */
export function checkKit(
  dir: string,
  project: Project,
  name: string,
): { status: 'current' | 'stale' | 'missing'; changed: string[] } {
  const library = project.libraries.find((l) => l.name === name);
  if (!library || !existsSync(join(dir, 'kit.json'))) return { status: 'missing', changed: [] };
  const kit = JSON.parse(readFileSync(join(dir, 'kit.json'), 'utf8')) as KitManifest;
  const recorded: Record<string, string> = existsSync(join(dir, INPUTS_FILE))
    ? JSON.parse(readFileSync(join(dir, INPUTS_FILE), 'utf8')).files
    : {};
  const current = Object.fromEntries(kitInputs(project, library));
  const changed = [...new Set([...Object.keys(recorded), ...Object.keys(current)])]
    .filter((path) => recorded[path] !== current[path])
    .sort()
    .map(
      (path) => `${path} (${!recorded[path] ? 'added' : !current[path] ? 'removed' : 'changed'})`,
    );
  const fingerprint = fingerprintOf(project, library, kitInputs(project, library));
  if (kit.fingerprint.generator.version !== fingerprint.generator.version)
    changed.push(
      `generator ${kit.fingerprint.generator.version} → ${fingerprint.generator.version}`,
    );
  for (const [pkg, version] of Object.entries(fingerprint.packages ?? {}))
    if (kit.fingerprint.packages?.[pkg] !== version)
      changed.push(`${pkg} ${kit.fingerprint.packages?.[pkg] ?? '(absent)'} → ${version}`);
  return { status: changed.length ? 'stale' : 'current', changed };
}
