// Shared bundle-size measurement for the benchmark runner and the size-budget check.
// Production build (default export conditions), esbuild bundle + minify, ESM, es2024.
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export const ENTRIES = [
  'counter',
  'component',
  'list',
  'composite',
  'position',
  'typeahead',
  'active-descendant',
  'resize',
  'reactive',
  'ai-headless',
  'ai-response',
  'ai-chat',
  'side-nav',
  'composition',
  'autoload',
  'store',
  'context',
  'persist',
  'app',
  'resource',
  'command',
  'router',
  'lifecycle',
  'workbench-panel-component',
  'workbench-panel-foundation',
  'workbench-panel-catalog',
  'workbench-shell',
  'workbench-frame',
];

/** Budgets in gzip bytes (ADR 0019). Measured 2026-10-17 in the comments. */
export const BUDGETS = {
  counter: 9728, // 9.5 KiB; measured 9,280
  component: 11264, // 11 KiB; measured 10,553
  list: 11776, // 11.5 KiB; measured 11,064
  // 12 KiB; measured 11,876 on 2026-10-21 (keyed rows rendering their definition's field and button
  // through @oddkin/core/template/roles, ADR 0043; 370 B more than the same rows with literal tags).
  composite: 12288,
  // 3.75 KiB; measured 3,549 on 2026-10-22 (@oddkin/core/controllers/position with a Scope: the
  // measured-rectangle backend of ADR 0044; Scope with the reactive graph and diagnostics alone
  // is 2,303, so the controller adds about 1.25 KiB).
  position: 3840,
  // 3.25 KiB each; measured 2026-10-22 with a Scope (2,303 alone): typeahead 3,017,
  // active-descendant 3,179, resize 3,164 (@oddkin/core/controllers/*, component-contracts.md §5
  // step 1; each adds 0.7 to 0.9 KiB).
  typeahead: 3328,
  'active-descendant': 3328,
  resize: 3328,
  reactive: 2048, // 2 KiB; measured 1,892
  'ai-headless': 14336, // 14 KiB; measured 13,391 on 2026-10-18 (controller + contracts + core model validation)
  'ai-response': 21504, // 21 KiB; measured 20,607 (one registered odd-response with Markdown and citations)
  // 49.5 KiB; measured 50,340 on 2026-10-23 with odd-button's toggle and the description hook
  // tooltips use (48,782 on 2026-10-18: odd-conversation + odd-prompt-input, all nested elements;
  // +625 B since the shared core focus, announce, and observe controllers replaced AI-internal
  // helpers and recover focus after removal too).
  'ai-chat': 50688,
  // 16 KiB; measured 15,715 on 2026-10-18 (registered odd-side-nav with keyed repeat, project
  // item kinds, and the shared core FocusRecovery controller (+374 B); the recipe CSS is
  // extracted at build time, so the recipe engine (3.4 KiB) is not loaded). Was 15 KiB.
  'side-nav': 16384,
  // 8.5 KiB; measured 8,053 on 2026-10-26 (@oddkin/components/composition, ADR 0046 D3:
  // validateComposition and renderComposition with the generated catalog of 52 elements, about
  // 45 B gzip each, over @oddkin/core/model and the navigation model; no element registrations).
  composition: 8704,
  // 1,088 B; measured 1,046 on 2026-10-26 (@oddkin/components/autoload, ADR 0046 D9: the document
  // and shadow-root observers, the 53 define/* names, and core's diagnostics; each definition is
  // imported by URL at run time, outside this graph).
  autoload: 1088,
  // 2.5 KiB; measured 2,214 on 2026-10-19 (@oddkin/state/store: createStore, select, action, and
  // frozen snapshots over the reactive graph and diagnostics; no DOM module).
  store: 2560,
  // 4 KiB; measured 3,699 on 2026-10-19 (@oddkin/state/context: a provider and a consumer with
  // the community context protocol events, over the reactive graph, Scope, and diagnostics).
  context: 4096,
  // 3.25 KiB; measured 3,028 on 2026-10-19 (@oddkin/state/persist with the store it follows:
  // versioned envelope, migrations, validation, and storage-failure handling).
  persist: 3328,
  // 5.25 KiB; measured 4,975 on 2026-10-20 (@oddkin/app/app: an application root with a store
  // provided as context, over Scope, the reactive graph, and diagnostics; +208 B since 4,767 on
  // 2026-10-19 for suspend()/resume() of page suspension). Was 5 KiB.
  app: 5376,
  // 3.75 KiB; measured 3,527 on 2026-10-20 (@oddkin/app/resource: a search resource with a
  // timeout, generations, and stale-result guards over Scope, the reactive graph, and diagnostics;
  // +111 B since 3,416 for the restore policy).
  resource: 3840,
  // 4 KiB; measured 3,723 on 2026-10-19 (@oddkin/app/command: a mutation with a retry policy and a
  // timeout, per-attempt scopes, and concurrency handling over Scope, the reactive graph, and
  // diagnostics).
  command: 4096,
  // 7.5 KiB; measured 6,974 on 2026-10-19 (@oddkin/app/router: nested, lazy, and redirecting
  // routes with typed params, History API and link interception, per-level scopes, titles, focus,
  // route announcements through core's LiveAnnouncer (about 0.7 KiB, imported even with
  // `announce: false`), and scroll restoration, over Scope, the reactive graph, and diagnostics).
  // Was 6 KiB (5,461 measured) before focus, announcements, and scroll restoration.
  router: 7680,
  // 5 KiB; measured 4,676 on 2026-10-20 (@oddkin/app/lifecycle with @oddkin/app/app: an
  // application that follows the page lifecycle with one suspendable service, over Scope, the
  // reactive graph, diagnostics, and the context provider the application module imports).
  lifecycle: 5120,
  // Workbench entries, measured 2026-10-22 (Agent 3). Public panels, each registering one element
  // with its renderer and the preview host: component 27,112 (28 KiB), foundation 15,199
  // (16 KiB), catalog 16,654 (17 KiB).
  'workbench-panel-component': 28672,
  'workbench-panel-foundation': 16384,
  'workbench-panel-catalog': 17408,
  // 49 KiB; measured 48,775: the shell with router, search, and every page renderer. This harness
  // does not split, so it includes Theme Studio (about 3.2 KiB), which the shell imports only on
  // its route; with splitting, the initial load is 45,876 and Theme Studio a 4,150 B chunk.
  'workbench-shell': 50176,
  // 7.5 KiB; measured 7,055: the preview frame runtime (protocol, Scope, mount, specimen, theme).
  'workbench-frame': 7680,
};

