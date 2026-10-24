import { createLayoutHelpers, type Declarations } from '@oddkin/core/layout';
import { css, unsafeCSS, type CSSResult } from '@oddkin/core/styles';
import { token, type TokenName } from '@oddkin/tokens/refs';
import { nativeButtonStyles } from '../button/button.native.styles.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';

/**
 * Opt-in document stylesheets, written to `dist/css/<name>.css` by
 * `scripts/build-component-css.mjs` inside their cascade layer after the canonical layer order
 * (ADR 0039). Nothing loads them implicitly; unlayered application CSS overrides all of them.
 */
export interface DocumentStylesheet {
  readonly layer: 'odd.reset' | 'odd.base' | 'odd.layout' | 'odd.components' | 'odd.utilities';
  readonly styles: CSSResult;
}

/** A focused reset that keeps inherited typography, direction, and user preferences. */
export const reset: DocumentStylesheet = {
  layer: 'odd.reset',
  styles: css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
    }
    img,
    picture,
    video,
    canvas,
    svg {
      max-inline-size: 100%;
      block-size: auto;
    }
    input,
    button,
    textarea,
    select {
      font: inherit;
    }
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p,
    li,
    dd,
    figcaption,
    blockquote {
      overflow-wrap: break-word;
    }
    @media (prefers-reduced-motion: reduce) {
      html {
        scroll-behavior: auto;
      }
    }
  `,
};

/** Page defaults from the theme: text, surface, links, code, and the keyboard focus ring. */
export const base: DocumentStylesheet = {
  layer: 'odd.base',
  styles: css`
    body {
      background-color: ${token('color.canvas')};
      color: ${token('color.text.primary')};
      font-family: ${token('type.body.family')};
      font-size: ${token('type.body.size')};
      font-weight: ${token('type.body.weight')};
      line-height: ${token('type.body.line-height')};
      letter-spacing: ${token('type.body.letter-spacing')};
    }
    a {
      color: ${token('color.link')};
    }
    code,
    kbd,
    pre,
    samp {
      font-family: ${token('font.family.mono')};
    }
    :focus-visible {
      outline: ${token('focus.width')} solid ${token('color.focus.ring')};
      outline-offset: ${token('focus.offset')};
    }
  `,
};

/** A class's override property, falling back to the theme's layout role. */
const knob = (name: string, fallback: string) => `var(--odd-${name}, ${fallback})`;
const rule = (selector: string, declarations: Declarations) =>
  `${selector} {\n${declarations.map(([property, value]) => `  ${property}: ${value};`).join('\n')}\n}`;

function layoutClasses(): CSSResult {
  const helpers = createLayoutHelpers();
  const gap = (name: string) => knob(`${name}-gap`, token('layout.gap'));
  const split = helpers.split({
    side: 'side',
    main: 'main',
    gap: gap('split'),
    sideWidth: knob('split-side-width', token('layout.sidebar-width')),
    mainMin: knob('split-main-min', token('layout.main-min')),
  });
  return unsafeCSS(
    [
      rule('.odd-stack', helpers.stack({ gap: gap('stack') }).declarations),
      // Figma's variants (Oddkin/Layout/*) are presets that set the token itself, so a property
      // an ancestor sets for its own class never overrides them.
      rule('.odd-stack-tight', [['gap', token('space.xs')]]),
      rule('.odd-stack-loose', [['gap', token('space.lg')]]),
      rule('.odd-row', helpers.row({ gap: gap('row') }).declarations),
      rule('.odd-row-between', [['justify-content', 'space-between']]),
      rule('.odd-cluster', helpers.row({ gap: gap('cluster'), wrap: true }).declarations),
      rule(
        '.odd-grid',
        helpers.css({
          display: 'grid',
          'grid-template-columns': `repeat(${knob('grid-columns', '2')}, minmax(0, 1fr))`,
          gap: gap('grid'),
        }).declarations,
      ),
      rule(
        '.odd-auto-grid',
        helpers.autoGrid({
          min: knob('auto-grid-min', token('layout.item-min')),
          gap: gap('auto-grid'),
        }).declarations,
      ),
      rule(
        '.odd-box',
        helpers.css({ padding: knob('box-inset', token('layout.inset')), 'min-inline-size': '0' })
          .declarations,
      ),
      rule('.odd-box-none', [['padding', token('space.none')]]),
      rule('.odd-box-roomy', [['padding', token('space.xl')]]),
      rule(
        '.odd-center',
        helpers.css({ display: 'grid', 'place-items': 'center', 'min-inline-size': '0' })
          .declarations,
      ),
      // The ratio holds whatever the content (its one track has no minimum); children share one cell, so a
      // caption can sit over the media, and media fill it.
      rule(
        '.odd-aspect-ratio',
        helpers.css({
          display: 'grid',
          'grid-template-columns': 'minmax(0, 1fr)',
          'grid-template-rows': 'minmax(0, 1fr)',
          'aspect-ratio': knob('aspect-ratio', '16 / 9'),
          'min-inline-size': '0',
        }).declarations,
      ),
      rule('.odd-aspect-ratio > *', [['grid-area', '1 / 1']]),
      rule('.odd-aspect-ratio > :is(img, video, iframe, canvas, svg)', [
        ['inline-size', '100%'],
        ['block-size', '100%'],
        ['object-fit', 'cover'],
      ]),
      // Two children in DOM order: the first is the side, the last takes the remaining space.
      rule('.odd-split', split.declarations),
      rule('.odd-split > :first-child', split.regions?.['side'] ?? []),
      rule('.odd-split > :last-child', split.regions?.['main'] ?? []),
    ].join('\n'),
  );
}

/**
 * Page-author layout classes generated from the same helpers as recipes, with an override
 * property per option (`--odd-stack-gap`, `--odd-split-side-width`, …) defaulting to the
 * theme's layout roles: `.odd-stack` (`-tight`, `-loose`), `.odd-row` (`-between`),
 * `.odd-cluster`, `.odd-grid`, `.odd-auto-grid`, `.odd-split`, `.odd-box` (`-none`,
 * `-roomy`), `.odd-center`, and `.odd-aspect-ratio`.
 */
export const layout: DocumentStylesheet = { layer: 'odd.layout', styles: layoutClasses() };

/**
 * `<button class="odd-button">`: native buttons that look like `odd-button`, for forms that need
 * native submit-button semantics. Indented one level, as the stylesheet writer expects of
 * templates nested in this module.
 */
export const button: DocumentStylesheet = {
  layer: 'odd.components',
  styles: unsafeCSS(nativeButtonStyles.cssText.replace(/\n(?=.)/g, '\n  ')),
};

const TYPE_ROLES = ['display', 'title', 'section', 'body', 'ui', 'small', 'eyebrow', 'code'];
// Roles Figma draws in the secondary text colour; headings balance their lines where supported.
const SECONDARY_ROLES = new Set(['small', 'eyebrow', 'code']);
const HEADING_ROLES = new Set(['display', 'title', 'section']);

/**
 * `.odd-type-<role>`: the eight type roles (`display`, `title`, `section`, `body`, `ui`, `small`,
 * `eyebrow`, `code`) on any element; native `h1`–`h6` and `p` keep their semantics.
 */
export const typography: DocumentStylesheet = {
  layer: 'odd.components',
  styles: unsafeCSS(
    TYPE_ROLES.map((role) =>
      rule(`.odd-type-${role}`, [
        ['font-family', token(`type.${role}.family` as TokenName)],
        ['font-size', token(`type.${role}.size` as TokenName)],
        ['font-weight', token(`type.${role}.weight` as TokenName)],
        ['line-height', token(`type.${role}.line-height` as TokenName)],
        ['letter-spacing', token(`type.${role}.letter-spacing` as TokenName)],
        ...(SECONDARY_ROLES.has(role)
          ? ([['color', token('color.text.secondary')]] as [string, string][])
          : []),
        ...(HEADING_ROLES.has(role)
          ? ([
              ['margin-block', '0'],
              ['text-wrap', 'balance'],
            ] as [string, string][])
          : []),
      ]),
    ).join('\n'),
  ),
};

/** `a.odd-link`: link colour, an underline on hover, and the shared keyboard focus ring. */
export const link: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    .odd-link {
      color: ${token('color.link')};
      font-family: ${token('type.ui.family')};
      font-size: ${token('type.ui.size')};
      font-weight: ${token('type.ui.weight')};
      line-height: ${token('type.ui.line-height')};
      text-decoration-line: none;
      text-underline-offset: 0.2em;
      border-radius: ${token('radius.sm')};
    }
    .odd-link:hover,
    .odd-link:focus-visible {
      text-decoration-line: underline;
    }
    .odd-link:focus-visible {
      outline: ${token('focus.width')} solid ${token('color.focus.ring')};
      outline-offset: ${token('focus.offset')};
    }
    p .odd-link,
    li .odd-link {
      font: inherit;
      text-decoration-line: underline;
    }
  `,
};

