import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConversationController } from '../src/controllers/conversation.js';
import { SseParser, createSseDecoder, type SseEvent } from '../src/stream/sse.js';
import {
  UiMessageStreamReader,
  createUiMessageStreamTransport,
} from '../src/stream/ui-message-stream.js';
import type { ConversationState } from '../src/contracts/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/ui-message-stream');
const fixture = (name: string) => readFileSync(join(fixtures, name));

function parse(text: string): SseEvent[] {
  const out: SseEvent[] = [];
  const parser = new SseParser((e) => out.push(e));
  parser.feed(text);
  parser.end();
  return out;
}

function decodeChunks(chunks: Uint8Array[]): SseEvent[] {
  const decoder = createSseDecoder();
  return [...chunks.flatMap((c) => decoder.push(c)), ...decoder.end()];
}

/** Deterministic pseudo-random split points. */
function split(bytes: Uint8Array, seed: number): Uint8Array[] {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < bytes.length) {
    const size = 1 + Math.floor(next() * 7);
    out.push(bytes.slice(i, i + size));
    i += size;
  }
  return out;
}

describe('SSE parsing (WHATWG event stream interpretation)', () => {
  it('handles fields, comments, multi-line data, ids, retry, and line endings', () => {
    const retries: number[] = [];
    const events: SseEvent[] = [];
    const parser = new SseParser(
      (e) => events.push(e),
      (ms) => retries.push(ms),
    );
    parser.feed(
      '\uFEFF: comment\r\nid: 1\r\nevent: note\r\ndata: a\rdata:b\n\ndata: c\nretry: 250\nretry: x\n\nid: bad\u0000id\ndata\n\n',
    );
    parser.end();
    expect(events).toEqual([
      { type: 'note', data: 'a\nb', lastEventId: '1' },
      { type: 'message', data: 'c', lastEventId: '1' },
      { type: 'message', data: '', lastEventId: '1' },
    ]);
    expect(retries).toEqual([250]);
  });

  it('discards an unterminated event at end of stream and ignores empty dispatches', () => {
    expect(parse('event: x\n\ndata: kept\n\ndata: lost')).toEqual([
      { type: 'message', data: 'kept', lastEventId: '' },
    ]);
  });

  it('treats CRLF split across chunks as one line break', () => {
    const events: SseEvent[] = [];
    const parser = new SseParser((e) => events.push(e));
    parser.feed('data: one\r');
    parser.feed('\n\r');
    parser.feed('\ndata: two\r\r');
    parser.end();
    expect(events.map((e) => e.data)).toEqual(['one', 'two']);
  });

  it('A03: every byte split point reconstructs the same events (multi-byte UTF-8 included)', () => {
    const bytes = new TextEncoder().encode('data: café 🌍 ✓\r\n\r\ndata: 日本語\n\n');
    const whole = decodeChunks([bytes]);
    expect(whole.map((e) => e.data)).toEqual(['café 🌍 ✓', '日本語']);
    for (let a = 1; a < bytes.length; a++)
      for (const b of [a + 1, a + 3, bytes.length - 1])
        if (b > a && b < bytes.length)
          expect(decodeChunks([bytes.slice(0, a), bytes.slice(a, b), bytes.slice(b)])).toEqual(
            whole,
          );
  });
});

describe('UI message stream reader', () => {
  it('translates protocol chunks and reports unsupported or malformed ones', () => {
    const diagnostics: string[] = [];
    const reader = new UiMessageStreamReader({ onDiagnostic: (d) => diagnostics.push(d.code) });
    const events = parse(fixture('agent-abort.sse').toString('utf8')).flatMap((e) =>
      reader.read(e),
    );
    expect(events.map((e) => e.type)).toEqual([
      'message-start',
      'tool-input-start',
      'tool-input-available',
      'approval-request',
      'tool-input-start',
      'tool-input-available',
      'tool-executing',
      'tool-error',
      'approval-resolved',
      'tool-denied',
      'metadata',
      'text-start',
      'text-delta',
      'text-end',
      'abort',
    ]);
    expect(diagnostics).toEqual(['ui-stream.unsupported', 'ui-stream.json']);
    expect(reader.done).toBe(true);
  });

  it('turns the first start of a replayed connection into a reset', () => {
    const reader = new UiMessageStreamReader({ replay: true });
    expect(reader.translate({ type: 'start', messageId: 'm' }).map((e) => e.type)).toEqual([
      'message-reset',
      'message-start',
    ]);
    expect(reader.translate({ type: 'start', messageId: 'm' }).map((e) => e.type)).toEqual([
      'message-start',
    ]);
  });

  it('marks preliminary tool output as still running, not finished', () => {
    const reader = new UiMessageStreamReader();
    reader.translate({ type: 'tool-input-start', toolCallId: 't', toolName: 'x' });
    expect(
      reader
        .translate({ type: 'tool-output-available', toolCallId: 't', output: 1, preliminary: true })
        .map((e) => e.type),
    ).toEqual(['tool-executing']);
  });
});

// ---- Transport over fetch with recorded fixtures ----

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++] as Uint8Array);
      else controller.close();
    },
  });
}

const headers = { 'x-vercel-ai-ui-message-stream': 'v1', 'content-type': 'text/event-stream' };

async function run(
  name: string,
  chunks: (bytes: Uint8Array) => Uint8Array[],
): Promise<ConversationState> {
  const bytes = new Uint8Array(fixture(name));
  const transport = createUiMessageStreamTransport({
    api: '/api/chat',
    fetch: async () => new Response(streamOf(chunks(bytes)), { status: 200, headers }),
  });
  const controller = new ConversationController({
    transport,
    conversationId: 'c1',
    onDiagnostic: () => {},
  });
  const done = new Promise<void>((resolve) => {
    const off = controller.subscribe(() => {
      const state = controller.getSnapshot();
      const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : undefined;
      if (attempt?.connection === 'closed') {
        off();
        resolve();
      }
    });
  });
  await controller.send({ text: 'Tell me about café crème' });
  await done;
  return controller.getSnapshot();
}

