import { html, repeat } from '@oddkin/core/template';

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

/** What a decision row shows besides its buttons. */
export interface DecisionState {
  /** The action whose button loads while its request is in flight; the others lock. */
  readonly loading?: string | undefined;
  /** While a request is in flight: the line below the buttons. */
  readonly pending?: string | undefined;
  /** A request that failed: the error above the buttons, which stay for a retry with the draft. */
  readonly error?: string | undefined;
  /** No action is available: the reason below the buttons, which are all disabled. */
  readonly unavailable?: string | undefined;
  /**
   * A confirmed outcome: the line that replaces the buttons, and where focus goes when the focused
   * button disappears (`tabindex="-1"`). Its tone colours it; neutral when absent.
   */
  readonly outcome?: { readonly text: string; readonly tone?: string | undefined } | undefined;
}

/**
 * The shared decision row (Figma page 08, `Oddkin/AI/Internal/DecisionRow`; ADR 0049 §4) of the
 * elements that ask a host to decide (`odd-action-approval`, `odd-question`, `odd-change-review`,
 * `odd-checkpoint`), one mechanism with a setup per operation: an `odd-button` per action in
 * order, the chosen one loading while its request is in flight and the others locked, the pending
 * line below, a failure's error above, an unavailable reason below, and a confirmed outcome in
 * their place. Buttons are keyed by action: one that goes is removed, never reused for the next
 * action (Accept for Undo), so focus recovery moves its focus instead of leaving it on the new one.
 * The request guard and focus recovery stay with each element's `DecisionController`.
 */
export const decisionRow = (
  actions: readonly (DecisionAction | false | null | undefined)[],
  state: DecisionState = {},
) => {
  const { loading, pending, error, unavailable, outcome } = state;
  if (outcome)
    return html`<div class="decision">
      <p class="outcome" data-tone=${outcome.tone ?? ''} tabindex="-1">${outcome.text}</p>
    </div>`;
  const locked = unavailable !== undefined || loading !== undefined;
  return html`<div class="decision">
    <p class="decision-error" ?hidden=${!error}>${error ?? ''}</p>
    <div part="actions" class="actions">
      ${repeat(
        actions.filter((a): a is DecisionAction => !!a),
        (a) => a.action,
        (a) => {
          const busy = loading === a.action;
          return html`<odd-button
            appearance=${a.appearance}
            type=${a.type}
            data-action=${a.action}
            data-id=${a.id}
            ?disabled=${(!!a.disabled || locked) && !busy}
            ?loading=${busy}
            @click=${a.onClick}
            >${a.label}</odd-button
          >`;
        },
      )}
    </div>
    <p class="pending" ?hidden=${!pending}>${pending ?? ''}</p>
    <p class="decision-reason" ?hidden=${!unavailable}>${unavailable ?? ''}</p>
  </div>`;
};
