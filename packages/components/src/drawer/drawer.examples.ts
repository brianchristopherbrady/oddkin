import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-drawer> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './drawer.js';

export default defineExamples('odd-drawer', {
  default: {
    label: 'Details beside the page',
    previewRoles: ['drawer'],
    props: { label: 'Member details' },
    recommended: true,
    preset: true,
    guidance:
      'Open it from a button with `show()`; focus returns to that button when it closes. Wrap the fields in `<form method="dialog">` and give the footer buttons `form` and `value`: submitting closes the drawer, and `returnValue` is the value of the button pressed. It is modal, so the page waits; add `no-modal` when people need to work on the page beside it.',
    fixture({ element, mount, scope }) {
      const parts = mount(
        html`<div>
          <odd-button>Alex Morgan</odd-button>
          <form id="member-form" method="dialog">
            <odd-select label="Role" name="role" description="Can create and edit projects.">
              <option value="viewer">Viewer</option>
              <option value="editor" selected>Workspace editor</option>
              <option value="admin">Administrator</option>
            </odd-select>
          </form>
          <odd-button slot="footer" type="submit" form="member-form" value="cancel" formnovalidate
            >Cancel</odd-button
          >
          <odd-button
            slot="footer"
            type="submit"
            form="member-form"
            value="save"
            appearance="primary"
            >Save</odd-button
          >
        </div>`,
      );
      const [trigger, ...content] = [...parts.children];
      element.before(trigger!);
      element.append(...content);
      parts.remove();
      scope.listen(trigger!, 'click', () => element.show());
    },
  },
  inlineStart: {
    label: 'At the inline start',
    props: { label: 'Filters', side: 'inline-start' },
    slots: { default: 'Narrow the list by owner, status, and date.' },
    guidance:
      '`side="inline-start"` opens it at the left in left-to-right text and at the right in right-to-left text, following the page.',
    fixture({ element, mount, scope }) {
      const parts = mount(html`<div><odd-button>Filters</odd-button></div>`);
      const trigger = parts.firstElementChild!;
      element.before(trigger);
      parts.remove();
      scope.listen(trigger, 'click', () => element.show());
    },
  },
  nonModal: {
    label: 'Non-modal',
    props: { label: 'Comments', noModal: true, closedBy: 'any' },
    slots: { default: 'Comments stay open while you edit the page beside them.' },
    preset: true,
    guidance:
      '`no-modal` leaves the page usable: no backdrop, and focus may leave the drawer. Escape still closes it, and with `closedby="any"` so does a press outside it.',
    fixture({ element, mount, scope }) {
      const parts = mount(html`<div><odd-button>Comments</odd-button></div>`);
      const trigger = parts.firstElementChild!;
      element.before(trigger);
      parts.remove();
      scope.listen(trigger, 'click', () => element.show());
    },
  },
  physicalSide: {
    label: 'side="left"',
    attributes: { side: 'left', label: 'Filters' },
    slots: { default: 'Narrow the list by owner, status, and date.' },
    incorrect: {
      explanation:
        'Sides are logical, so the drawer mirrors in right-to-left text: `inline-start` or `inline-end`. An unknown value is reported, and the drawer opens at the inline end.',
      diagnostic: 'usage.attribute.value',
      correct: 'inlineStart',
    },
  },
});
