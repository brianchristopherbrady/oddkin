import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import { createScriptedVoiceAdapter, type VoiceScriptStep } from '@oddkin/ai/controllers';
import type {} from './voice-input.js';

// What the scripted adapter hears once started: clearly simulated, the same every time.
const heard: readonly VoiceScriptStep[] = [
  { after: 300, interim: 'Summarize' },
  { after: 300, interim: 'Summarize the release' },
  { after: 300, final: 'Summarize the release notes.' },
];

export default defineExamples('odd-voice-input', {
  default: {
    label: 'Speak into a message',
    recommended: true,
    guidance:
      'Nothing listens until the user starts it, and the element releases the session when removed. The host gives it an adapter: here a scripted one stands in for the microphone. Use transcript sends what it heard as `odd-voice-transcript`, and the host puts it in its own field.',
    // The host: the adapter, and a message field that takes each transcript the user uses.
    fixture({ scope, element, mount }) {
      element.adapter = createScriptedVoiceAdapter(heard);
      const field = mount(
        html`<odd-textarea label="Message" rows="2" resize="auto"></odd-textarea>`,
      ) as HTMLElement & { value: string };
      scope.listen<GlobalEventHandlersEventMap['odd-voice-transcript']>(
        element,
        'odd-voice-transcript',
        ({ detail }) => {
          field.value = field.value ? `${field.value} ${detail.text}` : detail.text;
        },
      );
    },
  },
  denied: {
    label: 'Microphone permission denied',
    guidance:
      'The adapter reports that permission was denied: the element says how to allow it, and Start asks again.',
    fixture({ element }) {
      element.adapter = createScriptedVoiceAdapter(heard, { denyPermission: true });
    },
  },
  noDevice: {
    label: 'No microphone',
    guidance: 'The adapter finds no device to record from: the element says so.',
    fixture({ element }) {
      element.adapter = createScriptedVoiceAdapter(heard, { noDevice: true });
    },
  },
  interrupted: {
    label: 'Recording interrupted',
    guidance:
      'The recording stops early, as when another app takes the microphone: the element says so, and what it heard before stays.',
    fixture({ element }) {
      element.adapter = createScriptedVoiceAdapter([
        { after: 300, interim: 'Summarize' },
        { after: 300, final: 'Summarize the release' },
        { after: 300, error: 'interrupted' },
      ]);
    },
  },
  unsupported: {
    label: 'No voice input here',
    guidance:
      'Without an adapter, or with one the browser does not support, voice input is unavailable, and the element says so.',
  },
});
