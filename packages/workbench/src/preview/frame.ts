import { createScope, type Scope } from '@oddkin/core/scope';
import {
  FRAME_PROTOCOL_VERSION,
  frameEnvelope,
  isCompatibleFrameMessage,
  isFrameMessage,
  isFrameReply,
  isFrameRequest,
  type FrameIdentity,
  type FrameNotification,
  type FrameRequest,
  type FrameRequestPayload,
  type JsonValue,
} from '../protocol/index.js';

const protocolStats = { liveFrames: 0, rejectedMessages: 0, staleMessages: 0, disposedMessages: 0 };
let nextFrameId = 0;
const isObjectPayload = (
  value: JsonValue | undefined,
): value is { readonly [key: string]: JsonValue } =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Counts protocol rejections and live host frames; resource ownership is also measured by `scopeStats()`. */
export function previewProtocolStats(): Readonly<typeof protocolStats> {
  return { ...protocolStats };
}

export interface IsolatedPreviewOptions {
  readonly document: Document;
  readonly container: Element;
  /** Same-origin URL of the generated frame document. */
  readonly frameUrl: string;
  readonly title: string;
  readonly generation?: number;
  readonly timeoutMs?: number;
  readonly onMessage?: (message: FrameNotification) => void;
}

export interface IsolatedPreview {
  readonly iframe: HTMLIFrameElement;
  readonly identity: FrameIdentity;
  readonly ready: Promise<void>;
  request(
    kind: FrameRequest['kind'],
    payload?: FrameRequestPayload,
  ): Promise<JsonValue | undefined>;
  setViewport(width: number, height: number): void;
  /** Replace the frame document and advance its generation. */
  reload(): Promise<void>;
  dispose(): void;
}

export class PreviewFrameError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PreviewFrameError';
  }
}

