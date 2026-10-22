import { createScope, type Scope } from '@oddkin/core/scope';
import type { ComponentPageData } from '../data/types.js';
import { createIsolatedPreview } from '../preview/frame.js';

const text = (value: unknown) => (value instanceof Error ? value.message : String(value));

export class WorkbenchComponentPreview extends HTMLElement {
  #scope: Scope | undefined;
  #page: ComponentPageData | undefined;
  #frameUrl = '';
  readonly #container: HTMLDivElement;
  readonly #status: HTMLParagraphElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent =
      ':host{display:block}iframe{display:block;inline-size:100%;block-size:24rem;border:0}p{margin:0.5rem 0;color:inherit}';
    this.#container = document.createElement('div');
    this.#status = document.createElement('p');
    this.#status.setAttribute('role', 'status');
    root.append(style, this.#container, this.#status);
  }

  set page(value: ComponentPageData) {
    const registration = value.enrichment?.['registration'];
    const sameRegistration =
      this.#page?.tag === value.tag && this.#page.enrichment?.['registration'] === registration;
    this.#page = value;
    if (!sameRegistration) this.#start();
  }

  set frameUrl(value: string) {
    if (this.#frameUrl === value) return;
    this.#frameUrl = value;
    this.#start();
  }

  connectedCallback(): void {
    this.#start();
  }

  disconnectedCallback(): void {
    this.#scope?.dispose();
    this.#scope = undefined;
  }

  #start(): void {
    this.#scope?.dispose();
    this.#scope = undefined;
    this.#container.replaceChildren();
    this.#status.textContent = '';
    this.#status.setAttribute('role', 'status');
    if (!this.isConnected || !this.#page || !this.#frameUrl) return;

    const page = this.#page;
    const registration = page.enrichment?.['registration'];
    if (typeof registration !== 'string') {
      this.#status.textContent = 'Preview unavailable: no registration entry is documented.';
      this.#status.setAttribute('role', 'status');
      return;
    }

    const scope = createScope({ name: `workbench-preview:${this.#page.tag}` });
    this.#scope = scope;
    try {
      const preview = createIsolatedPreview({
        document: this.ownerDocument,
        container: this.#container,
        frameUrl: this.#frameUrl,
        title: `${page.tag} preview`,
      });
      scope.add(() => preview.dispose(), 'isolated preview');
      const declaredEvents = page.declaration['events'];
      const events = Array.isArray(declaredEvents)
        ? declaredEvents.flatMap((event: unknown): string[] => {
            if (typeof event !== 'object' || event === null || Array.isArray(event)) return [];
            const name = (event as Record<string, unknown>)['name'];
            return typeof name === 'string' ? [name] : [];
          })
        : [];
      void preview.ready
        .then(() =>
          preview.request('mount', {
            tag: page.tag,
            registration,
            example: `example:${page.tag}/default`,
            events,
          }),
        )
        .then(() => {
          if (!scope.disposed) this.#status.textContent = '';
        })
        .catch((error: unknown) => {
          if (!scope.disposed) {
            this.#status.setAttribute('role', 'alert');
            this.#status.textContent = `Preview unavailable: ${text(error)}`;
          }
        });
    } catch (error) {
      scope.dispose();
      this.#scope = undefined;
      this.#status.setAttribute('role', 'alert');
      this.#status.textContent = `Preview unavailable: ${text(error)}`;
    }
  }
}