/** `hr.odd-divider`, or a labelled `.odd-divider` ("or") the author gives `role="separator"`. */
export const divider: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    hr.odd-divider {
      block-size: 0;
      margin-block: ${token('space.md')};
      border: 0;
      border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
    }
    .odd-divider:not(hr) {
      display: flex;
      align-items: center;
      gap: ${token('space.sm')};
      margin-block: ${token('space.md')};
      color: ${token('color.text.secondary')};
      font-family: ${token('type.small.family')};
      font-size: ${token('type.small.size')};
      font-weight: ${token('type.small.weight')};
      line-height: ${token('type.small.line-height')};
    }
    .odd-divider:not(hr)::before,
    .odd-divider:not(hr)::after {
      content: '';
      flex: 1;
      border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
    }
  `,
};

/** `kbd.odd-kbd`: a key cap that does not look clickable; sequences are adjacent keys. */
export const kbd: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    .odd-kbd {
      display: inline-block;
      min-inline-size: 1.75em;
      padding-inline: ${token('space.2xs')};
      border: ${token('border.width.default')} solid ${token('color.border.default')};
      border-radius: ${token('radius.sm')};
      background: ${token('color.surface.default')};
      color: ${token('color.text.secondary')};
      font-family: ${token('type.code.family')};
      font-size: ${token('type.code.size')};
      font-weight: ${token('type.code.weight')};
      line-height: ${token('type.code.line-height')};
      text-align: center;
      white-space: nowrap;
    }
    @media (forced-colors: active) {
      .odd-kbd {
        border-color: CanvasText;
      }
    }
  `,
};

