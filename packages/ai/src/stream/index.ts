/**
 * `@oddkin/ai/stream` — SSE parsing, the AI SDK UI message stream adapter, and the deterministic
 * simulation transport. DOM-free.
 */
export { SseParser, createSseDecoder, readSse } from './sse.js';
export type { SseEvent } from './sse.js';
export {
  UI_MESSAGE_STREAM_HEADER,
  UI_MESSAGE_STREAM_VERSION,
  UiMessageStreamReader,
  createUiMessageStreamTransport,
  toUiMessage,
} from './ui-message-stream.js';
export type { StreamDiagnostic, UiMessageStreamTransportOptions } from './ui-message-stream.js';
export { chunkText, createSimulatedTransport, streamTextSteps } from './simulation.js';
export type {
  Script,
  ScriptStep,
  SimulatedTransport,
  SimulationControls,
  SimulationOptions,
} from './simulation.js';
