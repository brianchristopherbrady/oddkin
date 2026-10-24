import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-toast> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './toast.js';

export default defineExamples('odd-toast', {
  default: {
    label: 'A result with Undo',
    previewRoles: ['toast'],
    props: { label: 'Invitation sent', tone: 'success' },
    slots: { default: 'Alex can now join the workspace.' },
    recommended: true,
    preset: true,
    guidance:
      'Show it with `show()` after the action it reports, and place it after the control that caused it, so Tab reaches its action. With an action in the `end` slot it stays until it is closed (WCAG 2.2.1); keep the action available elsewhere on the page too. Open toasts stack in document order, the last at the corner: insert a new toast before the open ones and it stacks above them, leaving them where they are.',
    fixture({ element, mount, scope }) {
      const parts = mount(
        html`<div>
          <odd-button>Send invitation</odd-button>
          <odd-button slot="end" appearance="ghost">Undo</odd-button>
        </div>`,
      );
      const [trigger, action] = [...parts.children];
      element.before(trigger!);
      element.append(action!);
      parts.remove();
      scope.listen(trigger!, 'click', () => element.show());
      scope.listen(action!, 'click', () => element.close());
    },
  },
  danger: {
    label: 'A failure with Retry',
    props: { label: 'Invitation was not sent', tone: 'danger' },
    slots: { default: 'Your draft has been kept.' },
    guidance:
      '`tone="danger"` is announced at once rather than politely. Say what was kept and offer the way forward.',
    fixture({ element, mount, scope }) {
      const parts = mount(
        html`<div>
          <odd-button>Send invitation</odd-button>
          <odd-button slot="end" appearance="ghost">Retry</odd-button>
        </div>`,
      );
      const [trigger, action] = [...parts.children];
      element.before(trigger!);
      element.append(action!);
      parts.remove();
      scope.listen(trigger!, 'click', () => element.show());
    },
  },
  timed: {
    label: 'Closes by itself',
    props: { label: 'Link copied', duration: 6000 },
    guidance:
      'Without an action it closes after `duration` milliseconds (5,000 by default), counted only while the pointer is off it, focus is outside it, and the page is visible. Use 0 to keep it until it is closed.',
    fixture({ element, mount, scope }) {
      const parts = mount(html`<div><odd-button>Copy link</odd-button></div>`);
      const trigger = parts.firstElementChild!;
      element.before(trigger);
      parts.remove();
      scope.listen(trigger, 'click', () => element.show());
    },
  },
  errorTone: {
    label: 'tone="error"',
    attributes: { label: 'Invitation was not sent', tone: 'error' },
    slots: { default: 'Your draft has been kept.' },
    incorrect: {
      explanation:
        'The tones are `neutral`, `info`, `success`, `warning`, and `danger`: a failure is `danger`, which is also announced at once. An unknown value is reported, and the toast is neutral and polite.',
      diagnostic: 'usage.attribute.value',
      correct: 'danger',
    },
  },
});
