import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AiEvent,
  ApprovalDecision,
  ApprovalRecord,
  Capabilities,
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
    // The approval states the gate: the call keeps its own status and links it.
    expect(s.tools['b']).toMatchObject({ status: 'input-available', approvalId: 'ap' });
    // A10: double activation sends one decision.
    const first = c.decide('ap', 1, 'approve');
    expect(await c.decide('ap', 1, 'approve')).toEqual({ ok: false, reason: 'duplicate' });
    expect(c.getSnapshot().approvals['ap']?.status).toBe('submitting');
    resolveDecision('accepted');
    await first;
    expect(decisions).toEqual(['ap:1:approve']);
    s = c.getSnapshot();
    expect(s.approvals['ap']?.status).toBe('approved');
    // Approval is not execution: the tool is still waiting until its own events arrive.
    expect(s.tools['b']?.status).toBe('input-available');
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

  const request = (approvalId: string): AiEvent => ({
    type: 'approval-request',
    approval: { approvalId, revision: 1, title: approvalId, status: 'requested' },
  });

  it('a refusal withdraws an open approval, never rejects it, and keeps a decision', async () => {
    const { transport, sink } = manual({ decide: async () => 'accepted' });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    const gated = (toolCallId: string): AiEvent[] => [
      { type: 'tool-input-available', toolCallId, input: {} },
      {
        type: 'approval-request',
        approval: {
          approvalId: `ap-${toolCallId}`,
          toolCallId,
          revision: 1,
          title: 'T',
          status: 'requested',
        },
      },
    ];
    push(sink(), ...gated('a'), ...gated('b'), ...gated('r'), {
      type: 'tool-denied',
      toolCallId: 'a',
    });
    let s = c.getSnapshot();
    expect(s.tools['a']).toMatchObject({ status: 'denied', approvalId: 'ap-a' });
    // A backend refusal is not the person's rejection: the approval is withdrawn.
    expect(s.approvals['ap-a']?.status).toBe('cancelled');
    expect(await c.decide('ap-a', 1, 'approve')).toEqual({ ok: false, reason: 'stale' });
    expect(await c.decide('ap-b', 1, 'approve')).toEqual({ ok: true });
    // An explicit rejection comes from the protocol's own outcome.
    push(sink(), {
      type: 'approval-resolved',
      approvalId: 'ap-r',
      revision: 1,
      status: 'rejected',
    });
    // Refused after the decision (the backend decides last): each approval keeps its decision.
    push(
      sink(),
      { type: 'tool-denied', toolCallId: 'b' },
      { type: 'tool-denied', toolCallId: 'r' },
    );
    s = c.getSnapshot();
    expect(s.tools['b']?.status).toBe('denied');
    expect(s.approvals['ap-b']?.status).toBe('approved');
    expect(s.approvals['ap-r']?.status).toBe('rejected');
    expect(attempt(c)?.status).toBe('streaming');
    expect(attempt(c)?.wait).toBeUndefined();
  });

  const ref = (id: string) => ({ kind: 'approval', id });

  it("an attempt's wait names its open requests and tells action from submission", async () => {
    let release!: (outcome: 'accepted') => void;
    const { transport, sink } = manual({ decide: () => new Promise((r) => (release = r)) });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), { type: 'text-delta', partId: 'p', delta: 'x' }, request('a'), request('b'));
    expect(attempt(c)).toMatchObject({
      status: 'awaiting-input',
      wait: { action: [ref('a'), ref('b')], submitting: [] },
    });
    const deciding = c.decide('b', 1, 'approve');
    expect(attempt(c)?.wait).toEqual({ action: [ref('a')], submitting: [ref('b')] });
    // Resolved in another order than asked: one resolution never clears another open request.
    release('accepted');
    await deciding;
    expect(attempt(c)).toMatchObject({
      status: 'awaiting-input',
      wait: { action: [ref('a')], submitting: [] },
    });
    // Withdrawn by the backend: the last open request goes, and the attempt streams again.
    push(sink(), { type: 'approval-resolved', approvalId: 'a', revision: 1, status: 'cancelled' });
    expect(c.getSnapshot().approvals['a']?.status).toBe('cancelled');
    expect(attempt(c)?.status).toBe('streaming');
    expect(attempt(c)?.wait).toBeUndefined();
  });

  it('a remote resolution before the local acknowledgment stands; a contrary one wins', async () => {
    const releases: ((outcome: 'accepted') => void)[] = [];
    const { transport, sink } = manual({
      decide: () => new Promise((r) => releases.push(r)),
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), request('a'), request('b'));
    const a = c.decide('a', 1, 'approve');
    const b = c.decide('b', 1, 'approve');
    push(
      sink(),
      { type: 'approval-resolved', approvalId: 'a', revision: 1, status: 'approved' },
      { type: 'approval-resolved', approvalId: 'b', revision: 1, status: 'rejected' },
    );
    releases.forEach((release) => release('accepted'));
    expect(await a).toEqual({ ok: true });
    // Decided elsewhere first: the record keeps that outcome, and the late answer says so.
    expect(await b).toEqual({ ok: false, reason: 'stale' });
    expect(c.getSnapshot().approvals['b']?.status).toBe('rejected');
  });

  it('only a terminal attempt withdraws its open requests; a late decision changes nothing', async () => {
    let release!: (outcome: 'accepted') => void;
    let stopped!: (outcome: 'cancelled') => void;
    const { transport, sink } = manual({
      decide: () => new Promise((r) => (release = r)),
      stop: () => new Promise((r) => (stopped = r)),
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    const ending: [string, AiEvent | 'stop'][] = [
      ['completed', { type: 'finish' }],
      ['failed', { type: 'error', error: { code: 'e', message: 'Broke.' } }],
      ['cancelled', 'stop'],
    ];
    for (const [status, end] of ending) {
      await c.send({ text: status });
      push(sink(), request(`${status}-a`), request(`${status}-b`));
      const deciding = c.decide(`${status}-b`, 1, 'approve');
      if (end === 'stop') {
        // A stop request is not the end: the requests stay answerable until the work stops.
        const stopping = c.stop();
        expect(c.getSnapshot().approvals[`${status}-a`]?.status).toBe('requested');
        stopped('cancelled');
        expect(await stopping).toMatchObject({ ok: true });
      } else push(sink(), end);
      expect(attempt(c)?.status).toBe(status);
      expect(attempt(c)?.wait).toBeUndefined();
      expect(c.getSnapshot().approvals[`${status}-a`]?.status).toBe('cancelled');
      expect(c.getSnapshot().approvals[`${status}-b`]?.status).toBe('cancelled');
      // The decision sent before the end arrives late: the record keeps the withdrawal.
      release('accepted');
      expect(await deciding).toEqual({ ok: false, reason: 'stale' });
      expect(c.getSnapshot().approvals[`${status}-b`]?.status).toBe('cancelled');
    }
  });

  it('an attempt awaits input while one of its approvals waits for the person', async () => {
    let fail = true;
    const { transport, sink } = manual({
      decide: async () => {
        if (!fail) return 'accepted';
        fail = false;
        throw new Error('offline');
      },
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), { type: 'text-delta', partId: 'p', delta: 'x' }, request('a'), request('b'));
    expect(attempt(c)?.status).toBe('awaiting-input');
    // More output while the person decides does not end the wait.
    push(sink(), { type: 'text-delta', partId: 'p', delta: 'y' });
    expect(attempt(c)?.status).toBe('awaiting-input');
    // A decision that did not reach the backend leaves the person to decide again.
    expect(await c.decide('a', 1, 'approve')).toMatchObject({ ok: false, reason: 'rejected' });
    expect(attempt(c)?.status).toBe('awaiting-input');
    expect(await c.decide('a', 1, 'approve')).toEqual({ ok: true });
    expect(attempt(c)?.status).toBe('awaiting-input');
    const deciding = c.decide('b', 1, 'reject');
    // The last decision is on its way: nothing waits for the person.
    expect(attempt(c)?.status).toBe('streaming');
    await deciding;
    expect(attempt(c)?.status).toBe('streaming');
    push(sink(), { type: 'finish' });
    expect(attempt(c)?.status).toBe('completed');
  });

  it('an attempt that finished awaiting input keeps waiting without a stream', async () => {
    const resumed: EventSink[] = [];
    const { transport, sink } = manual({
      decide: async () => 'accepted',
      resume: async (_target, s) => void resumed.push(s),
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), request('a'), { type: 'finish', status: 'awaiting-input' });
    sink().close();
    // The protocol paused the work: the approval stays answerable.
    expect(attempt(c)).toMatchObject({
      status: 'awaiting-input',
      connection: 'closed',
      wait: { action: [ref('a')], submitting: [] },
    });
    expect(await c.decide('a', 1, 'approve')).toEqual({ ok: true });
    // Answered: approval is not completion; the attempt waits for the work to go on.
    expect(attempt(c)).toMatchObject({
      status: 'awaiting-input',
      wait: { action: [], submitting: [] },
    });
    // The work goes on: the attempt takes the run's phase again, and its wait ends.
    expect(await c.resume()).toMatchObject({ ok: true });
    push(resumed[0] as EventSink, { type: 'text-delta', partId: 'p', delta: 'done' });
    expect(attempt(c)?.status).toBe('streaming');
    expect(attempt(c)?.wait).toBeUndefined();
    push(resumed[0] as EventSink, { type: 'finish' });
    expect(attempt(c)?.status).toBe('completed');
  });

  it('a paused attempt that ends waits no more, and keeps its decisions', async () => {
    const { transport, sink } = manual({
      decide: async () => 'accepted',
      stop: async () => 'cancelled',
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), request('a'), { type: 'finish', status: 'awaiting-input' });
    sink().close();
    await c.decide('a', 1, 'approve');
    expect(attempt(c)?.wait).toEqual({ action: [], submitting: [] });
    expect(await c.stop()).toMatchObject({ ok: true });
    expect(attempt(c)?.status).toBe('cancelled');
    expect(attempt(c)?.wait).toBeUndefined();
    expect(c.getSnapshot().approvals['a']?.status).toBe('approved');
  });

  it('a stream that ends while an approval waits is interrupted', async () => {
    const { transport, sink } = manual();
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), request('a'));
    expect(attempt(c)?.status).toBe('awaiting-input');
    sink().close();
    expect(attempt(c)).toMatchObject({ status: 'interrupted', connection: 'closed' });
    // Interrupted is not the end: the request stays open for a resumed stream.
    expect(c.getSnapshot().approvals['a']?.status).toBe('requested');
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
    expect(c.getSnapshot().approvals['ap']?.status).toBe('failed');
    fail = false;
    await c.decide('ap', 1, 'approve');
    expect(c.getSnapshot().approvals['ap']?.status).toBe('approved');
  });
});

