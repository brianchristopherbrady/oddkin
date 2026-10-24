import { html, repeat } from '@oddkin/core/template';
import { toneGlyph } from '../styles/tone.styles.js';
import type { OddkinValidationSummary } from './validation-summary.js';

/**
 * Anatomy: `part="base"` (the focus target, a group named by the heading) with the danger
 * `marker` glyph, the `label` heading, and the `list` of `link`s, one per problem. Hidden while
 * there is nothing to fix.
 */
export const validationSummaryTemplate = (summary: OddkinValidationSummary) => {
  const entries = summary._entries.value;
  return html`<div
    part="base"
    class="summary"
    data-tone="danger"
    role="group"
    aria-labelledby="label"
    tabindex="-1"
    ?hidden=${!entries.length}
  >
    <div class="header">
      <span part="marker" class="marker" aria-hidden="true">${toneGlyph('danger')}</span>
      <h2 part="label" id="label" class="label">${summary._heading.value}</h2>
    </div>
    <ul part="list" class="list" role="list">
      ${repeat(
        entries,
        (entry) => entry.control,
        (entry) =>
          html`<li class="item">
            <a
              part="link"
              class="link"
              href=${entry.control.id ? `#${entry.control.id}` : '#'}
              @click=${(event: Event) => summary._focus(event, entry.control)}
              >${summary._text(entry)}</a
            >
          </li>`,
      )}
    </ul>
  </div>`;
};
