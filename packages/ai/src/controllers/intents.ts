/**
 * Adapters between element intent events and whoever owns the state: an Oddkin controller or the
 * application's own store. Elements only request; these bindings decide what a request does.
 * DOM-free at import; `bindIntents` needs an `EventTarget` when called.
 */
import type { ActionResult, ConversationController } from './conversation.js';
import type { ComposerController } from './composer.js';
import type { ApprovalDecideDetail, FeedbackSubmitDetail, PromptSubmitDetail } from '../events.js';

export interface IntentHandlers {
  'odd-prompt-submit'(detail: PromptSubmitDetail, event: Event): void;
  'odd-prompt-stop'(detail: { attemptId: string | undefined }, event: Event): void;
  'odd-history-request'(
    detail: { conversationId: string; beforeMessageId: string | undefined },
    event: Event,
  ): void;
  'odd-message-edit'(detail: { messageId: string; text: string }, event: Event): void;
  'odd-message-regenerate'(detail: { messageId: string; attemptId: string }, event: Event): void;
  'odd-attempt-retry'(detail: { attemptId: string }, event: Event): void;
  'odd-attempt-resume'(detail: { attemptId: string }, event: Event): void;
  'odd-branch-switch'(detail: { messageId: string; targetMessageId: string }, event: Event): void;
  'odd-approval-decide'(detail: ApprovalDecideDetail, event: Event): void;
  'odd-feedback-submit'(detail: FeedbackSubmitDetail, event: Event): void;
  'odd-suggestion-submit'(detail: { suggestionId: string; prompt: string }, event: Event): void;
  'odd-suggestion-select'(detail: { suggestionId: string; prompt: string }, event: Event): void;
  'odd-tool-retry'(detail: { toolCallId: string }, event: Event): void;
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
    'odd-prompt-submit': (detail) => {
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
        report('odd-prompt-submit')(result);
      });
    },
    'odd-prompt-stop': (detail) =>
      void controller.stop(detail.attemptId).then(report('odd-prompt-stop')),
    'odd-history-request': () => void controller.loadHistory().then(report('odd-history-request')),
    'odd-message-edit': (detail) =>
      void controller.edit(detail.messageId, detail.text).then(report('odd-message-edit')),
    'odd-message-regenerate': (detail) =>
      void controller.regenerate(detail.messageId).then(report('odd-message-regenerate')),
    'odd-attempt-retry': (detail) =>
      void controller.retry(detail.attemptId).then(report('odd-attempt-retry')),
    'odd-attempt-resume': (detail) =>
      void controller.resume(detail.attemptId).then(report('odd-attempt-resume')),
    'odd-branch-switch': (detail) =>
      report('odd-branch-switch')(controller.switchBranch(detail.targetMessageId)),
    'odd-approval-decide': (detail) =>
      void controller
        .decide(detail.approvalId, detail.revision, detail.decision, detail.reason)
        .then(report('odd-approval-decide')),
    'odd-feedback-submit': (detail) =>
      void controller
        .submitFeedback({
          messageId: detail.messageId,
          rating: detail.rating,
          reasons: [...detail.reasons],
          ...(detail.comment ? { comment: detail.comment } : {}),
        })
        .then(report('odd-feedback-submit')),
    'odd-suggestion-submit': (detail) =>
      void controller.send({ text: detail.prompt }).then(report('odd-suggestion-submit')),
    'odd-suggestion-select': (detail) => composer?.setText(detail.prompt),
  };
}
