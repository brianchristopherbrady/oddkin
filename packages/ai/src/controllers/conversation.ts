/**
 * `ConversationController` — the Oddkin-owned authoritative store for one conversation surface
 * when the application does not own conversation state itself. It ingests normalized events
 * from a `ConversationTransport`, routes them per attempt, message, part, and tool, isolates
 * late events, and keeps transport, attempt, tool, approval, and stop state independent.
 * DOM-free. Contract: docs/architecture/ai-interaction.md §4–§6.
 */
import { DEV } from '../internal/dev.js';
import { signal, type Readable, type Signal } from '@oddkin/core/reactive';
import {
  can,
  intersectCapabilities,
  normalizeApproval,
  normalizeArtifact,
  normalizeMessage,
  normalizePart,
  normalizeQuestion,
  normalizeSnapshot,
  toPublicError,
  type NormalizeDiagnostic,
  type Normalized,
} from '../contracts/normalize.js';
import type {
  AiEvent,
  ApprovalRecord,
  ApprovalStatus,
  AttemptRecord,
  AttemptRelation,
  AttemptStatus,
  AttemptTarget,
  AttemptWait,
  BranchPosition,
  Capabilities,
  CapabilityName,
  ConversationSnapshot,
  ConversationState,
  ConversationTransport,
  DecisionOutcome,
  EventSink,
  ExternalSource,
  FeedbackRecord,
  JsonValue,
  MessagePart,
  MessageRecord,
  PublicError,
  QuestionRecord,
  QuestionStatus,
  ToolCallRecord,
  ToolStatus,
  WaitRequest,
} from '../contracts/types.js';
import { createId } from '../internal/ids.js';
import {
  APPROVAL_TRANSITIONS,
  ATTEMPT_TRANSITIONS,
  QUESTION_TRANSITIONS,
  TOOL_TRANSITIONS,
  applyStopOutcome,
  awaitsPerson,
  canTransition,
  isActive,
  isTerminal,
  stopAfterTerminal,
} from './transitions.js';

export interface ConversationControllerOptions {
  readonly transport: ConversationTransport;
  readonly conversationId?: string;
  /** Application policy; narrows (never widens) what the transport supports. */
  readonly capabilities?: Capabilities;
  readonly createId?: (prefix: string) => string;
  /** Dropped, duplicate, invalid, and stale input. Never shown to users by default. */
  readonly onDiagnostic?: (diagnostic: ControllerDiagnostic) => void;
}

export interface ControllerDiagnostic extends NormalizeDiagnostic {
  readonly attemptId?: string | undefined;
}

export type ActionResult =
  | { readonly ok: true; readonly attemptId?: string }
  | {
      readonly ok: false;
      readonly reason: 'unavailable' | 'stale' | 'duplicate' | 'invalid' | 'rejected' | 'busy';
      readonly error?: PublicError;
    };

export interface SendInput {
  readonly text: string;
  readonly files?: readonly Extract<MessagePart, { type: 'file' }>[];
}

const SEND_FAILED: PublicError = {
  code: 'ai.send.failed',
  message: 'The message could not be sent. Try again.',
  retryable: true,
};
const DECISION_FAILED: PublicError = {
  code: 'ai.approval.failed',
  message: 'The decision could not be submitted. Try again.',
  retryable: true,
};
const ANSWER_FAILED: PublicError = {
  code: 'ai.question.failed',
  message: 'The answer could not be sent. Try again.',
  retryable: true,
};
const STREAM_FAILED: PublicError = {
  code: 'ai.stream.failed',
  message: 'The response failed. Try again.',
  retryable: true,
};

/** Replay identity per attempt, bounded. */
interface ReplayState {
  seq: number;
  ids: Set<string>;
  order: string[];
}

/** The records a person responds to: approvals and questions share one lifecycle (ADR 0049 §5). */
type Requests = 'approvals' | 'questions';
type RequestRecord = ApprovalRecord | QuestionRecord;
const REQUESTS: readonly Requests[] = ['approvals', 'questions'];

/** How one kind of response travels: its capability, transport call, and records. */
interface RequestReply {
  readonly capability: CapabilityName;
  readonly send:
    ((target: AttemptTarget, record: RequestRecord) => Promise<DecisionOutcome>) | undefined;
  /** Refuses the response before anything is sent, when it does not fit the record. */
  readonly check?: (record: RequestRecord) => ActionResult | undefined;
  /** The record while the response is on its way (its status is already `submitting`). */
  readonly submitting: (record: RequestRecord) => RequestRecord;
  /** The status once the backend accepted the response. */
  readonly accepted: ApprovalStatus | QuestionStatus;
  readonly failure: PublicError;
}
const MAX_EVENT_IDS = 4096;
/** Events still meaningful after an attempt ended: reconciliation and bookkeeping only. */
const AFTER_TERMINAL = new Set([
  'snapshot',
  'usage',
  'metadata',
  'approval-resolved',
  'question-resolved',
  'artifact',
]);

class Sink implements EventSink {
  #open = true;
  constructor(
    readonly target: AttemptTarget,
    private readonly owner: ConversationController,
    private readonly generation: number,
  ) {}
  get active(): boolean {
    return this.#open && this.owner._accepts(this);
  }
  /** @internal */
  get _generation(): number {
    return this.generation;
  }
  push(event: AiEvent): void {
    this.owner._ingest(this, event);
  }
  close(): void {
    if (!this.#open) return;
    this.owner._closed(this);
    this.#open = false;
  }
  /** @internal Called when the controller replaces or disconnects this sink. */
  _invalidate(): void {
    this.#open = false;
  }
}

export class ConversationController implements ExternalSource<ConversationState> {
  readonly #transport: ConversationTransport;
  readonly #id: (prefix: string) => string;
  readonly #diagnose: ((d: ControllerDiagnostic) => void) | undefined;
  readonly #state: Signal<ConversationState>;
  /** The current immutable snapshot as an Oddkin readable. */
  readonly state: Readable<ConversationState>;

  #policy: Capabilities | undefined;
  #generation = 0;
  #messages = new Map<string, MessageRecord>();
  #children = new Map<string, string[]>();
  #preferred = new Map<string, string>();
  #leaf: string | undefined;
  #sinks = new Map<string, Sink>();
  #replay = new Map<string, ReplayState>();
  #stepStart = new Map<string, number>();
  /**
   * Attempts whose stream ended paused for input (`finish` with `awaiting-input`): they wait without
   * a stream until new events arrive. `true` when requests were open at the pause.
   */
  #paused = new Map<string, boolean>();
  #pendingResponses = new Set<string>();
  #pendingStops = new Map<string, number>();
  #disposed = false;

