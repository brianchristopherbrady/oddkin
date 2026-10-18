import { html, repeat } from '@oddkin/core/template';
import { can } from '../contracts/normalize.js';
import { format } from '../internal/strings.js';
import type { OddkinConversation } from './conversation.js';

/**
 * Anatomy: the `scroller` holds history controls and the `feed` of `odd-message` articles; then
 * the `jump` button, the `activity` bar, the `status` and `composer` slots, and two live regions
 * (written only by the announcer).
 */
export const conversationTemplate = (host: OddkinConversation) => {
  const t = host._strings;
  const state = host.current;
  const messages = state?.messages ?? [];
  const count = messages.length;
  const current = host._current.value ?? messages[count - 1]?.id;
  const attempt = state?.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
  const history = state?.history ?? 'complete';
  const showHistory = !!state && state.hasMoreHistory && can(state.capabilities, 'history');
  const unseen = host._unseen.value;
  const showActivity =
    !!attempt &&
    (attempt.status !== 'completed' || attempt.stop === 'too-late' || attempt.stop === 'unknown') &&
    !(attempt.status === 'cancelled' && attempt.stop !== 'unknown');
  // Repeat items render untracked during commit: read everything they use here.
  const { markdown, renderers, artifactRenderers, toolRenderer, feedbackReasons } = host;
  return html`<div class="base" part="base">
    <div part="scroller" class="scroller" tabindex="-1">
      <div class="history" ?hidden=${!showHistory && history !== 'error'}>
        <button
          class="text-button"
          type="button"
          ?hidden=${history !== 'idle'}
          @click=${host._requestHistory}
        >
          ${t.loadEarlier}
        </button>
        <span class="muted" ?hidden=${history !== 'loading'}>${t.loading}</span>
        <span class="error" ?hidden=${history !== 'error'}>${t.historyError}</span>
        <button
          class="text-button"
          type="button"
          ?hidden=${history !== 'error'}
          @click=${host._requestHistory}
        >
          ${t.retry}
        </button>
      </div>
      <div class="empty" ?hidden=${count > 0}>
        <slot name="empty"><p class="muted">${t.empty}</p></slot>
      </div>
      <div
        part="feed"
        class="feed"
        role="feed"
        aria-label=${host.label || t.label}
        aria-busy=${host._busy(state) ? 'true' : 'false'}
      >
        ${repeat(
          messages,
          (m) => m.id,
          (m, i) =>
            html`<odd-message
              role="article"
              data-id=${m.id}
              tabindex=${m.id === current ? '0' : '-1'}
              aria-posinset=${String(i + 1)}
              aria-setsize=${String(count)}
              aria-label=${host._messageLabel(m.role, i + 1, count)}
              .message=${m}
              .attempt=${m.attemptId ? state?.attempts[m.attemptId] : undefined}
              .tools=${state?.tools}
              .approvals=${state?.approvals}
              .artifacts=${state?.artifacts}
              .branch=${state?.branches[m.id]}
              .feedback=${state?.feedback[m.id]}
              .capabilities=${state?.capabilities}
              .markdown=${markdown}
              .renderers=${renderers}
              .artifactRenderers=${artifactRenderers}
              .toolRenderer=${toolRenderer}
              .feedbackReasons=${feedbackReasons}
            ></odd-message>`,
        )}
      </div>
    </div>
    <button
      part="jump"
      class="jump"
      type="button"
      ?hidden=${host._following.value || !count}
      @click=${host._jump}
    >
      ${unseen ? format(t.jumpNew, { count: unseen }) : t.jump}
    </button>
    <odd-activity
      part="activity"
      ?hidden=${!showActivity}
      .attempt=${attempt}
      .tools=${state ? host._activeTools(state) : []}
      .capabilities=${state?.capabilities}
    ></odd-activity>
    <slot name="status"></slot>
    <slot name="composer"></slot>
    <div
      id="polite"
      class="visually-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    ></div>
    <div id="assertive" class="visually-hidden" aria-live="assertive" aria-atomic="true"></div>
  </div>`;
};
