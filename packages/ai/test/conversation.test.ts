import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AiEvent,
  ConversationState,
  ConversationTransport,
  EventSink,
} from '../src/contracts/types.js';
import { ConversationController } from '../src/controllers/conversation.js';
import { describeConversationChange } from '../src/controllers/announcer.js';
import {
  createSimulatedTransport,
  streamTextSteps,
  type ScriptStep,
} from '../src/stream/simulation.js';

const ALL = {
  send: { available: true },
  stop: { available: true },
  resume: { available: true },
  retry: { available: true },
  regenerate: { available: true },
  edit: { available: true },
  switchBranch: { available: true },
  respondToApproval: { available: true },
  history: { available: true },
};

/** A manual transport: the test pushes events into the sink it captured. */
function manual(options: Partial<ConversationTransport> = {}) {
  const sinks: EventSink[] = [];
  const transport: ConversationTransport = {
    capabilities: ALL,
    async send(_request, sink) {
      sinks.push(sink);
    },
    ...options,
  };
  return { transport, sinks, sink: () => sinks[sinks.length - 1] as EventSink };
}

const textOf = (state: ConversationState, index = 1) =>
  state.messages[index]?.parts
    .filter((p) => p.type === 'text')
    .map((p) => ('text' in p ? p.text : ''))
    .join('');
const attempt = (c: ConversationController) => {
  const s = c.getSnapshot();
  return s.attempts[s.activeAttemptId as string];
};
const push = (sink: EventSink, ...events: AiEvent[]) => events.forEach((e) => sink.push(e));

describe('ConversationController: submission', () => {
  it('distinguishes submitted from accepted, and streaming from completed', async () => {
    const { transport, sink } = manual();
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    const sending = c.send({ text: 'Hello' });
    expect(attempt(c)?.status).toBe('submitted');
    await sending;
    expect(attempt(c)?.status).toBe('accepted');
    push(
      sink(),
      { type: 'text-start', partId: 'p' },
      { type: 'text-delta', partId: 'p', delta: 'Hi' },
    );
    expect(attempt(c)).toMatchObject({ status: 'streaming', connection: 'open' });
    push(sink(), { type: 'finish' });
    expect(attempt(c)?.status).toBe('completed');
    expect(c.getSnapshot().messages[1]?.parts[0]).toMatchObject({ state: 'done', text: 'Hi' });
  });

  it('A02: a request that is never accepted leaves no optimistic copies', async () => {
    const c = new ConversationController({
      transport: {
        capabilities: ALL,
        send: async () => Promise.reject({ code: 'quota', message: 'Quota reached.' }),
      },
      onDiagnostic: () => {},
    });
    const result = await c.send({ text: 'Hello' });
    expect(result).toEqual({
      ok: false,
      reason: 'rejected',
      error: { code: 'quota', message: 'Quota reached.' },
    });
    expect(c.getSnapshot().messages).toEqual([]);
    expect(c.getSnapshot().attempts).toEqual({});
  });

  it('refuses unavailable, empty, and concurrent sends', async () => {
    const { transport } = manual();
    const c = new ConversationController({
      transport,
      capabilities: { send: { available: false, reason: 'Read only' } },
    });
    expect(await c.send({ text: 'x' })).toEqual({ ok: false, reason: 'unavailable' });
    expect(c.getSnapshot().capabilities.send).toEqual({ available: false, reason: 'Read only' });
    const d = new ConversationController({ transport: manual().transport });
    expect(await d.send({ text: '  ' })).toEqual({ ok: false, reason: 'invalid' });
    await d.send({ text: 'one' });
    expect(await d.send({ text: 'two' })).toEqual({ ok: false, reason: 'busy' });
  });
});

