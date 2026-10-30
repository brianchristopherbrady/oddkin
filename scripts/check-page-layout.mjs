/**
 * Page layout check (IMPLEMENTATION_PLAN.md M10, "Layout primitives in use where appropriate";
 * layout-recipes.md Â§12â€“Â§13). Pages arrange stacks, rows, clusters, grids, splits, insets, and
 * centring with the `layout.css` classes (or, in Workbench's own sheets, the
 * `@oddkin/components/layout` helpers), not hand-written `display: flex` or `grid`. This lists
 * every hand-written page layout that remains, with the reason it stays, and fails on one that
 * has no recorded reason, or on a recorded exception that no longer exists.
 *   node scripts/check-page-layout.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Page sources: example and docs pages, and Workbench's light-DOM sheets and preview document. */
export const SOURCES = {
  directories: ['examples', 'apps/docs'],
  extensions: ['.css', '.html'],
  /** Build output and dependencies are not hand-written. */
  skip: ['node_modules', 'dist'],
  files: [
    'packages/workbench/src/app/styles.ts',
    'packages/workbench/src/panels/styles.ts',
    'packages/workbench/src/panels/catalog-styles.ts',
    'packages/workbench/src/panels/example-styles.ts',
    'packages/workbench/src/node/html.ts',
  ],
};

/** Reasons a page keeps its own layout CSS. */
const NO_ODDKIN_CSS =
  'loads no Oddkin CSS: a core, app, or state demonstration without tokens, which the layout classes need';

/**
 * Recorded exceptions: `file` and `selector` (`*` for every rule in the file), with the reason.
 * Selectors are the rule's selector text with whitespace collapsed.
 */
export const EXCEPTIONS = [
  {
    file: 'examples/tokens-css-only/styles.css',
    selector: '*',
    reason: 'shows the token stylesheet without any component CSS, by design',
  },
  {
    file: 'examples/side-nav/hand.css',
    selector: '*',
    reason: "the hand-written side of the side-nav example's computed-style comparison",
  },
  { file: 'examples/core-counter/styles.css', selector: '*', reason: NO_ODDKIN_CSS },
  { file: 'examples/binding-rule/styles.css', selector: '*', reason: NO_ODDKIN_CSS },
  { file: 'examples/lifecycle/index.html', selector: '*', reason: NO_ODDKIN_CSS },
  { file: 'examples/router/index.html', selector: '*', reason: NO_ODDKIN_CSS },
  { file: 'examples/router/hash.html', selector: '*', reason: NO_ODDKIN_CSS },
  {
    file: 'packages/workbench/src/app/styles.ts',
    selector: 'oddkin-workbench .wb-layout',
    reason:
      "Workbench's container-query shell: the sidebar column stacks at the wb-shell threshold together with its disclosure button",
  },
  {
    file: 'packages/workbench/src/app/styles.ts',
    selector: 'oddkin-workbench .wb-page',
    reason:
      'named grid areas: the table of contents moves beside the body at the wb-main threshold',
  },
  {
    file: 'packages/workbench/src/app/styles.ts',
    selector: 'oddkin-workbench .wb-sidebar-toggle',
    reason: 'shows the sidebar disclosure button below the wb-shell threshold; not an arrangement',
  },
  {
    file: 'packages/workbench/src/panels/styles.ts',
    selector: '*',
    reason:
      "the panels' content sheet, also adopted in their shadow roots (the docs embed them), where the document's layout.css does not reach; the helpers' runtime there would cost 5.4 KB gzip (measured 2026-10-26), so the arrangement stays structural CSS (shadow roots: the layout audit)",
  },
  {
    file: 'packages/workbench/src/panels/catalog-styles.ts',
    selector: '*',
    reason:
      "the catalog panel's arrangement in its shadow root (catalogLayoutStyles), for the same reason as the panels' content sheet; the shell arranges the same markup with layout classes",
  },
  {
    file: 'packages/workbench/src/panels/example-styles.ts',
    selector: '*',
    reason:
      "the component page's interactive example, split from the panels' content sheet so the other panels do not load it; adopted in the component panel's shadow root for the same reason",
  },
  {
    file: 'packages/workbench/src/node/html.ts',
    selector: '[data-oddkin-specimen]',
    reason:
      "preview frame harness: a frame loads only the previewed package's stylesheets, not layout.css",
  },
  {
    file: 'packages/workbench/src/node/html.ts',
    selector: '[data-oddkin-preview]',
    reason:
      "preview frame harness: the frame is the example's canvas and centres the component (Figma 33:6755), without layout.css",
  },
  {
    file: 'apps/docs/styles.css',
    selector: '.resource-card:not(:defined)',
    reason:
      "odd-card's own column until it registers (after the first paint), so a link in the card does not move as it upgrades; a layout class would stay on the host after the upgrade",
  },
  {
    file: 'apps/docs/styles.css',
    selector: '.side-nav[data-section]:not(:defined)',
    reason:
      "odd-side-nav's own column until it registers (after the first paint), so its links do not move as it upgrades; a layout class would stay on the host after the upgrade",
  },
];

