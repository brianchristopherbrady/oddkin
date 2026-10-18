/**
 * Serializable, provider-neutral records for AI interaction surfaces. One `@oddkin/core/model`
 * definition per record supplies the TypeScript type (`Infer`), runtime validation at untrusted
 * boundaries, and JSON Schema (`schemas/*.json`). Runtime resources (File, streams,
 * AbortControllers, DOM selections) are never part of these records.
 * Contract: docs/architecture/ai-interaction.md §3.
 */
import { defineModel, m } from '@oddkin/core/model';

const timestamp = () => m.optional(m.string({ description: 'ISO 8601 timestamp.' }));

export const publicErrorSchema = m.object(
  {
    code: m.string({ minLength: 1, description: 'Stable application-defined code.' }),
    message: m.string({ description: 'User-presentable message, localized by the host.' }),
    retryable: m.optional(m.boolean('Whether retrying the same operation may succeed.')),
  },
  'An error safe to show to users. Diagnostic details stay in host logs.',
);

const capabilitySchema = m.object({
  available: m.boolean('Whether the action is supported and allowed now.'),
  reason: m.optional(m.string({ description: 'Why the action is unavailable, for users.' })),
});

/** Every capability is optional; an absent capability is unavailable. */
export const capabilitiesSchema = m.object(
  {
    send: m.optional(capabilitySchema),
    stop: m.optional(capabilitySchema),
    disconnect: m.optional(capabilitySchema),
    reconnect: m.optional(capabilitySchema),
    resume: m.optional(capabilitySchema),
    retry: m.optional(capabilitySchema),
    edit: m.optional(capabilitySchema),
    regenerate: m.optional(capabilitySchema),
    switchBranch: m.optional(capabilitySchema),
    respondToApproval: m.optional(capabilitySchema),
    editApproval: m.optional(capabilitySchema),
    restoreCheckpoint: m.optional(capabilitySchema),
    voice: m.optional(capabilitySchema),
    attachments: m.optional(capabilitySchema),
    history: m.optional(capabilitySchema),
    feedback: m.optional(capabilitySchema),
  },
  'Actions the adapter and application actually support. Absent means unavailable.',
);

const textBody = {
  id: m.id('Stable part id.'),
  text: m.string({ description: 'Canonical source text (Markdown for assistant text).' }),
  state: m.optional(m.enum(['streaming', 'done'], 'Whether more text may arrive.')),
};

/** Message parts. Unknown or invalid parts are replaced by `unsupported` on ingestion. */
export const partSchema = m.union('type', {
  text: m.object(textBody),
  reasoning: m.object(textBody),
  file: m.object({
    id: m.id(),
    name: m.string({ description: 'Untrusted file name; rendered as text.' }),
    mediaType: m.string(),
    url: m.optional(m.url('Where the file can be fetched; checked by the URL policy.')),
    size: m.optional(m.number({ integer: true, minimum: 0, description: 'Bytes.' })),
  }),
  source: m.object({
    id: m.id(),
    sourceId: m.id('Citation key referenced from text as [^sourceId].'),
    title: m.optional(m.string()),
    url: m.optional(m.url()),
    excerpt: m.optional(m.string()),
    publisher: m.optional(m.string()),
    kind: m.optional(m.enum(['web', 'document', 'file', 'other'])),
  }),
  'tool-call': m.object({
    id: m.id(),
    toolCallId: m.id('Key of the tool call record; its state lives there.'),
  }),
  approval: m.object({ id: m.id(), approvalId: m.id('Key of the approval record.') }),
  artifact: m.object({
    id: m.id(),
    artifactId: m.id('Key of the artifact record.'),
    revisionId: m.optional(m.id('Revision this message produced.')),
  }),
  data: m.object({
    id: m.id(),
    name: m.string({ minLength: 1, description: 'Renderer registry key.' }),
    data: m.json({ description: 'Validated by the registered renderer before use.' }),
  }),
  unsupported: m.object({
    id: m.id(),
    originalType: m.string({ description: 'Type that could not be rendered.' }),
  }),
});

export const provenanceSchema = m.object(
  {
    kind: m.enum(['generated', 'assisted', 'edited', 'human'], 'How the content was produced.'),
    label: m.optional(m.string({ description: 'Host-supplied visible label.' })),
    model: m.optional(m.string()),
    provider: m.optional(m.string()),
    generatedAt: timestamp(),
    notes: m.optional(m.string({ description: 'Host-supplied explanation, shown as is.' })),
  },
  'Application-supplied origin information. Displayed as supplied, never verified.',
);

