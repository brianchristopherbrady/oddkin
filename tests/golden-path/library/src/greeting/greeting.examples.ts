import { defineExamples } from '@oddkin/workbench/examples';
// Brings <acme-greeting> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './greeting.js';

export default defineExamples('acme-greeting', {
  default: {
    label: 'Default',
    props: { name: 'Ada' },
    recommended: true,
    preset: true,
  },
});
