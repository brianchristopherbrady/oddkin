#!/usr/bin/env node
// Enforces Oddkin package boundaries on manifests, sources, and built artifacts.
// Rules and rationale: docs/architecture/packages.md. Configuration: ./boundaries.config.mjs.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { builtinModules, createRequire, stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { init, parse } from 'es-module-lexer';
import defaultConfig from './boundaries.config.mjs';

const BUILTINS = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
const SOURCE_EXTENSIONS = ['.ts', '.mts', '.tsx', '.js', '.mjs'];

/**
 * @typedef {{ code: string, message: string, file?: string, fix?: string }} Diagnostic
 * @typedef {{ suffix: string, allow: string[] }} DevSources
 * @typedef {{ kind: 'browser' | 'node' | 'mixed', allow: string[], domFree?: string[], nodeEntries?: string[], nodeSources?: string[], nodeOnlyDependencies?: string[], devSources?: DevSources }} PackageRule
 * @typedef {{ packages: Record<string, PackageRule> }} BoundaryConfig
 */

const isBuiltin = (spec) => spec.startsWith('node:') || BUILTINS.has(spec.split('/')[0]);
/** Development-only sources (e.g. `*.examples.ts`): type-checked and tested, never built or shipped. */
const isDevSource = (rule, file) => {
  const suffix = rule?.devSources?.suffix;
  return !!suffix && new RegExp(`${suffix.replace(/\./g, '\\.')}\\.[cm]?[jt]sx?$`).test(file);
};
const isRelative = (spec) =>
  spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
const packageNameOf = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
const subpathOf = (spec) => {
  const rest = spec.slice(packageNameOf(spec).length);
  return rest ? `.${rest}` : '.';
};
const exportKeys = (manifest) =>
  manifest.exports && typeof manifest.exports === 'object' && !Array.isArray(manifest.exports)
    ? Object.keys(manifest.exports)
    : ['.'];
const matchesExport = (keys, subpath) =>
  keys.some((key) => {
    if (key === subpath) return true;
    if (!key.includes('*')) return false;
    const [prefix, suffix] = key.split('*');
    return subpath.startsWith(prefix) && subpath.endsWith(suffix);
  });

function exportTarget(manifest, subpath, condition = 'default') {
  const entry = manifest.exports?.[subpath] ?? (subpath === '.' ? manifest.exports : undefined);
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') return entry[condition] ?? entry.import ?? entry.default;
  return subpath === '.' ? manifest.main : undefined;
}

