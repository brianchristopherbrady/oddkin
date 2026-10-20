/**
 * `@oddkin/state/context` — typed values from the nearest provider in the composed tree, over the
 * community context protocol. Imports without DOM globals; providers and consumers need a DOM.
 * Contract: docs/architecture/core-contracts.md §7.2.
 */
export {
  ContextProviderEvent,
  ContextRequestEvent,
  consume,
  createContext,
  provide,
} from './context.js';
export type {
  ConsumeOptions,
  Context,
  ContextCallback,
  ContextConsumer,
  ContextProvider,
  ContextType,
} from './context.js';
