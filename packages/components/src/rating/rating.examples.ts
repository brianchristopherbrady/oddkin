import { html, render } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-rating> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './rating.js';

const description = 'Choose one to five stars.';

export default defineExamples('odd-rating', {
  default: {
    label: 'Five stars',
    props: { label: 'Your rating', description, name: 'rating' },
    recommended: true,
    preset: true,
    guidance:
      'Five stars named "1 star" to "5 stars"; the value beside them says "Not rated" until one is chosen.',
  },
  selected: {
    label: 'A chosen value',
    previewRoles: ['rating'],
    props: { label: 'Your rating', description, value: '3' },
    guidance:
      '`value` is the chosen star, from "1"; the stars up to it fill and the value says "3 of 5".',
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Your rating',
      required: true,
      error: 'Choose a rating before continuing.',
    },
    preset: true,
    guidance: '`error` shows under the stars and keeps the rating invalid until it is cleared.',
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Your rating', description, value: '3', disabled: true },
  },
  readonly: {
    label: 'Read only',
    props: {
      label: 'Your rating',
      description: 'Rating from 24 responses.',
      value: '3',
      readonly: true,
    },
    guidance:
      'Shows a value the user cannot change: the stars stay focusable, so the value can be read, and it is still submitted.',
  },
  ten: {
    label: 'Ten stars',
    props: { label: 'How likely are you to recommend us?', max: 10, value: '8' },
    guidance: '`max` sets how many stars; keep the scale short enough to read at a glance.',
  },
  named: {
    label: 'Named options',
    props: { label: 'Your rating', value: 'good' },
    guidance:
      '`<option>` children (or `options`) name each star in order; their count replaces `max`, and the value is the chosen option’s.',
    fixture({ element }) {
      render(
        html`<option value="poor">Poor</option>
          <option value="fair">Fair</option>
          <option value="good">Good</option>
          <option value="great">Great</option>
          <option value="excellent">Excellent</option>`,
        element,
      );
    },
  },
  requiredFalse: {
    label: 'Optional with required="false"',
    props: { label: 'Your rating' },
    attributes: { required: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: this rating still needs a choice and blocks an empty submission. Leave the attribute out for an optional rating.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Your rating', description, name: 'rating', required: true },
    guidance:
      'The chosen star’s value is submitted under `name`; nothing is submitted while none is chosen, and `required` blocks that.',
    fixture({ scope, element, mount }) {
      const form = mount(
        html`<form>
          <odd-button type="submit" appearance="primary">Send</odd-button>
          <output name="submitted"></output>
        </form>`,
      ) as HTMLFormElement;
      form.prepend(element);
      scope.listen(form, 'submit', (event) => {
        event.preventDefault();
        form.querySelector('output')!.value = new URLSearchParams(
          new FormData(form) as unknown as Record<string, string>,
        ).toString();
      });
    },
  },
});