/** A tsconfig `include` or `exclude` pattern (`src`, `src/node`, `src/**\/*.examples.ts`). */
const globPattern = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/^\.\//, '')
      .replace(/\/+$/, '')
      .replace(/[.+^${}()|[\]\\*?]/g, '\\$&')
      .replace(/\\\*\\\*\//g, '(?:.*/)?')
      .replace(/\\\*\\\*/g, '.*')
      .replace(/\\\*/g, '[^/]*')
      .replace(/\\\?/g, '[^/]')}(?:/.*)?$`,
  );

/** A package's TypeScript projects: which of its files each compiles, and the projects it references. */
async function projectsOf(pkg) {
  const projects = [];
  for (const name of (await readdir(pkg.dir)).filter((f) =>
    /^tsconfig(?:\.[\w-]+)?\.json$/.test(f),
  )) {
    const file = join(pkg.dir, name);
    let config;
    try {
      config = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      continue;
    }
    const include = (config.include ?? (config.files ? [] : ['**/*'])).map(globPattern);
    const exclude = (config.exclude ?? []).map(globPattern);
    projects.push({
      file,
      covers: (path) => include.some((r) => r.test(path)) && !exclude.some((r) => r.test(path)),
      references: (config.references ?? []).map(({ path }) => {
        const target = resolve(pkg.dir, path);
        return target.endsWith('.json') ? target : join(target, 'tsconfig.json');
      }),
    });
  }
  return projects;
}

/** The project of `pkg` that compiles the source of an export (`./dist/x.d.ts` from `src/x.ts`). */
function projectFor(pkg, subpath, projects) {
  const target =
    exportTarget(pkg.manifest, subpath, 'types') ?? exportTarget(pkg.manifest, subpath);
  if (!target || !/\.(?:d\.[cm]?ts|[cm]?js)$/.test(target)) return undefined;
  const source = target
    .replace(/^\.\//, '')
    .replace(/^dist\//, 'src/')
    .replace(/\.d\.([cm]?)ts$|\.([cm]?)js$/, (_, d = '', j = '') => `.${d || j}ts`);
  return projects.find((project) => project.covers(source));
}

/**
 * Project references follow imports: each TypeScript project of a package must reach, through its
 * references, the project that builds every workspace entry its files import. TypeScript 7's
 * `tsc -b` builds projects without a path of references between them in parallel, so a missing one
 * may check a file before the declarations it imports exist.
 */
function checkReferences(pkg, sources, byName, projects, report, rel) {
  const byFile = new Map([...projects.values()].flat().map((p) => [p.file, p]));
  const reaches = (from, to, seen = new Set()) => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (byFile.get(from)?.references ?? []).some((next) => reaches(next, to, seen));
  };
  const missing = new Map();
  for (const project of projects.get(pkg.name) ?? []) {
    for (const { file, specifiers } of sources) {
      if (!project.covers(relative(pkg.dir, file).split(sep).join('/'))) continue;
      for (const spec of specifiers) {
        if (!spec.startsWith('@oddkin/')) continue;
        const target = byName.get(packageNameOf(spec));
        if (!target) continue;
        const needed = projectFor(target, subpathOf(spec), projects.get(target.name) ?? []);
        if (!needed || reaches(project.file, needed.file)) continue;
        const key = `${project.file}\u0000${needed.file}`;
        if (!missing.has(key)) missing.set(key, { project, needed, file, spec });
      }
    }
  }
  for (const { project, needed, file, spec } of missing.values()) {
    const path = relative(dirname(project.file), needed.file).split(sep).join('/');
    report(
      'boundary.tsconfig.reference',
      `${rel(project.file)} builds ${rel(file)}, which imports ${spec}, but does not reference ${rel(needed.file)}: tsc -b may check it before those declarations exist.`,
      {
        file: rel(project.file),
        fix: `Add { "path": "${path.replace(/\/tsconfig\.json$/, '')}" } to its references.`,
      },
    );
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, extensions) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...(await listFiles(path, extensions)));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(path);
    }
  }
  return out;
}

async function lexImports(code, file) {
  await init;
  // es-module-lexer 3 reports `specifier`; earlier versions reported `n`. Dynamic
  // imports with non-literal specifiers have neither and are skipped.
  const read = (source) =>
    parse(source)[0]
      .map((record) => record.specifier ?? record.n)
      .filter((specifier) => typeof specifier === 'string');
  try {
    return read(code);
  } catch {
    // TypeScript syntax the lexer cannot read: strip types and retry (loses type-only imports).
    if (/\.(m?ts|tsx)$/.test(file)) return read(stripTypeScriptTypes(code, { mode: 'strip' }));
    throw new Error(`Cannot parse imports in ${file}`);
  }
}

async function findWorkspacePackages(root) {
  const rootManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const packages = [];
  for (const pattern of rootManifest.workspaces ?? []) {
    if (!pattern.endsWith('/*')) throw new Error(`Unsupported workspace pattern "${pattern}"`);
    const base = join(root, pattern.slice(0, -2));
    let entries = [];
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(base, entry.name);
      const manifestPath = join(dir, 'package.json');
      if (!(await exists(manifestPath))) continue;
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      packages.push({ name: manifest.name, dir, manifest });
    }
  }
  return packages;
}

function findCycles(graph) {
  const cycles = [];
  const state = new Map();
  const stack = [];
  const visit = (node) => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === 'visiting') cycles.push([...stack.slice(stack.indexOf(next)), next]);
      else if (!state.has(next)) visit(next);
    }
    stack.pop();
    state.set(node, 'done');
  };
  for (const node of graph.keys()) if (!state.has(node)) visit(node);
  return cycles;
}

/**
 * @param {string} root Workspace root containing package.json with `workspaces`.
 * @param {{ config?: BoundaryConfig, artifacts?: boolean }} [options]
 * @returns {Promise<{ diagnostics: Diagnostic[], packages: string[] }>}
 */
export async function checkBoundaries(root, options = {}) {
  const config = options.config ?? defaultConfig;
  const diagnostics = [];
  const report = (code, message, extra = {}) => diagnostics.push({ code, message, ...extra });
  const rel = (path) => relative(root, path).split(sep).join('/');
  const packages = await findWorkspacePackages(root);
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const graph = new Map();
  const scanned = new Map();
  let sourceFiles = 0;
  let importsScanned = 0;

  for (const pkg of packages) {
    const rule = config.packages[pkg.name];
    const manifestFile = rel(join(pkg.dir, 'package.json'));
    if (!rule) {
      report('boundary.package.unknown', `${pkg.name} has no boundary rule.`, {
        file: manifestFile,
        fix: 'Add the package to scripts/architecture/boundaries.config.mjs and docs/architecture/packages.md.',
      });
      continue;
    }
    const runtimeDeps = {
      ...pkg.manifest.dependencies,
      ...pkg.manifest.peerDependencies,
      ...pkg.manifest.optionalDependencies,
    };
    graph.set(
      pkg.name,
      Object.keys(runtimeDeps).filter((dep) => dep.startsWith('@oddkin/')),
    );
    for (const dep of Object.keys(runtimeDeps)) {
      if (dep.startsWith('@oddkin/')) {
        if (!rule.allow.includes(dep)) {
          report('boundary.dependency.forbidden', `${pkg.name} may not depend on ${dep}.`, {
            file: manifestFile,
            fix: `Allowed internal dependencies: ${rule.allow.join(', ') || 'none'}.`,
          });
        }
      } else if (rule.kind === 'browser') {
        report(
          'boundary.dependency.thirdParty',
          `${pkg.name} ships browser code and may not have the third-party runtime dependency "${dep}".`,
          {
            file: manifestFile,
            fix: 'Implement it in Oddkin or move it to devDependencies if it is build-time only.',
          },
        );
      }
    }

    const nodeSources = rule.nodeSources ?? [];
    const isNodeSource = (file) =>
      rule.kind === 'node' ||
      nodeSources.some((prefix) => rel(file).startsWith(rel(join(pkg.dir, prefix))));
    for (const file of await listFiles(join(pkg.dir, 'src'), SOURCE_EXTENSIONS)) {
      const code = await readFile(file, 'utf8');
      sourceFiles++;
      const specifiers = await lexImports(code, file);
      importsScanned += specifiers.length;
      if (!scanned.has(pkg.name)) scanned.set(pkg.name, []);
      scanned.get(pkg.name).push({ file, specifiers });
      const dev = isDevSource(rule, file);
      // Framework typings may import their framework for types only; a value import still fails.
      const typings =
        rule.typeOnly && rel(file).startsWith(rel(join(pkg.dir, rule.typeOnly.sources)))
          ? new Set(await lexImports(stripTypeScriptTypes(code, { mode: 'strip' }), `${file}.js`))
          : undefined;
      // What the file imports at runtime, once its types are stripped (read only when needed).
      let values;
      const valueImports = async () =>
        (values ??= new Set(
          await lexImports(stripTypeScriptTypes(code, { mode: 'strip' }), `${file}.js`),
        ));
      for (const spec of specifiers) {
        const where = { file: rel(file) };
        if (isRelative(spec)) {
          const target = resolve(dirname(file), spec);
          if (!target.startsWith(pkg.dir + sep)) {
            report('boundary.import.outsidePackage', `"${spec}" leaves ${pkg.name}.`, {
              ...where,
              fix: 'Import the other package by name through its public exports.',
            });
          } else if (!dev && isDevSource(rule, target)) {
            report(
              'boundary.import.devSource',
              `"${spec}" is a development-only source; shipped code of ${pkg.name} cannot import it.`,
              { ...where, fix: 'Import examples only from tests and tooling.' },
            );
          }
        } else if (isBuiltin(spec)) {
          if (!isNodeSource(file)) {
            report(
              'boundary.import.nodeBuiltin',
              `"${spec}" is a Node built-in in browser code of ${pkg.name}.`,
              {
                ...where,
                fix: `Move Node-only code under ${nodeSources.join(', ') || 'a Node-only package'} and expose it through a Node entry.`,
              },
            );
          }
        } else if (spec.startsWith('@oddkin/')) {
          const target = packageNameOf(spec);
          if (target === pkg.name) continue;
          const devAllowed = dev && (rule.devSources?.allow ?? []).includes(target);
          if (!rule.allow.includes(target) && !devAllowed) {
            report('boundary.import.forbidden', `${pkg.name} may not import ${target}.`, {
              ...where,
              fix: `Allowed internal dependencies: ${rule.allow.join(', ') || 'none'}.`,
            });
            continue;
          }
          if (devAllowed && !rule.allow.includes(target)) {
            if (!(target in (pkg.manifest.devDependencies ?? {}))) {
              report(
                'boundary.import.undeclared',
                `${pkg.name} imports ${target} from a development-only source without declaring it.`,
                { ...where, fix: `Add "${target}" to devDependencies in ${manifestFile}.` },
              );
            }
          } else if (!(target in runtimeDeps)) {
            report(
              'boundary.import.undeclared',
              `${pkg.name} imports ${target} without declaring it.`,
              {
                ...where,
                fix: `Add "${target}" to dependencies in ${manifestFile}.`,
              },
            );
          }
          const targetPkg = byName.get(target);
          if (targetPkg && !matchesExport(exportKeys(targetPkg.manifest), subpathOf(spec))) {
            report('boundary.import.private', `"${spec}" is not a public export of ${target}.`, {
              ...where,
              fix: `Use one of: ${exportKeys(targetPkg.manifest)
                .map((key) => (key === '.' ? target : `${target}${key.slice(1)}`))
                .join(', ')}.`,
            });
          }
          const targetRule = config.packages[target];
          const nodeOnly =
            targetRule?.kind === 'node' || (rule.nodeOnlyDependencies ?? []).includes(target);
          // A Node package's browser types: `import type` only, which leaves nothing at runtime.
          const typesOnly =
            (targetRule?.browserTypes ?? []).includes(subpathOf(spec)) &&
            !(await valueImports()).has(spec);
          if (nodeOnly && !isNodeSource(file) && !typesOnly) {
            report(
              'boundary.import.nodeOnly',
              `${target} is Node-only tooling and cannot be imported by browser code.`,
              {
                ...where,
                fix: `Import it only from ${nodeSources.join(', ') || 'Node-only packages'}.`,
              },
            );
          }
        } else if (
          typings &&
          rule.typeOnly.allow.includes(packageNameOf(spec)) &&
          !typings.has(spec)
        ) {
          continue;
        } else if (!isNodeSource(file)) {
          report(
            'boundary.import.thirdParty',
            `"${spec}" is a third-party import in browser code of ${pkg.name}.`,
            {
              ...where,
              fix: 'Shipped browser code has zero third-party runtime dependencies.',
            },
          );
        }
      }
    }
  }

  for (const cycle of findCycles(graph)) {
    report('boundary.cycle', `Dependency cycle: ${cycle.join(' -> ')}.`, {
      fix: 'Remove one edge; see the dependency map in docs/architecture/packages.md.',
    });
  }

  const projects = new Map();
  for (const pkg of packages) projects.set(pkg.name, await projectsOf(pkg));
  for (const pkg of packages)
    checkReferences(pkg, scanned.get(pkg.name) ?? [], byName, projects, report, rel);

  const examplesDir = join(root, 'examples');
  const exampleSources = (await exists(examplesDir))
    ? (await readdir(examplesDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(examplesDir, entry.name, 'src'))
    : [];
  await checkBarrels(
    [...packages.map((pkg) => join(pkg.dir, 'src')), ...exampleSources],
    report,
    rel,
  );
  for (const pkg of packages) await checkSideEffects(pkg, report, rel);

  if (options.artifacts) await checkArtifacts(packages, byName, config, report, rel);
  return {
    diagnostics,
    packages: packages.map((pkg) => pkg.name),
    stats: { sourceFiles, importsScanned },
  };
}

async function checkArtifacts(packages, byName, config, report, rel) {
  for (const pkg of packages) {
    const rule = config.packages[pkg.name];
    if (rule) await checkBrowserTypes(pkg, rule, report, rel);
    if (!rule || rule.kind === 'node' || !pkg.manifest.exports) continue;
    if (rule.devSources) {
      for (const file of await listFiles(join(pkg.dir, 'dist'), ['.js', '.d.ts'])) {
        if (isDevSource(rule, file.replace(/\.d\.ts$/, '.ts'))) {
          report(
            'boundary.artifact.devSource',
            `${pkg.name} ships the development-only source ${rel(file)}.`,
            { fix: 'Exclude development-only sources from the package tsconfig.' },
          );
        }
      }
    }
    const nodeEntries = rule.nodeEntries ?? [];
    for (const key of exportKeys(pkg.manifest)) {
      if (key === './package.json' || key.includes('*') || nodeEntries.includes(key)) continue;
      const typesOnly = (rule.typeOnly?.entries ?? []).includes(key);
      if (typesOnly && exportTarget(pkg.manifest, key, 'default')) {
        report(
          'boundary.typeOnly.runtime',
          `${pkg.name} export "${key}" is declared types-only but has a JavaScript target.`,
          { fix: 'Give framework typings only a "types" condition.' },
        );
      }
      for (const condition of ['default', 'types']) {
        const target = exportTarget(pkg.manifest, key, condition);
        if (!target) continue;
        const file = join(pkg.dir, target);
        if (!(await exists(file))) {
          report(
            'boundary.artifact.missing',
            `${pkg.name} export "${key}" (${condition}) points to missing ${rel(file)}.`,
            {
              fix: 'Run npm run build before checking artifacts.',
            },
          );
          continue;
        }
        // Data and document exports (for example CONTRACTS.md, contracts.json) have no imports.
        if (!/\.(?:m?js|d\.m?ts)$/.test(file)) continue;
        await walkArtifact(
          file,
          [`${pkg.name}${key === '.' ? '' : key.slice(1)}`],
          new Set(),
          byName,
          config,
          report,
          rel,
          typesOnly ? rule.typeOnly.allow : [],
        );
      }
    }
    if ((rule.domFree ?? []).length) await checkDomFree(pkg, rule, report, rel);
  }
  await checkDeclarations(packages, config, report, rel);
}

async function walkArtifact(file, chain, seen, byName, config, report, rel, typeImports = []) {
  if (seen.has(file)) return;
  seen.add(file);
  const code = await readFile(file, 'utf8');
  for (const spec of await lexImports(code, file)) {
    const path = [...chain, spec].join(' -> ');
    if (isRelative(spec)) {
      const target = resolve(dirname(file), spec);
      if (await exists(target))
        await walkArtifact(target, [...chain, spec], seen, byName, config, report, rel);
    } else if (isBuiltin(spec)) {
      report('boundary.artifact.nodeBuiltin', `Browser entry reaches Node built-in: ${path}.`, {
        file: rel(file),
      });
    } else if (spec.startsWith('@oddkin/')) {
      const target = packageNameOf(spec);
      const targetPkg = byName.get(target);
      const targetRule = config.packages[target];
      if (targetRule?.kind === 'node') {
        // A Node package's browser types, from a declaration: checkArtifacts keeps them import-free.
        if (file.endsWith('.d.ts') && (targetRule.browserTypes ?? []).includes(subpathOf(spec)))
          continue;
        report('boundary.artifact.nodeOnly', `Browser entry reaches Node-only package: ${path}.`, {
          file: rel(file),
        });
        continue;
      }
      if (!targetPkg) continue;
      const subpath = subpathOf(spec);
      if ((targetRule?.nodeEntries ?? []).includes(subpath)) {
        report('boundary.artifact.nodeOnly', `Browser entry reaches a Node entry: ${path}.`, {
          file: rel(file),
        });
        continue;
      }
      const condition = file.endsWith('.d.ts') ? 'types' : 'default';
      const targetFile = exportTarget(targetPkg.manifest, subpath, condition);
      if (targetFile && (await exists(join(targetPkg.dir, targetFile)))) {
        await walkArtifact(
          join(targetPkg.dir, targetFile),
          [...chain, spec],
          seen,
          byName,
          config,
          report,
          rel,
        );
      }
    } else if (file.endsWith('.d.ts') && typeImports.includes(packageNameOf(spec))) {
      continue;
    } else {
      report('boundary.artifact.thirdParty', `Browser entry reaches third-party module: ${path}.`, {
        file: rel(file),
      });
    }
  }
}

/**
 * A Node package's browser types (`browserTypes`): a `types` target only, no JavaScript, and a
 * declaration file that imports and references nothing, so browser declarations that import it
 * reach no Node, compiler, or tooling types through it.
 */
async function checkBrowserTypes(pkg, rule, report, rel) {
  for (const key of rule.browserTypes ?? []) {
    const entry = `${pkg.name}${key.slice(1)}`;
    if (exportTarget(pkg.manifest, key, 'default')) {
      report(
        'boundary.browserTypes.runtime',
        `${entry} is browser types and may not have a JavaScript target.`,
        { fix: 'Give it only a "types" condition.' },
      );
    }
    const target = exportTarget(pkg.manifest, key, 'types');
    if (!target || !(await exists(join(pkg.dir, target)))) {
      report('boundary.artifact.missing', `${entry} (types) points to missing ${target}.`, {
        fix: 'Run npm run build before checking artifacts.',
      });
      continue;
    }
    const code = await readFile(join(pkg.dir, target), 'utf8');
    const imports = await lexImports(code, join(pkg.dir, target));
    if (imports.length || /^\s*\/\/\/\s*<reference\s/m.test(code) || /\bimport\s*\(/.test(code)) {
      report(
        'boundary.browserTypes.imports',
        `${entry} is browser types and must import nothing (found ${imports.join(', ') || 'a reference or import type'}).`,
        { file: rel(join(pkg.dir, target)), fix: 'Generate it from the schema alone.' },
      );
    }
  }
}

async function checkDomFree(pkg, rule, report, rel) {
  const keys = exportKeys(pkg.manifest);
  for (const key of rule.domFree ?? []) {
    if (!keys.includes(key)) continue;
    const target = exportTarget(pkg.manifest, key);
    if (!target || !(await exists(join(pkg.dir, target)))) continue;
    const url = pathToFileURL(join(pkg.dir, target)).href;
    const probe = [
      `await import(${JSON.stringify(url)});`,
      `const leaked = ['window','document','HTMLElement','customElements'].filter((name) => name in globalThis);`,
      `if (leaked.length) { console.error('DOM globals defined: ' + leaked.join(', ')); process.exit(2); }`,
    ].join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      const output = (result.stderr || result.stdout).trim().split('\n');
      const reason =
        output.find((line) => /Error|DOM globals/.test(line))?.trim() ??
        output.find((line) => line.trim())?.trim() ??
        'unknown error';
      report(
        'boundary.domFree.failed',
        `${pkg.name}${key === '.' ? '' : key.slice(1)} must import without DOM globals but failed: ${reason}`,
        {
          file: rel(join(pkg.dir, target)),
          fix: 'Move DOM-dependent code out of this entry or defer DOM access until a function is called.',
        },
      );
    }
  }
}

const requireHere = createRequire(import.meta.url);
/** TypeScript's default libraries (`lib.dom.d.ts`, …), wherever the installed compiler keeps them. */
const DEFAULT_LIB = /[\\/](?:@typescript[\\/][^\\/]+|typescript)[\\/]lib[\\/]lib\.[\w.]+\.d\.ts$/;

/**
 * Browser declarations stand alone (packages.md): every `types` target of a browser entry is read
 * in one program with the DOM library and no ambient types (`types: []`), as a browser project
 * without `@types/node` reads them. An error fails, and so does reaching Node's types, the
 * TypeScript compiler's own types, a Node-only package, a Node entry or Node source of a mixed
 * package, or a third-party package. Framework typings (types-only entries) are left to
 * `verify:packs`, which type-checks them with their framework.
 */
async function checkDeclarations(packages, config, report, rel) {
  const roots = [];
  const nodeAreas = [];
  const browserTypes = new Set();
  for (const pkg of packages) {
    const rule = config.packages[pkg.name];
    if (!rule) continue;
    for (const key of rule.browserTypes ?? []) {
      const target = exportTarget(pkg.manifest, key, 'types');
      if (target) browserTypes.add(join(pkg.dir, target));
    }
    if (rule.kind === 'node') {
      nodeAreas.push({ dir: pkg.dir + sep, why: `${pkg.name}, a Node-only package` });
      continue;
    }
    for (const source of rule.nodeSources ?? [])
      nodeAreas.push({
        dir: join(pkg.dir, source.replace(/^src\//, 'dist/')) + sep,
        why: `the Node sources of ${pkg.name}`,
      });
    if (!pkg.manifest.exports) continue;
    for (const key of exportKeys(pkg.manifest)) {
      if (key === './package.json' || key.includes('*')) continue;
      if ((rule.typeOnly?.entries ?? []).includes(key)) continue;
      const target = exportTarget(pkg.manifest, key, 'types');
      if (!target || !/\.d\.[cm]?ts$/.test(target)) continue;
      const file = join(pkg.dir, target);
      if ((rule.nodeEntries ?? []).includes(key)) {
        nodeAreas.push({ file, why: `${pkg.name}${key.slice(1)}, a Node entry` });
        continue;
      }
      if (await exists(file)) roots.push(file);
    }
  }
  if (!roots.length) return;
  const dir = await mkdtemp(join(tmpdir(), 'oddkin-declarations-'));
  let result;
  try {
    await writeFile(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2024',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2024', 'DOM', 'DOM.Iterable'],
          types: [],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        files: roots,
      }),
    );
    const tsc = join(dirname(requireHere.resolve('typescript/package.json')), 'bin', 'tsc');
    result = spawnSync(
      process.execPath,
      [tsc, '-p', join(dir, 'tsconfig.json'), '--explainFiles', '--pretty', 'false'],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  // `--explainFiles` prints each file the program reads, then the reasons it was read, indented.
  const files = new Map();
  let current;
  for (const line of `${result.stdout}`.split(/\r?\n/)) {
    const error = /^(?:(.+)\((\d+),(\d+)\): )?error (TS\d+): (.*)$/.exec(line);
    if (error) {
      const [, file, row, column, code, message] = error;
      report(
        'boundary.declarations.error',
        `Browser declarations do not type-check without Node types: ${code} ${message}`,
        {
          ...(file ? { file: `${rel(resolve(file))}:${row}:${column}` } : {}),
          fix: 'Declare only what a browser project can read: no Node, compiler, or tooling types.',
        },
      );
    } else if (/^\s/.test(line) && current) {
      const from = /from file '([^']+)'/.exec(line);
      if (from) current.from.push(resolve(from[1]));
    } else if (line.trim()) {
      current = { from: [] };
      files.set(resolve(line.trim()), current);
    }
  }
  if (result.status !== 0 && !files.size)
    report('boundary.declarations.error', `tsc failed: ${`${result.stderr}`.trim().slice(0, 500)}`);
  const forbidden = (file) => {
    if (DEFAULT_LIB.test(file) || browserTypes.has(file)) return undefined;
    const area = nodeAreas.find((a) => (a.file ? a.file === file : file.startsWith(a.dir)));
    if (area) return { code: 'boundary.declarations.nodeOnly', why: area.why };
    const modules = file.lastIndexOf(`${sep}node_modules${sep}`);
    if (modules < 0) return undefined;
    const name = packageNameOf(
      file
        .slice(modules + 14)
        .split(sep)
        .join('/'),
    );
    if (name === '@types/node' || name === 'undici-types')
      return { code: 'boundary.declarations.node', why: "Node's types" };
    if (name === 'typescript' || name.startsWith('@typescript/'))
      return { code: 'boundary.declarations.compiler', why: "the TypeScript compiler's types" };
    return { code: 'boundary.declarations.thirdParty', why: `the third-party package ${name}` };
  };
  // Report where each forbidden area is entered, not every file inside it.
  for (const [file, { from }] of files) {
    const leak = forbidden(file);
    if (!leak) continue;
    const entry = from.find((importer) => files.has(importer) && !forbidden(importer));
    if (!entry) continue;
    report(leak.code, `Browser declarations reach ${leak.why}: ${rel(entry)} -> ${rel(file)}.`, {
      file: rel(entry),
      fix: 'Keep Node and tooling types out of browser entries; publish browser-safe types instead.',
    });
  }
}

// Registration entries: `*.define.ts` by name; a `define.ts` or a module under `define/` when it
// registers at module scope (a top-level define()/customElements.define() call or bare imports).
// The latter check keeps the implementation of `define()` itself from matching.
const DEFINE_ENTRY = /(?:^|[\\/])[^\\/]+\.define\.[cm]?[jt]sx?$/;
const DEFINE_CANDIDATE = /(?:^|[\\/])define\.[cm]?[jt]sx?$|[\\/]define[\\/]/;
const REGISTERS = /^(?:\s*(?:customElements\.)?define\(|import\s+['"])/m;
async function isRegistrationModule(path) {
  if (DEFINE_ENTRY.test(path)) return true;
  return DEFINE_CANDIDATE.test(path) && REGISTERS.test(await readFile(path, 'utf8'));
}
// Package registration subpaths, e.g. `@oddkin/components/define/button`.
const REGISTRATION_SPECIFIER = /^(?:@[^/]+\/)?[^/.@][^/]*\/define(?:\/|$)/;

async function resolveSource(spec, from) {
  const target = resolve(dirname(from), spec);
  const stem = target.replace(/\.[cm]?[jt]sx?$/, '');
  const candidates = [
    target,
    ...SOURCE_EXTENSIONS.map((ext) => stem + ext),
    ...SOURCE_EXTENSIONS.map((ext) => join(target, `index${ext}`)),
  ];
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  return undefined;
}

/**
 * Ordinary barrels (`index.*`) must not reach a registration entry through any chain of
 * relative imports, nor import a package's `define` subpath: importing a class or definition
 * never registers an element (ADR 0036, IMPLEMENTATION_PLAN.md §3.3).
 */
async function checkBarrels(sourceDirs, report, rel) {
  for (const dir of sourceDirs) {
    const files = await listFiles(dir, SOURCE_EXTENSIONS);
    for (const barrel of files.filter((file) => /(?:^|[\\/])index\.[cm]?[jt]sx?$/.test(file))) {
      const seen = new Set([barrel]);
      const queue = [barrel];
      while (queue.length) {
        const file = /** @type {string} */ (queue.shift());
        const specifiers = await lexImports(await readFile(file, 'utf8'), file);
        for (const spec of specifiers) {
          if (!isRelative(spec)) {
            if (REGISTRATION_SPECIFIER.test(spec))
              report(
                'boundary.registration.barrel',
                `${rel(barrel)} imports the registration entry "${spec}"; importing a barrel must not register elements.`,
                {
                  file: rel(file),
                  fix: 'Import registration entries only from application entry points or other registration entries.',
                },
              );
            continue;
          }
          const target = await resolveSource(spec, file);
          if (!target || seen.has(target)) continue;
          seen.add(target);
          if (await isRegistrationModule(target)) {
            report(
              'boundary.registration.barrel',
              `${rel(barrel)} reaches the registration entry ${rel(target)}; importing a barrel must not register elements.`,
              {
                file: rel(file),
                fix: 'Import registration entries only from application entry points or other registration entries.',
              },
            );
            continue;
          }
          queue.push(target);
        }
      }
    }
  }
}

/**
 * Bundlers drop modules of packages marked `"sideEffects": false` when nothing is imported from
 * them, which would silently skip registration. Packages with registration entries must declare
 * them as side-effectful (a `sideEffects` list that matches each built entry).
 */
async function checkSideEffects(pkg, report, rel) {
  const entries = [];
  for (const file of await listFiles(join(pkg.dir, 'src'), SOURCE_EXTENSIONS))
    if (await isRegistrationModule(file)) entries.push(file);
  if (!entries.length) return;
  const declared = pkg.manifest.sideEffects;
  // src/a/b.define.ts → dist/a/b.define.js (the built module the bundler sees).
  const built = (file) =>
    'dist/' +
    rel(file)
      .slice(rel(join(pkg.dir, 'src')).length + 1)
      .replace(/\.[cm]?tsx?$/, '.js');
  // Minimal glob support for "sideEffects": `**/` (any directories) and `*` (within a segment).
  const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const globToRegExp = (glob) =>
    new RegExp(
      '^' +
        glob
          .replace(/^\.\//, '')
          .split('**/')
          .map((part) => part.split('*').map(escape).join('[^/]*'))
          .join('(?:.*/)?') +
        '$',
    );
  const patterns = Array.isArray(declared) ? declared.map(globToRegExp) : [];
  for (const file of entries) {
    const target = built(file);
    const covered =
      declared === true || declared === undefined || patterns.some((re) => re.test(target));
    if (!covered)
      report(
        'boundary.registration.sideEffects',
        `${pkg.name} marks ${target} as side-effect free, but it registers elements.`,
        {
          file: rel(join(pkg.dir, 'package.json')),
          fix: 'List registration entries in "sideEffects", e.g. ["./dist/**/*.define.js", "./dist/define.js"].',
        },
      );
  }
}

function format(diagnostic) {
  const lines = [`✖ [${diagnostic.code}] ${diagnostic.message}`];
  if (diagnostic.file) lines.push(`    at ${diagnostic.file}`);
  if (diagnostic.fix) lines.push(`    fix: ${diagnostic.fix}`);
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const artifacts = process.argv.includes('--artifacts');
  const { diagnostics, packages, stats } = await checkBoundaries(root, { artifacts });
  if (stats.sourceFiles > 0 && stats.importsScanned === 0) {
    diagnostics.push({
      code: 'boundary.scanner.empty',
      message: `Scanned ${stats.sourceFiles} source file(s) but found no imports; the import scanner is likely broken.`,
      fix: 'Check the es-module-lexer integration in scripts/architecture/check-boundaries.mjs.',
    });
  }
  if (diagnostics.length) {
    console.error(diagnostics.map(format).join('\n'));
    console.error(
      `\n${diagnostics.length} boundary violation(s) in ${packages.length} package(s).`,
    );
    process.exit(1);
  }
  console.log(
    `Boundaries OK: ${packages.length} package(s), ${stats.sourceFiles} source file(s), ${stats.importsScanned} import(s)${artifacts ? '; manifests, sources, and built artifacts checked' : '; manifests and sources checked (run with --artifacts after build to check dist)'}.`,
  );
}
