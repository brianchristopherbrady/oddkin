import { createLayoutHelpers, type Declarations } from '@oddkin/core/layout';
import { css, unsafeCSS, type CSSResult } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { nativeButtonStyles } from '../button/button.native.styles.js';

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
      rule('.odd-row', helpers.row({ gap: gap('row') }).declarations),
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
 * theme's layout roles.
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

export const documentStylesheets = { reset, base, layout, button, utilities } as const;
