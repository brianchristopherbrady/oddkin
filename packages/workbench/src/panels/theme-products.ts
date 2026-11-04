/**
 * Theme Studio's products (P1.5 item 4, multi-product.md §3), for several themes or a theme on
 * base files: the picker of what to edit (a theme file, a base, or a product of a file), a new
 * product from a brand colour, Compare, and which products an edit changes. A theme file counts
 * as changed when its stylesheet does; a product of a file, when any of its values does, in each
 * mode and gamut, so a product that sets a changed value itself counts as unchanged. Checks and
 * compared files are generated in a Worker of their own, so the preview's generation never waits
 * for them. Loaded only when the page lists the themes' files.
 */
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { html, nothing, repeat } from '@oddkin/core/template';
import type { ThemeStudioFile } from '../data/types.js';
import type { IsolatedPreview } from '../preview/frame.js';
import type { FrameSettings } from '../protocol/index.js';
import type { ConfigPath, ThemeBase } from './theme-model.js';

/** What the panel shares with its products. */
export interface ProductsHost {
  readonly files: readonly ThemeStudioFile[];
  /** The configured themes; absent from page data of one theme on bases. */
  readonly themes: readonly { readonly file: string; readonly name?: string }[] | undefined;
  /** The file edited; a render that reads it follows it. */
  readonly file: string;
  /** The product of that file edited, or ''. */
  readonly product: string;
  /** The edited file's newest generated CSS. */
  readonly css: string | undefined;
  draft(file: string): unknown;
  /** The files `file` builds on, root base first, each with its draft. */
  bases(file: string): readonly ThemeBase[];
  open(file: string, product?: string): void;
  /** Set `path` of the edited file's draft. */
  set(path: ConfigPath, value: unknown): void;
  /** A preview frame in `container`, for Compare. */
  frame(container: HTMLElement, title: string): IsolatedPreview;
  /** Show the screen in a compared frame, with its settings. */
  attach(preview: IsolatedPreview, settings: FrameSettings): Promise<void>;
  detach(preview: IsolatedPreview): void;
}

/** A product's form: its own entries, what it inherits (its theme, then bases' entries for it). */
export interface ProductForm {
  readonly config: unknown;
  readonly bases: readonly ThemeBase[];
  /** Where its entry is in the file's draft, and the entry with the form's values. */
  readonly path: ConfigPath;
  value(config: unknown): unknown;
}

/** A theme file (`product` '') or a product of a file. */
interface Target {
  readonly file: string;
  readonly product: string;
  readonly label: string;
}

interface Generated {
  readonly css?: string;
  readonly values?: Readonly<Record<string, string>>;
}

interface Compared {
  readonly target: Target;
  readonly scope: Scope;
  readonly hosts: readonly HTMLDivElement[];
  readonly previews: readonly IsolatedPreview[];
  version: number;
}

const MODES = ['light', 'dark'] as const;
const PRODUCT_NAME = /^[A-Za-z0-9][\w-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The value at `keys` in a JSON model, or undefined. */
const at = (value: unknown, ...keys: string[]) =>
  keys.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);

const keyOf = (target: Target) => `${target.file}\n${target.product}`;

export class ThemeProducts {
  readonly #impact = signal<{ changed: string[]; unchanged: string[] } | undefined>(undefined);
  readonly #message = signal('');
  readonly #compared = signal<readonly string[]>([]);
  readonly #frames = new Map<string, Compared>();
  readonly #waiting = new Map<number, (generated: Generated) => void>();
  #worker: Worker | undefined;
  #id = 0;
  #run = 0;

  /** `worker` is Theme Studio's generation worker; checks use their own, as long as `scope`. */
  constructor(
    readonly worker: string,
    readonly scope: Scope,
    readonly host: ProductsHost,
  ) {}

