import { defineExamples } from '@oddkin/workbench/examples';
import type {} from './transcript.js';

export default defineExamples('odd-transcript', {
  default: {
    label: 'Live transcript',
    props: {
      segments: [
        { id: 'a', text: 'Schedule a review for Thursday.', final: true },
        { id: 'b', text: 'Invite the design team.', final: true },
      ],
      interim: 'and add the',
    },
    recommended: true,
    guidance: 'Interim text may still change and is shown apart from final segments.',
  },
});
