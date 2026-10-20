/**
 * Page suspension and restoration (core-contracts.md §9.1, ADR 0035). `pageLifecycle(app)` is an
 * explicit application service: used in `setup`, it listens to `pagehide`, `pageshow`, and
 * `visibilitychange` once on the run's scope (and to `freeze`/`resume` where the browser has them),
 * suspends the application's services while the page is in the back/forward cache or frozen, and
 * resumes them on restoration. It never disposes anything and never listens to `unload` or
 * `beforeunload`: suspension is not disposal, and a page the browser discards runs no code.
 * Importing this module adds no listener. Imports without DOM globals.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError } from '@oddkin/core/diagnostics';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { App, AppService } from '../app/app.js';
import { noteRestoration } from './restorations.js';

export interface PageLifecycleState {
  /** `document.visibilityState` is `visible`. */
  readonly visible: boolean;
  /**
   * Between a `pagehide` with `persisted` (the page entering the back/forward cache) or a
   * `freeze`, and the `pageshow` with `persisted` or `resume` that ends it. The application's
   * services are suspended meanwhile.
   */
  readonly suspended: boolean;
  /** Restorations from the back/forward cache (`pageshow` with `persisted`) seen by this service. */
  readonly restorations: number;
}

export interface PageLifecycleOptions {
  /**
   * Also suspend on the Page Lifecycle `freeze` event and resume on `resume`, where the browser
   * fires them (Chromium). Default `true`.
   */
  readonly freeze?: boolean;
  /** The window whose page lifecycle is followed. Default `globalThis`. */
  readonly window?: Window;
}

export interface PageLifecycle extends AppService {
  readonly state: Readable<PageLifecycleState>;
}

class PageLifecycleImpl implements PageLifecycle {
  readonly state: Readable<PageLifecycleState>;
  readonly #app: App<unknown>;
  readonly #options: PageLifecycleOptions;
  readonly #state = signal<PageLifecycleState>({
    visible: true,
    suspended: false,
    restorations: 0,
  });

  constructor(app: App<unknown>, options: PageLifecycleOptions) {
    this.#app = app;
    this.#options = options;
    this.state = computed(() => this.#state.value);
  }

  connect(scope: Scope): void {
    if (scope.disposed) return;
    const win = this.#options.window ?? (globalThis as { window?: Window }).window;
    const doc = win?.document;
    if (!win || !doc) {
      throw new OddkinError(
        'app.lifecycle.environment',
        DEV
          ? 'pageLifecycle() needs a window with a document; pass pageLifecycle(app, { window }) outside a browser page.'
          : '',
      );
    }
    // Suspended while in the back/forward cache, or while frozen; both may overlap (Chromium
    // fires freeze after pagehide and resume before pageshow).
    let cached = false;
    let frozen = false;
    const update = (restored = false) => {
      const previous = this.#state.peek();
      const suspended = cached || frozen;
      this.#state.value = {
        visible: doc.visibilityState === 'visible',
        suspended,
        restorations: previous.restorations + (restored ? 1 : 0),
      };
      if (suspended === previous.suspended) return;
      untracked(() => (suspended ? this.#app.suspend() : this.#app.resume()));
    };
    update();
    scope.listen<PageTransitionEvent>(win, 'pagehide', (event) => {
      // Without `persisted` the page is being unloaded for good: nothing is disposed or suspended.
      if (!event.persisted) return;
      cached = true;
      update();
    });
    scope.listen<PageTransitionEvent>(win, 'pageshow', (event) => {
      if (!event.persisted) return; // a fresh document: nothing to resume
      cached = false;
      frozen = false;
      update(true);
      noteRestoration(event);
    });
    scope.listen(doc, 'visibilitychange', () => update());
    if (this.#options.freeze !== false && 'onfreeze' in doc) {
      scope.listen(doc, 'freeze', () => {
        frozen = true;
        update();
      });
      scope.listen(doc, 'resume', () => {
        frozen = false;
        update();
      });
    }
    scope.add(() => {
      this.#state.value = { ...this.#state.peek(), suspended: false };
    }, 'page lifecycle');
  }
}

/**
 * Follow the page lifecycle for `app`: use it in `setup` (`use(pageLifecycle(app))`). While the page
 * is in the back/forward cache (or frozen) the application is suspended (`app.suspend()`), and it
 * resumes on restoration; resources with `revalidateOnRestore` then load again. Stopping the
 * application removes the listeners.
 */
export function pageLifecycle(
  app: App<unknown>,
  options: PageLifecycleOptions = {},
): PageLifecycle {
  return new PageLifecycleImpl(app, options);
}
