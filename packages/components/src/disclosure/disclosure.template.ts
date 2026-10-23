import { html } from '@oddkin/core/template';
import { chevronDownGlyph, chevronEndGlyph } from '../styles/glyphs.js';
import type { OddkinDisclosure } from './disclosure.js';

/**
 * Anatomy: `part="base"` around a native `<details>` with the `summary` (the `label` text and the
 * `marker` chevron) and the `content` region holding the default slot.
 */
export const disclosureTemplate = (disclosure: OddkinDisclosure) =>
  html`<div part="base" class="disclosure">
    <details class="details" ?open=${disclosure.open} @toggle=${disclosure._onToggle}>
      <summary
        part="summary"
        class="summary"
        aria-disabled=${disclosure.disabled ? 'true' : null}
        tabindex=${disclosure.disabled ? '-1' : null}
        @click=${disclosure._onClick}
      >
        <span part="label" class="label">${disclosure.label}</span
        ><span part="marker" class="marker"
          >${disclosure.open ? chevronDownGlyph : chevronEndGlyph}</span
        >
      </summary>
      <div part="content" class="content"><slot></slot></div>
    </details>
  </div>`;
