import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-carousel> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './carousel.js';

const SLIDES = [
  ['01 / Work together', 'A place for every project', 'Organize shared work in one workspace.'],
  [
    '02 / Work together',
    'Keep your team in sync',
    'Share updates and keep decisions close to the work.',
  ],
  ['03 / Work together', 'Move from idea to delivery', 'Bring the next step into focus.'],
] as const;

/** Moves the mounted slides into the example's element. */
const adopt = (element: Element, host: Element) => {
  element.append(...host.children);
  host.remove();
};

export default defineExamples('odd-carousel', {
  default: {
    label: 'Three slides',
    previewRoles: ['carousel'],
    props: { label: 'Workspace highlights' },
    recommended: true,
    preset: true,
    guidance:
      'Each element child is a slide; name the carousel with `label` and keep a visible heading beside it. It never moves by itself; listen for `change` to follow `current`.',
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            ${SLIDES.map(
              ([eyebrow, title, body]) =>
                html`<div class="odd-stack">
                  <span>${eyebrow}</span><strong>${title}</strong><span>${body}</span>
                </div>`,
            )}
          </div>`,
        ),
      );
    },
  },
  last: {
    label: 'On its last slide',
    props: { label: 'Workspace highlights', current: '3' },
    guidance: 'Set `current` (from 1) to choose the shown slide; next is disabled on the last.',
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            ${SLIDES.map(([, title, body]) => html`<p><strong>${title}</strong> ${body}</p>`)}
          </div>`,
        ),
      );
    },
  },
});
