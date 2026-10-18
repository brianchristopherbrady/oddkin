import { html } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import type { OddkinMessageBranch } from './message-branch.js';

/** Anatomy: a labelled `base` group: previous button, position text, next button. */
export const messageBranchTemplate = (host: OddkinMessageBranch) => {
  const t = host._strings;
  const branch = host.branch;
  if (!branch || branch.count < 2) return html``;
  const off = host._unavailable !== undefined;
  return html`<div
    part="base"
    class="base actions"
    role="group"
    aria-label=${t.label}
    title=${host._unavailable || ''}
  >
    <button
      class="text-button"
      type="button"
      data-direction="previous"
      aria-label=${t.previous}
      ?disabled=${off || !branch.previousId}
      @click=${host._go}
    >
      <span aria-hidden="true">‹</span>
    </button>
    <span class="position muted">
      <span aria-hidden="true">${branch.index} / ${branch.count}</span>
      <span class="visually-hidden"
        >${format(t.position, { index: branch.index, count: branch.count })}</span
      >
    </span>
    <button
      class="text-button"
      type="button"
      data-direction="next"
      aria-label=${t.next}
      ?disabled=${off || !branch.nextId}
      @click=${host._go}
    >
      <span aria-hidden="true">›</span>
    </button>
  </div>`;
};
