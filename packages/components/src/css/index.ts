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
      // Few items stretch across the row instead of keeping empty tracks (card grids).
      rule(
        '.odd-auto-grid-fit',
        helpers
          .autoGrid({ min: knob('auto-grid-min', token('layout.item-min')), fill: 'auto-fit' })
          .declarations.filter(([property]) => property === 'grid-template-columns'),
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
      // The side after the main content: the same regions, the other way round.
      rule('.odd-split-end > :first-child', split.regions?.['main'] ?? []),
      rule('.odd-split-end > :last-child', [
        ...(split.regions?.['side'] ?? []),
        // Not the main minimum: the initial value, as for the side of odd-split.
        ['min-inline-size', 'initial'],
      ]),
    ].join('\n'),
  );
}

/**
 * Page-author layout classes generated from the same helpers as recipes, with an override
 * property per option (`--odd-stack-gap`, `--odd-split-side-width`, …) defaulting to the
 * theme's layout roles: `.odd-stack` (`-tight`, `-loose`), `.odd-row` (`-between`),
 * `.odd-cluster`, `.odd-grid`, `.odd-auto-grid` (`-fit`), `.odd-split` (`-end`), `.odd-box`
 * (`-none`, `-roomy`), `.odd-center`, and `.odd-aspect-ratio`.
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
        ...(HEADING_ROLES.has(role) ? ([['margin-block', '0']] as [string, string][]) : []),
      ]),
    )
      .concat(
        `@supports (text-wrap: balance) {\n${rule(
          [...HEADING_ROLES].map((role) => `.odd-type-${role}`).join(', '),
          [['text-wrap', 'balance']],
        )}\n}`,
      )
      .join('\n'),
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

/**
 * `dl.odd-description-list`: term and value pairs, each pair a `div` row (`<div><dt>…</dt>
 * <dd>…</dd></div>`) divided by rules, with one stable term column for every row (at most
 * `--odd-description-list-term-width`). The list is an inline-size container: below 36rem of its
 * own width each term stacks above its value. A missing value is author text ("Not provided").
 */
export const descriptionList: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    .odd-description-list {
      container: odd-description-list / inline-size;
      display: grid;
      grid-template-columns:
        fit-content(var(--odd-description-list-term-width, 33%))
        minmax(0, 1fr);
      gap: ${token('space.md')} ${token('space.xs')};
      margin: 0;
      color: ${token('color.text.primary')};
      font-family: ${token('type.body.family')};
      font-size: ${token('type.body.size')};
      font-weight: ${token('type.body.weight')};
      line-height: ${token('type.body.line-height')};
      letter-spacing: ${token('type.body.letter-spacing')};
    }
    .odd-description-list > div {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
    }
    .odd-description-list > div + div {
      padding-block-start: ${token('space.md')};
      border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
    }
    .odd-description-list dt {
      color: ${token('color.text.secondary')};
      font-family: ${token('type.ui.family')};
      font-size: ${token('type.ui.size')};
      font-weight: ${token('type.ui.weight')};
      line-height: ${token('type.ui.line-height')};
      letter-spacing: ${token('type.ui.letter-spacing')};
    }
    .odd-description-list dd {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    @container odd-description-list (max-inline-size: 36rem) {
      .odd-description-list > div {
        display: flex;
        flex-direction: column;
        gap: ${token('space.xs')};
      }
    }
  `,
};

/**
 * `ol.odd-timeline`: events newest first, each an `li` holding an `odd-status-marker` and its
 * content (`<li><odd-status-marker status="complete"></odd-status-marker><div>title, time,
 * detail</div></li>`). Markers sit on a rail joined by a connector; the title takes the UI role
 * (the danger colour when the event failed), the time and detail the small secondary role.
 */
export const timeline: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    .odd-timeline {
      --_marker: ${token('icon.size.lg')};
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .odd-timeline > li {
      position: relative;
      display: flex;
      gap: ${token('space.sm')};
    }
    .odd-timeline > li:not(:last-child) {
      padding-block-end: ${token('space.md')};
    }
    .odd-timeline > li:not(:last-child)::after {
      content: '';
      position: absolute;
      inset-block: calc(var(--_marker) + ${token('space.2xs')}) 0;
      inset-inline-start: calc((var(--_marker) - ${token('border.width.default')}) / 2);
      inline-size: ${token('border.width.default')};
      background: ${token('color.border.default')};
    }
    .odd-timeline odd-status-marker {
      --odd-status-marker-size: var(--_marker);
    }
    .odd-timeline odd-status-marker::part(base) {
      border-width: 0;
      background: ${token('color.surface.sunken')};
      color: ${token('color.text.secondary')};
    }
    .odd-timeline odd-status-marker:is([status='complete'], [status='pending'])::part(base) {
      background: ${token('color.selection.surface')};
      color: ${token('color.selection.foreground')};
    }
    .odd-timeline odd-status-marker[status='failed']::part(base) {
      background: ${token('color.danger.surface')};
      color: ${token('color.danger.foreground')};
    }
    .odd-timeline > li > :last-child {
      display: flex;
      flex-direction: column;
      gap: ${token('space.2xs')};
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .odd-timeline > li > :last-child > * {
      margin: 0;
      color: ${token('color.text.secondary')};
      font-family: ${token('type.small.family')};
      font-size: ${token('type.small.size')};
      font-weight: ${token('type.small.weight')};
      line-height: ${token('type.small.line-height')};
    }
    .odd-timeline > li > :last-child > :first-child {
      color: ${token('color.text.primary')};
      font-family: ${token('type.ui.family')};
      font-size: ${token('type.ui.size')};
      font-weight: ${token('type.ui.weight')};
      line-height: ${token('type.ui.line-height')};
    }
    .odd-timeline > li:has(> odd-status-marker[status='failed']) > :last-child > :first-child {
      color: ${token('color.danger.foreground')};
    }
    @media (forced-colors: active) {
      .odd-timeline > li:not(:last-child)::after {
        background: CanvasText;
      }
      .odd-timeline odd-status-marker::part(base) {
        border-width: ${token('border.width.default')};
      }
    }
  `,
};

