/**
 * A deterministic, clearly simulated transport for tests, demos, and race reproduction. Scripts
 * describe the server's events with delays; the simulated server keeps producing while the
 * client is disconnected, numbers every event (`seq`) so a resumed connection can replay an
 * overlap that the controller deduplicates, and exposes controls for acceptance failure, stop
 * outcomes and delays, decision outcomes, and history pages. Not a protocol: no network.
 */
import { toPublicError } from '../contracts/normalize.js';
import type {
  AiEvent,
  ApprovalDecision,
  AttemptTarget,
  Capabilities,
  ConversationSnapshot,
  ConversationTransport,
  DecisionOutcome,
  EventSink,
  FeedbackRecord,
  PublicError,
  SendRequest,
  StopOutcome,
} from '../contracts/types.js';

export type ScriptStep =
  /** Deliver `event` `after` ms after the previous step. */
  | { readonly after: number; readonly event: AiEvent }
  /** End the connection without a terminal event (a dropped stream). */
  | { readonly after: number; readonly drop: true }
  /** Pause until the approval is decided, then continue with the matching steps. */
  | {
      readonly after: number;
      readonly awaitDecision: string;
      readonly approve: readonly ScriptStep[];
      readonly reject: readonly ScriptStep[];
    };

export type Script = (request: SendRequest) => readonly ScriptStep[];

export interface SimulationControls {
  /** Reject the next send with this error before acceptance. */
  failNextSend?: PublicError | undefined;
  /** ms before a send is accepted. */
  acceptDelay: number;
  stopBehavior: 'cancel' | 'already-finished' | 'unknown' | 'fail';
  stopDelay: number;
  decisionOutcome: DecisionOutcome | 'fail';
  decisionDelay: number;
  /** Events re-delivered on resume to exercise deduplication. */
  replayOverlap: number;
  feedbackDelay: number;
  failFeedback: boolean;
  historyDelay: number;
}

export interface SimulatedTransport extends ConversationTransport {
  readonly simulated: true;
  readonly controls: SimulationControls;
  /** Pending timers across all simulated runs (zero when idle). */
  readonly pendingTimers: number;
  /** Simulate the server pushing an event for an attempt now (e.g. a late event). */
  inject(attemptId: string, event: AiEvent): void;
  /** Stop all timers. */
  dispose(): void;
}

interface Run {
  readonly target: AttemptTarget;
  queue: ScriptStep[];
  /** Events the server produced, in order; index = seq. */
  readonly produced: AiEvent[];
  delivered: number;
  sink: EventSink | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** The server stopped producing (terminal event, cancellation, or drop). */
  ended: boolean;
  waiting: string | undefined;
  branches: { approve: readonly ScriptStep[]; reject: readonly ScriptStep[] } | undefined;
  dropped: boolean;
}

const TERMINAL = new Set(['finish', 'abort', 'error']);
const DEFAULT_CAPABILITIES: Capabilities = {
  send: { available: true },
  stop: { available: true },
  disconnect: { available: true },
  reconnect: { available: true },
  resume: { available: true },
  retry: { available: true },
  regenerate: { available: true },
  edit: { available: true },
  switchBranch: { available: true },
  respondToApproval: { available: true },
  history: { available: true },
  feedback: { available: true },
  attachments: { available: true },
};

export interface SimulationOptions {
  readonly script: Script;
  readonly capabilities?: Capabilities;
  readonly controls?: Partial<SimulationControls>;
  /** Pages returned by `loadHistory`, newest page first. */
  readonly history?: readonly ConversationSnapshot[];
}

