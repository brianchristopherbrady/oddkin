/**
 * `@oddkin/ai/voice/recorder` — capture with `getUserMedia` + `MediaRecorder` and transcribe
 * through any host function (a speech-to-text service). The microphone tracks are stopped on
 * stop, cancel, and errors; no audio leaves the page unless `transcribe` sends it.
 */
import type {
  VoiceAdapter,
  VoiceErrorCode,
  VoiceHandlers,
  VoiceSession,
} from '../controllers/voice.js';

export interface RecorderAdapterOptions {
  /** Turn recorded audio into text. Rejecting reports a `network` error. */
  readonly transcribe: (audio: Blob, signal: AbortSignal) => Promise<string>;
  readonly mimeType?: string;
}

function mediaError(error: unknown): VoiceErrorCode {
  const name = (error as { name?: string } | undefined)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission-denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError')
    return 'no-device';
  return 'other';
}

export function createRecorderAdapter(options: RecorderAdapterOptions): VoiceAdapter {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';
  return {
    supported,
    start(handlers: VoiceHandlers): VoiceSession {
      const abort = new AbortController();
      let stream: MediaStream | undefined;
      let recorder: MediaRecorder | undefined;
      let finished = false;
      const chunks: Blob[] = [];
      const releaseTracks = () => {
        stream?.getTracks().forEach((track) => track.stop());
        stream = undefined;
      };
      const end = (reason: 'stopped' | 'error', error?: VoiceErrorCode) => {
        if (finished) return;
        finished = true;
        releaseTracks();
        handlers.ended(reason, error);
      };
      void navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((media) => {
          if (abort.signal.aborted) {
            media.getTracks().forEach((t) => t.stop());
            return;
          }
          stream = media;
          // Device unplugged or permission revoked mid-recording.
          media
            .getTracks()
            .forEach((t) =>
              t.addEventListener('ended', () => end('error', 'interrupted'), { once: true }),
            );
          recorder = new MediaRecorder(
            media,
            options.mimeType ? { mimeType: options.mimeType } : undefined,
          );
          recorder.addEventListener('dataavailable', (e) => e.data.size && chunks.push(e.data));
          recorder.addEventListener('stop', () => {
            releaseTracks();
            if (abort.signal.aborted || finished) return;
            handlers.processing();
            options
              .transcribe(new Blob(chunks, { type: recorder?.mimeType ?? '' }), abort.signal)
              .then((text) => {
                if (abort.signal.aborted) return;
                if (text) handlers.final(text);
                end('stopped');
              })
              .catch(() => !abort.signal.aborted && end('error', 'network'));
          });
          recorder.start();
          handlers.started();
        })
        .catch((error) => !abort.signal.aborted && end('error', mediaError(error)));
      return {
        stop() {
          if (recorder?.state === 'recording') recorder.stop();
          else if (!recorder) {
            abort.abort();
            end('stopped');
          }
        },
        cancel() {
          finished = true;
          abort.abort();
          if (recorder?.state === 'recording') recorder.stop();
          releaseTracks();
        },
      };
    },
  };
}
