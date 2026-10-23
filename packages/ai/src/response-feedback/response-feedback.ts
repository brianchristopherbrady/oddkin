import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { FeedbackRecord } from '../contracts/types.js';
import { announceEvent, feedbackSubmitEvent } from '../events.js';
import { FocusRecovery } from '@oddkin/core/controllers/focus';
import { strings } from '../internal/strings.js';

export const FEEDBACK_STRINGS = {
  label: 'Rate this response',
  positive: 'Good response',
  negative: 'Bad response',
  reasons: 'What went wrong? (optional)',
  comment: 'Comment (optional)',
  submit: 'Send feedback',
  cancel: 'Cancel',
  pending: 'Sending feedback…',
  submitted: 'Thanks. Your feedback was recorded.',
  failed: 'Feedback was not sent: {message}',
  retry: 'Try again',
};

/**
 * Feedback on one response: a rating, optional reasons and comment, a pending state, and the
 * confirmed outcome from the feedback record.
 *
 * @csspart base - The feedback surface.
 * @csspart form - Reasons and comment.
 * @a11y Ratings are toggle buttons (`aria-pressed`). The outcome text comes from the record, never from the local request.
 * @keyboard Tab and Enter or Space; the form keeps focus order rating → reasons → comment → submit.
 * @useFor Collecting user feedback on generated responses.
 * @notFor Surveys or general forms.
 * @category AI
 */
export class OddkinResponseFeedback extends OddkinElement.with({
  messageId: prop.string({
    default: '',
    attribute: 'message-id',
    description: 'Message the feedback is about.',
  }),
  feedback: prop.object<FeedbackRecord>({
    description: 'The authoritative feedback record (status and outcome).',
  }),
  reasons: prop.array<string>({ description: 'Reasons offered for negative feedback.' }),
  disabled: prop.boolean({ reflect: true, description: 'Feedback is unavailable.' }),
  announce: prop.enum(['none', 'important'], {
    default: 'none',
    empty: 'important',
    description: 'Announce outcomes (when no surrounding surface does).',
  }),
  strings: prop.object<Partial<typeof FEEDBACK_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-feedback-submit': feedbackSubmitEvent,
    'odd-announce': announceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinResponseFeedback>;

  /** @internal Local draft (presentation state). */
  readonly _rating = signal<'positive' | 'negative' | undefined>(undefined);
  /** @internal */
  readonly _selected = signal<readonly string[]>([]);
  /** @internal */
  readonly _comment = signal('');

  /** @internal */
  get _strings(): typeof FEEDBACK_STRINGS {
    return strings(FEEDBACK_STRINGS, this.strings);
  }

  /** @internal */
  readonly _rate = (event: Event): void => {
    const rating = (event.currentTarget as HTMLElement).dataset['rating'] as
      'positive' | 'negative';
    this._rating.value = this._rating.peek() === rating ? undefined : rating;
  };
  /** @internal */
  readonly _toggleReason = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const current = this._selected.peek();
    this._selected.value = input.checked
      ? [...current, input.value]
      : current.filter((r) => r !== input.value);
  };
  /** @internal */
  readonly _onComment = (event: Event): void => {
    this._comment.value = (event.target as HTMLTextAreaElement).value;
  };
  /** @internal */
  readonly _cancel = (): void => {
    this._rating.value = undefined;
    this._selected.value = [];
    this._comment.value = '';
  };
  /** @internal */
  readonly _submit = (event: Event): void => {
    event.preventDefault();
    const rating = this._rating.peek();
    if (!rating || this.disabled || this.feedback?.status === 'pending') return;
    this.emit(feedbackSubmitEvent, {
      messageId: this.messageId,
      rating,
      reasons: rating === 'negative' ? this._selected.peek() : [],
      comment: this._comment.peek(),
    });
  };

  protected override mounted(scope: Scope): void {
    scope.use(
      new FocusRecovery({
        root: () => this.shadowRoot,
        fallback: () => this.shadowRoot?.querySelector<HTMLElement>('.outcome'),
      }),
    );
    let previous: string | undefined;
    scope.effect(
      () => {
        const status = this.feedback?.status;
        if (status === 'submitted' && previous && previous !== 'submitted') this._cancel();
        if (
          this.announce !== 'none' &&
          previous !== undefined &&
          status !== previous &&
          (status === 'submitted' || status === 'failed')
        ) {
          const t = this._strings;
          this.emit(announceEvent, {
            text:
              status === 'submitted'
                ? t.submitted
                : t.failed.replace('{message}', this.feedback?.error?.message ?? ''),
            priority: 'polite',
            key: `feedback:${this.messageId}:${status}:${Date.now()}`,
          });
        }
        previous = status ?? 'idle';
      },
      { phase: 'post', name: '<odd-response-feedback> outcome' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-response-feedback': OddkinResponseFeedback;
  }
}