/**
 * `ul.odd-list` / `ol.odd-list`: rows on a bordered surface, divided by rules; `.odd-list-meta`
 * for secondary text; the item with `aria-current` takes the selection colours.
 */
export const list: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    .odd-list {
      margin: 0;
      padding: 0;
      list-style: none;
      border: ${token('border.width.default')} solid ${token('color.border.default')};
      border-radius: ${token('card.radius')};
      background: ${token('color.surface.default')};
      overflow: hidden;
      color: ${token('color.text.primary')};
      font-family: ${token('type.ui.family')};
      font-size: ${token('type.ui.size')};
      font-weight: ${token('type.ui.weight')};
      line-height: ${token('type.ui.line-height')};
    }
    .odd-list > li {
      display: flex;
      align-items: center;
      gap: ${token('space.sm')};
      min-block-size: ${token('target.min')};
      padding: ${token('space.sm')} ${token('space.md')};
      overflow-wrap: anywhere;
    }
    .odd-list > li + li {
      border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
    }
    .odd-list-meta {
      color: ${token('color.text.secondary')};
    }
    .odd-list > li[aria-current]:not([aria-current='false']) {
      background: ${token('color.selection.background')};
      color: ${token('color.selection.foreground')};
    }
    .odd-list > li[aria-current]:not([aria-current='false']) .odd-list-meta {
      color: inherit;
    }
    @media (forced-colors: active) {
      .odd-list > li[aria-current]:not([aria-current='false']) {
        outline: ${token('border.width.strong')} solid Highlight;
        outline-offset: -2px;
      }
    }
  `,
};

/**
 * `table.odd-table`: a native table on a bordered surface; header cells on the sunken surface,
 * rows divided by rules, `aria-sort` headers in the primary colour, and a row holding a checked
 * checkbox in the selection colours.
 */
export const table: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    .odd-table {
      inline-size: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: ${token('border.width.default')} solid ${token('color.border.default')};
      border-radius: ${token('card.radius')};
      background: ${token('color.surface.default')};
      overflow: hidden;
      color: ${token('color.text.primary')};
      font-family: ${token('type.ui.family')};
      font-size: ${token('type.ui.size')};
      font-weight: ${token('type.ui.weight')};
      line-height: ${token('type.ui.line-height')};
    }
    .odd-table :is(th, td) {
      padding: ${token('space.sm')} ${token('space.md')};
      text-align: start;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    .odd-table thead th {
      background: ${token('color.surface.sunken')};
      color: ${token('color.text.secondary')};
      font-weight: ${token('font.weight.medium')};
    }
    .odd-table th[aria-sort]:not([aria-sort='none']) {
      color: ${token('color.text.primary')};
    }
    .odd-table tbody tr + tr > * {
      border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
    }
    .odd-table tbody tr:has(input[type='checkbox']:checked) {
      background: ${token('color.selection.background')};
      color: ${token('color.selection.foreground')};
    }
    .odd-table caption {
      padding-block: ${token('space.xs')};
      text-align: start;
    }
  `,
};

