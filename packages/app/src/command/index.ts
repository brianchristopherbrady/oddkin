/**
 * `@oddkin/app/command` — explicit mutations with owned pending/error/result state, an explicit
 * retry policy, and cancellation that never claims a rollback. DOM-free.
 * Contract: docs/architecture/core-contracts.md §8.
 */
export { command } from './command.js';
export type {
  Command,
  CommandConcurrency,
  CommandOptions,
  CommandOutcome,
  CommandState,
  RetryPolicy,
  RunContext,
} from './command.js';
