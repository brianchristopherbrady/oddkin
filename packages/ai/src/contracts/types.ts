/**
 * Types for AI interaction surfaces: records inferred from the models, controller state, and the
 * normalized event stream adapters produce. Contract: docs/architecture/ai-interaction.md §3–§5.
 */
import type { Infer, JsonValue } from '@oddkin/core/model';
import type {
  ApprovalModel,
  ArtifactModel,
  CheckpointModel,
  ContextItemModel,
  ConversationSnapshotModel,
  FeedbackModel,
  MessageModel,
  ModelOptionModel,
  PlanModel,
  QuestionModel,
  SuggestionModel,
  ToolCallModel,
  TranscriptSegmentModel,
  UsageModel,
  capabilitiesSchema,
  partSchema,
  provenanceSchema,
  publicErrorSchema,
  usageEntrySchema,
} from './models.js';

export type { JsonValue };
export type PublicError = Infer<typeof publicErrorSchema>;
export type Capabilities = Infer<typeof capabilitiesSchema>;
export type CapabilityName = keyof Capabilities;
export type MessagePart = Infer<typeof partSchema>;
export type PartType = MessagePart['type'];
export type PartOf<T extends PartType> = Extract<MessagePart, { type: T }>;
export type Provenance = Infer<typeof provenanceSchema>;
export type MessageRecord = Infer<typeof MessageModel>;
export type MessageRole = MessageRecord['role'];
export type ToolCallRecord = Infer<typeof ToolCallModel>;
export type ToolStatus = ToolCallRecord['status'];
export type ApprovalRecord = Infer<typeof ApprovalModel>;
export type ApprovalStatus = ApprovalRecord['status'];
export type ArtifactRecord = Infer<typeof ArtifactModel>;
export type ArtifactRevision = ArtifactRecord['revisions'][number];
export type UsageEntry = Infer<typeof usageEntrySchema>;
export type Usage = Infer<typeof UsageModel>;
export type CheckpointRecord = Infer<typeof CheckpointModel>;
export type PlanRecord = Infer<typeof PlanModel>;
export type PlanStep = PlanRecord['steps'][number];
export type StepStatus = PlanStep['status'];
export type QuestionRecord = Infer<typeof QuestionModel>;
export type ContextItem = Infer<typeof ContextItemModel>;
export type ModelOption = Infer<typeof ModelOptionModel>;
export type FeedbackRecord = Infer<typeof FeedbackModel>;
export type Suggestion = Infer<typeof SuggestionModel>;
export type TranscriptSegment = Infer<typeof TranscriptSegmentModel>;
export type ConversationSnapshot = Infer<typeof ConversationSnapshotModel>;

// ---- Attempts (controller state, not persisted) ----

/** How an attempt relates to earlier work. `resume` never creates an attempt. */
export type AttemptRelation = 'new' | 'retry' | 'regenerate' | 'edit';

/** Status of the underlying work, independent of the client connection. */
export type AttemptStatus =
  | 'submitted'
  | 'accepted'
  | 'streaming'
  | 'awaiting-input'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'interrupted';

/** The client's connection to an attempt's stream. */
export type ConnectionState =
  'idle' | 'connecting' | 'open' | 'reconnecting' | 'disconnected' | 'closed';

/** An explicit stop request and its outcome. */
export type StopState = 'none' | 'requested' | 'confirmed' | 'too-late' | 'failed' | 'unknown';

export interface AttemptRecord {
  readonly attemptId: string;
  readonly runId: string;
  readonly conversationId: string;
  /** The assistant message this attempt writes. */
  readonly messageId: string;
  /** The user message this attempt answers. */
  readonly promptId: string;
  readonly relation: AttemptRelation;
  readonly parentAttemptId?: string | undefined;
  readonly status: AttemptStatus;
  readonly connection: ConnectionState;
  readonly stop: StopState;
  readonly error?: PublicError | undefined;
  readonly usage?: Usage | undefined;
}

export type HistoryState = 'idle' | 'loading' | 'complete' | 'error';

/** Immutable snapshot of a conversation surface. Replaced, never mutated. */
export interface ConversationState {
  readonly conversationId: string;
  /** Increments on every change; consumers compare to skip work. */
  readonly revision: number;
  /** Messages on the active branch, oldest first. */
  readonly messages: readonly MessageRecord[];
  readonly tools: Readonly<Record<string, ToolCallRecord>>;
  readonly approvals: Readonly<Record<string, ApprovalRecord>>;
  readonly artifacts: Readonly<Record<string, ArtifactRecord>>;
  readonly attempts: Readonly<Record<string, AttemptRecord>>;
  /** Alternatives for messages that have siblings, keyed by message id. */
  readonly branches: Readonly<Record<string, BranchPosition>>;
  readonly activeAttemptId?: string | undefined;
  readonly capabilities: Capabilities;
  readonly history: HistoryState;
  readonly hasMoreHistory: boolean;
  readonly feedback: Readonly<Record<string, FeedbackRecord>>;
}

export interface BranchPosition {
  /** 1-based position among siblings. */
  readonly index: number;
  readonly count: number;
  readonly previousId?: string | undefined;
  readonly nextId?: string | undefined;
}

/** Interoperable subscription contract (same shape as React's `useSyncExternalStore`). */
export interface ExternalSource<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

// ---- Normalized events (adapter output) ----

