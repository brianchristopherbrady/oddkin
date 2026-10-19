import { defineExamples as examplesFor } from '@oddkin/workbench/examples';

const tag = 'dynamic-element';
const roles = ['surface'];
const code = 'usage.boolean.false';

// Analyzable only in part: a computed tag, computed preview roles, an unknown component, and
// an incorrect example whose diagnostic is computed (left out, never listed as usable).
export const dynamicTag = examplesFor(tag, { default: {} });
export const dynamicRoles = examplesFor('dynamic-element', { roles: { previewRoles: roles } });
export const unknown = examplesFor('acme-missing', { default: {} });
export const dynamicIncorrect = examplesFor('dynamic-element', {
  wrong: { incorrect: { explanation: 'Computed.', diagnostic: code, correct: 'roles' } },
});
