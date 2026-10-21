/**
 * Agent-kit pilot, project context (IMPLEMENTATION_PLAN.md M5 item 859; agent-tooling.md §4):
 * what a workspace actually installs and publishes, read from package manifests, published
 * metadata, token inspection, and example files only. Nothing is executed or inferred from
 * names; unknown stays absent. Promoted into `@oddkin/agent` (`./context`) in M11.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTEXT_SCHEMA = 'https://oddkin.dev/schemas/project-context/v1.json';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const posix = (path) => path.split(sep).join('/');

/** The pilot's own sources version its output, so a generator change makes kits stale. */
export const GENERATOR = (() => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const sources = readdirSync(dir)
    .filter((file) => file.endsWith('.mjs'))
    .sort()
    .map((file) => `${file}\0${sha256(readFileSync(join(dir, file)))}`)
    .join('\n');
  return { name: 'oddkin-agent-kit-pilot', version: `0.0.0-pilot.${sha256(sources).slice(0, 12)}` };
})();

const COMMANDS = [
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
export function exportTarget(manifest, subpath) {
  const target = manifest.exports?.[subpath];
  const file =
    typeof target === 'string'
      ? target
      : (target?.development ?? target?.import ?? target?.default ?? undefined);
  return typeof file === 'string' ? file.replace(/^\.\//, '') : undefined;
}

/** Node's lookup of an installed package from `from`, through symlinks. */
function findPackage(name, from) {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', ...name.split('/'), 'package.json');
    if (existsSync(candidate)) return dirname(realpathSync(candidate));
    if (dirname(dir) === dir) return undefined;
  }
}

function workspaceDirs(root, manifest, diagnostics) {
  const patterns = Array.isArray(manifest.workspaces)
    ? manifest.workspaces
    : (manifest.workspaces?.packages ?? []);
  const dirs = [];
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
        message: `Workspace pattern "${pattern}" is not read by the pilot (only "dir" and "dir/*"); its packages are missing from the context.`,
      });
  }
  return dirs;
}

/** The authored source of a built module, from its source map; the module itself without one. */
function sourceOf(packageDir, module) {
  const built = join(packageDir, module);
  const map = `${built}.map`;
  if (existsSync(map)) {
    const { sources, sourceRoot = '' } = JSON.parse(readFileSync(map, 'utf8'));
    if (sources?.length === 1) return resolve(dirname(built), sourceRoot, sources[0]);
  }
  return built;
}

/** `folders` when a component's template is its own module beside the class, as compose() needs. */
function layoutOf(component) {
  const template = component.definition?.template?.module;
  if (!template || component.definition.template.package) return 'colocated';
  return template !== component.cem.module && dirname(template) === dirname(component.cem.module)
    ? 'folders'
    : 'colocated';
}

