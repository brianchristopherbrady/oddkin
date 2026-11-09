import { html } from '@oddkin/core/template';

/** One button of a decision row. */
export interface DecisionAction {
  /** What the button asks for: its `data-action`. */
  readonly action: string;
  readonly label: string;
  readonly appearance?: 'primary' | 'ghost' | undefined;
  /** `submit` for a row inside the element's own form. */
  readonly type?: 'submit' | undefined;
  /** The record it acts on, when the row repeats per record (`data-id`). */
  readonly id?: string | undefined;
  /** Disabled, unless it is the button that loads. */
  readonly disabled?: boolean | undefined;
  readonly onClick: (event: Event) => void;
}

/**
 * The shared decision row of the elements that ask a host to decide (`odd-action-approval`,
 * `odd-question`, `odd-change-review`, `odd-checkpoint`; ADR 0049 §4): an `odd-button` per action,
 * in order, at the element's `size`. While a request is in flight, the element names the action
 * whose button `loading` shows (the approval its decision; the question Answer, for an answer or
 * a skip); that button stays enabled and the others follow their `disabled`. Each element keeps
 * its presentation of today until the redesign (owner, 2026-11-09). The request guard and focus
 * recovery stay with each element's `DecisionController`.
 */
export const decisionRow = (
  size: 'sm' | undefined,
  actions: readonly (DecisionAction | false | null | undefined)[],
  loading?: string,
) =>
  actions.map((a) => {
    if (!a) return null;
    const busy = loading === a.action;
    return html`<odd-button
      size=${size}
      appearance=${a.appearance}
      type=${a.type}
      data-action=${a.action}
      data-id=${a.id}
      ?disabled=${!!a.disabled && !busy}
      ?loading=${busy}
      @click=${a.onClick}
      >${a.label}</odd-button
    >`;
  });
