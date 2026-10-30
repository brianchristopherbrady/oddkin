/**
 * Theme Studio content (workbench.md §6, workbench-pages.md §8): one draft of the library's theme
 * configuration, edited through a form and a JSON editor; generated in a Worker by the library's
 * own generator; applied to light and dark specimen frames as a preview-owned stylesheet, so the
 * real components update in place (no remount). An invalid draft keeps the last valid theme and
 * lists the generator's diagnostics with their configuration paths.
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
import type { FrameSpecimenItem } from '../protocol/index.js';
import { contentStyles, panelHostStyles } from './styles.js';
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
  readonly #hosts: readonly [HTMLDivElement, HTMLDivElement];
  #previews: IsolatedPreview[] = [];
  #generation: ThemeGeneration | undefined;
  #studioScope: Scope | undefined;
  #css: string | undefined;
  #key: ThemeStudioPageData | undefined;

  constructor() {
    super();
    this.#hosts = [document.createElement('div'), document.createElement('div')];
  }

  /** The current draft (for tests and embedding); read-only snapshot. */
  get draft(): unknown {
    return this.#draft.peek();
  }

  /** Light and dark specimen frames, in that order. */
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
        if (page === this.#key) return;
        this.#key = page;
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
    if (!page || !studio?.config || !studio.worker) return;
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
    if (frameUrl && studio.roles.length) this.#specimens(scope, page, frameUrl);
    this.#pending.value = true;
    this.#generation.request(studio.config);
  }

  #specimens(scope: Scope, page: ThemeStudioPageData, frameUrl: string): void {
    const items: FrameSpecimenItem[] = page.studio.roles.map((role) => ({
      role: role.role,
      label: role.label,
      tag: role.tag,
      registration: role.registration,
      example: role.example,
      properties: role.properties,
      attributes: role.attributes,
      slots: role.slots,
    }));
    MODES.forEach((mode, i) => {
      const preview = createIsolatedPreview({
        document: this.ownerDocument,
        container: this.#hosts[i] as HTMLDivElement,
        frameUrl,
        title: `Theme specimen (${mode})`,
      });
      preview.iframe.style.blockSize = '40rem';
      scope.add(() => preview.dispose(), 'specimen frame');
      this.#previews.push(preview);
      void preview.ready
        .then(() => preview.request('specimen', { items, settings: { mode } }))
        .then(() => (this.#css === undefined ? undefined : this.#theme(preview, this.#css)))
        .catch((error: unknown) => {
          if (!scope.disposed)
            this.#status.value = {
              text: `Specimen unavailable: ${error instanceof Error ? error.message : String(error)}`,
              alert: true,
            };
        });
    });
  }

  #theme(preview: IsolatedPreview, css: string) {
    return preview.request('theme', { cssText: css });
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
    if (this.#generation) this.#pending.value = true;
    this.#generation?.request(draft);
  }

  #blocked(): string {
    return exportBlocked({
      generator: !!this.page?.studio.worker,
      jsonError: !!this.#jsonError.value,
      unavailable: this.#unavailable.value,
      pending: this.#pending.value,
      ok: this.#result.value?.ok,
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
        ${
          problems.length
            ? html`<ul class="wb-list" aria-label="Generator diagnostics">
                ${problems.map(
                  (d) =>
                    html`<li data-severity=${d.severity ?? 'error'}>
                      <code>${d.path || '/'}</code> ${d.message ?? d.code ?? ''}
                    </li>`,
                )}
              </ul>`
            : nothing
        }
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
          studio.roles.length
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
          specimen frame, so the components keep their state.
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
