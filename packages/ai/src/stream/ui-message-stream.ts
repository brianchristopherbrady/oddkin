/**
 * Adapter for the AI SDK UI message stream protocol, version 1 (`x-vercel-ai-ui-message-stream:
 * v1`, SSE `data:` lines carrying JSON chunks, terminated by `data: [DONE]`). Inspected at
 * https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol on 2026-10-17. Wire details stay here; the
 * output is the normalized `AiEvent` stream.
 *
 * Guarantees and limits (docs/architecture/ai-interaction.md §6.3):
 * - Ordering: chunks are applied in arrival order; ids route text, reasoning, and tool chunks.
 * - Identity: the protocol has no event ids or offsets, so nothing is deduplicated by identity.
 *   Resumed streams are full replays (the SDK default): the first `start` of a resumed
 *   connection becomes `message-reset`, and the replay rebuilds the message.
 * - Unsupported or malformed chunks become diagnostics and are not rendered.
 * - Information loss: `providerMetadata`, `messageMetadata`, `custom` parts, `finish-step`,
 *   `finishReason`, preliminary tool outputs, and transient data parts are not rendered.
 * DOM-free (uses `fetch`, `TextDecoder`, and `ReadableStream` only when called).
 */
import type { JsonValue } from '@oddkin/core/model';
import { toPublicError } from '../contracts/normalize.js';
import type {
  AiEvent,
  ApprovalDecision,
  AttemptTarget,
  Capabilities,
  ConversationTransport,
  DecisionOutcome,
  EventSink,
  MessageRecord,
  PublicError,
  SendRequest,
  StopOutcome,
} from '../contracts/types.js';
import { readSse, type SseEvent } from './sse.js';

export const UI_MESSAGE_STREAM_HEADER = 'x-vercel-ai-ui-message-stream';
export const UI_MESSAGE_STREAM_VERSION = 'v1';

export interface StreamDiagnostic {
  readonly code: string;
  readonly message: string;
}

type Chunk = Record<string, unknown> & { type: string };

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

function isJson(value: unknown, depth = 32): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth <= 0) return false;
  return Array.isArray(value)
    ? value.every((v) => isJson(v, depth - 1))
    : Object.values(value as object).every((v) => isJson(v, depth - 1));
}

/**
 * Translates one connection's chunks. Create one reader per connection; pass `replay: true` for
 * a resumed connection whose server replays the stream from the start.
 */
export class UiMessageStreamReader {
  readonly #replay: boolean;
  readonly #diagnose: (d: StreamDiagnostic) => void;
  #started = false;
  #done = false;
  #files = 0;
  #data = 0;
  readonly #toolNames = new Map<string, string>();

  constructor(options: { replay?: boolean; onDiagnostic?: (d: StreamDiagnostic) => void } = {}) {
    this.#replay = options.replay ?? false;
    this.#diagnose = options.onDiagnostic ?? (() => {});
  }

  /** True after `[DONE]`. */
  get done(): boolean {
    return this.#done;
  }

  /** Translate one SSE event. */
  read(event: SseEvent): AiEvent[] {
    if (this.#done) {
      this.#diagnose({ code: 'ui-stream.afterDone', message: 'Ignored data after [DONE].' });
      return [];
    }
    if (event.data === '[DONE]') {
      this.#done = true;
      return [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      this.#diagnose({ code: 'ui-stream.json', message: 'Ignored a chunk that is not JSON.' });
      return [];
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Chunk).type !== 'string'
    ) {
      this.#diagnose({ code: 'ui-stream.chunk', message: 'Ignored a chunk without a type.' });
      return [];
    }
    return this.translate(parsed as Chunk);
  }

