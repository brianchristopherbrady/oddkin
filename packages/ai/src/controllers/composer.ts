/**
 * `ComposerController` — draft, attachments, and submission state for a prompt composer.
 * Tracks draft revisions so acknowledging an older submission never clears newer input, keeps
 * the draft through failures, and owns only the object URLs it created. DOM-free (File and
 * URL APIs are used only when called). Contract: docs/architecture/ai-interaction.md §8.1.
 */
import { signal, type Readable, type Signal } from '@oddkin/core/reactive';
import type { PublicError } from '../contracts/types.js';
import { createId } from '../internal/ids.js';

export type AttachmentStatus =
  'selected' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed' | 'removed';

/** Serializable attachment state; the File itself is held separately (`file(id)`). */
export interface AttachmentState {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly mediaType: string;
  readonly status: AttachmentStatus;
  /** 0–1 when the host reports upload progress. */
  readonly progress?: number | undefined;
  /** Where the host stored it (after upload). */
  readonly url?: string | undefined;
  /** A preview URL this controller created and will revoke. */
  readonly previewUrl?: string | undefined;
  readonly error?: PublicError | undefined;
}

export type ComposerIssueCode =
  'ai.attachment.type' | 'ai.attachment.size' | 'ai.attachment.count' | 'ai.attachment.unavailable';

export interface ComposerIssue {
  readonly code: ComposerIssueCode;
  readonly name: string;
  readonly limit?: number | string | undefined;
}

export interface Submission {
  readonly submissionId: string;
  /** Draft revision captured at submission. */
  readonly revision: number;
  readonly text: string;
  readonly attachments: readonly AttachmentState[];
}

export interface ComposerState {
  readonly text: string;
  readonly revision: number;
  readonly attachments: readonly AttachmentState[];
  /** The in-flight or last failed submission. */
  readonly submission?:
    | { readonly submissionId: string; readonly revision: number; readonly status: 'submitting' }
    | {
        readonly submissionId: string;
        readonly revision: number;
        readonly status: 'failed';
        readonly error: PublicError;
      }
    | undefined;
  /** Validation feedback from the last attachment change. */
  readonly issues: readonly ComposerIssue[];
}

export interface ComposerOptions {
  /** MIME types, `type/*`, or `.ext` patterns, as in `<input accept>`. Empty accepts all. */
  readonly accept?: readonly string[];
  readonly maxFileSize?: number;
  readonly maxFiles?: number;
  /** Whether attachments are supported at all (capability). */
  readonly attachments?: boolean;
  readonly createId?: (prefix: string) => string;
  /** Create preview URLs for images (default true when `URL.createObjectURL` exists). */
  readonly previews?: boolean;
}

const BUSY: ReadonlySet<AttachmentStatus> = new Set(['uploading', 'processing']);

