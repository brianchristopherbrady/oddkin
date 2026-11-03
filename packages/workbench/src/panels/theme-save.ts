/**
 * Theme Studio's save to file through the dev server (workbench.md §9): the diff of the draft
 * against the theme file first, then the write the reader confirms. Loaded only when the page
 * data offers it (`studio.save`), so a site that embeds the panel never loads it.
 */
import { signal } from '@oddkin/core/reactive';
import { html, nothing } from '@oddkin/core/template';

interface Reply {
  readonly file: string;
  /** The file's content the diff was made from; a write must name it. */
  readonly version: string;
  readonly lines: readonly string[];
  readonly written?: boolean;
}

export class ThemeSave {
  /** The diff shown, and the draft it was made for, which a confirmed write saves. */
  readonly #shown = signal<{ readonly reply: Reply; readonly config: unknown } | undefined>(
    undefined,
  );
  readonly #status = signal({ text: '', alert: false });

  constructor(
    readonly target: { readonly file: string; readonly url: string },
    readonly draft: () => unknown,
  ) {}

  /** A newer draft makes the diff shown out of date. */
  discard(): void {
    this.#shown.value = undefined;
    this.#status.value = { text: '', alert: false };
  }

  async #post(request: object): Promise<{ status: number; reply: Reply | undefined }> {
    const response = await fetch(this.target.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const json = (response.headers.get('content-type') ?? '').includes('json');
    if (!json && response.status !== 200) throw new Error(await response.text());
    return {
      status: response.status,
      reply: json ? ((await response.json()) as Reply) : undefined,
    };
  }

  #fail(error: unknown): void {
    this.#status.value = {
      text: `Not saved: ${error instanceof Error ? error.message : String(error)}`,
      alert: true,
    };
  }

  /** Show what writing the draft would change. */
  async review(): Promise<void> {
    const config = this.draft();
    const { file } = this.target;
    try {
      const { reply } = await this.#post({ config });
      // A newer draft made this review out of date while it was on its way.
      if (this.draft() !== config) return;
      if (!reply) throw new Error('the dev server did not answer with a diff.');
      if (!reply.lines.length) {
        this.#shown.value = undefined;
        this.#status.value = { text: `${file} already holds this draft.`, alert: false };
        return;
      }
      this.#shown.value = { reply, config };
      this.#status.value = { text: `Review the changes to ${file}, then write it.`, alert: false };
    } catch (error) {
      this.#fail(error);
    }
  }

  /** Write the draft the diff was made for, if the file is still what the diff was made from. */
  async write(): Promise<void> {
    const shown = this.#shown.peek();
    if (!shown) return;
    const { file } = this.target;
    try {
      const { status, reply } = await this.#post({
        config: shown.config,
        version: shown.reply.version,
        write: true,
      });
      if (status === 409 && reply) {
        if (this.#shown.peek() !== shown) return;
        this.#shown.value = { reply, config: shown.config };
        this.#status.value = {
          text: `${file} changed on disk after the diff was shown: review the new diff.`,
          alert: true,
        };
        return;
      }
      if (!reply?.written) throw new Error(`the dev server answered ${status}.`);
      this.#shown.value = undefined;
      this.#status.value = { text: `Saved ${file}.`, alert: false };
    } catch (error) {
      this.#fail(error);
    }
  }

  /**
   * `review` and `write` say why each cannot happen now, or are ''. A diff needs only the draft
   * the page shows, so a click that ends an edit still reviews it; a write also needs the
   * generator to have accepted that draft, as an export does.
   */
  render(review: string, write: string) {
    const { file } = this.target;
    const shown = this.#shown.value;
    const status = this.#status.value;
    return html`<div class="wb-toolbar">
        <button
          type="button"
          ?disabled=${!!review}
          aria-describedby="ts-export-note"
          @click=${() => void this.review()}
        >
          Save to ${file}…
        </button>
      </div>
      ${
        shown
          ? html`<section class="wb-diff" aria-label=${`Changes to ${file}`}>
              <pre class="wb-code">${shown.reply.lines.join('\n')}</pre>
              <div class="wb-toolbar">
                <button
                  type="button"
                  ?disabled=${!!write}
                  aria-describedby="ts-export-note"
                  @click=${() => void this.write()}
                >
                  Write ${file}
                </button>
                <button type="button" @click=${() => this.discard()}>Cancel</button>
              </div>
            </section>`
          : nothing
      }
      <p class="wb-status" role=${status.alert ? 'alert' : 'status'}>${status.text}</p>`;
  }
}
