/**
 * Contract references (`contract:core/<name>`) resolved offline against the installed package:
 * `@oddkin/core/contracts.json` maps each id to an anchor in the packaged `CONTRACTS.md`, both
 * generated from `docs/architecture/core-contracts.md`.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export interface ContractEntry {
  readonly title: string;
  readonly anchor: string;
  /** SHA-256 of the section text, for change detection. */
  readonly sha256: string;
}

export interface ContractIndex {
  readonly package: string;
  /** Version of the installed package the index was read from. */
  readonly version: string;
  /** Absolute path of the installed `CONTRACTS.md`. */
  readonly path: string;
  readonly contracts: Readonly<Record<string, ContractEntry>>;
}

export interface ResolvedContract extends ContractEntry {
  readonly id: string;
  readonly package: string;
  readonly version: string;
  readonly path: string;
  /** The section of `CONTRACTS.md`, from its anchor to the next one. */
  readonly text: string;
}

const ID = /^contract:([a-z][a-z0-9-]*)\/([a-z0-9-]+)$/;

/** The package that publishes `id` (`contract:core/scope` → `@oddkin/core`), if `id` is well formed. */
export const contractPackage = (id: string): string | undefined => {
  const owner = ID.exec(id)?.[1];
  return owner ? `@oddkin/${owner}` : undefined;
};

/** The contract index of `packageName` as installed for code in `from` (default: the working directory). */
export function contractIndex(
  packageName: string,
  from = process.cwd(),
): ContractIndex | undefined {
  const require = createRequire(join(from, 'package.json'));
  let indexPath: string;
  let manifestPath: string;
  try {
    indexPath = require.resolve(`${packageName}/contracts.json`);
    manifestPath = require.resolve(`${packageName}/package.json`);
  } catch {
    return undefined;
  }
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
    file: string;
    contracts: Record<string, ContractEntry>;
  };
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: string };
  return {
    package: packageName,
    version: manifest.version,
    path: join(dirname(indexPath), index.file),
    contracts: index.contracts,
  };
}

/** Resolve a contract id to its text in the installed package, or `undefined` when it does not exist. */
export function resolveContract(id: string, from = process.cwd()): ResolvedContract | undefined {
  const packageName = contractPackage(id);
  const index = packageName ? contractIndex(packageName, from) : undefined;
  const entry = index?.contracts[id];
  if (!index || !entry) return undefined;
  const markdown = readFileSync(index.path, 'utf8');
  const start = markdown.indexOf(`<a id="${entry.anchor}"></a>`);
  if (start < 0) return undefined;
  const next = markdown.indexOf('<a id="', start + 1);
  return {
    id,
    ...entry,
    package: index.package,
    version: index.version,
    path: index.path,
    text: markdown.slice(start, next < 0 ? undefined : next).trim(),
  };
}
