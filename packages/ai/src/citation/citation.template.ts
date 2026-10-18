import { html } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import { displayHost, safeUrl } from '../markdown/url.js';
import type { OddkinCitation } from './citation.js';

/** Anatomy: a `trigger` button and a `preview` panel after it (no popup layer, no hover-only content). */
export const citationTemplate = (host: OddkinCitation) => {
  const t = host._strings;
  const source = host.source;
  const open = host._open.value;
  const marker = host.index > 0 ? String(host.index) : host.sourceId;
  const title = source?.title || displayHost(source?.url) || t.untitled;
  const url = source?.url ? safeUrl(source.url) : undefined;
  const name = source
    ? format(t.source, { index: marker, title })
    : format(t.unresolved, { id: marker });
  return html`<button
      part="trigger"
      class="trigger"
      type="button"
      aria-label=${name}
      aria-expanded=${open ? 'true' : 'false'}
      aria-controls="preview"
      data-resolved=${source ? 'true' : 'false'}
      @click=${host._toggle}
    >
      ${marker}</button
    ><span
      part="preview"
      id="preview"
      class="preview"
      role="group"
      aria-label=${name}
      ?hidden=${!open}
    >
      ${
        source
          ? html`<strong class="title">${title}</strong>
              <span class="muted host" ?hidden=${!source.publisher && !url}
                >${source.publisher ?? displayHost(url) ?? ''}</span
              >
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
                <button class="text-button" type="button" @click=${host._show}>${t.show}</button>
              </span>`
          : html`<span class="muted">${t.unavailable}</span>`
      }
    </span>`;
};