export function createSimulatedTransport(options: SimulationOptions): SimulatedTransport {
  const controls: SimulationControls = {
    acceptDelay: 120,
    stopBehavior: 'cancel',
    stopDelay: 250,
    decisionOutcome: 'accepted',
    decisionDelay: 250,
    replayOverlap: 3,
    feedbackDelay: 200,
    failFeedback: false,
    historyDelay: 300,
    ...options.controls,
  };
  const runs = new Map<string, Run>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const historyPages = [...(options.history ?? [])];
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id);
        resolve();
      }, ms);
      timers.add(id);
    });
  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const produce = (run: Run, event: AiEvent) => {
    if (run.ended) return;
    const seq = run.produced.length;
    run.produced.push({ ...event, seq });
    if (TERMINAL.has(event.type)) run.ended = true;
    flush(run);
  };

  const flush = (run: Run) => {
    // Pushes even to inactive sinks: isolating late events is the controller's job.
    while (run.sink && run.delivered < run.produced.length) {
      run.sink.push(run.produced[run.delivered++] as AiEvent);
    }
    if (run.sink && run.ended && run.delivered >= run.produced.length) {
      const sink = run.sink;
      run.sink = undefined;
      sink.close();
    }
  };

  const advance = (run: Run) => {
    if (run.ended || run.waiting || run.timer !== undefined) return;
    const step = run.queue.shift();
    if (!step) return;
    run.timer = later(step.after, () => {
      run.timer = undefined;
      if (run.ended) return;
      if ('event' in step) produce(run, step.event);
      else if ('drop' in step) {
        run.dropped = true;
        const sink = run.sink;
        run.sink = undefined;
        sink?.close();
      } else {
        run.waiting = step.awaitDecision;
        run.branches = { approve: step.approve, reject: step.reject };
        return;
      }
      advance(run);
    });
  };

  const transport: SimulatedTransport = {
    simulated: true,
    controls,
    capabilities: { ...DEFAULT_CAPABILITIES, ...options.capabilities },
    get pendingTimers() {
      return timers.size;
    },
    async send(request: SendRequest, sink: EventSink) {
      await wait(controls.acceptDelay);
      const failure = controls.failNextSend;
      if (failure) {
        controls.failNextSend = undefined;
        throw failure;
      }
      const run: Run = {
        target: {
          conversationId: request.conversationId,
          runId: request.runId,
          attemptId: request.attemptId,
        },
        queue: [...options.script(request)],
        produced: [],
        delivered: 0,
        sink,
        timer: undefined,
        ended: false,
        waiting: undefined,
        branches: undefined,
        dropped: false,
      };
      runs.set(request.attemptId, run);
      produce(run, { type: 'attempt-accepted' });
      advance(run);
    },
    disconnect(target) {
      const run = runs.get(target.attemptId);
      if (run) run.sink = undefined;
    },
    async resume(target, sink) {
      await wait(controls.acceptDelay);
      const run = runs.get(target.attemptId);
      if (!run) throw { code: 'ai.resume.notFound', message: 'There is no response to resume.' };
      run.sink = sink;
      run.dropped = false;
      run.delivered = Math.max(0, run.delivered - controls.replayOverlap);
      flush(run);
    },
    async stop(target): Promise<StopOutcome> {
      await wait(controls.stopDelay);
      const run = runs.get(target.attemptId);
      if (!run) return 'not-found';
      if (run.ended) return 'already-finished';
      switch (controls.stopBehavior) {
        case 'fail':
          throw { code: 'ai.stop.failed', message: 'The stop request failed.', retryable: true };
        case 'unknown':
          return 'unknown';
        case 'already-finished':
          return 'already-finished';
        case 'cancel':
          if (run.timer !== undefined) clearTimeout(run.timer);
          timers.delete(run.timer as ReturnType<typeof setTimeout>);
          run.timer = undefined;
          run.queue = [];
          run.waiting = undefined;
          produce(run, { type: 'abort', reason: 'stopped' });
          return 'cancelled';
      }
    },
    async decide(decision: ApprovalDecision): Promise<DecisionOutcome> {
      await wait(controls.decisionDelay);
      if (controls.decisionOutcome === 'fail')
        throw toPublicError(
          {
            code: 'ai.approval.failed',
            message: 'The decision could not be recorded.',
            retryable: true,
          },
          {
            code: 'ai.approval.failed',
            message: 'The decision could not be recorded.',
          },
        );
      const outcome = controls.decisionOutcome;
      const run = runs.get(decision.attemptId);
      if (outcome === 'accepted' && run && run.waiting === decision.approvalId && run.branches) {
        const branch = decision.decision === 'approve' ? run.branches.approve : run.branches.reject;
        run.waiting = undefined;
        run.branches = undefined;
        produce(run, {
          type: 'approval-resolved',
          approvalId: decision.approvalId,
          revision: decision.revision,
          status: decision.decision === 'approve' ? 'approved' : 'rejected',
        });
        run.queue = [...branch, ...run.queue];
        advance(run);
      }
      return outcome;
    },
    async loadHistory(conversationId) {
      await wait(controls.historyDelay);
      const page = historyPages.shift();
      if (!page) return { conversationId, messages: [], hasMoreHistory: false };
      return { ...page, hasMoreHistory: historyPages.length > 0 };
    },
    async submitFeedback(_feedback: FeedbackRecord) {
      await wait(controls.feedbackDelay);
      if (controls.failFeedback)
        throw {
          code: 'ai.feedback.failed',
          message: 'Feedback could not be sent.',
          retryable: true,
        };
    },
    inject(attemptId, event) {
      const run = runs.get(attemptId);
      if (!run) return;
      run.ended = false;
      produce(run, event);
    },
    dispose() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const run of runs.values()) run.timer = undefined;
    },
  };
  return transport;
}

// ---- Script helpers ----

/** Split text into streamed deltas of `size` code points (never inside a surrogate pair). */
export function chunkText(text: string, size = 6): string[] {
  const points = Array.from(text);
  const out: string[] = [];
  for (let i = 0; i < points.length; i += size) out.push(points.slice(i, i + size).join(''));
  return out;
}

/** Steps streaming `text` into one text part. */
export function streamTextSteps(partId: string, text: string, every = 30, size = 6): ScriptStep[] {
  return [
    { after: every, event: { type: 'text-start', partId } },
    ...chunkText(text, size).map((delta) => ({
      after: every,
      event: { type: 'text-delta' as const, partId, delta },
    })),
    { after: every, event: { type: 'text-end', partId } },
  ];
}
