import { live } from '@oddkin/core/helpers/live';
import { html, repeat } from '@oddkin/core/template';
import { can } from '../contracts/normalize.js';
import { format } from '../internal/strings.js';
import type { OddkinPromptInput } from './prompt-input.js';

/**
 * Anatomy: a native `form` with the `header` slot, `attachments`, the labelled `input`, the
 * `toolbar` (slots, attach, send or stop), and `status`.
 */
export const promptInputTemplate = (host: OddkinPromptInput) => {
  const t = host._strings;
  const state = host._state.value;
  const submitting = state.submission?.status === 'submitting';
  const failure = state.submission?.status === 'failed' ? state.submission.error : undefined;
  const blocker = host._sendBlocker(state);
  const showStop = host.loading && can(host.capabilities, 'stop');
  const attachments = host._attachmentsAvailable();
  const blocked = host._blocked.value;
  const status = submitting
    ? t.sending
    : failure
      ? format(t.failed, { message: failure.message })
      : blocked;
  const describedBy = ['hint', state.issues.length ? 'issues' : '', status ? 'status' : '']
    .filter(Boolean)
    .join(' ');
  return html`<form
    part="form"
    class="form"
    data-dragging=${host._dragging.value ? 'true' : 'false'}
    @submit=${host._onSubmit}
    @dragover=${host._onDragOver}
    @dragleave=${host._onDragLeave}
    @drop=${host._onDrop}
  >
    <slot name="header"></slot>
    <ul part="attachments" class="attachments" ?hidden=${!state.attachments.length}>
      ${repeat(
        state.attachments,
        (a) => a.id,
        (a) => {
          const label =
            a.status === 'uploading'
              ? format(t.uploading, {
                  progress: a.progress !== undefined ? `${Math.round(a.progress * 100)}%` : '',
                })
              : a.status === 'failed'
                ? t.failedStatus
                : t[a.status];
          return html`<li class="attachment" data-status=${a.status}>
            ${a.previewUrl ? html`<img class="thumb" alt="" src=${a.previewUrl} />` : null}
            <span class="name">${a.name}</span>
            <span class="muted">${host._bytes(a.size)} · ${label}</span>
            <span class="error" ?hidden=${!a.error}>${a.error?.message ?? ''}</span>
            <button
              class="text-button"
              type="button"
              data-id=${a.id}
              aria-label=${format(t.remove, { name: a.name })}
              @click=${host._remove}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>`;
        },
      )}
    </ul>
    <ul id="issues" class="issues error" ?hidden=${!state.issues.length}>
      ${state.issues.map((issue) => html`<li>${host._issue(issue)}</li>`)}
    </ul>
    <label class="visually-hidden" for="input">${host.label || t.label}</label>
    <textarea
      part="input"
      id="input"
      class="input"
      rows="1"
      placeholder=${host.placeholder || t.placeholder}
      aria-describedby=${describedBy}
      aria-invalid=${failure ? 'true' : null}
      ?disabled=${host.disabled}
      .value=${live(state.text)}
      @input=${host._onInput}
      @keydown=${host._onKeyDown}
      @compositionstart=${host._onCompositionStart}
      @compositionend=${host._onCompositionEnd}
      @paste=${host._onPaste}
    ></textarea>
    <div part="toolbar" class="toolbar">
      <slot name="toolbar-start"></slot>
      ${
        attachments
          ? html`<button
                class="text-button"
                type="button"
                ?disabled=${host.disabled}
                @click=${host._pick}
              >
                <span aria-hidden="true">📎</span><span class="attach-label">${t.attach}</span>
              </button>
              <input
                type="file"
                multiple
                hidden
                accept=${host.accept || null}
                @change=${host._onFiles}
              />`
          : null
      }
      <span class="spacer"></span>
      <slot name="toolbar-end"></slot>
      <span id="hint" class="visually-hidden"
        >${host.enterBehavior === 'send' ? t.hintSend : t.hintNewline}</span
      >
      ${
        showStop
          ? html`<odd-button class="stop" @click=${host._stop}>${t.stop}</odd-button>`
          : html`<odd-button
              class="send"
              appearance="primary"
              ?disabled=${blocker !== undefined && !submitting}
              ?loading=${submitting}
              @click=${host._onSubmit}
              >${t.send}</odd-button
            >`
      }
    </div>
    <p
      part="status"
      id="status"
      class="status-text"
      data-failed=${failure ? 'true' : 'false'}
      ?hidden=${!status}
    >
      ${status}
    </p>
    <p class="drop-hint" aria-hidden="true" ?hidden=${!host._dragging.value}>${t.dropHere}</p>
  </form>`;
};
