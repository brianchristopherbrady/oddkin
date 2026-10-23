/**
 * User-intent events of `@oddkin/ai` elements. Every event bubbles and is composed so it crosses
 * the shadow roots of nested elements (a tool call inside a message inside a conversation).
 * Dispatching an event *requests* an operation; the outcome arrives later as changed records
 * (or a controller method's result), never as the event's return value. A cancelable event's
 * `preventDefault()` is a synchronous veto of the element's local default action only.
 * Programmatic property changes never dispatch these events (`intent: 'user'`); `odd-announce` is
 * the exception, a notification from any source (`intent: 'notification'`). Options are literal
 * so the analyzer can publish them. Contract: docs/architecture/ai-interaction.md §7.
 */
import { event, type EventDetail } from '@oddkin/core/element';
import type { JsonValue } from './contracts/types.js';
import type { AttachmentState } from './controllers/composer.js';
import type { TextSelection } from './controllers/document.js';

export interface PromptSubmitDetail {
  readonly submissionId: string;
  /** Draft revision captured; acknowledging clears the draft only if unchanged since. */
  readonly revision: number;
  readonly text: string;
  readonly attachments: readonly AttachmentState[];
}
/** Request to send the draft. Cancel to veto: the composer stays editable and idle. */
export const promptSubmitEvent = event<PromptSubmitDetail>('odd-prompt-submit', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description: 'Request to send the draft. Acknowledge or fail it with the submission id.',
});

export const promptStopEvent = event<{ readonly attemptId: string | undefined }>(
  'odd-prompt-stop',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description:
      'Request to stop the underlying work of the identified attempt (not a disconnect).',
  },
);

export const attachmentAddEvent = event<{ readonly attachments: readonly AttachmentState[] }>(
  'odd-attachment-add',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description:
      'Attachments were validated and added to the draft (local; uploading is host-owned).',
  },
);

export const attachmentRemoveEvent = event<{ readonly attachmentId: string }>(
  'odd-attachment-remove',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description: 'An attachment was removed from the draft (local).',
  },
);

export const historyRequestEvent = event<{
  readonly conversationId: string;
  readonly beforeMessageId: string | undefined;
}>('odd-history-request', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to load earlier messages.',
});

export const messageEditEvent = event<{ readonly messageId: string; readonly text: string }>(
  'odd-message-edit',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description: 'Request to edit a user message as a new branch.',
  },
);

export const messageRegenerateEvent = event<{
  readonly messageId: string;
  readonly attemptId: string;
}>('odd-message-regenerate', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request an alternative answer as a new branch.',
});

export const attemptRetryEvent = event<{ readonly attemptId: string }>('odd-attempt-retry', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request a new attempt linked to a failed, interrupted, or cancelled one.',
});

export const attemptResumeEvent = event<{ readonly attemptId: string }>('odd-attempt-resume', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to reattach to an existing attempt (never starts new work).',
});

export const branchSwitchEvent = event<{
  readonly messageId: string;
  readonly targetMessageId: string;
}>('odd-branch-switch', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to show another branch.',
});

export interface ApprovalDecideDetail {
  readonly approvalId: string;
  readonly revision: number;
  readonly toolCallId: string | undefined;
  readonly decision: 'approve' | 'reject';
  readonly reason: string | undefined;
}
export const approvalDecideEvent = event<ApprovalDecideDetail>('odd-approval-decide', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to decide one approval revision. Pending until the record changes.',
});

export const approvalEditEvent = event<{ readonly approvalId: string; readonly revision: number }>(
  'odd-approval-edit',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description: 'Request to edit the proposed action before deciding.',
  },
);

export const toolRetryEvent = event<{ readonly toolCallId: string }>('odd-tool-retry', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to retry a failed tool call.',
});

export const citationOpenEvent = event<{ readonly sourceId: string; readonly resolved: boolean }>(
  'odd-citation-open',
  {
    bubbles: true,
    composed: true,
    cancelable: true,
    intent: 'user',
    description:
      'A citation was activated. The default reveals the source; cancel to navigate yourself.',
  },
);

export const artifactExportEvent = event<{
  readonly artifactId: string;
  readonly revisionId: string;
  readonly format: string;
}>('odd-artifact-export', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description:
    'Export requested. The default downloads the canonical source; cancel to export yourself.',
});

export const artifactRevisionEvent = event<{
  readonly artifactId: string;
  readonly revisionId: string;
}>('odd-artifact-revision-change', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'The viewed revision changed (presentation state).',
});

export const suggestionSelectEvent = event<{
  readonly suggestionId: string;
  readonly prompt: string;
}>('odd-suggestion-select', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Insert the suggestion into the composer without sending.',
});

export const suggestionSubmitEvent = event<{
  readonly suggestionId: string;
  readonly prompt: string;
}>('odd-suggestion-submit', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Send the suggestion as a prompt.',
});

export interface FeedbackSubmitDetail {
  readonly messageId: string;
  readonly rating: 'positive' | 'negative';
  readonly reasons: readonly string[];
  readonly comment: string;
}
export const feedbackSubmitEvent = event<FeedbackSubmitDetail>('odd-feedback-submit', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to submit feedback; confirmed through the feedback record.',
});

export const modelChangeEvent = event<{
  readonly modelId: string;
  readonly previousModelId: string;
}>('odd-model-change', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description: 'The user selected another model. Cancel to keep the previous one.',
});

export const checkpointRestoreEvent = event<{ readonly checkpointId: string }>(
  'odd-checkpoint-restore',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description:
      'Request to restore a checkpoint. Success is shown only after the record says restored.',
  },
);

export const questionAnswerEvent = event<{
  readonly questionId: string;
  readonly revision: number;
  readonly answer: JsonValue;
}>('odd-question-answer', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to submit an answer for one question revision.',
});