/**
 * `ol.odd-stepper`: the steps of a task, each an `li` holding an `odd-status-marker` (a number,
 * or complete or failed) and its words (`<div><a href>Name</a><span>Complete</span></div>`). The
 * current step has `aria-current="step"` (on the `li` or its link) and the action colours; a
 * failed step's words take the danger colour. Step links keep the text colour and their underline.
 * Steps sit in a row and stack at 36rem of the list.
 */
export const stepper: DocumentStylesheet = {
  layer: 'odd.components',
  styles: css`
    .odd-stepper {
      container: odd-stepper / inline-size;
      display: flex;
      flex-wrap: wrap;
      gap: ${token('space.sm')};
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .odd-stepper > li {
      display: flex;
      flex: 1 1 0;
      align-items: center;
      gap: ${token('space.xs')};
      min-inline-size: 0;
    }
    .odd-stepper > li > :last-child {
      display: flex;
      flex-direction: column;
      gap: ${token('space.2xs')};
      min-inline-size: 0;
      overflow-wrap: anywhere;
      color: ${token('color.text.primary')};
      font-family: ${token('type.ui.family')};
      font-size: ${token('type.ui.size')};
      font-weight: ${token('type.ui.weight')};
      line-height: ${token('type.ui.line-height')};
    }
    .odd-stepper > li > :last-child > :not(:first-child) {
      color: ${token('color.text.secondary')};
      font-family: ${token('type.small.family')};
      font-size: ${token('type.small.size')};
      font-weight: ${token('type.small.weight')};
      line-height: ${token('type.small.line-height')};
    }
    .odd-stepper a {
      color: inherit;
    }
    .odd-stepper > li:has(> odd-status-marker[status='failed']) > :last-child > :not(:first-child) {
      color: ${token('color.danger.foreground')};
    }
    .odd-stepper
      > :is([aria-current='step'], :has([aria-current='step']))
      > odd-status-marker::part(base) {
      border-color: ${token('color.action.default')};
      background: ${token('color.action.default')};
      color: ${token('color.text.on-action')};
    }
    @container odd-stepper (max-inline-size: 36rem) {
      .odd-stepper > li {
        flex-basis: 100%;
      }
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
  'description-list': descriptionList,
  timeline,
  stepper,
  utilities,
} as const;
