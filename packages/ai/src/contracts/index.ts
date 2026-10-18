/**
 * `@oddkin/ai/contracts` — provider-neutral records, models, normalized events, transport and
 * capability contracts, and boundary validation. DOM-free.
 */
export {
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
  approvalStatusValues,
  capabilitiesSchema,
  partSchema,
  provenanceSchema,
  publicErrorSchema,
} from './models.js';
export {
  CAPABILITY_NAMES,
  can,
  intersectCapabilities,
  normalizeApproval,
  normalizeArtifact,
  normalizeMessage,
  normalizePart,
  normalizeSnapshot,
  normalizeToolCall,
  pickDeclared,
  toPublicError,
  unavailableReason,
} from './normalize.js';
export type { NormalizeDiagnostic, Normalized } from './normalize.js';
export type * from './types.js';
