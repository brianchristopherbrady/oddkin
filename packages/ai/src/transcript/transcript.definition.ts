import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinTranscript } from './transcript.js';
import { transcriptStyles } from './transcript.styles.js';
import { transcriptTemplate } from './transcript.template.js';

export const transcriptDefinition = compose({
  name: 'odd-transcript',
  element: OddkinTranscript,
  template: transcriptTemplate,
  styles: [aiBaseStyles, transcriptStyles],
});