/**
 * CSS budgets in gzip bytes (css-architecture.md §12). Measured 2026-10-17 in the comments:
 * the generated default theme and each component's combined structural and default styles.
 */
export const CSS_BUDGETS = {
  // Measured 3,059 on 2026-10-22 (2,770 before the info ramp and the tone, selection, and scrim
  // roles; 2,764 at ADRs 0041-0042, 1,827 before the approved palette and foundation scales).
  'tokens:default.css': 3072,
  'components:badge': 384, // measured 375 on 2026-10-22: structural and default styles
  // Display elements, measured on 2026-10-22 (structural and default styles).
  'components:alert': 576, // 540 on 2026-10-26 (500 before its layout recipe, layout-recipes.md §14)
  'components:avatar': 512, // 430
  'components:chip': 768, // 652
  // Disclosure and navigation elements, measured on 2026-10-22 (structural and default styles).
  'components:disclosure': 768, // 704
  'components:tabs': 768, // 731
  'components:tab-panel': 128, // 96: structural only; odd-tabs draws the panel
  'components:toolbar': 512, // 473
  'components:pagination': 768, // 702
  'components:breadcrumbs': 640, // 561
  'components:popover': 256, // 226: the surface, motion, and close button are the shared overlay module
  // 704: measured 638 on 2026-10-23: the header, body, and footer column, title, divider, and sizes;
  // the sheet look, motion, and close button are the shared overlay module.
  'components:dialog': 704,
  'components:tooltip': 256, // 203: the surface and motion are the shared overlay module
  'components:drawer': 512, // 429: the side sheet and header divider; the rest is odd-dialog's
  // 704: measured 618 on 2026-10-23: the stack, the shared pause, the timer, and the grid; the surface,
  // motion, and close button are the shared overlay module.
  'components:toast': 704,
  // 512: measured 451 on 2026-10-23: the danger surface and border, heading row, and link list; the
  // tone colours and glyph are the shared tone module.
  'components:validation-summary': 512,
  // 1,024: measured 958 on 2026-10-25: the drop zone, the selector button's look (a pseudo-element
  // cannot reuse odd-button's sheet), the file rows, and the remove buttons.
  'components:file-input': 1024,
  // 960: measured 939 on 2026-10-25: the surface, the month row, the date table and its cell
  // states, the divider; the buttons are the shared native-button sheet's.
  'components:calendar': 960,
  // 384: measured 337 on 2026-10-25: the calendar button's target and hover, and the popup
  // holding the calendar without its own surface; the field is the shared control look.
  'components:date-picker': 384,
  // 1,728: measured 1,689 on 2026-10-26 with its layout recipe (+45: the popup's columns and rows,
  // layout-recipes.md §14); 1,644 before: the field swatch and button, the joined popup, the area
  // and hue (with the shared range sheets the hue is drawn on), the entries, the suggested-colour
  // radios, and the actions (the buttons are the shared native-button sheet's).
  'components:color-picker': 1728,
  // Layout, measured on 2026-10-23 (structural and default styles).
  'components:split-panel': 896, // 818
  'components:scroll-region': 288, // 266 on 2026-10-26 (235 before): the content column is a layout recipe (layout-recipes.md §14)
  'components:container': 192, // 161
  'components:copy-button': 448, // 386: the row, the status words, the fallback field; the button look is odd-button's module
  'components:relative-time': 256, // 252: the glyph row, the detail line, and the small type role
  'components:stat': 576, // 529 on 2026-10-26 with its layout recipe (484 before): the card surface, three type roles, the arrow; the placeholder is odd-skeleton
  'components:status-marker': 576, // 521: the circle, its status colours, the dot; glyphs and the ring are shared modules
  // Collections, measured on 2026-10-23 (structural and default styles; rows are the shared modules).
  'components:tree': 512, // 428
  'components:listbox': 704, // 663 on 2026-10-26 (602 before): the state row is a layout recipe (layout-recipes.md §14); the rows, field, and spinner are shared modules
  'components:select': 512, // 448: the field, the option rows, and the picker surface are shared modules
  // 1,536: measured 1,483 on 2026-10-26 (932 before): the field box (its states, the search glyph
  // and chevron padding), the chips' "+N" collapse, and the popup width, plus the value views (the
  // count, the sentence, the overlapping avatars, the group tags, two rows), the review below the
  // field, and the popup's selection panel and Select all; the field, rows, listbox rows, surface,
  // chips, and clear button are shared sheets. odd-picker uses these sheets.
  'components:combobox': 1536,
  // 896: measured 883 on 2026-10-25: the trigger and its value, the popup joined to the field (as
  // wide, stacked over the footer, and the focus ring around both), the tree content's padding and
  // type, the active row's ring, and the footer; the field, chips, rows, surface, and footer
  // buttons are odd-combobox's, the shared modules', and the native button sheet.
  'components:picker': 896,
  // 1,184: measured 1,096 on 2026-10-23: the palette's surface, search field, group headings in the
  // eyebrow role, Figma CommandItem rows (padding, surface, the active one in the selection
  // colours, the shortcut in the code role), and the hints; the rows' base, surface, and spinner are
  // shared modules.
  'components:command-palette': 1184,
  'components:menu': 512, // 431: the trigger, surface, and rows are shared modules
  'components:split-button': 128, // 110: two buttons in a row; the menu half is odd-menu
  'components:empty-state': 512, // 434
  'components:icon': 384, // 305
  'components:progress': 768, // 695
  'components:skeleton': 512, // 413
  'components:spinner': 384, // 319
  'components:button': 1280, // measured 1,238 on 2026-10-23 with the toggle's pressed state (1,028 before)
  'components:card': 768, // measured 678 with type.body and a type.title heading default (571 before)
  // 576: measured 511 on 2026-10-26 with the number field's stepper (Figma `number`: the sunken
  // segment inside the border, its two buttons, and the text's end padding); 290 on 2026-10-23
  // with the search field's clear button. Only odd-input draws them (55 before; the field look is
  // the shared control module).
  'components:input': 576,
  // 128: measured 56 on 2026-10-23; the row, box, and marks are the shared control-indicator module.
  'components:checkbox': 128,
  // 256: measured 187 on 2026-10-23: the choices' stack and spacing; the legend, help, and error are
  // the shared control module.
  'components:checkbox-group': 256,
  // 512: measured 402 on 2026-10-23: the round box and its dot, the option and group layout, and
  // the description inset; the row and box are the control-indicator module, the legend the control
  // module.
  // 640: measured 614 on 2026-10-26 (643 before its mutation probes removed three redundant rules):
  // the cells, the transparent input over them, the active cell's ring and caret, the complete,
  // invalid, pending, and disabled cells, and the status line.
  'components:one-time-code': 640,
  'components:radio-group': 512,
  // 704: measured 644 on 2026-10-25: the star targets drawn by their radios, the filled stars, the
  // value, and the forced-colours states, which only odd-rating draws.
  'components:rating': 704,
  // 896: measured 812 on 2026-10-23: the track, the segments drawn by their radios, the three sizes,
  // and the forced-colours states, which only odd-segmented-control draws.
  'components:segmented-control': 896,
  // 832: measured 806 on 2026-10-26 with its layout recipe (+83: the label and endpoint rows,
  // layout-recipes.md §14); 721 on 2026-10-24: the label row, track, fill, thumb, endpoints, and
  // forced-colours states, which only odd-slider draws (an ARIA slider; owner decision 2026-10-23).
  'components:slider': 832,
  // 640: measured 569 on 2026-10-23: the track and thumb, which only odd-switch draws.
  'components:switch': 640,
  // 320: measured 264 on 2026-10-23: the resize modes, the field-sizing gate, the block inset, and
  // the rows floor and maximum of an auto-sized field.
  'components:textarea': 320,
  // 1,152: measured 1,077 on 2026-10-22 once the entry rows moved to the shared navigation-row
  // module (1,234 before, with them).
  'components:side-nav': 1152,
  // 3,072: measured 3,052 on 2026-10-23 once the control-indicator modules stopped using
  // :indeterminate, which also matches unchecked radios (-17); 3,069 with the control's start and
  // end adornment slots (+51);
  // 3,018 with the dialog and backdrop fades (+34); 2,984 with
  // the overlay close control, popover motion, and
  // placement limits (+238); 2,746 with the overlay-surface look (+113); 2,633 with
  // the choice row (+59, moved out of odd-checkbox for
  // odd-switch); 2,574 with the control-indicator modules (+346: checkbox box and marks); 2,228 on
  // 2026-10-22 with the navigation-row (+294, moved from odd-side-nav) and
  // option-row (+330) modules; 1,604 before them with the field layout, control look, and select
  // chevron every form control shares (717 before: spinner, tone, glyphs, host, focus ring, visually
  // hidden).
  'components:shared': 3072,
  'components:document': 768, // measured 612 on 2026-10-18: reset.css + base.css + utilities.css
  // measured 660 on 2026-10-24 (411 on 2026-10-18): layout.css page-author classes, with
  // Figma's Oddkin/Layout variants, .odd-box, .odd-center, .odd-aspect-ratio, and the presets
  // .odd-split-end and .odd-auto-grid-fit
  'components:layout': 704,
  'components:button.css': 1024, // measured 999 on 2026-10-23: button.css, the native <button> path, with aria-pressed
  // 2,752: measured 2,735 on 2026-10-25 with stepper.css (+141); 2,594 with timeline.css; 2,290 with
  // description-list.css and typography's gated text-wrap; 2,081 on 2026-10-23 with the field recipe's
  // start and end adornments (b67b90c); 1,821 on 2026-10-22 for the eight CSS recipes.
  'components:recipes': 2752,
  'ai:styles': 4608, // 4.5 KiB; measured 4,388 on 2026-10-18: every @oddkin/ai element sheet together
};

