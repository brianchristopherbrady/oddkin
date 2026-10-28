import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { JsonValue, QuestionRecord } from '../contracts/types.js';
import { announceEvent, questionAnswerEvent, questionSkipEvent } from '../events.js';
import { FocusRecovery } from '@oddkin/core/controllers/focus';
import { format, formatTime, langOf, strings } from '../internal/strings.js';

export const QUESTION_STRINGS = {
  other: 'Other',
  otherLabel: 'Your answer',
  submit: 'Answer',
  skip: 'Skip',
  submitting: 'Sending your answer…',
  submitted: 'Answered.',
  skipped: 'Skipped.',
  expired: 'This question expired; answers are no longer accepted.',
  failed: 'Your answer was not sent: {message}',
  required: 'Choose an option or enter an answer.',
  expires: 'Answer by {time}',
  yes: 'Yes',
  announceAsked: 'Question: {prompt}',
};

/**
 * A clarifying question from an assistant or agent: choices, a structured form, or free text,
 * with an optional custom answer. Submitted, skipped, expired, and failed states come from the
 * record; answers are bound to the question revision.
 *
 * @csspart form - The native form.
 * @csspart actions - Answer and skip.
 * @a11y A native form with a fieldset and legend; required fields use native constraint validation.
 * @keyboard Native form controls; Enter in a single-line field submits.
 * @useFor Asking the user for missing information before continuing.
 * @notFor General-purpose forms unrelated to an agent's request.
 * @customization 1 2
 * @category AI
 */
export class OddkinQuestion extends OddkinElement.with({
  question: prop.object<QuestionRecord>({ description: 'The question record.' }),
  announce: prop.enum(['none', 'important'], {
    default: 'none',
    empty: 'important',
    description: 'Announce new questions (when no surrounding surface does).',
  }),
  strings: prop.object<Partial<typeof QUESTION_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-question-answer': questionAnswerEvent,
    'odd-question-skip': questionSkipEvent,
    'odd-announce': announceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinQuestion>;

  /** @internal `questionId:revision` requested from this view. */
  readonly _requested = signal<string | undefined>(undefined);
  /** @internal Validation message for choice questions. */
  readonly _invalid = signal('');

  /** @internal */
  get _strings(): typeof QUESTION_STRINGS {
    return strings(QUESTION_STRINGS, this.strings);
  }

  /** @internal */
  _expires(): string | undefined {
    const time = formatTime(this.question?.expiresAt, langOf(this));
    return time ? format(this._strings.expires, { time }) : undefined;
  }

  /** @internal */
  get _locked(): boolean {
    const q = this.question;
    if (!q) return true;
    if (q.status !== 'requested' && q.status !== 'failed') return true;
    return this._requested.value === `${q.questionId}:${q.revision}`;
  }

  /** @internal */
  readonly _submit = (event: Event): void => {
    event.preventDefault();
    const q = this.question;
    const form = this.shadowRoot?.querySelector('form');
    if (!q || !form || this._locked) return;
    if (!form.reportValidity()) return;
    const answer = this.#answer(q, new FormData(form));
    if (answer === undefined) {
      this._invalid.value = this._strings.required;
      return;
    }
    this._invalid.value = '';
    this._requested.value = `${q.questionId}:${q.revision}`;
    this.emit(questionAnswerEvent, { questionId: q.questionId, revision: q.revision, answer });
  };

  /** @internal */
  readonly _skip = (): void => {
    const q = this.question;
    if (!q || this._locked) return;
    this._requested.value = `${q.questionId}:${q.revision}`;
    this.emit(questionSkipEvent, { questionId: q.questionId, revision: q.revision });
  };

  #answer(q: QuestionRecord, data: FormData): JsonValue | undefined {
    const custom = String(data.get('custom') ?? '').trim();
    switch (q.kind) {
      case 'choice': {
        const choice = data.get('choice');
        if (choice === '__other') return custom ? { custom } : undefined;
        return choice ? { choice: String(choice) } : undefined;
      }
      case 'multi-choice': {
        const choices = data
          .getAll('choice')
          .map(String)
          .filter((c) => c !== '__other');
        if (data.getAll('choice').includes('__other') && custom) return { choices, custom };
        return choices.length ? { choices } : undefined;
      }
      case 'text': {
        const text = String(data.get('text') ?? '').trim();
        return text ? { text } : undefined;
      }
      case 'form': {
        const fields: Record<string, JsonValue> = {};
        for (const field of q.fields ?? []) {
          const raw = data.get(field.id);
          if (field.type === 'boolean') fields[field.id] = raw === 'on';
          else if (field.type === 'number') {
            if (raw !== null && raw !== '') fields[field.id] = Number(raw);
          } else if (raw !== null && raw !== '') fields[field.id] = String(raw);
        }
        return { fields };
      }
    }
  }

  protected override mounted(scope: Scope): void {
    scope.use(
      new FocusRecovery({
        root: () => this.shadowRoot,
        fallback: () => this.shadowRoot?.querySelector<HTMLElement>('.state'),
      }),
    );
    let seen: string | undefined;
    scope.effect(
      () => {
        const q = this.question;
        if (!q) return;
        const key = `${q.questionId}:${q.revision}`;
        const requested = this._requested.peek();
        if (requested && (requested !== key || q.status === 'failed'))
          this._requested.value = undefined;
        if (this.announce !== 'none' && seen !== key && q.status === 'requested')
          this.emit(announceEvent, {
            text: format(this._strings.announceAsked, { prompt: q.prompt }),
            priority: 'polite',
            key: `question:${key}`,
          });
        seen = key;
      },
      { phase: 'post', name: '<odd-question> status' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-question': OddkinQuestion;
  }
}
