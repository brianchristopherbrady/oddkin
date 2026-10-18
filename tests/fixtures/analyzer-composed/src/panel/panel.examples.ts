import { defineExamples } from '@oddkin/workbench/examples';

export default defineExamples('acme-panel', {
  default: { slots: { default: 'Panel body' }, previewRoles: ['surface'] },
  dismissible: {
    attributes: { dismissible: '' },
    slots: { default: 'Close me' },
    fixture({ scope, element }) {
      scope.listen(element, 'acme-dismiss', () => element.remove());
    },
  },
});
