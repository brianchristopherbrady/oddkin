/**
 * Theme Studio content (workbench.md §6, workbench-pages.md §8): one draft of the library's theme
 * configuration, edited through a form and a JSON editor; generated in a Worker by the library's
 * own generator; applied to light and dark frames as a preview-owned stylesheet, so the real
 * components update in place (no remount). An invalid draft keeps the last valid theme and
 * lists the generator's diagnostics with their configuration paths. The frames show one screen:
 * the role specimens, one component's examples, or a composition document.
 */
import { OddkinElement, prop } from '@oddkin/core/element';
import { styleMap } from '@oddkin/core/helpers/style-map';
import { signal, untracked } from '@oddkin/core/reactive';
import { createScope, type Scope } from '@oddkin/core/scope';
import { html, nothing, repeat } from '@oddkin/core/template';
import type { StyleInput } from '@oddkin/core/styles';
import type { ThemeStudioPageData } from '../data/types.js';
import { createIsolatedPreview, type IsolatedPreview } from '../preview/frame.js';
import {
  createThemeGeneration,
  type GenerationResult,
  type ThemeGeneration,
} from '../preview/theme-generation.js';
import type { FrameSpecimenItem, JsonValue } from '../protocol/index.js';
import { contentStyles, panelHostStyles } from './styles.js';
import type { ThemeSave } from './theme-save.js';
import {
  exportBlocked,
  exportNames,
  fieldValue,
  parseDraft,
  pathText,
  setPath,
  themeFields,
  type ThemeField,
} from './theme-model.js';

const MODES = ['light', 'dark'] as const;

type Studio = ThemeStudioPageData['studio'];

interface Problem {
  readonly path?: string;
  readonly message?: string;
  readonly code?: string;
  readonly severity?: string;
}

/** Diagnostics with their paths: the generator's, or the composition renderer's. */
const problemList = (label: string, problems: readonly Problem[]) =>
  problems.length
    ? html`<ul class="wb-list" aria-label=${label}>
        ${problems.map(
          (d) =>
            html`<li data-severity=${d.severity ?? 'error'}>
              <code>${d.path || '/'}</code> ${d.message ?? d.code ?? ''}
            </li>`,
        )}
      </ul>`
    : nothing;

