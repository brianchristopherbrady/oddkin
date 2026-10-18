import { html } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import type { OddkinInlineAssist } from './inline-assist.js';

/** Anatomy: a `toolbar` of actions (roving tab stop), an optional language select, status, and `result`. */
export const inlineAssistTemplate = (host: OddkinInlineAssist) => {
  const t = host._strings;
  const blocked = host._blocked;
  const pending = host.status === 'pending';
  const active = Math.min(host._active.value, host._actions.length - 1);
  const message =
    blocked ??
    (pending
      ? host._pendingText()
      : host.status === 'failed'
        ? format(t.failed, { message: host.error?.message ?? '' })
        : '');
  const selection = host.selection;
  return html`<div class="base" part="base">
    <div
      part="toolbar"
      class="toolbar"
      role="toolbar"
      aria-label=${t.label}
      aria-describedby="message"
      @keydown=${host._onKey}
    >
      ${host._actions.map(
        (action, i) =>
          html`<button
            class="text-button"
            type="button"
            tabindex=${i === active ? '0' : '-1'}
            data-action=${action.id}
            aria-disabled=${blocked || pending ? 'true' : null}
            @click=${host._request}
            @focus=${() => (host._active.value = i)}
          >
            ${action.label}
          </button>`,
      )}
    </div>
    ${
      host.languages.length
        ? html`<label class="language"
            ><span class="muted">${t.language}</span>
            <select @change=${host._onLanguage}>
              ${host.languages.map((l) => html`<option .value=${l.id} ?selected=${l.id === host._language.value}>${l.label}</option>`)}
            </select></label
          >`
        : null
    }
    <p
      id="message"
      class="message"
      data-status=${blocked ? 'blocked' : host.status}
      ?hidden=${!message}
    >
      ${message}
    </p>
    <p class="muted" ?hidden=${!selection || !!blocked}>
      ${selection ? format(t.selected, { count: selection.end - selection.start }) : ''}
    </p>
    <div part="result" class="result" ?hidden=${!host.result}><div class="content"></div></div>
  </div>`;
};
