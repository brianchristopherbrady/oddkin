import { defineExamples } from '@oddkin/workbench/examples';
import { html } from '@oddkin/core/template';
import { createScriptedVoiceAdapter } from '@oddkin/ai/controllers';
import type {} from './voice-input.js';

// What the scripted adapter hears once started: clearly simulated, the same every time.
const heard = [
  { after: 300, interim: 'Summarize' },
  { after: 300, interim: 'Summarize the release' },
  { after: 300, final: 'Summarize the release notes.' },
];

export default defineExamples('odd-voice-input', {
  default: {
    label: 'Speak into a message',
    props: { adapter: createScriptedVoiceAdapter(heard) },
    recommended: true,
    guidance:
      'Nothing listens until the user starts it, and the element releases the session when removed. A scripted adapter stands in for the microphone here; Use transcript sends what it heard as `odd-voice-transcript`, and the host puts it in its own field.',
    // The host: a message field that takes each transcript the user chooses to use.
    fixture({ scope, element, mount }) {
      const field = mount(
        html`<odd-textarea label="Message" rows="2" resize="auto"></odd-textarea>`,
      ) as HTMLElement & { value: string };
      scope.listen(element, 'odd-voice-transcript', (event) => {
        const { text } = (event as CustomEvent<{ readonly text: string }>).detail;
        field.value = field.value ? `${field.value} ${text}` : text;
      });
    },
  },
});
