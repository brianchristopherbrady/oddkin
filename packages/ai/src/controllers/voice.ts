/**
 * Voice capture and transcription with replaceable adapters. The controller owns one session at
 * a time, ignores callbacks from ended sessions, and releases the session on stop, cancel, and
 * dispose. Browser speech recognition is one optional adapter (`@oddkin/ai/voice/web-speech`);
 * recorder-plus-transcription and scripted adapters use the same contract. DOM-free.
 * Contract: docs/architecture/ai-interaction.md §8.4.
 */
import { signal, type Readable, type Signal } from '@oddkin/core/reactive';
import type { TranscriptSegment } from '../contracts/types.js';
import { createId } from '../internal/ids.js';

export type VoiceStatus =
  | 'unsupported'
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'processing'
  | 'denied'
  | 'unavailable'
  | 'interrupted'
  | 'error';

export type VoiceErrorCode =
  'permission-denied' | 'no-device' | 'network' | 'interrupted' | 'other';

export interface VoiceHandlers {
  /** Capture started (permission granted, device open). */
  started(): void;
  interim(text: string): void;
  final(text: string): void;
  /** Recording ended; transcription of buffered audio may still follow. */
  processing(): void;
  /** The session ended. `stopped` after final results, `cancelled` on discard. */
  ended(reason: 'stopped' | 'cancelled' | 'error', error?: VoiceErrorCode): void;
}

export interface VoiceSession {
  /** Finish: deliver remaining final text, then end with `stopped`. */
  stop(): void;
  /** Discard: release resources immediately; no further callbacks. */
  cancel(): void;
}

export interface VoiceAdapter {
  /** Feature detection result; false makes the voice capability unavailable. */
  readonly supported: boolean;
  start(handlers: VoiceHandlers): VoiceSession;
}

export interface VoiceState {
  readonly status: VoiceStatus;
  readonly interim: string;
  readonly segments: readonly TranscriptSegment[];
  readonly error?: VoiceErrorCode | undefined;
}

const STATUS_FOR_ERROR: Record<VoiceErrorCode, VoiceStatus> = {
  'permission-denied': 'denied',
  'no-device': 'unavailable',
  network: 'error',
  interrupted: 'interrupted',
  other: 'error',
};

export class VoiceController {
  readonly #state: Signal<VoiceState>;
  readonly state: Readable<VoiceState>;
  #adapter: VoiceAdapter | undefined;
  #session: VoiceSession | undefined;
  #generation = 0;

  constructor(adapter?: VoiceAdapter) {
    this.#adapter = adapter;
    this.#state = signal<VoiceState>({
      status: adapter?.supported ? 'idle' : 'unsupported',
      interim: '',
      segments: [],
    });
    this.state = this.#state;
  }

  getSnapshot(): VoiceState {
    return this.#state.peek();
  }

  /** Replace the adapter; any running session is cancelled. */
  setAdapter(adapter: VoiceAdapter | undefined): void {
    this.cancel();
    this.#adapter = adapter;
    this.#set({ status: adapter?.supported ? 'idle' : 'unsupported', interim: '' });
  }

  get active(): boolean {
    return this.#session !== undefined;
  }

  start(): boolean {
    const adapter = this.#adapter;
    if (!adapter?.supported || this.#session) return false;
    const generation = ++this.#generation;
    const live = () => generation === this.#generation;
    this.#set({ status: 'requesting-permission', interim: '', error: undefined });
    const session = adapter.start({
      started: () => live() && this.#set({ status: 'recording' }),
      interim: (text) => live() && this.#set({ interim: text }),
      final: (text) => {
        if (!live() || !text) return;
        const now = this.#state.peek();
        this.#set({
          interim: '',
          segments: [...now.segments, { id: createId('segment'), text, final: true }],
        });
      },
      processing: () => live() && this.#set({ status: 'processing' }),
      ended: (reason, error) => {
        if (!live()) return;
        this.#session = undefined;
        this.#generation++;
        if (reason === 'error')
          this.#set({
            status: STATUS_FOR_ERROR[error ?? 'other'],
            interim: '',
            error: error ?? 'other',
          });
        else this.#set({ status: 'idle', interim: '' });
      },
    });
    // An adapter may end synchronously (e.g. no device); never keep a dead session.
    if (live()) this.#session = session;
    return true;
  }

  /** Finish recording and keep the final transcript. */
  stop(): void {
    this.#session?.stop();
  }

  /** Discard the current recording and interim text; final segments already received stay. */
  cancel(): void {
    const session = this.#session;
    if (!session) return;
    this.#session = undefined;
    this.#generation++;
    session.cancel();
    this.#set({ status: 'idle', interim: '' });
  }

  /** Replace or edit the transcript (user edits). */
  setSegments(segments: readonly TranscriptSegment[]): void {
    this.#set({ segments });
  }

  clear(): void {
    this.#set({ segments: [], interim: '' });
  }

  dispose(): void {
    this.cancel();
    this.#adapter = undefined;
  }

  #set(patch: Partial<VoiceState>): void {
    this.#state.value = { ...this.#state.peek(), ...patch } as VoiceState;
  }
}

/** One step of a scripted session: wait `after` ms, then deliver one result or outcome. */
export type VoiceScriptStep =
  | { readonly after: number; readonly interim: string }
  | { readonly after: number; readonly final: string }
  | { readonly after: number; readonly error: VoiceErrorCode };

export interface ScriptedVoiceAdapter extends VoiceAdapter {
  /** Timers and sessions currently held (zero after every session ends). */
  readonly openResources: number;
}

/**
 * A deterministic adapter for tests and demos (clearly simulated). `denyPermission` and
 * `noDevice` reproduce the matching failures before capture starts.
 */
export function createScriptedVoiceAdapter(
  script: readonly VoiceScriptStep[],
  options: { denyPermission?: boolean; noDevice?: boolean; permissionDelay?: number } = {},
): ScriptedVoiceAdapter {
  let open = 0;
  return {
    supported: true,
    get openResources() {
      return open;
    },
    start(handlers) {
      const timers = new Set<ReturnType<typeof setTimeout>>();
      let ended = false;
      open++;
      const schedule = (ms: number, fn: () => void) => {
        const id = setTimeout(() => {
          timers.delete(id);
          if (!ended) fn();
        }, ms);
        timers.add(id);
      };
      const finish = (reason: 'stopped' | 'cancelled' | 'error', error?: VoiceErrorCode) => {
        if (ended) return;
        ended = true;
        for (const id of timers) clearTimeout(id);
        timers.clear();
        open--;
        if (reason !== 'cancelled') handlers.ended(reason, error);
      };
      schedule(options.permissionDelay ?? 0, () => {
        if (options.denyPermission) return finish('error', 'permission-denied');
        if (options.noDevice) return finish('error', 'no-device');
        handlers.started();
        let at = 0;
        for (const step of script) {
          at += step.after;
          schedule(at, () => {
            if ('interim' in step) handlers.interim(step.interim);
            else if ('final' in step) handlers.final(step.final);
            else finish('error', step.error);
          });
        }
      });
      return {
        stop() {
          if (ended) return;
          handlers.processing();
          schedule(0, () => finish('stopped'));
        },
        cancel() {
          finish('cancelled');
        },
      };
    },
  };
}