/** Create one same-origin, independently registered preview frame. */
export function createIsolatedPreview(options: IsolatedPreviewOptions): IsolatedPreview {
  const { document: doc, container } = options;
  const win = doc.defaultView;
  if (!win) throw new Error('A preview frame needs a live owner document.');
  const frameUrl = new URL(options.frameUrl, doc.baseURI);
  if (frameUrl.origin !== win.location.origin)
    throw new TypeError('Preview frames must use the Workbench origin.');

  const frame = `preview-${++nextFrameId}`;
  let generation = options.generation ?? 1;
  if (!Number.isSafeInteger(generation) || generation < 1)
    throw new TypeError('Preview generation must be a positive integer.');

  const scope: Scope = createScope({
    name: `preview-host:${frame}:${generation}`,
  });
  const iframe = doc.createElement('iframe');
  iframe.title = options.title;
  iframe.style.cssText = 'display:block;inline-size:100%;block-size:24rem;border:0;';
  container.append(iframe);
  protocolStats.liveFrames++;
  scope.add(() => {
    protocolStats.liveFrames--;
    iframe.remove();
  }, 'preview frame');

  let port: MessagePort | undefined;
  let generationScope: Scope | undefined;
  let nextRequestId = 0;
  let connected = false;
  let ready: Promise<void>;
  let finishReady: (error?: Error) => void = () => {};
  let cancelHandshake = () => {};
  const pending = new Map<
    number,
    { resolve: (value: JsonValue | undefined) => void; reject: (error: Error) => void }
  >();
  const expectedOrigin = frameUrl.origin;
  const identity = (): FrameIdentity => ({ frame, generation });
  const rejectPending = (error: Error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  scope.add(() => {
    const error = new PreviewFrameError('frame.disposed', 'The preview frame was disposed.');
    finishReady(error);
    rejectPending(error);
    generationScope?.dispose(error);
  }, 'pending frame requests');

  const fail = (error: Error) => {
    finishReady(error);
    scope.dispose(error);
  };

  const startGeneration = () => {
    const current = identity();
    const currentScope = scope.child({
      name: `preview-host:${current.frame}:${current.generation}`,
    });
    generationScope = currentScope;
    connected = false;
    ready = new Promise<void>((resolve, reject) => {
      let settled = false;
      finishReady = (error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };
    });
    const url = new URL(frameUrl);
    url.searchParams.set('frame', current.frame);
    url.searchParams.set('generation', String(current.generation));
    cancelHandshake = currentScope.timeout(
      () =>
        fail(
          new PreviewFrameError(
            'frame.handshake.timeout',
            `Frame did not connect within ${timeoutMs} ms.`,
          ),
        ),
      timeoutMs,
    );
    currentScope.add(() => cancelHandshake(), 'handshake timeout');
    iframe.src = url.href;
  };

  scope.listen(win, 'message', (event: MessageEvent) => {
    const currentScope = generationScope;
    const currentIdentity = identity();
    if (scope.disposed || !currentScope || currentScope.disposed) {
      protocolStats.disposedMessages++;
      return;
    }
    if (event.source !== iframe.contentWindow || event.origin !== expectedOrigin) {
      protocolStats.rejectedMessages++;
      return;
    }
    const message: unknown = event.data;
    if (!isFrameMessage(message) || message.kind !== 'hello') {
      protocolStats.rejectedMessages++;
      return;
    }
    if (message.version !== FRAME_PROTOCOL_VERSION) {
      fail(
        new PreviewFrameError(
          'frame.version.incompatible',
          `Frame protocol ${message.version} is incompatible with host protocol ${FRAME_PROTOCOL_VERSION}.`,
        ),
      );
      return;
    }
    if (
      message.frame !== currentIdentity.frame ||
      message.generation !== currentIdentity.generation
    ) {
      protocolStats.staleMessages++;
      return;
    }
    if (connected) {
      protocolStats.rejectedMessages++;
      return;
    }
    const Channel = win.MessageChannel;
    if (!Channel) {
      fail(new PreviewFrameError('frame.channel.unavailable', 'MessageChannel is unavailable.'));
      return;
    }
    const channel = new Channel();
    port = channel.port1;
    connected = true;
    currentScope.add(() => channel.port1.close(), 'preview message port');
    currentScope.listen(port, 'message', (portEvent: MessageEvent) => {
      if (scope.disposed || currentScope.disposed) {
        protocolStats.disposedMessages++;
        return;
      }
      const incoming: unknown = portEvent.data;
      if (
        !isCompatibleFrameMessage(incoming) ||
        incoming.frame !== currentIdentity.frame ||
        incoming.generation !== currentIdentity.generation
      ) {
        protocolStats.staleMessages++;
        return;
      }
      if (isFrameReply(incoming)) {
        const request = pending.get(incoming.replyTo);
        if (!request) {
          protocolStats.rejectedMessages++;
          return;
        }
        pending.delete(incoming.replyTo);
        if (incoming.error)
          request.reject(new PreviewFrameError(incoming.error.code, incoming.error.message));
        else request.resolve(incoming.payload);
      } else if (
        incoming.kind === 'event' ||
        incoming.kind === 'error' ||
        incoming.kind === 'state' ||
        incoming.kind === 'size'
      ) {
        if (
          incoming.kind === 'state' &&
          isObjectPayload(incoming.payload) &&
          incoming.payload['connected'] === true
        ) {
          finishReady();
          cancelHandshake();
        }
        options.onMessage?.(incoming);
      } else protocolStats.rejectedMessages++;
    });
    port.start();
    const connect = frameEnvelope(currentIdentity, 'connect');
    iframe.contentWindow?.postMessage(connect, expectedOrigin, [channel.port2]);
  });

  const timeoutMs = options.timeoutMs ?? 10_000;
  startGeneration();

  return {
    iframe,
    get identity() {
      return identity();
    },
    get ready() {
      return ready;
    },
    async request(kind, payload) {
      const requestIdentity = identity();
      const requestReady = ready;
      await requestReady;
      if (identity().generation !== requestIdentity.generation)
        throw new PreviewFrameError(
          'frame.generation.superseded',
          'The preview frame was replaced.',
        );
      if (scope.disposed || !port)
        throw new PreviewFrameError('frame.disposed', 'The preview frame is not connected.');
      const id = ++nextRequestId;
      return new Promise<JsonValue | undefined>((resolve, reject) => {
        const releaseTimer = scope.timeout(() => {
          pending.delete(id);
          reject(new PreviewFrameError('frame.request.timeout', `Frame request ${id} timed out.`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (value) => {
            releaseTimer();
            resolve(value);
          },
          reject: (error) => {
            releaseTimer();
            reject(error);
          },
        });
        const request = {
          ...frameEnvelope(requestIdentity, kind),
          id,
          ...(payload === undefined ? {} : { payload }),
        };
        if (!isFrameRequest(request)) {
          pending.delete(id);
          releaseTimer();
          reject(new TypeError(`Invalid ${kind} frame request payload.`));
          return;
        }
        port?.postMessage(request);
      });
    },
    setViewport(width, height) {
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0)
        throw new RangeError('Preview viewport dimensions must be positive finite numbers.');
      iframe.style.inlineSize = `${width}px`;
      iframe.style.blockSize = `${height}px`;
      iframe.width = String(Math.round(width));
      iframe.height = String(Math.round(height));
    },
    reload() {
      if (scope.disposed)
        return Promise.reject(
          new PreviewFrameError('frame.disposed', 'The preview frame is not connected.'),
        );
      const error = new PreviewFrameError(
        'frame.generation.superseded',
        'The preview frame was replaced by a new generation.',
      );
      finishReady(error);
      rejectPending(error);
      generationScope?.dispose(error);
      port = undefined;
      generation++;
      startGeneration();
      return ready;
    },
    dispose() {
      scope.dispose();
    },
  };
}