/** Identifies which attempt an event, stop, or decision belongs to. */
export interface AttemptTarget {
  readonly conversationId: string;
  readonly runId: string;
  readonly attemptId: string;
}

/**
 * Optional replay identity. Supply only what the protocol guarantees: `eventId` when ids are
 * unique per attempt, `seq` when offsets strictly increase per attempt. Content is never used to
 * detect duplicates.
 */
export interface EventIdentity {
  readonly eventId?: string | undefined;
  readonly seq?: number | undefined;
}

export type AiEvent = EventIdentity &
  (
    | { readonly type: 'attempt-accepted' }
    | { readonly type: 'message-start'; readonly messageId?: string | undefined }
    /** Discard partial output for the message and rebuild it (protocol replay). */
    | { readonly type: 'message-reset' }
    | { readonly type: 'step-start' }
    /** Remove parts added since the last `step-start`. */
    | { readonly type: 'step-reset' }
    | { readonly type: 'text-start'; readonly partId: string; readonly kind?: 'text' | 'reasoning' }
    | { readonly type: 'text-delta'; readonly partId: string; readonly delta: string }
    | { readonly type: 'text-end'; readonly partId: string }
    | { readonly type: 'part'; readonly part: MessagePart }
    | {
        readonly type: 'tool-input-start';
        readonly toolCallId: string;
        readonly toolName: string;
        readonly title?: string | undefined;
      }
    | { readonly type: 'tool-input-delta'; readonly toolCallId: string; readonly delta: string }
    | {
        readonly type: 'tool-input-available';
        readonly toolCallId: string;
        readonly input: JsonValue;
      }
    | { readonly type: 'tool-executing'; readonly toolCallId: string }
    | { readonly type: 'tool-output'; readonly toolCallId: string; readonly output: JsonValue }
    | { readonly type: 'tool-error'; readonly toolCallId: string; readonly error: PublicError }
    | { readonly type: 'tool-denied'; readonly toolCallId: string }
    | { readonly type: 'approval-request'; readonly approval: ApprovalRecord }
    | {
        readonly type: 'approval-resolved';
        readonly approvalId: string;
        readonly revision: number;
        readonly status: 'approved' | 'rejected' | 'expired' | 'superseded';
      }
    | { readonly type: 'artifact'; readonly artifact: ArtifactRecord }
    | { readonly type: 'usage'; readonly usage: Usage }
    /** Replace the attempt's message wholesale (reconciliation against a known scope). */
    | { readonly type: 'snapshot'; readonly message: MessageRecord }
    | { readonly type: 'finish'; readonly status?: 'completed' | 'awaiting-input' }
    | { readonly type: 'abort'; readonly reason?: string | undefined }
    | { readonly type: 'error'; readonly error: PublicError }
    /** Diagnostic or provider data; kept out of rendered content. */
    | { readonly type: 'metadata'; readonly data: JsonValue }
  );

export type AiEventType = AiEvent['type'];

/** Where an adapter delivers an attempt's events. Bound to one attempt; stale sinks drop events. */
export interface EventSink {
  readonly target: AttemptTarget;
  push(event: AiEvent): void;
  /** The stream ended. Without a terminal event the attempt becomes `interrupted`. */
  close(): void;
  /** False after the controller moved on (another conversation, a reset, or disposal). */
  readonly active: boolean;
}

// ---- Transport (host or adapter implementation) ----

export interface SendRequest extends AttemptTarget {
  readonly relation: AttemptRelation;
  readonly parentAttemptId?: string | undefined;
  /** The user message being answered (new or edited). */
  readonly prompt: MessageRecord;
  /** The assistant message id the attempt must write. */
  readonly messageId: string;
  /** Messages before the prompt on the active branch. */
  readonly history: readonly MessageRecord[];
}

export type StopOutcome = 'cancelled' | 'already-finished' | 'not-found' | 'unknown';
export type DecisionOutcome = 'accepted' | 'stale' | 'expired';
export type RestoreOutcome =
  | { readonly status: 'restored'; readonly checkpointId: string; readonly description: string }
  | { readonly status: 'failed'; readonly checkpointId: string; readonly error: PublicError };

export interface ApprovalDecision extends AttemptTarget {
  readonly approvalId: string;
  readonly toolCallId?: string | undefined;
  readonly revision: number;
  readonly decision: 'approve' | 'reject';
  readonly reason?: string | undefined;
}

/**
 * What an adapter provides. Optional methods are capabilities; their absence makes the matching
 * action unavailable. Promises resolve with the authoritative outcome or reject with a
 * `PublicError`-shaped value.
 */
export interface ConversationTransport {
  readonly capabilities: Capabilities;
  /** Resolve when the backend accepted the request; stream events into `sink`. */
  send(request: SendRequest, sink: EventSink): Promise<void>;
  /** Cancel the underlying work for exactly this attempt. */
  stop?(target: AttemptTarget): Promise<StopOutcome>;
  /** Close the client stream only; the work continues according to the backend's policy. */
  disconnect?(target: AttemptTarget): void;
  /** Reattach to the same attempt; never starts new work. */
  resume?(target: AttemptTarget, sink: EventSink): Promise<void>;
  decide?(decision: ApprovalDecision): Promise<DecisionOutcome>;
  loadHistory?(conversationId: string, before: string | undefined): Promise<ConversationSnapshot>;
  submitFeedback?(feedback: FeedbackRecord): Promise<void>;
}