export const questionSkipEvent = event<{ readonly questionId: string; readonly revision: number }>(
  'odd-question-skip',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description: 'Request to skip a question.',
  },
);

export const changeAcceptEvent = event<{ readonly proposalId: string }>('odd-change-accept', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to apply a proposed change to its base revision.',
});

export const changeRejectEvent = event<{ readonly proposalId: string }>('odd-change-reject', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to discard a proposed change.',
});

export const changeUndoEvent = event<{ readonly proposalId: string }>('odd-change-undo', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to undo an applied change.',
});

export type AssistAction = 'rewrite' | 'explain' | 'summarize' | 'translate' | 'expand';
export interface AssistRequestDetail {
  readonly action: string;
  readonly selection: TextSelection;
  readonly options: { readonly language?: string };
}
export const assistRequestEvent = event<AssistRequestDetail>('odd-assist-request', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request assistance for the captured selection.',
});

export type ContextAddDetail =
  | { readonly kind: 'file'; readonly files: readonly File[] }
  | { readonly kind: 'url'; readonly url: string };
export const contextAddEvent = event<ContextAddDetail>('odd-context-add', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to add context; the item appears once the host adds its record.',
});

export const contextRemoveEvent = event<{ readonly itemId: string }>('odd-context-remove', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'Request to remove a context item.',
});

export const planInputEvent = event<{ readonly planId: string; readonly stepId: string }>(
  'odd-plan-input-request',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description: 'The user wants to answer a step that needs input.',
  },
);

export const voiceTranscriptEvent = event<{ readonly text: string }>('odd-voice-transcript', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'A final transcript is ready to use (completed locally).',
});

export const transcriptChangeEvent = event<{ readonly segmentId: string; readonly text: string }>(
  'odd-transcript-change',
  {
    bubbles: true,
    composed: true,
    cancelable: false,
    intent: 'user',
    description: 'The user edited a final transcript segment.',
  },
);

export interface AnnounceDetail {
  readonly text: string;
  readonly priority: 'polite' | 'assertive';
  /** Identical keys are announced once per surface. */
  readonly key: string;
}
export const announceEvent = event<AnnounceDetail>('odd-announce', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'notification',
  description:
    'A status message for the nearest announcer, which cancels it so outer announcers stay silent.',
});

// Prefixed names (ADR 0045) cannot collide, so document-level listeners are typed too.
declare global {
  interface GlobalEventHandlersEventMap {
    'odd-announce': CustomEvent<EventDetail<typeof announceEvent>>;
    'odd-approval-decide': CustomEvent<EventDetail<typeof approvalDecideEvent>>;
    'odd-approval-edit': CustomEvent<EventDetail<typeof approvalEditEvent>>;
    'odd-artifact-export': CustomEvent<EventDetail<typeof artifactExportEvent>>;
    'odd-artifact-revision-change': CustomEvent<EventDetail<typeof artifactRevisionEvent>>;
    'odd-assist-request': CustomEvent<EventDetail<typeof assistRequestEvent>>;
    'odd-attachment-add': CustomEvent<EventDetail<typeof attachmentAddEvent>>;
    'odd-attachment-remove': CustomEvent<EventDetail<typeof attachmentRemoveEvent>>;
    'odd-attempt-resume': CustomEvent<EventDetail<typeof attemptResumeEvent>>;
    'odd-attempt-retry': CustomEvent<EventDetail<typeof attemptRetryEvent>>;
    'odd-branch-switch': CustomEvent<EventDetail<typeof branchSwitchEvent>>;
    'odd-change-accept': CustomEvent<EventDetail<typeof changeAcceptEvent>>;
    'odd-change-reject': CustomEvent<EventDetail<typeof changeRejectEvent>>;
    'odd-change-undo': CustomEvent<EventDetail<typeof changeUndoEvent>>;
    'odd-checkpoint-restore': CustomEvent<EventDetail<typeof checkpointRestoreEvent>>;
    'odd-citation-open': CustomEvent<EventDetail<typeof citationOpenEvent>>;
    'odd-context-add': CustomEvent<EventDetail<typeof contextAddEvent>>;
    'odd-context-remove': CustomEvent<EventDetail<typeof contextRemoveEvent>>;
    'odd-feedback-submit': CustomEvent<EventDetail<typeof feedbackSubmitEvent>>;
    'odd-history-request': CustomEvent<EventDetail<typeof historyRequestEvent>>;
    'odd-message-edit': CustomEvent<EventDetail<typeof messageEditEvent>>;
    'odd-message-regenerate': CustomEvent<EventDetail<typeof messageRegenerateEvent>>;
    'odd-model-change': CustomEvent<EventDetail<typeof modelChangeEvent>>;
    'odd-plan-input-request': CustomEvent<EventDetail<typeof planInputEvent>>;
    'odd-prompt-stop': CustomEvent<EventDetail<typeof promptStopEvent>>;
    'odd-prompt-submit': CustomEvent<EventDetail<typeof promptSubmitEvent>>;
    'odd-question-answer': CustomEvent<EventDetail<typeof questionAnswerEvent>>;
    'odd-question-skip': CustomEvent<EventDetail<typeof questionSkipEvent>>;
    'odd-suggestion-select': CustomEvent<EventDetail<typeof suggestionSelectEvent>>;
    'odd-suggestion-submit': CustomEvent<EventDetail<typeof suggestionSubmitEvent>>;
    'odd-tool-retry': CustomEvent<EventDetail<typeof toolRetryEvent>>;
    'odd-transcript-change': CustomEvent<EventDetail<typeof transcriptChangeEvent>>;
    'odd-voice-transcript': CustomEvent<EventDetail<typeof voiceTranscriptEvent>>;
  }
}
