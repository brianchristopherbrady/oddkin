/**
 * Theme generation off the main thread (workbench.md §6.4, theming-and-styling.md §8): one
 * module Worker running the library's own `@oddkin/tokens/generate`. Latest wins: while a run is
 * in flight, newer drafts replace each other and only the newest is generated next; a result
 * for a superseded draft is discarded, never applied.
 */
import type { Scope } from '@oddkin/core/scope';

export interface GenerationDiagnostic {
  readonly severity?: string;
  readonly code?: string;
  readonly path?: string;
  readonly message?: string;
}

/** One role pair of the generator's contrast report (`contrastReport`, @oddkin/tokens). */
export interface ContrastView {
  readonly concern: string;
  readonly foreground: string;
  readonly background: string;
  readonly mode: string;
  readonly foregroundHex: string;
  readonly backgroundHex: string;
  readonly ratio: number;
  readonly minimum: number;
  readonly criterion: string;
  readonly status: 'pass' | 'fail' | 'exempt';
}

/** What the ramp and contrast views show for one theme or product (workbench.md §8). */
export interface ThemeViews {
  /** Each ramp step's sRGB value, by token name (`ref.<ramp>.<step>`), in the theme's order. */
  readonly ramps: readonly (readonly [string, string])[];
  readonly contrast: readonly ContrastView[];
}

export interface GenerationResult {
  readonly id: number;
  readonly ok: boolean;
  readonly css?: string;
  readonly diagnostics: readonly GenerationDiagnostic[];
  /** Generation time inside the Worker. */
  readonly ms: number;
  /** For a request with a `view`, when the library's generator reports contrast. */
  readonly views?: ThemeViews;
}

export interface ThemeGeneration {
  /**
   * Generate `draft` on its `bases` (their models, root first, merged under it as the theme's
   * files are); supersedes every earlier request that has not produced a result. With `view`, a
   * product's name or '' for the theme, the result carries that one's views.
   */
  request(draft: unknown, bases?: readonly unknown[], view?: string): void;
  readonly stats: {
    readonly sent: number;
    readonly superseded: number;
    readonly delivered: number;
  };
}

/** The Worker lives as long as `scope`. */
export function createThemeGeneration(
  workerUrl: string,
  scope: Scope,
  onResult: (result: GenerationResult) => void,
  onError: (message: string) => void,
): ThemeGeneration {
  const worker = new Worker(workerUrl, { type: 'module', name: 'oddkin-theme-studio' });
  scope.add(() => worker.terminate(), 'theme generation worker');
  const stats = { sent: 0, superseded: 0, delivered: 0 };
  let nextId = 0;
  let inFlight: number | undefined;
  let queued:
    | {
        readonly draft: unknown;
        readonly bases: readonly unknown[];
        readonly view: string | undefined;
      }
    | undefined;
  const send = (draft: unknown, bases: readonly unknown[], view?: string) => {
    inFlight = ++nextId;
    stats.sent++;
    worker.postMessage({ id: inFlight, draft, bases, view });
  };
  scope.listen(worker, 'message', (event: MessageEvent<GenerationResult>) => {
    if (event.data.id !== inFlight) return;
    inFlight = undefined;
    if (queued) {
      stats.superseded++;
      const next = queued;
      queued = undefined;
      send(next.draft, next.bases, next.view);
      return;
    }
    stats.delivered++;
    onResult(event.data);
  });
  scope.listen(worker, 'error', (event: ErrorEvent) => {
    inFlight = undefined;
    queued = undefined;
    onError(event.message || 'The theme generator could not be loaded.');
  });
  return {
    request(draft, bases = [], view) {
      if (scope.disposed) return;
      if (inFlight === undefined) send(draft, bases, view);
      else {
        if (queued) stats.superseded++;
        queued = { draft, bases, view };
      }
    },
    stats,
  };
}
