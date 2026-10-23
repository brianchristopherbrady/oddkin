import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-alert> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './alert.js';

export default defineExamples('odd-alert', {
  default: {
    label: 'Neutral',
    previewRoles: ['alert'],
    props: { label: 'A new version is available' },
    slots: { default: 'Refresh when you are ready to continue.' },
    recommended: true,
    preset: true,
  },
  success: {
    label: 'Success',
    props: { tone: 'success', label: 'Changes saved' },
    slots: { default: 'Your workspace is up to date.' },
    preset: true,
  },
  warning: {
    label: 'Warning',
    props: { tone: 'warning', label: 'You are working offline' },
    slots: { default: 'Changes will sync when the connection returns.' },
    preset: true,
  },
  danger: {
    label: 'Danger with an action',
    props: { tone: 'danger', label: 'Changes could not be saved' },
    slots: { default: 'Your draft is safe. Check your connection and retry.' },
    preset: true,
    fixture({ element, mount }) {
      const host = mount(html`<div><odd-button slot="end" size="sm">Try again</odd-button></div>`);
      element.append(host.querySelector('odd-button')!);
      host.remove();
    },
  },
  announced: {
    label: 'Announced',
    props: { tone: 'danger', label: 'Session expired', announce: 'important' },
    slots: { default: 'Sign in again to keep working.' },
    guidance:
      '`announce` makes it an ARIA alert, read out as soon as it appears; reserve it for urgent news.',
  },
  colorOnly: {
    label: 'tone="error"',
    attributes: { tone: 'error' },
    props: { label: 'Changes could not be saved' },
    incorrect: {
      explanation:
        '`tone` accepts neutral, info, success, warning, or danger. "error" is reported and the alert stays neutral; use danger.',
      diagnostic: 'usage.attribute.value',
      correct: 'danger',
    },
  },
});
