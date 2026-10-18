/**
 * Adapters between element intent events and whoever owns the state: an Oddkin controller or the
 * application's own store. Elements only request; these bindings decide what a request does.
 * DOM-free at import; `bindIntents` needs an `EventTarget` when called.
 */
import type { ActionResult, ConversationController } from './conversation.js';
import type { ComposerController } from './composer.js';
import type { ApprovalDecideDetail, FeedbackSubmitDetail, PromptSubmitDetail } from '../events.js';

export interface IntentHandlers {
  'prompt-submit'(detail: PromptSubmitDetail, event: Event): void;
  'prompt-stop'(detail: { attemptId: string | undefined }, event: Event): void;
  'history-request'(
    detail: { conversationId: string; beforeMessageId: string | undefined },
    event: Event,
  ): void;
  'message-edit'(detail: { messageId: string; text: string }, event: Event): void;
  'message-regenerate'(detail: { messageId: string; attemptId: string }, event: Event): void;
  'attempt-retry'(detail: { attemptId: string }, event: Event): void;
  'attempt-resume'(detail: { attemptId: string }, event: Event): void;
  'branch-switch'(detail: { messageId: string; targetMessageId: string }, event: Event): void;
  'approval-decide'(detail: ApprovalDecideDetail, event: Event): void;
  'feedback-submit'(detail: FeedbackSubmitDetail, event: Event): void;
  'suggestion-submit'(detail: { suggestionId: string; prompt: string }, event: Event): void;
  'suggestion-select'(detail: { suggestionId: string; prompt: string }, event: Event): void;
  'tool-retry'(detail: { toolCallId: string }, event: Event): void;
}

/** Listen for intent events on `target` (usually a surface's root element). Returns a release. */
export function bindIntents(target: EventTarget, handlers: Partial<IntentHandlers>): () => void {
  const releases: (() => void)[] = [];
  for (const [type, handler] of Object.entries(handlers)) {
    if (typeof handler !== 'function') continue;
    const listener = (event: Event) =>
      (handler as (detail: unknown, event: Event) => void)((event as CustomEvent).detail, event);
    target.addEventListener(type, listener);
    releases.push(() => target.removeEventListener(type, listener));
  }
  return () => {
    for (const release of releases.splice(0)) release();
  };
}

export interface ControllerIntentOptions {
  /** Called with every controller result, e.g. to surface `unavailable` or `stale` outcomes. */
  readonly onResult?: (intent: keyof IntentHandlers, result: ActionResult) => void;
}

/**
 * Handlers that route intents to a `ConversationController` (and the composer that produced the
 * submission, so it is acknowledged or failed by id).
 */
export function controllerIntents(
  controller: ConversationController,
  composer?: ComposerController,
  options: ControllerIntentOptions = {},
): Partial<IntentHandlers> {
  const report = (intent: keyof IntentHandlers) => (result: ActionResult) =>
    options.onResult?.(intent, result);
  return {
    'prompt-submit': (detail) => {
      const files = detail.attachments.map((a) => ({
        type: 'file' as const,
        id: a.id,
        name: a.name,
        mediaType: a.mediaType,
        size: a.size,
        ...(a.url ? { url: a.url } : {}),
      }));
      void controller.send({ text: detail.text, files }).then((result) => {
        if (composer) {
          if (result.ok) composer.acknowledge(detail.submissionId);
          else
            composer.fail(
              detail.submissionId,
              result.error ?? {
                code: `ai.send.${result.reason}`,
                message: 'The message could not be sent.',
                retryable: true,
              },
            );
        }
        report('prompt-submit')(result);
      });
    },
    'prompt-stop': (detail) => void controller.stop(detail.attemptId).then(report('prompt-stop')),
    'history-request': () => void controller.loadHistory().then(report('history-request')),
    'message-edit': (detail) =>
      void controller.edit(detail.messageId, detail.text).then(report('message-edit')),
    'message-regenerate': (detail) =>
      void controller.regenerate(detail.messageId).then(report('message-regenerate')),
    'attempt-retry': (detail) =>
      void controller.retry(detail.attemptId).then(report('attempt-retry')),
    'attempt-resume': (detail) =>
      void controller.resume(detail.attemptId).then(report('attempt-resume')),
    'branch-switch': (detail) =>
      report('branch-switch')(controller.switchBranch(detail.targetMessageId)),
    'approval-decide': (detail) =>
      void controller
        .decide(detail.approvalId, detail.revision, detail.decision, detail.reason)
        .then(report('approval-decide')),
    'feedback-submit': (detail) =>
      void controller
        .submitFeedback({
          messageId: detail.messageId,
          rating: detail.rating,
          reasons: [...detail.reasons],
          ...(detail.comment ? { comment: detail.comment } : {}),
        })
        .then(report('feedback-submit')),
    'suggestion-submit': (detail) =>
      void controller.send({ text: detail.prompt }).then(report('suggestion-submit')),
    'suggestion-select': (detail) => composer?.setText(detail.prompt),
  };
}