describe('ConversationController: routing, identity, and isolation', () => {
  it('A04: drops only events with replayed ids or offsets; repeated text stays', async () => {
    const { transport, sink } = manual();
    const diagnostics: string[] = [];
    const c = new ConversationController({
      transport,
      onDiagnostic: (d) => diagnostics.push(d.code),
    });
    await c.send({ text: 'q' });
    push(
      sink(),
      { type: 'text-delta', partId: 'p', delta: 'ha ', seq: 1 },
      { type: 'text-delta', partId: 'p', delta: 'ha ', seq: 2 },
      { type: 'text-delta', partId: 'p', delta: 'ha ', seq: 2 },
      { type: 'text-delta', partId: 'p', delta: 'ha ', seq: 1 },
      { type: 'text-delta', partId: 'p', delta: 'ho', eventId: 'e1' },
      { type: 'text-delta', partId: 'p', delta: 'ho', eventId: 'e1' },
      { type: 'text-delta', partId: 'p', delta: 'ho' },
    );
    expect(textOf(c.getSnapshot())).toBe('ha ha hoho');
    expect(diagnostics.filter((d) => d === 'ai.event.duplicate')).toHaveLength(3);
  });

  it('A05: loading another conversation isolates late events and pending decisions', async () => {
    const { transport, sinks } = manual({ decide: () => new Promise(() => {}) });
    const diagnostics: string[] = [];
    const c = new ConversationController({
      transport,
      conversationId: 'a',
      onDiagnostic: (d) => diagnostics.push(d.code),
    });
    await c.send({ text: 'q' });
    const old = sinks[0] as EventSink;
    push(old, {
      type: 'approval-request',
      approval: { approvalId: 'ap', revision: 1, title: 'Run', status: 'requested' },
    });
    void c.decide('ap', 1, 'approve');
    c.load({
      conversationId: 'b',
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', id: 't', text: 'other' }] }],
    });
    expect(old.active).toBe(false);
    push(old, { type: 'text-delta', partId: 'p', delta: 'late' }, { type: 'finish' });
    const state = c.getSnapshot();
    expect(state.conversationId).toBe('b');
    expect(state.messages.map((m) => m.id)).toEqual(['m1']);
    expect(state.approvals).toEqual({});
    expect(diagnostics).toContain('ai.event.stale');
  });

  it('reconciles a snapshot only for the attempt message and drops content after the end', async () => {
    const { transport, sink } = manual();
    const diagnostics: string[] = [];
    const c = new ConversationController({
      transport,
      onDiagnostic: (d) => diagnostics.push(d.code),
    });
    await c.send({ text: 'q' });
    const messageId = attempt(c)?.messageId as string;
    push(sink(), { type: 'snapshot', message: { id: 'elsewhere', role: 'assistant', parts: [] } });
    expect(diagnostics).toContain('ai.snapshot.scope');
    push(sink(), {
      type: 'snapshot',
      message: {
        id: messageId,
        role: 'assistant',
        parts: [{ type: 'text', id: 'x', text: 'Final' }],
      },
    });
    push(sink(), { type: 'finish' }, { type: 'text-delta', partId: 'x', delta: ' late' });
    expect(textOf(c.getSnapshot())).toBe('Final');
    expect(diagnostics).toContain('ai.event.afterTerminal');
  });

  it('A15: unknown parts become explicit unsupported parts; provider metadata stays out of content', async () => {
    const { transport, sink } = manual();
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(
      sink(),
      { type: 'part', part: { type: 'hologram', id: 'h' } as never },
      {
        type: 'part',
        part: { type: 'source', id: 's', sourceId: 'x', url: 'javascript:alert(1)' },
      },
      { type: 'metadata', data: { provider: 'secret' } },
    );
    const parts = c.getSnapshot().messages[1]?.parts;
    expect(parts).toEqual([
      { type: 'unsupported', id: 'h', originalType: 'hologram' },
      { type: 'unsupported', id: 's', originalType: 'source' },
    ]);
    expect(JSON.stringify(c.getSnapshot())).not.toContain('secret');
  });
});

