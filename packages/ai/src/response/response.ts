import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { SourceRecord } from '../citation/citation.js';
import type { PublicError } from '../contracts/types.js';
import { announceEvent } from '../events.js';
import { strings } from '../internal/strings.js';
import { MarkdownView, type MarkdownOptions } from '../markdown/render.js';

export const RESPONSE_STRINGS = {
  streaming: 'Generating…',
  interrupted:
    'The connection ended before the response finished. What is shown may be incomplete.',
  cancelled: 'Stopped. The partial response is kept.',
  failed: 'The response failed.',
  copy: 'Copy response',
  copyCode: 'Copy code',
  copied: 'Copied to clipboard.',
  copyFailed: 'Copying failed.',
  image: 'Image',
};

export type ResponseStatus = 'streaming' | 'complete' | 'interrupted' | 'cancelled' | 'failed';

/**
 * Streamed rich text (Oddkin Markdown) with partial-output, completion, interruption, and error
 * states. The canonical source is `text`; rendering repairs incomplete syntax for display only,
 * and copy always uses `text`. Untrusted content stays inert: no HTML parsing, URL allow-list,
 * code rendered as text.
 *
 * @csspart content - The rendered Markdown.
 * @csspart status - Status line (generating, interrupted, stopped, failed).
 * @csspart actions - Copy action.
 * @cssprop --odd-response-code-background - Code block background.
 * @a11y Streaming text is not a live region (no per-token announcements); outcomes are announced by the surface's announcer. Committed blocks keep their DOM, so focus and selection inside them survive streaming.
 * @keyboard Code blocks and wide tables are scrollable and focusable.
 * @useFor Assistant output that may stream: answers, explanations, summaries.
 * @notFor User-authored text (render it literally) or trusted HTML.
 * @limitation Raw HTML renders as text unless `markdown.html` is `sanitize` with a host sanitizer. Images render as links unless `markdown.images` is `load`.
 * @category AI
 */
export class OddkinResponse extends OddkinElement.with({
  text: prop.string({
    default: '',
    attribute: false,
    description: 'Canonical Markdown source (property only).',
  }),
  status: prop.enum(['streaming', 'complete', 'interrupted', 'cancelled', 'failed'], {
    default: 'complete',
    reflect: true,
    description: 'Lifecycle of the text.',
  }),
  error: prop.object<PublicError>({ description: 'Error shown when `status` is failed.' }),
  sources: prop.array<SourceRecord>({
    description: 'Sources that `[^id]` citations resolve against.',
  }),
  markdown: prop.object<MarkdownOptions>({
    description: 'Renderer options: URL policy, sanitizer, highlighter, images.',
  }),
  copyable: prop.boolean({ description: 'Show a copy action for the whole response.' }),
  strings: prop.object<Partial<typeof RESPONSE_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal Bumps when rendered output changes (for tests and hosts measuring work). */
  readonly _renders = signal(0);
  #view: MarkdownView | undefined;
  #frame: number | undefined;
  readonly #citations = new Map<
    string,
    Set<HTMLElement & { source: SourceRecord | undefined; index: number }>
  >();

  /** @internal */
  get _strings(): typeof RESPONSE_STRINGS {
    return strings(RESPONSE_STRINGS, this.strings);
  }

  /** The canonical source currently rendered. */
  get renderedSource(): string {
    return this.#view?.source ?? '';
  }

  /** Copy the canonical source (never the rendered DOM text). */
  async copy(text = this.text): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      this.emit(announceEvent, {
        text: this._strings.copied,
        priority: 'polite',
        key: `copy:${Date.now()}`,
      });
      return true;
    } catch {
      this.emit(announceEvent, {
        text: this._strings.copyFailed,
        priority: 'polite',
        key: `copy-failed:${Date.now()}`,
      });
      return false;
    }
  }

  /** @internal */
  readonly _copy = (): void => void this.copy();

  protected override mounted(scope: Scope): void {
    const content = this.shadowRoot?.querySelector<HTMLElement>('[part="content"]');
    if (!content) return;
    this.#citations.clear();
    this.#view = new MarkdownView(content, this.#options());
    scope.add(() => {
      if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
      this.#frame = undefined;
      this.#view?.dispose();
      this.#view = undefined;
    }, 'markdown view');
    let first = true;
    scope.effect(
      () => {
        const options = this.markdown;
        void options;
        if (first) {
          first = false;
          return;
        }
        this.#citations.clear();
        this.#view?.configure(this.#options());
      },
      { phase: 'post', name: '<odd-response> options' },
    );
    scope.effect(
      () => {
        const text = this.text;
        const streaming = this.status === 'streaming';
        // Ingestion is immediate; DOM work is coalesced to one update per frame while streaming.
        if (streaming) {
          if (this.#frame === undefined)
            this.#frame = requestAnimationFrame(() => {
              this.#frame = undefined;
              this.#render(this.text, this.status === 'streaming');
            });
        } else {
          if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
          this.#frame = undefined;
          this.#render(text, false);
        }
      },
      { phase: 'post', name: '<odd-response> render' },
    );
    scope.effect(
      () => {
        const sources = this.sources;
        for (const [id, elements] of this.#citations) {
          const index = sources.findIndex((s) => s.sourceId === id);
          for (const el of elements) {
            el.source = sources[index];
            el.index = index + 1;
          }
        }
      },
      { phase: 'post', name: '<odd-response> citations' },
    );
  }

  #render(text: string, streaming: boolean): void {
    this.#view?.update(text, streaming);
    // Citations replaced by a re-rendered block are no longer updated.
    for (const [id, elements] of this.#citations) {
      for (const el of elements) if (!el.isConnected) elements.delete(el);
      if (!elements.size) this.#citations.delete(id);
    }
    this._renders.value = this._renders.peek() + 1;
  }

  #options(): MarkdownOptions {
    const t = this._strings;
    const doc = this.ownerDocument;
    return {
      imageLabel: t.image,
      ...this.markdown,
      citation: (id) => {
        const el = doc.createElement('odd-citation') as HTMLElement & {
          sourceId: string;
          source: SourceRecord | undefined;
          index: number;
        };
        const index = this.sources.findIndex((s) => s.sourceId === id);
        el.sourceId = id;
        el.source = this.sources[index];
        el.index = index + 1;
        let set = this.#citations.get(id);
        if (!set) this.#citations.set(id, (set = new Set()));
        set.add(el);
        return el;
      },
      codeActions: (code) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'text-button copy-code';
        button.textContent = t.copyCode;
        button.addEventListener('click', () => void this.copy(code));
        return button;
      },
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-response': OddkinResponse;
  }
}
