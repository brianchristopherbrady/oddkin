import { html, repeat } from '@oddkin/core/template';
import { live } from '@oddkin/core/helpers/live';
import { format } from '../internal/strings.js';
import type { OddkinTranscript } from './transcript.js';

/** Anatomy: a labelled region with the final `list` and the `interim` text. */
export const transcriptTemplate = (host: OddkinTranscript) => {
  const t = host._strings;
  const editable = host.editable;
  const finals = host.segments.filter((s) => s.final);
  const interim =
    host.interim ||
    host.segments
      .filter((s) => !s.final)
      .map((s) => s.text)
      .join(' ');
  return html`<div class="base" role="group" aria-label=${t.label}>
    <p class="muted" ?hidden=${!!finals.length || !!interim}>${t.empty}</p>
    <ol part="list" class="list" ?hidden=${!finals.length}>
      ${repeat(
        finals,
        (s) => s.id,
        (s, i) =>
          html`<li class="segment">
            ${
              editable
                ? html`<textarea
                    rows="2"
                    data-id=${s.id}
                    aria-label=${format(t.edit, { index: i + 1 })}
                    .value=${live(s.text)}
                    @change=${host._onEdit}
                  ></textarea>`
                : html`<span>${s.text}</span>`
            }
          </li>`,
      )}
    </ol>
    <p part="interim" class="interim" ?hidden=${!interim}>
      <span class="muted">${t.listening}: </span>${interim}
    </p>
  </div>`;
};