describe('ConversationController: stop, disconnect, resume', () => {
  it('A07: stop stays pending until confirmed and keeps partial output', async () => {
    let resolveStop!: (v: 'cancelled') => void;
    const { transport, sink } = manual({ stop: () => new Promise((r) => (resolveStop = r)) });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), { type: 'text-delta', partId: 'p', delta: 'partial' });
    const stopping = c.stop();
    expect(attempt(c)).toMatchObject({ status: 'streaming', stop: 'requested' });
    expect(await c.stop()).toEqual({ ok: false, reason: 'duplicate' });
    resolveStop('cancelled');
    await stopping;
    expect(attempt(c)).toMatchObject({ status: 'cancelled', stop: 'confirmed' });
    expect(textOf(c.getSnapshot())).toBe('partial');
    // The confirmation ends the stream (whose own end, arriving later, is dropped): the partial
    // text no longer reads as still being written.
    expect(c.getSnapshot().messages[1]?.parts[0]).toMatchObject({ state: 'done' });
    push(sink(), { type: 'abort' });
    expect(c.getSnapshot().messages[1]?.parts[0]).toMatchObject({ state: 'done' });
  });

  it('A07: completion racing a stop yields completed + too-late, never cancelled', async () => {
    let resolveStop!: (v: 'cancelled' | 'already-finished') => void;
    const { transport, sink } = manual({ stop: () => new Promise((r) => (resolveStop = r)) });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    const stopping = c.stop();
    push(
      sink(),
      { type: 'tool-input-start', toolCallId: 't1', toolName: 'search' },
      { type: 'text-delta', partId: 'p', delta: 'done' },
      { type: 'finish' },
    );
    expect(attempt(c)).toMatchObject({ status: 'completed', stop: 'too-late' });
    const before = c.getSnapshot();
    resolveStop('cancelled');
    await stopping;
    expect(attempt(c)).toMatchObject({ status: 'completed', stop: 'too-late' });
    // A stop confirmed too late changes nothing the stream produced.
    expect(c.getSnapshot().tools).toEqual(before.tools);
    expect(c.getSnapshot().messages).toEqual(before.messages);
  });

  it('A07: an unconfirmable or failed stop reports unknown/failed, and a stale response is ignored', async () => {
    const outcomes: Array<(v: 'unknown' | 'cancelled') => void> = [];
    const { transport } = manual({ stop: () => new Promise((r) => outcomes.push(r)) });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    const first = c.stop();
    (outcomes[0] as (v: 'unknown') => void)('unknown');
    await first;
    expect(attempt(c)).toMatchObject({ status: 'accepted', stop: 'unknown' });
    const failing = new ConversationController({
      transport: { ...manual().transport, stop: async () => Promise.reject(new Error('net')) },
      onDiagnostic: () => {},
    });
    await failing.send({ text: 'q' });
    await failing.stop();
    expect(attempt(failing)?.stop).toBe('failed');
    // A response for a conversation that was replaced meanwhile is ignored.
    const second = c.stop();
    c.reset('other');
    (outcomes[1] as (v: 'cancelled') => void)('cancelled');
    expect(await second).toEqual({ ok: false, reason: 'stale' });
  });

  it('A06: disconnect is not cancellation; resume reattaches without a new attempt', async () => {
    vi.useFakeTimers();
    try {
      const transport = createSimulatedTransport({
        script: () => [
          ...streamTextSteps('p', 'one two three four five six', 10, 4),
          { after: 10, event: { type: 'finish' } },
        ],
        controls: { acceptDelay: 5, replayOverlap: 3 },
      });
      const c = new ConversationController({ transport, onDiagnostic: () => {} });
      const sending = c.send({ text: 'q' });
      await vi.advanceTimersByTimeAsync(5);
      await sending;
      await vi.advanceTimersByTimeAsync(25);
      c.disconnect();
      expect(attempt(c)).toMatchObject({
        status: 'streaming',
        connection: 'disconnected',
        stop: 'none',
      });
      await vi.advanceTimersByTimeAsync(200); // the server keeps producing meanwhile
      expect(attempt(c)?.status).toBe('streaming');
      const resuming = c.resume();
      await vi.advanceTimersByTimeAsync(5);
      await resuming;
      await vi.advanceTimersByTimeAsync(200);
      const state = c.getSnapshot();
      expect(Object.keys(state.attempts)).toHaveLength(1);
      expect(attempt(c)).toMatchObject({ status: 'completed', connection: 'closed' });
      expect(textOf(state)).toBe('one two three four five six');
      expect(transport.pendingTimers).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a stream that ends without a terminal event is interrupted, not completed', async () => {
    const { transport, sink } = manual();
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), { type: 'text-delta', partId: 'p', delta: 'x' });
    sink().close();
    expect(attempt(c)).toMatchObject({ status: 'interrupted', connection: 'closed' });
  });
});