describe('ConversationController: approval scopes (ADR 0049 §6 item 3)', () => {
  const SCOPED = { ...ALL, approvalScopes: { available: true } };
  const scopes = [
    { id: 'once', label: 'This change only' },
    { id: 'session', label: 'Writes to /docs this session', description: 'Until you sign out.' },
  ];
  const scoped = (extra: Partial<ApprovalRecord> = {}): AiEvent => ({
    type: 'approval-request',
    approval: {
      approvalId: 'ap',
      revision: 1,
      title: 'Write',
      status: 'requested',
      scopes,
      ...extra,
    },
  });
  const recording = (capabilities: Capabilities = SCOPED) => {
    const decisions: ApprovalDecision[] = [];
    const diagnostics: string[] = [];
    const { transport, sink } = manual({
      capabilities,
      decide: async (d) => (decisions.push(d), 'accepted'),
    });
    const c = new ConversationController({
      transport,
      onDiagnostic: (d) => diagnostics.push(d.code),
    });
    return { c, sink, decisions, diagnostics };
  };

  it('an approval goes with one of its scopes, chosen by the person; a rejection with none', async () => {
    const { c, sink, decisions } = recording();
    await c.send({ text: 'q' });
    push(sink(), scoped());
    // Two scopes and no default: nothing is chosen because it comes first.
    expect(await c.decide('ap', 1, 'approve')).toEqual({ ok: false, reason: 'invalid' });
    expect(await c.decide('ap', 1, 'approve', undefined, 'forever')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await c.decide('ap', 1, 'reject', 'no', 'once')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(decisions).toEqual([]);
    expect(await c.decide('ap', 1, 'approve', undefined, 'session')).toEqual({ ok: true });
    expect(decisions).toEqual([
      expect.objectContaining({
        approvalId: 'ap',
        revision: 1,
        decision: 'approve',
        scope: 'session',
      }),
    ]);
    expect(c.getSnapshot().approvals['ap']).toMatchObject({ status: 'approved', scope: 'session' });
  });

  it('the only scope or a valid default goes without a choice; repeated ids or an unknown default fail the request', async () => {
    const { c, sink, decisions, diagnostics } = recording();
    await c.send({ text: 'q' });
    push(
      sink(),
      scoped({ approvalId: 'one', scopes: [{ id: 'once', label: 'This change only' }] }),
      scoped({ approvalId: 'default', defaultScopeId: 'once' }),
      scoped({ approvalId: 'unknown', defaultScopeId: 'forever' }),
      scoped({
        approvalId: 'twice',
        scopes: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ],
      }),
      scoped({ approvalId: 'plain', scopes: undefined }),
    );
    expect(Object.keys(c.getSnapshot().approvals)).toEqual(['one', 'default', 'plain']);
    expect(diagnostics.filter((code) => code === 'ai.approval.scopes')).toHaveLength(2);
    expect(await c.decide('one', 1, 'approve')).toEqual({ ok: true });
    expect(await c.decide('default', 1, 'approve')).toEqual({ ok: true });
    // Without scopes the approval covers this revision only: a scope has nothing to name.
    expect(await c.decide('plain', 1, 'approve', undefined, 'once')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await c.decide('plain', 1, 'approve')).toEqual({ ok: true });
    expect(decisions.map((d) => d.scope)).toEqual(['once', 'once', undefined]);
    expect(decisions[2]).not.toHaveProperty('scope');
  });

  it('a transport that cannot carry a scope refuses the scoped approval and never drops the choice', async () => {
    const { c, sink, decisions } = recording(ALL);
    await c.send({ text: 'q' });
    push(sink(), scoped());
    expect(await c.decide('ap', 1, 'approve', undefined, 'once')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(c.getSnapshot().approvals['ap']?.status).toBe('requested');
    // A rejection carries no scope, so it still goes.
    expect(await c.decide('ap', 1, 'reject')).toEqual({ ok: true });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).not.toHaveProperty('scope');
  });

  it('deciding again after a failure records only the new decision, without the old scope', async () => {
    let fail = true;
    const { transport, sink } = manual({
      capabilities: SCOPED,
      decide: async () => (fail ? Promise.reject(new Error('offline')) : 'accepted'),
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), scoped());
    await c.decide('ap', 1, 'approve', undefined, 'session');
    expect(c.getSnapshot().approvals['ap']).toMatchObject({ status: 'failed', scope: 'session' });
    fail = false;
    expect(await c.decide('ap', 1, 'reject')).toEqual({ ok: true });
    expect(c.getSnapshot().approvals['ap']).toMatchObject({
      status: 'rejected',
      decision: 'reject',
    });
    expect(c.getSnapshot().approvals['ap']?.scope).toBeUndefined();
  });

  it('scopes changing during a submission: the new revision resets the choice; the late outcome is stale', async () => {
    let release!: (outcome: 'accepted') => void;
    const { transport, sink } = manual({
      capabilities: SCOPED,
      decide: () => new Promise((r) => (release = r)),
    });
    const c = new ConversationController({ transport, onDiagnostic: () => {} });
    await c.send({ text: 'q' });
    push(sink(), scoped());
    const deciding = c.decide('ap', 1, 'approve', undefined, 'session');
    expect(c.getSnapshot().approvals['ap']).toMatchObject({
      status: 'submitting',
      scope: 'session',
    });
    push(
      sink(),
      scoped({ revision: 2, scopes: [scopes[0]!, { id: 'all', label: 'Every write' }] }),
    );
    release('accepted');
    expect(await deciding).toEqual({ ok: false, reason: 'stale' });
    expect(c.getSnapshot().approvals['ap']).toMatchObject({ revision: 2, status: 'requested' });
    expect(c.getSnapshot().approvals['ap']?.scope).toBeUndefined();
    // The old revision's scope names nothing now.
    expect(await c.decide('ap', 2, 'approve', undefined, 'session')).toEqual({
      ok: false,
      reason: 'invalid',
    });
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

  it('announces a withdrawn approval once, as withdrawn', async () => {
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
    const approval = {
      approvalId: 'ap',
      revision: 1,
      title: 'Deploy',
      status: 'requested',
    } as const;
    push(sink(), { type: 'approval-request', approval }, { type: 'finish' });
    expect(announced.filter((text) => text.includes('Deploy'))).toEqual([
      'Approval needed: Deploy',
      'Approval withdrawn: Deploy',
    ]);
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
    expect(c.getSnapshot().tools['t']?.status).toBe('input-available');
    const deciding = c.decide('ap', 1, 'approve');
    await vi.advanceTimersByTimeAsync(10);
    await deciding;
    await vi.advanceTimersByTimeAsync(20);
    expect(c.getSnapshot().tools['t']?.status).toBe('output-available');
    expect(attempt(c)?.status).toBe('completed');
    expect(transport.pendingTimers).toBe(0);
  });
});
