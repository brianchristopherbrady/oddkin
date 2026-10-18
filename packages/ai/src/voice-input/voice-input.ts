import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { VoiceController, type VoiceAdapter, type VoiceState } from '../controllers/voice.js';
import { announceEvent, voiceTranscriptEvent } from '../events.js';
import { strings } from '../internal/strings.js';

export const VOICE_INPUT_STRINGS = {
  start: 'Start voice input',
  stop: 'Stop recording',
  cancel: 'Cancel recording',
  use: 'Use transcript',
  clear: 'Clear',
  unsupported: 'Voice input is not available in this browser or app.',
  idle: '',
  'requesting-permission': 'Waiting for microphone permission…',
  recording: 'Listening…',
  processing: 'Transcribing…',
  denied: 'Microphone permission was denied. Allow it in your browser settings to use voice input.',
  unavailable: 'No microphone is available.',
  interrupted: 'Recording was interrupted.',
  error: 'Voice input failed. Try again.',
};

/**
 * Voice capture with transcription: start, stop (keep), and cancel (discard), with permission,
 * device, interruption, and processing states. Uses a replaceable `VoiceAdapter`; an element
 * that creates its own controller releases the microphone when disconnected.
 *
 * @csspart controls - Record, cancel, and use controls.
 * @csspart status - Status text.
 * @a11y The record control is a toggle button (`aria-pressed`). Status changes (denied, interrupted) are announced once through the surface's announcer; interim text is never announced.
 * @keyboard Enter or Space starts and stops recording; Escape cancels while recording.
 * @useFor Dictating prompts or notes.
 * @notFor Audio recording for its own sake.
 * @limitation Capability depends on the adapter: browser speech recognition, a recorder plus host transcription, or a scripted adapter.
 * @category AI
 */
export class OddkinVoiceInput extends OddkinElement.with({
  adapter: prop.object<VoiceAdapter>({
    description: 'Capture and transcription adapter (owned controller only).',
  }),
  controller: prop.object<VoiceController>({
    description: 'Host-owned controller; the host also owns its cleanup.',
  }),
  disabled: prop.boolean({
    reflect: true,
    description: 'Voice input is unavailable (e.g. capability off).',
  }),
  strings: prop.object<Partial<typeof VOICE_INPUT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'voice-transcript': voiceTranscriptEvent,
    'ai-announce': announceEvent,
  };

  #owned: VoiceController | undefined;
  /** @internal Mirror of the active controller state. */
  readonly _state = signal<VoiceState>({ status: 'unsupported', interim: '', segments: [] });

  /** @internal */
  get _strings(): typeof VOICE_INPUT_STRINGS {
    return strings(VOICE_INPUT_STRINGS, this.strings);
  }

  /** The controller in use (host-supplied or owned). */
  get activeController(): VoiceController {
    return this.controller ?? (this.#owned ??= new VoiceController(this.adapter));
  }

  /** @internal */
  readonly _toggle = (): void => {
    const controller = this.activeController;
    if (this.disabled) return;
    if (controller.active) controller.stop();
    else controller.start();
  };
  /** @internal */
  readonly _cancel = (): void => this.activeController.cancel();
  /** @internal */
  readonly _clear = (): void => this.activeController.clear();
  /** @internal */
  readonly _use = (): void => {
    const text = this._state
      .peek()
      .segments.map((s) => s.text)
      .join(' ')
      .trim();
    if (text) this.emit(voiceTranscriptEvent, { text });
  };

  protected override connected(scope: Scope): void {
    scope.listen(this, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.activeController.active) {
        event.stopPropagation();
        this.activeController.cancel();
      }
    });
    scope.effect(
      (run) => {
        if (!this.controller) {
          const adapter = this.adapter;
          if (this.#owned) this.#owned.setAdapter(adapter);
          else this.#owned = new VoiceController(adapter);
        }
        const controller = this.activeController;
        let previous: VoiceState['status'] | undefined;
        run.effect(() => {
          const state = controller.state.value;
          this._state.value = state;
          const t = this._strings;
          if (
            previous &&
            previous !== state.status &&
            ['denied', 'unavailable', 'interrupted', 'error'].includes(state.status)
          )
            this.emit(announceEvent, {
              text: t[state.status],
              priority: 'polite',
              key: `voice:${state.status}:${Date.now()}`,
            });
          previous = state.status;
        });
      },
      { name: '<odd-voice-input> controller' },
    );
    // An owned session never outlives the connection: the microphone is released.
    scope.add(() => this.#owned?.cancel(), 'voice session');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-voice-input': OddkinVoiceInput;
  }
}
