import { html } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import { displayHost, safeUrl } from '../markdown/url.js';
import type { OddkinCitation } from './citation.js';

/** Anatomy: a stable `trigger`, then a `preview` in a public popover or an allocated inline region. */
export const citationTemplate = (host: OddkinCitation) => {
  const t = host._strings;
  const source = host.source;
  const open = host._open.value;
  const popup = host._presentation.value === 'popover';
  const marker = host.index > 0 ? String(host.index) : host.sourceId;
  const title = source?.title || displayHost(source?.url) || t.untitled;
  const url = source?.url ? safeUrl(source.url) : undefined;
  const name = source
    ? format(t.source, { index: marker, title })
    : format(t.unresolved, { id: marker });
  const preview = html`<span
    part="preview"
    id="preview"
    class=${popup ? 'preview' : 'preview inline'}
    role=${popup ? null : 'group'}
    aria-label=${popup ? null : name}
    ?hidden=${!popup && !open}
  >
    ${
      source
        ? html`<span class="identity">
              <strong class="title">${title}</strong>
              <span class="muted host" ?hidden=${!source.publisher && !url}
                >${source.publisher ?? displayHost(url) ?? ''}</span
              >
            </span>
            <span class="excerpt" ?hidden=${!source.excerpt}>${source.excerpt ?? ''}</span>
            <span class="actions">
              ${
                url
                  ? html`<a
                      class="link"
                      href=${url}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      >${t.open}</a
                    >`
                  : null
              }
              <button class="odd-button" data-size="sm" type="button" @click=${host._show}>
                ${t.show}
              </button>
            </span>`
        : html`<span class="muted">${t.unavailable}</span>`
    }
  </span>`;
  return html`<button
      id="trigger"
      part="trigger"
      class="trigger"
      type="button"
      aria-label=${name}
      aria-expanded=${open ? 'true' : 'false'}
      aria-controls=${popup ? 'source-popover' : 'preview'}
      aria-haspopup=${popup ? 'dialog' : null}
      popovertarget=${popup ? 'source-popover' : null}
      data-resolved=${source ? 'true' : 'false'}
      @click=${host._toggle}
    >
      ${marker}</button
    >${
      popup
        ? html`<odd-popover
            id="source-popover"
            class="popover"
            anchor="trigger"
            .label=${name}
            .strings=${{ close: t.close }}
            @toggle=${host._onPopoverToggle}
            >${preview}</odd-popover
          >`
        : preview
    }`;
};
