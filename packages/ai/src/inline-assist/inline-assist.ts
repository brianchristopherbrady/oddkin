import { RovingFocus } from '@oddkin/core/controllers/focus';
import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { PublicError } from '../contracts/types.js';
import type { TextSelection } from '../controllers/document.js';
import { assistRequestEvent } from '../events.js';
import { format, strings } from '../internal/strings.js';
import { MarkdownView, type MarkdownOptions } from '../markdown/render.js';

export const INLINE_ASSIST_STRINGS = {
  label: 'Assist with the selection',
  rewrite: 'Rewrite',
  explain: 'Explain',
  summarize: 'Summarize',
  translate: 'Translate',
  expand: 'Expand',
  language: 'Translate to',
  noSelection: 'Select text to get help with it.',
  stale: 'The text changed after you selected it. Select it again.',
  pending: 'Working on “{action}”…',
  failed: 'Assistance failed: {message}',
  selected: '{count} characters selected',
};

export interface AssistActionOption {
  readonly id: string;
  readonly label: string;
}

/**
 * Selection-based assistance: rewrite, explain, summarize, translate, and expand (or host
 * actions). Requests carry the selection with its content revision, so results can be checked
 * against the text they were made for. Rewrites become proposals for `odd-change-review`;
 * explanations and summaries show in the result area.
 *
 * @csspart toolbar - The action toolbar.
 * @csspart result - Result text (Markdown, rendered inertly).
 * @a11y An ARIA toolbar: one tab stop, arrow keys move between actions. Pending and stale states are text.
 * @keyboard Left/Right (or Up/Down) move between actions; Home/End go to the first/last; Enter or Space activates.
 * @useFor Contextual help on selected text in editors and documents.
 * @notFor Whole-document chat; use the conversation.
 * @category AI
 */
export class OddkinInlineAssist extends OddkinElement.with({
  selection: prop.object<TextSelection>({
    description: 'Captured selection with its content revision.',
  }),
  documentRevision: prop.string({
    default: '',
    attribute: 'document-revision',
    description: 'Current content revision; a different selection revision is stale.',
  }),
  actions: prop.array<AssistActionOption>({
    description: 'Actions to offer; defaults to the five built-ins.',
  }),
  languages: prop.array<AssistActionOption>({
    description: 'Target languages for translate (`id` = BCP 47 tag).',
  }),
  status: prop.enum(['idle', 'pending', 'ready', 'failed'], {
    default: 'idle',
    reflect: true,
    description: 'Host-reported request state.',
  }),
  pendingAction: prop.string({
    default: '',
    attribute: 'pending-action',
    description: 'Action in progress.',
  }),
  result: prop.string({
    default: '',
    attribute: false,
    description: 'Explanation or summary text (Markdown).',
  }),
  error: prop.object<PublicError>({ description: 'Shown when `status` is failed.' }),
  markdown: prop.object<MarkdownOptions>({ description: 'Options for rendering `result`.' }),
  strings: prop.object<Partial<typeof INLINE_ASSIST_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'assist-request': assistRequestEvent };

  /** @internal Roving tab stop (presentation state). */
  readonly _active = signal(0);
  /** @internal */
  readonly _language = signal('');

  /** @internal */
  get _strings(): typeof INLINE_ASSIST_STRINGS {
    return strings(INLINE_ASSIST_STRINGS, this.strings);
  }

  /** @internal */
  get _actions(): readonly AssistActionOption[] {
    if (this.actions.length) return this.actions;
    const t = this._strings;
    return (['rewrite', 'explain', 'summarize', 'translate', 'expand'] as const).map((id) => ({
      id,
      label: t[id],
    }));
  }

  /** @internal Why actions are unavailable. */
  get _blocked(): string | undefined {
    const t = this._strings;
    if (!this.selection) return t.noSelection;
    if (this.documentRevision && this.selection.revision !== this.documentRevision) return t.stale;
    return undefined;
  }

  /** @internal */
  readonly _request = (event: Event): void => {
    const action = (event.currentTarget as HTMLElement).dataset['action'] as string;
    const selection = this.selection;
    if (!selection || this._blocked || this.status === 'pending') return;
    const language = this._language.peek() || this.languages[0]?.id;
    this.emit(assistRequestEvent, {
      action,
      selection,
      options: action === 'translate' && language ? { language } : {},
    });
  };
  /** @internal */
  readonly _onLanguage = (event: Event): void => {
    this._language.value = (event.target as HTMLSelectElement).value;
  };
  /** @internal */
  _pendingText(): string {
    const label =
      this._actions.find((a) => a.id === this.pendingAction)?.label ?? this.pendingAction;
    return format(this._strings.pending, { action: label });
  }

  protected override mounted(scope: Scope): void {
    // APG toolbar: one tab stop; unavailable actions stay focusable (aria-disabled), so none
    // are skipped. The template renders tabindex from `_active`.
    const toolbar = this.shadowRoot?.querySelector<HTMLElement>('[part="toolbar"]');
    scope.use(
      new RovingFocus({
        target: () => toolbar,
        items: () => [...(toolbar?.querySelectorAll<HTMLElement>('button') ?? [])],
        orientation: 'both',
        skip: () => false,
        onActiveChange: (index) => (this._active.value = index),
      }),
    );
    const result = this.shadowRoot?.querySelector<HTMLElement>('[part="result"] .content');
    if (!result) return;
    const view = new MarkdownView(result, this.markdown ?? {});
    scope.add(() => view.dispose(), 'markdown view');
    scope.effect(
      () => {
        const options = this.markdown;
        void options;
        view.configure(this.markdown ?? {});
      },
      { phase: 'post', name: '<odd-inline-assist> options' },
    );
    scope.effect(() => view.update(this.result, this.status === 'pending'), {
      phase: 'post',
      name: '<odd-inline-assist> result',
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-inline-assist': OddkinInlineAssist;
  }
}
