import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-avatar> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './avatar.js';

export default defineExamples('odd-avatar', {
  default: {
    label: 'Initials',
    previewRoles: ['avatar'],
    props: { label: 'Amelia Morgan' },
    recommended: true,
    preset: true,
  },
  small: { label: 'Small', props: { label: 'Sam King', size: 'sm' } },
  large: { label: 'Large', props: { label: 'Jo Lee', size: 'lg' } },
  picture: {
    label: 'Picture',
    props: {
      label: 'Noah Diaz',
      src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23b8c4d9"/%3E%3Ccircle cx="20" cy="16" r="7" fill="%235f6b80"/%3E%3Cpath d="M6 40a14 14 0 0 1 28 0" fill="%235f6b80"/%3E%3C/svg%3E',
    },
    guidance: 'If the picture fails to load, the initials of `label` show instead.',
  },
  overflow: {
    label: 'Overflow count',
    props: { label: '3 more members' },
    slots: { default: '+3' },
    guidance: 'At the end of a group of avatars, content inside replaces the initials.',
  },
  decorative: {
    label: 'Beside the name',
    guidance:
      'When the name is written next to it, leave `label` empty: the avatar is hidden from assistive technology.',
    slots: { default: 'AM' },
  },
  nameAttribute: {
    label: '"name" instead of "label"',
    attributes: { name: 'Amelia Morgan' },
    incorrect: {
      explanation:
        '`odd-avatar` takes the name as `label`; without it there are no initials and no accessible name.',
      diagnostic: 'usage.attribute.unknown',
      correct: 'default',
    },
  },
});
