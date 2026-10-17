/**
 * Outputs: a standard Custom Elements Manifest (custom-elements-manifest@2.1.0) and the
 * Mote enrichment manifest (`mote.metadata.json`, schema v1) that references CEM
 * declarations by module path and name. Deterministic: no timestamps, stable ordering.
 */
import type {
  AnalyzerDiagnostic,
  ComponentInfo,
  DefinitionInfo,
  Extraction,
  Known,
  SourceRef,
} from './extract.js';

export interface ModulePaths {
  /** Map a source path (relative to the package root) to its published module path. */
  readonly moduleOf: (sourceFile: string) => string;
  /** Map a published module path to a package export specifier, when one exists. */
  readonly specifierOf: (modulePath: string) => string | undefined;
}

export interface LibraryInfo {
  readonly name: string;
  readonly version: string;
  readonly prefix?: string;
  readonly packages: ReadonlyArray<{
    readonly name: string;
    readonly version: string;
    readonly customElements?: string;
  }>;
}

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
const optional = <K extends string, V>(key: K, value: V | undefined | false) =>
  value === undefined || value === false || (Array.isArray(value) && value.length === 0)
    ? {}
    : { [key]: value };
const knownDefault = (value: Known<string>) => (value.known ? value.value : undefined);

export function buildManifest(extraction: Extraction, paths: ModulePaths): Record<string, unknown> {
  const tags = new Map(
    extraction.registrations.map((r) => [`${r.classFile}#${r.className}`, r.tag]),
  );
  const modules = new Map<string, { declarations: unknown[]; exports: unknown[] }>();
  const moduleEntry = (path: string) => {
    let entry = modules.get(path);
    if (!entry) {
      entry = { declarations: [], exports: [] };
      modules.set(path, entry);
    }
    return entry;
  };
  const reference = (from: { name: string; file: string } | undefined) =>
    from ? { name: from.name, module: paths.moduleOf(from.file) } : undefined;

  for (const component of extraction.components) {
    const module = paths.moduleOf(component.file);
    const tagName = tags.get(`${component.file}#${component.name}`);
    const superclass = component.superclass.package
      ? { name: component.superclass.name, package: component.superclass.package }
      : {
          name: component.superclass.name,
          module: paths.moduleOf(component.superclass.file as string),
        };
    const fields = component.properties.map((p) => ({
      kind: 'field',
      name: p.name,
      type: { text: p.type },
      ...optional('default', knownDefault(p.default)),
      ...optional('description', p.description),
      ...optional('attribute', p.attribute ?? undefined),
      ...optional('reflects', p.reflects || undefined),
      ...optional('inheritedFrom', reference(p.inheritedFrom)),
    }));
    const members = component.members.map((m) =>
      m.kind === 'field'
        ? {
            kind: 'field',
            name: m.name,
            type: { text: m.type },
            ...optional('readonly', m.readonly || undefined),
            ...optional('description', m.description),
          }
        : { kind: 'method', name: m.name, ...optional('description', m.description) },
    );
    const declaration = {
      kind: 'class',
      name: component.name,
      ...optional('description', component.description),
      customElement: true,
      ...optional('tagName', tagName),
      superclass,
      members: [...fields, ...members],
      attributes: component.properties
        .filter((p) => p.attribute)
        .map((p) => ({
          name: p.attribute as string,
          type: { text: p.type },
          fieldName: p.name,
          ...optional('default', knownDefault(p.default)),
          ...optional('description', p.description),
          ...optional('inheritedFrom', reference(p.inheritedFrom)),
        })),
      events: component.events.map((e) => ({
        name: e.name,
        type: { text: e.detailType === 'void' ? 'CustomEvent' : `CustomEvent<${e.detailType}>` },
        ...optional('description', e.description),
        ...optional('inheritedFrom', reference(e.inheritedFrom)),
      })),
      slots: [...component.slots]
        .sort(byName)
        .map((s) => ({ name: s.name, description: s.description ?? '' })),
      cssParts: [...component.parts]
        .sort(byName)
        .map((s) => ({ name: s.name, description: s.description ?? '' })),
      cssProperties: [...component.cssProperties]
        .sort(byName)
        .map((s) => ({ name: s.name, description: s.description ?? '' })),
      cssStates: [...component.cssStates]
        .sort(byName)
        .map((s) => ({ name: s.name, description: s.description ?? '' })),
    };
    const entry = moduleEntry(module);
    entry.declarations.push(declaration);
    if (component.exported)
      entry.exports.push({
        kind: 'js',
        name: component.name,
        declaration: { name: component.name, module },
      });
  }
  for (const registration of extraction.registrations) {
    moduleEntry(paths.moduleOf(registration.file)).exports.push({
      kind: 'custom-element-definition',
      name: registration.tag,
      declaration: { name: registration.className, module: paths.moduleOf(registration.classFile) },
    });
  }
  // Re-exports: a module exporting a component class declared in another module.
  const declaredIn = new Map<string, string[]>();
  for (const component of extraction.components)
    declaredIn.set(component.name, [...(declaredIn.get(component.name) ?? []), component.file]);
  for (const [file, names] of [...extraction.exports].sort(([a], [b]) => (a < b ? -1 : 1))) {
    for (const name of names) {
      const sources = declaredIn.get(name);
      if (!sources || sources.length !== 1 || sources[0] === file) continue;
      moduleEntry(paths.moduleOf(file)).exports.push({
        kind: 'js',
        name,
        declaration: { name, module: paths.moduleOf(sources[0] as string) },
      });
    }
  }
  return {
    schemaVersion: '2.1.0',
    modules: [...modules.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, entry]) => ({
        kind: 'javascript-module',
        path,
        declarations: entry.declarations,
        exports: entry.exports,
      })),
  };
}

