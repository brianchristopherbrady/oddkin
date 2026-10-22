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
import { createIsolatedPreview, type IsolatedPreview } from '../preview/frame.js';
import type { FrameNotification, FrameSettings, JsonValue } from '../protocol/index.js';
import {
  componentFacts,
  decodeShare,
  defaultWriteMode,
  encodeShare,
  initialState,
  presets,
  MAX_SHARE_WIDTH,
  MIN_SHARE_WIDTH,
  SHARE_PARAM,
  sharePayload,
  snippet,
  type ApiRow,
  type ComponentFacts,
  type PresetEntry,
  type SharePreview,
  type PreviewState,
  type WriteMode,
} from './model.js';
import type { StyleInput } from '@oddkin/core/styles';
import { contentStyles, panelHostStyles } from './styles.js';

const LOG_LIMIT = 50;

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
const authoredValues = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((entry) =>
        typeof entry === 'string'
          ? [entry]
          : isRecord(entry) && typeof entry['value'] === 'string'
            ? [entry['value']]
            : [],
      )
    : [];

/** Text with Markdown code spans shown as code; everything stays text, never markup. */
function inline(text: string) {
  const parts = text.split('`');
  if (parts.length % 2 === 0) parts[parts.length - 2] += `\`${parts.pop() as string}`;
  return parts.map((part, i) => (i % 2 ? html`<code>${part}</code>` : part));
}

