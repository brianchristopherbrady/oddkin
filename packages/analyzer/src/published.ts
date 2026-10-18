/**
 * Read another package's published metadata (`custom-elements.json` and `oddkin.metadata.json`)
 * from installed or workspace artifacts. Files are read, never executed. One reader per analysis
 * run, so watch mode sees rebuilt artifacts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

export interface CemDeclaration {
  readonly kind: string;
  readonly name: string;
  readonly customElement?: boolean;
  readonly tagName?: string;
  readonly superclass?: { name: string; package?: string; module?: string };
  readonly members?: readonly Record<string, unknown>[];
  readonly events?: readonly Record<string, unknown>[];
  readonly slots?: readonly { name: string; description?: string }[];
  readonly cssParts?: readonly { name: string; description?: string }[];
  readonly cssProperties?: readonly { name: string; description?: string }[];
  readonly cssStates?: readonly { name: string; description?: string }[];
}

export interface PublishedPackage {
  readonly name: string;
  readonly root: string;
  /** Published module path (`dist/button/button.js`) of a declaration file in this package. */
  readonly moduleOf: (declarationFile: string) => string;
  /** CEM class declaration by name, preferring the given module. */
  readonly declaration: (name: string, module?: string) => CemDeclaration | undefined;
  /** `oddkin.metadata.json`, when published. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Whether the package publishes a `custom-elements.json`. */
  readonly hasManifest: boolean;
}

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

export function createPublishedReader(): (file: string) => PublishedPackage | undefined {
  const byRoot = new Map<string, PublishedPackage | null>();
  return (file) => {
    for (let dir = dirname(file); ; dir = dirname(dir)) {
      if (byRoot.has(dir)) return byRoot.get(dir) ?? undefined;
      const manifest = join(dir, 'package.json');
      const pkg = existsSync(manifest)
        ? (readJson(manifest) as Record<string, unknown> | undefined)
        : undefined;
      if (pkg && typeof pkg['name'] === 'string') {
        const published = load(dir, pkg);
        byRoot.set(dir, published);
        return published;
      }
      if (dirname(dir) === dir) return undefined;
    }
  };
}

function load(root: string, pkg: Record<string, unknown>): PublishedPackage {
  const cemPath = typeof pkg['customElements'] === 'string' ? pkg['customElements'] : undefined;
  const cem = cemPath
    ? (readJson(join(root, cemPath)) as
        { modules?: { path: string; declarations?: CemDeclaration[] }[] } | undefined)
    : undefined;
  const exportsField = pkg['exports'] as Record<string, unknown> | undefined;
  const metadataPath =
    typeof exportsField?.['./oddkin.metadata.json'] === 'string'
      ? (exportsField['./oddkin.metadata.json'] as string)
      : 'oddkin.metadata.json';
  const metadata = readJson(join(root, metadataPath)) as Record<string, unknown> | undefined;
  const classes = (cem?.modules ?? []).flatMap((module) =>
    (module.declarations ?? [])
      .filter((d) => d.kind === 'class')
      .map((declaration) => ({ module: module.path, declaration })),
  );
  return {
    name: pkg['name'] as string,
    root,
    hasManifest: !!cem,
    ...(metadata ? { metadata } : {}),
    moduleOf: (declarationFile) =>
      relative(root, declarationFile)
        .split(sep)
        .join('/')
        .replace(/\.d\.([cm]?)ts$/, '.$1js'),
    declaration: (name, module) =>
      (
        classes.find((c) => c.declaration.name === name && c.module === module) ??
        classes.find((c) => c.declaration.name === name)
      )?.declaration,
  };
}
