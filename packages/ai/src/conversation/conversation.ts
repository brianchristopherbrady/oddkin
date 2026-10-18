import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { ArtifactRenderer } from '../artifact/artifact.js';
import { can } from '../contracts/normalize.js';
import type { ConversationState, ExternalSource, ToolCallRecord } from '../contracts/types.js';
import {
  DEFAULT_ANNOUNCEMENTS,
  describeConversationChange,
  type AnnouncementStrings,
} from '../controllers/announcer.js';
import { isActive } from '../controllers/transitions.js';
import { historyRequestEvent } from '../events.js';
import { LiveAnnouncer, routeAnnouncements } from '../internal/announce.js';
import { format, strings } from '../internal/strings.js';
import type { MarkdownOptions } from '../markdown/render.js';
import type { DataRenderer } from '../message/message.js';
import type { ToolOutputRenderer } from '../tool-call/tool-call.js';

export const CONVERSATION_STRINGS = {
  label: 'Conversation',
  empty: 'No messages yet.',
  loadEarlier: 'Load earlier messages',
  loading: 'Loading earlier messages…',
  historyError: 'Earlier messages could not be loaded.',
  retry: 'Try again',
  jump: 'Jump to latest',
  jumpNew: 'Jump to latest ({count} new)',
  messageLabel: '{role}, message {index} of {count}',
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
};

/** A saved reading position: the message at the top of the viewport and its offset. */
export interface ScrollPosition {
  readonly messageId: string;
  readonly offset: number;
  readonly following: boolean;
}

const FOLLOW_THRESHOLD = 48;

/**
 * A conversation surface: messages as an ARIA feed, history loading, a follow-latest scrolling
 * policy that respects reading earlier content, a visible-anchor guarantee when history is
 * prepended or content above changes size, an explicit "Jump to latest", the run status bar,
 * one announcer for the whole surface, and a slot for the composer. Reads state from one
 * authoritative source (`source` or `state`); keeps only presentation state.
 *
 * @slot composer - The prompt input.
 * @slot empty - Content shown when there are no messages.
 * @slot status - Extra status content (usage, model) above the composer.
 * @csspart scroller - The scroll container.
 * @csspart feed - The feed of messages.
 * @csspart jump - The "Jump to latest" button.
 * @csspart activity - The run status bar.
 * @cssprop --odd-conversation-max-width - Maximum line length of the feed.
 * @a11y Messages are `article`s in a `feed` with position and size; `aria-busy` is set while history loads or a response streams. One polite and one assertive live region announce meaningful changes only (sent, responding, complete, stopped, failed, approval needed), never streamed text. Arriving content never moves focus.
 * @keyboard Page Down / Page Up move between messages; Ctrl+Home / Ctrl+End leave the feed toward its start or the composer; "Jump to latest" moves focus to the newest message.
 * @useFor Chat and assistant conversations, including tool use, approvals, artifacts, and branches.
 * @notFor Activity logs without messages; use `odd-task-plan` or `odd-activity`.
 * @limitation All messages stay in the DOM (no virtualization) so find-in-page, selection, and assistive technology reading keep working; see the performance fixture for measured limits.
 * @category AI
 */
