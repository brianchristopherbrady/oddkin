/**
 * Server-sent events parsing per the WHATWG HTML "event stream interpretation" rules: UTF-8
 * decoding with a streaming decoder (multi-byte characters split across chunks are kept), one
 * leading BOM stripped, CRLF / LF / CR line endings (a CR at a chunk end paired with a LF at the
 * next chunk start counts once), comments, `field: value` with one optional space removed,
 * `data` lines joined with LF, `id` without NULL persisting across events, `retry` digits only,
 * and an unterminated event discarded at end of stream. DOM-free.
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 */

export interface SseEvent {
  /** `event` field, or `message`. */
  readonly type: string;
  readonly data: string;
  /** Last event id buffer at dispatch time (persists across events). */
  readonly lastEventId: string;
}

export class SseParser {
  #buffer = '';
  #pendingCR = false;
  #data = '';
  #hasData = false;
  #type = '';
  #lastEventId = '';
  #started = false;
  readonly #emit: (event: SseEvent) => void;
  readonly #retry: ((ms: number) => void) | undefined;

  constructor(emit: (event: SseEvent) => void, onRetry?: (ms: number) => void) {
    this.#emit = emit;
    this.#retry = onRetry;
  }

  /** Feed decoded text. */
  feed(text: string): void {
    if (!this.#started) {
      this.#started = text.length > 0;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (this.#pendingCR) {
        this.#pendingCR = false;
        if (code === 0x0a && i === start && this.#buffer === '') {
          start = i + 1;
          continue;
        }
      }
      if (code === 0x0a || code === 0x0d) {
        this.#line(this.#buffer + text.slice(start, i));
        this.#buffer = '';
        if (code === 0x0d) {
          if (i + 1 < text.length) {
            if (text.charCodeAt(i + 1) === 0x0a) i++;
          } else this.#pendingCR = true;
        }
        start = i + 1;
      }
    }
    this.#buffer += text.slice(start);
  }

  /** End of stream: a pending, unterminated event is discarded (as the specification requires). */
  end(): void {
    this.#buffer = '';
    this.#data = '';
    this.#hasData = false;
    this.#type = '';
    this.#pendingCR = false;
  }

  #line(line: string): void {
    if (line === '') return this.#dispatch();
    if (line.charCodeAt(0) === 0x3a) return; // comment
    const colon = line.indexOf(':');
    let field = line;
    let value = '';
    if (colon !== -1) {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.charCodeAt(0) === 0x20) value = value.slice(1);
    }
    switch (field) {
      case 'event':
        this.#type = value;
        break;
      case 'data':
        this.#data += `${value}\n`;
        this.#hasData = true;
        break;
      case 'id':
        if (!value.includes('\u0000')) this.#lastEventId = value;
        break;
      case 'retry':
        if (/^[0-9]+$/.test(value)) this.#retry?.(Number(value));
        break;
    }
  }

  #dispatch(): void {
    if (!this.#hasData) {
      this.#type = '';
      return;
    }
    const data = this.#data.endsWith('\n') ? this.#data.slice(0, -1) : this.#data;
    const event = { type: this.#type || 'message', data, lastEventId: this.#lastEventId };
    this.#data = '';
    this.#hasData = false;
    this.#type = '';
    this.#emit(event);
  }
}

/** Synchronous byte-level decoder: push arbitrary byte chunks, receive complete events. */
export function createSseDecoder(onRetry?: (ms: number) => void): {
  push(bytes: Uint8Array): SseEvent[];
  end(): SseEvent[];
} {
  const decoder = new TextDecoder('utf-8');
  let out: SseEvent[] = [];
  const parser = new SseParser((event) => out.push(event), onRetry);
  const take = () => {
    const events = out;
    out = [];
    return events;
  };
  return {
    push(bytes) {
      parser.feed(decoder.decode(bytes, { stream: true }));
      return take();
    },
    end() {
      parser.feed(decoder.decode());
      parser.end();
      return take();
    },
  };
}

/** Read events from a byte stream (e.g. `response.body`). Stops when `signal` aborts. */
export async function* readSse(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent, void, undefined> {
  const reader = stream.getReader();
  const decoder = createSseDecoder();
  const onAbort = () => void reader.cancel(signal?.reason).catch(() => {});
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    for (;;) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      yield* decoder.push(value);
    }
    if (!signal?.aborted) yield* decoder.end();
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
