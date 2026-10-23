import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-dialog> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './dialog.js';

export default defineExamples('odd-dialog', {
  default: {
    label: 'A form in a dialog',
    previewRoles: ['dialog'],
    props: { label: 'Rename workspace' },
    recommended: true,
    preset: true,
    guidance:
      'Wrap the fields in `<form method="dialog">` and give the footer buttons `form` and `value`: submitting closes the dialog, and `returnValue` is the value of the button pressed. Open it from a button with `show()`; focus returns to that button when it closes.',
    fixture({ element, mount, scope }) {
      const parts = mount(
        html`<div>
          <odd-button>Rename</odd-button>
          <form id="rename-form" method="dialog">
            <p>Choose a clear name your team will recognise.</p>
            <odd-input label="Workspace name" name="name" value="Design systems"></odd-input>
          </form>
          <odd-button slot="footer" type="submit" form="rename-form" value="cancel" formnovalidate
            >Cancel</odd-button
          >
          <odd-button
            slot="footer"
            type="submit"
            form="rename-form"
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
  alert: {
    label: 'Alert dialog',
    previewRoles: ['alertDialog'],
    props: { label: 'Delete workspace?', alert: true, noClose: true },
    slots: {
      default:
        'This permanently deletes Field notes and its shared content. This cannot be undone.',
    },
    preset: true,
    guidance:
      '`alert` makes it an alert dialog, described by its body, for a decision that cannot wait. Put `autofocus` on the least destructive action so Enter does not delete by accident.',
    fixture({ element, mount, scope }) {
      const parts = mount(
        html`<div>
          <odd-button>Delete workspace</odd-button>
          <form method="dialog" slot="footer">
            <odd-button type="submit" value="cancel" autofocus>Cancel</odd-button>
            <odd-button type="submit" value="delete" appearance="primary">Delete</odd-button>
          </form>
        </div>`,
      );
      const [trigger, footer] = [...parts.children];
      element.before(trigger!);
      element.append(footer!);
      parts.remove();
      scope.listen(trigger!, 'click', () => element.show());
    },
  },
  closedByAny: {
    label: 'Closed by a press outside',
    props: { label: 'Keyboard shortcuts', closedBy: 'any' },
    slots: { default: 'Press ? anywhere to show this list again.' },
    guidance:
      '`closedby="any"` also closes it on a press on the backdrop, for content that asks for nothing. The default, `closerequest`, closes it on Escape only; `none` leaves only its own controls.',
    fixture({ element, mount, scope }) {
      const parts = mount(html`<div><odd-button>Shortcuts</odd-button></div>`);
      const trigger = parts.firstElementChild!;
      element.before(trigger);
      parts.remove();
      scope.listen(trigger, 'click', () => element.show());
    },
  },
  closedByBackdrop: {
    label: 'closedby="backdrop"',
    attributes: { closedby: 'backdrop', label: 'Keyboard shortcuts' },
    slots: { default: 'Press ? anywhere to show this list again.' },
    incorrect: {
      explanation:
        'The values are those of the native `closedby`: `any`, `closerequest`, and `none`. An unknown value is reported, and the dialog closes on Escape only (`closerequest`).',
      diagnostic: 'usage.attribute.value',
      correct: 'closedByAny',
    },
  },
});
