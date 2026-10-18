/**
 * `@oddkin/ai/voice/web-speech` — optional adapter over the browser Web Speech API
 * (`SpeechRecognition`), feature-detected. Not the only path: `createRecorderAdapter` captures
 * audio for any transcription service, and any `VoiceAdapter` can replace both.
 */
import type {
  VoiceAdapter,
  VoiceErrorCode,
  VoiceHandlers,
  VoiceSession,
} from '../controllers/voice.js';

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface Recognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const ERRORS: Record<string, VoiceErrorCode> = {
  'not-allowed': 'permission-denied',
  'service-not-allowed': 'permission-denied',
  'audio-capture': 'no-device',
  network: 'network',
  aborted: 'interrupted',
};

function recognitionConstructor(): RecognitionCtor | undefined {
  const scope = globalThis as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

export function createWebSpeechAdapter(options: { lang?: string } = {}): VoiceAdapter {
  const Ctor = recognitionConstructor();
  return {
    supported: !!Ctor,
    start(handlers: VoiceHandlers): VoiceSession {
      if (!Ctor) {
        queueMicrotask(() => handlers.ended('error', 'no-device'));
        return { stop() {}, cancel() {} };
      }
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      if (options.lang) recognition.lang = options.lang;
      let ended = false;
      let failure: VoiceErrorCode | undefined;
      let cancelled = false;
      const listeners: [string, EventListener][] = [
        ['start', () => handlers.started()],
        [
          'result',
          (event) => {
            const e = event as unknown as {
              resultIndex: number;
              results: ArrayLike<RecognitionResult>;
            };
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const result = e.results[i] as RecognitionResult;
              if (result.isFinal) handlers.final(result[0].transcript.trim());
              else interim += result[0].transcript;
            }
            handlers.interim(interim);
          },
        ],
        [
          'error',
          (event) => (failure = ERRORS[(event as unknown as { error: string }).error] ?? 'other'),
        ],
        [
          'end',
          () => {
            if (ended) return;
            ended = true;
            release();
            if (!cancelled) handlers.ended(failure ? 'error' : 'stopped', failure);
          },
        ],
      ];
      const release = () => {
        for (const [type, listener] of listeners) recognition.removeEventListener(type, listener);
      };
      for (const [type, listener] of listeners) recognition.addEventListener(type, listener);
      recognition.start();
      return {
        stop() {
          if (!ended) {
            handlers.processing();
            recognition.stop();
          }
        },
        cancel() {
          cancelled = true;
          if (!ended) {
            ended = true;
            release();
            recognition.abort();
          }
        },
      };
    },
  };
}
