import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-popover> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './popover.js';

export default defineExamples('odd-popover', {
  default: {
    label: 'Opened by a button',
    previewRoles: ['popover'],
    props: { label: 'Share workspace' },
    slots: { default: 'Invite people to collaborate. They get the same access as you.' },
    recommended: true,
    preset: true,
    guidance:
      'Give the popover an id and point a button at it with `popovertarget`: the button opens and closes it with no script, and the popover is placed against it.',
    fixture({ element, mount }) {
      element.id = 'share-workspace';
      const host = mount(html`<div><button popovertarget="share-workspace">Share</button></div>`);
      element.before(...host.children);
      host.remove();
    },
  },
  inlineEnd: {
    label: 'Beside its trigger',
    props: { label: 'Display preferences', side: 'inline-end', align: 'center' },
    slots: { default: 'Choose how this workspace appears.' },
    preset: true,
    guidance:
      "`side` and `align` use the trigger's writing direction: `inline-end` is to the right in English and to the left in Arabic or Hebrew.",
    fixture({ element, mount }) {
      element.id = 'display-preferences';
      const host = mount(
        html`<div><button popovertarget="display-preferences">Display</button></div>`,
      );
      element.before(...host.children);
      host.remove();
    },
  },
  scripted: {
    label: 'Opened from script',
    props: { label: 'Workspace details', noClose: true },
    slots: { default: 'Created by Alex Morgan on 3 March.' },
    guidance:
      'Without `popovertarget`, set `anchorElement` (or `anchor` to an ID) and call `show()` and `close()`. Without the close button, keep another way to close it on touch screens.',
    fixture({ element, mount, scope }) {
      const host = mount(html`<div><button aria-expanded="false">Details</button></div>`);
      const button = host.querySelector('button')!;
      element.anchorElement = button;
      scope.listen(button, 'click', () => element.togglePopover());
      scope.listen<ToggleEvent>(element, 'toggle', (event) =>
        button.setAttribute('aria-expanded', String(event.newState === 'open')),
      );
    },
  },
  openFalse: {
    label: 'open="false"',
    attributes: { open: 'false', label: 'Share workspace' },
    slots: { default: 'Invite people to collaborate.' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: open="false" opens the popover. Leave the attribute out.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
  physicalSide: {
    label: 'side="right"',
    attributes: { side: 'right', align: 'center', label: 'Display preferences' },
    slots: { default: 'Choose how this workspace appears.' },
    incorrect: {
      explanation:
        '`side` is logical, so it follows the writing direction: `inline-end` is to the right in English and to the left in Arabic. An unknown value is reported, and the popover opens below its trigger (`block-end`) instead.',
      diagnostic: 'usage.attribute.value',
      correct: 'inlineEnd',
    },
  },
});
