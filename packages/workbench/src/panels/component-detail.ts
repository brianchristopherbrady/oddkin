/**
 * Component detail content (workbench-pages.md §7): every section of a component page, with the
 * editable API table as the only control surface over one isolated preview (or a light/dark
 * pair). Rendered by the public `<oddkin-component-panel>` (open shadow root) and by the shell
 * (light DOM, so "On this page" fragments resolve).
 */
import { OddkinElement, prop } from '@oddkin/core/element';
import { signal, untracked } from '@oddkin/core/reactive';
import { createScope, type Scope } from '@oddkin/core/scope';
import { html, nothing, repeat } from '@oddkin/core/template';
import type { ComponentPageData, JsonObject, WorkbenchIndex } from '../data/types.js';
import {
  createIsolatedPreview,
  PreviewFrameError,
  type IsolatedPreview,
} from '../preview/frame.js';
import {
  isCustomPropertyName,
  type FrameNotification,
  type FrameSettings,
  type JsonValue,
} from '../protocol/index.js';
import {
  authoredValues,
  componentFacts,
  decodeShare,
  defaultWriteMode,
  encodeShare,
  initialState,
  intendedUse,
  pageCoverage,
  presets,
  usagePairs,
  MAX_SHARE_WIDTH,
  MIN_SHARE_WIDTH,
  SHARE_PARAM,
  sharePayload,
  snippet,
  type ApiRow,
  type ComponentFacts,
  type CoverageItem,
  type PresetEntry,
  type SharePreview,
  type PreviewState,
  type WriteMode,
} from './model.js';
import type { StyleInput } from '@oddkin/core/styles';
import { contentStyles, panelHostStyles } from './styles.js';
import { exampleStyles } from './example-styles.js';

const LOG_LIMIT = 50;
const SEGMENTED_MAX = 4;

export interface EventLogEntry {
  readonly id: number;
  readonly name: string;
  readonly time: number;
  readonly bubbles: boolean;
  readonly composed: boolean;
  readonly target: string;
  readonly detail?: string;
}

type Width = 'fill' | 'narrow' | 'medium' | 'wide' | 'custom';
const WIDTHS: Readonly<Record<Exclude<Width, 'fill' | 'custom'>, number>> = {
  narrow: 320,
  medium: 640,
  wide: 960,
};

interface Settings {
  readonly mode: 'site' | 'light' | 'dark';
  readonly pair: boolean;
  readonly direction: 'ltr' | 'rtl';
  readonly width: Width;
  readonly customWidth: number;
}

