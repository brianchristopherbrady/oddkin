/**
 * Agent-kit pilot, kit generation (IMPLEMENTATION_PLAN.md M5 items 859–861; agent-tooling.md §5):
 * an entry guide, references, and JSON contract bundles for one library, generated from its
 * published metadata and its theme's token inspection, with a freshness check. Exact API facts
 * are extracted; guidance is shown only where the library authored it.
 *
 *   node scripts/agent-kit/kit.mjs [--root <dir>] [--package <name>]... [--out <dir>]
 *                                  [--theme-config <file>] [--check]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { exportTarget, inputsHash, resolveProjectContext } from './context.mjs';

export const KIT_SCHEMA = 'https://oddkin.dev/schemas/agent-kit/v1.json';
export const GUIDE_BUDGET = 8192;
const INPUTS_FILE = 'inputs.json';

export const kitDirName = (name) => name.replace(/^@/, '').replace(/\//g, '-');
export const refreshCommand = (name, out) =>
  `node scripts/agent-kit/kit.mjs --package ${name} --out ${out}`;

const cell = (value) =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');
const code = (value) => `\`${String(value).replace(/`/g, "'")}\``;
const table = (head, rows) =>
  rows.length
    ? [
        `| ${head.join(' | ')} |`,
        `| ${head.map(() => '---').join(' | ')} |`,
        ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
        '',
      ].join('\n')
    : '';
const at = (fact) => (fact.source ? ` (${fact.source.file}:${fact.source.line})` : '');

/** The input files one library's kit depends on: its package, the theme, and the workspace manifest. */
function kitInputs(project, library) {
  const rel = (file) => relative(project.root, file).split('\\').join('/');
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

function fingerprintOf(project, library, inputs) {
  const versions = { [library.name]: library.version };
  for (const dep of Object.keys({
    ...library.manifest.dependencies,
    ...library.manifest.peerDependencies,
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
export const metadataHash = (dir) =>
  createHash('sha256')
    .update(readFileSync(join(dir, 'oddkin.metadata.json')))
    .digest('hex');

const declarationOf = (cem, component) =>
  cem?.modules
    ?.find((m) => m.path === component.cem.module)
    ?.declarations?.find((d) => d.name === component.cem.name);

/** The shortest public specifier whose module exports the class (not a registration entry). */
function classImport(library, component) {
  const exporting = new Set(
    (library.cem?.modules ?? [])
      .filter((m) => m.exports?.some((e) => e.kind === 'js' && e.name === component.cem.name))
      .map((m) => m.path),
  );
  const specifiers = Object.keys(library.manifest.exports ?? {})
    .filter((subpath) => exporting.has(exportTarget(library.manifest, subpath)))
    .map((subpath) => (subpath === '.' ? library.name : `${library.name}${subpath.slice(1)}`))
    .sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  return specifiers[0];
}

function componentReference(library, component, categories, examples) {
  const declaration = declarationOf(library.cem, component) ?? {};
  const tag = component.tag;
  const propertyOnly = new Set((component.propertyOnly ?? []).map((p) => p.property.split('#')[1]));
  const intents = new Map(
    (component.events ?? []).map((e) => [
      e.event.split('#')[1],
      e.intent.known === false ? 'unknown (not declared)' : `${e.intent.value} (authored)`,
    ]),
  );
  const fields = (declaration.members ?? []).filter((m) => m.kind === 'field');
  const methods = (declaration.members ?? []).filter((m) => m.kind === 'method');
  const imported = classImport(library, component);
  const category = component.category ? categories[component.category]?.label : undefined;
  const lines = [
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
    ...Object.entries(component.definition?.dependencies ?? {}).map(
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
      fields.map((f) => [
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
            methods.map((m) => [code(`${m.name}()`), m.description ?? '']),
          ),
        ]
      : []),
    '## Events',
    '',
    table(
      ['Event', 'Type', 'Intent', 'Description'],
      (declaration.events ?? []).map((e) => [
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
  ]) {
    const entries = declaration[key] ?? [];
    lines.push(
      `## ${title}`,
      '',
      table(
        ['Name', 'Description'],
        entries.map((s) => [s.name ? code(s.name) : '(default)', s.description ?? '']),
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
  ])
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
        `- Variables: ${customization.variables.map((v) => code(v.split('#')[1])).join(', ')}`,
      );
  }
  if (component.contracts?.length)
    lines.push('', '## Contracts', '', ...component.contracts.map((id) => `- ${code(id)}`));
  const verified = (component.verification ?? []).filter((v) => v.provenance === 'verified');
  if (verified.length) {
    lines.push('', '## Verified', '');
    for (const v of verified)
      lines.push(
        `- ${v.facts.length} facts verified by ${code(v.suite)} in ${v.conditions.browsers.map((b) => `${b.name} ${b.version}`).join(', ')} (${v.source.test}, ${v.source.date.slice(0, 10)})`,
      );
  }
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

function choosingReference(library, components, categories) {
  const groups = new Map();
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
        ...(c.useFor ?? []).map((f) => `  - Use for: ${f.value}`),
        ...(c.notFor ?? []).map((f) => `  - Not for: ${f.value}`),
      ];
      authored += facts.length;
      lines.push(`- ${code(`<${c.tag}>`)}`, ...(facts.length ? facts : ['  - Not authored.']));
    }
    lines.push('');
  }
  return { text: `${lines.join('\n').trimEnd()}\n`, notAuthored: authored === 0 };
}

const valueText = (value) =>
  value && typeof value === 'object'
    ? Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')
    : String(value ?? '');

function tokenReference(category, tokens, inspection) {
  return `${[
    `# Tokens: ${category}`,
    '',
    `Theme ${code(inspection.theme)}, modes ${inspection.modes.join(', ')}. From the theme's token inspection.`,
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

function recipeReference(id, recipe) {
  return `${[
    `# Recipe ${recipe.name}`,
    '',
    `Id ${code(id)}.${recipe.container ? ` Container ${code(recipe.container.name ?? JSON.stringify(recipe.container))}.` : ''}`,
    '',
    table(
      ['Region', 'Helper'],
      Object.entries(recipe.regions ?? {}).map(([region, r]) => [code(region), r.helper]),
    ),
    ...(recipe.variants
      ? [
          '## Variants',
          '',
          ...Object.entries(recipe.variants).map(([k, v]) => `- ${code(k)}: ${v.join(', ')}`),
          '',
        ]
      : []),
    ...(recipe.conditions?.length
      ? ['## Conditions', '', ...recipe.conditions.map((c) => `- ${code(c)}`), '']
      : []),
    ...(recipe.parts?.length
      ? ['## Parts', '', ...recipe.parts.map((p) => `- ${code(p)}`), '']
      : []),
    `Layers: ${recipe.layers.join(' → ')}.`,
  ]
    .join('\n')
    .trimEnd()}\n`;
}

function stylesheetReference(id, sheet) {
  const list = (title, values) =>
    values.length ? [`## ${title}`, '', values.map(code).join(', '), ''] : [];
  return `${[
    `# Stylesheet ${sheet.name}`,
    '',
    `Id ${code(id)}. Import ${code(sheet.import)} once per document; its rules are in the ${code(sheet.layer)} layer.`,
    '',
    ...(sheet.description ? [sheet.description, ''] : []),
    ...list(
      'Classes',
      sheet.classes.map((c) => `.${c}`),
    ),
    ...list('Variables an author may set', sheet.variables),
    ...list('Tokens read', sheet.tokens),
  ]
    .join('\n')
    .trimEnd()}\n`;
}

/** The public specifier of a package file, through exact or `*` pattern exports. */
function exportedAs(library, file) {
  for (const [subpath, target] of Object.entries(library.manifest.exports ?? {})) {
    const path =
      typeof target === 'string'
        ? target
        : (target?.development ?? target?.import ?? target?.default);
    if (typeof path !== 'string') continue;
    if (!path.includes('*')) {
      if (path.replace(/^\.\//, '') === file) return `${library.name}${subpath.slice(1)}`;
      continue;
    }
    const [before, after] = path.replace(/^\.\//, '').split('*');
    if (
      file.startsWith(before) &&
      file.endsWith(after) &&
      file.length >= before.length + after.length
    )
      return `${library.name}${subpath.slice(1).replace('*', file.slice(before.length, file.length - after.length))}`;
  }
  return undefined;
}

function modelReference(library, id, model) {
  const exported = exportedAs(library, model.schema);
  return `${[
    `# Model ${model.name} v${model.version}`,
    '',
    `Id ${code(id)}. JSON Schema: ${exported ? code(exported) : `${code(model.schema)} in the package (not exported)`}.`,
    ...(model.kinds?.length ? ['', `Kinds: ${model.kinds.map(code).join(', ')}.`] : []),
  ].join('\n')}\n`;
}

/** The guide: what to read first, small enough for every context window. */
function guide(project, library, components, categories, entries, packaged) {
  const deps = Object.keys({
    ...library.manifest.dependencies,
    ...library.manifest.peerDependencies,
  })
    .filter((d) => d.startsWith('@oddkin/'))
    .sort();
  const metadata = library.metadata;
  const propertyOnly = components.flatMap((c) =>
    (c.propertyOnly ?? []).map((p) => code(`${c.tag}.${p.property.split('#')[1]}`)),
  );
  const userEvents = components.flatMap((c) =>
    (c.events ?? [])
      .filter((e) => e.intent.value === 'user')
      .map((e) => code(e.event.split('#')[1])),
  );
  const contracts = Object.entries(metadata.contracts ?? {});
  const commands = Object.entries(project.context.commands ?? {});
  const refs = (kind) => entries.filter((e) => e.kind === kind);
  // One stated rule for every `<prefix-name>` → `<package>/define/<name>` entry keeps the guide within budget.
  const defineEntry = (c) => `${library.name}/define/${c.tag.slice(c.tag.indexOf('-') + 1)}`;
  const regular = components.filter((c) => c.registration === defineEntry(c));
  const irregular = components.filter((c) => c.registration !== defineEntry(c));
  const byCategory = new Map();
  for (const c of components) {
    const label = c.category ? (categories[c.category]?.label ?? c.category) : 'Other';
    byCategory.set(label, [...(byCategory.get(label) ?? []), c.tag]);
  }
  const groups = [...byCategory].sort(([a], [b]) =>
    a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b),
  );
  return `${[
    `# ${library.name} ${library.version}: agent guide`,
    '',
    packaged
      ? `Generated from this package's published metadata when it was built (fingerprint in kit.json), so it matches the installed version. Read the reference for a component before using it.`
      : `Generated by the agent-kit pilot from published metadata (fingerprint in kit.json). Read the reference for a component before using it. If \`${refreshCommand(library.name, '<out>')} --check\` reports the kit as stale, regenerate it first.`,
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
    ...(contracts.length
      ? [
          `- Contracts the components reference (${code(`${contracts[0][1].package}/${contracts[0][1].file}`)}): ${contracts.map(([id, c]) => `${code(id)} ${c.title}`).join('; ')}.`,
        ]
      : []),
    '',
    '## More references',
    '',
    ...(refs('tokens').length
      ? [
          `- Tokens (theme ${code(project.inspection.data.theme)}): ${refs('tokens')
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
      ? `- JSON keyed by stable id, shipped beside this kit: ${code(`${library.name}/oddkin.metadata.json`)} (components, recipes, stylesheets, models), ${code(`${library.name}/custom-elements.json`)}${project.inspection?.source ? `, and the theme's tokens in ${code(`${project.inspection.source.package}${project.inspection.source.export.slice(1)}`)}` : ''}.`
      : `- JSON contract bundles keyed by stable id: ${refs('json')
          .map((e) => e.path)
          .join(', ')}.`,
    ...(commands.length
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
 * guide that needs no refresh command). `extra`: more references, `{ path, text, entry }`.
 */
export function generateKit(project, name, { packaged = false, extra = [] } = {}) {
  const library = project.libraries.find((l) => l.name === name);
  if (!library) throw new Error(`${name} publishes no oddkin.metadata.json in this workspace.`);
  const inputs = kitInputs(project, library);
  const fingerprint = fingerprintOf(project, library, inputs);
  const metadata = library.metadata;
  const categories = metadata.categories ?? {};
  const components = Object.values(metadata.components ?? {}).sort((a, b) =>
    a.tag < b.tag ? -1 : 1,
  );
  const examples = Object.entries(metadata.examples ?? {});
  const files = new Map();
  const entries = [];
  const add = (path, text, entry) => {
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
  const bundle = (entriesById) =>
    `${JSON.stringify({ fingerprint, entries: entriesById }, null, 2)}\n`;
  const tokens = project.inspection?.data;
  if (tokens) {
    const byCategory = new Map();
    for (const t of tokens.tokens)
      byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t]);
    for (const [category, list] of [...byCategory].sort(([a], [b]) => (a < b ? -1 : 1)))
      add(`references/tokens/${category}.md`, tokenReference(category, list, tokens), {
        id: `tokens:${category}`,
        kind: 'tokens',
        provenance: 'extracted',
      });
  }
  for (const [id, recipe] of Object.entries(metadata.recipes ?? {}))
    add(`references/recipes/${recipe.name}.md`, recipeReference(id, recipe), {
      id,
      kind: 'recipe',
      provenance: 'extracted',
    });
  for (const [id, sheet] of Object.entries(metadata.stylesheets ?? {}))
    add(`references/stylesheets/${sheet.name}.md`, stylesheetReference(id, sheet), {
      id,
      kind: 'stylesheet',
      provenance: 'extracted',
    });
  for (const [id, model] of Object.entries(metadata.models ?? {}))
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
        bundle(Object.fromEntries(tokens.tokens.map((t) => [`token:${t.name}`, t]))),
        { id: 'json:tokens', kind: 'json', provenance: 'extracted' },
      );
    if (metadata.recipes)
      add('json/recipes.json', bundle(metadata.recipes), {
        id: 'json:recipes',
        kind: 'json',
        provenance: 'extracted',
      });
    if (metadata.stylesheets)
      add('json/stylesheets.json', bundle(metadata.stylesheets), {
        id: 'json:stylesheets',
        kind: 'json',
        provenance: 'extracted',
      });
    if (metadata.models)
      add('json/models.json', bundle(metadata.models), {
        id: 'json:models',
        kind: 'json',
        provenance: 'extracted',
      });
  }
  for (const { path, text, entry } of extra) add(path, text, entry);
  const guideText = guide(project, library, components, categories, entries, packaged);
  files.set('GUIDE.md', guideText);
  const manifest = {
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
export function writeKit(dir, files) {
  if (existsSync(dir) && readdirSync(dir).length) {
    let previous;
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
export function checkKit(dir, project, name) {
  const library = project.libraries.find((l) => l.name === name);
  if (!library || !existsSync(join(dir, 'kit.json'))) return { status: 'missing', changed: [] };
  const kit = JSON.parse(readFileSync(join(dir, 'kit.json'), 'utf8'));
  const recorded = existsSync(join(dir, INPUTS_FILE))
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
  for (const [pkg, version] of Object.entries(fingerprint.packages))
    if (kit.fingerprint.packages?.[pkg] !== version)
      changed.push(`${pkg} ${kit.fingerprint.packages?.[pkg] ?? '(absent)'} → ${version}`);
  return { status: changed.length ? 'stale' : 'current', changed };
}

export async function main(argv = process.argv.slice(2)) {
  const usage =
    'Usage: node scripts/agent-kit/kit.mjs [--root <dir>] [--package <name>]... [--out <dir>] [--theme-config <file>] [--check]';
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        root: { type: 'string', default: '.' },
        package: { type: 'string', multiple: true },
        out: { type: 'string', default: '.oddkin/agent-kit' },
        'theme-config': { type: 'string' },
        check: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    }));
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    return 2;
  }
  if (values.help) {
    console.log(usage);
    return 0;
  }
  const project = resolveProjectContext(values.root, {
    ...(values['theme-config'] ? { themeConfig: values['theme-config'] } : {}),
  });
  for (const d of project.diagnostics) console.error(`${d.severity} ${d.code}: ${d.message}`);
  const names = values.package ?? project.libraries.filter((l) => l.owned).map((l) => l.name);
  let failed = false;
  for (const name of names) {
    const dir = resolve(values.root, values.out, kitDirName(name));
    if (values.check) {
      const { status, changed } = checkKit(dir, project, name);
      if (status === 'current') console.log(`${name}: current (${dir})`);
      else {
        failed = true;
        console.error(
          `${status === 'stale' ? 'error agent.kit.stale' : 'error agent.kit.missing'}: ${name} at ${dir}${changed.length ? `\n  ${changed.join('\n  ')}` : ''}\n  → ${refreshCommand(name, values.out)}`,
        );
      }
      continue;
    }
    const { files, manifest } = generateKit(project, name);
    writeKit(dir, files);
    console.log(
      `${name}: ${files.size} files in ${dir}; GUIDE.md ${manifest.guide.bytes} of ${manifest.guide.budgetBytes} bytes`,
    );
    if (manifest.guide.bytes > manifest.guide.budgetBytes) {
      failed = true;
      console.error(`error agent.kit.guideBudget: ${name}'s GUIDE.md exceeds its budget.`);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main();
