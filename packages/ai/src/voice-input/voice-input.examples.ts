import { defineExamples } from '@oddkin/workbench/examples';
import { createScriptedVoiceAdapter } from '@oddkin/ai/controllers';
import type {} from './voice-input.js';

export default defineExamples('odd-voice-input', {
  default: {
    label: 'Voice input',
    props: { adapter: createScriptedVoiceAdapter([]) },
    recommended: true,
    guidance:
      'Nothing listens until the user starts it; the element releases the session when removed.',
  },
});