  /** Translate one parsed chunk. Invalid fields drop the chunk with a diagnostic. */
  translate(chunk: Chunk): AiEvent[] {
    const invalid = (field: string): AiEvent[] => {
      this.#diagnose({
        code: 'ui-stream.invalid',
        message: `Ignored "${chunk.type}": invalid ${field}.`,
      });
      return [];
    };
    const id = str(chunk['id']);
    const toolCallId = str(chunk['toolCallId']);
    switch (chunk.type) {
      case 'start': {
        const events: AiEvent[] = [];
        if (this.#replay && !this.#started) events.push({ type: 'message-reset' });
        this.#started = true;
        events.push({ type: 'message-start', messageId: str(chunk['messageId']) });
        if (chunk['messageMetadata'] !== undefined)
          events.push(this.#metadata(chunk['messageMetadata']));
        return events;
      }
      case 'text-start':
      case 'reasoning-start':
        if (!id) return invalid('id');
        return [
          {
            type: 'text-start',
            partId: id,
            kind: chunk.type === 'text-start' ? 'text' : 'reasoning',
          },
        ];
      case 'text-delta':
      case 'reasoning-delta': {
        const delta = str(chunk['delta']);
        if (!id) return invalid('id');
        if (delta === undefined) return invalid('delta');
        return [{ type: 'text-delta', partId: id, delta }];
      }
      case 'text-end':
      case 'reasoning-end':
        if (!id) return invalid('id');
        return [{ type: 'text-end', partId: id }];
      case 'source-url': {
        const sourceId = str(chunk['sourceId']);
        const url = str(chunk['url']);
        if (!sourceId || !url) return invalid('sourceId or url');
        const title = str(chunk['title']);
        return [
          {
            type: 'part',
            part: {
              type: 'source',
              id: `source-${sourceId}`,
              sourceId,
              url,
              kind: 'web',
              ...(title ? { title } : {}),
            },
          },
        ];
      }
      case 'source-document': {
        const sourceId = str(chunk['sourceId']);
        if (!sourceId) return invalid('sourceId');
        const title = str(chunk['title']) ?? str(chunk['filename']);
        return [
          {
            type: 'part',
            part: {
              type: 'source',
              id: `source-${sourceId}`,
              sourceId,
              kind: 'document',
              ...(title ? { title } : {}),
            },
          },
        ];
      }
      case 'file': {
        const url = str(chunk['url']);
        const mediaType = str(chunk['mediaType']);
        if (!url || !mediaType) return invalid('url or mediaType');
        const name =
          str(chunk['filename']) ??
          (url.startsWith('data:') ? 'file' : url.split(/[?#]/)[0]?.split('/').pop() || 'file');
        return [
          {
            type: 'part',
            part: { type: 'file', id: `file-${++this.#files}`, name, mediaType, url },
          },
        ];
      }
      case 'error': {
        const errorText = str(chunk['errorText']);
        return [
          {
            type: 'error',
            error: { code: 'ai.stream.error', message: errorText ?? 'The response failed.' },
          },
        ];
      }
      case 'tool-input-start': {
        const toolName = str(chunk['toolName']);
        if (!toolCallId || !toolName) return invalid('toolCallId or toolName');
        this.#toolNames.set(toolCallId, toolName);
        return [{ type: 'tool-input-start', toolCallId, toolName, title: str(chunk['title']) }];
      }
      case 'tool-input-delta': {
        const delta = str(chunk['inputTextDelta']);
        if (!toolCallId || delta === undefined) return invalid('toolCallId or inputTextDelta');
        return [
          ...this.#ensureTool(toolCallId, chunk),
          { type: 'tool-input-delta', toolCallId, delta },
        ];
      }
      case 'tool-input-available': {
        if (!toolCallId) return invalid('toolCallId');
        const input = chunk['input'];
        if (!isJson(input)) return invalid('input');
        return [
          ...this.#ensureTool(toolCallId, chunk),
          { type: 'tool-input-available', toolCallId, input },
        ];
      }
      case 'tool-input-error': {
        if (!toolCallId) return invalid('toolCallId');
        return [
          ...this.#ensureTool(toolCallId, chunk),
          {
            type: 'tool-error',
            toolCallId,
            error: {
              code: 'ai.tool.input',
              message: str(chunk['errorText']) ?? 'Invalid tool input.',
            },
          },
        ];
      }
      case 'tool-approval-request': {
        const approvalId = str(chunk['approvalId']);
        if (!toolCallId || !approvalId) return invalid('toolCallId or approvalId');
        const toolName = this.#toolNames.get(toolCallId) ?? 'tool';
        const reason = str(chunk['reason']);
        return [
          ...this.#ensureTool(toolCallId, chunk),
          {
            type: 'approval-request',
            approval: {
              approvalId,
              toolCallId,
              revision: 1,
              title: toolName,
              ...(reason ? { summary: reason } : {}),
              status: 'requested',
            },
          },
        ];
      }
      case 'tool-approval-response': {
        const approvalId = str(chunk['approvalId']);
        const approved = chunk['approved'];
        if (!approvalId || typeof approved !== 'boolean') return invalid('approvalId or approved');
        return [
          {
            type: 'approval-resolved',
            approvalId,
            revision: 1,
            status: approved ? 'approved' : 'rejected',
          },
        ];
      }
      case 'tool-output-available': {
        if (!toolCallId) return invalid('toolCallId');
        const output = chunk['output'];
        if (!isJson(output)) return invalid('output');
        // A preliminary output means the tool is still running; only the final output settles it.
        if (chunk['preliminary'] === true) return [{ type: 'tool-executing', toolCallId }];
        return [
          { type: 'tool-executing', toolCallId },
          { type: 'tool-output', toolCallId, output },
        ];
      }
      case 'tool-output-error':
        if (!toolCallId) return invalid('toolCallId');
        return [
          { type: 'tool-executing', toolCallId },
          {
            type: 'tool-error',
            toolCallId,
            error: {
              code: 'ai.tool.failed',
              message: str(chunk['errorText']) ?? 'The tool failed.',
            },
          },
        ];
      case 'tool-output-denied':
        if (!toolCallId) return invalid('toolCallId');
        return [{ type: 'tool-denied', toolCallId }];
      case 'start-step':
        return [{ type: 'step-start' }];
      case 'reset-step':
        return [{ type: 'step-reset' }];
      case 'finish-step':
        return [];
      case 'finish': {
        const events: AiEvent[] = [];
        if (chunk['messageMetadata'] !== undefined)
          events.push(this.#metadata(chunk['messageMetadata']));
        events.push({ type: 'finish' });
        return events;
      }
      case 'abort':
        return [{ type: 'abort', reason: str(chunk['reason']) }];
      case 'message-metadata':
        return [this.#metadata(chunk['messageMetadata'])];
      case 'custom':
        return [this.#metadata({ kind: str(chunk['kind']) ?? 'custom' })];
      default:
        if (chunk.type.startsWith('data-')) {
          const data = chunk['data'];
          if (!isJson(data)) return invalid('data');
          if (chunk['transient'] === true) return [this.#metadata({ transient: chunk.type })];
          return [
            {
              type: 'part',
              part: {
                type: 'data',
                id: id ?? `data-${++this.#data}`,
                name: chunk.type.slice(5),
                data,
              },
            },
          ];
        }
        this.#diagnose({
          code: 'ui-stream.unsupported',
          message: `Ignored unsupported chunk "${chunk.type}".`,
        });
        return [];
    }
  }

  #ensureTool(toolCallId: string, chunk: Chunk): AiEvent[] {
    if (this.#toolNames.has(toolCallId)) return [];
    const toolName = str(chunk['toolName']) ?? 'tool';
    this.#toolNames.set(toolCallId, toolName);
    return [{ type: 'tool-input-start', toolCallId, toolName }];
  }

  #metadata(value: unknown): AiEvent {
    return { type: 'metadata', data: isJson(value) ? value : null };
  }
}

/** Minimal AI SDK `UIMessage` for request bodies (text and file parts). */
export function toUiMessage(message: MessageRecord): JsonValue {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.flatMap((part): JsonValue[] => {
      if (part.type === 'text') return [{ type: 'text', text: part.text }];
      if (part.type === 'file' && part.url)
        return [{ type: 'file', mediaType: part.mediaType, url: part.url, filename: part.name }];
      return [];
    }),
  };
}

export interface UiMessageStreamTransportOptions {
  /** POST endpoint that starts an attempt and returns the stream. */
  readonly api: string;
  /** GET endpoint for the active stream of a conversation (204 when none). Enables `resume`. */
  readonly resumeApi?: (target: AttemptTarget) => string;
  /**
   * POST endpoint that cancels the active work. Enables `stop`. A JSON body
   * `{ "status": "cancelled" | "already-finished" | "not-found" }` makes the outcome known;
   * any other 2xx response is reported as `unknown`.
   */
  readonly stopApi?: (target: AttemptTarget) => string;
  /** POST endpoint for approval decisions returning `{ "status": "accepted" | "stale" | "expired" }`. */
  readonly decideApi?: (decision: ApprovalDecision) => string;
  readonly fetch?: typeof fetch;
  readonly headers?: () => Record<string, string>;
  /** Build the request body. Default: `{ id, messageId, trigger, messages }` as the SDK sends. */
  readonly body?: (request: SendRequest) => JsonValue;
  /** Narrow what the application allows (the transport adds what its options enable). */
  readonly capabilities?: Capabilities;
  readonly onDiagnostic?: (d: StreamDiagnostic) => void;
}

const HTTP_ERROR = (status: number): PublicError => ({
  code: `ai.http.${status}`,
  message: status === 429 ? 'Too many requests. Try again shortly.' : 'The request failed.',
  retryable: status === 429 || status >= 500,
});

/** A `ConversationTransport` over the UI message stream protocol (fetch + SSE). */
export function createUiMessageStreamTransport(
  options: UiMessageStreamTransportOptions,
): ConversationTransport {
  const doFetch =
    options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const connections = new Map<string, AbortController>();
  const diagnose = options.onDiagnostic ?? (() => {});
  const capabilities: Capabilities = {
    send: { available: true },
    disconnect: { available: true },
    retry: { available: true },
    regenerate: { available: true },
    edit: { available: true },
    switchBranch: { available: true },
    stop: options.stopApi
      ? { available: true }
      : { available: false, reason: 'This service cannot stop responses.' },
    resume: options.resumeApi
      ? { available: true }
      : { available: false, reason: 'This service cannot resume responses.' },
    respondToApproval: options.decideApi
      ? { available: true }
      : { available: false, reason: 'Approvals are not supported.' },
    ...options.capabilities,
  };

  const pump = async (
    response: Response,
    sink: EventSink,
    replay: boolean,
    controller: AbortController,
  ) => {
    const reader = new UiMessageStreamReader({ replay, onDiagnostic: diagnose });
    try {
      if (!response.body) throw new Error('no body');
      for await (const event of readSse(response.body, controller.signal)) {
        if (!sink.active) break;
        for (const aiEvent of reader.read(event)) sink.push(aiEvent);
        if (reader.done) break;
      }
    } catch {
      // A broken connection: the attempt becomes interrupted through close() below.
    } finally {
      if (connections.get(sink.target.attemptId) === controller)
        connections.delete(sink.target.attemptId);
      if (!controller.signal.aborted) sink.close();
    }
  };

  const open = async (url: string, init: RequestInit, sink: EventSink, replay: boolean) => {
    connections.get(sink.target.attemptId)?.abort();
    const controller = new AbortController();
    connections.set(sink.target.attemptId, controller);
    const response = await doFetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw HTTP_ERROR(response.status);
    if (response.status === 204) {
      sink.close();
      return;
    }
    if (response.headers.get(UI_MESSAGE_STREAM_HEADER) !== UI_MESSAGE_STREAM_VERSION)
      diagnose({
        code: 'ui-stream.header',
        message: `Missing ${UI_MESSAGE_STREAM_HEADER}: ${UI_MESSAGE_STREAM_VERSION}.`,
      });
    void pump(response, sink, replay, controller);
  };

  const json = (body: JsonValue) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', ...options.headers?.() },
    body: JSON.stringify(body),
  });

  return {
    capabilities,
    async send(request, sink) {
      const body =
        options.body?.(request) ??
        ({
          id: request.conversationId,
          messageId: request.messageId,
          trigger:
            request.relation === 'regenerate' || request.relation === 'retry'
              ? 'regenerate-message'
              : 'submit-message',
          messages: [...request.history, request.prompt].map(toUiMessage),
        } as JsonValue);
      await open(options.api, json(body), sink, false);
    },
    disconnect(target) {
      connections.get(target.attemptId)?.abort();
      connections.delete(target.attemptId);
    },
    ...(options.resumeApi
      ? {
          async resume(target: AttemptTarget, sink: EventSink) {
            const url = (options.resumeApi as (t: AttemptTarget) => string)(target);
            await open(url, { method: 'GET', headers: { ...options.headers?.() } }, sink, true);
          },
        }
      : {}),
    ...(options.stopApi
      ? {
          async stop(target: AttemptTarget): Promise<StopOutcome> {
            const url = (options.stopApi as (t: AttemptTarget) => string)(target);
            const response = await doFetch(
              url,
              json({
                conversationId: target.conversationId,
                runId: target.runId,
                attemptId: target.attemptId,
              }),
            );
            if (!response.ok) throw HTTP_ERROR(response.status);
            const result = (await response.json().catch(() => ({}))) as { status?: unknown };
            return result.status === 'cancelled' ||
              result.status === 'already-finished' ||
              result.status === 'not-found'
              ? result.status
              : 'unknown';
          },
        }
      : {}),
    ...(options.decideApi
      ? {
          async decide(decision: ApprovalDecision): Promise<DecisionOutcome> {
            const url = (options.decideApi as (d: ApprovalDecision) => string)(decision);
            const response = await doFetch(url, json({ ...decision } as unknown as JsonValue));
            if (!response.ok) throw HTTP_ERROR(response.status);
            const result = (await response.json().catch(() => ({}))) as { status?: unknown };
            if (
              result.status === 'accepted' ||
              result.status === 'stale' ||
              result.status === 'expired'
            )
              return result.status;
            throw toPublicError(undefined, {
              code: 'ai.approval.response',
              message: 'The decision response was not understood.',
            });
          },
        }
      : {}),
  };
}