const notDocumented = (key: string) =>
  html`<p class="wb-not-documented">Not documented. Supplied by <code>${key}</code>.</p>`;

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
  static override styles: StyleInput = [panelHostStyles, contentStyles];

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
    if (typeof registration !== 'string') {
      this.#status.value = {
        text: 'Preview unavailable: no registration entry is published for this component.',
        alert: false,
      };
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
    const previews = [...this.#previews];
    void Promise.all(
      previews.map((preview, i) =>
        preview.ready.then(() =>
          preview.request('mount', this.#mountPayload(page, registration, i)),
        ),
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
    // Sections are built eagerly (not with repeat()), so the signals they read are tracked.
    return html`<div class="wb-content">
      ${sections.map(
        (section) =>
          html`<section id=${section.id} aria-labelledby=${`${section.id}-title`}>
            <h2 id=${`${section.id}-title`}>${section.title}</h2>
            ${this.#section(section.id, page, facts)}
          </section>`,
      )}
    </div>`;
  }

  #section(id: string, page: ComponentPageData, facts: ComponentFacts) {
    switch (id) {
      case 'overview':
        return this.#overview(page);
      case 'interactive-example':
        return this.#interactive(page, facts);
      case 'api':
        return this.#api(page, facts);
      case 'examples':
        return this.#examples(page);
      case 'tokens':
        return this.#tokens(page);
      case 'behavior-and-accessibility':
        return this.#behavior(page, facts);
      case 'source':
        return this.#source(page);
      case 'known-limitations': {
        const limitations = authoredValues(page.enrichment?.['limitations']);
        return limitations.length
          ? html`<ul class="wb-list">
              ${limitations.map((item) => html`<li>${inline(item)}</li>`)}
            </ul>`
          : html`<p class="wb-muted">None documented.</p>`;
      }
      case 'guidance':
        return notDocumented('pages["components/<tag>"].sections.guidance in oddkin.docs.ts');
      default:
        return notDocumented(`pages["${page.id}"].sections["${id}"] in oddkin.docs.ts`);
    }
  }

  #overview(page: ComponentPageData) {
    const description =
      typeof page.declaration['description'] === 'string' ? page.declaration['description'] : '';
    const useFor = authoredValues(page.enrichment?.['useFor']);
    const notFor = authoredValues(page.enrichment?.['notFor']);
    const registration = page.enrichment?.['registration'];
    const related = Array.isArray(page.enrichment?.['related'])
      ? (page.enrichment['related'] as unknown[]).filter((r): r is string => typeof r === 'string')
      : [];
    return html`${
        description
          ? description
              .split(/\n\s*\n/)
              .map((paragraph) => html`<p>${inline(paragraph.replace(/\s*\n\s*/g, ' '))}</p>`)
          : notDocumented('a JSDoc description on the class')
      }
      <h3>Use it for</h3>
      ${
        useFor.length
          ? html`<ul class="wb-list">
              ${useFor.map((item) => html`<li>${inline(item)}</li>`)}
            </ul>`
          : notDocumented('@useFor')
      }
      <h3>Not for</h3>
      ${
        notFor.length
          ? html`<ul class="wb-list">
              ${notFor.map((item) => html`<li>${inline(item)}</li>`)}
            </ul>`
          : notDocumented('@notFor')
      }
      <h3>Imports</h3>
      ${
        typeof registration === 'string'
          ? html`<p>Register the element with its define entry:</p>
              <pre class="wb-code" tabindex="0"><code>import '${registration}';</code></pre>`
          : notDocumented('the registration entry in oddkin.metadata.json')
      }
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

  #interactive(page: ComponentPageData, facts: ComponentFacts) {
    const state = this.#state.value;
    const settings = this.#settings.value;
    const status = this.#status.value;
    const entries = presets(page).filter((p) => p.state);
    const link = this.#link.value;
    const frameSettings = settings.pair ? {} : this.#frameSettings(0);
    const update = (patch: Partial<Settings>) => this.#applySettings({ ...settings, ...patch });
    return html`<div class="wb-toolbar">
        ${
          entries.length
            ? html`<label
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
              >`
            : nothing
        }
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
            <option value="ltr" ?selected=${settings.direction === 'ltr'}>Left to right</option>
            <option value="rtl" ?selected=${settings.direction === 'rtl'}>Right to left</option>
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
            <option value="narrow" ?selected=${settings.width === 'narrow'}>Narrow (320px)</option>
            <option value="medium" ?selected=${settings.width === 'medium'}>Medium (640px)</option>
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
        <button type="button" @click=${() => this.#reset()}>Reset</button>
        <button type="button" @click=${() => this.#copyLink(page)}>Copy example link</button>
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
      ${
        link
          ? html`<label class="wb-share"
              >Example link <input type="url" readonly .value=${link} size="40"
            /></label>`
          : nothing
      }
      <div class=${settings.pair ? 'wb-previews wb-pair' : 'wb-previews'}>
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
      </div>
      <p class="wb-status" role=${status.alert ? 'alert' : 'status'}>${status.text}</p>
      <h3>Event log</h3>
      ${this.#eventLog(facts)}
      <h3>Code</h3>
      <p class="wb-muted">Plain HTML and JavaScript for the current configuration.</p>
      <pre
        class="wb-code wb-snippet"
        tabindex="0"
      ><code>${snippet(page, state, { settings: frameSettings })}</code></pre>`;
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

  #api(page: ComponentPageData, facts: ComponentFacts) {
    return html`${facts.rows.length ? this.#apiTable(facts) : html`<p class="wb-muted">No properties or attributes are declared.</p>`}
      <h3>Slots</h3>
      ${this.#slots(facts)}
      <h3>Events</h3>
      ${this.#namedTable(facts.events, 'events', 'Event', true, page)}
      <h3>Methods</h3>
      ${
        facts.methods.length
          ? html`<p class="wb-muted">
                Methods are documented here and never invoked by the Workbench.
              </p>
              ${this.#namedTable(facts.methods, 'methods', 'Method', false, page)}`
          : html`<p class="wb-muted">None declared.</p>`
      }
      <h3>CSS parts</h3>
      ${this.#namedTable(facts.parts, 'parts', 'Part', false, page)}
      <h3>CSS custom properties</h3>
      ${this.#namedTable(facts.cssProperties, 'css-properties', 'Property', false, page)}
      <h3>Custom states</h3>
      ${this.#namedTable(facts.cssStates, 'states', 'State', false, page)}`;
  }

  #namedTable(
    entries: ComponentFacts['events'],
    id: string,
    label: string,
    withType: boolean,
    _page: ComponentPageData,
  ) {
    if (!entries.length) return html`<p class="wb-muted">None declared.</p>`;
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
    return html`<div class="wb-table-wrap">
      <table class="wb-stack wb-api" data-table="api">
        <caption>
          Editing a value updates the preview: one write per change, as a property or as an
          attribute. Reflected attributes are not written back.
        </caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Default</th>
            <th scope="col">Current value</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          ${facts.rows.map((row) => this.#apiRow(row))}
        </tbody>
      </table>
    </div>`;
  }

  #apiRow(row: ApiRow) {
    const name = row.property ?? row.attribute ?? '';
    const notes: string[] = [];
    if (row.property && row.attribute)
      notes.push(`attr ${row.attribute}${row.reflects ? ', reflects' : ''}`);
    else if (!row.property) notes.push('attribute only');
    else notes.push(row.propertyOnly ? 'property only' : 'no attribute');
    return html`<tr data-row=${row.id}>
      <th scope="row" data-label="Name"><code>${name}</code><small>${notes.join(' · ')}</small></th>
      <td data-label="Type">
        <code>${row.values ? row.values.map((v) => JSON.stringify(v)).join(' | ') : row.type}</code>
        ${row.nullable ? html`<small>nullable</small>` : nothing}
      </td>
      <td data-label="Default">${row.default ? html`<code>${row.default}</code>` : 'Unknown'}</td>
      <td data-label="Current value">${this.#control(row)}</td>
      <td data-label="Description">
        ${row.description ? inline(row.description) : html`<span class="wb-not-documented">Not documented</span>`}
      </td>
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
      control = html`<select
        aria-label=${label}
        .value=${current}
        @change=${(event: Event) => {
          const value = (event.target as HTMLSelectElement).value;
          if (mode === 'attribute') this.#writeAttribute(row, value === '' ? null : value);
          else if (value === '') this.#unsetProperty(row);
          else this.#writeProperty(row, value === '\u0000null' ? null : value);
        }}
      >
        <option value="" ?selected=${current === ''}>(unset)</option>
        ${(row.values ?? []).map(
          (value) => html`<option value=${value} ?selected=${current === value}>${value}</option>`,
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
          @change=${(event: Event) => {
            const text = (event.target as HTMLInputElement).value;
            if (mode === 'attribute') {
              if (number && text !== '' && !Number.isFinite(Number(text))) {
                this.#setError(row.id, 'Not written: not a number.');
                return;
              }
              this.#writeAttribute(row, text);
              return;
            }
            if (number) {
              if (text.trim() === '' || !Number.isFinite(Number(text))) {
                this.#setError(row.id, 'Not written: enter a number, or use Unset.');
                return;
              }
              this.#writeProperty(row, Number(text));
            } else this.#writeProperty(row, text);
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

  #slots(facts: ComponentFacts) {
    if (!facts.slots.length) return html`<p class="wb-muted">None declared.</p>`;
    const state = this.#state.value;
    return html`<div class="wb-table-wrap">
      <table class="wb-stack" data-table="slots">
        <thead>
          <tr>
            <th scope="col">Slot</th>
            <th scope="col">Description</th>
            <th scope="col">Text content</th>
          </tr>
        </thead>
        <tbody>
          ${facts.slots.map((slot) => {
            const label = slot.name || '(default)';
            return html`<tr data-slot=${slot.name}>
              <th scope="row" data-label="Slot"><code>${label}</code></th>
              <td data-label="Description">
                ${slot.description ? inline(slot.description) : html`<span class="wb-not-documented">Not documented</span>`}
              </td>
              <td data-label="Text content">
                <input
                  type="text"
                  aria-label=${`${label} slot text`}
                  .value=${state.slots[slot.name] ?? ''}
                  @change=${(event: Event) =>
                    this.#writeSlot(slot.name, (event.target as HTMLInputElement).value)}
                />
                <small>Text only; richer compositions need a fixture from defineExamples.</small>
              </td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>`;
  }

  #examples(page: ComponentPageData) {
    const entries = presets(page);
    if (!entries.length) return html`<p class="wb-muted">No authored examples.</p>`;
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

  #tokens(page: ComponentPageData) {
    const mappings = Array.isArray(page.enrichment?.['styleMappings'])
      ? (page.enrichment['styleMappings'] as unknown[]).filter(isRecord)
      : [];
    const reads = Array.isArray(page.enrichment?.['tokenReads'])
      ? (page.enrichment['tokenReads'] as unknown[]).filter(isRecord)
      : [];
    const resolved = new Map((page.tokens ?? []).map((t) => [t.name, t] as const));
    const theme = this.index?.libraries.length ? 'the generated baseline theme' : 'the baseline';
    return html`<h3>From property to token</h3>
      ${
        mappings.length
          ? html`<div class="wb-table-wrap">
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
            </div>`
          : html`<p class="wb-muted">No style mappings are declared.</p>`
      }
      <h3>Every token read</h3>
      ${
        reads.length
          ? html`<div class="wb-table-wrap">
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
                        <td data-label="Read through">
                          ${String(read['readThrough'] ?? 'Unknown')}
                        </td>
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
            </div>`
          : html`<p class="wb-muted">No token reads are declared.</p>`
      }`;
  }

  #behavior(page: ComponentPageData, facts: ComponentFacts) {
    const a11y = authoredValues(page.enrichment?.['a11y']);
    const keyboard = authoredValues(page.enrichment?.['keyboard']);
    return html`<h3>Accessibility</h3>
      ${
        a11y.length
          ? html`<ul class="wb-list">
              ${a11y.map((item) => html`<li>${inline(item)}</li>`)}
            </ul>`
          : notDocumented('@a11y')
      }
      <h3>Keyboard</h3>
      ${
        keyboard.length
          ? html`<ul class="wb-list">
              ${keyboard.map((item) => html`<li>${inline(item)}</li>`)}
            </ul>`
          : notDocumented('@keyboard')
      }
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
