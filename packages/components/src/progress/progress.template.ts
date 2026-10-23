import { styleMap } from '@oddkin/core/helpers/style-map';
import { html } from '@oddkin/core/template';
import type { OddkinProgress } from './progress.js';

/**
 * Anatomy: `part="label"` and `part="value-text"` above `part="track"` (`role="progressbar"`,
 * named by the label and described by `part="description"`) holding `part="indicator"`. Without a
 * value the track has no `aria-valuenow` and the indicator moves instead of filling.
 */
export const progressTemplate = (progress: OddkinProgress) => {
  const value = progress._value;
  const text = progress._valueText;
  return html`<div part="base" class=${value === undefined ? 'progress indeterminate' : 'progress'}>
    <div class="head" ?hidden=${!progress.label && !text}>
      <span id="label" part="label" class="label">${progress.label}</span>
      <span part="value-text" class="value-text" aria-hidden="true">${text}</span>
    </div>
    <div
      part="track"
      class="track"
      role="progressbar"
      aria-labelledby=${progress.label ? 'label' : null}
      aria-label=${progress.label ? null : progress._strings.label}
      aria-describedby=${progress.description ? 'description' : null}
      aria-valuemin="0"
      aria-valuemax=${String(progress._max)}
      aria-valuenow=${value === undefined ? null : String(value)}
      aria-valuetext=${text || null}
    >
      <div
        part="indicator"
        class="indicator"
        style=${styleMap({ '--_progress': value === undefined ? null : value / progress._max })}
      ></div>
    </div>
    <div id="description" part="description" class="description" ?hidden=${!progress.description}>
      ${progress.description}
    </div>
  </div>`;
};
