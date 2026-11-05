/**
 * A team's own app with the draft (P1.5 item 6): Theme Studio opens the app on its dev server
 * (`studio.app`, which only `oddkin workbench dev` offers) and sends each generated CSS to the
 * window it opened, where `@oddkin/workbench/theme-link` replaces one stylesheet with it. Loaded
 * only when the page data offers an app. Messages go only to the app's origin, and only a
 * `ready` from the window opened, at that origin, is taken.
 */
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';
import type { ThemeLinkMessage } from '../theme-link/index.js';

export class ThemeApp {
  readonly #origin: string;
  readonly #status = signal('');
  #window: Window | null = null;
  #ready = false;
  #css: string | undefined;

  /** `css`: the newest valid CSS so far, if any. */
  constructor(
    readonly url: string,
    scope: Scope,
    css?: string,
  ) {
    this.#css = css;
    this.#origin = new URL(url).origin;
    scope.listen(window, 'message', (event: MessageEvent) => {
      const data = event.data as Readonly<Record<string, unknown>> | null;
      if (
        event.source !== this.#window ||
        event.origin !== this.#origin ||
        data?.['protocol'] !== 'oddkin.theme-link' ||
        data['type'] !== 'ready'
      )
        return;
      this.#ready = true;
      this.#send();
    });
  }

  /** The newest valid CSS, sent to the app once it is open and ready. */
  applied(css: string): void {
    this.#css = css;
    this.#send();
  }

  #send(): void {
    const target = this.#window;
    if (!target || !this.#ready || this.#css === undefined) return;
    if (target.closed) {
      this.#status.value = 'The app is closed.';
      return;
    }
    const message: ThemeLinkMessage = {
      protocol: 'oddkin.theme-link',
      version: 1,
      type: 'css',
      css: this.#css,
    };
    target.postMessage(message, this.#origin);
    this.#status.value = `Showing the draft in ${this.#origin}.`;
  }

  #open(): void {
    this.#ready = false;
    this.#window = window.open(this.url, 'oddkin-theme-app');
    this.#status.value = this.#window
      ? `Opened ${this.url}; waiting for its @oddkin/workbench/theme-link.`
      : 'The browser did not open the app: allow pop-ups for this page.';
  }

  render() {
    return html`<div class="wb-toolbar">
        <button type="button" @click=${() => this.#open()}>Open ${this.url} with the draft</button>
      </div>
      <p id="ts-app-status" class="wb-status" role="status">${this.#status.value}</p>`;
  }
}