/** A composition's JSON, or its syntax error; the renderer validates its shape. */
function parseJson(text: string): { readonly value?: JsonValue; readonly error?: string } {
  try {
    return { value: JSON.parse(text) as JsonValue };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** The screen shown first: the role specimens, else the first component or composition. */
function firstScreen(studio: Studio | undefined): string {
  const screens = studio?.screens;
  if (!studio || studio.roles.length) return 'specimens';
  const component = screens?.components[0];
  if (component) return `component:${component.tag}`;
  return screens?.composition ? `composition:${screens.composition.starters[0]?.id ?? ''}` : '';
}

export class ThemeStudioElement extends OddkinElement.with({
  page: prop.object<ThemeStudioPageData>({ description: 'The Theme Studio page data.' }),
  frameUrl: prop.string({
    default: '',
    description: 'Same-origin URL of the generated preview frame document.',
  }),
}) {
  static override styles: StyleInput = [panelHostStyles, contentStyles];

  readonly #draft = signal<unknown>(undefined);
  readonly #json = signal('');
  readonly #jsonError = signal('');
  readonly #result = signal<GenerationResult | undefined>(undefined);
  readonly #status = signal<{ readonly text: string; readonly alert: boolean }>({
    text: '',
    alert: false,
  });
  /** From a draft's request until its result: a delivered result is always the newest draft's. */
  readonly #pending = signal(false);
  /** Why the generator cannot run, or ''. */
  readonly #unavailable = signal('');
  readonly #exported = signal('');
  /** `specimens`, `component:<tag>`, or `composition:<id>` (`composition:` is the team's own). */
  readonly #screen = signal('specimens');
  /** The composition shown, as edited; each composition screen keeps its own text. */
  readonly #text = signal('');
  readonly #texts = new Map<string, string>();
  readonly #textError = signal('');
  readonly #problems = signal<readonly Problem[]>([]);
  /** Per frame, the screen request in flight; frames whose screen changed meanwhile. */
  readonly #sending = new Map<IsolatedPreview, Promise<void>>();
  readonly #again = new Set<IsolatedPreview>();
  /** Saving to the theme file, when the dev server offers it. */
  readonly #save = signal<ThemeSave | undefined>(undefined);
  readonly #hosts: readonly [HTMLDivElement, HTMLDivElement];
  #previews: IsolatedPreview[] = [];
  #generation: ThemeGeneration | undefined;
  #studioScope: Scope | undefined;
  #css: string | undefined;
  #key: ThemeStudioPageData | undefined;
  #frameUrl = '';

  constructor() {
    super();
    this.#hosts = [document.createElement('div'), document.createElement('div')];
  }

  /** The current draft (for tests and embedding); read-only snapshot. */
  get draft(): unknown {
    return this.#draft.peek();
  }

  /** Light and dark frames, in that order. */
  get previews(): readonly IsolatedPreview[] {
    return this.#previews;
  }

  /** Generation counters: requests sent, superseded, and results applied. */
  get generation(): ThemeGeneration['stats'] | undefined {
    return this.#generation?.stats;
  }

  protected override connected(scope: Scope): void {
    scope.effect(() => {
      const page = this.page;
      const frameUrl = this.frameUrl;
      untracked(() => {
        const last = this.#key;
        if (page === last) return;
        this.#key = page;
        // A rebuild that leaves the theme file alone, or brings back the saved draft, keeps the
        // reader's draft and screen: only the screens' data may have changed.
        const kept = [last?.studio.config, this.#draft.peek()].map((c) => JSON.stringify(c));
        if (
          page &&
          last &&
          page.id === last.id &&
          frameUrl === this.#frameUrl &&
          page.studio.worker === last.studio.worker &&
          kept.includes(JSON.stringify(page.studio.config))
        ) {
          this.#showAll();
          return;
        }
        this.#frameUrl = frameUrl;
        this.#start(page, frameUrl);
      });
    });
    scope.add(() => {
      this.#key = undefined;
      this.#stop();
    });
  }

  #stop(): void {
    this.#studioScope?.dispose();
    this.#studioScope = undefined;
    this.#previews = [];
    this.#again.clear();
    this.#generation = undefined;
    this.#css = undefined;
    for (const host of this.#hosts) host.replaceChildren();
  }

  #start(page: ThemeStudioPageData | undefined, frameUrl: string): void {
    this.#stop();
    const studio = page?.studio;
    this.#draft.value = studio?.config;
    this.#json.value = studio?.config ? JSON.stringify(studio.config, null, 2) : '';
    this.#jsonError.value = '';
    this.#result.value = undefined;
    this.#status.value = { text: '', alert: false };
    this.#pending.value = false;
    this.#unavailable.value = '';
    this.#exported.value = '';
    this.#texts.clear();
    this.#save.value = undefined;
    this.#choose(firstScreen(studio), false);
    if (!page || !studio?.config || !studio.worker) return;
    const save = studio.save;
    if (save)
      void import('./theme-save.js').then(({ ThemeSave }) => {
        if (this.#key === page) this.#save.value = new ThemeSave(save, () => this.#draft.peek());
      });
    const scope = createScope({ name: 'workbench-theme-studio' });
    this.#studioScope = scope;
    this.#generation = createThemeGeneration(
      studio.worker,
      scope,
      (result) => this.#apply(result),
      (message) => {
        this.#unavailable.value = message;
        this.#status.value = { text: `Generation unavailable: ${message}`, alert: true };
      },
    );
    if (frameUrl && firstScreen(studio)) this.#frames(scope, frameUrl);
    this.#pending.value = true;
    this.#generation.request(studio.config);
  }

  #frames(scope: Scope, frameUrl: string): void {
    MODES.forEach((mode, i) => {
      const preview = createIsolatedPreview({
        document: this.ownerDocument,
        container: this.#hosts[i] as HTMLDivElement,
        frameUrl,
        title: `Theme preview (${mode})`,
      });
      preview.iframe.style.blockSize = '40rem';
      scope.add(() => preview.dispose(), 'theme preview frame');
      this.#previews.push(preview);
      void this.#send(preview, i)
        .then(() => (this.#css === undefined ? undefined : this.#theme(preview, this.#css)))
        .catch((error: unknown) => this.#failed(scope, error));
    });
  }

  #failed(scope: Scope | undefined, error: unknown): void {
    if (scope && !scope.disposed)
      this.#status.value = {
        text: `Preview unavailable: ${error instanceof Error ? error.message : String(error)}`,
        alert: true,
      };
  }

  /** Show a screen in both frames; a composition screen starts from its own text. */
  #choose(screen: string, send = true): void {
    const composition = this.page?.studio.screens?.composition;
    this.#screen.value = screen;
    this.#problems.value = [];
    this.#textError.value = '';
    if (screen.startsWith('composition:')) {
      const id = screen.slice('composition:'.length);
      const starter = composition?.starters.find((s) => s.id === id)?.document;
      this.#text.value =
        this.#texts.get(screen) ?? JSON.stringify(starter ?? { version: 1, root: [] }, null, 2);
    }
    if (send) this.#showAll();
  }

  #showAll(): void {
    const scope = this.#studioScope;
    const root = this.shadowRoot ?? this.ownerDocument;
    const focused = root.activeElement;
    void Promise.all(this.#previews.map((preview, i) => this.#send(preview, i))).then(
      () => {
        // A modal dialog on the screen took the focus into its frame: give it back (Firefox
        // does once the frame is blurred and this window has the focus).
        const frame = this.#previews.find((preview) => preview.iframe === root.activeElement);
        if (!(focused instanceof HTMLElement) || !frame) return;
        frame.iframe.blur();
        this.ownerDocument.defaultView?.focus();
        focused.focus({ preventScroll: true });
      },
      (error: unknown) => this.#failed(scope, error),
    );
  }

  /** Latest wins: a frame renders one screen at a time, then only the newest one asked for. */
  #send(preview: IsolatedPreview, i: number): Promise<void> {
    const sending = this.#sending.get(preview);
    if (sending) {
      this.#again.add(preview);
      return sending;
    }
    const run = (async () => {
      try {
        await preview.ready;
        do {
          this.#again.delete(preview);
          await this.#show(preview, i);
        } while (this.#again.has(preview));
      } finally {
        this.#sending.delete(preview);
      }
    })();
    this.#sending.set(preview, run);
    return run;
  }

  /** Send the screen to one frame; the light frame's reply lists a document's problems. */
  async #show(preview: IsolatedPreview, i: number): Promise<void> {
    const studio = this.page?.studio;
    const screen = this.#screen.peek();
    const settings = { mode: MODES[i] ?? 'light' };
    if (!studio) return;
    if (screen.startsWith('composition:')) {
      const composition = studio.screens?.composition;
      const parsed = parseJson(this.#text.peek());
      if (!composition || parsed.error !== undefined) return;
      const reply = (await preview.request('composition', {
        renderer: composition.renderer,
        registrations: composition.registrations,
        ...(composition.catalog
          ? { catalog: composition.catalog as Readonly<Record<string, JsonValue>> }
          : {}),
        document: parsed.value ?? null,
        settings,
      })) as { diagnostics?: readonly Problem[] } | undefined;
      // A newer screen on its way brings its own.
      if (i === 0 && !this.#again.has(preview)) this.#problems.value = reply?.diagnostics ?? [];
      return;
    }
    const items: readonly FrameSpecimenItem[] =
      screen === 'specimens'
        ? studio.roles
        : (studio.screens?.components.find((c) => `component:${c.tag}` === screen)?.items ?? []);
    await preview.request('specimen', { items, settings });
  }

  #theme(preview: IsolatedPreview, css: string) {
    return preview.request('theme', { cssText: css });
  }

  #edit(text: string): void {
    const parsed = parseJson(text);
    this.#text.value = text;
    this.#texts.set(this.#screen.peek(), text);
    this.#textError.value = parsed.error ?? '';
    if (parsed.error === undefined) this.#showAll();
  }

  /** The screen picker; a composition screen adds its JSON and the renderer's diagnostics. */
  #screens(studio: Studio) {
    const screens = studio.screens;
    if (!screens) return nothing;
    const screen = this.#screen.value;
    const composition = screens.composition;
    const component = screens.components.find((c) => `component:${c.tag}` === screen);
    const option = (value: string, label: string) =>
      html`<option value=${value} ?selected=${value === screen}>${label}</option>`;
    return html`<div class="wb-field">
        <label for="ts-screen">Screen</label>
        <select
          id="ts-screen"
          @change=${(event: Event) => this.#choose((event.target as HTMLSelectElement).value)}
        >
          ${studio.roles.length ? option('specimens', 'Role specimens') : nothing}
          ${
            screens.components.length
              ? html`<optgroup label="Components">
                  ${screens.components.map((c) => option(`component:${c.tag}`, c.title))}
                </optgroup>`
              : nothing
          }
          ${
            composition
              ? html`<optgroup label="Compositions">
                  ${composition.starters.map((s) => option(`composition:${s.id}`, s.title))}
                  ${option('composition:', 'Your document')}
                </optgroup>`
              : nothing
          }
        </select>
      </div>
      ${
        component?.omitted.length
          ? html`<p class="wb-muted">
              Not shown here, as their setup code runs on the component's page:
              ${component.omitted.join(', ')}.
            </p>`
          : nothing
      }
      ${
        composition && screen.startsWith('composition:')
          ? html`<div class="wb-field wb-json">
                <label for="ts-composition">Composition (JSON)</label>
                <textarea
                  id="ts-composition"
                  class="wb-code"
                  rows="12"
                  spellcheck="false"
                  aria-describedby="ts-composition-note"
                  .value=${this.#text.value}
                  @input=${(event: Event) =>
                    this.#edit((event.target as HTMLTextAreaElement).value)}
                ></textarea>
                <p
                  id="ts-composition-note"
                  class=${this.#textError.value ? 'wb-error' : 'wb-muted'}
                >
                  ${
                    this.#textError.value
                      ? `Not rendered: ${this.#textError.value}`
                      : html`Rendered by <code>${composition.renderer}</code>; its actions do
                          nothing here.`
                  }
                </p>
              </div>
              ${problemList('Composition diagnostics', this.#problems.value)}`
          : nothing
      }`;
  }

  /** A valid result replaces the specimens' theme sheet; an invalid one keeps the last valid. */
  #apply(result: GenerationResult): void {
    this.#pending.value = false;
    this.#result.value = result;
    if (!result.ok || result.css === undefined) return;
    this.#css = result.css;
    for (const preview of this.#previews)
      void this.#theme(preview, result.css).catch(() => {
        // Not connected yet: the sheet is applied once its specimen has mounted.
      });
  }

  #setDraft(draft: unknown, fromJson = false): void {
    this.#draft.value = draft;
    if (!fromJson) {
      this.#json.value = JSON.stringify(draft, null, 2);
      this.#jsonError.value = '';
    }
    this.#exported.value = '';
    this.#save.peek()?.discard();
    if (this.#generation) this.#pending.value = true;
    this.#generation?.request(draft);
  }

  /** Why the draft cannot be exported now, or, for a diff, `review`ed against the theme file. */
  #blocked(review = false): string {
    return exportBlocked({
      generator: !!this.page?.studio.worker,
      jsonError: !!this.#jsonError.value,
      unavailable: this.#unavailable.value,
      pending: !review && this.#pending.value,
      ok: review || this.#result.value?.ok,
    });
  }

  /** Download the draft shown: its configuration, or the CSS generated from it. */
  #export(kind: 'config' | 'css'): void {
    const css = this.#result.peek()?.css;
    if (this.#blocked() || css === undefined) return;
    const names = exportNames(this.page?.studio.source);
    const [name, type, text] =
      kind === 'config'
        ? [names.config, 'application/json', `${JSON.stringify(this.#draft.peek(), null, 2)}\n`]
        : [names.css, 'text/css', css];
    const doc = this.ownerDocument;
    const link = doc.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type }));
    link.download = name;
    doc.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    this.#exported.value = `Downloaded ${name}.`;
  }

  #exportSection(source: string | undefined) {
    const blocked = this.#blocked();
    const names = exportNames(source);
    const button = (kind: 'config' | 'css', name: string) =>
      html`<button
        type="button"
        ?disabled=${!!blocked}
        aria-describedby="ts-export-note"
        @click=${() => this.#export(kind)}
      >
        Download ${name}
      </button>`;
    return html`<section id="export" aria-labelledby="export-title">
      <h2 id="export-title">Export</h2>
      <div class="wb-toolbar">${button('config', names.config)} ${button('css', names.css)}</div>
      <p id="ts-export-note" class="wb-muted">
        ${blocked || 'The draft shown: its configuration, and the CSS generated from it.'}
      </p>
      <p class="wb-status" role="status">${this.#exported.value}</p>
      ${this.#save.value?.render(this.#blocked(true), blocked) ?? nothing}
    </section>`;
  }

  #field(field: ThemeField) {
    const id = `ts-${field.path.join('-')}`;
    const swatch =
      field.kind === 'color' &&
      typeof field.value === 'string' &&
      globalThis.CSS?.supports('color', field.value)
        ? html`<span
            class="wb-swatch"
            aria-hidden="true"
            style=${styleMap({ background: field.value })}
          ></span>`
        : nothing;
    return html`<div class="wb-field">
      <label for=${id}>${field.label}</label>
      <span class="wb-cell-controls"
        >${swatch}<input
          id=${id}
          type=${field.kind === 'number' || field.kind === 'integer' ? 'number' : 'text'}
          step=${field.kind === 'integer' ? '1' : 'any'}
          .value=${field.value === undefined ? '' : String(field.value)}
          placeholder="Not set (generated)"
          data-path=${pathText(field.path)}
          aria-describedby=${`${id}-origin`}
          @change=${(event: Event) =>
            this.#setDraft(
              setPath(
                this.#draft.peek(),
                field.path,
                fieldValue(field, (event.target as HTMLInputElement).value),
              ),
            )}
      /></span>
      <span id=${`${id}-origin`} class="wb-muted">${field.origin}</span>
    </div>`;
  }

  protected override render() {
    const studio = this.page?.studio;
    if (!studio) return html`<div class="wb-content"></div>`;
    const draft = this.#draft.value;
    const result = this.#result.value;
    const status = this.#status.value;
    const groups = draft === undefined ? [] : themeFields(draft);
    const problems = result?.diagnostics ?? [];
    return html`<div class="wb-content">
      <section id="generate" aria-labelledby="generate-title">
        <h2 id="generate-title">Generate</h2>
        ${
          studio.source
            ? html`<p class="wb-muted">
                Draft of <code>${studio.source}</code>. Edits stay in this page until exported.
              </p>`
            : nothing
        }
        ${repeat(
          groups,
          (group) => group.id,
          (group) =>
            html`<fieldset class="wb-group" data-group=${group.id}>
              <legend>${group.title}</legend>
              ${group.note ? html`<p class="wb-muted">${group.note}</p>` : nothing}
              ${repeat(
                group.fields,
                (field) => pathText(field.path),
                (field) => this.#field(field),
              )}
              ${
                group.rows?.length
                  ? html`<div class="wb-table-wrap">
                      <table>
                        <caption class="wb-visually-hidden">
                          ${group.title}, one column per mode
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Token</th>
                            ${(group.modes ?? []).map((mode) => html`<th scope="col">${mode}</th>`)}
                          </tr>
                        </thead>
                        <tbody>
                          ${repeat(
                            group.rows,
                            (row) => row.token,
                            (row) =>
                              html`<tr>
                                <th scope="row"><code>${row.token}</code></th>
                                ${row.cells.map(
                                  (cell) =>
                                    html`<td>
                                      <input
                                        aria-label=${cell.label}
                                        .value=${cell.value === undefined ? '' : String(cell.value)}
                                        data-path=${pathText(cell.path)}
                                        @change=${(event: Event) =>
                                          this.#setDraft(
                                            setPath(
                                              this.#draft.peek(),
                                              cell.path,
                                              fieldValue(
                                                cell,
                                                (event.target as HTMLInputElement).value,
                                              ),
                                            ),
                                          )}
                                      />
                                    </td>`,
                                )}
                              </tr>`,
                          )}
                        </tbody>
                      </table>
                    </div>`
                  : nothing
              }
            </fieldset>`,
        )}
        ${
          draft === undefined
            ? nothing
            : html`<div class="wb-field wb-json">
                <label for="ts-json">Configuration (JSON)</label>
                <textarea
                  id="ts-json"
                  class="wb-code"
                  rows="16"
                  spellcheck="false"
                  aria-describedby="ts-json-error"
                  .value=${this.#json.value}
                  @input=${(event: Event) => {
                    const text = (event.target as HTMLTextAreaElement).value;
                    this.#json.value = text;
                    const parsed = parseDraft(text);
                    this.#jsonError.value = parsed.ok ? '' : (parsed.message ?? '');
                    if (parsed.ok) this.#setDraft(parsed.value, true);
                  }}
                ></textarea>
                <p id="ts-json-error" class="wb-error" ?hidden=${!this.#jsonError.value}>
                  ${
                    this.#jsonError.value
                      ? `Not applied: ${this.#jsonError.value} The preview keeps the last valid draft.`
                      : ''
                  }
                </p>
              </div>`
        }
      </section>
      <section id="live-preview" aria-labelledby="live-preview-title">
        <h2 id="live-preview-title">Live preview</h2>
        ${this.#screens(studio)}
        <p class="wb-status" role=${status.alert || (result && !result.ok) ? 'alert' : 'status'}>
          ${
            status.text ||
            (result
              ? result.ok
                ? `Generated in ${Math.round(result.ms)} ms.`
                : 'This draft is invalid: the preview keeps the last valid theme.'
              : '')
          }
        </p>
        ${problemList('Generator diagnostics', problems)}
        <div class="wb-previews wb-pair">
          ${MODES.map(
            (mode, i) =>
              html`<div class="wb-preview">
                <p>${mode === 'light' ? 'Light' : 'Dark'}</p>
                ${this.#hosts[i]}
              </div>`,
          )}
        </div>
        ${
          studio.roles.length && this.#screen.value === 'specimens'
            ? html`<p class="wb-muted">
                Roles:
                ${studio.roles.map((r) => `${r.label} (<${r.tag}>, ${r.source === 'config' ? 'configured' : 'claimed by its example'})`).join(' · ')}.
              </p>`
            : nothing
        }
      </section>
      ${draft === undefined ? nothing : this.#exportSection(studio.source)}
      <section id="method" aria-labelledby="method-title">
        <h2 id="method-title">Method and limits</h2>
        <p>
          The draft is generated by the library's own theme generator in a Worker; the newest edit
          wins and older results are discarded. Generated CSS replaces one stylesheet in each
          preview frame, so the components keep their state. A composition is rendered by the
          library's own renderer, which refuses an invalid document whole.
        </p>
        ${
          studio.missing.length
            ? html`<ul class="wb-list" aria-label="Not available">
                ${studio.missing.map(
                  (m) =>
                    html`<li class="wb-not-documented" data-missing=${m.item}>
                      ${
                        m.item.startsWith('role:')
                          ? `No specimen for the ${m.item.slice(5)} role.`
                          : m.item === 'config'
                            ? 'No theme configuration to edit.'
                            : m.item === 'save'
                              ? 'Saving to the theme file is not available.'
                              : 'No theme generator.'
                      }
                      Supplied by ${m.supply}.
                    </li>`,
                )}
              </ul>`
            : nothing
        }
      </section>
    </div>`;
  }
}