export const MessageModel = defineModel('oddkin.ai.message', {
  version: 1,
  description: 'One message. Parts are ordered; ids are stable across updates.',
  schema: m.object({
    id: m.id(),
    role: m.enum(['user', 'assistant', 'system', 'tool']),
    parentId: m.optional(m.id('Previous message on this branch; siblings are alternatives.')),
    parts: m.array(partSchema),
    attemptId: m.optional(m.id('Attempt that produced an assistant message.')),
    createdAt: timestamp(),
    provenance: m.optional(provenanceSchema),
  }),
});

const toolStatus = m.enum(
  [
    'input-streaming',
    'input-available',
    'awaiting-approval',
    'executing',
    'output-available',
    'output-error',
    'denied',
    'cancelled',
  ],
  'Argument generation, approval, and execution are separate states.',
);

export const ToolCallModel = defineModel('oddkin.ai.tool-call', {
  version: 1,
  schema: m.object({
    toolCallId: m.id(),
    attemptId: m.optional(m.id()),
    toolName: m.string({ minLength: 1 }),
    title: m.optional(m.string({ description: 'Human-readable tool name.' })),
    purpose: m.optional(m.string({ description: 'Why the tool is being used.' })),
    status: toolStatus,
    inputText: m.optional(m.string({ description: 'Streamed argument text, possibly partial.' })),
    input: m.optional(m.json({ description: 'Complete arguments.' })),
    output: m.optional(m.json({ description: 'Result; untrusted.' })),
    error: m.optional(publicErrorSchema),
    approvalId: m.optional(m.id()),
    retryable: m.optional(m.boolean('The host can retry this tool call.')),
  }),
});

export const approvalStatusValues = [
  'requested',
  'decision-pending',
  'approved',
  'rejected',
  'expired',
  'superseded',
  'decision-failed',
] as const;

export const ApprovalModel = defineModel('oddkin.ai.approval', {
  version: 1,
  description: 'A request to approve an action. Approval never implies the action succeeded.',
  schema: m.object({
    approvalId: m.id(),
    attemptId: m.optional(m.id()),
    toolCallId: m.optional(m.id()),
    revision: m.number({ integer: true, minimum: 1, description: 'Proposal revision.' }),
    title: m.string({ minLength: 1 }),
    summary: m.optional(m.string()),
    target: m.optional(m.string({ description: 'What the action affects.' })),
    changes: m.optional(
      m.array(
        m.object({
          label: m.string(),
          before: m.optional(m.string()),
          after: m.optional(m.string()),
        }),
      ),
    ),
    risk: m.optional(m.enum(['low', 'medium', 'high'])),
    status: m.enum(approvalStatusValues),
    decision: m.optional(m.enum(['approve', 'reject'])),
    reason: m.optional(m.string()),
    expiresAt: timestamp(),
    error: m.optional(publicErrorSchema),
  }),
});

export const ArtifactModel = defineModel('oddkin.ai.artifact', {
  version: 1,
  description: 'A generated artifact with a stable identity across revisions.',
  schema: m.object({
    artifactId: m.id(),
    title: m.string({ minLength: 1 }),
    kind: m.string({ minLength: 1, description: 'markdown, code, text, or a host renderer key.' }),
    language: m.optional(m.string()),
    currentRevisionId: m.id(),
    revisions: m.array(
      m.object({
        revisionId: m.id(),
        number: m.number({ integer: true, minimum: 1 }),
        createdAt: timestamp(),
        summary: m.optional(m.string()),
        content: m.string({ description: 'Canonical source; exported as is.' }),
      }),
      { minItems: 1 },
    ),
  }),
});

export const usageEntrySchema = m.object({
  kind: m.enum(['input-tokens', 'output-tokens', 'context', 'quota', 'cost', 'other']),
  label: m.string({ minLength: 1 }),
  used: m.optional(m.number({ minimum: 0 })),
  limit: m.optional(m.number({ minimum: 0 })),
  unit: m.optional(m.string({ description: 'tokens, requests, … (cost uses currency).' })),
  currency: m.optional(m.string({ pattern: '^[A-Z]{3}$', description: 'ISO 4217.' })),
  precision: m.enum(['measured', 'estimated', 'unknown'], 'Supplied by the host; never inferred.'),
});

export const UsageModel = defineModel('oddkin.ai.usage', {
  version: 1,
  schema: m.array(usageEntrySchema),
});

export const CheckpointModel = defineModel('oddkin.ai.checkpoint', {
  version: 1,
  description: 'A restore point. Restoration is shown only after the host confirms it.',
  schema: m.object({
    checkpointId: m.id(),
    label: m.string({ minLength: 1 }),
    description: m.string({ description: 'Which state is restored.' }),
    restores: m.array(m.string(), { description: 'Each item of state the restore replaces.' }),
    createdAt: timestamp(),
    status: m.enum(['available', 'restore-pending', 'restored', 'restore-failed', 'unavailable']),
    outcome: m.optional(m.string({ description: 'Host-confirmed result.' })),
    error: m.optional(publicErrorSchema),
  }),
});

