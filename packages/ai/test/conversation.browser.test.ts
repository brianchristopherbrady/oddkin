import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type {
  AiEvent,
  ConversationSnapshot,
  ConversationState,
  ConversationTransport,
  EventSink,
  ExternalSource,
  MessageRecord,
} from '../src/contracts/types.js';
import { ConversationController } from '../src/controllers/conversation.js';
import { bindIntents, controllerIntents } from '../src/controllers/intents.js';
import type { OddkinConversation } from '../src/conversation/conversation.js';

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });
const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await frames(2);
  await el.updateComplete;
};

const CAPS = {
  send: { available: true },
  stop: { available: true },
  history: { available: true },
  respondToApproval: { available: true },
  approvalScopes: { available: true },
  respondToQuestion: { available: true },
  regenerate: { available: true },
  feedback: { available: true },
};

const paragraph = (i: number) =>
  `Message ${i}. ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(3)}`;
function messages(from: number, count: number, parentOf?: string): MessageRecord[] {
  const out: MessageRecord[] = [];
  let parent = parentOf;
  for (let i = from; i < from + count; i++) {
    out.push({
      id: `m${i}`,
      role: i % 2 ? 'assistant' : 'user',
      ...(parent ? { parentId: parent } : {}),
      parts: [{ type: 'text', id: `t${i}`, text: paragraph(i) }],
    });
    parent = `m${i}`;
  }
  return out;
}

function harness(history: ConversationSnapshot[] = []) {
  const sinks: EventSink[] = [];
  let resolveHistory: ((s: ConversationSnapshot) => void) | undefined;
  const transport: ConversationTransport = {
    capabilities: CAPS,
    async send(_r, sink) {
      sinks.push(sink);
    },
    stop: async () => 'cancelled',
    decide: async () => 'accepted',
    answer: async () => 'accepted',
    loadHistory: () => new Promise((resolve) => (resolveHistory = resolve)),
  };
  const controller = new ConversationController({
    transport,
    conversationId: 'c',
    onDiagnostic: () => {},
  });
  void history;
  return {
    controller,
    sink: () => sinks[sinks.length - 1] as EventSink,
    resolveHistory: (s: ConversationSnapshot) => resolveHistory?.(s),
  };
}

async function mount(controller: ExternalSource<ConversationState>) {
  await import('../src/conversation/conversation.define.js');
  const el = document.createElement('odd-conversation') as OddkinConversation;
  el.style.height = '320px';
  el.style.width = '480px';
  el.store = controller;
  container.append(el);
  await settle(el);
  const scroller = el.shadowRoot!.querySelector<HTMLElement>('[part="scroller"]')!;
  const articles = () => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="feed"] > odd-message'),
  ];
  return { el, scroller, articles };
}

const scrollTo = async (scroller: HTMLElement, top: number) => {
  scroller.scrollTop = top;
  scroller.dispatchEvent(new Event('scroll'));
  await frames(2);
};
const push = (sink: EventSink, ...events: AiEvent[]) => events.forEach((e) => sink.push(e));
const topOf = (el: HTMLElement, scroller: HTMLElement) =>
  el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;

