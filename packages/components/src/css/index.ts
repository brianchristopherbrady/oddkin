import { css, type CSSResult } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Opt-in document stylesheets, written to `dist/css/<name>.css` by
 * `scripts/build-component-css.mjs` inside their cascade layer after the canonical layer order
 * (ADR 0039). Nothing loads them implicitly; unlayered application CSS overrides all of them.
 */
export interface DocumentStylesheet {
  readonly layer: 'odd.reset' | 'odd.base' | 'odd.utilities';
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

export const documentStylesheets = { reset, base, utilities } as const;