/** Gzip sizes of the shipped CSS: generated token CSS and component style modules. */
export async function measureCssSizes(root = fileURLToPath(new URL('../../..', import.meta.url))) {
  const sizes = {};
  const gzip = (text) => gzipSync(Buffer.from(text), { level: 9 }).length;
  sizes['tokens:default.css'] = gzip(
    readFileSync(join(root, 'packages/tokens/dist/css/default.css'), 'utf8'),
  );
  // Every component with a budget below; its entry module's style exports.
  const components = Object.keys(CSS_BUDGETS)
    .map((key) => /^components:([a-z-]+)$/.exec(key)?.[1])
    .filter((name) => name && existsSync(join(root, `packages/components/dist/${name}/index.js`)));
  for (const name of components) {
    const module = await import(
      pathToFileURL(join(root, `packages/components/dist/${name}/index.js`)).href
    );
    // Each distinct text once: an exported recipe and its extracted styles are the same CSS.
    const text = [
      ...new Set(
        Object.values(module)
          .filter((value) => typeof value?.cssText === 'string')
          .map((value) => value.cssText),
      ),
    ].join('\n');
    sizes[`components:${name}`] = gzip(text);
  }
  const shared = await import(
    pathToFileURL(join(root, 'packages/components/dist/styles/index.js')).href
  );
  sizes['components:shared'] = gzip(
    Object.values(shared)
      .filter((value) => typeof value?.cssText === 'string')
      .map((value) => value.cssText)
      .join('\n'),
  );
  sizes['components:document'] = gzip(
    ['reset', 'base', 'utilities']
      .map((name) => readFileSync(join(root, `packages/components/dist/css/${name}.css`), 'utf8'))
      .join('\n'),
  );
  sizes['components:layout'] = gzip(
    readFileSync(join(root, 'packages/components/dist/css/layout.css'), 'utf8'),
  );
  sizes['components:button.css'] = gzip(
    readFileSync(join(root, 'packages/components/dist/css/button.css'), 'utf8'),
  );
  // The opt-in CSS recipes for native markup (component-contracts.md §4), together.
  sizes['components:recipes'] = gzip(
    [
      'typography',
      'link',
      'divider',
      'kbd',
      'list',
      'table',
      'field',
      'avatar-group',
      'description-list',
      'timeline',
      'stepper',
    ]
      .map((name) => readFileSync(join(root, `packages/components/dist/css/${name}.css`), 'utf8'))
      .join('\n'),
  );
  // All @oddkin/ai sheets, deduplicated (shared base styles count once).
  const aiDist = join(root, 'packages/ai/dist');
  const sheets = new Set();
  for (const dir of readdirSync(aiDist, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === 'prod') continue;
    for (const file of readdirSync(join(aiDist, dir.name)).filter((f) =>
      f.endsWith('.styles.js'),
    )) {
      const module = await import(pathToFileURL(join(aiDist, dir.name, file)).href);
      for (const value of Object.values(module))
        if (typeof value?.cssText === 'string') sheets.add(value.cssText);
    }
  }
  sizes['ai:styles'] = gzip([...sheets].join('\n'));
  return sizes;
}

export async function measureSizes(root = fileURLToPath(new URL('../../..', import.meta.url))) {
  const sizes = {};
  for (const entry of ENTRIES) {
    const result = await build({
      absWorkingDir: root,
      entryPoints: [`research/benchmarks/size/${entry}.ts`],
      bundle: true,
      minify: true,
      format: 'esm',
      target: 'es2024',
      platform: 'browser',
      write: false,
      legalComments: 'none',
      metafile: true,
      logLevel: 'silent',
    });
    const code = result.outputFiles[0].contents;
    const inputs = Object.values(result.metafile.outputs)[0].inputs;
    sizes[entry] = {
      minified: code.length,
      gzip: gzipSync(code, { level: 9 }).length,
      brotli: brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
      modules: Object.keys(inputs)
        .map((p) => p.replace(/\\/g, '/').replace(/^.*?packages\//, 'packages/'))
        .sort(),
    };
  }
  return sizes;
}
