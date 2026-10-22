/**
 * The static module graph of a document's entry module, as `modulepreload` URLs: the browser
 * fetches every module at once instead of discovering them one import level at a time.
 * Dynamic `import()` targets are left out; documents load them only when they need them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ImportMap } from '../data/import-map.js';

const ORIGIN = 'http://workbench.invalid';
/** `import … from '…'`, `import '…'`, and `export … from '…'` at the start of a statement. */
const STATIC_IMPORT =
  /(?:^|[;}])\s*(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?(['"])([^'"\n]+)\1/gm;

/** Resolve `specifier` from the module at URL path `referrer`, as the browser does with `map`. */
export function resolveModule(
  map: ImportMap,
  specifier: string,
  referrer: string,
): string | undefined {
  if (/^\.{0,2}\//.test(specifier)) return new URL(specifier, `${ORIGIN}${referrer}`).pathname;
  if (/^[a-z][a-z0-9+.-]*:/i.test(specifier)) return undefined;
  const exact = map.imports[specifier];
  if (exact) return exact;
  const prefix = Object.keys(map.imports)
    .filter((key) => key.endsWith('/') && specifier.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? `${map.imports[prefix]}${specifier.slice(prefix.length)}` : undefined;
}

/**
 * Every module `entry` (a bare specifier) imports statically, transitively, entry first.
 * `packages` maps each served package root URL (`…/m/name@version/`) to its directory;
 * modules that are not on disk are left out (loading them reports the error).
 */
export function preloadGraph(
  map: ImportMap,
  entry: string,
  packages: ReadonlyMap<string, string>,
): string[] {
  const roots = [...packages.keys()].sort((a, b) => b.length - a.length);
  const read = (url: string) => {
    const root = roots.find((prefix) => url.startsWith(prefix));
    if (!root) return undefined;
    try {
      return readFileSync(join(packages.get(root) as string, url.slice(root.length)), 'utf8');
    } catch {
      return undefined;
    }
  };
  const first = map.imports[entry];
  const seen = new Set<string>();
  const queue = first ? [first] : [];
  for (let url = queue.shift(); url; url = queue.shift()) {
    if (seen.has(url)) continue;
    const text = read(url);
    if (text === undefined) continue;
    seen.add(url);
    for (const match of text.matchAll(STATIC_IMPORT)) {
      const target = resolveModule(map, match[2] as string, url);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return [...seen];
}
