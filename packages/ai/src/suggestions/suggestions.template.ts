import { html, repeat } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import type { OddkinSuggestions } from './suggestions.js';

/** Anatomy: a labelled `list`; each item has a `suggestion` (insert) and an optional `send` button. */
export const suggestionsTemplate = (host: OddkinSuggestions) => {
  const t = host._strings;
  const { disabled, insertOnly } = host;
  return html`<ul
    part="list"
    class="list"
    aria-label=${t.label}
    ?hidden=${!host.suggestions.length}
  >
    ${repeat(
      host.suggestions,
      (s) => s.id,
      (s) =>
        html`<li class="item">
          <button
            part="suggestion"
            class="suggestion"
            type="button"
            data-id=${s.id}
            ?disabled=${disabled}
            @click=${host._select}
          >
            ${s.label}
          </button>
          ${
            insertOnly
              ? null
              : html`<button
                  part="send"
                  class="send"
                  type="button"
                  data-id=${s.id}
                  aria-label=${format(t.send, { label: s.label })}
                  ?disabled=${disabled}
                  @click=${host._submit}
                >
                  <span aria-hidden="true">↑</span>
                </button>`
          }
        </li>`,
    )}
  </ul>`;
};