const DEFAULT_SETTINGS: Settings = {
  mode: 'site',
  pair: false,
  direction: 'ltr',
  width: 'fill',
  customWidth: 480,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Text with Markdown code spans shown as code; everything stays text, never markup. */
function inline(text: string) {
  const parts = text.split('`');
  if (parts.length % 2 === 0) parts[parts.length - 2] += `\`${parts.pop() as string}`;
  return parts.map((part, i) => (i % 2 ? html`<code>${part}</code>` : part));
}

const notDocumented = (key: string, subject?: string) => {
  const lead = `${subject ? `${subject}: not documented` : 'Not documented'}. Supplied by `;
  return html`<p class="wb-not-documented">${lead}<code>${key}</code>.</p>`;
};

const bullets = (items: readonly string[]) =>
  html`<ul class="wb-list">
    ${items.map((item) => html`<li>${inline(item)}</li>`)}
  </ul>`;

/** Renders one page item: its content, or the label its coverage gives it. */
type Covered = (id: string, content: () => unknown) => unknown;

function covered(coverage: readonly CoverageItem[]): Covered {
  const byId = new Map(coverage.map((item) => [item.id, item] as const));
  return (id, content) => {
    const item = byId.get(id);
    if (!item) return nothing;
    return html`<div data-coverage=${id} data-state=${item.state}>
      ${
        item.state === 'documented'
          ? content()
          : item.state === 'none'
            ? html`<p class="wb-muted">${item.empty}</p>`
            : notDocumented(item.source ?? '', item.subject)
      }
    </div>`;
  };
}

export class ComponentDetailElement extends OddkinElement.with({
  page: prop.object<ComponentPageData>({ description: 'The component page data.' }),
  index: prop.object<WorkbenchIndex>({ description: 'The Workbench index.' }),
  href: prop.custom<(route: string) => string>({
    default: () => (route: string) => route,
    coerce: (value) =>
      typeof value === 'function'
        ? { ok: true, value: value as (route: string) => string }
        : { ok: false, reason: 'expected a function' },
    description: 'Maps a Workbench route to a URL.',
  }),
  frameUrl: prop.string({
    default: '',
    attribute: false,
    description: 'URL of the preview frame document.',
  }),
}) {
  static override styles: StyleInput = [panelHostStyles, contentStyles, exampleStyles];

  readonly #state = signal<PreviewState>({
    preset: 'default',
    attributes: {},
    properties: {},
    slots: {},
  });
  readonly #modes = signal<Readonly<Record<string, WriteMode>>>({});
  readonly #errors = signal<Readonly<Record<string, string>>>({});
  readonly #settings = signal<Settings>(DEFAULT_SETTINGS);
  readonly #log = signal<readonly EventLogEntry[]>([]);
  readonly #status = signal<{
    readonly text: string;
    readonly alert: boolean;
    /** Keep the message after the next successful mount. */
    readonly keep?: boolean;
  }>({
    text: '',
    alert: false,
  });
  readonly #link = signal('');
  /** The generated code is shown under the example. */
  readonly #code = signal(false);
  readonly #hosts: readonly [HTMLDivElement, HTMLDivElement];
  #previews: IsolatedPreview[] = [];
  #previewScope: Scope | undefined;
  #key = '';
  #logId = 0;

  constructor() {
    super();
    this.#hosts = [document.createElement('div'), document.createElement('div')];
  }

  /** Current preview configuration (for tests and embedding); read-only snapshot. */
  get previewState(): PreviewState {
    return this.#state.peek();
  }

  /** Live preview frames, in order (light first when shown side by side). */
  get previews(): readonly IsolatedPreview[] {
    return this.#previews;
  }

  protected override connected(scope: Scope): void {
    scope.effect(() => {
      const page = this.page;
      const frameUrl = this.frameUrl;
      untracked(() => this.#sync(page, frameUrl));
    });
    scope.add(() => {
      this.#key = '';
      this.#stop();
    });
  }

  /** Restart the preview only when the component, registration, or frame document changes. */
  #sync(page: ComponentPageData | undefined, frameUrl: string): void {
    const registration = page?.enrichment?.['registration'];
    const key = page ? `${page.tag}\n${String(registration)}\n${frameUrl}` : '';
    if (key === this.#key) return;
    const sameTag = this.#key.split('\n')[0] === page?.tag;
    this.#key = key;
    if (!page) {
      this.#stop();
      return;
    }
    if (!sameTag) {
      this.#modes.value = {};
      this.#errors.value = {};
      this.#log.value = [];
      this.#link.value = '';
      this.#state.value = this.#fromLocation(page) ?? initialState(page);
    }
    this.#restart();
  }

  #fromLocation(page: ComponentPageData): PreviewState | undefined {
    const location = this.ownerDocument.defaultView?.location;
    const hashQuery = location?.hash.includes('?')
      ? location.hash.slice(location.hash.indexOf('?'))
      : '';
    const encoded =
      new URLSearchParams(location?.search ?? '').get(SHARE_PARAM) ??
      new URLSearchParams(hashQuery.split('#')[0]).get(SHARE_PARAM);
    if (!encoded) return undefined;
    const { state, preview, problems } = decodeShare(page, encoded);
    if (problems.length)
      this.#status.value = { text: problems.join(' '), alert: !state, keep: true };
    if (!state) return undefined;
    if (preview) {
      const width = preview.width;
      const named =
        typeof width === 'number'
          ? (Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).find((key) => WIDTHS[key] === width)
          : undefined;
      this.#settings.value = {
        ...DEFAULT_SETTINGS,
        mode: preview.mode ?? 'site',
        direction: preview.direction ?? 'ltr',
        ...(typeof width !== 'number'
          ? {}
          : named
            ? { width: named }
            : { width: 'custom' as const, customWidth: width }),
      };
    }
    return state;
  }

  #stop(): void {
    this.#previewScope?.dispose();
    this.#previewScope = undefined;
    this.#previews = [];
    for (const host of this.#hosts) host.replaceChildren();
  }

  #frameSettings(index: number): FrameSettings {
    const settings = this.#settings.peek();
    const mode = settings.pair ? (index === 0 ? 'light' : 'dark') : settings.mode;
    const width =
      settings.width === 'fill'
        ? undefined
        : settings.width === 'custom'
          ? settings.customWidth
          : WIDTHS[settings.width];
    return {
      ...(mode === 'site' ? {} : { mode }),
      direction: settings.direction,
      ...(width ? { container: { width } } : {}),
    };
  }

  #mountPayload(page: ComponentPageData, registration: string, index: number) {
    const state = this.#state.peek();
    const facts = componentFacts(page);
    return {
      tag: page.tag,
      registration,
      example: `example:${page.tag}/${state.preset}` as const,
      properties: state.properties,
      attributes: state.attributes,
      slots: state.slots,
      styles: state.styles ?? {},
      events: facts.events.map((event) => event.name),
      sync: facts.syncPairs,
      settings: this.#frameSettings(index),
    };
  }

  /** Create the preview frame(s) and mount the current state; replaces earlier frames. */
  #restart(): void {
    this.#stop();
    const page = this.page;
    if (!page || !this.isConnected) return;
    const registration = page.enrichment?.['registration'];
    // Without a registration entry the preview item itself says what is missing.
    if (typeof registration !== 'string') {
      if (!this.#status.peek().keep) this.#status.value = { text: '', alert: false };
      return;
    }
    if (!this.frameUrl) {
      this.#status.value = {
        text: 'Preview unavailable: no preview frame document is configured.',
        alert: false,
      };
      return;
    }
    const scope = createScope({ name: `workbench-detail:${page.tag}` });
    this.#previewScope = scope;
    const count = this.#settings.peek().pair ? 2 : 1;
    try {
      for (let i = 0; i < count; i++) {
        const preview = createIsolatedPreview({
          document: this.ownerDocument,
          container: this.#hosts[i] as HTMLDivElement,
          frameUrl: this.frameUrl,
          title: `${page.tag} preview${count === 2 ? (i === 0 ? ' (light)' : ' (dark)') : ''}`,
          onMessage: (notification) => this.#onMessage(notification, i),
        });
        preview.iframe.style.blockSize = '14rem';
        scope.add(() => preview.dispose(), 'isolated preview');
        this.#previews.push(preview);
      }
    } catch (error) {
      this.#fail(error);
      return;
    }
    this.#mountAll(scope, page, registration);
  }

  #mountAll(scope: Scope, page: ComponentPageData, registration: string): void {
    // Each preview handles requests in order, so changes made from now on follow this mount.
    void Promise.all(
      this.#previews.map((preview, i) =>
        preview.request('mount', this.#mountPayload(page, registration, i)),
      ),
    ).then(
      () => {
        if (!scope.disposed && !this.#status.peek().alert && !this.#status.peek().keep)
          this.#status.value = { text: '', alert: false };
      },
      (error: unknown) => {
        if (!scope.disposed) this.#fail(error);
      },
    );
  }

  #fail(error: unknown): void {
    // A request for a frame that was replaced (Reset) or removed has nothing left to report.
    if (
      error instanceof PreviewFrameError &&
      (error.code === 'frame.generation.superseded' || error.code === 'frame.disposed')
    )
      return;
    this.#status.value = { text: `Preview unavailable: ${message(error)}`, alert: true };
  }

  #onMessage(notification: FrameNotification, index: number): void {
    const payload = notification.payload;
    if (notification.kind === 'event' && isRecord(payload) && index === 0) {
      const entry: EventLogEntry = {
        id: ++this.#logId,
        name: String(payload['name']),
        time: typeof payload['time'] === 'number' ? payload['time'] : 0,
        bubbles: payload['bubbles'] === true,
        composed: payload['composed'] === true,
        target: String(payload['target'] ?? ''),
        ...(payload['detail'] !== undefined ? { detail: JSON.stringify(payload['detail']) } : {}),
      };
      this.#log.value = [entry, ...this.#log.peek()].slice(0, LOG_LIMIT);
    } else if (notification.kind === 'error' && isRecord(payload)) {
      this.#status.value = {
        text: `Preview ${String(payload['phase'])} failed: ${String(payload['message'])}. Use Reset to start a fresh preview.`,
        alert: true,
      };
    } else if (
      notification.kind === 'state' &&
      isRecord(payload) &&
      typeof payload['property'] === 'string' &&
      index === 0
    ) {
      // A declared sync pair: mirror the value without writing it back (no reflection loop).
      const property = payload['property'];
      const value = payload['value'] as JsonValue;
      const state = this.#state.peek();
      this.#state.value = { ...state, properties: { ...state.properties, [property]: value } };
    }
  }

  /** Send one request to every live preview. */
  #send(kind: 'set' | 'slot', payload: Record<string, JsonValue>): void {
    for (const preview of this.#previews)
      void preview.request(kind, payload as never).catch((error: unknown) => this.#fail(error));
  }

  #setError(id: string, text: string | undefined): void {
    const errors = { ...this.#errors.peek() };
    if (text) errors[id] = text;
    else delete errors[id];
    this.#errors.value = errors;
  }

  /** Why a typed value is not written (a number field's text that is not a number yet). */
  #textProblem(number: boolean, mode: WriteMode, text: string): string | undefined {
    if (!number) return undefined;
    if (mode === 'attribute')
      return text !== '' && !Number.isFinite(Number(text))
        ? 'Not written: not a number.'
        : undefined;
    return text.trim() === '' || !Number.isFinite(Number(text))
      ? 'Not written: enter a number, or use Unset.'
      : undefined;
  }

  #writeAttribute(row: ApiRow, value: string | null): void {
    const name = row.attribute as string;
    const state = this.#state.peek();
    const attributes = { ...state.attributes };
    if (value === null) delete attributes[name];
    else attributes[name] = value;
    this.#state.value = { ...state, attributes };
    this.#setError(row.id, undefined);
    this.#send('set', { attribute: name, attributeValue: value });
  }

  #writeProperty(row: ApiRow, value: JsonValue): void {
    const name = row.property as string;
    const state = this.#state.peek();
    this.#state.value = { ...state, properties: { ...state.properties, [name]: value } };
    this.#setError(row.id, undefined);
    this.#send('set', { property: name, value });
  }

  /** Unset a property assignment: the frame cannot un-assign, so a clean instance is mounted. */
  #unsetProperty(row: ApiRow): void {
    const name = row.property as string;
    const state = this.#state.peek();
    if (!(name in state.properties)) return;
    const properties = { ...state.properties };
    delete properties[name];
    this.#state.value = { ...state, properties };
    this.#setError(row.id, undefined);
    this.#remount('Unset recreated the instance without this assignment.');
  }

  #writeSlot(name: string, text: string): void {
    const state = this.#state.peek();
    this.#state.value = { ...state, slots: { ...state.slots, [name]: text } };
    this.#send('slot', { name, text });
  }

  /** A CSS custom property on the element's style; `null` removes it. */
  #writeStyle(name: string, value: string | null): void {
    const state = this.#state.peek();
    const styles = { ...state.styles };
    if (value === null) delete styles[name];
    else styles[name] = value;
    this.#state.value = { ...state, styles };
    this.#send('set', { cssProperty: name, cssValue: value });
  }

  /** Mount the current state again in the existing frames (a clean instance, same realm). */
  #remount(note?: string): void {
    const page = this.page;
    const registration = page?.enrichment?.['registration'];
    const scope = this.#previewScope;
    if (!page || typeof registration !== 'string' || !scope) return;
    this.#status.value = { text: note ?? '', alert: false, ...(note ? { keep: true } : {}) };
    this.#mountAll(scope, page, registration);
  }

  #applyPreset(entry: PresetEntry): void {
    if (!entry.state) return;
    this.#state.value = entry.state;
    this.#errors.value = {};
    this.#remount();
  }

  /** Reset: fresh frame documents (new generation) with the selected preset's authored values. */
  #reset(): void {
    const page = this.page;
    if (!page) return;
    const preset = presets(page).find((p) => p.name === this.#state.peek().preset);
    this.#state.value = preset?.state ?? initialState(page);
    this.#errors.value = {};
    this.#log.value = [];
    this.#status.value = { text: '', alert: false };
    this.#replace();
  }

  /**
   * Replace the preview realms with fresh frame documents and mount the current configuration
   * again. The shell calls this when component code changes (a registration cannot be redefined
   * in the same realm).
   */
  replacePreview(): Promise<void> {
    return this.#replace();
  }

  #replace(): Promise<void> {
    const page = this.page;
    const registration = page?.enrichment?.['registration'];
    const scope = this.#previewScope;
    if (!page || typeof registration !== 'string' || !scope) {
      this.#restart();
      return Promise.resolve();
    }
    return Promise.all(this.#previews.map((preview) => preview.reload())).then(
      () => this.#mountAll(scope, page, registration),
      (error: unknown) => {
        if (!scope.disposed) this.#fail(error);
      },
    );
  }

  #applySettings(next: Settings): void {
    const pairChanged = next.pair !== this.#settings.peek().pair;
    this.#settings.value = next;
    if (pairChanged) {
      this.#restart();
      return;
    }
    this.#previews.forEach((preview, i) => {
      void preview
        .request('settings', this.#frameSettings(i))
        .catch((error: unknown) => this.#fail(error));
    });
  }

  #shareLink(page: ComponentPageData): string {
    const settings = this.#settings.peek();
    const width =
      settings.width === 'fill'
        ? 'fill'
        : settings.width === 'custom'
          ? settings.customWidth
          : WIDTHS[settings.width];
    // Light and dark side by side is a view of the page, not a preview setting to share.
    const preview: SharePreview = {
      ...(settings.mode === 'site' || settings.pair
        ? { sameAsSite: true }
        : { mode: settings.mode }),
      direction: settings.direction,
      width,
    };
    const encoded = encodeShare(sharePayload(page.tag, this.#state.peek(), preview));
    const route = this.index?.registry.pages.find((p) => p.id === page.id)?.route ?? `/${page.id}`;
    const url = new URL(this.href(route), this.ownerDocument.baseURI);
    // Hash routing keeps the query inside the fragment, where the router reads it.
    if (url.hash.startsWith('#/')) {
      const [path = '', query = ''] = url.hash.slice(1).split('?');
      const params = new URLSearchParams(query);
      params.set(SHARE_PARAM, encoded);
      url.hash = `${path}?${params}`;
    } else {
      url.searchParams.set(SHARE_PARAM, encoded);
      url.hash = 'interactive-example';
    }
    return url.href;
  }

  #copyLink(page: ComponentPageData): void {
    const link = this.#shareLink(page);
    this.#link.value = link;
    const clipboard = this.ownerDocument.defaultView?.navigator.clipboard;
    if (!clipboard) return;
    clipboard.writeText(link).then(
      () => (this.#status.value = { text: 'Example link copied.', alert: false, keep: true }),
      () => undefined,
    );
  }

  // ---- Rendering ----

  protected override render() {
    const page = this.page;
    const index = this.index;
    if (!page || !index) return html`<div class="wb-content"></div>`;
    const entry = index.registry.pages.find((p) => p.id === page.id);
    const sections = (entry?.sections ?? []).filter((s) => s.visible);
    const facts = componentFacts(page);
    const at = covered(pageCoverage(page));
    // Sections are built eagerly (not with repeat()), so the signals they read are tracked.
    return html`<div class="wb-content">
      ${sections.map(
        (section) =>
          html`<section id=${section.id} aria-labelledby=${`${section.id}-title`}>
            <h2 id=${`${section.id}-title`}>${section.title}</h2>
            ${this.#section(section.id, page, facts, at, sections)}
          </section>`,
      )}
    </div>`;
  }

  #section(
    id: string,
    page: ComponentPageData,
    facts: ComponentFacts,
    at: Covered,
    sections: readonly { readonly id: string }[],
  ) {
    switch (id) {
      case 'overview':
        return this.#overview(page, at);
      case 'interactive-example':
        return this.#interactive(page, facts, at);
      case 'api':
        return this.#api(
          facts,
          at,
          sections.some((s) => s.id === 'interactive-example'),
        );
      case 'examples':
        return at('examples/examples', () => this.#examples(page));
      case 'tokens':
        return this.#tokens(page, at);
      case 'behavior-and-accessibility':
        return this.#behavior(page, facts, at);
      case 'guidance':
        return this.#guidance(page, at);
      case 'source':
        return at('source/module', () => this.#source(page));
      case 'known-limitations':
        return at('known-limitations/limitations', () =>
          bullets(authoredValues(page.enrichment?.['limitations'])),
        );
      default:
        return notDocumented(`pages["${page.id}"].sections["${id}"] in oddkin.docs.ts`);
    }
  }

  #overview(page: ComponentPageData, at: Covered) {
    const description =
      typeof page.declaration['description'] === 'string' ? page.declaration['description'] : '';
    const registration = page.enrichment?.['registration'];
    const related = Array.isArray(page.enrichment?.['related'])
      ? (page.enrichment['related'] as unknown[]).filter((r): r is string => typeof r === 'string')
      : [];
    return html`${at('overview/description', () =>
        description
          .split(/\n\s*\n/)
          .map((paragraph) => html`<p>${inline(paragraph.replace(/\s*\n\s*/g, ' '))}</p>`),
      )}
      <h3>Imports</h3>
      ${at(
        'overview/imports',
        () =>
          html`<p>Register the element with its define entry:</p>
            <pre class="wb-code" tabindex="0"><code>import '${String(registration)}';</code></pre>`,
      )}
      ${
        related.length
          ? html`<h3>Related components</h3>
              <ul class="wb-list">
                ${related.map((tag) => {
                  const name = tag.replace(/^component:/, '');
                  return html`<li><a href=${this.href(`/components/${name}`)}>${name}</a></li>`;
                })}
              </ul>`
          : nothing
      }`;
  }

  /** Intended use and explained mistakes, each paired with the example to use instead. */
  #guidance(page: ComponentPageData, at: Covered) {
    const { useFor, notFor } = intendedUse(page);
    const authored = page.authored?.guidance ?? '';
    const show = (entry: PresetEntry, label: string) =>
      entry.state
        ? html`<button type="button" @click=${() => this.#applyPreset(entry)}>${label}</button>`
        : nothing;
    return html`${at('guidance/authored', () =>
        authored.split(/\n\s*\n/).map((paragraph) => html`<p>${inline(paragraph)}</p>`),
      )}
      <h3>Use it for</h3>
      ${at('guidance/use-for', () => bullets(useFor))}
      <h3>Not for</h3>
      ${at('guidance/not-for', () => bullets(notFor))}
      <h3>Correct and incorrect usage</h3>
      ${at(
        'guidance/usage-pairs',
        () =>
          html`<ul class="wb-list wb-pairs">
            ${usagePairs(page).map(
              ({ incorrect, correct }) =>
                html`<li data-pair=${incorrect.id}>
                  <p><strong>Incorrect:</strong> ${incorrect.label} <code>${incorrect.id}</code></p>
                  ${
                    incorrect.incorrect?.explanation
                      ? html`<p>${inline(incorrect.incorrect.explanation)}</p>`
                      : notDocumented('incorrect.explanation in defineExamples', 'Explanation')
                  }
                  <p>
                    <strong>Correct:</strong>
                    ${
                      correct
                        ? html`${correct.label} <code>${correct.id}</code>`
                        : html`<span class="wb-not-documented">Not documented</span>`
                    }
                  </p>
                  ${show(incorrect, 'Show the incorrect usage in the preview')}
                  ${correct ? show(correct, 'Show the correct usage in the preview') : nothing}
                </li>`,
            )}
          </ul>`,
      )}`;
  }

  #interactive(page: ComponentPageData, facts: ComponentFacts, at: Covered) {
    const state = this.#state.value;
    const settings = this.#settings.value;
    const status = this.#status.value;
    const entries = presets(page).filter((p) => p.state);
    const link = this.#link.value;
    const frameSettings = settings.pair ? {} : this.#frameSettings(0);
    const update = (patch: Partial<Settings>) => this.#applySettings({ ...settings, ...patch });
    const code = this.#code.value;
    return html`<div class="wb-example">
        <div class="wb-example-bar">
          <p class="wb-example-title">Interactive example · <code>${page.tag}</code></p>
          ${at(
            'interactive-example/presets',
            () =>
              html`<label
                >Preset
                <select
                  .value=${state.preset}
                  @change=${(event: Event) => {
                    const name = (event.target as HTMLSelectElement).value;
                    const entry = entries.find((p) => p.name === name);
                    if (entry) this.#applyPreset(entry);
                  }}
                >
                  ${entries.map(
                    (p) =>
                      html`<option value=${p.name} ?selected=${p.name === state.preset}>
                        ${p.label}${p.incorrect ? ' (incorrect usage)' : ''}
                      </option>`,
                  )}
                </select></label
              >`,
          )}
          <button
            type="button"
            aria-expanded=${code ? 'true' : 'false'}
            aria-controls="wb-example-code"
            @click=${() => (this.#code.value = !code)}
          >
            ${code ? 'Hide code' : 'See code'}
          </button>
          <button type="button" @click=${() => this.#copyLink(page)}>Copy example link</button>
          <button type="button" class="wb-quiet" @click=${() => this.#reset()}>Reset</button>
        </div>
        ${
          link
            ? html`<label class="wb-share"
                >Example link <input type="url" readonly .value=${link} size="40"
              /></label>`
            : nothing
        }
        <div class="wb-example-body">
          <div class="wb-example-stage">
            ${at(
              'interactive-example/preview',
              () =>
                html`<div class=${settings.pair ? 'wb-previews wb-pair' : 'wb-previews'}>
                  <div class="wb-preview">
                    ${settings.pair ? html`<p>Light</p>` : nothing}${this.#hosts[0]}
                  </div>
                  ${
                    settings.pair
                      ? html`<div class="wb-preview">
                          <p>Dark</p>
                          ${this.#hosts[1]}
                        </div>`
                      : nothing
                  }
                </div>`,
            )}
            <p class="wb-status" role=${status.alert ? 'alert' : 'status'}>${status.text}</p>
            <div class="wb-toolbar">
              <label
                >Mode
                <select
                  .value=${settings.mode}
                  ?disabled=${settings.pair}
                  @change=${(event: Event) =>
                    update({ mode: (event.target as HTMLSelectElement).value as Settings['mode'] })}
                >
                  <option value="site" ?selected=${settings.mode === 'site'}>Same as site</option>
                  <option value="light" ?selected=${settings.mode === 'light'}>Light</option>
                  <option value="dark" ?selected=${settings.mode === 'dark'}>Dark</option>
                </select></label
              >
              <label
                ><span>Light and dark side by side</span>
                <input
                  type="checkbox"
                  .checked=${settings.pair}
                  @change=${(event: Event) =>
                    update({ pair: (event.target as HTMLInputElement).checked })}
              /></label>
              <label
                >Direction
                <select
                  .value=${settings.direction}
                  @change=${(event: Event) =>
                    update({
                      direction: (event.target as HTMLSelectElement).value as Settings['direction'],
                    })}
                >
                  <option value="ltr" ?selected=${settings.direction === 'ltr'}>
                    Left to right
                  </option>
                  <option value="rtl" ?selected=${settings.direction === 'rtl'}>
                    Right to left
                  </option>
                </select></label
              >
              <label
                >Width
                <select
                  .value=${settings.width}
                  @change=${(event: Event) =>
                    update({ width: (event.target as HTMLSelectElement).value as Width })}
                >
                  <option value="fill" ?selected=${settings.width === 'fill'}>Fill</option>
                  <option value="narrow" ?selected=${settings.width === 'narrow'}>
                    Narrow (320px)
                  </option>
                  <option value="medium" ?selected=${settings.width === 'medium'}>
                    Medium (640px)
                  </option>
                  <option value="wide" ?selected=${settings.width === 'wide'}>Wide (960px)</option>
                  <option value="custom" ?selected=${settings.width === 'custom'}>Custom</option>
                </select></label
              >
              ${
                settings.width === 'custom'
                  ? html`<label
                      >Width in px
                      <input
                        type="number"
                        min=${String(MIN_SHARE_WIDTH)}
                        max=${String(MAX_SHARE_WIDTH)}
                        step="1"
                        .value=${String(settings.customWidth)}
                        @change=${(event: Event) => {
                          const value = Number((event.target as HTMLInputElement).value);
                          if (
                            Number.isInteger(value) &&
                            value >= MIN_SHARE_WIDTH &&
                            value <= MAX_SHARE_WIDTH
                          )
                            update({ customWidth: value });
                        }}
                    /></label>`
                  : nothing
              }
            </div>
            <p class="wb-muted wb-settings-summary">
              Preview only:
              ${settings.pair ? 'light and dark' : settings.mode === 'site' ? 'same mode as the site' : settings.mode}
              · ${settings.direction === 'rtl' ? 'right to left' : 'left to right'} ·
              ${
                settings.width === 'fill'
                  ? 'fills the column'
                  : `${settings.width === 'custom' ? settings.customWidth : WIDTHS[settings.width]}px container`
              }
            </p>
          </div>
          <div class="wb-example-controls">
            <h3>Controls and API</h3>
            ${at('api/properties', () => this.#apiTable(facts))}
            ${at('api/slots', () => this.#slots(facts))}
            ${at('api/css-properties', () => this.#cssTable(facts))}
          </div>
        </div>
        <div class="wb-example-code" id="wb-example-code" ?hidden=${!code}>
          <p class="wb-example-title">HTML and JavaScript · current example</p>
          <pre
            class="wb-code wb-snippet"
            tabindex="0"
          ><code>${snippet(page, state, { settings: frameSettings })}</code></pre>
        </div>
      </div>
      <h3>Event log</h3>
      ${this.#eventLog(facts)}`;
  }

  #eventLog(facts: ComponentFacts) {
    if (!facts.events.length)
      return html`<p class="wb-muted wb-event-log">No events are declared, so none are logged.</p>`;
    const log = this.#log.value;
    return html`<div class="wb-event-log">
      <p class="wb-muted">
        Logging ${facts.events.map((e, i) => html`${i ? ', ' : ''}<code>${e.name}</code>`)} (latest
        first, at most ${LOG_LIMIT}).
        <button type="button" ?disabled=${!log.length} @click=${() => (this.#log.value = [])}>
          Clear
        </button>
      </p>
      ${
        log.length
          ? html`<ol class="wb-log" aria-label="Events">
              ${repeat(
                log,
                (entry) => entry.id,
                (entry) =>
                  html`<li>
                    <code>${entry.name}</code> at ${entry.time.toFixed(0)} ms on
                    <code>${entry.target}</code> · ${entry.bubbles ? 'bubbles' : 'does not bubble'}
                    · ${entry.composed ? 'composed' : 'not composed'}
                    ${entry.detail !== undefined ? html`<br /><code>detail: ${entry.detail}</code>` : nothing}
                  </li>`,
              )}
            </ol>`
          : html`<p class="wb-muted">No events yet.</p>`
      }
    </div>`;
  }

  #api(facts: ComponentFacts, at: Covered, inExample: boolean) {
    return html`${
        inExample
          ? html`<p class="wb-muted">
              Properties, attributes, slots, and CSS custom properties are in the interactive
              example's controls above.
            </p>`
          : html`${at('api/properties', () => this.#apiTable(facts))}
            ${at('api/slots', () => this.#slots(facts))}
            ${at('api/css-properties', () => this.#cssTable(facts))}`
      }
      <h3>Events</h3>
      ${at('api/events', () => this.#namedTable(facts.events, 'events', 'Event', true))}
      <h3>Methods</h3>
      ${at(
        'api/methods',
        () =>
          html`<p class="wb-muted">
              Methods are documented here and never invoked by the Workbench.
            </p>
            ${this.#namedTable(facts.methods, 'methods', 'Method', false)}`,
      )}
      <h3>CSS parts</h3>
      ${at('api/parts', () => this.#namedTable(facts.parts, 'parts', 'Part', false))}
      <h3>Custom states</h3>
      ${at('api/css-states', () => this.#namedTable(facts.cssStates, 'states', 'State', false))}`;
  }

  #namedTable(entries: ComponentFacts['events'], id: string, label: string, withType: boolean) {
    return html`<div class="wb-table-wrap">
      <table class="wb-stack" data-table=${id}>
        <thead>
          <tr>
            <th scope="col">${label}</th>
            ${withType ? html`<th scope="col">Type</th>` : nothing}
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(
            (entry) =>
              html`<tr>
                <td data-label=${label}><code>${entry.name || '(default)'}</code></td>
                ${withType ? html`<td data-label="Type"><code>${entry.type ?? 'Unknown'}</code></td>` : nothing}
                <td data-label="Description">
                  ${entry.description ? inline(entry.description) : html`<span class="wb-not-documented">Not documented</span>`}
                </td>
              </tr>`,
          )}
        </tbody>
      </table>
    </div>`;
  }

  #apiTable(facts: ComponentFacts) {
    const groups = [
      ['Attributes', facts.rows.filter((row) => row.attribute)],
      ['Properties', facts.rows.filter((row) => !row.attribute)],
    ] as const;
    return html`<div class="wb-table-wrap">
      <table class="wb-stack wb-api" data-table="api">
        <caption>
          Editing a value updates the preview: one write per change, as a property or as an
          attribute. Reflected attributes are not written back.
        </caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Contract</th>
            <th scope="col">Default</th>
            <th scope="col">Control and current value</th>
          </tr>
        </thead>
        ${groups.map(([label, rows]) =>
          rows.length
            ? html`<tbody>
                <tr class="wb-group-row">
                  <th scope="colgroup" colspan="4">${label}</th>
                </tr>
                ${rows.map((row) => this.#apiRow(row))}
              </tbody>`
            : nothing,
        )}
      </table>
    </div>`;
  }

  #apiRow(row: ApiRow) {
    const name = row.property ?? row.attribute ?? '';
    const notes: string[] = [];
    if (row.property && row.attribute)
      notes.push(
        `property ${row.property}${row.attribute !== row.property ? ` · attribute ${row.attribute}` : ''}${row.reflects ? ', reflects' : ''}`,
      );
    else if (!row.property) notes.push('attribute only');
    else notes.push(row.propertyOnly ? 'property only' : 'no attribute');
    return html`<tr data-row=${row.id}>
      <th scope="row" data-label="Name">
        <code>${name}</code>
        <small
          >${row.description ? inline(row.description) : html`<span class="wb-not-documented">Not documented</span>`}</small
        >
      </th>
      <td data-label="Contract">
        ${notes.join(' · ')}
        <small
          ><code>${row.values ? row.values.join(' | ') : row.type}</code
          >${row.nullable ? ' · nullable' : ''}</small
        >
      </td>
      <td data-label="Default">${row.default ? html`<code>${row.default}</code>` : 'Unknown'}</td>
      <td data-label="Control">${this.#control(row)}</td>
    </tr>`;
  }

  #control(row: ApiRow) {
    const name = row.property ?? row.attribute ?? '';
    if (row.control === 'readonly')
      return html`<span class="wb-muted">Read-only; inspected, never edited.</span>`;
    if (row.control === 'fixture')
      return html`<span class="wb-muted"
        >Requires fixture: <code>${row.type}</code> is not editable generically.</span
      >`;
    const state = this.#state.value;
    const modes = this.#modes.value;
    const mode = modes[row.id] ?? defaultWriteMode(row);
    const error = this.#errors.value[row.id];
    const label = `${name} (${mode})`;
    const attr = row.attribute;
    const prop = row.property;
    const attrValue = attr ? state.attributes[attr] : undefined;
    const propSet = prop !== undefined && prop in state.properties;
    const propValue = prop !== undefined ? state.properties[prop] : undefined;
    const modeSwitch =
      row.property && row.attribute && !row.propertyOnly && row.control !== 'json'
        ? html`<select
            aria-label=${`Write ${name} as`}
            .value=${mode}
            @change=${(event: Event) => {
              this.#modes.value = {
                ...this.#modes.peek(),
                [row.id]: (event.target as HTMLSelectElement).value as WriteMode,
              };
            }}
          >
            <option value="attribute" ?selected=${mode === 'attribute'}>attribute</option>
            <option value="property" ?selected=${mode === 'property'}>property</option>
          </select>`
        : nothing;
    let control: unknown;
    if (row.control === 'boolean') {
      const checked = mode === 'attribute' ? attrValue !== undefined : propValue === true;
      control = html`<input
          type="checkbox"
          role="switch"
          class="wb-switch"
          aria-label=${label}
          .checked=${checked}
          @change=${(event: Event) => {
            const on = (event.target as HTMLInputElement).checked;
            if (mode === 'attribute') this.#writeAttribute(row, on ? '' : null);
            else this.#writeProperty(row, on);
          }}
        />
        <span class="wb-muted"
          >${
            mode === 'attribute'
              ? attrValue !== undefined
                ? 'present'
                : 'absent'
              : propSet
                ? String(propValue)
                : 'unset'
          }</span
        >`;
    } else if (row.control === 'enum') {
      const current =
        mode === 'attribute'
          ? (attrValue ?? '')
          : propSet
            ? propValue === null
              ? '\u0000null'
              : String(propValue)
            : '';
      const write = (value: string) => {
        if (mode === 'attribute') this.#writeAttribute(row, value === '' ? null : value);
        else if (value === '') this.#unsetProperty(row);
        else this.#writeProperty(row, value === '\u0000null' ? null : value);
      };
      const values = row.values ?? [];
      // A few values read best side by side; longer lists stay a select.
      control =
        values.length <= SEGMENTED_MAX
          ? html`<div class="wb-segmented" role="radiogroup" aria-label=${label}>
                ${values.map(
                  (value) =>
                    html`<label
                      ><input
                        type="radio"
                        name=${`${row.id}:${mode}`}
                        value=${value}
                        .checked=${current === value}
                        @change=${() => write(value)}
                      /><span>${value}</span></label
                    >`,
                )}
              </div>
              <button type="button" ?disabled=${current === ''} @click=${() => write('')}>
                Unset
              </button>
              ${
                mode === 'property' && row.nullable
                  ? html`<button
                      type="button"
                      ?disabled=${current === '\u0000null'}
                      @click=${() => write('\u0000null')}
                    >
                      Set null
                    </button>`
                  : nothing
              }`
          : html`<select
              aria-label=${label}
              .value=${current}
              @change=${(event: Event) => write((event.target as HTMLSelectElement).value)}
            >
              <option value="" ?selected=${current === ''}>(unset)</option>
              ${values.map(
                (value) =>
                  html`<option value=${value} ?selected=${current === value}>${value}</option>`,
              )}
              ${
                mode === 'property' && row.nullable
                  ? html`<option value=${'\u0000null'} ?selected=${current === '\u0000null'}>
                      null
                    </option>`
                  : nothing
              }
            </select>`;
    } else if (row.control === 'json') {
      control = html`<textarea
        aria-label=${label}
        rows="3"
        .value=${propSet ? JSON.stringify(propValue) : ''}
        placeholder="unset"
        @change=${(event: Event) => {
          const text = (event.target as HTMLTextAreaElement).value.trim();
          if (!text) {
            this.#unsetProperty(row);
            return;
          }
          try {
            const value = JSON.parse(text) as JsonValue;
            if (!Array.isArray(value) && !(value === null && row.nullable))
              throw new Error('expected a JSON array');
            this.#writeProperty(row, value);
          } catch (cause) {
            this.#setError(row.id, `Not written: ${message(cause)}.`);
          }
        }}
      ></textarea>`;
    } else {
      const number = row.control === 'number';
      const isSet = mode === 'attribute' ? attrValue !== undefined : propSet;
      const shown =
        mode === 'attribute'
          ? (attrValue ?? '')
          : propSet && propValue !== null
            ? String(propValue)
            : '';
      control = html`<input
          type=${number ? 'number' : 'text'}
          aria-label=${label}
          placeholder=${isSet ? '' : 'unset'}
          .value=${shown}
          @input=${(event: Event) => {
            // The preview follows the field as the reader types; an unfinished number waits.
            const text = (event.target as HTMLInputElement).value;
            if (this.#textProblem(number, mode, text)) return;
            if (mode === 'attribute') this.#writeAttribute(row, text);
            else this.#writeProperty(row, number ? Number(text) : text);
          }}
          @change=${(event: Event) => {
            const problem = this.#textProblem(
              number,
              mode,
              (event.target as HTMLInputElement).value,
            );
            if (problem) this.#setError(row.id, problem);
          }}
        />
        <button
          type="button"
          ?disabled=${!isSet}
          @click=${() => {
            if (mode === 'attribute') this.#writeAttribute(row, null);
            else this.#unsetProperty(row);
          }}
        >
          Unset
        </button>
        ${
          mode === 'property' && row.nullable
            ? html`<button
                type="button"
                ?disabled=${propSet && propValue === null}
                @click=${() => this.#writeProperty(row, null)}
              >
                Set null
              </button>`
            : nothing
        }
        <span class="wb-muted"
          >${
            !isSet
              ? 'unset'
              : mode === 'property' && propValue === null
                ? 'null'
                : shown === ''
                  ? 'empty string'
                  : ''
          }</span
        >`;
    }
    return html`<div class="wb-cell-controls">${control} ${modeSwitch}</div>
      ${error ? html`<p class="wb-error" role="alert">${error}</p>` : nothing}`;
  }

  /** One group of the example's controls: a four-column table under a group row. */
  #group(id: string, label: string, caption: string, heads: readonly string[], rows: unknown) {
    return html`<div class="wb-table-wrap">
      <table class="wb-stack wb-api" data-table=${id}>
        <caption class="wb-visually-hidden">
          ${caption}
        </caption>
        <thead class="wb-visually-hidden">
          <tr>
            ${heads.map((head) => html`<th scope="col">${head}</th>`)}
          </tr>
        </thead>
        <tbody>
          <tr class="wb-group-row">
            <th scope="colgroup" colspan="4">${label}</th>
          </tr>
          ${rows}
        </tbody>
      </table>
    </div>`;
  }

  #slots(facts: ComponentFacts) {
    const state = this.#state.value;
    return this.#group(
      'slots',
      'Slots',
      'Slots: text content written into the preview.',
      ['Slot', 'Description', 'Default', 'Text content'],
      facts.slots.map((slot) => {
        const label = slot.name || '(default)';
        return html`<tr data-slot=${slot.name}>
          <th scope="row" data-label="Slot"><code>${label}</code></th>
          <td data-label="Description">
            ${slot.description ? inline(slot.description) : html`<span class="wb-not-documented">Not documented</span>`}
          </td>
          <td data-label="Default">—</td>
          <td data-label="Text content">
            <input
              type="text"
              aria-label=${`${label} slot text`}
              .value=${state.slots[slot.name] ?? ''}
              @input=${(event: Event) =>
                this.#writeSlot(slot.name, (event.target as HTMLInputElement).value)}
            />
            <small>Text only; richer compositions need a fixture from defineExamples.</small>
          </td>
        </tr>`;
      }),
    );
  }

  #cssTable(facts: ComponentFacts) {
    const styles = this.#state.value.styles ?? {};
    return this.#group(
      'css-properties',
      'CSS custom properties',
      "CSS custom properties: values set on the preview element's style.",
      ['Property', 'Description', 'Default', 'Value'],
      facts.cssProperties.map((entry) => {
        const value = styles[entry.name];
        return html`<tr data-css=${entry.name}>
          <th scope="row" data-label="Property">
            <code>${entry.name}</code>
            ${entry.type ? html`<small><code>${entry.type}</code></small>` : nothing}
          </th>
          <td data-label="Description">
            ${entry.description ? inline(entry.description) : html`<span class="wb-not-documented">Not documented</span>`}
          </td>
          <td data-label="Default">${entry.default ? html`<code>${entry.default}</code>` : '—'}</td>
          <td data-label="Value">
            ${
              isCustomPropertyName(entry.name)
                ? html`<div class="wb-cell-controls">
                    <input
                      type="text"
                      aria-label=${`${entry.name} value`}
                      placeholder="unset"
                      .value=${value ?? ''}
                      @input=${(event: Event) => {
                        const text = (event.target as HTMLInputElement).value;
                        this.#writeStyle(entry.name, text === '' ? null : text);
                      }}
                    />
                    <button
                      type="button"
                      ?disabled=${value === undefined}
                      @click=${() => this.#writeStyle(entry.name, null)}
                    >
                      Unset
                    </button>
                  </div>`
                : html`<span class="wb-muted">Not editable: not a custom property name.</span>`
            }
          </td>
        </tr>`;
      }),
    );
  }

  #examples(page: ComponentPageData) {
    const entries = presets(page);
    return html`<ul class="wb-list wb-examples">
      ${entries.map(
        (entry) =>
          html`<li data-example=${entry.id}>
            <strong>${entry.label}</strong> <code>${entry.id}</code>
            ${entry.incorrect ? html`<small>Incorrect usage</small>` : nothing}
            ${entry.guidance ? html`<p>${inline(entry.guidance)}</p>` : nothing}
            ${entry.incorrect?.explanation ? html`<p>${inline(entry.incorrect.explanation)}</p>` : nothing}
            ${
              entry.requiresFixture
                ? html`<p class="wb-muted">
                    Requires fixture: rendered by its example module only.
                  </p>`
                : entry.state
                  ? html`<button type="button" @click=${() => this.#applyPreset(entry)}>
                      Show in preview
                    </button>`
                  : html`<p class="wb-muted">
                      Values not published (the example module was not loaded).
                    </p>`
            }
          </li>`,
      )}
    </ul>`;
  }

  #tokens(page: ComponentPageData, at: Covered) {
    const mappings = Array.isArray(page.enrichment?.['styleMappings'])
      ? (page.enrichment['styleMappings'] as unknown[]).filter(isRecord)
      : [];
    const reads = Array.isArray(page.enrichment?.['tokenReads'])
      ? (page.enrichment['tokenReads'] as unknown[]).filter(isRecord)
      : [];
    const resolved = new Map((page.tokens ?? []).map((t) => [t.name, t] as const));
    const theme = this.index?.libraries.length ? 'the generated baseline theme' : 'the baseline';
    return html`<h3>From property to token</h3>
      ${at(
        'tokens/style-mappings',
        () =>
          html`<div class="wb-table-wrap">
            <table class="wb-stack" data-table="style-mappings">
              <caption>
                Declared style mappings extracted from the component's stylesheets.
              </caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Part</th>
                  <th scope="col">CSS property</th>
                  <th scope="col">Token</th>
                </tr>
              </thead>
              <tbody>
                ${mappings.map(
                  (m) =>
                    html`<tr>
                      <td data-label="When"><code>${String(m['when'] ?? 'default')}</code></td>
                      <td data-label="Part">
                        ${m['part'] ? html`<code>${String(m['part'])}</code>` : 'host'}
                      </td>
                      <td data-label="CSS property">
                        <code>${String(m['cssProperty'] ?? '')}</code>
                      </td>
                      <td data-label="Token"><code>${String(m['token'] ?? '')}</code></td>
                    </tr>`,
                )}
              </tbody>
            </table>
          </div>`,
      )}
      <h3>Every token read</h3>
      ${at(
        'tokens/token-reads',
        () =>
          html`<div class="wb-table-wrap">
            <table class="wb-stack" data-table="token-reads">
              <caption>
                ${resolved.size} tokens read · values for ${theme} (not a live preview reading)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Token</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Read through</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                ${[...new Map(reads.map((r) => [String(r['token']), r] as const)).values()].map(
                  (read) => {
                    const name = String(read['token']);
                    const token = resolved.get(name);
                    const definition =
                      token &&
                      typeof token.definition === 'string' &&
                      token.definition.startsWith('{')
                        ? token.definition
                        : undefined;
                    return html`<tr>
                      <td data-label="Token">
                        <code>${name}</code>
                        ${token?.cssVariable ? html`<small><code>${token.cssVariable}</code></small>` : nothing}
                      </td>
                      <td data-label="Reference">${String(read['kind'] ?? 'declared')}</td>
                      <td data-label="Read through">${String(read['readThrough'] ?? 'Unknown')}</td>
                      <td data-label="Value">
                        ${
                          token && !('missing' in token) && token.value !== undefined
                            ? html`<code>${String(token.value)}</code
                                >${definition ? html` <small><code>${definition}</code></small>` : nothing}`
                            : 'Unknown'
                        }
                      </td>
                    </tr>`;
                  },
                )}
              </tbody>
            </table>
          </div>`,
      )}`;
  }

  #behavior(page: ComponentPageData, facts: ComponentFacts, at: Covered) {
    return html`<h3>Accessibility</h3>
      ${at('behavior-and-accessibility/a11y', () => bullets(authoredValues(page.enrichment?.['a11y'])))}
      <h3>Keyboard</h3>
      ${at('behavior-and-accessibility/keyboard', () =>
        bullets(authoredValues(page.enrichment?.['keyboard'])),
      )}
      ${
        facts.cssStates.length
          ? html`<h3>States</h3>
              <ul class="wb-list">
                ${facts.cssStates.map(
                  (s) =>
                    html`<li>
                      <code>:state(${s.name})</code
                      >${s.description ? html` — ${inline(s.description)}` : nothing}
                    </li>`,
                )}
              </ul>`
          : nothing
      }`;
  }

  #source(page: ComponentPageData) {
    const definition = isRecord(page.enrichment?.['definition'])
      ? (page.enrichment['definition'] as JsonObject)
      : undefined;
    const ref = isRecord(definition?.['ref']) ? (definition['ref'] as JsonObject) : undefined;
    return html`<dl>
      <dt>Package</dt>
      <dd><code>${page.package}</code></dd>
      <dt>Module</dt>
      <dd><code>${page.module}</code></dd>
      <dt>Class</dt>
      <dd><code>${String(page.declaration['name'] ?? 'Unknown')}</code></dd>
      ${
        ref
          ? html`<dt>Definition</dt>
              <dd><code>${String(ref['module'])}</code> (<code>${String(ref['name'])}</code>)</dd>`
          : nothing
      }
    </dl>`;
  }
}
