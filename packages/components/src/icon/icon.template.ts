import { styleMap } from '@oddkin/core/helpers/style-map';
import { html } from '@oddkin/core/template';
import type { OddkinIcon } from './icon.js';

/** A CSS `url()` with the characters that could end the string escaped. */
const cssUrl = (url: string) =>
  `url("${url.replace(/["\\\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}")`;

/** Anatomy: `part="base"`, a mask of `src` in `currentColor`, or the default slot without `src`. */
export const iconTemplate = (icon: OddkinIcon) =>
  html`<span part="base" class="icon"
    >${
      icon.src
        ? html`<span class="mask" style=${styleMap({ '--_icon-src': cssUrl(icon.src) })}></span>`
        : html`<slot></slot>`
    }</span
  >`;
