/**
 * Agent kits, the project context (agent-tooling.md §4): what a workspace actually installs and
 * publishes, read from package manifests, published metadata, token inspection, and example files
 * only. Nothing is executed or inferred from names; unknown stays absent.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTEXT_SCHEMA = 'https://oddkin.dev/schemas/project-context/v1.json';

const sha256 = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');
const posix = (path: string): string => path.split(sep).join('/');

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The generator: this package and a hash of the kit modules themselves, so a generator change
 * makes kits stale. The built modules are the same bytes in the workspace that builds the package
 * and in every project that installs it.
 */
export const GENERATOR: { readonly name: string; readonly version: string } = (() => {
  const manifest = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  const own = extname(fileURLToPath(import.meta.url));
  const sources = readdirSync(here)
    .filter((file) => extname(file) === own && !file.endsWith(`.d${own}`))
    .sort()
    .map((file) => `${file}\0${sha256(readFileSync(join(here, file)))}`)
    .join('\n');
  return {
    name: `${manifest.name}/kit`,
    version: `${manifest.version}+${sha256(sources).slice(0, 12)}`,
  };
})();

export interface Fingerprint {
  generator: { name: string; version: string };
  schemaVersion: number;
  packages?: Record<string, string>;
  inputs: string;
}

export interface ProjectContext {
  schema: string;
  packages: Array<{
    name: string;
    version: string;
    peerRanges?: Record<string, string>;
    exports?: string[];
    registrations?: Record<string, string>;
    metadata?: string;
  }>;
  components?: Array<{ tag: string; source: string; extends?: string; dependencies?: string[] }>;
  theme?: {
    config?: string;
    themes?: string[];
    modes?: string[];
    densities?: string[];
    profiles?: string[];
    products?: string[];
  };
  recipes: string[];
  stylesheets: string[];
  examples: string[];
  conventions: { componentLayout: 'folders' | 'colocated' | 'mixed' | 'unknown' };
  commands: Record<string, string>;
  capabilityPaths: Array<
    'core-authoring' | 'tokens-only' | 'components-without-state' | 'application-services'
  >;
  fingerprint: Fingerprint;
  freshness: 'current' | 'stale' | 'unknown';
}

export interface Library {
  name: string;
  version: string;
  dir: string;
  manifest: Record<string, any>;
  metadata: Record<string, any>;
  cem?: Record<string, any>;
  owned: boolean;
}

export interface ContextDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

/** Where a theme's token inspection comes from: a package export. */
export interface InspectionSource {
  package: string;
  export: string;
}

export interface Project {
  root: string;
  context: ProjectContext;
  diagnostics: ContextDiagnostic[];
  /** Input path (relative to the root) → SHA-256 of its content. */
  inputs: Map<string, string>;
  libraries: Library[];
  inspection?: { file: string; data: Record<string, any>; source?: InspectionSource };
  workspace: Array<{ name: string; dir: string }>;
}

const COMMANDS: Array<[string, string[]]> = [
  ['build', ['build']],
  ['typecheck', ['typecheck']],
  ['test', ['test']],
  ['browser', ['test:browser']],
  ['e2e', ['test:e2e', 'e2e']],
  ['lint', ['lint']],
  ['verify', ['verify']],
  ['metadata', ['verify:metadata', 'metadata']],
];

/** The file a package exports at `subpath` (development build first, as the analyzer reads). */
export function exportTarget(manifest: Record<string, any>, subpath: string): string | undefined {
  const target = manifest['exports']?.[subpath];
  const file =
    typeof target === 'string'
      ? target
      : (target?.development ?? target?.import ?? target?.default ?? undefined);
  return typeof file === 'string' ? file.replace(/^\.\//, '') : undefined;
}

/** Node's lookup of an installed package from `from`, through symlinks. */
function findPackage(name: string, from: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', ...name.split('/'), 'package.json');
    if (existsSync(candidate)) return dirname(realpathSync(candidate));
    if (dirname(dir) === dir) return undefined;
  }
}