const definitionOf = (definition: DefinitionInfo | undefined, paths: ModulePaths) => {
  if (!definition) return undefined;
  const ref = (source: SourceRef) => ({ module: paths.moduleOf(source.file), name: source.name });
  return {
    ...optional('ref', definition.ref && ref(definition.ref)),
    ...optional('extends', definition.extends && `component:${definition.extends}`),
    ...optional('template', definition.template && ref(definition.template)),
    ...optional('styles', definition.styles.map(ref)),
    ...optional(
      'dependencies',
      Object.keys(definition.dependencies).length
        ? Object.fromEntries(
            Object.entries(definition.dependencies)
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([role, tag]) => [role, `component:${tag}`]),
          )
        : undefined,
    ),
  };
};

const FACT_TAGS: Record<string, string> = {
  a11y: 'a11y',
  keyboard: 'keyboard',
  useFor: 'useFor',
  notFor: 'notFor',
  limitation: 'limitations',
};

export function buildMetadata(
  extraction: Extraction,
  paths: ModulePaths,
  library: LibraryInfo,
  moteVersion: string,
): Record<string, unknown> {
  const components: Record<string, unknown> = {};
  const byClass = new Map<string, ComponentInfo>(
    extraction.components.map((c) => [`${c.file}#${c.name}`, c]),
  );
  for (const registration of [...extraction.registrations].sort((a, b) =>
    a.tag < b.tag ? -1 : 1,
  )) {
    const component = byClass.get(`${registration.classFile}#${registration.className}`);
    if (!component) continue;
    const facts: Record<string, unknown[]> = {};
    for (const [tag, entries] of Object.entries(component.tags)) {
      const key = FACT_TAGS[tag];
      if (!key) continue;
      facts[key] = entries.map((e) => ({
        value: e.value,
        provenance: 'authored',
        source: { file: e.location.file, line: e.location.line, column: e.location.column },
      }));
    }
    const category = component.tags['category']?.[0]?.value;
    const related = (component.tags['related'] ?? [])
      .flatMap((e) => e.value.split(/[\s,]+/))
      .filter(Boolean)
      .map((tag) => `component:${tag.replace(/^<|>$/g, '')}`);
    const module = paths.moduleOf(registration.file);
    components[`component:${registration.tag}`] = {
      tag: registration.tag,
      cem: { module: paths.moduleOf(component.file), name: component.name },
      registration: paths.specifierOf(module) ?? module,
      ...optional('definition', definitionOf(registration.definition, paths)),
      ...optional(
        'category',
        category ? `category:${category.trim().toLowerCase().replace(/\s+/g, '-')}` : undefined,
      ),
      ...optional(
        'syncPairs',
        component.events
          .filter((e) => e.syncs)
          .map((e) => ({ property: e.syncs as string, event: e.name })),
      ),
      ...optional(
        'tokenReads',
        component.tokenReads.map((t) => ({
          token: t.token,
          kind: 'declared',
          readThrough: t.readThrough,
        })),
      ),
      ...optional(
        'previewRoles',
        (component.tags['previewRole'] ?? [])
          .flatMap((e) => e.value.split(/[\s,]+/))
          .filter(Boolean)
          .map((role) => `role:${role}`),
      ),
      ...facts,
      ...optional('related', related),
      ...optional(
        'authored',
        component.authored?.ids.map((id) => {
          const [kind, name] = id.split('#');
          return {
            id: `${kind}:${registration.tag}#${name}`,
            provenance: 'authored',
            source: { file: component.authored?.file as string, line: 1 },
          };
        }),
      ),
    };
  }
  const recipes = Object.fromEntries(
    [...extraction.recipes].sort(byName).map((r) => [
      `recipe:${r.name}`,
      {
        name: r.name,
        ...optional('container', r.container),
        regions: Object.fromEntries(
          Object.entries(r.regions).map(([region, helper]) => [
            region,
            {
              helper: ['stack', 'row', 'grid', 'autoGrid', 'split'].includes(helper)
                ? helper
                : 'custom',
            },
          ]),
        ),
        ...optional('variants', Object.keys(r.variants).length ? r.variants : undefined),
        ...optional('conditions', r.conditions),
        ...optional('parts', r.parts),
        layers: ['recipe.base', 'recipe.variant', 'recipe.condition'],
      },
    ]),
  );
  const models = Object.fromEntries(
    [...extraction.models].sort(byName).map((m) => [
      `model:${m.name}`,
      {
        name: m.name,
        version: m.version,
        schema: `schemas/${m.name}.v${m.version}.json`,
        ...optional('kinds', m.kinds),
      },
    ]),
  );
  return {
    schema: 'https://mote.dev/schemas/mote-metadata/v1.json',
    moteVersion,
    library,
    components,
    ...optional('recipes', Object.keys(recipes).length ? recipes : undefined),
    ...optional('models', Object.keys(models).length ? models : undefined),
    diagnostics: sortDiagnostics(extraction.diagnostics),
  };
}

export function sortDiagnostics(diagnostics: readonly AnalyzerDiagnostic[]): AnalyzerDiagnostic[] {
  const key = (d: AnalyzerDiagnostic) =>
    `${d.source?.file ?? ''}\u0000${String(d.source?.line ?? 0).padStart(8, '0')}\u0000${String(d.source?.column ?? 0).padStart(8, '0')}\u0000${d.code}`;
  return [...diagnostics].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** Stable JSON text: two-space indentation and a trailing newline. */
export const stableJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
