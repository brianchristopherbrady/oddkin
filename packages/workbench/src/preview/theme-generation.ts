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

export interface GenerationResult {
  readonly id: number;
  readonly ok: boolean;
  readonly css?: string;
  readonly diagnostics: readonly GenerationDiagnostic[];
  /** Generation time inside the Worker. */
  readonly ms: number;
}

export interface ThemeGeneration {
  /** Generate `draft`; supersedes every earlier request that has not produced a result. */
  request(draft: unknown): void;
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
  let queued: { readonly draft: unknown } | undefined;
  const send = (draft: unknown) => {
    inFlight = ++nextId;
    stats.sent++;
    worker.postMessage({ id: inFlight, draft });
  };
  scope.listen(worker, 'message', (event: MessageEvent<GenerationResult>) => {
    if (event.data.id !== inFlight) return;
    inFlight = undefined;
    if (queued) {
      stats.superseded++;
      const next = queued;
      queued = undefined;
      send(next.draft);
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
    request(draft) {
      if (scope.disposed) return;
      if (inFlight === undefined) send(draft);
      else {
        if (queued) stats.superseded++;
        queued = { draft };
      }
    },
    stats,
  };
}