describe('ConversationController: tools and approvals', () => {
  it('A08/A09: complete arguments are not success; tools and approvals stay independent', async () => {
    const decisions: string[] = [];
    let resolveDecision!: (v: 'accepted') => void;
    const { transport, sink } = manual({
      decide: (d) => {
        decisions.push(`${d.approvalId}:${d.revision}:${d.decision}`);
        return new Promise((r) => (resolveDecision = r));
      },
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(
      sink(),
      { type: 'tool-input-start', toolCallId: 'a', toolName: 'search' },
      { type: 'tool-input-delta', toolCallId: 'a', delta: '{"q":' },
      { type: 'tool-input-start', toolCallId: 'b', toolName: 'write' },
      { type: 'tool-input-delta', toolCallId: 'a', delta: '"x"}' },
      { type: 'tool-input-available', toolCallId: 'a', input: { q: 'x' } },
      { type: 'tool-input-available', toolCallId: 'b', input: { path: '/x' } },
      {
        type: 'approval-request',
        approval: {
          approvalId: 'ap',
          toolCallId: 'b',
          revision: 1,
          title: 'Write /x',
          status: 'requested',
        },
      },
    );
    let s = c.getSnapshot();
    expect(s.tools['a']).toMatchObject({ status: 'input-available', inputText: '{"q":"x"}' });
    expect(s.tools['b']).toMatchObject({ status: 'awaiting-approval', approvalId: 'ap' });
    // A10: double activation sends one decision.
    const first = c.decide('ap', 1, 'approve');
    expect(await c.decide('ap', 1, 'approve')).toEqual({ ok: false, reason: 'duplicate' });
    expect(c.getSnapshot().approvals['ap']?.status).toBe('decision-pending');
    resolveDecision('accepted');
    await first;
    expect(decisions).toEqual(['ap:1:approve']);
    s = c.getSnapshot();
    expect(s.approvals['ap']?.status).toBe('approved');
    // Approval is not execution: the tool is still waiting until its own events arrive.
    expect(s.tools['b']?.status).toBe('awaiting-approval');
    push(
      sink(),
      { type: 'tool-executing', toolCallId: 'b' },
      { type: 'tool-error', toolCallId: 'b', error: { code: 'e', message: 'Disk full' } },
    );
    push(
      sink(),
      { type: 'tool-executing', toolCallId: 'a' },
      { type: 'tool-output', toolCallId: 'a', output: [1] },
    );
    s = c.getSnapshot();
    expect(s.tools['a']?.status).toBe('output-available');
    expect(s.tools['b']?.status).toBe('output-error');
    expect(s.approvals['ap']?.status).toBe('approved');
  });

  it('A10: a changed proposal supersedes the old revision; stale and expired decisions are refused', async () => {
    const decided: number[] = [];
    const { transport, sink } = manual({
      decide: async (d) => (decided.push(d.revision), 'accepted'),
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), {
      type: 'approval-request',
      approval: { approvalId: 'ap', revision: 1, title: 'Pay $10', status: 'requested' },
    });
    push(sink(), {
      type: 'approval-request',
      approval: { approvalId: 'ap', revision: 2, title: 'Pay $12', status: 'requested' },
    });
    expect(await c.decide('ap', 1, 'approve')).toEqual({ ok: false, reason: 'stale' });
    push(sink(), {
      type: 'approval-request',
      approval: { approvalId: 'ap', revision: 1, title: 'old', status: 'requested' },
    });
    expect(c.getSnapshot().approvals['ap']?.title).toBe('Pay $12');
    push(sink(), {
      type: 'approval-request',
      approval: {
        approvalId: 'old',
        revision: 1,
        title: 'Expired',
        status: 'requested',
        expiresAt: '2000-01-01T00:00:00Z',
      },
    });
    expect(await c.decide('old', 1, 'approve')).toEqual({ ok: false, reason: 'stale' });
    expect(c.getSnapshot().approvals['old']?.status).toBe('expired');
    expect(decided).toEqual([]);
    expect(await c.decide('ap', 2, 'reject', 'too much')).toEqual({ ok: true });
    expect(c.getSnapshot().approvals['ap']).toMatchObject({
      status: 'rejected',
      reason: 'too much',
    });
  });

  it('a failed decision can be retried', async () => {
    let fail = true;
    const { transport, sink } = manual({
      decide: async () => (fail ? Promise.reject(new Error('x')) : 'accepted'),
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), {
      type: 'approval-request',
      approval: { approvalId: 'ap', revision: 1, title: 'Go', status: 'requested' },
    });
    await c.decide('ap', 1, 'approve');
    expect(c.getSnapshot().approvals['ap']?.status).toBe('decision-failed');
    fail = false;
    await c.decide('ap', 1, 'approve');
    expect(c.getSnapshot().approvals['ap']?.status).toBe('approved');
  });
});

describe('ConversationController: branches and history', () => {
  it('A17: regenerate and edit add branches; switching preserves every version', async () => {
    const { transport, sinks } = manual();
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'Question' });
    push(
      sinks[0] as EventSink,
      { type: 'text-delta', partId: 'a', delta: 'First answer' },
      { type: 'finish' },
    );
    const firstAnswer = c.getSnapshot().messages[1]?.id as string;
    await c.regenerate(firstAnswer);
    push(
      sinks[1] as EventSink,
      { type: 'text-delta', partId: 'b', delta: 'Second answer' },
      { type: 'finish' },
    );
    let s = c.getSnapshot();
    expect(textOf(s)).toBe('Second answer');
    expect(s.branches[s.messages[1]?.id as string]).toMatchObject({
      index: 2,
      count: 2,
      previousId: firstAnswer,
    });
    c.switchBranch(firstAnswer);
    expect(textOf(c.getSnapshot())).toBe('First answer');
    const question = c.getSnapshot().messages[0]?.id as string;
    await c.edit(question, 'Edited question');
    push(
      sinks[2] as EventSink,
      { type: 'text-delta', partId: 'c', delta: 'Answer to edit' },
      { type: 'finish' },
    );
    s = c.getSnapshot();
    expect(textOf(s, 0)).toBe('Edited question');
    expect(s.branches[s.messages[0]?.id as string]).toMatchObject({ index: 2, count: 2 });
    c.switchBranch(question);
    expect(textOf(c.getSnapshot())).toBe('First answer');
    expect(Object.values(c.getSnapshot().attempts).map((a) => a.relation)).toEqual([
      'new',
      'regenerate',
      'edit',
    ]);
  });

  it('prepends history pages without moving the active branch', async () => {
    vi.useFakeTimers();
    try {
      const transport = createSimulatedTransport({
        script: () => [],
        controls: { historyDelay: 10 },
        history: [{ conversationId: 'c', messages: [{ id: 'old', role: 'user', parts: [] }] }],
      });
      const c = new ConversationController({
        transport,
        conversationId: 'c',
        onDiagnostic: () => {},
      });
      c.load({
        conversationId: 'c',
        hasMoreHistory: true,
        messages: [{ id: 'new', role: 'user', parentId: 'old', parts: [] }],
      });
      const loading = c.loadHistory();
      expect(c.getSnapshot().history).toBe('loading');
      await vi.advanceTimersByTimeAsync(10);
      await loading;
      expect(c.getSnapshot().messages.map((m) => m.id)).toEqual(['old', 'new']);
      expect(c.getSnapshot().history).toBe('complete');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('announcement policy', () => {
  it('A21: announces outcomes once, never streamed text', async () => {
    const { transport, sink } = manual();
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    const announced: string[] = [];
    let previous = c.getSnapshot();
    c.subscribe(() => {
      const next = c.getSnapshot();
      announced.push(...describeConversationChange(previous, next, 'all').map((a) => a.text));
      previous = next;
    });
    await c.send({ text: 'q' });
    for (let i = 0; i < 50; i++) push(sink(), { type: 'text-delta', partId: 'p', delta: `w${i} ` });
    push(sink(), { type: 'finish' });
    expect(announced).toEqual(['Message sent.', 'Assistant is responding.', 'Response complete.']);
  });
});

describe('simulation transport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pauses at an approval and continues on the decided branch', async () => {
    const approve: ScriptStep[] = [
      { after: 5, event: { type: 'tool-executing', toolCallId: 't' } },
      { after: 5, event: { type: 'tool-output', toolCallId: 't', output: 'ok' } },
      { after: 5, event: { type: 'finish' } },
    ];
    const transport = createSimulatedTransport({
      script: () => [
        { after: 5, event: { type: 'tool-input-start', toolCallId: 't', toolName: 'pay' } },
        { after: 5, event: { type: 'tool-input-available', toolCallId: 't', input: {} } },
        {
          after: 5,
          event: {
            type: 'approval-request',
            approval: {
              approvalId: 'ap',
              toolCallId: 't',
              revision: 1,
              title: 'Pay',
              status: 'requested',
            },
          },
        },
        {
          after: 5,
          awaitDecision: 'ap',
          approve,
          reject: [{ after: 5, event: { type: 'tool-denied', toolCallId: 't' } }],
        },
      ],
      controls: { acceptDelay: 0, decisionDelay: 10 },
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    const sending = c.send({ text: 'pay' });
    await vi.advanceTimersByTimeAsync(30);
    await sending;
    expect(c.getSnapshot().tools['t']?.status).toBe('awaiting-approval');
    const deciding = c.decide('ap', 1, 'approve');
    await vi.advanceTimersByTimeAsync(10);
    await deciding;
    await vi.advanceTimersByTimeAsync(20);
    expect(c.getSnapshot().tools['t']?.status).toBe('output-available');
    expect(attempt(c)?.status).toBe('completed');
    expect(transport.pendingTimers).toBe(0);
  });
});