  constructor(options: ConversationControllerOptions) {
    this.#transport = options.transport;
    this.#id = options.createId ?? createId;
    this.#diagnose = options.onDiagnostic;
    this.#policy = options.capabilities;
    this.#state = signal<ConversationState>({
      ...this.#empty(options.conversationId ?? this.#id('conversation')),
      capabilities: this.#capabilities(),
    });
    this.state = this.#state;
  }

  // ---- ExternalSource ----

  getSnapshot(): ConversationState {
    return this.#state.peek();
  }

  subscribe(listener: () => void): () => void {
    let last = this.#state.peek();
    let active = true;
    // A plain listener contract for non-Oddkin consumers; notifications are synchronous after commit.
    const check = () => {
      if (!active) return;
      const next = this.#state.peek();
      if (next !== last) {
        last = next;
        listener();
      }
    };
    this.#listeners.add(check);
    return () => {
      active = false;
      this.#listeners.delete(check);
    };
  }
  readonly #listeners = new Set<() => void>();

  // ---- Loading ----

  /**
   * Replace the conversation with a validated snapshot. A different conversation id isolates
   * every in-flight stream, stop, and decision of the previous one.
   */
  load(raw: unknown): Normalized<ConversationSnapshot> {
    const result = normalizeSnapshot(raw);
    for (const d of result.diagnostics) this.#report(d);
    if (!result.ok || !result.value) return result;
    const snapshot = result.value;
    this.#isolate();
    this.#messages = new Map(snapshot.messages.map((msg) => [msg.id, msg]));
    this.#rebuildChildren();
    this.#leaf =
      snapshot.activeLeafId && this.#messages.has(snapshot.activeLeafId)
        ? snapshot.activeLeafId
        : this.#deepest(undefined);
    const base = this.#empty(snapshot.conversationId);
    this.#commit({
      ...base,
      tools: Object.fromEntries((snapshot.tools ?? []).map((t) => [t.toolCallId, t])),
      approvals: Object.fromEntries((snapshot.approvals ?? []).map((a) => [a.approvalId, a])),
      questions: Object.fromEntries((snapshot.questions ?? []).map((q) => [q.questionId, q])),
      artifacts: Object.fromEntries((snapshot.artifacts ?? []).map((a) => [a.artifactId, a])),
      hasMoreHistory: snapshot.hasMoreHistory ?? false,
      history: snapshot.hasMoreHistory ? 'idle' : 'complete',
    });
    return result;
  }

  /** Start an empty conversation, isolating the previous one. */
  reset(conversationId = this.#id('conversation')): void {
    this.#isolate();
    this.#messages = new Map();
    this.#children = new Map();
    this.#leaf = undefined;
    this.#commit(this.#empty(conversationId));
  }

  /** Replace the application capability policy (narrowing only). */
  setCapabilities(capabilities: Capabilities | undefined): void {
    this.#policy = capabilities;
    this.#capabilityCache = undefined;
    this.#commit({ ...this.#state.peek() });
  }

  // ---- Sending ----

  /**
   * Send a user message and start a new attempt. Resolves when the backend accepted or rejected
   * the request. A rejected (never accepted) request removes the optimistic messages so the
   * composer's preserved draft stays the single copy of the content.
   */
  async send(input: SendInput): Promise<ActionResult> {
    const state = this.#state.peek();
    if (!can(state.capabilities, 'send')) return { ok: false, reason: 'unavailable' };
    if (!input.text.trim() && !input.files?.length) return { ok: false, reason: 'invalid' };
    if (
      state.activeAttemptId &&
      isActive(state.attempts[state.activeAttemptId]?.status ?? 'completed')
    )
      return { ok: false, reason: 'busy' };
    const prompt: MessageRecord = {
      id: this.#id('msg'),
      role: 'user',
      ...(this.#leaf ? { parentId: this.#leaf } : {}),
      parts: [
        ...(input.files ?? []),
        ...(input.text
          ? [
              {
                type: 'text' as const,
                id: this.#id('part'),
                text: input.text,
                state: 'done' as const,
              },
            ]
          : []),
      ],
    };
    return this.#start(prompt, 'new', undefined, true);
  }

  /** Retry a failed, interrupted, or cancelled attempt as a new linked attempt. */
  retry(attemptId: string): Promise<ActionResult> {
    return this.#again(attemptId, 'retry');
  }

  /** Generate an alternative answer; the previous one stays reachable as a branch. */
  regenerate(messageId: string): Promise<ActionResult> {
    const message = this.#messages.get(messageId);
    const attemptId = message?.attemptId;
    if (!message || message.role !== 'assistant' || !attemptId)
      return Promise.resolve({ ok: false, reason: 'invalid' });
    return this.#again(attemptId, 'regenerate');
  }

  /** Edit a user message: a new sibling branch and a new attempt; the original is preserved. */
  async edit(messageId: string, text: string): Promise<ActionResult> {
    const state = this.#state.peek();
    const original = this.#messages.get(messageId);
    if (!original || original.role !== 'user') return { ok: false, reason: 'invalid' };
    if (!can(state.capabilities, 'edit')) return { ok: false, reason: 'unavailable' };
    if (
      state.activeAttemptId &&
      isActive(state.attempts[state.activeAttemptId]?.status ?? 'completed')
    )
      return { ok: false, reason: 'busy' };
    const prompt: MessageRecord = {
      id: this.#id('msg'),
      role: 'user',
      ...(original.parentId ? { parentId: original.parentId } : {}),
      parts: [
        ...original.parts.filter((p) => p.type === 'file'),
        { type: 'text', id: this.#id('part'), text, state: 'done' },
      ],
    };
    return this.#start(prompt, 'edit', undefined, false);
  }

  async #again(attemptId: string, relation: 'retry' | 'regenerate'): Promise<ActionResult> {
    const state = this.#state.peek();
    const previous = state.attempts[attemptId];
    if (!previous) return { ok: false, reason: 'invalid' };
    if (!can(state.capabilities, relation)) return { ok: false, reason: 'unavailable' };
    if (isActive(previous.status)) return { ok: false, reason: 'busy' };
    const prompt = this.#messages.get(previous.promptId);
    if (!prompt) return { ok: false, reason: 'invalid' };
    return this.#start(prompt, relation, previous.attemptId, false);
  }

  async #start(
    prompt: MessageRecord,
    relation: AttemptRelation,
    parentAttemptId: string | undefined,
    optimistic: boolean,
  ): Promise<ActionResult> {
    const state = this.#state.peek();
    const runId =
      relation === 'new' || relation === 'edit'
        ? this.#id('run')
        : (state.attempts[parentAttemptId ?? '']?.runId ?? this.#id('run'));
    const attemptId = this.#id('attempt');
    const messageId = this.#id('msg');
    const target: AttemptTarget = { conversationId: state.conversationId, runId, attemptId };
    const history = this.#path(prompt.parentId);
    const isNewPrompt = !this.#messages.has(prompt.id);
    if (isNewPrompt) this.#addMessage(prompt);
    this.#addMessage({
      id: messageId,
      role: 'assistant',
      parentId: prompt.id,
      parts: [],
      attemptId,
    });
    this.#select(messageId);
    const attempt: AttemptRecord = {
      attemptId,
      runId,
      conversationId: state.conversationId,
      messageId,
      promptId: prompt.id,
      relation,
      ...(parentAttemptId ? { parentAttemptId } : {}),
      status: 'submitted',
      connection: 'connecting',
      stop: 'none',
    };
    this.#commit({
      ...this.#state.peek(),
      attempts: { ...this.#state.peek().attempts, [attemptId]: attempt },
      activeAttemptId: attemptId,
    });
    const sink = new Sink(target, this, this.#generation);
    this.#sinks.set(attemptId, sink);
    this.#replay.set(attemptId, { seq: -Infinity, ids: new Set(), order: [] });
    const generation = this.#generation;
    try {
      await this.#transport.send(
        { ...target, relation, parentAttemptId, prompt, messageId, history },
        sink,
      );
      if (generation !== this.#generation) return { ok: false, reason: 'stale' };
      this.#updateAttempt(attemptId, (a) =>
        a.status === 'submitted' ? { ...a, status: 'accepted' } : a,
      );
      return { ok: true, attemptId };
    } catch (error) {
      if (generation !== this.#generation) return { ok: false, reason: 'stale' };
      const publicError = toPublicError(error, SEND_FAILED);
      const current = this.#state.peek().attempts[attemptId];
      sink._invalidate();
      if (current?.status === 'submitted' && optimistic && isNewPrompt) {
        // Never accepted: remove the optimistic messages; the draft remains in the composer.
        this.#removeMessage(messageId);
        this.#removeMessage(prompt.id);
        const { [attemptId]: _removed, ...attempts } = this.#state.peek().attempts;
        this.#commit({ ...this.#state.peek(), attempts, activeAttemptId: undefined });
      } else {
        this.#updateAttempt(attemptId, (a) => ({
          ...a,
          status: isTerminal(a.status) ? a.status : 'failed',
          connection: 'closed',
          error: publicError,
        }));
      }
      return { ok: false, reason: 'rejected', error: publicError };
    }
  }

  // ---- Stop, disconnect, resume ----

  /**
   * Request cancellation of the underlying work for one attempt. The attempt stays
   * `stop: requested` until the backend answers; partial output is kept. A response for an
   * older request (or another conversation) is ignored.
   */
  async stop(attemptId = this.#state.peek().activeAttemptId): Promise<ActionResult> {
    const state = this.#state.peek();
    const attempt = attemptId ? state.attempts[attemptId] : undefined;
    if (!attempt || !attemptId) return { ok: false, reason: 'invalid' };
    if (!can(state.capabilities, 'stop') || !this.#transport.stop)
      return { ok: false, reason: 'unavailable' };
    if (attempt.stop === 'requested') return { ok: false, reason: 'duplicate' };
    if (!isActive(attempt.status) && attempt.status !== 'interrupted')
      return { ok: false, reason: 'invalid' };
    const request = (this.#pendingStops.get(attemptId) ?? 0) + 1;
    this.#pendingStops.set(attemptId, request);
    const generation = this.#generation;
    this.#updateAttempt(attemptId, (a) => ({ ...a, stop: 'requested' }));
    const target = { conversationId: attempt.conversationId, runId: attempt.runId, attemptId };
    let outcome: Parameters<typeof applyStopOutcome>[1];
    try {
      outcome = await this.#transport.stop(target);
    } catch {
      outcome = 'rejected';
    }
    if (generation !== this.#generation || this.#pendingStops.get(attemptId) !== request) {
      this.#report({
        code: 'ai.stop.stale',
        path: '',
        message: 'Ignored a stop response for an older request; nothing to do.',
        attemptId,
      });
      return { ok: false, reason: 'stale' };
    }
    this.#pendingStops.delete(attemptId);
    this.#updateAttempt(attemptId, (a) => {
      if (a.stop !== 'requested') return a;
      const next = applyStopOutcome(a.status, outcome);
      return { ...a, ...next };
    });
    if (outcome === 'cancelled') {
      // The stream's own end may never arrive now: its events are dropped from here on.
      if (this.#state.peek().attempts[attemptId]?.status === 'cancelled')
        this.#settle(attemptId, 'cancelled');
      this.#sinks.get(attemptId)?._invalidate();
    }
    return outcome === 'rejected' ? { ok: false, reason: 'rejected' } : { ok: true, attemptId };
  }

  /**
   * Close the client stream for an attempt without cancelling the work (unmount, navigation).
   * The attempt keeps its status; `resume()` can reattach when supported.
   */
  disconnect(attemptId = this.#state.peek().activeAttemptId): ActionResult {
    const attempt = attemptId ? this.#state.peek().attempts[attemptId] : undefined;
    if (!attempt || !attemptId) return { ok: false, reason: 'invalid' };
    this.#sinks.get(attemptId)?._invalidate();
    this.#sinks.delete(attemptId);
    this.#transport.disconnect?.(this.#target(attempt));
    this.#updateAttempt(attemptId, (a) =>
      a.connection === 'closed' ? a : { ...a, connection: 'disconnected' },
    );
    return { ok: true, attemptId };
  }

  /** Reattach to an existing attempt. Never starts new work or a new attempt. */
  async resume(attemptId = this.#state.peek().activeAttemptId): Promise<ActionResult> {
    const state = this.#state.peek();
    const attempt = attemptId ? state.attempts[attemptId] : undefined;
    if (!attempt || !attemptId) return { ok: false, reason: 'invalid' };
    if (!can(state.capabilities, 'resume') || !this.#transport.resume)
      return { ok: false, reason: 'unavailable' };
    if (isTerminal(attempt.status)) return { ok: false, reason: 'invalid' };
    if (attempt.connection === 'open' || attempt.connection === 'reconnecting')
      return { ok: false, reason: 'duplicate' };
    this.#sinks.get(attemptId)?._invalidate();
    const sink = new Sink(this.#target(attempt), this, this.#generation);
    this.#sinks.set(attemptId, sink);
    this.#updateAttempt(attemptId, (a) => ({ ...a, connection: 'reconnecting' }));
    const generation = this.#generation;
    try {
      await this.#transport.resume(this.#target(attempt), sink);
      return { ok: true, attemptId };
    } catch (error) {
      if (generation === this.#generation && this.#sinks.get(attemptId) === sink) {
        sink._invalidate();
        this.#updateAttempt(attemptId, (a) => ({
          ...a,
          connection: 'closed',
          status: isTerminal(a.status) ? a.status : 'interrupted',
          error: toPublicError(error, STREAM_FAILED),
        }));
      }
      return { ok: false, reason: 'rejected' };
    }
  }

  // ---- Approvals and questions ----

  /**
   * Submit a decision for one approval revision. Repeated activation, stale revisions, and
   * expired proposals are refused without a request. The approval stays `submitting`
   * until the backend acknowledges it; acknowledgment does not mean the action succeeded.
   * `scope` goes only with `approve`: one of the revision's scopes, else its only scope or its
   * default; a transport without `approvalScopes` cannot carry one, so the decision is refused.
   */
  decide(
    approvalId: string,
    revision: number,
    decision: 'approve' | 'reject',
    reason?: string,
    scope?: string,
  ): Promise<ActionResult> {
    let chosen: string | undefined;
    return this.#respond('approvals', approvalId, revision, {
      capability: 'respondToApproval',
      send:
        this.#transport.decide &&
        ((target, approval) =>
          this.#transport.decide!({
            ...target,
            approvalId,
            toolCallId: (approval as ApprovalRecord).toolCallId,
            revision,
            decision,
            reason,
            ...(chosen !== undefined ? { scope: chosen } : {}),
          })),
      check: (record) => {
        const approval = record as ApprovalRecord;
        const scopes = approval.scopes ?? [];
        chosen =
          decision === 'reject' || scope !== undefined
            ? scope
            : scopes.length === 1
              ? scopes[0]?.id
              : approval.defaultScopeId;
        // A rejection never carries a scope; an approval carries one of this revision's, if any.
        if (
          decision === 'reject'
            ? chosen !== undefined
            : scopes.length
              ? !scopes.some((s) => s.id === chosen)
              : chosen !== undefined
        )
          return { ok: false, reason: 'invalid' };
        if (chosen !== undefined && !can(this.#state.peek().capabilities, 'approvalScopes'))
          return { ok: false, reason: 'unavailable' };
        return undefined;
      },
      submitting: (record) => {
        const { scope: _scope, ...rest } = record as ApprovalRecord;
        return {
          ...rest,
          decision,
          ...(reason ? { reason } : {}),
          ...(chosen !== undefined ? { scope: chosen } : {}),
        };
      },
      accepted: decision === 'approve' ? 'approved' : 'rejected',
      failure: DECISION_FAILED,
    });
  }

  /** Answer one question revision; the answer is bound to it, like a decision to an approval. */
  answer(questionId: string, revision: number, answer: JsonValue): Promise<ActionResult> {
    return this.#reply(questionId, revision, { kind: 'answer', answer });
  }

  /** Skip one question revision: a skip of its own, never an empty answer. */
  skip(questionId: string, revision: number): Promise<ActionResult> {
    return this.#reply(questionId, revision, { kind: 'skip' });
  }

  #reply(
    questionId: string,
    revision: number,
    response: { readonly kind: 'answer'; readonly answer: JsonValue } | { readonly kind: 'skip' },
  ): Promise<ActionResult> {
    return this.#respond('questions', questionId, revision, {
      capability: 'respondToQuestion',
      send:
        this.#transport.answer &&
        ((target) => this.#transport.answer!({ ...target, questionId, revision, ...response })),
      submitting: (record) => {
        const { answer: _answer, ...rest } = record as QuestionRecord;
        return response.kind === 'answer' ? { ...rest, answer: response.answer } : rest;
      },
      accepted: response.kind === 'answer' ? 'answered' : 'skipped',
      failure: ANSWER_FAILED,
    });
  }

  /**
   * A person's response to a request (an approval's decision, a question's answer or skip): one in
   * flight per revision, `submitting` until the backend acknowledges it, `failed` to respond
   * again, and the record decides when it changed meanwhile (resolved elsewhere, or withdrawn).
   */
  async #respond(
    kind: Requests,
    id: string,
    revision: number,
    r: RequestReply,
  ): Promise<ActionResult> {
    const state = this.#state.peek();
    const record = state[kind][id];
    if (!record) return { ok: false, reason: 'invalid' };
    if (!can(state.capabilities, r.capability) || !r.send)
      return { ok: false, reason: 'unavailable' };
    if (record.revision !== revision) return { ok: false, reason: 'stale' };
    const key = `${kind}:${id}:${revision}`;
    if (this.#pendingResponses.has(key)) return { ok: false, reason: 'duplicate' };
    if (!awaitsPerson(record.status))
      return {
        ok: false,
        reason:
          record.status === 'expired' ||
          record.status === 'superseded' ||
          record.status === 'cancelled'
            ? 'stale'
            : 'duplicate',
      };
    const refused = r.check?.(record);
    if (refused) return refused;
    if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
      this.#setRequest(kind, id, revision, 'expired');
      return { ok: false, reason: 'stale' };
    }
    this.#pendingResponses.add(key);
    const generation = this.#generation;
    this.#updateRequest(kind, id, (current) => {
      const { error: _error, ...rest } = current;
      return r.submitting({ ...rest, status: 'submitting' } as RequestRecord);
    });
    const attempt = record.attemptId ? state.attempts[record.attemptId] : undefined;
    try {
      const target = {
        conversationId: state.conversationId,
        runId: attempt?.runId ?? '',
        attemptId: record.attemptId ?? '',
      };
      const outcome = await r.send(target, record);
      if (generation !== this.#generation) return { ok: false, reason: 'stale' };
      const status =
        outcome === 'accepted' ? r.accepted : outcome === 'expired' ? 'expired' : 'superseded';
      this.#setRequest(kind, id, revision, status);
      // The record decides: a request withdrawn or resolved elsewhere meanwhile keeps its outcome.
      if (this.#state.peek()[kind][id]?.status !== status) return { ok: false, reason: 'stale' };
      return outcome === 'accepted' ? { ok: true } : { ok: false, reason: 'stale' };
    } catch (error) {
      if (generation !== this.#generation) return { ok: false, reason: 'stale' };
      const failure = toPublicError(error, r.failure);
      const current = this.#state.peek()[kind][id];
      if (current?.revision === revision && current.status === 'submitting')
        this.#updateRequest(
          kind,
          id,
          (c) => ({ ...c, status: 'failed', error: failure }) as RequestRecord,
        );
      return { ok: false, reason: 'rejected', error: failure };
    } finally {
      this.#pendingResponses.delete(key);
    }
  }

  // ---- Branches and history ----

  /** Show the branch containing `messageId` (following its most recently selected leaf). */
  switchBranch(messageId: string): ActionResult {
    if (!this.#messages.has(messageId)) return { ok: false, reason: 'invalid' };
    if (!can(this.#state.peek().capabilities, 'switchBranch'))
      return { ok: false, reason: 'unavailable' };
    this.#select(messageId);
    this.#leaf = this.#deepest(messageId);
    this.#commit({ ...this.#state.peek() });
    return { ok: true };
  }

  /** Load earlier messages. Prepended messages never move the active branch. */
  async loadHistory(): Promise<ActionResult> {
    const state = this.#state.peek();
    if (!can(state.capabilities, 'history') || !this.#transport.loadHistory)
      return { ok: false, reason: 'unavailable' };
    if (state.history === 'loading') return { ok: false, reason: 'duplicate' };
    if (!state.hasMoreHistory) return { ok: false, reason: 'invalid' };
    const generation = this.#generation;
    this.#commit({ ...state, history: 'loading' });
    try {
      const raw = await this.#transport.loadHistory(state.conversationId, state.messages[0]?.id);
      if (generation !== this.#generation) return { ok: false, reason: 'stale' };
      const result = normalizeSnapshot(raw);
      for (const d of result.diagnostics) this.#report(d);
      if (!result.ok || !result.value || result.value.conversationId !== state.conversationId) {
        this.#commit({ ...this.#state.peek(), history: 'error' });
        return { ok: false, reason: 'invalid' };
      }
      for (const message of result.value.messages)
        if (!this.#messages.has(message.id)) this.#messages.set(message.id, message);
      this.#rebuildChildren();
      const more = result.value.hasMoreHistory ?? false;
      this.#commit({
        ...this.#state.peek(),
        history: more ? 'idle' : 'complete',
        hasMoreHistory: more,
      });
      return { ok: true };
    } catch {
      if (generation === this.#generation)
        this.#commit({ ...this.#state.peek(), history: 'error' });
      return { ok: false, reason: 'rejected' };
    }
  }

  // ---- Feedback ----

  async submitFeedback(feedback: Omit<FeedbackRecord, 'status' | 'error'>): Promise<ActionResult> {
    const state = this.#state.peek();
    if (!can(state.capabilities, 'feedback') || !this.#transport.submitFeedback)
      return { ok: false, reason: 'unavailable' };
    if (state.feedback[feedback.messageId]?.status === 'pending')
      return { ok: false, reason: 'duplicate' };
    const generation = this.#generation;
    const pending: FeedbackRecord = { ...feedback, status: 'pending' };
    this.#commit({ ...state, feedback: { ...state.feedback, [feedback.messageId]: pending } });
    let next: FeedbackRecord;
    try {
      await this.#transport.submitFeedback(pending);
      next = { ...feedback, status: 'submitted' };
    } catch (error) {
      next = {
        ...feedback,
        status: 'failed',
        error: toPublicError(error, {
          code: 'ai.feedback.failed',
          message: 'Feedback was not sent. Try again.',
        }),
      };
    }
    if (generation !== this.#generation) return { ok: false, reason: 'stale' };
    const now = this.#state.peek();
    this.#commit({ ...now, feedback: { ...now.feedback, [feedback.messageId]: next } });
    return next.status === 'submitted' ? { ok: true } : { ok: false, reason: 'rejected' };
  }

  /** Release client-side work: disconnect open streams (never cancels remote work). */
  dispose(): void {
    if (this.#disposed) return;
    for (const [attemptId, sink] of this.#sinks) {
      sink._invalidate();
      const attempt = this.#state.peek().attempts[attemptId];
      if (attempt && !isTerminal(attempt.status))
        this.#transport.disconnect?.(this.#target(attempt));
    }
    this.#sinks.clear();
    this.#listeners.clear();
    this.#generation++;
    this.#disposed = true;
  }

  // ---- Event ingestion (called by sinks) ----

  /** @internal */
  _accepts(sink: Sink): boolean {
    return (
      !this.#disposed &&
      sink._generation === this.#generation &&
      this.#sinks.get(sink.target.attemptId) === sink
    );
  }

  /** @internal */
  _closed(sink: Sink): void {
    if (!this._accepts(sink)) return;
    const attemptId = sink.target.attemptId;
    this.#sinks.delete(attemptId);
    this.#updateAttempt(attemptId, (a) => ({
      ...a,
      connection: 'closed',
      // A closed connection is not completion: without a terminal event the outcome is unknown.
      status: isTerminal(a.status) || this.#paused.has(attemptId) ? a.status : 'interrupted',
    }));
  }

  /** @internal */
  _ingest(sink: Sink, event: AiEvent): void {
    const attemptId = sink.target.attemptId;
    if (!this._accepts(sink)) {
      this.#report({
        code: 'ai.event.stale',
        path: '',
        message: `Dropped a late "${event?.type}" event of an attempt that is no longer current; nothing to do.`,
        attemptId,
      });
      return;
    }
    if (typeof event !== 'object' || event === null || typeof event.type !== 'string') {
      this.#report({
        code: 'ai.event.invalid',
        path: '',
        message: 'Dropped a malformed event; check that the transport sends AI events with a type.',
        attemptId,
      });
      return;
    }
    if (this.#isDuplicate(attemptId, event)) {
      this.#report({
        code: 'ai.event.duplicate',
        path: '',
        message: `Dropped a replayed "${event.type}" event; nothing to do.`,
        attemptId,
      });
      return;
    }
    const attempt = this.#state.peek().attempts[attemptId];
    if (!attempt) return;
    if (isTerminal(attempt.status) && !AFTER_TERMINAL.has(event.type)) {
      this.#report({
        code: 'ai.event.afterTerminal',
        path: '',
        message: `Dropped "${event.type}" after the attempt ended; check that the transport sends nothing after finish, abort, or error.`,
        attemptId,
      });
      return;
    }
    this.#applyEvent(attempt, event);
  }

  #isDuplicate(attemptId: string, event: AiEvent): boolean {
    const replay = this.#replay.get(attemptId);
    if (!replay) return false;
    if (typeof event.seq === 'number') {
      if (event.seq <= replay.seq) return true;
      replay.seq = event.seq;
    }
    if (typeof event.eventId === 'string') {
      if (replay.ids.has(event.eventId)) return true;
      replay.ids.add(event.eventId);
      replay.order.push(event.eventId);
      if (replay.order.length > MAX_EVENT_IDS) replay.ids.delete(replay.order.shift() as string);
    }
    return false;
  }

  #applyEvent(attempt: AttemptRecord, event: AiEvent): void {
    const id = attempt.attemptId;
    const touchesContent = event.type !== 'metadata' && event.type !== 'attempt-accepted';
    if (touchesContent) this.#markStreaming(id);
    switch (event.type) {
      case 'attempt-accepted':
        this.#updateAttempt(id, (a) =>
          a.status === 'submitted' ? { ...a, status: 'accepted' } : a,
        );
        return;
      case 'message-start':
        return;
      case 'message-reset':
        this.#stepStart.delete(id);
        this.#updateMessage(attempt.messageId, (msg) => ({ ...msg, parts: [] }));
        return;
      case 'step-start':
        this.#stepStart.set(id, this.#messages.get(attempt.messageId)?.parts.length ?? 0);
        return;
      case 'step-reset': {
        const start = this.#stepStart.get(id) ?? 0;
        this.#updateMessage(attempt.messageId, (msg) => ({
          ...msg,
          parts: msg.parts.slice(0, start),
        }));
        return;
      }
      case 'text-start':
        this.#upsertPart(attempt.messageId, event.partId, () => ({
          type: event.kind ?? 'text',
          id: event.partId,
          text: '',
          state: 'streaming',
        }));
        return;
      case 'text-delta':
        this.#upsertPart(
          attempt.messageId,
          event.partId,
          () => ({ type: 'text', id: event.partId, text: '', state: 'streaming' }),
          (part) =>
            part.type === 'text' || part.type === 'reasoning'
              ? { ...part, text: part.text + event.delta }
              : part,
        );
        return;
      case 'text-end':
        this.#updatePart(attempt.messageId, event.partId, (part) =>
          part.type === 'text' || part.type === 'reasoning' ? { ...part, state: 'done' } : part,
        );
        return;
      case 'part': {
        const { part, diagnostics } = normalizePart(event.part, `/${attempt.messageId}`);
        for (const d of diagnostics) this.#report({ ...d, attemptId: id });
        this.#upsertPart(
          attempt.messageId,
          part.id,
          () => part,
          () => part,
        );
        return;
      }
      case 'tool-input-start':
        this.#upsertTool(event.toolCallId, () => ({
          toolCallId: event.toolCallId,
          attemptId: id,
          toolName: event.toolName,
          ...(event.title ? { title: event.title } : {}),
          status: 'input-streaming',
          inputText: '',
        }));
        this.#upsertPart(attempt.messageId, `tool-${event.toolCallId}`, () => ({
          type: 'tool-call',
          id: `tool-${event.toolCallId}`,
          toolCallId: event.toolCallId,
        }));
        return;
      case 'tool-input-delta':
        this.#updateTool(event.toolCallId, (t) =>
          t.status === 'input-streaming'
            ? { ...t, inputText: (t.inputText ?? '') + event.delta }
            : t,
        );
        return;
      case 'tool-input-available':
        this.#ensureTool(attempt, event.toolCallId);
        this.#moveTool(event.toolCallId, 'input-available', (t) => ({ ...t, input: event.input }));
        return;
      case 'tool-executing':
        this.#moveTool(event.toolCallId, 'executing');
        return;
      case 'tool-output':
        this.#moveTool(event.toolCallId, 'output-available', (t) => ({
          ...t,
          output: event.output,
        }));
        return;
      case 'tool-error':
        this.#moveTool(event.toolCallId, 'output-error', (t) => ({ ...t, error: event.error }));
        return;
      case 'tool-denied': {
        this.#moveTool(event.toolCallId, 'denied');
        // A refusal is not a person's rejection: an approval still open is withdrawn.
        const now = this.#state.peek();
        const approval = now.approvals[now.tools[event.toolCallId]?.approvalId ?? ''];
        if (approval)
          this.#setRequest('approvals', approval.approvalId, approval.revision, 'cancelled');
        return;
      }
      case 'approval-request':
        this.#request(attempt, 'approvals', normalizeApproval, event.approval);
        return;
      case 'approval-resolved':
        this.#setRequest('approvals', event.approvalId, event.revision, event.status);
        return;
      case 'question-request':
        this.#request(attempt, 'questions', normalizeQuestion, event.question);
        return;
      case 'question-resolved':
        this.#setRequest('questions', event.questionId, event.revision, event.status, (q) =>
          event.answer === undefined ? q : { ...q, answer: event.answer },
        );
        return;
      case 'artifact': {
        const result = normalizeArtifact(event.artifact);
        for (const d of result.diagnostics) this.#report({ ...d, attemptId: id });
        if (!result.value) return;
        const artifact = result.value;
        const now = this.#state.peek();
        this.#commit({ ...now, artifacts: { ...now.artifacts, [artifact.artifactId]: artifact } });
        this.#upsertPart(
          attempt.messageId,
          `artifact-${artifact.artifactId}`,
          () => ({
            type: 'artifact',
            id: `artifact-${artifact.artifactId}`,
            artifactId: artifact.artifactId,
            revisionId: artifact.currentRevisionId,
          }),
          (part) =>
            part.type === 'artifact' ? { ...part, revisionId: artifact.currentRevisionId } : part,
        );
        return;
      }
      case 'usage':
        this.#updateAttempt(id, (a) => ({ ...a, usage: event.usage }));
        return;
      case 'snapshot': {
        const result = normalizeMessage(event.message);
        for (const d of result.diagnostics) this.#report({ ...d, attemptId: id });
        if (!result.value || result.value.id !== attempt.messageId) {
          this.#report({
            code: 'ai.snapshot.scope',
            path: '',
            message:
              "Ignored a snapshot for another message; check the snapshot names the attempt's message.",
            attemptId: id,
          });
          return;
        }
        const replacement = result.value;
        this.#updateMessage(attempt.messageId, (msg) => ({
          ...replacement,
          ...(msg.parentId ? { parentId: msg.parentId } : {}),
          attemptId: id,
        }));
        return;
      }
      case 'finish':
        // Paused for input: the requests stay answerable without a stream.
        if (event.status === 'awaiting-input') this.#paused.set(id, !!this.#wait(id));
        this.#terminate(id, event.status ?? 'completed');
        return;
      case 'abort':
        this.#terminate(id, 'cancelled');
        return;
      case 'error':
        this.#terminate(id, 'failed', event.error);
        return;
      case 'metadata':
        this.#report({
          code: 'ai.event.metadata',
          path: '',
          message: 'Provider metadata is not rendered; nothing to do.',
          attemptId: id,
        });
        return;
      default:
        this.#report({
          code: 'ai.event.unknown',
          path: '',
          message: `Ignored unknown event "${(event as { type: string }).type}"; check the transport's mapping to AI events.`,
          attemptId: id,
        });
    }
  }

  #markStreaming(attemptId: string): void {
    // Events after a paused end: the work goes on, so the wait is recomputed without the pause.
    let started = this.#paused.delete(attemptId);
    this.#updateAttempt(attemptId, (a) => {
      const connection =
        a.connection === 'connecting' || a.connection === 'reconnecting' ? 'open' : a.connection;
      const status: AttemptStatus =
        a.status === 'submitted' || a.status === 'accepted' || a.status === 'interrupted'
          ? 'streaming'
          : a.status;
      started ||= status !== a.status;
      return connection === a.connection && status === a.status ? a : { ...a, connection, status };
    });
    // A resumed stream may find an approval still waiting.
    if (started) this.#syncWaiting(attemptId);
  }

  /** The attempt's open requests: those that need the person, and those being submitted. */
  #wait(attemptId: string): AttemptWait | undefined {
    const action: WaitRequest[] = [];
    const submitting: WaitRequest[] = [];
    const state = this.#state.peek();
    for (const kind of REQUESTS)
      for (const [id, record] of Object.entries(state[kind])) {
        if (record.attemptId !== attemptId) continue;
        const request: WaitRequest = { kind: kind === 'approvals' ? 'approval' : 'question', id };
        if (record.status === 'submitting') submitting.push(request);
        else if (awaitsPerson(record.status)) action.push(request);
      }
    return action.length || submitting.length ? { action, submitting } : undefined;
  }

  /**
   * Recompute the attempt's wait descriptor after any change to its requests, so one resolution
   * never clears another open request. A streaming attempt awaits input while a request needs the
   * person and streams again once none does; an attempt paused for requests keeps an empty
   * descriptor once they are answered, waiting for the work to go on (ADR 0049 §6 item 2).
   */
  #syncWaiting(attemptId: string): void {
    const wait =
      this.#wait(attemptId) ??
      (this.#paused.get(attemptId) ? { action: [], submitting: [] } : undefined);
    const asks = !!wait?.action.length;
    this.#updateAttempt(attemptId, (a) => {
      const { wait: before, ...rest } = a;
      if (isTerminal(a.status)) return before ? rest : a;
      const status: AttemptStatus =
        asks && a.status === 'streaming'
          ? 'awaiting-input'
          : !asks && a.status === 'awaiting-input' && !this.#paused.has(attemptId)
            ? 'streaming'
            : a.status;
      if (status === a.status && JSON.stringify(before) === JSON.stringify(wait)) return a;
      return { ...rest, status, ...(wait ? { wait } : {}) };
    });
  }

  #terminate(attemptId: string, status: AttemptStatus, error?: PublicError): void {
    this.#updateAttempt(attemptId, (a) => {
      if (isTerminal(a.status)) return a;
      if (!canTransition(ATTEMPT_TRANSITIONS, a.status, status)) return a;
      return {
        ...a,
        status,
        stop: isTerminal(status) ? stopAfterTerminal(a.stop, status) : a.stop,
        ...(error ? { error } : {}),
      };
    });
    this.#settle(attemptId, status);
  }

  /** An attempt that ended: its message parts stop streaming, and when cancelled or failed, its tools. */
  #settle(attemptId: string, status: AttemptStatus): void {
    const attempt = this.#state.peek().attempts[attemptId];
    if (!attempt) return;
    this.#updateMessage(attempt.messageId, (msg) =>
      msg.parts.some(
        (p) => (p.type === 'text' || p.type === 'reasoning') && p.state === 'streaming',
      )
        ? {
            ...msg,
            parts: msg.parts.map((p) =>
              (p.type === 'text' || p.type === 'reasoning') && p.state === 'streaming'
                ? { ...p, state: 'done' }
                : p,
            ),
          }
        : msg,
    );
    if (status === 'cancelled' || status === 'failed') {
      const now = this.#state.peek();
      let changed = false;
      const tools = { ...now.tools };
      for (const tool of Object.values(now.tools)) {
        if (
          tool.attemptId === attemptId &&
          (tool.status === 'input-streaming' || tool.status === 'executing')
        ) {
          tools[tool.toolCallId] = { ...tool, status: 'cancelled' };
          changed = true;
        }
      }
      if (changed) this.#commit({ ...now, tools });
    }
  }

  /**
   * A request for the person (an approval or a question) from the stream: validated, bound to its
   * attempt, and placed in the message where it arrived. A newer revision replaces the record and
   * any response bound to the old one; an older or equal revision is ignored (replays).
   */
  #request(
    attempt: AttemptRecord,
    kind: Requests,
    normalize: (raw: unknown) => Normalized<RequestRecord>,
    raw: RequestRecord,
  ): void {
    const result = normalize({ ...raw, attemptId: raw.attemptId ?? attempt.attemptId });
    for (const d of result.diagnostics) this.#report({ ...d, attemptId: attempt.attemptId });
    if (!result.value) return;
    const incoming = result.value;
    const approval = kind === 'approvals' ? (incoming as ApprovalRecord) : undefined;
    const id = approval ? approval.approvalId : (incoming as QuestionRecord).questionId;
    const now = this.#state.peek();
    const existing = now[kind][id];
    if (existing && existing.revision >= incoming.revision) {
      const attemptId = attempt.attemptId;
      this.#report(
        approval
          ? {
              code: 'ai.approval.stale',
              path: '',
              message: 'Ignored an older approval revision; nothing to do.',
              attemptId,
            }
          : {
              code: 'ai.question.stale',
              path: '',
              message: 'Ignored an older question revision; nothing to do.',
              attemptId,
            },
      );
      return;
    }
    // A new revision supersedes any response bound to the previous one.
    this.#commit({
      ...now,
      [kind]: { ...now[kind], [id]: { ...incoming, status: 'requested' } },
    } as ConversationState);
    if (approval?.toolCallId) {
      // The approval states the gate; the call keeps its own status until it runs.
      const toolCallId = approval.toolCallId;
      this.#ensureTool(attempt, toolCallId);
      this.#updateTool(toolCallId, (t) => (t.approvalId === id ? t : { ...t, approvalId: id }));
    } else {
      const type = approval ? 'approval' : 'question';
      this.#upsertPart(
        attempt.messageId,
        `${type}-${id}`,
        () =>
          (approval
            ? { type, id: `${type}-${id}`, approvalId: id }
            : { type, id: `${type}-${id}`, questionId: id }) as MessagePart,
      );
    }
    this.#syncWaiting(incoming.attemptId ?? attempt.attemptId);
  }

  // ---- Record helpers ----

  #ensureTool(attempt: AttemptRecord, toolCallId: string): void {
    if (this.#state.peek().tools[toolCallId]) return;
    this.#upsertTool(toolCallId, () => ({
      toolCallId,
      attemptId: attempt.attemptId,
      toolName: 'tool',
      status: 'input-available',
    }));
    this.#upsertPart(attempt.messageId, `tool-${toolCallId}`, () => ({
      type: 'tool-call',
      id: `tool-${toolCallId}`,
      toolCallId,
    }));
  }

  #upsertTool(toolCallId: string, create: () => ToolCallRecord): void {
    const now = this.#state.peek();
    if (now.tools[toolCallId]) return;
    this.#commit({ ...now, tools: { ...now.tools, [toolCallId]: create() } });
  }

  #updateTool(toolCallId: string, update: (t: ToolCallRecord) => ToolCallRecord): void {
    const now = this.#state.peek();
    const tool = now.tools[toolCallId];
    if (!tool) return;
    const next = update(tool);
    if (next !== tool) this.#commit({ ...now, tools: { ...now.tools, [toolCallId]: next } });
  }

  #moveTool(
    toolCallId: string,
    status: ToolStatus,
    update?: (t: ToolCallRecord) => ToolCallRecord,
  ): void {
    this.#updateTool(toolCallId, (t) => {
      if (!canTransition(TOOL_TRANSITIONS, t.status, status)) {
        this.#report({
          code: 'ai.tool.transition',
          path: '',
          message: `Ignored ${t.status} → ${status} for ${toolCallId}; check the order of the transport's tool events.`,
        });
        return t;
      }
      return { ...(update ? update(t) : t), status };
    });
  }

  #updateRequest(
    kind: Requests,
    id: string,
    update: (record: RequestRecord) => RequestRecord,
  ): void {
    const now = this.#state.peek();
    const record = now[kind][id];
    if (!record) return;
    const next = update(record);
    if (next === record) return;
    this.#commit({ ...now, [kind]: { ...now[kind], [id]: next } } as ConversationState);
    if (record.attemptId) this.#syncWaiting(record.attemptId);
  }

  /** Move a request's revision to `status` when its lifecycle allows it; `add` sets more fields. */
  #setRequest(
    kind: Requests,
    id: string,
    revision: number,
    status: ApprovalStatus | QuestionStatus,
    add?: (record: RequestRecord) => RequestRecord,
  ): void {
    const table = (kind === 'approvals' ? APPROVAL_TRANSITIONS : QUESTION_TRANSITIONS) as Readonly<
      Record<string, readonly string[]>
    >;
    this.#updateRequest(kind, id, (r) => {
      if (r.revision !== revision || !canTransition(table, r.status, status)) return r;
      const next = { ...r, status } as RequestRecord;
      return add ? add(next) : next;
    });
  }

  #updateAttempt(attemptId: string, update: (a: AttemptRecord) => AttemptRecord): void {
    const now = this.#state.peek();
    const attempt = now.attempts[attemptId];
    if (!attempt) return;
    const next = update(attempt);
    if (next === attempt) return;
    this.#commit({ ...now, attempts: { ...now.attempts, [attemptId]: next } });
    // Only a terminal attempt withdraws its open requests (ADR 0049 §6 item 2); it waits no more.
    if (isTerminal(next.status) && !isTerminal(attempt.status)) {
      this.#paused.delete(attemptId);
      for (const kind of REQUESTS)
        for (const [id, record] of Object.entries(this.#state.peek()[kind]))
          if (record.attemptId === attemptId)
            this.#setRequest(kind, id, record.revision, 'cancelled');
      this.#syncWaiting(attemptId);
    }
  }

  #updateMessage(messageId: string, update: (m: MessageRecord) => MessageRecord): void {
    const message = this.#messages.get(messageId);
    if (!message) return;
    const next = update(message);
    if (next === message) return;
    this.#messages.set(messageId, next);
    this.#commit({ ...this.#state.peek() });
  }

  #upsertPart(
    messageId: string,
    partId: string,
    create: () => MessagePart,
    update?: (part: MessagePart) => MessagePart,
  ): void {
    this.#updateMessage(messageId, (msg) => {
      const index = msg.parts.findIndex((p) => p.id === partId);
      if (index === -1)
        return { ...msg, parts: [...msg.parts, update ? update(create()) : create()] };
      if (!update) return msg;
      const current = msg.parts[index] as MessagePart;
      const next = update(current);
      if (next === current) return msg;
      const parts = msg.parts.slice();
      parts[index] = next;
      return { ...msg, parts };
    });
  }

  #updatePart(messageId: string, partId: string, update: (part: MessagePart) => MessagePart): void {
    this.#updateMessage(messageId, (msg) => {
      const index = msg.parts.findIndex((p) => p.id === partId);
      if (index === -1) return msg;
      const parts = msg.parts.slice();
      parts[index] = update(msg.parts[index] as MessagePart);
      return { ...msg, parts };
    });
  }

  #addMessage(message: MessageRecord): void {
    this.#messages.set(message.id, message);
    const key = this.#parentKey(message);
    this.#children.set(key, [...(this.#children.get(key) ?? []), message.id]);
  }

  /** Parent key in the branch tree; a parent that is not loaded yet (older history) is the root. */
  #parentKey(message: MessageRecord): string {
    return message.parentId && this.#messages.has(message.parentId) ? message.parentId : '';
  }

  #removeMessage(messageId: string): void {
    const message = this.#messages.get(messageId);
    if (!message) return;
    this.#messages.delete(messageId);
    const key = this.#parentKey(message);
    this.#children.set(
      key,
      (this.#children.get(key) ?? []).filter((id) => id !== messageId),
    );
    if (this.#preferred.get(key) === messageId) this.#preferred.delete(key);
    if (this.#leaf === messageId) this.#leaf = message.parentId;
  }

  #rebuildChildren(): void {
    this.#children = new Map();
    for (const message of this.#messages.values()) {
      const key = this.#parentKey(message);
      this.#children.set(key, [...(this.#children.get(key) ?? []), message.id]);
    }
  }

  /** Remember `messageId` as the selected child of its parent, up to the root. */
  #select(messageId: string): void {
    let current = this.#messages.get(messageId);
    while (current) {
      this.#preferred.set(this.#parentKey(current), current.id);
      current = current.parentId ? this.#messages.get(current.parentId) : undefined;
    }
    this.#leaf = messageId;
  }

  /** Deepest descendant following preferred (else latest) children. */
  #deepest(from: string | undefined): string | undefined {
    let current = from;
    for (;;) {
      const children = this.#children.get(current ?? '') ?? [];
      if (!children.length) return current;
      current = this.#preferred.get(current ?? '') ?? children[children.length - 1];
    }
  }

  #path(leaf: string | undefined): MessageRecord[] {
    const path: MessageRecord[] = [];
    let current = leaf ? this.#messages.get(leaf) : undefined;
    while (current) {
      path.push(current);
      current = current.parentId ? this.#messages.get(current.parentId) : undefined;
    }
    return path.reverse();
  }

  #branches(path: readonly MessageRecord[]): Record<string, BranchPosition> {
    const out: Record<string, BranchPosition> = {};
    for (const message of path) {
      const siblings = (this.#children.get(this.#parentKey(message)) ?? []).filter(
        (id) => this.#messages.get(id)?.role === message.role,
      );
      if (siblings.length < 2) continue;
      const index = siblings.indexOf(message.id);
      out[message.id] = {
        index: index + 1,
        count: siblings.length,
        previousId: siblings[index - 1],
        nextId: siblings[index + 1],
      };
    }
    return out;
  }

  #target(attempt: AttemptRecord): AttemptTarget {
    return {
      conversationId: attempt.conversationId,
      runId: attempt.runId,
      attemptId: attempt.attemptId,
    };
  }

  #isolate(): void {
    this.#generation++;
    for (const sink of this.#sinks.values()) sink._invalidate();
    this.#sinks.clear();
    this.#replay.clear();
    this.#stepStart.clear();
    this.#paused.clear();
    this.#pendingResponses.clear();
    this.#pendingStops.clear();
    this.#preferred.clear();
  }

  #empty(conversationId: string): ConversationState {
    return {
      conversationId,
      revision: 0,
      messages: [],
      tools: {},
      approvals: {},
      questions: {},
      artifacts: {},
      attempts: {},
      branches: {},
      activeAttemptId: undefined,
      capabilities: {},
      history: 'complete',
      hasMoreHistory: false,
      feedback: {},
    };
  }

  #capabilities(): Capabilities {
    if (!this.#capabilityCache) {
      const supported = this.#transport.capabilities;
      this.#capabilityCache = this.#policy
        ? intersectCapabilities(supported, this.#policy)
        : supported;
    }
    return this.#capabilityCache;
  }
  #capabilityCache: Capabilities | undefined;

  #commit(next: ConversationState): void {
    const previous = this.#state.peek();
    const messages = this.#path(this.#leaf);
    this.#state.value = {
      ...next,
      revision: previous.revision + 1,
      messages,
      branches: this.#branches(messages),
      capabilities: this.#capabilities(),
    };
    for (const listener of [...this.#listeners]) listener();
  }

  #report(diagnostic: ControllerDiagnostic): void {
    this.#diagnose?.(diagnostic);
    if (DEV && !this.#diagnose && diagnostic.code !== 'ai.event.metadata') {
      console.debug(`[oddkin/ai] ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
}
