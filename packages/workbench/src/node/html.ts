/** HTML documents the Workbench serves and writes: the shell page. */
import type { ImportMap } from '../data/import-map.js';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON for an inline script: `<` is escaped so no string inside can close the element. */
export const inlineJson = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');

export interface ShellDocument {
  readonly title: string;
  readonly lang?: string;
  readonly importMap: ImportMap;
  /** Stylesheet URLs, in order. */
  readonly stylesheets: readonly string[];
  /** URL of the Workbench index. */
  readonly index: string;
  /** URL of the live-update event stream (dev only). */
  readonly events?: string;
  /** The shell's module (a bare specifier resolved by the import map). */
  readonly module: string;
}

export interface FrameDocument {
  readonly title: string;
  readonly importMap: ImportMap;
  readonly module: string;
}

/** The shell page: an import map, stylesheets, and `<oddkin-workbench>` pointed at the index. */
export function shellHtml(doc: ShellDocument): string {
  const links = doc.stylesheets
    .map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" />\n`)
    .join('');
  const events = doc.events ? ` events="${escapeHtml(doc.events)}"` : '';
  return `<!doctype html>
<html lang="${escapeHtml(doc.lang ?? 'en')}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.title)}</title>
    <script type="importmap">${inlineJson(doc.importMap)}</script>
${links}    <script type="module">import ${inlineJson(doc.module)};</script>
  </head>
  <body>
    <oddkin-workbench index="${escapeHtml(doc.index)}"${events}></oddkin-workbench>
  </body>
</html>
`;
}

/** One frame document owns its module map, registry, document styles, and preview container. */
export function frameHtml(doc: FrameDocument): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.title)}</title>
    <style>html,body{margin:0;min-block-size:100%;}body{container:preview-frame / inline-size;}[data-oddkin-preview]{display:block;min-block-size:100vh;container:preview / inline-size;}</style>
    <script type="importmap">${inlineJson(doc.importMap)}</script>
    <script type="module">import ${inlineJson(doc.module)};</script>
  </head>
  <body>
    <main data-oddkin-preview></main>
  </body>
</html>
`;
}
