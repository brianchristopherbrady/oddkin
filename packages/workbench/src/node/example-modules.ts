/**
 * Example modules as preview frames load them (workbench.md §5.1): the `defineExamples` source
 * with its types stripped, the registration of every element its fixtures name, and the
 * template renderer the frame's `mount(content)` uses, so templates and renderer share one copy.
 */
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import type { OddkinMetadataLike } from '../pages/types.js';

/** Registration entries by tag, from the documented libraries' metadata. */
export function registrationsByTag(
  libraries: readonly { readonly metadata?: OddkinMetadataLike }[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const library of libraries)
    for (const entry of Object.values(library.metadata?.components ?? {})) {
      const registration = (entry as { registration?: unknown }).registration;
      if (typeof registration === 'string' && !out.has(entry.tag)) out.set(entry.tag, registration);
    }
  return out;
}

/** The browser module for one example set's source file. */
export async function exampleModule(
  file: string,
  registrations: ReadonlyMap<string, string>,
): Promise<string> {
  const source = await readFile(file, 'utf8');
  const code = /\.m?ts$/.test(file) ? stripTypeScriptTypes(source, { mode: 'strip' }) : source;
  const imports = [...registrations]
    .filter(([tag]) => new RegExp(`(?<![\\w-])${tag}(?![\\w-])`).test(code))
    .map(([, registration]) => `import ${JSON.stringify(registration)};\n`);
  return `${imports.join('')}${code}\nexport { render as oddkinFrameRender } from '@oddkin/core/template';\n`;
}
