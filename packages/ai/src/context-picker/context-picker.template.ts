import { html, repeat } from '@oddkin/core/template';
import type { OddkinContextPicker } from './context-picker.js';

/** Anatomy: a labelled `list` of `item`s (kind, label, status, inspect, remove) and `add` controls. */
export const contextPickerTemplate = (host: OddkinContextPicker) => {
  const t = host._strings;
  const items = host.items.filter((item) => item.status !== 'removed');
  const expanded = host._expanded.value;
  return html`<div class="base" part="base" role="group" aria-label=${t.label}>
    <p class="muted" ?hidden=${!!items.length}>${t.empty}</p>
    <ul part="list" class="list" ?hidden=${!items.length}>
      ${repeat(
        items,
        (item) => item.id,
        (item) => {
          const open = expanded.has(item.id);
          return html`<li part="item" class="item" data-status=${item.status}>
            <div class="row">
              <span class="kind muted">${host._kind(item)}</span>
              <span class="label">${item.label}</span>
              <span
                class="status"
                data-tone=${item.status === 'failed' ? 'danger' : item.status === 'ready' ? 'success' : ''}
                >${t[item.status]}</span
              >
              <span class="muted">${host._size(item)}</span>
              <button
                class="text-button"
                type="button"
                data-id=${item.id}
                aria-expanded=${open ? 'true' : 'false'}
                aria-controls=${`preview-${item.id}`}
                aria-label=${host._label(open ? 'hide' : 'inspect', item)}
                @click=${host._toggle}
              >
                <span aria-hidden="true">${open ? '\u25B4' : '\u25BE'}</span>
              </button>
              <button
                class="text-button"
                type="button"
                data-id=${item.id}
                aria-label=${host._label('remove', item)}
                ?disabled=${host.disabled}
                @click=${host._remove}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <p class="error" ?hidden=${!item.error}>${item.error?.message ?? ''}</p>
            <div class="preview" id=${`preview-${item.id}`} ?hidden=${!open}>
              <p class="muted" ?hidden=${!item.detail}>${item.detail ?? ''}</p>
              <pre class="excerpt" ?hidden=${!item.preview}>${item.preview ?? ''}</pre>
              <p class="muted" ?hidden=${!!item.preview || !!item.detail}>${t.noPreview}</p>
            </div>
          </li>`;
        },
      )}
    </ul>
    <div part="add" class="actions add">
      <input type="file" multiple accept=${host.accept || null} hidden @change=${host._onFiles} />
      <button
        class="text-button"
        type="button"
        ?disabled=${host.disabled}
        @click=${host._pickFiles}
      >
        ${t.addFiles}
      </button>
      ${
        host.allowUrls
          ? html`<form class="url" @submit=${host._addUrl}>
              <label
                ><span class="visually-hidden">${t.url}</span>
                <input
                  type="url"
                  placeholder="https://"
                  aria-describedby="url-error"
                  ?disabled=${host.disabled}
                  aria-invalid=${host._urlError.value ? 'true' : null}
                />
              </label>
              <button class="text-button" type="submit" ?disabled=${host.disabled}>
                ${t.addUrl}
              </button>
            </form>`
          : null
      }
    </div>
    <p id="url-error" class="error" ?hidden=${!host._urlError.value}>${host._urlError.value}</p>
  </div>`;
};
