import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { transcriptDefinition } from '../transcript/transcript.definition.js';
import { OddkinVoiceInput } from './voice-input.js';
import { voiceInputStyles } from './voice-input.styles.js';
import { voiceInputTemplate } from './voice-input.template.js';

export const voiceInputDefinition = compose({
  name: 'odd-voice-input',
  element: OddkinVoiceInput,
  template: voiceInputTemplate,
  styles: [aiBaseStyles, voiceInputStyles],
  dependencies: { transcript: transcriptDefinition },
});
