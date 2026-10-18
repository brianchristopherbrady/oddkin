/**
 * Integration for applications that own conversation state in their own store. The store stays
 * authoritative; these helpers validate its records at the boundary and expose them through the
 * `ExternalSource` contract the elements read. No copy of the conversation is kept.
 */
import {
  normalizeApproval,
  normalizeArtifact,
  normalizeMessage,
  normalizeToolCall,
  type NormalizeDiagnostic,
} from '../contracts/normalize.js';
import type {
  AttemptRecord,
  BranchPosition,
  Capabilities,
  ConversationState,
  ExternalSource,
  FeedbackRecord,
  HistoryState,
} from '../contracts/types.js';

/** Derive a source from another, memoized on the input snapshot's identity. */
export function selectSource<T, U>(
  source: ExternalSource<T>,
  select: (value: T) => U,
): ExternalSource<U> {
  let input: T | typeof UNSET = UNSET;
  let output!: U;
  const read = () => {
    const next = source.getSnapshot();
    if (next !== input) {
      input = next;
      output = select(next);
    }
    return output;
  };
  return {
    getSnapshot: read,
    subscribe(listener) {
      let last = read();
      return source.subscribe(() => {
        const next = read();
        if (next !== last) {
          last = next;
          listener();
        }
      });
    },
  };
}
const UNSET = Symbol('unset');

/** Application-owned data for one conversation view. Records are untrusted until validated. */
export interface ConversationViewInput {
  readonly conversationId: string;
  readonly revision?: number;
  /** Messages on the active branch, oldest first. */
  readonly messages: readonly unknown[];
  readonly tools?: readonly unknown[];
  readonly approvals?: readonly unknown[];
  readonly artifacts?: readonly unknown[];
  readonly attempts?: readonly AttemptRecord[];
  readonly activeAttemptId?: string;
  readonly branches?: Readonly<Record<string, BranchPosition>>;
  readonly capabilities: Capabilities;
  readonly history?: HistoryState;
  readonly hasMoreHistory?: boolean;
  readonly feedback?: Readonly<Record<string, FeedbackRecord>>;
}

/**
 * Build the immutable `ConversationState` elements render from application data, validating
 * and normalizing every record. Invalid records are left out and reported; unknown parts become
 * explicit `unsupported` parts.
 */
export function createConversationView(
  input: ConversationViewInput,
  onDiagnostic?: (diagnostic: NormalizeDiagnostic) => void,
): ConversationState {
  const keep = <T>(
    items: readonly unknown[] | undefined,
    normalize: (
      raw: unknown,
      path: string,
    ) => { value: T | undefined; diagnostics: readonly NormalizeDiagnostic[] },
    path: string,
  ): T[] => {
    const out: T[] = [];
    (items ?? []).forEach((item, i) => {
      const result = normalize(item, `${path}/${i}`);
      for (const d of result.diagnostics) onDiagnostic?.(d);
      if (result.value) out.push(result.value);
    });
    return out;
  };
  const messages = keep(input.messages, normalizeMessage, '/messages');
  return {
    conversationId: input.conversationId,
    revision: input.revision ?? 0,
    messages,
    tools: Object.fromEntries(
      keep(input.tools, normalizeToolCall, '/tools').map((t) => [t.toolCallId, t]),
    ),
    approvals: Object.fromEntries(
      keep(input.approvals, normalizeApproval, '/approvals').map((a) => [a.approvalId, a]),
    ),
    artifacts: Object.fromEntries(
      keep(input.artifacts, normalizeArtifact, '/artifacts').map((a) => [a.artifactId, a]),
    ),
    attempts: Object.fromEntries((input.attempts ?? []).map((a) => [a.attemptId, a])),
    branches: input.branches ?? {},
    activeAttemptId: input.activeAttemptId,
    capabilities: input.capabilities,
    history: input.history ?? (input.hasMoreHistory ? 'idle' : 'complete'),
    hasMoreHistory: input.hasMoreHistory ?? false,
    feedback: input.feedback ?? {},
  };
}
