import { html } from '@oddkin/core/template';
import type { OddkinVoiceInput } from './voice-input.js';

/** Anatomy: `controls` (record toggle, cancel, use, clear), `status`, and a nested transcript. */
export const voiceInputTemplate = (host: OddkinVoiceInput) => {
  const t = host._strings;
  const state = host._state.value;
  const unsupported = state.status === 'unsupported';
  const recording = state.status === 'recording' || state.status === 'requesting-permission';
  const status = unsupported ? t.unsupported : t[state.status];
  const hasText = state.segments.some((s) => s.text.trim());
  return html`<div class="base" part="base">
    <div part="controls" class="actions">
      <button
        class="record text-button"
        type="button"
        aria-pressed=${recording ? 'true' : 'false'}
        ?disabled=${host.disabled || unsupported || state.status === 'processing'}
        @click=${host._toggle}
      >
        <span class="dot" aria-hidden="true"></span>${recording ? t.stop : t.start}
      </button>
      <button class="text-button" type="button" ?hidden=${!recording} @click=${host._cancel}>
        ${t.cancel}
      </button>
      <button
        class="text-button"
        type="button"
        ?hidden=${recording || !hasText}
        @click=${host._use}
      >
        ${t.use}
      </button>
      <button
        class="text-button"
        type="button"
        ?hidden=${recording || !hasText}
        @click=${host._clear}
      >
        ${t.clear}
      </button>
    </div>
    <p part="status" class="status-text" data-status=${state.status} ?hidden=${!status}>
      ${status}
    </p>
    <odd-transcript
      .segments=${state.segments}
      .interim=${state.interim}
      ?hidden=${!hasText && !state.interim}
    ></odd-transcript>
  </div>`;
};
