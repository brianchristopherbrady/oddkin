import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { ContextItem } from '../contracts/types.js';
import { contextAddEvent, contextRemoveEvent } from '../events.js';
import { format, formatNumber, langOf, strings } from '../internal/strings.js';
import { safeUrl } from '../markdown/url.js';

export const CONTEXT_PICKER_STRINGS = {
  label: 'Context',
  empty: 'No context added.',
  addFiles: 'Add files',
  addUrl: 'Add link',
  url: 'Link address',
  add: 'Add',
  invalidUrl: 'Enter a full http or https address.',
  inspect: 'Inspect {label}',
  hide: 'Hide {label}',
  remove: 'Remove {label}',
  noPreview: 'No preview available.',
  file: 'File',
  document: 'Document',
  selection: 'Selected text',
  urlKind: 'Link',
  selected: 'Selected',
  uploading: 'Uploading…',
  uploaded: 'Uploaded',
  processing: 'Processing…',
  ready: 'Ready',
  failed: 'Failed',
  removed: 'Removed',
};

/**
 * Select, inspect, and remove the context sent with a request: files, documents, links, and
 * selected text. Adding is a request; items appear when the host adds their records.
 *
 * @csspart list - Context items.
 * @csspart item - One item.
 * @csspart add - Add controls.
 * @a11y A labelled list; each item names its kind and status in text. Inspect toggles a disclosure (`aria-expanded`). Remove buttons are named after the item.
 * @keyboard Tab through items and controls; Enter adds a link.
 * @useFor Attaching and reviewing context for research and agent requests.
 * @notFor File management.
 * @category AI
 */
export class OddkinContextPicker extends OddkinElement.with({
  items: prop.array<ContextItem>({ description: 'Context item records (host-owned).' }),
  accept: prop.string({
    default: '',
    description: 'File types for "Add files" (as `<input accept>`).',
  }),
  allowUrls: prop.boolean({ attribute: 'allow-urls', description: 'Offer adding links.' }),
  disabled: prop.boolean({ reflect: true, description: 'Prevents adding and removing.' }),
  strings: prop.object<Partial<typeof CONTEXT_PICKER_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'context-add': contextAddEvent, 'context-remove': contextRemoveEvent };

  /** @internal Expanded item ids (presentation state). */
  readonly _expanded = signal<ReadonlySet<string>>(new Set());
  /** @internal */
  readonly _urlError = signal('');

  /** @internal */
  get _strings(): typeof CONTEXT_PICKER_STRINGS {
    return strings(CONTEXT_PICKER_STRINGS, this.strings);
  }

  /** @internal */
  _kind(item: ContextItem): string {
    const t = this._strings;
    return item.kind === 'url' ? t.urlKind : t[item.kind];
  }

  /** @internal */
  _size(item: ContextItem): string {
    if (item.size === undefined) return '';
    const kb = item.size / 1024;
    const locale = langOf(this);
    return kb < 1024
      ? `${formatNumber(Math.max(1, Math.round(kb)), locale)} KB`
      : `${formatNumber(Math.round(kb / 102.4) / 10, locale)} MB`;
  }

  /** @internal */
  readonly _toggle = (event: Event): void => {
    const id = (event.currentTarget as HTMLElement).dataset['id'] as string;
    const next = new Set(this._expanded.peek());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._expanded.value = next;
  };
  /** @internal */
  readonly _remove = (event: Event): void => {
    const id = (event.currentTarget as HTMLElement).dataset['id'];
    if (id && !this.disabled) this.emit(contextRemoveEvent, { itemId: id });
  };
  /** @internal */
  readonly _pickFiles = (): void => {
    this.shadowRoot?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  };
  /** @internal */
  readonly _onFiles = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length && !this.disabled) this.emit(contextAddEvent, { kind: 'file', files });
  };
  /** @internal */
  readonly _addUrl = (event: Event): void => {
    event.preventDefault();
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('input[type="url"]');
    if (!input || this.disabled) return;
    const url = safeUrl(input.value, { protocols: ['https:', 'http:'], allowRelative: false });
    if (!url) {
      this._urlError.value = this._strings.invalidUrl;
      input.focus();
      return;
    }
    this._urlError.value = '';
    input.value = '';
    this.emit(contextAddEvent, { kind: 'url', url });
  };

  /** @internal */
  _label(template: keyof typeof CONTEXT_PICKER_STRINGS, item: ContextItem): string {
    return format(this._strings[template], { label: item.label });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-context-picker': OddkinContextPicker;
  }
}
