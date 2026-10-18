/**
 * Announcement policy: which state changes deserve a screen-reader status message. Meaningful
 * transitions only (submission, generation start and end, stop, failure, approval, history);
 * never streamed text. Pure and DOM-free; `createAnnouncer` delivers the result through one
 * live region per surface. Contract: docs/architecture/ai-interaction.md §10.2.
 */
import { format } from '@oddkin/core/i18n';
import type { AnnounceDetail } from '../events.js';
import type { ConversationState } from '../contracts/types.js';

/** `important`: outcomes and requests for action. `all` adds progress. `none` is silent. */
export type AnnouncementLevel = 'all' | 'important' | 'none';

export interface AnnouncementStrings {
  readonly sent: string;
  readonly responding: string;
  readonly completed: string;
  readonly stopped: string;
  readonly stopping: string;
  readonly stopTooLate: string;
  readonly stopUnknown: string;
  readonly failed: string;
  readonly interrupted: string;
  readonly disconnected: string;
  readonly awaitingInput: string;
  readonly approvalRequested: string;
  readonly approvalApproved: string;
  readonly approvalRejected: string;
  readonly approvalExpired: string;
  readonly approvalSuperseded: string;
  readonly toolFailed: string;
  readonly historyLoaded: string;
}

export const DEFAULT_ANNOUNCEMENTS: AnnouncementStrings = {
  sent: 'Message sent.',
  responding: 'Assistant is responding.',
  completed: 'Response complete.',
  stopped: 'Response stopped.',
  stopping: 'Stopping…',
  stopTooLate: 'The response finished before it could be stopped.',
  stopUnknown: 'Stop could not be confirmed. The response may still be running.',
  failed: 'Response failed: {message}',
  interrupted: 'Connection lost. The response may be incomplete.',
  disconnected: 'Disconnected from the response.',
  awaitingInput: 'The assistant is waiting for your input.',
  approvalRequested: 'Approval needed: {title}',
  approvalApproved: 'Approved: {title}',
  approvalRejected: 'Rejected: {title}',
  approvalExpired: 'Approval expired: {title}',
  approvalSuperseded: 'The proposal changed: {title}. Review it again.',
  toolFailed: '{tool} failed.',
  historyLoaded: 'Earlier messages loaded.',
};

/** Replace `{name}` placeholders. Values are plain text. */
export { format };

type Entry = AnnounceDetail & { readonly level: 'important' | 'all' };

/** Announcements for the change from `previous` to `next`. Nothing for the first snapshot. */
export function describeConversationChange(
  previous: ConversationState | undefined,
  next: ConversationState,
  level: AnnouncementLevel,
  strings: AnnouncementStrings = DEFAULT_ANNOUNCEMENTS,
): AnnounceDetail[] {
  if (!previous || level === 'none' || previous.conversationId !== next.conversationId) return [];
  const out: Entry[] = [];
  for (const attempt of Object.values(next.attempts)) {
    const before = previous.attempts[attempt.attemptId];
    const key = (what: string) => `attempt:${attempt.attemptId}:${what}`;
    if (!before) {
      if (attempt.relation === 'new')
        out.push({ text: strings.sent, priority: 'polite', key: key('sent'), level: 'important' });
      continue;
    }
    if (before.status !== attempt.status) {
      switch (attempt.status) {
        case 'streaming':
          if (before.status !== 'awaiting-input' && before.status !== 'interrupted')
            out.push({
              text: strings.responding,
              priority: 'polite',
              key: key('streaming'),
              level: 'all',
            });
          break;
        case 'completed':
          out.push({
            text: strings.completed,
            priority: 'polite',
            key: key('completed'),
            level: 'important',
          });
          break;
        case 'cancelled':
          out.push({
            text: strings.stopped,
            priority: 'polite',
            key: key('cancelled'),
            level: 'important',
          });
          break;
        case 'failed':
          out.push({
            text: format(strings.failed, { message: attempt.error?.message ?? '' }),
            priority: 'assertive',
            key: key('failed'),
            level: 'important',
          });
          break;
        case 'interrupted':
          out.push({
            text: strings.interrupted,
            priority: 'polite',
            key: key('interrupted'),
            level: 'important',
          });
          break;
        case 'awaiting-input':
          out.push({
            text: strings.awaitingInput,
            priority: 'polite',
            key: key('awaiting'),
            level: 'important',
          });
          break;
      }
    }
    if (before.stop !== attempt.stop) {
      const stop = attempt.stop;
      if (stop === 'requested')
        out.push({
          text: strings.stopping,
          priority: 'polite',
          key: key('stopping'),
          level: 'all',
        });
      if (stop === 'too-late')
        out.push({
          text: strings.stopTooLate,
          priority: 'polite',
          key: key('too-late'),
          level: 'important',
        });
      if (stop === 'unknown' || stop === 'failed')
        out.push({
          text: strings.stopUnknown,
          priority: 'polite',
          key: key('stop-unknown'),
          level: 'important',
        });
    }
    if (before.connection !== attempt.connection && attempt.connection === 'disconnected')
      out.push({
        text: strings.disconnected,
        priority: 'polite',
        key: key('disconnected'),
        level: 'important',
      });
  }
  for (const approval of Object.values(next.approvals)) {
    const before = previous.approvals[approval.approvalId];
    if (before && before.revision === approval.revision && before.status === approval.status)
      continue;
    const key = `approval:${approval.approvalId}:${approval.revision}:${approval.status}`;
    const title = approval.title;
    const text =
      approval.status === 'requested'
        ? format(
            before && before.revision !== approval.revision
              ? strings.approvalSuperseded
              : strings.approvalRequested,
            { title },
          )
        : approval.status === 'approved'
          ? format(strings.approvalApproved, { title })
          : approval.status === 'rejected'
            ? format(strings.approvalRejected, { title })
            : approval.status === 'expired'
              ? format(strings.approvalExpired, { title })
              : undefined;
    if (text) out.push({ text, priority: 'polite', key, level: 'important' });
  }
  for (const tool of Object.values(next.tools)) {
    const before = previous.tools[tool.toolCallId];
    if (before && before.status !== tool.status && tool.status === 'output-error')
      out.push({
        text: format(strings.toolFailed, { tool: tool.title ?? tool.toolName }),
        priority: 'polite',
        key: `tool:${tool.toolCallId}:error`,
        level: 'all',
      });
  }
  if (previous.history === 'loading' && next.history !== 'loading' && next.history !== 'error')
    out.push({
      text: strings.historyLoaded,
      priority: 'polite',
      key: `history:${next.revision}`,
      level: 'all',
    });
  return out
    .filter((entry) => level === 'all' || entry.level === 'important')
    .map(({ text, priority, key }) => ({ text, priority, key }));
}