const LAYOUT = /\bdisplay\s*:\s*(?:inline-)?(?:flex|grid)\b/g;

/** Every `display: flex|grid` in CSS text (a stylesheet, a `<style>` block, or a CSS template). */
export function findLayouts(text) {
  const found = [];
  for (const match of text.matchAll(LAYOUT)) {
    const open = text.lastIndexOf('{', match.index);
    const before = text.slice(0, open);
    const start = Math.max(
      before.lastIndexOf('}'),
      before.lastIndexOf('{'),
      before.lastIndexOf(';'),
      before.lastIndexOf('`'),
    );
    const selector = before
      .slice(start + 1)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<style>|`/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const line = text.slice(0, match.index).split('\n').length;
    found.push({ selector, line, declaration: match[0] });
  }
  return found;
}

function pageFiles(base) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(base, dir))) {
      if (SOURCES.skip.includes(name)) continue;
      const path = join(dir, name);
      if (statSync(join(base, path)).isDirectory()) walk(path);
      else if (SOURCES.extensions.some((ext) => name.endsWith(ext))) files.push(path);
    }
  };
  for (const dir of SOURCES.directories) walk(dir);
  return [...files, ...SOURCES.files].map((file) => file.split(sep).join('/')).sort();
}

const allowed = (exceptions, file, selector) =>
  exceptions.find((e) => e.file === file && (e.selector === '*' || e.selector === selector));

/**
 * Check pages under `base`. `read(file)` returns a file's text (tests pass fixtures).
 * Returns every finding with its exception (or none) and the exceptions that matched nothing.
 */
export function checkPages({
  base = root,
  files = pageFiles(base),
  read = (file) => readFileSync(join(base, file), 'utf8'),
  exceptions = EXCEPTIONS,
} = {}) {
  const findings = files.flatMap((file) =>
    findLayouts(read(file)).map((f) => ({
      file,
      ...f,
      exception: allowed(exceptions, file, f.selector),
    })),
  );
  const stale = exceptions.filter((e) => !findings.some((f) => f.exception === e));
  return {
    files: files.length,
    findings,
    unlisted: findings.filter((f) => !f.exception),
    stale,
  };
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === '') {
  const result = checkPages();
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    for (const f of result.findings)
      console.log(
        `${f.exception ? 'kept    ' : 'UNLISTED'}  ${f.file}:${f.line}  ${f.selector}${f.exception ? `  (${f.exception.reason})` : ''}`,
      );
    for (const e of result.stale)
      console.log(
        `STALE     ${e.file}  ${e.selector}: recorded exception matches nothing; remove it`,
      );
    console.log(
      `Page layout: ${result.files} files, ${result.findings.length} hand-written layout(s) kept with a reason, ${result.unlisted.length} unlisted, ${result.stale.length} stale exception(s).`,
    );
    if (result.unlisted.length)
      console.log(
        'Use the layout.css classes (layout-recipes.md Â§12â€“Â§13) or record the reason in scripts/check-page-layout.mjs.',
      );
  }
  process.exitCode = result.unlisted.length || result.stale.length ? 1 : 0;
}