function workspaceDirs(
  root: string,
  manifest: Record<string, any>,
  diagnostics: ContextDiagnostic[],
): string[] {
  const workspaces = manifest['workspaces'];
  const patterns: string[] = Array.isArray(workspaces) ? workspaces : (workspaces?.packages ?? []);
  const dirs: string[] = [];
  for (const pattern of patterns) {
    if (/^[^*]+\/\*$/.test(pattern)) {
      const base = join(root, pattern.slice(0, -2));
      if (!existsSync(base)) continue;
      for (const name of readdirSync(base).sort())
        if (existsSync(join(base, name, 'package.json'))) dirs.push(join(base, name));
    } else if (!pattern.includes('*')) {
      if (existsSync(join(root, pattern, 'package.json'))) dirs.push(join(root, pattern));
    } else
      diagnostics.push({
        code: 'agent.context.workspacePattern',
        severity: 'warning',
        message: `Workspace pattern "${pattern}" is not read (only "dir" and "dir/*"); its packages are missing from the context.`,
      });
  }
  return dirs;
}

/** The authored source of a built module, from its source map; the module itself without one. */
function sourceOf(packageDir: string, module: string): string {
  const built = join(packageDir, module);
  const map = `${built}.map`;
  if (existsSync(map)) {
    const { sources, sourceRoot = '' } = JSON.parse(readFileSync(map, 'utf8')) as {
      sources?: string[];
      sourceRoot?: string;
    };
    if (sources?.length === 1) return resolve(dirname(built), sourceRoot, sources[0]!);
  }
  return built;
}

/** `folders` when a component's template is its own module beside the class, as compose() needs. */
function layoutOf(component: any): 'folders' | 'colocated' {
  const template = component.definition?.template?.module;
  if (!template || component.definition.template.package) return 'colocated';
  return template !== component.cem.module && dirname(template) === dirname(component.cem.module)
    ? 'folders'
    : 'colocated';
}

