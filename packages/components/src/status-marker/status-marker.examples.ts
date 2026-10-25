import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-status-marker> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './status-marker.js';

export default defineExamples('odd-status-marker', {
  default: {
    label: 'Complete',
    previewRoles: ['statusMarker'],
    props: { status: 'complete' },
    recommended: true,
    preset: true,
    guidance:
      'Use it inside the `.odd-timeline` recipe, and say the status in words beside it: the marker is hidden from assistive technology.',
  },
  step: {
    label: 'Step number',
    slots: { default: '2' },
    preset: true,
    guidance: 'While idle it shows its content: a step number.',
  },
  pending: { label: 'Pending', props: { status: 'pending' }, preset: true },
  failed: { label: 'Failed', props: { status: 'failed' }, preset: true },
  past: {
    label: 'Past event (dot)',
    guidance: 'An empty idle marker shows a dot, for timeline events that need no glyph.',
  },
  statusError: {
    label: 'status="error"',
    attributes: { status: 'error' },
    incorrect: {
      explanation:
        '`status` takes the shared lifecycle values idle, pending, complete, or failed. "error" is reported and the marker stays idle; use failed.',
      diagnostic: 'usage.attribute.value',
      correct: 'failed',
    },
  },
});