const themeAxes = (inspection) => {
  const values = (attribute) =>
    [
      ...new Set(
        inspection.scopes
          .map((s) => new RegExp(`\\[data-odd-${attribute}~?="([^"]+)"\\]`).exec(s.selector)?.[1])
          .filter(Boolean),
      ),
    ].sort();
  return {
    themes: [...new Set([inspection.theme, ...values('theme')])].sort(),
    modes: [...inspection.modes],
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
export function resolveProjectContext(rootDir, options = {}) {
  const root = resolve(rootDir);
  const rel = (file) => posix(relative(root, file));
  const inputs = new Map();
  const diagnostics = [];
  const readInput = (file) => {
    const text = readFileSync(file, 'utf8');
    inputs.set(rel(file), sha256(text));
    return text;
  };
  const readJson = (file) => JSON.parse(readInput(file));

  const rootManifest = readJson(join(root, 'package.json'));
  const installed = new Map();
  for (const dir of workspaceDirs(root, rootManifest, diagnostics)) {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    installed.set(manifest.name, { dir, manifest, owned: true });
  }
  const declared = (manifest) => [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
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

  const packages = [];
  const libraries = [];
  for (const [name, { dir, manifest, owned }] of [...installed].sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    if (!manifest.exports || !(name.startsWith('@oddkin/') || manifest.customElements)) continue;
    readInput(join(dir, 'package.json'));
    const record = { name, version: manifest.version ?? '0.0.0' };
    if (manifest.peerDependencies) record.peerRanges = { ...manifest.peerDependencies };
    record.exports = Object.keys(manifest.exports)
      .filter((subpath) => subpath !== './package.json')
      .map((subpath) => (subpath === '.' ? name : `${name}${subpath.slice(1)}`));
    const metadataFile = exportTarget(manifest, './oddkin.metadata.json');
    if (metadataFile && existsSync(join(dir, metadataFile))) {
      const metadata = readJson(join(dir, metadataFile));
      const cemFile = manifest.customElements?.replace(/^\.\//, '');
      const cem =
        cemFile && existsSync(join(dir, cemFile)) ? readJson(join(dir, cemFile)) : undefined;
      record.registrations = Object.fromEntries(
        Object.values(metadata.components ?? {}).map((c) => [c.tag, c.registration]),
      );
      record.metadata = rel(join(dir, metadataFile));
      for (const example of Object.values(metadata.examples ?? {}))
        if (existsSync(join(dir, example.file))) readInput(join(dir, example.file));
      libraries.push({ name, version: record.version, dir, manifest, metadata, cem, owned });
    }
    packages.push(record);
  }

  const components = libraries
    .filter((library) => library.owned)
    .flatMap((library) =>
      Object.values(library.metadata.components ?? {}).map((c) => ({
        tag: c.tag,
        source: rel(sourceOf(library.dir, c.definition?.ref?.module ?? c.cem.module)),
        ...(c.definition?.extends ? { extends: c.definition.extends } : {}),
        ...(c.definition?.dependencies
          ? { dependencies: [...new Set(Object.values(c.definition.dependencies))].sort() }
          : {}),
      })),
    )
    .sort((a, b) => (a.tag < b.tag ? -1 : 1));

  // The token inspection the libraries' foundations were generated from.
  let inspection;
  const sources = [
    ...new Set(
      libraries.flatMap((l) =>
        Object.values(l.metadata.foundations ?? {}).map((f) =>
          JSON.stringify(f.generation?.value?.source ?? null),
        ),
      ),
    ),
  ]
    .map((s) => JSON.parse(s))
    .filter(Boolean);
  if (sources.length > 1)
    diagnostics.push({
      code: 'agent.context.themes',
      severity: 'warning',
      message: `Foundations reference ${sources.length} token inspections; the first (${sources[0].package} ${sources[0].export}) describes the theme.`,
    });
  const inspectionFile =
    options.inspection ??
    (sources[0] &&
      (() => {
        const owner = installed.get(sources[0].package);
        const dir = owner?.dir ?? findPackage(sources[0].package, root);
        const manifest = dir && JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        const file = manifest && exportTarget(manifest, sources[0].export);
        return file ? join(dir, file) : undefined;
      })());
  if (inspectionFile && existsSync(inspectionFile))
    inspection = { file: inspectionFile, data: readJson(inspectionFile) };
  if (options.themeConfig) readInput(resolve(root, options.themeConfig));
  for (const name of readdirSync(root).filter((f) =>
    /^oddkin\.docs\.(ts|mts|js|mjs|json)$/.test(f),
  ))
    readInput(join(root, name));

  const scripts = rootManifest.scripts ?? {};
  const commands = Object.fromEntries(
    COMMANDS.flatMap(([key, names]) => {
      const script = names.find((n) => scripts[n]);
      return script ? [[key, script === 'test' ? 'npm test' : `npm run ${script}`]] : [];
    }),
  );

  const names = new Set(packages.map((p) => p.name));
  const hasServices = names.has('@oddkin/state') || names.has('@oddkin/app');
  const hasComponents = libraries.length > 0;
  const capabilityPaths = [
    ...(hasServices ? ['application-services'] : []),
    ...(hasComponents && !hasServices ? ['components-without-state'] : []),
    ...(components.length ? ['core-authoring'] : []),
    ...(names.has('@oddkin/tokens') && !hasComponents && !components.length ? ['tokens-only'] : []),
  ].sort();

  const layouts = new Set(
    libraries
      .filter((l) => l.owned)
      .flatMap((l) => Object.values(l.metadata.components ?? {}).map(layoutOf)),
  );
  const fingerprint = {
    generator: { ...GENERATOR },
    schemaVersion: 1,
    packages: Object.fromEntries(packages.map((p) => [p.name, p.version])),
    inputs: inputsHash(inputs),
  };
  const context = {
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
    recipes: [...new Set(libraries.flatMap((l) => Object.keys(l.metadata.recipes ?? {})))].sort(),
    examples: libraries
      .flatMap((l) =>
        Object.entries(l.metadata.examples ?? {})
          .filter(([, e]) => !e.incorrect)
          .map(([id]) => id),
      )
      .sort(),
    conventions: {
      componentLayout:
        layouts.size === 0 ? 'unknown' : layouts.size > 1 ? 'mixed' : [...layouts][0],
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
    inspection,
    workspace: [...installed]
      .filter(([, p]) => p.owned)
      .map(([name, p]) => ({ name, dir: rel(p.dir) }))
      .sort((a, b) => (a.dir < b.dir ? -1 : 1)),
  };
}

/** `sha256-…` over every input's path and content hash, in path order. */
export function inputsHash(inputs) {
  return `sha256-${sha256(
    [...inputs]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, hash]) => `${path}\0${hash}`)
      .join('\n'),
  )}`;
}