const shape = (state: ConversationState) => ({
  answer: state.messages[1]?.parts,
  tools: Object.fromEntries(
    Object.entries(state.tools).map(([id, { attemptId: _a, ...tool }]) => [id, tool]),
  ),
  approvals: state.approvals,
  status: Object.values(state.attempts).map((a) => [a.status, a.stop, a.connection]),
});

describe('UI message stream transport (recorded fixtures)', () => {
  it('builds the research answer: text, reasoning, tool, sources, data, citations', async () => {
    const state = await run('research.sse', (b) => [b]);
    const assistant = state.messages[1];
    const text = assistant?.parts.find((p) => p.type === 'text');
    expect(text && 'text' in text && text.text).toBe(
      'A café crème is espresso with hot water [^src-1]. Ha ha ha. Ha ha ha. Roasts vary 🌍 [^src-2].',
    );
    expect(assistant?.parts.map((p) => p.type)).toEqual([
      'reasoning',
      'tool-call',
      'source',
      'source',
      'text',
      'data',
    ]);
    const tool = state.tools['call_search_1'];
    expect(tool?.status).toBe('output-available');
    expect(tool?.inputText).toBe('{"query":"café crème"}');
    expect(Object.values(state.attempts)[0]).toMatchObject({
      status: 'completed',
      connection: 'closed',
      stop: 'none',
    });
  });

  it('A03/A04: arbitrary byte splits give the same state; repeated text is kept', async () => {
    const whole = shape(await run('research.sse', (b) => [b]));
    for (const seed of [1, 7, 42, 1234])
      expect(shape(await run('research.sse', (b) => split(b, seed)))).toEqual(whole);
    const byByte = shape(await run('research.sse', (b) => [...b].map((x) => new Uint8Array([x]))));
    expect(byByte).toEqual(whole);
  });

  it('keeps approval, denial, and tool failure independent; abort cancels', async () => {
    const state = await run('agent-abort.sse', (b) => split(b, 3));
    expect(state.tools['call_delete']?.status).toBe('denied');
    expect(state.tools['call_list']?.status).toBe('output-error');
    expect(state.tools['call_list']?.error?.message).toBe('Permission denied');
    expect(state.approvals['approval_1']?.status).toBe('rejected');
    expect(Object.values(state.attempts)[0]?.status).toBe('cancelled');
  });

  it('discards a reset step and reports the stream error', async () => {
    const state = await run('reset-error.sse', (b) => [b]);
    const parts = state.messages[1]?.parts ?? [];
    expect(parts.map((p) => p.id)).toEqual(['final']);
    expect(Object.values(state.attempts)[0]).toMatchObject({
      status: 'failed',
      error: { message: 'Rate limited upstream.' },
    });
  });

  it('does not infer completion when the connection closes early', async () => {
    const state = await run('research.sse', (b) => [b.slice(0, Math.floor(b.length / 2))]);
    expect(Object.values(state.attempts)[0]).toMatchObject({
      status: 'interrupted',
      connection: 'closed',
    });
  });

  it('rejects a failed HTTP request without accepting the attempt', async () => {
    const transport = createUiMessageStreamTransport({
      api: '/x',
      fetch: async () => new Response('no', { status: 503 }),
    });
    const controller = new ConversationController({ transport, onDiagnostic: () => {} });
    const result = await controller.send({ text: 'hi' });
    expect(result).toMatchObject({
      ok: false,
      reason: 'rejected',
      error: { code: 'ai.http.503', retryable: true },
    });
    expect(controller.getSnapshot().messages).toEqual([]);
  });

  it('A06: a replayed resume rebuilds the message without duplicates or a new attempt', async () => {
    const bytes = new Uint8Array(fixture('research.sse'));
    let calls = 0;
    const transport = createUiMessageStreamTransport({
      api: '/api/chat',
      resumeApi: (t) => `/api/chat/${t.conversationId}/stream`,
      fetch: async () => {
        calls++;
        // First connection drops halfway; the resume endpoint replays the whole stream.
        const body = calls === 1 ? bytes.slice(0, Math.floor(bytes.length * 0.6)) : bytes;
        return new Response(streamOf(split(body, calls)), { status: 200, headers });
      },
    });
    const controller = new ConversationController({
      transport,
      conversationId: 'c1',
      onDiagnostic: () => {},
    });
    const settled = (connection: string) =>
      new Promise<void>((resolve) => {
        const off = controller.subscribe(() => {
          const attempt = Object.values(controller.getSnapshot().attempts)[0];
          if (attempt?.connection === connection) {
            off();
            resolve();
          }
        });
      });
    let closed = settled('closed');
    await controller.send({ text: 'q' });
    await closed;
    const attemptId = controller.getSnapshot().activeAttemptId as string;
    expect(controller.getSnapshot().attempts[attemptId]?.status).toBe('interrupted');
    closed = settled('closed');
    await controller.resume(attemptId);
    await closed;
    const state = controller.getSnapshot();
    expect(Object.keys(state.attempts)).toEqual([attemptId]);
    expect(state.attempts[attemptId]?.status).toBe('completed');
    const text = state.messages[1]?.parts.find((p) => p.type === 'text');
    expect(text && 'text' in text && text.text.match(/Ha ha ha\./g)?.length).toBe(2);
  });
});
