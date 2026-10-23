import { html } from '@oddkin/core/template';
import { defineExamples, type ExampleFixtureContext } from '@oddkin/workbench/examples';
// Brings <odd-icon> into HTMLElementTagNameMap, so props are checked against the element.
import type { OddkinIcon } from './icon.js';

/** An inline gear on the 20-unit grid, stroked in the current colour. */
const gear = ({ element, mount }: ExampleFixtureContext<OddkinIcon>) => {
  const host = mount(
    html`<div>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      >
        <circle cx="10" cy="10" r="2.5" />
        <path
          d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.5 1.5M13.5 13.5L15 15M5 15l1.5-1.5M13.5 6.5L15 5"
        />
      </svg>
    </div>`,
  );
  element.append(host.querySelector('svg')!);
  host.remove();
};

const dot =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"%3E%3Ccircle cx="10" cy="10" r="6"/%3E%3C/svg%3E';

export default defineExamples('odd-icon', {
  default: {
    label: 'Decorative',
    previewRoles: ['icon'],
    recommended: true,
    preset: true,
    guidance:
      'Beside text that names the same thing, leave `label` empty: the icon is hidden from assistive technology.',
    fixture: gear,
  },
  labelled: {
    label: 'Meaningful on its own',
    props: { label: 'Settings' },
    guidance: 'Alone, an icon needs `label`; it then reads as an image with that name.',
    fixture: gear,
  },
  small: { label: 'Small (16 px)', props: { size: 'sm' }, fixture: gear },
  large: { label: 'Large (24 px)', props: { size: 'lg' }, fixture: gear },
  fromUrl: {
    label: 'From a URL',
    props: { src: dot, label: 'Online' },
    guidance:
      'An SVG file by URL is drawn in the current text colour; the page must allow the URL in `img-src`.',
  },
  altAttribute: {
    label: '"alt" instead of "label"',
    attributes: { alt: 'Settings' },
    fixture: gear,
    incorrect: {
      explanation:
        '`odd-icon` has no `alt`; the icon stays decorative and unnamed. Use `label` to name it.',
      diagnostic: 'usage.attribute.unknown',
      correct: 'labelled',
    },
  },
});
