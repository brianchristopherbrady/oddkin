/**
 * Lifecycle transition tables. Transport, attempt, tool, approval, and stop state are separate
 * machines; one never implies another (finishing tool arguments is not execution, approval is
 * not success, a closed connection is not completion). Pure and DOM-free; the controller and
 * docs/architecture/ai-interaction.md §5 use the same tables.
 */
import type {
  ApprovalStatus,
  AttemptStatus,
  ConnectionState,
  StopOutcome,
  StopState,
  ToolStatus,
} from '../contracts/types.js';

type Table<S extends string> = Readonly<Record<S, readonly S[]>>;

export const ATTEMPT_TRANSITIONS: Table<AttemptStatus> = {
  submitted: [
    'accepted',
    'streaming',
    'awaiting-input',
    'completed',
    'cancelled',
    'failed',
    'interrupted',
  ],
  accepted: ['streaming', 'awaiting-input', 'completed', 'cancelled', 'failed', 'interrupted'],
  streaming: ['awaiting-input', 'completed', 'cancelled', 'failed', 'interrupted'],
  'awaiting-input': ['streaming', 'completed', 'cancelled', 'failed', 'interrupted'],
  // A resumed stream may continue or end an interrupted attempt.
  interrupted: ['streaming', 'awaiting-input', 'completed', 'cancelled', 'failed'],
  completed: [],
  cancelled: [],
  failed: [],
};

export const TOOL_TRANSITIONS: Table<ToolStatus> = {
  'input-streaming': ['input-available', 'output-error', 'cancelled'],
  'input-available': [
    'awaiting-approval',
    'executing',
    'output-available',
    'output-error',
    'denied',
    'cancelled',
  ],
  'awaiting-approval': ['executing', 'output-available', 'output-error', 'denied', 'cancelled'],
  executing: ['output-available', 'output-error', 'cancelled'],
  // A host retry runs the tool again.
  'output-error': ['executing'],
  'output-available': [],
  denied: [],
  cancelled: [],
};

export const APPROVAL_TRANSITIONS: Table<ApprovalStatus> = {
  // approved/rejected directly: decided elsewhere (another client or an automatic policy).
  requested: ['decision-pending', 'approved', 'rejected', 'expired', 'superseded'],
  'decision-pending': ['approved', 'rejected', 'decision-failed', 'expired', 'superseded'],
  'decision-failed': ['decision-pending', 'approved', 'rejected', 'expired', 'superseded'],
  approved: [],
  rejected: [],
  expired: [],
  superseded: [],
};

export const CONNECTION_TRANSITIONS: Table<ConnectionState> = {
  idle: ['connecting', 'open', 'closed'],
  connecting: ['open', 'closed', 'disconnected'],
  open: ['closed', 'disconnected'],
  disconnected: ['reconnecting'],
  closed: ['reconnecting'],
  reconnecting: ['open', 'closed', 'disconnected'],
};

export function canTransition<S extends string>(table: Table<S>, from: S, to: S): boolean {
  return from === to || table[from].includes(to);
}

const TERMINAL: ReadonlySet<AttemptStatus> = new Set(['completed', 'cancelled', 'failed']);
/** The underlying work has ended (as reported by the backend, not inferred from a closed stream). */
export const isTerminal = (status: AttemptStatus): boolean => TERMINAL.has(status);
/** Work may still be running remotely. `interrupted` means the client lost track of it. */
export const isActive = (status: AttemptStatus): boolean =>
  status === 'submitted' ||
  status === 'accepted' ||
  status === 'streaming' ||
  status === 'awaiting-input';

export const TOOL_SETTLED: ReadonlySet<ToolStatus> = new Set([
  'output-available',
  'output-error',
  'denied',
  'cancelled',
]);

/**
 * Apply a stop response to an attempt. `rejected` means the stop request itself failed.
 * A stop that arrives after completion never rewrites the completed status.
 *
 * | Outcome            | Attempt not terminal      | Attempt already terminal          |
 * | ------------------ | ------------------------- | --------------------------------- |
 * | `cancelled`        | status → cancelled; stop → confirmed | status kept; stop → confirmed if cancelled, else too-late |
 * | `already-finished` | status kept (await the terminal event); stop → too-late | status kept; stop → too-late |
 * | `not-found`/`unknown` | status kept; stop → unknown | status kept; stop → unknown |
 * | rejected           | status kept; stop → failed | status kept; stop → failed |
 */
export function applyStopOutcome(
  status: AttemptStatus,
  outcome: StopOutcome | 'rejected',
): { status: AttemptStatus; stop: StopState } {
  const terminal = isTerminal(status);
  switch (outcome) {
    case 'cancelled':
      if (!terminal) return { status: 'cancelled', stop: 'confirmed' };
      return { status, stop: status === 'cancelled' ? 'confirmed' : 'too-late' };
    case 'already-finished':
      return { status, stop: 'too-late' };
    case 'not-found':
    case 'unknown':
      return { status, stop: 'unknown' };
    case 'rejected':
      return { status, stop: 'failed' };
  }
}

/** Stop state after a terminal event arrives while a stop may be pending. */
export function stopAfterTerminal(stop: StopState, terminal: AttemptStatus): StopState {
  if (stop !== 'requested') return stop;
  return terminal === 'cancelled' ? 'confirmed' : 'too-late';
}
