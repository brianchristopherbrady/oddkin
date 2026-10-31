// Examples of <plain-chip>: development-only sources, as in any library, so not in "files".
// `oddkin-analyze --manifest custom-elements.json` reads them against the manifest (ADR 0048 §3).
import { defineExamples } from '@oddkin/workbench/examples';

export default defineExamples('plain-chip', {
  basic: {
    label: 'Basic',
    attributes: { label: 'Draft' },
    preset: true,
  },
  info: {
    label: 'Info',
    attributes: { label: 'Beta', tone: 'info' },
    preset: true,
  },
  removable: {
    label: 'Removable',
    attributes: { label: 'Status: open', removable: '' },
    guidance: 'The chip asks to be removed with plain-remove; the page removes it.',
    fixture({ element }) {
      element.addEventListener('plain-remove', () => element.remove());
    },
  },
});
