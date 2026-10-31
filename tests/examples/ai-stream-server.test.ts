import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiEvent } from '../../packages/ai/src/contracts/types.js';
import { readSse } from '../../packages/ai/src/stream/sse.js';
import { UiMessageStreamReader } from '../../packages/ai/src/stream/ui-message-stream.js';
import { createChatServer } from '../../examples/ai-stream/server.mjs';

// The streaming chat example's server (examples/ai-stream/server.mjs), read through @oddkin/ai's
// own UI message stream reader, as the page reads it.

let server: Server;
let base: string;
beforeAll(async () => {
  server = createChatServer({ pace: 2 });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const request = (conversation: string, text: string, messageId = 'assistant-1') => ({
  id: conversation,
  messageId,
  trigger: 'submit-message',
  messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text }] }],
});
const post = (path: string, body: unknown) =>
  fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

/** The events the page would get, and the raw data lines, from one streamed answer. */
async function read(response: Response, onEvent?: (event: AiEvent) => void) {
  const reader = new UiMessageStreamReader();
  const events: AiEvent[] = [];
  const data: string[] = [];
  for await (const sse of readSse(response.body!, new AbortController().signal)) {
    data.push(sse.data);
    for (const event of reader.read(sse)) {
      events.push(event);
      onEvent?.(event);
    }
  }
  const text = events
    .filter((e): e is Extract<AiEvent, { type: 'text-delta' }> => e.type === 'text-delta')
    .filter((e) => e.partId === 'text-1')
    .map((e) => e.delta)
    .join('');
  return { events, data, text, done: reader.done };
}

describe('the streaming chat example server', () => {
  it('streams a canned answer in the UI message stream format', async () => {
    const response = await post('api/chat', request('c1', 'What is the weather in Lisbon?'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    const { events, data, text, done } = await read(response);
    expect(done).toBe(true);
    expect(data.at(-1)).toBe('[DONE]');
    // The assistant message takes the id the request asked for.
    expect(events[0]).toEqual({ type: 'message-start', messageId: 'assistant-1' });
    expect(events.map((e) => e.type)).toContain('tool-input-start');
    expect(events).toContainEqual({
      type: 'tool-input-available',
      toolCallId: 'call-weather-1',
      input: { city: 'Lisbon' },
    });
    expect(text).toBe('It is sunny in Lisbon today, with a high of 24 °C and a low of 16 °C.');
    // Any page path ending in api/chat answers, so the page works under a subpath too.
    const nested = await post('examples/ai-stream/api/chat', request('c1b', 'hello'));
    expect((await read(nested)).text).toMatch(/^Hello! This answer streams/);
  });

  it('reports an error chunk as an error', async () => {
    const { events } = await read(await post('api/chat', request('c2', 'Please fail')));
    expect(events.at(-1)).toMatchObject({ type: 'error', error: { code: 'ai.stream.error' } });
  });

  it('stops a running answer, and says when there is nothing to stop', async () => {
    const response = await post('api/chat', request('c3', 'Something long, please'));
    let stopped: Promise<Response> | undefined;
    const { data, done } = await read(response, (event) => {
      if (event.type === 'text-delta' && !stopped)
        stopped = post('api/stop', { conversationId: 'c3', runId: 'r', attemptId: 'a' });
    });
    expect(await (await stopped!).json()).toEqual({ status: 'cancelled' });
    expect(done).toBe(true);
    expect(data.at(-2)).toBe(JSON.stringify({ type: 'abort' }));
    // The recording has 150 chunks; the stop ends it long before.
    expect(data.length).toBeLessThan(100);
    const again = await post('api/stop', { conversationId: 'c3', runId: 'r', attemptId: 'a' });
    expect(await again.json()).toEqual({ status: 'already-finished' });
  });

  it('serves the page, and refuses paths outside its root and other methods', async () => {
    const page = await fetch(new URL('index.html', base));
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await page.text()).toContain('<odd-conversation');
    expect((await fetch(new URL('..%2fpackage.json', base))).status).toBe(403);
    expect((await fetch(new URL('missing.js', base))).status).toBe(404);
    expect((await fetch(new URL('api/chat', base))).status).toBe(405);
    expect((await post('index.html', {})).status).toBe(405);
    expect((await post('api/chat', '{ not json')).status).toBe(400);
    expect((await post('api/chat', 'x'.repeat(1024 * 1024 + 1))).status).toBe(413);
  });

  it('never serves hidden files, such as a .env holding a key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ai-stream-'));
    await mkdir(join(root, '.git'));
    await mkdir(join(root, 'site'));
    await writeFile(join(root, '.env'), 'PROVIDER_API_KEY=not-a-real-key\n');
    await writeFile(join(root, '.git', 'config'), '[core]\n');
    await writeFile(join(root, 'site', 'index.html'), '<!doctype html>');
    const hidden = createChatServer({ root });
    await new Promise<void>((resolve) => hidden.listen(0, '127.0.0.1', resolve));
    const at = `http://127.0.0.1:${(hidden.address() as AddressInfo).port}/`;
    try {
      expect((await fetch(new URL('site/', at))).status).toBe(200);
      for (const path of ['.env', '%2eenv', 'site/..%2f.env', '.git/config', '.git/'])
        expect((await fetch(new URL(path, at))).status, path).toBe(404);
    } finally {
      await new Promise<void>((resolve) => hidden.close(() => resolve()));
      await rm(root, { recursive: true, force: true });
    }
  });
});
