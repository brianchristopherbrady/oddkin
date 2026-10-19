import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import { can } from '../contracts/normalize.js';
import type {
  ApprovalRecord,
  ArtifactRecord,
  AttemptRecord,
  BranchPosition,
  Capabilities,
  FeedbackRecord,
  JsonValue,
  MessagePart,
  MessageRecord,
  PartOf,
  ToolCallRecord,
} from '../contracts/types.js';
import type { ArtifactRenderer } from '../artifact/artifact.js';
import type { ResponseStatus } from '../response/response.js';
import type { ToolOutputRenderer } from '../tool-call/tool-call.js';
import { announceEvent, messageEditEvent, messageRegenerateEvent } from '../events.js';
import { revealSourceEvent } from '../citation/citation.js';
import { format, strings } from '../internal/strings.js';
import type { MarkdownOptions } from '../markdown/render.js';
import type { Scope } from '@oddkin/core/scope';

export const MESSAGE_STRINGS = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
  reasoning: 'Reasoning',
  copy: 'Copy',
  copied: 'Copied to clipboard.',
  copyFailed: 'Copying failed.',
  regenerate: 'Regenerate',
  edit: 'Edit',
  save: 'Send edited message',
  cancel: 'Cancel',
  editLabel: 'Edit your message',
  unsupported: 'This message contains content ({type}) that can’t be shown here.',
  toolMissing: 'A tool call is referenced but its record is missing.',
  approvalMissing: 'An approval is referenced but its record is missing.',
  artifactMissing: 'An artifact is referenced but its record is missing.',
  dataInvalid: 'Structured content “{name}” was not shown because it did not pass validation.',
  file: 'Attachment',
};

/** A registered renderer for `data` parts: validates untrusted data before rendering it. */
export interface DataRenderer {
  validate(data: JsonValue): boolean;
  render(data: JsonValue, part: PartOf<'data'>): Node;
}

/**
 * One message: its role, structured parts in order (text, reasoning, files, sources, tools,
 * approvals, artifacts, data), and message actions (copy, regenerate, edit, versions,
 * feedback, provenance). Parts with unknown types or missing records render explicit fallbacks.
 *
 * @csspart header - Role label and provenance.
 * @csspart content - The parts.
 * @csspart footer - Actions, versions, and feedback.
 * @a11y The role label is visible text. Inside `odd-conversation` the host element is a feed article. Editing moves focus into the edit field only after the user chooses Edit, and back to Edit when cancelled.
 * @keyboard Tab through actions; Escape cancels editing.
 * @useFor Rendering a message from a conversation record.
 * @notFor Free-form chat bubbles without records.
 * @category AI
 */
