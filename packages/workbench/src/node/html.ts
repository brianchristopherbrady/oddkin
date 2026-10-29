/** HTML documents the Workbench serves and writes: the shell page. */
import type { ImportMap } from '../data/import-map.js';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON for an inline script: `<` is escaped so no string inside can close the element. */
export const inlineJson = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c');

/** After the import map: a module fetch before it would stop the map from applying. */
const modulePreloads = (urls: readonly string[] = []) =>
  urls.map((href) => `    <link rel="modulepreload" href="${escapeHtml(href)}" />\n`).join('');

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
  /** URLs of the module's static graph, fetched in parallel (`modulepreload`). */
  readonly preload?: readonly string[];
}

export interface FrameDocument {
  readonly title: string;
  readonly importMap: ImportMap;
  readonly module: string;
  /** Stylesheet URLs loaded into every preview frame, in order. */
  readonly stylesheets?: readonly string[];
  /** Font URLs preloaded in every preview frame. */
  readonly fonts?: readonly string[];
  /** URLs of the frame runtime's static module graph, fetched in parallel (`modulepreload`). */
  readonly preload?: readonly string[];
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
${modulePreloads(doc.preload)}${links}    <script type="module">import ${inlineJson(doc.module)};</script>
  </head>
  <body>
    <oddkin-workbench index="${escapeHtml(doc.index)}"${events}></oddkin-workbench>
  </body>
</html>
`;
}

/** One frame document owns its module map, registry, document styles, and preview container. */
export function frameHtml(doc: FrameDocument): string {
  const fonts = (doc.fonts ?? [])
    .map(
      (href) =>
        `    <link rel="preload" as="font" href="${escapeHtml(href)}" crossorigin="anonymous" />\n`,
    )
    .join('');
  const links = (doc.stylesheets ?? [])
    .map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" />\n`)
    .join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.title)}</title>
${fonts}${links}    <style>html,body{margin:0;min-block-size:100%;}body{container:preview-frame / inline-size;background:var(--odd-color-canvas,Canvas);color:var(--odd-color-text-primary,CanvasText);}[data-oddkin-preview]{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;min-block-size:100vh;margin-inline:auto;background:var(--odd-color-surface-specimen,transparent);container:preview / inline-size;}[data-oddkin-preview]:has(>[data-oddkin-specimen]){display:block;background:none;}[data-oddkin-specimen]{display:grid;gap:var(--odd-space-md,1rem);padding:var(--odd-space-md,1rem);}[data-oddkin-specimen] figure{margin:0;}[data-oddkin-specimen] figcaption{margin-block-end:var(--odd-space-xs,0.25rem);font:var(--odd-font-size-sm,0.875rem) var(--odd-font-family-sans,system-ui);color:var(--odd-color-text-secondary,GrayText);}</style>
    <script type="importmap">${inlineJson(doc.importMap)}</script>
${modulePreloads(doc.preload)}    <script type="module">import ${inlineJson(doc.module)};</script>
  </head>
  <body>
    <main data-oddkin-preview></main>
  </body>
</html>
`;
}