  /** The products a file declares, its own and its bases', as merged by name. */
  #productsOf(file: string): string[] {
    const names = new Set<string>();
    for (const layer of [...this.host.bases(file), { config: this.host.draft(file) }]) {
      const products = at(layer.config, 'products');
      for (const [name, value] of isRecord(products) ? Object.entries(products) : [])
        if (value === null) names.delete(name);
        else names.add(name);
    }
    return [...names];
  }

  /** The themes: the configured ones; of one theme on bases, the file no other builds on. */
  #themes(): Target[] {
    const { files, themes } = this.host;
    return themes
      ? themes.map((t) => ({ file: t.file, product: '', label: t.name ?? t.file }))
      : files
          .filter((f) => !files.some((g) => g.base === f.file))
          .map((f) => ({ file: f.file, product: '', label: f.file }));
  }

  /** What may be compared: each theme, and each product of its file. */
  #targets(): Target[] {
    return this.#themes().flatMap((theme) => [
      theme,
      ...this.#productsOf(theme.file).map((product) => ({
        file: theme.file,
        product,
        label: `${theme.label} / ${product}`,
      })),
    ]);
  }

  /** The CSS of `draft` on `bases`, and the values of `products` in it. */
  #generate(draft: unknown, bases: readonly unknown[], products: readonly string[] = []) {
    if (!this.#worker) {
      const worker = new Worker(this.worker, { type: 'module', name: 'oddkin-theme-products' });
      this.#worker = worker;
      this.scope.add(() => worker.terminate(), 'theme products worker');
      this.scope.listen(worker, 'message', (event: MessageEvent) => {
        const { id, ok, css, values } = event.data as Generated & { id: number; ok: boolean };
        this.#waiting.get(id)?.(
          ok ? { ...(css === undefined ? {} : { css }), ...(values ? { values } : {}) } : {},
        );
        this.#waiting.delete(id);
      });
    }
    const id = ++this.#id;
    const worker = this.#worker;
    return new Promise<Generated>((resolve) => {
      this.#waiting.set(id, resolve);
      worker.postMessage({ id, draft, bases, ...(products.length ? { products } : {}) });
    });
  }

  /**
   * After an edit, or a change of the file edited: compared files take their new CSS, and when the
   * file edited differs from the file as loaded, the products the edit changes are named. A newer
   * check, or `clear`, discards an older one.
   */
  async check(): Promise<void> {
    const run = ++this.#run;
    this.#impact.value = undefined;
    for (const [key, entry] of this.#frames)
      if (entry.target.file !== this.host.file) void this.#theme(key);
    const file = this.host.file;
    const loaded = this.host.files.find((f) => f.file === file)?.config;
    const draft = this.host.draft(file);
    if (this.scope.disposed || JSON.stringify(draft) === JSON.stringify(loaded)) return;
    const changed: string[] = [];
    const unchanged: string[] = [];
    for (const theme of this.#themes()) {
      const bases = this.host.bases(theme.file);
      const on = bases.some((base) => base.file === file);
      if (theme.file !== file && !on) continue;
      const own = this.host.draft(theme.file);
      const products = this.#productsOf(theme.file);
      const [before, after] = await Promise.all([
        this.#generate(
          theme.file === file ? loaded : own,
          bases.map((base) => (base.file === file ? loaded : base.config)),
          products,
        ),
        this.#generate(
          own,
          bases.map((base) => base.config),
          products,
        ),
      ]);
      if (run !== this.#run) return;
      if (on) (before.css === after.css ? unchanged : changed).push(theme.label);
      // The product edited changes, of course: the others are what the edit may move.
      for (const product of products)
        if (theme.file !== file || product !== this.host.product)
          (before.values?.[product] === after.values?.[product] ? unchanged : changed).push(
            `${theme.label} / ${product}`,
          );
    }
    if (changed.length || unchanged.length) this.#impact.value = { changed, unchanged };
  }

  clear(): void {
    this.#run++;
    this.#impact.value = undefined;
  }

  /** The edited file's new CSS: its compared products take it. */
  applied(css: string): void {
    for (const entry of this.#frames.values())
      if (entry.target.file === this.host.file)
        for (const preview of entry.previews)
          void preview.request('theme', { cssText: css }).catch(() => {
            // Not connected yet: the sheet is applied once its screen has mounted.
          });
  }

  /** A compared product's CSS: the edited file's, or its own file's, generated on its drafts. */
  async #theme(key: string): Promise<void> {
    const entry = this.#frames.get(key);
    if (!entry) return;
    const version = ++entry.version;
    const { file } = entry.target;
    const css =
      file === this.host.file
        ? this.host.css
        : (
            await this.#generate(
              this.host.draft(file),
              this.host.bases(file).map((base) => base.config),
            )
          ).css;
    if (css === undefined || entry.version !== version || entry.scope.disposed) return;
    for (const preview of entry.previews)
      void preview.request('theme', { cssText: css }).catch(() => {
        // Not connected yet: the sheet is applied once its screen has mounted.
      });
  }

  /** Compare a product beside the one edited, in light and dark; unchecked, its frames go. */
  #toggle(target: Target, on: boolean): void {
    const key = keyOf(target);
    const existing = this.#frames.get(key);
    if (!on) {
      existing?.scope.dispose();
      this.#frames.delete(key);
      this.#compared.value = this.#compared.peek().filter((k) => k !== key);
      return;
    }
    if (existing || this.scope.disposed) return;
    const scope = this.scope.child({ name: 'theme compare' });
    const hosts = MODES.map(() => document.createElement('div'));
    const previews = MODES.map((mode, i) => {
      const preview = this.host.frame(hosts[i] as HTMLDivElement, `${target.label} (${mode})`);
      scope.add(() => {
        this.host.detach(preview);
        preview.dispose();
      }, 'compared frame');
      return preview;
    });
    this.#frames.set(key, { target, scope, hosts, previews, version: 0 });
    this.#compared.value = [...this.#compared.peek(), key];
    previews.forEach((preview, i) => {
      const settings = {
        mode: MODES[i] ?? 'light',
        ...(target.product ? { product: target.product } : {}),
      };
      void this.host
        .attach(preview, settings)
        .then(() => this.#theme(key))
        .catch(() => {
          // Deselected or closed while it loaded.
        });
    });
  }

  /** A new product of the file edited, from a brand colour, as the reference does. */
  #add(form: HTMLFormElement): void {
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const colour = String(data.get('brand') ?? '').trim();
    const file = this.host.file;
    this.#message.value = !PRODUCT_NAME.test(name)
      ? 'Name the product with letters, digits, "-", and "_".'
      : this.#productsOf(file).includes(name)
        ? `${file} already has a product ${name}.`
        : !colour
          ? 'Give the product its brand colour.'
          : '';
    if (this.#message.peek()) return;
    this.host.set(['products', name], { brand: { primary: colour } });
    this.host.open(file, name);
    this.#message.value = `Added ${name} to the draft of ${file}.`;
    form.reset();
  }

  /** The form of the product edited, if one is. */
  form(): ProductForm | undefined {
    const { file, product } = this.host;
    if (!product) return undefined;
    const draft = this.host.draft(file);
    const entry = (config: unknown) => {
      const value = at(config, 'products', product);
      return isRecord(value) ? value : {};
    };
    const view = (config: unknown) => {
      const { brand, overrides } = entry(config);
      return {
        ...(brand === undefined ? {} : { brand }),
        ...(overrides === undefined ? {} : { overrides }),
      };
    };
    const chain = [...this.host.bases(file), { file, config: draft }];
    return {
      config: view(draft),
      // The product's values win over its theme's, its file's over its bases'.
      bases: [
        ...chain,
        ...chain.slice(0, -1).map((layer) => ({
          file: `${layer.file} (${product})`,
          config: view(layer.config),
        })),
      ],
      path: ['products', product],
      value: (next) => {
        const { brand: _brand, overrides: _overrides, ...rest } = entry(draft);
        return { ...rest, ...view({ products: { [product]: next } }) };
      },
    };
  }

  /** What to edit, a new product, what the file builds on, and what an edit changes. */
  render() {
    const { files, file, product } = this.host;
    const themes = new Map(this.#themes().map((t) => [t.file, t.label]));
    const options = files.flatMap((f) => {
      const label = themes.get(f.file) ?? f.file;
      const base = files.some((g) => g.base === f.file) ? ' (base)' : '';
      const edited =
        JSON.stringify(this.host.draft(f.file)) === JSON.stringify(f.config) ? '' : ' (edited)';
      return [
        { value: f.file, file: f.file, product: '', label: `${label}${base}${edited}` },
        ...this.#productsOf(f.file).map((p) => ({
          value: `${f.file}#${p}`,
          file: f.file,
          product: p,
          label: `${label} / ${p}`,
        })),
      ];
    });
    const base = files.find((f) => f.file === file)?.base;
    const on = this.#themes()
      .filter((t) => t.file !== file && this.host.bases(t.file).some((b) => b.file === file))
      .map((t) => t.label);
    const products = [
      ...on,
      ...this.#productsOf(file).map((p) => `${themes.get(file) ?? file} / ${p}`),
    ];
    const impact = this.#impact.value;
    return html`<div class="wb-field">
        <label for="ts-file">Theme file</label>
        <select
          id="ts-file"
          aria-describedby="ts-file-note"
          @change=${(event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            const option = options.find((o) => o.value === value);
            if (option) this.host.open(option.file, option.product);
          }}
        >
          ${options.map(
            (o) =>
              html`<option value=${o.value} ?selected=${o.file === file && o.product === product}>
                ${o.label}
              </option>`,
          )}
        </select>
      </div>
      <p id="ts-file-note" class="wb-muted">
        ${base ? html`Builds on <code>${base}</code>: what it does not set comes from there. ` : ''}
        ${products.length ? `Products on it: ${products.join(', ')}.` : ''}
      </p>
      <p id="ts-impact" class="wb-status" role="status">
        ${
          impact
            ? `${impact.changed.length ? `This edit changes ${impact.changed.join(', ')}.` : 'This edit changes no product.'}${impact.unchanged.length ? ` Unchanged: ${impact.unchanged.join(', ')}.` : ''}`
            : nothing
        }
      </p>
      <form
        class="wb-toolbar"
        aria-label="New product"
        @submit=${(event: Event) => {
          event.preventDefault();
          this.#add(event.currentTarget as HTMLFormElement);
        }}
      >
        <label for="ts-new-product">New product</label>
        <input id="ts-new-product" name="name" autocomplete="off" />
        <label for="ts-new-brand">Brand colour</label>
        <input id="ts-new-brand" name="brand" autocomplete="off" placeholder="#0a7d33" />
        <button type="submit">Add product</button>
      </form>
      <p id="ts-product-status" class="wb-status" role="status">${this.#message.value}</p>`;
  }

  /** Compare: the chosen products beside the one edited, on the same screen, in light and dark. */
  compare() {
    const { file, product } = this.host;
    const chosen = this.#compared.value;
    const targets = this.#targets().filter((t) => t.file !== file || t.product !== product);
    return html`<fieldset class="wb-group" data-group="compare">
        <legend>Compare</legend>
        ${
          targets.length
            ? targets.map(
                (t) =>
                  html`<label class="wb-check"
                    ><input
                      type="checkbox"
                      .checked=${chosen.includes(keyOf(t))}
                      @change=${(event: Event) =>
                        this.#toggle(t, (event.target as HTMLInputElement).checked)}
                    />
                    ${t.label}</label
                  >`,
              )
            : html`<p class="wb-muted">No other product to compare.</p>`
        }
      </fieldset>
      ${repeat(
        chosen,
        (key) => key,
        (key) => {
          const entry = this.#frames.get(key);
          return entry
            ? html`<section class="wb-compare" aria-label=${entry.target.label}>
                <h3>${entry.target.label}</h3>
                <div class="wb-previews wb-pair">
                  ${MODES.map(
                    (mode, i) =>
                      html`<div class="wb-preview">
                        <p>${mode === 'light' ? 'Light' : 'Dark'}</p>
                        ${entry.hosts[i]}
                      </div>`,
                  )}
                </div>
              </section>`
            : nothing;
        },
      )}`;
  }
}