const themeAxes = (inspection: Record<string, any>) => {
  const values = (attribute: string): string[] =>
    [
      ...new Set<string>(
        (inspection['scopes'] as Array<{ selector: string }>)
          .map((s) => new RegExp(`\\[data-odd-${attribute}~?="([^"]+)"\\]`).exec(s.selector)?.[1])
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort();
  return {
    themes: [...new Set<string>([inspection['theme'], ...values('theme')])].sort(),
    modes: [...(inspection['modes'] as string[])],
    densities: values('density'),
    profiles: values('profile'),
    products: values('product'),
  };
};

/**
 * Resolve a workspace's project context (project-context.v1). `options.themeConfig` names the
 * theme configuration file; the token inspection is the one the libraries' foundations
 * reference, or `options.inspection`.
 */
export function resolveProjectContext(
  rootDir: string,
  options: { themeConfig?: string; inspection?: string } = {},
): Project {
  const root = resolve(rootDir);
  const rel = (file: string) => posix(relative(root, file));
  const inputs = new Map<string, string>();
  const diagnostics: ContextDiagnostic[] = [];
  const readInput = (file: string) => {
    const text = readFileSync(file, 'utf8');
    inputs.set(rel(file), sha256(text));
    return text;
  };
  const readJson = (file: string): Record<string, any> => JSON.parse(readInput(file));

  const rootManifest = readJson(join(root, 'package.json'));
  const installed = new Map<
    string,
    { dir: string; manifest: Record<string, any>; owned: boolean }
  >();
  for (const dir of workspaceDirs(root, rootManifest, diagnostics)) {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    installed.set(manifest.name, { dir, manifest, owned: true });
  }
  const declared = (manifest: Record<string, any>) => [
    ...Object.keys(manifest['dependencies'] ?? {}),
    ...Object.keys(manifest['devDependencies'] ?? {}),
    ...Object.keys(manifest['peerDependencies'] ?? {}),
  ];
  const wanted = new Set(
    [rootManifest, ...[...installed.values()].map((p) => p.manifest)].flatMap(declared),
  );
  for (const name of [...wanted].sort()) {
    if (installed.has(name)) continue;
    const dir = findPackage(name, root);
    if (!dir) {
      if (name.startsWith('@oddkin/'))
        diagnostics.push({
          code: 'agent.context.notInstalled',
          severity: 'warning',
          message: `${name} is declared but not installed; run the package manager's install.`,
        });
      continue;
    }
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    installed.set(name, { dir, manifest, owned: false });
  }

  const packages: ProjectContext['packages'] = [];
  const libraries: Library[] = [];
  for (const [name, { dir, manifest, owned }] of [...installed].sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    if (!manifest['exports'] || !(name.startsWith('@oddkin/') || manifest['customElements']))
      continue;
    readInput(join(dir, 'package.json'));
    const record: ProjectContext['packages'][number] = {
      name,
      version: manifest['version'] ?? '0.0.0',
    };
    if (manifest['peerDependencies']) record.peerRanges = { ...manifest['peerDependencies'] };
    record.exports = Object.keys(manifest['exports'])
      .filter((subpath) => subpath !== './package.json')
      .map((subpath) => (subpath === '.' ? name : `${name}${subpath.slice(1)}`));
    const metadataFile = exportTarget(manifest, './oddkin.metadata.json');
    if (metadataFile && existsSync(join(dir, metadataFile))) {
      const metadata = readJson(join(dir, metadataFile));
      const cemFile = (manifest['customElements'] as string | undefined)?.replace(/^\.\//, '');
      const cem =
        cemFile && existsSync(join(dir, cemFile)) ? readJson(join(dir, cemFile)) : undefined;
      record.registrations = Object.fromEntries(
        Object.values<any>(metadata['components'] ?? {}).map((c) => [c.tag, c.registration]),
      );
      record.metadata = rel(join(dir, metadataFile));
      for (const example of Object.values<any>(metadata['examples'] ?? {}))
        if (existsSync(join(dir, example.file))) readInput(join(dir, example.file));
      libraries.push({
        name,
        version: record.version,
        dir,
        manifest,
        metadata,
        ...(cem ? { cem } : {}),
        owned,
      });
    }
    packages.push(record);
  }

  const components = libraries
    .filter((library) => library.owned)
    .flatMap((library) =>
      Object.values<any>(library.metadata['components'] ?? {}).map((c) => ({
        tag: c.tag as string,
        source: rel(sourceOf(library.dir, c.definition?.ref?.module ?? c.cem.module)),
        ...(c.definition?.extends ? { extends: c.definition.extends as string } : {}),
        ...(c.definition?.dependencies
          ? {
              dependencies: [...new Set(Object.values<string>(c.definition.dependencies))].sort(),
            }
          : {}),
      })),
    )
    .sort((a, b) => (a.tag < b.tag ? -1 : 1));

  // The token inspection the libraries' foundations were generated from.
  const sources = [
    ...new Set(
      libraries.flatMap((l) =>
        Object.values<any>(l.metadata['foundations'] ?? {}).map((f) =>
          JSON.stringify(f.generation?.value?.source ?? null),
        ),
      ),
    ),
  ]
    .map((s) => JSON.parse(s) as InspectionSource | null)
    .filter((s): s is InspectionSource => Boolean(s));
  const first = sources[0];
  if (sources.length > 1 && first)
    diagnostics.push({
      code: 'agent.context.themes',
      severity: 'warning',
      message: `Foundations reference ${sources.length} token inspections; the first (${first.package} ${first.export}) describes the theme.`,
    });
  const inspectionFile =
    options.inspection ??
    (first &&
      (() => {
        const owner = installed.get(first.package);
        const dir = owner?.dir ?? findPackage(first.package, root);
        const manifest = dir && JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        const file = manifest && exportTarget(manifest, first.export);
        return dir && file ? join(dir, file) : undefined;
      })());
  let inspection: Project['inspection'];
  if (inspectionFile && existsSync(inspectionFile))
    inspection = {
      file: inspectionFile,
      data: readJson(inspectionFile),
      ...(first && !options.inspection ? { source: first } : {}),
    };
  if (options.themeConfig) readInput(resolve(root, options.themeConfig));
  for (const name of readdirSync(root).filter((f) =>
    /^oddkin\.docs\.(ts|mts|js|mjs|json)$/.test(f),
  ))
    readInput(join(root, name));

  const scripts: Record<string, string> = rootManifest['scripts'] ?? {};
  const commands = Object.fromEntries(
    COMMANDS.flatMap(([key, names]) => {
      const script = names.find((n) => scripts[n]);
      return script ? [[key, script === 'test' ? 'npm test' : `npm run ${script}`]] : [];
    }),
  );

  const names = new Set(packages.map((p) => p.name));
  const hasServices = names.has('@oddkin/state') || names.has('@oddkin/app');
  const hasComponents = libraries.length > 0;
  const capabilityPaths: ProjectContext['capabilityPaths'] = [
    ...(hasServices ? (['application-services'] as const) : []),
    ...(hasComponents && !hasServices ? (['components-without-state'] as const) : []),
    ...(components.length ? (['core-authoring'] as const) : []),
    ...(names.has('@oddkin/tokens') && !hasComponents && !components.length
      ? (['tokens-only'] as const)
      : []),
  ].sort();

  const layouts = new Set(
    libraries
      .filter((l) => l.owned)
      .flatMap((l) => Object.values<any>(l.metadata['components'] ?? {}).map(layoutOf)),
  );
  const fingerprint: Fingerprint = {
    generator: { ...GENERATOR },
    schemaVersion: 1,
    packages: Object.fromEntries(packages.map((p) => [p.name, p.version])),
    inputs: inputsHash(inputs),
  };
  const context: ProjectContext = {
    schema: CONTEXT_SCHEMA,
    packages,
    ...(components.length ? { components } : {}),
    ...(inspection || options.themeConfig
      ? {
          theme: {
            ...(options.themeConfig ? { config: rel(resolve(root, options.themeConfig)) } : {}),
            ...(inspection ? themeAxes(inspection.data) : {}),
          },
        }
      : {}),
    recipes: [
      ...new Set(libraries.flatMap((l) => Object.keys(l.metadata['recipes'] ?? {}))),
    ].sort(),
    stylesheets: [
      ...new Set(libraries.flatMap((l) => Object.keys(l.metadata['stylesheets'] ?? {}))),
    ].sort(),
    examples: libraries
      .flatMap((l) =>
        Object.entries<any>(l.metadata['examples'] ?? {})
          .filter(([, e]) => !e.incorrect)
          .map(([id]) => id),
      )
      .sort(),
    conventions: {
      componentLayout:
        layouts.size === 0 ? 'unknown' : layouts.size > 1 ? 'mixed' : [...layouts][0]!,
    },
    commands,
    capabilityPaths,
    fingerprint,
    freshness: 'current',
  };
  return {
    root,
    context,
    diagnostics,
    inputs,
    libraries,
    ...(inspection ? { inspection } : {}),
    workspace: [...installed]
      .filter(([, p]) => p.owned)
      .map(([name, p]) => ({ name, dir: rel(p.dir) }))
      .sort((a, b) => (a.dir < b.dir ? -1 : 1)),
  };
}

/** `sha256-…` over every input's path and content hash, in path order. */
export function inputsHash(inputs: Map<string, string>): string {
  return `sha256-${sha256(
    [...inputs]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, hash]) => `${path}\0${hash}`)
      .join('\n'),
  )}`;
}