describe('odd-conversation', () => {
  it('hands its renderers to every message, one object by extension point', async () => {
    const { controller } = harness();
    controller.load({
      conversationId: 'c',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          parts: [{ type: 'data', id: 'd', name: 'chart', data: [1] }],
        },
      ],
    });
    const { el, articles } = await mount(controller);
    const renderers = {
      data: {
        chart: {
          validate: (data: unknown) => Array.isArray(data),
          render: () => Object.assign(document.createElement('p'), { textContent: 'data:chart' }),
        },
      },
    };
    el.renderers = renderers;
    await settle(el);
    const message = articles()[0] as HTMLElementTagNameMap['odd-message'];
    await settle(message);
    expect(message.renderers).toBe(renderers);
    expect(message.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim()).toBe(
      'data:chart',
    );
  });

  it('renders an ARIA feed of labelled articles with a roving tab stop', async () => {
    const { controller } = harness();
    controller.load({ conversationId: 'c', messages: messages(0, 4) });
    const { el, articles } = await mount(controller);
    const feed = el.shadowRoot!.querySelector('[part="feed"]')!;
    expect(feed.getAttribute('role')).toBe('feed');
    expect(feed.getAttribute('aria-busy')).toBe('false');
    expect(
      articles().map((a) => [
        a.getAttribute('role'),
        a.getAttribute('aria-posinset'),
        a.getAttribute('aria-setsize'),
        a.tabIndex,
      ]),
    ).toEqual([
      ['article', '1', '4', -1],
      ['article', '2', '4', -1],
      ['article', '3', '4', -1],
      ['article', '4', '4', 0],
    ]);
    expect(articles()[1]?.getAttribute('aria-label')).toBe('Assistant, message 2 of 4');
    articles()[1]!.focus();
    articles()[1]!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'PageDown',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(articles()[2]);
  });

  it('A11: prepending history keeps the visible anchor in place', async () => {
    const { controller, resolveHistory } = harness();
    controller.load({
      conversationId: 'c',
      hasMoreHistory: true,
      messages: messages(20, 12, 'm19'),
    });
    const { el, scroller, articles } = await mount(controller);
    await scrollTo(scroller, 400);
    const anchor = articles().find(
      (a) => a.getBoundingClientRect().bottom > scroller.getBoundingClientRect().top + 1,
    )!;
    const before = topOf(anchor, scroller);
    const loading = controller.loadHistory();
    resolveHistory({ conversationId: 'c', messages: messages(0, 20), hasMoreHistory: false });
    await loading;
    await settle(el);
    expect(articles()).toHaveLength(32);
    expect(Math.abs(topOf(anchor, scroller) - before)).toBeLessThan(2);
  });

  it('A11/A12: streaming respects reading earlier content, keeps focus and committed DOM; jump resumes following', async () => {
    const { controller, sink } = harness();
    controller.load({ conversationId: 'c', messages: messages(0, 10) });
    const { el, scroller, articles } = await mount(controller);
    expect(scroller.scrollTop + scroller.clientHeight).toBeGreaterThan(scroller.scrollHeight - 4);
    await controller.send({ text: 'Stream please' });
    push(
      sink(),
      { type: 'text-start', partId: 'p' },
      { type: 'text-delta', partId: 'p', delta: 'First paragraph stays.\n\n' },
    );
    await settle(el);
    const streaming = articles().at(-1)!;
    const response = () => streaming.shadowRoot!.querySelector('odd-response')!;
    const firstParagraph = response().shadowRoot!.querySelector('[part="content"] p')!;
    // The reader scrolls up and focuses a control in an earlier message.
    await scrollTo(scroller, 200);
    const copyButton = articles()[2]!.shadowRoot!.querySelector('.footer odd-copy-button')!;
    const copy = copyButton.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
    copy.focus();
    const top = scroller.scrollTop;
    for (let i = 0; i < 30; i++)
      push(sink(), { type: 'text-delta', partId: 'p', delta: `More streamed words ${i}. ` });
    await settle(el);
    expect(scroller.scrollTop).toBe(top);
    expect(articles()[2]!.shadowRoot!.activeElement).toBe(copyButton);
    expect(copyButton.shadowRoot!.activeElement).toBe(copy);
    expect(response().shadowRoot!.querySelector('[part="content"] p')).toBe(firstParagraph);
    expect(firstParagraph.isConnected).toBe(true);
    const jump = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="jump"]')!;
    expect(jump.hidden).toBe(false);
    jump.click();
    await settle(el);
    expect(scroller.scrollTop + scroller.clientHeight).toBeGreaterThan(scroller.scrollHeight - 4);
    expect(el.shadowRoot!.activeElement).toBe(articles().at(-1));
    expect(jump.hidden).toBe(true);
    push(
      sink(),
      { type: 'text-delta', partId: 'p', delta: '\n\nFollowing again.'.repeat(5) },
      { type: 'finish' },
    );
    await settle(el);
    expect(scroller.scrollTop + scroller.clientHeight).toBeGreaterThan(scroller.scrollHeight - 4);
  });

  it('A21: announces outcomes once through one live region, never streamed text', async () => {
    const { controller, sink } = harness();
    const { el } = await mount(controller);
    const polite = el.shadowRoot!.querySelector('#polite')!;
    const seen = new Set<string>();
    const observer = new MutationObserver(() => seen.add(polite.textContent ?? ''));
    observer.observe(polite, { childList: true, characterData: true, subtree: true });
    await controller.send({ text: 'q' });
    for (let i = 0; i < 20; i++)
      push(sink(), { type: 'text-delta', partId: 'p', delta: `token${i} ` });
    await new Promise((r) => setTimeout(r, 200));
    push(sink(), { type: 'finish' });
    await new Promise((r) => setTimeout(r, 200));
    observer.disconnect();
    const all = [...seen].join(' | ');
    expect(all).toContain('Message sent.');
    expect(all).toContain('Response complete.');
    expect(all).not.toContain('token');
    expect(el.shadowRoot!.querySelectorAll('[aria-live]')).toHaveLength(2);
  });

  it('A21: a message copies with odd-copy-button, whose outcome the conversation announces', async () => {
    const { controller } = harness();
    controller.load({ conversationId: 'c', messages: messages(0, 2) });
    const { el, articles } = await mount(controller);
    const written: string[] = [];
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockImplementation(async (t) => void written.push(t));
    try {
      const copy = articles()[1]!.shadowRoot!.querySelector('.footer odd-copy-button')!;
      copy.shadowRoot!.querySelector('button')!.click();
      await expect
        .poll(() => el.shadowRoot!.querySelector('#polite')!.textContent)
        .toBe('Copied to clipboard.');
      expect(written).toEqual([paragraph(1)]);
      // The surface has one announcer: the button's own live region stays silent.
      expect(copy.shadowRoot!.querySelector('.polite')!.textContent).toBe('');
    } finally {
      clipboard.mockRestore();
    }
  });

  it('A16: intents from nested shadow roots reach the host binding; the record decides the outcome', async () => {
    const { controller, sink } = harness();
    const { el, articles } = await mount(controller);
    const release = bindIntents(el, controllerIntents(controller));
    await controller.send({ text: 'Write it' });
    push(
      sink(),
      { type: 'tool-input-start', toolCallId: 't', toolName: 'writeFile' },
      { type: 'tool-input-available', toolCallId: 't', input: { path: '/a' } },
      {
        type: 'approval-request',
        approval: {
          approvalId: 'ap',
          toolCallId: 't',
          revision: 1,
          title: 'Write /a',
          status: 'requested',
        },
      },
    );
    await settle(el);
    const activity = () =>
      el.shadowRoot!.querySelector('odd-activity')!.shadowRoot!.querySelector('.text')?.textContent;
    // The attempt waits for the person while its approval does.
    expect(activity()).toBe('Waiting for your input');
    const seen: unknown[] = [];
    document.addEventListener('odd-approval-decide', (e) => seen.push((e as CustomEvent).detail), {
      once: true,
    });
    const call = articles().at(-1)!.shadowRoot!.querySelector('odd-tool-call')!;
    const gate = () => call.shadowRoot!.querySelector('.status')?.textContent;
    // The call's own status stays; its approval words the gate.
    expect(gate()).toBe('Waiting for approval');
    const approval = call.shadowRoot!.querySelector('odd-action-approval')!;
    const approve = approval.shadowRoot!.querySelector(
      'odd-button[appearance="primary"]',
    ) as HTMLElement;
    approve.click();
    approve.click();
    expect(seen).toEqual([
      { approvalId: 'ap', revision: 1, decision: 'approve', reason: undefined },
    ]);
    await settle(el);
    expect(controller.getSnapshot().approvals['ap']?.status).toBe('approved');
    expect((approval as unknown as { approval: { status: string } }).approval.status).toBe(
      'approved',
    );
    expect(approval.shadowRoot!.querySelector('.state')?.textContent).toContain(
      'The action runs separately',
    );
    expect(activity()).toBe('Responding…');
    expect(controller.getSnapshot().tools['t']?.status).toBe('input-available');
    expect(gate()).toBe('Arguments ready; not run yet');
    release();
  });

  it('a scope chosen in a nested approval reaches the controller with the decision (ADR 0049)', async () => {
    const { controller, sink } = harness();
    const { el, articles } = await mount(controller);
    const release = bindIntents(el, controllerIntents(controller));
    await controller.send({ text: 'Write it' });
    push(sink(), {
      type: 'approval-request',
      approval: {
        approvalId: 'ap',
        revision: 1,
        title: 'Write /docs',
        status: 'requested',
        scopes: [
          { id: 'once', label: 'This change only' },
          { id: 'session', label: 'Writes to /docs this session' },
        ],
      },
    });
    await settle(el);
    const approval = articles().at(-1)!.shadowRoot!.querySelector('odd-action-approval')!;
    approval.shadowRoot!.querySelectorAll<HTMLInputElement>('input[name="scope"]')[1]!.click();
    await settle(approval);
    (approval.shadowRoot!.querySelector('odd-button[appearance="primary"]') as HTMLElement).click();
    await settle(el);
    expect(controller.getSnapshot().approvals['ap']).toMatchObject({
      status: 'approved',
      scope: 'session',
    });
    release();
  });

  it('a question in the conversation: validated and answered inside nested shadow roots, focus kept (ADR 0049)', async () => {
    const { controller, sink } = harness();
    const { el, articles } = await mount(controller);
    const release = bindIntents(el, controllerIntents(controller));
    await controller.send({ text: 'Write the notes' });
    push(sink(), {
      type: 'question-request',
      question: {
        questionId: 'q1',
        revision: 1,
        prompt: 'Which audience?',
        kind: 'choice',
        options: [
          { id: 'eng', label: 'Engineers' },
          { id: 'all', label: 'Everyone' },
        ],
        status: 'requested',
      },
    });
    await settle(el);
    const question = articles().at(-1)!.shadowRoot!.querySelector('odd-question')!;
    const inner = question.shadowRoot!;
    const submit = () => inner.querySelector('odd-button[type="submit"]') as HTMLElement;
    expect(inner.querySelector('legend')?.textContent).toBe('Which audience?');
    // Nothing chosen: the form says so and nothing is sent.
    submit().click();
    await settle(question);
    expect(inner.querySelector('.error')?.textContent).toBe('Choose an option or enter an answer.');
    expect(controller.getSnapshot().questions['q1']?.status).toBe('requested');
    inner.querySelectorAll<HTMLInputElement>('input[name="choice"]')[1]!.click();
    submit().focus();
    submit().click();
    await settle(el);
    await settle(question);
    expect(controller.getSnapshot().questions['q1']).toMatchObject({
      status: 'answered',
      answer: { choice: 'all' },
    });
    expect(inner.querySelector('.state')?.textContent?.trim()).toBe('Answered.');
    // The answer's controls went: focus moved to the question's status, not the page.
    expect(inner.activeElement).toBe(inner.querySelector('.state'));
    release();
  });

  it('A18: repeated mount and disconnect leaves no subscriptions or owned work', async () => {
    const { controller } = harness();
    controller.load({ conversationId: 'c', messages: messages(0, 3) });
    let subscribed = 0;
    const counting: ExternalSource<ConversationState> = {
      getSnapshot: () => controller.getSnapshot(),
      subscribe(listener) {
        subscribed++;
        const off = controller.subscribe(listener);
        return () => {
          subscribed--;
          off();
        };
      },
    };
    const { el } = await mount(counting);
    expect(subscribed).toBe(1);
    el.remove();
    flush();
    await frames(1);
    const baseline = { ...scopeStats() };
    for (let i = 0; i < 10; i++) {
      container.append(el);
      await settle(el);
      expect(subscribed).toBe(1);
      el.remove();
      flush();
      await frames(1);
      expect(subscribed).toBe(0);
    }
    expect(scopeStats()).toEqual(baseline);
  });

  it('shows the run status separately from the connection and offers only supported actions', async () => {
    const { controller, sink } = harness();
    const { el } = await mount(controller);
    await controller.send({ text: 'q' });
    push(sink(), { type: 'text-delta', partId: 'p', delta: 'partial' });
    controller.disconnect();
    await settle(el);
    const activity = el.shadowRoot!.querySelector('odd-activity')!;
    expect(activity.hidden).toBe(false);
    expect(activity.shadowRoot!.querySelector('.text')?.textContent).toContain(
      'may still be generating',
    );
    const actions = [...activity.shadowRoot!.querySelectorAll('button')].map((b) => b.textContent);
    expect(actions).toEqual(['Stop']);
    el.state = undefined;
  });
});
