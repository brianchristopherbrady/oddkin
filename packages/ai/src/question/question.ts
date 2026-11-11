import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { can, unavailableReason } from '../contracts/normalize.js';
import type { Capabilities, JsonValue, QuestionRecord } from '../contracts/types.js';
import { announceEvent, questionAnswerEvent, questionSkipEvent } from '../events.js';
import { DecisionController } from '../internal/decision.js';
import { format, strings } from '../internal/strings.js';

/** The value of the Other option, whose answer is the text in its field. */
const OTHER = '__other';

/** The control that corrects each problem with a draft, which takes focus. */
const CONTROLS = {
  choice: 'input[name="choice"]',
  custom: 'input[name="custom"]',
  text: 'textarea[name="text"]',
} as const;

export const QUESTION_STRINGS = {
  other: 'Other',
  otherLabel: 'Your answer',
  submit: 'Answer',
  skip: 'Skip',
  submitting: 'Sending your answer…',
  responding: 'Sending your response…',
  answered: 'Answered.',
  skipped: 'Skipped.',
  expired: 'This question expired; answers are no longer accepted.',
  superseded: 'This question changed. Answer the new version.',
  cancelled: 'This question was withdrawn; no answer is needed.',
  failed: 'Your answer was not sent: {message}',
  unavailable: 'Answers are not available here.',
  required: 'Choose an option.',
  otherRequired: 'Enter your answer for Other.',
  textRequired: 'Enter an answer.',
  expires: 'Answer by {time}',
  yes: 'Yes',
  announceAsked: 'Question: {prompt}',
};

/**
 * A clarifying question from an assistant or agent: choices, a structured form, or free text,
 * with an optional custom answer. Answered, skipped, expired, superseded, and failed states come
 * from the record; answers are bound to the question revision.
 *
 * @csspart form - The native form.
 * @csspart actions - Answer and skip.
 * @a11y A native form with a fieldset and legend; required fields use native constraint validation. Other's labelled field shows only while Other is chosen and keeps its text when hidden. An answer that cannot be sent says why, one message for each problem (nothing chosen, Other without text, empty text), in an alert that describes the control to correct; that control takes focus and nothing is cleared.
 * @keyboard Native form controls; Enter in a single-line field submits. Choosing Other keeps focus on it; Tab then moves to its field.
 * @useFor Asking the user for missing information before continuing.
 * @notFor General-purpose forms unrelated to an agent's request.
 * @customization 1 2
 * @category AI
 */
export class OddkinQuestion extends OddkinElement.with({
  question: prop.object<QuestionRecord>({ description: 'The question record.' }),
  capabilities: prop.object<Capabilities>({
    description:
      'When given, `respondToQuestion` decides whether answers can be sent; without it, the host that shows the question answers it.',
  }),
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

  /** @internal The answer requested from this view for a question revision; focus recovery. */
  readonly _decisions = new DecisionController(this, () =>
    this.shadowRoot?.querySelector<HTMLElement>('.outcome'),
  );
  /**
   * @internal Why the draft could not be sent, and the control that corrects it, until it is sent
   * or the question changes.
   */
  readonly _invalid = signal<
    { readonly text: string; readonly control: 'choice' | 'custom' | 'text' } | undefined
  >(undefined);

  /** @internal */
  get _strings(): typeof QUESTION_STRINGS {
    return strings(QUESTION_STRINGS, this.strings);
  }

  /** @internal Why answers cannot be sent, when the capabilities given say so. */
  get _unavailable(): string | undefined {
    const c = this.capabilities;
    return c && !can(c, 'respondToQuestion')
      ? (unavailableReason(c, 'respondToQuestion') ?? this._strings.unavailable)
      : undefined;
  }

  /** @internal */
  get _locked(): boolean {
    const q = this.question;
    if (!q) return true;
    if (q.status !== 'requested' && q.status !== 'failed') return true;
    if (this._unavailable !== undefined) return true;
    return this._decisions.asked(`${q.questionId}:${q.revision}`);
  }

  /** @internal */
  readonly _submit = (event: Event): void => {
    event.preventDefault();
    const q = this.question;
    const form = this.shadowRoot?.querySelector('form');
    if (!q || !form || this._locked) return;
    if (!form.reportValidity()) return;
    const read = this.#read(q, new FormData(form));
    if ('invalid' in read) {
      // The draft stays as it is; focus goes to the control that corrects it.
      this._invalid.value = read.invalid;
      form.querySelector<HTMLElement>(CONTROLS[read.invalid.control])?.focus();
      return;
    }
    this._invalid.value = undefined;
    this._decisions.request(`${q.questionId}:${q.revision}`, 'answer');
    this.emit(questionAnswerEvent, {
      questionId: q.questionId,
      revision: q.revision,
      answer: read.answer,
    });
  };

  /** @internal */
  readonly _skip = (): void => {
    const q = this.question;
    if (!q || this._locked) return;
    this._decisions.request(`${q.questionId}:${q.revision}`, 'skip');
    this.emit(questionSkipEvent, { questionId: q.questionId, revision: q.revision });
  };

  /**
   * The answer, or why it cannot be sent. Other's text counts only while Other is chosen, and a
   * chosen Other needs it, even beside other choices (ADR 0049, page 13).
   */
  #read(
    q: QuestionRecord,
    data: FormData,
  ):
    | { readonly answer: JsonValue }
    | { readonly invalid: NonNullable<OddkinQuestion['_invalid']['value']> } {
    const t = this._strings;
    const custom = String(data.get('custom') ?? '').trim();
    switch (q.kind) {
      case 'choice':
      case 'multi-choice': {
        const chosen = data.getAll('choice').map(String);
        const other = chosen.includes(OTHER);
        if (other && !custom) return { invalid: { text: t.otherRequired, control: 'custom' } };
        if (!chosen.length) return { invalid: { text: t.required, control: 'choice' } };
        const choices = chosen.filter((c) => c !== OTHER);
        if (q.kind === 'choice') return { answer: other ? { custom } : { choice: choices[0]! } };
        return { answer: other ? { choices, custom } : { choices } };
      }
      case 'text': {
        const text = String(data.get('text') ?? '').trim();
        return text ? { answer: { text } } : { invalid: { text: t.textRequired, control: 'text' } };
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
        return { answer: { fields } };
      }
    }
  }

  protected override mounted(scope: Scope): void {
    scope.use(this._decisions);
    let seen: string | undefined;
    scope.effect(
      () => {
        const q = this.question;
        if (!q) return;
        const key = `${q.questionId}:${q.revision}`;
        if (seen !== key) this._invalid.value = undefined;
        this._decisions.settle(key, q.status === 'failed');
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
