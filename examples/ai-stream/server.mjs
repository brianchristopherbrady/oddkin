// The streaming chat example's server: it serves the page's files and answers POST …/api/chat by
// replaying a canned response in the AI SDK UI message stream format, v1
// (https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol). No model, no network, no keys; README.md
// shows the route to put in its place for a real model.
//   node server.mjs [--port 4178] [--host 127.0.0.1] [--root <directory to serve>] [--pace <ms>]
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = fileURLToPath(new URL('.', import.meta.url));
const { responses } = JSON.parse(await readFile(join(here, 'responses.json'), 'utf8'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const MAX_BODY = 1024 * 1024;

/** The text of the last user message in an AI SDK request body, lowercased. */
function lastUserText(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const last = messages.findLast((message) => message?.role === 'user');
  const parts = Array.isArray(last?.parts) ? last.parts : [];
  return parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ')
    .toLowerCase();
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body is not JSON'), { status: 400 });
  }
}

const json = (response, status, value) =>
  response
    .writeHead(status, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' })
    .end(JSON.stringify(value));

/**
 * The example's HTTP server, not yet listening. `root` is the directory it serves (the page and
 * the packages its import map names); `pace` is the delay between chunks in milliseconds.
 */
export function createChatServer({ root = here, pace = 25 } = {}) {
  const base = resolve(root);
  /** The stream each conversation has running, to stop it. */
  const running = new Map();

  async function chat(request, response) {
    const body = await readJson(request);
    const conversation = typeof body?.id === 'string' ? body.id : '';
    const messageId =
      typeof body?.messageId === 'string' ? body.messageId : `message-${Date.now()}`;
    const text = lastUserText(body);
    const { chunks } =
      responses.find((candidate) => candidate.match && text.includes(candidate.match)) ??
      responses.at(-1);
    const stream = { stopped: false };
    const entry = { stop: () => (stream.stopped = true) };
    running.get(conversation)?.stop();
    running.set(conversation, entry);
    response.on('close', () => (stream.stopped = true));
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-vercel-ai-ui-message-stream': 'v1',
    });
    const send = (data) => response.write(`data: ${data}\n\n`);
    try {
      for (const chunk of chunks) {
        if (stream.stopped) break;
        send(JSON.stringify(chunk.type === 'start' ? { ...chunk, messageId } : chunk));
        await new Promise((done) => setTimeout(done, pace));
      }
      if (!response.destroyed) {
        if (stream.stopped) send(JSON.stringify({ type: 'abort' }));
        send('[DONE]');
      }
    } finally {
      if (running.get(conversation) === entry) running.delete(conversation);
      response.end();
    }
  }

  async function stop(request, response) {
    const body = await readJson(request);
    const current = running.get(
      typeof body?.conversationId === 'string' ? body.conversationId : '',
    );
    if (!current) return json(response, 200, { status: 'already-finished' });
    current.stop();
    return json(response, 200, { status: 'cancelled' });
  }

  async function file(url, request, response) {
    let path;
    try {
      path = normalize(join(base, decodeURIComponent(url.pathname)));
    } catch {
      return void response.writeHead(400).end('Bad request');
    }
    if (path !== base && !path.startsWith(base + sep))
      return void response.writeHead(403).end('Forbidden');
    // Hidden files and folders (.env, .git) are never served: a .env may hold a provider's key.
    if (
      relative(base, path)
        .split(sep)
        .some((segment) => segment.startsWith('.'))
    )
      return void response.writeHead(404).end('Not found');
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      const content = await readFile(path);
      response.writeHead(200, {
        'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  }

  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const route = url.pathname.endsWith('/api/chat')
      ? chat
      : url.pathname.endsWith('/api/stop')
        ? stop
        : undefined;
    const handle = route
      ? request.method === 'POST'
        ? route(request, response)
        : Promise.resolve(void response.writeHead(405, { allow: 'POST' }).end())
      : request.method === 'GET' || request.method === 'HEAD'
        ? file(url, request, response)
        : Promise.resolve(void response.writeHead(405, { allow: 'GET, HEAD' }).end());
    handle.catch((error) => {
      if (!response.headersSent) json(response, error.status ?? 500, { error: error.message });
      else response.end();
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: '4178' },
      host: { type: 'string', default: '127.0.0.1' },
      root: { type: 'string' },
      pace: { type: 'string', default: '25' },
    },
  });
  const server = createChatServer({
    ...(values.root ? { root: values.root } : {}),
    pace: Number(values.pace),
  });
  server.listen(Number(values.port), values.host, () =>
    console.log(`Streaming chat example: http://${values.host}:${values.port}/`),
  );
}