const stepStatus = m.enum([
  'pending',
  'active',
  'done',
  'failed',
  'blocked',
  'skipped',
  'needs-input',
]);

export const PlanModel = defineModel('oddkin.ai.plan', {
  version: 1,
  schema: m.object({
    planId: m.id(),
    title: m.optional(m.string()),
    steps: m.array(
      m.object({
        id: m.id(),
        title: m.string({ minLength: 1 }),
        detail: m.optional(m.string()),
        status: stepStatus,
        blocker: m.optional(m.string({ description: 'Why the step cannot continue.' })),
        inputRequest: m.optional(m.string({ description: 'What the agent needs from the user.' })),
        tasks: m.optional(
          m.array(
            m.object({
              id: m.id(),
              title: m.string({ minLength: 1 }),
              status: stepStatus,
              detail: m.optional(m.string()),
            }),
            { description: 'Work running in parallel within the step.' },
          ),
        ),
      }),
    ),
  }),
});

export const QuestionModel = defineModel('oddkin.ai.question', {
  version: 1,
  schema: m.object({
    questionId: m.id(),
    revision: m.number({ integer: true, minimum: 1 }),
    prompt: m.string({ minLength: 1 }),
    kind: m.enum(['choice', 'multi-choice', 'form', 'text']),
    options: m.optional(
      m.array(m.object({ id: m.id(), label: m.label(), description: m.optional(m.string()) })),
    ),
    fields: m.optional(
      m.array(
        m.object({
          id: m.id(),
          label: m.label(),
          type: m.enum(['text', 'number', 'select', 'boolean']),
          required: m.optional(m.boolean()),
          options: m.optional(m.array(m.string())),
        }),
      ),
    ),
    allowCustom: m.optional(m.boolean('Offer a free-text answer.')),
    status: m.enum(['requested', 'submitting', 'submitted', 'skipped', 'expired', 'failed']),
    answer: m.optional(m.json()),
    expiresAt: timestamp(),
    error: m.optional(publicErrorSchema),
  }),
});

export const ContextItemModel = defineModel('oddkin.ai.context-item', {
  version: 1,
  schema: m.object({
    id: m.id(),
    kind: m.enum(['file', 'document', 'url', 'selection']),
    label: m.string({ minLength: 1, description: 'Untrusted; rendered as text.' }),
    detail: m.optional(m.string()),
    status: m.enum([
      'selected',
      'uploading',
      'uploaded',
      'processing',
      'ready',
      'failed',
      'removed',
    ]),
    url: m.optional(m.url()),
    preview: m.optional(m.string({ description: 'Plain-text excerpt for inspection.' })),
    mediaType: m.optional(m.string()),
    size: m.optional(m.number({ integer: true, minimum: 0 })),
    error: m.optional(publicErrorSchema),
  }),
});

export const ModelOptionModel = defineModel('oddkin.ai.model-option', {
  version: 1,
  schema: m.object({
    id: m.id(),
    label: m.label(),
    description: m.optional(m.string()),
    provider: m.optional(m.string()),
    capabilities: m.optional(m.array(m.string())),
    available: m.boolean(),
    reason: m.optional(m.string({ description: 'Why the model is unavailable.' })),
  }),
});

export const FeedbackModel = defineModel('oddkin.ai.feedback', {
  version: 1,
  schema: m.object({
    messageId: m.id(),
    rating: m.optional(m.enum(['positive', 'negative'])),
    reasons: m.optional(m.array(m.string())),
    comment: m.optional(m.string()),
    status: m.enum(['idle', 'pending', 'submitted', 'failed']),
    error: m.optional(publicErrorSchema),
  }),
});

export const SuggestionModel = defineModel('oddkin.ai.suggestion', {
  version: 1,
  schema: m.object({
    id: m.id(),
    label: m.label(),
    prompt: m.string({ description: 'Text inserted or submitted.' }),
  }),
});

export const TranscriptSegmentModel = defineModel('oddkin.ai.transcript-segment', {
  version: 1,
  schema: m.object({
    id: m.id(),
    text: m.string(),
    final: m.boolean('Interim text may still change.'),
    speaker: m.optional(m.string()),
  }),
});

export const ConversationSnapshotModel = defineModel('oddkin.ai.conversation', {
  version: 1,
  description: 'A persisted conversation as supplied by the host (untrusted until validated).',
  schema: m.object({
    conversationId: m.id(),
    messages: m.array(MessageModel.schema),
    activeLeafId: m.optional(m.id()),
    tools: m.optional(m.array(ToolCallModel.schema)),
    approvals: m.optional(m.array(ApprovalModel.schema)),
    artifacts: m.optional(m.array(ArtifactModel.schema)),
    hasMoreHistory: m.optional(m.boolean()),
  }),
});
