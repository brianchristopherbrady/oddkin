import { OddkinElement, prop } from '@oddkin/core/element';
import { signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { can, unavailableReason } from '../contracts/normalize.js';
import type { Capabilities, PublicError } from '../contracts/types.js';
import {
  ComposerController,
  type ComposerIssue,
  type ComposerState,
} from '../controllers/composer.js';
import {
  announceEvent,
  attachmentAddEvent,
  attachmentRemoveEvent,
  promptStopEvent,
  promptSubmitEvent,
} from '../events.js';
import { format, formatNumber, langOf, strings } from '../internal/strings.js';

export const PROMPT_INPUT_STRINGS = {
  label: 'Message',
  placeholder: 'Ask anything',
  send: 'Send',
  stop: 'Stop',
  attach: 'Attach files',
  remove: 'Remove {name}',
  hintSend: 'Enter sends. Shift+Enter adds a line.',
  hintNewline: 'Ctrl+Enter or ⌘+Enter sends. Enter adds a line.',
  sending: 'Sending…',
  failed: '{message} Your message was kept; you can edit it and send again.',
  busyAttachments: 'Wait for attachments to finish uploading.',
  failedAttachments: 'Remove or replace attachments that failed.',
  unavailable: 'Sending is not available.',
  dropHere: 'Drop files to attach them',
  'ai.attachment.type': '{name} is not an accepted file type.',
  'ai.attachment.size': '{name} is larger than {limit}.',
  'ai.attachment.count': 'You can attach up to {limit} files.',
  'ai.attachment.unavailable': 'Attachments are not available.',
  selected: 'Selected',
  uploading: 'Uploading {progress}',
  uploaded: 'Uploaded',
  processing: 'Processing…',
  ready: 'Ready',
  failedStatus: 'Failed',
  removed: 'Removed',
};

/**
 * The prompt composer: an expanding text area with attachments (button, paste, and drop),
 * toolbar slots, send and stop, and a draft that survives failures. Submission is a cancelable
 * request; the host acknowledges or fails it by id, and acknowledging an older submission never
 * clears newer edits. IME composition never submits.
 *
 * @slot above - Content above the input (suggestions, context).
 * @slot toolbar-start - Controls before the attach button (model picker, commands).
 * @slot toolbar-end - Controls before the send button (voice input).
 * @csspart form - The native form.
 * @csspart input - The native text area.
 * @csspart attachments - Attachment list.
 * @csspart toolbar - Toolbar row.
 * @csspart status - Submission status and errors.
 * @cssprop --odd-prompt-input-max-height - Maximum height before the text area scrolls.
 * @a11y The text area is labelled (`label`) and described by the keyboard hint, validation issues, and submission status. Send and stop are native buttons; unavailable actions explain why.
 * @keyboard Enter sends and Shift+Enter inserts a line break (or Ctrl/⌘+Enter sends with `enter-behavior="newline"`). Keys during IME composition never send.
 * @useFor The input of a conversation or assistant.
 * @notFor Single-line form fields; use `odd-input`.
 * @limitation Mentions and slash commands are host integrations through the slots and the `input` part; the composer does not parse them.
 * @category AI
 */
export class OddkinPromptInput extends OddkinElement.with({
  controller: prop.object<ComposerController>({
    description: 'Host-owned composer controller; otherwise the element owns one.',
  }),
  label: prop.string({
    default: '',
    description: 'Accessible label; defaults to the localized "Message".',
  }),
  placeholder: prop.string({
    default: '',
    description: 'Placeholder; never a substitute for the label.',
  }),
  disabled: prop.boolean({ reflect: true, description: 'Prevents editing and sending.' }),
  busy: prop.boolean({
    reflect: true,
    description: 'Work is running; shows Stop instead of Send when stopping is available.',
  }),
  attemptId: prop.string({
    default: '',
    attribute: 'attempt-id',
    description: 'Attempt targeted by Stop.',
  }),
  capabilities: prop.object<Capabilities>({
    description: '`send`, `stop`, and `attachments` decide which controls are enabled.',
  }),
  accept: prop.string({
    default: '',
    description: 'Accepted attachment types (comma-separated, as `<input accept>`).',
  }),
  maxFileSize: prop.number({
    default: 0,
    attribute: 'max-file-size',
    description: 'Maximum attachment size in bytes (0: no limit).',
  }),
  maxFiles: prop.number({
    default: 0,
    attribute: 'max-files',
    description: 'Maximum attachments (0: no limit).',
  }),
  enterBehavior: prop.enum(['send', 'newline'], {
    default: 'send',
    attribute: 'enter-behavior',
    description: 'What Enter does.',
  }),
  strings: prop.object<Partial<typeof PROMPT_INPUT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = {
    'prompt-submit': promptSubmitEvent,
    'prompt-stop': promptStopEvent,
    'attachment-add': attachmentAddEvent,
    'attachment-remove': attachmentRemoveEvent,
    'ai-announce': announceEvent,
  };

  #owned: ComposerController | undefined;
  #composing = false;
  /** @internal Mirror of the composer state for the template. */
  readonly _state = signal<ComposerState>({ text: '', revision: 0, attachments: [], issues: [] });
  /** @internal A blocked send attempt's explanation. */
  readonly _blocked = signal('');
  /** @internal Files are being dragged over. */
  readonly _dragging = signal(false);

  /** @internal */
  get _strings(): typeof PROMPT_INPUT_STRINGS {
    return strings(PROMPT_INPUT_STRINGS, this.strings);
  }

  /** The composer in use (host-supplied or owned). */
  get activeController(): ComposerController {
    return this.controller ?? (this.#owned ??= new ComposerController());
  }

  /** The draft text. Setting it never dispatches events. */
  get value(): string {
    return this.activeController.getSnapshot().text;
  }
  set value(text: string) {
    this.activeController.setText(String(text ?? ''));
  }

  /** The host accepted a submission; clears the submitted draft unless it was edited since. */
  acknowledge(submissionId: string): boolean {
    return this.activeController.acknowledge(submissionId);
  }

  /** The host rejected a submission; the draft is kept and the error shown. */
  fail(submissionId: string, error: PublicError): boolean {
    const failed = this.activeController.fail(submissionId, error);
    if (failed)
      this.emit(announceEvent, {
        text: error.message,
        priority: 'assertive',
        key: `submit-failed:${submissionId}`,
      });
    return failed;
  }

  /** @internal Why sending is not possible right now (empty string: just empty). */
  _sendBlocker(state: ComposerState): string | undefined {
    const t = this._strings;
    if (this.disabled) return '';
    if (!can(this.capabilities ?? { send: { available: true } }, 'send'))
      return unavailableReason(this.capabilities, 'send') ?? t.unavailable;
    const blocker = this.activeController.blocker();
    if (blocker === 'attachments-busy') return t.busyAttachments;
    if (blocker === 'attachments-failed') return t.failedAttachments;
    if (blocker || (!state.text.trim() && !state.attachments.length)) return '';
    if (this.busy) return '';
    return undefined;
  }

  /** @internal */
  _attachmentsAvailable(): boolean {
    return this.capabilities ? can(this.capabilities, 'attachments') : true;
  }

  /** @internal */
  _issue(issue: ComposerIssue): string {
    const t = this._strings;
    const limit =
      issue.code === 'ai.attachment.size' && typeof issue.limit === 'number'
        ? this._bytes(issue.limit)
        : String(issue.limit ?? '');
    return format(t[issue.code], { name: issue.name, limit });
  }

  /** @internal */
  _bytes(size: number): string {
    const locale = langOf(this);
    if (size < 1024) return `${formatNumber(size, locale)} B`;
    if (size < 1024 * 1024) return `${formatNumber(Math.round(size / 1024), locale)} KB`;
    return `${formatNumber(Math.round(size / 104857.6) / 10, locale)} MB`;
  }

  /** @internal */
  readonly _onInput = (event: Event): void => {
    const area = event.target as HTMLTextAreaElement;
    this.activeController.setText(area.value);
    this._blocked.value = '';
    this.#resize(area);
  };
  /** @internal */
  readonly _onCompositionStart = (): void => {
    this.#composing = true;
  };
  /** @internal */
  readonly _onCompositionEnd = (): void => {
    this.#composing = false;
  };
  /** @internal */
  readonly _onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    // IME: the Enter that confirms a composition must not send (keyCode 229 covers Safari).
    if (event.isComposing || this.#composing || event.keyCode === 229) return;
    const modifier = event.ctrlKey || event.metaKey;
    const sends =
      this.enterBehavior === 'send' ? !event.shiftKey && !modifier && !event.altKey : modifier;
    if (!sends) return;
    event.preventDefault();
    this._submit();
  };
  /** @internal */
  readonly _onSubmit = (event: Event): void => {
    event.preventDefault();
    this._submit();
  };

  /** Request submission of the draft (same as pressing Send). Returns the submission id. */
  submit(): string | undefined {
    return this._submit();
  }

  /** @internal */
  _submit(): string | undefined {
    const controller = this.activeController;
    const blocker = this._sendBlocker(controller.getSnapshot());
    if (blocker !== undefined) {
      this._blocked.value = blocker;
      if (blocker)
        this.emit(announceEvent, {
          text: blocker,
          priority: 'polite',
          key: `blocked:${Date.now()}`,
        });
      return undefined;
    }
    const submission = controller.beginSubmit();
    if (!submission) return undefined;
    const accepted = this.emit(promptSubmitEvent, {
      submissionId: submission.submissionId,
      revision: submission.revision,
      text: submission.text,
      attachments: submission.attachments,
    });
    if (!accepted) {
      controller.cancel(submission.submissionId);
      return undefined;
    }
    return submission.submissionId;
  }

  /** @internal */
  readonly _stop = (): void => {
    this.emit(promptStopEvent, { attemptId: this.attemptId || undefined });
  };
  /** @internal */
  readonly _pick = (): void => {
    this.shadowRoot?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  };
  /** @internal */
  readonly _onFiles = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.#add([...(input.files ?? [])]);
    input.value = '';
  };
  /** @internal */
  readonly _onPaste = (event: ClipboardEvent): void => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (!files.length) return;
    // Pasted text still pastes; pasted files become attachments.
    if (!event.clipboardData?.getData('text')) event.preventDefault();
    this.#add(files);
  };
  /** @internal */
  readonly _onDragOver = (event: DragEvent): void => {
    if (
      !event.dataTransfer?.types.includes('Files') ||
      !this._attachmentsAvailable() ||
      this.disabled
    )
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this._dragging.value = true;
  };
  /** @internal */
  readonly _onDragLeave = (event: DragEvent): void => {
    if (!event.relatedTarget || !this.shadowRoot?.contains(event.relatedTarget as Node))
      this._dragging.value = false;
  };
  /** @internal */
  readonly _onDrop = (event: DragEvent): void => {
    this._dragging.value = false;
    const files = [...(event.dataTransfer?.files ?? [])];
    if (!files.length) return;
    event.preventDefault();
    this.#add(files);
  };
  /** @internal */
  readonly _remove = (event: Event): void => {
    const attachmentId = (event.currentTarget as HTMLElement).dataset['id'];
    if (!attachmentId) return;
    this.activeController.removeAttachment(attachmentId);
    this.emit(attachmentRemoveEvent, { attachmentId });
    this.shadowRoot?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  };

  #add(files: File[]): void {
    if (!files.length || this.disabled) return;
    const controller = this.activeController;
    controller.configure({
      accept: this.accept ? this.accept.split(',') : [],
      ...(this.maxFileSize > 0 ? { maxFileSize: this.maxFileSize } : {}),
      ...(this.maxFiles > 0 ? { maxFiles: this.maxFiles } : {}),
      attachments: this._attachmentsAvailable(),
    });
    const added = controller.addFiles(files);
    if (added.length) this.emit(attachmentAddEvent, { attachments: added });
    const issues = controller.getSnapshot().issues;
    if (issues.length)
      this.emit(announceEvent, {
        text: issues.map((i) => this._issue(i)).join(' '),
        priority: 'polite',
        key: `issues:${Date.now()}`,
      });
  }

  #resize(area: HTMLTextAreaElement): void {
    area.style.blockSize = 'auto';
    area.style.blockSize = `${area.scrollHeight}px`;
  }

  protected override connected(scope: Scope): void {
    scope.effect(
      (run) => {
        const controller = this.activeController;
        controller.restorePreviews();
        const state: Readable<ComposerState> = controller.state;
        run.effect(() => {
          this._state.value = state.value;
        });
        // Owned previews are view resources: released while disconnected, recreated on reconnect.
        if (controller === this.#owned)
          run.add(() => controller.releasePreviews(), 'composer previews');
      },
      { name: '<odd-prompt-input> composer' },
    );
  }

  protected override updated(): void {
    const area = this.shadowRoot?.querySelector('textarea');
    if (area) this.#resize(area);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-prompt-input': OddkinPromptInput;
  }
}