export class OddkinMessage extends OddkinElement.with({
  message: prop.object<MessageRecord>({ description: 'The message record.' }),
  attempt: prop.object<AttemptRecord>({
    description: 'The attempt that writes this (assistant) message.',
  }),
  tools: prop.object<Readonly<Record<string, ToolCallRecord>>>({
    description: 'Tool call records by id.',
  }),
  approvals: prop.object<Readonly<Record<string, ApprovalRecord>>>({
    description: 'Approval records by id.',
  }),
  artifacts: prop.object<Readonly<Record<string, ArtifactRecord>>>({
    description: 'Artifact records by id.',
  }),
  branch: prop.object<BranchPosition>({ description: 'Position among alternative versions.' }),
  feedback: prop.object<FeedbackRecord>({ description: 'Feedback record for this message.' }),
  capabilities: prop.object<Capabilities>({
    description: 'Enables regenerate, edit, branches, feedback, approvals.',
  }),
  markdown: prop.object<MarkdownOptions>({ description: 'Markdown rendering options.' }),
  renderers: prop.object<Readonly<Record<string, DataRenderer>>>({
    description: 'Validated renderers for `data` parts by name.',
  }),
  artifactRenderers: prop.object<Readonly<Record<string, ArtifactRenderer>>>({
    description: 'Artifact renderers by kind.',
  }),
  toolRenderer: prop.object<{ render: ToolOutputRenderer }>({
    description: 'Renderer for tool results.',
  }),
  feedbackReasons: prop.array<string>({ description: 'Reasons offered for negative feedback.' }),
  strings: prop.object<Partial<typeof MESSAGE_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'message-edit': messageEditEvent,
    'message-regenerate': messageRegenerateEvent,
    'ai-announce': announceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinMessage>;

  /** @internal Inline edit draft (presentation state); undefined when not editing. */
  readonly _editing = signal<string | undefined>(undefined);

  /** @internal */
  get _strings(): typeof MESSAGE_STRINGS {
    return strings(MESSAGE_STRINGS, this.strings);
  }

  /** Canonical text of the message (text parts joined), as copied. */
  get text(): string {
    return (this.message?.parts ?? [])
      .filter((p): p is PartOf<'text'> => p.type === 'text')
      .map((p) => p.text)
      .join('\n\n');
  }

  /** @internal */
  get _sources(): PartOf<'source'>[] {
    return (this.message?.parts ?? []).filter((p): p is PartOf<'source'> => p.type === 'source');
  }

  /** @internal Display status for a text part. */
  _textStatus(part: MessagePart, last: boolean): ResponseStatus {
    if ((part.type === 'text' || part.type === 'reasoning') && part.state === 'streaming')
      return 'streaming';
    const status = this.attempt?.status;
    if (last && (status === 'interrupted' || status === 'cancelled' || status === 'failed'))
      return status;
    if (last && (status === 'streaming' || status === 'submitted' || status === 'accepted'))
      return 'streaming';
    return 'complete';
  }

  /** @internal */
  _data(part: PartOf<'data'>): Node | undefined {
    const renderer = this.renderers?.[part.name];
    if (!renderer) return undefined;
    try {
      return renderer.validate(part.data) ? renderer.render(part.data, part) : undefined;
    } catch {
      return undefined;
    }
  }

  /** @internal */
  _can(name: 'regenerate' | 'edit' | 'feedback'): boolean {
    return can(this.capabilities, name);
  }

  /** @internal */
  readonly _copy = async (): Promise<void> => {
    const t = this._strings;
    try {
      await navigator.clipboard.writeText(this.text);
      this.emit(announceEvent, { text: t.copied, priority: 'polite', key: `copy:${Date.now()}` });
    } catch {
      this.emit(announceEvent, {
        text: t.copyFailed,
        priority: 'polite',
        key: `copy-failed:${Date.now()}`,
      });
    }
  };
  /** @internal */
  readonly _regenerate = (): void => {
    const m = this.message;
    if (m?.attemptId && this._can('regenerate'))
      this.emit(messageRegenerateEvent, { messageId: m.id, attemptId: m.attemptId });
  };
  /** @internal */
  readonly _startEdit = (): void => {
    this._editing.value = this.text;
    void this.updateComplete.then(() =>
      this.shadowRoot?.querySelector<HTMLTextAreaElement>('.edit textarea')?.focus(),
    );
  };
  /** @internal */
  readonly _onEditInput = (event: Event): void => {
    this._editing.value = (event.target as HTMLTextAreaElement).value;
  };
  /** @internal */
  readonly _cancelEdit = (): void => {
    this._editing.value = undefined;
    void this.updateComplete.then(() =>
      this.shadowRoot?.querySelector<HTMLElement>('[data-action="edit"]')?.focus(),
    );
  };
  /** @internal */
  readonly _saveEdit = (event: Event): void => {
    event.preventDefault();
    const m = this.message;
    const text = this._editing.peek()?.trim();
    if (!m || !text) return;
    this._editing.value = undefined;
    this.emit(messageEditEvent, { messageId: m.id, text });
  };
  /** @internal */
  readonly _onEditKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this._cancelEdit();
    }
  };

  protected override connected(scope: Scope): void {
    // Default action of an uncancelled citation-open: reveal the source in this message.
    scope.listen(this, revealSourceEvent.type, (event: CustomEvent<{ sourceId: string }>) => {
      const sources = this.shadowRoot?.querySelector('odd-sources');
      if (sources && sources.reveal(event.detail.sourceId)) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  }

  /** @internal */
  _unsupported(type: string): string {
    return format(this._strings.unsupported, { type });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-message': OddkinMessage;
  }
}
