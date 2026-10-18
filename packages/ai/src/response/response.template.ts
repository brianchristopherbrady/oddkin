import { html } from '@oddkin/core/template';
import type { OddkinResponse } from './response.js';

/**
 * Anatomy: `content` (rendered by the Markdown view; the template never binds inside it), a
 * `status` line, and `actions`.
 */
export const responseTemplate = (host: OddkinResponse) => {
  const t = host._strings;
  const status = host.status;
  const message =
    status === 'streaming'
      ? t.streaming
      : status === 'interrupted'
        ? t.interrupted
        : status === 'cancelled'
          ? t.cancelled
          : status === 'failed'
            ? host.error?.message || t.failed
            : '';
  return html`<div part="content" class="content"></div>
    <p part="status" class="status-line" data-status=${status} ?hidden=${!message}>${message}</p>
    <div part="actions" class="actions" ?hidden=${!host.copyable || status === 'streaming'}>
      <button class="text-button" type="button" @click=${host._copy}>${t.copy}</button>
    </div>`;
};