export class OddkinConversation extends OddkinElement.with({
  source: prop.object<ExternalSource<ConversationState>>({
    description: 'Authoritative source (a controller or an external store).',
  }),
  state: prop.object<ConversationState>({
    description: 'Controlled snapshot, used when no `source` is set.',
  }),
  label: prop.string({ default: '', description: 'Accessible name of the feed.' }),
  announcements: prop.enum(['important', 'all', 'none'], {
    default: 'important',
    description: 'How much the surface announces.',
  }),
  markdown: prop.object<MarkdownOptions>({ description: 'Markdown options for every message.' }),
  renderers: prop.object<Readonly<Record<string, DataRenderer>>>({
    description: 'Validated renderers for `data` parts.',
  }),
  artifactRenderers: prop.object<Readonly<Record<string, ArtifactRenderer>>>({
    description: 'Artifact renderers by kind.',
  }),
  toolRenderer: prop.object<{ render: ToolOutputRenderer }>({
    description: 'Renderer for tool results.',
  }),
  feedbackReasons: prop.array<string>({ description: 'Reasons offered for negative feedback.' }),
  strings: prop.object<Partial<typeof CONVERSATION_STRINGS & AnnouncementStrings>>({
    description: 'Localized string overrides (including announcements).',
  }),
}) {
  static override events = { 'history-request': historyRequestEvent };

  /** @internal Snapshot read from `source` (mirrors it; never edited). */
  readonly _snapshot = signal<ConversationState | undefined>(undefined);
  /** @internal Follow-latest policy (presentation state). */
  readonly _following = signal(true);
  /** @internal Messages added while reading earlier content. */
  readonly _unseen = signal(0);
  /** @internal Roving tab stop among articles. */
  readonly _current = signal<string | undefined>(undefined);

  #anchor: { id: string; offset: number } | undefined;
  #programmatic = false;
  #positions = new Map<string, ScrollPosition>();

  /** @internal */
  get _strings(): typeof CONVERSATION_STRINGS {
    return strings(CONVERSATION_STRINGS, this.strings as Partial<Record<string, string>>);
  }

  /** The snapshot being rendered. */
  get current(): ConversationState | undefined {
    return this.source ? this._snapshot.value : this.state;
  }

  /** @internal Tools of the active attempt (for the status bar). */
  _activeTools(state: ConversationState): ToolCallRecord[] {
    const id = state.activeAttemptId;
    return id ? Object.values(state.tools).filter((t) => t.attemptId === id) : [];
  }

  /** @internal */
  _busy(state: ConversationState | undefined): boolean {
    if (!state) return false;
    const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
    return state.history === 'loading' || (!!attempt && isActive(attempt.status));
  }

  /** @internal */
  _messageLabel(role: string, index: number, count: number): string {
    const t = this._strings;
    return format(t.messageLabel, { role: t[role as 'user'] ?? role, index, count });
  }

  /** @internal */
  readonly _requestHistory = (): void => {
    const state = this.current;
    if (!state || state.history === 'loading' || !can(state.capabilities, 'history')) return;
    this.emit(historyRequestEvent, {
      conversationId: state.conversationId,
      beforeMessageId: state.messages[0]?.id,
    });
  };

  /** Resume following the latest content and move focus to the newest message. */
  jumpToLatest(focus = true): void {
    this._following.value = true;
    this._unseen.value = 0;
    this.#scrollToEnd();
    if (focus) {
      const last = [...this.#articles()].pop();
      if (last) {
        this._current.value = last.dataset['id'];
        last.focus({ preventScroll: true });
      }
    }
  }
  /** @internal */
  readonly _jump = (): void => this.jumpToLatest(true);

  /** The current reading position (to restore later, e.g. per conversation or branch). */
  getScrollPosition(): ScrollPosition | undefined {
    const scroller = this.#scroller();
    if (!scroller) return undefined;
    const anchor = this.#findAnchor(scroller);
    return anchor
      ? { messageId: anchor.id, offset: anchor.offset, following: this._following.peek() }
      : undefined;
  }

  /** Restore a position from `getScrollPosition()`. Unknown messages fall back to the latest. */
  restoreScrollPosition(position: ScrollPosition | undefined): void {
    const scroller = this.#scroller();
    if (!scroller) return;
    if (!position || position.following) return this.jumpToLatest(false);
    const article = this.#article(position.messageId);
    if (!article) return this.jumpToLatest(false);
    this._following.value = false;
    this.#anchor = { id: position.messageId, offset: position.offset };
    this.#restoreAnchor(scroller);
  }

  // ---- Lifecycle ----

  protected override connected(scope: Scope): void {
    scope.effect(
      (run) => {
        const source = this.source;
        if (!source) {
          this._snapshot.value = undefined;
          return;
        }
        this._snapshot.value = source.getSnapshot();
        const unsubscribe = source.subscribe(() => {
          this._snapshot.value = source.getSnapshot();
        });
        run.add(unsubscribe, 'conversation source');
      },
      { name: '<odd-conversation> source' },
    );
  }

  protected override mounted(scope: Scope): void {
    const root = this.shadowRoot;
    const scroller = this.#scroller();
    const feed = root?.querySelector<HTMLElement>('[part="feed"]');
    const polite = root?.querySelector<HTMLElement>('#polite');
    const assertive = root?.querySelector<HTMLElement>('#assertive');
    if (!root || !scroller || !feed || !polite || !assertive) return;

    // One announcer per surface; descendants' `ai-announce` events are routed to it.
    const announcer = new LiveAnnouncer(polite, assertive);
    scope.add(() => announcer.dispose(), 'announcer');
    scope.add(routeAnnouncements(this, announcer), 'announcement routing');

    let previous: ConversationState | undefined;
    let previousIds: readonly string[] = [];
    scope.effect(
      () => {
        const state = this.current;
        const level = this.announcements;
        const t = {
          ...DEFAULT_ANNOUNCEMENTS,
          ...(this.strings as Partial<AnnouncementStrings> | undefined),
        };
        if (state && previous && previous.conversationId !== state.conversationId) {
          // Presentation state per conversation: save the old position, restore the new one.
          const position = this.getScrollPosition();
          if (position) this.#positions.set(previous.conversationId, position);
          announcer.reset();
          previousIds = [];
          queueMicrotask(() =>
            this.restoreScrollPosition(this.#positions.get(state.conversationId)),
          );
        }
        if (state)
          for (const detail of describeConversationChange(previous, state, level, t))
            announcer.announce(detail);
        const ids = state?.messages.map((m) => m.id) ?? [];
        const grew = ids.length - previousIds.length;
        // Only appended messages count as unseen (a prepended history page does not).
        if (!this._following.peek() && grew > 0 && previousIds.length && ids[0] === previousIds[0])
          this._unseen.value = this._unseen.peek() + grew;
        previous = state;
        previousIds = ids;
      },
      { phase: 'post', name: '<odd-conversation> announcements' },
    );

    // Follow policy: the user scrolling away stops following; returning near the end resumes.
    scope.listen(
      scroller,
      'scroll',
      () => {
        if (this.#programmatic) return;
        const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        const following = distance <= FOLLOW_THRESHOLD;
        if (following !== this._following.peek()) this._following.value = following;
        if (following) this._unseen.value = 0;
        this.#anchor = following ? undefined : this.#findAnchor(scroller);
      },
      { passive: true },
    );

    // Late layout (streaming text, images, fonts, prepended history): keep the latest content in
    // view when following, otherwise keep the reading anchor where it was. The correction is
    // measured from current geometry, so it is a no-op wherever native scroll anchoring already
    // kept the anchor in place (never a second adjustment), and it covers engines without it.
    const observer = new ResizeObserver(() => {
      if (this._following.peek()) this.#scrollToEnd();
      else this.#restoreAnchor(scroller);
    });
    observer.observe(feed);
    scope.add(() => observer.disconnect(), 'resize observer');

    scope.listen(feed, 'keydown', (event: KeyboardEvent) => this.#onFeedKey(event));
    scope.listen(feed, 'focusin', (event: FocusEvent) => {
      const article = (event.composedPath() as Element[]).find(
        (el) => el instanceof HTMLElement && el.dataset?.['id'] && el.parentElement === feed,
      );
      if (article) this._current.value = (article as HTMLElement).dataset['id'];
    });
    queueMicrotask(() => this.#scrollToEnd());
  }

  // ---- Scrolling ----

  #scroller(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part="scroller"]');
  }

  #articles(): HTMLElement[] {
    return [
      ...(this.shadowRoot?.querySelectorAll<HTMLElement>('[part="feed"] > odd-message') ?? []),
    ];
  }

  #article(id: string): HTMLElement | undefined {
    return this.#articles().find((a) => a.dataset['id'] === id);
  }

  #findAnchor(scroller: HTMLElement): { id: string; offset: number } | undefined {
    const top = scroller.getBoundingClientRect().top;
    for (const article of this.#articles()) {
      const rect = article.getBoundingClientRect();
      if (rect.bottom > top + 1)
        return { id: article.dataset['id'] as string, offset: rect.top - top };
    }
    return undefined;
  }

  #restoreAnchor(scroller: HTMLElement): void {
    const anchor = this.#anchor;
    const article = anchor ? this.#article(anchor.id) : undefined;
    if (!anchor || !article) return;
    const delta =
      article.getBoundingClientRect().top - scroller.getBoundingClientRect().top - anchor.offset;
    if (Math.abs(delta) < 0.5) return;
    this.#setScrollTop(scroller, scroller.scrollTop + delta);
  }

  #scrollToEnd(): void {
    const scroller = this.#scroller();
    if (scroller) this.#setScrollTop(scroller, scroller.scrollHeight);
  }

  #setScrollTop(scroller: HTMLElement, top: number): void {
    this.#programmatic = true;
    scroller.scrollTop = top;
    // Scroll events from this write are dispatched before the next frame.
    requestAnimationFrame(() => (this.#programmatic = false));
  }

  // ---- Feed keyboard (WAI-ARIA feed pattern) ----

  #onFeedKey(event: KeyboardEvent): void {
    const articles = this.#articles();
    if (!articles.length) return;
    const index = articles.findIndex((a) => a.dataset['id'] === this._current.peek());
    let target: HTMLElement | undefined;
    if (event.key === 'PageDown') target = articles[Math.min(articles.length - 1, index + 1)];
    else if (event.key === 'PageUp') target = articles[Math.max(0, index - 1)];
    else if (event.key === 'End' && event.ctrlKey) {
      event.preventDefault();
      const composer = this.querySelector<HTMLElement>('[slot="composer"]');
      composer?.focus();
      return;
    } else if (event.key === 'Home' && event.ctrlKey) {
      event.preventDefault();
      this.shadowRoot?.querySelector<HTMLElement>('.history button:not([hidden])')?.focus() ??
        this.#scroller()?.focus();
      return;
    } else return;
    event.preventDefault();
    if (!target) return;
    this._current.value = target.dataset['id'];
    target.focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-conversation': OddkinConversation;
  }
}