/**
 * `.odd-field`: the field anatomy for native and third-party controls (`.odd-field-label`,
 * `.odd-field-description`, `.odd-field-control`, `.odd-field-error`), generated from the rules
 * of Oddkin's form controls, with the same `--odd-field-*` variables. The author wires
 * `<label for>`, `aria-describedby`, and `aria-invalid`.
 */
export const field: DocumentStylesheet = {
  layer: 'odd.components',
  styles: unsafeCSS(
    [fieldStructuralStyles, controlStyles]
      .map((sheet) =>
        sheet.cssText.replace(/\.(field|label|description|error|control)\b/g, (_, name: string) =>
          name === 'field' ? '.odd-field' : `.odd-field-${name}`,
        ),
      )
      .join('')
      .replace(/\n(?=.)/g, '\n  '),
  ),
};

/**
 * `.odd-avatar-group`: overlapping `odd-avatar` children, each ringed in the page colour;
 * `.odd-avatar-group-more` on the last one for an overflow count ("+3").
 */
export const avatarGroup: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    .odd-avatar-group {
      display: inline-flex;
      align-items: center;
    }
    .odd-avatar-group > * + * {
      margin-inline-start: calc(-1 * ${token('space.xs')});
    }
    .odd-avatar-group > odd-avatar::part(base) {
      box-shadow: 0 0 0 ${token('border.width.strong')} ${token('color.canvas')};
    }
    .odd-avatar-group > .odd-avatar-group-more::part(base) {
      background: ${token('color.action.default')};
      color: ${token('color.text.on-action')};
    }
  `,
};

/** Page-level utilities with the same rules as the shadow-root primitives. */
export const utilities: DocumentStylesheet = {
  layer: 'odd.utilities',
  styles: css`
    .odd-visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
    .odd-focus-ring:focus-visible {
      outline: ${token('focus.width')} solid ${token('color.focus.ring')};
      outline-offset: ${token('focus.offset')};
    }
  `,
};

export const documentStylesheets = {
  reset,
  base,
  layout,
  button,
  typography,
  link,
  divider,
  kbd,
  list,
  table,
  field,
  'avatar-group': avatarGroup,
  utilities,
} as const;
