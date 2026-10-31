# Streaming chat

A chat page that streams its answers over HTTP from its own server, in the AI SDK's UI message
stream format, v1 (<https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol>). `odd-conversation` and
`odd-prompt-input` from `@oddkin/ai` are driven by `ConversationController` and
`ComposerController`; `createUiMessageStreamTransport` (`@oddkin/ai/stream`) posts each message to
`api/chat` and reads the answer as it arrives. No build step: the page loads the packages through
an import map, under a strict Content Security Policy (`connect-src 'self'`, Trusted Types).

The server (`server.mjs`) has no model: it replays recordings from `responses.json`.

- Ask about the **weather**: a tool call (its input streams in, then its output), a source, and
  the answer.
- Ask for something **long**: 150 chunks, time to press Stop. The page posts to `api/stop`, the
  server ends the stream with an `abort` chunk, and the message keeps the words that arrived.
- Say **fail**: the stream ends with an error chunk, and the message says so.
- Anything else: a short answer.

## Run it

In this repository:

```sh
npm run build
node examples/ai-stream/server.mjs --root .
```

Then open <http://127.0.0.1:4178/examples/ai-stream/>. `--root` is the directory to serve (the
page's import map points at `packages/*/dist`). `--port` (4178), `--host` (127.0.0.1), and
`--pace` (milliseconds between chunks, 25) are optional. The server never serves hidden files or
folders, such as `.env` and `.git`.

`e2e/ai-stream.spec.ts` runs the page the way an application would. `scripts/ai-stream-consumer.mjs`
packs `@oddkin/core`, `@oddkin/tokens`, `@oddkin/components`, and `@oddkin/ai` with `npm pack`,
installs the tarballs into a new project, copies this example into it, and points the import map
at `node_modules`. The tests stream, stop, and fail in Chromium, Firefox, and WebKit.

## With a real model

The page doesn't change: it already reads the protocol. On the server, replace `chat()` with a
route that calls the model through the AI SDK, and keep `stop()` and the file handler. This
sketch follows the AI SDK documentation (`streamText`, checked 2026-10-30). It isn't run in this
repository, which has no model or key.

```js
import { convertToModelMessages, streamText } from 'ai';

async function chat(request, response) {
  const { id, messages } = await readJson(request);
  const controller = new AbortController();
  const entry = { stop: () => controller.abort() };
  running.get(id)?.stop();
  running.set(id, entry);
  response.on('close', () => {
    if (running.get(id) === entry) running.delete(id);
  });
  const result = streamText({
    model: process.env.CHAT_MODEL, // a model id your provider accepts
    instructions: 'Answer briefly.',
    messages: await convertToModelMessages(messages),
    abortSignal: controller.signal,
  });
  result.pipeUIMessageStreamToResponse(response, { sendSources: true, sendReasoning: true });
}
```

Stop aborts the model call through `abortSignal`, and the stream ends with an `abort` part, as the
replay does. `stop()` answers `cancelled`, or `already-finished` when nothing was running.

Keep keys on the server:

- The provider reads its key from the server's environment (`process.env`); its documentation
  names the variable. The key never goes into the page, the import map, or `responses.json`.
- Keep a `.env` file out of git (this repository's `.gitignore` lists `.env`) and out of any
  folder a server serves. This server refuses hidden files; another server might not.
- The history in a request comes from the browser, which can change it. Put the instructions on
  the server (`instructions`) and leave `allowSystemInMessages` off, so that system messages in
  `messages` are refused. The server reads at most 1 MB per request.
