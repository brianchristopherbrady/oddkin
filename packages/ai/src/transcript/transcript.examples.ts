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
  editable: {
    label: 'Correct the transcript',
    props: {
      segments: [
        { id: 'a', text: 'Schedule a review for Thursday.', final: true },
        { id: 'b', text: 'Invite the decline team.', final: true },
      ],
      editable: true,
    },
    guidance:
      'Each final segment is a field. A correction sends `odd-transcript-change`; the host keeps it in its own record and passes back the segments.',
    // The host: keeps each correction in its record of the segments.
    fixture({ scope, element }) {
      scope.listen<GlobalEventHandlersEventMap['odd-transcript-change']>(
        element,
        'odd-transcript-change',
        ({ detail }) => {
          element.segments = element.segments.map((segment) =>
            segment.id === detail.segmentId ? { ...segment, text: detail.text } : segment,
          );
        },
      );
    },
  },
});