export function matchesAccept(
  file: { name: string; type: string },
  accept: readonly string[],
): boolean {
  if (!accept.length) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.some((raw) => {
    const pattern = raw.trim().toLowerCase();
    if (!pattern) return false;
    if (pattern.startsWith('.')) return name.endsWith(pattern);
    if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
}

export class ComposerController {
  readonly #state: Signal<ComposerState>;
  readonly state: Readable<ComposerState>;
  readonly #files = new Map<string, File>();
  readonly #ownedUrls = new Set<string>();
  #options: ComposerOptions;
  #disposed = false;

  constructor(options: ComposerOptions = {}) {
    this.#options = options;
    this.#state = signal<ComposerState>({ text: '', revision: 0, attachments: [], issues: [] });
    this.state = this.#state;
  }

  getSnapshot(): ComposerState {
    return this.#state.peek();
  }

  configure(options: ComposerOptions): void {
    this.#options = { ...this.#options, ...options };
  }

  /** Replace the draft text (user edit or host restore). Increments the draft revision. */
  setText(text: string): void {
    const now = this.#state.peek();
    if (now.text === text) return;
    this.#set({ ...now, text, revision: now.revision + 1 });
  }

  /** Validate and add files. Rejected files are reported in `issues` and never added. */
  addFiles(files: Iterable<File>): readonly AttachmentState[] {
    const now = this.#state.peek();
    const issues: ComposerIssue[] = [];
    const added: AttachmentState[] = [];
    if (this.#options.attachments === false) {
      for (const file of files) issues.push({ code: 'ai.attachment.unavailable', name: file.name });
      this.#set({ ...now, issues });
      return added;
    }
    const max = this.#options.maxFiles ?? Infinity;
    let count = now.attachments.length;
    for (const file of files) {
      if (!matchesAccept(file, this.#options.accept ?? [])) {
        issues.push({
          code: 'ai.attachment.type',
          name: file.name,
          limit: (this.#options.accept ?? []).join(', '),
        });
        continue;
      }
      if (this.#options.maxFileSize !== undefined && file.size > this.#options.maxFileSize) {
        issues.push({
          code: 'ai.attachment.size',
          name: file.name,
          limit: this.#options.maxFileSize,
        });
        continue;
      }
      if (count >= max) {
        issues.push({ code: 'ai.attachment.count', name: file.name, limit: max });
        continue;
      }
      count++;
      const id = (this.#options.createId ?? createId)('attachment');
      this.#files.set(id, file);
      const previewUrl = this.#preview(file);
      added.push({
        id,
        name: file.name,
        size: file.size,
        mediaType: file.type || 'application/octet-stream',
        status: 'selected',
        ...(previewUrl ? { previewUrl } : {}),
      });
    }
    this.#set({
      ...now,
      attachments: [...now.attachments, ...added],
      revision: added.length ? now.revision + 1 : now.revision,
      issues,
    });
    return added;
  }

  /** The runtime File for an attachment (never part of serializable state). */
  file(id: string): File | undefined {
    return this.#files.get(id);
  }

  /** Host-reported upload or processing progress. Ignored for removed attachments. */
  updateAttachment(
    id: string,
    update: Partial<Pick<AttachmentState, 'status' | 'progress' | 'url' | 'error'>>,
  ): void {
    const now = this.#state.peek();
    if (!now.attachments.some((a) => a.id === id)) return;
    this.#set({
      ...now,
      attachments: now.attachments.map((a) =>
        a.id === id ? ({ ...a, ...update } as AttachmentState) : a,
      ),
    });
  }

  removeAttachment(id: string): void {
    const now = this.#state.peek();
    const attachment = now.attachments.find((a) => a.id === id);
    if (!attachment) return;
    this.#release(attachment);
    this.#set({
      ...now,
      attachments: now.attachments.filter((a) => a.id !== id),
      revision: now.revision + 1,
      issues: [],
    });
  }

  clearIssues(): void {
    const now = this.#state.peek();
    if (now.issues.length) this.#set({ ...now, issues: [] });
  }

  /** Why the draft cannot be submitted now, or undefined when it can. */
  blocker(): 'empty' | 'submitting' | 'attachments-busy' | 'attachments-failed' | undefined {
    const now = this.#state.peek();
    if (now.submission?.status === 'submitting') return 'submitting';
    if (now.attachments.some((a) => BUSY.has(a.status))) return 'attachments-busy';
    if (now.attachments.some((a) => a.status === 'failed')) return 'attachments-failed';
    if (!now.text.trim() && !now.attachments.length) return 'empty';
    return undefined;
  }

  /**
   * Capture the draft as a submission. The draft stays in place (and editable) until the host
   * acknowledges acceptance; a failure leaves it untouched.
   */
  beginSubmit(): Submission | undefined {
    if (this.blocker()) return undefined;
    const now = this.#state.peek();
    const submission: Submission = {
      submissionId: (this.#options.createId ?? createId)('submission'),
      revision: now.revision,
      text: now.text,
      attachments: now.attachments,
    };
    this.#set({
      ...now,
      submission: {
        submissionId: submission.submissionId,
        revision: now.revision,
        status: 'submitting',
      },
    });
    return submission;
  }

  /**
   * The host accepted `submissionId`. Clears the submitted text only if the draft was not
   * edited since; attachments added after submission stay. Stale ids are ignored.
   */
  acknowledge(submissionId: string): boolean {
    const now = this.#state.peek();
    if (now.submission?.submissionId !== submissionId) return false;
    const submittedRevision = now.submission.revision;
    const edited = now.revision !== submittedRevision;
    const submittedIds = this.#submittedIds.get(submissionId);
    const remaining = edited ? now.attachments.filter((a) => !submittedIds?.has(a.id)) : [];
    for (const attachment of now.attachments)
      if (!remaining.includes(attachment)) this.#release(attachment);
    this.#submittedIds.delete(submissionId);
    this.#set({
      text: edited ? now.text : '',
      revision: now.revision + 1,
      attachments: remaining,
      submission: undefined,
      issues: [],
    });
    return true;
  }
  readonly #submittedIds = new Map<string, Set<string>>();

  /** The host rejected `submissionId`. The draft and attachments are preserved. */
  fail(submissionId: string, error: PublicError): boolean {
    const now = this.#state.peek();
    if (now.submission?.submissionId !== submissionId) return false;
    this.#set({
      ...now,
      submission: { submissionId, revision: now.submission.revision, status: 'failed', error },
    });
    return true;
  }

  /** Abandon the pending submission locally (e.g. the host cancelled it before acceptance). */
  cancel(submissionId: string): boolean {
    const now = this.#state.peek();
    if (now.submission?.submissionId !== submissionId) return false;
    this.#set({ ...now, submission: undefined });
    return true;
  }

  /** Revoke owned preview URLs and drop File references. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const url of this.#ownedUrls) URL.revokeObjectURL(url);
    this.#ownedUrls.clear();
    this.#files.clear();
  }

  /** Number of object URLs this controller currently owns (for leak tests). */
  get ownedUrlCount(): number {
    return this.#ownedUrls.size;
  }

  /** Revoke owned preview URLs (e.g. while a view is disconnected); the files are kept. */
  releasePreviews(): void {
    const now = this.#state.peek();
    if (!now.attachments.some((a) => a.previewUrl && this.#ownedUrls.has(a.previewUrl))) return;
    this.#set({
      ...now,
      attachments: now.attachments.map((a) => {
        if (!a.previewUrl || !this.#ownedUrls.delete(a.previewUrl)) return a;
        URL.revokeObjectURL(a.previewUrl);
        const { previewUrl: _released, ...rest } = a;
        return rest;
      }),
    });
  }

  /** Recreate previews released by `releasePreviews`. */
  restorePreviews(): void {
    if (this.#disposed) return;
    const now = this.#state.peek();
    let changed = false;
    const attachments = now.attachments.map((a) => {
      const file = this.#files.get(a.id);
      if (a.previewUrl || !file) return a;
      const previewUrl = this.#preview(file);
      if (!previewUrl) return a;
      changed = true;
      return { ...a, previewUrl };
    });
    if (changed) this.#set({ ...now, attachments });
  }

  #preview(file: File): string | undefined {
    if (this.#options.previews === false || !file.type.startsWith('image/')) return undefined;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined;
    const url = URL.createObjectURL(file);
    this.#ownedUrls.add(url);
    return url;
  }

  #release(attachment: AttachmentState): void {
    this.#files.delete(attachment.id);
    // Only URLs this controller created; host-provided URLs are never revoked.
    if (attachment.previewUrl && this.#ownedUrls.delete(attachment.previewUrl))
      URL.revokeObjectURL(attachment.previewUrl);
  }

  #set(next: ComposerState): void {
    if (
      next.submission?.status === 'submitting' &&
      !this.#submittedIds.has(next.submission.submissionId)
    )
      this.#submittedIds.set(
        next.submission.submissionId,
        new Set(next.attachments.map((a) => a.id)),
      );
    this.#state.value = next;
  }
}
