/**
 * `@oddkin/ai/controllers` — headless, DOM-free interaction behavior: conversation, composer,
 * revision-bound documents, voice, announcement policy, lifecycle tables, and intent bindings.
 */
export { ConversationController } from './conversation.js';
export type {
  ActionResult,
  ConversationControllerOptions,
  ControllerDiagnostic,
  SendInput,
} from './conversation.js';
export { ComposerController, matchesAccept } from './composer.js';
export type {
  AttachmentState,
  AttachmentStatus,
  ComposerIssue,
  ComposerIssueCode,
  ComposerOptions,
  ComposerState,
  Submission,
} from './composer.js';
export {
  DocumentSession,
  captureSelection,
  fromCodePointOffset,
  isBoundary,
  isValidRange,
  toCodePointOffset,
} from './document.js';
export type {
  ApplyResult,
  DocumentState,
  EditProposal,
  ProposalStatus,
  TextRange,
  TextSelection,
} from './document.js';
export { diffLines, diffTokens, diffWords, lineTokens, wordTokens } from './diff.js';
export type { DiffSegment } from './diff.js';
export { VoiceController, createScriptedVoiceAdapter } from './voice.js';
export type {
  ScriptedVoiceAdapter,
  VoiceAdapter,
  VoiceErrorCode,
  VoiceHandlers,
  VoiceScriptStep,
  VoiceSession,
  VoiceState,
  VoiceStatus,
} from './voice.js';
export { DEFAULT_ANNOUNCEMENTS, describeConversationChange, format } from './announcer.js';
export type { AnnouncementLevel, AnnouncementStrings } from './announcer.js';
export {
  APPROVAL_TRANSITIONS,
  ATTEMPT_TRANSITIONS,
  CONNECTION_TRANSITIONS,
  TOOL_TRANSITIONS,
  applyStopOutcome,
  canTransition,
  isActive,
  isTerminal,
  stopAfterTerminal,
} from './transitions.js';
export { bindIntents, controllerIntents } from './intents.js';
export type { ControllerIntentOptions, IntentHandlers } from './intents.js';
export { createConversationView, selectSource } from './external-store.js';
export type { ConversationViewInput } from './external-store.js';
