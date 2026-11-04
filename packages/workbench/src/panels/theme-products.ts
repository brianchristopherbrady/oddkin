/**
 * Theme Studio's products (P1.5 item 4, multi-product.md §3), for a theme on base files (P1.1
 * `extends`): the picker of the file to edit, and which products an edit to a base changes. Each
 * product on the base is generated twice, on the base as loaded and as edited, in a Worker of its
 * own, and the two CSS texts compared, so a product that sets a changed value itself counts as
 * unchanged. Loaded only when the page lists the theme's files, so a theme of one file never
 * loads it.
 */
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { html, nothing } from '@oddkin/core/template';
import type { ThemeStudioFile } from '../data/types.js';
import type { ThemeBase } from './theme-model.js';

/** What the panel shares with its products. */
export interface ProductsHost {
  readonly files: readonly ThemeStudioFile[];
  /** The file edited; a render that reads it follows it. */
  readonly file: string;
  draft(file: string): unknown;
  /** The files `file` builds on, root base first, each with its draft. */
  bases(file: string): readonly ThemeBase[];
  open(file: string): void;
}

interface Impact {
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
}

export class ThemeProducts {
  readonly #impact = signal<Impact | undefined>(undefined);
  readonly #waiting = new Map<number, (css: string | undefined) => void>();
  #worker: Worker | undefined;
  #id = 0;
  #run = 0;

  /** `worker` is Theme Studio's generation worker; checks use their own, as long as `scope`. */
  constructor(
    readonly worker: string,
    readonly scope: Scope,
    readonly host: ProductsHost,
  ) {}

  /** Products: the theme's files no other file builds on. */
  #products(): string[] {
    const files = this.host.files;
    return files.filter((f) => !files.some((g) => g.base === f.file)).map((f) => f.file);
  }

  /** The products built on `file`. */
  #dependents(file: string): string[] {
    return this.#products().filter((p) => this.host.bases(p).some((base) => base.file === file));
  }

  /** The CSS of `draft` on `bases`, or undefined when the generator refuses it. */
  #css(draft: unknown, bases: readonly unknown[]): Promise<string | undefined> {
    if (!this.#worker) {
      const worker = new Worker(this.worker, { type: 'module', name: 'oddkin-theme-products' });
      this.#worker = worker;
      this.scope.add(() => worker.terminate(), 'theme products worker');
      this.scope.listen(worker, 'message', (event: MessageEvent) => {
        const { id, ok, css } = event.data as { id: number; ok: boolean; css?: string };
        this.#waiting.get(id)?.(ok ? css : undefined);
        this.#waiting.delete(id);
      });
    }
    const id = ++this.#id;
    const worker = this.#worker;
    return new Promise((resolve) => {
      this.#waiting.set(id, resolve);
      worker.postMessage({ id, draft, bases });
    });
  }

  /**
   * After an edit: when the file edited is a base and differs from the file as loaded, name the
   * products the edit changes. A newer check, or `clear`, discards an older one.
   */
  async check(): Promise<void> {
    const run = ++this.#run;
    this.#impact.value = undefined;
    const file = this.host.file;
    const loaded = this.host.files.find((f) => f.file === file)?.config;
    const draft = this.host.draft(file);
    if (this.scope.disposed || JSON.stringify(draft) === JSON.stringify(loaded)) return;
    const changed: string[] = [];
    const unchanged: string[] = [];
    for (const product of this.#dependents(file)) {
      const bases = this.host.bases(product);
      const own = this.host.draft(product);
      const [before, after] = await Promise.all([
        this.#css(
          own,
          bases.map((base) => (base.file === file ? loaded : base.config)),
        ),
        this.#css(
          own,
          bases.map((base) => base.config),
        ),
      ]);
      if (run !== this.#run) return;
      (before === after ? unchanged : changed).push(product);
    }
    if (changed.length || unchanged.length) this.#impact.value = { changed, unchanged };
  }

  clear(): void {
    this.#run++;
    this.#impact.value = undefined;
  }

  /** The file picker, what the file builds on and carries, and what an edit to a base changes. */
  render() {
    const { files, file } = this.host;
    const base = files.find((f) => f.file === file)?.base;
    const dependents = this.#dependents(file);
    const impact = this.#impact.value;
    const edited = (f: ThemeStudioFile) =>
      JSON.stringify(this.host.draft(f.file)) === JSON.stringify(f.config) ? '' : ' (edited)';
    return html`<div class="wb-field">
        <label for="ts-file">Theme file</label>
        <select
          id="ts-file"
          aria-describedby="ts-file-note"
          @change=${(event: Event) => this.host.open((event.target as HTMLSelectElement).value)}
        >
          ${files.map(
            (f) =>
              html`<option value=${f.file} ?selected=${f.file === file}>
                ${f.file}${files.some((g) => g.base === f.file) ? ' (base)' : ''}${edited(f)}
              </option>`,
          )}
        </select>
      </div>
      <p id="ts-file-note" class="wb-muted">
        ${base ? html`Builds on <code>${base}</code>: what it does not set comes from there. ` : ''}
        ${dependents.length ? `Products on it: ${dependents.join(', ')}.` : ''}
      </p>
      <p class="wb-status" role="status">
        ${
          impact
            ? `${impact.changed.length ? `This edit changes ${impact.changed.join(', ')}.` : 'This edit changes no product.'}${impact.unchanged.length ? ` Unchanged: ${impact.unchanged.join(', ')}.` : ''}`
            : nothing
        }
      </p>`;
  }
}
