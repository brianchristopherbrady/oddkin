import { html, repeat } from '@oddkin/core/template';
import { displayHost, safeUrl } from '../markdown/url.js';
import type { OddkinSources } from './sources.js';

/** Anatomy: a heading labelling an ordered `list` of `item`s; each item is focusable for reveal. */
export const sourcesTemplate = (host: OddkinSources) => {
  const t = host._strings;
  const revealed = host._revealed.value;
  return html`<section
    class="base"
    part="base"
    aria-labelledby="heading"
    ?hidden=${!host.sources.length}
  >
    <p id="heading" class="heading">${host.label || t.heading}</p>
    <ol part="list" class="list">
      ${repeat(
        host.sources,
        (s) => s.sourceId,
        (s) => {
          const url = s.url ? safeUrl(s.url) : undefined;
          const title = s.title || displayHost(url) || t.untitled;
          return html`<li
            part="item"
            class="item"
            tabindex="-1"
            data-source-id=${s.sourceId}
            data-revealed=${revealed === s.sourceId ? 'true' : 'false'}
          >
            ${
              url
                ? html`<a
                    class="title"
                    href=${url}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    >${title}</a
                  >`
                : html`<span class="title">${title}</span>`
            }
            <span class="muted" ?hidden=${!s.publisher && !url}
              >${s.publisher ?? displayHost(url) ?? ''}</span
            >
            <span class="excerpt" ?hidden=${!s.excerpt}>${s.excerpt ?? ''}</span>
          </li>`;
        },
      )}
    </ol>
  </section>`;
};
