import {
  OddkinElement,
  event,
  prop,
  type ElementEvents,
  type EventDetail,
} from '@oddkin/core/element';
import { signal, untracked } from '@oddkin/core/reactive';
import { FocusRecovery } from '@oddkin/core/controllers/focus';
import type { Scope } from '@oddkin/core/scope';
import type { PartOf } from '../contracts/types.js';
import { citationOpenEvent } from '../events.js';
import { strings } from '../internal/strings.js';

export type SourceRecord = PartOf<'source'>;

export const CITATION_STRINGS = {
  source: 'Source {index}: {title}',
  unresolved: 'Unresolved source reference {id}',
  unavailable:
    'This source is not available. The response referenced it, but no source record was supplied.',
  open: 'Open source',
  show: 'Show in sources',
  close: 'Close source preview',
  untitled: 'Untitled source',
};

/** Internal: asks the nearest message to reveal a source after an uncancelled `odd-citation-open`. */
export const revealSourceEvent = event<{ readonly sourceId: string }>('odd-source-reveal', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description: 'Default action of odd-citation-open: the nearest message reveals the source.',
});

/**
 * An inline citation marker with an accessible source preview in an anchored popover. Choose
 * `presentation="inline"` when the parent allocates a growing details region. A missing source
 * record renders as an unresolved reference; nothing is invented.
 *
 * @csspart trigger - The marker button.
 * @csspart preview - The source preview.
 * @a11y The marker is a button named after the source ("Source 2: Title"); `aria-expanded` reflects the preview. The default preview is a named non-modal dialog composed from odd-popover, available without hover. Inline presentation is a named group after the marker. Presentation changes wait until an open preview closes, preserving its active interaction.
 * @keyboard Enter or Space toggles the preview; Tab reaches its controls. Escape closes it and returns focus to the marker. Pressing outside the popover dismisses it without taking focus from the outside control.
 * @useFor Inline references from generated text to its sources.
 * @notFor Footnotes in authored documents; use links.
 * @customization 1 2
 * @category AI
 */
export class OddkinCitation extends OddkinElement.with({
  sourceId: prop.string({
    default: '',
    attribute: 'source-id',
    description: 'Citation key (`[^key]`).',
  }),
  index: prop.number({ default: 0, description: 'Display number; 0 shows the key.' }),
  source: prop.object<SourceRecord>({
    description: 'The source record; undefined renders an unresolved reference.',
  }),
  presentation: prop.enum(['popover', 'inline'], {
    default: 'popover',
    reflect: true,
    description:
      'Popover: an anchored source preview. Inline: details in the parent’s allocated flow. Changes while open take effect after the preview closes.',
  }),
  strings: prop.object<Partial<typeof CITATION_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open' };
  static override events = {
    'odd-citation-open': citationOpenEvent,
    'odd-source-reveal': revealSourceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinCitation>;

  /** @internal Local presentation state. */
  readonly _open = signal(false);
  /** @internal The chosen presentation stays stable until its open preview closes. */
  readonly _presentation = signal<'popover' | 'inline'>('popover');
  #restoreAfterClose = false;
  readonly #focusRecovery = new FocusRecovery({
    root: () => this.shadowRoot,
    fallback: () => this.shadowRoot?.querySelector<HTMLElement>('[part="trigger"]'),
  });

  #applyPresentation(restoreFocus = false): void {
    if (this._presentation.peek() === this.presentation) return;
    this.#restoreAfterClose = restoreFocus;
    this._presentation.value = this.presentation;
  }

  /** @internal */
  get _strings(): typeof CITATION_STRINGS {
    return strings(CITATION_STRINGS, this.strings);
  }

  /** @internal */
  readonly _toggle = (): void => {
    // Safari does not focus a pointer-activated button. Capture the logical invoker before the
    // native popovertarget action opens the public popover and records its return-focus target.
    this.shadowRoot?.querySelector<HTMLButtonElement>('[part="trigger"]')?.focus({
      preventScroll: true,
    });
    if (this._presentation.peek() === 'inline') {
      this._open.value = !this._open.peek();
      if (!this._open.peek()) this.#applyPresentation(true);
    }
  };

  /** @internal Native toggle is authoritative for Escape, outside presses, and the close control. */
  readonly _onPopoverToggle = (event: ToggleEvent): void => {
    if (event.target !== event.currentTarget) return;
    const open = event.newState === 'open';
    // A pointer close in WebKit can clear native invoker focus. Retain a guarded fallback for
    // this close, including when applying a pending presentation replaces the old surface.
    if (!open) this.#restoreAfterClose = true;
    this._open.value = open;
    if (!this._open.peek()) {
      this.#applyPresentation(true);
    }
  };

  #closePreview(restoreFocus = false): void {
    if (this._presentation.peek() === 'popover')
      this.shadowRoot?.querySelector<HTMLElementTagNameMap['odd-popover']>('odd-popover')?.close();
    else {
      this._open.value = false;
      this.#applyPresentation(restoreFocus);
    }
  }

  /** @internal */
  readonly _show = (): void => {
    const sourceId = this.sourceId;
    const resolved = !!this.source;
    if (this.emit(citationOpenEvent, { sourceId, resolved }) && resolved) {
      this.emit(revealSourceEvent, { sourceId });
      this.#closePreview();
    }
  };

  protected override connected(scope: Scope): void {
    this._open.value = false;
    this._presentation.value = this.presentation;
    scope.listen(this, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this._presentation.peek() === 'inline' && this._open.peek()) {
        this.#closePreview(true);
        this.shadowRoot?.querySelector<HTMLElement>('[part="trigger"]')?.focus();
        event.preventDefault();
        event.stopPropagation();
      }
    });
    // Inline details close when focus leaves. Popover dismissal and focus return belong to the
    // public odd-popover; doing both would take focus from an outside pointer destination.
    scope.listen(this, 'focusout', (event: FocusEvent) => {
      if (this._presentation.peek() !== 'inline') return;
      const next = event.relatedTarget as Node | null;
      if (next && (this.contains(next) || this.shadowRoot?.contains(next))) return;
      if (next) this.#closePreview();
    });
    scope.add(() => {
      this._open.value = false;
      this.#restoreAfterClose = false;
    }, 'citation preview state');
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    // The native surface may already be open before its queued toggle event updates _open.
    const showing = this.shadowRoot?.querySelector('odd-popover')?.matches(':popover-open');
    if (changes.has('presentation') && !this._open.peek() && !showing) this.#applyPresentation();
  }

  protected override mounted(scope: Scope): void {
    scope.use(this.#focusRecovery);
    scope.effect(
      () => {
        // Open and effective presentation are signal state: a property-only updated hook does
        // not run for this render. Restore after native close or replacement has committed.
        void this._presentation.value;
        void this._open.value;
        if (!this.#restoreAfterClose) return;
        this.#restoreAfterClose = false;
        untracked(() => {
          let active = this.ownerDocument.activeElement;
          while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
          if (!active || active === this.ownerDocument.body || this.shadowRoot?.activeElement)
            this.shadowRoot?.querySelector<HTMLButtonElement>('[part="trigger"]')?.focus({
              preventScroll: true,
            });
        });
      },
      { phase: 'post', name: '<odd-citation> presentation focus' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-citation': OddkinCitation;
  }
  interface GlobalEventHandlersEventMap {
    'odd-source-reveal': CustomEvent<EventDetail<typeof revealSourceEvent>>;
  }
}
